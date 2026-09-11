import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import type { Plan } from '@/modules/model/types';
import { UTILITY_CATALOG } from '@/modules/renovation/model';

export function buildUtilities(plan: Plan): Group {
  const group = new Group();
  group.name = 'utilities';
  for (const u of Object.values(plan.renovation?.utilities ?? {})) {
    const item = new Group();
    item.name = `utility-${u.id}`;
    item.userData.utilityId = u.id;
    const color = UTILITY_CATALOG[u.kind].color;
    const material = new MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.6,
      depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 });
    const pts = u.points.map(p => new Vector3(p.x * 0.01, Math.max(0.025, (p.height ?? u.height) * 0.01), p.y * 0.01));
    item.position.copy(pts[0]);
    pts.forEach(p=>p.sub(item.position));
    if (pts.length === 1) {
      const electrical = ['socket', 'switch', 'electric'].includes(u.kind);
      const plate = new Mesh(electrical ? new BoxGeometry(0.12, 0.12, 0.045) : new SphereGeometry(0.045, 12, 8), material);
      plate.position.copy(pts[0]);
      plate.rotation.y = -u.rotation;
      item.add(plate);
      if (u.kind === 'socket') {
        const holes = new MeshStandardMaterial({ color: '#253540', depthTest: false, depthWrite: false, transparent: true });
        for (const x of [-0.025, 0.025]) {
          const slot = new Mesh(new BoxGeometry(0.012, 0.035, 0.048), holes);
          slot.position.x = x;
          plate.add(slot);
        }
      }
    } else {
      for (let i = 1; i < pts.length; i++) {
        const direction = pts[i].clone().sub(pts[i - 1]);
        if (direction.length() < 0.001) continue;
        const pipe = new Mesh(new CylinderGeometry(0.014, 0.014, direction.length(), 8), material);
        pipe.position.copy(pts[i]).add(pts[i - 1]).multiplyScalar(0.5);
        pipe.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
        item.add(pipe);
      }
      for (const p of pts) {
        const elbow = new Mesh(new SphereGeometry(0.018, 8, 6), material);
        elbow.position.copy(p);
        item.add(elbow);
      }
    }
    item.traverse(object => { if (object instanceof Mesh) object.renderOrder = 20; });
    group.add(item);
  }
  return group;
}
