import type { Tool, ToolContext } from './base';
import type { FurnitureType } from '@/modules/model/types';
import { useEditorStore } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';
import { AddFurnitureCommand } from '@/modules/commands';

/** 点击画布在光标位置放置当前 pendingFurnitureType。*/
export class FurnitureTool implements Tool {
  readonly name = 'furniture';
  readonly cursor = 'copy';

  onPointerDown(_e: PointerEvent, ctx: ToolContext) {
    const ed = useEditorStore();
    const type = ed.pendingFurnitureType as FurnitureType | null;
    if (!type) return;
    const point = ctx.snap?.point ?? ctx.worldPoint;
    useHistoryStore().execute(new AddFurnitureCommand({ type, position: point }));
  }
}
