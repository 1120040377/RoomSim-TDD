import { expect,it } from 'vitest';
import { Box3,Mesh,Raycaster,Vector3 } from 'three';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildFloor } from '@/modules/walkthrough/builders/floor-builder';

it('楼板在行走面下方合并为一组，保留凹角而非填充包围矩形',()=>{
  const plan=createEmptyPlan('slab');
  plan.rooms.r={id:'r',name:'L',area:3,wallIds:[],polygon:[{x:0,y:0},{x:200,y:0},{x:200,y:100},{x:100,y:100},{x:100,y:200},{x:0,y:200}]};
  const floor=buildFloor(plan),slab=floor.getObjectByName('floor-slab') as Mesh;
  expect(slab).toBeTruthy();expect(floor.children).toHaveLength(2);
  const bounds=new Box3().setFromObject(slab);
  expect(bounds.min.y).toBeCloseTo(-0.181);expect(bounds.max.y).toBeCloseTo(-0.001);
  expect(floor.children[0].position.y).toBe(0);
  const ray=new Raycaster(new Vector3(1.5,1,1.5),new Vector3(0,-1,0));
  expect(ray.intersectObject(slab)).toHaveLength(0);
  // Upper finish owns the top surface; a second near-coplanar cap is forbidden.
  ray.set(new Vector3(0.5,1,0.5),new Vector3(0,-1,0));expect(ray.intersectObject(slab)).toHaveLength(0);
  ray.set(new Vector3(-1,-0.09,0.5),new Vector3(1,0,0));expect(ray.intersectObject(slab).length).toBeGreaterThan(0);
  expect(slab.geometry.getAttribute('position').count/3).toBeLessThan(40);
});
