// THE SHOWCASE RAIL. The owner's four beats (docs/log/entries/2026-09-24-intro-simplified.json) played over the REAL
// systems: no video, no diorama, no second renderer for the world. The stage is the skipped run — the finished base
// past the handover, the gunship's seat earned and a breach open — because that is the one world in which the three
// world beats can actually fire. src/platform/showcase-entry.js decides that a page plays it and rewrites the query to
// the skipped world; this module cuts the camera and pulls the triggers.
//
// The rail never reaches into the controller. It is handed a hooks object (td-tab's own `gameHooks.showcase`), the
// same functions the acceptance adapter exposes, so the montage runs on a normal page with no ?acceptance=1 and the
// browser step can read the same counters the rail drove.
//
// Timing: src/content/showcase.js owns the table. Each beat is CUT on its own clock — a system that has not finished
// is cut anyway. Nothing here waits on a system except the very first frame.
//
// Chrome: the HUD is hidden for the montage (SHOWCASE_CLASS on <body>, rules in styles.css) except the ram readout,
// which IS beat C. Nothing from a seat's own panels is drawn, and SOL-82 never comes online, so its round scope — the
// one piece of seat chrome the body class cannot reach, being drawn in the 3D pass — cannot appear: it is a wireframe
// here and nothing more. Sound is whatever the systems make (SHOWCASE_BED is null; see the content file).
//
// Skippable at any moment: tap, Space or Esc goes straight to the last card.
import { SHOWCASE_SHOTS, SHOWCASE_ELEMENTS, SHOWCASE_FINALE, SHOWCASE_CLASS, SHOWCASE_SECONDS } from '../content/showcase.js';
import { createWireframeStage } from './wireframe-stage.js';
import { showcaseExitUrls, rememberShowcase } from '../platform/showcase-entry.js';

// What each beat actually runs. `enter` fires once on the cut; `frame` runs every frame the beat is up. Everything
// here goes through the hooks — that is the whole point of the rail.
//
// THE SWARM IS FED ON THE RAIL'S OWN BEAT, not in one burst: a queued spawn waits on the spawn clock, which only turns
// over inside the wave loop, and the world holds about seventy bodies at once and queues the rest. So each beat asks
// for a fat batch on the cut and tops it up while it is on screen, which is also what keeps the horde a horde after
// the tank has driven through it.
const BOOK = {
  // A. handled by the element reel below, not by a system: the beat is four labelled wireframes in a row.
  'elements-wireframe': {},
  // B. the ground opens: the tremor, then the bodies climbing out, from a real dive placement over the hole.
  'breach-swarm': { enter: (h) => { h.tremor(); h.ground(h.source(), 4, 5); h.swarm(30); },
    frame: (h, u, beat) => { if (beat && u < 0.35) { h.swarm(4); h.tremor(); } } },
  // C. the hull through the horde, from THE BEAT'S OWN CAMERA — low and 2.6 cells behind the hull, looking at a point
  //    two cells ahead just off the ground, so the MÖRK rides the lower third with its nose into the frame and the
  //    bodies fill the middle (src/domain/showcase-shot.js). The game's chase view frames the hull at ndc y -0.43 from
  //    high behind and looks a cell and a half past it, and the first cut of this beat photographed the splats and the
  //    combo readout with no tank in them at all. The bodies go AHEAD of the hull for the same reason.
  //    A ram is a hull moving INTO a body, so the placement happens once a beat and not once a frame; dropped into a
  //    packed cluster it takes everything within reach. The placement is on the SLOW metronome, not the fast one: the
  //    hull has to be left alone long enough to DRIVE, and a placement every fifth of a second resets its lane every
  //    frame and registers no ram at all (measured: 5.5 s of placements, no ram; 6 s of driving after them, 84).
  //    THE CAMERA IS RE-AIMED AFTER THE HULL IS MOVED, never before: it is snapped onto where the tank IS, and a
  //    placement after the snap leaves it photographing the empty base while the hull rams a horde off screen.
  'tank-ram': { enter: (h) => { h.lane(); h.ram(); h.drop(40); h.ramNext(); h.drop(26, 'ahead'); h.ram(); }, frame: (h, u, beat, slow) => { if (slow) { h.ramNext(); h.drop(16, 'ahead'); h.ram(); } } },   /* the horde is TOPPED UP AHEAD OF THE HULL as it goes: a tank dropped into fifty bodies has eaten them inside three seconds (measured: 84 rams by the beat's midpoint, twelve bodies left), and the rest of the beat is then a shot of an empty field */
  // D. FRAME THE HORDE, NOT THE BASE (the miss of 2026-09-19): the ground track creeps toward a loaded breach over a
  //    whole pass, which a six-second beat does not have, so the track is SNAPPED over the breach the swarm is using
  //    and the bodies are under the belly from the first frame. Rotary, then Bofors. No MK-9: it does not read in six
  //    seconds and a strike on a breach cell seals the hole.
  'gunship-guns': { enter: (h) => { h.ram(false); h.drop(40); h.track(h.source()); h.gunship(); h.gun('rotary'); h.aim(-1.5); h.hold(true); },
    frame: (h, u, beat, slow) => { if (u > 0.55) h.gun('bofors'); h.aim(-1.5); h.hold(true); if (slow) h.drop(8); } },
};

