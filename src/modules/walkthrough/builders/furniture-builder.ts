import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { Furniture, Plan } from '@/modules/model/types';
import { FURNITURE_CATALOG, type InteractiveKind } from '@/modules/templates/furniture-catalog';
import { CM_TO_M } from '../coord';

/** 吊灯线缆长度（天花板向下 30cm） */
const CORD_LENGTH_CM = 30;

export function buildFurniture(plan: Plan): Group {
  const group = new Group();
  group.name = 'furniture';

  const ceilingHeightCm = plan.meta.defaultWallHeight;

  for (const f of Object.values(plan.furniture)) {
    group.add(buildOne(f, ceilingHeightCm));
  }

  return group;
}

function buildOne(f: Furniture, ceilingHeightCm: number): Group {
  const def = FURNITURE_CATALOG[f.type];
  const g = new Group();
  g.name = `furniture-${f.id}`;
  (g.userData as Record<string, unknown>).furnitureId = f.id;

  // 吊灯走专用几何（线缆 + 发光灯罩）
  if (f.type === 'lamp-ceiling') {
    buildCeilingLamp(g, f, ceilingHeightCm);
  } else {
    buildDefaultBox(g, f, ceilingHeightCm);
  }

  g.position.set(f.position.x * CM_TO_M, 0, f.position.y * CM_TO_M);
  g.rotation.y = -f.rotation;

  // 可交互家具：把 interactable 挂到 group 里第一个 Mesh 上（raycaster 会遍历子节点）
  if (def?.interactive) {
    attachInteractable(g, f.id, def.interactive);
  }

  return g;
}

function buildDefaultBox(g: Group, f: Furniture, ceilingHeightCm: number): void {
  const def = FURNITURE_CATALOG[f.type];
  const w = f.size.width * CM_TO_M;
  const d = f.size.depth * CM_TO_M;
  const h = f.size.height * CM_TO_M;

  const color = new Color(f.color ?? def?.defaultColor ?? '#a3a3a3');
  const mat = new MeshStandardMaterial({ color, roughness: 0.7 });

  const geom = new BoxGeometry(w, h, d);
  const mesh = new Mesh(geom, mat);

  // mountPoint: ceiling → 盒子顶部贴天花板
  // mountPoint: wall   → 近似贴天花板下沿（需要墙面向量才能精确贴墙，P1）
  // 其他               → 底面贴地
  if (def?.mountPoint === 'ceiling') {
    mesh.position.y = ceilingHeightCm * CM_TO_M - h / 2;
  } else if (def?.mountPoint === 'wall') {
    mesh.position.y = ceilingHeightCm * CM_TO_M - h / 2 - 0.4; // 壁灯挂在离天花板 40cm 左右
  } else {
    mesh.position.y = h / 2;
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  // 轮廓线（清晰辨识）
  const edges = new EdgesGeometry(geom);
  const line = new LineSegments(edges, new LineBasicMaterial({ color: 0x525252 }));
  line.position.y = mesh.position.y;
  g.add(line);
}

/** 吊灯：从天花板垂下一根细线，下方一个多面体灯罩（微微自发光）。*/
function buildCeilingLamp(g: Group, f: Furniture, ceilingHeightCm: number): void {
  const ceilingY = ceilingHeightCm * CM_TO_M;
  const cordLen = CORD_LENGTH_CM * CM_TO_M;
  // 灯罩半径由 catalog 尺寸推导，取 min(w, d)/2 * 0.6 作为视觉合理半径
  const shadeRadius = Math.min(f.size.width, f.size.depth) / 2 * 0.6 * CM_TO_M;

  // 1. 天花板锚（小圆盘）
  const anchor = new Mesh(
    new CylinderGeometry(0.04, 0.04, 0.02, 12),
    new MeshStandardMaterial({ color: 0x2d2d2d, roughness: 0.6 }),
  );
  anchor.position.y = ceilingY - 0.01;
  g.add(anchor);

  // 2. 线缆
  const cord = new Mesh(
    new CylinderGeometry(0.005, 0.005, cordLen, 8),
    new MeshStandardMaterial({ color: 0x1a1a1a }),
  );
  cord.position.y = ceilingY - cordLen / 2;
  g.add(cord);

  // 3. 灯罩：二十面体 + 自发光
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

  // 4. 灯罩底部一个小球，点亮感更强（与 PointLight 的发光源对齐）
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

  // 关灯时降低 emissive 需要能拿到 shadeMat —— 暂不实现，P1 可在 toggleLight 里同步
  void (shadeMat as Material);
}

function attachInteractable(g: Group, id: string, kind: InteractiveKind): void {
  const hint =
    kind === 'tv' ? '按 E 开关电视'
      : kind === 'light' ? '按 E 开关灯'
        : kind === 'switch' ? '按 E 切换灯光'
          : '按 E 交互';
  const info = { kind, targetId: id, hint };
  // raycaster 会遍历子节点，所以挂到 group 即可
  (g.userData as Record<string, unknown>).interactable = info;
  g.traverse((child: Object3D) => {
    (child.userData as Record<string, unknown>).interactable = info;
  });
}
