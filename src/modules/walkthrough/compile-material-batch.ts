import {Mesh,MeshBasicMaterial,Object3D,PlaneGeometry,Scene,Vector2,WebGLRenderTarget,type Camera,type WebGLRenderer} from 'three';

/** r160 diagnostic adapter: establish clipping state before compiling each material. */
export function compileMaterialBatch(renderer:WebGLRenderer,scene:Scene,camera:Camera,batch:Mesh[],offscreen:boolean):WebGLProgram[] {
  const size=renderer.getSize(new Vector2()),previousTarget=renderer.getRenderTarget();
  const target=offscreen?new WebGLRenderTarget(1,1):null;
  const primer=new Scene(),basic=new MeshBasicMaterial(),probe=new Mesh(new PlaneGeometry(1,1),basic);
  probe.frustumCulled=false;primer.add(probe);
  const scope=new Object3D();
  // Do not reparent scene objects or traverse nested lights a second time.
  scope.traverseVisible=()=>{};
  try{
    renderer.setSize(1,1,false);renderer.setRenderTarget(target);
    for(const mesh of batch){
      const original=mesh.material;
      try{
        for(const material of Array.isArray(original)?original:[original]){
          basic.clippingPlanes=material.clippingPlanes;basic.clipIntersection=material.clipIntersection;basic.needsUpdate=true;
          renderer.render(primer,camera);
          mesh.material=material;scope.traverse=callback=>callback(mesh);
          renderer.compile(scope,camera,scene);
        }
      }finally{mesh.material=original;}
    }
  }finally{
    renderer.setRenderTarget(previousTarget);renderer.setSize(size.x,size.y,false);
    basic.dispose();probe.geometry.dispose();target?.dispose();
  }
  // Snapshot AFTER disposing the primer, so no deleted program is polled.
  return (renderer.info.programs??[]).map(program=>program.program as WebGLProgram);
}
