import { CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, TorusGeometry, Vector2 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';
import { fabricMaterial, metalMaterial, paintedMaterial, porcelainMaterial, woodMaterial } from './material-library';
import { addCylinder, addRoundedBox } from './primitives';
import { buildTailoredSofa, buildTailoredSectional } from './upholstery';
import { buildModelArmchair } from './model-armchair';
import { buildTelevision } from './television';

function makeBox(
  w: number, h: number, d: number,
  mat: MeshStandardMaterial,
  x: number, y: number, z: number,
  g: Group,
  _edge = false,
): void {
  addRoundedBox(g, w, h, d, mat, x, y, z);
}


export function buildSofa2(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  buildTailoredSofa(g, W, D, f.size.height * CM_TO_M, f.color ?? '#d9d0bf');
}

export function buildSofa3(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  buildTailoredSofa(g, W, D, f.size.height * CM_TO_M, f.color ?? '#d9d0bf');
}

export function buildSofaL(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  buildTailoredSectional(g, f.size.width * CM_TO_M, f.size.depth * CM_TO_M,
    f.size.height * CM_TO_M, f.color ?? '#d9d0bf');
}

export function buildArmchair(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  if(buildModelArmchair(g,f))return;
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  buildTailoredSofa(g, W, D, f.size.height * CM_TO_M, f.color ?? '#d9d0bf', false);
}

// ─── 茶几 ──────────────────────────────────────────────────────────────────────

export function buildCoffeeTable(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matTop = woodMaterial(f.color ?? '#bd9c73', 3);

  const topH = Math.min(0.04,H*0.15), legH=H-topH;
  const bevel=topH*0.18;
  const profile=[[0,H-topH],[0.485,H-topH],[0.5,H-topH+bevel],[0.5,H-bevel],[0.493,H-bevel*0.25],[0.48,H],[0,H]];
  const topGeometry=new LatheGeometry(profile.map(([r,y])=>new Vector2(r,y)),64);
  topGeometry.scale(W,1,D);
  const positions=topGeometry.getAttribute('position'),uv=topGeometry.getAttribute('uv');
  // Planar metre-space grain across the top, not radial lathe UVs.
  for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i)+W/2,positions.getZ(i)+D/2);
  const tabletop=new Mesh(topGeometry,matTop);tabletop.castShadow=tabletop.receiveShadow=true;g.add(tabletop);
  for(const angle of [Math.PI/6,Math.PI*5/6,Math.PI*1.5]){
    const legGeometry=new CylinderGeometry(0.034,0.02,legH,16),p=legGeometry.getAttribute('position');
    for(let i=0;i<p.count;i++){
      const spread=0.5-p.getY(i)/legH;
      p.setX(i,p.getX(i)+Math.cos(angle)*W*0.07*spread);
      p.setZ(i,p.getZ(i)+Math.sin(angle)*D*0.07*spread);
    }
    legGeometry.computeVertexNormals();
    const leg=new Mesh(legGeometry,matTop);leg.position.set(Math.cos(angle)*W*0.27,legH/2,Math.sin(angle)*D*0.27);
    leg.castShadow=leg.receiveShadow=true;g.add(leg);
  }
  // A book and ceramic tray act as scale cues and make the sample room feel occupied.
  const cover = fabricMaterial('#a9ad95', 8);
  makeBox(0.28, 0.003, 0.18, cover, -W * 0.16, H + 0.0015, 0.03, g);
  makeBox(0.272, 0.012, 0.172, paintedMaterial('#e9e3d5', 0.95), -W * 0.16, H + 0.009, 0.03, g);
  makeBox(0.28, 0.003, 0.18, cover, -W * 0.16, H + 0.0165, 0.03, g);
  const ceramic=porcelainMaterial('#ddd6c6');
  const cupProfile=[[0,0],[0.027,0],[0.036,0.008],[0.043,0.069],[0.042,0.075],[0.037,0.075],[0.031,0.014],[0,0.014]];
  const cup=new Mesh(new LatheGeometry(cupProfile.map(([r,y])=>new Vector2(r,y)),24),ceramic);
  cup.position.set(W*0.17,H+0.006,-0.03);cup.castShadow=cup.receiveShadow=true;g.add(cup);
  const handle=new Mesh(new TorusGeometry(0.022,0.005,8,20),ceramic);
  handle.position.set(W*0.17+0.044,H+0.048,-0.03);handle.castShadow=handle.receiveShadow=true;g.add(handle);
  addCylinder(g,0.059,0.055,0.006,ceramic,W*0.17,H+0.003,-0.03,32);
}

// ─── 电视柜 ────────────────────────────────────────────────────────────────────

export function buildTvCabinet(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matBody = woodMaterial('#765635', 4);
  const matDiv = paintedMaterial('#393a37', 0.54);
  const matMetal = metalMaterial('#8b8f8c', 0.26);

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
  buildTelevision(g, f);
}

// ─── 书架 ──────────────────────────────────────────────────────────────────────

export function buildBookshelf(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matShelf = woodMaterial('#af8752', 5);
  const matShelfInner = woodMaterial('#8e6d42', 6);

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
