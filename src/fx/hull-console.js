// THE HULL CONSOLE (owner, 2026-10-16: "redesign UI elements for KM/H and auto-cruise and where the Isao messages appear so it is all coherent.
// Currently feels like 3 separate elements vying for the same space"; before it, 2026-10-15: the speed in km/h "in small on the HUD above the
// RADAR"): one line over the radar and the throttle lever beside it, bottom left, that is the hull's own readout: its name and armour as pips
// (HULL_ARMOUR, src/content/tank.js; a dent flashes the line red), its pace in km/h from frame to frame, smoothed, and how it is driven (MANUAL,
// CRUISE, or the autopilot's directive). Isao's card stands above the line (styles.css #td-brief), the radar and the lever under it. Not on a phone.
//   createHullConsole(container, { metres })   metres(): metres a unit of the hull's space
//   -> { tick(dt, pos, { on, above, armour, hits, mode }), kmh(), dispose() }
//      on: shown or hidden; above: pixels the line sits over the screen's bottom edge; armour of hits: the dents left; mode: the word
export function createHullConsole(container, { metres }) {
  const el = document.createElement('div'); el.className = 'hull-console'; el.hidden = true;
  el.innerHTML = '<span class="hc-hull">MÖRK <i class="hc-pips"></i></span><span class="hc-kmh"></span><span class="hc-mode"></span>';
  container.appendChild(el);
  const pips = el.querySelector('.hc-pips'), kmhEl = el.querySelector('.hc-kmh'), modeEl = el.querySelector('.hc-mode');
  let last = null, kmh = 0, frame = 0, wasArmour = null, dentT = 0, drawn = '';
  return {
    tick(dt, pos, { on, above, armour = null, hits = 0, mode = '' }) {
      const k = dt > 0 && last && pos ? Math.hypot(pos[0] - last[0], pos[1] - last[1], pos[2] - last[2]) / dt * metres() * 3.6 : 0;
      kmh += (k - kmh) * Math.min(1, dt * 6);
      last = pos ? pos.slice() : null;
      if (el.hidden === !!on) el.hidden = !on;
      if (wasArmour !== null && armour !== null && armour < wasArmour) dentT = 0.5;   // a dent: the line flashes (styles.css .hc-dent)
      wasArmour = armour;
      if (dentT > 0) { dentT -= dt; el.classList.add('hc-dent'); } else el.classList.remove('hc-dent');
      if (!on) return;
      if ((frame++ & 3) === 0) { kmhEl.textContent = `${Math.round(kmh)} km/h`; el.style.bottom = `calc(max(14px, env(safe-area-inset-bottom)) + ${above}px)`; }
      const row = `${armour ?? ''}/${hits}/${mode}`;
      if (row !== drawn) { drawn = row; pips.textContent = hits > 0 ? '■'.repeat(Math.max(0, armour ?? hits)) + '□'.repeat(Math.max(0, hits - (armour ?? hits))) : ''; modeEl.textContent = mode; el.classList.toggle('hc-low', hits > 0 && armour !== null && armour <= 1); }
    },
    kmh: () => kmh,
    dispose() { el.remove(); },
  };
}
