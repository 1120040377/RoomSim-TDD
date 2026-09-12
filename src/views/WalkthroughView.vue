<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  HemisphereLight,
  ACESFilmicToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  Box3,
  Vector3,
  Mesh,
  InstancedMesh,
  MeshStandardMaterial,
  Texture,
  Plane,
  Raycaster,
  type Material,
  Color,
  DirectionalLight,
  PMREMGenerator,
  type WebGLRenderTarget,
  PerspectiveCamera,
  type PointLight,
  Scene,
  WebGLRenderer,
  type Group,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { InteriorOutputPass } from '@/modules/walkthrough/interior-output';
import { InteriorOcclusionPass } from '@/modules/walkthrough/interior-occlusion';
import { ShadowCache } from '@/modules/walkthrough/shadow-cache';
import { FrameCache } from '@/modules/walkthrough/frame-cache';
import { prepareRender, preparationBatches, prepareRenderBatch } from '@/modules/walkthrough/prepare-render';
import {compileMaterialBatch} from '@/modules/walkthrough/compile-material-batch';
import {waitForShaderPrograms} from '@/modules/walkthrough/shader-readiness';
import {createExteriorBackdrop} from '@/modules/walkthrough/exterior-backdrop';
import { inspectionOffset, setInspectionLens } from '@/modules/walkthrough/inspection-lens';
import { fitSunShadow } from '@/modules/walkthrough/fit-sun-shadow';
import { GpuFrameTimer } from '@/modules/walkthrough/gpu-frame-timer';
import { CUTAWAY_HEIGHT, InspectionCutaway } from '@/modules/walkthrough/inspection-cutaway';
import {updateWallDecorationCutaway} from '@/modules/walkthrough/wall-decoration-cutaway';
import {installReceiverPlaneShadow} from '@/modules/walkthrough/receiver-plane-shadow';
import {renderPixelRatio,type RenderResolution} from '@/modules/walkthrough/render-resolution';
import {graphicsDiagnostics,type GraphicsDiagnostics} from '@/modules/walkthrough/graphics-diagnostics';
import { reconcileFurniture } from '@/modules/walkthrough/reconcile-furniture';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';
import { DAYLIGHT_LOOK, NIGHT_LOOK } from '@/modules/walkthrough/lighting-look';
import type { VerticalWallCaps } from '@/modules/walkthrough/vertical-wall-caps';
import { buildUtilities } from '@/modules/walkthrough/builders/utility-builder';
import { connectWaterNetwork,isWater } from '@/modules/renovation/water-network';
import { utilityMatches,type UtilityFilter } from '@/modules/renovation/visibility';
import { UTILITY_CATALOG } from '@/modules/renovation/model';
import { RenovationCommand } from '@/modules/commands/renovation';
import { ThirdPerson } from '@/modules/walkthrough/controls/ThirdPerson';
import { usePlanStore } from '@/modules/store/plan';
import { planRepo, setupAutoSave } from '@/modules/storage/plan-repo';
import { useEditorStore } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';
import type { FurnitureType, SelectionTarget, UtilityKind } from '@/modules/model/types';
import { AddFurnitureCommand } from '@/modules/commands/furniture/add';
import { SceneEditor, type SceneEditTool } from '@/modules/editor/scene-edit';
import SceneEditorPanel from '@/components/SceneEditorPanel.vue';
import { animateStorage } from '@/modules/walkthrough/builders/furniture/storage';
import { nearbyFurniture, useObject, type LifeTarget } from '@/modules/walkthrough/life';
import { animateWater } from '@/modules/walkthrough/water-effect';
import { runtimeColliders } from '@/modules/walkthrough/runtime-colliders';
import { AIM_SCREEN_Y, pickAimedObject } from '@/modules/walkthrough/aim';
import { TargetHighlight } from '@/modules/walkthrough/target-highlight';
import type { AvatarKind } from '@/modules/walkthrough/builders/stylized-avatar';
import { buildWalls } from '@/modules/walkthrough/builders/wall-builder';
import { buildFloor } from '@/modules/walkthrough/builders/floor-builder';
import { buildFurniture } from '@/modules/walkthrough/builders/furniture-builder';
import { prepareArmchairModel, releaseArmchairModel } from '@/modules/walkthrough/builders/furniture/model-armchair';
import {prepareDrapedThrow,releaseDrapedThrow} from '@/modules/walkthrough/builders/furniture/model-throw';
import { needsUpholsteryAsset } from '@/modules/walkthrough/builders/furniture/upholstery-assets';
import { buildOpenings } from '@/modules/walkthrough/builders/opening-builder';
import { buildRoomLights, toggleLight, setLightEnabled } from '@/modules/walkthrough/lights';
import { buildCollider } from '@/modules/walkthrough/collision-builder';
import { DesktopFPS } from '@/modules/walkthrough/controls/DesktopFPS';
import { getSpawnPoint } from '@/modules/walkthrough/spawn';
import { CM_TO_M } from '@/modules/walkthrough/coord';
import { toggleDoor, type InteractableInfo } from '@/modules/walkthrough/interaction';
import { buildFirstPersonArms } from '@/modules/walkthrough/builders/arms-builder';

const props = defineProps<{ id: string }>();
const router = useRouter();
const planStore = usePlanStore();
const editorStore=useEditorStore(),historyStore=useHistoryStore();
const editSelection=ref<SelectionTarget|null>(null),editStep=ref(5),editTool=ref<SceneEditTool>('select'),editNotice=ref('');
const lifeStatus=ref('拖动鼠标环绕观察，将屏幕中心准星对准家具，走近后按 E 操作。');
const activeLifeTarget=ref<LifeTarget|null>(null);
const targetHighlight=new TargetHighlight();
let lifeTimer=0;
// Plan geometry changes only on plan updates; door/drawer colliders remain dynamic.
let staticObstacles: ReturnType<typeof buildCollider> = [];
let sceneEditor:SceneEditor|null=null,stopAutoSave:(()=>void)|null=null;
let floorGroup:Group|null=null,roomLightsGroup:Group|null=null;

const canvasRef = ref<HTMLCanvasElement>();
const errorMsg = ref<string | null>(null);
const pointerLocked = ref(false);
const pointerLockPending=ref(false);
const personHeight = ref(170);
const avatarKind=ref<AvatarKind>('adult');
const viewMode = ref<'orbit' | 'walk' | 'third' | 'edit'>('third');
const utilityVisible = ref(false);
const utilityFilter=ref<UtilityFilter>('all'),waterNotice=ref('');
const filteredUtilities=computed(()=>Object.values(planStore.plan?.renovation?.utilities??{}).filter(u=>utilityMatches(u.kind,utilityFilter.value)));
const sourceLabels=ref<Array<{id:string;text:string;x:number;y:number;anchorY:number;color:string}>>([]);
const cutaway = ref(true);
const night = ref(false);
const detailedShadows = ref(false);
const renderResolution=ref<RenderResolution>('balanced');
const graphicsPanel=ref(false);
const graphicsInfo=shallowRef<GraphicsDiagnostics|null>(null);
function refreshGraphicsInfo(){if(renderer)graphicsInfo.value=graphicsDiagnostics(renderer.getContext());}
function toggleGraphicsPanel(){graphicsPanel.value=!graphicsPanel.value;if(graphicsPanel.value)refreshGraphicsInfo();}
const floorBakeState=ref<'off'|'busy'|'ready'|'error'>('off');
let floorBake:import('@/modules/walkthrough/baking/floor-bake').FloorBake|null=null;
let floorBakeRevision=0;
function invalidateFloorBake(){floorBakeRevision++;floorBake?.invalidate();floorBakeState.value='off';}
async function toggleFloorBake(){
  if(floorBakeState.value==='busy'||floorBakeState.value==='ready'){invalidateFloorBake();return;}
  if(viewMode.value!=='orbit'||utilityVisible.value||!floorGroup||!wallGroup||!furnitureGroup)return;
  if(furnitureGroup.children.some(child=>(child.userData.mechanisms??[]).some((m:{value:number;target:number})=>m.value!==m.target)))return;
  const revision=++floorBakeRevision;floorBakeState.value='busy';
  try{
    const {FloorBake}=await import('@/modules/walkthrough/baking/floor-bake');
    if(viewDisposed||revision!==floorBakeRevision)return;
    floorBake??=new FloorBake();
    const box=new Box3().setFromObject(floorGroup);
    const ready=await floorBake.start([wallGroup,furnitureGroup,...(openingGroup?[openingGroup]:[])],floorGroup,
      {minX:box.min.x,minZ:box.min.z,width:box.max.x-box.min.x,depth:box.max.z-box.min.z},wallGroup);
    if(revision===floorBakeRevision)floorBakeState.value=ready?'ready':'off';
  }catch(error){if(revision===floorBakeRevision){floorBakeState.value='error';console.warn('Floor contact bake failed',error);}}
}
const profileEnabled = new URLSearchParams(location.search).has('profile');
const frameCache = new FrameCache();
let gpuTimer: GpuFrameTimer | null = null;
const frameProfile: Array<Record<string, number | string>> = [];
let orbit: OrbitControls | null = null;
let utilityGroup: Group | null = null;
let wallGroup: Group | null = null;
let verticalWallCaps:VerticalWallCaps|null=null;
let openingGroup: Group | null = null;
let sun: DirectionalLight | null = null;
let ambient: HemisphereLight | null = null;
let modelCenter = new Vector3();
let modelSize = 8;
let thirdPerson: ThirdPerson | null = null;
let furnitureGroup: Group | null = null;
const occlusionRay = new Raycaster();
const fadedMaterials = new Map<Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();

