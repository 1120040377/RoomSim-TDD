import type { Command } from '../base';
import type { Furniture, FurnitureId, FurnitureSize } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

type Updatable = Partial<Pick<Furniture, 'color' | 'wallAligned'>> & {
  size?: FurnitureSize;
};

export class UpdateFurnitureCommand implements Command {
  readonly name = 'UpdateFurniture';
  private before?: Record<string, unknown>;

  constructor(
    public readonly furnitureId: FurnitureId,
    private patch: Updatable,
  ) {}

  do() {
    const store = usePlanStore();
    const cur = store.plan?.furniture[this.furnitureId];
    if (!cur) return;
    this.before = {};
    for (const k of Object.keys(this.patch)) {
      this.before[k] = (cur as unknown as Record<string, unknown>)[k];
    }
    store._updateFurniture(this.furnitureId, this.patch as Partial<Furniture>);
  }

  undo() {
    if (!this.before) return;
    usePlanStore()._updateFurniture(this.furnitureId, this.before as Partial<Furniture>);
  }
}
