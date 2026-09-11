import { DataTexture, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three';
import type { Finish } from '@/modules/model/types';

/** Procedural repeatable surface, no remote textures or network dependencies. */
export function floorMaterial(finish: Finish) {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = ((x * 37 + y * 17 + x * y * 13) % 19) / 19;
    let shade = 239 + noise * 12;
    if (finish.floor === 'tile') shade = x < 2 || y < 2 ? 170 : 246 + noise * 8;
    if (finish.floor === 'wood') {
      const row = Math.floor(y / 16);
      const seam = y % 16 === 0 || (x + (row % 2) * 64) % 128 < 1;
      shade = seam ? 163 : 216 + Math.sin(x * 0.27 + Math.sin(y * 1.4)) * 9 + noise * 18 + (row % 3) * 5;
    }
    const i = (y * size + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = Math.min(255, shade);
    pixels[i + 3] = 255;
  }
  const map = new DataTexture(pixels, size, size, RGBAFormat);
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(finish.floor === 'wood' ? 0.65 : 1.5, finish.floor === 'wood' ? 0.65 : 1.5);
  map.colorSpace = SRGBColorSpace;
  map.needsUpdate = true;
  return new MeshStandardMaterial({ color: finish.floorColor, map,
    roughness: finish.floor === 'tile' ? 0.32 : 0.8, metalness: 0 });
}
