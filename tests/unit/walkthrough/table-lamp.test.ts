import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial } from 'three';
import { buildTableLamp } from '@/modules/walkthrough/builders/furniture/table-lamp';
import { buildRoomLights, toggleLight } from '@/modules/walkthrough/lights';
import { materialShowroom } from '@/modules/templates/apartments/material-showroom';

describe('床头陶瓷台灯',()=>{
  it('开放布罩与陶瓷底座，尺寸/面数有界，关闭后停止自发光',()=>{
    const g=new Group();buildTableLamp(g,{id:'lamp',type:'lamp-table',position:{x:0,y:0},rotation:0,size:{width:32,depth:32,height:45}});
    const bounds=new Box3().setFromObject(g);
    expect(bounds.min.y).toBeCloseTo(0);expect(bounds.max.y).toBeCloseTo(0.45);
    expect(bounds.max.x-bounds.min.x).toBeCloseTo(0.32);
    let triangles=0;const emissive:MeshStandardMaterial[]=[];
    g.traverse(o=>{if(o instanceof Mesh){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;
      const mat=o.material as MeshStandardMaterial;if(mat.emissiveIntensity>0&&mat.emissive.getHex()!==0)emissive.push(mat);
    }});
    expect(triangles).toBeLessThan(1200);expect(emissive).toHaveLength(2);
    g.userData.setLightOn(false);expect(emissive.every(m=>m.emissiveIntensity===0)).toBe(true);
    g.userData.setLightOn(true);expect(emissive.every(m=>m.emissiveIntensity>0)).toBe(true);
  });
  it('替换卧室吊灯，保持样板间六个光源；发光点随台灯离地高度',()=>{
    const plan=materialShowroom.build('lamp');const lamp=Object.values(plan.furniture).find(f=>f.type==='lamp-table')!;
    const result=buildRoomLights(plan),light=result.lightsByFurnitureId[lamp.id];
    expect(result.group.children).toHaveLength(6);
    expect(light.position.y).toBeCloseTo(0.50+0.45*0.70);
    expect(light.distance).toBe(3);expect(light.castShadow).toBe(false);
    expect(toggleLight(light)).toBe(false);expect(toggleLight(light)).toBe(true);
  });
});
