import { nanoid } from 'nanoid';
import type { Plan } from '@/modules/model/types';
import { migrate } from './migrations';

/** 下载 plan 为 .roomsim.json 文件 */
export function exportPlan(plan: Plan): void {
  const blob = new Blob([JSON.stringify(plan, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.name || 'plan'}.roomsim.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 解析导入文件。生成新 id 避免冲突，抛出 schema 错误供调用方处理。*/
export async function importPlanFromFile(file: File): Promise<Plan> {
  const text = await file.text();
  const raw = JSON.parse(text);
  const migrated = migrate(raw);
  const now = Date.now();
  return {
    ...migrated,
    id: nanoid(),
    createdAt: now,
    updatedAt: now,
  };
}
