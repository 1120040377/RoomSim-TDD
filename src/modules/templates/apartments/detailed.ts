import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import type { FurnitureType, Plan } from '@/modules/model/types';
import { addFurniture, addDoor, addWindow, recomputeRooms, type TemplateMeta } from '../_utils';
import { nearestWallPoint } from '@/modules/geometry/nearest-wall';
import { configureServices } from './services';

type Point = [number, number];
type Purpose = 'bedroom' | 'living' | 'dining' | 'kitchen' | 'bath' | 'hall' | 'studio' | 'balcony';
export interface Zone { name: string; purpose: Purpose; polygon: Point[] }
interface Layout { id: string; name: string; width: number; height: number; zones: Zone[]; doors: Point[]; entry: Point; windows: Point[]; passages?:[number,number,number][]; description?:string }
const rect = (name: string, purpose: Purpose, x: number, y: number, w: number, h: number): Zone => ({ name, purpose, polygon: [[x,y],[x+w,y],[x+w,y+h],[x,y+h]] });
const layouts: Layout[] = [
  { id: 'studio', name: '单间公寓', width: 700, height: 500,
    zones: [rect('卫生间','bath',0,0,220,220), { name:'开放起居 / 睡眠',purpose:'studio', polygon:[[220,0],[700,0],[700,500],[0,500],[0,220],[220,220]] }],
    doors:[[220,150]], entry:[330,0], windows:[[700,330],[480,500]] },
  { id:'one-bed-one-living',name:'一室一厅',width:800,height:625,
    zones:[rect('卧室','bedroom',0,0,400,350),rect('卫生间','bath',400,0,200,240),rect('厨房','kitchen',600,0,200,350),
      { name:'客餐厅',purpose:'living',polygon:[[400,240],[600,240],[600,350],[800,350],[800,625],[0,625],[0,350],[400,350]] }],
    doors:[[65,350],[500,240],[690,350]],entry:[100,625],windows:[[210,0],[800,170],[480,625]] },
  { id:'two-bed-one-living',name:'两室一厅',width:1000,height:700,
    zones:[rect('主卧','bedroom',0,0,400,350),rect('次卧','bedroom',400,0,350,350),rect('卫生间','bath',750,0,250,350),rect('厨房','kitchen',0,350,260,350),rect('客餐厅','living',260,350,740,350)],
    doors:[[330,350],[465,350],[865,350],[260,530]],entry:[350,700],windows:[[200,0],[575,0],[0,530],[740,700]] },
  {id:'two-bed-two-living',name:'两室两厅',width:900,height:1120,description:'独立玄关 · 南北分卧 · 客餐贯通 · 南向生活阳台',
    zones:[rect('次卧','bedroom',0,0,320,340),rect('公卫','bath',0,340,220,240),rect('主卧','bedroom',0,580,350,400),
      rect('餐厅','dining',320,0,320,480),rect('厨房','kitchen',640,0,260,320),rect('入户玄关','hall',640,320,260,160),
      {name:'卧室过厅',purpose:'hall',polygon:[[220,340],[320,340],[320,480],[350,480],[350,580],[220,580]]},
      rect('客厅','living',350,480,550,500),rect('生活阳台','balcony',350,980,400,140)],
    doors:[[270,340],[220,430],[350,680],[640,160]],entry:[900,400],
    passages:[[320,400,90],[350,530,80],[640,400,120],[480,480,240],[770,480,180],[550,980,300]],
    windows:[[150,0],[0,445],[0,780],[480,0],[790,0],[900,730],[550,1120]]},
  {id:'three-bed-two-living',name:'三室两厅',width:1040,height:1140,description:'入户凹口 · 主卧套卫 · 短过厅 · 客餐连通 · 双阳台',
    zones:[rect('北次卧','bedroom',0,0,320,330),rect('公卫','bath',0,330,220,220),rect('主卫','bath',0,550,220,220),
      {name:'主卧套房',purpose:'bedroom',polygon:[[220,550],[350,550],[350,1000],[0,1000],[0,770],[220,770]]},
      rect('餐厅','dining',320,0,380,450),rect('厨房','kitchen',700,0,280,300),rect('入户玄关','hall',700,300,280,150),
      {name:'卧室过厅',purpose:'hall',polygon:[[220,330],[320,330],[320,450],[350,450],[350,550],[220,550]]},
      rect('客厅','living',350,450,350,550),rect('南次卧','bedroom',700,450,340,400),
      rect('生活阳台','balcony',350,1000,350,140),rect('次卧阳台','balcony',700,850,340,150)],
    doors:[[270,330],[220,430],[350,650],[220,660],[700,150],[700,550]],entry:[980,375],
    passages:[[320,390,90],[350,500,80],[700,375,120],[525,450,280],[525,1000,270],[870,850,240]],
    windows:[[150,0],[0,430],[0,650],[150,1000],[510,0],[840,0],[1040,650],[525,1140],[870,1000]]},
];

