import { describe, expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { ThirdPerson } from '@/modules/walkthrough/controls/ThirdPerson';
import { getSpawnPoint } from '@/modules/walkthrough/spawn';
import { masterBedroomTemplate } from '@/modules/templates/rooms/master-bedroom';
import { buildCollider } from '@/modules/walkthrough/collision-builder';
import { circleVsOrientedBox } from '@/modules/geometry/collision';

describe('第三人称跟随', () => {
  it('idle camera transforms stay bit-identical away from the world origin',()=>{
    for(const [x,y,yaw] of [[130,680,Math.PI/2],[365.4,680,Math.PI/2],[120,455,.713]]){
      const camera=new PerspectiveCamera(70,1.5,.02,100),control=new ThirdPerson(camera,document.createElement('canvas'),[]);
      control.setPosition({x,y});control.avatar.group.rotation.y=yaw;control.attach();
      try{
        const position=camera.position.toArray(),quaternion=camera.quaternion.toArray();
        for(let i=0;i<120;i++){
          control.update(1/60);
          expect(camera.position.toArray()).toEqual(position);
          expect(camera.quaternion.toArray()).toEqual(quaternion);
        }
      }finally{control.dispose();}
    }
  });
  it('仅锁定鼠标时接收相对转向与移动，释放后立即停止输入',()=>{
    const camera=new PerspectiveCamera(70,16/9,0.02,100),canvas=document.createElement('canvas');
    const control=new ThirdPerson(camera,canvas,[]);control.attach();
    try{
      const start=camera.position.clone();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));control.update(0.1);
      expect(control.avatar.group.position.length()).toBe(0);
      Object.defineProperty(document,'pointerLockElement',{configurable:true,value:canvas});
      const move=new MouseEvent('mousemove');Object.defineProperties(move,{movementX:{value:1000},movementY:{value:0}});document.dispatchEvent(move);
      expect(camera.position.distanceTo(start)).toBeGreaterThan(0.5);
      Object.defineProperty(document,'pointerLockElement',{configurable:true,value:null});document.dispatchEvent(new Event('pointerlockchange'));
      const stopped=camera.position.clone();document.dispatchEvent(new MouseEvent('mousemove',{movementX:500,movementY:200}));
      expect(camera.position.equals(stopped)).toBe(true);
    }finally{control.dispose();Object.defineProperty(document,'pointerLockElement',{configurable:true,value:null});}
  });
  it('成人和儿童在横竖屏均为近距离肩后构图，静止不漂移',()=>{
    for(const aspect of [16/9,9/16])for(const kind of ['adult','child'] as const){
      const camera=new PerspectiveCamera(70,aspect,0.02,100);
      const control=new ThirdPerson(camera,document.createElement('canvas'),[]);control.attach();control.setKind(kind);
      try{
        const height=kind==='adult'?1.7:1.2;camera.updateMatrixWorld(true);
        const center=new Vector3(0,height*0.82,0).project(camera);
        expect((center.x+1)/2).toBeCloseTo(0.32,2);
        expect(camera.position.distanceTo(new Vector3(0,height*0.82,0))).toBeLessThan(1.2);
        expect(Math.abs(new Vector3(0,height,0).project(camera).y)).toBeLessThan(0.95);
        const start=camera.position.clone();for(let i=0;i<120;i++)control.update(1/60);
        expect(camera.position.distanceTo(start)).toBeLessThan(0.001);
      }finally{control.dispose();}
    }
  });
  it('肩后相机约1.15米，人物移动时同步平移相机', () => {
    const camera = new PerspectiveCamera(70, 16 / 9, 0.02, 100);
    const canvas=document.createElement('canvas');
    const control = new ThirdPerson(camera, canvas, []);
    control.attach();
    try {
      camera.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(control.avatar.group);
      expect(camera.position.y).toBeLessThan(bounds.max.y);
      for (const y of [1.1, bounds.max.y]) {
        const screen = new Vector3(0, y, 0).project(camera);
        expect(Math.abs(screen.x)).toBeLessThan(0.9);
        expect(Math.abs(screen.y)).toBeLessThan(0.9);
      }
      const offset = camera.position.clone().sub(control.avatar.group.position);
      expect(camera.position.distanceTo(new Vector3(0,1.394,0))).toBeCloseTo(1.15,1);
      const torso=new Vector3(0,1.394,0).project(camera);
      expect((torso.x+1)/2).toBeCloseTo(0.32,2);
      Object.defineProperty(document,'pointerLockElement',{configurable:true,value:canvas});
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      control.update(0.1);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      expect(control.avatar.group.position.length()).toBeCloseTo(0.14, 3);
      expect(camera.position.clone().sub(control.avatar.group.position).distanceTo(offset)).toBeLessThan(0.001);
      control.dispose();
      expect(camera.view?.enabled).toBe(false);
      const position = control.avatar.group.position.clone();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      control.update(0.1);
      expect(control.avatar.group.position.equals(position)).toBe(true);
    } finally { control.dispose();Object.defineProperty(document,'pointerLockElement',{configurable:true,value:null}); }
  });
  it('主卧出生点避开床和柜体，吊灯不阻挡人物移动', () => {
    const plan = masterBedroomTemplate.build('test');
    const point = getSpawnPoint(plan);
    const obstacles = buildCollider(plan);
    expect(obstacles.every(o => circleVsOrientedBox(point, 22, o).overlap === 0)).toBe(true);
    const lamp = Object.values(plan.furniture).find(f => f.type === 'lamp-ceiling')!;
    expect(obstacles.some(o => o.center.x === lamp.position.x && o.center.y === lamp.position.y && o.halfW === lamp.size.width / 2)).toBe(false);
  });
});
