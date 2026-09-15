import assert from 'node:assert/strict';
import { EXPLOSION_MODULES, EXPLOSION_USES, EXPLOSION_PALETTE, EXPLOSION_CAPS } from '../src/content/explosions.js';

assert.deepEqual(Object.keys(EXPLOSION_USES).sort(),
  ['gunship.bofors', 'gunship.heavy', 'gunship.rotary', 'laser.contact', 'laser.ignite', 'laser.smoke', 'quiver.talon', 'strike.orbital', 'tank.shell']);
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
