// THE BASE ISAO PRINTS IN PLAY (V1 "Isao keeps building", 2026-09-16). A bare story page starts at stage 1 with the rest of the base
// planned but pending (src/domain/base-plan.js reach); these steps print it, in order, one at a time, and never ahead of an order the
// player or a beat has placed. Each step prints its islands first, then its structures; the gate step prints the gate, then its walls
// one after another. `when` is the earliest a step may start: `phase` a story beat reached (STORY_PHASES in src/domain/automation.js),
// `sector` a sector number reached (story.sectorN), `idle` only between waves. `seconds` is the print once Isao is over the plot,
// `metres` how high the print beam climbs, `brief` his line when he starts, `perk` what switches on when it stands.
export const BASE_PROGRAMME = Object.freeze([
  // ISAO WORKS THE RECYCLER FIRST (owner, 2026-09-16: "before building the gates, Isao should use his beam to work on the recycle
  // factory we first see"). `over` is a structure that already stands: nothing is printed, he flies to the AFR-01's own cell and holds
  // the beam on it at the machine's working height while its cutter cycle runs under him (src/content/foundry.js: arc at 2 s, scrap at
  // 10 s, a barrel at 15 s of every 24 s cycle). `plot` is the module's footprint in metres, half extents across and along its heading
  // — the 16 x 12 m deck of the authored model, so the raster lies on the machine and not on the dirt beside it. Eight seconds plus the
  // flight out and back is what this beat costs the gate behind it, and the tremor waits for the gate: the first wave pays for every
  // second spent here, which is why it is eight and not the twelve the job would like
  { id: 'foundry', label: 'seed foundry', over: 'foundry', plot: [8, 6], when: { phase: 'rotor-ready' }, seconds: 4, metres: 6, brief: 'build_foundry', perk: null },
  // the gate next, and the tremor waits for it: without a gate no fodder comes, and without fodder the tutorial never reaches the
  // handover. Printed straight after the Rotor, which stands beside it, so the wait before the tremor is one print and no trip
  { id: 'gate', label: 'gate and walls', gate: true, walls: true, when: { phase: 'rotor-ready' }, seconds: 6, metres: 6, brief: 'build_gate', perk: 'gate' },
  // SECTOR 0: THE STÅLHEART'S CONSTRUCTION IS DEFENDED (owner, 2026-09-24: "The Tank is built by the Stalheart ... the first few waves
  // before the stalheart is ready could be more intense POV sentries and Gunship shooting from above to protect the construction").
  // Straight after the gate, and one long print: while it runs the first wave, the Quiver's cores and the construction waves are
  // fought from the seats (src/domain/story-beats.js `construction`). The story beats put the Quiver on Isao's book the moment the
  // gate stands, so it is ahead of this step in his queue and stands before the long print takes him. `hull`: the first MÖRK rolls
  // out of it when it stands (src/fx/hull-issue.js), and until then a growing page has no hull. `readout` is the HUD's objective
  // while it prints (src/fx/build-readout.js)
  { id: 'stalheart', label: 'Stålheart', islands: ['stalheart'], structures: ['stalheart'], when: { phase: 'rotor-ready' }, seconds: 75, metres: 24, brief: 'stalheart_begins', perk: 'stalheart', hull: true, readout: 'STÅLHEART' },
  { id: 'landing', label: 'landing pad', islands: ['landing'], when: { phase: 'rotor-ready' }, seconds: 4, metres: 2, brief: 'build_landing', perk: null },
  { id: 'solar', label: 'solar array', islands: ['solar'], structures: ['solar'], when: { phase: 'expedition' }, seconds: 14, metres: 8, brief: 'build_solar', perk: 'station' },
  { id: 'bays', label: 'tank bays', islands: ['bay'], structures: ['bays'], when: { sector: 1, idle: true }, seconds: 16, metres: 8, brief: 'build_bays', perk: 'hulls' },
  { id: 'hugin', label: 'HUGIN arm', islands: ['hugin'], structures: ['hugin'], when: { sector: 1, idle: true }, seconds: 16, metres: 16, brief: 'build_hugin', perk: 'gunship' },
  { id: 'radar', label: 'radar', islands: ['radar'], structures: ['radar'], when: { sector: 2 }, seconds: 12, metres: 18, brief: 'build_radar', perk: 'uplink' },
  { id: 'assembly', label: 'assembly line', islands: ['assembly'], structures: ['assembly'], when: { sector: 2, idle: true }, seconds: 16, metres: 8, brief: 'build_assembly', perk: 'rebuild' },
  // THE BACK GATE (owner, 2026-09-18: "back gate is a reminder that focusing on defense on one side leaves one open; surprise it
  // opens! ... Then Isao installs a gate and we can put sentries"). It is NOT pre-built: sector 2 cracks the mouth behind the bays
  // open as the surprise, the player holds it with the tank, SOL-82 and the gunship, and only once that back breach is closed or
  // spent does this step queue. `gate: 'back'` names the door on src/domain/base-plan.js plan.gates; there are no walls flanking it,
  // so the print is the door's own footprint (`plot`, half extents across and along its heading) from the first frame to the last.
  // `when.back: 'held'` is that condition, read off the sector loop through the host's hooks. Its perk opens the back sockets:
  // plan.backSockets become mountable, so sentries can be ordered behind the bays from then on.
  // THE BACK GATE IS PASSABLE (2026-10-01): it stands before the colony's steps so it prints the moment the mouth is held, and is passed
  // over until then so the colony is printed in the sectors before the door instead of waiting behind a door that has not fallen
  // THE COLONY GROWS (owner, 2026-10-01: "a CHIP Manufacturing unit, a Greenhouse, and bio containers to make the base more fully
  // developed. We also need an armory/missile factory of sorts, and a spot for the tank to replenish its shells"; direction of
  // 2026-09-24: the self-sustaining colony). Four more steps between the assembly line and the back gate, each on its own island
  // (src/content/base-layout.js) with a perk the game reads a number from (BASE_PERKS):
  //   armory    the garage behind the bays, and the ammunition dump by the assembly line whose pad refills the hull's shells while the
  //             tank stands on it (src/fx/armory-pad.js; owner, 2026-10-02: the reload spot is by the robotic assembly)
  //   farm      the greenhouse and three bio containers: biomass paid at every sector start
  //   chips     the chip plant: the uplink's passes come closer together
  //   launcher  the ARC-01 mass driver, pointed out over the rim; it waits for the player's two manned SOL-82 passes (`when.manned`:
  //             Isao's calibration, src/domain/laser-auto.js) and is PASSABLE, so nothing waits behind a player who stays out of
  //             the seat. When it stands it launches SOL-88 (src/fx/arc-launch.js), and SOL fires on its own from then on
  { id: 'backgate', label: 'back gate', gate: 'back', plot: [11, 4], when: { sector: 2, idle: true, back: 'held' }, passable: true, seconds: 14, metres: 6, brief: 'build_back_gate', perk: 'backgate' },
  // THE SCOREBOARD (owner, 2026-10-02: "Isao printing a literal scoreboard in the base, like Gimli and Legolas joking about who has the
  // more kills"; and "A flag showing the Rank"): a slab Isao prints first thing after the handover; the host raises the plaque and the rank
  // flag on it (src/fx/scoreboard.js) and feeds it the run's books. The first thing the player owns in the base: their count and their rank
  { id: 'board', label: 'scoreboard', islands: ['board'], when: { sector: 1, idle: true }, seconds: 6, metres: 3, brief: 'build_board', perk: 'board' },
  { id: 'armory', label: 'armory', islands: ['armory'], structures: ['armory', 'ammo-a', 'ammo-b', 'ammo-c'], when: { sector: 2, idle: true }, seconds: 16, metres: 8, brief: 'build_armory', perk: 'armory' },
  { id: 'farm', label: 'greenhouse', islands: ['farm'], structures: ['greenhouse', 'bio-a', 'bio-b', 'bio-c'], when: { sector: 3, idle: true }, seconds: 16, metres: 6, brief: 'build_farm', perk: 'farm' },
  { id: 'chips', label: 'chip plant', islands: ['chips'], structures: ['chips'], when: { sector: 4, idle: true }, seconds: 14, metres: 5, brief: 'build_chips', perk: 'chips' },
  { id: 'launcher', label: 'ARC-01 launcher', islands: ['launcher'], structures: ['launcher'], when: { sector: 4, idle: true, manned: 2 }, passable: true, seconds: 20, metres: 12, brief: 'build_launcher', perk: 'launcher' },
].map((s) => Object.freeze({ islands: [], structures: [], ...s })));

