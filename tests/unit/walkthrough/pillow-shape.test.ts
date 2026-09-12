import { expect, it } from 'vitest';
import { Group, MeshStandardMaterial } from 'three';
import { throwPillow } from '@/modules/walkthrough/builders/furniture/upholstery';

it('缝合薄边、鼓起填充、确定性褶皱，不增加面数', () => {
  const material = new MeshStandardMaterial();
  const build = (seed: number) => throwPillow(new Group(),0.68,0.48,0.22,material,0,0,0,seed);
  const a=build(17), b=build(17), c=build(18);
  const positions=a.geometry.getAttribute('position'), normals=a.geometry.getAttribute('normal');
  let edgeDepth=0, centerDepth=0;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    if(Math.abs(x)>0.335||Math.abs(y)>0.237)edgeDepth=Math.max(edgeDepth,Math.abs(z));
    if(Math.abs(x)<0.05&&Math.abs(y)<0.05)centerDepth=Math.max(centerDepth,Math.abs(z));
    expect(Number.isFinite(normals.getX(i)+normals.getY(i)+normals.getZ(i))).toBe(true);
    expect(Math.abs(x)).toBeLessThanOrEqual(0.341);expect(Math.abs(y)).toBeLessThanOrEqual(0.241);
  }
  expect(edgeDepth).toBeLessThan(0.008);expect(centerDepth).toBeGreaterThan(0.10);
  expect(a.geometry.index!.count/3).toBeLessThan(1200);
  expect(Array.from(positions.array)).toEqual(Array.from(b.geometry.getAttribute('position').array));
  expect(Array.from(positions.array)).not.toEqual(Array.from(c.geometry.getAttribute('position').array));
  for(const mesh of [a,b,c])mesh.geometry.dispose();material.dispose();
});
