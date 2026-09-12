import { expect, it } from 'vitest';
import { Box3, BoxGeometry, DirectionalLight, Group, Mesh, Vector3 } from 'three';
import { fitSunShadow } from '@/modules/walkthrough/fit-sun-shadow';

it('投影覆盖房屋与外侧家具，减少空白范围并在移动后重拟合', () => {
  const light = new DirectionalLight();light.position.set(3,10,5);
  const room=new Mesh(new BoxGeometry(10,3,8));room.position.y=1.5;
  const furniture=new Mesh(new BoxGeometry(1,1,1));furniture.position.set(6,0.5,0);
  const group=new Group();group.add(room,furniture);
  expect(fitSunShadow(light,[group])).toBe(true);
  const camera=light.shadow.camera;
  expect(camera.right-camera.left).toBeLessThan(20);
  expect(camera.top-camera.bottom).toBeLessThan(20);
  const assertInside=()=>{
    const bounds=new Box3().setFromObject(group);
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const p=new Vector3(x,y,z).project(camera);
      expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1);expect(Math.abs(p.z)).toBeLessThan(1);
    }
  };
  assertInside();furniture.position.x=9;fitSunShadow(light,[group]);assertInside();
  expect(light.shadow.mapSize.toArray()).toEqual([512,512]);
  room.geometry.dispose();furniture.geometry.dispose();
});

it('空方案不覆盖现有投影',()=>{
  const light=new DirectionalLight(),before=light.shadow.camera.projectionMatrix.clone();
  expect(fitSunShadow(light,[])).toBe(false);
  expect(light.shadow.camera.projectionMatrix.equals(before)).toBe(true);
});

it('修正采样路径使用 35 mm 过滤范围并限制为 5 纹素',()=>{
  const light=new DirectionalLight();light.position.set(3,10,5);light.shadow.mapSize.set(2048,2048);
  const room=new Mesh(new BoxGeometry(10,3,8));
  for(const scale of [1,3,.05]){
    room.scale.setScalar(scale);fitSunShadow(light,[room],true);
    const c=light.shadow.camera,texel=Math.max(c.right-c.left,c.top-c.bottom)/2048;
    expect(light.shadow.radius).toBeCloseTo(Math.min(5,.035/texel));
    expect(light.shadow.mapSize.toArray()).toEqual([2048,2048]);
  }
  room.geometry.dispose();
});

it('保持约 18 mm 过滤范围，不随户型变大而模糊掉细腿接触',()=>{
  const light=new DirectionalLight();light.position.set(3,10,5);light.shadow.mapSize.set(2048,2048);
  const room=new Mesh(new BoxGeometry(10,3,8));
  const footprint=()=>{
    const c=light.shadow.camera;
    return light.shadow.radius*Math.max((c.right-c.left)/2048,(c.top-c.bottom)/2048);
  };
  fitSunShadow(light,[room]);const initial=light.shadow.radius;
  expect(footprint()).toBeCloseTo(.018);
  room.scale.set(3,1,3);fitSunShadow(light,[room]);
  expect(light.shadow.radius).toBeLessThan(initial);expect(footprint()).toBeCloseTo(.018);
  room.scale.set(.05,.05,.05);fitSunShadow(light,[room]);
  expect(light.shadow.radius).toBeLessThanOrEqual(3.5);expect(footprint()).toBeLessThanOrEqual(.018);
  room.geometry.dispose();
});

it('外开门的完整旋转范围预留在固定投影内',()=>{
  const light=new DirectionalLight();light.position.set(3,10,5);
  const pivot=new Group();pivot.userData.baseYaw=0;
  const panel=new Mesh(new BoxGeometry(1.4,2,0.04));panel.position.x=0.7;pivot.add(panel);
  fitSunShadow(light,[pivot]);
  for(const angle of [0,Math.PI/4,Math.PI/2,-Math.PI/2]){
    pivot.rotation.y=angle;pivot.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(panel);
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const p=new Vector3(x,y,z).project(light.shadow.camera);
      expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1);expect(Math.abs(p.z)).toBeLessThan(1);
    }
  }
  panel.geometry.dispose();
});
