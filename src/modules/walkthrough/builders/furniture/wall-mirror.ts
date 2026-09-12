import { CircleGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Path, Shape } from 'three';
import type { Furniture } from '@/modules/model/types';
import { metalMaterial } from './material-library';

/** Environment-reflecting silver surface, not a realtime planar reflection pass. */
export function buildWallMirror(group:Group,f:Furniture):void {
  const w=f.size.width/100,h=f.size.height/100,d=f.size.depth/100,rail=Math.min(w,h)*.018;
  const outline=new Shape();outline.absellipse(0,h/2,w/2,h/2,0,Math.PI*2,false);
  const hole=new Path();hole.absellipse(0,h/2,w/2-rail,h/2-rail,0,Math.PI*2,true);outline.holes.push(hole);
  const rim=new Mesh(new ExtrudeGeometry(outline,{depth:d,bevelEnabled:false,curveSegments:32}),metalMaterial(f.color??'#a28b61',.27));
  rim.position.z=-d/2;rim.castShadow=rim.receiveShadow=true;group.add(rim);
  const surfaceGeometry=new CircleGeometry(w/2-rail*.65,64);
  surfaceGeometry.scale(1,(h/2-rail*.65)/(w/2-rail*.65),1);surfaceGeometry.rotateY(Math.PI);
  const surface=new Mesh(surfaceGeometry,new MeshStandardMaterial({color:'#d8dedb',metalness:1,roughness:.045,envMapIntensity:1}));
  surface.position.set(0,h/2,-d*.30);surface.receiveShadow=true;surface.name='environment-mirror';
  surface.userData.reflectionMode='environment-only';group.add(surface);
}
