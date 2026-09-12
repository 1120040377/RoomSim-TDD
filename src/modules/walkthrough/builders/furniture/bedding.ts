import { BufferGeometry, Float32BufferAttribute, DoubleSide, Group, Mesh, PlaneGeometry } from 'three';
import { fabricMaterial } from './material-library';

/** Continuous cloth with broad folds and soft side/foot drape; no rigid blanket box. */
export function addDuvet(group: Group, width: number, depth: number, top: number, foot: number, color: string,profile:'duvet'|'throw'='duvet'): Mesh {
  const geometry = new PlaneGeometry(width, depth, 30, 34);
  const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  for(let i=0;i<positions.count;i++) {
    const across=uv.getX(i)*2-1,along=Math.pow(uv.getY(i),1.5);
    // Spend the existing vertex budget at the edge rolls instead of adding
    // subdivisions everywhere; the centre only needs broad, shallow folds.
    const x = Math.sign(across)*(1-Math.pow(1-Math.abs(across),1.5))*width/2;
    const hemWave = Math.sin(x * 9 + 0.7) * 0.009 + Math.sin(x * 17) * 0.003;
    const z = foot + 0.035 - along * depth + hemWave * Math.pow(1 - along, 3);
    const side = smooth((Math.abs(x) - width / 2 + 0.085) / 0.085);
    const end = smooth((0.09 - along * depth) / 0.09);
    const broadFold = Math.sin(x * 8 + z * 3) * 0.011 + Math.sin(x * 17 - z * 5) * 0.006
      + Math.exp(-Math.pow((x+0.17+z*0.22)/0.12,2))*0.026
      + Math.exp(-Math.pow((x-0.32+z*0.34)/0.09,2))*0.019;
    // A woven throw is not a second inflated duvet. Preserve broad settling
    // folds, with finer gathers concentrated at the unsupported edges.
    const gather=Math.pow(Math.abs(x)/(width/2),5)*Math.sin(z*27+x*5)*.007
      + Math.pow(1-along,4)*Math.sin(x*24+along*5)*.006;
    const diagonal=Math.exp(-Math.pow((x+.24-along*.3)/.045,2))*.009*Math.sin(along*Math.PI);
    const fold=profile==='throw'?broadFold*.55+gather+diagonal:broadFold;
    const rollPosition = 0.93 + Math.sin(x * 4 + 1) * 0.018;
    const roll = Math.exp(-Math.pow((along - rollPosition) * 20, 2)) * (profile==='throw'?.011:.036);
    const drop = Math.max(side * (0.13 + Math.sin(z * 8) * 0.013), end * (0.16 + hemWave));
    positions.setXYZ(i, x, top + 0.035 + fold + roll - drop, z);
    uv.setXY(i, x+width/2, along*depth);
  }
  // Turn the paper-thin boundary into a sewn, rounded hem. Only the perimeter
  // receives extra vertices; the broad cloth surface keeps its existing budget.
  const rim: number[] = [];
  for(let x=0;x<=30;x++)rim.push(x);
  for(let y=1;y<=34;y++)rim.push(y*31+30);
  for(let x=29;x>=0;x--)rim.push(34*31+x);
  for(let y=33;y>=1;y--)rim.push(y*31);
  const vertices=Array.from(positions.array), texcoords=Array.from(uv.array), indices=Array.from(geometry.index!.array);
  const rings=[rim];
  const radius=profile==='throw'?.004:.009;
  for(let step=1;step<=3;step++){
    const ring:number[]=[], angle=step*Math.PI/3;
    for(let j=0;j<rim.length;j++){
      const index=rim[j],prev=rim[(j+rim.length-1)%rim.length],next=rim[(j+1)%rim.length];
      const dx=positions.getX(next)-positions.getX(prev),dz=positions.getZ(next)-positions.getZ(prev);
      const length=Math.hypot(dx,dz)||1;
      ring.push(vertices.length/3);
      vertices.push(positions.getX(index)+dz/length*radius*Math.sin(angle),
        positions.getY(index)-radius*(1-Math.cos(angle)),positions.getZ(index)-dx/length*radius*Math.sin(angle));
      texcoords.push(uv.getX(index),uv.getY(index)+radius*angle);
    }
    rings.push(ring);
  }
  for(let step=0;step<3;step++)for(let j=0;j<rim.length;j++){
    const next=(j+1)%rim.length,a=rings[step][j],b=rings[step][next],c=rings[step+1][next],d=rings[step+1][j];
    indices.push(a,b,d,b,c,d);
  }
  const cloth=new BufferGeometry();
  cloth.setAttribute('position',new Float32BufferAttribute(vertices,3));
  cloth.setAttribute('uv',new Float32BufferAttribute(texcoords,2));
  cloth.setIndex(indices);cloth.computeVertexNormals();geometry.dispose();
  const material = fabricMaterial(color, 67); material.side = DoubleSide;
  const mesh = new Mesh(cloth, material); mesh.castShadow = mesh.receiveShadow = true;
  mesh.name=profile==='throw'?'woven-bed-throw':'bed-duvet';
  group.add(mesh); return mesh;
}
