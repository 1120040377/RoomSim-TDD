import { describe,expect,it } from 'vitest';
import { PlaneGeometry } from 'three';
import { bakeAmbientOcclusion } from '@/modules/walkthrough/baking/ambient-occlusion';

function roof(height:number){
  const geometry=new PlaneGeometry(10,10).toNonIndexed();geometry.rotateX(-Math.PI/2);geometry.translate(0,height,0);
  const result=new Float32Array(geometry.getAttribute('position').array);geometry.dispose();return result;
}
describe('static ambient visibility bake',()=>{
  const point={positions:new Float32Array([0,0,0]),normals:new Float32Array([0,1,0]),samples:64,radius:.6};
  it('leaves an open surface unoccluded and ignores geometry beyond the radius',()=>{
    expect(bakeAmbientOcclusion({...point,triangles:roof(-.1)}).values[0]).toBe(1);
    expect(bakeAmbientOcclusion({...point,triangles:roof(1)}).values[0]).toBe(1);
  });
  it('darkens near overhead geometry deterministically without changing source bytes',()=>{
    const triangles=roof(.02),before=triangles.slice();
    const first=bakeAmbientOcclusion({...point,triangles});
    expect(first.values[0]).toBeLessThan(.1);expect(first.values[0]).toBeGreaterThanOrEqual(0);
    expect(first.rays).toBe(64);
    expect(bakeAmbientOcclusion({...point,triangles}).values).toEqual(first.values);
    expect(triangles).toEqual(before);
  });
  it('rejects malformed buffers and unbounded sampling',()=>{
    expect(()=>bakeAmbientOcclusion({...point,triangles:new Float32Array(4)})).toThrow();
    expect(()=>bakeAmbientOcclusion({...point,triangles:roof(1),samples:10000})).toThrow();
  });
});
