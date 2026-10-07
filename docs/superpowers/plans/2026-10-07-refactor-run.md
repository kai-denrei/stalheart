# Refactor run: ownership, the budget, and the controller's remaining blocks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** give every block that still lives in `src/td-tab.js` and in the hosts that grew beside it one named owner, replace the arbitrary size ratchet with checks that measure ownership, and leave the controller a composition of ticks.

**Architecture:** the controller keeps world construction, the frame's order of ticks and the wiring of hosts; everything with a subject (the sky, Isao's moments, the colony's props, the fire support, the canyon, the tank's drive, the tower loop, the enemy loop, the tank's laser, the wave clock, the dev overlays, the URL flags, the copy tables) becomes a module in `src/fx`, `src/domain`, `src/platform` or `src/content` with a narrow host literal built in td-tab. No host is handed to a nested factory. Behaviour does not change in any task; every move is proven by running the old and new code side by side, by the browser suites, and by the host-contract test.

**Tech Stack:** native ESM, Three.js (vendored), node 22 tests in `test/*.mjs` (`npm test`), the browser harness `scripts/browser-test.mjs` behind `scripts/browser-lock.sh`, espree/escodegen from the npx cache for proofs (never a dependency of the repo).

Owner, 2026-10-07: the next pass is a refactor run "to identify key areas of potential improvements"; "an arbitrary rule does not seem like the wisest choice ... including the option to get rid of our arbitrary byte budget if necessary." Budget decision delegated: "default clear to get rid of it if Fable/Opus make the call that it makes sense." The owner test-runs locally before anything is merged or pushed.

## Global Constraints

- **No behaviour change.** A task that finds a bug records it (a deban entry, `status: open`) and leaves the behaviour; the owner decides. The one exception is Task 1, which changes the guard, not the game.
- **One commit per task**, message in the project's register (what moved, where, the proof), ending with the Co-Authored-By line from the session. `git config user.email` must read `270854086+kai-denrei@users.noreply.github.com` before the first commit. Never push. Never merge.
- **Every edit of a `src/*.js` file is followed by `node --check <file>`** before anything else runs. A browser suite that times out at load is a syntax error, not a flaky suite.
- **After every task:** `npm test`, `npm run check` (runs `npm run architecture`), `npm run build`, then the task's browser suites. Baseline on `main` (e4853f55, 2026-10-07): 185 node test programs pass, `npm run check` passes.
- **Browser suites never serve a tree that is being edited.** Snapshot first (`scripts/refactor-snapshot.sh` from Task 0), run `scripts/browser-lock.sh node scripts/browser-test.mjs <flag>` with cwd = the snapshot. One Chrome at a time on this 16 GB machine; check `~/scripts/check-memory.sh` before a suite and back off at WARN. Known pre-existing stops: `--phone` stops at step 5, `--shield-story` step 2 and the story-world Rotor-kill step are flaky on main; baseline a failing suite on `main` before blaming the branch.
- **td-tab's line count must fall over the run** (8,734 at the start) and must never exceed the ceiling of Task 1. Each extraction task states its net line change in its commit message.
- **Layer rules stand:** `src/core` imports core; `src/domain` imports core/domain/the pinned kernel; `src/content` imports core/content; `src/platform` and `src/fx` never import `td-tab.js` or a lab; no new top-level `src/*.js`. New modules take a host object of named members; a host is never passed on to another factory.
- **Host literals in td-tab are one member per line**, values for consts and function declarations, getters (`x: () => x`) for rebound lets, setters (`setX: (v) => (x = v)`, returning the written value) for lets the module writes, and a lazy wrapper for anything declared later in `initTdTab` (TDZ).
- Comments move with their code, every sentence of them. Owner attributions ("owner, 2026-09-16") stay.
- Record each task with the project `/deban` skill (fallback: `npm run log -- add FILE` with an entry shaped like `docs/log/entries/2026-09-25-controller-dead-code-and-ratchets.json`). Keep `docs/STATE.md` current at the end (Task 18).
- The sandbox refuses compound shell commands that mix `sed`/`git`/`$(...)`, `zsh` parameter expansion in one-liners and awk programs: write a script file and run it.

---

## The ownership map (measured 2026-10-07, `src/td-tab.js` 8,734 lines / 522,363 bytes / 13 lines over 500 characters)

The module's 168 imports take lines 1–89; `initTdTab` is lines 91–8,734 (509,739 bytes). By region of its body, largest first (bytes, lines, blocks):

