import assert from 'node:assert/strict';
import { readStoryQuery } from '../src/platform/story-world.js';

// HOW A STORY URL OPENS. A bare page is the V1 session: stage 1, the base grows (the landing, then Isao prints it), the full threat.
// ?story=0 is the story from its start (owner, 2026-09-25): exactly the bare page's opening; it used to read as a static stage-1
// deep link with no gate, so the tutorial's fodder had nowhere to rise and there was nothing to shoot at. ?story=N >= 1 and
// ?stage=N stay the deep links: a static base at that stage, sparse waves. SKIP TUTORIAL overrides them all.
const pick = (q) => { const r = readStoryQuery(q); return { stage: r.stage, grow: r.grow, threat: r.threat, skip: r.skip, phase: r.phase }; };
const bare = pick('');
assert.deepEqual(bare, { stage: 1, grow: true, threat: 1, skip: false, phase: null }, 'a bare page is the session');
assert.deepEqual(pick('?story=0'), bare, '?story=0 is the story from its start, the bare page\'s opening');
assert.deepEqual(pick('?story=0&sw=0'), bare, 'with the harness\'s own keys too');
assert.deepEqual(pick('?story=1'), { stage: 1, grow: false, threat: 0.35, skip: false, phase: null }, '?story=1 stays the static deep link');
assert.deepEqual(pick('?story=4'), { stage: 4, grow: false, threat: 0.35, skip: false, phase: null });
assert.equal(pick('?stage=1&grow=1').grow, true, 'a growing stage link still grows');
assert.equal(pick('?skip=defence').skip, true, 'SKIP TUTORIAL overrides');
console.log('Story query: a bare page and ?story=0 open the session from the landing; ?story=N and ?stage=N stay deep links.');
