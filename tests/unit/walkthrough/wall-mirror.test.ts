import { expect, it } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { buildWallMirror } from '@/modules/walkthrough/builders/furniture/wall-mirror';

it('薄椭圆框和朝前镜面，显式环境反射且无额外渲染目标',()=>{
  const group=new Group();buildWallMirror(group,{id:'mirror',type:'wall-mirror',position:{x:0,y:0},rotation:0,size:{width:60,depth:3,height:80}});
  group.updateMatrixWorld(true);const bounds=new Box3().setFromObject(group);
  expect(bounds.min.y).toBeCloseTo(0);expect(bounds.max.y).toBeCloseTo(.8);
  expect(bounds.max.x-bounds.min.x).toBeCloseTo(.6);expect(bounds.max.z-bounds.min.z).toBeCloseTo(.03);
  expect(group.children).toHaveLength(2);
  const surface=group.getObjectByName('environment-mirror') as Mesh;
  expect(surface.userData.reflectionMode).toBe('environment-only');
  expect((surface.material as MeshStandardMaterial).metalness).toBe(1);
  const hit=new Raycaster(new Vector3(0,.4,-1),new Vector3(0,0,1)).intersectObject(surface)[0];
  expect(hit.face!.normal.z).toBeLessThan(-.99);
  const triangles=group.children.reduce((sum,o)=>sum+((o as Mesh).geometry.index?.count??(o as Mesh).geometry.getAttribute('position').count)/3,0);
  expect(triangles).toBeLessThan(1000);
});
