import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const bathroomTemplate: TemplateMeta = {
  id: 'bathroom',
  name: '卫生间',
  area: '6㎡',
  description: '马桶 + 洗手池 + 淋浴',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);
    // 240×250 cm
    const w = buildClosedWalls(p, [
      [0, 0],
      [240, 0],
      [240, 250],
      [0, 250],
    ]);
    addDoor(p, w[0], 60, 75);
    addWindow(p, w[1], 125, 60);
    addFurniture(p, 'toilet', { x: 40, y: 60 });
    addFurniture(p, 'basin', { x: 40, y: 190 }, 0);
    addFurniture(p, 'shower', { x: 180, y: 155 }, 0);
    recomputeRooms(p);
    return p;
  },
};
