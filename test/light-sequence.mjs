// light-sequence.mjs — the ARC-01's magnets light one by one (owner, 2026-10-19, third round, note 5: "the magnets should light up in cyan
// one by one, not all at a time"): the pure row, and the real launcher's gates sorted into sixteen equal groups along its rail
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lightLevels, sequenceSeconds, arcIndex } from '../src/domain/light-sequence.js';
import { LAUNCHER_LIGHTS } from '../src/content/orbital-works.js';
import { LAUNCH } from '../src/fx/arc-launch.js';

const { magnets, step, ramp } = LAUNCHER_LIGHTS;
assert.deepEqual([magnets, step, ramp], [16, 0.25, 0.15]);
const near = (a, b) => Math.abs(a - b) < 1e-9;

// before the sequence every light is dark, after it every light is full
assert.ok(lightLevels(-0.01, magnets, step, ramp).every((v) => v === 0), 'dark before the start');
assert.ok(lightLevels(sequenceSeconds(magnets, step, ramp) + 1e-9, magnets, step, ramp).every((v) => v === 1), 'all full at the end');   // + 1e-9: 3.9 - 3.75 is not 0.15 in binary
assert.ok(near(sequenceSeconds(magnets, step, ramp), 3.9), 'sixteen at 0.25 s with a 0.15 s ramp: 3.9 s');
assert.ok(sequenceSeconds(magnets, step, ramp) <= LAUNCH.start - LAUNCH.chargeAt, `all sixteen magnets are lit before the release: the sequence (${sequenceSeconds(magnets, step, ramp)} s) fits the charge window (${LAUNCH.start - LAUNCH.chargeAt} s, LAUNCH.chargeAt to LAUNCH.start)`);
assert.equal(sequenceSeconds(1, step, ramp), ramp);
// ONE BY ONE: light i starts at i*step and is full ramp seconds later; the next one has not started yet when it is full
{ const at = (t) => lightLevels(t, magnets, step, ramp);
  for (let i = 0; i < magnets; i++) {
    const s = i * step;
    assert.equal(at(s)[i], 0, `light ${i} starts at ${s}`);
    assert.ok(Math.abs(at(s + ramp / 2)[i] - 0.5) < 1e-6, `light ${i} is half lit half way up its ramp`);
    assert.ok(at(s + ramp)[i] > 1 - 1e-9, `light ${i} full at ${s + ramp}`);
    if (i + 1 < magnets) assert.equal(at(s + ramp)[i + 1], 0, `light ${i + 1} still dark when light ${i} is full`);
  }
  // mid-sequence (1.6 s): six lit, the seventh (started at 1.5 s) two thirds up, nine dark; never out of order
  const mid = at(1.6);
  assert.deepEqual(mid.map((v) => +v.toFixed(3)), [1, 1, 1, 1, 1, 1, 0.667, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  for (let t = -0.5; t < 4.5; t += 0.05) { const v = at(t); for (let i = 1; i < magnets; i++) assert.ok(v[i] <= v[i - 1], `ordered at ${t}`); }
}
// a zero ramp is a switch; an `out` array is reused
{ const out = new Array(3); assert.equal(lightLevels(0.5, 3, 0.5, 0, out), out); assert.deepEqual(out, [1, 1, 0]); }

// arcIndex: the rail's arc (src/fx/arc-launch.js railPose: centre at y 2.6 + radius, z -20; sweep 1.05 rad), sixteen gates evenly spaced on it
const centre = [2.6 + 40, -20], sweep = 1.05;
for (let i = 0; i < magnets; i++) { const a = i * sweep / (magnets - 1); assert.equal(arcIndex(2.6 + 40 * (1 - Math.cos(a)), -20 + 40 * Math.sin(a), centre, sweep, magnets), i, `gate ${i} on the rail`); }
assert.equal(arcIndex(0, -30, centre, sweep, magnets), 0, 'behind the breech: the first');
assert.equal(arcIndex(40, 30, centre, sweep, magnets), magnets - 1, 'past the rail exit: the last');
assert.equal(arcIndex(1, 2, centre, sweep, 1), 0);

// THE REAL GATES: the pinned lod1 launcher's PASSAGE_GATES mesh (one merged mesh, one material, no node per gate) sorts into sixteen groups
// of equal size, three parts each (two side blocks and the crossbar); its ACCELERATOR_LIGHTS put two status lights on every gate
{ const b = readFileSync(new URL('../assets/models/astro/arc01_launcher_d0_lod1.glb', import.meta.url));
  const len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()), bin = 20 + len + 8;
  const read = (ai) => { const a = j.accessors[ai], v = j.bufferViews[a.bufferView], n = { SCALAR: 1, VEC3: 3 }[a.type], [size, fn] = { 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'], 5123: [2, 'readUInt16LE'] }[a.componentType];
    const at = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = v.byteStride ?? size * n; return Array.from({ length: a.count }, (_, k) => Array.from({ length: n }, (_, c) => b[fn](at + k * stride + c * size))); };
  const groups = (name) => { const node = j.nodes.find((x) => x.name === name), p = j.meshes[node.mesh].primitives[0], pos = read(p.attributes.POSITION), idx = read(p.indices).map((r) => r[0]);
    const count = new Array(magnets).fill(0);
    for (let t = 0; t < idx.length; t += 3) { const y = (pos[idx[t]][1] + pos[idx[t + 1]][1] + pos[idx[t + 2]][1]) / 3, z = (pos[idx[t]][2] + pos[idx[t + 1]][2] + pos[idx[t + 2]][2]) / 3; count[arcIndex(y, z, centre, sweep, magnets)]++; }
    return count; };
  const gates = groups('PASSAGE_GATES');
  assert.ok(gates.every((n) => n === gates[0] && n > 0), `sixteen equal gates (${gates})`);
  const lights = groups('ACCELERATOR_LIGHTS');
  assert.ok(lights.every((n) => n > 0), `every gate has its lights (${lights})`);
}
console.log('light-sequence: ok');
