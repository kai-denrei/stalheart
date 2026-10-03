// THE WHY, LACONIC (owner, 2026-10-03: "a very short tight expose. Like Isao in Laconic mode. Veni-Vidi-Vici is the goal! Land >
// Resources > Build > Defend > Send Satellites to link to the Dyson Sphere"; the long form is the A6 terraforming story). Over the
// landing shot, top centre: the beats one word at a time, each `beat` seconds, then Isao's one line, held `hold` seconds, then gone.
// Pointer-transparent; a page without a DOM shows nothing.
export function showMission(root, { beats, line, beat = 0.75, hold = 2.6 }) {
  if (!root || typeof document === 'undefined' || root.querySelector('#mission-card')) return null;
  const el = document.createElement('div'); el.id = 'mission-card'; el.setAttribute('aria-live', 'polite');
  const row = document.createElement('div'); row.className = 'mc-beats';
  const words = beats.map((w, i) => { const s = document.createElement('span'); s.textContent = w; s.style.animationDelay = `${i * beat}s`; return s; });
  row.append(...words);
  const say = document.createElement('div'); say.className = 'mc-line'; say.textContent = line; say.style.animationDelay = `${beats.length * beat}s`;
  el.append(row, say); root.append(el);
  const total = beats.length * beat + hold;
  const t = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, total * 1000);
  return { el, total, dispose() { clearTimeout(t); el.remove(); } };
}
