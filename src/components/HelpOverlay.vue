<script setup lang="ts">
defineProps<{ open: boolean }>();
defineEmits<{ (e: 'close'): void }>();

interface KeyRow {
  keys: string[];
  desc: string;
}

const editorKeys: KeyRow[] = [
  { keys: ['V'], desc: '选择工具' },
  { keys: ['W'], desc: '画墙（连续点击）' },
  { keys: ['R'], desc: '矩形房间（拖拽）' },
  { keys: ['D'], desc: '放门' },
  { keys: ['I'], desc: '放窗' },
  { keys: ['Esc'], desc: '取消当前工具 / 清除选中' },
  { keys: ['Ctrl', 'Z'], desc: '撤销' },
  { keys: ['Ctrl', 'Shift', 'Z'], desc: '重做' },
  { keys: ['Ctrl', 'D'], desc: '复制选中家具' },
  { keys: ['Del'], desc: '删除选中家具' },
  { keys: ['滚轮'], desc: '缩放' },
  { keys: ['中键拖'], desc: '平移画布' },
];

const walkthroughKeys: KeyRow[] = [
  { keys: ['W/A/S/D'], desc: '前后左右移动' },
  { keys: ['Shift'], desc: '按住跑步' },
  { keys: ['鼠标'], desc: '转动视角（锁定指针后）' },
  { keys: ['E'], desc: '开关门 / 灯 / 交互' },
  { keys: ['Esc'], desc: '返回编辑器' },
];
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded shadow-lg w-[600px] max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-3 border-b">
        <h2 class="text-lg font-semibold">快捷键</h2>
        <button class="text-gray-400 hover:text-gray-700" @click="$emit('close')">✕</button>
      </div>
      <div class="grid grid-cols-2 gap-6 p-5 text-sm">
        <section>
          <h3 class="font-medium mb-2 text-gray-700">编辑器</h3>
          <ul class="space-y-1.5">
            <li v-for="k in editorKeys" :key="k.desc" class="flex items-center justify-between gap-2">
              <div class="flex gap-1">
                <kbd
                  v-for="key in k.keys"
                  :key="key"
                  class="px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-300 rounded font-mono"
                >
                  {{ key }}
                </kbd>
              </div>
              <span class="text-gray-600 text-right">{{ k.desc }}</span>
            </li>
          </ul>
        </section>
        <section>
          <h3 class="font-medium mb-2 text-gray-700">3D 漫游</h3>
          <ul class="space-y-1.5">
            <li v-for="k in walkthroughKeys" :key="k.desc" class="flex items-center justify-between gap-2">
              <div class="flex gap-1">
                <kbd
                  v-for="key in k.keys"
                  :key="key"
                  class="px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-300 rounded font-mono"
                >
                  {{ key }}
                </kbd>
              </div>
              <span class="text-gray-600 text-right">{{ k.desc }}</span>
            </li>
          </ul>
        </section>
      </div>
      <div class="px-5 py-2 border-t text-xs text-gray-400">
        按 <kbd class="px-1 bg-gray-100 border rounded">?</kbd> 或
        <kbd class="px-1 bg-gray-100 border rounded">Shift</kbd> +
        <kbd class="px-1 bg-gray-100 border rounded">/</kbd> 随时唤起
      </div>
    </div>
  </div>
</template>
