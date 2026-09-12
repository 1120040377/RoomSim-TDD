import { Box3, BoxGeometry, Color, Group, Mesh, PlaneGeometry, DoubleSide, MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fabricMaterial, woodMaterial } from './material-library';
import { addCylinder, addRoundedBox } from './primitives';
import { buildModelPillow, hasArmchairModel } from './model-armchair';

/** Padded arm: rounded crown and a gently tucked lower shell, same 300 triangles as a two-segment box. */
export function upholsteredArmrest(g:Group,w:number,h:number,d:number,mat:MeshStandardMaterial,x:number,y:number,z:number) {
  const geometry=new RoundedBoxGeometry(w,h,d,2,Math.min(w*.46,h*.24,d*.24));
  const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal');
  const faceSizes=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(const [face,section] of geometry.groups.entries())for(let i=section.start;i<section.start+section.count;i++){
    uv.setXY(i,uv.getX(i)*faceSizes[face][0],uv.getY(i)*faceSizes[face][1]);
  }
  for(let i=0;i<p.count;i++){
    const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),height=(py+h/2)/h;
    const fullness=.88+.12*Math.sin(Math.PI*height);
    const drop=Math.min(.012,h*.025),top=Math.max(0,2*py/h);
    const crownDrop=drop*Math.pow(2*pz/d,2)*top;
    // Inverse-transpose of the deformation Jacobian preserves the original
    // rounded-box smooth normals, including duplicated vertices at UV seams.
    const a=px*.12*Math.PI*Math.cos(Math.PI*height)/h;
    const b=1-drop*Math.pow(2*pz/d,2)*(py>0?2/h:0);
    const c=-drop*8*pz/(d*d)*top;
    const nx=normal.getX(i)/fullness,ny=(normal.getY(i)-a*nx)/b,nz=normal.getZ(i)-c*ny;
    const length=Math.hypot(nx,ny,nz);normal.setXYZ(i,nx/length,ny/length,nz/length);
    p.setXYZ(i,px*fullness,py-crownDrop,pz);
  }
  const mesh=new Mesh(geometry,mat);mesh.name='upholstered-armrest';mesh.position.set(x,y,z);
  mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;
}

/** Inflated stitched cushion, dimensions in metres. Deterministic folds keep rebuilds stable. */
export function cushion(g: Group, w: number, h: number, d: number, mat: MeshStandardMaterial,
  x: number, y: number, z: number, seed: number, sculpted=false, horizontal=false) {
  if(sculpted){const imported=buildModelPillow(g,w,h,d,mat,x,y,z,horizontal);if(imported)return imported;}
  const geometry = new RoundedBoxGeometry(w, h, d, 5, Math.min(w, h, d) * 0.38);
  const p = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const faceSizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (const [face, section] of geometry.groups.entries()) {
    const [u, v] = faceSizes[face];
    for (let i = section.start; i < section.start + section.count; i++) {
      uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    }
  }
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    const nx = px / (w / 2), nz = pz / (d / 2);
    const sx=Math.max(0,1-nx*nx),sz=Math.max(0,1-nz*nz);
    const center = sx*sz;
    const crease = Math.sin(px * 41 + seed) * Math.sin(pz * 33 + seed * 2) * 0.002;
    const inflation=center*h*.065+crease;
    const dx=(sx>0?-4*nx/w:0)*sz*h*.065+Math.cos(px*41+seed)*Math.sin(pz*33+seed*2)*.082;
    const dz=(sz>0?-4*nz/d:0)*sx*h*.065+Math.sin(px*41+seed)*Math.cos(pz*33+seed*2)*.066;
    // Continuous through the side's equator; sign(y) introduced a small jump.
    const scale=1+2*inflation/h,ny=normal.getY(i)/scale;
    const transformedX=normal.getX(i)-(2*py/h)*dx*ny;
    const transformedZ=normal.getZ(i)-(2*py/h)*dz*ny;
    const length=Math.hypot(transformedX,ny,transformedZ);
    normal.setXYZ(i,transformedX/length,ny/length,transformedZ/length);
    p.setY(i,py*scale);
  }
  const mesh = new Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** Closed, pinched-edge pillow with bulging front/back, rather than a padded box. */
