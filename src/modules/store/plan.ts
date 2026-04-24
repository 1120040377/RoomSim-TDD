import { defineStore } from 'pinia';
import { shallowRef, computed } from 'vue';
import type {
  Plan,
  Wall,
  WallNode,
  Opening,
  Furniture,
  Room,
  WallId,
  OpeningId,
  FurnitureId,
  NodeId,
  RoomId,
} from '@/modules/model/types';
import { detectRooms } from '@/modules/geometry/room-detect';
import { polygonArea } from '@/modules/geometry/vec2';

/**
 * Plan store。
 *
 * 为避免 Pinia 深响应式对大对象的性能/序列化开销，采用 shallowRef + 不可变更新：
 * 每次修改重建 plan 顶层（以及被修改的子 record）。对外提供的 mutations 都是
 * "_ 前缀"，表示只应由 Command 调用，UI 绝不直接调用。
 *
 * _recomputeRooms 应在墙/节点变更后手动调用（由 Command 负责），避免每次 mutation
 * 自动重算带来的噪声。
 */
export const usePlanStore = defineStore('plan', () => {
  const plan = shallowRef<Plan | null>(null);

  const walls = computed(() => (plan.value ? Object.values(plan.value.walls) : []));
  const openings = computed(() =>
    plan.value ? Object.values(plan.value.openings) : [],
  );
  const furniture = computed(() =>
    plan.value ? Object.values(plan.value.furniture) : [],
  );
  const nodes = computed(() => (plan.value ? Object.values(plan.value.nodes) : []));
  const rooms = computed(() => (plan.value ? Object.values(plan.value.rooms) : []));

  function loadPlan(p: Plan) {
    plan.value = p;
  }

  function mutate(f: (p: Plan) => Plan) {
    if (!plan.value) return;
    plan.value = f(plan.value);
  }

  /* ----------------------------- Node ------------------------------ */
  function _addNode(node: WallNode) {
    mutate((p) => ({ ...p, nodes: { ...p.nodes, [node.id]: node } }));
  }
  function _removeNode(id: NodeId) {
    mutate((p) => {
      const { [id]: _omit, ...rest } = p.nodes;
      void _omit;
      return { ...p, nodes: rest };
    });
  }
  function _updateNode(id: NodeId, patch: Partial<WallNode>) {
    mutate((p) => {
      const cur = p.nodes[id];
      if (!cur) return p;
      return { ...p, nodes: { ...p.nodes, [id]: { ...cur, ...patch } } };
    });
  }

  /* ----------------------------- Wall ------------------------------ */
  function _addWall(wall: Wall) {
    mutate((p) => ({ ...p, walls: { ...p.walls, [wall.id]: wall } }));
  }
  function _removeWall(id: WallId) {
    mutate((p) => {
      const { [id]: _omit, ...rest } = p.walls;
      void _omit;
      return { ...p, walls: rest };
    });
  }
  function _updateWall(id: WallId, patch: Partial<Wall>) {
    mutate((p) => {
      const cur = p.walls[id];
      if (!cur) return p;
      return { ...p, walls: { ...p.walls, [id]: { ...cur, ...patch } } };
    });
  }

  /* ---------------------------- Opening ---------------------------- */
  function _addOpening(op: Opening) {
    mutate((p) => ({ ...p, openings: { ...p.openings, [op.id]: op } }));
  }
  function _removeOpening(id: OpeningId) {
    mutate((p) => {
      const { [id]: _omit, ...rest } = p.openings;
      void _omit;
      return { ...p, openings: rest };
    });
  }
  function _updateOpening(id: OpeningId, patch: Partial<Opening>) {
    mutate((p) => {
      const cur = p.openings[id];
      if (!cur) return p;
      return { ...p, openings: { ...p.openings, [id]: { ...cur, ...patch } as Opening } };
    });
  }

  /* --------------------------- Furniture --------------------------- */
  function _addFurniture(f: Furniture) {
    mutate((p) => ({ ...p, furniture: { ...p.furniture, [f.id]: f } }));
  }
  function _removeFurniture(id: FurnitureId) {
    mutate((p) => {
      const { [id]: _omit, ...rest } = p.furniture;
      void _omit;
      return { ...p, furniture: rest };
    });
  }
  function _updateFurniture(id: FurnitureId, patch: Partial<Furniture>) {
    mutate((p) => {
      const cur = p.furniture[id];
      if (!cur) return p;
      return { ...p, furniture: { ...p.furniture, [id]: { ...cur, ...patch } } };
    });
  }

  /* ----------------------------- Room ------------------------------ */
  function _renameRoom(id: RoomId, name: string) {
    mutate((p) => {
      const cur = p.rooms[id];
      if (!cur) return p;
      return { ...p, rooms: { ...p.rooms, [id]: { ...cur, name } } };
    });
  }

  /**
   * 从 nodes + walls 重新识别房间。保留用户给房间的自定义 name（按 wallIds 集合匹配）。
   * 一定要在墙/节点增删后由 Command 显式调用。
   */
  function _recomputeRooms() {
    if (!plan.value) return;
    const p = plan.value;
    const faces = detectRooms(p.nodes, p.walls);

    // 旧房间 wallIds 集合 → name 映射，用于尝试保留命名
    const nameByKey: Record<string, string> = {};
    for (const r of Object.values(p.rooms)) {
      nameByKey[[...r.wallIds].sort().join('|')] = r.name;
    }

    const newRooms: Record<RoomId, Room> = {};
    let idx = 1;
    for (const f of faces) {
      const id = `room-${idx++}`;
      const key = [...f.wallIds].sort().join('|');
      newRooms[id] = {
        id,
        name: nameByKey[key] ?? `房间 ${idx - 1}`,
        polygon: f.polygon,
        wallIds: f.wallIds,
        area: polygonArea(f.polygon) / 10_000, // cm² → m²
      };
    }

    plan.value = { ...p, rooms: newRooms };
  }

  function $reset() {
    plan.value = null;
  }

  return {
    plan,
    walls,
    openings,
    furniture,
    nodes,
    rooms,
    loadPlan,
    _addNode,
    _removeNode,
    _updateNode,
    _addWall,
    _removeWall,
    _updateWall,
    _addOpening,
    _removeOpening,
    _updateOpening,
    _addFurniture,
    _removeFurniture,
    _updateFurniture,
    _renameRoom,
    _recomputeRooms,
    $reset,
  };
});
