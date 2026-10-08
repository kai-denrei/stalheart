# The Nih-Dairia boss lab: design

Owner, 2026-10-08, after the preliminary playtest of the refactor run: "create a lab to test integrating this as a boss
/Users/minikai/Downloads/nih-dairia-creature-kit. it would be quite large." Chosen in the brainstorm: a few cells across
(two to four cells, 20 to 40 m); the kit's jelly look, ported; the lab proves the creature runs on the sphere, chasing the
tank; option 1 (port into the project's stack) "as a separate lab experiment first". Then: "note that we've separately
made progress on the creature animation. check ?specimen=nih-dairia on the Jelly-Baby project", and the mode idea recorded
as `2026-10-08-boss-mode-idea-draw-it-off-the-base`: the creature is huge and slow, the tank draws it off the base and
escapes its tentacles while the gunship and SOL take aim. Built on branch `refactor-run`, where the controller is clean;
the game does not import any of it until a later spec makes it a boss.

**Revision (same day):** the Downloads kit was a day behind the owner's lab-creatures project
(`/Users/minikai/Dev/Jelly-Baby`, commit f2a4f89, public at kai-denrei.github.io/lab-creatures). The source of the port
is that project's own export, `dist-exports/nih-dairia-creature-kit.zip` (identical to its head; unpacked in the session
scratchpad as `kit-export/`). It adds prey capture and feeding, guided cradling, ground traction, limb separation, sensory
reach sweeps, two more motion settings (fourteen) and four body plans with their own models. The spec below describes that
kit.

