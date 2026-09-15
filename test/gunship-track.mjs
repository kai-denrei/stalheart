// gunship-track.mjs — the platform's ground track as invariants: it creeps toward its target, never through the loiter
// circle, never over the speed cap, eases in and brakes, circles the target, turns no faster than the yaw rate, stays
// continuous through a target switch, and goes home when there is no breach.
import assert from 'node:assert/strict';
import { GUNSHIP_TRACK } from '../src/content/gunship.js';
import { makeTrack, stepTrack, steerTrack, parkTrack, pickTarget, breachLoads, headingTurn, arcBetween } from '../src/domain/gunship-track.js';
import { norm3, dot3, len3 } from '../src/vec3.js';

const CELL = 10 / 753;   // the story planet: 10 m a cell on a 753 m radius, as radians of the unit sphere
const T = GUNSHIP_TRACK;
const cells = (a, b) => arcBetween(a, b) / CELL;
/* a point `n` cells from `from` along a great circle toward `toward` */
const out = (from, toward, n) => { const p = norm3(from), t = norm3(toward.map((x, k) => x - p[k] * dot3(toward, p))), a = n * CELL; return p.map((x, k) => x * Math.cos(a) + t[k] * Math.sin(a)); };
const HOME = [0, 1, 0];
const far = out(HOME, [1, 0, 0], 45);

/* --- the content numbers are slow --------------------------------------- */
{
  assert(T.speedCells > 0 && T.accelCells > 0 && T.loiterCells > 0 && T.yawRateDeg > 0 && T.nearCells > 0);
  /* over the base to a far breach (45 cells) in 30..60 s: the brief's "slow" */
  const tr = makeTrack(HOME, [1, 0, 0]);
  let t = 0; while (cells(tr.pos, far) > T.loiterCells + 0.25 && t < 200) { stepTrack(tr, far, 1 / 30, T, CELL); t += 1 / 30; }
  assert(t >= 30 && t <= 60, `crossing to a far breach takes ${t.toFixed(1)} s`);
}

/* --- it moves toward the target, eases in, never over the cap, never through the circle ---------------------------- */
for (const dt of [1 / 120, 1 / 60, 1 / 20, 0.1]) {
  for (const heading of [[1, 0, 0], [-1, 0, 0], [0, 0, 1]]) {
    const tr = makeTrack(HOME, heading);
    let last = cells(tr.pos, far), minD = Infinity, lastSpeed = 0;
    for (let i = 0, n = Math.round(120 / dt); i < n; i++) {
      const before = tr.pos;
      stepTrack(tr, far, dt, T, CELL);
      const d = cells(tr.pos, far);
      assert(Math.abs(len3(tr.pos) - 1) < 1e-9, 'the ground point stays on the unit sphere');
      assert(Math.abs(len3(tr.heading) - 1) < 1e-9 && Math.abs(dot3(tr.heading, tr.pos)) < 1e-9, 'the heading is a unit tangent');
      assert(tr.speed <= T.speedCells + 1e-9, `speed cap (${tr.speed})`);
      assert(cells(before, tr.pos) <= T.speedCells * dt + 1e-9, 'a step never covers more than the top speed allows');
      assert(tr.speed - lastSpeed <= T.accelCells * dt + 1e-9, 'the speed climbs no faster than the acceleration');
      if (i * dt < 5) assert(tr.speed <= T.accelCells * (i + 1) * dt + 1e-9, 'it eases in from rest');
      if (last > T.loiterCells + 1) assert(d <= last + 1e-9, `outside the circle it only closes (${last} -> ${d})`);
      minD = Math.min(minD, d); last = d; lastSpeed = tr.speed;
    }
    assert(minD >= T.loiterCells - 0.02, `never through the loiter circle (closest ${minD.toFixed(3)} cells, dt ${dt})`);
    assert(Math.abs(last - T.loiterCells) < 0.3, `it settles on the loiter circle (${last.toFixed(2)} cells, dt ${dt})`);
  }
}

/* --- braking: at the circle the radial speed has bled off ------------------------------------------------------------ */
{
  const tr = makeTrack(HOME, [1, 0, 0]);
  let arrived = null;
  for (let i = 0; i < 60 * 90; i++) {
    stepTrack(tr, far, 1 / 60, T, CELL);
    if (arrived === null && cells(tr.pos, far) < T.loiterCells + 0.1) arrived = { speed: tr.speed, radial: dot3(tr.vel, norm3(far.map((x, k) => x - tr.pos[k] * dot3(far, tr.pos)))) };
  }
  assert(arrived, 'it reaches the circle');
  assert(arrived.radial < 0.3, `it brakes onto the circle (radial ${arrived.radial.toFixed(3)} cells/s)`);
}

