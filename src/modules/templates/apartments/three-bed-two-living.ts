import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildClosedWalls, addDoor, addWindow, addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';

export const threeBedTwoLivingTemplate: TemplateMeta = {
  id: 'three-bed-two-living',
  name: '三室两厅',
  area: '120㎡',
  description: '主卧（套间）+ 次卧×2 + 客厅 + 餐厅 + 厨房 + 卫生间×2',
  build: (name) => {
    const p = createEmptyPlan(nanoid(), name);

    // 外轮廓：1400×850 cm
    const outer = buildClosedWalls(p, [
      [0, 0],
      [1400, 0],
      [1400, 850],
      [0, 850],
    ]);

    // 上下主分隔（y=450）
    const [hDiv] = buildClosedWalls(p, [[0, 450], [1400, 450]]);

    // 上区（卧室带）分隔
    buildClosedWalls(p, [[350, 0], [350, 450]]);              // 次卧2 / 主卧
    const [vMasterEnsuite] = buildClosedWalls(p, [[600, 0], [600, 450]]); // 主卧 / 主卧卫生间
    buildClosedWalls(p, [[800, 0], [800, 450]]);              // 主卧卫生间 / 次卧1
    buildClosedWalls(p, [[1150, 0], [1150, 450]]);            // 次卧1 / 公共卫生间

    // 下区（公共区）分隔
    const [vKitchen] = buildClosedWalls(p, [[300, 450], [300, 850]]);   // 厨房 / 餐厅
    buildClosedWalls(p, [[650, 450], [650, 850]]);                       // 餐厅 / 客厅
    const [vPubBath] = buildClosedWalls(p, [[1150, 450], [1150, 850]]); // 客厅 / 公共卫生间

    // 门
    addDoor(p, outer[0], 700, 100);          // 入户门（前墙）
    addDoor(p, hDiv, 135, 80);               // 次卧2 门（x 135~215，在 0~350 范围内）
    addDoor(p, hDiv, 435, 90);               // 主卧 门（x 435~525，在 350~600 范围内）
    addDoor(p, hDiv, 920, 80);               // 次卧1 门（x 920~1000，在 800~1150 范围内）
    addDoor(p, hDiv, 1255, 80);              // 公卫上下连通（x 1255~1335，在 1150~1400 范围内）
    addDoor(p, vMasterEnsuite, 280, 75);     // 主卧套卫门
    addDoor(p, vPubBath, 80, 80);            // 公共卫生间入口（从客厅侧）
    addDoor(p, vKitchen, 200, 80);           // 厨房门

    // 窗
    addWindow(p, outer[3], 175, 160);        // 次卧2 窗
    addWindow(p, outer[3], 480, 160);        // 主卧 窗
    addWindow(p, outer[3], 975, 160);        // 次卧1 窗
    addWindow(p, outer[2], 900, 280);        // 客厅阳台大窗

    // 次卧2（左上 350×450）
    addFurniture(p, 'bed-single', { x: 175, y: 130 });
    addFurniture(p, 'wardrobe-2', { x: 295, y: 390 }, 0);
    addFurniture(p, 'desk', { x: 60, y: 390 }, 0);
    addFurniture(p, 'office-chair', { x: 60, y: 320 });
    addFurniture(p, 'lamp-ceiling', { x: 175, y: 225 });

    // 主卧（350→600 × 450，即 250×450）
    addFurniture(p, 'bed-kingsize', { x: 480, y: 160 });
    addFurniture(p, 'side-table', { x: 380, y: 60 });
    addFurniture(p, 'side-table', { x: 570, y: 60 });
    addFurniture(p, 'wardrobe-3', { x: 480, y: 400 }, 0);
    addFurniture(p, 'lamp-ceiling', { x: 480, y: 225 });

    // 主卧套间卫生间（600→800 × 450，即 200×450）
    addFurniture(p, 'toilet', { x: 640, y: 60 });
    addFurniture(p, 'basin', { x: 640, y: 180 }, 0);
    addFurniture(p, 'shower', { x: 755, y: 360 }, 0);

    // 次卧1（800→1150 × 450，即 350×450）
    addFurniture(p, 'bed-double', { x: 975, y: 150 });
    addFurniture(p, 'side-table', { x: 860, y: 50 });
    addFurniture(p, 'side-table', { x: 1090, y: 50 });
    addFurniture(p, 'wardrobe-3', { x: 975, y: 390 }, 0);
    addFurniture(p, 'lamp-ceiling', { x: 975, y: 225 });

    // 公共卫生间（1150→1400 × 450，即 250×450）
    addFurniture(p, 'toilet', { x: 1210, y: 60 });
    addFurniture(p, 'basin', { x: 1210, y: 200 }, 0);
    addFurniture(p, 'bathtub', { x: 1330, y: 330 }, Math.PI / 2);

    // 厨房（左下 300×400）
    addFurniture(p, 'fridge', { x: 45, y: 490 }, 0);
    addFurniture(p, 'sink', { x: 45, y: 610 }, 0);
    addFurniture(p, 'stove', { x: 45, y: 720 }, 0);
    addFurniture(p, 'kitchen-counter', { x: 180, y: 800 }, Math.PI / 2);
    addFurniture(p, 'lamp-ceiling', { x: 150, y: 650 });

    // 餐厅（300→650 × 400，即 350×400）
    addFurniture(p, 'dining-table-6', { x: 475, y: 650 });
    addFurniture(p, 'dining-chair', { x: 380, y: 610 });
    addFurniture(p, 'dining-chair', { x: 475, y: 610 });
    addFurniture(p, 'dining-chair', { x: 570, y: 610 });
    addFurniture(p, 'dining-chair', { x: 380, y: 700 });
    addFurniture(p, 'dining-chair', { x: 475, y: 700 });
    addFurniture(p, 'dining-chair', { x: 570, y: 700 });
    addFurniture(p, 'lamp-ceiling', { x: 475, y: 650 });

    // 客厅（650→1150 × 400，即 500×400）
    addFurniture(p, 'tv-cabinet', { x: 900, y: 470 }, 0);
    addFurniture(p, 'tv', { x: 900, y: 460 }, 0);
    addFurniture(p, 'sofa-l', { x: 980, y: 770 }, Math.PI);
    addFurniture(p, 'coffee-table', { x: 900, y: 680 }, 0);
    addFurniture(p, 'armchair', { x: 700, y: 730 });
    addFurniture(p, 'bookshelf', { x: 660, y: 650 }, 0);
    addFurniture(p, 'lamp-ceiling', { x: 900, y: 660 });
    addFurniture(p, 'lamp-floor', { x: 680, y: 790 });

    recomputeRooms(p);
    return p;
  },
};
