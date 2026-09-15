// The debrief's sample reports against the V1 report contract (docs/superpowers/specs/2026-09-15-v1-session-design.md,
// section 4), and the card's pure formatting helpers (src/core/debrief-format.js). A key added to or dropped from the
// contract, the samples or the card's reading of them fails here before a browser ever opens.
import assert from 'node:assert/strict';
import { DEBRIEF_SAMPLES, DEBRIEF_SAMPLE_ISAO } from '../src/content/debrief-samples.js';
import {
  formatInt, formatClock, formatValue, accuracy, closedByLabel, sideLabel, breachLetter, stampLabel, stampNote,
  beltEntries, sourceRows, debriefPageLabels, tempoPath, campaignTotals, easeRoll, easeGrow,
} from '../src/core/debrief-format.js';

const KEYS = {
  report: ['sector', 'name', 'seconds', 'outcome', 'score', 'biomass', 'breaches', 'kills', 'tank', 'colony', 'stamps', 'records'],
  score: ['total', 'kills', 'rams', 'bonuses'],
  biomass: ['earned', 'spent', 'bank', 'leftInField'],
  breach: ['id', 'side', 'wavesPlanned', 'wavesFought', 'kills', 'closedBy', 'openSeconds', 'leftInField'],
  leftInField: ['kg', 'points'],
  kills: ['total', 'bySource', 'byTower', 'byBelt', 'tempo'],
  bySource: ['tank', 'ram', 'towers', 'gunship', 'laser', 'other'],
  tank: ['shotsFired', 'shotsHit', 'rams', 'bestCombo', 'shieldSeconds', 'stationSeconds', 'damageTaken', 'hullsLost', 'partsHome'],
  colony: ['prints', 'leaks', 'heartDamage', 'gunshipPasses', 'gunshipKills', 'laserPasses', 'laserSeconds', 'laserKills'],
  record: ['key', 'label', 'value', 'best', 'isNew'],
  totals: ['sectors', 'seconds', 'score', 'kills', 'biomassEarned', 'leftInField', 'hullsLost', 'partsHome', 'stamps'],
};
const CLOSERS = ['gunship', 'laser', 'shells', 'strike', 'held', null];
const sameKeys = (obj, keys, where) => assert.deepEqual(Object.keys(obj).sort(), [...keys].sort(), `${where}: keys match the contract`);
const count = (v, where) => assert.ok(Number.isInteger(v) && v >= 0, `${where}: a non-negative integer (${v})`);
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

function checkReport(r, where) {
  sameKeys(r, KEYS.report, where);
  count(r.sector, `${where}.sector`); count(r.seconds, `${where}.seconds`);
  assert.ok(typeof r.name === 'string' && r.name.length, `${where}.name`);
  assert.ok(['secure', 'lost'].includes(r.outcome), `${where}.outcome`);
  sameKeys(r.score, KEYS.score, `${where}.score`); for (const k of KEYS.score) count(r.score[k], `${where}.score.${k}`);
  assert.equal(r.score.total, r.score.kills + r.score.rams + r.score.bonuses, `${where}: score parts add up`);
  sameKeys(r.biomass, KEYS.biomass, `${where}.biomass`); for (const k of KEYS.biomass) count(r.biomass[k], `${where}.biomass.${k}`);
  assert.ok(Array.isArray(r.breaches) && r.breaches.length === 2, `${where}: two breaches a sector`);
  r.breaches.forEach((b, i) => {
    const w = `${where}.breaches[${i}]`;
    sameKeys(b, KEYS.breach, w);
    assert.ok(['gate', 'back'].includes(b.side), `${w}.side`);
    assert.ok(CLOSERS.includes(b.closedBy), `${w}.closedBy`);
    for (const k of ['wavesPlanned', 'wavesFought', 'kills', 'openSeconds']) count(b[k], `${w}.${k}`);
    assert.ok(b.wavesFought <= b.wavesPlanned, `${w}: fought no more waves than planned`);
    sameKeys(b.leftInField, KEYS.leftInField, `${w}.leftInField`);
    if (b.closedBy === 'held') assert.equal(b.leftInField.kg, 0, `${w}: a held breach leaves nothing in the field`);
  });
  assert.equal(r.breaches.reduce((a, b) => a + b.leftInField.kg, 0), r.biomass.leftInField, `${where}: breach forfeits add up to biomass.leftInField`);
  const k = r.kills;
  sameKeys(k, KEYS.kills, `${where}.kills`);
  sameKeys(k.bySource, KEYS.bySource, `${where}.kills.bySource`);
  assert.equal(sum(k.bySource), k.total, `${where}: kill sources add up`);
  assert.equal(sum(k.byTower), k.bySource.towers, `${where}: tower kinds add up to tower kills`);
  assert.equal(sum(k.byBelt), k.total, `${where}: belts add up`);
  assert.equal(k.tempo.length, Math.ceil(r.seconds / 5), `${where}: one tempo bin per 5 s`);
  assert.equal(k.tempo.reduce((a, b) => a + b, 0), k.total, `${where}: tempo bins add up`);
  assert.ok(r.breaches.reduce((a, b) => a + b.kills, 0) <= k.total, `${where}: breach kills within the total`);
  sameKeys(r.tank, KEYS.tank, `${where}.tank`); for (const key of KEYS.tank) count(r.tank[key], `${where}.tank.${key}`);
  assert.ok(r.tank.shotsHit <= r.tank.shotsFired, `${where}: hits within shots`);
  sameKeys(r.colony, KEYS.colony, `${where}.colony`);
  assert.ok(Array.isArray(r.colony.prints) && r.colony.prints.every((p) => typeof p === 'string'), `${where}.colony.prints`);
  assert.ok(Array.isArray(r.stamps) && r.stamps.every((s) => /^[a-z]+(-[a-z]+)*$/.test(s)), `${where}.stamps are ids`);
  r.records.forEach((rec, i) => { sameKeys(rec, KEYS.record, `${where}.records[${i}]`); assert.equal(typeof rec.isNew, 'boolean'); });
}

