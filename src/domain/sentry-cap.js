// FEWER SENTRIES, STRONGER ONES (src/content/sentries.js STORY_SENTRIES.cap): is the story's book of sentries full for a sentry at
// `ci`? Standing towers and pending tower orders both count, except an order already AT `ci`: placement is re-checked when Isao
// finishes an order, and counting the order against itself refused every sentry finished at the cap — it vanished as it stood and
// its biomass came back (owner, 2026-10-02: "some towers are ordered to be built, but when finished they disappear"). Pure.
export const sentryBookFull = ({ towers, orders, ci, cap }) => towers + orders.filter((o) => o.kind === 'tower' && o.ci !== ci).length >= cap;
