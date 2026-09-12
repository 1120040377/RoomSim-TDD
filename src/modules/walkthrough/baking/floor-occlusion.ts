import { DataTexture, Float32BufferAttribute, LinearFilter, Mesh, MeshStandardMaterial, RGBAFormat, Vector3,
  type BufferAttribute, type InterleavedBufferAttribute, type Object3D, type Texture } from 'three';

export interface FloorBakeBounds { minX:number; minZ:number; width:number; depth:number }

export function floorOcclusionTexture(values:Float32Array,width:number,height:number,sunVisibility?:Float32Array):DataTexture {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||values.length!==width*height)
    throw new Error('Invalid floor bake dimensions');
  if(sunVisibility&&(sunVisibility.length!==values.length||sunVisibility.some(value=>!Number.isFinite(value)||value<0||value>1)))throw new Error('Invalid sun visibility');
  const pixels=new Uint8Array(values.length*4);
  values.forEach((value,i)=>{
    if(!Number.isFinite(value))throw new Error('Invalid floor visibility');
    const v=Math.round(Math.max(0,Math.min(1,value))*255);pixels.set([v,v,v,sunVisibility?Math.round(sunVisibility[i]*255):255],i*4);
  });
  const texture=new DataTexture(pixels,width,height,RGBAFormat);
  texture.minFilter=texture.magFilter=LinearFilter;texture.channel=1;texture.needsUpdate=true;
  return texture;
}

/** Apply to floor finishes and marked rug tops; preserve albedo UVs and exact teardown. */
export function attachFloorOcclusion(root:Object3D,texture:Texture,bounds:FloorBakeBounds,strength=.65):()=>void {
  if(bounds.width<=0||bounds.depth<=0)throw new Error('Invalid floor bake bounds');
  const materials=new Map<MeshStandardMaterial,{map:Texture|null;intensity:number}>();
  const attributes=new Map<Mesh['geometry'],BufferAttribute|InterleavedBufferAttribute|undefined>();
  root.updateMatrixWorld(true);const point=new Vector3();
  root.traverse(object=>{
    if(!(object instanceof Mesh)||(!object.userData.roomId&&!object.userData.floorContactReceiver)||!(object.material instanceof MeshStandardMaterial))return;
    const geometry=object.geometry,p=geometry.getAttribute('position'),uv=new Float32Array(p.count*2);
    if(!attributes.has(geometry))attributes.set(geometry,geometry.getAttribute('uv1'));
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld);
      uv[i*2]=(point.x-bounds.minX)/bounds.width;uv[i*2+1]=(point.z-bounds.minZ)/bounds.depth;
    }
    geometry.setAttribute('uv1',new Float32BufferAttribute(uv,2));
    const material=object.material;
    if(!materials.has(material))materials.set(material,{map:material.aoMap,intensity:material.aoMapIntensity});
    material.aoMap=texture;material.aoMapIntensity=strength;material.needsUpdate=true;
  });
  return ()=>{
    for(const [geometry,attribute] of attributes){if(attribute)geometry.setAttribute('uv1',attribute);else geometry.deleteAttribute('uv1');}
    for(const [material,previous] of materials){material.aoMap=previous.map;material.aoMapIntensity=previous.intensity;material.needsUpdate=true;}
  };
}
