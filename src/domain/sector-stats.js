// THE SECTOR'S BOOKS (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 4). The game feeds events in as they
// happen; report() turns them and the sector's state (src/domain/sectors.js) into the debrief's report contract, with the
// stamps earned and the records set. The stamp and record tables come in from src/content/sectors.js.
//
// Pure. Times are the caller's clock in seconds. Score and biomass are only what the caller records: when it pays a HELD
// bonus it records score { kind: 'bonus' } and biomass { earned } like any other income.

export const SOURCES = Object.freeze(['tank', 'ram', 'towers', 'gunship', 'laser', 'other']);
const zeros = (keys) => Object.fromEntries((keys ?? []).map((k) => [k, 0]));
const tenths = (x) => Math.round(x * 10) / 10;

// sector: the state from makeSector (or its def): n and name. shape: SECTOR_STATS (tempoBin, towers, belts, guns).
export function makeSectorStats(sector, t, shape = {}) {
  return {
    n: sector.n, name: sector.name, t0: t, bin: shape.tempoBin ?? 5,
    kills: { total: 0, bySource: zeros(SOURCES), byTower: zeros(shape.towers), byBelt: zeros(shape.belts), byGun: zeros(shape.guns) },
    tempo: [], breachKills: {},
    shotsFired: 0, shotsHit: 0, rams: 0, bestCombo: 0, shieldSeconds: 0, stationSeconds: 0, damageTaken: 0, hullsLost: 0, partsHome: [],
    prints: [], leaks: 0, heartDamage: 0, gunshipPasses: 0, laserPasses: 0, laserSeconds: 0,
    earned: 0, spent: 0, score: { total: 0, kills: 0, rams: 0, bonuses: 0 },
  };
}

const bump = (o, k, n = 1) => { o[k] = (o[k] ?? 0) + n; };
const num = (x) => (Number.isFinite(x) ? x : 0);

// One event: { type, ... }. Returns false for an event it does not know, and records nothing.
//   kill { source: tank|ram|towers|gunship|laser|other, tower?, belt?, gun?, breach?, t }   shot { hit }   ram { combo }
//   shield { seconds, station }  (station: drawn at the array, else used)   damage { amount }   hullLost   partHome { part }
//   print { id }   leak   heartDamage { amount }   gunshipPass   laserPass   laserBurn { seconds }   biomass { earned | spent }
//   score { points, kind: kill|ram|bonus }
export function record(st, ev) {
  switch (ev?.type) {
    case 'kill': {
      const src = SOURCES.includes(ev.source) ? ev.source : 'other';
      st.kills.total++; bump(st.kills.bySource, src);
      if (ev.tower) bump(st.kills.byTower, ev.tower);
      if (ev.belt) bump(st.kills.byBelt, ev.belt);
      if (ev.gun) bump(st.kills.byGun, ev.gun);
      if (ev.breach != null) bump(st.breachKills, ev.breach);
      const i = Math.max(0, Math.floor((num(ev.t ?? st.t0) - st.t0) / st.bin));
      while (st.tempo.length <= i) st.tempo.push(0);
      st.tempo[i]++;
      return true;
    }
    case 'shot': st.shotsFired++; if (ev.hit) st.shotsHit++; return true;
    case 'ram': st.rams++; st.bestCombo = Math.max(st.bestCombo, num(ev.combo)); return true;
    case 'shield': if (ev.station) st.stationSeconds += num(ev.seconds); else st.shieldSeconds += num(ev.seconds); return true;
    case 'damage': st.damageTaken += num(ev.amount); return true;
    case 'hullLost': st.hullsLost++; return true;
    case 'partHome': st.partsHome.push(ev.part); return true;
    case 'print': st.prints.push(ev.id); return true;
    case 'leak': st.leaks++; return true;
    case 'heartDamage': st.heartDamage += num(ev.amount); return true;
    case 'gunshipPass': st.gunshipPasses++; return true;
    case 'laserPass': st.laserPasses++; return true;
    case 'laserBurn': st.laserSeconds += num(ev.seconds); return true;
    case 'biomass': st.earned += num(ev.earned); st.spent += num(ev.spent); return true;
    case 'score': {
      const p = num(ev.points);
      st.score.total += p; st.score[ev.kind === 'kill' ? 'kills' : ev.kind === 'ram' ? 'rams' : 'bonuses'] += p;
      return true;
    }
    default: return false;
  }
}

