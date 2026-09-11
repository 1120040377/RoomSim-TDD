import type { UtilityKind } from '@/modules/model/types';
import { isWater } from './water-network';
export type UtilityFilter='all'|'water'|'power'|'cold-water'|'hot-water'|'drain';
export function utilityMatches(kind:UtilityKind,filter:UtilityFilter){
  return filter==='all'||(filter==='water'?isWater(kind):filter==='power'?!isWater(kind):kind===filter);
}
