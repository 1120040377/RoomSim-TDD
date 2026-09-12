import {Group,Mesh,Plane,Vector3} from 'three';
import type {Furniture,Plan} from '@/modules/model/types';
import {CUTAWAY_HEIGHT,InspectionCutaway,interiorWallIds} from './inspection-cutaway';

/** Only explicit wall decorations near a wall participate, never freestanding furniture. */
export function markWallDecorations(root:Group,plan:Plan):void {
  const interior=interiorWallIds(plan);
  for(const group of root.children){
    const f: Furniture|undefined=plan.furniture[group.userData.furnitureId];
    if(!f||!['wall-art','wall-mirror'].includes(f.type))continue;
    let nearest: string|undefined,best=Infinity;
    for(const wall of Object.values(plan.walls)){
      const a=plan.nodes[wall.startNodeId]?.position,b=plan.nodes[wall.endNodeId]?.position;
      if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
      if(!length)continue;
      const t=Math.max(0,Math.min(1,((f.position.x-a.x)*dx+(f.position.y-a.y)*dy)/length));
      const distance=Math.hypot(f.position.x-a.x-t*dx,f.position.y-a.y-t*dy);
      if(distance<=wall.thickness/2+15&&distance<best){best=distance;nearest=wall.id;}
    }
    if(nearest)group.userData.decorationWall={id:nearest,interior:interior.has(nearest)};
  }
}

const horizontal=[new Plane(new Vector3(0,-1,0),CUTAWAY_HEIGHT)];
export function updateWallDecorationCutaway(root:Group,cutaway:InspectionCutaway,enabled:boolean,directional:boolean,preserveInterior:boolean):void {
  for(const group of root.children){
    const wall=group.userData.decorationWall;
    if(!wall)continue;
    const preserve=enabled&&directional&&(preserveInterior||!wall.interior);
    group.traverse(object=>{
      if(!(object instanceof Mesh))return;
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        material.clippingPlanes=enabled?(preserve?cutaway.planes:horizontal):null;
        material.clipIntersection=preserve;material.clipShadows=true;material.needsUpdate=true;
      }
    });
  }
}
