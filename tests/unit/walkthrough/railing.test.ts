import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { buildRailing } from '@/modules/walkthrough/builders/furniture/railing';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';
import { buildCollider } from '@/modules/walkthrough/collision-builder';
import { createEmptyPlan } from '@/modules/model/defaults';

describe('阳台栏杆资产', () => {
  it('合并成单网格，保持尺寸与通行碰撞边界', () => {
    const f = { id: 'rail', type: 'railing' as const, position: {x:0,y:0}, rotation:0,
      size: {width:380,depth:4,height:105}, elevation:15 };
    const group = new Group(); buildRailing(group,f); batchStaticParts(group);
    expect(group.children).toHaveLength(1);
    const size = new Box3().setFromObject(group).getSize(new Vector3());
    expect(size.x).toBeCloseTo(3.8, 2); expect(size.y).toBeCloseTo(1.05, 2);
    const mesh = group.children[0] as Mesh;
    expect(mesh.geometry.getAttribute('position').count / 3).toBeLessThan(1500);
    const plan = createEmptyPlan('railing'); plan.furniture.rail=f;
    expect(buildCollider(plan)).toHaveLength(1);
    expect(buildCollider(plan)[0].halfW).toBe(190);
  });
});
