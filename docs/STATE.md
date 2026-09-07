# Stalheart current state

Updated 2026-09-07. Owner: the Stalheart development project; this repo is now authoritative for the game.

## Working baseline

- Independent game and lazy Workshop entries; research-only tabs removed from this checkout, original Git history retained.
- Native ESM, vendored Three.js r160, Node 22+ tools with no npm dependencies. Source has canonical imports; `dist/` owns release tokens and a file manifest.
- Sentry roster 2 default; classic 1, rescue, raid and all three hacking games retained. Sphere math pinned to research commit `1900c9d` with import tokens removed, algorithms unchanged.
- Isolated `stalheart:v1:` records; explicit import/export; local diagnostics ring and export; scope-specific service-worker caches.
- Immutable, validated `docs/log/entries/*.json`; generated DEVLOG; short AGENTS/CLAUDE instructions and project `/deban`. Historical private logs remain ignored locally.
- Simulator schema 2 separates sector/planet/mission outcomes, validates frame origin/source/run ID, supports cancellation and export, and advances campaign sectors. Reports explicitly migrate historical currency fields and label legacy wins.
- Zero-cash early sector clears receive only the missing breach allocation. Optional debrief purchases preserve that allocation. Refunds and grants are separated from combat earnings.
- Sentry Terraformer 3000 is integrated behind `?terraformer=a6`, with the authored cycle, named pivots, shared scale across damage states and lazy D1–D3 loads. Existing look remains default pending device/performance review.

## Next priorities

1. Keep the migration acceptance matrix green; exercise Safari/iOS and real touch/audio. Chrome headless is not a phone playtest.
2. Tune campaign threat budgets and release throughput: the inherited full-hold wave formula still grows to 5,334 scheduled bodies at global wave 75. This migration intentionally did not invent a new difficulty curve.
3. Separate more simulation state/commands from `td-tab.js`. Campaign purchase policy, result validation, storage and diagnostics now have boundaries; combat/render/tutorial integration remains a large closure.
4. Measure Terraformer 3000 in-game on target devices. Its 78 merged meshes / 165,404 triangles in D0 are not a mobile budget. Produce actual LODs upstream; damage variants do not serve that purpose. Review animation speed, footprint and readability before promoting default.
5. Reduce instruction/HUD competition, improve order readiness/ETA and clarify off-screen threats. Keep pilot rank wording consistent.
6. Add versioned sector-boundary suspend/resume, and a complete offline release manifest if the product needs offline installation.

## Boundaries

A browser document owns one game or lab lifetime; route changes reload, avoiding accumulation of hidden renderers. Full in-document session disposal and a pure replayable combat engine remain future work. The reusable kernel is pinned in `src/`, not yet a published dependency. No arbitrary-surface expansion, tower foundations, multiplayer or renderer replacement is underway.

The original source repo remains a research/archive checkout. Its broad service-worker cache cleanup was narrowed for safe coexistence. No remote, public URL or deployment was created for Stalheart.

## Evidence

Run `npm test`, `npm run check`, `npm run build`, `npm run test:browser`, and `node scripts/browser-test.mjs --dist`. See the migration log for measured outcomes and known limits. Browser artifacts are in `artifacts/`; the earlier research audit is preserved under `docs/audit-2026-09-07/` as baseline history, not a live description of the migrated code.
