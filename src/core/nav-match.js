// Where the current URL is in the navigation shell, and where an entry goes. Pure: the caller passes the page path,
// the hash without '#', and the search string.
import { isStoryRoute } from './story-route.js';

// the switches that belong to a mode; leaving a mode drops them, harness switches (sw, acceptance, dev, fps) ride along
export const MODE_SWITCHES = Object.freeze(['story', 'stage', 'world', 'heart', 'threat', 'land', 'cine', 'skip', 'gunship', 'brief', 'enemies', 'doc']);

const pageOf = (page) => (/labs\.html$/.test(page) ? 'labs.html' : /settings\.html$/.test(page) ? 'settings.html' : 'index.html');

export function storyStage(search) {
  const q = new URLSearchParams(search);
  const n = parseInt(q.get('stage') ?? q.get('story') ?? '1', 10);
  return Number.isFinite(n) ? n : 1;
}

export function activeEntry(entries, { page, hash, search }) {
  const q = new URLSearchParams(search);
  const has = (id) => (entries.some((e) => e.id === id) ? id : null);
  const p = pageOf(page);
  if (p === 'settings.html') return has('settings');
  if (p === 'labs.html') {
    const h = hash || 'units';
    if (h === 'story' && q.get('land') === '1') return has('arrival');
    return has(`lab-${h}`);
  }
  const h = hash || 'td';
  if (h === 'record') return has('record');
  if (h !== 'td') return null;
  const skip = q.get('skip');
  if (skip && has(`jump-${skip}`)) return `jump-${skip}`;
  if (!isStoryRoute(search) && !q.has('classic') && !q.has('mission')) return null;   // retired classic= and mission= links resolve to the story
  return storyStage(search) >= 8 ? has('defend') : has('story');
}

export const modeOf = (entries, id) => entries.find((e) => e.id === id)?.mode ?? null;

export function currentMode(entries, loc, { stored = null, devOn = true } = {}) {
  const mode = modeOf(entries, activeEntry(entries, loc)) ?? (stored === 'dev' ? 'dev' : 'playtest');
  return mode === 'dev' && !devOn ? 'playtest' : mode;
}

export function placeLabel(entries, loc) {
  const id = activeEntry(entries, loc);
  const entry = entries.find((e) => e.id === id);
  if (!entry) return '';
  if (id === 'story') return `story · stage ${storyStage(loc.search)}`;
  if (id.startsWith('lab-')) return `lab · ${entry.label}`;
  if (id.startsWith('jump-')) return `jump · ${entry.label.toLowerCase()}`;
  return entry.label.toLowerCase();
}

export function entryUrl(target, search, { enemies = null } = {}) {
  const q = new URLSearchParams(search);
  for (const key of MODE_SWITCHES) q.delete(key);
  let page, hash;
  if (target.url) {
    const [path, frag = ''] = target.url.split('#');
    const [p, qs = ''] = path.split('?');
    page = p; hash = frag;
    for (const [k, v] of new URLSearchParams(qs)) q.set(k, v);
    if (enemies !== null) q.set('enemies', String(enemies));
  } else {
    page = target.page; hash = target.hash;
    for (const [k, v] of Object.entries(target.params || {})) q.set(k, v);
  }
  const s = q.toString();
  return `${page}${s ? `?${s}` : ''}${hash ? `#${hash}` : ''}`;
}
