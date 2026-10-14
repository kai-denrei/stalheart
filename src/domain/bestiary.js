// THE BESTIARY'S RULES (owner, 2026-10-14: "re-vamp the Units section ... display all the unlocked units in their full glory, enemies at high
// resolution with smooth animations displaying their movement patterns ... as if was accessed from a Terminal as a screen-within-a-screen";
// spec docs/superpowers/specs/2026-10-14-bestiary-terminal-design.md, sections 1, 3 and 4). Pure: the tables come in as arguments (the
// entries' copy src/content/bestiary.js, the tier table and PEARL_OF src/content/pearl-enemies.js, ENEMY_SPEC). The screen is
// src/fx/terminal-screen.js, the stage src/fx/bestiary-stage.js.
//   bestiaryRoster  the entries in order: the eight Pearl tiers up the belt ladder (soft, then cored), then the kit creatures as the content lists them; each with the types
//                   it stands for (a tier's from PEARL_OF, so the table cannot drift from the copy), its swatch, cored or soft
//   entryIdOf       the entry a game type belongs to
//   entryState      'full' (met this run), 'silhouette' (met in an earlier run only), 'unseen' (never); the lab's host says every one is full
//   entryCard       what the card shows for an entry in a state: the index and the tier, the name line, the data lines, MET, the warning, the text
//   lurePoint       the lure's closed loop on the stage (a lemniscate, `radius` metres to each tip), smooth, one turn a phase of 1
//   lureStep        the lure after `dt`: a turn each `period` alone, faster as the nearest body closes, turning back along the loop rather
//                   than running into it, and never left within `ahead` of it (it slides off the loop, then eases back on)
//   packSeats       the pack's seats: n points on a ring `ring` metres round a spot `back` metres behind the lure's start
//   readSightings   the sightings record from its stored text (anything malformed is dropped, never thrown)
//   noteSighting    a run meeting an entry for the first time: its runs + 1, `first` kept, `last` the date

export const ENTRY_STATES = Object.freeze(['unseen', 'silhouette', 'full']);

// `entries` the content's ENTRIES, `tiers` PEARL_TIERS, `of` PEARL_OF, `spec` ENEMY_SPEC (with the content's extra creature rows)
// -> [{ id, kind, index, total, name, label, types, rank, cored, swatch, stage, isao }]
export function bestiaryRoster({ entries, tiers, of, spec = {} }) {
  const byTier = new Map(tiers.map((t) => [t.id, t]));
  // the game's belt ladder (src/enemyspec.js: the rammable belts, then the solid cores): the soft tiers, then the cored, each by the set's rank
  // (the set ranks orange before blue; orange is the game's first solid core, the owner's edit of 2026-10-13, so it opens the cored half)
  const ladder = (t) => (t.cored ? 100 : 0) + t.rank;
  const tierRows = entries.filter((e) => e.kind === 'tier' && byTier.has(e.id)).sort((a, b) => ladder(byTier.get(a.id)) - ladder(byTier.get(b.id))).map((e) => {
    const t = byTier.get(e.id);
    return { e, types: Object.keys(of).filter((k) => of[k] === e.id), rank: t.rank, cored: !!t.cored, swatch: t.values?.skinTint ?? 0xffffff, label: `${t.name.toUpperCase()} TIER` };
  });
  const creatureRows = entries.filter((e) => e.kind === 'creature').map((e) => ({ e, types: [...e.types], rank: null, cored: e.types.every((k) => spec[k] ? !spec[k].rammable : true), swatch: e.swatch ?? 0xffffff, label: e.label ?? 'CREATURE' }));
  const rows = [...tierRows, ...creatureRows];
  return rows.map(({ e, types, rank, cored, swatch, label }, k) => Object.freeze({
    id: e.id, kind: e.kind, index: k + 1, total: rows.length, name: e.name, label, types: Object.freeze(types), rank, cored, swatch, stage: e.stage !== false, isao: Object.freeze([...(e.isao ?? [])]),
  }));
}

export const entryIdOf = (roster, type) => roster.find((e) => e.types.includes(type))?.id ?? null;

// `log` the types met this run in order, `sightings` the record by entry id, `all` the lab's host (every entry full)
export function entryState(entry, { log = [], sightings = {}, all = false } = {}) {
  if (all) return 'full';
  if (entry.types.some((t) => log.includes(t))) return 'full';
  if (sightings?.[entry.id]) return 'silhouette';
  return 'unseen';
}

// `spec` the types' combat rows, `labels` type -> its name (INTROS' labels), `sightings` the record, `log` this run's types, `copy` the
// content's TERMINAL (ram words, the notes) -> the card
export function entryCard(entry, state, { spec = {}, labels = {}, sightings = {}, log = [], copy }) {
  const met = sightings?.[entry.id] ?? null, unseen = state === 'unseen';
  const shown = entry.types.find((t) => log.includes(t)) ?? entry.types[0] ?? null;
  const nameOf = (t) => String(labels[t] ?? t ?? '').replace(/^THE /, '').toUpperCase();
  const data = unseen ? [] : entry.types.filter((t) => spec[t]).map((t) => ({
    type: t, name: nameOf(t), hp: spec[t].hp, speed: spec[t].speed, size: spec[t].size, ram: spec[t].rammable ? copy.ram.soft : copy.ram.cored,
  }));
  return {
    id: entry.id, state, selectable: !unseen,
    head: `ENTRY ${String(entry.index).padStart(2, '0')} / ${String(entry.total).padStart(2, '0')} · ${entry.label}`,
    name: unseen ? copy.unseenName : nameOf(shown), group: unseen ? copy.unseenName : entry.name, swatch: entry.swatch, dim: unseen,
    data,
    met: met && !unseen ? `MET: run ${met.runs} · first ${met.first}` : null,
    warning: !unseen && entry.cored ? copy.warning : null,
    text: state === 'full' ? entry.isao.slice() : null,
    note: state === 'silhouette' ? copy.silhouetteNote.replace('{date}', met?.last ?? met?.first ?? '—') : unseen ? copy.unseenNote : null,
  };
}

