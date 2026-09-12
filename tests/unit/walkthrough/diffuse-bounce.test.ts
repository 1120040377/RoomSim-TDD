import {describe,it,expect} from 'vitest';
import {bakeDiffuseBounce,type DiffuseBounceInput} from '../../../src/modules/walkthrough/baking/diffuse-bounce';
function input():DiffuseBounceInput{return {
  triangles:new Float32Array([-100,0,-100,100,0,100,100,0,-100,-100,0,-100,-100,0,100,100,0,100]),
  reflectance:new Float32Array([.8,.4,.2,.8,.4,.2]),positions:new Float32Array([0,1,0]),normals:new Float32Array([0,-1,0]),
  sunDirection:[0,1,0],sunIrradiance:[2,2,2],samples:64,
};}
describe('single diffuse solar bounce',()=>{
  it('matches irradiance above a uniform sunlit Lambertian plane without extra PI gain',()=>{
    const data=input(),result=bakeDiffuseBounce(data);
    expect(result.irradiance[0]).toBeCloseTo(1.6,5);expect(result.irradiance[1]).toBeCloseTo(.8,5);expect(result.irradiance[2]).toBeCloseTo(.4,5);
    expect(result.rays).toBe(128);expect(data.triangles[0]).toBe(-100);
  });
  it('adds no direct sun or ambient light when bounce rays miss',()=>{
    const data=input();data.normals[1]=1;expect(Array.from(bakeDiffuseBounce(data).irradiance)).toEqual([0,0,0]);
  });
  it('checks visibility between the reflecting surface and sun',()=>{
    const data=input(),ground=data.triangles;
    const roof=ground.slice();for(let i=1;i<roof.length;i+=3)roof[i]=2;
    data.triangles=new Float32Array([...ground,...roof]);data.reflectance=new Float32Array([...data.reflectance,...data.reflectance]);
    expect(Array.from(bakeDiffuseBounce(data).irradiance)).toEqual([0,0,0]);
  });
  it('rejects out-of-range reflectance instead of creating energy',()=>{
    const data=input();data.reflectance[0]=1.1;expect(()=>bakeDiffuseBounce(data)).toThrow();
  });
  it('keeps original triangle reflectance IDs after BVH partitioning',()=>{
    const data=input(),triangles:number[]=[],colors:number[]=[];
    for(let i=0;i<30;i++){
      const x=200+i*3;triangles.push(x,0,0,x+1,0,1,x+1,0,0);colors.push(0,0,0);
    }
    data.triangles=new Float32Array([...triangles,...data.triangles]);
    data.reflectance=new Float32Array([...colors,...data.reflectance]);
    const result=bakeDiffuseBounce(data);
    expect(result.irradiance[0]).toBeCloseTo(1.6,5);expect(result.irradiance[2]).toBeCloseTo(.4,5);
  });
});
