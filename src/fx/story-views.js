// The story's view strip, unlocked once the first wave is cleared: TANK
// drives, one button per mount takes that sentry's optic, GUNSHIP takes the
// orbital platform's guns while it is overhead, MAP is the global view. The
// host owns what each means; the strip only names them. On a growing page there
// is no TANK until the first hull rolls out of the Stålheart (src/fx/hull-issue.js):
// tank(false) hides the button and disables it, so its hotkey (7) refuses too.
import { onStation, phaseLeft, startStation, selectGun } from '../domain/gunship.js';
import { callGunship } from '../domain/gunship-call.js';
import { GUNSHIP_ORBIT, GUNSHIP_GUNS } from '../content/gunship.js';
import { createGunshipBriefing } from './gunship-briefing.js';
import { showOrder } from './order-callout.js';
import { takeSeatView } from '../domain/seat-view.js';

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
  // TAB CYCLES THE VIEWS (owner, 2026-10-02): the next button on the strip that is shown and enabled, after the one that is active
  const onKey = (e) => {
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey || e.target?.closest?.('input, textarea, select')) return;
    const list = [...nav.querySelectorAll('button')].filter((b) => !b.hidden && !b.disabled);
    if (!list.length) return;
    e.preventDefault();
    const at = list.findIndex((b) => b.classList.contains('active')), next = list[(at + (e.shiftKey ? list.length - 1 : 1)) % list.length];
    next.click();
  };
  globalThis.addEventListener?.('keydown', onKey, true);
  // THE VIEW BACK (owner, 2026-10-06, twice: "after the language analysis the player is left in a bird's-eye view: go back to
  // whichever view was interrupted"): `now` is the strip's view; `back(was, setView)` takes a seat again through its own button when
  // it is still lit, else the camera view the player had. A seat whose button is gone (the handover automated the towers while the
  // player sat in one, the pass ended) cannot be given back, and its camera ('bastion') is not a place to leave the player: the
  // hull's own view then (src/domain/seat-view.js takeSeatView), the map only if the map was what the close-up interrupted
  const now = () => current;
  function back(was, setView) {
    const b = was && !['tank', 'map'].includes(was.seat) && nav.querySelector(`[data-mount="${was.seat}"], [data-view="${was.seat}"]`);
    if (b && !b.hidden && !b.disabled) { b.click(); return; }
    const v = takeSeatView(was).view; setView(v); active(v === 'orbit' ? 'map' : 'tank');
  }
  return { active, mounts, station, meter, sol82, tank, now, back, dispose() { globalThis.removeEventListener?.('keydown', onKey, true); nav.remove(); } };
}

// THE CONTROLLER'S SIDE of the strip, moved out of the controller's storyApi unchanged; the controller merges it back into
// storyApi. unlock('views') builds the strip once (the controller keeps it as its storyViews) and wires what each button means:
// TANK leaves the seat; a mount takes that sentry's optic, or switches to it from a seat; GUNSHIP takes the gunship's guns while
// it is overhead or can be called in, the briefing first (once per browser, the game paused under it) unless a sector is being
// fought; MAP is the global view, or the seat's own map. Every unlock then names the mounts (none on an automated page), shows
// or hides TANK, and sets the pass and the lit button.
// `host` hands in the controller: its fixed objects and functions as values (root, towers, gunship, gunshipRig, automated,
// enterPilot, leavePilot, setView, showBrief), what it rebinds as getters (story, storyViews, pilot, pilotMode, pilotHost,
// sectorRun, gunshipBriefing, paused) and the lets it writes as setters (setStoryViews and setGunshipBriefing, each returning
// what it wrote as the `??=` they stand in for did, and setPaused).
export function createUnlockHost(host) {
  const { root, towers, gunship, gunshipRig, automated, enterPilot, leavePilot, setView, showBrief } = host;
  return {
    // THE QUIVER'S SECOND KILL HANDS STRAIGHT TO THE GUNSHIP (owner, 2026-10-05: "the player is going straight to the Gunship thermal
    // view"): on station, the seat taken with the MK-9 up and the order over it; the briefing waits for the next sector's brief
    gunshipSeat: () => {
      if (!onStation(gunship) || !host.storyViews()) return false;
      (host.gunshipBriefing() ?? host.setGunshipBriefing(createGunshipBriefing(root))).later();
      selectGun(gunship, 'heavy', GUNSHIP_GUNS);
      if (!host.pilotMode()) enterPilot(towers.map((t) => t.ci));
      if (host.pilot()?.mountGunship() !== 'mounted') return false;
      host.storyViews().active('gunship'); showOrder(root, 'NUKE THE ENTRANCE!', 'press 1-2-3 to cycle the weapons', 5000);
      return true;
    },
    unlock: (what) => {
      if (what === 'views') {
        host.storyViews() ?? host.setStoryViews(createStoryViews(root, {
          // TANK IS THE TANK (2026-09-25 playtest): leaving a seat restores the view that seat was entered from, which can be the map;
          // the TANK button (and 7, and Esc in a seat) always ends on the hull's own view, and works from the map without a seat too
          tank: () => { leavePilot(); if (!/^(third|pov)$/.test(host.view())) { setView('third'); host.snapCamera(); } },
          mount: (key) => {
            if (key === 'gunship') {
              if (!onStation(gunship) && !(gunshipRig.onCall() && callGunship(gunshipRig.call) && startStation(gunship, GUNSHIP_ORBIT))) return;
              const seat = () => { if (!host.pilotMode()) enterPilot(towers.map((t) => t.ci)); if (host.pilot().mountGunship() !== 'mounted') host.storyViews().active('tank'); else showBrief('gunship_pass'); };
              // Isao's line comes with the seat, not the pass. The first seat is preceded by the briefing, the game paused under it
              if ((host.gunshipBriefing() ?? host.setGunshipBriefing(createGunshipBriefing(root))).seen()) seat();
              else if (host.sectorRun()?.state().phase === 'fighting') { host.gunshipBriefing().later(); seat(); }   // a live sector is never frozen under it: it waits for the next sector's brief
              else host.gunshipBriefing().openPaused({ get: () => host.paused(), set: (v) => { host.setPaused(v); } }, () => { if (onStation(gunship)) seat(); else host.storyViews().active('tank'); });
              return;
            }
            if (host.pilotMode()) host.pilotHost()?.pick(key);
            else { const tw = towers.find((t) => t.key === key); if (tw) enterPilot([tw.ci, ...towers.map((t) => t.ci).filter((c) => c !== tw.ci)]); }
          },
          map: () => (host.pilotMode() ? host.pilot().setView('map') : setView('orbit')),
        }));
        host.storyViews().mounts(automated() ? [] : towers.map((t) => ({ key: t.key, label: t.def.label.replace(/^\d+\.\s*/, '') })));
        host.storyViews().tank(!host.story()?.hull?.held());
        host.storyViews().station(onStation(gunship), phaseLeft(gunship));
        host.storyViews().active(host.pilot()?.state.tower?.key ?? 'tank');
      }
    },
  };
}
