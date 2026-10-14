// swarm-pearl.js — the swarm lab's Pearl mode: where a Pearl crowd's frame goes (owner, 2026-10-14: "brainstorm possibilities to show more
// pearl-enemies in swarms without breaking fps, we can adapt our current SWARM lab in dev to also display pearl-enemies, and play with
// variables in how they are rendered to see where we could gain the most. overall idea: strong full resolution animations when there are few
// and we can appreciate them, and simplifications when they are in swarms."; spec docs/superpowers/specs/2026-10-14-swarm-lab-pearl-design.md).
// A sibling the enemy study (./swarm-tab.js) mounts when its BODIES switch says Pearl, not a mode bolted into the dot code: the dot lane is
// untouched. Measure first, then build the level ladder from the numbers (the next round).
//
// THE GAME'S OWN BODIES. The crowd is seated through the game's family, createPearlFamily (src/fx/creature-pearl.js), with the game's tables:
// PEARL_TIERS, CREATURE_FOLLOW, CREATURE_DEATH, PEARL_FOLLOW, PEARL_PACE, PEARL_GAIT and PEARL_IMPACT, the bodies PEARL_BODIES (pearlBodies over
// ENEMY_SPEC), exactly the options src/fx/creature-enemies.js makes the family with. Each body's record walks the lane toward the tank at its
// paced spec's speed (PEARL_SPECS, the walk cap included) times the sector's pace, and waits for its body as the game's does (paceOf); the
// family follows it with its plane-metre track(). A record that reaches the tank's end is freed and seated again at the far end of the file, so
// the lane is always full and always moving. The lab pays what the game pays: the follow, the gait, the kit's step, the draw.
//
// THE PLANET AND THE CAMERA. The bodies bend onto the story planet (GAME_PLANET_R, the kit's uPlanetR) round the tank, which stands at the
// bend's origin; the ground and the walls are bent with the same bendPoint (the shader's JS twin), so a far body is not sunk in a flat floor.
// The GAME HEIGHT view is the game's third-person pose at the game's lens (GAME_POSE below), so a body's radius in pixels, and so its level,
// is what the game would draw; the free orbit starts there. THE LANE is the canyon's (src/content/sectors.js CANYON: 48 cells long, 1.2 cells
// either side of its line, 10 m a cell). The tank's drive, the ram and the hull contact are off this round; sound off.
//
// THE READINGS (a mean over the last second each): `step`, performance.now() round the records' walk, every track() and family.step() (the
// follow, the gait, the kit's planning and solver, the geometry packing), per frame (a frame that steps every N pays N frames' worth); `draw`,
// the dot lane's cost line (the scene rendered in a tight loop blocked on gl.finish(), the median of three) with one more wait: a one-pixel
// readPixels after the finish. The first headless sweep read gl.finish() alone at 0.1-0.3 ms from 0.2M to 28M triangles (forced to the high
// hull), flat: Chrome's finish did not wait for the GPU there, and a readback cannot return before the frame is drawn. The counters are the family's stats(): the
// bodies alive and each level's count (high / mid / low hull, culled) summed over the tiers, with renderer.info's triangles and calls.
// THE KNOBS each change one thing, live (applyKnobs); RESET puts the game's values back. THE SWEEP runs the knob set at 100, 300, 600 and
// 1,000 bodies (each seated, settled two seconds, read over three) into a table that copies clean into a log entry: two tables, one knob
// apart, are what that knob is worth.
import * as THREE from '../../vendor/three.module.js';
import { createPearlFamily } from '../fx/creature-pearl.js';
import { PEARL_BODIES, pearlSpec } from '../fx/creature-enemies.js';
import { bendPoint } from '../fx/cutis-maku/shaders.js';
import { CUTIS_LOD } from '../fx/cutis-maku/config.js';
import { PEARL_TIERS, PEARL_OF, PEARL_FOLLOW, PEARL_PACE, PEARL_GAIT, PEARL_IMPACT } from '../content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH } from '../content/creature-enemies.js';
import { STORY_RECIPE, STORY_SANITY, STORY_SCALE } from '../content/story-defaults.js';
import { CANYON, SECTORS, SECTOR_GENERATOR, SECTOR_HOLD, BACK_DOOR_SECTOR, BOTH_WALLS_SECTOR, SECTOR_DOOR, SECTOR_CANYON_AGAIN } from '../content/sectors.js';
import { sectorDef } from '../domain/sectors.js';
import { tankViewPose } from '../domain/camera-goal.js';
import { TANK_LENS } from '../domain/seat-view.js';
import { computeWavePlan } from '../enemyspec.js';

