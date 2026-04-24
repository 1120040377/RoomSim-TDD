import { nanoid } from 'nanoid';
import type { Plan, Vec2, Opening, Furniture, FurnitureType } from '@/modules/model/types';
import { createEmptyPlan } from '@/modules/model/defaults';
import { FURNITURE_CATALOG } from './furniture-catalog';
import { detectRooms } from '@/modules/geometry/room-detect';
import { polygonArea } from '@/modules/geometry/vec2';

export interface TemplateMeta {
  id: string;
  name: string;
  area: string;
  description: string;
  thumbnail?: string;
  build: (planName: string) => Plan;
}

type CornerSpec = [number, number];

/** 辅助：按角点顺序连成闭合墙（首尾相接）。仅 2 点时降级为单段，避免重叠。*/
function buildClosedWalls(
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

function addFurniture(
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

function addDoor(
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

function addWindow(
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

/** 合并同坐标（< 1cm）的节点 —— 模板内外墙共享端点的场景。*/
function mergeCoincidentNodes(plan: Plan, tolerance = 1): void {
  const nodes = Object.values(plan.nodes);
  const toRemove = new Set<string>();
  const remap = new Map<string, string>(); // old id → keep id

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

function recomputeRooms(plan: Plan): void {
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

/* ---------------------------- 模板定义 ---------------------------- */

const blankTemplate: TemplateMeta = {
  id: 'blank',
  name: '空白',
  area: '—',
  description: '从零开始画',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);
    return p;
  },
};

const oneRoomTemplate: TemplateMeta = {
  id: 'one-bed-one-living',
  name: '一室一厅',
  area: '50㎡',
  description: '客厅 + 卧室 + 卫生间 + 厨房',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);

    // 外轮廓：矩形 800x625 cm (50㎡)
    const outerWalls = buildClosedWalls(p, [
      [0, 0],
      [800, 0],
      [800, 625],
      [0, 625],
    ]);

    // 客厅 ↔ 卧室 内墙
    buildClosedWalls(p, [
      [400, 0],
      [400, 300],
    ]);
    // 卧室/卫生间 分隔
    buildClosedWalls(p, [
      [400, 300],
      [800, 300],
    ]);
    // 卫生间/厨房
    buildClosedWalls(p, [
      [400, 300],
      [400, 625],
    ]);

    // 入户门（下墙中段）
    addDoor(p, outerWalls[0], 200, 90);
    // 客厅窗（左墙中段）
    addWindow(p, outerWalls[3], 150, 150);
    // 卧室窗（右墙上段）
    addWindow(p, outerWalls[1], 150, 150);

    // 家具布置
    addFurniture(p, 'sofa-3', { x: 150, y: 500 }, 0);
    addFurniture(p, 'coffee-table', { x: 150, y: 400 }, 0);
    addFurniture(p, 'tv-cabinet', { x: 150, y: 330 }, 0);
    addFurniture(p, 'bed-double', { x: 600, y: 150 }, 0);
    addFurniture(p, 'wardrobe-2', { x: 750, y: 100 }, Math.PI / 2);
    addFurniture(p, 'side-table', { x: 500, y: 50 }, 0);

    recomputeRooms(p);
    return p;
  },
};

/* ------------------------ 主卧 18㎡ ------------------------ */
const masterBedroomTemplate: TemplateMeta = {
  id: 'master-bedroom',
  name: '主卧',
  area: '18㎡',
  description: '单间练手：床 + 衣柜 + 书桌',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);
    // 450 x 400 cm
    const w = buildClosedWalls(p, [
      [0, 0],
      [450, 0],
      [450, 400],
      [0, 400],
    ]);
    addDoor(p, w[0], 100, 90);
    addWindow(p, w[2], 225, 180);
    addFurniture(p, 'bed-double', { x: 225, y: 150 });
    addFurniture(p, 'side-table', { x: 130, y: 50 });
    addFurniture(p, 'side-table', { x: 320, y: 50 });
    addFurniture(p, 'wardrobe-3', { x: 375, y: 330 }, 0);
    addFurniture(p, 'desk', { x: 60, y: 330 }, 0);
    addFurniture(p, 'office-chair', { x: 60, y: 260 });
    addFurniture(p, 'lamp-ceiling', { x: 225, y: 200 });
    recomputeRooms(p);
    return p;
  },
};

