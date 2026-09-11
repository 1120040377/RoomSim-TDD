import { describe,it,expect } from 'vitest';
import { BUILT_IN_TEMPLATES } from '@/modules/templates';
import { connectWaterNetwork } from '@/modules/renovation/water-network';
import { utilityMatches } from '@/modules/renovation/visibility';
import type { UtilityPoint } from '@/modules/model/types';

function onSegment(p:UtilityPoint,a:UtilityPoint,b:UtilityPoint){
  const length=(u:UtilityPoint,v:UtilityPoint)=>Math.hypot(u.x-v.x,u.y-v.y,(u.height??0)-(v.height??0));
  return Math.abs(length(a,p)+length(p,b)-length(a,b))<0.001;
}
describe('可检查的水路连接',()=>{
  it('所有预置水接口沿管线连通到对应源头，冷热水接口不再重合',()=>{
    for(const template of BUILT_IN_TEMPLATES.slice(1)){
      const plan=template.build(template.name),items=Object.values(plan.renovation!.utilities);
      for(const kind of ['cold-water','hot-water','drain'] as const){
        const source=items.find(u=>u.kind===kind&&u.role==='source')!;expect(source,`${template.name} ${kind}`).toBeDefined();
        const edges=items.filter(u=>u.kind===kind&&u.generatedBy&&u.points.length===2);
        const reached:UtilityPoint[]=[source.points[0]],pending=new Set(edges);let progress=true;
        while(progress){progress=false;for(const edge of pending)if(reached.some(p=>onSegment(p,edge.points[0],edge.points[1]))){reached.push(...edge.points);pending.delete(edge);progress=true;}}
        for(const terminal of items.filter(u=>u.kind===kind&&u.points.length===1&&u.role!=='source')){
          const point={...terminal.points[0],height:terminal.points[0].height??terminal.height};
          expect(edges.some(edge=>!pending.has(edge)&&onSegment(point,edge.points[0],edge.points[1])),`${template.name} ${terminal.label}`).toBe(true);
        }
      }
      const cold=items.find(u=>u.label.includes('厨房冷水接口'));
      const hot=items.find(u=>u.label.includes('厨房热水接口'));
      if(cold&&hot)expect(cold.points[0]).not.toEqual(hot.points[0]);
    }
  });
  it('重建只替换自动水路，保留手绘管线与电路且不会累加',()=>{
    const plan=BUILT_IN_TEMPLATES.find(t=>t.id==='one-bed-one-living')!.build('test');
    const manual={id:'manual',kind:'cold-water' as const,points:[{x:10,y:10},{x:20,y:10}],height:40,label:'手绘',rotation:0,circuit:''};
    plan.renovation!.utilities.manual=manual;
    const before=Object.values(plan.renovation!.utilities).filter(u=>u.kind==='electric');
    const one=connectWaterNetwork(plan);expect(one.unconnected).toEqual([]);expect(one.utilities.manual).toBe(manual);
    plan.renovation!.utilities=one.utilities;const two=connectWaterNetwork(plan);
    expect(Object.keys(two.utilities)).toHaveLength(Object.keys(one.utilities).length);
    expect(Object.values(two.utilities).filter(u=>u.kind==='electric')).toEqual(before);
    expect(utilityMatches('electric','water')).toBe(false);expect(utilityMatches('cold-water','water')).toBe(true);expect(utilityMatches('hot-water','cold-water')).toBe(false);
  });
});
