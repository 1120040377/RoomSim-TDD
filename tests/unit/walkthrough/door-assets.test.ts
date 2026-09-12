import { expect,it } from 'vitest';
import { Box3,Mesh,MeshStandardMaterial,Vector3 } from 'three';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildOpenings } from '@/modules/walkthrough/builders/opening-builder';

it('木门保持铰链/碰撞板，双侧把手随门动而门套固定',()=>{
  const p=createEmptyPlan('door');p.nodes.a={id:'a',position:{x:0,y:0}};p.nodes.b={id:'b',position:{x:400,y:0}};
  p.walls.w={id:'w',startNodeId:'a',endNodeId:'b',thickness:12,height:280};
  p.openings.d={id:'d',kind:'door',wallId:'w',offset:200,width:90,height:210,sillHeight:0,hinge:'start',swing:'inside'};
  const result=buildOpenings(p),pivot=result.doorPivots.d,panel=pivot.children[0] as Mesh;
  const bounds=new Box3().setFromObject(panel);
  expect(bounds.max.x-bounds.min.x).toBeCloseTo(0.9);
  expect(bounds.max.z-bounds.min.z).toBeCloseTo(0.04);
  expect((panel.material as MeshStandardMaterial).map).not.toBeNull();
  expect(panel.castShadow).toBe(true);
  const hardware=pivot.children[1],casing=result.group.children[0].children[0];
  const start=hardware.localToWorld(new Vector3(0.8,0,0.07));
  const casingStart=casing.getWorldPosition(new Vector3());
  pivot.rotation.y-=Math.PI/2;result.group.updateMatrixWorld(true);
  expect(hardware.localToWorld(new Vector3(0.8,0,0.07)).distanceTo(start)).toBeGreaterThan(0.5);
  expect(casing.getWorldPosition(new Vector3()).distanceTo(casingStart)).toBe(0);
  expect(hardware.children).toHaveLength(1);expect(hardware.children[0].userData.interactable.targetId).toBe('d');
  let triangles=0;result.group.traverse(o=>{if(o instanceof Mesh)triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
  expect(triangles).toBeLessThan(1200);
});
