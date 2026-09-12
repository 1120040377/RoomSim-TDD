import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Mesh } from 'three';
import { materialShowroom } from '@/modules/templates/apartments/material-showroom';
import { buildFloor } from '@/modules/walkthrough/builders/floor-builder';
import { PlanSchema } from '@/modules/model/schema';
import { usePlanStore } from '@/modules/store/plan';
import { useHistoryStore } from '@/modules/store/history';
import { updateRoomFloor } from '@/modules/commands/renovation';

beforeEach(() => { setActivePinia(createPinia()); });
describe('分房间铺装', () => {
  it('保存往返保留覆盖，相同铺装共用材质，湿区与客厅不同', () => {
    const plan = materialShowroom.build('floor');
    const parsed = PlanSchema.parse(JSON.parse(JSON.stringify(plan)));
    expect(parsed.renovation!.roomFloors).toEqual(plan.renovation!.roomFloors);
    const floor = buildFloor(plan);
    const find = (name: string) => {
      const id = Object.values(plan.rooms).find(r=>r.name===name)!.id;
      return (floor.children.find(o=>o.userData.roomId===id) as Mesh).material;
    };
    expect(find('客厅')===find('卧室')).toBe(false);
    expect(find('开放厨房')===find('客厅')).toBe(true);
    expect(find('餐厅 / 玄关')===find('客厅')).toBe(true);
    expect(find('过厅')===find('客厅')).toBe(true);
    expect(find('阳台')===find('客厅')).toBe(false);
    expect(find('卫浴')===find('客厅')).toBe(false);
  });
  it('房间修改和恢复默认支持撤销，不更改全屋与其他房间', () => {
    const store = usePlanStore(), history = useHistoryStore();
    store.loadPlan(materialShowroom.build('undo'));
    const id = Object.values(store.plan!.rooms).find(r=>r.name==='卫浴')!.id;
    const original = JSON.stringify(store.plan!.renovation);
    store._recomputeRooms();
    expect(store.plan!.rooms[id].name).toBe('卫浴');
    expect(JSON.stringify(store.plan!.renovation)).toBe(original);
    history.execute(updateRoomFloor(id, { floorColor: '#123456' }));
    expect(store.plan!.renovation!.roomFloors![id].floorColor).toBe('#123456');
    history.execute(updateRoomFloor(id, null));
    expect(store.plan!.renovation!.roomFloors![id]).toBeUndefined();
    history.undo(); history.undo();
    expect(JSON.stringify(store.plan!.renovation)).toBe(original);
  });
});
