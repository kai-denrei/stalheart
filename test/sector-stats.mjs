import assert from 'node:assert/strict';
import { makeSectorStats, record, report, reportMetrics, stampEarned, mergeBests, checkReport, campaignTotals, SOURCES } from '../src/domain/sector-stats.js';
import { sectorDef, makeSector, releaseWave, closeBreach, spendBreach } from '../src/domain/sectors.js';
import { SECTORS, SECTOR_GENERATOR, SECTOR_STATS, SECTOR_STAMPS, SECTOR_RECORDS, KILL_SOURCES, BELTS } from '../src/content/sectors.js';
import { DEBRIEF_FIXTURES } from '../src/content/debrief-fixtures.js';

const rules = { stamps: SECTOR_STAMPS, records: SECTOR_RECORDS };
const setup = (n = 1, t = 0) => {
  const sector = makeSector(sectorDef(n, SECTORS, SECTOR_GENERATOR), [{ id: 'g1', side: 'gate', cell: 5 }, { id: 'g2', side: n === 1 ? 'gate' : 'back', cell: 9 }], t);
  return { sector, stats: makeSectorStats(sector, t, SECTOR_STATS) };
};
const holdAll = (sector, t) => { for (const b of sector.breaches) { while (releaseWave(sector, b.id, t)); spendBreach(sector, b.id, t); } };

assert.deepEqual(Object.keys(KILL_SOURCES), SOURCES, 'content labels every source');

// the contract: every key present, every type right, on an empty sector and on a busy one
{
  const { sector, stats } = setup();
  const r = report(stats, sector, { t: 12, outcome: 'lost', ...rules });
  assert.deepEqual(checkReport(r), [], 'an empty report meets the contract');
  assert.deepEqual(Object.keys(r), ['sector', 'name', 'seconds', 'outcome', 'score', 'biomass', 'breaches', 'kills', 'tank', 'colony', 'stamps', 'records']);
  assert.deepEqual(Object.keys(r.breaches[0]), ['id', 'side', 'wavesPlanned', 'wavesFought', 'kills', 'closedBy', 'openSeconds', 'leftInField']);
  assert.deepEqual(Object.keys(r.kills.bySource), ['tank', 'ram', 'towers', 'gunship', 'laser', 'other']);
  assert.deepEqual(Object.keys(r.kills.byBelt), BELTS, 'every belt on the card from zero');
  assert.equal(r.kills.byTower.rotor, 0);
  assert.deepEqual(r.kills.tempo, [0, 0, 0], 'twelve seconds is three 5 s bins');
  assert.deepEqual(r.stamps, [], 'a lost empty sector earns nothing');
  assert.ok(r.records.every((x) => x.isNew === false && x.best === null));
}
assert.ok(checkReport({ sector: 1 }).length > 5, 'a malformed report is refused');
{
  const { sector, stats } = setup();
  const r = report(stats, sector, { t: 1, ...rules });
  assert.deepEqual(checkReport({ ...r, breaches: [{ ...r.breaches[0], closedBy: 'teeth' }] }), ['breaches[0].closedBy: teeth']);
  assert.deepEqual(checkReport({ ...r, kills: { ...r.kills, tempo: [1.5] } }), ['kills.tempo: not kill counts']);
}

