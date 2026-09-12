import {Color,InstancedMesh,Mesh,MeshStandardMaterial,Vector2,type Object3D,type Texture} from 'three';
import {snapshotOccluders,type SnapshotOptions} from './scene-snapshot';
import {prepareColorSampler} from './prepare-color-sampler';

/** Coarse diffuse reflectance, including four color-map samples per triangle. */
export async function snapshotReflectors(root:Object3D,options:Omit<SnapshotOptions,'onTriangle'>={}){
  const chunks:Float32Array[]=[];let chunk:Float32Array|null=null,used=0,total=0;
  const color=new Color(),instanceColor=new Color(),mapColor=new Color(),sampleColor=new Color(),uvPoint=new Vector2();
  const weights=[[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]];
  const textures=new Set<Texture>();let colorConversionMaxMs=0;
  root.traverseVisible(object=>{if(object instanceof Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(material instanceof MeshStandardMaterial&&material.map)textures.add(material.map);
  }});
  const maps=await prepareColorSampler(textures,options.signal);if(!maps)return null;
  for(const texture of textures){
    if(options.signal?.aborted)return null;
    // Only small linear-color conversion remains here; image readback is in a worker.
    const readStart=performance.now();maps.forTexture(texture);colorConversionMaxMs=Math.max(colorConversionMaxMs,performance.now()-readStart);
    await (options.yieldTask?.()??new Promise<void>(resolve=>setTimeout(resolve,0)));
  }
  const triangles=await snapshotOccluders(root,{...options,onTriangle(mesh,offset,instance){
    const geometry=mesh.geometry,index=geometry.index;
    const group=geometry.groups.find(group=>offset>=group.start&&offset<group.start+group.count);
    const material=Array.isArray(mesh.material)?mesh.material[group?.materialIndex??0]:mesh.material;
    if(material instanceof MeshStandardMaterial)color.copy(material.color).multiplyScalar(1-material.metalness);
    else color.setRGB(0,0,0); // Unsupported surfaces absorb; do not invent reflected energy.
    if(material instanceof MeshStandardMaterial&&material.map){
      const map=material.map,uv=geometry.getAttribute(map.channel===0?'uv':`uv${map.channel}`);
      if(!uv)throw new Error('Reflector color texture UVs missing');
      const sample=maps.forTexture(map);mapColor.setRGB(0,0,0);
      for(const weight of weights){
        uvPoint.set(0,0);for(let j=0;j<3;j++){const id=index?index.getX(offset+j):offset+j;uvPoint.x+=uv.getX(id)*weight[j];uvPoint.y+=uv.getY(id)*weight[j];}
        sample(uvPoint,sampleColor);mapColor.r+=sampleColor.r/4;mapColor.g+=sampleColor.g/4;mapColor.b+=sampleColor.b/4;
      }
      color.multiply(mapColor);
    }
    const vertices=geometry.getAttribute('color');
    if(material?.vertexColors&&vertices){
      const rgb=[0,0,0];for(let j=0;j<3;j++){
        const id=index?index.getX(offset+j):offset+j;
        rgb[0]+=vertices.getX(id)/3;rgb[1]+=vertices.getY(id)/3;rgb[2]+=vertices.getZ(id)/3;
      }
      color.r*=rgb[0];color.g*=rgb[1];color.b*=rgb[2];
    }
    if(mesh instanceof InstancedMesh&&mesh.instanceColor){mesh.getColorAt(instance,instanceColor);color.multiply(instanceColor);}
    if(!chunk||used===chunk.length){chunk=new Float32Array(4096*3);chunks.push(chunk);used=0;}
    chunk[used++]=Math.max(0,Math.min(1,color.r));chunk[used++]=Math.max(0,Math.min(1,color.g));chunk[used++]=Math.max(0,Math.min(1,color.b));total+=3;
  }});
  if(!triangles)return null;
  const reflectance=new Float32Array(total);let offset=0,deadline=performance.now()+3;
  for(const block of chunks){
    if(options.signal?.aborted)return null;
    const length=Math.min(block.length,total-offset);reflectance.set(block.subarray(0,length),offset);offset+=length;
    if(performance.now()>=deadline){await (options.yieldTask?.()??new Promise<void>(resolve=>setTimeout(resolve,0)));deadline=performance.now()+3;}
  }
  return options.signal?.aborted?null:{triangles,reflectance,colorConversionMaxMs};
}
