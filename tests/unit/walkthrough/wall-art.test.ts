import { describe,it,expect } from 'vitest';
import { Box3,Group,Mesh,Raycaster,Vector3 } from 'three';
import { buildWallArt } from '@/modules/walkthrough/builders/furniture/wall-art';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

describe('木框山景画',()=>{
  it('尺寸准确、画芯位于纸面前且凹入画框，四个不透明材质批次',()=>{
    const group=new Group();
    buildWallArt(group,{id:'art',type:'wall-art',position:{x:0,y:0},rotation:0,size:{width:90,depth:3,height:60}});
    batchStaticParts(group);group.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(group),size=bounds.getSize(new Vector3());
    expect(size.x).toBeCloseTo(0.9,4);expect(size.y).toBeCloseTo(0.6,4);expect(size.z).toBeCloseTo(0.03,4);
    const ray=new Raycaster(new Vector3(0,0.3,-1),new Vector3(0,0,1));
    const hit=ray.intersectObject(group,true)[0];
    expect(hit.point.z).toBeGreaterThan(-0.015);expect(hit.point.z).toBeLessThan(-0.0063);
    expect(group.children).toHaveLength(4);
    let triangles=0;
    for(const object of group.children){const mesh=object as Mesh;
      triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])expect(material.transparent).toBe(false);
    }
    expect(triangles).toBeLessThan(2200);
  });
});
