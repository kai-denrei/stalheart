# Navigation Shell (PLAYTEST | DEV) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat tab bar, the stage strip, the floating skip panel and the ☰ ⚙ ↗ corner buttons with one shell: an always-visible `PLAYTEST | DEV` toggle top right (joined to the build tag) and one drawer per mode, with the docs, a felt-it capture and the variables pages under DEV.

**Architecture:** The menu is data (`src/content/nav.js`); which entry and mode the current URL is, and the URL an entry goes to, are pure functions (`src/core/nav-match.js`, `src/core/dev-mode.js`), all Node-tested. DOM lives in `src/fx/`: `shell-nav.js` renders the toggle and drawers on both pages, `jump-to.js` finishes a story jump, `docs-overlay.js` and `felt-capture.js` are DEV screens loaded on demand. `src/main.js` mounts the shell and loses its tab wiring.

**Tech Stack:** Native ESM, no dependencies; Node test programs (`test/*.mjs`, run by `npm test`); headless Chrome acceptance (`scripts/browser-test.mjs`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-navigation-shell-design.md`.
- New code only in `src/core/`, `src/domain/`, `src/content/`, `src/fx/`. No new top-level `src/*.js` (`docs/architecture-budget.json` `topLevelModules` is frozen).
- `src/core`, `src/domain`, `src/content` are pure: no `window`, `document`, `localStorage`, `sessionStorage`, `fetch` anywhere in their code, including trailing `//` comments (the guard only strips whole-line comments). `core` imports only `core`; `content` imports `content` or `core`; `domain` imports `domain` or `core`.
- `src/td-tab.js` must not grow (line budget 13957). Edits there replace lines one for one. Never put a `//` comment on a td-tab one-liner that already carries code after it.
- Storage keys go through `src/storage.js` `storage` and must start with `ssg.`: `ssg.dev-face`, `ssg.nav-mode`, `ssg.felt-notes`.
- Hotkey: backslash (`\`) only; Tab stays the browser's. Esc closes the drawer only while it is open and never reaches the game then. V and the backtick keep their jobs.
- DEV is on when the `<meta name="cb">` token is `00000000` (source tree); on a release only after `?dev=1` (remembered), `?dev=0` clears the memory.
- No colored emoji in product UI.
- 16 GB machine: run browser suites one at a time; check `~/scripts/check-memory.sh` before a browser run and back off at WARN.
- Commit after each task. Author Kai Denrei <270854086+kai-denrei@users.noreply.github.com>. Every message ends with a blank line and exactly:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX`
  Do not push.

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `src/content/nav.js` | 1 | modes, groups, entries, docs, story jumps as data |
| `src/core/nav-match.js` | 1 | active entry, mode, place label, story stage, entry URL |
| `src/core/dev-mode.js` | 1 | whether DEV is offered and what to remember |
| `src/fx/story-skips.js` | 1 (re-export), 4 (deleted) | temporary alias of `STORY_JUMPS` |
| `src/core/markdown.js` | 2 | the notes renderer, moved unchanged |
| `src/domain/felt-notes.js` | 2 | felt-it notes: validate, add, export |
| `src/fx/docs-overlay.js` | 3 | FunMap/roadmap/devlog/practices over the page |
| `src/fx/felt-capture.js` | 3 | the Felt it panel |
| `scripts/serve.mjs`, `scripts/build.mjs` | 3 | serve and ship `docs/FUNMAP.md` |
| `src/fx/jump-to.js` | 4 | finishing a story jump |
| `src/fx/shell-nav.js` | 4 | toggle, drawers, keys, tools, tuning |
| `src/main.js`, `index.html`, `labs.html`, `styles.css` | 3, 4 | mount the shell; retire the old nav |
| `src/td-tab.js` | 4 | two selector strings in the layout probe |
| `scripts/browser-test.mjs` | 4 | updated selectors, the `--nav` suite |
| `docs/STATE.md`, log entry | 5 | record what landed |

---

### Task 1: The menu as data and the pure navigation rules

**Files:**
- Create: `src/content/nav.js`, `src/core/nav-match.js`, `src/core/dev-mode.js`
- Modify: `src/fx/story-skips.js:6-11`
- Test: `test/nav-content.mjs`, `test/nav-match.mjs`, `test/dev-mode.mjs`

**Interfaces:**
- Produces:
  - `NAV_MODES: ['playtest','dev']`
  - `NAV_GROUPS: {mode, group, label}[]`
  - `NAV_ENTRIES: {id, label, title?, mode, group, row?, disabled?, target}[]`, where `target` is one of:
    - `{page, hash, params}`
    - `{url}`
    - `{doc}`
    - `{tool}`
  - `NAV_DOCS: {key, file, label, hint}[]`
  - `STORY_JUMPS: {id, label, title, url, wired}[]`
  - `activeEntry(entries, {page, hash, search}) → id|null`
  - `modeOf(entries, id) → mode|null`
  - `currentMode(entries, loc, {stored, devOn}) → 'playtest'|'dev'`
  - `placeLabel(entries, loc) → string`
  - `storyStage(search) → number`
  - `entryUrl(target, search, {enemies}) → 'page?query#hash'`
  - `MODE_SWITCHES`
  - `devModeOn({buildToken, search, stored}) → {on, store}`, where `store` is `'1'` (remember), `''` (forget) or `null` (leave alone)

- [ ] **Step 1: Read `src/core/story-route.js`** to learn `isStoryRoute(search)`. The tests below assume it returns true for `''` and for `?story=4&acceptance=1`. If it disagrees for a case, the function is the authority: change that one expectation and say so in your report.

- [ ] **Step 2: Write the failing tests**

`test/nav-content.mjs`:
```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAV_ENTRIES, NAV_GROUPS, NAV_MODES, NAV_DOCS, STORY_JUMPS } from '../src/content/nav.js';
import { STAGES } from '../src/content/base-layout.js';

const ids = NAV_ENTRIES.map((e) => e.id);
assert.equal(new Set(ids).size, ids.length, 'entry ids are unique');
for (const e of NAV_ENTRIES) {
  assert.ok(e.label && NAV_MODES.includes(e.mode), `${e.id}: label and mode`);
  assert.ok(NAV_GROUPS.some((g) => g.mode === e.mode && g.group === e.group), `${e.id}: group ${e.group} is declared for ${e.mode}`);
  const t = e.target;
  assert.equal(['page' in t, 'url' in t, 'doc' in t, 'tool' in t].filter(Boolean).length, 1, `${e.id}: exactly one target kind`);
  if ('url' in t && !e.disabled) assert.match(t.url, /^index\.html\?[^#]+#td$/, `${e.id}: a jump is a game URL`);
  if ('url' in t && e.disabled) assert.equal(t.url, null, `${e.id}: an unwired jump has no URL`);
}
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
for (const e of NAV_ENTRIES.filter((x) => x.group === 'workshop')) {
  assert.match(main, new RegExp(`\\n\\s+${e.target.hash}: \\(\\) => import`), `${e.id}: #${e.target.hash} is a route in main.js`);
}
assert.deepEqual(NAV_ENTRIES.filter((e) => e.row === 'stages').map((e) => e.label), STAGES.map((_, n) => String(n)), 'one stage button per stage');
assert.deepEqual(STORY_JUMPS.map((j) => j.id), ['rotor', 'quiver', 'study', 'gunship']);
for (const d of NAV_DOCS) assert.ok(readFileSync(new URL(`../${d.file}`, import.meta.url), 'utf8').length > 100, `${d.file} exists`);
assert.deepEqual(NAV_ENTRIES.filter((e) => e.mode === 'playtest' && !e.row).map((e) => e.id), ['story', 'defend', 'arrival', 'record', 'settings']);
assert.deepEqual(NAV_GROUPS.filter((g) => g.mode === 'dev').map((g) => g.group), ['workshop', 'tuning', 'docs', 'tools']);
console.log('Nav content: PLAYTEST and DEV entries are complete, labs are routes, jumps are game URLs, docs exist.');
```

`test/nav-match.mjs`:
```js
import assert from 'node:assert/strict';
import { NAV_ENTRIES } from '../src/content/nav.js';
import { activeEntry, currentMode, entryUrl, modeOf, placeLabel, storyStage } from '../src/core/nav-match.js';

const loc = (page, hash, search = '') => ({ page, hash, search });
const at = (...a) => activeEntry(NAV_ENTRIES, loc(...a));
assert.equal(at('/index.html', 'td'), 'story', 'a bare index.html is the story');
assert.equal(at('/', ''), 'story');
assert.equal(at('/index.html', 'td', '?story=4&acceptance=1'), 'story');
assert.equal(at('/index.html', 'td', '?story=8'), 'defend');
assert.equal(at('/index.html', 'td', '?world=story&stage=6&cine=0&acceptance=1&gunship=station&skip=gunship'), 'jump-gunship');
assert.equal(at('/index.html', 'td', '?classic=1'), 'story', 'retired classic links resolve to story');
assert.equal(at('/index.html', 'td', '?mission=rescue'), 'story', 'retired mission links resolve to story');
assert.equal(at('/index.html', 'record'), 'record');
assert.equal(at('/index.html', 'nowhere'), null);
assert.equal(at('/labs.html', 'beam'), 'lab-beam');
assert.equal(at('/labs.html', ''), 'lab-units');
assert.equal(at('/labs.html', 'portal'), 'lab-portal');
assert.equal(at('/labs.html', 'story', '?land=1'), 'arrival');
assert.equal(at('/labs.html', 'story'), 'lab-story');
assert.equal(at('/settings.html', ''), 'settings');

assert.equal(modeOf(NAV_ENTRIES, 'lab-sim'), 'dev');
assert.equal(modeOf(NAV_ENTRIES, 'defend'), 'playtest');
assert.equal(currentMode(NAV_ENTRIES, loc('/labs.html', 'beam')), 'dev', 'a lab loads in DEV');
assert.equal(currentMode(NAV_ENTRIES, loc('/index.html', 'td', '?story=1')), 'playtest', 'a story stage loads in PLAYTEST');
assert.equal(currentMode(NAV_ENTRIES, loc('/labs.html', 'beam'), { devOn: false }), 'playtest', 'no DEV on a release');
assert.equal(currentMode(NAV_ENTRIES, loc('/index.html', 'nowhere'), { stored: 'dev' }), 'dev', 'no match: the last mode used');

assert.equal(storyStage('?stage=6&story=2'), 6);
assert.equal(storyStage(''), 1);
assert.equal(placeLabel(NAV_ENTRIES, loc('/index.html', 'td', '?story=3')), 'story · stage 3');
assert.equal(placeLabel(NAV_ENTRIES, loc('/labs.html', 'portal')), 'lab · breach');
assert.equal(placeLabel(NAV_ENTRIES, loc('/index.html', 'td', '?skip=gunship&stage=6&world=story')), 'jump · gunship');
assert.equal(placeLabel(NAV_ENTRIES, loc('/index.html', 'nowhere')), '');

assert.equal(entryUrl({ page: 'index.html', hash: 'td', params: { story: '1' } }, '?sw=0&stage=6&skip=gunship&world=story&enemies=24'),
  'index.html?sw=0&story=1#td', 'leaving a mode drops its switches');
assert.equal(entryUrl({ url: 'index.html?world=story&stage=6&skip=gunship#td' }, '?sw=0', { enemies: 24 }),
  'index.html?sw=0&world=story&stage=6&skip=gunship&enemies=24#td');
assert.equal(entryUrl({ page: 'labs.html', hash: 'beam', params: {} }, '?story=4&sw=0'), 'labs.html?sw=0#beam');
assert.equal(entryUrl({ page: 'settings.html', hash: '', params: {} }, ''), 'settings.html');
console.log('Nav match: routes, modes, place labels and entry URLs hold.');
```

`test/dev-mode.mjs`:
```js
import assert from 'node:assert/strict';
import { devModeOn, SOURCE_TOKEN } from '../src/core/dev-mode.js';

assert.equal(SOURCE_TOKEN, '00000000');
assert.deepEqual(devModeOn({ buildToken: '00000000', search: '', stored: null }), { on: true, store: null }, 'on the source tree');
assert.deepEqual(devModeOn({ buildToken: 'a1b2c3d4', search: '', stored: null }), { on: false, store: null }, 'hidden on a release');
assert.deepEqual(devModeOn({ buildToken: 'a1b2c3d4', search: '?dev=1', stored: null }), { on: true, store: '1' }, '?dev=1 turns it on and remembers');
assert.deepEqual(devModeOn({ buildToken: 'a1b2c3d4', search: '', stored: '1' }), { on: true, store: null }, 'remembered');
assert.deepEqual(devModeOn({ buildToken: 'a1b2c3d4', search: '?dev=0', stored: '1' }), { on: false, store: '' }, '?dev=0 forgets');
assert.deepEqual(devModeOn({ buildToken: '00000000', search: '?dev=0', stored: null }), { on: true, store: '' }, 'the source tree is always dev');
assert.deepEqual(devModeOn({ buildToken: undefined, search: '', stored: null }), { on: false, store: null }, 'no token is a release');
console.log('Dev mode: source, release, ?dev=1 remembered, ?dev=0 forgotten.');
```

- [ ] **Step 3: Run them to see them fail**

Run: `node test/nav-content.mjs; node test/nav-match.mjs; node test/dev-mode.mjs`
Expected: each fails with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Write `src/content/nav.js`**

```js
// The navigation shell's menu as data: two modes, PLAYTEST (the sections under playtest) and DEV (labs, tuning, docs,
// tools). A target is { page, hash, params } to navigate, { url } for a story jump, { doc } for the docs overlay or
// { tool } for a tool. A new playtest section is one entry here. Tuning pages are read from the variables modal at
// runtime, so they are not listed.
import { STAGES } from './base-layout.js';

export const NAV_MODES = Object.freeze(['playtest', 'dev']);

// the story's jump points: a wired jump is a game URL whose skip=<id> the shell finishes once the game is ready
export const STORY_JUMPS = Object.freeze([
  { id: 'rotor', label: 'ROTOR', title: 'the opening: the foundry cuts the rocket into feedstock, Isao prints the Rotor and hands it over', url: 'index.html?world=story&stage=1#td', wired: true },
  { id: 'quiver', label: 'QUIVER', title: 'not wired yet: the hard cores and the Quiver hand-over', url: null, wired: false },
  { id: 'study', label: 'STUDY', title: 'not wired yet: Isao\'s vibration-language analysis', url: null, wired: false },
  { id: 'gunship', label: 'GUNSHIP', title: 'the gunship on station with the seat taken, enemies up and waves continuing', url: 'index.html?world=story&stage=6&cine=0&acceptance=1&gunship=station&skip=gunship#td', wired: true },
].map(Object.freeze));

export const NAV_DOCS = Object.freeze([
  { key: 'funmap', file: 'docs/FUNMAP.md', label: 'FunMap', hint: 'what is fun, lesson by lesson' },
  { key: 'roadmap', file: 'ROADMAP.md', label: 'Roadmap', hint: 'where this is going' },
  { key: 'devlog', file: 'DEVLOG.md', label: 'Devlog', hint: 'what happened' },
  { key: 'practices', file: 'PRACTICES.md', label: 'Practices', hint: 'what we learned' },
].map(Object.freeze));

export const NAV_GROUPS = Object.freeze([
  { mode: 'playtest', group: 'story', label: '' },
  { mode: 'playtest', group: 'defend', label: '' },
  { mode: 'playtest', group: 'arrival', label: '' },
  { mode: 'playtest', group: 'footer', label: '' },
  { mode: 'dev', group: 'workshop', label: 'Workshop' },
  { mode: 'dev', group: 'tuning', label: 'Tuning' },
  { mode: 'dev', group: 'docs', label: 'Docs' },
  { mode: 'dev', group: 'tools', label: 'Tools' },
].map(Object.freeze));

const LABS = [['units', 'units'], ['swarm', 'swarm'], ['beam', 'beam'], ['audio', 'audio'], ['metal', 'metal'], ['story', 'story'], ['sentry', 'sentry / impact'], ['portal', 'breach'], ['sim', 'sim']];

export const NAV_ENTRIES = Object.freeze([
  { id: 'story', label: 'Story', title: 'the story opening: land, print the Rotor, hold the gate', mode: 'playtest', group: 'story', target: { page: 'index.html', hash: 'td', params: { story: '1' } } },
  ...STAGES.map((s, n) => ({ id: `stage-${n}`, label: String(n), title: s.name, mode: 'playtest', group: 'story', row: 'stages', target: { page: 'index.html', hash: 'td', params: { story: String(n) } } })),
  ...STORY_JUMPS.map((j) => ({ id: `jump-${j.id}`, label: j.label, title: j.title, mode: 'playtest', group: 'story', row: 'jumps', disabled: !j.wired, target: { url: j.url } })),
  { id: 'defend', label: 'Defend', title: 'the finished base, the first hull rolls out of its bay', mode: 'playtest', group: 'defend', target: { page: 'index.html', hash: 'td', params: { story: '8' } } },
  { id: 'arrival', label: 'Arrival', title: 'the arrival cinematic: the SH02 lands and Isao comes out', mode: 'playtest', group: 'arrival', target: { page: 'labs.html', hash: 'story', params: { land: '1' } } },
  { id: 'record', label: 'Record', mode: 'playtest', group: 'footer', target: { page: 'index.html', hash: 'record', params: {} } },
  { id: 'settings', label: 'Settings', title: 'records backup and import', mode: 'playtest', group: 'footer', target: { page: 'settings.html', hash: '', params: {} } },
  ...LABS.map(([hash, label]) => ({ id: `lab-${hash}`, label, mode: 'dev', group: 'workshop', target: { page: 'labs.html', hash, params: {} } })),
  ...NAV_DOCS.map((d) => ({ id: `doc-${d.key}`, label: d.label, title: d.hint, mode: 'dev', group: 'docs', target: { doc: d.key } })),
  { id: 'tool-felt', label: 'Felt it', title: 'note a moment that was satisfying or needs work', mode: 'dev', group: 'tools', target: { tool: 'felt' } },
  { id: 'tool-link', label: 'Copy deep link', title: 'copy this board as a URL', mode: 'dev', group: 'tools', target: { tool: 'link' } },
  { id: 'tool-fps', label: 'Frame readout', title: 'the fps readout (backtick)', mode: 'dev', group: 'tools', target: { tool: 'fps' } },
  { id: 'tool-diagnostics', label: 'Export diagnostics', title: 'the last game\'s local event history as JSON', mode: 'dev', group: 'tools', target: { tool: 'diagnostics' } },
].map(Object.freeze));
```

- [ ] **Step 5: Write `src/core/nav-match.js`**

```js
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
```

- [ ] **Step 6: Write `src/core/dev-mode.js`**

```js
// Whether the DEV mode is offered. The source tree always offers it; a release offers it only after ?dev=1, which is
// remembered until ?dev=0. `store` tells the caller what to write: '1' remember, '' forget, null leave alone.
export const SOURCE_TOKEN = '00000000';

export function devModeOn({ buildToken, search, stored }) {
  const flag = new URLSearchParams(search).get('dev');
  const source = buildToken === SOURCE_TOKEN;
  if (flag === '0') return { on: source, store: '' };
  if (flag === '1') return { on: true, store: '1' };
  return { on: source || stored === '1', store: null };
}
```

- [ ] **Step 7: Point `src/fx/story-skips.js` at the moved list.** Replace lines 6-11 (the `export const STORY_SKIPS = Object.freeze([ … ]);` block) with:

```js
import { STORY_JUMPS as STORY_SKIPS } from '../content/nav.js';
export { STORY_SKIPS };
```

(The file is deleted in Task 4. This keeps a single copy of the list meanwhile.)

- [ ] **Step 8: Run the tests and the guard**

Run: `node test/nav-content.mjs && node test/nav-match.mjs && node test/dev-mode.mjs && npm test && npm run check`
Expected: the three print their success lines. `npm test` ends with `96 test programs passed.` `npm run check` passes.

- [ ] **Step 9: Commit**

```bash
git add src/content/nav.js src/core/nav-match.js src/core/dev-mode.js src/fx/story-skips.js test/nav-content.mjs test/nav-match.mjs test/dev-mode.mjs
git commit -F - <<'EOF'
Navigation shell, data and rules: PLAYTEST and DEV entries, the active entry and mode, entry URLs, when DEV is offered

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 2: The markdown renderer moves to core; felt-it notes

**Files:**
- Create: `src/core/markdown.js`, `src/domain/felt-notes.js`
- Modify: `src/labs/notes-tab.js:19-73` (its copy of the renderer is replaced by an import)
- Test: `test/markdown.mjs`, `test/felt-notes.mjs`

**Interfaces:**
- Produces:
  - `markdown(src) → html`
  - `escapeHtml(s) → string`
  - `FELT_KINDS`, `FELT_LESSONS`
  - `addNote(notes, {date, kind, text, lesson?}) → notes` (throws on invalid input)
  - `sanitiseNotes(raw) → notes` (never throws)
  - `toFunmapLines(notes) → string`
  - `toJson(notes) → string`

- [ ] **Step 1: Write the failing tests.** They pin the renderer's current output before the move.

`test/markdown.mjs`:
```js
import assert from 'node:assert/strict';
import { markdown, escapeHtml } from '../src/core/markdown.js';

assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
assert.equal(markdown('# Title'), '<h1>Title</h1>');
assert.equal(markdown('### Deep'), '<h3>Deep</h3>');
assert.equal(markdown('```\n<div>\n```'), '<pre><code>&lt;div&gt;</code></pre>', 'a fence stays visible, never becomes markup');
assert.equal(markdown('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
assert.equal(markdown('1. a\n2. b'), '<ol>\n<li>a</li>\n<li>b</li>\n</ol>');
assert.equal(markdown('a `c` **b** *e* ~~d~~ [l](u)'),
  '<p>a <code>c</code> <strong>b</strong> <em>e</em> <del>d</del> <a href="u" rel="noreferrer">l</a></p>');
assert.equal(markdown('| a | b |\n|---|---|\n| 1 | 2 |'),
  '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
assert.equal(markdown('> q'), '<blockquote>q</blockquote>');
assert.equal(markdown('---'), '<hr>');
assert.equal(markdown('line one\nline two'), '<p>line one line two</p>');
assert.equal(markdown('<b>x</b> & "q"'), '<p>&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;</p>', 'escaping runs before inline');
console.log('Markdown: headings, fences, lists, inline, tables, quotes, rules and escaping pinned.');
```

`test/felt-notes.mjs`:
```js
import assert from 'node:assert/strict';
import { FELT_KINDS, FELT_LESSONS, addNote, sanitiseNotes, toFunmapLines, toJson } from '../src/domain/felt-notes.js';

assert.deepEqual(FELT_KINDS, ['satisfying', 'needs-work']);
assert.equal(FELT_LESSONS.length, 21);
assert.equal(FELT_LESSONS[0], 'R1');
assert.equal(FELT_LESSONS.at(-1), 'M');
let notes = addNote([], { date: '2026-09-14', kind: 'satisfying', text: '  the rotor burst  ', lesson: 'R13' });
notes = addNote(notes, { date: '2026-09-14', kind: 'needs-work', text: 'amoeba deaths too loud' });
assert.deepEqual(notes, [
  { date: '2026-09-14', kind: 'satisfying', text: 'the rotor burst', lesson: 'R13' },
  { date: '2026-09-14', kind: 'needs-work', text: 'amoeba deaths too loud' },
]);
assert.throws(() => addNote([], { date: '14/09/2026', kind: 'satisfying', text: 'x' }), /date/);
assert.throws(() => addNote([], { date: '2026-09-14', kind: 'meh', text: 'x' }), /kind/);
assert.throws(() => addNote([], { date: '2026-09-14', kind: 'satisfying', text: '   ' }), /text/);
assert.throws(() => addNote([], { date: '2026-09-14', kind: 'satisfying', text: 'x', lesson: 'R21' }), /lesson/);
assert.throws(() => addNote([], { date: '2026-09-14', kind: 'satisfying', text: 'x'.repeat(501) }), /text/);
assert.equal(toFunmapLines(notes), '- 2026-09-14 · the rotor burst · R13\n- 2026-09-14 · needs work: amoeba deaths too loud');
assert.deepEqual(sanitiseNotes(toJson(notes)), notes, 'JSON round trip');
assert.deepEqual(sanitiseNotes('{not json'), []);
assert.deepEqual(sanitiseNotes(null), []);
assert.deepEqual(sanitiseNotes(JSON.stringify([notes[0], { date: 'x' }, 7, null, { ...notes[1], text: '' }])), [notes[0]], 'malformed entries are dropped, never thrown');
console.log('Felt notes: validation, FunMap lines and JSON round trip hold.');
```

- [ ] **Step 2: Run them to see them fail**

Run: `node test/markdown.mjs; node test/felt-notes.mjs`
Expected: `ERR_MODULE_NOT_FOUND` for both.

- [ ] **Step 3: Write `src/core/markdown.js`.** The body is moved unchanged from `src/labs/notes-tab.js` lines 19-73; only the exports and the name `escapeHtml` are new.

```js
// The small markdown subset the docs need: headings, lists, tables, fences, rules, quotes, and inline
// code/emphasis/strike/links. Enough for ROADMAP, DEVLOG, PRACTICES and the FunMap; a fuller parser is a dependency
// and this repo has none by choice. Moved unchanged from the workshop notes tab.
export const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const esc = escapeHtml;

// Inline pass runs AFTER escaping, so a fence containing <div> stays visible
// rather than becoming one.
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
}

export function markdown(src) {
  const out = [];
  const lines = src.split('\n');
  let i = 0, list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {                       // fenced code
      closeList(); i++;
      const buf = [];
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      closeList();
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      const head = cells(line); i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(cells(lines[i++]));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>`
        + body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') + '</tbody></table>');
      continue;
    }
    const hd = line.match(/^(#{1,6})\s+(.*)$/);
    if (hd) { closeList(); out.push(`<h${hd[1].length}>${inline(hd[2])}</h${hd[1].length}>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { closeList(); out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); i++; continue; }
    const li = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const want = /^\d/.test(li[1]) ? 'ol' : 'ul';
      if (list !== want) { closeList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${inline(li[2])}</li>`); i++; continue;
    }
    if (!line.trim()) { closeList(); i++; continue; }
    closeList();
    const buf = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|```|>|\s*\|)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  closeList();
  return out.join('\n');
}
```

- [ ] **Step 4: Make the notes tab use it.** In `src/labs/notes-tab.js`, delete lines 19-73 (the `const esc`, `function inline`, `function markdown` block). Add this line after the header comment, before `const DOCS`:

```js
import { markdown } from '../core/markdown.js';
```

- [ ] **Step 5: Write `src/domain/felt-notes.js`**

```js
// Felt-it notes: a dated line about a moment that was satisfying or needs work, optionally tagged with the FunMap
// lesson it speaks to (R1-R20, or M for Meier). Pure: storage and the clipboard belong to the capture panel.
export const FELT_KINDS = Object.freeze(['satisfying', 'needs-work']);
export const FELT_LESSONS = Object.freeze([...Array.from({ length: 20 }, (_, i) => `R${i + 1}`), 'M']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 500;

function problem(n) {
  if (!n || typeof n !== 'object') return 'a note';
  if (typeof n.date !== 'string' || !DATE.test(n.date)) return 'a YYYY-MM-DD date';
  if (!FELT_KINDS.includes(n.kind)) return 'a kind (satisfying or needs-work)';
  if (typeof n.text !== 'string' || !n.text.trim() || n.text.trim().length > MAX_TEXT) return `some text (1 to ${MAX_TEXT} characters)`;
  if (n.lesson !== undefined && n.lesson !== '' && !FELT_LESSONS.includes(n.lesson)) return 'a lesson of R1-R20 or M, or none';
  return null;
}

function clean(n) {
  const note = { date: n.date, kind: n.kind, text: n.text.trim() };
  if (n.lesson) note.lesson = n.lesson;
  return note;
}

export function addNote(notes, input) {
  const why = problem(input);
  if (why) throw Error(`A felt note needs ${why}.`);
  return [...notes, clean(input)];
}

export function sanitiseNotes(raw) {
  let value = raw;
  if (typeof raw === 'string') { try { value = JSON.parse(raw); } catch { return []; } }
  return Array.isArray(value) ? value.filter((n) => !problem(n)).map(clean) : [];
}

export const toFunmapLines = (notes) => notes
  .map((n) => `- ${n.date} · ${n.kind === 'needs-work' ? 'needs work: ' : ''}${n.text}${n.lesson ? ` · ${n.lesson}` : ''}`)
  .join('\n');

export const toJson = (notes) => JSON.stringify(notes, null, 2);
```

Check the thrown messages against the test patterns: the date problem contains `date`, the kind problem `kind`, the text problem `text`, the lesson problem `lesson`.

- [ ] **Step 6: Run the tests**

Run: `node test/markdown.mjs && node test/felt-notes.mjs && npm test && npm run check`
Expected: both success lines, then `98 test programs passed.`, and the check passes.

- [ ] **Step 7: Commit**

```bash
git add src/core/markdown.js src/domain/felt-notes.js src/labs/notes-tab.js test/markdown.mjs test/felt-notes.mjs
git commit -F - <<'EOF'
Navigation shell, pure parts: the docs markdown renderer moves to core unchanged and pinned; felt-it notes validate and export

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 3: The DEV screens: docs overlay and Felt it; the FunMap is served and shipped

**Files:**
- Create: `src/fx/docs-overlay.js`, `src/fx/felt-capture.js`
- Modify: `scripts/serve.mjs:26`, `scripts/build.mjs` (the `paths` file list), `styles.css` (append)
- Test: `npm run check`, `npm run build`, plus a Node syntax check. The browser coverage arrives in Task 4's `--nav` suite.

**Interfaces:**
- Consumes: `NAV_DOCS` (Task 1), `markdown` (Task 2), `FELT_KINDS`, `FELT_LESSONS`, `addNote`, `sanitiseNotes`, `toFunmapLines`, `toJson` (Task 2).
- Produces:
  - `openDocsOverlay(key) → {show(key), close(), element}`. The element is `#docs-overlay` (`role="dialog"`), wrapping `#notes` with `[data-doc]`, `[data-find]`, `.nt-toc`, `.nt-body` and `[data-close]`.
  - `openFeltCapture() → element`. The element is `#felt-capture` (`role="dialog"`), with:
    - `input[name=felt-kind]`, `[data-text]`, `[data-lesson]`, `[data-save]`, `[data-status]`
    - `[data-list]`, `[data-copy=md|json]`, `[data-export]`, `[data-close]`

- [ ] **Step 1: Write `src/fx/docs-overlay.js`.** It carries over the workshop notes tab's behaviour, including the section-hiding find and the contents rail. It reuses the `#notes` styles by wrapping them.

```js
// The docs over the current page: FunMap, roadmap, devlog and practices, fetched from the files they already are, so
// a `npm run log -- render` or an edit to docs/FUNMAP.md is the only way this ever changes. The page underneath keeps
// running. Esc or the close button hides it. Replaces the workshop's notes tab.
import { NAV_DOCS } from '../content/nav.js';
import { markdown } from '../core/markdown.js';

let overlay = null;

export function openDocsOverlay(key = NAV_DOCS[0].key) {
  if (!overlay) overlay = build();
  overlay.show(key);
  return overlay;
}

function build() {
  const el = document.createElement('div');
  el.id = 'docs-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'docs');
  el.innerHTML = `<div id="notes">
    <nav class="nt-rail">
      ${NAV_DOCS.map((d) => `<button type="button" data-doc="${d.key}"><b>${d.label}</b><span>${d.hint}</span></button>`).join('')}
      <label class="nt-find">find<input type="search" data-find placeholder="ram premium, sinkhole, …"></label>
      <div class="nt-toc" data-toc></div>
    </nav>
    <article class="nt-body" data-body><p class="nt-wait">loading…</p></article>
    <button type="button" class="docs-close" data-close title="close (Esc)">×</button>
  </div>`;
  document.body.append(el);
  const body = el.querySelector('[data-body]');
  const toc = el.querySelector('[data-toc]');
  const find = el.querySelector('[data-find]');
  const cache = new Map();
  let current = NAV_DOCS[0].key;

  async function load(key) {
    const doc = NAV_DOCS.find((d) => d.key === key);
    if (!cache.has(key)) {
      try {
        const r = await fetch(new URL(`../../${doc.file}`, import.meta.url));
        if (!r.ok) throw Error(String(r.status));
        cache.set(key, await r.text());
      } catch (e) {
        // a release that did not ship the file says so plainly rather than rendering an empty page
        cache.set(key, `# ${doc.label} unavailable\n\n\`${doc.file}\` could not be fetched (${e.message}). It is in the repository; this build did not ship it.`);
      }
    }
    if (current !== key) return;
    body.innerHTML = markdown(cache.get(key));
    buildToc();
    applyFind();
    body.scrollTop = 0;
  }

  function buildToc() {
    toc.innerHTML = [...body.querySelectorAll('h2')].map((h, n) => { h.id = `nt-${n}`; return `<a href="#nt-${n}" data-jump="${n}">${h.textContent}</a>`; }).join('');
  }
  toc.addEventListener('click', (e) => {
    const a = e.target.closest('[data-jump]'); if (!a) return;
    e.preventDefault();
    body.querySelector(`#nt-${a.dataset.jump}`)?.scrollIntoView({ block: 'start' });
  });

  // filtering hides whole sections rather than lines: an entry read without its context is a headline
  function applyFind() {
    const q = find.value.trim().toLowerCase();
    const blocks = [...body.children];
    if (!q) { for (const b of blocks) b.hidden = false; return; }
    let keep = false;
    blocks.forEach((b, i) => {
      if (/^H[12]$/.test(b.tagName) || i === 0) {
        const run = [b];
        for (let k = i + 1; k < blocks.length && !/^H[12]$/.test(blocks[k].tagName); k++) run.push(blocks[k]);
        keep = run.some((n) => n.textContent.toLowerCase().includes(q));
      }
      b.hidden = !keep;
    });
  }
  find.addEventListener('input', applyFind);

  el.querySelector('.nt-rail').addEventListener('click', (e) => {
    const b = e.target.closest('[data-doc]'); if (b) show(b.dataset.doc);
  });
  // typing in the find box is not a game key
  el.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  const close = () => { el.hidden = true; };
  el.querySelector('[data-close]').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);

  function show(key) {
    el.hidden = false; current = key;
    for (const o of el.querySelectorAll('[data-doc]')) o.classList.toggle('on', o.dataset.doc === key);
    load(key);
  }
  return { show, close, element: el };
}
```

- [ ] **Step 2: Write `src/fx/felt-capture.js`**

```js
// Felt it: note a moment that was satisfying or needs work, saved on this browser, copied out by hand for
// docs/FUNMAP.md. Nothing leaves the browser except by copy.
import { storage } from '../storage.js';
import { FELT_KINDS, FELT_LESSONS, addNote, sanitiseNotes, toFunmapLines, toJson } from '../domain/felt-notes.js';

const KEY = 'ssg.felt-notes';
let panel = null;

export function openFeltCapture() {
  if (!panel) panel = build();
  panel.hidden = false;
  panel.querySelector('[data-text]').focus();
  return panel;
}

function build() {
  const el = document.createElement('div');
  el.id = 'felt-capture'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'felt it');
  el.innerHTML = `<div class="felt-card">
    <button type="button" class="felt-close" data-close title="close (Esc)">×</button>
    <h3>Felt it</h3>
    <div class="felt-kind">${FELT_KINDS.map((k, i) => `<label><input type="radio" name="felt-kind" value="${k}"${i ? '' : ' checked'}> ${k === 'needs-work' ? 'needs work' : k}</label>`).join(' ')}</div>
    <textarea data-text rows="3" maxlength="500" placeholder="what happened, and how it felt"></textarea>
    <label>lesson <select data-lesson><option value="">none</option>${FELT_LESSONS.map((l) => `<option>${l}</option>`).join('')}</select></label>
    <p><button type="button" data-save>Save</button> <span data-status role="status"></span></p>
    <ul data-list></ul>
    <p><button type="button" data-copy="md">Copy markdown</button> <button type="button" data-copy="json">Copy JSON</button></p>
    <textarea data-export rows="4" readonly placeholder="the copied text also lands here, selected"></textarea>
  </div>`;
  document.body.append(el);
  const status = el.querySelector('[data-status]');
  const read = () => sanitiseNotes(storage.getItem(KEY));
  const renderList = () => {
    el.querySelector('[data-list]').replaceChildren(...read().map((n) => {
      const li = document.createElement('li'); li.textContent = toFunmapLines([n]).slice(2); return li;
    }));
  };
  el.querySelector('[data-save]').addEventListener('click', () => {
    try {
      const notes = addNote(read(), {
        date: new Date().toISOString().slice(0, 10),
        kind: el.querySelector('input[name="felt-kind"]:checked').value,
        text: el.querySelector('[data-text]').value,
        lesson: el.querySelector('[data-lesson]').value || undefined,
      });
      storage.setItem(KEY, toJson(notes));
      el.querySelector('[data-text]').value = '';
      status.textContent = 'saved';
      renderList();
    } catch (e) { status.textContent = e.message; }
  });
  for (const b of el.querySelectorAll('[data-copy]')) b.addEventListener('click', () => {
    const out = el.querySelector('[data-export]'), notes = read();
    out.value = b.dataset.copy === 'md' ? toFunmapLines(notes) : toJson(notes);
    out.focus(); out.select();   // the selection is the fallback where the clipboard refuses
    navigator.clipboard?.writeText(out.value).then(() => { status.textContent = 'copied'; }, () => { status.textContent = 'selected: copy it by hand'; });
  });
  // typing a note is not a game key
  el.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  const close = () => { el.hidden = true; };
  el.querySelector('[data-close]').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
  renderList();
  return el;
}
```

- [ ] **Step 3: Serve the FunMap.** The dev server hides `docs/`. In `scripts/serve.mjs`, change this line:

```js
    if (route.split('/').some(p => p.startsWith('.')) || /^(node_modules|docs|test|scripts|artifacts)\//.test(route)) { res.writeHead(404).end(); return; }
```
to:
```js
    if (route.split('/').some(p => p.startsWith('.')) || (/^(node_modules|docs|test|scripts|artifacts)\//.test(route) && route !== 'docs/FUNMAP.md')) { res.writeHead(404).end(); return; }   // the FunMap is the one doc the app reads
```

- [ ] **Step 4: Ship the FunMap.** In `scripts/build.mjs`, add `'docs/FUNMAP.md'` to the explicit file list after `'PRACTICES.md'`:

```js
  ...['index.html', 'labs.html', 'settings.html', 'styles.css', 'app.css', 'manifest.webmanifest', 'favicon.svg', 'sw.js', 'ATTRIBUTIONS.md', 'ROADMAP.md', 'DEVLOG.md', 'PRACTICES.md', 'docs/FUNMAP.md'].map(p => resolve(root, p))]
```

- [ ] **Step 5: Append the overlay and panel styles** to the end of `styles.css`:

```css
/* --- DEV SCREENS (src/fx/docs-overlay.js, src/fx/felt-capture.js): over the page, which keeps running --- */
#docs-overlay { position: fixed; inset: 0; z-index: 90; background: rgba(6, 10, 16, 0.97); }
#docs-overlay[hidden] { display: none; }
#docs-overlay #notes { position: relative; height: 100%; }
#docs-overlay .docs-close { position: absolute; top: 10px; right: 14px; z-index: 1; width: 40px; height: 36px; font: 700 18px ui-monospace, Menlo, monospace; color: #9fdcff; background: rgba(12, 26, 38, 0.85); border: 1px solid #2b6b96; border-radius: 8px; cursor: pointer; }
#felt-capture { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: rgba(6, 10, 16, 0.6); }
#felt-capture[hidden] { display: none; }
#felt-capture .felt-card { position: relative; width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box; padding: 16px; background: #0c1520; border: 1px solid #2b6b96; border-radius: 10px; color: #d2e9e5; font: 13px ui-monospace, Menlo, monospace; }
#felt-capture h3 { margin: 0 0 8px; }
#felt-capture textarea, #felt-capture select { width: 100%; box-sizing: border-box; margin: 6px 0; font: inherit; color: #dff4ff; background: #111b22; border: 1px solid #2b6b96; border-radius: 6px; }
#felt-capture button { font: inherit; color: #9fdcff; background: rgba(12, 26, 38, 0.85); border: 1px solid #2b6b96; border-radius: 6px; padding: 8px 10px; min-height: 36px; cursor: pointer; }
#felt-capture .felt-close { position: absolute; top: 8px; right: 8px; }
```

- [ ] **Step 6: Check and build**

Run: `node --check src/fx/docs-overlay.js && node --check src/fx/felt-capture.js && npm test && npm run check && npm run build && test -f dist/docs/FUNMAP.md && curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8155/docs/FUNMAP.md`
Expected: `98 test programs passed.`, check passes, the build prints its line, and the file exists in `dist`.

The curl only means something if a dev server on 8155 was restarted after Step 3. If one is running from before, leave it alone and skip the curl; Task 4's `--nav` suite starts its own server and covers the fetch.

- [ ] **Step 7: Commit**

```bash
git add src/fx/docs-overlay.js src/fx/felt-capture.js scripts/serve.mjs scripts/build.mjs styles.css
git commit -F - <<'EOF'
Navigation shell, DEV screens: the docs overlay (FunMap, roadmap, devlog, practices) and Felt it; the FunMap is served and shipped

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 4: The shell goes in, the old navigation comes out

**Files:**
- Create: `src/fx/shell-nav.js`, `src/fx/jump-to.js`
- Delete: `src/fx/story-skips.js`, `src/labs/notes-tab.js`
- Modify:
  - `src/main.js`: imports, SW button, notes redirect, routes, lines 79-113
  - `index.html:34`
  - `labs.html:23,26`
  - `styles.css`
  - `src/td-tab.js:11829,11841`
  - `scripts/browser-test.mjs`: lines 262-263, 392-395 and 654, plus a new `--nav` branch
- Test: the browser suites default, `--gunship`, `--story-world`, `--nav`, `--nav --dist`

**Interfaces:**
- Consumes:
  - Task 1: `NAV_ENTRIES`, `NAV_GROUPS`, `activeEntry`, `currentMode`, `placeLabel`, `entryUrl`, `storyStage`, `devModeOn`
  - Task 3: `openDocsOverlay(key)`, `openFeltCapture()`
  - existing: `storage` (`src/storage.js`), `downloadJSON(value, filename)` (`src/diagnostics.js`)
- Produces:
  - `mountShellNav({navigate, buildText, query}) → {setMode, setOpen, dispose}`
  - DOM: `#shell-bar` (`.shell-toggle [data-mode=playtest|dev].current`, `.shell-place`, `#build-tag`) and `#shell-nav` (sections `[data-mode]`, `[data-group]`, `[data-entry].active`, `[data-tool]`, `[data-count]`, `[data-tuning]`)
  - `body.shell-open`
  - `finishJump({query, count}) → {dispose}`, `raiseEnemies(n) → boolean`, `DEFAULT_ENEMIES = 30`

- [ ] **Step 1: Find how the frame readout toggles.** Read `src/td-tab.js` around line 1490 to learn which object the backtick `keydown` listener is attached to (`addEventListener`, `window`, `document`, or the tab root). The `fps` tool in Step 3 dispatches a synthetic key on that same target. If it is not `document` or `window`, dispatch on `document.getElementById('tab-td')`. Record what you found in the report.

- [ ] **Step 2: Write `src/fx/jump-to.js`.** The finishing logic moves from `story-skips.js`.

```js
// Finishing a story jump: a page opened with skip=<id> waits for the game's acceptance hooks, then does what a URL
// alone cannot (takes the gunship seat, raises the enemies, keeps the waves coming while the platform is overhead).
export const DEFAULT_ENEMIES = 30;
const hooks = () => window.__stalheartTest;

export function raiseEnemies(n) {
  const h = hooks();
  if (!h?.spawnFodder) return false;
  h.spawnFodder(n);
  return true;
}

export function finishJump({ query, count, poll = 250 }) {
  const skip = query.get('skip');
  if (!skip) return { dispose() {} };
  const enemies = Math.max(0, parseInt(query.get('enemies') ?? DEFAULT_ENEMIES, 10) || 0);
  let tries = 0, timer = 0, waves = 0, disposed = false;
  const finish = () => {
    if (disposed) return;
    const h = hooks();
    if (!h || !(h.state?.().storyLod || []).some((l) => l.id === 'stalheart')) { if (tries++ < 600) timer = setTimeout(finish, poll); return; }
    if (skip !== 'gunship') return;
    timer = setTimeout(() => {
      if (enemies) h.spawnFodder?.(enemies);
      h.mountGunship?.();
      if (query.get('brief') === '0') document.querySelector('#gunship-briefing [data-skip]')?.click();   // brief=0 goes straight to the seat
    }, 800);
    // continuous waves while the platform is overhead: another batch whenever the field thins below twice the count
    waves = setInterval(() => { const g = hooks(), s = g?.state?.(); if (s?.gunship?.station && (s.performance?.enemies ?? 0) < count() * 2) g.spawnFodder?.(count()); }, 6000);
  };
  finish();
  return { dispose() { disposed = true; clearTimeout(timer); clearInterval(waves); } };
}
```

- [ ] **Step 3: Write `src/fx/shell-nav.js`**

```js
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
```

Replace `document.dispatchEvent` in the `fps` tool if Step 1 found the listener on another target.

- [ ] **Step 4: Rewire `src/main.js`**

1. Imports: delete `import { STAGES } from './content/base-layout.js';` and `import { createStorySkips } from './fx/story-skips.js';`. Add `import { mountShellNav } from './fx/shell-nav.js';`.
2. The update button: in the service-worker callback, change `const nav = document.getElementById('tabbar');` to `const nav = document.getElementById('shell-bar');`.
3. In `routes`, delete the line `  notes: () => import('./labs/notes-tab.js').then(m => m.initNotesTab),`.
4. After the line `const name = location.hash.slice(1) || (workshop ? 'units' : 'td');`, insert:
```js
// the retired roadmap tab: the workshop opens with the docs overlay on the roadmap
if (workshop && name === 'notes') { const to = new URL(location.href); to.hash = 'units'; to.searchParams.set('doc', 'roadmap'); location.replace(to.href); }
```
5. Delete everything from `  for (const b of document.querySelectorAll('#tabbar button')) {` through `  document.body.append(menu);`. That is the tab loop, the story stage strip, the story skips, the build tag and the ☰ button, lines 79-113. Put this in their place:
```js
  // THE NAVIGATION SHELL: PLAYTEST | DEV top right with the build tag, one drawer per mode (src/fx/shell-nav.js)
  const build = document.querySelector('meta[name="cb"]')?.content, rev = document.querySelector('meta[name="rev"]')?.content;
  mountShellNav({ navigate, query: q, buildText: [build && build !== '00000000' ? `build ${build}` : 'dev', rev].filter(Boolean).join(' · ') });
```
6. Keep the `gesturestart` loop and everything after it.

- [ ] **Step 5: Retire markup and modules**
- `index.html`: delete line 34 (`<nav id="tabbar">…</nav>`). Keep `#vars-toggle` and `#td-link`: the CSS hides them, `td-tab.js` still wires them, and the shell's link tool clicks `#td-link`.
- `labs.html`: delete line 23 (`<nav id="tabbar">…</nav>`) and line 26 (`<div id="tab-notes" class="tab tab-hidden"></div>`).
- `git rm src/fx/story-skips.js src/labs/notes-tab.js`.
- `src/td-tab.js` line 11829: change `menu: '#chrome-toggle',` to `menu: '#shell-bar',`. Line 11841: change the whole line to `        tabbar: '#shell-nav',   // the navigation drawer: closed during play, never over the board`. The line count stays the same.

- [ ] **Step 6: Retire the old nav styles and add the shell's.** In `styles.css`:
- Delete every rule whose selector names only retired pieces:
  - `#tabbar` (including `#tabbar button`, `.tabgroup`, `.tabgroup-name` and `.nav-home`)
  - `#chrome-toggle`
  - `#story-stages-nav`
  - `#story-skips`
  - `#vars-toggle`
  - `#td-link`
- In a selector list that also names something else (for example `body:not(.chrome-open) #tabbar, body:not(.chrome-open) #cb-badge, body:not(.chrome-open) .tab .lil-gui.root`), remove only the retired selectors. Rewrite `body:not(.chrome-open)` on the survivors as `body`: nothing toggles `chrome-open` any more, and "not open" was their default. Remove selectors that need `.chrome-open` to match.
- Replace the old `#build-tag { position: fixed; … }` rule with `#build-tag { font: 600 10px ui-monospace, Menlo, monospace; letter-spacing: 0.06em; color: #6fa8c8; background: rgba(8, 14, 20, 0.7); border: 1px solid #234c68; border-radius: 6px; padding: 2px 6px; pointer-events: none; }`.
- Verify: `grep -n "#tabbar\|#chrome-toggle\|chrome-open\|#story-stages-nav\|#story-skips\|#vars-toggle\|#td-link" styles.css` prints nothing.
- Append:

```css
/* --- THE NAVIGATION SHELL (src/fx/shell-nav.js): PLAYTEST | DEV top right, joined to the build tag --- */
#shell-bar { position: fixed; top: max(8px, env(safe-area-inset-top)); right: max(8px, env(safe-area-inset-right)); z-index: 80; display: flex; align-items: center; gap: 8px; font: 600 11px ui-monospace, Menlo, monospace; letter-spacing: 0.06em; }
#shell-bar .shell-toggle { display: flex; border: 1px solid #2b6b96; border-radius: 8px; overflow: hidden; background: rgba(8, 14, 20, 0.85); }
#shell-bar .shell-toggle button { font: inherit; color: #6fa8c8; background: none; border: 0; padding: 8px 12px; min-height: 36px; cursor: pointer; touch-action: manipulation; }
#shell-bar .shell-toggle button + button { border-left: 1px solid #2b6b96; }
#shell-bar .shell-toggle button.current { color: #dff4ff; background: rgba(40, 90, 120, 0.95); }
#shell-bar .shell-place { color: #9fdcff; background: rgba(8, 14, 20, 0.7); border-radius: 6px; padding: 2px 6px; }
#shell-bar .shell-place:empty { display: none; }
#shell-nav { position: fixed; top: calc(max(8px, env(safe-area-inset-top)) + 46px); right: max(8px, env(safe-area-inset-right)); z-index: 80; box-sizing: border-box; width: min(340px, calc(100vw - 16px)); max-height: calc(100vh - 70px); overflow-y: auto; padding: 10px; background: rgba(10, 16, 26, 0.96); border: 1px solid #2a3350; border-radius: 10px; font: 12px ui-monospace, Menlo, monospace; color: #aab8dd; }
#shell-nav[hidden], #shell-nav [hidden] { display: none !important; }
#shell-nav .shell-group { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 0; border-bottom: 1px solid #1d2438; }
#shell-nav .shell-group:last-child { border-bottom: 0; }
#shell-nav h3 { width: 100%; margin: 2px 0; font: 600 10px ui-monospace, Menlo, monospace; letter-spacing: 0.12em; text-transform: uppercase; color: #6a789c; }
#shell-nav button { font: inherit; color: #9fdcff; background: rgba(12, 26, 38, 0.85); border: 1px solid #2b6b96; border-radius: 6px; cursor: pointer; touch-action: manipulation; }
#shell-nav .shell-big { flex: 1 1 100%; text-align: left; padding: 10px 12px; min-height: 44px; }
#shell-nav [data-group="footer"] .shell-big { flex: 1 1 0; }
#shell-nav .shell-small { min-width: 36px; min-height: 36px; padding: 4px 8px; }
#shell-nav .shell-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; width: 100%; }
#shell-nav .shell-row > span { width: 56px; color: #6a789c; }
#shell-nav button.active { color: #dff4ff; background: rgba(40, 90, 120, 0.95); border-color: #6fc3ff; }
#shell-nav button:disabled { opacity: 0.35; cursor: default; }
#shell-nav .shell-count { display: flex; align-items: center; gap: 6px; width: 100%; }
#shell-nav .shell-count input { width: 64px; font: inherit; color: #dff4ff; background: rgba(12, 26, 38, 0.85); border: 1px solid #2b6b96; border-radius: 6px; padding: 6px; }
body.playing:not(.shell-open) #shell-bar { opacity: 0.32; }
#vars-toggle, #td-link { display: none !important; }
```

- [ ] **Step 7: Update the existing browser assertions** in `scripts/browser-test.mjs`:
- Line 262: `#story-skips [data-skip=gunship]` → `#shell-nav [data-entry=jump-gunship]`, message `'the drawer marks the jump we came from'`.
- Line 263: `document.querySelector("#story-skips [data-more]").click()` → `document.querySelector("#shell-nav [data-tool=raise]").click()`.
- Lines 392, 394 and 395: every `#tabbar [data-story]` → `#shell-nav [data-entry=story]`. The line 392 message becomes `'the drawer marks story as the active entry'`.
- Line 654: `await go('notes-roadmap','labs.html?sw=0&acceptance=1#notes');` → `await go('docs-roadmap','labs.html?sw=0&acceptance=1&dev=1&doc=roadmap#units');`. Update the comment block above it to say the docs open as the DEV overlay. The `#notes …` selectors below keep working because the overlay wraps `#notes`.
- Grep for leftovers: `grep -n "tabbar\|story-skips\|chrome-toggle\|#notes\b" scripts/browser-test.mjs`. Only the docs-roadmap block's `#notes .nt-…` selectors may remain.

- [ ] **Step 8: Add the `--nav` suite.** Insert this branch immediately before the line `} else if(args.includes('--story-world')) {`:

```js
 } else if(args.includes('--nav')) {
 // THE NAVIGATION SHELL: PLAYTEST | DEV on every screen, the drawer by toggle and backslash, an Esc that never reaches
 // the game, tuning and docs over a running game without navigating, a felt-it note that survives a reload
 const key=async(k,code)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code});await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code});await delay(250);};
 const visible=sel=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;const r=e.getBoundingClientRect();return getComputedStyle(e).display!=="none"&&r.width>0&&r.height>0;})()`);
 const open=()=>evaluate('document.body.classList.contains("shell-open")');
 await go('nav-game','index.html?sw=0&acceptance=1&story=1#td');await until('!!window.__stalheartTest',90000);await delay(1500);
 assert(await visible('#shell-bar .shell-toggle'),'the toggle is on the game');
 assert(await evaluate('!!document.querySelector("#shell-bar #build-tag")'),'the build tag is joined to the toggle');
 assert(!(await visible('#vars-toggle'))&&!(await visible('#td-link'))&&!(await evaluate('!!document.querySelector("#tabbar,#chrome-toggle,#story-skips")')),'no tab bar, menu, gear, link or skip panel remains');
 assert.equal(await evaluate('document.querySelector("#shell-bar [data-mode=playtest]").classList.contains("current")'),true,'a story stage loads in PLAYTEST');
 assert.equal(await evaluate('!!document.querySelector("#shell-bar [data-mode=dev]")'),!production,'DEV is offered on the source tree and hidden on a release');
 const href=await evaluate('location.href');
 await key('\\','Backslash');assert(await open(),'backslash opens the drawer');
 assert(await visible('#shell-nav [data-entry=story].active'),'the drawer marks where we are');
 await evaluate('window.__escSeen=0;document.addEventListener("keydown",e=>{if(e.key==="Escape")window.__escSeen++;})');
 await key('Escape','Escape');assert.equal(await open(),false,'Esc closes the drawer');assert.equal(await evaluate('window.__escSeen'),0,'the Esc that closed the drawer never reached the game');
 await finish();
 if(!production){
  await click('#shell-bar [data-mode=dev]');await delay(300);
  assert(await visible('#shell-nav section[data-mode=dev]')&&!(await visible('#shell-nav section[data-mode=playtest]')),'DEV opens its own drawer');
  await click('#shell-bar [data-mode=playtest]');await delay(300);
  assert(await visible('#shell-nav section[data-mode=playtest]')&&await open(),'PLAYTEST opens its drawer again');
  assert.equal(await evaluate('location.href'),href,'switching modes never navigates');
  current='nav-switch';await finish();
  await click('#shell-bar [data-mode=dev]');await delay(300);await until('!!document.querySelector("#shell-nav [data-tuning=bloom]")');
  await click('#shell-nav [data-tuning=bloom]');await delay(300);
  assert(await evaluate('document.body.classList.contains("vars-open")'),'DEV · Tuning · bloom opens the variables');
  assert.equal(await evaluate('document.querySelector("#td-vars .vars-nav button.active").textContent'),'bloom','on its bloom page');
  await evaluate('document.querySelector("#td-vars .vars-page.active input").focus()');await key('\\','Backslash');
  assert.equal(await open(),false,'a backslash typed into a variable does not open the drawer');
  current='nav-tuning';await finish();
  await evaluate('document.body.classList.remove("vars-open");document.activeElement?.blur()');
  await click('#shell-bar [data-mode=dev]');await delay(300);
  await click('#shell-nav [data-entry=doc-funmap]');await until('document.querySelectorAll("#docs-overlay .nt-body h2").length>2');
  assert(!(await evaluate('document.querySelector("#docs-overlay").textContent.includes("unavailable")')),'the FunMap was fetched');
  assert.equal(await evaluate('location.href'),href,'the docs open over the game without navigating');
  current='nav-funmap';await finish();
  await key('Escape','Escape');assert(await evaluate('document.querySelector("#docs-overlay").hidden'),'Esc closes the docs');
  await click('#shell-bar [data-mode=dev]');await delay(300);await click('#shell-nav [data-entry=tool-felt]');await until('!!document.querySelector("#felt-capture:not([hidden])")');
  await evaluate('(()=>{document.querySelector("#felt-capture [data-text]").value="the first rotor burst felt great";document.querySelector("#felt-capture [data-lesson]").value="R13";})()');
  await click('#felt-capture [data-save]');await delay(200);
  await go('nav-felt-reload','index.html?sw=0&acceptance=1&story=1#td');await delay(1500);
  await click('#shell-bar [data-mode=dev]');await delay(300);await click('#shell-nav [data-entry=tool-felt]');await until('!!document.querySelector("#felt-capture:not([hidden])")');
  assert(await evaluate('document.querySelector("#felt-capture [data-list]").textContent.includes("the first rotor burst felt great")'),'a felt-it note survives a reload');
  await click('#felt-capture [data-copy=md]');await delay(200);
  assert.match(await evaluate('document.querySelector("#felt-capture [data-export]").value'),/^- \d{4}-\d{2}-\d{2} · the first rotor burst felt great · R13$/m,'it copies as a FunMap line');
  await finish();
  await go('nav-lab','labs.html?sw=0#beam');await delay(1000);
  assert.equal(await evaluate('document.querySelector("#shell-bar [data-mode=dev]").classList.contains("current")'),true,'a workshop lab loads in DEV');
  await click('#shell-bar [data-mode=dev]');await delay(300);
  assert(!(await visible('#shell-nav [data-group=tuning]')),'no tuning where the page has no variables');
  await finish();
 } else {
  await go('nav-dist-dev','index.html?sw=0&acceptance=1&story=1&dev=1#td');await delay(1000);
  assert(await evaluate('!!document.querySelector("#shell-bar [data-mode=dev]")'),'?dev=1 offers DEV on a release');await finish();
  await go('nav-dist-remembered','index.html?sw=0&acceptance=1&story=1#td');await delay(1000);
  assert(await evaluate('!!document.querySelector("#shell-bar [data-mode=dev]")'),'and remembers it');await finish();
 }
