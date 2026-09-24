// The story's view strip, unlocked once the first wave is cleared: TANK
// drives, one button per mount takes that sentry's optic, GUNSHIP takes the
// orbital platform's guns while it is overhead, MAP is the global view. The
// host owns what each means; the strip only names them. On a growing page there
// is no TANK until the first hull rolls out of the Stålheart (src/fx/hull-issue.js):
// tank(false) hides the button and disables it, so its hotkey (7) refuses too.
export function createStoryViews(root, on) {
  const nav = document.createElement('nav'); nav.id = 'story-views'; root.append(nav);
  let current = 'tank', ship = null, tankShown = true;
  const active = (name) => { current = name; for (const b of nav.querySelectorAll('button')) b.classList.toggle('active', (b.dataset.mount ?? b.dataset.view) === name); };
  function mounts(list) {
    nav.innerHTML = [`<button type="button" data-view="tank">TANK</button>`, ...list.map((m) => `<button type="button" data-mount="${m.key}">${m.label.toUpperCase()}</button>`), `<button type="button" data-mount="gunship" class="gunship" disabled>GUNSHIP</button>`, `<button type="button" data-view="laser" class="laser" hidden disabled>SOL-82</button>`, `<button type="button" data-view="map">MAP</button>`].join('');
    for (const b of nav.querySelectorAll('button')) b.addEventListener('click', () => { if (b.dataset.mount) on.mount?.(b.dataset.mount); else on[b.dataset.view]?.(); active(b.dataset.mount ?? b.dataset.view); });
    ship = nav.querySelector('[data-mount="gunship"]'); laser = nav.querySelector('[data-view="laser"]'); active(current); if (laserLast) sol82(laserLast); tank(tankShown);
  }
  function tank(shown) { tankShown = !!shown; const b = nav.querySelector('[data-view="tank"]'); if (b) { b.hidden = !tankShown; b.disabled = !tankShown; } }
  // SOL-82 (src/domain/orbital-laser.js laserStrip): hidden offline, counting down to the pass, lit while it is overhead, amber when its energy runs low
  let laser = null, laserLast = null;
  function sol82(s) { laserLast = s; if (!laser) return; laser.hidden = !s.shown; laser.disabled = !s.live; laser.classList.toggle('live', s.live); laser.classList.toggle('warn', s.warn); if (laser.textContent !== s.text) laser.textContent = s.text; }
  // the pass: dark with the next arrival counting down, live while the guns are yours. Nothing here can change either.
  function station(on, seconds) { if (!ship) return; ship.disabled = !on; ship.classList.toggle('live', on); ship.classList.remove('ready'); const t = `GUNSHIP · ${Math.ceil(seconds)} S${on ? ' LEFT' : ''}`; if (ship.textContent !== t) ship.textContent = t; }
  // after the handover: the call-in meter fills; full, the button calls the pass (owner, 2026-09-14)
  function meter(progress, full) { if (!ship) return; ship.disabled = !full; ship.classList.toggle('ready', full); ship.classList.remove('live'); const t = full ? 'GUNSHIP · CALL' : `GUNSHIP · ${Math.round(progress * 100)}%`; if (ship.textContent !== t) ship.textContent = t; }
  mounts([]);
  return { active, mounts, station, meter, sol82, tank, dispose() { nav.remove(); } };
}