function restoreOcclusion() {
  for (const [material, previous] of fadedMaterials) {
    Object.assign(material, previous); material.needsUpdate = true;
  }
  fadedMaterials.clear();
}
function revealCharacter() {
  if (!thirdPerson || !camera || !scene) return;
  scene.updateMatrixWorld(true);
  const obstructing = new Set<Material>();
  const occluders = [wallGroup, openingGroup, furnitureGroup].filter((g): g is Group => !!g);
  const screenRight=new Vector3(1,0,0).applyQuaternion(camera.quaternion);
  for (const height of [0.08, personHeight.value * 0.005, personHeight.value * 0.009]) {
    for(const side of [-0.23,0,0.23]){
    const target = thirdPerson.avatar.group.position.clone().add(new Vector3(0, height, 0)).addScaledVector(screenRight,side*personHeight.value/170);
    const direction = target.sub(camera.position);
    occlusionRay.set(camera.position, direction.clone().normalize());
    occlusionRay.far = direction.length();
    for (const hit of occlusionRay.intersectObjects(occluders, true)) {
      if(!(hit.object instanceof Mesh))continue;
      const mesh = hit.object as Mesh;
      const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      for (const material of materials) {
        obstructing.add(material);
      }
    }
    }
  }
  // Only update render state when obstruction changes, avoiding shader churn every frame.
  for (const [material, previous] of fadedMaterials) if (!obstructing.has(material)) {
    Object.assign(material, previous); material.needsUpdate = true; fadedMaterials.delete(material);
  }
  for (const material of obstructing) if (!fadedMaterials.has(material)) {
    fadedMaterials.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
    material.transparent = true; material.opacity = 0.12; material.depthWrite = false; material.needsUpdate = true;
  }
}

let renderer: WebGLRenderer | null = null;
const shadowCache = new ShadowCache();
const inspectionCutaway = new InspectionCutaway();
let preserveInteriorBack = false;
let composer: EffectComposer | null = null;
let occlusionPass: InteriorOcclusionPass | null = null;
let outputPass: InteriorOutputPass | null = null;
let scene: Scene | null = null;
let exteriorBackdrop:ReturnType<typeof createExteriorBackdrop>|null=null;
let environmentTexture: Texture | null = null;
let environmentTarget: WebGLRenderTarget | null = null;
let environmentFrame = 0;
let releaseReceiverPlaneShadow:(()=>void)|null=null;
let camera: PerspectiveCamera | null = null;
let controller: DesktopFPS | null = null;
let doorPivots: Record<string, Group> = {};
let fpArms: Group | null = null;
let lightsByFurnitureId: Record<string, PointLight> = {};
let allLights: PointLight[] = [];
let rafId = 0;
let lastT = 0;

const fpsCounter = shallowRef(0);
const idleFrame = shallowRef(false);
const invalidateFrame = () => { frameCache.invalidate();preparedPaths.clear(); };
let frames = 0;
let fpsTimer = 0;

let viewDisposed=false;
const preparingMaterials=ref(false);
// Diagnostic opt-in only: a cold all-material draw can block for several seconds.
const preparationMode=new URLSearchParams(window.location.search).get('prepare');
const materialPreparationEnabled=['1','staged','async'].includes(preparationMode??'');
let preparationAbort:AbortController|null=null;
watch([viewMode,detailedShadows,cutaway],()=>preparationAbort?.abort());
const preparedPaths=new Set<string>();
let preparationFrame=0;
let preparationMs=0;
let preparationMaxSliceMs=0;
const preparationProgress=ref('');
function preparationKey():string {
  return `${viewMode.value}/${detailedShadows.value}/${cutaway.value}/${!!scene?.environment}`;
}
function schedulePreparation():void {
  if(!renderer||!scene||!camera||preparingMaterials.value)return;
  const key=preparationKey();
  preparingMaterials.value=true;
  preparationProgress.value='';
  const batches=preparationMode==='staged'||preparationMode==='async'?preparationBatches(scene):null;
  const abort=new AbortController();preparationAbort=abort;
  let batchIndex=0,started=0;
  preparationMaxSliceMs=0;
  const finish=()=>{
    abort.abort();if(preparationAbort===abort)preparationAbort=null;
    frameCache.invalidate();shadowCache.invalidate();
    preparingMaterials.value=false;lastT=0;
  };
  const step=async()=>{
    if(viewDisposed)return;
    if(key!==preparationKey()){finish();return;}
    if(!started)started=performance.now();
    try{
      if(preparationMode==='async'&&batches&&batchIndex<batches.length){
        const compileStart=performance.now();
        const programs=compileMaterialBatch(renderer!,scene!,camera!,batches[batchIndex],detailedShadows.value);
        preparationMaxSliceMs=Math.max(preparationMaxSliceMs,performance.now()-compileStart);
        const readiness=await waitForShaderPrograms(renderer!.getContext(),programs,abort.signal);
        if(viewDisposed)return;
        if(abort.signal.aborted||key!==preparationKey()){finish();return;}
        if(readiness!=='ready')throw new Error(`Shader preparation ${readiness}`);
      }
      const sliceStart=performance.now();
      if(batches){
        if(batchIndex<batches.length)prepareRenderBatch(renderer!,scene!,batches[batchIndex++],drawScene,(w,h)=>composer?.setSize(w,h));
        preparationProgress.value=`${batchIndex}/${batches.length}`;
      }else prepareRender(renderer!,scene!,drawScene,(w,h)=>composer?.setSize(w,h));
      preparationMaxSliceMs=Math.max(preparationMaxSliceMs,performance.now()-sliceStart);
      if(batches&&batchIndex<batches.length){preparationFrame=requestAnimationFrame(step);return;}
      preparationMs=performance.now()-started;preparedPaths.add(key);finish();
    }catch(error){
      preparedPaths.add(key);finish();
      console.warn('Material preparation failed; falling back to normal rendering',error);
    }
  };
  // Give Vue and the browser a paint opportunity before synchronous driver work.
  preparationFrame=requestAnimationFrame(()=>{
    preparationFrame=requestAnimationFrame(step);
  });
}
onMounted(async () => {
  let plan = planStore.plan;
  if (!plan || plan.id !== props.id) {
    plan = await planRepo.get(props.id);
    if(viewDisposed)return;
    if (!plan) {
      router.push('/');
      return;
    }
    planStore.loadPlan(plan);
  }

  try {
    const furniture=Object.values(plan.furniture);
    await Promise.all([
      needsUpholsteryAsset(furniture)?prepareArmchairModel(!furniture.some(f=>f.type==='armchair')):Promise.resolve(false),
      furniture.some(f=>f.type.startsWith('bed-')&&f.size.width===150&&f.size.depth===200&&f.size.height===45)?prepareDrapedThrow():Promise.resolve(false),
    ]);
    if(viewDisposed)return;
    initScene();
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '3D 初始化失败';
    return;
  }

  window.addEventListener('resize', onResize);
  document.addEventListener('pointerlockchange', onLockChange);
  window.addEventListener('keydown', onKeyDown);

  rafId = requestAnimationFrame(tick);
  stopAutoSave=setupAutoSave();
});

