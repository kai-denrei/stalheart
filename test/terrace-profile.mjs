import assert from 'node:assert/strict';
import { drop, terraceFloor, terraceLevel, terraceAltitude } from '../src/core/terrace-profile.js';
const R = 753, opts = { radius: R, padRadius: 46, step: 2, clearRadius: 150, blend: 20 };
assert.equal(drop(0, R), 0);
assert.ok(Math.abs(drop(64, R) - 2.723) < 0.01, 'drop at 64 m');
assert.equal(terraceLevel(0, opts), 0);
assert.equal(terraceLevel(45.9, opts), 0);
assert.ok(terraceLevel(60, opts) >= 1);
assert.equal(terraceFloor(0, opts), terraceFloor(45, opts), 'pad is one plane');
let prev = 1;
for (let d = 0; d <= 150; d += 0.5) { const f = terraceFloor(d, opts); assert.ok(f <= prev + 1e-9, `floor non-increasing at ${d}`); prev = f; }
for (let d = 0; d <= 150; d += 0.25) {
  const a = terraceAltitude(d, opts);
  assert.ok(Math.abs(a) <= opts.step / 2 + 1e-9 || d < opts.padRadius, `cut/fill bounded at ${d}: ${a}`);
}
assert.ok(Math.abs(terraceAltitude(20, opts)) <= drop(46, R) / 2 + 1e-9, 'pad cut/fill bounded');
assert.equal(terraceAltitude(171, opts), 0);
assert.equal(terraceAltitude(500, opts), 0);
assert.ok(Math.abs(terraceAltitude(160, opts)) < Math.abs(terraceAltitude(149.9, opts)), 'blend fades');
console.log('Terrace profile: pad plane, non-increasing bands, bounded cut/fill, blend to sphere.');
