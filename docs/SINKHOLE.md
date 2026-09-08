# Sinkhole effect study

Open `labs.html?genre=sinkhole#portal`, or choose **Sinkhole** under **genre** in the Portal Lab. Press **rumble → breach** after textures load. Orbit to inspect the opening; **reset ground** clears the event. Shared defaults are rumble lead-in **1.6**, radius **1**, heave **−0.12**, crack width **1.15**, crack length **2**, arms **12**, debris **24**, with the **TRON palette**. The opening spans the supplied quake clip’s 6.984 seconds, including lead-in. **Quake sound** plays the owner-provided quake/break clip from the start of the pre-roll; disabling it, resetting or leaving this genre stops playback. Re-trigger after radius changes to rebuild the complete event at the new size.

The genre is separate from Corona/Wormhole portal effects. Normal gameplay now uses ground breaches as its wave sources. The canonical FX package (base 7) contains a validated `breach` section; old packages migrate without losing weapon edits. Copy gives visible success feedback or selected fallback text if clipboard access fails. Export/import, working copies, review/apply and explicit game preview use the shared preset panel. Creature-wave and wall fixtures remain lab-only.

## Import and host boundary

`docs/sinkhole-assets.lock.json` pins source revision `364c9ce70ba784809291e87981ca83a19560f73d`, original checksums and adapted local checksums. `npm run assets:check` validates the transferred code and four stone textures. The source import guide was used without changing its repository. License and attribution are retained.

`src/fx/sinkhole/` contains the selected Monolith Rift implementation: crater plate, fissure network, stone shading, debris/particle engine, light pool, decals and camera shake. All Three imports use Stalheart's sole vendored r160. The source's r185 shader patches compile against this version in browser acceptance. Kinetic warp is omitted because this host has no distortion pass; monolith count and blast share are forced to zero, including the source's minimum-count clamp.

`src/sinkhole.js` supplies an owned scene group and context, patches the shadow-registration hook, advances shared frame uniforms, updates the ability and calls `ParticleEngine.flush()` each frame. Camera layers 0/1 render the effect, with ground at y=0. A 0.1 m casterless path arrives at the impact point immediately after the rumble pre-roll.

The original effect heaves a plate over an intact floor. The host now uses one irregular boundary from `src/core/sinkhole-shape.js` for the floor cut, fissure clipping and textured bowl in `src/sinkhole-terrain.js`. The bowl descends continuously into an irregular black throat, with a gentler approach facing the default camera and steeper side walls. Broken stones dress the rim. The source plate drops out during the opening, and dust emission decays so the shape is visible after settling. Debris collides with the actual bowl height instead of an invisible flat floor; fissures remain outside the rim. There is no second floor hiding the negative-heave geometry. The surface adapter wraps positions and normals onto a planet, with the same irregular floor cut in both flat and curved modes. It uses the pinned organic grid kernel at preview density; the game adapter clips its actual floor/edge meshes using each breach’s inverse frame and the same boundary.

The audio uses the shared mixer with a pinned cue in `src/content/breach-defaults.js`; `docs/breach-audio.lock.json` pins the unchanged 6.984-second MP3 and its original supplied filename. The sample identity and mix remain fixed runtime inputs; breach duration is represented in the FX schema.

Reset clears particles, lights, decals, crater/fissures, audio and shake. Re-trigger reuses the ability. Disposal releases owned GPU resources. The four textures are cached for the document lifetime. Shape changes can rebuild the crater geometry; this is an individual effect study, not a measured budget for many simultaneous breaches.

## Validation

`node scripts/browser-test.mjs --sinkhole` checks texture readiness, audible-voice startup, pre-roll, floor opening, completed subsidence, the settled bowl, zero monoliths, reset/re-trigger, audio cleanup on returning to the portal genre and disposal, while rejecting browser/shader errors. Use `--dist --sinkhole` for release assets. Screenshots are saved under `artifacts/browser/`. Run the normal project tests/check/build and full browser suite for changes to the adapter.

`test/sinkhole-shape.mjs` checks rim variation, continuous descent, debris/mesh height agreement and an approach centreline below 42 degrees. This validates a visual route; the emerging creatures follow a scripted slope route, not the game navigation graph.

## Planet, waves and wall/render comparisons

Environment switches between a curved planet and flat reference; use **view breach** for close inspection. Creature waves snapshot their settings on triggering, grow/fade in below the throat, then follow the climbable approach onto the planet. Select real enemy types or mixed groups, 1–4 waves and 1–24 creatures per wave (maximum 96). Timing, emergence and speed are preview controls.

**crackWidth** changes ribbon thickness independently of **crackLength**, which sets outer radial reach beyond the nominal crater radius. Irregular rim clipping can consume some short cracks; length changes apply on the next breach. Arms controls the radial branch count. Try width 1.4 and length 0.6 for short, wide fractures.

**Wall clearance** supplies 81 bounded fixtures, adjustable height and clearance radius. Nearby wall centres collapse within 1.2 seconds of opening, before the default two-second creature delay; distant walls remain. These are preview fixtures, not real dungeon cells. **TRON palette** and **Battlezone** reuse the game's palette and edge blending, with dark depth-writing surfaces and sparse bowl contours. They do not reproduce the game's seeded multi-colour zone assignment or post-processing exactly.

`src/game-breaches.js` reuses the lab effect with a per-source tangent frame, radial curvature and appropriately scaled billboards. One authoring scene unit maps to one game cell for the breach footprint; this is an effect framing choice, not a change to the shared weapon metre conversion. The game opens nearby wall cells within the configured arc radius, preserves the server, mounted towers and pending Isao construction sites (ordinary demolition retains its existing order refunds), rebuilds the heart/source navigation fields once per clearance batch, and holds queued enemies until the opening is complete. Enemies fade/grow below the throat and use normal navigation with the bowl’s radial height. Source health, hunting income, wave counts and mission supply rules remain unchanged. Legacy portal visual probes are still available explicitly.

Breach sources own and dispose their effects; the adapter is bounded at 32 concurrent sources. Geometry rebuilds retain ground-cut uniforms. Particle clocks use the shared absolute game time. Fissures and ground decals draw before transparent creature clouds, with depth testing retained. Bloom weights shared materials once and restores their original colours and visibility; repeated weighting had caused colour overflow and a black frame during integration.

`node scripts/browser-test.mjs --breach-game` exercises real wall clearance, queued emergence, settled rendering, bounded material colours and restart. `--sinkhole` additionally checks copy success/fallback feedback. Use `--dist` for release-path acceptance. Many simultaneous breaches and late-wave performance still need human playtesting.
