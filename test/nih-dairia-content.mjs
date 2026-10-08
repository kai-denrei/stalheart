import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NIH_DAIRIA_MOTION, NIH_DAIRIA_VARIANT, NIH_DAIRIA_SIZE_METRES, NIH_DAIRIA_LOOK, NIH_DAIRIA_MODELS } from '../src/content/nih-dairia.js';
const lock = JSON.parse(fs.readFileSync(new URL('../docs/nih-dairia-assets.lock.json', import.meta.url), 'utf8'));
const locked = new Set(lock.files.map((f) => f.path));
for (const [variant, { bin, json }] of Object.entries(NIH_DAIRIA_MODELS)) {
  for (const p of [bin, json]) { assert.ok(fs.existsSync(new URL('../' + p, import.meta.url)), `${variant}: ${p} on disk`); assert.ok(locked.has(p), `${variant}: ${p} in the lock`); }
  const manifest = JSON.parse(fs.readFileSync(new URL('../' + json, import.meta.url), 'utf8'));
  assert.ok(manifest.layout.positions.length > 0, `${variant}: a manifest with positions`);
}
assert.ok(NIH_DAIRIA_MODELS[NIH_DAIRIA_VARIANT], 'the default variant has a model');
assert.equal(Object.keys(NIH_DAIRIA_MOTION).length, 14, 'fourteen motion settings');
for (const [k, v] of Object.entries(NIH_DAIRIA_MOTION)) assert.ok(Number.isFinite(v) && v > 0, `${k} is a positive number`);
assert.ok(Number.isFinite(NIH_DAIRIA_SIZE_METRES) && NIH_DAIRIA_SIZE_METRES > 0);
assert.ok(Object.isFrozen(NIH_DAIRIA_MOTION) && Object.isFrozen(NIH_DAIRIA_LOOK) && Object.isFrozen(NIH_DAIRIA_MODELS));
assert.ok(NIH_DAIRIA_LOOK.transmission >= 0 && NIH_DAIRIA_LOOK.transmission <= 1);
console.log('Nih-Dairia content: four models on disk and locked, fourteen settings, the look in range.');