/** Split shared edges at all junctions, then deduplicate so every room is connected. */
function buildTopology(plan: Plan, zones: Zone[]) {
  const all = zones.flatMap(z => z.polygon);
  const nodeByPoint = new Map<string,string>(); const wallKeys = new Set<string>();
  function node(p: Point) {
    const key = p.join(','); let id = nodeByPoint.get(key);
    if (!id) { id = nanoid(); nodeByPoint.set(key,id); plan.nodes[id] = { id, position: { x:p[0], y:p[1] } }; }
    return id;
  }
  for (const zone of zones) zone.polygon.forEach((a,i) => {
    const b = zone.polygon[(i+1)%zone.polygon.length];
    const cuts = all.filter(p => a[0] === b[0]
      ? p[0] === a[0] && p[1] >= Math.min(a[1],b[1]) && p[1] <= Math.max(a[1],b[1])
      : p[1] === a[1] && p[0] >= Math.min(a[0],b[0]) && p[0] <= Math.max(a[0],b[0]))
      .sort((p,q) => a[0] === b[0] ? p[1]-q[1] : p[0]-q[0]);
    for (let j=1;j<cuts.length;j++) {
      const s=node(cuts[j-1]),e=node(cuts[j]); if(s===e) continue;
      const key=[s,e].sort().join('|'); if(wallKeys.has(key)) continue; wallKeys.add(key);
      const id=nanoid(); plan.walls[id]={id,startNodeId:s,endNodeId:e,thickness:12,height:280};
    }
  });
}
function opening(plan: Plan, at: Point, window = false, width = 85,passage=false) {
  const near = nearestWallPoint({x:at[0],y:at[1]},plan,1); if (!near) throw new Error('Template opening has no wall');
  const w=plan.walls[near.wallId], a=plan.nodes[w.startNodeId].position,b=plan.nodes[w.endNodeId].position;
  const length=Math.hypot(a.x-b.x,a.y-b.y);
  const actualWidth=Math.min(width,(Math.min(near.offset,length-near.offset)-8)*2);
  if(actualWidth<60) throw new Error(`Template opening too narrow at ${at}`);
  const id=window ? addWindow(plan,w.id,near.offset,actualWidth) : addDoor(plan,w.id,near.offset,actualWidth);
  if (!window && plan.openings[id].kind==='door') {plan.openings[id].state=1;plan.openings[id].passage=passage;if(passage)plan.openings[id].height=250;}
}
export function zoneBounds(z: Zone) { const xs=z.polygon.map(p=>p[0]),ys=z.polygon.map(p=>p[1]); return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}; }
export function zoneContains(z: Zone, px:number,py:number) {
  let inside=false;
  for(let i=0,j=z.polygon.length-1;i<z.polygon.length;j=i++) {const a=z.polygon[i],b=z.polygon[j]; if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0]) inside=!inside;}
  return inside;
}
function furnish(plan: Plan, zone: Zone) {
  const {x,y,w,h}=zoneBounds(zone);
  const put=(type:FurnitureType,px:number,py:number,rotation=0,elevation?:number) => {
    const id=addFurniture(plan,type,{x:x+px,y:y+py},rotation);
    if(elevation!==undefined) Object.assign(plan.furniture[id],{elevation,mount:elevation>0?'wall':'floor'});
    return plan.furniture[id];
  };
  if(zone.purpose==='bedroom') {
    if(zone.name==='主卧套房'){
      put('bed-double',175,325);put('side-table',65,245);put('side-table',285,245);
      const wardrobe=put('wardrobe-2',285,150,-Math.PI/2);wardrobe.size.width=100;
      put('lamp-ceiling',175,325);return;
    }
    const single=zone.name!=='主卧' && zone.name!=='卧室';
    put(single?'bed-single':'bed-double',w*0.5,125);
    put('side-table',w*0.5-(single?85:110),40);
    if(!single) put('side-table',w*0.5+110,40);
    put('wardrobe-2',w-40,h-100,-Math.PI/2);
    if(h>=380) { const desk=put('desk',w*0.43,h-40); desk.size.width=100; put('office-chair',w*0.43,h-110); }
    put('lamp-ceiling',w*0.5,h*0.5);
  }
  if(zone.purpose==='kitchen') {
    put('fridge',w-43,52,-Math.PI/2);put('sink',w-37,147,-Math.PI/2);put('stove',w-37,245,-Math.PI/2);
    put('wall-cabinet',w-23,147,-Math.PI/2,150);put('lamp-ceiling',w*0.45,h*0.52);
  }
  if(zone.purpose==='bath') {
    put('toilet',45,52,Math.PI);put('shower',w-55,55);
    const basin=put('basin',45,Math.min(h-65,185),Math.PI/2);basin.size.width=55;
    if(h>=300) put('washing-machine',w-43,h-52);
    put('lamp-ceiling',w/2,h/2);
  }
  if(zone.purpose==='living') {
    if(zone.name==='客厅'&&h>=500){
      const sofa=put('sofa-2',60,h*0.5,Math.PI/2);sofa.color='#7b9292';
      const coffee=put('coffee-table',w/2,h*0.5);coffee.size={width:55,depth:95,height:38};
      put('tv-cabinet',w-35,h*0.5,-Math.PI/2);put('tv',w-18,h*0.5,-Math.PI/2,100);
      put('lamp-ceiling',w/2,h/2);put('lamp-floor',40,h-60);return;
    }
    const top=zone.polygon.length>4?350-y:0, depth=h-top;
    const center=zone.name==='客餐厅'&&w>650?w*0.65:w*0.55;
    const sofa=put(w>550?'sofa-3':'sofa-2',center,top+depth-55);sofa.color='#7b9292';
    const coffee=put('coffee-table',center,top+depth-170);coffee.size={width:95,depth:45,height:38};
    put('tv-cabinet',center,top+30,Math.PI);put('tv',center,top+15,Math.PI,100);
    put('lamp-ceiling',center,top+depth/2);
    if(zone.name==='客餐厅'&&w>650) {put('dining-table-4',125,top+depth/2);put('dining-chair',125,top+depth/2-80,Math.PI);put('dining-chair',125,top+depth/2+80);}
    put('lamp-floor',w-35,top+depth-40);
  }
  if(zone.purpose==='dining') {
    put('dining-table-4',w/2,h/2);
    for(const dx of [-38,38]) {put('dining-chair',w/2+dx,h/2-80,Math.PI);put('dining-chair',w/2+dx,h/2+80);}
    put('lamp-ceiling',w/2,h/2);
  }
  if(zone.purpose==='hall') {put('lamp-ceiling',w*0.33,h/2);put('lamp-ceiling',w*0.67,h/2);}
  if(zone.purpose==='balcony'){
    if(zone.name==='生活阳台')put('washing-machine',w-45,h/2,Math.PI/2);
    put('lamp-ceiling',w/2,h/2);
  }
  if(zone.purpose==='studio') {
    put('bed-double',545,125);put('side-table',435,40);put('wardrobe-2',655,340,-Math.PI/2);
    put('fridge',45,280,Math.PI/2);put('sink',45,375,Math.PI/2);put('stove',150,460);
    put('wall-cabinet',24,375,Math.PI/2,150);
    const sofa=put('sofa-2',410,435);sofa.size.width=140;
    const table=put('coffee-table',410,325);table.size.width=85;table.size.depth=45;
    put('tv',690,235,-Math.PI/2,105);put('lamp-ceiling',450,300);put('lamp-ceiling',110,340);
  }
}
function build(layout:Layout,name:string):Plan {
  const plan=createEmptyPlan(nanoid(),name);buildTopology(plan,layout.zones);
  for(const d of layout.doors) opening(plan,d,false,d[0]===700&&layout.id==='two-bed-two-living'?160:80);
  for(const [x,y,width] of layout.passages??[])opening(plan,[x,y],false,width,true);
  opening(plan,layout.entry,false,90);for(const w of layout.windows) opening(plan,w,true,140);
  recomputeRooms(plan);
  for(const room of Object.values(plan.rooms)) {
    const key=room.polygon.map(p=>`${p.x},${p.y}`).sort().join('|');
    const zone=layout.zones.find(z=>z.polygon.map(p=>p.join(',')).sort().join('|')===key)
      ?? layout.zones.find(z=>zoneContains(z,room.polygon.reduce((n,p)=>n+p.x,0)/room.polygon.length,room.polygon.reduce((n,p)=>n+p.y,0)/room.polygon.length));
    if(zone) room.name=zone.name;
  }
  layout.zones.forEach(z=>furnish(plan,z));configureServices(plan,layout.zones);
  const entryZone=layout.zones.find(z=>z.name==='入户玄关');
  if(entryZone){const b=zoneBounds(entryZone);plan.walkthrough.startPosition={x:b.x+b.w/2,y:b.y+b.h/2};plan.walkthrough.startYaw=Math.PI/2;}
  return plan;
}
export const detailedApartmentTemplates: TemplateMeta[]=layouts.map(l=>({id:l.id,name:l.name,area:`${Math.round(l.zones.reduce((sum,z)=>sum+Math.abs(z.polygon.reduce((a,p,i)=>{const q=z.polygon[(i+1)%z.polygon.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2,0)/10000)}㎡`,description:l.description??`${l.zones.length} 个功能空间 · 家具 / 照明 / 水电预配置`,build:name=>build(l,name)}));
