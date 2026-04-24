import { nanoid } from 'nanoid';
import type { Command } from '../base';
import type { Cm, Vec2, WallId, NodeId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

export interface AddWallOptions {
  start: Vec2;
  end: Vec2;
  /** 若起点/终点已存在节点，直接复用 */
  startExistingNodeId?: NodeId;
  endExistingNodeId?: NodeId;
  thickness: Cm;
  height: Cm;
}

export class AddWallCommand implements Command {
  readonly name = 'AddWall';

  readonly wallId: WallId = nanoid();
  createdStartNodeId?: NodeId;
  createdEndNodeId?: NodeId;
  private usedStartNodeId?: NodeId;
  private usedEndNodeId?: NodeId;

  constructor(private opts: AddWallOptions) {}

  do() {
    const store = usePlanStore();
    let startId = this.opts.startExistingNodeId;
    let endId = this.opts.endExistingNodeId;

    if (!startId) {
      startId = this.createdStartNodeId ?? nanoid();
      this.createdStartNodeId = startId;
      store._addNode({ id: startId, position: this.opts.start });
    }
    if (!endId) {
      endId = this.createdEndNodeId ?? nanoid();
      this.createdEndNodeId = endId;
      store._addNode({ id: endId, position: this.opts.end });
    }

    this.usedStartNodeId = startId;
    this.usedEndNodeId = endId;

    store._addWall({
      id: this.wallId,
      startNodeId: startId,
      endNodeId: endId,
      thickness: this.opts.thickness,
      height: this.opts.height,
    });
    store._recomputeRooms();
  }

  undo() {
    const store = usePlanStore();
    store._removeWall(this.wallId);
    if (this.createdStartNodeId) store._removeNode(this.createdStartNodeId);
    if (this.createdEndNodeId) store._removeNode(this.createdEndNodeId);
    store._recomputeRooms();
  }

  /** 便于测试：do 后看到实际用了哪两个节点 id */
  get usedNodeIds(): { start?: NodeId; end?: NodeId } {
    return { start: this.usedStartNodeId, end: this.usedEndNodeId };
  }
}
