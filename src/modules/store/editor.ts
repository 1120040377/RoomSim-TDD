import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SelectionTarget, Vec2 } from '@/modules/model/types';

export type ToolName =
  | 'select'
  | 'wall'
  | 'rect-room'
  | 'door'
  | 'window'
  | 'furniture'
  | 'measure';

export interface Viewport {
  scale: number;
  offset: Vec2;
}

export const useEditorStore = defineStore('editor', () => {
  const activeTool = ref<ToolName>('select');
  const selection = ref<SelectionTarget[]>([]);
  const viewport = ref<Viewport>({ scale: 1, offset: { x: 0, y: 0 } });
  const snapEnabled = ref(true);
  const showErgonomics = ref(true);
  const showDimensions = ref(true);
  const showGrid = ref(true);

  /** 当前要放置的家具类型（拖拽/点击生成时由 FurniturePanel 设置） */
  const pendingFurnitureType = ref<string | null>(null);

  function setTool(t: ToolName) {
    activeTool.value = t;
    if (t !== 'furniture') pendingFurnitureType.value = null;
  }

  function select(target: SelectionTarget, append = false) {
    if (!append) selection.value = [target];
    else if (!selection.value.some((t) => t.kind === target.kind && t.id === target.id)) {
      selection.value = [...selection.value, target];
    }
  }

  function clearSelection() {
    selection.value = [];
  }

  function setViewport(v: Partial<Viewport>) {
    viewport.value = { ...viewport.value, ...v };
  }

  function $reset() {
    activeTool.value = 'select';
    selection.value = [];
    viewport.value = { scale: 1, offset: { x: 0, y: 0 } };
    snapEnabled.value = true;
    showErgonomics.value = true;
    showDimensions.value = true;
    showGrid.value = true;
    pendingFurnitureType.value = null;
  }

  return {
    activeTool,
    selection,
    viewport,
    snapEnabled,
    showErgonomics,
    showDimensions,
    showGrid,
    pendingFurnitureType,
    setTool,
    select,
    clearSelection,
    setViewport,
    $reset,
  };
});
