import { describe, it, expect } from 'vitest';
import { circleVsOrientedBox, slide, type OrientedBox } from '@/modules/geometry/collision';

const box = (x: number, y: number, halfW: number, halfD: number, rotation = 0): OrientedBox => ({
  center: { x, y },
  halfW,
  halfD,
  rotation,
});

describe('circleVsOrientedBox', () => {
  it('圆完全在盒子右侧外 → overlap = 0', () => {
    const r = circleVsOrientedBox({ x: 100, y: 0 }, 10, box(0, 0, 20, 20));
    expect(r.overlap).toBe(0);
  });

  it('圆擦边（距离 = radius）→ overlap = 0', () => {
    const r = circleVsOrientedBox({ x: 30, y: 0 }, 10, box(0, 0, 20, 20));
    expect(r.overlap).toBe(0);
  });

  it('圆部分穿入盒子右侧 → overlap 正确，normal 指向 +X', () => {
    // 盒子 x 范围 [-20, 20]，圆心在 x=25，半径 10 → closest=(20,0)，距离 5，overlap = 5
    const r = circleVsOrientedBox({ x: 25, y: 0 }, 10, box(0, 0, 20, 20));
    expect(r.overlap).toBeCloseTo(5, 5);
    expect(r.normal.x).toBeCloseTo(1, 5);
    expect(r.normal.y).toBeCloseTo(0, 5);
  });

  it('圆部分穿入盒子上方 → normal 指向 +Y', () => {
    const r = circleVsOrientedBox({ x: 0, y: 25 }, 10, box(0, 0, 20, 20));
    expect(r.overlap).toBeCloseTo(5, 5);
    expect(r.normal.x).toBeCloseTo(0, 5);
    expect(r.normal.y).toBeCloseTo(1, 5);
  });

  it('圆心在盒子内部 → overlap > 0 且有合理法向', () => {
    const r = circleVsOrientedBox({ x: 5, y: 0 }, 10, box(0, 0, 20, 20));
    expect(r.overlap).toBeGreaterThan(0);
    // 圆心在盒子内，closest=圆心自身，dist=0，走特殊分支
    expect(Math.hypot(r.normal.x, r.normal.y)).toBeCloseTo(1, 5);
  });

  it('旋转 90° 的盒子：X 轴上原本的碰撞变为 Y 轴', () => {
    // 盒子 halfW=50, halfD=10, 旋转 90°（Pi/2）后变成竖条
    // 圆在 (0, 60)，盒子旋转 90° 后 y 方向占 [-50,50]，圆距盒顶 10cm，半径 20 → overlap = 10
    const r = circleVsOrientedBox(
      { x: 0, y: 60 },
      20,
      box(0, 0, 50, 10, Math.PI / 2),
    );
    expect(r.overlap).toBeCloseTo(10, 5);
    expect(r.normal.y).toBeCloseTo(1, 5);
  });
});

describe('slide', () => {
  it('无障碍物 → 按 delta 直接推进', () => {
    const next = slide({ x: 0, y: 0 }, { x: 10, y: 5 }, 10, []);
    expect(next).toEqual({ x: 10, y: 5 });
  });

  it('朝墙走 → 被推开贴墙（不穿透）', () => {
    // 墙：box 在 (100, 0)，halfW=10，halfD=100（南北向长墙），圆半径 20
    // 起点 (0, 0)，delta (100, 0) → 走后 (100, 0)，但被墙阻拦
    // 墙 x 范围 [90, 110]，圆要保持 x <= 90 - 20 = 70
    const wall = box(100, 0, 10, 100);
    const next = slide({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, [wall]);
    expect(next.x).toBeLessThanOrEqual(70 + 1e-5);
    expect(next.x).toBeGreaterThan(60); // 实际贴墙，允许一点浮点误差
    expect(next.y).toBeCloseTo(0, 5);
  });

  it('斜向冲墙 → 沿墙滑动（法向分量被抵消，切向保留）', () => {
    // 墙在 +X 方向：(100, 0) 高 200 宽 20，法向是 +X
    // 起点 (0, 0)，delta (30, 20) → 法向分量被抵消，切向 20 保留
    const wall = box(100, 0, 10, 100);
    const next = slide({ x: 60, y: 0 }, { x: 30, y: 20 }, 20, [wall]);
    // X 方向被墙限制在 70 左右
    expect(next.x).toBeLessThanOrEqual(70 + 1e-5);
    // Y 方向继续滑动
    expect(next.y).toBeCloseTo(20, 5);
  });

  it('已经穿入的圆 → 被推出', () => {
    const wall = box(0, 0, 50, 50);
    // 圆心在盒子边缘内部 (40, 0)，半径 20 → 应该被推到 x=70
    const next = slide({ x: 30, y: 0 }, { x: 10, y: 0 }, 20, [wall]);
    expect(next.x).toBeGreaterThanOrEqual(70 - 1e-5);
  });
});
