// WHERE A STRAIGHT LINE FROM A GUN MEETS THE PLANET. Marched in 3D rather than along the surface: a lance or a round leaves a
// muzzle at a height, on a slope, and what stops it is whether the line has dropped below the thing underneath it. A wall top is
// a cell tagged BLOCKED (rock) and stands `wallHeight` above the ground; open ground is the unit sphere itself. So a level shot
// from a wall clears its neighbours and a depressed one digs in, which is the whole reason to care where a Lancer stands.
//
// Pure: the controller hands in its board as `terrain` = { cellAt(unit point) -> cell or -1, tags, wallHeight, step (the march's
// sample spacing), clearance (how far into terrain the lance's march must go before it stops), rockClearance (the same into a
// rock, for the lance's curve: marchAlongArc), ownCi (the gun's own cell) }.
import { norm3, dot3, sub3 } from '../vec3.js';
import { BLOCKED } from '../dungeon.js';
import { aimOnSphere } from './gunship.js';

const at = (from, dir, m) => [from[0] + dir[0] * m, from[1] + dir[1] * m, from[2] + dir[2] * m];

// HOW FAR A LANCE GETS BEFORE THE GROUND OR A WALL EATS IT (moved out of td-tab's rayToTerrain, unchanged).
// A QUARTER OF A CELL OF CLEARANCE (the controller's `clearance`). Enemies stand ON the ground, so a beam aimed at one is at ground
// level by the time it arrives, and stopping the instant the ray touches r = 1 killed it a step SHORT of every target it was aimed
// at, which is why a correctly aimed lance was striking nothing. What stops a lance is terrain it has actually gone into, not
// terrain it is skimming. It returns one step back from that sample, or maxLen: a reach, not a point of impact (roundEnd is that).
export function marchToTerrain(from, dir, maxLen, terrain) {
  const step = terrain.step;
  for (let m = step; m <= maxLen; m += step) {
    const p = at(from, dir, m), ci = terrain.cellAt(norm3(p));
    // A GUN DOES NOT SHOOT ITS OWN PARAPET. The muzzle sits a few thousandths above the wall top it is bolted to, so the very first
    // sample of a depressed barrel is already under its own cell's surface and the lance died a fifth of a cell out, every time.
    // Its own cell cannot stop it; everything past it can.
    if (ci === terrain.ownCi) continue;
    const blocked = ci !== -1 && terrain.tags[ci] === BLOCKED;
    const surface = 1 + (blocked ? terrain.wallHeight : 0);
    if (Math.hypot(p[0], p[1], p[2]) < surface - terrain.clearance) return { len: Math.max(step, m - step), hit: blocked ? 'wall' : 'ground' };
  }
  return { len: maxLen, hit: null };
}

// Rock the line is inside: a BLOCKED cell other than the gun's own, below its wall top.
const rockCell = (p, t) => { const ci = t.cellAt(norm3(p)); return ci !== -1 && ci !== t.ownCi && t.tags[ci] === BLOCKED; };
const inRock = (p, t) => Math.hypot(p[0], p[1], p[2]) < 1 + t.wallHeight && rockCell(p, t);

// WHERE A ROUND LANDS (owner, 2026-09-25: "the trace should land on the same path as the impact"): the EXACT first crossing of the
// straight line with the terrain, no clearance. Open ground is the gunship's own ray-sphere aim at r = 1; rock is found by the
// march and then solved, through its top at r = 1 + wallHeight or bisected to the side it was entered by. { len, point, hit:
// 'ground' | 'wall' | null }; null is a line still in the air at maxLen, and its point is that last point.
export function roundEnd(from, dir, maxLen, terrain) {
  const ground = aimOnSphere(from, dir, 1), tg = ground ? dot3(sub3(ground, from), dir) : Infinity, last = Math.min(tg, maxLen);
  for (let a = 0, m = terrain.step; a < last; a = m, m += terrain.step) {
    const b = Math.min(m, last);
    if (!inRock(at(from, dir, b), terrain)) continue;
    // rock between a and b: entered through its top if the line crosses the wall-top sphere over rock in there, else by a side
    let lo = a, hi = b;
    const top = aimOnSphere(from, dir, 1 + terrain.wallHeight), tt = top ? dot3(sub3(top, from), dir) : -1;
    if (tt >= a && tt <= b) { if (rockCell(top, terrain)) return { len: tt, point: top, hit: 'wall' }; lo = tt; }
    for (let k = 0; k < 64 && hi - lo > 1e-15; k++) { const mid = (lo + hi) / 2; if (inRock(at(from, dir, mid), terrain)) hi = mid; else lo = mid; }
    return { len: hi, point: at(from, dir, hi), hit: 'wall' };
  }
  return tg <= maxLen ? { len: tg, point: ground, hit: 'ground' } : { len: maxLen, point: at(from, dir, maxLen), hit: null };
}

