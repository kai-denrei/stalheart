# Sphere to flat: the cost map

Date: 2026-09-14. Status: read-only evaluation, nothing changed. Branch `heavy-gunship` at `1f582fb`.

The question (owner): what does it cost and gain to leave the spherical planet for a plain playing field, **while keeping the Stålberg organic quad grid**? This refines the proposed `2026-09-14-flat-world-direction` entry, which spoke of leaving the Stålberg grid too.

## The answer in one paragraph

Much less than the size of the game suggests. The grid generator is a port of a flat 2D generator, the dungeon graph is fully generic, story placement is already authored in flat metres behind one projection function, sinkholes and missiles already run flat underneath a thin sphere layer, and the sky, lighting, far tiers and cell index do not care about curvature. The real work concentrates in four places: a **bounded** planar version of the grid kernel (a sphere has no edge), the **story planet seam** (clearing, lane mouths and terraces measured from the pole), **`src/td-tab.js`'s radial "up"** (190 `norm3` calls to triage, not regex), and **two cameras that are spherical by design** (the free orbit camera and the whole-planet establishing shots), which need new design, not porting. Nothing found is a blocker. The largest risk is the camera language, not the code.

## Measured

| Measure | Value |
| --- | --- |
| `norm3(` calls | 190 in `src/td-tab.js`; 207 across 9 files in `src/` |
| `graph.normals[` lookups in td-tab | 29 (data-driven: free if the grid emits a constant up) |
| `setFromUnitVectors` radial orientation in td-tab | 11 (collapse toward identity) |
| `1 + params.wallHeight` radius-1 wall tops in td-tab | 25 |
| Sphere-specific modules | `grid.js` 377, `sample.js` 107, `hull.js` 36, `arc.js` 124, `story-planet.js` 106, `sphere-missile-flight.js` 30, `beamdraw.js` 279 lines |
| Tests mentioning sphere/planet | 24 of 102 files; about 3 deleted, 6-8 rewritten, 90+ unchanged |
| Baked planet | `assets/story/planet.bin` 1.1 MB of a 24 MB release |

## Cost by area

Class: **sphere-only** (rewrite), **parameterised** (feed a constant up or radius 0), **generic** (unchanged). Effort S / M / L.

### Grid and world model

| Component | Where | Class | Flat needs | Effort |
| --- | --- | --- | --- | --- |
| Point sampling | `src/sample.js` | sphere-only | uniform sampling in a bounded region | S |
| Delaunay | `src/hull.js` (Delaunay as a 3D convex hull) | sphere-only | a bounded 2D Delaunay; the sliver filter the sphere port dropped comes back (`grid.js:8-10`) | M |
| Tri to quad merge | `src/grid.js:86-151` | generic | none (boundary edges never enter the pool) | S |
| Subdivide, winding, relax | `grid.js:156-312` | parameterised | `onSphere` becomes identity; normal becomes `[0,1,0]`; drop the reprojection; decide how border vertices relax | S |
| Dungeon carve, BFS, heart and spawn | `src/dungeon.js` | generic | none | none |
| Cell index | `src/cellindex.js` | parameterised | a 2D hash (simpler) | S |
| Planet bake format | `src/core/planet-bake.js` | generic container | new contents, same format; rebake | S |
| Story planet seam (clearing, mouths, terraces, frame map) | `src/domain/story-planet.js`, `src/core/terrace-profile.js` | sphere-only | planar radial distance, identity frame map; terraces become plain cut/fill | M |
| Base placement | `src/content/base-layout.js`, `src/domain/base-plan.js`, `src/fx/story-base.js` | parameterised (authored in flat metres) | a flat `placer`; content unchanged | S |

A flat reference generator already exists outside the repo (`~/Dev/oskar-procedure`, cited at `grid.js:2`).

### Game controller, cameras, rendering

