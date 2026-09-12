import { BufferGeometry, DoubleSide, Float32BufferAttribute, Ray, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export interface OcclusionBakeInput {
  /** Unindexed triangles and sample points, all in world-space metres. */
  triangles: Float32Array;
  positions: Float32Array;
  normals: Float32Array;
  samples?: number;
  radius?: number;
}

/** Static hemisphere visibility, not multi-bounce GI. Run in a worker, not tick(). */
export function bakeAmbientOcclusion(input: OcclusionBakeInput) {
  const samples=input.samples??32,radius=input.radius??.6;
  if(input.triangles.length%9||input.positions.length%3||input.normals.length!==input.positions.length||
    !Number.isInteger(samples)||samples<1||samples>256||!Number.isFinite(radius)||radius<=.002)
    throw new Error('Invalid ambient occlusion bake input');
  const started=performance.now();
  const values=new Float32Array(input.positions.length/3).fill(1);
  if(!input.triangles.length)return {values,buildMs:0,bakeMs:0,rays:0};
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(input.triangles,3));
  try{
    const tree=new MeshBVH(geometry),built=performance.now();
    const ray=new Ray(),normal=new Vector3(),tangent=new Vector3(),bitangent=new Vector3();
    const directions=Array.from({length:samples},(_,i)=>{
      const r=Math.sqrt((i+.5)/samples),angle=i*2.399963229728653;
      return new Vector3(r*Math.cos(angle),r*Math.sin(angle),Math.sqrt(1-r*r));
    });
    let rays=0;
    for(let i=0;i<values.length;i++){
      normal.fromArray(input.normals,i*3);
      if(normal.lengthSq()<1e-12)continue;
      normal.normalize();tangent.set(Math.abs(normal.y)<.9?0:1,Math.abs(normal.y)<.9?1:0,0);
      tangent.cross(normal).normalize();bitangent.crossVectors(normal,tangent);
      ray.origin.fromArray(input.positions,i*3).addScaledVector(normal,.002);
      let occlusion=0;
      for(const direction of directions){
        ray.direction.copy(tangent).multiplyScalar(direction.x).addScaledVector(bitangent,direction.y)
          .addScaledVector(normal,direction.z);
        const hit=tree.raycastFirst(ray,DoubleSide,0,radius);rays++;
        if(hit){const t=hit.distance/radius;occlusion+=1-t*t*(3-2*t);}
      }
      values[i]=1-occlusion/samples;
    }
    return {values,buildMs:built-started,bakeMs:performance.now()-built,rays};
  }finally{geometry.dispose();}
}
