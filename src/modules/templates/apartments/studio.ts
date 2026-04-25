import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const studioTemplate: TemplateMeta = {
  id: 'studio',
  name: '单间公寓',
  area: '35㎡',
  description: '开放式：睡眠区 + 起居区 + 厨房 + 独立卫生间',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);

    // 外轮廓：700×500 cm
    const outer = buildClosedWalls(p, [
      [0, 0],
      [700, 0],
      [700, 500],
      [0, 500],
    ]);

    // 卫生间（左上角 200×200）
    buildClosedWalls(p, [[0, 200], [200, 200]]);
    buildClosedWalls(p, [[200, 0], [200, 200]]);

    addDoor(p, outer[0], 350, 90);
    addWindow(p, outer[2], 530, 180);
    addWindow(p, outer[1], 250, 150);

    // 卫生间
    addFurniture(p, 'toilet', { x: 40, y: 60 });
    addFurniture(p, 'basin', { x: 40, y: 155 }, 0);
    addFurniture(p, 'shower', { x: 145, y: 110 }, 0);

    // 睡眠区（右上）
    addFurniture(p, 'bed-double', { x: 530, y: 110 });
    addFurniture(p, 'side-table', { x: 380, y: 50 });
    addFurniture(p, 'wardrobe-2', { x: 650, y: 80 }, 0);

    // 厨房区（左下）
    addFurniture(p, 'fridge', { x: 45, y: 290 }, 0);
    addFurniture(p, 'sink', { x: 45, y: 390 }, 0);
    addFurniture(p, 'stove', { x: 130, y: 460 }, Math.PI / 2);
    addFurniture(p, 'kitchen-counter', { x: 220, y: 460 }, Math.PI / 2);

    // 起居区（右下）
    addFurniture(p, 'sofa-3', { x: 530, y: 420 }, Math.PI);
    addFurniture(p, 'coffee-table', { x: 490, y: 340 }, 0);
    addFurniture(p, 'tv-cabinet', { x: 420, y: 270 }, 0);
    addFurniture(p, 'tv', { x: 420, y: 260 }, 0);

    addFurniture(p, 'lamp-ceiling', { x: 100, y: 100 });
    addFurniture(p, 'lamp-ceiling', { x: 530, y: 120 });
    addFurniture(p, 'lamp-ceiling', { x: 490, y: 360 });

    recomputeRooms(p);
    return p;
  },
};
