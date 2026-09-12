import {describe,it,expect,vi} from 'vitest';
import {Color,DataTexture,RepeatWrapping,SRGBColorSpace,Vector2} from 'three';
import {ReflectorColorSampler} from '../../../src/modules/walkthrough/baking/color-sampler';
describe('reflector color samples',()=>{
  it('decodes sRGB before filtering and respects repeat and UV transforms',()=>{
    const texture=new DataTexture(new Uint8Array([128,128,128,255,255,255,255,255]),2,1);texture.colorSpace=SRGBColorSpace;texture.wrapS=RepeatWrapping;
    const sample=new ReflectorColorSampler().forTexture(texture),color=new Color();
    expect(sample(new Vector2(.25,.5),color).r).toBeCloseTo(.21586,4);
    expect(sample(new Vector2(1.25,.5),color).r).toBeCloseTo(.21586,4);
    expect(sample(new Vector2(.5,.5),color).r).toBeCloseTo((1+.21586)/2,4);
    texture.offset.x=.5;texture.updateMatrix();expect(sample(new Vector2(.25,.5),color).r).toBe(1);
  });
  it('reads shared source once while keeping wrapper transforms independent',()=>{
    const texture=new DataTexture(new Uint8Array([255,0,0,255,0,0,255,255]),2,1),copy=texture.clone();copy.offset.x=.5;
    const read=vi.fn(()=>texture.image),cache=new ReflectorColorSampler(read),color=new Color();
    expect(cache.forTexture(texture)(new Vector2(.25,.5),color).r).toBe(1);
    expect(cache.forTexture(copy)(new Vector2(.25,.5),color).b).toBe(1);expect(read).toHaveBeenCalledTimes(1);
  });
});
