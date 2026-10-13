// body-footprint.mjs — round three of the Pearl set (owner, 2026-10-13: "not bad. there is still some clipping of the Cutis-Pearl through the walls"; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 3"): the clearance query (src/domain/body-reach.js query.clearance, clearPush, clearOf)
// against the board's own blocked rule, and a swarm of every Pearl tier whose WHOLE membrane (the shader's deform in JS, src/fx/cutis-maku/deform.js, over
// the lowest hull's vertex directions) stays off the rock in a wide and a narrow corridor with a side branch, the knot's body wider than the narrow one.
import assert from 'node:assert/strict';
import { createReachQuery, nearestCellFrom, freeReach, clearPush, clearOf } from '../src/domain/body-reach.js';
import { CutisSwarm, STEP, BODY_RADII } from '../src/fx/cutis-maku/swarm.js';
import { DEFAULT_CONFIG } from '../src/fx/cutis-maku/config.js';
import { MEMBRANE_VERT } from '../src/fx/cutis-maku/shaders.js';
import { deformInto, FOOTPRINT_DIRS } from '../src/fx/cutis-maku/deform.js';
import { PEARL_TIERS } from '../src/content/pearl-enemies.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// a planar grid of 10 m cells (centres far above the origin, as test/body-reach.mjs): a corridor two cells wide (|z| < 10 m)
function grid(N, open) {
  const centers = [], adj = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    centers.push([(c - N / 2 + 0.5) * 10, 1e5, (r - N / 2 + 0.5) * 10]);
    const n = []; if (c > 0) n.push(r * N + c - 1); if (c < N - 1) n.push(r * N + c + 1); if (r > 0) n.push((r - 1) * N + c); if (r < N - 1) n.push((r + 1) * N + c); adj.push(n);
  }
  const free = new Set(); centers.forEach((c, i) => { if (open(c[0], c[2])) free.add(i); });
  return { centers, adj, blocked: (ci) => !free.has(ci) };
}
const flat = (x, z) => [x, 1e5, z];

// ---- the clearance on the planar corridor ----
{
  const g = grid(30, (x, z) => Math.abs(z) < 15), q = createReachQuery({ ...g, step: 1.5 }), out = [];
  q.clearance(flat, 0, 0, 30, -1, out); close(out[0], 10, 1e-6, 'the corridor\'s middle: 10 m to either wall'); close(out[3], 10, 1e-6, 'and the far wall faces it');
  q.clearance(flat, 0, 7, 8, -1, out); close(out[0], 3, 1e-6, '3 m from the near wall'); close(out[2], -1, 1e-9, 'away from it'); close(out[3], 17, 1e-6, 'the far wall');
  q.clearance(flat, 3, 9.9, 8, -1, out); close(out[0], 0.1, 1e-6, 'at the wall'); assert(!(out[3] < 17), 'the same wall\'s next cell is not a facing wall');
  q.clearance(flat, 0, 12, 8, -1, out); close(out[0], -2, 1e-6, 'on the rock: 2 m from open ground, negative'); close(out[2], -1, 1e-9, 'the way out');
  q.clearance(flat, 0, 0, 100, -1, out); assert(out[0] <= 22 + 1e-6, `the far look is capped at 2.2 cells (${out[0]})`);
  // one step: along the near wall's normal; a corridor narrower than the body: centred, the room what fits
  const p = clearPush([3, 0, -1, 17, 0, 1], 4); close(p[1], -1, 1e-9, 'pushed 1 m off the wall'); close(p[2], 4, 1e-9, 'the whole footprint fits');
  const c = clearPush([1, 0, 1, 7, 0, -1], 5); close(c[1], 3, 1e-9, 'centred in an 8 m corridor'); close(c[2], 4, 1e-9, 'room 4 m for a 5 m footprint');
  const o = clearOf((x, z, m, r) => q.clearance(flat, x, z, m, -1, r), 3, 9.9, 4); close(o[1], -3.9, 1e-6, 'clearOf: off the wall'); close(o[5], 4, 1e-6, 'and measured where it ended'); close(o[6], 0.1, 1e-6, 'from where it began');
}
// a corner (an L of rock: the corridor turns), the second wall found after the first move
{
  const g = grid(30, (x, z) => (Math.abs(z) < 15 && x < 15) || (Math.abs(x - 5) < 15 && z > -15)), q = createReachQuery({ ...g, step: 1.5 });
  const o = clearOf((x, z, m, r) => q.clearance(flat, x, z, m, -1, r), 18, -18, 4);
  const out = []; q.clearance(flat, 18 + o[0], -18 + o[1], 8, -1, out);
  assert(out[0] >= 4 - 1e-6, `clearOf out of a corner: ${out[0]} m clear after (${o[0].toFixed(2)}, ${o[1].toFixed(2)})`);
}
console.log('PASS the clearance: the nearest blocked region\'s distance and direction, the facing wall, on the rock negative, the push, the corridor\'s centring and room, a corner in two moves');

