import { describe, expect, it } from 'vitest';
import { Box3,Group,Mesh } from 'three';
import { addDuvet } from '@/modules/walkthrough/builders/furniture/bedding';
import { buildBedDouble } from '@/modules/walkthrough/builders/furniture/bedroom';

describe('连续床品', () => {
  it('双人床使用两只低面数鼓面枕，枕头底部贴近床垫',()=>{
    const group=new Group();
    buildBedDouble(group,{id:'bed',type:'bed-double',position:{x:0,y:0},rotation:0,size:{width:180,depth:200,height:60}},280);
    const pillows=group.children.filter((object):object is Mesh=>object instanceof Mesh&&object.name==='bed-pillow');
    expect(pillows).toHaveLength(2);
    for(const pillow of pillows){
      const bounds=new Box3().setFromObject(pillow,true);
      expect(bounds.min.y).toBeGreaterThan(0.56);expect(bounds.min.y).toBeLessThan(0.61);
      expect(bounds.max.y-bounds.min.y).toBeGreaterThan(0.21);
      expect(bounds.min.x).toBeGreaterThan(-0.86);expect(bounds.max.x).toBeLessThan(0.86);
      expect(pillow.geometry.index!.count/3).toBeLessThan(1200);
    }
  });
  it('一张布面形成侧沿和脚沿下垂，中心高于床垫，不是实心方块', () => {
    const group = new Group(), mesh = addDuvet(group, 1.78, 1.3, 0.45, 0.9, '#879a7a');
    const positions = mesh.geometry.getAttribute('position');
    const ys = Array.from({length: positions.count}, (_,i)=>positions.getY(i));
    expect(Math.min(...ys)).toBeLessThan(0.34);
    expect(Math.max(...ys)).toBeGreaterThan(0.48);
    expect(mesh.geometry.index!.count / 3).toBe(2808);
    // The rolled hem returns underneath the original boundary by 18 mm.
    const rimLength=128,topVertexCount=31*35;
    expect(positions.getY(topVertexCount+rimLength*2)).toBeCloseTo(positions.getY(0)-.018);
    expect(positions.getX(topVertexCount+rimLength*2)).toBeCloseTo(positions.getX(0));
    expect(group.children).toHaveLength(1);
    expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
  });
  it('薄盖毯与被芯采用不同的卷边厚度，保持同一网格预算',()=>{
    const group=new Group(),duvet=addDuvet(group,1.78,.65,.6,.9,'#eee');
    const woven=addDuvet(group,1.78,.65,.6,.9,'#879a7a','throw');
    const p=woven.geometry.getAttribute('position');
    expect(woven.name).toBe('woven-bed-throw');expect(woven.geometry.index!.count).toBe(duvet.geometry.index!.count);
    expect(p.getY(31*35+128*2)).toBeCloseTo(p.getY(0)-.008);
    expect(Array.from(p.array)).not.toEqual(Array.from(duvet.geometry.getAttribute('position').array));
    expect(group.children.length).toBe(2);
  });
});