// A STRAIGHT ROUND'S STEP along its line: round = { dist, straight: { p, d, end } }. The step that would carry the head past its
// end is clamped so the head sits EXACTLY on end.point, and that frame the round is still in flight, so the tracer is drawn with
// its head there; the next call returns true: the round has landed, where the tracer ended. Without an end it flies on unclamped.
export function flyStraight(round, step) {
  const s = round.straight;
  if (s.landed) return true;
  round.dist += step;
  if (s.end && round.dist >= s.end.len) { round.dist = s.end.len; s.p = s.end.point.slice(); s.landed = true; }
  else s.p = [s.p[0] + s.d[0] * step, s.p[1] + s.d[1] * step, s.p[2] + s.d[2] * step];
  return false;
}

// THE LANCE ALONG ITS CURVE (a V1 known gap, closed 2026-10-01: "the lance's stop point is solved on a straight line while its beam is
// drawn along the curve"). The beam is drawn along the great circle from the muzzle (src/td-tab.js lanceBeam), descending at the
// barrel's own pitch: at arc length m its altitude is r0 + slope * m, where slope is the radial share of the firing direction (down
// at a body on the ground, level along a parapet). This marches that same curve against the terrain, so the beam stops where it is
// drawn to meet the ground or a wall, with the march's clearance. `fromU`: the muzzle's unit direction, `dTan`: the unit tangent it
// fires along, `r0`: the muzzle's radius. The point at arc length m is pointAlongArc. Returns { len, hit } as marchToTerrain does.
export const pointAlongArc = (fromU, dTan, r0, slope, m) => { const c = Math.cos(m), n = Math.sin(m), r = r0 + slope * m; return [(fromU[0] * c + dTan[0] * n) * r, (fromU[1] * c + dTan[1] * n) * r, (fromU[2] * c + dTan[2] * n) * r]; };   // src/arc.js arcPoint, inlined: domain imports no top-level module

export function marchAlongArc(fromU, dTan, r0, slope, maxLen, terrain) {
  const step = terrain.step;
  for (let m = step; m <= maxLen; m += step) {
    const p = pointAlongArc(fromU, dTan, r0, slope, m), ci = terrain.cellAt(norm3(p));
    if (ci === terrain.ownCi) continue;   // a gun does not shoot its own parapet
    const blocked = ci !== -1 && terrain.tags[ci] === BLOCKED;
    const surface = 1 + (blocked ? terrain.wallHeight : 0);
    // ROCK IS NOT SKIMMED (owner, 2026-10-02: "lasers of lancer shooting through rocks"). The ground's quarter cell of clearance is for
    // bodies standing on it; a wall's top let the beam pass through its upper share. `rockClearance` (when given) is how far into a
    // rock the lance may go, and a wall stop ends ON the rock: its face found between the last sample outside and the first inside
    if (r0 + slope * m < surface - (blocked ? terrain.rockClearance ?? terrain.clearance : terrain.clearance)) {
      if (!blocked || terrain.rockClearance == null) return { len: Math.max(step, m - step), hit: blocked ? 'wall' : 'ground' };
      let lo = m - step, hi = m;
      for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2, c2 = terrain.cellAt(norm3(pointAlongArc(fromU, dTan, r0, slope, mid))); if (c2 !== terrain.ownCi && c2 !== -1 && terrain.tags[c2] === BLOCKED && r0 + slope * mid < surface - terrain.rockClearance) hi = mid; else lo = mid; }
      return { len: Math.max(step * 0.5, lo), hit: 'wall' };
    }
  }
  return { len: maxLen, hit: null };
}

// the firing line as the arc takes it: the unit tangent at the muzzle and the radial share (the descent per unit of arc)
export function arcOf(from, dir) {
  const fromU = norm3(from), slope = dot3(dir, fromU), t = [dir[0] - fromU[0] * slope, dir[1] - fromU[1] * slope, dir[2] - fromU[2] * slope], l = Math.hypot(t[0], t[1], t[2]);
  return { fromU, dTan: l > 1e-12 ? [t[0] / l, t[1] / l, t[2] / l] : [0, 0, 0], r0: Math.hypot(from[0], from[1], from[2]), slope };
}
