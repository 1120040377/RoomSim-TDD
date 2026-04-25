import {
  BoxGeometry,
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

// ─── 马桶 ──────────────────────────────────────────────────────────────────────

export function buildToilet(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;   // 0.40
  const D = f.size.depth * CM_TO_M;   // 0.70
  const H = f.size.height * CM_TO_M;  // 0.75

  const matWhite = new MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.3 });

  // 马桶桶身（前段，约占深度前 50%）
  const bowlD = D * 0.50;
  const bowlH = H * 0.56;
  const bowlZ = -(D / 2 - bowlD / 2);
  makeBox(W * 0.90, bowlH, bowlD, matWhite, 0, bowlH / 2, bowlZ, g, true);

  // 座圈（略宽于桶身，薄）
  makeBox(W, 0.04, bowlD + 0.02, matWhite, 0, bowlH + 0.02, bowlZ, g);

  // 水箱（后段）
  const tankD = D * 0.40;
  const tankH = H;
  const tankZ = D / 2 - tankD / 2;
  makeBox(W * 0.95, tankH, tankD, matWhite, 0, tankH / 2, tankZ, g, true);
}

// ─── 洗手池 ────────────────────────────────────────────────────────────────────

export function buildBasin(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;   // 0.60
  const D = f.size.depth * CM_TO_M;   // 0.50
  const H = f.size.height * CM_TO_M;  // 0.85

  const matWhite = new MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 });
  const matInner = new MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

  // 柱脚
  const colW = W * 0.36;
  const colD = D * 0.40;
  const colH = H * 0.76;
  makeBox(colW, colH, colD, matWhite, 0, colH / 2, 0, g);

  // 台沿（较宽）
  const rimH = 0.06;
  const rimY = colH + rimH / 2;
  makeBox(W, rimH, D, matWhite, 0, rimY, 0, g, true);

  // 盆内（深色，嵌入台沿）
  makeBox(W * 0.82, 0.08, D * 0.78, matInner, 0, rimY - 0.02, 0, g);
}

// ─── 淋浴 ──────────────────────────────────────────────────────────────────────

export function buildShower(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;    // 0.90
  const D = f.size.depth * CM_TO_M;    // 0.90
  const H = f.size.height * CM_TO_M;   // 2.00

  const matFloor  = new MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.7 });
  const matGlass  = new MeshStandardMaterial({
    color: 0xc8dce8,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
  });

  // 地台
  const floorH = 0.08;
  makeBox(W, floorH, D, matFloor, 0, floorH / 2, 0, g, true);

  const glassH = H - floorH;
  const glassT = 0.03;
  const glassY = floorH + glassH / 2;

  // 玻璃板 A（沿 X，在 +Z 端）
  makeBox(W, glassH, glassT, matGlass, 0, glassY, D / 2 - glassT / 2, g);
  // 玻璃板 B（沿 Z，在 +X 端）
  makeBox(glassT, glassH, D, matGlass, W / 2 - glassT / 2, glassY, 0, g);
}

// ─── 浴缸 ──────────────────────────────────────────────────────────────────────

export function buildBathtub(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;   // 1.70
  const D = f.size.depth * CM_TO_M;   // 0.80
  const H = f.size.height * CM_TO_M;  // 0.55

  const matShell = new MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 });
  const matWater = new MeshStandardMaterial({ color: 0xc8dde8, roughness: 0.1, metalness: 0.05 });

  // 外壳
  makeBox(W, H, D, matShell, 0, H / 2, 0, g, true);

  // 内盆（顶部与外壳齐平，显示浴缸深度）
  const innerW = W - 0.12;
  const innerD = D - 0.12;
  const innerH = H * 0.64;
  const innerY = H - innerH / 2;
  makeBox(innerW, innerH, innerD, matWater, 0, innerY, 0, g);
}
