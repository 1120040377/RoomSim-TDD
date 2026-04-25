import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const openKitchenTemplate: TemplateMeta = {
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
