// The story base: what stands where, and in which stage it appears. Frame
// metres around the pole; -Z points at the clearing's open mouth. Plots are
// the kit's reserved footprints (4 m cells), islands carry one scalable slab.
import { STORY_SCALE } from './story-defaults.js';

export const STAGES = Object.freeze([
  { n: 0, name: 'Empty pole' },
  { n: 1, name: 'Landing' },
  { n: 2, name: 'Foundations' },
  { n: 3, name: 'Solar and Rotor' },
  { n: 4, name: 'Gate and walls' },
  { n: 5, name: 'HUGIN arm' },
  { n: 6, name: 'Stalheart' },
  { n: 7, name: 'Tank bay' },
  { n: 8, name: 'Assembly line and radar' },
]);

// islands: id, plot in metres, centre, stage the slab appears
export const ISLANDS = Object.freeze([
  { id: 'landing', w: 16, d: 16, x: 0, z: -60, stage: 2 },
  { id: 'solar', w: 20, d: 20, x: 44, z: -60, stage: 3 },
  { id: 'hugin', w: 40, d: 40, x: -52, z: -40, stage: 5 },
  { id: 'stalheart', w: 48, d: 56, x: 0, z: 0, stage: 6 },
  { id: 'bay', w: 36, d: 32, x: 0, z: 62, stage: 7 },          // behind the Stalheart, doors toward the gate
  { id: 'assembly', w: 20, d: 32, x: 56, z: 6, stage: 8 },
  { id: 'radar', w: 20, d: 20, x: -56, z: 34, stage: 8 },
]);

// structures: asset, island they stand on, stage, model offset to centre the
// authored origin on the plot, uniform scale, nodes to hide
export const STRUCTURES = Object.freeze([
  { id: 'sh02', asset: 'assets/models/story/sh_rocket.glb', island: 'landing', stage: 1, scale: 1.5, offset: [0, 0, 0], clips: ['Legs_Deploy', 'Top_Door_Open'], hold: true },
  // far: the tier shown beyond KIT.lod.metres; the near tier is only fetched once the camera comes close. Authored tiers where the
  // owner exports them (solar: LOD1 game, LOD2 distance); elsewhere derived under assets/models/far by npm run tiers (a tenth of the triangles)
  { id: 'solar', asset: 'assets/models/astro/solar_power_complex_lod1_d0.glb', far: 'assets/models/astro/solar_power_complex_lod2_d0.glb', island: 'solar', stage: 3, scale: 1, offset: [0, 0, -1.6], batch: true },
  { id: 'rotor', asset: 'assets/models/sentries/rotor_t1.glb', island: null, anchor: 'wall', stage: 3, scale: 3, offset: [0, 0, 0] },   // high ground: the rock beside the tunnel mouth
  { id: 'hugin', asset: 'assets/models/astro/hugin_launchpad_d0_game.glb', far: 'assets/models/far/hugin.glb', island: 'hugin', stage: 5, scale: 1, offset: [-3, 0, 8], hide: ['REUSABLE_BOOSTER'], clips: ['Cargo_Recovery_Cycle'] },
  { id: 'stalheart', asset: 'assets/models/astro/terraformer_3000_d0_game.glb', far: 'assets/models/far/stalheart.glb', island: 'stalheart', stage: 6, scale: 1, offset: [14.5, 0, 0], clips: ['Terraforming_Cycle'],
    // Runtime LOD candidates pinned at c827eda for game-camera review (docs/landmark-tiers-assets.lock.json). Only
    // ?landmarks=candidate reads them; asset and far above stay what ships, and far-tiers.mjs keeps deriving that far.
    candidate: { asset: 'assets/models/astro/terraformer_3000_d0_lod1.glb', far: 'assets/models/astro/terraformer_3000_d0_lod2.glb' } },
  // THE THREE HULLS ARE THE THREE LIVES. The kit's three-bay diorama: 01 sealed, 02 and 03 open with a
  // MÖRK parked inside; the first hull leaves 03, the next 02, the last opens 01. The diorama is authored
  // at the kit's 13.3 m MÖRK and scaled to the story's 10 m hull; its roll-out clip is held at 0 (all inside).
  { id: 'bays', asset: 'assets/models/kit/mork_container_low_diorama.glb', island: 'bay', stage: 7, scale: STORY_SCALE.tankMetres / 13.28, offset: [0, 0, 0], heading: [0, -1], pose: { Tank_Roll_Out: 0 },
    bays: [{ n: 1, x: -11, doors: '01', like: '02' }, { n: 2, x: 0, vehicle: 'VEHICLE_02' }, { n: 3, x: 11, vehicle: 'VEHICLE_03', rollout: 'Tank_Roll_Out' }] },   // bay centres along the model's X, doors at +Z
  { id: 'assembly', asset: 'assets/models/astro/robotic_assembly_line_d0.glb', far: 'assets/models/far/assembly.glb', island: 'assembly', stage: 8, scale: 1, offset: [0, 0, 0], batch: true, clips: ['Assembly_Cycle'] },
  { id: 'radar', asset: 'assets/models/kit/skyward_low_d0.glb', island: 'radar', stage: 8, scale: 1, offset: [0, 0, 0], clips: ['Array_Slew'] },
  // EARLIER LANDINGS, out past the clearing on open ground (anchor 'open' snaps to the nearest open cell): two HUGIN boosters standing
  // on their tripods and one wreck on its side. The flight GLBs sit on their mass reference, feet at -6.3 m, hence the offset; the wreck
  // is tilted onto its side and lifted by its hull radius. Draft placement, to be moved once the tank trip beat is written.
  { id: 'rocket-a', asset: 'assets/models/story/hugin_deployed.glb', far: 'assets/models/far/hugin_deployed.glb', anchor: 'open', clear: 16, x: -300, z: 140, stage: 1, scale: 1.5, offset: [0, 6.3, 0], heading: [0.6, 0.8] },
  { id: 'rocket-b', asset: 'assets/models/story/hugin_deployed.glb', far: 'assets/models/far/hugin_deployed.glb', anchor: 'open', clear: 16, x: 330, z: -90, stage: 1, scale: 1.5, offset: [0, 6.3, 0], heading: [-0.5, -0.87] },
  { id: 'wreck', asset: 'assets/models/story/hugin_wreck.glb', far: 'assets/models/far/hugin_wreck.glb', anchor: 'open', clear: 24, x: 120, z: -360, stage: 1, scale: 1.5, offset: [0, 0, 0], tilt: 92, lift: 3.6, heading: [0.9, 0.44] },
]);

