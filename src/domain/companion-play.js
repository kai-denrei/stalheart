// THE COMPANIONS' PLAY (owner, 2026-10-27: "they move around the base freely, sometimes accelerating, sometimes playfully chasing each
// other"). Pure: a pair of play records stepped in game seconds with a seeded `rand`, deciding each unit's MODE, its wanted speed (m/s)
// and WHERE it goes as a token the scene resolves ('pick' a roam point, 'away' a point away from the other, 'other' the other's live
// place, 'hull' the hull's), and the one-shot clip it plays in place. Distances come in as metres; the sphere, the clearing and the
// buildings are the scene's business (src/fx/companions.js), which reports a blocked move through `blocked`.
//   createPlay(knobs) -> { units: [p, p], game: { on, chaser, until, nextAt, tagLock, tags }, greetAt }
//   stepPlay(state, dt, ctx) -> state, ctx: { now, rand, units: [{ top, trot?, idle, sit, tricks }], dist(i, j) metres between the two, toTarget(i),
//     toHull(i) (null: no hull), blocked(i), clipSecs(i, name) }
//   MODES: idle (the loop at rest) | wander (a walk to a roam point) | dash (a burst at most of the top speed) | chase / flee (the game of tag:
//     the chaser at its top, the fleer at `flee` of its own; a tag within tagM swaps the roles; over at `until`) | greet (a trot to the hull)
//     | sit / trick (a one-shot in place; `greeted` is the sit by the hull)
const span = ([a, b], rand) => a + (b - a) * rand();
export const MOVING = new Set(['wander', 'dash', 'chase', 'flee', 'greet']);

export function createPlay(knobs) {
  const p = () => ({ mode: 'idle', until: 0, target: null, retarget: false, speed: 0, oneShot: null, moves: 0, blockedAt: -1 });
  return { units: [p(), p()], game: { on: false, chaser: 0, until: 0, nextAt: knobs.chase.first, tagLock: 0, tags: 0, games: 0 }, greetAt: knobs.greet.first, knobs };
}

function rest(p, now, knobs, rand) { p.mode = 'idle'; p.until = now + span(knobs.idle, rand); p.target = null; p.speed = 0; p.oneShot = null; }
function goTo(p, mode, token, speed, until) { p.mode = mode; p.target = token; p.retarget = true; p.speed = speed; p.until = until; p.oneShot = null; p.moves++; }

export function stepPlay(s, dt, ctx) {
  const { now, rand } = ctx, k = s.knobs, g = s.game;
  // the game of tag over the pair
  if (g.on) {
    if (now >= g.until) { g.on = false; g.nextAt = now + span(k.chase.every, rand); for (const p of s.units) rest(p, now, k, rand); }
    else if (ctx.dist(0, 1) < k.chase.tagM && now >= g.tagLock) { g.chaser = 1 - g.chaser; g.tagLock = now + 1.2; g.tags++; for (let i = 0; i < 2; i++) goTo(s.units[i], i === g.chaser ? 'chase' : 'flee', i === g.chaser ? 'other' : 'away', (i === g.chaser ? 1 : k.chase.flee) * ctx.units[i].top, g.until); }
  } else if (now >= g.nextAt && s.units.every((p) => p.mode === 'idle' || p.mode === 'wander')) {
    if (ctx.dist(0, 1) > k.chase.startM) { for (let i = 0; i < 2; i++) if (s.units[i].target !== 'other') goTo(s.units[i], 'wander', 'other', Math.min(ctx.units[i].trot ?? k.trot, ctx.units[i].top), now + k.wanderMax); return s; }   // too far apart for a game: they trot together first
    g.on = true; g.games++; g.chaser = rand() < 0.5 ? 0 : 1; g.until = now + span(k.chase.secs, rand); g.tagLock = now + 1;
    for (let i = 0; i < 2; i++) goTo(s.units[i], i === g.chaser ? 'chase' : 'flee', i === g.chaser ? 'other' : 'away', (i === g.chaser ? 1 : k.chase.flee) * ctx.units[i].top, g.until);
  }
  for (let i = 0; i < 2; i++) {
    const p = s.units[i], u = ctx.units[i], blocked = ctx.blocked(i);
    if (blocked) p.blockedAt = now;
    switch (p.mode) {
      case 'idle': if (now >= p.until) {
        const hull = ctx.toHull(i), r = rand();
        if (hull != null && now >= s.greetAt) { s.greetAt = now + span(k.greet.every, rand); goTo(p, 'greet', 'hull', Math.min(u.trot ?? k.trot, u.top), now + k.wanderMax); }
        else if (r < 0.55) goTo(p, 'wander', 'pick', span(k.wander, rand), now + k.wanderMax);
        else if (r < 0.75) goTo(p, 'dash', 'pick', span(k.dash, rand) * u.top, now + k.wanderMax);
        else if (r < 0.87 || !u.tricks.length) { p.mode = 'sit'; p.oneShot = u.sit; p.speed = 0; p.until = now + span(k.sitSecs, rand); }
        else { const t = u.tricks[Math.min(u.tricks.length - 1, Math.floor(rand() * u.tricks.length))]; p.mode = 'trick'; p.oneShot = t; p.speed = 0; p.until = now + ctx.clipSecs(i, t) + 0.5; }
      } break;
      case 'wander': case 'dash': if (now >= p.until || ctx.toTarget(i) < 1.2) rest(p, now, k, rand); else if (blocked) { p.target = 'pick'; p.retarget = true; } break;
      case 'chase': if (blocked) { p.target = 'detour'; p.retarget = true; } else if (p.target !== 'other' && now - p.blockedAt > 1) { p.target = 'other'; p.retarget = true; } break;
      case 'flee': if (blocked || ctx.toTarget(i) < 1.5) { p.target = 'away'; p.retarget = true; } break;
      case 'greet': { const d = ctx.toHull(i); if (d == null || now >= p.until) rest(p, now, k, rand); else if (d < k.greet.nearM) { p.mode = 'greeted'; p.oneShot = u.sit; p.speed = 0; p.target = null; p.until = now + span(k.sitSecs, rand); } else if (blocked) { p.target = 'pick'; p.retarget = true; p.mode = 'wander'; } } break;
      case 'sit': case 'trick': case 'greeted': if (now >= p.until) rest(p, now, k, rand); break;
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
