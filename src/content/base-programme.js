// THE BASE ISAO PRINTS IN PLAY (V1 "Isao keeps building", 2026-09-16). A bare story page starts at stage 1 with the rest of the base
// planned but pending (src/domain/base-plan.js reach); these steps print it, in order, one at a time, and never ahead of an order the
// player or a beat has placed. Each step prints its islands first, then its structures; the gate step prints the gate, then its walls
// one after another. `when` is the earliest a step may start: `phase` a story beat reached (STORY_PHASES in src/domain/automation.js),
// `sector` a sector number reached (story.sectorN), `idle` only between waves. `seconds` is the print once Isao is over the plot,
// `metres` how high the print beam climbs, `brief` his line when he starts, `perk` what switches on when it stands.
import { BRIDGE_PLOT, COLONY_CELLS, COLONY_BRIDGES, COLONY_DEFAULT, COLONY_GANTRY, domeId, bridgeId } from './dome-city.js';
import { COLONY } from './colony.js';

export const BASE_PROGRAMME = Object.freeze([
  // ISAO WORKS THE RECYCLER FIRST (owner, 2026-09-16: "before building the gates, Isao should use his beam to work on the recycle
  // factory we first see"). `over` is a structure that already stands: nothing is printed, he flies to the AFR-01's own cell and holds
  // the beam on it at the machine's working height while its cutter cycle runs under him (src/content/foundry.js: arc at 2 s, scrap at
  // 10 s, a barrel at 15 s of every 24 s cycle). `plot` is the module's footprint in metres, half extents across and along its heading
  // — the 16 x 12 m deck of the authored model, so the raster lies on the machine and not on the dirt beside it. Eight seconds plus the
  // flight out and back is what this beat costs the gate behind it, and the tremor waits for the gate: the first wave pays for every
  // second spent here, which is why it is eight and not the twelve the job would like
  // the gate next, and the tremor waits for it: without a gate no fodder comes, and without fodder the tutorial never reaches the
  // handover. THE GATE PRINTS FROM THE DEPLOY (2026-11-08, THE SETTLING): the Rotor no longer gates it, for the Rotor is the first orders' and the
  // player may take it or leave it; until then the gate waited on `rotor-ready`, straight after the Rotor which stands beside it, so the wait
  // before the tremor was one print and no trip
  { id: 'gate', label: 'gate and walls', gate: true, walls: true, when: { phase: 'foundry' }, seconds: 4, metres: 6, brief: 'build_gate', perk: 'gate' },
  // SECTOR 0: THE STÅLHEART'S CONSTRUCTION IS DEFENDED (owner, 2026-09-24: "The Tank is built by the Stalheart ... the first few waves
  // before the stalheart is ready could be more intense POV sentries and Gunship shooting from above to protect the construction").
  // THE STÅLHEART IS NON-NEGOTIABLE (owner, 2026-11-08, THE SETTLING: "the player chooses what to build first with limited building material, the
  // Stålheart being non-negotiable"): straight after the gate, from the deploy; until then it waited on `rotor-ready` like the gate.
  // Straight after the gate, and one long print: while it runs the first wave, the Quiver's cores and the construction waves are
  // fought from the seats (src/domain/story-beats.js `construction`). The story beats put the Quiver on Isao's book the moment the
  // gate stands, so it is ahead of this step in his queue and stands before the long print takes him. `hull`: the first MÖRK rolls
  // out of it when it stands (src/fx/hull-issue.js), and until then a growing page has no hull. `readout` is the HUD's objective
  // while it prints (src/fx/build-readout.js)
  { id: 'stalheart', label: 'Stålheart', islands: ['stalheart'], structures: ['stalheart'], when: { phase: 'foundry' }, seconds: 75, metres: 24, brief: 'stalheart_begins', perk: 'stalheart', hull: true, readout: 'STÅLHEART' },
  // THE FIRST ORDERS (owner, 2026-11-08, THE SETTLING: "the player chooses what to build first with limited building material, the Stalheart being
  // non-negotiable"; spec docs/superpowers/specs/2026-11-08-the-settling-design.md 2.B): the pad, Isao's work on the recycler and the array are bought
  // once, on the build board at the landing (src/content/build-board.js first; src/fx/first-orders.js), out of the rocket's salvage, and print as
  // bought from the deploy (`when: foundry`), after the gate and the Stålheart in Isao's queue. Not bought is not built: no sector board carries them;
  // a skipped opening (jumpBought) and a chapter (src/fx/story-entry.js) buy them. `pays`: the recycler's work cuts one more barrel's worth (the host grants it when the step stands)
  { id: 'landing', label: 'landing pad', islands: ['landing'], board: true, first: true, when: { phase: 'foundry' }, seconds: 4, metres: 2, brief: 'build_landing', perk: null },
  // (2026-10-03) Isao's work on the recycler comes after the Stålheart's print, not before the gate: the gate and the tremor no longer
  // wait on it (owner: "faster intro, more intensity")
  { id: 'foundry', label: 'seed foundry', over: 'foundry', plot: [8, 6], board: true, first: true, pays: 600, when: { phase: 'foundry' }, seconds: 4, metres: 6, brief: 'build_foundry', perk: null },
  { id: 'solar', label: 'solar array', islands: ['solar'], structures: ['solar'], board: true, first: true, when: { phase: 'foundry' }, seconds: 14, metres: 8, brief: 'build_solar', perk: 'station' },
  { id: 'bays', label: 'tank bays', islands: ['bay'], structures: ['bays'], when: { sector: 1, idle: true }, seconds: 16, metres: 8, brief: 'build_bays', perk: 'hulls' },
  { id: 'hugin', label: 'HUGIN arm', islands: ['hugin'], structures: ['hugin'], when: { sector: 1, idle: true }, seconds: 16, metres: 16, brief: 'build_hugin', perk: 'gunship' },
  // THE DEPOT (owner, 2026-11-05, round 8 note 7): the Bio-Pearls the bank lives in, the rover's pad and the SAI-92's bay, printed straight after
  // HUGIN on a bare page; until it stands a kill pays the bank at once as it always did, from its perk on the bodies' biomass lies on the
  // ground for the rover (src/fx/rover-glue.js). On a skipped opening it stands from the start (stage 8)
  { id: 'depot', label: 'depot', islands: ['depot'], structures: ['pearl-a', 'pearl-b', 'pearl-c', 'sai92-bay', 'sai92'], when: { sector: 1, idle: true }, seconds: 14, metres: 6, brief: 'build_depot', perk: 'depot' },
  { id: 'radar', label: 'radar', islands: ['radar'], structures: ['radar'], when: { sector: 2 }, seconds: 12, metres: 18, brief: 'build_radar', perk: 'uplink', closeup: 'antenna' },   // closeup: the print on screen, its line said over the cut (ANTENNA_CLOSEUP below)
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
  // THE BUILD BOARD (owner, 2026-11-05, round 6 note 2): the six steps from here on are `board: true`: they left the automatic programme and are
  // printed only once the player buys them on the board between sectors (src/content/build-board.js prices, src/fx/build-board.js); their `when`
  // still says when Isao prints one after the purchase. A skipped opening (?skip=defence&sector=N) stands in for the boards before it and buys
  // those whose sector gate N has reached (src/domain/build-board.js jumpBought). The spine above stays automatic: the arc depends on it.
  { id: 'board', label: 'scoreboard', islands: ['board'], board: true, when: { sector: 1, idle: true }, seconds: 6, metres: 3, brief: 'build_board', perk: 'board' },
  // THE GARAGE (owner, 2026-10-03): the A6 paint bay, printed straight after the board; its perk puts the purple PIMP MY RIDE pad in it
  { id: 'garage', label: 'paint garage', islands: ['garage'], structures: ['garage'], board: true, when: { sector: 1, idle: true }, seconds: 10, metres: 6, brief: 'build_garage', perk: 'garage' },
  { id: 'armory', label: 'armory', islands: ['armory'], structures: ['armory', 'ammo-a', 'ammo-b', 'ammo-c'], board: true, when: { sector: 2, idle: true }, seconds: 16, metres: 8, brief: 'build_armory', perk: 'armory' },
  { id: 'farm', label: 'greenhouse', islands: ['farm'], structures: ['greenhouse', 'bio-a', 'bio-b', 'bio-c'], board: true, when: { sector: 3, idle: true }, seconds: 16, metres: 6, brief: 'build_farm', perk: 'farm' },
  { id: 'chips', label: 'chip plant', islands: ['chips'], structures: ['chips'], board: true, when: { sector: 4, idle: true }, seconds: 14, metres: 5, brief: 'build_chips', perk: 'chips' },
  { id: 'launcher', label: 'ARC-01 launcher', islands: ['launcher'], structures: ['launcher'], board: true, when: { sector: 4, idle: true, manned: 2 }, passable: true, seconds: 20, metres: 12, brief: 'build_launcher', perk: 'launcher' },
  // THE FOURTH PEARL (round 8 note 7), last so the board's four structure cards keep the colony's own ahead of it: +12,000 kg of storage on the depot, a board card from the board before sector 3 (the ledger's sector 3 is
  // where an ideal bank first passes the three pearls' 36,000 kg); standing, it adds its vessel to the bank's cap (src/fx/rover-glue.js reads the
  // step done, not a perk: the depot's perk opens the pearl's entry in the terminal, and the card's thumbnail is that entry's, `board: 'pearl'`)
  { id: 'pearl', label: 'Bio-Pearl', structures: ['pearl-d'], board: true, when: { sector: 3, idle: true }, seconds: 8, metres: 4, brief: 'build_pearl', perk: null },
  // THE COLONY ON THE GRID (2026-11-12 night; design docs/superpowers/specs/2026-11-12-colony-layout-design.md 3.5, 3.6): one step a cell of
  // src/content/dome-city.js COLONY_CELLS, its 20 x 20 island then its dome. A board step, so nothing prints unbought; bought between sectors from
  // the first board on (the player picks the kind and the cell, src/fx/build-board.js; `kind` is the default city's, what a static page stands
  // and what the step is bought as unless a kind is named, src/domain/build-programme.js buy). `gantry`: THE KIDOU DRIVES OUT AND PRINTS IT
  // (src/fx/gantry-drive.js) when the Stålheart is the KIDOU, and `when.home` holds the step until the gantry is home (src/domain/build-programme.js);
  // with the rail terraformer (?gantry=rail) Isao prints it as any step. `passable`: a dome waiting for the gantry holds nothing behind it.
  // `metres` the print climbs to the dome's top (Isao's share, the mast above the tool's reach); `seconds` the whole print. Perk: the kind's
  // (src/content/colony.js), switched on when it stands. Last on the programme, so nothing waits behind them
  // THE CORNER RULE (design 3.5): a cell the gantry drives through to reach others (W for NW and SW, E for NE and SE) waits until they stand
  // (`when.stand`): the board does not offer it before, and it never prints first, so the gantry never crosses a dome
  ...COLONY_CELLS.map((c) => { const kind = COLONY_DEFAULT[c.id], behind = COLONY_CELLS.filter((x) => x.via === c.id).map((x) => domeId(x.id));
    return { id: domeId(c.id), label: `dome ${c.id.toUpperCase()}`, cell: c.id, kind, islands: [domeId(c.id)], structures: [domeId(c.id)], board: true, gantry: true, when: { sector: 1, idle: true, home: true, ...(behind.length ? { stand: behind } : {}) }, passable: true, seconds: COLONY_GANTRY.seconds, metres: COLONY_GANTRY.top, brief: 'build_dome', perk: COLONY.kinds[kind].perk }; }),
  // THE BRIDGES FOLLOW THEIR DOMES (2026-11-07): not for sale; each prints by itself once both domes it joins stand (`when.stand`, answered by the
  // host's standing(id), src/platform/story-world.js stands) and the gantry is home (`when.home`: Isao's print beam never meets the KIDOU on a road).
  // No island under a bridge, so `frame` makes its plot the plan's own frame x, z and heading, and `plot` the deck's strip (src/fx/base-print.js).
  // `passable`: a bridge whose domes were never bought holds nothing up, not even the other bridges, and is not owed
  ...COLONY_BRIDGES.map((p) => ({ id: bridgeId(p), label: `bridge ${p.join('-').toUpperCase()}`, structures: [bridgeId(p)], frame: true, plot: BRIDGE_PLOT, when: { stand: p.map(domeId), home: true }, passable: true, seconds: 8, metres: 6, brief: 'build_bridge', perk: null })),
].map((s) => Object.freeze({ islands: [], structures: [], ...s })));

