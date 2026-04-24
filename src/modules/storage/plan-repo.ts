import { watch } from 'vue';
import { debounce } from 'lodash-es';
import { db, type PlanRecord } from './db';
import { migrate } from './migrations';
import type { Plan } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

export const planRepo = {
  async list(): Promise<PlanRecord[]> {
    return db.plans.orderBy('updatedAt').reverse().toArray();
  },

  async get(id: string): Promise<Plan | null> {
    const r = await db.plans.get(id);
    if (!r) return null;
    return migrate(r.data);
  },

  async save(plan: Plan): Promise<void> {
    const record: PlanRecord = {
      id: plan.id,
      name: plan.name,
      updatedAt: Date.now(),
      data: plan,
    };
    await db.plans.put(record);
  },

  async remove(id: string): Promise<void> {
    await db.plans.delete(id);
  },

  async rename(id: string, name: string): Promise<void> {
    const r = await db.plans.get(id);
    if (!r) return;
    r.data.name = name;
    r.name = name;
    r.updatedAt = Date.now();
    await db.plans.put(r);
  },
};

/** 挂钩自动保存：planStore.plan 变更 5s 后写入 IndexedDB。
 *
 * 返回的 stop 函数在关闭订阅前会 **flush** 一次 debounce，确保页面切换
 * （如编辑器 → 漫游）时未落盘的最新编辑立刻被持久化。flush 是 fire-and-forget
 * 的 IndexedDB 写入，通常在几十毫秒内完成，回到编辑器时已经可见。
 */
export function setupAutoSave(): () => void {
  const planStore = usePlanStore();
  const save = debounce(async (p: Plan | null) => {
    if (!p) return;
    try {
      await planRepo.save({ ...p, updatedAt: Date.now() });
    } catch (err) {
      console.error('[autosave] failed', err);
    }
  }, 5000);
  const stop = watch(() => planStore.plan, save, { deep: false });
  return () => {
    save.flush();
    stop();
  };
}
