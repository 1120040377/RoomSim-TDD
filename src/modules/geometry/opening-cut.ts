import type { Cm, Opening } from '@/modules/model/types';

export interface Slab {
  /** 沿墙方向起点（从 startNode 起） */
  startOffset: Cm;
  /** 沿墙方向长度 */
  length: Cm;
  /** 从地面起的高度 */
  bottomZ: Cm;
  /** 块体本身的高度 */
  height: Cm;
}

/**
 * 把一面带若干开洞的墙切成多个矩形 slab，供 3D WallBuilder 生成 BoxGeometry。
 *
 * 假定 openings 的 offset 是墙中线坐标。对每个开洞按 offset 排序后依次：
 *   1. 输出光板段（上一游标到当前开洞左缘）
 *   2. 输出过梁（开洞顶到天花板），若 sillHeight+height < wallHeight
 *   3. 输出窗台（地面到开洞底），若 sillHeight > 0（门的 sillHeight=0 跳过）
 *   4. 游标前进到开洞右缘
 * 最后输出剩余光板段。
 */
export function splitWallIntoSlabs(
  wallLength: Cm,
  openings: Opening[],
  wallHeight: Cm,
): Slab[] {
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  const slabs: Slab[] = [];
  let cursor = 0;

  for (const op of sorted) {
    const leftEdge = op.offset - op.width / 2;
    const rightEdge = op.offset + op.width / 2;

    if (leftEdge > cursor) {
      slabs.push({
        startOffset: cursor,
        length: leftEdge - cursor,
        bottomZ: 0,
        height: wallHeight,
      });
    }

    const topOfOpening = op.sillHeight + op.height;
    if (topOfOpening < wallHeight) {
      slabs.push({
        startOffset: leftEdge,
        length: op.width,
        bottomZ: topOfOpening,
        height: wallHeight - topOfOpening,
      });
    }

    if (op.sillHeight > 0) {
      slabs.push({
        startOffset: leftEdge,
        length: op.width,
        bottomZ: 0,
        height: op.sillHeight,
      });
    }

    cursor = rightEdge;
  }

  if (cursor < wallLength) {
    slabs.push({
      startOffset: cursor,
      length: wallLength - cursor,
      bottomZ: 0,
      height: wallHeight,
    });
  }

  return slabs;
}
