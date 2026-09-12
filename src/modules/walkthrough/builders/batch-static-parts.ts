import { Group, InstancedMesh, Mesh, type Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Build-time batching within one furniture item; never crosses an animated pivot. */
export function batchStaticParts(group: Group): void {
  const buckets = new Map<Material, Map<string, Mesh[]>>();
  for (const child of group.children) {
    if (!(child instanceof Mesh) || child instanceof InstancedMesh || Array.isArray(child.material) || child.children.length ||
      child.material.transparent || !child.visible || Object.keys(child.userData).length) continue;
    const key = `${child.castShadow}/${child.receiveShadow}/${child.renderOrder}/${child.layers.mask}`;
    let states = buckets.get(child.material);
    if (!states) { states = new Map(); buckets.set(child.material, states); }
    const meshes = states.get(key) ?? [];
    meshes.push(child); states.set(key, meshes);
  }
  for (const states of buckets.values()) for (const meshes of states.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      geometry.clearGroups();
      return geometry;
    });
    // Differing vertex layouts cannot be merged without changing the source geometry.
    const signature = (mesh: Mesh) => Object.keys(mesh.geometry.attributes).sort().join(',');
    if (meshes.some(mesh => signature(mesh) !== signature(meshes[0]))) {
      geometries.forEach(geometry => geometry.dispose()); continue;
    }
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(part => part.dispose());
    if (!geometry) continue;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const merged = new Mesh(geometry, meshes[0].material);
    merged.name = 'batched-static-parts';
    merged.castShadow = meshes[0].castShadow;
    merged.receiveShadow = meshes[0].receiveShadow;
    merged.renderOrder = meshes[0].renderOrder;
    merged.layers.mask = meshes[0].layers.mask;
    group.remove(...meshes); group.add(merged);
    // Source geometries were never uploaded: their CPU arrays become collectible.
  }
}
