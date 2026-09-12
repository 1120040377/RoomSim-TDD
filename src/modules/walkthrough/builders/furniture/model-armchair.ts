import { Box3, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture, Vector2, Vector3 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { loadSharedTexture } from '../texture-source-pool';
import { extractUpperCushion } from './upper-cushion';

let source:Group|null=null;
let pending:Promise<boolean>|null=null;
let sourceCushionsOnly=false;
let pendingCushionsOnly=false;
let generation=0;
let upperCushion:ReturnType<typeof extractUpperCushion>=null;
let seatCushion:ReturnType<typeof extractUpperCushion>=null;
export const hasArmchairModel=()=>source!==null;
export function cushionOcclusionTexture():Texture {
  const texture=loadSharedTexture(`${import.meta.env.BASE_URL}models/modern-arm-chair-01/textures/modern_arm_chair_01_pillow_ao_1k.jpg`);
  texture.flipY=false;texture.channel=0;texture.anisotropy=4;return texture;
}
let cushionNormal:Texture|null=null;
/** Runtime-only material variant; leave the attributed source files untouched.
 * GLTFParser loads texture dependencies lazily, so unreferenced leather maps
 * are never downloaded. Preserve the baked cushion normal and all wood maps.
 */
export function omitReplacedLeatherMaps(document:{materials?:Array<{name?:string;pbrMetallicRoughness?:{baseColorTexture?:unknown;metallicRoughnessTexture?:unknown}}>}) {
  for(const material of document.materials??[]){
    if(!material.name?.includes('pillow')||!material.pbrMetallicRoughness)continue;
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }
}
function disposeSource(group:Group):void {
  const disposed=new Set<unknown>();
  group.traverse(object=>{
    const mesh=object as Mesh;
    if(mesh.geometry&&!disposed.has(mesh.geometry)){mesh.geometry.dispose();disposed.add(mesh.geometry);}
    for(const material of mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[]){
      if(disposed.has(material))continue;
      for(const value of Object.values(material))if(value instanceof Texture&&!disposed.has(value)){value.dispose();disposed.add(value);}
      material.dispose();disposed.add(material);
    }
  });
}
export function releaseArmchairModel():void {
  upperCushion?.dispose();upperCushion=null;cushionNormal=null;
  seatCushion?.dispose();seatCushion=null;
  generation++;if(source)disposeSource(source);source=null;pending=null;
}
export function buildModelPillow(group:Group,w:number,h:number,d:number,material:MeshStandardMaterial,x:number,y:number,z:number,horizontal=false):Mesh|null {
  if(!source)return null;
  if(!upperCushion)source.traverse(object=>{
    if(object instanceof Mesh&&(object.material as MeshStandardMaterial).name.includes('pillow')){
      upperCushion=extractUpperCushion(object.geometry);cushionNormal=(object.material as MeshStandardMaterial).normalMap;
      seatCushion=extractUpperCushion(object.geometry,'seat');
    }
  });
  const selected=horizontal?seatCushion:upperCushion;
  if(!selected)return null;
  const geometry=selected.clone(),bounds=geometry.boundingBox!,size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  geometry.translate(-center.x,-center.y,-center.z);geometry.scale(w/size.x,h/size.y,d/size.z);
  const p=geometry.getAttribute('position'),coords:number[]=[];
  for(let i=0;i<p.count;i++)coords.push(p.getX(i),horizontal?p.getZ(i):p.getY(i));
  geometry.setAttribute('uv1',new Float32BufferAttribute(coords,2));
  if(!material.userData.importedPillow){
    for(const texture of [material.map,material.roughnessMap])if(texture)texture.channel=1;
    material.normalMap?.dispose();material.normalMap=cushionNormal?.clone()??null;
    material.normalScale.set(.65,.65);material.userData.importedPillow=true;material.needsUpdate=true;
    material.aoMap=cushionOcclusionTexture();material.aoMapIntensity=.8;
  }
  const mesh=new Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
}
/** Deduplicate the local load; timeout/failure leave procedural builders usable.
 * Late responses from an abandoned view are disposed, never installed.
 */
export function prepareArmchairModel(cushionsOnly=false):Promise<boolean> {
  if(source){
    if(cushionsOnly||!sourceCushionsOnly)return Promise.resolve(true);
    releaseArmchairModel();
  }
  if(pending){
    if(pendingCushionsOnly&&!cushionsOnly)return pending.then(ready=>ready?prepareArmchairModel(false):false);
    return pending;
  }
  pendingCushionsOnly=cushionsOnly;
  const current=generation;
  pending=new Promise<boolean>(resolve=>{
    let finished=false;
    const finish=(ready:boolean)=>{if(finished)return;finished=true;clearTimeout(timer);if(current===generation)pending=null;resolve(ready);};
    const timer=setTimeout(()=>finish(false),6000);
    import('three/addons/loaders/GLTFLoader.js').then(({GLTFLoader})=>{
      if(finished||current!==generation)return null;
      return new GLTFLoader().register(parser=>{
        return {name:'roomsim-linen-source',beforeRoot:()=>{omitReplacedLeatherMaps(parser.json);return null;}};
      }).loadAsync(`${import.meta.env.BASE_URL}models/modern-arm-chair-01/${cushionsOnly?'cushions.gltf':'modern_arm_chair_01_1k.gltf'}`);
    }).then(asset=>{
      if(!asset){finish(false);return;}
      if(finished||current!==generation){disposeSource(asset.scene);finish(false);return;}
      source=asset.scene;sourceCushionsOnly=cushionsOnly;finish(true);
    }).catch(()=>finish(false));
  });
  return pending;
}
export function buildModelArmchair(group:Group,furniture:Furniture):boolean {
  if(!source||sourceCushionsOnly)return false;
  source.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(source),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  source.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const original=object.material as MeshStandardMaterial;
    const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
    // glTF faces +Z; RoomSim furniture faces -Z. Normalize bottom and footprint.
    geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.rotateY(Math.PI);
    geometry.scale(furniture.size.width/100/size.x,furniture.size.height/100/size.y,furniture.size.depth/100/size.z);
    let material:MeshStandardMaterial;
    if(original.name.includes('pillow')){
      const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),coords:number[]=[];
      for(let i=0;i<p.count;i++)coords.push(p.getX(i),Math.abs(n.getY(i))>.65?p.getZ(i):p.getY(i));
      geometry.setAttribute('uv1',new Float32BufferAttribute(coords,2));
      const load=(channel:string)=>{
        const texture=loadSharedTexture(`${import.meta.env.BASE_URL}materials/fabric-032/Fabric032_1K-JPG_${channel}.jpg`);
        texture.channel=1;texture.wrapS=texture.wrapT=RepeatWrapping;texture.repeat.set(2.5,2.5);texture.anisotropy=4;return texture;
      };
      const map=load('Color');map.colorSpace=SRGBColorSpace;
      material=new MeshPhysicalMaterial({color:furniture.color??'#d9cfbc',map,roughnessMap:load('Roughness'),roughness:1,
        normalMap:original.normalMap?.clone(),normalScale:new Vector2(.65,.65),aoMap:cushionOcclusionTexture(),aoMapIntensity:.8,metalness:0,sheen:.35,
        sheenColor:furniture.color??'#d9cfbc',sheenRoughness:.9});
    }else{
      material=original.clone();
      // Instances own disposable texture wrappers, while Source/image storage is shared.
      const copies=new Map<Texture,Texture>();
      for(const [key,value] of Object.entries(material))if(value instanceof Texture){
        if(!copies.has(value))copies.set(value,value.clone());
        (material as unknown as Record<string,unknown>)[key]=copies.get(value);
      }
    }
    const mesh=new Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  });
  group.userData.assetModel='modern-arm-chair-01';return true;
}
