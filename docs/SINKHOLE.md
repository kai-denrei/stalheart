# Sinkhole effect study

Open `labs.html?genre=sinkhole#portal`, or choose **Sinkhole** under **genre** in the Portal Lab. Press **rumble → breach** after textures load. Orbit to inspect the opening; **reset ground** clears the event. Controls adjust rumble lead-in, crater radius, plate heave, fissure opening and debris count. **Quake sound** plays the owner-provided quake/break clip from the start of the pre-roll; disabling it, resetting or leaving this genre stops playback. Re-trigger after radius changes to rebuild the complete event at the new size.

The genre is separate from Corona/Wormhole portal effects. It is a preview-only study: gameplay enemies still use their existing spawn portals. Sinkhole controls are not yet part of the canonical FX schema, so the old portal copy/export buttons are disabled in this genre. There is no alternate preset format or implicit game promotion.

## Import and host boundary

`docs/sinkhole-assets.lock.json` pins source revision `364c9ce70ba784809291e87981ca83a19560f73d`, original checksums and adapted local checksums. `npm run assets:check` validates the transferred code and four stone textures. The source import guide was used without changing its repository. License and attribution are retained.

`src/fx/sinkhole/` contains the selected Monolith Rift implementation: crater plate, fissure network, stone shading, debris/particle engine, light pool, decals and camera shake. All Three imports use Stalheart's sole vendored r160. The source's r185 shader patches compile against this version in browser acceptance. Kinetic warp is omitted because this host has no distortion pass; monolith count and blast share are forced to zero, including the source's minimum-count clamp.

`src/sinkhole.js` supplies an owned scene group and context, patches the shadow-registration hook, advances shared frame uniforms, updates the ability and calls `ParticleEngine.flush()` each frame. Camera layers 0/1 render the effect, with ground at y=0. A 0.1 m casterless path arrives at the impact point immediately after the rumble pre-roll.

The original effect heaves a plate over an intact floor. The host now uses one irregular boundary from `src/core/sinkhole-shape.js` for the floor cut, fissure clipping and textured bowl in `src/sinkhole-terrain.js`. The bowl descends continuously into an irregular black throat, with a gentler approach facing the default camera and steeper side walls. Broken stones dress the rim. The source plate drops out during the opening, and dust emission decays so the shape is visible after settling. Debris collides with the actual bowl height instead of an invisible flat floor; fissures remain outside the rim. There is no second floor hiding the negative-heave geometry. The surface adapter wraps positions and normals onto a planet, with the same irregular floor cut in both flat and curved modes. It uses the pinned organic grid kernel at preview density; game integration still needs its actual cell-wall and ground-cut contract.

The audio uses the shared mixer with a preview-only cue in `src/content/breach-defaults.js`; `docs/breach-audio.lock.json` pins the unchanged 6.984-second MP3 and its original supplied filename. It does not add a cue to the full FX schema yet.

Reset clears particles, lights, decals, crater/fissures, audio and shake. Re-trigger reuses the ability. Disposal releases owned GPU resources. The four textures are cached for the document lifetime. Shape changes can rebuild the crater geometry; this is an individual effect study, not a measured budget for many simultaneous breaches.

## Validation

`node scripts/browser-test.mjs --sinkhole` checks texture readiness, audible-voice startup, pre-roll, floor opening, completed subsidence, the settled bowl, zero monoliths, reset/re-trigger, audio cleanup on returning to the portal genre and disposal, while rejecting browser/shader errors. Use `--dist --sinkhole` for release assets. Screenshots are saved under `artifacts/browser/`. Run the normal project tests/check/build and full browser suite for changes to the adapter.

`test/sinkhole-shape.mjs` checks rim variation, continuous descent, debris/mesh height agreement and an approach centreline below 42 degrees. This validates a visual route; the emerging creatures follow a scripted slope route, not the game navigation graph.

## Planet, waves and wall/render comparisons

Environment switches between a curved planet and flat reference; use **view breach** for close inspection. Creature waves snapshot their settings on triggering, grow/fade in below the throat, then follow the climbable approach onto the planet. Select real enemy types or mixed groups, 1–4 waves and 1–24 creatures per wave (maximum 96). Timing, emergence and speed are preview controls.

**crackWidth** changes ribbon thickness independently of **crackLength**, which sets outer radial reach beyond the nominal crater radius. Irregular rim clipping can consume some short cracks; length changes apply on the next breach. Arms controls the radial branch count. Try width 1.4 and length 0.6 for short, wide fractures.

**Wall clearance** supplies 81 bounded fixtures, adjustable height and clearance radius. Nearby wall centres collapse within 1.2 seconds of opening, before the default two-second creature delay; distant walls remain. These are preview fixtures, not real dungeon cells. **TRON palette** and **Battlezone** reuse the game's palette and edge blending, with dark depth-writing surfaces and sparse bowl contours. They do not reproduce the game's seeded multi-colour zone assignment or post-processing exactly.

The future spawn integration must clear the actual wall cells, rebuild collision/navigation once, open the curved floor, then release the scheduled wave. Existing gate-hunting/income and wave rules remain unchanged until that adapter is implemented. These controls are not a new preset format.
