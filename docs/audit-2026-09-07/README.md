# Research and Tower Defense audit — 7 September 2026

**Recommendation: establish Tower Defense as a separate game repository through a staged extraction. Preserve this repository as the spherical-grid research workbench. First reproduce the current game in its new home, then separate its simulation from presentation.**

The game has a distinct identity: driving a tank around a small planet, choosing between defending lanes and hunting gates, and commissioning a drone to build defenses while the battle continues. Preserve those decisions. The immediate need is reliable campaign progression, trustworthy balance measurements, clearer player information, and independent releases.

This is an audit and proposal. No gameplay, tuning, deployment, or repository migration was performed. Proposed changes below are not ratified design decisions.

**Scope and evidence**

Baseline: `1900c9ddcad99cc7004fe423d89dd812e6589efc`, build token `26d54d57`. The pre-existing untracked `docs/arch/` directory was left untouched. Reviewed the source/module structure, game orchestration and representative subsystem implementations, all test entry points, deployment/cache scripts, historical balance data, public documentation, and private decision records. This is broad architectural and targeted correctness review, not a claim of exhaustive line-by-line verification of every lab, shader, asset, or embedded minigame.

Validation performed:

- All **57 Node test programs** in `npm test` completed successfully. These include real mathematical/behavioral invariants and some source-text assertions; they do not establish browser integration coverage.
- Cache-token and emoji guards passed.
- Chrome desktop cold start captured at 1440×900, including the normal cinematic and field manual.
- Chrome simulated mobile shell captured at 844×390, including a separate capture without diagnostic overlays. The layout probe reported zero overlaps at its sampling instant. The real key-event probe confirmed S does not spend a shield and T does.
- Four bounded simulator captures on seed 1000: sentry ram policy twice, sentry builder once, classic ram once. Repeated sentry runs produced identical result payloads.
- Evaluated the current pure wave formula through wave 75, rather than extrapolating historical results.

Raw logs, screenshots, run JSON, static import closure, and reproduction commands are in [evidence/README.md](evidence/README.md). Browser runs used local Chrome with muted audio and `sw=0`: they do **not** verify service-worker behavior, audible output, Safari/iOS, real touch ergonomics, a completed campaign, or long-session performance. The mobile probes alter game state; their screenshot is diagnostic evidence, not a natural play session.

**1. Overall assessment**

| Area | Assessment | Main consequence |
|---|---|---|
| Spherical-grid research | A working, tested sphere pipeline with valuable historical reasoning | Preserve as an independently reproducible research result |
| Game identity | Coherent action/defense hybrid with useful spatial decisions | Improve clarity and pacing before adding systems |
| Pure rules modules | A strong existing seam: economy, waves, ranks, shield, mines, rescue, targeting | Extend this pattern when separating the runtime |
| Game integration | Most behavior converges inside one enormous closure | Changes have large regression surfaces despite passing unit tests |
| Balance tools | Useful infrastructure, materially stale semantics and schema | Current reports cannot justify fine tuning yet |
| UX | A deliberate visual language, overloaded instruction and mode surfaces | Reduce competing information and explain delayed actions |
| Shipping | Simple deployment, fragile URL identity/cache ownership | Establish isolated builds and cache namespaces during extraction |
| Decision history | Unusually detailed, but indexes and current-state summaries drift | Preserve history; create a small authoritative current decision set |

**2. Codebase and research boundaries**

The checkout contains 110 JavaScript files under `src/`, totaling about 2.57 MB. Top-level source files alone total 51,492 lines. `td-tab.js` is **17,403 lines**, about 34% of that top-level total; `units.js` is 3,088, `heart-tab.js` 2,516. The shared stylesheet is 4,480 lines / roughly 180 KB. `main.js` statically imports the research tabs, labs, cinematics, simulator, and game, although tab initialization is lazy. Opening only the game still brings the static module graph into the browser.

A source import scan from `td-tab.js` reaches **71 source modules plus 11 vendor modules**, about **3.16 MB uncompressed**. This excludes HTML, CSS, runtime-loaded models/audio/fonts, minigames, and boot prerequisites such as `url.js` and `roster.js`. It is a starting manifest, not a complete package or measured network transfer.

