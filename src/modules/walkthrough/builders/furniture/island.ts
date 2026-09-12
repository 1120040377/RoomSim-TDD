import { CylinderGeometry, Group, LatheGeometry, Mesh, Vector2, Vector3 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { paintedMaterial, stoneMaterial, woodMaterial } from './material-library';
import { addRoundedBox } from './primitives';

/** Work face -Z, knee recess +Z. Entire asset stays inside catalog dimensions. */
export function buildKitchenIsland(g: Group, f: Furniture): void {
  const w=f.size.width/100,d=f.size.depth/100,h=f.size.height/100;
  const stone=stoneMaterial('#ded7c9'),paint=paintedMaterial(f.color??'#aab19e');
  const t=Math.min(0.035,w*0.04,h*0.05),toe=h*0.09,overhang=d*0.34;
  addRoundedBox(g,w,t,d,stone,0,h-t/2,0,0.006,1);
  for(const side of [-1,1])addRoundedBox(g,t,h-t,d,stone,side*(w-t)/2,(h-t)/2,0,0.004,1);
  const bodyD=d-overhang,bodyZ=-overhang/2;
  addRoundedBox(g,w-2*t-0.02,h-t-toe,bodyD,paint,0,toe+(h-t-toe)/2,bodyZ,0.008,1);
  addRoundedBox(g,w-2*t-0.08,toe,bodyD-0.08,paint,0,toe/2,bodyZ+0.02,0.005,1);
  const panelW=(w-2*t-0.035)/3;
  for(let i=0;i<3;i++){
    addRoundedBox(g,panelW-0.005,h-t-toe-0.035,0.018,paint,(i-1)*panelW,toe+(h-t-toe-0.035)/2,-d/2+0.009,0.003,1);
  }
}

/** Low-budget oak counter stool: dished seat, splayed legs and foot stretchers. */
export function buildCounterStool(g: Group, f: Furniture): void {
  const w=f.size.width/100,d=f.size.depth/100,h=f.size.height/100;
  const oak=woodMaterial(f.color??'#b59670',31),radius=Math.min(w,d)*0.46;
  const profile=[new Vector2(0,h-0.015),new Vector2(radius*0.65,h-0.012),new Vector2(radius*0.94,h),
    new Vector2(radius,h-0.008),new Vector2(radius,h-0.03),new Vector2(radius*0.92,h-0.04),new Vector2(0,h-0.04)];
  const seat=new Mesh(new LatheGeometry(profile.reverse(),32),oak);
  const seatP=seat.geometry.getAttribute('position'),seatUv=seat.geometry.getAttribute('uv');
  for(let i=0;i<seatP.count;i++)seatUv.setXY(i,seatP.getX(i),seatP.getZ(i));
  seat.castShadow=seat.receiveShadow=true;g.add(seat);
  const rod=(a:Vector3,b:Vector3,r0:number,r1:number)=>{
    const flatFoot=a.y===0,length=flatFoot?b.y:a.distanceTo(b),geometry=new CylinderGeometry(r1,r0,length,10);
    const uv=geometry.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*2*Math.PI*r0,uv.getY(i)*length);
    const mesh=new Mesh(geometry,oak);
    if(flatFoot){
      const p=geometry.getAttribute('position');
      for(let i=0;i<p.count;i++){
        const t=(p.getY(i)+length/2)/length;
        p.setXYZ(i,p.getX(i)+a.x+(b.x-a.x)*t,t*length,p.getZ(i)+a.z+(b.z-a.z)*t);
      }
      geometry.computeVertexNormals();
    }else{
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),b.clone().sub(a).normalize());
    }
    mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
  };
  const legRadius=Math.min(w,d)*0.045;
  for(const sx of [-1,1])for(const sz of [-1,1])rod(new Vector3(sx*w*.35,0,sz*d*.35),new Vector3(sx*w*.25,h-.04,sz*d*.25),legRadius*.72,legRadius);
  const railY=h*.30,railX=w*.32,railZ=d*.32;
  for(const s of [-1,1]){
    rod(new Vector3(-railX,railY,s*railZ),new Vector3(railX,railY,s*railZ),legRadius*.60,legRadius*.60);
    rod(new Vector3(s*railX,railY,-railZ),new Vector3(s*railX,railY,railZ),legRadius*.60,legRadius*.60);
  }
}
