// HOW DEEP A HULL SITS IN ROCK. A wall cell's face is the bisector between the open cell a point stands in and that wall's centre;
// a point with `clearance` of room must stay that far on the open side. Unit-sphere vectors, all distances in the same units.
// Returns the deepest intrusion over the sampled points: <= 0 is clear, Infinity is a point standing inside rock or off the board.
export function hullDepth(points, { cellOf, blocked, centers, adj }) {
  let deepest = -Infinity;
  for (const { p, clearance } of points) {
    const ci = cellOf(p);
    if (ci === -1 || blocked(ci)) return Infinity;
    const c = centers[ci];
    for (const nb of adj[ci]) {
      if (!blocked(nb)) continue;
      const w = centers[nb], u = [w[0] - c[0], w[1] - c[1], w[2] - c[2]], l = Math.hypot(u[0], u[1], u[2]);
      if (l < 1e-12) continue;
      const along = ((p[0] - (c[0] + w[0]) / 2) * u[0] + (p[1] - (c[1] + w[1]) / 2) * u[1] + (p[2] - (c[2] + w[2]) / 2) * u[2]) / l;
      deepest = Math.max(deepest, along + clearance);
    }
  }
  return deepest;
}
// a move is refused when it takes the hull deeper than it already is: clear ground stays clear, and a hull already touching rock
// (a turn on the spot swung its nose in) can always back or slide out instead of wedging
export const deepensContact = (before, after, slack = 0) => after > 0 && after > Math.max(0, before) + slack;
