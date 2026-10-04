import assert from 'node:assert/strict';
import { autoEarned, densestTarget, countdownTimes } from '../src/domain/laser-auto.js';
import { LASER_AUTO } from '../src/content/orbital-laser.js';
import { BRIEFS } from '../src/isaobriefs.js';

assert.equal(autoEarned(1, 2), false, 'one manned pass is not enough');
assert.equal(autoEarned(2, 2), true, 'two manned passes earn the automation');
assert.equal(LASER_AUTO.afterManned, 2, 'the owner\'s number: the first two are manual');
assert.ok(LASER_AUTO.retarget > 0 && LASER_AUTO.retarget < 3, 'the beam re-aims a few times a second');
for (const id of [LASER_AUTO.brief, LASER_AUTO.calibrated]) assert.ok(BRIEFS[id], `Isao has the line ${id}`);

// a unit sphere 1000 m round: a pile of five within a 12 m footprint and three stragglers far apart
const unit = (a, b) => [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)];
const m = 1000, step = 4 / m;
const pile = [0, 1, 2, 3, 4].map((k) => ({ pos: unit(1 + k * step * 0.3, 0.2 + (k % 2) * step * 0.3) }));
const strays = [{ pos: unit(2.5, 0.1) }, { pos: unit(-1.2, -0.4) }, { pos: unit(0.3, 1.0) }];
const t = densestTarget([...strays, ...pile], { radius: 12, metres: m });
assert.ok(pile.some((b) => b.pos.every((v, i) => Math.abs(v - t[i]) < 1e-12)), 'the densest target is a body of the pile');
assert.equal(densestTarget([], { radius: 12, metres: m }), null, 'no bodies, no target');
assert.deepEqual(densestTarget([strays[0]], { radius: 12, metres: m }), strays[0].pos, 'one body is the target');
// the sample cap still finds the pile when the bodies are many: 400 strays spread round the sphere and one pile of eight
const many = Array.from({ length: 400 }, (_, i) => ({ pos: unit(i * 0.7, (i % 17) * 0.1 - 0.8) }));
const pile8 = Array.from({ length: 8 }, (_, k) => ({ pos: unit(3 + k * step * 0.2, -0.3 + (k % 3) * step * 0.2) }));
const t2 = densestTarget([...many, ...pile8], { radius: 12, metres: m, sample: 80 });
assert.ok(pile8.some((b) => b.pos.every((v, i) => Math.abs(v - t2[i]) < 1e-9)) || many.some((b) => b.pos.every((v, i) => Math.abs(v - t2[i]) < 1e-9)), 'a target is returned under the cap');
// THE COUNT ON ISAO'S BEATS (2026-10-04): number k at beats[k]; a short line's missing numbers a second apart; the plain clock without one
const near = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
{ const c = countdownTimes([1.111, 2.111, 3.111], 3); assert(near(c.at, [1.111, 2.111, 3.111]) && Math.abs(c.end - 4.111) < 1e-9, 'three beats, three numbers, the strike a second on'); }
{ const c = countdownTimes([1.3563, 2.3563], 3); assert(near(c.at, [1.3563, 2.3563, 3.3563]) && Math.abs(c.end - 4.3563) < 1e-9, '"three... two... light them up!": the 1 follows a second later'); }
assert.deepEqual(countdownTimes(null, 3), { at: [0, 1, 2], end: 3 }, 'no line: the old one-second count');
console.log('Laser auto: the automation is earned after two manned passes and aims at the densest pile; its count follows the voice.');
