import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function radiusFor(width: number, height: number, depth: number, preferred = 0.035): number {
  return Math.max(0.001, Math.min(preferred, width / 4, height / 4, depth / 4));
}

/** A small bevel catches light and removes the CAD/toy silhouette of raw BoxGeometry. */
export function roundedBoxGeometry(width: number, height: number, depth: number, radius = 0.035, segments = 2): RoundedBoxGeometry {
  const geometry = new RoundedBoxGeometry(width, height, depth, segments, radiusFor(width, height, depth, radius));
  const uv = geometry.getAttribute('uv');
  // Each face uses metres, so changing cabinet dimensions does not stretch its grain.
  const faceSizes = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
  for (const [face, group] of geometry.groups.entries()) {
    const [u, v] = faceSizes[face];
    for (let i = group.start; i < group.start + group.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  }
  return geometry;
}

export function addRoundedBox(
  group: Group,
  width: number,
  height: number,
  depth: number,
  material: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  radius?: number,
  segments = 2,
): Mesh {
  const mesh = new Mesh(roundedBoxGeometry(width, height, depth, radius, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function addCylinder(
  group: Group,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  segments = 24,
): Mesh {
  const mesh = new Mesh(new CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
