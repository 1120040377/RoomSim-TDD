import { Float32BufferAttribute, Vector2, Vector3, type Mesh } from 'three';

type Rect = { left:number; right:number; bottom:number; top:number };
const EPS = .00001;
function subtract(rect:Rect, cut:Rect):Rect[] {
  const left=Math.max(rect.left,cut.left),right=Math.min(rect.right,cut.right);
  const bottom=Math.max(rect.bottom,cut.bottom),top=Math.min(rect.top,cut.top);
  if(right-left<=EPS||top-bottom<=EPS)return [rect];
  return [
    {left:rect.left,right:left,bottom:rect.bottom,top:rect.top},
    {left:right,right:rect.right,bottom:rect.bottom,top:rect.top},
    {left,right,bottom:rect.bottom,top:bottom},
    {left,right,bottom:top,top:rect.top},
  ].filter(piece=>piece.right-piece.left>EPS&&piece.top-piece.bottom>EPS);
}
function bounds(points:Vector2[]):Rect {
  return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),
    bottom:Math.min(...points.map(p=>p.y)),top:Math.max(...points.map(p=>p.y))};
}

/** Trim buried rectangles once during construction. Preserve exposed jambs,
 * metre-scale UVs, wall dimensions and different cutaway policies. Returns the
 * net triangle reduction (can be negative for a face with several cutouts).
 */
export function removeInternalWallFaces(meshes: Mesh[]): number {
  const faces=meshes.flatMap(mesh=>{
    mesh.updateWorldMatrix(true,false);
    const geometry=mesh.geometry,index=geometry.index;
    if(!index)return [];
    const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
    return geometry.groups.map(group=>{
      const ids=[...new Set(Array.from({length:group.count},(_,i)=>index.getX(group.start+i)))];
      const local=ids.map(i=>new Vector3().fromBufferAttribute(position,i));
      const points=local.map(p=>p.clone().applyMatrix4(mesh.matrixWorld));
      const origin=points[0],n=new Vector3().fromBufferAttribute(normal,ids[0]).transformDirection(mesh.matrixWorld);
      const u=points[1].clone().sub(origin).normalize(),v=new Vector3().crossVectors(n,u).normalize();
      const project=(point:Vector3)=>{const delta=point.clone().sub(origin);return new Vector2(delta.dot(u),delta.dot(v));};
      const coords=points.map(project),rect=bounds(coords);
      const texcoords=ids.map(i=>new Vector2(uv.getX(i),uv.getY(i)));
      const alongU=coords.findIndex(p=>Math.abs(p.x)>EPS&&Math.abs(p.y)<EPS);
      const alongV=coords.findIndex(p=>Math.abs(p.y)>EPS&&Math.abs(p.x)<EPS);
      return {mesh,group,points,origin,n,u,v,project,rect,texcoords,coords,alongU,alongV,
        interior:!!material.userData.interiorPartition,pieces:[rect],changed:false,
        localNormal:new Vector3().fromBufferAttribute(normal,ids[0])};
    });
  });
  for(const face of faces) {
    if(face.alongU<0||face.alongV<0)continue;
    for(const other of faces) {
      if(face.mesh===other.mesh||face.interior!==other.interior||face.n.dot(other.n)>-.999999)continue;
      if(Math.abs(face.n.dot(other.origin.clone().sub(face.origin)))>EPS)continue;
      const points=other.points.map(face.project),cut=bounds(points);
      // Bounding rectangles must not erase material at oblique intersections.
      if(!points.every(p=>(Math.abs(p.x-cut.left)<EPS||Math.abs(p.x-cut.right)<EPS)
        &&(Math.abs(p.y-cut.bottom)<EPS||Math.abs(p.y-cut.top)<EPS)))continue;
      const pieces=face.pieces.flatMap(piece=>subtract(piece,cut));
      if(pieces.length!==face.pieces.length||pieces.some((p,i)=>p!==face.pieces[i]))face.changed=true;
      face.pieces=pieces;
    }
  }
  let reduction=0;
  for(const mesh of meshes) {
    const own=faces.filter(face=>face.mesh===mesh);
    if(!own.some(face=>face.changed))continue;
    const geometry=mesh.geometry,positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
    const inverse=mesh.matrixWorld.clone().invert();
    for(const face of own) {
      const du=face.texcoords[face.alongU].clone().sub(face.texcoords[0]).divideScalar(face.coords[face.alongU].x);
      const dv=face.texcoords[face.alongV].clone().sub(face.texcoords[0]).divideScalar(face.coords[face.alongV].y);
      for(const piece of face.pieces) {
        const start=positions.length/3;
        for(const [x,y] of [[piece.left,piece.bottom],[piece.right,piece.bottom],[piece.right,piece.top],[piece.left,piece.top]]) {
          const p=face.origin.clone().addScaledVector(face.u,x).addScaledVector(face.v,y).applyMatrix4(inverse);
          positions.push(p.x,p.y,p.z);normals.push(face.localNormal.x,face.localNormal.y,face.localNormal.z);
          uvs.push(face.texcoords[0].x+du.x*x+dv.x*y,face.texcoords[0].y+du.y*x+dv.y*y);
        }
        indices.push(start,start+1,start+2,start,start+2,start+3);
      }
    }
    reduction+=(geometry.index!.count-indices.length)/3;
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.clearGroups();
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
  }
  return reduction;
}
