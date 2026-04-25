import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';

function makeBox(
  w: number, h: number, d: number,
  mat: MeshStandardMaterial,
  x: number, y: number, z: number,
  g: Group,
  edge = false,
): void {
  const geom = new BoxGeometry(w, h, d);
  const mesh = new Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  if (edge) {
    const ln = new LineSegments(new EdgesGeometry(geom), new LineBasicMaterial({ color: 0x525252 }));
    ln.position.copy(mesh.position);
    g.add(ln);
  }
}

// ─── 沙发通用结构 ──────────────────────────────────────────────────────────────

function buildSofaSection(
  g: Group,
  W: number, D: number,
  cx: number, cz: number,
  backAt: 'minZ' | 'maxZ' | 'minX' | 'maxX',
  arms: ('minX' | 'maxX' | 'minZ' | 'maxZ')[],
  color: string,
): void {
  const matBase = new MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.8 });
  const matFab  = new MeshStandardMaterial({ color: new Color(color), roughness: 0.9 });

  const baseH = 0.14;
  const armW  = 0.20;
  const backD = 0.22;
  const seatH = 0.18;
  const backH = 0.44;

  // 底座
  makeBox(W, baseH, D, matBase, cx, baseH / 2, cz, g);

  const seatY = baseH + seatH / 2;

  // 靠背
  const backY = baseH + seatH + backH / 2;
  if (backAt === 'minZ') {
    makeBox(W, backH, backD, matFab, cx, backY, cz - D / 2 + backD / 2, g);
    makeBox(W, seatH, D - backD, matFab, cx, seatY, cz + backD / 2, g, true);
  } else if (backAt === 'maxZ') {
    makeBox(W, backH, backD, matFab, cx, backY, cz + D / 2 - backD / 2, g);
    makeBox(W, seatH, D - backD, matFab, cx, seatY, cz - backD / 2, g, true);
  } else if (backAt === 'minX') {
    makeBox(backD, backH, D, matFab, cx - W / 2 + backD / 2, backY, cz, g);
    makeBox(W - backD, seatH, D, matFab, cx + backD / 2, seatY, cz, g, true);
  } else {
    makeBox(backD, backH, D, matFab, cx + W / 2 - backD / 2, backY, cz, g);
    makeBox(W - backD, seatH, D, matFab, cx - backD / 2, seatY, cz, g, true);
  }

  // 扶手
  const armH = seatH + backH;
  const armY = baseH + armH / 2;
  for (const arm of arms) {
    if (arm === 'minX') makeBox(armW, armH, D, matFab, cx - W / 2 + armW / 2, armY, cz, g);
    if (arm === 'maxX') makeBox(armW, armH, D, matFab, cx + W / 2 - armW / 2, armY, cz, g);
    if (arm === 'minZ') makeBox(W, armH, armW, matFab, cx, armY, cz - D / 2 + armW / 2, g);
    if (arm === 'maxZ') makeBox(W, armH, armW, matFab, cx, armY, cz + D / 2 - armW / 2, g);
  }
}

export function buildSofa2(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  buildSofaSection(g, W, D, 0, 0, 'maxZ', ['minX', 'maxX'], f.color ?? '#8a8a8a');
}

export function buildSofa3(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  buildSofaSection(g, W, D, 0, 0, 'maxZ', ['minX', 'maxX'], f.color ?? '#8a8a8a');
}

export function buildSofaL(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;   // 2.50
  const D = f.size.depth * CM_TO_M;   // 1.80
  const col = f.color ?? '#8a8a8a';
  const segD = 0.90;

  // A 段：沿 X 轴，靠背在 −Z 端，z∈[−D/2, −D/2+segD]
  const az = -D / 2 + segD / 2;
  buildSofaSection(g, W, segD, 0, az, 'minZ', ['minX', 'maxX'], col);

  // B 段：垂直，靠背在 −X 端，x∈[−W/2, −W/2+segD]，z∈[−D/2+segD, D/2]
  const bW = segD;
  const bD = D - segD;
  const bx = -W / 2 + bW / 2;
  const bz = -D / 2 + segD + bD / 2;
  buildSofaSection(g, bW, bD, bx, bz, 'minX', ['maxZ'], col);
}

