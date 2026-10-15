# THE DESCENT — the cave mission as the campaign's last — design

Owner, 2026-10-15: "/Users/minikai/Dev/stalheart-cave we will bring this mission as the last mission; Isao must go into the Nest to set-up a
nuke." And earlier the same day: "at the end of that mission, ISAO will joke that he finally decoded the Alien language from what the Queen
said when he set-up a nuke in her nest… 'My Nest, you out, and then words that seem to mean excrement'."

## What the cave is

`~/Dev/stalheart-cave` is a separate, standalone game (`stalheart-below` 0.8.0, its own repo, published at
https://kai-denrei.github.io/stalheart-cave/): the player flies ISAO (a quadcopter controller, third person) down Stalheart's sinkhole
into a living cave to the Queen's chamber, places the charge (hold E near the Queen, a 65 s fuse), and flies back out; ten flares, a work
light that fails, LiDAR views, 12 HP. Three outcomes: `rescued` (out before the blast), `sacrifice` (the charge placed, Isao lost or
inside at the blast), `lost` (down before the charge is armed). It is static (`index.html`, `src/`, `vendor/` three.js 1.4 MB, `assets/`
6.8 MB), served from any folder, no network, with a test hook (`?test` → `window.__below`). It shares no code with the game at runtime
(its sinkhole shape and look are frozen local copies).

## Decisions

1. **The mission plays inside the game page, in an iframe over the viewport**, not by navigating away: the run's state (the base, the
   reports, the campaign board's clips) lives in the page and would be lost on a navigation. The game pauses under it; the iframe gets
   `allow="pointer-lock; autoplay"`; the cave's own audio and pointer lock work inside it. The cave's page is vendored under the site as
   `below/` (its `index.html`, `src/`, `vendor/`, `assets/`; 8.8 MB, within Pages' size), copied from a pinned commit of the cave repo by
   `scripts/import-below.mjs` (the voice import's pattern: the source of truth stays the owner's repo; `below/BELOW.lock.json` holds the
   commit), and the build copies `below/` into `dist/below/` as it copies everything else.
2. **When: after BOTH WALLS is secured, before THE ENDING.** `sector-run.finish('secure')` on the final sector calls `api.descent(then)`
   where `then` is today's `finale(show)`; the descent host shows Isao's brief, opens the iframe, and `then` runs when the cave reports.
   A LOST final sector is the game's own loss as now (no descent).
3. **The handoff protocol:** the game opens `below/index.html?stalheart=1`; the cave in `stalheart` mode skips its briefing screen (the
   feed is "live" at once; a first click starts it for the audio context), hides its wordmark link, and when its ending screen shows,
   its button reads RETURN TO THE SURFACE and posts `{ below: 'rescued' | 'sacrifice' | 'lost' }` to `window.parent` (a `restart` stays for
   `lost`: "TRY AGAIN"). The game's descent host listens for the message, removes the iframe, unpauses and continues by outcome.
4. **The outcomes in the campaign:** `rescued` → THE ENDING as it is, with Isao's decoding joke as a new caption/line before the finale's
   last line ("Ready for the next one?"); `sacrifice` → the same ending with the joke as his last transmission (the caption prefixed
   "LAST TRANSMISSION"), and the campaign board notes UNIT LOST; `lost` → the cave offers TRY AGAIN inside the iframe (the run is not lost
   for a crashed descent; the owner may change this to a loss later: one line).
5. **Isao's joke (captions first, the owner records later):** `descent_brief` ("The nest is under the sinkhole. Somebody has to carry the
   charge down there, and the hull does not fit. I do."), `descent_back` ("I finally decoded their language. From what the Queen said when
   I set the charge in her nest: 'My nest. You, out.' And then words that seem to mean… excrement."), `descent_last` (the sacrifice's
   last transmission: the same text, then static).
6. **The cave's own changes are small and live in the cave repo** (`src/main.js`, `index.html`): the `stalheart` mode, the message, the
   button texts; committed there, then imported. Nothing in the cave reads the game.
7. **Out:** porting the cave into the game's renderer; the tank in the cave; a shared sinkhole; difficulty; mobile (the cave is desktop
   keyboard/mouse only — on a phone the descent is skipped with a caption and the ending plays: the owner's open mobile question).

## Components

| Piece | Where | Responsibility |
| --- | --- | --- |
| cave `stalheart` mode | `~/Dev/stalheart-cave/src/main.js`, `index.html` | `?stalheart=1`: skip the briefing, the ending's RETURN TO THE SURFACE posts `{ below: outcome }` to the parent; `lost` keeps TRY AGAIN |
| `scripts/import-below.mjs` | stalheart | copy `index.html`, `src/`, `vendor/`, `assets/`, `ASSETS.md`, `assets.lock.json` from `../stalheart-cave` at its HEAD into `below/`, write `below/BELOW.lock.json` `{ commit, date, files }`; refuse a dirty cave tree |
| `scripts/build.mjs` | stalheart | copy `below/` into `dist/below/` (the models there are already the cave's own; no meshopt pass) |
| `src/content/descent.js` | content | `DESCENT = { page: 'below/index.html?stalheart=1', outcomes: ['rescued','sacrifice','lost'], brief: 'descent_brief', back: 'descent_back', last: 'descent_last', mobileSkip: true }` |
| `src/domain/descent.js` (new, pure) | domain | `descentDue({ outcome, final, mobile })`, `descentResult(msg) -> outcome | null` (validates the message), `descentNext(outcome) -> 'ending' | 'retry'` |
| `src/fx/descent-host.js` (new) | fx | `createDescentHost(root, c) -> { begin(then), state(), dispose() }`: the brief, the iframe, the message listener, the pause, the joke caption, `then()` |
| `src/fx/sector-run.js` | fx | `finish`: on the final sector's SECURE `api.descent?.(() => finale(show)) ?? finale(show)` |
| `src/td-tab.js` | controller | `storyApi.descent = descentHost.begin`; the harness `descent: descentHost.state()`, hook `descentNow()` and `descentReport(outcome)` |
| `src/fx/orbital-finale.js` or the ending's lines | fx | the joke line before the last ("Ready for the next one?") when `story.descent?.outcome` is set |
| tests | `test/descent.mjs`, `test/import-below.mjs` (the lock's shape), browser `--descent` | |

## Data flow

1. BOTH WALLS secured → `finish('secure')` → `descentDue` → `api.descent(then)`.
2. `descent-host.begin(then)`: `say('descent_brief')`; `pause(true)`; the iframe `<iframe class="descent" src="below/index.html?stalheart=1" allow="pointer-lock; autoplay">` over the game root; `window.addEventListener('message', onMsg)`.
3. The cave runs; its ending's button posts `{ below: outcome }`.
4. `onMsg`: `descentResult(e.data)` → `story.descent = { outcome }` → remove the iframe, `pause(false)`, `say(outcome === 'sacrifice' ? 'descent_last' : 'descent_back')` (the caption), `then()` → the finale → the campaign board (UNIT LOST on sacrifice).
5. `lost`: the cave's TRY AGAIN restarts it inside the iframe; nothing reaches the game until an outcome does.

## Testing

- Node: `descent.mjs` (due only on the final sector's SECURE and not on a phone when mobileSkip; the message validated: a string outcome of the three, anything else null; next by outcome).
- Browser `--descent`: `index.html?...&skip=defence&sector=<doorAt+2>` → `storyApi.descentNow()` (the harness forces the hook without playing the sector) → the iframe is in the DOM with the cave's URL and the game is paused → `descentReport('rescued')` (the harness posts the message to the game window) → the iframe is gone, the game unpaused, `state().descent.outcome === 'rescued'`, the ending host entered (`state().ending` / the finale's shot id). The cave's own suite (`npm run test:browser` in its repo) stays its own; `--descent-cave` (optional) loads `below/index.html?stalheart=1&test=1` from the game's server and drives `window.__below.nearQueen()` + the bomb to see the message posted.
- Size: `dist/` grows by ~8.8 MB; Pages' limit is 1 GB.
