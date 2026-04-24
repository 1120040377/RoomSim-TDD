<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Konva from 'konva';
import { usePlanStore } from '@/modules/store/plan';
import { useEditorStore } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';
import { TOOLS } from './tools';
import type { ToolContext } from './tools';
import { findSnap } from '@/modules/geometry/snap';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';
import { MoveFurnitureCommand } from '@/modules/commands';
import { createDefaultEngine, type Warning } from '@/modules/ergonomics';
import { debounce } from 'lodash-es';

const containerRef = ref<HTMLDivElement>();
const planStore = usePlanStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();

const ergEngine = createDefaultEngine();
const warnings = ref<Warning[]>([]);

let stage: Konva.Stage | null = null;
let layers: {
  background: Konva.Layer;
  rooms: Konva.Layer;
  walls: Konva.Layer;
  openings: Konva.Layer;
  furniture: Konva.Layer;
  warnings: Konva.Layer;
  preview: Konva.Layer;
} | null = null;

let resizeObserver: ResizeObserver | null = null;

function worldToScreen(p: { x: number; y: number }) {
  const v = editorStore.viewport;
  return { x: p.x * v.scale + v.offset.x, y: p.y * v.scale + v.offset.y };
}

function screenToWorld(p: { x: number; y: number }) {
  const v = editorStore.viewport;
  return { x: (p.x - v.offset.x) / v.scale, y: (p.y - v.offset.y) / v.scale };
}

function buildCtx(evt: PointerEvent): ToolContext | null {
  const s = stage;
  const plan = planStore.plan;
  if (!s || !plan || !layers) return null;
  const pos = s.getPointerPosition() ?? { x: 0, y: 0 };
  const world = screenToWorld(pos);
  const snap = editorStore.snapEnabled ? findSnap(world, plan, editorStore.viewport.scale) : null;
  return {
    stage: s,
    worldPoint: world,
    snap,
    modifiers: { shift: evt.shiftKey, ctrl: evt.ctrlKey, alt: evt.altKey },
    previewLayer: layers.preview,
    requestPreviewRedraw: () => {
      const ctx = buildCtx(evt);
      if (ctx) redrawPreview(ctx);
    },
  };
}

function redrawPreview(ctx: ToolContext) {
  layers!.preview.destroyChildren();
  const tool = TOOLS[editorStore.activeTool];
  tool.renderPreview?.(ctx);
  layers!.preview.batchDraw();
}

/** 把 preview 图层的变换同步到 viewport，这样工具内部可以直接用 world 坐标画图形。*/
function syncPreviewTransform() {
  if (!layers) return;
  const v = editorStore.viewport;
  layers.preview.scale({ x: v.scale, y: v.scale });
  layers.preview.position({ x: v.offset.x, y: v.offset.y });
}

/* ------------------------ 绘图 ------------------------ */

function drawBackground() {
  if (!stage || !layers) return;
  layers.background.destroyChildren();
  if (!editorStore.showGrid || !planStore.plan) {
    layers.background.batchDraw();
    return;
  }
  const grid = planStore.plan.meta.gridSize;
  const scale = editorStore.viewport.scale;
  const w = stage.width();
  const h = stage.height();
  const { offset } = editorStore.viewport;

  // 自适应网格步长：屏幕上 < 8px 的格线不画
  let step = grid;
  while (step * scale < 8) step *= 5;

  const startWorldX = Math.floor(-offset.x / scale / step) * step;
  const endWorldX = Math.ceil((w - offset.x) / scale / step) * step;
  const startWorldY = Math.floor(-offset.y / scale / step) * step;
  const endWorldY = Math.ceil((h - offset.y) / scale / step) * step;

  for (let x = startWorldX; x <= endWorldX; x += step) {
    const s = worldToScreen({ x, y: 0 });
    layers.background.add(
      new Konva.Line({
        points: [s.x, 0, s.x, h],
        stroke: x === 0 ? '#9ca3af' : '#e5e7eb',
        strokeWidth: 1,
        listening: false,
      }),
    );
  }
  for (let y = startWorldY; y <= endWorldY; y += step) {
    const s = worldToScreen({ x: 0, y });
    layers.background.add(
      new Konva.Line({
        points: [0, s.y, w, s.y],
        stroke: y === 0 ? '#9ca3af' : '#e5e7eb',
        strokeWidth: 1,
        listening: false,
      }),
    );
  }
  layers.background.batchDraw();
}

