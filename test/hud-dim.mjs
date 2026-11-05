import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUD_DIM_TARGETS, HUD_DIM_KEEP, hudLit, hudOpacity, insideBox } from '../src/domain/hud-dim.js';
import { HUD_DIM } from '../src/content/hud-dim.js';

const o = (s) => hudOpacity({ ...HUD_DIM, ...s });
// rest, lit on hover, held `hold` s after leaving, back to rest
assert.equal(o({ now: 10 }), 0.2, 'a piece never hovered rests at 0.2');
assert.equal(o({ hovered: true, now: 10 }), 0.8, 'hovered: 0.8');
assert.equal(o({ leftAt: 10, now: 10.1 }), 0.8, 'just left: still lit');
assert.equal(o({ leftAt: 10, now: 12.9 }), 0.8, 'held through the 3 s');
assert.equal(o({ leftAt: 10, now: 13 }), 0.2, 'back to rest at 3 s');
assert.equal(o({ hovered: true, leftAt: 0, now: 99 }), 0.8, 'a re-entry lights it whatever the old leave');
assert.equal(hudLit({ leftAt: null, now: 1e9 }), false);
assert.deepEqual([HUD_DIM.rest, HUD_DIM.lit, HUD_DIM.hold], [0.2, 0.8, 3], "the owner's numbers: 80 % transparent at rest, 20 % lit, a few seconds");

// the box test: inside, on the edge, outside, a zero box (a hidden piece) never hovered
const box = { left: 10, top: 20, right: 110, bottom: 70 };
assert.equal(insideBox(box, 50, 40), true);
assert.equal(insideBox(box, 10, 70), true, 'the edge counts');
assert.equal(insideBox(box, 9, 40), false);
assert.equal(insideBox(box, 50, 71), false);
assert.equal(insideBox({ left: 0, top: 0, right: 0, bottom: 0 }, 0, 0), false, 'a display:none piece has a zero box');
assert.equal(insideBox(null, 0, 0), false);

// the lists: no piece both dimmed and kept; the radar, the hull console, Isao, the callouts, the danger sign, the modals, the cards and the
// strikecam never dim; the sound chip is gone (note 3) and never comes back as a target
for (const s of HUD_DIM_TARGETS) assert(!HUD_DIM_KEEP.includes(s), `${s} is both dimmed and kept`);
for (const s of ['.minimap', '.hull-console', '#td-brief', '#td-callouts', '#td-danger', '#td-msg', '#td-toast', '#td-sitrep', '.build-board',
  '#td-strikecam', '.contact-card', '.choice-card']) {
  assert(HUD_DIM_KEEP.includes(s), `${s} is kept at full`);
  assert(!HUD_DIM_TARGETS.some((t) => t.includes(s.slice(1))), `${s} is never a target`);
}
assert(!HUD_DIM_TARGETS.some((t) => /sound|canvas/.test(t)), 'no sound chip, no canvas');
assert.equal(new Set(HUD_DIM_TARGETS).size, HUD_DIM_TARGETS.length, 'no target twice');

// the stylesheet: rest and lit as the content says, the ending's fade still wins, and app.css's transition is the content's
const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');
assert.match(css, /#tab-td\.hud-dim \[data-hud\]\{opacity:\.2;transition:opacity \.35s\}/);
assert.match(css, /#tab-td\.hud-dim \[data-hud\]\.hud-lit\{opacity:\.8\}/);
assert.match(css, /body\.td-victory #tab-td\.hud-dim :is\([^)]*\)\[data-hud\]\{opacity:0/);
assert.equal(HUD_DIM.fade, 0.35);
// the wiring: td-tab builds it once, on the desktop's word
const game = readFileSync(new URL('../src/td-tab.js', import.meta.url), 'utf8');
assert.equal((game.match(/createHudDim\(root, \{ mobile: mobileShell \}\)/g) || []).length, 1, 'td-tab builds the fade once, with the mobile shell\'s flag');
console.log('HUD dim: rest 0.2, lit 0.8 on hover and 3 s after, the radar and the status pieces never dim, the ending still clears the glass.');
