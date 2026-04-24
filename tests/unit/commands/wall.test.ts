import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePlanStore } from '@/modules/store/plan';
import { createEmptyPlan } from '@/modules/model/defaults';
import {
  AddWallCommand,
  RemoveWallCommand,
  MoveWallNodeCommand,
  UpdateWallCommand,
} from '@/modules/commands';

function snap(obj: unknown) {
  // 结构深拷贝用于对比
  return JSON.parse(JSON.stringify(obj));
}

describe('Wall commands — do/undo 等价', () => {
  let store: ReturnType<typeof usePlanStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = usePlanStore();
    store.loadPlan(createEmptyPlan('p1'));
  });

  describe('AddWallCommand', () => {
    it('do 后墙存在，undo 后完全恢复', () => {
      const before = snap(store.plan);
      const cmd = new AddWallCommand({
        start: { x: 0, y: 0 },
        end: { x: 400, y: 0 },
        thickness: 12,
        height: 280,
      });

      cmd.do();
      expect(Object.keys(store.plan!.walls)).toHaveLength(1);
      expect(Object.keys(store.plan!.nodes)).toHaveLength(2);

      cmd.undo();
      expect(snap(store.plan)).toEqual(before);
    });

    it('do/undo/redo 三次循环后结构仍一致', () => {
      const cmd = new AddWallCommand({
        start: { x: 0, y: 0 },
        end: { x: 400, y: 0 },
        thickness: 12,
        height: 280,
      });
      cmd.do();
      const afterDo = snap(store.plan);
      cmd.undo();
      cmd.do(); // redo
      expect(snap(store.plan)).toEqual(afterDo);
    });

    it('复用已有节点时不新建节点', () => {
      store._addNode({ id: 'n1', position: { x: 0, y: 0 } });
      const beforeNodeCount = Object.keys(store.plan!.nodes).length;

      const cmd = new AddWallCommand({
        start: { x: 0, y: 0 },
        end: { x: 400, y: 0 },
        startExistingNodeId: 'n1',
        thickness: 12,
        height: 280,
      });
      cmd.do();
      expect(Object.keys(store.plan!.nodes)).toHaveLength(beforeNodeCount + 1);
      expect(store.plan!.walls[cmd.wallId].startNodeId).toBe('n1');

      cmd.undo();
      expect(store.plan!.nodes['n1']).toBeDefined(); // 不删掉原本存在的节点
    });

    it('4 墙形成闭合矩形 → 生成 1 个 room', () => {
      // 模拟"Wall Tool"行为：画出第一段后，后续段通过 snap 复用端点
      const w1 = new AddWallCommand({ start: { x: 0, y: 0 }, end: { x: 400, y: 0 }, thickness: 12, height: 280 });
      w1.do();
      const nA = w1.usedNodeIds.start!;
      const nB = w1.usedNodeIds.end!;

      const w2 = new AddWallCommand({
        start: { x: 400, y: 0 }, end: { x: 400, y: 300 },
        startExistingNodeId: nB,
        thickness: 12, height: 280,
      });
      w2.do();
      const nC = w2.usedNodeIds.end!;

      const w3 = new AddWallCommand({
        start: { x: 400, y: 300 }, end: { x: 0, y: 300 },
        startExistingNodeId: nC,
        thickness: 12, height: 280,
      });
      w3.do();
      const nD = w3.usedNodeIds.end!;

      const w4 = new AddWallCommand({
        start: { x: 0, y: 300 }, end: { x: 0, y: 0 },
        startExistingNodeId: nD,
        endExistingNodeId: nA,
        thickness: 12, height: 280,
      });
      w4.do();

      expect(Object.keys(store.plan!.rooms)).toHaveLength(1);
      // undo w4 → 不再闭合 → 房间消失
      w4.undo();
      expect(Object.keys(store.plan!.rooms)).toHaveLength(0);
    });
  });

  describe('RemoveWallCommand', () => {
    it('删除墙 + undo 恢复', () => {
      const addCmd = new AddWallCommand({
        start: { x: 0, y: 0 },
        end: { x: 400, y: 0 },
        thickness: 12,
        height: 280,
      });
      addCmd.do();
      const afterAdd = snap(store.plan);

      const removeCmd = new RemoveWallCommand(addCmd.wallId);
      removeCmd.do();
      expect(store.plan!.walls[addCmd.wallId]).toBeUndefined();
      expect(Object.keys(store.plan!.nodes)).toHaveLength(0); // 孤立节点也被清理

      removeCmd.undo();
      expect(snap(store.plan)).toEqual(afterAdd);
    });

    it('带附着开洞的墙被删 → 开洞也被删；undo 恢复所有', () => {
      const addWall = new AddWallCommand({
        start: { x: 0, y: 0 },
        end: { x: 400, y: 0 },
        thickness: 12,
        height: 280,
      });
      addWall.do();
      store._addOpening({
        id: 'op1',
        kind: 'door',
        wallId: addWall.wallId,
        offset: 200,
        width: 90,
        height: 210,
        sillHeight: 0,
        hinge: 'start',
        swing: 'inside',
      });
      const afterOp = snap(store.plan);

      const cmd = new RemoveWallCommand(addWall.wallId);
      cmd.do();
      expect(store.plan!.openings['op1']).toBeUndefined();

      cmd.undo();
      expect(snap(store.plan)).toEqual(afterOp);
    });

    it('删除共享节点墙：仍被其他墙引用的节点不删', () => {
      const w1 = new AddWallCommand({
        start: { x: 0, y: 0 },
        end: { x: 400, y: 0 },
        thickness: 12,
        height: 280,
      });
      w1.do();
      const endNode = w1.createdEndNodeId!;
      const w2 = new AddWallCommand({
        start: { x: 400, y: 0 },
        end: { x: 400, y: 300 },
        startExistingNodeId: endNode,
        thickness: 12,
        height: 280,
      });
      w2.do();

      const rm = new RemoveWallCommand(w1.wallId);
      rm.do();
      expect(store.plan!.nodes[endNode]).toBeDefined(); // w2 还引用它
    });
  });

  describe('MoveWallNodeCommand', () => {
    it('移动节点 + undo', () => {
      store._addNode({ id: 'n1', position: { x: 0, y: 0 } });
      const before = snap(store.plan);

      const cmd = new MoveWallNodeCommand('n1', { x: 0, y: 0 }, { x: 50, y: 100 });
      cmd.do();
      expect(store.plan!.nodes['n1'].position).toEqual({ x: 50, y: 100 });

      cmd.undo();
      expect(snap(store.plan).nodes['n1']).toEqual(before.nodes['n1']);
    });

    it('mergeWith：连续同 node 的 Move 合并为一个', () => {
      const a = new MoveWallNodeCommand('n1', { x: 0, y: 0 }, { x: 10, y: 0 });
      const b = new MoveWallNodeCommand('n1', { x: 10, y: 0 }, { x: 30, y: 0 });
      const merged = a.mergeWith(b) as MoveWallNodeCommand;
      expect(merged).toBeInstanceOf(MoveWallNodeCommand);
      expect(merged.from).toEqual({ x: 0, y: 0 });
      expect(merged.to).toEqual({ x: 30, y: 0 });
    });

    it('mergeWith：不同节点不合并', () => {
      const a = new MoveWallNodeCommand('n1', { x: 0, y: 0 }, { x: 10, y: 0 });
      const b = new MoveWallNodeCommand('n2', { x: 10, y: 0 }, { x: 30, y: 0 });
      expect(a.mergeWith(b)).toBeNull();
    });
  });

  describe('UpdateWallCommand', () => {
    it('改 thickness + undo 恢复', () => {
      const add = new AddWallCommand({
        start: { x: 0, y: 0 },
        end: { x: 400, y: 0 },
        thickness: 12,
        height: 280,
      });
      add.do();

      const cmd = new UpdateWallCommand(add.wallId, { thickness: 20 });
      cmd.do();
      expect(store.plan!.walls[add.wallId].thickness).toBe(20);

      cmd.undo();
      expect(store.plan!.walls[add.wallId].thickness).toBe(12);
    });
  });
});
