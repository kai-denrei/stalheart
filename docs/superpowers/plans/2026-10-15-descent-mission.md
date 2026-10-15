# THE DESCENT — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the standalone cave game (`~/Dev/stalheart-cave`) plays as the campaign's last mission, inside the game page, after BOTH WALLS is secured and before THE ENDING; its outcome shapes the ending and Isao's decoding joke closes it.

**Architecture:** the cave is vendored under `below/` from a pinned commit (`scripts/import-below.mjs`, a lock file) and served as static files beside the game; a `stalheart` mode in the cave posts its outcome to the parent window; `src/fx/descent-host.js` opens it in an iframe over the paused game and continues the sector loop's finale with the outcome; pure rules in `src/domain/descent.js`; content in `src/content/descent.js`.

**Tech Stack:** the game's modules, an iframe + `postMessage`, node tests, the browser harness.

**Spec:** `docs/superpowers/specs/2026-10-15-descent-mission-design.md`.

## Global Constraints

- `src/td-tab.js` ceiling 6,400 lines, long-line budget 0 (`npm run check`); domain imports no content; never edit `src/` while a browser suite serves the tree; `node --check` every edit.
- The cave's code changes are made in `~/Dev/stalheart-cave` and committed there (its own `npm test`, `npm run check`), then imported; `below/` in stalheart is never edited by hand.
- Captions for Isao until the owner records (`~/Dev/seiyu_voice/ISAO-VOICE-LINES.md` section 17).
- `/deban` entry and STATE.md at the end; Telegram when it lands.

---

### Task 1: the cave's `stalheart` mode (in `~/Dev/stalheart-cave`)

