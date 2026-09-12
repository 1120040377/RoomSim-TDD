import { Group, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';
import { addRoundedBox } from './primitives';

/** Wall-mounted panel; depth includes the concealed VESA bracket, front is -Z. */
export function buildTelevision(g: Group, f: Furniture): void {
  const W = f.size.width * CM_TO_M, H = f.size.height * CM_TO_M, D = f.size.depth * CM_TO_M;
  const edge = Math.min(0.006, W * 0.008, H * 0.012);
  const chin = edge * 2.2;
  const panelDepth = Math.min(0.016, D * 0.24);
  const front = -D / 2;
  const frame = new MeshStandardMaterial({ color: '#282a2c', metalness: 0.8, roughness: 0.28 });
  const plastic = new MeshStandardMaterial({ color: '#191a1c', roughness: 0.7 });
  const dark = new MeshStandardMaterial({ color: '#08090a', roughness: 0.85 });
  const glass = new MeshPhysicalMaterial({
    color: '#080e14', roughness: 0.16, metalness: 0.12,
    clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.45,
  });
  const part = (name: string, w: number, h: number, d: number, material: MeshStandardMaterial,
    x: number, y: number, z: number, radius = 0.002) => {
    const mesh = addRoundedBox(g, w, h, d, material, x, y, z, radius);
    mesh.name = name;
    return mesh;
  };
  part('tv-panel-rim', W, H, panelDepth, frame, 0, H / 2, front + panelDepth / 2);
  // A nearly flush glass sheet leaves a narrow perimeter and a slightly deeper lower bezel.
  const screen = part('tv-screen', W - edge * 2, H - edge - chin, 0.0012,
    glass, 0, (H + chin - edge) / 2, front - 0.0002, 0.001);
  screen.userData.tvScreen = true; // Keep its identity through static mesh batching.
  screen.castShadow = false;
  const rearDepth = Math.min(0.034, D * 0.38);
  part('tv-rear-electronics', W * 0.76, H * 0.64, rearDepth, plastic,
    0, H * 0.37, front + panelDepth + rearDepth / 2, 0.009);
  // Recessed ventilation strips across the lower housing, visible from side/rear views.
  for (let i = 0; i < 20; i++) {
    part('tv-rear-vent', W * 0.021, H * 0.008, 0.0015, dark,
      (i - 9.5) * W * 0.033, H * 0.66, front + panelDepth + rearDepth);
  }
  const mountStart = front + panelDepth + rearDepth;
  const mountDepth = Math.max(0.002, D / 2 - mountStart);
  for (const x of [-W * 0.15, W * 0.15]) {
    part('tv-wall-bracket', W * 0.025, H * 0.36, mountDepth, frame,
      x, H * 0.4, mountStart + mountDepth / 2);
  }
  part('tv-sensor', W * 0.018, chin * 0.32, 0.0015, dark, 0, chin * 0.45, front - 0.0005);
  const indicator = part('tv-indicator', 0.0025, 0.0015, 0.0015,
    new MeshStandardMaterial({ color: '#b16a49', emissive: '#b14820', emissiveIntensity: 0.25 }),
    W * 0.025, chin * 0.45, front - 0.0005, 0.0004);
  indicator.userData.tvIndicator = true;
}
