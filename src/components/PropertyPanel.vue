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
} from '@/modules/commands';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';
import type { Furniture } from '@/modules/model/types';

const planStore = usePlanStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();

const selectedFurniture = computed<Furniture | null>(() => {
  const t = editorStore.selection[0];
  if (!t || t.kind !== 'furniture' || !planStore.plan) return null;
  return planStore.plan.furniture[t.id] ?? null;
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
</script>

<template>
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
