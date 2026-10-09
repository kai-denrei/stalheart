// seat.js — the boss lab's gunner seat (bait mode, 2026-10-09; spec docs/superpowers/specs/2026-10-09-boss-bait-mode-design.md, Task 3): the
// player IS the gunship on station. They look through its optic, aim, pick a gun and fire; the rounds are the fight's own plans
// (`playerShot` in src/domain/boss-fight.js), handed to the friendlies (`adopt`), which draw and resolve them as the schedule's, so they
// hurt the creature and Isao alike. No second presentation path: this file owns the view, the input, the reticle and the trigger.
//
// COPIED FROM src/labs/gunship-tab.js (sharing the two is a later refactor): the optic's frame (straight down from the platform's
// altitude over a look point, `60 / zoom` degrees, each gun's own zoom and the wheel's override), the pick of a ground point through the
// optic, the pad: WASD and a pointer resting at the view's edge slide the look point, the keys 1 2 3 and the hold-to-fire. NOT COPIED: the
// FLIR lens shader and the inset. The optic fills the stage (the main camera IS the gunner's view) and the lens look is a dark rim over
// it: a 15 m creature and a 1.8 m drone need the pixels of the whole stage, where the inset's 44 % of the width leaves the drone a
// few pixels across. src/fx/laser-scope.js is not used for that reason (a second render into a lens would show the same ground twice).
//
// THE TRIGGER, each frame while it is held: the 25 mm writes the reticle's ground point into its stream's `at`, `holdStream` renews its
// 0.1 s, and the friendlies tick after (the lab calls `tick` before them); with no stream alive a press makes one. A frame hitch over
// 0.1 s lapses the stream and the next frame makes a new one. The 40 mm asks `playerShot` every frame (it rate-limits itself), the MK-9
// once per press (its reload shows on the HUD). A plan is the rules' and has no `spares`: the lab's tank is a world away in this mode.
//
// THE PANEL'S SWITCHES gate these guns as they gate the schedule's (`gate()`): a gun switched off cannot be selected or fired (its chip
// dims), and with the fight switched off nothing fires and the strip says why. A round that is over (LOST, KILLED) takes the trigger's
// hold away: the stream is not renewed. ISAO'S MARKER: a cyan ring and a tag (`ISAO 12`) on him in the optic, in screen space, so he reads
// at any zoom (the drone itself is 1.8 m under a 340 m optic).
//
// POSITIONS are the lab's local metres [x, z] on the frame's plane; `surface(x, z)` gives the ground in the planet-centred `sphere` group.
import * as THREE from '../../../vendor/three.module.js';
import { playerShot, holdStream } from '../../domain/boss-fight.js';
import { GUNSHIP_GUNS, GUNSHIP_PLATFORM } from '../../content/gunship.js';

