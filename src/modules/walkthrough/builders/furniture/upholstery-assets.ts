import type { Furniture } from '@/modules/model/types';

// The source contains both chair geometry and reusable sculpted soft cushions.
// Do not make bed / sectional quality depend on an unrelated chair being present.
const SOURCE_USERS = new Set<Furniture['type']>([
  'armchair', 'sofa-l', 'bed-single', 'bed-double', 'bed-kingsize',
]);

export function needsUpholsteryAsset(furniture: Iterable<Pick<Furniture, 'type'>>): boolean {
  for (const item of furniture) if (SOURCE_USERS.has(item.type)) return true;
  return false;
}
