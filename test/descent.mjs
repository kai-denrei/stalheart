import assert from 'node:assert/strict';
import { descentDue, descentResult, descentNext, descentOpenDue } from '../src/domain/descent.js';
import { DESCENT } from '../src/content/descent.js';
import { brief, lineDwell } from '../src/isaobriefs.js';

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
// the cave covers the game only after the look at the arena's hole and Isao's brief (2026-10-18 review), on game seconds
const due = (waited, briefing) => descentOpenDue({ waited, min: DESCENT.lookHold, briefing, cap: DESCENT.briefCap });
assert.equal(due(0, false), false, 'never before the look'); assert.equal(due(DESCENT.lookHold - 0.1, false), false, 'never before the look, brief done or not');
assert.equal(due(DESCENT.lookHold, false), true, 'after the look and no brief: open');
assert.equal(due(DESCENT.lookHold + 5, true), false, 'Isao still speaking: wait'); assert.equal(due(DESCENT.briefCap - 0.1, true), false, 'waits up to the cap');
assert.equal(due(DESCENT.briefCap, true), true, 'after the cap: open even if the panel is stuck');
assert.equal(descentOpenDue({ waited: 0, min: 0, briefing: false, cap: 22 }), true, 'no arena to look at and nothing said: at once');
assert.equal(descentOpenDue({ waited: 30, min: 2.5, briefing: true, briefWaited: 10, cap: 22 }), false, 'a line said before the brief does not eat its cap');
assert.equal(descentOpenDue({ waited: 30, min: 2.5, briefing: true, briefWaited: 22, cap: 22 }), true, 'the brief up for the cap: open');
{ const b = brief(DESCENT.brief), dwell = b.lines.reduce((a, _, i) => a + lineDwell(b, i), 0); assert.ok(DESCENT.briefCap >= dwell + 2, `the cap covers the brief's dwell (${dwell} s) with a margin`); }
console.log('Descent: due after the final sector, the cave\'s outcome validated, the ending or a retry.');
