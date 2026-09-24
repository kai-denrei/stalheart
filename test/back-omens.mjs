import assert from 'node:assert/strict';
import { omenDue } from '../src/domain/back-omens.js';
import { BACK_OMENS, SECTORS } from '../src/content/sectors.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { createBackOmen } from '../src/fx/back-omen.js';
import { BACK_SCRAMBLE } from '../src/content/sectors.js';

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
// the fx plays an omen over the controller's instruments, and the scramble rings the back sockets
{
  const log = [];
  const fx = createBackOmen({ mouth: { cells: [1, 2], flank: [3], dir: [0, 0, 1] }, hud: { tremor: (d) => log.push(['tremor', d]) }, sfx: { play: (k) => log.push(['sfx', k]) },
    explode: (k) => log.push(['explode', k]), brief: (id) => log.push(['brief', id]), camDist: () => 1, centers: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]],
    callout: (t) => log.push(['callout', t]), ring: (ci) => log.push(['ring', ci]), sockets: () => [{ cell: 7 }, { cell: 8 }], gap: 0.25 });
  assert.equal(fx.play(BACK_OMENS[0]), true);
  assert.deepEqual(log.slice(0, 3), [['tremor', [0, 0, 1]], ['sfx', 'sinkhole_quake'], ['brief', BACK_OMENS[0].brief]], 'the radar, the quake, Isao');
  // THE DUST RIDES THE GAME CLOCK: nothing before a tick, one puff per `gap` seconds of world time, nothing while the world holds
  const puffs = () => log.filter((l) => l[0] === 'explode').length;
  assert.equal(puffs(), 0, 'no dust before the world ticks');
  fx.tick(0.01); assert.equal(puffs(), 1, 'the first puff with the next tick');
  fx.tick(0.25); assert.equal(puffs(), 2, 'the next a gap later');
  fx.tick(0); fx.tick(0); assert.equal(puffs(), 2, 'a held world holds its dust');
  fx.tick(10); assert.equal(puffs(), BACK_OMENS[0].dust, 'and every puff comes, once');
  assert.ok(log.filter((l) => l[0] === 'explode').every((l) => l[1] === 'rock.dust'));
  log.length = 0; fx.scramble(0);
  assert.deepEqual(log, [['brief', BACK_SCRAMBLE.brief], ['callout', BACK_SCRAMBLE.callout], ['ring', 7], ['ring', 8]], 'the ask, the callout, every back socket rung');
  log.length = 0; fx.scramble(1);
  assert.deepEqual(log, [['ring', 7], ['ring', 8]], 'later rings carry no words');
  assert.equal(createBackOmen({ mouth: null }).play(BACK_OMENS[0]), false, 'no mouth, no omen');
}
console.log('Back omens: the rumble and the crack come once each, in the sector before the door, with their lines.');
