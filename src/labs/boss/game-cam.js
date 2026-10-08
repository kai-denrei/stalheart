// game-cam.js — the boss lab's second driving camera (owner, 2026-10-08): exactly the game's tank camera, and a rear-view feed
// bottom right in the gunship monitor's frame. Spec: docs/superpowers/specs/2026-10-08-boss-lab-game-camera-design.md.
//
// THE POSE IS THE GAME'S OWN: `tankViewPose` (src/domain/camera-goal.js) with third: true, mobile: false, dip: 0, kick: 0, at the
// lens `TANK_LENS` (src/domain/seat-view.js). The game feeds it `params.wallHeight`, `cellSide` and `unitScale` in its unit-sphere
// units; here they are the same lengths in the lab's metres, so the eye sits the same number of cells behind and above the hull.
//
// HOW THE GAME'S NUMBERS WERE FOUND. They derive from the planet build, so they are read from the game's default world: a bare
// page is the story world (readStoryQuery in src/platform/story-world.js: `world: story ? 'story' : 'default'`, a bare page is the
// story), whose build (src/td-tab.js ~2756-2777, ~2881) sets
//   params.wallHeight = built.wallHeight = story.recipe.wallMetres / planet.radius        (src/domain/world-recipe.js:20)
//   cellSide          = mesh.defaultSide, and planet.radius = recipe.metresPerCell / cellSide  (src/domain/story-planet.js:37-40)
//   unitScale         = baseUnitScale = cellSide * story.tankUnit                          (src/td-tab.js:2881)
// so in cells (the cell side as 1): wallHeight = wallMetres / metresPerCell = 4 / 10 = 0.4 and unitScale = STORY_SCALE.tankUnit =
// 0.684, whatever the mesh's own defaultSide comes to. Both are read from their owners in src/content/story-defaults.js below, so
// they cannot drift; the lab's cell is STORY_RECIPE.metresPerCell (10 m). The game's `unitScale` also GROWS on absorb; the base
// value is used here (the lab's hull does not grow). The viewport bias (applyViewportBias) is zero on a desktop and not copied.
//
// THE GAME'S SMOOTHING, COPIED BY NAME (extracting the game's rig into a shared module is a later refactor; td-tab has no line
// budget and this round does not touch the game controller):
//   SMOOTH_RATE  src/fx/hull-drive.js  updateSmoothDir: the smoothed heading chases the travel direction, projected on the tangent
//                plane, at 5 rad/s
//   CAM_LERP     src/td-tab.js         the per-frame camera step: camera.position.lerp(camGoal.pos, 0.14) and
//                camera.quaternion.slerp(camGoal.quat, 0.14), a rate PER FRAME in the game too (so the lag depends on the frame rate)
//
// THE REAR VIEW. A second camera on the hull, REAR_UP above it and REAR_BACK behind its centre, looking backward along the
// smoothed heading and REAR_DIP degrees down, the planet normal its up, not mirrored. It renders after the lab's main render,
// straight to the canvas through the viewport and the scissor (the lab has no post-processing pass), into the DOM frame's box
// (the gunship monitor's, styles.css #story-monitor: 224 x 140 CSS px, 12 px from the right, 64 from the bottom). The renderer's
// viewport, scissor and scissor test are put back after it. three's setViewport/setScissor take CSS pixels (they multiply by
// the pixel ratio themselves); `stats().rear` is the same box in device pixels.
//
// THE LAB'S PANEL COVERS THE STAGE'S RIGHT EDGE (the lil-gui panel is drawn over the canvas, full height), so a feed in the canvas's own
// bottom-right corner would sit under it. The host's `clearRight()` is how far the panel reaches into the stage, in CSS px; the box
// stands that much further from the right edge (12 px plus the panel), bottom right of what the player can see.
//
// The host gives the stage the frame lives in, `hull()` and `clearRight()`: the hull's ground point on the sphere and its heading (a world
// tangent), both centred on the planet; this file converts to the lab's scene, whose sphere group sits one radius down.
import * as THREE from '../../../vendor/three.module.js';
import { tankViewPose } from '../../domain/camera-goal.js';
import { TANK_LENS } from '../../domain/seat-view.js';
import { STORY_RECIPE, STORY_SCALE } from '../../content/story-defaults.js';
import { add3, sub3, scale3, dot3, cross3, norm3 } from '../../vec3.js';

