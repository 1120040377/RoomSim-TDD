import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import type { FurnitureType } from '@/modules/model/types';
import { addFurniture, recomputeRooms, type TemplateMeta } from '../_utils';
import { buildTopology, opening, zoneContains, type Zone } from './detailed';
import { configureServices } from './services';

const zone = (name: string, purpose: Zone['purpose'], x: number, y: number, w: number, h: number): Zone =>
  ({ name, purpose, polygon: [[x,y],[x+w,y],[x+w,y+h],[x,y+h]] });

/** A coherent scene for judging the asset collection; existing saved plans stay untouched. */
export const materialShowroom: TemplateMeta = {
  id: 'material-showroom', name: '材质样板间', area: '86㎡',
  description: '暖木 · 米色软包 · 鼠尾草绿 · 独立阳台',
  build(name) {
    const plan = createEmptyPlan(nanoid(), name);
    const zones = [
      zone('开放厨房','kitchen',0,0,400,300), zone('卫浴','bath',400,0,230,300),
      zone('卧室','bedroom',630,0,370,400), zone('客厅','living',400,400,600,400),
      zone('餐厅 / 玄关','dining',0,300,400,500), zone('过厅','hall',400,300,230,100),
      zone('阳台','balcony',1000,400,140,400),
    ];
    buildTopology(plan, zones);
    opening(plan,[0,650],false,90);
    opening(plan,[220,300],false,300,true);
    opening(plan,[400,610],false,320,true);
    opening(plan,[515,300],false,80);
    opening(plan,[515,400],false,180,true);
    opening(plan,[930,400],false,85);
    opening(plan,[1000,610],false,280,true);
    for (const point of [[0,140],[1000,180],[0,460],[700,800]] as [number,number][]) opening(plan,point,true,170);
    for (const [x,y,width] of [[1140,600,380],[1070,400,120],[1070,800,120]]) {
      const id = opening(plan,[x,y],false,width,true);
      plan.openings[id].sillHeight=15;
      plan.openings[id].height=265;
    }
    recomputeRooms(plan);
    for (const room of Object.values(plan.rooms)) {
      const x = room.polygon.reduce((n,p)=>n+p.x,0)/room.polygon.length;
      const y = room.polygon.reduce((n,p)=>n+p.y,0)/room.polygon.length;
      room.name = zones.find(z=>zoneContains(z,x,y))?.name ?? room.name;
    }
    const put = (type: FurnitureType, x: number, y: number, rotation=0, color?: string, width?: number, depth?: number) => {
      const f = plan.furniture[addFurniture(plan,type,{x,y},rotation)];
      if(color)f.color=color;
      if(width)f.size.width=width;
      if(depth)f.size.depth=depth;
      return f;
    };
    put('sofa-l',760,675,Math.PI,'#d9d0bf',285,190);
    put('rug',730,625,0,'#bcaa88',340,240);
    put('coffee-table',705,560,0,undefined,105,65);
    put('tv-cabinet',760,432,Math.PI,undefined,180,45);
    const tv=put('tv',760,428,Math.PI);tv.elevation=95;
    put('armchair',500,655,Math.PI/3,'#c7bea9');
    put('lamp-floor',945,735);put('floor-plant',945,535,0,undefined,65,65);
    put('dining-table-4',220,530,0,undefined,140,85);
    // A low woven dining rug, with room for all four chairs and a clear entrance aisle.
    put('rug',220,530,0,'#b9a17b',260,280).size.height=0.8;
    put('botanical-vase',220,530).elevation=75;
    put('dining-chair',145,530,Math.PI/2);put('dining-chair',295,530,-Math.PI/2);
    put('dining-chair',220,445,Math.PI);put('dining-chair',220,615);
    put('side-table',60,740,Math.PI/2);put('floor-plant',60,350,0,undefined,65,65);
    // Contiguous 285 cm run after the refrigerator, with real preparation space.
    put('fridge',60,47,Math.PI);
    put('stove',133,42,Math.PI,'#87917e');
    put('range-hood',133,36,Math.PI).elevation=155;
    put('kitchen-counter',213,42,Math.PI,'#87917e',90,60).size.height=90;
    put('kitchen-accessories',213,34,Math.PI).elevation=90;
    put('sink',298,42,Math.PI,'#87917e');
    put('kitchen-counter',360.5,42,Math.PI,'#87917e',45,60).size.height=90;
    for(const [x,width] of [[218,90],[313,100]]) { const cabinet=put('wall-cabinet',x,23,Math.PI,'#87917e',width);cabinet.elevation=155; }
    put('kitchen-island',245,205,0,'#aab19e',180,85);
    put('counter-stool',207,260,0);
    put('counter-stool',277,260,0);
    put('bed-double',815,145,0,'#74866a');
    put('wall-art',815,8,Math.PI,undefined,110).elevation=140;
    put('side-table',700,70,Math.PI);put('side-table',930,70,Math.PI);
    put('lamp-table',930,70).elevation=50;
    put('wardrobe-2',945,300,-Math.PI/2,'#a99b82',130,50);
    put('rug',815,170,0,'#b8aa8f',260,270);
    put('basin',445,185,Math.PI/2,'#a0ab94');
    put('toilet',460,65,Math.PI);
    put('shower',570,70,0,undefined,90,100);
    put('wall-mirror',408,185,Math.PI/2).elevation=115;
    put('floor-plant',1070,455,0,undefined,65,65);
    put('floor-plant',1070,745,0,undefined,75,75);
    put('armchair',1070,560,Math.PI/2,'#d0c6b2',70,70);
    put('side-table',1070,650,0,undefined,45,45);
    for(const [x,y,width,rotation] of [[1140,600,380,Math.PI/2],[1070,400,120,0],[1070,800,120,0]]) {
      put('railing',x,y,rotation,undefined,width).elevation=15;
    }
    for(const [x,y] of [[220,530],[730,620],[220,160],[515,170]]) put('lamp-ceiling',x,y);
    configureServices(plan,zones);
    plan.renovation!.roomFloors = {};
    for(const room of Object.values(plan.rooms)) {
      if(room.name!=='卧室') {
        plan.renovation!.roomFloors[room.id] = { floor: 'tile',
          floorColor: room.name === '卫浴' ? '#aebcb3' : room.name === '阳台' ? '#c9c1b3' : '#d8cebf' };
      }
    }
    plan.walkthrough.startPosition={x:130,y:680};
    plan.walkthrough.startYaw=Math.PI/2;
    return plan;
  },
};
