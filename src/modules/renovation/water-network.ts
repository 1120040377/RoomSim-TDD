import { nanoid } from 'nanoid';
import type { Plan, Utility, UtilityKind, UtilityPoint } from '@/modules/model/types';
import { nearestWallPoint } from '@/modules/geometry/nearest-wall';

export const isWater=(kind:UtilityKind)=>['cold-water','hot-water','drain'].includes(kind);
const levels={'cold-water':20,'hot-water':34,drain:5} as const;
const lanes={'cold-water':10,'hot-water':24,drain:-10} as const;
type WaterKind=keyof typeof levels;

/** A connected planning diagram on the wall graph, not hydraulic sizing or
 * construction routing. Only this function's own generated items are replaced. */
export function connectWaterNetwork(plan:Plan):{utilities:Record<string,Utility>;unconnected:string[]} {
  const utilities={...plan.renovation?.utilities};
  for(const [id,u] of Object.entries(utilities))if(u.generatedBy==='water-network-v1')delete utilities[id];
  const terminals=Object.values(utilities).filter(u=>isWater(u.kind)&&u.points.length===1&&u.role!=='source');
  if(!terminals.length)return {utilities,unconnected:[]};
  const sink=Object.values(plan.furniture).find(f=>f.type==='sink');
  const near=nearestWallPoint(sink?.position??terminals[0].points[0],plan);
  if(!near)return {utilities,unconnected:terminals.map(t=>t.id)};
  const root=plan.walls[near.wallId].startNodeId;
  const neighbors=new Map<string,Array<{id:string;length:number}>>();
  for(const wall of Object.values(plan.walls)){
    const a=plan.nodes[wall.startNodeId],b=plan.nodes[wall.endNodeId];if(!a||!b)continue;
    const length=Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);
    for(const [from,to] of [[a.id,b.id],[b.id,a.id]]){const list=neighbors.get(from)??[];list.push({id:to,length});neighbors.set(from,list);}
  }
  const distance=new Map<string,number>([[root,0]]),parent=new Map<string,string>(),pending=new Set(neighbors.keys());
  while(pending.size){
    const id=[...pending].sort((a,b)=>(distance.get(a)??Infinity)-(distance.get(b)??Infinity))[0];
    const cost=distance.get(id);if(cost===undefined)break;pending.delete(id);
    for(const edge of neighbors.get(id)??[]){const next=cost+edge.length;if(next<(distance.get(edge.id)??Infinity)){distance.set(edge.id,next);parent.set(edge.id,id);}}
  }
  const rootPos=plan.nodes[root].position,edges=new Set<string>(),unconnected:string[]=[];
  function add(kind:WaterKind,label:string,points:UtilityPoint[],role:NonNullable<Utility['role']>){
    const id=nanoid();utilities[id]={id,kind,label,points,height:points[0].height??levels[kind],rotation:0,circuit:`${kind} · 水路连接示意`,role,generatedBy:'water-network-v1'};
  }
  const rail=(id:string,kind:WaterKind):UtilityPoint=>({x:plan.nodes[id].position.x+lanes[kind],y:plan.nodes[id].position.y+lanes[kind],height:levels[kind]});
  function pipe(kind:WaterKind,a:UtilityPoint,b:UtilityPoint,label:string){
    const list=[a,{x:b.x,y:a.y,height:a.height},{x:b.x,y:b.y,height:a.height},b];
    for(let i=1;i<list.length;i++){
      const from=list[i-1],to=list[i],keyA=`${from.x},${from.y},${from.height}`,keyB=`${to.x},${to.y},${to.height}`;
      if(keyA===keyB)continue;const key=kind+[keyA,keyB].sort().join('|');if(edges.has(key))continue;edges.add(key);
      add(kind,label,kind==='drain'?[to,from]:[from,to],'pipe');
    }
  }
  const names={'cold-water':'入户冷水总阀','hot-water':'热水器出水','drain':'排水立管'};
  for(const kind of ['cold-water','hot-water','drain'] as const){
    if(!terminals.some(t=>t.kind===kind)&&kind!=='cold-water')continue;
    const source={...rail(root,kind),height:kind==='cold-water'?110:kind==='hot-water'?150:5};
    add(kind,`${names[kind]}（示意）`,[source],'source');pipe(kind,source,rail(root,kind),`${names[kind]}连接`);
  }
  // The cold-water inlet and hot-water outlet belong to the same heater station.
  if(terminals.some(t=>t.kind==='hot-water')){
    const inlet={x:rootPos.x+lanes['hot-water']-8,y:rootPos.y+lanes['hot-water'],height:150};
    add('cold-water','热水器冷水入口（示意）',[inlet],'terminal');pipe('cold-water',rail(root,'cold-water'),inlet,'冷水总阀 → 热水器');
  }
  for(const terminal of terminals){
    const kind=terminal.kind as WaterKind,p={...terminal.points[0],height:terminal.points[0].height??terminal.height};
    const wallNear=nearestWallPoint(p,plan);if(!wallNear){unconnected.push(terminal.id);continue;}
    const wall=plan.walls[wallNear.wallId];
    const options=[wall.startNodeId,wall.endNodeId].filter(id=>distance.has(id)).sort((a,b)=>{
      const pa=plan.nodes[a].position,pb=plan.nodes[b].position;
      return distance.get(a)!+Math.hypot(p.x-pa.x,p.y-pa.y)-distance.get(b)!-Math.hypot(p.x-pb.x,p.y-pb.y);
    });
    const end=options[0];if(!end){unconnected.push(terminal.id);continue;}
    const chain=[end];while(parent.has(chain[chain.length-1]))chain.push(parent.get(chain[chain.length-1])!);chain.reverse();
    for(let i=1;i<chain.length;i++)pipe(kind,rail(chain[i-1],kind),rail(chain[i],kind),`${names[kind]} · 沿墙主干`);
    const foot={x:wallNear.foot.x+lanes[kind],y:wallNear.foot.y+lanes[kind],height:levels[kind]};
    pipe(kind,rail(end,kind),foot,`${terminal.label} · 分支`);
    pipe(kind,foot,{...p,height:levels[kind]},`${terminal.label} · 接管`);
    pipe(kind,{...p,height:levels[kind]},p,`${terminal.label} · 立管`);
  }
  return {utilities,unconnected};
}
