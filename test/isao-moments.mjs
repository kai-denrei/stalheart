import assert from 'node:assert/strict';
import { createIsaoMoments } from '../src/fx/isao-moments.js';
import { STORY_CALM } from '../src/content/story-defaults.js';
// ISAO'S MOMENTS (src/fx/isao-moments.js, out of the programme host in the refactor run): how busy the player is, and hops to the heart
const s = { story: {}, t: 10, enemies: [], pilot: null, hull: [0, 0, 0], seated: false };
const c = {
  laserStation: { seated: () => s.seated }, story: () => s.story, dungeon: () => ({ distToHeart: [0, 3, 90] }), t: () => s.t,
  enemies: () => s.enemies, pilot: () => s.pilot, playerPos: () => s.hull, cellSide: () => 1,
};
const m = createIsaoMoments(c);
assert.deepEqual([m.hopsToHeart(1), m.hopsToHeart(2), m.hopsToHeart(7)], [3, 90, -1], 'walking hops, -1 unknown');
assert.equal(m.danger(), false, 'nobody up');
s.enemies = [{ alive: true, pos: [STORY_CALM.near - 1, 0, 0], cur: 2 }];
assert.equal(m.danger(), true, 'a body within near cells of the hull');
s.enemies = [{ alive: true, pos: [STORY_CALM.near + 5, 0, 0], cur: 2 }];
assert.equal(m.danger(), false, 'out of reach on foot');
s.seated = true; assert.equal(m.danger(), true, 'any body up while SOL is manned'); s.seated = false;
assert.equal(m.engaged(), false, 'a stray far out does not hold the debrief');
s.enemies = [{ alive: true, pos: [50, 0, 0], cur: 1 }];
assert.equal(m.engaged(), true, 'a hostile near the heart engages');
s.enemies = []; s.t += STORY_CALM.calm - 0.1; assert.equal(m.engaged(), true, 'and for calm seconds after');
s.t += 0.2; assert.equal(m.engaged(), false, 'then calm');
m.tick();   // no voice in node: the lines are asked for and nothing throws
console.log('Isao\'s moments: danger near the hull or under a manned seat, engaged for calm seconds after, hops to the heart.');
