import { Box3, Group } from 'three';
import type { Furniture } from '@/modules/model/types';
import { CM_TO_M } from '../../coord';
import { buildStylizedAvatar } from '../stylized-avatar';

function buildPerson(g: Group, f: Furniture, sitting: boolean): void {
  const value = f.runtimeState?.gender;
  const gender = value === 1 || value === 2 ? value : 0;
  const avatar = buildStylizedAvatar('adult', { gender });
  // Legacy seated catalog entries use 90 cm as a footprint height; keep the
  // corresponding adult stature, while honoring explicit heights above 90 cm.
  const height = sitting && f.size.height <= 90 ? 170 : f.size.height;
  avatar.group.scale.setScalar(height * CM_TO_M / 1.7);
  avatar.pose(sitting ? 'sit' : 'stand');
  if (sitting) avatar.group.position.y -= new Box3().setFromObject(avatar.group).min.y;
  g.add(avatar.group);
}

export function buildPersonStanding(g: Group, f: Furniture, _ceiling: number): void {
  buildPerson(g, f, false);
}

export function buildPersonSitting(g: Group, f: Furniture, _ceiling: number): void {
  buildPerson(g, f, true);
}
