// THE BESTIARY'S RULES (owner, 2026-10-14; src/domain/bestiary.js, src/content/bestiary.js, spec docs/superpowers/specs/2026-10-14-bestiary-terminal-design.md
// section 7): entryState's three states and the lab's all-full host; the roster from the tier table (eight tiers up the belt ladder, then the
// creatures, every PEARL_OF type claimed by exactly one entry, the warning only on cored entries); lurePoint closed and smooth and lureStep never
// within `ahead` of a chaser (it slides off its loop rather than leap); the pack's seats for 3 and 6; the sightings record's note (a second run increments runs, keeps first) and its
// reading; the content's entries complete (every tier at least three lines, every creature one entry).
import assert from 'node:assert/strict';
import { bestiaryRoster, entryIdOf, entryState, entryCard, lurePoint, lureStep, packSeats, readSightings, noteSighting, ENTRY_STATES } from '../src/domain/bestiary.js';
import { ENTRIES, TERMINAL, BESTIARY_STAGE, CREATURE_SPEC, CREATURE_LABELS, BESTIARY_STORE } from '../src/content/bestiary.js';
import { PEARL_TIERS, PEARL_OF } from '../src/content/pearl-enemies.js';
import { ENEMY_SPEC, INTROS } from '../src/enemyspec.js';
import { exportRecords } from '../src/storage.js';

const spec = { ...ENEMY_SPEC, ...CREATURE_SPEC }, labels = { ...Object.fromEntries(INTROS.map((i) => [i.type, i.label])), ...CREATURE_LABELS };
const roster = bestiaryRoster({ entries: ENTRIES, tiers: PEARL_TIERS, of: PEARL_OF, spec });

// 1. the roster: eight tiers up the belt ladder (soft by rank, then cored by rank), then the creatures in the content's order
assert.deepEqual(roster.map((e) => e.id), ['white', 'yellow', 'blue', 'orange', 'green', 'purple', 'brown', 'black', 'cutis', 'reed', 'nih-dairia']);
assert.deepEqual(roster.map((e) => e.index), roster.map((_, k) => k + 1)); assert(roster.every((e) => e.total === 11));
assert.equal(roster[3].kind, 'tier'); assert.equal(roster[3].label, 'ORANGE TIER', 'the spec\'s card example: ENTRY 04 / 11 · ORANGE TIER');
for (const e of roster.filter((x) => x.kind === 'tier')) {
  const t = PEARL_TIERS.find((x) => x.id === e.id);
  assert.equal(e.cored, t.cored); assert.equal(e.swatch, t.values.skinTint, `${e.id}'s swatch is its skin`);
  assert.deepEqual([...e.types].sort(), [...ENTRIES.find((x) => x.id === e.id).types].sort(), `${e.id}: the content's types are PEARL_OF's`);
}
// every PEARL_OF type claimed by exactly one entry; entryIdOf finds it
for (const type of Object.keys(PEARL_OF)) {
  const owners = roster.filter((e) => e.types.includes(type));
  assert.equal(owners.length, 1, `${type} is claimed once`); assert.equal(owners[0].id, PEARL_OF[type]); assert.equal(entryIdOf(roster, type), PEARL_OF[type]);
}
assert.equal(entryIdOf(roster, 'cutis'), 'cutis'); assert.equal(entryIdOf(roster, 'jelly'), null, 'the shelved jelly has no entry');
// the warning only on cored entries: the soft tiers' cards carry none, every cored tier's does
for (const e of roster) {
  const c = entryCard(e, 'full', { spec, labels, copy: TERMINAL });
  if (e.cored) assert.equal(c.warning, TERMINAL.warning, `${e.id} warns`); else assert.equal(c.warning, null, `${e.id} does not warn`);
  if (e.kind === 'tier') assert.equal(e.cored, e.types.every((t) => !ENEMY_SPEC[t].rammable), `${e.id}: cored exactly when no type goes under the treads`);
}
assert.deepEqual(roster.filter((e) => e.kind === 'tier' && e.cored).map((e) => e.id), ['orange', 'green', 'purple', 'brown', 'black']);

