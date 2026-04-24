import type { Rule, Warning } from '../engine';
import { furnitureDistance } from '../util';
import type { Furniture } from '@/modules/model/types';

const MIN = 40;

const BED_TYPES = new Set(['bed-single', 'bed-double', 'bed-kingsize']);

/** 床周围家具净距 < 40cm 告警（不区分床头/床尾侧，简化）。*/
export const BedClearanceRule: Rule = {
  id: 'bed-clearance',
  check(plan) {
    const warnings: Warning[] = [];
    const fs = Object.values(plan.furniture);
    const beds = fs.filter((f: Furniture) => BED_TYPES.has(f.type));
    for (const bed of beds) {
      for (const other of fs) {
        if (other.id === bed.id) continue;
        // 床头柜允许紧贴
        if (other.type === 'side-table') continue;
        const d = furnitureDistance(bed, other);
        if (d > 0 && d < MIN) {
          warnings.push({
            id: `bed-close-${bed.id}-${other.id}`,
            ruleId: 'bed-clearance',
            severity: 'warn',
            position: {
              x: (bed.position.x + other.position.x) / 2,
              y: (bed.position.y + other.position.y) / 2,
            },
            message: `床周过窄（${d.toFixed(0)}cm，建议 ≥ ${MIN}cm）`,
            relatedIds: [bed.id, other.id],
          });
        }
      }
    }
    return warnings;
  },
};
