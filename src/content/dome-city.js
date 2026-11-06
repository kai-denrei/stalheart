// THE DOME CITY (owner, 2026-11-05, round 8 note 6: "we introduce a new layout for the main base: the dome city, which includes our existing
// elements in between"; note 5: "we import new models: dome-city ..."). A second layout of the same base, chosen by ?base=dome|classic
// (src/content/base-layout.js baseLayoutMode, withBaseLayout), THE DEFAULT since round 8 stream C; the classic base is untouched and always
// one flag away (?base=classic). Pure data.
//
// THE AUTHOR'S CITY AND THIS READING OF IT. SentryTowers_A6 assets/dome-city/layout.json (upstream 40c23fa4, kept in the vault) is nine domes
// on an 80 m grid, x and z in {-80, 0, 80}, twelve 52 m bridges between neighbours and four courts between them, status
// `diorama_candidate_not_game_integration`. Our base already has a centre and a mouth, so the game takes SIX DOMES AND FOUR BRIDGES:
//   - THE TERRAFORMER IS THE POWER DOME: the Stålheart stands where the author's DOME_22 (power) stood, so that dome is not placed.
//   - DOME_12 (research, north centre) is not placed: the mouth corridor, the landing island and the sightline run there (-Z is the mouth).
//   - DOME_32 (biosphere, south centre) is not placed: the bays stand behind the Stålheart with their doors toward the gate, and the hull's
//     roll-out lane runs where it stood.
//   - so the two outer columns stand, three domes a side, and only their four north-south bridges (the author's LINK_N_11, LINK_N_21,
//     LINK_N_13, LINK_N_23); every east-west bridge ran to a dome that is not here.
// The owner can overturn any of these with one line: a dome is a row below, a bridge is a row below.
//
// The domes keep the author's roles and columns (his +Z, "N", is our +Z: the back of the base, so dome-nw is his DOME_11, on the mouth's side).
// RESIZED (the owner, 2026-11-07: "the Domes, which need to be resized, but still must leave room for the tank to go under the bridges"):
// DOME_SCALE 0.65. A dome is a 20 x 20 island (the model's bounds are +-14.6 m, +-9.5 m at the scale) carrying its module, D0, LOD1 near and
// the one-draw LOD2 far, its ports 14 m out at y 9.7 in the model, 9.1 m out at y 6.3 standing. THE PAIR SPACING IS THE BRIDGE'S: the
// bridge keeps its length, so its socket 26 m from its centre meets a port 9.1 m from the dome's when the domes stand 2 x 35.1 = 70.2 m apart
// (the author's grid was 80 m at scale 1, 26 + 14 = 40 a side): the middle domes stay at z 0, the outer ones move in to z +-70.2, the bridges
// to z +-35.1; the columns stay at x +-80. `caps` names each port cap a bridge meets and that bridge (the dome-colony README: "Hide the named connected caps at LOD0/1
// using open_ports; LOD2 keeps static simplified port silhouettes"; in our LOD2 files the caps are empty nodes, so the same names hide nothing there).
// THE CAP FOLLOWS ITS BRIDGE (the final review of THE BASE FROM SCRATCH, 2026-11-07): round 8 hid the caps outright, from when all ten pieces
// stood together; a dome Isao prints before its bridge then had a 3.8 x 3.7 m hole in its side, 4-7.5 m up. src/fx/story-base.js hides a cap only
// once its bridge stands or is printing (a static page, where nothing is pending, hides every one as before), and grow() opens it when the bridge
// begins; a middle dome has two caps, one per bridge.
export const DOME_SCALE = 0.65;   // the owner, 2026-11-07: the domes resized, the bridges 0.65 in height only (below)
export const DOME_ROLES = Object.freeze(['habitat', 'biosphere', 'fabrication', 'logistics']);
const DOMES = [
  // id, the author's dome, module, centre, the ports a bridge meets and the bridge that meets each (the author's N is +Z: dome-nw's N port faces
  // bridge-w1 at z -35.1)
  ['dome-nw', 'DOME_11', 'habitat', -80, -70.2, [['N', 'bridge-w1']]],
  ['dome-w', 'DOME_21', 'biosphere', -80, 0, [['S', 'bridge-w1'], ['N', 'bridge-w2']]],
  ['dome-sw', 'DOME_31', 'habitat', -80, 70.2, [['S', 'bridge-w2']]],
  ['dome-ne', 'DOME_13', 'logistics', 80, -70.2, [['N', 'bridge-e1']]],
  ['dome-e', 'DOME_23', 'fabrication', 80, 0, [['S', 'bridge-e1'], ['N', 'bridge-e2']]],
  ['dome-se', 'DOME_33', 'logistics', 80, 70.2, [['S', 'bridge-e2']]],
];
const dir = 'assets/models/dome-colony';
// STAGE 2, NOT FOUNDED (the owner, 2026-11-07: "the base should not be built yet. Isao comes out and starts a base from scratch"; round 8 had
// them `founded`, standing from a growing base's first frame). A static page at stage 2 or above stands them as before; a growing base (the
// story's default) has them pending (src/domain/base-plan.js), for Isao's programme to print in play: the SH02 comes down on an empty plain
export const DOME_ISLANDS = Object.freeze(DOMES.map(([id, , , x, z]) => Object.freeze({ id, w: 20, d: 20, x, z, stage: 2 })));
export const DOME_STRUCTURES = Object.freeze([
  ...DOMES.map(([id, author, module, , , ports]) => Object.freeze({ id, author, module, asset: `${dir}/${module}_d0_lod1.glb`, far: `${dir}/${module}_d0_lod2.glb`, island: id, stage: 2, batch: true, scale: DOME_SCALE, offset: [0, 0, 0], caps: Object.freeze(ports.map(([p, bridge]) => Object.freeze([`PORT_CAP_${p}`, bridge]))) })),
  // THE BRIDGES: the 52 m bridge_long (ends +-27 m, its sockets +-26 m at y 9.7, the deck's underside 7.5 m, columns at +-10 and +-26 m, a 19 m
  // opening between the middle pair). The author's yaw -pi/2 lays its X along +Z: heading [-1, 0] here. 0.65 IN HEIGHT ONLY (the owner, 2026-11-07:
  // room for the tank under the bridges): `scale: 1` keeps its 54 m length and 4.4 m width, `scaleY: DOME_SCALE` (src/fx/story-base.js place)
  // brings the sockets to y 6.3, onto the scaled ports, and the deck's underside to 4.9 m, 4.505 m once `lift` has lowered it: 1.49 m over the
  // MÖRK's 3.016 m at rest; HOVERING its body rises TANK_FEEL.rise (src/tankfeel.js, 0.095 model units, ~0.09 m, taken as 0.095 m), so 1.39 m
  // of air over the hovering hull, 0.89 m more than the rule's half metre (7.5 x 0.65 - 0.37 >= 3.016 + 0.095 + 0.5, test/dome-city.mjs). NO SLAB UNDER A BRIDGE: its ends stand inside the two
  // domes' plots (26 m out of 35.1, the dome's plot reaches 25.1 m), so a bridge island could never keep the 4 m between islands; and none is
  // needed. Each placement is tangent at its own centre (R 753 m). `lift` (NEGATIVE = DOWN, along the bridge's own up) brings the bridge's end
  // and the dome's port to one height: the end stands 26 m out and the port 14 x DOME_SCALE = 9.1 m out of the dome's centre, both measured over
  // the same sphere point, so each sags below its own tangent by sag(d) = d^2 / 1506; `lift` ~ -(sag(26) - sag(9.1)) = -(0.449 - 0.055) = -0.39.
  // -0.37 is kept: measured on the sphere (test/dome-city.mjs) the end columns stand 2.5 cm over the domes' slabs and each socket 4 cm under its
  // port, within the design's decimetre; the middle pair sinks into the ground, unseen. (The same relation gives -0.32 at the old 80 m spacing,
  // which is where -0.33 came from.)
  // `anchor: 'frame'`: placed at its own x, z on natural ground (src/domain/base-plan.js)
  ...[['bridge-w1', 'LINK_N_11', -80, -35.1], ['bridge-w2', 'LINK_N_21', -80, 35.1], ['bridge-e1', 'LINK_N_13', 80, -35.1], ['bridge-e2', 'LINK_N_23', 80, 35.1]].map(([id, author, x, z]) => Object.freeze({
    id, author, batch: true, module: 'bridge_long', asset: `${dir}/bridge_long_d0_lod1.glb`, far: `${dir}/bridge_long_d0_lod2.glb`, anchor: 'frame', x, z, stage: 2, scale: 1, scaleY: DOME_SCALE, offset: [0, 0, 0], heading: [-1, 0], lift: -0.37,
  })),
]);
// the plot of a bridge, for the placement rule (test/dome-city.mjs): its 54 x 4.4 m deck along its heading
export const BRIDGE_PLOT = Object.freeze([4.4, 54]);
// THE DOMES AND THE BRIDGES STOP THE HULL (src/content/base-layout.js SOLID_STRUCTURES; src/domain/footprint.js): a dome's shell meets the
// ground all round, so its footprint is the whole dome; a bridge's is its eight columns, so the hull drives under the deck between them
export const DOME_SOLIDS = Object.freeze(DOME_STRUCTURES.map((s) => s.id));

