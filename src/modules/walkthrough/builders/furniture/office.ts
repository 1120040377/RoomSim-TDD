import {
  BoxGeometry,
  CylinderGeometry,
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

// ─── 书桌 ──────────────────────────────────────────────────────────────────────

export function buildDesk(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matTop = new MeshStandardMaterial({ color: 0xc4a265, roughness: 0.5 });
  const matLeg = new MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.7 });

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

  const matBase = new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const matPole = new MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.5 });
  const matSeat = new MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });

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
