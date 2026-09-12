import {expect,it} from 'vitest';
import {ShaderChunk} from 'three';
import {pointLightBranch,installPointLightBranch} from '@/modules/walkthrough/point-light-branch';

it('guards only point-light direct evaluation, preserving shadows and other light types',()=>{
  const source=ShaderChunk.lights_fragment_begin,patched=pointLightBranch(source);
  expect(patched).toContain('if ( directLight.visible )');
  expect(patched).toContain('defined( STANDARD )');
  const boundary='#if ( NUM_SPOT_LIGHTS > 0 )';
  expect(patched.slice(patched.indexOf(boundary))).toBe(source.slice(source.indexOf(boundary)));
  expect(patched.match(/getPointShadow\(/g)).toHaveLength(1);
  expect(()=>pointLightBranch('')).toThrow('Unsupported');
});
it('restores the original chunk idempotently',()=>{
  const original=ShaderChunk.lights_fragment_begin,release=installPointLightBranch();
  expect(ShaderChunk.lights_fragment_begin).not.toBe(original);
  release();release();expect(ShaderChunk.lights_fragment_begin).toBe(original);
});
