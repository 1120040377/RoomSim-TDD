import type { Group } from 'three';
import type { Furniture } from '@/modules/model/types';
import { buildDefaultBox } from './shared';

export function buildFridge(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildStove(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildSink(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}

export function buildKitchenCounter(g: Group, f: Furniture, ceilingHeightCm: number): void {
  buildDefaultBox(g, f, ceilingHeightCm);
}
