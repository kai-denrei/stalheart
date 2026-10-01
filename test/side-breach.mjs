// side-breach.mjs — where the side breach can come up and what it breaks, on a small lattice: a strip of cells on a circle of the
// unit sphere, so one step along it is one cell. Cells 0..39 run round; the clearing is 0..9, the walls 10 and 11, the gate 12,
// rock 13..16, open ground from 17, a socket at 18.
import assert from 'node:assert/strict';
import { sideBreachCandidates } from '../src/domain/side-breach.js';
const N = 40, step = (2 * Math.PI) / N;
const centers = Array.from({ length: N }, (_, i) => [Math.cos(i * step), Math.sin(i * step), 0]);
const adj = centers.map((_, i) => [(i + 1) % N, (i + N - 1) % N]);
const rock = new Set([13, 14, 15, 16]);
const tune = { minWall: 2.5, maxWall: 8, reach: 3.5, gateClear: 0, gap: 2 };
const base = { centers, adj, blocked: (ci) => rock.has(ci), inside: (ci) => ci < 10, walls: [10, 11], sockets: [18], gate: 30, cellArc: step, tune };
{
  const c = sideBreachCandidates(base);
  // 19..21 are in reach too, but their lanes would run through the socket at 18; 22 on is out of reach
  assert.deepEqual(c.map((x) => x.cell), [18, 17], 'open ground outside the wall, within the socket\'s reach, nearest it first');
  const at17 = c.find((x) => x.cell === 17);
  assert.equal(at17.wall, 11, 'it goes for the nearest wall');
  assert.deepEqual(at17.carve, [16, 15, 14, 13, 12, 11, 10], 'a lane walked through the rock to the wall, then the gap');
}
{
  const c = sideBreachCandidates({ ...base, gate: 12 });
  assert.deepEqual(c, [], 'a lane through the gate\'s mouth is no candidate');
}
{
  const c = sideBreachCandidates({ ...base, sockets: [15] });
  assert.ok(c.every((x) => !x.carve.includes(15)), 'never through a sentry\'s own rock');
  assert.deepEqual(sideBreachCandidates({ ...base, walls: [] }), [], 'no wall, no side breach');
  assert.deepEqual(sideBreachCandidates({ ...base, sockets: [] }), [], 'no sentry, no side breach');
}
console.log('Side breach: open ground outside the wall in a sentry\'s reach, a lane cut to the wall and its gap, never through the gate or a socket.');