// 2. entryState: full this run, silhouette from an earlier run only, unseen never; the lab's host every entry full
{
  const white = roster[0], orange = roster[3], sightings = { white: { first: '2026-10-01', runs: 2, last: '2026-10-09' } };
  assert.equal(entryState(white, { log: ['phage'], sightings: {} }), 'full', 'any of its types met this run');
  assert.equal(entryState(white, { log: [], sightings }), 'silhouette', 'met in an earlier run only');
  assert.equal(entryState(orange, { log: ['amoeba'], sightings }), 'unseen', 'never met');
  assert.equal(entryState(white, { log: ['amoeba'], sightings }), 'full', 'this run wins over the record');
  for (const e of roster) assert.equal(entryState(e, { all: true }), 'full', `the lab: ${e.id} full`);
  assert.deepEqual(ENTRY_STATES, ['unseen', 'silhouette', 'full']);
  // the cards for each state
  const full = entryCard(orange, 'full', { spec, labels, log: ['drifter'], copy: TERMINAL, sightings: { orange: { first: '2026-10-14', runs: 3, last: '2026-10-14' } } });
  assert.equal(full.head, 'ENTRY 04 / 11 · ORANGE TIER'); assert.equal(full.name, 'WAVE SATURN', 'the type met, by its INTROS label');
  assert.equal(full.met, 'MET: run 3 · first 2026-10-14'); assert.equal(full.text.length, 3); assert.equal(full.note, null); assert(full.selectable);
  assert.deepEqual(full.data.map((d) => [d.type, d.hp, d.ram]), [['drifter', 2, 'SOLID CORE']]);
  const sil = entryCard(white, 'silhouette', { spec, labels, log: [], copy: TERMINAL, sightings });
  assert.equal(sil.text, null, 'the text replaced'); assert.equal(sil.note, 'NO RECENT READING · last logged 2026-10-09'); assert.equal(sil.data.length, 2, 'the data lines kept');
  assert.equal(sil.data[0].ram, 'goes under the treads'); assert(sil.selectable);
  const un = entryCard(orange, 'unseen', { spec, labels, copy: TERMINAL });
  assert.equal(un.name, '— — —'); assert.equal(un.data.length, 0); assert.equal(un.note, TERMINAL.unseenNote); assert(!un.selectable); assert(un.dim); assert.equal(un.warning, null, 'an unseen entry gives nothing away');
}

// 3. the lure: closed and smooth over a period; lureStep turns once a period alone and never stays within `ahead` of a chaser
{
  const L = BESTIARY_STAGE.lure, a = lurePoint(0, L), b = lurePoint(1, L), c = lurePoint(3.25, L), d = lurePoint(0.25, L);
  assert(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9 && Math.hypot(c[0] - d[0], c[1] - d[1]) < 1e-9, 'closed: a phase of 1 is a turn');
  assert(Math.abs(a[0] - L.radius) < 1e-9 && Math.abs(a[1]) < 1e-9, 'phase 0 at a tip');
  let worst = 0; const N = 2000;
  for (let k = 0; k < N; k++) { const p = lurePoint(k / N, L), q = lurePoint((k + 1) / N, L); worst = Math.max(worst, Math.hypot(p[0] - q[0], p[1] - q[1])); }
  assert(worst < (L.radius * 8) / N, `smooth: no jump over a period (largest step ${worst.toFixed(4)} m)`);
  // alone it keeps its period
  let lone = { phase: 0, dir: 1 }; for (let k = 0; k < 60 * L.period; k++) lone = lureStep(lone, 1 / 60, L, null);
  assert(Math.min(lone.phase, 1 - lone.phase) < 1e-6, `one turn a period alone (${lone.phase})`);
  { const on = lurePoint(lone.phase, L); assert(Math.hypot(on[0] - lone.x, on[1] - lone.z) < 1e-9, 'alone it stays on its loop'); }
  // a chaser walking at it faster than the lure's mean speed, from the pack's seats: never within `ahead` after a step
  const len = (() => { let s = 0; for (let k = 0; k < N; k++) { const p = lurePoint(k / N, L), q = lurePoint((k + 1) / N, L); s += Math.hypot(p[0] - q[0], p[1] - q[1]); } return s; })();
  for (const speed of [0.6, 1.2, 2]) {
    const chaser = packSeats(3, { radius: L.radius, ...BESTIARY_STAGE.pack }).seats[0].slice(); let p = { phase: 0, dir: 1 }, closest = Infinity, jump = 0, prev = lurePoint(0, L);
    for (let k = 0; k < 60 * 120; k++) {
      p = lureStep(p, 1 / 60, L, chaser); const at = [p.x, p.z];
      closest = Math.min(closest, Math.hypot(at[0] - chaser[0], at[1] - chaser[1])); jump = Math.max(jump, Math.hypot(at[0] - prev[0], at[1] - prev[1])); prev = at;
      const dx = at[0] - chaser[0], dz = at[1] - chaser[1], dl = Math.hypot(dx, dz), v = (speed * len) / L.period / 60;
      if (dl > v) { chaser[0] += (dx / dl) * v; chaser[1] += (dz / dl) * v; }
    }
    assert(closest >= L.ahead - 1e-9, `a chaser at ${speed}x the lure's mean speed never closes within ${L.ahead} m (closest ${closest.toFixed(2)})`);
    assert(jump < 0.5, `the lure scurries, it does not leap (largest step ${jump.toFixed(3)} m a frame)`);
    assert(Math.hypot(p.x, p.z) <= L.radius * 1.6 + 1e-9, 'inside its bound');
  }
}

