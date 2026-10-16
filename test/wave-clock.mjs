// wave-clock.mjs — the wave clock (src/domain/wave-clock.js, refactor round 2): (a) its named transitions; (b) the frame's wave
// block as src/td-tab.js has it now, run over the module for 200 seeded frames against the six values the ORIGINAL inline block
// produced on the same frames (kept below; the side-by-side proof of the move ran 20,000 frames, see the commit).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createWaveClock } from '../src/domain/wave-clock.js';

// (a) THE TRANSITIONS
{
  const c = createWaveClock({ warn: 3 });
  assert.deepEqual(c.state(), { in: -1, charge: 0, beat: 0, inter: 0, age: 0, active: false }, 'a fresh clock is idle: nothing armed, nothing live');
  assert.equal(c.secsToWave(7, () => true), 7, 'idle with a live gate: the whole gap');
  assert.equal(c.secsToWave(7, () => false), Infinity, 'no live gate: no wave coming');
  assert.equal(c.setIn(3), 3, 'a setter returns the written value');
  assert.equal(c.secsToWave(7, () => { throw new Error('the gates are not asked while armed'); }), 3, 'armed: the countdown');
  assert.equal(c.countdown(0.25), true, 'the first beat rings at once (the beat starts at 0)');
  assert.ok(Math.abs(c.charge() - 0.25 / 3) < 1e-12, 'the charge fills over the warning');
  assert.ok(Math.abs(c.state().beat - (0.72 - 0.54 * 0.25 / 3)) < 1e-12, 'the next beat is due in about 0.7 s');
  assert.deepEqual([c.countdown(0.25), c.countdown(0.25), c.countdown(0.25)], [false, false, true], 'the second ring when that beat runs out');
  assert.ok(Math.abs(c.state().beat - (0.72 - 0.54 / 3)) < 1e-12, 'the beats come sooner as the charge climbs');
  assert.equal(c.due(), false);
  assert.equal(c.countdown(2), true);
  assert.equal(c.charge(), 1, 'full charge at zero');
  assert.equal(c.due(), true, 'due at zero');
  c.disarm(); assert.equal(c.in(), -1);
  c.setActive(true); c.setAge(0); c.grow(2.5);
  assert.equal(c.age(), 2.5); assert.equal(c.stalled(3), false); c.grow(0.5); assert.equal(c.stalled(3), true, 'stalled at the cap');
  assert.equal(c.secsToWave(7, () => true), Infinity, 'a live wave: no next wave yet');
  c.setInter(4); c.setCharge(0.5); c.clear();
  assert.deepEqual([c.active(), c.inter(), c.charge()], [false, 0, 0], 'a cleared field: not live, the gap restarts, no charge');
  c.wait(3.9); assert.equal(c.readyToArm(7), false); c.wait(0.1); assert.equal(c.readyToArm(7), true, 'armed when the gap has the warning left');
  assert.ok(Math.abs(c.secsToWave(7, () => true) - 3) < 1e-12, 'what is left of the gap');
  c.setCharge(0.4); c.idle(); assert.equal(c.charge(), 0, 'idle drops the charge');
}

