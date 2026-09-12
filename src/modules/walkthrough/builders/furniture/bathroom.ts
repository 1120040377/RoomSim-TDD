import { DoubleSide, Group, LatheGeometry, Mesh, MeshStandardMaterial, PlaneGeometry, Vector2, Vector3 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';
import { glassMaterial, metalMaterial, paintedMaterial, porcelainMaterial, stoneMaterial, woodMaterial } from './material-library';
import { addCylinder, addRoundedBox } from './primitives';
import { basinShellGeometry } from './basin-shell';
import { floorMaterial } from '../finish-material';
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

// ─── 马桶 ──────────────────────────────────────────────────────────────────────

export function buildToilet(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;   // 0.40
  const D = f.size.depth * CM_TO_M;   // 0.70
  const H = f.size.height * CM_TO_M;  // 0.75

  const matWhite = porcelainMaterial(f.color ?? '#f3f1ec');
  const chrome=metalMaterial('#b7bdb8',0.22);
  const bowlD=D*.65,bowlZ=-D*.16;
  const ceramic=(profile:number[][],width:number,depth:number,name:string)=>{
    const geometry=new LatheGeometry(profile.map(([r,y])=>new Vector2(r*width/2,y*H)),32);
    geometry.scale(1,1,depth/width);
    const mesh=new Mesh(geometry,matWhite);mesh.name=name;mesh.position.z=bowlZ;
    mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
  };
  // Continuous ceramic pedestal and rounded bowl shoulder, closed beneath lid.
  ceramic([[0,0],[.76,0],[.80,.02],[.79,.08],[.76,.19],[.78,.28],
    [.84,.35],[.91,.40],[.98,.46],[1,.51],[.99,.54],[.94,.55],[0,.55]],W*.96,bowlD,'toilet-bowl');
  ceramic([[0,.56],[.92,.56],[1,.569],[1,.59],[.95,.604],[0,.604]],W,bowlD*1.02,'toilet-lid');
  const tankZ=D*.33;
  addRoundedBox(g,W*.64,H*.56,D*.28,matWhite,0,H*.28,tankZ,0.045);
  addRoundedBox(g,W*.94,H*.43,D*.32,matWhite,0,H*.77,tankZ,0.035);
  addRoundedBox(g,W*.96,H*.02,D*.33,matWhite,0,H*.98,tankZ,0.008,1);
  for(const x of [-W*.055,W*.055])addCylinder(g,W*.038,W*.038,H*.01,chrome,x,H*.995,tankZ,16);
}

// ─── 洗手池 ────────────────────────────────────────────────────────────────────

export function buildBasin(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;   // 0.60
  const D = f.size.depth * CM_TO_M;   // 0.50
  const H = f.size.height * CM_TO_M;  // 0.85

  const cabinet = paintedMaterial(f.color ?? '#a9b09d', 0.7);
  const oak = woodMaterial('#aa8b63', 74);
  const chrome = metalMaterial('#bcc2be', 0.22);
  // Compact vanity and counter leave space above for the vessel and mixer.
  makeBox(W * 0.94, H * 0.54, D * 0.9, cabinet, 0, H * 0.35, 0.01, g);
  makeBox(W, H * 0.04, D, oak, 0, H * 0.64, 0, g);
  for (const y of [H * 0.23, H * 0.46]) {
    makeBox(W * 0.87, H * 0.21, 0.015, cabinet, 0, y, -D * 0.455, g);
    makeBox(W * 0.35, 0.012, 0.012, chrome, 0, y + H * 0.07, -D * 0.475, g);
  }
  const bowlHeight = H * 0.19;
  const bowl = new Mesh(basinShellGeometry(W * 0.88, D * 0.76, bowlHeight), porcelainMaterial('#f4f1e9'));
  bowl.position.set(0, H * 0.66, -D * 0.065);
  bowl.castShadow = bowl.receiveShadow = true; g.add(bowl);
  addCylinder(g, 0.022, 0.022, 0.004, chrome, 0, H * 0.66 + bowlHeight * 0.12 + 0.002, -D * 0.065);
  addCylinder(g, 0.014, 0.018, H * 0.31, chrome, 0, H * 0.815, D * 0.37);
  makeBox(0.028, H * 0.025, D * 0.3, chrome, 0, H * 0.97, D * 0.25, g);
  makeBox(0.015, H * 0.018, D * 0.13, chrome, 0, H * 0.991, D * 0.33, g);
  addWaterOutlet(g, new Vector3(0, H * 0.9575, D * 0.115), bowl, 0.006);
}

// ─── 淋浴 ──────────────────────────────────────────────────────────────────────

export function buildShower(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;    // 0.90
  const D = f.size.depth * CM_TO_M;    // 0.90
  const H = f.size.height * CM_TO_M;   // 2.00

  const matFloor = stoneMaterial('#c5c6ba');
  const matGlass = glassMaterial('#eef3ef');
  matGlass.opacity=0.16;matGlass.side=DoubleSide;matGlass.forceSinglePass=true;
  const tile=floorMaterial({floor:'tile',floorColor:f.color??'#8f9f93',wallColor:'#eee8dd'});
  for(const texture of [tile.map,tile.bumpMap])texture?.repeat.set(1/.15,1/.30);
  const metal=metalMaterial('#707b73',0.32);

  // 地台
  const floorH = 0.08;
  const tray = addRoundedBox(g, W, floorH, D, matFloor, 0, floorH / 2, 0);

  const glassH = H - floorH;
  const glassY = floorH + glassH / 2;
  // A tiled back panel, open access on -X; +Z/+X are thin clear screens.
  addRoundedBox(g,W,glassH,.02,tile,0,glassY,-D/2+.01,0.002,1);
  const screen=(width:number,x:number,z:number,yaw:number)=>{
    const pane=new Mesh(new PlaneGeometry(width,glassH),matGlass);
    pane.position.set(x,glassY,z);pane.rotation.y=yaw;pane.receiveShadow=true;g.add(pane);
  };
  screen(W-.02,0,D/2-.006,0);screen(D-.02,W/2-.006,0,Math.PI/2);
  for(const [x,z] of [[-W/2+.009,D/2-.009],[W/2-.009,D/2-.009],[W/2-.009,-D/2+.009]]){
    addRoundedBox(g,.018,glassH,.018,metal,x,glassY,z,0.003,1);
  }
  const riserZ=-D/2+.065,riserH=H*.64;
  addCylinder(g,.009,.009,riserH,metal,0,floorH+H*.18+riserH/2,riserZ,12);
  addRoundedBox(g,.026,.026,D*.32,metal,0,H*.86,riserZ+D*.16,0.004,1);
  addCylinder(g,Math.min(W,D)*.13,Math.min(W,D)*.13,.016,metal,0,H*.85,riserZ+D*.30,24);
  addRoundedBox(g,W*.25,.045,.045,metal,0,H*.50,riserZ+.02,0.008,1);
  addRoundedBox(g,W*.30,.004,.055,metal,0,floorH+.002,-D*.30,0.002,1);
  addWaterOutlet(g, new Vector3(0, H * .85 - .008, riserZ + D * .30), tray, Math.min(W,D) * .13, true);
}

// ─── 浴缸 ──────────────────────────────────────────────────────────────────────

export function buildBathtub(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;   // 1.70
  const D = f.size.depth * CM_TO_M;   // 0.80
  const H = f.size.height * CM_TO_M;  // 0.55

  const shell = new Mesh(basinShellGeometry(W, D, H), porcelainMaterial(f.color ?? '#f4f1eb'));
  shell.position.y = 0;
  shell.castShadow = shell.receiveShadow = true;
  g.add(shell);
  addCylinder(g, 0.028, 0.028, 0.004, metalMaterial('#b7bcb9', 0.25), 0, H * 0.12 + 0.002, 0);
  const chrome = metalMaterial('#b7bcb9', 0.25);
  const back = D * .465, nozzleZ = D * .22;
  addCylinder(g, .018, .021, .18, chrome, 0, H + .015, back);
  addRoundedBox(g, .035, .027, back - nozzleZ + .035, chrome, 0, H + .10, (back + nozzleZ) / 2, .007);
  addRoundedBox(g, .013, .02, .085, chrome, .032, H + .07, back, .004);
  addWaterOutlet(g, new Vector3(0, H + .0865, nozzleZ), shell, .009);
}
