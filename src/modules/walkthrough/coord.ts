import { Vector3 } from 'three';
import type { Cm, Vec2 } from '@/modules/model/types';

export const CM_TO_M = 0.01;

/**
 * 2D（编辑器俯视）→ 3D 坐标约定：
 *  editor.x  → three.x
 *  editor.y  → three.z   （编辑器 y 向下 = 3D 远离相机默认方向 -z 的反向；
 *                          实际采用"同号映射"，见下方 rotation 约定）
 *  heightCm  → three.y
 *  单位 cm → m   （CM_TO_M）
 *
 * 墙方向 angle = atan2(dy, dx) in editor → mesh.rotation.y = -angle
 * 推导：BoxGeometry 默认沿 +x；绕 y 右手旋转 -angle 后 mesh 局部 +x
 * 映射到世界 (cos(-a), 0, -sin(-a)) = (cos a, 0, sin a)，即沿 editor 中
 * 同方向的 (dx, 0, dy) 向量。保证 2D 中沿 +y 的墙在 3D 中沿 +z 延伸。
 */
export function toWorld(p2d: Vec2, heightCm: Cm = 0): Vector3 {
  return new Vector3(p2d.x * CM_TO_M, heightCm * CM_TO_M, p2d.y * CM_TO_M);
}

/** 编辑器角度（atan2(dy, dx)）→ 3D 绕 y 的旋转弧度 */
export function toYawFromEditorAngle(angleRad: number): number {
  return -angleRad;
}

/** 墙方向 angle 的计算（基于 editor 坐标）*/
export function wallAngle(start: Vec2, end: Vec2): number {
  return Math.atan2(end.y - start.y, end.x - start.x);
}

/** 2D 向量长度（cm）*/
export function wallLengthCm(start: Vec2, end: Vec2): Cm {
  return Math.hypot(end.x - start.x, end.y - start.y);
}
