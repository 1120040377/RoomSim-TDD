import {BufferGeometry,DoubleSide,Float32BufferAttribute,Ray,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

export interface SoftSunInput {triangles:Float32Array;positions:Float32Array;normals:Float32Array;direction:[number,number,number];samples?:number;angularRadius?:number;adaptive?:boolean}
export function bakeSoftSun(input:SoftSunInput){
  const samples=input.samples??64,radius=input.angularRadius??.025;
  if(input.triangles.length%9||input.positions.length%3||input.normals.length!==input.positions.length||
    !Number.isInteger(samples)||samples<1||samples>256||!Number.isFinite(radius)||radius<0||radius>.2||
    [input.triangles,input.positions,input.normals,input.direction].some(values=>values.some(v=>!Number.isFinite(v))))throw new Error('Invalid sun bake input');
  const direction=new Vector3(...input.direction);if(direction.lengthSq()<1e-12)throw new Error('Invalid sun direction');direction.normalize();
  const values=new Float32Array(input.positions.length/3).fill(1),started=performance.now();
  if(!input.triangles.length)return {values,bakeMs:0,rays:0};
  const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(input.triangles,3));
  try{
    const tree=new MeshBVH(geometry),u=new Vector3(Math.abs(direction.y)<.9?0:1,Math.abs(direction.y)<.9?1:0,0).cross(direction).normalize(),v=new Vector3().crossVectors(direction,u);
    const rays=Array.from({length:samples},(_,i)=>{
      const r=Math.sqrt((i+.5)/samples)*Math.tan(radius),a=i*2.399963229728653;
      return direction.clone().addScaledVector(u,r*Math.cos(a)).addScaledVector(v,r*Math.sin(a)).normalize();
    });
    // Deterministic permutation spreads pilot rays over the complete source disk.
    // Early exits are approximate: a tiny blocker can fall between pilot rays.
    const order=input.adaptive&&samples===64?Array.from({length:64},(_,i)=>(i*37)%64):rays.map((_,i)=>i);
    const pilot=input.adaptive&&samples===64?16:samples;
    const ray=new Ray(),normal=new Vector3();let rayCount=0,refinedPoints=0;
    for(let i=0;i<values.length;i++){
      normal.fromArray(input.normals,i*3).normalize();ray.origin.fromArray(input.positions,i*3).addScaledVector(normal,.002);
      let visible=0,used=0;
      for(const index of order){
        ray.direction.copy(rays[index]);if(!tree.raycastFirst(ray,DoubleSide))visible++;used++;rayCount++;
        if(used===pilot&&pilot<samples){if(visible===0||visible===pilot)break;refinedPoints++;}
      }
      values[i]=visible/used;
    }
    return {values,bakeMs:performance.now()-started,rays:rayCount,refinedPoints};
  }finally{geometry.dispose();}
}
