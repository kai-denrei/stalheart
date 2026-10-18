// THE SOFT HUNT (owner, 2026-10-18, round three, note 2: "the weaker units (white and yellows) need to be faster and more aggressive towards a) priority 1
// the Tank, they flank and surround and try to attack it although they cannot, or b) the gates, whichever is closer"). The rule (src/domain/soft-hunt.js:
// the goal by walking distance and the bias, the pace, the stagger, the ring's bearings and layers, the open spot, the jab) and the walk
// (src/fx/soft-hunt.js) on a small grid on the sphere: a group comes to the ring and surrounds the hull, circles and jabs short of the ram, keeps out
// of the rock, re-aims when the hull moves, goes back to the lanes when it drives off.
import assert from 'node:assert/strict';
import { isSoftHunter, huntGoal, huntPace, firstDecision, huntDue, ringBearing, ringLayer, ringPoint, findRingSpot, jabAt, jabPeaked, stepToward, stepRound } from '../src/domain/soft-hunt.js';
import { SOFT_HUNT } from '../src/content/soft-hunt.js';
import { PEARL_OF } from '../src/content/pearl-enemies.js';
import { createSoftHunt } from '../src/fx/soft-hunt.js';
import { bfsDist } from '../src/dungeon.js';

const T = SOFT_HUNT, close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// ---- the goal, the pace ----
{
  assert(isSoftHunter('white', T) && isSoftHunter('yellow', T) && !isSoftHunter('blue', T) && !isSoftHunter(undefined, T), 'the soft tiers hunt, no other');
  assert.equal(huntGoal({ hullDist: 5, gateDist: 9 }, T), 'hull', 'the nearer hull');
  assert.equal(huntGoal({ hullDist: 9 + T.bias, gateDist: 9 }, T), 'hull', 'the hull within the bias of equal: priority 1 the Tank');
  assert.equal(huntGoal({ hullDist: 9 + T.bias + 1, gateDist: 9 }, T), 'gate', 'past the bias, the nearer gate');
  assert.equal(huntGoal({ hullDist: -1, gateDist: 9 }, T), 'gate', 'an unreachable hull is no goal');
  assert.equal(huntGoal({ hullDist: undefined, gateDist: 9 }, T), 'gate', 'no hull, the gate');
  assert.equal(huntGoal({ hullDist: 30, gateDist: -1 }, T), 'hull', 'no gate to walk to, the hull');
  assert.equal(huntPace('white', T, 'hull'), 1.35); assert.equal(huntPace('yellow', T, 'hull'), 1.25);
  assert.equal(huntPace('white', T, 'gate'), 1, 'the gate walk is the walk as it was');
}
console.log('PASS the goal by walking distance (the hull within the bias, else the gate), the faster walk only at the hull');

// ---- the stagger ----
{
  const at = Array.from({ length: 40 }, (_, id) => firstDecision(id, 10, T.every));
  assert(at.every((t) => t >= 10 && t < 10 + T.every), 'every first decision within one period');
  const bins = new Set(at.map((t) => Math.floor(((t - 10) / T.every) * 10)));
  assert(bins.size >= 9, `spread over the period, not on one frame (${bins.size} of 10 tenths)`);
  assert(huntDue(null, 0) && huntDue({ at: 5 }, 5) && !huntDue({ at: 5 }, 4.9));
}
console.log('PASS the decisions staggered over one period by id');

// ---- the ring: bearings, layers, the open spot ----
{
  const b8 = Array.from({ length: 8 }, (_, id) => ringBearing(id, 8));
  b8.forEach((b, k) => close(b, (k / 8) * Math.PI * 2, 1e-12, `slot ${k}`));
  const b16 = Array.from({ length: 16 }, (_, id) => ringBearing(id, 8)), sorted = [...b16].sort((a, b) => a - b);
  assert(sorted.every((b, k) => k === 0 || b - sorted[k - 1] > 1e-3), 'a second round of ids between the first, not on it');
  assert.equal(ringLayer(3, 8, T), T.ring); close(ringLayer(11, 8, T), T.ring + T.layer, 1e-12, 'the second round a ring out'); assert.equal(ringLayer(24, 8, T), T.ring, 'layers repeat');
  const p = ringPoint(Math.PI / 2, 2); close(p[0], 0, 1e-12, 'x'); close(p[1], 2, 1e-12, 'y');
  assert.deepEqual(findRingSpot({ bearing: 1, radius: 1.2, open: () => true, tune: T }), { bearing: 1, radius: 1.2 }, 'its own spot when open');
  const s = findRingSpot({ bearing: Math.PI / 2, radius: 1.2, open: ([x, y]) => y < 0.6, tune: T });
  assert(s && Math.sin(s.bearing) * s.radius < 0.6 && s.radius === 1.2, 'the nearest open bearing at the full ring');
  const half = Math.PI / T.slots; close(Math.abs(s.bearing - Math.PI / 2) % half, 0, 1e-9, 'half a slot at a time');
  const s2 = findRingSpot({ bearing: 0, radius: 1.2, open: ([x, y]) => Math.hypot(x, y) < 1.0, tune: T });
  close(s2.radius, 1.2 * T.minRing, 1e-12, 'then nearer in'); assert.equal(findRingSpot({ bearing: 0, radius: 1.2, open: () => false, tune: T }), null, 'none open: none');
}
console.log('PASS the ring: a slot each (id mod slots), later rounds between and a ring out, the nearest open spot');

