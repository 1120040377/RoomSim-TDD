import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';
import { fabricMaterial, metalMaterial, woodMaterial } from './material-library';
import { addRoundedBox } from './primitives';

function makeBox(
  w: number, h: number, d: number,
  mat: MeshStandardMaterial,
  x: number, y: number, z: number,
  g: Group,
  _edge = false,
): void {
  addRoundedBox(g, w, h, d, mat, x, y, z);
}

// ─── 书桌 ──────────────────────────────────────────────────────────────────────

export function buildDesk(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matTop = woodMaterial('#b28c62', 20);
  const matLeg = woodMaterial('#4c3729', 21);

  const topH = 0.04;
  makeBox(W, topH, D, matTop, 0, H - topH / 2, 0, g, true);

  const legH = H - topH;
  const legS = 0.04;
  const inset = 0.05;
  const lx = W / 2 - legS - inset;
  const lz = D / 2 - legS - inset;
  const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
  corners.forEach(([x, z]) => makeBox(legS, legH, legS, matLeg, x, legH / 2, z, g));
}

// ─── 办公椅 ────────────────────────────────────────────────────────────────────

export function buildOfficeChair(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const H = f.size.height * CM_TO_M;
  const D = f.size.depth * CM_TO_M;

  const matBase = metalMaterial('#222725', 0.42);
  const matPole = metalMaterial('#3d4541', 0.28);
  const matSeat = fabricMaterial('#55635c', 22);

  // 底盘（扁圆柱）
  const baseMesh = new Mesh(new CylinderGeometry(W * 0.42, W * 0.42, 0.05, 24), matBase);
  baseMesh.position.set(0, 0.025, 0);
  g.add(baseMesh);

  // 气杆
  const poleH = H * 0.42;
  const poleMesh = new Mesh(new CylinderGeometry(0.03, 0.03, poleH, 12), matPole);
  poleMesh.position.set(0, 0.05 + poleH / 2, 0);
  g.add(poleMesh);

  // 座垫
  const seatH = 0.12;
  const seatY = 0.05 + poleH + seatH / 2;
  makeBox(W * 0.92, seatH, D * 0.92, matSeat, 0, seatY, 0, g, true);

  // 靠背（+Z 端，从座面往上）
  const backH = H - (0.05 + poleH + seatH);
  const backThick = 0.10;
  const backY = seatY + seatH / 2 + backH / 2;
  const backZ = D / 2 - backThick / 2;
  makeBox(W * 0.84, backH, backThick, matSeat, 0, backY, backZ, g, true);
}
