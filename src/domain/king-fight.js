// THE KING'S FIGHT AS PURE RULES (owner, 2026-11-12 night: "we tune the aggro of the King so that it aims for the mechs and the tank ... time the shells so they
// a) do not deal friendly fire damage and b) stop the King in its track and funnels it to a spot where a nuke is about to drop"; the calls in docs/DECISIONS.md
// "The arena fight (2026-11-12 night)"). Positions are [x, z] metres on the arena's plane (src/fx/boss/arena-fight.js maps them), times seconds of game clock.
// `T` is the content's tune (src/content/arena-king.js ARENA_KING); this module imports nothing.
//   makeKing() -> the King's state
//   pickTarget(k, targets, centre, now, T) -> the target's id or null: targets [{ id, pos, attackedAt?, lure? }] standing; held T.aggro.hold s
//   stepKing(k, { now, centre, targets }, T) -> { mode, aim, target, lock, hits }: stalk, tell, charge, recover (idle: no target, aim the arena's centre)
//   shellHit(k, centre, burst, now, T) -> { stagger, veer }: a 40 mm's stop (diminishing) and turn
//   nearBody(point, centre, contacts, reach) -> whether a point is within `reach` of the centre or a contact
//   friendlyHits({ point, radius, gun, units, last, now }, T) -> [{ id, kind, dmg }]: the player's shell on friendlies, at most once per unit per gun per T.friendly[gun].every
//   nukeShare(centre, point, blast, T) -> the share of its hit points a nuke at `point` takes (0: a miss)
//   nukeCall(since, travel, T) -> { left, release }: the called MK-9's countdown from its mark, and whether it is time to let it go

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// the point `keep` short of `t` on the line toward `c` (from farther she closes to it, from nearer she backs off to it)
export const short = (t, c, keep) => { const dx = c[0] - t[0], dz = c[1] - t[1], d = Math.hypot(dx, dz); if (!(keep > 0)) return [t[0], t[1]]; if (d < 1e-9) return [c[0], c[1]]; return [t[0] + dx * keep / d, t[1] + dz * keep / d]; };

export function makeKing() {
  return { mode: 'stalk', since: null, target: null, targetAt: -Infinity, lock: null, hit: new Set(), resist: 0, resistAt: 0, stagUntil: -Infinity, veer: null, staggers: 0, veers: 0, charges: 0, tells: 0 };
}

// the target: the held one while it stands, is in range and its hold has not run out; else the lowest score
export function pickTarget(k, targets, centre, now, T) {
  const A = T.aggro, inRange = (t) => d2(t.pos, centre) <= A.range;
  const held = targets.find((t) => t.id === k.target);
  if (held && inRange(held) && now - k.targetAt < A.hold) return k.target;
  let best = null, bs = Infinity;
  for (const t of targets) {
    if (!inRange(t)) continue;
    const s = d2(t.pos, centre) - (now - (t.attackedAt ?? -Infinity) <= A.memory ? A.attacker : 0) - (t.lure ? A.lure : 0);
    if (s < bs - 1e-9) { bs = s; best = t.id; }
  }
  if (best !== k.target) { k.target = best; k.targetAt = now; } else if (best != null) k.targetAt = now;
  return best;
}

const to = (k, mode, now) => { k.mode = mode; k.since = now; };

