# Stalheart development

This repository owns the game. Read `docs/STATE.md` and `docs/ARCHITECTURE.md` first; use `docs/log/entries/` for current decisions. `DEVLOG.md` is generated. Research notes and the original CLAUDE rules are historical references in `docs/archive/`, not current operating instructions.

- Run `npm test`, `npm run check` and `npm run build` for substantive runtime changes. Use `npm run test:browser` for boot/input/render/asset changes. Browser tests own their server and Chrome through `scripts/chrome-proc.mjs`; do not leak capture processes.
- Native ESM source uses canonical URLs without `?v=`. Build hashes go into `dist/` only. Never run the old research bust script or manually edit release tokens.
- The grid kernel is pinned in `docs/kernel-provenance.json`. Keep seed/topology behavior stable unless explicitly updating that contract. Keep one vendored Three.js version.
- The only roster is the eight numbered Sentries in `src/content/sentries.js`; retired roster URLs normalize to 2. The game and Workshop import the same rules/assets/presets. URL normalization and roster selection run before consumers load.
- Ground distances are sphere arcs; imported assets use meters, +Y up, +Z forward. Preserve animated pivots. Unit tick takes absolute time. Visual facing comes from actual render transforms.
- Game stores use `src/storage.js`. Diagnostics are bounded and local (`src/diagnostics.js`). No source console logging of private data. Keep private legacy Deban records ignored.
- Record substantive decisions, failures and validation using the project `/deban` skill or `npm run log -- add FILE`. Append immutable entries; never rewrite history. Keep `docs/STATE.md` short and current. No per-commit mandatory second commit.
- The source asset direction is SentryTowers_A6, including Terraformer 3000. Pin downloads and validate hashes with `npm run assets:check`; do not hotlink mutable upstream assets into gameplay. D0–D3 are destruction states, not LODs.
- Preserve the gate-hunting/income trade, Isao's travel-and-print orders, pilot rank across hulls, and distinct mission supply rules. Foundations and new progression systems are not part of this migration.
- No colored emoji in product UI; keep the monochrome visual vocabulary.
- Do not send messages, publish, or push without explicit authorization. The public origin is https://github.com/kai-denrei/stalheart; main publishes dist through GitHub Pages.

- Current delivery order is architecture, then visual/sound labs and clean exports, then UX, then playability. Do not start a general balance pass during the foundation work.
- Pure modules belong in `src/core/`, `src/domain/` and `src/content/`. `npm run architecture` enforces their dependencies, the `src/td-tab.js` line budget and the frozen top-level module list in `docs/architecture-budget.json`; budgets only go down. New modules go into a layer directory, never top-level `src/`. Top-level compatibility facades must not grow a second implementation. Use the project skills `add-module`, `remove-dead-code` and `architecture-review` for those tasks.
- Labs edit working copies and export schema-validated FX JSON. Shipped content is immutable; previews require `?preset=draft`. Promote through `npm run presets -- promote FILE`, review the resulting content diff, and run checks/build. Do not introduce a new copy/paste preset format.
