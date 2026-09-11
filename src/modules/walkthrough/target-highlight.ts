import { Color, Mesh, MeshStandardMaterial, type Object3D } from 'three';

/** Subtle material glow, depth-tested normally: never an x-ray outline. */
export class TargetHighlight {
  private object:Object3D|null=null;
  private originals=new Map<MeshStandardMaterial,{color:Color;intensity:number}>();
  set(object:Object3D|null){
    if(object===this.object)return;
    this.clear();this.object=object;
    object?.traverse(child=>{
      if(!(child instanceof Mesh))return;
      for(const material of Array.isArray(child.material)?child.material:[child.material]){
        if(!(material instanceof MeshStandardMaterial)||this.originals.has(material))continue;
        this.originals.set(material,{color:material.emissive.clone(),intensity:material.emissiveIntensity});
        material.emissive.lerp(new Color('#6ddbc5'),0.35);
        material.emissiveIntensity=Math.max(0.35,material.emissiveIntensity);
      }
    });
  }
  clear(){
    for(const [material,original] of this.originals){material.emissive.copy(original.color);material.emissiveIntensity=original.intensity;}
    this.originals.clear();this.object=null;
  }
}
