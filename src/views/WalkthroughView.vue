<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  HemisphereLight,
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Box3,
  Vector3,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Plane,
  Raycaster,
  type Material,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  type PointLight,
  Scene,
  WebGLRenderer,
  type Group,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildUtilities } from '@/modules/walkthrough/builders/utility-builder';
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
import { runtimeColliders } from '@/modules/walkthrough/runtime-colliders';
import { AIM_SCREEN_Y, pickAimedObject } from '@/modules/walkthrough/aim';
import { TargetHighlight } from '@/modules/walkthrough/target-highlight';
import type { AvatarKind } from '@/modules/walkthrough/builders/stylized-avatar';
import { buildWalls } from '@/modules/walkthrough/builders/wall-builder';
import { buildFloor } from '@/modules/walkthrough/builders/floor-builder';
import { buildFurniture } from '@/modules/walkthrough/builders/furniture-builder';
import { buildOpenings } from '@/modules/walkthrough/builders/opening-builder';
import { buildRoomLights, toggleLight } from '@/modules/walkthrough/lights';
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
const cutaway = ref(true);
const night = ref(false);
let orbit: OrbitControls | null = null;
let utilityGroup: Group | null = null;
let wallGroup: Group | null = null;
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
let scene: Scene | null = null;
let camera: PerspectiveCamera | null = null;
let controller: DesktopFPS | null = null;
let doorPivots: Record<string, Group> = {};
let fpArms: Group | null = null;
let lightsByFurnitureId: Record<string, PointLight> = {};
let allLights: PointLight[] = [];
let rafId = 0;
let lastT = 0;

const fpsCounter = shallowRef(0);
let frames = 0;
let fpsTimer = 0;

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
  stopAutoSave=setupAutoSave();
});

onBeforeUnmount(() => {
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
  sun?.shadow.dispose();
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
  scene.background = new Color('#e7ecee');

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  // 环境光 + 平行光
  ambient = new HemisphereLight('#eaf4ff', '#b5a08b', 1.5);
  scene.add(ambient);
  sun = new DirectionalLight('#fff1dc', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  floorGroup=buildFloor(plan);scene.add(floorGroup);
  wallGroup = buildWalls(plan).group;
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
  sun.position.copy(modelCenter).add(new Vector3(modelSize * 0.3, modelSize, modelSize * 0.5));
  sun.target.position.copy(modelCenter);
  scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -modelSize, right: modelSize, top: modelSize, bottom: -modelSize, near: 0.1, far: modelSize * 4 });
  sun.shadow.camera.updateProjectionMatrix();

  const rl = buildRoomLights(plan);
  scene.add(rl.group);
  roomLightsGroup=rl.group;
  lightsByFurnitureId = rl.lightsByFurnitureId;
  allLights = Object.values(lightsByFurnitureId);

  const obstacles = buildCollider(plan);
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
  orbit.maxDistance = modelSize * 5;
  setMode('third');
  sceneEditor=new SceneEditor(camera,scene,canvasRef.value!,()=>planStore.plan!,()=>({furniture:furnitureGroup!,utilities:utilityGroup!,walls:wallGroup!}),
    selectEdited,dragging=>{if(orbit)orbit.enabled=!dragging&&viewMode.value==='edit';},message=>{editNotice.value=message;});


  fpArms = buildFirstPersonArms();
  fpArms.visible = false;
  camera.add(fpArms);
}

