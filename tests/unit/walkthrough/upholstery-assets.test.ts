import { describe, expect, it } from 'vitest';
import { needsUpholsteryAsset } from '@/modules/walkthrough/builders/furniture/upholstery-assets';

describe('upholstery asset demand', () => {
  it.each(['armchair','sofa-l','bed-single','bed-double','bed-kingsize'] as const)(
    'loads the source for %s without a companion chair', type => {
      expect(needsUpholsteryAsset([{type}])).toBe(true);
    });
  it('does not load it for empty rooms or furniture that does not consume it', () => {
    expect(needsUpholsteryAsset([])).toBe(false);
    expect(needsUpholsteryAsset([{type:'dining-table-4'},{type:'wardrobe-2'},{type:'sofa-2'}])).toBe(false);
  });
});
