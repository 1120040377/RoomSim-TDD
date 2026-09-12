import type { FurnitureType, FurnitureSize } from '@/modules/model/types';

export type FurnitureCategory =
  | 'bedroom'
  | 'livingroom'
  | 'dining'
  | 'kitchen'
  | 'bathroom'
  | 'office'
  | 'lighting'
  | 'person';

export type InteractiveKind = 'door' | 'light' | 'switch' | 'tv';
export type MountPoint = 'floor' | 'wall' | 'ceiling';

export interface FurnitureDef {
  name: string;
  size: FurnitureSize;
  category: FurnitureCategory;
  defaultColor?: string;
  wallAligned?: boolean;
  mountPoint?: MountPoint;
  interactive?: InteractiveKind;
}

export const FURNITURE_CATALOG: Record<FurnitureType, FurnitureDef> = {
  'wall-mirror': { name: '椭圆金属框镜（环境反射）', size: { width: 60, depth: 3, height: 80 }, mountPoint: 'wall', wallAligned: true, category: 'bathroom', defaultColor: '#a28b61' },
  'kitchen-island': { name: '石材瀑布边岛台', size: { width: 180, depth: 85, height: 90 }, category: 'kitchen', defaultColor: '#aab19e' },
  'counter-stool': { name: '橡木高脚凳', size: { width: 42, depth: 42, height: 65 }, category: 'kitchen', defaultColor: '#b59670' },
  'botanical-vase': { name: '陶瓷枝叶花瓶', size: { width: 26, depth: 26, height: 35 }, category: 'dining', defaultColor: '#d6ccba' },
  'railing': { name: '金属栏杆', size: { width: 200, depth: 4, height: 105 }, category: 'livingroom', defaultColor: '#304f49' },
  'rug': { name: '编织地毯', size: { width: 240, depth: 170, height: 1 }, category: 'livingroom', defaultColor: '#bcaa88' },
  'floor-plant': { name: '阔叶盆栽', size: { width: 75, depth: 75, height: 145 }, category: 'livingroom', defaultColor: '#b7a58d' },
  'wall-cabinet': { name: '壁挂吊柜', size: { width: 80, depth: 32, height: 65 }, mountPoint: 'wall', wallAligned: true, category: 'kitchen' },
  'washing-machine': { name: '洗衣机', size: { width: 60, depth: 60, height: 85 }, category: 'bathroom' },
  // 卧室
  'bed-single': { name: '单人床', size: { width: 100, depth: 200, height: 45 }, defaultColor: '#d4b895', category: 'bedroom' },
  'bed-double': { name: '双人床', size: { width: 150, depth: 200, height: 45 }, defaultColor: '#d4b895', category: 'bedroom' },
  'bed-kingsize': { name: 'King 床', size: { width: 180, depth: 200, height: 45 }, defaultColor: '#d4b895', category: 'bedroom' },
  'wardrobe-2': { name: '两门衣柜', size: { width: 100, depth: 60, height: 220 }, wallAligned: true, category: 'bedroom' },
  'wardrobe-3': { name: '三门衣柜', size: { width: 150, depth: 60, height: 220 }, wallAligned: true, category: 'bedroom' },
  'side-table': { name: '床头柜', size: { width: 40, depth: 40, height: 50 }, category: 'bedroom' },

  // 客厅
  'sofa-2': { name: '双人沙发', size: { width: 150, depth: 90, height: 85 }, category: 'livingroom' },
  'sofa-3': { name: '三人沙发', size: { width: 210, depth: 90, height: 85 }, category: 'livingroom' },
  'sofa-l': { name: 'L 型沙发', size: { width: 250, depth: 180, height: 85 }, category: 'livingroom' },
  armchair: { name: '单椅', size: { width: 80, depth: 85, height: 85 }, category: 'livingroom' },
  'coffee-table': { name: '茶几', size: { width: 120, depth: 60, height: 40 }, category: 'livingroom' },
  'tv-cabinet': { name: '电视柜', size: { width: 180, depth: 40, height: 45 }, wallAligned: true, category: 'livingroom' },
  tv: { name: '电视', size: { width: 130, depth: 10, height: 75 }, wallAligned: true, interactive: 'tv', category: 'livingroom' },
  bookshelf: { name: '书架', size: { width: 90, depth: 30, height: 200 }, wallAligned: true, category: 'livingroom' },

  // 餐厨
  'dining-table-4': { name: '四人餐桌', size: { width: 120, depth: 80, height: 75 }, category: 'dining' },
  'dining-table-6': { name: '六人餐桌', size: { width: 180, depth: 90, height: 75 }, category: 'dining' },
  'dining-chair': { name: '餐椅', size: { width: 45, depth: 50, height: 90 }, category: 'dining' },
  fridge: { name: '冰箱', size: { width: 75, depth: 70, height: 180 }, wallAligned: true, category: 'kitchen' },
  stove: { name: '灶台', size: { width: 70, depth: 60, height: 90 }, wallAligned: true, category: 'kitchen' },
  'wall-art': { name: '木框山景画', size: { width: 90, depth: 3, height: 60 }, mountPoint: 'wall', wallAligned: true, category: 'livingroom', defaultColor: '#ba9b73' },
  'kitchen-accessories': { name: '台面用品组', size: { width: 55, depth: 30, height: 28 }, category: 'kitchen', defaultColor: '#d8d3c3' },
  'range-hood': { name: '抽油烟机', size: { width: 70, depth: 48, height: 80 }, mountPoint: 'wall', wallAligned: true, category: 'kitchen', defaultColor: '#8b928d' },
  sink: { name: '水槽', size: { width: 80, depth: 60, height: 90 }, wallAligned: true, category: 'kitchen' },
  'kitchen-counter': { name: '橱柜', size: { width: 100, depth: 60, height: 90 }, wallAligned: true, category: 'kitchen' },

  // 卫浴
  toilet: { name: '马桶', size: { width: 40, depth: 70, height: 75 }, category: 'bathroom' },
  basin: { name: '洗手池', size: { width: 60, depth: 50, height: 85 }, wallAligned: true, category: 'bathroom' },
  shower: { name: '淋浴', size: { width: 90, depth: 90, height: 200 }, wallAligned: true, category: 'bathroom' },
  bathtub: { name: '浴缸', size: { width: 170, depth: 80, height: 55 }, wallAligned: true, category: 'bathroom' },

  // 办公
  desk: { name: '书桌', size: { width: 120, depth: 60, height: 75 }, wallAligned: true, category: 'office' },
  'office-chair': { name: '办公椅', size: { width: 60, depth: 60, height: 90 }, category: 'office' },

  // 灯光/控制
  'lamp-table': { name: '陶瓷布罩台灯', size: { width: 32, depth: 32, height: 45 }, interactive: 'light', category: 'lighting' },
  'lamp-ceiling': { name: '吊灯', size: { width: 50, depth: 50, height: 50 }, mountPoint: 'ceiling', interactive: 'light', category: 'lighting' },
  'lamp-floor': { name: '落地灯', size: { width: 40, depth: 40, height: 160 }, interactive: 'light', category: 'lighting' },
  'lamp-wall': { name: '壁灯', size: { width: 20, depth: 15, height: 30 }, wallAligned: true, mountPoint: 'wall', interactive: 'light', category: 'lighting' },
  switch: { name: '墙面开关', size: { width: 8, depth: 2, height: 8 }, wallAligned: true, mountPoint: 'wall', interactive: 'switch', category: 'lighting' },

  // 人物参考
  'person-standing': { name: '站立人物', size: { width: 45, depth: 30, height: 170 }, defaultColor: '#4a6fa5', category: 'person' },
  'person-sitting':  { name: '坐姿人物', size: { width: 45, depth: 60, height: 90  }, defaultColor: '#c0516e', category: 'person' },
};

export const FURNITURE_BY_CATEGORY: Record<FurnitureCategory, FurnitureType[]> = (() => {
  const out = {
    bedroom: [],
    livingroom: [],
    dining: [],
    kitchen: [],
    bathroom: [],
    office: [],
    lighting: [],
    person: [],
  } as Record<FurnitureCategory, FurnitureType[]>;
  for (const [type, def] of Object.entries(FURNITURE_CATALOG) as Array<[FurnitureType, FurnitureDef]>) {
    out[def.category].push(type);
  }
  return out;
})();
