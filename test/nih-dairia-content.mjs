import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NIH_DAIRIA_MOTION, NIH_DAIRIA_PREDATOR, NIH_DAIRIA_PREDATOR_SIZE_METRES, NIH_DAIRIA_VARIANT, NIH_DAIRIA_SIZE_METRES, NIH_DAIRIA_LOOK, NIH_DAIRIA_MODELS } from '../src/content/nih-dairia.js';
const lock = JSON.parse(fs.readFileSync(new URL('../docs/nih-dairia-assets.lock.json', import.meta.url), 'utf8'));
const locked = new Set(lock.files.map((f) => f.path));
for (const [variant, { bin, json }] of Object.entries(NIH_DAIRIA_MODELS)) {
  for (const p of [bin, json]) { assert.ok(fs.existsSync(new URL('../' + p, import.meta.url)), `${variant}: ${p} on disk`); assert.ok(locked.has(p), `${variant}: ${p} in the lock`); }
  const manifest = JSON.parse(fs.readFileSync(new URL('../' + json, import.meta.url), 'utf8'));
  assert.ok(manifest.layout.positions.length > 0, `${variant}: a manifest with positions`);
  const bytesPer = { Float32Array: 4, Uint32Array: 4, Float64Array: 8 };
  let farthest = 0;
  for (const [name, e] of Object.entries(manifest.layout)) {
    assert.ok(bytesPer[e.type], `${variant}: ${name} has a known type (${e.type})`);
    farthest = Math.max(farthest, e.offset + e.length * bytesPer[e.type]);
  }
  assert.ok(fs.statSync(new URL('../' + bin, import.meta.url)).size >= farthest, `${variant}: the .bin reaches the manifest's farthest slice end (${farthest})`);
}
assert.ok(NIH_DAIRIA_MODELS[NIH_DAIRIA_VARIANT], 'the default variant has a model');
assert.equal(Object.keys(NIH_DAIRIA_MOTION).length, 14, 'fourteen motion settings');
for (const [k, v] of Object.entries(NIH_DAIRIA_MOTION)) assert.ok(Number.isFinite(v) && v > 0, `${k} is a positive number`);
assert.deepEqual(NIH_DAIRIA_MOTION, {
  speed: 0.1, reachTime: 10, pullTime: 2, pauseTime: 1.25, erratic: 2, stretch: 5, spread: 3.5,
  stepHeight: 0.032, stepDuration: 0.12, stepSpacing: 0.035, stride: 0.022, recoil: 1, grip: 1.5, sweep: 1,
}, "the owner's preset pasted from the boss lab on 2026-10-08 (slower by default)");
// the bait mode's predator: the slower preset with the pursuit and the arms turned up, every value inside the panel's range
const { MOTION_CONTROLS } = await import('../src/fx/nih-dairia/motion-settings.js');
assert.deepEqual(NIH_DAIRIA_PREDATOR, { ...NIH_DAIRIA_MOTION, speed: 1.2, reachTime: 5, pullTime: 3, pauseTime: 0.8, erratic: 3, stretch: 5, spread: 4.5, sweep: 4, grip: 3 }, "the predator preset (spec item 4, the owner's reach duration 5, reach sweep 4, foot grip 3 of 2026-10-09; wave B's base chase speed 1.2, the owner's 3 the lunge's)");
for (const c of MOTION_CONTROLS) assert.ok(NIH_DAIRIA_PREDATOR[c.key] >= c.min && NIH_DAIRIA_PREDATOR[c.key] <= c.max, `predator ${c.key} ${NIH_DAIRIA_PREDATOR[c.key]} inside the panel's ${c.min}..${c.max}`);
assert.ok(NIH_DAIRIA_PREDATOR.speed > NIH_DAIRIA_MOTION.speed && NIH_DAIRIA_PREDATOR.pauseTime < NIH_DAIRIA_MOTION.pauseTime && NIH_DAIRIA_PREDATOR.pullTime > NIH_DAIRIA_MOTION.pullTime, 'faster, longer surges, shorter pauses than the slower preset');
assert.ok(Object.isFrozen(NIH_DAIRIA_PREDATOR));
assert.equal(NIH_DAIRIA_SIZE_METRES, 30);
assert.equal(NIH_DAIRIA_PREDATOR_SIZE_METRES, 40, "the bait mode's size, the owner's 40 m");
assert.deepEqual(NIH_DAIRIA_LOOK, {
  pale: '#b8b99a', dark: '#374237', roughness: 0.26, metalness: 0, transmission: 0.65, thickness: 0.012, ior: 1.37,
  attenuationColor: '#939b72', attenuationDistance: 0.035, clearcoat: 0.65, clearcoatRoughness: 0.16,
  preyRed: '#c94d38', preyEmissive: '#751e16',
}, 'the look as the content module defines it');
assert.ok(Object.isFrozen(NIH_DAIRIA_MOTION) && Object.isFrozen(NIH_DAIRIA_LOOK) && Object.isFrozen(NIH_DAIRIA_MODELS));
assert.ok(NIH_DAIRIA_LOOK.transmission >= 0 && NIH_DAIRIA_LOOK.transmission <= 1);
console.log('Nih-Dairia content: four models on disk and locked, fourteen settings, the predator preset inside the panel, the look in range.');
