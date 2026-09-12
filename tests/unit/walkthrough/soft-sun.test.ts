import {describe,it,expect} from 'vitest';
import {bakeSoftSun} from '../../../src/modules/walkthrough/baking/soft-sun';
import {floorOcclusionTexture} from '../../../src/modules/walkthrough/baking/floor-occlusion';
import {Mesh,MeshStandardMaterial,PlaneGeometry} from 'three';
import {attachSoftSun} from '../../../src/modules/walkthrough/baking/soft-sun-material';
const positions=new Float32Array([0,0,0]),normals=new Float32Array([0,1,0]);
describe('static area sun visibility',()=>{
  it('produces partial visibility at an occluder edge and full shadow/light away from it',()=>{
    const triangles=new Float32Array([0,1,-10,10,1,-10,10,1,10,0,1,-10,10,1,10,0,1,10]);
    const result=bakeSoftSun({triangles,positions:new Float32Array([0,0,0,1,0,0,-1,0,0]),normals:new Float32Array([0,1,0,0,1,0,0,1,0]),direction:[0,1,0],samples:128});
    expect(result.values[0]).toBeGreaterThan(.4);expect(result.values[0]).toBeLessThan(.6);
    expect(result.values[1]).toBe(0);expect(result.values[2]).toBe(1);
  });
  it('packs visibility in the existing alpha channel without modifying AO',()=>{
    const texture=floorOcclusionTexture(new Float32Array([.5]),1,1,new Float32Array([.25]));
    expect(Array.from(texture.image.data)).toEqual([128,128,128,64]);texture.dispose();
    expect(()=>bakeSoftSun({triangles:new Float32Array(),positions,normals,direction:[0,0,0]})).toThrow();
  });
  it('restores dynamic shadow reception and original material hooks on teardown',()=>{
    const mesh=new Mesh(new PlaneGeometry(),new MeshStandardMaterial());mesh.userData.roomId='room';mesh.receiveShadow=true;
    const map=floorOcclusionTexture(new Float32Array([1]),1,1);mesh.material.aoMap=map;
    const original=mesh.material.onBeforeCompile,key=mesh.material.customProgramCacheKey;
    const detach=attachSoftSun(mesh);expect(mesh.receiveShadow).toBe(false);expect(mesh.material.onBeforeCompile).not.toBe(original);
    detach();detach();expect(mesh.receiveShadow).toBe(true);expect(mesh.material.onBeforeCompile).toBe(original);expect(mesh.material.customProgramCacheKey).toBe(key);
    mesh.geometry.dispose();mesh.material.dispose();map.dispose();
  });
  it('compares adaptive edge estimates against the same complete disk sample set',()=>{
    const triangles=new Float32Array([0,1,-10,10,1,-10,10,1,10,0,1,-10,10,1,10,0,1,10]);
    const p=new Float32Array(301*3),n=new Float32Array(p.length);
    for(let i=0;i<301;i++){p[i*3]=-.15+i*.001;n[i*3+1]=1;}
    const input={triangles,positions:p,normals:n,direction:[0,1,0] as [number,number,number],samples:64};
    const full=bakeSoftSun(input),adaptive=bakeSoftSun({...input,adaptive:true});
    const maxError=adaptive.values.reduce((max,value,i)=>Math.max(max,Math.abs(value-full.values[i])),0);
    expect(maxError).toBeLessThanOrEqual(.08);expect(adaptive.rays).toBeLessThan(full.rays*.5);
  });
});
