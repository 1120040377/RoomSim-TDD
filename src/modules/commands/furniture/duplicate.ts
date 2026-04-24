import { nanoid } from 'nanoid';
import type { Command } from '../base';
import type { Furniture, FurnitureId } from '@/modules/model/types';
import { usePlanStore } from '@/modules/store/plan';

/** 复制一件家具，偏移 20cm 放置，生成新 id。*/
export class DuplicateFurnitureCommand implements Command {
  readonly name = 'DuplicateFurniture';
  readonly newId: FurnitureId;
  private snapshot?: Furniture;

  constructor(public readonly sourceId: FurnitureId) {
    this.newId = nanoid();
  }

  do() {
    const store = usePlanStore();
    const src = store.plan?.furniture[this.sourceId];
    if (!src) return;
    this.snapshot = {
      ...src,
      id: this.newId,
      position: { x: src.position.x + 20, y: src.position.y + 20 },
    };
    store._addFurniture(this.snapshot);
  }

  undo() {
    usePlanStore()._removeFurniture(this.newId);
  }
}
