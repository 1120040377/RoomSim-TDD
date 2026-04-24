import { describe, it, expect } from 'vitest';
import { splitWallIntoSlabs, type Slab } from '@/modules/geometry/opening-cut';
import type { Opening } from '@/modules/model/types';

const WALL_LEN = 400;
const WALL_H = 280;

function door(offset: number, width = 90, height = 210): Opening {
  return {
    id: `d-${offset}`,
    kind: 'door',
    wallId: 'w1',
    offset,
    width,
    height,
    sillHeight: 0,
    hinge: 'start',
    swing: 'inside',
  };
}

function window_(offset: number, width = 120, height = 140, sill = 90): Opening {
  return {
    id: `w-${offset}`,
    kind: 'window',
    wallId: 'w1',
    offset,
    width,
    height,
    sillHeight: sill,
  };
}

/** 按起点偏移排序方便断言 */
function sortByOffset(s: Slab[]): Slab[] {
  return [...s].sort((a, b) => a.startOffset - b.startOffset || a.bottomZ - b.bottomZ);
}

describe('splitWallIntoSlabs', () => {
  it('无开洞 → 单个完整 slab 覆盖整面墙', () => {
    const slabs = splitWallIntoSlabs(WALL_LEN, [], WALL_H);
    expect(slabs).toHaveLength(1);
    expect(slabs[0]).toEqual({
      startOffset: 0,
      length: WALL_LEN,
      bottomZ: 0,
      height: WALL_H,
    });
  });

  it('门在中间 → 3 段：左墙 + 过梁 + 右墙', () => {
    const d = door(200, 90, 210);
    const slabs = sortByOffset(splitWallIntoSlabs(WALL_LEN, [d], WALL_H));

    expect(slabs).toHaveLength(3);
    // 左墙 [0, 155)
    expect(slabs[0]).toEqual({ startOffset: 0, length: 155, bottomZ: 0, height: WALL_H });
    // 过梁 [155, 245) 高度从 210 到 280
    expect(slabs[1]).toEqual({ startOffset: 155, length: 90, bottomZ: 210, height: 70 });
    // 右墙 [245, 400)
    expect(slabs[2]).toEqual({ startOffset: 245, length: 155, bottomZ: 0, height: WALL_H });
  });

  it('窗在中间 → 4 段：左 + 过梁 + 窗台下 + 右', () => {
    const w = window_(200, 120, 140, 90);
    const slabs = splitWallIntoSlabs(WALL_LEN, [w], WALL_H);

    expect(slabs).toHaveLength(4);
    // 分别找 4 种 slab
    const leftWall = slabs.find((s) => s.startOffset === 0 && s.bottomZ === 0)!;
    const rightWall = slabs.find((s) => s.startOffset === 260 && s.bottomZ === 0)!;
    const lintel = slabs.find((s) => s.startOffset === 140 && s.bottomZ === 230)!;
    const sill = slabs.find((s) => s.startOffset === 140 && s.bottomZ === 0 && s.length === 120)!;

    expect(leftWall).toEqual({ startOffset: 0, length: 140, bottomZ: 0, height: WALL_H });
    expect(rightWall).toEqual({ startOffset: 260, length: 140, bottomZ: 0, height: WALL_H });
    expect(lintel).toEqual({ startOffset: 140, length: 120, bottomZ: 230, height: 50 });
    expect(sill).toEqual({ startOffset: 140, length: 120, bottomZ: 0, height: 90 });
  });

  it('门紧贴起点（leftEdge=0）→ 只有过梁 + 右墙', () => {
    const d = door(45, 90, 210); // 45 - 90/2 = 0
    const slabs = sortByOffset(splitWallIntoSlabs(WALL_LEN, [d], WALL_H));

    expect(slabs).toHaveLength(2);
    expect(slabs[0]).toEqual({ startOffset: 0, length: 90, bottomZ: 210, height: 70 });
    expect(slabs[1]).toEqual({ startOffset: 90, length: 310, bottomZ: 0, height: WALL_H });
  });

  it('门紧贴终点（rightEdge=wallLen）→ 只有左墙 + 过梁', () => {
    const d = door(WALL_LEN - 45, 90, 210);
    const slabs = sortByOffset(splitWallIntoSlabs(WALL_LEN, [d], WALL_H));

    expect(slabs).toHaveLength(2);
    expect(slabs[0]).toEqual({ startOffset: 0, length: 310, bottomZ: 0, height: WALL_H });
    expect(slabs[1]).toEqual({ startOffset: 310, length: 90, bottomZ: 210, height: 70 });
  });

  it('开洞顶到天花板（sillHeight + height >= wallHeight）→ 不生成过梁', () => {
    const d = door(200, 90, 280); // 门顶到天花板
    const slabs = sortByOffset(splitWallIntoSlabs(WALL_LEN, [d], WALL_H));

    expect(slabs).toHaveLength(2);
    expect(slabs[0]).toEqual({ startOffset: 0, length: 155, bottomZ: 0, height: WALL_H });
    expect(slabs[1]).toEqual({ startOffset: 245, length: 155, bottomZ: 0, height: WALL_H });
  });

  it('门 + 窗相邻 → 切段顺序正确', () => {
    const d = door(100, 90, 210); // [55, 145)
    const w = window_(250, 80, 140, 90); // [210, 290)
    const slabs = splitWallIntoSlabs(WALL_LEN, [d, w], WALL_H);

    // 期望段：
    // A: [0, 55) 墙
    // B: [55, 145) 门过梁
    // C: [145, 210) 墙
    // D: [210, 290) 窗过梁
    // E: [210, 290) 窗台下
    // F: [290, 400) 墙
    expect(slabs.length).toBe(6);

    const offsets = slabs.map((s) => s.startOffset).sort((a, b) => a - b);
    expect(new Set(offsets).has(0)).toBe(true);
    expect(new Set(offsets).has(55)).toBe(true);
    expect(new Set(offsets).has(145)).toBe(true);
    expect(new Set(offsets).has(210)).toBe(true);
    expect(new Set(offsets).has(290)).toBe(true);
  });

  it('开洞顺序打乱传入仍按 offset 处理', () => {
    const d = door(100, 90, 210);
    const w = window_(250, 80, 140, 90);
    const a = splitWallIntoSlabs(WALL_LEN, [d, w], WALL_H);
    const b = splitWallIntoSlabs(WALL_LEN, [w, d], WALL_H);
    expect(sortByOffset(a)).toEqual(sortByOffset(b));
  });
});
