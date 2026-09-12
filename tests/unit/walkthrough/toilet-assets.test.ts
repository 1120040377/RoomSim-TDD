import { expect, it } from 'vitest';
import { Box3, Group, Mesh, Raycaster, Vector3 } from 'three';
import { buildToilet } from '@/modules/walkthrough/builders/furniture/bathroom';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

it('陶瓷马桶连续弧面与椭圆盖板，保留尺寸和低绘制预算',()=>{
  const group=new Group();buildToilet(group,{id:'t',type:'toilet',position:{x:0,y:0},rotation:0,size:{width:40,depth:70,height:75}},280);
  group.updateMatrixWorld(true);
  const box=new Box3().setFromObject(group);
  expect(box.min.y).toBeCloseTo(0);expect(box.max.y).toBeCloseTo(.75);
  expect(box.max.x-box.min.x).toBeCloseTo(.4);
  expect(box.max.z-box.min.z).toBeLessThanOrEqual(.7);
  const lid=group.getObjectByName('toilet-lid') as Mesh;
  const hit=new Raycaster(new Vector3(.03,.7,-.1),new Vector3(0,-1,0)).intersectObject(lid)[0];
  expect(hit.point.y).toBeCloseTo(.75*.604,2);expect(hit.face!.normal.y).toBeGreaterThan(.8);
  // The forward corner of a rectangular box must remain empty.
  expect(new Raycaster(new Vector3(.195,.7,-.33),new Vector3(0,-1,0)).intersectObject(lid)).toHaveLength(0);
  batchStaticParts(group);expect(group.children).toHaveLength(2);
  const triangles=group.children.reduce((n,o)=>n+((o as Mesh).geometry.index?.count??(o as Mesh).geometry.getAttribute('position').count)/3,0);
  expect(triangles).toBeLessThan(3000);
});
