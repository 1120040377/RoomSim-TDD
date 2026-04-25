import {
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Material,
} from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';
import { buildDefaultBox } from './shared';

const CORD_LENGTH_CM = 30;

export function buildLampCeiling(g: Group, f: Furniture, ceilingHeightCm: number): void {
  const ceilingY = ceilingHeightCm * CM_TO_M;
  const cordLen = CORD_LENGTH_CM * CM_TO_M;
  const shadeRadius = Math.min(f.size.width, f.size.depth) / 2 * 0.6 * CM_TO_M;

  // 天花板锚（小圆盘）
  const anchor = new Mesh(
    new CylinderGeometry(0.04, 0.04, 0.02, 12),
    new MeshStandardMaterial({ color: 0x2d2d2d, roughness: 0.6 }),
  );
  anchor.position.y = ceilingY - 0.01;
  g.add(anchor);

  // 线缆
  const cord = new Mesh(
    new CylinderGeometry(0.005, 0.005, cordLen, 8),
    new MeshStandardMaterial({ color: 0x1a1a1a }),
  );
  cord.position.y = ceilingY - cordLen / 2;
  g.add(cord);

  // 灯罩：二十面体 + 自发光
  const baseColor = new Color(f.color ?? '#fff4d0');
  const shadeMat = new MeshStandardMaterial({
    color: baseColor,
    emissive: baseColor,
    emissiveIntensity: 0.9,
    roughness: 0.3,
    metalness: 0.1,
  });
  const shadeGeom = new IcosahedronGeometry(shadeRadius, 0);
  const shade = new Mesh(shadeGeom, shadeMat);
  shade.position.y = ceilingY - cordLen - shadeRadius;
  shade.castShadow = false;
  shade.receiveShadow = false;
  shade.name = 'lamp-shade';
  g.add(shade);

  // 灯罩底部小球，点亮感更强（与 PointLight 的发光源对齐）
  const bulb = new Mesh(
    new SphereGeometry(shadeRadius * 0.4, 12, 12),
    new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff4d0,
      emissiveIntensity: 2.0,
    }),
  );
  bulb.position.y = shade.position.y - shadeRadius * 0.1;
  g.add(bulb);

  // P1：关灯时需通过 shadeMat 降低 emissiveIntensity
  void (shadeMat as Material);
}

export function buildLampFloor(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildLampWall(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildSwitch(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}
