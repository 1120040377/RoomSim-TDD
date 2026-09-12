import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial } from 'three';
import { buildTailoredSectional, throwPillow, upholsteredArmrest, cushion } from '@/modules/walkthrough/builders/furniture/upholstery';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

describe('软包转角沙发', () => {
  it('程序化坐垫保持平滑接缝法线和既有1452面预算',()=>{
    for(const h of [.012,.16,.34]){
      const material=new MeshStandardMaterial(),mesh=cushion(new Group(),.7,h,.65,material,0,0,0,3);
      const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal');
      expect(p.count/3).toBe(1452);
      const normals=new Map<string,number[]>();let duplicates=0;
      for(let i=0;i<p.count;i++){
        const values=[n.getX(i),n.getY(i),n.getZ(i)];
        expect(Math.hypot(...values)).toBeCloseTo(1,5);
        const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(7)).join(',');
        const prior=normals.get(key);
        if(prior){duplicates++;values.forEach((value,axis)=>expect(value).toBeCloseTo(prior[axis],4));}
        else normals.set(key,values);
      }
      expect(duplicates).toBeGreaterThan(0);
      mesh.geometry.dispose();material.dispose();
    }
  });
  it('软包扶手保持300面预算、尺寸和跨UV接缝的连续单位法线',()=>{
    for(const [w,h,d] of [[.145,.51,.91],[.10,.35,.65],[.2,.55,1.2]]){
      const material=new MeshStandardMaterial(),arm=upholsteredArmrest(new Group(),w,h,d,material,0,0,0);
      const geometry=arm.geometry,p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
      expect((geometry.index?.count??p.count)/3).toBe(300);
      expect(arm.material).toBe(material);
      const shared=new Map<string,number[]>();let duplicates=0;
      for(let i=0;i<p.count;i++){
        expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(w/2+1e-6);
        expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(h/2+1e-6);
        expect(Math.abs(p.getZ(i))).toBeLessThanOrEqual(d/2+1e-6);
        const normal=[n.getX(i),n.getY(i),n.getZ(i)];
        expect(Math.hypot(...normal)).toBeCloseTo(1,5);
        const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(6)).join(',');
        const previous=shared.get(key);
        if(previous){duplicates++;normal.forEach((value,axis)=>expect(value).toBeCloseTo(previous[axis],4));}
        else shared.set(key,normal);
      }
      expect(duplicates).toBeGreaterThan(0);
      geometry.dispose();material.dispose();
    }
  });
  it('抱枕中央鼓起而边缘收紧，封闭网格保持低面数',()=>{
    const group=new Group(),material=new MeshStandardMaterial();
    const pillow=throwPillow(group,0.43,0.37,0.18,material,0,0,0,1);
    const positions=pillow.geometry.getAttribute('position');
    let center=0,edge=0;
    for(let i=0;i<positions.count;i++){
      const x=Math.abs(positions.getX(i)),y=Math.abs(positions.getY(i)),z=Math.abs(positions.getZ(i));
      if(x<0.03&&y<0.03)center=Math.max(center,z);
      if(x>0.21)edge=Math.max(edge,z);
    }
    expect(center).toBeGreaterThan(0.085);expect(edge).toBeLessThan(0.025);
    expect(pillow.geometry.index!.count/3).toBeLessThan(1200);
    pillow.geometry.dispose();material.dispose();
  });
  it('保留指定尺寸内的 L 型轮廓，并将静态零件合并为有限材质批次', () => {
    const group = new Group();
    buildTailoredSectional(group, 2.5, 1.8, 0.85, '#d9d0bf');
    const shells=group.children.filter(o=>o.name==='sectional-shell');
    expect(shells).toHaveLength(2);
    for(const shell of shells)expect(new Box3().setFromObject(shell,true).max.y).toBeCloseTo(.85*.81);
    const pillows=group.children.filter(o=>o.name==='sectional-pillow');
    expect(pillows).toHaveLength(2);
    for(const pillow of pillows)expect(new Box3().setFromObject(pillow,true).min.y).toBeCloseTo(0.85*0.51-0.01);
    const before = group.children.length;
    const blanket=group.getObjectByName('sofa-throw-blanket') as Mesh;
    expect(blanket.geometry.index!.count/3).toBe(1672);
    const clothBounds=new Box3().setFromObject(blanket);
    expect(clothBounds.min.y).toBeGreaterThan(.015);
    expect(clothBounds.max.y).toBeLessThan(.85*.51+.03);
    expect(Array.from(blanket.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
    batchStaticParts(group);
    const bounds = new Box3().setFromObject(group);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-1.251);
    expect(bounds.max.x).toBeLessThanOrEqual(1.251);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-0.901);
    expect(bounds.max.z).toBeLessThanOrEqual(0.901);
    expect(bounds.max.y).toBeLessThanOrEqual(0.851);
    expect(group.children.length).toBeLessThan(before);
    expect(group.children.length).toBeLessThanOrEqual(5);
    for (const child of group.children) {
      expect(child).toBeInstanceOf(Mesh);
      const mesh = child as Mesh;
      expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
    }
  });
});
