import type { Rule, Warning } from '../engine';
import { furnitureDistance, midPoint } from '../util';

const MIN = 30;
const MAX = 60;

const SOFA_TYPES = new Set(['sofa-2', 'sofa-3', 'sofa-l', 'armchair']);

/** 沙发-茶几间距合理：30–60 cm。*/
export const SofaCoffeeRule: Rule = {
  id: 'sofa-coffee',
  check(plan) {
    const warnings: Warning[] = [];
    const fs = Object.values(plan.furniture);
    const sofas = fs.filter((f) => SOFA_TYPES.has(f.type));
    const tables = fs.filter((f) => f.type === 'coffee-table');
    for (const s of sofas) {
      for (const t of tables) {
        const d = furnitureDistance(s, t);
        if (d < MIN) {
          warnings.push({
            id: `sofa-coffee-close-${s.id}-${t.id}`,
            ruleId: 'sofa-coffee',
            severity: 'warn',
            position: midPoint(s.position, t.position),
            message: `沙发与茶几过近（${d.toFixed(0)}cm）`,
            relatedIds: [s.id, t.id],
          });
        } else if (d > MAX) {
          warnings.push({
            id: `sofa-coffee-far-${s.id}-${t.id}`,
            ruleId: 'sofa-coffee',
            severity: 'warn',
            position: midPoint(s.position, t.position),
            message: `沙发与茶几过远（${d.toFixed(0)}cm）`,
            relatedIds: [s.id, t.id],
          });
        }
      }
    }
    return warnings;
  },
};
