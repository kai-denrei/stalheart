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
// ONE PLACE (owner, 2026-11-05, round 5 note 10: "entering and leaving feel like loading a different game; it should feel like exactly the entrance where the
// boss fight was"; src/domain/descent-handoff.js): the cave asks ({ belowAsk }) before it builds its world and is answered { belowHandoff: c.handoff(hole) }: the
// pose the game's dive ends on in the hole's own units, the game's sky, the arena's carcass (note 7: the same body over its lip); the cave starts its camera there
// and drops its own dive. At the show the game's frame is drawn once more into a canvas over the cave (c.still) and fades out over DESCENT.fade s once the cave
// says its first frame is drawn ({ belowShown }, or after DESCENT.fadeCap real s); { belowShow } carries the sky and the pose as they are then (the game's day ran
// through the dive). Out: the cave's outcome carries its climb's last pose (hole units) and a still of its last frame; the still covers the game, the rise
// starts from that pose (c.rise(hole, pose)) and the still fades out over DESCENT.fade s once the game has drawn.
// `c`: hold(v) (the game paused with nothing drawn, its last frame kept, Isao's panel reading on; false runs it), wall() (optional: real seconds), showBrief(id), speak(id), story() (the run's story object: `descent` is written on it), mobile (a phone), t() (game seconds), look(cell)
// (the camera to the arena's hole's rim while the brief is read: the nest's mouth is a place on the planet, 2026-10-16), dive(cell, s), rise(cell) and
// door(cell) (src/fx/hole-door.js, 2026-10-26; rise(cell, pose) from the cave's last pose, handoff(cell) and still() since 2026-11-05), briefing() (the brief id on
// Isao's panel or waiting for it, null when quiet: the cave waits for it, the descent's own brief up DESCENT.briefCap game seconds at most, 2026-10-18).
import { DESCENT } from '../content/descent.js';
import { descentDue, descentResult, descentNext, descentOpenDue, descentLoadDone } from '../domain/descent.js';
import { outcomePose, apply4 } from '../domain/descent-handoff.js';

// a cover over the page (the descent's cross-fades): a canvas copy of `source` (a canvas drawn this task) or an image; `fades` the harness's log
function cover(root, source, fades, kind) {
  if (!source || typeof document === 'undefined') return null;
  let el = source;
  if (source.getContext) {   // a canvas: copied now, while its frame is still in its buffer
    el = document.createElement('canvas'); el.width = source.width; el.height = source.height;
    try { el.getContext('2d').drawImage(source, 0, 0); } catch { return null; }
  }
  try { el.className = 'descent-fade'; el.style.transitionDuration = `${DESCENT.fade ?? 0.6}s`; root.appendChild(el); } catch { return null; }   // never in the way of the cut itself
  const rec = { kind, at: globalThis.performance.now(), fading: null, gone: null };
  fades.push(rec);
  return { el, rec, away() { if (rec.fading != null) return; rec.fading = globalThis.performance.now(); el.style.opacity = '0'; setTimeout(() => { el.remove(); rec.gone = globalThis.performance.now(); }, (DESCENT.fade ?? 0.6) * 1000 + 50); } };
}

