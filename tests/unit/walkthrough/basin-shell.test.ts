import { describe, expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { basinShellGeometry } from '@/modules/walkthrough/builders/furniture/basin-shell';

describe('真实盆腔', () => {
  it('中心向下可进入内腔，盆底而非顶面接住射线', () => {
    const geometry = basinShellGeometry(0.6, 0.5, 0.2);
    const mesh = new Mesh(geometry, new MeshStandardMaterial());
    mesh.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0.01, 1, 0), new Vector3(0, -1, 0));
    const hits = ray.intersectObject(mesh);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeCloseTo(0.024, 3);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(0.2);
    expect(geometry.boundingBox!.max.x).toBeCloseTo(0.3);
    expect(geometry.boundingBox!.max.z).toBeCloseTo(0.25);
    expect(geometry.index!.count / 3).toBeLessThan(1500);
    geometry.dispose(); mesh.material.dispose();
  });
});
