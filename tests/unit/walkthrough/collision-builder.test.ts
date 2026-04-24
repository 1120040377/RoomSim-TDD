import { describe, it, expect } from 'vitest';
import { buildCollider } from '@/modules/walkthrough/collision-builder';
import { createEmptyPlan } from '@/modules/model/defaults';

describe('buildCollider', () => {
  it('空 plan → 空碰撞列表', () => {
    expect(buildCollider(createEmptyPlan('p1'))).toEqual([]);
  });

  it('单墙无开洞 → 1 个 OBB，长度 = 墙长', () => {
    const p = createEmptyPlan('p1');
    p.nodes['a'] = { id: 'a', position: { x: 0, y: 0 } };
    p.nodes['b'] = { id: 'b', position: { x: 400, y: 0 } };
    p.walls['w1'] = { id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 280 };

    const boxes = buildCollider(p);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].halfW).toBe(200);
    expect(boxes[0].halfD).toBe(6);
    expect(boxes[0].center).toEqual({ x: 200, y: 0 });
    expect(boxes[0].rotation).toBe(0);
  });

  it('墙+门 → 左墙段 + 右墙段（过梁在头顶不挡）= 2 OBB', () => {
    const p = createEmptyPlan('p1');
    p.nodes['a'] = { id: 'a', position: { x: 0, y: 0 } };
    p.nodes['b'] = { id: 'b', position: { x: 400, y: 0 } };
    p.walls['w1'] = { id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 280 };
    p.openings['d1'] = {
      id: 'd1', kind: 'door', wallId: 'w1', offset: 200, width: 90, height: 210, sillHeight: 0,
      hinge: 'start', swing: 'inside',
    };
    expect(buildCollider(p)).toHaveLength(2);
  });

  it('窗（sillHeight>0）→ 窗台下方挡人（1 OBB） + 左右墙段 = 3 OBB', () => {
    const p = createEmptyPlan('p1');
    p.nodes['a'] = { id: 'a', position: { x: 0, y: 0 } };
    p.nodes['b'] = { id: 'b', position: { x: 400, y: 0 } };
    p.walls['w1'] = { id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 280 };
    p.openings['w2'] = {
      id: 'w2', kind: 'window', wallId: 'w1', offset: 200, width: 120, height: 140, sillHeight: 90,
    };
    expect(buildCollider(p)).toHaveLength(3);
  });

  it('家具也被计入', () => {
    const p = createEmptyPlan('p1');
    p.furniture['f1'] = {
      id: 'f1',
      type: 'armchair',
      position: { x: 100, y: 100 },
      rotation: Math.PI / 4,
      size: { width: 80, depth: 85, height: 85 },
    };
    const boxes = buildCollider(p);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].center).toEqual({ x: 100, y: 100 });
    expect(boxes[0].rotation).toBeCloseTo(Math.PI / 4);
  });
});