| Region | Lines | Bytes | Blocks | Owner today | Proposed owner |
| --- | --- | --- | --- | --- | --- |
| Tower combat loop: `stepWalker` 6374, `stepTowers` 6466–6661 (15.6 KB), `losClear`, tracers, `spawnTowerShot` (one 652-char line), `updateTowerShots` 6760–6837, beams, lightning, slugs, `updateBeams`, `clearTowers` 6921–6950 | 536 | 34.7 KB | controller | `src/fx/tower-combat.js` (Task 10) |
| Camera, build view, geometry, actors: `buildGeometry` 1513–1595, `buildActors` 1611–1750, `placeActors` 1752–1823, `setView`, `updateCameraGoal`, viewport bias | 526 | 28.5 KB | controller | stays (world construction is the controller's); `buildActors`/`placeActors` are candidates for a later round |
| `gameHooks` 8399–8647 (20.3 KB, ~170 members, the acceptance adapter) + `enterPilot`/`leavePilot` 8650–8717 | 334 | 28.0 KB | controller | stays this run; its sector/gunship/missile scenarios already route through the owners' `test` members |
| Enemies: `clearEnemies`, `spawnEnemies`, `addSpawnPoint`, portals, `armWave`, `spawnWave`, `releaseSpawns`, `updateEnemies` 4090–4299 (12.9 KB), `killCreature` | 447 | 24.5 KB | controller | `src/fx/enemy-step.js` (Task 11) |
| Wiring: `makeSectorRun`, `storyApi` 8096–8160, host literals, `urlParams` and the probes (`stateprobe`, `keyprobe`, `layoutAt`) 8075–8395 | 271 | 24.3 KB | controller | stays, shrinks as hosts get narrow literals; the flags move (Task 6) |
| Setup: renderer, sky query, laser station literal (lines 325–336, two 800-char lines), strike feed, warn ring 446–502, radar, lights | 373 | 21.6 KB | controller | warn ring → `src/fx/warn-ring.js` (Task 13); the rest stays |
| Input: `onKeyEvent` 2395–2498, hold buttons, throttle, pad taps 2507–2655, build pointers 2660–2858 | 431 | 20.7 KB | controller | `src/platform/tank-input.js`, `src/fx/build-pointer.js` (Task 15) |
| Tank blocking, `tankSight` 1277–1317, `viewWatch` 1332–1369, the diag overlay 1376–1443, `ctlWatch` | 345 | 20.5 KB | controller | diag + viewWatch → `src/platform/diag-overlay.js` (Task 5); blocking/sight stay |
| Isao the worker: 5577–6015 (`spawnIsao`, `placeWorker`, orders, `pilotIsao`, `stepWorker`, `updateIsao`) | 388 | 20.1 KB | controller | `src/fx/isao-worker.js` (Task 8) |
| `frame` 7813–8073 (two 900-char lines): paused presentation, the wave clock, the breach-opened callback, the dive shot, HUD | 262 | 18.4 KB | controller | stays as the order of ticks; the wave clock leaves (Task 13) |
| World state and the brief system (`paintBrief`/`showBrief`/`stepBrief` 694–751), achievements, orbs | 365 | 15.4 KB | controller | stays |
| Tank motion: `chooseNext` 2101–2181, `advanceMotion` 2196–2350 (9.7 KB), bump/recoil/heat, `rotate`, `updateSmoothDir` | 274 | 15.0 KB | controller | `src/fx/hull-drive.js` (Task 9) |
| Tower weapons: seekers 6185–6216, plasma links / `throwPlasma` / `lanceBeam` / `stepPlasmaBeams` 6230–6368 | 282 | 14.9 KB | controller | plasma → `src/fx/plasma-beams.js` (Task 12) |
| Glossary, callouts, HUD paint, pause, wave card (`announceWave` 3550, `updateNextPreview` 3576, a **second `WebGLRenderer`** at 3536) | 282 | 14.2 KB | controller | wave card → `src/fx/wave-card.js` (Task 14) |
| The tank's laser: `updateLasers` 4580–4740 (9.5 KB), beams 4441–4578, `fire` | 264 | 13.8 KB | controller | `src/fx/tank-laser.js` (Task 12) |
| `regenerate` 3628–3823 (one 935-char line) | 212 | 13.0 KB | controller | stays (world build); its long line is broken in Task 3 |
| `loseGame` 5166–5215 with `VERDICT_LOW/MID/HIGH` 5130–5165 (1.2 KB of copy), `playerHit`, deploy 5256–5339 | 196 | 11.6 KB | controller | the copy → content (Task 7); the rest stays |
| Engine audio 7593–7653, the perf overlay and GPU timers 7661–7767, `animate` | 203 | 11.2 KB | controller | perf overlay → `src/platform/perf-overlay.js` (Task 5) |
| Tutorial banners, coach, stick, wake lock 3040–3275 | 232 | 10.5 KB | controller | stays (`SHELL_WORDS` → content, Task 7) |
| Shield dynamics, `updateProjectiles` 4879–4965, `breachWallCell` | 173 | 10.0 KB | controller | stays |
| Tower placement and score 5359–5572 (`placeTowerObj`, one 521-char line) | 173 | 8.9 KB | controller | stays |
| Strike console: arm/safety/launch UI, `executeStrike` 2939–3036 | 173 | 8.7 KB | controller | `src/fx/strike-console.js` (Task 16) |
| Achievements block, laps, `checkVictory`, coins, `expandRound` 7365–7426 | 154 | 7.9 KB | controller | stays |
| Terraformer yard 6963–7156 | 169 | 7.5 KB | controller | `src/fx/terraformer-yard.js` (Task 17) |
| lil-gui dev panel 7429–7577 (73 one-line bindings) | 119 | 6.3 KB | controller | `src/platform/dev-panel.js` (Task 5) |
| Isao's lines, rank visuals, `damageEnemy` | 86 | 5.2 KB | controller | stays |
| Rewards, player death | 127 | 5.1 KB | controller | stays |
| Shop, raycast | 68 | 2.9 KB | controller | stays |

**The hosts beside the controller** (commits touching each since 2026-09-25 / distinct controller members read):

- `src/fx/programme-host.js` — 392 lines, 43 KB, **37 commits, 44 members**. Documented as "the controller's side of Isao's build programme"; its `build()` (lines 129–291) is in fact the story's per-frame tick and drives, in order: the sky hole and nebulae (66–93), Isao's threat and idle lines (94–108), the moment reel, the colony lapse, the first hull's roll-out (`createHullHost(c)` — the host passed on to a nested factory), the perks chip, the armory pad, the paint pad, the scoreboards, the site beacons, the gunship on auto, Isao's missile, the paint, the orbital works and their launches, SOL's calibration line, and only then (from the `orders.some((o) => !o.worker)` line) the back gate, the repairs and the next programme step. Its returned members: `perks hasPerk nukes engaged tankReady build sideBreachCandidates canyonPlan canyonPass canyonOver canyonCut breakSide repaired printed interlude finale tier aliveBudget swell gunshipAuto colony hopsToHeart`. Six are the programme. This is "controller, part two" and the run's first target (Task 4).
- `src/fx/sector-run.js` — 470 lines, 42.6 KB, 23 commits, 36 members. One subject (the sector loop: brief, breaches, seal, hold, debrief, gates, back door) composed over domain rules; cohesive. Stays; gets the host-contract check.
- `src/fx/expedition-glue.js` — 268 lines, 4 commits, 19 members (+ `createExpeditionsHost`). Cohesive. Stays.
- `src/fx/showcase-hooks.js` — 232 lines, 12 commits, 18 members. Cohesive. Stays.

**Two findings for the owner, not fixed by this run** (recorded as open entries in Task 18): `src/td-tab.js:3536` creates a second `THREE.WebGLRenderer` for the wave card's unit sprite (a second GL context on phones; the main renderer could draw it to a render target); and `gameHooks` (~170 members) is the only reader of many controller lets, which is what keeps them lets.

**Checked and not a finding:** every `localStorage` use in td-tab goes through `src/storage.js` (line 23 aliases it).

## The budget decision

The three ratchets on `src/td-tab.js` (lines 8,734 / bytes 522,369 / long lines 16, each only down) did their job: 13,505 → 8,734 lines since 2026-09-25. Their cost is now larger than their value: a one-line fix must pay for itself with a trimmed comment, and behaviour that cannot land in td-tab lands in a host that reads 44 controller members instead, which is the controller under another name. The numbers were pinned at whatever the file measured on the day; nothing about 522,369 is a property of the code.

Decision (Fable, on the owner's delegation): **the byte budget goes; the line budget becomes a ceiling with slack, re-based by decision at the end of an extraction round instead of ratcheting per commit; the long-line count keeps ratcheting down (a line over 500 characters is unreadable, and that count is what stops packing); and two ownership checks take the budget's job** — the host-contract test (Task 2: every member a host module reads is supplied by td-tab's literal, every member td-tab supplies is read, and no host is passed on to another factory) and the architecture-review skill's standing rule that controller growth is a finding. The ceiling is the one number that remains; the owner may drop it after this run.

## Proof tools (written once in Task 0, used by every extraction task)

All scratch tools live in `tools/refactor/` inside the worktree and are committed with Task 0 (they are small and the next round needs them). espree and escodegen are loaded from the npx cache, never installed.

---

### Task 0: The proof tools and the snapshot runner

**Files:**
- Create: `tools/refactor/README.md`
- Create: `tools/refactor/astsame.mjs`
- Create: `tools/refactor/harness.mjs`
- Create: `scripts/refactor-snapshot.sh`

**Interfaces:**
- Produces: `node tools/refactor/astsame.mjs A.js B.js` (exit 0 when the two files have the same AST ignoring positions and raw text); `tools/refactor/harness.mjs` exports `recorder()`, `fakeScene()`, `fakeCtx()`, `deepEqualLogs(a, b)`; `scripts/refactor-snapshot.sh <tag>` prints the snapshot directory it made.

- [x] **Step 1: Write `tools/refactor/astsame.mjs`**

```js
// Whole-file AST identity: the proof of a pure reflow (a line broken up, a member per line) and of a comment-only edit.
// Usage: node tools/refactor/astsame.mjs before.js after.js   -> exit 0 and "same" or exit 1 and the first differing path.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire(process.env.HOME + '/.npm/_npx/515228b7c8d004a2/node_modules/');
const espree = req('espree');
const strip = (n) => {
  if (Array.isArray(n)) return n.map(strip);
  if (n && typeof n === 'object') {
    const o = {};
    for (const k of Object.keys(n)) if (!['start', 'end', 'range', 'loc', 'raw'].includes(k)) o[k] = strip(n[k]);
    return o;
  }
  return n;
};
const parse = (f) => strip(espree.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }));
const diffPath = (a, b, path = '') => {
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) return path + '.length'; for (let i = 0; i < a.length; i++) { const d = diffPath(a[i], b[i], `${path}[${i}]`); if (d) return d; } return null; }
  if (a && b && typeof a === 'object' && typeof b === 'object') { const keys = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of keys) { const d = diffPath(a[k], b[k], `${path}.${k}`); if (d) return d; } return null; }
  return a === b ? null : `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
};
const d = diffPath(parse(process.argv[2]), parse(process.argv[3]));
if (d) { console.error('differs at ' + d); process.exit(1); } else console.log('same');
```

- [x] **Step 2: Write `tools/refactor/harness.mjs`**

```js
// Recording fakes for side-by-side runs of a controller block (old text, run through new Function) and its extracted module.
// Every call on a fake is logged as [path, args]; two logs that deep-equal prove the move preserved behaviour on that input.
export function recorder(log = [], path = 'root') {
  const fn = function () {};
  return new Proxy(fn, {
    get(_, k) {
      if (k === '__log') return log;
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      return recorder(log, `${path}.${String(k)}`);
    },
    set(_, k, v) { log.push([`${path}.${String(k)}=`, v]); return true; },
    apply(_, __, args) { log.push([`${path}()`, args.map(String)]); return recorder(log, `${path}()`); },
    construct(_, args) { log.push([`new ${path}`, args.map(String)]); return recorder(log, `new ${path}`); },
  });
}
// A 2D context and a scene whose every method call is logged; real three.js objects (Vector3, Quaternion, Object3D) may be
// mixed in when the block does maths on them — import them from ../../vendor/three.module.js in the harness file.
export const fakeCtx = (log) => recorder(log, 'ctx');
export const fakeScene = (log) => recorder(log, 'scene');
export function deepEqualLogs(a, b) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa === sb) return true;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { console.error(`log differs at ${i}:\n  old ${JSON.stringify(a[i])}\n  new ${JSON.stringify(b[i])}`); return false; }
  return false;
}
// Running the ORIGINAL block beside the module:
//   const text = fs.readFileSync('src/td-tab.js','utf8').split('\n').slice(START-1, END).join('\n');   // the block as it was
//   const run = new Function(...closureNames, text + '\nreturn stepWalker;');                           // closure names bound to fakes
//   const oldFn = run(...closureNames.map((n) => fakes[n]));
//   const newFn = createTowerCombat(hostFromTheSameFakes).stepWalker;
//   oldFn(input); newFn(input); deepEqualLogs(logOld, logNew)
```

- [x] **Step 3: Write `scripts/refactor-snapshot.sh`**

```zsh
#!/bin/zsh
# APFS-clone the worktree (no .git, artifacts, dist) into the session scratchpad so a browser suite serves a frozen tree
# while editing continues. Assets are COPIED (serve.mjs realpaths every file and 403s anything outside --dir).
# Usage: scripts/refactor-snapshot.sh <tag>   -> prints the snapshot dir. Run suites with cwd = that dir:
#   (cd $(scripts/refactor-snapshot.sh t10) && scripts/browser-lock.sh node scripts/browser-test.mjs --defense)
set -e
tag=${1:-snap}
base=${STALHEART_SNAPSHOTS:-/private/tmp/stalheart-snapshots}
mkdir -p $base
dest=$base/$tag-$(date +%H%M%S)
mkdir -p $dest
for entry in *; do
  case $entry in .git|artifacts|dist|node_modules) continue;; esac
  cp -Rc $entry $dest/
