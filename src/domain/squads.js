// THE SQUADS' PACKING (src/content/sectors.js SQUADS): a wave's entries [{ type, count }] in, the same bodies out with the big soft
// share packed `size` to an entry ({ type, count, squad: size }). Only a wave of `over` soft bodies or more is packed; `single` of them
// stay single, shared across the soft types in proportion, and a remainder that does not fill a squad stays single too. Solid bodies
// (hard cores) are never packed. Pure.
export function packSquads(entries, spec, tune) {
  const soft = (e) => !!spec[e.type]?.rammable && !e.squad;
  const total = entries.reduce((n, e) => n + (soft(e) ? e.count : 0), 0);
  if (!tune || total < tune.over) return entries;
  const out = [];
  for (const e of entries) {
    if (!soft(e)) { out.push(e); continue; }
    const keep = Math.round(e.count * tune.single / total), packs = Math.floor((e.count - keep) / tune.size), single = e.count - packs * tune.size;
    if (single > 0) out.push({ ...e, count: single });
    if (packs > 0) out.push({ ...e, count: packs, squad: tune.size });
  }
  return out;
}

// the bodies an entry list stands for, squads counted by their members
export const bodiesOf = (entries) => entries.reduce((n, e) => n + e.count * (e.squad ?? 1), 0);
