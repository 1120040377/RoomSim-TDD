import type { Plan, Vec2 } from '@/modules/model/types';

/** 选择初始生成点：最大房间的质心；若无房间则原点。*/
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

  let best = rooms[0];
  for (const r of rooms) if (r.area > best.area) best = r;

  // 质心
  let sx = 0;
  let sy = 0;
  for (const p of best.polygon) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / best.polygon.length, y: sy / best.polygon.length };
}