done
ln -s $(pwd)/node_modules $dest/node_modules
echo $dest
```

- [x] **Step 4: Write `tools/refactor/README.md`** naming the three tools, the npx cache path (`~/.npm/_npx/515228b7c8d004a2/node_modules` for espree, `~/.npm/_npx/0f94ee7615faf582/node_modules` for escodegen) and the rule that nothing in `tools/refactor` is imported by `src/`.

- [x] **Step 5: Verify**

Run: `chmod +x scripts/refactor-snapshot.sh && node tools/refactor/astsame.mjs src/td-tab.js src/td-tab.js`
Expected: `same`
Run: `d=$(scripts/refactor-snapshot.sh t0); ls $d/src/td-tab.js $d/assets | head -3`
Expected: both exist.

- [x] **Step 6: Commit** — `Refactor run, tools: whole-file AST identity, recording fakes, the APFS snapshot runner`

---

### Task 1: The byte budget goes; the line budget becomes a ceiling

**Files:**
- Modify: `scripts/architecture.mjs:7-28` and `:69`
- Modify: `docs/architecture-budget.json`
- Modify: `test/architecture.mjs` (the analyzer's budget cases)
- Modify: `AGENTS.md:20`, `docs/ARCHITECTURE.md:40` (the ratchet paragraph), `.claude/skills/add-module/SKILL.md:27`, `.claude/skills/architecture-review/SKILL.md:13`

- [x] **Step 1: Write the failing test** in `test/architecture.mjs` (append; keep the existing cases):

```js
{
  const sources = { 'src/td-tab.js': 'a\n'.repeat(10) };
  const under = analyzeArchitecture(sources, [], { lineCeilings: { 'src/td-tab.js': 12 } });
  assert.deepEqual(under.problems, []);
  assert.ok(!under.hints.some((h) => /lower/.test(h)), 'a ceiling does not ask to be lowered');
  const over = analyzeArchitecture(sources, [], { lineCeilings: { 'src/td-tab.js': 9 } });
  assert.ok(over.problems.some((p) => /exceeds its line ceiling 9/.test(p)));
  const bytes = analyzeArchitecture(sources, [], { byteBudgets: { 'src/td-tab.js': 1 } });
  assert.deepEqual(bytes.problems, [], 'byteBudgets is no longer read');
  const long = analyzeArchitecture({ 'src/td-tab.js': 'x'.repeat(600) + '\n' }, [], { longLines: { over: 500, budgets: { 'src/td-tab.js': 0 } } });
  assert.ok(long.problems.some((p) => /long-line budget/.test(p)), 'the long-line ratchet stays');
}
```

- [x] **Step 2: Run it** — `node test/architecture.mjs` — Expected: FAIL (lineCeilings unknown, byteBudgets still enforced).

- [x] **Step 3: Change the analyzer.** Replace the `lineBudgets` and `byteBudgets` loops in `scripts/architecture.mjs` with:

```js
export function analyzeArchitecture(sources,kernel=[],{lineCeilings={},longLines=null,topLevelModules=null}={}) {
  const graph={},problems=[],hints=[];
  // A CEILING, NOT A RATCHET (owner, 2026-10-07, the refactor run): the controller may not grow past the ceiling, and nothing asks
  // for the ceiling to be lowered per commit; it is re-based by decision at the end of an extraction round. The byte budget is gone
  // (it taxed every one-line fix with a trimmed comment and pushed behaviour into hosts); the long-line count still ratchets down,
  // which is what stops packing. Ownership is checked by test/host-contracts.mjs.
  for(const [file,ceiling] of Object.entries(lineCeilings)) {
    if(!Object.hasOwn(sources,file))continue;
    const lines=(sources[file].match(/\n/g)||[]).length;
    if(lines>ceiling)problems.push(`${file}: ${lines} lines exceeds its line ceiling ${ceiling}; extract instead of growing`);
    else hints.push(`${file}: ${lines} lines under its ceiling ${ceiling}`);
  }
```

Keep the `longLines` loop and everything after it unchanged. Change the final success line (`:69`) to `... game/lab controller boundaries, the line ceiling, the long-line budget and top-level placement hold.` and the hint prefix (`:66`) from `Ratchet:` to `Guard:`.

- [x] **Step 4: Rewrite `docs/architecture-budget.json`:**

```json
{
  "note": "Enforced by npm run architecture. lineCeilings: a file may not grow past its ceiling; the ceiling is re-based by decision at the end of an extraction round, never ratcheted per commit (owner, 2026-10-07). longLines budgets only go down. topLevelModules is the frozen list of existing src/*.js files: new modules go into src/core, src/domain, src/content, src/platform, src/fx or src/labs. Ownership is checked by test/host-contracts.mjs.",
  "lineCeilings": {
    "src/td-tab.js": 9000
  },
  "longLines": {
    "over": 500,
    "budgets": {
      "src/td-tab.js": 16
    }
  },
  "topLevelModules": [ ...unchanged... ]
}
```

- [x] **Step 5: Docs.** In `AGENTS.md:20` replace "the `src/td-tab.js` line budget and the frozen top-level module list in `docs/architecture-budget.json`; budgets only go down" with "the `src/td-tab.js` line ceiling (re-based by decision after an extraction round, never ratcheted per commit), its long-line budget (only down) and the frozen top-level module list in `docs/architecture-budget.json`; host contracts are checked by `test/host-contracts.mjs`". In `docs/ARCHITECTURE.md` rewrite the paragraph at line 40 to the same effect (name the 2026-10-07 decision and why the byte budget went). In `.claude/skills/add-module/SKILL.md:27` replace the line-budget sentence with: "`src/td-tab.js` has a line ceiling. A hookup may add lines, but a block of behaviour belongs in a module with its own host literal; `test/host-contracts.mjs` fails when the literal and the module disagree." In `.claude/skills/architecture-review/SKILL.md:13` replace "the controller line budget" with "the controller line ceiling and long-line budget" and add to the evidence list: "4. `node test/host-contracts.mjs`. Quote the result."

- [x] **Step 6: Verify** — `node test/architecture.mjs && npm run architecture && npm run check` — Expected: all pass; the guard prints `Guard: src/td-tab.js: 8734 lines under its ceiling 9000`.

- [x] **Step 7: Commit** — `The byte budget goes and the line budget becomes a ceiling (owner's delegation, 2026-10-07): re-based by decision, never per commit; the long-line count still ratchets; ownership moves to test/host-contracts.mjs` — and record the decision with `/deban` (type decision, the alternatives: keep all three ratchets; drop every size rule; a per-function cap).

---

### Task 2: The host-contract test

**Files:**
- Create: `test/host-contracts.mjs`

**Interfaces:**
- Produces: a node test program (picked up by `npm test`) that discovers every host factory wired from `src/td-tab.js` and fails when a module reads a member td-tab does not supply, when td-tab supplies a member no module reads, or when a host parameter is passed on to another factory.

- [x] **Step 1: Write the test**

```js
// HOST CONTRACTS (the refactor run, 2026-10-07): the controller hands each src/fx and src/platform host module a literal of named
// members. This proves, without a parser dependency, that (1) every member the module reads is a key of td-tab's literal, (2) every
// key td-tab supplies is read by the module (or by a nested factory it names in NESTED, which is itself a finding), and (3) a host
// parameter is never passed on to another factory. The literal is evaluated under `with` over a Proxy that answers every free name
// with a callable token, so getters, setters and values resolve without the controller.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read = (p) => fs.readFileSync(p, 'utf8');
const td = read('src/td-tab.js');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const modules = [...walk('src/fx'), ...walk('src/platform')].filter((p) => p.endsWith('.js'));

// Factories: `export function createX(param)` or `export function createX({ a, b })`; only those td-tab calls with an object literal.
const factories = [];
for (const file of modules) {
  const src = read(file);
  for (const m of src.matchAll(/export function (create\w+|make\w+)\s*\(([^)]*)\)/g)) {
    const [, name, params] = m;
    const call = td.indexOf(name + '(');
    if (call < 0) continue;
    const lit = literalAfter(td, call);
    if (!lit) continue;
    factories.push({ file, name, params, src, literal: lit });
  }
}
assert.ok(factories.length >= 8, `found ${factories.length} host factories; expected the programme host, sector run, expedition glue, showcase hooks, hull host and more`);

// Known nested factories (a host passed on): each is a finding the run closes; the list must shrink, never grow.
const NESTED = new Set([
  // 'src/fx/programme-host.js:createHullHost',   // closed in Task 4
]);

const problems = [];
for (const f of factories) {
  const paramName = /^\s*(\w+)\s*$/.exec(f.params)?.[1];
  const reads = new Set();
  if (paramName) {
    for (const m of f.src.matchAll(new RegExp(`\\b${paramName}\\.(\\w+)`, 'g'))) reads.add(m[1]);
    for (const m of f.src.matchAll(new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*${paramName}\\b`, 'g'))) for (const n of names(m[1])) reads.add(n);
    for (const m of f.src.matchAll(new RegExp(`\\b(create\\w+|make\\w+)\\(\\s*${paramName}\\s*[,)]`, 'g'))) {
      const key = `${f.file}:${m[1]}`;
      if (!NESTED.has(key)) problems.push(`${f.file}: ${f.name} passes its host on to ${m[1]} (a nested factory); give it its own literal`);
    }
  } else for (const n of names(f.params.replace(/^\s*\{|\}\s*$/g, ''))) reads.add(n);
  const supplied = keysOf(f.literal, `${f.file}:${f.name}`);
  for (const r of reads) if (!supplied.has(r)) problems.push(`${f.file}: ${f.name} reads ${paramName ?? 'host'}.${r} but td-tab's literal has no ${r}`);
  for (const k of supplied) if (!reads.has(k)) problems.push(`${f.file}: td-tab supplies ${k} to ${f.name} but the module never reads it`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`Host contracts hold for ${factories.length} factories.`);

