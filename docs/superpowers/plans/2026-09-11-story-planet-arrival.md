# Story planet and arrival — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `labs.html#story` lab showing the 753 m story planet with its polar clearing, terraces, tiled pad, one open lane mouth, and the SH02 landing with plume, dust, door and Isao rising out.

**Architecture:** Pure content/core/domain modules build the planet and the arrival timeline and are Node-tested. Lab modules under `src/labs/` turn them into Three.js geometry, load the pinned SH02 and Isao, and drive the sequence from one clock. No module imports `td-tab.js`.

**Tech Stack:** Native ESM, vendored Three.js r160, Node 22+ tests in `test/*.mjs`, `scripts/browser-test.mjs` over headless Chrome.

## Global Constraints

- New modules go in `src/core`, `src/domain`, `src/content`, `src/fx` or `src/labs`; `npm run architecture` rejects new top-level `src/*.js` and any growth of `src/td-tab.js`.
- Domain imports only core, domain and the pinned kernel (`src/grid.js`, `src/dungeon.js`, `src/vec3.js`); content imports only core.
- Kernel algorithms are not modified. Source imports carry no `?v=` tokens.
- No colored emoji in product UI; monochrome vocabulary only.
- Assets are pinned by sha256 in a `docs/*.lock.json` verified by `scripts/assets.mjs`; jelaludo is credited.
- `npm test`, `npm run check`, `npm run build` must pass; `npm run test:browser` for the lab.

---

### Task 1: Terrace profile (core)

**Files:** Create `src/core/terrace-profile.js`; Test `test/terrace-profile.mjs`.

**Produces:** `drop(d, R)` → metres the sphere falls below the pole tangent plane at arc distance `d`; `terraceFloor(d, { radius, padRadius, step })` → floor height (≤ 0) in the pad frame; `terraceLevel(d, opts)` → 0 for the pad, k ≥ 1 for band k; `terraceAltitude(d, opts)` → radial offset applied to a lattice vertex (`drop + floor`), 0 beyond `clearRadius` with a smoothstep over `blend` metres.

- [ ] Test: `drop(0,753)===0`, `drop(64,753)` ≈ 2.72; pad floor constant for d < padRadius; floors non-increasing with d; |altitude| ≤ step/2 + 1e-9 inside bands; altitude 0 at d ≥ clearRadius + blend.
- [ ] Implement; `node test/terrace-profile.mjs` passes.

### Task 2: Story planet (content + domain)

**Files:** Create `src/content/story-defaults.js`, `src/domain/story-planet.js`; Test `test/story-planet.mjs`.

**Produces:** `STORY_RECIPE` (seed 7, points 16000, k 12, relaxIters 80, pullRate 0.25, rooms 384, roomRadius 4, extraCorridors 192, corridorWidth 1, metresPerCell 10, wallMetres 4), `STORY_CLEARING` (radiusMetres 150, padRadius 46, step 2, blend 20, mouthMaxCells 2), `STORY_SANITY` (cells 71314, heart, cellSide). `buildStoryPlanet(recipe = STORY_RECIPE, clearing = STORY_CLEARING)` → `{ mesh, dungeon, graph, radius, cellSide, clearing: { cells: Set, mouths: [{cells, azimuth}], openMouth, yaw }, altitudeOf(vertexIndex), arcOf(vertexIndex) }`. `frameToWorld([x,y,z], radius, yaw)` maps pad-frame metres to metres with the pole at the origin and the planet centre at (0,-R,0), using `breachPoint` from `src/core/breach-surface.js` rotated by `yaw`.

- [ ] Test on a small recipe (points 800) for structure: every cell inside the clearing is open; exactly one mouth open, others sealed; yaw puts the open mouth on -Z of the frame within one cell; determinism. Then the full recipe once: cells 71314 and the pinned heart/cellSide.
- [ ] Implement; tests pass; `npm run architecture` passes.

### Task 3: SH02 asset pin

**Files:** Create `docs/sh-rocket-assets.lock.json`; Modify `scripts/assets.mjs` lock list, `ATTRIBUTIONS.md`.

