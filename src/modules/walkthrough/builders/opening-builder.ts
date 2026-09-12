import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three';
import { glassMaterial, metalMaterial, paintedMaterial, woodMaterial } from './furniture/material-library';
import { addRoundedBox, roundedBoxGeometry } from './furniture/primitives';
import { batchStaticParts } from './batch-static-parts';
import type { Door, Plan, Wall, Window } from '@/modules/model/types';
import { CM_TO_M, wallAngle, toYawFromEditorAngle } from '../coord';
import { interiorWallIds } from '../inspection-cutaway';

const DOOR_THICKNESS_CM = 4;

export interface BuiltOpenings {
  group: Group;
  /** opening id → 门板 pivot（供交互时切换 rotation.y 实现开合） */
  doorPivots: Record<string, Group>;
}

export function buildOpenings(plan: Plan): BuiltOpenings {
  const group = new Group();
  group.name = 'openings';
  const doorPivots: Record<string, Group> = {};
  const interiorWalls=interiorWallIds(plan);
  function markPartition(g:Group,wallId:string) {
    g.traverse(object=>{
      if(!(object instanceof Mesh))return;
      for(const material of Array.isArray(object.material)?object.material:[object.material])material.userData.interiorPartition=interiorWalls.has(wallId);
    });
    return g;
  }

  for (const op of Object.values(plan.openings)) {
    const wall = plan.walls[op.wallId];
    if (!wall) continue;
    if (op.kind === 'door') {
      if(op.passage)continue;
      const { group: g, pivot } = buildDoor(op, wall, plan);
      group.add(markPartition(g,wall.id));
      doorPivots[op.id] = pivot;
    } else {
      group.add(markPartition(buildWindow(op, wall, plan),wall.id));
    }
  }

  return { group, doorPivots };
}

/** 门板附在铰链处，通过 pivot 旋转实现开合。*/
function buildDoor(door: Door, wall: Wall, plan: Plan): { group: Group; pivot: Group } {
  const s = plan.nodes[wall.startNodeId];
  const e = plan.nodes[wall.endNodeId];
  const angle = wallAngle(s.position, e.position);
  const yaw = toYawFromEditorAngle(angle);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // 铰链 editor 位置：hinge='start' → offset - width/2；否则 offset + width/2
  const hingeAlong = door.hinge === 'start' ? door.offset - door.width / 2 : door.offset + door.width / 2;
  const hingeEditorX = s.position.x + cosA * hingeAlong;
  const hingeEditorY = s.position.y + sinA * hingeAlong;

  const wrapper = new Group();
  wrapper.name = `door-${door.id}`;

  const pivot = new Group();
  pivot.name = `door-pivot-${door.id}`;
  pivot.position.set(hingeEditorX * CM_TO_M, (door.height * CM_TO_M) / 2, hingeEditorY * CM_TO_M);

  // 当门铰在 start：沿墙方向即为门板"展开方向"；hinge=end 时取反向
  const panelDirSign = door.hinge === 'start' ? 1 : -1;
  const baseYaw = yaw + (panelDirSign === 1 ? 0 : Math.PI);
  pivot.rotation.y = baseYaw;

  // 门板从 pivot 原点朝 +x 延伸 width
  const width=door.width*CM_TO_M,height=door.height*CM_TO_M;
  const geom = roundedBoxGeometry(width,height,DOOR_THICKNESS_CM*CM_TO_M,0.003,1);
  // geometry 原点移到左端（绕铰链转）
  geom.translate((door.width * CM_TO_M) / 2, 0, 0);
  const mat = woodMaterial('#aa8963', 23);
  const panel = new Mesh(geom, mat);
  panel.name = `door-panel-${door.id}`;
  panel.castShadow=panel.receiveShadow=true;
  (panel.userData as Record<string, unknown>).openingId = door.id;
  (panel.userData as Record<string, unknown>).interactable = {
    kind: 'door',
    targetId: door.id,
    hint: '按 E 开关门',
  };
  pivot.add(panel);
  // Keep the panel as pivot.children[0]: runtime collision uses that exact slab.
  const hardware=new Group(),metal=metalMaterial('#a09682',0.38);
  const handleX=width-Math.min(0.065,width*0.12),handleY=Math.min(1.0,height*0.48)-height/2;
  for(const side of [-1,1]){
    addRoundedBox(hardware,0.032,0.13,0.008,metal,handleX,handleY,side*0.024,0.004,1);
    addRoundedBox(hardware,0.018,0.018,0.055,metal,handleX,handleY,side*0.045,0.004,1);
    addRoundedBox(hardware,Math.min(0.105,width*0.18),0.018,0.018,metal,handleX-0.035,handleY,side*0.073,0.004,1);
  }
  batchStaticParts(hardware);
  hardware.traverse(o=>{o.userData.interactable=panel.userData.interactable;o.userData.openingId=door.id;});
  pivot.add(hardware);

  const casing=new Group(),paint=paintedMaterial('#ded7ca',0.75);
  const trim=0.035,trimDepth=wall.thickness*CM_TO_M+0.025;
  for(const x of [-trim/2,width+trim/2])addRoundedBox(casing,trim,height,trimDepth,paint,x,0,0,0.003,1);
  addRoundedBox(casing,width+2*trim,trim,trimDepth,paint,width/2,height/2+trim/2,0,0.003,1);
  batchStaticParts(casing);casing.position.copy(pivot.position);casing.rotation.y=baseYaw;
  wrapper.add(casing);

  // 初始开合 + pivot 上存 baseYaw/state/panelDirSign 方便后续动画
  const state = door.state ?? 0;
  pivot.rotation.y = baseYaw - (Math.PI / 2) * panelDirSign * state;
  (pivot.userData as Record<string, unknown>).baseYaw = baseYaw;
  (pivot.userData as Record<string, unknown>).state = state;
  (pivot.userData as Record<string, unknown>).panelDirSign = panelDirSign;

  (wrapper.userData as Record<string, unknown>).openingId = door.id;
  wrapper.add(pivot);
  return { group: wrapper, pivot };
}