function names(pattern) {   // "a, b: c, d = 1, ...rest" -> [a, b, d]
  return pattern.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^\.\.\./, '').split(/[:=]/)[0].trim()).filter((s) => /^\w+$/.test(s));
}
function literalAfter(src, from) {   // the first { ... } after `from`, skipping strings, templates, comments and regex-free code
  let i = src.indexOf('{', from), depth = 0;
  const close = src.indexOf(')', from); if (i < 0 || (close >= 0 && close < i)) return null;   // no literal argument
  for (let j = i; j < src.length; j++) {
    const ch = src[j], nx = src[j + 1];
    if (ch === '"' || ch === "'") { j = skipString(src, j); continue; }
    if (ch === '`') { j = skipTemplate(src, j); continue; }
    if (ch === '/' && nx === '/') { j = src.indexOf('\n', j); continue; }
    if (ch === '/' && nx === '*') { j = src.indexOf('*/', j) + 1; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) return src.slice(i, j + 1); }
  }
  return null;
}
function skipString(s, j) { const q = s[j]; for (j++; j < s.length; j++) { if (s[j] === '\\') j++; else if (s[j] === q) return j; } return j; }
function skipTemplate(s, j) {
  for (j++; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '`') return j;
    if (s[j] === '$' && s[j + 1] === '{') { let d = 0; for (j++; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { if (!--d) break; } else if (s[j] === '`') j = skipTemplate(s, j); else if (s[j] === '"' || s[j] === "'") j = skipString(s, j); } }
  }
  return j;
}
function keysOf(literal, where) {
  const token = (name) => { const t = function () { return t; }; t.hostToken = name; return t; };
  const scope = new Proxy({}, { has: () => true, get: (_, k) => (k === Symbol.unscopables ? undefined : token(String(k))), set: () => true });
  let obj;
  try { obj = new Function('__scope', `with (__scope) { return (${literal}); }`)(scope); }
  catch (e) { throw new Error(`${where}: the literal does not evaluate under the sentinel scope: ${e.message}`); }
  return new Set(Object.keys(obj));
}
```

- [x] **Step 2: Run it** — `node test/host-contracts.mjs` — Expected: it fails with the real list: at least `programme-host.js: createProgrammeHost passes its host on to createHullHost`, plus any supplied-but-unread or read-but-missing members. **Every line of that output is a finding.** Add `src/fx/programme-host.js:createHullHost` to `NESTED` with a comment pointing at Task 4; for each unread member, confirm with grep that no nested factory reads it, then remove it from td-tab's literal (that is a dead member) or, if a nested factory reads it, leave it until Task 4 and note it in the commit message. For each missing member, the literal is wrong and the game has a latent `undefined` call: record it as a finding and fix the literal only if the fix is a missing getter for an existing name.

- [x] **Step 3: Verify** — `node test/host-contracts.mjs && npm test && node --check src/td-tab.js` — Expected: pass, `Host contracts hold for N factories.`

- [x] **Step 4: Commit** — `Host contracts: td-tab's literals and the host modules agree, proven without a parser; <N> dead members removed; the hull host's nesting listed as the open finding`

---

### Task 3: The thirteen long lines

**Files:**
- Modify: `src/td-tab.js` lines 8, 9, 33, 318, 332, 334, 2501, 3673, 5420, 6696, 7333, 7806, 8039, 8070, 8085, 8650 (the lines over 500 characters at the start; re-measure with `awk 'length($0)>500 {print NR}' src/td-tab.js`)

Pure reflow: imports one `import` per line; a packed statement list one statement per line at the enclosing indent; an object literal one member per line; a trailing `/* ... */` comment becomes `//` lines above the code it describes. No token changes.

