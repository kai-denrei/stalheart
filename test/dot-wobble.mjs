// The wobble constants are shared by the JS re-pose (creatures.waveJelly) and
// the GLSL one (fx/dot-material). These tests exist because the GLSL half
// cannot be run in Node: if the two ever drift, the game and the lab show
// different creatures and nothing fails. So the numbers live in content, both
// sides read them, and the JS side is pinned against goldens captured BEFORE
// the constants were extracted — a refactor that changes a creature's motion
// by a millimetre fails here.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CREATURES, waveJelly, swimWave, cloudFormPoints } from '../src/creatures.js';
import { DOT_WOBBLE, DOT_SWIM, wobbleGlsl, reachGlsl, swimGlsl } from '../src/content/dot-wobble.js';

const base = CREATURES.amoeba();
const out = new Float32Array(base.length * 3);
const at = (i) => [...out.slice(i, i + 3)].map((v) => +v.toFixed(9));

// captured from the implementation as it stood before the extraction
const GOLDEN = [
  [0, [0.040506866, 0.702482164, 0], [0.17067939, 0.392027467, 0.48947531]],
  [0.37, [0.041579287, 0.815740407, -0.00463435], [0.179642975, 0.455232382, 0.375222325]],
  [1.25, [0.050790895, 0.630210102, -0.019992646], [0.364761025, 0.351695269, 0.42393142]],
  [4.9, [0.004816245, 0.809424162, -0.047620017], [0.395678192, 0.451707542, -0.094617061]],
];

test('waveJelly is unchanged by the constant extraction', () => {
  assert.equal(base.length, 692);
  for (const [t, first, mid] of GOLDEN) {
    waveJelly(base, t, out);
    assert.deepEqual(at(0), first, `t=${t} first point`);
    assert.deepEqual(at(300), mid, `t=${t} mid point`);
  }
});

test('the reach pseudopod is unchanged', () => {
  waveJelly(base, 2.0, out, { reachAmt: 0.6, reachDir: [0, 1, 0] });
  assert.deepEqual(at(0), [0.055773705, 1.08585453, -0.038156845]);
  assert.deepEqual(at(300), [0.458968103, 0.385288447, 0.338367343]);
});

test('a zero reach is the same as no reach at all', () => {
  waveJelly(base, 1.1, out); const plain = [...out];
  waveJelly(base, 1.1, out, { reachAmt: 0, reachDir: [0, 1, 0] });
  assert.deepEqual([...out], plain);
});

test('every constant the GLSL needs is a finite number', () => {
  for (const [k, v] of Object.entries(DOT_WOBBLE)) {
    assert.equal(typeof v, 'number', `${k} must be a number`);
    assert.ok(Number.isFinite(v), `${k} must be finite`);
  }
});

// The generated shader must carry the SAME numbers. Comparing the emitted
// source against the constants is the only check available without a GPU,
// and it catches the failure that matters: a constant edited in content and
// silently not reaching one of the two consumers.
test('the generated GLSL carries every constant verbatim', () => {
  const src = wobbleGlsl() + reachGlsl();   // the reach is a second snippet; together they must spend every constant
  for (const [k, v] of Object.entries(DOT_WOBBLE)) {
    assert.ok(src.includes(v.toFixed(4)), `${k}=${v} is missing from the shader`);
  }
  assert.ok(src.includes('uT'), 'the shader must read the time uniform');
  // GLSL has no implicit int->float: a bare "3" where a float is wanted is a
  // compile error on some drivers, and a headless run would not catch it.
  assert.ok(!/[^.\d]\d+\s*\*\s*atan/.test(src), 'literals must be floats');
});

// The swimmers are the only CPU re-pose left in gameplay (scoutufo, shellback),
// so their port carries the same drift risk and the same golden treatment.
const swimBase = cloudFormPoints('bacterium', 170);
const swimOut = new Float32Array(swimBase.length * 3);
const swimAt = (i) => [...swimOut.slice(i, i + 3)].map((v) => +v.toFixed(9));
const SWIM_OPTS = (() => {
  let zMin = Infinity, zMax = -Infinity;
  for (const p of swimBase) { if (p[2] < zMin) zMin = p[2]; if (p[2] > zMax) zMax = p[2]; }
  return { amp: 0.26, beat: 7.0, along: 4.0, jelly: 0.10, zMin, zMax };   // units.js SWIM.scoutufo
})();

test('swimWave is unchanged by the constant extraction', () => {
  const GOLD = [
    [0, [-0.426727891, 0.387153953, 0.008088645], [-0.177613243, 0.314270258, -0.143255934]],
    [0.8, [-0.505653262, 0.420957655, 0.007757082], [-0.269398123, 0.34171021, -0.137383714]],
    [3.3, [-0.519993424, 0.416106254, 0.007802171], [-0.17566438, 0.337772131, -0.138182282]],
  ];
  for (const [t, first, mid] of GOLD) {
    swimWave(swimBase, t, swimOut, SWIM_OPTS);
    assert.deepEqual(swimAt(0), first, `t=${t} first point`);
    assert.deepEqual(swimAt(150), mid, `t=${t} mid point`);
  }
});

test('swimWave falls back to the content defaults', () => {
  swimWave(swimBase, 1.0, swimOut, {});
  const withDefaults = [...swimOut];
  swimWave(swimBase, 1.0, swimOut, { ...DOT_SWIM });
  assert.deepEqual([...swimOut], withDefaults, 'omitted options must equal DOT_SWIM');
});

test('the swim shader carries its structural constant', () => {
  const src = swimGlsl();
  assert.ok(src.includes(DOT_SWIM.pulseFreq.toFixed(4)), 'pulseFreq missing from the shader');
  assert.ok(src.includes('uSwim') && src.includes('uSpan'), 'per-creature values must be uniforms');
  // the head barely moves: the falloff is squared, not linear
  assert.ok(src.includes('(1.0 - u) * (1.0 - u)'), 'tailward falloff must stay squared');
});
