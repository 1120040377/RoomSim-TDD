import {MeshStandardMaterial,ShaderChunk,type Mesh,type Object3D} from 'three';

/** Study only: one directional sun. AO texture alpha contains static visibility. */
export function attachSoftSun(floor:Object3D){
  const meshes=new Map<Mesh,boolean>(),materials=new Map<MeshStandardMaterial,{compile:MeshStandardMaterial['onBeforeCompile'];key:MeshStandardMaterial['customProgramCacheKey']}>();
  floor.traverse(object=>{
    const mesh=object as Mesh;
    if(!mesh.isMesh||!mesh.userData.roomId||!(mesh.material instanceof MeshStandardMaterial)||!mesh.material.aoMap)return;
    meshes.set(mesh,mesh.receiveShadow);mesh.receiveShadow=false;
    const material=mesh.material;if(materials.has(material))return;
    const compile=material.onBeforeCompile,key=material.customProgramCacheKey,originalKey=key.call(material);materials.set(material,{compile,key});
    material.onBeforeCompile=(shader,renderer)=>{
      compile.call(material,shader,renderer);
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',ShaderChunk.lights_fragment_begin.replace(
        'getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n directLight.color *= texture2D( aoMap, vAoMapUv ).a;'));
    };
    material.customProgramCacheKey=()=>`${originalKey}:static-soft-sun-v1`;material.needsUpdate=true;
  });
  let released=false;
  return ()=>{if(released)return;released=true;for(const [mesh,receive] of meshes)mesh.receiveShadow=receive;
    for(const [material,previous] of materials){material.onBeforeCompile=previous.compile;material.customProgramCacheKey=previous.key;material.needsUpdate=true;}};
}
