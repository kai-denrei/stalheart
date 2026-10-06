// THE SQUADS' PACKING (src/content/sectors.js SQUADS): a wave's entries [{ type, count }] in, the same bodies out with the big soft
// share packed `size` to an entry ({ type, count, squad: size }). Only a wave of `over` soft bodies or more is packed; the greater of
// `single` and `share` of the wave stay single, shared across the soft types in proportion, and a remainder that does not fill a squad
// stays single too. Solid bodies (hard cores) are never packed. Pure.
// MIXED, NOT SORTED (owner, 2026-10-06: "mix regular single bodies with the 5x ones"): a type's singles and squads come out in `runs`
// alternating runs, single bodies first, so the squads walk among bodies of their own kind instead of after them all
export function packSquads(entries, spec, tune) {
  const soft = (e) => !!spec[e.type]?.rammable && !e.squad;
  const total = entries.reduce((n, e) => n + (soft(e) ? e.count : 0), 0);
  if (!tune || total < tune.over) return entries;
  const singles = Math.max(tune.single, Math.round(total * (tune.share ?? 0))), runs = Math.max(1, tune.runs ?? 1), out = [];
  const part = (n, r) => Math.round(n * (r + 1) / runs) - Math.round(n * r / runs);
  for (const e of entries) {
    if (!soft(e)) { out.push(e); continue; }
    const keep = Math.round(e.count * singles / total), packs = Math.floor((e.count - keep) / tune.size), single = e.count - packs * tune.size;
    for (let r = 0; r < runs; r++) {
      const s = part(single, r), p = part(packs, r);
      if (s > 0) out.push({ ...e, count: s });
      if (p > 0) out.push({ ...e, count: p, squad: tune.size });
    }
  }
  return out;
}

// the bodies an entry list stands for, squads counted by their members
export const bodiesOf = (entries) => entries.reduce((n, e) => n + e.count * (e.squad ?? 1), 0);
