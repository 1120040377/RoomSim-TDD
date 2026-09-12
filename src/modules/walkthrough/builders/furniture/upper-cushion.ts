import { BufferGeometry, Float32BufferAttribute } from 'three';

/** Extract the disconnected upper cushion, preserving original UV seams and
 * normals. Position welding is used only for connectivity, never for output.
 */
export function extractUpperCushion(source:BufferGeometry,part:'upper'|'seat'='upper'):BufferGeometry|null {
  const p=source.getAttribute('position'),index=source.index;
  if(!index||!p.count)return null;
  const parent=Array.from({length:p.count},(_,i)=>i);
  const find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]));
  const join=(a:number,b:number)=>{parent[find(a)]=find(b);};
  const positions=new Map<string,number>();let highest=0;
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(',');
    const previous=positions.get(key);if(previous!==undefined)join(i,previous);else positions.set(key,i);
    if(part==='upper'?p.getY(i)>p.getY(highest):p.getY(i)<p.getY(highest))highest=i;
  }
  for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i),index.getX(i+2));}
  const root=find(highest),oldIds:number[]=[],mapping=new Map<number,number>(),indices:number[]=[];
  for(let i=0;i<index.count;i+=3){
    if(find(index.getX(i))!==root)continue;
    for(let j=0;j<3;j++){
      const id=index.getX(i+j);
      if(!mapping.has(id)){mapping.set(id,oldIds.length);oldIds.push(id);}
      indices.push(mapping.get(id)!);
    }
  }
  if(indices.length===index.count)return null; // Not a separately authored cushion.
  const geometry=new BufferGeometry();
  for(const name of ['position','normal','uv']){
    const attribute=source.getAttribute(name);if(!attribute){geometry.dispose();return null;}
    const values:number[]=[];
    for(const id of oldIds){values.push(attribute.getX(id),attribute.getY(id));if(attribute.itemSize===3)values.push(attribute.getZ(id));}
    geometry.setAttribute(name,new Float32BufferAttribute(values,attribute.itemSize));
  }
  // Remove the lounge chair's recline before resizing to sofa modules. Without
  // this, its sloped bounding box consumes the target thickness and flattens the pad.
  geometry.setIndex(indices);geometry.rotateX(part==='upper'?.42:.12);geometry.computeBoundingBox();return geometry;
}
