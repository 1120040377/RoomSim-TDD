import { BoxGeometry, Mesh, Vector3, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Plan, Vec2 } from '@/modules/model/types';

function inside(point:Vec2,polygon:Vec2[]):boolean {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }
  return result;
}

/** Interior-only 8 cm painted skirting. Reuses cut wall slabs, so doors remain open. */
export function buildBaseboards(plan:Plan,slabs:Mesh[],material:Material):Mesh|null {
  const parts:BufferGeometry[]=[];
  for(const slab of slabs){
    const {width,height,depth}=(slab.geometry as BoxGeometry).parameters;
    if(slab.position.y-height/2>0.001)continue;
    const trimH=Math.min(.08,height),thickness=.012;
    for(const side of [-1,1]){
      const offset=new Vector3(0,0,side*(depth/2+thickness/2)).applyAxisAngle(new Vector3(0,1,0),slab.rotation.y);
      const x=slab.position.x+offset.x,z=slab.position.z+offset.z;
      if(!Object.values(plan.rooms).some(room=>inside({x:x*100,y:z*100},room.polygon)))continue;
      const geometry=new BoxGeometry(width,trimH,thickness);
      geometry.rotateY(slab.rotation.y);geometry.translate(x,trimH/2,z);geometry.clearGroups();parts.push(geometry);
    }
  }
  if(!parts.length)return null;
  const geometry=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());
  if(!geometry)return null;
  const mesh=new Mesh(geometry,material);mesh.name='interior-baseboards';
  mesh.castShadow=mesh.receiveShadow=true;
  return mesh;
}
