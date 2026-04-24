import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { toWorld, toYawFromEditorAngle, wallAngle, wallLengthCm, CM_TO_M } from '@/modules/walkthrough/coord';

describe('coord 坐标换算（锁住 2D↔3D 约定）', () => {
  it('CM_TO_M = 0.01', () => {
    expect(CM_TO_M).toBe(0.01);
  });

  it('toWorld: editor (0, 0) + 0cm → 3D (0, 0, 0)', () => {
    expect(toWorld({ x: 0, y: 0 }, 0)).toEqual(new Vector3(0, 0, 0));
  });

  it('toWorld: editor (100, 200) + 140cm → 3D (1, 1.4, 2)', () => {
    const v = toWorld({ x: 100, y: 200 }, 140);
    expect(v.x).toBeCloseTo(1, 5);
    expect(v.y).toBeCloseTo(1.4, 5);
    expect(v.z).toBeCloseTo(2, 5);
  });

  it('wallAngle: 水平墙 (0,0)→(100,0) → 0', () => {
    expect(wallAngle({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(0);
  });

  it('wallAngle: 垂直墙 (0,0)→(0,100) → π/2', () => {
    expect(wallAngle({ x: 0, y: 0 }, { x: 0, y: 100 })).toBeCloseTo(Math.PI / 2, 5);
  });

  it('toYawFromEditorAngle 与 Three.js 右手系一致：沿 +y 墙在 3D 沿 +z', () => {
    // editor 墙 (0,0)→(0,100)：angle = π/2，yaw = -π/2
    const yaw = toYawFromEditorAngle(Math.PI / 2);
    expect(yaw).toBeCloseTo(-Math.PI / 2);
    // 验证：BoxGeometry 局部 +x (1,0,0) 经 rotation.y=yaw 后应指向世界 +z（即 (0,0,1)）
    const localX = new Vector3(1, 0, 0);
    const worldX = localX.applyAxisAngle(new Vector3(0, 1, 0), yaw);
    expect(worldX.x).toBeCloseTo(0, 5);
    expect(worldX.z).toBeCloseTo(1, 5);
  });

  it('沿 -x 墙 (100,0)→(0,0)：angle=π, yaw=-π，mesh +x 映射到世界 -x', () => {
    const yaw = toYawFromEditorAngle(Math.PI);
    const worldX = new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), yaw);
    expect(worldX.x).toBeCloseTo(-1, 5);
    expect(worldX.z).toBeCloseTo(0, 5);
  });

  it('wallLengthCm', () => {
    expect(wallLengthCm({ x: 0, y: 0 }, { x: 300, y: 400 })).toBeCloseTo(500);
  });
});
