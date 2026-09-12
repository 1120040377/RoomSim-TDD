import {expect,it} from 'vitest';
import {renderPixelRatio,BALANCED_PIXEL_BUDGET} from '@/modules/walkthrough/render-resolution';

it('keeps normal displays sharp and bounds high-DPI drawing buffers',()=>{
  expect(renderPixelRatio(1440,960,1,'balanced')).toBe(1);
  for(const [w,h,dpr] of [[1440,960,2],[3840,2160,1],[1920,1080,3]]){
    const ratio=renderPixelRatio(w,h,dpr,'balanced');
    expect(w*h*ratio*ratio).toBeLessThanOrEqual(BALANCED_PIXEL_BUDGET+.001);
    expect(ratio).toBeLessThanOrEqual(Math.min(dpr,2));
  }
});
it('lets the user restore the original capped device ratio',()=>{
  expect(renderPixelRatio(3840,2160,2,'native')).toBe(2);
  expect(renderPixelRatio(1440,960,3,'native')).toBe(2);
  expect(renderPixelRatio(800,600,.75,'native')).toBe(.75);
});
it('handles transient hidden layouts and invalid device ratios safely',()=>{
  expect(renderPixelRatio(0,0,2,'balanced')).toBe(2);
  expect(renderPixelRatio(800,600,NaN,'balanced')).toBe(1);
  expect(renderPixelRatio(800,600,0,'balanced')).toBe(1);
});
