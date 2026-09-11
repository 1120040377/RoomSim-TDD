import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import type { Furniture } from '@/modules/model/types';

export interface Mechanism { object: Group; kind: 'hinge' | 'drawer'; closed: number; open: number; value: number; target: number }
export const STORAGE_TYPES = new Set(['fridge','wardrobe-2','wardrobe-3','side-table','tv-cabinet','kitchen-counter','wall-cabinet','washing-machine']);
export function buildStorage(group:Group,f:Furniture) {
  const w=f.size.width/100,h=f.size.height/100,d=f.size.depth/100,t=0.025;
  const fridge=f.type==='fridge', washer=f.type==='washing-machine';
  const body=new MeshStandardMaterial({color:f.color??(fridge||washer?'#e0e6e7':f.type.includes('wardrobe')?'#bda681':'#e8e1d4'),roughness:0.6});
  const inside=new MeshStandardMaterial({color:fridge?'#f3f6f5':'#a08f76',roughness:0.8});
  const metal=new MeshStandardMaterial({color:'#777e82',metalness:0.65,roughness:0.3});
  const mechanisms:Mechanism[]=[];
  function box(parent:Group,ww:number,hh:number,dd:number,x:number,y:number,z:number,mat=body) {
    const m=new Mesh(new BoxGeometry(ww,hh,dd),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  // Hollow carcass: opening a door reveals shelves, not an opaque box.
  box(group,w,h,t,0,h/2,d/2-t/2);
  box(group,t,h,d,-w/2+t/2,h/2,0);box(group,t,h,d,w/2-t/2,h/2,0);
  box(group,w,t,d,0,t/2,0);box(group,w,t,d,0,h-t/2,0);
  const shelfCount=fridge?4:h>1.5?3:1;
  for(let i=1;i<=shelfCount;i++)box(group,w-2*t,t,d-0.06,0,h*i/(shelfCount+1),0.015,inside);
  if(fridge)for(let i=0;i<3;i++) {
    const bottle=new Mesh(new CylinderGeometry(0.025,0.035,0.15,10),new MeshStandardMaterial({color:['#bd8c54','#89a18a','#d4b68e'][i]}));
    bottle.position.set((i-1)*w*0.2,h/5+0.09,0);group.add(bottle);
  }
  if(washer) {
    box(group,w,h,t,0,h/2,-d/2);
    const pivot=new Group();pivot.position.set(-w*0.32,h*0.5,-d/2-0.03);group.add(pivot);
    const ring=new Mesh(new TorusGeometry(w*0.28,0.035,12,28),metal);ring.position.x=w*0.32;pivot.add(ring);
    const glass=new Mesh(new CylinderGeometry(w*0.25,w*0.25,0.025,24),new MeshStandardMaterial({color:'#305361',transparent:true,opacity:0.65}));
    glass.rotation.x=Math.PI/2;glass.position.x=w*0.32;pivot.add(glass);
    mechanisms.push({object:pivot,kind:'hinge',closed:0,open:1.7,value:0,target:0});
  } else if(f.type==='side-table'||f.type==='kitchen-counter') {
    for(let i=0;i<2;i++) {
      const drawer=new Group();drawer.position.set(0,h*(i+0.5)/2,-d/2);group.add(drawer);
      box(drawer,w-0.04,h/2-0.025,0.025,0,0,0);
      box(drawer,w-0.09,0.025,d*0.8,0,-h/4+0.04,d*0.4,inside);
      box(drawer,0.025,h/2-0.05,d*0.8,-w/2+0.045,0,d*0.4,inside);
      box(drawer,0.025,h/2-0.05,d*0.8,w/2-0.045,0,d*0.4,inside);
      box(drawer,w*0.35,0.02,0.025,0,0,-0.03,metal);
      mechanisms.push({object:drawer,kind:'drawer',closed:-d/2,open:-d/2-d*0.65,value:0,target:0});
    }
  } else {
    const count=f.type==='wardrobe-3'?3:fridge?1:2,doorW=w/count;
    for(let i=0;i<count;i++) {
      const pivot=new Group();pivot.position.set(-w/2+i*doorW,h/2,-d/2);group.add(pivot);
      box(pivot,doorW-0.012,h-0.02,t,doorW/2,0,0);
      box(pivot,0.02,Math.min(0.22,h*0.35),0.035,doorW-0.05,0,-0.035,metal);
      mechanisms.push({object:pivot,kind:'hinge',closed:0,open:1.65,value:0,target:0});
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
