// body-quads.mjs — round four of the Pearl set (owner, 2026-10-13: "enemies clipping through walls when there are too many"; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 4"): the walls are drawn as the board's quads, not as the nearest-centre regions, so
// the reach query and the clearance take the drawn quads too (src/domain/body-reach.js), and a squad files through a passage narrower than its line
// (src/fx/creature-pearl.js `fold`). A skewed planar quad board: the query against brute force, the clearance never more than the truth, a point
// inside a blocked quad (nearer an open centre) pushed out of it, a squad in a corridor.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createReachQuery, clearOf } from '../src/domain/body-reach.js';
import { PEARL_TIERS, PEARL_FOLLOW, PEARL_PACE, PEARL_IMPACT, PEARL_GAIT } from '../src/content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH } from '../src/content/creature-enemies.js';
import { createPearlFamily } from '../src/fx/creature-pearl.js';
import { PEARL_BODIES } from '../src/fx/creature-enemies.js';
import { BODY_RADII } from '../src/fx/cutis-maku/swarm.js';

// a 24 x 24 grid of 10 m quads, every inner vertex moved up to 3 m (Stalberg-like irregular quads), the plane far above the origin as the sphere
const N = 24, S = 10, H = 1e5, J = 3;
let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const vertices = [];
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const inner = i > 0 && j > 0 && i < N && j < N; vertices.push([(i - N / 2) * S + (inner ? (rnd() - 0.5) * 2 * J : 0), H, (j - N / 2) * S + (inner ? (rnd() - 0.5) * 2 * J : 0)]); }
const quads = [], centers = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; quads.push([a, a + 1, a + N + 2, a + N + 1]); }
for (const q of quads) { const m = [0, 0, 0]; for (const v of q) for (let k = 0; k < 3; k++) m[k] += vertices[v][k] / 4; centers.push(m); }
const adj = quads.map((_, c) => { const i = c % N, j = Math.floor(c / N), out = []; if (i > 0) out.push(c - 1); if (i < N - 1) out.push(c + 1); if (j > 0) out.push(c - N); if (j < N - 1) out.push(c + N); return out; });
// a corridor two cells wide (rows 11 and 12), rock either side
const open = (c) => { const j = Math.floor(c / N); return j === 11 || j === 12; }, blocked = (c) => !open(c);
const toSphere = (x, z) => [x, H, z];
// the truth in the plane
const inPoly = (q, x, z) => { let inside = false; for (let k = 0; k < 4; k++) { const a = vertices[q[k]], b = vertices[q[(k + 1) % 4]]; if ((a[2] > z) !== (b[2] > z) && x < a[0] + (z - a[2]) / (b[2] - a[2]) * (b[0] - a[0])) inside = !inside; } return inside; };
const quadAt = (x, z) => quads.findIndex((q) => inPoly(q, x, z));
const nearest = (x, z) => { let best = -1, bd = Infinity; centers.forEach((c, i) => { const d = (c[0] - x) ** 2 + (c[2] - z) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
const segDist = (x, z, a, b) => { const ex = b[0] - a[0], ez = b[2] - a[2], t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[2]) * ez) / (ex * ex + ez * ez))); return Math.hypot(a[0] + ex * t - x, a[2] + ez * t - z); };
const toBlockedQuads = (x, z) => { let d = Infinity; quads.forEach((q, c) => { if (!blocked(c)) return; if (inPoly(q, x, z)) d = -1; else for (let k = 0; k < 4 && d >= 0; k++) d = Math.min(d, segDist(x, z, vertices[q[k]], vertices[q[(k + 1) % 4]])); }); return d; };

