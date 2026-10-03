// THE PAINT (owner, 2026-10-02: "as Isao processes the biomass of the enemies for printing material ... offers the player to pimp his
// ride"; and 2026-10-03: "abandon the bjj belts scheme, and offer more natural regular palettes"). The belt dyes and their kill counts
// are gone: the paint shop on the bays' purple pad (src/fx/paint-pad.js) offers these palettes, every one from the start. A palette paints
// both of the hull's surfaces, `armour` and `edge`, colours chosen to read as paint on the MÖRK in the planet's light. Pure data.
export const PALETTES = Object.freeze([
  { id: 'desert', label: 'DESERT', armour: '#b99a63', edge: '#5e4d33' },
  { id: 'forest', label: 'FOREST', armour: '#3f5a3a', edge: '#262e22' },
  { id: 'arctic', label: 'ARCTIC', armour: '#d6dce1', edge: '#76848f' },
  { id: 'navy', label: 'NAVY', armour: '#23344f', edge: '#9aa6b2' },
  { id: 'rust', label: 'RUST', armour: '#8a4b2c', edge: '#36271f' },
  { id: 'olive', label: 'OLIVE DRAB', armour: '#5d6136', edge: '#2d2e1f' },
  { id: 'gunmetal', label: 'GUNMETAL', armour: '#3b4147', edge: '#b4bbc2' },
  { id: 'stone', label: 'SAND & STONE', armour: '#b5a587', edge: '#55524b' },
  { id: 'crimson', label: 'CRIMSON', armour: '#7a1f1f', edge: '#262626' },
  { id: 'teal', label: 'TEAL & BONE', armour: '#2e6867', edge: '#d1c5a0' },
  { id: 'hazard', label: 'HAZARD', armour: '#d2a32a', edge: '#1b1b1b' },
  { id: 'night', label: 'NIGHT OPS', armour: '#17191d', edge: '#3d434a' },
].map(Object.freeze));
export const PALETTE_BY_ID = Object.freeze(Object.fromEntries(PALETTES.map((p) => [p.id, p])));

// the hull's two paintable surfaces (the A6 MÖRK's own material names, src/fx/weathered-material.js MORK_SURFACES); FACTORY is its own paint
export const DYE_SLOTS = Object.freeze([
  Object.freeze({ id: 'armour', label: 'ARMOUR', material: 'Mork armor / midnight petrol' }),
  Object.freeze({ id: 'edge', label: 'EDGE ARMOUR', material: 'Mork edge armor / slate' }),
]);
export const FACTORY = 'factory';

// where the choice is kept, and the card's title
export const DYE_SHOP = Object.freeze({ store: 'dyes', title: 'PAINT SHOP · ISAO' });
