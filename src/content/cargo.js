// THE CARGO LOOK (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 3): the flag over a cleared landing site, the
// part's crate on the MÖRK's back deck and the trophy flags at home. Presentation numbers only; the rules stay in
// src/domain/expeditions.js. Sizes are metres, times seconds. Pinned sources: docs/cargo-assets.lock.json.
export const CARGO_ASSETS = Object.freeze({
  flag: 'assets/models/cargo/flag_void.glb',
  crate: 'assets/models/cargo/cargo_crate_d0.glb',
});

// the Void banner in our own vocabulary: white cloth, a cyan emblem and cyan socket lights (material names are the asset's)
export const CARGO_TINTS = Object.freeze({
  'Void woven color': Object.freeze({ color: 0xe6eff2 }),
  'Ivory vector insignia': Object.freeze({ color: 0x7fdfff, emissive: 0x2a8fb0 }),
  'Status / mint': Object.freeze({ color: 0x7fdfff, emissive: 0x7fdfff }),
});

// the crate keeps its blue, but its amber label becomes our cyan with a faint glow: a dark crate vanished on the night side
export const CARGO_CRATE_TINTS = Object.freeze({
  'Cargo label': Object.freeze({ color: 0x7fdfff, emissive: 0x1f6f8a }),
});

export const CARGO_LOOK = Object.freeze({
  crateSpan: 2.6,          // the crate's long side, metres (the asset is 1.86 m; the hull is 10 m)
  crateSource: 1.86,       // the asset's own long side, metres
  flagScale: 2.2,          // the site flag: the 3.3 m pole at 7 m, readable from the tank camera across a landing site
  trophyScale: 1.1,        // the home flags: smaller, in a row
  siteOffset: 12,          // metres from the site centre toward home: clear of the lander's legs
  crateBeside: 5,          // metres from the site flag to its waiting crate
  trophyEdge: 9.5,         // metres from the landing island's centre to its trophy row (the island is 16 m)
  trophyGap: 2.6,          // metres between trophy flags
  deckInset: 0.22,         // where the crate rides along the hull, as a fraction of its length in from the rear
  lift: 0.5,               // the swing onto the deck
  liftArc: 4,              // metres the swing rises above the straight line
  sway: Object.freeze({ k: 38, damp: 5.5, gain: 0.018, max: 0.3 }),   // a damped spring on pitch and roll, driven by the hull's acceleration
  slide: 0.35,             // seconds to slide off the back deck
  gravity: 30,             // metres per second squared: a little heavier than true so the fall reads at game scale
  bounce: 0.34,            // restitution of each of the two bounces
  bounces: 2,
  linger: 4,               // seconds a dropped crate sits before it sinks
  sink: 1.6,               // seconds to sink and fade
  tumble: 1.2,             // seconds a thrown crate spins before it fades
  maxDropped: 3,           // the landing never holds more than this many old crates
  raise: 2, lower: 2,      // the asset's Raise and Lower clips are two seconds
  // ISAO RECEIVES THE PART: a dropped crate waits on the ground for him (up to holdMax seconds, then it sinks on its own) while
  // he flies over and holds his beam on it for `seconds` at `metres` above it, the beam wandering `spread` metres across the
  // crate; the unlock is called when he is done. His order yields to any tower order, so it never delays a print
  receive: Object.freeze({ seconds: 3, metres: 2.5, spread: 1.4, holdMax: 25, label: 'PART' }),
});

// the cues: each falls back to a cue every world has when the story's own is missing
export const CARGO_CUES = Object.freeze({
  hoist: 'gate_hydraulics', clunk: 'gate_slam', pickup: 'tank_pickup', thud: 'gate_slam', unlock: 'tower_upgrade', fallback: 'tank_pickup',
});