The research kernel is mostly already separable:

- `sample.js`: seeded spherical sampling.
- `hull.js`: spherical triangulation through Three.js vectors and QuickHull.
- `grid.js`: merge, subdivide, project, relax, topology/error inspection.
- `vec3.js`, `rng.js`: common numerical primitives.
- `dungeon.js`: cell adjacency plus game-oriented carving/pathfinding; split these responsibilities only when stabilizing the reusable interface.
- `cellindex.js`: spatial lookup, consumed as a collision/semantic query accelerator.

Do not advertise the kernel as dependency-free: `grid.js → hull.js → vendor/three.module.js + ConvexHull.js` is a real dependency. It is DOM-free and Node-testable. Keep the existing triangulation adapter for the initial move. Replacing QuickHull or supporting arbitrary surfaces would be separate research work.

The research tests check all-quad faces, watertight edges, Euler characteristic, the defect sum, finite unit-sphere coordinates, and decreasing squareness error. The smoke suite currently exercises three seeds, 300 samples, radius 1, and 60 relax iterations. For an eventual reusable release, extend coverage to radius scaling, larger and minimum supported sizes, long relaxation, outward winding/positive cell area, graph connectivity, and deterministic output signatures. Record cell-area and edge-length distributions and gross defect counts; the net defect sum alone does not describe usable tile quality.

Keep the research questions visible: defect pairing, square-fit distortion, long-run stability, density, dual/corner-state tiling, deformation of authored tiles, and whether other surfaces actually need support. The playable game validates one consumer; it does not by itself complete the tiling research programme.

**3. Priority findings**

P1 = address before calling the standalone campaign ready; P2 = address during extraction/hardening; P3 = follow-up quality improvement. “Confirmed” below can mean directly demonstrated source behavior; runtime reproduction is stated separately.