// the accumulator: every event lands where the card reads it
{
  const { sector, stats } = setup(2, 100);
  assert.equal(record(stats, { type: 'teleport' }), false, 'unknown events are refused');
  assert.equal(record(stats, null), false);
  const ev = [
    { type: 'kill', source: 'tank', belt: 'white', breach: 'g1', t: 100 },
    { type: 'kill', source: 'ram', belt: 'white', breach: 'g1', t: 101 },
    { type: 'kill', source: 'towers', tower: 'rotor', belt: 'grey', breach: 'g2', t: 104.9 },
    { type: 'kill', source: 'towers', tower: 'quiver', belt: 'purple', breach: 'g2', t: 105 },
    { type: 'kill', source: 'gunship', gun: 'heavy', belt: 'white', t: 112 },
    { type: 'kill', source: 'laser', belt: 'white', t: 113 },
    { type: 'kill', source: 'teeth', t: 114 },
    { type: 'shot', hit: true }, { type: 'shot', hit: false }, { type: 'shot' },
    { type: 'ram', combo: 4 }, { type: 'ram', combo: 9 }, { type: 'ram', combo: 2 },
    { type: 'shield', seconds: 2.25 }, { type: 'shield', seconds: 1.5, station: true },
    { type: 'damage', amount: 0.5 }, { type: 'damage', amount: 0.25 }, { type: 'hullLost' },
    { type: 'partHome', part: 'breech' }, { type: 'print', id: 'solar' }, { type: 'print', id: 'walls' },
    { type: 'leak' }, { type: 'heartDamage', amount: 2 },
    { type: 'gunshipPass' }, { type: 'laserPass' }, { type: 'laserBurn', seconds: 3.33 }, { type: 'laserBurn', seconds: 1 },
    { type: 'biomass', earned: 120 }, { type: 'biomass', spent: 80 }, { type: 'biomass', earned: 15.4 },
    { type: 'score', points: 300, kind: 'kill' }, { type: 'score', points: 150, kind: 'ram' }, { type: 'score', points: 500, kind: 'bonus' },
  ];
  for (const e of ev) assert.equal(record(stats, e), true, e.type);
  releaseWave(sector, 'g1', 101); releaseWave(sector, 'g1', 102);
  closeBreach(sector, 'g1', 'laser', 110, { kg: 60, points: 700 });
  const r = report(stats, sector, { t: 131, bank: 222, ...rules });
  assert.deepEqual(checkReport(r), []);
  assert.equal(r.seconds, 31);
  assert.deepEqual(r.kills.bySource, { tank: 1, ram: 1, towers: 2, gunship: 1, laser: 1, other: 1 }, 'an unknown source is other');
  assert.equal(r.kills.total, 7);
  assert.deepEqual([r.kills.byTower.rotor, r.kills.byTower.quiver, r.kills.byGun.heavy], [1, 1, 1]);
  assert.deepEqual([r.kills.byBelt.white, r.kills.byBelt.grey, r.kills.byBelt.purple], [4, 1, 1]);
  assert.deepEqual(r.kills.tempo, [3, 1, 3, 0, 0, 0, 0], 'kills per 5 s bin, padded to the sector clock');
  assert.equal(r.kills.tempo.reduce((a, b) => a + b, 0), r.kills.total);
  assert.deepEqual(r.tank, { shotsFired: 3, shotsHit: 1, rams: 3, bestCombo: 9, shieldSeconds: 2.3, stationSeconds: 1.5, damageTaken: 0.8, hullsLost: 1, partsHome: ['breech'] });
  assert.deepEqual(r.colony, { prints: ['solar', 'walls'], leaks: 1, heartDamage: 2, gunshipPasses: 1, gunshipKills: 1, laserPasses: 1, laserSeconds: 4.3, laserKills: 1 });
  assert.deepEqual(r.score, { total: 950, kills: 300, rams: 150, bonuses: 500 });
  assert.deepEqual(r.biomass, { earned: 135, spent: 80, bank: 222, leftInField: 60 });
  assert.deepEqual(r.breaches, [
    { id: 'g1', side: 'gate', wavesPlanned: 4, wavesFought: 2, kills: 2, closedBy: 'laser', openSeconds: 10, leftInField: { kg: 60, points: 700 } },
    { id: 'g2', side: 'back', wavesPlanned: 4, wavesFought: 0, kills: 2, closedBy: null, openSeconds: 31, leftInField: { kg: 0, points: 0 } },
  ]);
  assert.deepEqual(r.stamps, ['special-delivery'], 'the part home is the only stamp');
  // the report is a copy: more events do not rewrite it
  record(stats, { type: 'partHome', part: 'lens' }); record(stats, { type: 'kill', source: 'tank', t: 120 });
  assert.deepEqual(r.tank.partsHome, ['breech']); assert.equal(r.kills.tempo[4], 0);
}