const CELL = STORY_RECIPE.metresPerCell;   // 10 m
// the story planet's radius in metres: R = metresPerCell / cellSide (src/fx/creature-bodies.js), the pinned story mesh's cell side (STORY_SANITY,
// asserted by test/story-planet.mjs): ~753 m
export const GAME_PLANET_R = CELL / STORY_SANITY.cellSide;
// the record's walk: its paced spec speed (cells a second) x the sector's pace (PEARL_GAIT.sectorPace, SECTOR_TIMING.pace) x 10 m a cell
const SECTOR_PACE = PEARL_GAIT.sectorPace;
// the hull's radius in metres (the game's baseUnitScale = cellSide x STORY_SCALE.tankUnit, src/td-tab.js ~2882) and the walls' height
const UNIT_M = STORY_SCALE.tankUnit * CELL, WALL_M = STORY_RECIPE.wallMetres;

// THE GAME HEIGHT: the game's third-person pose, tankViewPose (src/domain/camera-goal.js, the pose gameplayCameraPose reads in src/td-tab.js
// ~1873) with third: true, mobile: false, no dip or kick, fed the story world's lengths in metres (as src/labs/boss/game-cam.js derives them:
// wallHeight = wallMetres, cellSide = metresPerCell, unitScale = tankUnit cells), for a hull at the bend's origin heading down the lane (-z),
// at the game's lens TANK_LENS (src/domain/seat-view.js). Computed from the game's own function so it cannot drift: the eye ~34 m up and
// ~29 m behind the hull, looking ~14 m ahead of it, ~5 m up.
export const GAME_POSE = (() => {
  const p = tankViewPose({ c: [0, GAME_PLANET_R, 0], h: [0, 0, -1], third: true, mobile: false, dip: 0, kick: 0, wallHeight: WALL_M, cellSide: CELL, unitScale: UNIT_M });
  const down = (v) => [v[0], v[1] - GAME_PLANET_R, v[2]];
  return Object.freeze({ eye: Object.freeze(down(p.eye)), look: Object.freeze(down(p.look)), fov: TANK_LENS });
})();

// THE LANE, in the bodies' plane (metres; the tank at the origin, the file down -z): the canyon's length and half width (CANYON, cells x 10 m);
// `fill` the share of the half width the file width slider's 1 spans; `end` where a record loops back (just ahead of the hull's nose);
// `depth` the file's length at density 1 (density packs it shorter: depth / density), inside the game camera's horizon (~230 m).
export const PEARL_LANE = Object.freeze({ len: CANYON.length * CELL, half: CANYON.halfWidth * CELL, fill: 1, end: -UNIT_M - 4, depth: 200 });

// the game's level values: the kit's CUTIS_LOD under the Pearl set's own (PEARL_FOLLOW.lod, what the game's family is made with: highCap 12)
export const GAME_LOD = Object.freeze({ ...CUTIS_LOD, ...PEARL_FOLLOW.lod });
// the knobs at the game's values: `force` -1 is auto; the rest on; the family stepped every frame
export const GAME_KNOBS = Object.freeze({ high: GAME_LOD.high, low: GAME_LOD.low, highCap: GAME_LOD.highCap, force: -1, lumps: true, breath: true, shadow: true, core: true, every: 1 });
export const resetKnobs = () => ({ ...GAME_KNOBS });

export const TIERS = Object.freeze([...PEARL_TIERS.map((t) => t.id), 'mix']);
export const SWEEP_COUNTS = Object.freeze([100, 300, 600, 1000]);
const SWEEP_SETTLE = 2, SWEEP_READ = 3;   // seconds

// Deterministic: the dot lane's hash (./swarm-tab.js), so a seating can be had twice.
const hash = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

