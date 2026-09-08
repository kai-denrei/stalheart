# Astro station diorama

Open `labs.html#astro`. The default scene has MÖRK, game-detail Stålheart and Hugin, the seven-dish SKYWARD array and nine people alternating astronaut, scientist and worker roles. All imported objects retain metre scale. Models and animations by jelaludo; exact source revision, file hashes and clips are in `astro-assets.lock.json`.

Auto crew mode sends people between the assembly point, tank flank and landmark approaches. A visibility graph routes around expanded axis-aligned model footprints. People crossfade real Walk/Run clips at the upstream preview speeds (1.15/3 m/s), then Point, Kneel or Idle at a stop. Other clip selections audition the authored animation in place. No game AI or progression rules are changed.

Stålheart plays Terraforming_Cycle, Hugin plays Cargo_Recovery_Cycle and SKYWARD plays Array_Slew. Visibility switches stop hidden landmark/crew mixer work. The animation switch freezes station activity while the camera and performance measurement remain live. Crew count ranges from zero to 60; changing it disposes the previous skeletons/mixers and reuses the loaded meshes/materials. Camera focus offers Crew, Overview and each landmark. Legacy astronaut studies remain under the walk-path selector and load only when selected.

The performance panel shows rolling FPS, mean frame time, p95 frame time, CPU plus render-submission duration, total draw calls/triangles across shadow and post-processing passes, and geometry/texture counts. Its group rows are visible mesh budgets before those extra passes, not measured per-object GPU time. Set baseline records current FPS for a local delta; keep the same camera and allow the sample window to settle when toggling objects, shadows, bloom or animation. Vsync can hide costs while a scene remains below the frame budget. Samples are bounded to 120 frames and are not uploaded.

The scene-share link includes station count, visibility, animation, selected clip, camera focus, shadows and bloom. These are lab settings, not a second FX preset format. Shipped gameplay models/presets are unaffected.

Validation: `test/yard-route.mjs` checks obstacle clearance and unreachable routes; `node scripts/browser-test.mjs --astro` checks all six assets, three roles, movement/clip variety, landmark cycles, pause, group exclusion, count changes and bounded telemetry. Add `--dist` for the release build. Standard full browser acceptance checks the other game/lab entry points.

## Industrial yard and driving

The expanded site adds the robotic assembly line, roofless logistics/cargo bay, solar-power complex and open micro-reactor. A two-tile-wide network of 4 m Fortification foundation tiles connects their approaches to a central vehicle spine. Tiles share five instanced material batches and are not collision obstacles. Each industrial area and the foundation network has its own visibility/cost row. Source files are separately pinned in `astro-industry-assets.lock.json`.

Static geometry is merged by material under its articulation owner. The assembly line retains `Assembly_Cycle`; solar hinges retain their names and receive a gentle lab tracking motion. The reactor/cargo remain static. These are visual installations, not a new gameplay power or logistics simulation. Foundations do not alter main-game construction rules.

Press **1** for the free orbit/pan/zoom camera with MÖRK parked. Press **3** for third-person tank control; **W/S** or **up/down** accelerate/reverse, **A/D** or **left/right** turn, and the wheel adjusts chase distance. The on-screen buttons support the same actions. Switching modes or losing focus clears held driving inputs. Tank lift/settling uses the shared game feel/animation adapter. The yard uses metre-based steering and conservative expanded building footprints, not the sphere game’s grid movement or combat rules.

`yard-drive.js` owns bounded acceleration/braking and obstacle checks. `astro-drive.js` owns input, mode switching and the chase camera. Tests cover drive/reverse/brake/collision, keyboard movement and steering, view switches and typing isolation. The original free camera pose is restored on returning to mode 1.