export const KIT = Object.freeze({
  slab: 'assets/models/kit/foundation_slab.glb', slabReference: 40,
  wall: 'assets/models/kit/wall_standard_d0.glb', wallLength: 4,
  gate: 'assets/models/kit/gate_vehicle_d0.glb', gatePlot: [12, 8],
  stage: 4, wallsPerSide: 6, wallInset: 3,   // walls flank the gate along the rim, inset from the rock
  wallMetres: 4,                              // the lattice rock's roof height, where sentries mount
  sightline: { metres: 240, halfWidth: 7 },   // a straight lane cut from the forward cell out to the sinkhole, so the Quiver has a long clear shot (owner, 2026-09-13); replaces the fodderSteps walk
  fodderSteps: 28,                            // lane cells outward from the mouth where the ground opens: a tank trip to investigate
  rotorSteps: 2, quiverSteps: 1, rotorEdge: 0.4,   // the Quiver's wall cell touches the lane one step nearer the gate, on the Rotor's side: the sightline to the gate pile is proven there              // the first Rotor's wall cell touches the lane cell this many steps past the forward cell; the lab's static model stands this share of the way toward the lane (the game perches every tower on its wall's edge)
  bay: { roll: 2, doorSeconds: 2.4, rollOutMetres: 19, rollOutSeconds: 8 },
  lod: { metres: 150, hysteresis: 1.3, ratio: 0.1 },   // camera closer than this shows the near tier (and first fetches it); it stays until 1.3x that; far tiers keep a tenth of the triangles   // a hull rolls two lane cells straight out of its doors; bay 03's authored roll-out carries the hull 19 model metres in 8 s
});

// LANDMARK TIERS UNDER REVIEW. A structure may carry `candidate` tiers: authored runtime LODs pinned for game-camera
// review before they replace what ships. This is the ONE place a candidate becomes the structure, so the story lab and
// the game world cannot disagree about which files a review is looking at — both call it on STRUCTURES before planBase,
// which spreads every field through untouched. Anything but 'candidate' hands back the shipped structures unchanged.
export const LANDMARK_TIER_MODES = ['shipped', 'candidate'];
export function withLandmarkTiers(structures, mode = 'shipped') {
  if (mode !== 'candidate') return structures;
  return structures.map((s) => (s.candidate ? { ...s, ...s.candidate } : s));
}

// ONE PARSER FOR THE SWITCH, so the story lab and the game world read ?landmarks= the same way: two copies of this line
// would be the drift the mapping above exists to prevent. Pure — a search string in, a mode out.
export function landmarkTierMode(search) {
  return new URLSearchParams(search || '').get('landmarks') === 'candidate' ? 'candidate' : 'shipped';
}