const SMOOTH_RATE = 5.0;   // rad/s: src/fx/hull-drive.js updateSmoothDir
const CAM_LERP = 0.14;     // a frame: src/td-tab.js, the camera's position lerp and quaternion slerp toward the goal
// the game's lengths in cells (see the header); times the lab's cell side they are metres
const WALL_CELLS = STORY_RECIPE.wallMetres / STORY_RECIPE.metresPerCell;
const UNIT_CELLS = STORY_SCALE.tankUnit;
// the rear camera
const REAR_UP = 3, REAR_BACK = 2, REAR_DIP = 8, REAR_FOV = 60;   // metres, metres, degrees, degrees
const BOX = { w: 224, h: 140, right: 12, bottom: 64 };           // the gunship monitor's box, CSS px
const FRAME_CSS = `position:absolute;right:${BOX.right}px;bottom:${BOX.bottom}px;width:${BOX.w}px;height:${BOX.h}px;box-sizing:border-box;`
  + 'border:1px solid #2b6b96;border-radius:8px;pointer-events:none;z-index:11;display:none';
const LABEL_CSS = 'position:absolute;left:6px;top:4px;font:600 10px ui-monospace,Menlo,monospace;letter-spacing:.08em;color:#9fdcff;text-shadow:0 0 4px #000';
const MS_WINDOW = 10;      // samples in the rolling mean of the inset's cost
const MS_EVERY = 30;       // frames between two timed (GPU-finished) renders of the inset

