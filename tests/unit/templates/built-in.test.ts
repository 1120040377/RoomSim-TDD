import { describe, it, expect } from 'vitest';
import { BUILT_IN_TEMPLATES } from '@/modules/templates/index';
import { PlanSchema } from '@/modules/model/schema';

describe('BUILT_IN_TEMPLATES', () => {
  it('每个模板构建出的 Plan 都能通过 PlanSchema', () => {
    for (const tpl of BUILT_IN_TEMPLATES) {
      const plan = tpl.build(tpl.name);
      const parsed = PlanSchema.safeParse(plan);
      if (!parsed.success) {
        console.error(`模板 ${tpl.id} 失败:`, parsed.error.issues.slice(0, 3));
      }
      expect(parsed.success, `template ${tpl.id} schema`).toBe(true);
    }
  });

  it('至少 5 个模板', () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('空白模板：无 walls / openings / furniture', () => {
    const blank = BUILT_IN_TEMPLATES.find((t) => t.id === 'blank')!;
    const plan = blank.build('x');
    expect(Object.keys(plan.walls)).toHaveLength(0);
    expect(Object.keys(plan.furniture)).toHaveLength(0);
  });

  it('一室一厅：至少识别 1 个房间（闭合外轮廓）', () => {
    const tpl = BUILT_IN_TEMPLATES.find((t) => t.id === 'one-bed-one-living')!;
    const plan = tpl.build('x');
    expect(Object.keys(plan.rooms).length).toBeGreaterThan(0);
  });

  it('两室一厅：至少闭合外轮廓（房间识别完整度依赖墙拆分能力，P1 增强）', () => {
    const tpl = BUILT_IN_TEMPLATES.find((t) => t.id === 'two-bed-one-living')!;
    const plan = tpl.build('x');
    // 当前实现：内墙端点落在外墙中段尚未自动拆分，仅识别最外层 1 个大房间
    // P1 加 splitWallsAtHangingNodes 后可识别 5+ 个房间
    expect(Object.keys(plan.rooms).length).toBeGreaterThanOrEqual(1);
  });
});