// THE SEATS: `count` records in a column down the lane, `spread` x fill x half wide (the dot lane's file width), `depth / dens` long from the
// loop-back end, each a hash of its index and `seed` -> { seats [{ x, z }], depth }
export function laneSeats(count, dens, spread, LANE, seed = 0) {
  const n = Math.max(0, Math.floor(count) || 0), w = Math.min(LANE.half - 1, LANE.half * (LANE.fill ?? 1) * spread);
  const depth = Math.max(20, Math.min(LANE.len + LANE.end, LANE.depth / Math.max(0.05, dens)));
  const seats = [];
  for (let i = 0; i < n; i++) { const k = i * 17 + 3 + seed * 7919; seats.push({ x: (hash(k, 1) - 0.5) * 2 * w, z: LANE.end - hash(k, 2) * depth }); }
  return { seats, depth };
}
// a record past the loop-back end goes back a file's depth (its spacing kept) -> its z, and whether it looped
export function laneLoop(z, LANE, depth) { return z > LANE.end ? { z: z - depth, looped: true } : { z, looped: false }; }
// the canyon's walls as the bodies' reach (the game asks the board's cells, src/domain/body-reach.js; here two planes): metres clear from
// x along (dx, dz), at most `max`
export function laneReach(x, dx, max, half) {
  if (dx > 1e-9) return Math.max(0, Math.min(max, (half - x) / dx));
  if (dx < -1e-9) return Math.max(0, Math.min(max, (-half - x) / dx));
  return max;
}

// THE MIX: the swarm the game sends down a canyon, by tier. The canyon again (SECTOR_CANYON_AGAIN, the held sector just before the back door at
// its earliest, SECTOR_DOOR.earliest - 1) is the one with a cored tier in it: its def through the game's sectorDef and arc (src/fx/sector-run.js),
// its plan computeWavePlan(waveBase + CANYON.ladder, round 1, the game's waveSize 4 (src/td-tab.js params), its threat), as sector-run seats the
// canyon (every count x CANYON.swarm x 2, which leaves the shares). -> [{ type, tier, share }], the types with a Pearl body
export function canyonMix({ of = PEARL_OF, bodies = PEARL_BODIES, waveSize = 4 } = {}) {
  const doorAt = SECTOR_DOOR.earliest, def = sectorDef(doorAt - 1, SECTORS, SECTOR_GENERATOR, { hold: SECTOR_HOLD, door: BACK_DOOR_SECTOR, both: BOTH_WALLS_SECTOR, doorAt, canyonAgain: SECTOR_CANYON_AGAIN });
  const counts = new Map();
  for (const e of computeWavePlan(def.waveBase + CANYON.ladder, 1, waveSize, def.threat).entries) if (of[e.type] && bodies[e.type]) counts.set(e.type, (counts.get(e.type) ?? 0) + e.count);
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return [...counts].map(([type, n]) => ({ type, tier: of[type], share: n / total }));
}
// each seat's game type: a tier's own types in turn (PEARL_OF order), or for `mix` a hash into the mix's shares
export function seatTypes(count, tier, { of = PEARL_OF, bodies = PEARL_BODIES, mix = null, seed = 0 } = {}) {
  const out = [];
  if (tier === 'mix') {
    const m = mix ?? canyonMix({ of, bodies });
    for (let i = 0; i < count; i++) { let u = hash(i * 31 + 5 + seed * 7919, 7), k = 0; while (k < m.length - 1 && u >= m[k].share) { u -= m[k].share; k++; } out.push(m[k].type); }
    return out;
  }
  const types = Object.keys(of).filter((t) => of[t] === tier && bodies[t]);
  for (let i = 0; i < count && types.length; i++) out.push(types[i % types.length]);
  return out;
}

// THE KNOBS ONTO THE DRAWING: `lod` the lab's level object (every swarm geometry reads it at each update: ../fx/cutis-maku/geometry.js),
// `uniforms` every level's membrane and inner core material's uniforms, `geometry` every tier's swarm geometry. Called after each step (the
// kit's update writes the materials and the meshes' visibility from the config every step), before the render. A knob at the game's value
// leaves its field to the kit; one moved off it sets exactly its own field.
export function applyKnobs(knobs, { lod = null, uniforms = [], geometry = [] } = {}) {
  if (lod) { lod.high = knobs.high; lod.low = knobs.low; lod.highCap = knobs.highCap; lod.force = knobs.force >= 0 ? knobs.force : null; }
  for (const u of uniforms) { if (!knobs.lumps) u.uNoise.value = 0; if (!knobs.breath) u.uBreath.value = 0; }
  for (const g of geometry) {
    if (!knobs.shadow) g.shadows.visible = false;
    if (!knobs.core) for (const l of g.levels) if (l.core) l.core.visible = false;
  }
}
// the targets of applyKnobs from the family's geometries
export function knobTargets(geometries, lod) {
  const uniforms = [];
  for (const g of geometries) for (const l of g.levels) { uniforms.push(l.material.uniforms); if (l.coreMaterial) uniforms.push(l.coreMaterial.uniforms); }
  return { lod, uniforms, geometry: geometries };
}

