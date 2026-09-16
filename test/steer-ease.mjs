import assert from 'node:assert/strict';
import { makeSteerEase, stepSteerEase, steerBank } from '../src/domain/steer-ease.js';
import { TANK_STEER } from '../src/content/tank.js';
const T = TANK_STEER;
const dt = 1 / 60;
const hold = (st, secs, want) => { let r = 0; for (let i = 0; i < Math.round(secs / dt); i++) r = stepSteerEase(st, dt, want, T); return r; };

assert.ok(T.rate > 0 && T.attack > 0 && T.release > 0, 'a top rate and two time constants');
assert.ok(T.attack > T.release, 'a turn builds slower than it lets go');
assert.ok(T.bank > 0 && T.bank < 0.5, 'the lean is a lean, not a barrel roll');

// THE POINT: the first frame of a held key is no longer the full rate
{
  const st = makeSteerEase();
  const first = stepSteerEase(st, dt, 1, T);
  assert.ok(first > 0 && first < T.rate * 0.15, `the first frame eases in (${first.toFixed(3)} of ${T.rate})`);
  assert.ok(hold(st, 1, 1) > T.rate * 0.95, 'a held key still reaches the full rate');
  assert.ok(hold(st, 5, 1) <= T.rate + 1e-9, 'and never passes it');
}

// it is not a slower tank: the same top rate, and the ramp is over in a fraction of a second
{
  const st = makeSteerEase();
  assert.ok(hold(st, T.attack * 3, 1) > T.rate * 0.9, 'the ramp is spent within a few attack constants');
}

// releasing settles out rather than stopping dead, and ends exactly straight
{
  const st = makeSteerEase();
  hold(st, 1, 1);
  const afterOne = stepSteerEase(st, dt, 0, T);
  assert.ok(afterOne > 0 && afterOne < T.rate, 'the frame after the key comes up still carries some turn');
  assert.ok(hold(st, 1, 0) < T.rate * 0.01, 'a second later the turn is spent');
  assert.equal(hold(st, 1, 0), 0, 'and it settles to exactly zero, so a heading cannot creep');
}

// a reversal ramps through the centre instead of snapping to the far side
{
  const st = makeSteerEase();
  hold(st, 1, 1);
  const flipped = stepSteerEase(st, dt, -1, T);
  assert.ok(flipped > 0, 'one frame of the opposite key does not reverse the turn');
  assert.ok(hold(st, 1, -1) < -T.rate * 0.95, 'held, it does come all the way round');
}

// the analog stick's partial deflection is a partial rate
{
  const st = makeSteerEase();
  const half = hold(st, 1, 0.5);
  assert.ok(Math.abs(half - T.rate * 0.5) < T.rate * 0.02, `half a stick is half the rate (${half.toFixed(2)})`);
  assert.equal(hold(makeSteerEase(), 1, 3), hold(makeSteerEase(), 1, 1), 'an over-range want is clamped to a full deflection');
}

// the bank leans INTO the turn and is proportional to the rate
{
  const st = makeSteerEase();
  assert.equal(Math.abs(steerBank(st, T)), 0, 'straight and level at rest');
  hold(st, 2, 1);
  const left = steerBank(st, T);
  assert.ok(Math.abs(left + T.bank) < 1e-3, `full left is a full lean (${left.toFixed(3)})`);
  hold(st, 1, -1);
  assert.ok(steerBank(st, T) > 0, 'the other way leans the other way');
  assert.equal(steerBank(makeSteerEase(), { ...T, rate: 0 }), 0, 'no rate, no lean');
}

// dt guards: a zero or negative frame changes nothing
{
  const st = makeSteerEase();
  hold(st, 0.5, 1);
  const r = st.rate;
  assert.equal(stepSteerEase(st, 0, 1, T), r, 'a zero frame is a no-op');
  assert.equal(stepSteerEase(st, -1, 1, T), r, 'so is a negative one');
}
console.log(`Steer ease: x${T.rate} rad/s reached over ${T.attack}s and released over ${T.release}s, leaning ${T.bank} rad into the turn.`);