export function buildArmchair(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  buildSofaSection(g, W, D, 0, 0, 'maxZ', ['minX', 'maxX'], f.color ?? '#8a8a8a');
}

// ─── 茶几 ──────────────────────────────────────────────────────────────────────

export function buildCoffeeTable(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matTop  = new MeshStandardMaterial({ color: 0xc8a96e, roughness: 0.5 });
  const matLeg  = new MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.7 });

  const topH = 0.05;
  makeBox(W, topH, D, matTop, 0, H - topH / 2, 0, g, true);

  const legH = H - topH;
  const legS = 0.04;
  const lx = W / 2 - legS - 0.02;
  const lz = D / 2 - legS - 0.02;
  const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
  corners.forEach(([x, z]) => makeBox(legS, legH, legS, matLeg, x, legH / 2, z, g));
}

// ─── 电视柜 ────────────────────────────────────────────────────────────────────

export function buildTvCabinet(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matBody  = new MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.7 });
  const matDiv   = new MeshStandardMaterial({ color: 0x2d2d2d, roughness: 0.5 });
  const matMetal = new MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.3, metalness: 0.7 });

  makeBox(W, H - 0.04, D, matBody, 0, (H - 0.04) / 2, 0, g, true);
  makeBox(W, 0.04, D, matBody, 0, H - 0.02, 0, g);

  // 分隔条（3 区）
  makeBox(0.02, H - 0.08, 0.03, matDiv, -W / 3, (H - 0.08) / 2, -(D / 2 + 0.015), g);
  makeBox(0.02, H - 0.08, 0.03, matDiv,  W / 3, (H - 0.08) / 2, -(D / 2 + 0.015), g);

  // 把手 ×3
  for (const hx of [-W / 3 * 1.5, 0, W / 3 * 1.5]) {
    makeBox(0.24, 0.03, 0.02, matMetal, hx, H / 2, -(D / 2 + 0.025), g);
  }
}

// ─── 电视 ──────────────────────────────────────────────────────────────────────

export function buildTv(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const H = f.size.height * CM_TO_M;
  const D = f.size.depth * CM_TO_M;

  const matFrame  = new MeshStandardMaterial({ color: 0x2d2d2d, roughness: 0.5 });
  const matScreen = new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.1, metalness: 0.3 });
  const matStand  = new MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 });

  const frameY = H / 2;
  makeBox(W, H, D, matFrame, 0, frameY, 0, g);
  makeBox(W - 0.06, H - 0.06, 0.02, matScreen, 0, frameY, -(D / 2 + 0.01), g);

  // 底座颈
  makeBox(0.04, 0.20, 0.04, matStand, 0, 0.10, -(D / 2 + 0.06), g);
  // 底座脚
  makeBox(0.45, 0.04, 0.18, matStand, 0, 0.02, -(D / 2 + 0.12), g);
}

// ─── 书架 ──────────────────────────────────────────────────────────────────────

export function buildBookshelf(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matShelf = new MeshStandardMaterial({ color: 0xc4a265, roughness: 0.7 });
  const matShelfInner = new MeshStandardMaterial({ color: 0xb09050, roughness: 0.7 });

  const t = 0.03; // 板厚

  // 背板
  makeBox(W, H, t, matShelf, 0, H / 2, D / 2 - t / 2, g);
  // 左右侧板
  makeBox(t, H, D, matShelf, -W / 2 + t / 2, H / 2, 0, g);
  makeBox(t, H, D, matShelf,  W / 2 - t / 2, H / 2, 0, g);
  // 顶底板
  makeBox(W - t * 2, t, D, matShelf, 0, H - t / 2, 0, g, true);
  makeBox(W - t * 2, t, D, matShelf, 0, t / 2, 0, g);

  // 隔板 ×4
  const innerH = H - t * 2;
  const shelfCount = 4;
  for (let i = 1; i <= shelfCount; i++) {
    const sy = t + (innerH / (shelfCount + 1)) * i;
    makeBox(W - t * 2, t, D - t, matShelfInner, 0, sy, -t / 2, g);
  }
}
