// deeplink.js — a lab's current state, as a URL you can send someone.
//
// Every lab here is a tuning surface, and the answer a tuning session
// produces is a set of numbers. Until now the only way to carry one out was
// to read the sliders off a screenshot or paste a preset — so a look that
// took twenty minutes to find could not be handed to anyone, or to yourself
// tomorrow. The deep link is the whole session in an address bar.
//
// Two rules make the link usable rather than merely correct:
//
//   ONLY WHAT DIFFERS. A link that restates every default is unreadable, and
//   worse, it PINS values that should follow the code — open it in a month
//   and you are looking at last month's defaults with this month's model.
//   The diff is the message; everything else is inherited.
//
//   NEVER A '#'. Colours live in these params as '#rrggbb', and a '#' in a
//   query string ends the query and starts the fragment. One unescaped hash
//   truncates the link at the first colour, which is a bug that shows up as
//   "the link only carries half my settings" and nothing else.
//
// Pure: no DOM in the builder, Node-tested in test/deeplink.mjs. The one
// effectful helper at the bottom is guarded and does nothing without a
// document.

// One-shot flags: a probe, a capture, a dump. These make something HAPPEN
// once and mean nothing to whoever opens the link — a shared address that
// re-runs somebody's probe is a shared address nobody trusts.
export const DROP_KEYS = new Set([
  'capture', 'export', 'dump', 'bench', 'gl',
  'mineprobe', 'minelay', 'rescueprobe', 'rescue2probe', 'campgo',
  'layout', 'stateprobe', 'govprobe', 'labprobe', 'hitprobe', 'look',
  'devlog', 'log', 'dlprobe', 'sentryprobe', 'tabprobe', 'fxprobe', 'matprobe',
]);

// A value, as a query parameter. Numbers lose float noise, booleans become
// 1/0, and a leading '#' is stripped — see the second rule above.
export function encodeValue(v) {
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return String(+v.toFixed(4));
  }
  const s = String(v);
  return s.startsWith('#') ? s.slice(1) : s;
}

// True when the two are the same value as a LINK would carry them — the
// comparison has to happen after encoding, or 0.22000000000000003 and 0.22
// are "different" and every link carries the whole panel.
export const sameAsDefault = (a, b) => encodeValue(a) === encodeValue(b);

// The query string for a lab's params: only the keys that differ from their
// defaults, sorted so the same state always produces the same link.
export function deepLinkQuery(params, defaults = {}, { skip = [] } = {}) {
  const skipSet = new Set(skip);
  const out = [];
  for (const k of Object.keys(params || {}).sort()) {
    if (skipSet.has(k)) continue;
    const v = params[k];
    if (v === null || v === undefined || typeof v === 'function' || typeof v === 'object') continue;
    if (k in defaults && sameAsDefault(v, defaults[k])) continue;
    out.push(`${encodeURIComponent(k)}=${encodeURIComponent(encodeValue(v))}`);
  }
  return out.join('&');
}

// The whole address. `carry` is the page's CURRENT search string: the seed,
// the tier, the mission — context the lab does not own but the link should
// keep. Anything the params also name is dropped from it, because the live
// panel is the truth and a stale copy of it in the URL is not.
export function deepLink({ base = '', hash = '', params = null, defaults = {},
  carry = '', drop = DROP_KEYS, skip = [] } = {}) {
  const kept = [];
  const own = new Set(Object.keys(params || {}));
  const skipSet = new Set(skip);
  if (carry) {
    for (const [k, v] of new URLSearchParams(carry)) {
      if (drop.has(k) || own.has(k) || skipSet.has(k)) continue;
      kept.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  const mine = params ? deepLinkQuery(params, defaults, { skip }) : '';
  const qs = [kept.join('&'), mine].filter(Boolean).join('&');
  const h = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  return `${base}${qs ? `?${qs}` : ''}${h}`;
}

// A link to THIS page with one parameter set — or CLEARED, when the value is
// the empty string, which is how "back to the campaign" is expressed without
// a second code path. The mission buttons are the first user: a mission is
// read once, at boot, when the board builds, so choosing one is a navigation
// and the thing being navigated to is exactly this.
export function paramLink({ base = '', hash = '', key, value = '', carry = '' }) {
  return deepLink({ base, hash, carry, params: { [key]: value }, defaults: { [key]: '' } });
}

// --- the button -----------------------------------------------------------
// Effectful, and the only part that touches a document. Copies the link AND
// writes it into the address bar: on a phone the clipboard refuses often
// enough that a button which only copies is a button that sometimes does
// nothing at all (the metal lab learned this one — operator, 2026-09-04,
// "I cannot copy paste the value"), and an address bar you can read is a
// fallback every device has.
export function wireDeepLink(btn, build, { flash = null, label = 'LINK' } = {}) {
  if (!btn || typeof document === 'undefined') return;
  let resetT = 0;
  const say = (msg, ok) => {
    if (flash) flash(msg);
    btn.textContent = ok ? '✓' : '!';
    clearTimeout(resetT);
    resetT = setTimeout(() => { btn.textContent = '↗'; }, 1600);
  };
  // ?dlprobe=1 — press the button. A deep link is only worth having if the
  // address it writes is one the lab READS BACK, and the whole failure mode
  // (a colour's '#' truncating the query, a key the parser does not know) is
  // invisible until something clicks it. One probe for every lab, because
  // they all come through this one function.
  if (new URLSearchParams(location.search).get('dlprobe') === '1') {
    setTimeout(() => btn.click(), 2500);
  }
  btn.addEventListener('click', () => {
    const url = build();
    // the address bar first: it cannot fail, and it is what a person
    // screenshots when the clipboard does
    try { history.replaceState(null, '', url); } catch { /* file:// refuses */ }
    console.log(`DEEPLINK ${label}: ${url}`);
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard')))
      .then(() => say('deep link copied — it is in the address bar too', true),
        (e) => say(`link in the address bar (clipboard ${e && e.message})`, false));
  });
}
