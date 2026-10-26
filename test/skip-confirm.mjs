// THE SKIP ASKS FIRST (round 3, 2026-10-26, decision 3a): the first press asks, Space or a second tap within 4 s skips, any other key or 4 s of
// nothing says no, a held key's repeats do nothing
import assert from 'node:assert/strict';
import { createSkipConfirm, SKIP_QUESTION, SKIP_WINDOW } from '../src/domain/skip-confirm.js';

assert.equal(SKIP_WINDOW, 4);
assert.match(SKIP_QUESTION, /^SKIP END GAME CELEBRATION\? · SPACE YES · ANY OTHER KEY NO$/);
{ const q = createSkipConfirm();
  assert.equal(q.press({ key: ' ' }, 0), 'ask', 'even Space asks first');
  assert.equal(q.asking(), true);
  assert.equal(q.press({ key: ' ', repeat: true }, 0.2), 'ignore', 'a held key repeats: nothing');
  assert.equal(q.press({ key: ' ' }, 1), 'skip', 'Space within 4 s: skip');
  assert.equal(q.asking(), false); }
{ const q = createSkipConfirm();
  assert.equal(q.press({ key: 'w' }, 0), 'ask');
  assert.equal(q.press({ key: 'Enter' }, 2), 'no', 'any other key: no');
  assert.equal(q.press({ key: ' ' }, 2.5), 'ask', 'and the next press asks again'); }
{ const q = createSkipConfirm();
  assert.equal(q.press({ tap: true }, 0), 'ask');
  assert.equal(q.press({ tap: true }, 3.9), 'skip', 'a second tap within 4 s'); }
{ const q = createSkipConfirm();
  q.press({ tap: true }, 0);
  assert.equal(q.tick(3.9), null);
  assert.equal(q.tick(4.1), 'no', '4 s of nothing drops the question');
  assert.equal(q.asking(), false);
  assert.equal(q.press({ tap: true }, 4.2), 'ask'); }
{ const q = createSkipConfirm();
  q.press({ key: 'a' }, 0);
  assert.equal(q.press({ key: ' ' }, 5), 'ask', 'a late Space (no tick between) asks again rather than skipping'); }
console.log('skip-confirm: asks first, Space or a second tap within 4 s skips, anything else keeps the celebration');
