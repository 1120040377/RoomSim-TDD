import { nanoid } from 'nanoid';
import { createEmptyPlan } from '@/modules/model/defaults';
import type { TemplateMeta } from './_utils';

export const blankTemplate: TemplateMeta = {
  id: 'blank',
  name: '空白',
  area: '—',
  description: '从零开始画',
  build: (name) => createEmptyPlan(nanoid(), name),
};
