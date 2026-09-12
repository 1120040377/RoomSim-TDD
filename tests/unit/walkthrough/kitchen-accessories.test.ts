import { describe,it,expect } from 'vitest';
import { Box3,Group,Mesh,Vector3 } from 'three';
import { buildKitchenAccessories } from '@/modules/walkthrough/builders/furniture/kitchen-accessories';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

describe('台面用品组',()=>{
  it('按目录尺寸落地，使用三份材质，合并后不超过 4000 三角形',()=>{
    const group=new Group();
    buildKitchenAccessories(group,{id:'accessories',type:'kitchen-accessories',position:{x:0,y:0},rotation:0,size:{width:55,depth:30,height:28}});
    batchStaticParts(group);
    const bounds=new Box3().setFromObject(group),size=bounds.getSize(new Vector3());
    expect(bounds.min.y).toBeCloseTo(0,5);
    expect(size.x).toBeCloseTo(0.55,4);expect(size.y).toBeCloseTo(0.28,4);expect(size.z).toBeCloseTo(0.3,4);
    expect(group.children).toHaveLength(3);
    let triangles=0;
    group.traverse(object=>{
      if(!(object instanceof Mesh))return;
      triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;
      for(const material of Array.isArray(object.material)?object.material:[object.material])expect(material.transparent).toBe(false);
    });
    expect(triangles).toBeLessThan(4000);
  });
});
