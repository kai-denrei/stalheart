# Stalheart current state

Updated 2026-09-16 (the V1 session, overnight build). Owner: the Stalheart development project; this repo is authoritative for the game.

**Identity: resourceful joy under pressure** (`2026-09-14-identity-resourceful-joy-under-pressure`). The pressure is the swarm, the clock and the hardware; the joy is Isao, the builder who rebuilds, and a colony grown out of the wreck it arrived in. See [FUNMAP.md](FUNMAP.md).

## What the game is now: the V1 session

Design: `docs/superpowers/specs/2026-09-15-v1-session-design.md`. A bare `index.html` plays start to finish:

- **The opening grows the base.** The SH02 lands, the foundry recycles it, Isao prints the Rotor, then prints the gate and walls (the tremor waits for the gate), the Stålheart, the solar array, the bays, HUGIN, the radar and the assembly line through his travel-and-print loop; each printed step switches on a perk (`src/content/base-programme.js`, `src/domain/build-programme.js`, `src/fx/base-print.js`). Explicit `stage=N` links stay static.
- **A second entry point for friends** (`2026-09-16-skip-tutorial-built`): a SKIP TUTORIAL button stands in the story's chrome from the landing until the handover takes it away, and `index.html?skip=defence#td` is the same entry as a bookmarkable link (no `acceptance=1`). It opens a real run at the finished base, past the handover, with the Relay and the Mortar earned, and the sector loop starting at sector 2 so the back door is the first fight. `src/fx/skip-tutorial.js`, `src/core/story-route.js`, `STORY_SKIP` in `src/content/story-defaults.js`.
- **Sectors are the loop past the handover** (`src/content/sectors.js`, `src/domain/sectors.js`, `src/fx/sector-run.js`): each sector opens two breaches with their own wave programmes; a breach closed early (the gunship's 105, the strike, tank shells, SOL-82) books what its remaining waves would have paid as LEFT IN THE FIELD; a breach held to the end collapses and pays HELD. The swarm wears the gate down (`src/domain/gate-integrity.js`) and walks in when it breaks. Sector 2 cracks the sealed mouth behind the bays (`src/domain/back-door.js`) and brings SOL-82 online; sector 3 fights on both sides; KEEP HOLDING generates more.
- **The debrief** (`src/fx/sector-debrief.js`, lab `labs.html#debrief`): five animated pages (SECURE, the breaches, the kills, the tank, the colony) with count-ups and stamps, fed by the sector books (`src/domain/sector-stats.js`); THE COLONY HOLDS after sector 3; LAST TRANSMISSION on a loss.
- **The arsenal:** the MÖRK tank with the shield, which recharges at the solar array's pad from a reserve refilled each sector, and the ram readout (`src/domain/shield.js` arrayDraw, `src/fx/shield-array.js`, `src/fx/ram-readout.js`); automatic towers ordered through Isao; the Heavy Gunship, called from its meter, now creeping toward the busiest breach (`src/domain/gunship-track.js`); SOL-82, the orbital laser, on its pass clock with its own seat on the views strip (`src/fx/laser-arsenal.js`, `src/fx/laser-seat.js`, `src/fx/laser-station.js`).
- **Expeditions you can see:** our flag rises at a cleared site, the part rides home as a crate on the MÖRK's back and drops at the foundry with the unlock callout; trophy flags stand at home (`src/fx/cargo.js`, `src/fx/expedition-glue.js`; SentryTowers_A6 assets pinned in `docs/cargo-assets.lock.json`).
- **A readable first run:** the Quiver's round stays in frame through launch (`src/core/round-framing.js`), campaign clutter is off in the story, and a controls card teaches the tank's keys once (`src/fx/controls-card.js`).
- **The campaign board stays underneath** for the acceptance runs and the wave simulator (`?acceptance=1`, `?sim=`); its debrief now lives in `src/fx/campaign-debrief.js`.

## Working baseline

Unchanged from the foundation: pure core/domain/content layers with dependency guards, shared immutable FX packages (base `stalheart-fx-8`), native ESM with vendored Three.js r160, one numbered Sentry roster, the baked story planet, meshopt-packed release models, local diagnostics and isolated storage. Workshop labs: units, swarm, beam, audio, metal, story, sentry/impact, breach, gunship, orbital laser, debrief, sim, and the docs overlay under DEV.

## Next priorities

1. **Owner playtest of the V1 session** with friends: session length, sector difficulty (every sector, gate and forfeit number is a first cut), whether closing early feels like a choice, whether the debrief lands.
2. **Flaky step:** `--story-world`'s Rotor heat-peak assertion banks `__rotorHeatMax` once per harness poll, not per frame, so a run where the piloted Rotor clears the wave quickly can sample under its 0.05 threshold and fail on one tree while passing on another (seen twice on 2026-09-16 branches, green on main both times). Fix it by sampling from inside the page before trusting a failure there.
3. **Known gaps from the overnight build** (see the 2026-09-16 log entries): the saved gunship briefing at the next sector brief and the G key are untested in a browser; no second gate (the back stays open); Isao's gate repair is not animated; SOL-82 burns only the Stålheart among buildings, reads "in range" at 640 m, and its scorch survives NEW RUN; the gunship seat still costs ~100 ms the first time it is taken; the crate on the hull was verified by numbers, not seen in a screenshot; touch labels on the pad are untested; a print is a Y-scale rise without a clipping plane.
3. The puzzle tower defence (`2026-09-14-puzzle-tower-defence-and-the-handover`): tower geometry, authored challenges and generated waves scored on margin now sit on top of the sector loop.
4. Still open from before: the phage's movement, MÖRK LOW re-pin, Isao-Birudorōn review, landmark LOD review, the sphere-helper refactor (`docs/SPHERE-TO-FLAT-COST-MAP.md`).

Owner-directed sequence remains **architecture → visual/sound labs and clean exports → UX → playability**. [Architecture and implementation boundaries](ARCHITECTURE.md) are the technical plan.

## Boundaries

A browser document owns one game or lab lifetime; route changes reload. The reusable kernel is pinned in `src/`, not yet a published dependency. No arbitrary-surface expansion, tower foundations, multiplayer or renderer replacement is underway. Public GitHub repository and Pages publication are authorized; the V1 branch was built locally and is not pushed without the owner's OK.

## Evidence

Run `npm test`, `npm run check`, `npm run build`, `npm run test:browser` (plus `--story`, `--story-world`, `--defense`, `--sectors`, `--grow`, `--backdoor`, `--laser-game`, `--laser`, `--shield-story`, `--quiver-frame`, `--debrief`, `--nav`, `--gunship`, `--sinkhole`, `--breach-game`), and `node scripts/browser-test.mjs --dist`. Browser suites can run two at a time through `scripts/browser-lock.sh`. `npm run check` includes the architecture guard. Browser artifacts are in `artifacts/`.
