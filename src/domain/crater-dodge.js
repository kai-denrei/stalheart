// THE BODIES WALK ROUND AN OPEN HOLE, NOT ACROSS IT (owner, 2026-11-02, round 4, note 6: "bodies walking in the centre of sinkholes"). A record walks
// cell centre to cell centre, and a breach's cell centre IS its crater's centre, so a lane through another open hole's cell (a far breach's walk past a
// nearer one) crossed it dead centre. A pure rule, no topology change (docs/kernel-provenance.json): a sideways offset off the record's heading that
// keeps it at least the crater's radius from the centre, smooth on the way in and out:
//   need(s) = R (1 - s^2 / Z^2)^2   (s the along-heading distance to the centre, Z = zone x R; zone >= 2 keeps sqrt(s^2 + need^2) >= R everywhere)
// The side is the record's own (`side`, held while it is in the zone, so a turn at the centre does not swap it), else the side it already stands on,
// else `tie`. The caller eases the offset in (a turn inside the zone swings the perpendicular) and skips a hole it is still rising from.
//   craterDodge(p, dir, holes, { zone, side, tie }) -> { off: [3], side, hole }   p a unit point, dir its unit tangent heading,
//   holes [{ c: unit centre, R: radius in unit-sphere chord }]; hole -1 when no hole's zone holds the point (off is then zero)
import { sub3, scale3, dot3, cross3 } from '../vec3.js';

export function craterDodge(p, dir, holes, { zone = 2, side = null, tie = 1 } = {}) {
  let best = -1, bq = null, bd = Infinity;
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i], q0 = sub3(p, h.c), q = sub3(q0, scale3(p, dot3(q0, p))), d = Math.hypot(q[0], q[1], q[2]);
    if (d < zone * h.R && d < bd) { best = i; bq = q; bd = d; }
  }
  if (best < 0 || !dir) return { off: [0, 0, 0], side: null, hole: -1 };
  const R = holes[best].R, Z = zone * R, P = cross3(p, dir), s = dot3(bq, dir), d = dot3(bq, P), u = (s * s) / (Z * Z);
  const sd = side ?? (Math.abs(d) > 1e-6 * R ? Math.sign(d) : tie);
  if (u >= 1) return { off: [0, 0, 0], side: sd, hole: best };
  const need = R * (1 - u) * (1 - u);
  return { off: sd * d >= need ? [0, 0, 0] : scale3(P, sd * need - d), side: sd, hole: best };
}
