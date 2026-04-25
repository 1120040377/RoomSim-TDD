import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const studyTemplate: TemplateMeta = {
  id: 'study',
  name: '书房',
  area: '10㎡',
  description: '书桌 + 书架 + 单椅',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);
    // 350×290 cm
    const w = buildClosedWalls(p, [
      [0, 0],
      [350, 0],
      [350, 290],
      [0, 290],
    ]);
    addDoor(p, w[0], 80, 80);
    addWindow(p, w[1], 145, 120);
    addFurniture(p, 'desk', { x: 175, y: 50 }, 0);
    addFurniture(p, 'office-chair', { x: 175, y: 130 });
    addFurniture(p, 'bookshelf', { x: 310, y: 145 }, 0);
    addFurniture(p, 'bookshelf', { x: 45, y: 145 }, 0);
    addFurniture(p, 'armchair', { x: 175, y: 230 });
    addFurniture(p, 'lamp-ceiling', { x: 175, y: 145 });
    recomputeRooms(p);
    return p;
  },
};
