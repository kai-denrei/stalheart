import assert from 'node:assert/strict';
import * as copy from '../src/content/controller-copy.js';
// THE CONTROLLER'S COPY (src/content/controller-copy.js): fixed, frozen tables the game reads by index and key
for (const [name, t] of Object.entries(copy)) {
  assert.ok(Object.isFrozen(t), `${name} is frozen`);
  assert.ok(Object.keys(t).length > 0, `${name} is not empty`);
}
assert.deepEqual([copy.VERDICT_LOW.length, copy.VERDICT_MID.length, copy.VERDICT_HIGH.length], [10, 10, 10], 'three tiers of ten');
for (const t of [copy.RECKLESS_MSGS, copy.HEART_MSGS, copy.VERDICT_LOW, copy.VERDICT_MID, copy.VERDICT_HIGH]) assert.ok(t.every((x) => typeof x === 'string' && x.length));
assert.deepEqual(Object.keys(copy.DIRECTIVE_LABEL), ['wander', 'avoid', 'ram', 'conserve', 'home', 'portal'], 'a label for every directive');
assert.deepEqual(copy.AUTO_OPTIONS.map(([k]) => k).sort(), Object.keys(copy.DIRECTIVE_LABEL).sort(), 'the radial offers every directive');
assert.ok(copy.SHELL_WORDS.every((p) => p.length === 2), 'each shell word is a desktop phrase and its replacement');
console.log('Controller copy: the verdicts, the callouts, the shell words, the directive labels and the auto radial, frozen.');
