// The creature's fright and the nuke's stun as a pure rule (spec 2026-10-08-boss-fight-next-round-design.md, section 2).
// A Bofors landing or a live SOL beam within radius + reach of a foot frightens the creature: for the fright's duration its
// pursuit target is a flee point, 20 m from the centre, away from the live threats (SOL weighs twice a landing). The nuke stuns
// it instead. Local metres on the frame's plane [x, z]; `now` is the lab's monotonic clock, not the fight's: clearFear keeps
// `lastDisturb` (the disturb cooldown outlives a round's reset), and the fight's clock restarts at 0 each round, which would put
// the cooldown's last stamp in the future. Imports nothing: `tune` is the whole
// BOSS_FIGHT, so the numbers are tune.fear.* and tune.nuke.stun. The lab's guards (feeding locked, KILLED, fight off) are the
// caller's.
//
// THE BAIT MODE'S FEAR PER GUN (owner, 2026-10-09: "#2 or #3 hits gets it wild temporarily, hurrying away from the impact ... #1 registers a little as a
// barrage, #2 a lot"; the numbers tune.gunFear.*). The 25 mm fills a barrage meter (`barrage`): `amount` a round, drained `drain` a second, and at 1 the
// creature flinches, the meter back at 0. The 40 mm sends it wild, the MK-9 into a panic (`scare`). A flight is one at a time (`fear.flight`): a fresh hit
// extends it to its own end when that is later and re-aims it from the newest impact; a stronger level takes over the flight's numbers, a weaker one keeps
// them. `flightNow` steers it: its flee point `flee` metres from the centre straight away from the impact (the tank mode's `fearNow` stays as it was).

const LEVEL = { rotary: 'flinch', bofors: 'wild', nuke: 'panic' }, RANK = { flinch: 1, wild: 2, panic: 3 };

export function makeFear() {
  return { threats: new Map(), stunUntil: -Infinity, lastDisturb: -Infinity, frights: 0, stuns: 0,
    meter: 0, meterAt: -Infinity, flight: null, scares: { flinch: 0, wild: 0, panic: 0 } };
}

// Whether the nearest contact lies within `radius + reach` of the point `at`.
export function inReach(at, radius, contacts, reach) {
  const r = radius + reach;
  for (const p of contacts) if (Math.hypot(p[0] - at[0], p[1] - at[1]) <= r) return true;
  return false;
}

// Adds or renews the threat `key` (the latest end wins). `fresh`: no threat was live at `now` before the call; a fresh fright
// counts and may disturb the kit, at most once per fear.cooldown.
export function frighten(fear, key, at, kind, seconds, now, tune) {
  let fresh = true;
  for (const t of fear.threats.values()) if (t.until > now) { fresh = false; break; }
  const old = fear.threats.get(key), end = now + seconds;
  fear.threats.set(key, { at, weight: tune.fear.weight[kind], until: old && old.until > now ? Math.max(old.until, end) : end });
  if (fresh) fear.frights++;
  const disturb = fresh && now - fear.lastDisturb >= tune.fear.cooldown;
  if (disturb) fear.lastDisturb = now;
  return { fresh, disturb };
}

// The nuke's landing within reach: stunned for `seconds` (nuke.stun; the bait mode passes its own, and calls this only above 0), and the kit is disturbed.
export function stun(fear, now, tune, seconds = tune.nuke.stun) {
  fear.stunUntil = now + seconds; fear.stuns++; fear.lastDisturb = now;
  return { disturb: true };
}

