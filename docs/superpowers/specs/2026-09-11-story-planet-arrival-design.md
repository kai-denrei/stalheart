# Story planet and arrival — design

Owner decisions taken in the 2026-09-11 planning session. This spec covers sub-projects 1 and 2 of the story opening: the planet with its clearing, and the SH02 arrival. The opening encounter (Isao's first prints, the manual Rotor, weak enemies, the armored gate and the pile-up), base construction and emergence follow as separate specs.

## Decisions

| Question | Decision |
| --- | --- |
| Where the story base lives | A new, larger sphere on the same pinned grid kernel. One world type; the defense game's lane width is kept. |
| Terrain | Medium planet with terraces. 16,000 generator points, 71,314 cells, radius 753 m at 10 m per cell. The base steps down the curvature on 2 m terraces. |
| Full base size | The Astro yard extent, about 240 x 160 m. Eight terrace levels, 14 m from crest to corner. |
| Player role in the opening | Isao prints the basics including a Rotor; the player aims it by hand against weak enemies; an armored gate closes the natural entry; the weak enemies pile up outside and the player clears them from the turret. |
| The rocket | The standalone SH02 (`assets/sh-rocket/sh_rocket.glb` upstream) with its five authored clips. The Hugin launch complex stays a later landmark. |
| The plume | The MIT launch plume shader from pulkitxm/claude-directory (via onkochishin), ported to a small camera-facing quad under the bells. |
| Fiction | The Hugin brings Isao and the terraformer to a new natural world. Stålheart is the machine. The codex and arrival brief are updated in the encounter sub-project. |

Gerald noted the current Sentry Control and Sniper feel is not yet satisfactory. The encounter sub-project depends on fixing that; this spec does not.

## Planet recipe

`src/content/story-defaults.js` pins the recipe: seed 7, 16,000 points, k 12, relax 80 iterations at pull rate 0.25, dungeon rooms 384, room radius 4, extra corridors 192, corridor width 1, wall height 4 m, 10 m per cell. A Node test asserts the sanity record: 71,314 cells and the pinned heart cell and cell size. The kernel algorithms are not modified.

The clearing is at the north pole (unit-sphere +Y), radius 150 m. Every cell whose centre lies inside becomes open floor. The lane mouths on the clearing rim are found as connected runs of open cells in the band just outside the radius. One mouth of one or two cells is kept open; every other mouth is sealed to rock. The base frame is rotated about the pole so the open mouth lies on the frame's -Z axis, where the armored gate will seat square-on.

## Base frame and terraces

The base frame is the tangent plane at the pole: x and z are arc metres from the pole, y is height above the plane. `breachPoint` in `src/core/breach-surface.js` maps frame coordinates to the sphere. The natural surface at arc distance d sits at `-drop(d)`, `drop = R - sqrt(R² - d²)`.

Terraces are concentric bands. `src/core/terrace-profile.js` defines `terraceFloor(d)`: inside the pad radius (46 m) the floor is one plane at `-padDrop / 2`; beyond it, band k covers drops in `[padDrop + k·step, padDrop + (k+1)·step)` at floor `-(padDrop + (k + 0.5)·step)` with step 2 m. Cut and fill never exceed one metre inside a band. Beyond the clearing radius the surface blends back to the sphere over 20 m. Each lattice vertex inside the clearing is moved radially by `drop + floor`. In this version a band boundary renders as a one-cell slope; retaining-edge, ramp and pier pieces are kit work for the construction sub-project.

Foundations are 4 m Fortification tiles (already pinned) instanced on the pad plane on a 4 m lattice centred on the pole; the lab shows the 64 x 64 m pad tiled.

## Arrival sequence

`src/domain/landing-sequence.js` is a pure timeline over one clock:

| Beat | Start | Length |
| --- | --- | --- |
| Orbit | 0 s | 4 s |
| Descent | 4 s | 8 s, altitude eases from 300 m to 0; plume burns |
| Legs deploy | when altitude reaches 40 m | 2.4 s, finishes before touchdown |
| Touchdown | 12 s | shock clip 2 s, plume cut, dust burst, scorch |
| Settle | 14 s | 2 s |
| Door | 16 s | 1.8 s |
| Isao out | 17.8 s | 3 s rise from the cargo well |

`stateAt(t)` returns altitude, plume intensity, clip times for each clip, and Isao's height. `skip()` equals `stateAt(end)`: rocket deployed and compressed, door open, Isao out. Tests assert the deploy-before-touchdown rule, that no clip runs before its start, and that skip matches the end state.

The rocket root sits at the touchdown point on the pad plane; a parent node supplies descent altitude. Clips play once and hold their last frame; Legs_Deploy and Landing_Shock never blend. MARKINGS stays visible. Isao is the existing fabricator drone fitted to 2.5 m so it clears the 3.6 m cargo well. Dust uses the sinkhole particle system, scorch the impact scorch decal. Sound is deferred to the encounter sub-project; placeholders are the tank thruster bed and spool-down.

## Assets and attribution

`docs/sh-rocket-assets.lock.json` pins `sh_rocket.glb` (1,587,456 bytes, sha256 `9c777de6f9f766539915fa1132bbc72e0a5383aae369b7e5f416545c74ce3c33`) at upstream `d39f3a78e` to `assets/models/story/sh_rocket.glb`. `scripts/assets.mjs` verifies it. ATTRIBUTIONS.md credits jelaludo for the model and pulkitxm/claude-directory (MIT) for the plume GLSL.

## Modules and ownership

| Layer | Module | Owns |
| --- | --- | --- |
| Content | `src/content/story-defaults.js` | recipe, clearing, terrace and landing tunables |
| Core | `src/core/terrace-profile.js` | drop and terrace floor math |
| Domain | `src/domain/story-planet.js` | planet build, clearing, mouths, frame yaw, vertex altitude |
| Domain | `src/domain/landing-sequence.js` | arrival timeline |
| Presentation | `src/fx/launch-plume.js` | plume material |
| Labs | `src/labs/story-planet-mesh.js`, `src/labs/story-landing.js`, `src/labs/story-tab.js` | lattice geometry, rocket/Isao/effects, the `#story` lab controller |

No module imports the game controller. The lab exposes `window.__stalheartStoryTest` under `?acceptance=1` and `scripts/browser-test.mjs --story` drives it. The story mode controller for gameplay is not part of this spec.

## Out of scope

Enemies, Isao's orders, the armored gate, the kit connection graph, audio samples, chunked planet rendering, the raymarch governor, and the FX package schema revision.

## Amendments (2026-09-11, owner)

- The SH02 lands on natural ground at the pole. No foundations exist at landing; Isao prints them later.
- Foundations go only under key structures, as islands sized to each structure's plot, not across the whole base. The owner will author a simpler game-ready foundation tile to replace the 2,200-triangle Fortification tile.
- The rocket is scaled up (about 1.5x) and Isao down (about 1.8 m) for scale. Isao waits inside the cargo well when the door opens and rises slowly, instead of appearing above the rim.
- Build stages: landing, foundations, solar with one Rotor, gate and walls, HUGIN arm, Stalheart, then assembly line and radar. The HUGIN arm before the Stalheart is a proposal, not yet decided.
