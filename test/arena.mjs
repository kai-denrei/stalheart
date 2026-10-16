// arena.mjs — the arena's cell: reachable, outside, unblocked, the farthest band, the farthest first
import assert from 'node:assert/strict';
import { pickArenaCell, arenaFloor, roadAhead } from '../src/domain/arena.js';
const dist = [0, 1, 2, 3, 4, 5, 6, 7, 8, Infinity, 9, 9];
assert.equal(pickArenaCell({ dist }), 10, 'the farthest, the lowest index among equals');
assert.equal(pickArenaCell({ dist, blocked: (i) => i === 10 }), 11, 'a blocked cell is skipped');
assert.equal(pickArenaCell({ dist, blocked: (i) => i >= 10 }), 8, 'the farthest left');
assert.equal(pickArenaCell({ dist, inside: (i) => i >= 8, farHops: 0 }), 7, 'inside the clearing is not the arena');
assert.equal(pickArenaCell({ dist: [Infinity, Infinity] }), -1, 'nothing reachable');
assert.equal(pickArenaCell({ dist: [] }), -1);
assert.equal(pickArenaCell({ dist, blocked: (i) => i === 11, farHops: 4 }), 10);
// THE FLOOR (2026-10-16): every cell within radiusCells of the arena's cell, by the chord, the clearing left out
{ const ring = (n) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [Math.cos(a), Math.sin(a), 0]; });
  const centers = ring(360), cellArc = Math.PI * 2 / 360;   // one cell a degree round the equator
  const floor = arenaFloor({ centers, cell: 0, cellArc, radiusCells: 14 });
  assert.equal(floor.length, 29, `fourteen cells either side and the cell itself (${floor.length})`);
  assert.ok(floor.includes(0) && floor.includes(14) && floor.includes(346) && !floor.includes(15), 'the chord reaches exactly radiusCells');
  assert.deepEqual(arenaFloor({ centers, cell: 0, cellArc, radiusCells: 2, inside: (i) => i === 1 }), [0, 2, 358, 359], 'the clearing is never the arena\'s floor');
  assert.deepEqual(arenaFloor({ centers, cell: -1, cellArc }), [], 'no arena, no floor'); }
// THE ROAD (2026-10-16, second version): a chain of ten cells with rock at 3 and 4 and a long open detour round them. The open walk from 0 to 9 runs the
// detour (15 hops); the two rocks are a shortcut worth eight cells (the detour is seventeen hops, the cut nine), named when the rule may cross two rocks and asks for four; a rule that crosses one
// rock finds no shortcut and the flank names the wall beside the route instead; the flank off, nothing
{ const adj = Array.from({ length: 20 }, () => []), link = (a, b) => { adj[a].push(b); adj[b].push(a); };
  for (let i = 0; i < 9; i++) link(i, i + 1);                       // the chain 0..9
  link(2, 10); for (let i = 10; i < 19; i++) link(i, i + 1); link(19, 5);   // a ten-cell open detour from 2 round to 5
  const tags = new Int8Array(20).fill(1); tags[3] = 0; tags[4] = 0;
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 0, to: 9, ahead: 7, clear: 0, saves: 4, through: 2 }), 3, 'the shortcut: two rocks save eight cells of the detour');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 0, to: 9, ahead: 7, clear: 0, saves: 9, through: 2, flank: false }), -1, 'not worth nine: nothing without the flank');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 0, to: 9, ahead: 7, clear: 0, saves: 4, through: 1, flank: false }), -1, 'one rock deep finds no far side');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 0, to: 9, ahead: 7, clear: 0, saves: 4, through: 1 }), 3, 'the flank: the wall beside the route, within reach');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 0, to: 9, ahead: 1, clear: 0, saves: 4, through: 2 }), -1, 'the rock is past the look-ahead, for the shortcut and the flank alike');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 10, to: 9, ahead: 7, clear: 0, saves: 4, through: 2, flank: false }), 3, 'from the first detour cell the cut back through the rocks still saves six');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 10, to: 9, ahead: 7, clear: 0, saves: 7, through: 2, flank: false }), -1, 'and not seven');
  const field = new Int32Array(20).fill(-1); { const q = [9]; field[9] = 0; for (let i = 0; i < q.length; i++) for (const nb of adj[q[i]]) if (field[nb] < 0 && tags[nb] !== 0) { field[nb] = field[q[i]] + 1; q.push(nb); } }
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 0, to: 9, field, ahead: 7, clear: 0, saves: 4, through: 2 }), 3, 'a field handed in (the lure\'s) gives the same road');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 0, to: 9, ahead: 7, saves: 4, through: 2, clear: 3 }), -1, 'a rock beside the hull\'s first cells is left alone (the beam keeps its distance from the hull): no shortcut, no flank');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 10, to: 9, ahead: 7, saves: 4, through: 2, clear: 1 }), 3, 'one cell off the hull the rock may be asked for');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 0, to: 9, ahead: 7, saves: 4, through: 2, clear: 0, far: (ci) => ci !== 3 }), -1, 'the caller\'s own distance test (the chord) rules a rock out, shortcut and flank alike');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 0, to: 9, ahead: 7, saves: 4, through: 2, clear: 9, far: () => true }), 3, 'and rules one in whatever the hops say');
  assert.equal(roadAhead({ adj, tags, blocked: 0, from: 9, to: 9 }), -1, 'there already');
  assert.equal(roadAhead({ adj: [[], []], tags: new Int8Array(2), blocked: 0, from: 0, to: 1 }), -1, 'no way'); }
console.log('Arena: the farthest reachable cell outside the walls, its floor fourteen cells round, and the road SOL cuts to it (the shortcut, else the flank).');
