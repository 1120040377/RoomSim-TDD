import type { Tool, ToolContext } from './base';
import { useEditorStore } from '@/modules/store/editor';

export class SelectTool implements Tool {
  readonly name = 'select';
  readonly cursor = 'default';

  onPointerDown(_e: PointerEvent, _ctx: ToolContext) {
    // 详细命中测试由 Canvas 各图层自身的 shape 处理。这里仅作兜底：
    // 点空白处清空选择。
    useEditorStore().clearSelection();
  }
}
