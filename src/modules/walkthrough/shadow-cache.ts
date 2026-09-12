import { InstancedMesh, Mesh, SkinnedMesh, type DirectionalLight, type MeshStandardMaterial, type Scene } from 'three';
import {ValueSnapshot} from './value-snapshot';

/** Cache the sun's depth map, never the colour image or interactive scene. */
export class ShadowCache {
  private snapshot=new ValueSnapshot();

  invalidate(): void { this.snapshot.invalidate(); }

  needsUpdate(scene: Scene, sun: DirectionalLight): boolean {
    scene.updateMatrixWorld(true);
    const values=this.snapshot.begin();values.push(
      ...sun.matrixWorld.elements, ...sun.target.matrixWorld.elements,
      ...sun.shadow.camera.projectionMatrix.elements, sun.visible, sun.castShadow,
      sun.shadow.mapSize.x, sun.shadow.mapSize.y,
    );
    let dynamic = false;
    scene.traverseVisible(object => {
      if (!(object instanceof Mesh) || !object.castShadow) return;
      // Deformation/custom depth shaders cannot be inferred from object matrices.
      if (object instanceof SkinnedMesh || object.morphTargetInfluences?.length || object.customDepthMaterial) dynamic = true;
      values.push(object.id, object.geometry.id, ...object.matrixWorld.elements,
        object.geometry.getAttribute('position')?.version ?? 0);
      if (object instanceof InstancedMesh) values.push(object.count, object.instanceMatrix.version);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        values.push(material.id, material.version, material.visible, material.side,
          material.shadowSide ?? -1, material.clipShadows, material.clipIntersection, material.alphaTest);
        const surface = material as MeshStandardMaterial;
        if (material.alphaTest > 0) values.push(surface.map?.version ?? -1, surface.alphaMap?.version ?? -1);
        if (surface.displacementMap) dynamic = true;
        if (material.clipShadows) for (const plane of material.clippingPlanes ?? []) {
          values.push(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
        }
      }
    });
    return this.snapshot.commit()||dynamic;
  }
}
