// boss-emerge.mjs — pulling out of the ground (owner, 2026-10-10: "both the smaller Reeds and the larger boss emerge as if from an elevator, it looks unnatural.
// let's have them emerge by stretching their limbs, as if they were pulling themselves out from the depth"; src/domain/boss-emerge.js, src/labs/boss/pull-out.js).
// The rule: the phases in order with a hold that ramps in and out, a haul whose lift never goes back and ends at 1, the arms going up before out and one after
// another, the grip on the lip along each arm's own way to the rim. The drive, on the kit's own Reed and boss in node (the kit's solver and behaviour, its wasm
// kernel): out of a hole as the lab lays it out (the Reed 4 m off the centre of a 10 m hole, the boss on the centre of a 20 m one), each arm's tips over the
// surface before the torso, the torso over it within the emergence's time, the tips planted on the lip through the haul, the body where it started, nothing
// non-finite and no node faster than a bound; after it the kit's own step again. Reeds at 240 and 120 Hz (the wave's coarse step).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOSS_FIGHT } from '../src/content/boss-fight.js';
import { emergence, armReach, haulLift, rimReach, gripRadius } from '../src/domain/boss-emerge.js';
import { createPullOut } from '../src/labs/boss/pull-out.js';
import { parseCage } from '../src/fx/nih-dairia/cage-model.js';
import { SoftBody } from '../src/fx/nih-dairia/soft-body.js';
import { MonsterBehavior } from '../src/fx/nih-dairia/behavior.js';
import { PHYS } from '../src/fx/nih-dairia/constants.js';
import { DEFAULT_MOTION } from '../src/fx/nih-dairia/motion-settings.js';

const W = BOSS_FIGHT.wave, E = W.emerge, EB = { ...E, ...E.boss };
const SPEED_MAX = 3;   // native metres a second: no node thrown (a Reed walking reaches ~1 at 240 Hz)

// the content: the owner's times (a ~2 s haul for a Reed, ~3.5 s for the boss)
assert.ok(E.haul === 2 && EB.haul === 3.5 && E.reach < E.haul && EB.reach < EB.haul, 'the Reeds haul ~2 s, the boss ~3.5 s, each after a shorter reach');

// the phases in order, the hold ramping in over the reach's first `ramp` and out over the release, the lift 0 until the haul and 1 after it
for (const T of [E, EB]) {
  const order = [], end = T.lead + T.reach + T.haul + T.release;
  let last = -1, lastPhase = null;
  for (let a = -0.5; a < end + 0.5; a += 0.01) {
    const e = emergence(a, T);
    if (e.phase !== lastPhase) { order.push(e.phase); lastPhase = e.phase; }
    assert.ok(e.lift >= last - 1e-12, `the lift never goes back (${a.toFixed(2)} s)`); last = e.lift;
    assert.ok(e.hold >= 0 && e.hold <= 1 && e.lift >= 0 && e.lift <= 1);
    if (e.phase === 'below' || e.phase === 'tremor' || e.phase === 'reach') assert.equal(e.lift, 0, 'nothing lifted before the haul');
    if (e.phase === 'haul') assert.equal(e.hold, 1, 'the arms grip all through the haul');
  }
  assert.deepEqual(order, ['below', 'tremor', 'reach', 'haul', 'release', 'up']);
  assert.equal(emergence(NaN, T).phase, 'below', 'no clock yet: below');
  assert.ok(emergence(T.lead + 1e-6, T).hold < 0.01 && emergence(T.lead + T.reach * T.ramp, T).hold === 1, 'the grip ramps in');
  assert.deepEqual(emergence(end + 1e-9, T), { phase: 'up', k: 1, lift: 1, hold: 0 });
  assert.ok(Math.abs(haulLift(1, T) - 1) < 1e-12 && haulLift(0, T) === 0, 'the haul from 0 to 1');
}
// the surges: the haul's speed dips between heaves (two for a Reed)
{
  const v = []; for (let k = 0.005; k < 1; k += 0.01) v.push(haulLift(k + 0.005, E) - haulLift(k - 0.005, E));
  const peaks = v.filter((x, i) => i > 0 && i < v.length - 1 && x > v[i - 1] && x >= v[i + 1]).length;
  assert.equal(peaks, E.heaves, `${E.heaves} surges in a Reed's haul`);
}
// an arm goes up before it goes out; the arms one after another; all out by the reach's end
{
  const a0 = armReach(0.2, 0, 4, E);
  assert.ok(a0.up > 0.3 && a0.out < 0.1, `up first (${JSON.stringify(a0)})`);
  assert.ok(armReach(0.3, 0, 4, E).up > armReach(0.3, 3, 4, E).up, 'the first arm ahead of the last');
  for (let i = 0; i < 4; i++) { const a = armReach(1, i, 4, E); assert.ok(a.up === 1 && a.out === 1 && Math.abs(a.over) < 1e-9, `arm ${i} out and down on the lip at the reach's end`); }
}
// the rim along an arm's own way; the grip past the lip, at least just past the rest, at most `stretch` of it
{
  assert.ok(Math.abs(rimReach([0, 0], [1, 0], [0, 0], 10) - 10) < 1e-9);
  assert.ok(Math.abs(rimReach([4, 0], [1, 0], [0, 0], 10) - 6) < 1e-9 && Math.abs(rimReach([4, 0], [-1, 0], [0, 0], 10) - 14) < 1e-9, 'off centre: nearer on its side');
  assert.equal(rimReach([20, 0], [1, 0], [0, 0], 10), null, 'outside, looking away: no rim ahead');
  assert.ok(Math.abs(gripRadius(10, 7, E) - 10 * E.lip) < 1e-9);
  assert.equal(gripRadius(1, 7, E), 7 * 1.05, 'never inside its rest');
  assert.equal(gripRadius(100, 7, E), 7 * E.stretch, 'never past its stretch');
}

