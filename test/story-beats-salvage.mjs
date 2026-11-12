// story-beats-salvage.mjs — the landing's grade sets what the AFR-01 cuts: the sections, a barrel's worth, the bonus at deploy
import assert from 'node:assert/strict';
import { makeStoryBeats } from '../src/domain/story-beats.js';
import { FOUNDRY_TUNE } from '../src/content/foundry.js';

// the Rotor's printing stock is granted by the foundry phase (api.cost), not cut from the rocket: told apart by its number, kept out of the barrels
const STOCK = 33;
function beatsWith(salvage) {
  const grants = [], events = [];
  const b = makeStoryBeats({ foundry: FOUNDRY_TUNE, arrival: true });
  const api = { grant: (n) => { if (n !== STOCK) grants.push(n); }, foundry: (ev, d) => events.push([ev, d]), brief() {}, order: () => true, cost: () => STOCK, built: () => false };
  if (salvage) b.salvage(salvage);
  return { b, api, grants, events };
}
{ // no grade: the foundry as tuned
  const { b, api, grants } = beatsWith(null);
  b.deploy(api);
  assert.deepEqual(grants, [], 'no bonus barrel without a grade');
  assert.equal(b.state().foundry.sections, FOUNDRY_TUNE.sections.length);
}
{ // a wreck: two sections, a smaller barrel
  const { b, api, grants } = beatsWith({ sections: 2, feedstockPerBarrel: 48, bonus: 0 });
  b.deploy(api);
  assert.equal(b.state().foundry.sections, 2, 'the tank section is not there to cut');
  for (let i = 0; i < 400; i++) b.tick(0.1, api);
  assert.ok(grants.length >= 1 && grants.every((g) => g === 48), `every barrel is 48 (${grants})`);
}
{ // a clean landing: the bonus barrel at deploy, the rest as tuned
  const { b, api, grants } = beatsWith({ sections: 3, feedstockPerBarrel: 60, bonus: 1 });
  b.deploy(api);
  assert.deepEqual(grants, [60], 'one bonus barrel on the deploy');
}
{ // THE SETTLING (2026-11-08, spec 2.B): the whole salvage at the deploy, nothing per barrel; today's drip without `settle`
  const grants = [];
  const b = makeStoryBeats({ foundry: FOUNDRY_TUNE, arrival: true, settle: 120 });
  const api = { grant: (n) => grants.push(n), foundry() {}, brief() {}, order: () => true, cost: () => STOCK, built: () => false, pending: () => false };
  b.salvage({ sections: 3, feedstockPerBarrel: 600, bonus: 1 }); b.deploy(api);
  assert.deepEqual(grants, [2400], 'CLEAN: three sections and the bonus barrel, granted at once (x10, 2026-11-12)');
  for (let i = 0; i < 900; i++) b.tick(0.1, api);
  assert.deepEqual(grants, [2400], 'the barrels the AFR-01 cuts grant nothing more');
  const w = makeStoryBeats({ foundry: FOUNDRY_TUNE, arrival: true, settle: 120 }); const wg = []; w.salvage({ sections: 2, feedstockPerBarrel: 480, bonus: 0 }); w.deploy({ ...api, grant: (n) => wg.push(n) });
  assert.deepEqual(wg, [960], 'a WRECK: two sections of 480');
  const a = makeStoryBeats({ foundry: FOUNDRY_TUNE, arrival: true, settle: 120 }); const ag = []; a.deploy({ ...api, grant: (n) => ag.push(n) });
  assert.deepEqual(ag, [1800], 'an automatic landing: the tune\'s three barrels');
}
console.log('story-beats-salvage: ok');
