// The story base: what stands where, and in which stage it appears. Frame
// metres around the pole; -Z points at the clearing's open mouth. Plots are
// the kit's reserved footprints (4 m cells), islands carry one scalable slab.
export const STAGES = Object.freeze([
  { n: 0, name: 'Empty pole' },
  { n: 1, name: 'Landing' },
  { n: 2, name: 'Foundations' },
  { n: 3, name: 'Solar and Rotor' },
  { n: 4, name: 'Gate and walls' },
  { n: 5, name: 'HUGIN arm' },
  { n: 6, name: 'Stalheart' },
  { n: 7, name: 'Assembly line and radar' },
]);

// islands: id, plot in metres, centre, stage the slab appears
export const ISLANDS = Object.freeze([
  { id: 'landing', w: 16, d: 16, x: 0, z: -60, stage: 2 },
  { id: 'solar', w: 20, d: 20, x: 44, z: -60, stage: 3 },
  { id: 'rotor', w: 8, d: 8, x: -24, z: -96, stage: 3 },
  { id: 'hugin', w: 40, d: 40, x: -52, z: -40, stage: 5 },
  { id: 'stalheart', w: 48, d: 56, x: 0, z: 0, stage: 6 },
  { id: 'assembly', w: 20, d: 32, x: 56, z: 6, stage: 7 },
  { id: 'radar', w: 20, d: 20, x: -56, z: 34, stage: 7 },
]);

// structures: asset, island they stand on, stage, model offset to centre the
// authored origin on the plot, uniform scale, nodes to hide
export const STRUCTURES = Object.freeze([
  { id: 'sh02', asset: 'assets/models/story/sh_rocket.glb', island: 'landing', stage: 1, scale: 1.5, offset: [0, 0, 0], clips: ['Legs_Deploy', 'Top_Door_Open'], hold: true },
  { id: 'solar', asset: 'assets/models/astro/solar_power_complex_d0.glb', island: 'solar', stage: 3, scale: 1, offset: [0, 0, -1.6], batch: true },
  { id: 'rotor', asset: 'assets/models/sentries/rotor_t1.glb', island: 'rotor', stage: 3, scale: 3, offset: [0, 0, 0] },
  { id: 'hugin', asset: 'assets/models/astro/hugin_launchpad_d0_game.glb', island: 'hugin', stage: 5, scale: 1, offset: [-3, 0, 8], hide: ['REUSABLE_BOOSTER'], clips: ['Cargo_Recovery_Cycle'] },
  { id: 'stalheart', asset: 'assets/models/astro/terraformer_3000_d0_game.glb', island: 'stalheart', stage: 6, scale: 1, offset: [14.5, 0, 0], clips: ['Terraforming_Cycle'] },
  { id: 'assembly', asset: 'assets/models/astro/robotic_assembly_line_d0.glb', island: 'assembly', stage: 7, scale: 1, offset: [0, 0, 0], batch: true, clips: ['Assembly_Cycle'] },
  { id: 'radar', asset: 'assets/models/kit/skyward_low_d0.glb', island: 'radar', stage: 7, scale: 1, offset: [0, 0, 0], clips: ['Array_Slew'] },
]);

export const KIT = Object.freeze({
  slab: 'assets/models/kit/foundation_slab.glb', slabReference: 40,
  wall: 'assets/models/kit/wall_standard_d0.glb', wallLength: 4,
  gate: 'assets/models/kit/gate_vehicle_d0.glb', gatePlot: [12, 8],
  stage: 4, wallsPerSide: 6, wallInset: 3,   // walls flank the gate along the rim, inset from the rock
});