// each stamp: earned on its rule, lost when one condition slips
const stamp = (id) => SECTOR_STAMPS.find((s) => s.id === id);
const secureRun = (feed, { closeWith = null, fought = null } = {}) => {
  const { sector, stats } = setup(1);
  for (const b of sector.breaches) {
    if (closeWith) { for (let i = 0; i < fought; i++) releaseWave(sector, b.id, 1); closeBreach(sector, b.id, closeWith, 20, { kg: 10, points: 10 }); }
    else { while (releaseWave(sector, b.id, 1)); spendBreach(sector, b.id, 50); }
  }
  feed(stats);
  return report(stats, sector, { t: 60, ...rules });
};
const has = (r, id) => r.stamps.includes(id);
const none = () => {};
assert.ok(has(secureRun(none), 'flawless'));
assert.ok(!has(secureRun((s) => record(s, { type: 'leak' })), 'flawless'), 'a leak spoils flawless');
assert.ok(!has(secureRun((s) => record(s, { type: 'heartDamage', amount: 1 })), 'flawless'), 'heart damage spoils flawless');
{ const { sector, stats } = setup(); holdAll(sector, 5); assert.ok(!has(report(stats, sector, { t: 9, outcome: 'lost', ...rules }), 'flawless'), 'a lost sector is never flawless'); }
assert.ok(has(secureRun(none), 'held-the-line'));
assert.ok(!has(secureRun(none, { closeWith: 'gunship', fought: 3 }), 'held-the-line'), 'closed breaches did not hold');
assert.ok(has(secureRun(none, { closeWith: 'shells', fought: 1 }), 'quick-hands'), 'one of three waves is before half');
assert.ok(!has(secureRun(none, { closeWith: 'shells', fought: 2 }), 'quick-hands'), 'two of three is not');
assert.ok(!has(secureRun(none), 'quick-hands'), 'held breaches are not quick');
assert.ok(has(secureRun((s) => record(s, { type: 'ram', combo: 20 })), 'ram-king'));
assert.ok(!has(secureRun((s) => record(s, { type: 'ram', combo: 19 })), 'ram-king'));
const shots = (n, hits) => (s) => { for (let i = 0; i < n; i++) record(s, { type: 'shot', hit: i < hits }); };
assert.ok(has(secureRun(shots(30, 18)), 'sharpshooter'), '18 of 30');
assert.ok(!has(secureRun(shots(30, 17)), 'sharpshooter'), '17 of 30');
assert.ok(!has(secureRun(shots(29, 29)), 'sharpshooter'), 'not with fewer than 30 shots');
const kills = (source, n) => (s) => { for (let i = 0; i < n; i++) record(s, { type: 'kill', source, t: i }); };
assert.ok(has(secureRun(kills('laser', 25)), 'scorched-earth'));
assert.ok(!has(secureRun(kills('laser', 24)), 'scorched-earth'));
assert.ok(has(secureRun(kills('ram', 10)), 'not-a-scratch'), 'ten under the treads and no damage');
assert.ok(!has(secureRun((s) => { kills('tank', 10)(s); record(s, { type: 'damage', amount: 0.1 }); }), 'not-a-scratch'));
assert.ok(!has(secureRun((s) => { kills('tank', 10)(s); record(s, { type: 'hullLost' }); }), 'not-a-scratch'));
assert.ok(!has(secureRun(kills('tank', 9)), 'not-a-scratch'));
assert.ok(has(secureRun((s) => record(s, { type: 'partHome', part: 'lens' })), 'special-delivery'));
assert.ok(!has(secureRun(none), 'special-delivery'));
assert.ok(has(secureRun(kills('gunship', 30)), 'close-air-support'));
assert.ok(!has(secureRun(kills('gunship', 29)), 'close-air-support'));
assert.equal(stampEarned({ rules: [['kills', 'bogus', 1]] }, { kills: 1 }), false, 'an unknown op never earns');
assert.ok(SECTOR_STAMPS.every((s) => s.rules.every(([k, , v]) => k in reportMetrics(secureRun(none)) && (typeof v !== 'string' || v in reportMetrics(secureRun(none))))), 'every stamp reads real metrics');

// records: isNew against the bests, lower-is-better and secure-only, and the merge
{
  const r = secureRun((s) => { kills('ram', 12)(s); record(s, { type: 'ram', combo: 12 }); record(s, { type: 'score', points: 900, kind: 'ram' }); });
  const rec = (rs, key) => rs.records.find((x) => x.key === key);
  assert.deepEqual(r.records.map((x) => x.key), ['sector.score', 'sector.kills', 'sector.bestCombo', 'sector.gunshipKills', 'sector.laserKills', 'sector.1.fastest']);
  assert.deepEqual(rec(r, 'sector.bestCombo'), { key: 'sector.bestCombo', label: 'BEST RAM COMBO', value: 12, best: null, isNew: true }, 'the first is a record');
  assert.equal(rec(r, 'sector.gunshipKills').isNew, false, 'zero is never a record');
  const bests = { 'sector.score': 1000, 'sector.kills': 12, 'sector.bestCombo': 8, 'sector.1.fastest': 61 };
  const again = report(...(() => { const { sector, stats } = setup(); holdAll(sector, 50); kills('ram', 12)(stats); record(stats, { type: 'ram', combo: 12 }); record(stats, { type: 'score', points: 900, kind: 'ram' }); return [stats, sector]; })(), { t: 60, bests, ...rules });
  assert.deepEqual([rec(again, 'sector.score').isNew, rec(again, 'sector.score').best], [false, 1000], 'below the best');
  assert.equal(rec(again, 'sector.kills').isNew, false, 'equal is not a record');
  assert.equal(rec(again, 'sector.bestCombo').isNew, true);
  assert.equal(rec(again, 'sector.1.fastest').isNew, true, '60 s beats 61 s');
  const lost = report(...(() => { const { sector, stats } = setup(); return [stats, sector]; })(), { t: 30, outcome: 'lost', bests, ...rules });
  assert.equal(rec(lost, 'sector.1.fastest').isNew, false, 'a lost sector sets no fastest');
  assert.deepEqual(mergeBests(bests, again.records), { ...bests, 'sector.bestCombo': 12, 'sector.1.fastest': 60 });
  assert.equal(report(...(() => { const { sector, stats } = setup(4); return [stats, sector]; })(), { t: 5, ...rules }).records[5].key, 'sector.4.fastest');
}

