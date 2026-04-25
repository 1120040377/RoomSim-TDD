import { nanoid } from 'nanoid';
import type { Command } from '../base';
import type { NodeId, Opening, Vec2, Wall, WallId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';
import { distance } from '@/modules/geometry/vec2';

export interface SplitWallOptions {
  wallId: WallId;
  /** 切割点坐标（必须位于该墙线段上） */
  splitPoint: Vec2;
}

/**
 * 将一面墙在指定点切割为两段。
 * 若原墙上有门窗，按 offset 归属迁移到对应子段。
 * undo 完整还原原始墙及附属开洞。
 */
export class SplitWallCommand implements Command {
  readonly name = 'SplitWall';

  private readonly _splitNodeId: NodeId = nanoid();
  private readonly _wallAId: WallId = nanoid();
  private readonly _wallBId: WallId = nanoid();

  private originalWall?: Wall;
  private migratedOpenings: Opening[] = [];

  constructor(private opts: SplitWallOptions) {}

  do() {
    const store = usePlanStore();
    const plan = store.plan!;
    const wall = plan.walls[this.opts.wallId];
    if (!wall) return;

    this.originalWall = { ...wall };

    const startNode = plan.nodes[wall.startNodeId];
    const splitOffset = startNode ? distance(startNode.position, this.opts.splitPoint) : 0;

    // 迁移附着在原墙上的门窗
    this.migratedOpenings = Object.values(plan.openings).filter(
      (o) => o.wallId === this.opts.wallId,
    );
    for (const op of this.migratedOpenings) {
      store._removeOpening(op.id);
      if (op.offset < splitOffset) {
        store._addOpening({ ...op, wallId: this._wallAId });
      } else {
        store._addOpening({ ...op, wallId: this._wallBId, offset: op.offset - splitOffset });
      }
    }

    store._addNode({ id: this._splitNodeId, position: { ...this.opts.splitPoint } });
    store._addWall({
      id: this._wallAId,
      startNodeId: wall.startNodeId,
      endNodeId: this._splitNodeId,
      thickness: wall.thickness,
      height: wall.height,
    });
    store._addWall({
      id: this._wallBId,
      startNodeId: this._splitNodeId,
      endNodeId: wall.endNodeId,
      thickness: wall.thickness,
      height: wall.height,
    });
    store._removeWall(this.opts.wallId);
    store._recomputeRooms();
  }

  undo() {
    const store = usePlanStore();
    if (!this.originalWall) return;

    // 先撤销迁移的开洞（在 wallA/wallB 上），恢复原始开洞（在 originalWall 上）
    for (const op of this.migratedOpenings) store._removeOpening(op.id);
    store._removeWall(this._wallAId);
    store._removeWall(this._wallBId);
    store._removeNode(this._splitNodeId);
    store._addWall(this.originalWall);
    for (const op of this.migratedOpenings) store._addOpening(op);
    store._recomputeRooms();
  }

  /** 切割后新建的中间节点 ID，供调用方作为后续墙的端节点复用 */
  get createdNodeId(): NodeId {
    return this._splitNodeId;
  }
}
