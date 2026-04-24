import { describe, it, expect } from 'vitest';
import { createEmptyPlan, DEFAULT_META, DEFAULT_WALKTHROUGH } from '@/modules/model/defaults';
import { PlanSchema } from '@/modules/model/schema';

describe('createEmptyPlan', () => {
  it('生成结构符合 PlanSchema', () => {
    const plan = createEmptyPlan('p1', '测试方案');
    const parsed = PlanSchema.safeParse(plan);
    expect(parsed.success).toBe(true);
  });

  it('默认 meta 正确（gridSize=20, wallHeight=280, wallThickness=12）', () => {
    const plan = createEmptyPlan('p1');
    expect(plan.meta).toEqual(DEFAULT_META);
    expect(plan.meta.gridSize).toBe(20);
    expect(plan.meta.defaultWallHeight).toBe(280);
    expect(plan.meta.defaultWallThickness).toBe(12);
  });

  it('默认 walkthrough personHeight=170', () => {
    const plan = createEmptyPlan('p1');
    expect(plan.walkthrough).toEqual(DEFAULT_WALKTHROUGH);
    expect(plan.walkthrough.personHeight).toBe(170);
  });

  it('初始化 nodes/walls/openings/furniture/rooms 都是空对象', () => {
    const plan = createEmptyPlan('p1');
    expect(plan.nodes).toEqual({});
    expect(plan.walls).toEqual({});
    expect(plan.openings).toEqual({});
    expect(plan.furniture).toEqual({});
    expect(plan.rooms).toEqual({});
  });

  it('createdAt 和 updatedAt 相等且非零', () => {
    const plan = createEmptyPlan('p1');
    expect(plan.createdAt).toBeGreaterThan(0);
    expect(plan.createdAt).toBe(plan.updatedAt);
  });
});
