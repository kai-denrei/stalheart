// round-path.mjs — where a straight line from a gun meets the planet (src/domain/round-path.js). roundEnd is the EXACT first
// crossing: r = 1 on open ground (the gunship's aimOnSphere), r = 1 + wallHeight through a rock top, the cell boundary through a
// rock side, null in the air at maxLen; the gun's own cell never stops it. flyStraight lands the head exactly on that point at
// any frame rate and reports the landing one call later, so the frame that draws the head there comes first. marchToTerrain is
// the lance's march (a quarter cell of clearance, one step back), unchanged from the controller's rayToTerrain.
import assert from 'node:assert/strict';
import { roundEnd, flyStraight, marchToTerrain } from '../src/domain/round-path.js';
import { aimOnSphere } from '../src/domain/gunship.js';
import { BLOCKED, PATH } from '../src/dungeon.js';
import { norm3, sub3, add3, scale3, len3, dist3, dot3, cross3 } from '../src/vec3.js';

// A toy board: cells are rings of colatitude around +Y, one cell wide; ring 0 (the pole) is the gun's own cell.
const cs = 0.0133, rings = 40;
const colat = (p) => Math.acos(Math.max(-1, Math.min(1, p[1] / len3(p))));
const cellAt = (u) => Math.min(rings - 1, Math.floor(colat(u) / cs));
const board = (rock = [], ownCi = 0) => {
  const tags = Array.from({ length: rings }, (_, i) => rock.includes(i) ? BLOCKED : PATH);
  return { cellAt, tags, wallHeight: 0.4 * cs, step: 0.2 * cs, clearance: 0.25 * cs, ownCi };
};
const ground = (x) => [Math.sin(x * cs), Math.cos(x * cs), 0];   // the open ground x cells from the pole
const muzzle = (h) => [0, 1 + h * cs, 0];
const offLine = (p, from, d) => len3(cross3(sub3(p, from), d));

