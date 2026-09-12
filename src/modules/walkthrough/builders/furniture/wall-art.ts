import { DoubleSide, Group, Mesh, Shape, ShapeGeometry } from 'three';
import type { Furniture } from '@/modules/model/types';
import { fabricMaterial, paintedMaterial, woodMaterial } from './material-library';
import { addRoundedBox } from './primitives';

/** Original vector landscape, recessed paper and a real wooden frame; no glass pass. */
export function buildWallArt(group:Group,f:Furniture):void {
  const w=f.size.width/100,h=f.size.height/100,d=f.size.depth/100;
  const rail=Math.min(w,h)*0.04;
  const wood=woodMaterial(f.color??'#ba9b73',61),paper=fabricMaterial('#e6dfcf',62);
  const far=paintedMaterial('#b6b7a0',0.96),near=paintedMaterial('#84907b',0.96);
  far.side=near.side=DoubleSide;
  addRoundedBox(group,w,h,d*0.15,wood,0,h/2,d*0.425,0.003);
  for(const x of [-w/2+rail/2,w/2-rail/2])addRoundedBox(group,rail,h,d,wood,x,h/2,0,0.003);
  for(const y of [rail/2,h-rail/2])addRoundedBox(group,w-rail*2,rail,d,wood,0,y,0,0.003);
  addRoundedBox(group,w-rail*2,h-rail*2,d*0.08,paper,0,h/2,-d*0.17,0.001);
  const left=-w*0.4,right=w*0.4,bottom=h*0.17;
  const distant=new Shape();distant.moveTo(left,bottom);distant.lineTo(left,h*0.48);
  distant.bezierCurveTo(-w*0.28,h*0.5,-w*0.27,h*0.75,-w*0.1,h*0.62);
  distant.bezierCurveTo(w*0.04,h*0.5,w*0.16,h*0.64,right,h*0.42);
  distant.lineTo(right,bottom);distant.closePath();
  const foreground=new Shape();foreground.moveTo(left,bottom);foreground.lineTo(left,h*0.31);
  foreground.bezierCurveTo(-w*0.2,h*0.48,-w*0.06,h*0.21,w*0.1,h*0.34);
  foreground.bezierCurveTo(w*0.23,h*0.43,w*0.28,h*0.34,right,h*0.38);
  foreground.lineTo(right,bottom);foreground.closePath();
  for(const [shape,material,z] of [[distant,far,-d*0.22],[foreground,near,-d*0.24]] as const){
    const mesh=new Mesh(new ShapeGeometry(shape,20),material);mesh.position.z=z;
    mesh.receiveShadow=true;group.add(mesh);
  }
}
