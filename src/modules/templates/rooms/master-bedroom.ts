import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const masterBedroomTemplate: TemplateMeta = {
  id: 'master-bedroom',
  name: '主卧',
  area: '18㎡',
  description: '单间练手：床 + 衣柜 + 书桌',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);
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
