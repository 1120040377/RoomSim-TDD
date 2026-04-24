import type { Plan } from '@/modules/model/types';
import { PlanSchema } from '@/modules/model/schema';

export const CURRENT_SCHEMA_VERSION = 1;

type Migrator = (plan: Record<string, unknown>) => Record<string, unknown>;

/** 未来 v2 → 添加 floors 等字段时在此注册 */
const migrations: Record<number, Migrator> = {
  // 2: (plan) => ({ ...plan, floors: [...] })
};

export function migrate(raw: unknown): Plan {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid plan data');
  }
  let cur = raw as Record<string, unknown>;
  while ((cur.schemaVersion as number) < CURRENT_SCHEMA_VERSION) {
    const v = cur.schemaVersion as number;
    const next = migrations[v + 1];
    if (!next) throw new Error(`No migration from v${v}`);
    cur = next(cur);
    cur.schemaVersion = v + 1;
  }
  // PlanSchema 已校验结构；Zod 推断的 FurnitureType 比 types.ts 的 union 宽（z.string()），
  // 运行时等价，这里做类型断言。
  return PlanSchema.parse(cur) as unknown as Plan;
}
