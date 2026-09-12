import { BufferGeometry, DoubleSide, Float32BufferAttribute, Ray, Vector3 } from 'three';
import { MeshBVH, type MeshBVHOptions } from 'three-mesh-bvh';

export interface DiffuseBounceInput {
  triangles:Float32Array;
  /** Linear diffuse reflectance RGB per original triangle; textures not sampled. */
  reflectance:Float32Array;
  positions:Float32Array;
  normals:Float32Array;
  sunDirection:[number,number,number];
  /** Incident irradiance on a surface perpendicular to the sun, linear RGB. */
  sunIrradiance:[number,number,number];
  samples?:number;
}

/** Sun -> diffuse surface -> receiver only. No direct light, sky or later bounces. */
export function bakeDiffuseBounce(input:DiffuseBounceInput) {
  const samples=input.samples??32;
  if(input.triangles.length%9||input.reflectance.length!==input.triangles.length/3||input.positions.length%3||
    input.normals.length!==input.positions.length||!Number.isInteger(samples)||samples<1||samples>256||
    ![...input.sunDirection,...input.sunIrradiance].every(Number.isFinite)||input.sunIrradiance.some(v=>v<0)||
    input.reflectance.some(v=>!Number.isFinite(v)||v<0||v>1)||
    [input.triangles,input.positions,input.normals].some(buffer=>buffer.some(value=>!Number.isFinite(value))))throw new Error('Invalid diffuse bounce input');
  const sun=new Vector3(...input.sunDirection);
  if(sun.lengthSq()<1e-12)throw new Error('Invalid sun direction');sun.normalize();
  const irradiance=new Float32Array(input.positions.length),started=performance.now();
  if(!input.triangles.length)return {irradiance,buildMs:0,bakeMs:0,rays:0};
  const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(input.triangles,3));
  try{
    // Preserve original triangle IDs so material colors survive BVH partitioning.
    // 0.8 implements indirect mode, but omits it from its options declaration.
    const options:MeshBVHOptions & {indirect:boolean}={indirect:true};
    const tree=new MeshBVH(geometry,options),built=performance.now();
    const ray=new Ray(),shadow=new Ray(),n=new Vector3(),u=new Vector3(),v=new Vector3(),hitNormal=new Vector3();
    const directions=Array.from({length:samples},(_,i)=>{
      const r=Math.sqrt((i+.5)/samples),a=i*2.399963229728653;
      return new Vector3(r*Math.cos(a),r*Math.sin(a),Math.sqrt(1-r*r));
    });
    shadow.direction.copy(sun);let rays=0;
    for(let i=0;i<input.positions.length;i+=3){
      n.fromArray(input.normals,i);if(n.lengthSq()<1e-12)continue;n.normalize();
      u.set(Math.abs(n.y)<.9?0:1,Math.abs(n.y)<.9?1:0,0).cross(n).normalize();v.crossVectors(n,u);
      ray.origin.fromArray(input.positions,i).addScaledVector(n,.002);
      for(const direction of directions){
        ray.direction.copy(u).multiplyScalar(direction.x).addScaledVector(v,direction.y).addScaledVector(n,direction.z);
        const hit=tree.raycastFirst(ray,DoubleSide);rays++;
        if(!hit?.face||hit.faceIndex==null)continue;
        hitNormal.copy(hit.face.normal);if(hitNormal.dot(ray.direction)>0)hitNormal.negate();
        const cosine=Math.max(0,hitNormal.dot(sun));if(cosine===0)continue;
        shadow.origin.copy(hit.point).addScaledVector(hitNormal,.002);
        rays++;if(tree.raycastFirst(shadow,DoubleSide))continue;
        // Cosine-weighted receiver sampling cancels the Lambertian BRDF's PI.
        const color=hit.faceIndex*3;
        for(let channel=0;channel<3;channel++)irradiance[i+channel]+=input.reflectance[color+channel]*input.sunIrradiance[channel]*cosine/samples;
      }
    }
    return {irradiance,buildMs:built-started,bakeMs:performance.now()-built,rays};
  }finally{geometry.dispose();}
}
