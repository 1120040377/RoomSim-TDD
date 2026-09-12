import {ShaderChunk} from 'three';

/** r160 PCF correction. Keeps the existing 17 texture comparisons. */
export function receiverPlaneShadowChunk(source:string):string {
  const begin=source.indexOf('float getShadow('),end=source.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )',begin);
  if(begin<0||end<0)throw new Error('Unsupported shadow shader');
  let section=source.slice(begin,end),comparisons=0;
  section=section.replace('bool inFrustum =',`
    #if defined( SHADOWMAP_TYPE_PCF )
      vec3 sx = dFdx(shadowCoord.xyz), sy = dFdy(shadowCoord.xyz);
      float determinant = sx.x * sy.y - sx.y * sy.x;
      vec2 receiverSlope = vec2(0.0);
      if (abs(determinant) > 1e-12) {
        receiverSlope = vec2(sy.y * sx.z - sx.y * sy.z, sx.x * sy.z - sy.x * sx.z) / determinant;
      }
      vec2 receiverTexel = shadowCoord.xy * shadowMapSize;
      vec2 texelSlope = receiverSlope / shadowMapSize;
    #endif
    bool inFrustum =`);
  section=section.replace(/texture2DCompare\( shadowMap, (shadowCoord\.xy(?: \+ vec2\( [^)]* \))?), shadowCoord\.z \)/g,(_match,uv:string)=>{
    comparisons++;return `receiverPlaneCompare(shadowMap, ${uv}, shadowCoord.z, shadowMapSize, receiverTexel, texelSlope)`;
  });
  if(comparisons!==17)throw new Error('Expected 17 PCF comparisons');
  const helper=`
    float receiverPlaneCompare(sampler2D map, vec2 uv, float receiverDepth, vec2 mapSize, vec2 receiverTexel, vec2 texelSlope) {
      vec2 sampleCenter = floor(uv * mapSize) + 0.5;
      float correction = clamp(dot(texelSlope, sampleCenter - receiverTexel), -0.005, 0.005);
      return texture2DCompare(map, uv, receiverDepth + correction);
    }
  `;
  return source.slice(0,begin)+helper+section+source.slice(end);
}

let active:{original:string;patched:string;references:number}|null=null;

/** WebGL2 hook; invoke before rendering. Multiple owners share one installation. */
export function installReceiverPlaneShadow():()=>void {
  if(!active){
    const original=ShaderChunk.shadowmap_pars_fragment;
    active={original,patched:receiverPlaneShadowChunk(original),references:0};
    ShaderChunk.shadowmap_pars_fragment=active.patched;
  }
  const installation=active;installation.references++;let released=false;
  return ()=>{
    if(released)return;released=true;
    if(--installation.references===0){
      if(ShaderChunk.shadowmap_pars_fragment===installation.patched)ShaderChunk.shadowmap_pars_fragment=installation.original;
      if(active===installation)active=null;
    }
  };
}
