import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SelectionTarget, Vec2, UtilityKind } from '@/modules/model/types';

export type ToolName =
  | 'select'
  | 'wall'
  | 'rect-room'
  | 'door'
  | 'window'
  | 'furniture'
  | 'utility'
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
  const showUtilities = ref(false);
  const showFurniture = ref(false);
  const utilityKind = ref<UtilityKind>('socket');
  const utilityMode = ref<'point' | 'route'>('point');
  const workspace = ref<'furniture' | 'utilities' | 'finish'>('furniture');

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
    showUtilities.value = false;
    showFurniture.value = false;
    workspace.value = 'furniture';
    utilityKind.value = 'socket';
    utilityMode.value = 'point';
    pendingFurnitureType.value = null;
  }

  return {
    workspace, showUtilities, showFurniture, utilityKind, utilityMode,
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
