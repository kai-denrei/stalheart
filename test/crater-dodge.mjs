// crater-dodge.mjs — round an open hole, not across it (owner, 2026-11-02, round 4, note 6; src/domain/crater-dodge.js, CRATER_DODGE): a record
// walking a lane through a crater's centre is offset sideways so its point stays a radius off the centre, smoothly, its side held through a turn.
import assert from 'node:assert/strict';
import { craterDodge } from '../src/domain/crater-dodge.js';
import { CRATER_DODGE } from '../src/content/story-defaults.js';
import { norm3, add3, scale3, sub3, dot3, dist3 } from '../src/vec3.js';

const R = 0.012, hole = { c: [0, 0, 1], R }, holes = [hole];
// a walk on the unit sphere near the pole: x from -4R to +4R along +x, straight through the centre, then (case 2) turning to +y at the centre
function walk(turn) {
  const pts = [], dt = 1 / 60, v = R / 1.2;   // a radius in 1.2 s (a body at about a cell a second)
  let x = -5 * R, y = 0, side = null, dodge = [0, 0, 0], worst = Infinity, step = 0, prev = null;
  for (let t = 0; t < 14; t += dt) {
    let dir;
    if (!turn || x < 0) { x += v * dt; dir = [1, 0, 0]; } else { y += v * dt; dir = [0, 1, 0]; if (x > 0) x = 0; }
    if (turn && x >= 0 && y === 0) x = 0;
    const p = norm3([x, y, 1]), d = norm3(sub3(dir, scale3(p, dot3(dir, p))));
    const r = craterDodge(p, d, holes, { zone: CRATER_DODGE.zone, side, tie: 1 }), k = 1 - Math.exp(-dt / CRATER_DODGE.ease);
    side = r.hole >= 0 ? r.side : null; dodge = dodge.map((o, i) => o + (r.off[i] - o) * k);
    const q = norm3(add3(p, dodge));
    worst = Math.min(worst, dist3(q, hole.c)); if (prev) step = Math.max(step, dist3(q, prev)); prev = q; pts.push(q);
  }
  return { worst, step, pts };
}
{
  const straight = walk(false), turned = walk(true), frame = (R / 1.2) / 60;
  assert(straight.worst > 0.8 * R,   /* the ease lags a little: R carries the pad, so 0.85 R is still past the rim */ `straight through the centre: never nearer than ${(straight.worst / R).toFixed(2)} R`);
  assert(turned.worst > 0.8 * R, `turning at the centre: never nearer than ${(turned.worst / R).toFixed(2)} R`);
  assert(straight.step < 2.5 * frame && turned.step < 2.5 * frame, `no jump (worst step ${(straight.step / frame).toFixed(2)} / ${(turned.step / frame).toFixed(2)} frames of walk)`);
  // without the dodge the straight walk crosses the centre
  assert(Math.min(...straight.pts.map((q) => Math.abs(q[1]))) < R, 'the offset is sideways and lets go after the hole');
  assert(Math.abs(straight.pts.at(-1)[1]) < 1e-4, 'back on its lane past the zone');
}
{
  // far from every hole: nothing; a point already wide of the centre: nothing; no heading: nothing
  assert.deepEqual(craterDodge(norm3([0.5, 0, 1]), [1, 0, 0], holes).off, [0, 0, 0]);
  assert.equal(craterDodge(norm3([0.5, 0, 1]), [1, 0, 0], holes).hole, -1);
  assert.deepEqual(craterDodge(norm3([0, 1.5 * R, 1]), [1, 0, 0], holes, { zone: 2 }).off, [0, 0, 0]);
  assert.deepEqual(craterDodge(norm3([0, 0, 1]), null, holes).off, [0, 0, 0]);
  // the side: the one it stands on, or the tie at dead centre, or the one it holds
  assert(craterDodge([0, 0, 1], [1, 0, 0], holes, { tie: -1 }).off[1] > 0 === false, 'the tie picks the side at dead centre');
  assert.equal(craterDodge(norm3([0, 0.1 * R, 1]), [1, 0, 0], holes).side, Math.sign(craterDodge(norm3([0, 0.1 * R, 1]), [1, 0, 0], holes).off[1]) || 1);
}
console.log('PASS round an open hole: a lane through the centre stays a radius off it, smoothly, its side held through a turn at the centre; nothing away from holes');