// one frame of its will: who it wants, where it goes (`aim` null: it stands), who its charge reached this frame (`hits`, ids)
export function stepKing(k, { now, centre, targets }, T) {
  const C = T.charge, out = { mode: k.mode, aim: null, target: k.target, lock: k.lock, hits: [] };
  if (k.since == null) k.since = now;   // its clock starts at its first frame
  if (now < k.stagUntil) { out.mode = 'stagger'; return out; }
  if (k.veer && now < k.veer.until) { out.mode = 'veer'; out.aim = k.veer.point.slice(); return out; }
  k.veer = null;
  // the tell and the charge keep their target (the lock); the rest choose
  if (k.mode !== 'tell' && k.mode !== 'charge') pickTarget(k, targets, centre, now, T);
  const tg = targets.find((t) => t.id === k.target) ?? null;
  if (!tg && k.mode !== 'charge') { if (k.mode !== 'idle') to(k, 'idle', now); k.lock = null; out.mode = 'idle'; out.aim = [0, 0]; out.target = null; return out; }
  if (k.mode === 'idle') to(k, 'stalk', now);
  if (k.mode === 'stalk' && d2(tg.pos, centre) <= C.from && now - k.since >= C.stalk) { to(k, 'tell', now); k.lock = tg.pos.slice(); k.tells++; }
  if (k.mode === 'tell' && now - k.since >= C.tell) { to(k, 'charge', now); k.hit = new Set(); k.charges++; }
  if (k.mode === 'charge') {
    for (const t of targets) if (!k.hit.has(t.id) && d2(t.pos, centre) <= C.reach) { k.hit.add(t.id); out.hits.push(t.id); }
    if (d2(centre, k.lock) <= C.arrive || now - k.since >= C.max) { to(k, 'recover', now); k.lock = null; }
  }
  if (k.mode === 'recover' && now - k.since >= C.recover) to(k, 'stalk', now);
  out.mode = k.mode; out.target = k.target; out.lock = k.lock;
  out.aim = k.mode === 'tell' ? null : k.mode === 'charge' ? k.lock.slice() : tg ? short(tg.pos, centre, T.keep) : [0, 0];
  return out;
}

// A 40 MM NEAR IT: the stagger, shorter for each recent one (the resistance recovers T.stagger.recover a second), none under T.stagger.min; a tell or a charge in
// progress is cancelled (recover follows the stagger); the veer away from the burst after it, every time
export function shellHit(k, centre, burst, now, T) {
  const S = T.stagger, r = Math.max(0, k.resist - (now - k.resistAt) * S.recover);
  let stagger = S.seconds * S.falloff ** r; if (stagger < S.min) stagger = 0;
  k.resist = r + 1; k.resistAt = now;
  if (stagger > 0) {
    k.stagUntil = Math.max(k.stagUntil, now + stagger); k.staggers++;
    if (k.mode === 'tell' || k.mode === 'charge') { k.lock = null; }
    to(k, 'recover', now + stagger);
  }
  let dx = centre[0] - burst[0], dz = centre[1] - burst[1], l = Math.hypot(dx, dz);
  if (l < 1e-6) { dx = 1; dz = 0; l = 1; }
  const point = [centre[0] + dx / l * T.veer.metres, centre[1] + dz / l * T.veer.metres];
  k.veer = { point, until: Math.max(now, k.stagUntil) + T.veer.seconds, from: burst.slice() }; k.veers++;
  return { stagger, veer: point };
}

export const nearBody = (point, centre, contacts = [], reach = 0) => d2(point, centre) <= reach || contacts.some((c) => d2(point, c) <= reach);

// THE PLAYER'S SHELL ON FRIENDLIES: units [{ id, kind: 'hull' | 'mech', pos }] within `radius` of `point`; `last` a Map the caller keeps (id:gun -> time)
export function friendlyHits({ point, radius, gun, units, last, now }, T) {
  const F = T.friendly?.[gun]; if (!F) return [];
  const out = [];
  for (const u of units) {
    if (d2(u.pos, point) > radius) continue;
    const key = `${u.id}:${gun}`, was = last.get(key);
    if (was != null && now - was < F.every) continue;
    last.set(key, now);
    const dmg = F[u.kind] ?? 0; if (dmg > 0) out.push({ id: u.id, kind: u.kind, dmg });
  }
  return out;
}

export const nukeShare = (centre, point, blast, T) => (d2(centre, point) <= blast + T.nuke.slack ? T.nuke.share : 0);

export function nukeCall(since, travel, T) {
  const left = T.nuke.countdown - since;
  return { left: Math.max(0, left), release: since >= T.nuke.countdown - travel };
}
