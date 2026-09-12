import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import type { Furniture } from '@/modules/model/types';
import { glassMaterial, metalMaterial, paintedMaterial, stoneMaterial, woodMaterial } from './material-library';
import { roundedBoxGeometry } from './primitives';
import { batchStaticParts } from '../batch-static-parts';

export interface Mechanism { object: Group; kind: 'hinge' | 'drawer'; closed: number; open: number; value: number; target: number }
export const STORAGE_TYPES = new Set(['fridge','wardrobe-2','wardrobe-3','side-table','tv-cabinet','kitchen-counter','wall-cabinet','washing-machine']);
export function buildStorage(group:Group,f:Furniture) {
  const kitchen=f.type==='kitchen-counter';
  const counterH=kitchen?0.035:0;
  const w=f.size.width/100,h=f.size.height/100-counterH,d=f.size.depth/100,t=0.025;
  const fridge=f.type==='fridge', washer=f.type==='washing-machine';
  const wardrobe=f.type==='wardrobe-2'||f.type==='wardrobe-3';
  const bedside=f.type==='side-table';
  const base=bedside?h*.24:kitchen?Math.min(.08,h*.15):0,caseH=h-base;
  const body = fridge || washer
    ? metalMaterial(f.color ?? '#d9dfdd', 0.3)
    : f.type.includes('wardrobe')
      ? woodMaterial(f.color ?? '#9a7a55', 25)
      : f.type === 'wall-cabinet' || kitchen
        ? paintedMaterial(f.color ?? '#aeb6aa', 0.58)
        : woodMaterial(f.color ?? '#9b7650', 26);
  const inside = fridge ? paintedMaterial('#eff2ed', 0.72) : woodMaterial('#876c4c', 27);
  const metal = metalMaterial(wardrobe?'#97816a':'#777e7d', wardrobe?0.42:0.3);
  const mechanisms:Mechanism[]=[];
  function box(parent:Group,ww:number,hh:number,dd:number,x:number,y:number,z:number,mat=body) {
    const m = new Mesh(roundedBoxGeometry(ww, hh, dd, bedside?0.003:0.018,bedside?1:2), mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  // Hollow carcass: opening a door reveals shelves, not an opaque box.
  if(kitchen)box(group,w,counterH,d,0,h+counterH/2,0,stoneMaterial('#d5d0c5'));
  if(kitchen){
    const plinth=new Mesh(new BoxGeometry(w*.94,base,d*.9),body);
    plinth.position.set(0,base/2,d*.05);plinth.name='kitchen-recessed-plinth';
    plinth.castShadow=plinth.receiveShadow=true;group.add(plinth);
  }
  box(group,w,caseH,t,0,base+caseH/2,d/2-t/2);
  box(group,t,caseH,d,-w/2+t/2,base+caseH/2,0);box(group,t,caseH,d,w/2-t/2,base+caseH/2,0);
  box(group,w,t,d,0,base+t/2,0);box(group,w,t,d,0,h-t/2,0);
  if(bedside)for(const x of [-1,1])for(const z of [-1,1]){
    const leg=new Mesh(new CylinderGeometry(.018,.012,base+.01,10),body);
    leg.position.set(x*(w/2-.04),base/2,z*(d/2-.04));
    leg.castShadow=leg.receiveShadow=true;group.add(leg);
  }
  const shelfCount=fridge?4:h>1.5?3:1;
  for(let i=1;i<=shelfCount;i++)box(group,w-2*t,t,d-0.06,0,base+caseH*i/(shelfCount+1),0.015,inside);
  if(fridge)for(let i=0;i<3;i++) {
    const bottle=new Mesh(new CylinderGeometry(0.025,0.035,0.15,10),new MeshStandardMaterial({color:['#bd8c54','#89a18a','#d4b68e'][i]}));
    bottle.position.set((i-1)*w*0.2,h/5+0.09,0);group.add(bottle);
  }
  if(washer) {
    box(group,w,h,t,0,h/2,-d/2);
    const pivot=new Group();pivot.position.set(-w*0.32,h*0.5,-d/2-0.03);group.add(pivot);
    const ring=new Mesh(new TorusGeometry(w*0.28,0.035,12,28),metal);ring.position.x=w*0.32;pivot.add(ring);
    const glass=new Mesh(new CylinderGeometry(w*0.25,w*0.25,0.025,24),glassMaterial('#305d63'));
    glass.rotation.x=Math.PI/2;glass.position.x=w*0.32;pivot.add(glass);
    mechanisms.push({object:pivot,kind:'hinge',closed:0,open:1.7,value:0,target:0});
  } else if(f.type==='side-table'||f.type==='kitchen-counter') {
    for(let i=0;i<2;i++) {
      const drawer=new Group();drawer.position.set(0,base+caseH*(i+0.5)/2,-d/2);group.add(drawer);
      box(drawer,w-0.04,caseH/2-0.025,0.025,0,0,0);
      box(drawer,w-0.09,0.025,d*0.8,0,-caseH/4+0.04,d*0.4,inside);
      box(drawer,0.025,caseH/2-0.05,d*0.8,-w/2+0.045,0,d*0.4,inside);
      box(drawer,0.025,caseH/2-0.05,d*0.8,w/2-0.045,0,d*0.4,inside);
      box(drawer,w*(bedside?.22:.35),bedside?.008:.02,0.025,0,0,-0.03,metal);
      if(bedside)batchStaticParts(drawer);
      mechanisms.push({object:drawer,kind:'drawer',closed:-d/2,open:-d/2-d*0.65,value:0,target:0});
    }
  } else {
    const count=f.type==='wardrobe-3'?3:fridge?1:2,doorW=w/count;
    for(let i=0;i<count;i++) {
      const rightHinge=wardrobe && i===count-1, direction=rightHinge?-1:1;
      const pivot=new Group();pivot.position.set(-w/2+(i+(rightHinge?1:0))*doorW,h/2,-d/2);group.add(pivot);
      if(wardrobe){
        const panelW=doorW-0.012,panelH=h-0.02,cx=direction*doorW/2;
        const rail=Math.min(0.038,panelW*.12,panelH*.08);
        const part=(ww:number,hh:number,dd:number,x:number,y:number,z:number)=>{
          const mesh=new Mesh(roundedBoxGeometry(ww,hh,dd,0.002,1),body);
          mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;pivot.add(mesh);
        };
        part(rail,panelH,t,cx-panelW/2+rail/2,0,0);
        part(rail,panelH,t,cx+panelW/2-rail/2,0,0);
        part(panelW-2*rail,rail,t,cx,panelH/2-rail/2,0);
        part(panelW-2*rail,rail,t,cx,-panelH/2+rail/2,0);
        part(panelW-2*rail+.002,panelH-2*rail+.002,t*.55,cx,0,t*.225);
        const handleX=direction*(doorW-rail*.5-.012),handleH=Math.min(.18,h*.15);
        const pull=new Mesh(new CylinderGeometry(.006,.006,handleH,10),metal);
        pull.position.set(handleX,0,-.037);pull.castShadow=pull.receiveShadow=true;pivot.add(pull);
        for(const y of [-handleH*.36,handleH*.36]){
          const mount=new Mesh(new CylinderGeometry(.004,.004,.024,8),metal);
          mount.rotation.x=Math.PI/2;mount.position.set(handleX,y,-.025);
          mount.castShadow=mount.receiveShadow=true;pivot.add(mount);
        }
        // Batch only within this moving leaf: no cross-hinge merging.
        batchStaticParts(pivot);
      } else {
        box(pivot,doorW-0.012,h-0.02,t,doorW/2,0,0);
        box(pivot,0.02,Math.min(0.22,h*0.35),0.035,doorW-0.05,0,-0.035,metal);
      }
      mechanisms.push({object:pivot,kind:'hinge',closed:0,open:1.65*direction,value:0,target:0});
    }
  }
  group.userData.mechanisms=mechanisms;
  group.userData.open=false;
}
export function toggleStorage(group:Group) {
  group.userData.open=!group.userData.open;
  for(const m of (group.userData.mechanisms??[]) as Mechanism[])m.target=group.userData.open?1:0;
}
export function animateStorage(group:Group,dt:number) {
  for(const child of group.children) {
    for(const m of (child.userData.mechanisms??[]) as Mechanism[]) {
      m.value += (m.target-m.value)*Math.min(1,dt*10);
      if(Math.abs(m.target-m.value)<0.001)m.value=m.target;
      const value=m.closed+(m.open-m.closed)*m.value;
      if(m.kind==='hinge')m.object.rotation.y=value;else m.object.position.z=value;
    }
  }
}
