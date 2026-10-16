# Refactor round 2: the wave clock, the hosts handed on, the untested hosts, and four more subjects out of the controller

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** close the findings of the 2026-10-07 refactor run's review (`2026-10-07-refactor-run-architecture-review`) and continue the controller's extraction, without changing behaviour: the wave clock becomes one named state with named transitions in `src/domain`; the two hosts still handed on whole get their own literals; `colony-tick` and `ending-host` get their tests; the boot probes, the brief queue, the engine audio and the hull's deploy leave `src/td-tab.js`.

**Base:** branch `refactor-round-2` from `pearl-enemies` at `8bf59188` (td-tab 6,120 lines / 343,258 bytes / 0 lines over 500 characters; ceiling 6,400; `npm test` 251 programs; `npm run check` green; `node test/host-contracts.mjs` "Host contracts hold for 52 factories."). Worktree `/Users/minikai/Dev/stalheart-refactor-2`. The previous round's plan, tools and conventions: `docs/superpowers/plans/2026-10-07-refactor-run.md`, `tools/refactor/README.md`.

Owner, 2026-10-13: "come back with a round of refactorization using Fable"; the plan and the review are Fable's, the moves are executed by cheaper models; the owner test-runs locally before anything is merged or pushed.

## Global Constraints (the previous round's, unchanged, plus three)

- **No behaviour change.** A task that finds a bug records it (a deban entry, `status: open`) and leaves the behaviour; the owner decides.
- **One commit per task**, message in the project's register (what moved, where, the proof, td-tab's net line change), ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. `git config user.email` must read `270854086+kai-denrei@users.noreply.github.com`. **Never push. Never merge. Never `git add -A`** (add explicit paths; `node_modules` is a symlink in this worktree).
- **Every edit of a `src/*.js` file is followed by `node --check <file>`** before anything else runs. A browser suite that times out at load is a syntax error, not a flaky suite. A trailing `// comment` on a one-line handler swallows the rest of the line: put comments above the line or use `/* */`.
- **After every task:** `npm test`, `npm run check` (runs `npm run architecture`), `node test/host-contracts.mjs`, `npm run build`, then the task's browser suites.
- **Browser suites never serve a tree that is being edited.** Snapshot first (`scripts/refactor-snapshot.sh <tag>` with cwd = the worktree), run `tools/refactor/suites.sh <snapshot> <logdir> --flag ...` (it waits for memory and takes the browser lock). One Chrome at a time on this 16 GB machine. The baseline battery of the untouched base is in the session scratchpad `baseline/summary.log` (started 2026-10-13 23:18 from `/private/tmp/stalheart-snapshots/base-231854`): a suite red there is red on the base, not on the branch; a suite green there and red after a task is the task's.
- **Layer rules stand:** `src/core` imports core; `src/domain` imports core/domain/the pinned kernel and never `src/content` (take tunables as parameters); `src/platform` and `src/fx` never import `td-tab.js` or a lab; no new top-level `src/*.js`. The pure-layer scan flags the bare words `window`, `document`, `fetch` even inside trailing comments of domain/content files.
- **Host literals in td-tab are one member per line**, values for consts and function declarations, getters (`x: () => x`) for rebound lets, setters (`setX: (v) => (x = v)`, returning the written value) for lets the module writes, a lazy wrapper for anything declared later in `initTdTab` (TDZ; check with `tools/refactor/tdz-check.mjs`). **A host is never passed on to another factory** (`test/host-contracts.mjs` NESTED may only shrink).
- **Hoisted functions with callers above the extraction site stay hoisted one-liners** (`function showBrief(id) { return briefs.show(id); }`), never `const { showBrief } = createX(...)`: a literal evaluated earlier in `initTdTab` may hold them as values.
- Comments move with their code, every sentence of them (`tools/refactor/comments-kept.mjs`). Owner attributions stay.
- **td-tab's line count falls over the round** and never exceeds 6,400. The ceiling is re-based once, by decision, in the last task.
- Record each task with a deban entry (`npm run log -- add /abs/path/entry.json`, shaped like `docs/log/entries/2026-10-07-host-contracts-test.json`; write it outside `docs/log/entries/` first). Run `npm run log:check`.
- The sandbox refuses compound shell commands that mix `sed`/`git`/`$(...)`, zsh parameter expansion in one-liners and awk programs: write a script file and run it. Never name a shell variable `path`.
- **New:** nothing in `src/` imports `tools/refactor/`. **New:** each new module gets `test/<module>.mjs` (named assertions on a recording host, not a sha digest). **New:** an executor that is more than fifteen tool calls into one sub-problem with no measurable progress stops, records what was tried in its report, and moves to the next task.

