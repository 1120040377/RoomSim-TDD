import { Group, Box3 } from 'three';
import {markWallDecorations} from '../wall-decoration-cutaway';
import { buildStorage, STORAGE_TYPES } from './furniture/storage';
import type { Furniture, FurnitureType, Plan } from '@/modules/model/types';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';
import { CM_TO_M } from '../coord';
import { type FurnitureBuilderFn, attachInteractable } from './furniture/shared';
import { batchStaticParts } from './batch-static-parts';
import { buildFloorPlant } from './furniture/plant';
import { buildRug } from './furniture/rug';
import { buildRailing } from './furniture/railing';
import { buildRangeHood } from './furniture/range-hood';
import { buildKitchenAccessories } from './furniture/kitchen-accessories';
import { buildWallArt } from './furniture/wall-art';
import { buildWallMirror } from './furniture/wall-mirror';
import { buildTableLamp } from './furniture/table-lamp';
import { buildBotanicalVase } from './furniture/botanical-vase';
import { buildKitchenIsland, buildCounterStool } from './furniture/island';
import { buildBedSingle, buildBedDouble, buildBedKingsize, buildWardrobe2, buildWardrobe3, buildSideTable } from './furniture/bedroom';
import { buildSofa2, buildSofa3, buildSofaL, buildArmchair, buildCoffeeTable, buildTvCabinet, buildTv, buildBookshelf } from './furniture/livingroom';
import { buildDiningTable4, buildDiningTable6, buildDiningChair } from './furniture/dining';
import { buildFridge, buildStove, buildSink, buildKitchenCounter } from './furniture/kitchen';
import { buildToilet, buildBasin, buildShower, buildBathtub } from './furniture/bathroom';
import { buildDesk, buildOfficeChair } from './furniture/office';
import { buildLampCeiling, buildLampFloor, buildLampWall, buildSwitch } from './furniture/lighting';
import { buildPersonStanding, buildPersonSitting } from './furniture/person';

const BUILDERS: Record<FurnitureType, FurnitureBuilderFn> = {
  'wall-mirror': buildWallMirror,
  'kitchen-island': buildKitchenIsland,
  'counter-stool': buildCounterStool,
  'botanical-vase': buildBotanicalVase,
  'lamp-table': buildTableLamp,
  'wall-art': buildWallArt,
  'kitchen-accessories': buildKitchenAccessories,
  'range-hood': buildRangeHood,
  'railing': buildRailing,
  'rug': buildRug,
  'floor-plant': buildFloorPlant,
  'wall-cabinet': buildStorage,
  'washing-machine': buildStorage,
  'bed-single':       buildBedSingle,
  'bed-double':       buildBedDouble,
  'bed-kingsize':     buildBedKingsize,
  'wardrobe-2':       buildWardrobe2,
  'wardrobe-3':       buildWardrobe3,
  'side-table':       buildSideTable,
  'sofa-2':           buildSofa2,
  'sofa-3':           buildSofa3,
  'sofa-l':           buildSofaL,
  armchair:           buildArmchair,
  'coffee-table':     buildCoffeeTable,
  'tv-cabinet':       buildTvCabinet,
  tv:                 buildTv,
  bookshelf:          buildBookshelf,
  'dining-table-4':   buildDiningTable4,
  'dining-table-6':   buildDiningTable6,
  'dining-chair':     buildDiningChair,
  fridge:             buildFridge,
  stove:              buildStove,
  sink:               buildSink,
  'kitchen-counter':  buildKitchenCounter,
  toilet:             buildToilet,
  basin:              buildBasin,
  shower:             buildShower,
  bathtub:            buildBathtub,
  desk:               buildDesk,
  'office-chair':     buildOfficeChair,
  'lamp-ceiling':     buildLampCeiling,
  'lamp-floor':       buildLampFloor,
  'lamp-wall':        buildLampWall,
  switch:             buildSwitch,
  'person-standing':  buildPersonStanding,
  'person-sitting':   buildPersonSitting,
};

export function buildFurniture(plan: Plan): Group {
  const group = new Group();
  group.name = 'furniture';

  const ceilingHeightCm = plan.meta.defaultWallHeight;

  for (const f of Object.values(plan.furniture)) {
    group.add(buildOne(f, ceilingHeightCm));
  }
  markWallDecorations(group,plan);

  return group;
}

export function buildOne(f: Furniture, ceilingHeightCm: number): Group {
  const def = FURNITURE_CATALOG[f.type];
  const g = new Group();
  g.name = `furniture-${f.id}`;
  (g.userData as Record<string, unknown>).furnitureId = f.id;

  if(STORAGE_TYPES.has(f.type)) buildStorage(g,f);
  else BUILDERS[f.type](g, f, ceilingHeightCm);
  batchStaticParts(g);
  g.userData.localBaseY = new Box3().setFromObject(g).min.y;

  g.position.set(f.position.x * CM_TO_M, 0, f.position.y * CM_TO_M);
  if(f.elevation!==undefined) {
    const bounds=new Box3().setFromObject(g);
    g.position.y=f.elevation*CM_TO_M-bounds.min.y;
  }
  g.rotation.y = -f.rotation;
  g.updateMatrixWorld(true);
  g.userData.baseElevation=new Box3().setFromObject(g).min.y/CM_TO_M;

  if (def?.interactive) {
    attachInteractable(g, f.id, def.interactive);
  }

  return g;
}