// 4. the pack: 3 and 6 seats, distinct, on a ring round a spot behind the lure's start
for (const n of BESTIARY_STAGE.packSizes) {
  const { centre, seats } = packSeats(n, { radius: BESTIARY_STAGE.lure.radius, ...BESTIARY_STAGE.pack });
  assert.equal(seats.length, n);
  for (const s of seats) assert(Math.abs(Math.hypot(s[0] - centre[0], s[1] - centre[1]) - BESTIARY_STAGE.pack.ring) < 1e-9, 'on the ring');
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert(Math.hypot(seats[i][0] - seats[j][0], seats[i][1] - seats[j][1]) > 1, `seats ${i} and ${j} distinct`);
  const start = lurePoint(0, BESTIARY_STAGE.lure); assert(Math.abs(Math.hypot(centre[0] - start[0], centre[1] - start[1]) - BESTIARY_STAGE.pack.back) < 1e-6, 'behind the lure\'s start');
}
assert.deepEqual([...BESTIARY_STAGE.packSizes], [3, 6]);

// 5. the sightings: a first meeting, a second run increments runs and keeps first; the stored text read back, anything malformed dropped
{
  let r = noteSighting({}, 'white', '2026-10-12');
  assert.deepEqual(r, { white: { first: '2026-10-12', runs: 1, last: '2026-10-12' } });
  const before = r; r = noteSighting(r, 'white', '2026-10-14');
  assert.deepEqual(r.white, { first: '2026-10-12', runs: 2, last: '2026-10-14' }, 'a second run: runs + 1, first kept'); assert.equal(before.white.runs, 1, 'the old record untouched');
  r = noteSighting(r, 'orange', '2026-10-14'); assert.equal(Object.keys(r).length, 2);
  assert.deepEqual(readSightings(JSON.stringify(r)), r, 'read back');
  assert.deepEqual(readSightings('not json'), {}); assert.deepEqual(readSightings(null), {}); assert.deepEqual(readSightings('[1]'), {});
  assert.deepEqual(readSightings(JSON.stringify({ white: { first: 'x', runs: 1, last: '2026-10-14' }, ok: { first: '2026-10-14', runs: 1, last: '2026-10-14' }, bad: { first: '2026-10-14', runs: 0, last: '2026-10-14' } })), { ok: { first: '2026-10-14', runs: 1, last: '2026-10-14' } });
  // the record rides exportRecords like the other records (a td. key under the wrapper's prefix)
  const backing = { store: new Map([[`stalheart:v1:${BESTIARY_STORE}`, JSON.stringify(r)]]), get length() { return this.store.size; }, key(i) { return [...this.store.keys()][i]; }, getItem(k) { return this.store.get(k) ?? null; } };
  assert.equal(exportRecords(backing).records[BESTIARY_STORE], JSON.stringify(r), 'exported with the records');
}

// 6. the content complete: every tier an entry with at least three lines, every creature one entry with at least two, the console's line
{
  for (const t of PEARL_TIERS) { const e = ENTRIES.find((x) => x.id === t.id); assert(e && e.kind === 'tier', `${t.id} has an entry`); assert(e.isao.length >= 3, `${t.id} has three lines`); }
  const creatures = ENTRIES.filter((e) => e.kind === 'creature');
  assert.deepEqual(creatures.map((e) => e.id), ['cutis', 'reed', 'nih-dairia']); for (const e of creatures) assert(e.isao.length >= 2 && e.label && Number.isInteger(e.swatch));
  assert.equal(new Set(ENTRIES.map((e) => e.id)).size, ENTRIES.length, 'one entry each');
  assert.equal(ENTRIES.find((e) => e.id === 'nih-dairia').stage, false, 'the Nih-Dairia\'s stage is out of this piece');
  for (const e of ENTRIES) for (const l of e.isao) assert(typeof l === 'string' && l.length > 10 && l.length < 200);
  assert.equal(TERMINAL.hint, 'TERMINAL · B'); assert.equal(TERMINAL.consoleTrigger, 'console_first'); assert(TERMINAL.consoleFirst.startsWith('There is a terminal under the gantry.'));
  assert.equal(TERMINAL.footer, '↑↓ ENTRIES · ⏎ PACK 3/6 · ESC CLOSE');
  for (const t of Object.keys(CREATURE_LABELS)) assert(spec[t], `${t} has a data row`);
}
console.log(`bestiary: ${roster.length} entries (${roster.filter((e) => e.kind === 'tier').length} tiers), three states, the lure ahead of its chasers, the sightings across runs`);
