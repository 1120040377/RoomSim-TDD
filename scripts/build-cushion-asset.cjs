const fs=require('node:fs');
const path=require('node:path');

/** Lossless extraction: copy accessor bytes, preserve original normals and UVs. */
function extractCushionAsset(document,buffer){
  const primitive=document.meshes[0].primitives.find(p=>document.materials[p.material].name.includes('pillow'));
  if(!primitive)throw new Error('Missing source cushion');
  const indices=[...Object.values(primitive.attributes),primitive.indices];
  const accessors=[],bufferViews=[],chunks=[];let offset=0;
  for(const index of indices){
    const accessor=document.accessors[index],view=document.bufferViews[accessor.bufferView];
    if(view.buffer!==0||accessor.sparse)throw new Error('Unsupported source accessor');
    const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}
    const chunk=buffer.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
    bufferViews.push({...view,byteOffset:offset});chunks.push(chunk);offset+=chunk.length;
    accessors.push({...accessor,bufferView:bufferViews.length-1});
  }
  const material=structuredClone(document.materials[primitive.material]);
  material.normalTexture.index=0;material.pbrMetallicRoughness={};
  const normal=document.textures[document.materials[primitive.material].normalTexture.index];
  return {buffer:Buffer.concat(chunks),document:{
    asset:{version:'2.0',generator:'RoomSim lossless cushion extraction from Poly Haven modern_arm_chair_01 (CC0)'},
    scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],
    meshes:[{name:'modern_arm_chair_01_cushions',primitives:[{
      attributes:Object.fromEntries(Object.entries(primitive.attributes).map(([key,index])=>[key,indices.indexOf(index)])),
      indices:indices.indexOf(primitive.indices),material:0,
    }]}],materials:[material],textures:[{sampler:0,source:0}],samplers:[document.samplers[normal.sampler]],
    images:[document.images[normal.source]],accessors,bufferViews,
    buffers:[{uri:'cushions.bin',byteLength:offset}],
  }};
}
if(require.main===module){
  const directory=path.resolve(__dirname,'../public/models/modern-arm-chair-01');
  const source=JSON.parse(fs.readFileSync(path.join(directory,'modern_arm_chair_01_1k.gltf'),'utf8'));
  const extracted=extractCushionAsset(source,fs.readFileSync(path.join(directory,source.buffers[0].uri)));
  fs.writeFileSync(path.join(directory,'cushions.bin'),extracted.buffer);
  fs.writeFileSync(path.join(directory,'cushions.gltf'),JSON.stringify(extracted.document,null,2)+'\n');
  console.log('Cushion geometry bytes:',extracted.buffer.length);
}
module.exports={extractCushionAsset};
