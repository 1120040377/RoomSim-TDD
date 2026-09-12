import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Furniture } from '@/modules/model/types';
import { metalMaterial, paintedMaterial } from './material-library';
import { addRoundedBox } from './primitives';

/** Static metal shell: no live reflections, transparency or additional light. */
export function buildRangeHood(group:Group,f:Furniture):void {
  const w=f.size.width/100,d=f.size.depth/100,h=f.size.height/100;
  const steel=metalMaterial(f.color??'#8b928d',0.38);
  const dark=paintedMaterial('#252b29',0.65);
  const filter=metalMaterial('#626d68',0.55);
  const lamp=new MeshStandardMaterial({color:'#eee1bb',emissive:'#e9c57e',emissiveIntensity:0.25,roughness:0.5});
  const lip=h*0.06, canopyH=h*0.2;
  addRoundedBox(group,w,lip,d,steel,0,lip/2,0,0.006);
  const geometry=new BoxGeometry(w,canopyH,d);
  const position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++)if(position.getY(i)>0){
    position.setX(i,position.getX(i)*0.42);
    position.setZ(i,position.getZ(i)*0.46+d*0.27);
  }
  geometry.computeVertexNormals();
  const canopy=new Mesh(geometry,steel);canopy.position.y=lip+canopyH/2;
  canopy.castShadow=canopy.receiveShadow=true;group.add(canopy);
  const chimneyH=h-lip-canopyH;
  addRoundedBox(group,w*0.42,chimneyH,d*0.46,steel,0,h-chimneyH/2,d*0.27,0.008);
  // Underside grille and narrow parallel filter strips. Cheap boxes are batched
  // by material by the common furniture pipeline.
  addRoundedBox(group,w*0.83,0.004,d*0.62,dark,0,0.002,d*0.05,0.001);
  const slatGeometry=new BoxGeometry(w*0.75,0.004,d*0.012);
  for(let i=0;i<16;i++){
    const slat=new Mesh(slatGeometry,filter);
    slat.position.set(0,-0.001,d*(-0.21+i*0.032));
    slat.receiveShadow=true;group.add(slat);
  }
  for(const x of [-w*0.31,w*0.31])addRoundedBox(group,w*0.12,0.006,d*0.07,lamp,x,0,-d*0.36,0.002);
  for(let i=0;i<3;i++)addRoundedBox(group,w*0.027,lip*0.3,0.003,dark,w*(0.24+i*0.05),lip*0.55,-d/2,0.001);
}
