// THE STICK (spec 10): the 2D game's floating thumb-stick (Stalsfar_Landing/landing/touch-pilot.js) with the mouse allowed and a second
// axis. A press anywhere on the scene drops a ring at the press point; the drag from it, clamped to `full` px, past a `dead` px dead zone,
// is the tilt (up is the nose forward, +z) and the bank (right is +x), each -1..1, linear between. Read once a step by the landing's host
// (src/fx/manual-landing.js), which the keys outrank. The DOM is optional: without one (node, or no root) the stick is inert.
// The press is heard in CAPTURE on the window (2026-11-07, the review): the camera shot's tap listener is a capture listener on #tab-td
// that eats every tap while a skippable shot runs, so a bubbling listener never heard one; the stick does not stop the event (the shot
// may still take it). The drag and the release are heard on the window too.
const INERT = Object.freeze({ tiltRate: 0, bankRate: 0, reset() {}, dispose() {} });

// the rates for a drag of (dx, dy) px from the press point (screen y down): the throw clamped to `full`, then each axis past `dead`
export function stickRates(dx, dy, { dead, full }) {
  const f = Math.min(1, full / Math.max(1, Math.hypot(dx, dy)));
  const v = (a) => { const u = a * f; return Math.abs(u) < dead ? 0 : Math.sign(u) * Math.min(1, (Math.abs(u) - dead) / (full - dead)); };
  return { tiltRate: 0 - v(dy), bankRate: v(dx) };   // 0 - v: no -0 at rest
}

// `enabled()` says whether a press may take the stick (the host: during OVERRIDE and MANUAL); presses on the page's own controls are theirs.
// `root` gates the stick (no root: inert); the press itself is taken anywhere on the page, in capture on the window
export function createStick(root, { dead, full, enabled = () => true }) {
  const view = globalThis, doc = globalThis.document;
  if (!root || typeof root.addEventListener !== 'function' || !doc?.body || typeof view.addEventListener !== 'function') return { ...INERT };
  let pointer = null, x0 = 0, y0 = 0, ring = null, knob = null, rates = { tiltRate: 0, bankRate: 0 };
  const reset = () => { pointer = null; rates = { tiltRate: 0, bankRate: 0 }; ring?.remove(); ring = knob = null; };
  const move = (ev) => {
    if (ev.pointerId !== pointer) return;
    ev.preventDefault?.();
    const dx = ev.clientX - x0, dy = ev.clientY - y0, f = Math.min(1, full / Math.max(1, Math.hypot(dx, dy)));
    rates = stickRates(dx, dy, { dead, full });
    if (knob) knob.style.transform = `translate(${dx * f}px, ${dy * f}px)`;
  };
  const down = (ev) => {
    if (pointer !== null || !enabled() || ev.target?.closest?.('button, a, input, select, summary')) return;
    ev.preventDefault?.(); pointer = ev.pointerId; x0 = ev.clientX; y0 = ev.clientY;
    ring = doc.createElement('div'); ring.className = 'lh-stick'; knob = doc.createElement('i'); ring.append(knob);
    ring.style.left = `${x0}px`; ring.style.top = `${y0}px`; doc.body.append(ring);
    ev.target?.setPointerCapture?.(pointer);
    move(ev);
  };
  const up = (ev) => { if (ev.pointerId === pointer) reset(); };
  const opts = { passive: false }, press = { passive: false, capture: true };
  view.addEventListener('pointerdown', down, press); view.addEventListener('pointermove', move, opts);
  const ends = ['pointerup', 'pointercancel', 'lostpointercapture'];
  for (const t of ends) view.addEventListener(t, up);
  view.addEventListener('blur', reset); view.addEventListener('resize', reset);
  return {
    get tiltRate() { return rates.tiltRate; }, get bankRate() { return rates.bankRate; },
    reset,
    dispose() {
      reset(); view.removeEventListener('pointerdown', down, press); view.removeEventListener('pointermove', move, opts);
      for (const t of ends) view.removeEventListener(t, up);
      view.removeEventListener('blur', reset); view.removeEventListener('resize', reset);
    },
  };
}
