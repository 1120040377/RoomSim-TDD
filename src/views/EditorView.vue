<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePlanStore } from '@/modules/store/plan';
import { useEditorStore } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';
import { planRepo, setupAutoSave } from '@/modules/storage/plan-repo';
import { exportPlan } from '@/modules/storage/io';
import EditorCanvas from '@/modules/editor/Canvas.vue';
import Toolbar from '@/components/Toolbar.vue';
import FurniturePanel from '@/components/FurniturePanel.vue';
import PropertyPanel from '@/components/PropertyPanel.vue';
import HelpOverlay from '@/components/HelpOverlay.vue';
import {
  RemoveFurnitureCommand,
  DuplicateFurnitureCommand,
  RemoveWallCommand,
  RemoveOpeningCommand,
} from '@/modules/commands';

const props = defineProps<{ id: string }>();
const router = useRouter();
const planStore = usePlanStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();

const ready = ref(false);
const helpOpen = ref(false);
let stopAutoSave: (() => void) | null = null;

onMounted(async () => {
  // 从漫游返回时 planStore.plan 已经是最新内存状态；此时若再读 IndexedDB
  // 反而可能读出比内存更旧的版本并覆盖（undo 栈也会被清空）。
  if (planStore.plan?.id !== props.id) {
    const plan = await planRepo.get(props.id);
    if (!plan) {
      router.push('/');
      return;
    }
    planStore.loadPlan(plan);
    editorStore.$reset();
    historyStore.$reset();
  }
  stopAutoSave = setupAutoSave();
  window.addEventListener('keydown', onKeyDown);
  ready.value = true;
});

onBeforeUnmount(() => {
  stopAutoSave?.();
  window.removeEventListener('keydown', onKeyDown);
});

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  // ? 或 Shift+/ 打开快捷键帮助；帮助打开时 Esc 关闭
  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    e.preventDefault();
    helpOpen.value = !helpOpen.value;
    return;
  }
  if (helpOpen.value && e.key === 'Escape') {
    helpOpen.value = false;
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    historyStore.undo();
    return;
  }
  if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    historyStore.redo();
    return;
  }
  // Del 删除选中对象
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const sel = editorStore.selection[0];
    if (sel?.kind === 'furniture') {
      e.preventDefault();
      historyStore.execute(new RemoveFurnitureCommand(sel.id));
      editorStore.clearSelection();
      return;
    }
    if (sel?.kind === 'wall') {
      e.preventDefault();
      historyStore.execute(new RemoveWallCommand(sel.id));
      editorStore.clearSelection();
      return;
    }
    if (sel?.kind === 'opening') {
      e.preventDefault();
      historyStore.execute(new RemoveOpeningCommand(sel.id));
      editorStore.clearSelection();
      return;
    }
  }
  // Ctrl+D 复制选中家具
  if (mod && e.key.toLowerCase() === 'd') {
    const sel = editorStore.selection[0];
    if (sel?.kind === 'furniture') {
      e.preventDefault();
      historyStore.execute(new DuplicateFurnitureCommand(sel.id));
      return;
    }
  }
  switch (e.key.toLowerCase()) {
    case 'v':
      editorStore.setTool('select');
      break;
    case 'w':
      editorStore.setTool('wall');
      break;
    case 'r':
      editorStore.setTool('rect-room');
      break;
    case 'd':
      if (!mod) editorStore.setTool('door');
      break;
    case 'i':
      editorStore.setTool('window');
      break;
    case 'escape':
      editorStore.setTool('select');
      editorStore.clearSelection();
      break;
  }
}

function goBack() {
  router.push('/');
}

function enterWalkthrough() {
  router.push({ name: 'walkthrough', params: { id: props.id } });
}

function onExport() {
  if (planStore.plan) exportPlan(planStore.plan);
}
</script>

<template>
  <div class="h-full flex flex-col">
    <Toolbar
      @enter-walkthrough="enterWalkthrough"
      @back="goBack"
      @export="onExport"
      @help="helpOpen = true"
    />
    <div class="flex-1 flex relative">
      <FurniturePanel />
      <div class="flex-1 relative">
        <EditorCanvas v-if="ready" />
        <div v-else class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          加载中…
        </div>
      </div>
      <PropertyPanel v-if="ready" />
    </div>
    <HelpOverlay :open="helpOpen" @close="helpOpen = false" />
  </div>
</template>
