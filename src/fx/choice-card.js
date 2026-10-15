// THE CHOICE CARD (owner, 2026-10-15, THE BOSS: "we could make it a funny choice; ISAO offering to either drive the tank, or let the gunship on
// autopilot. they land on the idea that since it's a new target, a round of manual-override of the gunship is needed"): a line of Isao's and two
// buttons over the paused game; the pick resolves and the card goes. Keys 1 and 2 pick; there is no way out without picking (Escape does nothing).
// The debrief's panel look (styles.css .choice-card, over .sdb-btn).
//   createChoiceCard(root) -> { show({ line, a, b }) -> Promise<'a' | 'b'>, isOpen(), dispose() }
export function createChoiceCard(root) {
  let card = null, resolveWith = null;
  const onKey = (e) => { if (!card) return; if (e.key === '1') pick('a'); else if (e.key === '2') pick('b'); else return; e.preventDefault(); e.stopPropagation(); };
  function pick(which) { const r = resolveWith; close(); r?.(which); }
  function close() { card?.remove(); card = null; resolveWith = null; globalThis.removeEventListener?.('keydown', onKey, true); }
  return {
    show({ line, a, b }) {
      close();
      card = document.createElement('div'); card.className = 'choice-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'assertive');
      const who = document.createElement('div'); who.className = 'choice-who'; who.textContent = 'COMMS · ISAO';
      const text = document.createElement('div'); text.className = 'choice-line'; text.textContent = line;
      const row = document.createElement('div'); row.className = 'choice-row';
      for (const [k, label] of [['a', a], ['b', b]]) { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sdb-btn'; btn.dataset.pick = k; btn.textContent = `${k === 'a' ? '1' : '2'} · ${label}`; btn.addEventListener('click', () => pick(k)); row.appendChild(btn); }
      card.append(who, text, row); root.appendChild(card);
      globalThis.addEventListener?.('keydown', onKey, true);
      return new Promise((resolve) => { resolveWith = resolve; });
    },
    isOpen: () => !!card,
    dispose: close,
  };
}
