<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePlanStore } from '@/modules/store/plan';
import { useEditorStore } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';
import type { FurnitureType, SelectionTarget } from '@/modules/model/types';
import type { SceneEditTool } from '@/modules/editor/scene-edit';
import { UpdateFurnitureCommand, RemoveFurnitureCommand, DuplicateFurnitureCommand } from '@/modules/commands';
import type { UtilityKind } from '@/modules/model/types';
import RenovationPanel from './RenovationPanel.vue';
const props=defineProps<{selected:SelectionTarget|null;step:number;tool:SceneEditTool;notice:string}>();
const emit=defineEmits<{select:[SelectionTarget|null];add:[FurnitureType];tool:[SceneEditTool,UtilityKind?];step:[number];finish:[]}>();
const plan=usePlanStore(),editor=useEditorStore(),history=useHistoryStore();
const tab=ref<'furniture'|'utilities'|'finish'>('furniture');
const pending=ref<FurnitureType>('fridge');
const furniture=computed(()=>props.selected?.kind==='furniture'?plan.plan?.furniture[props.selected.id]:undefined);
function number(field:'x'|'z'|'elevation'|'rotation'|'width'|'depth'|'height',e:Event) {
  const n=(e.target as HTMLInputElement).valueAsNumber,f=furniture.value;if(!f||!Number.isFinite(n))return;
  if(field==='x'||field==='z')history.execute(new UpdateFurnitureCommand(f.id,{position:{...f.position,[field==='x'?'x':'y']:n}}));
  else if(field==='elevation'){if(n>=0&&n<=500)history.execute(new UpdateFurnitureCommand(f.id,{elevation:n}));}
  else if(field==='rotation')history.execute(new UpdateFurnitureCommand(f.id,{rotation:n*Math.PI/180}));
  else if(n>=5&&n<=1000)history.execute(new UpdateFurnitureCommand(f.id,{size:{...f.size,[field]:n}}));
}
function pickTab(t:typeof tab.value){tab.value=t;editor.workspace=t;emit('tool','select');}
</script>
<template>
  <aside class="scene-editor-panel">
    <div class="panel-heading"><strong>装修工作台</strong><span>cm</span></div>
    <div class="panel-tabs"><button v-for="t in ([['furniture','家具'],['utilities','水电'],['finish','材质']] as const)" :key="t[0]" :class="{active:tab===t[0]}" @click="pickTab(t[0])">{{t[1]}}</button></div>
    <div class="editing-controls">
      <label>网格精度 <select aria-label="网格精度" :value="step" @change="emit('step',+($event.target as HTMLSelectElement).value)"><option v-for="n in [1,5,10,20]" :key="n" :value="n">{{n}} cm</option></select></label>
      <div class="panel-actions"><button :disabled="!history.canUndo" @click="history.undo()">撤销</button><button :disabled="!history.canRedo" @click="history.redo()">重做</button><button @click="emit('tool','select')">三轴移动</button></div>
      <p class="notice">{{notice || '点击家具选中，拖动三轴箭头移动；或使用下方数值精确定位。'}}</p>
    </div>
    <template v-if="tab==='furniture'">
      <div class="editing-controls">
        <label>添加家具<select aria-label="添加家具类型" v-model="pending"><option v-for="(def,type) in FURNITURE_CATALOG" :key="type" :value="type">{{def.name}}</option></select></label>
        <button class="wide" @click="emit('add',pending)">添加到场景</button>
        <section v-if="furniture" class="furniture-props">
          <h3>{{FURNITURE_CATALOG[furniture.type].name}}</h3>
          <div class="property-grid">
            <label>X (cm)<input aria-label="家具X" type="number" :step="step" :value="Math.round(furniture.position.x)" @change="number('x',$event)" /></label>
            <label>Z (cm)<input aria-label="家具Z" type="number" :step="step" :value="Math.round(furniture.position.y)" @change="number('z',$event)" /></label>
            <label>底部离地<input aria-label="家具离地高度" type="number" min="0" max="500" :step="step" :value="furniture.elevation??0" @change="number('elevation',$event)" /></label>
            <label>旋转 (°)<input aria-label="家具旋转" type="number" step="15" :value="Math.round(furniture.rotation*180/Math.PI)" @change="number('rotation',$event)" /></label>
            <label v-for="field in (['width','depth','height'] as const)" :key="field">{{ {width:'宽',depth:'深',height:'高'}[field] }} (cm)<input type="number" min="5" max="1000" :value="furniture.size[field]" @change="number(field,$event)" /></label>
          </div>
          <button class="wide" :class="{active:tool==='mount'}" @click="emit('tool','mount')">贴墙安装：然后点击墙面</button>
          <div class="panel-actions"><button @click="history.execute(new DuplicateFurnitureCommand(furniture.id))">复制</button><button @click="history.execute(new RemoveFurnitureCommand(furniture.id));emit('select',null)">删除家具</button></div>
        </section>
        <h3>场景家具 · {{plan.furniture.length}}</h3>
        <button v-for="f in plan.furniture" :key="f.id" class="object-row" :class="{active:furniture?.id===f.id}" @click="emit('tool','select');emit('select',{kind:'furniture',id:f.id})">{{FURNITURE_CATALOG[f.type]?.name??f.type}}<small>{{f.elevation?`离地 ${f.elevation}cm`:'落地 / 默认'}}</small></button>
      </div>
    </template>
    <template v-else>
      <div v-if="tab==='utilities'" class="editing-controls">
        <p class="notice">点击墙面或地面布点；连续点击可沿墙水平、竖直布线。</p>
        <div class="panel-actions"><button @click="emit('tool','point','socket')">墙面插座</button><button @click="emit('tool','point','switch')">墙面开关</button></div>
        <div class="panel-actions"><button v-for="kind in (['electric','cold-water','hot-water','drain'] as const)" :key="kind" @click="emit('tool','route',kind)">{{{electric:'电路', 'cold-water':'冷水','hot-water':'热水',drain:'排水'}[kind]}}</button></div>
        <button class="wide" @click="emit('finish')">完成布线 (Enter)</button>
      </div>
      <RenovationPanel />
    </template>
  </aside>
