import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePlanStore } from '@/modules/store/plan';
import { createEmptyPlan } from '@/modules/model/defaults';
import {
  AddFurnitureCommand,
  RemoveFurnitureCommand,
  MoveFurnitureCommand,
  RotateFurnitureCommand,
  UpdateFurnitureCommand,
  DuplicateFurnitureCommand,
} from '@/modules/commands';

function snap(obj: unknown) {
  return JSON.parse(JSON.stringify(obj));
}

describe('Furniture commands', () => {
  let store: ReturnType<typeof usePlanStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = usePlanStore();
    store.loadPlan(createEmptyPlan('p1'));
  });

  it('AddFurnitureCommand: 从 catalog 取尺寸', () => {
    const cmd = new AddFurnitureCommand({
      type: 'bed-double',
      position: { x: 100, y: 200 },
    });
    cmd.do();
    const f = store.plan!.furniture[cmd.furnitureId];
    expect(f.type).toBe('bed-double');
    expect(f.size).toEqual({ width: 150, depth: 200, height: 45 });
    expect(f.position).toEqual({ x: 100, y: 200 });
    expect(f.rotation).toBe(0);
  });

  it('AddFurnitureCommand: undo 恢复', () => {
    const before = snap(store.plan);
    const cmd = new AddFurnitureCommand({ type: 'sofa-3', position: { x: 0, y: 0 } });
    cmd.do();
    cmd.undo();
    expect(snap(store.plan)).toEqual(before);
  });

  it('RemoveFurnitureCommand: do + undo', () => {
    const add = new AddFurnitureCommand({ type: 'armchair', position: { x: 0, y: 0 } });
    add.do();
    const afterAdd = snap(store.plan);

    const rm = new RemoveFurnitureCommand(add.furnitureId);
    rm.do();
    expect(store.plan!.furniture[add.furnitureId]).toBeUndefined();

    rm.undo();
    expect(snap(store.plan)).toEqual(afterAdd);
  });

  it('MoveFurnitureCommand: 移动 + undo + 合并', () => {
    const add = new AddFurnitureCommand({ type: 'armchair', position: { x: 0, y: 0 } });
    add.do();

    const mv1 = new MoveFurnitureCommand(add.furnitureId, { x: 0, y: 0 }, { x: 10, y: 5 });
    mv1.do();
    expect(store.plan!.furniture[add.furnitureId].position).toEqual({ x: 10, y: 5 });

    const mv2 = new MoveFurnitureCommand(
      add.furnitureId,
      { x: 10, y: 5 },
      { x: 30, y: 40 },
    );
    const merged = mv1.mergeWith(mv2) as MoveFurnitureCommand;
    expect(merged.from).toEqual({ x: 0, y: 0 });
    expect(merged.to).toEqual({ x: 30, y: 40 });

    merged.do();
    expect(store.plan!.furniture[add.furnitureId].position).toEqual({ x: 30, y: 40 });
    merged.undo();
    expect(store.plan!.furniture[add.furnitureId].position).toEqual({ x: 0, y: 0 });
  });

  it('RotateFurnitureCommand + mergeWith', () => {
    const add = new AddFurnitureCommand({ type: 'armchair', position: { x: 0, y: 0 } });
    add.do();

    const r1 = new RotateFurnitureCommand(add.furnitureId, 0, Math.PI / 4);
    r1.do();
    expect(store.plan!.furniture[add.furnitureId].rotation).toBeCloseTo(Math.PI / 4);

    const r2 = new RotateFurnitureCommand(add.furnitureId, Math.PI / 4, Math.PI / 2);
    const merged = r1.mergeWith(r2) as RotateFurnitureCommand;
    expect(merged.fromRotation).toBe(0);
    expect(merged.toRotation).toBe(Math.PI / 2);
  });

  it('UpdateFurnitureCommand: 改颜色 + undo', () => {
    const add = new AddFurnitureCommand({
      type: 'armchair',
      position: { x: 0, y: 0 },
      color: '#111',
    });
    add.do();

    const cmd = new UpdateFurnitureCommand(add.furnitureId, { color: '#abc' });
    cmd.do();
    expect(store.plan!.furniture[add.furnitureId].color).toBe('#abc');
    cmd.undo();
    expect(store.plan!.furniture[add.furnitureId].color).toBe('#111');
  });

  it('DuplicateFurnitureCommand: 生成副本偏移 20cm + undo', () => {
    const add = new AddFurnitureCommand({
      type: 'side-table',
      position: { x: 100, y: 100 },
    });
    add.do();

    const dup = new DuplicateFurnitureCommand(add.furnitureId);
    dup.do();
    expect(store.plan!.furniture[dup.newId]).toBeDefined();
    expect(store.plan!.furniture[dup.newId].position).toEqual({ x: 120, y: 120 });
    expect(store.plan!.furniture[dup.newId].type).toBe('side-table');

    dup.undo();
    expect(store.plan!.furniture[dup.newId]).toBeUndefined();
  });
});
