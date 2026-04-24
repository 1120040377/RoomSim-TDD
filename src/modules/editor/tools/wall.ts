import Konva from 'konva';
import type { Tool, ToolContext } from './base';
import type { NodeId, Vec2 } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';
import { useHistoryStore } from '@/modules/store/history';
import { AddWallCommand } from '@/modules/commands';

const PREVIEW_GROUP = 'wall-tool-preview';

/** 连续画墙：点一下起点，再点一下终点即生成一面墙；Esc 结束。*/
export class WallTool implements Tool {
  readonly name = 'wall';
  readonly cursor = 'crosshair';

  private startPoint: Vec2 | null = null;
  private startNodeId: NodeId | null = null;

  onPointerDown(_e: PointerEvent, ctx: ToolContext) {
    const point = ctx.snap?.point ?? ctx.worldPoint;
    if (!this.startPoint) {
      this.startPoint = point;
      this.startNodeId = ctx.snap?.type === 'endpoint' ? (ctx.snap.sourceId ?? null) : null;
      ctx.requestPreviewRedraw();
      return;
    }

    // 生成墙
    const endExistingNodeId =
      ctx.snap?.type === 'endpoint' ? (ctx.snap.sourceId ?? undefined) : undefined;
    const planStore = usePlanStore();
    const cmd = new AddWallCommand({
      start: this.startPoint,
      end: point,
      startExistingNodeId: this.startNodeId ?? undefined,
      endExistingNodeId,
      thickness: planStore.plan!.meta.defaultWallThickness,
      height: planStore.plan!.meta.defaultWallHeight,
    });
    useHistoryStore().execute(cmd);

    // 连续画：下一段起点 = 刚才终点
    this.startPoint = point;
    this.startNodeId = endExistingNodeId ?? cmd.usedNodeIds.end ?? null;
    ctx.requestPreviewRedraw();
  }

  onPointerMove(_e: PointerEvent, ctx: ToolContext) {
    if (this.startPoint) ctx.requestPreviewRedraw();
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext) {
    if (e.key === 'Escape') {
      this.startPoint = null;
      this.startNodeId = null;
      ctx.requestPreviewRedraw();
    }
  }

  onDeactivate() {
    this.startPoint = null;
    this.startNodeId = null;
  }

  renderPreview(ctx: ToolContext) {
    // 清掉旧预览
    ctx.previewLayer.findOne(`.${PREVIEW_GROUP}`)?.destroy();

    const group = new Konva.Group({ name: PREVIEW_GROUP, listening: false });
    // 起点圆
    if (this.startPoint) {
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
    // 吸附点高亮
    if (ctx.snap) {
      group.add(
        new Konva.Circle({
          x: ctx.snap.point.x,
          y: ctx.snap.point.y,
          radius: 6,
          stroke: '#ef4444',
          strokeWidth: 2,
        }),
      );
    }
    ctx.previewLayer.add(group);
  }
}
