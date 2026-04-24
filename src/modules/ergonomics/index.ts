import { ErgonomicsEngine } from './engine';
import { WalkingPathRule } from './rules/walking-path';
import { SofaCoffeeRule } from './rules/sofa-coffee';
import { SofaTvRule } from './rules/sofa-tv';
import { BedClearanceRule } from './rules/bed-clearance';
import { DiningChairRule } from './rules/dining-chair';
import { CeilingLowRule } from './rules/ceiling-low';
import { DoorSwingRule } from './rules/door-swing';
import { KitchenTriangleRule } from './rules/kitchen-triangle';

export { ErgonomicsEngine } from './engine';
export type { Warning, Rule, Severity } from './engine';

export function createDefaultEngine(): ErgonomicsEngine {
  const e = new ErgonomicsEngine();
  e.register(WalkingPathRule);
  e.register(SofaCoffeeRule);
  e.register(SofaTvRule);
  e.register(BedClearanceRule);
  e.register(DiningChairRule);
  e.register(CeilingLowRule);
  e.register(DoorSwingRule);
  e.register(KitchenTriangleRule);
  return e;
}
