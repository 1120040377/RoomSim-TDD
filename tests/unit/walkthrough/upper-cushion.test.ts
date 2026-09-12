import {readFileSync} from 'node:fs';
import {BufferGeometry,Float32BufferAttribute,BoxGeometry} from 'three';
import {describe,it,expect} from 'vitest';
import {extractUpperCushion} from '@/modules/walkthrough/builders/furniture/upper-cushion';

describe('reused source cushion',()=>{
  it('extracts the actual upper component without adding downloads or erasing UV seams',()=>{
    const root='public/models/modern-arm-chair-01/';
    const document=JSON.parse(readFileSync(root+'modern_arm_chair_01_1k.gltf','utf8'));
    const binary=readFileSync(root+'modern_arm_chair_01.bin');
    const geometry=new BufferGeometry();
    for(const [name,id,size] of [['position',4,3],['normal',5,3],['uv',6,2]] as const){
      const accessor=document.accessors[id],view=document.bufferViews[accessor.bufferView],values=[];
      for(let i=0;i<accessor.count*size;i++)values.push(binary.readFloatLE(view.byteOffset+i*4));
      geometry.setAttribute(name,new Float32BufferAttribute(values,size));
    }
    const accessor=document.accessors[7],view=document.bufferViews[accessor.bufferView],indices=[];
    for(let i=0;i<accessor.count;i++)indices.push(binary.readUInt16LE(view.byteOffset+i*2));
    geometry.setIndex(indices);
    const original=geometry.getAttribute('position').array.slice();
    const result=extractUpperCushion(geometry)!;
    expect(result.index!.count/3).toBe(1608);
    const seat=extractUpperCushion(geometry,'seat')!;
    expect(seat.index!.count/3).toBe(1700);
    expect(seat.boundingBox!.max.y).toBeLessThan(.57);
    expect(seat.boundingBox!.min.y).toBeGreaterThan(.30);
    expect(result.getAttribute('position').count).toBeLessThan(geometry.getAttribute('position').count);
    expect(result.getAttribute('normal').count).toBe(result.getAttribute('uv').count);
    expect(geometry.getAttribute('position').array).toEqual(original);
    const originalUV=new Set(Array.from({length:geometry.getAttribute('uv').count},(_,i)=>`${geometry.getAttribute('uv').getX(i)},${geometry.getAttribute('uv').getY(i)}`));
    const uv=result.getAttribute('uv');
    for(let i=0;i<uv.count;i++)expect(originalUV.has(`${uv.getX(i)},${uv.getY(i)}`)).toBe(true);
  });
  it('rejects a single connected mesh instead of mistaking the whole object for a pillow',()=>{
    expect(extractUpperCushion(new BoxGeometry())).toBeNull();
  });
});