// ISAO'S CRUISE, in lattice cells per second. His flights between plots are the opening's other wait: at 2.6 the trip out to the
// AFR-01 and back to the gate plot cost more than the prints themselves. Nothing is skipped at 4.2 — he is simply not dawdling.
export const BASE_BUILDER = Object.freeze({ cellsPerSecond: 4.2 });

// what the perks are worth where the game reads a number: the HUGIN arm fills the gunship call-in meter faster; the assembly line
// rebuilds this many lost hulls at each sector start
// the colony's perks (2026-10-01): farmKg biomass at each sector start while the farm stands; chipsPeriod scales the uplink's pass
// period while the chip plant stands; the armory's pad refills `shellsPerSecond` while the hull's centre is within radiusMetres of
// the island's centre (the solar array's pad is the model, src/content/shield-array.js)
export const BASE_PERKS = Object.freeze({ gunshipMeter: 1.5, rebuildHulls: 1, farmKg: 40, chipsPeriod: 0.8, armory: Object.freeze({ radiusMetres: 12, shellsPerSecond: 2, lift: 0.6, island: 'assembly', pad: [-18, 1] }),
  // PIMP MY RIDE (owner, 2026-10-03): the purple pad beside the bays (`pad` metres off the bay island's centre: east of it, off the
  // roll-out a fresh hull takes out of the doors, so a deploy never parks on it); the hull inside
  // `radiusMetres` and slower than `still` m/s for `settle` seconds opens the paint shop (src/fx/paint-pad.js)
  paint: Object.freeze({ radiusMetres: 8, lift: 0.6, island: 'bay', pad: [27, 0], settle: 0.8, still: 1.5, brief: 'paint_pad' }) });   // island/pad: the pad is `pad` metres off that island's centre (west of the assembly line)

