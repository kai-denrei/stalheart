// THE LANDING'S INSTRUMENTS (spec 2026-11-07-landing-mini-game-design.md section 5): a dozen readable things in the HUD's monochrome
// vocabulary, six touchable ones on phones. Pointer-transparent but for the touch rail. Numbers are set, never animated by the DOM.
import { LANDING_GAME } from '../content/landing-game.js';

const ROWS = [['alt', 'ALT', 'm'], ['sink', 'SINK', 'm/s'], ['drift', 'DRIFT', 'm/s'], ['tilt', 'TILT', '°'], ['tw', 'T/W', ''], ['stop', 'CAN STOP IN', 'm'], ['fuel', 'FUEL', 's']];
const INERT = { el: null, show() {}, set() {}, annunciate() {}, verdict() {}, offer() {}, touch() {}, dispose() {} };
export function createLandingHud(root, tune = LANDING_GAME) {
  if (!root || typeof document === 'undefined') return { ...INERT };
  const hard = tune.verdict.hard;
  const el = document.createElement('div'); el.id = 'landing-hud'; el.setAttribute('aria-live', 'polite'); el.hidden = true;
  const ann = document.createElement('div'); ann.id = 'lh-ann'; ann.className = 'lh-ann'; el.append(ann);
  const grid = document.createElement('div'); grid.className = 'lh-grid';
  const cells = {};
  for (const [id, label, unit] of ROWS) {
    const k = document.createElement('span'); k.className = 'lh-k'; k.textContent = label;
    const v = document.createElement('b'); v.id = `lh-${id}`; v.className = 'lh-v'; v.textContent = '—';
    const u = document.createElement('span'); u.className = 'lh-u'; u.textContent = unit;
    grid.append(k, v, u); cells[id] = v;
  }
  el.append(grid);
  const legs = document.createElement('div'); legs.id = 'lh-legs'; legs.className = 'lh-legs'; legs.textContent = 'LEGS UP'; el.append(legs);
  const verdictEl = document.createElement('div'); verdictEl.id = 'lh-verdict'; verdictEl.className = 'lh-verdict'; el.append(verdictEl);
  const offerEl = document.createElement('div'); offerEl.id = 'lh-offer'; offerEl.className = 'lh-offer'; offerEl.hidden = true; el.append(offerEl);
  const rail = document.createElement('div'); rail.id = 'lh-touch'; rail.className = 'lh-touch'; rail.hidden = true; el.append(rail);
  root.append(el);
  const num = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  const hot = (node, on) => node.classList.toggle('hot', !!on);
  return {
    el,
    show(on) { el.hidden = !on; },
    set(r) {
      cells.alt.textContent = num(r.altitude); cells.sink.textContent = num(r.sink, 1); hot(cells.sink, r.sink > hard.sink);
      const drift = Math.hypot(r.driftAlong, r.driftAcross); cells.drift.textContent = `${r.driftAlong < 0 ? '←' : '→'} ${num(drift, 1)}`; hot(cells.drift, drift > hard.drift);
      cells.tilt.textContent = num(r.tilt * 180 / Math.PI, 1); hot(cells.tilt, Math.abs(r.tilt) > hard.tilt);
      cells.tw.textContent = num(r.tw, 2); cells.stop.textContent = num(r.hStop); hot(cells.stop, r.hStop > r.altitude);
      cells.fuel.textContent = num(r.fuel); hot(cells.fuel, r.fuel < r.hStop / Math.max(1, r.sink));
      legs.textContent = r.legs >= 1 ? 'LEGS DOWN' : r.legs > 0 ? `LEGS ${Math.round(r.legs * 100)}%` : 'LEGS UP'; legs.classList.toggle('ok', r.legs >= 1);
    },
    annunciate(text, kind = 'info') { ann.textContent = text; ann.className = `lh-ann ${kind}`; },
    verdict({ grade, reason, sink, drift, tilt }) {
      verdictEl.textContent = `LANDING · ${grade} · ${reason.toUpperCase()} ${reason === 'sink' ? num(sink, 1) : reason === 'drift' ? num(drift, 1) : reason === 'tilt' ? num(tilt * 180 / Math.PI, 1) + '°' : ''}`.trim();
      verdictEl.className = `lh-verdict ${grade.toLowerCase()}`;
    },
    offer(on, key = 'SPACE') { offerEl.hidden = !on; offerEl.textContent = on ? `AUTO-LAND · [${key}] OVERRIDE` : ''; },
    touch(on, h = {}) {   // phones: a throttle slider, two tilt buttons, LEGS, SKIP (spec section 5)
      rail.hidden = !on; rail.replaceChildren();
      if (!on) return;
      const mk = (cls, text, down, up) => { const b = document.createElement('button'); b.type = 'button'; b.className = `lh-btn ${cls}`; b.textContent = text; b.addEventListener('pointerdown', (e) => { e.preventDefault(); down?.(); }); if (up) { b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); } return b; };
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = '0'; slider.className = 'lh-throttle'; slider.addEventListener('input', () => h.throttle?.(+slider.value / 100));
      rail.append(mk('tilt-back', 'TILT ◀', () => h.tilt?.(-1), () => h.tilt?.(0)), mk('tilt-fwd', 'TILT ▶', () => h.tilt?.(1), () => h.tilt?.(0)), slider, mk('legs', 'LEGS', () => h.legs?.()), mk('skip', 'SKIP', () => h.skip?.()));
    },
    dispose() { el.remove(); },
  };
}
