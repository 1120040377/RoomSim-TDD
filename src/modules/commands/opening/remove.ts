import type { Command } from '../base';
import type { Opening, OpeningId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

export class RemoveOpeningCommand implements Command {
  readonly name = 'RemoveOpening';
  private snapshot?: Opening;

  constructor(private openingId: OpeningId) {}

  do() {
    const store = usePlanStore();
    const cur = store.plan?.openings[this.openingId];
    if (!cur) return;
    this.snapshot = { ...cur };
    store._removeOpening(this.openingId);
  }

  undo() {
    if (this.snapshot) usePlanStore()._addOpening(this.snapshot);
  }
}
