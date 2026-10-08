# The Nih-Dairia boss lab: design

Owner, 2026-10-08, after the preliminary playtest of the refactor run: "create a lab to test integrating this as a boss
/Users/minikai/Downloads/nih-dairia-creature-kit. it would be quite large." Chosen in the brainstorm: a few cells across
(two to four cells, 20 to 40 m); the kit's jelly look, ported; the lab proves the creature runs on the sphere, chasing the
tank; option 1 (port into the project's stack) "as a separate lab experiment first". Built on branch `refactor-run`, where the
controller is clean; the game does not import any of it until a later spec makes it a boss.

## What the kit is

A portable soft-body creature exported from the owner's Jelly Baby project (`nih-dairia-creature-kit`, snapshot of
2026-10-08): 1,187 particles and 3,312 tetrahedra solved as neo-Hookean XPBD at 240 Hz in an embedded WebAssembly kernel
(27 KB of base64 in `soft-body-kernel.js`, with a JavaScript fallback), a 9,408-vertex skin deformed on the CPU by a
four-node embedding, a spider gait and a tentacle pursuit behaviour driven by twelve motion settings, and a 2.2 MB model
binary with a JSON manifest of typed-array slices. Units are metres, seconds and kilograms; gravity is local -Y; contact is
a plane at `PHYS.floor` (0.15 mm). Native extent 0.176 x 0.060 x 0.152 m. The kit is TypeScript on three 0.185 with the
WebGPU node materials; the physics and behaviour use only `Vector3`, `BufferGeometry`, `BufferAttribute` and
`DynamicDrawUsage`, all present in the vendored three r160. The README names the one missing piece: "Stalheart's spherical
ground needs a local surface-frame adapter before this can be a boss."

Scale: "a few cells" at the default 30 m across is a display scale of about 170 over the native 0.176 m. The physics is
never tuned at that scale; the lab exists to show whether the scaled motion reads as a boss.

## Scope

In: the port, the surface frame, the content preset, the pinned asset, the lab tab, the tests. Out (a later spec): the boss
as an enemy — spawning, health, damage, telegraphs, sound, the tank's and towers' interaction with its body, and its place in
a sector. The three pieces are the port, the lab, and the boss; this spec is the first two.

## 1. Files and ownership

