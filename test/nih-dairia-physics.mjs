import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCage } from '../src/fx/nih-dairia/cage-model.js';
import { SoftBody } from '../src/fx/nih-dairia/soft-body.js';
import { PHYS } from '../src/fx/nih-dairia/constants.js';
import { FixedStepper } from '../src/fx/nih-dairia/fixed-step.js';
const load = (name) => { const b = fs.readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.bin`, import.meta.url)); const m = JSON.parse(fs.readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.json`, import.meta.url), 'utf8')); return parseCage(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), m); };
const run = (body, steps) => { for (let i = 0; i < steps; i++) { body.step(PHYS.step); assert.ok(body.isFinite(), `finite at step ${i}`); } body.updateSurface(); };
const wasm = new SoftBody(load('nih-dairia')); assert.ok(wasm.kernel, 'the WebAssembly kernel compiled in node');
run(wasm, 200);
assert.ok(wasm.grounded, 'settled on the floor'); assert.ok(wasm.contact.some((v) => v > 0), 'contacts');
assert.ok(Math.abs(wasm.volumeRatio() - 1) < 0.05, `volume kept (${wasm.volumeRatio()})`);
const js = new SoftBody(load('nih-dairia')); js.kernel = null; run(js, 200);
assert.ok(js.center.distanceTo(wasm.center) < 0.001, `kernel and JS agree on the centre (${js.center.distanceTo(wasm.center)} m)`);
const clock = new FixedStepper(PHYS.step); let n = 0;
assert.equal(clock.advance(1 / 60, () => n++), 4); assert.equal(n, 4);
// a one-second frame is clamped to 50 ms, which is exactly 12 steps at 240 Hz (fixed-step.js also caps the loop at 12)
assert.equal(clock.advance(1, () => n++), 12, 'the 50 ms clamp caps the steps at 12');
console.log('Nih-Dairia physics: parses, settles, keeps volume, kernel and JS agree, the stepper clamps.');
