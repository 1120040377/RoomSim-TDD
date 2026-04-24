import Konva from 'konva';
import type { Tool, ToolContext } from './base';
import type { Vec2 } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';
import { useHistoryStore } from '@/modules/store/history';
import { AddWallCommand, BatchCommand } from '@/modules/commands';
import type { Command } from '@/modules/commands';

const PREVIEW_GROUP = 'rect-room-preview';

/** 拖拽对角两点生成矩形房间（4 面墙）。*/
export class RectRoomTool implements Tool {
  readonly name = 'rect-room';
  readonly cursor = 'crosshair';

  private startPoint: Vec2 | null = null;

  onPointerDown(_e: PointerEvent, ctx: ToolContext) {
    this.startPoint = ctx.snap?.point ?? ctx.worldPoint;
    ctx.requestPreviewRedraw();
  }

  onPointerMove(_e: PointerEvent, ctx: ToolContext) {
    if (this.startPoint) ctx.requestPreviewRedraw();
  }

  onPointerUp(_e: PointerEvent, ctx: ToolContext) {
    if (!this.startPoint) return;
    const end = ctx.snap?.point ?? ctx.worldPoint;
    const x0 = Math.min(this.startPoint.x, end.x);
    const y0 = Math.min(this.startPoint.y, end.y);
    const x1 = Math.max(this.startPoint.x, end.x);
    const y1 = Math.max(this.startPoint.y, end.y);

    if (x1 - x0 < 50 || y1 - y0 < 50) {
      this.startPoint = null;
      ctx.requestPreviewRedraw();
      return;
    }

    const planStore = usePlanStore();
    const th = planStore.plan!.meta.defaultWallThickness;
    const h = planStore.plan!.meta.defaultWallHeight;

    const corners: Vec2[] = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
    const cmds: AddWallCommand[] = [];
    let prev: { start: Vec2; end: Vec2; startId?: string; endId?: string } | null = null;
    const first: { start: Vec2; end: Vec2; startId?: string; endId?: string } = {
      start: corners[0],
      end: corners[1],
    };
    for (let i = 0; i < 4; i++) {
      const start = corners[i];
      const end = corners[(i + 1) % 4];
      const cmd: AddWallCommand = new AddWallCommand({
        start,
        end,
        startExistingNodeId: prev?.endId,
        endExistingNodeId: i === 3 ? first.startId : undefined,
        thickness: th,
        height: h,
      });
      cmd.do(); // 先执行，让 usedNodeIds 生成
      if (i === 0) {
        first.startId = cmd.usedNodeIds.start;
        first.endId = cmd.usedNodeIds.end;
      }
      prev = { start, end, startId: cmd.usedNodeIds.start, endId: cmd.usedNodeIds.end };
      cmds.push(cmd);
    }
    // 把已 do 的 4 条命令回滚后用 Batch 统一 execute，保证 undo 一次撤销整个矩形
    for (let i = cmds.length - 1; i >= 0; i--) cmds[i].undo();
    useHistoryStore().execute(new BatchCommand('AddRectRoom', cmds as Command[]));

    this.startPoint = null;
    ctx.requestPreviewRedraw();
  }

  onDeactivate() {
    this.startPoint = null;
  }

  renderPreview(ctx: ToolContext) {
    ctx.previewLayer.findOne(`.${PREVIEW_GROUP}`)?.destroy();
    if (!this.startPoint) return;
    const s = this.startPoint;
    const e = ctx.snap?.point ?? ctx.worldPoint;
    const rect = new Konva.Rect({
      name: PREVIEW_GROUP,
      x: Math.min(s.x, e.x),
      y: Math.min(s.y, e.y),
      width: Math.abs(e.x - s.x),
      height: Math.abs(e.y - s.y),
      stroke: '#3b82f6',
      strokeWidth: 2,
      dash: [8, 6],
      listening: false,
    });
    ctx.previewLayer.add(rect);
  }
}
