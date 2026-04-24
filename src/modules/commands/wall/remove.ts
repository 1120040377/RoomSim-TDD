import type { Command } from '../base';
import type { Opening, Wall, WallId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

/**
 * 删除墙。同时自动删除：
 *  - 附着在该墙上的所有 opening（门窗）
 *  - 孤立节点（没有其他墙引用它的节点）
 * 全部都记录快照以支持 undo。
 */
export class RemoveWallCommand implements Command {
  readonly name = 'RemoveWall';

  private wallSnapshot?: Wall;
  private openingsSnapshot: Opening[] = [];
  private removedNodes: Array<{ id: string; position: { x: number; y: number } }> = [];

  constructor(private wallId: WallId) {}

  do() {
    const store = usePlanStore();
    const plan = store.plan;
    if (!plan) return;

    const wall = plan.walls[this.wallId];
    if (!wall) return;
    this.wallSnapshot = { ...wall };

    // 附着的开洞
    this.openingsSnapshot = Object.values(plan.openings).filter((o) => o.wallId === this.wallId);
    for (const op of this.openingsSnapshot) store._removeOpening(op.id);

    // 删墙
    store._removeWall(this.wallId);

    // 孤立节点清理：删完墙后，若某端点不再被任何墙引用则移除
    const refStart = Object.values(store.plan!.walls).some(
      (w) => w.startNodeId === wall.startNodeId || w.endNodeId === wall.startNodeId,
    );
    const refEnd = Object.values(store.plan!.walls).some(
      (w) => w.startNodeId === wall.endNodeId || w.endNodeId === wall.endNodeId,
    );
    if (!refStart && store.plan!.nodes[wall.startNodeId]) {
      this.removedNodes.push({ ...store.plan!.nodes[wall.startNodeId] });
      store._removeNode(wall.startNodeId);
    }
    if (!refEnd && store.plan!.nodes[wall.endNodeId]) {
      this.removedNodes.push({ ...store.plan!.nodes[wall.endNodeId] });
      store._removeNode(wall.endNodeId);
    }

    store._recomputeRooms();
  }

  undo() {
    const store = usePlanStore();
    if (!this.wallSnapshot) return;
    for (const n of this.removedNodes) store._addNode(n);
    store._addWall(this.wallSnapshot);
    for (const op of this.openingsSnapshot) store._addOpening(op);
    store._recomputeRooms();
  }
}
