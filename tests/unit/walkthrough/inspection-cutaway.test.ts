import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { InspectionCutaway, interiorWallIds } from '@/modules/walkthrough/inspection-cutaway';
import { materialShowroom } from '@/modules/templates/apartments/material-showroom';
import { buildWalls } from '@/modules/walkthrough/builders/wall-builder';

describe('方向性样板间剖切', () => {
  it('外墙和内部隔墙使用两份材质，避免为每个墙段复制材质', () => {
    const plan=materialShowroom.build('test'),interior=interiorWallIds(plan);
    expect(interior.size).toBeGreaterThan(0);
    const result=buildWalls(plan),materials=new Set();
    for(const [id,meshes] of Object.entries(result.meshesByWallId))for(const mesh of meshes){
      const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
      expect(!!material.userData.interiorPartition).toBe(interior.has(id));
      materials.add(material);
    }
    expect(materials.size).toBe(2);
  });
  it('仅切除面向相机一侧的高墙，保留背墙和矮墙', () => {
    const cut = new InspectionCutaway(), target = new Vector3();
    const removed = (x:number,y:number,z:number) => cut.planes.every(p=>p.distanceToPoint(new Vector3(x,y,z))<0);
    cut.update(new Vector3(0,5,8), target);
    expect(removed(0,2,4)).toBe(true);
    expect(removed(0,0.8,4)).toBe(false);
    expect(removed(0,2,-4)).toBe(false);
    expect(cut.capPlanes[0].distanceToPoint(new Vector3(0,1.05,4))).toBeGreaterThan(0);
    expect(cut.capPlanes[0].distanceToPoint(new Vector3(0,1.05,-4))).toBeLessThan(0);
    cut.update(new Vector3(8,5,0), target);
    expect(removed(4,2,0)).toBe(true);
    expect(removed(-4,2,0)).toBe(false);
  });
  it('相机绕新的观察目标更新，俯视退化情况下保留方向，复用平面对象', () => {
    const cut=new InspectionCutaway(), plane=cut.planes[1], target=new Vector3(3,0,4);
    cut.update(new Vector3(3,5,8),target);
    expect(plane.distanceToPoint(target)).toBeCloseTo(0);
    expect(plane.distanceToPoint(new Vector3(3,2,3))).toBeGreaterThan(0);
    cut.update(new Vector3(3,8,4),target);
    expect(cut.planes[1]).toBe(plane);
    expect(plane.normal.z).toBe(-1);
    expect(plane.distanceToPoint(target)).toBeCloseTo(0);
  });
});
