// THE DESCENT'S HOST (owner, 2026-10-15: the cave game as the campaign's last mission; spec docs/superpowers/specs/2026-10-15-descent-mission-design.md;
// DESCENT in src/content/descent.js, the rules src/domain/descent.js). The sector loop calls begin(then) as the final sector is secured, with `then`
// the finale it would have played (src/fx/sector-run.js finish); this says Isao's brief, lets it be read, pauses the game, opens the cave's page (below/, vendored by
// scripts/import-below.mjs) in an iframe over the tab, and waits for the cave to post its outcome ({ below }); then the frame goes, the game runs
// again, Isao's decoding joke is said (as his last transmission on a sacrifice) and `then` plays the ending. A lost descent keeps the frame: the
// cave's own TRY AGAIN. Not due (a phone, DESCENT.mobileSkip): the brief alone, then `then` at once.
//   createDescentHost(root, c) -> { begin(then) -> boolean (true: the handoff taken), report(outcome) (the harness's message), state(), dispose() }
// THE HOLE IS THE DOOR (owner, 2026-10-26, note 7; src/fx/hole-door.js): the look is the rim view while Isao's brief is read; once it is read (as before) the
// camera dives down the hole's axis to under the lip over DESCENT.lookHold (c.dive), holds DESCENT.door.settle, and the cave shows; as the cave goes the
// camera rises from under the lip to the rim (c.rise) and the ending follows as before. c.door() measures the camera against the hole (the harness).
// THE CAVE LOADS BEHIND A STILL GAME (owner, 2026-11-02, note 10: "just before BELOW the fps drops to 17 in the tank view, apparently because BELOW is
// loading"): the look glides to the rim view (DESCENT.still game seconds), then c.hold(true) stands the game still on that frame (paused, nothing drawn,
// Isao's panel reading on) and only then is the cave's frame made; the cave posts { belowReady } once built and drawn (it then idles), and when that
// and the brief are done (descentLoadDone, real seconds) c.hold(false) runs the game for the dive; as the frame shows the game stands still again
// under it (nothing drawn behind the cave) and the frame is told { belowShow }; take() lets it go.
// `c`: hold(v) (the game paused with nothing drawn, its last frame kept, Isao's panel reading on; false runs it), wall() (optional: real seconds), showBrief(id), speak(id), story() (the run's story object: `descent` is written on it), mobile (a phone), t() (game seconds), look(cell)
// (the camera to the arena's hole's rim while the brief is read: the nest's mouth is a place on the planet, 2026-10-16), dive(cell, s), rise(cell) and
// door(cell) (src/fx/hole-door.js, 2026-10-26), briefing() (the brief id on
// Isao's panel or waiting for it, null when quiet: the cave waits for it, the descent's own brief up DESCENT.briefCap game seconds at most, 2026-10-18).
import { DESCENT } from '../content/descent.js';
import { descentDue, descentResult, descentNext, descentOpenDue, descentLoadDone } from '../domain/descent.js';

