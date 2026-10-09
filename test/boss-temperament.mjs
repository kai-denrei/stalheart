// boss-temperament.mjs — the bait mode's temperament (wave B, 2026-10-09; src/domain/boss-temperament.js): lunges every 3-8 s from a seeded sequence,
// 0.6-1.2 s long, at the lunge speed with the arms' reach raised within the kit's ranges, eased in and out over 0.2 s; a due lunge waits for `ready`;
// the fear's flight wins over a lunge and both ease back to the base; lunges off keeps the base.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { NIH_DAIRIA_PREDATOR } from '../src/content/nih-dairia.js';
import { MOTION_CONTROLS } from '../src/fx/nih-dairia/motion-settings.js';
import { makeTemperament, stepTemperament, liveMotion, TEMPERAMENT_KEYS } from '../src/domain/boss-temperament.js';

const M = T.temperament, DT = 1 / 60, EPS = 1e-9, BASE = NIH_DAIRIA_PREDATOR;
const LIMITS = Object.fromEntries(MOTION_CONTROLS.map((c) => [c.key, [c.min, c.max]]));

// the content
assert.deepEqual({ ...M }, { lunges: true, lungeSpeed: 3, everyMin: 3, everyMax: 8, forMin: 0.6, forMax: 1.2, reach: 1.5, ease: 0.2 }, 'the temperament numbers');
assert.equal(BASE.speed, 1.2, 'the base chase speed is 1.2');

// a long run: the lunges' starts 3-8 s apart, each 0.6-1.2 s, the same seed the same run
function run(seed, seconds, { ready = () => true, flight = () => null } = {}) {
  const s = makeTemperament(T, seed), lunges = [], live = [];
  let was = false;
  for (let i = 0; i < seconds / DT; i++) {
    stepTemperament(s, DT, T, { flight: flight(s.t), ready: ready(s.t) });
    if (s.lunge && !was) lunges.push({ start: s.lunge.since, length: s.lunge.until - s.lunge.since });
    was = !!s.lunge;
    live.push(liveMotion(BASE, s, T, LIMITS));
  }
  return { s, lunges, live };
}
const a = run(7, 600);
const gaps = a.lunges.slice(1).map((l, i) => l.start - a.lunges[i].start);
assert.ok(a.lunges.length >= 600 / M.everyMax && a.lunges.length <= 600 / M.everyMin + 1, `${a.lunges.length} lunges in 600 s`);
assert.ok(Math.min(...gaps) >= M.everyMin - DT && Math.max(...gaps) <= M.everyMax + DT, `their starts ${Math.min(...gaps).toFixed(2)}-${Math.max(...gaps).toFixed(2)} s apart`);
const lengths = a.lunges.map((l) => l.length);
assert.ok(Math.min(...lengths) >= M.forMin - EPS && Math.max(...lengths) <= M.forMax + EPS, 'each 0.6-1.2 s');
assert.deepEqual(run(7, 60).lunges, run(7, 60).lunges, 'a seed lunges one way');
assert.notDeepEqual(run(8, 60).lunges, run(7, 60).lunges, 'another seed another way');

