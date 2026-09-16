// THE HULL LEANS INTO A TURN (owner, 2026-09-16: "the tank turns too sharply, it feels unnatural"). A steer key used to write the
// whole yaw rate on the frame it went down and zero on the frame it came up, so every turn started and ended on a corner — the tank
// was not too fast, its STEERING was a step function. This eases the rate rather than slowing the machine: the same top rate, taken
// up over `attack` seconds and let go over `release`, plus the roll that a hull leaning on its skirt should show.
//
// Pure: the controller owns the clock, applies the rate to its heading and hands the bank to the hover rig.
export const makeSteerEase = () => ({ rate: 0 });

// `want` is the steer axis, -1 (right) .. 1 (left). Returns the eased yaw rate in rad/s, which is also st.rate.
export function stepSteerEase(st, dt, want, tune) {
  dt = Math.max(0, dt);
  const target = Math.max(-1, Math.min(1, want || 0)) * tune.rate;
  // Building a turn takes longer than letting one go: a released key should settle out, not coast through the corner it was cutting.
  // A reversal counts as building, so flicking across the centre ramps rather than snapping to the far side.
  const building = Math.abs(target) >= Math.abs(st.rate) || (target !== 0 && Math.sign(target) !== Math.sign(st.rate));
  const tau = building ? tune.attack : tune.release;
  st.rate += (target - st.rate) * (tau > 0 ? Math.min(1, dt / tau) : 1);
  if (Math.abs(st.rate) < 1e-4) st.rate = 0;   // a settled hull steers exactly straight, so a heading cannot creep
  return st.rate;
}

// how far the hull rolls right now, in radians: it leans into the turn, full lean at the full rate
export const steerBank = (st, tune) => (tune.rate > 0 ? -(st.rate / tune.rate) * (tune.bank ?? 0) : 0);
