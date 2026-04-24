import { Group, PointLight } from 'three';
import type { Furniture, Plan } from '@/modules/model/types';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';
import { CM_TO_M } from './coord';

const DEFAULT_INTENSITY = 1.0;

/** 按 "lamp-ceiling / lamp-floor / lamp-wall" 家具生成 PointLight。*/
export function buildRoomLights(plan: Plan): {
  group: Group;
  lightsByFurnitureId: Record<string, PointLight>;
} {
  const group = new Group();
  group.name = 'room-lights';
  const lightsByFurnitureId: Record<string, PointLight> = {};
  const ceilingHeightCm = plan.meta.defaultWallHeight;

  for (const f of Object.values(plan.furniture)) {
    const def = FURNITURE_CATALOG[f.type];
    if (def?.interactive !== 'light') continue;
    const light = buildLightFor(f, ceilingHeightCm);
    lightsByFurnitureId[f.id] = light;
    group.add(light);
  }

  return { group, lightsByFurnitureId };
}

/** 吊灯线缆长度，需与 furniture-builder 的 CORD_LENGTH_CM 保持一致 */
const CEILING_LAMP_CORD_CM = 30;

function buildLightFor(f: Furniture, ceilingHeightCm: number): PointLight {
  const light = new PointLight(0xfff0cc, DEFAULT_INTENSITY, 8, 2);
  // 发光高度：
  //  - 吊灯：天花板 − 线缆 − 灯罩半径（与模型发光位置对齐）
  //  - 壁灯：离天花板约 60cm
  //  - 落地灯/台灯：家具顶部
  let h: number;
  if (f.type === 'lamp-ceiling') {
    const shadeRadius = (Math.min(f.size.width, f.size.depth) / 2) * 0.6;
    h = ceilingHeightCm - CEILING_LAMP_CORD_CM - shadeRadius;
  } else if (f.type === 'lamp-wall') {
    h = Math.max(0, ceilingHeightCm - 60);
  } else {
    h = f.size.height;
  }
  light.position.set(f.position.x * CM_TO_M, h * CM_TO_M, f.position.y * CM_TO_M);
  (light.userData as Record<string, unknown>).furnitureId = f.id;
  const on = (f.runtimeState?.on as boolean | undefined) ?? true;
  light.intensity = on ? DEFAULT_INTENSITY : 0;
  return light;
}

export function toggleLight(light: PointLight): boolean {
  light.intensity = light.intensity > 0 ? 0 : DEFAULT_INTENSITY;
  return light.intensity > 0;
}
