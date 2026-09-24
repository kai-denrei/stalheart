# Stalheart current state

Updated 2026-09-25 (after the pacing round). Owner: the Stalheart development project; this repo is authoritative for the game.

**Identity: resourceful joy under pressure** (`2026-09-14-identity-resourceful-joy-under-pressure`). The pressure is the swarm, the clock and the hardware; the joy is Isao, the builder who rebuilds, and a colony grown out of the wreck it arrived in. See [FUNMAP.md](FUNMAP.md).

## What the game is now: the V1 session, two ways in

Design: `docs/superpowers/specs/2026-09-15-v1-session-design.md`. Two entry points, both real runs at the full threat:

- **The bare page** (`index.html`) plays start to finish, and its opening is **sector 0, THE FOUNDATION** (`2026-09-24-sector-zero-built`): the SH02 lands, the foundry recycles it, Isao works the AFR-01, prints the Rotor, the gate and walls and the Quiver, then starts the Stålheart, one 75 s print with a `STÅLHEART %` readout. Its construction is defended from the seats: the fifty on the Rotor, the Quiver's two hard cores, then construction waves every 11 s with the gunship arriving from orbit for a free pass. There is no hull until the Stålheart stands; the first MÖRK rolls out of it (124 s on a bare page), the handover follows (146 s) and sector 1 opens at about 188 s. Isao then keeps printing the solar array, the bays, HUGIN, the radar and the assembly line through his travel-and-print loop; each printed step switches on a perk (`src/content/base-programme.js`, `src/domain/build-programme.js`, `src/fx/base-print.js`, `src/fx/hull-issue.js`). Explicit `stage=N` and `story=N` links stay static and sparse.
- **SKIP TUTORIAL** (`index.html?skip=defence#td`, and the button in the opening's chrome): a run at the finished base, past the handover, with the Relay and the Mortar earned, opening at sector 2 so the back door is the first fight (`src/fx/skip-tutorial.js`, `src/core/story-route.js`, `STORY_SKIP` in `src/content/story-defaults.js`).
- **Sectors are the loop past the handover** (`src/content/sectors.js`, `src/domain/sectors.js`, `src/fx/sector-run.js`): two breaches per sector, **their waves on a clock** (`2026-09-24-sector-waves-on-a-clock`): a pulse every 12-16 s whatever is alive, waves stacking when the player falls behind, bounded by a 520-body frame budget; breaches open under the brief card on a near ring (45 hops, ten cells off the base's rim) and bodies march at 1.5. A breach closed early (the gunship, the strike, tank shells, SOL-82) books LEFT IN THE FIELD, one held to the end collapses and pays HELD. The swarm wears the gate down (`src/domain/gate-integrity.js`, 110 hp) and walks in when it breaks; Isao mends the gate and the walls once the lane is clear (`src/domain/repair-orders.js`). **The back door** (`2026-09-24-back-door-feast-and-scramble`): sector 1 rumbles at its second and last pulses (radar tremor, dust, Isao), sector 2 cracks the mouth behind the bays and opens on a feast of 60 soft bodies for the tank while the clock holds, then Isao asks for turrets behind the bays (the sockets ring) and the gate side opens; SOL-82 comes online there. Sector 3 fights on both sides; KEEP HOLDING generates more.
- **The debrief** (`src/fx/sector-debrief.js`, lab `labs.html#debrief`): five animated pages fed by the sector books (`src/domain/sector-stats.js`); THE COLONY HOLDS after sector 3; LAST TRANSMISSION on a loss.
- **The arsenal:** the MÖRK with eased steering, the shield recharged at the solar array's pad from a finite reserve, and the ram readout (`src/domain/shield.js`, `src/domain/steer-ease.js`, `src/fx/shield-array.js`, `src/fx/ram-readout.js`); automatic towers ordered through Isao; the Heavy Gunship, thermal only, creeping toward the busiest breach (`src/domain/gunship-track.js`), its third weapon the MK-9 mini nuke released from the belly (`src/fx/gunship-drop.js`); SOL-82 on its pass clock with its own seat (`src/fx/laser-arsenal.js`, `src/fx/laser-seat.js`). 7 8 9 0 take TANK, GUNSHIP, SOL-82 and MAP; the controls card teaches the keys once.
- **The optics:** the Quiver's scope in SOL-82's register, four phases, an inner box closing on the held body and telemetry in the margins (`src/fx/story-scope.js`); the round stays in frame through launch (`src/core/round-framing.js`).
- **Expeditions you can see:** our flag over a cleared site, the crate on the MÖRK's back, the drop at the foundry with the unlock callout, trophy flags at home (`src/fx/cargo.js`, `src/fx/expedition-glue.js`).
- **The campaign board stays underneath** for the acceptance runs and the wave simulator (`?acceptance=1`, `?sim=`).

## What landed on 2026-09-24/25 (the pacing round)

Owner: "fix the pacing of the game"; spec `docs/superpowers/specs/2026-09-24-session-pacing-design.md`, plan `docs/superpowers/plans/2026-09-24-session-pacing.md`.
- Sector 0 defends the Stålheart's construction; the tank comes out of it (`2026-09-24-sector-zero-built`). The handover comes 20 s after the hull is out even with leftovers, and harmless fodder no longer wears gates or hurts the heart.
- Sector waves on a clock, nearer and faster, heavier programmes (`2026-09-24-sector-waves-on-a-clock`).
- The back door: foreshadowed, a feast, a scramble for turrets (`2026-09-24-back-door-feast-and-scramble`).
- `--pacing` measures the whole session as an ideal defender (`--passive`: towers only) and found two leaks, both fixed (`2026-09-24-pacing-probe`). Passive, the towers alone lose sector 1 at about 61 s: the tank is the defence. Difficulty is the owner's playtest to call; the numbers are all content.

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

1. **The owner's pacing playtest.** Does sector 0 read as defending the construction, is sector 1 hectic but holdable with the tank, does the back door land as foreshadowed, feast, scramble? Every number is in `src/content/sectors.js` (SECTORS, SECTOR_TIMING, BACK_OMENS, SECTOR_GATE) and `src/content/story-defaults.js` (STORY_CONSTRUCTION); re-measure with `--pacing` and `--pacing --passive`.
2. **A refactoring round** (owner, 2026-09-25): simplify and make the code base more robust.
3. **Phone HUD says less** (`2026-09-19-phone-seats-say-less`, confirmed again by the owner on 2026-09-24: "mobile still displays an overwhelmingly cluttered HUD"). The phone pass proved nothing covers a control; it did not reduce what is shown. Next fix: one state line per seat instead of the plate and the ribbon, the hint box once, the shell hidden in seats, the ground-truth monitor inside its frame. Desktop unchanged. Retina cuts (bloom half-res, MSAA 2x) phones-only can ride along.
4. **Landed 2026-09-23/24.** The seat contract (`2026-09-23-seat-changes-robust`: one occupant at a time; a chain of seats returns to the first seat's camera) and a scripted hand-over that never evicts a gunner (`2026-09-23-a-beat-evicted-the-gunner`) — real bugs, but not the owner's. The owner's "everything off to the right" was `2026-09-24-safari-right-shift-fixed`: the spotting monitor restored the main viewport in device pixels where three takes CSS pixels, so on any 2x screen the world drew dpr× too large from the bottom-left while the HUD stayed put; the owner confirms the reticles centred on a 2x phone. The intro is four beats (`2026-09-24-intro-four-beats-built`, `2026-09-24-ram-beat-shows-the-tank`): labelled wireframes, one breach and its swarm, the MÖRK through a horde with its own low camera, the gunship on the horde; 25.5 s, once on the landing screen, `?intro=1` replays.
5. **Known gaps.** The first MÖRK starts under the Stålheart's gantry beside a carriage block, not from a real door; before the gunship arrives in sector 0 its button reads GUNSHIP · 0%. The gunship seat's first-use hitch is halved, not gone (nine shader programs survive, unexplained). The back gate has not been seen with a hull driving up to it, nor its wear under a real pile. The sinkhole's dust is hidden (it was invisible; a real dust pass costs ~45 ms/frame). Touch labels on the pad are untested; a print is a Y-scale rise without a clipping plane. Retina-only faults never show on kainode's dpr-1 display: test at dpr 2 through the harness (`gunship-retina`).
6. The puzzle tower defence (`2026-09-14-puzzle-tower-defence-and-the-handover`): tower geometry, authored challenges and generated waves scored on margin now sit on top of the sector loop.
7. **Direction, not yet designed (owner, 2026-09-24):** the colony becomes self-sustaining: SentryTowers_A6's settlement-industry and orbital-launcher assets as new unlocks (SOL-82 the natural launcher unlock), a production chain, and the end game of building elements for a Dyson sphere. Its own spec when it comes up.
8. Still open from before: the phage's movement, MÖRK LOW re-pin, Isao-Birudorōn review, landmark LOD review, the sphere-helper refactor (`docs/SPHERE-TO-FLAT-COST-MAP.md`).

Owner-directed sequence remains **architecture → visual/sound labs and clean exports → UX → playability**. [Architecture and implementation boundaries](ARCHITECTURE.md) are the technical plan.

## Boundaries

A browser document owns one game or lab lifetime; route changes reload. The reusable kernel is pinned in `src/`, not yet a published dependency. No arbitrary-surface expansion, tower foundations, multiplayer or renderer replacement is underway. Public GitHub repository and Pages publication are authorized; nothing is pushed without the owner's OK.

## Evidence

Run `npm test`, `npm run check`, `npm run build` and `node scripts/browser-test.mjs` (the default suite: boot, input, the Workshop labs, the simulator). The targeted browser steps, each `scripts/browser-lock.sh node scripts/browser-test.mjs <flag>`: `--story` (the arrival cine), `--story-world` (the opening from stage 1 through the Quiver, the study, the bays and the deep links), `--grow` (the bare page's printed base, sector 0 and the roll-out), `--pacing` (the whole session's timeline as an ideal defender; `--passive` leaves the doors to the towers), `--skip-tutorial`, `--defense` (the handover, the called gunship, the expedition), `--sectors`, `--backdoor`, `--waves` (`--last` for the biggest wave alone), `--shield-story`, `--shield-perf`, `--quiver-frame`, `--gunship`, `--seats` (the seat cycle matrix: every leave restores the camera the first seat recorded, and each gun fires at its reticle), `--laser-game`, `--laser` (the lab), `--missile-parity`, `--debrief`, `--nav`, `--sinkhole`, `--breach-game`, and `--dist` for the packed release. Browser suites run two at a time through the lock and must never be run without it. `npm run check` includes the architecture guard. Browser artifacts are in `artifacts/`.
