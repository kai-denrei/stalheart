// companions.mjs — C-07 and RECKON K9 (owner, 2026-10-27): the pinned GLBs on disk match the lock and carry the clips the content names;
// the content's gaits are in speed order and within the lock's clips; the pure play rule wanders, dashes, plays tag (the roles swap on a
// tag, the game ends), greets the hull and never asks for a speed past a unit's top; gaitFor picks the band and clamps the rate.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COMPANIONS } from '../src/content/companions.js';
import { createPlay, stepPlay, gaitFor, MOVING } from '../src/domain/companion-play.js';
import { UNIT_ENTRIES } from '../src/content/bestiary.js';
import { GAME_FLAG_KEYS } from '../src/platform/game-flags.js';

const root = new URL('../', import.meta.url).pathname;
const lock = JSON.parse(readFileSync(root + 'docs/companions-assets.lock.json', 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(root + p)).digest('hex');
const clipsOf = (p) => { const b = readFileSync(root + p), j = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))); return (j.animations ?? []).map((a) => a.name); };

// 1. the assets: pinned, on disk, the clips there; the assets script reads the lock; the build packs every assets/models GLB
for (const f of lock.files) { assert(existsSync(root + f.path), `${f.path} on disk`); assert.equal(sha(f.path), f.sha256, `${f.path} matches its pin`); if (f.clips) assert.deepEqual(clipsOf(f.path), f.clips, `${f.path} carries its clips`); }
assert(readFileSync(root + 'scripts/assets.mjs', 'utf8').includes('docs/companions-assets.lock.json'), 'npm run assets:check reads the lock');
assert(GAME_FLAG_KEYS.includes('pets'), '?pets=0 is a game flag');
for (const u of COMPANIONS.units) {
  const pin = lock.files.find((f) => f.path === u.model), far = lock.files.find((f) => f.path === u.far);
  assert(pin && far, `${u.id}'s tiers pinned`);
  for (const c of [u.idle, u.sit, ...u.tricks, ...u.gaits.map((g) => g.clip)]) assert(pin.clips.includes(c), `${u.id} ${c} is a clip of the game tier`);
  for (let k = 1; k < u.gaits.length; k++) assert(u.gaits[k].mps > u.gaits[k - 1].mps && u.gaits[k].max > u.gaits[k - 1].max, `${u.id}'s gaits in speed order`);
  assert(u.top <= u.gaits[u.gaits.length - 1].max && u.top > u.gaits[0].max, `${u.id}'s top within its fastest gait's band`);
  assert(UNIT_ENTRIES.some((e) => e.id === u.id && e.model.url === u.model && e.needs.pet === u.id), `${u.id} in the terminal, on the books once Isao has printed it (2026-10-30)`);
}

// 2. gaitFor: the band and the clamp
const k9 = COMPANIONS.units[1];
const walk = gaitFor(k9.gaits, 0.4, COMPANIONS.rate); assert.equal(walk.clip, 'Walk_Cycle'); assert(Math.abs(walk.rate - 0.4 / 0.3571) < 1e-9, 'the walk at the rate of its speed over the clip\'s');
assert.equal(gaitFor(k9.gaits, 2.2, COMPANIONS.rate).clip, 'Run_Cycle');
assert.equal(gaitFor(k9.gaits, 5.5, COMPANIONS.rate).clip, 'Sprint_Cycle');
assert.equal(gaitFor(k9.gaits, 0.05, COMPANIONS.rate).rate, COMPANIONS.rate[0], 'a crawl plays no slower than the clamp');
assert.equal(gaitFor(k9.gaits, 20, COMPANIONS.rate).rate, COMPANIONS.rate[1], 'a flat-out run plays no faster than the clamp');

