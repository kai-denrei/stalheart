# Standalone Tower Defense project proposal

**Proposed working directory: `../stalheart/`; final product/repository name remains open.** No repository has been created by this audit.

The existing repo should become the spherical-grid research workbench again. The game should own its releases, player settings, balance changes, missions, runtime assets and game-facing labs. The dependency direction is game → pinned research kernel; research must not depend on game internals to generate a sphere.

**Alternatives considered**

| Approach | Advantage | Reason to choose/defer |
|---|---|---|
| Whole-project fork, keep everything | Fast playable copy, complete Git history | Useful as the initial local clone, but prune the shipped application; otherwise the product split is only a new URL |
| Clean-room rewrite/new engine | Clean abstractions | Reject for this move: too much tested behavior, authored articulation and device history to reimplement safely |
| Permanent monorepo with apps/packages | Easy atomic shared changes | Reasonable if research/game remain one release organization, but less aligned with the request for an independent project |
| Separate game + pinned kernel snapshot | Independent product, low initial packaging risk | Recommended first destination; no registry infrastructure required |
| Shared published kernel package immediately | Clear reusable API | Defer until interface and update cadence justify it; current hull adapter and combined graph/carver need explicit contracts |

**Ownership and transfer inventory**

| Family | Initial action | Long-term owner |
|---|---|---|
| `grid`, `sample`, `hull`, `vec3`, `rng` | Copy exact pinned sources and required vendor imports; record source commit and checksums | Research/kernel |
| `cellindex`, graph builder/BFS from `dungeon` | Carry intact initially; later distinguish generic adjacency/query from campaign carving | Kernel utilities, with game owning terrain semantics |
| `td-tab`, towers/rosters, enemy specs, economy, rank/score/achievements, mines/shield/rescue, strike/targeting/A6 | Move with associated tests, preserving behavior first | Game |
| `units`, `glbmodels`, tower looks/feel, shared shot/beam/impact effects, sound and presets | Transfer full reachable modules initially; slim registries after runtime parity | Game |
| `cine/rail`, `scripts`, `sound`, `kit`, materials and other reachable helpers | Keep because the board imports them | Game runtime |
| Units/beam/impact/sentry/sniper/metal/portal/astro labs and relevant cinematic benches | Keep selected labs behind a separate developer entry; preserve additional dependencies such as `ballistics`/catalogues | Game tools, importing the same subjects/presets |
| Grid/maze/organic/battle/heart/tank historical studies | Remain accessible in research | Research |
| `minigames/hdt`, `minigames/pzk` | Copy intact initially: hacking depends on their runtime/bridge behavior, not just an iframe URL | Game, with provenance to upstream projects |
| `assets/models`, processed audio, fonts, UI textures | Copy needed set; verify lazy tiers/variants and failure paths | Game runtime |
| `assets/audio/src`, high-resolution captures, raw authoring/export inputs | Keep as source/media tooling outside release output | Game asset pipeline or original authoring repo |
| `main.js`, `index.html`, `styles.css` | Build a TD-only entry and shell, initially preserving required TD DOM IDs and styles | Game |
| `url.js`, `roster.js`, `fonts.js`, `pwa.js` | Explicit boot dependencies; do not rely only on the TD import closure | Game bootstrap |
| `sw.js`, manifest/icons, bust/check/capture scripts | Re-scope for the new application; preserve cleanup safeguards | Game deployment/tools |
| DEVLOG, research explanations/plans, private Deban vault | Preserve originals; migrate a curated decision summary and provenance links | Each project owns its current decisions |

The [static import closure](evidence/td-static-import-closure.json) is mechanically derived and deliberately overinclusive in places. It excludes dynamic URLs and shell dependencies; a release manifest must additionally scan runtime model/audio/font URLs, tier suffixes, CSS assets, iframe contents and HTML. Preserve relative paths initially. Do not bulk-delete files based only on static reachability.

**Suggested eventual structure**

```text
stalheart/
  app/                 # boot, routes, loading, settings, PWA
  game/
    session/           # run lifecycle, state, clock, commands, event stream
    world/             # campaign terrain, cell semantics, navigation
    combat/            # movement, targeting, damage, weapons, effects events
    campaign/          # sector director, economy, construction, progression
    missions/          # defense, rescue, raid policies
    presentation/      # Three.js world, cameras, HUD, audio
    content/           # rosters, enemy data, balance profiles, authored presets
  tools/labs/          # same game subjects, separate developer entry
  third_party/sphere/  # pinned research snapshot + provenance
  public/              # runtime assets, minigames, icons
  test/                # pure rules, browser flows, golden replays
  scripts/             # build/release, sim batch/report, capture
  docs/decisions/      # short current architectural decisions
  docs/balance/        # experiment manifests, summarized evidence
```

These are responsibility boundaries, not an instruction to create dozens of empty modules. Begin with `src/td-tab.js` largely intact and extract one complete responsibility at a time.

**Phase A — establish a truthful baseline**

Keep a recorded baseline commit/token and both rosters. Repair run schema, outcome semantics, cancellation and config capture before using simulated results as a parity oracle. Distinguish sector clear from planet completion. Add command-driven scenarios for a commissioned tower, a hull replacement, early gate close, final wave, low-cash debrief, next sector, mission endings and retry during delayed work.