// a lunge's settings: the lunge speed and the reach raised, clamped to the kit's ranges; eased in over 0.2 s (no step bigger than a frame's share)
{
  const top = Math.max(...a.live.map((l) => l.speed));
  assert.ok(Math.abs(top - M.lungeSpeed) < EPS, `a lunge reaches the lunge speed (${top})`);
  const peak = a.live.find((l) => Math.abs(l.speed - M.lungeSpeed) < EPS);
  assert.ok(Math.abs(peak.reachTime - BASE.reachTime * M.reach) < EPS, 'the reach duration times the boost');
  assert.ok(Math.abs(peak.spread - Math.min(6, BASE.spread * M.reach)) < EPS && peak.stretch === 5, 'the spread raised to the kit\'s 6 at most, the stretch held at its 5');
  let worst = 0;
  for (let i = 1; i < a.live.length; i++) worst = Math.max(worst, Math.abs(a.live[i].speed - a.live[i - 1].speed));
  const smoothMax = 1.5 * DT / M.ease * (M.lungeSpeed - BASE.speed);   // the smoothstep's steepest slope is 1.5
  assert.ok(worst <= smoothMax + EPS, `eased: the speed moves at most ${worst.toFixed(3)} a frame (bound ${smoothMax.toFixed(3)})`);
  const calm = a.live.filter((l) => l.speed === BASE.speed);
  assert.ok(calm.length > a.live.length / 2, 'most of the time it is the base');
  for (const k of TEMPERAMENT_KEYS) assert.equal(calm[0][k], BASE[k], `the base ${k} untouched`);
}

// `ready`: a due lunge waits for it (the kit's pull)
{
  const late = run(7, 60, { ready: (t) => (t % 2) > 1.5 });
  assert.ok(late.lunges.length > 0, 'lunges still come');
  for (const l of late.lunges) assert.ok((l.start - DT) % 2 > 1.5 - 1e-6, `a lunge starts only when ready (${l.start.toFixed(3)}; ready was read on the frame's start)`);
}

// the fear wins: a flight from 0.5 s to 4.5 s at x2 cancels a lunge, holds no lunge, and eases back to the base after; its speed and the erratic motion up
{
  const flight = { level: 'wild', speed: 2, erratic: 2 };
  const s = makeTemperament(T, 3);
  s.next = 0;   // a lunge due at once
  for (let i = 0; i < 0.5 / DT; i++) stepTemperament(s, DT, T, {});
  assert.ok(s.lunge, 'a lunge is running at 0.5 s');
  for (let i = 0; i < 4 / DT; i++) { stepTemperament(s, DT, T, { flight }); assert.equal(s.lunge, null, 'no lunge in a flight'); }
  const live = liveMotion(BASE, s, T, LIMITS);
  assert.equal(s.phase, 'wild');
  assert.ok(Math.abs(live.speed - BASE.speed * 2) < EPS && Math.abs(live.erratic - (BASE.erratic + 2)) < EPS, `the flight's speed and erratic (${live.speed}, ${live.erratic})`);
  assert.ok(Math.abs(live.reachTime - BASE.reachTime / 2) < EPS && Math.abs(live.pauseTime - BASE.pauseTime / 2) < EPS, 'the reach and the pause halved: the surges come twice as often');
  stepTemperament(s, DT, T, {});
  assert.notEqual(s.phase, 'wild');
  for (let i = 0; i < M.ease / DT + 2; i++) stepTemperament(s, DT, T, {});
  const back = liveMotion(BASE, s, T, LIMITS);
  for (const k of TEMPERAMENT_KEYS) assert.ok(Math.abs(back[k] - BASE[k]) < EPS || s.lunge, `${k} back at the base after the ease`);
  assert.equal(s.fear, null, 'the flight\'s numbers dropped once eased back');
}

// lunges off: the base throughout
{
  const off = { ...T, temperament: { ...M, lunges: false } }, s = makeTemperament(off, 1);
  for (let i = 0; i < 60 / DT; i++) { stepTemperament(s, DT, off, {}); assert.equal(liveMotion(BASE, s, off, LIMITS).speed, BASE.speed); }
  assert.equal(s.lunges, 0);
}

console.log(`boss-temperament.mjs: ${a.lunges.length} lunges in 600 s, starts ${Math.min(...gaps).toFixed(2)}-${Math.max(...gaps).toFixed(2)} s apart, ${Math.min(...lengths).toFixed(2)}-${Math.max(...lengths).toFixed(2)} s long, at chase speed ${M.lungeSpeed} from ${BASE.speed} with the reach x${M.reach}, eased over ${M.ease} s; a due lunge waits for the pull; the flight wins and both ease back.`);