</template>
<style scoped>
.scene-editor-panel{position:absolute;top:65px;right:12px;bottom:12px;width:285px;background:#fffffff5;color:#314852;border:1px solid #d7e2e5;border-radius:8px;overflow:auto;font-size:12px;box-shadow:0 6px 24px #233e4318}.panel-heading{padding:16px;display:flex;justify-content:space-between;font-size:15px}.panel-heading span{font-size:11px;color:#8b9aa0}.panel-tabs,.panel-actions{display:flex;gap:5px}.panel-tabs{padding:0 12px;border-bottom:1px solid #dde5e8}.panel-tabs button{padding:10px;flex:1}.active{background:#e5f3f1!important;color:#156971!important}.editing-controls{padding:12px 16px}.editing-controls label{display:grid;gap:5px;margin-bottom:8px}.editing-controls input,.editing-controls select{min-width:0;width:100%;border:1px solid #cbd8de;border-radius:4px;padding:6px;background:white}.panel-actions button,.wide{padding:8px;border:1px solid #cfdbdf;border-radius:4px;background:#fff}.wide{width:100%;margin:7px 0}.notice{color:#7c8b93;line-height:1.7;margin:10px 0}.property-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}h3{margin:14px 0 10px}.object-row{width:100%;text-align:left;padding:9px 6px;border-bottom:1px solid #e6ecee}.object-row small{float:right;color:#8d9ba2}.scene-editor-panel :deep(.renovation-panel){width:100%;border:0;background:transparent}.scene-editor-panel :deep(.renovation-panel .choices),.scene-editor-panel :deep(.renovation-panel>.muted:first-of-type){display:none}.scene-editor-panel :deep(.renovation-panel h3:nth-of-type(1)),.scene-editor-panel :deep(.renovation-panel h3:nth-of-type(2)){display:none}
</style>
