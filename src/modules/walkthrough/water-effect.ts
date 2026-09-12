import {
  CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  Object3D, Quaternion, Raycaster, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

interface Outlet { shower: boolean; radius: number; landingY: number; position: number[] }
interface WaterAnimation { drops: InstancedMesh; ripples: InstancedMesh; paths: Array<{ start: Vector3; end: Vector3 }>; time: number }
const animations = new WeakMap<Group, WaterAnimation>();

/** Builders record the actual nozzle before static meshes batch.
 * Raycasting the receiving shell keeps the water above its sloping inner wall. */
export function addWaterOutlet(group: Group, position: Vector3, receiver: Mesh, radius = 0.007, shower = false): void {
  receiver.updateWorldMatrix(true, false);
  const localOrigin = receiver.parent!.localToWorld(position.clone());
  const hit = new Raycaster(localOrigin, new Vector3(0, -1, 0)).intersectObject(receiver, false)[0];
  if (!hit) return;
  group.userData.waterOutlet = { shower, radius, landingY: group.worldToLocal(hit.point.clone()).y + 0.002, position: position.toArray() } satisfies Outlet;
}

export function buildWaterEffect(group: Group): Group {
  const effect = new Group(); effect.name = 'life-effect';
  const outlet = group.userData.waterOutlet as Outlet | undefined;
  if (!outlet) return effect;
  const paths: WaterAnimation['paths'] = [];
  const count = outlet.shower ? 25 : 1;
  const water = new MeshStandardMaterial({ color: '#c0dce1', roughness: 0.18, metalness: 0.05, transparent: true, opacity: outlet.shower ? 0.22 : 0.34, depthWrite: false });
  const highlight = new MeshStandardMaterial({ color: '#e1f0ef', roughness: 0.15, transparent: true, opacity: 0.50, depthWrite: false });
  const shapes = [];
  const up = new Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963229728653;
    const distance = outlet.shower ? Math.sqrt(i / count) * outlet.radius * 0.88 : 0;
    const start = new Vector3().fromArray(outlet.position).add(new Vector3(Math.cos(angle) * distance, -0.001, Math.sin(angle) * distance));
    const end = new Vector3(start.x, outlet.landingY, start.z);
    if (outlet.shower) { end.x += Math.cos(angle) * distance * 0.28; end.z += Math.sin(angle) * distance * 0.28; }
    paths.push({ start, end });
    const direction = start.clone().sub(end), length = direction.length();
    const geometry = new CylinderGeometry(outlet.shower ? 0.0014 : outlet.radius, outlet.shower ? 0.001 : outlet.radius * 0.7, length, 8, 1, true);
    geometry.applyMatrix4(new Matrix4().compose(start.clone().add(end).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(up, direction.normalize()), new Vector3(1, 1, 1)));
    shapes.push(geometry);
  }
  const merged = mergeGeometries(shapes)!; shapes.forEach(shape => shape.dispose());
  const jets = new Mesh(merged, water); jets.name = 'water-jets'; effect.add(jets);
  const drops = new InstancedMesh(new SphereGeometry(1, 8, 6), highlight, count * 5); drops.name = 'water-droplets';
  const ripples = new InstancedMesh(new TorusGeometry(1, 0.035, 5, 32), water, outlet.shower ? 6 : 3); ripples.name = 'water-ripples';
  // Animated instance bounds change; these few translucent effects are cheap
  // enough to render directly, without stale first-frame culling bounds.
  drops.frustumCulled = ripples.frustumCulled = false;
  effect.add(drops, ripples); animations.set(effect, { drops, ripples, paths, time: 0 });
  updateEffect(effect, 0);
  return effect;
}

function updateEffect(effect: Group, dt: number): void {
  const state = animations.get(effect); if (!state) return;
  state.time += dt;
  const transform = new Object3D();
  for (let i = 0; i < state.drops.count; i++) {
    const path = state.paths[i % state.paths.length];
    const travel = (state.time * 1.5 + i * 0.61803398875) % 1;
    const progress = (travel + travel * travel) * 0.5;
    transform.position.lerpVectors(path.start, path.end, progress);
    transform.scale.set(0.0018, 0.0045 + progress * 0.008, 0.0018);
    transform.updateMatrix(); state.drops.setMatrixAt(i, transform.matrix);
  }
  for (let i = 0; i < state.ripples.count; i++) {
    const path = state.paths[(i * 4) % state.paths.length];
    const progress = (state.time * 1.3 + i / state.ripples.count) % 1;
    const radius = 0.007 + progress * (state.paths.length > 1 ? 0.017 : 0.028);
    transform.position.copy(path.end); transform.position.y += 0.001 + i * 0.0001;
    transform.rotation.x = Math.PI / 2; transform.scale.setScalar(radius);
    transform.updateMatrix(); state.ripples.setMatrixAt(i, transform.matrix);
  }
  state.drops.instanceMatrix.needsUpdate = state.ripples.instanceMatrix.needsUpdate = true;
}

/** Hidden/off fixtures stay idle, so the frame cache can settle immediately. */
export function animateWater(furniture: Group, dt: number): void {
  furniture.traverseVisible(object => {
    if (object instanceof Group && animations.has(object)) updateEffect(object, Math.max(0, Math.min(dt, 0.1)));
  });
}
