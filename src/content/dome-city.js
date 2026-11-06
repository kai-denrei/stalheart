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
// The domes keep the author's roles and coordinates (his +Z, "N", is our +Z: the back of the base, so dome-nw is his DOME_11 at z -80, on
// the mouth's side). A dome is a 30 x 30 island (the model's bounds are +-14.6 m) carrying its module, D0, LOD1 near and the one-draw LOD2
// far, scale 1. `hide` lifts the named port caps on the linked side (the dome-colony README: "Hide the named connected caps at LOD0/1 using
// open_ports; LOD2 keeps static simplified port silhouettes"; in our LOD2 files the caps are empty nodes, so the same names hide nothing there).
export const DOME_ROLES = Object.freeze(['habitat', 'biosphere', 'fabrication', 'logistics']);
const DOMES = [
  // id, the author's dome, module, centre, the ports a bridge meets
  ['dome-nw', 'DOME_11', 'habitat', -80, -80, ['N']],
  ['dome-w', 'DOME_21', 'biosphere', -80, 0, ['S', 'N']],
  ['dome-sw', 'DOME_31', 'habitat', -80, 80, ['S']],
  ['dome-ne', 'DOME_13', 'logistics', 80, -80, ['N']],
  ['dome-e', 'DOME_23', 'fabrication', 80, 0, ['S', 'N']],
  ['dome-se', 'DOME_33', 'logistics', 80, 80, ['S']],
];
const dir = 'assets/models/dome-colony';
// STAGE 2, FOUNDED (the owner, of note 6: "the main base"; the colony arrived with its domes): Foundations, and `founded` — printed by no step
// of Isao's programme, standing from a growing base's first frame (src/domain/base-plan.js): the SH02 comes down among them
export const DOME_ISLANDS = Object.freeze(DOMES.map(([id, , , x, z]) => Object.freeze({ id, w: 30, d: 30, x, z, stage: 2, founded: true })));
export const DOME_STRUCTURES = Object.freeze([
  ...DOMES.map(([id, author, module, , , ports]) => Object.freeze({ id, author, module, asset: `${dir}/${module}_d0_lod1.glb`, far: `${dir}/${module}_d0_lod2.glb`, island: id, stage: 2, founded: true, batch: true, scale: 1, offset: [0, 0, 0], hide: ports.map((p) => `PORT_CAP_${p}`) })),
  // THE BRIDGES: the 52 m bridge_long (ends +-27 m, its sockets +-26 m at y 9.7, the deck's underside 7.5 m, columns at +-10 and +-26 m, a 19 m
  // opening between the middle pair). The author's yaw -pi/2 lays its X along +Z: heading [-1, 0] here. NO SLAB UNDER A BRIDGE: its ends stand
  // inside the two domes' plots (26 m out of 40, the dome's plot reaches 25 m), so a bridge island could never keep the 4 m between islands;
  // and none is needed: each placement is tangent at its own centre, so 40 m out the dome stands 1.06 m lower and tilted 0.053 rad, and its
  // port meets the bridge's socket 0.33 m BELOW it (R 753 m). `lift` -0.33 sets the deck on both ports at once; the end columns then stand on
  // the domes' slabs to the centimetre and the middle pair sinks a quarter metre into the ground, unseen. `anchor: 'frame'`: placed at its
  // own x, z on natural ground (src/domain/base-plan.js)
  ...[['bridge-w1', 'LINK_N_11', -80, -40], ['bridge-w2', 'LINK_N_21', -80, 40], ['bridge-e1', 'LINK_N_13', 80, -40], ['bridge-e2', 'LINK_N_23', 80, 40]].map(([id, author, x, z]) => Object.freeze({
    id, author, batch: true, module: 'bridge_long', asset: `${dir}/bridge_long_d0_lod1.glb`, far: `${dir}/bridge_long_d0_lod2.glb`, anchor: 'frame', x, z, stage: 2, founded: true, scale: 1, offset: [0, 0, 0], heading: [-1, 0], lift: -0.33,
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
// What stays: the Stålheart (4.5, 0), the landing (0, -60), the bays (0, 62), HUGIN (-52, -40: its 40 m slab ends 5.8 m short of bridge-w1's
// strip and 5 m short of dome-nw's plot), the boards, the radar, the armory, the garage, the solar and the farm. What moves, and why:
//   launcher  its classic plot (-74, 2) is dome-w's. Into the launch court north of HUGIN, turned to fire -Z out over the north rim between
//             dome-nw and the mouth (the classic west rim is the domes and their bridges now); its 30 m plot is along Z, which the 46 m rail
//             now lies along. The breech ends 4 m short of HUGIN's slab, the rail 8.8 m from dome-nw; the payload leaves the rail 22.7 m up
//             and nothing of the city stands ahead of it
//   assembly  its classic plot (56, 6) runs 1 m into dome-e's (4 m clear wanted). At x 50 (the design's first guess) its ammunition dump, laid 16-21 m west of
//             its centre, lands on the Stålheart's rails (measured: -4.4 and -8.5 m, box against box). So it SWAPS with the chip plant: the
//             assembly line into the cargo court (60, 40), its ammunition dump and the armory's reload pad (-18, 1 off it) on open ground
//             east of the bays, 11 m from dome-e and dome-se
//   chips     the small chip plant takes the assembly line's place beside the Stålheart (50, 6), 10 m off its slab and 8 m from dome-e
//   depot     stream D's island (36 x 16, classic (-70, -78) under dome-nw): the NE court north of the solar array, a short road to the gate
export const DOME_PLACEMENT = Object.freeze({
  launcher: Object.freeze({ x: -50, z: -92, heading: Object.freeze([0, -1]) }),
  assembly: Object.freeze({ x: 60, z: 40 }),
  chips: Object.freeze({ x: 50, z: 6 }),
  depot: Object.freeze({ x: 42, z: -86 }),
});