// (b) THE FRAME'S BLOCK over the module, 200 seeded frames
const td = fs.readFileSync(new URL('../src/td-tab.js', import.meta.url), 'utf8').split('\n');
const s0 = td.findIndex((l) => l.includes('if (waveClock.in() >= 0) {')), s1 = td.findIndex((l, i) => i > s0 && l.includes("sfx.play('boss_tension')"));
assert.ok(s0 > 0 && s1 > s0 && s1 - s0 < 40, 'the frame\'s wave block is found in src/td-tab.js');
const BLOCK = td.slice(s0, s1 + 2).join('\n');
const SECS = td.find((l) => l.includes('function secsToWave()'));
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(13), log = [];
const L = (name) => (...a) => log.push([name, ...a]);
let points = 0;
const E = {
  spawnPoints: [{ ci: 3, type: 'reed', alive: true }, { ci: 7, type: 'pearl', alive: true }], warnRing: L('warnRing'), spawnQueue: [], enemies: [],
  automated: () => E.auto, fillFromWaveClear: L('fillFromWaveClear'), score: { get points() { return points; }, addWave: (w) => { log.push(['addWave', w]); points += w; } },
  persistBest: L('persistBest'), simStyle: false, simCurve: [], storyMode: false, sectorWave: () => E.wave % 4, params: { waveCap: 1.5, waveGap: 2.5, wavesPerSector: 3 },
  programmeSpent: L('programmeSpent'), showBrief: L('showBrief'), showSitrep: L('showSitrep'), lab: { on: false, holdWaves: false }, wave: 0, t: 0, heartHP: 50,
  eco: { biomass: 1 }, towers: [], BOSS_WAVE: 3, buildFrozen: () => false, sfx: { play: L('sfx') }, gunshipRig: { call: 0 }, GUNSHIP_CALL: 0,
  CREATURE_TINTS: { reed: 1 }, cellSide: 2, sectorRun: null, auto: true, spent: false,
};
// enemy-step's armWave and spawnWave, as far as they touch the clock (src/fx/enemy-step.js)
const run = new Function('E', 'createWaveClock', 'WAVE_WARN', 'log', `const waveClock = createWaveClock({ warn: WAVE_WARN }); let bossCued = false;
  function spawnWave() { log.push(['spawnWave']); waveClock.setIn(-1); waveClock.setCharge(0); waveClock.setBeat(0); E.wave += 1; waveClock.setActive(true); waveClock.setAge(0); }
  function armWave() { log.push(['armWave']); if (E.storyMode && !E.auto) return; if (E.spent) return; if (waveClock.in() >= 0) return; waveClock.setIn(WAVE_WARN); waveClock.setBeat(0); waveClock.setCharge(0); }
  with (E) { ${SECS} }
  return { step(dt) { with (E) { ${BLOCK} } }, breach() { waveClock.setIn(-1); armWave(); }, vals: () => Object.values(waveClock.state()) };`);
const clock = run(E, createWaveClock, 3, log);
const seen = [];
for (let i = 0; i < 200; i++) {
  if (i % 20 === 0) {
    E.spawnPoints[0].alive = rnd() < 0.8; E.spawnPoints[1].alive = rnd() < 0.5; E.spawnQueue.length = rnd() < 0.4 ? 1 : 0;
    E.enemies.length = 0; E.enemies.push({ alive: rnd() < 0.4, guard: false }); E.storyMode = rnd() < 0.25; E.auto = rnd() < 0.5; E.spent = rnd() < 0.2;
  }
  if (i === 57 || i === 131) clock.breach();
  const dt = 1 / 30 + rnd() / 20;
  E.t += dt; clock.step(dt);
  if (i % 10 === 9) seen.push(clock.vals().map((v) => (typeof v === 'number' ? +v.toFixed(6) : v)));
}
// [in, charge, beat, inter, age, active] every tenth frame, from the original inline block on the same frames
const KEPT = [
  [-1, 0, 0, 0.591279, 0, false],
  [-1, 0, 0, 1.132419, 0, false],
  [2.564247, 0.145251, 0.326559, 1.612526, 0, false],
  [2.039314, 0.320229, 0.413022, 2.137459, 0, false],
  [1.411196, 0.529601, 0.259993, 2.137459, 0, false],
  [-1, 0, 0.176309, 2.137459, 0, false],
  [-1, 0, 0.176309, 2.738085, 0, false],
  [-1, 0, 0.176309, 3.309616, 0, false],
  [2.541867, 0.152711, 0.290553, 3.845045, 0, false],
  [1.935132, 0.354956, 0.321697, 4.451779, 0, false],
  [1.323873, 0.558709, 0.182921, 5.063038, 0, false],
  [0.679064, 0.773645, 0.302232, 5.707847, 0, false],
  [0.045181, 0.98494, 0.188133, 6.34173, 0, false],
  [2.475785, 0.174738, 0.243739, 6.34173, 0.570035, true],
  [1.853296, 0.382235, 0.259988, 0.571539, 0.620986, false],
  [1.33448, 0.555173, 0.213971, 1.090355, 0.620986, false],
  [0.691621, 0.76946, 0.005794, 1.733214, 0.620986, false],
  [0.107798, 0.964067, 0.056742, 2.317036, 0.620986, false],
  [-1, 0, 0, 0.480897, 0.049975, false],
  [-1, 0, 0, 1.044175, 0.049975, false],
];
assert.deepEqual(seen, KEPT, 'the frame over the module keeps the original block\'s six values');
assert.deepEqual(
  ['warnRing', 'spawnWave', 'armWave', 'addWave', 'showSitrep'].map((k) => log.filter((x) => x[0] === k).length), [25, 2, 116, 2, 2],
  'the rings, the spawns, the arms, the clears and the sitreps of the original block');
console.log('Wave clock: one state with named transitions; the frame\'s block over it keeps the original six values for 200 frames.');
