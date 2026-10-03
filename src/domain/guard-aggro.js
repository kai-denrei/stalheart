// THE NESTS COME FOR THE HULL (owner, 2026-10-03: "MORE soft bodies at the landing sites, and they try to attack the tank"). A site guard
// keeps to its nest (`guard.c`, `guard.r`) until the hull comes within `aggro` nest radii; then it takes the exits that close on the hull,
// leaving the nest to chase it, and back to the nest once the hull is gone. Pure: unit-sphere points, cell ids, the caller's adjacency.
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export function guardExits({ exits, centers, guard, cur, hull, aggro }) {
  const r2 = (guard.r * aggro) ** 2;
  if (hull && d2(hull, guard.c) < r2) {
    const here = d2(centers[cur], hull), closer = exits.filter((c) => d2(centers[c], hull) < here);
    if (closer.length) return closer;
  }
  const stay = exits.filter((c) => d2(centers[c], guard.c) < guard.r * guard.r);
  return stay.length ? stay : [cur];
}
