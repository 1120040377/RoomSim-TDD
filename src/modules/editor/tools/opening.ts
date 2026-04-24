import Konva from 'konva';
import type { Tool, ToolContext } from './base';
import { usePlanStore } from '@/modules/store/plan';
import { useHistoryStore } from '@/modules/store/history';
import { AddOpeningCommand } from '@/modules/commands';
import { nearestWallPoint } from '@/modules/geometry/nearest-wall';

const PREVIEW_NAME = 'opening-tool-preview';
const MAX_PROJECT_DIST = 30; // cm：超过 30cm 不吸附到墙

abstract class BaseOpeningTool implements Tool {
  abstract name: 'door' | 'window';
  cursor = 'copy';
  abstract defaultWidth: number;
  abstract defaultHeight: number;
  abstract defaultSill: number;

  onPointerDown(_e: PointerEvent, ctx: ToolContext) {
    const plan = usePlanStore().plan;
    if (!plan) return;
    const hit = nearestWallPoint(ctx.worldPoint, plan, MAX_PROJECT_DIST);
    if (!hit) return;

    const wall = plan.walls[hit.wallId];
    if (!wall) return;

    // 夹紧 offset 让开洞完全落在墙段内
    const s = plan.nodes[wall.startNodeId];
    const e = plan.nodes[wall.endNodeId];
    const len = Math.hypot(
      e.position.x - s.position.x,
      e.position.y - s.position.y,
    );
    const half = this.defaultWidth / 2;
    if (len < this.defaultWidth + 20) return; // 墙太短
    const offset = Math.max(half, Math.min(len - half, hit.offset));

    const cmd =
      this.name === 'door'
        ? new AddOpeningCommand({
            kind: 'door',
            wallId: hit.wallId,
            offset,
            width: this.defaultWidth,
            height: this.defaultHeight,
            sillHeight: 0,
            hinge: 'start',
            swing: 'inside',
          })
        : new AddOpeningCommand({
            kind: 'window',
            wallId: hit.wallId,
            offset,
            width: this.defaultWidth,
            height: this.defaultHeight,
            sillHeight: this.defaultSill,
          });
    useHistoryStore().execute(cmd);
  }

  onPointerMove(_e: PointerEvent, ctx: ToolContext) {
    ctx.requestPreviewRedraw();
  }

  renderPreview(ctx: ToolContext) {
    ctx.previewLayer.findOne(`.${PREVIEW_NAME}`)?.destroy();
    const plan = usePlanStore().plan;
    if (!plan) return;
    const hit = nearestWallPoint(ctx.worldPoint, plan, MAX_PROJECT_DIST);
    if (!hit) return;
    const wall = plan.walls[hit.wallId];
    const s = plan.nodes[wall.startNodeId];
    const e = plan.nodes[wall.endNodeId];
    const dx = e.position.x - s.position.x;
    const dy = e.position.y - s.position.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len;
    const uy = dy / len;
    const half = this.defaultWidth / 2;
    const offset = Math.max(half, Math.min(len - half, hit.offset));
    const leftEditor = {
      x: s.position.x + ux * (offset - half),
      y: s.position.y + uy * (offset - half),
    };
    const rightEditor = {
      x: s.position.x + ux * (offset + half),
      y: s.position.y + uy * (offset + half),
    };
    const color = this.name === 'door' ? '#f59e0b' : '#0ea5e9';
    const line = new Konva.Line({
      name: PREVIEW_NAME,
      points: [leftEditor.x, leftEditor.y, rightEditor.x, rightEditor.y],
      stroke: color,
      strokeWidth: 5,
      dash: [6, 4],
      opacity: 0.85,
      listening: false,
    });
    ctx.previewLayer.add(line);
  }
}

export class DoorTool extends BaseOpeningTool {
  name = 'door' as const;
  defaultWidth = 90;
  defaultHeight = 210;
  defaultSill = 0;
}

export class WindowTool extends BaseOpeningTool {
  name = 'window' as const;
  defaultWidth = 120;
  defaultHeight = 140;
  defaultSill = 90;
}
