import { Mesh, Vector2, type Object3D, type Scene, type WebGLRenderer } from 'three';

/** Keep every geometry variant of a shared material in its batch. */
export function preparationBatches(scene:Scene):Mesh[][] {
  const batches=new Map<string,Mesh[]>();
  scene.traverseVisible(object=>{
    if(!(object instanceof Mesh))return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    const key=materials.map(material=>material.id).join('/');
    const batch=batches.get(key)??[];batch.push(object);batches.set(key,batch);
  });
  return [...batches.values()];
}

/** Layers, not visibility: excluded parent meshes must not hide selected children. */
export function prepareRenderBatch(renderer:WebGLRenderer,scene:Scene,batch:Mesh[],draw:()=>void,resizePost:(w:number,h:number)=>void):void {
  const selected=new Set(batch),saved:Array<[Mesh,number]>=[];
  scene.traverseVisible(object=>{
    if(object instanceof Mesh&&!selected.has(object)){saved.push([object,object.layers.mask]);object.layers.mask=0;}
  });
  try{prepareRender(renderer,scene,draw,resizePost);}
  finally{for(const [object,mask] of saved)object.layers.mask=mask;}
}

/** Real first-use shader variants, at tiny resolution; never changes camera/clipping. */
export function prepareRender(renderer:WebGLRenderer,scene:Scene,draw:()=>void,resizePost:(w:number,h:number)=>void):void {
  const size=renderer.getSize(new Vector2());
  const saved:Array<[Object3D,boolean]>=[];
  scene.traverse(object=>{saved.push([object,object.frustumCulled]);object.frustumCulled=false;});
  try{
    renderer.setSize(1,1,false);resizePost(1,1);draw();
  }finally{
    for(const [object,culled] of saved)object.frustumCulled=culled;
    renderer.setSize(size.x,size.y,false);resizePost(size.x,size.y);
  }
}
