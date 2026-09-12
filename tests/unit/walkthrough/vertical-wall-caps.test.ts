import { describe,it,expect } from 'vitest';
import { Plane,Vector3,type BufferAttribute } from 'three';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildWalls } from '@/modules/walkthrough/builders/wall-builder';
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { CAP_EDGE_GUARD, VerticalWallCaps } from '@/modules/walkthrough/vertical-wall-caps';

it('closes interior partitions with the same reusable cap mesh', () => {
  const material = new MeshStandardMaterial();
  material.userData.interiorPartition = true;
  const wall = new Mesh(new BoxGeometry(4, 2.8, .12), material);
  wall.position.set(2, 1.4, 0);
  const caps = new VerticalWallCaps([wall], material);
  caps.update(new Plane(new Vector3(-1,0,0),2));
  expect(caps.mesh.geometry.drawRange.count).toBe(6);
  expect(caps.mesh.geometry.boundingBox!.min.y).toBeCloseTo(1.05);
  expect(caps.mesh.geometry.boundingBox!.max.y).toBeCloseTo(2.8);
  expect(caps.mesh.geometry.boundingBox!.min.x).toBeCloseTo(2);
  expect(caps.mesh.geometry.boundingBox!.max.z-caps.mesh.geometry.boundingBox!.min.z).toBeCloseTo(.12+2*CAP_EDGE_GUARD,6);
  expect(CAP_EDGE_GUARD).toBeLessThan(.0005);
  const geometry = caps.mesh.geometry;
  caps.update(new Plane(new Vector3(-1,0,0),2), false);
  expect(geometry.drawRange.count).toBe(0);
  caps.update(new Plane(new Vector3(-1,0,0),2), true);
  expect(geometry.drawRange.count).toBe(6);
  expect(caps.mesh.geometry).toBe(geometry);
});

describe('竖向墙体封口',()=>{
  function plan(){
    const p=createEmptyPlan('test');p.nodes.a={id:'a',position:{x:0,y:0}};p.nodes.b={id:'b',position:{x:400,y:0}};
    p.walls.w={id:'w',startNodeId:'a',endNodeId:'b',thickness:12,height:280};return p;
  }
  it('沿平面封闭真实墙厚，相同视角不写缓冲，转动复用几何',()=>{
    const caps=buildWalls(plan()).verticalCaps,geometry=caps.mesh.geometry,position=geometry.getAttribute('position') as BufferAttribute;
    caps.update(new Plane(new Vector3(-1,0,0),2));
    expect(geometry.drawRange.count).toBe(6);
    expect(geometry.boundingBox!.min.y).toBeCloseTo(1.05);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(2.8);
    expect(geometry.boundingBox!.max.z-geometry.boundingBox!.min.z).toBeCloseTo(0.12);
    const version=position.version;
    caps.update(new Plane(new Vector3(-1,0,0),2));expect(position.version).toBe(version);
    caps.update(new Plane(new Vector3(-1,0,0),3));
    expect(caps.mesh.geometry).toBe(geometry);expect(geometry.getAttribute('position')).toBe(position);
    expect(position.version).toBeGreaterThan(version);expect(geometry.boundingBox!.min.x).toBeCloseTo(3);
    caps.update(new Plane(new Vector3(-1,0,0),8));expect(geometry.drawRange.count).toBe(0);
  });
  it('切过门洞仅封过梁，不把门口填成实墙',()=>{
    const p=plan();p.openings.d={id:'d',kind:'door',wallId:'w',offset:200,width:90,height:210,sillHeight:0,hinge:'start',swing:'inside'};
    const caps=buildWalls(p).verticalCaps;caps.update(new Plane(new Vector3(-1,0,0),2));
    expect(caps.mesh.geometry.drawRange.count).toBe(6);
    expect(caps.mesh.geometry.boundingBox!.min.y).toBeCloseTo(2.1);
  });
});
