<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePlanStore } from '@/modules/store/plan';
import { useEditorStore } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';
import type { Finish, Utility, UtilityKind } from '@/modules/model/types';
import { defaultRenovation, routeLength, UTILITY_CATALOG } from '@/modules/renovation/model';
import { putUtility, removeUtility, updateFinish, updateRoomFloor } from '@/modules/commands/renovation';
const plan = usePlanStore();
const editor = useEditorStore();
const history = useHistoryStore();
const renovation = computed(() => plan.plan?.renovation ?? defaultRenovation());
const floorRoom = ref('');
const currentFloor = computed(() => renovation.value.roomFloors?.[floorRoom.value] ?? renovation.value.finish);
const utilities = computed(() => Object.values(renovation.value.utilities));
const selected = computed(() => {
  const s = editor.selection[0];
  return s?.kind === 'utility' ? renovation.value.utilities[s.id] : undefined;
});
const length = computed(() => utilities.value.reduce((sum, u) => sum + routeLength(u), 0) / 100);
function choose(kind: UtilityKind, mode: 'point' | 'route') {
  editor.setTool('select');
  editor.utilityKind = kind;
  editor.utilityMode = mode;
  editor.showUtilities = true;
  editor.setTool('utility');
}
function edit(patch: Partial<Utility>) {
  if (selected.value) {
    if(patch.height!==undefined)patch.points=selected.value.points.map(p=>({...p,height:Math.max(0,Math.min(500,(p.height??selected.value!.height)+patch.height!-selected.value!.height))}));
    history.execute(putUtility({ ...selected.value, ...patch }));
  }
}
function numeric(field: 'height' | 'rotation', event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  if (!Number.isFinite(value) || (field === 'height' && (value < 0 || value > 500))) return;
  edit({ [field]: field === 'rotation' ? value * Math.PI / 180 : value });
}
function finish(patch: Partial<Finish>) {
  if (floorRoom.value && plan.plan?.rooms[floorRoom.value]) history.execute(updateRoomFloor(floorRoom.value, patch));
  else history.execute(updateFinish(patch));
}
function remove() {
  if (selected.value) history.execute(removeUtility(selected.value.id));
  editor.clearSelection();
}
</script>