// the kit's own bodies pulled out of a hole as the lab lays it out
const load = (name) => {
  const bytes = readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.bin`, import.meta.url));
  return parseCage(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), JSON.parse(readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.json`, import.meta.url), 'utf8')));
};
function pullOut({ name, T, size, off, hole, hz }) {
  const body = new SoftBody(load(name)), phys = { ...PHYS, step: 1 / hz }; body.phys = phys;
  const motion = new MonsterBehavior(body, { ...DEFAULT_MOTION }); motion.active = false;
  const kit = { body, motion }, h = phys.step;
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < body.rest.length; i += 3) { y0 = Math.min(y0, body.rest[i + 1]); y1 = Math.max(y1, body.rest[i + 1]); x0 = Math.min(x0, body.rest[i]); x1 = Math.max(x1, body.rest[i]); }
  const height = y1 - Math.min(0, y0), s = size / (x1 - x0), depth = T.depth * height;
  const step = () => { motion.step(h); body.step(h); if (!body.isFinite()) throw Error(`${name}: non-finite`); };
  for (let i = 0; i < hz / 2; i++) step();   // settled on its floor
  const pull = createPullOut(kit), start = [motion.center.x, motion.center.z];
  // the creature `off` m east of the hole's centre: the hole's centre at local [-off, 0] from its own
  const grips = pull.aim([start[0] * s, start[1] * s], s, [start[0] * s - off, start[1] * s], hole, T);
  const end = T.lead + T.reach + T.haul + T.release, log = [];
  let tipOver = null, torsoOver = null, peak = 0, planted = Infinity, ms = 0, n = 0;
  for (let a = 0; a < end + 0.5; a += h) {
    const e = emergence(a, T);
    let surface = depth * (1 - e.lift);
    if (e.phase === 'reach' || e.phase === 'haul' || e.phase === 'release') {
      if (!pull.active()) pull.begin(start, grips, T.drive);
      surface = pull.frame(e, depth, height, T);
    } else if (e.phase === 'up' && pull.active()) pull.end();
    const t0 = performance.now(); step(); ms += performance.now() - t0; n++;
    const r = pull.read(surface);
    peak = Math.max(peak, r.speed);
    if (tipOver === null && r.tip > 0) tipOver = a;
    if (torsoOver === null && r.torso > 0) torsoOver = a;
    if (e.phase === 'haul' && e.k > 0.2) planted = Math.min(planted, r.tip);   // the tips on the lip through the haul
    log.push(r);
  }
  return { name, hz, grips: grips.map((g) => +(g * s).toFixed(1)), rest: pull.arms.map((a) => +(a.rest * s).toFixed(1)), tipOver, torsoOver, end, peak, planted: planted * s, height: height * s,
    drift: Math.hypot(motion.center.x - start[0], motion.center.z - start[1]) * s, restored: !Object.hasOwn(motion, 'step'), msPerStep: ms / n };
}
const runs = [
  pullOut({ name: 'reed', T: E, size: W.size, off: E.jitter, hole: 10 * W.sinkhole.reeds, hz: 240 }),
  pullOut({ name: 'reed', T: E, size: W.size, off: E.jitter, hole: 10 * W.sinkhole.reeds, hz: 120 }),
  pullOut({ name: 'nih-dairia', T: EB, size: 40, off: 0, hole: 10 * W.sinkhole.boss, hz: 240 }),
];
for (const r of runs) {
  const T = r.name === 'reed' ? E : EB, what = `${r.name} at ${r.hz} Hz (${JSON.stringify({ ...r, msPerStep: +r.msPerStep.toFixed(2) })})`;
  assert.ok(r.tipOver !== null && r.torsoOver !== null && r.tipOver < r.torsoOver - 0.5, `its arms over the surface well before its torso: ${what}`);
  assert.ok(r.tipOver < T.lead + T.reach, `its arms out during the reach: ${what}`);
  assert.ok(r.torsoOver > T.lead + T.reach && r.torsoOver < T.lead + T.reach + T.haul, `its torso over the surface during the haul: ${what}`);
  assert.ok(r.planted > -0.25 * r.height, `the tips stay on the lip through the haul (lowest ${r.planted.toFixed(2)} m against the surface): ${what}`);
  assert.ok(r.peak < SPEED_MAX, `no node thrown (fastest ${r.peak.toFixed(2)} native m/s): ${what}`);
  assert.ok(r.drift < 0.15 * r.height * 4, `it comes up where it went in (${r.drift.toFixed(2)} m): ${what}`);
  assert.ok(r.restored, `the kit's own step again once up: ${what}`);
}
const [r240, r120, boss] = runs;
assert.ok(r240.grips.some((g, i) => g > r240.rest[i] * 1.2), `a Reed off the hole's centre stretches its far arms to the lip (${r240.grips} m against ${r240.rest})`);
console.log(`boss-emerge.mjs: below > tremor > reach > haul (${E.heaves} surges) > release > up; the Reed's arms over the surface at ${r240.tipOver.toFixed(2)} s and its torso at ${r240.torsoOver.toFixed(2)} s (120 Hz: ${r120.tipOver.toFixed(2)} / ${r120.torsoOver.toFixed(2)} s), gripping at ${r240.grips.join('/')} m (rest ${r240.rest[0]} m); the boss's at ${boss.tipOver.toFixed(2)} / ${boss.torsoOver.toFixed(2)} s, gripping at ${boss.grips[0]} m; fastest node ${Math.max(...runs.map((r) => r.peak)).toFixed(2)} native m/s, ${r240.msPerStep.toFixed(2)} / ${boss.msPerStep.toFixed(2)} ms a step.`);
