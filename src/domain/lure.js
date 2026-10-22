// THE LURE (owner, 2026-10-16: "the tank acts as LURE, while the gunship fires from above"; "Isao driving around and avoiding both the monster
// and friendly fire"; spec docs/superpowers/specs/2026-10-16-arena-design.md). Pure: how the hull on the `lure` directive drives
// (src/fx/hull-drive.js chooseNext; LURE in src/content/tank.js hands the hops in).
//   lureMode({ quarryHops, near, far }) -> 'arena' (no quarry: drive to the arena) | 'away' (the quarry nearer than `near` hops: kite)
//                                        | 'toward' (farther than `far`: close in) | 'tangent' (between: circle it)
//   nearDanger(p, points, radius)       whether a point lies within `radius` (the caller's units) of any danger point (a painted or falling
//                                        MK-9 cell, SOL's burn, a Bofors shell's target): an exit the lure never takes while another remains
//   insideArena(p, centre, radius)      THE BOUND (owner, 2026-10-23, d: "it should stay in the arena"): whether `p` lies within `radius` (chord, the caller's units)
//                                        of the arena's `centre`; no centre or no radius: no bound, true
//   keepInside(exits, centers, centre, radius) the exits whose centres are inside, or all of them when none is (the caller drives in: lureMode's
//                                        `inArena: false` is 'arena' whatever the quarry)
export function lureMode({ quarryHops = null, near = 5, far = 10, inArena = true } = {}) {
  if (inArena === false) return 'arena';
  if (quarryHops == null || !Number.isFinite(quarryHops) || quarryHops < 0) return 'arena';
  if (quarryHops < near) return 'away';
  if (quarryHops > far) return 'toward';
  return 'tangent';
}
export function nearDanger(p, points, radius) {
  if (!points?.length || !(radius > 0)) return false;
  const r2 = radius * radius;
  for (const q of points) { if (!q) continue; const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2]; if (dx * dx + dy * dy + dz * dz < r2) return true; }
  return false;
}
export function insideArena(p, centre, radius) {
  if (!p || !centre || !(radius > 0)) return true;
  return Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]) <= radius;
}
export function keepInside(exits, centers, centre, radius) {
  if (!centre || !(radius > 0)) return exits;
  const inside = exits.filter((e) => insideArena(centers[e], centre, radius));
  return inside.length ? inside : exits;
}
