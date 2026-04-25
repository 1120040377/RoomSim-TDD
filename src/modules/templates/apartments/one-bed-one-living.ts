import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const oneBedOneLivingTemplate: TemplateMeta = {
  id: 'one-bed-one-living',
  name: '一室一厅',
  area: '50㎡',
  description: '客厅 + 卧室 + 卫生间 + 厨房',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);

    // 外轮廓：矩形 800×625 cm
    const outerWalls = buildClosedWalls(p, [
      [0, 0],
      [800, 0],
      [800, 625],
      [0, 625],
    ]);

    // 客厅 ↔ 卧室 内墙
    buildClosedWalls(p, [[400, 0], [400, 300]]);
    // 卧室/卫生间 分隔
    buildClosedWalls(p, [[400, 300], [800, 300]]);
    // 卫生间/厨房
    buildClosedWalls(p, [[400, 300], [400, 625]]);

    addDoor(p, outerWalls[0], 200, 90);
    addWindow(p, outerWalls[3], 150, 150);
    addWindow(p, outerWalls[1], 150, 150);

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
