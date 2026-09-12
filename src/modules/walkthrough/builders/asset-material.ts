import { Color, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, ShaderChunk, SRGBColorSpace, Vector2 } from 'three';
import { loadSharedTexture } from './texture-source-pool';

/** Approximation-derived white textile. 40 cm repeat is an art-direction choice. */
export function wovenFabricMaterial(tint: Color | string | number, seed = 1) {
  const root = `${import.meta.env.BASE_URL}materials/fabric-032/Fabric032_1K-JPG_`;
  const load = (suffix: string) => {
    const texture = loadSharedTexture(`${root}${suffix}.jpg`);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(2.5, 2.5);
    texture.offset.set((seed * 0.137) % 1, (seed * 0.293) % 1);
    texture.anisotropy = 4;
    return texture;
  };
  const map = load('Color'); map.colorSpace = SRGBColorSpace;
  return new MeshPhysicalMaterial({
    color: tint, map, normalMap: load('NormalGL'), roughnessMap: load('Roughness'),
    normalScale: new Vector2(0.18, 0.18), roughness: 1, metalness: 0,
    envMapIntensity: 0.35, sheen: 0.35, sheenColor: new Color(tint), sheenRoughness: 0.9,
  });
}

/** Furniture veneer covers 80 cm, independent of the dimensions of an individual panel. */
export function oakVeneerMaterial(tint: Color | string | number, seed = 1, profile:'veneer'|'tabletop'='veneer') {
  const root = `${import.meta.env.BASE_URL}materials/wood-049/Wood049_1K-JPG_`;
  const load = (suffix: string) => {
    const texture = loadSharedTexture(`${root}${suffix}.jpg`);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(1 / 0.8, 1 / 0.8);
    // The source grain is horizontal. Cabinet faces should read as vertical veneer.
    texture.rotation = profile==='tabletop'?0:Math.PI / 2;
    texture.offset.set((seed * 0.137) % 1, (seed * 0.293) % 1);
    texture.anisotropy = 4;
    return texture;
  };
  const map = load('Color');
  map.colorSpace = SRGBColorSpace;
  const material = new MeshStandardMaterial({
    // Source albedo already contains wood colour; avoid multiplying by a full brown swatch.
    color: new Color(tint).lerp(new Color('#ffffff'), 0.65),
    map, normalMap: load('NormalGL'), roughnessMap: load('Roughness'),
    normalScale: new Vector2(0.055, 0.055), roughness: profile==='tabletop'?0.72:0.85, metalness: 0,
    envMapIntensity: 0.45,
  });
  // A restrained pale-oak finish: mix in LINEAR space after the albedo sample.
  // Preserve real grain detail without the raw scan's dark, high-contrast streaks.
  // No additional texture lookup, geometry or postprocessing pass.
  material.onBeforeCompile = shader => {
    shader.uniforms.veneerBase = { value: new Color('#b69b79') };
    shader.uniforms.veneerGrain = { value: profile==='tabletop'?0.55:0.36 };
    shader.fragmentShader = 'uniform vec3 veneerBase;\nuniform float veneerGrain;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',
        'sampledDiffuseColor.rgb = mix(veneerBase, sampledDiffuseColor.rgb, veneerGrain);\n diffuseColor *= sampledDiffuseColor;'));
  };
  material.customProgramCacheKey = () => 'roomsim-pale-oak-v1';
  return material;
}

/** Locally bundled PBR maps; no runtime dependency on the asset provider. */
export function oakFloorMaterial(tint: string) {
  const root = `${import.meta.env.BASE_URL}materials/wood-floor-051/WoodFloor051_1K-JPG_`;
  const load = (suffix: string) => {
    const texture = loadSharedTexture(`${root}${suffix}.jpg`);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(1 / 1.8, 1 / 1.8);
    texture.anisotropy = 4;
    return texture;
  };
  const map = load('Color');
  map.colorSpace = SRGBColorSpace;
  const material = new MeshStandardMaterial({ map, normalMap: load('NormalGL'),
    roughnessMap: load('Roughness'), roughness: 1, normalScale: new Vector2(0.35, 0.35),
    envMapIntensity: 0.3, metalness: 0 });
  // The source already contains oak colour; preserve its albedo at the default finish.
  if (tint.toLowerCase() !== '#d6bc94') material.color.set(tint);
  return material;
}