const BOOST = 2;             // the optic's magnification here is the gun's own times this: the bait is small and the creature big
const ZOOM = { min: 1, max: 6, step: 1.1 };   // the wheel's raw zoom, before the boost
const PAN = 0.6;             // the look point slides this many view heights a second (about 40 m/s at the 25 mm's framing)
const EDGE = 0.85;           // a pointer beyond this share of the view's half width or height pans (the gunship lab's 0.82)
const ORDER = ['rotary', 'bofors', 'nuke'];   // keys 1 2 3; the domain's `nuke` is the gunship's `heavy` (the MK-9)
const OPTIC = { rotary: 'rotary', bofors: 'bofors', nuke: 'heavy' };
const PAN_KEYS = { w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
const SVG = 'http://www.w3.org/2000/svg';

// `stage` the lab's stage, `camera` the lab's camera and `canvas` its canvas, `sphere` the planet-centred group (scene units, placed at
// the pole), `surface(x, z)` -> { point, normal } in it, `local(v)` a sphere-space point to [x, z], `radius()` the planet's,
// `tune()` the lab's fight numbers, `fight()` the round's state, `now()` the lab's clock, `adopt(plan)` the friendlies', `focus()` the
// point a round opens on, `armed()` the bait mode on, `free()` the panel's free orbit (the optic then leaves the camera alone),
// `keys` the lab's held keys (lower case), `gate()` the panel's switches as { fight, rotary, bofors, nuke } (true: on; default all),
// `isao()` { air: [x, y, z] (sphere space), hp, max } while he flies, else null, `clear()` { right, bottom }: the CSS px of the stage's right edge the lab's panel covers and of its bottom the readout does
export function createSeat({ stage, camera, canvas, sphere, surface, local, radius, tune, fight, now, adopt, focus, armed, free, keys, gate = () => ({ fight: true, rotary: true, bofors: true, nuke: true }), isao = () => null, clear = () => ({ right: 0, bottom: 0 }), cellSide = 10 }) {
  const altitude = GUNSHIP_PLATFORM.altitudeCells * cellSide;
  const root = document.createElement('div');
  root.className = 'seat'; root.hidden = true;
  const rim = document.createElement('div'); rim.className = 'seat-rim';
  const svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('class', 'seat-ret');
  const ring = document.createElementNS(SVG, 'circle'), cross = document.createElementNS(SVG, 'path');
  const mark = document.createElementNS(SVG, 'g'), markRing = document.createElementNS(SVG, 'circle'), markTag = document.createElementNS(SVG, 'text'), markArrow = document.createElementNS(SVG, 'path');
  mark.setAttribute('class', 'seat-isao'); mark.setAttribute('visibility', 'hidden'); mark.append(markRing, markArrow, markTag);
  svg.append(ring, cross, mark);
  const hud = document.createElement('div'); hud.className = 'seat-hud';
  const bar = document.createElement('div'); bar.className = 'seat-bar';
  const chips = ORDER.map((k, i) => { const c = document.createElement('span'); c.className = 'seat-gun'; c.dataset.gun = k; c.textContent = `${i + 1} ${GUNSHIP_GUNS[OPTIC[k]].label}`; return c; });
  const info = document.createElement('span'); info.className = 'seat-info';
  const hint = document.createElement('div'); hint.className = 'seat-hint'; hint.textContent = 'hold to fire · 1 2 3 guns · WASD pan · wheel zoom';
  bar.append(...chips, info);
  hud.append(bar, hint);   // the hint under the strip: the top of the stage is clear of the readout (bottom left) and the bars (top left)
  root.append(rim, svg, hud);
  stage.append(root);

  let gun = 'rotary', zoom = 0, held = false, press = false, look = null, reticle = [0, 0], live = false, stream = null, posed = false, recentre = false, markText = '';
  let fov0 = camera.fov, pointer = null, flash = '', flashUntil = 0, infoText = '', cursor = '';
  const shots = { rotary: 0, bofors: 0, nuke: 0 };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ball = new THREE.Sphere();
  const here = new THREE.Vector3(), north = new THREE.Vector3(), hit = new THREE.Vector3();

  const zoomOf = () => (zoom > 0 ? zoom : GUNSHIP_GUNS[OPTIC[gun]].zoom) * BOOST;   // the optic's magnification now
  const on = () => armed();
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  function choose(key) {
    const k = key === 'heavy' ? 'nuke' : key;
    if (!ORDER.includes(k) || !gate()[k]) return false;   // a gun the panel has switched off is not in the seat
    if (k !== gun) zoom = 0;   // each gun has its own framing; the wheel adjusts it until the next switch
    gun = k; press = false;
    return true;
  }
  // the optic's ground under a pointer position (CSS px on the canvas), as a local [x, z], or null off the planet
  function pick(px, py, w, h) {
    ray.setFromCamera(ndc.set((px / w) * 2 - 1, 1 - (py / h) * 2), camera);
    if (!ray.ray.intersectSphere(ball.set(sphere.position, radius()), hit)) return null;
    return local(hit.sub(sphere.position));
  }
  function onPointer(e) {
    if (!on() || free()) return;
    const box = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height };
    live = true;
    if (e.type === 'pointerdown' && e.button === 0) { held = true; press = true; e.preventDefault(); }
  }
  const onLeave = () => { pointer = null; };
  const onUp = () => { held = false; };
  function onWheel(e) {
    if (!on() || free()) return;
    zoom = Math.max(ZOOM.min, Math.min(ZOOM.max, zoomOf() / BOOST * (e.deltaY < 0 ? ZOOM.step : 1 / ZOOM.step)));
    e.preventDefault();
  }
  function onKey(e) {
    if (!on() || free() || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const pickKey = ORDER[Number(e.key) - 1];
    if (pickKey) { choose(pickKey); e.preventDefault(); }
  }
  canvas.addEventListener('pointermove', onPointer); canvas.addEventListener('pointerdown', onPointer, { passive: false });
  canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp); addEventListener('blur', onUp); addEventListener('keydown', onKey);

  // the look point slides over the ground, north up: WASD, and a pointer resting at the view's edge
  function pan(dt, viewM) {
    let dx = 0, dz = 0;
    for (const k of Object.keys(PAN_KEYS)) if (keys.has(k)) { dx += PAN_KEYS[k][0]; dz += PAN_KEYS[k][1]; }
    if (!dx && !dz && pointer) {
      const ex = (pointer.x / pointer.w - 0.5) * 2, ey = (0.5 - pointer.y / pointer.h) * 2, edge = Math.max(Math.abs(ex), Math.abs(ey));
      if (edge > EDGE) { const k = (edge - EDGE) * 3 / edge; dx = ex * k; dz = ey * k; }
    }
    if (!dx && !dz) return;
    const len = Math.hypot(dx, dz) || 1, step = PAN * viewM * dt / Math.max(1, len);
    look[0] += dx * step; look[1] += dz * step;
  }
  // the optic: straight down over the look point from the platform's altitude, north up
  function frame() {
    const g = surface(look[0], look[1]), n = surface(look[0], look[1] + 1).point;
    here.copy(g.point).add(sphere.position);
    north.copy(n).sub(g.point).normalize();
    camera.position.copy(here).addScaledVector(g.normal, altitude);
    camera.up.copy(north);
    camera.fov = 60 / zoomOf();
    camera.lookAt(here);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  // the reticle: a cross at its ground point and a ring of the gun's damage radius, so what you see is what kills
  function drawReticle(w, h) {
    const tn = tune(), r = gun === 'nuke' ? tn.nuke.radius : gun === 'bofors' ? tn.bofors.radius : tn.rotary.radius;
    const g = surface(reticle[0], reticle[1]);
    here.copy(g.point).add(sphere.position).project(camera);
    const x = (here.x + 1) / 2 * w, y = (1 - here.y) / 2 * h;
    const pxPerM = (h / 2) / (altitude * Math.tan(camera.fov * Math.PI / 360));
    ring.setAttribute('cx', x.toFixed(1)); ring.setAttribute('cy', y.toFixed(1)); ring.setAttribute('r', Math.max(2, r * pxPerM).toFixed(1));
    cross.setAttribute('d', `M${x - 14} ${y}H${x - 4}M${x + 4} ${y}H${x + 14}M${x} ${y - 14}V${y - 4}M${x} ${y + 4}V${y + 14}`);
  }
  // Isao: a ring of at least RING px round him and a tag `ISAO <hp>`, in the optic's screen space. The optic is narrow (the 25 mm sees about
  // seventy metres across), so when he flies out of it the ring stays at the edge nearest him, dashed, with an arrow toward him
  const RING = 16, EDGE_PAD = 26;
  function drawMark(w, h) {
    const m = isao();
    if (!m) { mark.setAttribute('visibility', 'hidden'); return; }
    here.set(m.air[0], m.air[1], m.air[2]).add(sphere.position).project(camera);
    let x = (here.x + 1) / 2 * w, y = (1 - here.y) / 2 * h;
    const behind = here.z > 1, pxPerM = (h / 2) / (altitude * Math.tan(camera.fov * Math.PI / 360));
    const cl = clear(), right = w - Math.max(0, cl.right), floor = h - Math.max(0, cl.bottom), inside = !behind && x >= EDGE_PAD && x <= right - EDGE_PAD && y >= EDGE_PAD && y <= floor - EDGE_PAD;
    let r = Math.max(RING, 2.5 * pxPerM), ax = 0, ay = 0;
    if (!inside) {   // clamp to the edge along the line from the middle, and point outward
      const mid = right / 2, mey = floor / 2, dx = (behind ? -1 : 1) * (x - mid), dy = (behind ? -1 : 1) * (y - mey), k = Math.max(Math.abs(dx) / (mid - EDGE_PAD), Math.abs(dy) / (mey - EDGE_PAD), 1e-6);
      x = mid + dx / k; y = mey + dy / k; r = RING * 0.75; const l = Math.hypot(dx, dy) || 1; ax = dx / l; ay = dy / l;
    }
    markRing.setAttribute('cx', x.toFixed(1)); markRing.setAttribute('cy', y.toFixed(1)); markRing.setAttribute('r', r.toFixed(1));
    const left = x > right - 120;   // the tag goes to his other side near the right edge
    markTag.setAttribute('x', (left ? x - r - 6 : x + r + 6).toFixed(1)); markTag.setAttribute('y', (y + 4).toFixed(1));
    markTag.setAttribute('text-anchor', left ? 'end' : 'start');
    markArrow.setAttribute('d', inside ? '' : `M${(x + ax * (r + 9)).toFixed(1)} ${(y + ay * (r + 9)).toFixed(1)}L${(x + ax * (r + 1) - ay * 6).toFixed(1)} ${(y + ay * (r + 1) + ax * 6).toFixed(1)}L${(x + ax * (r + 1) + ay * 6).toFixed(1)} ${(y + ay * (r + 1) - ax * 6).toFixed(1)}Z`);
    mark.dataset.edge = inside ? '0' : '1';
    mark.dataset.depth = inside ? Math.min(x - EDGE_PAD, right - EDGE_PAD - x, y - EDGE_PAD, floor - EDGE_PAD - y).toFixed(0) : '0';   // px to the nearest edge of the clear view
    mark.classList.toggle('edge', !inside);
    const text = `ISAO ${Math.ceil(m.hp)}`;
    if (text !== markText) { markText = text; markTag.textContent = text; }
    mark.setAttribute('visibility', 'visible');
  }
  function drawHud() {
    const g = gate();
    for (const c of chips) { c.classList.toggle('on', c.dataset.gun === gun); c.classList.toggle('off', !g[c.dataset.gun]); }
    const N = tune().nuke, P = fight().player, wait = Math.max(0, N.every - (now() - (P?.nuke ?? -Infinity)));
    const text = `${flash && now() < flashUntil ? `${flash} · ` : ''}${g.fight ? '' : 'the fight is off · '}MK-9 ${!g.nuke ? 'off' : wait > 0 ? `${Math.ceil(wait)} s` : 'ready'} · x${zoomOf().toFixed(1)}`;
    if (text !== infoText) { infoText = text; info.textContent = text; info.classList.toggle('wait', wait > 0); }
  }
  function release() { stream = null; held = false; press = false; }
  function say(text) { flash = text; flashUntil = now() + 1.5; }

  // the trigger: the 25 mm holds its stream on the reticle, the 40 mm asks each frame, the MK-9 once a press
  function trigger() {
    const t = now(), f = fight(), tn = tune(), g = gate();
    // a round that is over (LOST, KILLED), or a fight switched off, owes no stream: a held trigger renews nothing
    if (f.phase !== 'fight' || !g.fight) { stream = null; press = false; return; }
    if (!g[gun]) { stream = null; if (held || press) say(`${GUNSHIP_GUNS[OPTIC[gun]].label} off`); press = false; return; }
    if (gun === 'rotary') {
      if (!held) return;
      if (stream && stream.until > t) { stream.at = [...reticle]; holdStream(stream, t); return; }
      stream = playerShot(f, 'rotary', reticle, t, tn);
      if (stream) { adopt(stream); shots.rotary++; }
    } else if (gun === 'bofors') {
      if (!held) return;
      const plan = playerShot(f, 'bofors', reticle, t, tn);
      if (plan) { adopt(plan); shots.bofors++; }
    } else if (press) {
      const plan = playerShot(f, 'nuke', reticle, t, tn);
      if (plan) { adopt(plan); shots.nuke++; } else if (f.phase === 'fight') say('MK-9 reloading');
    }
    press = false;
  }

  return {
    // one frame: the pad, the optic on the camera, the reticle under the pointer, the trigger; before the friendlies' tick
    tick(dt) {
      const show = on() && !free();
      root.hidden = !on();
      if (!on()) { held = false; press = false; stream = null; }
      if (cursor !== (show ? 'crosshair' : '')) { cursor = show ? 'crosshair' : ''; canvas.style.cursor = cursor; }
      if (show) {
        if (!posed) { fov0 = camera.fov; posed = true; }
        look ??= focus();
        if (recentre) { reticle = [look[0], look[1]]; recentre = false; }   // after a restart the reticle is on the look point, not where it was
        const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
        pan(dt, altitude * Math.tan(camera.fov * Math.PI / 360) * 2);
        frame();
        if (live && pointer) { const at = pick(pointer.x, pointer.y, pointer.w, pointer.h); if (at) reticle = at; }
        drawReticle(w, h); drawMark(w, h);
      } else if (posed) { posed = false; camera.fov = fov0; camera.updateProjectionMatrix(); }
      if (!on()) return;
      trigger();
      drawHud();
    },
    // the optic is the camera now (the lab's own chase, the game camera and the free orbit stand down)
    owns: () => on() && !free(),
    // a new round: the optic opens on the middle of the two again, nothing is held and no stream is owed
    reset() { look = null; recentre = true; release(); shots.rotary = shots.bofors = shots.nuke = 0; },
    // the trigger let go and no stream owed (the fight switched off)
    release,
    shift(sx, sz) { if (look) { look[0] += sx; look[1] += sz; } reticle = [reticle[0] + sx, reticle[1] + sz]; },
    // the handle's: the reticle on a local ground point (until the pointer moves), a gun by name or number, the trigger
    aim(at) { reticle = [at[0], at[1]]; live = false; return [...reticle]; },
    gun(key) { choose(typeof key === 'number' || /^[1-3]$/.test(key) ? ORDER[Number(key) - 1] : key); return gun; },
    fire(v) { held = !!v; if (v && gun === 'nuke') press = true; return held; },
    state: () => ({ gun, reticle: [...reticle], look: look ? [...look] : null, zoom: zoomOf(), held, shots: { ...shots } }),
    dispose() {
      canvas.removeEventListener('pointermove', onPointer); canvas.removeEventListener('pointerdown', onPointer);
      canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('wheel', onWheel);
      removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); removeEventListener('blur', onUp); removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}
