# Navigation shell: PLAYTEST and DEV

Date: 2026-09-14. Status: design approved in conversation; spec awaiting owner review.

## Why

The owner wants easy navigation for playing and for developing, with the roadmap and the FunMap close at hand. Today each page carries a hand-written tab bar (`index.html`, `labs.html`), `src/main.js` computes the active state and builds a story stage strip, story skip markers float beside the build tag (`src/fx/story-skips.js`), the roadmap and devlog live in a workshop tab (`src/labs/notes-tab.js`), `FUNMAP.md` is not reachable from the app at all, and `styles.css` carries three generations of burger and home-launcher rules. A flat-world reform is planned (`2026-09-14-flat-world-direction`), so this work stays at the shell: menus, docs and capture, not the game world.

## Decisions taken with the owner

- One shell on every page with two top-level modes, **PLAYTEST** and **DEV** (owner, 2026-09-14, after playing the gunship: "story/defend/arrival/record/setting/workshop" as one flat row is confusing; "first we need higher level").
- **PLAYTEST** holds the sections under playtest (Story with its stages and jump points, Defend, Arrival), with Record and Settings as a footer row. It keeps everything the cleanup kept, tidier, with an easy jump to key moments.
- **DEV** holds everything for building: the workshop labs, the docs (FunMap, roadmap, devlog, practices) and tools, including a quick felt-it capture that saves locally and exports for `docs/FUNMAP.md`. No backend.
- **Tuning lives under DEV** (owner, 2026-09-14: "all those settings should also be somewhere meaningful under DEV"): the variables panel behind today's ⚙ (Game, Hover, Recoil, Orbital strike, Plasma, Bloom, Sound, Lab) is reached from DEV · Tuning, one entry per page. The ⚙ and ↗ buttons leave the top-left corner.
- **From any screen either mode is one click away**: an always-visible `PLAYTEST | DEV` toggle sits top right beside the build tag. Clicking the other mode switches to it and opens its drawer; clicking the current mode toggles its drawer.
- DEV shows automatically on the source tree and is hidden on a release build unless `?dev=1` was used once (remembered; `?dev=0` clears it). With DEV hidden the toggle shows PLAYTEST alone.
- One nav module drives both pages from one data table.
- Hotkey: backslash (`\`) only. Tab stays the browser's focus navigation.

## Structure

### Pure modules (Node-tested)

- `src/content/nav.js` — the menu as data. `NAV_MODES = ['playtest', 'dev']`. Each entry: `id`, `label`, `mode` (`playtest` | `dev`), `group`, and a target: `{ page, hash, params }` for navigation, `{ doc }` for the overlay, or `{ tool }` for a tools panel. Groups and entries:
  - PLAYTEST · **Story**: Story (`index.html?story=1#td`); Stages 0–8 as one row of small buttons; jump points Rotor, Quiver, Study, Gunship (the entries of today's `STORY_SKIPS`, same URLs; unwired ones listed and disabled).
  - PLAYTEST · **Defend**: the finished base (`?story=8`).
  - PLAYTEST · **Arrival**: the landing cinematic (`labs.html?land=1#story`).
  - PLAYTEST · footer row: Record (`#record`), Settings (`settings.html`). (A Sound toggle was dropped at planning: the game has no single mute to point it at, and building one is not a navigation change.)
  - DEV · **Workshop**: units, swarm, beam, audio, metal, story, sentry / impact, breach, sim.
  - DEV · **Docs**: FunMap, Roadmap, Devlog, Practices.
  - DEV · **Tuning** (game pages only; absent where the page has no variables panel): Game, Hover, Recoil, Orbital strike, Plasma, Bloom, Sound, and Lab when `lab` is on. Each opens the existing `#td-vars` modal on that page (`{ tool: 'vars', page }`); the modal, its pages and every control stay as they are, only the way in changes. The list is read from the modal's own pages at runtime, so a new lil-gui folder shows up without touching `nav.js`.
  - DEV · **Tools**: Felt it, Jump-to enemy count, Copy deep link (today's ↗, same `wireDeepLink` behaviour), Frame readout (today's backtick toggle), Diagnostics (the export from `settings.html`).
  - A new playtest section is one entry block in `nav.js`; nothing else changes.
- `src/core/nav-match.js` — `activeEntry(entries, { page, hash, search })` returns the id of the entry the current URL is; `modeOf(entry)` gives its mode, which is the mode the toggle shows as current on load (a workshop lab is DEV, a story stage PLAYTEST; a page matching no entry falls back to the last mode used, stored as `ssg.nav-mode`). Rules: story versus defend by `stage`/`story` (≥ 8 is Defend); a lab by its hash; a jump-to by `skip=`; retired `classic=` and `mission=` links resolve to Story. Also `placeLabel(...)` for the closed button ("story · stage 1", "lab · breach").
- `src/core/dev-mode.js` — `devModeOn({ buildToken, search, stored })` returns `{ on, store }` (whether DEV is offered at all): on when the build token is the source placeholder `00000000`; otherwise on when `?dev=1` or a stored flag; `?dev=0` clears the flag. The flag is stored through `src/storage.js` as `ssg.dev-face` (the store only accepts `td.`/`ssg.` keys).
- `src/core/markdown.js` — the notes tab's renderer moved unchanged (headings, lists, tables, fences, rules, quotes, inline code/emphasis/strike/links; escaping before inline).
- `src/domain/felt-notes.js` — a note is `{ date, kind: 'satisfying' | 'needs-work', text, lesson? }` (lesson one of `R1`–`R20` or `M`). `addNote`, `sanitiseNotes` (drops malformed entries, never throws), `toFunmapLines` (one line each, the FunMap observation shape: `- YYYY-MM-DD · text · R13`, needs-work notes prefixed `needs work:`), `toJson`.

### DOM modules (`src/fx/`)

- `shell-nav.js` — renders the always-visible `PLAYTEST | DEV` toggle (top right, joined to the build tag so the two never overlap) and one drawer per mode from `nav.js` on both pages; marks the current mode and the active entry; shows the place label under the toggle ("story · stage 1", "lab · breach"); navigates, opens the overlay or a tool. Replaces both hand-written tab bars, the stage strip in `main.js` and the floating skip panel. The skip finishing logic (waiting for the acceptance hooks, mounting the gunship, the continuous waves) moves from `story-skips.js` into a small `fx/jump-to.js` that `shell-nav` calls; `story-skips.js` is retired.
- `docs-overlay.js` — a full-screen overlay over the current page with one tab per doc, a find box that hides whole sections, a contents rail and a close button. Fetches the markdown files; a release that did not ship one says so. The page underneath keeps running.
- `felt-capture.js` — the Felt it tool: kind, text, optional lesson tag, Save; the saved list with Copy markdown and Copy JSON (clipboard, with selected-text fallback like the preset panel). Stored through `src/storage.js` under `ssg.felt-notes`.

### Retired

- `src/labs/notes-tab.js` and its route: `labs.html#notes` opens the workshop with the overlay on the Roadmap.
- The `#tabbar` markup in `index.html` and `labs.html`, the stage strip and tab wiring in `src/main.js`, `src/fx/story-skips.js`.
- The top-left `#chrome-toggle` (☰), `#vars-toggle` (⚙) and `#td-link` (↗) buttons; their jobs move to the toggle, DEV · Tuning and DEV · Tools. The V and backtick hotkeys keep working.
- The old `#tabbar`, `#chrome-toggle`, home-launcher and `#story-stages-nav` rules in `styles.css`, replaced by one drawer stylesheet section.

### Release

`scripts/build.mjs` adds `docs/FUNMAP.md` to the shipped files; the overlay fetches it from the same relative path in source and release. DEV's modules (overlay, felt-it capture) are imported only when `devModeOn` is true.

## Behaviour

- **Switch modes.** The toggle is on every page, top right. Clicking the other mode makes it current and opens its drawer; clicking the current mode opens or closes its drawer. Switching modes never navigates by itself: you stay on the screen you were on until you pick an entry, so going to DEV to read the FunMap and back to PLAYTEST leaves the game running.
- **Open and close.** The toggle opens and closes the current mode's drawer on every page. `\` toggles it too, except while focus is in a text field, a lil-gui control, the choice browser or a dialog. A click outside closes it; Escape closes it only while it is open, and is stopped from reaching the game, so it never pauses by accident. With the drawer closed, Escape pauses as today. No other keys are taken.
- **Layout.** Desktop: a left panel. Phone: a full-height scrolling sheet with 44 px targets. One drawer at a time, the current mode's; DEV's groups collapsible with the state remembered locally.
- **Where you are.** The current mode is lit on the toggle, the active entry is highlighted in its drawer, and the place label sits under the toggle.
- **During play.** On phones the toggle fades while playing, as the menu button does today; the drawer is hidden until tapped. Opening the drawer does not pause.
- **Navigation.** Play, Jump to and Workshop entries navigate with a reload, dropping the previous mode's switches (`story`, `stage`, `world`, `heart`, `threat`, `land`, `cine`, `skip`). Jump-to entries carry today's skip URLs and the enemy count from Tools. Docs never navigate.
- **Felt it.** Saved notes survive reloads on that browser. Nothing leaves the browser except by copy.

## Testing

- Node: `test/nav-match.mjs` (every current route and retired link), `test/dev-mode.mjs`, `test/markdown.mjs` (pins the renderer's current output before the move, including escaping inside fences), `test/felt-notes.mjs` (validation, dates, export shape, JSON round trip, malformed storage), `test/nav-content.mjs` (every entry complete; every workshop hash is a route in `main.js`; every jump-to URL parses).
- Browser, new `--nav` suite: the toggle visible on the game, in the workshop and during the gunship seat, not overlapping the build tag; switching PLAYTEST → DEV → PLAYTEST from a running game opens each drawer and does not navigate; a workshop lab loads with DEV current and a story stage with PLAYTEST current; DEV · Tuning · Bloom opens the variables modal on its Bloom page over a running game, and no ⚙ or ↗ button remains top left; the toggle and `\` open and close the drawer; `\` typed into a lil-gui field does not; Escape closes without pausing; the dev face present on source and absent under `--dist` until `?dev=1`; the Gunship jump reaches the seat; the overlay opens the FunMap over a running game without navigating; a felt-it note survives a reload and copies as markdown.
- Existing scenarios updated: the two `#tabbar [data-story]` assertions in `--story-world` read the drawer's active entry; the gunship scenario's skip-panel checks use Jump to and the Tools count; `notes-roadmap` becomes an overlay check.
- Architecture: new code only in `core/`, `domain/`, `content/`, `fx/`; no new top-level `src/` module; `src/td-tab.js` does not grow.
- Gates before done: `npm test`, `npm run check`, `npm run build`, browser default, `--story-world`, `--gunship`, `--nav`, and `--dist`.

## Out of scope

The flat-world reform; game HUD changes; any change to what a lab does; a shared or online FunMap tracker; merging felt-it notes into `docs/FUNMAP.md` automatically.
