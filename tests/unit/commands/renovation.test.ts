import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createEmptyPlan } from '@/modules/model/defaults';
import { usePlanStore } from '@/modules/store/plan';
import { useHistoryStore } from '@/modules/store/history';
import { putUtility, removeUtility, updateFinish } from '@/modules/commands/renovation';
import { PlanSchema } from '@/modules/model/schema';
import { migrate } from '@/modules/storage/migrations';
import { routeTo, routeLength } from '@/modules/renovation/model';
import type { Utility } from '@/modules/model/types';

const socket: Utility = { id: 's1', kind: 'socket', label: '床头插座', points: [{ x: 120, y: 80 }], height: 30, rotation: 0, circuit: '卧室' };
beforeEach(() => { setActivePinia(createPinia()); usePlanStore().loadPlan(createEmptyPlan('p1')); });

describe('装修方案与历史记录', () => {
  it('旧方案无需装修字段即可读取，新增、编辑、删除可逐步撤销和重做', () => {
    const plan = usePlanStore();
    const history = useHistoryStore();
    expect(migrate(plan.plan).renovation).toBeUndefined();
    history.execute(putUtility(socket));
    history.execute(putUtility({ ...socket, height: 110 }));
    history.execute(removeUtility(socket.id));
    expect(plan.plan?.renovation?.utilities).toEqual({});
    history.undo();
    expect(plan.plan?.renovation?.utilities.s1.height).toBe(110);
    history.undo();
    expect(plan.plan?.renovation?.utilities.s1).toEqual(socket);
    history.undo();
    expect(plan.plan?.renovation).toBeUndefined();
    history.redo(); history.redo();
    expect(plan.plan?.renovation?.utilities.s1.height).toBe(110);
  });
  it('材质命令不覆盖水电数据；JSON 往返保留所有新增字段', () => {
    const plan = usePlanStore(); const history = useHistoryStore();
    history.execute(putUtility(socket));
    history.execute(updateFinish({ floor: 'tile', wallColor: '#eeffee' }));
    const restored = migrate(JSON.parse(JSON.stringify(plan.plan)));
    expect(restored.renovation?.utilities.s1).toEqual(socket);
    expect(restored.renovation?.finish.floor).toBe('tile');
    history.undo();
    expect(plan.plan?.renovation?.finish.floor).toBe('wood');
    expect(plan.plan?.renovation?.utilities.s1).toEqual(socket);
  });
  it('拒绝空路径、非法高度和非法颜色，避免导入后渲染崩溃', () => {
    useHistoryStore().execute(putUtility(socket));
    const plan = usePlanStore().plan!;
    for (const patch of [{ points: [] }, { height: -1 }, { height: Infinity }, { kind: 'unknown' }]) {
      expect(PlanSchema.safeParse({ ...plan, renovation: { ...plan.renovation,
        utilities: { s1: { ...socket, ...patch } } } }).success).toBe(false);
    }
  });
});
describe('直角布线', () => {
  it('支持反向、负坐标和两种转弯顺序，长度计算一致', () => {
    const a = { x: 200, y: 100 }, b = { x: -100, y: -50 };
    const horizontal = routeTo(a, b);
    const vertical = routeTo(a, b, true);
    expect(horizontal).toEqual([a, { x: -100, y: 100 }, b]);
    expect(vertical).toEqual([a, { x: 200, y: -50 }, b]);
    expect(routeLength({ ...socket, points: horizontal })).toBe(450);
    expect(routeLength({ ...socket, points: vertical })).toBe(450);
    expect(routeTo(a, a)).toEqual([a]);
    expect(routeTo(a, { x: 200, y: 50 })).toHaveLength(2);
  });
});
