import assert from 'node:assert/strict';
import { makeExpeditions, reveal, guardsCleared, reach, deliver, hullLost, unlockedTowers, nextReveals, siteState } from '../src/domain/expeditions.js';
import { STORY_EXPEDITIONS } from '../src/content/story-defaults.js';
import { TOWER_BY_KEY } from '../src/towers.js';
import { STORY_LAYOUT } from '../src/platform/story-world.js';

const ex = makeExpeditions(STORY_EXPEDITIONS.sites);
assert.deepEqual(STORY_EXPEDITIONS.base, ['rotor', 'quiver']);
assert.deepEqual(ex.sites.map((s) => s.state), STORY_EXPEDITIONS.sites.map(() => 'hidden'), 'every site starts hidden');
for (const s of STORY_EXPEDITIONS.sites) {
  assert.ok(TOWER_BY_KEY[s.tower], `${s.id}: ${s.tower} is a tower`);
  assert.ok(s.part && s.guards.length && s.guards.every((g) => g.count > 0), `${s.id}: a part and a guard nest`);
  assert.ok(STORY_LAYOUT.structures.some((x) => x.id === s.id && x.anchor === 'open'), `${s.id}: a landing site in the base layout`);
}
const first = STORY_EXPEDITIONS.sites.filter((s) => !s.reveal).map((s) => s.id);
assert.deepEqual(first, ['rocket-a', 'rocket-b', 'wreck'], 'the three puzzle towers first');

assert.equal(reach(ex, 'rocket-a'), false, 'a hidden site cannot be reached');
assert.equal(reveal(ex, 'rocket-a'), true); assert.equal(reveal(ex, 'rocket-a'), false, 'revealed once');
assert.equal(siteState(ex, 'rocket-a'), 'guarded');
assert.equal(reach(ex, 'rocket-a'), false, 'guards first');
assert.equal(guardsCleared(ex, 'rocket-a'), true);
assert.equal(reach(ex, 'rocket-a'), true);
assert.equal(ex.carrying, 'rocket-a');
reveal(ex, 'rocket-b'); guardsCleared(ex, 'rocket-b');
assert.equal(reach(ex, 'rocket-b'), false, 'one part carried at a time');
assert.equal(hullLost(ex), true, 'losing the hull drops the part');
assert.equal(siteState(ex, 'rocket-a'), 'cleared', 'back at its site');
assert.equal(ex.carrying, null);
assert.equal(deliver(ex), null, 'nothing to deliver');
reach(ex, 'rocket-a');
assert.equal(deliver(ex), STORY_EXPEDITIONS.sites[0].tower, 'delivering names the tower');
assert.deepEqual(unlockedTowers(ex, STORY_EXPEDITIONS.base), ['rotor', 'quiver', STORY_EXPEDITIONS.sites[0].tower]);
assert.deepEqual(nextReveals(ex), [], 'later sites wait for three deliveries');
for (const id of ['rocket-b', 'wreck']) { reveal(ex, id); guardsCleared(ex, id); reach(ex, id); deliver(ex); }
const after3 = STORY_EXPEDITIONS.sites.filter((s) => s.reveal?.after === 3).map((s) => s.id);
assert.deepEqual(nextReveals(ex), after3, 'three parts home reveal the next sites');
assert.equal(after3.length, 2);
for (const id of after3) { reveal(ex, id); guardsCleared(ex, id); reach(ex, id); deliver(ex); }
const after5 = STORY_EXPEDITIONS.sites.filter((s) => s.reveal?.after === 5).map((s) => s.id);
assert.deepEqual(nextReveals(ex), after5, 'five parts home reveal the last site');
assert.equal(after5.length, 1);
assert.ok(STORY_EXPEDITIONS.deliverCells > 0);
console.log('Expeditions: hidden, guarded, cleared, carried, delivered; one part at a time; the drop on hull loss; unlocks; later reveals.');