// ISAO MENDS WHAT THE SWARM BROKE (owner, 2026-09-16: "Isao should go and build walls/a gate in between waves when a breach of the
// base happened"). The rule is src/domain/repair-orders.js; these are the numbers. `gateAt` is the share of the gate's hp below
// which the door is worth a trip (a broken gate always is), and each kind carries the print Isao stands over: the gate is the
// bigger job. `brief` is his line the first time he flies out to a repair.
export const BASE_REPAIR = Object.freeze({
  gateAt: 0.75, brief: 'isao_repair',
  // mid-wave a wall cell is mended when no body is within `clearCells` of it; after each wall he hovers `check` seconds and says whether
  // the breach is sealed (`sealed`) or which way he goes next (`open`) (owner, 2026-10-03: "a confirmation state")
  clearCells: 3, check: 1.6, sealed: 'BREACH SEALED', open: 'STILL OPEN · NEXT SEGMENT',
// `plot` is the half extents in metres, across and along the piece's heading, that his print beam rasters over while he mends it
// (src/fx/base-print.js repairBed): the door's own footprint and one wall segment's, so the beam works the thing and not the dirt.
  gate: Object.freeze({ seconds: 8, metres: 6, label: 'GATE', plot: [7, 3] }),
  wall: Object.freeze({ seconds: 5, metres: 4, label: 'WALL', plot: [4, 3] }),
});

// ISAO'S MISSILE (owner, 2026-10-02: "Isao drop ONE missile somewhere with high effort and his score triumphantly moving from zero to 1
// to a huge celebration ... it can happen during a strong wave, let's just have Isao come to help MÖRK when it is clearly in view").
// Once a run: when at least `alive` bodies are up, the hull is out and on screen (inside `view` of the frame's centre, NDC) with nobody
// in a seat, and Isao is free, he takes one missile off the dump and flies it over the swarm `near` cells round the hull, slowly
// (`travel` seconds, wobbling `wobble` cells, coming down to `carryCells` over the ground so the chase camera sees him), lets go, the round falls for `fall` seconds and lands as `blast`, and it kills exactly one
// body: his first. The board celebrates for `celebrate` seconds. `missile` is the pinned round (docs/colony-assets.lock.json).
export const ISAO_STRIKE = Object.freeze({ alive: 120, view: 0.6, near: [1.5, 7], travel: 9, wobble: 0.35, carryCells: 2.2, fall: 1.4, blast: 'gunship.heavy', celebrate: 5,
  missile: 'assets/models/astro/ammo_missile_heavy_projectile_game.glb', missileMetres: 6.4, go: 'isao_strike_go', hit: 'isao_strike_hit' });
