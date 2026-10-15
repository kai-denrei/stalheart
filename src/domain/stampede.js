// THE STAMPEDE (owner, 2026-10-02: "we lost one fun activity; insane ramming bonuses… to have it work we need more waves of rammable
// enemies, larger waves of weak enemies. Sometimes they can have a few hard-cores in them, forcing use of the shield"). Every
// `every`-th wave a breach sends (its 2nd, 4th, ... at every: 2) is a stampede. Pure: the sector loop (src/fx/sector-run.js waveOf) hands
// in the wave's entries and the content (src/content/sectors.js SECTOR_STAMPEDE).
export const isStampede = (index, tune) => !!tune && tune.every > 0 && index % tune.every === tune.every - 1;

// (2026-10-03, owner: "more waves of soft-body only… spaced just right that it takes some effort (keeping some alive until the last
// moment) to time continuing bonuses") the stampedes alternate: the first of each pair is a TRICKLE (the wave's bodies one every
// `trickleGap` seconds so a steady rammer can keep the combo alive), the second a FLOOD (`cores` hard cores of `core` riding in it).
// THE SIZE IS THE SECTOR'S (2026-10-15, sector shapes, src/domain/sector-shape.js): the entries come in already sized off the sector's
// row, so neither kind multiplies them any more. Returns { entries, gap, kind } (gap: the queue's spacing, or null)
export function stampedeWave(entries, spec, tune, { index = 1 } = {}) {
  const trickle = Math.floor(index / tune.every) % 2 === 0;
  if (trickle) return { entries: entries.map((e) => ({ ...e })), gap: tune.trickleGap, kind: 'trickle' };
  return { entries: [...entries.map((e) => ({ ...e })), ...(tune.cores > 0 ? [{ type: tune.core, count: tune.cores }] : [])], gap: null, kind: 'flood' };
}
