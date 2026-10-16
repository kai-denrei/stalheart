// THE SMALL REED AT EACH NEST (owner, 2026-10-16: 'let's put a small Reed at each cargo spot too'). A site's creature guard is queued with the
// family's spec carrying the tier's numbers (src/fx/creature-enemies.js tierSpec), the way the hunters are: the raw tier table has no `body`
// and no `size`, so a guard queued with it got no Reed body (src/fx/creature-bodies.js makes one only for a record whose spec names its family)
// and a NaN scale (src/fx/enemy-step.js spec.size), found by --nest-guards on 2026-10-16. Pinned here against the content and the glue's spawn.
import assert from 'node:assert/strict';
const R = new URL('../', import.meta.url).href;
const { STORY_EXPEDITIONS } = await import(R + 'src/content/story-defaults.js');
const { CREATURE_TIERS } = await import(R + 'src/content/creature-enemies.js');
const { ENEMY_SPEC } = await import(R + 'src/enemyspec.js');
const { tierSpec } = await import(R + 'src/fx/creature-enemies.js');
const { makeExpeditions } = await import(R + 'src/domain/expeditions.js');
const { createExpeditionGlue } = await import(R + 'src/fx/expedition-glue.js');

// the content: every site has one small Reed among its guards, and the tier exists
for (const s of STORY_EXPEDITIONS.sites) {
  const creatures = s.guards.filter((g) => g.family);
  assert.equal(creatures.length, 1, `${s.id}: one creature guard entry`);
  const g = creatures[0];
  assert.equal(g.family, 'reed'); assert.equal(g.tier, 'small'); assert.equal(g.count, 1, `${s.id}: one small Reed`);
  assert.ok(CREATURE_TIERS[g.family]?.[g.tier], `${s.id}: the tier ${g.family}:${g.tier} exists`);
}

// the glue's spawn: a fake host records every queued guard; the Reed's spec is the family's, with the tier's numbers, a body and a size
const centers = Array.from({ length: 64 }, (_, i) => [Math.cos(i), 0.1, Math.sin(i)]);
const spawned = [];
const h = {
  cellSide: 10, scene: null, sfx: null, hasCue: () => false,
  story: { expeditions: makeExpeditions(STORY_EXPEDITIONS.sites), siteCells: { 'rocket-b': { cell: 7, clear: 16 } }, home: 0 },
  centers: () => centers, solid: () => false, revealSite: () => {},
  spawn: (type, ci, o) => spawned.push({ type, ci, ...o }),
};
const glue = createExpeditionGlue(h);
glue.openSite('rocket-b');
const site = STORY_EXPEDITIONS.sites.find((s) => s.id === 'rocket-b');
assert.equal(spawned.length, site.guards.reduce((a, g) => a + g.count, 0), 'every guard of the nest queued');
const reeds = spawned.filter((q) => q.type === 'reed');
assert.equal(reeds.length, 1, 'one Reed queued');
const q = reeds[0], t = CREATURE_TIERS.reed.small;
assert.ok(q.guard && q.guard.site === 'rocket-b' && q.guard.r > 0, 'queued as a guard of its nest');
assert.equal(q.tier, 'small', 'the entry names its tier');
assert.equal(q.spec, tierSpec('reed', 'small'), 'the entry carries the tier spec (the hunters\' own, src/fx/creature-enemies.js)');
assert.equal(q.spec.body, 'reed', 'the spec names its family, so a Reed body is made for the record');
assert.ok(Number.isFinite(q.spec.size) && q.spec.size > 0, `the spec has a size (${q.spec.size})`);
assert.equal(q.spec.hp, t.hp, 'the tier\'s hit points'); assert.equal(q.spec.speed, t.speed, 'the tier\'s speed'); assert.equal(q.spec.ramAt, t.ramAt, 'rammable only above the tier\'s speed');
assert.equal(q.spec.heartDmg, ENEMY_SPEC.reed.heartDmg, 'the family\'s other fields come along');
// the soft guards keep their plain types and no spec of their own (the Pearl dressing is the enemy loop's)
for (const o of spawned.filter((x) => x.type !== 'reed')) assert.equal(o.spec, undefined, `${o.type}: a plain guard entry`);
console.log('nest-guards: the nest\'s small Reed is queued with the family spec (body, size, the tier\'s numbers)');
