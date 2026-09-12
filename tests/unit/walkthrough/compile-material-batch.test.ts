import {expect,it,vi} from 'vitest';
import {Mesh,MeshBasicMaterial,Object3D,PerspectiveCamera,Plane,Scene,Vector2,WebGLRenderTarget,type WebGLRenderer} from 'three';
import {compileMaterialBatch} from '@/modules/walkthrough/compile-material-batch';
it.each([false,true])('restores material arrays, target and size after compile failure=%s',failure=>{
  const scene=new Scene(),camera=new PerspectiveCamera(),mesh=new Mesh();scene.add(mesh);mesh.add(new Mesh());
  const first=new MeshBasicMaterial({clippingPlanes:[new Plane()]}),second=new MeshBasicMaterial({clipIntersection:true});
  const originals=[first,second];mesh.material=originals;
  const target=new WebGLRenderTarget(16,16),size=new Vector2(800,600),program={} as WebGLProgram;
  const seen:unknown[]=[];
  const renderer={getSize:(v:Vector2)=>v.copy(size),getRenderTarget:()=>target,setRenderTarget:vi.fn(),
    setSize:vi.fn((w:number,h:number)=>size.set(w,h)),info:{programs:[{program}]},render:vi.fn(),
    compile:(scope:Object3D)=>{
      const objects:Object3D[]=[];scope.traverse(o=>objects.push(o));expect(objects).toEqual([mesh]);
      seen.push(mesh.material);if(failure)throw new Error('compile failed');
    }};
  const run=()=>compileMaterialBatch(renderer as unknown as WebGLRenderer,scene,camera,[mesh],true);
  if(failure)expect(run).toThrow('compile failed');else{expect(run()).toEqual([program]);expect(seen).toEqual(originals);}
  expect(mesh.material).toBe(originals);expect(mesh.parent).toBe(scene);expect(size.toArray()).toEqual([800,600]);
  expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(target);
  first.dispose();second.dispose();target.dispose();mesh.geometry.dispose();
});
