// THE CHOICE CARD (owner, 2026-10-15, THE BOSS: "we could make it a funny choice; ISAO offering to either drive the tank, or let the gunship on
// autopilot. they land on the idea that since it's a new target, a round of manual-override of the gunship is needed"): a line of Isao's and two
// buttons over the paused game; the pick resolves and the card goes. Keys 1 and 2 pick; there is no way out without picking (Escape does nothing).
// The debrief's panel look (styles.css .choice-card, over .sdb-btn).
// ONE BUTTON (owner, 2026-10-19, third round, note 8a: "Arena fight; we lost the scene explaining that we need to manually control the gunship while Isao
// plays Lure with the tank"): THE ARENA's hand-over is the same card with a `title`, Isao's `lines`, a controls `hint` and only `a`; 1 or Enter takes it.
//   createChoiceCard(root) -> { show({ line | lines, title?, hint?, a, b? }) -> Promise<'a' | 'b'>, isOpen(), dispose() }
export function createChoiceCard(root) {
  let card = null, resolveWith = null, single = false;
  const onKey = (e) => { if (!card) return; if (e.key === '1' || (single && e.key === 'Enter')) pick('a'); else if (e.key === '2' && !single) pick('b'); else return; e.preventDefault(); e.stopPropagation(); };
  function pick(which) { const r = resolveWith; close(); r?.(which); }
  function close() { card?.remove(); card = null; resolveWith = null; globalThis.removeEventListener?.('keydown', onKey, true); }
  return {
    show({ line, lines, title, hint, a, b }) {
      close(); single = !b;
      card = document.createElement('div'); card.className = 'choice-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'assertive');
      const div = (cls, text) => { const el = document.createElement('div'); el.className = cls; el.textContent = text; return el; };
      const parts = [div('choice-who', 'COMMS · ISAO')];
      if (title) parts.push(div('choice-title', title));
      for (const l of lines ?? [line]) parts.push(div('choice-line', l));
      if (hint) parts.push(div('choice-hint', hint));
      const row = document.createElement('div'); row.className = 'choice-row';
      for (const [k, label] of single ? [['a', a]] : [['a', a], ['b', b]]) { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sdb-btn'; btn.dataset.pick = k; btn.textContent = single ? label : `${k === 'a' ? '1' : '2'} · ${label}`; btn.addEventListener('click', () => pick(k)); row.appendChild(btn); }
      card.append(...parts, row); root.appendChild(card);
      globalThis.addEventListener?.('keydown', onKey, true);
      return new Promise((resolve) => { resolveWith = resolve; });
    },
    isOpen: () => !!card,
    dispose: close,
  };
}