onBeforeUnmount(() => {
  viewDisposed=true;
  if(exteriorBackdrop){scene?.remove(exteriorBackdrop.mesh);exteriorBackdrop.dispose();exteriorBackdrop=null;}
  preparationAbort?.abort();preparationAbort=null;
  cancelAnimationFrame(preparationFrame);
  invalidateFloorBake();floorBake?.dispose();floorBake=null;
  targetHighlight.clear();
  stopAutoSave?.();sceneEditor?.dispose();
  cancelAnimationFrame(rafId);
  if (fpArms && camera) camera.remove(fpArms);
  fpArms = null;
  controller?.dispose();
  thirdPerson?.dispose();
  orbit?.dispose();
  const disposed = new Set<unknown>();
  scene?.traverse(object => {
    if (object instanceof InstancedMesh) object.dispose();
    const mesh = object as Mesh;
    if (mesh.geometry && !disposed.has(mesh.geometry)) { mesh.geometry.dispose(); disposed.add(mesh.geometry); }
    const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const material of materials) {
      if (disposed.has(material)) continue;
      for (const value of Object.values(material)) if (value instanceof Texture && !disposed.has(value)) {
        value.dispose(); disposed.add(value);
      }
      material.dispose(); disposed.add(material);
    }
  });
  releaseArmchairModel();
  releaseDrapedThrow();
  sun?.shadow.dispose();
  occlusionPass?.dispose();
  outputPass?.dispose();
  composer?.dispose();
  cancelAnimationFrame(environmentFrame);
  environmentTarget?.dispose();
  environmentTarget = null;
  environmentTexture = null;
  gpuTimer?.dispose();
  gpuTimer = null;
  renderer?.domElement.removeEventListener('webglcontextrestored',invalidateFrame);
  renderer?.dispose();
  releaseReceiverPlaneShadow?.();releaseReceiverPlaneShadow=null;
  renderer?.forceContextLoss?.();
  window.removeEventListener('resize', onResize);
  document.removeEventListener('pointerlockchange', onLockChange);
  window.removeEventListener('keydown', onKeyDown);
});

function initScene() {
  const plan = planStore.plan!;
  personHeight.value = plan.walkthrough.personHeight;

  scene = new Scene();
  scene.background = new Color(DAYLIGHT_LOOK.background);
  exteriorBackdrop=createExteriorBackdrop(()=>frameCache.invalidate());scene.add(exteriorBackdrop.mesh);

  const container = canvasRef.value!.parentElement!;
  const w = container.clientWidth;
  const h = container.clientHeight;

  camera = new PerspectiveCamera(70, w / h, 0.02, 200);
  scene.add(camera); // 相机加入场景，camera.add() 的子节点才会被渲染
  const spawn = getSpawnPoint(plan);
  camera.position.set(
    spawn.x * CM_TO_M,
    personHeight.value * 0.94 * CM_TO_M,
    spawn.y * CM_TO_M,
  );

  renderer = new WebGLRenderer({ canvas: canvasRef.value!, antialias: true });
  // Screen derivatives are core in WebGL2. Keep the stock path on WebGL1.
  if(renderer.capabilities.isWebGL2)releaseReceiverPlaneShadow=installReceiverPlaneShadow();
  renderer.domElement.addEventListener('webglcontextrestored',invalidateFrame);
  if (profileEnabled) gpuTimer = new GpuFrameTimer(renderer.getContext() as WebGL2RenderingContext);
  renderer.setPixelRatio(renderPixelRatio(w,h,window.devicePixelRatio,renderResolution.value));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = DAYLIGHT_LOOK.exposure;
  renderer.shadowMap.enabled = true;
  // r160 PCFSoft has a fixed one-texel footprint and ignores shadow.radius.
  // PCF uses 17 depth comparisons (vs 16) with an adjustable footprint.
  renderer.shadowMap.type = PCFShadowMap;
  renderer.localClippingEnabled = true;

  // 环境光 + 平行光
  ambient = new HemisphereLight(DAYLIGHT_LOOK.sky, DAYLIGHT_LOOK.ground, DAYLIGHT_LOOK.fillIntensity);
  scene.add(ambient);
  sun = new DirectionalLight(DAYLIGHT_LOOK.sun, DAYLIGHT_LOOK.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.006;
  sun.shadow.radius = 2.5; // Initial fallback; fitSunShadow sets a world-scale footprint.
  scene.add(sun);

  floorGroup=buildFloor(plan);scene.add(floorGroup);
  const walls=buildWalls(plan);wallGroup=walls.group;verticalWallCaps=walls.verticalCaps;
  scene.add(wallGroup);
  const openings = buildOpenings(plan);
  scene.add(openings.group);
  openingGroup = openings.group;
  doorPivots = openings.doorPivots;

  furnitureGroup = buildFurniture(plan);
  scene.add(furnitureGroup);
  utilityGroup = buildUtilities(plan);
  utilityGroup.visible = false;
  scene.add(utilityGroup);

  const bounds = new Box3().setFromObject(wallGroup);
  if (bounds.isEmpty()) bounds.setFromCenterAndSize(new Vector3(), new Vector3(6, 3, 6));
  modelCenter = bounds.getCenter(new Vector3());
  modelCenter.y = 0;
  const size = bounds.getSize(new Vector3());
  modelSize = Math.max(size.x, size.z, 4);
  sun.position.copy(modelCenter).add(new Vector3(-modelSize * 0.4, modelSize, modelSize * 0.55));
  sun.target.position.copy(modelCenter);
  scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -modelSize, right: modelSize, top: modelSize, bottom: -modelSize, near: 0.1, far: modelSize * 4 });
  sun.shadow.camera.updateProjectionMatrix();
  fitSunShadow(sun, [wallGroup, floorGroup, furnitureGroup, openingGroup],renderer.capabilities.isWebGL2);

  const rl = buildRoomLights(plan);
  scene.add(rl.group);
  roomLightsGroup=rl.group;
  lightsByFurnitureId = rl.lightsByFurnitureId;
  allLights = Object.values(lightsByFurnitureId);

  const obstacles = staticObstacles = buildCollider(plan);
  controller = new DesktopFPS(camera, obstacles, canvasRef.value!, personHeight.value);
  thirdPerson = new ThirdPerson(camera, canvasRef.value!, obstacles);
  thirdPerson.setHeight(personHeight.value);
  thirdPerson.setPosition(spawn);
  thirdPerson.avatar.group.rotation.y=plan.walkthrough.startYaw??0;
  scene.add(thirdPerson.avatar.group);
  orbit = new OrbitControls(camera, canvasRef.value!);
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI / 2 - 0.04;
  orbit.minDistance = 1;
  orbit.maxDistance = modelSize * 10;
  setMode('third');
  installMaterialEnvironment();
  sceneEditor=new SceneEditor(camera,scene,canvasRef.value!,()=>planStore.plan!,()=>({furniture:furnitureGroup!,utilities:utilityGroup!,walls:wallGroup!}),
    selectEdited,dragging=>{if(orbit)orbit.enabled=!dragging&&viewMode.value==='edit';},message=>{editNotice.value=message;});


  fpArms = buildFirstPersonArms();
  fpArms.visible = false;
  camera.add(fpArms);
}

function installMaterialEnvironment() {
  // Do this after the scene is interactive; generating the reflection atlas must not delay pointer lock.
  environmentFrame = requestAnimationFrame(() => {
    if (!renderer || !scene || environmentTexture) return;
    const pmrem = new PMREMGenerator(renderer);
    const studio = new RoomEnvironment(renderer);
    try {
      environmentTarget = pmrem.fromScene(studio, 0.04);
      environmentTexture = environmentTarget.texture;
      scene.environment = night.value ? null : environmentTexture;
    } finally {
      studio.dispose();
      pmrem.dispose();
    }
  });
}