| Component | Where | Class | Flat needs | Effort |
| --- | --- | --- | --- | --- |
| Radial up from position | `src/td-tab.js` (190 `norm3`), `src/radar.js`, `src/sentry-pilot.js` (its own `.normalize()` copies) | sphere-only, scattered | constant up; triage per site (movement, aim, FX and camera look alike but differ) | L |
| Free orbit build camera (arcball around the origin) | `td-tab.js` ~2350-2420, 2683-2697 | sphere-only by design | new camera language: pan/zoom/tilt around a focus point | L (design) |
| Whole-planet establishing shots (`planetView`, rocket sites, breach-opening zoom) | `td-tab.js:10341`, `domain/story-beats.js:77` | sphere-only by design | new reveal staging | M (design) |
| Chase, PoV, bastion, strike-fall, drone-ride, deploy cameras | `td-tab.js` 2546-2737, 6500-6513 | parameterised (tangent frame from a normal) | constant up; nearly free | S |
| Radar and minimap | `src/radar.js:20-25` | parameterised API | one-line: constant normal | S |
| Gunship HUD lat/lon readout | `src/fx/gunship-hud.js:59-61` | sphere-only, cosmetic | grid or metre coordinates | S |
| Far tiers, sky bake, sun/fill, day cycle | `src/fx/story-base.js`, `src/galaxybake.js`, `src/fx/daylight.js` | generic | none | none |
| Horizon | none today (the sphere curves away for free) | new work | fog, far plane or a bounded map | M |

### Units, weapons, effects

