import { nanoid } from 'nanoid';
import type { Plan, Vec2, Opening, Furniture, FurnitureType } from '@/modules/model/types';
import { createEmptyPlan } from '@/modules/model/defaults';
import { FURNITURE_CATALOG } from './furniture-catalog';
import { detectRooms } from '@/modules/geometry/room-detect';
import { polygonArea } from '@/modules/geometry/vec2';

export { createEmptyPlan, nanoid };

export interface TemplateMeta {
  id: string;
  name: string;
  area: string;
  description: string;
  thumbnail?: string;
  build: (planName: string) => Plan;
}

type CornerSpec = [number, number];

export function buildClosedWalls(
  plan: Plan,
  corners: CornerSpec[],
  thickness = 12,
  height = 280,
): string[] {
  const closed = corners.length >= 3;
  return buildWallSeq(plan, corners, closed, thickness, height);
}

function buildWallSeq(
  plan: Plan,
  corners: CornerSpec[],
  closed: boolean,
  thickness: number,
  height: number,
): string[] {
  const nodeIds: string[] = corners.map(() => nanoid());
  corners.forEach((c, i) => {
    plan.nodes[nodeIds[i]] = { id: nodeIds[i], position: { x: c[0], y: c[1] } };
  });
  const wallIds: string[] = [];
  const segCount = closed ? corners.length : corners.length - 1;
  for (let i = 0; i < segCount; i++) {
    const id = nanoid();
    plan.walls[id] = {
      id,
      startNodeId: nodeIds[i],
      endNodeId: nodeIds[(i + 1) % corners.length],
      thickness,
      height,
    };
    wallIds.push(id);
  }
  return wallIds;
}

export function addFurniture(
  plan: Plan,
  type: FurnitureType,
  position: Vec2,
  rotation = 0,
): string {
  const id = nanoid();
  const def = FURNITURE_CATALOG[type];
  const f: Furniture = {
    id,
    type,
    position,
    rotation,
    size: { ...def.size },
    color: def.defaultColor,
    wallAligned: def.wallAligned,
  };
  plan.furniture[id] = f;
  return id;
}

export function addDoor(
  plan: Plan,
  wallId: string,
  offset: number,
  width = 90,
  hinge: 'start' | 'end' = 'start',
): string {
  const id = nanoid();
  const door: Opening = {
    id,
    kind: 'door',
    wallId,
    offset,
    width,
    height: 210,
    sillHeight: 0,
    hinge,
    swing: 'inside',
  };
  plan.openings[id] = door;
  return id;
}

export function addWindow(
  plan: Plan,
  wallId: string,
  offset: number,
  width = 120,
): string {
  const id = nanoid();
  const win: Opening = {
    id,
    kind: 'window',
    wallId,
    offset,
    width,
    height: 140,
    sillHeight: 90,
  };
  plan.openings[id] = win;
  return id;
}

export function mergeCoincidentNodes(plan: Plan, tolerance = 1): void {
  const nodes = Object.values(plan.nodes);
  const toRemove = new Set<string>();
  const remap = new Map<string, string>();

  for (let i = 0; i < nodes.length; i++) {
    if (toRemove.has(nodes[i].id)) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      if (toRemove.has(nodes[j].id)) continue;
      const dx = nodes[i].position.x - nodes[j].position.x;
      const dy = nodes[i].position.y - nodes[j].position.y;
      if (Math.hypot(dx, dy) < tolerance) {
        remap.set(nodes[j].id, nodes[i].id);
        toRemove.add(nodes[j].id);
      }
    }
  }

  for (const wall of Object.values(plan.walls)) {
    if (remap.has(wall.startNodeId)) wall.startNodeId = remap.get(wall.startNodeId)!;
    if (remap.has(wall.endNodeId)) wall.endNodeId = remap.get(wall.endNodeId)!;
  }
  for (const id of toRemove) delete plan.nodes[id];
}

export function recomputeRooms(plan: Plan): void {
  mergeCoincidentNodes(plan);
  const faces = detectRooms(plan.nodes, plan.walls);
  plan.rooms = {};
  let idx = 1;
  for (const f of faces) {
    const id = `room-${idx++}`;
    plan.rooms[id] = {
      id,
      name: `房间 ${idx - 1}`,
      polygon: f.polygon,
      wallIds: f.wallIds,
      area: polygonArea(f.polygon) / 10_000,
    };
  }
}