// THE RECON DOG'S OPENING (owner, 2026-11-10, his call 1: "the Stålheart prints AFTER the Rotor fight, not from the deploy"; spec
// docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md 2.C, 2.D): on the story's own start (the beats' `scout`) these steps lead Isao's
// programme in this order with these `when`s (src/domain/build-programme.js openingSteps): the gate once the dog is home (`walled`), the depot after the
// first wave's clear (`harvest`: the rover's first run, moved up from sector 1), the Stålheart once THE FIRST ORDERS have closed (the Quiver's beat follows the
// card at once: `quiver-piloting`; at `orders` it was claimed in the frame the card opened). THE DEPOT EARLIER (flow fixes, 2026-11-13, docs/FLOW.md 3: the
// first harvest stood 48 s, 24 of them on the depot's print after the clear): it prints at `rotor-ready`, in the wait for the Rotor's seat and the first wave, so the
// rover can leave as the wave is cleared. Chapters, SKIP TUTORIAL and the static stages keep BASE_PROGRAMME as it stands
export const OPENING_PROGRAMME = Object.freeze({
  order: Object.freeze(['gate', 'depot', 'stalheart']),
  when: Object.freeze({ gate: Object.freeze({ phase: 'walled' }), depot: Object.freeze({ phase: 'rotor-ready' }), stalheart: Object.freeze({ phase: 'quiver-piloting' }) }),
});