| ID | Priority / confidence | Evidence and consequence | Proposed correction |
|---|---|---|---|
| F01 | P1, confirmed formula | `enemyspec.js:207–248`: global-wave base growth multiplied by a growing invasion surge. Wave 8→9 rises 20→65 enemies; full-hold wave 75 contains 5,334. `td-tab.js:6305` spreads a wave over only 3.2 seconds. | Use explicit sector/local-wave threat budgets and a bounded spawn rate. Preserve the ability to close gates early. |
| F02 | P1, confirmed measurement defect | `td-tab.js:1186–1203` emits “win” whenever `player.won` is true with health remaining. `checkVictory` sets that flag at every sector clear (`11369`), not only planet completion. | Distinguish sector-clear, planet-win, heart-loss, hull-loss, timeout and stall; make the bot perform debrief purchases and sector transitions. |
| F03 | P1, demonstrated report defect | `simreport.mjs` reads curve `credit`; current `simEmit` writes `biomass`. Running the report on this audit's result prints `undefined` and reports no flood. | Version/validate the schema; explicitly migrate old credit records; reject unsupported rows. Never interpret absent measurements as a healthy economy. |
| F04 | P1, source-supported progression risk | `ordersBlock` disables the next-sector button below the toll; optional purchases spend from the same purse (`4610–4627`, `11689–11712`). Sector clear ends hostile income. Closing early also deliberately skips income. | Reproduce an early-clear/low-cash and spend-below-toll state. Reserve the breach allocation before optional spending and guarantee a clear can progress. Keep surplus as the reward for holding. No new gate immunity. |
| F05 | P2, confirmed telemetry semantics | `CHEAPEST_TOWER=40` (`1082`) versus current starter 45; report flood threshold 660 versus current max price 260. `spendRatio=spent/earned` excludes initial funds, while refunds via `addBiomass` count as earned/score. Builder capture reports 2.60. `regenerate` also overrides the economy module's 190 starting default with 170 (`5672`). | Derive prices from the active roster and unlock state. Separate start funds, grants, bounty, refunds, purchases and sinks in a typed ledger; resolve starting funds in one balance configuration. |
| F06 | P2, confirmed cache ownership defect; deployment effect not exercised | `sw.js:40–42` deletes **every cache except its own**, without prefix filtering. Cache storage is shared by origin, not by project path. | Restrict cleanup to this application's prefix in the old project as well as the new one; use exact-cache reads and distinct namespaces. A second Pages path alone is insufficient isolation. |
| F07 | P2, confirmed missing lifetime contract | `initTdTab` returns only `setActive`; the animation chain continues scheduling while inactive, and many listeners are global. There is cleanup for individual resources, but no complete session disposal API. | Add an owner for listeners, RAF/timers, pending work, render targets, models and audio; expose `dispose`. Retain `runGen` checks during refactoring. |
| F08 | P2, confirmed module identity risk | Tokened and untokened imports coexist. Existing guard catches split `export let`, but mutable exported objects such as feel presets also have identity. The boot depends on URL normalization and roster evaluation order. | Canonicalize imports in the new app, use one build identity, and pass selected roster/config explicitly after parity. Do not upgrade Three.js simultaneously. |
| F09 | P2, confirmed simulator input weakness | `sim-tab.js:54–56` accepts any message containing `simresult`; `addRow` interpolates payload strings into HTML. STOP changes the frame but leaves the pending promise until message/timeout. The iframe URL omits explicit roster/config. | Validate origin, source, run ID and payload; render text as text; cancel the active run immediately; include resolved configuration. Treat this primarily as benchmark integrity. |
| F10 | P2, observed content error | `index.html:213` says insignia are “lost with the tank.” Current rules retain pilot rank across hull loss, with an explicit probe near `td-tab.js:17265`. The desktop manual screenshot shows the old claim. | Generate the manual/control help from current rule metadata. Explain what persists on hull loss. |
| F11 | P2, confirmed integration coverage gap | Tests cover useful isolated invariants, but some integration checks are regex/source assertions. Browser probes are mostly manually invoked, outside `npm test`; no tracked CI workflow was found. | Add a small browser acceptance matrix for boot, input, build, reset, loss, sector transition, both rosters, and missions. Assert outcomes, not implementation text. |
| F12 | P3, source-supported cost risks | `releaseSpawns` shifts a growing array; target/motion/render work shares the frame path. HUD and next preview regenerate on painted frames. A separate wave-sprite WebGLRenderer exists at `5548`, despite notes describing a single context. | Measure total frame cost and context/resource counts; use a spawn cursor, dirty HUD updates, bounded FX and spatial candidate queries where profiling warrants them. |

The cache finding follows the platform's [CacheStorage behavior](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage). Resource ownership must include explicit geometry/material/texture disposal; removing an object from a scene alone does not release these GPU allocations ([Three.js disposal guide](https://threejs.org/manual/en/how-to-dispose-of-objects.html)). These references support the platform facts, not a claim that this audit measured a memory leak.

Additional integration concerns to test during extraction: `endHack` schedules a delayed close without capturing `runGen`, and victory schedules a delayed callout similarly. Those callbacks sit outside the otherwise established run-generation discipline. They are candidate reset races, not reproduced failures. The blur handler clears held keys but does not express a complete pause policy; test focus loss, mobile suspension and resume explicitly before changing their behavior.

**4. Gameplay and difficulty**

The valuable strategic choice is **hold for income versus drive out to suppress the source**. The tactical choice is **use the tank now versus spend resources and wait for Isao**. Towers occupy high ground while enemies and the tank use lanes; curvature and occlusion make reconnaissance meaningful. Ramming fodder, hard targets that punish contact, line-sensitive Lancers, and the A6's return/reload cycle are recognizably different jobs.

Keep the sentry board as the normal campaign and classic as a regression/content variant. Keep rescue and raid as separate mission definitions over the same runtime. Keep the jelly shelved until a specific encounter needs it. Do not add foundations during extraction: the PM log explicitly records “don't make it yet,” and a third construction dependency would obscure whether existing travel/printing already creates enough pressure.

Current nominal wave-plan output, assuming every sector runs all 15 waves:

