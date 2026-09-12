import { Camera, Color, InstancedMesh, Material, Mesh, Scene, ShaderMaterial, SkinnedMesh, Texture, Vector2, Vector3, VideoTexture } from 'three';
import {ValueSnapshot} from './value-snapshot';

/** Reuse the displayed image only while all supported scene inputs are unchanged. */
export class FrameCache {
  private snapshot=new ValueSnapshot();
  private identities = new WeakMap<object,number>();
  private nextIdentity = 1;
  private identity(object:object):number {
    let id=this.identities.get(object);
    if(id===undefined){id=this.nextIdentity++;this.identities.set(object,id);}
    return id;
  }
  invalidate(): void { this.snapshot.invalidate(); }

  needsRender(scene: Scene, camera: Camera, settings: Array<string | number | boolean>): boolean {
    scene.updateMatrixWorld(true);camera.updateWorldMatrix(true,false);
    const values=this.snapshot.begin();
    values.push(...settings,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,camera.layers.mask);
    const materials=new Set<Material>(),textures=new Set<Texture>();
    let dynamic=!!scene.overrideMaterial;
    const value=(v: unknown): void=>{
      if(v===null||typeof v==='string'||typeof v==='number'||typeof v==='boolean')values.push(v);
      else if(v instanceof Color)values.push(v.r,v.g,v.b);
      else if(v instanceof Vector2)values.push(v.x,v.y);
      else if(v instanceof Vector3)values.push(v.x,v.y,v.z);
      else if(v instanceof Texture){
        values.push(v.id);
        if(textures.has(v))return;textures.add(v);
        values.push(v.version,v.source.version,v.offset.x,v.offset.y,v.repeat.x,v.repeat.y,v.rotation,v.center.x,v.center.y);
        if(v instanceof VideoTexture)dynamic=true;
      }
    };
    value(scene.background);value(scene.environment);value(scene.fog);
    if(scene.fog)for(const v of Object.values(scene.fog))value(v);
    scene.traverseVisible(object=>{
      values.push(object.id,object.layers.mask,...object.matrixWorld.elements,object.renderOrder);
      if(object instanceof SkinnedMesh)dynamic=true;
      const renderable=object as Mesh;
      values.push(object.frustumCulled,object.castShadow,object.receiveShadow);
      if(renderable.customDepthMaterial||renderable.customDistanceMaterial)dynamic=true;
      if(renderable.morphTargetInfluences?.length)dynamic=true;
      if(renderable.geometry){
        const geometry=renderable.geometry;
        values.push(geometry.id,geometry.index?this.identity(geometry.index):0,geometry.index?.version??-1,geometry.drawRange.start,geometry.drawRange.count);
        for(const [name,attribute] of Object.entries(geometry.attributes))values.push(name,this.identity(attribute),attribute.count,
          'version' in attribute?attribute.version:attribute.data.version);
        for(const section of geometry.groups)values.push(section.start,section.count,section.materialIndex??0);
      }
      if(object instanceof InstancedMesh)values.push(object.count,this.identity(object.instanceMatrix),object.instanceMatrix.version,
        object.instanceColor?this.identity(object.instanceColor):0,object.instanceColor?.version??-1);
      if(renderable.material)for(const material of Array.isArray(renderable.material)?renderable.material:[renderable.material]){
        values.push(material.id);
        if(materials.has(material))continue;materials.add(material);
        if(material instanceof ShaderMaterial)dynamic=true;
        for(const [key,v] of Object.entries(material)){
          if(key==='userData')continue;
          values.push(key);value(v);
        }
        for(const plane of material.clippingPlanes??[])values.push(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
      }
      if('isLight' in object)for(const [key,v] of Object.entries(object)){
        if(['intensity','color','groundColor','distance','decay','angle','penumbra','width','height','visible'].includes(key)){values.push(key);value(v);}
      }
    });
    return this.snapshot.commit()||dynamic;
  }
}
