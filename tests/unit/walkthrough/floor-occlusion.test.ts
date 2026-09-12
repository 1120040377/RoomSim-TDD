import { expect,it } from 'vitest';
import { Group,Mesh,MeshStandardMaterial,PlaneGeometry,Texture } from 'three';
import { attachFloorOcclusion,floorOcclusionTexture } from '@/modules/walkthrough/baking/floor-occlusion';

it('encodes visibility without color conversion and preserves albedo UVs on transformed floors',()=>{
  const texture=floorOcclusionTexture(new Float32Array([0,1,.5,.25]),2,2);
  expect(texture.colorSpace).toBe('');expect(texture.channel).toBe(1);
  expect(Array.from(texture.image.data).filter((_,i)=>i%4===0)).toEqual([0,255,128,64]);
  const material=new MeshStandardMaterial(),original=new Texture();material.aoMap=original;material.aoMapIntensity=.4;
  const floor=new Mesh(new PlaneGeometry(2,2),material);floor.rotation.x=-Math.PI/2;floor.position.set(3,0,4);floor.userData.roomId='room';
  const group=new Group();group.add(floor);const uv=floor.geometry.getAttribute('uv'),saved=uv.array.slice();
  const restore=attachFloorOcclusion(group,texture,{minX:2,minZ:3,width:2,depth:2});
  expect(material.aoMap).toBe(texture);expect(material.aoMapIntensity).toBe(.65);
  const atlas=floor.geometry.getAttribute('uv1');
  for(let i=0;i<atlas.count;i++){
    expect(atlas.getX(i)).toBeCloseTo(uv.getX(i));
    expect(atlas.getY(i)).toBeCloseTo(1-uv.getY(i));
  }
  expect(uv.array).toEqual(saved);restore();
  expect(material.aoMap).toBe(original);expect(material.aoMapIntensity).toBe(.4);
  expect(floor.geometry.getAttribute('uv1')).toBeUndefined();
  floor.geometry.dispose();material.dispose();original.dispose();texture.dispose();
});

it('rejects invalid texture sizes and non-finite visibility values',()=>{
  expect(()=>floorOcclusionTexture(new Float32Array(3),2,2)).toThrow();
  expect(()=>floorOcclusionTexture(new Float32Array([NaN]),1,1)).toThrow();
});
