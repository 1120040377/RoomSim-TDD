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

export function buildBedSingle(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildBedDouble(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;   // 1.50m
  const D = f.size.depth * CM_TO_M;   // 2.00m

  const matWoodDark = new MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.8 });
  const matWood     = new MeshStandardMaterial({ color: 0x7a5230, roughness: 0.7 });
  const matMattress = new MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.9 });
  const matPillow   = new MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.95 });
  const matBlanket  = new MeshStandardMaterial({ color: new Color(f.color ?? '#d4b895'), roughness: 0.85 });

  function addBox(
    w: number, h: number, d: number,
    mat: MeshStandardMaterial,
    x: number, y: number, z: number,
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

  // 床腿（四角）
  const legH = 0.22;
  const legS = 0.05;
  const lx = W / 2 - 0.06;
  const lz = D / 2 - 0.06;
  const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
  corners.forEach(([x, z]) => addBox(legS, legH, legS, matWoodDark, x, legH / 2, z));

  // 床板底座
  const baseH = 0.10;
  const baseY = legH + baseH / 2;
  addBox(W - 0.10, baseH, D - 0.15, matWood, 0, baseY, 0.05);

  // 床头板（−Z 端）
  const hbH = 0.68;
  const hbThick = 0.08;
  addBox(W, hbH, hbThick, matWood, 0, hbH / 2, -(D / 2 - hbThick / 2));

  // 床垫（贴着床头板到脚端）
  const mattH = 0.18;
  const mattD = D - hbThick - 0.06;
  const mattZ = D / 2 - mattD / 2 - hbThick / 2;  // 脚端对齐，头端留给床头板
  const mattY = legH + baseH + mattH / 2;
  addBox(W - 0.04, mattH, mattD, matMattress, 0, mattY, -mattZ, true);

  // 枕头 ×2（靠头端）
  const pillowH = 0.12;
  const pillowY = legH + baseH + mattH + pillowH / 2;
  const pillowZ = -(D / 2 - hbThick - 0.28);
  addBox(0.60, pillowH, 0.42, matPillow, -W / 4, pillowY, pillowZ);
  addBox(0.60, pillowH, 0.42, matPillow,  W / 4, pillowY, pillowZ);

  // 被子（覆盖脚端 65%）
  const blanketH = 0.06;
  const blanketD = mattD * 0.65;
  const mattFoot = -mattZ + mattD / 2;  // 床垫脚端 z 坐标
  const blanketZ = mattFoot - blanketD / 2;
  const blanketY = legH + baseH + mattH + blanketH / 2;
  addBox(W - 0.06, blanketH, blanketD, matBlanket, 0, blanketY, blanketZ, true);
}

export function buildBedKingsize(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildWardrobe2(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildWardrobe3(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildSideTable(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}
