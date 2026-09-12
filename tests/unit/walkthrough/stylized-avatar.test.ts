import { describe, it, expect } from 'vitest';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { buildStylizedAvatar } from '@/modules/walkthrough/builders/stylized-avatar';
import { buildPersonSitting, buildPersonStanding } from '@/modules/walkthrough/builders/furniture/person';
import type { Furniture } from '@/modules/model/types';

describe('adult and child avatar shapes', () => {
  it('keeps seated hands in front and preserves the pose across idle updates and age changes', () => {
    const avatar = buildStylizedAvatar();
    avatar.pose('sit');
    for (const kind of ['adult', 'child'] as const) {
      avatar.setKind(kind);
      avatar.animate(2, false);
      avatar.group.updateMatrixWorld(true);
      const hand = avatar.group.getObjectByName('hand')!.getWorldPosition(new Vector3());
      const elbow = avatar.group.getObjectByName('left-elbow')!.getWorldPosition(new Vector3());
      expect(hand.z).toBeLessThan(elbow.z - 0.1);
      expect(avatar.group.getObjectByName('left-hip')!.rotation.x).toBeCloseTo(Math.PI / 2);
    }
    avatar.pose('stand');
    expect(new Box3().setFromObject(avatar.group).min.y).toBeCloseTo(0, 5);
  });

  it('places catalog figures on the floor at the requested adult height', () => {
    for (const gender of [0, 1, 2, 99]) {
      const furniture: Furniture = { id: 'person', type: 'person-standing', position: { x: 0, y: 0 }, rotation: 0, size: { width: 45, depth: 30, height: 185 }, runtimeState: { gender } };
      const standing = new Group(); buildPersonStanding(standing, furniture, 280);
      const bounds = new Box3().setFromObject(standing);
      expect(bounds.min.y).toBeCloseTo(0, 5);
      expect(bounds.max.y).toBeCloseTo(1.85, 5);
      const seated = new Group(); buildPersonSitting(seated, { ...furniture, size: { ...furniture.size, height: 90 } }, 280);
      const seatBounds = new Box3().setFromObject(seated);
      expect(seatBounds.min.y).toBeCloseTo(0, 5);
      expect(seatBounds.max.y).toBeGreaterThan(1.1);
      expect(seatBounds.max.y).toBeLessThan(1.4);
    }
  });

  it('keeps real height and placement when switching a posed, scaled avatar', () => {
    const avatar=buildStylizedAvatar();
    for(const kind of ['adult','child','adult'] as const){
      avatar.pose('stand');avatar.setKind(kind);
      avatar.group.position.set(3,0,5);avatar.group.scale.setScalar(kind==='child'?1.2/1.7:1);
      const bounds=new Box3().setFromObject(avatar.group);
      expect(bounds.min.y).toBeCloseTo(0,5);
      expect(bounds.max.y).toBeCloseTo(kind==='child'?1.2:1.7,5);
      expect(avatar.group.position.toArray()).toEqual([3,0,5]);
      avatar.pose('sit');avatar.pose('lie');avatar.pose('stand');avatar.animate(1,true);avatar.animate(0,false);
      avatar.group.traverse(o=>{if(o instanceof Mesh){
        for(const value of o.geometry.attributes.position.array)expect(Number.isFinite(value)).toBe(true);
      }});
      expect(new Box3().setFromObject(avatar.group).min.y).toBeCloseTo(0,5);
    }
  });
});
