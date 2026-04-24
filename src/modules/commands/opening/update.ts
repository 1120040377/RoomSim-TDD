import type { Command } from '../base';
import type { Opening, OpeningId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

type Updatable = Partial<Pick<Opening, 'width' | 'height' | 'sillHeight'>> & {
  hinge?: 'start' | 'end';
  swing?: 'inside' | 'outside';
};

/** 更新开洞属性（门的 hinge/swing、窗的 width/height/sill 等）。*/
export class UpdateOpeningCommand implements Command {
  readonly name = 'UpdateOpening';
  private before?: Record<string, unknown>;

  constructor(
    public readonly openingId: OpeningId,
    private patch: Updatable,
  ) {}

  do() {
    const store = usePlanStore();
    const cur = store.plan?.openings[this.openingId];
    if (!cur) return;
    this.before = {};
    for (const k of Object.keys(this.patch)) {
      this.before[k] = (cur as unknown as Record<string, unknown>)[k];
    }
    store._updateOpening(this.openingId, this.patch as Partial<Opening>);
  }

  undo() {
    if (!this.before) return;
    usePlanStore()._updateOpening(this.openingId, this.before as Partial<Opening>);
  }
}
