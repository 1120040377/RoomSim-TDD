import { describe, expect, it } from 'vitest';
import { Box3, Group, InstancedMesh, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { buildSink } from '@/modules/walkthrough/builders/furniture/kitchen';
import { buildBasin, buildBathtub, buildShower, buildToilet } from '@/modules/walkthrough/builders/furniture/bathroom';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';
import { useObject } from '@/modules/walkthrough/life';
import { animateWater } from '@/modules/walkthrough/water-effect';
import { FrameCache } from '@/modules/walkthrough/frame-cache';

const fixtures = [
  { type: 'sink', build: buildSink, size: { width: 80, depth: 60, height: 85 }, nozzle: [0, .99, .04] },
  { type: 'basin', build: buildBasin, size: { width: 60, depth: 50, height: 85 }, nozzle: [0, .813875, .0575] },
  { type: 'shower', build: buildShower, size: { width: 90, depth: 90, height: 200 }, nozzle: [0, 1.692, -.115] },
  { type: 'bathtub', build: buildBathtub, size: { width: 170, depth: 80, height: 55 }, nozzle: [0, .6365, .176] },
] as const;

describe('fixture water', () => {
  it.each(fixtures)('starts at the $type nozzle and reaches its receiving surface after batching', ({ type, build, size, nozzle }) => {
    const f: Furniture = { id: type, type, size, position: { x: 350, y: -120 }, rotation: 1.1 };
    const group = new Group(); build(group, f, 280); batchStaticParts(group);
    const outlet = group.userData.waterOutlet;
    expect(outlet).toBeDefined();
    outlet.position.forEach((value: number, i: number) => expect(value).toBeCloseTo(nozzle[i], 5));
    expect(outlet.landingY).toBeGreaterThan(0);
    expect(outlet.landingY).toBeLessThan(nozzle[1] - .1);
    useObject(group, f);
    const effect = group.getObjectByName('life-effect')!;
    const jets = effect.getObjectByName('water-jets') as Mesh;
    jets.geometry.computeBoundingBox();
    expect(jets.geometry.boundingBox!.max.y).toBeCloseTo(nozzle[1] - .001, 3);
    expect(jets.geometry.boundingBox!.min.y).toBeCloseTo(outlet.landingY, 3);
    effect.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const material = object.material as MeshStandardMaterial;
      expect(material.emissive.getHex()).toBe(0);
      expect(material.transparent).toBe(true); expect(material.depthWrite).toBe(false);
      expect(object.castShadow).toBe(false);
    });
    group.position.set(3.5, .4, -1.2); group.rotation.y = -f.rotation;
    const expected = group.localToWorld(new Vector3().fromArray(nozzle));
    group.updateMatrixWorld(true);
    const waterBounds = new Box3().setFromObject(jets);
    expect(waterBounds.max.y).toBeCloseTo(expected.y - .001, 3);
    expect(waterBounds.min.y).toBeCloseTo(outlet.landingY + .4, 3);
  });

  it('animates running water, reuses the effect on reopen, and lets closed fixtures settle in the frame cache', () => {
    const f: Furniture = { id: 'sink', type: 'sink', size: fixtures[0].size, position: { x: 0, y: 0 }, rotation: 0 };
    const group = new Group(); buildSink(group, f, 280);
    const scene = new Scene(), furniture = new Group(); furniture.add(group); scene.add(furniture);
    const camera = new PerspectiveCamera(), cache = new FrameCache();
    useObject(group, f);
    const effect = group.getObjectByName('life-effect')!;
    const drops = effect.getObjectByName('water-droplets') as InstancedMesh;
    const initial = drops.instanceMatrix.array.slice();
    cache.needsRender(scene, camera, []); animateWater(furniture, .05);
    expect(drops.instanceMatrix.array).not.toEqual(initial);
    expect(cache.needsRender(scene, camera, [])).toBe(true);
    useObject(group, f); expect(effect.visible).toBe(false);
    const version = drops.instanceMatrix.version;
    cache.needsRender(scene, camera, []); animateWater(furniture, .05);
    expect(drops.instanceMatrix.version).toBe(version);
    expect(cache.needsRender(scene, camera, [])).toBe(false);
    useObject(group, f); expect(group.getObjectByName('life-effect')).toBe(effect);
    expect(effect.visible).toBe(true);
  });

  it('does not project a stream through the closed toilet lid', () => {
    const f: Furniture = { id: 'toilet', type: 'toilet', size: { width: 40, depth: 70, height: 75 }, position: { x: 0, y: 0 }, rotation: 0 };
    const group = new Group(); buildToilet(group, f, 280);
    expect(useObject(group, f)).toBe('已冲水');
    expect(group.getObjectByName('life-effect')).toBeUndefined();
  });
});
