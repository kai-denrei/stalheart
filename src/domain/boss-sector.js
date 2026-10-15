// THE BOSS SECTOR'S RULES (owner, 2026-10-15: the Cutis-Maku boss fight as a campaign sector, Isao driving the tank as the lure, the player on the
// gunship; spec docs/superpowers/specs/2026-10-15-boss-sector-design.md; the row BOSS_SECTOR in src/content/sectors.js). Pure.
//   bossWaves(row, { tierSpec })   the breach's queue plans: one per entry of `boss.waves` (`count` of the family's `tier`, each at `hp`; 2026-10-16: THE ARENA's
//                                  small Reeds then its pups; a row's single `boss.wave` still reads as one) and then the boss (one of `boss.tier` at `boss.hp`),
//                                  every entry a hunter of the tank (src/domain/hunters.js); `tierSpec(family, tier)` is the creature seam's spec maker, handed in
//   phaseScale(phase, hits)        the damage multiplier by the body's phase (the lab's CUTIS_HITS: the reach is the weak spot: COIL, EXTEND and ANCHOR
//                                  full, REST and SETTLE half, TRANSFER none); 1 for a body with no phase
//   bossAlive(enemies)             { wave, boss, tiers }: the live hunters of the waves' tiers (together, and by tier) and of the boss's
export function bossWaves(row, { tierSpec }) {
  const b = row?.boss;
  if (!b) return [[], []];
  const entry = (t, count) => ({ type: b.family, tier: t.tier, spec: { ...tierSpec(b.family, t.tier), hp: t.hp }, count, hunter: true, pace: t.pace ?? 1 });
  const waves = b.waves ?? (b.wave ? [b.wave] : []);
  return [...waves.map((w) => [entry(w, w.count)]), [entry(b.boss, 1)]];
}

const REACH = new Set(['COIL', 'EXTEND', 'ANCHOR']), REST = new Set(['REST', 'SETTLE']);
export function phaseScale(phase, hits) {
  if (!phase || !hits) return 1;
  if (REACH.has(phase)) return hits.reach ?? 1;
  if (REST.has(phase)) return hits.rest ?? 1;
  if (phase === 'TRANSFER') return hits.transfer ?? 1;
  return 1;
}

export function bossAlive(enemies, { waveTier = 'small', waveTiers = null, bossTier = 'huge' } = {}) {
  const tiersOf = waveTiers ?? [waveTier], tiers = Object.fromEntries(tiersOf.map((t) => [t, 0]));
  let wave = 0, boss = 0;
  for (const e of enemies ?? []) { if (!e?.alive || !e.hunter) continue; if (e.tier === bossTier) boss++; else if (e.tier in tiers) { wave++; tiers[e.tier]++; } }
  return { wave, boss, tiers };
}
