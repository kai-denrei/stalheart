// pearl-thermal.mjs — the gunship's thermal view over the Pearl bodies (owner, 2026-11-05: "CUTIS-CORE AMETHYST ... a plain white mass with a hint
// of purple in the nest and the waves", fine in the Quiver's seeker, which comes before the first gunship seat). The game heats the base through
// src/fx/thermal-heat.js over the family's roots AND tells the family (src/fx/creature-pearl.js thermal: a cored tier's skin hot, a soft tier's cold);
// both wrote the same emissive Colour (the shader's uHeat) with their own saved copies, so the family's lazy 'cold' snapshot took the base's warm
// value, and after the seat every membrane stayed 55 % toward white (measured headless: uHeat 000000 before, c4c4c4 after one seat). One writer now:
// the family owns its membranes' heat (userData.ownHeat), thermal-heat leaves them alone, and a pool made while the seat is on takes the seat's state.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { PEARL_TIERS, PEARL_FOLLOW, PEARL_IMPACT } from '../src/content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH } from '../src/content/creature-enemies.js';
import { createPearlFamily } from '../src/fx/creature-pearl.js';
import { PEARL_BODIES } from '../src/fx/creature-enemies.js';
import { createThermalHeat } from '../src/fx/thermal-heat.js';

const membranes = (fam) => { const out = []; for (const r of fam.roots()) r.traverse((o) => { for (const m of [].concat(o.material ?? [])) if (m?.uniforms?.uHeat && m.emissive) out.push(m); }); return out; };
const heatOf = (m) => +m.uniforms.uHeat.value.r.toFixed(3);
const bySkin = (fam, pred) => membranes(fam).filter((m) => pred(fam, m));
const coredSkin = new Set(PEARL_TIERS.filter((t) => t.cored).map((t) => t.id));

{
  const parent = new THREE.Group(), fam = createPearlFamily({ parent, tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT });
  fam.setPlanet(753);
  fam.add('amoeba', { x: 0, z: 0, angle: 0, speed: 12 }); fam.add('barbed', { x: 10, z: 0, angle: 0, speed: 12 });   // a soft pool and a cored pool, as the nests' guards and the ivories
  const tierOf = (m) => { let id = null; for (const r of fam.roots()) r.traverse((o) => { if ([].concat(o.material ?? []).includes(m)) { let n = o; while (n && !/^Pearl (\w+)$/.test(n.name)) n = n.parent; id = n ? n.name.slice(6) : id; } }); return id; };
  const all = membranes(fam); assert(all.length >= 4, `membrane materials found (${all.length})`);
  const soft = all.filter((m) => !coredSkin.has(tierOf(m))), cored = all.filter((m) => coredSkin.has(tierOf(m)));
  assert(soft.length && cored.length, `a soft and a cored pool (${soft.length} / ${cored.length})`);
  for (const m of all) assert.equal(heatOf(m), 0, 'cold before any seat');

  // THE GAME'S ORDER (src/td-tab.js pilotHost.thermal): the base's heat over the family's roots first, then the family's own
  const base = createThermalHeat(() => ({ warm: fam.roots(), hot: [] }), { every: 1e9 });
  base.set(true); fam.thermal(true);
  for (const m of cored) assert.equal(heatOf(m), 1, 'in the seat a cored tier\'s skin runs hot');
  for (const m of soft) assert.equal(heatOf(m), 0, 'and a soft tier\'s stays cold');
  base.set(true);   // the base's slow re-apply (every second while the seat is on) must not take the family's skins to warm
  for (const m of cored) assert.equal(heatOf(m), 1, 'the base\'s re-apply leaves the hot skin hot');
  for (const m of soft) assert.equal(heatOf(m), 0, 'and the cold skin cold');
  // a pool made while the seat is on (a tier's first body during the pass) takes the seat's state
  fam.add('rolling', { x: 20, z: 0, angle: 0, speed: 12 });
  const umber = membranes(fam).filter((m) => tierOf(m) === 'brown'); assert(umber.length, 'the umber pool was made');
  for (const m of umber) assert.equal(heatOf(m), 1, 'a cored pool made in the seat is hot');
  fam.add('ghost', { x: 30, z: 0, angle: 0, speed: 12 });
  for (const m of membranes(fam).filter((m) => tierOf(m) === 'yellow')) assert.equal(heatOf(m), 0, 'a soft pool made in the seat is cold');

  // leaving the seat, in the game's order: the base's restore, then the family's
  base.set(false); fam.thermal(false);
  for (const m of membranes(fam)) assert.equal(heatOf(m), 0, `after the seat every membrane is cold again (${tierOf(m)} read ${heatOf(m)}: the white amethyst)`);
  for (const m of membranes(fam)) assert.equal(m.emissiveIntensity, 1, 'and its intensity is the kit\'s');
  // a second seat and leave: the same
  base.set(true); fam.thermal(true); base.set(false); fam.thermal(false);
  for (const m of membranes(fam)) assert.equal(heatOf(m), 0, 'a second seat leaves them cold too');
  base.dispose(); fam.dispose();
}
console.log('PASS Pearl thermal: one writer of the membranes\' heat, cored hot and soft cold in the seat, every skin cold again after it, a pool made in the seat takes its state');