// 1. a muzzle 0.69 cell up aimed at the ground 3 cells out: open ground, exactly the gunship's crossing, exactly the aim point
{
  const from = muzzle(0.69), d = norm3(sub3(ground(3), from)), e = roundEnd(from, d, 4.86 * cs, board());
  assert.equal(e.hit, 'ground');
  assert.ok(Math.abs(len3(e.point) - 1) < 1e-9, `on r = 1 (${len3(e.point) - 1})`);
  assert.deepEqual(e.point, aimOnSphere(from, d, 1), 'the gunship\'s own ray-sphere point');
  assert.ok(dist3(e.point, ground(3)) < 1e-12, 'the round lands on the ground point it was aimed at');
  assert.ok(Math.abs(e.len - dist3(from, e.point)) < 1e-15, 'len is the distance along the line');
  // the gun's own cell is rock and does not stop it
  assert.deepEqual(roundEnd(from, d, 4.86 * cs, board([0])), e, 'its own parapet does not stop it');
  // a reach shorter than the crossing: still in the air at maxLen
  const short = roundEnd(from, d, e.len * 0.9, board());
  assert.equal(short.hit, null); assert.equal(short.len, e.len * 0.9);
  assert.ok(dist3(short.point, add3(from, scale3(d, e.len * 0.9))) < 1e-15, 'the last point in the air');
}
// 2. a level ray over the Rotor's 4.86 cells clears the curved ground: in the air at maxLen
{
  const from = muzzle(0.69), e = roundEnd(from, [1, 0, 0], 4.86 * cs, board());
  assert.equal(e.hit, null); assert.equal(e.len, 4.86 * cs);
  assert.deepEqual(e.point, [4.86 * cs, 1 + 0.69 * cs, 0]);
}
// 3. into rock through its top: at r = 1 + wallHeight, over the rock ring
{
  const t = board([2]), from = muzzle(2), d = norm3(sub3(ground(3.5), from)), e = roundEnd(from, d, 6 * cs, t);
  assert.equal(e.hit, 'wall');
  assert.ok(Math.abs(len3(e.point) - (1 + t.wallHeight)) < 1e-12, `on the wall top (${len3(e.point) - 1 - t.wallHeight})`);
  assert.deepEqual(e.point, aimOnSphere(from, d, 1 + t.wallHeight), 'solved on the wall-top sphere, not approached');
  assert.equal(cellAt(norm3(e.point)), 2, 'over the rock');
  assert.ok(offLine(e.point, from, d) < 1e-15, 'on the line');
  assert.ok(e.len < dist3(from, ground(3.5)), 'short of the ground it was aimed past');
}
// 4. into rock through its side: at the ring's edge, below the wall top
{
  const t = board([2]), from = muzzle(0.69), d = norm3(sub3(ground(3), from)), e = roundEnd(from, d, 4.86 * cs, t);
  assert.equal(e.hit, 'wall');
  assert.ok(Math.abs(colat(e.point) - 2 * cs) < 1e-12, `on the rock's side (${(colat(e.point) - 2 * cs) / cs} cell)`);
  assert.ok(len3(e.point) < 1 + t.wallHeight && len3(e.point) > 1, 'below the wall top, above the ground');
  assert.ok(offLine(e.point, from, d) < 1e-15, 'on the line');
  // rock that starts a sliver short of where the line reaches the ground is still rock: the crossing itself is tested too
  for (let x = 2.9; x <= 3.1; x += 0.01) {
    const dx = norm3(sub3(ground(x), from)), ex = roundEnd(from, dx, 4.86 * cs, board([3]));
    if (x < 2.999) assert.equal(ex.hit, 'ground', `aimed at ${x.toFixed(2)} cells: short of the rock`);
    else if (x > 3.001) { assert.equal(ex.hit, 'wall', `aimed at ${x.toFixed(2)} cells: into the rock's foot`); assert.ok(Math.abs(colat(ex.point) - 3 * cs) < 1e-12); }
  }
}
// the gun's own cell never stops it, even where its line runs below that cell's wall top (a depressed barrel over its parapet)
{
  const from = muzzle(0.45), d = norm3(sub3(ground(1.2), from)), own = board([0]);
  assert.equal(roundEnd(from, d, 4.86 * cs, own).hit, 'ground', 'the round flies out of its own cell');
  assert.ok(dist3(roundEnd(from, d, 4.86 * cs, own).point, ground(1.2)) < 1e-12);
  assert.equal(roundEnd(from, d, 4.86 * cs, { ...own, ownCi: -1 }).hit, 'wall', 'someone else\'s rock there would stop it');
  assert.equal(marchToTerrain(from, d, 4.86 * cs, own).hit, 'ground', 'nor does it stop the lance');
  assert.equal(marchToTerrain(from, d, 4.86 * cs, { ...own, ownCi: -1 }).hit, 'wall');
}
// 5. the flight: at 30, 60 and 144 frames a second the last head drawn is EXACTLY the end, and the landing is the call after it
for (const hz of [30, 60, 144]) {
  const from = muzzle(0.69), d = norm3(sub3(ground(3), from)), end = roundEnd(from, d, 4.86 * cs, board()), step = 16 * cs / hz;
  const round = { dist: 0, straight: { p: from.slice(), d, end } }, heads = [];
  let calls = 0;
  while (!flyStraight(round, step)) { heads.push(round.straight.p.slice()); assert.ok(++calls < 1000, 'lands'); }
  assert.deepEqual(heads.at(-1), end.point, `${hz} Hz: the last head drawn is the end point`);
  assert.equal(round.dist, end.len);
  let k = 0, s = 0; while (s < end.len) { s += step; k++; }
  assert.equal(heads.length, k, `${hz} Hz: the head reaches the end on the step that would pass it (${k})`);
  for (let i = 0; i < heads.length - 1; i++) {
    assert.ok(offLine(heads[i], from, d) < 1e-15 && dot3(sub3(heads[i], from), d) < end.len, 'on the line, short of the end');
    assert.ok(dot3(sub3(heads[i + 1], heads[i]), d) > 0, 'moving out');
  }
  assert.equal(flyStraight(round, step), true, 'stays landed');
}
// ...and a straight round with no end flies on, one step a call, as the old step did (add3(p, scale3(d, step)))
{
  const d = norm3([1, -0.2, 0.1]), round = { dist: 0, straight: { p: [0, 1.01, 0], d, end: null } };
  let dist = 0;
  for (let i = 0; i < 50; i++) { const before = round.straight.p; assert.equal(flyStraight(round, 0.003), false); assert.deepEqual(round.straight.p, add3(before, scale3(d, 0.003))); dist += 0.003; }
  assert.equal(round.dist, dist, 'its distance grows by the step, as p.dist did');
}
// 6. the lance's march: a quarter cell into the terrain, one step back; the air returns maxLen
{
  const t = board(), from = muzzle(0.69), d = norm3(sub3(ground(3), from)), m = marchToTerrain(from, d, 4.86 * cs, t);
  let want = null;
  for (let s = t.step; s <= 4.86 * cs; s += t.step) if (len3(add3(from, scale3(d, s))) < 1 - t.clearance) { want = Math.max(t.step, s - t.step); break; }
  assert.deepEqual(m, { len: want, hit: 'ground' });
  assert.ok(m.len > roundEnd(from, d, 4.86 * cs, t).len - t.step, 'about where the round lands, a reach rather than a point');
  assert.deepEqual(marchToTerrain(from, [1, 0, 0], 4.86 * cs, t), { len: 4.86 * cs, hit: null });
  assert.equal(marchToTerrain(muzzle(0.69), norm3(sub3(ground(3), muzzle(0.69))), 4.86 * cs, board([2])).hit, 'wall');
}
console.log('round-path: exact ground, wall top, wall side and air ends; the head lands exactly on the end at 30/60/144 Hz');