export function throwPillow(g:Group,w:number,h:number,d:number,mat:MeshStandardMaterial,x:number,y:number,z:number,seed:number) {
  const imported=buildModelPillow(g,w,h,d,mat,x,y,z);
  if(imported)return imported;
  const geometry=new BoxGeometry(w,h,d,14,14,2),p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  const faceSizes=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let i=0;i<p.count;i++){
    const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),nx=px/(w/2),ny=py/(h/2);
    const interior=Math.max(0,1-nx*nx)*Math.max(0,1-ny*ny);
    const dome=Math.pow(interior,0.82);
    // A sewn edge is thin, not a vertical band around a rounded rectangular slab.
    // Short gathers fade into the filling; seed changes only the cloth, not its size.
    const edge=Math.max(Math.abs(nx),Math.abs(ny));
    const gathers=Math.sin(nx*22+ny*5+seed)*Math.sin(ny*18-nx*4+seed*0.7);
    const fold=d*0.055*gathers*interior*Math.exp(-Math.pow((edge-0.74)/0.22,2));
    const filling=d*0.48*dome*(1+0.07*nx*Math.sin(seed)+0.055*ny);
    const edgeWave=0.012*Math.sin(nx*7+seed)*Math.sin(ny*5+seed*0.6);
    p.setXYZ(i,px*(1-0.11*Math.pow(ny,6)),py*(1-0.11*Math.pow(nx,6)),
      (pz/(d/2))*(d*0.02+filling+fold)+d*edgeWave);
  }
  for(const [face,section] of geometry.groups.entries()){
    const indices=new Set<number>();
    for(let i=section.start;i<section.start+section.count;i++)indices.add(geometry.index!.getX(i));
    for(const i of indices)uv.setXY(i,uv.getX(i)*faceSizes[face][0],uv.getY(i)*faceSizes[face][1]);
  }
  geometry.computeVertexNormals();
  const mesh=new Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;
}

/** A single continuous cloth surface rolls over the seat front, with broad folds and a hem. */
function throwBlanket(g: Group, x: number, seatTop: number, front: number, facing=-1, suppliedMaterial?:MeshStandardMaterial) {
  const geometry = new PlaneGeometry(0.43, 0.85, 22, 38);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    const across = positions.getX(i), t = uv.getY(i);
    const along=t*.85,rollRadius=.05,rollStart=.40,rollEnd=rollStart+Math.PI*rollRadius/2;
    const angle=Math.min(Math.PI/2,Math.max(0,(along-rollStart)/rollRadius));
    const drop=rollRadius*(1-Math.cos(angle))+Math.max(0,along-rollEnd);
    const depth=along<rollStart?.45-along:rollRadius*(1-Math.sin(angle));
    const hanging=Math.min(1,Math.max(0,(along-rollStart)/.18));
    const fold=Math.sin(across*31+along*4)*(.003+.006*hanging)+Math.sin(across*59-along*7)*.0015;
    const hem=Math.sin(across*19+.7)*.004*Math.pow(t,8);
    positions.setXYZ(i,x+across+.004*Math.sin(along*13)*Math.pow(Math.abs(across)/.215,4),
      seatTop+.018-drop+fold+hem,
      front-facing*depth+facing*(hanging*(.02+fold*.5)));
    uv.setXY(i,uv.getX(i)*0.43,t*0.85);
  }
  geometry.computeVertexNormals();
  const material = suppliedMaterial ?? fabricMaterial('#8c9982', 40);
  material.side = DoubleSide;
  const mesh = new Mesh(geometry, material);
  mesh.name='sofa-throw-blanket';
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
}

