import { afterEach, expect, it, vi } from 'vitest';
import { NoColorSpace, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { wovenFabricMaterial } from '@/modules/walkthrough/builders/asset-material';

afterEach(() => { vi.restoreAllMocks(); });

it('染色织物共享三张来源，独立 UV，法线保持线性且不使用置换', () => {
  const loader = vi.spyOn(TextureLoader.prototype, 'load').mockImplementation(() => new Texture());
  const a = wovenFabricMaterial('#cabdaa', 2), b = wovenFabricMaterial('#74866a', 7);
  expect(loader).toHaveBeenCalledTimes(3);
  for (const key of ['map', 'normalMap', 'roughnessMap'] as const) {
    expect(a[key]!.source === b[key]!.source).toBe(true);
    expect(a[key]!.repeat.toArray()).toEqual([2.5, 2.5]);
    expect(a[key]!.offset.equals(b[key]!.offset)).toBe(false);
  }
  expect(a.map!.colorSpace).toBe(SRGBColorSpace);
  expect(a.normalMap!.colorSpace).toBe(NoColorSpace);
  expect(a.roughnessMap!.colorSpace).toBe(NoColorSpace);
  expect(a.normalScale.toArray()).toEqual([0.18, 0.18]);
  expect(a.displacementMap).toBeNull(); expect(a.transmission).toBe(0);
  expect(a.color.getHexString()).toBe('cabdaa');
  for (const m of [a, b]) { m.map!.dispose(); m.normalMap!.dispose(); m.roughnessMap!.dispose(); m.dispose(); }
});
