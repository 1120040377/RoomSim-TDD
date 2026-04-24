import type Konva from 'konva';
import type { Vec2 } from '@/modules/model/types';
import type { SnapResult } from '@/modules/geometry/snap';

export type ToolName = 'select' | 'wall' | 'rect-room' | 'door' | 'window' | 'furniture' | 'measure';

export interface ToolContext {
  stage: Konva.Stage;
  /** 鼠标在世界坐标（cm）*/
  worldPoint: Vec2;
  snap: SnapResult | null;
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
  previewLayer: Konva.Layer;
  /** 通知 Canvas 触发一次预览重绘 */
  requestPreviewRedraw(): void;
}

export interface Tool {
  name: ToolName;
  cursor: string;
  onPointerDown?(e: PointerEvent, ctx: ToolContext): void;
  onPointerMove?(e: PointerEvent, ctx: ToolContext): void;
  onPointerUp?(e: PointerEvent, ctx: ToolContext): void;
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): void;
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
  renderPreview?(ctx: ToolContext): void;
}
