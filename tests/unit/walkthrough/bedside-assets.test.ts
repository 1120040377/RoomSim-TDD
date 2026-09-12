import {expect,it} from 'vitest';
import {Box3,Group,Mesh} from 'three';
import {buildStorage,toggleStorage,animateStorage,type Mechanism} from '@/modules/walkthrough/builders/furniture/storage';
import {batchStaticParts} from '@/modules/walkthrough/builders/batch-static-parts';

it('raised bedside cabinet retains two moving drawers within a compact geometry budget',()=>{
  const group=new Group(),root=new Group();root.add(group);
  buildStorage(group,{id:'bedside',type:'side-table',position:{x:0,y:0},rotation:0,size:{width:45,depth:40,height:50}});
  const legs=group.children.filter(o=>o instanceof Mesh&&o.geometry.type==='CylinderGeometry');
  expect(legs).toHaveLength(4);
  const mechanisms=group.userData.mechanisms as Mechanism[];
  expect(mechanisms).toHaveLength(2);
  for(const m of mechanisms){
    expect(new Box3().setFromObject(m.object).min.y).toBeGreaterThan(.12);
    expect(m.object.children).toHaveLength(3);
  }
  batchStaticParts(group);
  let meshes=0,triangles=0;
  group.traverse(o=>{if(o instanceof Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
  expect(meshes).toBe(8);expect(triangles).toBeLessThan(3000);
  const closed=new Box3().setFromObject(group);
  expect(closed.max.y).toBeCloseTo(.5);
  toggleStorage(group);animateStorage(root,.1);
  for(const m of mechanisms)expect(m.object.position.z).toBeCloseTo(m.open);
  toggleStorage(group);animateStorage(root,.1);
  expect(new Box3().setFromObject(group).min.toArray()).toEqual(closed.min.toArray());
});
