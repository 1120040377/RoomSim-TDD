import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';

const SKIN = 0xe8c49a;

function skinMat(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: SKIN, roughness: 0.78 });
  m.depthTest = false;
  return m;
}

function addPart(
  g: Group,
  geom: BoxGeometry | CylinderGeometry | SphereGeometry,
  x: number, y: number, z: number,
  rx = 0, rz = 0,
): void {
  const mesh = new Mesh(geom, skinMat());
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, 0, rz);
  mesh.renderOrder = 999;
  mesh.frustumCulled = false;
  g.add(mesh);
}

/**
 * 构建第一人称手臂，挂在 camera 子节点。
 *
 * 相机局部坐标：+x 右  +y 上  -z 前方
 *
 * FOV=70° + 16:9，z=0.28m 处可见范围约 ±0.11m(Y)。
 * 腕部定于 y=-0.07（视野下方 64%），手掌向 -Z 方向延伸可见。
 * 前臂/上臂向 -Y 延伸出屏幕外，frustumCulled=false 防裁剪。
 *
 * 关节连接方式：
 *   rotation.z = rz 时，圆柱 +Y/2 端点偏移为 (-sin(rz)·h/2, cos(rz)·h/2)
 *   → 中心 = 上端 + (sin(rz)·h/2, -cos(rz)·h/2)
 *   → 下端 = 上端 + (sin(rz)·h, -cos(rz)·h)
 */
export function buildFirstPersonArms(): Group {
  const arms = new Group();
  arms.name = 'fp-arms';
  arms.add(buildOneArm('right'));
  arms.add(buildOneArm('left'));
  return arms;
}

function buildOneArm(side: 'left' | 'right'): Group {
  const g = new Group();
  g.name = `fp-arm-${side}`;
  const s = side === 'right' ? 1 : -1;

  // ── 腕部锚点（相机坐标系） ──────────────────────────────────────
  const wx = s * 0.17;
  const wy = -0.07;
  const wz = -0.28;

  const tiltFA = s * 0.12; // 前臂 rz（向外倾）
  const tiltUA = s * 0.18; // 上臂 rz（更倾）
  const faH = 0.22;
  const uaH = 0.22;

  // ── 手掌：从腕部向 -Z（前方）延伸，与前臂同方向 ──────────────────
  // Box 中心在腕前 0.04m，后端与腕对齐
  addPart(g,
    new BoxGeometry(0.08, 0.040, 0.10),
    wx, wy, wz - 0.04,
    0, tiltFA,
  );

  // ── 腕关节球（手掌 ↔ 前臂的过渡） ─────────────────────────────────
  addPart(g, new SphereGeometry(0.026, 8, 6), wx, wy, wz);

  // ── 前臂：从腕向 -Y 延伸 ───────────────────────────────────────────
  // 中心 = 腕 + (sin·h/2, -cos·h/2)
  const faCX = wx + Math.sin(tiltFA) * faH / 2;
  const faCY = wy - Math.cos(tiltFA) * faH / 2;
  addPart(g, new CylinderGeometry(0.020, 0.026, faH, 8), faCX, faCY, wz, 0, tiltFA);

  // ── 肘关节球（前臂 ↔ 上臂） ────────────────────────────────────────
  // 肘 = 腕 + (sin·h, -cos·h)
  const elbX = wx + Math.sin(tiltFA) * faH;
  const elbY = wy - Math.cos(tiltFA) * faH;
  addPart(g, new SphereGeometry(0.030, 8, 6), elbX, elbY, wz);

  // ── 上臂：从肘继续向 -Y 延伸出屏幕 ───────────────────────────────
  const uaCX = elbX + Math.sin(tiltUA) * uaH / 2;
  const uaCY = elbY - Math.cos(tiltUA) * uaH / 2;
  addPart(g, new CylinderGeometry(0.026, 0.030, uaH, 8), uaCX, uaCY, wz, 0, tiltUA);

  return g;
}
