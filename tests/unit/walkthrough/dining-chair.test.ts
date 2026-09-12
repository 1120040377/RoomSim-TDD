import { expect,it } from 'vitest';
import { Box3,Group,Mesh } from 'three';
import { buildDiningChair } from '@/modules/walkthrough/builders/furniture/dining';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

it('弧背餐椅保持脚底与尺寸，木件/软包合为两次绘制',()=>{
  const g=new Group();buildDiningChair(g,{id:'chair',type:'dining-chair',position:{x:0,y:0},rotation:0,size:{width:45,depth:45,height:85}},280);
  const bounds=new Box3().setFromObject(g);
  expect(bounds.min.y).toBeCloseTo(0);expect(bounds.max.y).toBeCloseTo(0.85);
  expect(bounds.max.x-bounds.min.x).toBeLessThanOrEqual(0.45);
  expect(bounds.max.z-bounds.min.z).toBeLessThanOrEqual(0.45);
  const pad=g.getObjectByName('dining-chair-pad') as Mesh;
  expect(pad.geometry.index!.count/3).toBe(384);
  const padBounds=new Box3().setFromObject(pad);
  expect(padBounds.min.y).toBeCloseTo(.85*(.48+.04));
  expect(padBounds.max.y).toBeGreaterThan(.85*(.48+.04+.055)+.004);
  batchStaticParts(g);expect(g.children).toHaveLength(2);
  let triangles=0;
  g.traverse(o=>{if(o instanceof Mesh){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;
    expect(Array.from(o.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
  }});
  expect(triangles).toBeLessThan(3500);
});
