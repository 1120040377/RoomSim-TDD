import type { Plan, Vec2 } from '@/modules/model/types';
import { circleVsOrientedBox } from '@/modules/geometry/collision';
import { buildCollider } from './collision-builder';

function inside(p: Vec2, polygon: Vec2[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

/** Prefer a free spot in the largest room, avoiding spawning inside a bed or wall. */
export function getSpawnPoint(plan: Plan): Vec2 {
  if (plan.walkthrough.startPosition) return { ...plan.walkthrough.startPosition };

  const rooms = Object.values(plan.rooms);
  if (rooms.length === 0) {
    // 没房间就用所有节点的 bbox 中心
    const nodes = Object.values(plan.nodes);
    if (nodes.length === 0) return { x: 0, y: 0 };
    const xs = nodes.map((n) => n.position.x);
    const ys = nodes.map((n) => n.position.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  }

  const obstacles = buildCollider(plan);
  let fallback: Vec2 = { x: 0, y: 0 };
  for (const room of [...rooms].sort((a, b) => b.area - a.area)) {
    if (room.polygon.length < 3) continue;
    const center = room.polygon.reduce((c, p) => ({ x: c.x + p.x / room.polygon.length, y: c.y + p.y / room.polygon.length }), { x: 0, y: 0 });
    fallback = center;
    const free = (p: Vec2) => inside(p, room.polygon) && obstacles.every(o => circleVsOrientedBox(p, 24, o).overlap === 0);
    if (free(center)) return center;
    const xs = room.polygon.map(p => p.x), ys = room.polygon.map(p => p.y);
    const step = Math.max(30, (Math.max(...xs) - Math.min(...xs)) / 50, (Math.max(...ys) - Math.min(...ys)) / 50);
    const candidates: Vec2[] = [];
    for (let x = Math.min(...xs) + 30; x < Math.max(...xs); x += step) {
      for (let y = Math.min(...ys) + 30; y < Math.max(...ys); y += step) candidates.push({ x, y });
    }
    candidates.sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
    const spawn = candidates.find(free);
    if (spawn) return spawn;
  }
  return fallback;
}
