import type { Plan, Vec2, WallId } from '@/modules/model/types';
import { distance, projectOnSegment } from './vec2';

export interface NearestWallResult {
  wallId: WallId;
  foot: Vec2;
  /** 沿墙从 startNode 起的距离（cm） */
  offset: number;
  /** 点到垂足的距离（cm） */
  dist: number;
}

/**
 * 找离 worldPoint 最近的墙的垂足。用于 Door/Window 工具沿墙投影。
 * 垂足被裁剪到墙段端点之间（不会给出延长线上的投影）。
 * maxDist 可选：超出返回 null。
 */
export function nearestWallPoint(
  worldPoint: Vec2,
  plan: Plan,
  maxDist = Infinity,
): NearestWallResult | null {
  let best: NearestWallResult | null = null;

  for (const wall of Object.values(plan.walls)) {
    const s = plan.nodes[wall.startNodeId];
    const e = plan.nodes[wall.endNodeId];
    if (!s || !e) continue;

    const foot = projectOnSegment(worldPoint, s.position, e.position);
    const d = distance(worldPoint, foot);
    if (d > maxDist) continue;
    if (best && d >= best.dist) continue;

    const offset = distance(s.position, foot);
    best = { wallId: wall.id, foot, offset, dist: d };
  }

  return best;
}
