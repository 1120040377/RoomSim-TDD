import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const livingRoomTemplate: TemplateMeta = {
  id: 'living-room',
  name: '客厅',
  area: '20㎡',
  description: '沙发 + 电视墙 + 茶几',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);
    // 500×400 cm
    const w = buildClosedWalls(p, [
      [0, 0],
      [500, 0],
      [500, 400],
      [0, 400],
    ]);
    addDoor(p, w[0], 100, 90);
    addWindow(p, w[2], 250, 200);
    addWindow(p, w[1], 200, 150);
    addFurniture(p, 'tv-cabinet', { x: 250, y: 30 }, 0);
    addFurniture(p, 'tv', { x: 250, y: 20 }, 0);
    addFurniture(p, 'sofa-l', { x: 340, y: 290 }, Math.PI);
    addFurniture(p, 'coffee-table', { x: 250, y: 220 }, 0);
    addFurniture(p, 'armchair', { x: 80, y: 270 }, 0);
    addFurniture(p, 'bookshelf', { x: 460, y: 200 }, 0);
    addFurniture(p, 'lamp-ceiling', { x: 250, y: 200 });
    addFurniture(p, 'lamp-floor', { x: 60, y: 350 });
    recomputeRooms(p);
    return p;
  },
};
