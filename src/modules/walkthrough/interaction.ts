import {
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  type Group,
} from 'three';

export type InteractableKind = 'door' | 'light' | 'switch' | 'tv';

export interface InteractableInfo {
  kind: InteractableKind;
  targetId: string;
  /** 提示文字（显示在 HUD） */
  hint: string;
}

export const MAX_INTERACT_DIST = 1.8; // meters

/** 给一个 Object3D（通常是 mesh / group）挂 interactable metadata。*/
export function markInteractable(obj: Object3D, info: InteractableInfo) {
  (obj.userData as Record<string, unknown>).interactable = info;
}

export function getInteractableFrom(obj: Object3D | null): InteractableInfo | null {
  let cur = obj;
  while (cur) {
    const info = (cur.userData as Record<string, unknown>).interactable as
      | InteractableInfo
      | undefined;
    if (info) return info;
    cur = cur.parent;
  }
  return null;
}

/** 朝屏幕中心射一条 1.8m 的线，返回击中的可交互对象。*/
export class InteractionRaycaster {
  private raycaster = new Raycaster();
  private screenCenter = new Vector2(0, 0);

  constructor(
    private camera: PerspectiveCamera,
    private scene: Scene,
  ) {}

  pick(): InteractableInfo | null {
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    this.raycaster.far = MAX_INTERACT_DIST;
    const hits = this.raycaster.intersectObject(this.scene, true);
    for (const h of hits) {
      const info = getInteractableFrom(h.object);
      if (info) return info;
    }
    return null;
  }
}

/* ----------------------------- 门开合动画 ----------------------------- */

const animating = new WeakMap<Group, boolean>();

/** 切换门开合（0↔1）。pivot 的初始 rotation.y 已在 buildDoor 中设置。*/
export function toggleDoor(
  pivot: Group,
  targetState: 0 | 1,
  panelDirSign: 1 | -1 = 1,
  durationMs = 400,
): Promise<void> {
  return new Promise((resolve) => {
    if (animating.get(pivot)) return resolve();
    animating.set(pivot, true);

    const baseYaw = pivot.rotation.y + (Math.PI / 2) * panelDirSign * ((pivot.userData.state as number) ?? 0);
    // 上式反推"关门时的基础角度"，假设 pivot 当前旋转包含 state 偏移。
    // 更稳妥做法：在 pivot.userData 里保存 baseYaw。下方按此读取。
    const storedBase = pivot.userData.baseYaw;
    const base = typeof storedBase === 'number' ? (storedBase as number) : baseYaw;
    pivot.userData.baseYaw = base;

    const startYaw = pivot.rotation.y;
    const endYaw = base - (Math.PI / 2) * panelDirSign * targetState;
    const t0 = performance.now();

    function step() {
      const t = Math.min(1, (performance.now() - t0) / durationMs);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      pivot.rotation.y = startYaw + (endYaw - startYaw) * ease;
      if (t < 1) requestAnimationFrame(step);
      else {
        pivot.userData.state = targetState;
        animating.set(pivot, false);
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}
