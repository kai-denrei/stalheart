// THE DYES (owner, 2026-10-02: "as Isao processes the biomass of the enemies for printing material, he discovers that he can also
// extract extra dyes and offers the player to pimp his ride", and "it will offer some respite from the action to cool down at some key
// moments"). One dye per belt of the ladder (src/content/sectors.js BELTS): the swarm you kill is the colour you can wear. A belt's dye
// is extracted once `kills` of that belt have gone through Isao's processing (every kill, any source, is biomass), cumulative across
// runs. `paint` is the hull colour, chosen to read as paint on a dark hull, not the creature's own glow. Pure data.
import { BELTS } from './sectors.js';

const PAINT = {
  white: '#dfe6ea', grey: '#7d8792', yellow: '#d8b734', blue: '#2e67c9', orange: '#d9742a',
  green: '#3d9a57', purple: '#7346b8', brown: '#7a5030', black: '#16181c', red: '#b92c27',
};
// the low belts come in their hundreds, the high ones a few at a time: the counts follow
const KILLS = { white: 60, grey: 60, yellow: 50, blue: 50, orange: 30, green: 30, purple: 20, brown: 15, black: 8, red: 5 };

export const DYES = Object.freeze(BELTS.map((belt) => Object.freeze({ id: belt, label: `${belt.toUpperCase()} BELT`, paint: PAINT[belt], kills: KILLS[belt] })));
export const DYE_BY_ID = Object.freeze(Object.fromEntries(DYES.map((d) => [d.id, d])));

// the hull's two paintable surfaces (the A6 MÖRK's own material names, src/fx/weathered-material.js MORK_SURFACES); FACTORY is its own paint
export const DYE_SLOTS = Object.freeze([
  Object.freeze({ id: 'armour', label: 'ARMOUR', material: 'Mork armor / midnight petrol' }),
  Object.freeze({ id: 'edge', label: 'EDGE ARMOUR', material: 'Mork edge armor / slate' }),
]);
export const FACTORY = 'factory';

// the paint shop opens at the break between sectors when there is a dye the player has not been offered yet; Isao's lines
export const DYE_SHOP = Object.freeze({ store: 'dyes', brief: 'dyes_found', title: 'PAINT SHOP · ISAO' });
