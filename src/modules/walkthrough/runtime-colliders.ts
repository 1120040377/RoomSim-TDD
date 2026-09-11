import { Box3, Euler, Mesh, Quaternion, Vector3, type Group } from 'three';
import type { OrientedBox } from '@/modules/geometry/collision';
import type { Mechanism } from './builders/furniture/storage';

/** Door leaves and extended drawers are real obstacles in life mode. */
export function runtimeColliders(furniture:Group,doors:Record<string,Group>,personHeight=170):OrientedBox[] {
  const boxes:OrientedBox[]=[];
  function add(mesh:Mesh){
    mesh.updateWorldMatrix(true,false);
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    const local=mesh.geometry.boundingBox;if(!local)return;
    const world=new Box3().setFromObject(mesh);if(world.min.y*100>=personHeight||world.max.y<0.05)return;
    const center=local.getCenter(new Vector3()).applyMatrix4(mesh.matrixWorld),size=local.getSize(new Vector3()).multiply(mesh.getWorldScale(new Vector3()));
    const yaw=new Euler().setFromQuaternion(mesh.getWorldQuaternion(new Quaternion()),'YXZ').y;
    boxes.push({center:{x:center.x*100,y:center.z*100},halfW:size.x*50,halfD:size.z*50,rotation:-yaw});
  }
  for(const pivot of Object.values(doors)){const panel=pivot.children[0];if(panel instanceof Mesh)add(panel);}
  for(const object of furniture.children)for(const mechanism of (object.userData.mechanisms??[]) as Mechanism[]){
    if(mechanism.value<0.03)continue;
    const panel=mechanism.object.children[0];if(panel instanceof Mesh)add(panel);
  }
  return boxes;
}
