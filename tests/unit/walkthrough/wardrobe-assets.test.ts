import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh } from 'three';
import { animateStorage, buildStorage, toggleStorage, type Mechanism } from '@/modules/walkthrough/builders/furniture/storage';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

describe('framed wardrobe assets', () => {
  it.each([2,3] as const)('%i doors preserve paired hinges, bounds and a bounded draw budget', count => {
    const group=new Group(),parent=new Group();parent.add(group);
    buildStorage(group,{id:'wardrobe',type:count===2?'wardrobe-2':'wardrobe-3',
      position:{x:0,y:0},rotation:0,size:{width:130,depth:50,height:210}});
    batchStaticParts(group);
    const mechanisms=group.userData.mechanisms as Mechanism[];
    expect(mechanisms).toHaveLength(count);
    expect(mechanisms[0].open).toBeGreaterThan(0);
    expect(mechanisms[count-1].open).toBeLessThan(0);
    for(const mechanism of mechanisms)expect(mechanism.object.children).toHaveLength(2);
    const closed=new Box3().setFromObject(group);
    expect(closed.min.x).toBeCloseTo(-.65);expect(closed.max.x).toBeCloseTo(.65);
    expect(closed.min.y).toBeCloseTo(0);expect(closed.max.y).toBeCloseTo(2.1);
    let meshes=0,triangles=0;
    group.traverse(object=>{
      if(!(object instanceof Mesh))return;
      meshes++;triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;
    });
    expect(meshes).toBe(count*2+2);expect(triangles).toBeLessThan(5000);
    toggleStorage(group);animateStorage(parent,.1);
    for(const mechanism of mechanisms){
      expect(mechanism.object.rotation.y).toBeCloseTo(mechanism.open);
      const open=new Box3().setFromObject(mechanism.object);
      expect(open.min.z).toBeLessThan(-.5);
    }
    toggleStorage(group);animateStorage(parent,.1);
    for(const mechanism of mechanisms)expect(mechanism.object.rotation.y).toBe(0);
    expect(new Box3().setFromObject(group).min.toArray()).toEqual(closed.min.toArray());
    const materials=new Set();
    group.traverse(object=>{
      if(!(object instanceof Mesh))return;
      object.geometry.dispose();
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(!materials.has(material)){material.dispose();materials.add(material);}
      }
    });
  });
});
