# Offline simulated woven throw — candidate

Generated from repository-authored geometry and Blender cloth simulation, not a downloaded furniture model. No third-party texture is embedded in the GLB; the browser study uses the existing project's fabric material.

- Tool: Blender 4.5.9 LTS portable, downloaded from [official release directory](https://download.blender.org/release/Blender4.5/).
- Windows archive SHA-256: `41da973b9bf95bb312cbeff4d1982feb13259b43c821686b9bafea4dfe5477cf` (verified against the official checksum file).
- Tool installation is portable at `E:\work\space\roomsim-asset-tools`, outside the repo. Neither tool nor archive is part of the web build.
- Rebuild: run `scripts/build-cloth-asset.py` through Blender background mode with `--threads 4 -- --output docs/asset-studies/draped-throw --frames 60`.
- Source: `draped-throw-source.blend`; static export: `draped-throw.glb` (121644 bytes), 1 mesh / 5468 triangles.
- Preview: `node scripts/capture-cloth-asset.cjs`, image `docs/images/draped-throw-asset-study.png`.

The current authored collision mattress is 1.41 × 1.86 m with its top at 0.45 m, matching the sample room's 1.50 m double bed. The collision scene now includes the procedural white duvet and wood frame, with mirrored coordinates matching the runtime 180-degree Y rotation. Post-reduction local contact correction prevents smoothing vertices through the duvet. Earlier 1.80 m / 0.60 m variants were rejected after room tests showed interpenetration.

Room preview: `ROOMSIM_STUDY=showroom ROOMSIM_FOCUS=bedroom node scripts/capture-material-study.cjs` (set variables using the host shell). Normal startup now loads the published asset only for a matching 150×200×45 cm bed. `ROOMSIM_CLOTH_STUDY=1` remains an explicit source-file preview. Other dimensions or failed loads fall back to the existing cloth; other bed dimensions need separately verified collision-fit variants.

First simulation slipped off the mattress and was rejected. A held upper edge, shorter overhang and higher tensile stiffness corrected coverage and drop. Smoothing before/after reduction softens pinches without increasing the geometry budget. Browser loading and inspected front/back/top/bedroom views no longer show the earlier white holes/frame intersections. Loading now has a six-second fallback, request deduplication, exit cancellation, stale-result protection and source cleanup. Other bed variants and hardware performance remain unverified, and the overall appearance is not considered final. Runtime physics is neither needed nor shipped.

Resolved height failure: the old 0.601 m bulge came from excessive rest length near the held edge (17 cm initial lift). Reducing initial lift to 4 cm and seed wave amplitudes to 8/4 mm brings the maximum to 0.5314 m, within the unchanged 0.55 m gate. Minimum is 0.0732 m. `cloth-package.test.ts` now checks exported geometry and height/size limits directly, plus absence of animation, skinning and embedded images.

Set `ROOMSIM_CLOTH_BED=1` for `capture-cloth-asset.cjs` to assemble the real bed and capture front/back/top views. These views have been inspected for the prior bulge and obvious duvet/frame intersections. They do not establish fit for different dimensions or final reference fidelity.
