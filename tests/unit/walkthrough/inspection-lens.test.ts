import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { inspectionOffset, setInspectionLens } from '@/modules/walkthrough/inspection-lens';

it('窄视角保留目标平面构图，减弱前后比例差，退出恢复行走镜头', () => {
  const camera=new PerspectiveCamera(70,1.5,0.02,200),offset=new Vector3(0,0,5);
  const setup=(position:Vector3)=>{camera.position.copy(position);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);};
  setup(offset);
  const targetWidth=new Vector3(1,0,0).project(camera).x;
  const perspectiveRatio=new Vector3(1,0,1).project(camera).x/new Vector3(1,0,-1).project(camera).x;
  setInspectionLens(camera,true);setup(inspectionOffset(offset));
  expect(camera.fov).toBe(35);expect(new Vector3(1,0,0).project(camera).x).toBeCloseTo(targetWidth);
  expect(new Vector3(1,0,1).project(camera).x/new Vector3(1,0,-1).project(camera).x).toBeLessThan(perspectiveRatio);
  expect(offset.toArray()).toEqual([0,0,5]);
  setInspectionLens(camera,false);expect(camera.fov).toBe(70);
});
