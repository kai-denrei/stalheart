// An impact scares the bodies near it: they stumble, turn from the blast and bolt, take exits that lead away until
// the scare runs out, then go back to seeking the heart. Pure: positions are [x, y, z] arrays on the unit sphere, and
// the controller owns the cell graph and the clock. An impact only marks the bodies it caught; the enemy step stamps
// the scare with its own clock the next time it moves them, so callers need no clock of their own.
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// marks every live body within `radius` of `point`; returns how many were scared
export function applyScare(bodies, point, { radius, seconds }) {
  let scared = 0;
  const r2 = radius * radius;
  for (const e of bodies) {
    if (!e.alive || !e.pos || d2(e.pos, point) > r2) continue;
    e.scareFrom = [point[0], point[1], point[2]];
    e.scareSeconds = seconds;
    e.scareAt = null;
    scared++;
  }
  return scared;
}

// starts a fresh scare on the stepping clock; later calls leave it running
export function stampScare(e, now) {
  if (!e.scareFrom || e.scareAt !== null) return;
  e.scareAt = now;
  e.scareUntil = now + e.scareSeconds;
}

export const isScared = (e, now) => !!e.scareFrom && e.scareAt !== null && now < e.scareUntil;

// the pace multiplier: a stumble for the first `freezeS` (owner, 2026-10-03: "they do not stop and freeze, they stop and scatter in the
// other direction, frantic"), then a bolt at `flee` that eases to `trail` as the scare runs out, then normal
export function scarePace(e, now, freezeS, { flee = 2.4, trail = 1.3 } = {}) {
  if (!isScared(e, now)) return 1;
  const t = now - e.scareAt;
  if (t < freezeS) return 0.3;
  const u = Math.min(1, (t - freezeS) / Math.max(1e-6, e.scareSeconds - freezeS));
  return flee + (trail - flee) * u;
}

// true when the step from `cur` to `next` closes on the blast
export const towardScare = (cur, next, from) => d2(next, from) < d2(cur, from);

// the exits (cell ids) whose centres are farther from the blast than the current cell
export function awayExits(exits, centers, cur, from) {
  const here = d2(centers[cur], from);
  return exits.filter((c) => d2(centers[c], from) > here);
}