- [x] **Step 1:** `cp src/td-tab.js /tmp/td-before.js` (the scratchpad path is fine too).
- [x] **Step 2:** Break each line. After each: `node --check src/td-tab.js`.
- [x] **Step 3: Prove** — `node tools/refactor/astsame.mjs /tmp/td-before.js src/td-tab.js` — Expected: `same`. Then check every comment survived: `grep -o '/\*[^*]*\*/\|//.*' /tmp/td-before.js | wc -l` vs the same on the new file (the count may rise as block comments split into lines, never fall).
- [x] **Step 4:** `awk 'length($0)>500 {print NR}' src/td-tab.js` — Expected: no output. Lower `longLines.budgets["src/td-tab.js"]` to `0` in `docs/architecture-budget.json`.
- [x] **Step 5:** `npm test && npm run check && npm run build`, then from a snapshot: `--defense`, `--seats`, `--laser-game` (the lines touched the laser station literal, the seat hand-over and the frame).
- [x] **Step 6: Commit** — `No line of the controller is over 500 characters (whole-file AST identity); the long-line budget is 0`

---

### Task 4: The programme host is the programme again

> **Executed after Task 5 (executor, 2026-10-07):** the reflow of Task 3 left td-tab at 8,933 lines; this task's seven literals one member per line cost about +160, which would pass the 9,000 ceiling. Task 5 (about -310) went first; nothing else depends on the order.

The story's per-frame tick leaves `src/fx/programme-host.js` for modules named after their subjects, each with its own host literal in td-tab; `createHullHost` gets its own literal; the order of the tick is preserved exactly.

**Files:**
- Create: `src/fx/sky-rig.js` — `createSkyRig(host) -> { tick() }` from programme-host lines 66–93 (`skyNote`, `hangSky`, `nebulaPlane`, `SKY`, `POLE`, `aimSkyHole`); host members: what those read of `c` (`scene`, `graph`, `dungeon`, `story`, `storyBase`, the heart … read the lines, list them).
- Create: `src/fx/isao-moments.js` — `createIsaoMoments(host) -> { tick(), engaged(), danger(), hopsToHeart(ci) }` from lines 94–108 and the `engaged`/`danger`/`ownCell`/`hopsToHeart` members.
- Create: `src/fx/colony-tick.js` — `createColonyTick(host) -> { tick(dt), colony() }` from `build()`'s moment reel, colony lapse, perks chip, armory pad, paint pad, scoreboards, site beacons, paint/dyes, orbital works and launches, SOL calibration (the blocks between the hull tick and the `orders.some` line, in their order), returning the `colony` member's state.
- Create: `src/fx/auto-support.js` — `createAutoSupport(host) -> { tick(dt), tier(), aliveBudget(), swell(), gunshipAuto(), nukes() }` from the gunship-on-auto and Isao's-missile blocks and those five members.
- Create: `src/fx/canyon-run.js` — `createCanyonRun(host) -> { sideBreachCandidates(), canyonPlan(), canyonPass(o), canyonOver(), canyonCut(plan), breakSide(cells) }`.
- Create: `src/fx/ending-host.js` — `createEndingHost(host) -> { interlude(), finale(then) }`.
- Modify: `src/fx/programme-host.js` — keeps `perks`, `hasPerk`, `tankReady`, `build` (from the `orders.some((o) => !o.worker)` line to the end), `repaired`, `printed`; its header rewritten to say so; its host shrinks to what those read. `tankReady` and the hull tick take `host.hull()` (the hull host built by td-tab) instead of `createHullHost(c)`.
- Modify: `src/td-tab.js:8143-8160` — one literal per module, one member per line; `storyApi.build` becomes the tick in the original order:

```js
    build: () => { sky.tick(); moments.tick(); colonyTick.tick(); story.hull?.tick(hullHost); autoSupport.tick(); programme.build(); },
```

  (verify against programme-host 129–160 which blocks sit before the hull tick, which after; the moment reel and the colony lapse come before it and `autoSupport` after the beacons — keep the exact sequence, splitting `colonyTick.tick` into `before()`/`after()` if a block of the colony sits between the hull tick and the gunship block).
- Modify: `test/programme-host.mjs` — stays green for the programme; add `test/sky-rig.mjs`, `test/isao-moments.mjs`, `test/auto-support.mjs`, `test/canyon-run.mjs`: each builds the module on recording fakes and asserts the calls the original made (take the expectations from running the ORIGINAL member through `new Function` over the same fakes, as in `tools/refactor/harness.mjs`).
- Modify: `test/host-contracts.mjs` — empty `NESTED`.

