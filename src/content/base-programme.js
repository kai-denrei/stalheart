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
  { id: 'gate', label: 'gate and walls', gate: true, walls: true, when: { phase: 'rotor-ready' }, seconds: 8, metres: 6, brief: 'build_gate', perk: 'gate' },
  { id: 'landing', label: 'landing pad', islands: ['landing'], when: { phase: 'rotor-ready' }, seconds: 4, metres: 2, brief: 'build_landing', perk: null },
  // while the swarm rises and walks up to the gate (Isao is idle there for about 25 s, QA 2026-09-16), so it stands before the Quiver
  // goes on the book and long before the towers turn automatic at `settled` (about 23 s after `cleared` at stage 4)
  { id: 'stalheart', label: 'Stålheart', islands: ['stalheart'], structures: ['stalheart'], when: { phase: 'breach' }, seconds: 18, metres: 24, brief: 'build_stalheart', perk: 'stalheart' },
  { id: 'solar', label: 'solar array', islands: ['solar'], structures: ['solar'], when: { phase: 'expedition' }, seconds: 14, metres: 8, brief: 'build_solar', perk: 'station' },
  { id: 'bays', label: 'tank bays', islands: ['bay'], structures: ['bays'], when: { sector: 1, idle: true }, seconds: 16, metres: 8, brief: 'build_bays', perk: 'hulls' },
  { id: 'hugin', label: 'HUGIN arm', islands: ['hugin'], structures: ['hugin'], when: { sector: 1, idle: true }, seconds: 16, metres: 16, brief: 'build_hugin', perk: 'gunship' },
  { id: 'radar', label: 'radar', islands: ['radar'], structures: ['radar'], when: { sector: 2 }, seconds: 12, metres: 18, brief: 'build_radar', perk: 'uplink' },
  { id: 'assembly', label: 'assembly line', islands: ['assembly'], structures: ['assembly'], when: { sector: 2, idle: true }, seconds: 16, metres: 8, brief: 'build_assembly', perk: 'rebuild' },
].map((s) => Object.freeze({ islands: [], structures: [], ...s })));

// ISAO'S CRUISE, in lattice cells per second. His flights between plots are the opening's other wait: at 2.6 the trip out to the
// AFR-01 and back to the gate plot cost more than the prints themselves. Nothing is skipped at 4.2 — he is simply not dawdling.
export const BASE_BUILDER = Object.freeze({ cellsPerSecond: 4.2 });

// what the perks are worth where the game reads a number: the HUGIN arm fills the gunship call-in meter faster; the assembly line
// rebuilds this many lost hulls at each sector start
export const BASE_PERKS = Object.freeze({ gunshipMeter: 1.5, rebuildHulls: 1 });

// ISAO MENDS WHAT THE SWARM BROKE (owner, 2026-09-16: "Isao should go and build walls/a gate in between waves when a breach of the
// base happened"). The rule is src/domain/repair-orders.js; these are the numbers. `gateAt` is the share of the gate's hp below
// which the door is worth a trip (a broken gate always is), and each kind carries the print Isao stands over: the gate is the
// bigger job. `brief` is his line the first time he flies out to a repair.
export const BASE_REPAIR = Object.freeze({
  gateAt: 0.75, brief: 'isao_repair',
// `plot` is the half extents in metres, across and along the piece's heading, that his print beam rasters over while he mends it
// (src/fx/base-print.js repairBed): the door's own footprint and one wall segment's, so the beam works the thing and not the dirt.
  gate: Object.freeze({ seconds: 8, metres: 6, label: 'GATE', plot: [7, 3] }),
  wall: Object.freeze({ seconds: 5, metres: 4, label: 'WALL', plot: [4, 3] }),
});
