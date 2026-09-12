import { describe,it,expect,vi } from 'vitest';
import { Box3,Group } from 'three';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildFurniture } from '@/modules/walkthrough/builders/furniture-builder';
import { toggleStorage,animateStorage } from '@/modules/walkthrough/builders/furniture/storage';
import { reconcileFurniture } from '@/modules/walkthrough/reconcile-furniture';

describe('家具增量同步',()=>{
  it('移动/旋转/离地不重建网格，保留未改物件及已打开的冰箱门，撤销复位',()=>{
    const plan=createEmptyPlan('test');
    plan.furniture.fridge={id:'fridge',type:'fridge',position:{x:200,y:100},rotation:0,size:{width:75,depth:70,height:180}};
    plan.furniture.table={id:'table',type:'coffee-table',position:{x:100,y:300},rotation:0,size:{width:105,depth:65,height:40}};
    const root=buildFurniture(plan),fridge=root.children[0] as Group,table=root.children[1],parts=[...fridge.children],dispose=vi.fn();
    toggleStorage(fridge);animateStorage(root,0.1);
    const door=fridge.userData.mechanisms[0],angle=door.object.rotation.y;
    const next={...plan,furniture:{...plan.furniture,fridge:{...plan.furniture.fridge,position:{x:400,y:250},rotation:Math.PI/2,elevation:15}}};
    reconcileFurniture(root,plan,next,dispose);
    expect(root.children[0]).toBe(fridge);expect(root.children[1]).toBe(table);
    expect(fridge.children).toEqual(parts);expect(dispose).not.toHaveBeenCalled();
    expect(door.object.rotation.y).toBe(angle);expect(fridge.userData.open).toBe(true);
    expect(fridge.position.x).toBe(4);expect(fridge.rotation.y).toBe(-Math.PI/2);
    expect(new Box3().setFromObject(fridge).min.y).toBeCloseTo(0.15,4);
    reconcileFurniture(root,next,plan,dispose);expect(fridge.position.x).toBe(2);expect(fridge.position.y).toBe(0);
    expect(dispose).not.toHaveBeenCalled();
  });
  it('尺寸变化只替换该件家具，新增/删除同步且只释放被替换对象',()=>{
    const plan=createEmptyPlan('test');
    plan.furniture.a={id:'a',type:'rug',position:{x:0,y:0},rotation:0,size:{width:200,depth:150,height:1}};
    plan.furniture.b={...plan.furniture.a,id:'b'};
    const root=buildFurniture(plan),[a,b]=root.children,dispose=vi.fn();
    const next={...plan,furniture:{...plan.furniture,a:{...plan.furniture.a,size:{width:250,depth:150,height:1}},c:{...plan.furniture.a,id:'c'}}};
    reconcileFurniture(root,plan,next,dispose);
    expect(root.children).toContain(b);expect(root.children).not.toContain(a);expect(root.children).toHaveLength(3);
    expect(dispose).toHaveBeenCalledOnce();expect(dispose).toHaveBeenCalledWith(a);
    const removed={...next,furniture:{a:next.furniture.a,c:next.furniture.c}};
    reconcileFurniture(root,next,removed,dispose);expect(root.children).not.toContain(b);expect(dispose).toHaveBeenLastCalledWith(b);
  });
});
