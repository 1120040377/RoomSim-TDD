import type { Command } from '../base';
import type { Wall, WallId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

/** 更新墙属性（thickness/height）。保留 before 状态支持 undo。*/
export class UpdateWallCommand implements Command {
  readonly name = 'UpdateWall';

  private before?: Partial<Wall>;

  constructor(
    public readonly wallId: WallId,
    private patch: Partial<Pick<Wall, 'thickness' | 'height'>>,
  ) {}

  do() {
    const store = usePlanStore();
    const cur = store.plan?.walls[this.wallId];
    if (!cur) return;
    this.before = {};
    for (const k of Object.keys(this.patch) as Array<keyof typeof this.patch>) {
      (this.before as Record<string, unknown>)[k] = cur[k];
    }
    store._updateWall(this.wallId, this.patch);
  }

  undo() {
    if (!this.before) return;
    usePlanStore()._updateWall(this.wallId, this.before);
  }
}
