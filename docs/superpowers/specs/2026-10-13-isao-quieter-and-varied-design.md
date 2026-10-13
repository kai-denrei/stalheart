# Isao quieter and varied — design

Owner, 2026-10-13, point 3: "Isao, we need MORE voice lines variety, but less verbose in general… make him speak less often. Sometimes a
line is triggered, sometimes it's silence. New lines: 'Do not go gently into the good night' followed by 'rage, rage against the dying of
the light'. And 'The good: our mission to harness the stars'. 'The Truth: our superior technology will prevail'. 'The Beautiful; my work
is a form of beauty'."

Branch `isao-voice-variety`, cut from `pearl-enemies` at 29434e00 (worktree `~/Dev/stalheart-isao-voice`), and seiyu_voice `main`
(commit ce4219b). Local only; nothing pushed.

## 1. The survey: what makes him speak in story play

Every line goes through `src/fx/isao-voice.js` (one line at a time; a trigger rests `VOICE_TUNE.repeat` 12 s or its own `rest`; `space`
4 s of quiet after any line before a moment's own pick; a forced line cuts in). The moments:

| Source | Moments | Triggers |
|---|---|---|
| Briefs (td-tab showBrief / stepBrief, `src/isaobriefs.js`) | the tutorial and story beats, sector briefs, the gate's and heart's warnings, repairs | the brief id's trigger, or the exact recording of the words on screen (said whatever the rests) |
| Callouts and toasts (td-tab showCallout / showToast) | SECTOR SECURE, STAMPEDE — RAM THEM, SOFT ONES — KEEP THE CHAIN, RAM ×25/×50, BREACH SEALED / STILL OPEN, MÖRK DOWN!, PLASMA DRY, TACTICAL NUKE LAUNCHED, the sentry cap's NOT HERE | `VOICE_CALLOUTS`, matched on their start |
| Events (`isaoSpeak`) | mission, first_contact (contact card), print_done (tower-print), hull_rebuilt, sector_lost, shells_refilled, paint_pad, sol_firing (each automated SOL pass), mk9_release (every MK-9, forced), language_analysis (forced), sol88_liftoff (forced), heart_threat (a body within the heart's hops, asked every 5 s), repair_underway (each repair order), idle_flavor (no hostile up, asked every 5 s), the welcome's keys (forced) | `VOICE_EVENTS` |
| The finale (`src/fx/orbital-finale.js`) | ending_did_it / ending_dyson / ending_next | forced, timed |
| The boss lab (`src/labs/boss/chatter.js`) | its own director, forced | bait_* (not story play; unchanged) |

**Essential** (unchanged, speak as before): the mission, the arrival's and tutorial's briefs (and every exact on-screen take), the seats'
MANUAL OVERRIDE, first contact, the gate's and heart's warnings (gate_broken, gate_failing, heart_hit, heart_below_five), sector briefs,
SECTOR SECURE, sector lost, the back door, the canyon, the MK-9's release and SOL's countdown (forced / beat-timed), the study screen,
the welcome, the ending, the sentry cap, the new last stand. **Light** (`VOICE_FLAVOR`): the ram chatter (STAMPEDE, SOFT ONES, the
chain milestones, chain broken, good hit), idle and idle_flavor, the board, prints and orders (print_done, build_start, build_gate),
repairs (breach_sealed, isao_repair, gate_mended, gate_half, repair_underway), shells, hull rebuilt, the array, and the heart's chatter
(heart_threat and its follow-up), plus the owner's trio as rare lines.

**How often each fires** — `scripts/browser-test.mjs --voice-rate` (new: a sector from its start, every moment asked of him
`isaoSay.asked` and every line said `isaoSay.log`, on the game's clock), five headless runs, 19.2 game minutes: sector 2 culled every
15 s (twice), sector 7 culled every 15 s (it became BOTH WALLS), sector 4 culled every 30 s and sector 5 every 20 s (both lost; the
harness's clock ran at real time, 1.00 game min a wall min). Moments asked a game minute: idle_flavor 5.7, first_contact 1.9 (a skip page
meets every type at once; a real run meets each once), soft ones 0.94, repair_underway 0.78, stampede 0.57, build_start 0.52, sector
brief 0.42, breach sealed 0.42, heart_threat 0.36, SECTOR SECURE 0.31, gate_half 0.31, heart_hit 0.21, gate_broken 0.16, gate_mended
0.16, canyon_pass 0.21, the rest under 0.1; about 2 a minute more are briefs and callouts with no recording (BREACH A HELD, the build
briefs, a brief's second line).

Lines a trigger has (after this change): idle_flavor 26, build_start 8, print_done 8, stampede 7, soft ones 7, breach_sealed 7,
repair_underway 5 (was 1), heart_threat 5 (was 1), first_contact 5, gate_broken 5, mk9_release 5, most others 1-4.

Not in the harness's streams: the player's own moments (the ram chain, RAM ×25/×50, the seats, the MK-9, SOL's automated passes, prints
the player orders). The light lines they raise are on the same chances and gaps.

## 2. Speaking less often: the knobs (`src/content/voice-hooks.js`)

| Knob | Was | Now |
|---|---|---|
| `VOICE_FLAVOR` | 18 triggers | + repair_underway, heart_threat |
| `VOICE_TUNE.flavor` (default chance, least rest of a light trigger) | 0.35, 90 s | 0.25, 120 s |
| `VOICE_TUNE.chance` (a light trigger's own chance) | — | idle_flavor 0.15, stampede 0.3, soft ones 0.25, print_done 0.25, build_start 0.25, breach_sealed 0.35, repair_underway 0.35, heart_threat 0.5 |
| `VOICE_TUNE.lightGap` (seconds after the end of the last light line before another) | — | 40 |
| `VOICE_TUNE.short` (light lines over `over` s are picked `weight` as often) | — | over 3 s, 0.35 |
| `VOICE_TUNE.rest` | repair_underway 60, heart_threat 120 | 90, 180; the trio 900 each |
| `VOICE_TUNE.wait` (seconds a once-a-run line waits for its turn instead of being dropped) | — | last_stand 8 |
| `VOICE_SEQUENCE` (a line another follows after `beat` s, on `chance`) | heart_threat_more forced 0.6 s after heart_threat, every time (src/fx/isao-moments.js) | last_stand_01 → last_stand_02 (0.6 s); heart_threat_01 → heart_threat_more_01 (0.6 s, chance 0.5) |
| `VOICE_RARE` (a moment's rare alternative) | — | the trio, below |

Every roll goes through the module's injected `rand`, every time through its `now` and `later` (`test/isao-voice.mjs`). A light line
passed over on its chance rests as if said (as before). Essential triggers have no chance, no light gap and no weighting.

Also fixed: BREACH SEALED could say "Still open. One more segment." (`breach_sealed_03` is now that moment's only line, the others only
BREACH SEALED's, `VOICE_LINE_MOMENTS`).

**Before / after.** The five streams replayed through the old module and content (an APFS snapshot of 29434e00 plus the ask log) and
the new, 40 seeds each, on the game's clock (`replay.mjs` in the session scratchpad; the stream is independent of the voice's decisions
but for heart_threat_more, emulated for the old tree):

| Lines a game minute | Before | After |
|---|---|---|
| light | 0.96 | **0.50** (0.40 + the owner's trio 0.09) |
| essential | 1.90 | 2.19 (+0.10 the last stand; first_contact and heart_hit said more often, the voice being free when they come) |
| all | 2.86 | 2.69 |

Light lines are halved (52 %, the trio included). In the live after-runs (`--voice-rate` on the new tree) sector 2 gave 0.20 light lines
a minute (before, the same route: 1.00), sectors 4 and 5 0.84 and 0.00. All headless, with no player: the absolute rates are the
harness's, the ratio is the finding.

## 3. Less verbose

The light triggers pick their lines over 3 s a third as often (`short`), and the new drafts are all under 2.4 s. The heart's 4.3 s
"I anthropomorphize the Stalheart as a woman. She Creates." follows only "Get away from her", one time in two. No existing line is
deleted or rewritten. Proposals for the owner (shorter takes of the longest story lines; his words, his call):

| Line | s | Proposal |
|---|---|---|
| heart_threat_more_01 "I anthropomorphize the Stalheart as a woman. She Creates." | 4.3 | "She creates. I protect." |
| sentry_overload_01 "OVERLOAD. We can't manage more than ten auto-sentries." | 4.2 | "OVERLOAD. Ten sentries, no more." |
| canyon_rises_01 "The far side of the world: a canyon full of them. Hundreds." (the brief's own words) | 4.2 | "A canyon full of them. Hundreds." (and the brief's text with it) |
| idle_06 "Every Kilo of Biomass gets us closer to the stars." | 4.2 | "Every kilo: closer to the stars." |
| stalheart_begins_01 "At the pole: the Stålheart. A terraformer. The only one." | 4.1 | "The Stålheart. The only terraformer." |
| vibration_study_01 "They Speak through ground vibrations. Trying to decode it." | 4.0 | "They speak through the ground. Decoding." |
| manual_override_06 "The chips aren't ready for auto-targeting. Take over." | 3.8 | "Chips not ready. Take over." |
| foundry_deploy_04 "I'll Cannibalize our landing rocket. that's protocol." | 3.8 | "Cannibalizing the rocket. Protocol." |
| language_analysis_01 "Preliminary alien vibration language analysis." | 3.7 | "Alien language analysis." |
| gunship_calibrated_06 "GUNSHIP AUTOPILOT ENGAGED. SMART TARGETING ON." | 3.7 | "GUNSHIP AUTOPILOT ON." |
| build_gate_03 "The Gate opens automatically for you. You're welcome." | 3.7 | "The gate opens for you. You're welcome." |
| sector_brief_02 "Close one too early and we lose the biomass." | 3.4 | "Close one early, lose the biomass." |

The idle_flavor quotations (4-4.7 s) are the owner's references and are left whole; the short weighting and the 0.15 chance already make
them rare. SOL's countdowns are beat-timed and stay.

## 4. More variety: drafts written by the agent, for the owner's review

Twenty-six short lines for the light triggers heard most (the survey's top: soft ones, repair_underway, stampede, build_start, breach
sealed, heart_threat, and the prints). Rendered with the standard voice (am_michael 0.92, no overrides), **exported unapproved** in
seiyu_voice (the repo's practice for unreviewed drops; the player's ✓ is the owner's), marked as drafts in ISAO-VOICE-LINES.md's notes.

| Trigger | id | Line | s |
|---|---|---|---|
| print_done | print_done_05..08 | "Printed." / "Solid." / "Another one standing." / "Nice seams, if I say so." | 1.06 / 1.10 / 1.74 / 2.10 |
| build_start | build_start_06..08 | "Nozzle hot." / "Laying the first layer." / "Building." | 1.48 / 1.82 / 1.01 |
| stampede_ram_them | stampede_ram_them_04..07 | "Soft ones. Lots. Drive." / "Floor it." / "Plow through them." / "Ram time." | 2.25 / 1.14 / 1.42 / 1.38 |
| soft_ones_keep_the_chain | soft_ones_keep_the_chain_07..10 | "Soft ones. Crunch them." / "Easy kilos." / "Keep the chain going." / "Biomass on legs." | 1.89 / 1.55 / 1.80 / 1.89 |
| heart_threat | heart_threat_02..05 | "They're near the heart." / "Too close to the Stålheart." / "Not her. Not today." / "Hands off my Stålheart." | 1.68 / 2.02 / 1.89 / 2.04 |
| breach_sealed | breach_sealed_06..08 | "Sealed. Tight." / "Shut." / "That hole is closed." | 1.40 / 0.89 / 1.70 |
| repair_underway | repair_underway_02..05 | "Patching the wall." / "Hole in my wall. Fixing it." / "I built it once. Again." / "Back to the wall." | 1.55 / 2.36 / 2.27 / 1.53 |

(Durations are the export's, with the 80 ms pads.) Any of them can be switched off in the Workshop's voice tab, or demoted in the
seiyu player.

## 5. The owner's lines

Recorded and approved in seiyu_voice (his request is his approval, as with the bait lines), imported (266 lines, 85 triggers).

- **The last stand** — `last_stand_01` "Do not go gentle into that good night." (3.00 s) then `last_stand_02` "Rage, rage against the
  dying of the light." (3.47 s), both at speed 0.84 (the voice's 0.92 elsewhere), 0.6 s apart (`VOICE_SEQUENCE`). **The owner wrote "Do
  not go gently into the good night"; the poem reads "Do not go gentle into that good night"; recorded as the poem reads** (his wording
  is one re-render away). **Where:** the final sector's brief, BOTH WALLS (`sector_both`, a `VOICE_HOOKS` alias), the last fight before
  THE ENDING; once a run, so rarer than "once a sector". Why there: it is the last stand by design (hard cores in every wave, a front on
  each side) and the poem's "dying of the light" is the colony's last fight before the ending; its brief had no recording, so no essential
  line gives way; it waits up to 8 s for its turn if he is speaking as the sector begins (`wait`), and nothing but a forced line comes
  between the two lines (a forced line ends the pair). On a skip page it is reachable with `?skip=defence&sector=7#td` (the door) and one
  sector held. Considered and not taken: the heart at critical (said once a run too, and fitting), because there the critical warning
  is essential and the poem would either displace it or follow it at the worst moment; the owner may prefer it.
- **The good, the true, the beautiful** — `the_good_01` (2.98 s), `the_truth_01` (3.72 s), `the_beautiful_01` (3.21 s), default speed.
  Each is a moment's rare alternative (`VOICE_RARE`): said in place of the moment's own line on its chance, when it has rested 15 minutes
  and the light gap allows, and a light line itself.
  - **The Good** ("our mission to harness the stars"): the orbital works' first collector in orbit (`works_orbit`, chance 1: the
    colony's first light caught from the star), a collector loaded after a held sector (`works_launch`, 0.3), and the quiet (0.01 an
    idle ask). Both works briefs had no recording.
  - **The Truth** ("our superior technology will prevail"): SECTOR SECURE (0.25), the fight won.
  - **The Beautiful** ("my work is a form of beauty"): a print stands (print_done, 0.2), and the quiet (0.01).
  - They join the flavour pool as rare alternatives at the idle moment, not as idle_flavor lines (which would put them on its 0.15
    chance with 26 others).

## Tests and checks

- `test/isao-voice.mjs`: a light trigger's own chance through the injected rand; the light gap; short lines first (a weight of 0 never
  picks the long one); an essential trigger untouched; a rare alternative losing and winning its roll, resting, speaking at an unvoiced
  moment; the pair in order after its beat, nothing between, a forced line cutting it; a sequence's chance.
- `test/voice-hooks.mjs`: the pair's and the trio's words; `sector_both` resolves to the last stand and is the final sector's brief;
  every sequence's lines recorded; isao-moments no longer asks the follow-up; every rare moment is a brief, event or callout the game
  raises; the chance table only on light triggers; the essential list stays essential; the real table says the pair in order through
  the injected clock and waits its turn.
- `scripts/browser-test.mjs --voice-rate` (new; SECTOR, PROBE_S, CULL, VOICE_OUT) and `--voice` (now also: the final sector's pair
  played in order in the page, the Good at the works in orbit).

## Not covered

- No player in the measurement: the ram chain, the seats, the MK-9, SOL's automated passes and the player's prints are not in the
  streams; their light lines follow the same knobs.
- The poem and the trio were checked by duration and the pipeline's length checks, not by ear; the drafts likewise.
- BOTH WALLS was raised in a headless run (sector 7, then 8 on the skip page) and the pair said in its replay, and `--voice` plays the
  pair in the page; the pair at a live BOTH WALLS start, the real path to it after a full run,
  the works' briefs (they skip when the player is seated or a brief is up) and the trio's frequency over a long session are not measured.
