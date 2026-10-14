// swarm-lab-pearl.mjs — the swarm lab's Pearl mode (owner, 2026-10-14; spec docs/superpowers/specs/2026-10-14-swarm-lab-pearl-design.md, section 5):
// the lane seating is pure (spread like the dot lane's, deterministic for a seed; owner, 2026-10-14, round two: the walk at the hull, the touch, the
// far seat, the drive's blockers, the hull and the camera on the planet), the mix is the canyon's swarm by tier, the knobs set
// exactly their own field and RESET puts the game's values back, the geometry's forced level, the sweep table's columns, and the family driven down
// the lane as the lab drives it.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { laneSeats, walkToward, touched, farSeat, laneBlocker, WALL_CLEAR, unbend, createLaneHull, hullFrame, gamePose, laneReach, canyonMix, seatTypes, applyKnobs, knobTargets, resetKnobs, sweepTable, GAME_KNOBS, GAME_LOD, GAME_POSE,
  GAME_PLANET_R, PEARL_LANE, TIERS, SWEEP_COUNTS } from '../src/labs/swarm-pearl.js';
import { CUTIS_LOD } from '../src/fx/cutis-maku/config.js';
import { createSwarmGeometry } from '../src/fx/cutis-maku/geometry.js';
import { CutisSwarm } from '../src/fx/cutis-maku/swarm.js';
import { DEFAULT_CONFIG } from '../src/fx/cutis-maku/config.js';
import { createPearlFamily } from '../src/fx/creature-pearl.js';
import { PEARL_BODIES, pearlSpec } from '../src/fx/creature-enemies.js';
import { PEARL_TIERS, PEARL_OF, PEARL_FOLLOW, PEARL_PACE, PEARL_GAIT, PEARL_IMPACT } from '../src/content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH } from '../src/content/creature-enemies.js';
import { STORY_SANITY } from '../src/content/story-defaults.js';
import { TANK_LENS } from '../src/domain/seat-view.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// ---- the game's numbers ----
close(GAME_PLANET_R, 10 / STORY_SANITY.cellSide, 1e-9, 'the story planet\'s radius');
assert(GAME_PLANET_R > 740 && GAME_PLANET_R < 770, `~753 m (${GAME_PLANET_R})`);
assert.equal(GAME_POSE.fov, TANK_LENS);
assert(GAME_POSE.eye[1] > 30 && GAME_POSE.eye[1] < 38 && GAME_POSE.eye[2] > 25 && GAME_POSE.eye[2] < 33, `the eye high behind the hull (${GAME_POSE.eye})`);
assert(GAME_POSE.look[2] < -10 && GAME_POSE.look[1] > 3, `looking down the lane (${GAME_POSE.look})`);
{
  const p = gamePose(0, 0, Math.PI); for (let k = 0; k < 3; k++) { close(p.eye[k], GAME_POSE.eye[k], 1e-9, 'GAME_POSE is the pose at the origin'); }
  const f = hullFrame(0, 0, Math.PI); assert.deepEqual(f.pos.map((v) => +v.toFixed(9)), [0, 0, 0]); close(f.heading[2], -1, 1e-6, 'yaw pi heads down the lane');
  const g = hullFrame(0, -200, Math.PI), q = gamePose(0, -200, Math.PI);
  assert(g.pos[1] < -20, `a hull 200 m down the lane stands lower on the planet (${g.pos[1]})`); assert(g.up[2] < -0.2, 'its up leans with the planet');
  close(Math.hypot(...g.heading), 1, 1e-9, 'a unit heading'); close(g.heading[0] * g.up[0] + g.heading[1] * g.up[1] + g.heading[2] * g.up[2], 0, 1e-9, 'tangent to the planet');
  const d0 = Math.hypot(GAME_POSE.eye[0], GAME_POSE.eye[1], GAME_POSE.eye[2]), d1 = Math.hypot(q.eye[0] - g.pos[0], q.eye[1] - g.pos[1], q.eye[2] - g.pos[2]);
  close(d1, d0, 1e-6, 'the camera follows the hull at the same distance');
}
assert.deepEqual(GAME_LOD, { ...CUTIS_LOD, ...PEARL_FOLLOW.lod }, 'the game\'s levels: the kit\'s under the Pearl set\'s');
assert.deepEqual(TIERS, [...PEARL_TIERS.map((t) => t.id), 'mix']);
assert.deepEqual(SWEEP_COUNTS, [100, 300, 600, 1000]);
console.log('PASS the game\'s numbers: the story planet, the third-person pose at the game\'s lens, the Pearl set\'s levels');

