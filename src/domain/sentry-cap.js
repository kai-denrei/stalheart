// FEWER SENTRIES, STRONGER ONES (src/content/sentries.js STORY_SENTRIES.cap): is the story's book of sentries full for a sentry at
// `ci`? Standing towers and pending tower orders both count, except an order already AT `ci`: placement is re-checked when Isao
// finishes an order, and counting the order against itself refused every sentry finished at the cap — it vanished as it stood and
// its biomass came back (owner, 2026-10-02: "some towers are ordered to be built, but when finished they disappear"). Pure.
export const sentryBookFull = ({ towers, orders, ci, cap }) => towers + orders.filter((o) => o.kind === 'tower' && o.ci !== ci).length >= cap;
// THE CAP GROWS WITH THE COLONY (the economy design 2.4, 2026-11-12): tune.cap, plus each tune.plus group's `add` once any of its `steps` stands (`done`:
// the programme's standing steps, a Set or an array), at most tune.max. Pure: the numbers are src/content/sentries.js STORY_SENTRIES
export function sentryCap(done, tune) {
  const has = (id) => (done?.has ? done.has(id) : Array.isArray(done) && done.includes(id));
  let n = tune.cap;
  for (const g of tune.plus ?? []) if (g.steps.some(has)) n += g.add;
  return Math.min(tune.max ?? Infinity, n);
}
