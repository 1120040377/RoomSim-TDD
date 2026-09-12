import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';
import { fabricMaterial, woodMaterial } from './material-library';
import { addRoundedBox, roundedBoxGeometry } from './primitives';

function makeBox(
  w: number, h: number, d: number,
  mat: MeshStandardMaterial,
  x: number, y: number, z: number,
  g: Group,
  _edge = false,
): void {
  addRoundedBox(g, w, h, d, mat, x, y, z);
}

// ─── 餐桌通用 ──────────────────────────────────────────────────────────────────

function buildDiningTable(g: Group, f: Furniture, legPositions: [number, number][]): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matTop = woodMaterial(f.color??'#b58962', 15,'tabletop');
  const matLeg = woodMaterial('#4a3326', 16);

  const topH = Math.min(0.038,H*.08);
  makeBox(W, topH, D, matTop, 0, H - topH / 2, 0, g, true);

  const legH = H - topH;
  const legS = Math.min(0.055,W*.09,D*.09);
  legPositions.forEach(([x, z]) => {
    const geometry=roundedBoxGeometry(legS,legH,legS,0.004,1);
    const positions=geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      const y=positions.getY(i),t=(y+legH/2)/legH;
      const taper=.62+.38*t;
      positions.setXYZ(i,positions.getX(i)*taper+Math.sign(x)*.012*(1-t),y,
        positions.getZ(i)*taper+Math.sign(z)*.012*(1-t));
    }
    geometry.computeVertexNormals();
    const leg=new Mesh(geometry,matLeg);leg.position.set(x,legH/2,z);
    leg.castShadow=leg.receiveShadow=true;leg.name='dining-table-leg';g.add(leg);
  });
  // Shallow aprons join the legs below the top; one shared timber batch.
  const x0=Math.min(...legPositions.map(p=>p[0])),x1=Math.max(...legPositions.map(p=>p[0]));
  const z0=Math.min(...legPositions.map(p=>p[1])),z1=Math.max(...legPositions.map(p=>p[1]));
  const apronH=Math.min(.075,H*.12),apronT=Math.min(.022,legS*.45),y=H-topH-apronH/2-.004;
  const alignApron=(mesh:Mesh,axis:'x'|'z')=>{
    const geometry=mesh.geometry,p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
    // The shared veneer material runs along UV.v. Put the beam's length on v,
    // not its height: horizontal aprons must not inherit a leg's vertical grain.
    for(let i=0;i<p.count;i++){
      if(Math.abs(axis==='x'?n.getX(i):n.getZ(i))>.9)continue;
      const length=axis==='x'?p.getX(i):p.getZ(i);
      const across=Math.abs(n.getY(i))>.5?(axis==='x'?p.getZ(i):p.getX(i)):p.getY(i);
      uv.setXY(i,across,length);
    }
    mesh.name=`dining-table-apron-${axis}`;
  };
  for(const z of [z0,z1])alignApron(addRoundedBox(g,x1-x0,apronH,apronT,matLeg,(x0+x1)/2,y,z,.003,1),'x');
  for(const x of [x0,x1])alignApron(addRoundedBox(g,apronT,apronH,z1-z0,matLeg,x,y,(z0+z1)/2,.003,1),'z');
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

  const oak = woodMaterial(f.color ?? '#af906d', 17);
  const linen = fabricMaterial('#c9bea9', 18);
  const seatY = H * 0.48, seatH = H * 0.04;
  const radius = Math.min(W,D)*0.043;
  // Sheared tapered cylinders keep the feet flat on the floor even when splayed.
  const spindle=(x0:number,z0:number,y0:number,x1:number,z1:number,y1:number,bottomRadius:number,topRadius:number)=>{
    const geometry=new CylinderGeometry(topRadius,bottomRadius,y1-y0,12);
    const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    for(let i=0;i<p.count;i++){
      const t=(p.getY(i)+(y1-y0)/2)/(y1-y0);
      p.setXYZ(i,p.getX(i)+x0+(x1-x0)*t,y0+t*(y1-y0),p.getZ(i)+z0+(z1-z0)*t);
      uv.setXY(i,uv.getX(i)*2*Math.PI*bottomRadius,uv.getY(i)*(y1-y0));
    }
    geometry.computeVertexNormals();const mesh=new Mesh(geometry,oak);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
  };
  for(const sx of [-1,1])for(const sz of [-1,1]){
    spindle(sx*W*0.40,sz*D*0.39,0,sx*W*0.34,sz*D*0.32,seatY,radius*0.68,radius);
  }
  addRoundedBox(g,W*0.94,seatH,D*0.90,oak,0,seatY+seatH/2,0,0.025);
  const padW=W*.86,padD=D*.79,padH=H*.055;
  const padGeometry=new BoxGeometry(padW,padH,padD,8,2,8);
  const padPositions=padGeometry.getAttribute('position');
  const padUV=padGeometry.getAttribute('uv'),padNormals=padGeometry.getAttribute('normal');
  for(let i=0;i<padPositions.count;i++){
    let x=padPositions.getX(i),y=padPositions.getY(i),z=padPositions.getZ(i);
    if(Math.abs(padNormals.getY(i))>.5)padUV.setXY(i,x+padW/2,z+padD/2);
    else if(Math.abs(padNormals.getX(i))>.5)padUV.setXY(i,z+padD/2,y+padH/2);
    else padUV.setXY(i,x+padW/2,y+padH/2);
    const r=Math.min(.014,padH*.3);
    const cx=Math.max(-padW/2+r,Math.min(padW/2-r,x));
    const cy=Math.max(-padH/2+r,Math.min(padH/2-r,y));
    const cz=Math.max(-padD/2+r,Math.min(padD/2-r,z));
    const length=Math.hypot(x-cx,y-cy,z-cz);
    if(length){x=cx+(x-cx)*r/length;y=cy+(y-cy)*r/length;z=cz+(z-cz)*r/length;}
    const nx=x/(padW/2),nz=z/(padD/2),upper=Math.max(0,y/(padH/2));
    // Slightly narrower at the back, with a padded crown. Keep the underside
    // unchanged in height so the cloth stays seated on its timber support.
    const crown=Math.min(.009,padH*.2)*(1-nx*nx)*(1-nz*nz)*upper;
    padPositions.setXYZ(i,x*(1-.045*(nz+1)/2),y+crown,z);
  }
  padGeometry.computeVertexNormals();
  const pad=new Mesh(padGeometry,linen);pad.name='dining-chair-pad';
  pad.position.set(0,seatY+seatH+padH/2,-D*.02);
  pad.castShadow=pad.receiveShadow=true;g.add(pad);
  for(const sx of [-1,1])spindle(sx*W*0.34,D*0.32,seatY,sx*W*0.34,D*0.34,H*0.90,radius*0.72,radius*0.62);
  // Bowed top rail wraps toward the seated person (-Z); the lower back stays open.
  const back=new BoxGeometry(W*0.94,H*0.22,D*0.075,20,4,1);
  const p=back.getAttribute('position'),uv=back.getAttribute('uv');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),nx=x/(W*0.47);
    p.setXYZ(i,x,y+H*0.89,p.getZ(i)+D*0.43-D*0.15*nx*nx);
    uv.setXY(i,uv.getX(i)*W*0.94,uv.getY(i)*H*0.22);
  }
  back.computeVertexNormals();const mesh=new Mesh(back,oak);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
}
