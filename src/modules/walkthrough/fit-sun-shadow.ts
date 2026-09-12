import { Box3, DirectionalLight, Object3D, Vector3 } from 'three';

/** Fit the fixed sun projection to apartment geometry, not the viewing camera. */
export function fitSunShadow(light: DirectionalLight, objects: Object3D[], softened=false): boolean {
  const world = new Box3();
  for (const object of objects) {
    world.union(new Box3().setFromObject(object));
    object.traverse(child => {
      if (typeof child.userData.baseYaw !== 'number') return;
      // Reserve the full door sweep before animation; do not move the shadow
      // projection each animation frame or clip an outward-opening entrance.
      const bounds = new Box3().setFromObject(child), pivot = child.getWorldPosition(new Vector3());
      if (bounds.isEmpty()) return;
      let radius = 0;
      for (const x of [bounds.min.x, bounds.max.x]) for (const z of [bounds.min.z, bounds.max.z]) {
        radius = Math.max(radius, Math.hypot(x-pivot.x,z-pivot.z));
      }
      world.expandByPoint(new Vector3(pivot.x-radius,bounds.min.y,pivot.z-radius));
      world.expandByPoint(new Vector3(pivot.x+radius,bounds.max.y,pivot.z+radius));
    });
  }
  if (world.isEmpty()) return false;
  light.updateWorldMatrix(true, false);
  light.target.updateWorldMatrix(true, false);
  light.shadow.updateMatrices(light);
  const camera = light.shadow.camera;
  const projected = new Box3();
  for (const x of [world.min.x, world.max.x]) for (const y of [world.min.y, world.max.y]) {
    for (const z of [world.min.z, world.max.z]) {
      projected.expandByPoint(new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    }
  }
  // Include a small guard band for PCF taps and small interactive movements.
  const pad = Math.max(0.25, world.getSize(new Vector3()).length() * 0.025);
  camera.left = projected.min.x - pad;
  camera.right = projected.max.x + pad;
  camera.bottom = projected.min.y - pad;
  camera.top = projected.max.y + pad;
  camera.near = Math.max(0.01, -projected.max.z - pad);
  camera.far = Math.max(camera.near + 1, -projected.min.z + pad);
  camera.updateProjectionMatrix();
  // PCF radius is measured in shadow texels, not metres. A fixed radius made
  // shadows increasingly washed out as larger plans expanded this projection.
  const texelSize=Math.max((camera.right-camera.left)/light.shadow.mapSize.x,
    (camera.top-camera.bottom)/light.shadow.mapSize.y);
  light.shadow.radius=Math.min(softened?5:3.5,(softened?0.035:0.018)/texelSize);
  light.shadow.needsUpdate = true;
  return true;
}
