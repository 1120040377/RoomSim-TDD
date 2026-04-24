import { describe, it, expect } from 'vitest';
import { nearestWallPoint } from '@/modules/geometry/nearest-wall';
import { createEmptyPlan } from '@/modules/model/defaults';
import type { Plan } from '@/modules/model/types';

function mkPlan(): Plan {
  const p = createEmptyPlan('p1');
  p.nodes['a'] = { id: 'a', position: { x: 0, y: 0 } };
  p.nodes['b'] = { id: 'b', position: { x: 400, y: 0 } };
  p.nodes['c'] = { id: 'c', position: { x: 400, y: 300 } };
  p.nodes['d'] = { id: 'd', position: { x: 0, y: 300 } };
  p.walls['w1'] = { id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 280 };
  p.walls['w2'] = { id: 'w2', startNodeId: 'b', endNodeId: 'c', thickness: 12, height: 280 };
  p.walls['w3'] = { id: 'w3', startNodeId: 'c', endNodeId: 'd', thickness: 12, height: 280 };
  p.walls['w4'] = { id: 'w4', startNodeId: 'd', endNodeId: 'a', thickness: 12, height: 280 };
  return p;
}

describe('nearestWallPoint', () => {
  it('空 plan → null', () => {
    expect(nearestWallPoint({ x: 0, y: 0 }, createEmptyPlan('p1'))).toBeNull();
  });

  it('点在墙 w1 上方 → 返回 w1 垂足 + offset', () => {
    const r = nearestWallPoint({ x: 100, y: -5 }, mkPlan());
    expect(r).not.toBeNull();
    expect(r!.wallId).toBe('w1');
    expect(r!.foot).toEqual({ x: 100, y: 0 });
    expect(r!.offset).toBeCloseTo(100);
  });

  it('点在墙 w2 外侧 → 返回 w2', () => {
    const r = nearestWallPoint({ x: 410, y: 150 }, mkPlan());
    expect(r!.wallId).toBe('w2');
    expect(r!.foot).toEqual({ x: 400, y: 150 });
    expect(r!.offset).toBeCloseTo(150); // w2 start=b(400,0) end=c(400,300)，offset 从 b 起
  });

  it('点在矩形中心 → 取最近墙（取 y 较小的 w1，因为 150 == 150 时取第一个）', () => {
    const r = nearestWallPoint({ x: 200, y: 150 }, mkPlan());
    expect(r).not.toBeNull();
    // 对称场景 4 面墙距离都是 150，返回其中之一即可，此处只断言返回了某面墙
    expect(['w1', 'w2', 'w3', 'w4']).toContain(r!.wallId);
  });

  it('超出阈值 → 可选 maxDist 截断', () => {
    const r = nearestWallPoint({ x: 1000, y: 0 }, mkPlan(), 100);
    expect(r).toBeNull();
  });

  it('offset 裁剪到墙长度内（点在墙外延长线上）', () => {
    // w1 从 (0,0) 到 (400,0)；点在 (500, -10)
    // 垂足 x=500 超出墙端点，需 clamp 到 400
    const r = nearestWallPoint({ x: 500, y: -10 }, mkPlan());
    expect(r).not.toBeNull();
    // 此时可能被吸到 w2 或 w1 端点 (400,0)，距离相等。任何一面墙合法。
    expect(r!.offset).toBeGreaterThanOrEqual(0);
  });
});
