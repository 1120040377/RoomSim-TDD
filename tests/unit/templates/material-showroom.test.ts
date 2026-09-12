import { describe, expect, it } from 'vitest';
import { materialShowroom } from '@/modules/templates/apartments/material-showroom';
import { PlanSchema } from '@/modules/model/schema';
import type { FurnitureType } from '@/modules/model/types';

describe('参考材质样板间', () => {
  it('餐厅薄地毯容纳桌椅并留出玄关侧通道',()=>{
    const plan=materialShowroom.build('餐厅'),items=Object.values(plan.furniture);
    const table=items.find(f=>f.type==='dining-table-4')!;
    const rug=items.find(f=>f.type==='rug'&&f.position.x===table.position.x&&f.position.y===table.position.y)!;
    expect(rug).toBeDefined();expect(rug.size.height).toBe(.8);
    expect(rug.position.x-rug.size.width/2).toBeGreaterThanOrEqual(90);
    for(const chair of items.filter(f=>f.type==='dining-chair')){
      const c=Math.abs(Math.cos(chair.rotation)),s=Math.abs(Math.sin(chair.rotation));
      const halfX=(c*chair.size.width+s*chair.size.depth)/2,halfY=(s*chair.size.width+c*chair.size.depth)/2;
      expect(Math.abs(chair.position.x-rug.position.x)+halfX).toBeLessThan(rug.size.width/2);
      expect(Math.abs(chair.position.y-rug.position.y)+halfY).toBeLessThan(rug.size.depth/2);
    }
  });
  it('包含七个功能空间、整套精细资产与独立方案数据', () => {
    const plan = materialShowroom.build('样板');
    expect(PlanSchema.safeParse(plan).success).toBe(true);
    expect(Object.values(plan.rooms).map(r => r.name).sort()).toEqual([
      '开放厨房','卫浴','卧室','客厅','餐厅 / 玄关','过厅','阳台',
    ].sort());
    const types = new Set(Object.values(plan.furniture).map(f=>f.type));
    for(const room of Object.values(plan.rooms)){
      const finish=plan.renovation!.roomFloors?.[room.id]??plan.renovation!.finish;
      expect(finish.floor).toBe(room.name==='卧室'?'wood':'tile');
    }
    const table=Object.values(plan.furniture).find(f=>f.type==='dining-table-4')!;
    for(const chair of Object.values(plan.furniture).filter(f=>f.type==='dining-chair')){
      const dx=table.position.x-chair.position.x,dy=table.position.y-chair.position.y;
      expect(Math.sin(chair.rotation)*dx-Math.cos(chair.rotation)*dy).toBeGreaterThan(0);
    }
    for(const type of ['sofa-l','rug','floor-plant','bed-double','basin','shower','fridge','wall-cabinet','range-hood'] as FurnitureType[]) expect(types.has(type)).toBe(true);
    expect(materialShowroom.build('另一个').id).not.toBe(plan.id);
    expect(Object.values(plan.openings).filter(o=>o.kind==='door')).toHaveLength(10);
    const edgeKeys = Object.values(plan.walls).map(w=>[w.startNodeId,w.endNodeId].sort().join('|'));
    expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
  });
});
