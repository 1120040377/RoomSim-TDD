import type { Group } from 'three';
import type { Furniture } from '@/modules/model/types';
import { buildDefaultBox } from './shared';

export function buildDiningTable4(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildDiningTable6(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildDiningChair(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}
