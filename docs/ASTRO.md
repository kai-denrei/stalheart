# Astro station diorama

Open `labs.html#astro`. The default scene has MÖRK, game-detail Stålheart and Hugin, the seven-dish SKYWARD array and nine people alternating astronaut, scientist and worker roles. All imported objects retain metre scale. Models and animations by jelaludo; exact source revision, file hashes and clips are in `astro-assets.lock.json`.

Auto crew mode sends people between the assembly point, tank flank and landmark approaches. A visibility graph routes around expanded axis-aligned model footprints. People crossfade real Walk/Run clips at the upstream preview speeds (1.15/3 m/s), then Point, Kneel or Idle at a stop. Other clip selections audition the authored animation in place. No game AI or progression rules are changed.

Stålheart plays Terraforming_Cycle, Hugin plays Cargo_Recovery_Cycle and SKYWARD plays Array_Slew. Visibility switches stop hidden landmark/crew mixer work. The animation switch freezes station activity while the camera and performance measurement remain live. Crew count ranges from zero to 60; changing it disposes the previous skeletons/mixers and reuses the loaded meshes/materials. Camera focus offers Crew, Overview and each landmark. Legacy astronaut studies remain under the walk-path selector and load only when selected.

The performance panel shows rolling FPS, mean frame time, p95 frame time, CPU plus render-submission duration, total draw calls/triangles across shadow and post-processing passes, and geometry/texture counts. Its group rows are visible mesh budgets before those extra passes, not measured per-object GPU time. Set baseline records current FPS for a local delta; keep the same camera and allow the sample window to settle when toggling objects, shadows, bloom or animation. Vsync can hide costs while a scene remains below the frame budget. Samples are bounded to 120 frames and are not uploaded.

The scene-share link includes station count, visibility, animation, selected clip, camera focus, shadows and bloom. These are lab settings, not a second FX preset format. Shipped gameplay models/presets are unaffected.

Validation: `test/yard-route.mjs` checks obstacle clearance and unreachable routes; `node scripts/browser-test.mjs --astro` checks all six assets, three roles, movement/clip variety, landmark cycles, pause, group exclusion, count changes and bounded telemetry. Add `--dist` for the release build. Standard full browser acceptance checks the other game/lab entry points.
