// THE ROVER AND THE BIO-PEARLS (owner, 2026-11-05, round 8 note 7: "a new mechanic: the tank drops temporary flares like Isao, which dispatches
// the Yushi Rover to come collect the biomass (it is not automatic anymore), and it brings the biomass back to the Yushi045 biopearl, these are
// where the biomass is stored; the yushi rover is also a buildable unit, but not used for now"; and, for the round: "tweak the existing game to
// fit the new models, for pacing and cost of units too"). The numbers and the words; the rules are src/domain/biomass-field.js (the piles),
// src/domain/rover-run.js (the trip), src/domain/bio-pearls.js (the bank), the scene src/fx/rover.js, src/fx/bio-pearls.js,
// src/fx/biomass-piles.js, src/fx/hull-flare.js, the wiring src/fx/rover-glue.js. Models pinned in docs/a6-settlement-assets.lock.json.
//
// THE SIZING, MEASURED (2026-11-06). The design (docs/superpowers/specs/2026-11-06-round-8-seven-notes-design.md "Pacing and cost") sized the
// rover from the round-6 ledger: 2,000 kg a trip at 9 m/s, 150 kg/s at the rake, 300 kg/s into the pearls, so that "a sector's reference income
// lands within the sector". Measured, it does not: the bodies fall at the breach down the lane and the rover's road there from the depot is
// 455-500 m of cells (--rover: 52.8 s out, 13.4 s harvest, 54.8 s back, 6.7 s unload for 2,000 kg, 2026-11-06), and the --ledger probe
// (the ideal defender, the reference flagger: a flare on the richest ground whenever the rover stands idle) banked 700 kg at sector 1's debrief
// (11,996 on the base d67d5fb7) and 3,454 at sector 2's (36,380), nothing rotted: the round-6 bar (about 6.3k kg in hand at the board before
// sector 2) failed on the trip's clock, not on the rot, so lowering the rot's pressure (the design's first lever) could not help. THE TRIP IS
// THREE TIMES THE TRUCK: 6,000 kg a trip at 16 m/s, 400 kg/s at the rake, 1,000 kg/s into the pearls (~95 s a trip on that road, ~63 kg/s,
// the reference player's sector 1-2 income); the prices are unchanged. The owner turns these four numbers down to make the harvest bite more.
// The pearls' 36,000 kg sit above a reference sector 5's income and below the ledger's ideal: a player who banks everything and spends nothing
// meets STORAGE FULL by sector 3 or 4 and buys the fourth pearl or spends.
//   ROVER.capacity     kg aboard a trip (the author's demo: 100 units; balance is game-owned, assets/models/yushi-rover/runtime.js SPEC)
//   ROVER.harvestRate  kg/s off a pile under the intake; unloadRate kg/s into the pearls
//   ROVER.speed        m/s along its road; turn the on-the-spot turn's rate (rad/s), the author's mission.js 0.8
//   ROVER.reach        cells (10 m) round the flare whose piles it takes
//   ROVER.retreat      TOO MANY ENEMIES (owner, 2026-11-10): `bodies` live within `cells` (10 m) of the rover send it home with what it has; it goes
//                      back out to a standing flare once that flare's ground is down to `clear` bodies (src/domain/rover-run.js)
//   ROVER.gauge        THE FILL GAUGE over the rover (owner, 2026-11-10: "we need gauges for how full it is"; src/fx/rover.js): a bar `metres` wide
//                      and `tall` high, `up` metres over the ground, the slurry's colour on a dark track, amber from `warn` of the hold, shown
//                      whenever it is away from its pad or carries anything
//   ROVER.price        the catalog's price of a second rover: no board card this round ("buildable, but not used for now")
//   FIELD.seep         SEEPAGE (owner, 2026-11-12; the economy design 2.6): a pile loses max(floor, kg x share) kg a second (src/domain/biomass-field.js);
//                      it replaced the 240 s rot. maxPiles the instanced mesh's cap
//   ROVER.breakShare   the share of the flagged piles the sector's end banks (the economy design 2.6: half; the rest stays on the ground)
//   ROVER.recheck      s between looks at the road ahead (a wall, a building or a sinkhole across it sends it round; src/domain/rover-run.js)
//   ROVER.road         THE TANK'S GROUND (owner, 2026-11-12: "yushi-rover must have the same collision logic as the tank; walls, rocks, etc."):
//                      the cells it routes over are the tank's (src/domain/drive-ground.js), a building `pad` m out from a cell's centre;
//                      the drawn road (src/domain/rover-road.js) keeps `half` m either side of its line clear (the wheels stand ~2.4 m out),
//                      rounds its corners at up to `radius` m, tested every `step` m; it holds `ahead` m short of a door still opening
//   PEARLS             the three vessels standing with the depot, each `capacity` kg; the fourth is the build board's card (src/content/build-board.js)
export const ROVER = Object.freeze({
  capacity: 6000, harvestRate: 400, unloadRate: 1000, speed: 16, turn: 0.8, reach: 3, price: 3600, breakShare: 0.5, recheck: 1,
  road: Object.freeze({ pad: 2, half: 2.5, radius: 8, step: 2, ahead: 6 }),
  retreat: Object.freeze({ bodies: 6, cells: 4, clear: 2 }),
  // THE ROVER HUNTED (the economy design 2.6, 2026-11-12): beyond the walls the whites and yellows hunt it (src/domain/soft-hunt.js huntGoal) and each
  // jab's peak eats `bite` kg of its hold (lost; it has no hit points); the callout at most every `every` s, Isao's rover_bitten the first time
  threat: Object.freeze({ bite: 100, every: 15 }),
  gauge: Object.freeze({ metres: 7, tall: 0.9, up: 7.5, colour: '#9fc24a', warn: 0.9, warnColour: '#ffb43c', track: 'rgba(8,12,10,0.72)', edge: '#cfe6a0' }),
  model: 'assets/models/yushi-rover/yushirover_d0_lod1.glb', far: 'assets/models/yushi-rover/yushirover_d0_lod2.glb',
  // where it stands on the depot island (metres off the island's centre, the island's frame): its pad on the west half, facing the mouth (-Z);
  // the dock beside a pearl is the author's (mission.js: the rover's root 8 m -X and 3.9175 m -Z of the vessel's, facing pi), so its
  // SOCKET_OFFLOAD (-2.14, 1.93, -3.92) faces the vessel's SOCKET_FILL (-1.41, 1.9, 0) across a short hose
  island: 'depot', pad: Object.freeze([-12, 0]), padHeading: Object.freeze([0, -1]), dock: Object.freeze([-8, -3.9175]), dockHeading: Object.freeze([0, -1]),
  // the scene: the hose drawn while it unloads (the author's viewer supplies a flexible hose; ours is one olive tube), the slurry's colour
  hose: Object.freeze({ colour: 0x71863c, radius: 0.12 }),
});
export const FIELD = Object.freeze({ seep: Object.freeze({ floor: 0.5, share: 1 / 400 }), maxPiles: 400 });
export const PEARLS = Object.freeze({ count: 3, capacity: 12000, ids: Object.freeze(['pearl-a', 'pearl-b', 'pearl-c', 'pearl-d']) });
// THE PILES (src/fx/biomass-piles.js): an olive blob (the author's slurry colour, yushi045 runtime.js yushiOlive) on the ground where the body fell,
// its radius `metres` x the cube root of its kg (a 100 kg pile 1.5 m across, 2,000 kg 4 m), at most `maxMetres`, squashed to `flat` of its width
export const PILE_LOOK = Object.freeze({ colour: 0x71863c, metres: 0.32, maxMetres: 4.5, flat: 0.45 });
// THE FLARE (the cave's look, below/src/flares.js, at the game's scale: a light, a halo, a core standing on the ground), amber like the cargo
// pad (not the cave's red, not Isao's green); `seconds` it burns, at most `max` standing (a fourth replaces the oldest), each with the site
// ring (src/fx/site-ring.js) at the rover's reach.
// THE FLARES RUN OUT (owner, 2026-11-10: "flares must run out"): the hull carries `stock`; F with none left drops nothing; the stock is whole again
// when the hull stands on a repair spot (the Stålheart's gantry or the garage, src/content/tank.js HULL_REPAIR.spots)
export const FLARE = Object.freeze({
  seconds: 90, max: 3, stock: 4, colour: 0xffb43c, light: 2.4, lightMetres: 40, coreMetres: 0.5, haloMetres: 6, stickMetres: 1.6, pulse: 3.2,
});
// THE WORDS: the hull console's line, the HUD's field number, Isao's first hint (src/isaobriefs.js rover_flare), the toasts
export const ROVER_WORDS = Object.freeze({
  rover: 'ROVER', field: 'FIELD', full: 'STORAGE FULL', flare: 'FLARE', dispatched: 'ROVER DISPATCHED', queued: 'ROVER · NEXT FLARE QUEUED',
  noDepot: 'NO ROVER YET', flares: 'FLARES', noFlares: 'NO FLARES · RESTOCK AT BASE', restocked: 'FLARES RESTOCKED', hintKg: 300, hint: 'rover_flare', fullBrief: 'storage_full', breakBrief: 'rover_break',
  attacked: 'ROVER UNDER ATTACK', bitten: 'rover_bitten',
});
