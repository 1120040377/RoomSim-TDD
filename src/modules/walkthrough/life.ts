import { toggleTv } from './tv-playback';
import { buildWaterEffect } from './water-effect';
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Furniture, Plan, Vec2 } from '@/modules/model/types';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';
import { STORAGE_TYPES, toggleStorage } from './builders/furniture/storage';
export type LifeAction='storage'|'sit'|'rest'|'light'|'tv'|'water'|'cook'|'inspect'|'door';
export interface LifeTarget {id:string;name:string;action:LifeAction;label:string;distance:number}
export function actionFor(f:Furniture):LifeAction {
  if(STORAGE_TYPES.has(f.type))return 'storage';
  if(['sofa-2','sofa-3','sofa-l','armchair','dining-chair','office-chair'].includes(f.type))return 'sit';
  if(f.type.startsWith('bed-'))return 'rest';
  if(f.type.startsWith('lamp-')||f.type==='switch')return 'light';
  if(f.type==='tv')return 'tv';
  if(['sink','basin','shower','bathtub','toilet'].includes(f.type))return 'water';
  if(f.type==='stove')return 'cook';
  return 'inspect';
}
const labels:Record<LifeAction,string>={storage:'打开 / 关闭',sit:'坐下',rest:'躺下休息',light:'开关灯',tv:'开关电视',water:'开关用水',cook:'开关灶台',inspect:'查看尺寸',door:'开关房门'};
export function nearbyFurniture(plan:Plan,position:Vec2):LifeTarget[] {
  const targets:LifeTarget[]=Object.values(plan.furniture).flatMap(f=>{
    const dx=position.x-f.position.x,dy=position.y-f.position.y,c=Math.cos(f.rotation),s=Math.sin(f.rotation);
    const lx=dx*c+dy*s,ly=-dx*s+dy*c;
    const distance=Math.hypot(Math.max(0,Math.abs(lx)-f.size.width/2),Math.max(0,Math.abs(ly)-f.size.depth/2));
    if(distance>115)return [];
    // Do not offer actions through solid walls.
    for(const w of Object.values(plan.walls)) {
      const a=plan.nodes[w.startNodeId].position,b=plan.nodes[w.endNodeId].position;
      const vx=f.position.x-position.x,vy=f.position.y-position.y,wx=b.x-a.x,wy=b.y-a.y;
      const den=vx*wy-vy*wx;if(Math.abs(den)<0.001)continue;
      const ax=a.x-position.x,ay=a.y-position.y,t=(ax*wy-ay*wx)/den,u=(ax*vy-ay*vx)/den;
      if(t>0.01&&t<0.99&&u>=0&&u<=1){const offset=u*Math.hypot(wx,wy);if(!Object.values(plan.openings).some(o=>o.kind==='door'&&o.wallId===w.id&&Math.abs(o.offset-offset)<o.width/2))return [];}
    }
    const action=actionFor(f);return [{id:f.id,name:FURNITURE_CATALOG[f.type]?.name??f.type,action,label:labels[action],distance}];
  });
  for(const op of Object.values(plan.openings))if(op.kind==='door'&&!op.passage){
    const w=plan.walls[op.wallId],a=plan.nodes[w.startNodeId].position,b=plan.nodes[w.endNodeId].position,l=Math.hypot(b.x-a.x,b.y-a.y);
    const center={x:a.x+(b.x-a.x)*op.offset/l,y:a.y+(b.y-a.y)*op.offset/l};
    const distance=Math.hypot(center.x-position.x,center.y-position.y);
    if(distance<145)targets.push({id:op.id,name:'房门',action:'door',label:'开关房门',distance:Math.max(0,distance-40)});
  }
  // Prefer usable furniture over static dimension inspection at a similar distance.
  return targets.sort((a,b)=>(a.distance+(a.action==='inspect'?60:0))-(b.distance+(b.action==='inspect'?60:0)));
}
export function useObject(group:Group,f:Furniture,report?: (message:string)=>void):string {
  const action=actionFor(f);
  if(action==='storage'){toggleStorage(group);return `${FURNITURE_CATALOG[f.type].name}${group.userData.open?'已打开':'已关闭'}`;}
  if(action==='inspect')return `${FURNITURE_CATALOG[f.type].name}：${f.size.width} × ${f.size.depth} × ${f.size.height} cm`;
  if(action==='tv') return toggleTv(group,report);
  // This model has a closed lid: flushing must not emit a faucet jet above it.
  if(f.type==='toilet')return '已冲水';
  group.userData.on=!group.userData.on;
  let effect=group.getObjectByName('life-effect');
  if(!effect&&action==='water'){
    effect=buildWaterEffect(group);group.add(effect);
  }
  if(!effect){
    effect=new Group();effect.name='life-effect';group.add(effect);
    const isCook=action==='cook';
    const material=new MeshStandardMaterial({color:isCook?'#fa9e36':'#49b9e4',emissive:isCook?'#f18c21':'#226b83',emissiveIntensity:0.65,transparent:!isCook,opacity:isCook?1:0.65});
    const stream=new Mesh(new CylinderGeometry(isCook?0.1:0.018,isCook?0.1:0.012,isCook?0.03:0.18,12),material);
    stream.position.set(0,f.size.height/100+(isCook?0.025:0.06),0);effect.add(stream);
  }
  effect.visible=group.userData.on;
  return `${action==='cook'?'灶台':'用水'}${group.userData.on?'已开启':'已关闭'}`;
}