/** Local sofa faces -Z. All pieces remain inside its footprint and respect the requested height. */
export function buildTailoredSofa(g: Group, w: number, d: number, h: number, color: string, pillows = true) {
  const cloth = fabricMaterial(color, 12);
  const piping = fabricMaterial(new Color(color).multiplyScalar(0.87), 12);
  const oak = woodMaterial('#5a4432', 14);
  const feet = Math.min(0.09, h * 0.11);
  const arm = Math.min(0.16, w * 0.15);
  const seatTop = h * 0.51;
  const seatThickness = h * 0.16;
  const backDepth = Math.min(0.19, d * 0.24);
  const usable = w - 2 * arm - 0.025;
  const count = w > 1.85 ? 3 : w > 1.1 ? 2 : 1;
  const depth = d - backDepth - 0.04;
  for (const x of [-w / 2 + 0.11, w / 2 - 0.11]) for (const z of [-d / 2 + 0.10, d / 2 - 0.1]) {
    addCylinder(g, 0.024, 0.02, feet, oak, x, feet / 2, z, 12);
  }
  addRoundedBox(g, w - 0.035, seatTop - seatThickness - feet, d - 0.03, cloth,
    0, (feet + seatTop - seatThickness) / 2, 0, 0.04);
  addRoundedBox(g, w - 0.04, h - feet - 0.025, backDepth, cloth,
    0, (feet + h - 0.025) / 2, d / 2 - backDepth / 2, 0.065);
  for (const x of [-w / 2 + arm / 2, w / 2 - arm / 2]) {
    upholsteredArmrest(g, arm, h * 0.7 - feet, d - 0.035, cloth,
      x, (feet + h * 0.7) / 2, 0);
  }
  for (let i = 0; i < count; i++) {
    const cw = usable / count - 0.014;
    const x = -usable / 2 + usable / count * (i + 0.5);
    // Narrow welt under each seat creates a real seam, not a black outline.
    cushion(g, cw + 0.004, 0.012, depth, piping, x, seatTop - seatThickness + 0.012, -backDepth / 2, i);
    cushion(g, cw, seatThickness, depth, cloth, x, seatTop - seatThickness / 2, -backDepth / 2, i);
    const back = cushion(g, cw, h * 0.4, 0.16, cloth,
      x, seatTop + h * 0.21, d / 2 - backDepth - 0.045, i + 6);
    back.rotation.x = -0.12;
  }
  if (pillows && w > 1.15) {
    const green = fabricMaterial('#63745a', 28);
    const linen = fabricMaterial('#c3b594', 29);
    const pw = Math.min(0.37, usable * 0.32);
    const left = cushion(g, pw, h * 0.34, 0.13, green, -usable / 2 + pw * 0.52,
      seatTop + h * 0.17, d / 2 - backDepth - 0.16, 3);
    left.rotation.set(-0.20, 0.16, -0.16);
    const right = cushion(g, pw, h * 0.31, 0.13, linen, usable / 2 - pw * 0.52,
      seatTop + h * 0.16, d / 2 - backDepth - 0.17, 7);
    right.rotation.set(-0.16, -0.2, 0.18);
    if (d > 0.65) throwBlanket(g, -usable * 0.21, seatTop, -d / 2 + 0.02);
  }
}

