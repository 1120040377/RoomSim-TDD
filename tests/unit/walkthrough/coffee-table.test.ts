import { describe,it,expect } from 'vitest';
import { Box3,Group,Mesh,Raycaster,Vector3 } from 'three';
import { buildCoffeeTable } from '@/modules/walkthrough/builders/furniture/livingroom';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

describe('椭圆木茶几',()=>{
  it('保留标注桌面尺寸和高度，杯口真实中空，四个材质批次',()=>{
    const group=new Group();
    buildCoffeeTable(group,{id:'table',type:'coffee-table',position:{x:0,y:0},rotation:0,size:{width:105,depth:65,height:40}},280);
    batchStaticParts(group);group.updateMatrixWorld(true);
    const size=new Box3().setFromObject(group).getSize(new Vector3());
    expect(size.x).toBeCloseTo(1.05,4);expect(size.z).toBeCloseTo(0.65,4);
    const ray=new Raycaster(new Vector3(0,1,0),new Vector3(0,-1,0));
    expect(ray.intersectObject(group,true)[0].point.y).toBeCloseTo(0.4,4);
    ray.set(new Vector3(1.05*0.17+0.01,1,-0.03),new Vector3(0,-1,0));
    const cupFloor=ray.intersectObject(group,true)[0].point.y;
    expect(cupFloor).toBeGreaterThan(0.41);expect(cupFloor).toBeLessThan(0.44);
    expect(group.children).toHaveLength(4);
    let triangles=0;
    for(const child of group.children){
      expect(child).toBeInstanceOf(Mesh);const mesh=child as Mesh;
      triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
    }
    expect(triangles).toBeLessThan(4000);
  });
});
