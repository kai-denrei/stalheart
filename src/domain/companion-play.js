// THE COMPANIONS' PLAY (owner, 2026-10-27: "they move around the base freely, sometimes accelerating, sometimes playfully chasing each
// other"). Pure: a pair of play records stepped in game seconds with a seeded `rand`, deciding each unit's MODE, its wanted speed (m/s)
// and WHERE it goes as a token the scene resolves ('pick' a roam point, 'away' a point away from the other, 'other' the other's live
// place, 'hull' the hull's), and the one-shot clip it plays in place. Distances come in as metres; the sphere, the clearing and the
// buildings are the scene's business (src/fx/companions.js), which reports a blocked move through `blocked`.
//   createPlay(knobs, n = 2) -> { units: [p, ...n], game: { on, pair: [i, j], chaser, until, nextAt, tagLock, tags }, greetAt }
//     (round 6, 2026-11-05: K0-TECH makes three: a game of tag is between two of the printed ones, `pair`, picked by `rand` when more than two are
//     free; `chaser` is a unit index; a unit's record carries `with`, the other one of its game or its trot together, which the scene's 'other' resolves to)
//   stepPlay(state, dt, ctx) -> state, ctx: { now, rand, units: [{ top, trot?, wander?, idle, sit, tricks }], dist(i, j) metres between two, toTarget(i),
//     toHull(i) (null: no hull), blocked(i), clipSecs(i, name), present(i)? (2026-10-30: a unit Isao has not printed yet is not on the planet: its
//     record is left alone and no game of tag starts without both; absent, both are present), hullMotion(i)? (round 4, 2026-11-02: the hull as unit i
//     sees it, { d metres, speed m/s, closing m/s toward the unit, lateral metres off the hull's line of travel } or null; absent, a still hull),
//     dancing()? (round 4: DAY 42's party is on: both dance; absent, no party) }
//   MODES: idle (the loop at rest) | wander (a walk to a roam point) | dash (a burst at most of the top speed) | chase / flee (the game of tag:
//     the chaser at its top, the fleer at `flee` of its own; a tag within tagM swaps the roles; over at `until`) | greet (a trot to the hull)
//     | sit / trick (a one-shot in place; `greeted` is the sit by the hull)
//     | dodge (OUT OF THE TANK'S WAY, owner 2026-11-02, round 4 note 5: "the companions must get out of the tank's way ... instead of being driven
//     through when they come to investigate": a hull moving toward the unit, within `dodge.nearM` or due on it inside `dodge.leadS` seconds along
//     its lane, sends it off the hull's line at its top speed ('fromHull', resolved by the scene) until the hull is past or still and `clearM` off;
//     it pre-empts every mode but the dance; the greet starts only after the hull has stood still for `stillS` and breaks off as it moves)
//     | dance (DAY 42 ON THE DANCE FLOOR, owner 2026-11-02, round 4 note 8: while the party is on both go to the floor under the ball ('floor', resolved
//     by the scene) and alternate a one-shot in place (a trick, then a sit) with a short dash round the floor, until the klaxon; no tag meanwhile)
const span = ([a, b], rand) => a + (b - a) * rand();
export const MOVING = new Set(['wander', 'dash', 'chase', 'flee', 'greet', 'dodge', 'dance']);

export function createPlay(knobs, n = 2) {
  const p = () => ({ mode: 'idle', until: 0, target: null, retarget: false, speed: 0, oneShot: null, moves: 0, blockedAt: -1, with: null });
  return { units: Array.from({ length: n }, p), game: { on: false, pair: [0, 1], chaser: 0, until: 0, nextAt: knobs.chase.first, tagLock: 0, tags: 0, games: 0 }, greetAt: knobs.greet.first, hullStill: 0, dodges: 0, knobs };
}