export function createShowcase(root, hooks, { search = location.search, go = (url) => { location.href = url; } } = {}) {
  const el = document.createElement('div');
  el.id = 'showcase';
  el.innerHTML = '<canvas class="sc-wire" hidden></canvas>'
    + '<div class="sc-labels" hidden><svg></svg></div>'
    + '<div class="sc-card" hidden><h1></h1><p></p></div>'
    + '<div class="sc-finale" hidden><h1></h1><p></p><div class="sc-choice"></div></div>'
    + '<button type="button" class="sc-skip">SKIP</button>';
  root.append(el);
  const wireEl = el.querySelector('.sc-wire'), labelEl = el.querySelector('.sc-labels'), labelSvg = labelEl.querySelector('svg'),
    cardEl = el.querySelector('.sc-card'), cardH = cardEl.querySelector('h1'), cardP = cardEl.querySelector('p'),
    finaleEl = el.querySelector('.sc-finale'), choiceEl = el.querySelector('.sc-choice'), skipBtn = el.querySelector('.sc-skip');
  const urls = showcaseExitUrls(search);
  finaleEl.querySelector('h1').textContent = SHOWCASE_FINALE.head;
  finaleEl.querySelector('p').textContent = SHOWCASE_FINALE.sub;
  for (const b of SHOWCASE_FINALE.buttons) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.dataset.choice = b.id; btn.title = b.hint;
    btn.innerHTML = `<b>${b.label}</b><small>${b.hint}</small>`;
    btn.addEventListener('click', () => { rememberShowcase(); go(b.id === 'skip' ? urls.skip : urls.play); });
    choiceEl.append(btn);
  }

  let index = -1, left = 0, beat = 0, slow = 0, wait = 0, peak = {}, started = false, over = false, wire = null, played = [], gone = false;
  let elIdx = -1, elLeft = 0, labels = [], world = false;   // the element reel of beat A: which subject is up, how long it has left, and whether the world has come up yet
  document.body.classList.add(SHOWCASE_CLASS);

  function showCard(card) {
    if (!card) { cardEl.hidden = true; return; }
    cardH.textContent = card.head; cardP.textContent = card.sub ?? '';
    cardP.hidden = !card.sub; cardEl.hidden = false;
  }

  // THE ELEMENT REEL (beat A): one subject at a time on the wireframe stage, each named by the card and labelled on
  // its own structure. The subject's clock is the beat's own length divided by the subjects, so the reel always
  // finishes inside the beat however the table is retuned.
  function element(i) {
    wire?.dispose(); wire = null;
    for (const n of labels) { n.box.remove(); n.line.remove(); }
    labels = [];
    elIdx = i;
    const subject = SHOWCASE_ELEMENTS[i];
    if (!subject) { wireEl.hidden = true; labelEl.hidden = true; return; }
    elLeft = SHOWCASE_SHOTS[index].seconds / SHOWCASE_ELEMENTS.length;
    wire = createWireframeStage(wireEl, subject.url, { fit: true, labels: subject.labels, fov: 34 });
    wireEl.hidden = false; labelEl.hidden = false;
    for (const l of subject.labels) {
      const box = document.createElement('div');
      box.className = 'sc-label'; box.textContent = l.text;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      labelEl.append(box); labelSvg.append(line);
      labels.push({ box, line });
    }
    showCard({ head: subject.head, sub: subject.sub });
  }

  // the labels ride the model: each stands off outward from the frame's centre with a leader line back to its anchor
  function placeLabels() {
    const r = wireEl.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    labelSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const at = wire?.anchors(w, h) ?? [];
    labels.forEach((n, i) => {
      const a = at[i];
      const on = !!a;
      n.box.hidden = !on; n.line.style.display = on ? '' : 'none';
      if (!a) return;
      let dx = a.x - w / 2, dy = a.y - h / 2;
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const lx = Math.max(90, Math.min(w - 90, a.x + dx * 90)), ly = Math.max(20, Math.min(h - 20, a.y + dy * 60));
      n.box.style.left = `${lx}px`; n.box.style.top = `${ly}px`;
      n.line.setAttribute('x1', a.x); n.line.setAttribute('y1', a.y);
      n.line.setAttribute('x2', lx); n.line.setAttribute('y2', ly);
    });
  }

  // THE WORLD IS NOT UP YET WHEN THE MONTAGE OPENS, and it is beat A that covers the wait: the planet bake, the models
  // and the base arrive, the breach is cut and has to FINISH OPENING — releaseSpawns holds every queued body until it
  // has — and the first bodies have to climb out. hooks.ready() is that whole gate, polled at the cut out of the reel.
  // Sixty seconds is the ceiling: a world that will not come up still gets its montage, thin rather than absent.
  function worldUp(dt) {
    if (world) return true;
    wait += dt;
    try { world = !!hooks.ready(); } catch { world = false; }
    return world || wait >= 60;
  }

  function cut(i) {
    wire?.dispose(); wire = null; wireEl.hidden = true; labelEl.hidden = true;
    for (const n of labels) { n.box.remove(); n.line.remove(); }
    labels = []; elIdx = -1;
    index = i;
    if (i >= SHOWCASE_SHOTS.length) return finish();
    const shot = SHOWCASE_SHOTS[i], entry = BOOK[shot.id] ?? {};
    left = shot.seconds;
    showCard(shot.card);
    if (shot.seat === 'wireframe') element(0);
    try { entry.enter?.(hooks); } catch { /* a beat whose system will not run is still cut on its clock */ }
    if (played.length) played[played.length - 1].peak = peak;   // what the beat just cut away from reached while it was up
    peak = {};
    played.push({ id: shot.id, at: +(SHOWCASE_SHOTS.slice(0, i).reduce((n, s) => n + s.seconds, 0)).toFixed(2), counters: hooks.counters(), peak: {} });
  }

  // THE LAST CARD: Isao's own face in the engine, the question over it, and the two ways in.
  function finish() {
    if (over) return;
    over = true;
    wire?.dispose(); wire = null; wireEl.hidden = true; labelEl.hidden = true;
    for (const n of labels) { n.box.remove(); n.line.remove(); }
    labels = [];
    cardEl.hidden = true; skipBtn.hidden = true;
    if (played.length) played[played.length - 1].peak = peak;
    try { hooks.ram(false); hooks.hold(false); hooks.leave(); hooks.isao(); } catch { /* the card stands without him */ }   /* the seat goes FIRST: a seat's pose outranks a shot, so the gunship's optic would have kept the camera and its own telemetry would have been the last thing under the question */
    finaleEl.hidden = false;
    rememberShowcase();   // the montage has been seen, however it ended: a second bare visit goes to the landing
  }

  const skip = () => { if (!over) { index = SHOWCASE_SHOTS.length; finish(); } };
  skipBtn.addEventListener('click', skip);
  const onKey = (e) => { if (over || gone) return; if (e.key === ' ' || e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); skip(); } };
  const onTap = (e) => { if (over || gone || e.target.closest('button')) return; e.stopPropagation(); skip(); };
  addEventListener('keydown', onKey, true);
  el.addEventListener('pointerdown', onTap, true);

  const api = {
    tick(dt) {
      if (gone || over) return;
      if (!started) { started = true; hooks.begin(); cut(0); return; }   /* BEAT A IS THE LOADING SCREEN: the element reel needs no world at all, so it opens on the first frame and the wait for the world happens at the cut out of it (worldUp below) instead of in front of a black page. */
      const entry = BOOK[SHOWCASE_SHOTS[index].id] ?? {};
      if (wire) { wire.render(dt); placeLabels(); elLeft -= dt; if (elLeft <= 0 && elIdx + 1 < SHOWCASE_ELEMENTS.length) element(elIdx + 1); }
      const u = 1 - Math.max(0, left) / SHOWCASE_SHOTS[index].seconds;
      // A COUNTER AT A CUT SAYS TOO LITTLE: a swarm that comes up and is mown down inside one beat leaves the net count
      // where it was. So each beat also keeps the HIGH WATER MARK of every counter while it was on screen, and that is
      // what the --showcase step reads as proof. `labels` is the reel's own proof, and lives beside them.
      { const c = { ...hooks.counters(), labels: labels.filter((n) => !n.box.hidden).length }; for (const k in c) if (typeof c[k] === 'number' && (!(k in peak) || c[k] > peak[k])) peak[k] = c[k]; }
      beat -= dt; const onBeat = beat <= 0; if (onBeat) beat = 0.22;   // the rail's own metronome: what must not run every frame runs on this
      slow -= dt; const onSlow = slow <= 0; if (onSlow) slow = 0.6;   // and the slow one, for what needs the world left alone in between: a hull placed in a horde has to be given time to drive through it, and then to be thrown back into it before it has driven out the other side
      try { entry.frame?.(hooks, u, onBeat, onSlow); } catch { /* the clock rules */ }
      left -= dt;
      if (left <= 0) {
        const next = SHOWCASE_SHOTS[index + 1];
        if (next && next.seat !== 'wireframe' && !worldUp(dt)) { left = 0; return; }   /* the reel holds on its last subject until the world is up */
        cut(index + 1);
      }
    },
    // what the --showcase browser step reads: which beat is up, how far in, and the counters at every cut
    state: () => ({ started, over, index, shots: SHOWCASE_SHOTS.map((s) => ({ id: s.id, seconds: s.seconds, seat: s.seat, proof: s.proof, card: s.card?.head ?? null })), total: SHOWCASE_SECONDS, shot: index >= 0 && index < SHOWCASE_SHOTS.length ? SHOWCASE_SHOTS[index].id : (over ? SHOWCASE_FINALE.id : null),
      left: +Math.max(0, left).toFixed(2), card: cardEl.hidden ? null : cardH.textContent, played,
      element: elIdx >= 0 ? SHOWCASE_ELEMENTS[elIdx].id : null, labels: labels.filter((n) => !n.box.hidden).map((n) => n.box.textContent),
      buttons: [...choiceEl.querySelectorAll('button')].map((b) => ({ id: b.dataset.choice, label: b.querySelector('b').textContent })),
      urls, counters: hooks.counters() }),
    dispose() {
      gone = true;
      removeEventListener('keydown', onKey, true);
      wire?.dispose(); el.remove();
      document.body.classList.remove(SHOWCASE_CLASS);
      if (window.__stalheartShowcase === api) delete window.__stalheartShowcase;
    },
  };
  window.__stalheartShowcase = api;   // the montage plays on a normal page, so its own probe is not behind ?acceptance=1
  return api;
}
