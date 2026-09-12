import {
  Box3, BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Group,
  Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type AvatarKind = 'adult' | 'child';
export interface AvatarAppearance { gender?: 0 | 1 | 2 }
type Pose = 'stand' | 'sit' | 'lie';
// y, half width, half depth, depth offset. Smooth elliptical rings describe
// anatomical/garment silhouettes without the old stack of separate capsules.
type Section = [number, number, number, number?];

function contour(sections: Section[]): BufferGeometry {
  const curve = new CatmullRomCurve3(sections.map(([y, x, z]) => new Vector3(x, y, z)), false, 'catmullrom', 0.25);
  const offsets = new CatmullRomCurve3(sections.map(([y, , , z = 0]) => new Vector3(0, y, z)), false, 'catmullrom', 0.25);
  const rows = (sections.length - 1) * 4, sides = 32;
  const positions: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const p = curve.getPoint(row / rows), offset = offsets.getPoint(row / rows).z;
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      positions.push(Math.max(0, p.x) * Math.cos(angle), p.y, Math.max(0, p.z) * Math.sin(angle) + offset);
      if (row < rows && side < sides) {
        const a = row * (sides + 1) + side, b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Articulated, -Z facing figure. Both age presets normalize to 170 cm;
 * the controller owns world position, heading and real-world height. */
export function buildStylizedAvatar(initial: AvatarKind = 'adult', appearance: AvatarAppearance = {}) {
  const group = new Group(); group.name = 'walkthrough-avatar';
  let legs: Group[] = [], knees: Group[] = [], arms: Group[] = [], elbows: Group[] = [];
  let hipHeight = 0.88;
  let currentPose: Pose = 'stand';

  function pose(next: Pose) {
    currentPose = next;
    group.rotation.x = next === 'lie' ? -Math.PI / 2 : 0;
    legs.forEach(leg => leg.rotation.x = next === 'sit' ? Math.PI / 2 : 0);
    knees.forEach(knee => knee.rotation.x = next === 'sit' ? -Math.PI / 2 : 0);
    arms.forEach((arm, i) => {
      arm.rotation.x = next === 'sit' ? 0.12 : 0;
      arm.rotation.z = (i === 0 ? -1 : 1) * (next === 'lie' ? 0.08 : 0.055);
    });
    // Positive X bends the forearms toward -Z, over the seated thighs.
    elbows.forEach(elbow => elbow.rotation.x = next === 'sit' ? 1.2 : 0.06);
  }

  function rebuild(kind: AvatarKind) {
    const geometries = new Set<BufferGeometry>(), materials = new Set<MeshStandardMaterial>();
    group.traverse(object => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    group.clear(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    legs = []; knees = []; arms = []; elbows = [];
    const child = kind === 'child', female = appearance.gender === 2;
    group.userData.avatarKind = kind;
    const mat = (color: string, roughness = 0.9) => new MeshStandardMaterial({ color, roughness });
    const skin = mat('#dfb38f', 0.72), hair = mat('#382e2a', 0.87);
    const shirt = mat(child ? '#d6a154' : female ? '#956d68' : '#608d84');
    const trousers = mat(child ? '#667986' : '#414b57');
    const trim = mat(child ? '#af874c' : female ? '#805b58' : '#506b66');
    const shoes = mat('#e6e2d7'), sole = mat('#babbb4'), eye = mat('#34322f');
    const whites = mat('#dbd2bd'), lip = mat('#a16e60');
    const sphere = new SphereGeometry(1, 24, 16);
    function mesh(parent: Group, geometry: BufferGeometry, material: MeshStandardMaterial, name: string, x = 0, y = 0, z = 0) {
      const part = new Mesh(geometry, material); part.name = name;
      part.position.set(x, y, z); part.castShadow = part.receiveShadow = true; parent.add(part); return part;
    }
    function oval(parent: Group, name: string, material: MeshStandardMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
      const part = mesh(parent, sphere, material, name, x, y, z); part.scale.set(sx, sy, sz); return part;
    }
    function rounded(parent: Group, name: string, material: MeshStandardMaterial, w: number, h: number, d: number, x: number, y: number, z: number, radius = 0.012) {
      return mesh(parent, new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 3, h / 3, d / 3)), material, name, x, y, z);
    }
    function line(parent: Group, name: string, material: MeshStandardMaterial, points: Vector3[], radius: number) {
      return mesh(parent, new TubeGeometry(new CatmullRomCurve3(points), 12, radius, 6, false), material, name);
    }
    hipHeight = child ? 0.77 : 0.89;
    const shoulder = child ? 1.29 : 1.405, torsoHeight = shoulder - hipHeight;
    const width = child ? 0.165 : female ? 0.181 : 0.198;
    mesh(group, contour([
      [0, 0, 0], [0.018, 0.155, 0.102], [0.07, 0.159, 0.104],
      [0.20, width * 0.80, 0.103], [torsoHeight * 0.69, width, 0.114],
      [torsoHeight * 0.84, width, 0.108], [torsoHeight * 0.94, width * 0.74, 0.087],
      [torsoHeight, 0.059, 0.054], [torsoHeight + 0.002, 0, 0],
    ]), shirt, 'avatar-shirt', 0, hipHeight);
    mesh(group, contour([[-0.08, 0, 0], [-0.06, 0.134, 0.084], [0.005, 0.157, 0.098], [0.06, 0.146, 0.09], [0.065, 0, 0]]), trousers, 'avatar-hips', 0, hipHeight);
    const hem = new TorusGeometry(0.154, 0.004, 6, 48);
    const hemMesh = mesh(group, hem, trim, 'shirt-hem', 0, hipHeight + 0.034); hemMesh.rotation.x = Math.PI / 2; hemMesh.scale.y = 0.67;
    oval(group, 'neck', skin, 0, shoulder + 0.025, 0, 0.047, 0.068, 0.047);
    const collar = mesh(group, new TorusGeometry(0.057, 0.008, 8, 40), trim, 'collar', 0, shoulder - 0.004);
    collar.rotation.x = Math.PI / 2; collar.scale.y = 0.84;
    if (!child) {
      line(group, 'pocket-stitch', trim, [new Vector3(-0.119, shoulder - 0.13, -0.105), new Vector3(-0.12, shoulder - 0.182, -0.103), new Vector3(-0.084, shoulder - 0.192, -0.109), new Vector3(-0.057, shoulder - 0.18, -0.11), new Vector3(-0.056, shoulder - 0.13, -0.11)], 0.0015);
    }

    const head = new Group(); head.name = 'avatar-head'; head.position.y = shoulder + (child ? 0.192 : 0.169); group.add(head);
    const hx = child ? 0.155 : 0.121, hy = child ? 0.18 : 0.148, hz = child ? 0.133 : 0.11;
    mesh(head, contour([
      [-hy, 0, 0, -0.016], [-hy * 0.86, hx * 0.47, hz * 0.59, -0.018],
      [-hy * 0.56, hx * 0.79, hz * 0.82, -0.008], [-hy * 0.12, hx, hz * 0.97],
      [hy * 0.38, hx * 0.96, hz], [hy * 0.78, hx * 0.73, hz * 0.77], [hy, 0, 0],
    ]), skin, 'face');
    // One continuous hair shell with a side-swept hairline and a lower nape.
    const hairGeometry = new SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const vertices = hairGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
      const azimuth = Math.atan2(z, x), front = Math.max(0, -Math.sin(azimuth));
      const edge = 1.92 - front * 0.62 + front * 0.12 * Math.cos(azimuth);
      const theta = Math.acos(Math.min(1, Math.max(-1, y))) / (Math.PI / 2) * edge;
      vertices.setXYZ(i, Math.cos(azimuth) * Math.sin(theta) * (hx + 0.014), Math.cos(theta) * (hy + 0.014) + 0.006, Math.sin(azimuth) * Math.sin(theta) * (hz + 0.015) + 0.003);
    }
    hairGeometry.computeVertexNormals(); mesh(head, hairGeometry, hair, 'hair');
    const fringe = oval(head, 'swept-fringe', hair, -hx * 0.20, hy * 0.60, -hz * 0.72, hx * 0.82, hy * 0.27, hz * 0.40); fringe.rotation.z = -0.18;
    if (female) oval(head, 'hair-bun', hair, 0, 0.018, hz * 0.95, hx * 0.62, hy * 0.57, hz * 0.58);
    for (const side of [-1, 1]) {
      oval(head, 'ear', skin, side * hx * 0.98, -0.012, 0.003, 0.018, 0.028, 0.016);
      const ex = side * hx * 0.40, ey = hy * 0.055, ez = -hz * 0.96;
      oval(head, 'eye-white', whites, ex, ey, ez, child ? 0.022 : 0.018, child ? 0.017 : 0.013, 0.004);
      oval(head, 'iris', eye, ex, ey, ez - 0.0037, child ? 0.010 : 0.008, child ? 0.013 : 0.010, 0.002);
      line(head, 'upper-eyelid', skin, [new Vector3(ex - 0.014, ey, ez), new Vector3(ex, ey + 0.016, ez - 0.002), new Vector3(ex + 0.014, ey, ez)], 0.0025);
      line(head, 'eyebrow', hair, [new Vector3(ex - 0.015, ey + 0.032, ez + 0.004), new Vector3(ex, ey + 0.038, ez + 0.001), new Vector3(ex + 0.015, ey + 0.032, ez + 0.004)], 0.0025);
    }
    oval(head, 'nose-bridge', skin, 0, -0.008, -hz * 0.96, 0.012, 0.028, 0.012);
    oval(head, 'nose-tip', skin, 0, -0.026, -hz * 1.065, 0.015, 0.012, 0.014);
    line(head, 'mouth', lip, [new Vector3(-0.019, -hy * 0.46, -hz * 0.889), new Vector3(0, -hy * 0.48, -hz * 0.91), new Vector3(0.019, -hy * 0.46, -hz * 0.889)], 0.002);

    for (const side of [-1, 1]) {
      const thigh = child ? 0.345 : 0.41, calf = hipHeight - thigh - 0.075;
      const leg = new Group(); leg.name = side < 0 ? 'left-hip' : 'right-hip'; leg.position.set(side * 0.085, hipHeight, 0); group.add(leg); legs.push(leg);
      mesh(leg, contour([[-thigh - 0.035, 0, 0], [-thigh - 0.018, 0.052, 0.057], [-thigh + 0.05, 0.058, 0.062], [-thigh * 0.45, 0.072, 0.077], [-0.025, 0.084, 0.089], [0.04, 0.056, 0.068], [0.06, 0, 0]]), trousers, 'trouser-thigh');
      const knee = new Group(); knee.name = side < 0 ? 'left-knee' : 'right-knee'; knee.position.y = -thigh; leg.add(knee); knees.push(knee);
      mesh(knee, contour([[-calf, 0, 0], [-calf + 0.004, 0.041, 0.046], [-calf * 0.65, 0.047, 0.052], [-calf * 0.30, 0.057, 0.061], [-0.005, 0.053, 0.057], [0.035, 0.031, 0.035], [0.04, 0, 0]]), child ? skin : trousers, 'lower-leg');
      if (child) mesh(knee, contour([[-calf, 0, 0], [-calf + 0.004, 0.043, 0.048], [-calf + 0.075, 0.045, 0.049], [-calf + 0.077, 0, 0]]), shoes, 'sock');
      rounded(knee, 'shoe-sole', sole, 0.123, 0.024, 0.233, 0, -calf - 0.063, -0.044, 0.01);
      oval(knee, 'shoe-upper', shoes, 0, -calf - 0.038, -0.045, 0.060, 0.036, 0.112);
      oval(knee, 'shoe-cuff', shoes, 0, -calf - 0.012, 0.015, 0.047, 0.04, 0.052);
      for (let lace = 0; lace < 3; lace++) rounded(knee, 'shoelace', shoes, 0.059, 0.005, 0.006, 0, -calf - 0.008 - lace * 0.004, -0.043 - lace * 0.017, 0.001);

      const arm = new Group(); arm.name = side < 0 ? 'left-shoulder' : 'right-shoulder';
      arm.position.set(side * (width - 0.014), shoulder - 0.078, 0); group.add(arm); arms.push(arm);
      const upper = child ? 0.235 : 0.267, lower = child ? 0.213 : 0.242;
      mesh(arm, contour([[-upper - 0.02, 0, 0], [-upper, 0.039, 0.043], [-upper * 0.4, 0.05, 0.054], [-0.02, 0.059, 0.065], [0.047, 0, 0]]), skin, 'upper-arm');
      mesh(arm, contour([[-0.148, 0, 0], [-0.146, 0.058, 0.066], [-0.09, 0.065, 0.072], [-0.005, 0.07, 0.075], [0.05, 0.045, 0.054], [0.064, 0, 0]]), shirt, 'shirt-sleeve');
      const elbow = new Group(); elbow.name = side < 0 ? 'left-elbow' : 'right-elbow'; elbow.position.y = -upper; arm.add(elbow); elbows.push(elbow);
      mesh(elbow, contour([[-lower - 0.014, 0, 0], [-lower, 0.027, 0.03], [-lower * 0.58, 0.036, 0.04], [-lower * 0.20, 0.043, 0.046], [0.013, 0.037, 0.041], [0.025, 0, 0]]), skin, 'forearm');
      oval(elbow, 'hand', skin, 0, -lower - 0.037, -0.003, 0.033, 0.054, 0.023);
      const thumb = oval(elbow, 'thumb', skin, -side * 0.026, -lower - 0.018, -0.014, 0.013, 0.026, 0.013); thumb.rotation.z = -side * 0.3;
    }
    // Measure in an unposed local frame; preserve the root even when switching
    // age while the figure is transformed or attached to another scene object.
    const measurement = new Group(); measurement.add(...group.children);
    const bounds = new Box3().setFromObject(measurement), factor = 1.7 / (bounds.max.y - bounds.min.y);
    for (const part of [...measurement.children]) {
      part.position.y -= bounds.min.y; part.position.multiplyScalar(factor); part.scale.multiplyScalar(factor); group.add(part);
    }
    hipHeight = (hipHeight - bounds.min.y) * factor;
    pose(currentPose); group.updateMatrixWorld(true);
  }
  rebuild(initial);
  return {
    group, get hipHeight() { return hipHeight; }, setKind: rebuild, pose,
    animate(phase: number, moving: boolean) {
      if (currentPose !== 'stand') return;
      const swing = moving ? Math.sin(phase) * 0.34 : 0;
      legs.forEach((leg, i) => leg.rotation.x = i === 0 ? swing : -swing);
      knees.forEach((knee, i) => knee.rotation.x = moving ? -Math.max(0, Math.sin(phase + i * Math.PI)) * 0.48 : 0);
      arms.forEach((arm, i) => arm.rotation.x = (i === 0 ? -swing : swing) * 0.72);
      elbows.forEach(elbow => elbow.rotation.x = moving ? 0.20 : 0.06);
    },
  };
}


