// showcase-shot.mjs — the ram beat's framing as arithmetic: the hull lands in the LOWER THIRD of the frame and not off
// the bottom edge (which is what the game's own chase view does to it), the eye sits behind and above the hull, and the
// bodies the beat drops are in a band AHEAD of the heading, across the lane, nearest first.
import assert from 'node:assert/strict';
import { ramShotPose, cellsAhead, RAM_SHOT } from '../src/domain/showcase-shot.js';
import { norm3, sub3, dot3, len3, scale3, cross3 } from '../src/vec3.js';

const CELL = 0.08, WALL = 0.03, UNIT = 0.04, FOV = 68;   // the game's own numbers: cellSide, params.wallHeight, unitScale, the camera's vertical field
const pos = norm3([0.3, 0.8, 0.5]);
const up = norm3(pos);
const dir = (() => { const t = cross3(up, [0, 0, 1]); return norm3(t); })();

/* where a world point lands on the vertical axis of the frame, in ndc: the angle off the look axis over the half field */
function screenY({ eye, look, up: u }, p) {
  const axis = norm3(sub3(look, eye)), to = norm3(sub3(p, eye));
  const side = norm3(cross3(axis, u));                       // the frame's x
  const upAxis = cross3(side, axis);                         // the frame's y, right-handed with it
  const fwd = dot3(to, axis);
  assert(fwd > 0, 'the point is in front of the camera');
  return (dot3(to, upAxis) / fwd) / Math.tan((FOV / 2) * Math.PI / 180);
}

/* --- the hull is in frame, low ------------------------------------------- */
{
  const shot = ramShotPose({ pos, dir, cellSide: CELL, wallHeight: WALL, unitScale: UNIT });
  const y = screenY(shot, pos);
  assert(y < -0.15 && y > -0.55, `the hull rides the lower third, not the bottom edge (ndc y ${y.toFixed(3)})`);
  /* the game's third-person pose, for the contrast this beat exists for: eye high behind, look a cell and a half ahead */
  const gameEye = pos.map((x, k) => x + up[k] * (WALL * 2.6 + CELL * 1.1 + UNIT * 1.8) - dir[k] * (CELL * 1.8 + UNIT * 1.6));
  const gameLook = pos.map((x, k) => x + up[k] * (WALL * 0.4 + UNIT * 0.5) + dir[k] * CELL * 1.4);
  const gameY = screenY({ eye: gameEye, look: gameLook, up }, pos);
  assert(gameY < y - 0.05, `the beat's own pose lifts the hull off the bottom edge the chase view leaves it on (${gameY.toFixed(3)} -> ${y.toFixed(3)})`);
  /* and behind it, above it: the shot is a chase, not a flyover */
  const back = dot3(sub3(shot.eye, pos), dir), lift = dot3(sub3(shot.eye, pos), up);
  assert(Math.abs(back + CELL * RAM_SHOT.back) < 1e-9, `2.6 cells behind (${back})`);
  assert(lift > 0 && lift < CELL * 1.5, `above the hull, and below the game's chase eye (${lift})`);
  /* the bodies the beat drops, 2-5 cells ahead, fill the middle of the frame */
  for (const n of [2, 3.5, 5]) {
    const body = pos.map((x, k) => x + dir[k] * CELL * n + up[k] * WALL * 0.3);
    const by = screenY(shot, body);
    assert(by > -0.35 && by < 0.45, `a body ${n} cells ahead is in the middle band (ndc y ${by.toFixed(3)})`);
  }
}

/* a hull with no heading yet still gets a pose, on some tangent */
{
  const shot = ramShotPose({ pos, dir: [0, 0, 0], cellSide: CELL, wallHeight: WALL });
  assert(Math.abs(dot3(norm3(sub3(shot.eye, pos)), up) - 1) > 1e-6, 'the eye is not straight overhead');
  assert(len3(sub3(shot.look, shot.eye)) > 0, 'there is a look direction');
}

/* --- the bodies go ahead, across the lane -------------------------------- */
{
  /* a patch of cells laid out on the tangent plane round the hull, half a cell apart */
  const side = cross3(up, dir);
  const centers = [], key = [];
  for (let a = -8; a <= 8; a++) for (let s = -8; s <= 8; s++) {
    centers.push(norm3(pos.map((x, k) => x + dir[k] * a * CELL * 0.5 + side[k] * s * CELL * 0.5)));
    key.push({ a: a * 0.5, s: s * 0.5 });
  }
  const got = cellsAhead({ pos, dir, centers, cellSide: CELL });
  assert(got.length > 0, 'the band is not empty');
  for (const ci of got) {
    assert(key[ci].a >= 1.9, `never behind or under the hull (${key[ci].a} cells along)`);
    assert(key[ci].a <= 5.1, `never beyond the band (${key[ci].a} cells along)`);
    assert(Math.abs(key[ci].s) <= 1.7, `across the lane, not off it (${key[ci].s} cells aside)`);
  }
  /* nearest first, so a drop of n lays the wall from the hull outward */
  const along = got.map((ci) => dot3(sub3(centers[ci], pos), dir));
  for (let i = 1; i < along.length; i++) assert(along[i] >= along[i - 1] - 1e-12, 'nearest first');
  /* closed ground is not offered: the hull cannot drive into rock */
  const open = cellsAhead({ pos, dir, centers, cellSide: CELL, open: (ci) => key[ci].s === 0 });
  assert(open.length > 0 && open.every((ci) => key[ci].s === 0), 'only cells the caller calls open');
  /* and the band scales: a wider, longer one is a superset */
  const wide = cellsAhead({ pos, dir, centers, cellSide: CELL }, { near: 1, far: 6, width: 3 });
  assert(got.every((ci) => wide.includes(ci)) && wide.length > got.length, 'a wider band contains the default one');
  /* the lane follows the HEADING: turn the hull 180 degrees and the band is the other way */
  const behind = cellsAhead({ pos, dir: scale3(dir, -1), centers, cellSide: CELL });
  assert(behind.length > 0 && behind.every((ci) => key[ci].a < 0), 'the band is ahead of wherever the hull is pointing');
}

console.log('Showcase ram shot frames the hull low and drops its bodies ahead of the heading.');