| File | Layer | Owns |
| --- | --- | --- |
| `src/fx/nih-dairia/constants.js` | fx | `PHYS` and `clamp`, verbatim |
| `src/fx/nih-dairia/soft-body-kernel.js` | fx | the embedded WebAssembly module (base64), compiled lazily on first `createSoftBodyKernel`, never at import; returns `null` without WebAssembly |
| `src/fx/nih-dairia/soft-body.js` | fx | `SoftBody`: the solver (kernel or `stepJS`), contacts, grab, sleep, `updateSurface` |
| `src/fx/nih-dairia/deform-surface.js` | fx | the CPU four-node embedding of the skin |
| `src/fx/nih-dairia/cage-model.js` | fx | `parseCage(buffer, manifest)`: typed-array slices to the cage, elements, edges, contacts and the skin's `BufferGeometry` |
| `src/fx/nih-dairia/fixed-step.js` | fx | `FixedStepper`: 240 Hz accumulation with the 50 ms clamp, reporting the steps taken |
| `src/fx/nih-dairia/gait.js`, `pursuit.js`, `behavior.js` | fx | `SpiderGait`, `TentaclePursuit`, `MonsterBehavior` (states listening, probing, stalking, enveloping, recoiling) |
| `src/fx/nih-dairia/appearance.js` | fx | the skin's mesh: vertex pigment and the physical material |
| `src/fx/nih-dairia/creature.js` | fx | `createNihDairia(motion, { url })` → `{ mesh, body, motion, settings, setTarget(v), update(dt), reset(), dispose() }`, the kit's `portable.ts` contract; `update` returns the fixed steps taken |
| `src/content/nih-dairia.js` | content | `NIH_DAIRIA_MOTION` (the kit's `motion-settings.json`, version 1), `NIH_DAIRIA_LOOK` (pale `#b8b99a`, dark `#374237`, the material's transmission 0.65, thickness 0.012, ior 1.37, attenuation `#939b72` at 0.035, clearcoat 0.65/0.16), `NIH_DAIRIA_SIZE_METRES = 30`, `NIH_DAIRIA_MODEL_URL = 'assets/creatures/nih-dairia/nih-dairia.bin'` and its manifest URL |
| `src/domain/surface-frame.js` | domain | pure: `frameAt(point, radius, yaw)`, `toLocal(frame, world, scale)`, `toWorld(frame, local, scale)`, `reanchor(frame, localCentre, radius, scale)` |
| `src/labs/boss-tab.js` | labs | the lab tab, `initBossTab(root)` |
| `assets/creatures/nih-dairia/nih-dairia.bin`, `nih-dairia.json` | assets | the model, pinned |
| `docs/nih-dairia-assets.lock.json` | docs | sha256 of both files; credit "Nih-Dairia creature kit, exported from the owner's Jelly Baby project (source hash nih-dairia-spider-v2)"; no upstream URL (the owner's own export, nothing to fetch) |
| `labs.html`, `src/main.js` | composition | `<div id="tab-boss" class="tab tab-hidden"></div>`; `boss: () => import('./labs/boss-tab.js').then(m => m.initBossTab)` |
| `scripts/assets.mjs` | scripts | the lock file added to the list it checks |
| `test/surface-frame.mjs`, `test/nih-dairia-port.mjs`, `test/nih-dairia-content.mjs` | test | below |
| `scripts/browser-test.mjs` | scripts | the `--boss` smoke step |

The three layer rules hold by construction: `src/domain/surface-frame.js` imports nothing; `src/content/nih-dairia.js`
imports nothing; `src/fx/nih-dairia/*` imports the vendored three and content; the lab imports fx, content, domain and the
labs' shared helpers, never the game controller. The game controller imports none of this in this spec.

## 2. Port rules

- Types stripped, nothing else changed: same file names, same identifiers, same numbers, same order of operations in every
  step. Each file's first line names the source: `// Ported from nih-dairia-creature-kit <file> (owner's Jelly Baby export,
  2026-10-08), types stripped; the solver, the gait and the pursuit are unchanged.` The kit's own comments are kept.
- `import ... from 'three/webgpu'` becomes `import ... from '../../../vendor/three.module.js'`. Nothing else from three.
- `appearance.js` is the one rewrite: `MeshPhysicalNodeMaterial` becomes r160's `MeshPhysicalMaterial` with the same
  values (`vertexColors`, `roughness`, `metalness`, `transmission`, `thickness`, `ior`, `attenuationColor`,
  `attenuationDistance`, `clearcoat`, `clearcoatRoughness`, `side: DoubleSide`), read from `NIH_DAIRIA_LOOK`. The pigment
  loop is verbatim. Transmission in WebGL costs a transmission pass; the lab's readout prices it.
- `model.ts` folds into `creature.js`: the two fetches take the URLs from content, resolved against `document.baseURI` so
  the Workshop page and the built site both find them (the build copies `assets/` unchanged; nothing under
  `assets/creatures` is quantised or packed).
- Not ported: `graphics/renderer.ts` (WebGPU), `monster/arena.ts` and `monster/auto-lure.ts` (the lab has its own lure;
  the auto-lure's circling is re-created in the lab in ten lines, not imported), `scripts/*` (the model is shipped built;
  rebuilding needs the kit's toolchain and is not a project task), `main.ts`.
- The JS fallback (`stepJS`) stays and is tested; a browser without WebAssembly moves the creature slowly rather than not at all.
- The kit's invariants are kept as written: the host never moves the mesh transform independently of the body (the frame
  moves a parent `Group`, the mesh stays at the group's origin); `update(dt)` is the only entry (never `update` and
  `body.step` in one frame); a non-finite body throws, and the lab catches it, reports it on the readout and resets.

## 3. The surface frame

The creature simulates in its own flat metres; a frame places it on the planet.

- `frameAt(point, radius, yaw)`: `point` is a unit direction (the planet's centre is the origin, as in the story planet,
  where a surface point is `direction * (radius + altitude)` and the scene is shifted so the pole sits at y = 0). Returns
  `{ origin: [x, y, z] (direction * radius), up: direction, east, north }` with `east`/`north` the tangent basis rotated by
  `yaw` about `up`.
- `toWorld(frame, local, scale)`: `origin + (local.x * east + local.y * up + local.z * north) * scale`. The creature's local
  floor plane (y = `PHYS.floor`) lands on the surface at the origin and departs from it by the sphere's sagitta further out:
  `d^2 / (2 * radius)`, 15 cm at 15 m on a 750 m planet, under the scaled step height of 8.5 m. The lab's readout prints the
  sagitta at the creature's farthest foot so the number is on screen, not assumed.
- `toLocal(frame, world, scale)`: the inverse, the lure's mapping. The tank's world position comes in; its local y is
  clamped to the kit's lure height (0.012 m) so the pursuit aims at the floor, as the kit's arena does.
- `reanchor(frame, localCentre, radius, scale)`: when `hypot(localCentre.x, localCentre.z) * scale > 2 * cellSide`
  (20 m), returns `{ frame: frameAt(normalise(toWorld(frame, [centre.x, 0, centre.z], scale)), radius, yaw), shift:
  [-centre.x, 0, -centre.z] }`. The creature applies the shift to `body.x` and `body.previous` (and the kernel's views,
  which are the same memory) and to `motion.target` inside one fixed step, between `motion.step` and `body.step`, so
  velocities are untouched and the solver never sees a jump. The yaw is kept, so the creature's heading does not snap.
- The tank drives in the same local plane (the swarm lab's `stepYardDrive` in metres, no boxes) and is placed through the
  same frame at scale 1, so both actors sit on the curve correctly and the lure mapping is exact.

## 4. The lab (`src/labs/boss-tab.js`)

- **Scene.** The story planet built as the story tab builds it (`buildStoryPlanet(STORY_RECIPE, STORY_CLEARING,
  planetBake())`, `buildStoryPlanetMesh(planet, look)`), with the frame's anchor at the clearing's centre, and the planet's
  draw restricted to the cap within 40 cells of the anchor (cells beyond are hidden by a draw-range or a second cheap group;
  the plan decides which `story-planet-mesh` already supports) so the readout prices the creature, not the planet. The
  game's hemisphere and sun from the story tab's look, the labs' `OrbitControls`, the camera framed on the creature at game
  distances (the chase camera's height and lead, 11 m up and 26 m back, as the swarm lab frames the tank).
- **Actors.** The creature at `NIH_DAIRIA_SIZE_METRES`, placed by the frame, pursuing the lure. The tank: the game's hull
  model (`buildUnit('mork')` as the swarm lab does) at its real size, driven with WASD through `stepYardDrive`, placed
  through the frame.
- **Lure selector:** `tank` (default), `point` (click on the surface moves it), `auto` (the kit's circling lure, re-created:
  a point orbiting the creature's centre at a radius of 0.6 of its size, one turn per `reachTime` seconds).
- **Knobs** (lil-gui, the labs' panel style): the twelve motion settings (`speed`, `reachTime`, `pullTime`, `pauseTime`,
  `erratic`, `stretch`, `spread`, `stepHeight`, `stepDuration`, `stepSpacing`, `stride`, `recoil`) bound to
  `creature.settings` (live, as the kit allows), `size` in metres (re-places the creature; the physics is untouched),
  `gravity` and `iterations` (bound to the creature's `PHYS` copy), buttons `disturb`, `reset`, `re-anchor now`, and the
  state readout (`listening` ... `recoiling`).
- **Readout** (a monospace line as the swarm lab's): `solver <ms> (<steps> steps) · skin <ms> · render <ms> · centre
  <m/s> · sag <m>`. Solver and skin are `performance.now()` around `creature.update(dt)` split by the stepper's callback
  and `body.updateSurface`; render is measured the swarm lab's way (`gl.finish()` in a tight loop, so it reads the work,
  not the vsync). The steps count turns red when the 50 ms clamp cut steps (12 is the cap). A rolling 60-frame mean.
- **Export.** `copy settings` writes `{ version: 1, motion: {...twelve}, sizeMetres }` to the clipboard, the content
  preset's shape, for pasting into `src/content/nih-dairia.js`. No new preset format; no file writer.
- **Failure.** A thrown non-finite body is caught per frame: the readout prints the message, the creature resets, the
  frame continues. A missing or mismatched asset prints the fetch error in the tab and stops.

## 5. Assets, build and checks

- The binary and manifest copy into `assets/creatures/nih-dairia/`; `docs/nih-dairia-assets.lock.json` pins their sha256
  and `scripts/assets.mjs` lists it, so `npm run assets:check` (and so `npm run check`) fails if either byte changes.
- The build copies `assets/` unchanged; nothing to pack. The kernel's base64 travels inside its module.
- `npm run architecture` sees three layer modules and one lab; no new top-level module; the domain module imports nothing;
  the lab never imports `td-tab.js`. The controller's ceiling is untouched (no line added to td-tab).
- No console logging of anything but the kit's existing one-line kernel-unavailable warning.

## 6. Tests

- `test/surface-frame.mjs`: on a sphere of radius 750, a frame at a random direction maps a local point to a world point
  whose distance from the origin along the surface equals `hypot(x, z) * scale` within 1e-6 relative, and `toLocal` of
  that returns the local point within 1e-9; `reanchor` with a centre 25 m out returns a frame whose origin is the
  surface point under the centre and a shift that brings the centre to [0, y, 0]; below 20 m it returns the same frame
  and a zero shift; yaw is preserved.
- `test/nih-dairia-port.mjs`: loads the port in node with the vendored three (node can import it; the labs' tests already do),
  parses the real model from `assets/creatures/nih-dairia/`, builds a `SoftBody`, runs 200 fixed steps from rest with the
  kit's `PHYS` and no behaviour: the body stays finite, settles grounded (`body.grounded` true, centre y within 10 % of the
  rest centre), keeps `volumeRatio()` within 1.05 of 1, and the kernel and the JS fallback (`body.kernel = null`) agree on
  the centre within 1 mm after 200 steps. Then with `MonsterBehavior` and a target 0.2 m away, 1,200 steps: the centre
  has moved toward the target by more than 0.02 m. The numbers come from the first run and are pinned as bounds, not
  digests.
- `test/nih-dairia-content.mjs`: `normalizeMotion(NIH_DAIRIA_MOTION)` deep-equals the kit's `motion-settings.json`
  values; `NIH_DAIRIA_SIZE_METRES` is a positive finite number; the look's numbers are within the material's ranges.
- Browser: `--boss` in `scripts/browser-test.mjs` opens `labs.html#boss`, waits for the readout to show a solver time and
  at least one fixed step, checks the creature's mesh has a positive bounding-sphere radius in world units above 10 m,
  drives the tank for two seconds and checks the creature's state left `listening`. Runs through
  `scripts/browser-lock.sh` like every suite.

## Open questions for the boss spec (not this one)

What the body is to a shell, a round, a laser and the tank's ram (the kit has `grab` and `nudge`, no damage); whether the
boss walks the cell graph or the free surface; how its size interacts with gates and walls (no collision in the kit beyond
the floor); the cost on a phone (the lab's readout on the owner's device decides); the look under the game's post-processing.

## Records

Spec recorded as `2026-10-08-nih-dairia-boss-lab-design` (decision, proposed) when the plan starts; the lab's landing as a
change entry. A separate note (`2026-10-08-mesh2motion-as-a-boss-animation-source`, experiment, proposed) marks
https://app.mesh2motion.org/ as a source to explore for boss animation, unrelated to this lab.
