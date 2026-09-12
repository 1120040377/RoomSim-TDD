import { Group } from 'three';
import type { Furniture,Plan } from '@/modules/model/types';
import { buildOne } from './builders/furniture-builder';

function sameGeometry(a:Furniture,b:Furniture):boolean {
  return a.type===b.type&&a.color===b.color&&a.size.width===b.size.width&&a.size.depth===b.size.depth&&a.size.height===b.size.height;
}

/** Immutable plan records let unchanged assets keep GPU resources and door state. */
export function reconcileFurniture(root:Group,previous:Plan,next:Plan,dispose:(group:Group)=>void):void {
  const existing=new Map(root.children.map(object=>[object.userData.furnitureId,object as Group]));
  const heightChanged=previous.meta.defaultWallHeight!==next.meta.defaultWallHeight;
  for(const [id,object] of existing)if(!next.furniture[id]){root.remove(object);dispose(object);}
  for(const item of Object.values(next.furniture)){
    const old=previous.furniture[item.id],object=existing.get(item.id);
    if(object&&old&&!heightChanged&&sameGeometry(old,item)){
      if(old===item)continue;
      object.position.set(item.position.x/100,item.elevation===undefined?0:item.elevation/100-(object.userData.localBaseY??0),item.position.y/100);
      object.rotation.y=-item.rotation;
      object.userData.baseElevation=(object.position.y+(object.userData.localBaseY??0))*100;
      object.updateMatrixWorld(true);
    }else{
      if(object){root.remove(object);dispose(object);}
      root.add(buildOne(item,next.meta.defaultWallHeight));
    }
  }
}