function buildWindow(win: Window, wall: Wall, plan: Plan): Group {
  const s = plan.nodes[wall.startNodeId];
  const e = plan.nodes[wall.endNodeId];
  const angle = wallAngle(s.position, e.position);
  const yaw = toYawFromEditorAngle(angle);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const centerEditorX = s.position.x + cosA * win.offset;
  const centerEditorY = s.position.y + sinA * win.offset;
  const centerZ = win.sillHeight + win.height / 2;

  const g = new Group();
  g.name = `window-${win.id}`;
  const w=win.width*CM_TO_M,h=win.height*CM_TO_M;
  const rail=Math.min(0.045,w*0.08,h*0.08),depth=0.065;
  const frame=paintedMaterial('#707a70',0.55);frame.metalness=0.25;
  // Millimetre-scale extruded metal chamfers need one bevel segment, not the
  // denser rounded corners used by upholstered and large furniture pieces.
  for(const x of [-w/2+rail/2,w/2-rail/2])addRoundedBox(g,rail,h,depth,frame,x,0,0,0.006,1);
  for(const y of [-h/2+rail/2,h/2-rail/2])addRoundedBox(g,w-2*rail,rail,depth,frame,0,y,0,0.006,1);
  if(w>1.2)addRoundedBox(g,rail,h-2*rail,depth,frame,0,0,0,0.006,1);
  // Recessed glazing beads distinguish the glass seat from the outer extrusion.
  // Small straight sections share the frame material and its existing merged draw.
  const bead=Math.min(0.018,rail*.4),beadDepth=0.012;
  const bays=w>1.2?[[-w/2+rail,-rail/2],[rail/2,w/2-rail]]:[[-w/2+rail,w/2-rail]];
  const strip=(width:number,height:number,x:number,y:number,z:number)=>{
    const mesh=new Mesh(new BoxGeometry(width,height,beadDepth),frame);
    mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
  };
  for(const [left,right] of bays)for(const side of [-1,1]){
    const z=side*(depth/2-beadDepth/2-0.009),bottom=-h/2+rail,top=h/2-rail;
    for(const x of [left+bead/2,right-bead/2])strip(bead,top-bottom,x,0,z);
    for(const y of [bottom+bead/2,top-bead/2])strip(right-left-2*bead,bead,(left+right)/2,y,z);
  }
  const sill=paintedMaterial('#dbd5c8',0.78);
  addRoundedBox(g,w,0.025,Math.max(wall.thickness*CM_TO_M,depth)+0.035,sill,0,-h/2+0.0125,0,0.004,1);
  // A single two-sided pane avoids sorting front/back faces of a transparent box.
  // Transmission stays disabled: glazing must not force a second whole-scene pass.
  const glass=glassMaterial('#eef3ef');glass.opacity=0.16;glass.side=DoubleSide;
  glass.forceSinglePass=true;
  const pane=new Mesh(new PlaneGeometry(w-2*rail,h-2*rail),glass);pane.name='window-glass';
  pane.receiveShadow=false;pane.castShadow=false;g.add(pane);
  // Both wall orientations are used in plans, so put a small handle on each side.
  const handleX=w>1.2?rail*1.15:-w/2+rail*1.4;
  for(const z of [-1,1]){
    addRoundedBox(g,rail*0.35,Math.min(0.12,h*0.16),0.018,frame,handleX,0,z*(depth/2+0.015),0.004,1);
    addRoundedBox(g,rail*0.4,0.025,0.025,frame,handleX,0.035,z*(depth/2+0.004),0.003,1);
  }
  batchStaticParts(g);
  g.position.set(centerEditorX*CM_TO_M,centerZ*CM_TO_M,centerEditorY*CM_TO_M);
  g.rotation.y=yaw;
  return g;
}
