import { Plane, Vector3 } from 'three';
import type { Plan } from '@/modules/model/types';
export const CUTAWAY_HEIGHT = 1.05;

export function interiorWallIds(plan: Plan): Set<string> {
  const counts=new Map<string,number>();
  for(const room of Object.values(plan.rooms)) for(const id of new Set(room.wallIds)) counts.set(id,(counts.get(id)??0)+1);
  return new Set([...counts].filter(([,count])=>count>1).map(([id])=>id));
}

/** Remove only the intersection of "above sill" and "in front of target".
 * Shared mutable planes avoid per-wall materials and per-frame allocations.
 */
export class InspectionCutaway {
  readonly planes = [new Plane(new Vector3(0, -1, 0), CUTAWAY_HEIGHT), new Plane(new Vector3(0, 0, -1), 0)];
  readonly capPlanes = [new Plane(new Vector3(0,0,1),0)];

  update(cameraPosition: Vector3, target: Vector3): void {
    const x = target.x - cameraPosition.x, z = target.z - cameraPosition.z;
    const length = Math.hypot(x, z);
    // At a directly overhead view retain the last unambiguous front direction.
    if (length > 0.001) this.planes[1].normal.set(x / length, 0, z / length);
    this.planes[1].constant = -this.planes[1].normal.dot(target);
    this.capPlanes[0].copy(this.planes[1]).negate();
  }
}
