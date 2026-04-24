import type { Plan, PlanMeta, WalkthroughConfig } from './types';

export const DEFAULT_META: PlanMeta = {
  unit: 'cm',
  gridSize: 20,
  defaultWallHeight: 280,
  defaultWallThickness: 12,
};

export const DEFAULT_WALKTHROUGH: WalkthroughConfig = {
  personHeight: 170,
};

export function createEmptyPlan(id: string, name = '未命名方案'): Plan {
  const now = Date.now();
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    meta: { ...DEFAULT_META },
    nodes: {},
    walls: {},
    openings: {},
    furniture: {},
    rooms: {},
    walkthrough: { ...DEFAULT_WALKTHROUGH },
  };
}