// ISAO'S CRUISE, in lattice cells per second. His flights between plots are the opening's other wait: at 2.6 the trip out to the
// AFR-01 and back to the gate plot cost more than the prints themselves. Nothing is skipped at 4.2 — he is simply not dawdling.
export const BASE_BUILDER = Object.freeze({ cellsPerSecond: 4.2 });

// THE ANTENNA, PRINTED ON SCREEN (owner, 2026-11-02, round 4 note 4: the Ridgebacks came too early after the K9's print; a skippable antenna build
// close-up, Isao says the reinforcements come in 8 days, the drop 8 days later). A step with `closeup` holds its line until Isao is over the plot
// (src/fx/programme-host.js), then src/fx/antenna-print.js cuts to the rising structure for the rest of the print and `tail` seconds after it, its
// line asked for the panel as the cut starts (src/fx/brief-queue.js want); never over a manned seat or another shot, and not when less than
// `latest` of the print is left to show (the line is still said). `angles` the four cuts in the plot's metres (x right of its heading, y up, z
// along it; each eye and look eased over [from, to] s from the cut's start, fov in degrees: src/domain/pet-print.js printCamera); `shot` the
// live cut's rule, the companions' print's (5 s mandatory, then Space skips, its hint; the near plane lowered while it runs).
export const ANTENNA_CLOSEUP = Object.freeze({
  step: 'radar', latest: 0.5, tail: 1.5,
  angles: Object.freeze([
    { from: 0, to: 3.5, eye: [[30, 9, 34], [25, 11, 29]], look: [[0, 5, 0], [0, 8, 0]], fov: 50 },   // wide, three-quarter front: the plot and Isao over it
    { from: 3.5, to: 7, eye: [[10, 2, 12], [12, 3.5, 8]], look: [[0, 3, 0], [0, 6, 0]], fov: 52 },   // low and close at the foot, the slice climbing
    { from: 7, to: 10.5, eye: [[-7, 1.4, 8], [-9, 1.8, 4]], look: [[0, 10, 0], [0, 14, 0]], fov: 60 },   // under it, looking up the mast to the beam
    { from: 10.5, to: 14, eye: [[-26, 18, -20], [-30, 13, -10]], look: [[0, 10, 0], [0, 11, 0]], fov: 48 },   // high rear three-quarter, round to its side as it stands
  ].map((a) => Object.freeze(a))),
  shot: Object.freeze({ id: 'antennaPrint', lock: 5, skipKey: ' ', hint: 'SPACE · SKIP', near: 0.00025, hintId: 'antenna-skip-hint' }),
});

