import type { Command } from './base';
import type { Finish, Renovation, Utility } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';
import { defaultRenovation } from '@/modules/renovation/model';

/** Only snapshots renovation data; never overwrites geometry or furniture. */
export class RenovationCommand implements Command {
  private before?: Renovation;
  constructor(readonly name: string, private change: (r: Renovation) => Renovation) {}
  do() {
    const store = usePlanStore();
    if (!store.plan) return;
    this.before = store.plan.renovation;
    store._setRenovation(this.change(this.before ?? defaultRenovation()));
  }
  undo() { usePlanStore()._setRenovation(this.before); }
}
export function putUtility(utility: Utility) {
  return new RenovationCommand('编辑水电点位', r => ({ ...r, utilities: { ...r.utilities, [utility.id]: utility } }));
}
export function removeUtility(id: string) {
  return new RenovationCommand('删除水电点位', r => {
    const utilities = { ...r.utilities };
    delete utilities[id];
    return { ...r, utilities };
  });
}
export function updateFinish(patch: Partial<Finish>) {
  return new RenovationCommand('更换装修材质', r => ({ ...r, finish: { ...r.finish, ...patch } }));
}

export function updateRoomFloor(roomId: string, patch: Partial<Pick<Finish, 'floor' | 'floorColor'>> | null) {
  return new RenovationCommand('更换房间地面', r => {
    const roomFloors = { ...r.roomFloors };
    if (patch === null) delete roomFloors[roomId];
    else {
      const previous = roomFloors[roomId] ?? r.finish;
      roomFloors[roomId] = { floor: patch.floor ?? previous.floor, floorColor: patch.floorColor ?? previous.floorColor };
    }
    return { ...r, roomFloors };
  });
}
