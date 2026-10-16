// THE VARIABLES MODAL (operator, 2026-09-02) and the lab page it carries, moved out of the game controller. Runs once, at
// the point of the controller's start-up where every root control and folder already exists, and before the frame readout's
// saved preference is applied.
//
// "too messy and too vertical": thirty root controls and four folders in one
// right-edge column. The lil-gui DOM is MOVED into #td-vars as pages — root
// controls become the GAME page, each folder its own page — so nothing
// about any control changes, only where it lives and how it is reached.
export function buildVarsModal({ root, gui, lab, flags, params, skySeed, applySky, spawnWave, postfx, setPerfOverlay, gpuExt, sectorNow = () => 0, sectorName = () => null, tunePanel = () => null }) {
  // ENEMY SPEED x (owner, 2026-10-16: "for the purpose of fine-tuning the game, I also want an 'enemy speed' variable, where we could increase the
  // moving speed of all enemies while play-testing"): a root control, so it sits on the GAME page; every record's walk is multiplied by it
  // (src/fx/enemy-step.js, so the Pearl bodies that follow their records go with them); ?speed=N sets it at boot
  gui.add(params, 'enemySpeed', 0.25, 4, 0.05).name('enemy speed ×');
  // THE PLAYTEST PAGE (owner, 2026-10-16: "I insist that we need an easy way to play/replay a sector and adapt the speed of enemies for test
  // play"): a folder, so a page of its own: the sector to open (named from the table), PLAY (the page reloads on ?skip=defence&sector=N, the
  // enemy speed carried as ?speed=), REPLAY THIS SECTOR, and the same enemy speed knob again beside them
  {
    const pt = { sector: Math.max(1, sectorNow() || 1) }, f = gui.addFolder('playtest');
    const open = (n) => { const u = new URL(location.href); u.searchParams.set('skip', 'defence'); u.searchParams.set('sector', String(n)); for (const k of ['boss', 'descent', 'speed']) u.searchParams.delete(k); if (Math.abs(params.enemySpeed - 1) > 1e-6) u.searchParams.set('speed', params.enemySpeed.toFixed(2)); u.hash = '#td'; location.href = u.href; };
    const name = () => sectorName(pt.sector) ? `${pt.sector} · ${sectorName(pt.sector)}` : `sector ${pt.sector}`;
    const label = { now: sectorNow() ? `${sectorNow()} · ${sectorName(sectorNow()) ?? ''}` : 'before sector 1', pick: name() };
    f.add(label, 'now').name('playing now').disable?.();
    const pick = f.add(label, 'pick').name('to open'); pick.disable?.();
    f.add(pt, 'sector', 1, 12, 1).name('sector').onChange(() => { label.pick = name(); pick.updateDisplay?.(); });
    f.add({ play: () => open(pt.sector) }, 'play').name('▶ play that sector');
    f.add({ replay: () => open(Math.max(1, sectorNow() || 1)) }, 'replay').name('↻ replay this sector');
    f.add(params, 'enemySpeed', 0.25, 4, 0.05).name('enemy speed ×');
  }
  // THE LAB PAGE (?lab=1). A folder here becomes a page in VARS below, for free.
  const applyLabSky = applySky;   // the lab's knobs feed the same bake
  if (lab.on) {
    // the lab opens on the run's own sky unless the URL named a seed
    if (flags.labseed === null && flags.labGalaxySeed === null) lab.galaxySeed = skySeed;
    const f = gui.addFolder('lab');
    f.add(lab, 'waveMult', 1, 20, 1).name('wave ×');
    f.add({ spawn: () => spawnWave() }, 'spawn').name('⚡ spawn a wave now');
    f.add(lab, 'holdWaves').name('hold waves');
    f.add(lab, 'freezeEnemies').name('freeze enemies');
    f.add(lab, 'immortalHeart').name('immortal heart');
    f.add(lab, 'immortalTank').name('immortal tank');
    f.add(lab, 'bg', ['none', 'galaxy']).name('background').onChange(applyLabSky);
    f.add(lab, 'galaxySeed', 0, 99999, 1).name('galaxy seed').onFinishChange(applyLabSky);
    f.add({ roll: () => { lab.galaxySeed = Math.floor(Math.random() * 100000); applyLabSky(); f.controllersRecursive().forEach((c) => c.updateDisplay()); } }, 'roll').name('↻ new galaxy');
    f.add(lab, 'galaxyScale', 0.1, 4, 0.05).name('galaxy size').onFinishChange(applyLabSky);
    f.add(lab, 'galaxies', 1, 8, 1).name('galaxies').onFinishChange(applyLabSky);
    f.add(lab, 'galaxyCore', 0.25, 3, 0.05).name('core size ×').onFinishChange(applyLabSky);
    f.add(lab, 'bgIntensity', 0, 1.5, 0.05).name('sky intensity');
    f.add(lab, 'bloom').name('bloom').onChange((v) => postfx.setEnabled(v));
    // what the URL asked for, applied once the board exists
    applyLabSky();
    postfx.setEnabled(lab.bloom);
  }
  const modal = root.querySelector('#td-vars');
  if (!modal) return;
  const nav = modal.querySelector('.vars-nav');
  const body = modal.querySelector('.vars-body');
  const pages = [];
  // page 1: everything that was loose at the root
  // a page WRAPPING a lil-gui block, not a page that IS one: the modal's
  // stylesheet forces every `.lil-gui` inside it visible (!important), so a
  // page carrying that class could never be hidden — every other page was
  // drawn underneath the game page, scrolled out of sight (found 2026-09-03
  // when the lab page came up as the game page)
  const gamePage = document.createElement('div');
  gamePage.className = 'vars-page';
  const gameBlock = document.createElement('div');
  gameBlock.className = 'lil-gui';
  const gameKids = document.createElement('div');
  gameKids.className = 'children';
  for (const c of gui.controllers) gameKids.appendChild(c.domElement);
  gameBlock.appendChild(gameKids);
  gamePage.appendChild(gameBlock);
  pages.push({ title: 'game', el: gamePage });
  // one page per folder, the folder's own element moved whole
  for (const f of gui.folders) {
    const page = document.createElement('div');
    page.className = 'vars-page';
    page.appendChild(f.domElement);
    f.open();
    pages.push({ title: f._title, el: page });
  }
  const PAGE_KEY = 'stalheart.vars.page';   // the last page, remembered (owner, 2026-10-16: the modal came back on its first page every time)
  const show = (i) => {
    try { localStorage.setItem(PAGE_KEY, pages[i]?.title ?? ''); } catch { /* no storage */ }
    pages.forEach((pg, j) => pg.el.classList.toggle('active', j === i));
    nav.querySelectorAll('button').forEach((b, j) => b.classList.toggle('active', j === i));
  };
  pages.forEach((pg, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = pg.title;
    b.addEventListener('click', () => show(i));
    nav.appendChild(b);
    body.appendChild(pg.el);
  });
  // the root gui shell is now empty; park it out of the way but keep it
  // alive, since lil-gui's controllers still reference their parent
  gui.domElement.style.display = 'none';
  modal.querySelector('.vars-close').addEventListener('click',
    () => document.body.classList.remove('vars-open'));
  const tg = root.querySelector('#vars-toggle');
  if (tg) tg.addEventListener('click', () => document.body.classList.toggle('vars-open'));
  modal.classList.remove('hidden');
  { let i = 0; try { const t = localStorage.getItem(PAGE_KEY); const j = pages.findIndex((pg) => pg.title === t); if (j >= 0) i = j; } catch { /* no storage */ } show(i); }
  // Z TOGGLES IT (owner, 2026-10-16: 'cannot be easily recalled when dismissed'); the tune panel (X) and this drawer take turns on the right edge
  const editable = (t) => !!t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  const openVars = () => { tunePanel()?.close?.(); document.body.classList.add('vars-open'); };
  globalThis.window?.addEventListener?.('keydown', (e) => { if (editable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return; if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); if (document.body.classList.contains('vars-open')) document.body.classList.remove('vars-open'); else openVars(); } }, { capture: true });   // (globalThis: the node test builds the modal without a window)
  tunePanel()?.onOpen?.(() => document.body.classList.remove('vars-open'));
  // ?vars=1 opens it; ?fps=1 turns the readout on — for screenshots and
  // for linking a state rather than describing it
  if (flags.vars === '1') document.body.classList.add('vars-open');
  if (lab.on) {
    const i = pages.findIndex((pg) => pg.title === 'lab');
    if (i >= 0) show(i);
    document.body.classList.add('vars-open');
    setPerfOverlay(true, false);   // the lab reads the readout; it does not set your preference
    console.log(`LAB on mult=${lab.waveMult} bg=${lab.bg}`
      + ` immortal=${lab.immortalHeart ? 'heart' : ''}${lab.immortalTank ? '+tank' : ''} gpuQuery=${!!gpuExt}`);
  }
}
