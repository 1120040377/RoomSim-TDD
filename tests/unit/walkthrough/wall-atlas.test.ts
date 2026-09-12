import {describe,it,expect,vi} from 'vitest';
import {BoxGeometry,DataUtils,HalfFloatType,Group,Mesh,MeshStandardMaterial,Vector3} from 'three';
import {InspectionCutaway} from '../../../src/modules/walkthrough/inspection-cutaway';
import {prepareWallAtlas} from '../../../src/modules/walkthrough/baking/wall-atlas';
describe('wall visibility atlas',()=>{
  it('preserves replaced cutaway state when the AO overlay is removed',()=>{
    const source=new MeshStandardMaterial(),wall=new Mesh(new BoxGeometry(),source);
    wall.userData.wallId='wall';
    const atlas=prepareWallAtlas(wall),binding=atlas.apply(new Float32Array(atlas.positions.length/3).fill(.7));
    const cutaway=new InspectionCutaway();
    wall.material.clippingPlanes=cutaway.planes;
    wall.material.clipIntersection=true;wall.material.clipShadows=true;
    binding.dispose();
    expect(wall.material).toBe(source);
    expect(source.clippingPlanes).toBe(cutaway.planes);
    expect(source.clipIntersection).toBe(true);expect(source.clipShadows).toBe(true);
    expect(source.aoMap).toBeNull();
  });
  it('keeps baked walls connected to the live camera cutaway planes',()=>{
    const cutaway=new InspectionCutaway(),source=new MeshStandardMaterial();
    source.clippingPlanes=cutaway.planes;source.clipIntersection=true;source.clipShadows=true;
    const wall=new Mesh(new BoxGeometry(),source);wall.userData.wallId='wall';
    cutaway.update(new Vector3(4,3,4),new Vector3());
    const atlas=prepareWallAtlas(wall),binding=atlas.apply(new Float32Array(atlas.positions.length/3).fill(.5));
    cutaway.update(new Vector3(-4,3,-4),new Vector3());
    expect(wall.material.clippingPlanes).toBe(cutaway.planes);
    expect(wall.material.clippingPlanes![1].normal.toArray()).toEqual(cutaway.planes[1].normal.toArray());
    expect(wall.material.clipIntersection).toBe(true);expect(wall.material.clipShadows).toBe(true);
    binding.dispose();expect(wall.material).toBe(source);expect(source.clippingPlanes).toBe(cutaway.planes);
  });
  it('samples six transformed faces and keeps shared non-wall material untouched',()=>{
    const root=new Group(),material=new MeshStandardMaterial(),mesh=new Mesh(new BoxGeometry(2,3,.2),material);
    mesh.userData.wallId='wall';mesh.position.x=4;root.add(mesh);
    const trim=new Mesh(new BoxGeometry(),material);root.add(trim);
    const atlas=prepareWallAtlas(root,.2);expect(atlas.chartCount).toBe(6);
    expect(Math.min(...Array.from(atlas.positions).filter((_,i)=>i%3===0))).toBeCloseTo(3);
    const originalUV=mesh.geometry.getAttribute('uv');
    const binding=atlas.apply(new Float32Array(atlas.positions.length/3).fill(.5));
    expect(mesh.material).not.toBe(material);expect(trim.material).toBe(material);expect(material.aoMap).toBeNull();
    expect(mesh.geometry.getAttribute('uv')).toBe(originalUV);
    const uv=mesh.geometry.getAttribute('uv1'),pixels=binding.texture.image.data;
    for(let i=0;i<uv.count;i++){
      const x=Math.floor(uv.getX(i)*atlas.atlasWidth),y=Math.floor(uv.getY(i)*atlas.atlasHeight);
      expect(pixels[(y*atlas.atlasWidth+x)*4]).toBe(128);
    }
    const dispose=vi.spyOn(binding.texture,'dispose');binding.dispose();binding.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);expect(mesh.material).toBe(material);expect(mesh.geometry.hasAttribute('uv1')).toBe(false);
  });
  it('rejects invalid sampling density and result buffers',()=>{
    expect(()=>prepareWallAtlas(new Group(),0)).toThrow();
    const atlas=prepareWallAtlas(new Group());expect(()=>atlas.apply(new Float32Array([1]))).toThrow();
  });
  it('stores RGB irradiance above one in linear half floats without replacing AO',()=>{
    const mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());mesh.userData.wallId='wall';
    const atlas=prepareWallAtlas(mesh),values=new Float32Array(atlas.positions.length);
    for(let i=0;i<values.length;i+=3)values.set([2,.5,.25],i);
    const binding=atlas.apply(values,'irradiance');expect(binding.texture.type).toBe(HalfFloatType);
    expect(mesh.material.lightMap).toBe(binding.texture);expect(mesh.material.aoMap).toBeNull();
    const uv=mesh.geometry.getAttribute('uv1'),x=Math.floor(uv.getX(0)*atlas.atlasWidth),y=Math.floor(uv.getY(0)*atlas.atlasHeight);
    expect(DataUtils.fromHalfFloat(binding.texture.image.data[(y*atlas.atlasWidth+x)*4])).toBe(2);
    binding.dispose();expect(mesh.material.lightMap).toBeNull();
  });
  it('owns and releases both textures for combined lighting',()=>{
    const mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());mesh.userData.wallId='wall';
    const atlas=prepareWallAtlas(mesh),binding=atlas.apply(new Float32Array(atlas.positions.length).fill(.5),'irradiance',new Float32Array(atlas.positions.length/3).fill(.2));
    expect(mesh.material.aoMap).toBe(binding.aoTexture);expect(mesh.material.lightMap).toBe(binding.texture);
    const dispose=vi.spyOn(binding.aoTexture!,'dispose');binding.dispose();binding.dispose();expect(dispose).toHaveBeenCalledTimes(1);
    expect(mesh.material.aoMap).toBeNull();expect(mesh.material.lightMap).toBeNull();
  });
});
