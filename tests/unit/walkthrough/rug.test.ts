import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial, NoColorSpace, SRGBColorSpace, Vector3 } from 'three';
import { rugMaterial, rugWeaveSample } from '@/modules/walkthrough/builders/furniture/material-library';
import { buildRug, rugSurfaceGeometry } from '@/modules/walkthrough/builders/furniture/rug';
import { buildCollider } from '@/modules/walkthrough/collision-builder';
import { createEmptyPlan } from '@/modules/model/defaults';
import { WalkingPathRule } from '@/modules/ergonomics/rules/walking-path';

describe('独立编织地毯', () => {
  it('keeps yarn variation periodic and retains two independently owned small maps',()=>{
    let lowest=255,highest=0;
    for(let y=0;y<128;y+=3)for(let x=0;x<128;x+=3){
      const sample=rugWeaveSample(x,y);
      expect(rugWeaveSample(x+128,y-128)).toEqual(sample);
      lowest=Math.min(lowest,sample.shade);highest=Math.max(highest,sample.shade);
      expect(sample.height).toBeGreaterThan(0);expect(sample.height).toBeLessThan(255);
    }
    expect(highest-lowest).toBeGreaterThan(50);
    const first=rugMaterial('#bcaa88'),second=rugMaterial('#bcaa88');
    try{
      expect(first.map).not.toBe(second.map);expect(first.bumpMap).not.toBe(second.bumpMap);
      expect(first.map!.image.data).toEqual(second.map!.image.data);
      expect(first.map!.colorSpace).toBe(SRGBColorSpace);expect(first.bumpMap!.colorSpace).toBe(NoColorSpace);
      expect(first.normalMap).toBeNull();expect(first.roughnessMap).toBeNull();
      expect(first.map!.image.data.length).toBe(128*128*4);
      expect(first.bumpMap!.image.data.length).toBe(128*128*4);
    }finally{
      for(const material of [first,second]){material.map!.dispose();material.bumpMap!.dispose();material.dispose();}
    }
  });
  it('scales border widths on small rugs without inverting the center', () => {
    const geometry = rugSurfaceGeometry(0.16, 0.12);
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) expect(normals.getZ(i)).toBeCloseTo(1);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.getSize(new Vector3()).toArray()).toEqual([
      expect.closeTo(0.16, 5), expect.closeTo(0.12, 5), 0,
    ]);
    geometry.dispose();
  });
  it('两个材质网格、米制纹理，不产生行走碰撞', () => {
    const furniture = { id: 'rug', type: 'rug' as const, position: { x: 0, y: 0 }, rotation: 0,
      size: { width: 240, depth: 170, height: 1 } };
    const group = new Group(); buildRug(group, furniture);
    expect(group.children).toHaveLength(2);
    let triangles=0;group.traverse(o=>{if(o instanceof Mesh)triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
    expect(triangles).toBe(342);
    const size = new Box3().setFromObject(group).getSize(new Vector3());
    expect(size.x).toBeCloseTo(2.4); expect(size.z).toBeCloseTo(1.7);
    expect(size.y).toBeCloseTo(0.012, 4);
    const surface = group.children[1] as Mesh;
    expect(surface.position.y-furniture.size.height/100).toBeCloseTo(.002,6);
    expect(surface.receiveShadow).toBe(true);
    expect(surface.geometry.getAttribute('position').count / 3).toBe(42);
    expect((surface.material as MeshStandardMaterial).vertexColors).toBe(true);
    const normals = surface.geometry.getAttribute('normal');
    const colors = surface.geometry.getAttribute('color');
    for (let i = 0; i < normals.count; i++) {
      expect(normals.getZ(i)).toBeCloseTo(1);
      expect(colors.getX(i)).toBeGreaterThanOrEqual(0.57);
      expect(colors.getX(i)).toBeLessThanOrEqual(1);
    }
    const material=surface.material as MeshStandardMaterial;
    expect(material.map!.repeat.toArray()).toEqual([4, 4]);
    expect(material.bumpMap!.repeat.toArray()).toEqual([4, 4]);
    expect(material.bumpScale).toBe(.0008);
    expect(material.map!.image.width).toBe(128);expect(material.map!.image.height).toBe(128);
    const plan = createEmptyPlan('rug'); plan.furniture.rug = furniture;
    expect(buildCollider(plan)).toEqual([]);
    plan.furniture.table = { ...furniture, id: 'table', type: 'coffee-table', position: { x: 170, y: 0 },
      size: { width: 60, depth: 60, height: 40 } };
    expect(WalkingPathRule.check(plan)).toEqual([]);
  });
});