export function createDescentHost(root, c) {
  let frame = null, onMsg = null, thenFn = null, poll = null, briefFrom = null, openedAt = null, hole = -1, diveAt = null, phase = null, stillAt = null, readyAt = null, loadedIn = null;
  let sent = null, coverIn = null, risenFrom = null;   // ONE PLACE: the handoff answered, the game's last frame over the cave, the cave's pose the rise started from
  const fades = [];   // the cross-fades, for the harness: { kind: 'in' | 'out', at, fading, gone } (performance.now ms)
  const wall = () => c.wall?.() ?? globalThis.performance.now() / 1000;   // real seconds: the game's clock stands still while it is held
  const said = [];   // the briefs asked, for the harness
  const say = (id) => { said.push(id); c.showBrief(id); c.speak(id); };
  function cleanup() { if (poll) clearTimeout(poll); poll = null; if (onMsg) globalThis.removeEventListener?.('message', onMsg); onMsg = null; frame?.remove(); frame = null; phase = null; }
  function take(data) {
    const o = descentResult(data, DESCENT);
    if (!o || !frame || phase === 'out') return false;
    const s = c.story(); if (s) s.descent = { outcome: o, at: c.t() };
    if (descentNext(o) === 'retry') return true;   // the cave offers TRY AGAIN; nothing reaches the game until a charge is placed
    const then = thenFn, pose = outcomePose(data); thenFn = null;
    const out = () => {
      const still = typeof data?.still === 'string' ? data.still : null, img = still && typeof Image !== 'undefined' ? Object.assign(new Image(), { src: still }) : null;
      const go = () => {
        const cv = img ? cover(root, img, fades, 'out') : null;   // the cave's last frame over the game while it starts to rise from the same place
        cleanup(); coverIn?.el.remove(); coverIn = null;
        c.hold(false); risenFrom = pose;
        if (hole >= 0) c.rise?.(hole, pose);   // out of the cave the way it went in: up the same hole's axis to its rim (note 7), from the cave's last pose (note 10)
        if (cv) globalThis.requestAnimationFrame?.(() => globalThis.requestAnimationFrame?.(() => cv.away()));   // once the game has drawn its first frame of the rise
        say(o === 'sacrifice' ? DESCENT.last : DESCENT.back);
        if (then) setTimeout(then, (DESCENT.jokeHold ?? 0) * 1000);   // the joke read, then the ending
      };
      if (img?.decode) img.decode().then(go, go); else go();
    };
    phase = 'out'; out();
    return true;
  }
  // the cave asks before it builds its world: the dive's last pose, the sky, the carcass (src/fx/hole-door.js handoff); null without the arena's hole
  function answer() {
    sent = hole >= 0 ? c.handoff?.(hole) ?? null : null;
    try { frame?.contentWindow?.postMessage({ belowHandoff: sent }, '*'); } catch { /* a frame gone mid-load */ }
  }
  return {
    begin(then, { outcome = 'secure', final = true } = {}) {
      if (phase) return true;
      if (!descentDue({ outcome, final, mobile: !!c.mobile }, DESCENT)) { if (final && outcome === 'secure') c.showBrief(DESCENT.brief); then?.(); return false; }
      thenFn = then;
      // A PRINT IS SEEN TO ITS END (round 7, owner, 2026-11-05, note 8: "before BELOW, Isao prints something but we have no time to see it"): while
      // one runs (c.printing) the brief, the look and the cave wait, DESCENT.printCap game seconds at most
      const go = () => {
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
          openedAt = c.t() - t0; phase = 'shown';
          coverIn = cover(root, c.still?.() ?? null, fades, 'in');   // the game's last frame, drawn now, over the cave until its first frame is drawn
          frame.hidden = false; c.hold(true);
          const h = hole >= 0 ? c.handoff?.(hole) ?? null : null;   // the sky as it is now (the day ran through the dive), the same pose
          try { frame.contentWindow?.postMessage({ belowShow: true, ...(h ? { sky: h.sky, pose: h.pose } : {}) }, '*'); } catch { /* a frame gone mid-show */ }
          const lid = coverIn; if (lid) setTimeout(() => lid.away(), (DESCENT.fadeCap ?? 3) * 1000);   // the cave never said it drew: the cover goes anyway
        };
        poll = setTimeout(open, 0);
        onMsg = (e) => {
          const d = e.data, ours = !!frame && e.source === frame.contentWindow;
          if (d?.belowReady === true) { if (ours && readyAt == null) readyAt = wall() - stillAt; return; }
          if (d?.belowAsk === true) { if (ours) answer(); return; }
          if (d?.belowShown === true) { if (ours) coverIn?.away(); return; }
          take(d);
        };
        globalThis.addEventListener?.('message', onMsg);
      };
      if (c.printing?.()) { phase = 'print'; const p0 = c.t(), wait = () => { poll = null; if (phase !== 'print') return; if (c.printing() && c.t() - p0 < (DESCENT.printCap ?? 45)) { poll = setTimeout(wait, 100); return; } go(); }; poll = setTimeout(wait, 100); return true; }
      go();
      return true;
    },
    report: (outcome) => take({ below: outcome }),
    state: () => ({ open: !!frame, shown: !!frame && !frame.hidden, phase, readyAt, loadedIn, openedAt, src: frame?.src ?? null, outcome: c.story()?.descent?.outcome ?? null, said: said.slice(), hole, diveAt, door: hole >= 0 ? c.door?.(hole) ?? null : null,
      // ONE PLACE: the handoff answered (its pose, sky and whether it carried the carcass), the cross-fades, the cave's pose the rise started from
      handoff: sent ? { pose: sent.pose, sky: sent.sky, carcass: sent.carcass ? { limbs: sent.carcass.chain.limbs.length, moved: sent.carcass.moved.length, toHole: sent.carcass.toHole, core: apply4(sent.carcass.toHole, sent.carcass.chain.core) } : null, radius: sent.radius } : null,
      fades: fades.map((x) => ({ ...x })), risenFrom }),
    dispose() { cleanup(); for (const el of root.querySelectorAll?.('.descent-fade') ?? []) el.remove(); coverIn = null; },
  };
}
