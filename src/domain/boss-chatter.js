// Isao's chatter director in the boss lab's bait mode as a pure rule (wave B, 2026-10-09; owner: "Isao is too verbose with the three lines about
// elevation. reduce the frequency ... and add more diversity"). The lab's triggers ask for a line (`want`); the director says one at a time
// (`nextLine`), at least `chatter.gap` seconds after the last, the highest `priority` among the lines wanted and free (the earliest want on a tie): a line
// waits out its own `cooldown`, says at most `per` a round, and its want is dropped after `ttl` seconds unsaid (none: kept until said). A line with
// `variants` takes them `ordered` (in turn, by the round's count) or at random, never the same twice running; `chance` is the share of its triggers
// that ask (seeded; `force` asks regardless); `then` is a line wanted `after` seconds once it is said. Time is the caller's clock in seconds.
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

export function makeChatter(seed = 1) {
  return { rng: Math.imul(seed >>> 0, 0xC2B2AE35) >>> 0, lastAt: -Infinity, lastOf: {}, lastVariant: {}, count: {}, wants: new Map(), log: [] };
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

// the line to say now ({ key, variant, at }) or null: the gap, the stale wants dropped, the cooldowns and the round's counts
export function nextLine(ch, now, tune) {
  const C = tune.chatter;
  for (const [k, w] of ch.wants) if (now - w.at > (C.lines[k].ttl ?? Infinity)) ch.wants.delete(k);
  if (now - ch.lastAt < C.gap) return null;
  let best = null;
  for (const [k, w] of ch.wants) {
    const L = C.lines[k];
    if (now < w.at || now - (ch.lastOf[k] ?? -Infinity) < (L.cooldown ?? 0)) continue;
    if (!best || L.priority > C.lines[best].priority || (L.priority === C.lines[best].priority && w.at < ch.wants.get(best).at)) best = k;
  }
  if (best === null) return null;
  const L = C.lines[best], n = L.variants ?? 1, said = ch.count[best] ?? 0;
  let variant = 0;
  if (n > 1 && L.ordered) variant = said % n;
  else if (n > 1) {
    const last = ch.lastVariant[best];
    variant = Math.floor(draw(ch) * (last === undefined ? n : n - 1));
    if (last !== undefined && variant >= last) variant++;
  }
  ch.wants.delete(best);
  ch.lastAt = now; ch.lastOf[best] = now; ch.lastVariant[best] = variant; ch.count[best] = said + 1;
  const line = { key: best, variant, at: now };
  ch.log.push(line); if (ch.log.length > LOG) ch.log.shift();
  if (L.then) want(ch, L.then, now, tune, { force: true, after: L.after ?? 0 });
  return line;
}

// a new round: nothing wanted, the round's counts back at 0 (the gap, the cooldowns and the log run on)
export function resetChatter(ch) { ch.wants.clear(); ch.count = {}; }
