import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from 'three';
import { oakVeneerMaterial, wovenFabricMaterial } from '../asset-material';
import { applyThinGlassReflection } from '../thin-glass';

type Rgb = readonly [number, number, number];

function createTexture(size: number, paint: (x: number, y: number) => Rgb, colorSpace: typeof SRGBColorSpace | typeof NoColorSpace = SRGBColorSpace): DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b] = paint(x, y);
    const index = (y * size + x) * 4;
    pixels[index] = r;
    pixels[index + 1] = g;
    pixels[index + 2] = b;
    pixels[index + 3] = 255;
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

function noise(x: number, y: number, seed = 1): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

/** Subtle textile weave; intentionally restrained so it reads as fabric, not a printed pattern. */
export function fabricMaterial(color: Color | string | number, seed = 1): MeshStandardMaterial {
  if (typeof document !== 'undefined') return wovenFabricMaterial(color, seed);
  const weave = createTexture(96, (x, y) => {
    const warp = (x % 6 < 2 ? 9 : -4) + (y % 7 < 2 ? 6 : -3);
    const speckle = (noise(x, y, seed) - 0.5) * 9;
    const shade = Math.round(224 + warp + speckle);
    return [shade, shade, shade];
  });
  weave.repeat.set(12, 12);
  const relief = createTexture(96, (x, y) => {
    const h = Math.round(120 + (x % 6 < 2 ? 22 : -12) + (y % 7 < 2 ? 14 : -8));
    return [h, h, h];
  }, NoColorSpace);
  relief.repeat.copy(weave.repeat);
  return new MeshPhysicalMaterial({ color, map: weave, bumpMap: relief, bumpScale: 0.00035,
    roughness: 0.92, metalness: 0, envMapIntensity: 0.35, sheen: 0.35, sheenColor: new Color(color), sheenRoughness: 0.9 });
}

/** Low-contrast grain gives timber a real fibre direction without becoming visual noise. */
export function woodMaterial(color: Color | string | number, seed = 1, profile:'veneer'|'tabletop'='veneer'): MeshStandardMaterial {
  if (typeof document !== 'undefined') return oakVeneerMaterial(color, seed, profile);
  const grain = createTexture(128, (x, y) => {
    const broad = Math.sin(x * 0.38 + Math.sin(y * 0.17 + seed) * 2.2) * 5;
    const fine = Math.sin(x * 1.8 + y * 0.13) * 1.5 + (noise(x, y, seed) - 0.5) * 3;
    const shade = Math.round(236 + broad + fine);
    return [shade, Math.max(0, shade - 3), Math.max(0, shade - 7)];
  });
  grain.repeat.set(0.5, 0.7);
  const relief = createTexture(128, (x, y) => {
    const value = Math.round(126 + Math.sin(x * 0.38 + Math.sin(y * 0.17 + seed) * 2.2) * 13);
    return [value, value, value];
  }, NoColorSpace);
  relief.repeat.copy(grain.repeat);
  return new MeshStandardMaterial({ color, map: grain, bumpMap: relief, bumpScale: 0.0006, roughness: 0.58, metalness: 0 });
}

export function paintedMaterial(color: Color | string | number, roughness = 0.72): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.4 });
}

/** Periodic jute yarns: colour belongs to a strand, not independent pixel noise. */
export function rugWeaveSample(x:number,y:number):{shade:number;height:number} {
  const u=((x%128)+128)%128,v=((y%128)+128)%128;
  const column=Math.floor(u/4),row=Math.floor(v/4);
  const over=(column+row)%2===0;
  const across=over?u:v,along=over?v:u;
  const strand=over?column:row;
  const crown=Math.sin((across%4)/4*Math.PI);
  const yarn=noise(strand,over?0:1,83)-.5;
  // A shallow twisted bundle runs continuously along each exposed yarn.
  const twist=Math.sin(along*Math.PI/4+across*Math.PI/2+strand*.7);
  const fleck=(noise(u,v,61)-.5)*6;
  return {
    shade:Math.round(204+crown*24+yarn*34+twist*5+fleck),
    height:Math.round(76+crown*100+twist*12+fleck),
  };
}

let rugValues:Uint8Array|undefined;

/** Flatwoven fibre rug: roughly 8 mm yarns, using the existing two small maps. */
export function rugMaterial(color: Color | string | number): MeshStandardMaterial {
  if(!rugValues){
    rugValues=new Uint8Array(128*128*2);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const sample=rugWeaveSample(x,y),offset=(y*128+x)*2;
      rugValues[offset]=sample.shade;rugValues[offset+1]=sample.height;
    }
  }
  const values=rugValues;
  const map = createTexture(128, (x, y) => {
    const n=values[(y*128+x)*2];return [n,n-4,n-11];
  });
  const bump = createTexture(128, (x, y) => {
    const n=values[(y*128+x)*2+1];return [n,n,n];
  }, NoColorSpace);
  map.repeat.set(4, 4); bump.repeat.copy(map.repeat);
  return new MeshStandardMaterial({ color, map, bumpMap: bump, bumpScale: 0.0008,
    roughness: 0.98, metalness: 0, envMapIntensity: 0.25 });
}

export function metalMaterial(color: Color | string | number = '#6d7475', roughness = 0.28): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness: 0.86 });
}

/** Periodic, smoothly interpolated mineral clouds rather than square noise cells. */
export function stoneAlbedoValue(x:number,y:number):number {
  const octave=(cells:number,seed:number)=>{
    const u=((x%128)+128)%128*cells/128,v=((y%128)+128)%128*cells/128;
    const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const at=(a:number,b:number)=>noise(a%cells,b%cells,seed);
    const a=at(ix,iy)*(1-sx)+at(ix+1,iy)*sx;
    const b=at(ix,iy+1)*(1-sx)+at(ix+1,iy+1)*sx;
    return (a*(1-sy)+b*sy)-.5;
  };
  return Math.round(228+octave(4,7)*16+octave(8,19)*10+octave(16,23)*6);
}

let stoneValues:Uint8Array|undefined;
export function stoneMaterial(color: Color | string | number = '#d0c8bb'): MeshStandardMaterial {
  // The fixed 16 KB swatch is generated once, not for every countertop rebuild.
  const values=stoneValues??=Uint8Array.from({length:128*128},(_,i)=>stoneAlbedoValue(i%128,Math.floor(i/128)));
  const texture = createTexture(128, (x, y) => {
    const shade = values[y*128+x];
    return [shade, shade - 2, shade - 5];
  });
  texture.repeat.set(1.2, 1.2);
  return new MeshStandardMaterial({ color, map: texture, roughness: 0.58, metalness: 0, envMapIntensity: 0.4 });
}

export function porcelainMaterial(color: Color | string | number = '#f4f2ed'): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color, roughness: 0.23, metalness: 0, envMapIntensity: 0.65, clearcoat: 0.18, clearcoatRoughness: 0.24 });
}

export function glassMaterial(color: Color | string | number = '#d9eff0'): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.28,
    // Thin glazing uses transparency plus environment reflection. Screen-space
    // transmission otherwise redraws the entire opaque apartment for a few panes.
    transmission: 0,
    thickness: 0.02,
    envMapIntensity: 1.1,
    depthWrite: false,
  });
  applyThinGlassReflection(material);
  return material;
}