## The proof method (every move task)

1. `node tools/refactor/outside-refs.mjs src/td-tab.js START END --free` — the region's own names and their outside sites, and its closure (R/W). That is the host literal's member list and the list of sites to rewrite.
2. Save the region's original text to the scratchpad (`before/<task>.js`) and the whole file (`before/td-tab.js`).
3. Write the module; build td-tab's literal one member per line; rewrite the outside sites.
4. `node --check` both files; `node tools/refactor/undef-diff.mjs before/td-tab.js src/td-tab.js` (no new undefined/unused names); `node tools/refactor/tdz-check.mjs src/td-tab.js LINE names...` for every value member; `node tools/refactor/comments-kept.mjs before/td-tab.js src/td-tab.js,src/<new>.js`.
5. Side-by-side harness in `test/<module>.mjs`: run the ORIGINAL block text (`new Function(...closureNames, text + 'return fn')` over `tools/refactor/harness.mjs` fakes) beside the new module on the same inputs; `deepEqualLogs`. Then **replace the original-text half by named assertions on the kept log** so the committed test reads (the original text is not committed; the proof run is reported in the commit message).
6. `node test/host-contracts.mjs` (the new factory must appear: "hold for N+1 factories").
7. `npm test`, `npm run check`, `npm run build`, the task's suites from a fresh snapshot.

---

### Task 0: Baseline and the round's records

**Files:** none in `src/`.

- [ ] Confirm the worktree: `git -C /Users/minikai/Dev/stalheart-refactor-2 log --oneline -1` is `8bf59188`; `git config user.email` as above; `node_modules` is a symlink to `/Users/minikai/Dev/stalheart/node_modules`.
- [ ] Read `baseline/summary.log` in the session scratchpad when it says `DONE` (it runs while Task 1 proceeds; do not wait for it to start Task 1). Note each red suite and its failing step (`baseline/<flag>.log`). Those are the base's reds.
- [ ] No commit.

---

### Task 1: The wave clock is one state with named transitions (`src/domain/wave-clock.js`)

**Why:** deferred by the 2026-09-25 and 2026-10-07 rounds. Six controller lets (`waveIn` 452, `waveCharge` 448, `warnBeat` 449, `interClock` 754, `waveAge` 755, `waveActive` 610) are read and written at twenty sites: the wave card host (2677–2679), the enemy-step host (3063–3070), `secsToWave` (4457–4461), `expandRound` (4747), the frame (5010–5056), the radar scope (5218), the hull host (5419), the acceptance adapter (5884, 5898). The frame's block interleaves the clock's writes with `spawnWave()` (which sets `waveActive`/`waveAge` through the enemy-step setters in the SAME frame, so the active branch runs on the new state), the warn rings, the score, the sim curve, the hold card and the sitrep. **Therefore the module is not a one-call pure decision function: it is a state object with small named transitions, and the frame calls them in the original order.** Behaviour is identical because every transition is the original statement under a name.

**Files:**
- Create: `src/domain/wave-clock.js`
- Create: `test/wave-clock.mjs`
- Modify: `src/td-tab.js` (the six lets, the twenty sites)

**The module** (pure; `warn` is `WAVE_WARN`, passed in):

