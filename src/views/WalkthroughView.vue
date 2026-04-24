<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  type PointLight,
  Scene,
  WebGLRenderer,
  type Group,
} from 'three';
import { usePlanStore } from '@/modules/store/plan';
import { planRepo } from '@/modules/storage/plan-repo';
import { buildWalls } from '@/modules/walkthrough/builders/wall-builder';
import { buildFloor } from '@/modules/walkthrough/builders/floor-builder';
import { buildFurniture } from '@/modules/walkthrough/builders/furniture-builder';
import { buildOpenings } from '@/modules/walkthrough/builders/opening-builder';
import { buildRoomLights, toggleLight } from '@/modules/walkthrough/lights';
import { buildCollider } from '@/modules/walkthrough/collision-builder';
import { DesktopFPS } from '@/modules/walkthrough/controls/DesktopFPS';
import { getSpawnPoint } from '@/modules/walkthrough/spawn';
import { CM_TO_M } from '@/modules/walkthrough/coord';
import { InteractionRaycaster, toggleDoor, type InteractableInfo } from '@/modules/walkthrough/interaction';

const props = defineProps<{ id: string }>();
const router = useRouter();
const planStore = usePlanStore();

const canvasRef = ref<HTMLCanvasElement>();
const errorMsg = ref<string | null>(null);
const pointerLocked = ref(false);
const personHeight = ref(170);
const interactHint = ref<string | null>(null);

let renderer: WebGLRenderer | null = null;
let scene: Scene | null = null;
let camera: PerspectiveCamera | null = null;
let controller: DesktopFPS | null = null;
let raycaster: InteractionRaycaster | null = null;
let doorPivots: Record<string, Group> = {};
let lightsByFurnitureId: Record<string, PointLight> = {};
let allLights: PointLight[] = [];
let rafId = 0;
let lastT = 0;

const fpsCounter = shallowRef(0);
let frames = 0;
let fpsTimer = 0;
let pickTimer = 0;

onMounted(async () => {
  let plan = planStore.plan;
  if (!plan || plan.id !== props.id) {
    plan = await planRepo.get(props.id);
    if (!plan) {
      router.push('/');
      return;
    }
    planStore.loadPlan(plan);
  }

  try {
    initScene();
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '3D 初始化失败';
    return;
  }

  window.addEventListener('resize', onResize);
  document.addEventListener('pointerlockchange', onLockChange);
  window.addEventListener('keydown', onKeyDown);

  rafId = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  controller?.dispose();
  renderer?.dispose();
  renderer?.forceContextLoss?.();
  window.removeEventListener('resize', onResize);
  document.removeEventListener('pointerlockchange', onLockChange);
  window.removeEventListener('keydown', onKeyDown);
});

function initScene() {
  const plan = planStore.plan!;
  personHeight.value = plan.walkthrough.personHeight;

  scene = new Scene();
  scene.background = new Color(0xcfd8dc);

  const container = canvasRef.value!.parentElement!;
  const w = container.clientWidth;
  const h = container.clientHeight;

  camera = new PerspectiveCamera(70, w / h, 0.02, 200);
  const spawn = getSpawnPoint(plan);
  camera.position.set(
    spawn.x * CM_TO_M,
    personHeight.value * 0.94 * CM_TO_M,
    spawn.y * CM_TO_M,
  );

  renderer = new WebGLRenderer({ canvas: canvasRef.value!, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);

  // 环境光 + 平行光
  scene.add(new AmbientLight(0xffffff, 0.55));
  const dl = new DirectionalLight(0xffffff, 0.9);
  dl.position.set(3, 6, 3);
  scene.add(dl);

  scene.add(buildFloor(plan));
  scene.add(buildWalls(plan).group);
  const openings = buildOpenings(plan);
  scene.add(openings.group);
  doorPivots = openings.doorPivots;

  scene.add(buildFurniture(plan));

  const rl = buildRoomLights(plan);
  scene.add(rl.group);
  lightsByFurnitureId = rl.lightsByFurnitureId;
  allLights = Object.values(lightsByFurnitureId);

  const obstacles = buildCollider(plan);
  controller = new DesktopFPS(camera, obstacles, canvasRef.value!, personHeight.value);
  controller.attach();

  raycaster = new InteractionRaycaster(camera, scene);
}

function tick(t: number) {
  rafId = requestAnimationFrame(tick);
  if (!renderer || !scene || !camera || !controller) return;
  const dt = lastT === 0 ? 0 : (t - lastT) / 1000;
  lastT = t;

  controller.update(Math.min(dt, 0.1));

  // 3 Hz 刷新交互提示
  pickTimer += dt;
  if (pickTimer > 0.1 && raycaster) {
    const info = raycaster.pick();
    interactHint.value = info?.hint ?? null;
    pickTimer = 0;
  }

  renderer.render(scene, camera);

  frames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsCounter.value = Math.round(frames / fpsTimer);
    frames = 0;
    fpsTimer = 0;
  }
}

