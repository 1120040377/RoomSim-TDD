import type { Rule, Warning } from '../engine';
import { midPoint } from '../util';
import type { Furniture } from '@/modules/model/types';

const MIN = 120;
const MAX = 270;

/** 灶/槽/冰箱两两距离：< 120 或 > 270 提示。同一房间内只取最近的一套三元。*/
export const KitchenTriangleRule: Rule = {
  id: 'kitchen-triangle',
  check(plan) {
    const warnings: Warning[] = [];
    const fs = Object.values(plan.furniture);
    const stoves = fs.filter((f) => f.type === 'stove');
    const sinks = fs.filter((f) => f.type === 'sink');
    const fridges = fs.filter((f) => f.type === 'fridge');
    if (stoves.length === 0 || sinks.length === 0 || fridges.length === 0) return warnings;

    // 简化：对每个可能组合都检查（住宅厨房一般各只有一个）
    for (const a of stoves) {
      for (const b of sinks) {
        for (const c of fridges) {
          for (const [x, y] of [
            [a, b],
            [b, c],
            [c, a],
          ] as Array<[Furniture, Furniture]>) {
            const d = Math.hypot(x.position.x - y.position.x, x.position.y - y.position.y);
            if (d < MIN) {
              warnings.push({
                id: `kitchen-close-${x.id}-${y.id}`,
                ruleId: 'kitchen-triangle',
                severity: 'warn',
                position: midPoint(x.position, y.position),
                message: `厨房工作三角过密（${d.toFixed(0)}cm）`,
                relatedIds: [x.id, y.id],
              });
            } else if (d > MAX) {
              warnings.push({
                id: `kitchen-far-${x.id}-${y.id}`,
                ruleId: 'kitchen-triangle',
                severity: 'warn',
                position: midPoint(x.position, y.position),
                message: `厨房工作三角过稀（${d.toFixed(0)}cm）`,
                relatedIds: [x.id, y.id],
              });
            }
          }
        }
      }
    }
    return warnings;
  },
};
