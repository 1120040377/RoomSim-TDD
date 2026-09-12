import { expect,it } from 'vitest';
import { Box3,Group,InstancedMesh,Mesh,Vector3 } from 'three';
import { buildBotanicalVase } from '@/modules/walkthrough/builders/furniture/botanical-vase';

it('桌面枝叶花瓶三组网格，基底与目录尺寸一致，无透明叶片',()=>{
  const g=new Group();buildBotanicalVase(g,{id:'v',type:'botanical-vase',position:{x:0,y:0},rotation:0,size:{width:26,depth:26,height:35}});
  const bounds=new Box3().setFromObject(g),size=bounds.getSize(new Vector3());
  expect(bounds.min.y).toBeCloseTo(0);expect(size.x).toBeCloseTo(0.26);expect(size.z).toBeCloseTo(0.26);expect(size.y).toBeCloseTo(0.35);
  let meshes=0,triangles=0;
  g.traverse(o=>{if(o instanceof Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o instanceof InstancedMesh?o.count:1);
    expect(Array.isArray(o.material)?o.material.some(m=>m.transparent):o.material.transparent).toBe(false);
  }});
  expect(meshes).toBe(3);expect(triangles).toBeLessThan(1800);
});