function tick(t: number) {
  rafId = requestAnimationFrame(tick);
  if (!renderer || !scene || !camera || !controller) return;
  if(preparingMaterials.value)return;
  const dt = lastT === 0 ? 0 : (t - lastT) / 1000;
  const profileStart = performance.now();
  lastT = t;

  if (viewMode.value === 'walk') controller.update(Math.min(dt, 0.1));
  else if (viewMode.value === 'third') {
    thirdPerson?.update(Math.min(dt, 0.1));
  } else orbit?.update();
  const controlEnd = performance.now();
  exteriorBackdrop?.update(camera);
  if (viewMode.value === 'third') revealCharacter();
  const occlusionEnd = performance.now();
  if(furnitureGroup)animateStorage(furnitureGroup,Math.min(dt,0.1));
  if(furnitureGroup)animateWater(furnitureGroup,Math.min(dt,0.1));
  lifeTimer+=dt;
  if(lifeTimer>0.15&&planStore.plan&&thirdPerson){
    lifeTimer=0;
    if(furnitureGroup){const obstacles=[...staticObstacles,...runtimeColliders(furnitureGroup,doorPivots,personHeight.value)];thirdPerson.setObstacles(obstacles);controller?.setObstacles(obstacles);}
  }

  if(viewMode.value==='third'||viewMode.value==='walk'){
    activeLifeTarget.value=aimedLifeTarget();
    const id=activeLifeTarget.value?.id;
    targetHighlight.set(furnitureGroup?.children.find(o=>o.userData.furnitureId===id)??(id?doorPivots[id]:null)??null);
  }
  if(utilityVisible.value&&utilityGroup){
    const canvas=canvasRef.value!,labels:typeof sourceLabels.value=[];
    for(const item of utilityGroup.children){if(!item.visible||item.userData.utilityRole!=='source')continue;
      const u=planStore.plan?.renovation?.utilities[item.userData.utilityId];if(!u)continue;
      const point=item.getWorldPosition(new Vector3()).project(camera);
      if(point.z<-1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1)continue;
      const y=(1-point.y)*canvas.clientHeight/2;
      labels.push({id:u.id,text:u.label,x:(point.x+1)*canvas.clientWidth/2,y,anchorY:y,color:UTILITY_CATALOG[u.kind].color});
    }
    labels.sort((a,b)=>a.y-b.y);
    for(let i=0;i<labels.length;i++)for(let j=0;j<i;j++)if(Math.abs(labels[i].x-labels[j].x)<185&&Math.abs(labels[i].y-labels[j].y)<34)labels[i].y=labels[j].y+34;
    sourceLabels.value=labels;
  }else sourceLabels.value=[];


  if (viewMode.value === 'orbit' && cutaway.value && orbit) {
    inspectionCutaway.update(camera.position, orbit.target);
    verticalWallCaps?.update(inspectionCutaway.planes[1], preserveInteriorBack);
  }
  const logicEnd = performance.now();
  if(materialPreparationEnabled&&(viewMode.value==='orbit'||viewMode.value==='edit')&&!preparedPaths.has(preparationKey())){
    schedulePreparation();return;
  }
  // The sun's fixed projection does not depend on the viewing camera. Reuse its
  // depth map in ALL modes while stationary; avatar limbs and animated doors
  // are included in the signature, so movement still updates every frame.
  renderer.shadowMap.autoUpdate = !sun;
  if (sun) renderer.shadowMap.needsUpdate = shadowCache.needsUpdate(scene, sun);
  const shadowUpdated = renderer.shadowMap.autoUpdate || renderer.shadowMap.needsUpdate;
  const shadowCheckEnd = performance.now();
  if (profileEnabled) renderer.info.autoReset = false;
  renderer.info.reset();
  const rendered=frameCache.needsRender(scene,camera,[renderer.domElement.width,renderer.domElement.height,renderer.toneMappingExposure,
    detailedShadows.value,viewMode.value,shadowUpdated]);
  const frameCheckEnd=performance.now();
  idleFrame.value=!rendered;
  if(!rendered)gpuTimer?.poll();
  const gpuSample: Record<string, number | string> = { gpuMs: gpuTimer?.supported ? 'skipped' : 'unsupported' };
  if(rendered){
  if (gpuTimer?.begin(ms => { gpuSample.gpuMs = ms ?? 'invalid'; })) gpuSample.gpuMs = 'pending';
  try {
  drawScene();
  } catch(error) { frameCache.invalidate(); throw error; } finally { gpuTimer?.end(); }
  }
  if (profileEnabled) {
    Object.assign(gpuSample, { preparationMs, preparationMaxSliceMs, mode: viewMode.value, ao: Number(detailedShadows.value), shadowUpdated: Number(shadowUpdated),
      rendered:Number(rendered),frameCheckMs:frameCheckEnd-shadowCheckEnd,
      aoUpdated: Number(rendered && detailedShadows.value && (viewMode.value === 'orbit' || viewMode.value === 'edit') && occlusionPass?.recomputedLastFrame),
      frameMs: dt * 1000, controlsMs: controlEnd - profileStart,
      occlusionMs: occlusionEnd - controlEnd, logicMs: logicEnd - occlusionEnd,
      shadowCheckMs: shadowCheckEnd - logicEnd, renderSubmitMs: rendered ? performance.now() - frameCheckEnd : 0,
      bufferWidth: renderer.domElement.width, bufferHeight: renderer.domElement.height,
      pixelRatio: renderer.getPixelRatio(), pointLights: allLights.filter(light => light.visible).length,
      importedModels: furnitureGroup?.children.filter(object=>object.userData.assetModel).length ?? 0,
      cameraPosition: camera.position.toArray(), cameraQuaternion: camera.quaternion.toArray(),
      avatarPosition: thirdPerson?.avatar.group.position.toArray(),
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0 });
    frameProfile.push(gpuSample);
    if (frameProfile.length > 300) frameProfile.shift();
    (window as unknown as { roomSimProfile: typeof frameProfile }).roomSimProfile = frameProfile;
  }

  if(rendered)frames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsCounter.value = Math.round(frames / fpsTimer);
    frames = 0;
    fpsTimer = 0;
  }
}

function drawScene():void {
  if(!renderer||!scene||!camera)return;
  if (detailedShadows.value && (viewMode.value === 'orbit' || viewMode.value === 'edit')) {
    if (!composer) {
      composer = new EffectComposer(renderer);
      if (renderer.capabilities.isWebGL2) {
        composer.renderTarget1.samples = 4;
        composer.renderTarget2.samples = 4;
      }
      composer.addPass(new RenderPass(scene, camera));
      occlusionPass = new InteriorOcclusionPass(scene, camera, 512, 512, 16);
      occlusionPass.kernelRadius = 0.2;
      occlusionPass.minDistance = 0.0001;
      occlusionPass.maxDistance = 0.006;
      composer.addPass(occlusionPass);
      outputPass = new InteriorOutputPass(occlusionPass.useOutputComposite(renderer.capabilities.isWebGL2));
      composer.addPass(outputPass);
    }
    const background = scene.background;
    const clearColor = renderer.getClearColor(new Color());
    const clearAlpha = renderer.getClearAlpha();
    try {
      outputPass?.setBackground(background instanceof Color ? background : clearColor);
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      composer.render();
    } finally {
      scene.background = background;
      renderer.setClearColor(clearColor, clearAlpha);
    }
  } else renderer.render(scene, camera);
}


function doInteract(info: InteractableInfo) {
  if (info.kind === 'door') {
    invalidateFloorBake();
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
    syncLampSurfaces();
    return;
  }
  if (info.kind === 'switch') {
    // 开关切换房间内所有灯
    if (allLights.length === 0) return;
    const anyOn = allLights.some((l) => l.intensity > 0);
    for (const l of allLights) setLightEnabled(l, !anyOn);
    syncLampSurfaces();
    return;
  }
  if (info.kind === 'tv') {
    const f=planStore.plan?.furniture[info.targetId];
    const g=furnitureGroup?.children.find(o=>o.userData.furnitureId===info.targetId) as Group|undefined;
    if(f&&g)lifeStatus.value=useObject(g,f,message=>{lifeStatus.value=message;});
  }
}

function onResize() {
  frameCache.invalidate();
  if (!canvasRef.value || !renderer || !camera) return;
  const container = canvasRef.value.parentElement!;
  const w = container.clientWidth;
  const h = container.clientHeight;
  const ratio=renderPixelRatio(w,h,window.devicePixelRatio,renderResolution.value);
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer?.setPixelRatio(ratio);
  composer?.setSize(w, h);
  if(graphicsPanel.value)refreshGraphicsInfo();
  thirdPerson?.setHeight(personHeight.value);
}

