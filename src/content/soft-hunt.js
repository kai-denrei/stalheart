// THE SOFT HUNT (owner, 2026-10-18, round three, note 2: "the weaker units (white and yellows) need to be faster and more aggressive towards a)
// priority 1 the Tank, they flank and surround and try to attack it although they cannot, or b) the gates, whichever is closer"). Pure data; the
// rule is src/domain/soft-hunt.js, the walk src/fx/soft-hunt.js through src/fx/enemy-step.js. It replaces PEARL_HUNT (2026-10-16: within 10 cells
// of the tank and nearer it than the gate, by the crow's flight; the owner then: "they rush to kill whichever enemy is closest; tank if tank, gate if
// gate"), which had them walk at the tank's cell and nothing more.
// `tiers` the Pearl tiers that hunt (the soft ones the hull runs over). `every` s between a body's decisions (staggered by its id, so a wave does
// not decide on one frame). `bias` cells: the hull is the goal while its WALKING distance is at most the gate's plus this (priority 1 the Tank).
// `pace` x the tier's walk while the goal is the hull (only then: the gate walk is the walk as it was). The ring: `ring` cells round the hull's
// centre, `slots` bearings a group spreads over (a body's id mod slots: a wave surrounds, not queues), `orbit` rad/s the slow circling once there,
// `enter` the hull's walking distance (cells) at which a body leaves the lane for its spot on the ring and `leave` the one at which it goes back to
// the lane (the hull drove off), `search` bearings tried either side of its own (half a slot apart) when its spot is in the rock, `minRing` the
// share of the ring it may come in to before that, `settle` s over which the lane takes it back without a snap. The attack: `jab` every
// `jab.every` s (each body its own phase) a lunge to `jab.depth` cells from the hull's centre and back over `jab.seconds`, its deepest point a
// `tap` on the hull (a light jolt, x the tier's run-over jolt). The depth stops short of the ram: the record's touch is 0.4 cells and the hull's
// box (a few metres) plus PEARL_IMPACT's 0.9 m pad; a jab that touched would be a free ram, and they "try to attack it although they cannot".
// `layers` rings deep and `layer` cells between them: each later round of ids (a crowd past `slots`) a ring further out, so a swarm stands in rings.
// `atRing` cells: a body this near its spot counts as on the ring (the jab and the harness's atHull).
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };
export const SOFT_HUNT = freeze({
  tiers: ['white', 'yellow'], every: 0.5, bias: 2,
  pace: { white: 1.35, yellow: 1.25 },
  ring: 1.2, slots: 8, layers: 3, layer: 0.35, orbit: 0.25, enter: 2, leave: 4, search: 6, minRing: 0.8, settle: 0.5, atRing: 0.25,
  jab: { every: 3.6, seconds: 1.6, depth: 0.85 },
  tap: 0.5,
});
