import assert from 'node:assert/strict';
import { EXPLOSION_MODULES, EXPLOSION_USES, EXPLOSION_SCARE, EXPLOSION_PALETTE, EXPLOSION_CAPS } from '../src/content/explosions.js';

assert.deepEqual(Object.keys(EXPLOSION_USES).sort(),
  ['gunship.bofors', 'gunship.heavy', 'gunship.nuke', 'gunship.rotary', 'laser.contact', 'laser.ignite', 'laser.smoke', 'quiver.talon', 'strike.orbital', 'tank.shell']);
// THE MK-9's YIELD (2026-09-16): a mini nuke, not a shell. Bigger than the 105 it replaced, short of the strike from orbit, and the
// swarm scatters wider and longer from it than from anything else the seat can fire.
{
  const metres = (use) => EXPLOSION_USES[use].scale * { 'howitzer-blast': 32, 'orbital-strike': 90 }[EXPLOSION_USES[use].module];
  assert.ok(metres('gunship.nuke') > metres('gunship.heavy') * 1.4, `the nuke out-yields the 105 (${metres('gunship.nuke')} m vs ${metres('gunship.heavy')} m)`);
  assert.ok(metres('gunship.nuke') < metres('strike.orbital'), 'the orbital strike is still the bigger set piece');
  assert.ok(EXPLOSION_SCARE['gunship.nuke'].cells > EXPLOSION_SCARE['gunship.heavy'].cells
    && EXPLOSION_SCARE['gunship.nuke'].seconds > EXPLOSION_SCARE['gunship.heavy'].seconds, 'and scatters the swarm wider and for longer');
}
for (const [use, spec] of Object.entries(EXPLOSION_USES)) {
  assert.ok(EXPLOSION_MODULES.includes(spec.module), `${use}: unknown module ${spec.module}`);
  assert.ok(spec.scale > 0 && spec.scale <= 2, `${use}: scale ${spec.scale}`);
}
assert.deepEqual(Object.keys(EXPLOSION_PALETTE), ['white', 'hot', 'warm', 'ember', 'smoke', 'soot']);
for (const hex of Object.values(EXPLOSION_PALETTE)) assert.match(hex, /^#[0-9a-f]{6}$/);
assert.deepEqual(EXPLOSION_CAPS, { small: 20, medium: 4, large: 2, nuclear: 1 });
for (const name of EXPLOSION_MODULES) {
  const mod = await import(`../src/fx/explosions/${name}.js`);
  assert.ok(EXPLOSION_CAPS[mod.meta.size] >= 1, `${name}: no cap for size ${mod.meta.size}`);
}
console.log('Explosion content: every use names a pinned module; caps cover every size.');
