// The navigation shell on every game and workshop page: an always-visible PLAYTEST | DEV toggle joined to the build
// tag, and one drawer per mode drawn from src/content/nav.js. Switching modes opens that mode's drawer and never
// navigates; only picking an entry does. DEV is offered on the source tree, or on a release after ?dev=1.
import { NAV_ENTRIES, NAV_GROUPS } from '../content/nav.js';
import { activeEntry, currentMode, entryUrl, placeLabel, storyStage } from '../core/nav-match.js';
import { devModeOn } from '../core/dev-mode.js';
import { escapeHtml as esc } from '../core/markdown.js';
import { storage } from '../storage.js';
import { downloadJSON } from '../diagnostics.js';
import { DEFAULT_ENEMIES, finishJump, raiseEnemies } from './jump-to.js';

const MODE_KEY = 'ssg.nav-mode', DEV_KEY = 'ssg.dev-face';
// where a backslash is typing, not a menu key
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], .lil-gui, dialog, [role="dialog"]';

export function mountShellNav({ navigate, buildText, query = new URLSearchParams(location.search) }) {
  const loc = { page: location.pathname, hash: location.hash.slice(1), search: location.search };
  const dev = devModeOn({ buildToken: document.querySelector('meta[name="cb"]')?.content, search: location.search, stored: storage.getItem(DEV_KEY) });
  if (dev.store === '1') storage.setItem(DEV_KEY, '1'); else if (dev.store === '') storage.removeItem(DEV_KEY);
  // a phone does not need DEV: labs, tuning, docs and tools are desktop-only furniture. CSS alone would hide the
  // toggle and the drawer section but leave `mode` stuck on 'dev' for a lab page opened on a phone, which reads as
  // an empty drawer; turning DEV off here also makes currentMode() fall back to playtest.
  if (matchMedia('(pointer: coarse)').matches) dev.on = false;
  const active = activeEntry(NAV_ENTRIES, loc);
  let mode = currentMode(NAV_ENTRIES, loc, { stored: storage.getItem(MODE_KEY), devOn: dev.on });
  const onStory = active === 'story' || active === 'defend' || !!active?.startsWith('jump-');
  const stage = storyStage(location.search);
  let count = Math.max(0, parseInt(query.get('enemies') ?? DEFAULT_ENEMIES, 10) || 0);

  const bar = document.createElement('div'); bar.id = 'shell-bar';
  bar.innerHTML = '<div class="shell-toggle" role="group" aria-label="navigation mode">'
    + '<button type="button" data-mode="playtest" title="the sections under playtest (\\)">PLAYTEST</button>'
    + (dev.on ? '<button type="button" data-mode="dev" title="labs, tuning, docs and tools (\\)">DEV</button>' : '')
    + `</div><span class="shell-place">${esc(placeLabel(NAV_ENTRIES, loc))}</span><span id="build-tag">${esc(buildText)}</span>`;

  const button = (e) => {
    const on = e.id === active || (onStory && e.id === `stage-${stage}`);
    const kind = e.target.tool ? ` data-tool="${e.target.tool}"` : '';
    return `<button type="button" class="${e.row ? 'shell-small' : 'shell-big'}${on ? ' active' : ''}" data-entry="${e.id}"${kind} title="${esc(e.title || e.label)}"${e.disabled ? ' disabled' : ''}>${esc(e.label)}</button>`;
  };
  const section = (m) => NAV_GROUPS.filter((g) => g.mode === m).map((g) => {
    const items = NAV_ENTRIES.filter((e) => e.mode === m && e.group === g.group);
    const rows = [...new Set(items.filter((e) => e.row).map((e) => e.row))].map((r) =>
      `<div class="shell-row" data-row="${r}"><span>${r === 'stages' ? 'stage' : 'jump to'}</span>${items.filter((e) => e.row === r).map(button).join('')}</div>`).join('');
    const count_ = g.group === 'tools'
      ? `<label class="shell-count" title="enemies a story jump raises, and per press of +">enemies <input type="number" min="0" max="500" step="10" data-count value="${count}"><button type="button" data-tool="raise" title="raise this many more enemies now">+</button></label>` : '';
    return `<div class="shell-group" data-group="${g.group}"${g.group === 'tuning' ? ' hidden' : ''}>${g.label ? `<h3>${g.label}</h3>` : ''}`
      + `${items.filter((e) => !e.row).map(button).join('')}${rows}${count_}</div>`;
  }).join('');
  const nav = document.createElement('nav'); nav.id = 'shell-nav'; nav.setAttribute('aria-label', 'Stalheart navigation'); nav.hidden = true;
  nav.innerHTML = `<section data-mode="playtest">${section('playtest')}</section>` + (dev.on ? `<section data-mode="dev">${section('dev')}</section>` : '');
  document.body.append(bar, nav);

  const isOpen = () => document.body.classList.contains('shell-open');
  const flash = (b, text) => { const was = b.textContent; b.textContent = text; setTimeout(() => { b.textContent = was; }, 1400); };
  // the variables modal's own pages, read when DEV opens: a new lil-gui folder shows up without touching nav.js
  const fillTuning = () => {
    const group = nav.querySelector('[data-group="tuning"]'); if (!group) return;
    group.querySelectorAll('[data-tuning]').forEach((b) => b.remove());
    const pages = [...document.querySelectorAll('#td-vars .vars-nav button')];
    group.hidden = pages.length === 0;
    for (const page of pages) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'shell-big'; b.dataset.tuning = page.textContent; b.textContent = page.textContent;
      b.addEventListener('click', () => { page.click(); document.body.classList.add('vars-open'); setOpen(false); });
      group.append(b);
    }
  };
  const render = () => {
    bar.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('current', b.dataset.mode === mode));
    nav.querySelectorAll('section').forEach((s) => { s.hidden = s.dataset.mode !== mode; });
    nav.hidden = !isOpen();
  };
  function setOpen(open) {
    document.body.classList.toggle('shell-open', open);
    if (open && mode === 'dev') fillTuning();
    render();
  }
  function setMode(m) {
    if (m === mode) { setOpen(!isOpen()); return; }
    mode = m; storage.setItem(MODE_KEY, m); setOpen(true);
  }

  const tools = {
    felt: () => { setOpen(false); import('./felt-capture.js').then((m) => m.openFeltCapture()); },
    // the game's own deep link knows the board and the seed; elsewhere this page's address is the link
    link: (b) => {
      const own = document.querySelector('#td-link');
      if (own) { own.click(); flash(b, 'copied'); return; }
      navigator.clipboard?.writeText(location.href).then(() => flash(b, 'copied'), () => flash(b, 'copy refused'));
    },
    fps: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: '`', bubbles: true })),
    diagnostics: (b) => {
      const raw = sessionStorage.getItem('stalheart:diagnostics');
      if (!raw) { flash(b, 'no game yet'); return; }
      downloadJSON(JSON.parse(raw), 'stalheart-diagnostics.json');
    },
    raise: (b) => flash(b, raiseEnemies(count) ? 'raised' : 'no hooks'),
  };

  bar.querySelector('.shell-toggle').addEventListener('click', (ev) => { const b = ev.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
  nav.addEventListener('click', (ev) => {
    const tool = ev.target.closest('[data-tool]');
    if (tool) { tools[tool.dataset.tool]?.(tool); return; }
    const b = ev.target.closest('[data-entry]'); if (!b || b.disabled) return;
    const entry = NAV_ENTRIES.find((e) => e.id === b.dataset.entry);
    if (entry.target.doc) { setOpen(false); import('./docs-overlay.js').then((m) => m.openDocsOverlay(entry.target.doc)); return; }
    navigate(entryUrl(entry.target, location.search, { enemies: entry.target.url ? count : null }));
  });
  nav.querySelector('[data-count]')?.addEventListener('input', (ev) => { count = Math.max(0, parseInt(ev.target.value, 10) || 0); });
  nav.addEventListener('keydown', (ev) => { if (ev.target.matches('input')) ev.stopPropagation(); });   // typing a count is not a game key

  // capture on the window: these run before the game's own key handlers and stop the ones they use
  addEventListener('keydown', (ev) => {
    if (ev.key === '\\' && !ev.target.closest?.(TYPING) && !document.activeElement?.closest?.(TYPING)) {
      ev.preventDefault(); ev.stopImmediatePropagation(); setOpen(!isOpen()); return;
    }
    if (ev.key === 'Escape' && isOpen()) { ev.preventDefault(); ev.stopImmediatePropagation(); setOpen(false); }
  }, true);
  document.addEventListener('pointerdown', (ev) => { if (isOpen() && !nav.contains(ev.target) && !bar.contains(ev.target)) setOpen(false); }, true);

  render();
  const jump = finishJump({ query, count: () => count });
  const doc = query.get('doc');
  if (doc && dev.on) import('./docs-overlay.js').then((m) => m.openDocsOverlay(doc));
  return { setMode, setOpen, dispose() { jump.dispose(); bar.remove(); nav.remove(); } };
}
