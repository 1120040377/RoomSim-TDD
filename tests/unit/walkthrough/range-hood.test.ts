import { describe,expect,it } from 'vitest';
import { Box3,Group,Mesh,Vector3 } from 'three';
import { createPinia,setActivePinia } from 'pinia';
import { buildRangeHood } from '@/modules/walkthrough/builders/furniture/range-hood';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';
import { AddFurnitureCommand } from '@/modules/commands/furniture/add';
import { usePlanStore } from '@/modules/store/plan';
import { materialShowroom } from '@/modules/templates/apartments/material-showroom';

describe('抽油烟机资产',()=>{
  it('四个静态网格、不超过 3500 三角形，不增加点光源或透明通道',()=>{
    const group=new Group();
    buildRangeHood(group,{id:'hood',type:'range-hood',position:{x:0,y:0},rotation:0,size:{width:70,depth:48,height:80}});
    batchStaticParts(group);
    expect(group.children).toHaveLength(4);
    let triangles=0;
    for(const object of group.children){
      expect(object).toBeInstanceOf(Mesh);
      const mesh=object as Mesh;
      triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
      for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])expect(mat.transparent).toBe(false);
    }
    expect(triangles).toBeLessThan(3500);
    const size=new Box3().setFromObject(group).getSize(new Vector3());
    expect(size.x).toBeCloseTo(0.7,3);expect(size.z).toBeCloseTo(0.48,2);
    expect(size.y).toBeLessThan(0.805);
  });
  it('从家具目录添加时默认壁挂且离地，支持撤销',()=>{
    setActivePinia(createPinia());
    const store=usePlanStore();store.loadPlan(materialShowroom.build('test'));
    const command=new AddFurnitureCommand({type:'range-hood',position:{x:200,y:100}});
    command.do();
    expect(store.plan!.furniture[command.furnitureId].mount).toBe('wall');
    expect(store.plan!.furniture[command.furnitureId].elevation).toBe(155);
    command.undo();expect(store.plan!.furniture[command.furnitureId]).toBeUndefined();
  });
});
