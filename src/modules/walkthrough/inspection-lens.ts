import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

export const WALK_FOV = 70;
export const INSPECTION_FOV = 35;
const distanceScale = Math.tan(MathUtils.degToRad(WALK_FOV / 2)) / Math.tan(MathUtils.degToRad(INSPECTION_FOV / 2));

export function setInspectionLens(camera: PerspectiveCamera, inspecting: boolean): void {
  camera.fov = inspecting ? INSPECTION_FOV : WALK_FOV;
  camera.updateProjectionMatrix();
}

/** Preserve target-plane framing while reducing foreground/background size disparity. */
export function inspectionOffset(offset: Vector3): Vector3 {
  return offset.clone().multiplyScalar(distanceScale);
}
