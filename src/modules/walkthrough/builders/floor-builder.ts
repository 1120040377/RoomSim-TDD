import {
  Group,
  Mesh,
  Shape,
  ShapeGeometry,
  MeshStandardMaterial,
  ExtrudeGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Plan } from '@/modules/model/types';
import { CM_TO_M } from '../coord';
import { defaultRenovation } from '@/modules/renovation/model';
import { floorMaterial } from './finish-material';

/**
 * 以每个 room 的 polygon 创建一片地板。polygon 是 editor 坐标；
 * 映射 editor.x → shape.x, editor.y → shape.y，随后把 ShapeGeometry
 * 绕 X 轴旋转 -π/2 贴到水平面上，并把 y 设置为 0。
 *
 * 旋转 -π/2 会将 shape.y 映射到 -z，因此先对 shape.y 取负，确保
 * editor.y 正确映射到 3D +z，并保持地板法线朝上。
 */
export function buildFloor(plan: Plan): Group {
  const group = new Group();
  group.name = 'floor';

  const fallback = plan.renovation?.finish ?? defaultRenovation().finish;
  const materials = new Map<string, MeshStandardMaterial>();
  const slabs:BufferGeometry[]=[];

  for (const room of Object.values(plan.rooms)) {
    if (room.polygon.length < 3) continue;
    const finish = { ...fallback, ...plan.renovation?.roomFloors?.[room.id] };
    const key = `${finish.floor}/${finish.floorColor}`;
    let material = materials.get(key);
    if (!material) { material = floorMaterial(finish); materials.set(key, material); }

    const shape = new Shape();
    shape.moveTo(room.polygon[0].x * CM_TO_M, -room.polygon[0].y * CM_TO_M);
    for (let i = 1; i < room.polygon.length; i++) {
      shape.lineTo(room.polygon[i].x * CM_TO_M, -room.polygon[i].y * CM_TO_M);
    }
    shape.closePath();
    // A display slab below the walking plane, not structural engineering data.
    // Keep each room polygon: a bounding rectangle would fill courtyards/notches.
    const slab=new ExtrudeGeometry(shape,{depth:0.18,bevelEnabled:false,steps:1,curveSegments:1});
    slab.rotateX(-Math.PI/2);slab.translate(0,-0.181,0);slab.clearGroups();
    // The finish mesh already closes the top. Remove the hidden parallel cap,
    // which otherwise z-fights at distant overview camera depths.
    const positions=slab.getAttribute('position'),indices:number[]=[];
    for(let i=0;i<positions.count;i+=3){
      if([i,i+1,i+2].every(j=>positions.getY(j)>-0.002))continue;
      indices.push(i,i+1,i+2);
    }
    slab.setIndex(indices);slabs.push(slab);

    const geom = new ShapeGeometry(shape);
    const mesh = new Mesh(geom, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.receiveShadow = true;
    mesh.name = `floor-${room.id}`;
    (mesh.userData as Record<string, unknown>).roomId = room.id;
    group.add(mesh);
  }

  if(slabs.length){
    const geometry=mergeGeometries(slabs,false);
    slabs.forEach(slab=>slab.dispose());
    if(geometry){
      const material=new MeshStandardMaterial({color:'#b6ac9b',roughness:0.93,metalness:0,envMapIntensity:0.25});
      const base=new Mesh(geometry,material);base.name='floor-slab';base.receiveShadow=true;
      group.add(base);
    }
  }

  return group;
}
