import { afterEach, describe, expect, it, vi } from 'vitest';
import { Color, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader, type WebGLRenderer } from 'three';
import { oakVeneerMaterial } from '@/modules/walkthrough/builders/asset-material';

afterEach(() => { vi.restoreAllMocks(); });

describe('家具木饰面 PBR', () => {
  it('桌面使用横向木纹和独立粗糙度，保留相同采样程序',()=>{
    vi.spyOn(TextureLoader.prototype,'load').mockImplementation(()=>new Texture());
    const table=oakVeneerMaterial('#b58962',15,'tabletop'),cabinet=oakVeneerMaterial('#b58962',15);
    expect(table.roughness).toBe(.72);expect(cabinet.roughness).toBe(.85);
    for(const map of [table.map!,table.normalMap!,table.roughnessMap!]){
      expect(map.rotation).toBe(0);expect(map.repeat.toArray()).toEqual([1.25,1.25]);
      expect(map.offset.toArray()).toEqual(table.map!.offset.toArray());
    }
    const shader={uniforms:{},fragmentShader:'#include <map_fragment>'} as Parameters<typeof table.onBeforeCompile>[0];
    table.onBeforeCompile(shader,{} as WebGLRenderer);
    expect(shader.uniforms.veneerGrain.value).toBe(.55);
    expect(shader.fragmentShader.match(/texture2D\( map,/g)).toHaveLength(1);
    expect(table.customProgramCacheKey()).toBe(cabinet.customProgramCacheKey());
    for(const material of [table,cabinet]){
      material.map!.dispose();material.normalMap!.dispose();material.roughnessMap!.dispose();material.dispose();
    }
  });
  it('使用本地三通道贴图，颜色与数据贴图区分色彩空间', () => {
    const load = vi.spyOn(TextureLoader.prototype, 'load').mockImplementation(() => new Texture());
    const material = oakVeneerMaterial('#9a7a55', 25);
    expect(load.mock.calls.map(call => call[0])).toEqual([
      '/materials/wood-049/Wood049_1K-JPG_Color.jpg',
      '/materials/wood-049/Wood049_1K-JPG_NormalGL.jpg',
      '/materials/wood-049/Wood049_1K-JPG_Roughness.jpg',
    ]);
    expect(material.map!.colorSpace).toBe(SRGBColorSpace);
    expect(material.normalMap!.colorSpace).toBe(NoColorSpace);
    expect(material.roughnessMap!.colorSpace).toBe(NoColorSpace);
    expect(material.normalScale.toArray()).toEqual([0.055, 0.055]);
    expect(material.metalness).toBe(0);
  });

  it('在线性色彩空间中压低纹理反差，复用原贴图采样',()=>{
    vi.spyOn(TextureLoader.prototype,'load').mockImplementation(()=>new Texture());
    const material=oakVeneerMaterial('#9a7a55',25);
    const shader={uniforms:{},fragmentShader:'#include <map_fragment>'} as Parameters<typeof material.onBeforeCompile>[0];
    material.onBeforeCompile(shader,{} as WebGLRenderer);
    expect(shader.uniforms.veneerBase.value).toEqual(new Color('#b69b79'));
    expect(shader.uniforms.veneerGrain.value).toBe(0.36);
    expect(shader.fragmentShader).toContain('mix(veneerBase, sampledDiffuseColor.rgb, veneerGrain)');
    expect(shader.fragmentShader.match(/texture2D\( map,/g)).toHaveLength(1);
    expect(material.customProgramCacheKey()).toBe('roomsim-pale-oak-v1');
  });

  it('三通道共享 80cm 尺度与竖向纹理变换，不同资产错开取样', () => {
    vi.spyOn(TextureLoader.prototype, 'load').mockImplementation(() => new Texture());
    const material = oakVeneerMaterial('#9a7a55', 25);
    for (const map of [material.map!, material.normalMap!, material.roughnessMap!]) {
      expect(map.repeat.toArray()).toEqual([1.25, 1.25]);
      expect(map.wrapS).toBe(RepeatWrapping);
      expect(map.wrapT).toBe(RepeatWrapping);
      expect(map.rotation).toBe(Math.PI / 2);
      expect(map.offset.toArray()).toEqual(material.map!.offset.toArray());
    }
    expect(oakVeneerMaterial('#9a7a55', 26).map!.offset.toArray())
      .not.toEqual(material.map!.offset.toArray());
  });
});
