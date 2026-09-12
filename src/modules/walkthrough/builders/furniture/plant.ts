import { Box3, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, Vector2, Vector3 } from 'three';
import type { Furniture } from '@/modules/model/types';
import { paintedMaterial } from './material-library';

/** Original, deterministic broadleaf plant: four draw batches, no alpha-cutout cards. */
export function buildFloorPlant(group: Group, furniture: Furniture): void {
  const plant = new Group();
  let seed = 2166136261;
  for (const char of furniture.id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const phase = (seed % 10007) / 10007 * Math.PI * 2;
  const pot = new Mesh(new LatheGeometry([
    new Vector2(0.13, 0), new Vector2(0.145, 0.015), new Vector2(0.20, 0.32),
    new Vector2(0.20, 0.34), new Vector2(0.182, 0.34), new Vector2(0.18, 0.315),
    new Vector2(0.13, 0.035), new Vector2(0, 0.035),
  ], 32), paintedMaterial(furniture.color ?? '#b7a58d', 0.86));
  plant.add(pot);
  const soil = new Mesh(new CylinderGeometry(0.18, 0.18, 0.015, 24), paintedMaterial('#3a3026', 1));
  soil.position.y = 0.31; plant.add(soil);
  const leafGeometry = new PlaneGeometry(1, 1, 2, 8);
  const positions = leafGeometry.getAttribute('position');
  const uv = leafGeometry.getAttribute('uv');
  const leafColors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const t = uv.getY(i), across = (uv.getX(i) - 0.5) * 2;
    const width = Math.pow(Math.sin(Math.PI * t), 0.9) * 0.065 * (1 + across * 0.09);
    positions.setXYZ(i, across * width + Math.sin(t * Math.PI) * 0.007, t * 0.26,
      Math.sin(t * Math.PI) * (0.02 - Math.abs(across) * 0.034) - t * t * 0.037
      + Math.sin(t*21+across)*Math.abs(across)*0.003);
    // Linear vertex tint: restrained midrib, darker margins and mature base.
    // The interpolated tint follows the existing leaf surface, not an alpha card.
    const shade = (0.72 + 0.28 * (1 - Math.abs(across))) * (0.83 + t * 0.17);
    leafColors.push(shade * 0.96, shade, shade * 0.90);
  }
  leafGeometry.setAttribute('color', new Float32BufferAttribute(leafColors, 3));
  leafGeometry.computeVertexNormals();
  const leafMaterial = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.48, side: DoubleSide, envMapIntensity:0.3 });
  const count = 72;
  const leaves = new InstancedMesh(leafGeometry, leafMaterial, count);
  // More leaf coverage with simpler individual leaves, not extra draw batches.
  // Five connected trunk sections, nine branches and 72 short petioles.
  const stems = new InstancedMesh(new CylinderGeometry(1, 1.15, 1, 6), paintedMaterial('#6c6048', 0.9), 86);
  const transform = new Object3D(), up = new Vector3(0, 1, 0);
  let stemIndex=0;
  const addStem=(origin:Vector3,base:Vector3,radius:number)=>{
    const direction=base.clone().sub(origin);
    transform.position.copy(origin).addScaledVector(direction, 0.5);
    transform.quaternion.setFromUnitVectors(up, direction.clone().normalize());
    transform.scale.set(radius,direction.length(),radius);transform.updateMatrix();
    stems.setMatrixAt(stemIndex++,transform.matrix);
  };
  const trunk=Array.from({length:6},(_,i)=>new Vector3(Math.sin(i*0.8+phase)*0.026,0.32+i*0.18,Math.sin(i*1.1+phase)*0.016));
  for(let i=0;i<5;i++)addStem(trunk[i],trunk[i+1],0.012-i*0.0016);
  for(let branch=0;branch<9;branch++){
    const level=1+branch*0.44,index=Math.floor(level),angle=phase+branch*2.399963+Math.sin(branch*3+phase)*0.25;
    const origin=trunk[index].clone().lerp(trunk[Math.min(5,index+1)],level-index);
    const radius=(0.18+Math.sin((branch+1)/10*Math.PI)*0.14)*(0.92+0.08*Math.sin(branch+phase));
    const tip=origin.clone().add(new Vector3(Math.cos(angle)*radius,0.1+0.055*Math.sin(branch*2),Math.sin(angle)*radius));
    addStem(origin,tip,0.0048-branch*0.00035);
    for(let leaf=0;leaf<8;leaf++){
      const i=branch*8+leaf,t=0.18+leaf*0.11;
      const start=origin.clone().lerp(tip,t),a=angle+(leaf%2?1:-1)*(0.65+0.12*Math.sin(i*2.1));
      const base=start.clone().add(new Vector3(Math.cos(a)*0.035,0.018,Math.sin(a)*0.035));
      addStem(start,base,0.0018);
      transform.position.copy(base);
      // Leaf normals favour the sky. A stem quaternion alone left many leaf
      // surfaces vertical/edge-on, exposing a sparse plastic-looking skeleton.
      const growth=new Vector3(Math.cos(a),0.20+0.35*Math.sin(i*1.7),Math.sin(a)).normalize();
      const side=growth.clone().cross(up).normalize();
      const normal=side.clone().cross(growth).normalize();
      transform.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(side,growth,normal));
      transform.rotateY(Math.sin(i*2.3)*0.38);
      const size=0.65+0.27*(0.5+0.5*Math.sin(i*2.43));
      transform.scale.set(size*(0.83+0.23*Math.sin(i*1.31)),size, size);transform.updateMatrix();
      leaves.setMatrixAt(i,transform.matrix);
      // HSL here is linear-light, not CSS HSL. The previous .16–.25
      // lightness became pale grey-green after display conversion.
      const young = leaf >= 6;
      leaves.setColorAt(i,new Color().setHSL(
        0.245+(i%4)*0.012, 0.40+(i%3)*0.035,
        (young ? 0.135 : 0.07)+(i%5)*0.009));
    }
  }
  leaves.instanceMatrix.needsUpdate = stems.instanceMatrix.needsUpdate = true;
  leaves.computeBoundingBox(); leaves.computeBoundingSphere();
  stems.computeBoundingBox(); stems.computeBoundingSphere();
  plant.add(stems, leaves);
  plant.traverse(object => { if (object instanceof Mesh) object.castShadow = object.receiveShadow = true; });
  const bounds = new Box3().setFromObject(plant), size = bounds.getSize(new Vector3());
  plant.scale.set(furniture.size.width / 100 / size.x, furniture.size.height / 100 / size.y, furniture.size.depth / 100 / size.z);
  const center = bounds.getCenter(new Vector3());
  plant.position.set(-center.x * plant.scale.x, -bounds.min.y * plant.scale.y, -center.z * plant.scale.z);
  group.add(plant);
}
