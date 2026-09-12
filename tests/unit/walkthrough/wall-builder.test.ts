import { describe, it, expect } from 'vitest';
import { Mesh, BoxGeometry, Raycaster, Vector3 } from 'three';
import { buildWalls } from '@/modules/walkthrough/builders/wall-builder';
import { createEmptyPlan } from '@/modules/model/defaults';
import type { Plan } from '@/modules/model/types';

function prepPlan(): Plan {
  const p = createEmptyPlan('p1');
  // 水平墙 (0,0) → (400, 0)，厚 12，高 280
  p.nodes['a'] = { id: 'a', position: { x: 0, y: 0 } };
  p.nodes['b'] = { id: 'b', position: { x: 400, y: 0 } };
  p.walls['w1'] = { id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 280 };
  return p;
}

describe('WallBuilder', () => {
  it('无开洞墙 → 单个 slab mesh，位置和尺寸正确', () => {
    const plan = prepPlan();
    const { group, meshesByWallId } = buildWalls(plan);

    expect(group.children.filter(child=>child.userData.wallId)).toHaveLength(1);
    expect(group.getObjectByName('cutaway-caps')?.children).toHaveLength(1);
    const meshes = meshesByWallId['w1'];
    expect(meshes).toHaveLength(1);

    const m = meshes[0];
    // 墙中点在 editor (200, 0)，高度中线 140，→ 3D (2, 1.4, 0)
    expect(m.position.x).toBeCloseTo(2, 5);
    expect(m.position.y).toBeCloseTo(1.4, 5);
    expect(m.position.z).toBeCloseTo(0, 5);
    // BoxGeometry 尺寸：length 400cm=4m, height 280cm=2.8m, thickness 12cm=0.12m
    const geom = m.geometry as BoxGeometry;
    expect(geom.parameters.width).toBeCloseTo(4, 5);
    expect(geom.parameters.height).toBeCloseTo(2.8, 5);
    expect(geom.parameters.depth).toBeCloseTo(0.12, 5);
    // 水平墙角度=0，rotation.y = 0
    expect(m.rotation.y).toBeCloseTo(0, 5);
  });

  it('门切割 → 3 段 slab（左墙/过梁/右墙），过梁位置在门顶', () => {
    const plan = prepPlan();
    plan.openings['d1'] = {
      id: 'd1',
      kind: 'door',
      wallId: 'w1',
      offset: 200,
      width: 90,
      height: 210,
      sillHeight: 0,
      hinge: 'start',
      swing: 'inside',
    };
    const { group,meshesByWallId } = buildWalls(plan);
    expect(meshesByWallId['w1']).toHaveLength(3);
    const caps=group.getObjectByName('cutaway-caps')!;
    expect(caps.children).toHaveLength(1);
    const cap=caps.children[0] as Mesh;
    expect(cap.visible).toBe(false);expect(cap.geometry.index!.count/3).toBe(4);
    cap.visible=true;group.updateMatrixWorld(true);
    const ray=new Raycaster(new Vector3(2,2,0),new Vector3(0,-1,0));
    expect(ray.intersectObject(caps,true)).toHaveLength(0);
    ray.set(new Vector3(1,2,0),new Vector3(0,-1,0));
    expect(ray.intersectObject(caps,true)[0].point.y).toBeCloseTo(1.05,4);
  });

  it('垂直墙 (0,0)→(0,400) → 3D 沿 +z，mesh.rotation.y = -π/2', () => {
    const plan = createEmptyPlan('p1');
    plan.nodes['a'] = { id: 'a', position: { x: 0, y: 0 } };
    plan.nodes['b'] = { id: 'b', position: { x: 0, y: 400 } };
    plan.walls['w1'] = { id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 280 };

    const { meshesByWallId } = buildWalls(plan);
    const m = meshesByWallId['w1'][0] as Mesh;
    expect(m.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
    // 中点 3D (0, 1.4, 2)
    expect(m.position.x).toBeCloseTo(0, 5);
    expect(m.position.z).toBeCloseTo(2, 5);
  });

  it('userData.wallId 挂到 group 和每个 mesh', () => {
    const plan = prepPlan();
    const { meshesByWallId } = buildWalls(plan);
    for (const m of meshesByWallId['w1']) {
      expect(m.userData.wallId).toBe('w1');
    }
  });
});
