import {Mesh,MeshBasicMaterial,MirroredRepeatWrapping,PlaneGeometry,ShaderChunk,SRGBColorSpace,TextureLoader,type PerspectiveCamera,type Texture} from 'three';

/** One world-directional photo backdrop, not exterior geometry or a lighting probe. */
export function createExteriorBackdrop(onReady:()=>void){
  const material=new MeshBasicMaterial({depthWrite:false,fog:false});
  const verticalScale={value:2/Math.PI};
  // Sky depth: reject pixels already occupied by opaque furniture/walls, even
  // when the apartment extends beyond the photo plate's nominal 90 m position.
  material.onBeforeCompile=shader=>{
    shader.uniforms.exteriorVerticalScale=verticalScale;
    shader.vertexShader='varying vec3 exteriorDirection;\n'+shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nexteriorDirection = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;\ngl_Position.z = gl_Position.w;');
    // The screen-covering triangle pair moves with the camera, but its texture
    // coordinates come from WORLD rays. Orbit/yaw/pitch therefore rotate the
    // landscape with the room, instead of pinning a photograph to the screen.
    // Mirror the ordinary photo around the horizon: no hard left/right seam.
    shader.fragmentShader='varying vec3 exteriorDirection;\nuniform float exteriorVerticalScale;\n'+shader.fragmentShader.replace('#include <map_fragment>',
      `vec3 exteriorRay = exteriorDirection;
       vec2 exteriorUv = vec2(atan(exteriorRay.x, -exteriorRay.z) / 3.14159265 + 1.0,
         clamp(0.65 + atan(exteriorRay.y, length(exteriorRay.xz)) * exteriorVerticalScale, 0.001, 0.999));
       ${ShaderChunk.map_fragment.replaceAll('vMapUv','exteriorUv')}`);
  };
  material.customProgramCacheKey=()=> 'roomsim-exterior-world-direction-v3';
  const mesh=new Mesh(new PlaneGeometry(2,2),material);
  mesh.name='exterior-backdrop';mesh.userData.exteriorBackdrop=true;
  material.userData.exteriorBackdrop=true;
  mesh.frustumCulled=false;mesh.renderOrder=10000;mesh.visible=false;
  mesh.raycast=()=>{};
  let disposed=false;
  let texture:Texture|undefined;
  const pending=new TextureLoader().load('/textures/environment/leafy-neighbourhood.jpg',loaded=>{
    if(disposed){loaded.dispose();return;}
    texture=loaded;texture.colorSpace=SRGBColorSpace;texture.wrapS=MirroredRepeatWrapping;
    // Equal angular texel density at the horizon: a 2:1 photo spans 180° × 90°.
    // Normalizing the ray is unnecessary: both atan ratios are scale invariant.
    verticalScale.value=texture.image.width/texture.image.height/Math.PI;
    material.map=texture;material.needsUpdate=true;mesh.visible=true;onReady();
  },undefined,()=>{if(!disposed)onReady();});
  return {mesh,update:(camera:PerspectiveCamera)=>{
    const extent=90*Math.tan(camera.fov*Math.PI/360)/camera.zoom;
    mesh.position.set(0,0,-90).applyQuaternion(camera.quaternion).add(camera.position);
    mesh.quaternion.copy(camera.quaternion);mesh.scale.set(extent*camera.aspect,extent,1);
  },setNight:(night:boolean)=>material.color.set(night?'#293b58':'#ffffff'),dispose:()=>{
    if(disposed)return;disposed=true;pending.dispose();if(texture&&texture!==pending)texture.dispose();
    mesh.geometry.dispose();material.dispose();
  }};
}
