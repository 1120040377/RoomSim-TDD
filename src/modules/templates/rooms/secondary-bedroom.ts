import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const secondaryBedroomTemplate: TemplateMeta = {
  id: 'secondary-bedroom',
  name: '次卧 / 儿童房',
  area: '12㎡',
  description: '单人床 + 书桌 + 收纳',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);
    // 350×345 cm
    const w = buildClosedWalls(p, [
      [0, 0],
      [350, 0],
      [350, 345],
      [0, 345],
    ]);
    addDoor(p, w[0], 80, 80);
    addWindow(p, w[2], 175, 150);
    addFurniture(p, 'bed-single', { x: 175, y: 110 });
    addFurniture(p, 'side-table', { x: 80, y: 40 });
    addFurniture(p, 'wardrobe-2', { x: 295, y: 290 }, 0);
    addFurniture(p, 'desk', { x: 80, y: 290 }, 0);
    addFurniture(p, 'office-chair', { x: 80, y: 220 });
    addFurniture(p, 'lamp-ceiling', { x: 175, y: 175 });
    recomputeRooms(p);
    return p;
  },
};
