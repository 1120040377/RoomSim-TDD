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

function makeCylinder(
  rTop: number, rBot: number, h: number,
  mat: MeshStandardMaterial,
  x: number, y: number, z: number,
  g: Group,
): void {
  const mesh = new Mesh(new CylinderGeometry(rTop, rBot, h, 20), mat);
  mesh.position.set(x, y, z);
  g.add(mesh);
}

// ─── 冰箱 ──────────────────────────────────────────────────────────────────────

export function buildFridge(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matBody   = new MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3, metalness: 0.1 });
  const matFreeze = new MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.3, metalness: 0.1 });
  const matDiv    = new MeshStandardMaterial({ color: 0x555555, roughness: 0.5 });
  const matHandle = new MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.2, metalness: 0.8 });

  const freezeH = H * 0.33;
  const bodyH   = H - freezeH;

  makeBox(W, bodyH, D, matBody,   0, bodyH / 2,       0, g, true);
  makeBox(W, freezeH, D, matFreeze, 0, bodyH + freezeH / 2, 0, g, true);
  // 分隔条
  makeBox(W, 0.025, 0.02, matDiv, 0, bodyH, -(D / 2 + 0.01), g);
  // 把手 ×2
  makeBox(0.035, 0.36, 0.025, matHandle, W / 2 - 0.06, bodyH * 0.55, -(D / 2 + 0.02), g);
  makeBox(0.035, 0.22, 0.025, matHandle, W / 2 - 0.06, bodyH + freezeH * 0.5, -(D / 2 + 0.02), g);
}

// ─── 灶台 ──────────────────────────────────────────────────────────────────────

export function buildStove(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matBody    = new MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 });
  const matCounter = new MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.3, metalness: 0.4 });
  const matBurner  = new MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });

  const counterH = 0.04;
  const bodyH = H - counterH;

  makeBox(W, bodyH, D, matBody, 0, bodyH / 2, 0, g, true);
  makeBox(W + 0.02, counterH, D + 0.02, matCounter, 0, bodyH + counterH / 2, 0, g, true);

  // 燃烧圈 ×4
  const burnerY = bodyH + counterH + 0.01;
  const bx = W * 0.25;
  const bz = D * 0.22;
  for (const [x, z] of [[-bx, -bz], [bx, -bz], [-bx, bz], [bx, bz]] as [number, number][]) {
    makeCylinder(0.08, 0.08, 0.02, matBurner, x, burnerY, z, g);
  }
}

// ─── 水槽 ──────────────────────────────────────────────────────────────────────

export function buildSink(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matBody    = new MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 });
  const matCounter = new MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.4 });
  const matBasin   = new MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.3, metalness: 0.5 });
  const matInner   = new MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

  const counterH = 0.04;
  const bodyH = H - counterH;
  makeBox(W, bodyH, D, matBody, 0, bodyH / 2, 0, g, true);
  makeBox(W + 0.02, counterH, D + 0.02, matCounter, 0, bodyH + counterH / 2, 0, g, true);

  // 盆沿
  const basinTopY = bodyH + counterH + 0.015;
  makeBox(W * 0.72, 0.03, D * 0.65, matBasin, 0, basinTopY, 0, g);
  // 盆内（深色，显示深度感）
  makeBox(W * 0.64, 0.06, D * 0.56, matInner, 0, basinTopY - 0.02, 0, g);
}

// ─── 橱柜 ──────────────────────────────────────────────────────────────────────

export function buildKitchenCounter(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matBody    = new MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 });
  const matCounter = new MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.4 });
  const matPanel   = new MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
  const matMetal   = new MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.3, metalness: 0.6 });

  const counterH = 0.05;
  const plinthH  = 0.08;
  const bodyH = H - counterH - plinthH;

  makeBox(W, plinthH, D, matBody, 0, plinthH / 2, 0, g);
  makeBox(W, bodyH, D, matBody, 0, plinthH + bodyH / 2, 0, g, true);
  makeBox(W + 0.02, counterH, D + 0.02, matCounter, 0, plinthH + bodyH + counterH / 2, 0, g, true);

  // 抽屉面 ×2（上下分布）
  const panelZ = -(D / 2 + 0.01);
  makeBox(W - 0.04, bodyH * 0.42, 0.02, matPanel, 0, plinthH + bodyH * 0.76, panelZ, g);
  makeBox(W - 0.04, bodyH * 0.42, 0.02, matPanel, 0, plinthH + bodyH * 0.30, panelZ, g);

  // 把手 ×2
  makeBox(W * 0.5, 0.02, 0.02, matMetal, 0, plinthH + bodyH * 0.76, panelZ - 0.02, g);
  makeBox(W * 0.5, 0.02, 0.02, matMetal, 0, plinthH + bodyH * 0.30, panelZ - 0.02, g);
}
