// THE LANDING'S INSTRUMENTS (spec 2026-11-07-landing-mini-game-design.md section 5): a dozen readable things in the HUD's monochrome
// vocabulary, five touchable ones on phones. Pointer-transparent but for the touch rail. Numbers are set, never animated by the DOM.
import { LANDING_GAME } from '../content/landing-game.js';

const ROWS = [['alt', 'ALT', 'm'], ['speed', 'SPEED', 'm/s'], ['sink', 'SINK', 'm/s'], ['drift', 'DRIFT', 'm/s'], ['tilt', 'ATTITUDE', '°'], ['rate', 'ANG RATE', '°/s'], ['throttle', 'THRUST', '%'], ['tw', 'T/W', ''], ['stop', 'CAN STOP IN', 'm'], ['fuel', 'FUEL', 's']];
const INERT = { el: null, show() {}, set() {}, annunciate() {}, verdict() {}, clear() {}, touch() {}, dispose() {} };
export function createLandingHud(root, tune = LANDING_GAME) {
  if (!root || typeof document === 'undefined') return { ...INERT };
  const hard = tune.verdict.hard, low = tune.fuel?.lowSeconds ?? 0, brake = tune.vehicle.thrust - tune.sim.gravity;   // m/s² a full burn takes off the sink
  // only the annunciator and the verdict are live regions (2026-11-07, the final review): the numbers change every frame and would chatter
  const el = document.createElement('div'); el.id = 'landing-hud'; el.hidden = true;
  const ann = document.createElement('div'); ann.id = 'lh-ann'; ann.className = 'lh-ann'; ann.setAttribute('aria-live', 'polite'); el.append(ann);
  const make = (tag, cls, text = '') => { const n = document.createElement(tag); n.className = cls; n.textContent = text; return n; };
  const optics = make('div', 'lh-optics'); optics.setAttribute('aria-hidden', 'true'); el.append(optics);
  const groups = {};
  for (const id of ['motion', 'height', 'attitude', 'engine', 'reserve']) { groups[id] = make('div', `lh-instrument lh-${id}`); el.append(groups[id]); }
  const owner = { speed: 'motion', sink: 'motion', drift: 'motion', alt: 'height', stop: 'height', tilt: 'attitude', rate: 'attitude', throttle: 'engine', tw: 'engine', fuel: 'reserve' };
  const cells = {};
  for (const [id, label, unit] of ROWS) {
    const row = make('div', `lh-reading lh-reading-${id}`);
    const k = make('span', 'lh-k', label), v = make('b', 'lh-v', '—'), u = make('span', 'lh-u', unit);
    v.id = `lh-${id}`; row.append(k, v, u); groups[owner[id]].append(row); cells[id] = v;
  }
  // Moving scales carry actual speed and ground altitude, not decorative values.
  const tape = (group, step) => {
    const window = make('div', 'lh-tape'); window.setAttribute('aria-hidden', 'true');
    const ticks = Array.from({ length: 7 }, () => { const n = make('span', 'lh-tick'); window.append(n); return n; });
    group.append(window);
    return (value) => { const v = Number.isFinite(value) ? Math.max(0, value) : 0, base = Math.floor(v / step) * step;
      ticks.forEach((n, i) => { const mark = base + (3 - i) * step; n.textContent = mark < 0 ? '' : String(mark); n.hidden = mark < 0;
        n.style.setProperty('--tick-y', `${(i - 3 + (v - base) / step) * 30}px`); }); };
  };
  const speedTape = tape(groups.motion, 5), altTape = tape(groups.height, 20);
  const attitude = make('div', 'lh-bank'); attitude.setAttribute('aria-hidden', 'true');
  attitude.innerHTML = '<span class="lh-bank-arc"></span><span class="lh-bank-zero"></span><span class="lh-bank-pointer">△</span><span class="lh-bank-label lh-bank-left">−30</span><span class="lh-bank-label lh-bank-right">30</span>';
  groups.attitude.append(attitude);
  const thrust = make('div', 'lh-thrust-scale'); thrust.setAttribute('aria-hidden', 'true'); groups.engine.append(thrust);
  const keys = document.createElement('div'); keys.className = 'lh-keys'; keys.textContent = 'SPACE BURN · A/D TILT · L LEGS'; el.append(keys);
  const legs = document.createElement('div'); legs.id = 'lh-legs'; legs.className = 'lh-legs'; legs.textContent = 'LEGS UP'; groups.reserve.append(legs);
  const verdictEl = document.createElement('div'); verdictEl.id = 'lh-verdict'; verdictEl.className = 'lh-verdict'; verdictEl.setAttribute('aria-live', 'polite'); el.append(verdictEl);
  const rail = document.createElement('div'); rail.id = 'lh-touch'; rail.className = 'lh-touch'; rail.hidden = true; el.append(rail);
  root.append(el);
  const num = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  const hot = (node, on) => node.classList.toggle('hot', !!on);
  return {
    el,
    show(on) { el.hidden = !on; },
    set(r) {
      cells.speed.textContent = num(r.speed, 1); cells.rate.textContent = num((r.tiltRate ?? 0) * 180 / Math.PI, 1); cells.throttle.textContent = num((r.throttle ?? 0) * 100);
      attitude.style.setProperty('--tilt', `${r.tilt ?? 0}rad`);
      thrust.style.setProperty('--burn', `${Math.max(0, Math.min(1, r.throttle ?? 0)) * 100}%`);
      speedTape(r.speed); altTape(r.altitude);
      cells.alt.textContent = num(r.altitude); cells.sink.textContent = num(r.sink, 1); hot(cells.sink, r.sink > hard.sink);
      const drift = Math.hypot(r.driftAlong, r.driftAcross); cells.drift.textContent = `${r.driftAlong < 0 ? '←' : '→'} ${num(drift, 1)}`; hot(cells.drift, drift > hard.drift);
      cells.tilt.textContent = num(r.tilt * 180 / Math.PI, 1); hot(cells.tilt, Math.abs(r.tilt) > hard.tilt);
      cells.tw.textContent = num(r.tw, 2); cells.stop.textContent = num(r.hStop); hot(cells.stop, r.hStop > r.altitude);
      // FUEL red when it cannot pay for a full stop: the seconds of full burn the sink needs, sink / (thrust - g) (2026-11-07, the final review)
      // and at fuel.lowSeconds or under (owner, 2026-11-12: a generous limit, plainly called); EMPTY at zero
      cells.fuel.textContent = r.fuel <= 0 ? 'EMPTY' : num(r.fuel); hot(cells.fuel, r.fuel < r.sink / brake || r.fuel <= low);
      legs.textContent = r.legs >= 1 ? 'LEGS DOWN' : r.legs > 0 ? `LEGS ${Math.round(r.legs * 100)}%` : 'LEGS UP'; legs.classList.toggle('ok', r.legs >= 1);
    },
    annunciate(text, kind = 'info') { ann.textContent = text; ann.className = `lh-ann ${kind}`; },
    verdict({ grade, reason, sink, drift, tilt }) {
      verdictEl.textContent = `LANDING · ${grade} · ${reason.toUpperCase()} ${reason === 'sink' ? num(sink, 1) : reason === 'drift' ? num(drift, 1) : reason === 'tilt' ? num(tilt * 180 / Math.PI, 1) + '°' : ''}`.trim();
      verdictEl.className = `lh-verdict ${grade.toLowerCase()}`;
    },
    clear() { verdictEl.textContent = ''; verdictEl.className = 'lh-verdict'; ann.textContent = ''; ann.className = 'lh-ann'; },   // a fresh flight reads nothing from an earlier one
    touch(on, h = {}) {   // phones (spec 14 B): ◂ ▸ the tilt held (h.tilt(-1 / +1), 0 on the release), BURN held, LEGS, SKIP
      rail.hidden = !on; rail.replaceChildren();
      if (!on) return;
      // a press is captured to its button (2026-11-07, the review): a pointer leaving a held button before the release still releases it
      // there, and a lost capture is a release too
      const mk = (cls, text, down, up) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = `lh-btn ${cls}`; b.textContent = text;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (e.pointerId != null) b.setPointerCapture?.(e.pointerId); down?.(); });
        if (up) for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, up);
        return b;
      };
      rail.append(mk('tilt-left', '◂', () => h.tilt?.(-1), () => h.tilt?.(0)), mk('tilt-right', '▸', () => h.tilt?.(1), () => h.tilt?.(0)),
        mk('burn', 'BURN', () => h.burn?.(true), () => h.burn?.(false)), mk('legs', 'LEGS', () => h.legs?.()), mk('skip', 'SKIP', () => h.skip?.()));
    },
    dispose() { el.remove(); },
  };
}
