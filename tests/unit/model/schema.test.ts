import { describe, it, expect } from 'vitest';
import {
  PlanSchema,
  Vec2Schema,
  WallSchema,
  OpeningSchema,
  DoorSchema,
  WindowSchema,
} from '@/modules/model/schema';
import { createEmptyPlan } from '@/modules/model/defaults';

describe('Zod schema', () => {
  describe('Vec2Schema', () => {
    it('接受合法坐标', () => {
      expect(Vec2Schema.safeParse({ x: 10, y: 20 }).success).toBe(true);
    });
    it('拒绝缺字段', () => {
      expect(Vec2Schema.safeParse({ x: 10 }).success).toBe(false);
    });
  });

  describe('WallSchema', () => {
    it('接受合法墙', () => {
      const ok = WallSchema.safeParse({
        id: 'w1',
        startNodeId: 'a',
        endNodeId: 'b',
        thickness: 12,
        height: 280,
      });
      expect(ok.success).toBe(true);
    });
    it('拒绝厚度过小（<3cm）', () => {
      const bad = WallSchema.safeParse({
        id: 'w1',
        startNodeId: 'a',
        endNodeId: 'b',
        thickness: 1,
        height: 280,
      });
      expect(bad.success).toBe(false);
    });
    it('拒绝高度过高（>500cm）', () => {
      const bad = WallSchema.safeParse({
        id: 'w1',
        startNodeId: 'a',
        endNodeId: 'b',
        thickness: 12,
        height: 600,
      });
      expect(bad.success).toBe(false);
    });
  });

  describe('OpeningSchema 辨析', () => {
    it('door 必须带 hinge/swing', () => {
      const door = {
        id: 'd1',
        kind: 'door' as const,
        wallId: 'w1',
        offset: 100,
        width: 90,
        height: 210,
        sillHeight: 0,
        hinge: 'start' as const,
        swing: 'inside' as const,
      };
      expect(DoorSchema.safeParse(door).success).toBe(true);
      expect(OpeningSchema.safeParse(door).success).toBe(true);
    });

    it('window 不允许带 hinge', () => {
      const win = {
        id: 'w1',
        kind: 'window' as const,
        wallId: 'wallX',
        offset: 100,
        width: 120,
        height: 140,
        sillHeight: 90,
      };
      expect(WindowSchema.safeParse(win).success).toBe(true);
    });
  });

  describe('PlanSchema', () => {
    it('接受空 Plan', () => {
      const p = createEmptyPlan('p1');
      expect(PlanSchema.safeParse(p).success).toBe(true);
    });

    it('拒绝错误 schemaVersion', () => {
      const p = { ...createEmptyPlan('p1'), schemaVersion: 2 as unknown as 1 };
      expect(PlanSchema.safeParse(p).success).toBe(false);
    });
  });
});
