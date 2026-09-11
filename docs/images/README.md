# README visual assets

These files are stable documentation assets; README files must not reference the transient `test-results/` directory.

| File | Source / meaning |
| --- | --- |
| `roomsim-concept.png` | AI-generated editorial concept illustration, created with the built-in image generation tool on 2026-09-11. Not an application screenshot or a promise of current rendering quality. |
| `workflow.svg` | Editable, hand-authored SVG diagram: plan → furnish / utilities → explore / interact. |
| `floor-plan.png` | Unmodified Playwright application screenshot, three-bedroom template with furniture reference visible. |
| `apartment-3d.png` | Unmodified Playwright application screenshot, three-bedroom cutaway overview. |
| `water-network.png` | Unmodified Playwright application screenshot, water-only view with source labels and focused camera. |

Screenshots captured from the local application on 2026-09-11. Regenerate the relevant screenshots with `pnpm e2e`, inspect them, then copy the selected outputs into this directory. This update is intentionally manual so running tests does not replace published documentation images.

## Final generation prompt

Tool: built-in `image_gen` (not the CLI fallback). No input reference images.

```text
Use case: stylized-concept
Asset type: wide editorial cover illustration for the RoomSim open-source README, approximately 2:1 landscape.
Primary request: A beautiful, sophisticated architectural dollhouse illustration expressing draw a floor plan, furnish a home, then experience living inside it. Not a software screenshot.
Scene: one coherent miniature residential apartment cutaway floating just above warm ivory paper. Connected living and dining room, kitchen with an open refrigerator door, bedroom, bathroom and balcony plants. One small adult figure stands in the kitchen and a child reads by the living-room sofa. At the left edge a delicate teal floor-plan drafting drawing gradually becomes the solid furnished 3D home. A few discreet blue, coral red and green schematic utility lines under the bathroom floor suggest water planning, not a technical construction diagram.
Style: premium architectural editorial illustration, tactile matte clay and paper model, precise geometry, beautifully curated furniture, soft ambient occlusion, natural linen, pale oak, ceramic, gentle afternoon sunlight, subtle paper grain. Warm ivory and sand with muted deep teal accents matching a home-design tool. Restrained, spacious, mature, not glossy toy plastic, not an AI dashboard.
Composition: centered isometric three-quarter cutaway house occupying about 75 percent of the width, entire model visible with generous clean margins, quiet background, carefully layered forms. No panels, no UI overlays.
Text: no text, letters, numbers, watermarks or logos. This is aspirational concept artwork, not a claim of actual rendering fidelity.
```

