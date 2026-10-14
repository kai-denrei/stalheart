// THE GROUND FEED (owner, 2026-10-13: "I insist on fixing the Camera jump cuts with screen-within-screen to show the sinkholes"): a
// sinkhole opening, the back door's rockfall and the campaign board's rock opening no longer take the camera. The main view stays the
// player's; the corner box (where the TALON seeker feed sits) opens as SAT-3's orbital feed: a burst of static, a top-down view from orbit,
// a fast zoom from a regional frame to a close one, held while the fodder emerge, static again, closed. Spec
// docs/superpowers/specs/2026-10-13-ground-feed-inset-design.md; the schedule and the HUD numbers src/domain/feed-schedule.js, the knobs
// src/content/ground-feed.js. `&cuts=dive` keeps the old camera dives (the controller and src/fx/back-door.js pick one or the other).
//
// THE RENDER STAYS ON THE GPU. The story monitor (src/fx/story-monitor.js) copies its picture out of the game canvas into a 2D canvas
// every frame; measured headed on the M4 for this feed, that drawImage alone cost ~2-3 ms a frame and the p95 frame went from ~31 to
// ~48 ms (the copy waits on the GPU). So the feed camera draws the scene into its own render target at the feed's frame rate
// (k.feedHz, a video feed's, not the game's), and each frame one quad samples it into the box's rectangle of the game canvas with the
// look in its shader (monochrome green phosphor, scanlines, grain, vignette, the static bursts). The box itself is transparent: its
// border, the HUD's text and a small 2D canvas for the target box, redrawn only with the picture. No bloom pass; nothing drawn while
// the box is down. No per-frame allocations: the rectangles are measured on show and on resize, the HUD's text is rewritten only when
// its number changes. The look is in the shader, not in CSS filter functions, so Safari draws it the same.
//
// host: { busy() the box is held by a seeker's feed or a seat's optic (the ground feed waits), blocked() the game paused or a modal up
// (the box hides), heart() the heart's unit normal [x, y, z] or null, cellSide() }
import * as THREE from '../../vendor/three.module.js';
import { createFeedSchedule, feedTimeline, feedPose, feedZoom, feedGrid, formatGrid, feedClock, seismicMagnitude } from '../domain/feed-schedule.js';
import { GROUND_FEED } from '../content/ground-feed.js';
import { createCrtPass, MONO_FEED } from './crt-pass.js';

// the look (luminance, grain, one dark line in three, vignette, static, the phosphor's green) is src/fx/crt-pass.js's mono pass since 2026-10-14
// (the terminal shares it); the numbers are the feed's own, unchanged (MONO_FEED, test/crt-pass.mjs)

// the page's own states that hide the box (styles.css): the seat's glide and the showcase montage; the quad would draw without its frame
const hiddenByPage = (cl) => cl.contains('seat-gliding') || cl.contains('showcase-on');

