import type { Rule, Warning } from '../engine';
import { midPoint } from '../util';

const MIN_RATIO = 1.5; // 最少 电视对角线 × 1.5
const MAX_RATIO = 4.0; // 最多 电视对角线 × 4

const SOFA_TYPES = new Set(['sofa-2', 'sofa-3', 'sofa-l', 'armchair']);

/** 沙发-电视距离：推荐电视对角线 ×1.5~×4。对角线用 tv.size.width 近似。*/
export const SofaTvRule: Rule = {
  id: 'sofa-tv',
  check(plan) {
    const warnings: Warning[] = [];
    const fs = Object.values(plan.furniture);
    const sofas = fs.filter((f) => SOFA_TYPES.has(f.type));
    const tvs = fs.filter((f) => f.type === 'tv');
    for (const s of sofas) {
      for (const t of tvs) {
        const diag = t.size.width; // cm；约等于对角线（实际对角≈ width 对电视 16:9）
        const d = Math.hypot(s.position.x - t.position.x, s.position.y - t.position.y);
        const minD = diag * MIN_RATIO;
        const maxD = diag * MAX_RATIO;
        if (d < minD) {
          warnings.push({
            id: `sofa-tv-close-${s.id}-${t.id}`,
            ruleId: 'sofa-tv',
            severity: 'warn',
            position: midPoint(s.position, t.position),
            message: `沙发离电视过近（${d.toFixed(0)}cm，建议 ≥ ${minD.toFixed(0)}cm）`,
            relatedIds: [s.id, t.id],
          });
        } else if (d > maxD) {
          warnings.push({
            id: `sofa-tv-far-${s.id}-${t.id}`,
            ruleId: 'sofa-tv',
            severity: 'warn',
            position: midPoint(s.position, t.position),
            message: `沙发离电视过远（${d.toFixed(0)}cm，建议 ≤ ${maxD.toFixed(0)}cm）`,
            relatedIds: [s.id, t.id],
          });
        }
      }
    }
    return warnings;
  },
};
