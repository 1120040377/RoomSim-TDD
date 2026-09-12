import { Box3, Group, MeshStandardMaterial } from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';
import { buildDefaultBox } from './shared';
import { fabricMaterial, metalMaterial, woodMaterial } from './material-library';
import { addCylinder, addRoundedBox } from './primitives';
import { cushion, throwPillow } from './upholstery';
import { addDuvet } from './bedding';
import {buildDrapedThrow} from './model-throw';

function makeBox(
  w: number, h: number, d: number,
  mat: MeshStandardMaterial,
  x: number, y: number, z: number,
  g: Group,
  _edge = false,
): void {
  addRoundedBox(g, w, h, d, mat, x, y, z);
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

  const matWoodDark = woodMaterial('#422d20', 2);
  const matWood = woodMaterial('#74553a', 3);
  const matMattress = fabricMaterial('#e9e3d8', 4);
  const matPillow = fabricMaterial('#f4f0e7', 5);

  const ls = legSize * CM_TO_M;
  const deck = f.size.height * CM_TO_M;
  const legH = deck * 0.3;
  const lx = W / 2 - ls;
  const lz = D / 2 - ls;
  const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
  corners.forEach(([x, z]) => addCylinder(g, ls * 0.56, ls * 0.72, legH, matWoodDark, x, legH / 2, z, 12));

  const baseH = deck * 0.25;
  const baseY = legH + baseH / 2;
  makeBox(W - 0.10, baseH, D - 0.15, matWood, 0, baseY, 0.05, g);

  const hbH = deck * 1.65;
  const hbThick = 0.08;
  makeBox(W, hbH, hbThick, matWood, 0, hbH / 2, -(D / 2 - hbThick / 2), g);
  cushion(g, W * 0.88, hbH * 0.7, 0.06, fabricMaterial('#b6aa96', 13), 0, hbH * 0.6, -D / 2 + hbThick + 0.02, 18);

  const mattH = deck * 0.45;
  const mattD = D - hbThick - 0.06;
  const mattZOff = D / 2 - mattD / 2 - hbThick / 2;
  const mattY = legH + baseH + mattH / 2;
  cushion(g, W - 0.09, mattH, mattD, matMattress, 0, mattY, -mattZOff, 16);

  const pillowH = 0.22;
  const pillowY = legH + baseH + mattH + pillowH / 2;
  const pillowZ = -(D / 2 - hbThick - 0.28);
  const pillowW = Math.min(0.68,(W - 0.10) / pillowCount - 0.05);
  for (let i = 0; i < pillowCount; i++) {
    const px = (i-(pillowCount-1)/2)*(pillowW+0.045);
    const pillow = throwPillow(g,pillowW,0.48,pillowH,matPillow,px,pillowY,pillowZ+(i%2)*0.035,17+i);
    pillow.name='bed-pillow';
    pillow.rotation.set(-Math.PI/2+0.55,i===0?-0.055:0.075,i===0?0.035:-0.035);
    // Fit the tilted lower surface to the mattress, rather than floating the
    // pillow by half its nominal thickness after changing its orientation.
    pillow.position.y += deck - 0.008 - new Box3().setFromObject(pillow,true).min.y;
  }

  const blanketD = mattD * 0.65;
  const mattFoot = -mattZOff + mattD / 2;
  addDuvet(g, W - 0.02, blanketD, deck, mattFoot, '#e3dccf');
  if(!buildDrapedThrow(g,W,deck,mattFoot,f.color??'#879a7a'))
    addDuvet(g, W - 0.01, blanketD * 0.48, deck + 0.028, mattFoot + 0.008, f.color ?? '#879a7a','throw');
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

  const matBody = woodMaterial('#785e3f', 9);
  const matDoor = woodMaterial('#9d784d', 10);
  const matMetal = metalMaterial('#a4a29a', 0.3);

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

  const matWood = woodMaterial('#a27a4b', 11);
  const matDark = woodMaterial('#533c28', 12);
  const matMetal = metalMaterial('#a4a29a', 0.3);

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
