// mech-roles.mjs — the four Ridgebacks' walk (src/domain/mech-roles.js; owner, 2026-10-23: "2 will stay near the arena ... 1 makes its way to the
// main base, the other roams and hunts enemies"): the next cell for each role on a small lattice, deterministic for a seeded draw.
import assert from 'node:assert/strict';
import { nextCell, parkCell, huntStep, engageRing, batteryDef, fleeStep } from '../src/domain/mech-roles.js';

// a 10 x 10 grid, 4-connected; the heart at (0,0) = cell 0; the gate at (2,0); rock everywhere at x = 3 except the gate's row
const W = 10, id = (x, y) => y * W + x, adj = [];
for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) adj.push([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < W).map(([a, b]) => id(a, b)));
const rock = new Set(); for (let y = 1; y < W; y++) rock.add(id(3, y));
const open = (c) => !rock.has(c);
const dist = new Array(W * W).fill(Infinity); { dist[0] = 0; const q = [0]; for (let i = 0; i < q.length; i++) for (const nb of adj[q[i]]) if (open(nb) && dist[nb] === Infinity) { dist[nb] = dist[q[i]] + 1; q.push(nb); } }
let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// arena: never leaves its plain, never steps back while it has another way
{ const plain = new Set([id(7, 7), id(8, 7), id(7, 8), id(8, 8), id(9, 8)]);
  let cur = id(7, 7), prev = -1;
  for (let k = 0; k < 200; k++) { const n = nextCell({ role: 'arena', cur, prev, adj, open, rand, plain }); assert.ok(plain.has(n), `stays on the plain (${n})`); assert.ok(adj[cur].includes(n)); prev = cur; cur = n; }
  assert.equal(nextCell({ role: 'arena', cur: id(9, 8), prev: id(8, 8), adj, open, rand, plain }), id(8, 8), 'a dead end turns back'); }
// base: down the heart's field, parked `hops` outside the gate (never through it), and stays parked
{ const park = parkCell({ dist, gate: id(2, 0), hops: 2 }); assert.equal(park, 4, 'parks two cells out from the gate');
  let cur = id(9, 9), steps = 0;
  for (; steps < 100; steps++) { const n = nextCell({ role: 'base', cur, prev: -1, adj, open, rand, dist, park }); if (n === cur) break; assert.ok(dist[n] < dist[cur], 'always nearer the heart'); cur = n; }
  assert.equal(dist[cur], park, 'stands at the park distance'); assert.ok(dist[cur] > dist[id(2, 0)], 'outside the gate');
  assert.equal(nextCell({ role: 'base', cur, prev: -1, adj, open, rand, dist, park }), cur, 'stays'); }
// hunt: the first step of the shortest open path to the nearest enemy cell; never onto an avoided cell (the hull's keep-off); none: a random step
{ const step = huntStep({ cur: id(5, 5), adj, open, targets: new Set([id(5, 9)]), max: 30 });
  assert.equal(step, id(5, 6), 'toward the enemy');
  assert.equal(huntStep({ cur: id(5, 5), adj, open, targets: new Set([id(5, 9)]), avoid: (c) => c === id(5, 6), max: 30 }) !== id(5, 6), true, 'round the hull');
  assert.equal(huntStep({ cur: id(5, 5), adj, open, targets: new Set(), max: 30 }), -1);
  assert.equal(huntStep({ cur: id(5, 5), adj, open, targets: new Set([id(5, 5)]), max: 30 }), id(5, 5), 'already on it: stand');
  const n = nextCell({ role: 'hunt', cur: id(5, 5), prev: -1, adj, open, rand, targets: new Set(), avoid: () => false });
  assert.ok(adj[id(5, 5)].includes(n), 'no enemy: a random step');
  assert.equal(nextCell({ role: 'hunt', cur: id(5, 5), prev: -1, adj, open, rand, targets: new Set([id(9, 5)]), avoid: () => false }), id(6, 5)); }
