import { describe,it,expect } from 'vitest';
import { PerspectiveCamera,Vector3 } from 'three';
import { DesktopFPS } from '@/modules/walkthrough/controls/DesktopFPS';
describe('第一人称生活姿态',()=>{
  it('坐下和躺下改变视点，起身与退出恢复原站立位置',()=>{
    const camera=new PerspectiveCamera();camera.position.set(2,1.598,3);
    const controller=new DesktopFPS(camera,[],document.createElement('canvas'),170);
    controller.useFurniture(4,5,1.215);expect(camera.position.equals(new Vector3(4,1.215,5))).toBe(true);
    controller.useFurniture(5,5,0.7);expect(camera.position.y).toBe(0.7);
    controller.stand();expect(camera.position.equals(new Vector3(2,1.598,3))).toBe(true);
    controller.useFurniture(4,5,1.215);controller.dispose();expect(camera.position.equals(new Vector3(2,1.598,3))).toBe(true);
  });
});
