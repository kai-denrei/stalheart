import assert from 'node:assert/strict';
import { createFirstHarvest } from '../src/fx/first-harvest.js';
import { DOG_SCOUT } from '../src/content/dog-scout.js';
const node = () => ({ style: {}, append() {}, replaceChildren() {}, remove() {}, querySelector: () => null });
const oldDocument = globalThis.document, oldTimeout = globalThis.setTimeout;
globalThis.document = { createElement: node }; globalThis.setTimeout = () => 0;
try {
  for (const hasWatch of [true, false]) {
    let shot = null, flares = 0;
    const rover = { built: true, scene: { ready: true, point: [0, 1, 0] }, trips: 0, events: [] };
    const h = { rover: () => rover, richest: () => ({ cell: 0, kg: 30 }), flareAt: () => flares++, graph: () => ({ centers: [[0, 1, 0]] }), dungeon: () => ({ heart: 0 }) };
    if (hasWatch) h.watch = { root: node(), metres: () => .001, leaveSeat() {}, shotId: () => shot?.id, startShot: (s) => { shot = s; }, endShot: () => { shot?.onEnd(); shot = null; } };
    const intro = createFirstHarvest(h); assert.ok(intro.ready()); intro.flare(); intro.flare(); assert.equal(flares, 1);
    if (hasWatch) {
      assert.equal(intro.done(), false); assert.equal(shot.dur, 6); assert.equal(shot.dur, DOG_SCOUT.harvest.watch.seconds); assert.ok(shot.skippable);
      h.watch.endShot();
    }
    assert.equal(intro.done(), true, 'build choices unlock when the introduction ends or cannot run');
    assert.equal(rover.trips, 0, 'intro completion never fabricates a delivery');
  }
} finally { globalThis.document = oldDocument; globalThis.setTimeout = oldTimeout; }
console.log('First harvest: six-second skippable introduction; cargo continues independently.');