export function createDescentHost(root, c) {
  let frame = null, onMsg = null, thenFn = null, poll = null, briefFrom = null, openedAt = null, hole = -1, diveAt = null, phase = null, stillAt = null, readyAt = null, loadedIn = null;
  const wall = () => c.wall?.() ?? globalThis.performance.now() / 1000;   // real seconds: the game's clock stands still while it is held
  const said = [];   // the briefs asked, for the harness
  const say = (id) => { said.push(id); c.showBrief(id); c.speak(id); };
  function cleanup() { if (poll) clearTimeout(poll); poll = null; if (onMsg) globalThis.removeEventListener?.('message', onMsg); onMsg = null; frame?.remove(); frame = null; phase = null; }
  function take(data) {
    const o = descentResult(data, DESCENT);
    if (!o || !frame) return false;
    const s = c.story(); if (s) s.descent = { outcome: o, at: c.t() };
    if (descentNext(o) === 'retry') return true;   // the cave offers TRY AGAIN; nothing reaches the game until a charge is placed
    const then = thenFn; cleanup(); thenFn = null;
    c.hold(false);
    if (hole >= 0) c.rise?.(hole);   // out of the cave the way it went in: up the same hole's axis to its rim (note 7)
    say(o === 'sacrifice' ? DESCENT.last : DESCENT.back);
    if (then) setTimeout(then, (DESCENT.jokeHold ?? 0) * 1000);   // the joke read, then the ending
    return true;
  }
  return {
    begin(then, { outcome = 'secure', final = true } = {}) {
      if (phase) return true;
      if (!descentDue({ outcome, final, mobile: !!c.mobile }, DESCENT)) { if (final && outcome === 'secure') c.showBrief(DESCENT.brief); then?.(); return false; }
      thenFn = then;
      say(DESCENT.brief);
      const arena = c.story()?.arena?.cell ?? -1, min = arena >= 0 && c.look ? (DESCENT.lookHold ?? 0) : 0;
      hole = min ? arena : -1; diveAt = null; stillAt = null; readyAt = null; loadedIn = null; briefFrom = null; openedAt = null; phase = 'look';
      if (min) c.look(arena);
      const t0 = c.t(), cap = DESCENT.briefCap ?? 20;
      const open = () => {
        poll = null; if (!phase) return;
        const now = c.t(), b = c.briefing?.() ?? null;   // the brief on the panel (or waiting for it), null when Isao is quiet
        if (phase === 'look') {   // the glide to the rim view on the live game, then the still frame and the cave's load under it
          if (min && now - t0 < (DESCENT.still ?? 0)) { poll = setTimeout(open, 100); return; }
          c.hold(true); phase = 'load'; stillAt = wall();
          frame = document.createElement('iframe'); frame.hidden = true;
          frame.className = 'descent-frame'; frame.title = 'BELOW'; frame.src = DESCENT.page; frame.setAttribute('allow', 'pointer-lock; autoplay; fullscreen');
          root.appendChild(frame);
        }
        if (phase === 'load') {   // the cave ready and the brief read (real seconds: the still game's clock does not move)
          if (b === DESCENT.brief && briefFrom == null) briefFrom = wall();   // the cap runs from the descent's own brief, not a line said before it
          const w = wall() - stillAt;
          if (!descentLoadDone({ ready: readyAt != null, loadWaited: w, readyCap: DESCENT.readyCap ?? 25, briefing: !!b, briefWaited: wall() - (briefFrom ?? stillAt), cap })) { poll = setTimeout(open, 100); return; }
          loadedIn = w; c.hold(false); phase = 'dive';
        }
        // the brief read: down the hole on the live game, then the cave (the dive over lookHold, the hand-over settled under the lip)
        if (hole >= 0 && c.dive && diveAt == null) { diveAt = c.t(); c.dive(hole, DESCENT.lookHold ?? 0); }
        if (diveAt != null && c.t() - diveAt < (DESCENT.lookHold ?? 0) + (DESCENT.door?.settle ?? 0)) { poll = setTimeout(open, 100); return; }
        if (!descentOpenDue({ waited: c.t() - t0, min, briefing: false })) { poll = setTimeout(open, 100); return; }
        openedAt = c.t() - t0; phase = 'shown'; frame.hidden = false; c.hold(true);
        try { frame.contentWindow?.postMessage({ belowShow: true }, '*'); } catch { /* a frame gone mid-show */ }
      };
      poll = setTimeout(open, 0);
      onMsg = (e) => { if (e.data?.belowReady === true) { if (frame && e.source === frame.contentWindow && readyAt == null) readyAt = wall() - stillAt; return; } take(e.data); };
      globalThis.addEventListener?.('message', onMsg);
      return true;
    },
    report: (outcome) => take({ below: outcome }),
    state: () => ({ open: !!frame, shown: !!frame && !frame.hidden, phase, readyAt, loadedIn, openedAt, src: frame?.src ?? null, outcome: c.story()?.descent?.outcome ?? null, said: said.slice(), hole, diveAt, door: hole >= 0 ? c.door?.(hole) ?? null : null }),
    dispose: cleanup,
  };
}
