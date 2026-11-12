// THE ROVER'S DRAWN ROAD (src/domain/rover-road.js): the string pulled where the run is clear, the corners rounded, never across a blocked cell
import assert from 'node:assert/strict';
import { buildRoad, roadAt, clearRun } from '../src/domain/rover-road.js';

// a flat 10 m grid in x-z: a rock block at cells x 3..5, z 0..3; the path goes round it by its open cells
const rock = new Set(); for (let x = 3; x <= 5; x++) for (let z = 0; z <= 3; z++) rock.add(`${x},${z}`);
const cellOf = (p) => `${Math.round(p[0] / 10)},${Math.round(p[2] / 10)}`;
const clear = (p) => !rock.has(cellOf(p));
const C = (x, z) => [x * 10, 0, z * 10];
const path = [C(0, 0), C(1, 0), C(2, 0), C(2, 1), C(2, 2), C(2, 3), C(2, 4), C(3, 4), C(4, 4), C(5, 4), C(6, 4), C(6, 3), C(6, 2), C(6, 1), C(6, 0), C(7, 0), C(8, 0)];
const o = { step: 1, half: 2, radius: 6 };
const road = buildRoad(path, clear, o);
let raw = 0; for (let i = 1; i < path.length; i++) raw += Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
assert.ok(road.length < raw - 1, `shorter than the cell centres (${road.length.toFixed(1)} < ${raw})`);
assert.deepEqual(road.pts[0], path[0]); assert.deepEqual(road.pts.at(-1), path.at(-1), 'it starts and ends on the path');
let bad = 0, worst = 0, last = null;
for (let s = 0; s <= road.length; s += 0.25) {
  const { point, dir } = roadAt(road, s);
  if (!clear(point)) bad++;
  if (last && dir) { const a = Math.acos(Math.max(-1, Math.min(1, last[0] * dir[0] + last[2] * dir[2]))); worst = Math.max(worst, a); }
  last = dir;
}
assert.equal(bad, 0, 'no point of the road on the rock');
assert.ok(worst < 0.5, `the corners rounded: the direction never jumps more than 0.5 rad between pieces (${worst.toFixed(2)})`);
assert.equal(clearRun(C(2, 0), C(6, 0), clear, o), false, 'the straight run through the rock is not clear');
assert.equal(clearRun(C(0, 0), C(2, 0), clear, o), true);
// a corridor one cell wide: the sides (half 4 m) fail everywhere, the path between neighbours is kept as it is (the floor of what it may do)
{ const wall = (p) => Math.abs(p[2]) < 4.5; const line = [C(0, 0), C(1, 0), C(2, 0), C(3, 0)];
  const r = buildRoad(line, wall, { step: 1, half: 5, radius: 6 }); assert.ok(Math.abs(r.length - 30) < 1e-9); }
// a sharp corner that cannot be rounded clear stays sharp, on the path
{ const only = new Set(['0,0', '1,0', '1,1']); const ok = (p) => only.has(cellOf(p)) && Math.abs(p[0] - Math.round(p[0] / 10) * 10) < 0.6 && Math.abs(p[2] - Math.round(p[2] / 10) * 10) < 5.1;
  const r = buildRoad([C(0, 0), C(1, 0), C(1, 1)], ok, { step: 0.5, half: 0, radius: 6 }); assert.ok(r.pts.some((p) => p[0] === 10 && p[2] === 0), 'the corner kept'); }
// the sphere: points projected by `surface`
{ const n = (p) => { const l = Math.hypot(...p); return p.map((v) => v / l); }; const pts = [n([1, 0, 0]), n([1, 0.01, 0]), n([1, 0.02, 0.01])];
  const r = buildRoad(pts, () => true, { step: 0.002, half: 0.001, radius: 0.004, surface: n, up: n });
  for (const p of r.pts) assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-9, 'on the sphere'); }
assert.deepEqual(roadAt({ pts: [[1, 2, 3]], cum: [0], length: 0 }, 5), { point: [1, 2, 3], dir: null });
console.log(`Rover road: ${path.length} cells round the rock in ${road.pts.length} points, ${road.length.toFixed(1)} m (centres ${raw} m), none on the rock.`);