/* --- the loiter: it circles the target anticlockwise from above, at the loiter radius -------------------------------- */
{
  const tr = makeTrack(HOME, [1, 0, 0]);
  for (let i = 0; i < 60 * 80; i++) stepTrack(tr, far, 1 / 60, T, CELL);
  const g = norm3(far), bearing = () => { const r = tr.pos.map((x, k) => x - g[k] * dot3(tr.pos, g)); return r; };
  let turned = 0, prev = bearing();
  for (let i = 0; i < 60 * 40; i++) {
    stepTrack(tr, far, 1 / 60, T, CELL);
    const d = cells(tr.pos, far);
    assert(Math.abs(d - T.loiterCells) < 0.3, `it holds the loiter radius (${d.toFixed(3)})`);
    const now = bearing(); turned += headingTurn(prev, now, g); prev = now;
  }
  const expected = T.loiterSpeedCells * 40 / T.loiterCells;
  assert(turned > expected * 0.8 && turned < expected * 1.2, `it circles anticlockwise at the loiter speed (${turned.toFixed(3)} rad, expected ${expected.toFixed(3)})`);
  assert(Math.abs(tr.speed - T.loiterSpeedCells) < 0.1, `round the circle at the loiter speed (${tr.speed.toFixed(3)})`);
}

/* --- the heading turns at the capped rate, and follows the travel ---------------------------------------------------- */
for (const dt of [1 / 60, 0.1]) {
  const tr = makeTrack(HOME, [-1, 0, 0]);   // facing away from the target: a half turn to make
  const lim = T.yawRateDeg * Math.PI / 180 * dt;
  let maxTurn = 0;
  for (let i = 0, n = Math.round(90 / dt); i < n; i++) {
    const h0 = tr.heading;
    stepTrack(tr, far, dt, T, CELL);
    maxTurn = Math.max(maxTurn, Math.abs(headingTurn(h0, tr.heading, tr.pos)));
  }
  assert(maxTurn <= lim + 1e-6, `yaw rate cap (${maxTurn} per step, limit ${lim})`);
  assert(maxTurn > lim * 0.9, 'the half turn is made at the cap');
  assert(dot3(tr.heading, norm3(tr.vel)) > 0.95, 'the heading ends along the travel');
}

/* --- a target switch mid-flight is continuous ------------------------------------------------------------------------ */
{
  const tr = makeTrack(HOME, [1, 0, 0]), other = out(HOME, [-1, 0, 0.3], 40), dt = 1 / 60;
  for (let i = 0; i < 60 * 15; i++) stepTrack(tr, far, dt, T, CELL);
  assert(tr.speed > T.speedCells * 0.9, 'at speed before the switch');
  let maxDv = 0, maxDp = 0, maxDh = 0;
  const lim = T.yawRateDeg * Math.PI / 180 * dt;
  for (let i = 0; i < 60 * 60; i++) {
    const p0 = tr.pos, h0 = tr.heading, v0 = tr.vel.slice();
    stepTrack(tr, other, dt, T, CELL);
    /* the old velocity carried onto the new ground is what the new one is compared against: flatten it */
    const k = dot3(v0, tr.pos), v0t = v0.map((x, j) => x - tr.pos[j] * k);
    maxDv = Math.max(maxDv, len3(tr.vel.map((x, j) => x - v0t[j])));
    maxDp = Math.max(maxDp, cells(p0, tr.pos));
    maxDh = Math.max(maxDh, Math.abs(headingTurn(h0, tr.heading, tr.pos)));
  }
  assert(maxDv <= T.accelCells * dt * 1.05 + 1e-6, `the velocity changes smoothly through the switch (${maxDv})`);
  assert(maxDp <= T.speedCells * dt + 1e-9, 'the ground point never jumps');
  assert(maxDh <= lim + 1e-6, 'the heading never snaps');
  assert(cells(tr.pos, other) < cells(HOME, other), 'it has come round toward the new target');
}