**Files:**
- Modify: `~/Dev/stalheart-cave/src/main.js`, `~/Dev/stalheart-cave/index.html`
- Test: `~/Dev/stalheart-cave/test/stalheart-mode.test.mjs` (node --test; the repo's `npm test` runs `test/*.test.mjs`)

**Interface (produces):** with `?stalheart=1`: no briefing screen (the HUD shows a one-line "CLICK TO TAKE THE FEED" overlay that starts on click: the audio context needs a gesture); the ending's primary button reads RETURN TO THE SURFACE and calls `window.parent.postMessage({ below: mission.outcome }, '*')`; for `lost` the button reads TRY AGAIN and restarts (no message); the wordmark link is hidden. A pure helper `endingAction(outcome, stalheart) -> { label, action: 'return' | 'restart' }` in a new `src/handoff.js` is what the test covers.

- [ ] **Step 1: the failing test**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { endingAction, parseMode } from '../src/handoff.js';
test('stalheart mode returns outcomes to the parent', () => {
  assert.deepEqual(endingAction('rescued', true), { label: 'RETURN TO THE SURFACE', action: 'return' });
  assert.deepEqual(endingAction('sacrifice', true), { label: 'RETURN TO THE SURFACE', action: 'return' });
  assert.deepEqual(endingAction('lost', true), { label: 'TRY AGAIN', action: 'restart' });
  assert.deepEqual(endingAction('rescued', false), { label: 'PLAY AGAIN', action: 'restart' });
  assert.equal(parseMode('?stalheart=1'), true); assert.equal(parseMode('?test'), false);
});
```
- [ ] **Step 2:** `npm test` in the cave repo → FAIL. **Step 3:** `src/handoff.js`:

```js
export const parseMode = (search) => new URLSearchParams(search).get('stalheart') === '1';
export function endingAction(outcome, stalheart) {
  if (!stalheart) return { label: 'PLAY AGAIN', action: 'restart' };
  return outcome === 'lost' ? { label: 'TRY AGAIN', action: 'restart' } : { label: 'RETURN TO THE SURFACE', action: 'return' };
}
export const postOutcome = (outcome) => { try { window.parent?.postMessage({ below: outcome }, '*'); } catch { /* no parent */ } };
```
- [ ] **Step 4:** in `main.js`: `const stalheart = parseMode(location.search)`; in `end(outcome)` set the ending button's text from `endingAction` and bind `return` → `postOutcome(outcome)`, `restart` → `start`; at boot when `stalheart`: hide `#briefing`, hide the wordmark link (`.wordmark` → `hidden`), show a `#take-feed` overlay (new in `index.html`, one line) whose click calls `start()`. Read `main.js` lines 26-70 and 172 (the button bindings) first; keep the existing `restart` buttons for the pause screen.
- [ ] **Step 5:** `npm run check` (add `src/handoff.js` to the check line), `npm test`, `npm start` and open `http://localhost:5186/?stalheart=1` by hand once (the overlay, the click, the feed); commit in the cave repo: `git commit -am "stalheart mode: no briefing, the ending returns its outcome to the parent window"`.

### Task 2: the import and the build (stalheart)

**Files:**
- Create: `scripts/import-below.mjs`, `test/import-below.mjs`
- Modify: `scripts/build.mjs` (copy `below/` to `dist/below/`), `.gitattributes`/`.gitignore` nothing (the vendored copy is committed, as the voice mp3s are)
- Create (by the script): `below/` and `below/BELOW.lock.json`

**Interface:** `node scripts/import-below.mjs [path]` (default `../stalheart-cave`): refuses a dirty tree (`git status --porcelain` non-empty), copies `index.html`, `src/`, `vendor/`, `assets/`, `ASSETS.md`, `assets.lock.json` into `below/` (the folder emptied first), writes `below/BELOW.lock.json` `{ source: 'kai-denrei/stalheart-cave', commit, date, files: n, bytes }`. Pure helper `belowLock({ commit, files }) -> object` and `belowFiles` list in `src/domain/below-import.js`? No: scripts are not domain; keep the helper inside the script and test the lock file's shape after an import in `test/import-below.mjs` (skip with a note when `below/` is absent).

- [ ] **Step 1:** the test: `below/BELOW.lock.json` exists, has a 40-char `commit`, `files > 100`, and `below/index.html` contains `src/main.js`; `below/src/handoff.js` exists (Task 1 landed in the copy).
- [ ] **Step 2:** write the script (fs.cp recursive, the lock), run it; `git add below` (≈9 MB).
- [ ] **Step 3:** `scripts/build.mjs`: after the existing copy loop, `await cp(new URL('below/', root), new URL('below/', dist), { recursive: true })`; `npm run build` → `dist/below/index.html` present; the token line prints the count.
- [ ] **Step 4:** serve the game (`npm run dev` or the :8159 tree) and open `http://localhost:8159/below/index.html?stalheart=1` by hand: the cave runs from the game's server. Commit: "The cave vendored under below/ from stalheart-cave <commit>; the build ships it".

### Task 3: content and domain rules (node test)

**Files:**
- Create: `src/content/descent.js`, `src/domain/descent.js`, `test/descent.mjs`

**Interfaces:**
- `DESCENT = freeze({ page: 'below/index.html?stalheart=1', outcomes: freeze(['rescued', 'sacrifice', 'lost']), brief: 'descent_brief', back: 'descent_back', last: 'descent_last', mobileSkip: true })`
- `descentDue({ outcome, final, mobile }, tune) -> boolean` (secure + final + !(mobile && tune.mobileSkip))
- `descentResult(data, tune) -> outcome | null` (an object with `below` in `tune.outcomes`)
- `descentNext(outcome) -> 'ending' | 'retry'` (`lost` → retry)

- [ ] **Step 1:** the test (the three functions, the edge cases: a string message, a wrong outcome, mobile). **Step 2:** FAIL → write → PASS. **Step 3:** commit.

### Task 4: the host (fx) and the wiring (sector loop, controller)

**Files:**
- Create: `src/fx/descent-host.js`
- Modify: `src/fx/sector-run.js` (`finish`), `src/td-tab.js` (create, storyApi, harness), `styles.css` (`.descent-frame { position: fixed; inset: 0; border: 0; z-index: 200; background: #000 }`)
- Modify: `src/isaobriefs.js` (`descent_brief`, `descent_back`, `descent_last` as text briefs with the spec's lines; `isao-voice` gets them on import)

**`createDescentHost(root, c)`**, `c`: `pause(v)`, `showBrief(id)`, `say(trigger)`, `story()`, `mobile`, `t()`.
- `begin(then)`: if `descentDue` is false → `then()` at once (the mobile skip says the brief and goes on). Else `showBrief(DESCENT.brief)`; `pause(true)`; the iframe appended to `root` with `src = DESCENT.page`, `allow = 'pointer-lock; autoplay; fullscreen'`; `onMsg = (e) => { const o = descentResult(e.data, DESCENT); if (!o) return; story().descent = { outcome: o, at: t() }; if (descentNext(o) === 'retry') return; cleanup(); pause(false); showBrief(o === 'sacrifice' ? DESCENT.last : DESCENT.back); then(); }`; `window.addEventListener('message', onMsg)`.
- `state()`: `{ open: !!frame, outcome: story().descent?.outcome ?? null, src }`.
- `report(outcome)`: the harness's shortcut: `onMsg({ data: { below: outcome } })`.

- [ ] **Step 1:** write the module. **Step 2:** `sector-run.js finish`: `if (outcome === 'secure' && finalSector() && !finaleShown) { finaleShown = true; phase = 'finale'; h.hud(); const fin = () => finale(show); if (!api.descent?.(fin)) fin(); }` (`api.descent` returns true when it took the handoff). **Step 3:** `td-tab.js`: `const descentHost = createDescentHost(root, { pause: (v) => ..., showBrief, say: isaoSpeak, story: () => story, mobile: mobileShell, t: () => t })`, `storyApi.descent = descentHost.begin`, harness `descent: descentHost.state()`, hooks `descentNow: () => descentHost.begin(() => {})`, `descentReport: (o) => descentHost.report(o)`. **Step 4:** the ending's joke: in `src/fx/orbital-finale.js` (or wherever "Ready for the next one?" is queued: grep `ending_next`), when `story.descent?.outcome` is set, queue `descent_back`/`descent_last` before it (one line). **Step 5:** `npm test`, `npm run check`, `npm run build`; commit.

### Task 5: the voice list and the browser step; records

- [ ] **Step 1:** `~/Dev/seiyu_voice/ISAO-VOICE-LINES.md` `## 17. The descent` with `descent_brief`, `descent_back`, `descent_last` (the spec's texts); commit there.
- [ ] **Step 2:** `scripts/browser-test.mjs --descent`: open the game at `?skip=defence&sector=${SECTOR_DOOR.earliest + 2}` (BOTH WALLS with the boss slotted; without the boss plan landed, `+ 1`), `until state().sector.name === 'BOTH WALLS'`, `descentNow()`, assert `document.querySelector('iframe.descent-frame')?.src` ends with `below/index.html?stalheart=1` and `state().paused === true`, wait for the iframe's document to have `#take-feed` (same origin: `iframe.contentDocument`), `descentReport('rescued')`, assert the iframe is gone, `paused === false`, `state().descent.outcome === 'rescued'`, and the finale's shot id appears within 10 s (`state().shotId` of the diorama/orbital finale as `--finale` asserts). A second run with `descentReport('lost')` keeps the iframe (retry).
- [ ] **Step 3:** `--finale`, `--sectors`, `--chapters`, `--skip-tutorial` still green; the default suite's shell-explosion red noted as known.
- [ ] **Step 4:** `/deban` entry `2026-10-15-descent-mission-first-version` (the handoff protocol, the lock, the outcomes), STATE.md, commit, push; Pages publishes `below/`; Telegram.

## Self-review notes

- Spec coverage: the vendoring (T2), the mode and the protocol (T1, T4), when (T4), the outcomes and the joke (T3, T4), tests (T5).
- Open to the owner: `lost` as a retry (the plan) or a loss; the mobile skip; whether the sacrifice ending should differ more than a caption.
- Risk: pointer lock inside an iframe needs the `allow` attribute and a same-origin page (it is); Safari's handling differs — the owner plays on Chrome.
- Risk: the cave's `vendor/three.module.js` is a second copy of three (1.4 MB) loaded only when the iframe opens: acceptable at the campaign's end.