- [ ] Lock: schema 1, upstream `https://github.com/jelaludo/SentryTowers_A6`, revision `d39f3a78e...` (full sha from `gh api`), baseUrl `https://raw.githubusercontent.com/jelaludo/SentryTowers_A6/<rev>/`, credit, file `assets/models/story/sh_rocket.glb` from `assets/sh-rocket/sh_rocket.glb`, sha256 `9c777de6f9f766539915fa1132bbc72e0a5383aae369b7e5f416545c74ce3c33`, bytes 1587456, clips.
- [ ] `node scripts/assets.mjs fetch` downloads it; `npm run assets:check` passes. ATTRIBUTIONS gains the SH02 entry and the plume GLSL (pulkitxm/claude-directory, MIT).

### Task 4: Landing sequence (domain)

**Files:** Create `src/domain/landing-sequence.js`; Test `test/landing-sequence.mjs`.

**Produces:** `LANDING_BEATS` and `makeLandingSequence(tune = LANDING_DEFAULTS)` → `{ duration, stateAt(t), skip() }` where state = `{ phase, altitude, plume (0..1), clips: { Legs_Deploy, Landing_Shock, Top_Door_Open } (seconds into clip or null), isaoRise (0..1), dust (true only during the touchdown second), scorch (bool) }`. `LANDING_DEFAULTS` lives in `src/content/story-defaults.js` (orbit 4, descent 8, startAltitude 300, deployAltitude 40, shock 2, settle 2, door 1.8, isao 3).

- [ ] Tests: legs deploy completes ≥ 0 s before touchdown; altitude 0 from touchdown on; no clip time before its start; plume 0 at touchdown; `skip()` deep-equals `stateAt(duration)` with door 1.8, isaoRise 1, phase 'done'.
- [ ] Implement; tests pass.

### Task 5: Launch plume material (fx)

**Files:** Create `src/fx/launch-plume.js`.

**Produces:** `createLaunchPlume({ height = 24, width = 10, steps = 28, octaves = 6 })` → THREE.Mesh (PlaneGeometry, ShaderMaterial, additive, depthWrite false) with `userData.setIntensity(v)` and `userData.tick(t)`; the material faces the camera about the rocket axis via `userData.face(camera)`.

- [ ] Implement the ported GLSL (uniforms iTime, uSteps, uTint, uCam, uSquash, uOctaves, uTurb, uCore, uDetail, uStepSize, uExposure, uIntensity), ray from UV instead of gl_FragCoord. Verified visually in Task 6.

### Task 6: Story lab

**Files:** Create `src/labs/story-planet-mesh.js`, `src/labs/story-landing.js`, `src/labs/story-tab.js`; Modify `labs.html` (tab button + `#tab-story` with `#story-app`, `#story-hud`), `src/main.js` (route `story`), `app.css` (HUD).

**Produces:** `buildStoryPlanetMesh(planet, look)` → Group of floors/tops/sides/edges/mouth markers plus `userData.dispose`; `createStoryLanding(scene, { frameToWorld, radius, yaw, touchdown })` → `{ ready, seek(t), skip(), reset(), dispose }`; `initStoryTab(root)` with keys L (land), K (skip), R (reset), and `window.__stalheartStoryTest` under `?acceptance=1` exposing `state()`, `land()`, `skip()`, `seek(t)`.

- [ ] Planet mesh from the unit-sphere lattice scaled to metres with `altitudeOf`; instanced 4 m tiles on the pad; camera framed on the pad; page runs at `http://127.0.0.1:8155/labs.html#story`.
- [ ] Rocket load with clips (LoopOnce, clampWhenFinished), parent node altitude, plume under the bells, dust burst via `ParticleSystem` SMOKE, scorch via `makeScorch`, Isao via `makeIsaoDrone` fitted to 2.5 m rising from the cargo well.

### Task 7: Browser test, docs, records

**Files:** Modify `scripts/browser-test.mjs` (`--story`), `docs/STATE.md`; Create `docs/STORY.md`; log entry via `npm run log -- add`.

- [ ] `--story`: page ready, planet cells 71314, exactly one open mouth, tiles > 200, land → state at 13 s has altitude 0 and Legs_Deploy at its end, skip → door open and Isao out, screenshots.
- [ ] Docs and decision entry; `npm test`, `npm run check`, `npm run build` pass.
