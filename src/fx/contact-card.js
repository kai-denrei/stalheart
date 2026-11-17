// FIRST CONTACT (owner, 2026-10-02, seventh notes: "Some expose of the types of enemies, once encountered"). The first time a kind of
// body rises in a story run, Isao's scanner logs it: a small card at the left edge with the creature's colour, its name, what it does
// (src/enemyspec.js INTROS) and the two facts a driver needs, whether it goes under the treads and how much it takes. It never
// pauses the game; species cards stay at the edge, while the sensor lesson enlarges the radar in the center. Cards queue one at a time. The UNITS bench has the rest, and the
// terminal's bestiary (B, src/fx/terminal-screen.js) keeps each kind met, this run and across runs.
// THE PEARL SET (the story's default since 2026-10-14, src/platform/game-flags.js): a dressed record's card is its tier's, the swatch the tier's skin
// (its core where the skin is too dark to read on the card: Onyx), the name the tier's, the type's own role and facts under it (the types are unchanged)
import { CREATURE_TINTS, ENEMY_SPEC, INTROS } from '../enemyspec.js';
import { PEARL_TIERS } from '../content/pearl-enemies.js';
import { SENSOR_RINGS } from '../radar.js';
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
  if (!ENEMY_SPEC[type].rammable) q.hardcoreSeen = true;
  if (hull && q.hardcoreSeen && !q.sensorQueued) { q.sensorQueued = true; q.queue.push(['sensor', null, true]); }
  q.next = next;
  if (!q.busy) next();
  function next() {
    const [t, tier, hullOut = true] = q.queue.shift() ?? []; if (!t) { q.busy = false; return; }
    q.busy = true;
    if (t === 'sensor') {
      const card = document.createElement('div'); card.className = 'contact-card sensor-card'; card.style.setProperty('--tint', '#cbd2d8');
      const head = document.createElement('div'); head.className = 'contact-head'; head.textContent = 'TANK · PROXIMITY SENSORS';
      const facts = document.createElement('div'); facts.className = 'contact-facts';
      facts.textContent = `${hullOut ? 'Your tank has' : 'Once printed, your tank will have'} silent proximity sensors for hard-core enemies. In the mini-map’s tank view, arcs warn ahead, right, behind or left. ${SENSOR_RINGS.slice().reverse().map((r) => `${r.name.toUpperCase()}: ${r.cells} cells${r.level === 3 ? ' or closer' : ''}`).join(' · ')}. More arcs mean closer danger. Steer away and shoot; do not ram. This is a warning, not automatic braking. Hidden contacts cannot trigger it.`;
      const close = document.createElement('button'); close.type = 'button'; close.textContent = 'GOT IT';
      const scope = document.createElement('canvas'); scope.className = 'sensor-radar-copy'; scope.width = scope.height = 480;
      scope.setAttribute('aria-label', 'Enlarged radar with example proximity warnings');
      const label = document.createElement('div'); label.className = 'contact-role';
      const ctx = scope.getContext('2d'), source = root.querySelector('canvas.minimap') ?? document.querySelector('canvas.minimap');
      let frame = 0, began = null;
      const draw = (now) => {
        if (!card.isConnected) return;
        began ??= now; ctx.clearRect(0, 0, 480, 480);
        if (source?.width) ctx.drawImage(source, 0, 0, 480, 480);
        // Labelled example arcs remain useful when the real contacts are far
        // away. Their ranges and colours come from the radar's own rules.
        const example = SENSOR_RINGS[2 - Math.floor((now - began) / 1800) % 3];
        label.textContent = `SENSOR EXAMPLE · AHEAD · ${example.name.toUpperCase()} · ${example.cells} CELLS`;
        ctx.strokeStyle = example.color; ctx.lineWidth = 4;
        for (let i = 0; i < example.level; i++) { ctx.beginPath(); ctx.arc(240, 240, 224 - i * 11, -Math.PI * .72, -Math.PI * .28); ctx.stroke(); }
        frame = requestAnimationFrame(draw);
      };
      card.addEventListener('pointerdown', (e) => e.stopPropagation());
      card.addEventListener('keydown', (e) => e.stopPropagation());
      close.addEventListener('click', (e) => { e.stopPropagation(); cancelAnimationFrame(frame); card.remove(); next(); });
      card.append(head, scope, label, facts, close); root.appendChild(card); frame = requestAnimationFrame(draw); return;
    }
    const s = ENEMY_SPEC[t], look = contactLook(t, tier), tint = look.tint;
    if (hullOut) isaoSpeak('first_contact', { qualifier: s?.rammable ? 'rammable' : 'solid core' });
    const card = document.createElement('div'); card.className = 'contact-card'; card.style.setProperty('--tint', tint);
    const head = document.createElement('div'); head.className = 'contact-head'; head.textContent = 'NEW CONTACT';
    const name = document.createElement('div'); name.className = 'contact-name'; name.textContent = look.name;
    const role = document.createElement('div'); role.className = 'contact-role'; role.textContent = look.role;
    const facts = document.createElement('div'); facts.className = 'contact-facts';
    // before the hull is issued the ram does not exist yet (owner, 2026-10-15, the Quiver's first hard core: "we have not introduced the tank or the
    // concept of ramming yet. Replace it with 'these seem to have a harder-core, more dangerous'")
    facts.textContent = `${s.rammable ? hullOut ? 'RAMMABLE' : 'SOFT BODY' : hullOut ? 'SOLID CORE · DO NOT RAM' : 'HARDER CORE · MORE DANGEROUS'} · ${s.hp} HP`;
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

// Earlier hard-core sightings are remembered; the lesson belongs to the tank.
export function unlockTankSensors(root) {
 const q=root?.__contacts;if(!q?.hardcoreSeen||q.sensorQueued)return false;
 q.sensorQueued=true;q.queue.push(['sensor',null,true]);if(!q.busy)q.next?.();return true;
}
