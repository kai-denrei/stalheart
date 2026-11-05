// THE ROVER AND THE BIO-PEARLS (owner, 2026-11-05, round 8 note 7: "a new mechanic: the tank drops temporary flares like Isao, which dispatches
// the Yushi Rover to come collect the biomass (it is not automatic anymore), and it brings the biomass back to the Yushi045 biopearl, these are
// where the biomass is stored; the yushi rover is also a buildable unit, but not used for now"; and, for the round: "tweak the existing game to
// fit the new models, for pacing and cost of units too"). The numbers and the words; the rules are src/domain/biomass-field.js (the piles),
// src/domain/rover-run.js (the trip), src/domain/bio-pearls.js (the bank), the scene src/fx/rover.js, src/fx/bio-pearls.js,
// src/fx/biomass-piles.js, src/fx/hull-flare.js, the wiring src/fx/rover-glue.js. Models pinned in docs/a6-settlement-assets.lock.json.
//
// THE SIZING (design, 2026-11-06, docs/superpowers/specs/2026-11-06-round-8-seven-notes-design.md "Pacing and cost"): the --ledger probe of round 6
// on the base (every body killed and paid as the tank's kill) earned 11.4k, 25.3k, 70.0k, 61.3k, 77.6k kg in sectors 1-5; the reference player
// (the towers', the gunship's and SOL's kills pay half) is half of that. Income is no longer instant: the player flags the field and the rover's
// trips are the income's clock. A trip of 2,000 kg is ~13 s of harvest and ~7 s of unload plus the drive (9 m/s: a truck, slower
// than the hull at its run-up, src/content/tank.js TANK_DRIVE), so a reference sector 1 (~5.7k kg) comes home in three trips with the sector still on.
// The pearls' 36,000 kg sit above a reference sector 5's income and below the ledger's ideal: a player who banks everything and spends nothing
// meets STORAGE FULL by sector 4 and buys the fourth pearl or spends. The board's prices are unchanged this round (round 6 re-based them).
//   ROVER.capacity     kg aboard a trip (the author's demo: 100 units; balance is game-owned, assets/models/yushi-rover/runtime.js SPEC)
//   ROVER.harvestRate  kg/s off a pile under the intake; unloadRate kg/s into the pearls
//   ROVER.speed        m/s along its road; turn the on-the-spot turn's rate (rad/s), the author's mission.js 0.8
//   ROVER.reach        cells (10 m) round the flare whose piles it takes
//   ROVER.price        the catalog's price of a second rover: no board card this round ("buildable, but not used for now")
//   FIELD.decaySeconds a pile untouched this long rots (a sector's kills must be flagged within four minutes); maxPiles the instanced mesh's cap
//   PEARLS             the three vessels standing with the depot, each `capacity` kg; the fourth is the build board's card (src/content/build-board.js)
export const ROVER = Object.freeze({
  capacity: 2000, harvestRate: 150, unloadRate: 300, speed: 9, turn: 0.8, reach: 3, price: 3600,
  model: 'assets/models/yushi-rover/yushirover_d0_lod1.glb', far: 'assets/models/yushi-rover/yushirover_d0_lod2.glb',
  // where it stands on the depot island (metres off the island's centre, the island's frame): its pad on the west half, facing the mouth (-Z);
  // the dock beside a pearl is the author's (mission.js: the rover's root 8 m -X and 3.9175 m -Z of the vessel's, facing pi), so its
  // SOCKET_OFFLOAD (-2.14, 1.93, -3.92) faces the vessel's SOCKET_FILL (-1.41, 1.9, 0) across a short hose
  island: 'depot', pad: Object.freeze([-12, 0]), padHeading: Object.freeze([0, -1]), dock: Object.freeze([-8, -3.9175]), dockHeading: Object.freeze([0, -1]),
  // the scene: the hose drawn while it unloads (the author's viewer supplies a flexible hose; ours is one olive tube), the slurry's colour
  hose: Object.freeze({ colour: 0x71863c, radius: 0.12 }),
});
export const FIELD = Object.freeze({ decaySeconds: 240, maxPiles: 400 });
export const PEARLS = Object.freeze({ count: 3, capacity: 12000, ids: Object.freeze(['pearl-a', 'pearl-b', 'pearl-c', 'pearl-d']) });
// THE PILES (src/fx/biomass-piles.js): an olive blob (the author's slurry colour, yushi045 runtime.js yushiOlive) on the ground where the body fell,
// its radius `metres` x the cube root of its kg (a 100 kg pile 1.5 m across, 2,000 kg 4 m), at most `maxMetres`, squashed to `flat` of its width
export const PILE_LOOK = Object.freeze({ colour: 0x71863c, metres: 0.32, maxMetres: 4.5, flat: 0.45 });
// THE FLARE (the cave's look, below/src/flares.js, at the game's scale: a light, a halo, a core standing on the ground), amber like the cargo
// pad (not the cave's red, not Isao's green); `seconds` it burns, at most `max` standing (a fourth replaces the oldest), each with the site
// ring (src/fx/site-ring.js) at the rover's reach
export const FLARE = Object.freeze({
  seconds: 90, max: 3, colour: 0xffb43c, light: 2.4, lightMetres: 40, coreMetres: 0.5, haloMetres: 6, stickMetres: 1.6, pulse: 3.2,
});
// THE WORDS: the hull console's line, the HUD's field number, Isao's first hint (src/isaobriefs.js rover_flare), the toasts
export const ROVER_WORDS = Object.freeze({
  rover: 'ROVER', field: 'FIELD', full: 'STORAGE FULL', flare: 'FLARE', dispatched: 'ROVER DISPATCHED', queued: 'ROVER · NEXT FLARE QUEUED',
  noDepot: 'NO ROVER YET', hintKg: 300, hint: 'rover_flare', fullBrief: 'storage_full',
});
