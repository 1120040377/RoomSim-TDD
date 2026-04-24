import Dexie, { type Table } from 'dexie';
import type { Plan } from '@/modules/model/types';

export interface PlanRecord {
  id: string;
  name: string;
  updatedAt: number;
  data: Plan;
  thumbnail?: string;
}

export class RoomSimDB extends Dexie {
  plans!: Table<PlanRecord, string>;

  constructor() {
    super('RoomSim');
    this.version(1).stores({
      plans: 'id, name, updatedAt',
    });
  }
}

export const db = new RoomSimDB();
