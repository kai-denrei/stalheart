// crowd-cap — the bodies alive at once follow the frame: down when slow, up when there is room, inside its bounds.
import assert from 'node:assert/strict';
import { makeCrowdCap, stepCrowdCap } from '../src/domain/crowd-cap.js';
import { CROWD_CAP } from '../src/content/sectors.js';
const run = (c, ms, seconds, alive = Infinity) => { for (let t = 0; t < seconds; t += ms / 1000) stepCrowdCap(c, ms, alive); return c.cap; };
{ const c = makeCrowdCap(CROWD_CAP); assert.equal(c.cap, CROWD_CAP.start); assert.ok(run(c, 140, 30) === CROWD_CAP.min, '7 fps: down to the floor'); }
{ const c = makeCrowdCap(CROWD_CAP); run(c, 50, 4); assert.ok(c.cap < CROWD_CAP.start, 'slow frames lower it within seconds'); }
{ const c = makeCrowdCap(CROWD_CAP); assert.ok(run(c, 16.7, 120) === CROWD_CAP.max, '60 fps: up to the ceiling'); }
{ const c = makeCrowdCap(CROWD_CAP), before = c.cap; run(c, 28, 20); assert.equal(c.cap, before, 'between the two marks it holds'); }
{ const c = makeCrowdCap(CROWD_CAP); stepCrowdCap(c, 5000); stepCrowdCap(c, -1); assert.equal(c.ema, null, 'a hidden tab or a stall is not a frame'); }
{ const c = makeCrowdCap(CROWD_CAP); assert.equal(run(c, 16.7, 60, 50), CROWD_CAP.start, 'an empty field at 60 fps is no evidence: it holds'); }
assert.ok(CROWD_CAP.min >= 300 && CROWD_CAP.max >= 2500, 'the floor still a crowd, the ceiling the sectors\' own');
console.log('crowd-cap: the cap follows the frame inside its bounds.');