// what the perks are worth where the game reads a number: the HUGIN arm fills the gunship call-in meter faster; the assembly line
// rebuilds this many lost hulls at each sector start
// the colony's perks (2026-10-01): farmKg biomass at each sector start while the farm stands; chipsPeriod scales the uplink's pass
// period while the chip plant stands; the armory's pad refills `shellsPerSecond` while the hull's centre is within radiusMetres of
// the island's centre (the solar array's pad is the model, src/content/shield-array.js)
export const BASE_PERKS = Object.freeze({ gunshipMeter: 1.5, rebuildHulls: 1, farmKg: 400, chipsPeriod: 0.8, armory: Object.freeze({ radiusMetres: 12, shellsPerSecond: 2, lift: 0.6, island: 'assembly', pad: [-18, 1] }),
  // PIMP MY RIDE (owner, 2026-10-03): the purple pad beside the bays (`pad` metres off the bay island's centre: east of it, off the
  // roll-out a fresh hull takes out of the doors, so a deploy never parks on it); the hull inside
  // `radiusMetres` and slower than `still` m/s for `settle` seconds opens the paint shop (src/fx/paint-pad.js)
  paint: Object.freeze({ radiusMetres: 8, lift: 0.6, island: 'garage', pad: [0, 0], settle: 0.8, still: 1.5, brief: 'paint_pad' }) });   // island/pad: the pad is `pad` metres off that island's centre (west of the assembly line)