// ---- the lane seating ----
{
  const a = laneSeats(300, 1, 0.5, PEARL_LANE), b = laneSeats(300, 1, 0.5, PEARL_LANE);
  assert.equal(a.seats.length, 300); assert.deepEqual(a, b, 'deterministic');
  assert.notDeepEqual(laneSeats(300, 1, 0.5, PEARL_LANE, 1).seats, a.seats, 'another seed, another seating');
  const w = PEARL_LANE.half * PEARL_LANE.fill * 0.5;
  for (const s of a.seats) { assert(Math.abs(s.x) <= w + 1e-9, `inside the file width (${s.x})`); assert(s.z <= PEARL_LANE.end && s.z >= PEARL_LANE.end - a.depth, `along the file (${s.z})`); }
  const xs = a.seats.map((s) => s.x), zs = a.seats.map((s) => s.z);
  assert(Math.max(...xs) - Math.min(...xs) > w * 1.6, 'spread across the file');
  assert(Math.max(...zs) - Math.min(...zs) > a.depth * 0.9, 'and along it');
  assert.equal(a.depth, PEARL_LANE.depth, 'density 1: the lane\'s file depth');
  close(laneSeats(300, 2, 0.5, PEARL_LANE).depth, PEARL_LANE.depth / 2, 1e-9, 'density packs the file shorter');
  const wide = laneSeats(300, 1, 1, PEARL_LANE).seats, narrow = laneSeats(300, 1, 0.25, PEARL_LANE).seats;
  assert(Math.max(...wide.map((s) => Math.abs(s.x))) > 2 * Math.max(...narrow.map((s) => Math.abs(s.x))), 'the file width slider widens it');
  for (const s of laneSeats(200, 1, 1.6, PEARL_LANE).seats) assert(Math.abs(s.x) < PEARL_LANE.half, 'never in the wall');
  assert.equal(laneSeats(0, 1, 0.5, PEARL_LANE).seats.length, 0);
  // the walk at the hull, the touch, the far seat
  assert.deepEqual(walkToward(0, -100, 0, 0, 5), [0, -95]); assert.deepEqual(walkToward(3, -4, 0, 0, 10), [0, 0], 'never past the hull');
  { const [x, z] = walkToward(6, -8, 0, 0, 5); close(x, 3, 1e-9, 'along the line to the hull x'); close(z, -4, 1e-9, 'z'); }
  assert(touched(0, -9, 0, 0, 9.3)); assert(!touched(0, -9.5, 0, 0, 9.3)); assert(touched(5, 5, 4, 4, 2));
  close(farSeat(0, PEARL_LANE, 200, 0), PEARL_LANE.end - 200, 1e-9, 'the far end of the file behind a hull at the origin');
  close(farSeat(-50, PEARL_LANE, 200, 0), -50 + PEARL_LANE.end - 200, 1e-9, 'behind a hull that drove up the lane');
  assert(farSeat(0, PEARL_LANE, 200, 1) > farSeat(0, PEARL_LANE, 200, 0), 'u a little nearer');
  assert.equal(farSeat(-460, PEARL_LANE, 200, 0), -PEARL_LANE.len + 10, 'never past the lane\'s end');
  assert(farSeat(80, PEARL_LANE, 200, 1) <= PEARL_LANE.end, 'never ahead of the file');
  // the walls as the reach
  assert.equal(laneReach(0, 1, 50, 12), 12); assert.equal(laneReach(0, -0.5, 50, 12), 24); assert.equal(laneReach(3, 0, 5, 12), 5); assert.equal(laneReach(11, 1, 4, 12), 1);
}
// THE GAME'S DRIVE IN THE LANE (round three, owner 2026-10-14: "the feel of the tank, speed, etc. should be the same as the game"): the boss lab's
// plane drive (the game's ease, run-up and pace) with the lane's walls as the game's friction; the cruise the boss-fight spec measured, 38 m/s
// after four seconds held, and no 265 m radius
{
  const { createPlaneDrive } = await import('../src/labs/boss/drive.js'), blocker = laneBlocker(PEARL_LANE, WALL_CLEAR);
  const d = createPlaneDrive({ feel: {}, slide: true }); d.reset(0, 0, Math.PI);
  let at4 = 0;
  for (let f = 1; f <= 60 * 9; f++) { d.step(1 / 60, { throttle: 1, turn: 0 }, blocker); if (f === 240) at4 = d.state.speed; }
  console.log(`LANE CRUISE ${at4.toFixed(1)} m/s at 4 s held, ${d.state.speed.toFixed(1)} at 9 s, ${(-d.state.z).toFixed(0)} m down the lane`);
  assert(at4 > 35 && at4 < 41, `the game's cruise at four seconds (${at4})`);
  assert(-d.state.z > 265, `past the yard drive's 265 m radius (${d.state.z})`); assert(Math.abs(d.state.x) < 1e-6, 'straight down the lane');
  // into the wall at 30 degrees: held off it, still moving along it, the run-up scrubbed against a free run's
  const w = createPlaneDrive({ feel: {}, slide: true }), free = createPlaneDrive({ feel: {}, slide: true });
  w.reset(0, -20, Math.PI + 0.5); free.reset(0, -20, Math.PI);
  for (let f = 0; f < 240; f++) { w.step(1 / 60, { throttle: 1, turn: 0 }, blocker); free.step(1 / 60, { throttle: 1, turn: 0 }, blocker); }
  assert(w.state.x <= PEARL_LANE.half - WALL_CLEAR + 1e-6, `held off the wall (${w.state.x})`);
  assert(w.state.z < -60, `slid along it (${w.state.z})`); assert(w.state.speed > 20 && w.state.speed < free.state.speed, `friction, not a stop (${w.state.speed} < ${free.state.speed})`);
  assert(Math.abs(Math.sin(w.state.yaw)) < Math.sin(0.5), 'turned along the wall');
  // the lane's ends
  const e = createPlaneDrive({ feel: {}, slide: true }); e.reset(0, -400, Math.PI);
  for (let f = 0; f < 600; f++) e.step(1 / 60, { throttle: 1, turn: 0 }, blocker);
  assert(e.state.z >= -PEARL_LANE.len + WALL_CLEAR - 1e-6, `held at the lane's far end (${e.state.z})`);
  // the boss lab's drive without `slide` keeps its thud
  const b = createPlaneDrive({ feel: {} }); b.reset(0, -20, Math.PI + 0.5);
  for (let f = 0; f < 240; f++) b.step(1 / 60, { throttle: 1, turn: 0 }, blocker);
  assert(b.state.speed === 0 || b.state.z > w.state.z, 'without slide the wall still stops the hull');
}
console.log('PASS the lane seating and the drive: a deterministic column, the walk at the hull, the touch, the far seat; the game\'s drive to its cruise, the walls as friction, no 265 m radius');

