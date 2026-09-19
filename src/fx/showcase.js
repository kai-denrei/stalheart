// THE SHOWCASE RAIL. The owner's montage (docs/log/entries/2026-09-18-intro-montage-spec.json) played over the REAL
// systems: no video, no diorama, no second renderer for the world. The stage is the skipped run — the finished base
// past the handover, the seats earned, SOL-82 online and a breach open — because that is the one world in which every
// shot on the list can actually fire. src/platform/showcase-entry.js decides that a page plays it and rewrites the
// query to the skipped world; this module cuts the camera and pulls the triggers.
//
// The rail never reaches into the controller. It is handed a hooks object (td-tab's own `gameHooks.showcase`), the
// same functions the acceptance adapter exposes, so the montage runs on a normal page with no ?acceptance=1 and the
// browser step can read the same counters the rail drove.
//
// Timing: src/content/showcase.js owns the table. Each shot is CUT on its own clock — a system that has not finished
// is cut anyway, which is what makes it a montage. Nothing here waits on a system except the very first frame.
//
// Chrome: the whole HUD is hidden for the montage (SHOWCASE_CLASS on <body>, rule in styles.css); the cards are the
// only thing over the world. Sound is whatever the systems make (SHOWCASE_BED is null; see the content file).
//
// Skippable at any moment: tap, Space or Esc goes straight to the last card.
import { SHOWCASE_SHOTS, SHOWCASE_FINALE, SHOWCASE_CLASS, SHOWCASE_SECONDS } from '../content/showcase.js';
import { createWireframeStage } from './wireframe-stage.js';
import { showcaseExitUrls, rememberShowcase } from '../platform/showcase-entry.js';
import { MORK_PROXY } from '../mork.js';

const SOL82_MODEL = 'assets/models/sol82/sol82_platform_detailed.glb';
const STAGES = {
  mork: { url: MORK_PROXY, radius: 22, height: 8, look: 1.6, grid: 60, fov: 34 },
  sol82: { url: SOL82_MODEL, radius: 58, height: 20, look: 4, grid: 140, fov: 32 },
};

// What each shot actually runs. `enter` fires once on the cut; `frame` runs every frame the shot is up.
// Everything here goes through the hooks — that is the whole point of the rail.
const BOOK = {
  'tank-wireframe': { wire: 'mork', enter: (h) => { h.orbit(h.source(), 1.9); } },
  // the tank rams what is already up: the seed swarm went in during the pre-roll, so bodies are on the ground by now.
  // One ram a beat, not one a frame — a ram is a hull moving INTO a body, and re-placing it every frame registers none.
  // The batches through the montage are deliberately small: the world holds about seventy bodies at once and drops the
  // rest, so a fat seed here would starve the tremor shot of the emergence that IS the tremor shot.
  'tank-ram': { enter: (h) => { h.swarm(8); h.follow(); }, frame: (h, u, beat) => { if (beat) h.ramNext(); } },
  // the emergence is fed on the beat, not in one burst: a single batch lands whenever the spawn clock next turns over,
  // which is not reliably inside a three-second shot, and this shot IS the emergence.
  'tremor-swarm': { enter: (h) => { h.swarm(14); h.tremor(); h.ground(h.source(), 10, 9); }, frame: (h, u, beat) => { if (beat) { h.swarm(7); h.tremor(); } } },
  'gunship-guns': { enter: (h) => { h.swarm(30); h.gunship(); h.gun('rotary'); h.hold(true); },
    frame: (h, u) => { if (u > 0.55) h.gun('bofors'); h.aim(); } },
  'gunship-nuke': { enter: (h) => { h.hold(false); h.gun('heavy'); h.nuke(); } },
  'nuke-ground': { enter: (h) => { h.leave(); h.ground(h.source(), 7, 8); } },
  // the Quiver's mount was built at the first frame (hooks.prep) so its model is loaded and the seat opens on a
  // standing launcher; the round goes out on the beat because a guided mount's own lock is longer than this shot.
  'quiver-pov': { enter: (h) => { h.seat('quiver'); h.aim(); }, frame: (h, u, beat) => { h.aim(); h.hold(true); if (beat) h.launch(); } },
  'rotor-pov': { enter: (h) => { h.seat('rotor'); h.aim(); }, frame: (h) => { h.aim(); h.hold(true); } },
  'too-many': { enter: (h) => { h.hold(false); h.leave(); h.swarm(60); h.ground(h.source(), 9, 6); }, frame: (h, u, beat) => { if (beat) h.swarm(14); } },
  'laser-wireframe': { wire: 'sol82', enter: (h) => { h.laser(true); } },
  // SOL-82 FROM ORBIT: the beam only burns from its seat (src/fx/laser-arsenal.js: `held = seated && ...`), so the
  // seat stays taken and the camera is taken off it instead (hooks.laserCam), which frees a real high placement.
  'laser-orbit': { enter: (h) => { h.laserCam(false); h.orbit(h.source(), 2.7); h.laserHold(true); }, frame: (h) => h.laserHold(true) },
  // ...and the same burn from the ground is the seat's own frame, 120 m back and 60 m up from the contact.
  'laser-ground': { enter: (h) => { h.laserCam(true); h.laserHold(true); }, frame: (h) => h.laserHold(true) },
};

