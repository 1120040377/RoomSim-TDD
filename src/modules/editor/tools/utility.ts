import Konva from 'konva';
import { nanoid } from 'nanoid';
import type { Tool, ToolContext } from './base';
import type { Vec2 } from '@/modules/model/types';
import { useEditorStore } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';
import { putUtility } from '@/modules/commands/renovation';
import { routeTo, UTILITY_CATALOG } from '@/modules/renovation/model';

export class UtilityTool implements Tool {
  readonly name = 'utility';
  readonly cursor = 'crosshair';
  private points: Vec2[] = [];
  onDeactivate() { this.points = []; }
  onPointerDown(e: PointerEvent, ctx: ToolContext) {
    if (e.button !== 0) return;
    const editor = useEditorStore();
    const p = ctx.snap?.point ?? ctx.worldPoint;
    if (editor.utilityMode === 'point') this.commit([p]);
    else if (!this.points.length) this.points = [p];
    else this.points.push(...routeTo(this.points[this.points.length - 1], p, e.shiftKey).slice(1));
    ctx.requestPreviewRedraw();
  }
  onKeyDown(e: KeyboardEvent, ctx: ToolContext) {
    if (e.key === 'Enter' && this.points.length > 1) {
      this.commit(this.points);
      this.points = [];
    }
    if (e.key === 'Escape') this.points = [];
    ctx.requestPreviewRedraw();
  }
  private commit(points: Vec2[]) {
    const editor = useEditorStore();
    const def = UTILITY_CATALOG[editor.utilityKind];
    useHistoryStore().execute(putUtility({
      id: nanoid(), kind: editor.utilityKind, label: def.name,
      points: [...points], height: def.height, rotation: 0, circuit: '',
    }));
  }
  renderPreview(ctx: ToolContext) {
    const editor = useEditorStore();
    const def = UTILITY_CATALOG[editor.utilityKind];
    const p = ctx.snap?.point ?? ctx.worldPoint;
    const pts = this.points.length
      ? [...this.points, ...routeTo(this.points[this.points.length - 1], p, ctx.modifiers.shift).slice(1)] : [p];
    ctx.previewLayer.add(new Konva.Line({ points: pts.flatMap(v => [v.x, v.y]), stroke: def.color,
      strokeWidth: 3 / ctx.viewScale, dash: [6 / ctx.viewScale, 4 / ctx.viewScale], listening: false }));
    ctx.previewLayer.add(new Konva.Circle({ x: p.x, y: p.y, radius: 8 / ctx.viewScale,
      stroke: def.color, strokeWidth: 2 / ctx.viewScale, listening: false }));
  }
}
