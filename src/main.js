// A document owns one renderer/session. Navigating modes releases its whole lifetime.
import './url.js';
import './roster.js';
import { bootstrapContent } from './platform/content-bootstrap.js';
import { registerServiceWorker } from './pwa.js';
import { storage as localStorage } from './storage.js';
import { installDiagnostics, record } from './diagnostics.js';
import { applyFontPack, DEFAULT_FONT, DEFAULT_SHOUT_FONT, loadTypeFeel } from './fonts.js';

installDiagnostics();
const q = new URLSearchParams(location.search);
if (q.get('sw') !== '0') {
  void registerServiceWorker(apply => {
    const nav = document.getElementById('tabbar');
    if (!nav || document.getElementById('app-update')) return;
    const button = document.createElement('button');
    button.id = 'app-update'; button.textContent = 'update & restart';
    button.addEventListener('click', apply); nav.append(button);
    record('app.update-ready');
  }).then(reg => record('app.worker', { registered: !!reg, reason: registerServiceWorker.why }));
}
const workshop = document.body.dataset.workshop === 'true';
const routes = {
  audio: () => import('./labs/audio-tab.js').then(m => m.initAudioTab),
  td: () => import('./td-tab.js').then(m => m.initTdTab),
  record: () => import('./recordtab.js').then(m => m.initRecordTab),
  units: () => import('./units-tab.js').then(m => m.initUnitsTab),
  beam: () => import('./beam-tab.js').then(m => m.initBeamTab),
  metal: () => import('./metal-tab.js').then(m => m.initMetalTab),
  astro: () => import('./astro-tab.js').then(m => m.initAstroTab),
  sentry: () => import('./sentry-tab.js').then(m => m.initSentryTab),
  sniper: () => import('./sniper-tab.js').then(m => m.initSniperTab),
  portal: () => import('./portal-tab.js').then(m => m.initPortalTab),
  cine: () => import('./cine-tab.js').then(m => m.initCineTab),
  sim: () => import('./sim-tab.js').then(m => m.initSimTab),
};
const name = location.hash.slice(1) || (workshop ? 'units' : 'td');
const target = routes[name] ? name : (workshop ? 'units' : 'td');
const root = document.getElementById(`tab-${target}`);
const gameRoutes = new Set(['td', 'record']);
function navigate(url) {
  const next = new URL(url, location.href);
  const same = next.pathname === location.pathname && next.search === location.search;
  location.href = next.href;
  if (same) location.reload();
}
if (!root) {
  const url = new URL(gameRoutes.has(target) ? './index.html' : './labs.html', location.href);
  url.search = location.search; url.hash = target;
  location.replace(url);
} else {
  const type = loadTypeFeel();
  const pick = applyFontPack(q.get('font') || localStorage.getItem('ssg-font') || DEFAULT_FONT,
    document.documentElement, type,
    q.get('fontshout') || localStorage.getItem('ssg-font-shout') || DEFAULT_SHOUT_FONT);
  if (q.has('font')) localStorage.setItem('ssg-font', pick);
  if (q.get('coarse') === '1') {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      for (const r of rules) {
        if (!(r instanceof CSSMediaRule)) continue;
        r.media.mediaText = r.media.mediaText
          .replace(/\(pointer:\s*coarse\)|\(hover:\s*none\)/g, '(min-width: 0px)')
          .replace(/\(pointer:\s*fine\)|\(hover:\s*hover\)/g, '(min-width: 99999px)');
      }
    }
  }
  for (const b of document.querySelectorAll('#tabbar button')) {
    b.classList.toggle('active', b.dataset.tab === target
      && (!('mission' in b.dataset) || b.dataset.mission === (q.get('mission') || ''))
      && (!('roster' in b.dataset) || b.dataset.roster === (q.get('roster') || '2')));
    b.addEventListener('click', () => {
      const url = new URL(b.dataset.page || location.pathname, location.href);
      url.search = location.search;
      url.searchParams.delete('sentryPilot');
      for (const key of ['mission', 'roster']) if (key in b.dataset) {
        if (b.dataset[key]) url.searchParams.set(key, b.dataset[key]);
        else url.searchParams.delete(key);
      }
      url.hash = b.dataset.tab || '';
      navigate(url);
    });
  }
  const menu = document.createElement('button');
  menu.id = 'chrome-toggle'; menu.textContent = '☰'; menu.title = 'game menu';
  menu.setAttribute('aria-label', 'Game menu');
  menu.onclick = () => document.body.classList.toggle('chrome-open');
  document.body.append(menu);
  for (const evt of ['gesturestart', 'gesturechange', 'gestureend']) {
    root.addEventListener(evt, e => e.preventDefault(), { passive: false });
  }
  addEventListener('hashchange', () => location.reload());
  root.classList.remove('tab-hidden');
  try {
    const content = bootstrapContent();
    const init = await routes[target]();
    const api = init(root);
    const choices = workshop
      ? (await import('./labs/choice-browser.js')).mountChoiceBrowser(root) : null;
    api?.setActive?.(true);
    addEventListener('pagehide', e => { if (!e.persisted) { choices?.dispose(); api?.dispose?.(); } });
    record('app.ready', { route: target, workshop, content: content.id });
    window.__stalheartContent = { id: content.id, base: content.base, preview: q.get('preset') === 'draft' };
    window.__stalheartReady = true;
  } catch (err) {
    record('app.failed', { message: err.message, stack: err.stack });
    const error = document.createElement('div');
    error.className = 'boot-error';
    error.textContent = `Stalheart could not start: ${err.message}. Reload or export diagnostics from Settings.`;
    document.body.append(error);
    console.error(err);
  }
}
