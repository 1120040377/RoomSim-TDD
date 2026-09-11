import { describe, expect, it } from 'vitest';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildFloor } from '@/modules/walkthrough/builders/floor-builder';
import { buildUtilities } from '@/modules/walkthrough/builders/utility-builder';
import { defaultRenovation } from '@/modules/renovation/model';

describe('装修三维坐标', () => {
  it('非对称户型地板保持 editor.y → +z，法线朝上，无镜像', () => {
    const plan = createEmptyPlan('floor');
    plan.rooms.r = { id: 'r', name: '非对称房间', area: 6, wallIds: [], polygon: [
      { x: 100, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 400 }, { x: 100, y: 400 },
    ] };
    const group = buildFloor(plan);
    group.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(group);
    expect(bounds.min.x).toBeCloseTo(1);
    expect(bounds.max.x).toBeCloseTo(4);
    expect(bounds.min.z).toBeCloseTo(2);
    expect(bounds.max.z).toBeCloseTo(4);
    const mesh = group.children[0] as Mesh;
    const normal = new Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    expect(normal.y).toBeCloseTo(1);
    expect((mesh.material as MeshStandardMaterial).map).toBeTruthy();
  });
  it('插座位置与安装高度转换为米，管线位于相同 XZ 坐标', () => {
    const plan = createEmptyPlan('utility');
    plan.renovation = defaultRenovation();
    plan.renovation.utilities.s = { id: 's', kind: 'socket', label: '插座', points: [{ x: 100, y: 250 }], height: 110, rotation: Math.PI / 2, circuit: '' };
    plan.renovation.utilities.p = { ...plan.renovation.utilities.s, id: 'p', kind: 'cold-water', points: [{ x: 100, y: 250 }, { x: 200, y: 250 }] };
    const group = buildUtilities(plan);
    group.updateMatrixWorld(true);
    const plate = group.children[0].children[0];
    expect(plate.getWorldPosition(new Vector3()).toArray()).toEqual([1, 1.1, 2.5]);
    expect(plate.rotation.y).toBeCloseTo(-Math.PI / 2);
    const pipe = group.children[1].children[0];
    expect(pipe.getWorldPosition(new Vector3()).toArray()).toEqual([1.5, 1.1, 2.5]);
  });
});
