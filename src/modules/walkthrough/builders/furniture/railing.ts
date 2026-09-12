import { Group } from 'three';
import type { Furniture } from '@/modules/model/types';
import { paintedMaterial } from './material-library';
import { addCylinder } from './primitives';

/** Visual railing asset, not a structural or building-code specification. */
export function buildRailing(group: Group, furniture: Furniture): void {
  const w = furniture.size.width / 100, h = furniture.size.height / 100;
  const radius = Math.min(0.018, furniture.size.depth / 200);
  const material = paintedMaterial(furniture.color ?? '#304f49', 0.48);
  const rail = (y: number) => {
    const mesh = addCylinder(group, radius, radius, w - radius * 2, material, 0, y, 0, 10);
    mesh.rotation.z = Math.PI / 2;
  };
  rail(h - radius); rail(0.12); rail(h * 0.84);
  for (const x of [-w / 2 + radius, w / 2 - radius]) {
    addCylinder(group, radius, radius, h, material, x, h / 2, 0, 10);
  }
  const count = Math.max(1, Math.ceil((w - radius * 4) / 0.105));
  for (let i = 1; i < count; i++) {
    const x = -w / 2 + radius * 2 + (w - radius * 4) * i / count;
    addCylinder(group, radius * 0.42, radius * 0.42, h - 0.12 - radius, material,
      x, (h - radius + 0.12) / 2, 0, 6);
  }
}
