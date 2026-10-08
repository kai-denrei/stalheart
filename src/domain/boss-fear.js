// The creature's fright and the nuke's stun as a pure rule (spec 2026-10-08-boss-fight-next-round-design.md, section 2).
// A Bofors landing or a live SOL beam within radius + reach of a foot frightens the creature: for the fright's duration its
// pursuit target is a flee point, 20 m from the centre, away from the live threats (SOL weighs twice a landing). The nuke stuns
// it instead. Local metres on the frame's plane [x, z]; `now` is the fight's clock. Imports nothing: `tune` is the whole
// BOSS_FIGHT, so the numbers are tune.fear.* and tune.nuke.stun. The lab's guards (feeding locked, KILLED, fight off) are the
// caller's.

export function makeFear() { return { threats: new Map(), stunUntil: -Infinity, lastDisturb: -Infinity, frights: 0, stuns: 0 }; }

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

// The nuke's landing within reach: stunned for nuke.stun seconds, and the kit is disturbed.
export function stun(fear, now, tune) {
  fear.stunUntil = now + tune.nuke.stun; fear.stuns++; fear.lastDisturb = now;
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

// The round's reset: no threats, no stun (the counts stay the run's record).
export function clearFear(fear) { fear.threats.clear(); fear.stunUntil = -Infinity; }
