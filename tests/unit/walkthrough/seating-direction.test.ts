import { describe, expect, it } from 'vitest';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { ThirdPerson } from '@/modules/walkthrough/controls/ThirdPerson';
import { buildSofaL, buildSofa2 } from '@/modules/walkthrough/builders/furniture/livingroom';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';
import { materialShowroom } from '@/modules/templates/apartments/material-showroom';

describe('sofa seating direction', () => {
  it('faces the showroom TV, with the knees toward the open side of the sectional', () => {
    const plan = materialShowroom.build('seating');
    const sofa = Object.values(plan.furniture).find(f => f.type === 'sofa-l')!;
    const tv = Object.values(plan.furniture).find(f => f.type === 'tv')!;
    const model = new Group(); buildSofaL(model, sofa, 280); batchStaticParts(model);
    const control = new ThirdPerson(new PerspectiveCamera(), document.createElement('canvas'), []);
    control.useFurniture(sofa.position, sofa.rotation, 'sit', 45, model.userData.seatYaw ?? 0);
    const forward = new Vector3(0, 0, -1).applyQuaternion(control.avatar.group.quaternion);
    const towardTv = new Vector3(tv.position.x - sofa.position.x, 0, tv.position.y - sofa.position.y).normalize();
    expect(forward.dot(towardTv)).toBeCloseTo(1, 5);
    const hip = control.avatar.group.getObjectByName('left-hip')!;
    const knee = control.avatar.group.getObjectByName('left-knee')!;
    const legDirection = knee.getWorldPosition(new Vector3()).sub(hip.getWorldPosition(new Vector3())).normalize();
    expect(legDirection.dot(towardTv)).toBeCloseTo(1, 5);
  });

  it('composes each sofa facing with furniture rotation and restores standing position', () => {
    for (const sectional of [true, false]) for (const rotation of [0, Math.PI / 2, Math.PI, .73]) {
      const model = new Group();
      const f = { id: 'sofa', type: sectional ? 'sofa-l' as const : 'sofa-2' as const, position: { x: 120, y: 240 }, rotation, size: { width: 285, depth: 190, height: 85 } };
      (sectional ? buildSofaL : buildSofa2)(model, f, 280); batchStaticParts(model);
      model.rotation.y = -rotation;
      const control = new ThirdPerson(new PerspectiveCamera(), document.createElement('canvas'), []);
      control.setPosition({ x: 55, y: 65 });
      for (const kind of ['adult', 'child'] as const) {
        control.setKind(kind);
        control.useFurniture(f.position, f.rotation, 'sit', 45, model.userData.seatYaw ?? 0);
        const forward = new Vector3(0, 0, -1).applyQuaternion(control.avatar.group.quaternion);
        const openSide = new Vector3(0, 0, sectional ? 1 : -1).applyQuaternion(model.quaternion);
        expect(forward.dot(openSide)).toBeCloseTo(1, 5);
        control.stand(); expect(control.avatar.group.position.toArray()).toEqual([.55, 0, .65]);
      }
    }
  });
});
