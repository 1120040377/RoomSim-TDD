import { nanoid } from 'nanoid';
import type { Command } from '../base';
import type { Door, Opening, Window } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

/** 离散联合的 Omit 逐支分发，以保留 discriminator 和附属字段（hinge/swing） */
export type OpeningInput = Omit<Door, 'id'> | Omit<Window, 'id'>;

/** opts 不带 id；命令内部生成并记住，以便 undo 删除对应 id。 */
export class AddOpeningCommand implements Command {
  readonly name = 'AddOpening';

  readonly openingId: string;
  private snapshot: Opening;

  constructor(opts: OpeningInput) {
    this.openingId = nanoid();
    this.snapshot = { ...opts, id: this.openingId } as Opening;
  }

  do() {
    usePlanStore()._addOpening(this.snapshot);
  }

  undo() {
    usePlanStore()._removeOpening(this.openingId);
  }
}
