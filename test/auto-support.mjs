import assert from 'node:assert/strict';
import { createAutoSupport } from '../src/fx/auto-support.js';
import { GUNSHIP_AUTO } from '../src/content/gunship.js';
import { LASER_AUTO } from '../src/content/orbital-laser.js';
// THE FIRE SUPPORT ON AUTO (src/fx/auto-support.js, out of the programme host in the refactor run): the envelope the automations open
const story = { nukes: [1, 2] };
const log = [];
const c = { story: () => story, showBrief: (id) => log.push(id), updateHud: () => {} };
const a = createAutoSupport(c);
assert.equal(a.nukes(), 2);
assert.deepEqual([a.tier(), a.aliveBudget(), a.swell()], [0, undefined, 1], 'no automation: the plain envelope');
story.gsAuto = true; assert.deepEqual([a.tier(), a.aliveBudget(), a.swell()], [1, GUNSHIP_AUTO.aliveBudget, GUNSHIP_AUTO.swell]);
story.sol88 = true; assert.deepEqual([a.tier(), a.swell()], [2, GUNSHIP_AUTO.swell * LASER_AUTO.swell], 'each automation swells the waves');
story.gsManned = 3; assert.deepEqual(a.gunshipAuto(), { auto: true, manned: 3, fly: null });
a.tick({ dt: 0.016 });   // no gunship rig, no camera, no Isao: nothing to fly, nothing to fire
story.strike = { tick: () => false }; a.tick({ dt: 0.016 }); assert.equal(story.strike, null, 'a finished missile is let go');
assert.deepEqual(log, []);
console.log('Auto support: nukes, the tier, the alive budget and the swell the automations open, the harness reading, a finished missile let go.');
