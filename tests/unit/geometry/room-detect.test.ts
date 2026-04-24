import { describe, it, expect } from 'vitest';
import { detectRooms } from '@/modules/geometry/room-detect';
import { polygonArea } from '@/modules/geometry/vec2';
import type { Wall, WallNode } from '@/modules/model/types';

interface Graph {
  nodes: Record<string, WallNode>;
  walls: Record<string, Wall>;
}

function node(id: string, x: number, y: number): WallNode {
  return { id, position: { x, y } };
}

function wall(id: string, startNodeId: string, endNodeId: string): Wall {
  return { id, startNodeId, endNodeId, thickness: 12, height: 280 };
}

function g(...parts: Array<WallNode | Wall>): Graph {
  const nodes: Record<string, WallNode> = {};
  const walls: Record<string, Wall> = {};
  for (const p of parts) {
    if ('position' in p) nodes[p.id] = p;
    else walls[p.id] = p;
  }
  return { nodes, walls };
}

describe('detectRooms', () => {
  it('空图 → 无房间', () => {
    const out = detectRooms({}, {});
    expect(out).toEqual([]);
  });

  it('单墙 → 无房间', () => {
    const graph = g(node('a', 0, 0), node('b', 100, 0), wall('w1', 'a', 'b'));
    const out = detectRooms(graph.nodes, graph.walls);
    expect(out).toEqual([]);
  });

  it('矩形 4 墙 → 1 个房间，面积正确', () => {
    //  a───b
    //  │   │
    //  d───c
    const graph = g(
      node('a', 0, 0),
      node('b', 400, 0),
      node('c', 400, 300),
      node('d', 0, 300),
      wall('w1', 'a', 'b'),
      wall('w2', 'b', 'c'),
      wall('w3', 'c', 'd'),
      wall('w4', 'd', 'a'),
    );
    const out = detectRooms(graph.nodes, graph.walls);
    expect(out).toHaveLength(1);
    expect(polygonArea(out[0].polygon)).toBeCloseTo(400 * 300, 2);
    expect(out[0].wallIds.sort()).toEqual(['w1', 'w2', 'w3', 'w4']);
  });

  it('两个矩形共享一面墙 → 2 个房间', () => {
    //  a───b───e
    //  │   │   │
    //  d───c───f
    const graph = g(
      node('a', 0, 0),
      node('b', 400, 0),
      node('c', 400, 300),
      node('d', 0, 300),
      node('e', 800, 0),
      node('f', 800, 300),
      wall('w1', 'a', 'b'),
      wall('w2', 'b', 'c'),
      wall('w3', 'c', 'd'),
      wall('w4', 'd', 'a'),
      wall('w5', 'b', 'e'),
      wall('w6', 'e', 'f'),
      wall('w7', 'f', 'c'),
    );
    const out = detectRooms(graph.nodes, graph.walls);
    expect(out).toHaveLength(2);
    const areas = out.map((r) => polygonArea(r.polygon)).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(400 * 300, 2);
    expect(areas[1]).toBeCloseTo(400 * 300, 2);
  });

  it('两个不连通矩形 → 2 个房间', () => {
    const graph = g(
      node('a', 0, 0),
      node('b', 200, 0),
      node('c', 200, 200),
      node('d', 0, 200),
      wall('w1', 'a', 'b'),
      wall('w2', 'b', 'c'),
      wall('w3', 'c', 'd'),
      wall('w4', 'd', 'a'),
      //
      node('e', 500, 0),
      node('f', 800, 0),
      node('h', 800, 300),
      node('i', 500, 300),
      wall('w5', 'e', 'f'),
      wall('w6', 'f', 'h'),
      wall('w7', 'h', 'i'),
      wall('w8', 'i', 'e'),
    );
    const out = detectRooms(graph.nodes, graph.walls);
    expect(out).toHaveLength(2);
  });

  it('不闭合的路径（3 面墙 U 型）→ 0 房间', () => {
    const graph = g(
      node('a', 0, 0),
      node('b', 0, 300),
      node('c', 400, 300),
      node('d', 400, 0),
      wall('w1', 'a', 'b'),
      wall('w2', 'b', 'c'),
      wall('w3', 'c', 'd'),
    );
    const out = detectRooms(graph.nodes, graph.walls);
    expect(out).toEqual([]);
  });

  it('L 形：6 面墙 → 1 个 L 形房间', () => {
    //  a──────b
    //  │      │
    //  │   f──c
    //  │   │
    //  e───d
    const graph = g(
      node('a', 0, 0),
      node('b', 400, 0),
      node('c', 400, 200),
      node('f', 200, 200),
      node('d', 200, 400),
      node('e', 0, 400),
      wall('w1', 'a', 'b'),
      wall('w2', 'b', 'c'),
      wall('w3', 'c', 'f'),
      wall('w4', 'f', 'd'),
      wall('w5', 'd', 'e'),
      wall('w6', 'e', 'a'),
    );
    const out = detectRooms(graph.nodes, graph.walls);
    expect(out).toHaveLength(1);
    // L 型面积 = 400*200 + 200*200 = 80000 + 40000 = 120000
    expect(polygonArea(out[0].polygon)).toBeCloseTo(120000, 2);
    expect(out[0].wallIds.length).toBe(6);
  });
});
