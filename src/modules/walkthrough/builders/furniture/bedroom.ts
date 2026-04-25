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
import { buildDefaultBox } from './shared';

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

// ─── 床通用结构 ────────────────────────────────────────────────────────────────

function buildBedBody(
  g: Group,
  f: Furniture,
  pillowCount: number,
  legSize: number,
): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;

  const matWoodDark = new MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.8 });
  const matWood     = new MeshStandardMaterial({ color: 0x7a5230, roughness: 0.7 });
  const matMattress = new MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.9 });
  const matPillow   = new MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.95 });
  const matBlanket  = new MeshStandardMaterial({ color: new Color(f.color ?? '#d4b895'), roughness: 0.85 });

  const ls = legSize * CM_TO_M;
  const legH = 0.22;
  const lx = W / 2 - ls;
  const lz = D / 2 - ls;
  const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
  corners.forEach(([x, z]) => makeBox(ls, legH, ls, matWoodDark, x, legH / 2, z, g));

  const baseH = 0.10;
  const baseY = legH + baseH / 2;
  makeBox(W - 0.10, baseH, D - 0.15, matWood, 0, baseY, 0.05, g);

  const hbH = 0.68;
  const hbThick = 0.08;
  makeBox(W, hbH, hbThick, matWood, 0, hbH / 2, -(D / 2 - hbThick / 2), g);

  const mattH = 0.18;
  const mattD = D - hbThick - 0.06;
  const mattZOff = D / 2 - mattD / 2 - hbThick / 2;
  const mattY = legH + baseH + mattH / 2;
  makeBox(W - 0.04, mattH, mattD, matMattress, 0, mattY, -mattZOff, g, true);

  const pillowH = 0.12;
  const pillowY = legH + baseH + mattH + pillowH / 2;
  const pillowZ = -(D / 2 - hbThick - 0.28);
  const pillowW = (W - 0.10) / pillowCount - 0.04;
  if (pillowCount === 1) {
    makeBox(pillowW, pillowH, 0.42, matPillow, 0, pillowY, pillowZ, g);
  } else {
    const spacing = W / pillowCount;
    for (let i = 0; i < pillowCount; i++) {
      const px = -W / 2 + spacing * (i + 0.5);
      makeBox(pillowW, pillowH, 0.42, matPillow, px, pillowY, pillowZ, g);
    }
  }

  const blanketH = 0.06;
  const blanketD = mattD * 0.65;
  const mattFoot = -mattZOff + mattD / 2;
  const blanketZ = mattFoot - blanketD / 2;
  const blanketY = legH + baseH + mattH + blanketH / 2;
  makeBox(W - 0.06, blanketH, blanketD, matBlanket, 0, blanketY, blanketZ, g, true);
}

export function buildBedSingle(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  buildBedBody(g, f, 1, 4);
}

export function buildBedDouble(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  buildBedBody(g, f, 2, 5);
}

export function buildBedKingsize(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  buildBedBody(g, f, 2, 6);
}

// ─── 衣柜 ──────────────────────────────────────────────────────────────────────

function buildWardrobe(g: Group, f: Furniture, doorCount: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matBody  = new MeshStandardMaterial({ color: 0x8c6b3f, roughness: 0.7 });
  const matDoor  = new MeshStandardMaterial({ color: 0xa07a4a, roughness: 0.6 });
  const matMetal = new MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.4, metalness: 0.6 });

  // 柜体
  makeBox(W, H, D, matBody, 0, H / 2, 0, g);
  // 顶线
  makeBox(W, 0.06, D, matBody, 0, H + 0.03, 0, g);
  // 底座线
  makeBox(W, 0.08, D, matBody, 0, 0.04, 0, g);

  // 门板 + 把手
  const doorW = (W - 0.01 * (doorCount - 1)) / doorCount;
  for (let i = 0; i < doorCount; i++) {
    const dx = -W / 2 + doorW * (i + 0.5) + 0.005 * i;
    makeBox(doorW - 0.01, H - 0.12, 0.03, matDoor, dx, H / 2, -(D / 2 + 0.015), g);
    // 把手（内侧边缘）
    const handleX = i < doorCount / 2
      ? dx + doorW / 2 - 0.04  // 左侧门在右边
      : dx - doorW / 2 + 0.04; // 右侧门在左边
    makeBox(0.02, 0.18, 0.02, matMetal, handleX, H / 2, -(D / 2 + 0.04), g);
  }
}

export function buildWardrobe2(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  buildWardrobe(g, f, 2);
}

export function buildWardrobe3(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  buildWardrobe(g, f, 3);
}

// ─── 床头柜 ────────────────────────────────────────────────────────────────────

export function buildSideTable(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matWood  = new MeshStandardMaterial({ color: 0xa07a4a, roughness: 0.7 });
  const matDark  = new MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.8 });
  const matMetal = new MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.4, metalness: 0.6 });

  const legH = H * 0.32;
  const legS = 0.03;
  const lx = W / 2 - legS;
  const lz = D / 2 - legS;
  const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
  corners.forEach(([x, z]) => makeBox(legS, legH, legS, matDark, x, legH / 2, z, g));

  // 柜身
  const bodyH = H - legH - 0.04;
  const bodyY = legH + bodyH / 2;
  makeBox(W - 0.02, bodyH, D - 0.02, matWood, 0, bodyY, 0, g, true);

  // 抽屉面
  makeBox(W - 0.06, bodyH * 0.35, 0.02, matWood, 0, bodyY, -(D / 2 + 0.01), g);

  // 把手
  makeBox(0.12, 0.015, 0.015, matMetal, 0, bodyY, -(D / 2 + 0.025), g);

  // 桌面
  makeBox(W, 0.04, D, matWood, 0, H - 0.02, 0, g, true);
}

// 兜底
export function _buildDefaultBedroom(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}
