// THE HUD FADES UNLESS HOVERED, the page's half (owner, 2026-11-05, round 7 note 2; the rule src/domain/hud-dim.js, the numbers
// src/content/hud-dim.js, the look app.css `#tab-td.hud-dim [data-hud]`). On a desktop the game tab takes `hud-dim` and every piece named by
// HUD_DIM_TARGETS takes `data-hud` (the pieces made later, the views strip, the order line, the day dial, are tagged as they arrive); the
// stylesheet rests them at 0.2 and lifts a piece carrying `hud-lit` to 0.8. The hover is a box test on the pointer's position, at most every
// `every` s: several dimmed pieces take no pointer events, and a pointerenter would never reach them. A piece the pointer leaves keeps
// `hud-lit` for `hold` s (a timer per piece, cleared on re-entry). Opacity only: no pointer events, no layout. On the phone shell, or with
// ?huddim=0 (screenshots that want the HUD at full), nothing is tagged and the page is as it was.
//   createHudDim(root, { mobile, off, tune, now }) -> { scan(x, y), state(), dispose() }
//      state(): { on, tagged, lit: [selector of each lit piece], opacity: { [target]: computed opacity } } for the harness
import { HUD_DIM } from '../content/hud-dim.js';
import { HUD_DIM_TARGETS, hudLit, insideBox } from '../domain/hud-dim.js';

const urlOff = () => { try { return new URLSearchParams(location.search).get('huddim') === '0'; } catch { return false; } };

export function createHudDim(root, { mobile = false, off = urlOff(), tune = HUD_DIM, now = () => performance.now() / 1000 } = {}) {
  const on = !mobile && !off && !!root;
  const sel = HUD_DIM_TARGETS.join(', ');
  const pieces = new Map();   // element -> { hovered, leftAt, timer }
  const tag = () => {
    for (const el of root.querySelectorAll(sel)) if (!pieces.has(el)) { el.setAttribute('data-hud', ''); pieces.set(el, { hovered: false, leftAt: null, timer: 0 }); }
  };
  const light = (el, p, lit) => { if (el.classList.contains('hud-lit') !== lit) el.classList.toggle('hud-lit', lit); p.timer = 0; };
  function scan(x, y) {
    const t = now();
    for (const [el, p] of pieces) {
      if (!el.isConnected) { clearTimeout(p.timer); pieces.delete(el); continue; }
      const over = x != null && insideBox(el.getBoundingClientRect(), x, y);
      if (over === p.hovered) continue;
      p.hovered = over;
      clearTimeout(p.timer);
      if (over) { p.leftAt = null; light(el, p, true); continue; }
      p.leftAt = t;
      p.timer = setTimeout(() => { if (!hudLit({ ...p, now: now(), hold: tune.hold })) light(el, p, false); }, tune.hold * 1000 + 20);
    }
  }
  if (!on) return { scan() {}, state: () => ({ on: false, tagged: 0, lit: [], opacity: {} }), dispose() {} };
  root.classList.add('hud-dim');
  tag();
  const watch = new MutationObserver(tag); watch.observe(root, { childList: true });
  let px = null, py = null, last = -Infinity, pending = 0;
  const run = () => { pending = 0; last = now(); scan(px, py); };
  const onMove = (e) => {
    px = e.clientX; py = e.clientY;
    if (pending) return;
    const wait = tune.every - (now() - last);
    if (wait <= 0) run(); else pending = setTimeout(run, wait * 1000);
  };
  const onOut = (e) => { if (!e.relatedTarget) { px = py = null; scan(null, null); } };   // the pointer left the window
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  return {
    scan,
    state: () => ({
      on, tagged: pieces.size,
      lit: [...pieces.keys()].filter((el) => el.classList.contains('hud-lit')).map((el) => el.id || el.className),
      opacity: Object.fromEntries(HUD_DIM_TARGETS.map((s) => { const el = root.querySelector(s); return [s, el ? +getComputedStyle(el).opacity : null]; })),
    }),
    dispose() {
      watch.disconnect(); clearTimeout(pending);
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerout', onOut);
      for (const [el, p] of pieces) { clearTimeout(p.timer); el.removeAttribute('data-hud'); el.classList.remove('hud-lit'); }
      pieces.clear(); root.classList.remove('hud-dim');
    },
  };
}
