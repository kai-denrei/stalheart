// FIRST CONTACT (owner, 2026-10-02, seventh notes: "Some expose of the types of enemies, once encountered"). The first time a kind of
// body rises in a story run, Isao's scanner logs it: a small card at the left edge with the creature's colour, its name, what it does
// (src/enemyspec.js INTROS) and the two facts a driver needs, whether it goes under the treads and how much it takes. It never
// pauses the game or covers the middle of the screen; cards that arrive together queue, one at a time. The UNITS bench has the rest.
import { CREATURE_TINTS, ENEMY_SPEC, INTROS } from '../enemyspec.js';
import { isaoSpeak } from './isao-voice.js';

const SHOW_MS = 5200;

export function showContact(root, type) {
  if (!ENEMY_SPEC[type] || !root) return;
  const q = (root.__contacts ??= { queue: [], busy: false, log: [] });
  q.log.push(type); q.queue.push(type);
  if (!q.busy) next();
  function next() {
    const t = q.queue.shift(); if (!t) { q.busy = false; return; }
    q.busy = true;
    const i = INTROS.find((x) => x.type === t), s = ENEMY_SPEC[t], tint = '#' + (CREATURE_TINTS[t] ?? 0xffffff).toString(16).padStart(6, '0');
    isaoSpeak('first_contact', { qualifier: s?.rammable ? 'rammable' : 'solid core' });   // Isao names it (src/fx/isao-voice.js)
    const card = document.createElement('div'); card.className = 'contact-card'; card.style.setProperty('--tint', tint);
    const head = document.createElement('div'); head.className = 'contact-head'; head.textContent = 'NEW CONTACT';
    const name = document.createElement('div'); name.className = 'contact-name'; name.textContent = (i?.label ?? t).replace(/^THE /, '');
    const role = document.createElement('div'); role.className = 'contact-role'; role.textContent = i?.role ?? '';
    const facts = document.createElement('div'); facts.className = 'contact-facts';
    facts.textContent = `${s.rammable ? 'RAMMABLE' : 'SOLID CORE · DO NOT RAM'} · ${s.hp} HP`;
    card.append(head, name, role, facts); root.appendChild(card);
    setTimeout(() => { card.classList.add('out'); setTimeout(() => { card.remove(); next(); }, 450); }, SHOW_MS);
  }
}

// the harness: every kind logged this page, in order
export const contactsLogged = (root) => (root?.__contacts?.log ?? []).slice();
