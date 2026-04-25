import type { Plan, Vec2 } from '@/modules/model/types';
import { distance, midpoint, projectOnSegment } from './vec2';

export type SnapType = 'endpoint' | 'midpoint' | 'wall' | 'grid';

export interface SnapResult {
  point: Vec2;
  type: SnapType;
  sourceId?: string;
}

/** 节点（endpoint）吸附半径更大，更易命中转折点 */
const ENDPOINT_RADIUS_PX = 12;
const SCREEN_RADIUS_PX = 8;

/**
 * 吸附优先级：endpoint > midpoint > wall 垂足 > grid。
 * radius 以屏幕像素定义，按 viewScale 换算到世界空间 cm。
 * viewScale 越小（视图缩得越小）→ 世界半径越大，触发更宽松。
 */
export function findSnap(
  worldPoint: Vec2,
  plan: Plan,
  viewScale: number,
): SnapResult | null {
  const endpointRadius = ENDPOINT_RADIUS_PX / viewScale;
  const radius = SCREEN_RADIUS_PX / viewScale;

  // 1. 端点
  for (const node of Object.values(plan.nodes)) {
    if (distance(worldPoint, node.position) < endpointRadius) {
      return { point: { ...node.position }, type: 'endpoint', sourceId: node.id };
    }
  }

  // 2. 墙中点
  for (const wall of Object.values(plan.walls)) {
    const s = plan.nodes[wall.startNodeId];
    const e = plan.nodes[wall.endNodeId];
    if (!s || !e) continue;
    const m = midpoint(s.position, e.position);
    if (distance(worldPoint, m) < radius) {
      return { point: m, type: 'midpoint', sourceId: wall.id };
    }
  }

  // 3. 墙线垂足
  for (const wall of Object.values(plan.walls)) {
    const s = plan.nodes[wall.startNodeId];
    const e = plan.nodes[wall.endNodeId];
    if (!s || !e) continue;
    const foot = projectOnSegment(worldPoint, s.position, e.position);
    if (distance(worldPoint, foot) < radius) {
      return { point: foot, type: 'wall', sourceId: wall.id };
    }
  }

  // 4. 网格
  const grid = plan.meta.gridSize;
  const snapped: Vec2 = {
    x: Math.round(worldPoint.x / grid) * grid,
    y: Math.round(worldPoint.y / grid) * grid,
  };
  if (distance(worldPoint, snapped) < radius) {
    return { point: snapped, type: 'grid' };
  }

  return null;
}
