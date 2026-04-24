import type { Rule, Warning } from '../engine';
import { furnitureCorners } from '../util';
import type { Door } from '@/modules/model/types';

/**
 * 门开启时扫过的弧线扇区里若有家具 → error。
 * 简化判定：构造门开启 90° 的三角形区域（铰链点 + 门板两个开启端点），
 * 判家具角点是否进入该三角形。
 */
export const DoorSwingRule: Rule = {
  id: 'door-swing',
  check(plan) {
    const warnings: Warning[] = [];
    for (const op of Object.values(plan.openings)) {
      if (op.kind !== 'door') continue;
      const door = op as Door;
      const wall = plan.walls[door.wallId];
      if (!wall) continue;
      const s = plan.nodes[wall.startNodeId];
      const e = plan.nodes[wall.endNodeId];
      if (!s || !e) continue;

      const dx = e.position.x - s.position.x;
      const dy = e.position.y - s.position.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      const ux = dx / len;
      const uy = dy / len;
      // 墙法向（向门开侧）
      const nx = -uy;
      const ny = ux;
      const swingSign = door.swing === 'inside' ? 1 : -1;

      const hingeAlong = door.hinge === 'start' ? door.offset - door.width / 2 : door.offset + door.width / 2;
      const hinge = {
        x: s.position.x + ux * hingeAlong,
        y: s.position.y + uy * hingeAlong,
      };
      // 门板展开方向：铰在 start 时沿 +wallDir，否则 -wallDir
      const panelDirSign = door.hinge === 'start' ? 1 : -1;
      // 门板关闭端点
      const closed = {
        x: hinge.x + ux * door.width * panelDirSign,
        y: hinge.y + uy * door.width * panelDirSign,
      };
      // 门板开 90° 端点（朝法向）
      const opened = {
        x: hinge.x + nx * door.width * swingSign,
        y: hinge.y + ny * door.width * swingSign,
      };

      for (const f of Object.values(plan.furniture)) {
        const corners = furnitureCorners(f);
        let hit = false;
        for (const c of corners) {
          if (pointInTriangle(c, hinge, closed, opened)) {
            hit = true;
            break;
          }
        }
        if (hit) {
          warnings.push({
            id: `door-swing-${door.id}-${f.id}`,
            ruleId: 'door-swing',
            severity: 'error',
            position: hinge,
            message: '门开启区域有家具',
            relatedIds: [door.id, f.id],
          });
        }
      }
    }
    return warnings;
  },
};

function pointInTriangle(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): boolean {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function sign(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  return (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
}
