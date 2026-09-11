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
import RenovationPanel from '@/components/RenovationPanel.vue';
import { removeUtility } from '@/modules/commands/renovation';
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
const advanced = ref(false);
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
  if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]')) return;
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
    if (sel?.kind === 'utility') {
      e.preventDefault();
      historyStore.execute(removeUtility(sel.id));
      editorStore.clearSelection();
      return;
    }
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
    <nav class="workspace-tabs">
      <strong>{{ planStore.plan?.name ?? 'RoomSim' }}</strong>
      <button v-if="!advanced" class="active">2D 户型设计</button>
      <button v-for="tab in (advanced ? [{ id: 'furniture', label: '家具参考' }, { id: 'utilities', label: '水电参考' }, { id: 'finish', label: '装修材质' }] as const : [])" :key="tab.id"
        :class="{ active: editorStore.workspace === tab.id }"
        @click="editorStore.workspace = tab.id; editorStore.setTool('select')">{{ tab.label }}</button>
      <span><button @click="advanced=!advanced;editorStore.showFurniture=advanced;editorStore.showUtilities=advanced;editorStore.setTool('select')">{{advanced?'返回户型设计':'展开平面参考'}}</button>2D 户型 · 3D 装修与生活</span>
    </nav>
    <div class="flex-1 flex relative min-h-0">
      <aside v-if="!advanced" class="structure-panel">
        <h2>先把家画出来</h2><p>用墙、门、窗定义空间。家具、安装高度和水电走线在 3D 装修模式中调整。</p>
        <button @click="enterWalkthrough">进入 3D 装修与生活 →</button>
        <h3>房间 · {{planStore.rooms.length}}</h3>
        <div v-for="room in planStore.rooms" :key="room.id"><span>{{room.name}}</span><small>{{room.area.toFixed(1)}} ㎡</small></div>
        <p>W 画墙 · R 矩形房间<br />D 门 · I 窗 · Shift 正交<br />空格拖动画布 · 滚轮缩放</p>
      </aside>
      <FurniturePanel v-else-if="editorStore.workspace === 'furniture'" />
      <RenovationPanel v-else />
      <div class="flex-1 relative min-w-0">
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

<style scoped>
.structure-panel{width:235px;flex-shrink:0;background:white;border-right:1px solid #e1e8eb;padding:20px 16px;font-size:12px;overflow:auto}.structure-panel h2{font-size:16px;color:#30505b;margin-bottom:12px}.structure-panel p{color:#85949b;line-height:1.9;margin:16px 0}.structure-panel button{padding:11px;background:#247981;color:white;border-radius:5px;width:100%}.structure-panel h3{margin:25px 0 12px}.structure-panel div{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid #eef2f3}.structure-panel small{color:#7f919b}
.workspace-tabs { display: flex; align-items: center; gap: 6px; padding: 0 18px; background: #f8fafb; border-bottom: 1px solid #dfe6eb; min-height: 46px; font-size: 13px; }
.workspace-tabs strong { margin-right: 22px; color: #324653; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-tabs button { padding: 13px 16px; border-bottom: 2px solid transparent; color: #657784; }.workspace-tabs button.active { color: #166b73; border-color: #166b73; }.workspace-tabs span { margin-left: auto; color: #8d9aa3; font-size: 12px; }
</style>
