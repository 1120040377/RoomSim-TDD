import {BufferGeometry,Mesh,Texture,type Group,type Object3D} from 'three';
import {fabricMaterial} from './material-library';

let source:BufferGeometry|null=null;
let pending:Promise<boolean>|null=null,cancel:(()=>void)|null=null,generation=0;
export function prepareDrapedThrow():Promise<boolean>{
  if(source)return Promise.resolve(true);if(pending)return pending;
  const token=++generation,controller=new AbortController();
  pending=new Promise<boolean>(resolve=>{
    let settled=false;
    const finish=(ready:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);if(token===generation){pending=null;cancel=null;}resolve(ready);};
    const stop=()=>{controller.abort();finish(false);};
    const timer=setTimeout(stop,6000);cancel=stop;
    void (async()=>{
      let decoded:Object3D|null=null;
      try{
        const [{GLTFLoader},response]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),fetch('/models/draped-throw/draped-throw.glb',{signal:controller.signal})]);
        if(!response.ok)throw new Error('Throw asset unavailable');
        const bytes=await response.arrayBuffer();if(settled||token!==generation)return;
        decoded=(await new GLTFLoader().parseAsync(bytes,'')).scene;
        if(settled||token!==generation)return;
        installDrapedThrow(decoded);finish(true);
      }catch{finish(false);}
      finally{
        if(decoded){const disposed=new Set<unknown>();decoded.traverse(object=>{
          const mesh=object as Mesh;if(!mesh.isMesh)return;
          if(!disposed.has(mesh.geometry)){mesh.geometry.dispose();disposed.add(mesh.geometry);}
          for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(!disposed.has(material)){
            for(const value of Object.values(material))if(value instanceof Texture&&!disposed.has(value)){value.dispose();disposed.add(value);}
            material.dispose();disposed.add(material);
          }
        });}
      }
    })();
  });
  return pending;
}
/** Explicit asset registration. No network requests or simulation in bed construction. */
export function installDrapedThrow(root:Object3D){
  const meshes:Mesh[]=[];root.updateWorldMatrix(true,true);
  root.traverse(object=>{if((object as Mesh).isMesh)meshes.push(object as Mesh);});
  if(meshes.length!==1)throw new Error('Draped throw requires a single static mesh');
  const mesh=meshes[0],count=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
  if(count<1||count>6000||!mesh.geometry.getAttribute('normal')||!mesh.geometry.getAttribute('uv')||
    ('isSkinnedMesh' in mesh&&mesh.isSkinnedMesh)||mesh.morphTargetInfluences?.length)throw new Error('Draped throw requires budgeted static geometry with normals and UVs');
  const next=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  source?.dispose();source=next;
}
export function releaseDrapedThrow(){cancel?.();generation++;pending=null;cancel=null;source?.dispose();source=null;}

export function buildDrapedThrow(group:Group,width:number,deck:number,foot:number,color:string):boolean{
  if(!source||Math.abs(width-1.5)>.001||Math.abs(deck-.45)>.001||Math.abs(foot-.9)>.001)return false;
  const geometry=source.clone(),position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++){
    // Authored on a 1.41 m mattress with its top at .45 m. Rotate the
    // Blender-exported foot (-Z) toward the bed's local +Z; preserve seam UVs.
    position.setXYZ(i,-position.getX(i),position.getY(i),-position.getZ(i));
  }
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new Mesh(geometry,fabricMaterial(color,67));mesh.name='simulated-bed-throw';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  return true;
}
