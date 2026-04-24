import type { Command } from '../base';
import type { NodeId, Vec2 } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

export class MoveWallNodeCommand implements Command {
  readonly name = 'MoveWallNode';

  constructor(
    public readonly nodeId: NodeId,
    public readonly from: Vec2,
    public readonly to: Vec2,
  ) {}

  do() {
    const store = usePlanStore();
    store._updateNode(this.nodeId, { position: this.to });
    store._recomputeRooms();
  }

  undo() {
    const store = usePlanStore();
    store._updateNode(this.nodeId, { position: this.from });
    store._recomputeRooms();
  }

  mergeWith(next: Command): Command | null {
    if (next instanceof MoveWallNodeCommand && next.nodeId === this.nodeId) {
      return new MoveWallNodeCommand(this.nodeId, this.from, next.to);
    }
    return null;
  }
}
