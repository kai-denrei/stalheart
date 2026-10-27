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
  assert(UNIT_ENTRIES.some((e) => e.id === u.id && e.model.url === u.model && e.needs.always), `${u.id} in the terminal, open from the start`);
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
