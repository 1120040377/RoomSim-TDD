<script setup lang="ts">
import { computed } from 'vue';
import { usePlanStore } from '@/modules/store/plan';
import { useEditorStore } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';
import {
  RotateFurnitureCommand,
  UpdateFurnitureCommand,
  RemoveFurnitureCommand,
  DuplicateFurnitureCommand,
  RemoveWallCommand,
  UpdateWallCommand,
  RemoveOpeningCommand,
  UpdateOpeningCommand,
} from '@/modules/commands';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';
import type { Furniture, Wall, Opening } from '@/modules/model/types';

const planStore = usePlanStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();

const selectedFurniture = computed<Furniture | null>(() => {
  const t = editorStore.selection[0];
  if (!t || t.kind !== 'furniture' || !planStore.plan) return null;
  return planStore.plan.furniture[t.id] ?? null;
});

const selectedWall = computed<Wall | null>(() => {
  const t = editorStore.selection[0];
  if (!t || t.kind !== 'wall' || !planStore.plan) return null;
  return planStore.plan.walls[t.id] ?? null;
});

const selectedOpening = computed<Opening | null>(() => {
  const t = editorStore.selection[0];
  if (!t || t.kind !== 'opening' || !planStore.plan) return null;
  return planStore.plan.openings[t.id] ?? null;
});

function updateSize(patch: Partial<{ width: number; depth: number; height: number }>) {
  const f = selectedFurniture.value;
  if (!f) return;
  historyStore.execute(
    new UpdateFurnitureCommand(f.id, { size: { ...f.size, ...patch } }),
  );
}

function updateColor(color: string) {
  const f = selectedFurniture.value;
  if (!f) return;
  historyStore.execute(new UpdateFurnitureCommand(f.id, { color }));
}

function rotate(deg: number) {
  const f = selectedFurniture.value;
  if (!f) return;
  const newRot = f.rotation + (deg * Math.PI) / 180;
  historyStore.execute(new RotateFurnitureCommand(f.id, f.rotation, newRot));
}

function duplicate() {
  const f = selectedFurniture.value;
  if (!f) return;
  historyStore.execute(new DuplicateFurnitureCommand(f.id));
}

function remove() {
  const f = selectedFurniture.value;
  if (!f) return;
  historyStore.execute(new RemoveFurnitureCommand(f.id));
  editorStore.clearSelection();
}

function defName(type: string) {
  return FURNITURE_CATALOG[type as keyof typeof FURNITURE_CATALOG]?.name ?? type;
}

function updateWall(patch: { thickness?: number; height?: number }) {
  const w = selectedWall.value;
  if (!w) return;
  historyStore.execute(new UpdateWallCommand(w.id, patch));
}

function removeWall() {
  const w = selectedWall.value;
  if (!w) return;
  historyStore.execute(new RemoveWallCommand(w.id));
  editorStore.clearSelection();
}

function updateOpening(patch: Partial<{ width: number; height: number; sillHeight: number; hinge: 'start' | 'end'; swing: 'inside' | 'outside' }>) {
  const op = selectedOpening.value;
  if (!op) return;
  historyStore.execute(new UpdateOpeningCommand(op.id, patch));
}

function removeOpening() {
  const op = selectedOpening.value;
  if (!op) return;
  historyStore.execute(new RemoveOpeningCommand(op.id));
  editorStore.clearSelection();
}
</script>

