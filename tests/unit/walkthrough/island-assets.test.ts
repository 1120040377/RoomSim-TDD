import { expect, it } from 'vitest';
import { Box3, Group, Mesh, Raycaster, Vector3 } from 'three';
import { buildKitchenIsland, buildCounterStool } from '@/modules/walkthrough/builders/furniture/island';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

it('岛台两种材质，侧板落地，吧凳侧保留膝部凹位',()=>{
  const g=new Group();buildKitchenIsland(g,{id:'i',type:'kitchen-island',position:{x:0,y:0},rotation:0,size:{width:180,depth:85,height:90}});
  batchStaticParts(g);g.updateMatrixWorld(true);
  const box=new Box3().setFromObject(g);
  expect(box.min.y).toBeCloseTo(0);expect(box.max.y).toBeCloseTo(.9);
  expect(box.max.x-box.min.x).toBeCloseTo(1.8);expect(box.max.z-box.min.z).toBeCloseTo(.85);
  expect(g.children).toHaveLength(2);
  const ray=new Raycaster(new Vector3(0,.65,.6),new Vector3(0,0,-1));
  expect(ray.intersectObject(g,true)[0].point.z).toBeLessThan(.15);
  const triangles=g.children.reduce((n,o)=>n+((o as Mesh).geometry.index?.count??(o as Mesh).geometry.getAttribute('position').count)/3,0);
  expect(triangles).toBeLessThan(1500);
});

it('高脚凳单材质、平底撑脚、65cm座高及有限面数',()=>{
  const g=new Group();buildCounterStool(g,{id:'s',type:'counter-stool',position:{x:0,y:0},rotation:0,size:{width:42,depth:42,height:65}});
  batchStaticParts(g);const box=new Box3().setFromObject(g);
  expect(box.min.y).toBeCloseTo(0);expect(box.max.y).toBeCloseTo(.65);
  expect(box.max.x-box.min.x).toBeLessThanOrEqual(.42);expect(box.max.z-box.min.z).toBeLessThanOrEqual(.42);
  expect(g.children).toHaveLength(1);
  const geometry=(g.children[0] as Mesh).geometry;
  expect((geometry.index?.count??geometry.getAttribute('position').count)/3).toBeLessThan(1200);
  g.updateMatrixWorld(true);
  const hit=new Raycaster(new Vector3(.03,1,.03),new Vector3(0,-1,0)).intersectObject(g,true)[0];
  expect(hit.point.y).toBeGreaterThan(.63);expect(hit.face!.normal.y).toBeGreaterThan(.8);
});
