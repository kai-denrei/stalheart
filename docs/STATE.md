# Stalheart current state

Updated 2026-09-17 (after the V1 playtest rounds of 2026-09-16). Owner: the Stalheart development project; this repo is authoritative for the game.

**Identity: resourceful joy under pressure** (`2026-09-14-identity-resourceful-joy-under-pressure`). The pressure is the swarm, the clock and the hardware; the joy is Isao, the builder who rebuilds, and a colony grown out of the wreck it arrived in. See [FUNMAP.md](FUNMAP.md).

## What the game is now: the V1 session, two ways in

Design: `docs/superpowers/specs/2026-09-15-v1-session-design.md`. Two entry points, both real runs at the full threat:

- **The bare page** (`index.html`) plays start to finish. The SH02 lands, the foundry recycles it, Isao works the AFR-01 with his beam and prints the Rotor, then the gate and walls (the tremor waits for the gate), the Stålheart, the solar array, the bays, HUGIN, the radar and the assembly line through his travel-and-print loop; each printed step switches on a perk (`src/content/base-programme.js`, `src/domain/build-programme.js`, `src/fx/base-print.js`). The Rotor and the Quiver are piloted once each, then the towers run themselves. Explicit `stage=N` and `story=N` links stay static and sparse.
- **SKIP TUTORIAL** (`index.html?skip=defence#td`, and the button in the opening's chrome): a run at the finished base, past the handover, with the Relay and the Mortar earned, opening at sector 2 so the back door is the first fight (`src/fx/skip-tutorial.js`, `src/core/story-route.js`, `STORY_SKIP` in `src/content/story-defaults.js`).
- **Sectors are the loop past the handover** (`src/content/sectors.js`, `src/domain/sectors.js`, `src/fx/sector-run.js`): two breaches per sector with their own wave programmes that climb into the hundreds; a breach closed early (the gunship, the strike, tank shells, SOL-82) books LEFT IN THE FIELD, one held to the end collapses and pays HELD. The swarm wears the gate down (`src/domain/gate-integrity.js`) and walks in when it breaks; Isao mends the gate and the walls between waves (`src/domain/repair-orders.js`). Sector 2 cracks the sealed mouth behind the bays (`src/domain/back-door.js`) and brings SOL-82 online; sector 3 fights on both sides; KEEP HOLDING generates more.
- **The debrief** (`src/fx/sector-debrief.js`, lab `labs.html#debrief`): five animated pages fed by the sector books (`src/domain/sector-stats.js`); THE COLONY HOLDS after sector 3; LAST TRANSMISSION on a loss.
- **The arsenal:** the MÖRK with eased steering, the shield recharged at the solar array's pad from a finite reserve, and the ram readout (`src/domain/shield.js`, `src/domain/steer-ease.js`, `src/fx/shield-array.js`, `src/fx/ram-readout.js`); automatic towers ordered through Isao; the Heavy Gunship, thermal only, creeping toward the busiest breach (`src/domain/gunship-track.js`), its third weapon the MK-9 mini nuke released from the belly (`src/fx/gunship-drop.js`); SOL-82 on its pass clock with its own seat (`src/fx/laser-arsenal.js`, `src/fx/laser-seat.js`). 7 8 9 0 take TANK, GUNSHIP, SOL-82 and MAP; the controls card teaches the keys once.
- **The optics:** the Quiver's scope in SOL-82's register, four phases, an inner box closing on the held body and telemetry in the margins (`src/fx/story-scope.js`); the round stays in frame through launch (`src/core/round-framing.js`).
- **Expeditions you can see:** our flag over a cleared site, the crate on the MÖRK's back, the drop at the foundry with the unlock callout, trophy flags at home (`src/fx/cargo.js`, `src/fx/expedition-glue.js`).
- **The campaign board stays underneath** for the acceptance runs and the wave simulator (`?acceptance=1`, `?sim=`).

## What landed on 2026-09-16 (the playtest rounds, one line each)

- Held inputs release when the page stops listening; the gunship optic is thermal only and its contact squares are gone; 7 8 9 0 take the seats (`2026-09-16-playtest-input-and-views`).
- A bare page fights the full threat (it had the deep link's 0.35), the wave ladder climbs through the invasion surge instead of shrinking, Isao repairs the gate and walls, the hull's steering eases (`2026-09-16-playtest-difficulty-and-rebuild`).
- The grey sheet over the landing was the foundry's skinned mesh cloned by reference; landmarks now clone with a rebinding clone (`2026-09-16-playtest-grey-sheet`).
- Isao prints walls, not rock: the repair scan waits for the gate step (`2026-09-16-isao-prints-walls-not-rock`).
- The procedural survey tank is deleted; a hull is MÖRK or an empty placeholder (`2026-09-16-legacy-tank-removed`).
- The Quiver's scope rebuilt as a live instrument (`2026-09-16-quiver-scope-built`).
- Isao works the AFR-01 with his beam before the gate, a beat that costs the opening a constant 14.5 s (`2026-09-16-isao-works-the-foundry-built`).
- The gunship's third weapon is the MK-9: a modelled TALON falls two seconds, ignites and dives onto the painted cell, one release a pass, 55 m blast, DANGER CLOSE over our own (`2026-09-16-gunship-mini-nuke-built`).
- SKIP TUTORIAL as a button and a URL (`2026-09-16-skip-tutorial-built`).
- Merging the eleven overnight branches caught three regressions the branch suites missed (`2026-09-16-v1-merge-regressions-caught`); the QA playthrough fixed booked prints, stray breaches, the gunship briefing over a live sector and the HUD (`2026-09-16-v1-playthrough-fixes`).
- Rock breaks do not scale with open breaches; the back-door step waits out the breach shot (`2026-09-16-rock-break-with-live-breaches`). The laser lab step aims through the heading-up lens again (`2026-09-16-laser-lab-step-retimed`).
- The `--story-world` Rotor heat peak is sampled per frame inside the page rather than per harness poll (`2026-09-16-state-refresh-and-heat-probe`).

## Working baseline

Unchanged from the foundation: pure core/domain/content layers with dependency guards, shared immutable FX packages (base `stalheart-fx-8`), native ESM with vendored Three.js r160, one numbered Sentry roster, the baked story planet, meshopt-packed release models, local diagnostics and isolated storage. Workshop labs: units, swarm, beam, audio, metal, story, sentry/impact, breach, gunship, orbital laser, debrief, sim, and the docs overlay under DEV.

## Next priorities

1. **The owner's two open calls.** Whether to trim the foundry beat's +14.5 s on the opening (8 s of beam, ~6.5 s of flight; the tremor waits for the gate, so the first wave pays every second). And the frame rate at 400+ concurrent enemies: sector 3's biggest wave measured 406 alive at p50 20.9 ms (about 48 fps), 1496 alive at p50 24.4 ms under deliberate overload; it is being profiled before anything is optimised.
2. **Known gaps.** Most of the 2026-09-16 list was closed on 2026-09-18 (`2026-09-18-robustness-pass`): the laser scorch clears on NEW RUN, Isao flies to the dropped crate, the MK-9's ignition is its own burst and its one release a pass is proven in a browser, SOL-82 burns every building and a burned one costs the colony that building's perk, and Isao's gate repair is an animated print with GATE % climbing under his beam. Still open:
   - **The back gate is in** (`2026-09-18-back-gate-built`): once the back breach is held, Isao prints a door across the collapse and sockets along the back lane; `GATE · BACK` on the HUD, repairs take the worst door first. Not yet seen: a hull driving up to the back door, and back-door wear under a real pile.
   - **The gunship seat's first-use hitch is halved, not gone**: 78.6 ms and 18 shader programs became 65.9 ms and 9 (`src/fx/program-warm.js`). The nine that survive were not explained.
   - Touch labels on the pad are untested; a print is a Y-scale rise without a clipping plane.
3. The puzzle tower defence (`2026-09-14-puzzle-tower-defence-and-the-handover`): tower geometry, authored challenges and generated waves scored on margin now sit on top of the sector loop.
4. Still open from before: the phage's movement, MÖRK LOW re-pin, Isao-Birudorōn review, landmark LOD review, the sphere-helper refactor (`docs/SPHERE-TO-FLAT-COST-MAP.md`).

Owner-directed sequence remains **architecture → visual/sound labs and clean exports → UX → playability**. [Architecture and implementation boundaries](ARCHITECTURE.md) are the technical plan.

## Boundaries

A browser document owns one game or lab lifetime; route changes reload. The reusable kernel is pinned in `src/`, not yet a published dependency. No arbitrary-surface expansion, tower foundations, multiplayer or renderer replacement is underway. Public GitHub repository and Pages publication are authorized; nothing is pushed without the owner's OK.

## Evidence

Run `npm test`, `npm run check`, `npm run build` and `node scripts/browser-test.mjs` (the default suite: boot, input, the Workshop labs, the simulator). The targeted browser steps, each `scripts/browser-lock.sh node scripts/browser-test.mjs <flag>`: `--story` (the arrival cine), `--story-world` (the opening from stage 1 through the Quiver, the study, the bays and the deep links), `--grow` (the bare page's printed base), `--skip-tutorial`, `--defense` (the handover, the called gunship, the expedition), `--sectors`, `--backdoor`, `--waves` (`--last` for the biggest wave alone), `--shield-story`, `--shield-perf`, `--quiver-frame`, `--gunship`, `--laser-game`, `--laser` (the lab), `--missile-parity`, `--debrief`, `--nav`, `--sinkhole`, `--breach-game`, and `--dist` for the packed release. Browser suites run two at a time through the lock and must never be run without it. `npm run check` includes the architecture guard. Browser artifacts are in `artifacts/`.
