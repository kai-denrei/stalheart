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
  if (u.pose === 'mech') {   // round 6, the mech: no clips; its motions are the runtime's (test/mech-pose.mjs holds the port)
    assert.deepEqual(pin.clips, [], `${u.id}'s game tier pinned with no clips`);
    const names = Object.values(u.rig.motions).map((m) => m.name);
    for (const c of [u.idle, u.sit, ...u.tricks, ...u.gaits.map((g) => g.clip)]) assert(names.includes(c), `${u.id} ${c} is a motion of its rig`);
    assert(u.top <= u.gaits[0].max && u.kind === 'heavy', `${u.id}: heavy, its top within its walk's band`);
  } else {
    for (const c of [u.idle, u.sit, ...u.tricks, ...u.gaits.map((g) => g.clip)]) assert(pin.clips.includes(c), `${u.id} ${c} is a clip of the game tier`);
    assert(u.top <= u.gaits[u.gaits.length - 1].max && u.top > u.gaits[0].max, `${u.id}'s top within its fastest gait's band`);
  }
  for (let k = 1; k < u.gaits.length; k++) assert(u.gaits[k].mps > u.gaits[k - 1].mps && u.gaits[k].max > u.gaits[k - 1].max, `${u.id}'s gaits in speed order`);
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
    const def = COMPANIONS.units, n = def.length, st = createPlay(COMPANIONS.play, n), pos = def.map((_, i) => (i === unit ? [0, lane + 0.01] : [30 + 20 * i, 30])), spd = def.map(() => 0), goal = pos.map((p) => p.slice()), hull = hull0.slice();
    st.units.forEach((p, i) => { if (i === unit) { p.mode = 'greeted'; p.oneShot = def[i].sit; } else p.mode = 'sit'; p.until = 1e9; });   // round 6: every unit, the one driven at greeted by the hull
    const motion = (i) => { const rx = pos[i][0] - hull[0], ry = pos[i][1] - hull[1], d = Math.hypot(rx, ry), sp = Math.hypot(...vel); if (sp < 1e-6) return { d, speed: 0, closing: 0, lateral: d }; const ux = vel[0] / sp, uy = vel[1] / sp, al = rx * ux + ry * uy; return { d, speed: sp, closing: d > 1e-9 ? (rx * vel[0] + ry * vel[1]) / d : sp, lateral: Math.sqrt(Math.max(0, d * d - al * al)) }; };
    const ctx = { now: 0, rand, units: def.map((d) => ({ top: d.top, trot: d.trot, idle: d.idle, sit: d.sit, tricks: d.tricks })), dist: () => 40, toTarget: (i) => Math.hypot(goal[i][0] - pos[i][0], goal[i][1] - pos[i][1]), toHull: (i) => motion(i).d, blocked: () => false, clipSecs: () => 4, hullMotion: motion };
    let min = Infinity, dodged = false; const dt = 1 / 30;
    for (let t = 0; t < seconds; t += dt) {
      ctx.now = 100 + t; stepPlay(st, dt, ctx);
      for (let i = 0; i < n; i++) {
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
  // the mech never dodges (round 6: section 9)
  for (const unit of COMPANIONS.units.map((_, i) => i).filter((i) => COMPANIONS.units[i].kind !== 'heavy')) for (const v of [6, 12, 20, 30]) { const r = drive({ unit, vel: [v, 0] }); assert(r.dodged, `${COMPANIONS.units[unit].id} dodged a hull at ${v} m/s`); assert(r.min > 4, `${COMPANIONS.units[unit].id}: a hull at ${v} m/s never within 4 m (closest ${r.min.toFixed(2)} m)`); }
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
// 7. DAY 42 ON THE DANCE FLOOR (owner, 2026-11-02, round 4 note 8): with the party on both go to the floor and alternate tricks, sits and short dashes,
// no game of tag starts and a running one ends, a hull driving at a dancer does not break the dance; the klaxon (the party off) ends it
{
  let s = 8; const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const st = createPlay(COMPANIONS.play), party = { on: false }, set = [0, 0], shots = [new Set(), new Set()], moves = [0, 0];
  const ctx = { now: 0, rand, units: COMPANIONS.units.map((d) => ({ top: d.top, idle: d.idle, sit: d.sit, tricks: d.tricks })), dist: () => 5, toTarget: (i) => (ctx.now - set[i] > 2 ? 0.5 : 8), toHull: () => 30, blocked: () => false, clipSecs: () => 2,
    hullMotion: () => ({ d: 5, speed: 6, closing: 6, lateral: 0 }), dancing: () => party.on };
  ctx.hullMotion = () => null;
  for (let t = 0; t < 30; t += 0.05) { ctx.now = t; stepPlay(st, 0.05, ctx); st.units.forEach((p, i) => { if (p.retarget) { p.retarget = false; set[i] = t; } }); }
  party.on = true; const games0 = st.game.games;
  for (let t = 30; t < 70; t += 0.05) {
    ctx.now = t; if (t > 50) ctx.hullMotion = () => ({ d: 5, speed: 6, closing: 6, lateral: 0 });
    stepPlay(st, 0.05, ctx);
    st.units.forEach((p, i) => { if (p.retarget) { p.retarget = false; set[i] = t; if (p.target === 'floor') moves[i]++; } if (t > 30.1) assert.equal(p.mode, 'dance', `unit ${i} dances through the party (t ${t.toFixed(2)})`); if (p.oneShot) shots[i].add(p.oneShot); });
  }
  assert.equal(st.game.on, false); assert.equal(st.game.games, games0, 'no game of tag during the party');
  for (let i = 0; i < 2; i++) { const u = COMPANIONS.units[i]; assert(shots[i].has(u.sit) && u.tricks.some((x) => shots[i].has(x)), `unit ${i}: tricks and sits (${[...shots[i]]})`); assert(moves[i] >= 4, `unit ${i}: dashes round the floor (${moves[i]})`); }
  party.on = false; ctx.hullMotion = () => null; ctx.now = 70; stepPlay(st, 0.05, ctx); assert(st.units.every((p) => p.mode !== 'dance'), 'the klaxon ends the dance');
}
console.log('Companions: DAY 42: both dance through the party (tricks, sits, dashes), no tag, the klaxon ends it');
// 8. THREE (round 6, 2026-11-05: K0-TECH): a game of tag is between two of the printed ones; the pair varies over a long run, every game's two are
// present, a running game's pair are the only chase/flee modes, the third keeps its own play meanwhile; K0-TECH walks in its own band (its walk
// is 0.24 m/s), never past its top; `with` names the other one of a game; one printed alone never starts a game; the dodge holds for the cat too
{
  const n = COMPANIONS.units.length, k0 = COMPANIONS.units.findIndex((u) => u.id === 'k0');
  assert(k0 >= 0 && COMPANIONS.units[k0].wander[1] <= COMPANIONS.units[k0].gaits[1].max, 'K0-TECH\'s own wander band sits on its walk');
  assert(COMPANIONS.units[k0].tricks.includes('Pounce') && !COMPANIONS.units[k0].gaits.some((g) => g.clip === 'Pounce'), 'Pounce is a trick, never a gait (1.6 m of root travel)');
  let s = 17; const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const st = createPlay(COMPANIONS.play, n), set = new Array(n).fill(0), present = COMPANIONS.units.map(() => true), pairs = new Set(), wanders = [];
  const ctx = { now: 0, rand, units: COMPANIONS.units.map((d) => ({ top: d.top, trot: d.trot, wander: d.wander, heavy: d.kind === 'heavy', idle: d.idle, sit: d.sit, tricks: d.tricks })), dist: () => (st.game.on && ctx.now % 7 < 0.05 ? 1 : 10), toTarget: (i) => (ctx.now - set[i] > 3 ? 0.5 : 8), toHull: () => 30, blocked: () => false, clipSecs: () => 4, present: (i) => present[i] };
  for (let t = 0; t < 900; t += 0.05) {
    ctx.now = t; stepPlay(st, 0.05, ctx);
    if (st.game.on) { const [a, b] = st.game.pair; pairs.add(`${a}${b}`); assert(a !== b && present[a] && present[b], 'a game of two present ones');
      st.units.forEach((p, i) => { if (i !== a && i !== b) assert(p.mode !== 'chase' && p.mode !== 'flee', `unit ${i} out of the game ${a}-${b} keeps its own play`); });
      assert.equal(st.units[a].mode === 'chase' || st.units[a].mode === 'flee' ? st.units[a].with : b, b, 'with names the other one'); }
    st.units.forEach((p, i) => { if (p.retarget) { p.retarget = false; set[i] = t; if (i === k0 && p.mode === 'wander' && p.target === 'pick') wanders.push(p.speed); } assert(p.speed <= COMPANIONS.units[i].top + 1e-9, `${i} never past its top`); });
  }
  assert(pairs.size >= 2, `the pair varies over three (${[...pairs]})`); assert(st.game.games >= 6, `games played (${st.game.games})`);
  const [lo, hi] = COMPANIONS.units[k0].wander; assert(wanders.length && wanders.every((v) => v >= lo - 1e-9 && v <= hi + 1e-9), `K0-TECH wanders in its band (${wanders.length} walks)`);
  const lone = createPlay(COMPANIONS.play, n); for (let t = 0; t < 200; t += 0.05) { ctx.now = t; ctx.present = (i) => i === k0; stepPlay(lone, 0.05, ctx); } assert.equal(lone.game.games, 0, 'one printed alone: no game');
  console.log(`Companions: three: ${st.game.games} games over pairs ${[...pairs].join(', ')}, K0-TECH's ${wanders.length} walks in ${lo}-${hi} m/s`);
}
// 9. THE HEAVY ONE (round 6, the Nih-Dairia mech): never in a game of tag, never dodging a hull bearing down on it, never dancing (it rests where
// it is through the party); it walks within its top, sits (the anchor, held its motion's 8 s and more) and reaches; once the hull has stood still
// heavy.greet.stillS it walks to it and anchors heavy.greet.nearM off, up as the hull moves; a hull moving is never greeted
{
  const n = COMPANIONS.units.length, mi = COMPANIONS.units.findIndex((u) => u.kind === 'heavy'), H = COMPANIONS.play.heavy, mu = COMPANIONS.units[mi];
  assert(mi >= 0 && H.greet.nearM * 1 > (mu.keepFromHull ?? 0), 'it greets outside its own keep-off');
  let s = 29; const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
  const st = createPlay(COMPANIONS.play, n), set = new Array(n).fill(0), hull = { d: 40, speed: 0, closing: 0 }, party = { on: false }, modes = new Set(), sitAt = [];
  const secs = (i, name) => (i === mi ? mu.rig.motions[Object.keys(mu.rig.motions).find((k) => mu.rig.motions[k].name === name)]?.secs ?? 2 : 4);
  const ctx = { now: 0, rand, units: COMPANIONS.units.map((d) => ({ top: d.top, trot: d.trot, wander: d.wander, heavy: d.kind === 'heavy', idle: d.idle, sit: d.sit, tricks: d.tricks })), dist: () => 10,
    toTarget: (i) => (ctx.now - set[i] > 3 ? 0.5 : 8), toHull: (i) => (i === mi ? hull.d : 30), blocked: () => false, clipSecs: secs, dancing: () => party.on,
    hullMotion: (i) => ({ d: i === mi ? hull.d : 30, speed: hull.speed, closing: hull.closing, lateral: 0 }) };
  for (let t = 0; t < 1200; t += 0.05) {
    ctx.now = t;
    if (t > 300 && t < 320) { hull.speed = 8; hull.closing = 8; hull.d = Math.max(2, 40 - (t - 300) * 8); } else if (t >= 320 && t < 330) { hull.speed = 0; hull.closing = 0; hull.d = 40; }   // driven straight at it, then parked again
    party.on = t > 900 && t < 960;
    stepPlay(st, 0.05, ctx); const p = st.units[mi]; modes.add(p.mode);
    if (p.retarget) { p.retarget = false; set[mi] = t; }
    if (p.mode === 'greet' && hull.d > H.greet.nearM && hull.speed === 0) hull.d = Math.max(H.greet.nearM - 1, hull.d - p.speed * 0.05);   // it closes on the parked hull
    assert(!['chase', 'flee', 'dodge', 'dance', 'dash'].includes(p.mode), `the mech never ${p.mode}s (t ${t.toFixed(1)})`); assert(p.speed <= mu.top + 1e-9, 'within its top');
    if (party.on && t > 900.1) assert(!MOVING.has(p.mode), `it watches the party (t ${t.toFixed(1)}, ${p.mode})`);
    if (p.mode === 'greeted' && !sitAt.length) sitAt.push(t, hull.d);
    assert(!st.game.on || !st.game.pair.includes(mi), 'never in a game of tag');
  }
  for (const m of ['idle', 'wander', 'sit', 'trick', 'greet', 'greeted']) assert(modes.has(m), `the mech reaches ${m} (saw ${[...modes]})`);
  assert(sitAt.length && sitAt[1] < H.greet.nearM && sitAt[1] >= H.greet.nearM - 1, `it anchored ${sitAt[1]?.toFixed(1)} m off the parked hull`);
  console.log(`Companions: the mech walks, anchors, reaches and greets a parked hull ${H.greet.nearM} m off; never tags, dodges or dances (${[...modes].join(', ')})`);
}