function onLockChange() {
  pointerLocked.value = document.pointerLockElement === canvasRef.value;
}
function resumePlay(){
  if(!canvasRef.value||pointerLockPending.value||document.pointerLockElement===canvasRef.value)return;
  pointerLockPending.value=true;
  try{const request=canvasRef.value.requestPointerLock?.();Promise.resolve(request).catch(()=>{pointerLocked.value=false;}).finally(()=>{pointerLockPending.value=false;onLockChange();});}catch{pointerLocked.value=false;pointerLockPending.value=false;}
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.closest('input, select, textarea, [contenteditable="true"]')) return;
  if(viewMode.value==='edit') {
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?historyStore.redo():historyStore.undo();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();historyStore.redo();}
    return;
  }
  if((viewMode.value==='third'||viewMode.value==='walk')&&pointerLocked.value&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    if(e.code==='KeyE'){
      e.preventDefault();const target=aimedLifeTarget();if(!e.repeat&&target)performLifeAction(target);return;
    }
  }
  if (e.key === 'Escape') {
    if(viewMode.value==='walk'||viewMode.value==='third'){document.exitPointerLock?.();return;}
    goBack();
    return;
  }
}

function goBack() {
  router.push({ name: 'editor', params: { id: props.id } });
}

function changeHeight(delta: number) {
  personHeight.value = Math.max(avatarKind.value==='child'?90:140, Math.min(avatarKind.value==='child'?140:200, personHeight.value + delta));
  thirdPerson?.setHeight(personHeight.value);
  if (controller && camera) {
    controller.setHeight(personHeight.value);
    if (viewMode.value === 'walk') camera.position.y = personHeight.value * 0.94 * CM_TO_M;
  }
}

function resetView() {
  preserveInteriorBack = false;
  updateLayers(false);
  if (viewMode.value === 'third') { thirdPerson?.resetCamera(); return; }
  if (!camera || !orbit) return;
  const distance = modelSize * 0.63 * Math.max(1, 1 / camera.aspect);
  camera.position.copy(modelCenter).add(inspectionOffset(new Vector3(-distance * 0.7, distance * 0.85, distance * 0.85)));
  orbit.target.copy(modelCenter);
  orbit.update();
}
function focusLivingRoom() {
  const sofa = Object.values(planStore.plan?.furniture ?? {}).find(f => ['sofa-3', 'sofa-2', 'sofa-l'].includes(f.type));
  if (!sofa || !camera || !orbit) return;
  setMode('orbit');
  const center = new Vector3(sofa.position.x * CM_TO_M, 0.48, sofa.position.y * CM_TO_M);
  const offset = new Vector3(sofa.type === 'sofa-l' ? 2.1 : -2.1, 1.65, sofa.type === 'sofa-l' ? 2.5 : -2.5)
    .applyAxisAngle(new Vector3(0, 1, 0), -sofa.rotation);
  camera.position.copy(center).add(inspectionOffset(offset));
  orbit.target.copy(center);
  orbit.update();
}
function focusBathroom() {
  const basin = Object.values(planStore.plan?.furniture ?? {}).find(f => f.type === 'basin');
  if (!basin || !camera || !orbit) return;
  setMode('orbit');
  const center = new Vector3(basin.position.x * CM_TO_M, basin.size.height * CM_TO_M * 1.1, basin.position.y * CM_TO_M);
  camera.position.copy(center).add(inspectionOffset(new Vector3(1.1, 1.0, -1.25).applyAxisAngle(new Vector3(0, 1, 0), -basin.rotation)));
  orbit.target.copy(center); orbit.update();
}
function focusShower() {
  const shower=Object.values(planStore.plan?.furniture??{}).find(f=>f.type==='shower');
  if(!shower||!camera||!orbit)return;
  setMode('orbit');
  const center=new Vector3(shower.position.x*CM_TO_M,shower.size.height*CM_TO_M*.45,shower.position.y*CM_TO_M);
  camera.position.copy(center).add(inspectionOffset(new Vector3(1.0,2.4,1.25).applyAxisAngle(new Vector3(0,1,0),-shower.rotation)));
  orbit.target.copy(center);orbit.update();
}
function focusBedroom() {
  const bed = Object.values(planStore.plan?.furniture ?? {}).find(f => f.type.startsWith('bed-'));
  if (!bed || !camera || !orbit) return;
  setMode('orbit');
  const center = new Vector3(bed.position.x * CM_TO_M, 0.4, bed.position.y * CM_TO_M);
  camera.position.copy(center).add(inspectionOffset(new Vector3(-1.7, 1.7, 2.1).applyAxisAngle(new Vector3(0, 1, 0), -bed.rotation)));
  orbit.target.copy(center); orbit.update();
}
function focusKitchen() {
  const sink = Object.values(planStore.plan?.furniture ?? {}).find(f => f.type === 'sink');
  if (!sink || !camera || !orbit) return;
  setMode('orbit');
  const center = new Vector3(sink.position.x * CM_TO_M, 1.2, sink.position.y * CM_TO_M)
    .add(new Vector3(0.45,0,0).applyAxisAngle(new Vector3(0,1,0),-sink.rotation));
  camera.position.copy(center).add(inspectionOffset(new Vector3(-0.6, 1.1, -2.0).applyAxisAngle(new Vector3(0, 1, 0), -sink.rotation)));
  orbit.target.copy(center); orbit.update();
}
function focusDining() {
  const table=Object.values(planStore.plan?.furniture??{}).find(f=>f.type.startsWith('dining-table-'));
  if(!table||!camera||!orbit)return;
  setMode('orbit');
  const center=new Vector3(table.position.x*CM_TO_M,(table.elevation??0)*CM_TO_M+table.size.height*CM_TO_M,table.position.y*CM_TO_M);
  const scale=Math.max(1,table.size.width/140);
  camera.position.copy(center).add(inspectionOffset(new Vector3(-1.55,1.25,1.7).multiplyScalar(scale).applyAxisAngle(new Vector3(0,1,0),-table.rotation)));
  orbit.target.copy(center);orbit.update();
}
function focusRoom(event: Event) {
  const select = event.target as HTMLSelectElement;
  const views: Record<string, () => void> = { living: focusLivingRoom, bathroom: focusBathroom, shower: focusShower, bedroom: focusBedroom, kitchen: focusKitchen, dining: focusDining };
  views[select.value]?.();
  preserveInteriorBack = !!views[select.value];
  updateLayers(false);
  select.value = '';
}
function setMode(mode: 'orbit' | 'walk' | 'third' | 'edit') {
  if(mode==='orbit'&&viewMode.value==='orbit'){resetView();return;}
  invalidateFloorBake();
  targetHighlight.clear();activeLifeTarget.value=null;
  if (!camera || !controller || !orbit || !planStore.plan) return;
  const previousMode=viewMode.value;
  controller.stand();thirdPerson?.stand();
  const playerPosition=previousMode==='walk'?camera.position.clone():thirdPerson?.avatar.group.position.clone();
  const look=camera.getWorldDirection(new Vector3());
  viewMode.value = mode;
  setInspectionLens(camera, mode === 'orbit' || mode === 'edit');
  sceneEditor?.setActive(mode==='edit');
  restoreOcclusion();
  controller.dispose();
  thirdPerson?.dispose();
  if (thirdPerson) thirdPerson.avatar.group.visible = mode === 'third';
  orbit.enabled = mode === 'orbit'||mode==='edit';
  if (mode === 'orbit'||mode==='edit') {resetView();if(mode==='edit'){utilityVisible.value=true;editorStore.showUtilities=true;editorStore.workspace='furniture';sceneEditor?.refresh();}}
  else if (mode === 'third') {
    if(previousMode==='walk'&&playerPosition)thirdPerson?.setPosition({x:playerPosition.x*100,y:playerPosition.z*100});
    thirdPerson?.attach();
  }
  else {
    const spawn = previousMode==='third'&&playerPosition?{x:playerPosition.x*100,y:playerPosition.z*100}:getSpawnPoint(planStore.plan);
    camera.position.set(spawn.x * CM_TO_M, personHeight.value * 0.94 * CM_TO_M, spawn.y * CM_TO_M);
    controller.setYaw(previousMode==='third'?Math.atan2(-look.x,-look.z):planStore.plan.walkthrough.startYaw ?? 0);
    controller.attach();
  }
  updateLayers();
  if(mode==='third'||mode==='walk')resumePlay();
}
function updateLayers(invalidateContact=true) {
  if(invalidateContact)invalidateFloorBake();
  restoreOcclusion();
  if (utilityGroup) utilityGroup.visible = utilityVisible.value;
  utilityGroup?.children.forEach(object=>{object.visible=utilityMatches(object.userData.utilityKind,utilityFilter.value);});
  const clip = (viewMode.value==='orbit'||viewMode.value==='third') && cutaway.value;
  const directionalClip = clip && viewMode.value === 'orbit';
  if(furnitureGroup)updateWallDecorationCutaway(furnitureGroup,inspectionCutaway,clip,directionalClip,preserveInteriorBack);
  if (directionalClip && camera && orbit) inspectionCutaway.update(camera.position, orbit.target);
  if(directionalClip)verticalWallCaps?.update(inspectionCutaway.planes[1], preserveInteriorBack);
  for (const group of [wallGroup, openingGroup]) group?.traverse(object => {
    const renderable = object as Mesh;
    if (!renderable.material) return;
    if(renderable.userData.cutawayCap)renderable.visible=clip;
    if(renderable.userData.verticalCap)renderable.visible=directionalClip;
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    for (const material of materials) {
      const preserveBack = directionalClip && (preserveInteriorBack || !material.userData.interiorPartition);
      material.clippingPlanes = material.userData.cutawayCap
        ? preserveBack && !material.userData.verticalCap ? inspectionCutaway.capPlanes : null
        : preserveBack ? inspectionCutaway.planes : clip ? [new Plane(new Vector3(0, -1, 0), CUTAWAY_HEIGHT)] : null;
      material.clipIntersection = preserveBack && !material.userData.cutawayCap;
      material.clipShadows = true;
      if (material instanceof MeshStandardMaterial) {
        if (material.userData.originalOpacity === undefined) material.userData.originalOpacity = material.opacity;
        if (material.userData.originalTransparent === undefined) material.userData.originalTransparent = material.transparent;
        material.opacity = utilityVisible.value ? 0.18 : material.userData.originalOpacity;
        material.transparent = utilityVisible.value || material.userData.originalTransparent;
        material.depthWrite = !utilityVisible.value;
      }
      material.needsUpdate = true;
    }
  });
}
function filterUtilities(filter:UtilityFilter){utilityFilter.value=filter;utilityVisible.value=true;updateLayers();}
function focusWater(){
  if(!camera||!orbit)return;
  if(viewMode.value!=='orbit'&&viewMode.value!=='edit')setMode('orbit');
  filterUtilities('water');const bounds=new Box3();
  for(const u of filteredUtilities.value)for(const p of u.points)bounds.expandByPoint(new Vector3(p.x/100,(p.height??u.height)/100,p.y/100));
  if(bounds.isEmpty())return;
  const center=bounds.getCenter(new Vector3()),size=bounds.getSize(new Vector3()),distance=Math.max(3,Math.max(size.x,size.z,size.y)*1.15)*Math.max(1,1/camera.aspect);
  orbit.target.copy(center);camera.position.copy(center).add(inspectionOffset(new Vector3(-0.7,1.1,-0.85).multiplyScalar(distance)));orbit.update();
}
function rebuildWater(){
  if(!planStore.plan)return;
  if(!Object.values(planStore.plan.renovation?.utilities??{}).some(u=>isWater(u.kind)&&u.points.length===1&&u.role!=='source')){waterNotice.value='当前没有水路接口，请先添加冷水、热水或排水点位。';return;}
  const result=connectWaterNetwork(planStore.plan);
  historyStore.execute(new RenovationCommand('补齐水路连接',r=>({...r,utilities:result.utilities})));
  waterNotice.value=result.unconnected.length?`${result.unconnected.length} 个接口未连通：请检查墙体是否断开。`:'已生成水路连接示意，可撤销；原有手绘管线保留。';
  filterUtilities('water');
}
function toggleNight() {
  night.value = !night.value;
  const look=night.value?NIGHT_LOOK:DAYLIGHT_LOOK;
  if (sun) sun.intensity = look.sunIntensity;
  if (ambient) ambient.intensity = look.fillIntensity;
  if (renderer) renderer.toneMappingExposure=look.exposure;
  if (scene) scene.background = new Color(look.background);
  if (scene) scene.environment = night.value ? null : environmentTexture;
  exteriorBackdrop?.setNight(night.value);
}

