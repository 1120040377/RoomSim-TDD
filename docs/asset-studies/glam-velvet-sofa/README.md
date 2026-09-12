# Glam Velvet Sofa — candidate source asset

- Source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa
- Copyright 2021, Wayfair, LLC. Artist: Eric Chadwick.
- License: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/
- Original author documentation and legal notice: [SOURCE.md](SOURCE.md).
- Retrieved 2026-09-12. Four original glTF package files, 3,160,297 bytes total. No changes to downloaded geometry or images.
- Verified Git blob SHA-1 against the source repository content API:
  - GlamVelvetSofa.bin: b2e03eb24eda18dc2bb7ed715061b20fd2df9601
  - GlamVelvetSofa.gltf: d73e8e35dc40e55f04c8828b9df44ae3176dd60e
  - GlamVelvetSofa_normal.png: 411d941b862d0ce360f91edb3aada6703970be39
  - GlamVelvetSofa_occlusion.png: af5ebe16ac75fa2936e5ad6dfcd164051d0b82d4

Actual inspection found a curved one-piece velvet seat, not the reference's
modular L-shaped linen sectional. Rejected as a direct replacement.
The loaded glTF contains 4,196 triangles (rather than the README's 4,319),
three mesh primitives, and one presentation light. Bounds are approximately
2.1884 × 0.7875 × 1.0228 metres (width / height / depth).
It is outside public/ and is not loaded by the walkthrough or copied into the
production build. `scripts/capture-sofa-asset.cjs` tests the
actual model in an isolated viewer, selects its supplied champagne material,
and excludes its embedded presentation light. Any later adapted/redistributed
version must retain attribution and identify its changes.
