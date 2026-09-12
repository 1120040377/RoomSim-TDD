import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

describe('家具静态批处理', () => {
  it('减少同材质零件但保持外形边界、三角形数和活动门板身份', () => {
    const group = new Group(), material = new MeshStandardMaterial();
    for (const x of [-1, 1]) {
      const mesh = new Mesh(new BoxGeometry(), material);
      mesh.position.x = x; mesh.rotation.y = 0.3; group.add(mesh);
    }
    const pivot = new Group(), door = new Mesh(new BoxGeometry(), material);
    pivot.add(door); group.add(pivot);
    const before = new Box3().setFromObject(group);
    batchStaticParts(group);
    expect(group.children).toHaveLength(2);
    expect(pivot.children[0]).toBe(door);
    const merged = group.children.find(child => child instanceof Mesh) as Mesh;
    expect(merged.geometry.getAttribute('position').count).toBe(72);
    const after = new Box3().setFromObject(group);
    expect(after.min.distanceTo(before.min)).toBeLessThan(0.000001);
    expect(after.max.distanceTo(before.max)).toBeLessThan(0.000001);
  });
  it('不合并透明零件或具有不同阴影状态的零件', () => {
    const group = new Group(), material = new MeshStandardMaterial();
    const a = new Mesh(new BoxGeometry(), material), b = a.clone();
    b.castShadow = true;
    const glass = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ transparent: true }));
    group.add(a, b, glass, glass.clone());
    batchStaticParts(group);
    expect(group.children).toHaveLength(4);
  });
});
