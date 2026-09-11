import { describe,it,expect } from 'vitest';
import { Group,Box3 } from 'three';
import { buildStorage,toggleStorage,animateStorage,type Mechanism } from '@/modules/walkthrough/builders/furniture/storage';
import { buildFurniture } from '@/modules/walkthrough/builders/furniture-builder';
import { runtimeColliders } from '@/modules/walkthrough/runtime-colliders';
import { route3D } from '@/modules/editor/scene-edit';
import { routeLength } from '@/modules/renovation/model';
import { createEmptyPlan } from '@/modules/model/defaults';
import { nearbyFurniture } from '@/modules/walkthrough/life';
import type { Furniture } from '@/modules/model/types';
const fridge:Furniture={id:'fridge',type:'fridge',position:{x:200,y:200},rotation:0,size:{width:75,depth:70,height:180}};
describe('生活交互与立体装修',()=>{
  it('冰箱门平滑旋转，开门新增碰撞体，关闭后复位',()=>{
    const root=new Group(),g=new Group();root.add(g);buildStorage(g,fridge);
    const m=(g.userData.mechanisms as Mechanism[])[0];expect(m.object.rotation.y).toBe(0);
    toggleStorage(g);animateStorage(root,0.05);expect(m.object.rotation.y).toBeGreaterThan(0);expect(m.object.rotation.y).toBeLessThan(m.open);
    for(let i=0;i<100;i++)animateStorage(root,0.016);
    expect(m.object.rotation.y).toBeCloseTo(m.open,2);expect(runtimeColliders(root,{}).length).toBeGreaterThan(0);
    toggleStorage(g);for(let i=0;i<100;i++)animateStorage(root,0.016);expect(m.object.rotation.y).toBeCloseTo(0,2);
  });
  it('抽屉沿深度拉出，壁挂家具的底面准确落在安装高度',()=>{
    const p=createEmptyPlan('p');p.furniture.c={...fridge,id:'c',type:'wall-cabinet',elevation:150,size:{width:80,depth:32,height:65}};
    const root=buildFurniture(p),box=new Box3().setFromObject(root);
    expect(box.min.y).toBeCloseTo(1.5,4);
    const drawer=new Group();buildStorage(drawer,{...fridge,type:'side-table'});root.add(drawer);toggleStorage(drawer);animateStorage(root,0.1);
    const m=(drawer.userData.mechanisms as Mechanism[])[0];expect(m.object.position.z).toBeLessThan(m.closed);
  });
  it('立体路径保持正交并统计竖向长度，附近交互不能穿过实墙',()=>{
    const points=route3D({x:0,y:0,height:20},{x:100,y:0,height:120});
    expect(points).toEqual([{x:0,y:0,height:20},{x:100,y:0,height:20},{x:100,y:0,height:120}]);
    expect(routeLength({id:'u',kind:'electric',points,height:20,label:'',rotation:0,circuit:''})).toBe(200);
    const p=createEmptyPlan('p');p.furniture.fridge=fridge;
    expect(nearbyFurniture(p,{x:200,y:100}).some(t=>t.id==='fridge')).toBe(true);
    p.nodes.a={id:'a',position:{x:0,y:150}};p.nodes.b={id:'b',position:{x:400,y:150}};p.walls.w={id:'w',startNodeId:'a',endNodeId:'b',thickness:12,height:280};
    expect(nearbyFurniture(p,{x:200,y:100}).some(t=>t.id==='fridge')).toBe(false);
  });
});