export function createGameCam({ renderer, scene, camera, planetRadius, cellSide, host }) {
  const wallHeight = WALL_CELLS * cellSide, unitScale = UNIT_CELLS * cellSide;
  const down = new THREE.Vector3(0, planetRadius, 0);   // planet-centred -> scene (the sphere group sits one radius down)
  const tmpCam = new THREE.PerspectiveCamera();
  const rearCam = new THREE.PerspectiveCamera(REAR_FOV, BOX.w / BOX.h, 1, 6000);
  const goal = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const v = new THREE.Vector3();
  const gl = renderer.getContext();

  const frame = document.createElement('div'); frame.style.cssText = FRAME_CSS;
  const label = document.createElement('div'); label.style.cssText = LABEL_CSS; label.textContent = 'REAR';
  frame.append(label); host.stage.append(frame);

  let on = false, seeded = false, fovWas = camera.fov, smooth = [0, 0, 1], pose = null, frames = 0;
  let rear = { x: 0, y: 0, w: 0, h: 0 };
  const samples = [];
  let lookDist = 1;

  // the game's updateSmoothDir: rotate toward the heading (projected on the tangent plane) by at most SMOOTH_RATE * dt
  function updateSmoothDir(dt, pos, heading) {
    const n = norm3(pos);
    const s = norm3(sub3(smooth, scale3(n, dot3(smooth, n))));
    const g = norm3(sub3(heading, scale3(n, dot3(heading, n))));
    const ang = Math.atan2(dot3(cross3(s, g), n), Math.max(-1, Math.min(1, dot3(s, g))));
    const step = Math.max(-SMOOTH_RATE * dt, Math.min(SMOOTH_RATE * dt, ang));
    const c = Math.cos(step), si = Math.sin(step);
    smooth = norm3(add3(scale3(s, c), scale3(cross3(n, s), si)));
  }
  // the game's poseCamera: an eye, a look point and an up as a camera goal (scene space)
  function poseGoal({ eye, look, up }) {
    goal.pos.set(eye[0], eye[1], eye[2]).sub(down);
    tmpCam.position.copy(goal.pos); tmpCam.up.set(up[0], up[1], up[2]);
    tmpCam.lookAt(look[0] - down.x, look[1] - down.y, look[2] - down.z);
    goal.quat.copy(tmpCam.quaternion);
  }
  const sceneOf = (p) => [p[0] - down.x, p[1] - down.y, p[2] - down.z];

  return {
    // the main camera, one frame: the heading smooths, the pose is the game's, the camera follows at the game's rate
    step(dt) {
      if (!on) return;
      const h = host.hull();
      if (!seeded) smooth = norm3(sub3(h.heading, scale3(norm3(h.pos), dot3(h.heading, norm3(h.pos)))));
      else updateSmoothDir(dt, h.pos, h.heading);
      pose = tankViewPose({ c: h.pos, h: smooth, third: true, mobile: false, dip: 0, kick: 0, wallHeight, cellSide, unitScale });
      poseGoal(pose);
      lookDist = Math.hypot(pose.look[0] - pose.eye[0], pose.look[1] - pose.eye[1], pose.look[2] - pose.eye[2]);
      if (!seeded) { seeded = true; camera.position.copy(goal.pos); camera.quaternion.copy(goal.quat); }
      else { camera.position.lerp(goal.pos, CAM_LERP); camera.quaternion.slerp(goal.quat, CAM_LERP); }
    },
    // after the lab's main render: the feed into the frame's box, straight to the canvas
    renderRear() {
      if (!on) return;
      const h = host.hull(), n = norm3(h.pos), dip = REAR_DIP * Math.PI / 180;
      const eye = add3(add3(h.pos, scale3(n, REAR_UP)), scale3(smooth, -REAR_BACK));
      const dir = add3(scale3(smooth, -Math.cos(dip)), scale3(n, -Math.sin(dip)));
      const at = sceneOf(add3(eye, scale3(dir, 100))), pos = sceneOf(eye);
      rearCam.position.set(pos[0], pos[1], pos[2]); rearCam.up.set(n[0], n[1], n[2]); rearCam.lookAt(at[0], at[1], at[2]);
      rearCam.updateMatrixWorld();
      const right = `${BOX.right + Math.max(0, Math.round(host.clearRight?.() ?? 0))}px`;
      if (frame.style.right !== right) frame.style.right = right;
      const fr = frame.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect(), dpr = renderer.getPixelRatio();
      const x = Math.round(fr.left - cr.left), y = Math.round(cr.bottom - fr.bottom), w = Math.round(fr.width), hh = Math.round(fr.height);   // CSS px; y runs from the bottom
      if (w < 1 || hh < 1) return;
      rear = { x: Math.round(x * dpr), y: Math.round(y * dpr), w: Math.round(w * dpr), h: Math.round(hh * dpr) };
      const timed = frames++ % MS_EVERY === 0;
      const vp = renderer.getViewport(new THREE.Vector4()), sc = renderer.getScissor(new THREE.Vector4()), scTest = renderer.getScissorTest();
      if (timed) gl.finish();   // the main render's queue first, so the sample prices the inset alone
      const t0 = performance.now();
      renderer.setViewport(x, y, w, hh); renderer.setScissor(x, y, w, hh); renderer.setScissorTest(true);
      try { renderer.render(scene, rearCam); }
      finally { renderer.setViewport(vp); renderer.setScissor(sc); renderer.setScissorTest(scTest); }
      if (timed) { gl.finish(); samples.push(performance.now() - t0); if (samples.length > MS_WINDOW) samples.shift(); }
    },
    // the mode on or off: on takes the lens and shows the frame; off gives the lens back (the lab's chase takes the camera again)
    setOn(next) {
      next = !!next;
      if (next === on) return on;
      on = next; seeded = false; frame.style.display = on ? 'block' : 'none';
      if (on) { fovWas = camera.fov; camera.fov = TANK_LENS; } else camera.fov = fovWas;
      camera.updateProjectionMatrix();
      return on;
    },
    // the next step puts the heading and the camera straight on the hull (a new round's respawn)
    snap() { seeded = false; },
    isOn: () => on,
    // the pose for the current smoothed state and where the camera is, both in the lab's scene space
    state() {
      const eye = pose ? sceneOf(pose.eye) : null, look = pose ? sceneOf(pose.look) : null;
      v.set(0, 0, -lookDist).applyQuaternion(camera.quaternion).add(camera.position);
      return { eye: camera.position.toArray(), look: v.toArray(), pose: pose ? { eye, look } : null, rear: { ...rear }, ms: this.stats().ms };
    },
    stats: () => ({ on, ms: samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0, rear: { ...rear }, samples: samples.length }),
    dispose() { frame.remove(); if (on) { camera.fov = fovWas; camera.updateProjectionMatrix(); on = false; } },
  };
}
