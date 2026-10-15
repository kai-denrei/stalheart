// THE SPEED OVER THE RADAR (owner, 2026-10-15: "we will increase the hover tank's speed system whereby going forward and not hitting anything
// increases the speed, since there is no friction with the ground. We will display its speed in KM/H in small on the HUD above the RADAR"):
// the hull's own pace from frame to frame, smoothed, in km/h, a small line above the minimap (styles.css .hull-speed; not on a phone). The pull
// itself is TANK_DRIVE (src/content/tank.js) through src/domain/drive-ramp.js.
//   createHullSpeed(container, { metres })   metres(): metres a unit of the hull's space
//   -> { tick(dt, pos, { on, above }), kmh(), dispose() }   on: shown or hidden; above: pixels the readout sits over the screen's bottom edge
export function createHullSpeed(container, { metres }) {
  const el = document.createElement('div'); el.className = 'hull-speed'; el.hidden = true; container.appendChild(el);
  let last = null, kmh = 0, frame = 0;
  return {
    tick(dt, pos, { on, above }) {
      const k = dt > 0 && last && pos ? Math.hypot(pos[0] - last[0], pos[1] - last[1], pos[2] - last[2]) / dt * metres() * 3.6 : 0;
      kmh += (k - kmh) * Math.min(1, dt * 6);
      last = pos ? pos.slice() : null;
      if (el.hidden === !!on) el.hidden = !on;
      if (on && (frame++ & 3) === 0) { el.textContent = `${Math.round(kmh)} km/h`; el.style.bottom = `calc(max(14px, env(safe-area-inset-bottom)) + ${above}px)`; }
    },
    kmh: () => kmh,
    dispose() { el.remove(); },
  };
}
