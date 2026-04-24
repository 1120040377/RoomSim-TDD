import { Euler, Quaternion, Vector3, type PerspectiveCamera } from 'three';
import type { OrientedBox } from '@/modules/geometry/collision';
import { slide } from '@/modules/geometry/collision';
import { CM_TO_M } from '../coord';

const WALK_SPEED = 1.4; // m/s
const RUN_SPEED = 3.0; // m/s
const PLAYER_RADIUS_CM = 20;
const LOOK_SENSITIVITY = 0.002;

/**
 * 第一人称桌面控制器。相机固定在某 y 高度，xz 平面上移动。
 * 碰撞用 editor 坐标的圆-OBB slide 算法（见 geometry/collision.ts）。
 */
export class DesktopFPS {
  private yaw = 0;
  private pitch = 0;
  private keys = new Set<string>();
  private attached = false;
  private cleanup: Array<() => void> = [];

  constructor(
    private camera: PerspectiveCamera,
    private obstacles: OrientedBox[],
    private domElement: HTMLElement,
    private personHeightCm: number,
  ) {}

  attach() {
    if (this.attached) return;
    this.attached = true;

    const onClick = () => {
      if (document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock?.();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== this.domElement) return;
      this.yaw -= e.movementX * LOOK_SENSITIVITY;
      this.pitch -= e.movementY * LOOK_SENSITIVITY;
      const lim = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
      this.syncCameraRotation();
    };
    const onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

    this.domElement.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    this.cleanup.push(
      () => this.domElement.removeEventListener('click', onClick),
      () => document.removeEventListener('mousemove', onMouseMove),
      () => document.removeEventListener('keydown', onKeyDown),
      () => document.removeEventListener('keyup', onKeyUp),
    );
  }

  dispose() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.attached = false;
    if (document.pointerLockElement === this.domElement) document.exitPointerLock?.();
  }

  setYaw(yaw: number) {
    this.yaw = yaw;
    this.syncCameraRotation();
  }

  setObstacles(obs: OrientedBox[]) {
    this.obstacles = obs;
  }

  update(dt: number) {
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;

    const dir = new Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dir.z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dir.z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dir.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dir.x += 1;
    if (dir.lengthSq() === 0) return;
    dir.normalize();

    // 把输入方向按 yaw 投影到世界 XZ 平面
    const yawQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), this.yaw);
    dir.applyQuaternion(yawQuat);
    dir.y = 0;

    const delta = dir.multiplyScalar(speed * dt);

    // 换到 editor 坐标（cm），做 slide，再换回 3D
    const editorPos = { x: this.camera.position.x / CM_TO_M, y: this.camera.position.z / CM_TO_M };
    const editorDelta = { x: delta.x / CM_TO_M, y: delta.z / CM_TO_M };
    const next = slide(editorPos, editorDelta, PLAYER_RADIUS_CM, this.obstacles);

    this.camera.position.x = next.x * CM_TO_M;
    this.camera.position.z = next.y * CM_TO_M;
    // 高度固定
    this.camera.position.y = this.personHeightCm * 0.94 * CM_TO_M;
  }

  private syncCameraRotation() {
    const q = new Quaternion().setFromEuler(new Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
  }
}
