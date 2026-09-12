import {ShaderChunk} from 'three';

/** Exact zero-contribution guard, not a distance/brightness approximation. */
export function pointLightBranch(source:string):string {
  const begin=source.indexOf('#if ( NUM_POINT_LIGHTS > 0 )');
  const end=source.indexOf('#if ( NUM_SPOT_LIGHTS > 0 )',begin);
  if(begin<0||end<0)throw new Error('Unsupported point-light shader');
  const call='RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const section=source.slice(begin,end);
  if(section.split(call).length!==2)throw new Error('Expected one point-light direct evaluation');
  return source.slice(0,begin)+section.replace(call,`
    #if defined( STANDARD )
      if ( directLight.visible ) { ${call} }
    #else
      ${call}
    #endif
  `)+source.slice(end);
}

/** Experimental; install before compilation and release after renderer disposal. */
export function installPointLightBranch():()=>void {
  const original=ShaderChunk.lights_fragment_begin,patched=pointLightBranch(original);
  ShaderChunk.lights_fragment_begin=patched;
  return ()=>{if(ShaderChunk.lights_fragment_begin===patched)ShaderChunk.lights_fragment_begin=original;};
}
