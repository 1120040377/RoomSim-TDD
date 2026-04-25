import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { Furniture } from '@/modules/model/types';
import { FURNITURE_CATALOG, type InteractiveKind } from '@/modules/templates/furniture-catalog';
import { CM_TO_M } from '../../coord';

export type FurnitureBuilderFn = (g: Group, f: Furniture, ceilingHeightCm: number) => void;

export function buildDefaultBox(g: Group, f: Furniture, ceilingHeightCm: number): void {
  const def = FURNITURE_CATALOG[f.type];
  const w = f.size.width * CM_TO_M;
  const d = f.size.depth * CM_TO_M;
  const h = f.size.height * CM_TO_M;

  const color = new Color(f.color ?? def?.defaultColor ?? '#a3a3a3');
  const mat = new MeshStandardMaterial({ color, roughness: 0.7 });

  const geom = new BoxGeometry(w, h, d);
  const mesh = new Mesh(geom, mat);

  if (def?.mountPoint === 'ceiling') {
    mesh.position.y = ceilingHeightCm * CM_TO_M - h / 2;
  } else if (def?.mountPoint === 'wall') {
    mesh.position.y = ceilingHeightCm * CM_TO_M - h / 2 - 0.4;
  } else {
    mesh.position.y = h / 2;
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  const edges = new EdgesGeometry(geom);
  const line = new LineSegments(edges, new LineBasicMaterial({ color: 0x525252 }));
  line.position.y = mesh.position.y;
  g.add(line);
}

export function attachInteractable(g: Group, id: string, kind: InteractiveKind): void {
  const hint =
    kind === 'tv' ? '按 E 开关电视'
      : kind === 'light' ? '按 E 开关灯'
        : kind === 'switch' ? '按 E 切换灯光'
          : '按 E 交互';
  const info = { kind, targetId: id, hint };
  (g.userData as Record<string, unknown>).interactable = info;
  g.traverse((child: Object3D) => {
    (child.userData as Record<string, unknown>).interactable = info;
  });
}
