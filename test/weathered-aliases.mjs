// weathered-aliases.mjs — the MÖRK's authored surface names reach the weathered rungs.
//
// The metal lab's base colours were a no-op on the tank because its GLB names
// its materials "Mork armor / midnight petrol" and friends, and the dressing
// walks only M_* keys. The aliases are opt-in: WEATHER_BY_NAME, which the
// board uses, must not change.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { WEATHER_BY_NAME, MORK_SURFACES, withSurfaceAliases, applyWeatheredMaterial } from '../src/fx/weathered-material.js';

assert(!Object.keys(WEATHER_BY_NAME).some(k => k in MORK_SURFACES), 'the board contract stays M_* only');
for (const rung of Object.values(MORK_SURFACES)) assert(rung in WEATHER_BY_NAME, `${rung} is a rung`);

const specs = { M_Armour: { preset: 'gunmetal', tint: 1 }, M_Steel: { preset: 'steel', tint: 0.9 } };
const aliased = withSurfaceAliases(specs);
assert.equal(aliased['Mork armor / midnight petrol'], specs.M_Armour);
assert.equal(aliased['Structural frame / blue steel'], specs.M_Steel);
assert(!('Mork edge armor / slate' in aliased), 'an alias whose rung is absent is not invented');
assert.equal(aliased.M_Armour, specs.M_Armour);

// A tank-shaped cast: the armour's base colour follows the knob it is given.
function cast(baseHex) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const root = new THREE.Group();
  const armour = new THREE.MeshStandardMaterial({ name: 'Mork armor / midnight petrol', color: 0x425b61 });
  const light = new THREE.MeshStandardMaterial({ name: 'Caution / amber', color: 0xf9bd48 });
  root.add(new THREE.Mesh(geometry, armour), new THREE.Mesh(geometry, light));
  const byName = { M_Armour: { preset: 'gunmetal', tint: 1, baseHex } };
  return { root, armour, light, plain: applyWeatheredMaterial(root.clone(), { size: 16, byName }), n: applyWeatheredMaterial(root, { size: 16, byName: withSurfaceAliases(byName) }) };
}
const mean = (tex) => { const d = tex.image.data; let r = 0, g = 0, b = 0, k = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; k++; } return [r / k, g / k, b / k]; };
const grey = cast(0x6e747b), pink = cast(0xff66cc);
assert.equal(grey.plain, 0, 'without aliases the MÖRK names dress nothing (the bug)');
assert.equal(pink.n, 1, 'with aliases the armour is dressed');
assert.equal(pink.light.map, null, 'the amber light keeps its authored colour');
assert.equal(pink.light.color.getHex(), 0xf9bd48);
const [gr, , gb] = mean(grey.armour.map), [pr, pg, pb] = mean(pink.armour.map);
assert(pr > gr + 40 && pb > gb + 20 && pr > pg + 40, `a pink base bakes a pink albedo (grey ${mean(grey.armour.map).map(Math.round)}, pink ${[pr, pg, pb].map(Math.round)})`);
console.log('Weathered aliases: the MÖRK surface names dress on their rungs and carry the base colour; the board contract is unchanged.');
