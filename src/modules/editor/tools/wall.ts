import Konva from 'konva';
import type { Tool, ToolContext } from './base';
import type { NodeId, Vec2 } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';
import { useHistoryStore } from '@/modules/store/history';
import { AddWallCommand, BatchCommand, SplitWallCommand } from '@/modules/commands';
import { distance } from '@/modules/geometry/vec2';

const PREVIEW_GROUP = 'wall-tool-preview';

/**
 * 连续画墙工具。
 *
 * 交互约定：
 *  - 左键第一次落点：设置链头
 *  - 左键后续落点：创建墙段，连续绘制
 *  - 左键落到链头节点：闭合多边形，回到空闲
 *  - 右键（绘制中）：直接终止当前链，不创建墙
 *  - Escape：同右键
 *  - 落点 snap 到墙中点/垂足：先 SplitWall，再以新节点为端点
 */
export class WallTool implements Tool {
  readonly name = 'wall';
  readonly cursor = 'crosshair';

  private startPoint: Vec2 | null = null;
  private startNodeId: NodeId | null = null;
  /** 当前绘制链第一个节点的 ID，用于闭合检测 */
  private chainStartNodeId: NodeId | null = null;

  private reset(ctx?: ToolContext) {
    this.startPoint = null;
    this.startNodeId = null;
    this.chainStartNodeId = null;
    ctx?.requestPreviewRedraw();
  }

  onPointerDown(e: PointerEvent, ctx: ToolContext) {
    // 右键终止当前链（不创建墙）
    if (e.button === 2) {
      if (this.startPoint) this.reset(ctx);
      return;
    }

    const point = ctx.snap?.point ?? ctx.worldPoint;
    const snapType = ctx.snap?.type;
    const snapSourceId = ctx.snap?.sourceId;

    if (!this.startPoint) {
      // ── 第一次落点：设置链头 ──
      if (snapType === 'midpoint' || snapType === 'wall') {
        // 落在墙上：先切割，再以切割节点为链头
        const splitCmd = new SplitWallCommand({ wallId: snapSourceId!, splitPoint: point });
        useHistoryStore().execute(splitCmd);
        this.startNodeId = splitCmd.createdNodeId;
        this.chainStartNodeId = splitCmd.createdNodeId;
      } else {
        this.startNodeId = snapType === 'endpoint' ? (snapSourceId ?? null) : null;
        this.chainStartNodeId = this.startNodeId;
        // 若起点是自由点（无已有节点），chainStartNodeId 暂为 null，
        // 待第一段墙创建后从 AddWallCommand.usedNodeIds.start 补充。
      }
      this.startPoint = point;
      ctx.requestPreviewRedraw();
      return;
    }

    // ── 后续落点：创建墙段 ──
    let endExistingNodeId: NodeId | undefined;
    const cmds = [];

    if (snapType === 'midpoint' || snapType === 'wall') {
      const splitCmd = new SplitWallCommand({ wallId: snapSourceId!, splitPoint: point });
      cmds.push(splitCmd);
      endExistingNodeId = splitCmd.createdNodeId;
    } else if (snapType === 'endpoint') {
      endExistingNodeId = snapSourceId as NodeId | undefined;
    }

    const planStore = usePlanStore();
    const addCmd = new AddWallCommand({
      start: this.startPoint,
      end: point,
      startExistingNodeId: this.startNodeId ?? undefined,
      endExistingNodeId,
      thickness: planStore.plan!.meta.defaultWallThickness,
      height: planStore.plan!.meta.defaultWallHeight,
    });
    cmds.push(addCmd);

    if (cmds.length > 1) {
      useHistoryStore().execute(new BatchCommand('SplitAndAddWall', cmds));
    } else {
      useHistoryStore().execute(addCmd);
    }

    // 第一段墙创建后补齐链头 ID（链头是自由点时此前为 null）
    if (this.chainStartNodeId === null) {
      this.chainStartNodeId = addCmd.usedNodeIds.start ?? null;
    }

    // 闭合检测：终点恰好是链头节点 → 闭合，回到空闲
    const isClosingLoop =
      endExistingNodeId != null && endExistingNodeId === this.chainStartNodeId;

    if (isClosingLoop) {
      this.reset(ctx);
    } else {
      this.startPoint = point;
      this.startNodeId = endExistingNodeId ?? addCmd.usedNodeIds.end ?? null;
      ctx.requestPreviewRedraw();
    }
  }

