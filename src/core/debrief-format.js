// THE SECTOR DEBRIEF'S WORDS AND NUMBERS. Pure formatting for the end-of-sector card (src/fx/sector-debrief.js):
// how a count, a clock, a closer or a stamp reads on screen, the tempo sparkline's geometry and the campaign totals.
// No DOM and no game content: the card and the Node tests call the same functions, so a label is argued with here.
// The report shape is the V1 session design's report contract (docs/superpowers/specs/2026-09-15-v1-session-design.md).

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** the count-up roll: fast off the mark, a long soft landing */
export const easeRoll = (p) => 1 - Math.pow(1 - clamp01(p), 4);
/** bars and gauges: a gentler curve so the growth is watched, not flashed */
export const easeGrow = (p) => { const q = clamp01(p); return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2; };

export function formatInt(n) {
  const v = Math.round(Number(n) || 0), s = String(Math.abs(v));
  return (v < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const ss = String(r).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** one roll's text: int 12,480 · clock 5:12 · pct 61% · combo ×12 · sec 46 S */
export function formatValue(n, fmt = 'int') {
  switch (fmt) {
    case 'clock': return formatClock(n);
    case 'pct': return `${Math.round(Number(n) || 0)}%`;
    case 'combo': return `×${formatInt(n)}`;
    case 'sec': return `${formatInt(n)} S`;
    default: return formatInt(n);
  }
}

export const accuracy = (hit, fired) => (fired > 0 ? clamp01(hit / fired) : 0);

const CLOSERS = {
  gunship: { label: '105', note: 'GUNSHIP' },
  laser: { label: 'SOL-82', note: 'ORBITAL' },
  shells: { label: 'SHELLS', note: 'TANK GUN' },
  strike: { label: 'STRIKE', note: 'ORBITAL STRIKE' },
  held: { label: 'HELD', note: 'RAN DRY' },
};
/** what closed a breach, as a big word and a small note; null is a breach nobody closed */
export const closedByLabel = (key) => CLOSERS[key] || { label: 'OPEN', note: 'NEVER CLOSED' };

export const sideLabel = (side) => (side === 'back' ? 'BACK DOOR' : 'GATE SIDE');
export const breachLetter = (i) => String.fromCharCode(65 + (i % 26));

const STAMP_NOTES = {
  flawless: 'NO LEAKS · HEART UNTOUCHED',
  'held-the-line': 'EVERY BREACH RAN DRY',
  'quick-hands': 'SECURED AGAINST THE CLOCK',
  'ram-king': 'THE HULL DID THE WORK',
  sharpshooter: 'THE GUN KEPT ITS WORD',
  'scorched-earth': 'SOL-82 SIGNED IT',
};
const stampId = (key) => String(key || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
/** 'held-the-line', 'held_the_line' and 'HELD THE LINE' all read HELD THE LINE */
export const stampLabel = (key) => stampId(key).replace(/-/g, ' ').toUpperCase();
export const stampNote = (key) => STAMP_NOTES[stampId(key)] || '';

/** the belts present in a histogram, in ladder order; belts the ladder does not know go last in their own order */
export function beltEntries(byBelt = {}, order = []) {
  const keys = Object.keys(byBelt);
  const known = order.filter((k) => keys.includes(k)), rest = keys.filter((k) => !order.includes(k));
  return [...known, ...rest].map((key) => ({ key, label: key.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase(), value: Number(byBelt[key]) || 0 }));
}

const SOURCE_LABELS = [['tank', 'TANK GUN'], ['ram', 'RAM'], ['towers', 'TOWERS'], ['gunship', 'GUNSHIP'], ['laser', 'SOL-82'], ['other', 'OTHER']];
/** the attribution rows: tank gun, ram, towers and each tower kind under it (biggest first), gunship, SOL-82, other */
export function sourceRows(kills = {}) {
  const by = kills.bySource || {}, rows = [];
  for (const [key, label] of SOURCE_LABELS) {
    rows.push({ key, label, value: Number(by[key]) || 0, sub: false });
    if (key === 'towers') {
      const kinds = Object.entries(kills.byTower || {}).sort((a, b) => b[1] - a[1]);
      for (const [kind, n] of kinds) rows.push({ key: `tower-${kind}`, label: kind.toUpperCase(), value: Number(n) || 0, sub: true });
    }
  }
  return rows;
}

/** the pages of a sector report; a lost sector's first page is the last transmission */
export function debriefPageLabels(report) {
  return [report && report.outcome === 'lost' ? 'LAST TRANSMISSION' : 'SECURE', 'THE BREACHES', 'THE KILLS', 'THE TANK', 'THE COLONY'];
}

/** the tempo sparkline in a w x h box: the polyline, the filled area under it and the peak bin */
export function tempoPath(tempo = [], w = 600, h = 80, pad = 6) {
  const bins = tempo.map((v) => Math.max(0, Number(v) || 0));
  const top = Math.max(1, ...bins);
  const n = bins.length, step = n > 1 ? w / (n - 1) : 0;
  const pts = bins.map((v, i) => [+(i * step).toFixed(1), +(h - (v / top) * (h - pad)).toFixed(1)]);
  if (n === 1) pts.push([w, pts[0][1]]);
  const line = pts.length ? 'M' + pts.map((p) => p.join(',')).join(' L') : '';
  const area = pts.length ? `M0,${h} L` + pts.map((p) => p.join(',')).join(' L') + ` L${w},${h} Z` : '';
  let peak = null;
  bins.forEach((v, i) => { if (!peak || v > peak.value) peak = { index: i, value: v, x: pts[i][0], y: pts[i][1], seconds: i * 5 }; });
  return { line, area, peak, top };
}

const sum = (list, pick) => list.reduce((a, r) => a + (Number(pick(r)) || 0), 0);
/** the campaign card's totals over its sector reports */
export function campaignTotals(reports = []) {
  return {
    sectors: reports.length,
    seconds: sum(reports, (r) => r.seconds),
    score: sum(reports, (r) => r.score && r.score.total),
    kills: sum(reports, (r) => r.kills && r.kills.total),
    biomassEarned: sum(reports, (r) => r.biomass && r.biomass.earned),
    leftInField: { kg: sum(reports, (r) => r.biomass && r.biomass.leftInField), points: sum(reports, (r) => sum(r.breaches || [], (b) => b.leftInField && b.leftInField.points)) },
    hullsLost: sum(reports, (r) => r.tank && r.tank.hullsLost),
    partsHome: sum(reports, (r) => r.tank && r.tank.partsHome),
    stamps: sum(reports, (r) => (r.stamps || []).length),
  };
}