| Component | Where | Class | Flat needs | Effort |
| --- | --- | --- | --- | --- |
| Enemy stepping, tank drive, shells, tower and piloted rounds | `td-tab.js` (updateEnemies, drive, `straightTo`) | incidental reprojection | drop `norm3` snap-back in about six paths; miss one and it silently re-centres | S |
| Isao's flight | `td-tab.js` `stepDir` (great-circle slerp), `isaoRadius` | sphere-essential | planar turn-toward | S |
| A6 walkers | `src/domain/heptapod.js:57-93` `arc()` | mixed | Euclidean distance | S |
| Missiles | `src/domain/sphere-missile-flight.js` over `src/core/a6-missile-flight.js` | flat-native core | delete the log/exp wrapper | S |
| Gunship aim and pass | `src/domain/gunship.js` `aimOnSphere`; `fx/gunship-optic.js ride()` | mostly generic | ray-plane aim; the "orbit" is a pass timer and the track is already straight | S |
| Orbital strike, drive ramp, hull contact, yard drive | `strike.js`, `domain/drive-ramp.js`, `domain/hull-contact.js`, `domain/yard-drive.js` | generic | none | none |
| Beams and plasma | `src/beamdraw.js`, `src/arc.js` | sphere-essential | one straight ribbon; `arc.js` deletable; retune wall bite and hit sampling | M |
| Explosions | `fx/explosions.js`, `fx/explosions/common.js` BEND_GLSL | sphere shader, parameterised | `planetRadius` 0; drop the bend | S |
| Sinkholes, breaches, rubble | `sinkhole.js`, `core/breach-surface.js`, `game-breaches.js`, `breach-rubble.js` | already flat when radius is 0 (the breach lab's Flat reference) | flip environment; drop one `.normalize()` in rubble | S |

### Content, labs, tests, docs

| Area | Class | Flat needs | Effort |
| --- | --- | --- | --- |
| Pinned kernel (`docs/kernel-provenance.json`) | sphere port | a flat sibling pinned beside it; the sphere kernel archived for the spin-off | S |
| Bake pipeline (`scripts/bake-planet.mjs`, `planet.bin`, `STORY_SANITY`) | sphere-only | rebake for a flat recipe or drop | M |
| Labs | Sentry/Impact already flat; Breach parameterised; Story and Beam sphere-only; Sim, Units, Metal, Audio agnostic | rewrite the beam lab's arc ruler; the story lab's staging | M |
| Tests | 24 of 102 mention it | delete ~3 (`planet-bake`, `terrace-profile`, `sphere-missile-flight`), rewrite ~6-8 (`story-planet`, `arc`, `base-plan`, `world-recipe`, rubble's "rests on the planet", beam ruler), keep 90+ | M |
| Fiction | the 2026-09-11 rejection cited shell fiction, pole heart, antipode relay, arc distances | the antipode relay is gone (cleanup); the antipode server-room brief survives only in a queue probe; "the Stålheart at the north pole" is one lore line (`src/lore.js:54-55`) | S |

## What comes for free

- The dungeon graph, BFS fields, room carve and spawn/heart logic (`src/dungeon.js`).
- Base layout content and story beats (already flat metres).
- Missile flight maths, sinkhole and breach shapes (already flat at radius 0).
- The strike ritual, drive ramp, hull contact, yard drive, tower targeting (injected distance).
- Sky, lighting, day cycle, far-tier LOD, cell index.
- Most cameras (chase, PoV, bastion, strike fall, drone, deploy) once up is constant.
- About 90 of 102 test programs.

## What flat gains beyond simplicity

- No reprojection per body per frame, no radial orientation per object, no bend shaders, straight beams (fewer draw calls).
- No planet bake step on world changes (about 5-9 s each today).
- Ballistics, aim and distance become the textbook versions; tuning reads in metres directly.
- The FunMap verdict: "The sphere is interesting. It is not yet fun." It pays only in orbit, breach and gunship-pass moments; elsewhere it costs without an emotional return (`docs/FUNMAP.md:15-17`).

## What flat loses

- The whole-planet establishing shots and the "planet at arm's length" build camera: the most identity-defining camera in the game today.
- A free horizon: far things currently curve out of sight; a plane needs fog, a far plane or a bounded map.
- The story's pole framing (the clearing at the pole, the lore line) and the sphere as a setting for a possible spin-off (kept by archiving the kernel).

## Why the 2026-09-11 rejection no longer holds as written

`2026-09-11-story-planet-arrival` rejected flat terrain because it "retires the shell fiction, pole heart, antipode relay and sphere-arc distances". Since then the antipode relay and the server missions were removed (`2026-09-14-poc-remnants-removed`), the pole heart is a lore line, and the sphere-arc distances are exactly the cost this map sizes. The remaining argument for the sphere is the camera and the setting, which is an owner judgement, not a technical constraint.

## Suggested order, if the owner goes ahead

1. **Decide the shape and the camera** (questions below). Everything else follows from these two.
2. **Flat kernel beside the sphere kernel:** bounded planar sampling, Delaunay, merge, subdivide, relax; same output shape as `generateSphereMesh`; Node-tested; the sphere kernel stays pinned for a spin-off.
3. **One up/frame seam:** route radial up through a single helper (`upAt(pos)`) first, still on the sphere, so the 190 sites are triaged once with the sphere as the test oracle; then flip it.
4. **Story planet seam:** planar clearing, mouths and base placement through a flat `placer`; rebake or drop the bake.
5. **Effects and weapons:** radius 0 for sinkholes and explosions, delete the sphere missile wrapper, straighten beams, planar Isao and walkers.
6. **Cameras:** the new build camera and establishing shots, with fog or bounds for the horizon.
7. **Tests and labs:** rewrite the 6-8, delete the 3, the beam and story labs.

Steps 2 and 3 can be done without changing what the player sees, which keeps the game playable while the risky part (cameras, step 6) is designed.

## Open questions for the owner

1. **Map shape and edges:** rectangle, hex, or an island silhouette? What is at the edge: a wall, a drop into void, fog?
2. **Map size:** target metres per side and cell count, replacing the 753 m, 16,000-point, 71,314-cell recipe.
3. **The build camera:** RTS-style pan/zoom/tilt, an isometric strategic view, or something else?
4. **Establishing shots:** what replaces the whole-planet reveal (the rocket sites, the breach opening zoom)?
5. **Terrain:** a true constant up everywhere, or local tilt (hills, terraces) that keeps a per-cell normal?
6. **The story's pole:** does the clearing stay a round clearing at the map centre?
7. **The gunship pass:** a straight flight line over the field (the track already is), or something new?
8. **Beams:** fully straight, or keep a curved flourish?
9. **Sinkholes:** keep a local bowl curvature on a flat field, or flat cuts?
10. **Migration shape:** a flat path beside the sphere behind one toggle first (safer, a spin-off keeps the sphere), or a straight replacement?

## Sources

Four read-only explorer sweeps (grid and world; controller and rendering; units and effects; content, labs, tests and docs) plus direct counts on `1f582fb`. File and line references are to that commit.
