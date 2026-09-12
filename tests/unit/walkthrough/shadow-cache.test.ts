import { describe, expect, it } from 'vitest';
import { BoxGeometry, DirectionalLight, Group, Mesh, MeshStandardMaterial, Plane, Scene, Vector3 } from 'three';
import { ShadowCache } from '@/modules/walkthrough/shadow-cache';
import { buildStylizedAvatar } from '@/modules/walkthrough/builders/stylized-avatar';

describe('静态阴影缓存', () => {
  it('第三人称静止复用，角色位移、步行动画和坐姿均使阴影失效', () => {
    const scene = new Scene(), sun = new DirectionalLight(), cache = new ShadowCache();
    const avatar = buildStylizedAvatar();
    scene.add(sun, sun.target, avatar.group);
    avatar.animate(0, false);
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    avatar.animate(0, false);
    expect(cache.needsUpdate(scene, sun)).toBe(false);
    avatar.group.position.x += 0.1;
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    expect(cache.needsUpdate(scene, sun)).toBe(false);
    avatar.animate(0.5, true);
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    avatar.animate(0.6, true);
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    avatar.pose('sit');
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    expect(cache.needsUpdate(scene, sun)).toBe(false);
    avatar.group.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
  });
  it('静止时复用，门板移动、剖切、隐藏、光源移动和删除时更新', () => {
    const scene = new Scene(), sun = new DirectionalLight(), cache = new ShadowCache();
    scene.add(sun, sun.target);
    const material = new MeshStandardMaterial({ clipShadows: true, clippingPlanes: [new Plane(new Vector3(0, -1, 0), 1.05)] });
    const mesh = new Mesh(new BoxGeometry(), material), pivot = new Group();
    mesh.castShadow = true; pivot.add(mesh); scene.add(pivot);
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    expect(cache.needsUpdate(scene, sun)).toBe(false);
    pivot.rotation.y = 0.5;
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    expect(cache.needsUpdate(scene, sun)).toBe(false);
    material.clippingPlanes![0].constant = 2;
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    pivot.visible = false;
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    pivot.visible = true;
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    sun.position.x += 1;
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    scene.remove(pivot);
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    expect(cache.needsUpdate(scene, sun)).toBe(false);
    cache.invalidate();
    expect(cache.needsUpdate(scene, sun)).toBe(true);
    mesh.geometry.dispose(); material.dispose();
  });
});
