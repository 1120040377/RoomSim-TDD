<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { planRepo } from '@/modules/storage/plan-repo';
import { importPlanFromFile } from '@/modules/storage/io';
import { BUILT_IN_TEMPLATES } from '@/modules/templates/index';
import type { PlanRecord } from '@/modules/storage/db';

const router = useRouter();
const plans = ref<PlanRecord[]>([]);
const showTemplatePicker = ref(false);
const importError = ref<string | null>(null);

async function reload() {
  plans.value = await planRepo.list();
}

onMounted(() => {
  reload();
});

async function createFromTemplate(templateId: string) {
  const tpl = BUILT_IN_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return;
  const plan = tpl.build(tpl.name);
  await planRepo.save(plan);
  router.push({ name: 'editor', params: { id: plan.id } });
}

function openPlan(id: string) {
  router.push({ name: 'editor', params: { id } });
}

async function remove(id: string) {
  if (!confirm('确认删除这个方案？')) return;
  await planRepo.remove(id);
  await reload();
}

async function rename(p: PlanRecord) {
  const name = prompt('新名称', p.name);
  if (!name || name === p.name) return;
  await planRepo.rename(p.id, name);
  await reload();
}

async function onImport(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  importError.value = null;
  try {
    const plan = await importPlanFromFile(file);
    await planRepo.save(plan);
    await reload();
  } catch (err) {
    importError.value = err instanceof Error ? err.message : '导入失败';
  }
  (ev.target as HTMLInputElement).value = '';
}
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="px-6 py-4 border-b bg-white flex items-center justify-between">
      <h1 class="text-xl font-semibold">RoomSim</h1>
      <div class="flex gap-2">
        <label class="px-3 py-1 text-sm border rounded cursor-pointer hover:bg-gray-50">
          导入 JSON
          <input type="file" accept=".json,.roomsim.json" class="hidden" @change="onImport" />
        </label>
        <button
          class="px-4 py-2 bg-primary text-white rounded hover:opacity-90"
          @click="showTemplatePicker = true"
        >
          新建方案
        </button>
      </div>
    </header>

    <div v-if="importError" class="px-6 py-2 bg-red-50 text-red-700 text-sm border-b">
      导入失败：{{ importError }}
    </div>

    <main class="flex-1 overflow-auto p-6">
      <div v-if="plans.length === 0" class="text-center text-gray-500 mt-20">
        还没有方案。点击右上角"新建方案"开始。
      </div>
      <ul v-else class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        <li
          v-for="p in plans"
          :key="p.id"
          class="p-4 bg-white border rounded hover:shadow transition"
        >
          <div class="font-medium truncate cursor-pointer" @click="openPlan(p.id)">
            {{ p.name }}
          </div>
          <div class="text-xs text-gray-500 mt-1">
            {{ new Date(p.updatedAt).toLocaleString() }}
          </div>
          <div class="mt-2 flex gap-2 text-xs">
            <button class="text-blue-600 hover:underline" @click="openPlan(p.id)">打开</button>
            <button class="text-gray-600 hover:underline" @click="rename(p)">重命名</button>
            <button class="text-red-600 hover:underline" @click="remove(p.id)">删除</button>
          </div>
        </li>
      </ul>
    </main>

    <!-- 模板选择 -->
    <div
      v-if="showTemplatePicker"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="showTemplatePicker = false"
    >
      <div class="bg-white rounded shadow-lg p-6 w-[520px]">
        <h2 class="text-lg font-semibold mb-4">选择起点</h2>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="t in BUILT_IN_TEMPLATES"
            :key="t.id"
            class="p-4 border rounded hover:bg-gray-50 text-left"
            @click="(showTemplatePicker = false, createFromTemplate(t.id))"
          >
            <div class="font-medium">{{ t.name }}</div>
            <div class="text-xs text-gray-500 mt-1">{{ t.area }} · {{ t.description }}</div>
          </button>
        </div>
        <div class="mt-4 text-right">
          <button class="px-3 py-1 text-sm text-gray-600" @click="showTemplatePicker = false">
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
