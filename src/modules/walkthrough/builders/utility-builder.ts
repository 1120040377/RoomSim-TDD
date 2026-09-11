import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import type { Plan } from '@/modules/model/types';
import { UTILITY_CATALOG } from '@/modules/renovation/model';
import { isWater } from '@/modules/renovation/water-network';

export function buildUtilities(plan: Plan): Group {
  const group = new Group();
  group.name = 'utilities';
  for (const u of Object.values(plan.renovation?.utilities ?? {})) {
    const item = new Group();
    item.name = `utility-${u.id}`;
    item.userData.utilityId = u.id;
    item.userData.utilityKind=u.kind;item.userData.utilityRole=u.role;
    const color = UTILITY_CATALOG[u.kind].color;
    const material = new MeshBasicMaterial({ color,
      depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 });
    const radius=u.kind==='drain'?0.032:isWater(u.kind)?0.023:0.014;
    const pts = u.points.map(p => new Vector3(p.x * 0.01, Math.max(0.025, (p.height ?? u.height) * 0.01), p.y * 0.01));
    item.position.copy(pts[0]);
    pts.forEach(p=>p.sub(item.position));
    if (pts.length === 1) {
      const electrical = ['socket', 'switch', 'electric'].includes(u.kind);
      const plate = new Mesh(electrical ? new BoxGeometry(0.12, 0.12, 0.045) : new SphereGeometry(u.role==='source'?0.11:0.06, 12, 8), material);
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
        const length=direction.length();
        const pipe = new Mesh(new CylinderGeometry(radius, radius, length, 10), material);
        pipe.position.copy(pts[i]).add(pts[i - 1]).multiplyScalar(0.5);
        pipe.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
        item.add(pipe);
        if(isWater(u.kind)){
          const border=new Mesh(new CylinderGeometry(radius*1.35,radius*1.35,length,10),new MeshBasicMaterial({color:'#183547',depthTest:false,depthWrite:false,transparent:true,opacity:0.75}));
          border.position.copy(pipe.position);border.quaternion.copy(pipe.quaternion);border.userData.pipeBorder=true;item.add(border);
          if(length>0.65&&u.generatedBy){
            const arrow=new Mesh(new ConeGeometry(radius*2.1,0.13,10),material);arrow.position.copy(pipe.position);arrow.quaternion.copy(pipe.quaternion);item.add(arrow);
          }
        }
      }
      for (const p of pts) {
        const elbow = new Mesh(new SphereGeometry(radius*1.3, 10, 8), material);
        elbow.position.copy(p);
        item.add(elbow);
      }
    }
    item.traverse(object => { if (object instanceof Mesh) object.renderOrder = object.userData.pipeBorder?19:20; });
    group.add(item);
  }
  return group;
}
