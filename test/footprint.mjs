// A STRUCTURE'S FOOTPRINT FROM ITS GEOMETRY (src/domain/footprint.js; owner, 2026-10-07: "the solar array should be impossible for
// the tank to go through: collision ON, but not so much that its entire perimeter becomes an invisible wall; same with the landing
// rocket"): the triangles near the ground rasterised onto a grid of cells in the structure's own frame, a point solid where a cell holds
// geometry, so panels block and the pad between them stays open, a lander's body blocks and the lane beside its legs stays open
import assert from 'node:assert/strict';
import { rasterFootprint } from '../src/domain/footprint.js';

// a square plate 4 wide, centred: solid inside, clear outside, the grid snug round it
const plate = [-2, -2, 2, -2, 2, 2, -2, -2, 2, 2, -2, 2];
{
  const fp = rasterFootprint(plate, 0.5);
  assert.ok(fp.hit(0, 0) && fp.hit(1.9, -1.9) && fp.hit(-1.9, 1.9), 'inside the plate');
  assert.ok(!fp.hit(2.3, 0) && !fp.hit(0, -2.3) && !fp.hit(9, 9), 'outside it');
  assert.ok(fp.w >= 8 && fp.w <= 12 && fp.h >= 8 && fp.h <= 12, `a grid snug round it (${fp.w} x ${fp.h})`);
}
// a thin bar on the diagonal: only the cells it crosses, not its bounding box
{
  const bar = [-4, -4, 4, 4, 4.3, 3.7, -4, -4, 4.3, 3.7, -3.7, -4.3];
  const fp = rasterFootprint(bar, 0.5);
  assert.ok(fp.hit(0, 0) && fp.hit(2, 2) && fp.hit(-3, -3), 'along the bar');
  assert.ok(!fp.hit(3, -3) && !fp.hit(-3, 3) && !fp.hit(0, 2), 'the corners of its box are clear');
  assert.ok(fp.count < fp.w * fp.h / 2, `far fewer cells than the box (${fp.count} of ${fp.w * fp.h})`);
}
// a ring of four plates round an open pad: the pad is clear, the plates solid
{
  const quad = (x0, z0, x1, z1) => [x0, z0, x1, z0, x1, z1, x0, z0, x1, z1, x0, z1];
  const ring = [...quad(-10, -10, 10, -7), ...quad(-10, 7, 10, 10), ...quad(-10, -7, -7, 7), ...quad(7, -7, 10, 7)];
  const fp = rasterFootprint(ring, 0.5);
  assert.ok(fp.hit(0, -8.5) && fp.hit(8.5, 0) && fp.hit(-8.5, 5), 'the panels');
  assert.ok(!fp.hit(0, 0) && !fp.hit(5, 5) && !fp.hit(-6, 0), 'the pad between them is open');
}
// a cell of the caller's size, in the caller's units; a pad widens the test
{
  const fp = rasterFootprint(plate, 1);
  assert.ok(fp.cell === 1 && fp.hit(0, 0) && !fp.hit(3, 0), 'one-unit cells');
  assert.ok(fp.hit(2.4, 0, 0.6) && !fp.hit(3.1, 0, 0.6), 'a pad round the point');
}
assert.ok(!rasterFootprint([], 0.5).hit(0, 0), 'no triangles: nothing solid');
console.log('Footprint: the triangles near the ground on a grid; panels block, the pad between them is open, a bar is not its box.');