// THE SWEEP'S TABLE: fixed columns, one row a body count; triangles in millions (M), or thousands (k) under a tenth of a million
const COLS = [8, 9, 9, 21, 7, 5];
const tris = (t) => (t >= 1e5 ? `${(t / 1e6).toFixed(1)}M` : `${Math.round(t / 1e3)}k`);
const row = (cells) => cells.map((c, k) => (k === cells.length - 1 ? String(c) : String(c).padEnd(COLS[k]))).join('');
export function sweepTable(rows) {
  const lines = [row(['bodies', 'step ms', 'draw ms', 'high/mid/low/culled', 'tris', 'calls'])];
  for (const r of rows) lines.push(row([r.bodies, r.step.toFixed(1), r.draw.toFixed(1), r.levels.join('/'), tris(r.tris), r.calls]));
  return lines.join('\n');
}

// a rolling window of [time, value]: the mean over the last `span` seconds
function windowOf(span = 1) {
  const a = [];
  return { push(t, v) { a.push([t, v]); while (a.length && a[0][0] < t - span) a.shift(); }, mean() { return a.length ? a.reduce((s, x) => s + x[1], 0) / a.length : NaN; }, clear() { a.length = 0; } };
}

const PANEL = `
  <label>tier <select data-p="tier">${TIERS.map((t) => `<option value="${t}">${t === 'mix' ? 'mix (the canyon again)' : t}</option>`).join('')}</select></label>
  <label>view <select data-p="view"><option value="game">game height</option><option value="free">free orbit</option></select></label>
  <h3>knobs</h3>
  <label>high px <b data-pv="high">${GAME_KNOBS.high}</b><input type="range" data-p="high" min="10" max="300" step="1" value="${GAME_KNOBS.high}"></label>
  <label>low px <b data-pv="low">${GAME_KNOBS.low}</b><input type="range" data-p="low" min="1" max="80" step="1" value="${GAME_KNOBS.low}"></label>
  <label>high cap <b data-pv="highCap">${GAME_KNOBS.highCap}</b><input type="range" data-p="highCap" min="0" max="200" step="1" value="${GAME_KNOBS.highCap}"></label>
  <label>force level <select data-p="force"><option value="-1">auto</option><option value="0">0 high</option><option value="1">1 mid</option><option value="2">2 low</option></select></label>
  <label><input type="checkbox" data-p="lumps" checked> lumps (noise)</label>
  <label><input type="checkbox" data-p="breath" checked> breath</label>
  <label><input type="checkbox" data-p="shadow" checked> contact shadow</label>
  <label><input type="checkbox" data-p="core" checked> inner core mesh</label>
  <label>step every <select data-p="every"><option value="1">1 frame</option><option value="2">2 frames</option><option value="4">4 frames</option></select></label>
  <button type="button" class="sw-run" data-preset>reset to the game's</button>
  <button type="button" class="sw-run" data-psweep>sweep 100 &rarr; 1000</button>
  <pre class="sw-table" data-ptable></pre>
  <p class="sw-note">The game's own Pearl bodies, family and tables. <b>step</b> is the walk, the follow and the kit per frame;
  <b>draw</b> the scene blocked on the GPU. Force 0 lifts the high cap. The core knob hides the soft tiers' inner core; a cored
  tier's pearl stays. Headless numbers are not the owner's machine's: compare two sweeps, one knob apart.</p>`;