function drawRooms() {
  if (!layers) return;
  layers.rooms.destroyChildren();
  const plan = planStore.plan;
  if (!plan) return;
  for (const room of Object.values(plan.rooms)) {
    const pts = room.polygon.flatMap((p) => {
      const s = worldToScreen(p);
      return [s.x, s.y];
    });
    layers.rooms.add(
      new Konva.Line({
        points: pts,
        closed: true,
        fill: 'rgba(59, 130, 246, 0.08)',
        listening: false,
      }),
    );
    const centroid = room.polygon.reduce(
      (acc, p) => ({ x: acc.x + p.x / room.polygon.length, y: acc.y + p.y / room.polygon.length }),
      { x: 0, y: 0 },
    );
    const c = worldToScreen(centroid);
    layers.rooms.add(
      new Konva.Text({
        x: c.x - 40,
        y: c.y - 10,
        text: `${room.name}\n${room.area.toFixed(1)}㎡`,
        fontSize: 12,
        fill: '#6b7280',
        align: 'center',
        width: 80,
        listening: false,
      }),
    );
  }
  layers.rooms.batchDraw();
}

function drawWalls() {
  if (!layers) return;
  layers.walls.destroyChildren();
  const plan = planStore.plan;
  if (!plan) return;
  for (const wall of Object.values(plan.walls)) {
    const s = plan.nodes[wall.startNodeId];
    const e = plan.nodes[wall.endNodeId];
    if (!s || !e) continue;
    const ss = worldToScreen(s.position);
    const ee = worldToScreen(e.position);
    layers.walls.add(
      new Konva.Line({
        points: [ss.x, ss.y, ee.x, ee.y],
        stroke: '#374151',
        strokeWidth: Math.max(2, wall.thickness * editorStore.viewport.scale),
        lineCap: 'round',
      }),
    );
  }
  layers.walls.batchDraw();
}

function drawOpenings() {
  if (!layers) return;
  layers.openings.destroyChildren();
  const plan = planStore.plan;
  if (!plan) return;
  for (const op of Object.values(plan.openings)) {
    const wall = plan.walls[op.wallId];
    if (!wall) continue;
    const sNode = plan.nodes[wall.startNodeId];
    const eNode = plan.nodes[wall.endNodeId];
    if (!sNode || !eNode) continue;
    const dx = eNode.position.x - sNode.position.x;
    const dy = eNode.position.y - sNode.position.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const ux = dx / len;
    const uy = dy / len;
    const center = {
      x: sNode.position.x + ux * op.offset,
      y: sNode.position.y + uy * op.offset,
    };
    const left = { x: center.x - (ux * op.width) / 2, y: center.y - (uy * op.width) / 2 };
    const right = { x: center.x + (ux * op.width) / 2, y: center.y + (uy * op.width) / 2 };
    const ls = worldToScreen(left);
    const rs = worldToScreen(right);
    const color = op.kind === 'door' ? '#f59e0b' : '#0ea5e9';
    layers.openings.add(
      new Konva.Line({
        points: [ls.x, ls.y, rs.x, rs.y],
        stroke: color,
        strokeWidth: 4,
        lineCap: 'square',
      }),
    );
  }
  layers.openings.batchDraw();
}

