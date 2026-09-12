import { LatheGeometry, Vector2 } from 'three';

/** Continuous outer wall, rounded rim and sloping inner bowl, with a closed floor. */
export function basinShellGeometry(width: number, depth: number, height: number): LatheGeometry {
  const profile = [
    [0, 0], [0.28, 0], [0.36, 0.025], [0.42, 0.18], [0.47, 0.58],
    [0.495, 0.92], [0.5, 0.97], [0.495, 1], [0.465, 1], [0.455, 0.96],
    [0.43, 0.6], [0.37, 0.28], [0.28, 0.15], [0.12, 0.12], [0, 0.12],
  ];
  const geometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y * height)), 48);
  geometry.scale(width, 1, depth);
  geometry.computeBoundingBox();
  return geometry;
}
