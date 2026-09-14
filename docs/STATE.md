# Stalheart current state

Updated 2026-09-14 (PoC cleanup). Owner: the Stalheart development project; this repo is authoritative for the game.

**Identity: resourceful joy under pressure** (`2026-09-14-identity-resourceful-joy-under-pressure`). The pressure is the swarm, the clock and the hardware; the joy is Isao, the builder who rebuilds, and a colony grown out of the wreck it arrived in. See [FUNMAP.md](FUNMAP.md).

## What the game is now

- **The story is the game.** A bare `index.html` is the story world: the SH02 lands on the baked 753 m planet, the AFR-01 foundry recycles it into feedstock, Isao prints the Rotor and the Quiver, the first swarm rises from a sinkhole, the study screen and the expedition follow. PLAYTEST · Defend opens the finished base (stage 8). See [STORY.md](STORY.md).
- **Piloted sentries and the gunship.** The story hands over its printed mounts (`src/sentry-pilot.js`); the Heavy Gunship rides a fixed pass on the view strip, gunner only, with the rotary, the Bofors and its own 105 (`src/domain/gunship.js`, `src/content/gunship.js`, `src/fx/gunship-*.js`). Piloted rounds fly straight from the barrel; a piloted Rotor round is worth one first-wave body and passes through three bodies.
- **The campaign board stays underneath.** Sectors, waves, economy, the debrief and ground breaches run on `src/td-tab.js` for the automated acceptance runs (`?acceptance=1`) and the wave simulator (`?sim=`, `labs.html#sim`). It has no player-facing entry.
- **Retired on 2026-09-14** (`2026-09-14-poc-remnants-removed`; Git history keeps all of it): rescue and raid missions, mines, the three hacking minigames and the antipode relay, the Mortar's hack gate and the black market, the classic entry with its tutorial, field manual and cold open, the director and the cine lab, portal rings and the wormhole/corona shaders, the MK-CX tanks and the pre-A6 props (server, dish, astronauts), the Astro diorama, the Sniper bench and the Sentry Control practice map. The Mortar now unlocks on the normal wave ladder.

## Working baseline

- Foundation v1: pure core/domain/content layers with dependency guards; shared immutable FX packages (base `stalheart-fx-8`); local per-subject review/apply/undo, project working copies, compact change summaries, JSON backups, explicit draft preview and deterministic promotion.
- Native ESM, vendored Three.js r160, Node 22+ tools. Source has canonical imports; `dist/` owns release tokens and a file manifest. Every model ships meshopt-packed; big landmarks swap derived far tiers by distance.
- One numbered Sentry roster (`src/content/sentries.js`) shared by the game and the labs. Sentry Terraformer 3000 is the Stalheart everywhere. MÖRK is the only tank.
- Workshop labs: units, swarm, beam, audio, metal, story, sentry/impact, breach (`labs.html#portal`, the sinkhole), sim and the docs overlay (FunMap, roadmap, devlog, practices) under DEV.
- Isolated `stalheart:v1:` records; local diagnostics; scope-specific service-worker caches. Immutable validated `docs/log/entries/*.json`; generated DEVLOG and ROADMAP.

## Next priorities

1. **Navigation shell landed** (`2026-09-14-navigation-shell-landed`): `PLAYTEST | DEV` top right on every game and workshop page with the build tag; PLAYTEST holds Story (stages, jumps), Defend, Arrival, Record, Settings; DEV holds the labs, the variables pages (Tuning), the docs over the page and Felt it. Next: use it in the seat and prune what nobody opens.
2. **Explosions landed** (`2026-09-14-explosions-flir-amoeba-landed`): the lab's modules at the gunship, orbital strike, tank shell and TALON impacts, the FLIR thermal view, the white amoeba first. Next: judge the look in the seat, then the FX-package explosion section and a lab picker; phone GPU cost is unmeasured.
3. **Hold the gunship against a real horde**: measure the swarm's render cost, tune the rotary and Bofors, check that sustained fire reads as herding.
4. Still open from the story playtests: the wall-breach freeze (~250 ms on the story planet), the Rotor's report by ear, ISAO-Birudorōn's review, the foundry in the game camera (`2026-09-14-story-playtest-open-items`).

Follow-ups left by the cleanup: the `portal_warn` and `server_dialup` cues are still keys in the shipped FX package and need a package migration to retire; `fabricator.glb` is still Isao's load fallback; `container.glb` still dresses the campaign board's life containers.

Owner-directed sequence remains **architecture → visual/sound labs and clean exports → UX → playability**. [Architecture and implementation boundaries](ARCHITECTURE.md) are the technical plan.

## Boundaries

A browser document owns one game or lab lifetime; route changes reload. The reusable kernel is pinned in `src/`, not yet a published dependency. No arbitrary-surface expansion, tower foundations, multiplayer or renderer replacement is underway. Public GitHub repository and Pages publication are authorized.

## Evidence

Run `npm test`, `npm run check`, `npm run build`, `npm run test:browser` (plus `--story`, `--story-world`, `--gunship`, `--sinkhole`, `--breach-game`), and `node scripts/browser-test.mjs --dist`. `npm run check` includes the architecture guard: the `src/td-tab.js` line budget and the frozen top-level module list in `docs/architecture-budget.json`. Browser artifacts are in `artifacts/`.
