import { describe, it, expect } from 'vitest';
import { createDefaultEngine } from '@/modules/ergonomics';
import { createEmptyPlan } from '@/modules/model/defaults';
import type { Plan, Furniture, FurnitureType } from '@/modules/model/types';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';

function addF(p: Plan, id: string, type: FurnitureType, x: number, y: number, rot = 0): Furniture {
  const def = FURNITURE_CATALOG[type];
  const f: Furniture = {
    id,
    type,
    position: { x, y },
    rotation: rot,
    size: { ...def.size },
  };
  p.furniture[id] = f;
  return f;
}

describe('ErgonomicsEngine 规则', () => {
  const engine = createDefaultEngine();

  describe('walk-width', () => {
    it('两张床相距 100cm（> 60） → 无告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 'b1', 'bed-single', 0, 0);
      addF(p, 'b2', 'bed-single', 300, 0); // center distance 300, bed width 100, clearance > 60
      const w = engine.run(p).filter((x) => x.ruleId === 'walk-width');
      expect(w).toHaveLength(0);
    });

    it('两张床中心距 110 → 过道 10cm → 告警', () => {
      const p = createEmptyPlan('p1');
      // bed-single width 100 → half 50；两床中心相距 110，净距 110-50-50=10 < 60
      addF(p, 'b1', 'bed-single', 0, 0);
      addF(p, 'b2', 'bed-single', 110, 0);
      const w = engine.run(p).filter((x) => x.ruleId === 'walk-width');
      expect(w.length).toBeGreaterThan(0);
    });
  });

  describe('sofa-coffee', () => {
    it('合理间距 40cm → 无告警', () => {
      const p = createEmptyPlan('p1');
      // sofa-3 depth 90 → half 45；茶几 depth 60 → half 30；中心距 45+30+40=115，净距 40
      addF(p, 's', 'sofa-3', 0, 0);
      addF(p, 't', 'coffee-table', 0, 115);
      const w = engine.run(p).filter((x) => x.ruleId === 'sofa-coffee');
      expect(w).toHaveLength(0);
    });

    it('太近 10cm → 告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 's', 'sofa-3', 0, 0);
      addF(p, 't', 'coffee-table', 0, 85); // 90/2+60/2+10 = 85
      const w = engine.run(p).filter((x) => x.ruleId === 'sofa-coffee');
      expect(w.length).toBeGreaterThan(0);
    });

    it('太远 80cm → 告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 's', 'sofa-3', 0, 0);
      addF(p, 't', 'coffee-table', 0, 155); // 90/2+60/2+80 = 155
      const w = engine.run(p).filter((x) => x.ruleId === 'sofa-coffee');
      expect(w.length).toBeGreaterThan(0);
    });
  });

  describe('ceiling-low', () => {
    it('墙高 220 < 240 → 有告警', () => {
      const p = createEmptyPlan('p1');
      p.nodes = {
        a: { id: 'a', position: { x: 0, y: 0 } },
        b: { id: 'b', position: { x: 400, y: 0 } },
        c: { id: 'c', position: { x: 400, y: 300 } },
        d: { id: 'd', position: { x: 0, y: 300 } },
      };
      p.walls = {
        w1: { id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 220 },
        w2: { id: 'w2', startNodeId: 'b', endNodeId: 'c', thickness: 12, height: 220 },
        w3: { id: 'w3', startNodeId: 'c', endNodeId: 'd', thickness: 12, height: 220 },
        w4: { id: 'w4', startNodeId: 'd', endNodeId: 'a', thickness: 12, height: 220 },
      };
      p.rooms = {
        r1: {
          id: 'r1',
          name: 'room',
          polygon: [
            { x: 0, y: 0 },
            { x: 400, y: 0 },
            { x: 400, y: 300 },
            { x: 0, y: 300 },
          ],
          wallIds: ['w1', 'w2', 'w3', 'w4'],
          area: 12,
        },
      };
      const w = engine.run(p).filter((x) => x.ruleId === 'ceiling-low');
      expect(w).toHaveLength(1);
    });

    it('墙高 280 → 无告警', () => {
      const p = createEmptyPlan('p1');
      p.rooms = {
        r1: {
          id: 'r1',
          name: 'r',
          polygon: [{ x: 0, y: 0 }],
          wallIds: ['w1'],
          area: 10,
        },
      };
      p.walls = {
        w1: { id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 280 },
      };
      const w = engine.run(p).filter((x) => x.ruleId === 'ceiling-low');
      expect(w).toHaveLength(0);
    });
  });

  describe('door-swing', () => {
    it('门开启区域有家具 → error 级告警', () => {
      const p = createEmptyPlan('p1');
      p.nodes = {
        a: { id: 'a', position: { x: 0, y: 0 } },
        b: { id: 'b', position: { x: 400, y: 0 } },
      };
      p.walls = {
        w1: { id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 280 },
      };
      p.openings = {
        d1: {
          id: 'd1', kind: 'door', wallId: 'w1', offset: 100, width: 90,
          height: 210, sillHeight: 0, hinge: 'start', swing: 'inside',
        },
      };
      // 门板扇区大致覆盖 (55,0)→(145,0)→法向 +y 弧度。家具在 (100, 60) 中心
      addF(p, 'f', 'side-table', 100, 60);
      const w = engine.run(p).filter((x) => x.ruleId === 'door-swing');
      expect(w.length).toBeGreaterThan(0);
      expect(w[0].severity).toBe('error');
    });
  });

  describe('kitchen-triangle', () => {
    it('灶/槽/冰箱齐全且合理（三边都在 120~270）→ 无告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 's', 'stove', 0, 0);
      addF(p, 'k', 'sink', 150, 0);
      addF(p, 'f', 'fridge', 150, 150); // 三条边 150/150/212 都在 [120, 270]
      const w = engine.run(p).filter((x) => x.ruleId === 'kitchen-triangle');
      expect(w).toHaveLength(0);
    });

    it('灶槽太近 (80cm) → 告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 's', 'stove', 0, 0);
      addF(p, 'k', 'sink', 80, 0);
      addF(p, 'f', 'fridge', 0, 200);
      const w = engine.run(p).filter((x) => x.ruleId === 'kitchen-triangle');
      expect(w.length).toBeGreaterThan(0);
    });

    it('缺少任一角 → 不触发', () => {
      const p = createEmptyPlan('p1');
      addF(p, 's', 'stove', 0, 0);
      addF(p, 'k', 'sink', 200, 0);
      const w = engine.run(p).filter((x) => x.ruleId === 'kitchen-triangle');
      expect(w).toHaveLength(0);
    });
  });
});
