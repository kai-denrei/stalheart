// light-sequence.mjs — the ARC-01's magnets light with the payload (owner, 2026-11-05, round 7, note 6: NOT on at the beginning, they light up
// with the payload moving; keeping 2026-10-19's "one by one, not all at a time"): the pure wave, the launch's glow per phase, and the real
// launcher's gates sorted into sixteen equal groups along its rail
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lightsBySled, arcIndex } from '../src/domain/light-sequence.js';
import { LAUNCHER_LIGHTS } from '../src/content/orbital-works.js';
import { LAUNCH, launchState, magnetGlow } from '../src/fx/arc-launch.js';
import { STRUCTURES } from '../src/content/base-layout.js';

const { magnets, ahead, trail, peak, breech, idle } = LAUNCHER_LIGHTS;
assert.deepEqual([magnets, ahead, trail, peak, breech, idle], [16, 2, 3, 2, 0.15, 0]);

// THE WAVE: nothing lit before the sled moves; the head and `ahead` past it full, `trail` behind fading a step each, the rest dark
assert.ok(lightsBySled(-1, magnets).every((v) => v === 0), 'nothing lit before the sled moves');
assert.deepEqual(lightsBySled(0, magnets, { ahead, trail }), [1, 1, 1, ...new Array(13).fill(0)], 'at the breech: the sled\'s gate and two past it');
assert.deepEqual(lightsBySled(8, magnets, { ahead, trail }), [0, 0, 0, 0, 0, 0.25, 0.5, 0.75, 1, 1, 1, 0, 0, 0, 0, 0], 'mid rail: three full, three fading behind, the breech dark');
assert.deepEqual(lightsBySled(15, magnets, { ahead, trail }), [...new Array(12).fill(0), 0.25, 0.5, 0.75, 1], 'at the exit: the last gate full, the trail behind it');
for (let i = 0; i < magnets; i++) { const v = lightsBySled(i, magnets, { ahead, trail }); assert.equal(v.filter((x) => x === 1).length, Math.min(ahead + 1, magnets - i), `head ${i}: the full ones`); for (let k = 0; k < magnets; k++) if (k < i - trail || k > i + ahead) assert.equal(v[k], 0, `head ${i}: ${k} dark`); }
{ const out = new Array(4); assert.equal(lightsBySled(1, 4, { ahead: 0, trail: 1 }, out), out); assert.deepEqual(out, [0.5, 1, 0, 0]); }

// THE LAUNCH (src/fx/arc-launch.js magnetGlow on the choreography's own states): dark through the loading, only the breech's faint glow over
// the charge, the wave rides the sled's own arc index up the rail, all fall together after the release and are dark 2 s after it
const RELEASE = LAUNCH.start + LAUNCH.seconds, glow = (t) => magnetGlow(launchState(t));
for (let t = 0; t < LAUNCH.chargeAt; t += 0.25) assert.ok(glow(t).every((v) => v === idle), `dark while loading (${t} s)`);
for (let t = LAUNCH.chargeAt; t < LAUNCH.start; t += 0.1) { const g = glow(t); assert.ok(g[0] <= breech + 1e-9 && g.slice(1).every((v) => v === idle), `the charge: only the breech glows, faintly (${t.toFixed(1)} s: ${g})`); }
assert.ok(Math.abs(glow(LAUNCH.start - 1e-6)[0] - breech) < 1e-3, 'the breech at its glow as the sled moves');
{ let lastHead = -1;
  for (let t = LAUNCH.start; t < RELEASE; t += 0.01) {
    const s = launchState(t), head = arcIndex(s.sled.position[1], s.sled.position[2], [2.6 + LAUNCH.radius, -20], LAUNCH.sweep, magnets), g = magnetGlow(s);
    assert.ok(head >= lastHead, `the wave only climbs (${t.toFixed(2)} s)`); lastHead = head;
    assert.equal(g[head], peak, `the sled's own gate burns (${t.toFixed(2)} s, gate ${head})`);
    assert.ok(g.every((v, i) => i <= head + ahead || v === 0), `nothing lit ahead of the wave (${t.toFixed(2)} s)`);
  }
  assert.equal(lastHead, magnets - 1, 'the wave reaches the exit before the release'); }
{ const t = LAUNCH.start + LAUNCH.seconds * Math.SQRT1_2, g = glow(t);   // half way up the rail's arc (u = ((t - start) / seconds)^2 = 0.5)
  assert.equal(g.filter((v) => v >= 0.9 * peak).length, 3, `mid acceleration: exactly three burn (${g})`);
  assert.ok(g.slice(0, 3).every((v) => v < 0.3 * peak), `mid acceleration: the breech is dark again (${g})`); }
{ const a = glow(RELEASE + 0.5), b = glow(RELEASE + 1.5); assert.ok(Math.max(...b) < Math.max(...a) && Math.max(...a) < peak, 'after the release they fall together'); }
for (const t of [RELEASE + 2, RELEASE + 3, 20, 29]) assert.ok(glow(t).every((v) => v === idle), `dark 2 s after the release and on (${t} s)`);
// THE STANDING LAUNCHER: its two meshes are set dark on the base (base-layout's `dark`, src/fx/story-base.js mount)
assert.deepEqual(STRUCTURES.find((s) => s.id === 'launcher').dark, ['PASSAGE_GATES', 'ACCELERATOR_LIGHTS']);

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
