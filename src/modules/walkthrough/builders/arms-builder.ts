import {
  BoxGeometry,
  CylinderGeometry,
  FrontSide,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';

const SKIN = 0xe8c49a;

function skinMat(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: SKIN, roughness: 0.78, side: FrontSide });
}

function addMesh(g: Group, geom: CylinderGeometry | BoxGeometry, x: number, y: number, z: number, rx = 0, rz = 0): void {
  const mesh = new Mesh(geom, skinMat());
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, 0, rz);
  mesh.renderOrder = 999;
  mesh.material.depthTest = false;
  g.add(mesh);
}

/**
 * 返回一个挂在 camera 子节点上的手臂 Group。
 * 相机坐标系：+x 右，+y 上，-z 前方。
 * 手臂出现在视野右下角（右手）和左下角（左手）。
 */
export function buildFirstPersonArms(): Group {
  const arms = new Group();
  arms.name = 'fp-arms';

  arms.add(buildOneArm('right'));
  arms.add(buildOneArm('left'));

  return arms;
}

function buildOneArm(side: 'left' | 'right'): Group {
  const g = new Group();
  g.name = `fp-arm-${side}`;

  const sign = side === 'right' ? 1 : -1;

  // 手臂整体偏移：左右±0.18m，向下0.28m，向前0.38m
  g.position.set(sign * 0.18, -0.28, -0.38);

  // 上臂：从肩部向下，略向外倾
  // CylinderGeometry 默认沿 Y 轴，长0.22m，r上0.025 r下0.03
  addMesh(
    g,
    new CylinderGeometry(0.022, 0.028, 0.22, 8),
    0, -0.11, 0,
    0, sign * 0.18, // rz 向外倾
  );

  // 前臂：上臂末端再向下延伸，略向内收
  addMesh(
    g,
    new CylinderGeometry(0.020, 0.024, 0.20, 8),
    sign * 0.02, -0.32, 0.04,
    -0.15, sign * 0.08,
  );

  // 手：前臂末端
  addMesh(
    g,
    new BoxGeometry(0.07, 0.05, 0.035),
    sign * 0.03, -0.46, 0.08,
  );

  return g;
}
