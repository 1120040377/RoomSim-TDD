import type { Command } from '../base';
import type { FurnitureId, Vec2 } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

export class MoveFurnitureCommand implements Command {
  readonly name = 'MoveFurniture';

  constructor(
    public readonly furnitureId: FurnitureId,
    public readonly from: Vec2,
    public readonly to: Vec2,
  ) {}

  do() {
    usePlanStore()._updateFurniture(this.furnitureId, { position: this.to });
  }

  undo() {
    usePlanStore()._updateFurniture(this.furnitureId, { position: this.from });
  }

  mergeWith(next: Command): Command | null {
    if (next instanceof MoveFurnitureCommand && next.furnitureId === this.furnitureId) {
      return new MoveFurnitureCommand(this.furnitureId, this.from, next.to);
    }
    return null;
  }
}
