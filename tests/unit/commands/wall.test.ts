import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePlanStore } from '@/modules/store/plan';
import { createEmptyPlan } from '@/modules/model/defaults';
import {
  AddWallCommand,
  RemoveWallCommand,
  MoveWallNodeCommand,
  UpdateWallCommand,
  SplitWallCommand,
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

  describe('SplitWallCommand', () => {
    function addWall(sx: number, sy: number, ex: number, ey: number) {
      const cmd = new AddWallCommand({
        start: { x: sx, y: sy },
        end: { x: ex, y: ey },
        thickness: 12,
        height: 280,
      });
      cmd.do();
      return cmd;
    }

    it('do 后：原墙消失，生成 2 段子墙 + 1 个切割节点', () => {
      const add = addWall(0, 0, 400, 0);
      const before = snap(store.plan);

      const cmd = new SplitWallCommand({ wallId: add.wallId, splitPoint: { x: 200, y: 0 } });
      cmd.do();

      expect(store.plan!.walls[add.wallId]).toBeUndefined();
      expect(Object.keys(store.plan!.walls)).toHaveLength(2);
      expect(Object.keys(store.plan!.nodes)).toHaveLength(3); // A, B, splitNode

      // undo 完整恢复
      cmd.undo();
      expect(snap(store.plan)).toEqual(before);
    });

    it('两段子墙连接正确：wallA end = wallB start = splitNodeId', () => {
      const add = addWall(0, 0, 400, 0);
      const cmd = new SplitWallCommand({ wallId: add.wallId, splitPoint: { x: 100, y: 0 } });
      cmd.do();

      const walls = Object.values(store.plan!.walls);
      const wallA = walls.find((w) => w.startNodeId === add.usedNodeIds.start);
      const wallB = walls.find((w) => w.endNodeId === add.usedNodeIds.end);

      expect(wallA).toBeDefined();
      expect(wallB).toBeDefined();
      expect(wallA!.endNodeId).toBe(cmd.createdNodeId);
      expect(wallB!.startNodeId).toBe(cmd.createdNodeId);
    });

    it('子墙继承原墙的 thickness 和 height', () => {
      const add = new AddWallCommand({
        start: { x: 0, y: 0 },
        end: { x: 400, y: 0 },
        thickness: 24,
        height: 300,
      });
      add.do();

      const cmd = new SplitWallCommand({ wallId: add.wallId, splitPoint: { x: 200, y: 0 } });
      cmd.do();

      for (const w of Object.values(store.plan!.walls)) {
        expect(w.thickness).toBe(24);
        expect(w.height).toBe(300);
      }
    });

    it('切割节点位置与 splitPoint 一致', () => {
      const add = addWall(0, 0, 400, 0);
      const cmd = new SplitWallCommand({ wallId: add.wallId, splitPoint: { x: 150, y: 0 } });
      cmd.do();

      const node = store.plan!.nodes[cmd.createdNodeId];
      expect(node).toBeDefined();
      expect(node.position).toEqual({ x: 150, y: 0 });
    });

    it('do/undo/redo 三次循环后结构一致', () => {
      const add = addWall(0, 0, 400, 0);
      const cmd = new SplitWallCommand({ wallId: add.wallId, splitPoint: { x: 200, y: 0 } });

      cmd.do();
      const afterDo = snap(store.plan);
      cmd.undo();
      cmd.do();
      expect(snap(store.plan)).toEqual(afterDo);
    });

    it('原墙有门窗时：偏移 < splitOffset 归属 wallA，offset 不变', () => {
      const add = addWall(0, 0, 400, 0);
      store._addOpening({
        id: 'op1',
        kind: 'door',
        wallId: add.wallId,
        offset: 80,   // 在切割点 200 之前
        width: 90,
        height: 210,
        sillHeight: 0,
        hinge: 'start',
        swing: 'inside',
      });

      const cmd = new SplitWallCommand({ wallId: add.wallId, splitPoint: { x: 200, y: 0 } });
      cmd.do();

      const op = store.plan!.openings['op1'];
      expect(op).toBeDefined();
      expect(op.offset).toBe(80);

      const walls = Object.values(store.plan!.walls);
      const wallA = walls.find((w) => w.startNodeId === add.usedNodeIds.start)!;
      expect(op.wallId).toBe(wallA.id);
    });

    it('原墙有门窗时：偏移 >= splitOffset 归属 wallB，offset 减去 splitOffset', () => {
      const add = addWall(0, 0, 400, 0);
      store._addOpening({
        id: 'op2',
        kind: 'window',
        wallId: add.wallId,
        offset: 300,   // 在切割点 200 之后
        width: 120,
        height: 100,
        sillHeight: 80,
      });

      const cmd = new SplitWallCommand({ wallId: add.wallId, splitPoint: { x: 200, y: 0 } });
      cmd.do();

      const op = store.plan!.openings['op2'];
      expect(op).toBeDefined();
      expect(op.offset).toBe(100);   // 300 - 200

      const walls = Object.values(store.plan!.walls);
      const wallB = walls.find((w) => w.endNodeId === add.usedNodeIds.end)!;
      expect(op.wallId).toBe(wallB.id);
    });

    it('带门窗的切割 undo 后开洞完整恢复', () => {
      const add = addWall(0, 0, 400, 0);
      store._addOpening({
        id: 'op3',
        kind: 'door',
        wallId: add.wallId,
        offset: 100,
        width: 90,
        height: 210,
        sillHeight: 0,
        hinge: 'start',
        swing: 'inside',
      });
      const before = snap(store.plan);

      const cmd = new SplitWallCommand({ wallId: add.wallId, splitPoint: { x: 200, y: 0 } });
      cmd.do();
      cmd.undo();

      expect(snap(store.plan)).toEqual(before);
    });

    it('wallId 不存在时 do 不抛错', () => {
      const cmd = new SplitWallCommand({ wallId: 'nonexistent', splitPoint: { x: 0, y: 0 } });
      expect(() => cmd.do()).not.toThrow();
    });
  });
});
