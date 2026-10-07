// THE START GATE, NOW THE WELCOME (owner, 2026-10-05: "use this settlement Guide as the first landing page welcoming screen. Hovering
// on keywords such as SH02 or ISAO or STALHEART bring up little modals showing their animated wireframe units, the Start a new Planet
// is bigger, a call to action"). The A6 pocket guide (jelaludo.github.io/SentryTowers_A6/settlement-guide/, its wireframe drawings in
// assets/welcome/) over the page while the landing loads; START A NEW PLANET opens it.
// It is still the start gate (owner, 2026-10-04: the landing's sound was dropped before the first gesture): a browser starts no sound
// before the player's first click, tap or key, and the CTA is that gesture. Isao says WELCOME! and "Let's settle a new planet
// together!" as soon as the sound can start (at once, or on the first click or key that is not the CTA), and "Ad Astra Per Aspera"
// on START; the landing waits for that line (`opened` turns true as it ends), and the voice is freed for the mission line after it.
import { isaoSay, isaoFree } from './isao-voice.js';
import { createWireframeStage } from './wireframe-stage.js';

// the keywords' wireframes: the unit, its model, one line
const UNITS = {
  sh02: { name: 'SH02', url: 'assets/models/story/sh_rocket.glb', line: 'Your ride down. Also your first spare parts.', sound: 'rocket_thrust' },
  isao: { name: 'ISAO', url: 'assets/models/isao/isao_birudoron_lod1.glb', line: 'An enthusiastic little builder drone.' },
  stalheart: { name: 'STÅLHEART', url: 'assets/models/astro/terraformer_3000_d0_lod1.glb', line: 'The terraformer. Home is where the giant robot is.', sound: 'tower_upgrade' },
  mork: { name: 'MÖRK', url: 'assets/models/hover-tank/mork_hover_tank_d0_lod2.glb', line: 'The hover tank. Rams first, asks later.', sound: 'tank_main' },
  korp: { name: 'KORP', url: 'assets/models/korp/korp_d0_lod1.glb', line: 'The heavy gunship, on orbital station.', sound: 'gunship_bofors_fire' },
  sol: { name: 'SOL-88', url: 'assets/models/sol88/sol88_platform_game.glb', line: 'The orbital platform. Star power, aimed.', sound: 'laser_burn' },
  arc01: { name: 'ARC-01', url: 'assets/models/astro/arc01_launcher_d0_lod1.glb', line: 'The satellite launcher.', sound: 'seeker_fire' },
};
const key = (id, text = UNITS[id].name) => `<button type="button" class="wg-key" data-unit="${id}">${text}</button>`;
const STEPS = [
  { n: '01', phase: 'ARRIVAL', art: ['sh02'], note: 'THIS SIDE UP ↑', h: 'Land.', p: `Pick a nice spot. Set down your ${key('sh02')}. Unpack ${key('isao')}, your enthusiastic little builder.`, aside: 'Congratulations. You live here now.', stamp: 'Stamp on arrival', done: 'TOUCHDOWN!' },
  { n: '02', phase: 'HOME IMPROVEMENT', art: ['stalheart'], note: 'SOME ASSEMBLY REQUIRED', h: 'Build.', p: `Spare ship parts → first factory. Add power. Let ${key('isao')} raise ${key('stalheart', 'Stålheart')}. Think bigger.`, aside: 'Home is where the giant robot is.', stamp: 'Stamp when cosy', done: 'HOME, SWEET HOME!' },
  { n: '03', phase: 'NEIGHBOURHOOD WATCH', art: ['korp', 'mork'], cls: 'patrol', note: 'FRIENDLY? WAVE FIRST.', h: 'Meet the locals.', p: `Alien threats? Call ${key('mork')}, the ${key('korp', 'KORP Gunship')} and a few sentries. No threats? Lovely.`, aside: 'A quiet neighbourhood is a good one.', stamp: 'Stamp if all clear', done: 'ALL CLEAR!' },
  { n: '04', phase: 'THE BIG CONNECTION', art: ['sol88', 'launcher'], cls: 'orbital', note: 'NEXT STOP: STAR POWER', h: 'Plug into a star.', p: `Build ${key('arc01')}. Launch satellites, put ${key('sol', 'SOL')} on orbital watch, and work toward your Dyson-sphere connection.`, aside: 'Collect at the star. Send power home.', stamp: 'Stamp your ambition', done: 'FUTURE LOOKING BRIGHT!' },
];
const HTML = `<div class="wg"><div class="edition"><span>✳ A6 INTERSTELLAR RELOCATION BUREAU</span><span>POCKET GUIDE 001 / NO EXPERIENCE NECESSARY</span></div>
<section class="headline"><div><p class="eyebrow">A SMALL GUIDE TO A VERY BIG MOVE</p><h1>Your new planet.<br><em>In 4 easy steps.</em></h1><p class="intro">A little ambition. A few useful robots. An entire world of possibilities.</p></div>
<div class="seal"><span>SETTLEMENT</span><strong>MADE<br>SIMPLE</strong><span>★ YOU'VE GOT THIS ★</span></div></section>
<ol class="steps">${STEPS.map((s) => `<li class="step"><div class="step-top"><span class="number">${s.n}</span><span class="phase">${s.phase}</span><span class="arrow">${s.n === '04' ? '✳' : '↗'}</span></div>
<div class="drawing ${s.art.length > 1 ? `duo ${s.cls}` : 'single'}">${s.art.map((a, i) => `<img class="${s.art.length > 1 ? (i ? 'lower' : 'upper') : ''}" src="assets/welcome/${a}.svg" alt="">`).join('')}<span class="annotation">${s.note}</span></div>
<h2>${s.h}</h2><p>${s.p}</p><p class="aside">${s.aside}</p><button class="stamp" type="button" aria-pressed="false" data-done="${s.done}">${s.stamp} <span>＋</span></button></li>`).join('')}</ol>
<footer class="guide-footer"><div class="towel-note"><svg viewBox="0 0 60 62" aria-hidden="true"><path d="M14 8 46 4 52 48 20 54Z M18 14 47 10 M19 18 48 14 M23 43 50 39 M24 47 51 43 M20 54l1 5m5-6 1 5m5-6 1 5m5-6 1 5m5-6 1 5"/></svg><div><strong>Don't forget your towel!</strong><span>THE MOST IMPORTANT PIECE OF EQUIPMENT. OBVIOUSLY.</span></div></div>
<div class="completion"><span class="progress" role="status">0 / 4 STAMPS · YOUR ADVENTURE AWAITS</span></div></footer>
<div class="cta-row"><button type="button" class="wg-cta" data-start>START A NEW PLANET <span>→</span></button></div>
<div class="fineprint">A6 FIELD NOTES / Models by jelaludo · Dyson link: future story concept; collectors orbit the star.</div></div>
<div class="wg-pop" hidden><canvas></canvas><b></b><span></span></div>`;