function tick(t: number) {
  rafId = requestAnimationFrame(tick);
  if (!renderer || !scene || !camera || !controller) return;
  const dt = lastT === 0 ? 0 : (t - lastT) / 1000;
  lastT = t;

  if (viewMode.value === 'walk') controller.update(Math.min(dt, 0.1));
  else if (viewMode.value === 'third') {
    thirdPerson?.update(Math.min(dt, 0.1));
    revealCharacter();
  } else orbit?.update();
  if(furnitureGroup)animateStorage(furnitureGroup,Math.min(dt,0.1));
  lifeTimer+=dt;
  if(lifeTimer>0.15&&planStore.plan&&thirdPerson){
    lifeTimer=0;
    if(furnitureGroup){const obstacles=[...buildCollider(planStore.plan),...runtimeColliders(furnitureGroup,doorPivots,personHeight.value)];thirdPerson.setObstacles(obstacles);controller?.setObstacles(obstacles);}
  }

  if(viewMode.value==='third'||viewMode.value==='walk'){
    activeLifeTarget.value=aimedLifeTarget();
    const id=activeLifeTarget.value?.id;
    targetHighlight.set(furnitureGroup?.children.find(o=>o.userData.furnitureId===id)??(id?doorPivots[id]:null)??null);
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
  if (viewMode.value === 'third') { thirdPerson?.resetCamera(); return; }
  if (!camera || !orbit) return;
  const distance = modelSize * Math.max(1, 1 / camera.aspect);
  camera.position.copy(modelCenter).add(new Vector3(-distance * 0.7, distance * 1.1, -distance * 0.85));
  orbit.target.copy(modelCenter);
  orbit.update();
}
function setMode(mode: 'orbit' | 'walk' | 'third' | 'edit') {
  targetHighlight.clear();activeLifeTarget.value=null;
  if (!camera || !controller || !orbit || !planStore.plan) return;
  const previousMode=viewMode.value;
  controller.stand();thirdPerson?.stand();
  const playerPosition=previousMode==='walk'?camera.position.clone():thirdPerson?.avatar.group.position.clone();
  const look=camera.getWorldDirection(new Vector3());
  viewMode.value = mode;
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
function updateLayers() {
  restoreOcclusion();
  if (utilityGroup) utilityGroup.visible = utilityVisible.value;
  const clip = (viewMode.value==='orbit'||viewMode.value==='third') && cutaway.value;
  for (const group of [wallGroup, openingGroup]) group?.traverse(object => {
    const renderable = object as Mesh;
    if (!renderable.material) return;
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    for (const material of materials) {
      material.clippingPlanes = clip ? [new Plane(new Vector3(0, -1, 0), 1.05)] : null;
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
function toggleNight() {
  night.value = !night.value;
  if (sun) sun.intensity = night.value ? 0.1 : 2.5;
  if (ambient) ambient.intensity = night.value ? 0.24 : 1.5;
  if (scene) scene.background = new Color(night.value ? '#172430' : '#e7ecee');
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
    else thirdPerson.useFurniture(f.position,f.rotation,target.action==='sit'?'sit':'lie',surface);
    lifeStatus.value=target.action==='sit'?'已坐下；按方向键起身继续走动。':'正在躺下休息；按方向键起身。';return;
  }
  if(target.action==='light'){
    if(f.type==='switch'){const on=allLights.some(l=>l.intensity>0);allLights.forEach(l=>l.intensity=on?0:1);}else{const light=lightsByFurnitureId[f.id];if(light)toggleLight(light);}
    lifeStatus.value='已切换灯光';return;
  }
  lifeStatus.value=useObject(g,f);
}
function setEditTool(tool:SceneEditTool,kind?:UtilityKind){editTool.value=tool;sceneEditor?.setTool(tool,kind);}
function addToScene(type:FurnitureType){
  if(!planStore.plan)return;
  const position=getSpawnPoint(planStore.plan),cmd=new AddFurnitureCommand({type,position});historyStore.execute(cmd);
  editTool.value='select';sceneEditor?.setTool('select');selectEdited({kind:'furniture',id:cmd.furnitureId});
}
function disposeGroup(group:Group|null){
  targetHighlight.clear();
  if(!group||!scene)return;scene.remove(group);const disposed=new Set<unknown>();
  group.traverse(o=>{const m=o as Mesh;if(m.geometry&&!disposed.has(m.geometry)){m.geometry.dispose();disposed.add(m.geometry);}const materials=m.material?(Array.isArray(m.material)?m.material:[m.material]):[];
    for(const mat of materials)if(!disposed.has(mat)){for(const value of Object.values(mat))if(value instanceof Texture&&!disposed.has(value)){value.dispose();disposed.add(value);}mat.dispose();disposed.add(mat);}});
}
watch(()=>planStore.plan,()=>{
  if(!scene||!planStore.plan||!furnitureGroup)return;
  restoreOcclusion();sceneEditor?.transform.detach();
  for(const group of [floorGroup,furnitureGroup,utilityGroup,roomLightsGroup])disposeGroup(group);
  const p=planStore.plan;
  floorGroup=buildFloor(p);furnitureGroup=buildFurniture(p);utilityGroup=buildUtilities(p);
  const lights=buildRoomLights(p);roomLightsGroup=lights.group;lightsByFurnitureId=lights.lightsByFurnitureId;allLights=Object.values(lightsByFurnitureId);
  scene.add(floorGroup,furnitureGroup,utilityGroup,roomLightsGroup);
  wallGroup?.traverse(o=>{if(o instanceof Mesh&&o.material instanceof MeshStandardMaterial)o.material.color.set(p.renovation?.finish.wallColor??'#f5f0e8');});
  controller?.setObstacles(buildCollider(p));thirdPerson?.setObstacles(buildCollider(p));
  sceneEditor?.refresh();updateLayers();
},{flush:'post'});
watch(()=>editorStore.selection,()=>{if(viewMode.value==='edit'){editSelection.value=editorStore.selection[0]??null;sceneEditor?.select(editSelection.value);}});
watch(()=>editorStore.showUtilities,()=>{if(viewMode.value==='edit'){utilityVisible.value=editorStore.showUtilities;updateLayers();}});
</script>

<template>
  <div class="h-full relative bg-black text-white overflow-hidden">
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" @click="(viewMode==='third'||viewMode==='walk')&&resumePlay()" />

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
        <span class="ml-4 text-gray-400">{{ fpsCounter }} fps</span>
      </div>
    </div>
    <SceneEditorPanel v-if="viewMode==='edit'" :selected="editSelection" :step="editStep" :tool="editTool" :notice="editNotice"
      @select="selectEdited" @add="addToScene" @tool="setEditTool" @step="editStep=$event;sceneEditor?.setStep($event)" @finish="sceneEditor?.finishRoute()" />
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
.avatar-select{background:#345258;color:#fff;border:1px solid #91aaa6;border-radius:4px;padding:3px;margin-right:8px}
.aim-crosshair{position:absolute;left:50%;top:50%;width:20px;height:20px;transform:translate(-50%,-50%);pointer-events:none;display:grid;place-items:center;border:1px solid transparent;border-radius:50%;transition:border-color .12s,box-shadow .12s}.aim-crosshair span{width:4px;height:4px;background:#fff;border-radius:50%;box-shadow:0 0 2px 1px #182e3980}.aim-crosshair.can-interact{border-color:#b8f0e2;box-shadow:0 0 3px #183c4380}.aim-crosshair.can-interact span{background:#b8f0e2}
.interaction-prompt{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:12px;background:#183c43ed;color:white;box-shadow:0 4px 20px #12343c22;pointer-events:none;font-size:14px}.interaction-prompt kbd{display:grid;place-items:center;width:34px;height:34px;background:#fff;color:#215b61;border-radius:7px;font-size:19px;font-weight:700}.interaction-prompt span{display:grid;gap:4px}.interaction-prompt small{font-size:11px;color:#b9d6d7}.life-panel button.life-selected{background:#e1f2ee;box-shadow:inset 3px 0 #287b77;padding-left:10px}
.life-panel{position:absolute;right:18px;top:80px;width:250px;background:#fffffff2;color:#3c5560;border-radius:8px;padding:16px;font-size:12px;box-shadow:0 5px 24px #26434b15}.life-panel h3{display:flex;justify-content:space-between;font-size:14px}.life-panel h3 span{font-size:11px;color:#8c9ba0}.life-panel p{line-height:1.8;margin:10px 0;color:#819099}.life-panel button{display:flex;justify-content:space-between;width:100%;padding:11px 4px;border-bottom:1px solid #e5ecee}.life-panel button:hover{background:#edf7f4}.life-panel strong{font-weight:500;color:#25777e}
.view-actions { display: flex; padding: 4px; gap: 3px; background: #ffffffed; color: #526571; border-radius: 7px; box-shadow: 0 3px 15px #1d33431a; }
.view-actions button { font-size: 12px; padding: 7px 10px; border-radius: 4px; }.view-actions button.active { background: #246f76; color: white; }.view-actions button:hover { background: #dae8e8; color: #235861; }
.view-caption { position: absolute; bottom: 24px; left: 24px; display: grid; gap: 7px; pointer-events: none; background: #ffffffea; color: #506673; padding: 16px 20px; border-radius: 6px; font-size: 12px; }.view-caption strong { color: #243f4c; font-size: 15px; }
</style>
