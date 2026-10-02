// THE HULL GETS UNSTUCK (owner, 2026-10-02: "the tank gets stuck too often between walls where it looks like it should fit. Maybe
// create a smooth correction if repeated wall hits are detected?"). The cushion and the contact rule refuse moves and nudge, but a
// hull wedged in a corner can grind for seconds. This watches for driving that goes nowhere and eases the hull toward the centre of
// the open cell it stands in, harder the longer it has been stuck, and lets go the moment it moves again. Pure.
export const makeStuck = () => ({ t: 0 });

// driving: the drive is held; moved: how far the hull went this tick; expected: how far the drive would have taken it; returns the
// correction strength 0..1 (0 until `after` seconds of going nowhere, then rising over `ramp` seconds)
export function stepStuck(st, { driving, moved, expected, dt }, tune) {
  if (!driving || expected <= 1e-9 || moved > expected * tune.share) { st.t = Math.max(0, st.t - dt * 3); return 0; }   // moving again lets go fast
  st.t += dt;
  if (st.t < tune.after) return 0;
  return Math.min(1, (st.t - tune.after) / tune.ramp);
}

// the hull eased `step` toward `home` (both unit vectors), along the ground
export function unstick(pos, home, step) {
  const to = [home[0] - pos[0], home[1] - pos[1], home[2] - pos[2]], n = pos;
  const d = to[0] * n[0] + to[1] * n[1] + to[2] * n[2], tg = [to[0] - n[0] * d, to[1] - n[1] * d, to[2] - n[2] * d], l = Math.hypot(tg[0], tg[1], tg[2]);
  if (l < 1e-9) return pos;
  const k = Math.min(1, step / l), p = [pos[0] + tg[0] * k, pos[1] + tg[1] * k, pos[2] + tg[2] * k], m = Math.hypot(p[0], p[1], p[2]);
  return [p[0] / m, p[1] / m, p[2] / m];
}
