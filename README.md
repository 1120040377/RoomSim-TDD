# RoomSim

**A browser-based "pre-renovation spatial comfort simulator."**  
Draw a floor plan in 2D top-down view, place furniture → switch to 3D first-person walkthrough to judge whether the space actually feels comfortable to live in.

**Live Demo:** [https://1120040377.github.io/RoomSim-TDD/](https://1120040377.github.io/RoomSim-TDD/)  
**中文文档:** [README.zh.md](./README.zh.md)

For technical design details, see [RoomSim-TDD.md](./RoomSim-TDD.md).

---

### Who Is This For?

**You just got the keys to a new place — but the furniture isn't there yet.**  
You have a sofa, a bed, and a wardrobe on order, and you're staring at an empty room wondering if everything will actually fit and still leave room to walk. Draw the floor plan in RoomSim, place the furniture, walk through it in first-person — before anything arrives.

**Cooking: fridge → prep → stove → sink.**  
Will the kitchen triangle flow naturally, or will you be doing laps? Will two people cooking at the same time collide? Simulate the full path from grabbing ingredients to washing up, and spot unnecessary back-and-forth before the cabinets are installed.

**3 a.m. bathroom run — in the dark.**  
From the edge of the bed to the bathroom door, will you clip a bed corner or squeeze past the wardrobe? Walk the night-time route in RoomSim's first-person view and make sure there's nothing in the way.

**Working in the study — stepping out for water or a bathroom break.**  
If the study is the innermost room in a two-bedroom apartment, how many steps and tight squeezes does every break involve? Verify the corridor is wide enough before the walls go up.

---

### Quick Start

```bash
pnpm install
pnpm dev          # http://localhost:5174/
pnpm test         # Vitest full unit tests (currently 124 tests)
pnpm typecheck    # vue-tsc
pnpm build        # Production build to dist/
pnpm preview      # Preview dist
```

> **Windows note:** If you see `Cannot find module @rollup/rollup-win32-x64-msvc` or `Application Control policy has blocked`, this project already replaces rollup with `@rollup/wasm-node` (pure JS) via `pnpm.overrides` in `package.json`. Re-run `pnpm install` to fix it.
>
> If `vue-tsc` reports `Search string not found: "/supportedTSExtensions = .*(?=;)/"`, it means vue-tsc and TypeScript versions are mismatched — keep `vue-tsc ^2.0.0` with `typescript ^5.3.0`.

### Features (P0)

**Editor (2D top-down)**
- Draw walls, one-click rectangular room, doors/windows snap to walls
- Furniture library with 30+ items, drag-to-place, property panel (size / color / rotation / copy / delete)
- Automatic room detection (flood-fill algorithm on the floor plan)
- 4-level snapping: endpoint / wall midpoint / wall perpendicular / grid
- Undo/redo (50 steps, continuous drag auto-merge)
- Ergonomic warnings: 8 rules (clearance / sofa / bed surround / kitchen triangle / door swing / wall height…)
- Auto-save to IndexedDB (5s debounce) + JSON import/export

**3D Walkthrough**
- First-person WASD + mouse (PointerLock), Shift to run
- Walls with openings (door/window geometric clipping) + floor + furniture boxes + outlines
- Circle-OBB collision (anti-clipping, sweep subdivision to prevent tunneling)
- E key interaction: toggle door 90° animation, toggle lights (PointLight intensity)
- Height adjustment 140–200 cm in real time
- Center-screen ray detection + HUD hints

**Templates:** Blank / Master bedroom 18㎡ / Studio 50㎡ / 2-bed 70㎡ / Open kitchen 12㎡

### Keyboard Shortcuts

**Editor:** `V` select · `W` draw wall · `R` rectangular room · `D` door · `I` window · `Esc` cancel · `Ctrl+Z/Y` undo/redo · `Ctrl+D` copy · `Del` delete · `?` shortcut help

**Walkthrough:** `WASD` move · `Shift` run · `E` interact · `Esc` exit

### Architecture

```
Vue 3.4 + TypeScript 5 + Vite 5
├── 2D rendering: Konva.js 9 (6-layer Stage/Layer architecture)
├── 3D rendering: Three.js 0.160 (native API, no TresJS)
├── State: Pinia 2 + shallowRef + command pattern (20+ commands, fully reversible do/undo)
├── Storage: Dexie 4 (IndexedDB) + Zod schema validation
└── Styles: UnoCSS
```

**Layering principle:** `geometry/` contains pure functions only (no Vue / Konva / Three.js dependencies), 100% test coverage; `store` holds state, UI is read-only and dispatches commands; both `editor` and `walkthrough` subscribe to the same Plan.

**2D↔3D coordinate convention** (locked in [walkthrough/coord.ts](src/modules/walkthrough/coord.ts) with test protection):
```
editor (x, y)  ⇒  three (x, heightZ_cm, y) × 0.01   // cm → m
editor angle   ⇒  three.rotation.y = -angle
```

### Testing

```bash
pnpm test              # Vitest unit tests (currently 124 pass)
pnpm test -- <pattern> # Filter tests
pnpm test:watch        # Watch mode
pnpm e2e:install       # Download Chromium before first e2e run (~111MB)
pnpm e2e               # Playwright smoke tests for 3 core paths
```

**Unit test coverage** (`tests/unit/`):
- `geometry/`: opening-cut / collision (slide) / room-detect / snap / nearest-wall
- `commands/`: do ↔ undo deep equivalence, continuous Move/Rotate merge
- `store/history`: stack management + merge + capacity limit + BatchCommand
- `walkthrough/`: coord conversion constraints + WallBuilder slab count + CollisionBuilder
- `ergonomics/`: positive/negative fixtures for each of the 8 rules
- `templates/`: all templates pass PlanSchema
- `model/schema`: Zod validation
- `storage/migrations`: version migration skeleton

**E2E coverage** (`tests/e2e/smoke.spec.ts`):
1. Template → editor → back to list → plan still present after refresh
2. Template → enter walkthrough → canvas renders + height control visible
3. Import corrupted JSON → error prompt → original plan unchanged

### Directory Structure

```
src/
├── views/                  # Three pages (Home / Editor / Walkthrough)
├── components/             # Toolbar / FurniturePanel / PropertyPanel / HelpOverlay
├── modules/
│   ├── model/              # types + Zod schema + defaults
│   ├── store/              # Pinia (plan / editor / history)
│   ├── commands/           # 14 commands, grouped by wall/opening/furniture
│   ├── geometry/           # Pure geometry algorithms
│   ├── editor/             # Konva Canvas + tool strategy pattern
│   ├── walkthrough/        # Three.js builders + FPS controller + collision
│   ├── ergonomics/         # Rule engine + 8 rules
│   ├── storage/            # Dexie + import/export + migrations
│   └── templates/          # Furniture catalog + floor plan templates
└── styles/
tests/unit/                 # Mirrors module structure
```

### Deployment

Pure static site — any hosting platform works. Routing uses `createWebHashHistory` (URL contains `#`), so no SPA rewrite rules are needed; subdirectory deployment requires no fallback config.

#### GitHub Pages (recommended · CI configured)

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) is a ready-to-use workflow: push to `main` triggers → typecheck + unit tests + build + publish.

