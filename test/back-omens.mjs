import assert from 'node:assert/strict';
import { omenDue } from '../src/domain/back-omens.js';
import { BACK_OMENS, SECTORS } from '../src/content/sectors.js';
import { BRIEFS } from '../src/isaobriefs.js';

const fired = new Set();
assert.equal(omenDue(BACK_OMENS, { sector: 1, pulse: 1, last: false }, fired), null, 'the first pulse is quiet');
assert.equal(omenDue(BACK_OMENS, { sector: 1, pulse: 2, last: false }, fired).id, 'rumble');
fired.add('rumble');
assert.equal(omenDue(BACK_OMENS, { sector: 1, pulse: 2, last: false }, fired), null, 'once');
assert.equal(omenDue(BACK_OMENS, { sector: 1, pulse: 3, last: false }, fired), null);
assert.equal(omenDue(BACK_OMENS, { sector: 1, pulse: SECTORS[0].waves, last: true }, fired).id, 'crack', 'the crack comes with the last pulse');
assert.equal(omenDue(BACK_OMENS, { sector: 2, pulse: 2, last: false }, new Set()), null, 'the omens belong to the sector before the door');
const door = SECTORS.find((s) => s.backDoor);
assert.ok(BACK_OMENS.every((o) => o.sector === door.n - 1), 'every omen comes the sector before the door falls');
assert.ok(BACK_OMENS.every((o) => BRIEFS[o.brief]?.lines.length === 2), 'each omen has Isao\'s two lines');
assert.ok(BACK_OMENS.every((o) => o.pulse === 'last' || o.pulse <= SECTORS[o.sector - 1].waves), 'every omen falls inside its sector');
console.log('Back omens: the rumble and the crack come once each, in the sector before the door, with their lines.');
