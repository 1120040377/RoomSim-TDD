import {
  Group,
  Mesh,
  Shape,
  ShapeGeometry,
} from 'three';
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

  const material = floorMaterial(plan.renovation?.finish ?? defaultRenovation().finish);

  for (const room of Object.values(plan.rooms)) {
    if (room.polygon.length < 3) continue;

    const shape = new Shape();
    shape.moveTo(room.polygon[0].x * CM_TO_M, -room.polygon[0].y * CM_TO_M);
    for (let i = 1; i < room.polygon.length; i++) {
      shape.lineTo(room.polygon[i].x * CM_TO_M, -room.polygon[i].y * CM_TO_M);
    }
    shape.closePath();

    const geom = new ShapeGeometry(shape);
    const mesh = new Mesh(geom, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.receiveShadow = true;
    mesh.name = `floor-${room.id}`;
    (mesh.userData as Record<string, unknown>).roomId = room.id;
    group.add(mesh);
  }

  return group;
}