/** L sectional keeps the existing +Z-facing layout: back at -Z, return at -X. */
export function buildTailoredSectional(g: Group, w: number, d: number, h: number, color: string) {
  // The avatar faces -Z; this sectional opens toward +Z.
  g.userData.seatYaw = Math.PI;
  const cloth = fabricMaterial(color, 12);
  const sculptedCloth=hasArmchairModel()?fabricMaterial(color,12):cloth;
  const seam = fabricMaterial(new Color(color).multiplyScalar(0.88), 12);
  const oak = woodMaterial('#5a4432', 14);
  const green = fabricMaterial('#63745a', 28);
  const linen = fabricMaterial('#c3b594', 29);
  const moduleDepth = Math.min(0.94, d * 0.55, w * 0.42);
  const wall = Math.min(0.145, moduleDepth * 0.18);
  const feet = h * 0.1, top = h * 0.51, thickness = h * 0.22;
  const baseHeight = top - thickness - feet;
  const mainZ = -d / 2 + moduleDepth / 2;
  const returnDepth = d - moduleDepth;
  const returnX = -w / 2 + moduleDepth / 2;
  const returnZ = -d / 2 + moduleDepth + returnDepth / 2;
  addRoundedBox(g, w - 0.03, baseHeight, moduleDepth - 0.02, cloth, 0, feet + baseHeight / 2, mainZ);
  addRoundedBox(g, moduleDepth - 0.03, baseHeight, returnDepth - 0.015, cloth, returnX, feet + baseHeight / 2, returnZ);
  // A low upholstered shell supports, rather than overtops, the loose backs.
  // Keep the sitting height fixed while giving the seat foam more substance.
  const shellTop = h * 0.81;
  const rearShell=addRoundedBox(g, w - 0.03, shellTop - feet, wall, cloth, 0, (shellTop + feet) / 2, -d / 2 + wall / 2, 0.06);
  const sideShell=addRoundedBox(g, wall, shellTop - feet, d - wall - 0.02, cloth, -w / 2 + wall / 2, (shellTop + feet) / 2, wall / 2, 0.06);
  rearShell.name=sideShell.name='sectional-shell';
  upholsteredArmrest(g, wall, h * 0.7 - feet, moduleDepth - 0.03, cloth, w / 2 - wall / 2, (feet + h * 0.7) / 2, mainZ);
  upholsteredArmrest(g, wall, h * 0.7 - feet, moduleDepth - wall, cloth, returnX + wall / 2, (feet + h * 0.7) / 2, d / 2 - wall / 2).rotation.y=Math.PI/2;
  const usable = w - 2 * wall - 0.03;
  const count = w > 2.1 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const width = usable / count - 0.016;
    const x = -usable / 2 + usable / count * (i + 0.5);
    cushion(g, width, thickness, moduleDepth - wall - 0.045, sculptedCloth, x, top - thickness / 2, mainZ + wall / 2, i,true,true);
    cushion(g, width + 0.004, 0.01, moduleDepth - wall - 0.04, seam, x, top - thickness + 0.01, mainZ + wall / 2, i);
    const back = cushion(g, width, h * 0.4, 0.15, sculptedCloth, x, top + h * 0.21, -d / 2 + wall + 0.045, i + 3,true);
    back.rotation.x = 0.12;
  }
  cushion(g, moduleDepth - wall - 0.035, thickness, returnDepth - wall - 0.035, sculptedCloth,
    returnX + wall / 2, top - thickness / 2, returnZ - wall / 2, 8,true,true);
  const sideBack = cushion(g, returnDepth - wall - 0.04, h * 0.4, 0.15, sculptedCloth,
    -w / 2 + wall + 0.045, top + h * 0.21, returnZ - wall / 2, 9,true);
  sideBack.rotation.set(0, Math.PI / 2, -0.12);
  for (const [x, z] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1],
    [w / 2 - 0.1, -d / 2 + moduleDepth - 0.1], [-w / 2 + 0.1, d / 2 - 0.1],
    [-w / 2 + moduleDepth - 0.1, d / 2 - 0.1]]) {
    addCylinder(g, 0.024, 0.02, feet, oak, x, feet / 2, z, 12);
  }
  const pillowSize = Math.min(0.43, moduleDepth * 0.46);
  const pillow = throwPillow(g, pillowSize, h * 0.43, 0.18, green,
    w / 2 - wall - pillowSize * 0.6, top + h * 0.22, -d / 2 + wall + 0.23, 12);
  pillow.rotation.set(0.28, -0.15, 0.2);
  const corner = throwPillow(g, pillowSize, h * 0.42, 0.18, linen,
    -w / 2 + wall + pillowSize * 0.65, top + h * 0.22, -d / 2 + wall + 0.25, 13);
  corner.rotation.set(0.25, 0.35, -0.18);
  for(const item of [pillow,corner]){
    item.name='sectional-pillow';
    item.position.y+=top-0.01-new Box3().setFromObject(item,true).min.y;
  }
  // Imported pillows have atlas-space baked normals; the draped blanket must
  // retain its own metre-space weave rather than share that pillow material.
  if(top>0.4)throwBlanket(g,w*0.16,top,-d/2+moduleDepth-0.012,1,
    gr