// ---- the shell (round three, owner 2026-10-14: "tank shell should be operational") ----
{
  const { bendPoint } = await import('../src/fx/cutis-maku/shaders.js');
  for (const [x, z] of [[0, 0], [5, -40], [-11, -300], [3, 55]]) { const u = unbend(bendPoint(x, 0, z, GAME_PLANET_R)); close(u[0], x, 1e-6, `unbend x at ${z}`); close(u[1], z, 1e-6, `unbend z at ${z}`); }
  // the game's landing (src/fx/shell-blast.js) on lane records, as the lab hands them to it: the struck body the peak, the rest the Bofors' falloff
  const { createShellBlast } = await import('../src/fx/shell-blast.js'), { SHELL_BLAST } = await import('../src/content/tank.js');
  const rec = (x, z, hp) => ({ x, z, pos: [x, 0, z], alive: true, hp });
  const recs = [rec(0, -40, 1), rec(0, -52, 4), rec(0, -80, 1)], died = [];
  const host = { enemies: recs, damageEnemy: (e, t, dmg) => { e.hp -= dmg; if (e.hp <= 0) { e.alive = false; died.push(e); } }, warnRing() {}, scene: { add() {} }, debris: [], sfx: { play() {} }, camDist: () => 0,
    explode: () => true, cellSide: () => 10, cellIndex: () => () => -1 };
  const out = createShellBlast(host).land([0, 0, -40], recs[0], 0, [0, 0, 0]);
  assert(!recs[0].alive, 'the struck body dies (4.5 against its 1)'); assert(recs[1].alive && recs[1].hp < 4 && recs[1].hp > 0, `12 m off: hurt, not killed (${recs[1].hp})`);
  assert(recs[2].alive && recs[2].hp === 1, '40 m off: outside the 30 m blast'); assert.equal(SHELL_BLAST.radius * 10, 30);
  assert(out.jolt > 0, 'a landing 40 m from the hull kicks it');
}
console.log('PASS the shell: the bent ground unbent exactly, the game\'s blast on the lane\'s records (the struck one dead, the falloff, the 30 m edge)');