// root: the DOM parent; sfx: the sound engine (for Isao); onOpen(): the player started. Returns { opened, dispose }
export function createStartGate(root, { onOpen = null, sfx = null } = {}) {
  if (!root || typeof document === 'undefined') return { opened: true, dispose() {} };
  const el = document.createElement('div'); el.id = 'start-gate'; el.innerHTML = HTML;
  root.append(el);
  const gate = { opened: false, starting: false, dispose }, cta = el.querySelector('[data-start]'), pop = el.querySelector('.wg-pop');
  let welcomed = false, stage = null, raf = 0, last = 0, popFor = null, hideT = 0;

  // ISAO'S WELCOME: now if the sound already runs, else on the first gesture that is not START (that one gets Ad Astra)
  const welcome = () => { if (welcomed || gate.starting) return; welcomed = true; isaoSay(sfx, 'welcome', { force: true }); isaoSay(sfx, 'welcome_settle', { text: "Let's settle a new planet together!" }); };
  const firstGesture = (e) => { if (e.target?.closest?.('[data-start]')) return; removeEventListener('pointerup', firstGesture); removeEventListener('keyup', firstGesture); setTimeout(welcome, 120); };
  if (sfx?.ready) welcome(); else { addEventListener('pointerup', firstGesture); addEventListener('keyup', firstGesture); }

  // THE STAMPS (the guide's own toy)
  const stamps = [...el.querySelectorAll('.stamp')], labels = stamps.map((b) => b.innerHTML), progress = el.querySelector('.progress');
  stamps.forEach((b, i) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on));
    if (on) b.textContent = `✓ ${b.dataset.done}`; else b.innerHTML = labels[i];
    const n = stamps.filter((s) => s.getAttribute('aria-pressed') === 'true').length;
    progress.textContent = n === 4 ? '4 / 4 STAMPS · WELCOME HOME, HITCHHIKER!' : `${n} / 4 STAMPS · YOUR ADVENTURE AWAITS`;
  }));

  // THE KEYWORDS' WIREFRAMES: one small stage at a time, turning while it shows, disposed when it hides (one WebGL context)
  function tick(t) { const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t; stage?.render(dt); raf = requestAnimationFrame(tick); }
  function show(btn) {
    clearTimeout(hideT);
    const id = btn.dataset.unit, u = UNITS[id]; if (!u) return;
    if (popFor !== id) {
      stage?.dispose(); stage = createWireframeStage(pop.querySelector('canvas'), u.url, { fit: true, spin: 0.6 }); popFor = id;
      pop.querySelector('b').textContent = u.name; pop.querySelector('span').textContent = u.line;
    }
    pop.hidden = false;
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const x = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)), y = r.top - h - 10 >= 8 ? r.top - h - 10 : r.bottom + 10;
    pop.style.left = `${x}px`; pop.style.top = `${y}px`;
    if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
  }
  function hide(now = false) {
    clearTimeout(hideT);
    hideT = setTimeout(() => { pop.hidden = true; cancelAnimationFrame(raf); raf = 0; stage?.dispose(); stage = null; popFor = null; }, now ? 0 : 160);
  }
  // THE KEYWORDS SOUND (owner, 2026-10-06: "hovering ISAO, SH02, MÖRK etc. also plays some of their sounds"): a unit's own sound,
  // cut short as the card goes; ISAO is Isao himself, a Hitchhiker's line per step (01 DON'T PANIC, 02 the good frood). Nothing until
  // a gesture has started the sound, and a line is not said again while it still plays
  let voiceTill = 0, sound = null;
  const SAYS = { '01': 'welcome_panic', '02': 'idle_flavor' };   // 02 cycles through his flavour lines (owner, 2026-10-07: 'keep the first Isao to DON'T PANIC; the Isao voices for 02 cycle between all the filler lines'); a trigger never repeats its last line
  let korpTurn = 0;   // KORP: its gun one hover, a nuke-launch line the next (owner, 2026-10-07: 'cycle sound effects to the Nuclear Launch voices too')
  function hear(btn) {
    if (!sfx?.ready || gate.starting) return;
    const id = btn.dataset.unit, say = id === 'isao' && SAYS[btn.closest('.step')?.querySelector('.number')?.textContent];
    if (say) { if (performance.now() < voiceTill) return; const line = isaoSay(sfx, say, { force: true }); if (line) voiceTill = performance.now() + line.duration * 1000; return; }
    if (id === 'korp' && korpTurn++ % 2) { if (performance.now() < voiceTill) return; const line = isaoSay(sfx, 'mk9_release', { force: true }); if (line) voiceTill = performance.now() + line.duration * 1000; return; }
    if (UNITS[id]?.sound) { sfx.stop?.(sound, 0.15); sound = sfx.say?.(UNITS[id].sound) ?? null; }
  }
  const hush = () => { sfx?.stop?.(sound, 0.4); sound = null; };
  for (const b of el.querySelectorAll('.wg-key')) {
    b.addEventListener('pointerenter', () => { show(b); hear(b); }); b.addEventListener('pointerleave', () => { hide(); hush(); });
    b.addEventListener('focus', () => show(b)); b.addEventListener('blur', () => hide());
    b.addEventListener('click', () => { if (pop.hidden || popFor !== b.dataset.unit) { show(b); hear(b); } else { hide(true); hush(); } });   // a tap on a touch screen
  }
  el.addEventListener('scroll', () => hide(true), { passive: true });

  // START: Ad Astra Per Aspera, the guide fades, and the landing begins as the line ends
  function start() {
    if (gate.starting) return; gate.starting = true; hide(true); hush();
    removeEventListener('pointerup', firstGesture); removeEventListener('keyup', firstGesture);
    const line = isaoSay(sfx, 'ad_astra', { force: true });
    el.classList.add('out');
    setTimeout(() => { isaoFree(); gate.opened = true; dispose(); onOpen?.(); }, line ? (line.duration + 0.25) * 1000 : 600);
  }
  cta.addEventListener('click', start);
  // ALL SYSTEMS NOMINAL (owner, 2026-10-07, lab 144: 'when the player hovers on the beginning start button'), once the sound can start
  cta.addEventListener('pointerenter', () => { if (!sfx?.ready || gate.starting || performance.now() < voiceTill) return; const line = isaoSay(sfx, 'welcome_nominal', { force: true }); if (line) voiceTill = performance.now() + line.duration * 1000; });
  queueMicrotask(() => cta.focus({ preventScroll: true }));   // Enter starts too
  function dispose() { hide(true); removeEventListener('pointerup', firstGesture); removeEventListener('keyup', firstGesture); el.classList.add('out'); setTimeout(() => el.remove(), 500); }
  return gate;
}
