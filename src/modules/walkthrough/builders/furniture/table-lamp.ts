import { DoubleSide, Group, LatheGeometry, Mesh, SphereGeometry, Vector2 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { fabricMaterial, metalMaterial, porcelainMaterial } from './material-library';
import { addCylinder } from './primitives';

/** Ceramic base and open linen shade; one existing room-light slot, no shadow map. */
export function buildTableLamp(g: Group, f: Furniture): void {
  const h=f.size.height/100, r=Math.min(f.size.width,f.size.depth)/200;
  const ceramic=porcelainMaterial(f.color??'#d7c7ae'), brass=metalMaterial('#ad9161',0.4);
  const profile=[[0,0],[0.40,0],[0.48,0.025],[0.51,0.10],[0.43,0.23],[0.22,0.34],[0.14,0.43],[0,0.43]];
  const base=new Mesh(new LatheGeometry(profile.map(([x,y])=>new Vector2(x*r,y*h)),32),ceramic);
  base.castShadow=base.receiveShadow=true;g.add(base);
  addCylinder(g,r*0.06,r*0.06,h*0.30,brass,0,h*0.53,0,12);
  const linen=fabricMaterial('#eee4d2',81);linen.side=DoubleSide;linen.emissive.set('#ffd393');
  const shadeGeometry=new LatheGeometry([
    new Vector2(r,h*0.53),new Vector2(r*0.985,h*0.545),
    new Vector2(r*0.67,h*0.97),new Vector2(r*0.66,h),
  ],40);
  const uv=shadeGeometry.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*2*Math.PI*r,uv.getY(i)*h*0.47);
  const shade=new Mesh(shadeGeometry,linen);shade.name='table-lamp-shade';shade.receiveShadow=true;g.add(shade);
  const bulbMat=porcelainMaterial('#fff3dc');bulbMat.emissive.set('#ffd393');
  const bulb=new Mesh(new SphereGeometry(r*0.22,12,8),bulbMat);bulb.position.y=h*0.70;g.add(bulb);
  g.userData.setLightOn=(on:boolean)=>{linen.emissiveIntensity=on?0.22:0;bulbMat.emissiveIntensity=on?1.4:0;};
  g.userData.setLightOn(f.runtimeState?.on!==false);
}
