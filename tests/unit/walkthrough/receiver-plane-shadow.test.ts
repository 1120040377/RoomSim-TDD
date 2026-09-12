import {expect,it} from 'vitest';
import {ShaderChunk} from 'three';
import {receiverPlaneShadowChunk,installReceiverPlaneShadow} from '@/modules/walkthrough/receiver-plane-shadow';

it('replaces exactly the 17 PCF samples and leaves other filtering paths intact',()=>{
  const original=ShaderChunk.shadowmap_pars_fragment,patched=receiverPlaneShadowChunk(original);
  expect(patched.match(/receiverPlaneCompare\(shadowMap,/g)).toHaveLength(17);
  const boundary='#elif defined( SHADOWMAP_TYPE_PCF_SOFT )';
  expect(patched.slice(patched.indexOf(boundary))).toBe(original.slice(original.indexOf(boundary)));
  expect(patched).toContain('abs(determinant) > 1e-12');
  expect(patched).toContain('floor(uv * mapSize) + 0.5');
  expect(patched.indexOf('dFdx(shadowCoord.xyz)')).toBeLessThan(patched.indexOf('if ( frustumTest )'));
});
it('rejects incompatible shader layouts instead of silently patching a subset',()=>{
  expect(()=>receiverPlaneShadowChunk('')).toThrow('Unsupported');
  expect(()=>receiverPlaneShadowChunk(ShaderChunk.shadowmap_pars_fragment.replace('texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z )','0.0'))).toThrow('17');
});
it('restores the original shader after the study',()=>{
  const original=ShaderChunk.shadowmap_pars_fragment,restore=installReceiverPlaneShadow();
  expect(ShaderChunk.shadowmap_pars_fragment).not.toBe(original);
  restore();restore();expect(ShaderChunk.shadowmap_pars_fragment).toBe(original);
});
it('shares an installation and restores only after the last owner exits',()=>{
  const original=ShaderChunk.shadowmap_pars_fragment,first=installReceiverPlaneShadow();
  const patched=ShaderChunk.shadowmap_pars_fragment,second=installReceiverPlaneShadow();
  expect(ShaderChunk.shadowmap_pars_fragment).toBe(patched);
  first();first();expect(ShaderChunk.shadowmap_pars_fragment).toBe(patched);
  second();expect(ShaderChunk.shadowmap_pars_fragment).toBe(original);
});
