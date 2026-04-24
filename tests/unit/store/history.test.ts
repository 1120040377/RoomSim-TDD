import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePlanStore } from '@/modules/store/plan';
import { useHistoryStore } from '@/modules/store/history';
import { createEmptyPlan } from '@/modules/model/defaults';
import {
  AddFurnitureCommand,
  MoveFurnitureCommand,
  BatchCommand,
} from '@/modules/commands';

describe('historyStore', () => {
  let plan: ReturnType<typeof usePlanStore>;
  let history: ReturnType<typeof useHistoryStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    plan = usePlanStore();
    history = useHistoryStore();
    plan.loadPlan(createEmptyPlan('p1'));
  });

  it('execute 推入 undoStack 并清空 redoStack', () => {
    const cmd = new AddFurnitureCommand({ type: 'armchair', position: { x: 0, y: 0 } });
    history.execute(cmd);
    expect(history.undoStack).toHaveLength(1);
    expect(history.redoStack).toHaveLength(0);
  });

  it('undo 把栈顶推到 redoStack，再 execute 清空 redoStack', () => {
    const cmd1 = new AddFurnitureCommand({ type: 'armchair', position: { x: 0, y: 0 } });
    const cmd2 = new AddFurnitureCommand({ type: 'side-table', position: { x: 0, y: 0 } });
    history.execute(cmd1);
    history.execute(cmd2);

    history.undo();
    expect(history.undoStack).toHaveLength(1);
    expect(history.redoStack).toHaveLength(1);
    expect(Object.keys(plan.plan!.furniture)).toHaveLength(1);

    history.redo();
    expect(history.undoStack).toHaveLength(2);
    expect(history.redoStack).toHaveLength(0);
    expect(Object.keys(plan.plan!.furniture)).toHaveLength(2);

    // 新操作清空 redoStack
    history.undo();
    const cmd3 = new AddFurnitureCommand({ type: 'desk', position: { x: 0, y: 0 } });
    history.execute(cmd3);
    expect(history.redoStack).toHaveLength(0);
  });

  it('连续 MoveFurniture 被 mergeWith 合并为一个栈项', () => {
    const add = new AddFurnitureCommand({ type: 'armchair', position: { x: 0, y: 0 } });
    history.execute(add);
    const fid = add.furnitureId;

    // 连续拖动产生 5 个 Move
    for (let i = 0; i < 5; i++) {
      history.execute(
        new MoveFurnitureCommand(fid, { x: i * 10, y: 0 }, { x: (i + 1) * 10, y: 0 }),
      );
    }
    // Add + 1 个合并后的 Move
    expect(history.undoStack).toHaveLength(2);
    expect(plan.plan!.furniture[fid].position).toEqual({ x: 50, y: 0 });

    // 一次 undo 回到 Add 后的状态
    history.undo();
    expect(plan.plan!.furniture[fid].position).toEqual({ x: 0, y: 0 });
  });

  it('栈容量上限 50：第 51 个 execute 会挤掉最旧的', () => {
    for (let i = 0; i < 51; i++) {
      history.execute(
        new AddFurnitureCommand({ type: 'armchair', position: { x: i, y: i } }),
      );
    }
    expect(history.undoStack).toHaveLength(50);
  });

  it('BatchCommand: do 多条、undo 整体回滚', () => {
    const batch = new BatchCommand('TestBatch', [
      new AddFurnitureCommand({ type: 'bed-double', position: { x: 0, y: 0 } }),
      new AddFurnitureCommand({ type: 'side-table', position: { x: 100, y: 0 } }),
    ]);
    history.execute(batch);
    expect(Object.keys(plan.plan!.furniture)).toHaveLength(2);

    history.undo();
    expect(Object.keys(plan.plan!.furniture)).toHaveLength(0);
  });

  it('canUndo / canRedo 随栈变化', () => {
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);

    history.execute(new AddFurnitureCommand({ type: 'armchair', position: { x: 0, y: 0 } }));
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    history.undo();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });
});
