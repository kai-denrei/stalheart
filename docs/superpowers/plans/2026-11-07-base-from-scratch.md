# THE BASE FROM SCRATCH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The dome city is no longer founded: its six domes are bought on the build board and printed by Isao in play, the four bridges follow their domes, the domes stand at 0.65 scale with the hull's clearance under the bridges kept, and the wheeled Stålheart can be looked at in the base behind `?gantry=kidou`.

**Architecture:** Content changes in `src/content/dome-city.js`, `base-programme.js`, `build-board.js`; one new `when.stand` condition in the pure programme (`src/domain/build-programme.js`) fed by the story world's `standing(id)`; a frame-anchored plot in `src/fx/base-print.js`; a small `src/fx/kidou-rig.js` host for the gantry's adapter; guards where the old gantry's clip was assumed. The spec is `docs/superpowers/specs/2026-11-07-base-from-scratch-design.md`.

**Tech Stack:** vanilla ES modules, three.js r160 vendored, node tests (`npm test` runs every `test/*.mjs`), the browser harness through `scripts/browser-lock.sh`.

## Global Constraints

- `src/domain` and `src/content` import nothing from `src/fx`, `src/platform` or three.js; `src/domain` never imports `src/content` (`npm run architecture`).
- `src/td-tab.js`: no net growth beyond two one-line additions; no line over 500 characters.
- `DOME_SCALE` is 0.65; the bridges keep their 54 m length and 4.4 m width and are 0.65 in height only; the deck's underside must clear the MÖRK's 3.016 m by at least 1.0 m (a test asserts `7.5 * DOME_SCALE >= 3.016 + 1.0`).
- The dome pair spacing is set by the bridge: the bridge's end is 26 m from its centre and the scaled port `14 * DOME_SCALE` m from the dome's; middle domes at z 0, bridges at z ±(26 + 14 · 0.65) = ±35.1, outer domes at z ±70.2; the columns at x ±80.
- Prices in `BUILD_BOARD.structures` (kg): habitat 2400, biosphere 3000, fabrication 2800, logistics 2400; effect lines name the dome. `structuresMax` stays 4.
- The classic base (`?base=classic`) is untouched; static stage pages at stage ≥ 2 still stand the domes.
- Shipped content outside this plan's files is immutable. No colored emoji. Captions for new Isao lines.
- Commits as Kai Denrei ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never push. Browser suites only through `scripts/browser-lock.sh`; never edit `src` while a suite serves this tree.
- Work in `~/Dev/stalheart-base` on branch `base-from-scratch`.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/domain/build-programme.js` (modify) | `when.stand: [ids]` — due when every named structure stands (`standing(id)` from the context) |
| `src/platform/story-world.js` (modify) | passes `standing: (id) => ...` into the programme's context (where `whenHolds` is called: find it by grep in `src/fx/programme-host.js` / `colony-tick.js`) |
| `src/content/dome-city.js` (modify) | `DOME_SCALE`, islands 20 x 20, the new z's, `scaleY` on the bridges, `lift` re-derived, `founded` gone, placement nudges |
| `src/fx/story-base.js` (modify) | `place()` takes `scaleY` (a structure's own Y scale beside `scale`) |
| `src/content/base-programme.js` (modify) | six dome steps (`board: true`), four bridge steps (`when.stand`, `plot: BRIDGE_PLOT`, `frame: true`) |
| `src/fx/base-print.js` (modify) | a frame-anchored plot (`step.frame`: the structure's own x, z, heading from the plan) |
| `src/content/build-board.js` (modify) | the prices and effects |
| `src/isaobriefs.js` (modify) | `build_dome`, `build_bridge` |
| `src/fx/board-thumbs.js` (modify) | the dome's thumbnail source (its LOD2) |
| `src/content/base-layout.js` (modify) | the `stalheart` entry resolved by `?gantry=kidou` (a second entry or a switch like `baseLayoutMode`) |
| `src/platform/game-flags.js` (modify) | `gantry` read once |
| `src/fx/kidou-rig.js` (create) | the KIDOU's adapter run parked, each frame |
| `src/fx/disco-party.js`, `src/fx/hull-repair.js`, `src/fx/terraformer-yard.js` (modify) | guards: no `Terraforming_Cycle` → no pose; the footprint from the holder's box |
| `test/build-programme.mjs`, `test/dome-city.mjs`, `test/base-programme.mjs`, `test/kidou-landmark.mjs` | the rules |
| `scripts/browser-test.mjs` (modify) | `--dome-print` |

---

### Task 1: `when.stand` in the build programme

**Files:** Modify `src/domain/build-programme.js` (`whenHolds`, line 20-35); Test `test/build-programme.mjs` (append; read the file's existing style first).

**Interfaces:** Produces: `whenHolds(w, { ..., standing })` where `standing(id) → boolean`; `w.stand` is an array of structure ids; absent `standing`, a `stand` condition is false.

- [ ] Step 1: append tests: `whenHolds({ stand: ['a', 'b'] }, { phase: 'rotor-ready', sector: 1, standing: (id) => id === 'a' })` is false; with both standing, true; with no `standing` function, false; `stand: []` is true; a `stand` combined with `sector: 2` needs both.
- [ ] Step 2: run `node test/build-programme.mjs` → fails (`stand` ignored: the first assertion's `false` reads `true`).
- [ ] Step 3: in `whenHolds` add `if (w.stand != null && !(typeof standing === 'function' && w.stand.every((id) => standing(id)))) return false;` with a dated comment (the bridges follow their domes, spec 2026-11-07 section 2.A).
- [ ] Step 4: run the test → green; `npm test`; `npm run architecture`.
- [ ] Step 5: commit.

### Task 2: The dome city resized and unfounded

**Files:** Modify `src/content/dome-city.js`, `src/fx/story-base.js` (`place`, line 73-77), `src/domain/base-plan.js` only if `scaleY` must pass through it (read `planBase` for how `scale`/`lift` reach the record); Test `test/dome-city.mjs` (modify the position assertions, add the new rules).

**Interfaces:** Produces: `DOME_SCALE` (0.65), `DOME_ISLANDS` (20 x 20 at x ±80, z {-70.2, 0, 70.2}), `DOME_STRUCTURES` (domes `scale: DOME_SCALE`, bridges `scale: 1, scaleY: DOME_SCALE` at z ±35.1 with the re-derived `lift`), `DOME_SOLIDS` unchanged, no `founded` anywhere; `place(obj, x, z, y, heading, scale, tilt, lift, scaleY = scale)` in the story base.

- [ ] Step 1: tests first. Change the position assertions to the new numbers; add: `assert.equal(DOME_SCALE, 0.65)`; the clearance `7.5 * DOME_SCALE >= 3.016 + 1.0`; for each bridge, the two domes it links are at `b.z ± (26 + 14 * DOME_SCALE)` within 1e-9 and at its x; `DOME_ISLANDS.every((i) => !i.founded)` and `DOME_STRUCTURES.every((s) => !s.founded)`; the bridges carry `scaleY: DOME_SCALE` and `scale: 1`; the domes `scale: DOME_SCALE`; the islands 20 x 20; the sag arithmetic: `lift` equals `-(sag(35.1) - sag(26))` rounded to 2 decimals where `sag = (d) => d * d / (2 * 753)` (the dome's slab 0.82 m below the bridge's centre tangent, the bridge's end 0.45 m below it: the socket meets the port with the deck lowered by the difference; keep the sign convention the current `lift: -0.33` uses and say in a comment which way it points). Then the existing placement rule on the new data.
- [ ] Step 2: run → fails on the new numbers.
- [ ] Step 3: implement the content (keep the file's commentary, update the numbers' reasons: the owner's 2026-11-07 note), `place()`'s `scaleY`, and in the story base's mount pass `s.scaleY ?? s.scale` through (grep every `place(` call: the holder's placement for structures reads `s.scale`). If the placement rule fails for a classic island, nudge its `DOME_PLACEMENT` entry by the least amount that passes and record each nudge in a comment.
- [ ] Step 4: `node test/dome-city.mjs` green, `npm test`, `npm run check`. Then, through the lock, `--dome-look` and `--base-look`: green, and look at `artifacts/browser/dome-look-dome-dome-w.png`: the hull inside a smaller dome, the bridge deck lower.
- [ ] Step 5: commit.

### Task 3: The dome and bridge steps, the board, the briefs, the thumbnails

**Files:** Modify `src/content/base-programme.js`, `src/content/build-board.js`, `src/isaobriefs.js`, `src/fx/base-print.js` (`plotOf`), `src/fx/board-thumbs.js`; Test `test/base-programme.mjs` (append; read its style), `test/build-board.mjs` if it exists.

**Interfaces:** Produces: steps `dome-nw`, `dome-w`, `dome-sw`, `dome-ne`, `dome-e`, `dome-se` (`islands: [id], structures: [id], board: true, when: { sector: 1|2|3, idle: true }, seconds: 18, metres: 10, brief: 'build_dome', perk: null`) and `bridge-w1`, `bridge-w2`, `bridge-e1`, `bridge-e2` (`structures: [id], frame: true, plot: BRIDGE_PLOT, when: { stand: [its two domes] }, seconds: 8, metres: 6, brief: 'build_bridge', perk: null`, not on the board); `BUILD_BOARD.structures['dome-nw'...]` with the spec's prices and effects; `plotOf(step)` for `step.frame`: `{ x: s.x, z: s.z, hw: plot[0] / 2, hd: plot[1] / 2, heading: s.heading ?? [0, 1], cell: nearest cell }` from the plan's structure `s` (read how `anchor: 'frame'` structures carry `x, z, heading, cell` in the plan: `src/domain/base-plan.js`).

- [ ] Step 1: tests: the ten steps exist with those fields; every `board: true` step has a `BUILD_BOARD.structures` price; a bridge step's `stand` names exactly the two domes at `b.z ± 35.1`; the sector gates (nw/ne 1, w/e 2, sw/se 3); `plotOf` of a frame step (build a minimal plan with one frame structure) returns its x, z and half extents.
- [ ] Step 2: run → fails. Step 3: implement. The briefs: `build_dome` "A dome for the colony. Everyone wants a window." (face glee, title ISAO · THE DOMES), `build_bridge` "And a bridge between them. No helmets indoors." Step 4: `npm test`, `npm run check`; through the lock `--board` stays green (the board now draws from a larger pool; if its assertion on the exact bought set breaks because a dome displaced a card, read the assertion and the board's pick rule before touching either, and report). Step 5: commit.

### Task 4: The wheeled Stålheart behind `?gantry=kidou`

**Files:** Modify `src/platform/game-flags.js`, `src/content/base-layout.js`, `src/fx/story-base.js` (mount: run a structure's `rig` if it has one), `src/fx/disco-party.js:93` (guard), `src/fx/hull-repair.js` / `src/domain/hull-repair.js` (the footprint from the holder's box if it reads a clip or named nodes), `src/fx/terraformer-yard.js` (if it reads the model's nodes); Create `src/fx/kidou-rig.js`; Test `test/kidou-landmark.mjs`.

**Interfaces:** Produces: `gantryMode(search) → 'rail' | 'kidou'` in `src/platform/game-flags.js` (default `rail`); `stalheartEntry(mode)` in `src/content/base-layout.js` (the `rail` entry is today's; `kidou`: `asset: 'assets/models/stalheart-kidou/stalheart_kidou_d0_lod1.glb', far: '.../stalheart_kidou_d0_lod2.glb', clips: [], batch: false, scale: 1, rig: 'kidou'`); `createKidouRig(THREE, root) → { tick(t), dispose() }` calling the adapter's `applyKidou(THREE, root, { time: t, mode: 'park', ... })` (read `assets/models/stalheart-kidou/runtime.js` for the exact arguments and import it as a module; it is pinned content: do not edit it).

- [ ] Step 1: tests: `gantryMode('?gantry=kidou') === 'kidou'`, anything else `rail`; `stalheartEntry('kidou')` points at two files that exist (`existsSync`) with `clips: []`; `stalheartEntry('rail')` deep-equals today's entry.
- [ ] Step 2: run → fails. Step 3: implement; the story base ticks a mounted structure's rig in its `tick`; the party: `if (!act) return` where the crane pose is driven (read the function around line 93 and make a missing action a no-op for the whole party pose, the ball still hung under `EXTRUSION_TIP` if present); the repair/yard guards likewise. Step 4: `npm test`, `npm run check`; through the lock `--base-look` with the URL amended by `&gantry=kidou` (add an env `GANTRY=kidou` the step reads, like `BASE=`), look at the still: the gantry on the Stålheart's island, wheels on the slab; and `--day-42` green on the default (rail) model. Step 5: commit.

### Task 5: The `--dome-print` step, STATE, the entry

**Files:** Modify `scripts/browser-test.mjs` (a new step before `--dome-look`), `docs/STATE.md`; add a log entry via `node scripts/log.mjs add`.

- [ ] Step 1: write `--dome-print`: open `index.html?sw=0&acceptance=1&cine=0&world=story&grow=1#td` (read `--grow` for the harness calls that reach stage 1 quickly and how the board is opened and a card bought in `--board`), assert no dome stands (`state().storyLod` has no `dome-*` with `visible: true`), buy `dome-nw` then `dome-w` through the board's harness path (or the programme's `buy` hook if one exists: grep `bought` in `src/td-tab.js`), wait for each print to finish (`state().programme.printed` includes the id), assert `bridge-w1` prints by itself after both, a still mid-print of a dome (`dome-print-mid.png`).
- [ ] Step 2: run it through the lock until green; also `--dome-look`, `--base-look`, `--grow` (red on the base already: compare its message, not its colour), the default suite.
- [ ] Step 3: STATE section at the top in the house style; the log entry (type change, accepted) with the numbers (the scale, the spacing, the clearance, the prices, the nudges, the suites); `DEVLOG.md` rendered. Commit.

## Self-review

- Spec coverage: 2.A → Tasks 1, 3, 5; 2.B → Task 2; 2.C → Task 4; 2.D → not built (the spec says so); section 3's tests → each task; browser steps → Tasks 2, 4, 5.
- Placeholders: none; Task 3's `plotOf` reads the plan's frame structure, whose fields Task 3 names.
- Consistency: `DOME_SCALE` 0.65 everywhere; `scaleY` named the same in content, `place()` and the mount; `when.stand` / `standing(id)` in Tasks 1 and 3; `gantryMode` / `stalheartEntry` / `createKidouRig` in Task 4.
