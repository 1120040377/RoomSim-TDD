import { describe,it,expect,vi } from 'vitest';
import { BoxGeometry,Group,Mesh,MeshStandardMaterial,PlaneGeometry } from 'three';
import { FloorBake } from '../../../src/modules/walkthrough/baking/floor-bake';
import type { BakeResult } from '../../../src/modules/walkthrough/baking/bake-job';

const bounds={minX:0,minZ:0,width:.04,depth:.04};
function setup(){
  const floor=new Group(),material=new MeshStandardMaterial(),mesh=new Mesh(new PlaneGeometry(),material);
  mesh.userData.roomId='room';floor.add(mesh);
  const job={start:vi.fn(async():Promise<BakeResult>=>({values:new Float32Array([.5]),rays:32,buildMs:1,bakeMs:1})),cancel:vi.fn(),dispose:vi.fn()};
  const snapshot=vi.fn(async()=>new Float32Array());
  return {floor,material,mesh,job,snapshot,bake:new FloorBake(job,snapshot)};
}
describe('floor bake lifetime',()=>{
  it('samples above a rug and shares the same AO texture with its top, restoring both',async()=>{
    const {bake,floor,job,material}=setup();
    const rug=new Mesh(new PlaneGeometry(1,1),new MeshStandardMaterial());
    rug.rotation.x=-Math.PI/2;rug.position.y=.012;rug.userData.floorContactReceiver=true;
    job.start.mockImplementation(async(...args:unknown[])=>{
      const input=args[0] as {positions:Float32Array};expect(input.positions[1]).toBeCloseTo(.012);
      return {values:new Float32Array([.6]),rays:32,buildMs:1,bakeMs:1};
    });
    expect(await bake.start([rug],floor,bounds)).toBe(true);
    expect(rug.material.aoMap).toBe(material.aoMap);expect(rug.geometry.hasAttribute('uv1')).toBe(true);
    const dispose=vi.spyOn(material.aoMap!,'dispose');bake.invalidate();
    expect(rug.material.aoMap).toBeNull();expect(material.aoMap).toBeNull();expect(dispose).toHaveBeenCalledOnce();
    expect(rug.geometry.hasAttribute('uv1')).toBe(false);rug.geometry.dispose();rug.material.dispose();
  });
  it('publishes wall and floor maps together and restores both on invalidation',async()=>{
    const {bake,floor,job,material}=setup();
    const original=new MeshStandardMaterial(),wall=new Mesh(new BoxGeometry(1,1,.1),original);
    wall.userData.wallId='wall';
    job.start.mockImplementation(async(...args:unknown[])=>{
      const input=args[0] as {positions:Float32Array};
      return {values:new Float32Array(input.positions.length/3).fill(.5),rays:32,buildMs:1,bakeMs:1};
    });
    expect(await bake.start([wall],floor,bounds,wall)).toBe(true);
    expect(job.start).toHaveBeenCalledTimes(2);
    expect(wall.material).not.toBe(original);expect(wall.material.aoMap).toBeTruthy();
    const dispose=vi.spyOn(wall.material.aoMap!,'dispose');
    bake.invalidate();bake.invalidate();
    expect(wall.material).toBe(original);expect(material.aoMap).toBeNull();
    expect(wall.geometry.hasAttribute('uv1')).toBe(false);expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('does not publish floor lighting if the wall job fails',async()=>{
    const {bake,floor,job,material}=setup();
    const wall=new Mesh(new BoxGeometry(),new MeshStandardMaterial());wall.userData.wallId='wall';
    job.start.mockResolvedValueOnce({values:new Float32Array([.5]),rays:32,buildMs:1,bakeMs:1});
    job.start.mockRejectedValueOnce(new Error('worker failure'));
    await expect(bake.start([wall],floor,bounds,wall)).rejects.toThrow('worker failure');
    expect(material.aoMap).toBeNull();expect(wall.material.aoMap).toBeNull();
  });
  it('ignores a wall response arriving after cancellation',async()=>{
    const {bake,floor,job,material}=setup();
    const original=new MeshStandardMaterial(),wall=new Mesh(new BoxGeometry(),original);wall.userData.wallId='wall';
    let finish!:(value:BakeResult)=>void;
    job.start.mockResolvedValueOnce({values:new Float32Array([.5]),rays:32,buildMs:1,bakeMs:1});
    job.start.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const pending=bake.start([wall],floor,bounds,wall);
    await vi.waitFor(()=>expect(job.start).toHaveBeenCalledTimes(2));
    bake.invalidate();finish({values:new Float32Array(),rays:0,buildMs:0,bakeMs:0});
    expect(await pending).toBe(false);expect(material.aoMap).toBeNull();expect(wall.material).toBe(original);
  });
  it('applies once, restores original material and releases owned texture on invalidation',async()=>{
    const {bake,floor,material,mesh}=setup();material.aoMapIntensity=.3;
    expect(await bake.start([new Group()],floor,bounds)).toBe(true);
    const texture=material.aoMap!,dispose=vi.spyOn(texture,'dispose');
    expect(texture).toBeTruthy();expect(mesh.geometry.hasAttribute('uv1')).toBe(true);
    bake.invalidate();bake.invalidate();
    expect(material.aoMap).toBeNull();expect(material.aoMapIntensity).toBe(.3);
    expect(mesh.geometry.hasAttribute('uv1')).toBe(false);expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('ignores a stale worker response after invalidation',async()=>{
    const {job,bake,floor,material}=setup();let finish!:(value:BakeResult)=>void;
    job.start.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const task=bake.start([],floor,bounds);bake.invalidate();
    finish({values:new Float32Array([.1]),rays:32,buildMs:1,bakeMs:1});
    expect(await task).toBe(false);expect(material.aoMap).toBeNull();
  });
  it('cancels during snapshot and never starts worker',async()=>{
    const {snapshot,job,bake,floor}=setup();
    snapshot.mockImplementation(async()=>{bake.invalidate();return new Float32Array();});
    expect(await bake.start([new Group()],floor,bounds)).toBe(false);
    expect(job.start).not.toHaveBeenCalled();bake.dispose();
    await expect(bake.start([],floor,bounds)).rejects.toThrow('disposed');
  });
});
