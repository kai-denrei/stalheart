// arena.mjs — the arena's cell: reachable, outside, unblocked, the farthest band, the farthest first
import assert from 'node:assert/strict';
import { pickArenaCell, arenaFloor, roadAhead, roadField, roadPath, roadRock, roadKept } from '../src/domain/arena.js';
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
// THE PLANNED ROAD (owner, 2026-10-18, note 6: "a clear fast path (cleared by nukes and SOL)"): the same chain and detour. The field from the arena (9) with a
// rock at two: through the rocks is 0-1-2-3-4-5-..-9, eleven, the detour seventeen, so the road crosses 3 and 4 and SOL's first cut is 3; the hull's own
// test (`far`) passes over a rock to the next; dear rock and the road is the detour with nothing to cut; the look-ahead bounds it
{ const adj = Array.from({ length: 20 }, () => []), link = (a, b) => { adj[a].push(b); adj[b].push(a); };
  for (let i = 0; i < 9; i++) link(i, i + 1); link(2, 10); for (let i = 10; i < 19; i++) link(i, i + 1); link(19, 5);
  const tags = new Int8Array(20).fill(1); tags[3] = 0; tags[4] = 0;
  const field = roadField({ adj, tags, blocked: 0, to: 9, rockCost: 2 });
  assert.equal(field[9], 0); assert.equal(field[0], 11, 'nine steps, two of them into rock at two');
  assert.deepEqual(roadPath({ adj, field, from: 0 }), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'the road runs through the rocks');
  assert.deepEqual(roadPath({ adj, field, from: 0, max: 3 }), [1, 2, 3], 'at most max cells');
  assert.equal(roadRock({ adj, tags, blocked: 0, field, from: 0 }), 3, 'SOL\'s first cut: the first rock on the road');
  assert.equal(roadRock({ adj, tags, blocked: 0, field, from: 0, far: (ci) => ci !== 3 }), 4, 'a rock too near the hull is passed over for the next');
  assert.equal(roadRock({ adj, tags, blocked: 0, field, from: 0, max: 2 }), -1, 'beyond the look-ahead: nothing');
  const cut = Int8Array.from(tags); cut[3] = 1;
  assert.equal(roadRock({ adj, tags: cut, blocked: 0, field, from: 0 }), 4, 'one cut: the next rock on the same road');
  cut[4] = 1; assert.equal(roadRock({ adj, tags: cut, blocked: 0, field, from: 0 }), -1, 'both cut: the road is open');
  const dear = roadField({ adj, tags, blocked: 0, to: 9, rockCost: 10 });
  assert.deepEqual(roadPath({ adj, field: dear, from: 0 }), [1, 2, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 5, 6, 7, 8, 9], 'dear rock: the road is the detour');
  assert.equal(roadRock({ adj, tags, blocked: 0, field: dear, from: 0 }), -1, 'and nothing to cut on it');
  assert.deepEqual(roadPath({ adj, field, from: 9 }), [], 'at the arena: no road');
  const lone = roadField({ adj: [[], []], tags: new Int8Array(2).fill(1), blocked: 0, to: 1 });
  assert.equal(lone[0], Infinity); assert.deepEqual(roadPath({ adj: [[], []], field: lone, from: 0 }), [], 'no way: no road'); }
// THE ROAD KEPT (2026-10-19, the merged --arena-drive: a planned rock first seen 3.09 cells off): the road 0..5 to the arena at 5; a side cell 6 beside 2 whose own
// descent runs through the rock 7 (7 beside 5; a rock costs 2, the detour the same); 8 beside 6 only. Laid from 0 the road is 1..5; the hull a cell off it (at 6)
// keeps it (no rock), though the descent from 6 runs through 7; the hull two cells off (at 8) lays it again, through the rock
{ const adj = Array.from({ length: 9 }, () => []), link = (a, b) => { adj[a].push(b); adj[b].push(a); };
  for (let i = 0; i < 5; i++) link(i, i + 1); link(2, 6); link(6, 7); link(7, 5); link(6, 8);
  const tags = new Int8Array(9).fill(1); tags[7] = 0; const field = roadField({ adj, tags, blocked: 0, to: 5 });
  assert.deepEqual(roadPath({ adj, field, from: 6 }), [7, 5], 'the descent from the side cell runs through the rock');
  let k = roadKept({ adj, field, from: 0 }); assert.deepEqual(k.route, [0, 1, 2, 3, 4, 5]); assert.deepEqual(k.ahead, [1, 2, 3, 4, 5], 'laid from the hull');
  k = roadKept({ adj, field, from: 2, route: k.route }); assert.deepEqual(k.ahead, [3, 4, 5], 'on it: the rest');
  k = roadKept({ adj, field, from: 6, route: k.route }); assert.deepEqual(k.ahead, [3, 4, 5], 'a cell off it: kept, from the farthest road cell beside the hull');
  assert.equal(roadRock({ adj, tags, blocked: 0, field, from: 6, path: k.ahead }), -1, 'no rock on the kept road');
  assert.equal(roadRock({ adj, tags, blocked: 0, field, from: 6 }), 7, 'where the bare descent would have named the rock three cells from a hull');
  k = roadKept({ adj, field, from: 8, route: k.route }); assert.deepEqual(k.route, [8, 6, 7, 5], 'two cells off: laid again from the hull'); assert.deepEqual(k.ahead, [6, 7, 5]);
  assert.deepEqual(roadKept({ adj: [[], []], field: roadField({ adj: [[], []], tags: new Int8Array(2).fill(1), blocked: 0, to: 1 }), from: 0 }), { route: null, ahead: [] }, 'no way: nothing kept'); }
console.log('Arena: the farthest reachable cell outside the walls, its floor fourteen cells round, the road SOL cuts to it (the shortcut, else the flank), and the planned road through rock.');