// ---- the types ----
{
  const mix = canyonMix();
  close(mix.reduce((s, m) => s + m.share, 0), 1, 1e-9, 'the shares sum to one');
  for (const m of mix) { assert.equal(m.tier, PEARL_OF[m.type]); assert(PEARL_BODIES[m.type], `${m.type} has a Pearl body`); }
  assert(new Set(mix.map((m) => m.tier)).size >= 2, `the canyon again has more than one tier (${mix.map((m) => m.tier)})`);
  assert(mix.some((m) => PEARL_TIERS.find((t) => t.id === m.tier).cored), 'and a cored one');
  const t = seatTypes(1000, 'mix', { mix });
  for (const m of mix) close(t.filter((x) => x === m.type).length / 1000, m.share, 0.06, `${m.type} near its share`);
  assert.deepEqual(seatTypes(1000, 'mix', { mix }), t, 'deterministic');
  const white = seatTypes(10, 'white');
  assert.deepEqual([...new Set(white)].sort(), ['amoeba', 'phage'], 'a tier draws its own types in turn');
  for (const id of PEARL_TIERS.map((x) => x.id)) assert(seatTypes(4, id).every((x) => PEARL_OF[x] === id), `${id}: its own types`);
}
console.log('PASS the types: a tier\'s own in turn, the mix the canyon again\'s shares by tier (a cored tier among them)');

// ---- the knobs ----
{
  const u = () => ({ uNoise: { value: 0.15 }, uBreath: { value: 1.5 }, uTime: { value: 3 } });
  const g = () => ({ shadows: { visible: true }, levels: [{ core: { visible: true } }, { core: { visible: true } }, { core: null }] });
  const targets = () => ({ lod: { ...GAME_LOD, force: null }, uniforms: [u(), u()], geometry: [g(), g()] });
  const snap = (t) => JSON.parse(JSON.stringify(t));
  const base = targets(); applyKnobs(GAME_KNOBS, base);
  assert.deepEqual(snap(base), snap(targets()), 'the game\'s knobs change nothing');
  // each knob alone: exactly its own field differs from the game's
  const diff = (a, b, path = '') => {
    if (a === null || typeof a !== 'object') return a === b ? [] : [path];
    return [...new Set([...Object.keys(a), ...Object.keys(b ?? {})])].flatMap((k) => diff(a[k], b?.[k], `${path}.${k}`));
  };
  const one = (k, v) => { const t = targets(); applyKnobs({ ...GAME_KNOBS, [k]: v }, t); return diff(snap(t), snap(base)); };
  assert.deepEqual(one('high', 140), ['.lod.high']);
  assert.deepEqual(one('low', 30), ['.lod.low']);
  assert.deepEqual(one('highCap', 0), ['.lod.highCap']);
  assert.deepEqual(one('force', 2), ['.lod.force']);
  assert.deepEqual(one('lumps', false), ['.uniforms.0.uNoise.value', '.uniforms.1.uNoise.value']);
  assert.deepEqual(one('breath', false), ['.uniforms.0.uBreath.value', '.uniforms.1.uBreath.value']);
  assert.deepEqual(one('shadow', false), ['.geometry.0.shadows.visible', '.geometry.1.shadows.visible']);
  assert.deepEqual(one('core', false), ['.geometry.0.levels.0.core.visible', '.geometry.0.levels.1.core.visible', '.geometry.1.levels.0.core.visible', '.geometry.1.levels.1.core.visible']);
  assert.deepEqual(one('every', 4), [], 'the step rate is the lab\'s loop, not the drawing\'s');
  { const t = targets(); applyKnobs({ ...GAME_KNOBS, lumps: false }, t); assert.equal(t.uniforms[0].uNoise.value, 0); applyKnobs({ ...GAME_KNOBS, force: 1 }, t); assert.equal(t.lod.force, 1); }
  // RESET: the game's values back on a lod moved every way
  const lod = { ...GAME_LOD, high: 5, low: 50, highCap: 0, force: 0 };
  const k = resetKnobs(); applyKnobs(k, { lod });
  assert.deepEqual(lod, { ...GAME_LOD, force: null }, 'RESET restores the game\'s levels (CUTIS_LOD under PEARL_FOLLOW.lod)');
  assert.deepEqual(k, { ...GAME_KNOBS }); assert.notEqual(resetKnobs(), resetKnobs(), 'a fresh set each time');
  assert.equal(GAME_KNOBS.high, CUTIS_LOD.high); assert.equal(GAME_KNOBS.low, CUTIS_LOD.low); assert.equal(GAME_KNOBS.highCap, PEARL_FOLLOW.lod.highCap);
}
console.log('PASS the knobs: each sets exactly its own field, the game\'s set changes nothing, RESET restores the game\'s levels');

