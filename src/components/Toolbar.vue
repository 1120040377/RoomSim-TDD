<script setup lang="ts">
import { useEditorStore, type ToolName } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';

defineEmits<{
  (e: 'enter-walkthrough'): void;
  (e: 'back'): void;
  (e: 'export'): void;
  (e: 'help'): void;
}>();

const editor = useEditorStore();
const history = useHistoryStore();

const tools: Array<{ name: ToolName; label: string; key: string }> = [
  { name: 'select', label: '选择', key: 'V' },
  { name: 'wall', label: '画墙', key: 'W' },
  { name: 'rect-room', label: '矩形房间', key: 'R' },
  { name: 'door', label: '门', key: 'D' },
  { name: 'window', label: '窗', key: 'I' },
];
</script>

<template>
  <header class="flex items-center justify-between px-4 py-2 border-b bg-white gap-2">
    <div class="flex items-center gap-2">
      <button class="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded" @click="$emit('back')">← 返回</button>
      <div class="flex gap-1 ml-2">
        <button
          v-for="t in tools"
          :key="t.name"
          class="px-3 py-1 text-sm rounded border"
          :class="editor.activeTool === t.name ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300 hover:bg-gray-50'"
          :title="`${t.label} (${t.key})`"
          @click="editor.setTool(t.name)"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-40"
        :disabled="!history.canUndo"
        title="Undo (Ctrl+Z)"
        @click="history.undo()"
      >
        ↶ Undo
      </button>
      <button
        class="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-40"
        :disabled="!history.canRedo"
        title="Redo (Ctrl+Shift+Z)"
        @click="history.redo()"
      >
        ↷ Redo
      </button>
      <button
        class="px-2 py-1 text-sm rounded border border-gray-300"
        @click="$emit('export')"
      >
        导出 JSON
      </button>
      <button
        class="w-7 h-7 text-sm rounded border border-gray-300 hover:bg-gray-50"
        title="快捷键 (?)"
        @click="$emit('help')"
      >
        ?
      </button>
      <button
        class="px-3 py-1 text-sm bg-primary text-white rounded"
        @click="$emit('enter-walkthrough')"
      >
        进入漫游 →
      </button>
    </div>
  </header>
</template>
