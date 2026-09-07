# Stalheart current state

Updated 2026-09-07. Owner: the Stalheart development project; this repo is now authoritative for the game.

## Working baseline

- Foundation v1: pure core/domain/content layers with dependency guards; shared immutable FX packages (base `stalheart-fx-2`); JSON import/export, explicit draft preview and deterministic promotion; impact and sound labs use the game's runtime builders/mixer.

- Independent game and lazy Workshop entries; research-only tabs removed from this checkout, original Git history retained.
- Native ESM, vendored Three.js r160, Node 22+ tools with no npm dependencies. Source has canonical imports; `dist/` owns release tokens and a file manifest.
- One numbered Sentry roster shared by radial, Sentry/Impact/Audio labs and Friendly units; classic roster and old tower renderers retired. Rescue, raid and all three hacking games retained. Sphere math pinned to research commit `1900c9d` with import tokens removed, algorithms unchanged.
- Isolated `stalheart:v1:` records; explicit import/export; local diagnostics ring and export; scope-specific service-worker caches.
- Immutable, validated `docs/log/entries/*.json`; generated DEVLOG; short AGENTS/CLAUDE instructions and project `/deban`. Historical private logs remain ignored locally.
- Simulator schema 2 separates sector/planet/mission outcomes, validates frame origin/source/run ID, supports cancellation and export, and advances campaign sectors. Reports explicitly migrate historical currency fields and label legacy wins.
- Zero-cash early sector clears receive only the missing breach allocation. Optional debrief purchases preserve that allocation. Refunds and grants are separated from combat earnings.
- Sentry Terraformer 3000 is integrated behind `?terraformer=a6`, with the authored cycle, named pivots, shared scale across damage states and lazy D1–D3 loads. Existing look remains default pending device/performance review.

## Next priorities

Owner-directed sequence: **architecture → visual/sound labs and clean exports → UX → playability**. [Architecture and implementation boundaries](ARCHITECTURE.md) are the current technical plan.

1. Continue extracting run state, commands/events and resource lifetimes from `td-tab.js`, behind enforced pure-domain and adapter boundaries. Preserve the existing gameplay baseline.
2. Extend the new versioned FX package workflow from weapon impacts/audio to beams, materials, portals and cinematics; unify stage scale, lighting and clock contracts. Keep Sentry asset optimization in this phase.
3. Rework HUD/tutorial competition, control feedback, off-screen threats and Isao order status on the stable foundation.
4. Tune difficulty, economy and progression after the architecture and authoring tools support repeatable experiments. The inherited formula still reaches 5,334 scheduled bodies at wave 75.

[Improvement backlog](IMPROVEMENTS.md) retains the detailed completion criteria. Real device checks remain acceptance work throughout; they do not turn this phase into a gameplay retuning pass.

## Boundaries

A browser document owns one game or lab lifetime; route changes reload, avoiding accumulation of hidden renderers. Full in-document session disposal and a pure replayable combat engine remain future work. The reusable kernel is pinned in `src/`, not yet a published dependency. No arbitrary-surface expansion, tower foundations, multiplayer or renderer replacement is underway.

The original source repo remains a research/archive checkout. Its broad service-worker cache cleanup was narrowed for safe coexistence. No remote, public URL or deployment was created for Stalheart.

## Evidence

Run `npm test`, `npm run check`, `npm run build`, `npm run test:browser`, and `node scripts/browser-test.mjs --dist`. See the migration log for measured outcomes and known limits. Browser artifacts are in `artifacts/`; the earlier research audit is preserved under `docs/audit-2026-09-07/` as baseline history, not a live description of the migrated code.
