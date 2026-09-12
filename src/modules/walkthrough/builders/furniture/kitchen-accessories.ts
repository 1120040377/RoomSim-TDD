import { Box3, Group, LatheGeometry, Mesh, PlaneGeometry, Vector2, Vector3 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { fabricMaterial, porcelainMaterial, woodMaterial } from './material-library';
import { addRoundedBox, addCylinder } from './primitives';

/** One editable still-life, three shared materials, no cloth simulation. */
export function buildKitchenAccessories(group:Group,f:Furniture):void {
  const wood=woodMaterial('#b79a73',53);
  const ceramic=porcelainMaterial(f.color??'#d8d3c3');ceramic.roughness=0.48;
  const linen=fabricMaterial('#b4bbaa',54);
  const board=addRoundedBox(group,0.23,0.25,0.018,wood,-0.18,0.13,0.105,0.014);
  board.rotation.x=0.1;board.rotation.z=-0.055;
  addRoundedBox(group,0.052,0.06,0.018,wood,-0.173,0.267,0.119,0.009);
  const clothGeometry=new PlaneGeometry(0.29,0.22,12,12);
  clothGeometry.rotateX(-Math.PI/2);
  const positions=clothGeometry.getAttribute('position'),uv=clothGeometry.getAttribute('uv');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i);
    positions.setY(i,0.005+0.002*Math.sin(x*55+z*19)+0.001*Math.cos(z*61));
    uv.setXY(i,uv.getX(i)*0.29,uv.getY(i)*0.22);
  }
  clothGeometry.computeVertexNormals();
  const cloth=new Mesh(clothGeometry,linen);cloth.position.set(0.055,0,-0.035);
  cloth.castShadow=cloth.receiveShadow=true;group.add(cloth);
  for(const [x,z,r,h] of [[0.01,0.08,0.049,0.16],[0.15,0.09,0.042,0.115]]){
    const points=[[0,0],[r*0.8,0],[r,0.01],[r,h*0.85],[r*0.94,h],[r*0.78,h],[r*0.78,0.012],[0,0.012]];
    const geometry=new LatheGeometry(points.map(([px,py])=>new Vector2(px,py)),24);
    const jar=new Mesh(geometry,ceramic);jar.position.set(x,0.009,z);
    jar.castShadow=jar.receiveShadow=true;group.add(jar);
    addCylinder(group,r*0.97,r*0.97,0.013,wood,x,h+0.015,z,24);
    addRoundedBox(group,0.018,0.014,0.018,wood,x,h+0.027,z,0.005);
  }
  // A small open ceramic dish, with an actual inner surface.
  const dishPoints=[[0,0],[0.025,0],[0.045,0.009],[0.05,0.025],[0.047,0.028],[0.042,0.012],[0.025,0.006],[0,0.006]];
  const dish=new Mesh(new LatheGeometry(dishPoints.map(([r,y])=>new Vector2(r,y)),24),ceramic);
  dish.position.set(0.08,0.009,-0.085);dish.castShadow=dish.receiveShadow=true;group.add(dish);
  // Fit the catalog dimensions, preserving all geometry/material parts as direct
  // children so the common batching pass can merge them into three meshes.
  const bounds=new Box3().setFromObject(group,true),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  const scale=new Vector3(f.size.width/100/size.x,f.size.height/100/size.y,f.size.depth/100/size.z);
  for(const child of group.children){
    if(!(child instanceof Mesh))continue;
    child.updateMatrix();child.geometry.applyMatrix4(child.matrix);
    child.geometry.translate(-center.x,-bounds.min.y,-center.z);
    child.geometry.scale(scale.x,scale.y,scale.z);
    child.position.set(0,0,0);child.rotation.set(0,0,0);child.scale.set(1,1,1);
  }
}
