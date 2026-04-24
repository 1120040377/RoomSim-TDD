import { describe, it, expect } from 'vitest';
import { findSnap } from '@/modules/geometry/snap';
import { createEmptyPlan } from '@/modules/model/defaults';
import type { Plan } from '@/modules/model/types';

function baseplan(): Plan {
  return createEmptyPlan('p1');
}

describe('findSnap', () => {
  it('空 plan + 远离网格点 → null（不吸附）', () => {
    const plan = baseplan();
    // gridSize=20，远离网格的点 (7, 9)，距最近网格 (0,0) 的距离 ≈ 11.4，半径=8 → 不吸附
    const r = findSnap({ x: 7, y: 9 }, plan, 1);
    expect(r).toBeNull();
  });

  it('靠近网格点 → grid snap', () => {
    const plan = baseplan();
    const r = findSnap({ x: 22, y: 18 }, plan, 1); // 最近网格 (20, 20)，距离 ≈ 2.8
    expect(r).not.toBeNull();
    expect(r!.type).toBe('grid');
    expect(r!.point).toEqual({ x: 20, y: 20 });
  });

  it('靠近墙端点 → endpoint snap（覆盖网格）', () => {
    const plan = baseplan();
    plan.nodes['n1'] = { id: 'n1', position: { x: 100, y: 100 } };
    plan.nodes['n2'] = { id: 'n2', position: { x: 300, y: 100 } };
    plan.walls['w1'] = { id: 'w1', startNodeId: 'n1', endNodeId: 'n2', thickness: 12, height: 280 };

    const r = findSnap({ x: 102, y: 103 }, plan, 1);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('endpoint');
    expect(r!.sourceId).toBe('n1');
    expect(r!.point).toEqual({ x: 100, y: 100 });
  });

  it('靠近墙中点 → midpoint snap', () => {
    const plan = baseplan();
    plan.nodes['n1'] = { id: 'n1', position: { x: 0, y: 0 } };
    plan.nodes['n2'] = { id: 'n2', position: { x: 200, y: 0 } };
    plan.walls['w1'] = { id: 'w1', startNodeId: 'n1', endNodeId: 'n2', thickness: 12, height: 280 };

    const r = findSnap({ x: 101, y: 2 }, plan, 1); // 靠近 (100, 0)
    expect(r).not.toBeNull();
    expect(r!.type).toBe('midpoint');
    expect(r!.sourceId).toBe('w1');
    expect(r!.point).toEqual({ x: 100, y: 0 });
  });

  it('靠近墙线（非端点非中点）→ wall 垂足 snap', () => {
    const plan = baseplan();
    plan.nodes['n1'] = { id: 'n1', position: { x: 0, y: 0 } };
    plan.nodes['n2'] = { id: 'n2', position: { x: 200, y: 0 } };
    plan.walls['w1'] = { id: 'w1', startNodeId: 'n1', endNodeId: 'n2', thickness: 12, height: 280 };

    const r = findSnap({ x: 50, y: 3 }, plan, 1); // 垂足 (50, 0)，离端点 50 > 半径
    expect(r).not.toBeNull();
    expect(r!.type).toBe('wall');
    expect(r!.sourceId).toBe('w1');
    expect(r!.point).toEqual({ x: 50, y: 0 });
  });

  it('viewScale 缩小 → 吸附半径按比例放大（世界空间）', () => {
    const plan = baseplan();
    // viewScale=0.1，radius = 8/0.1 = 80，距离 (0,0) 50 应该吸附到网格 (0,0)
    const r = findSnap({ x: 50, y: 50 }, plan, 0.1);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('grid');
  });

  it('端点优先于墙中点（同时满足时）', () => {
    const plan = baseplan();
    // 短墙，端点和中点都在鼠标附近
    plan.nodes['n1'] = { id: 'n1', position: { x: 0, y: 0 } };
    plan.nodes['n2'] = { id: 'n2', position: { x: 10, y: 0 } };
    plan.walls['w1'] = { id: 'w1', startNodeId: 'n1', endNodeId: 'n2', thickness: 12, height: 280 };

    // 鼠标在 (3, 0)，距 n1=3，距中点 (5,0)=2 —— 按优先级应该返回 n1（端点）
    const r = findSnap({ x: 3, y: 0 }, plan, 1);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('endpoint');
    expect(r!.sourceId).toBe('n1');
  });
});