// ---- the geometry's forced level and its live lod ----
{
  const config = { ...DEFAULT_CONFIG, r0: 2.8 }, sw = new CutisSwarm(config, { capacity: 40 });
  for (let i = 0; i < 30; i++) { sw.count = Math.max(sw.count, i + 1); sw.place(i, (i % 6) * 8 - 20, -Math.floor(i / 6) * 25 - 5, 0); sw.active[i] = 1; sw.scale[i] = 1; }
  const lod = { ...GAME_LOD, force: null }, geo = createSwarmGeometry(sw, { planetR: GAME_PLANET_R, lod });
  const cam = new THREE.PerspectiveCamera(GAME_POSE.fov, 1.4, 0.1, 600); cam.position.fromArray(GAME_POSE.eye); cam.lookAt(...GAME_POSE.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const counts = () => { geo.update(cam, 900); return [...geo.lodCounts]; };
  const auto = counts(); assert.equal(auto.reduce((a, b) => a + b, 0), 30, 'every body counted once');
  for (const f of [0, 1, 2]) {
    lod.force = f; const c = counts(), drawn = 30 - c[3];
    assert.equal(c[f], drawn, `force ${f}: every drawn body at level ${f} (${c})`); assert.equal(c[3], auto[3], 'the culling unchanged');
  }
  lod.force = null; lod.highCap = 0; lod.high = 1; assert.equal(counts()[0], 0, 'the live high cap: none high');
  lod.highCap = 200; assert.equal(counts()[0], 30 - auto[3], 'every drawn body high at a 1 px threshold under a wide cap');
  lod.high = GAME_LOD.high; lod.highCap = GAME_LOD.highCap; assert.deepEqual(counts(), auto, 'the game\'s values back, the game\'s levels back');
  geo.dispose();
}
console.log('PASS the geometry: the lod object is read at every update, a forced level puts every drawn body there, culling untouched');

// ---- the sweep's table ----
{
  const rows = [
    { bodies: 100, step: 0.71, draw: 1.94, levels: [12, 40, 48, 0], tris: 612345, calls: 9 },
    { bodies: 300, step: 2.1, draw: 4.8, levels: [12, 80, 180, 28], tris: 1.1e6, calls: 9 },
    { bodies: 600, step: 4.44, draw: 9.1, levels: [12, 100, 400, 88], tris: 2.345e6, calls: 11 },
    { bodies: 1000, step: 7.0, draw: 15.55, levels: [12, 120, 700, 168], tris: 3.9e6, calls: 11 },
  ];
  const text = sweepTable(rows), lines = text.split('\n');
  assert.equal(lines.length, 5, 'a header and the four rows');
  assert.equal(lines[0], 'bodies  step ms  draw ms  high/mid/low/culled  tris   calls');
  assert.equal(lines[1], '100     0.7      1.9      12/40/48/0           0.6M   9');
  assert.equal(lines[4], '1000    7.0      15.6     12/120/700/168       3.9M   11');
  const at = (l, s) => l.indexOf(s);
  for (const l of lines.slice(1)) for (const head of ['step ms', 'draw ms', 'high/mid/low/culled', 'tris', 'calls']) {
    const k = at(lines[0], head); assert(l[k - 1] === ' ' && l[k] !== ' ', `fixed columns: ${head} in ${l}`);
  }
  assert(sweepTable([{ bodies: 1, step: 0, draw: 0, levels: [0, 1, 0, 0], tris: 13000, calls: 3 }]).includes('13k'), 'thousands under a tenth of a million');
}
console.log('PASS the sweep\'s table: fixed columns, the four rows, triangles in millions');

// ---- the family down the lane, as the lab drives it ----
{
  const parent = new THREE.Group(), lod = { ...GAME_LOD, force: null };
  const hubs = { count: 1, quat: () => null, reach: (hub, x, z, dx, dz, max) => laneReach(x, dx, max, PEARL_LANE.half) };
  const fam = createPearlFamily({ parent, tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: { ...PEARL_FOLLOW, lod }, pace: PEARL_PACE, gait: PEARL_GAIT, impact: PEARL_IMPACT, hubs });
  fam.setPlanet(GAME_PLANET_R);
  const n = 60, { seats, depth } = laneSeats(n, 1, 0.5, PEARL_LANE), types = seatTypes(n, 'mix');
  const recs = seats.map((s, i) => { const speed = pearlSpec(types[i]).speed * PEARL_GAIT.sectorPace * 10; return { ...s, x0: s.x, type: types[i], speed, h: fam.add(types[i], { x: s.x, z: s.z, angle: Math.PI / 2, speed }) }; });
  assert(recs.every((r) => r.h), 'every record seated');
  assert(recs.every((r) => r.speed > 0.5 && r.speed < 6), `the paced walks are a few metres a second (${recs.map((r) => r.speed.toFixed(1))})`);
  const cam = new THREE.PerspectiveCamera(GAME_POSE.fov, 1.4, 0.1, 600); cam.position.fromArray(GAME_POSE.eye); cam.lookAt(...GAME_POSE.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  // the lab's walk: every record at the hull (the origin); one already within the touch dies the game's death, and only its freed slot seats a new
  // body at the far end (the lab's two passes: the freed first, then the new bodies)
  const touchM = 6.84 * 4.6 / 3.4;
  recs[0].x = 0; recs[0].z = -1;
  let deaths = 0, reseated = 0, maxDying = 0;
  const dt = 1 / 60, frames = 60 * (CREATURE_DEATH.deflate + CREATURE_DEATH.fade + 1);
  for (let f = 0; f < frames; f++) {
    for (const r of recs) {
      if (r.dead) continue;
      [r.x, r.z] = walkToward(r.x, r.z, 0, 0, r.speed * fam.paceOf(r.h) * dt);
      if (touched(r.x, r.z, 0, 0, touchM)) { fam.kill(r.h); r.dead = true; deaths++; continue; }
      fam.track(r.h, { x: r.x, z: r.z, ax: 0, az: 0, dt, speed: r.speed });
    }
    fam.step(dt, cam, 900);
    const st = Object.values(fam.stats()), dying = st.reduce((s, x) => s + x.dying, 0), live = st.reduce((s, x) => s + x.live, 0);
    maxDying = Math.max(maxDying, dying);
    assert.equal(live + dying, n - recs.filter((r) => r.dead && !fam.view(r.h).active).length, 'a body is alive, dying, or its slot free and waiting');
    const freed = recs.filter((r) => r.dead && !fam.view(r.h).active);
    for (const r of freed) { r.x = r.x0; r.z = farSeat(0, PEARL_LANE, depth, 0.5); r.dead = false; r.h = fam.add(r.type, { x: r.x, z: r.z, angle: Math.PI / 2, speed: r.speed }); reseated++; }
  }
  assert(deaths >= 1 && maxDying >= 1, `the touched one died and was seen dying (${deaths}, ${maxDying})`);
  assert(reseated >= 1, 'its slot freed after the fade, a new body seated at the far end');
  assert(recs[0].z < -100, `the new body is at the far end (${recs[0].z})`);
  const st = Object.values(fam.stats()), live = st.reduce((s, x) => s + x.live, 0), counted = st.reduce((s, x) => s + x.lod.reduce((a, b) => a + b, 0), 0);
  const dyingNow = st.reduce((s, x) => s + x.dying, 0);
  assert.equal(live + dyingNow, n, 'the lane holds its count (alive and dying)'); assert.equal(counted, n, 'the levels plus culled are the bodies drawn, the dying included');
  assert(fam.geometries().length === st.length, 'one geometry a tier present');
  // the knobs reach every level's materials
  applyKnobs({ ...GAME_KNOBS, lumps: false }, knobTargets(fam.geometries(), lod));
  for (const g of fam.geometries()) for (const l of g.levels) { assert.equal(l.material.uniforms.uNoise.value, 0); if (l.coreMaterial) assert.equal(l.coreMaterial.uniforms.uNoise.value, 0); }
  for (const r of recs) fam.free(r.h);
  fam.dispose(); assert.equal(parent.children.length, 0);
}
console.log('PASS the family down the lane: the game\'s family on the planet, the records walking at the hull, the touched one dying the game\'s death, its slot reseated at the far end, the count held');

// ---- the bump in the lane (round three, owner 2026-10-14: "the bump impact with the creatures should be the same as the game") ----
// the game's hull contact (src/fx/hull-contact.js) on the lane's plane through the family: a white body ahead is brushed (the light tier's ram) and
// shoved clear, the hull losing next to nothing; a brown cored body stops the hull and pushes it back
{
  const run = (type) => {
    const parent = new THREE.Group(), hubs = { count: 1, quat: () => null, reach: (hub, x, z, dx, dz, max) => laneReach(x, dx, max, PEARL_LANE.half) };
    const fam = createPearlFamily({ parent, tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, pace: PEARL_PACE, gait: PEARL_GAIT, impact: PEARL_IMPACT, hubs });
    fam.setPlanet(GAME_PLANET_R);
    const rec = { x: 0, z: -16, type, spec: pearlSpec(type), alive: true };
    rec.h = fam.add(type, { x: 0, z: -16, angle: Math.PI / 2, speed: 0 }); rec.h.record = rec;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2.6)); mesh.scale.setScalar(4);   // a stand-in hull, 8 x 10.4 m
    let clock = 0, scrubbed = 0, pushMax = 0, dragMax = 0;
    const hits = [], hc = createLaneHull({ family: fam, mesh: () => mesh, heading: () => [0, 0, -1], now: () => clock, hit: (r, cored) => hits.push(cored) });
    const pos = [0, 0, 0], before = [0, 0, 0], dt = 1 / 60;
    for (let f = 0; f < 120; f++) {
      clock += dt; before[0] = pos[0]; before[2] = pos[2]; pos[2] -= 15 * dt;
      hc.bodyContact(before, pos, dt, (k) => { scrubbed += k; });
      pushMax = Math.max(pushMax, hc.lastPush()); dragMax = Math.max(dragMax, hc.drag());
      fam.step(dt, null, 900); hc.settle(pos);
    }
    const st = Object.values(fam.stats())[0];
    fam.dispose();
    return { rec, hits, scrubbed, pushMax, dragMax, z: pos[2], st };
  };
  const soft = run('amoeba');
  assert(soft.rec.bodyRam, 'the white body brushed: the light tier\'s ram'); assert(soft.hits.length >= 1 && soft.hits.every((c) => !c), 'booked soft');
  assert(soft.st.shoved > 0, `shoved clear (${soft.st.shoved})`); assert(soft.dragMax < 0.05, `the hull loses next to nothing (${soft.dragMax})`);
  const cored = run('rolling');
  assert(cored.hits.includes(true), 'booked cored'); assert(cored.dragMax >= PEARL_IMPACT.contact.cored, `the cored body takes the hull's speed (${cored.dragMax})`);
  assert(cored.pushMax > 0, `and pushes it back (${cored.pushMax} m)`); assert(cored.z > soft.z + 5, `the hull stopped short of where it ploughed through the soft one (${cored.z} vs ${soft.z})`);
  assert(cored.scrubbed >= 1, 'its run-up scrubbed whole');
}
console.log('PASS the bump in the lane: the game\'s hull contact through the family, a white body brushed and shoved, a cored one stopping the hull and pushing it back');
