import type { MeshPhysicalMaterial } from 'three';

/** Alpha-blended thin glazing approximation, without a transmission scene pass. */
export function applyThinGlassReflection(material: MeshPhysicalMaterial): void {
  material.onBeforeCompile = shader => {
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
      float glassCosine = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
      float glassFresnel = 0.04 + 0.96 * pow(1.0 - glassCosine, 5.0);
      float glassTintCoverage = diffuseColor.a;
      float glassCoverage = 1.0 - (1.0 - glassTintCoverage) * (1.0 - glassFresnel);
      // Standard alpha blending would otherwise multiply the already weak
      // dielectric reflection by tint opacity a second time.
      outgoingLight = (totalDiffuse * glassTintCoverage + totalSpecular)
        / max(glassCoverage, 0.0001) + totalEmissiveRadiance;
      diffuseColor.a = glassCoverage;
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=> 'roomsim-thin-glass-v1';
}
