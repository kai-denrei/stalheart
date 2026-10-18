// THE HULL MENDS UNDER THE STÅLHEART (owner, 2026-10-18: "when the Mork is damaged, sitting under the Stalheart should repair it, same repair
// time as the shield recharge"). The rule, pure: a hull parked under the Stålheart (under) and at rest (still) gets its armour back one dent
// at a time, a whole hull's worth in `seconds` (the shield array's recharge, src/content/tank.js HULL_REPAIR), so one dent every
// seconds / max. The fraction of the next dent is kept `keep` seconds off the spot or on the move (a nudge does not start it over), then
// dropped; a hit drops it at once and holds the mend while it is reported (the host reports a hit for its own second).
//   repairStep({ under, still, hit, dents, max, dt, seconds, progress, away, keep }) -> { dents, progress, away, mending }
//   dents: the dents the hull can still take, of max (td-tab's hullArmour, the console's pips); progress: 0..1 toward the next one;
//   away: seconds since the mend last ran; mending: the mend ran this step (the console's REPAIRING)
// THE TWO SPOTS (owner, 2026-10-18, third round: "we need a spot to repair the hull, either standing under the stalheart, or the paint-job
// garage"): the first landmark of `spots` (content HULL_REPAIR.spots, in order) the hull's point is inside, or null; insideFn(id, p) is the
// story base's own footprint test, false for a structure not yet printed (the garage is stage 9, the Stålheart stage 6)
//   repairSpot(spots, insideFn, p) -> id | null
export function repairSpot(spots, insideFn, p) {
  for (const id of spots ?? []) if (insideFn(id, p)) return id;
  return null;
}
export function repairStep({ under, still, hit = false, dents, max, dt, seconds, progress = 0, away = 0, keep = 5 }) {
  if (!(dt > 0)) return { dents, progress, away, mending: false };   // a frozen frame: nothing moves
  if (dents >= max) return { dents: Math.min(dents, max), progress: 0, away: 0, mending: false };   // whole: nothing to mend, nothing carried
  if (hit) return { dents, progress: 0, away: 0, mending: false };
  if (!under || !still || !(seconds > 0)) { away += dt; return { dents, progress: away >= keep ? 0 : progress, away, mending: false }; }
  progress += dt * max / seconds;
  while (progress >= 1 - 1e-9 && dents < max) { progress = Math.max(0, progress - 1); dents++; }   // 1e-9: 450 frames of 1/60 s sum short of 7.5 s
  if (dents >= max) progress = 0;
  return { dents, progress, away: 0, mending: true };
}
