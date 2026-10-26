// THE WHOLE TERMINAL (owner, 2026-10-27: "expand the B Bestiary to have ALL the units, including the friendlies and neutral, buildings, etc.";
// src/domain/bestiary.js terminalRoster / unitState / unitCard, src/content/bestiary.js SECTIONS / UNIT_ENTRIES): the roster keeps the eleven
// hostiles first and numbers the colony's entries after them by section; every entry's `needs` is one the rule knows and every pinned model
// is on disk; the eight sentries, the hull, Isao, the Ridgeback, the gunship, the SOLs and every printed structure have entries; unitState
// opens each kind of need on exactly its signal (the lab's host opens all); the card's shapes for an open and a locked entry.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { bestiaryRoster, terminalRoster, unitState, unitCard, UNIT_NEEDS } from '../src/domain/bestiary.js';
import { ENTRIES, TERMINAL, SECTIONS, UNIT_ENTRIES, BESTIARY_BENCH, CREATURE_SPEC } from '../src/content/bestiary.js';
import { PEARL_TIERS, PEARL_OF } from '../src/content/pearl-enemies.js';
import { SENTRIES } from '../src/content/sentries.js';
import { BASE_PROGRAMME } from '../src/content/base-programme.js';
import { ENEMY_SPEC } from '../src/enemyspec.js';

const hostile = bestiaryRoster({ entries: ENTRIES, tiers: PEARL_TIERS, of: PEARL_OF, spec: { ...ENEMY_SPEC, ...CREATURE_SPEC } });
const roster = terminalRoster(hostile, UNIT_ENTRIES, SECTIONS);

// 1. the roster: the hostiles first in their order, then the colony by section, one numbering over all
assert.deepEqual(roster.slice(0, hostile.length).map((e) => e.id), hostile.map((e) => e.id));
assert(roster.slice(0, hostile.length).every((e) => e.section === 'hostile' && e.kind !== 'unit'));
assert.equal(roster.length, hostile.length + UNIT_ENTRIES.length);
assert.deepEqual(roster.map((e) => e.index), roster.map((_, k) => k + 1)); assert(roster.every((e) => e.total === roster.length));
const order = SECTIONS.map((s) => s.id), secs = roster.map((e) => order.indexOf(e.section));
assert(secs.every((v, k) => v >= 0 && (k === 0 || v >= secs[k - 1])), `sections in SECTIONS' order (${secs})`);
assert.deepEqual([...new Set(roster.map((e) => e.section))], order, 'every section has an entry');
assert.equal(new Set(roster.map((e) => e.id)).size, roster.length, 'ids unique across hostiles and the colony');

// 2. the entries: a known need each, a model on disk or a builder or a sentry; the eight sentries, the hull, Isao, the mech, the sky, every structure step
for (const u of UNIT_ENTRIES) {
  const keys = Object.keys(u.needs ?? {});
  assert.equal(keys.length, 1, `${u.id}: one need`); assert(UNIT_NEEDS.includes(keys[0]), `${u.id}: a known need (${keys[0]})`);
  if (u.model?.url) assert(existsSync(u.model.url), `${u.id}: ${u.model.url} on disk`);
  assert(u.model?.url || u.tower || u.build, `${u.id}: a model, a sentry or a builder`);
  assert(u.isao.length >= 2, `${u.id}: Isao's lines`); assert(u.facts.length >= 1, `${u.id}: a fact`); assert(typeof u.swatch === 'number');
}
for (const s of SENTRIES) { const u = UNIT_ENTRIES.find((e) => e.tower === s.key); assert(u && u.needs.sentry === s.key, `${s.key} has a sentry entry`); }
for (const id of ['mork', 'isao', 'mx06', 'feids26', 'korp', 'sol82', 'sol88', 'container', 'shells', 'ball']) assert(UNIT_ENTRIES.some((e) => e.id === id), id);
for (const st of BASE_PROGRAMME.filter((s) => s.perk)) assert(UNIT_ENTRIES.some((e) => e.needs.perk === st.perk), `the ${st.id} step's perk ${st.perk} opens an entry`);

// 3. unitState: each need on exactly its signal; nothing without a world but the always entries; the lab's host opens all
const by = (id) => roster.find((e) => e.id === id), none = {};
assert.equal(unitState(by('mork'), none), 'full'); assert.equal(unitState(by('mork'), null), 'full');
assert.equal(unitState(by('radar'), none), 'unseen'); assert.equal(unitState(by('radar'), { perks: new Set(['uplink']) }), 'full'); assert.equal(unitState(by('radar'), { perks: ['uplink'] }), 'full'); assert.equal(unitState(by('radar'), { perks: ['gate'] }), 'unseen');
assert.equal(unitState(by('rotor'), { sentries: ['rotor'] }), 'full'); assert.equal(unitState(by('rotor'), { sentries: ['plasma'] }), 'unseen');
assert.equal(unitState(by('mx06'), { mechs: true }), 'full'); assert.equal(unitState(by('mx06'), { mechs: false }), 'unseen');
assert.equal(unitState(by('sol82'), { sector: 3 }), 'full'); assert.equal(unitState(by('sol82'), { sector: 2 }), 'unseen');
assert.equal(unitState(by('sol88'), { sol88: true }), 'full'); assert.equal(unitState(by('sol88'), { perks: ['launcher'] }), 'unseen', 'the launcher printed is not the launch');
assert.equal(unitState(by('ball'), { ball: true }), 'full'); assert.equal(unitState(by('ball'), {}), 'unseen');
for (const e of roster.filter((x) => x.kind === 'unit')) assert.equal(unitState(e, null, true), 'full', `${e.id}: the lab opens it`);

// 4. the card: open shows the facts and the text; locked the dashes and the note; a sentry's extra rows are appended
{
  const c = unitCard(by('mork'), 'full', { copy: TERMINAL });
  assert.equal(c.head, `ENTRY ${String(by('mork').index).padStart(2, '0')} / ${String(roster.length).padStart(2, '0')} · COLONY · THE HULL`);
  assert.equal(c.name, 'MÖRK · HOVER TANK'); assert(c.facts.length >= 3); assert.equal(c.text.length, 2); assert.equal(c.note, null); assert.equal(c.selectable, true); assert.deepEqual(c.data, []);
  const l = unitCard(by('radar'), 'unseen', { copy: TERMINAL });
  assert.equal(l.name, TERMINAL.unseenName); assert.deepEqual(l.facts, []); assert.equal(l.text, null); assert.equal(l.note, TERMINAL.lockedNote); assert.equal(l.selectable, false);
  const s = unitCard(by('rotor'), 'full', { copy: TERMINAL, facts: [['COST', '45 kg']] });
  assert.deepEqual(s.facts[s.facts.length - 1], ['COST', '45 kg']);
}
assert.equal(typeof BESTIARY_BENCH.wire, 'boolean'); assert(BESTIARY_BENCH.orbit.radius > 1 && BESTIARY_BENCH.orbit.period > 0);
console.log(`Bestiary, the whole terminal: ${hostile.length} hostiles then ${UNIT_ENTRIES.length} colony entries in ${SECTIONS.length} sections, every need known, every model on disk, each need opened by its signal, the card's two shapes.`);
