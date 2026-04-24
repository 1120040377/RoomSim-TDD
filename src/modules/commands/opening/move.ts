import type { Command } from '../base';
import type { Cm, OpeningId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

export class MoveOpeningCommand implements Command {
  readonly name = 'MoveOpening';

  constructor(
    public readonly openingId: OpeningId,
    public readonly fromOffset: Cm,
    public readonly toOffset: Cm,
  ) {}

  do() {
    usePlanStore()._updateOpening(this.openingId, { offset: this.toOffset });
  }

  undo() {
    usePlanStore()._updateOpening(this.openingId, { offset: this.fromOffset });
  }

  mergeWith(next: Command): Command | null {
    if (next instanceof MoveOpeningCommand && next.openingId === this.openingId) {
      return new MoveOpeningCommand(this.openingId, this.fromOffset, next.toOffset);
    }
    return null;
  }
}