// the campaign card
{
  const a = secureRun((s) => { kills('tank', 3)(s); record(s, { type: 'ram', combo: 7 }); record(s, { type: 'biomass', earned: 100, spent: 40 }); record(s, { type: 'print', id: 'solar' }); });
  const b = secureRun((s) => { kills('laser', 25)(s); record(s, { type: 'ram', combo: 4 }); record(s, { type: 'laserBurn', seconds: 2.5 }); record(s, { type: 'print', id: 'walls' }); }, { closeWith: 'laser', fought: 1 });
  const c = campaignTotals([a, b]);
  assert.deepEqual(c.sectors.map((x) => [x.sector, x.kills, x.leftInField]), [[1, 3, 0], [1, 25, 20]]);
  assert.equal(c.totals.sectors, 2); assert.equal(c.totals.secure, 2); assert.equal(c.totals.seconds, 120);
  assert.equal(c.totals.kills.total, 28); assert.equal(c.totals.kills.bySource.laser, 25);
  assert.equal(c.totals.tank.bestCombo, 7, 'best of, not a sum');
  assert.deepEqual(c.totals.colony.prints, ['solar', 'walls']);
  assert.deepEqual(c.totals.breaches, { total: 4, held: 2, closed: 2 });
  assert.deepEqual(c.totals.leftInField, { kg: 20, points: 20 });
  assert.equal(c.totals.stamps.flawless, 2); assert.equal(c.totals.stamps['scorched-earth'], 1);
  assert.equal(c.totals.biomass.bank, 0);
  assert.deepEqual(campaignTotals([]).totals.sectors, 0);
}

// the fixtures the debrief card builds against meet the contract and say what their names say
const { secure, flawless, lost, campaign } = DEBRIEF_FIXTURES;
for (const [name, r] of [['secure', secure], ['flawless', flawless], ['lost', lost], ...campaign.map((r, i) => [`campaign[${i}]`, r])]) {
  assert.deepEqual(checkReport(r), [], `${name} meets the contract`);
  assert.ok(r.kills.tempo.reduce((a, b) => a + b, 0) === r.kills.total && r.kills.tempo.length === Math.max(1, Math.ceil(r.seconds / 5)), `${name}: tempo adds up`);
  assert.equal(Object.values(r.kills.bySource).reduce((a, b) => a + b, 0), r.kills.total, `${name}: attribution adds up`);
  assert.equal(r.breaches.reduce((a, b) => a + b.leftInField.kg, 0), r.biomass.leftInField, `${name}: left in the field adds up`);
}
assert.deepEqual([secure.sector, secure.outcome], [1, 'secure']);
assert.deepEqual([flawless.sector, flawless.outcome], [2, 'secure']);
assert.ok(flawless.stamps.includes('flawless') && flawless.colony.laserKills > 0 && flawless.colony.laserPasses > 0, 'flawless with the laser');
assert.deepEqual([lost.sector, lost.outcome, lost.stamps.includes('flawless')], [3, 'lost', false]);
assert.deepEqual(campaign.map((r) => [r.sector, r.outcome]), [[1, 'secure'], [2, 'secure'], [3, 'secure']]);
assert.ok(Object.isFrozen(secure.kills.tempo), 'fixtures are frozen');
assert.equal(campaignTotals(campaign).totals.secure, 3);
console.log('Sector stats: events, the report contract, tempo bins, each stamp, records and bests, the campaign card, the debrief fixtures.');
