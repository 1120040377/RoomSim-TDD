import type { Group } from 'three';
import type { Furniture } from '@/modules/model/types';
import { buildDefaultBox } from './shared';

export function buildToilet(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildBasin(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildShower(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildBathtub(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}
