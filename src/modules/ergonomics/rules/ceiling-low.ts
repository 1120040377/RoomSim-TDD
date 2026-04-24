import type { Rule, Warning } from '../engine';

const MIN_HEIGHT = 240;

/** 墙高 < 240 提示低矮感。按房间中心生成一条警告。*/
export const CeilingLowRule: Rule = {
  id: 'ceiling-low',
  check(plan) {
    const warnings: Warning[] = [];
    for (const r of Object.values(plan.rooms)) {
      const walls = r.wallIds.map((id) => plan.walls[id]).filter(Boolean);
      if (walls.length === 0) continue;
      const minH = Math.min(...walls.map((w) => w.height));
      if (minH < MIN_HEIGHT) {
        const cx = r.polygon.reduce((s, p) => s + p.x, 0) / r.polygon.length;
        const cy = r.polygon.reduce((s, p) => s + p.y, 0) / r.polygon.length;
        warnings.push({
          id: `ceiling-low-${r.id}`,
          ruleId: 'ceiling-low',
          severity: 'warn',
          position: { x: cx, y: cy },
          message: `墙高 ${minH}cm 偏矮（建议 ≥ ${MIN_HEIGHT}cm）`,
          relatedIds: [r.id],
        });
      }
    }
    return warnings;
  },
};
