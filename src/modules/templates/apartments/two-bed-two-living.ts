import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const twoBedTwoLivingTemplate: TemplateMeta = {
  id: 'two-bed-two-living',
  name: '两室两厅',
  area: '90㎡',
  description: '主卧 + 次卧 + 客厅 + 餐厅 + 厨房 + 卫生间',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);

    // 外轮廓：1200×750 cm
    const outer = buildClosedWalls(p, [
      [0, 0],
      [1200, 0],
      [1200, 750],
      [0, 750],
    ]);

    // 上下主分隔
    buildClosedWalls(p, [[0, 400], [1200, 400]]);
    // 次卧 / 主卧 分隔
    buildClosedWalls(p, [[400, 0], [400, 400]]);
    // 主卧 / 卫生间 分隔
    buildClosedWalls(p, [[800, 0], [800, 400]]);
    // 厨房 / 餐厅 分隔
    buildClosedWalls(p, [[250, 400], [250, 750]]);
    // 餐厅 / 客厅 分隔
    buildClosedWalls(p, [[550, 400], [550, 750]]);

    // 入户门（下墙）、窗
    addDoor(p, outer[0], 600, 90);
    addWindow(p, outer[3], 200, 180);   // 次卧窗
    addWindow(p, outer[3], 620, 180);   // 主卧窗
    addWindow(p, outer[2], 900, 240);   // 客厅大窗

    // 次卧（左上 400×400）
    addFurniture(p, 'bed-single', { x: 200, y: 120 });
    addFurniture(p, 'desk', { x: 60, y: 340 }, 0);
    addFurniture(p, 'office-chair', { x: 60, y: 270 });
    addFurniture(p, 'wardrobe-2', { x: 340, y: 350 }, 0);
    addFurniture(p, 'lamp-ceiling', { x: 200, y: 200 });

    // 主卧（中上 400×400）
    addFurniture(p, 'bed-kingsize', { x: 610, y: 150 });
    addFurniture(p, 'side-table', { x: 490, y: 50 });
    addFurniture(p, 'side-table', { x: 730, y: 50 });
    addFurniture(p, 'wardrobe-3', { x: 730, y: 340 }, 0);
    addFurniture(p, 'lamp-ceiling', { x: 610, y: 200 });

    // 卫生间（右上 400×400）
    addFurniture(p, 'toilet', { x: 870, y: 60 });
    addFurniture(p, 'basin', { x: 870, y: 180 }, 0);
    addFurniture(p, 'bathtub', { x: 1060, y: 200 }, Math.PI / 2);
    addFurniture(p, 'shower', { x: 1120, y: 60 }, 0);

    // 厨房（左下 250×350）
    addFurniture(p, 'fridge', { x: 45, y: 440 }, 0);
    addFurniture(p, 'sink', { x: 45, y: 560 }, 0);
    addFurniture(p, 'stove', { x: 45, y: 660 }, 0);
    addFurniture(p, 'kitchen-counter', { x: 165, y: 690 }, Math.PI / 2);

    // 餐厅（中下 300×350）
    addFurniture(p, 'dining-table-4', { x: 400, y: 575 });
    addFurniture(p, 'dining-chair', { x: 340, y: 540 });
    addFurniture(p, 'dining-chair', { x: 460, y: 540 });
    addFurniture(p, 'dining-chair', { x: 340, y: 620 });
    addFurniture(p, 'dining-chair', { x: 460, y: 620 });

    // 客厅（右下 650×350）
    addFurniture(p, 'tv-cabinet', { x: 875, y: 430 }, 0);
    addFurniture(p, 'tv', { x: 875, y: 420 }, 0);
    addFurniture(p, 'sofa-l', { x: 950, y: 650 }, Math.PI);
    addFurniture(p, 'coffee-table', { x: 875, y: 580 }, 0);
    addFurniture(p, 'armchair', { x: 620, y: 630 });
    addFurniture(p, 'lamp-ceiling', { x: 875, y: 575 });

    recomputeRooms(p);
    return p;
  },
};
