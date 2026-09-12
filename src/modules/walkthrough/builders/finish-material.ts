import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three';
import type { Finish } from '@/modules/model/types';
import { oakFloorMaterial } from './asset-material';

function makeTexture(size: number, pixel: (x: number, y: number) => [number, number, number], colorSpace: typeof SRGBColorSpace | typeof NoColorSpace = SRGBColorSpace): DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b] = pixel(x, y);
    const i = (y * size + x) * 4;
    pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return texture;
}

function noise(x: number, y: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Physically plausible procedural flooring, with scale cues in the albedo and a matching relief map. */
export function floorMaterial(finish: Finish) {
  if (finish.floor === 'wood' && typeof document !== 'undefined') return oakFloorMaterial(finish.floorColor);
  const size = 256;
  const isWood = finish.floor === 'wood';
  const isTile = finish.floor === 'tile';
  const color = new Color(finish.floorColor);
  const map = makeTexture(size, (x, y) => {
    if (isWood) {
      const board = Math.floor(y / 32);
      const stagger = board % 2 ? 128 : 0;
      const seam = y % 32 < 1 || (x + stagger) % 256 < 1;
      const grain = Math.sin(x * 0.42 + Math.sin(y * 0.15 + board) * 2.1) * 6;
      const variation = (noise(Math.floor(x / 4), Math.floor(y / 4)) - 0.5) * 5 + (board % 4) * 2;
      const shade = seam ? 145 : Math.round(224 + grain + variation);
      return [shade, Math.max(0, shade - 4), Math.max(0, shade - 11)];
    }
    if (isTile) {
      const seam = x < 1 || y < 1;
      const speckle = (noise(x, y) - 0.5) * 5;
      const shade = seam ? 135 : Math.round(229 + speckle);
      return [shade, shade, Math.max(0, shade - 3)];
    }
    const cloud = (noise(Math.floor(x / 6), Math.floor(y / 6)) - 0.5) * 18 + Math.sin(x * 0.06 + y * 0.03) * 4;
    const shade = Math.round(219 + cloud);
    return [shade, shade - 2, shade - 5];
  });
  const relief = makeTexture(size, (x, y) => {
    const seam = isWood ? y % 32 < 1 || (x + (Math.floor(y / 32) % 2 ? 128 : 0)) % 256 < 1 : isTile ? x < 1 || y < 1 : false;
    const value = seam ? 45 : Math.round(127 + (noise(x, y) - 0.5) * 4);
    return [value, value, value];
  }, NoColorSpace);
  // ShapeGeometry UVs are metres: 120 × 18 cm boards, or 60 × 60 cm tiles.
  map.repeat.set(isWood ? 1 / 1.2 : isTile ? 1 / 0.6 : 1,
    isWood ? 1 / 1.44 : isTile ? 1 / 0.6 : 1);
  relief.repeat.copy(map.repeat);
  return new MeshStandardMaterial({
    color,
    map,
    bumpMap: relief,
    bumpScale: isWood ? 0.0015 : isTile ? 0.001 : 0.0005,
    // Satin mineral finish, not polished tile: retain a broad, subdued reflection.
    roughness: isTile ? 0.62 : isWood ? 0.64 : 0.82,
    envMapIntensity: isTile ? 0.4 : 0.6,
    metalness: 0,
  });
}

/** A barely perceptible plaster grain stops walls from reading as unlit white plastic. */
export function wallMaterial(color: Color | string | number): MeshStandardMaterial {
  const grain = makeTexture(96, (x, y) => {
    const shade = Math.round(225 + (noise(x, y) - 0.5) * 8 + Math.sin(x * 0.18) * 1.5);
    return [shade, shade, shade];
  }, NoColorSpace);
  grain.repeat.set(2.4, 1.8);
  return new MeshStandardMaterial({ color, bumpMap: grain, bumpScale: 0.003, roughness: 0.91, metalness: 0, envMapIntensity: 0.45 });
}