// ---- the clearance is never more than the truth, on an irregular quad board with edge neighbours only (as the Stalberg grid's) on a sphere ----
{
  const R = 750, W = 32;
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts = []; for (let r = 0; r < W; r++) for (let c = 0; c < W; c++) pts.push([(c - W / 2) * 10 + (rnd() - 0.5) * 6, (r - W / 2) * 10 + (rnd() - 0.5) * 6]);
  const toSphere = (x, z) => { const d = Math.hypot(x, z), t = d / R, s = d > 1e-12 ? Math.sin(t) / d : 1 / R; return [x * s, Math.cos(t), z * s]; };
  const centers = pts.map(([x, z]) => toSphere(x, z));
  const adj = pts.map((_, i) => { const r = Math.floor(i / W), c = i % W, n = []; if (c > 0) n.push(i - 1); if (c < W - 1) n.push(i + 1); if (r > 0) n.push(i - W); if (r < W - 1) n.push(i + W); return n; });
  const rock = new Set(); pts.forEach(([x, z], i) => { if (Math.sin(x / 31) + Math.cos(z / 19) > 0.7 || rnd() < 0.1) rock.add(i); });
  const blocked = (c) => rock.has(c), q = createReachQuery({ adj, centers, blocked, step: 1.5 });
  // the truth by the board's rule over every cell, sampled round the point
  const nearest = (x, z) => { const p = toSphere(x, z); let b = 0, bd = -2; for (let i = 0; i < centers.length; i++) { const d = centers[i][0] * p[0] + centers[i][1] * p[1] + centers[i][2] * p[2]; if (d > bd) { bd = d; b = i; } } return b; };
  const truth = (x, z, max) => { let best = max; for (let a = 0; a < 60; a++) for (let d = 0.1; d < best; d += 0.1) if (blocked(nearest(x + Math.cos(a * Math.PI / 30) * d, z + Math.sin(a * Math.PI / 30) * d))) { best = d; break; } return best; };
  const out = []; let n = 0, slack = 0;
  for (let k = 0; n < 50 && k < 400; k++) {
    const x = (rnd() - 0.5) * 220, z = (rnd() - 0.5) * 220, at = nearest(x, z);
    if (blocked(at)) continue;
    const max = [8, 14][k % 2]; q.clearance(toSphere, x, z, max, at, out);
    const t = truth(x, z, Math.min(max, out[0] + 1));
    assert(out[0] <= t + 0.15, `the clearance never claims ground it did not look at (${out[0].toFixed(2)} m, the truth ${t.toFixed(2)} m)`);
    slack += t - out[0]; n++;
  }
  assert(n >= 40 && slack / n < 0.6, `tight: ${(slack / n).toFixed(2)} m short on average over ${n} points`);
}
console.log('PASS the clearance on an irregular quad board: never more than the truth (the board\'s nearest-centre rule), a few tenths short on average');

// ---- the shader and its JS twin carry the same round-three terms ----
for (const term of ['vec3 off=vec3(iOffset.x,0.,iOffset.z),head=vec3(iHeading.x,0.,iHeading.z);', 'extended.x+=r*(1.-iHeading.y)*(.85*bow*sin(iSeed+1.2)',
  'float squeezeW=phase<.62?1.-reach:1.;', 'squeezeW=1.-reach*(1.-u);', 'float spread=1.+.6*squash;if(iOffset.y>0.&&squash>0.)spread=min(spread,max(1.,iOffset.y));',
  'p.xz-=(ax*dot(d,ax)*(1.-k)+pe*dot(d,pe)*(1.-k2))*squeezeW;']) assert(MEMBRANE_VERT.includes(term), `the membrane shader: ${term}`);
