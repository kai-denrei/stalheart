// THE SENTRY CAP GROWS WITH THE COLONY (the economy design 2.4, 2026-11-12; src/domain/sentry-cap.js, src/content/sentries.js STORY_SENTRIES): 6 at the
// start, +2 with a FABRICATION step standing (the fabrication dome, or the assembly line on ?base=classic), +2 with a LOGISTICS one (a logistics dome, or
// the armory), at most 10; the book counts standing sentries and orders, not an order at the cell asked
import assert from 'node:assert/strict';
import { sentryCap, sentryBookFull } from '../src/domain/sentry-cap.js';
import { STORY_SENTRIES } from '../src/content/sentries.js';
assert.equal(STORY_SENTRIES.cap, 6); assert.equal(STORY_SENTRIES.max, 10);
assert.equal(sentryCap(new Set(), STORY_SENTRIES), 6, 'six at the start');
assert.equal(sentryCap(new Set(['gate', 'stalheart', 'dome-e']), STORY_SENTRIES), 8, 'the fabrication dome: +2');
assert.equal(sentryCap(new Set(['dome-ne']), STORY_SENTRIES), 8, 'a logistics dome: +2');
assert.equal(sentryCap(new Set(['dome-ne', 'dome-se']), STORY_SENTRIES), 8, 'two logistics domes are one group');
assert.equal(sentryCap(['assembly', 'armory'], STORY_SENTRIES), 10, 'classic: the assembly line and the armory');
assert.equal(sentryCap(new Set(['dome-e', 'dome-ne', 'dome-se', 'assembly', 'armory']), { ...STORY_SENTRIES, plus: [...STORY_SENTRIES.plus, { steps: ['dome-e'], add: 5 }] }), 10, 'never past max');
assert.equal(sentryCap(null, STORY_SENTRIES), 6, 'no programme: the base');
assert.equal(sentryBookFull({ towers: 5, orders: [{ kind: 'tower', ci: 3 }], ci: 9, cap: 6 }), true); assert.equal(sentryBookFull({ towers: 5, orders: [{ kind: 'tower', ci: 3 }], ci: 3, cap: 6 }), false, 'an order at the cell asked is not counted against itself');
assert.match(STORY_SENTRIES.fullAt(8), /^Isao keeps 8 sentries running/);
console.log('Sentry cap: 6, +2 fabrication, +2 logistics, at most 10; the refusal reads the live cap.');
