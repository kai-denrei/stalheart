import assert from 'node:assert/strict';
import { sentryBookFull, sentryCap } from '../src/domain/sentry-cap.js';
import { STORY_SENTRIES } from '../src/content/sentries.js';
const orders = [{ kind: 'tower', ci: 5 }, { kind: 'tower', ci: 6 }, { kind: 'structure', ci: 7 }];
assert.equal(sentryBookFull({ towers: 8, orders, ci: 9, cap: 10 }), true, 'eight standing and two ordered: a new order is refused');
assert.equal(sentryBookFull({ towers: 8, orders, ci: 5, cap: 10 }), false, 'the order at 5, finishing, is not counted against itself');
assert.equal(sentryBookFull({ towers: 9, orders: orders.slice(1), ci: 6, cap: 10 }), false, 'the tenth stands when it is finished');
assert.equal(sentryBookFull({ towers: 7, orders, ci: 9, cap: 10 }), false, 'room for one more');
// THE CAP GROWS WITH THE COLONY (the economy design 2.4, 2026-11-12): 6 at the start, +2 with a FABRICATION step standing (the fabrication dome, or the
// assembly line on ?base=classic), +2 with a LOGISTICS one (a logistics dome, or the armory), at most 10
assert.equal(STORY_SENTRIES.cap, 6); assert.equal(STORY_SENTRIES.max, 10);
assert.equal(sentryCap(new Set(), STORY_SENTRIES), 6, 'six at the start');
assert.equal(sentryCap(new Set(['gate', 'stalheart', 'dome-e']), STORY_SENTRIES), 8, 'the fabrication dome: +2');
assert.equal(sentryCap(new Set(['dome-ne']), STORY_SENTRIES), 8, 'a logistics dome: +2');
assert.equal(sentryCap(new Set(['dome-ne', 'dome-se']), STORY_SENTRIES), 8, 'two logistics domes are one group');
assert.equal(sentryCap(['assembly', 'armory'], STORY_SENTRIES), 10, 'classic: the assembly line and the armory');
assert.equal(sentryCap(new Set(['dome-e', 'dome-ne', 'dome-se', 'assembly', 'armory']), { ...STORY_SENTRIES, plus: [...STORY_SENTRIES.plus, { steps: ['dome-e'], add: 5 }] }), 10, 'never past max');
assert.equal(sentryCap(null, STORY_SENTRIES), 6, 'no programme: the base');
assert.match(STORY_SENTRIES.fullAt(8), /^Isao keeps 8 sentries running/);
console.log('sentry-cap: the cap refuses new orders, never the order being finished; 6, +2 fabrication, +2 logistics, at most 10, the refusal at the live cap.');