Acceptance: all existing tests pass; named browser scenarios either pass or have a documented known failure; same seed/config/commands at the same step reproduce results; a sector transition can be measured. Do not paper over current failures by changing expected results during migration.

**Phase B — make a playable independent copy**

Create a local clone or isolated checkout from the recorded commit, preserving history initially. Build a TD-only shell retaining the DOM IDs queried by the current closure. Preserve `url → roster → consumers` evaluation order. Copy dynamic assets, lazy models, shader imports and hacking minigames. Keep exact vendor versions and required notices.

Acceptance: game boots and runs with the original repo/server unavailable, from a different directory and under a non-root URL path. Both rosters, first construction, hull loss/retry, sector transition, each hack, rescue and raid load. Network failures have understandable fallbacks. No requests point into the old checkout or depend on an authoring repository.

Rollback: retain the untouched baseline clone/build. Do not remove the research game's current route until the new destination is accepted.

**Phase C — independent application identity**

Define game title, root route, manifest ID/start URL/scope, release token, asset base and storage namespace. Inventory existing `td.*`, `ssg.*` and hyphenated keys individually; preserve relevant records and player settings through an explicit one-time import/export. A different origin cannot silently read the old origin's local storage. On the same origin, avoid ongoing shared mutable settings between research and game.

Fix the old worker's broad cache deletion before deploying another app on the same origin. The new worker deletes only its own namespace and matches only its current cache. Test two apps installed side by side, old worker upgrade, offline warm boot, first offline visit, and controlled updates between sessions. Do not advertise complete offline support until the release asset manifest is precached and tested; current behavior is runtime caching only.

Keep native ESM during initial parity. Then choose either a small build producing canonical hashed assets or a rigorously generated ESM asset manifest; prefer generated release output over rewriting version tokens throughout source. Tool choice is secondary to one URL per stateful module, one coherent vendor version, reproducible output, and dynamic-asset discovery. Keep large media/export inputs out of release output.

Acceptance: a release installs and updates independently, existing records have a documented migration path, unrelated app caches survive, and both app roots work under their intended deployment paths. Publishing is a later explicit action; this proposal does not authorize it.

**Phase D — extract the simulation incrementally**

1. Introduce a session owner with `start`, `pause`, `resume`, `dispose`; collect listeners/timers/resources and guard async completions. Define paused/debrief/deploy/tutorial states instead of relying on combinations of loosely related booleans.
2. Introduce input commands shared by keyboard, touch, bot and director: drive, aim, fire, order/cancel/upgrade tower, deploy shield/mine, choose debrief purchase. Resolve commands against current state; return accepted/rejected events with reasons. Keep camera orientation consistent with the existing render-derived forward basis.
3. Move waves, economy ledger, orders and campaign transitions into pure state machines. Pass roster/config as immutable session inputs rather than switch global bindings during evaluation.
4. Move movement/combat update behind a fixed simulation step and presentation interpolation. Preserve current collision behavior with command replays before changing step size or numeric representation. Separate gameplay RNG streams from visual randomness and asset completion timing.
5. Move rendering, audio and DOM work to consumers of state/events. Keep presentation transforms authoritative for visual articulation, while exposing the minimum measured transforms that combat currently depends on through an explicit adapter.
6. Let mission policies choose objective, supply, spawn programme and allowed commands; let the UI derive visible controls from those capabilities. Avoid a new parallel mission engine.
7. Load labs and developer probes only through developer entry points. They must call the same commands, weapon builders and presets as the game.

Acceptance after every step: existing tests, scenario parity, both rosters and affected missions pass. On repeated session creation/disposal, live listeners, timers, audio contexts and GPU allocations stabilize after warmup. There should be no duplicate underlying Three.js module or silent fallback model caused by missed preload.

**Phase E — restore the research project's focus**

Keep the sphere generation/relaxation demo, historical studies, mathematical explanation, measurements and original history. Link to the new game and retain an explicitly archival playable build or tag. Record that the kernel snapshot is versioned and changes require downstream integration checks. Continue research independently of gameplay release dates.

Acceptance: the research demo still runs its invariants and visual pipeline without the game app. The standalone game has no dependency on a research tab shell. A kernel update can be evaluated with explicit generator-version changes rather than silently changing every saved seed.

**Phase F — UX and balance pass**

Only after parity: implement solvency safeguards, revise wave threat/throughput, reduce HUD competition, and playtest construction timing and the gate-hunting trade. Save baseline and candidate balance configurations side by side. Promote a candidate based on matched-seed measurements and observed play, not on a successful screenshot or a single bot result.

Acceptance: every sector clear has a valid continuation; both input shells complete core scenarios; human testers understand the core loop; benchmark reports include late sectors, pressure peaks and device frame time. Exact human difficulty targets and supported device budgets remain product decisions to settle with measurements.

**Scope control**

Do not add networking, multiplayer, an ECS rewrite, a new renderer, arbitrary-surface support, new progression systems or new tower-foundation rules to this migration. Keep TypeScript conversion optional and incremental after stable interfaces exist. Keep both rosters until maintaining classic has a measurable cost that outweighs its regression value. No schedule estimate is asserted here: the acceptance gates expose the real work more reliably than an unsupported duration estimate.
