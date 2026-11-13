// THE ROVER'S ARRIVAL CARD (owner, 2026-11-13; src/domain/rover-card.js): which pages show it, and when.
import assert from 'node:assert/strict';
import { cardWanted, cardDue } from '../src/domain/rover-card.js';
import { ROVER_CARD } from '../src/content/rover.js';

assert.equal(cardWanted('?world=story#td'), true, 'a story page from its start shows it');
assert.equal(cardWanted('?world=story&acceptance=1'), false, 'an acceptance page passes it by');
assert.equal(cardWanted('?world=story&skip=defence&sector=2'), false, 'a skipped opening passes it by');
assert.equal(cardWanted('?acceptance=1&skip=defence&rovercard=1'), true, 'unless it asks');
assert.equal(cardWanted('?world=story&rovercard=0'), false, '?rovercard=0 never');
assert.equal(cardDue({ wanted: true, leftHome: true }), true, 'due at the first run out');
assert.equal(cardDue({ wanted: true, leftHome: false }), false, 'not before the rover leaves home');
assert.equal(cardDue({ wanted: true, leftHome: true, shown: true }), false, 'once per run');
assert.equal(cardDue({ wanted: false, leftHome: true }), false, 'not on a page that passes it by');
assert.equal(cardDue({ wanted: true, leftHome: true, fighting: true }), false, 'not over a live wave');
assert.equal(cardDue({ wanted: true, leftHome: true, fighting: true, breathing: true }), true, 'a breath in the wave is a lull');
assert.ok(ROVER_CARD.name === 'YUSHI ROVER' && ROVER_CARD.lines.length >= 2 && ROVER_CARD.lines.length <= 3, 'the name and two or three lines');
assert.ok(ROVER_CARD.lines.every((l) => l.length > 0 && l.length <= 90), 'short lines');
console.log('rover-card: ok');