```

In `nav-lab`, clicking DEV when it is already current toggles its drawer open, which the assertion needs.

- [ ] **Step 9: Run everything.** Check memory first. Run the browser suites one at a time.

Run: `npm test && npm run check && npm run build`
Expected: `98 test programs passed.` (the retired notes tab had no test of its own). Check passes. Build prints its line.

Then, one at a time:
- `node scripts/browser-test.mjs --nav` → ends `Browser acceptance passed (source).`
- `node scripts/browser-test.mjs --nav --dist` → passes (serves `dist`).
- `node scripts/browser-test.mjs --gunship` → passes.
- `node scripts/browser-test.mjs --story-world` → passes. Its known flaky steps are story-world-rotor-kill and story-world-cleared; rerun once on those before concluding anything.
- `node scripts/browser-test.mjs` → passes. The `mobile-input` scenario logs a `LAYOUT` report; if it asserts on clashes involving `menu` or `tabbar`, adjust the `#shell-bar` placement in `styles.css`, not the assertion.
- `node scripts/browser-test.mjs --dist` → passes.

Open `artifacts/browser/nav-game.png`, `nav-switch.png`, `nav-tuning.png` and `nav-funmap.png`. Confirm the toggle and the build tag sit together top right without overlapping, and that the drawer is readable.

