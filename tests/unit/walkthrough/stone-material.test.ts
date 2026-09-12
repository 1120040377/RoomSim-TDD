import {expect,it} from 'vitest';
import {stoneAlbedoValue,stoneMaterial} from '@/modules/walkthrough/builders/furniture/material-library';
it('keeps mineral clouds periodic and smooth across cell and texture boundaries',()=>{
  const values=[];
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const value=stoneAlbedoValue(x,y);values.push(value);
    expect(stoneAlbedoValue(x+128,y)).toBe(value);
    expect(stoneAlbedoValue(x,y+128)).toBe(value);
    expect(Math.abs(value-stoneAlbedoValue(x+1,y))).toBeLessThanOrEqual(3);
    expect(Math.abs(value-stoneAlbedoValue(x,y+1))).toBeLessThanOrEqual(3);
  }
  expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(5);
});
it('retains one small texture and no extra material maps',()=>{
  const material=stoneMaterial();
  expect(material.map!.image.width).toBe(128);expect(material.map!.image.height).toBe(128);
  expect(material.map!.repeat.toArray()).toEqual([1.2,1.2]);
  expect(material.roughness).toBe(.58);expect(material.metalness).toBe(0);
  expect(material.normalMap).toBeNull();expect(material.roughnessMap).toBeNull();
  material.map!.dispose();material.dispose();
});
