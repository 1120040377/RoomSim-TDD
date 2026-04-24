<script setup lang="ts">
import { ref } from 'vue';
import type { FurnitureType } from '@/modules/model/types';
import {
  FURNITURE_CATALOG,
  FURNITURE_BY_CATEGORY,
  type FurnitureCategory,
} from '@/modules/templates/furniture-catalog';
import { useEditorStore } from '@/modules/store/editor';

const editor = useEditorStore();

const categories: Array<{ id: FurnitureCategory; label: string }> = [
  { id: 'bedroom', label: '卧室' },
  { id: 'livingroom', label: '客厅' },
  { id: 'dining', label: '餐厨' },
  { id: 'kitchen', label: '厨房' },
  { id: 'bathroom', label: '卫浴' },
  { id: 'office', label: '办公' },
  { id: 'lighting', label: '灯光' },
];

const expanded = ref<FurnitureCategory | null>('livingroom');

function pick(type: FurnitureType) {
  editor.setTool('furniture');
  editor.pendingFurnitureType = type;
}
</script>

<template>
  <aside class="w-56 bg-white border-r overflow-y-auto text-sm">
    <div class="px-3 py-2 font-medium text-gray-700 border-b">家具库</div>
    <template v-for="c in categories" :key="c.id">
      <button
        class="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b text-left"
        @click="expanded = expanded === c.id ? null : c.id"
      >
        <span>{{ c.label }}</span>
        <span class="text-gray-400">{{ expanded === c.id ? '▾' : '▸' }}</span>
      </button>
      <div v-if="expanded === c.id" class="px-2 py-2 grid grid-cols-2 gap-1">
        <button
          v-for="t in FURNITURE_BY_CATEGORY[c.id]"
          :key="t"
          class="px-2 py-1 text-xs rounded border"
          :class="editor.pendingFurnitureType === t ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300 hover:bg-gray-50'"
          @click="pick(t)"
        >
          {{ FURNITURE_CATALOG[t].name }}
        </button>
      </div>
    </template>
  </aside>
</template>
