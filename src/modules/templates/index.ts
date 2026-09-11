export type { TemplateMeta } from './_utils';

import { blankTemplate } from './blank';
import { detailedApartmentTemplates } from './apartments/detailed';

export const BUILT_IN_TEMPLATES = [
  blankTemplate,
  ...detailedApartmentTemplates,
];

export function getTemplate(id: string) {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}
