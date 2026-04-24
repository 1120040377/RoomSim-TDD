import type { Rule, Warning } from '../engine';
import { furnitureDistance, midPoint } from '../util';

const MIN_WIDTH = 60;

/** 任意两件家具之间的过道净宽 < 60cm 告警。*/
export const WalkingPathRule: Rule = {
  id: 'walk-width',
  check(plan) {
    const warnings: Warning[] = [];
    const fs = Object.values(plan.furniture);
    for (let i = 0; i < fs.length; i++) {
      for (let j = i + 1; j < fs.length; j++) {
        const d = furnitureDistance(fs[i], fs[j]);
        if (d > 0 && d < MIN_WIDTH) {
          warnings.push({
            id: `walk-${fs[i].id}-${fs[j].id}`,
            ruleId: 'walk-width',
            severity: 'warn',
            position: midPoint(fs[i].position, fs[j].position),
            message: `过道仅 ${d.toFixed(0)}cm，建议 ≥ ${MIN_WIDTH}cm`,
            relatedIds: [fs[i].id, fs[j].id],
          });
        }
      }
    }
    return warnings;
  },
};
