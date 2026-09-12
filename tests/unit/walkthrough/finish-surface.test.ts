import { expect, it } from 'vitest';
import { floorMaterial, wallMaterial } from '@/modules/walkthrough/builders/finish-material';
import { defaultRenovation } from '@/modules/renovation/model';
import { createEmptyPlan } from '@/modules/model/defaults';
import { buildWalls } from '@/modules/walkthrough/builders/wall-builder';

it('哑光墙面和缎面砖降低环境反射，保持颜色与物理砖尺度',()=>{
  const floor=floorMaterial({...defaultRenovation().finish,floor:'tile',floorColor:'#d8cebf'});
  const wall=wallMaterial('#efe8dc');
  expect(floor.roughness).toBe(0.62);expect(floor.envMapIntensity).toBe(0.4);
  expect(floor.map!.repeat.x).toBeCloseTo(1/0.6);expect(floor.color.getHexString()).toBe('d8cebf');
  expect(wall.roughness).toBe(0.91);expect(wall.envMapIntensity).toBe(0.45);
  expect(wall.color.getHexString()).toBe('efe8dc');
  floor.map!.dispose();floor.bumpMap!.dispose();floor.dispose();wall.bumpMap!.dispose();wall.dispose();
});

it('开门后各墙片正反面的 UV 都沿整面墙按米连续',()=>{
  const plan=createEmptyPlan('uv');
  plan.nodes={a:{id:'a',position:{x:0,y:0}},b:{id:'b',position:{x:400,y:0}}};
  plan.walls={w:{id:'w',startNodeId:'a',endNodeId:'b',height:280,thickness:12}};
  plan.openings={d:{id:'d',kind:'door',wallId:'w',offset:200,width:90,height:210,sillHeight:0,hinge:'start',swing:'inside'}};
  const walls=buildWalls(plan).meshesByWallId.w;
  expect(walls).toHaveLength(3);
  for(const mesh of walls){
    const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv');
    for(let i=0;i<p.count;i++)if(Math.abs(n.getZ(i))>0.5){
      expect(uv.getX(i)).toBeCloseTo(p.getX(i)+mesh.position.x);
      expect(uv.getY(i)).toBeCloseTo(p.getY(i)+mesh.position.y);
    }
  }
});
