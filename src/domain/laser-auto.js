// SOL FIRES ON ITS OWN (owner, 2026-10-01: "it could be a time-unlock that once in a while SOL does targeted strikes to help us,
// automated. first 2 are manual, later ISAO calibrated it and it can do it auto"). The rule is in two parts: when the automation
// is earned (passes the player flew and burned in), and where an automated pass aims: the body with the most other bodies within
// the beam's footprint, so a pass spends itself on the thickest pile and not on a straggler. Pure; the arsenal (src/fx/laser-arsenal.js)
// steers and holds the beam exactly as the harness's hands do.

// the player has flown and burned in `need` passes: Isao has what he needs to calibrate the automated platform
export const autoEarned = (mannedPasses, need) => mannedPasses >= need;

// bodies: [{ pos: [x, y, z] }] on the unit sphere; `metres` is the sphere's radius in metres and `radius` the footprint's radius in
// metres. Returns the position of the body with the most neighbours within the footprint (ties: the first), or null with no bodies.
// `sample` caps the bodies weighed as candidates (every body still counts as a neighbour) so a canyon full of hundreds stays cheap.
export function densestTarget(bodies, { radius, metres, sample = 160 }) {
  const n = bodies.length;
  if (!n) return null;
  const reach2 = (radius / metres) ** 2;   // chord on the unit sphere, squared
  const stride = Math.max(1, Math.ceil(n / sample));
  let best = null, bestCount = -1;
  for (let i = 0; i < n; i += stride) {
    const p = bodies[i].pos;
    let count = 0;
    for (let j = 0; j < n; j++) {
      const q = bodies[j].pos, dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
      if (dx * dx + dy * dy + dz * dz <= reach2) count++;
    }
    if (count > bestCount) { bestCount = count; best = p; }
  }
  return best ? [best[0], best[1], best[2]] : null;
}

// THE COUNT FOLLOWS THE VOICE (the seiyu_voice contract, 2026-10-04: "for kind countdown, fire number k at beats[k] seconds after
// playback starts"): `n` numbers counted down, the k-th shown at beats[k] from the line's start; a line that counts fewer numbers than
// `n` ("three... two... light them up!") has the rest follow a `step` apart. Without a line, the plain clock: 0, 1, 2. The strike
// lands a `step` after the last number. Returns { at: [seconds per number, n first], end }.
export function countdownTimes(beats, n = 3, step = 1) {
  const at = [];
  for (let k = 0; k < n; k++) at.push(Array.isArray(beats) && Number.isFinite(beats[k]) ? beats[k] : k === 0 ? 0 : at[k - 1] + step);
  return { at, end: at[n - 1] + step };
}
