// seat-glide.mjs — the seat glide (src/fx/seat-glide.js): near, an eased arc onto the seat's pose; FAR (SOL-82 over the antipode), a
// trip round the sphere that never passes through the planet and never loses its direction, then exactly on the goal.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createSeatGlide } from '../src/fx/seat-glide.js';
const cam = () => ({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion() });
{
  const g = createSeatGlide({ body: null }), c = cam(), goal = { pos: new THREE.Vector3(0, -1.2, 0), quat: new THREE.Quaternion() };
  c.position.set(0, 1.2, 0);
  g.begin(c);
  let lowest = Infinity, steps = 0;
  while (g.active() && steps < 1000) { g.place(c, goal, 1 / 60); steps++; assert.ok(Number.isFinite(c.position.x + c.position.y + c.position.z), 'never NaN'); lowest = Math.min(lowest, c.position.length()); }
  assert.ok(lowest >= 1.15, `round the planet, never through it (lowest ${lowest.toFixed(3)})`);
  assert.ok(steps / 60 > 2.5, `a trip round the planet takes its longer time (${(steps / 60).toFixed(1)} s)`);
  assert.ok(c.position.distanceTo(goal.pos) < 1e-9, 'and lands exactly on the goal');
}
{
  const g = createSeatGlide({ body: null }), c = cam(), goal = { pos: new THREE.Vector3(0.1, 1.2, 0), quat: new THREE.Quaternion() };
  c.position.set(0, 1.2, 0);
  g.begin(c); let steps = 0;
  while (g.active() && steps < 1000) { g.place(c, goal, 1 / 60); steps++; }
  assert.ok(steps / 60 < 1.6, 'a hand-over between neighbours keeps its short glide');
  g.place(c, goal, 1 / 60); assert.ok(c.position.distanceTo(goal.pos) < 1e-9, 'then sits on the goal');
}
console.log('Seat glide: near, a short arc; far, round the sphere and never through it; then on the goal.');
