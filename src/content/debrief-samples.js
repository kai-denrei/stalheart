// SAMPLE SECTOR REPORTS for the debrief lab (labs.html#debrief) and the debrief's browser step. Each follows the V1
// session design's report contract exactly (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 4), so
// test/sector-debrief-samples.mjs catches drift between the contract, these samples and the card. The integrator may
// swap them for the stats accumulator's own fixtures. Invented numbers, internally consistent: the kill sources, the
// tower kinds, the belts and the tempo bins each add up to the sector's kill total.
import { campaignTotals } from '../core/debrief-format.js';

/** kills per 5 s bin: a quiet floor plus a hump per wave, integers that add up to `total` exactly */
function tempo(seconds, total, waves) {
  const n = Math.ceil(seconds / 5);
  const w = Array.from({ length: n }, (_, i) => {
    const t = i * 5;
    return 0.12 + waves.reduce((a, [at, width, weight]) => a + weight * Math.exp(-(((t - at) / width) ** 2)), 0);
  });
  const scale = total / w.reduce((a, b) => a + b, 0);
  const raw = w.map((v) => v * scale), bins = raw.map(Math.floor);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0, left = total - bins.reduce((a, b) => a + b, 0); k < left; k++) bins[order[k % n][1]]++;
  return bins;
}

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };

const secure = {
  sector: 1, name: 'THE LANE', seconds: 312, outcome: 'secure',
  score: { total: 18420, kills: 12600, rams: 3120, bonuses: 2700 },
  biomass: { earned: 1480, spent: 1150, bank: 590, leftInField: 260 },
  breaches: [
    { id: 'lane-a', side: 'gate', wavesPlanned: 3, wavesFought: 3, kills: 142, closedBy: 'held', openSeconds: 288, leftInField: { kg: 0, points: 0 } },
    { id: 'lane-b', side: 'gate', wavesPlanned: 3, wavesFought: 2, kills: 97, closedBy: 'gunship', openSeconds: 171, leftInField: { kg: 260, points: 3400 } },
  ],
  kills: {
    total: 239,
    bySource: { tank: 61, ram: 38, towers: 104, gunship: 31, laser: 0, other: 5 },
    byTower: { rotor: 71, quiver: 33 },
    byBelt: { white: 150, grey: 52, yellowPale: 25, yellow: 12 },
    tempo: tempo(312, 239, [[40, 22, 1], [130, 26, 1.4], [235, 30, 1.8]]),
  },
  tank: { shotsFired: 214, shotsHit: 131, rams: 38, bestCombo: 12, shieldSeconds: 46, stationSeconds: 18, damageTaken: 340, hullsLost: 1, partsHome: 1 },
  colony: { prints: ['solar', 'walls'], leaks: 3, heartDamage: 6, gunshipPasses: 2, gunshipKills: 31, laserPasses: 0, laserSeconds: 0, laserKills: 0 },
  stamps: ['held-the-line', 'ram-king'],
  records: [
    { key: 'sector-kills', label: 'KILLS IN A SECTOR', value: 239, best: 239, isNew: true },
    { key: 'sector-score', label: 'SECTOR SCORE', value: 18420, best: 18420, isNew: true },
    { key: 'best-combo', label: 'RAM COMBO', value: 12, best: 17, isNew: false },
  ],
};

const flawless = {
  sector: 2, name: 'THE BACK DOOR', seconds: 268, outcome: 'secure',
  score: { total: 31760, kills: 21900, rams: 4460, bonuses: 5400 },
  biomass: { earned: 2310, spent: 1720, bank: 1180, leftInField: 540 },
  breaches: [
    { id: 'door-a', side: 'gate', wavesPlanned: 4, wavesFought: 4, kills: 214, closedBy: 'held', openSeconds: 262, leftInField: { kg: 0, points: 0 } },
    { id: 'door-b', side: 'back', wavesPlanned: 4, wavesFought: 2, kills: 118, closedBy: 'laser', openSeconds: 124, leftInField: { kg: 540, points: 7200 } },
  ],
  kills: {
    total: 332,
    bySource: { tank: 74, ram: 52, towers: 96, gunship: 22, laser: 88, other: 0 },
    byTower: { rotor: 48, quiver: 31, relay: 17 },
    byBelt: { white: 120, grey: 84, yellowPale: 58, yellow: 36, bluePale: 22, orange: 12 },
    tempo: tempo(268, 332, [[35, 18, 1], [98, 14, 2.6], [150, 24, 1.3], [215, 22, 1.7]]),
  },
  tank: { shotsFired: 188, shotsHit: 149, rams: 52, bestCombo: 19, shieldSeconds: 21, stationSeconds: 30, damageTaken: 0, hullsLost: 0, partsHome: 2 },
  colony: { prints: ['bays', 'hugin-arm', 'radar'], leaks: 0, heartDamage: 0, gunshipPasses: 2, gunshipKills: 22, laserPasses: 2, laserSeconds: 14, laserKills: 88 },
  stamps: ['flawless', 'sharpshooter', 'quick-hands', 'scorched-earth'],
  records: [
    { key: 'sector-score', label: 'SECTOR SCORE', value: 31760, best: 31760, isNew: true },
    { key: 'sector-kills', label: 'KILLS IN A SECTOR', value: 332, best: 332, isNew: true },
    { key: 'laser-kills', label: 'SOL-82 KILLS IN ONE PASS', value: 61, best: 61, isNew: true },
    { key: 'best-combo', label: 'RAM COMBO', value: 19, best: 19, isNew: true },
  ],
};

