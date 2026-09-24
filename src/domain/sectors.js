// THE SECTOR'S RULES (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 2). A sector opens breaches, each
// with its own wave programme. A breach is open until it is CLOSED early (a 105 round, SOL-82, shells, a strike: its
// remaining waves never come and what they would have paid is booked as left in the field) or SPENT (its last wave has
// emerged and it collapses on its own, paying the held bonus). The sector is secure when no breach is open and no enemy
// of the sector is alive.
//
// Pure. The clock, the spawner and the seal effects belong to the caller; the tunables come in from src/content/sectors.js.

// The def for sector n >= 1: an authored row, or one generated past the table from the last authored row (its flags
// carry over). The generator's arithmetic is documented beside SECTOR_GENERATOR.
export function sectorDef(n, table, generator) {
  n = Math.max(1, Math.floor(n) || 1);
  const ladderCap = generator.ladderCap ?? Infinity;
  if (n <= table.length) { const d = table[n - 1]; return { ...d, waveBase: d.ladderStart ?? 0, ladderCap }; }
  const last = table[table.length - 1], past = n - table.length;
  return {
    ...last, n, name: `${generator.name} ${n}`, new: null, brief: generator.brief,
    breaches: { ...generator.sides[(past - 1) % generator.sides.length] },
    waves: generator.wavesBase + past,
    threat: Math.round((last.threat + generator.threatStep * past) * 100) / 100,
    held: { kg: generator.held.kg + generator.heldStep.kg * (past - 1), points: generator.held.points + generator.heldStep.points * (past - 1) },
    waveBase: generator.ladderStart ?? 0, ladderCap,
  };
}

// breaches: [{ id, side, cell }], one per breach the caller placed. waveIndexBase is the ladder wave number before the
// breach's first wave (def.waveBase) and ladderCap the highest ladder wave it is ever sized at.
export function makeSector(def, breaches, t) {
  return {
    n: def.n, name: def.name, threat: def.threat, held: { ...def.held }, t0: t, securedAt: null,
    breaches: breaches.map((b) => ({
      id: b.id, side: b.side, cell: b.cell, state: 'open', wavesPlanned: def.waves, wavesReleased: 0,
      waveIndexBase: def.waveBase ?? 0, ladderCap: def.ladderCap ?? Infinity, threat: def.threat, openedAt: t, closedAt: null, closedBy: null,
      leftInField: { kg: 0, points: 0 }, bonus: { kg: 0, points: 0 },
    })),
  };
}

const breachOf = (st, id) => st.breaches.find((b) => b.id === id);
export const breachLive = (st, id) => breachOf(st, id)?.state === 'open';

// the ladder wave number the breach's next wave is sized at, or null when it has nothing more to send
export function nextWaveIndex(st, id) {
  const b = breachOf(st, id);
  return b && b.state === 'open' && b.wavesReleased < b.wavesPlanned ? Math.min(b.ladderCap, b.waveIndexBase + b.wavesReleased + 1) : null;
}

// a wave leaves the breach: { wave, last } for the spawner, or null when the breach is closed, spent or exhausted
export function releaseWave(st, id, t) {
  const wave = nextWaveIndex(st, id);
  if (wave === null) return null;
  const b = breachOf(st, id);
  b.wavesReleased++; b.lastReleaseAt = t;
  return { wave, last: b.wavesReleased === b.wavesPlanned };
}

// THE CLOCK'S ONE GUARD (2026-09-24): the next pulse arms only while the live bodies plus the bodies it would send fit the
// budget. An empty field always takes the next pulse, so a pulse bigger than the budget can never stall a sector.
export const pulseFits = (alive, next, budget) => alive <= 0 || alive + next <= budget;

export const CLOSERS = Object.freeze(['gunship', 'laser', 'shells', 'strike']);

// closed early by `by` (one of CLOSERS); forfeit is forfeitOf's estimate for the waves it will not send. A breach whose
// programme had already all left forfeits nothing. Returns the breach, or null when it was not open.
export function closeBreach(st, id, by, t, forfeit = { kg: 0, points: 0 }) {
  const b = breachOf(st, id);
  if (!b || b.state !== 'open' || !CLOSERS.includes(by)) return null;
  const owed = b.wavesReleased < b.wavesPlanned;
  b.state = 'closed'; b.closedBy = by; b.closedAt = t;
  b.leftInField = owed ? { kg: Math.max(0, Math.round(forfeit.kg)), points: Math.max(0, Math.round(forfeit.points)) } : { kg: 0, points: 0 };
  return b;
}

