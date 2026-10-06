// THE RUN RECAP (owner, 2026-10-06: "there's not enough details available, no re-cap of all the waves, we need more sense of revisiting
// the best moments ... something visual, graphs, sparklines, spanning the entire rounds"). The campaign card's pages after THE COLONY
// HOLDS read the whole run through this: one row per sector for the small multiples, the kill tempo of every sector laid end to end
// with a mark where each one starts, and the run's bests with the sector they came in.
//
// Pure. `reports` are the sector reports of src/domain/sector-stats.js report(), in the order they were fought.

const n = (v) => Number(v) || 0;

// the rows the small multiples draw, one per sector
export function recapRows(reports = []) {
  return reports.map((r) => ({
    sector: n(r.sector), name: String(r.name ?? ''), lost: r.outcome === 'lost', seconds: n(r.seconds),
    kills: n(r.kills?.total), score: n(r.score?.total), combo: n(r.tank?.bestCombo), rams: n(r.tank?.rams),
    hulls: n(r.tank?.hullsLost), biomass: n(r.biomass?.earned), leaks: n(r.colony?.leaks),
    by: { tank: n(r.kills?.bySource?.tank) + n(r.kills?.bySource?.ram), towers: n(r.kills?.bySource?.towers), gunship: n(r.kills?.bySource?.gunship), laser: n(r.kills?.bySource?.laser) },
  }));
}

// every sector's tempo bins end to end; `marks` is the bin each sector starts at, for the line's sector ticks
export function runTempo(reports = []) {
  const bins = [], marks = [];
  for (const r of reports) { marks.push({ at: bins.length, sector: n(r.sector) }); for (const v of r.kills?.tempo ?? []) bins.push(Math.max(0, n(v))); }
  return { bins, marks };
}

// the run's bests, each with the sector it came in (the first such sector on a tie); null where nothing counted
const BESTS = [
  { key: 'combo', label: 'BEST RAM COMBO', of: (x) => x.combo, fmt: 'x' },
  { key: 'kills', label: 'MOST KILLS IN A SECTOR', of: (x) => x.kills },
  { key: 'score', label: 'BEST SECTOR SCORE', of: (x) => x.score },
  { key: 'rams', label: 'MOST RAMS IN A SECTOR', of: (x) => x.rams },
  { key: 'laser', label: 'SOL\'S BEST SECTOR', of: (x) => x.by.laser },
  { key: 'gunship', label: 'THE GUNSHIP\'S BEST SECTOR', of: (x) => x.by.gunship },
  { key: 'fastest', label: 'FASTEST SECTOR SECURED', of: (x) => (x.lost || x.seconds <= 0 ? 0 : x.seconds), lower: true, fmt: 'clock' },
];
export function runBests(rows = []) {
  return BESTS.map((d) => {
    let best = null;
    for (const x of rows) { const v = d.of(x); if (v > 0 && (!best || (d.lower ? v < best.value : v > best.value))) best = { value: v, sector: x.sector, name: x.name }; }
    return { key: d.key, label: d.label, fmt: d.fmt ?? null, ...(best ?? { value: 0, sector: null, name: null }) };
  }).filter((b) => b.sector !== null);
}

// bars for one metric across the sectors in a w x h box: x, width and height per sector, the top value and its sector
export function bars(rows, of, w = 300, h = 60, gap = 2) {
  const vals = rows.map((x) => Math.max(0, n(of(x)))), top = Math.max(1, ...vals), bw = rows.length ? (w - gap * (rows.length - 1)) / rows.length : 0;
  let peak = -1;
  vals.forEach((v, i) => { if (v > 0 && (peak < 0 || v > vals[peak])) peak = i; });
  return { top, peak, bars: vals.map((v, i) => ({ x: +(i * (bw + gap)).toFixed(1), w: +Math.max(0.5, bw).toFixed(1), h: +((v / top) * h).toFixed(1), v })) };
}