// THE EXISTING ELEMENTS IN BETWEEN (note 6): the classic base's islands keep their size and their structures; only the centres listed here
// move (src/content/base-layout.js withBaseLayout). An id this tree does not have is skipped (stream D's `depot` arrives by merge).
// `heading` turns the island's structures to it. The rule (test/dome-city.mjs): 4 m between islands, none under a dome or a bridge's
// strip, the sightline x~0 toward -Z free, every island inside the clearing, no model on another island's slab, every island reachable by the
// hull. Measured with a plan print on this data (2 m a character, the round 8 stream C entry's evidence).
// What stays: the Stålheart (4.5, 0), the landing (0, -60), the bays (0, 62), the radar, the armory, the garage, the solar and the farm.
// What moves, and why:
//   launcher  its classic plot (-74, 2) is dome-w's. Into the launch court north of HUGIN, turned to fire -Z out over the north rim between
//             dome-nw and the mouth (the classic west rim is the domes and their bridges now); its 30 m plot is along Z, which the 46 m rail
//             now lies along. The breech ends 7.8 m short of HUGIN's slab, the rail 14 m from dome-nw (at 0.65; 4 m and 8.8 m before the
//             resize and HUGIN's nudge); the payload leaves the rail 22.7 m up
//             and nothing of the city stands ahead of it
//   assembly  its classic plot (56, 6) runs 1 m into dome-e's (4 m clear wanted). At x 50 (the design's first guess) its ammunition dump, laid 16-21 m west of
//             its centre, lands on the Stålheart's rails (measured: -4.4 and -8.5 m, box against box). So it SWAPS with the chip plant: the
//             assembly line into the cargo court (60, 40), its ammunition dump and the armory's reload pad (-18, 1 off it) on open ground
//             east of the bays, 11 m from dome-e and dome-se (at 0.65 the line's model box stands 16.5 m from dome-e's, 6.7 m from dome-se's)
//   chips     the small chip plant takes the assembly line's place beside the Stålheart (50, 6), 10 m off its slab and 13 m from dome-e (8 m at scale 1)
//   depot     stream D's island (36 x 16, classic (-70, -78) under dome-nw): the NE court north of the solar array, a short road to the gate
// NUDGED FOR THE RESIZED CITY (the owner, 2026-11-07; the rule re-run on the domes at 0.65, dome-nw's plot now z -80.2..-60.2), each by the least
// whole metres that pass:
//   hugin     classic (-52, -40): its 40 m slab ran 0.2 m from dome-nw's (4 wanted; 3.8 m is the exact least, 4 the whole metres). Not east:
//             6 m east clears dome-nw but leaves 2 m to the Stålheart's slab, which needs it at x <= -48. So 4 m toward +Z (toward the bays), to (-52, -36): 4.2 m
//             from dome-nw, 8 m off the Stålheart in x, 11.8 m from bridge-w1's strip
//   board     classic (-38, 2): HUGIN 4 m toward +Z leaves the boards 0 m from its slab, so 4 m toward +Z too; and 2 m east, to (-36, 6): +Z
//             alone would push the radar along onto the armory (its model 0.5 m over the armory's slab), so the boards step 2 m clear of the radar in
//             x instead (4 m) and the radar stays
export const DOME_PLACEMENT = Object.freeze({
  launcher: Object.freeze({ x: -50, z: -92, heading: Object.freeze([0, -1]) }),
  hugin: Object.freeze({ x: -52, z: -36 }),
  board: Object.freeze({ x: -36, z: 6 }),
  assembly: Object.freeze({ x: 60, z: 40 }),
  chips: Object.freeze({ x: 50, z: 6 }),
  depot: Object.freeze({ x: 42, z: -86 }),
});
