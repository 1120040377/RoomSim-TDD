import { expect,it } from 'vitest';
import { Box3,Mesh,Raycaster,Vector3 } from 'three';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildWalls } from '@/modules/walkthrough/builders/wall-builder';

it('batches interior skirting without bridging the door or adding an exterior strip',()=>{
  const plan=createEmptyPlan('trim');
  plan.nodes.a={id:'a',position:{x:0,y:0}};plan.nodes.b={id:'b',position:{x:400,y:0}};
  plan.walls.w={id:'w',startNodeId:'a',endNodeId:'b',height:280,thickness:12};
  plan.openings.d={id:'d',kind:'door',wallId:'w',offset:200,width:90,height:210,sillHeight:0,hinge:'start',swing:'inside'};
  plan.rooms.r={id:'r',name:'room',area:12,wallIds:['w'],polygon:[{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}]};
  const result=buildWalls(plan),trim=result.group.getObjectByName('interior-baseboards') as Mesh;
  expect(trim).toBeDefined();const bounds=new Box3().setFromObject(trim);
  expect(bounds.min.z).toBeCloseTo(.06);expect(bounds.max.z).toBeCloseTo(.072);
  expect(bounds.max.y).toBeCloseTo(.08);expect(bounds.min.y).toBeCloseTo(0);
  expect(trim.geometry.index!.count/3).toBe(24);
  const ray=new Raycaster(new Vector3(2,.04,1),new Vector3(0,0,-1));
  expect(ray.intersectObject(trim)).toHaveLength(0);
  ray.ray.origin.x=1;expect(ray.intersectObject(trim).length).toBeGreaterThan(0);
});