- [ ] **Step 10: Commit**

```bash
git add -A src/fx/shell-nav.js src/fx/jump-to.js src/main.js index.html labs.html styles.css src/td-tab.js scripts/browser-test.mjs
git add -u src/fx/story-skips.js src/labs/notes-tab.js
git commit -F - <<'EOF'
Navigation shell in: PLAYTEST | DEV top right with the build tag, one drawer per mode, tuning and docs under DEV; the tab bars, stage strip, skip panel and corner buttons retire

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 5: Record it

**Files:**
- Modify: `docs/STATE.md`
- Create: `docs/log/entries/2026-09-14-navigation-shell-landed.json`
- Generated: `DEVLOG.md`, `ROADMAP.md`

- [ ] **Step 1: Find stale mentions.** Run `grep -rn "story-skips\|notes-tab\|#notes\|tab bar\|tabbar\|skip to\b" docs/*.md AGENTS.md README.md`. Fix each current-state mention to describe the shell (`src/fx/shell-nav.js`, the `PLAYTEST | DEV` toggle, DEV · Docs). Do not touch `docs/log/entries/`, `docs/archive/` or `docs/superpowers/`.

- [ ] **Step 2: Update `docs/STATE.md`.**
- In "Working baseline", replace `the roadmap/devlog notes tab` with `the docs overlay (FunMap, roadmap, devlog, practices) under DEV`.
- Replace priority item 1 with:
```markdown
1. **Navigation shell landed** (`2026-09-14-navigation-shell-landed`): `PLAYTEST | DEV` top right on every game and workshop page with the build tag; PLAYTEST holds Story (stages, jumps), Defend, Arrival, Record, Settings; DEV holds the labs, the variables pages (Tuning), the docs over the page and Felt it. Next: use it in the seat and prune what nobody opens.
```

- [ ] **Step 3: Write the log entry.** Copy `schema` from `docs/log/entries/2026-09-14-explosions-flir-amoeba-landed.json`, then write `docs/log/entries/2026-09-14-navigation-shell-landed.json`:

```json
{
  "schema": "COPY THE schema VALUE FROM THE ENTRY NAMED ABOVE",
  "id": "2026-09-14-navigation-shell-landed",
  "date": "2026-09-14",
  "type": "decision",
  "status": "accepted",
  "title": "Navigation is two modes, PLAYTEST and DEV, one click apart on every screen",
  "context": "The owner, after playing the gunship: the flat story/defend/arrival/record/settings/workshop row was confusing, the variables panel had no meaningful home, and the skip panel collided with the build tag. They asked for a higher level first: DEV for workshops, roadmap, FunMap and labs; PLAYTEST for the sections under playtest; either reachable from anywhere.",
  "outcome": "src/fx/shell-nav.js renders an always-visible PLAYTEST | DEV toggle joined to the build tag and one drawer per mode from src/content/nav.js. Switching modes never navigates. DEV holds the workshop labs, Tuning (the variables modal's pages), the docs overlay (FunMap, roadmap, devlog, practices) and tools (Felt it, copy deep link, frame readout, diagnostics, the jump enemy count). DEV is automatic on the source tree and hidden on a release unless ?dev=1. Backslash toggles the drawer; Esc closes it without reaching the game. The tab bars, the stage strip, the skip panel, the notes tab and the corner menu, gear and link buttons retired.",
  "alternatives": "Two tabs inside one drawer behind a single menu button (cleaner during play, one more step to switch); a player face and a dev face in one long drawer (the first spec, before the owner's higher-level ask).",
  "evidence": "npm test, npm run check, npm run build; browser --nav, --nav --dist, --gunship, --story-world, default and --dist passed.",
  "supersedes": []
}
```

Replace the `schema` placeholder string with the real value before running the command below. If the copied entry's `type`, `status` or `supersedes` use a different vocabulary, match it, and say so in the report.

- [ ] **Step 4: Validate and render**

Run: `npm run log -- add docs/log/entries/2026-09-14-navigation-shell-landed.json && npm run log -- render && npm run check`
Expected: the entry validates, DEVLOG and ROADMAP regenerate, and the check passes.

If `add` expects the file somewhere else (it copies it in), follow its usage message and keep exactly one copy under `docs/log/entries/`.

- [ ] **Step 5: Commit**

```bash
git add docs/STATE.md docs/log/entries/2026-09-14-navigation-shell-landed.json DEVLOG.md ROADMAP.md
git add -u docs AGENTS.md README.md
git commit -F - <<'EOF'
Deban sync: the navigation shell landed (PLAYTEST | DEV); STATE and the stale nav mentions updated

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```
