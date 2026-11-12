// THE COLONY ON THE DOME-CITY GRID (the owner, 2026-11-12, reviewing the first colony design: "dome city would be like this
// https://jelaludo.github.io/SentryTowers_A6/dome-city/ ..."; "which probably necessitates updating stalheart to its mobile version"; design
// docs/superpowers/specs/2026-11-12-colony-layout-design.md, built 2026-11-12 night). The layout of the base the story uses by default
// (src/content/base-layout.js withBaseLayout, ?base=dome or nothing); ?base=classic is untouched. Pure data.
//
// THE GRID. The author's Dome City is nine domes on a 3 x 3 at 80 m with twelve 52 m bridges and four courts between them. Ours keeps the bridge's
// full length and the domes at DOME_SCALE (the owner, 2026-11-07), so the grid is 70.2 m: the bridge's socket 26 m from its centre meets a dome's
// port 14 x 0.65 = 9.1 m from the dome's (2 x 35.1). COLONY_CELLS is THE ONE TABLE of the city: a cell is a row (a ninth dome is one more row,
// and a bridge one more pair in COLONY_BRIDGES); the islands, the domes, the bridges, their port caps, the programme's steps
// (src/content/base-programme.js) and the gantry's roads are all derived from it. Two cells hold no dome (design 3.1, 3.2): the CENTRE is the
// plaza, the Stålheart's home (a centre dome's four bridges would shut the 42 m gantry in one 51 m court), and the FRONT MIDDLE is the way in
// (the landing pad, the gate's corridor, the sightline; the space elevator at the run's end). So seven domes, and six bridges in a U open
// toward the gate. Row -1 is the mouth's side (-Z); the author's port N is the dome's +Z, E its +X.
// `via`: the cell the KIDOU drives through to reach this one (a corner through its column's middle, design 3.6); the placement rule makes a
// `via` cell wait until every cell behind it holds a dome (src/domain/colony.js), so the gantry never crosses a dome or passes under a bridge.
import { COLONY } from './colony.js';

