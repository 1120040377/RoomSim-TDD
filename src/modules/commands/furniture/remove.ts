import type { Command } from '../base';
import type { Furniture, FurnitureId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

export class RemoveFurnitureCommand implements Command {
  readonly name = 'RemoveFurniture';
  private snapshot?: Furniture;

  constructor(public readonly furnitureId: FurnitureId) {}

  do() {
    const store = usePlanStore();
    const cur = store.plan?.furniture[this.furnitureId];
    if (!cur) return;
    this.snapshot = { ...cur };
    store._removeFurniture(this.furnitureId);
  }

  undo() {
    if (this.snapshot) usePlanStore()._addFurniture(this.snapshot);
  }
}
