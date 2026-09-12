export type { TemplateMeta } from './_utils';

import { blankTemplate } from './blank';
import { detailedApartmentTemplates } from './apartments/detailed';
import { materialShowroom } from './apartments/material-showroom';

export const BUILT_IN_TEMPLATES = [
  blankTemplate,
  materialShowroom,
  ...detailedApartmentTemplates,
];

export function getTemplate(id: string) {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}