<template>
  <!-- 门窗属性面板 -->
  <aside
    v-if="selectedOpening"
    class="w-56 bg-white border-l overflow-y-auto text-sm"
  >
    <div class="px-3 py-2 font-medium text-gray-700 border-b flex items-center justify-between">
      <span>{{ selectedOpening.kind === 'door' ? '门' : '窗' }}</span>
      <button
        class="text-xs text-gray-400 hover:text-gray-700"
        @click="editorStore.clearSelection()"
      >
        ✕
      </button>
    </div>
    <div class="px-3 py-3 space-y-3">
      <!-- 尺寸 -->
      <fieldset class="space-y-2">
        <legend class="text-xs text-gray-500">尺寸 (cm)</legend>
        <div class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
          <label class="text-xs text-gray-500">宽度</label>
          <input
            type="number"
            :value="selectedOpening.width"
            class="border rounded px-2 py-0.5 text-sm"
            min="10"
            @change="updateOpening({ width: +($event.target as HTMLInputElement).value })"
          />
          <label class="text-xs text-gray-500">高度</label>
          <input
            type="number"
            :value="selectedOpening.height"
            class="border rounded px-2 py-0.5 text-sm"
            min="10"
            @change="updateOpening({ height: +($event.target as HTMLInputElement).value })"
          />
          <label class="text-xs text-gray-500">窗台高</label>
          <input
            type="number"
            :value="selectedOpening.sillHeight"
            class="border rounded px-2 py-0.5 text-sm"
            min="0"
            @change="updateOpening({ sillHeight: +($event.target as HTMLInputElement).value })"
          />
        </div>
      </fieldset>

      <!-- 门专属：合页 + 开启方向 -->
      <fieldset v-if="selectedOpening.kind === 'door'" class="space-y-2 pt-2 border-t">
        <legend class="text-xs text-gray-500 mb-1">门属性</legend>
        <div class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
          <label class="text-xs text-gray-500">合页</label>
          <div class="flex gap-1">
            <button
              class="flex-1 text-xs border rounded py-0.5"
              :class="selectedOpening.hinge === 'start' ? 'bg-primary text-white border-primary' : 'hover:bg-gray-50'"
              @click="updateOpening({ hinge: 'start' })"
            >起点</button>
            <button
              class="flex-1 text-xs border rounded py-0.5"
              :class="selectedOpening.hinge === 'end' ? 'bg-primary text-white border-primary' : 'hover:bg-gray-50'"
              @click="updateOpening({ hinge: 'end' })"
            >终点</button>
          </div>
          <label class="text-xs text-gray-500">开向</label>
          <div class="flex gap-1">
            <button
              class="flex-1 text-xs border rounded py-0.5"
              :class="selectedOpening.swing === 'inside' ? 'bg-primary text-white border-primary' : 'hover:bg-gray-50'"
              @click="updateOpening({ swing: 'inside' })"
            >内开</button>
            <button
              class="flex-1 text-xs border rounded py-0.5"
              :class="selectedOpening.swing === 'outside' ? 'bg-primary text-white border-primary' : 'hover:bg-gray-50'"
              @click="updateOpening({ swing: 'outside' })"
            >外开</button>
          </div>
        </div>
      </fieldset>

      <!-- 操作 -->
      <fieldset class="pt-2 border-t">
        <button
          class="w-full border rounded py-1 text-red-600 hover:bg-red-50"
          @click="removeOpening"
        >
          删除 (Del)
        </button>
      </fieldset>

      <!-- 位置信息 -->
      <div class="text-xs text-gray-400 pt-2 border-t">
        偏移：{{ Math.round(selectedOpening.offset) }} cm
      </div>
    </div>
  </aside>

  <!-- 墙体属性面板 -->
  <aside
    v-if="selectedWall"
    class="w-56 bg-white border-l overflow-y-auto text-sm"
  >
    <div class="px-3 py-2 font-medium text-gray-700 border-b flex items-center justify-between">
      <span>墙体</span>
      <button
        class="text-xs text-gray-400 hover:text-gray-700"
        @click="editorStore.clearSelection()"
      >
        ✕
      </button>
    </div>
    <div class="px-3 py-3 space-y-3">
      <fieldset class="space-y-2">
        <legend class="text-xs text-gray-500">尺寸 (cm)</legend>
        <div class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
          <label class="text-xs text-gray-500">厚度</label>
          <input
            type="number"
            :value="selectedWall.thickness"
            class="border rounded px-2 py-0.5 text-sm"
            min="1"
            @change="updateWall({ thickness: +($event.target as HTMLInputElement).value })"
          />
          <label class="text-xs text-gray-500">高度</label>
          <input
            type="number"
            :value="selectedWall.height"
            class="border rounded px-2 py-0.5 text-sm"
            min="1"
            @change="updateWall({ height: +($event.target as HTMLInputElement).value })"
          />
        </div>
      </fieldset>
      <fieldset class="pt-2 border-t">
        <button
          class="w-full border rounded py-1 text-red-600 hover:bg-red-50"
          @click="removeWall"
        >
          删除墙体 (Del)
        </button>
      </fieldset>
    </div>
  </aside>

  <!-- 家具属性面板 -->
  <aside
    v-if="selectedFurniture"
    class="w-56 bg-white border-l overflow-y-auto text-sm"
  >
    <div class="px-3 py-2 font-medium text-gray-700 border-b flex items-center justify-between">
      <span>{{ defName(selectedFurniture.type) }}</span>
      <button
        class="text-xs text-gray-400 hover:text-gray-700"
        @click="editorStore.clearSelection()"
      >
        ✕
      </button>
    </div>

    <div class="px-3 py-3 space-y-3">
      <!-- 尺寸 -->
      <fieldset class="space-y-2">
        <legend class="text-xs text-gray-500">尺寸 (cm)</legend>
        <div class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
          <label class="text-xs text-gray-500">宽</label>
          <input
            type="number"
            :value="selectedFurniture.size.width"
            class="border rounded px-2 py-0.5 text-sm"
            min="10"
            @change="updateSize({ width: +($event.target as HTMLInputElement).value })"
          />
          <label class="text-xs text-gray-500">深</label>
          <input
            type="number"
            :value="selectedFurniture.size.depth"
            class="border rounded px-2 py-0.5 text-sm"
            min="10"
            @change="updateSize({ depth: +($event.target as HTMLInputElement).value })"
          />
          <label class="text-xs text-gray-500">高</label>
          <input
            type="number"
            :value="selectedFurniture.size.height"
            class="border rounded px-2 py-0.5 text-sm"
            min="10"
            @change="updateSize({ height: +($event.target as HTMLInputElement).value })"
          />
        </div>
      </fieldset>

      <!-- 颜色 -->
      <fieldset>
        <legend class="text-xs text-gray-500 mb-1">颜色</legend>
        <input
          type="color"
          :value="selectedFurniture.color ?? '#d4d4d8'"
          class="w-full h-8 border rounded"
          @change="updateColor(($event.target as HTMLInputElement).value)"
        />
      </fieldset>

      <!-- 旋转 -->
      <fieldset>
        <legend class="text-xs text-gray-500 mb-1">
          旋转 ({{ Math.round((selectedFurniture.rotation * 180) / Math.PI) }}°)
        </legend>
        <div class="flex gap-1">
          <button class="flex-1 border rounded py-1 hover:bg-gray-50" @click="rotate(-90)">↺ 90°</button>
          <button class="flex-1 border rounded py-1 hover:bg-gray-50" @click="rotate(90)">↻ 90°</button>
        </div>
      </fieldset>

      <!-- 操作 -->
      <fieldset class="pt-2 border-t space-y-1">
        <button class="w-full border rounded py-1 hover:bg-gray-50" @click="duplicate">复制 (Ctrl+D)</button>
        <button
          class="w-full border rounded py-1 text-red-600 hover:bg-red-50"
          @click="remove"
        >
          删除 (Del)
        </button>
      </fieldset>

      <!-- 坐标 -->
      <div class="text-xs text-gray-400 pt-2 border-t">
        位置：({{ Math.round(selectedFurniture.position.x) }}, {{ Math.round(selectedFurniture.position.y) }})
      </div>
    </div>
  </aside>
</template>