export function createGroundFeed(root, host) {
  const body = document.body;
  const k = GROUND_FEED, sched = createFeedSchedule();
  const box = document.createElement('div'); box.id = 'ground-feed'; box.style.display = 'none';
  box.innerHTML = '<canvas class="hud"></canvas><div class="top"><span class="title"></span><span class="rec">&#9679; REC</span></div><div class="sub"></div>'
    + '<div class="foot"><span class="grid"></span><span class="zoom"></span><span class="seis"></span><span class="clock"></span></div>';
  root.append(box);
  const hud = box.querySelector('.hud'), ctx = hud.getContext('2d');
  const el = (s) => box.querySelector(s), subEl = el('.sub'), gridEl = el('.grid'), zoomEl = el('.zoom'), seisEl = el('.seis'), clockEl = el('.clock');
  el('.title').textContent = k.title;
  const cam = new THREE.PerspectiveCamera(30, 16 / 10, 0.01, 4), tgt = new THREE.Vector3(), mark = new THREE.Vector3();
  const rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  const crt = createCrtPass({ ...MONO_FEED, gain: k.gain });
  const tl = {}, pose = { eye: [0, 0, 0], target: [0, 0, 0], up: [0, 0, 0], fov: 30 }, grid = {}, heartAt = [0, 1, 0];
  const rect = { x: 0, y: 0, w: 1, h: 1 };
  let measured = false, shown = false, frames = 0, lastT = 0, cpuMs = 0, due = 0, fresh = true, lastEv = null, lastZoom = -1, lastClock = -1, cellSide = 0.01, magnitude = 0;
  const remeasure = () => { measured = false; };
  addEventListener('resize', remeasure);
  function measure(renderer) {
    const r = box.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect();
    rect.x = r.left - cr.left; rect.y = cr.bottom - r.bottom; rect.w = Math.max(1, r.width); rect.h = Math.max(1, r.height);   // CSS px; viewport y runs from the bottom of the buffer
    const dpr = renderer.getPixelRatio(), fw = Math.max(1, Math.round(rect.w * dpr)), fh = Math.max(1, Math.round(rect.h * dpr));
    if (rt.width !== fw || rt.height !== fh) rt.setSize(fw, fh);
    if (hud.width !== fw || hud.height !== fh) { hud.width = fw; hud.height = fh; }
    measured = true;
  }
  const show = (on) => { if (on === shown) return; shown = on; box.style.display = on ? '' : 'none'; if (on) { measured = false; fresh = true; } };
  // a new event in the box: its label, where it is and how hard the ground shook, fixed for its run
  function begin(ev) {
    lastEv = ev; lastZoom = lastClock = -1; fresh = true;
    subEl.textContent = k.labels[ev.kind] ?? k.labels.breach;
    gridEl.textContent = `GRID ${formatGrid(feedGrid(ev.dir, heartAt, grid))}`;
    magnitude = seismicMagnitude(ev, k); seisEl.textContent = `SEISMIC ${magnitude.toFixed(1)}`;
    const d = cellSide * k.altitudeCells; cam.near = d * 0.25; cam.far = d * 1.25;   // nothing past a little under the ground
  }
  // the feed camera's picture into the render target, and the target box over the point on the HUD canvas
  function picture(renderer, scene, f) {
    feedPose(f.ev.dir, heartAt, tl, cellSide, k, pose);
    cam.position.fromArray(pose.eye); cam.up.fromArray(pose.up); cam.lookAt(tgt.fromArray(pose.target)); cam.fov = pose.fov; cam.aspect = rect.w / rect.h; cam.updateProjectionMatrix();
    // the main pass has already brought every world matrix up to date this frame: the second render skips that whole-graph walk
    const auto = scene.matrixWorldAutoUpdate; scene.matrixWorldAutoUpdate = false;
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
    scene.matrixWorldAutoUpdate = auto;
    frames++;
    const W = hud.width, H = hud.height; ctx.clearRect(0, 0, W, H);
    mark.fromArray(f.ev.dir).project(cam);
    const px = (mark.x * 0.5 + 0.5) * W, py = (0.5 - mark.y * 0.5) * H, half = Math.max(8, (1.6 / tl.span) * H * 0.5), arm = half * 0.45;
    ctx.strokeStyle = 'rgba(220, 255, 214, 0.9)'; ctx.lineWidth = Math.max(1, Math.round(H / 220)); ctx.beginPath();
    for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) { const cx = px + sx * half, cy = py + sy * half; ctx.moveTo(cx - sx * arm, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy * arm); }
    ctx.moveTo(px - half * 0.25, py); ctx.lineTo(px + half * 0.25, py); ctx.moveTo(px, py - half * 0.25); ctx.lineTo(px, py + half * 0.25);
    ctx.stroke();
    // the frame's centre ticks, fixed (the drift moves the target off them)
    const mx = W / 2, my = H / 2, tk = H * 0.04; ctx.globalAlpha = 0.45; ctx.beginPath();
    ctx.moveTo(mx - tk * 2, my); ctx.lineTo(mx - tk, my); ctx.moveTo(mx + tk, my); ctx.lineTo(mx + tk * 2, my); ctx.moveTo(mx, my - tk * 2); ctx.lineTo(mx, my - tk); ctx.moveTo(mx, my + tk); ctx.lineTo(mx, my + tk * 2);
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  return {
    // the old dive's call, unchanged: (hooks, direction (unit Vector3), { id, preRoll, hold, tail, size }); the hooks are the camera's and unused
    dive(_hooks, direction, { id = 'breach', preRoll = 0, hold = 0, tail = 1.8, size = 1 } = {}) {
      sched.request({ kind: id, dir: direction.toArray(), preRoll, hold, tail, size });
      return preRoll + hold + tail;
    },
    // the box drew this frame (src/fx/creature-bodies.js stops culling to the main camera while a second view is up)
    on: () => shown,
    // after the main pass, every frame: the schedule's step, the picture at the feed's rate, the quad into the box's rectangle
    render(renderer, scene, dt = 0) {
      const f = sched.step(dt, !!host.busy(), !!host.blocked() || hiddenByPage(body.classList));
      show(f.on);
      lastT = f.t; if (!f.on) return;
      const t0 = performance.now();
      cellSide = host.cellSide(); const h = host.heart(); if (h) { heartAt[0] = h[0]; heartAt[1] = h[1]; heartAt[2] = h[2]; }
      if (f.ev !== lastEv) begin(f.ev);
      if (!measured) measure(renderer);
      feedTimeline(f.t, f.since, f.ev, k, tl);
      // A VIDEO FEED'S FRAME RATE: the scene's second render at k.feedHz, the first frame of an event at once
      due += dt; const step = 1 / k.feedHz;
      if (fresh || due >= step) { due = fresh ? 0 : Math.min(due - step, step); fresh = false; picture(renderer, scene, f); }
      // CSS px for the viewport and the scissor (three multiplies them by its pixel ratio)
      crt.step(dt, tl.static); crt.render(renderer, rt, rect);
      cpuMs += (performance.now() - t0 - cpuMs) * 0.05;   // the feed's CPU side, smoothed (its GPU side is in the perf overlay's frame)
      // the HUD's numbers, rewritten only when they change
      const zq = Math.round(feedZoom(tl.span, k) * 10); if (zq !== lastZoom) { lastZoom = zq; zoomEl.textContent = `ZOOM ×${(zq / 10).toFixed(1)}`; }
      const cq = Math.floor(f.t); if (cq !== lastClock) { lastClock = cq; clockEl.textContent = feedClock(f.t); }
    },
    state: () => ({ on: shown, up: sched.up(), waiting: sched.waiting(), kind: lastEv?.kind ?? null, label: lastEv ? subEl.textContent : null, frames, ...sched.stats(),
      t: +lastT.toFixed(2), cpuMs: +cpuMs.toFixed(2), zoom: lastZoom / 10, grid: gridEl.textContent, seismic: +magnitude.toFixed(1), clock: clockEl.textContent, static: +crt.static().toFixed(2),
      box: shown ? { w: rect.w, h: rect.h } : null, cam: shown ? { eye: pose.eye.slice(), target: pose.target.slice(), fov: +pose.fov.toFixed(2) } : null }),
    dispose() { removeEventListener('resize', remeasure); box.remove(); rt.dispose(); crt.dispose(); },
  };
}