function rest(p, now, knobs, rand) { p.mode = 'idle'; p.until = now + span(knobs.idle, rand); p.target = null; p.speed = 0; p.oneShot = null; }
function goTo(p, mode, token, speed, until, other = null) { p.mode = mode; p.target = token; p.retarget = true; p.speed = speed; p.until = until; p.oneShot = null; p.moves++; if (other != null) p.with = other; }
// the game's roles over its pair: the chaser after the other, the other away at `flee` of its own top
function roles(s, ctx, keep) { const g = s.game, [a, b] = g.pair; for (const i of [a, b]) if (!keep || s.units[i].mode !== 'dodge') goTo(s.units[i], i === g.chaser ? 'chase' : 'flee', i === g.chaser ? 'other' : 'away', (i === g.chaser ? 1 : s.knobs.chase.flee) * ctx.units[i].top, g.until, i === a ? b : a); }
// the hull bearing down on a unit: moving, closing on it, and either already near or due on it within leadS along its lane
export function hullThreat(m, k) {
  if (!m || m.speed <= k.movingMps || m.closing <= k.closingMps) return false;
  return m.d < k.nearM || (m.d < k.rangeM && m.lateral < k.laneM && m.d / m.closing < k.leadS);
}

export function stepPlay(s, dt, ctx) {
  const { now, rand } = ctx, k = s.knobs, g = s.game, here = (i) => (ctx.present ? !!ctx.present(i) : true), kd = k.dodge, n = s.units.length;
  const motion = s.units.map((_, i) => ctx.hullMotion?.(i) ?? null), hullSpeed = motion.find((m) => m)?.speed ?? 0;
  s.hullStill = hullSpeed < kd.stillMps ? s.hullStill + dt : 0;
  const dancing = !!ctx.dancing?.(), kn = k.dance;
  if (dancing && g.on) { g.on = false; g.nextAt = now + span(k.chase.every, rand); }   // the party ends a game of tag
  // the game of tag over the pair
  const free = () => { const out = []; for (let i = 0; i < n; i++) if (here(i) && (s.units[i].mode === 'idle' || s.units[i].mode === 'wander')) out.push(i); return out; };
  if (g.on) {
    const [a, b] = g.pair;
    if (now >= g.until) { g.on = false; g.nextAt = now + span(k.chase.every, rand); rest(s.units[a], now, k, rand); rest(s.units[b], now, k, rand); }
    else if (ctx.dist(a, b) < k.chase.tagM && now >= g.tagLock) { g.chaser = g.chaser === a ? b : a; g.tagLock = now + 1.2; g.tags++; roles(s, ctx, true); }
  } else if (!dancing && now >= g.nextAt) {
    let pool = free();
    if (pool.length >= 2) {
      if (pool.length > 2) { const x = pool.splice(Math.min(pool.length - 1, Math.floor(rand() * pool.length)), 1)[0], y = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]; pool = x < y ? [x, y] : [y, x]; }
      const [a, b] = pool; g.pair = [a, b];
      if (ctx.dist(a, b) > k.chase.startM) { for (const i of [a, b]) if (s.units[i].target !== 'other') goTo(s.units[i], 'wander', 'other', Math.min(ctx.units[i].trot ?? k.trot, ctx.units[i].top), now + k.wanderMax, i === a ? b : a); return s; }   // too far apart for a game: they trot together first
      g.on = true; g.games++; g.chaser = rand() < 0.5 ? a : b; g.until = now + span(k.chase.secs, rand); g.tagLock = now + 1;
      roles(s, ctx, false);
    }
  }
  for (let i = 0; i < n; i++) {
    if (!here(i)) continue;
    const p = s.units[i], u = ctx.units[i], blocked = ctx.blocked(i);
    if (blocked) p.blockedAt = now;
    if (dancing && p.mode !== 'dance') { goTo(p, 'dance', 'floor', Math.min(u.trot ?? k.trot, u.top), now + k.wanderMax); p.dances = 0; continue; }
    if (!dancing && p.mode === 'dance') { rest(p, now, k, rand); continue; }
    const threat = p.mode !== 'dance' && hullThreat(motion[i], kd);
    if (threat && p.mode !== 'dodge') { goTo(p, 'dodge', 'fromHull', u.top, now + kd.maxS); s.dodges++; continue; }
    switch (p.mode) {
      case 'idle': if (now >= p.until) {
        const hull = ctx.toHull(i), r = rand();
        if (hull != null && now >= s.greetAt && s.hullStill >= kd.stillS) { s.greetAt = now + span(k.greet.every, rand); goTo(p, 'greet', 'hull', Math.min(u.trot ?? k.trot, u.top), now + k.wanderMax); }
        else if (r < 0.55) goTo(p, 'wander', 'pick', span(u.wander ?? k.wander, rand), now + k.wanderMax);
        else if (r < 0.75) goTo(p, 'dash', 'pick', span(k.dash, rand) * u.top, now + k.wanderMax);
        else if (r < 0.87 || !u.tricks.length) { p.mode = 'sit'; p.oneShot = u.sit; p.speed = 0; p.until = now + span(k.sitSecs, rand); }
        else { const t = u.tricks[Math.min(u.tricks.length - 1, Math.floor(rand() * u.tricks.length))]; p.mode = 'trick'; p.oneShot = t; p.speed = 0; p.until = now + ctx.clipSecs(i, t) + 0.5; }
      } break;
      case 'wander': case 'dash': if (now >= p.until || ctx.toTarget(i) < 1.2) rest(p, now, k, rand); else if (blocked) { p.target = 'pick'; p.retarget = true; } break;
      case 'chase': if (blocked) { p.target = 'detour'; p.retarget = true; } else if (p.target !== 'other' && now - p.blockedAt > 1) { p.target = 'other'; p.retarget = true; } break;
      case 'flee': if (blocked || ctx.toTarget(i) < 1.5) { p.target = 'away'; p.retarget = true; } break;
      case 'dodge': { const m = motion[i];
        if (threat) { if (blocked || now >= p.until || ctx.toTarget(i) < 1.2) { p.target = 'fromHull'; p.retarget = true; p.until = Math.max(p.until, now + 1); } }
        else if (!m || m.d > kd.clearM || m.speed < kd.stillMps || now >= p.until) rest(p, now, k, rand);
        else if (blocked || ctx.toTarget(i) < 1.2) { p.target = 'fromHull'; p.retarget = true; } } break;
      case 'dance':
        if (p.target) { if (now >= p.until || blocked || ctx.toTarget(i) < 1.5) {   // on the floor (or as far as it got): a trick, then a sit, in turn
          const t = p.dances++ % 2 === 0 && u.tricks.length ? u.tricks[Math.min(u.tricks.length - 1, Math.floor(rand() * u.tricks.length))] : u.sit;
          p.target = null; p.speed = 0; p.oneShot = t; p.until = now + (t === u.sit ? span(kn.sitSecs, rand) : ctx.clipSecs(i, t) + 0.3);
        } } else if (now >= p.until) { p.oneShot = null; p.target = 'floor'; p.retarget = true; p.speed = span(kn.dash, rand) * u.top; p.until = now + kn.dashS; p.moves++; }   // a short dash round the floor
        break;
      case 'greet': { const d = ctx.toHull(i); if (d == null || now >= p.until || hullSpeed > kd.stillMps) rest(p, now, k, rand); else if (d < k.greet.nearM) { p.mode = 'greeted'; p.oneShot = u.sit; p.speed = 0; p.target = null; p.until = now + span(k.sitSecs, rand); } else if (blocked) { p.target = 'pick'; p.retarget = true; p.mode = 'wander'; } } break;
      case 'greeted': if (now >= p.until || hullSpeed > kd.movingMps) rest(p, now, k, rand); break;   // up as the hull moves off
      case 'sit': case 'trick': if (now >= p.until) rest(p, now, k, rand); break;
      default: rest(p, now, k, rand);
    }
  }
  return s;
}

// the gait a speed asks for: the first clip whose band holds it (the last past every band), and its rate, clamped
export function gaitFor(gaits, speed, [lo, hi]) {
  const g = gaits.find((x) => speed <= x.max) ?? gaits[gaits.length - 1];
  return { clip: g.clip, rate: Math.max(lo, Math.min(hi, speed / g.mps)) };
}