// The flat numbers the stamp rules and records read, from a finished report.
export function reportMetrics(r) {
  const by = r.kills.bySource;
  return {
    secure: r.outcome === 'secure' ? 1 : 0, seconds: r.seconds, score: r.score.total, kills: r.kills.total,
    leaks: r.colony.leaks, heartDamage: r.colony.heartDamage, breaches: r.breaches.length,
    held: r.breaches.filter((b) => b.closedBy === 'held').length,
    quick: r.breaches.filter((b) => b.closedBy && b.closedBy !== 'held' && b.wavesFought < b.wavesPlanned / 2).length,
    bestCombo: r.tank.bestCombo, shotsFired: r.tank.shotsFired, accuracy: r.tank.shotsFired ? r.tank.shotsHit / r.tank.shotsFired : 0,
    tankKills: by.tank + by.ram, damageTaken: r.tank.damageTaken, hullsLost: r.tank.hullsLost, partsHome: r.tank.partsHome.length,
    gunshipKills: r.colony.gunshipKills, laserKills: r.colony.laserKills, leftInField: r.biomass.leftInField,
  };
}

const OPS = { eq: (a, b) => a === b, ne: (a, b) => a !== b, gte: (a, b) => a >= b, lte: (a, b) => a <= b, gt: (a, b) => a > b, lt: (a, b) => a < b };
export const stampEarned = (stamp, m) => stamp.rules.every(([k, op, v]) => OPS[op]?.(m[k], typeof v === 'string' ? m[v] : v) ?? false);

// A record beats its best when it is set at all (a positive value; a secure sector for secureOnly) and is better than the
// standing best, or there is none. best is the standing best BEFORE this sector (null when there was none); mergeBests
// folds the new ones in for the caller to persist.
function recordsOf(defs, m, n, bests) {
  return defs.map((d) => {
    const key = d.key.replace('{n}', String(n)), value = m[d.metric] ?? 0, best = bests?.[key] ?? null;
    const counts = value > 0 && (!d.secureOnly || m.secure === 1);
    const isNew = counts && (best === null || (d.better === 'lower' ? value < best : value > best));
    return { key, label: d.label, value, best, isNew };
  });
}
export const mergeBests = (bests, records) => ({ ...bests, ...Object.fromEntries(records.filter((r) => r.isNew).map((r) => [r.key, r.value])) });

// THE REPORT CONTRACT. sectorState: makeSector's state. bank: biomass in hand at the end. outcome: 'secure' | 'lost'.
// bests: { key: value } from earlier runs. stamps / records: SECTOR_STAMPS / SECTOR_RECORDS.
export function report(st, sector, { t, bank = 0, outcome = 'secure', bests = {}, stamps = [], records = [] } = {}) {
  const seconds = Math.max(0, Math.round(t - st.t0));
  const tempo = st.tempo.slice();
  while (tempo.length < Math.max(1, Math.ceil((t - st.t0) / st.bin))) tempo.push(0);
  const breaches = sector.breaches.map((b) => ({
    id: b.id, side: b.side, wavesPlanned: b.wavesPlanned, wavesFought: b.wavesReleased, kills: st.breachKills[b.id] ?? 0,
    closedBy: b.closedBy, openSeconds: Math.max(0, Math.round((b.closedAt ?? t) - b.openedAt)), leftInField: { ...b.leftInField },
  }));
  const r = {
    sector: st.n, name: st.name, seconds, outcome,
    score: { ...st.score },
    biomass: { earned: Math.round(st.earned), spent: Math.round(st.spent), bank: Math.round(bank), leftInField: breaches.reduce((s, b) => s + b.leftInField.kg, 0) },
    breaches,
    kills: { total: st.kills.total, bySource: { ...st.kills.bySource }, byTower: { ...st.kills.byTower }, byBelt: { ...st.kills.byBelt }, byGun: { ...st.kills.byGun }, tempo },
    tank: { shotsFired: st.shotsFired, shotsHit: st.shotsHit, rams: st.rams, bestCombo: st.bestCombo, shieldSeconds: tenths(st.shieldSeconds), stationSeconds: tenths(st.stationSeconds), damageTaken: tenths(st.damageTaken), hullsLost: st.hullsLost, partsHome: st.partsHome.slice() },
    colony: { prints: st.prints.slice(), leaks: st.leaks, heartDamage: st.heartDamage, gunshipPasses: st.gunshipPasses, gunshipKills: st.kills.bySource.gunship, laserPasses: st.laserPasses, laserSeconds: tenths(st.laserSeconds), laserKills: st.kills.bySource.laser },
    stamps: [], records: [],
  };
  const m = reportMetrics(r);
  r.stamps = stamps.filter((s) => stampEarned(s, m)).map((s) => s.id);
  r.records = recordsOf(records, m, st.n, bests);
  return r;
}

