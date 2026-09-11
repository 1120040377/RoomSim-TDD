/**
 * 全局单位：cm（2D 编辑器 + 持久化）
 * 3D 渲染时统一乘 CM_TO_M = 0.01 转米
 */
export type Cm = number;

export interface Vec2 {
  x: Cm;
  y: Cm;
}

export type WallId = string;
export type OpeningId = string;
export type FurnitureId = string;
export type RoomId = string;
export type PlanId = string;
export type NodeId = string;

/* ------------------------------- Wall ------------------------------- */

export interface WallNode {
  id: NodeId;
  position: Vec2;
}

export interface Wall {
  id: WallId;
  startNodeId: NodeId;
  endNodeId: NodeId;
  thickness: Cm;
  height: Cm;
}

/* ----------------------------- Opening ------------------------------ */

export type OpeningKind = 'door' | 'window';

export interface OpeningBase {
  id: OpeningId;
  kind: OpeningKind;
  wallId: WallId;
  /** 沿墙方向从 startNode 起的距离（中心点位置） */
  offset: Cm;
  width: Cm;
  height: Cm;
  sillHeight: Cm;
}

export interface Door extends OpeningBase {
  kind: 'door';
  /** An open passage has no hinged leaf (e.g. a connected living/dining room). */
  passage?: boolean;
  /** 铰链在墙段哪一侧：start 代表靠近 wall.startNode */
  hinge: 'start' | 'end';
  /** 向哪一侧开：inside / outside 相对于墙的法向 */
  swing: 'inside' | 'outside';
  /** 开合角度 0=关 1=全开 */
  state?: number;
}

export interface Window extends OpeningBase {
  kind: 'window';
}

export type Opening = Door | Window;

/* ---------------------------- Furniture ----------------------------- */

export type FurnitureType =
  | 'wall-cabinet'
  | 'washing-machine'
  | 'bed-single'
  | 'bed-double'
  | 'bed-kingsize'
  | 'sofa-2'
  | 'sofa-3'
  | 'sofa-l'
  | 'armchair'
  | 'coffee-table'
  | 'side-table'
  | 'tv-cabinet'
  | 'tv'
  | 'dining-table-4'
  | 'dining-table-6'
  | 'dining-chair'
  | 'wardrobe-2'
  | 'wardrobe-3'
  | 'bookshelf'
  | 'desk'
  | 'office-chair'
  | 'fridge'
  | 'stove'
  | 'sink'
  | 'kitchen-counter'
  | 'toilet'
  | 'basin'
  | 'shower'
  | 'bathtub'
  | 'lamp-ceiling'
  | 'lamp-floor'
  | 'lamp-wall'
  | 'switch'
  | 'person-standing'
  | 'person-sitting';

export interface FurnitureSize {
  width: Cm; // X
  depth: Cm; // Y
  height: Cm; // Z
}

export interface Furniture {
  id: FurnitureId;
  type: FurnitureType;
  /** 中心点 */
  position: Vec2;
  /** 弧度，俯视 up 轴（Z） */
  rotation: number;
  size: FurnitureSize;
  color?: string;
  /** 运行时状态，如门开合、灯开关、电视播放 */
  runtimeState?: Record<string, number | boolean>;
  /** 是否贴墙（吸附 + 冲突规则用） */
  wallAligned?: boolean;
  /** 家具底面离地高度（cm），未指定时保留旧安装方式。 */
  elevation?: Cm;
  mount?: 'floor' | 'wall' | 'ceiling';
}

/* ------------------------------- Room ------------------------------- */

export interface Room {
  id: RoomId;
  name: string;
  polygon: Vec2[];
  wallIds: WallId[];
  /** 面积（㎡） */
  area: number;
}

/* ------------------------------- Plan ------------------------------- */

export interface PlanMeta {
  unit: 'cm';
  gridSize: Cm;
  defaultWallHeight: Cm;
  defaultWallThickness: Cm;
}

export interface WalkthroughConfig {
  personHeight: Cm;
  startPosition?: Vec2;
  startYaw?: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;

  meta: PlanMeta;

  nodes: Record<NodeId, WallNode>;
  walls: Record<WallId, Wall>;
  openings: Record<OpeningId, Opening>;
  furniture: Record<FurnitureId, Furniture>;
  rooms: Record<RoomId, Room>;

  walkthrough: WalkthroughConfig;
  renovation?: Renovation;
}

export type UtilityKind = 'socket' | 'switch' | 'cold-water' | 'hot-water' | 'drain' | 'electric';
export interface Utility {
  id: string;
  kind: UtilityKind;
  label: string;
  /** 一个坐标为点位，多个坐标为管线；均为 cm。 */
  points: UtilityPoint[];
  height: Cm;
  rotation: number;
  circuit: string;
  role?: 'source' | 'terminal' | 'pipe';
  generatedBy?: 'water-network-v1';
}
export interface Finish {
  floor: 'wood' | 'tile' | 'concrete';
  floorColor: string;
  wallColor: string;
}
export interface UtilityPoint extends Vec2 { height?: Cm }
export interface Renovation {
  utilities: Record<string, Utility>;
  finish: Finish;
}

/* ------------------------------ Helpers ----------------------------- */

export const CM_TO_M = 0.01;

/** 选中目标（editor store 使用） */
export type SelectionTarget =
  | { kind: 'utility'; id: string }
  | { kind: 'wall'; id: WallId }
  | { kind: 'opening'; id: OpeningId }
  | { kind: 'furniture'; id: FurnitureId }
  | { kind: 'node'; id: NodeId }
  | { kind: 'room'; id: RoomId };
