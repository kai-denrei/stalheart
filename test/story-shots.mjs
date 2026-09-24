// story-shots.mjs — the story's shots as arithmetic (src/domain/story-shots.js): Isao face on, closing in and a little above his
// face, up his own; the planet from orbit, eye on the direction and looking at the centre, up a tangent even over a pole; the
// sites' mean direction and the climb from 1.6 to 3.3 planet radii that holds once it is reached.
import assert from 'node:assert/strict';
import { isaoFace, orbitFrame, sitesDir, sitesRadius } from '../src/domain/story-shots.js';
import { norm3, sub3, dot3, len3 } from '../src/vec3.js';

const near = (a, b, eps = 1e-12) => Math.abs(a - b) < eps;
// FACE ON: in front of his face (along his own flattened heading), above it, closer at the end of the shot than at its start
{
  const up = norm3([0.2, 1, 0.1]), bp = up.map((v) => v * 1.001), fw = norm3([1, 0.3, 0.2]), size = 0.01;
  const a = isaoFace(bp, [up[0] * 4, up[1] * 4, up[2] * 4], fw, size, 0), b = isaoFace(bp, up, fw, size, 1);
  assert.deepEqual(a.up, up, 'his up is his own direction, normalised'); assert.deepEqual(a.look, b.look, 'the face does not move');
  assert.ok(near(dot3(sub3(a.look, bp), up), size * 0.35), 'the face stands 0.35 of his size above his feet');
  const ahead = (p) => dot3(sub3(p.eye, p.look), norm3(sub3(fw, up.map((v) => v * dot3(fw, up)))));
  assert.ok(near(ahead(a), size * 1.9) && near(ahead(b), size * 1.4), 'from 1.9 to 1.4 of his size in front of him');
  assert.ok(near(dot3(sub3(a.eye, a.look), up), size * 0.12), 'a little above the face');
}
// THE PLANET FROM ORBIT: on the direction, looking at the centre, up across it; over a pole the reference axis changes
for (const d of [norm3([0.3, 0.5, 0.8]), [0, 1, 0], [0, -1, 0], norm3([1, 0.95, 0])]) {
  const f = orbitFrame(d, 3.3);
  assert.ok(near(len3(f.eye), 3.3) && near(dot3(norm3(f.eye), d), 1), 'the eye out along the direction');
  assert.deepEqual(f.look, [0, 0, 0]); assert.ok(near(dot3(f.up, d), 0) && near(len3(f.up), 1), 'up is a unit tangent there');
}
// THE SITES: their mean direction; the climb holds at 3.3 once reached
assert.deepEqual(sitesDir([[0, 1, 0], [0, 1, 0]]), [0, 1, 0]);
assert.ok(near(len3(sitesDir([[1, 0, 0], [0, 1, 0], [0, 0, 1]])), 1));
assert.deepEqual([sitesRadius(0), sitesRadius(0.625), sitesRadius(1)], [1.6, 1.6 + 1.7, 1.6 + 1.7]);
assert.ok(sitesRadius(0.3) > 1.6 && sitesRadius(0.3) < 3.3);
console.log('Story shots: Isao face on and closing in, the planet from orbit with a tangent up at any direction, the sites\' climb.');
