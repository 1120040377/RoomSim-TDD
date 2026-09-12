import { describe,it,expect,vi } from 'vitest';
import { BufferGeometry,Float32BufferAttribute,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial } from 'three';
import { snapshotOccluders } from '../../../src/modules/walkthrough/baking/scene-snapshot';

function geometry(){return new BufferGeometry().setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));}
describe('incremental occluder snapshot',()=>{
  it('excludes camera-dependent cutaway caps from static room occlusion',async()=>{
    const root=new Group(),physical=new Mesh(geometry(),new MeshBasicMaterial());
    const cap=new Mesh(geometry(),new MeshBasicMaterial());cap.userData.cutawayCap=true;
    const backdrop=new Mesh(geometry(),new MeshBasicMaterial());backdrop.userData.exteriorBackdrop=true;
    root.add(physical,cap,backdrop);
    expect((await snapshotOccluders(root))!.length).toBe(9);
    cap.position.y=2;
    expect((await snapshotOccluders(root))!.length).toBe(9);
  });
  it('expands instances in world space without mutating source buffers',async()=>{
    const root=new Group();root.position.x=2;
    const mesh=new InstancedMesh(geometry(),new MeshBasicMaterial(),2);
    mesh.setMatrixAt(1,new Matrix4().makeTranslation(0,0,3));root.add(mesh);
    const data=await snapshotOccluders(root);
    expect(Array.from(data!)).toEqual([2,0,0,3,0,0,2,1,0,2,0,3,3,0,3,2,1,3]);
    expect(mesh.geometry.getAttribute('position').getX(0)).toBe(0);
  });
  it('excludes invisible subtrees and transparent meshes, respects draw ranges',async()=>{
    const root=new Group(),hidden=new Group();hidden.visible=false;
    hidden.add(new Mesh(geometry(),new MeshBasicMaterial()));root.add(hidden);
    root.add(new Mesh(geometry(),new MeshBasicMaterial({transparent:true})));
    const clipped=geometry();clipped.setDrawRange(0,0);root.add(new Mesh(clipped,new MeshBasicMaterial()));
    expect((await snapshotOccluders(root))!.length).toBe(0);
  });
  it('yields within one large mesh and cancels without returning partial data',async()=>{
    const controller=new AbortController();
    const mesh=new InstancedMesh(geometry(),new MeshBasicMaterial(),1000);
    const clock=vi.spyOn(performance,'now');let now=0;clock.mockImplementation(()=>now++);
    let yields=0;
    try{
      expect(await snapshotOccluders(mesh,{budgetMs:2,signal:controller.signal,yieldTask:async()=>{yields++;controller.abort();}})).toBeNull();
      expect(yields).toBe(1);
    }finally{clock.mockRestore();}
  });
  it('rejects excessive geometry before allocating an unbounded snapshot',async()=>{
    const mesh=new InstancedMesh(geometry(),new MeshBasicMaterial(),2);
    await expect(snapshotOccluders(mesh,{maxTriangles:1})).rejects.toThrow('triangle budget');
  });
  it('preserves indexed triangles across output chunk boundaries and scheduler yields',async()=>{
    const geo=geometry();geo.setIndex([2,1,0]);
    const mesh=new InstancedMesh(geo,new MeshBasicMaterial(),4100);
    const clock=vi.spyOn(performance,'now');let now=0,yields=0;
    clock.mockImplementation(()=>now++);
    try{
      const data=await snapshotOccluders(mesh,{budgetMs:2,yieldTask:async()=>{yields++;}});
      expect(data!.length).toBe(4100*9);expect(yields).toBeGreaterThan(1);
      for(let i=0;i<4100;i++)expect(Array.from(data!.subarray(i*9,i*9+9))).toEqual([0,1,0,1,0,0,0,0,0]);
    }finally{clock.mockRestore();}
  });
});
