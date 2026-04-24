import { nanoid } from 'nanoid';
import type { Command } from '../base';
import type { Furniture, FurnitureType, Vec2 } from '@/modules/model/types';
import { FURNITURE_CATALOG } from '@/modules/templates/furniture-catalog';
import { usePlanStore } from '@/modules/store/plan';

export interface AddFurnitureOptions {
  type: FurnitureType;
  position: Vec2;
  rotation?: number;
  color?: string;
}

export class AddFurnitureCommand implements Command {
  readonly name = 'AddFurniture';
  readonly furnitureId: string;
  private snapshot: Furniture;

  constructor(opts: AddFurnitureOptions) {
    this.furnitureId = nanoid();
    const def = FURNITURE_CATALOG[opts.type];
    this.snapshot = {
      id: this.furnitureId,
      type: opts.type,
      position: opts.position,
      rotation: opts.rotation ?? 0,
      size: { ...def.size },
      color: opts.color ?? def.defaultColor,
      wallAligned: def.wallAligned,
    };
  }

  do() {
    usePlanStore()._addFurniture(this.snapshot);
  }

  undo() {
    usePlanStore()._removeFurniture(this.furnitureId);
  }
}
