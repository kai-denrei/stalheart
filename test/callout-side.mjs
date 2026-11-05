import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCalloutSides, STREAK_SIDES } from '../src/domain/callout-side.js';

// two streak callouts in a row carry opposite sides; the third is back on the first side
{ const s = createCalloutSides(), a = s.of('co-streak'), b = s.of('co-streak'), c = s.of('co-streak');
  assert.deepEqual([a, b, c], [' co-streak-l', ' co-streak-r', ' co-streak-l']); }
// every other callout carries none and leaves the alternation where it was: the dent, A6 POSTED's own class, a milestone, the call to action
{ const s = createCalloutSides();
  assert.equal(s.of('co-streak'), ' co-streak-l');
  for (const cls of ['co-dent', 'co-a6', 'co-milestone', 'co-cta', 'co-cargo', 'co-reckless', undefined]) assert.equal(s.of(cls), '', cls);
  assert.equal(s.of('co-streak'), ' co-streak-r'); }
assert.deepEqual(STREAK_SIDES, ['co-streak-l', 'co-streak-r']);

// the wiring: td-tab names the side on the callout's class, A6 POSTED takes its own centred class, and the stylesheet offsets the sides with `left`
// (the co-pop keyframes own `transform`), none in the praise-off layout
const game = readFileSync(new URL('../src/td-tab.js', import.meta.url), 'utf8'), css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert.match(game, /function showCallout\(text, cls\) \{\s*isaoSay\(sfx, text\)/, 'the first two lines of showCallout as test/voice-hooks.mjs reads them');
assert.match(game, /d\.className = `callout \$\{cls\}\$\{calloutSides\.of\(cls\)\}`/, 'the callout takes its side class');
assert.match(game, /showCallout\(`STREAK ×\$\{eco\.multiplier\(\)\.toFixed\(2\)\}`, 'co-streak'\)/, 'the streak callout is co-streak');
assert.match(game, /showCallout\('A6 POSTED', 'co-a6'\)/, 'A6 POSTED keeps the centre under its own class');
assert.match(game, /'co-a6': true/, 'and survives the praise switch as it did under co-streak');
const rule = (sel) => css.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
assert.match(rule('.co-streak-l'), /left:\s*-\d/, 'the left side is a negative left');
assert.match(rule('.co-streak-r'), /left:\s*\d/, 'the right side a positive left');
for (const s of ['.co-streak-l', '.co-streak-r']) assert.doesNotMatch(rule(s), /transform/, `${s} leaves transform to co-pop`);
assert.match(css, /\.no-callouts \.co-streak-l,\s*\.no-callouts \.co-streak-r\s*\{[^}]*left:\s*0/, 'none in the praise-off layout');
console.log('callout side ok');
