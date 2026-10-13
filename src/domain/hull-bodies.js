// THE TANK'S HULL AGAINST A PEARL BODY (owner, 2026-10-13: "Cutis collision with Tank; though they are mostly membrane, the tank should never be able to
// 'go through' the enemy, they are still made of mass. more precise collision is needed."; spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md,
// "Round 4"). Pure, in a body's flat plane (metres): the hull is an oriented box (its centre, the unit axis it faces, its half length and half width),
// a body is the set of its membrane's outline points (src/fx/cutis-maku/deform.js, the shader's deform in JS) and its pearl's rim.
//   boxContact(box, xs, zs, n, out)     the overlap of the box and the convex hull of the n points by separating axes (the box's two, and sixteen
//                                       fixed directions standing in for the outline's own edges: within 2 % of the exact hull's), written into out
//                                       [depth, nx, nz]: depth > 0 is how far the body must move along the unit (nx, nz) to be clear of the box (0:
//                                       apart); the least such move
//   contactLoss(r, tune)                the share of the tank's speed a soft body of radius r takes on first contact: its mass (r^2, a membrane's
//                                       area) over the tank's at `refRadius`, x `loss`, at most `maxLoss`
//   stepDrag(drag, dt, tune)            a lost share recovering: the drag after dt (time constant `recover`)
// `box` { x, z, ux, uz, hl, hw }: centre, unit facing, half length (along u), half width (across).

const K = 16, AX = new Float64Array(K), AZ = new Float64Array(K);
for (let k = 0; k < K; k++) { AX[k] = Math.cos((k * Math.PI) / K); AZ[k] = Math.sin((k * Math.PI) / K); }

// one axis (ax, az) unit: the overlap along it (Infinity-safe), the sign the body moves; returns the overlap (<= 0: separated) and sets SIGN
let SIGN = 1;
function overlapOn(box, ax, az, xs, zs, n) {
  const c = box.x * ax + box.z * az, rb = box.hl * Math.abs(box.ux * ax + box.uz * az) + box.hw * Math.abs(-box.uz * ax + box.ux * az);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const p = xs[i] * ax + zs[i] * az; if (p < lo) lo = p; if (p > hi) hi = p; }
  const plus = c + rb - lo, minus = hi - (c - rb);   // the body moved +axis by `plus`, or -axis by `minus`, clears the box
  if (plus <= minus) { SIGN = 1; return plus; }
  SIGN = -1; return minus;
}

export function boxContact(box, xs, zs, n, out = [0, 0, 0]) {
  out[0] = 0; out[1] = box.ux; out[2] = box.uz;
  if (!(n > 0)) return out;
  let best = Infinity, bx = 0, bz = 0;
  for (let k = -2; k < K; k++) {
    const ax = k === -2 ? box.ux : k === -1 ? -box.uz : AX[k], az = k === -2 ? box.uz : k === -1 ? box.ux : AZ[k], o = overlapOn(box, ax, az, xs, zs, n);
    if (o <= 0) return out;   // a separating axis: apart
    if (o < best) { best = o; bx = ax * SIGN; bz = az * SIGN; }
  }
  out[0] = best; out[1] = bx; out[2] = bz;
  return out;
}

export const contactLoss = (r, { refRadius, loss, maxLoss }) => Math.min(maxLoss, loss * (r / refRadius) ** 2);

export const stepDrag = (drag, dt, { recover }) => (dt > 0 ? drag * Math.exp(-dt / recover) : drag);
