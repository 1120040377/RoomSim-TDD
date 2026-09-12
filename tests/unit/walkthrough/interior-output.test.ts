import { describe, expect, it, vi } from 'vitest';
import { Color, Texture, WebGLRenderTarget, SRGBColorSpace, NoToneMapping, type WebGLRenderer } from 'three';
import { InteriorOutputPass } from '@/modules/walkthrough/interior-output';

describe('后处理背景合成', () => {
  it('only swaps composer buffers when actually writing offscreen',()=>{
    const pass=new InteriorOutputPass(),read=new WebGLRenderTarget(2,2),write=new WebGLRenderTarget(2,2);
    const renderer={setRenderTarget:vi.fn(),render:vi.fn(),outputColorSpace:SRGBColorSpace,toneMapping:NoToneMapping,toneMappingExposure:1} as unknown as WebGLRenderer;
    for(const screen of [true,false,true]){
      pass.renderToScreen=screen;pass.render(renderer,write,read);
      expect(pass.needsSwap).toBe(!screen);
      expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(screen?null:write);
      expect(pass.material.uniforms.tDiffuse.value).toBe(read.texture);
    }
    expect(renderer.render).toHaveBeenCalledTimes(3);
    pass.dispose();read.dispose();write.dispose();
  });
  it('AO 在线性色调映射前融合，不改写透明覆盖率',()=>{
    const texture=new Texture(),pass=new InteriorOutputPass(texture);
    expect(pass.material.uniforms.tOcclusion.value).toBe(texture);
    expect(pass.material.uniforms.hasOcclusion.value).toBe(1);
    const source=pass.material.fragmentShader;
    expect(source.indexOf('texture2D(tOcclusion')).toBeLessThan(source.indexOf('ACESFilmicToneMapping'));
    expect(source).toContain('gl_FragColor.rgb *= texture2D(tOcclusion, vUv).r');
    pass.dispose();texture.dispose();
  });
  it('背景转换为显示颜色，不修改场景原色，并放在色调映射之后合成', () => {
    const pass = new InteriorOutputPass();
    const color = new Color('#e4e9e7'), original = color.clone();
    pass.setBackground(color);
    expect(color.equals(original)).toBe(true);
    const display = pass.material.uniforms.backgroundDisplay.value as Color;
    expect(display.r).toBeCloseTo(228 / 255, 4);
    expect(display.g).toBeCloseTo(233 / 255, 4);
    const source = pass.material.fragmentShader;
    expect(source.indexOf('mix(backgroundDisplay')).toBeGreaterThan(source.indexOf('sRGBTransferOETF'));
    pass.dispose();
  });
});
