// WHERE THE SHOWCASE PLAYS. The montage (src/fx/showcase.js) is not a route of its own: it is a rail over a real
// run of the skipped world, so the page that plays it IS the game page. This module owns the one decision — does
// this page play the montage — and the two URLs the last card goes to.
//
//   ?intro=1   always plays it
//   ?intro=0   never plays it
//   a bare page (no query at all, or only the shell's own font keys) plays it ONCE, then remembers
//   anything else — a deep link, ?skip=, ?stage=, the harness's ?sw=0&acceptance=1 — never plays it
//
// The "bare page only" rule is deliberate and narrow: a real player's first visit carries no query, and almost every
// browser suite names a key that says something about the run (`cine=0`, `acceptance=1`, `world=story`, `stage=`), so
// nothing else in the harness starts meeting a montage. The one suite that did — the `index.html?sw=0#td` default-route
// check — says `intro=0` now rather than clearing the store, because what it wants is the landing, not a fresh browser.
import { storage } from '../storage.js';

// src/storage.js only keeps keys matching /^(td[.-]|ssg[.-])/
export const SHOWCASE_SEEN_KEY = 'td-showcase-seen';

// keys a bare page may still carry: the shell's own font choices and the harness's service-worker switch, none of
// which say anything about the run. `sw` is here so the browser suite can exercise the bare page without registering
// a worker; the one existing suite that opened `index.html?sw=0#td` and must NOT meet the montage now says intro=0.
const BARE_OK = Object.freeze(['font', 'fontshout', 'sw']);

export function bareEntry(search) {
  for (const [k] of new URLSearchParams(search)) if (!BARE_OK.includes(k)) return false;
  return true;
}

export function showcaseSeen(store = storage) {
  return store.getItem(SHOWCASE_SEEN_KEY) === '1';
}

export function rememberShowcase(store = storage) {
  store.setItem(SHOWCASE_SEEN_KEY, '1');
}

// does this page play the montage?
export function showcaseOn(search, store = storage) {
  const intro = new URLSearchParams(search).get('intro');
  if (intro === '1') return true;
  if (intro === '0') return false;
  return bareEntry(search) && !showcaseSeen(store);
}

// the two ways out of the last card. Both are LINKS: a route change reloads the document (docs/STATE.md,
// Boundaries), so the montage's world is torn down and the real run builds itself from the query. Both carry
// intro=0 so the choice is not met by the montage again on the page it opens.
export function showcaseExitUrls(search, page = 'index.html', hash = 'td') {
  const keep = (extra) => {
    const q = new URLSearchParams(search);
    for (const k of ['intro', 'skip', 'stage', 'story', 'grow', 'phase']) q.delete(k);
    q.set('intro', '0');
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    return `${page}?${q.toString()}${hash ? `#${hash}` : ''}`;
  };
  return { play: keep({}), skip: keep({ skip: 'defence' }) };
}