function drawFurniture() {
  if (!layers || !stage) return;
  layers.furniture.destroyChildren();
  const plan = planStore.plan;
  if (!plan) return;

  const selectedIds = new Set(
    editorStore.selection.filter((t) => t.kind === 'furniture').map((t) => t.id),
  );

  for (const f of Object.values(plan.furniture)) {
    const def = FURNITURE_CATALOG[f.type];
    const screenP = worldToScreen(f.position);
    const isSelected = selectedIds.has(f.id);
    const g = new Konva.Group({
      x: screenP.x,
      y: screenP.y,
      rotation: (f.rotation * 180) / Math.PI,
      draggable: editorStore.activeTool === 'select',
    });
    const w = f.size.width * editorStore.viewport.scale;
    const d = f.size.depth * editorStore.viewport.scale;
    g.add(
      new Konva.Rect({
        x: -w / 2,
        y: -d / 2,
        width: w,
        height: d,
        fill: f.color ?? '#d4d4d8',
        stroke: isSelected ? '#3b82f6' : '#52525b',
        strokeWidth: isSelected ? 2.5 : 1,
        cornerRadius: 2,
      }),
    );
    g.add(
      new Konva.Text({
        x: -w / 2,
        y: -d / 2,
        width: w,
        height: d,
        text: def?.name ?? f.type,
        fontSize: Math.max(10, Math.min(16, w / 8)),
        fill: '#1f2937',
        align: 'center',
        verticalAlign: 'middle',
      }),
    );
    const originalPos = { ...f.position };
    g.on('dragend', () => {
      const screenPos = { x: g.x(), y: g.y() };
      const world = screenToWorld(screenPos);
      historyStore.execute(new MoveFurnitureCommand(f.id, originalPos, world));
    });
    // 只在无拖拽发生时 select（click/tap 事件在 drag 过程中不触发，这样
    // 不会在拖拽开始时打断 Konva 的 drag session）
    g.on('click tap', (evt) => {
      if (editorStore.activeTool !== 'select') return;
      editorStore.select({ kind: 'furniture', id: f.id }, evt.evt.shiftKey);
    });
    layers.furniture.add(g);
  }
  layers.furniture.batchDraw();
}

function drawWarnings() {
  if (!layers) return;
  layers.warnings.destroyChildren();
  if (!editorStore.showErgonomics) {
    layers.warnings.batchDraw();
    return;
  }
  for (const w of warnings.value) {
    const s = worldToScreen(w.position);
    const color = w.severity === 'error' ? '#dc2626' : '#f59e0b';
    const group = new Konva.Group({ x: s.x, y: s.y });
    group.add(
      new Konva.Circle({
        radius: 10,
        fill: color,
        stroke: 'white',
        strokeWidth: 2,
        opacity: 0.9,
      }),
    );
    group.add(
      new Konva.Text({
        x: -10,
        y: -7,
        width: 20,
        text: '!',
        align: 'center',
        fontSize: 14,
        fontStyle: 'bold',
        fill: 'white',
      }),
    );
    const label = new Konva.Label({ x: 12, y: -10, visible: false });
    label.add(
      new Konva.Tag({
        fill: 'rgba(0,0,0,0.85)',
        cornerRadius: 3,
        pointerDirection: 'left',
        pointerWidth: 6,
        pointerHeight: 6,
      }),
    );
    label.add(
      new Konva.Text({
        text: w.message,
        fontSize: 12,
        padding: 6,
        fill: '#fff',
      }),
    );
    group.add(label);
    group.on('mouseenter', () => {
      label.visible(true);
      layers!.warnings.batchDraw();
    });
    group.on('mouseleave', () => {
      label.visible(false);
      layers!.warnings.batchDraw();
    });
    layers.warnings.add(group);
  }
  layers.warnings.batchDraw();
}

const recomputeWarnings = debounce(() => {
  if (!planStore.plan) return;
  warnings.value = ergEngine.run(planStore.plan);
  drawWarnings();
}, 200);

function drawAll() {
  drawBackground();
  drawRooms();
  drawWalls();
  drawOpenings();
  drawFurniture();
  drawWarnings();
}

/* ------------------------ 交互 ------------------------ */

