// THE HOVER KICK (owner, 2026-10-03: "Maybe more lateral bump, as if the hovering system got miscalibrated and tilted to no side. After such
// an event is detected we use the time of that animation to ensure that there are no remaining obstacles in the area, re-center the tank
// smoothly"). A head-on hit on rock no longer grinds frame by frame (block, slide, cushion, creep, each fighting the next): it starts ONE
// kick, `seconds` long, that carries the hull from where it hit to a checked free point off the wall and along it, eased, while the hull
// rolls to `side` and wobbles back level (a hover rig catching itself). Nothing else moves the hull meanwhile; then `cool` seconds before
// another. Pure: unit-sphere points in, the caller checks the target is free and owns the hull.
export const makeKick = () => ({ t: -1, dur: 0, from: null, to: null, side: 1, cool: 0, roll: 0 });

export const kicking = (k) => k.t >= 0;

// begin a kick from `from` to `to` (both unit vectors) rolling toward `side` (+1 / -1); false while one runs or cools
export function startKick(k, { from, to, side = 1 }, tune) {
  if (k.t >= 0 || k.cool > 0) return false;
  Object.assign(k, { t: 0, dur: tune.seconds, from: from.slice(), to: to.slice(), side: side < 0 ? -1 : 1, n: (k.n ?? 0) + 1 });   // n: kicks so far, for the harness
  return true;
}

// advance: the hull's point this tick (null when no kick runs), and k.roll the radians of roll to add to the hull's bank
export function stepKick(k, dt, tune) {
  k.cool = Math.max(0, k.cool - dt);
  if (k.t < 0) { k.roll = 0; return null; }
  k.t += dt;
  const u = Math.min(1, k.t / k.dur), e = u * u * (3 - 2 * u), a = k.from, b = k.to;
  const p = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e], l = Math.hypot(p[0], p[1], p[2]) || 1;
  k.roll = k.side * tune.roll * Math.sin(Math.PI * Math.min(1, u * 1.25) * 2.5) * (1 - u);
  if (u >= 1) { k.t = -1; k.cool = tune.cool; k.roll = 0; }
  return [p[0] / l, p[1] / l, p[2] / l];
}

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// WHERE A HIT KICKS TO: `pos` the hull (unit), `toWall` the unit way to the rock, `slid` the step left after the into-wall part, `share` the
// step's head-on share, `blocked(p)` the caller's collision check. Off the wall by `back` cells and along it by `along`, else just off it;
// null when the hit is glancing or neither point is free. `side` is the roll's direction (+1 / -1), `heading` the hull's new heading
export function planKick({ pos, heading, toWall, slid, share, cellSide, blocked }, tune) {
  if (!(share > tune.headOn)) return null;
  const n = norm(pos), dw = toWall[0] * n[0] + toWall[1] * n[1] + toWall[2] * n[2], off = norm([n[0] * dw - toWall[0], n[1] * dw - toWall[1], n[2] * dw - toWall[2]]);
  const sl = Math.hypot(slid[0], slid[1], slid[2]) > 1e-12 ? norm(slid) : [0, 0, 0], b = tune.back * cellSide, a = tune.along * cellSide;
  const to = [norm([pos[0] + off[0] * b + sl[0] * a, pos[1] + off[1] * b + sl[1] * a, pos[2] + off[2] * b + sl[2] * a]), norm([pos[0] + off[0] * b, pos[1] + off[1] * b, pos[2] + off[2] * b])].find((q) => !blocked(q));
  if (!to) return null;
  const side = (n[1] * heading[2] - n[2] * heading[1]) * off[0] + (n[2] * heading[0] - n[0] * heading[2]) * off[1] + (n[0] * heading[1] - n[1] * heading[0]) * off[2];
  return { to, side: side < 0 ? -1 : 1, heading: norm([heading[0] + sl[0] * share, heading[1] + sl[1] * share, heading[2] + sl[2] * share]) };
}
