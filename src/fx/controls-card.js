// THE CONTROLS ARE TAUGHT (2026-09-16: a friend who has never seen the game got the tank and no word about its keys). A compact monochrome
// card, once, the first time the tank is the player's after the handover; H or ? brings it back. Only keys the game's handler really
// honours are listed (td-tab onKeyEvent: the mouse does not fire the tank, and there is no B). On a touch shell the pad buttons get
// their names for a while instead. The shield hint is said once per browser, the first time the rack runs dry.
import { storage } from '../storage.js';

const SEEN = 'td.controls-card-seen', RACK = 'td.shield-empty-hint';
const KEYS = [
  ['W / ↑', 'faster · tap twice to cruise'], ['S / ↓', 'brake, then reverse'], ['A D / ← →', 'steer'], ['Q / E', 'throttle up / down'],
  ['Space', 'fire a shell'], ['Shift', 'hold: lasers'], ['T', 'shield'], ['V', 'change view · 1 map · 2 first person · 3 third'],
  ['Esc', 'pause'], ['H / ?', 'this card'],
];
const PADS = [['#td-pad-fire', 'FIRE'], ['#td-pad-laser', 'LASER'], ['#td-pad-shield', 'SHIELD'], ['#td-pad-left', 'TURN'], ['#td-pad-right', 'TURN']];

export function createControlsCard(root, { mobile = false, store = storage } = {}) {
  const card = document.createElement('section'); card.id = 'controls-card'; card.hidden = true;
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'tank controls');
  card.innerHTML = `<header>MÖRK · CONTROLS <button type="button" data-close aria-label="close">×</button></header><dl>${KEYS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  root.append(card);
  let onTank = false, labelTimer = 0, hinted = false;
  const hide = () => { card.hidden = true; };
  function show() {
    store.setItem(SEEN, '1');
    if (!mobile) { card.hidden = false; return; }
    for (const [sel, label] of PADS) root.querySelector(sel)?.setAttribute('data-label', label);
    root.classList.add('pad-labelled'); clearTimeout(labelTimer); labelTimer = setTimeout(() => root.classList.remove('pad-labelled'), 15000);
  }
  card.querySelector('[data-close]').addEventListener('click', hide);
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  const onKey = (e) => {
    if (!onTank || e.repeat || /INPUT|SELECT|TEXTAREA/.test(e.target?.tagName ?? '')) return;
    if (e.key === '?' || e.key === 'h' || e.key === 'H') { if (card.hidden) show(); else hide(); }
    else if (e.key === 'Escape') hide();
  };
  addEventListener('keydown', onKey);
  return {
    // tank: the story is past its handover and the player drives (no seat taken)
    tick(tank) { onTank = !!tank; if (!onTank) { if (!card.hidden) hide(); return; } if (store.getItem(SEEN) !== '1') show(); },
    // say: the host's one-line toast, called once per browser
    rackEmpty(say) { if (hinted || store.getItem(RACK) === '1') return; hinted = true; store.setItem(RACK, '1'); say?.(); },
    state: () => ({ shown: !card.hidden, labelled: root.classList.contains('pad-labelled') }),
    dispose() { removeEventListener('keydown', onKey); clearTimeout(labelTimer); card.remove(); root.classList.remove('pad-labelled'); },
  };
}