// What the creature does now: 'stun' (no pursuit), 'flee' toward `point`, or 'hunt'. `c` is the centre, `u` the unit from it
// toward the tank (the fallback flee direction is -u).
export function fearNow(fear, now, c, u, tune) {
  for (const [k, t] of fear.threats) if (t.until <= now) fear.threats.delete(k);
  if (now < fear.stunUntil) return { mode: 'stun', point: null };
  if (!fear.threats.size) return { mode: 'hunt', point: null };
  let sx = 0, sz = 0;
  for (const t of fear.threats.values()) {
    const dx = c[0] - t.at[0], dz = c[1] - t.at[1], d = Math.hypot(dx, dz);
    if (d > 1e-9) { sx += t.weight * dx / d; sz += t.weight * dz / d; }
  }
  const m = Math.hypot(sx, sz);
  const dx = m > 1e-9 ? sx / m : -u[0], dz = m > 1e-9 ? sz / m : -u[1], f = tune.fear.flee;
  return { mode: 'flee', point: [c[0] + f * dx, c[1] + f * dz] };
}

// The round's reset: no threats, no stun, no flight, the meter empty (the counts stay the run's record).
export function clearFear(fear) { fear.threats.clear(); fear.stunUntil = -Infinity; fear.meter = 0; fear.meterAt = -Infinity; fear.flight = null; }

// The barrage meter at `now`: drained `gunFear.rotary.drain` a second since its last change.
export function meterNow(fear, now, tune) {
  return Math.max(0, fear.meter - tune.gunFear.rotary.drain * Math.max(0, now - fear.meterAt));
}

// A 25 mm round landing within reach at `at`: the meter up by `amount`; at 1 a flinch (the meter back at 0). Returns `scare`'s report, or null below 1.
export function barrage(fear, at, now, tune) {
  const m = meterNow(fear, now, tune) + tune.gunFear.rotary.amount;
  fear.meterAt = now;
  if (m < 1 - 1e-9) { fear.meter = m; return null; }
  fear.meter = 0;
  return scare(fear, 'rotary', at, now, tune);
}

// A gun's fright at `at` (`gun` 'rotary' the meter's flinch, 'bofors' wild, 'nuke' panic). Returns { level, fresh, escalated, disturb }: `fresh` no flight
// was running, `escalated` a stronger level took a running one over, `disturb` a fresh one past the disturb cooldown (`fear.cooldown`, shared with the frights).
export function scare(fear, gun, at, now, tune) {
  const level = LEVEL[gun], G = tune.gunFear[gun], f = fear.flight, live = !!f && f.until > now;
  const keep = live && RANK[f.level] > RANK[level];   // a stronger flight running keeps its level and numbers
  const src = keep ? f : { level, flee: G.flee, speed: G.speed, erratic: G.erratic };
  fear.flight = { level: src.level, flee: src.flee, speed: src.speed, erratic: src.erratic, at: [at[0], at[1]],
    since: live ? f.since : now, until: Math.max(live ? f.until : -Infinity, now + G.duration) };
  fear.scares[level]++;
  const disturb = !live && now - fear.lastDisturb >= tune.fear.cooldown;
  if (disturb) fear.lastDisturb = now;
  return { level, fresh: !live, escalated: live && !keep && RANK[level] > RANK[f.level], disturb };
}

// What the creature does now in the bait mode: 'stun', 'flee' (the flight's point `flee` metres from the centre `c` straight away from its impact; on the
// impact itself away from the bait, -`u`) or 'hunt'. `flight` is the running flight ({ level, flee, speed, erratic, at, since, until }) or null.
export function flightNow(fear, now, c, u) {
  if (now < fear.stunUntil) return { mode: 'stun', point: null, flight: fear.flight && fear.flight.until > now ? fear.flight : null };
  const f = fear.flight;
  if (!f || f.until <= now) { fear.flight = null; return { mode: 'hunt', point: null, flight: null }; }
  const dx = c[0] - f.at[0], dz = c[1] - f.at[1], d = Math.hypot(dx, dz);
  const ux = d > 1e-9 ? dx / d : -u[0], uz = d > 1e-9 ? dz / d : -u[1];
  return { mode: 'flee', point: [c[0] + f.flee * ux, c[1] + f.flee * uz], flight: f };
}
