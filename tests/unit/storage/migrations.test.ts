import { describe, it, expect } from 'vitest';
import { migrate } from '@/modules/storage/migrations';
import { createEmptyPlan } from '@/modules/model/defaults';

describe('migrate', () => {
  it('v1 plan 幂等通过（直接返回解析结果）', () => {
    const plan = createEmptyPlan('p1');
    const out = migrate(plan);
    expect(out.id).toBe('p1');
    expect(out.schemaVersion).toBe(1);
  });

  it('空对象抛出', () => {
    expect(() => migrate(null)).toThrow();
    expect(() => migrate('')).toThrow();
  });

  it('缺字段触发 zod 校验错误', () => {
    expect(() => migrate({ foo: 'bar' })).toThrow();
  });
});