function selectEdited(selection:SelectionTarget|null){editSelection.value=selection;if(selection)editorStore.select(selection);else editorStore.clearSelection();sceneEditor?.select(selection);}
function changeAvatar(event:Event){
  avatarKind.value=(event.target as HTMLSelectElement).value as AvatarKind;
  thirdPerson?.setKind(avatarKind.value);personHeight.value=avatarKind.value==='child'?120:170;changeHeight(0);
}
function aimedLifeTarget():LifeTarget|null {
  if(!camera||!thirdPerson||!planStore.plan)return null;
  const p=viewMode.value==='walk'?camera.position:thirdPerson.avatar.group.position;
  const roots=[wallGroup,openingGroup,furnitureGroup,floorGroup].filter((g):g is Group=>!!g);
  const eye=viewMode.value==='walk'?p.clone():p.clone().add(new Vector3(0,personHeight.value*0.0075,0));
  const id=pickAimedObject(camera,roots,eye);
  const target=nearbyFurniture(planStore.plan,{x:p.x*100,y:p.z*100}).find(t=>t.id===id);
  if(!target)return null;
  const object=furnitureGroup?.children.find(o=>o.userData.furnitureId===id);
  if(target.action==='storage')target.label=object?.userData.open?'关闭':'打开';
  if(['tv','water','cook'].includes(target.action))target.label=object?.userData.on?'关闭':'开启';
  return target;
}
function performLifeAction(target:LifeTarget){
  if(!thirdPerson||!planStore.plan)return;
  if(aimedLifeTarget()?.id!==target.id)return;
  targetHighlight.clear();
  if(target.action==='door'){doInteract({kind:'door',targetId:target.id,hint:'开关房门'});lifeStatus.value='已切换房门';return;}
  const f=planStore.plan?.furniture[target.id],g=furnitureGroup?.children.find(o=>o.userData.furnitureId===target.id) as Group|undefined;
  if(!f||!g||!thirdPerson||!planStore.plan)return;
  if(target.action==='sit'||target.action==='rest'){
    const surface=(f.elevation??0)+(target.action==='sit'?45:52);
    if(viewMode.value==='walk')controller?.useFurniture(f.position.x/100,f.position.y/100,surface/100+(target.action==='sit'?personHeight.value*0.0045:0.18));
    else thirdPerson.useFurniture(f.position,f.rotation,target.action==='sit'?'sit':'lie',surface,g.userData.seatYaw??0);
    lifeStatus.value=target.action==='sit'?'已坐下；按方向键起身继续走动。':'正在躺下休息；按方向键起身。';return;
  }
  if(target.action==='light'){
    if(f.type==='switch'){const on=allLights.some(l=>l.intensity>0);allLights.forEach(l=>setLightEnabled(l,!on));}else{const light=lightsByFurnitureId[f.id];if(light)toggleLight(light);}
    syncLampSurfaces();lifeStatus.value='已切换灯光';return;
  }
  invalidateFloorBake();
  lifeStatus.value=useObject(g,f,message=>{lifeStatus.value=message;});
}
function syncLampSurfaces(){
  for(const item of furnitureGroup?.children??[]){
    const light=lightsByFurnitureId[item.userData.furnitureId];
    if(light)item.userData.setLightOn?.(light.intensity>0);
  }
}
function setEditTool(tool:SceneEditTool,kind?:UtilityKind){editTool.value=tool;sceneEditor?.setTool(tool,kind);}
function addToScene(type:FurnitureType){
  if(!planStore.plan)return;
  const position=getSpawnPoint(planStore.plan),cmd=new AddFurnitureCommand({type,position});historyStore.execute(cmd);
  editTool.value='select';sceneEditor?.setTool('select');selectEdited({kind:'furniture',id:cmd.furnitureId});
}
function disposeGroup(group:Group|null){
  targetHighlight.clear();
  if(!group||!scene)return;group.removeFromParent();const disposed=new Set<unknown>();
  group.traverse(o=>{if(o instanceof InstancedMesh)o.dispose();const m=o as Mesh;if(m.geometry&&!disposed.has(m.geometry)){m.geometry.dispose();disposed.add(m.geometry);}const materials=m.material?(Array.isArray(m.material)?m.material:[m.material]):[];
    for(const mat of materials)if(!disposed.has(mat)){for(const value of Object.values(mat))if(value instanceof Texture&&!disposed.has(value)){value.dispose();disposed.add(value);}mat.dispose();disposed.add(mat);}});
}
watch(()=>planStore.plan,(_next,previous)=>{
  invalidateFloorBake();
  if(!scene||!planStore.plan||!furnitureGroup)return;
  restoreOcclusion();sceneEditor?.transform.detach();
  const p=planStore.plan;
  if(previous)reconcileFurniture(furnitureGroup,previous,p,disposeGroup);
  else {disposeGroup(furnitureGroup);furnitureGroup=buildFurniture(p);scene.add(furnitureGroup);}
  if(!previous||previous.rooms!==p.rooms||previous.renovation?.finish!==p.renovation?.finish||previous.renovation?.roomFloors!==p.renovation?.roomFloors){
    disposeGroup(floorGroup);floorGroup=buildFloor(p);scene.add(floorGroup);
  }
  if(!previous||previous.renovation?.utilities!==p.renovation?.utilities){
    disposeGroup(utilityGroup);utilityGroup=buildUtilities(p);scene.add(utilityGroup);
  }
  const lamps=Object.values(p.furniture).filter(f=>FURNITURE_CATALOG[f.type]?.interactive==='light');
  const oldLamps=Object.values(previous?.furniture??{}).filter(f=>FURNITURE_CATALOG[f.type]?.interactive==='light');
  if(!previous||previous.meta.defaultWallHeight!==p.meta.defaultWallHeight||lamps.length!==oldLamps.length||lamps.some(f=>previous.furniture[f.id]!==f)){
    disposeGroup(roomLightsGroup);
    const lights=buildRoomLights(p);roomLightsGroup=lights.group;lightsByFurnitureId=lights.lightsByFurnitureId;allLights=Object.values(lightsByFurnitureId);scene.add(roomLightsGroup);
  }
  wallGroup?.traverse(o=>{if(o instanceof Mesh&&o.material instanceof MeshStandardMaterial)o.material.color.set(p.renovation?.finish.wallColor??'#f5f0e8');});
  staticObstacles=buildCollider(p);
  const obstacles=[...staticObstacles,...runtimeColliders(furnitureGroup,doorPivots,personHeight.value)];
  controller?.setObstacles(obstacles);thirdPerson?.setObstacles(obstacles);
  syncLampSurfaces();sceneEditor?.refresh();updateLayers();
  if(sun)fitSunShadow(sun,[wallGroup,floorGroup,furnitureGroup,openingGroup].filter((g):g is Group=>!!g),renderer?.capabilities.isWebGL2??false);
},{flush:'post'});
watch(()=>editorStore.selection,()=>{if(viewMode.value==='edit'){editSelection.value=editorStore.selection[0]??null;sceneEditor?.select(editSelection.value);}});
watch(()=>editorStore.showUtilities,()=>{if(viewMode.value==='edit'){utilityVisible.value=editorStore.showUtilities;updateLayers();}});
</script>