// the last wave has emerged and the breach collapses on its own: HELD. Returns the bonus to pay, or null when the breach
// is not open or still has waves to send.
export function spendBreach(st, id, t) {
  const b = breachOf(st, id);
  if (!b || b.state !== 'open' || b.wavesReleased < b.wavesPlanned) return null;
  b.state = 'spent'; b.closedBy = 'held'; b.closedAt = t; b.bonus = { ...st.held };
  return { ...b.bonus };
}

// no breach open and none of the sector's enemies alive (guards at expedition sites are the caller's to leave out)
export const isSecure = (st, aliveSectorEnemies) => st.breaches.every((b) => b.state !== 'open') && aliveSectorEnemies <= 0;

export function summary(st) {
  const sum = (f) => st.breaches.reduce((s, b) => s + f(b), 0);
  return {
    sector: st.n, name: st.name, breaches: st.breaches.length,
    open: st.breaches.filter((b) => b.state === 'open').length,
    closed: st.breaches.filter((b) => b.state === 'closed').length,
    spent: st.breaches.filter((b) => b.state === 'spent').length,
    wavesPlanned: sum((b) => b.wavesPlanned), wavesReleased: sum((b) => b.wavesReleased),
    leftInField: { kg: sum((b) => b.leftInField.kg), points: sum((b) => b.leftInField.points) },
    bonus: { kg: sum((b) => b.bonus.kg), points: sum((b) => b.bonus.points) },
  };
}

// LEFT IN THE FIELD. What the waves a breach will not send would have paid: estimateWave(waveIndex, threat) -> { kg, points }
// summed over the waves still owed. The caller builds estimateWave (computeWavePlan + economy + score), usually through
// waveYield below.
export function forfeitOf({ wavesPlanned, wavesReleased, waveIndexBase = 0, ladderCap = Infinity, threat = 1 }, estimateWave) {
  let kg = 0, points = 0;
  for (let i = wavesReleased + 1; i <= wavesPlanned; i++) {
    const y = estimateWave(Math.min(ladderCap, waveIndexBase + i), threat);
    kg += y.kg; points += y.points;
  }
  return { kg: Math.round(kg), points: Math.round(points) };
}

// The default estimate for one wave from a plain plan: { entries: [{ type, count }] } (computeWavePlan's shape) or
// { counts: { type: n } }. bounty: { type: kg } (ENEMY_SPEC's bounties); pointScale x weight turns bounty into points
// (score.js POINT_SCALE, SRC_WEIGHT); killShare and streak come from SECTOR_FORFEIT; clearKg / clearPoints are the wave's
// clear bonuses (economy waveClearBonus, score waveScore).
export function waveYield(plan, { bounty, pointScale = 10, weight = 1, killShare = 1, streak = 1, clearKg = 0, clearPoints = 0 }) {
  const counts = plan.counts ?? Object.fromEntries((plan.entries ?? []).map((e) => [e.type, e.count]));
  let kills = 0;
  for (const [type, count] of Object.entries(counts)) kills += count * (bounty[type] ?? 0);
  kills *= killShare;
  return { kg: kills * streak + clearKg, points: kills * pointScale * weight + clearPoints };
}

// PLACEMENT POLICY. candidates: [{ cell, side, hops, pos: [x, y, z] }] (hops: walking distance from the heart); want:
// { gate: 1, back: 1 }. Sides are filled in want's key order, one pick per round across sides so neither side takes all
// the far ground. Each pick is the farthest valid candidate of its side, drawn at random among those within bandHops of
// the farthest; valid means at least minSeparation from every pick so far and more than exclusion from every excluded
// position (straight-line distance, in pos units). When separation cannot be met the farthest candidate clear of the
// exclusions is taken and marked relaxed; a side with no candidate at all is left short. Deterministic for a given rng.
export function pickBreachCells({ candidates, want, minSeparation = 0, exclusion = 0, excluded = [], bandHops = 0, rng = () => 0 }) {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const clear = (c) => excluded.every((p) => dist(c.pos, p) > exclusion);
  const picks = [], left = { ...want };
  const choose = (pool) => {
    const far = Math.max(...pool.map((c) => c.hops));
    const band = pool.filter((c) => c.hops >= far - bandHops).sort((a, b) => b.hops - a.hops || a.cell - b.cell);
    return band[Math.min(band.length - 1, Math.floor(rng() * band.length))];
  };
  for (let round = 0; Object.values(left).some((n) => n > 0) && round < 1000; round++) {
    for (const side of Object.keys(left)) {
      if (left[side] <= 0) continue;
      left[side]--;
      const open = candidates.filter((c) => c.side === side && clear(c) && !picks.some((p) => p.cell === c.cell));
      if (!open.length) continue;
      const apart = open.filter((c) => picks.every((p) => dist(c.pos, p.pos) >= minSeparation));
      const pick = apart.length ? choose(apart) : choose(open);
      picks.push({ ...pick, relaxed: !apart.length });
    }
  }
  return picks;
}
