import assert from 'node:assert/strict';
import { makeKick, startKick, stepKick, kicking, planKick, glideHeading } from '../src/domain/hover-kick.js';
import { TANK_KICK } from '../src/content/tank.js';
const n = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const k = makeKick(), a = n([0, 1, 0]), b = n([0.01, 1, 0]);
assert.equal(stepKick(k, 0.1, TANK_KICK), null, 'idle: no point');
assert.ok(startKick(k, { from: a, to: b, side: -1 }, TANK_KICK)); assert.ok(kicking(k));
assert.equal(startKick(k, { from: a, to: b }, TANK_KICK), false, 'one at a time');
let p, maxRoll = 0;
for (let t = 0; t < TANK_KICK.seconds + 0.05; t += 1 / 60) { p = stepKick(k, 1 / 60, TANK_KICK) ?? p; maxRoll = Math.max(maxRoll, Math.abs(k.roll)); }
assert.ok(Math.hypot(p[0] - b[0], p[1] - b[1], p[2] - b[2]) < 1e-9, 'ends on the checked point');
assert.ok(maxRoll > TANK_KICK.roll * 0.3, 'the hull rolls'); assert.equal(k.roll, 0, 'and comes back level');
assert.equal(kicking(k), false); assert.equal(startKick(k, { from: a, to: b }, TANK_KICK), false, 'cooling down');
stepKick(k, TANK_KICK.cool + 0.01, TANK_KICK); assert.ok(startKick(k, { from: a, to: b }, TANK_KICK), 'then again');
// where a head-on hit kicks to: off the wall (away from it) and along it, checked free; nothing for a glancing hit
{ const pos = [0, 1, 0], k0 = planKick({ pos, heading: [1, 0, 0], toWall: [1, 0, 0], slid: [0, 0, 0.01], share: 0.95, cellSide: 0.01, blocked: () => false }, TANK_KICK);
  assert.ok(k0 && k0.to[0] < 0 && k0.to[2] > 0, `off the wall and along it (${k0 && k0.to})`);
  assert.equal(planKick({ pos, heading: [1, 0, 0], toWall: [1, 0, 0], slid: [0, 0, 0.01], share: 0.2, cellSide: 0.01, blocked: () => false }, TANK_KICK), null, 'a glancing hit slides');
  assert.equal(planKick({ pos, heading: [1, 0, 0], toWall: [1, 0, 0], slid: [0, 0, 0.01], share: 0.95, cellSide: 0.01, blocked: () => true }, TANK_KICK), null, 'nowhere free: no kick'); }
// the glide: a shallow approach turns toward the wall's tangent; a square-on one is left to the kick
{ const pos = [0, 1, 0], shallow = (() => { const a = 0.4; return [Math.sin(a), 0, Math.cos(a)]; })(), toWall = [1, 0, 0];
  const h = glideHeading(pos, shallow, toWall, 0.1, TANK_KICK); assert.ok(h[0] < shallow[0], `it turns off the wall (${h[0]} < ${shallow[0]})`);
  assert.deepEqual(glideHeading(pos, [1, 0, 0], toWall, 0.1, TANK_KICK), [1, 0, 0], 'square on: the kick takes it');
  assert.deepEqual(glideHeading(pos, [-1, 0, 0], toWall, 0.1, TANK_KICK), [-1, 0, 0], 'driving away: nothing'); }
console.log('hover-kick: one eased kick off the wall, a roll that settles, one at a time with a cool-down.');
