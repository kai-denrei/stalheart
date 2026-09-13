// A document owns one renderer/session. Navigating modes releases its whole lifetime.
import './url.js';
import './roster.js';
import { bootstrapContent } from './platform/content-bootstrap.js';
import { registerServiceWorker } from './pwa.js';
import { storage as localStorage } from './storage.js';
import { installDiagnostics, record } from './diagnostics.js';
import { isStoryRoute } from './core/story-route.js';
import { STAGES } from './content/base-layout.js';
import { loadPlanetBake } from './platform/planet-bake.js';
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
  swarm: () => import('./labs/swarm-tab.js').then(m => m.initSwarmTab),
  notes: () => import('./labs/notes-tab.js').then(m => m.initNotesTab),
  beam: () => import('./beam-tab.js').then(m => m.initBeamTab),
  metal: () => import('./metal-tab.js').then(m => m.initMetalTab),
  astro: () => import('./astro-tab.js').then(m => m.initAstroTab),
  story: () => import('./labs/story-tab.js').then(m => m.initStoryTab),
  sentry: () => import('./sentry-tab.js').then(m => m.initSentryTab),
  sniper: () => import('./sniper-tab.js').then(m => m.initSniperTab),
  portal: () => import('./portal-tab.js').then(m => m.initPortalTab),
  cine: () => import('./cine-tab.js').then(m => m.initCineTab),
  sim: () => import('./sim-tab.js').then(m => m.initSimTab),
};
const name = location.hash.slice(1) || (workshop ? 'units' : 'td');
// in the story, "the cinematic" is the arrival: ?cine=1 goes to the lab playing it, not the legacy cold open
if (!workshop && name === 'td' && isStoryRoute(location.search) && q.get('cine') === '1') {
  const to = new URL('./labs.html', location.href);
  for (const key of ['sw', 'acceptance']) if (q.has(key)) to.searchParams.set(key, q.get(key));   // the harness switches ride along
  to.searchParams.set('land', '1'); to.hash = 'story';
  location.replace(to.href);
}
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
      && (('story' in b.dataset) === (target === 'td' && isStoryRoute(location.search)))   // the story entries own the story world, the others never show active there
      && (!('story' in b.dataset) || (Number(b.dataset.story) >= 8) === (Number(q.get('stage') ?? q.get('story') ?? 1) >= 8))   // defend is the finished base; story, the opening
      && (!('mission' in b.dataset) || b.dataset.mission === (q.get('mission') || ''))
      && (!('roster' in b.dataset) || b.dataset.roster === (q.get('roster') || '2')));
    b.addEventListener('click', () => {
      const url = new URL(b.dataset.page || location.pathname, location.href);
      url.search = location.search;
      url.searchParams.delete('sentryPilot');
      for (const key of ['story', 'stage', 'world', 'heart', 'threat', 'land', 'classic', 'cine']) url.searchParams.delete(key);   // leaving a mode drops its switches
      for (const key of ['mission', 'roster', 'story', 'land', 'classic']) if (key in b.dataset) {
        if (b.dataset[key]) url.searchParams.set(key, b.dataset[key]);
        else url.searchParams.delete(key);
      }
      url.hash = b.dataset.tab || '';
      navigate(url);
    });
  }
  // the story's stages, right in the menu: no URL editing while the beats are being built
  if (!workshop && target === 'td' && isStoryRoute(location.search)) {
    const strip = document.createElement('div'); strip.id = 'story-stages-nav';
    const names = STAGES.map((s) => s.name);
    const current = parseInt(q.get('stage') ?? q.get('story') ?? '1', 10);
    names.forEach((name, n) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = `${n} ${name}`; b.classList.toggle('active', n === current); b.addEventListener('click', () => navigate(new URL(`./index.html?story=${n}#td`, location.href))); strip.append(b); });
    const arrival = document.createElement('button'); arrival.type = 'button'; arrival.textContent = 'arrival cinematic'; arrival.addEventListener('click', () => navigate(new URL('./labs.html?land=1#story', location.href))); strip.append(arrival);
    document.getElementById('tabbar')?.after(strip);
  }
  // WHICH BUILD IS THIS: the release token top right (the file hash the build stamps in), or dev on the source tree
  const build = document.querySelector('meta[name="cb"]')?.content; const tag = document.createElement('div'); tag.id = 'build-tag'; tag.textContent = build && build !== '00000000' ? `build ${build}` : 'dev'; document.body.append(tag);
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
    // the story planet's bake rides in with the module: seconds of relaxing and carving skipped when it is there
    if ((target === 'td' && isStoryRoute(location.search)) || target === 'story') await loadPlanetBake();
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
