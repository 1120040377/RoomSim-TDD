import type { Rule, Warning } from '../engine';
import { furnitureDistance } from '../util';

const MIN = 80;

/** 餐椅后方空间 < 80cm 告警（实际是椅子后拉出的空间）。
 * 简化：查 dining-chair 与周围其他非餐桌家具的最近距离。*/
export const DiningChairRule: Rule = {
  id: 'dining-chair',
  check(plan) {
    const warnings: Warning[] = [];
    const fs = Object.values(plan.furniture);
    const chairs = fs.filter((f) => f.type === 'dining-chair');
    for (const chair of chairs) {
      for (const other of fs) {
        if (other.id === chair.id) continue;
        if (other.type.startsWith('dining-table') || other.type === 'dining-chair') continue;
        const d = furnitureDistance(chair, other);
        if (d > 0 && d < MIN) {
          warnings.push({
            id: `dining-chair-${chair.id}-${other.id}`,
            ruleId: 'dining-chair',
            severity: 'warn',
            position: {
              x: (chair.position.x + other.position.x) / 2,
              y: (chair.position.y + other.position.y) / 2,
            },
            message: `餐椅后方不足 ${MIN}cm（${d.toFixed(0)}cm）`,
            relatedIds: [chair.id, other.id],
          });
        }
      }
    }
    return warnings;
  },
};