export const DOME_SCALE = 0.65;   // the owner, 2026-11-07: the domes resized, the bridges 0.65 in height only (below)
const PORT = 14, SOCKET = 26;     // the dome's link port 14 m from its centre (model), the bridge's socket 26 m from its own
export const DOME_GRID = +(2 * (SOCKET + PORT * DOME_SCALE)).toFixed(3);   // 70.2 m
export const COLONY_CELLS = Object.freeze([
  { id: 'nw', col: -1, row: -1, via: 'w' },
  { id: 'ne', col: 1, row: -1, via: 'e' },
  { id: 'w', col: -1, row: 0 },
  { id: 'e', col: 1, row: 0 },
  { id: 'sw', col: -1, row: 1, via: 'w' },
  { id: 's', col: 0, row: 1 },
  { id: 'se', col: 1, row: 1, via: 'e' },
].map((c) => Object.freeze({ ...c, x: +(c.col * DOME_GRID).toFixed(3), z: +(c.row * DOME_GRID).toFixed(3) })));
// the two cells with no dome, for the plan print and the placement rule (design 3.1, 3.2)
export const COLONY_OPEN = Object.freeze({ plaza: Object.freeze([0, 0]), entry: Object.freeze([0, -DOME_GRID]) });
// THE BRIDGES: a pair of neighbouring cells each (the U: the two columns and the back row)
export const COLONY_BRIDGES = Object.freeze([['nw', 'w'], ['w', 'sw'], ['ne', 'e'], ['e', 'se'], ['sw', 's'], ['s', 'se']].map((p) => Object.freeze(p)));
// THE DEFAULT CITY's module on each cell (src/content/colony.js order): what a static page stands, and the module a cell's record mounts before
// the player chooses its kind (src/fx/story-base.js assign swaps it)
export const COLONY_DEFAULT = Object.freeze(Object.fromEntries(COLONY.order));
const cellOf = (id) => COLONY_CELLS.find((c) => c.id === id);
export const domeId = (cell) => `dome-${cell}`;
export const bridgeId = ([a, b]) => `bridge-${a}-${b}`;
// the port a dome opens toward a neighbour (its +X is E, its +Z N)
const portToward = (a, b) => (b.col > a.col ? 'E' : b.col < a.col ? 'W' : b.row > a.row ? 'N' : 'S');
const dir = 'assets/models/dome-colony';
export const domeFiles = (module) => Object.freeze({ asset: `${dir}/${module}_d0_lod1.glb`, far: `${dir}/${module}_d0_lod2.glb` });
// STAGE 2, NOT FOUNDED (the owner, 2026-11-07: "the base should not be built yet"): a static page at stage 2 or above stands the default city; a
// growing base (the story's default) has every cell pending (src/domain/base-plan.js), printed in play once the player buys a kind for it
export const DOME_ISLANDS = Object.freeze(COLONY_CELLS.map((c) => Object.freeze({ id: domeId(c.id), cell: c.id, w: 20, d: 20, x: c.x, z: c.z, stage: 2 })));
export const DOME_STRUCTURES = Object.freeze([
  ...COLONY_CELLS.map((c) => { const module = COLONY_DEFAULT[c.id];
    const caps = COLONY_BRIDGES.filter((p) => p.includes(c.id)).map((p) => Object.freeze([`PORT_CAP_${portToward(c, cellOf(p[0] === c.id ? p[1] : p[0]))}`, bridgeId(p)]));
    return Object.freeze({ id: domeId(c.id), cell: c.id, module, ...domeFiles(module), island: domeId(c.id), stage: 2, batch: true, scale: DOME_SCALE, offset: [0, 0, 0], caps: Object.freeze(caps) }); }),
  // THE BRIDGES: the 52 m bridge_long (ends +-27 m, its sockets +-26 m at y 9.7, the deck's underside 7.5 m, columns at +-10 and +-26 m, a 19 m
  // opening between the middle pair). Its length runs along the model's X: heading [-1, 0] lays it along frame +Z (a column's), [0, 1] along +X (the
  // back row's). 0.65 IN HEIGHT ONLY (the owner, 2026-11-07: room for the tank under the bridges): `scale: 1` keeps its 54 m length and 4.4 m width,
  // `scaleY: DOME_SCALE` (src/fx/story-base.js place) brings the sockets to y 6.3, onto the scaled ports, and the deck's underside to 4.9 m, 4.505 m
  // once `lift` has lowered it: 1.49 m over the MÖRK's 3.016 m at rest, 1.39 m over the hovering hull (test/dome-city.mjs). `lift` (negative =
  // down) brings the bridge's end and the dome's port to one height on the sphere: -(sag(26) - sag(9.1)) = -0.39, -0.37 kept on the measurement.
  // NO SLAB UNDER A BRIDGE (its ends stand inside the domes' plots); `anchor: 'frame'`: placed at its own x, z (src/domain/base-plan.js)
  ...COLONY_BRIDGES.map((p) => { const a = cellOf(p[0]), b = cellOf(p[1]);
    return Object.freeze({ id: bridgeId(p), cells: p, batch: true, module: 'bridge_long', ...domeFiles('bridge_long'), anchor: 'frame', x: +((a.x + b.x) / 2).toFixed(3), z: +((a.z + b.z) / 2).toFixed(3), stage: 2, scale: 1, scaleY: DOME_SCALE, offset: [0, 0, 0], heading: Object.freeze(a.col === b.col ? [-1, 0] : [0, 1]), lift: -0.37 }); }),
]);
// the plot of a bridge, for the placement rule (test/dome-city.mjs) and its print (src/fx/base-print.js frame): 4.4 m across its 54 m deck
export const BRIDGE_PLOT = Object.freeze([4.4, 54]);
// THE DOMES AND THE BRIDGES STOP THE HULL (src/content/base-layout.js SOLID_STRUCTURES; src/domain/footprint.js): a dome's shell meets the
// ground all round; a bridge's footprint is its eight columns, so the hull drives under the deck between them
export const DOME_SOLIDS = Object.freeze(DOME_STRUCTURES.map((s) => s.id));

