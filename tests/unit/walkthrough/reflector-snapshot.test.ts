import {describe,it,expect} from 'vitest';
import {BufferGeometry,Float32BufferAttribute,InstancedMesh,MeshStandardMaterial,Color} from 'three';
import {snapshotReflectors} from '../../../src/modules/walkthrough/baking/reflector-snapshot';
describe('reflector snapshot',()=>{
  it('aligns linear material, vertex and instance colors with expanded triangles',async()=>{
    const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3))
      .setAttribute('color',new Float32BufferAttribute([.5,1,1,.5,1,1,.5,1,1],3));
    const material=new MeshStandardMaterial({vertexColors:true,metalness:.5});material.color.setRGB(.8,.6,.4);
    const mesh=new InstancedMesh(geometry,material,2);mesh.setColorAt(0,new Color().setRGB(1,1,1));mesh.setColorAt(1,new Color().setRGB(.5,.5,.5));
    const result=await snapshotReflectors(mesh);expect(result!.triangles.length).toBe(18);
    Array.from(result!.reflectance).forEach((value,i)=>expect(value).toBeCloseTo([.2,.3,.2,.1,.15,.1][i]));
  });
});
