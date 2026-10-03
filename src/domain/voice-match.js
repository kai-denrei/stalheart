// Which of Isao's recorded triggers a game moment belongs to, and which line of it to say. Pure: the trigger table
// (content/isao-voice.js), the game-side extra aliases (content/voice-hooks.js) and the player's picks come in as arguments.
//
// A moment is a brief id ('gate_broken'), a callout's text ('THE WALL IS BREACHED') or a named event ('mission'). Matching order:
// an exact alias or trigger key; then a callout alias the text equals or starts with (case, tags and spacing ignored); then a
// wildcard alias ('build_*' takes every build_ brief no other trigger names exactly).

export const normText = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
const isId = (a) => /^[a-z0-9_]+$/.test(a);

export function createVoiceIndex(triggers, hooks = {}) {
  const exact = new Map(), texts = [], wild = [];
  for (const key of Object.keys(triggers)) exact.set(key, key);   // a trigger's own key outranks another trigger's alias (a newly recorded brief)
  for (const [key, t] of Object.entries(triggers)) {
    const aliases = [key, ...(t.aliases ?? []), ...(hooks[key] ?? [])];
    for (const a of aliases) {
      if (a.endsWith('*')) wild.push([a.slice(0, -1), key]);
      else if (isId(a)) { if (!exact.has(a)) exact.set(a, key); }
      else texts.push([normText(a), key]);
    }
  }
  texts.sort((a, b) => b[0].length - a[0].length);   // the longest callout alias wins a shared prefix
  return {
    aliasesOf: (key) => [key, ...(triggers[key]?.aliases ?? []), ...(hooks[key] ?? [])],
    resolve(id) {
      if (id == null) return null;
      if (exact.has(id)) return exact.get(id);
      const n = normText(id);
      if (n) for (const [t, key] of texts) if (n === t || n.startsWith(t + ' ') || n.startsWith(t + '·') || n.startsWith(t + ' ·')) return key;
      if (isId(id)) for (const [p, key] of wild) if (id.startsWith(p)) return key;
      return null;
    },
  };
}

// the lines a trigger may say now: switched on, and either unconditional or carrying the qualifier the moment asked for
export function eligible(lines, { off = new Set(), qualifier = null } = {}) {
  return (lines ?? []).filter((l) => !off.has(l.id) && (!l.qualifier || l.qualifier === qualifier));
}

// one of them at random, never the line said last for this trigger while another remains
export function pickLine(lines, last, roll) {
  if (!lines.length) return null;
  const pool = lines.length > 1 ? lines.filter((l) => l.id !== last) : lines;
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}

// the player's picks, as stored: { muted, off: [line ids], quiet: [trigger keys], db, duck }; anything malformed reads as all on.
// `db` is the voice's trim in decibels over its bus (-18..+12, 0 by default) and `duck` the share of their level the world's buses
// keep under a line (0.1..1; null keeps the game's own), both set by ear in the Workshop's voice tab (2026-10-04)
export const PICK_DB = Object.freeze({ min: -18, max: 12 }), PICK_DUCK = Object.freeze({ min: 0.1, max: 1 });
const within = (v, r) => (Number.isFinite(v) && v >= r.min && v <= r.max ? v : null);
export function readPicks(raw) {
  let v = null;
  try { v = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { v = null; }
  const ids = (a) => new Set(Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.length < 80) : []);
  return { muted: v?.muted === true, off: ids(v?.off), quiet: ids(v?.quiet), db: within(v?.db, PICK_DB) ?? 0, duck: within(v?.duck, PICK_DUCK) };
}
export const dbGain = (db) => 10 ** ((db ?? 0) / 20);
export function writePicks(p) {
  return JSON.stringify({ muted: !!p.muted, off: [...p.off].sort(), quiet: [...p.quiet].sort(), ...(p.db ? { db: p.db } : {}), ...(p.duck != null ? { duck: p.duck } : {}) });
}
