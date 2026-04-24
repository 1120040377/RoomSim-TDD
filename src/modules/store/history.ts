import { defineStore } from 'pinia';
import { ref, computed, markRaw } from 'vue';
import type { Command } from '@/modules/commands/base';

const MAX_SIZE = 50;

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<Command[]>([]);
  const redoStack = ref<Command[]>([]);

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  function execute(cmd: Command) {
    cmd.do();
    // 尝试合并到栈顶（典型用例：连续拖动的多个 Move）
    const top = undoStack.value[undoStack.value.length - 1];
    const merged = top?.mergeWith?.(cmd) ?? null;
    if (merged) {
      undoStack.value = [
        ...undoStack.value.slice(0, -1),
        markRaw(merged),
      ];
    } else {
      const next = [...undoStack.value, markRaw(cmd)];
      if (next.length > MAX_SIZE) next.shift();
      undoStack.value = next;
    }
    redoStack.value = [];
  }

  function undo() {
    const cmd = undoStack.value[undoStack.value.length - 1];
    if (!cmd) return;
    cmd.undo();
    undoStack.value = undoStack.value.slice(0, -1);
    redoStack.value = [...redoStack.value, markRaw(cmd)];
  }

  function redo() {
    const cmd = redoStack.value[redoStack.value.length - 1];
    if (!cmd) return;
    cmd.do();
    redoStack.value = redoStack.value.slice(0, -1);
    undoStack.value = [...undoStack.value, markRaw(cmd)];
  }

  function $reset() {
    undoStack.value = [];
    redoStack.value = [];
  }

  return { undoStack, redoStack, canUndo, canRedo, execute, undo, redo, $reset };
});
