import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { Door, Plan, Wall, Window } from '@/modules/model/types';
import { CM_TO_M, wallAngle, toYawFromEditorAngle } from '../coord';

const DOOR_PANEL_COLOR = 0x8b5a2b;
const WINDOW_GLASS_COLOR = 0xa6d4ff;
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

  for (const op of Object.values(plan.openings)) {
    const wall = plan.walls[op.wallId];
    if (!wall) continue;
    if (op.kind === 'door') {
      const { group: g, pivot } = buildDoor(op, wall, plan);
      group.add(g);
      doorPivots[op.id] = pivot;
    } else {
      group.add(buildWindow(op, wall, plan));
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
  const geom = new BoxGeometry(door.width * CM_TO_M, door.height * CM_TO_M, DOOR_THICKNESS_CM * CM_TO_M);
  // geometry 原点移到左端（绕铰链转）
  geom.translate((door.width * CM_TO_M) / 2, 0, 0);
  const mat = new MeshStandardMaterial({ color: DOOR_PANEL_COLOR, roughness: 0.6 });
  const panel = new Mesh(geom, mat);
  panel.name = `door-panel-${door.id}`;
  (panel.userData as Record<string, unknown>).openingId = door.id;
  (panel.userData as Record<string, unknown>).interactable = {
    kind: 'door',
    targetId: door.id,
    hint: '按 E 开关门',
  };
  pivot.add(panel);

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
  const geom = new BoxGeometry(win.width * CM_TO_M, win.height * CM_TO_M, 2 * CM_TO_M);
  const mat = new MeshStandardMaterial({
    color: new Color(WINDOW_GLASS_COLOR),
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    metalness: 0.1,
  });
  const mesh = new Mesh(geom, mat);
  mesh.position.set(centerEditorX * CM_TO_M, centerZ * CM_TO_M, centerEditorY * CM_TO_M);
  mesh.rotation.y = yaw;
  g.add(mesh);
  return g;
}
