// THE STAMPEDE (owner, 2026-10-02: "we lost one fun activity; insane ramming bonuses… to have it work we need more waves of rammable
// enemies, larger waves of weak enemies. Sometimes they can have a few hard-cores in them, forcing use of the shield"). Every
// `every`-th wave a breach sends (its 2nd, 4th, ... at every: 2) is a stampede: the plan's rammable bodies `size` times over, its solid
// ones left out, and `cores` hard cores of kind `core` riding in it. A plan with no rammable body takes `fallback` instead. Pure: the
// sector loop (src/fx/sector-run.js waveOf) hands in the plan's entries, ENEMY_SPEC and the content (src/content/sectors.js SECTOR_STAMPEDE).
export const isStampede = (index, tune) => !!tune && tune.every > 0 && index % tune.every === tune.every - 1;

// (2026-10-03, owner: "more waves of soft-body only… spaced just right that it takes some effort (keeping some alive until the last
// moment) to time continuing bonuses"; and "as Isao takes control of the Gunship and SOL ... crazier and crazier waves") the stampedes
// alternate: the first of each pair is a TRICKLE (soft only, `trickle` x the plan's rammables, one body every `trickleGap` seconds so a
// steady rammer can keep the combo alive), the second a FLOOD (`size` x, `cores` hard cores); `tier` (the automations Isao runs) adds
// `tierSize` to both multipliers and `tierCores` cores to the flood. Returns { entries, gap } (gap: the queue's spacing, or null)
export function stampedeWave(entries, spec, tune, { index = 1, tier = 0 } = {}) {
  const trickle = Math.floor(index / tune.every) % 2 === 0, k = tier * (tune.tierSize ?? 0);
  if (trickle) return { entries: capped(stampedeOf(entries, spec, { ...tune, size: tune.trickle + k, cores: 0 }), tune.trickleMax), gap: tune.trickleGap, kind: 'trickle' };
  return { entries: stampedeOf(entries, spec, { ...tune, size: tune.size + k, cores: tune.cores + tier * (tune.tierCores ?? 0) }), gap: null, kind: 'flood' };
}

// A TRICKLE STAYS A TRICKLE (owner, 2026-10-05: "sector 4; lull, nothing comes out anymore"): the sectors' soft multiplier made one
// of hundreds of bodies, and at `trickleGap` apart it dripped for a quarter of an hour while the sector waited on it. At most `max`
// bodies, shared across the entries in proportion
function capped(out, max) {
  const total = out.reduce((n, e) => n + e.count, 0);
  if (!(max > 0) || total <= max) return out;
  return out.map((e) => ({ ...e, count: Math.max(1, Math.round(e.count * max / total)) }));
}

export function stampedeOf(entries, spec, tune) {
  const soft = entries.filter((e) => spec[e.type]?.rammable), total = entries.reduce((n, e) => n + e.count, 0);
  const out = soft.length ? soft.map((e) => ({ type: e.type, count: Math.round(e.count * tune.size) })) : [{ type: tune.fallback, count: Math.round(total * tune.size) }];
  if (tune.cores > 0) out.push({ type: tune.core, count: tune.cores });
  return out;
}
