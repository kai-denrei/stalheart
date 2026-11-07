// THE LANDING'S INSTRUMENTS (spec 2026-11-07-landing-mini-game-design.md section 5): a dozen readable things in the HUD's monochrome
// vocabulary, three touchable ones on phones. Pointer-transparent but for the touch rail. Numbers are set, never animated by the DOM.
import { LANDING_GAME } from '../content/landing-game.js';

const ROWS = [['alt', 'ALT', 'm'], ['sink', 'SINK', 'm/s'], ['drift', 'DRIFT', 'm/s'], ['tilt', 'TILT', '°'], ['tw', 'T/W', ''], ['stop', 'CAN STOP IN', 'm'], ['fuel', 'FUEL', 's']];
const INERT = { el: null, show() {}, set() {}, annunciate() {}, verdict() {}, clear() {}, touch() {}, dispose() {} };
export function createLandingHud(root, tune = LANDING_GAME) {
  if (!root || typeof document === 'undefined') return { ...INERT };
  const hard = tune.verdict.hard, brake = tune.vehicle.thrust - tune.sim.gravity;   // m/s² a full burn takes off the sink
  // only the annunciator and the verdict are live regions (2026-11-07, the final review): the numbers change every frame and would chatter
  const el = document.createElement('div'); el.id = 'landing-hud'; el.hidden = true;
  const ann = document.createElement('div'); ann.id = 'lh-ann'; ann.className = 'lh-ann'; ann.setAttribute('aria-live', 'polite'); el.append(ann);
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
  const verdictEl = document.createElement('div'); verdictEl.id = 'lh-verdict'; verdictEl.className = 'lh-verdict'; verdictEl.setAttribute('aria-live', 'polite'); el.append(verdictEl);
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
      // FUEL red when it cannot pay for a full stop: the seconds of full burn the sink needs, sink / (thrust - g) (2026-11-07, the final review)
      cells.fuel.textContent = num(r.fuel); hot(cells.fuel, r.fuel < r.sink / brake);
      legs.textContent = r.legs >= 1 ? 'LEGS DOWN' : r.legs > 0 ? `LEGS ${Math.round(r.legs * 100)}%` : 'LEGS UP'; legs.classList.toggle('ok', r.legs >= 1);
    },
    annunciate(text, kind = 'info') { ann.textContent = text; ann.className = `lh-ann ${kind}`; },
    verdict({ grade, reason, sink, drift, tilt }) {
      verdictEl.textContent = `LANDING · ${grade} · ${reason.toUpperCase()} ${reason === 'sink' ? num(sink, 1) : reason === 'drift' ? num(drift, 1) : reason === 'tilt' ? num(tilt * 180 / Math.PI, 1) + '°' : ''}`.trim();
      verdictEl.className = `lh-verdict ${grade.toLowerCase()}`;
    },
    clear() { verdictEl.textContent = ''; verdictEl.className = 'lh-verdict'; ann.textContent = ''; ann.className = 'lh-ann'; },   // a fresh flight reads nothing from an earlier one
    touch(on, h = {}) {   // phones (spec 10): BURN held, LEGS, SKIP; the stick is on the scene (src/fx/landing-stick.js)
      rail.hidden = !on; rail.replaceChildren();
      if (!on) return;
      // a press is captured to its button (2026-11-07, the review): a mouse leaving BURN before the release still releases it there, and a
      // lost capture is a release too
      const mk = (cls, text, down, up) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = `lh-btn ${cls}`; b.textContent = text;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (e.pointerId != null) b.setPointerCapture?.(e.pointerId); down?.(); });
        if (up) for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, up);
        return b;
      };
      rail.append(mk('burn', 'BURN', () => h.burn?.(true), () => h.burn?.(false)), mk('legs', 'LEGS', () => h.legs?.()), mk('skip', 'SKIP', () => h.skip?.()));
    },
    dispose() { el.remove(); },
  };
}