<template>
  <aside class="renovation-panel">
    <template v-if="editor.workspace === 'utilities'">
      <h2>水电规划 <span>cm / m</span></h2>
      <p class="muted">先布点，再规划管线路径。</p>
      <h3>添加点位</h3>
      <div class="choices">
        <button v-for="(item, kind) in UTILITY_CATALOG" :key="kind"
          :class="{ active: editor.activeTool === 'utility' && editor.utilityKind === kind && editor.utilityMode === 'point' }"
          @click="choose(kind, 'point')"><i :style="{ background: item.color }" />{{ item.name }}{{ kind === 'electric' ? '接线盒' : '' }}</button>
      </div>
      <h3>绘制管线</h3>
      <div class="choices">
        <button v-for="kind in (['electric', 'cold-water', 'hot-water', 'drain'] as const)" :key="kind"
          :class="{ active: editor.activeTool === 'utility' && editor.utilityKind === kind && editor.utilityMode === 'route' }"
          @click="choose(kind, 'route')"><i :style="{ background: UTILITY_CATALOG[kind].color }" />{{ UTILITY_CATALOG[kind].name }}管线</button>
      </div>
      <p class="muted">点击添加折点，Enter 完成；Shift 切换转弯方向，Esc 取消未完成管线。</p>
      <label class="toggle"><input v-model="editor.showUtilities" type="checkbox" />显示水电图层</label>
      <div class="metrics">{{ utilities.filter(u => u.points.length === 1).length }} 个点位 · {{ length.toFixed(2) }} m 管线</div>
      <section v-if="selected" class="properties">
        <h3>点位 / 管线属性</h3>
        <label>名称<input aria-label="点位名称" :value="selected.label" @change="edit({ label: ($event.target as HTMLInputElement).value })" /></label>
        <label>离地高度 (cm)<input aria-label="离地高度" type="number" min="0" max="500" :value="selected.height" @change="numeric('height', $event)" /></label>
        <label>面板朝向 (°)<input aria-label="面板朝向" type="number" :value="Math.round(selected.rotation * 180 / Math.PI)" @change="numeric('rotation', $event)" /></label>
        <label>回路 / 用途<input aria-label="回路用途" placeholder="例如：厨房插座回路" :value="selected.circuit" @change="edit({ circuit: ($event.target as HTMLInputElement).value })" /></label>
        <p v-if="selected.points.length > 1">长度 {{ (routeLength(selected) / 100).toFixed(2) }} m</p>
        <button class="delete" @click="remove">删除点位 / 管线</button>
      </section>
      <h3>点位与管线清单</h3>
      <p v-if="!utilities.length" class="muted">选择上方工具，在平面图中点击放置。</p>
      <button v-for="u in utilities" :key="u.id" class="list-item" :class="{ active: selected?.id === u.id }"
        @click="editor.setTool('select'); editor.showUtilities = true; editor.select({ kind: 'utility', id: u.id })">
        <i :style="{ background: UTILITY_CATALOG[u.kind].color }" />{{ u.label }}<small>{{ u.points.length > 1 ? (routeLength(u) / 100).toFixed(1) + 'm' : u.height + 'cm' }}</small>
      </button>
      <p class="muted">高度为可编辑的规划初值；管线为等高示意，长度不含竖向连接与施工余量。</p>
    </template>
    <template v-else>
      <h2>装修材质 <span>全屋</span></h2>
      <p class="muted">材质同步到 3D，可撤销并随方案保存。</p>
      <h3>地面铺装</h3>
      <label>应用范围<select v-model="floorRoom" aria-label="地面应用范围">
        <option value="">全屋默认（房间覆盖优先）</option>
        <option v-for="room in plan.plan?.rooms" :key="room.id" :value="room.id">{{ room.name }}</option>
      </select></label>
      <button v-if="floorRoom && renovation.roomFloors?.[floorRoom]" @click="history.execute(updateRoomFloor(floorRoom, null))">恢复全屋默认</button>
      <div class="finish-choices">
        <button v-for="f in ([{ id: 'wood', name: '温润木地板' }, { id: 'tile', name: '现代瓷砖' }, { id: 'concrete', name: '素色水泥' }] as const)"
          :key="f.id" :class="{ active: currentFloor.floor === f.id }" @click="finish({ floor: f.id })">
          <div class="swatch" :class="f.id" :style="{ backgroundColor: currentFloor.floorColor }" />{{ f.name }}
        </button>
      </div>
      <label class="color-label">地面颜色<input aria-label="地面颜色" type="color" :value="currentFloor.floorColor" @change="finish({ floorColor: ($event.target as HTMLInputElement).value })" /></label>
      <label class="color-label">墙面颜色（全屋）<input aria-label="墙面颜色" type="color" :value="renovation.finish.wallColor" @change="history.execute(updateFinish({ wallColor: ($event.target as HTMLInputElement).value }))" /></label>
      <h3>搭配预设</h3>
      <div class="choices">
        <button @click="finish({ floor: 'wood', floorColor: '#d6bc94', wallColor: '#f5f0e8' })">原木暖白</button>
        <button @click="finish({ floor: 'tile', floorColor: '#c7c9c8', wallColor: '#f2f3f0' })">浅灰现代</button>
        <button @click="finish({ floor: 'concrete', floorColor: '#a8a39b', wallColor: '#e5ddd0' })">自然侘寂</button>
      </div>
      <p class="muted">进入 3D 后，可切换俯瞰 / 漫游、日景 / 夜景，并打开水电透视检查布局。</p>
    </template>
  </aside>
</template>

<style scoped>
.renovation-panel { width: 250px; flex-shrink: 0; padding: 18px 16px; border-right: 1px solid #e2e8f0; background: #fff; overflow-y: auto; font-size: 13px; }
h2 { font-size: 16px; font-weight: 650; display: flex; justify-content: space-between; margin: 0 0 8px; } h2 span { font-size: 11px; color: #84919b; font-weight: 400; }
h3 { margin: 20px 0 10px; font-weight: 600; font-size: 12px; }
.muted { color: #7b8794; font-size: 12px; line-height: 1.8; margin: 10px 0; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
button { border: 1px solid #dce3e9; border-radius: 5px; padding: 9px 7px; text-align: left; background: white; cursor: pointer; }
button:hover { background: #f4f8fb; } button.active { border-color: #247b83; background: #eef8f7; color: #14656c; }
i { width: 7px; height: 7px; display: inline-block; border-radius: 50%; margin-right: 7px; }
.toggle { display: flex; gap: 8px; align-items: center; margin: 14px 0; }.metrics { padding: 12px 0; border-block: 1px solid #e5e9ee; color: #41606b; }
.properties label { display: grid; gap: 5px; margin: 10px 0; color: #657381; }.properties input { width: 100%; padding: 7px; border: 1px solid #dce3e9; border-radius: 4px; color: #253540; }
.delete { color: #b73838; width: 100%; text-align: center; }.list-item { width: 100%; margin-bottom: 5px; }.list-item small { float: right; color: #7b8794; }
.finish-choices { display: grid; gap: 8px; }.swatch { height: 42px; margin-bottom: 7px; }.wood { background-image: repeating-linear-gradient(0deg, transparent 0 12px, #0002 12px 13px); }.tile { background-image: linear-gradient(#fff7 1px, transparent 1px), linear-gradient(90deg, #fff7 1px, transparent 1px); background-size: 22px 22px; }.color-label { display: flex; align-items: center; justify-content: space-between; margin: 18px 0; }
</style>
