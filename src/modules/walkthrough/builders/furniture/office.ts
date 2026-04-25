import type { Group } from 'three';
import type { Furniture } from '@/modules/model/types';
import { buildDefaultBox } from './shared';

export function buildDesk(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildOfficeChair(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}
