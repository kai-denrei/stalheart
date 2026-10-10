// Isao's chatter director in the boss lab's bait mode as a pure rule (wave B, 2026-10-09; owner: "Isao is too verbose with the three lines about
// elevation. reduce the frequency ... and add more diversity"). The lab's triggers ask for a line (`want`); the director says one at a time
// (`nextLine`), at least `chatter.gap` seconds after the last, the highest `priority` among the lines wanted and free (the earliest want on a tie): a line
// waits out its own `cooldown`, says at most `per` a round, and its want is dropped after `ttl` seconds unsaid (none: kept until said). A line with
// `variants` takes them `ordered` (in turn, by the round's count) or at random, never the same twice running; `chance` is the share of its triggers
// that ask (seeded; `force` asks regardless); `then` is a line wanted `after` seconds once it is said. Time is the caller's clock in seconds.
// THE SECOND PASS (owner, 2026-10-10: "so he doesn't repeat too much" and two event lines). A line with several takes that is not `ordered` prefers a take not yet
// played (the takes played carry over the rounds, and all of them played, the set starts again, never the same twice running); an `ordered` one goes on in turn from
// the take last said. THE FILLER (`tune.chatter.filler`): when no line has been said for a random `quietMin`..`quietMax` seconds and nothing is wanted, `nextLine`
// says the next of a pool of `variants` takes under the key `filler`, at the lowest priority: the pool is shuffled (seeded by the round) and goes through whole before
// any take comes again (never the same take twice running across the turn), and carries over the rounds (`carryChatter`). An `urgent` line (the finish and the win)
// ignores the gap, never the line still being said (`hold`: the caller says how long a line runs). `endLines` is the rule for the fight's two event lines.
// Imports nothing; `tune.chatter` is the numbers.