<template>
  <div class="h-full relative bg-black text-white overflow-hidden">
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" @click="(viewMode==='third'||viewMode==='walk')&&resumePlay()" />
    <div v-if="preparingMaterials" role="status" class="absolute inset-0 z-10 flex items-center justify-center bg-black/30 pointer-events-none">
      <div class="rounded bg-black/75 px-5 py-3 text-sm">正在准备材质与阴影… {{ preparationProgress }} 首次进入此渲染模式可能稍慢</div>
    </div>

    <div
      v-if="!pointerLocked && !pointerLockPending && (viewMode === 'walk'||viewMode==='third')"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div class="bg-black/60 px-6 py-3 rounded text-sm pointer-events-auto text-center">
        <button @click="resumePlay" class="px-5 py-2 rounded bg-teal-700">继续游玩</button>
        <p class="mt-3">鼠标已释放 · 点击继续后隐藏并锁定鼠标</p>
        <p>WASD 移动 · 鼠标转向 · E 交互 · Esc 暂停</p>
      </div>
    </div>


    <div class="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
      <button
        class="px-3 py-2 bg-black/60 rounded text-sm hover:bg-black/70"
        @click="goBack"
      >
        ← 返回编辑器
      </button>
      <div class="view-actions">
        <button :class="{ active: viewMode === 'orbit' }" @click="setMode('orbit')">俯瞰</button>
        <button :class="{ active: detailedShadows }" @click="detailedShadows = !detailedShadows">精细阴影</button>
        <select v-model="renderResolution" aria-label="渲染清晰度" title="均衡模式限制为约240万渲染像素；原像素最高2倍屏幕像素比，GPU开销更高" @change="onResize">
          <option value="balanced">清晰度：均衡</option>
          <option value="native">清晰度：原像素</option>
        </select>
        <button v-if="viewMode==='orbit'" :disabled="utilityVisible" title="后台计算地板与墙面静态接触阴影；修改场景后需重新计算，水电透视时不可用" :class="{active:floorBakeState==='ready'}" @click="toggleFloorBake" :aria-pressed="floorBakeState==='ready'">{{floorBakeState==='busy'?'取消接触阴影计算':floorBakeState==='ready'?'关闭房间接触阴影':floorBakeState==='error'?'重试房间接触阴影':'计算房间接触阴影'}}</button>
        <select aria-label="房间特写" @change="focusRoom">
          <option value="">房间特写</option>
          <option value="living">客厅</option><option value="bedroom">卧室</option>
          <option value="bathroom">卫浴</option><option value="shower">淋浴</option><option value="kitchen">厨房</option>
          <option value="dining">餐厅</option>
        </select>
        <button :class="{ active: viewMode === 'third' }" @click="setMode('third')">第三人称</button>
        <button :class="{ active: viewMode === 'edit' }" @click="setMode('edit')">装修模式</button>
        <button :class="{ active: viewMode === 'walk' }" @click="setMode('walk')">第一人称</button>
        <button v-if="viewMode !== 'walk'" @click="resetView">重置视角</button>
        <button :class="{ active: utilityVisible }" @click="utilityVisible = !utilityVisible; updateLayers()">水电透视</button>
        <button v-if="viewMode !== 'walk'" :class="{ active: cutaway }" @click="cutaway = !cutaway; updateLayers()">剖切墙体</button>
        <button @click="toggleNight">{{ night ? '切换日景' : '切换夜景' }}</button>
      </div>
      <div class="flex items-center gap-2 text-xs bg-black/60 rounded px-2 py-1">
        <select aria-label="体验人物" :value="avatarKind" @change="changeAvatar" class="avatar-select"><option value="adult">大人</option><option value="child">小孩</option></select>
        <button class="px-2 py-1 bg-white/10 rounded hover:bg-white/20" @click="changeHeight(-5)">−</button>
        <span>身高 {{ personHeight }}cm</span>
        <button class="px-2 py-1 bg-white/10 rounded hover:bg-white/20" @click="changeHeight(5)">+</button>
        <button class="ml-4 text-gray-300" aria-label="渲染诊断" :aria-expanded="graphicsPanel" title="查看实际渲染设备与绘制分辨率" @click="toggleGraphicsPanel">{{ idleFrame ? '静止 · 已缓存' : `${fpsCounter} fps` }}</button>
      </div>
    </div>
    <section v-if="graphicsPanel" role="region" aria-label="渲染诊断" class="absolute top-16 right-3 z-20 max-w-sm rounded bg-slate-900/95 p-4 text-xs text-white shadow-lg">
      <div class="flex justify-between gap-4"><strong>渲染诊断</strong><button aria-label="关闭渲染诊断" @click="graphicsPanel=false">关闭</button></div>
      <template v-if="graphicsInfo">
        <p class="mt-3 break-words">设备：{{graphicsInfo.renderer}}</p>
        <p class="mt-2">实际绘制：{{graphicsInfo.width}} × {{graphicsInfo.height}} 像素</p>
        <p v-if="!graphicsInfo.unmasked&&!graphicsInfo.lost" class="mt-2">浏览器未公开完整显卡名称，无法据此确认独显或核显。</p>
        <p v-if="graphicsInfo.software" class="mt-2 text-amber-200">检测到软件渲染，请检查浏览器硬件加速是否可用。</p>
        <p class="mt-2 text-slate-300">这里显示浏览器实际选择的设备，不代表电脑的全部显卡。静止缓存不等于移动时流畅；当前 FPS 也不是 GPU 耗时。</p>
      </template>
      <p v-else class="mt-3">场景尚未准备完成。</p>
      <button class="mt-3 underline" @click="refreshGraphicsInfo">刷新设备信息</button>
    </section>
    <SceneEditorPanel v-if="viewMode==='edit'" :selected="editSelection" :step="editStep" :tool="editTool" :notice="editNotice"
      @select="selectEdited" @add="addToScene" @tool="setEditTool" @step="editStep=$event;sceneEditor?.setStep($event)" @finish="sceneEditor?.finishRoute()" />
    <aside v-if="utilityVisible" class="utility-inspector">
      <strong>水电透视</strong>
      <div class="utility-filters"><button v-for="[key,label] in ([['all','全部'],['water','只看水路'],['power','只看电路'],['cold-water','冷水'],['hot-water','热水'],['drain','排水']] as const)" :key="key" :class="{active:utilityFilter===key}" @click="filterUtilities(key)">{{label}}</button></div>
      <p class="utility-legend"><span style="color:#0284c7">● 冷水</span> <span style="color:#e34545">● 热水</span> <span style="color:#059669">● 排水</span></p>
      <p>{{filteredUtilities.filter(u=>u.points.length===1).length}} 个点位 / {{filteredUtilities.filter(u=>u.points.length>1).length}} 段管线</p>
      <button @click="focusWater">聚焦水路</button>
      <p>箭头表示连接方向；管线加粗仅为辨识，不代表施工管径。</p>
      <button @click="rebuildWater">补齐 / 重建水路示意</button>
      <p v-if="waterNotice" role="status">{{waterNotice}}</p>
      <p>沿墙连接示意，未计算排水坡度、压力或施工避让。</p>
    </aside>
    <svg v-if="sourceLabels.length" class="utility-label-leaders"><line v-for="label in sourceLabels" :key="label.id" :x1="label.x" :y1="label.anchorY" :x2="label.x+12" :y2="label.y" :stroke="label.color" stroke-width="1.5" /></svg>
    <div v-for="label in sourceLabels" :key="label.id" class="utility-source-label" :style="{left:`${label.x}px`,top:`${label.y}px`,borderColor:label.color}">{{label.text}}</div>
    <aside v-if="viewMode==='third'||viewMode==='walk'" class="life-panel">
      <h3>生活模式 <span>准星交互</span></h3>
      <p>{{lifeStatus}}</p>
      <p v-if="activeLifeTarget">当前瞄准：{{activeLifeTarget.name}} · 按 E {{activeLifeTarget.label}}</p>
      <p v-else>准星对准物品并走近；隔墙或超出距离无法交互。</p>
      <button @click="thirdPerson?.stand();controller?.stand();lifeStatus='已起身'">起身 / 结束休息</button>
    </aside>

    <div v-if="(viewMode==='third'||viewMode==='walk')&&pointerLocked" class="interaction-prompt" aria-live="polite">
      <template v-if="activeLifeTarget"><kbd>E</kbd><span><strong>{{activeLifeTarget.label}} · {{activeLifeTarget.name}}</strong><small>已对准 · {{Math.round(activeLifeTarget.distance)}} cm</small></span></template>
      <span v-else>准星对准家具，走近后按 E 互动</span>
    </div>
    <div v-if="(viewMode==='third'||viewMode==='walk')&&pointerLocked" class="aim-crosshair" :style="{top:`${AIM_SCREEN_Y*100}%`}" :class="{'can-interact':!!activeLifeTarget}" aria-hidden="true"><span /></div>

    <div v-if="viewMode !== 'walk'" class="view-caption">
      <strong>{{ planStore.plan?.name }} · 装修预览</strong>
      <span v-if="viewMode === 'third'">肩后游玩 · WASD 移动 · 鼠标转向 · E 交互 · 滚轮远近 · Esc 暂停</span>
      <span v-else-if="viewMode==='edit'">装修模式 · 点击选择 · 三轴网格移动 · 墙面布线 · Ctrl+Z 撤销</span>
      <span v-else>左键旋转 · 右键平移 · 滚轮缩放</span>
      <span v-if="utilityVisible">橙：电路 / 插座　紫：开关　蓝：冷水　红：热水　绿：排水</span>
    </div>

    <div
      v-if="errorMsg"
      class="absolute inset-0 flex items-center justify-center bg-black/70 text-red-300"
    >
      {{ errorMsg }}
    </div>
  </div>
