import { CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Path, Shape, TubeGeometry, Vector3 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';
import { metalMaterial, paintedMaterial, stoneMaterial } from './material-library';
import { addRoundedBox } from './primitives';
import { basinShellGeometry } from './basin-shell';
import { addWaterOutlet } from '../../water-effect';

function makeBox(
  w: number, h: number, d: number,
  mat: MeshStandardMaterial,
  x: number, y: number, z: number,
  g: Group,
  _edge = false,
): void {
  addRoundedBox(g, w, h, d, mat, x, y, z);
}

function makeCylinder(
  rTop: number, rBot: number, h: number,
  mat: MeshStandardMaterial,
  x: number, y: number, z: number,
  g: Group,
): void {
  const mesh = new Mesh(new CylinderGeometry(rTop, rBot, h, 20), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
}

// ─── 冰箱 ──────────────────────────────────────────────────────────────────────

export function buildFridge(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matBody = metalMaterial('#dce1df', 0.3);
  const matFreeze = metalMaterial('#cbd2d0', 0.34);
  const matDiv = paintedMaterial('#525957', 0.48);
  const matHandle = metalMaterial('#afb7b4', 0.2);

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

  const matBody = paintedMaterial(f.color ?? '#a4ad98', 0.62);
  const matCounter = stoneMaterial('#d5d0c5');
  const matBurner = paintedMaterial('#262b2a', 0.7);
  // Opaque enamel/glass avoids a screen-space transmission render pass.
  const enamel = paintedMaterial('#151c1c', 0.22);
  const steel = metalMaterial('#9ca7a4', 0.3);

  const counterH = 0.04;
  const bodyH = H - counterH;

  const toeHeight=Math.min(.075,bodyH*.15);
  makeBox(W, bodyH-toeHeight, D, matBody, 0, toeHeight+(bodyH-toeHeight)/2, 0, g, true);
  makeBox(W, counterH, D, matCounter, 0, bodyH + counterH / 2, 0, g, true);
  makeBox(W*0.88,0.008,D*0.84,enamel,0,H+0.004,0,g);
  // Recessed toe kick, oven frame, dark glazed door and an independent handle.
  makeBox(W*0.91,toeHeight,D*.9,matBurner,0,toeHeight/2,D*.05,g);
  makeBox(W*0.87,H*0.73,0.016,steel,0,H*0.49,-D/2-0.009,g);
  makeBox(W*0.79,H*0.51,0.018,enamel,0,H*0.43,-D/2-0.022,g);
  makeBox(W*0.65,0.022,0.035,steel,0,H*0.68,-D/2-0.045,g);
  for(const x of [-0.3,-0.1,0.1,0.3]) {
    const knob=new Mesh(new CylinderGeometry(W*0.026,W*0.026,0.024,16),steel);
    knob.rotation.x=Math.PI/2;knob.position.set(W*x,H*0.8,-D/2-0.034);
    knob.castShadow=knob.receiveShadow=true;g.add(knob);
  }

  // 燃烧圈 ×4
  const burnerY = bodyH + counterH + 0.01;
  const bx = W * 0.25;
  const bz = D * 0.22;
  for (const [x, z] of [[-bx, -bz], [bx, -bz], [-bx, bz], [bx, bz]] as [number, number][]) {
    const radius=Math.min(W,D)*(x<0?0.105:0.085);
    makeCylinder(radius, radius, 0.02, matBurner, x, burnerY, z, g);
    // Four separated supports leave the burner cap visible between them.
    const reach=Math.min(W,D)*0.12;
    for(const side of [-1,1]) {
      makeBox(reach,0.018,0.012,matBurner,x+side*reach*0.62,H+0.034,z,g);
      makeBox(0.012,0.018,reach,matBurner,x,H+0.034,z+side*reach*0.62,g);
    }
  }
}

// ─── 水槽 ──────────────────────────────────────────────────────────────────────

export function buildSink(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const body = paintedMaterial(f.color ?? '#a4ad98', 0.7);
  const stone = stoneMaterial('#d5d0c5');
  const steel = metalMaterial('#aeb9b5', 0.3);
  const handle = metalMaterial('#7d8883', 0.24);
  const t = 0.025, counterH = 0.035;
  // Hollow carcass keeps the basin cavity visible from above.
  makeBox(t, H-counterH, D, body, -W/2+t/2, (H-counterH)/2, 0, g);
  makeBox(t, H-counterH, D, body, W/2-t/2, (H-counterH)/2, 0, g);
  const toeHeight=Math.min(.08,H*.15);
  makeBox(W,toeHeight,D*.9,body,0,toeHeight/2,D*.05,g);
  makeBox(W,H-counterH,t,body,0,(H-counterH)/2,D/2-t/2,g);
  for(const x of [-W/4,W/4]) {
    makeBox(W/2-0.008,H-counterH-0.08,t,body,x,(H-counterH+0.08)/2,-D/2+t/2,g);
    makeBox(0.015,0.16,0.025,handle,x+(x<0?1:-1)*W*0.16,H*0.7,-D/2-0.01,g);
  }
  const bowlW = W * 0.75, bowlD = D * 0.7, bowlH = Math.min(0.19,H*0.24);
  const shape = new Shape();
  shape.moveTo(-W/2,-D/2);shape.lineTo(W/2,-D/2);shape.lineTo(W/2,D/2);shape.lineTo(-W/2,D/2);shape.closePath();
  const hole = new Path();
  hole.absellipse(0,0,bowlW*0.465,bowlD*0.465,0,Math.PI*2,true);
  shape.holes.push(hole);
  const counter = new Mesh(new ExtrudeGeometry(shape,{depth:counterH,bevelEnabled:false,curveSegments:32}),stone);
  counter.rotation.x=-Math.PI/2;counter.position.y=H-counterH;
  counter.castShadow=counter.receiveShadow=true;g.add(counter);
  const bowl = new Mesh(basinShellGeometry(bowlW,bowlD,bowlH),steel);
  bowl.position.y=H-bowlH+0.008;bowl.castShadow=bowl.receiveShadow=true;g.add(bowl);
  makeCylinder(0.025,0.025,0.005,handle,0,H-bowlH*0.88+0.011,0,g);
  const back = D*0.4;
  const curve = new CatmullRomCurve3([
    new Vector3(0,H,back),new Vector3(0,H+0.15,back),
    new Vector3(0,H+0.23,back-0.06),new Vector3(0,H+0.22,back-0.17),
    new Vector3(0,H+0.14,back-0.2),
  ]);
  const mixer = new Mesh(new TubeGeometry(curve,24,0.012,8,false),handle);
  mixer.castShadow=mixer.receiveShadow=true;g.add(mixer);
  makeBox(0.012,0.08,0.025,handle,0.035,H+0.06,back,g);
  addWaterOutlet(g, new Vector3(0, H + 0.14, back - 0.2), bowl);
}

// ─── 橱柜 ──────────────────────────────────────────────────────────────────────

export function buildKitchenCounter(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matBody = paintedMaterial('#cdd4c7', 0.62);
  const matCounter = stoneMaterial('#d4cec2');
  const matPanel = paintedMaterial('#dfe4dc', 0.56);
  const matMetal = metalMaterial('#9da39d', 0.26);

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
