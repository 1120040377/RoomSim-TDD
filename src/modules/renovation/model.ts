import type { Renovation, Utility, UtilityKind, Vec2 } from '@/modules/model/types';

export const UTILITY_CATALOG: Record<UtilityKind, { name: string; color: string; symbol: string; height: number }> = {
  socket: { name: '插座', color: '#d97706', symbol: '插', height: 30 },
  switch: { name: '开关', color: '#7c3aed', symbol: '开', height: 130 },
  electric: { name: '电路', color: '#d97706', symbol: '电', height: 20 },
  'cold-water': { name: '冷水', color: '#0284c7', symbol: '冷', height: 50 },
  'hot-water': { name: '热水', color: '#e34545', symbol: '热', height: 50 },
  drain: { name: '排水', color: '#059669', symbol: '排', height: 5 },
};
export function defaultRenovation(): Renovation {
  return { utilities: {}, finish: { floor: 'wood', floorColor: '#d6bc94', wallColor: '#f5f0e8' } };
}
/** Orthogonal routing, keeping each click as a deliberate waypoint. */
export function routeTo(start: Vec2, end: Vec2, verticalFirst = false): Vec2[] {
  const elbow = verticalFirst ? { x: start.x, y: end.y } : { x: end.x, y: start.y };
  return [start, elbow, end].filter((p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y);
}
export function routeLength(u: Utility): number {
  return u.points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - u.points[i].x, p.y - u.points[i].y,
    (p.height ?? u.height) - (u.points[i].height ?? u.height)), 0);
}