const lost = {
  sector: 3, name: 'BOTH WALLS', seconds: 401, outcome: 'lost',
  score: { total: 14980, kills: 11200, rams: 2380, bonuses: 1400 },
  biomass: { earned: 1640, spent: 1610, bank: 90, leftInField: 0 },
  breaches: [
    { id: 'walls-a', side: 'gate', wavesPlanned: 5, wavesFought: 5, kills: 188, closedBy: 'shells', openSeconds: 377, leftInField: { kg: 0, points: 0 } },
    { id: 'walls-b', side: 'back', wavesPlanned: 5, wavesFought: 3, kills: 71, closedBy: null, openSeconds: 401, leftInField: { kg: 0, points: 0 } },
  ],
  kills: {
    total: 259,
    bySource: { tank: 58, ram: 29, towers: 131, gunship: 27, laser: 9, other: 5 },
    byTower: { rotor: 62, quiver: 41, mortar: 28 },
    byBelt: { white: 96, grey: 61, yellow: 40, blue: 27, orange: 19, green: 11, purple: 5 },
    tempo: tempo(401, 259, [[50, 25, 1], [150, 30, 1.5], [260, 28, 2.2], [360, 26, 1.2]]),
  },
  tank: { shotsFired: 302, shotsHit: 139, rams: 29, bestCombo: 8, shieldSeconds: 88, stationSeconds: 40, damageTaken: 1260, hullsLost: 3, partsHome: 0 },
  colony: { prints: ['assembly-line'], leaks: 41, heartDamage: 20, gunshipPasses: 3, gunshipKills: 27, laserPasses: 1, laserSeconds: 4, laserKills: 9 },
  stamps: ['ram-king'],
  records: [
    { key: 'sector-kills', label: 'KILLS IN A SECTOR', value: 259, best: 332, isNew: false },
    { key: 'shots-fired', label: 'SHOTS FIRED', value: 302, best: 302, isNew: true },
  ],
};

const third = {
  sector: 3, name: 'BOTH WALLS', seconds: 356, outcome: 'secure',
  score: { total: 40210, kills: 27400, rams: 5810, bonuses: 7000 },
  biomass: { earned: 2980, spent: 2400, bank: 1760, leftInField: 380 },
  breaches: [
    { id: 'walls-a', side: 'gate', wavesPlanned: 5, wavesFought: 5, kills: 251, closedBy: 'held', openSeconds: 341, leftInField: { kg: 0, points: 0 } },
    { id: 'walls-b', side: 'back', wavesPlanned: 5, wavesFought: 4, kills: 203, closedBy: 'strike', openSeconds: 290, leftInField: { kg: 380, points: 4900 } },
  ],
  kills: {
    total: 454,
    bySource: { tank: 97, ram: 66, towers: 180, gunship: 41, laser: 62, other: 8 },
    byTower: { rotor: 74, quiver: 52, relay: 21, mortar: 33 },
    byBelt: { white: 140, grey: 102, yellowPale: 71, yellow: 55, bluePale: 38, orange: 27, green: 14, red: 7 },
    tempo: tempo(356, 454, [[45, 20, 1], [120, 22, 1.6], [200, 26, 2], [290, 24, 2.4]]),
  },
  tank: { shotsFired: 266, shotsHit: 191, rams: 66, bestCombo: 24, shieldSeconds: 52, stationSeconds: 36, damageTaken: 480, hullsLost: 1, partsHome: 1 },
  colony: { prints: ['assembly-line', 'antenna'], leaks: 2, heartDamage: 4, gunshipPasses: 3, gunshipKills: 41, laserPasses: 2, laserSeconds: 11, laserKills: 62 },
  stamps: ['held-the-line', 'ram-king', 'scorched-earth'],
  records: [
    { key: 'sector-score', label: 'SECTOR SCORE', value: 40210, best: 40210, isNew: true },
    { key: 'sector-kills', label: 'KILLS IN A SECTOR', value: 454, best: 454, isNew: true },
    { key: 'best-combo', label: 'RAM COMBO', value: 24, best: 24, isNew: true },
  ],
};

const reports = [secure, flawless, third];

export const DEBRIEF_SAMPLES = deepFreeze({
  secure,
  flawless,
  lost,
  campaign: { reports, totals: campaignTotals(reports) },
});

/** Isao's two lines about the next sector for each sample: the second line is always what he does next */
export const DEBRIEF_SAMPLE_ISAO = deepFreeze({
  secure: ['Both holes quiet. The lane is ours.', 'Next one opens behind the bays. I am printing walls there now.'],
  flawless: ['Not a scratch on her. The Stålheart hums.', 'Both walls next. I will have the mortar racked before they wake.'],
  lost: ['They came through the back while we watched the gate.', 'Oh well. Rebuild. I have the hull drawings.'],
  campaign: ['Three sectors. The colony holds.', 'They will come again. Let us be taller when they do.'],
});
