import type { Vec2, Cm } from '@/modules/model/types';
import { rotate, sub } from './vec2';

export interface OrientedBox {
  center: Vec2;
  halfW: Cm; // X 半宽（未旋转）
  halfD: Cm; // Y 半深（未旋转）
  rotation: number; // 弧度
}

export interface CollisionResult {
  /** 圆侵入盒子的深度；0 表示不相交 */
  overlap: Cm;
  /** 从盒子指向圆心的单位法向（overlap=0 时 {0,0}） */
  normal: Vec2;
}

/**
 * 圆-OBB 相交检测 + 最小平移向量。
 *
 * 做法：
 *  1. 把圆心变换到盒子局部坐标系（反向旋转）
 *  2. 在局部取最近点（clamp 到 halfW/halfD）
 *  3. 距离小于 radius 则相交，法向从最近点指向圆心
 *  4. 圆心落在盒子内部时，沿离最近边最近的一轴推出
 *  5. 把局部法向旋转回世界坐标
 */
export function circleVsOrientedBox(
  center: Vec2,
  radius: Cm,
  box: OrientedBox,
): CollisionResult {
  const local = rotate(sub(center, box.center), -box.rotation);

  const closest: Vec2 = {
    x: Math.max(-box.halfW, Math.min(box.halfW, local.x)),
    y: Math.max(-box.halfD, Math.min(box.halfD, local.y)),
  };

  const diff: Vec2 = { x: local.x - closest.x, y: local.y - closest.y };
  const distSq = diff.x * diff.x + diff.y * diff.y;

  if (distSq === 0) {
    // 圆心在盒子内部：找最近边
    const dxPos = box.halfW - local.x;
    const dxNeg = local.x - -box.halfW;
    const dyPos = box.halfD - local.y;
    const dyNeg = local.y - -box.halfD;
    const minD = Math.min(dxPos, dxNeg, dyPos, dyNeg);
    let localNormal: Vec2;
    if (minD === dxPos) localNormal = { x: 1, y: 0 };
    else if (minD === dxNeg) localNormal = { x: -1, y: 0 };
    else if (minD === dyPos) localNormal = { x: 0, y: 1 };
    else localNormal = { x: 0, y: -1 };

    const overlap = radius + minD;
    return { overlap, normal: rotate(localNormal, box.rotation) };
  }

  const dist = Math.sqrt(distSq);
  if (dist >= radius) {
    return { overlap: 0, normal: { x: 0, y: 0 } };
  }

  const overlap = radius - dist;
  const localNormal: Vec2 = { x: diff.x / dist, y: diff.y / dist };
  return { overlap, normal: rotate(localNormal, box.rotation) };
}

/**
 * 角色（圆）按期望位移 delta 推进，遇到障碍物则沿法向推开（滑墙）。
 *
 * 为避免"一帧 delta 过大穿过薄墙"的隧穿，内部把 delta 细分成小步
 * （每步不超过 radius/2），每小步独立做推开迭代。maxIter 控制单步内
 * 同时挤多面墙的推开次数上限。
 */
export function slide(
  position: Vec2,
  delta: Vec2,
  radius: Cm,
  obstacles: OrientedBox[],
  maxIter = 4,
): Vec2 {
  const len = Math.hypot(delta.x, delta.y);
  const MAX_STEP = Math.max(1, radius * 0.5);
  const steps = Math.max(1, Math.ceil(len / MAX_STEP));
  const stepDelta: Vec2 = { x: delta.x / steps, y: delta.y / steps };

  let pos: Vec2 = { x: position.x, y: position.y };

  for (let i = 0; i < steps; i++) {
    pos = { x: pos.x + stepDelta.x, y: pos.y + stepDelta.y };
    for (let iter = 0; iter < maxIter; iter++) {
      let pushed = false;
      for (const box of obstacles) {
        const r = circleVsOrientedBox(pos, radius, box);
        if (r.overlap > 0) {
          pos = { x: pos.x + r.normal.x * r.overlap, y: pos.y + r.normal.y * r.overlap };
          pushed = true;
        }
      }
      if (!pushed) break;
    }
  }

  return pos;
}
