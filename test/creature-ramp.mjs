import assert from 'node:assert/strict';
import { makeRamp, stepRamp, rampResult, percentile, parseCreatures, shareOf, spreadPicks } from '../src/domain/creature-ramp.js';
import { CREATURE_TIERS, CREATURE_PROBE, CREATURE_FOLLOW, tierSize } from '../src/content/creature-enemies.js';
import { ENEMY_SPEC, CREATURE_TINTS } from '../src/enemyspec.js';
// THE CREATURE PROBE'S RAMP and the tier table (src/domain/creature-ramp.js, src/content/creature-enemies.js)
const tune = { step: 10, hold: 2, settle: 0.5, span: 1, thresholdMs: 16.7, overSeconds: 3, hardCap: 100, startDelay: 1 };
// a machine whose frame costs 8 ms + 0.25 ms a body: 16.7 ms at ~35 bodies
const run = (cost, t = tune, dt = 1 / 60) => { const r = makeRamp(t); let alive = 0; for (let i = 0; i < 60 * 600 && r.phase !== 'done'; i++) { stepRamp(r, { dt, ms: cost(alive), alive }); if (r.phase === 'ramping') alive = r.target; } return r; };
{
  const r = run((n) => 8 + n * 0.25), res = rampResult(r);
  assert.equal(res.phase, 'done'); assert.equal(res.reason, 'over budget');
  assert.equal(res.fits, 30, 'the last step within budget'); assert.equal(res.maxAlive, 50, 'over budget must hold overSeconds (3 s), longer than a hold (2 s): one step past the first over'); assert.ok(res.frameMean > 16.7);
  assert.ok(res.steps.every((s, i) => s.target === 10 * (i + 1)), 'a step of `step` bodies each hold');
  assert.equal(res.steps[0].mean, 10.5); assert.equal(res.steps[0].p95, 10.5);
}
{ const res = rampResult(run(() => 5)); assert.equal(res.reason, 'hard cap'); assert.equal(res.maxAlive, 100); assert.equal(res.fits, 100); }
{ const r = makeRamp({ ...tune, maxSeconds: 5 }); for (let i = 0; i < 1000 && r.phase !== 'done'; i++) stepRamp(r, { dt: 0.05, ms: 400 }); assert.equal(r.reason, 'time', 'gaps are not frames; the time limit ends it'); }
{ const r = makeRamp(tune); stepRamp(r, { dt: 0.5, ms: 10 }); assert.equal(r.phase, 'waiting'); stepRamp(r, { dt: 0.6, ms: 10 }); assert.equal(r.phase, 'ramping'); assert.equal(r.target, 10); }
// a hitch shorter than overSeconds does not end it
{ const r = makeRamp(tune); let i = 0; for (; i < 60 * 30 && r.phase !== 'done'; i++) stepRamp(r, { dt: 1 / 60, ms: i % 600 < 120 ? 30 : 8, alive: r.target }); assert.notEqual(r.reason, 'over budget'); }
assert.equal(percentile([5, 1, 3, 2, 4], 0.95), 5); assert.equal(percentile([5, 1, 3, 2, 4], 0.5), 3); assert.equal(percentile([], 0.95), 0);

// ?creatures
assert.deepEqual(parseCreatures('cutis:huge', CREATURE_TIERS), { family: 'cutis', tier: 'huge' });
assert.deepEqual(parseCreatures('CUTIS', CREATURE_TIERS), { family: 'cutis', tier: 'small' });
assert.equal(parseCreatures('cutis:giant', CREATURE_TIERS), null); assert.equal(parseCreatures(null, CREATURE_TIERS), null); assert.equal(parseCreatures('', CREATURE_TIERS), null);
assert.equal(shareOf(40, { share: 0.5 }), 20); assert.equal(shareOf(1, { share: 0.5 }), 1); assert.equal(shareOf(200, { share: 0.5, max: 40 }), 40);
assert.equal(shareOf(40, { count: 3 }), 3); assert.equal(shareOf(2, { count: 3 }), 2); assert.equal(shareOf(0, { count: 1 }), 0);
assert.deepEqual(spreadPicks(10, 2), [2, 7]); assert.deepEqual(spreadPicks(3, 5), [0, 1, 2]); assert.deepEqual(spreadPicks(5, 0), []);
assert.equal(new Set(spreadPicks(100, 50)).size, 50, 'distinct');

// the tiers: both families, four sizes growing, hit points growing with size, the probe's knobs sane
for (const family of ['cutis', 'reed']) {
  const tiers = CREATURE_TIERS[family], keys = ['small', 'medium', 'big', 'huge'];
  assert.deepEqual(Object.keys(tiers), keys, family);
  for (let i = 1; i < 4; i++) { assert.ok(tiers[keys[i]].r0 > tiers[keys[i - 1]].r0, `${family} sizes grow`); assert.ok(tiers[keys[i]].hp > tiers[keys[i - 1]].hp, `${family} hp grows`); }
  for (const k of keys) { const t = tiers[k]; assert.ok(t.speed > 0 && t.bounty > 0 && t.probeStep >= 1 && t.capacity >= t.probeStep && t.count && tierSize(t) > 0, `${family}:${k}`); }
  assert.ok(ENEMY_SPEC[family].shelved && !ENEMY_SPEC[family].rammable && ENEMY_SPEC[family].body === family && CREATURE_TINTS[family] !== undefined, `${family} spec`);
  assert.ok(tiers.small.hp >= 2 && tiers.small.hp <= 3, 'small: a mid enemy'); assert.ok(tiers.huge.hp >= 9 * 5, 'huge: well past the jelly boss, a 40 m body');
}
for (const k of Object.keys(CREATURE_TIERS.cutis)) assert.equal(CREATURE_TIERS.cutis[k].config.r0, CREATURE_TIERS.cutis[k].r0, 'the kit draws the tier\'s radius');
assert.deepEqual([CREATURE_TIERS.cutis.small.r0, CREATURE_TIERS.cutis.medium.r0, CREATURE_TIERS.cutis.big.r0, CREATURE_TIERS.cutis.huge.r0], [1.5, 4, 8, 20], 'the spec\'s Cutis radii');
assert.equal(CREATURE_PROBE.thresholdMs, 16.7); assert.ok(CREATURE_PROBE.hardCap >= 2000 && CREATURE_PROBE.overSeconds > 0 && CREATURE_PROBE.hold > CREATURE_PROBE.settle);
assert.ok(CREATURE_FOLLOW.fastest > 0 && CREATURE_FOLLOW.fastest < 1 && CREATURE_FOLLOW.leashRadii >= 3);
console.log('Creature ramp: steps until the frame stays over budget (the last fitting step reported), gaps are not frames, ?creatures parsed, wave shares, the tier table.');