- [x] **Step 1: Read** `src/fx/programme-host.js` 64–392 in full and `src/td-tab.js` 8143–8160. Write the member → module table in the commit message draft before moving anything.
- [x] **Step 2: Prove `build()` splits cleanly:** `awk 'NR>=129 && NR<=250 && /^      return/' src/fx/programme-host.js` — Expected: no top-level `return` before the `orders.some` line (nested closures' returns are deeper-indented). If one exists, the block it guards moves with its predecessor.
- [x] **Step 3: For each new module:** create the file with the moved text (comments included), its own `host` destructuring, a test program on recording fakes; run `node --check` and the test. Then remove the text from programme-host and wire the literal in td-tab.
- [x] **Step 4: Preserve `storyApi`'s surface.** Before the change: in a browser run with `?acceptance=1&skip=defence&sector=1`, `Object.keys(window.__stalheartTest.programme ?? {})` and the keys of `storyApi` (expose them once through a temporary `gameHooks.storyApiKeys` you remove before committing). After: the same set. `Object.assign(storyApi, programme, sky, moments, colonyTick, autoSupport, canyon, ending)` is the shape (the members' names do not change).
- [x] **Step 5: Verify** — `node test/host-contracts.mjs` (no NESTED, no problems), `npm test`, `npm run check`, `npm run build`; from a snapshot: `--sectors`, `--canyon`, `--canyon-again`, `--backdoor`, `--gunship-auto`, `--laser-game`, `--sky-hole`, `--colony`, `--colony-lapse`, `--moment-reel`, `--finale`, `--showcase`, `--defense`. Baseline any red suite on `main` first.
- [x] **Step 6: Commit** — `The programme host is the programme again: the sky, Isao's moments, the colony's tick, the fire support, the canyon and the ending each a module with its own literal; the hull host no longer nested; storyApi unchanged`. Record with `/deban`.

---

### Task 5: The dev instrumentation leaves the controller

**Files:**
- Create: `src/platform/diag-overlay.js` — `createDiagOverlay(root, host) -> { tick(dt), toggle(), on() }` from `src/td-tab.js` 1376–1443 (`diagQ`, `diagEl`…`diagTick`) and `viewWatch` 1331–1369 (it feeds `diagHtml`); host: `camera`, `playerMesh()`, `player`, `enemies`, `t()`, the names `diagLine` reads (list them from the code).
- Create: `src/platform/perf-overlay.js` — `createPerfOverlay(root, { renderer, gl }) -> { tick(dt, frameCost), gpuBegin(), gpuEnd(), set(on), groups() }` from 7661–7767 (`perfEl`…`perfTick`, the GPU timer, `PERF_KEY`); `animate` keeps calling `perf.tick`.
- Create: `src/platform/dev-panel.js` — `createDevPanel(gui, { params, postfx, PLASMA, soundState, …callbacks }) ` from 7429–7577 (the lil-gui bindings; the `feel`, `strike`, `plasma`, `bloom`, `weights`, `sound` folders). The callbacks (`regenerate`, `applyLook`, `applyTowerLook`, `rebuildTowerObjects`, …) come in as host members; the module imports lil-gui itself? No: `gui` is created in td-tab (line 7429) and handed in, so `src/platform` stays free of the vendor import.
- Modify: `src/td-tab.js` — the three regions become one call each.
- Test: `test/diag-overlay.mjs`, `test/perf-overlay.mjs`, `test/dev-panel.mjs` on fakes (a fake `root.querySelector`, a recording `gui.add` returning a recording controller) asserting the same binding list and labels as the original.

- [x] **Step 1:** write the three tests from the ORIGINAL blocks run under `new Function` over the fakes (the labels and the order of `gui.add` calls are the contract).
- [x] **Step 2:** move the blocks; wire; `node --check`.
- [x] **Step 3: Verify** — `npm test`, `npm run check`, `npm run build`; snapshot suites: `--defense`, `--probe`, `--seats`; a manual check of `?diag=1` and the perf overlay (the `details` element opens and shows frame costs) through `scripts/browser-lock.sh node scripts/serve.mjs --read-only` is optional if `--probe` covers them (read the suite first).
- [x] **Step 4: Commit** — `The diag overlay, the perf overlay and the dev panel are platform modules; td-tab -<n> lines`

---

### Task 6: The URL flags are read once

**Files:**
- Create: `src/platform/game-flags.js` — `export function readGameFlags(search = location.search) -> Object.freeze({ mobile, coarse, metal, tier, sky, laser, mission, towerscale, acceptance, callouts, heart, look, wallTops, creature, seed, sim, simfast, simcap, roster, skip, sector, stateprobe, keyprobe, layout, brief, showcase, story, threat, … })` — every key td-tab reads today (`grep -n "urlParams.get\|URLSearchParams" src/td-tab.js` lists 42 sites; collect every literal key).
- Modify: `src/td-tab.js` — one `const flags = readGameFlags();` at the top of `initTdTab` (line 92), every site reads `flags.<key>`; `urlParams` (8077) and the eleven `new URLSearchParams(location.search)` go. The comments "urlParams is declared further down" go with them.
- Test: `test/game-flags.mjs` — the parser on `?mobile=1&coarse=1&metal=0&tier=low&sim=style1&seed=1000`, defaults for absent keys (`null`, never `undefined`, so `=== '1'` comparisons keep their meaning), and that the result is frozen.

- [x] **Step 1:** test first; **Step 2:** the module; **Step 3:** the sites, one grep-driven pass, `node --check` after each file save.
- [x] **Step 4: Verify** — `npm test`, `npm run check`, `npm run build`; snapshot suites that use flags: `--defense`, `--sectors` (`?skip=defence&sector=N`), `--showcase`, `--phone` (known stop at step 5: compare against main), `--sky-hole`, `--laser-game`, `--seats`; `?sim=style1&seed=1000&simfast=50&simcap=180&roster=2` through `--pacing`/`--passive`.
- [x] **Step 5: Commit** — `The URL flags are parsed once in src/platform/game-flags.js; the controller reads a frozen object`

---

### Task 7: The copy tables are content

**Files:**
- Create: `src/content/controller-copy.js` — `VERDICT_LOW`, `VERDICT_MID`, `VERDICT_HIGH` (td-tab 5130–5165), `RECKLESS_MSGS`, `HEART_MSGS` (882–889), `SHELL_WORDS` (3046–3052), `DIRECTIVE_LABEL` (1844–1847), `AUTO_OPTIONS` (2615–2618), `HEART_LOOKS` (571–581), each `Object.freeze`d, exported by the same names.
- Modify: `src/td-tab.js` — one import line (on an existing import line of `./content/…`), the tables deleted.
- Test: `test/controller-copy.mjs` — each export is frozen, non-empty, and the verdict tables have the same keys as each other.