  onPointerMove(_e: PointerEvent, ctx: ToolContext) {
    if (this.startPoint) ctx.requestPreviewRedraw();
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext) {
    if (e.key === 'Escape') this.reset(ctx);
  }

  onDeactivate() {
    this.reset();
  }

  renderPreview(ctx: ToolContext) {
    ctx.previewLayer.findOne(`.${PREVIEW_GROUP}`)?.destroy();
    const group = new Konva.Group({ name: PREVIEW_GROUP, listening: false });

    // 绘制中：显示所有已有节点（帮助用户定位吸附目标）
    if (this.startPoint) {
      const plan = usePlanStore().plan;
      if (plan) {
        for (const node of Object.values(plan.nodes)) {
          const isChainHead = node.id === this.chainStartNodeId;
          group.add(
            new Konva.Circle({
              x: node.position.x,
              y: node.position.y,
              radius: isChainHead ? 5 : 3,
              fill: isChainHead ? '#22c55e' : '#94a3b8',
              stroke: isChainHead ? '#15803d' : undefined,
              strokeWidth: isChainHead ? 1.5 : 0,
            }),
          );
        }
      }

      // 当前段起点（蓝色实心圆）
      group.add(
        new Konva.Circle({
          x: this.startPoint.x,
          y: this.startPoint.y,
          radius: 4,
          fill: '#3b82f6',
        }),
      );

      // 虚线预览
      group.add(
        new Konva.Line({
          points: [this.startPoint.x, this.startPoint.y, ctx.worldPoint.x, ctx.worldPoint.y],
          stroke: '#3b82f6',
          strokeWidth: 2,
          dash: [8, 6],
          listening: false,
        }),
      );
    }

    // 吸附点高亮：命中链头时用绿色，否则用红色
    if (ctx.snap) {
      const isChainHead =
        ctx.snap.type === 'endpoint' && ctx.snap.sourceId === this.chainStartNodeId;
      group.add(
        new Konva.Circle({
          x: ctx.snap.point.x,
          y: ctx.snap.point.y,
          radius: 6,
          stroke: isChainHead ? '#22c55e' : '#ef4444',
          strokeWidth: 2,
        }),
      );
    }

    // 实时长度气泡（显示在虚线中点上方）
    if (this.startPoint) {
      const endPt = ctx.snap?.point ?? ctx.worldPoint;
      const dist = distance(this.startPoint, endPt); // cm
      if (dist > 1) {
        const label =
          dist >= 100
            ? `${(dist / 100).toFixed(2)} m`
            : `${dist.toFixed(0)} cm`;
        const vs = ctx.viewScale;
        const midX = (this.startPoint.x + endPt.x) / 2;
        const midY = (this.startPoint.y + endPt.y) / 2;
        // 垂直于虚线方向，向"上"偏移（屏幕 18px 换算到世界坐标）
        const dx = endPt.x - this.startPoint.x;
        const dy = endPt.y - this.startPoint.y;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len;
        const perpY = dx / len;
        const offsetWorld = 18 / vs;
        const tx = midX + perpX * offsetWorld;
        const ty = midY + perpY * offsetWorld;

        const fontSize = 12 / vs;
        const padding = 3 / vs;
        const t = new Konva.Text({ text: label, fontSize, fill: '#374151', padding });
        const tw = t.width();
        const th = t.height();

        group.add(
          new Konva.Rect({
            x: tx - tw / 2 - padding,
            y: ty - th / 2 - padding,
            width: tw + padding * 2,
            height: th + padding * 2,
            fill: 'rgba(255,255,255,0.92)',
            stroke: '#94a3b8',
            strokeWidth: 1 / vs,
            cornerRadius: 3 / vs,
            listening: false,
          }),
        );
        t.x(tx - tw / 2);
        t.y(ty - th / 2);
        group.add(t);
      }
    }

    ctx.previewLayer.add(group);
  }
}
