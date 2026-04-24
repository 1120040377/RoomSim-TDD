import type { FurnitureType, FurnitureSize } from '@/modules/model/types';

export type FurnitureCategory =
  | 'bedroom'
  | 'livingroom'
  | 'dining'
  | 'kitchen'
  | 'bathroom'
  | 'office'
  | 'lighting';

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
  'lamp-ceiling': { name: '吊灯', size: { width: 50, depth: 50, height: 50 }, mountPoint: 'ceiling', interactive: 'light', category: 'lighting' },
  'lamp-floor': { name: '落地灯', size: { width: 40, depth: 40, height: 160 }, interactive: 'light', category: 'lighting' },
  'lamp-wall': { name: '壁灯', size: { width: 20, depth: 15, height: 30 }, wallAligned: true, mountPoint: 'wall', interactive: 'light', category: 'lighting' },
  switch: { name: '墙面开关', size: { width: 8, depth: 2, height: 8 }, wallAligned: true, mountPoint: 'wall', interactive: 'switch', category: 'lighting' },
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
  } as Record<FurnitureCategory, FurnitureType[]>;
  for (const [type, def] of Object.entries(FURNITURE_CATALOG) as Array<[FurnitureType, FurnitureDef]>) {
    out[def.category].push(type);
  }
  return out;
})();