`MOVES` (149–191) and `params` (99–145) stay: they reference closure state. **Executed (2026-10-07):** `HEART_LOOKS` stays too, for the same reason (its entries call `look()`, the terraformer's preload/make and THREE).

- [x] Steps: test, module, delete, `node --check`, `npm test && npm run check && npm run build`, snapshot `--debrief`, `--defense`, `--skip-tutorial`. Commit — `The controller's copy tables are content (verdicts, callouts, shell words, directive labels, heart looks)`.

---

### Task 8: Isao the worker

**Files:**
- Create: `src/fx/isao-worker.js` — `createIsaoWorker(host) -> { spawnIsao, spawnAssistant, placeWorker, placeIsao, orderTower, orderUpgrade, cancelOrder, finishOrder, updateIsao, stepWorker, pilotIsao, isaoPos, makeSiteRing, dropSiteRing, orders, orderByCell, workers, isao: () => isao, assistant: () => assistant }` from td-tab 5577–6015 (`ISAO_*` constants, `TYPE`/`applyType`, `isao`, `assistant`, `workers`, `printBeam`, `PRINT_TRAIL*`, `orders`, `orderByCell`, `isaoRadius`, `isaoPos`, `stepDir`, `spawnIsao`, `placeWorker`, `placeIsao`, site rings, the four order functions, `isaoHeading`…`ISAO_FLY`, `pilotIsao`, `stepWorker`, `updateIsao`).
- Modify: `src/td-tab.js` — the region becomes `const isaoWorker = createIsaoWorker({ … })` plus hoisted one-liners for the hot names (`function spawnIsao() { return isaoWorker.spawnIsao(); }`) where callers run at init time (TDZ: the programme host's literal reads `orders` and `spawnIsao` as values — hand it `isaoWorker.orders` and the one-liner).
- Test: `test/isao-worker.mjs` — `stepWorker` and `pilotIsao` on recording fakes (real `THREE.Vector3`/`Quaternion`, a recorded scene and `sfx`), expectations produced by the ORIGINAL block through `new Function` over the same fakes, for three inputs: an order with no worker, a worker mid-print, a cancelled order.

- [x] **Step 1:** list the closure names the region reads (`node --check` on a copy of the region wrapped in a function reports nothing; use the eslint `no-undef` diff from the toolkit note: `~/.npm/_npx/515228b7c8d004a2/node_modules/.bin/eslint` with a flat config of `no-undef`, pass the file by a relative name).
- [x] **Step 2:** harness first (the test), then the module, then the wiring.
- [x] **Step 3: Verify** — `npm test`, `npm run check`, `npm run build`; snapshot: `--sectors`, `--base`, `--base-look`, `--laser-game`, `--defense`, `--back-gate`, `--grow`.
- [x] **Step 4: Commit** — `Isao the worker is src/fx/isao-worker.js (orders, the print, his flight); the programme host reads it through the controller's literal; td-tab -<n> lines`.

---

### Task 9: The hull's drive

**Files:**
- Create: `src/fx/hull-drive.js` — `createHullDrive(host) -> { advanceMotion(dt), chooseNext(), arriveAt(ci), rotate(d), updateSmoothDir(dt), bump(), recoil(), state: () => ({ bumpLeft, recoilLeft, cannonHeat }) }` from td-tab 2089–2393 (`tangentDirTo`, `openNeighbors`, `chooseNext`, `arriveAt`, `advanceMotion`, `BUMP_LEN`…`sleeveHot`, `steerEase`, `rotate`, `SMOOTH_RATE`, `updateSmoothDir`). The rules it already calls (`src/domain/drive-ramp.js`, `steer-ease.js`, `hull-contact.js`, `hover-kick.js`, `hull-stuck.js`) stay where they are.
- Modify: `src/td-tab.js` — the frame's `advanceMotion(dt)` and the heat-sleeve lines read the drive's state through getters.
- Test: `test/hull-drive.mjs` — `advanceMotion` for 120 frames on a fixed fake graph (three cells in a line, a wall), old block vs module, deep-equal logs and equal final `player.pos`/`player.cur`.

- [x] Steps as Task 8. Suites: `--seats`, `--seat-switch`, `--defense`, `--sectors`, `--canyon`, `--backdoor`, `--footprints`, `--pacing`. Commit — `The hull's drive is src/fx/hull-drive.js; td-tab -<n> lines`.

---

### Task 10: The tower combat loop

**Files:**
- Create: `src/fx/tower-combat.js` — `createTowerCombat(host) -> { stepWalker(tw, dt), stepTowers(dt), updateTowerShots(dt), updateBeams(dt), stepSlugs(dt), spawnBeam, spawnLightning, spawnSlug, clearTowers(), losClear(a, b), detonate(shot) }` from td-tab 6374–6960 (`stepWalker`, `stepTowers`, `losClear`, `makeTracer`, `spawnTowerShot`, `killTowerShot`, `endTowerShot`, `detonate`, `updateTowerShots`, `beamGeo`, `spawnBeam`, `spawnLightning`, `slugFx`, `spawnSlug`, `stepSlugs`, `updateBeams`, `clearTowers`); `towers`, `towerByCell`, `towerCells`, `towerShots`, `beams` (5359–5363) stay in td-tab and come in as values.
- Test: `test/tower-combat.mjs` — `stepTowers` for 60 frames with two fake towers (one in range of a fake enemy, one not), old vs new logs; `updateTowerShots` with one shot that lands.

- [x] Steps as Task 8. The eslint `no-undef` diff is mandatory here (the block reads ~60 closure names). Suites: `--defense`, `--gunship`, `--missile-parity`, `--sectors`, `--quiver-frame`, `--laser`, `--shield-perf`, `--pacing`, `--passive` (compare the printed session numbers with a `main` run of the same suite: the ideal defender's sector-1 loss time and kills must match within the run-to-run spread, which you establish with two `main` runs first). Commit — `The tower combat loop is src/fx/tower-combat.js; td-tab -<n> lines`.

---

### Task 11: The enemy loop

**Files:**
- Create: `src/fx/enemy-step.js` — `createEnemyStep(host) -> { clearEnemies, spawnEnemies, hopEstimate, addSpawnPoint, seedPortals, gateTakesShell, killPortal, armWave, spawnWave, releaseSpawns, updateEnemies(dt), killCreature(e, src), spawnQueue, state }` from td-tab 3870–4326 and the spawn queue 4084–4089; `enemies`, `spawnPoints`, `wave`, `waveActive` stay in td-tab as values/getters/setters.
- Test: `test/enemy-step.mjs` — `updateEnemies` for 30 frames with three fake enemies (one walking, one at the heart, one dead) old vs new; `releaseSpawns` with a queue of two.

- [x] Steps as Task 8. Suites: `--sectors`, `--breach-game`, `--crowd-probe`, `--defense`, `--canyon`, `--backdoor`, `--rim-holes`, `--pacing`. Commit — `The enemy loop is src/fx/enemy-step.js; td-tab -<n> lines`.

---

### Task 12: The tank's laser and the plasma beams

**Files:**
- Create: `src/fx/tank-laser.js` — from td-tab 4441–4770 (`laserShots`, heat, `BEAM_*`, `plasma`, `beamRig`, `ensureBeams`, `applyBeamRank`, `applyReachToe`, `drawBeam`, `hideBeams`, the laser button band, `LASER_*`, `killLaser`, `updateLasers`, `fire`).
- Create: `src/fx/plasma-beams.js` — from 6230–6368 (`plasmaBeams`, `PLASMA_LINKS`, `PLASMA_W`, `makePlasmaLinks`, `throwPlasma`, `lanceBeam`, `stepPlasmaBeams`).
- Tests: `test/tank-laser.mjs` (`updateLasers` 60 frames: held, overheated, released), `test/plasma-beams.mjs` (`throwPlasma` then 20 `stepPlasmaBeams`).

- [x] Steps as Task 8. Suites: `--laser`, `--laser-game`, `--quiver-frame`, `--defense`, `--seats`. Commit — `The tank's laser and the plasma beams are fx modules; td-tab -<n> lines`.

---

### Task 13: The wave clock and the warn ring

> **Executed in part (2026-10-07):** the warn ring moved (src/fx/warn-ring.js). The wave clock did not: its seven lets are read and written at about twenty controller sites and its cleared branch interleaves the clock's writes with the score, the sim curve, the hold and the sitrep, so a decisions interface would reorder effects. Next round: gather the seven lets into one state object first (entry 2026-10-07-warn-ring-module-wave-clock-deferred).

**Files:**
- Create: `src/domain/wave-clock.js` — pure: `createWaveClock({ warn: WAVE_WARN }) -> { tick(dt, { waveActive, pulseGap, cleared, stalled, canArm, anyAlive }) -> { arm: bool, spawn: bool, charge, beat: bool } , arm(), state() }` holding `waveIn`, `waveCharge`, `warnBeat`, `interClock`, `waveAge` with the exact branch logic of td-tab's frame (the block from `if (waveIn >= 0)` through the boss omen) and `armWave`'s timer part. The decisions (when to arm, when to spawn, when a warn beat fires, when the omen cues) are returned; the controller performs them (`spawnWave()`, `warnRing(...)`, `sfx.play`).
- Create: `src/fx/warn-ring.js` — `createWarnRing(scene, { max: WARN_MAX }) -> { ring(ci, color, life, radius, centers), tick(dt) }` from td-tab 446–502.
- Test: `test/wave-clock.mjs` — a 40-second scripted run (cleared field, a wave arming, the stall safety, the boss omen at 10 s) asserting the sequence of decisions equals the one the ORIGINAL frame block produces under `new Function` with the same inputs.

- [x] Steps as Task 8. Suites: `--defense`, `--sectors`, `--round6`, `--round7`, `--pacing`. Commit — `The wave clock is a domain rule and the warn ring an fx module; the frame performs their decisions`.

---

### Task 14: The wave card

**Files:**
- Create: `src/fx/wave-card.js` — from td-tab 3533–3602 (`waveEl`, `waveTimer`, the sprite renderer, scene, camera, sun, `waveUnit`, `announceWave`, `nextEl`, `updateNextPreview`), as `createWaveCard(root, host) -> { announce(wave), preview(), dispose() }`. **Behaviour unchanged**, the second renderer included; its replacement by a render target on the main renderer is the owner's call (recorded in Task 18).
- Test: `test/wave-card.mjs` on a fake `THREE` surface? No: it constructs a real `WebGLRenderer`; test the HTML the card writes by stubbing `createWaveCard`'s renderer through an injected `makeRenderer` host member (default `() => new THREE.WebGLRenderer(...)`), which the test replaces with a recorder.

- [x] Steps as Task 8. Suites: `--defense`, `--sectors`, `--round9`. Commit — `The wave card is src/fx/wave-card.js (unchanged: its own renderer is an open finding)`.

---

### Task 15: Input

**Files:**
- Create: `src/platform/tank-input.js` — from td-tab 1191–1231 (`keys`, `cruise/stuck/kick`, throttle state, `noteFastTap`, `steerHold`, `autoMode`, `gotoCell`/`stopGoto`) and 2395–2655 (`onKeyEvent`, listeners, `releaseInputs`, `toggleView`, `holdButton`, the throttle slider, the pad taps, `syncDirectiveChip`, the auto radial): `createTankInput(root, host) -> { keys, state: () => ({ cruise, stuck, kick, throttle, steerHold, autoMode }), release(), paintThrottle(), syncDirectiveChip(), syncAutoRadial(), dispose() }`.
- Create: `src/fx/build-pointer.js` — from 2660–2858 (build pointers, pinch, long press, `refuseCaption`, `endBuildPointer`, the fire pad): `createBuildPointer(container, host) -> { dispose() }`.
- Tests: `test/tank-input.mjs` (synthetic `keydown`/`keyup` through a fake `addEventListener` registry: the `keys` map after W, shift, release-all), `test/build-pointer.mjs` (a tap, a drag, a long press through fake pointer events: the host calls recorded).

- [x] Steps as Task 8. Suites: `--seats`, `--seat-switch`, `--defense`, `--skip-tutorial`, `--phone` (compare with main's step-5 stop), `--nuke-key`. Commit — `The tank's input is a platform module and the build pointer an fx module; td-tab -<n> lines`.

---

### Task 16: The strike console

**Files:**
- Create: `src/fx/strike-console.js` — from td-tab 2860–3037 (`armBtn`…`launchLatin`, `refuseArm`, `armUiKey`, `syncArmUi`, the listeners, `executeStrike`, `strikePortalsBefore`) and 404–443 (`strikecamEl`, `scInfoEl`, `scRangeEl`, `strikingUi`, `STRIKE_M_PER_UNIT`, `scSkipEl`, `strikeFeedInfo`, `syncStrikeFeed`): `createStrikeConsole(root, host) -> { syncArmUi(), syncStrikeFeed(), executeStrike(), striking: () => strikingUi }`.
- Test: `test/strike-console.mjs` — `syncArmUi` for the four arm states on a fake root (the class list and text written), old vs new.

- [x] Steps as Task 8. Suites: `--nuke-key`, `--defense`, `--laser-game`, `--round13`. Commit — `The strike console is src/fx/strike-console.js; td-tab -<n> lines`.

---

### Task 17: The terraformer yard

**Files:**
- Create: `src/fx/terraformer-yard.js` — from td-tab 6963–7130 (`TF`, `tfYard`, `tfQueue`, `tfJob`, `tfContainers`, `tfYardCell`, `tfStart`, `doorBox`, `shutDoors`, `AUTO_RESERVE`, `autoUpClock`, `autoUpgradeTick`, `tfMilestone`, `tfTick`, `tfReset`, `terraLine`): `createTerraformerYard(host) -> { start(), tick(dt), reset(), autoUpgradeTick(dt), milestone(), line() }`.
- Test: `test/terraformer-yard.mjs` — `tfTick` for 100 frames from `tfStart` on fakes, old vs new.

- [x] Steps as Task 8. Suites: `--grow`, `--base`, `--defense`. Commit — `The terraformer yard is src/fx/terraformer-yard.js; td-tab -<n> lines`.

---

### Task 18: The round's records

**Files:**
- Modify: `docs/architecture-budget.json` — re-base the ceiling: `lineCeilings["src/td-tab.js"]` = td-tab's line count rounded up to the next hundred plus 200 (the decision is "re-based at the end of a round"; say the number in the entry).
- Modify: `docs/STATE.md` — a "What landed on 2026-10-07 (the refactor run, branch `refactor-run`)" section in the register of the 2026-09-25 one: the budget decision, the ownership map's outcome (td-tab lines before/after, the modules made), the two open findings (the wave card's second renderer; `gameHooks` as the reader that keeps lets lets), what was left for a later round (`buildActors`/`placeActors`, `gameHooks`, `regenerate`).
- Deban: one entry per task if not already written; two `status: open` findings.

- [ ] **Step 1:** `wc -l src/td-tab.js`, `npm run architecture` (quote), `node test/host-contracts.mjs` (quote), `npm test`, `npm run check`, `npm run build`; the full snapshot battery once: `--defense --sectors --canyon --backdoor --gunship --gunship-auto --laser --laser-game --seats --showcase --finale --sky-hole --colony --debrief --pacing --passive --phone --shield-story` (the last two compared with `main`).
- [ ] **Step 2:** write STATE.md and the entries; `npm run log:check`.
- [ ] **Step 3: Commit** — `Records: the refactor run (td-tab <before> -> <after> lines, <n> modules, the ceiling re-based to <N>), STATE.md current`.

Then stop. Do not merge, do not push. Report: the per-task table (task, commit, td-tab delta, suites run and their results, anything red and whether it is red on main), the open findings, and the line ceiling you set.
