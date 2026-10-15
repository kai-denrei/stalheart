// THE TUNE PANEL'S RULES (owner, 2026-10-16: "a keyboard shortcut we do not use yet, say 'x', bring up a modal with variables FOR WHAT IS CURRENTLY on
// screen which can be easily tweaked, and it also must have a method to RECORD new variables so they become the new default"; the panel is
// src/fx/tune-panel.js, its knobs src/fx/tune-knobs.js, the store src/platform/tune-store.js). Pure.
//   tierKeyOf(e, pearlOf)        a record's tier key: 'pearl:<tier>' for a type the Pearl set draws, '<family>:<tier>' for a creature record, else its type
//   screenTiers(enemies, pearlOf) the live records' tier keys with counts, most first (what is on screen)
//   effective(knob)              a knob's value as the game sees it: a 'mul' knob's base x its value, an 'abs' knob's value
//   changed(knobs)               the knobs off their default
//   tuneReport({ rev, url, at, sector, screen, knobs }) the markdown block RECORD writes: the build, the page, the sector, what was on screen,
//                                one line a changed knob (its content path, the default -> the value)
export const tierKeyOf = (e, pearlOf = {}) => (pearlOf[e?.type] ? `pearl:${pearlOf[e.type]}` : e?.tier && e?.type ? `${e.type}:${e.tier}` : e?.type ?? null);   // a Pearl type first: a dressed entry's `tier` is its type's name
export function screenTiers(enemies, pearlOf = {}) {
  const counts = new Map();
  for (const e of enemies ?? []) { if (!e?.alive) continue; const k = tierKeyOf(e, pearlOf); if (k) counts.set(k, (counts.get(k) ?? 0) + (e.members || 1)); }
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
}
export const effective = (k) => (k.kind === 'mul' ? +(k.base * k.value).toFixed(4) : k.value);
export const changed = (knobs) => (knobs ?? []).filter((k) => k.value !== k.default);
const fmt = (v) => (typeof v === 'number' ? +v.toFixed(4) : v);
export function tuneReport({ rev = '', url = '', at = '', sector = '', screen = [], knobs = [] }) {
  const lines = [`## ${at} · ${rev || 'dev'}`, '', `- page: ${url}`, `- sector: ${sector || '-'}`, `- on screen: ${screen.length ? screen.map((s) => `${s.key} x${s.count}`).join(', ') : '-'}`, ''];
  const c = changed(knobs);
  if (!c.length) lines.push('(nothing changed)');
  for (const k of c) lines.push(`- ${k.path}: ${fmt(k.base)} -> ${fmt(effective(k))}${k.kind === 'mul' ? ` (x${fmt(k.value)})` : ''}   ${k.label}`);
  return lines.join('\n') + '\n\n';
}