for (const name of ['secure', 'flawless', 'lost']) checkReport(DEBRIEF_SAMPLES[name], name);
assert.equal(DEBRIEF_SAMPLES.lost.outcome, 'lost');
assert.deepEqual(DEBRIEF_SAMPLES.flawless.stamps.slice(0, 1), ['flawless']);
assert.equal(DEBRIEF_SAMPLES.flawless.colony.leaks + DEBRIEF_SAMPLES.flawless.colony.heartDamage, 0, 'flawless means no leaks and an untouched heart');
sameKeys(DEBRIEF_SAMPLES.campaign, ['reports', 'totals'], 'campaign');
assert.equal(DEBRIEF_SAMPLES.campaign.reports.length, 3, 'the campaign card holds three sectors');
DEBRIEF_SAMPLES.campaign.reports.forEach((r, i) => { checkReport(r, `campaign.reports[${i}]`); assert.equal(r.sector, i + 1); assert.equal(r.outcome, 'secure'); });
sameKeys(DEBRIEF_SAMPLES.campaign.totals, KEYS.totals, 'campaign.totals');
assert.deepEqual(DEBRIEF_SAMPLES.campaign.totals, campaignTotals(DEBRIEF_SAMPLES.campaign.reports));
assert.ok(Object.isFrozen(DEBRIEF_SAMPLES.secure.kills.tempo), 'samples are frozen');
for (const name of ['secure', 'flawless', 'lost', 'campaign']) assert.equal(DEBRIEF_SAMPLE_ISAO[name].length, 2, `Isao has two lines for ${name}`);

// the formatting helpers
assert.equal(formatInt(0), '0'); assert.equal(formatInt(999), '999'); assert.equal(formatInt(1000), '1,000');
assert.equal(formatInt(1234567.4), '1,234,567'); assert.equal(formatInt(-4200), '-4,200'); assert.equal(formatInt(undefined), '0');
assert.equal(formatClock(0), '0:00'); assert.equal(formatClock(312), '5:12'); assert.equal(formatClock(59.6), '1:00'); assert.equal(formatClock(3725), '1:02:05');
assert.equal(formatValue(61, 'pct'), '61%'); assert.equal(formatValue(12, 'combo'), '×12'); assert.equal(formatValue(46, 'sec'), '46 S'); assert.equal(formatValue(18420), '18,420');
assert.equal(accuracy(131, 214).toFixed(3), '0.612'); assert.equal(accuracy(5, 0), 0); assert.equal(accuracy(9, 4), 1);
assert.deepEqual(closedByLabel('gunship'), { label: '105', note: 'GUNSHIP' });
assert.equal(closedByLabel('laser').label, 'SOL-82'); assert.equal(closedByLabel('held').label, 'HELD'); assert.equal(closedByLabel(null).label, 'OPEN');
assert.equal(sideLabel('gate'), 'GATE SIDE'); assert.equal(sideLabel('back'), 'BACK DOOR');
assert.equal(breachLetter(0), 'A'); assert.equal(breachLetter(1), 'B');
for (const key of ['held-the-line', 'held_the_line', 'HELD THE LINE']) assert.equal(stampLabel(key), 'HELD THE LINE');
assert.equal(stampNote('flawless'), 'NO LEAKS · HEART UNTOUCHED'); assert.equal(stampNote('unheard-of'), ''); assert.equal(stampLabel('unheard-of'), 'UNHEARD OF');
assert.deepEqual(beltEntries({ yellow: 2, white: 5, mystery: 1 }, ['white', 'grey', 'yellow']).map((b) => [b.key, b.value]), [['white', 5], ['yellow', 2], ['mystery', 1]]);
assert.equal(beltEntries({ yellowPale: 1 }, []).at(0).label, 'YELLOW PALE');
assert.deepEqual(sourceRows(DEBRIEF_SAMPLES.secure.kills).map((r) => r.label), ['TANK GUN', 'RAM', 'TOWERS', 'ROTOR', 'QUIVER', 'GUNSHIP', 'SOL-82', 'OTHER']);
assert.deepEqual(debriefPageLabels(DEBRIEF_SAMPLES.secure), ['SECURE', 'THE BREACHES', 'THE KILLS', 'THE TANK', 'THE COLONY']);
assert.equal(debriefPageLabels(DEBRIEF_SAMPLES.lost)[0], 'LAST TRANSMISSION');
{
  const t = tempoPath([0, 4, 10, 2], 300, 60, 0);
  assert.equal(t.line, 'M0,60 L100,36 L200,0 L300,48');
  assert.equal(t.area, 'M0,60 L0,60 L100,36 L200,0 L300,48 L300,60 Z');
  assert.deepEqual(t.peak, { index: 2, value: 10, x: 200, y: 0, seconds: 10 });
  assert.equal(tempoPath([], 300, 60).line, ''); assert.equal(tempoPath([], 300, 60).peak, null);
  assert.equal(tempoPath([3], 300, 60, 0).line, 'M0,0 L300,0');
}
assert.equal(easeRoll(0), 0); assert.equal(easeRoll(1), 1); assert.equal(easeRoll(2), 1); assert.ok(easeRoll(0.5) > 0.9);
assert.equal(easeGrow(0), 0); assert.equal(easeGrow(1), 1); assert.equal(easeGrow(0.5), 0.5);
console.log('Sector debrief: the samples keep the report contract and add up; labels, clocks and the tempo line format.');
