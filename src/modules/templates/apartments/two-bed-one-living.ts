import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const twoBedOneLivingTemplate: TemplateMeta = {
  id: 'two-bed-one-living',
  name: '两室一厅',
  area: '70㎡',
  description: '主卧 + 次卧 + 客厅 + 厨卫',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);

    // 外轮廓：1000×700 cm
    const outer = buildClosedWalls(p, [
      [0, 0],
      [1000, 0],
      [1000, 700],
      [0, 700],
    ]);

    // 主卧（右上）分隔
    buildClosedWalls(p, [[550, 0], [550, 400]]);
    buildClosedWalls(p, [[550, 400], [1000, 400]]);
    // 次卧（左上）
    buildClosedWalls(p, [[0, 400], [550, 400]]);
    // 卫生间（右下角 250×250）
    buildClosedWalls(p, [[750, 400], [750, 650]]);
    buildClosedWalls(p, [[750, 650], [1000, 650]]);
    // 厨房（左下角）
    buildClosedWalls(p, [[300, 400], [300, 700]]);

    addDoor(p, outer[0], 500, 90);
    addWindow(p, outer[2], 700, 180);
    addWindow(p, outer[1], 200, 180);

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