// host: { scene, renderer, camera, controls, panel (the element the Pearl controls go in), read and hud (the stage's readouts), tank() the hull,
// canyon (the dot lane's flat ground, hidden here), lane() -> { count, dens, spread } (the tab's sliders), setCount(n) }
export function mountSwarmPearl(host) {
  const { scene, renderer, camera: cam, controls } = host;
  const world = new THREE.Group(); world.name = 'Pearl lane'; scene.add(world);
  const lod = { ...GAME_LOD, force: null };
  // the family as src/fx/creature-enemies.js makes it, with the lab's level object and the canyon's walls for its reach
  const hubs = { count: 1, quat: () => null, reach: (hub, x, z, dx, dz, max) => laneReach(x, dx, max, PEARL_LANE.half) };
  const family = createPearlFamily({ parent: world, tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS,
    tune: { ...PEARL_FOLLOW, lod }, pace: PEARL_PACE, gait: PEARL_GAIT, impact: PEARL_IMPACT, hubs });
  family.setPlanet(GAME_PLANET_R);

  // --- the bent canyon --------------------------------------------------------------------------------------------------------------------
  const disposables = [], P = [0, 0, 0];
  const bent = (geo) => { const a = geo.getAttribute('position'); for (let i = 0; i < a.count; i++) { bendPoint(a.getX(i), a.getY(i), a.getZ(i), GAME_PLANET_R, P); a.setXYZ(i, P[0], P[1], P[2]); } geo.computeVertexNormals(); disposables.push(geo); return geo; };
  const mat = (m) => { disposables.push(m); return m; };
  const L = PEARL_LANE, z0 = 60, span = L.len + z0;
  const plane = (w, x, y, sx) => { const g = new THREE.PlaneGeometry(w, span, sx, 160); g.rotateX(-Math.PI / 2); g.translate(x, y, z0 - span / 2); return bent(g); };
  world.add(new THREE.Mesh(plane(L.half * 2, 0, 0, 6), mat(new THREE.MeshStandardMaterial({ color: 0x11181f, roughness: 1, metalness: 0 }))));
  const rimMat = mat(new THREE.MeshStandardMaterial({ color: 0x18222c, roughness: 1 })), wallMat = mat(new THREE.MeshStandardMaterial({ color: 0x1b2733, roughness: 0.95, side: THREE.DoubleSide }));
  for (const s of [-1, 1]) {
    world.add(new THREE.Mesh(plane(160, s * (L.half + 80), WALL_M, 8), rimMat));
    const g = new THREE.PlaneGeometry(span, WALL_M, 160, 1); g.rotateY(Math.PI / 2); g.translate(s * L.half, WALL_M / 2, z0 - span / 2);
    world.add(new THREE.Mesh(bent(g), wallMat));
  }
  // a line across the floor every cell, so a crowd's march reads
  { const pts = []; for (let z = z0; z >= -L.len; z -= CELL) for (const x of [-L.half, L.half]) { bendPoint(x, 0.05, z, GAME_PLANET_R, P); pts.push(P[0], P[1], P[2]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); disposables.push(g);
    world.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x1d3542 })))); }

  // the dot lane's stage set aside while the Pearl lane is up, and put back on dispose
  const was = { fog: scene.fog, fov: cam.fov, canyon: host.canyon?.visible ?? true };
  scene.fog = null; if (host.canyon) host.canyon.visible = false;
  cam.fov = GAME_POSE.fov; cam.updateProjectionMatrix();

  // --- the panel -------------------------------------------------------------------------------------------------------------------------
  host.panel.innerHTML = PANEL;
  const tableEl = host.panel.querySelector('[data-ptable]');
  let knobs = resetKnobs(), tier = 'white', view = 'game';
  const syncPanel = () => {
    for (const el of host.panel.querySelectorAll('[data-p]')) {
      const k = el.dataset.p, v = k === 'tier' ? tier : k === 'view' ? view : knobs[k];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
      const out = host.panel.querySelector(`[data-pv="${k}"]`); if (out) out.textContent = String(v);
    }
  };
  for (const el of host.panel.querySelectorAll('[data-p]')) el.addEventListener('input', () => {
    const k = el.dataset.p;
    if (k === 'tier') { tier = el.value; reseat = true; return; }
    if (k === 'view') { setView(el.value); return; }
    knobs[k] = el.type === 'checkbox' ? el.checked : Number(el.value);
    const out = host.panel.querySelector(`[data-pv="${k}"]`); if (out) out.textContent = el.value;
  });
  host.panel.querySelector('[data-preset]').addEventListener('click', () => { knobs = resetKnobs(); syncPanel(); });
  host.panel.querySelector('[data-psweep]').addEventListener('click', () => startSweep());

  // --- the camera ------------------------------------------------------------------------------------------------------------------------
  function poseGame() { cam.position.fromArray(GAME_POSE.eye); cam.up.set(0, 1, 0); cam.lookAt(GAME_POSE.look[0], GAME_POSE.look[1], GAME_POSE.look[2]); }
  function setView(v) {
    view = v === 'free' ? 'free' : 'game';
    controls.enabled = view === 'free';
    if (view === 'free') { poseGame(); controls.target.fromArray(GAME_POSE.look); controls.update(); }
  }
  setView('game');

  // --- the records -----------------------------------------------------------------------------------------------------------------------
  let recs = [], depth = L.depth, reseat = true;
  const add = (r) => { r.h = family.add(r.type, { x: r.x, z: r.z, angle: Math.PI / 2, speed: r.speed }); return r; };
  function seat() {
    for (const r of recs) family.free(r.h);
    const { count, dens, spread } = host.lane();
    const s = laneSeats(count, dens, spread, L), types = seatTypes(count, tier);
    depth = s.depth;
    recs = s.seats.map((p, i) => add({ x: p.x, z: p.z, type: types[i], speed: (pearlSpec(types[i])?.speed ?? 0) * SECTOR_PACE * CELL, h: null }));
    reseat = false;
  }
  function simulate(dt) {
    for (const r of recs) {
      if (!r.h) continue;
      const lp = laneLoop(r.z + r.speed * family.paceOf(r.h) * dt, L, depth);
      r.z = lp.z;
      if (lp.looped) { family.free(r.h); add(r); if (!r.h) continue; }
      family.track(r.h, { x: r.x, z: r.z, ax: r.x, az: r.z + CELL, dt, speed: r.speed });
    }
    family.step(dt, cam, renderer.domElement.height);
  }

  // the draw probe: the dot lane's (render, gl.finish(), the median), then a one-pixel readback, which waits for the frame (see the header)
  const gl = renderer.getContext(), pixel = new Uint8Array(4);
  function drawCost(samples = 3) {
    const s = [];
    for (let i = 0; i < samples; i++) {
      const a = performance.now(); renderer.render(scene, cam); gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      s.push(performance.now() - a);
    }
    s.sort((x, y) => x - y); return s[s.length >> 1];
  }

  // --- the readings ----------------------------------------------------------------------------------------------------------------------
  const steps = windowOf(1), draws = windowOf(1);
  let acc = 0, frameNo = 0, lastDraw = -1, lastRead = -1, clock = 0, last = { alive: 0, levels: [0, 0, 0, 0], tris: 0, calls: 0 };
  function counters() {
    const levels = [0, 0, 0, 0]; let alive = 0;
    for (const s of Object.values(family.stats())) { alive += s.live; for (let k = 0; k < 4; k++) levels[k] += s.lod[k]; }
    const inf = renderer.info.render;
    return { alive, levels, tris: inf.triangles, calls: inf.calls };
  }
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : '…');
  function readLine() {
    const st = steps.mean(), dr = draws.mean(), c = last;
    host.read.innerHTML = `<b>${c.alive}</b> alive &middot; step <b>${fmt(st)} ms</b> &middot; draw <b>${fmt(dr)} ms</b>`
      + ` &middot; levels ${c.levels[0]}/${c.levels[1]}/${c.levels[2]} +${c.levels[3]} culled`
      + `<br>${tris(c.tris)} tris &middot; ${c.calls} calls &middot; ${Number.isFinite(st + dr) ? ((st + dr) / 16.67 * 100).toFixed(0) : '…'}% of a 60 fps frame`;
    host.hud.innerHTML = `<span class="mode">PEARL &middot; ${tier.toUpperCase()}</span> &middot; ${view === 'game' ? 'GAME HEIGHT' : 'FREE ORBIT'}`
      + (sweep ? ` &middot; <span class="hot">SWEEP ${sweep.n} ${sweep.phase.toUpperCase()}</span>` : '');
  }

  // --- the sweep -------------------------------------------------------------------------------------------------------------------------
  let sweep = null, rows = [], tableText = '';
  function startSweep() {
    if (sweep) return;
    rows = []; tableText = ''; tableEl.textContent = 'sweeping…';
    sweep = { queue: SWEEP_COUNTS.slice(), back: host.lane().count, n: 0, phase: 'settle', t0: 0, acc: null };
    nextLeg();
  }
  function nextLeg() {
    const n = sweep.queue.shift();
    if (n === undefined) {
      tableText = sweepTable(rows); tableEl.textContent = tableText;
      const back = sweep.back; sweep = null; host.setCount(back); return;
    }
    sweep.n = n; sweep.phase = 'settle'; sweep.t0 = clock; host.setCount(n);
  }
  function sweepTick(stepMs, drawMs) {
    if (!sweep) return;
    if (sweep.phase === 'settle') {
      if (clock - sweep.t0 < SWEEP_SETTLE) return;
      sweep.phase = 'read'; sweep.t0 = clock; sweep.acc = { frames: 0, step: 0, draw: [], levels: [0, 0, 0, 0], tris: 0, calls: 0 };
      return;
    }
    const a = sweep.acc, c = last;
    a.frames++; a.step += stepMs; if (drawMs != null) a.draw.push(drawMs);
    for (let k = 0; k < 4; k++) a.levels[k] += c.levels[k];
    a.tris += c.tris; a.calls += c.calls;
    if (clock - sweep.t0 < SWEEP_READ) return;
    const f = Math.max(1, a.frames);
    rows.push({ bodies: sweep.n, step: a.step / f, draw: a.draw.length ? a.draw.reduce((s, x) => s + x, 0) / a.draw.length : NaN,
      levels: a.levels.map((v) => Math.round(v / f)), tris: a.tris / f, calls: Math.round(a.calls / f) });
    tableEl.textContent = sweepTable(rows);
    nextLeg();
  }

  // --- one frame: the camera, the step (every `every` frames, with the time since), the knobs, the render, the readings -----------------------
  function frame(dt) {
    clock += dt; frameNo++; acc += dt;
    if (reseat) seat();
    if (view === 'free') controls.update(); else poseGame();
    const tank = host.tank();
    if (tank) { tank.position.set(0, 0, 0); tank.rotation.set(0, Math.PI, 0); tank.scale.setScalar(UNIT_M); }
    let stepMs = 0;
    if (frameNo % Math.max(1, knobs.every) === 0) {
      const a = performance.now(); simulate(acc); stepMs = performance.now() - a; acc = 0;
    }
    steps.push(clock, stepMs);
    applyKnobs(knobs, knobTargets(family.geometries(), lod));
    renderer.render(scene, cam);
    last = counters();
    let drawMs = null;
    if (clock - lastDraw > 0.2) { lastDraw = clock; drawMs = drawCost(3); draws.push(clock, drawMs); }
    sweepTick(stepMs, drawMs);
    if (clock - lastRead > 0.4) { lastRead = clock; readLine(); }
  }

  const api = {
    set(k, v) {
      const el = host.panel.querySelector(`[data-p="${k}"]`);
      if (!el) return false;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    sweep: startSweep,
    reset: () => { knobs = resetKnobs(); syncPanel(); },
    table: () => tableText,
    state() {
      const geos = family.geometries(), mats = geos.flatMap((g) => g.levels.flatMap((l) => [l.material, l.coreMaterial].filter(Boolean)));
      return { mode: 'pearl', tier, view, count: host.lane().count, records: recs.length, live: last.alive, levels: last.levels.slice(), tris: last.tris, calls: last.calls,
        step: steps.mean(), draw: draws.mean(), knobs: { ...knobs }, lod: { ...lod }, tiers: Object.keys(family.stats()),
        noise: mats.map((m) => m.uniforms.uNoise.value), breath: mats.map((m) => m.uniforms.uBreath.value), shadows: geos.map((g) => g.shadows.visible),
        sweeping: !!sweep, sweepAt: sweep ? sweep.n : null, rows: rows.map((r) => ({ ...r, levels: r.levels.slice() })), table: tableText,
        planetR: GAME_PLANET_R, pose: { eye: [...GAME_POSE.eye], look: [...GAME_POSE.look], fov: GAME_POSE.fov } };
    },
  };
  window.__stalheartSwarmPearl = api;

  return {
    frame, api,
    reseat: () => { reseat = true; },
    dispose() {
      for (const r of recs) family.free(r.h);
      family.dispose(); scene.remove(world);
      for (const d of disposables) d.dispose();
      scene.fog = was.fog; if (host.canyon) host.canyon.visible = was.canyon;
      cam.fov = was.fov; cam.updateProjectionMatrix(); controls.enabled = false;
      host.panel.innerHTML = ''; host.read.innerHTML = '&nbsp;';
      if (window.__stalheartSwarmPearl === api) delete window.__stalheartSwarmPearl;
    },
  };
}
