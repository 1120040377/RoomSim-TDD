import { describe,expect,it } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial } from 'three';
import { buildLampFloor } from '@/modules/walkthrough/builders/furniture/lighting';
import { buildRoomLights } from '@/modules/walkthrough/lights';
import { createEmptyPlan } from '@/modules/model/defaults';
import { batchStaticParts } from '@/modules/walkthrough/builders/batch-static-parts';

describe('open linen floor lamp',()=>{
  it('fits its footprint, keeps the shade open and synchronizes light surfaces',()=>{
    const furniture={id:'lamp',type:'lamp-floor' as const,position:{x:0,y:0},rotation:0,size:{width:36,depth:36,height:160}};
    const group=new Group();buildLampFloor(group,furniture,280);
    const shade=group.getObjectByName('floor-lamp-shade') as Mesh;
    const positions=shade.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++)expect(Math.hypot(positions.getX(i),positions.getZ(i))).toBeGreaterThan(.10);
    const material=shade.material as MeshStandardMaterial;
    group.userData.setLightOn(false);expect(material.emissiveIntensity).toBe(0);
    group.userData.setLightOn(true);expect(material.emissiveIntensity).toBe(.22);
    batchStaticParts(group);expect(group.children).toHaveLength(3);
    const bounds=new Box3().setFromObject(group);expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.y).toBeCloseTo(1.6);expect(bounds.max.x-bounds.min.x).toBeCloseTo(.36);
    let triangles=0;group.traverse(o=>{if(o instanceof Mesh)triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
    expect(triangles).toBeLessThan(700);
    const plan=createEmptyPlan('lamp');plan.furniture.lamp=furniture;
    const light=buildRoomLights(plan).lightsByFurnitureId.lamp;
    expect(light.position.y).toBeCloseTo(1.6*.89);expect(light.castShadow).toBe(false);
  });
});
