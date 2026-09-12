import { expect, it } from 'vitest';
import { Box3, DoubleSide, Group, Mesh, MeshPhysicalMaterial, Raycaster, Vector3 } from 'three';
import { buildShower } from '@/modules/walkthrough/builders/furniture/bathroom';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

it('淋浴有瓷砖背板和五金，两片玻璃不用厚盒或屏幕折射',()=>{
  const group=new Group();buildShower(group,{id:'s',type:'shower',position:{x:0,y:0},rotation:0,size:{width:90,depth:100,height:200}},280);
  batchStaticParts(group);group.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(group);
  expect(bounds.min.y).toBeCloseTo(0);expect(bounds.max.y).toBeCloseTo(2);
  expect(bounds.max.x-bounds.min.x).toBeCloseTo(.9);expect(bounds.max.z-bounds.min.z).toBeCloseTo(1);
  const meshes=group.children as Mesh[],glass=meshes.filter(m=>(m.material as MeshPhysicalMaterial).transparent);
  expect(meshes).toHaveLength(5);expect(glass).toHaveLength(2);
  for(const mesh of glass){
    const m=mesh.material as MeshPhysicalMaterial;
    expect(m.transmission).toBe(0);expect(m.forceSinglePass).toBe(true);expect(m.side).toBe(DoubleSide);
    expect(mesh.geometry.index!.count/3).toBe(2);expect(mesh.castShadow).toBe(false);
  }
  const opaque=meshes.filter(m=>!glass.includes(m));
  const entry=new Raycaster(new Vector3(-.6,1,0),new Vector3(1,0,0));
  expect(entry.intersectObjects(opaque)).toHaveLength(0);
  const back=new Raycaster(new Vector3(.2,1,0),new Vector3(0,0,-1));
  expect(back.intersectObjects(opaque)[0].point.z).toBeCloseTo(-.48);
  const triangles=meshes.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3,0);
  expect(triangles).toBeLessThan(2000);
});
