import { Box3, CylinderGeometry, DoubleSide, Group, InstancedMesh, LatheGeometry, Mesh, Object3D, PlaneGeometry, Vector2, Vector3 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { paintedMaterial, porcelainMaterial } from './material-library';

/** Five olive-like sprigs in an open ceramic vase; no alpha cards or animation. */
export function buildBotanicalVase(g:Group,f:Furniture):void {
  const asset=new Group();
  const vase=new Mesh(new LatheGeometry([
    [0,0],[0.12,0],[0.17,0.04],[0.19,0.17],[0.16,0.29],[0.095,0.38],
    [0.095,0.43],[0.08,0.43],[0.08,0.38],[0.145,0.28],[0.16,0.17],[0.10,0.035],[0,0.035],
  ].map(([x,y])=>new Vector2(x,y)),24),porcelainMaterial(f.color??'#d6ccba'));
  asset.add(vase);
  const stems=new InstancedMesh(new CylinderGeometry(0.003,0.005,1,6),paintedMaterial('#6c6850',0.92),5);
  const leafGeometry=new PlaneGeometry(1,1,2,6),p=leafGeometry.getAttribute('position'),uv=leafGeometry.getAttribute('uv');
  for(let i=0;i<p.count;i++){
    const t=uv.getY(i),across=uv.getX(i)*2-1;
    p.setXYZ(i,across*Math.sin(t*Math.PI)*0.045,t*0.19,Math.sin(t*Math.PI)*0.018-across*across*0.01);
  }
  leafGeometry.computeVertexNormals();
  const green=paintedMaterial('#657753',0.72);green.side=DoubleSide;
  const leaves=new InstancedMesh(leafGeometry,green,30),transform=new Object3D(),up=new Vector3(0,1,0);
  for(let branch=0;branch<5;branch++){
    const angle=branch*2.39996,origin=new Vector3(Math.cos(angle)*0.025,0.28,Math.sin(angle)*0.025);
    const tip=new Vector3(Math.cos(angle)*0.22,0.86+(branch%3)*0.075,Math.sin(angle)*0.22);
    const direction=tip.clone().sub(origin);
    transform.position.copy(origin).addScaledVector(direction,0.5);
    transform.quaternion.setFromUnitVectors(up,direction.clone().normalize());transform.scale.set(1,direction.length(),1);
    transform.updateMatrix();stems.setMatrixAt(branch,transform.matrix);
    for(let leaf=0;leaf<6;leaf++){
      const a=angle+(leaf%2?1:-1)*1.05,t=0.32+leaf*0.12;
      transform.position.copy(origin).lerp(tip,t);
      transform.quaternion.setFromUnitVectors(up,new Vector3(Math.cos(a),0.35,Math.sin(a)).normalize());
      const size=0.72+0.2*Math.sin(leaf*2+branch);transform.scale.setScalar(size);transform.updateMatrix();
      leaves.setMatrixAt(branch*6+leaf,transform.matrix);
    }
  }
  for(const mesh of [stems,leaves]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
  asset.add(stems,leaves);asset.traverse(o=>{if(o instanceof Mesh)o.castShadow=o.receiveShadow=true;});
  const bounds=new Box3().setFromObject(asset),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  asset.scale.set(f.size.width/100/size.x,f.size.height/100/size.y,f.size.depth/100/size.z);
  asset.position.set(-center.x*asset.scale.x,-bounds.min.y*asset.scale.y,-center.z*asset.scale.z);
  g.add(asset);
}