// THE LANCE ALONG ITS CURVE (2026-10-01): the beam descends at the barrel's pitch along the great circle; its stop is solved on that
// same curve, so a level lance from a parapet skims every wall and a depressed one digs into the ground where it is drawn to
import { marchAlongArc, arcOf, pointAlongArc } from '../src/domain/round-path.js';
const norm3s = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
{
  const wallHeight = 0.02, step = 0.002, open = { cellAt: () => 0, tags: [0], wallHeight, step, clearance: 0.001, ownCi: -1 };   // one open cell everywhere (tag 0 is BLOCKED... so use 1)
  open.tags = [1];
  const from = [0, 1 + wallHeight, 0];
  // level: the arc keeps the muzzle's altitude and never meets the ground
  let a = arcOf(from, [1, 0, 0]);
  assert.ok(Math.abs(a.slope) < 1e-12 && Math.abs(a.r0 - (1 + wallHeight)) < 1e-12);
  assert.deepEqual(marchAlongArc(a.fromU, a.dTan, a.r0, a.slope, 0.3, open), { len: 0.3, hit: null }, 'a level lance flies its whole reach');
  // depressed at a body on the ground 3 cells out (a cell is 0.0133 here): the curve meets the ground about there
  const body = [Math.sin(0.04), Math.cos(0.04), 0], dir = (() => { const d = [body[0] - from[0], body[1] - from[1], body[2] - from[2]], l = Math.hypot(...d); return d.map((v) => v / l); })();
  a = arcOf(from, dir);
  assert.ok(a.slope < 0, 'aimed down');
  const stop = marchAlongArc(a.fromU, a.dTan, a.r0, a.slope, 0.3, open);
  assert.equal(stop.hit, 'ground');
  const p = pointAlongArc(a.fromU, a.dTan, a.r0, a.slope, stop.len);
  assert.ok(Math.hypot(...p) >= 1 - 0.0015 && Math.hypot(...p) <= 1 + 0.004, `the stop is at the ground (${Math.hypot(...p)})`);
  assert.ok(stop.len > 0.035 && stop.len < 0.06, `about where the body stands (${stop.len})`);
  // a wall a cell ahead of a level lance is skimmed (same height); one the beam is aimed down into stops it
  const walled = { ...open, cellAt: (u) => (u[0] > 0.01 ? 1 : 0), tags: [1, 0] };
  const level = arcOf(from, [1, 0, 0]);
  assert.equal(marchAlongArc(level.fromU, level.dTan, level.r0, level.slope, 0.3, walled).hit, null, 'a parapet-high lance clears walls of its own height');
  const down = arcOf(from, dir);
  assert.equal(marchAlongArc(down.fromU, down.dTan, down.r0, down.slope, 0.3, walled).hit, 'wall', 'a depressed one digs into the wall ahead');
  // ROCK IS NOT SKIMMED (2026-10-02): a beam dipping a little under a rock's top passes with the ground's clearance and stops on the rock's
  // face with rockClearance, its end where it enters the rock (the first sample past x = 0.01 is inside)
  const grazing = { ...walled, cellAt: (u) => (u[0] > 0.01 && u[0] < 0.02 ? 1 : 0), clearance: wallHeight * 0.6 }, slight = arcOf(from, norm3s([1, -0.3 * wallHeight / 0.012, 0]));
  assert.equal(marchAlongArc(slight.fromU, slight.dTan, slight.r0, slight.slope, 0.3, grazing).hit, 'ground', 'with the ground\'s clearance it slipped through the rock top and only the ground beyond stopped it');
  const rocky = marchAlongArc(slight.fromU, slight.dTan, slight.r0, slight.slope, 0.3, { ...grazing, rockClearance: 0.0001 });
  assert.equal(rocky.hit, 'wall', 'with rockClearance the rock stops it');
  assert.ok(Math.abs(rocky.len - 0.01) < 0.0005, `on the rock's face (${rocky.len})`);
}
console.log('round-path: the lance\'s curve descends at the barrel\'s pitch and stops where it is drawn to meet the ground or a wall.');
