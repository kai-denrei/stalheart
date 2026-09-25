// THE CONTROLS PAGE (2026-09-16: a friend who has never seen the game got the tank and no word about its keys; 2026-09-25: the owner
// could not find his way from the gunship back to the tank, and asked for "a quick one-page reminder of the controls at the beginning").
// One monochrome page, once per browser, as the landing hands over to the base (td-tab calls tick with ready); H or ? brings it back
// from anywhere, seats included (the seats let those keys through); any other key or the × closes it. Only keys the game's handlers
// really honour are listed: the tank (td-tab onKeyEvent), the seats (src/sentry-pilot.js, src/fx/laser-seat.js) and the strip's keys.
// On a touch shell the pad buttons get their names for a while instead. The shield hint is said once per browser, the first time the
// rack runs dry.
import { storage } from '../storage.js';

// a new key: the old card (the tank's keys only) was already seen in most browsers, and this page is not that card
const SEEN = 'td.controls-page-seen', RACK = 'td.shield-empty-hint', AUTO_HIDE_MS = 45000;
export const CONTROLS_PAGE = [
  ['MÖRK · THE TANK', [
    ['W / ↑', 'faster · tap twice to cruise'], ['S / ↓', 'brake, then reverse'], ['A D / ← →', 'steer · Q / E throttle'],
    ['Space', 'fire a shell'], ['Shift', 'hold: lasers'], ['T', 'shield'], ['V', 'view · 1 map · 2 first person · 3 third'],
  ]],
  ['SEATS · THE STRIP AT THE BOTTOM', [
    ['7 8 9 0', 'tank · gunship · SOL-82 · map, from anywhere'],   // the views strip's four buttons, on the keys (owner, 2026-09-16)
    ['Click', 'in a seat: locks the mouse, the mouse aims'], ['Space', 'in a seat: fire'],
    ['Esc', 'in a seat: frees the mouse · again: back to the tank'], ['P', 'in a seat: pause'], ['G', 'gunship briefing'],
  ]],
  ['ANY TIME', [['Esc', 'pause, in the tank'], ['H / ?', 'this page']]],
];
const PADS = [['#td-pad-fire', 'FIRE'], ['#td-pad-laser', 'LASER'], ['#td-pad-shield', 'SHIELD'], ['#td-pad-left', 'TURN'], ['#td-pad-right', 'TURN']];

export function createControlsCard(root, { mobile = false, store = storage, briefing = null } = {}) {
  const card = document.createElement('section'); card.id = 'controls-card'; card.hidden = true;
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'controls');
  card.innerHTML = `<header>CONTROLS <button type="button" data-close aria-label="close">×</button></header>${CONTROLS_PAGE.map(([title, keys]) => `<h4>${title}</h4><dl>${keys.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`).join('')}<footer>any key or click closes · H brings it back</footer>`;
  root.append(card);
  let onTank = false, labelTimer = 0, hinted = false, autoTimer = 0, seen = store.getItem(SEEN) === '1';   // read once: with storage blocked the card re-showed itself and re-armed its timer every frame (2026-09-25)
  const hide = () => { card.hidden = true; clearTimeout(autoTimer); };
  function show() {
    seen = true; store.setItem(SEEN, '1');
    if (!mobile) { card.hidden = false; return; }
    for (const [sel, label] of PADS) root.querySelector(sel)?.setAttribute('data-label', label);
    root.classList.add('pad-labelled'); clearTimeout(labelTimer); labelTimer = setTimeout(() => root.classList.remove('pad-labelled'), 15000);
  }
  card.querySelector('[data-close]').addEventListener('click', hide);
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  const onKey = (e) => {
    if (e.repeat || /INPUT|SELECT|TEXTAREA/.test(e.target?.tagName ?? '')) return;
    if (e.key === '?' || e.key === 'h' || e.key === 'H') { if (card.hidden) show(); else hide(); return; }   // from anywhere, seats included
    if (onTank && (e.key === 'g' || e.key === 'G')) { hide(); briefing?.(); return; }
    if (!card.hidden) hide();   // any other key closes the page (and still does what it does)
  };
  // and any click outside it: a player whose first move is the mouse is not left reading over the game
  const onPointer = (e) => { if (!card.hidden && !card.contains(e.target)) hide(); };
  addEventListener('keydown', onKey); addEventListener('pointerdown', onPointer, true);
  return {
    // tank: the story is past its handover and the player drives (no seat taken). ready: the story's first quiet moment (the landing
    // has handed over): the page comes up once per browser, then gets out of the way; H brings it back
    tick(tank, ready = tank) { onTank = !!tank; if (ready && !seen) { show(); autoTimer = setTimeout(hide, AUTO_HIDE_MS); } },
    // say: the host's one-line toast, called once per browser
    rackEmpty(say) { if (hinted || store.getItem(RACK) === '1') return; hinted = true; store.setItem(RACK, '1'); say?.(); },
    state: () => ({ shown: !card.hidden, labelled: root.classList.contains('pad-labelled') }),
    dispose() { removeEventListener('keydown', onKey); removeEventListener('pointerdown', onPointer, true); clearTimeout(labelTimer); clearTimeout(autoTimer); card.remove(); root.classList.remove('pad-labelled'); },
  };
}