| Global wave | Sector | Headline | Total bodies | Sum of starting HP |
|---:|---:|---|---:|---:|
| 1 | 1 | phage | 4 | 4 |
| 2 | 1 | ghost | 8 | 8 |
| 3 | 1 | scoutufo | 14 | 14 |
| 8 | 1 | corona | 20 | 33 |
| 9 | 1 | barbed | 65 | 98 |
| 12 | 1 | knot | 135 | 139 |
| 15 | 1 | phantom | 239 | 256 |
| 16 | 2 | phantom | 189 | 230 |
| 30 | 2 | phantom | 1,024 | 1,278 |
| 45 | 3 | phantom | 2,374 | 2,952 |
| 60 | 4 | phantom | 3,409 | 3,644 |
| 75 | 5 | phantom | 5,334 | 5,774 |

These are scheduled counts, not measured simultaneously living enemies. Closing gates drops their queued spawns. Seeded support choices produce local dips; the broader growth is still extreme. Headline selection saturates at phantom after wave 15, so later sectors mostly increase quantity rather than introduce a new headline composition. Early gate closure changes the global wave at which each sector begins, coupling threat/unlock progression to how much income was skipped.

At wave 75 the nominal release rate is about 1,667 bodies/second over the 3.2-second spread. A wave-cap trigger can add pressure while the previous wave remains alive. This couples combat difficulty to CPU/GPU load; a harder wave may also make controls less responsive. Fix the pressure model before balancing around those counts.

The retained 30 August datasets contain eight runs per policy, both before and after that day's adjustment. Post-adjustment results include seven ram-policy wins, seven builder losses, and seven floor-policy losses. Those are historical outcomes under historical rules, not current campaign success rates. Current seed-1000 samples:

| Roster / policy | Outcome | Wave | Time | Towers | Biomass |
|---|---|---:|---:|---:|---:|
| Sentry / ram | loss, repeated identically | 3 | 87s | 2 | 249 |
| Sentry / builder | loss | 2 | 67s | 4 | 16 |
| Classic / ram | loss | 3 | 87s | 2 | 249 |

The ram sample still has three hulls and money when the heart dies. The builder buys four towers and still loses early. That points toward placement, readiness, travel delay, targeting and policy quality as investigation targets. It does not establish that a human player needs more starting currency, or that the new roster caused a regression; the classic sample also loses.

**Recommended tuning process, in order:**

1. Repair F02/F03/F05. Add build hash, generator version, balance version, mission, roster, full resolved parameters, input policy, seed, fixed step and sector result to every run.
2. Create a pure campaign director with explicit global progression and local wave index. Preserve current behavior as a named baseline before testing another curve.
3. Budget threat per encounter using health, speed, heart damage, special behavior and lane exposure. These weights are tuning parameters, not established physics. Author peaks and recovery waves instead of multiplying every later wave indefinitely.
4. Bound spawn throughput and concurrent threat. If the field is saturated, postpone a batch and display reinforcement timing; do not silently discard an enemy or spawn the entire backlog on the next frame.
5. Keep a Normal full-15-wave configuration initially. Experiment with wave-9 pressure at 1.25–1.5× wave-8 threat instead of today's roughly 3× HP jump, and distribute it over a longer release window. These are starting experiments, not recommended final numbers.
6. Separately test a shorter campaign configuration (for example 8/10/10/12/12 waves). This changes the established 15-wave default and needs playtest acceptance. Do not combine the experiment with weapon or economy changes.
7. Compare same-seed policies: passive floor, builder, ram+builder, early gate hunter, mixed/adaptive. Use 30 seeds for iteration, then 100 held-out seeds for a candidate. Add explicit mission and sector-transition coverage; keep runs sequential on this machine.
8. Test real players separately: new players, returning players, experienced TD players; distinguish touch and keyboard. Bots find regressions and structural failures, not fun or fair human win rates.

Record per wave: damage/leaks by type and source gate; time-to-heart; tower orders/arrival/ready times; idle and blocked drone time; effective damage and overkill by weapon; shots lost to terrain/lock; slow-field contribution through added exposure time; A6 travel, engagement, return/reload and death; spending by category; time unable to afford a useful available option; frame-time p50/p95/p99 and peak living entities. Report sector completion and campaign completion separately. Use matched seeds and paired deltas, and retain timeouts and losses in the denominator. Current clear-only curves suffer survivor bias.

