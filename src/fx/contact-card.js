// FIRST CONTACT (owner, 2026-10-02, seventh notes: "Some expose of the types of enemies, once encountered"). The first time a kind of
// body rises in a story run, Isao's scanner logs it: a small card at the left edge with the creature's colour, its name, what it does
// (src/enemyspec.js INTROS) and the two facts a driver needs, whether it goes under the treads and how much it takes. It never
// pauses the game or covers the middle of the screen; cards that arrive together queue, one at a time. The UNITS bench has the rest, and the
// terminal's bestiary (B, src/fx/terminal-screen.js) keeps each kind met, this run and across runs.
// THE PEARL SET (the story's default since 2026-10-14, src/platform/game-flags.js): a dressed record's card is its tier's, the swatch the tier's skin
// (its core where the skin is too dark to read on the card: Onyx), the name the tier's, the type's own role and facts under it (the types are unchanged)
import { CREATURE_TINTS, ENEMY_SPEC, INTROS } from '../enemyspec.js';
import { PEARL_TIERS } from '../content/pearl-enemies.js';
import { isaoSpeak } from './isao-voice.js';

const SHOW_MS = 5200;
const hex = (c) => '#' + (c ?? 0xffffff).toString(16).padStart(6, '0');
const luma = (c) => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
// the card's look: a Pearl tier's (by its id, `pearl`) or the dot cloud's
export function contactLook(type, pearl = null) {
  const t = pearl ? PEARL_TIERS.find((x) => x.id === pearl) : null, i = INTROS.find((x) => x.type === type), label = (i?.label ?? type).replace(/^THE /, '');
  if (!t) return { tint: hex(CREATURE_TINTS[type]), name: label, role: i?.role ?? '', tier: null };
  const skin = t.values.skinTint;
  return { tint: hex(luma(skin) < 0.2 ? t.values.coreTint : skin), name: t.name.toUpperCase(), role: [label, i?.role].filter(Boolean).join(' · '), tier: t.id };
}

export function showContact(root, type, pearl = null, { hull = true } = {}) {
  if (!ENEMY_SPEC[type] || !root) return;
  const q = (root.__contacts ??= { queue: [], busy: false, log: [], looks: [] });
  q.log.push(type); q.queue.push([type, pearl, hull]); (q.looks ??= []).push(contactLook(type, pearl)); q.note?.(type);   // the bestiary's sighting (onContact)
  if (!q.busy) next();
  function next() {
    const [t, tier, hullOut = true] = q.queue.shift() ?? []; if (!t) { q.busy = false; return; }
    q.busy = true;
    const s = ENEMY_SPEC[t], look = contactLook(t, tier), tint = look.tint;
    isaoSpeak('first_contact', { qualifier: s?.rammable ? 'rammable' : 'solid core' });   // Isao names it (src/fx/isao-voice.js)
    const card = document.createElement('div'); card.className = 'contact-card'; card.style.setProperty('--tint', tint);
    const head = document.createElement('div'); head.className = 'contact-head'; head.textContent = 'NEW CONTACT';
    const name = document.createElement('div'); name.className = 'contact-name'; name.textContent = look.name;
    const role = document.createElement('div'); role.className = 'contact-role'; role.textContent = look.role;
    const facts = document.createElement('div'); facts.className = 'contact-facts';
    // before the hull is issued the ram does not exist yet (owner, 2026-10-15, the Quiver's first hard core: "we have not introduced the tank or the
    // concept of ramming yet. Replace it with 'these seem to have a harder-core, more dangerous'")
    facts.textContent = `${s.rammable ? 'RAMMABLE' : hullOut ? 'SOLID CORE · DO NOT RAM' : 'HARDER CORE · MORE DANGEROUS'} · ${s.hp} HP`;
    card.append(head, name, role, facts); root.appendChild(card);
    setTimeout(() => { card.classList.add('out'); setTimeout(() => { card.remove(); next(); }, 450); }, SHOW_MS);
  }
}

// THE BESTIARY'S SIGHTINGS (owner, 2026-10-14; src/fx/terminal-screen.js): a kind's first rise this page is also its sighting across runs, so
// this is the one place it is noted; `fn(type)` is told each one
export function onContact(root, fn) { (root.__contacts ??= { queue: [], busy: false, log: [] }).note = fn; }

// the harness: every kind logged this page, in order
export const contactsLogged = (root) => (root?.__contacts?.log ?? []).slice();
// the harness: each logged card's look ({ tint, name, role, tier }), in the same order
export const contactLooks = (root) => (root?.__contacts?.looks ?? []).slice();
