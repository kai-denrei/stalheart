# The boss lab's game camera and rear view (design and plan)

Owner, 2026-10-08: "introduce another driving mode, the exact same PoV as the rest of the game. possibly with the add-on of
small image-within-image showing the rear-view view. bottom right like the extra camera view of the gunship." Brainstorm:
a toggle in the boss lab (option A), the default unchanged.

## Design

- **The toggle.** `V` and a panel switch `camera: lab | game` flip the boss lab's driving camera. Default `lab`, so the
  harness and every existing browser step are unchanged.
- **The game's camera, exactly.** The pose is the game's own `tankViewPose` (`src/domain/camera-goal.js:138`) with
  `third: true`, `mobile: false`, `dip: 0`, `kick: 0`; FOV the game's `TANK_LENS` (68, `src/domain/seat-view.js:14`). Its
  `wallHeight`, `cellSide` and `unitScale` are the game's own in proportion: the game's typical `params.wallHeight` and
  `unitScale` (`baseUnitScale`, `src/td-tab.js` ~570 and ~2882; the planet build sets `params.wallHeight`, ~2760) divided by
  the game's `cellSide` and multiplied by the lab's (10), so the eye sits the same number of cells behind and above the hull
  as in the game. `c` is the hull's position on the sphere (planet-centred), `h` its smoothed heading in the tangent plane.
- **The game's smoothing, copied by name.** The heading follows the hull's travel at `SMOOTH_RATE = 5` rad/s
  (`src/fx/hull-drive.js:293-306`, `updateSmoothDir`: rotate toward the travel direction, projected on the tangent plane);
  the camera's position lerps and its quaternion slerps `0.14` a frame toward the pose (`src/td-tab.js` ~5195; the game's
  rate is per frame). Both constants are copied with a comment naming their source; extracting the game's rig into a shared
  module is a later refactor (td-tab has no line budget, and this round does not touch the game controller).
- **The rear view.** In game mode only: a second camera on the hull, 3 m up at its rear (2 m behind the hull's centre),
  looking backward along `-h` and 8 degrees down, FOV 60, the planet normal its up; not mirrored (a camera feed like the
  gunship's monitor). Rendered each frame after the main render into the bottom-right corner of the same canvas with
  `setViewport`/`setScissor` (the scissor test restored after), 224 x 140 CSS px, 12 px from the right, 64 px from the bottom
  (the gunship monitor's box, `styles.css` ~3968); a DOM frame over it with the monitor's border (1 px `#2b6b96`, 8 px
  radius) and a `REAR` label. The readout appends `rear <ms>` (the inset's render cost per frame, a rolling mean).
- **Files.** `src/labs/boss/game-cam.js`: `createGameCam({ renderer, scene, camera, planetRadius, cellSide, host })` with
  `step(dt)` (the smoothing and the main camera's pose), `renderRear()` (after the main render), `setOn(on)`, `stats()`,
  `dispose()`. `src/labs/boss-tab.js` gains only the toggle, the calls and the readout. Layers: the lab file imports
  `src/domain`, `src/content`, the vendored three; never `td-tab.js`.

## Plan (one task)

- [ ] Read `src/domain/camera-goal.js` (`tankViewPose`), `src/fx/hull-drive.js` (`updateSmoothDir`), `src/td-tab.js` around
  the camera (`updateCameraGoal`, `poseCamera`, the per-frame lerp) and the values of `params.wallHeight`, `cellSide` and
  `unitScale` the game drives with (find their defaults/derivations; state the numbers in the module's header), and the boss
  lab's current chase camera (`CHASE`, `boss-tab.js` ~61 and ~640-652) and how it places the tank on the sphere.
- [ ] Write `game-cam.js` as designed; wire the toggle (`V` key with the lab's key handling rules; the panel switch), the
  per-frame `step` in place of the lab chase when on, `renderRear()` after the main render, the readout, `dispose`.
- [ ] Acceptance handle: `camera(mode)` and `cam()` → `{ mode, eye, look, pose: { eye, look }, rear: { x, y, w, h }, ms }`
  where `pose` is `tankViewPose` for the current smoothed state.
- [ ] Browser step `--boss-cam` (from a snapshot): open `labs.html?sw=0&acceptance=1#boss`, `camera('game')`, drive forward
  5 s then turn 3 s (the handle's scripted drive), assert: the eye stays within 1 cell of `pose.eye` after the first second
  (the lag), the rear viewport is the bottom-right 224 x 140 (in device pixels: x2 at DPR 2), no frame or shader errors;
  `camera('lab')` restores the old chase; save one screenshot in game mode (the inset visible) to the scratchpad.
- [ ] `node --check`, `npm test`, `npm run check`, `npm run build`; `--boss` still green.
- [ ] Commit: `The boss lab drives with the game's own camera on V: the same pose, lens and lag as the game, and a rear-view
  feed bottom right in the gunship monitor's frame`.