Nominal tier-0 single-target DPS is Rotor .220, Plasma .267, Quiver .173, Mortar .120, Lancer .150, Howitzer .170, A6 .320 while firing, and Relay zero. Those figures omit aim, lock, travel, reload, splash, piercing and uptime; never equalize weapons by that table alone. Test Rotor against fodder, Plasma at short lane exposure, Quiver against moving hard targets, Relay+damage pairs against separate damage towers, Lancer on straight lanes versus corners, both lobbers against groups, and A6 including its complete sortie. Rank upgrades and unlimited fodder rams also amplify income and power; study them together.

Economy tuning should preserve the ram premium while checking whether reduced tower kill pay makes careful defense structurally poor. At the current streak cap, a ram earns roughly 3.75× base bounty before rounding versus a tower's roughly 1.5×, with small-bounty rounding differences. Streak loss on a leak removes future income just when the player is already struggling. Test a softer streak reduction on an easier mode before globally reducing rewards. Refunds must not masquerade as fresh income in the analysis.

**5. UX and gameplay improvements**

The clean mobile capture is much clearer than the diagnostic capture, but still divides attention among status, radar, a large contextual instruction, build, weapons, and the game world. The normal desktop cold open ends in a field manual listing many systems at once, including the incorrect rank-loss rule. A zero-overlap report establishes rectangle separation at one instant; it cannot establish readability, attention cost, or an unobstructed aiming area.

Prioritize these changes:

- **Teach one decision at a time.** Begin with defend the heart, ram a soft target, then fire at a dangerous target. Teach the first tower when the player can afford it; introduce Isao's travel and printing on that order. Keep a readable manual accessible later. A returning player should reach active control with one explicit action and be able to skip cinematics.
- **Use action-specific HUDs.** While driving, retain heart/hulls, ammunition, immediate wave threat and radar. Expand biomass, tower tiers and the construction queue in build mode. Put career records, detailed score and long descriptions in pause/debrief. Preserve the terminal visual language, but offer a plain-text/reduced-glow presentation.
- **Make delayed construction legible.** Show a placement ghost, accepted order, destination, position in queue, and travel/print ETA. On rejection, explain terrain, occupancy, unlock or insufficient biomass next to the attempted cell. Allow cancel/reorder with the refund amount stated before action. Audit existing `placeError`, order and Isao status paths before adding duplicate feedback.
- **Clarify control ownership.** Use two primary destinations: DRIVE and BUILD. Make manual/autopilot ownership unmistakable. Bastion, drone and first-person views can remain deliberate contextual or advanced choices. Do not silently change ownership just because the player idles.
- **Respect spherical visibility.** Show an off-screen heart-threat bearing and estimated urgency; distinguish a gate beyond the horizon from a visible target. A build preview should show useful firing coverage, including line-of-sight for the Lancer, rather than imply all radius-covered cells are hittable.
- **Prioritize messages.** Death, imminent leak and direct player decisions outrank unlock announcements and Isao flavor. Coalesce repeated remarks; give flavor a dwell time and transcript. Current Isao briefs already auto-expire and are non-pausing, so the old playtest complaint should be rechecked rather than “fixed” by introducing that behavior again.
- **Explain defeat and recovery.** Separate hull destroyed from heart destroyed. State that pilot rank survives a replacement hull. Debrief should name the leak source, missing coverage or unfinished orders, and offer a repeatable seed. Do not let optional purchases consume the only way to continue.
- **Add redundant threat cues.** Preserve the belt palette, but reinforce ram-safe versus hard targets using silhouettes, solid-core markings and targeting labels. Validate readable text and touch targets at actual device scale. Include remapping, reduced flash/shake, subtitle-style cues and separate sound controls in the standalone settings backlog.
- **Respect interruptions.** Define pause/resume behavior for focus loss and mobile backgrounding. For a potentially 75-wave campaign, a sector-boundary suspend/resume snapshot is more valuable than another weapon type. Store config/generator versions with it; do not promise arbitrary mid-frame saves during extraction.

Playtest questions: Can a new player identify the heart and an unsafe ram target without reading a manual? Can they explain why a commissioned tower is not firing yet? Can they recover their orientation after switching to build? Can they tell why they lost? Does closing a gate feel like a meaningful sacrifice, and can they always continue afterward? Track completion times and misinputs alongside observation, not preference ratings alone.