function setupEvents() {
  if (!stage) return;

  stage.on('pointerdown', (e) => {
    const ctx = buildCtx(e.evt);
    if (!ctx) return;
    // 点到了 shape（家具等）时不走工具，交给 shape 自己的事件处理（select/drag）；
    // 仅点击空白（stage 本身）才触发工具的 pointerdown，例如 SelectTool 清空选中。
    if (editorStore.activeTool === 'select' && e.target !== stage) return;
    TOOLS[editorStore.activeTool].onPointerDown?.(e.evt, ctx);
  });
  stage.on('pointermove', (e) => {
    const ctx = buildCtx(e.evt);
    if (!ctx) return;
    TOOLS[editorStore.activeTool].onPointerMove?.(e.evt, ctx);
    redrawPreview(ctx);
  });
  stage.on('pointerup', (e) => {
    const ctx = buildCtx(e.evt);
    if (!ctx) return;
    TOOLS[editorStore.activeTool].onPointerUp?.(e.evt, ctx);
  });

  // 滚轮缩放
  stage.on('wheel', (e) => {
    e.evt.preventDefault();
    const v = editorStore.viewport;
    const pos = stage!.getPointerPosition();
    if (!pos) return;
    const scaleBy = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.max(0.05, Math.min(10, v.scale * scaleBy));
    // 保持指针所指世界点不动
    const world = screenToWorld(pos);
    const newOffset = {
      x: pos.x - world.x * newScale,
      y: pos.y - world.y * newScale,
    };
    editorStore.setViewport({ scale: newScale, offset: newOffset });
  });

  // 中键/空格拖动平移
  let panning = false;
  let panStart = { x: 0, y: 0 };
  let offsetStart = { x: 0, y: 0 };
  stage.on('pointerdown', (e) => {
    if (e.evt.button === 1 || e.evt.button === 2) {
      panning = true;
      panStart = { x: e.evt.clientX, y: e.evt.clientY };
      offsetStart = { ...editorStore.viewport.offset };
      e.evt.preventDefault();
    }
  });
  const onMove = (e: PointerEvent) => {
    if (!panning) return;
    editorStore.setViewport({
      offset: {
        x: offsetStart.x + (e.clientX - panStart.x),
        y: offsetStart.y + (e.clientY - panStart.y),
      },
    });
  };
  const onUp = () => {
    panning = false;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  containerRef.value?.addEventListener('contextmenu', (e) => e.preventDefault());
}

function setupWatchers() {
  watch(
    () => planStore.plan,
    () => {
      drawAll();
      recomputeWarnings();
    },
    { deep: false },
  );
  watch(
    () => editorStore.viewport,
    () => {
      syncPreviewTransform();
      drawAll();
    },
    { deep: true },
  );
  watch(
    () => editorStore.activeTool,
    () => drawFurniture(),
  );
  watch(
    () => editorStore.selection,
    () => drawFurniture(),
    { deep: true },
  );
  watch(
    () => editorStore.showErgonomics,
    () => drawWarnings(),
  );
}

onMounted(() => {
  stage = new Konva.Stage({
    container: containerRef.value!,
    width: containerRef.value!.clientWidth,
    height: containerRef.value!.clientHeight,
  });
  layers = {
    background: new Konva.Layer(),
    rooms: new Konva.Layer(),
    walls: new Konva.Layer(),
    openings: new Konva.Layer(),
    furniture: new Konva.Layer(),
    warnings: new Konva.Layer(),
    preview: new Konva.Layer(),
  };
  Object.values(layers).forEach((l) => stage!.add(l));
  setupEvents();
  setupWatchers();
  syncPreviewTransform();
  drawAll();
  recomputeWarnings();

  resizeObserver = new ResizeObserver(() => {
    if (!stage || !containerRef.value) return;
    stage.width(containerRef.value.clientWidth);
    stage.height(containerRef.value.clientHeight);
    drawAll();
  });
  resizeObserver.observe(containerRef.value!);

  // 居中初始视图
  const p = planStore.plan;
  if (p && Object.keys(p.nodes).length > 0) {
    const xs = Object.values(p.nodes).map((n) => n.position.x);
    const ys = Object.values(p.nodes).map((n) => n.position.y);
    const bbox = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
    const bw = bbox.maxX - bbox.minX || 400;
    const bh = bbox.maxY - bbox.minY || 300;
    const pad = 80;
    const scale = Math.min(
      (stage.width() - pad * 2) / bw,
      (stage.height() - pad * 2) / bh,
    );
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    editorStore.setViewport({
      scale,
      offset: { x: stage.width() / 2 - cx * scale, y: stage.height() / 2 - cy * scale },
    });
  } else {
    editorStore.setViewport({ scale: 1, offset: { x: stage.width() / 2, y: stage.height() / 2 } });
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stage?.destroy();
  stage = null;
  layers = null;
});
</script>

<template>
  <div ref="containerRef" class="editor-canvas" />
</template>

<style scoped>
.editor-canvas {
  position: absolute;
  inset: 0;
  background: #fafafa;
  overflow: hidden;
  user-select: none;
  touch-action: none;
}
</style>
