import { Spherical, Vector3, type PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { slide, type OrientedBox } from '@/modules/geometry/collision';
import type { Vec2 } from '@/modules/model/types';
import { buildStylizedAvatar, type AvatarKind } from '../builders/stylized-avatar';

/** Move the character in camera-relative XZ directions; translate the orbit with it. */
export class ThirdPerson {
  readonly avatar = buildStylizedAvatar();
  private controls: OrbitControls | null = null;
  private keys = new Set<string>();
  private phase = 0;
  private height = 170;
  private cleanup: Array<() => void> = [];
  private resting=false;
  private returnPosition=new Vector3();
  private followTarget=new Vector3();
  private desiredTarget=new Vector3();
  constructor(private camera: PerspectiveCamera, private element: HTMLElement, private obstacles: OrientedBox[]) {}

  attach() {
    if (this.controls) return;
    this.controls = new OrbitControls(this.camera, this.element);
    this.controls.enableDamping = true;
    this.controls.rotateSpeed = 0.45;
    this.controls.zoomSpeed = 0.65;
    this.controls.enablePan = false;
    // Orbit is only used for target/distance bookkeeping; pointer-lock input
    // below consumes relative mouse motion, never screen-edge dragging.
    this.controls.enableRotate=false;this.controls.enableZoom=false;
    // Unrestricted horizontal orbit; allow looking up and down without flipping.
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    this.controls.minPolarAngle = 0.08;
    this.controls.maxPolarAngle = Math.PI - 0.08;
    this.controls.maxDistance = 10;
    this.setHeight(this.height);
    const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
    const down = (e: KeyboardEvent) => {
      if(document.pointerLockElement!==this.element)return;
      if ((e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (movementKeys.has(e.code)) { e.preventDefault(); this.keys.add(e.code); }
    };
    const up = (e: KeyboardEvent) => { this.keys.delete(e.code); };
    const blur = () => this.keys.clear();
    const mouse=(e:MouseEvent)=>{
      if(document.pointerLockElement!==this.element||!this.controls)return;
      const offset=this.camera.position.clone().sub(this.controls.target),s=new Spherical().setFromVector3(offset);
      s.theta-=e.movementX*0.001;s.phi=Math.max(0.08,Math.min(Math.PI-0.08,s.phi-e.movementY*0.001));
      this.camera.position.copy(this.controls.target).add(new Vector3().setFromSpherical(s));this.controls.update();
    };
    const wheel=(e:WheelEvent)=>{
      if(document.pointerLockElement!==this.element||!this.controls)return;e.preventDefault();
      const offset=this.camera.position.clone().sub(this.controls.target),distance=Math.max(this.controls.minDistance,Math.min(this.controls.maxDistance,offset.length()*Math.exp(e.deltaY*0.00065)));
      this.camera.position.copy(this.controls.target).add(offset.setLength(distance));this.controls.update();
    };
    document.addEventListener('mousemove',mouse);document.addEventListener('pointerlockchange',blur);this.element.addEventListener('wheel',wheel,{passive:false});
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    this.cleanup.push(() => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
      document.removeEventListener('mousemove',mouse);document.removeEventListener('pointerlockchange',blur);this.element.removeEventListener('wheel',wheel);
    });
    this.resetCamera();
  }
  dispose() {
    this.stand();
    this.cleanup.forEach(fn => fn()); this.cleanup = []; this.keys.clear();
    this.controls?.dispose(); this.controls = null;
    if(document.pointerLockElement===this.element)document.exitPointerLock?.();
    this.camera.clearViewOffset();
    this.avatar.animate(0, false);
  }
  setPosition(p: Vec2) { this.avatar.group.position.set(p.x * 0.01, 0, p.y * 0.01); }
  setKind(kind:AvatarKind){this.stand();this.avatar.setKind(kind);this.setHeight(kind==='child'?120:170);this.resetCamera();}
  setObstacles(obstacles:OrientedBox[]){this.obstacles=obstacles;}
  useFurniture(p:Vec2,rotation:number,pose:'sit'|'lie',surfaceHeight:number,seatYaw=0){
    if(!this.resting)this.returnPosition.copy(this.avatar.group.position);
    this.resting=true;this.keys.clear();this.avatar.pose(pose);
    this.avatar.group.position.set(p.x/100,pose==='sit'?surfaceHeight/100-this.avatar.hipHeight*this.height/170:surfaceHeight/100+0.12,p.y/100);
    this.avatar.group.rotation.y=-rotation+(pose==='sit'?seatYaw:0);this.resetCamera();
  }
  stand(){if(!this.resting)return;this.avatar.group.position.copy(this.returnPosition);this.avatar.pose('stand');this.resting=false;}
  setHeight(cm: number) {
    this.height = cm; this.avatar.group.scale.setScalar(cm / 170);
    if (this.controls) {
      // Close shoulder composition. Full-body framing is intentionally no longer
      // the default; the player can zoom out when checking circulation space.
      const width=1000*this.camera.aspect;
      this.camera.setViewOffset(width,1000,width*0.18,0,width,1000);
      this.controls.minDistance = Math.max(0.65,cm/170*0.8);
    }
  }
  resetCamera() {
    if (!this.controls) return;
    this.controls.target.copy(this.avatar.group.position).add(new Vector3(0, this.height * 0.0082, 0));
    this.followTarget.copy(this.controls.target);
    const distance = Math.max(0.9,this.height/170*1.15);
    const behind=new Vector3(0,0.12,1).normalize().applyAxisAngle(new Vector3(0,1,0),this.avatar.group.rotation.y);
    this.camera.position.copy(this.controls.target).addScaledVector(behind,distance);
    this.controls.update();
  }
  update(dt: number) {
    if (!this.controls) return;
    if(document.pointerLockElement!==this.element)this.keys.clear();
    if(this.resting){if(this.keys.size){this.stand();}else{this.updateFollowTarget();return;}}
    const forward = this.controls.target.clone().sub(this.camera.position).setY(0).normalize();
    const right = new Vector3(-forward.z, 0, forward.x);
    const z = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const direction = forward.multiplyScalar(z).addScaledVector(right, x);
    const position = this.avatar.group.position;
    let moving = false;
    if (direction.lengthSq() > 0) {
      direction.normalize();
      const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 280 : 140;
      const next = slide({ x: position.x * 100, y: position.z * 100 },
        { x: direction.x * speed * dt, y: direction.z * speed * dt }, 22, this.obstacles);
      const delta = new Vector3(next.x * 0.01 - position.x, 0, next.y * 0.01 - position.z);
      moving = delta.lengthSq() > 0.000001;
      position.add(delta);
      this.camera.position.add(delta);
      if (moving) this.avatar.group.rotation.y = Math.atan2(-direction.x, -direction.z);
      this.phase += delta.length() * 9;
    }
    this.avatar.animate(this.phase, moving);
    this.updateFollowTarget();
  }
  private updateFollowTarget() {
    if(!this.controls)return;
    this.desiredTarget.copy(this.avatar.group.position);this.desiredTarget.y+=this.height*.0082;
    // Rotation/zoom handlers and resetCamera update explicitly. Orbit's built-in
    // rotate, zoom and pan are disabled, so there is no idle damping to advance.
    // Repeating spherical conversion here otherwise introduces sub-ULP drift
    // that invalidates the entire rendered-frame cache while standing still.
    // Compare our last request, not OrbitControls' mutable target: its radius
    // clamp itself can round the target on every update.
    if(this.followTarget.equals(this.desiredTarget))return;
    this.followTarget.copy(this.desiredTarget);
    this.controls.target.copy(this.followTarget);this.controls.update();
  }
}
