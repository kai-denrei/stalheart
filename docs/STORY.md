# Story planet and arrival

Open `labs.html#story`. The lab generates the story planet on load: the pinned grid kernel at 16,000 points (71,314 cells), radius 753 m at 10 m per cell, with the defense map's lane density. Generation takes about four seconds on the Mac Mini; the HUD reports the time.

The clearing is at the north pole, 150 m in radius. Every cell inside is open floor. The lane mouths on its rim are found as runs of open cells just outside the radius; one mouth of at most two cells stays open, the rest are sealed to rock. The base frame is rotated so the open mouth lies on the frame's -Z axis, where the armored gate will seat.

Terraces are concentric 2 m bands cut and filled around a 46 m pad plane, faded back to the sphere over 20 m past the clearing. Band boundaries render as one-cell slopes for now; retaining edges, ramps and piers are kit work. The pad shows 16 x 16 instanced Fortification tiles.

**Arrival.** L lands the SH02 from a 4 s orbit shot through an 8 s descent with the engine plume, legs deploying at 40 m, the authored shock at touchdown with dust and scorch, a 2 s settle, the top door and Isao rising from the cargo well. K skips to the landed state, R resets the camera. Drag to orbit and wheel to zoom at any time; touching the camera leaves the rail. The timeline is `src/domain/landing-sequence.js` and is Node-tested; the clips are played as authored and never blended.

Ownership: `src/content/story-defaults.js` (recipe and tunables), `src/core/terrace-profile.js`, `src/domain/story-planet.js`, `src/domain/landing-sequence.js`, `src/fx/launch-plume.js`, `src/labs/story-planet-mesh.js`, `src/labs/story-landing.js`, `src/labs/story-tab.js`. No module imports the game controller. The SH02 is pinned in `docs/sh-rocket-assets.lock.json`; credits in ATTRIBUTIONS.md.

Validation: `test/terrace-profile.mjs`, `test/story-planet.mjs`, `test/landing-sequence.mjs`; `node scripts/browser-test.mjs --story` drives the real page through rest, descent, touchdown, live play and skip with screenshots.

**Stages.** Digits 0 to 7 or the stage buttons show the base as it grows: 0 empty pole, 1 landing, 2 the landing island, 3 solar island and one Rotor, 4 the armored gate on the open mouth with six wall segments each side, 5 the HUGIN tower and catcher (booster hidden), 6 the Stalheart at the pole, 7 the assembly line. `src/content/base-layout.js` holds the plots and stages; `src/domain/base-plan.js` turns them into placements, tested for overlap, monotonic stages, the gate on the mouth and corner sag under the slab's 1.2 m skirt. Every island and structure is tangent to the sphere at its own centre. `src/fx/story-base.js` draws the plan for both the lab and the game: one instanced slab per island with the 4 m grid drawn in the shader, instanced walls, the gate, and the landmark models with their authored cycles. O frames an overview.

**Play here.** P, or the button, opens the actual game on this planet: `index.html?world=story&threat=0.35&cine=0&heart=cloud&stage=N#td`, with the lab's current stage, so the game shows the space as it is: at stage 1 only the rocket stands on natural ground. `heart=cloud` keeps the game's own gantry Stalheart off the pole; the story base places the Terraformer 3000 there at stage 6. `world=story` routes the controller's map through `src/domain/world-recipe.js`, which returns the story planet with the heart at the pole cell and 4 m walls; `threat` multiplies wave size (0.1 to 4). The default world is unchanged. The game's own sector reveal, gate placement and camp still apply; islands, the story build stages and the encounter beats are not in the game yet.

**Kit.** Base pieces come from the upstream base kit: the game-ready base kit (walls D0-D3, corner, vehicle gate, 4 m tile) and the 28-triangle scalable island slab are pinned in `docs/base-kit-assets.lock.json` under `assets/models/kit/`.

**Sound.** The owner-provided rocket thrust sample loops under the descent, scaled by plume intensity, and cuts at touchdown. The tank's spool-up plays for leg deployment and the door, spool-down for the landing. Cues are pinned in `docs/rocket-audio.lock.json`. Six plume quads hang under the skirt, each breathing on its own cadence.

Not yet: chunked rendering for phones, the raymarch governor, the opening encounter (first prints, manual Rotor, weak enemies, the armored gate), base construction and emergence. Design: `docs/superpowers/specs/2026-09-11-story-planet-arrival-design.md`.