/* --- picking the target ---------------------------------------------------------------------------------------------- */
{
  const a = { pos: out(HOME, [1, 0, 0], 30), enemies: 4 }, b = { pos: out(HOME, [-1, 0, 0], 50), enemies: 9 }, c = { pos: out(HOME, [0, 0, 1], 20), enemies: 9 };
  assert.deepEqual(pickTarget([], HOME, [0, 2, 0]), { pos: [0, 1, 0], enemies: 0, home: true }, 'no breach: over the base');
  assert.equal(pickTarget([a], HOME, HOME).home, false, 'one live breach, even quiet, is the target');
  assert.equal(pickTarget([a, b].map((x) => ({ ...x })), HOME, HOME).enemies, 9, 'the most enemies wins');
  assert(arcBetween(pickTarget([a, b, c], HOME, HOME).pos, c.pos) < 1e-9, 'a tie goes to the nearest');
  assert(arcBetween(pickTarget([a, b, c], b.pos, HOME).pos, b.pos) < 1e-9, 'nearest to where the ship is, not to the base');
  const prev = pickTarget([a], HOME, HOME);
  const grown = { ...b, enemies: a.enemies + 2 };
  assert(arcBetween(pickTarget([a, grown], HOME, HOME, { prev, margin: 3 }).pos, a.pos) < 1e-9, 'a small lead does not pull it away');
  assert(arcBetween(pickTarget([a, { ...b, enemies: a.enemies + 3 }], HOME, HOME, { prev, margin: 3 }).pos, b.pos) < 1e-9, 'a clear lead does');
  assert(arcBetween(pickTarget([grown], HOME, HOME, { prev, margin: 3 }).pos, grown.pos) < 1e-9, 'a sealed breach lets it go');
}

/* --- loads and home -------------------------------------------------------------------------------------------------- */
{
  const p = out(HOME, [1, 0, 0], 30), q = out(HOME, [-1, 0, 0], 30);
  const bodies = [out(p, [0, 0, 1], 2), out(p, [0, 0, -1], 5.5), out(p, [0, 0, 1], 7), out(q, [0, 0, 1], 1)].map((v) => ({ pos: v.map((x) => x * 1.02) }));
  assert.deepEqual(breachLoads([p, q], bodies, T.nearCells * CELL).map((l) => l.enemies), [2, 1], 'bodies within nearCells count, height aside');
  const tr = makeTrack(p, [1, 0, 0]);
  for (let i = 0; i < 60 * 90; i++) stepTrack(tr, pickTarget([], tr.pos, HOME).pos, 1 / 60, T, CELL);
  assert(Math.abs(cells(tr.pos, HOME) - T.loiterCells) < 0.3, `with no breach it goes back and circles the base (${cells(tr.pos, HOME).toFixed(2)})`);
}

/* --- the host's call: steer keeps its pick through a small lead, park brings it back from rest ---------------------- */
{
  const p = out(HOME, [1, 0, 0], 30), q = out(HOME, [-1, 0, 0], 30);
  const tr = makeTrack(HOME, [1, 0, 0]);
  steerTrack(tr, [{ pos: p, enemies: 5 }, { pos: q, enemies: 1 }], HOME, 1 / 60, T, CELL);
  assert(arcBetween(tr.pick.pos, p) < 1e-9, 'steer picks the busier breach');
  for (let i = 0; i < 60; i++) steerTrack(tr, [{ pos: p, enemies: 5 }, { pos: q, enemies: 5 + T.switchMargin - 1 }], HOME, 1 / 60, T, CELL);
  assert(arcBetween(tr.pick.pos, p) < 1e-9, 'and keeps it through a lead under the margin');
  steerTrack(tr, [{ pos: q, enemies: 2 }], HOME, 1 / 60, T, CELL);
  assert(arcBetween(tr.pick.pos, q) < 1e-9, 'a breach that closed lets the pick go');
  steerTrack(tr, [], HOME, 1 / 60, T, CELL);
  assert(tr.pick.home, 'and with none left it is home');
  assert(tr.speed > 0, 'moving');
  const vel = tr.vel; parkTrack(tr);
  assert(tr.speed === 0 && tr.vel === vel && len3(tr.vel) === 0, 'parked at rest, in place');
}

/* --- the seat's compensation reads a turn, not a move ---------------------------------------------------------------- */
{
  assert(Math.abs(headingTurn([0, 0, 1], [1, 0, 0], [0, 1, 0]) - Math.PI / 2) < 1e-9, 'z to x about +y is a quarter turn anticlockwise');
  assert(Math.abs(headingTurn([0, 0.2, 1], [0, 0, 1], [0, 1, 0])) < 1e-9, 'a heading that only tilted with the ground is no turn');
  assert.equal(headingTurn([0, 1, 0], [1, 0, 0], [0, 1, 0]), 0, 'no tangent part, no turn');
  const tr = makeTrack([0, 1, 0], [0, 1, 0]);
  assert(Math.abs(dot3(tr.heading, tr.pos)) < 1e-12 && Math.abs(len3(tr.heading) - 1) < 1e-12, 'a degenerate heading still makes a tangent');
  assert.equal(stepTrack(tr, far, 0, T, CELL).speed, 0, 'no time, no motion');
}

console.log('gunship-track: ok');
