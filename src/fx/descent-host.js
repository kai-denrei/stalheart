// THE DESCENT'S HOST (owner, 2026-10-15: the cave game as the campaign's last mission; spec docs/superpowers/specs/2026-10-15-descent-mission-design.md;
// DESCENT in src/content/descent.js, the rules src/domain/descent.js). The sector loop calls begin(then) as the final sector is secured, with `then`
// the finale it would have played (src/fx/sector-run.js finish); this says Isao's brief, lets it be read, pauses the game, opens the cave's page (below/, vendored by
// scripts/import-below.mjs) in an iframe over the tab, and waits for the cave to post its outcome ({ below }); then the frame goes, the game runs
// again, Isao's decoding joke is said (as his last transmission on a sacrifice) and `then` plays the ending. A lost descent keeps the frame: the
// cave's own TRY AGAIN. Not due (a phone, DESCENT.mobileSkip): the brief alone, then `then` at once.
//   createDescentHost(root, c) -> { begin(then) -> boolean (true: the handoff taken), report(outcome) (the harness's message), state(), dispose() }
// `c`: pause(v), showBrief(id), speak(id), story() (the run's story object: `descent` is written on it), mobile (a phone), t() (game seconds), look(cell)
// (the camera to the arena's hole, DESCENT.lookHold s before the cave: the nest's mouth is a place on the planet, 2026-10-16), briefing() (Isao's panel
// busy: the cave waits for it, up to DESCENT.briefCap game seconds, 2026-10-18).
import { DESCENT } from '../content/descent.js';
import { descentDue, descentResult, descentNext, descentOpenDue } from '../domain/descent.js';

export function createDescentHost(root, c) {
  let frame = null, onMsg = null, thenFn = null, poll = null;
  const said = [];   // the briefs asked, for the harness
  const say = (id) => { said.push(id); c.showBrief(id); c.speak(id); };
  function cleanup() { if (poll) clearTimeout(poll); poll = null; if (onMsg) globalThis.removeEventListener?.('message', onMsg); onMsg = null; frame?.remove(); frame = null; }
  function take(data) {
    const o = descentResult(data, DESCENT);
    if (!o || !frame) return false;
    const s = c.story(); if (s) s.descent = { outcome: o, at: c.t() };
    if (descentNext(o) === 'retry') return true;   // the cave offers TRY AGAIN; nothing reaches the game until a charge is placed
    const then = thenFn; cleanup(); thenFn = null;
    c.pause(false);
    say(o === 'sacrifice' ? DESCENT.last : DESCENT.back);
    if (then) setTimeout(then, (DESCENT.jokeHold ?? 0) * 1000);   // the joke read, then the ending
    return true;
  }
  return {
    begin(then, { outcome = 'secure', final = true } = {}) {
      if (frame) return true;
      if (!descentDue({ outcome, final, mobile: !!c.mobile }, DESCENT)) { if (final && outcome === 'secure') c.showBrief(DESCENT.brief); then?.(); return false; }
      thenFn = then;
      say(DESCENT.brief);
      const arena = c.story()?.arena?.cell ?? -1, min = arena >= 0 && c.look ? (DESCENT.lookHold ?? 0) : 0;
      if (min) c.look(arena);
      // the frame loads hidden at once; it shows (and the game pauses) when descentOpenDue says so, measured on GAME time (c.t() stands still while
      // paused): the look at the arena's hole, and Isao's brief read to its end, up to DESCENT.briefCap (2026-10-18 review: the brief played behind the cave)
      frame = document.createElement('iframe'); frame.hidden = true;
      frame.className = 'descent-frame'; frame.title = 'BELOW'; frame.src = DESCENT.page; frame.setAttribute('allow', 'pointer-lock; autoplay; fullscreen');
      root.appendChild(frame);
      const t0 = c.t(), cap = DESCENT.briefCap ?? 20;
      const open = () => {
        poll = null; if (!frame) return;
        if (!descentOpenDue({ waited: c.t() - t0, min, briefing: !!c.briefing?.(), cap })) { poll = setTimeout(open, 250); return; }
        frame.hidden = false; c.pause(true);
      };
      poll = setTimeout(open, 0);
      onMsg = (e) => { take(e.data); };
      globalThis.addEventListener?.('message', onMsg);
      return true;
    },
    report: (outcome) => take({ below: outcome }),
    state: () => ({ open: !!frame, shown: !!frame && !frame.hidden, src: frame?.src ?? null, outcome: c.story()?.descent?.outcome ?? null, said: said.slice() }),
    dispose: cleanup,
  };
}
