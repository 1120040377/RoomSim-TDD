import type { Vec2, Wall, WallNode } from '@/modules/model/types';
import { signedPolygonArea } from './vec2';

export interface DetectedFace {
  polygon: Vec2[];
  wallIds: string[];
}

interface AdjEntry {
  to: string;
  wallId: string;
  angle: number;
}

function buildAdjacency(
  nodes: Record<string, WallNode>,
  walls: Record<string, Wall>,
): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();

  for (const wall of Object.values(walls)) {
    const s = nodes[wall.startNodeId];
    const e = nodes[wall.endNodeId];
    if (!s || !e) continue;

    if (!adj.has(s.id)) adj.set(s.id, []);
    if (!adj.has(e.id)) adj.set(e.id, []);

    adj.get(s.id)!.push({
      to: e.id,
      wallId: wall.id,
      angle: Math.atan2(e.position.y - s.position.y, e.position.x - s.position.x),
    });
    adj.get(e.id)!.push({
      to: s.id,
      wallId: wall.id,
      angle: Math.atan2(s.position.y - e.position.y, s.position.x - e.position.x),
    });
  }

  for (const list of adj.values()) {
    list.sort((a, b) => a.angle - b.angle);
  }

  return adj;
}

/**
 * 平面图面遍历。每条有向边只走一次，每个"最紧贴左转"循环形成一个面。
 *
 * 走法：当前处于 v（来自 u），离开 v 时选 v 的邻居里"u 对应条目的前一个"
 * （按角度升序的索引 - 1），几何上相当于向"右手侧最紧靠"的方向拐，
 * 在屏幕坐标（y 向下）下对应内部面按顺时针围成；外部面则最大。
 */
export function detectRooms(
  nodes: Record<string, WallNode>,
  walls: Record<string, Wall>,
): DetectedFace[] {
  const adj = buildAdjacency(nodes, walls);
  const visited = new Set<string>();
  const faces: DetectedFace[] = [];

  for (const wall of Object.values(walls)) {
    for (const [u, v] of [
      [wall.startNodeId, wall.endNodeId],
      [wall.endNodeId, wall.startNodeId],
    ]) {
      if (visited.has(`${u}->${v}`)) continue;
      const face = traceFace(u, v, adj, visited, nodes);
      if (face && face.polygon.length >= 3) faces.push(face);
    }
  }

  // 在 y 向下的屏幕坐标下：signedArea > 0 表示 CW 环绕 → 内部面；
  // signedArea < 0 是外部面；signedArea === 0 是不闭合的"描边"面（U 形、单墙等），
  // 都不算房间。面积阈值 > 1 cm² 避免浮点噪声。
  return faces.filter((f) => signedPolygonArea(f.polygon) > 1);
}

function traceFace(
  startU: string,
  startV: string,
  adj: Map<string, AdjEntry[]>,
  visited: Set<string>,
  nodes: Record<string, WallNode>,
): DetectedFace | null {
  const polygon: Vec2[] = [];
  const wallIds: string[] = [];
  let u = startU;
  let v = startV;
  let guard = 1000;

  while (guard-- > 0) {
    if (visited.has(`${u}->${v}`)) break;
    visited.add(`${u}->${v}`);
    polygon.push(nodes[u].position);

    const neighborsOfV = adj.get(v);
    if (!neighborsOfV) return null;
    const idxOfU = neighborsOfV.findIndex((n) => n.to === u);
    if (idxOfU < 0) return null;

    // 记录当前边的 wallId
    wallIds.push(neighborsOfV[idxOfU].wallId);

    // 选 v 的邻居中 u 的"前一个"（按 angle 升序索引 -1） → 最紧凑的左转
    const nextIdx = (idxOfU - 1 + neighborsOfV.length) % neighborsOfV.length;
    const next = neighborsOfV[nextIdx];

    u = v;
    v = next.to;
  }

  return { polygon, wallIds };
}