// ---- the jab, the step ----
{
  const J = T.jab, out = [], peaks = [];
  for (let t = 0; t < J.every * 5; t += 1 / 120) { out.push(jabAt(t, 0.3, T.ring, J)); if (jabPeaked(t, t + 1 / 120, 0.3, J)) peaks.push(t); }
  const min = Math.min(...out.map((o) => o.radius)), max = Math.max(...out.map((o) => o.radius));
  close(min, J.depth, 1e-3, 'the jab reaches its depth'); close(max, T.ring, 1e-12, 'and is back on the ring');
  assert(J.depth > 0.4 + 0.3, 'its depth is short of the record\'s touch (0.4 cells) and the hull\'s box with its pad');
  assert.equal(peaks.length, 5, 'one tap a jab');
  for (const t of peaks) close(jabAt(t + 1 / 240, 0.3, T.ring, J).radius, J.depth, 2e-3, 'the tap at the deepest');
  assert(out.filter((o) => o.radius < T.ring).length / out.length < 0.5, 'jabbing less than half the time');
  assert(jabPeaked(0, J.every * 2, 0, J), 'a long gap holds a peak');
  assert.deepEqual(stepToward([0, 0], [3, 4], 1), [0.6, 0.8000000000000002].map((v, k) => [0.6, 0.8][k])); assert.deepEqual(stepToward([0, 0], [0.3, 0.4], 1), [0.3, 0.4], 'arrives');
  // round the hull: from one side to the other, the radius never under the smaller of the two
  let at = [1.2, 0], minR = Infinity;
  for (let k = 0; k < 200; k++) { at = stepRound(at, [-1.2, 0.01], 0.05); minR = Math.min(minR, Math.hypot(...at)); }
  close(at[0], -1.2, 1e-9, 'it arrives'); assert(minR > 1.19, `round, not through (${minR})`);
  at = [3, 0]; for (let k = 0; k < 200; k++) at = stepRound(at, [0, 1.2], 0.05); close(at[1], 1.2, 1e-9, 'from out wide onto its spot');
  const one = stepRound([2, 0], [1, 0], 0.25); close(one[0], 1.75, 1e-12, 'straight in on its own bearing');
}
console.log('PASS the jab: in to its depth (short of the ram) and back, one tap at its deepest; the step toward a moving spot, round the hull to the far side');