```js
// THE WAVE CLOCK (moved out of src/td-tab.js, refactor round 2, 2026-10-13): six controller lets as one state, each transition a
// statement the frame used to make inline, in the frame's order. `in` < 0 means no wave is armed; >= 0 means ARMED and counting down.
export function createWaveClock({ warn }) {
  const s = { in: -1, charge: 0, beat: 0, inter: 0, age: 0, active: false };
  return {
    state: () => ({ ...s }),
    // reads (the hosts' getters)
    in: () => s.in, charge: () => s.charge, inter: () => s.inter, age: () => s.age, active: () => s.active,
    // writes (the hosts' setters: enemy-step's armWave/spawnWave, expandRound, the acceptance adapter)
    setIn: (v) => (s.in = v), setCharge: (v) => (s.charge = v), setBeat: (v) => (s.beat = v), setInter: (v) => (s.inter = v), setAge: (v) => (s.age = v), setActive: (v) => (s.active = v),
    // the frame's armed branch: count down, fill the charge; true when a shock ring is due this frame (the beat accelerates 0.72 -> 0.18 s)
    countdown(dt) { s.in -= dt; s.charge = Math.max(0, Math.min(1, 1 - s.in / warn)); s.beat -= dt; if (s.beat > 0) return false; s.beat = 0.72 - 0.54 * s.charge; return true; },
    due: () => s.in <= 0,          // the countdown reached zero: the frame disarms and spawns
    disarm: () => { s.in = -1; },
    // the active branch
    grow: (dt) => { s.age += dt; },
    clear: () => { s.active = false; s.inter = 0; s.charge = 0; },   // the field is cleared (expandRound does the first two itself)
    stalled: (cap) => s.age >= cap,
    // between waves
    wait: (dt) => { s.inter += dt; },
    readyToArm: (gap) => s.inter >= gap - warn,
    idle: () => { s.charge = 0; },
    // secsToWave (the HUD's countdown)
    secsToWave: (gap) => (s.active ? Infinity : s.in >= 0 ? s.in : gap - s.inter),
  };
}
```

Keep every comment of the frame's block (lines 5002–5057) in the module or at the frame's call, every sentence.

**The frame's block becomes** (same order, same conditions; `anyAlive` computed once where the original computed `spawnPoints.some((s) => s.alive)` — it was computed in the else-if only, so keep it lazy: compute it at the same point):

```js
if (waveClock.in() >= 0) {
  if (waveClock.countdown(dt)) for (const sp of spawnPoints) if (sp.alive) warnRing(sp.ci, CREATURE_TINTS[sp.type] ?? 0xffffff, 0.55, cellSide * (1.6 + 1.4 * waveClock.charge()));
  if (waveClock.due()) { waveClock.disarm(); spawnWave(); }
}
if (waveClock.active()) {
  waveClock.grow(dt);
  if (<the original pulseOver/cleared condition>) { waveClock.clear(); if (automated()) fillFromWaveClear(...); <score, sim curve, hold, sitrep as before> }
  else if (waveClock.stalled(params.waveCap) && spawnPoints.some((s) => s.alive) && !(lab.on && lab.holdWaves) && !storyMode) armWave();
} else if (spawnPoints.some((s) => s.alive)) {
  waveClock.wait(dt);
  const gap = sectorRun?.pulseGap?.() ?? params.waveGap * (wave < 2 ? 1.6 : 1);
  if (waveClock.readyToArm(gap) && !(lab.on && lab.holdWaves) && (!storyMode || automated())) armWave();
} else if (waveClock.in() < 0) waveClock.idle();
```

Note the original armed branch sets `warnBeat = 0.72 - 0.54 * waveCharge` BEFORE ringing and rings with the charge already updated this frame: `countdown` does exactly that. Note `waveIn -= dt` happens before the charge is computed: same in `countdown`.

