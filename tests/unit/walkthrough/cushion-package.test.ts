import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const {extractCushionAsset}=createRequire(import.meta.url)('../../../scripts/build-cushion-asset.cjs');

describe('lossless cushion package',()=>{
  it('copies source position, normal, UV and index bytes exactly, without frame dependencies',()=>{
    const dir=resolve('public/models/modern-arm-chair-01');
    const source=JSON.parse(readFileSync(resolve(dir,'modern_arm_chair_01_1k.gltf'),'utf8'));
    const original=readFileSync(resolve(dir,'modern_arm_chair_01.bin'));
    const {document,buffer}=extractCushionAsset(source,original);
    expect(buffer.length).toBe(82792);
    expect(document.images).toHaveLength(1);
    expect(document.images[0].uri).toContain('pillow_nor_gl');
    expect(document.materials).toHaveLength(1);
    expect(document.materials[0].pbrMetallicRoughness).toEqual({});
    for(let i=0;i<4;i++){
      const src=source.bufferViews[i+4],dst=document.bufferViews[i];
      expect(buffer.subarray(dst.byteOffset,dst.byteOffset+dst.byteLength))
        .toEqual(original.subarray(src.byteOffset,src.byteOffset+src.byteLength));
      expect(dst.byteOffset%4).toBe(0);
    }
    expect(JSON.parse(readFileSync(resolve(dir,'cushions.gltf'),'utf8'))).toEqual(document);
    expect(readFileSync(resolve(dir,'cushions.bin'))).toEqual(buffer);
  });
});
