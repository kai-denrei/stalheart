// THE CANYON (owner, 2026-10-01: "let's have it used the first time at the antipode, far from all other sentries; a huge number of
// ennemies, 5x the usual, in a long canyon, easy target for the SOL. a satisfying use of its immense power"). Where it is cut and what
// it is made of: a straight trench at the antipode of the heart, open ground `halfWidth` cells either side of its centre line, rock
// `wall` cells deep beyond that and across its deep end, and its mouth left open onto the planet's own ground so what SOL-82 misses
// walks on to the base.
//
// Pure. `centers` are unit vectors, `cellArc` one cell's angular size (distances in cells); `dist` is walking hops to the heart over
// open ground (Infinity where none). The numbers come in from src/content/sectors.js CANYON.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// the canyon at the antipode of `heart` (a cell), along whichever of `bearings` puts its mouth on reachable ground nearest the heart.
// Returns { floor, rock, spawn, mouth, axis, centre } or null when no bearing opens onto reachable ground.
export function planCanyon({ centers, heart, dist, cellArc, tune, bearings = 16 }) {
  const a = norm(centers[heart].map((v) => -v)), L = tune.length, hw = tune.halfWidth, wall = tune.wall;
  // a tangent basis at the antipode; a bearing turns the axis round it
  const ref = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], t1 = norm(cross(a, ref)), t2 = cross(a, t1);
  const reach = Math.cos(((L / 2 + wall + 2) * cellArc));
  const near = [];
  for (let ci = 0; ci < centers.length; ci++) if (dot(centers[ci], a) >= reach) near.push(ci);
  const nearest = (x, axis) => {   // the cell nearest the point x cells along the axis from the antipode
    const p = norm([a[0] + axis[0] * x * cellArc, a[1] + axis[1] * x * cellArc, a[2] + axis[2] * x * cellArc]);
    let best = -1, bd = -2;
    for (const ci of near) { const d = dot(centers[ci], p); if (d > bd) { bd = d; best = ci; } }
    return best;
  };
  let pick = null;
  for (let k = 0; k < bearings; k++) {
    const th = (k / bearings) * Math.PI * 2, axis = [t1[0] * Math.cos(th) + t2[0] * Math.sin(th), t1[1] * Math.cos(th) + t2[1] * Math.sin(th), t1[2] * Math.cos(th) + t2[2] * Math.sin(th)];
    const mouth = nearest(L / 2, axis);
    if (mouth < 0 || !Number.isFinite(dist[mouth])) continue;   // its mouth must open onto ground the base can be walked to from
    if (!pick || dist[mouth] < pick.d) pick = { axis, mouth, d: dist[mouth] };
  }
  if (!pick) return null;
  const across = cross(a, pick.axis), floor = [], rock = [];
  for (const ci of near) {
    const c = centers[ci], x = dot(c, pick.axis) / cellArc, y = Math.abs(dot(c, across)) / cellArc;
    if (x > L / 2) continue;   // past the mouth: the planet's own ground
    if (x >= -L / 2 && y <= hw) floor.push(ci);
    else if (x >= -L / 2 - wall && y <= hw + wall) rock.push(ci);   // the walls, and the cap across the deep end
  }
  return { floor, rock, spawn: nearest(-L / 2 + 1.5, pick.axis), mouth: pick.mouth, axis: pick.axis, centre: a };
}
