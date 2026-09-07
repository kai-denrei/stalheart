# Migration handoff — 2026-09-07

Stalheart owns the game from research commit `1900c9ddcad99cc7004fe423d89dd812e6589efc`. The complete Git ancestry remains available. The sibling research checkout is no longer a runtime dependency.

## What moved

- Tower Defense, both rosters, rescue/raid missions, three hacking games, records and game-facing workshops.
- Required spherical-grid kernel, vendored renderer/loaders, models, fonts, sound and shaders.
- Original public development history and the full audit; private Deban history is retained locally in ignored `.deban/legacy/`.

Research-only demos and their UI are removed from this checkout. The research repository retains its playable historical implementation. It received an ownership notice, an explicit record-export helper, and cache cleanup restricted to its own prefix.

## What changed

The game, Workshop and Settings have separate entry points. The selected game/lab loads lazily, with a document owning its renderer lifetime. Canonical source imports prevent duplicate module state; deterministic release output adds one build token. Release files are enumerated and hashed, and deployment excludes private history and development artifacts.

Game storage is namespaced and unavailable-storage calls are safe. Import validates the complete bundle, preserves existing records by default and rolls back failed writes where storage permits. Settings exports records and the prior page's bounded local diagnostic stream. Nothing uploads automatically.

Sector-clear breach funding covers only a shortfall, and optional supplies cannot consume the reserved toll. Refunds/grants have separate ledger categories. Simulator results distinguish sector clears, planet wins and mission completion; runs validate sender/run identity, terminate on cancellation and export full records. Existing mission rules and the inherited difficulty curve remain intact.

Development memory now has one immutable JSON record per outcome, a generated readable DEVLOG, a short current-state file and the project `/deban` skill. Checks reject malformed records, duplicate IDs, invalid supersession and a stale generated log.

## Sentry asset direction

The 33 inherited Sentry models were matched byte-for-byte to a pinned upstream revision. Four Terraformer 3000 damage variants are now local and verified. The opt-in adapter preserves authored animation pivots, palette and a common scale across damage states. It loads damaged variants on demand and cancels stale instance swaps. The existing gameplay rules remain authoritative; the source asset's visual features do not introduce unimplemented mechanics.

Use `/?terraformer=a6#td` to review it. D0 is 165,404 triangles and 78 merged meshes. Default promotion needs real-device measurements and actual LODs. D1–D3 are destruction states. See [asset direction](ASSETS.md) and [current priorities](STATE.md).

## Verification and next work

The migration log records the final checks and limitations. Browser evidence is reproducible through `npm run test:browser` and `node scripts/browser-test.mjs --dist`; full console/network records, screenshots and simulation results go to ignored `artifacts/`.

The next development slice should establish campaign threat budgets and playtest telemetry, then extract simulation commands/state from the large TD closure in small tested steps. Preserve the pinned kernel and both roster baselines while doing that. Real iOS/touch/audio testing, complete five-sector human playthroughs, suspend/resume and full offline installation remain outstanding product work.

No public deployment or remote is configured. `npm run dev` serves the game locally; `npm run build` creates the independent deployment payload in `dist/`.
