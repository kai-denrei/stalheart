// FEWER SENTRIES, STRONGER ONES (src/content/sentries.js STORY_SENTRIES.cap): is the story's book of sentries full for a sentry at
// `ci`? Standing towers and pending tower orders both count, except an order already AT `ci`: placement is re-checked when Isao
// finishes an order, and counting the order against itself refused every sentry finished at the cap — it vanished as it stood and
// its biomass came back (owner, 2026-10-02: "some towers are ordered to be built, but when finished they disappear"). Pure.
export const sentryBookFull = ({ towers, orders, ci, cap }) => towers + orders.filter((o) => o.kind === 'tower' && o.ci !== ci).length >= cap;
// THE CAP GROWS WITH THE COLONY (the economy design 2.4, 2026-11-12): tune.cap, plus each tune.plus group's `add` once any of its `steps` stands (`done`:
// the programme's standing steps, a Set or an array), at most tune.max. Pure: the numbers are src/content/sentries.js STORY_SENTRIES
// THE COLONY ON THE GRID (2026-11-12 night): a cell's kind is the player's, so a group may name the PERKS that pay it (`perks`: the fabrication dome's
// and the assembly line's 'rebuild', the logistics dome's and the armory's 'armory') beside step ids; `done` may be the programme itself
// ({ done, perks }, src/domain/build-programme.js), whose perks a burned building takes with it
export function sentryCap(done, tune) {
  const steps = done?.done ?? done, perks = done?.perks ?? null;
  const has = (id) => (steps?.has ? steps.has(id) : Array.isArray(steps) && steps.includes(id));
  const hasPerk = (p) => !!perks?.has?.(p);
  let n = tune.cap;
  for (const g of tune.plus ?? []) if ((g.steps ?? []).some(has) || (g.perks ?? []).some(hasPerk)) n += g.add;
  return Math.min(tune.max ?? Infinity, n);
}