**Second revision (Task 3's review, same day):** the owner's project kept moving while the port ran (head b3cfb52 at
11:00 JST: four more body plans, a dorsal module, mobile controls, and a six-line fix in `pursuit.ts` so a target that
keeps turning no longer restarts every reach and starves the pull). The port stays pinned at f2a4f89 except for that
pursuit fix, which is taken as-is (a turning tank is exactly its case) with its upstream test (`verify-probes.mjs` at
b3cfb52: 20 s of a turning target must count more than 100 pulls), the file's header naming b3cfb52 for it. The newer
body plans are a later refresh, not this lab.

## What the kit is

A portable soft-body creature: 1,187 particles and 3,312 tetrahedra (the ancestor plan) solved as neo-Hookean XPBD at
240 Hz in an embedded WebAssembly kernel (27 KB of base64 in `soft-body-kernel.js`, with a JavaScript fallback), a
9,408-vertex skin deformed on the CPU by a four-node embedding, a spider gait, a tentacle pursuit with two probing arms,
ground traction on planted feet, limb separation by sphere chains, and a feeding cycle: unheld prey that stays within
reach (7.5 cm native) for a tenth of a second is cradled by two guided half-wraps, covered, absorbed, and the creature
recovers and new prey spawns. Fourteen motion settings drive it. Four body plans: `nih-dairia` (six limbs, the reference),
`brood` (six, heavy), `reed` (four), `crown` (eight), each a 2.2 MB model binary with a JSON manifest of typed-array
slices. Units are metres, seconds and kilograms; gravity is local -Y; contact is a plane at `PHYS.floor` (0.15 mm). Native
extent 0.176 x 0.060 x 0.152 m. The kit is TypeScript on three 0.185 with the WebGPU node materials and TSL; the physics
and behaviour use only `Vector3`, `Color`, `Plane`, `BufferGeometry`, `BufferAttribute`, `DynamicDrawUsage` and the
primitive geometries, all present in the vendored three r160. The README names the one missing piece: "Stalheart's
spherical ground needs a local surface-frame adapter before this can be a boss."

Scale: "a few cells" at the default 30 m across is a display scale of about 170 over the native 0.176 m. The physics is
never tuned at that scale; the lab exists to show whether the scaled motion reads as a boss. At that scale the creature's
reach is about 13 m and a captured tank is a lost hull: the mode idea's "escaping its tentacles" is the kit's own feeding
rule, with the tank as prey.

**Licence (the owner's decision, open).** lab-creatures is GPL-3.0, derived from scottstts/Jelly-Baby, and the kit's
export carries that LICENSE. Stalheart's repository has no licence file and is public with its source on GitHub and its
build on Pages. Porting the kit into `src/` makes the published combined work subject to the GPL's terms. Nothing in this
spec is pushed until the owner decides: accept GPL-3.0 for Stalheart's published source, keep the creature out of the
public tree, or another arrangement. The lab is built on the unpushed branch meanwhile; the port's file headers name the
origin and the licence, and the kit's LICENSE is copied beside the port as `src/fx/nih-dairia/LICENSE`.

## Scope

In: the port, the surface frame, the content preset, the pinned assets, the lab tab, the tests. Out (a later spec): the boss
as an enemy — spawning, health, damage, telegraphs, sound, the gunship's and SOL's fire on its body, its attention between
the base and the tank, and its place in a sector. The three pieces are the port, the lab, and the boss; this spec is the
first two.

## 1. Files and ownership

| File | Layer | Owns |
| --- | --- | --- |
| `src/fx/nih-dairia/LICENSE` | — | the kit's GPL-3.0 text, verbatim |
| `src/fx/nih-dairia/constants.js` | fx | `PHYS` and `clamp`, verbatim |
| `src/fx/nih-dairia/soft-body-kernel.js` | fx | the embedded WebAssembly module (base64), compiled lazily on first `createSoftBodyKernel`, never at import; returns `null` without WebAssembly |
| `src/fx/nih-dairia/soft-body.js` | fx | `SoftBody`: the solver (kernel or `stepJS`), contacts, grab, sleep, `updateSurface` |
| `src/fx/nih-dairia/deform-surface.js` | fx | the CPU four-node embedding of the skin |
| `src/fx/nih-dairia/cage-model.js` | fx | `parseCage(buffer, manifest)`: typed-array slices to the cage, elements, edges, contacts, `limbCount`, and the skin's `BufferGeometry` |
| `src/fx/nih-dairia/fixed-step.js` | fx | `FixedStepper`: 240 Hz accumulation with the 50 ms clamp, reporting the steps taken |
| `src/fx/nih-dairia/motion-settings.js` | fx | `DEFAULT_MOTION`, `MOTION_CONTROLS` (fourteen, with ranges and hints), `normalizeMotion`, `formatMotion` |
| `src/fx/nih-dairia/variants.js` | fx | `CREATURE_VARIANTS` (the four plans); `selectedVariant` is not ported (it reads `location`) |
| `src/fx/nih-dairia/gait.js`, `pursuit.js`, `traction.js`, `limb-separation.js`, `cradle.js`, `feeding.js`, `behavior.js` | fx | `SpiderGait`, `TentaclePursuit`, `GroundTraction`, `LimbSeparation`, `PreyCradle`, `FeedingCycle`, `MonsterBehavior` (states listening, probing, stalking, enveloping, recoiling, cradling, covering, dropping, absorbing, recovering, spawning) |
| `src/fx/nih-dairia/skin.js` | fx | `tissueColors(positions, limbs)` |
| `src/fx/nih-dairia/prey.js` | fx | `PREY_SHAPES`, `preyGeometry`, `preyImprint`, `preyClearance`, `createPrey()` |
| `src/fx/nih-dairia/appearance.js` | fx | the skin's mesh: tissue colours, the physical material, the feeding imprint |
| `src/fx/nih-dairia/arena.js` | fx | `ARENA` (`lureHeight` is read by feeding; the radii are the kit's table) |
| `src/fx/nih-dairia/creature.js` | fx | `createNihDairia(motion, variant, { urls })` → `{ mesh, body, motion, settings, setTarget(v), update(dt), reset(), dispose() }`, the kit's `portable.ts` contract; `update` returns the fixed steps taken; `setTarget` returns false while feeding has the target locked |
| `src/content/nih-dairia.js` | content | `NIH_DAIRIA_MOTION` (the export's `motion-settings.json`, version 1, fourteen keys), `NIH_DAIRIA_VARIANT = 'nih-dairia'`, `NIH_DAIRIA_LOOK` (pale `#b8b99a`, dark `#374237`, transmission 0.65, thickness 0.012, ior 1.37, attenuation `#939b72` at 0.035, clearcoat 0.65/0.16, prey red `#c94d38`), `NIH_DAIRIA_SIZE_METRES = 30`, `NIH_DAIRIA_MODELS` mapping each variant to its `.bin` and `.json` under `assets/creatures/nih-dairia/` |
| `src/domain/surface-frame.js` | domain | pure: `frameAt(point, radius, yaw)`, `toLocal(frame, world, scale)`, `toWorld(frame, local, scale)`, `reanchor(frame, localCentre, radius, scale, limit)` |
| `src/labs/boss-tab.js` | labs | the lab tab, `initBossTab(root)` |
| `assets/creatures/nih-dairia/{nih-dairia,brood,reed,crown}.{bin,json}` | assets | the four models, pinned |
| `docs/nih-dairia-assets.lock.json` | docs | sha256 of the eight files; credit "lab-creatures (kai-denrei, derived from Jelly Baby by scottstts, GPL-3.0), export of 2026-10-08, model source hash nih-dairia-spider-v2 and its variants"; no upstream URL (the owner's own export) |
| `labs.html`, `src/main.js` | composition | `<div id="tab-boss" class="tab tab-hidden"></div>`; `boss: () => import('./labs/boss-tab.js').then(m => m.initBossTab)` |
| `scripts/assets.mjs` | scripts | the lock file added to the list it checks |
| `test/surface-frame.mjs`, `test/nih-dairia-port.mjs`, `test/nih-dairia-feeding.mjs`, `test/nih-dairia-variants.mjs`, `test/nih-dairia-content.mjs` | test | below |
| `scripts/browser-test.mjs` | scripts | the `--boss` smoke step |

The layer rules hold by construction: `src/domain/surface-frame.js` imports nothing; `src/content/nih-dairia.js`
imports nothing; `src/fx/nih-dairia/*` imports the vendored three and content; the lab imports fx, content, domain and the
labs' shared helpers, never the game controller. The game controller imports none of this in this spec.

## 2. Port rules

- Types stripped, nothing else changed: same file names, same identifiers, same numbers, same order of operations in every
  step. Each file's first line names the source: `// Ported from lab-creatures <file> (kai-denrei, f2a4f89, export of
  2026-10-08; derived from Jelly Baby by scottstts; GPL-3.0, see ./LICENSE), types stripped; the solver, the gait, the
  pursuit and the feeding are unchanged.` The kit's own comments are kept.
- `import ... from 'three/webgpu'` becomes `import ... from '../../../vendor/three.module.js'`. `three/tsl` imports go
  (below). Nothing else from three.
- **Two real rewrites, both presentation:** `appearance.js` and `prey.js` use TSL node materials in the kit
  (`MeshPhysicalNodeMaterial` with `colorNode`, `clearcoatNode`, a `positionWorld`/`smoothstep` imprint tint around the
  prey). In r160 WebGL they become `MeshPhysicalMaterial` with the same scalar values, and the two node expressions become
  CPU-updated attributes: the skin's imprint tint is written into the skin's `color` attribute each frame feeding is
  active (the 9,408 vertices near the prey only, `needsUpdate` once), and the prey's colour blend from red to tissue is
  `material.color.lerpColors(red, tissue, coverage)` with `clearcoat = 0.65 * coverage`, the prey keeping one material. The
  shape-specific imprint itself is physical (the body's forces) and needs nothing from the material. The plan's test for
  these two files is visual (the `--boss` step reads coverage reaching 1 during a meal) plus a node test that the colour
  arrays change where the prey is and nowhere else.
- `model.ts` folds into `creature.js`: the fetches take the URLs from content, resolved against `document.baseURI` so the
  Workshop page and the built site both find them (the build copies `assets/` unchanged; nothing under `assets/creatures`
  is quantised or packed).
- `auto-lure.ts` is ported as `auto-lure.js` after all (Task 3's review: the kit's own tests use it, and one port beats
  two copies); the lab uses it with the kit's `ARENA` radii in local metres.
- Not ported: `graphics/renderer.ts` (WebGPU), `scripts/*` (the models are shipped built; rebuilding needs the kit's toolchain and is
  not a project task), `main.ts`, `variants.selectedVariant` (reads `location`).
- The JS fallback (`stepJS`) stays and is tested; a browser without WebAssembly moves the creature slowly rather than not at all.
- The kit's invariants are kept as written: the host never moves the mesh transform independently of the body (the frame
  moves a parent `Group`, the mesh stays at the group's origin); `update(dt)` is the only entry (never `update` and
  `body.step` in one frame); a non-finite body throws, and the lab catches it, reports it on the readout and resets.
- The kit's node verification scripts (`verify-monster`, `verify-feeding`, `verify-variants`, `verify-probes`) are the
  source of the port's node tests: ported with the same assertions against the same models, imports pointed at the port.

## 3. The surface frame

The creature simulates in its own flat metres; a frame places it on the planet.

- `frameAt(point, radius, yaw, reference = null)`: `point` is a unit direction (the planet's centre is the origin, as in
  the story planet, where a surface point is `direction * (radius + altitude)` and the scene is shifted so the pole sits at
  y = 0). Returns `{ origin: [x, y, z] (direction * radius), up: direction, east, north, yaw }` with `east`/`north` the
  tangent basis rotated by `yaw` about `up`, **right-handed** (`east x up = north`, so `makeBasis(east, up, north)` is a
  rotation, never a reflection). `reference`, when given, is a world tangent the new `east` is projected from, so a frame
  made from an old frame's `east` keeps its heading continuously (Task 1's review, 2026-10-08: the helper axis alone flips
  the heading by 180 degrees across one latitude band).
- `toWorld(frame, local, scale)`: `origin + (local.x * east + local.y * up + local.z * north) * scale`. The creature's local
  floor plane (y = `PHYS.floor`) lands on the surface at the origin and departs from it by the sphere's sagitta further out:
  `d^2 / (2 * radius)`, 15 cm at 15 m on a 750 m planet, under the scaled step height of 5.4 m (32 mm x 170). The lab's
  readout prints the sagitta at the creature's farthest foot so the number is on screen, not assumed.
- `toLocal(frame, world, scale)`: the inverse, the lure's mapping. The tank's world position comes in; its local y is
  clamped to the kit's lure height (`ARENA.lureHeight`, 0.012 m) so the pursuit and the feeding aim at the floor, as the
  kit's arena does.
- `reanchor(frame, localCentre, radius, scale, limit)`: when `hypot(localCentre.x, localCentre.z) * scale > limit`
  (two cells, 20 m), returns `{ frame: frameAt(normalise(toWorld(frame, [centre.x, 0, centre.z], scale)), radius, 0,
  frame.east)` with the old `yaw` kept on the record, `shift: [-centre.x, 0, -centre.z] }`; otherwise the same frame and
  a zero shift. The old `east` as the reference transports the heading along the surface (parallel transport: a few
  degrees over 20 m at radius 750, never a flip). The creature applies the shift to
  `body.x` and `body.previous` (and the kernel's views, which are the same memory), to `motion.target`, to the feeding
  cycle's prey and captured positions, to the cradle's anchor and to the traction anchors, inside one fixed step between
  `motion.step` and `body.step`, so velocities are untouched and the solver never sees a jump. Re-anchoring is refused
  while feeding is locked (the prey must not move). The yaw is kept, so the creature's heading does not snap.
- The tank drives in the same local plane (the swarm lab's `stepYardDrive` in metres, no boxes) and is placed through the
  same frame at scale 1, so both actors sit on the curve correctly and the lure mapping is exact.

## 4. The lab (`src/labs/boss-tab.js`)

- **Scene.** The story planet built as the story tab builds it (`buildStoryPlanet(STORY_RECIPE, STORY_CLEARING,
  planetBake())`, `buildStoryPlanetMesh(planet, look)`), with the frame's anchor at the clearing's centre and the planet's
  draw restricted to the cap within 40 cells of the anchor (the plan decides between a draw range and a cropped copy of the
  mesh, whichever `story-planet-mesh` supports without a change) so the readout prices the creature, not the planet. The
  game's hemisphere and sun from the story tab's look, the labs' `OrbitControls`, the camera framed on the creature at game
  distances (the chase camera's height and lead, 11 m up and 26 m back, as the swarm lab frames the tank).
- **Actors.** The creature at `NIH_DAIRIA_SIZE_METRES`, placed by the frame, pursuing the lure. The tank: the game's hull
  model (`buildUnit('mork')` as the swarm lab does) at its real size, driven with WASD through `stepYardDrive`, placed
  through the frame. The prey mesh is the tank when the lure is the tank (the kit's red prey mesh is not shown then; the
  feeding cycle's `preyPosition`, `scale` and `visible` drive the tank's visibility and a `TAKEN` callout), and the kit's
  prey mesh when the lure is a point or the auto-lure.
- **Lure selector:** `tank` (default), `point` (click on the surface moves it), `auto` (the figure-eight re-created from
  the kit's `AutoLure` against the scaled arena). The tank counts as held (`motion.targetHeld`) while its throttle or
  steering is non-zero, so a driving tank cannot be taken and a stopped tank within reach is: the mode idea's rule. After
  a meal the tank respawns at the frame's origin plus 30 m and the `taken` count rises on the readout.
- **Variant selector:** the four body plans; switching disposes and recreates the creature with the current settings.
- **Knobs** (lil-gui, the labs' panel style): the fourteen motion settings from `MOTION_CONTROLS` with their ranges, bound
  to `creature.settings` (live, as the kit allows), `size` in metres (re-places the creature; the physics is untouched),
  `gravity` and `iterations` (bound to the creature's `PHYS` copy), `feeding` on/off (`motion.feeding.enabled`),
  `instinct` on/off (`motion.active`), buttons `disturb`, `reset`, `re-anchor now`, and the state readout (`listening` ...
  `spawning`).
- **Readout** (a monospace line as the swarm lab's): `solver <ms> (<steps> steps) · skin <ms> · render <ms> · centre
  <m/s> · reach <m> · sag <m> · taken <n>`. Solver and skin are `performance.now()` around `creature.update(dt)` split by
  the stepper's callback and `body.updateSurface`; render is measured the swarm lab's way (`gl.finish()` in a tight loop,
  so it reads the work, not the vsync). The steps count turns red when the 50 ms clamp cut steps (12 is the cap). A rolling
  60-frame mean. `reach` is the distance from the creature's centre to the farther probing arm's tip, scaled.
- **Export.** `copy settings` writes `{ version: 1, variant, motion: {...fourteen}, sizeMetres }` to the clipboard, the
  content preset's shape, for pasting into `src/content/nih-dairia.js`. No new preset format; no file writer.
- **Failure.** A thrown non-finite body is caught per frame: the readout prints the message, the creature resets, the
  frame continues. A missing or mismatched asset prints the fetch error in the tab and stops.

## 5. Assets, build and checks

- The eight model files copy into `assets/creatures/nih-dairia/`; `docs/nih-dairia-assets.lock.json` pins their sha256
  and `scripts/assets.mjs` lists it, so `npm run assets:check` (and so `npm run check`) fails if any byte changes.
- The build copies `assets/` unchanged; nothing to pack. The kernel's base64 travels inside its module.
- `npm run architecture` sees the layer modules and one lab; no new top-level module; the domain module imports nothing;
  the lab never imports `td-tab.js`. The controller's ceiling is untouched (no line added to td-tab).
- No console logging of anything but the kit's existing one-line kernel-unavailable warning.

## 6. Tests

- `test/surface-frame.mjs`: on a sphere of radius 750, a frame at a random direction maps a local point to a world point
  whose distance from the origin along the surface equals `hypot(x, z) * scale` within 1e-6 relative, and `toLocal` of
  that returns the local point within 1e-9; `reanchor` with a centre 25 m out returns a frame whose origin is the
  surface point under the centre and a shift that brings the centre to [0, y, 0]; below 20 m it returns the same frame
  and a zero shift; yaw is preserved.
- `test/nih-dairia-port.mjs`: the kit's `verify-monster.mjs` and `verify-probes.mjs` ported (imports to the port, the
  model read from `assets/creatures/nih-dairia/`), plus: 200 fixed steps from rest with the kernel and with the JS
  fallback (`body.kernel = null`) agree on the centre within 1 mm, and `volumeRatio()` stays within 1.05 of 1.
- `test/nih-dairia-feeding.mjs`: the kit's `verify-feeding.mjs` ported (alignment before descent, torso ground contact,
  stationary prey, the imprint's rise and resolution, distant respawn, reset, repeated automatic meals).
- `test/nih-dairia-variants.mjs`: the kit's `verify-variants.mjs` ported (the four plans: feet and arm counts, valid
  tetrahedra, a supported stance, forward progress toward a target).
- `test/nih-dairia-content.mjs`: `normalizeMotion(NIH_DAIRIA_MOTION)` deep-equals the export's `motion-settings.json`
  values; `NIH_DAIRIA_SIZE_METRES` is a positive finite number; every variant in `NIH_DAIRIA_MODELS` has both files on disk
  and in the lock.
- Browser: `--boss` in `scripts/browser-test.mjs` opens `labs.html#boss`, waits for the readout to show a solver time and
  at least one fixed step, checks the creature's mesh has a bounding-sphere radius in world units above 10 m, drives the
  tank for two seconds and checks the state left `listening`, then stops the tank beside the creature with feeding on and
  waits for `taken` to reach 1. Runs through `scripts/browser-lock.sh` like every suite.

## Open questions for the boss spec (not this one)

What the body is to a shell, a round, a laser and the tank's ram (the kit has `grab` and `nudge`, no damage); the
creature's attention between the base and the tank; whether it walks the cell graph or the free surface; how its size
interacts with gates and walls (no collision in the kit beyond the floor and its own limbs); the cost on a phone (the
lab's readout on the owner's device decides); the look under the game's post-processing; the licence decision above.

## Records

Spec recorded as `2026-10-08-nih-dairia-boss-lab-design` (decision, proposed) when the plan starts; the lab's landing as a
change entry; the licence question as an open issue. Separate notes: `2026-10-08-mesh2motion-as-a-boss-animation-source`
(experiment, proposed) marks https://app.mesh2motion.org/ as a source to explore for boss animation, unrelated to this lab;
`2026-10-08-boss-mode-idea-draw-it-off-the-base` holds the mode idea.
