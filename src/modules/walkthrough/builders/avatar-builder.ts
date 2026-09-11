import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';

/** A 170 cm articulated figure used by the follow camera, not persisted furniture. */
export function buildAvatar() {
  const group = new Group();
  group.name = 'walkthrough-avatar';
  const skin = new MeshStandardMaterial({ color: '#deb58e', roughness: 0.8 });
  const shirt = new MeshStandardMaterial({ color: '#287c83', roughness: 0.9 });
  const trousers = new MeshStandardMaterial({ color: '#344354', roughness: 0.9 });
  const dark = new MeshStandardMaterial({ color: '#292c31', roughness: 0.8 });
  function box(parent: Group, w: number, h: number, d: number, y: number, material: MeshStandardMaterial, z = 0) {
    const mesh = new Mesh(new BoxGeometry(w, h, d), material);
    mesh.position.set(0, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
  }
  box(group, 0.34, 0.45, 0.22, 1.12, shirt);
  box(group, 0.3, 0.16, 0.2, 0.84, trousers);
  const neck = new Mesh(new CylinderGeometry(0.045, 0.05, 0.1, 12), skin);
  neck.position.y = 1.38; group.add(neck);
  const head = new Mesh(new SphereGeometry(0.13, 20, 16), skin);
  head.scale.set(0.83, 1.08, 0.9); head.position.y = 1.56; head.castShadow = true; group.add(head);
  const hair = new Mesh(new SphereGeometry(0.133, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  hair.position.y = 1.56; hair.scale.copy(head.scale); group.add(hair);
  const legs: Group[] = [], knees: Group[] = [], arms: Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new Group(); leg.position.set(side * 0.09, 0.8, 0);
    box(leg, 0.115, 0.34, 0.13, -0.17, trousers);
    const knee=new Group();knee.position.y=-0.34;leg.add(knee);knees.push(knee);
    box(knee, 0.105, 0.34, 0.12, -0.17, trousers);
    box(knee, 0.13, 0.1, 0.25, -0.41, dark, -0.045);
    group.add(leg); legs.push(leg);
    const arm = new Group(); arm.position.set(side * 0.23, 1.31, 0);
    box(arm, 0.11, 0.22, 0.14, -0.11, shirt);
    box(arm, 0.075, 0.31, 0.09, -0.365, skin);
    group.add(arm); arms.push(arm);
  }
  return { group, pose: (pose:'stand'|'sit'|'lie')=>{
    group.rotation.x=pose==='lie'?-Math.PI/2:0;
    legs.forEach(leg=>leg.rotation.x=pose==='sit'?Math.PI/2:0);
    knees.forEach(knee=>knee.rotation.x=pose==='sit'?-Math.PI/2:0);
    arms.forEach(arm=>arm.rotation.x=pose==='sit'?-0.35:0);
  }, animate: (phase: number, moving: boolean) => {
    const swing = moving ? Math.sin(phase) * 0.38 : 0;
    legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing; arms[1].rotation.x = swing;
  } };
}
