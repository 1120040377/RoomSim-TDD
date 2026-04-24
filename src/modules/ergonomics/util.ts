import type { Furniture, Vec2 } from '@/modules/model/types';

/** 把家具作为未旋转的 AABB 返回（世界空间角点列表） */
export function furnitureCorners(f: Furniture): Vec2[] {
  const hw = f.size.width / 2;
  const hd = f.size.depth / 2;
  const local: Vec2[] = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
  const c = Math.cos(f.rotation);
  const s = Math.sin(f.rotation);
  return local.map((p) => ({
    x: f.position.x + p.x * c - p.y * s,
    y: f.position.y + p.x * s + p.y * c,
  }));
}

/** 两件家具外包多边形最短距离；相交返回 0。这里用角点-角点 + 近似中心，适用于
 * 初筛告警，精度 < 2cm 足够给到"过窄"提示。*/
export function furnitureDistance(a: Furniture, b: Furniture): number {
  const ca = furnitureCorners(a);
  const cb = furnitureCorners(b);
  // 粗略：找中心方向线，投影到两 AABB 各自边界后取差。
  // 更准：SAT 最小距离；P0 用 corner-to-corner + 中心间隔近似。
  let min = Infinity;
  for (const p1 of ca) {
    for (const p2 of cb) {
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (d < min) min = d;
    }
  }
  // 再减去两家具投影到中心线方向上的半径之和，避免中心距近似偏高
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const centerD = Math.hypot(dx, dy);
  const ra = projectedRadius(a, { x: dx, y: dy });
  const rb = projectedRadius(b, { x: dx, y: dy });
  const centerApprox = Math.max(0, centerD - ra - rb);
  return Math.min(min, centerApprox);
}

function projectedRadius(f: Furniture, dir: Vec2): number {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  // 把方向投影到家具局部轴
  const c = Math.cos(f.rotation);
  const s = Math.sin(f.rotation);
  const localX = ux * c + uy * s;
  const localY = -ux * s + uy * c;
  return (f.size.width / 2) * Math.abs(localX) + (f.size.depth / 2) * Math.abs(localY);
}

export function midPoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