// ISAO MENDS WHAT THE SWARM BROKE (owner, 2026-09-16: "Isao should go and build walls/a gate in between waves when a breach of the
// base happened"). The rule is src/domain/repair-orders.js; these are the numbers. `gateAt` is the share of the gate's hp below
// which the door is worth a trip (a broken gate always is), and each kind carries the print Isao stands over: the gate is the
// bigger job. `brief` is his line the first time he flies out to a repair.
export const BASE_REPAIR = Object.freeze({
  gateAt: 0.75, brief: 'isao_repair',
  // mid-wave a wall cell is mended when no body is within `clearCells` of it; after each wall he hovers `check` seconds and says whether
  // the breach is sealed (`sealed`) or which way he goes next (`open`) (owner, 2026-10-03: "a confirmation state")
  clearCells: 3, check: 1.6, sealed: 'BREACH SEALED', open: 'STILL OPEN · NEXT SEGMENT',
  // a hole the tank shot through the base's rock is his to mend when it lies within `shotMargin` cells beyond the farthest rim cell (2026-10-04)
  shotMargin: 2,
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
// (2026-10-03) a last-ditch effort: not before sector `minSector`, and only with a door below `gateShare` of its hp (or down)
export const ISAO_STRIKE = Object.freeze({ minSector: 6, gateShare: 0.5, alive: 300, view: 0.6, near: [1.5, 7], travel: 9, wobble: 0.35, carryCells: 2.2, fall: 1.4, blast: 'gunship.heavy', celebrate: 5,
  missile: 'assets/models/astro/ammo_missile_heavy_projectile_game.glb', missileMetres: 6.4, go: 'isao_strike_go', hit: 'isao_strike_hit' });
