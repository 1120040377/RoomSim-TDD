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
import { MoveFurnitureCommand, MoveOpeningCommand } from '@/modules/commands';
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
  dimensions: Konva.Layer;
  openings: Konva.Layer;
  furniture: Konva.Layer;
  warnings: Konva.Layer;
  preview: Konva.Layer;
} | null = null;

let resizeObserver: ResizeObserver | null = null;

/** 门窗沿墙拖拽状态 */
let draggingOpening: {
  id: string;
  startNode: { x: number; y: number };
  endNode: { x: number; y: number };
  wallLenSq: number;
  wallLen: number;
  halfWidth: number;
  currentOffset: number;
} | null = null;

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
    viewScale: editorStore.viewport.scale,
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
  const selectedIds = new Set(
    editorStore.selection.filter((t) => t.kind === 'wall').map((t) => t.id),
  );
  for (const wall of Object.values(plan.walls)) {
    const s = plan.nodes[wall.startNodeId];
    const e = plan.nodes[wall.endNodeId];
    if (!s || !e) continue;
    const ss = worldToScreen(s.position);
    const ee = worldToScreen(e.position);
    const isSelected = selectedIds.has(wall.id);
    const visualWidth = Math.max(2, wall.thickness * editorStore.viewport.scale);
    const line = new Konva.Line({
      points: [ss.x, ss.y, ee.x, ee.y],
      stroke: isSelected ? '#3b82f6' : '#374151',
      strokeWidth: visualWidth + (isSelected ? 1 : 0),
      lineCap: 'round',
      hitStrokeWidth: Math.max(10, visualWidth),
    });
    line.on('click tap', (evt) => {
      if (editorStore.activeTool !== 'select') return;
      editorStore.select({ kind: 'wall', id: wall.id }, evt.evt.shiftKey);
    });
    layers.walls.add(line);
  }
  layers.walls.batchDraw();
}

function drawDimensions() {
  if (!layers) return;
  layers.dimensions.destroyChildren();

  const plan = planStore.plan;
  const vs = editorStore.viewport.scale;

  if (!editorStore.showDimensions || !plan || Object.keys(plan.nodes).length < 2) {
    layers.dimensions.batchDraw();
    return;
  }

  /** 屏幕像素常量（与缩放无关，视觉大小始终固定） */
  const OFFSET = 60;    // bbox 外侧偏移
  const TICK = 5;       // 刻度线半高
  const LABEL_GAP = 14; // 文字离尺寸线的距离
  const MERGE = 4;      // 合并阈值（px），小于此值的相邻刻度合并
  const MIN_SEG = 28;   // 最小段宽（px），短于此不标文字
  const FONT = 11;      // 字号（px）

  const allNodes = Object.values(plan.nodes);
  const sPos = allNodes.map((n) => worldToScreen(n.position));

  /** 排序并合并过于接近的坐标 */
  function dedupe(vals: number[]): number[] {
    const sorted = [...vals].sort((a, b) => a - b);
    const result = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - result[result.length - 1] > MERGE) result.push(sorted[i]);
    }
    return result;
  }

  /** 屏幕像素 → 米（保留两位小数） */
  function fmtPx(px: number): string {
    return `${(px / vs / 100).toFixed(2)} m`;
  }

  function addTextLabel(
    text: string,
    cx: number,
    cy: number,
    rotation: number,
  ) {
    const t = new Konva.Text({ text, fontSize: FONT, fill: '#374151', padding: 2 });
    const tw = t.width();
    const th = t.height();
    const bg = new Konva.Rect({
      x: cx - tw / 2 - 1,
      y: cy - th / 2 - 1,
      width: tw + 2,
      height: th + 2,
      fill: 'rgba(255,255,255,0.92)',
      cornerRadius: 2,
      listening: false,
    });
    if (rotation !== 0) {
      bg.rotation(rotation);
      // 旋转后以 (cx,cy) 为中心：原始中心偏移抵消旋转
      bg.offsetX(tw / 2 + 1);
      bg.offsetY(th / 2 + 1);
      bg.x(cx);
      bg.y(cy);
      t.rotation(rotation);
      t.offsetX(tw / 2);
      t.offsetY(th / 2);
      t.x(cx);
      t.y(cy);
    } else {
      bg.x(cx - tw / 2 - 1);
      bg.y(cy - th / 2 - 1);
      t.x(cx - tw / 2);
      t.y(cy - th / 2);
    }
    layers!.dimensions.add(bg);
    layers!.dimensions.add(t);
  }

  // ── 水平尺寸线（建筑上方） ──
  const xs = dedupe(sPos.map((p) => p.x));
  if (xs.length >= 2) {
    const bboxTop = Math.min(...sPos.map((p) => p.y));
    const dimY = bboxTop - OFFSET;

    layers.dimensions.add(
      new Konva.Line({
        points: [xs[0], dimY, xs[xs.length - 1], dimY],
        stroke: '#6b7280',
        strokeWidth: 1,
        listening: false,
      }),
    );

    for (const x of xs) {
      // 延伸线（虚线）
      layers.dimensions.add(
        new Konva.Line({
          points: [x, bboxTop - 4, x, dimY],
          stroke: '#d1d5db',
          strokeWidth: 1,
          dash: [3, 3],
          listening: false,
        }),
      );
      // 刻度线
      layers.dimensions.add(
        new Konva.Line({
          points: [x, dimY - TICK, x, dimY + TICK],
          stroke: '#6b7280',
          strokeWidth: 1.5,
          listening: false,
        }),
      );
    }

    for (let i = 0; i < xs.length - 1; i++) {
      const segPx = xs[i + 1] - xs[i];
      if (segPx < MIN_SEG) continue;
      addTextLabel(
        fmtPx(segPx),
        (xs[i] + xs[i + 1]) / 2,
        dimY - LABEL_GAP,
        0,
      );
    }
  }

  // ── 垂直尺寸线（建筑左侧） ──
  const ys = dedupe(sPos.map((p) => p.y));
  if (ys.length >= 2) {
    const bboxLeft = Math.min(...sPos.map((p) => p.x));
    const dimX = bboxLeft - OFFSET;

    layers.dimensions.add(
      new Konva.Line({
        points: [dimX, ys[0], dimX, ys[ys.length - 1]],
        stroke: '#6b7280',
        strokeWidth: 1,
        listening: false,
      }),
    );

    for (const y of ys) {
      layers.dimensions.add(
        new Konva.Line({
          points: [bboxLeft - 4, y, dimX, y],
          stroke: '#d1d5db',
          strokeWidth: 1,
          dash: [3, 3],
          listening: false,
        }),
      );
      layers.dimensions.add(
        new Konva.Line({
          points: [dimX - TICK, y, dimX + TICK, y],
          stroke: '#6b7280',
          strokeWidth: 1.5,
          listening: false,
        }),
      );
    }

    for (let i = 0; i < ys.length - 1; i++) {
      const segPx = ys[i + 1] - ys[i];
      if (segPx < MIN_SEG) continue;
      addTextLabel(
        fmtPx(segPx),
        dimX - LABEL_GAP,
        (ys[i] + ys[i + 1]) / 2,
        -90,
      );
    }
  }

  layers.dimensions.batchDraw();
}

