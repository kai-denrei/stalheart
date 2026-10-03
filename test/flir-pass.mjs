// flir-pass — the WebGL ironbow is the SVG filter it replaces (index.html #flir): the same 11-step tables, linear between steps, and
// the pass lends itself the composer on a board that runs without one, handing it back after.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IRONBOW, ironbow, FlirShader, createFlir } from '../src/fx/flir-pass.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
for (const [c, f] of [['r', 'feFuncR'], ['g', 'feFuncG'], ['b', 'feFuncB']]) {
  const svg = html.match(new RegExp(`<${f} type="table" tableValues="([^"]+)"`))[1].trim().split(/\s+/).map(Number);
  assert.deepEqual([...IRONBOW[c]], svg, `${c}: the shader's table is index.html's #flir table`);
  for (const v of svg) assert(FlirShader.fragmentShader.includes(v.toFixed(3)), `${c} ${v} is in the GLSL`);
}
assert.deepEqual(ironbow(0), [0.02, 0.008, 0.102]); assert.deepEqual(ironbow(1), [1, 1, 1]);
const mid = ironbow(0.55); assert(Math.abs(mid[0] - (0.910 + 0.973) / 2) < 1e-9, 'linear between two steps');
assert.deepEqual(ironbow(-1), ironbow(0)); assert.deepEqual(ironbow(2), ironbow(1));

// the composer is borrowed on a board without one, and given back
let enabled = false; const passes = [];
const postfx = { addFinalPass: (p) => passes.push(p), setEnabled: (v) => { enabled = v; }, get enabled() { return enabled; } };
const flir = createFlir(postfx);
assert.equal(passes.length, 1); assert.equal(passes[0].enabled, false, 'added off');
flir.set(true); assert(passes[0].enabled && enabled && flir.on, 'thermal on: the pass and the composer run');
flir.set(false); assert(!passes[0].enabled && !enabled && !flir.on, 'off again: the board goes back to no composer');
enabled = true; flir.set(true); flir.set(false); assert.equal(enabled, true, 'a board with its own composer keeps it');
assert.equal(createFlir(null).on, false, 'no postfx, no pass, no crash');
console.log('FLIR pass: the SVG ironbow as a WebGL pass after the OutputPass, the composer lent and returned.');