// THE LURE: a lemniscate of Bernoulli, tips `radius` metres either side of the stage's centre; phase 0..1 one turn (closed, smooth)
export function lurePoint(phase, { radius }, out = [0, 0]) {
  const s = phase * Math.PI * 2, sn = Math.sin(s), c = Math.cos(s), k = 1 / (1 + sn * sn);
  out[0] = radius * c * k; out[1] = radius * sn * c * k;
  return out;
}
const LOOK = 0.004;   // how far along the loop the lure looks either way before it turns back
// `lure` { phase, dir, x, z } (dir +1 or -1 along the loop; x, z where it is, which may be off the loop), `nearest` [x, z] of the nearest body
// or null; `boost` how much faster it runs when the nearest body is at `ahead` (eased from twice that), `settle` s its way back onto the loop
// once displaced, `bound` m the farthest from the centre it may be shoved. Prey, not a clock: it runs on along the loop and turns back along
// it when on would close on the nearest body; a closed loop always has a corner a body cutting across it can trap it in, so the lure is never
// left within `ahead` of the body: it slides off the loop to that distance (its step bounded by the body's own), then eases back on
// -> a new { phase, dir, x, z }
export function lureStep(lure, dt, { radius, period, ahead, boost = 2, settle = 1.2, bound = radius * 1.6 }, nearest = null) {
  const at = [0, 0], dist = (p) => { lurePoint(p, { radius }, at); return Math.hypot(at[0] - nearest[0], at[1] - nearest[1]); };
  let { phase, dir = 1 } = lure, rate = 1;
  const was = lurePoint(phase, { radius }), x0 = lure.x ?? was[0], z0 = lure.z ?? was[1];
  if (nearest) {
    const d = Math.hypot(x0 - nearest[0], z0 - nearest[1]);
    if (d < 2 * ahead && dist(phase - dir * LOOK) > dist(phase + dir * LOOK)) dir = -dir;
    rate += boost * Math.max(0, Math.min(1, (2 * ahead - d) / ahead));
  }
  let p = phase + dir * (dt / period) * rate; p -= Math.floor(p);
  // off the loop by what it was, less the settle's share; then held off the nearest body; then inside the bound
  const t = lurePoint(p, { radius }), keep = Math.exp(-dt / settle);
  let x = t[0] + (x0 - was[0]) * keep, z = t[1] + (z0 - was[1]) * keep;
  if (nearest) {
    const dx = x - nearest[0], dz = z - nearest[1], d = Math.hypot(dx, dz);
    if (d < ahead) { const ux = d > 1e-9 ? dx / d : x0 - nearest[0], uz = d > 1e-9 ? dz / d : z0 - nearest[1], ul = Math.hypot(ux, uz) || 1; x = nearest[0] + (ux / ul) * ahead; z = nearest[1] + (uz / ul) * ahead; }
  }
  const r = Math.hypot(x, z); if (r > bound) { x *= bound / r; z *= bound / r; }
  return { phase: p, dir, x, z };
}

// the pack round the lure's start: n seats on a ring `ring` m round a point `back` m behind it (against the loop's heading at phase 0)
export function packSeats(n, { radius, back, ring }) {
  const a = lurePoint(0, { radius }), b = lurePoint(0.01, { radius }), hx = b[0] - a[0], hz = b[1] - a[1], hl = Math.hypot(hx, hz) || 1;
  const centre = [a[0] - (hx / hl) * back, a[1] - (hz / hl) * back], seats = [];
  for (let k = 0; k < n; k++) { const t = (k / n) * Math.PI * 2 + 0.4; seats.push([centre[0] + Math.cos(t) * ring, centre[1] + Math.sin(t) * ring]); }
  return { centre, seats };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
// the stored text -> { [entryId]: { first, runs, last } }; a malformed row or text is dropped
export function readSightings(text) {
  let raw = null;
  try { raw = JSON.parse(text ?? 'null'); } catch { return {}; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [id, r] of Object.entries(raw)) {
    if (!/^[a-z0-9-]{1,40}$/.test(id) || !r || !ISO.test(r.first) || !ISO.test(r.last) || !(Number.isInteger(r.runs) && r.runs > 0)) continue;
    out[id] = { first: r.first, runs: r.runs, last: r.last };
  }
  return out;
}

// a run's first meeting with an entry, on `date` (YYYY-MM-DD) -> a new record (the given one untouched)
export function noteSighting(record, id, date) {
  const was = record?.[id];
  return { ...record, [id]: was ? { first: was.first, runs: was.runs + 1, last: date } : { first: date, runs: 1, last: date } };
}