console.log('PASS the membrane shader\'s room, squeeze and sweep damping are the ones deform.js transcribes');

// ---- every tier's whole membrane in a corridor with a side branch: wide (20 m) and narrow (10 m, narrower than the knot) ----
for (const [label, open, lane] of [['wide', (x, z) => Math.abs(z) < 15 || (Math.abs(x - 50) < 15 && z > 0), 0], ['narrow', (x, z) => Math.abs(z - 5) < 6 || (Math.abs(x - 50) < 15 && z > 0), 5]]) {
  const g = grid(40, open), q = createReachQuery({ ...g, step: 1.5 });
  let hint = 0; const rock = (x, z) => g.blocked(hint = nearestCellFrom(g.adj, g.centers, hint, flat(x, z)));
  const clear = (x, z, m, o) => q.clearance(flat, x, z, m, -1, o);
  const bodies = [...PEARL_TIERS.map((t) => [t, 2.8]), [PEARL_TIERS[6], 3.64], [PEARL_TIERS[7], 6.72]];
  for (const [t, r0] of bodies) {
    const sw = new CutisSwarm({ ...DEFAULT_CONFIG, ...t.values, r0, separation: 0.5 }, { capacity: 6 });
    sw.reachLimit = (i, x, z, dx, dz, max) => freeReach(x, z, dx, dz, max, 1.5, rock);
    sw.clearLimit = (i, x, z, rho, out, steps = 3) => clearOf(clear, x, z, rho, steps, out);
    const laps = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) { sw.setTarget(i, 120, lane); sw.place(i, -120 + i * 8, lane + (i - 1.5) * 2, 0); sw.pace[i] = 0.4; }
    let worst = 0, checked = 0;
    const o = [0, 0, 0, 0];
    for (let n = 0; n < 40 * 120; n++) {
      // targets that swing across the corridor (half the time into the rock), the bodies lapping round before the grid's edge
      if (n % 240 === 0) for (let i = 0; i < 4; i++) sw.setTarget(i, Math.min(170, sw.offset[i * 3] + 40), ((n / 240) % 2 ? 1 : -1) * 60);
      sw.step(STEP);
      for (let i = 0; i < 4; i++) if (sw.offset[i * 3] > 150 && sw.getState(i) === 'COIL') { laps[i] += 300; sw.place(i, -150, lane, 0); }
      if (n % 8) continue;
      for (let i = 0; i < 4; i++) {
        const c = sw.position(i);
        for (const d of FOOTPRINT_DIRS) {
          deformInto(sw, i, d, o); checked++;
          if (!rock(o[0], o[2])) continue;
          const dx = o[0] - c[0], dz = o[2] - c[2], l = Math.hypot(dx, dz);
          worst = Math.max(worst, l - (l > 1e-6 ? freeReach(c[0], c[2], dx, dz, l, 0.25, rock) : 0));
        }
      }
    }
    const gone = [0, 1, 2, 3].reduce((a, i) => a + laps[i] + sw.offset[i * 3] + 120 - i * 8, 0) / 4;
    // the knot (its footprint 18 m in a 10 m corridor) is squeezed; a few points of its transfer may graze by a tenth of its radius
    const allow = label === 'narrow' && r0 > 6 ? 0.2 * r0 : 0.02;
    assert(worst <= allow, `${label} ${t.id} r0 ${r0}: the membrane ${worst.toFixed(2)} m into the rock (allowed ${allow})`);
    assert(gone > 120, `${label} ${t.id} r0 ${r0}: the bodies still make their way (${gone.toFixed(0)} m in 40 s)`);
    if (label === 'narrow' && r0 > 6) assert(sw.room[0] > 0 && sw.room[0] < 1, `the knot is squeezed in the narrow corridor (room ${sw.room[0]})`);
    assert(checked > 100000, 'the membrane was looked at');
  }
}
console.log(`PASS every Pearl tier's whole membrane (${FOOTPRINT_DIRS.length} hull directions through the shader's deform) off the rock in a wide and a narrow corridor with a side branch, the bodies making their way, the knot squeezed (BODY_RADII ${BODY_RADII})`);