// THE COURTS AND THE OUTER BELT (design 3.3): the classic islands keep their size and their structures; only the centres listed here move
// (src/content/base-layout.js withBaseLayout), `heading` turns the island's structures, `w`/`d` give a turned island its plot. The courts are
// the four squares between the grid's lines, 51 m clear between dome foundations; the gantry's roads run on the lines (COLONY_GANTRY), so a
// court's pieces keep off them:
//   launcher  01 LAUNCH COURT (front-left): the ARC-01, firing -Z out over the north rim between dome-nw and the entry
//   depot     04 CARGO COURT (front-right), turned a quarter: the pearls, the SAI-92 and the rover's pad (its pad faces the gate's corridor), the
//             rover's road to the gate short (the cargo and fabrication courts swap against the author's numbering for that road)
//   solar     03 SOLAR SERVICES (back-left), the array a first-orders card as before
//   garage    02 FABRICATION COURT (back-right), the paint bay; parked in it the hull mends
//   hugin     the outer belt, west of dome-w; bay the outer belt behind dome-s, doors toward the gate (the hull drives round dome-s and under
//             the back row's bridges); board the scoreboard on the outer belt behind dome-sw
// Unmoved: the landing pad (the entry, (0, -60)) and the Stålheart's island (the plaza, (4.5, 0)).
export const DOME_PLACEMENT = Object.freeze({
  launcher: Object.freeze({ x: -36, z: -52, heading: Object.freeze([0, -1]) }),   // its 46 m rail runs 13 m past the island's plaza end: z -52 keeps the breech 1.8 m off the middle road (design: -46)
  depot: Object.freeze({ x: 29, z: -50, heading: Object.freeze([1, 0]), w: 16, d: 36 }),
  solar: Object.freeze({ x: -35, z: 42 }),
  garage: Object.freeze({ x: 35, z: 42 }),
  hugin: Object.freeze({ x: -119, z: 0 }),
  bay: Object.freeze({ x: 0, z: 110 }),
  board: Object.freeze({ x: -44, z: 104 }),
});
// NOT PLACED ON THE DOME BASE (design 3.3): the radar, the armory, the farm, the chip plant and the assembly line; their roles are dome kinds
// (src/content/colony.js). Their islands leave the layout and every structure on them goes too, so the programme drops their steps
// (src/platform/story-world.js keeps only the steps a plan holds). ?base=classic keeps them all
export const DOME_DROPPED = Object.freeze(['radar', 'assembly', 'armory', 'farm', 'chips']);

// THE MOBILE STÅLHEART'S ROADS (design 3.6; the KIDOU, docs/a6-kidou-sai93-assets.lock.json): it lives on the plaza and drives the grid's lines
// to the cell it prints, straddling the dome between its two beams, then home the same way. Measured in the engine (2026-11-12 night, the KIDOU's
// LOD1 posed by its adapter): its frame's underside 28.8 m up and its legs' inner faces 13.98 m either side of its centre, against a dome at
// 0.65 that is 9.49 m round and 23.3 m to its mast's cradle: 4.5 m clear a side and 5.5 m overhead (the design's 0.9 m was against an assumed
// 25 m working height). The TOOL is what does not reach: its tip stands 3.2-3.6 m up printing and 11.26 m with the lift at its travel height,
// the highest the author's adapter poses it, so the gantry prints the dome up to `reach - nozzle` (10.5 m: the whole shell and the mast's
// foot) and Isao flies the mast's rest, as the design's fallback says. Its root is the ground under its centre; the tool's fabrication origin
// stands `tool` m ahead of it along its heading, so the dome's centre stands under the nozzle. `speed` m/s along its beams and `turn` rad/s in
// place are the author's peaks; a turn picks the nearer of driving on or reversing, so it never turns more than a quarter at a corner.
// THE LOGISTICS DOME'S PAD (2026-11-12 night; design 3.4: "its pad (12 m, at the dome's foot toward the plaza) refills the hull's shells two a second
// and restocks the flares"): `foot` m from the dome's centre toward the plaza (the dome is 9.5 m round, the pad's ring BASE_PERKS.armory.radiusMetres)
export const COLONY_PAD = Object.freeze({ foot: 18 });
export const COLONY_GANTRY = Object.freeze({
  home: Object.freeze([4.5, 0]), heading: Object.freeze([0, 1]),
  speed: 4, turn: 0.39, tool: 2.6,
  reach: 11.26, nozzle: 0.8, top: 23.3,
  seconds: 30,   // a dome's whole print, the gantry's share and Isao's together
});
