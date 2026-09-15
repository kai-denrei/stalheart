import assert from 'node:assert/strict';
import { ROUND_FRAME, framingWeight, frameRound, screenOf } from '../src/core/round-framing.js';
import { missileFrame, sampleMissile } from '../src/domain/missile-flight.js';

const near = (a, b, e = 1e-9) => assert(Math.abs(a - b) < e, `${a} != ${b}`);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// the weight: the whole opening, eased out through the climb, nothing after
near(framingWeight(0), 1); near(framingWeight(ROUND_FRAME.hold), 1); near(framingWeight(ROUND_FRAME.release), 0); near(framingWeight(.9), 0);
assert.equal(framingWeight(NaN), 0); assert.equal(framingWeight(-1), 0);
for (let u = ROUND_FRAME.hold, prev = 1; u <= ROUND_FRAME.release; u += .01) { const w = framingWeight(u); assert(w <= prev + 1e-12); prev = w; }

const view = { eye: [0, 0, 0], aim: [0, 0, 1], up: [0, 1, 0], fovDeg: 20, aspect: 16 / 9 };
const inBox = (p, look, e = 1e-6) => { const s = screenOf(p, { ...view, look, fovDeg: view.fovDeg }); return s.ahead && s.y <= ROUND_FRAME.top + e && s.y >= ROUND_FRAME.bottom - e && Math.abs(s.x) <= ROUND_FRAME.side + e; };

// a round already inside the dead zone does not move the view
{ const look = frameRound({ ...view, round: [0.1, 0.1, 5] }); for (let i = 0; i < 3; i++) near(look[i], view.aim[i]); }
// above, below, to the side and behind: the view turns just enough to put it on the box
for (const round of [[0, 5, 3], [0, -4, 3], [6, 0, 3], [-6, 3, 3], [0, 2, -3], [3, 4, 1]]) {
  const look = frameRound({ ...view, round });
  assert(inBox(round, look), `framed ${round}: ${JSON.stringify(screenOf(round, { ...view, look }))}`);
}
{ const look = frameRound({ ...view, round: [0, 5, 3] }); near(screenOf([0, 5, 3], { ...view, look }).y, ROUND_FRAME.top, 1e-6); }   // riding the top edge, in the upper third
assert(ROUND_FRAME.top > 1 / 3, 'the top of the dead zone is in the upper third');
// weight 0 is the aim; a half weight is half the turn
{ const round = [0, 5, 3], full = frameRound({ ...view, round }), half = frameRound({ ...view, round, weight: .5 });
  for (let i = 0; i < 3; i++) near(frameRound({ ...view, round, weight: 0 })[i], view.aim[i]);
  near(Math.acos(dot(half, view.aim)), Math.acos(dot(full, view.aim)) / 2, 1e-9); }
// straight overhead: the view keeps a horizon
{ const look = frameRound({ ...view, round: [0, 100, 0.01] }); assert(dot(look, view.up) <= ROUND_FRAME.steepest + 1e-9); }

// A HEAVY ROUND'S WHOLE OPENING FROM A MOUNT'S EYE: every sample from launch to ignite is inside the frame, at the lens the opening
// eases to and at the long lens the Quiver opens through (the dead zone does the work either way)
for (const [range, fovDeg] of [[70, 60], [235, 60], [400, 60], [70, 20], [235, 20]]) {
  const muzzle = [0, 6.5, 0], eye = [0, 7.7, -3.4], aim = [0, -7.7 / range, 1], frame = missileFrame(muzzle, [0, 0, range], [0, .83, .56]);
  let inside = 0, n = 0;
  for (let u = 0; u <= ROUND_FRAME.hold; u += .005, n++) {
    const p = sampleMissile(frame, u, 'heavy').position, look = frameRound({ eye, aim, up: [0, 1, 0], round: p, fovDeg, aspect: 16 / 9 });
    const s = screenOf(p, { eye, look, up: [0, 1, 0], fovDeg, aspect: 16 / 9 });
    if (s.ahead && Math.abs(s.x) <= 1 && Math.abs(s.y) <= 1) inside++;
  }
  assert.equal(inside, n, `${range} m at ${fovDeg} deg: ${inside} of ${n} in frame`);
}
console.log('Round framing: the opening in frame at every range and lens, the dead zone, the weight and the horizon pass.');
