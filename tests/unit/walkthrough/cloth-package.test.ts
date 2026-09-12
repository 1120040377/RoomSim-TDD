import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
describe('offline cloth candidate package',()=>{
  it('keeps static geometry, height and size budgets in the exported GLB',()=>{
    const bytes=readFileSync(resolve('docs/asset-studies/draped-throw/draped-throw.glb'));
    expect(readFileSync(resolve('public/models/draped-throw/draped-throw.glb')).equals(bytes)).toBe(true);
    expect(bytes.readUInt32LE(0)).toBe(0x46546c67);expect(bytes.readUInt32LE(4)).toBe(2);
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    expect(json.meshes).toHaveLength(1);expect(json.meshes[0].primitives).toHaveLength(1);
    const primitive=json.meshes[0].primitives[0],positions=json.accessors[primitive.attributes.POSITION];
    expect(json.accessors[primitive.indices].count/3).toBeLessThan(6000);
    expect(bytes.length).toBeLessThan(150000);expect(positions.max[1]).toBeLessThan(.55);expect(positions.min[1]).toBeGreaterThan(.03);
    expect(json.animations??[]).toHaveLength(0);expect(json.skins??[]).toHaveLength(0);expect(json.images??[]).toHaveLength(0);
    expect(json.nodes).toHaveLength(1);expect(json.nodes[0].matrix).toBeUndefined();expect(json.nodes[0].translation).toBeUndefined();
  });
});