function interact() {
  if (!raycaster) return;
  const info = raycaster.pick();
  if (!info) return;
  doInteract(info);
}

function doInteract(info: InteractableInfo) {
  if (info.kind === 'door') {
    const pivot = doorPivots[info.targetId];
    if (!pivot) return;
    const cur = (pivot.userData.state as number) ?? 0;
    const next = cur > 0.5 ? 0 : 1;
    const sign = (pivot.userData.panelDirSign as 1 | -1) ?? 1;
    toggleDoor(pivot, next as 0 | 1, sign);
    return;
  }
  if (info.kind === 'light') {
    const l = lightsByFurnitureId[info.targetId];
    if (l) toggleLight(l);
    return;
  }
  if (info.kind === 'switch') {
    // 开关切换房间内所有灯
    if (allLights.length === 0) return;
    const anyOn = allLights.some((l) => l.intensity > 0);
    for (const l of allLights) l.intensity = anyOn ? 0 : 1.0;
    return;
  }
  if (info.kind === 'tv') {
    // 占位：切换家具颜色示意播放/暂停
    // TODO: P1 用 VideoTexture 实现
  }
}

function onResize() {
  if (!canvasRef.value || !renderer || !camera) return;
  const container = canvasRef.value.parentElement!;
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function onLockChange() {
  pointerLocked.value = document.pointerLockElement === canvasRef.value;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    goBack();
    return;
  }
  if (e.key === 'e' || e.key === 'E') {
    interact();
  }
}

function goBack() {
  router.push({ name: 'editor', params: { id: props.id } });
}

function changeHeight(delta: number) {
  personHeight.value = Math.max(140, Math.min(200, personHeight.value + delta));
  if (controller && camera) {
    (controller as unknown as { personHeightCm: number }).personHeightCm = personHeight.value;
    camera.position.y = personHeight.value * 0.94 * CM_TO_M;
  }
  if (planStore.plan) planStore.plan.walkthrough.personHeight = personHeight.value;
}
</script>

<template>
  <div class="h-full relative bg-black text-white overflow-hidden">
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" />

    <div
      v-if="!pointerLocked"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div class="bg-black/60 px-6 py-3 rounded text-sm">
        点击画面进入第一人称控制 · WASD 移动 · Shift 跑 · E 交互 · Esc 退出
      </div>
    </div>

    <div
      v-if="pointerLocked"
      class="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 pointer-events-none"
    />

    <div
      v-if="pointerLocked && interactHint"
      class="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 rounded text-sm pointer-events-none"
    >
      {{ interactHint }}
    </div>

    <div class="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
      <button
        class="px-3 py-1 bg-white/10 rounded text-sm hover:bg-white/20"
        @click="goBack"
      >
        ← 返回编辑器
      </button>
      <div class="flex items-center gap-2 text-xs">
        <button class="px-2 py-1 bg-white/10 rounded hover:bg-white/20" @click="changeHeight(-5)">−</button>
        <span>身高 {{ personHeight }}cm</span>
        <button class="px-2 py-1 bg-white/10 rounded hover:bg-white/20" @click="changeHeight(5)">+</button>
        <span class="ml-4 text-gray-400">{{ fpsCounter }} fps</span>
      </div>
    </div>

    <div
      v-if="errorMsg"
      class="absolute inset-0 flex items-center justify-center bg-black/70 text-red-300"
    >
      {{ errorMsg }}
    </div>
  </div>
</template>