**Activate:** just push to `main`. The workflow uses `actions/configure-pages` with `enablement: true`, which automatically enables Pages and sets Source to GitHub Actions if not already configured — no manual Settings changes needed.

After the first run, visit `https://<user>.github.io/<repo>/`.

The build injects `BASE_URL=/<repo>/` into Vite via environment variable; asset references are prefixed automatically. Local `pnpm dev` / `pnpm build` are unaffected (defaults to `/`).

#### Vercel
```bash
pnpm build
# Upload dist/, or connect git for automatic deployment. base defaults to /.
```

#### Any Static Host / OSS
```bash
pnpm build
# Upload dist/, set index.html as the default page.
# Subdirectory deployment: BASE_URL=/sub/ pnpm build
```

### Known Limitations (P1+)

- **Wall splitting:** when an interior wall endpoint lands on the middle of an exterior wall, `detectRooms` cannot identify sub-rooms (the 2-bed template currently detects as 1 large room). Requires a future `splitWallsAtHangingNodes` pass.
- **Mobile FPS:** virtual joystick / swipe-to-look not implemented; mobile is editor-only.
- **TV:** VideoTexture video playback not implemented, E key is a placeholder.
- **Wall/door/window selection:** PropertyPanel currently only works for furniture.
- **InstancedMesh:** when furniture count exceeds 100, batching optimization is possible.

### License

Personal renovation tool project. No license declared.
