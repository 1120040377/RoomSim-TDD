import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePlanStore } from '@/modules/store/plan';
import { createEmptyPlan } from '@/modules/model/defaults';
import {
  AddOpeningCommand,
  RemoveOpeningCommand,
  MoveOpeningCommand,
  UpdateOpeningCommand,
} from '@/modules/commands';

function snap(obj: unknown) {
  return JSON.parse(JSON.stringify(obj));
}

describe('Opening commands', () => {
  let store: ReturnType<typeof usePlanStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = usePlanStore();
    store.loadPlan(createEmptyPlan('p1'));
    // 准备一面墙
    store._addNode({ id: 'a', position: { x: 0, y: 0 } });
    store._addNode({ id: 'b', position: { x: 400, y: 0 } });
    store._addWall({ id: 'w1', startNodeId: 'a', endNodeId: 'b', thickness: 12, height: 280 });
  });

  it('AddOpeningCommand: do → undo 恢复', () => {
    const before = snap(store.plan);
    const cmd = new AddOpeningCommand({
      kind: 'door',
      wallId: 'w1',
      offset: 200,
      width: 90,
      height: 210,
      sillHeight: 0,
      hinge: 'start',
      swing: 'inside',
    });
    cmd.do();
    expect(store.plan!.openings[cmd.openingId]).toBeDefined();

    cmd.undo();
    expect(snap(store.plan)).toEqual(before);
  });

  it('RemoveOpeningCommand: do → undo 完全恢复', () => {
    const add = new AddOpeningCommand({
      kind: 'window',
      wallId: 'w1',
      offset: 200,
      width: 120,
      height: 140,
      sillHeight: 90,
    });
    add.do();
    const afterAdd = snap(store.plan);

    const rm = new RemoveOpeningCommand(add.openingId);
    rm.do();
    expect(store.plan!.openings[add.openingId]).toBeUndefined();

    rm.undo();
    expect(snap(store.plan)).toEqual(afterAdd);
  });

  it('MoveOpeningCommand: 沿墙滑动 + undo', () => {
    const add = new AddOpeningCommand({
      kind: 'door',
      wallId: 'w1',
      offset: 100,
      width: 90,
      height: 210,
      sillHeight: 0,
      hinge: 'start',
      swing: 'inside',
    });
    add.do();

    const mv = new MoveOpeningCommand(add.openingId, 100, 250);
    mv.do();
    expect(store.plan!.openings[add.openingId].offset).toBe(250);

    mv.undo();
    expect(store.plan!.openings[add.openingId].offset).toBe(100);
  });

  it('MoveOpeningCommand: mergeWith 合并', () => {
    const a = new MoveOpeningCommand('op1', 100, 150);
    const b = new MoveOpeningCommand('op1', 150, 200);
    const merged = a.mergeWith(b) as MoveOpeningCommand;
    expect(merged.fromOffset).toBe(100);
    expect(merged.toOffset).toBe(200);
  });

  it('UpdateOpeningCommand: 改尺寸 + undo', () => {
    const add = new AddOpeningCommand({
      kind: 'window',
      wallId: 'w1',
      offset: 200,
      width: 120,
      height: 140,
      sillHeight: 90,
    });
    add.do();

    const cmd = new UpdateOpeningCommand(add.openingId, { width: 80, sillHeight: 100 });
    cmd.do();
    expect(store.plan!.openings[add.openingId].width).toBe(80);
    expect(store.plan!.openings[add.openingId].sillHeight).toBe(100);

    cmd.undo();
    expect(store.plan!.openings[add.openingId].width).toBe(120);
    expect(store.plan!.openings[add.openingId].sillHeight).toBe(90);
  });
});