/* ------------------------ 两室一厅 70㎡ ------------------------ */
const twoRoomTemplate: TemplateMeta = {
  id: 'two-bed-one-living',
  name: '两室一厅',
  area: '70㎡',
  description: '主卧 + 次卧 + 客厅 + 厨卫',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);
    // 1000 x 700 cm
    const outer = buildClosedWalls(p, [
      [0, 0],
      [1000, 0],
      [1000, 700],
      [0, 700],
    ]);
    // 主卧（右上）分隔
    buildClosedWalls(p, [
      [550, 0],
      [550, 400],
    ]);
    buildClosedWalls(p, [
      [550, 400],
      [1000, 400],
    ]);
    // 次卧（左上）
    buildClosedWalls(p, [
      [0, 400],
      [550, 400],
    ]);
    // 卫生间（右下一角 250x250）
    buildClosedWalls(p, [
      [750, 400],
      [750, 650],
    ]);
    buildClosedWalls(p, [
      [750, 650],
      [1000, 650],
    ]);
    // 厨房（左下一角）
    buildClosedWalls(p, [
      [300, 400],
      [300, 700],
    ]);

    addDoor(p, outer[0], 500, 90); // 入户门
    addWindow(p, outer[2], 700, 180); // 客厅阳台窗
    addWindow(p, outer[1], 200, 180); // 主卧窗

    // 主卧
    addFurniture(p, 'bed-double', { x: 780, y: 120 });
    addFurniture(p, 'side-table', { x: 670, y: 50 });
    addFurniture(p, 'wardrobe-3', { x: 925, y: 350 }, 0);
    // 次卧
    addFurniture(p, 'bed-single', { x: 280, y: 120 });
    addFurniture(p, 'desk', { x: 80, y: 350 }, 0);
    addFurniture(p, 'office-chair', { x: 80, y: 280 });
    // 客厅
    addFurniture(p, 'sofa-3', { x: 450, y: 620 });
    addFurniture(p, 'coffee-table', { x: 450, y: 530 });
    addFurniture(p, 'tv-cabinet', { x: 450, y: 440 });
    addFurniture(p, 'tv', { x: 450, y: 410 });
    // 厨房
    addFurniture(p, 'fridge', { x: 50, y: 440 }, 0);
    addFurniture(p, 'stove', { x: 50, y: 540 }, 0);
    addFurniture(p, 'sink', { x: 250, y: 440 }, Math.PI);
    // 卫生间
    addFurniture(p, 'toilet', { x: 820, y: 450 });
    addFurniture(p, 'shower', { x: 940, y: 580 });
    addFurniture(p, 'basin', { x: 820, y: 620 });
    // 灯
    addFurniture(p, 'lamp-ceiling', { x: 450, y: 560 });
    addFurniture(p, 'lamp-ceiling', { x: 780, y: 150 });
    addFurniture(p, 'lamp-ceiling', { x: 280, y: 150 });
    recomputeRooms(p);
    return p;
  },
};

/* ------------------------ 开放式厨房 12㎡ ------------------------ */
const openKitchenTemplate: TemplateMeta = {
  id: 'open-kitchen',
  name: '开放式厨房',
  area: '12㎡',
  description: '练手厨房工作三角',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);
    const w = buildClosedWalls(p, [
      [0, 0],
      [400, 0],
      [400, 300],
      [0, 300],
    ]);
    addDoor(p, w[0], 200, 90);
    addWindow(p, w[2], 200, 150);
    addFurniture(p, 'fridge', { x: 45, y: 60 }, 0);
    addFurniture(p, 'sink', { x: 200, y: 40 }, 0);
    addFurniture(p, 'stove', { x: 350, y: 40 }, 0);
    addFurniture(p, 'kitchen-counter', { x: 150, y: 260 }, 0);
    addFurniture(p, 'kitchen-counter', { x: 250, y: 260 }, 0);
    addFurniture(p, 'lamp-ceiling', { x: 200, y: 150 });
    recomputeRooms(p);
    return p;
  },
};

export const BUILT_IN_TEMPLATES: TemplateMeta[] = [
  blankTemplate,
  masterBedroomTemplate,
  oneRoomTemplate,
  twoRoomTemplate,
  openKitchenTemplate,
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}
