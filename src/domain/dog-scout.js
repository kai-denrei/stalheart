// THE RECON DOG'S RULES (owner, 2026-11-10; spec docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md 2.A, 2.B). Pure: the tune comes in
// (src/content/dog-scout.js DOG_SCOUT), the sphere, the keys, the camera and the K9's body are the seat's (src/fx/dog-scout.js).
//   createScout(points)                -> the scout's record: { mode: 'idle'|'driving'|'knocked'|'home', speed m/s, points [{ ci, kind }],
//                                         surveyed [index, ...] in the order surveyed, ring (the point whose ring holds the dog, -1), ringT s inside it,
//                                         knockLeft s, graceLeft s, knocks }
//   drive(s)                           -> into the seat (idle -> driving)
//   steer(s, input, dt, tune)          -> { speed, turn }: the speed this step (m/s; negative is the reverse) eased by `drive.accel` toward W's
//                                         trot, Shift's sprint (`top`, the K9's) or S's reverse, and the heading's turn this step (radians, + is left),
//                                         falling as 1 / (1 + |speed| / turnFall); a knocked dog does not move. input { fwd, back, left, right, sprint }
//   surveyStep(s, dt, inRing, tune)    -> the index surveyed this step or -1: `survey.seconds` inside the same point's ring (`inRing` its index or
//                                         -1); leaving the ring restarts its clock; a surveyed point is not surveyed again
//   allSurveyed(s)                     -> true once every point is surveyed
//   knock(s, tune)                     -> true when the dog goes down now (driving, out of its grace): knocked for `knock.seconds`
//   stepKnock(s, dt, tune)             -> 'up' the step it gets up (then `knock.graceS` of grace), else null
//   release(s)                         -> out of the seat (home): the companion's play has it again
//   pickPoints(w, tune)                -> the survey cells in order, the last the lane's: w { centers, heart, cands [{ ci, hops }] (open floor
//                                         the dog can walk to, with their walking hops from the heart), toward (a unit point: the lane's way out) };
//                                         `points.count` cells `points.cells` hops out, at least `points.spread` degrees apart round the heart (and at
//                                         most `points.spreadMax`, when given: the walk between two kept short), the last the nearest to the lane's
//                                         bearing; fewer when the ground does not hold them
//   contactCell(w, tune)              -> the cell the pack rises at: w { centers, cands [{ ci, hops }] (open floor off the clearing), gateHops,
//                                         toward }: `contact.hops` hops beyond the gate, the nearest such cell to `toward` (the lane), or -1
//   bearingAt(centers, from, to)       -> the bearing of `to` round `from` (radians) in a frame fixed at `from` (its tangent plane, +Y the reference)
//   angleDiff(a, b)                    -> the signed difference a - b wrapped into [-pi, pi]
export const angleDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function createScout(points = []) {
  return { mode: 'idle', speed: 0, points: points.map((p) => ({ ...p })), surveyed: [], ring: -1, ringT: 0, knockLeft: 0, graceLeft: 0, knocks: 0 };
}
export function drive(s) { if (s.mode === 'idle') s.mode = 'driving'; return s; }
export function release(s) { s.mode = 'home'; s.speed = 0; s.knockLeft = 0; return s; }

export function steer(s, input, dt, tune) {
  const D = tune.drive;
  if (s.mode !== 'driving') { s.speed = s.mode === 'knocked' ? 0 : s.speed; return { speed: s.speed, turn: 0 }; }
  const want = input.fwd && !input.back ? (input.sprint ? tune.top : D.trot) : input.back && !input.fwd ? -D.back : 0;
  const step = D.accel * dt * (Math.sign(want) !== Math.sign(s.speed) && s.speed !== 0 ? 2 : 1);   // braking is twice as quick as speeding up
  s.speed = want > s.speed ? Math.min(want, s.speed + step) : Math.max(want, s.speed - step);
  const dir = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const turn = dir * D.turn / (1 + Math.abs(s.speed) / D.turnFall) * dt;
  return { speed: s.speed, turn };
}

