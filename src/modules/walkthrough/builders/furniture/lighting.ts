import {
  BoxGeometry,
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

const CORD_LENGTH_CM = 30;

// ─── 吊灯 ──────────────────────────────────────────────────────────────────────

export function buildLampCeiling(g: Group, f: Furniture, ceilingHeightCm: number): void {
  const ceilingY = ceilingHeightCm * CM_TO_M;
  const cordLen = CORD_LENGTH_CM * CM_TO_M;
  const shadeRadius = Math.min(f.size.width, f.size.depth) / 2 * 0.6 * CM_TO_M;

  const anchor = new Mesh(
    new CylinderGeometry(0.04, 0.04, 0.02, 12),
    new MeshStandardMaterial({ color: 0x2d2d2d, roughness: 0.6 }),
  );
  anchor.position.y = ceilingY - 0.01;
  g.add(anchor);

  const cord = new Mesh(
    new CylinderGeometry(0.005, 0.005, cordLen, 8),
    new MeshStandardMaterial({ color: 0x1a1a1a }),
  );
  cord.position.y = ceilingY - cordLen / 2;
  g.add(cord);

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

  const bulb = new Mesh(
    new SphereGeometry(shadeRadius * 0.4, 12, 12),
    new MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 2.0 }),
  );
  bulb.position.y = shade.position.y - shadeRadius * 0.1;
  g.add(bulb);

  // P1：关灯时需通过 shadeMat 降低 emissiveIntensity
  void (shadeMat as Material);
}

// ─── 落地灯 ────────────────────────────────────────────────────────────────────

export function buildLampFloor(g: Group, f: Furniture, _ceilingHeightCm: number): void {
  const H = f.size.height * CM_TO_M;   // 1.60

  const matMetal  = new MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.4, metalness: 0.6 });
  const matShade  = new MeshStandardMaterial({ color: 0xe8d5b0, roughness: 0.7 });

  // 底座
  const baseMesh = new Mesh(new CylinderGeometry(0.18, 0.18, 0.06, 20), matMetal);
  baseMesh.position.y = 0.03;
  g.add(baseMesh);

  // 灯杆
  const poleH = H * 0.84;
  const poleMesh = new Mesh(new CylinderGeometry(0.02, 0.02, poleH, 10), matMetal);
  poleMesh.position.y = 0.06 + poleH / 2;
  g.add(poleMesh);

  // 灯罩（上窄下宽圆台）
  const shadeH = H * 0.14;
  const shadeY = 0.06 + poleH + shadeH / 2;
  const shadeMesh = new Mesh(new CylinderGeometry(0.08, 0.18, shadeH, 20), matShade);
  shadeMesh.position.y = shadeY;
  g.add(shadeMesh);

  // 灯泡
  const baseColor = new Color(f.color ?? '#fff4d0');
  const bulb = new Mesh(
    new SphereGeometry(0.06, 10, 10),
    new MeshStandardMaterial({ color: 0xffffff, emissive: baseColor, emissiveIntensity: 1.5 }),
  );
  bulb.position.y = shadeY - shadeH * 0.2;
  g.add(bulb);
}

// ─── 壁灯 ──────────────────────────────────────────────────────────────────────

export function buildLampWall(g: Group, f: Furniture, ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const D = f.size.depth * CM_TO_M;
  const H = f.size.height * CM_TO_M;

  const matMount = new MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.4, metalness: 0.5 });
  const matShade = new MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.6 });

  // 挂墙底座板（贴 +Z 端）
  const plateD = 0.04;
  const mountY = ceilingHeightCm * CM_TO_M - H / 2 - 0.4;
  const plate = new Mesh(new BoxGeometry(W, H, plateD), matMount);
  plate.position.set(0, mountY, D / 2 - plateD / 2);
  g.add(plate);

  // 灯罩（向 −Z 伸出）
  const shadeR = Math.min(W, H) * 0.40;
  const shadeH = D - plateD;
  const shade = new Mesh(new CylinderGeometry(shadeR * 0.6, shadeR, shadeH, 16), matShade);
  shade.rotation.x = Math.PI / 2;
  shade.position.set(0, mountY, D / 2 - plateD - shadeH / 2);
  g.add(shade);

  // 灯泡
  const baseColor = new Color(f.color ?? '#fff4d0');
  const bulb = new Mesh(
    new SphereGeometry(shadeR * 0.35, 8, 8),
    new MeshStandardMaterial({ color: 0xffffff, emissive: baseColor, emissiveIntensity: 1.5 }),
  );
  bulb.position.copy(shade.position);
  g.add(bulb);
}

// ─── 墙面开关 ──────────────────────────────────────────────────────────────────

export function buildSwitch(g: Group, f: Furniture, ceilingHeightCm: number): void {
  const W = f.size.width * CM_TO_M;
  const H = f.size.height * CM_TO_M;
  const D = f.size.depth * CM_TO_M;

  const matPlate  = new MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 });
  const matButton = new MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.5 });

  const wallY = ceilingHeightCm * CM_TO_M - H / 2 - 0.4;

  // 面板
  const plate = new Mesh(new BoxGeometry(W, H, D), matPlate);
  plate.position.set(0, wallY, 0);
  g.add(plate);

  // 按钮（略突出于面板 −Z 面）
  const btn = new Mesh(new BoxGeometry(W * 0.62, H * 0.62, 0.005), matButton);
  btn.position.set(0, wallY, -(D / 2 + 0.003));
  g.add(btn);
}
