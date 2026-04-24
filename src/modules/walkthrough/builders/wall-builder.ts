import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { Opening, Plan, Wall } from '@/modules/model/types';
import { splitWallIntoSlabs } from '@/modules/geometry/opening-cut';
import { CM_TO_M, toYawFromEditorAngle, wallAngle, wallLengthCm } from '../coord';

const WALL_COLOR = 0xf5f0e8;

export interface BuildWallsResult {
  group: Group;
  /** 墙 id → 由该墙生成的 slab Mesh 列表（便于后续做选中高亮） */
  meshesByWallId: Record<string, Mesh[]>;
}

export function buildWalls(plan: Plan): BuildWallsResult {
  const group = new Group();
  group.name = 'walls';
  const meshesByWallId: Record<string, Mesh[]> = {};

  const material = new MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.9 });

  for (const wall of Object.values(plan.walls)) {
    const openings = Object.values(plan.openings).filter((o) => o.wallId === wall.id);
    const { group: g, meshes } = buildSingleWall(wall, openings, plan, material);
    group.add(g);
    meshesByWallId[wall.id] = meshes;
  }

  return { group, meshesByWallId };
}

function buildSingleWall(
  wall: Wall,
  openings: Opening[],
  plan: Plan,
  material: MeshStandardMaterial,
): { group: Group; meshes: Mesh[] } {
  const g = new Group();
  g.name = `wall-${wall.id}`;
  (g as Object3D & { userData: Record<string, unknown> }).userData = { wallId: wall.id };

  const s = plan.nodes[wall.startNodeId];
  const e = plan.nodes[wall.endNodeId];
  if (!s || !e) return { group: g, meshes: [] };

  const length = wallLengthCm(s.position, e.position);
  const angle = wallAngle(s.position, e.position);
  const yaw = toYawFromEditorAngle(angle);

  const slabs = splitWallIntoSlabs(length, openings, wall.height);
  const meshes: Mesh[] = [];

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  for (const slab of slabs) {
    const geom = new BoxGeometry(
      slab.length * CM_TO_M,
      slab.height * CM_TO_M,
      wall.thickness * CM_TO_M,
    );
    const mesh = new Mesh(geom, material);

    // 墙中心沿墙方向 startOffset + length/2 的 editor 位置
    const alongWall = slab.startOffset + slab.length / 2;
    const editorX = s.position.x + cosA * alongWall;
    const editorY = s.position.y + sinA * alongWall;

    mesh.position.set(
      editorX * CM_TO_M,
      (slab.bottomZ + slab.height / 2) * CM_TO_M,
      editorY * CM_TO_M,
    );
    mesh.rotation.y = yaw;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = `wall-${wall.id}-slab`;
    (mesh as Object3D & { userData: Record<string, unknown> }).userData = { wallId: wall.id };

    g.add(mesh);
    meshes.push(mesh);
  }

  return { group: g, meshes };
}
