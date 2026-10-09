// boss-orbit.mjs — the bait mode's gunship pattern (spec 2026-10-09-boss-bait-arena-and-feel-design.md, item 1): the platform's
// ground track is a circle of 200 m round the arena's centre, one lap in 120 s, in the direction the angle atan2(z, x) grows (the
// bait's own "counter-clockwise"), heading along the circle, a constant bank toward the centre. Altitude is the game's, not here.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { orbitAt } from '../src/domain/boss-orbit.js';

const O = T.orbit, G = 9.81;
const EPS = 1e-9;            // metres / radians: exact identities
const STEP = 1 / 60;         // s: the continuity sweep
const GAP = 0.2;             // metres: no frame of the sweep jumps farther than this (speed ~10.5 m/s x 1/60 s = 0.17)
const HEADING_STEP = 0.01;   // radians: no frame turns the heading more than this (2 pi / 120 s / 60 = 0.0009)
const BANK_MAX = 0.3;        // radians (17 degrees): "banked into the turn", not wild

assert.ok(Object.isFrozen(O) && O.radius === 200 && O.lap === 120, 'the orbit content: 200 m, 120 s, frozen');
const coordinated = Math.atan((((2 * Math.PI * O.radius) / O.lap) ** 2 / O.radius) / G);
assert.ok(O.bank > coordinated && O.bank < BANK_MAX, `the bank reads as a bank (above the coordinated ${coordinated.toFixed(3)} rad, under ${BANK_MAX}): ${O.bank}`);

let radiusErr = 0, gap = 0, turn = 0, tangentErr = 0, bankErr = 0, ccw = true;
let prev = orbitAt(0, T);
for (let i = 1; i <= 2 * 120 * 60; i++) {
  const t = i * STEP, o = orbitAt(t, T);
  radiusErr = Math.max(radiusErr, Math.abs(Math.hypot(o.pos[0], o.pos[1]) - O.radius));
  gap = Math.max(gap, Math.hypot(o.pos[0] - prev.pos[0], o.pos[1] - prev.pos[1]));
  turn = Math.max(turn, Math.abs(o.heading - prev.heading));
  // the heading is the direction of travel: the velocity (finite difference) against (cos h, sin h)
  const vx = (o.pos[0] - prev.pos[0]) / STEP, vz = (o.pos[1] - prev.pos[1]) / STEP, speed = Math.hypot(vx, vz), mid = (o.heading + prev.heading) / 2;
  tangentErr = Math.max(tangentErr, Math.abs(vx / speed - Math.cos(mid)) + Math.abs(vz / speed - Math.sin(mid)));
  bankErr = Math.max(bankErr, Math.abs(o.bank - O.bank));
  ccw = ccw && prev.pos[0] * o.pos[1] - prev.pos[1] * o.pos[0] > 0;   // the cross product of consecutive points is positive: the angle grows
  prev = o;
}
assert.ok(radiusErr < EPS, `every point lies on the 200 m circle: worst ${radiusErr}`);
assert.ok(gap < GAP, `the track is continuous: worst frame ${gap.toFixed(3)} m`);
assert.ok(turn < HEADING_STEP, `the heading is continuous (unwrapped): worst frame ${turn.toFixed(5)} rad`);
assert.ok(tangentErr < 0.01, `the heading is the tangent: worst direction error ${tangentErr.toFixed(5)}`);
assert.equal(bankErr, 0, 'the bank is the constant orbit.bank');
assert.ok(ccw, 'the angle atan2(z, x) grows (counter-clockwise, as the bait circles)');

// the period: one lap returns to the start, a half lap to the opposite point, a quarter lap a quarter round
const a = orbitAt(0, T), b = orbitAt(O.lap, T), h = orbitAt(O.lap / 2, T), q = orbitAt(O.lap / 4, T);
assert.ok(Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]) < 1e-9, `one lap returns: ${b.pos}`);
assert.ok(Math.hypot(a.pos[0] + h.pos[0], a.pos[1] + h.pos[1]) < 1e-9, 'half a lap is the opposite point');
assert.ok(Math.abs(a.pos[0] * q.pos[0] + a.pos[1] * q.pos[1]) < 1e-9 && a.pos[0] * q.pos[1] - a.pos[1] * q.pos[0] > 0, 'a quarter lap is a quarter turn, the angle growing');
assert.ok(Math.abs(b.heading - a.heading - 2 * Math.PI) < 1e-9, 'the unwrapped heading gains a full turn per lap');
// a pure function of (t, tune): same in, same out, and the tune alone sets the track
assert.deepEqual(orbitAt(37.5, T), orbitAt(37.5, T));
const wide = orbitAt(10, { ...T, orbit: { radius: 300, lap: 60, bank: 0.2 } });
assert.ok(Math.abs(Math.hypot(...wide.pos) - 300) < EPS && wide.bank === 0.2, 'the tune sets the radius and the bank');
assert.ok(Math.abs(Math.atan2(wide.pos[1], wide.pos[0]) - 2 * Math.PI * 10 / 60) < 1e-9, 'and the lap');

console.log(`Boss orbit: ${O.radius} m circle (worst radius error ${radiusErr.toExponential(1)}), one lap per ${O.lap} s (${(2 * Math.PI * O.radius / O.lap).toFixed(2)} m/s), heading tangent within ${tangentErr.toFixed(4)}, continuous to ${gap.toFixed(3)} m a frame and ${turn.toFixed(4)} rad, constant bank ${O.bank} rad (coordinated ${coordinated.toFixed(3)}).`);
