import { Box3,BufferAttribute,BufferGeometry,DynamicDrawUsage,Mesh,Sphere,Vector3,type BoxGeometry,type MeshStandardMaterial,type Plane } from 'three';
import { CUTAWAY_HEIGHT } from './inspection-cutaway';
// Fragment clipping and the independent Float32 cap can disagree at the last
// covered sample. A sub-millimetre edge guard closes that raster seam; it does
// not alter walls, openings, collision geometry, or the plane of the cut.
export const CAP_EDGE_GUARD = .0002;

/** One preallocated mesh closes camera-facing cuts in exterior and interior slabs. */
export class VerticalWallCaps {
  readonly mesh:Mesh;
  private signature='';
  private slabs:Array<{corners:Vector3[];bottom:number;top:number;interior:boolean}>;
  constructor(meshes:Mesh[],material:MeshStandardMaterial){
    this.slabs=meshes.map(mesh=>{
      const p=(mesh.geometry as BoxGeometry).parameters;
      mesh.updateMatrix();
      return {interior:!!(mesh.material as MeshStandardMaterial).userData.interiorPartition,bottom:Math.max(CUTAWAY_HEIGHT,mesh.position.y-p.height/2),top:mesh.position.y+p.height/2,
        corners:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>new Vector3(x*p.width/2,0,z*p.depth/2).applyMatrix4(mesh.matrix).setY(0))};
    }).filter(s=>s.top>s.bottom);
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(this.slabs.length*18),3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('normal',new BufferAttribute(new Float32Array(this.slabs.length*18),3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('uv',new BufferAttribute(new Float32Array(this.slabs.length*12),2).setUsage(DynamicDrawUsage));
    geometry.setDrawRange(0,0);geometry.boundingBox=new Box3();geometry.boundingSphere=new Sphere(new Vector3(),0);
    const surface=material.clone();surface.userData={cutawayCap:true,verticalCap:true};
    this.mesh=new Mesh(geometry,surface);this.mesh.name='vertical-cutaway-caps';
    this.mesh.userData={cutawayCap:true,verticalCap:true};this.mesh.visible=false;this.mesh.receiveShadow=true;
  }

  update(plane:Plane,includeInterior=true):void {
    const key=[plane.normal.x,plane.normal.z,plane.constant,includeInterior].join(',');
    if(key===this.signature)return;
    const geometry=this.mesh.geometry,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
    const bounds=geometry.boundingBox!;bounds.makeEmpty();let count=0;
    for(const slab of this.slabs){
      if(slab.interior&&!includeInterior)continue;
      const distances=slab.corners.map(p=>plane.distanceToPoint(p));
      // Merely touching an existing face needs no second coplanar surface.
      if(Math.min(...distances)>=-1e-6||Math.max(...distances)<=1e-6)continue;
      const hits:Vector3[]=[];
      for(let i=0;i<4;i++){
        const j=(i+1)%4,a=distances[i],b=distances[j];
        if(a*b>0||Math.abs(a-b)<1e-10)continue;
        const point=slab.corners[i].clone().lerp(slab.corners[j],a/(a-b));
        if(!hits.some(hit=>hit.distanceToSquared(point)<1e-12))hits.push(point);
      }
      if(hits.length!==2)continue;
      let [a,b]=hits;
      const tangent=new Vector3(-plane.normal.z,0,plane.normal.x);
      if(b.clone().sub(a).dot(tangent)<0)[a,b]=[b,a];
      a.addScaledVector(tangent,-CAP_EDGE_GUARD);b.addScaledVector(tangent,CAP_EDGE_GUARD);
      const width=a.distanceTo(b),height=slab.top-slab.bottom;
      for(const [side,high] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){
        const point=(side?b:a).clone().setY(high?slab.top:slab.bottom);
        positions.setXYZ(count,point.x,point.y,point.z);
        normals.setXYZ(count,-plane.normal.x,0,-plane.normal.z);uv.setXY(count,side*width,high*height);
        bounds.expandByPoint(point);count++;
      }
    }
    geometry.setDrawRange(0,count);
    positions.needsUpdate=normals.needsUpdate=uv.needsUpdate=true;
    if(count)bounds.getBoundingSphere(geometry.boundingSphere!);
    else geometry.boundingSphere!.set(new Vector3(),0);
    this.signature=key;
  }
}