export function surveyStep(s, dt, inRing, tune) {
  if (inRing !== s.ring) { s.ring = inRing; s.ringT = 0; }
  if (inRing < 0 || s.surveyed.includes(inRing) || s.mode === 'home') return -1;
  s.ringT += dt;
  if (s.ringT < tune.survey.seconds) return -1;
  s.surveyed.push(inRing); s.ringT = 0;
  return inRing;
}
export const allSurveyed = (s) => s.points.length > 0 && s.surveyed.length >= s.points.length;

export function knock(s, tune) {
  if (s.mode !== 'driving' || s.graceLeft > 0) return false;
  s.mode = 'knocked'; s.knockLeft = tune.knock.seconds; s.speed = 0; s.knocks++;
  return true;
}
export function stepKnock(s, dt, tune) {
  if (s.graceLeft > 0) s.graceLeft = Math.max(0, s.graceLeft - dt);
  if (s.mode !== 'knocked') return null;
  s.knockLeft -= dt;
  if (s.knockLeft > 0) return null;
  s.mode = 'driving'; s.knockLeft = 0; s.graceLeft = tune.knock.graceS;
  return 'up';
}

// the bearing of `to` round `from` in from's tangent plane, measured from the plane's projection of +Y (or +X near the poles)
export function bearingAt(centers, from, to) {
  const p = centers[from], q = centers[to];
  const n = norm(p), ref = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const e1 = norm(sub(ref, scale(n, dot(ref, n)))), e2 = cross(n, e1), d = sub(q, p);
  return Math.atan2(dot(d, e2), dot(d, e1));
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const chord = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function pickPoints({ centers, heart, cands, toward }, tune) {
  const P = tune.points, [lo, hi] = P.cells, mid = (lo + hi) / 2, spread = P.spread * Math.PI / 180, cap = P.spreadMax != null ? P.spreadMax * Math.PI / 180 : Math.PI * 2 / P.count;
  const ring = cands.filter((c) => c.hops >= lo && c.hops <= hi);
  if (!ring.length) return [];
  const bear = (ci) => bearingAt(centers, heart, ci);
  const laneB = toward ? bearingAt(centers, heart, nearestOf(centers, ring.map((c) => c.ci), toward)) : 0;
  // the lane's point: the nearest bearing to the lane, the hops nearest the middle of the band breaking ties (rounded to a degree)
  const score = (c, b0) => Math.round(Math.abs(angleDiff(bear(c.ci), b0)) * 180 / Math.PI) * 100 + Math.abs(c.hops - mid) * 10 + (c.ci % 7) * 0.01;
  const last = ring.slice().sort((a, b) => score(a, laneB) - score(b, laneB))[0];
  const chosen = [last];
  // the others spread round the heart: each the farthest in bearing from those chosen up to `cap` (and at least `spread` from each, at most
  // `spreadMax` from the nearest), the middle hops first
  while (chosen.length < P.count) {
    let best = null, bs = -Infinity;
    for (const c of ring) {
      if (chosen.some((x) => x.ci === c.ci)) continue;
      const gap = Math.min(...chosen.map((x) => Math.abs(angleDiff(bear(c.ci), bear(x.ci)))));
      if (gap < spread || (P.spreadMax != null && gap > cap)) continue;
      const sc = Math.min(gap, cap) * 100 - Math.abs(c.hops - mid) - (c.ci % 7) * 0.001;
      if (sc > bs) { bs = sc; best = c; }
    }
    if (!best) break;
    chosen.push(best);
  }
  // the others clockwise from the lane, then the lane's last
  const others = chosen.slice(1).sort((a, b) => angleDiff(bear(a.ci), laneB) - angleDiff(bear(b.ci), laneB));
  return [...others.map((c) => c.ci), last.ci];
}

export function contactCell({ centers, cands, gateHops, toward }, tune) {
  const need = gateHops + tune.contact.hops;
  const far = cands.filter((c) => c.hops >= need);
  if (!far.length) return -1;
  const least = Math.min(...far.map((c) => c.hops)), band = far.filter((c) => c.hops <= least + 1);
  return toward ? nearestOf(centers, band.map((c) => c.ci), toward) : band[0].ci;
}

function nearestOf(centers, cells, p) {
  let best = -1, bd = Infinity;
  for (const ci of cells) { const d = chord(centers[ci], p); if (d < bd) { bd = d; best = ci; } }
  return best;
}