// ---- the walk on a grid on the sphere ----
// a 41 x 41 patch of cells round the north pole, side cs; `blocked(i, j)` the rock
function world(blocked = () => false) {
  const N = 41, cs = 0.01, centers = [], adj = [], tags = [], idx = (i, j) => i * N + j;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i - 20) * cs, y = (j - 20) * cs, l = Math.hypot(x, y, 1);
    centers.push([x / l, y / l, 1 / l]); tags.push(blocked(i - 20, j - 20) ? 0 : 1);
    adj.push([[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => idx(a, b)));
  }
  return { cs, centers, adj, tags, idx: (i, j) => idx(i + 20, j + 20) };
}
const CLOCK = { t: 0 }, OPENS = { n: 0 };   // OPENS: the host's openness checks (a step's, and every one `aim` makes)
function run({ w, recs, hull, secs, onFrame, tune = null }) {
  let field = null, fieldAt = -1;
  const host = { hull: () => hull.cur >= 0 ? hull : null, field: () => field, graph: () => ({ adj: w.adj, centers: w.centers }), cellSide: () => w.cs, open: (ci) => { OPENS.n++; return w.tags[ci] !== 0; }, tune: () => tune,
    gateDist: () => 30, enemies: () => recs, tap: (e) => { e.taps = (e.taps ?? 0) + 1; } };
  const sh = createSoftHunt(host);
  let t = CLOCK.t;   // one clock across the runs: a record's next decision is on it
  for (let f = 0; f < secs * 60; f++) {
    const dt = 1 / 60; t += dt;
    if (hull.cur !== fieldAt) { field = hull.cur >= 0 ? bfsDist(w.adj, [hull.cur], (i) => w.tags[i] !== 0) : null; fieldAt = hull.cur; }
    for (const e of recs) {
      let pace = 0.5 * sh.pace(e, t);   // 0.5 cells a second, the white's walk at pace 1.35
      const ringPace = pace; if (sh.ringed(e)) pace = 0;
      // the lane's walk, as the enemy loop's (src/fx/enemy-step.js) in short: down the field toward the hull while it is the goal, else it stands
      e.prog += pace * dt;
      while (e.prog >= 1) { e.prog -= 1; e.cur = e.next; const ex = w.adj[e.cur].filter((c) => w.tags[c] !== 0 && field && sh.wants(e) && field[c] >= 0 && field[c] < field[e.cur]); e.next = ex.length ? ex[e.id % ex.length] : e.cur; }
      const a = w.centers[e.cur], b = w.centers[e.next], f = Math.min(1, e.prog), q = [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * f), l = Math.hypot(...q);
      e.pos = q.map((v) => v / l);
      sh.place(e, ringPace, dt, t);
    }
    onFrame?.(t, sh);
  }
  CLOCK.t = t;
  return sh;
}
const rec = (w, id, i, j) => ({ id, type: 'amoeba', alive: true, cur: w.idx(i, j), next: w.idx(i, j), prog: 0, pos: w.centers[w.idx(i, j)].slice(), dir: [1, 0, 0] });
const angle = (w, hull, e) => { const d = [e.pos[0] - hull.pos[0], e.pos[1] - hull.pos[1]]; return [Math.hypot(...d) / w.cs, Math.atan2(d[1], d[0])]; };
{
  const w = world(), hull = { cur: w.idx(0, 0), pos: w.centers[w.idx(0, 0)].slice() };
  // eight whites coming from one side: they spread round the hull, not one file (a slot on the far side is a walk round the hull: a flank)
  const recs = Array.from({ length: 8 }, (_, k) => rec(w, k, 2, k - 4 + (k >= 4 ? 1 : 0)));
  assert.equal(recs.filter((e) => PEARL_OF[e.type] === 'white').length, 8);
  let closest = Infinity, offOpen = 0;
  const sh = run({ w, recs, hull, secs: 22, onFrame: (t) => { if (t > CLOCK.t + 8) for (const e of recs) closest = Math.min(closest, angle(w, hull, e)[0]); } });
  const st = sh.state();
  assert.equal(st.hunting, 8, `all eight hunt the hull (${JSON.stringify(st)})`); assert.equal(st.ringed, 8, 'all on the ring\'s walk');
  assert(st.atHull >= 6, `on the ring (${JSON.stringify(st)})`);
  const octants = new Set(recs.map((e) => Math.floor(((angle(w, hull, e)[1] + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4))));
  assert(octants.size >= 6, `they surround it (${octants.size} of 8 octants)`);
  assert(closest >= T.jab.depth - 0.05, `the jab stops short of the ram (closest ${closest.toFixed(2)} cells)`);
  assert(closest < T.ring - 0.2, `but they do jab (closest ${closest.toFixed(2)} cells)`);
  assert(recs.every((e) => e.taps > 0) && st.taps === recs.reduce((a, e) => a + e.taps, 0), 'every one taps the hull');
  // the hull moves a cell and a half: they re-aim and close on the new ring
  hull.cur = w.idx(1, 1); hull.pos = w.centers[hull.cur].slice();
  run({ w, recs, hull, secs: 8 });
  const r = recs.map((e) => angle(w, hull, e)[0]);
  assert(r.every((d) => d > T.jab.depth - 0.05 && d < T.ring + T.layer * 2 + 0.3), `round the moved hull (${r.map((d) => d.toFixed(2))})`);
  // the hull drives off past `leave`: back to the lanes, from where they stand (prog 1: the loop picks the next exit; the gap eased)
  hull.cur = w.idx(12, 12); hull.pos = w.centers[hull.cur].slice();
  const sh2 = run({ w, recs, hull, secs: 0.25 });
  assert.equal(sh2.state().ringed, 0, 'released when the hull drives off');
  assert(recs.every((e) => e.hunt.goal === 'hull' && e.hunt.off), 'still hunting it, on the lanes, the gap eased');
  hull.cur = -1;
  const sh3 = run({ w, recs, hull, secs: 1 }); const s3 = sh3.state();
  assert(s3.hunting === 0 && s3.atGate === 8, `no hull: the gate (${JSON.stringify(s3)})`);
}
console.log('PASS the walk: eight whites from one side surround the hull on the ring, circle and jab short of the ram (a tap each), re-aim when it moves, go back to the lanes when it drives off, to the gate without it');
{
  // a corridor two cells wide along x: the ring's spots across it are rock; they stand only on open cells, at both ends
  const w = world((i, j) => Math.abs(j) > 1), hull = { cur: w.idx(0, 0), pos: w.centers[w.idx(0, 0)].slice() };
  const recs = Array.from({ length: 8 }, (_, k) => rec(w, k, k < 4 ? 2 : -2, (k % 4) - 1 > 1 ? 1 : (k % 4) - 1));
  let rock = 0;
  const sh = run({ w, recs, hull, secs: 12, onFrame: () => { for (const e of recs) if (w.tags[e.cur] === 0) rock++; } });
  assert.equal(rock, 0, 'never on a rock cell');
  assert(sh.state().ringed === 8, `all on the ring's walk in the corridor (${JSON.stringify(sh.state())})`);
  const sides = new Set(recs.map((e) => Math.sign(e.pos[0] - hull.pos[0])));
  assert.equal(sides.size, 2, 'at both ends of the hull');
}
console.log('PASS in a corridor: never on rock, the group at both ends of the hull');
{
  // the tune panel's knobs: hunt pace x and the ring
  const w = world(), hull = { cur: w.idx(0, 0), pos: w.centers[w.idx(0, 0)].slice() }, recs = [rec(w, 0, 1, 0)];
  const tune = { pace: 2, ring: 2 }; let pace = 0;
  run({ w, recs, hull, secs: 6, tune, onFrame: () => {} });
  const sh = createSoftHunt({ hull: () => hull, field: () => null, graph: () => ({ adj: w.adj, centers: w.centers }), cellSide: () => w.cs, open: () => true, tune: () => tune, gateDist: () => 30, enemies: () => [] });
  const e = rec(w, 1, 1, 0); e.hunt = { goal: 'hull', at: 1e9, ringed: false }; pace = sh.pace(e, 0);
  close(pace, 1.35 * 2, 1e-12, 'hunt pace x the knob');
  const [d] = angle(w, hull, recs[0]); assert(d > 1.6 && d < 2.1, `the ring at the knob's radius (${d.toFixed(2)})`);
}
console.log('PASS the tune panel\'s knobs: hunt pace x, the ring\'s radius');
// a ringed body blocked on its way: it re-aims on the decision tick (not every frame) and is released after three blocked decisions, then kept off the ring
{
  const w = world(), hull = { cur: w.idx(0, 0), pos: w.centers[w.idx(0, 0)].slice() }, recs = [rec(w, 0, 3, 0)];
  run({ w, recs, hull, secs: 14 });
  const e = recs[0]; assert(e.hunt.ringed, 'ringed first');
  hull.cur = w.idx(0, 2); hull.pos = w.centers[hull.cur].slice();   // the spot moves (the body is not on it), the hull stays within `leave`
  const ci = Math.floor(e.cur / 41) - 20, cj = (e.cur % 41) - 20;
  let walled = false, opens0 = 0, opens1 = 0, releasedAt = null;
  const t0 = CLOCK.t;
  run({ w, recs, hull, secs: 6, onFrame: (t) => {
    if (!walled) { walled = true; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) w.tags[w.idx(ci + a, cj + b)] = 0; opens0 = OPENS.n; }   // rock all round it, after the field was laid
    if (t - t0 > 1 && t - t0 < 2) opens1 = OPENS.n;
    if (releasedAt == null && !e.hunt.ringed) releasedAt = t - t0;
  } });
  assert(!e.hunt.ringed && releasedAt != null, `released after its blocked decisions (ringed ${e.hunt.ringed})`);
  assert(releasedAt <= 5 * T.every + 0.1, `within three blocked decisions after the one in flight and the one that finds it stopped (${releasedAt?.toFixed(2)} s, every ${T.every})`);
  assert(opens1 - opens0 < 400, `a blocked body does not re-aim every frame (${opens1 - opens0} openness checks in the first second, one a frame is 60 and an aim is a dozen)`);
  run({ w, recs, hull, secs: 3 });
  assert(!e.hunt.ringed, 'kept off the ring for a while after it was let go');
}
console.log('PASS a ringed body blocked on its way re-aims on the decision tick and is released after three blocked decisions');
