// A document owns one renderer/session. Navigating modes releases its whole lifetime.
import './url.js';
import './roster.js';
import { bootstrapContent } from './platform/content-bootstrap.js';
import { registerServiceWorker } from './pwa.js';
import { storage as localStorage } from './storage.js';
import { installDiagnostics, record } from './diagnostics.js';
import { isStoryRoute } from './core/story-route.js';
import { mountShellNav } from './fx/shell-nav.js';
import { loadPlanetBake } from './platform/planet-bake.js';
import { applyFontPack, DEFAULT_FONT, DEFAULT_SHOUT_FONT, loadTypeFeel } from './fonts.js';

installDiagnostics();
const q = new URLSearchParams(location.search);
if (q.get('sw') !== '0') {
  void registerServiceWorker(apply => {
    const nav = document.getElementById('shell-bar');
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
  beam: () => import('./beam-tab.js').then(m => m.initBeamTab),
  metal: () => import('./metal-tab.js').then(m => m.initMetalTab),
  story: () => import('./labs/story-tab.js').then(m => m.initStoryTab),
  sentry: () => import('./sentry-tab.js').then(m => m.initSentryTab),
  portal: () => import('./portal-tab.js').then(m => m.initPortalTab),
  sim: () => import('./sim-tab.js').then(m => m.initSimTab),
  laser: () => import('./labs/laser-tab.js').then(m => m.initLaserTab),
};
const name = location.hash.slice(1) || (workshop ? 'units' : 'td');
// the retired roadmap tab: the workshop opens with the docs overlay on the roadmap
// a page being replaced boots nothing: location.replace() does not stop this script, and a lab would build its renderer
let leaving = false;
if (workshop && name === 'notes') { const to = new URL(location.href); to.hash = 'units'; to.searchParams.set('doc', 'roadmap'); location.replace(to.href); leaving = true; }
// in the story, "the cinematic" is the arrival: ?cine=1 goes to the lab playing it, not the legacy cold open
if (!workshop && name === 'td' && isStoryRoute(location.search) && q.get('cine') === '1') {
  const to = new URL('./labs.html', location.href);
  for (const key of ['sw', 'acceptance']) if (q.has(key)) to.searchParams.set(key, q.get(key));   // the harness switches ride along
  to.searchParams.set('land', '1'); to.hash = 'story';
  location.replace(to.href); leaving = true;
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
if (leaving) {
  // one of the redirects above is replacing this page
} else if (!root) {
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
  // THE NAVIGATION SHELL: PLAYTEST | DEV top right with the build tag, one drawer per mode (src/fx/shell-nav.js)
  const build = document.querySelector('meta[name="cb"]')?.content, rev = document.querySelector('meta[name="rev"]')?.content;
  mountShellNav({ navigate, query: q, buildText: [build && build !== '00000000' ? `build ${build}` : 'dev', rev].filter(Boolean).join(' · ') });
  for (const evt of ['gesturestart', 'gesturechange', 'gestureend']) {
    root.addEventListener(evt, e => e.preventDefault(), { passive: false });
  }
  addEventListener('hashchange', () => location.reload());
  root.classList.remove('tab-hidden');
  try {
    const content = bootstrapContent();
    // the story planet's bake rides in with the module: seconds of relaxing and carving skipped when it is there
    // the laser lab builds the same story planet: without the bake it relaxed and carved it live, ~6 s of a 9 s load
    if ((target === 'td' && isStoryRoute(location.search)) || target === 'story' || target === 'laser') await loadPlanetBake();
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
