import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three';
import type { Furniture } from '@/modules/model/types';
import { addRoundedBox } from './primitives';
import { fabricMaterial, rugMaterial } from './material-library';

/** Metric woven border, in the existing surface draw. No overlay / z-fighting. */
export function rugSurfaceGeometry(w: number, d: number): BufferGeometry {
  const scale = Math.min(1, Math.min(w, d) / 0.7);
  const bands = [0, 0.012, 0.023, 0.072, 0.083, 0.096].map(v => v * scale);
  const shades = [0.78, 0.96, 0.90, 0.82, 0.97, 1];
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [];
  const vertex = (x: number, y: number, shade: number) => {
    positions.push(x, y, 0); colors.push(shade, shade, shade);
    uvs.push(x + w / 2, y + d / 2);
  };
  const quad = (points: number[][], shade: number) => {
    for (const i of [0, 1, 2, 0, 2, 3]) vertex(points[i][0], points[i][1], shade);
  };
  for (let i = 0; i < bands.length - 1; i++) {
    const x = w / 2 - bands[i], y = d / 2 - bands[i];
    const nx = w / 2 - bands[i + 1], ny = d / 2 - bands[i + 1];
    quad([[-x,-y],[x,-y],[nx,-ny],[-nx,-ny]], shades[i]);
    quad([[x,-y],[x,y],[nx,ny],[nx,-ny]], shades[i]);
    quad([[x,y],[-x,y],[-nx,ny],[nx,ny]], shades[i]);
    quad([[-x,y],[-x,-y],[-nx,-ny],[-nx,ny]], shades[i]);
  }
  const x = w / 2 - bands[5], y = d / 2 - bands[5];
  quad([[-x,-y],[x,-y],[x,y],[-x,y]], 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildRug(group: Group, furniture: Furniture): void {
  const w = furniture.size.width / 100, d = furniture.size.depth / 100;
  const h = furniture.size.height / 100;
  const edge = Math.min(0.045, w * 0.08, d * 0.08);
  const color = furniture.color ?? '#bcaa88';
  const base = addRoundedBox(group, w, h, d, fabricMaterial(color, 62), 0, h / 2, 0, 0.006);
  base.castShadow = false;
  const geometry = rugSurfaceGeometry(w - edge * 2, d - edge * 2);
  const material = rugMaterial(color);
  material.vertexColors = true;
  const surface = new Mesh(geometry, material);
  surface.userData.floorContactReceiver=true;
  surface.rotation.x = -Math.PI / 2;
  // 0.2 mm was below depth precision in the apartment overview and caused
  // broad bands of the base fabric to show through this woven surface.
  surface.position.y = h + 0.002;
  surface.receiveShadow = true;
  group.add(surface);
}
