import type { Vec2 } from '@/modules/model/types';

export function v(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(a: Vec2): Vec2 {
  const len = length(a);
  if (len === 0) return { x: 0, y: 0 };
  return { x: a.x / len, y: a.y / len };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** 二维叉积（标量） */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function rotate(a: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** 把点投影到线段 [s, e]，返回垂足（clamp 到端点内） */
export function projectOnSegment(p: Vec2, s: Vec2, e: Vec2): Vec2 {
  const ex = e.x - s.x;
  const ey = e.y - s.y;
  const lenSq = ex * ex + ey * ey;
  if (lenSq === 0) return { ...s };
  let t = ((p.x - s.x) * ex + (p.y - s.y) * ey) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: s.x + ex * t, y: s.y + ey * t };
}

/** Shoelace 带符号面积：y 向下（屏幕）坐标系下 CW 为正。 */
export function signedPolygonArea(poly: Vec2[]): number {
  if (poly.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonArea(poly: Vec2[]): number {
  return Math.abs(signedPolygonArea(poly));
}
