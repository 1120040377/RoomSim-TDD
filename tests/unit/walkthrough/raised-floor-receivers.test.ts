import {expect,it} from 'vitest';
import {Group,Mesh,MeshStandardMaterial,PlaneGeometry} from 'three';
import {raisedFloorReceivers} from '@/modules/walkthrough/baking/raised-floor-receivers';
it('samples rotated rug footprints at their actual height and ignores hidden/tilted planes',()=>{
  const root=new Group();root.position.set(3,0,2);root.rotation.y=Math.PI/2;
  const mesh=new Mesh(new PlaneGeometry(2,1),new MeshStandardMaterial());
  mesh.rotation.x=-Math.PI/2;mesh.position.y=.012;mesh.userData.floorContactReceiver=true;root.add(mesh);
  const receivers=raisedFloorReceivers([root,root]);expect(receivers).toHaveLength(1);
  const receiver=receivers[0];expect(receiver.height).toBeCloseTo(.012);
  expect(receiver.contains(3,2.8)).toBe(true);expect(receiver.contains(3.8,2)).toBe(false);
  mesh.visible=false;expect(raisedFloorReceivers([root])).toEqual([]);
  mesh.visible=true;mesh.rotation.x=0;expect(raisedFloorReceivers([root])).toEqual([]);
  mesh.geometry.dispose();mesh.material.dispose();
});
