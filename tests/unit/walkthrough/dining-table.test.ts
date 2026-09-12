import { describe,expect,it } from 'vitest';
import { Box3,Group,Mesh } from 'three';
import { buildDiningTable4,buildDiningTable6 } from '@/modules/walkthrough/builders/furniture/dining';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

describe('tapered timber dining tables',()=>{
  it.each([4,6] as const)('%i-seat table retains dimensions with two opaque batches',count=>{
    const group=new Group(),width=count===4?140:180;
    (count===4?buildDiningTable4:buildDiningTable6)(group,{
      id:'table',type:count===4?'dining-table-4':'dining-table-6',position:{x:0,y:0},rotation:0,
      size:{width,depth:85,height:75},
    },280);
    const legs=group.children.filter(o=>o.name==='dining-table-leg') as Mesh[];
    expect(legs).toHaveLength(4);
    for(const leg of legs){
      const p=leg.geometry.getAttribute('position'),top:number[]=[],bottom:number[]=[];
      for(let i=0;i<p.count;i++){
        if(p.getY(i)>.35)top.push(p.getX(i));
        if(p.getY(i)<-.35)bottom.push(p.getX(i));
      }
      expect(Math.max(...bottom)-Math.min(...bottom)).toBeLessThan(Math.max(...top)-Math.min(...top));
    }
    const aprons=group.children.filter(o=>o.name.startsWith('dining-table-apron')) as Mesh[];
    expect(aprons).toHaveLength(4);
    for(const apron of aprons){
      expect(apron.material).toBe(legs[0].material);
      const axis=apron.name.endsWith('x')?'x':'z';
      const p=apron.geometry.getAttribute('position'),n=apron.geometry.getAttribute('normal'),uv=apron.geometry.getAttribute('uv');
      for(let i=0;i<p.count;i++){
        if(Math.abs(axis==='x'?n.getX(i):n.getZ(i))>.9)continue;
        expect(uv.getY(i)).toBeCloseTo(axis==='x'?p.getX(i):p.getZ(i),6);
      }
    }
    batchStaticParts(group);expect(group.children).toHaveLength(2);
    const bounds=new Box3().setFromObject(group);
    expect(bounds.max.x-bounds.min.x).toBeCloseTo(width/100);
    expect(bounds.max.z-bounds.min.z).toBeCloseTo(.85);
    expect(bounds.min.y).toBeCloseTo(0);expect(bounds.max.y).toBeCloseTo(.75);
    let triangles=0;group.traverse(o=>{if(o instanceof Mesh)triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
    expect(triangles).toBe(1164);
  });
});
