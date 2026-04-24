import { describe, it, expect } from 'vitest';
import { createDefaultEngine } from '@/modules/ergonomics';
import { createEmptyPlan } from '@/modules/model/defaults';
import type { Furniture, FurnitureType, Plan } from '@/modules/model/types';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';

function addF(p: Plan, id: string, type: FurnitureType, x: number, y: number): Furniture {
  const def = FURNITURE_CATALOG[type];
  const f: Furniture = {
    id,
    type,
    position: { x, y },
    rotation: 0,
    size: { ...def.size },
  };
  p.furniture[id] = f;
  return f;
}

describe('补充人体工学规则', () => {
  const engine = createDefaultEngine();

  describe('sofa-tv', () => {
    it('tv 对角线 130，沙发 300cm 外 → 合理范围（130*1.5=195, 130*4=520）', () => {
      const p = createEmptyPlan('p1');
      addF(p, 's', 'sofa-3', 0, 0);
      addF(p, 't', 'tv', 0, 300);
      const w = engine.run(p).filter((x) => x.ruleId === 'sofa-tv');
      expect(w).toHaveLength(0);
    });

    it('太近 150cm → 告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 's', 'sofa-3', 0, 0);
      addF(p, 't', 'tv', 0, 150);
      const w = engine.run(p).filter((x) => x.ruleId === 'sofa-tv');
      expect(w.length).toBeGreaterThan(0);
    });

    it('太远 600cm → 告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 's', 'sofa-3', 0, 0);
      addF(p, 't', 'tv', 0, 600);
      const w = engine.run(p).filter((x) => x.ruleId === 'sofa-tv');
      expect(w.length).toBeGreaterThan(0);
    });
  });

  describe('bed-clearance', () => {
    it('床头柜紧贴床 → 无告警（白名单）', () => {
      const p = createEmptyPlan('p1');
      addF(p, 'bed', 'bed-double', 0, 0); // 150x200
      addF(p, 'nt', 'side-table', 100, 0); // 紧贴
      const w = engine.run(p).filter((x) => x.ruleId === 'bed-clearance');
      expect(w).toHaveLength(0);
    });

    it('床侧 20cm 的衣柜 → 告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 'bed', 'bed-double', 0, 0); // halfW 75
      addF(p, 'wd', 'wardrobe-2', 145, 0); // halfW 50，净距 145-75-50=20<40
      const w = engine.run(p).filter((x) => x.ruleId === 'bed-clearance');
      expect(w.length).toBeGreaterThan(0);
    });
  });

  describe('dining-chair', () => {
    it('餐椅后方有墙/家具（50cm）→ 告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 'ch', 'dining-chair', 0, 0); // depth 50, halfD 25
      addF(p, 'bk', 'bookshelf', 0, 100); // depth 30, halfD 15; 中心距 100 - 25 - 15 = 60 > 60? 净 60 > 50... 再改
      // 净距 = 100 - 25 - 15 = 60, 想触发告警需 < 80
      const w = engine.run(p).filter((x) => x.ruleId === 'dining-chair');
      expect(w.length).toBeGreaterThan(0);
    });

    it('餐椅与餐桌之间无告警', () => {
      const p = createEmptyPlan('p1');
      addF(p, 'ch', 'dining-chair', 0, 0);
      addF(p, 'tb', 'dining-table-4', 0, 60); // 贴紧
      const w = engine.run(p).filter((x) => x.ruleId === 'dining-chair');
      expect(w).toHaveLength(0);
    });
  });
});
