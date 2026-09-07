# Tech Stack

For a developer holding a library, a tool or a technique, and asking whether
it will fit here.

> This project has no build step. Every other choice on this page follows
> from that one.

## What it is

| Layer | Choice | Consequence for you |
|---|---|---|
| Language | Vanilla ES modules, browser-native | No transpile. Ship syntax the browser runs today — no JSX, no TypeScript, no decorators |
| 3D | three.js **r160**, vendored flat in `vendor/` | Pinned. Vendor files import `./three.module.js` bare; anything you add must too |
| UI | Hand-written DOM + CSS, `lil-gui` for dev panels | No framework, no virtual DOM, no component runtime |
| Audio | Web Audio API directly | No audio library |
| Models | glTF 2.0 `.glb` via vendored `GLTFLoader` | Supports `KHR_materials_unlit`, `KHR_materials_emissive_strength`, `EXT_mesh_gpu_instancing` |
| Build | **None.** Files are served as authored | No bundler, no minifier, no dev server with HMR |
| Packages | npm, but **dev-only** | `package.json` has zero runtime dependencies. Nothing from `node_modules` reaches the browser |
| Tests | Plain `.mjs` run by `node`, a house `check()` helper | No jest/vitest/mocha. `npm test` chains suites with `&&` |
| Hosting | Static files, GitHub Pages | No server, no API, no database, no auth, no SSR |
| Cache busting | `?v=<token>` rewritten by `scripts/bust.sh` | A new module's relative imports must be stamped once by hand |

## Will it fit?

### Fits without discussion

Anything that is a plain ES module, has no dependencies, and can be dropped
into `src/` or vendored into `vendor/`.

### Fits with vendoring

A library shipped as ESM whose imports you can rewrite to relative paths.
That is how the postprocessing chain and `GLTFLoader` got here — copy the
files in, rewrite `from 'three'` to `from './three.module.js'`, keep the
version identical to `vendor/three.module.js`.

### Does not fit

Anything requiring a compile, bundle or transform step to run — TypeScript,
JSX, SCSS, npm packages that assume a bundler resolves bare specifiers, or
anything published only as CommonJS.

### Needs a real decision first

Anything that would introduce a build step at all. That is a project-shape
change, not a dependency choice — say so up front rather than adding a tool
that quietly requires one.

## Rules that will bite you

- **Never put `?v=` on a `vendor/` import.** A tokened URL is a *different
  module* to the browser, so you get a second copy of three.js — doubled
  memory, broken `instanceof`. `scripts/check-tokens.sh` fails the push on it.
- **Match the three.js version exactly** when vendoring anything from
  `three/examples`. Core and examples drift across revisions.
- **`bust.sh` rewrites existing `?v=` tokens; it does not add them.** Stamp a
  new module's imports by hand once, then it stays in sync.
- **Commit `bust.sh` output atomically.** It rewrites tokens repo-wide; a
  partial commit ships stale import tokens by construction.
- **No `Math.random` in game logic.** Everything deterministic seeds from
  `params.seed` via `mulberry32`, so a replayed seed is identical.
- **Values that must agree with what is rendered** — camera facing, weapon aim
  — are derived FROM the render transforms (`getWorldQuaternion`), never
  recomputed with a second set of conventions.

## Verified against

- **Desktop Chrome / Safari** on macOS, and **iOS Safari**.
- **WebGL2** through three.js r160. No WebGPU — r160 predates its stable path.
- **Node 18+** for the test suites only.
- Headless checks run Chrome with `--use-angle=swiftshader
  --enable-unsafe-swiftshader`. Not `--disable-gpu`, which kills WebGL
  entirely.

Two browser limits shape the code. **Audio cannot start without a user
gesture**, so the `AudioContext` is created on first input and every call is a
silent no-op before that. And **iOS mutes Web Audio on the hardware silent
switch**, which is deliberately not worked around.

## Where things live

- `src/` — app modules. Pure logic (grid, dungeon, creatures, voice budget,
  bloom weights) is DOM-free and Node-tested; the tabs own rendering.
- `vendor/` — three.js and its examples, flattened, imports rewritten.
- `assets/` — audio (`.mp3`, built from committed `.wav` masters) and models
  (`.glb`).
- `test/` — one `.mjs` per invariant suite.
- `scripts/` — `bust.sh` (cache tokens), `check-tokens.sh` (pre-push guard),
  `audio-build.sh` (asset pipeline).
