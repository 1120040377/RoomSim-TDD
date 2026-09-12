/** Nine depth-aware taps keep contact shading on its own surface.
 * Reuses SSAO's depth attachment; no new render target or scene pass.
 */
export const OCCLUSION_BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
varying vec2 vUv;
#include <packing>
void main() {
  float centerDepth = texture2D(tDepth, vUv).x;
  if (centerDepth >= 1.0) {
    gl_FragColor = vec4(1.0);
    return;
  }
  float centerZ = perspectiveDepthToViewZ(centerDepth, cameraNear, cameraFar);
  // Linear AO filtering combines adjacent texels: [1,4,6,4,1]/16 per axis.
  // Integer offsets at two pixels would leave visible holes in the filter.
  vec2 stepSize = 1.2 / resolution;
  float sum = 0.0;
  float total = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 sampleUv = clamp(vUv + vec2(float(x), float(y)) * stepSize,
        0.5 / resolution, 1.0 - 0.5 / resolution);
      float depth = texture2D(tDepth, sampleUv).x;
      float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
      // Four-centimetre falloff in view space, independent of camera far plane.
      float delta = (viewZ - centerZ) / 0.04;
      float spatial = (x == 0 ? 0.375 : 0.3125) * (y == 0 ? 0.375 : 0.3125);
      float weight = spatial * exp(-delta*delta);
      weight *= 1.0 - step(1.0, depth);
      sum += texture2D(tDiffuse, sampleUv).r * weight;
      total += weight;
    }
  }
  gl_FragColor = vec4(vec3(sum / max(total, 0.00001)), 1.0);
}
`;