</template>

<style scoped>
.utility-label-leaders{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.utility-inspector{position:absolute;left:16px;top:70px;width:225px;padding:14px;background:#fffffff2;color:#34515b;border:1px solid #d0dfe1;border-radius:8px;font-size:12px;max-height:calc(100% - 190px);overflow:auto}.utility-inspector p{margin:9px 0;line-height:1.6;color:#69818a}.utility-filters{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:12px}.utility-inspector button{border:1px solid #c4d9da;padding:7px;border-radius:4px;background:white}.utility-filters .active{background:#d8efed;color:#126f72}.utility-legend{display:flex;justify-content:space-between}.utility-source-label{position:absolute;transform:translate(12px,-50%);padding:5px 9px;border:2px solid;background:#fffffff5;border-radius:5px;color:#294854;font-size:11px;pointer-events:none;white-space:nowrap;box-shadow:0 2px 8px #1e465222}
.avatar-select{background:#345258;color:#fff;border:1px solid #91aaa6;border-radius:4px;padding:3px;margin-right:8px}
.aim-crosshair{position:absolute;left:50%;top:50%;width:20px;height:20px;transform:translate(-50%,-50%);pointer-events:none;display:grid;place-items:center;border:1px solid transparent;border-radius:50%;transition:border-color .12s,box-shadow .12s}.aim-crosshair span{width:4px;height:4px;background:#fff;border-radius:50%;box-shadow:0 0 2px 1px #182e3980}.aim-crosshair.can-interact{border-color:#b8f0e2;box-shadow:0 0 3px #183c4380}.aim-crosshair.can-interact span{background:#b8f0e2}
.interaction-prompt{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:12px;background:#183c43ed;color:white;box-shadow:0 4px 20px #12343c22;pointer-events:none;font-size:14px}.interaction-prompt kbd{display:grid;place-items:center;width:34px;height:34px;background:#fff;color:#215b61;border-radius:7px;font-size:19px;font-weight:700}.interaction-prompt span{display:grid;gap:4px}.interaction-prompt small{font-size:11px;color:#b9d6d7}.life-panel button.life-selected{background:#e1f2ee;box-shadow:inset 3px 0 #287b77;padding-left:10px}
.life-panel{position:absolute;right:18px;top:80px;width:250px;background:#fffffff2;color:#3c5560;border-radius:8px;padding:16px;font-size:12px;box-shadow:0 5px 24px #26434b15}.life-panel h3{display:flex;justify-content:space-between;font-size:14px}.life-panel h3 span{font-size:11px;color:#8c9ba0}.life-panel p{line-height:1.8;margin:10px 0;color:#819099}.life-panel button{display:flex;justify-content:space-between;width:100%;padding:11px 4px;border-bottom:1px solid #e5ecee}.life-panel button:hover{background:#edf7f4}.life-panel strong{font-weight:500;color:#25777e}
.view-actions { display: flex; padding: 4px; gap: 3px; background: #ffffffed; color: #526571; border-radius: 7px; box-shadow: 0 3px 15px #1d33431a; }
.view-actions button { font-size: 12px; padding: 7px 10px; border-radius: 4px; }.view-actions button.active { background: #246f76; color: white; }.view-actions button:hover { background: #dae8e8; color: #235861; }
.view-caption { position: absolute; bottom: 24px; left: 24px; display: grid; gap: 7px; pointer-events: none; background: #ffffffea; color: #506673; padding: 16px 20px; border-radius: 6px; font-size: 12px; }.view-caption strong { color: #243f4c; font-size: 15px; }
</style>