**Steps:**
- [ ] `node tools/refactor/outside-refs.mjs src/td-tab.js 5002 5057 --free` and grep each of the six names: confirm the twenty sites above (the numbers may have drifted by a few lines; the names have not).
- [ ] Save `before/td-tab.js` and `before/wave-block.js` (lines 5002–5057) in the scratchpad.
- [ ] Write `src/domain/wave-clock.js`. `const waveClock = createWaveClock({ warn: WAVE_WARN });` goes where line 452's `let waveIn = -1;` was (after `WAVE_WARN` at 447); delete the six `let` lines (448, 449, 452, 610, 754, 755) with their comments moved to the module.
- [ ] Rewrite the sites: the wave-card host 2677–2679 (`waveActive: () => waveClock.active()`, …), the enemy-step host 3063–3070 (getters and setters through the module's), `secsToWave` 4457–4461 (`return waveClock.secsToWave(params.waveGap)` — check its body is exactly the three-line rule first), `expandRound` 4747 (`waveClock.setActive(false); waveClock.setInter(0);`), the radar scope 5218, the hull host 5419, the adapter 5884 (`waveClock.setIn(-1); armWave();`) and 5898.
- [ ] `node --check`, `undef-diff`, `comments-kept`, `node test/host-contracts.mjs` (the hosts' members are still read by their modules; the literal keys do not change).
- [ ] **Proof** `test/wave-clock.mjs`: (a) named assertions on the module: a fresh clock is idle; `setIn(3)` then `countdown(1)` three times rings on the first call and when the beat runs out, charge climbs to 1, `due()` at 0; `clear()` resets active/inter/charge; `secsToWave` returns Infinity while active, `in` while armed, `gap - inter` otherwise. (b) The side-by-side: run the ORIGINAL frame block (`before/wave-block.js`, closure names bound to recording fakes: `spawnPoints`, `warnRing`, `spawnWave` (whose fake sets `waveActive = true; waveAge = 0` through the lets, as enemy-step's does through the setters — read `src/fx/enemy-step.js` `spawnWave`/`armWave` for exactly what they write), `armWave`, `sectorRun`, `spawnQueue`, `enemies`, `automated`, `fillFromWaveClear`, `score`, `persistBest`, `simStyle`, `simCurve`, `storyMode`, `sectorWave`, `params`, `programmeSpent`, `showBrief`, `showSitrep`, `lab`, `wave`, `t`, `heartHP`, `eco`, `towers`, `bossCued`, `BOSS_WAVE`, `buildFrozen`, `secsToWave`, `sfx`, `gunshipRig`, `GUNSHIP_CALL`, `CREATURE_TINTS`, `cellSide`, `WAVE_WARN`) beside the NEW block over the module, for 2,000 random frames (dt in 1/120..1/20, random alive/cleared/stalled/hold flags re-rolled every ~40 frames, seeded `mulberry32`), comparing the call logs AND the six values after every frame. Report the frame count and "equal" in the commit message; commit the test with (a) and a reduced, deterministic (b) that keeps the new block only against a kept 200-frame expectation of the six values (no original text in the repo).
- [ ] `npm test`, `npm run check`, `npm run build`. Suites from a fresh snapshot: `--defense --sectors --round6 --round7 --pacing --waves --story`.
- [ ] Deban entry `2026-10-13-wave-clock-one-state-named-transitions` (type change, accepted; context names the two deferrals; evidence the proof numbers and the suites).
- [ ] Commit — `The wave clock is one state with named transitions (src/domain/wave-clock.js): six controller lets gone, the frame calls the transitions in its own order; proof N frames side by side; td-tab -X lines`.

---

### Task 2: Tests for `colony-tick` and `ending-host` (the review's finding 1)

**Files:**
- Create: `test/colony-tick.mjs`, `test/ending-host.mjs`

**Interfaces:** `src/fx/colony-tick.js` `createColonyTick(c)` reads 28 members (`c.ammo c.ammoMax c.briefQ c.cellSide c.combo c.dungeon c.eco c.graph c.hands c.hull c.kills c.laserStation c.pause c.pilotMode c.playerHP c.playerPos c.rank c.renderer c.root c.scene c.sectorRun c.setAmmo c.setPlayerHP c.sfx c.shotId c.story c.storyBase c.t`); `src/fx/ending-host.js` `createEndingHost(c)` returns `{ interlude, finale }` and calls `playDiorama` (`src/fx/finale-diorama.js`, returns false without boards) then `playOrbitalFinale` (`src/fx/orbital-finale.js`, DOM).

- [ ] Read both modules whole. Read `test/orbital-finale.mjs` and `test/programme-host.mjs` for the project's DOM/three fakes and the recording-host style.
- [ ] `test/colony-tick.mjs`: a recording host (`tools/refactor/harness.mjs` `recorder`, or plain objects with a log) with the story's props present and absent; tick a few seconds; assert the named calls in order (what it builds on the first tick, what it does each tick, what it does when a member is null). Every branch of the module's `tick` runs at least once. No sha digest.
- [ ] `test/ending-host.mjs`: `interlude()` is false; `finale(then)` with no boards pauses off, calls the orbital finale with `{ sfx, done: then, planet }` built from the host (assert `planet.heart`, `planet.base`, `planet.launcher` with and without a launcher holder), and pauses on before it; with boards present (`story().boards` of two groups with world transforms) `playDiorama` runs instead and `then` is reached through its `done`. Fake `document` only as far as `playOrbitalFinale` needs (see `test/orbital-finale.mjs`).
- [ ] `npm test` (253 programs). No `src/` change; no suites.
- [ ] Commit — `Tests for colony-tick and ending-host (the refactor run's review, finding 1): named assertions on a recording host`.

---

### Task 3: The two hosts handed on get their own literals (`test/host-contracts.mjs` NESTED → empty)

**3a. `src/fx/laser-station.js:21`** `createLaserArsenal(scene, { ...host, passEnded: () => leave() })`. The arsenal reads 30 members (`adj anchors breaches breakCells brief burnBody burnHeart burnStructure burnTank burnTower burnWall callout cellAt cellSide centers enemies explode heart heartCell lane loop online passEnded seal structures tags tank towers wallHeight walls`); the station itself reads 15 (`breaches canvas centers enemies enter fov heart leave mobile paused structures togglePause vacate views walls`).

- [ ] td-tab builds the arsenal: `const laserArsenal = createLaserArsenal(scene, { <the 30 members, one per line, taken from the station's literal at td-tab:350>, passEnded: () => laserStation.leave() });` immediately above the station's literal (the station is declared below: `passEnded` is a lazy call, run only during a pass; `tdz-check` the values).
- [ ] The station takes the arsenal: `createLaserStation(root, scene, { arsenal: laserArsenal, <its own 15 members> })`; inside, `const arsenal = host.arsenal;` replaces line 21; its returned surface gains `leave` (the internal `leave()`), nothing else changes. Remove the members only the arsenal read from the station's literal (host-contracts reports "td-tab supplies X but the module never reads it" for each; `tools/refactor/drop-unread.mjs` handles getters on their own line).
- [ ] Delete the NESTED entry `src/fx/laser-station.js:createLaserArsenal`. `node test/host-contracts.mjs` must list the arsenal as a factory ("hold for N+1 factories") and hold.
- [ ] Proof: `test/laser-station.mjs` if it exists is adjusted to pass `arsenal`; otherwise a small `test/laser-station.mjs`: the station over a fake arsenal (`online`, `state`, `tick`, `seat`, `strip`, `setOnline`) and a recording host: `sit()` refuses when not overhead and activates the strip's `tank`; `enter()` with a seen briefing sits; `leave()` is exposed. Suites: `--laser-game`, `--laser`, `--seats`, `--sectors` (the canyon's pass).

**3b. `src/fx/ending-host.js:22`** `playDiorama(c, orbit)` reads `story startShot scene cellSide hull isao spawnIsao` of `c`.

- [ ] In `ending-host.js`: `playDiorama({ story: c.story, startShot: c.startShot, scene: c.scene, cellSide: c.cellSide, hull: c.hull, isao: c.isao, spawnIsao: c.spawnIsao }, orbit)`; update the file's header comment (the diorama's members are now named here). Delete the NESTED entry `src/fx/ending-host.js:playDiorama`. If host-contracts now reports a member td-tab supplies that nothing reads, remove it from td-tab's `createEndingHost` literal (5383) and say so in the commit.
- [ ] Add to `test/ending-host.mjs` (Task 2): the diorama receives exactly those seven members.
- [ ] Suites: `--finale`.
- [ ] `npm test`, `npm run check`, `npm run build`. Deban entry `2026-10-13-no-host-handed-on` (NESTED is empty; the check keeps it so). One commit for 3a+3b — `No host is handed on: td-tab builds the laser arsenal's own literal and the ending host names the diorama's seven members; NESTED empty; td-tab +X lines (the arsenal's literal)`. (This task may grow td-tab by the literal's lines; Tasks 4–7 pay it back.)

---

### Task 4: The boot probes leave the controller (`src/platform/boot-probes.js`)

**Region:** td-tab ~5600–5756: `?layout=<s>` (the LAYOUT report: `want`, `box`, `boxOverlaps`, the console lines), `?stateprobe=1` (5664–5717: `onScreen`, `line`, the 2 s interval for 24 s), `?keyprobe=1` (5718–5756: the 6 s timeout, `press`, the S/T rack check). Dev instrumentation only; nothing else reads anything they declare (`outside-refs` must show no outside sites). Exercised by `scripts/browser-test.mjs` step `mobile-input` (`keyprobe=1&layout=1`, suite: find it with `grep -n "mobile-input" scripts/browser-test.mjs` and the suite branch it sits in) — run that suite before and after.

- [ ] `outside-refs --free` over the region: the closure list is the host literal (expected about: `flags mobileShell toastEl diagOverlay camera player renderer params cellSide throttle stick keys paused shotId buildMode msgEl briefEl sitrepEl deploy setDeploy deployShieldNow shield shots root viewportLine boxOverlaps`; getters for the lets, a setter for `deploy` (the keyprobe writes it), values for the rest).
- [ ] `src/platform/boot-probes.js`: `export function startBootProbes(host)` with the three blocks verbatim under their flags (comments included); td-tab: `startBootProbes({ ... })` at the region's place. Platform may read `document`, `window`, timers.
- [ ] Proof: `undef-diff`, `comments-kept`, `tdz-check`, host-contracts (N+1; a `start…` factory is matched by the test only if its name starts with `create`/`make` — name it `createBootProbes` and have it return `{ started: [...] }` of the flags it armed, so the contract test sees it). `test/boot-probes.mjs`: with `flags.stateprobe === '1'` and a fake `setInterval` captured, one line's text names the state; with `keyprobe` the `press` dispatches keydown/keyup and the console line reads `OK`/`WRONG` from the rack numbers; with no flags nothing is scheduled.
- [ ] `npm test`, `npm run check`, `npm run build`; suites: the `mobile-input` suite, `--probe`, `--opening-probe`.
- [ ] Deban entry; commit — `The boot probes (?layout, ?stateprobe, ?keyprobe) are a platform module; td-tab -X lines`.

---

### Task 5: The brief queue (`src/fx/brief-queue.js`)

**Region:** td-tab ~620–751: the comment block, the five `#td-brief*` elements, `BRIEF_SEEN`, `briefQ/briefAt/briefFaceT`, `briefLeft/briefDwell`, `briefPending`, `briefSeen` (through the `localStorage` alias td-tab imports from `src/storage.js` — the module imports the same), `briefBar`, `paintBrief`, `showBrief`, `stepBrief`, `stepBriefClock`, `endBrief`, `clearBriefs`. Outside sites: `showBrief` is passed as a value in several host literals (some above line 620? check) and called from ~15 places; `stepBriefClock` from the frame; `clearBriefs` from the run reset; `briefQ` read by `colony-tick`'s host (`briefQ: () => briefQ`) and others — `outside-refs` lists them.

- [ ] `outside-refs 620 751 --free`. The module: `createBriefQueue(root, host)` returning `{ paint, show, step, stepClock, end, clear, queue: () => briefQ, pending: () => briefPending }`; host members for what the region reads (`sfx`, `isaoLine`?, `paused`, the story's briefs table, `storyMode`, …, as measured).
- [ ] td-tab keeps hoisted one-liners for the names used as values or called from above: `function showBrief(id) { return briefs.show(id); }` etc.; the getters that hosts read (`briefQ: () => briefs.queue()`).
- [ ] Proof as the method says; `test/brief-queue.mjs`: a queued brief paints its title and line, dwells, advances on `step(true)`, `clear()` empties; `briefSeen` persists through a fake storage.
- [ ] Suites: `--story`, `--sectors`, `--opening`, `--chapters`.
- [ ] Deban entry; commit — `The brief queue is an fx module (src/fx/brief-queue.js); td-tab -X lines`.

---

### Task 6: The engine audio (`src/fx/engine-audio.js`)

**Region:** td-tab ~4787–4886: the comment, `engineHandle/enginePrev/engineLevel/engineIdle/engineRunning`, `ENGINE_STOP`, `stopEngine(fade, quiet)`, `updateEngine(dt)`. Reads `sfx`, `feel`, `landTankFeel`, `playerMesh`, `player`, the engine cue names, `pilotMode`?, `deploy`? — as measured. Outside callers of `stopEngine`: the pilot's enter/leave, dispose, the loss; `updateEngine`: `animate`.

- [ ] Module `createEngineAudio(host)` returning `{ stop, update, level: () => engineLevel }` (add a getter only if something outside reads the let). Hoisted one-liners in td-tab for `stopEngine`/`updateEngine`.
- [ ] `test/engine-audio.mjs`: a moving hull spools up once and the bed's gain follows the smoothed level; stillness past `ENGINE_STOP` fades it and plays `tank_spool_down` once with the feel's landing; `stop(…, quiet)` plays nothing; a zero dt is ignored.
- [ ] Suites: `--defense`, `--story`, `--seats`.
- [ ] Deban entry; commit.

---

### Task 7: The hull's deploy (`src/fx/hull-deploy.js`)

**Region:** td-tab ~3691–3776: `deploy` (the let; `{ n, from, to, segLen, travelled, clip? }`), `deployActive`, `berthSeg/berthDir` (domain `deploy-path.js`), `deployStart(n)`, `deployFramePoseFor`, `deployProgress`, `deployEase`, `deployStep(dt)`. Outside sites of `deploy` (read as `deploy?.clip`, `if (deploy)`, written `deploy = null` in the frame, the keyprobe (Task 4's setter) and the pilot): `outside-refs` lists ~20.

- [ ] Module `createHullDeploy(host)` returning `{ active, clip: () => deploy?.clip, start, step, cancel: () => (deploy = null), state: () => deploy }`; the sites become those calls. Keep `function deployStart(n) { return hullDeploy.start(n); }` only if a literal above the site holds it as a value.
- [ ] `test/hull-deploy.mjs`: a deploy over a two-cell berth run advances `travelled` by the eased speed, poses the hull along the run, hands the hull back at the end (`player.freeMode` and `virtualStart` as the original sets them) and is a no-op without a graph.
- [ ] Suites: `--opening`, `--story`, `--seats`, `--defense`.
- [ ] Deban entry; commit.

---

### Task 8: The round's records (executed by the planner, not the executor)

- [ ] `npm run architecture` prints td-tab's lines: re-base `lineCeilings` in `docs/architecture-budget.json` to the printed count + 150 (a round's slack, by decision), record the number in the entry.
- [ ] Architecture review of the branch (skill `architecture-review`), entry `2026-10-13-refactor-round-2-architecture-review`.
- [ ] `docs/STATE.md`: a short 2026-10-13 refactor-round-2 section (what moved, the proofs, the suites, what is open); `npm run log -- render`; `npm run check`.
- [ ] Commit — `Records: refactor round 2 (ceiling re-based to N, review, STATE.md)`.