// The contract's shape, for tests and for the card to refuse a malformed report. Returns a list of problems (empty: ok).
const N = 'number', S = 'string', A = 'array', O = 'numbers';
const SHAPE = {
  sector: N, name: S, seconds: N, outcome: S,
  score: { total: N, kills: N, rams: N, bonuses: N },
  biomass: { earned: N, spent: N, bank: N, leftInField: N },
  breaches: A,
  kills: { total: N, bySource: Object.fromEntries(SOURCES.map((k) => [k, N])), byTower: O, byBelt: O, byGun: O, tempo: A },
  tank: { shotsFired: N, shotsHit: N, rams: N, bestCombo: N, shieldSeconds: N, stationSeconds: N, damageTaken: N, hullsLost: N, partsHome: A },
  colony: { prints: A, leaks: N, heartDamage: N, gunshipPasses: N, gunshipKills: N, laserPasses: N, laserSeconds: N, laserKills: N },
  stamps: A, records: A,
};
const BREACH = { id: null, side: S, wavesPlanned: N, wavesFought: N, kills: N, closedBy: null, openSeconds: N, leftInField: { kg: N, points: N } };
const RECORD = { key: S, label: S, value: N, best: null, isNew: 'boolean' };
function shapeProblems(v, shape, path, out) {
  if (shape === null) { if (v === undefined) out.push(`${path}: missing`); return out; }
  if (shape === A) { if (!Array.isArray(v)) out.push(`${path}: not an array`); return out; }
  if (shape === O) { if (!v || typeof v !== 'object' || Object.values(v).some((x) => !Number.isFinite(x))) out.push(`${path}: not a map of numbers`); return out; }
  if (typeof shape === 'string') { if (shape === N ? !Number.isFinite(v) : typeof v !== shape) out.push(`${path}: not a ${shape}`); return out; }
  if (!v || typeof v !== 'object') { out.push(`${path}: missing`); return out; }
  for (const [k, s] of Object.entries(shape)) shapeProblems(v[k], s, path ? `${path}.${k}` : k, out);
  return out;
}
export function checkReport(r) {
  const out = shapeProblems(r, SHAPE, '', []);
  if (out.length) return out;
  if (!['secure', 'lost'].includes(r.outcome)) out.push(`outcome: ${r.outcome}`);
  r.breaches.forEach((b, i) => {
    shapeProblems(b, BREACH, `breaches[${i}]`, out);
    if (!['gate', 'back'].includes(b.side)) out.push(`breaches[${i}].side: ${b.side}`);
    if (![null, 'gunship', 'laser', 'shells', 'strike', 'held'].includes(b.closedBy)) out.push(`breaches[${i}].closedBy: ${b.closedBy}`);
  });
  r.records.forEach((x, i) => shapeProblems(x, RECORD, `records[${i}]`, out));
  if (r.kills.tempo.some((x) => !Number.isInteger(x) || x < 0)) out.push('kills.tempo: not kill counts');
  if (r.stamps.some((x) => typeof x !== 'string')) out.push('stamps: not ids');
  return out;
}

// THE COLONY HOLDS: one row per sector and the run's totals. Counts add up, bestCombo is the best of them, lists join,
// stamps are counted by id and the bank is the last sector's.
export function campaignTotals(reports) {
  const add = (a, b) => {
    for (const [k, v] of Object.entries(b)) {
      if (Array.isArray(v)) a[k] = [...(a[k] ?? []), ...v];
      else if (v && typeof v === 'object') a[k] = add(a[k] ?? {}, v);
      else if (Number.isFinite(v)) a[k] = (a[k] ?? 0) + v;
    }
    return a;
  };
  const totals = { sectors: reports.length, secure: 0, seconds: 0, score: {}, biomass: {}, leftInField: { kg: 0, points: 0 }, kills: {}, tank: {}, colony: {}, stamps: {}, breaches: { total: 0, held: 0, closed: 0 } };
  for (const r of reports) {
    totals.secure += r.outcome === 'secure' ? 1 : 0; totals.seconds += r.seconds;
    add(totals.score, r.score); add(totals.biomass, r.biomass);
    const { tempo, ...kills } = r.kills; add(totals.kills, kills);
    add(totals.tank, r.tank); add(totals.colony, r.colony);
    for (const s of r.stamps) totals.stamps[s] = (totals.stamps[s] ?? 0) + 1;
    for (const b of r.breaches) {
      totals.breaches.total++; if (b.closedBy === 'held') totals.breaches.held++; else if (b.closedBy) totals.breaches.closed++;
      totals.leftInField.kg += b.leftInField.kg; totals.leftInField.points += b.leftInField.points;
    }
  }
  totals.tank.bestCombo = Math.max(0, ...reports.map((r) => r.tank.bestCombo));
  totals.biomass.bank = reports.length ? reports[reports.length - 1].biomass.bank : 0;
  for (const k of ['shieldSeconds', 'stationSeconds', 'damageTaken']) if (k in totals.tank) totals.tank[k] = tenths(totals.tank[k]);
  if ('laserSeconds' in totals.colony) totals.colony.laserSeconds = tenths(totals.colony.laserSeconds);
  const sectors = reports.map((r) => ({
    sector: r.sector, name: r.name, outcome: r.outcome, seconds: r.seconds, score: r.score.total, kills: r.kills.total,
    earned: r.biomass.earned, leftInField: r.biomass.leftInField, leaks: r.colony.leaks, stamps: r.stamps.slice(),
  }));
  return { sectors, totals };
}
