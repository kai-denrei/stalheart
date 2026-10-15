// tune.mjs — the tune panel's rules: tier keys, what is on screen, a knob's effective value, the report RECORD writes
import assert from 'node:assert/strict';
import { tierKeyOf, screenTiers, effective, changed, tuneReport } from '../src/domain/tune.js';
const pearlOf = { amoeba: 'white', drifter: 'orange' };
assert.equal(tierKeyOf({ type: 'amoeba' }, pearlOf), 'pearl:white'); assert.equal(tierKeyOf({ type: 'reed', tier: 'pup' }, pearlOf), 'reed:pup');
assert.equal(tierKeyOf({ type: 'jelly' }, pearlOf), 'jelly'); assert.equal(tierKeyOf({ type: 'amoeba', tier: 'amoeba' }, pearlOf), 'pearl:white', 'a dressed Pearl entry carries its type as its tier'); assert.equal(tierKeyOf(null, pearlOf), null);
const es = [{ alive: true, type: 'amoeba' }, { alive: true, type: 'amoeba' }, { alive: false, type: 'amoeba' }, { alive: true, type: 'drifter' }, { alive: true, type: 'reed', tier: 'small' }, { alive: true, type: 'amoeba', members: 3 }];
assert.deepEqual(screenTiers(es, pearlOf), [{ key: 'pearl:white', count: 5 }, { key: 'pearl:orange', count: 1 }, { key: 'reed:small', count: 1 }], 'most first, a squad as its members, the dead left out');
assert.deepEqual(screenTiers(null), []);
const mul = { id: 'a', path: 'PEARL_PACE.white.speed', label: 'white speed', kind: 'mul', base: 1.15, value: 1.2, default: 1 };
const abs = { id: 'b', path: 'HULL_ARMOUR.hits', label: 'hits a hull', kind: 'abs', base: 4, value: 6, default: 4 };
assert.equal(effective(mul), 1.38); assert.equal(effective(abs), 6);
assert.deepEqual(changed([mul, abs, { ...abs, value: 4 }]).map((k) => k.id), ['a', 'b']);
const r = tuneReport({ rev: 'd0a4d62a', url: 'index.html?x#td', at: '2026-10-16 08:10', sector: '3 · THE CANYON', screen: [{ key: 'pearl:white', count: 40 }], knobs: [mul, abs, { ...abs, id: 'c', value: 4 }] });
assert.match(r, /^## 2026-10-16 08:10 · d0a4d62a\n/); assert.match(r, /- sector: 3 · THE CANYON\n/); assert.match(r, /- on screen: pearl:white x40\n/);
assert.match(r, /- PEARL_PACE.white.speed: 1.15 -> 1.38 \(x1.2\)   white speed\n/); assert.match(r, /- HULL_ARMOUR.hits: 4 -> 6   hits a hull\n/); assert.ok(!/id: 'c'|-> 4 /.test(r), 'an unchanged knob is not a line');
assert.match(tuneReport({ knobs: [] }), /\(nothing changed\)/);
console.log('Tune: tier keys, the screen\'s tiers, effective values, the report.');