**6. Extraction plan**

The detailed file ownership, target structure, phases and acceptance gates are in [EXTRACTION.md](EXTRACTION.md). The central sequencing rule is **copy a working vertical slice before reorganizing its internals**. Do not combine a repository split, renderer upgrade, TypeScript conversion and balance overhaul in one change.

Keep game-facing labs with the game as developer-only entry points because their subjects and presets are shared. Leave grid, maze, organic and historical combat studies in research. Initially vendor a pinned snapshot of the spherical kernel with a provenance manifest; later promote the stable kernel to a versioned package if both repositories actually need frequent updates. One owner publishes changes; the other consumes a pinned version. Never maintain two manually edited kernel copies.

**7. Logs, decisions and release hygiene**

Existing history is substantive: `DEVLOG.md` is about 406 KB, `CLAUDE.md` about 41 KB, and private `.deban/` contains an index, four role files and a session log. The `/deban` skill source was located at `/Users/minikai/Dev/claude-skills/deban/SKILL.md` (v2.0). There was no project-local skill registration or `~/.claude/skills` directory in the locations inspected; this proves the source exists, not that a particular running Claude profile exposes `/deban`.

Its query workflow was used to read architecture, PM, development and research decisions. Keep the private vault private. It should not be copied into a published application or silently added to Git. Keep dead ends append-only. An audit recommendation belongs under proposed/open work until accepted, not in the list of settled operator decisions.

History drift is demonstrable: the index still lists the slow-field visual optimization as unimplemented while its Key Decisions describes it as done; role frontmatter dates lag September 6 entries; the PM assumptions still call the original visual hypothesis untested; older entries describe the beam issue before its final width diagnosis. These are reasons to link each current decision to its latest resolution, not to delete earlier investigation records.

For the standalone repository create a short current-state document and numbered architecture decisions with status, date, owner, alternatives, evidence, supersedes links and consequence. Seed it with the sphere/arc units contract, pure-rule/presentation split, default+classic rosters, gate vulnerability, five-sector spine, Isao order fulfillment, run-owned async work and shared lab subjects. Preserve links back to research commits. Maintain a separate balance changelog with before/after parameters and matched run data.

Runtime diagnostics should have a versioned structured event schema, bounded in-memory ring buffer, event priorities and an explicit “export diagnostic bundle” action. Include build, seed, mission, roster, resolved settings, step/time, sector/wave, command, result, relevant entity IDs and error stack. Export high-rate traces only in diagnostic mode. Normal play does not need per-frame console spam or remote analytics. Keep generated captures out of normal release artifacts; the local ignored `renders/` tree currently occupies about **9.47 GB**, whereas the runtime asset directory is about **29.7 MB**. These are checkout sizes, not download sizes.

Asset provenance needs a machine-readable inventory of runtime files, source project, revision/hash, intended use and attribution record. Existing `ATTRIBUTIONS.md` and font licenses provide a start; `assets/audio/src` contains original filenames and processed copies elsewhere, but this audit did not establish a complete clip-by-clip rights manifest. Carry notices for vendored dependencies and models; do not treat a generic “everything else is ours” sentence as a dependency inventory. This is an inventory gap, not a legal conclusion.

**8. Recommended first work package**

1. Repair the simulator schema/outcome/ledger and add a regression for debrief solvency. Capture a named baseline for both rosters.
2. Fix cache ownership and incorrect player help. Establish a browser acceptance runner around existing probes.
3. Create the separate game repository locally with the existing game, pinned kernel, assets, embedded hacks and developer labs; verify it from an unrelated checkout path with the research server stopped.
4. Give the new app independent routing, storage/build/cache identity and a small release manifest. Preserve an archival playable build and links in research.
5. Separate session state and input commands, then waves/economy/orders/objectives, then rendering/UI. Keep each step playable and measurable.
6. Run the controlled balance and UX passes above. Change one family of variables at a time.

The repository split is ready to plan concretely now. A claim that the campaign is balanced or device-ready is not yet supported by the available measurements.
