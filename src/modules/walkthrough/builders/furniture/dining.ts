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

// ─── 餐桌通用 ──────────────────────────────────────────────────────────────────

function buildDiningTable(g: Group, f: Furniture, legPositions: [number, number][]): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matTop = new MeshStandardMaterial({ color: 0xb8845e, roughness: 0.5 });
  const matLeg = new MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.7 });

  const topH = 0.05;
  makeBox(W, topH, D, matTop, 0, H - topH / 2, 0, g, true);

  const legH = H - topH;
  const legS = 0.05;
  legPositions.forEach(([x, z]) => makeBox(legS, legH, legS, matLeg, x, legH / 2, z, g));
}

export function buildDiningTable4(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const inset = 0.08;
  buildDiningTable(g, f, [
    [-W / 2 + inset, -D / 2 + inset],
    [ W / 2 - inset, -D / 2 + inset],
    [-W / 2 + inset,  D / 2 - inset],
    [ W / 2 - inset,  D / 2 - inset],
  ]);
}

export function buildDiningTable6(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  // 长桌腿放在 1/4 和 3/4 处，而非四角
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const insetD = 0.08;
  buildDiningTable(g, f, [
    [-W / 4, -D / 2 + insetD],
    [ W / 4, -D / 2 + insetD],
    [-W / 4,  D / 2 - insetD],
    [ W / 4,  D / 2 - insetD],
  ]);
}

// ─── 餐椅 ──────────────────────────────────────────────────────────────────────

export function buildDiningChair(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matSeat = new MeshStandardMaterial({ color: 0xb8845e, roughness: 0.7 });
  const matLeg  = new MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.8 });

  const seatH = 0.05;
  const seatY = H * 0.48; // 约 44cm 离地
  const legH  = seatY;
  const legS  = 0.03;
  const inset = 0.03;
  const lx = W / 2 - legS - inset;
  const lz = D / 2 - legS - inset;
  const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
  corners.forEach(([x, z]) => makeBox(legS, legH, legS, matLeg, x, legH / 2, z, g));

  // 座面
  makeBox(W, seatH, D, matSeat, 0, seatY + seatH / 2, 0, g, true);

  // 靠背（+Z 端，从座面到顶）
  const backH = H - seatY - seatH;
  const backD = 0.05;
  makeBox(W - 0.04, backH, backD, matSeat, 0, seatY + seatH + backH / 2, D / 2 - backD / 2, g, true);
}
