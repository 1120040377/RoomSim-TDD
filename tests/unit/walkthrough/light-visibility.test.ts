import { expect, it } from 'vitest';
import { PointLight } from 'three';
import { buildRoomLights, setLightEnabled, toggleLight } from '@/modules/walkthrough/lights';
import { materialShowroom } from '@/modules/templates/apartments/material-showroom';

it('关闭光源退出可见遍历，再开灯复用同一个光源及位置', () => {
  const light = new PointLight(); light.position.set(1, 2, 3);
  const id = light.id;
  for (let i = 0; i < 20; i++) {
    expect(setLightEnabled(light, false)).toBe(false);
    expect(light.visible).toBe(false); expect(light.intensity).toBe(0);
    expect(toggleLight(light)).toBe(true);
    expect(light.visible).toBe(true); expect(light.intensity).toBe(1);
  }
  expect(light.id).toBe(id); expect(light.position.toArray()).toEqual([1, 2, 3]);
});

it('方案内关闭的灯在首次构建就不参与光照，其他灯保留', () => {
  const plan = materialShowroom.build('lights');
  const lamp = Object.values(plan.furniture).find(f => f.type === 'lamp-table')!;
  lamp.runtimeState = { ...lamp.runtimeState, on: false };
  const { group, lightsByFurnitureId } = buildRoomLights(plan);
  const visible: PointLight[] = [];
  group.traverseVisible(o => { if (o instanceof PointLight) visible.push(o); });
  expect(group.children).toHaveLength(6); expect(visible).toHaveLength(5);
  expect(lightsByFurnitureId[lamp.id].visible).toBe(false);
  expect(toggleLight(lightsByFurnitureId[lamp.id])).toBe(true);
});
