import {expect,it} from 'vitest';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial,Vector3} from 'three';
import {materialShowroom} from '@/modules/templates/apartments/material-showroom';
import {markWallDecorations,updateWallDecorationCutaway} from '@/modules/walkthrough/wall-decoration-cutaway';
import {InspectionCutaway} from '@/modules/walkthrough/inspection-cutaway';

it('associates showroom wall art but not movable furniture or remote decorations',()=>{
  const plan=materialShowroom.build('test'),root=new Group();
  for(const f of Object.values(plan.furniture)){
    const group=new Group();group.userData.furnitureId=f.id;root.add(group);
  }
  markWallDecorations(root,plan);
  const art=root.children.find(g=>plan.furniture[g.userData.furnitureId].type==='wall-art')!;
  expect(art.userData.decorationWall).toBeTruthy();
  for(const group of root.children){
    if(!['wall-art','wall-mirror'].includes(plan.furniture[group.userData.furnitureId].type))expect(group.userData.decorationWall).toBeUndefined();
  }
  plan.furniture[art.userData.furnitureId].position={x:100000,y:100000};
  const remote=new Group(),item=new Group();item.userData.furnitureId=art.userData.furnitureId;remote.add(item);
  markWallDecorations(remote,plan);expect(item.userData.decorationWall).toBeUndefined();
});

it('shares live planes, follows interior policy and restores unclipped rendering',()=>{
  const root=new Group(),item=new Group(),material=new MeshStandardMaterial();
  item.userData.decorationWall={id:'wall',interior:true};item.add(new Mesh(new BoxGeometry(),material));root.add(item);
  const cut=new InspectionCutaway();
  updateWallDecorationCutaway(root,cut,true,true,false);
  expect(material.clippingPlanes).toHaveLength(1);expect(material.clipIntersection).toBe(false);
  updateWallDecorationCutaway(root,cut,true,true,true);
  expect(material.clippingPlanes).toBe(cut.planes);expect(material.clipIntersection).toBe(true);
  cut.update(new Vector3(4,3,0),new Vector3());
  expect(material.clippingPlanes![1].normal.x).toBe(-1);
  updateWallDecorationCutaway(root,cut,false,false,false);
  expect(material.clippingPlanes).toBeNull();expect(material.clipIntersection).toBe(false);
});
