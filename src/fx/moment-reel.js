// THE BEST MOMENTS, FILMED (owner, 2026-10-06: "small recordings of the highest RAM bonus in black and white, or the best Tactical
// Nuke, something visual"). The game's frame is grabbed small a few times a second into a short ring; when a moment worth keeping
// happens (the run's best ram combo climbs, a tactical nuke lands) the ring's seconds before it and `post` seconds after become a clip,
// kept if it beats the best of its kind so far. The campaign card's THE BEST MOMENTS plays them back as grey flipbooks (the grey is
// the card's CSS: a canvas filter is not on every Safari).
//
// The grab: renderer.render is wrapped, and on a frame that wants one the canvas is copied right after a pass draws to the screen
// (render target null), while its drawing buffer still holds the frame. Nothing is grabbed between grabs, so the cost is one small
// drawImage `fps` times a second.
//
// watch(t, { combo, nukes, strikeKills, sector }) once a tick: combo is the run's best ram combo, nukes the count of tactical nukes so
// far, strikeKills the strike kills so far. clips() lists the kept clips, best kind first: { kind, score, label, frames, fps }.
export function createMomentReel(renderer, { w = 256, h = 144, fps = 8, pre = 2.2, post = 1.6 } = {}) {
  const src = renderer.domElement, size = Math.round((pre + post) * fps), ring = [], kept = new Map(), pending = new Map();
  let lastGrab = -Infinity, want = false, seen = null, clock = 0;
  const blank = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function grab() {
    const c = ring.length >= size ? ring.shift() : blank(), x = c.getContext('2d');
    const sw = src.width, sh = src.height, k = Math.max(w / sw, h / sh), cw = w / k, ch = h / k;   // cover: the middle of the frame
    try { x.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h); ring.push(c); } catch { /* a lost context: no frame */ }
  }
  const render = renderer.render.bind(renderer);
  renderer.render = (scene, camera) => { render(scene, camera); if (want && renderer.getRenderTarget() === null) { want = false; grab(); } };
  const copy = () => ring.map((c) => { const d = blank(); d.getContext('2d').drawImage(c, 0, 0); return d; });
  function mark(kind, score, label) {
    if (score <= (kept.get(kind)?.score ?? 0)) return;
    const p = pending.get(kind);
    if (!p || score >= p.score) pending.set(kind, { score, label, until: clock + post });   // a climbing combo keeps pushing its end out
  }
  return {
    watch(t, { combo = 0, nukes = 0, strikeKills = 0, sector = 0 } = {}) {
      clock = t;
      if (t - lastGrab >= 1 / fps) { lastGrab = t; want = true; }
      if (seen) {
        const s = String(sector).padStart(2, '0');
        if (combo > seen.combo) mark('ram', combo, `RAM COMBO ×${combo} · SECTOR ${s}`);
        if (nukes > seen.nukes) seen.nuke = { at: t, from: seen.strikeKills, sector: s };   // from: the strike kills before the tick it landed in
        // the nuke's kills are the strike kills in the moment after it lands
        if (seen.nuke && t - seen.nuke.at >= 0.6) { const n = strikeKills - seen.nuke.from; if (n > 0) mark('nuke', n, `TACTICAL NUKE · ${n} KILLS · SECTOR ${seen.nuke.sector}`); seen.nuke = null; }
      }
      seen = { combo, nukes, strikeKills, nuke: seen?.nuke ?? null };
      for (const [kind, p] of pending) if (t >= p.until) { pending.delete(kind); if (ring.length) kept.set(kind, { kind, score: p.score, label: p.label, frames: copy(), fps }); }
    },
    clips: () => ['ram', 'nuke'].map((k) => kept.get(k)).filter(Boolean),
    dispose() { renderer.render = render; ring.length = 0; kept.clear(); pending.clear(); },
  };
}