// 3. the play, stepped on a fake floor: the pair 10 m apart, a target reached 3 s after it is set, the hull 30 m off
function run({ seconds = 300, hull = true, seed = 3 } = {}) {
  let s = seed >>> 0; const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const st = createPlay(COMPANIONS.play), set = [0, 0], seen = new Set(), speeds = [0, 0], log = [];
  const ctx = { now: 0, rand, units: COMPANIONS.units.map((d) => ({ top: d.top, idle: d.idle, sit: d.sit, tricks: d.tricks })), dist: () => (st.game.on && ctx.now % 7 < 0.05 ? 1 : 10), toTarget: (i) => (ctx.now - set[i] > 3 ? 0.5 : 8), toHull: () => (hull ? (ctx.now % 11 < 0.05 ? 2 : 30) : null), blocked: () => false, clipSecs: () => 4 };
  for (let t = 0; t < seconds; t += 0.05) {
    ctx.now = t; stepPlay(st, 0.05, ctx);
    st.units.forEach((p, i) => { if (p.retarget) { p.retarget = false; set[i] = t; } seen.add(p.mode); speeds[i] = Math.max(speeds[i], p.speed); assert(p.speed <= COMPANIONS.units[i].top + 1e-9, `${i} never past its top`); assert(MOVING.has(p.mode) ? p.target : true, 'a move has a target'); });
    log.push(st.units.map((p) => p.mode).join('/'));
  }
  return { st, seen, speeds, log };
}
const { st, seen, speeds } = run();
for (const m of ['idle', 'wander', 'dash', 'chase', 'flee', 'sit', 'greet', 'greeted']) assert(seen.has(m), `the play reaches ${m} (saw ${[...seen].join(', ')})`);
assert(st.game.games >= 3 && st.game.tags >= 1, `games of tag played and a tag swapped the roles (${st.game.games} games, ${st.game.tags} tags)`);
assert(!st.game.on || st.units.some((p) => p.mode === 'chase'), 'a game on has a chaser');
assert(speeds[0] === COMPANIONS.units[0].top && speeds[1] === COMPANIONS.units[1].top, `both reach their top in a chase (${speeds})`);
const noHull = run({ hull: false }); assert(!noHull.seen.has('greet'), 'no hull: no greeting');
const a = run({ seed: 9 }).log.join(), b = run({ seed: 9 }).log.join(); assert.equal(a, b, 'the play is deterministic for a seed');
console.log(`Companions: ${lock.files.length} pinned files match, ${COMPANIONS.units.map((u) => `${u.id} ${u.gaits.length} gaits`).join(', ')}, the play reached ${seen.size} modes, ${st.game.games} games of tag, ${st.game.tags} tags`);
// 4. a pair too far apart for a game trots together first (target 'other'), and the game starts once near
{
  let s = 5; const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const st = createPlay(COMPANIONS.play), far = { v: 40 }, approached = [];
  const ctx = { now: 0, rand, units: COMPANIONS.units.map((d) => ({ top: d.top, idle: d.idle, sit: d.sit, tricks: d.tricks })), dist: () => far.v, toTarget: () => 8, toHull: () => null, blocked: () => false, clipSecs: () => 4 };
  for (let t = 0; t < 40; t += 0.05) { ctx.now = t; stepPlay(st, 0.05, ctx); if (st.units[0].target === 'other' && st.units[0].mode === 'wander') approached.push(t); if (t > 20) far.v = 10; }
  assert(approached.length && approached[0] < 10, `the pair trotted together when the game was due 40 m apart (first at ${approached[0]})`);
  assert(!st.game.on || ctx.now > 20, 'no game while far'); assert(st.game.games >= 1, 'the game began once near');
}
console.log('Companions: a far pair trots together before a game');
// 5. ISAO PRINTS THEM (2026-10-30): a unit not yet printed is left alone (its record idle, never stepped) and no game of tag starts with one alone
{
  let s = 11; const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const st = createPlay(COMPANIONS.play), present = [true, false], modes = new Set();
  const ctx = { now: 0, rand, units: COMPANIONS.units.map((d) => ({ top: d.top, idle: d.idle, sit: d.sit, tricks: d.tricks })), dist: () => 5, toTarget: () => 8, toHull: () => 30, blocked: () => false, clipSecs: () => 4, present: (i) => present[i] };
  for (let t = 0; t < 120; t += 0.05) { ctx.now = t; stepPlay(st, 0.05, ctx); modes.add(st.units[0].mode); assert.equal(st.units[1].mode, 'idle', 'the unprinted one stays as it was'); assert.equal(st.units[1].moves, 0); }
  assert.equal(st.game.games, 0, 'no game of tag alone'); assert(modes.has('wander') || modes.has('dash'), 'the printed one plays on its own');
  present[1] = true; for (let t = 120; t < 200; t += 0.05) { ctx.now = t; stepPlay(st, 0.05, ctx); }
  assert(st.game.games >= 1 && st.units[1].moves > 0, `both printed: the game and the second one's play (${st.game.games} games, ${st.units[1].moves} moves)`);
}
console.log('Companions: an unprinted unit stays out of the play; tag waits for both');
// 6. OUT OF THE TANK'S WAY (owner, 2026-11-02, round 4 note 5): a hull driven straight at a sitting unit on a flat floor never brings its point
// within 4 m of it (the 10 m hull's half width and the unit's: no drive-through; the spec asked 2 m) (the unit leaves the hull's line at its top speed, ramping at its own acceleration; 'fromHull' resolved as the scene does: off the line);
// a hull moving past, or parked, sends no one running; the greet waits for a hull that has stood still and breaks off when it moves
{
  const { hullThreat } = await import('../src/domain/companion-play.js'), KD = COMPANIONS.play.dodge;
  function drive({ unit = 1, hull0 = [-40, 0], vel = [12, 0], seconds = 8, lane = 0 } = {}) {
    let s = 21; const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
    const st = createPlay(COMPANIONS.play), def = COMPANIONS.units, pos = [[0, lane + 0.01], [30, 30]], spd = [0, 0], goal = [pos[0].slice(), pos[1].slice()], hull = hull0.slice();
    st.units[unit].mode = 'greeted'; st.units[unit].until = 1e9; st.units[unit].oneShot = def[unit].sit; st.units[1 - unit].mode = 'sit'; st.units[1 - unit].until = 1e9;
    if (unit === 1) { pos[1] = [0, lane + 0.01]; pos[0] = [30, 30]; }
    const motion = (i) => { const rx = pos[i][0] - hull[0], ry = pos[i][1] - hull[1], d = Math.hypot(rx, ry), sp = Math.hypot(...vel); if (sp < 1e-6) return { d, speed: 0, closing: 0, lateral: d }; const ux = vel[0] / sp, uy = vel[1] / sp, al = rx * ux + ry * uy; return { d, speed: sp, closing: d > 1e-9 ? (rx * vel[0] + ry * vel[1]) / d : sp, lateral: Math.sqrt(Math.max(0, d * d - al * al)) }; };
    const ctx = { now: 0, rand, units: def.map((d) => ({ top: d.top, trot: d.trot, idle: d.idle, sit: d.sit, tricks: d.tricks })), dist: () => 40, toTarget: (i) => Math.hypot(goal[i][0] - pos[i][0], goal[i][1] - pos[i][1]), toHull: (i) => motion(i).d, blocked: () => false, clipSecs: () => 4, hullMotion: motion };
    let min = Infinity, dodged = false; const dt = 1 / 30;
    for (let t = 0; t < seconds; t += dt) {
      ctx.now = 100 + t; stepPlay(st, dt, ctx);
      for (let i = 0; i < 2; i++) {
        const p = st.units[i];
        if (p.retarget) { p.retarget = false; if (p.target === 'fromHull') { const sp = Math.hypot(...vel) || 1, nx = -vel[1] / sp, ny = vel[0] / sp, side = Math.sign((pos[i][0] - hull[0]) * nx + (pos[i][1] - hull[1]) * ny) || 1; goal[i] = [pos[i][0] + side * nx * 12, pos[i][1] + side * ny * 12]; } else goal[i] = pos[i].slice(); }
        if (p.mode === 'dodge') dodged = true;
        const want = MOVING.has(p.mode) ? p.speed : 0; spd[i] = want > spd[i] ? Math.min(want, spd[i] + def[i].accel * dt) : Math.max(want, spd[i] - def[i].accel * 2 * dt);
        const gx = goal[i][0] - pos[i][0], gy = goal[i][1] - pos[i][1], gl = Math.hypot(gx, gy); if (gl > 0.05) { const step = Math.min(gl, spd[i] * dt); pos[i][0] += gx / gl * step; pos[i][1] += gy / gl * step; }
      }
      hull[0] += vel[0] * dt; hull[1] += vel[1] * dt; min = Math.min(min, motion(unit).d);
    }
    return { min, dodged, st };
  }
  for (const unit of [0, 1]) for (const v of [6, 12, 20, 30]) { const r = drive({ unit, vel: [v, 0] }); assert(r.dodged, `${COMPANIONS.units[unit].id} dodged a hull at ${v} m/s`); assert(r.min > 4, `${COMPANIONS.units[unit].id}: a hull at ${v} m/s never within 4 m (closest ${r.min.toFixed(2)} m)`); }
  { const r = drive({ unit: 1, hull0: [-5, 0], vel: [4, 0] }); assert(r.min > 2, `a hull starting 5 m off at 4 m/s (already on it as it moves off) never within 2 m (closest ${r.min.toFixed(2)} m)`); }
  { const r = drive({ unit: 1, vel: [12, 0], lane: 12 }); assert(!r.dodged, 'a hull passing 12 m to the side sends no one running'); }
  { const r = drive({ unit: 1, vel: [0, 0], hull0: [-4, 0] }); assert(!r.dodged && r.st.units[1].mode === 'greeted', 'a parked hull 4 m off: the unit stays sat'); }
  { const r = drive({ unit: 1, hull0: [10, 0], vel: [8, 0] }); assert(!r.dodged, 'a hull driving away: no one runs'); }
  assert(!hullThreat(null, KD) && !hullThreat({ d: 3, speed: 0.2, closing: 0.2, lateral: 0 }, KD) && hullThreat({ d: 5, speed: 2, closing: 2, lateral: 0 }, KD), 'the threat: moving and closing');
  // the greet waits for a hull that stood still stillS, and breaks off as it moves
  let s = 4; const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const st = createPlay(COMPANIONS.play), mv = { speed: 3 }, modes = [];
  const ctx = { now: 0, rand, units: COMPANIONS.units.map((d) => ({ top: d.top, idle: d.idle, sit: d.sit, tricks: d.tricks })), dist: () => 10, toTarget: () => 8, toHull: () => 30, blocked: () => false, clipSecs: () => 4, hullMotion: () => ({ d: 30, speed: mv.speed, closing: 0, lateral: 30 }) };
  for (let t = 0; t < 200; t += 0.05) { ctx.now = t; stepPlay(st, 0.05, ctx); modes.push(st.units.map((p) => p.mode)); }
  assert(!modes.flat().includes('greet'), 'a moving hull is never greeted');
  mv.speed = 0; let greetAt = null; for (let t = 200; t < 400 && greetAt == null; t += 0.05) { ctx.now = t; stepPlay(st, 0.05, ctx); if (st.units.some((p) => p.mode === 'greet')) greetAt = t; }
  assert(greetAt != null, 'a parked hull is greeted'); mv.speed = 2; ctx.now += 0.05; stepPlay(st, 0.05, ctx);
  assert(!st.units.some((p) => p.mode === 'greet'), 'and the greet breaks off as it moves');
}
console.log('Companions: out of the tank\'s way: a hull driven at a sitting unit at 6-30 m/s never within 4 m; the greet waits for a parked hull');
