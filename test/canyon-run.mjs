import assert from 'node:assert/strict';
import { createCanyonRun } from '../src/fx/canyon-run.js';
import { BLOCKED, PATH } from '../src/dungeon.js';
// THE CANYON AND THE SIDE BREACH (src/fx/canyon-run.js, out of the programme host in the refactor run)
const log = [], tags = [PATH, PATH, BLOCKED, BLOCKED, PATH], full = tags.slice(), breachQueue = [], breachedCells = new Set([3]);
const story = { programme: { perks: new Set() } }, dropped = [];
const c = {
  breachQueue, breachedCells, rebuildAfterBreach: () => log.push('rebuild'), recomputePortalDist: () => log.push('portals'),
  breachWallCell: (ci) => ci === 2, laserStation: { passOver: (o) => log.push(['pass', o]), state: () => ({ special: null }) },
  story: () => story, dungeon: () => ({ tags, heart: 0 }), graph: () => ({ centers: [], adj: [] }), cellSide: () => 1, tdFullTags: () => full,
  storyBase: () => ({ dropWallsAt: (ci) => dropped.push(ci) }),
};
const k = createCanyonRun(c);
assert.deepEqual(k.sideBreachCandidates(), [], 'no wall stands yet');
k.canyonCut({ floor: [2], rock: [3] });
assert.deepEqual([tags[2], full[2], tags[3], full[3]], [PATH, PATH, BLOCKED, BLOCKED]);
assert.deepEqual([...breachedCells], [2], 'the floor is breached, the rock is not');
assert.deepEqual([breachQueue, [...story.carved]], [[2, 3], [2]], 'carved on purpose: never a hole to mend');
assert.deepEqual(log, ['rebuild', 'portals']);
log.length = 0; tags[2] = BLOCKED;
assert.equal(k.breakSide([2, 4]), 1, 'only a blocked wall cell breaks'); assert.deepEqual([dropped, log], [[2, 4], ['rebuild', 'portals']]);
k.canyonPass({ id: 1 }); assert.deepEqual(log.at(-1), ['pass', { id: 1 }]); assert.equal(k.canyonOver(), true, 'no special pass laid');
console.log('Canyon run: the cut carves floor and rock and books them, the side breach drops its kit walls, the pass over the canyon.');
