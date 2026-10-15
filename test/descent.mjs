import assert from 'node:assert/strict';
import { descentDue, descentResult, descentNext } from '../src/domain/descent.js';
import { DESCENT } from '../src/content/descent.js';

// THE DESCENT (owner, 2026-10-15): after the final sector is secured, the cave; its outcome back; the ending or a retry
assert.equal(descentDue({ outcome: 'secure', final: true, mobile: false }, DESCENT), true);
assert.equal(descentDue({ outcome: 'secure', final: false, mobile: false }, DESCENT), false, 'not before the final sector');
assert.equal(descentDue({ outcome: 'lost', final: true, mobile: false }, DESCENT), false, 'a lost final sector is the game\'s own loss');
assert.equal(descentDue({ outcome: 'secure', final: true, mobile: true }, DESCENT), false, 'a phone skips it');
assert.equal(descentDue({ outcome: 'secure', final: true, mobile: true }, { ...DESCENT, mobileSkip: false }), true);
assert.equal(descentResult({ below: 'rescued' }, DESCENT), 'rescued');
assert.equal(descentResult({ below: 'sacrifice' }, DESCENT), 'sacrifice');
assert.equal(descentResult({ below: 'lost' }, DESCENT), 'lost');
assert.equal(descentResult({ below: 'won' }, DESCENT), null, 'an unknown outcome is nothing');
assert.equal(descentResult('rescued', DESCENT), null, 'a bare string is nothing');
assert.equal(descentResult(null, DESCENT), null); assert.equal(descentResult({ other: 1 }, DESCENT), null);
assert.equal(descentNext('rescued'), 'ending'); assert.equal(descentNext('sacrifice'), 'ending'); assert.equal(descentNext('lost'), 'retry');
assert.ok(DESCENT.jokeHold >= 3, 'the joke is held long enough to read');
assert.ok(DESCENT.page.startsWith('below/index.html') && /stalheart=1/.test(DESCENT.page), 'the cave\'s page in its stalheart mode');
console.log('Descent: due after the final sector, the cave\'s outcome validated, the ending or a retry.');
