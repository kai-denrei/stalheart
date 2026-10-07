// THE NESTS COME FOR THE HULL (owner, 2026-10-03: "MORE soft bodies at the landing sites, and they try to attack the tank"). A site guard
// keeps to its nest (`guard.c`, `guard.r`) until the hull comes within `aggro` nest radii; then it takes the exits that close on the hull,
// leaving the nest to chase it, and back to the nest once the hull is gone. Pure: unit-sphere points, cell ids, the caller's adjacency.
// A GUARD NEVER STANDS STILL (owner, 2026-10-06: "clearing the first landing spot does not unlock the cargo; a hidden enemy on the
// radar but not on the screen"): one that had chased the hull out of its nest, or stood on the nest's edge, found no exit inside the
// nest and was given its own cell forever, parked wherever the chase had ended, a corridor the player never looked into, while the site
// stayed guarded. A chase now leaves a trail (`guard.trail`, the cells walked out of the nest); the hull gone, the guard walks the trail
// back, then the exits that bring it home; a guard never wanders (a wanderer drifted to the base and held its lane busy). Only a
// cell with no exit at all holds it.
// NEVER UNDER THE LANDER (owner, 2026-10-07: the first 'nest cleared' took 20 s+ "as if an invisible enemy remained"): the nest's
// cells include the ones under the lander's own solid footprint, where a guard is drawn inside the model and the hull cannot drive in to
// ram it; `guard.avoid(point)` (the base's solidAt) strikes those cells off the exits, unless they are all there is.
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export function guardExits({ exits: all, centers, guard, cur, hull, aggro }) {
  if (!all.length) return [cur];
  const clear = guard.avoid ? all.filter((c) => !guard.avoid(centers[c])) : all, exits = clear.length ? clear : all;
  const r2 = (guard.r * aggro) ** 2, inNest = (c) => d2(centers[c], guard.c) < guard.r * guard.r;
  if (hull && d2(hull, guard.c) < r2) {
    const here = d2(centers[cur], hull), closer = exits.filter((c) => d2(centers[c], hull) < here);
    if (closer.length) { if (!inNest(cur) || closer.some((c) => !inNest(c))) { guard.trail ??= []; if (guard.trail.at(-1) !== cur) guard.trail.push(cur); } return closer; }
  }
  const stay = exits.filter(inNest);
  if (stay.length) { if (guard.trail?.length) guard.trail.length = 0; return stay; }
  // THE WAY BACK: the trail's last cell that is a neighbour (the trail is cut there), else the exits nearer the nest, else stand
  if (guard.trail?.length) { while (guard.trail.length) { const back = guard.trail.pop(); if (exits.includes(back)) return [back]; } }
  const here = d2(centers[cur], guard.c), home = exits.filter((c) => d2(centers[c], guard.c) < here);
  return home.length ? home : [cur];
}
