import { buildStylizedAvatar } from './stylized-avatar';

/** Compatibility entry point; all figures share the same articulated model. */
export function buildAvatar() {
  return buildStylizedAvatar();
}
