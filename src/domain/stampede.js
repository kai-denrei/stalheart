// THE STAMPEDE (owner, 2026-10-02: "we lost one fun activity; insane ramming bonuses… to have it work we need more waves of rammable
// enemies, larger waves of weak enemies. Sometimes they can have a few hard-cores in them, forcing use of the shield"). Every
// `every`-th wave a breach sends (its 2nd, 4th, ... at every: 2) is a stampede: the plan's rammable bodies `size` times over, its solid
// ones left out, and `cores` hard cores of kind `core` riding in it. A plan with no rammable body takes `fallback` instead. Pure: the
// sector loop (src/fx/sector-run.js waveOf) hands in the plan's entries, ENEMY_SPEC and the content (src/content/sectors.js SECTOR_STAMPEDE).
export const isStampede = (index, tune) => !!tune && tune.every > 0 && index % tune.every === tune.every - 1;

export function stampedeOf(entries, spec, tune) {
  const soft = entries.filter((e) => spec[e.type]?.rammable), total = entries.reduce((n, e) => n + e.count, 0);
  const out = soft.length ? soft.map((e) => ({ type: e.type, count: Math.round(e.count * tune.size) })) : [{ type: tune.fallback, count: Math.round(total * tune.size) }];
  if (tune.cores > 0) out.push({ type: tune.core, count: tune.cores });
  return out;
}