// never onto rock, whatever the role
for (let k = 0; k < 50; k++) assert.ok(open(nextCell({ role: 'hunt', cur: id(2, 5), prev: -1, adj, open, rand, targets: new Set(), avoid: () => false })));
// THE PAIR CLOSES (round 7, note 7): with the mother's cell as `quarry` the arena pair walks to the ring `engage` hops round her and keeps to it;
// with her gone it walks back onto its plain
{ const hop = (a) => { const d = new Map([[a, 0]]), q = [a]; for (let i = 0; i < q.length; i++) for (const nb of adj[q[i]]) if (open(nb) && !d.has(nb)) { d.set(nb, d.get(q[i]) + 1); q.push(nb); } return d; };
  const quarry = id(5, 5), dq = hop(quarry), ring = engageRing({ adj, open, quarry, hops: 3 });
  assert.ok(ring.size > 0 && [...ring].every((c) => dq.get(c) >= 2 && dq.get(c) <= 4), 'the ring: 3 +- 1 hops from her');
  const plain = new Set([id(9, 0), id(9, 1), id(8, 0)]);
  let cur = id(9, 9), prev = -1, n = 0;
  for (; n < 40 && !ring.has(cur); n++) { const nx = nextCell({ role: 'arena', cur, prev, adj, open, rand, plain, quarry, engage: 3 }); assert.ok(dq.get(nx) < dq.get(cur), `closing on her (${dq.get(cur)} -> ${dq.get(nx)})`); prev = cur; cur = nx; }
  assert.ok(ring.has(cur), 'on her ring');
  for (let k = 0; k < 60; k++) { const nx = nextCell({ role: 'arena', cur, prev, adj, open, rand, plain, quarry, engage: 3 }); assert.ok(ring.has(nx), 'keeps to her ring'); prev = cur; cur = nx; }
  for (n = 0; n < 40 && !plain.has(cur); n++) { prev = cur; cur = nextCell({ role: 'arena', cur, prev, adj, open, rand, plain }); }
  assert.ok(plain.has(cur), `her death: back onto the plain (${n} steps)`);
  const def = { key: 'rotor', rate: 2, range: 4, dmg: 1 }, b = batteryDef(def, { cadence: 1.8, range: 1.35 });
  assert.deepEqual([b.rate, b.range, b.dmg, b.key, def.rate, def.range], [3.6, 5.4, 1, 'rotor', 2, 4], 'a battery: faster and farther, the def untouched');
  assert.equal(batteryDef(def, null), def); }
// THE KING'S FIGHT (2026-11-12 night): the fall back takes the open neighbour farthest from the threat (never rock), stands when nothing is farther; on her ring
// with `spread` the pair walks the way farthest from the other
{ const centers = Array.from({ length: W * W }, (_, c) => [c % W, Math.floor(c / W), 0]);
  assert.equal(fleeStep({ cur: id(5, 5), adj, open, centers, from: [5, 2, 0] }), id(5, 6), 'away from a threat to the north');
  assert.equal(fleeStep({ cur: id(4, 5), adj, open, centers, from: [6, 5, 0] }), id(4, 4), 'never into the rock behind it: aside instead')
  assert.ok(open(fleeStep({ cur: id(4, 5), adj, open, centers, from: [6, 5, 0] })), 'an open cell');
  assert.equal(fleeStep({ cur: id(9, 9), adj, open, centers, from: [0, 0, 0] }), id(9, 9), 'in the corner: stands');
  const n = nextCell({ role: 'arena', cur: id(7, 5), prev: -1, adj, open, rand, quarry: id(7, 7), engage: 2, spread: [[9, 5, 0]], centers });
  assert.equal(n, id(6, 5), `on her ring, the way away from the other mech (${n})`); }
console.log('mech-roles: the arena pair keeps its plain, the base mech parks outside the gate, the hunter takes the shortest way to the nearest enemy');