const query = createReachQuery({ adj, centers, blocked, step: 1.5, quads, vertices });
const voronoi = createReachQuery({ adj, centers, blocked, step: 1.5 });
{
  let drawnOnly = 0;
  for (let n = 0; n < 4000; n++) {
    const x = (rnd() - 0.5) * 120, z = (rnd() - 0.5) * 60, q = quadAt(x, z), c = nearest(x, z);
    if (q < 0) continue;
    assert.equal(query.quadOf(c, toSphere(x, z)), q, `the drawn quad holding (${x.toFixed(2)}, ${z.toFixed(2)})`);
    const want = blocked(c) || blocked(q);
    assert.equal(query.at(toSphere, x, z, c), want, `blocked by its region or its drawn quad at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    if (!blocked(c) && blocked(q)) { drawnOnly++; assert.equal(voronoi.at(toSphere, x, z, c), false, 'the regions alone miss it'); }
  }
  assert(drawnOnly > 20, `the board has drawn rock outside the blocked regions (${drawnOnly} points)`);
}
console.log('PASS the reach query against the drawn quads: a point is blocked by its region or by the drawn quad holding it (the regions alone miss some)');
{
  const out = [0, 0, 0, 0, 0, 0];
  let negatives = 0;
  for (let n = 0; n < 3000; n++) {
    const x = (rnd() - 0.5) * 120, z = (rnd() - 0.5) * 30, c = nearest(x, z);
    if (blocked(c)) continue;
    query.clearance(toSphere, x, z, 25, c, out);
    const truth = toBlockedQuads(x, z);
    if (truth < 0) { negatives++; assert(out[0] < 0, `inside a drawn blocked quad the clearance is negative (${out[0]})`); continue; }
    assert(out[0] <= truth + 1e-6, `never more than the distance to the drawn rock (${out[0]} > ${truth} at ${x.toFixed(2)}, ${z.toFixed(2)})`);
  }
  assert(negatives > 5, `some open-region points are inside drawn rock (${negatives})`);
  // pushed out: a point inside a drawn blocked quad (its nearest centre open) is moved to rho of open ground from every drawn blocked quad
  let pushed = 0;
  for (let n = 0; n < 3000 && pushed < 40; n++) {
    const x = (rnd() - 0.5) * 120, z = (rnd() - 0.5) * 30, c = nearest(x, z);
    if (blocked(c) || toBlockedQuads(x, z) >= 0) continue;
    const C = clearOf((px, pz, max, o) => query.clearance(toSphere, px, pz, max, nearest(px, pz), o), x, z, 3, 3, [0, 0, 0, 0, 0, 0, 0]);
    const d = toBlockedQuads(x + C[0], z + C[1]);
    assert(d >= Math.min(3, C[2]) - 0.05, `pushed clear of the drawn rock (${d} for room ${C[2]})`);
    pushed++;
  }
  assert(pushed >= 10, `points in the drawn rock pushed out (${pushed})`);
}
console.log('PASS the clearance with the drawn quads: never more than the distance to the drawn rock, negative inside it, clearOf pushes a point out of it');

// ---- a squad in the corridor (20 m wide, the squad's line ~29 m: 2.2 of the white's 2026-10-15 radius of 2.8 m apart, whatever PEARL_FOLLOW.squad says now (1.1
// since 2026-10-15) and whatever the white's radius is now (0.4 of it since 2026-10-16: a line of five at 2.2 radii would fit the lane and fold nothing)): its
// members file behind each other within the lane ----
{
  const hubs = { count: 1, quat: () => [0, 0, 0, 1], remap: (a, b, x, z) => [x, z], reach: (k, x, z, dx, dz, max, cell) => query(toSphere, x, z, dx, dz, max, cell >= 0 ? cell : nearest(x, z)),
    clear: (k, x, z, rho, cell, out, steps = 3) => clearOf((px, pz, max, o) => query.clearance(toSphere, px, pz, max, nearest(px, pz), o), x, z, rho, steps, out) };
  const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: { ...PEARL_FOLLOW, squad: { gap: 2.2 * 2.8 / PEARL_BODIES.amoeba.r0, stagger: 2 } }, impact: PEARL_IMPACT, pace: PEARL_PACE, gait: PEARL_GAIT, hubs });
  const r = PEARL_BODIES.amoeba.r0, cell0 = nearest(-80, 0), h = fam.add('amoeba', { x: -80, z: 0, angle: 0, members: 5, speed: 2, cell: cell0 });
  assert.equal(h.slots.length, 5);
  for (let f = 0; f < 60; f++) { const x = -80 + f * 0.05; fam.track(h, { x, z: 0, ax: x + 4, az: 0, dt: 1 / 60, members: 5, speed: 2, cell: nearest(x, 0) }); fam.step(1 / 60); }
  const folded = h.slots.filter((s) => s.f), across = h.slots.map((s) => (s.f ?? s.s)[0]);
  assert(folded.length >= 2, `the outer members fold into the lane (${folded.length})`);
  for (const s of h.slots) { const [a, l] = s.f ?? s.s; const rho = r * BODY_RADII; assert(Math.abs(a) <= Math.max(0, 10 - rho) + 3 + 1e-6, `a member's spot across within the lane (${a})`); if (s.f) assert(l < s.s[1], 'what is cut off goes behind'); }
  console.log(`  squad spots across ${across.map((a) => a.toFixed(1)).join(' ')} m (unfolded ${h.slots.map((s) => s.s[0].toFixed(1)).join(' ')})`);
}
console.log('PASS a squad files through a corridor narrower than its line: its outer members\' spots folded into the lane, behind');
