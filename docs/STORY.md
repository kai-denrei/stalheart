# Story planet and arrival

Open `labs.html#story`. The lab generates the story planet on load: the pinned grid kernel at 16,000 points (71,314 cells), radius 753 m at 10 m per cell, with the defense map's lane density. Generation takes about four seconds on the Mac Mini; the HUD reports the time.

The clearing is at the north pole, 150 m in radius. Every cell inside is open floor. The lane mouths on its rim are found as runs of open cells just outside the radius; one mouth of at most two cells stays open, the rest are sealed to rock. The base frame is rotated so the open mouth lies on the frame's -Z axis, where the armored gate will seat.

Terraces are concentric 2 m bands cut and filled around a 46 m pad plane, faded back to the sphere over 20 m past the clearing. Band boundaries render as one-cell slopes for now; retaining edges, ramps and piers are kit work. The pad shows 16 x 16 instanced Fortification tiles.

**Arrival.** L lands the SH02 from a 4 s orbit shot through an 8 s descent with the engine plume, legs deploying at 40 m, the authored shock at touchdown with dust and scorch, a 2 s settle, the top door and Isao rising from the cargo well. K skips to the landed state, R resets the camera. Drag to orbit and wheel to zoom at any time; touching the camera leaves the rail. The timeline is `src/domain/landing-sequence.js` and is Node-tested; the clips are played as authored and never blended.

Ownership: `src/content/story-defaults.js` (recipe and tunables), `src/core/terrace-profile.js`, `src/domain/story-planet.js`, `src/domain/landing-sequence.js`, `src/fx/launch-plume.js`, `src/labs/story-planet-mesh.js`, `src/labs/story-landing.js`, `src/labs/story-tab.js`. No module imports the game controller. The SH02 is pinned in `docs/sh-rocket-assets.lock.json`; credits in ATTRIBUTIONS.md.

Validation: `test/terrace-profile.mjs`, `test/story-planet.mjs`, `test/landing-sequence.mjs`; `node scripts/browser-test.mjs --story` drives the real page through rest, descent, touchdown, live play and skip with screenshots.

Not yet: sound, chunked rendering for phones, the raymarch governor, the opening encounter (first prints, manual Rotor, weak enemies, the armored gate), base construction and emergence. Design: `docs/superpowers/specs/2026-09-11-story-planet-arrival-design.md`.
