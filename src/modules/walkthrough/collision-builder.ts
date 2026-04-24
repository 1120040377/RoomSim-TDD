import type { Plan, Vec2 } from '@/modules/model/types';
import type { OrientedBox } from '@/modules/geometry/collision';
import { splitWallIntoSlabs } from '@/modules/geometry/opening-cut';
import { wallAngle, wallLengthCm } from './coord';

/**
 * 为漫游生成 2D 俯视碰撞体列表（圆-OBB 碰撞用）。
 *
 *  - 每面墙按开洞切成 slab，每段生成一个 OBB。**bottomZ=0 的 slab 才会阻挡行人**
 *    （过梁/窗台下方在人眼高度以上/以下，俯视碰撞忽略即可——窗台下方视作矮墙会挡人，
 *    过梁在头顶不挡人）。简化：只把 bottomZ===0 && height > 150（及膝/腰墙以上
 *    才挡人）的视作碰撞体。
 *  - 家具全部作为 OBB，方向用其 rotation。
 *
 *  返回的坐标仍是 editor 空间（cm），与 slide() 对齐；控制器读出的 three.js 位置
 *  需要先换回 editor 坐标。
 */
export function buildCollider(plan: Plan): OrientedBox[] {
  const boxes: OrientedBox[] = [];

  // 墙段
  for (const wall of Object.values(plan.walls)) {
    const s = plan.nodes[wall.startNodeId];
    const e = plan.nodes[wall.endNodeId];
    if (!s || !e) continue;

    const length = wallLengthCm(s.position, e.position);
    const angle = wallAngle(s.position, e.position);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const openings = Object.values(plan.openings).filter((o) => o.wallId === wall.id);
    const slabs = splitWallIntoSlabs(length, openings, wall.height);
    for (const slab of slabs) {
      // 只把底面着地的 slab 当墙（过梁在头顶之上）
      if (slab.bottomZ !== 0) continue;
      // 太矮的片段（例如窗台下方很矮）也可挡人 — 留下即可
      const along = slab.startOffset + slab.length / 2;
      const center: Vec2 = {
        x: s.position.x + cosA * along,
        y: s.position.y + sinA * along,
      };
      boxes.push({
        center,
        halfW: slab.length / 2,
        halfD: wall.thickness / 2,
        rotation: angle,
      });
    }
  }

  // 家具
  for (const f of Object.values(plan.furniture)) {
    boxes.push({
      center: { ...f.position },
      halfW: f.size.width / 2,
      halfD: f.size.depth / 2,
      rotation: f.rotation,
    });
  }

  return boxes;
}
