import type { Command } from '../base';
import type { FurnitureId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

export class RotateFurnitureCommand implements Command {
  readonly name = 'RotateFurniture';

  constructor(
    public readonly furnitureId: FurnitureId,
    public readonly fromRotation: number,
    public readonly toRotation: number,
  ) {}

  do() {
    usePlanStore()._updateFurniture(this.furnitureId, { rotation: this.toRotation });
  }

  undo() {
    usePlanStore()._updateFurniture(this.furnitureId, { rotation: this.fromRotation });
  }

  mergeWith(next: Command): Command | null {
    if (next instanceof RotateFurnitureCommand && next.furnitureId === this.furnitureId) {
      return new RotateFurnitureCommand(
        this.furnitureId,
        this.fromRotation,
        next.toRotation,
      );
    }
    return null;
  }
}
