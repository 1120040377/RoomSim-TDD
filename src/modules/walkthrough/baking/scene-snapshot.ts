import { Matrix4, Mesh, InstancedMesh, Object3D, Vector3 } from 'three';

export interface SnapshotOptions {
  signal?: AbortSignal;
  budgetMs?: number;
  maxTriangles?: number;
  yieldTask?: () => Promise<void>;
  onTriangle?: (mesh:Mesh,indexOffset:number,instance:number)=>void;
}

/** Static opaque geometry only. Caller must abort on scene edits during capture. */
export async function snapshotOccluders(root:Object3D, options:SnapshotOptions={}):Promise<Float32Array|null> {
  const {signal,budgetMs=3,maxTriangles=1_000_000,yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0))}=options;
  if(!Number.isFinite(budgetMs)||budgetMs<=0||!Number.isInteger(maxTriangles)||maxTriangles<1)
    throw new Error('Invalid snapshot budget');
  const chunks:Float32Array[]=[];
  const chunkSize=9*4096;
  let chunk:Float32Array|null=null, used=0, total=0, deadline=performance.now()+budgetMs, work=0;
  const point=new Vector3(),instance=new Matrix4(),world=new Matrix4();
  const pending=[root];
  // Ancestors only; descendants are updated incrementally below.
  root.parent?.updateWorldMatrix(true,false);
  const checkpoint=async()=>{
    if(signal?.aborted)return false;
    if(performance.now()>=deadline){await yieldTask();deadline=performance.now()+budgetMs;}
    return !signal?.aborted;
  };
  while(pending.length){
    if(!await checkpoint())return null;
    const object=pending.pop()!;
    // Cutaway caps are camera-dependent presentation geometry, not real occluders.
    if(!object.visible||object.userData.cutawayCap||object.userData.exteriorBackdrop)continue;
    object.updateWorldMatrix(false,false);
    for(let i=object.children.length-1;i>=0;i--)pending.push(object.children[i]);
    if(!(object as Mesh).isMesh||(object as Mesh & {isSkinnedMesh?:boolean}).isSkinnedMesh)continue;
    const mesh=object as Mesh;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(materials.some(material=>material.transparent||!material.visible))continue;
    const geometry=mesh.geometry, position=geometry.getAttribute('position'), index=geometry.index;
    if(!position)continue;
    const start=Math.max(0,geometry.drawRange.start);
    const end=Math.min(index?.count??position.count,start+geometry.drawRange.count);
    const instanced=mesh as InstancedMesh;
    for(let copy=0;copy<(instanced.isInstancedMesh?instanced.count:1);copy++){
      if(instanced.isInstancedMesh){instanced.getMatrixAt(copy,instance);world.multiplyMatrices(mesh.matrixWorld,instance);}
      else world.copy(mesh.matrixWorld);
      for(let i=start;i+2<end;i+=3){
        if(++work%(options.onTriangle?32:256)===0&&!await checkpoint())return null;
        if(total/9>=maxTriangles)throw new Error('Occluder snapshot exceeds triangle budget');
        if(!chunk||used===chunkSize){chunk=new Float32Array(chunkSize);chunks.push(chunk);used=0;}
        for(let vertex=0;vertex<3;vertex++){
          point.fromBufferAttribute(position,index?index.getX(i+vertex):i+vertex).applyMatrix4(world);
          chunk[used++]=point.x;chunk[used++]=point.y;chunk[used++]=point.z;
        }
        total+=9;
        options.onTriangle?.(mesh,i,copy);
      }
    }
  }
  if(!await checkpoint())return null;
  const result=new Float32Array(total);
  let offset=0;
  for(const block of chunks){
    if(!await checkpoint())return null;
    const length=Math.min(block.length,total-offset);
    result.set(block.subarray(0,length),offset);offset+=length;
  }
  return result;
}