// a small seeded generator (mulberry32) on `ch.rng`; each draw is a number in [0, 1)
function draw(ch) {
  ch.rng = (ch.rng + 0x6D2B79F5) >>> 0;
  let t = ch.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const LOG = 100;   // the run's log keeps this many lines

const mix = (seed) => Math.imul(seed >>> 0, 0xC2B2AE35) >>> 0;

export function makeChatter(seed = 1) {
  return { rng: mix(seed), lastAt: -Infinity, busyUntil: -Infinity, since: undefined, fillGap: null, lastOf: {}, lastVariant: {}, played: {}, count: {}, wants: new Map(), log: [],
    pool: { left: null, last: null, shuffleSeed: mix(seed), shuffled: false, turns: 0 }, rounds: 0 };
}

// the next round's director on `seed`: nothing wanted, the round's counts cleared; the log, the gap, the cooldowns, the takes played and the filler's pool run on
// (the pool's rest is shuffled again by the round's seed)
export function carryChatter(prev, seed = 1) {
  const ch = makeChatter(seed), rounds = (prev.rounds ?? 0) + 1;
  Object.assign(ch, { lastAt: prev.lastAt, busyUntil: prev.busyUntil, lastOf: prev.lastOf, lastVariant: prev.lastVariant, played: prev.played, log: prev.log, rounds });
  ch.pool = { ...prev.pool, shuffleSeed: mix(seed + Math.imul(rounds, 0x9E3779B1)), shuffled: false };
  return ch;
}

// the caller's line runs until `until` (its clock): no urgent line cuts in before it
export function hold(ch, until) { ch.busyUntil = Math.max(ch.busyUntil, until); }

// a seeded shuffle (Fisher-Yates) of a copy of `list`
function shuffled(list, seed) {
  const g = { rng: seed }, a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(draw(g) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// the next take of the filler's pool of `n`: the round's shuffle of what is left of the turn; a spent pool starts a new turn (not opening on the take just said)
function poolTake(ch, n) {
  const P = ch.pool;
  if (!P.left || P.left.length === 0) {
    P.left = shuffled(Array.from({ length: n }, (_, i) => i), P.shuffleSeed + Math.imul(P.turns + 1, 0x85EBCA6B)); P.turns++; P.shuffled = true;
    if (n > 1 && P.left[0] === P.last) [P.left[0], P.left[1]] = [P.left[1], P.left[0]];
  } else if (!P.shuffled) { P.left = shuffled(P.left, P.shuffleSeed); P.shuffled = true; }
  P.last = P.left.shift();
  return P.last;
}

// a trigger at `now` asks for `key`: taken unless the line is spent this round or its chance does not fall; an existing want keeps its time.
// `after` delays the want by that many seconds. Returns whether it was taken
export function want(ch, key, now, tune, { force = false, after = 0 } = {}) {
  const L = tune.chatter.lines[key];
  if (!L) return false;
  if (L.per && (ch.count[key] ?? 0) >= L.per) return false;
  if (!force && L.chance !== undefined && L.chance < 1 && draw(ch) >= L.chance) return false;
  if (!ch.wants.has(key)) ch.wants.set(key, { at: now + after });
  return true;
}

// the take of a line of `n` takes: `ordered`, the one after the last said; else one not played yet (all played: the set starts again) and not the last said
function takeOf(ch, key, L) {
  const n = L.variants ?? 1, last = ch.lastVariant[key];
  if (n <= 1) return 0;
  if (L.ordered) return last === undefined ? 0 : (last + 1) % n;
  const seen = (ch.played[key] ??= new Set());
  let pick = Array.from({ length: n }, (_, i) => i).filter((i) => !seen.has(i) && i !== last);
  if (pick.length === 0) { seen.clear(); pick = Array.from({ length: n }, (_, i) => i).filter((i) => i !== last); }
  const variant = pick[Math.floor(draw(ch) * pick.length)];
  seen.add(variant);
  return variant;
}

// the line to say now ({ key, variant, at }) or null: the line still being said, the gap (an `urgent` line ignores it), the stale wants dropped, the cooldowns and
// the round's counts; then, with nothing wanted at all and `filler` not false, the filler once the quiet has run its random length
export function nextLine(ch, now, tune, { filler = true } = {}) {
  const C = tune.chatter;
  for (const [k, w] of ch.wants) if (now - w.at > (C.lines[k].ttl ?? Infinity)) ch.wants.delete(k);
  if (ch.since === undefined) ch.since = now;
  if (now < ch.busyUntil) return null;
  const inGap = now - ch.lastAt < C.gap;
  let best = null;
  for (const [k, w] of ch.wants) {
    const L = C.lines[k];
    if (now < w.at || now - (ch.lastOf[k] ?? -Infinity) < (L.cooldown ?? 0) || (inGap && !L.urgent)) continue;
    if (!best || L.priority > C.lines[best].priority || (L.priority === C.lines[best].priority && w.at < ch.wants.get(best).at)) best = k;
  }
  let key = best, variant = 0, L;
  if (best !== null) {
    L = C.lines[best]; variant = takeOf(ch, best, L);
    ch.wants.delete(best);
  } else {
    const F = C.filler;
    if (!F || !filler || inGap || ch.wants.size > 0) return null;
    ch.fillGap ??= F.quietMin + draw(ch) * (F.quietMax - F.quietMin);
    if (now - Math.max(ch.lastAt, ch.since) < ch.fillGap) return null;
    key = 'filler'; variant = poolTake(ch, F.variants);
  }
  ch.lastAt = now; ch.lastOf[key] = now; ch.lastVariant[key] = variant; ch.count[key] = (ch.count[key] ?? 0) + 1; ch.fillGap = null;
  const line = { key, variant, at: now };
  ch.log.push(line); if (ch.log.length > LOG) ch.log.shift();
  if (L?.then) want(ch, L.then, now, tune, { force: true, after: L.after ?? 0 });
  return line;
}

// a new round on the same director: nothing wanted, the round's counts back at 0, the quiet counted from the round's first tick (the gap, the cooldowns, the log,
// the takes played and the pool run on)
export function resetChatter(ch) { ch.wants.clear(); ch.count = {}; ch.since = undefined; ch.fillGap = null; }

// the fight's two event lines as the round stands: `finishHim` while the boss is alive in a running fight under `finishShare` of its hit points (said once a round:
// the line's `per`); `win` after the boss is KILLED with Isao up, `winAfter` seconds on (no word on a win that cost him: his hit points at 0). Returns [{ key, after }]
export function endLines({ phase, hp, max, isaoHp }, tune) {
  const C = tune.chatter;
  if (phase === 'fight' && max > 0 && hp > 0 && hp / max < C.finishShare) return [{ key: 'finishHim', after: 0 }];
  if (phase === 'killed' && isaoHp > 0) return [{ key: 'win', after: C.winAfter }];
  return [];
}
