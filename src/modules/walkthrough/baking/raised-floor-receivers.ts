import {Box3,Matrix4,Mesh,Vector3,type Object3D} from 'three';

/** Only explicitly marked horizontal XY planes (rug tops), never furniture boxes. */
export function raisedFloorReceivers(roots:Object3D[]){
  const receivers:Array<{mesh:Mesh;height:number;contains:(x:number,z:number)=>boolean}>=[];
  const seen=new Set<Mesh>();
  for(const root of roots){
    root.updateWorldMatrix(true,true);
    root.traverseVisible(object=>{
      if(!(object instanceof Mesh)||!object.userData.floorContactReceiver||seen.has(object))return;
      seen.add(object);
      const up=new Vector3(0,0,1).transformDirection(object.matrixWorld);
      if(up.y<.999)return;
      object.geometry.computeBoundingBox();const bounds=object.geometry.boundingBox?.clone()??new Box3();
      if(bounds.isEmpty()||bounds.max.z-bounds.min.z>1e-5)return;
      const height=new Vector3(0,0,bounds.min.z).applyMatrix4(object.matrixWorld).y;
      const inverse=new Matrix4().copy(object.matrixWorld).invert(),point=new Vector3();
      receivers.push({mesh:object,height,contains:(x,z)=>{
        point.set(x,height,z).applyMatrix4(inverse);
        return point.x>=bounds.min.x&&point.x<=bounds.max.x&&point.y>=bounds.min.y&&point.y<=bounds.max.y;
      }});
    });
  }
  return receivers;
}
