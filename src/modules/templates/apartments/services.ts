import { nanoid } from 'nanoid';
import type { Plan, Vec2, UtilityKind, UtilityPoint } from '@/modules/model/types';
import { defaultRenovation } from '@/modules/renovation/model';
import { nearestWallPoint } from '@/modules/geometry/nearest-wall';
import { type Zone, zoneBounds, zoneContains } from './detailed';
import { connectWaterNetwork,isWater } from '@/modules/renovation/water-network';

export function configureServices(plan: Plan, zones: Zone[]) {
  plan.renovation=defaultRenovation();
  const add=(kind:UtilityKind,label:string,points:UtilityPoint[],height:number,circuit:string) => {
    const id=nanoid();plan.renovation!.utilities[id]={id,kind,label,points,height,rotation:0,circuit};return id;
  };
  function point(kind:UtilityKind,label:string,position:Vec2,height:number,circuit:string) {
    const near=nearestWallPoint(position,plan);if(!near)return;
    const wall=plan.walls[near.wallId],a=plan.nodes[wall.startNodeId].position,b=plan.nodes[wall.endNodeId].position;
    const len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
    const sign=(position.x-near.foot.x)*nx+(position.y-near.foot.y)*ny>=0?1:-1;
    // Separate hot/cold along the wall tangent, not the wall normal (projection
    // would collapse a normal offset back onto exactly the same point).
    const shift=kind==='cold-water'?8:kind==='hot-water'?-8:0;
    const along=Math.max(12,Math.min(len-12,near.offset+shift));
    const p={x:a.x+(b.x-a.x)/len*along+nx*sign*8,y:a.y+(b.y-a.y)/len*along+ny*sign*8};
    const id=add(kind,label,[p],height,circuit);
    plan.renovation!.utilities[id].rotation=Math.atan2(nx*sign,-ny*sign);
    if(isWater(kind)){plan.renovation!.utilities[id].role='terminal';return;}
    const routeKind=kind==='socket'||kind==='switch'?'electric':kind;
    const trunk=routeKind==='electric'?255:kind==='drain'?5:20;
    add(routeKind,`${label} · 支路`,[{...p,height},{...p,height:trunk},{x:a.x+nx*sign*8,y:a.y+ny*sign*8,height:trunk}],trunk,circuit);
  }
  for(const f of Object.values(plan.furniture)) {
    const room=zones.find(z=>zoneContains(z,f.position.x,f.position.y))?.name??'公共区';
    if(['bed-single','bed-double','bed-kingsize'].includes(f.type)) {
      for(const side of [-1,1])point('socket',`${room}床头${side<0?'左':'右'}插座`,{x:f.position.x+side*(f.size.width/2+20),y:f.position.y-90},65,`${room}插座回路`);
    }
    if(['tv','desk','fridge','stove','washing-machine'].includes(f.type))point('socket',`${room}${f.type==='fridge'?'冰箱独立':f.type==='washing-machine'?'洗衣机':f.type==='stove'?'台面备用':f.type==='tv'?'电视':'工作台'}插座`,f.position,f.type==='tv'?120:f.type==='stove'?115:35,`${room}${f.type==='fridge'?'冰箱独立':'插座'}回路`);
    if(['sink','basin','shower','toilet','washing-machine'].includes(f.type)) {
      point('cold-water',`${room}冷水接口`,{x:f.position.x+10,y:f.position.y},f.type==='shower'?110:50,`${room}给水`);
      if(['sink','basin','shower'].includes(f.type))point('hot-water',`${room}热水接口`,{x:f.position.x-10,y:f.position.y},f.type==='shower'?110:50,`${room}热水`);
      point('drain',`${room}排水接口`,f.position,5,`${room}排水`);
    }
  }
  for(const zone of zones) {
    const b=zoneBounds(zone);
    for(const door of Object.values(plan.openings)) {
      if(door.kind!=='door')continue;
      const w=plan.walls[door.wallId],a=plan.nodes[w.startNodeId].position,c=plan.nodes[w.endNodeId].position,l=Math.hypot(c.x-a.x,c.y-a.y);
      const center={x:a.x+(c.x-a.x)*door.offset/l,y:a.y+(c.y-a.y)*door.offset/l};
      if(center.x<b.x||center.x>b.x+b.w||center.y<b.y||center.y>b.y+b.h)continue;
      const t=Math.min(l-15,door.offset+door.width/2+15);
      point('switch',`${zone.name}门旁开关`,{x:a.x+(c.x-a.x)*t/l+(b.x+b.w/2-a.x)*0.02,y:a.y+(c.y-a.y)*t/l+(b.y+b.h/2-a.y)*0.02},130,`${zone.name}照明回路`);
      break;
    }
  }
  plan.renovation.utilities=connectWaterNetwork(plan).utilities;
}
