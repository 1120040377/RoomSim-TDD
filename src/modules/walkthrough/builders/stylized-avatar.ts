import { Box3, CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export type AvatarKind='adult'|'child';

/** Distinct articulated proportions, normalized to 170 cm before height scaling. */
export function buildStylizedAvatar(initial:AvatarKind='adult') {
  const group=new Group();group.name='walkthrough-avatar';
  let legs:Group[]=[],knees:Group[]=[],arms:Group[]=[],elbows:Group[]=[];
  let hipHeight=0.8;
  function rebuild(kind:AvatarKind){
    const geometries=new Set<Mesh['geometry']>(),materials=new Set<MeshStandardMaterial>();
    group.traverse(o=>{if(o instanceof Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    group.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    legs=[];knees=[];arms=[];elbows=[];
    const child=kind==='child';hipHeight=child?0.68:0.8;
    group.userData.avatarKind=kind;
    const mat=(color:string)=>new MeshStandardMaterial({color,roughness:0.85});
    const skin=mat('#e5b28e'),shirt=mat(child?'#dca651':'#448b87'),pants=mat(child?'#596e92':'#394b64');
    const hair=mat('#382a27'),white=mat('#f2ede2'),sole=mat('#d3d8d7'),eye=mat('#302b2a');
    function rounded(parent:Group,w:number,h:number,d:number,x:number,y:number,z:number,material:MeshStandardMaterial,r=0.04){
      const mesh=new Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/3,h/3,d/3)),material);
      mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
    }
    function oval(parent:Group,x:number,y:number,z:number,sx:number,sy:number,sz:number,material:MeshStandardMaterial){
      const mesh=new Mesh(new SphereGeometry(1,24,16),material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;
    }
    function limb(parent:Group,r:number,length:number,y:number,material:MeshStandardMaterial){
      const mesh=new Mesh(new CapsuleGeometry(r,Math.max(0.01,length-2*r),6,12),material);mesh.position.y=y;mesh.castShadow=true;parent.add(mesh);
    }
    const shoulder=child?1.13:1.32,torsoHeight=shoulder-hipHeight;
    rounded(group,child?0.35:0.39,torsoHeight,0.235,0,hipHeight+torsoHeight/2,0,shirt,0.075);
    rounded(group,0.30,0.14,0.23,0,hipHeight+0.005,0,pants,0.045);
    rounded(group,0.34,0.035,0.245,0,hipHeight+0.07,0,shirt,0.01);
    oval(group,0,shoulder+0.025,0,0.065,0.085,0.064,skin);
    rounded(group,0.14,0.035,0.18,0,shoulder-0.025,-0.024,white,0.01);
    rounded(group,0.075,0.10,0.012,-0.10,shoulder-0.16,-0.122,shirt,0.008);
    const headRadius=child?0.185:0.139,headY=child?1.435:1.535;
    oval(group,0,headY,0,headRadius*0.86,headRadius*1.12,headRadius*0.86,skin);
    const cap=new Mesh(new SphereGeometry(1,24,16,0,Math.PI*2,0,Math.PI*0.53),hair);
    cap.scale.set(headRadius*0.89,headRadius*1.15,headRadius*0.9);cap.position.set(0,headY+0.01,0.012);cap.castShadow=true;group.add(cap);
    for(const side of [-1,1]){
      oval(group,side*headRadius*0.84,headY-0.005,0,0.022,0.033,0.026,skin);
      oval(group,side*headRadius*0.33,headY+0.005,-headRadius*0.81,0.018,0.023,0.012,white);
      oval(group,side*headRadius*0.33,headY+0.004,-headRadius*0.88,0.009,0.012,0.006,eye);
      rounded(group,0.038,0.012,0.012,side*headRadius*0.33,headY+0.045,-headRadius*0.8,hair,0.004);
      const fringe=oval(group,side*0.042,headY+headRadius*0.54,-headRadius*0.63,headRadius*0.48,0.032,0.037,hair);fringe.rotation.z=side*0.15;
      const thighLength=(hipHeight-0.10)/2,calfLength=thighLength;
      const leg=new Group();leg.position.set(side*0.088,hipHeight,0);group.add(leg);legs.push(leg);
      limb(leg,0.065,thighLength+0.025,-thighLength/2,pants);
      const knee=new Group();knee.position.y=-thighLength;leg.add(knee);knees.push(knee);
      limb(knee,0.052,calfLength+0.025,-calfLength/2,pants);
      rounded(knee,0.135,0.085,0.245,0,-calfLength-0.045,-0.044,white,0.035);
      rounded(knee,0.14,0.028,0.25,0,-calfLength-0.085,-0.044,sole,0.01);
      rounded(knee,0.085,0.012,0.08,0,-calfLength-0.006,-0.08,sole,0.004);
      const arm=new Group();arm.position.set(side*(child?0.215:0.24),shoulder-0.025,0);group.add(arm);arms.push(arm);
      const upper=child?0.21:0.24,lower=child?0.20:0.24;
      limb(arm,0.068,upper+0.035,-upper/2,shirt);
      const elbow=new Group();elbow.position.y=-upper;arm.add(elbow);elbows.push(elbow);
      limb(elbow,0.043,lower,-lower/2,skin);
      oval(elbow,0,-lower-0.014,-0.006,0.044,0.061,0.033,skin);
    }
    oval(group,0,headY-0.025,-headRadius*0.88,0.025,0.03,0.028,skin);
    rounded(group,0.042,0.009,0.008,0,headY-0.069,-headRadius*0.80,mat('#a9655a'),0.003);
    // Normalize before the controller applies real-world height. Temporarily
    // neutralize root transforms so switching a scaled/moved character is safe.
    const position=group.position.clone(),rotation=group.quaternion.clone(),scale=group.scale.clone();
    group.position.set(0,0,0);group.quaternion.identity();group.scale.setScalar(1);
    const bounds=new Box3().setFromObject(group),factor=1.7/(bounds.max.y-bounds.min.y);
    for(const child of group.children){child.position.y-=bounds.min.y;child.position.multiplyScalar(factor);child.scale.multiplyScalar(factor);}
    hipHeight=(hipHeight-bounds.min.y)*factor;
    group.position.copy(position);group.quaternion.copy(rotation);group.scale.copy(scale);group.updateMatrixWorld(true);
  }
  rebuild(initial);
  return {group,get hipHeight(){return hipHeight;},setKind:rebuild,
    pose:(pose:'stand'|'sit'|'lie')=>{
      group.rotation.x=pose==='lie'?-Math.PI/2:0;
      legs.forEach(leg=>leg.rotation.x=pose==='sit'?Math.PI/2:0);
      knees.forEach(knee=>knee.rotation.x=pose==='sit'?-Math.PI/2:0);
      arms.forEach(arm=>arm.rotation.x=pose==='sit'?0.25:0);
      elbows.forEach(elbow=>elbow.rotation.x=pose==='sit'?0.5:0.08);
    },animate:(phase:number,moving:boolean)=>{
      const swing=moving?Math.sin(phase)*0.38:0;
      legs[0].rotation.x=swing;legs[1].rotation.x=-swing;
      knees.forEach((knee,i)=>knee.rotation.x=moving?-Math.max(0,Math.sin(phase+i*Math.PI))*0.3:0);
      arms[0].rotation.x=-swing;arms[1].rotation.x=swing;
      elbows.forEach(elbow=>elbow.rotation.x=moving?0.18:0.08);
    }};
}
