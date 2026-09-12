import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, Raycaster, Vector3 } from 'three';
import { buildStove, buildSink } from '@/modules/walkthrough/builders/furniture/kitchen';
import { animateStorage, buildStorage, toggleStorage, type Mechanism } from '@/modules/walkthrough/builders/furniture/storage';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

describe('精细厨房资产预算与交互', () => {
  it('灶台、水槽与地柜的底部实际后退，非前贴黑条',()=>{
    for(const type of ['stove','sink','kitchen-counter'] as const){
      const group=new Group(),f={id:type,type,position:{x:0,y:0},rotation:0,size:{width:80,depth:60,height:90}};
      if(type==='stove')buildStove(group,f,280);else if(type==='sink')buildSink(group,f,280);else buildStorage(group,f);
      group.updateMatrixWorld(true);
      const ray=new Raycaster(new Vector3(.1,.04,-2),new Vector3(0,0,1));
      const toe=ray.intersectObject(group,true);
      expect(toe.length).toBeGreaterThan(0);expect(toe[0].point.z).toBeGreaterThanOrEqual(-.241);
      // Avoid the intentional center gap between the sink's two doors.
      ray.set(new Vector3(.1,.2,-2),new Vector3(0,0,1));
      expect(ray.intersectObject(group,true)[0].point.z).toBeLessThan(-.27);
    }
  });
  it('灶台细节合并为至多五个网格，不引入透明渲染通道', () => {
    const group=new Group();
    buildStove(group,{id:'stove',type:'stove',position:{x:0,y:0},rotation:0,size:{width:70,depth:60,height:90}},280);
    batchStaticParts(group);
    let meshes=0,triangles=0;
    group.traverse(object=>{
      if(!(object instanceof Mesh))return;
      meshes++;
      triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;
      for(const material of Array.isArray(object.material)?object.material:[object.material])expect(material.transparent).toBe(false);
    });
    expect(meshes).toBeLessThanOrEqual(5);
    expect(triangles).toBeLessThan(16000);
    const bounds=new Box3().setFromObject(group);
    expect(bounds.max.y).toBeLessThan(0.95);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
  });
  it('石材台面不改变橱柜标注高度，抽屉面板仍可独立移动', () => {
    const group=new Group(),parent=new Group();parent.add(group);
    buildStorage(group,{id:'counter',type:'kitchen-counter',position:{x:0,y:0},rotation:0,size:{width:90,depth:60,height:90}});
    const plinth=group.getObjectByName('kitchen-recessed-plinth') as Mesh;
    expect(plinth.geometry.index!.count/3).toBe(12);
    const mechanisms=group.userData.mechanisms as Mechanism[];
    const panels=mechanisms.map(m=>m.object.children[0]);
    batchStaticParts(group);
    expect(new Box3().setFromObject(group).max.y).toBeCloseTo(0.9,4);
    expect(mechanisms).toHaveLength(2);
    toggleStorage(group);animateStorage(parent,0.1);
    for(const [i,m] of mechanisms.entries()) {
      expect(m.object.children[0]).toBe(panels[i]);
      expect(m.object.position.z).toBeCloseTo(m.open);
    }
  });
});
