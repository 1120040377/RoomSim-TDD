import { Mesh, Raycaster, Vector2, Vector3, type Camera, type Object3D } from 'three';
export const AIM_SCREEN_Y=0.44;

/** Only the first physical surface under the crosshair can be used.
 * Visual wall fading must not allow interaction through walls.
 */
export function pickAimedObject(camera:Camera, roots:Object3D[], eye:Vector3, reach=1.8):string|null {
  camera.updateMatrixWorld(true);
  roots.forEach(root=>root.updateWorldMatrix(true,true));
  const ray=new Raycaster();ray.setFromCamera(new Vector2(0,1-2*AIM_SCREEN_Y),camera);
  // Decorative outlines use Three's wide line-picking threshold; they must not
  // count as physical surfaces or a crosshair beside furniture would still hit.
  const hit=ray.intersectObjects(roots,true).find(hit=>hit.object instanceof Mesh);
  if(!hit||eye.distanceTo(hit.point)>reach)return null;
  let object:Object3D|null=hit.object,id:string|null=null;
  while(object){
    id=object.userData.furnitureId??object.userData.openingId??null;
    if(id)break;object=object.parent;
  }
  if(!id)return null;
  const direction=hit.point.clone().sub(eye),distance=direction.length();
  ray.set(eye,direction.normalize());ray.near=0.025;ray.far=Math.max(0,distance-0.025);
  const blocker=ray.intersectObjects(roots,true).find(hit=>hit.object instanceof Mesh);
  if(blocker){
    let parent:Object3D|null=blocker.object;
    while(parent){if(parent.userData.furnitureId===id||parent.userData.openingId===id)return id;parent=parent.parent;}
    return null;
  }
  return id;
}
