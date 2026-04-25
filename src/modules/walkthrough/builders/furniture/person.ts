import {
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';

// gender: 0=neutral 1=male 2=female  (stored in f.runtimeState.gender)
type Gender = 0 | 1 | 2;

interface BodyColors {
  skin: number;
  top: number;
  bottom: number;
  hair: number;
  shoe: number;
}

const COLOR_BY_GENDER: Record<Gender, BodyColors> = {
  0: { skin: 0xddb891, top: 0x7a7a8a, bottom: 0x4a5568, hair: 0x3d2b1a, shoe: 0x2a2a2a },
  1: { skin: 0xe8c49a, top: 0x4a6fa5, bottom: 0x2d3748, hair: 0x2d2018, shoe: 0x1a1a1a },
  2: { skin: 0xf5d5b5, top: 0xc0516e, bottom: 0x9b7ecf, hair: 0x5c3820, shoe: 0x3a1a2a },
};

function mat(color: number, roughness = 0.75): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness });
}

function outlineMat(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: 0x90caf9,
    transparent: true,
    opacity: 0.22,
    side: BackSide,
    depthWrite: false,
  });
}

function addPart(
  g: Group,
  geom: BoxGeometry | CylinderGeometry | SphereGeometry,
  material: MeshStandardMaterial,
  x: number, y: number, z: number,
  rx = 0, ry = 0, rz = 0,
): void {
  const mesh = new Mesh(geom, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  const outline = new Mesh(geom, outlineMat());
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  outline.scale.setScalar(1.05);
  g.add(outline);
}

// ─── 站姿 ────────────────────────────────────────────────────────────────────

export function buildPersonStanding(g: Group, f: Furniture, _ceiling: number): void {
  const gender = ((f.runtimeState?.gender as Gender | undefined) ?? 0) as Gender;
  buildStandingBody(g, f.size.height, gender);
}

function buildStandingBody(g: Group, heightCm: number, gender: Gender): void {
  const c = COLOR_BY_GENDER[gender];
  const scale = heightCm / 170; // 以170cm为基准缩放

  // 比例基准（cm），最终×scale×CM_TO_M
  const s = (cm: number) => cm * scale * CM_TO_M;

  // 躯干宽度按性别
  const shoulderW = gender === 1 ? s(44) : gender === 2 ? s(38) : s(40);
  const hipW      = gender === 1 ? s(36) : gender === 2 ? s(42) : s(38);
  const waistW    = gender === 1 ? s(34) : gender === 2 ? s(28) : s(32);
  const legGap    = s(10); // 两腿间距

  // 脚 y:0–6
  const footH = s(6); const footW = s(10); const footD = s(24);
  addPart(g, new BoxGeometry(footW, footH, footD), mat(c.shoe), -legGap / 2, footH / 2, -s(8));
  addPart(g, new BoxGeometry(footW, footH, footD), mat(c.shoe),  legGap / 2, footH / 2, -s(8));

  // 小腿 y:6–43
  const llH = s(37); const llR = s(4.5);
  addPart(g, new CylinderGeometry(llR * 0.85, llR, llH, 8), mat(c.bottom), -legGap / 2, footH + llH / 2, 0);
  addPart(g, new CylinderGeometry(llR * 0.85, llR, llH, 8), mat(c.bottom),  legGap / 2, footH + llH / 2, 0);

  // 大腿 y:43–75
  const ulH = s(32); const ulR = s(6);
  const legBaseY = footH + llH;
  addPart(g, new CylinderGeometry(ulR * 0.85, ulR, ulH, 8), mat(c.bottom), -legGap / 2, legBaseY + ulH / 2, 0);
  addPart(g, new CylinderGeometry(ulR * 0.85, ulR, ulH, 8), mat(c.bottom),  legGap / 2, legBaseY + ulH / 2, 0);

  // 臀部 y:70–90  (BoxGeometry模拟)
  const hipsY = legBaseY + ulH - s(5);
  addPart(g, new BoxGeometry(hipW, s(20), s(22)), mat(c.bottom), 0, hipsY + s(10), 0);

  // 躯干 y:90–148  (用腰部和肩部两段BoxGeometry梯形近似)
  const torsoBaseY = hipsY + s(20);
  // 腰段
  addPart(g, new BoxGeometry(waistW, s(20), s(20)), mat(c.top), 0, torsoBaseY + s(10), 0);
  // 胸段
  addPart(g, new BoxGeometry(shoulderW, s(38), s(22)), mat(c.top), 0, torsoBaseY + s(20) + s(19), 0);

  // 颈部 y:148–156
  const neckBaseY = torsoBaseY + s(58);
  addPart(g, new CylinderGeometry(s(4), s(5), s(8), 8), mat(c.skin), 0, neckBaseY + s(4), 0);

  // 头 y:156–174  (SphereGeometry)
  const headY = neckBaseY + s(8) + s(9);
  addPart(g, new SphereGeometry(s(9), 12, 10), mat(c.skin), 0, headY, 0);
  // 头发（顶部扁球）
  addPart(g, new SphereGeometry(s(9.2), 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c.hair, 0.9), 0, headY, 0);

  // 上臂 y:130–148  向外倾斜约15°
  const armTopY = torsoBaseY + s(55);
  const uaH = s(28); const uaR = s(4);
  const armXOff = shoulderW / 2 + uaR;
  addPart(g, new CylinderGeometry(uaR * 0.8, uaR, uaH, 8), mat(c.skin), -armXOff, armTopY - uaH / 2, 0, 0, 0,  0.22);
  addPart(g, new CylinderGeometry(uaR * 0.8, uaR, uaH, 8), mat(c.skin),  armXOff, armTopY - uaH / 2, 0, 0, 0, -0.22);

  // 前臂 y:102–130
  const laH = s(25); const laR = s(3.5);
  const laXOff = armXOff + s(5);
  addPart(g, new CylinderGeometry(laR * 0.75, laR, laH, 8), mat(c.skin), -laXOff, armTopY - uaH - laH / 2, 0, 0, 0,  0.12);
  addPart(g, new CylinderGeometry(laR * 0.75, laR, laH, 8), mat(c.skin),  laXOff, armTopY - uaH - laH / 2, 0, 0, 0, -0.12);

  // 手
  const handY = armTopY - uaH - laH - s(3);
  const handXOff = laXOff + s(3);
  addPart(g, new BoxGeometry(s(8), s(6), s(4)), mat(c.skin), -handXOff, handY, 0);
  addPart(g, new BoxGeometry(s(8), s(6), s(4)), mat(c.skin),  handXOff, handY, 0);
}

// ─── 坐姿 ────────────────────────────────────────────────────────────────────

export function buildPersonSitting(g: Group, f: Furniture, _ceiling: number): void {
  const gender = ((f.runtimeState?.gender as Gender | undefined) ?? 0) as Gender;
  // 坐姿实际人物身高约等于站高，但坐高约为站高55%
  const standingHeightCm = f.size.height > 90 ? f.size.height : 170;
  buildSittingBody(g, standingHeightCm, gender);
}

function buildSittingBody(g: Group, heightCm: number, gender: Gender): void {
  const c = COLOR_BY_GENDER[gender];
  const scale = heightCm / 170;
  const s = (cm: number) => cm * scale * CM_TO_M;

  const shoulderW = gender === 1 ? s(44) : gender === 2 ? s(38) : s(40);
  const hipW      = gender === 1 ? s(36) : gender === 2 ? s(42) : s(38);
  const waistW    = gender === 1 ? s(34) : gender === 2 ? s(28) : s(32);
  const seatH     = s(45); // 座椅高度，小腿踩地

  // 脚 y:0–6（悬空，z前移）
  addPart(g, new BoxGeometry(s(10), s(6), s(24)), mat(c.shoe), -s(10) / 2, s(3),  s(28));
  addPart(g, new BoxGeometry(s(10), s(6), s(24)), mat(c.shoe),  s(10) / 2, s(3),  s(28));

  // 小腿垂直 y:6–45
  const llH = s(39); const llR = s(4.5);
  addPart(g, new CylinderGeometry(llR * 0.85, llR, llH, 8), mat(c.bottom), -s(10), seatH / 2 - llH / 2 + s(3), s(16));
  addPart(g, new CylinderGeometry(llR * 0.85, llR, llH, 8), mat(c.bottom),  s(10), seatH / 2 - llH / 2 + s(3), s(16));

  // 大腿水平（前伸）rotation.x = -Math.PI/2 → CylinderGeometry 默认沿Y，旋转后沿Z
  const ulH = s(38); const ulR = s(6);
  addPart(g, new CylinderGeometry(ulR * 0.85, ulR, ulH, 8), mat(c.bottom), -s(10), seatH, s(19), Math.PI / 2);
  addPart(g, new CylinderGeometry(ulR * 0.85, ulR, ulH, 8), mat(c.bottom),  s(10), seatH, s(19), Math.PI / 2);

  // 臀部
  addPart(g, new BoxGeometry(hipW, s(20), s(22)), mat(c.bottom), 0, seatH + s(10), 0);

  // 躯干
  const torsoBaseY = seatH + s(20);
  addPart(g, new BoxGeometry(waistW, s(20), s(20)), mat(c.top), 0, torsoBaseY + s(10), 0);
  addPart(g, new BoxGeometry(shoulderW, s(38), s(22)), mat(c.top), 0, torsoBaseY + s(39), 0);

  // 颈 + 头
  const neckBaseY = torsoBaseY + s(58);
  addPart(g, new CylinderGeometry(s(4), s(5), s(8), 8), mat(c.skin), 0, neckBaseY + s(4), 0);
  const headY = neckBaseY + s(8) + s(9);
  addPart(g, new SphereGeometry(s(9), 12, 10), mat(c.skin), 0, headY, 0);
  addPart(g, new SphereGeometry(s(9.2), 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c.hair, 0.9), 0, headY, 0);

  // 上臂
  const armTopY = torsoBaseY + s(55);
  const uaH = s(28); const uaR = s(4);
  const armXOff = shoulderW / 2 + uaR;
  addPart(g, new CylinderGeometry(uaR * 0.8, uaR, uaH, 8), mat(c.skin), -armXOff, armTopY - uaH / 2, 0, 0, 0,  0.22);
  addPart(g, new CylinderGeometry(uaR * 0.8, uaR, uaH, 8), mat(c.skin),  armXOff, armTopY - uaH / 2, 0, 0, 0, -0.22);

  // 前臂（坐姿可略向前倾）
  const laH = s(25); const laR = s(3.5);
  const laXOff = armXOff + s(5);
  addPart(g, new CylinderGeometry(laR * 0.75, laR, laH, 8), mat(c.skin), -laXOff, armTopY - uaH - laH / 2, 0, 0, 0,  0.12);
  addPart(g, new CylinderGeometry(laR * 0.75, laR, laH, 8), mat(c.skin),  laXOff, armTopY - uaH - laH / 2, 0, 0, 0, -0.12);

  // 手
  const handY = armTopY - uaH - laH - s(3);
  addPart(g, new BoxGeometry(s(8), s(6), s(4)), mat(c.skin), -(laXOff + s(3)), handY, 0);
  addPart(g, new BoxGeometry(s(8), s(6), s(4)), mat(c.skin),  (laXOff + s(3)), handY, 0);
}