export function createShowcase(root, hooks, { search = location.search, go = (url) => { location.href = url; } } = {}) {
  const el = document.createElement('div');
  el.id = 'showcase';
  el.innerHTML = '<canvas class="sc-wire" hidden></canvas>'
    + '<div class="sc-card" hidden><h1></h1><p></p></div>'
    + '<div class="sc-finale" hidden><h1></h1><p></p><div class="sc-choice"></div></div>'
    + '<button type="button" class="sc-skip">SKIP</button>';
  root.append(el);
  const wireEl = el.querySelector('.sc-wire'), cardEl = el.querySelector('.sc-card'), cardH = cardEl.querySelector('h1'),
    cardP = cardEl.querySelector('p'), finaleEl = el.querySelector('.sc-finale'), choiceEl = el.querySelector('.sc-choice'),
    skipBtn = el.querySelector('.sc-skip');
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

  let index = -1, left = 0, beat = 0, wait = 0, peak = {}, started = false, over = false, wire = null, played = [], gone = false;
  document.body.classList.add(SHOWCASE_CLASS);

  function showCard(card) {
    if (!card) { cardEl.hidden = true; return; }
    cardH.textContent = card.head; cardP.textContent = card.sub ?? '';
    cardP.hidden = !card.sub; cardEl.classList.toggle('shout', !!card.shout); cardEl.hidden = false;
  }

  function cut(i) {
    wire?.dispose(); wire = null; wireEl.hidden = true;
    index = i;
    if (i >= SHOWCASE_SHOTS.length) return finish();
    const shot = SHOWCASE_SHOTS[i], entry = BOOK[shot.id] ?? {};
    left = shot.seconds;
    showCard(shot.card);
    if (entry.wire) { const s = STAGES[entry.wire]; wire = createWireframeStage(wireEl, s.url, s); wireEl.hidden = false; }
    try { entry.enter?.(hooks); } catch { /* a shot whose system will not run is still cut on its clock */ }
    if (played.length) played[played.length - 1].peak = peak;   // what the shot just cut away from reached while it was up
    peak = {};
    played.push({ id: shot.id, at: +(SHOWCASE_SHOTS.slice(0, i).reduce((n, s) => n + s.seconds, 0)).toFixed(2), counters: hooks.counters(), peak: {} });
  }

  // THE LAST CARD: Isao's own face in the engine, the question over it, and the two ways in.
  function finish() {
    if (over) return;
    over = true;
    wire?.dispose(); wire = null; wireEl.hidden = true;
    cardEl.hidden = true; skipBtn.hidden = true;
    if (played.length) played[played.length - 1].peak = peak;
    try { hooks.hold(false); hooks.laserHold(false); hooks.laserCam(true); hooks.laserLeave(); hooks.leave(); hooks.isao(); } catch { /* the card stands without him */ }   /* the seats go FIRST: a seat's pose outranks a shot, so SOL-82's scope would have kept the camera and its own telemetry would have been the last thing under the question */
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
      if (!started) { wait += dt; if (!hooks.ready() && wait < 25) return; started = true; hooks.begin(); cut(0); return; }   /* THE PRE-ROLL DOUBLES AS THE LOADING SCREEN: hooks.ready() holds the first frame while the planet bake, the models and the base arrive, opens the breach and seeds the swarm, and only lets go once bodies are actually standing on the ground. Twenty-five seconds is the ceiling: a world that will not come up still gets its montage, thin rather than absent. */
      const entry = BOOK[SHOWCASE_SHOTS[index].id] ?? {};
      if (wire) wire.render(dt);
      const u = 1 - Math.max(0, left) / SHOWCASE_SHOTS[index].seconds;
      // A COUNTER AT A CUT SAYS TOO LITTLE: a swarm that comes up and is mown down inside one shot leaves the net count
      // where it was, and a round that is launched and lands is gone by the next cut. So each shot also keeps the HIGH
      // WATER MARK of every counter while it was on screen, and that is what the --showcase step reads as proof.
      { const c = hooks.counters(); for (const k in c) if (typeof c[k] === 'number' && (!(k in peak) || c[k] > peak[k])) peak[k] = c[k]; }
      beat -= dt; const onBeat = beat <= 0; if (onBeat) beat = 0.22;   // the rail's own metronome: what must not run every frame runs on this
      try { entry.frame?.(hooks, u, onBeat); } catch { /* the clock rules */ }
      left -= dt;
      if (left <= 0) cut(index + 1);
    },
    // what the --showcase browser step reads: which shot is up, how far in, and the counters at every cut
    state: () => ({ started, over, index, shots: SHOWCASE_SHOTS.map((s) => ({ id: s.id, seconds: s.seconds, seat: s.seat, proof: s.proof, card: s.card?.head ?? null })), total: SHOWCASE_SECONDS, shot: index >= 0 && index < SHOWCASE_SHOTS.length ? SHOWCASE_SHOTS[index].id : (over ? SHOWCASE_FINALE.id : null),
      left: +Math.max(0, left).toFixed(2), card: cardEl.hidden ? null : cardH.textContent, played,
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