function drawOpenings() {
  if (!layers) return;
  layers.openings.destroyChildren();
  const plan = planStore.plan;
  if (!plan) return;
  const selectedIds = new Set(
    editorStore.selection.filter((t) => t.kind === 'opening').map((t) => t.id),
  );
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
    const isSelected = selectedIds.has(op.id);
    const baseColor = op.kind === 'door' ? '#f59e0b' : '#0ea5e9';
    const line = new Konva.Line({
      points: [ls.x, ls.y, rs.x, rs.y],
      stroke: isSelected ? '#3b82f6' : baseColor,
      strokeWidth: isSelected ? 6 : 4,
      lineCap: 'square',
      hitStrokeWidth: 12,
    });
    line.on('click tap', (evt) => {
      if (editorStore.activeTool !== 'select') return;
      editorStore.select({ kind: 'opening', id: op.id }, evt.evt.shiftKey);
      evt.cancelBubble = true;
    });
    line.on('pointerdown', (evt) => {
      if (editorStore.activeTool !== 'select' || evt.evt.button !== 0) return;
      editorStore.select({ kind: 'opening', id: op.id }, false);
      draggingOpening = {
        id: op.id,
        startNode: sNode.position,
        endNode: eNode.position,
        wallLenSq: len * len,
        wallLen: len,
        halfWidth: op.width / 2,
        currentOffset: op.offset,
      };
      evt.cancelBubble = true;
    });
    layers.openings.add(line);
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
  drawDimensions();
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
    if (draggingOpening) return; // 由 window pointermove 统一处理
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
    if (panning) {
      editorStore.setViewport({
        offset: {
          x: offsetStart.x + (e.clientX - panStart.x),
          y: offsetStart.y + (e.clientY - panStart.y),
        },
      });
      return;
    }
    if (draggingOpening) {
      const containerEl = containerRef.value;
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      const world = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      const { startNode, endNode, wallLenSq, wallLen, halfWidth, id } = draggingOpening;
      const ddx = endNode.x - startNode.x;
      const ddy = endNode.y - startNode.y;
      const wx = world.x - startNode.x;
      const wy = world.y - startNode.y;
      const t = (wx * ddx + wy * ddy) / wallLenSq;
      const rawOffset = t * wallLen;
      const newOffset = Math.max(halfWidth, Math.min(wallLen - halfWidth, rawOffset));
      if (Math.abs(newOffset - draggingOpening.currentOffset) > 0.5) {
        historyStore.execute(new MoveOpeningCommand(id, draggingOpening.currentOffset, newOffset));
        draggingOpening.currentOffset = newOffset;
      }
    }
  };
  const onUp = () => {
    panning = false;
    draggingOpening = null;
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
    () => {
      drawWalls();
      drawOpenings();
      drawFurniture();
    },
    { deep: true },
  );
  watch(
    () => editorStore.showErgonomics,
    () => drawWarnings(),
  );
  watch(
    () => editorStore.showDimensions,
    () => drawDimensions(),
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
    dimensions: new Konva.Layer(),
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
