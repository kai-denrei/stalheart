# Handover, Gunship Call-in and Expeditions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the Quiver's hard cores clear, the towers fire on their own at normal strength and the wave clock starts. Piloting moves to the tank and to a gunship pass called in from an earned meter. Guarded expeditions to the landing sites bring home parts that unlock Relay, Mortar and Lancer, and later Plasma, Needle and Heptapod.

**Architecture:** Three new pure domain modules hold the rules, each Node-tested: `automation`, `gunship-call` and `expeditions`. Their tunables live in content. The story beats gain a start phase so a jump can land after the handover. `src/td-tab.js` asks the domain modules on existing lines only; its line budget stays flat. A new `--defense` browser suite drives the whole loop through test hooks.

**Tech Stack:** Native ESM, no dependencies; Node test programs (`test/*.mjs`, run by `npm test`); headless Chrome acceptance (`scripts/browser-test.mjs`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-handover-gunship-call-expeditions-design.md`.
- New code goes only in `src/core/`, `src/domain/`, `src/content/` and `src/fx/`. No new top-level `src/*.js`.
- `src/core`, `src/domain` and `src/content` are pure: no `window`, `document`, `localStorage`, `sessionStorage` or `fetch` anywhere in their code, including trailing `//` comments.
- `domain` imports only `domain` and `core`, never `content`. The controller passes content values in.
- `src/td-tab.js` must not grow: line budget 13957 (`docs/architecture-budget.json`). Edits replace or extend existing lines only. Run `wc -l src/td-tab.js` after every edit.
- **One-liner trap:** `src/td-tab.js`, `src/sentry-pilot.js` and `src/platform/story-world.js` have very long one-liners. Appending a `// comment` mid-line silently comments out the rest, and `npm run check` and `npm test` still pass. Inside such lines use `/* */`. After each edit, confirm the line's original tail is still live code.
- `window.__stalheartPilotTest.state()` throws while the gunship is mounted. In probes, use `window.__stalheartTest.state()`.
- The browser suite always uses port 18155: never run two suites at once. A developer dev server runs on port 8155; leave it running.
- 16 GB machine: before each browser run, check `~/scripts/check-memory.sh` and back off at WARN. Wait for a run inside the same Bash call (foreground, long timeout).
- `--story-world` has known flaky steps (story-world-rotor-kill, story-world-cleared). Rerun once before concluding anything.
- No colored emoji in product UI.
- Commit after each task. The author must be Kai Denrei <270854086+kai-denrei@users.noreply.github.com>. Every message ends with a blank line and exactly these two lines:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX`
  Do not push.

## Facts the tasks rely on (read on `5de461b`)

**Tower firing and pilot power (`src/td-tab.js`):**
- Tower fire gate (line 8085): `if((tw.def.attack==='slowfield' && towerOffline(shield,tw.id,tNow)) || (storyMode && !pilotMode))continue;`
- Pilot cadence (line 8153): `tw.cooldown = shotInterval(eff.rate * (pilotMode ? story?.pilot.rateMul ?? 1 : 1));`
- Pilot damage (line 8371): `dmg: eff.dmg * (pilotMode ? story?.pilot.dmgMul ?? 1 : 1),`

**Kills and waves (`src/td-tab.js`):**
- Kill credits: the ram at line 5280, `eco.award(spec.bounty, { ram: true });`; every other kill at line 5457, `eco.award(Math.max(1, Math.ceil(spec.bounty * (KILL_PAY[src] ?? 0.5))));`. `eco.award` returns the biomass credited.
- The story has no wave clock: `function armWave() { if (storyMode) return;` (line 4994). The clock arms at line 10013: `if (interClock >= gap - WAVE_WARN && !(lab.on && lab.holdWaves) && !storyMode) armWave();`. A cleared field resets at line 9992: `waveActive = false; interClock = 0; waveCharge = 0;`.
- Enemies are built in `releaseSpawns` (lines 5055-5082), from queue entries `{ type, sp, at, ...o }`.
- Enemy step pool (line 5199): `if (story?.ring.size && e.type === story.hardcore && story.ring.has(e.cur)) { const stay = exits.filter((c) => story.ring.has(c)); pool = stay.length ? stay : [e.cur]; }`

**Gunship and the views strip:**
- The gunship clock (line 9969) starts `{ const ev = stepGunship(gunship, dt, GUNSHIP_ORBIT); storyViews?.station(onStation(gunship), phaseLeft(gunship));`
- The story API object is one line at 10341 (`const storyApi = { … }`). Its `unlock: (what) => { if (what === 'views') { … mount: (key) => { if (key === 'gunship') { if (!onStation(gunship)) return; …` builds the views strip and calls `storyViews.mounts(towers.map((t) => ({ key: t.key, label: t.def.label.replace(/^\d+\.\s*/, '') })))`.
- The same object's spawn: `spawn: (type, ci, o = null) => { spawnQueue.push({ type, sp: story?.source ?? { ci, alive: true, obj: new THREE.Group() }, at: spawnClock, ...o }); }`
- The gunship route's far breach cell: `gunshipFar()`, on line 438.

**Towers, hulls and carrying:**
- The print shop reads `unlockedTowerKeys(wave)` at lines 3157 and 3921.
- `function orderTower(key, ci, { quiet = false } = {}) {` is at line 7008. Its first check is `if (!def) return false;`.
- A hull is lost at line 6366: `playerHP--;`.
- The regen carry check (line 6189): `if (carryingRegen && dungeon.distToHeart[player.cur] <= 2) {`

**Test hooks:** `window.__stalheartTest = {` starts at line 13800; its `state()` already reports `story: story?.beats.state() ?? null`.

**Story beats (`src/domain/story-beats.js`):**
- `makeStoryBeats({ … })` starts at `phase = 'landed'`.
- Phases in order: `landed, foundry, printing, rotor-ready, tremor, breach, approach, override, piloting, cleared, quiver-piloting, settled, study-talk, study, expedition`.
- Line 74: `if (hardcores >= 2 && api.enemies() === 0) { api.brief?.('quiver_cleared'); api.unlock?.('views'); said.add('quiver_cleared'); enter('settled'); }`
- Line 77, the expedition beat: `api.brief?.('rocket_sites'); api.sites?.(); api.planetView?.(); said.add('rocket_sites'); enter('expedition');`

**Story world and HUD:**
- `src/platform/story-world.js` builds the story object (`home: plan.cells.landing`, `sites`, `hud: createStoryHud()`, `pilot: STORY_PILOT`, `socketToward`, …) only when `stage >= 1`.
- `readStoryQuery(search)` returns `{ short, world, threat, stage, landmarks }`.
- `src/fx/story-hud.js`: `sites(dirs)` draws amber triangles.
- `src/fx/story-views.js`: `createStoryViews(root, on)` returns `{ active, mounts, station, dispose }`.

**Landing sites and towers:**
- Sites in `src/content/base-layout.js` (open anchors): `rocket-a` (x -300, z 140, clear 16), `rocket-b` (330, -90, clear 16), `wreck` (120, -360, clear 24).
- Story jumps: `STORY_JUMPS` in `src/content/nav.js`. Jumps are finished by `src/fx/jump-to.js`. `MODE_SWITCHES` is in `src/core/nav-match.js`.
- Tower keys come from `TOWER_ORDER` in `src/towers.js`. Task 3 Step 1 reads their exact spelling.

---

### Task 1: The automation rules

**Files:**
- Create: `src/domain/automation.js`
- Modify: `src/content/story-defaults.js` (append `STORY_HANDOVER`)
- Test: `test/automation.mjs`

**Interfaces:**
- Produces:
  - `STORY_PHASES: string[]`
  - `isAutomated(phase, { from, stage, defendStage }) → boolean`
  - `pilotMultipliers(automated, pilot) → { dmgMul, rateMul }`
  - `seatsOffered(automated, towerKeys) → { towers: string[], tank: true, gunship: true }`
  - `STORY_HANDOVER = { from: 'settled', defendStage: 8 }`

- [ ] **Step 1: Write the failing test** `test/automation.mjs`:

```js
import assert from 'node:assert/strict';
import { STORY_PHASES, isAutomated, pilotMultipliers, seatsOffered } from '../src/domain/automation.js';
import { STORY_HANDOVER, STORY_PILOT } from '../src/content/story-defaults.js';

assert.deepEqual(STORY_PHASES, ['landed', 'foundry', 'printing', 'rotor-ready', 'tremor', 'breach', 'approach', 'override', 'piloting', 'cleared', 'quiver-piloting', 'settled', 'study-talk', 'study', 'expedition']);
assert.deepEqual(STORY_HANDOVER, { from: 'settled', defendStage: 8 });
const at = (phase, stage = 6) => isAutomated(phase, { ...STORY_HANDOVER, stage });
for (const p of ['landed', 'printing', 'piloting', 'cleared', 'quiver-piloting']) assert.equal(at(p), false, `${p} is still the tutorial`);
for (const p of ['settled', 'study-talk', 'study', 'expedition']) assert.equal(at(p), true, `${p} is past the handover`);
assert.equal(at('landed', 8), true, 'the Defend stage is automated from the start');
assert.equal(at('nonsense'), false, 'an unknown phase is not automated');
assert.deepEqual(pilotMultipliers(false, STORY_PILOT), { dmgMul: STORY_PILOT.dmgMul, rateMul: STORY_PILOT.rateMul }, 'the tutorial seats are overpowered');
assert.deepEqual(pilotMultipliers(true, STORY_PILOT), { dmgMul: 1, rateMul: 1 }, 'after the handover no multiplier');
assert.deepEqual(pilotMultipliers(false, null), { dmgMul: 1, rateMul: 1 });
assert.deepEqual(seatsOffered(false, ['rotor', 'quiver']), { towers: ['rotor', 'quiver'], tank: true, gunship: true });
assert.deepEqual(seatsOffered(true, ['rotor', 'quiver']), { towers: [], tank: true, gunship: true }, 'no tower mounts after the handover');
console.log('Automation: the handover phase, the Defend stage, pilot multipliers and seats hold.');
```

- [ ] **Step 2: Run it to see it fail**

Run: `node test/automation.mjs`
Expected: `ERR_MODULE_NOT_FOUND` (or a missing `STORY_HANDOVER` export).

- [ ] **Step 3: Write `src/domain/automation.js`**

```js
// THE HANDOVER (owner, 2026-09-14): after the Quiver's hard cores clear, every tower fires on its own at its normal
// strength, the tutorial's piloting multipliers stop, and the player's seats become the tank and the gunship. Pure: the
// controller passes the story phase, the stage and the handover content in.
export const STORY_PHASES = Object.freeze(['landed', 'foundry', 'printing', 'rotor-ready', 'tremor', 'breach', 'approach', 'override', 'piloting', 'cleared', 'quiver-piloting', 'settled', 'study-talk', 'study', 'expedition']);

export function isAutomated(phase, { from = 'settled', stage = 0, defendStage = 8 } = {}) {
  if (stage >= defendStage) return true;
  const i = STORY_PHASES.indexOf(phase), f = STORY_PHASES.indexOf(from);
  return i >= 0 && f >= 0 && i >= f;
}

export function pilotMultipliers(automated, pilot) {
  if (automated || !pilot) return { dmgMul: 1, rateMul: 1 };
  return { dmgMul: pilot.dmgMul ?? 1, rateMul: pilot.rateMul ?? 1 };
}

export function seatsOffered(automated, towerKeys = []) {
  return { towers: automated ? [] : towerKeys.slice(), tank: true, gunship: true };
}
```

- [ ] **Step 4: Append `STORY_HANDOVER` to `src/content/story-defaults.js`:**

```js
// the handover (docs/superpowers/specs/2026-09-14-handover-gunship-call-expeditions-design.md): the first automated phase and the Defend stage
export const STORY_HANDOVER = Object.freeze({ from: 'settled', defendStage: 8 });
```

- [ ] **Step 5: Run the tests**

Run: `node test/automation.mjs && npm test && npm run check`
Expected: the automation line prints, then `103 test programs passed.`, and the check passes.

- [ ] **Step 6: Commit**

```bash
git add src/domain/automation.js src/content/story-defaults.js test/automation.mjs
git commit -F - <<'EOF'
Handover rules: the phase that automates the towers, pilot multipliers only before it, seats after it

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 2: The gunship call-in meter

**Files:**
- Create: `src/domain/gunship-call.js`
- Modify: `src/domain/gunship.js` (add `startStation`), `src/content/gunship.js` (add `GUNSHIP_CALL`)
- Test: `test/gunship-call.mjs` (covers `startStation` too)

**Interfaces:**
- Produces:
  - `makeGunshipCall(cfg) → { fill, threshold, calls, overhead }`
  - `fillFromKill(st, biomass, cfg) → number`
  - `fillFromWaveClear(st, cfg) → number`
  - `isFull(st) → boolean`
  - `callGunship(st) → boolean`
  - `passEnded(st, cfg) → boolean`
  - `callProgress(st) → 0..1`
  - `startStation(st, orbit) → boolean` in `src/domain/gunship.js`
  - `GUNSHIP_CALL = { perBiomass, perWaveClear, firstThreshold, threshold }`

- [ ] **Step 1: Read `src/domain/gunship.js` lines 1-60.** Note three things:
  - the state fields `makeGunship` creates (`phase`, `left`, `passes`, `clock`, …);
  - the event `stepGunship` returns on the frame the station phase ends. It returns `'arrive'` when a pass arrives; find the departure name, for example `'leave'`;
  - how `test/gunship.mjs` reports (`check(name, cond)`).

  Call the departure name `DEPART` below, and use its real value in Task 5.

- [ ] **Step 2: Write the failing test** `test/gunship-call.mjs`:

```js
import assert from 'node:assert/strict';
import { makeGunshipCall, fillFromKill, fillFromWaveClear, isFull, callGunship, passEnded, callProgress } from '../src/domain/gunship-call.js';
import { GUNSHIP_CALL, GUNSHIP_ORBIT } from '../src/content/gunship.js';
import { makeGunship, startStation, onStation } from '../src/domain/gunship.js';

const cfg = { perBiomass: 1, perWaveClear: 40, firstThreshold: 100, threshold: 250 };
const st = makeGunshipCall(cfg);
assert.equal(st.threshold, 100, 'the first call comes sooner');
assert.equal(callGunship(st), false, 'an empty meter cannot call');
fillFromKill(st, 30, cfg); fillFromWaveClear(st, cfg);
assert.equal(st.fill, 70);
assert.equal(callProgress(st), 0.7);
fillFromKill(st, 0, cfg); fillFromKill(st, -5, cfg); fillFromKill(st, NaN, cfg);
assert.equal(st.fill, 70, 'nothing, negative or NaN biomass does not fill');
fillFromKill(st, 500, cfg);
assert.equal(st.fill, 100, 'the meter caps at its threshold');
assert.equal(isFull(st), true);
assert.equal(callGunship(st), true, 'a full meter calls the pass');
assert.equal(st.overhead, true);
assert.equal(callProgress(st), 1, 'overhead reads full');
assert.equal(callGunship(st), false, 'no second call while overhead');
fillFromKill(st, 50, cfg);
assert.equal(st.fill, 100, 'kills during the pass do not bank');
assert.equal(passEnded(st, cfg), true);
assert.deepEqual([st.fill, st.threshold, st.overhead, st.calls], [0, 250, false, 1], 'after the pass: empty, the regular threshold');
assert.equal(passEnded(st, cfg), false, 'a pass ends once');

for (const k of ['perBiomass', 'perWaveClear', 'firstThreshold', 'threshold']) assert.ok(GUNSHIP_CALL[k] > 0, `GUNSHIP_CALL.${k}`);
assert.ok(GUNSHIP_CALL.firstThreshold < GUNSHIP_CALL.threshold, 'the first call is cheaper');

const g = makeGunship(GUNSHIP_ORBIT);
assert.equal(onStation(g), false);
assert.equal(startStation(g, GUNSHIP_ORBIT), true, 'a called pass puts the platform on station at once');
assert.equal(onStation(g), true);
assert.equal(g.left, GUNSHIP_ORBIT.station);
assert.equal(startStation(g, GUNSHIP_ORBIT), false, 'already on station');
console.log('Gunship call: kill and wave-clear fill, the first threshold, one call per pass, reset after, startStation.');
```

- [ ] **Step 3: Run it to see it fail**

Run: `node test/gunship-call.mjs`
Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Write `src/domain/gunship-call.js`**

```js
// THE GUNSHIP IS CALLED, NOT SCHEDULED (owner, 2026-09-14): after the handover a meter fills from the biomass kills
// earn (streak included) and from each cleared wave; when it is full the player calls the pass at the moment they
// choose; the meter restarts empty when the pass leaves. Refunds and grants never reach it. Pure.
export function makeGunshipCall(cfg) {
  return { fill: 0, threshold: cfg.firstThreshold, calls: 0, overhead: false };
}

export function fillFromKill(st, biomass, cfg) {
  if (st.overhead || !(biomass > 0)) return st.fill;
  st.fill = Math.min(st.threshold, st.fill + biomass * cfg.perBiomass);
  return st.fill;
}

export function fillFromWaveClear(st, cfg) {
  if (st.overhead) return st.fill;
  st.fill = Math.min(st.threshold, st.fill + cfg.perWaveClear);
  return st.fill;
}

export const isFull = (st) => !st.overhead && st.fill >= st.threshold;

export function callGunship(st) {
  if (!isFull(st)) return false;
  st.overhead = true; st.calls++;
  return true;
}

export function passEnded(st, cfg) {
  if (!st.overhead) return false;
  st.overhead = false; st.fill = 0; st.threshold = cfg.threshold;
  return true;
}

export const callProgress = (st) => (st.overhead ? 1 : Math.min(1, st.fill / st.threshold));
```

- [ ] **Step 5: Add `startStation` to `src/domain/gunship.js`**, directly after `export const onStation = …`. Match the field names Step 1 found; if `passes` does not exist, drop that increment:

```js
// A CALLED PASS (the post-handover call-in): the platform comes on station now, for the orbit's station seconds.
export function startStation(st, orbit) {
  if (st.phase === 'station') return false;
  st.phase = 'station'; st.left = orbit.station; st.passes++;
  return true;
}
```

- [ ] **Step 6: Add `GUNSHIP_CALL` to `src/content/gunship.js`**, after `GUNSHIP_ORBIT`:

```js
// the post-handover call-in meter: biomass earned from kills fills it one for one, a cleared wave adds a bonus; the
// first call comes within a few waves, later ones cost more (owner, 2026-09-14: an earned call-in)
export const GUNSHIP_CALL = Object.freeze({ perBiomass: 1, perWaveClear: 40, firstThreshold: 150, threshold: 300 });
```

- [ ] **Step 7: Run the tests**

Run: `node test/gunship-call.mjs && node test/gunship.mjs && npm test && npm run check`
Expected: all pass; `104 test programs passed.`

- [ ] **Step 8: Commit**

```bash
git add src/domain/gunship-call.js src/domain/gunship.js src/content/gunship.js test/gunship-call.mjs
git commit -F - <<'EOF'
Gunship call-in meter: kills and cleared waves fill it, a full meter calls the pass, it restarts empty after

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 3: The expedition rules and sites

**Files:**
- Create: `src/domain/expeditions.js`
- Modify: `src/content/story-defaults.js` (add `STORY_EXPEDITIONS`), `src/content/base-layout.js` (three later sites)
- Test: `test/expeditions.mjs`

**Interfaces:**
- Produces:
  - `makeExpeditions(sites) → { sites: [{ id, tower, part, reveal, state }], carrying }`
  - `reveal(st, id)`, `guardsCleared(st, id)`, `reach(st, id)` and `hullLost(st)`, each returning a boolean
  - `deliver(st) → tower key | null`
  - `unlockedTowers(st, base) → string[]`
  - `nextReveals(st) → id[]`
  - `siteState(st, id)`
  - `STORY_EXPEDITIONS = { base, deliverCells, sites: [{ id, tower, part, reveal, guards: [{ type, count }] }] }`

- [ ] **Step 1: Read `TOWER_ORDER`, `TOWER_BY_KEY` and the tower list in `src/towers.js`.** Note the exact keys for Relay, Mortar, Lancer, Plasma, Needle and Heptapod. They may be spelled `relay`, `mortar`, `lancer`, `plasma`, `needle` and `heptapod` or differently (for example `heptapod_a6`); use the real keys in Step 5. Read `src/content/base-layout.js` lines 30-60 too, including the foundry entry at line 35. Note which field makes a structure start hidden until a beat reveals it: the foundry's comment says "hidden until the foundry beat reveals them". Call it `HIDDEN_FIELD` below.

- [ ] **Step 2: Write the failing test** `test/expeditions.mjs`, using the real tower keys from Step 1:

```js
import assert from 'node:assert/strict';
import { makeExpeditions, reveal, guardsCleared, reach, deliver, hullLost, unlockedTowers, nextReveals, siteState } from '../src/domain/expeditions.js';
import { STORY_EXPEDITIONS } from '../src/content/story-defaults.js';
import { TOWER_BY_KEY } from '../src/towers.js';
import { STORY_LAYOUT } from '../src/content/base-layout.js';

const ex = makeExpeditions(STORY_EXPEDITIONS.sites);
assert.deepEqual(STORY_EXPEDITIONS.base, ['rotor', 'quiver']);
assert.deepEqual(ex.sites.map((s) => s.state), STORY_EXPEDITIONS.sites.map(() => 'hidden'), 'every site starts hidden');
for (const s of STORY_EXPEDITIONS.sites) {
  assert.ok(TOWER_BY_KEY[s.tower], `${s.id}: ${s.tower} is a tower`);
  assert.ok(s.part && s.guards.length && s.guards.every((g) => g.count > 0), `${s.id}: a part and a guard nest`);
  assert.ok(STORY_LAYOUT.structures.some((x) => x.id === s.id && x.anchor === 'open'), `${s.id}: a landing site in the base layout`);
}
const first = STORY_EXPEDITIONS.sites.filter((s) => !s.reveal).map((s) => s.id);
assert.deepEqual(first, ['rocket-a', 'rocket-b', 'wreck'], 'the three puzzle towers first');

assert.equal(reach(ex, 'rocket-a'), false, 'a hidden site cannot be reached');
assert.equal(reveal(ex, 'rocket-a'), true); assert.equal(reveal(ex, 'rocket-a'), false, 'revealed once');
assert.equal(siteState(ex, 'rocket-a'), 'guarded');
assert.equal(reach(ex, 'rocket-a'), false, 'guards first');
assert.equal(guardsCleared(ex, 'rocket-a'), true);
assert.equal(reach(ex, 'rocket-a'), true);
assert.equal(ex.carrying, 'rocket-a');
reveal(ex, 'rocket-b'); guardsCleared(ex, 'rocket-b');
assert.equal(reach(ex, 'rocket-b'), false, 'one part carried at a time');
assert.equal(hullLost(ex), true, 'losing the hull drops the part');
assert.equal(siteState(ex, 'rocket-a'), 'cleared', 'back at its site');
assert.equal(ex.carrying, null);
assert.equal(deliver(ex), null, 'nothing to deliver');
reach(ex, 'rocket-a');
assert.equal(deliver(ex), STORY_EXPEDITIONS.sites[0].tower, 'delivering names the tower');
assert.deepEqual(unlockedTowers(ex, STORY_EXPEDITIONS.base), ['rotor', 'quiver', STORY_EXPEDITIONS.sites[0].tower]);
assert.deepEqual(nextReveals(ex), [], 'later sites wait for three deliveries');
for (const id of ['rocket-b', 'wreck']) { reveal(ex, id); guardsCleared(ex, id); reach(ex, id); deliver(ex); }
const after3 = STORY_EXPEDITIONS.sites.filter((s) => s.reveal?.after === 3).map((s) => s.id);
assert.deepEqual(nextReveals(ex), after3, 'three parts home reveal the next sites');
assert.equal(after3.length, 2);
for (const id of after3) { reveal(ex, id); guardsCleared(ex, id); reach(ex, id); deliver(ex); }
const after5 = STORY_EXPEDITIONS.sites.filter((s) => s.reveal?.after === 5).map((s) => s.id);
assert.deepEqual(nextReveals(ex), after5, 'five parts home reveal the last site');
assert.equal(after5.length, 1);
assert.ok(STORY_EXPEDITIONS.deliverCells > 0);
console.log('Expeditions: hidden, guarded, cleared, carried, delivered; one part at a time; the drop on hull loss; unlocks; later reveals.');
```

- [ ] **Step 3: Run it to see it fail**

Run: `node test/expeditions.mjs`
Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Write `src/domain/expeditions.js`**

```js
// EXPEDITIONS (owner, 2026-09-14): each landing site holds the part for one tower, guarded by a nest. A site moves
// hidden → guarded → cleared → carried → delivered; the tank carries one part at a time, a lost hull drops it back at
// its site, and a delivered part lets Isao print that tower. Later sites reveal after enough deliveries. Pure.
const siteOf = (st, id) => st.sites.find((s) => s.id === id);

export function makeExpeditions(sites) {
  return { sites: sites.map((s) => ({ id: s.id, tower: s.tower, part: s.part, reveal: s.reveal ?? null, state: 'hidden' })), carrying: null };
}

export function reveal(st, id) {
  const s = siteOf(st, id);
  if (!s || s.state !== 'hidden') return false;
  s.state = 'guarded';
  return true;
}

export function guardsCleared(st, id) {
  const s = siteOf(st, id);
  if (!s || s.state !== 'guarded') return false;
  s.state = 'cleared';
  return true;
}

export function reach(st, id) {
  const s = siteOf(st, id);
  if (!s || s.state !== 'cleared' || st.carrying) return false;
  s.state = 'carried'; st.carrying = id;
  return true;
}

export function deliver(st) {
  const s = st.carrying ? siteOf(st, st.carrying) : null;
  if (!s) return null;
  s.state = 'delivered'; st.carrying = null;
  return s.tower;
}

export function hullLost(st) {
  const s = st.carrying ? siteOf(st, st.carrying) : null;
  if (!s) return false;
  s.state = 'cleared'; st.carrying = null;
  return true;
}

export const siteState = (st, id) => siteOf(st, id)?.state ?? null;

export function unlockedTowers(st, base) {
  return [...base, ...st.sites.filter((s) => s.state === 'delivered').map((s) => s.tower)];
}

export function nextReveals(st) {
  const home = st.sites.filter((s) => s.state === 'delivered').length;
  return st.sites.filter((s) => s.state === 'hidden' && s.reveal && home >= s.reveal.after).map((s) => s.id);
}
```

- [ ] **Step 5: Add `STORY_EXPEDITIONS` to `src/content/story-defaults.js`**, using the real tower keys from Step 1:

```js
// EXPEDITIONS (docs/superpowers/specs/2026-09-14-handover-gunship-call-expeditions-design.md): the landing sites, the tower each
// part unlocks, the guard nest, and when a later site reveals (after N parts are home). The Rotor and Quiver are the base.
export const STORY_EXPEDITIONS = Object.freeze({
  base: Object.freeze(['rotor', 'quiver']),
  deliverCells: 3,   // how close to the landing (the foundry) a carried part counts as home, in cells
  sites: Object.freeze([
    { id: 'rocket-a', tower: 'relay', part: 'field coil', reveal: null, guards: [{ type: 'barbed', count: 2 }, { type: 'amoeba', count: 8 }] },
    { id: 'rocket-b', tower: 'mortar', part: 'breech', reveal: null, guards: [{ type: 'barbed', count: 2 }, { type: 'amoeba', count: 10 }] },
    { id: 'wreck', tower: 'lancer', part: 'lens', reveal: null, guards: [{ type: 'barbed', count: 3 }, { type: 'amoeba', count: 12 }] },
    { id: 'rocket-c', tower: 'plasma', part: 'coil stack', reveal: { after: 3 }, guards: [{ type: 'barbed', count: 3 }, { type: 'amoeba', count: 14 }] },
    { id: 'rocket-d', tower: 'needle', part: 'optic', reveal: { after: 3 }, guards: [{ type: 'barbed', count: 3 }, { type: 'amoeba', count: 14 }] },
    { id: 'wreck-b', tower: 'heptapod', part: 'walker core', reveal: { after: 5 }, guards: [{ type: 'barbed', count: 4 }, { type: 'amoeba', count: 18 }] },
  ].map(Object.freeze)),
});
```

- [ ] **Step 6: Add the three later sites to `src/content/base-layout.js`**, directly after the `wreck` entry. Each carries `HIDDEN_FIELD` from Step 1, so it loads concealed and a reveal shows it. Match the foundry's exact field and value:

```js
  { id: 'rocket-c', asset: 'assets/models/story/hugin_deployed.glb', far: 'assets/models/far/hugin_deployed.glb', anchor: 'open', clear: 16, x: -430, z: -250, stage: 1, scale: 1.5, offset: [0, 6.3, 0], heading: [0.7, -0.7] /* + HIDDEN_FIELD: later site, revealed after three parts are home */ },
  { id: 'rocket-d', asset: 'assets/models/story/hugin_deployed.glb', far: 'assets/models/far/hugin_deployed.glb', anchor: 'open', clear: 16, x: 400, z: 320, stage: 1, scale: 1.5, offset: [0, 6.3, 0], heading: [-0.6, -0.8] /* + HIDDEN_FIELD */ },
  { id: 'wreck-b', asset: 'assets/models/story/hugin_wreck.glb', far: 'assets/models/far/hugin_wreck.glb', anchor: 'open', clear: 24, x: -90, z: 520, stage: 1, scale: 1.5, offset: [0, 0, 0], tilt: 92, lift: 3.6, heading: [0.2, -0.98] /* + HIDDEN_FIELD: revealed after five parts */ },
```

Replace each `/* + HIDDEN_FIELD… */` comment with the real field, keeping a short comment.

- [ ] **Step 7: Run the tests**

Run: `node test/expeditions.mjs && npm test && npm run check`
Expected: all pass; `105 test programs passed.`

Some tests pin the base layout's structure count or the story sanity record; `test/base-plan.mjs` and `test/story-planet.mjs` are candidates. If one fails only because three open-anchor sites were added, update that expectation to include them and say so in the report. Never change `STORY_SANITY` cells or heart.

- [ ] **Step 8: Commit**

```bash
git add src/domain/expeditions.js src/content/story-defaults.js src/content/base-layout.js test/expeditions.mjs
git commit -F - <<'EOF'
Expedition rules: each landing site holds a tower's part behind a guard nest; later sites reveal after parts come home

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 4: Story plumbing: a start phase, the handover order, the defense jump

**Files:**
- Modify: `src/domain/story-beats.js`, `src/platform/story-world.js`, `src/content/nav.js`, `src/core/nav-match.js`, and the `buildGameWorld(` call site in `src/td-tab.js` (one existing line)
- Test: `test/story-beats.mjs`, `test/nav-content.mjs`, `test/nav-match.mjs`

**Interfaces:**
- Consumes:
  - `STORY_PHASES` and `isAutomated` (Task 1)
  - `makeExpeditions` (Task 3)
  - `STORY_HANDOVER` and `STORY_EXPEDITIONS`
- Produces:
  - `makeStoryBeats({ …, startPhase = 'landed' })`, returning `{ tick, state, phase: () => phase, … }`
  - `readStoryQuery(search).phase`: a valid story phase or `null`
  - story object fields:
    - `handover: { from, defendStage, stage }`
    - `expeditions`
    - `siteCells: { [id]: { cell, clear } }`
  - `STORY_JUMPS` entry `defense`
  - `MODE_SWITCHES` includes `phase`

- [ ] **Step 1: Write the failing tests.**

Append to `test/story-beats.mjs`, before its final `console.log`. Read the file's `fakeGame` helper first and adapt the `api` shape if needed:

```js
{
  // A JUMP PAST THE HANDOVER: the beats start at a later phase, offer the views once, replay no landing faces
  const g = fakeGame();
  const unlocks = [];
  g.api.unlock = (what) => { unlocks.push(what); };
  const beats = makeStoryBeats({ socket: 1, startPhase: 'expedition' });
  assert.equal(beats.phase(), 'expedition');
  beats.tick(0.5, g.api); beats.tick(0.5, g.api);
  assert.equal(beats.phase(), 'expedition', 'nothing moves it back');
  assert.deepEqual(unlocks, ['views'], 'the views strip is offered once on a late start');
  assert.ok(!g.log.some((l) => l[0] === 'brief' && (l[1] === 'rough_landing' || l[1] === 'so_much_to_build')), 'no landing faces on a late start');
}
{
  // THE HANDOVER ORDER: the Quiver's wave clears into `settled` BEFORE the views are offered again, so the strip sees the automated phase
  const src = (await import('node:fs')).readFileSync(new URL('../src/domain/story-beats.js', import.meta.url), 'utf8');
  assert.match(src, /enter\('settled'\);\s*api\.unlock\?\.\('views'\)/, 'settled is entered before the views are offered');
}
```

Append to `test/nav-match.mjs`, before its final `console.log`:

```js
assert.ok(MODE_SWITCHES.includes('phase'), 'a story phase is a mode switch');
assert.equal(entryUrl({ page: 'index.html', hash: 'td', params: { story: '1' } }, '?sw=0&phase=expedition'), 'index.html?sw=0&story=1#td', 'leaving drops the phase');
```

Add `MODE_SWITCHES` to that file's import from `../src/core/nav-match.js` if it is not already imported.

In `test/nav-content.mjs`, change the jump ids assertion to:

```js
assert.deepEqual(STORY_JUMPS.map((j) => j.id), ['rotor', 'quiver', 'study', 'gunship', 'defense']);
```

- [ ] **Step 2: Run them to see them fail**

Run: `node test/story-beats.mjs; node test/nav-match.mjs; node test/nav-content.mjs`
Expected: failures on `beats.phase`, `MODE_SWITCHES.includes('phase')` and the jump ids.

- [ ] **Step 3: The beats.** Edit `src/domain/story-beats.js`:

1. Add `startPhase = 'landed',` to the destructured options on the `faceDelays = [0.6, 4], …` line.

2. Replace `let phase = 'landed', clock = 0, orderedAt = null, readyAt = null, spawned = 0, nextSpawn = 0, at = 0, faces = 0, said = new Set(), hardcores = 0;` with:

```js
  let phase = startPhase, clock = 0, orderedAt = null, readyAt = null, spawned = 0, nextSpawn = 0, at = 0, faces = 0, said = new Set(), hardcores = 0;
  // A LATE START (a jump past the handover): the landing faces are already said, and the views strip is offered on the first tick
  const late = startPhase !== 'landed';
  let offered = false;
  if (late) faces = 2;
```

3. At the top of `tick(dt, api) {`, right after `clock += dt;`, add:

```js
      if (late && !offered) { api.unlock?.('views'); offered = true; }
```

4. Change line 74's order so `settled` is entered before the views are offered:

```js
        if (hardcores >= 2 && api.enemies() === 0) { api.brief?.('quiver_cleared'); said.add('quiver_cleared'); enter('settled'); api.unlock?.('views'); }
```

5. In the returned object, next to `state: () => ({ … })`, add `phase: () => phase,`.

- [ ] **Step 4: The story world.** Edit `src/platform/story-world.js`:

1. Import `STORY_PHASES` from `'../domain/automation.js'`, `makeExpeditions` from `'../domain/expeditions.js'`, and `STORY_HANDOVER` and `STORY_EXPEDITIONS` alongside the existing `story-defaults.js` import.

2. In `readStoryQuery`, add a `phase` field to the returned object:

```js
    phase: STORY_PHASES.includes(q.get('phase')) ? q.get('phase') : null,   // ?phase=expedition: a jump past the handover starts the beats there
```

3. Give `buildGameWorld` a `phase = null` parameter: `export function buildGameWorld({ world, params, stage, scene, sfx = null, landmarks = 'shipped', phase = null })`.

4. In the `makeStoryBeats({ … })` call, add `startPhase: phase ?? 'landed',`.

5. In the story object literal, add these fields next to `pilot: STORY_PILOT`:

```js
    handover: { ...STORY_HANDOVER, stage },   // the phase and stage the towers turn automatic (src/domain/automation.js)
    expeditions: makeExpeditions(STORY_EXPEDITIONS.sites),
    siteCells: Object.fromEntries(plan.structures.filter((s) => s.anchor === 'open' && s.cell >= 0).map((s) => [s.id, { cell: s.cell, clear: s.clear }])),
```

- [ ] **Step 5: The call site.** Run `grep -n "buildGameWorld(" src/td-tab.js`. At that single existing line, where the story query result is in scope (for example `storyQuery`; read the line), pass `phase: <that query>.phase` inside the options object. Do not add a line. Then run `wc -l src/td-tab.js`: it must still be 13957.

- [ ] **Step 6: Navigation.**
  - In `src/core/nav-match.js`, add `'phase'` to `MODE_SWITCHES`.
  - In `src/content/nav.js`, add this jump after `gunship` in `STORY_JUMPS`:

```js
  { id: 'defense', label: 'DEFENSE', title: 'after the handover: automatic towers, the tank, the gunship call-in, the expeditions', url: 'index.html?world=story&stage=6&cine=0&acceptance=1&phase=expedition#td', wired: true },
```

- [ ] **Step 7: Run the tests**

Run: `node test/story-beats.mjs && node test/nav-match.mjs && node test/nav-content.mjs && npm test && npm run check`
Expected: all pass (105 programs); the td-tab budget holds.

- [ ] **Step 8: Commit**

```bash
git add src/domain/story-beats.js src/platform/story-world.js src/content/nav.js src/core/nav-match.js src/td-tab.js test/story-beats.mjs test/nav-match.mjs test/nav-content.mjs
git commit -F - <<'EOF'
Story plumbing for the handover: beats can start past it, settled comes before the views, a DEFENSE jump, expeditions on the story

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 5: The handover and the gunship call-in in the game

**Files:**
- Modify: `src/td-tab.js` (existing lines only), `src/fx/story-views.js`

**Interfaces:**
- Consumes:
  - `isAutomated`, `pilotMultipliers` (Task 1)
  - `makeGunshipCall`, `fillFromKill`, `fillFromWaveClear`, `isFull`, `callGunship`, `passEnded`, `callProgress`, `startStation`, `GUNSHIP_CALL` (Task 2)
  - story `handover` and `beats.phase()` (Task 4)
- Produces:
  - `storyViews.meter(progress, full)` in `src/fx/story-views.js`
  - `window.__stalheartTest.state()` fields `automated` and `gunshipCall`
  - test hook `fillGunshipCall(n)`

- [ ] **Step 1: Imports.** Extend the existing import line that holds `import { createThermalHeat } from './fx/thermal-heat.js';` (line 6) on the same line:

```js
 import { isAutomated, pilotMultipliers } from './domain/automation.js'; import { makeGunshipCall, fillFromKill, fillFromWaveClear, isFull as callFull, callGunship, passEnded, callProgress } from './domain/gunship-call.js'; import { GUNSHIP_CALL } from './content/gunship.js';
```

Add `startStation` to the existing import from `./domain/gunship.js` on line 91.

- [ ] **Step 2: Shared state on line 350.** On the line that starts `const postfx = makeBloom(`, right after `const thermalHeat = createThermalHeat(…);`, add:

```js
 const automated = () => !!story && isAutomated(story.beats.phase(), story.handover); const gunshipCall = makeGunshipCall(GUNSHIP_CALL); const feedCall = (n) => { if (automated()) fillFromKill(gunshipCall, n, GUNSHIP_CALL); return n; };
```

`story` is declared at line 603 and `automated()` is only called later, so the reference is safe at runtime.

- [ ] **Step 3: Towers fire on their own, with no multipliers after the handover.**
  - Line 8085: `(storyMode && !pilotMode)` → `(storyMode && !pilotMode && !automated())`.
  - Line 8153: `(pilotMode ? story?.pilot.rateMul ?? 1 : 1)` → `(pilotMode ? pilotMultipliers(automated(), story?.pilot).rateMul : 1)`.
  - Line 8371: `(pilotMode ? story?.pilot.dmgMul ?? 1 : 1)` → `(pilotMode ? pilotMultipliers(automated(), story?.pilot).dmgMul : 1)`.

- [ ] **Step 4: The wave clock runs after the handover.**
  - Line 4994: `function armWave() { if (storyMode) return;` → `function armWave() { if (storyMode && !automated()) return; if (storyMode && !story.source?.alive) storyApi.breach(gunshipFar());`
  - Line 10013: `&& !storyMode) armWave();` → `&& (!storyMode || automated())) armWave();`
  - Read lines 9980-9995. Confirm line 9992 (`waveActive = false; interClock = 0; waveCharge = 0;`) runs when a wave's field is cleared, not on a reset. If so, append `if (automated()) fillFromWaveClear(gunshipCall, GUNSHIP_CALL);` on that line. If the natural clear is line 4894 instead, append it there. Say which in the report.

- [ ] **Step 5: Kills feed the meter.**
  - Line 5280: `eco.award(spec.bounty, { ram: true });` → `feedCall(eco.award(spec.bounty, { ram: true }));`
  - Line 5457: `eco.award(Math.max(1, Math.ceil(spec.bounty * (KILL_PAY[src] ?? 0.5))));` → `feedCall(eco.award(Math.max(1, Math.ceil(spec.bounty * (KILL_PAY[src] ?? 0.5)))));`

- [ ] **Step 6: The gunship clock waits for a call after the handover.** Line 9969: replace

```js
{ const ev = stepGunship(gunship, dt, GUNSHIP_ORBIT); storyViews?.station(onStation(gunship), phaseLeft(gunship));
```

with (use Task 2's real `DEPART` value):

```js
{ const held = automated() && !onStation(gunship), ev = held ? null : stepGunship(gunship, dt, GUNSHIP_ORBIT); if (automated() && ev === 'DEPART') passEnded(gunshipCall, GUNSHIP_CALL); if (held) storyViews?.meter(callProgress(gunshipCall), callFull(gunshipCall)); else storyViews?.station(onStation(gunship), phaseLeft(gunship));
```

- [ ] **Step 7: The views strip.** On line 10341 (the `storyApi` object):
  - Change `if (key === 'gunship') { if (!onStation(gunship)) return;` → `if (key === 'gunship') { if (!onStation(gunship) && !(automated() && callGunship(gunshipCall) && startStation(gunship, GUNSHIP_ORBIT))) return;`
  - Change `storyViews.mounts(towers.map((t) => ({ key: t.key, label: t.def.label.replace(/^\d+\.\s*/, '') })));` → `storyViews.mounts(automated() ? [] : towers.map((t) => ({ key: t.key, label: t.def.label.replace(/^\d+\.\s*/, '') })));`

In `src/fx/story-views.js`, add a `meter` function after `station` and return it:

```js
  // after the handover: the call-in meter fills; full, the button calls the pass (owner, 2026-09-14)
  function meter(progress, full) { if (!ship) return; ship.disabled = !full; ship.classList.toggle('ready', full); ship.classList.remove('live'); const t = full ? 'GUNSHIP · CALL' : `GUNSHIP · ${Math.round(progress * 100)}%`; if (ship.textContent !== t) ship.textContent = t; }
```

Change the return to `return { active, mounts, station, meter, dispose() { nav.remove(); } };`. In `styles.css`, after the `#story-views button.gunship.live` rule, add `#story-views button.gunship.ready { border-color: #6fe6ff; color: #dff4ff; }`.

- [ ] **Step 8: Test hooks.** In the `window.__stalheartTest = {` object (from line 13800), on an existing line:
  - add `automated: automated(), gunshipCall: { ...gunshipCall },` inside the `state: () => ({ … })` literal, next to `story: story?.beats.state() ?? null,`;
  - add `fillGunshipCall: (n) => fillFromKill(gunshipCall, n, GUNSHIP_CALL),` as a property of the hook object.

- [ ] **Step 9: Check the file, the tests and the existing story suites.**

Run: `wc -l src/td-tab.js` → `13957`.

Run: `npm test && npm run check`, then, one at a time:
- `node scripts/browser-test.mjs --story-world`: the tutorial Rotor and Quiver are still piloted and overpowered. Rerun once on a known flaky step.
- `node scripts/browser-test.mjs --gunship`: the `gunship=station` URL is before the handover, so it is unchanged.

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/td-tab.js src/fx/story-views.js styles.css
git commit -F - <<'EOF'
The handover in play: towers fire on their own after the Quiver, the wave clock runs, the gunship waits for an earned call

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 6: Expeditions in the game

**Files:**
- Modify: `src/td-tab.js` (existing lines only), `src/fx/story-hud.js`, `src/isaobriefs.js`, `src/domain/story-beats.js` (one call)
- Test: `test/story-beats.mjs` (expeditions begin), `test/isaobriefs.mjs` (if it validates the table)

**Interfaces:**
- Consumes:
  - `reveal`, `guardsCleared`, `reach`, `deliver`, `hullLost`, `unlockedTowers`, `nextReveals` and `STORY_EXPEDITIONS` (Task 3)
  - `automated()` (Task 5)
  - story `expeditions` and `siteCells` (Task 4)
- Produces:
  - `storyApi.expeditionsBegin()`, `storyApi.openSite(id)` and `storyApi.expeditionStep()`
  - `story.hud.sites(list)`, where list items are `{ dir, state }`
  - briefs `site_cleared`, `part_home` and `sites_revealed`
  - test hooks `siteCells()`, `placeTank(ci)` and `killGuards(id)`
  - state fields `expeditions` and `unlocked`

- [ ] **Step 1: Read the pieces this task edits.**
  - `src/isaobriefs.js` lines 180-200 (the `relay` brief's fields), and `src/emotions.js` for valid `face` ids.
  - `src/td-tab.js` lines 6160-6195 (the pickup and regen carry code, to see where the player's per-frame update runs).
  - Lines 6340-6370, to find the name of the function that contains `playerHP--`.
  - Lines 9980-9995: the "field cleared" condition, which counts alive enemies.

- [ ] **Step 2: The beats begin the expeditions.** In `src/domain/story-beats.js` line 77, add `api.expeditionsBegin?.();` right after `api.sites?.();`. Append to `test/story-beats.mjs`, before its final `console.log`:

```js
{
  const src = (await import('node:fs')).readFileSync(new URL('../src/domain/story-beats.js', import.meta.url), 'utf8');
  assert.match(src, /api\.sites\?\.\(\);\s*api\.expeditionsBegin\?\.\(\);/, 'the expedition beat reveals the first sites');
}
```

- [ ] **Step 3: Briefs.** Add three entries to `BRIEFS` in `src/isaobriefs.js`, in the same shape as `relay` (use valid faces from `src/emotions.js`):

```js
  site_cleared: {
    id: 'site_cleared',
    face: 'surprised',
    title: 'THE PART IS THERE',
    lines: ['Nest cleared. I can see the part.', 'Drive in, grab it, bring it home to the foundry.'],
  },
  part_home: {
    id: 'part_home',
    face: 'glee',
    title: 'PART HOME',
    lines: ['That is the piece I was missing.', 'I can print it now. Pick a wall.'],
  },
  sites_revealed: {
    id: 'sites_revealed',
    face: 'surprised',
    title: 'MORE LANDING SITES',
    once: true,
    lines: ['New signals on the radar. More landers came down out there.', 'Same drill: clear the nest, bring the part home.'],
  },
```

If `test/isaobriefs.mjs` pins the brief count or ids, update it to include these three.

- [ ] **Step 4: Radar marks by state.** Replace the `sites` handling in `src/fx/story-hud.js`:
  - `sites(dirs)` becomes `sites(list) { sites = (list ?? []).map((s) => Array.isArray(s) ? { dir: s.slice(), state: 'guarded' } : { dir: s.dir.slice(), state: s.state }); },`
  - In `paint`, change `for (const d of sites) {` to `for (const { dir: d, state } of sites) {`.
  - Change `ctx.fillStyle = 'rgba(255, 190, 90, 0.85)';` to `ctx.fillStyle = state === 'guarded' ? 'rgba(255, 96, 96, 0.9)' : state === 'carried' ? `rgba(255, 255, 255, ${0.6 + 0.4 * Math.sin(t * 6)})` : 'rgba(255, 190, 90, 0.85)';`.

- [ ] **Step 5: Guards hold at their site.**
  - Line 5079: `slowFactor: 1, slowUntil: -1,` → `slowFactor: 1, slowUntil: -1, guard: entry.guard ?? null,`
  - Line 5199: replace `if (story?.ring.size && e.type === story.hardcore && story.ring.has(e.cur)) {` with `if (e.guard) { const stay = exits.filter((c) => dist3(graph.centers[c], e.guard.c) < e.guard.r); pool = stay.length ? stay : [e.cur]; } else if (story?.ring.size && e.type === story.hardcore && story.ring.has(e.cur)) {`
  - In the "field cleared" condition found in Step 1 (lines 9980-9995), change the alive count so guards do not hold a wave open. Where it tests `e.alive`, test `e.alive && !e.guard` instead, keeping the line count.

- [ ] **Step 6: The story API.** On line 10341:
  - Change the `spawn` property to: `spawn: (type, ci, o = null) => { spawnQueue.push({ type, sp: o?.guard ? { ci, alive: true, obj: new THREE.Group() } : story?.source ?? { ci, alive: true, obj: new THREE.Group() }, at: spawnClock, ...o }); },`
  - Add these properties to the same object:

```js
 openSite: (id) => { if (!story?.expeditions || !reveal(story.expeditions, id)) return; storyBase?.reveal(id); const cfg = STORY_EXPEDITIONS.sites.find((s) => s.id === id), c = story.siteCells[id]; if (!cfg || !c) return; for (const g of cfg.guards) for (let k = 0; k < g.count; k++) storyApi.spawn(g.type, c.cell, { spread: 1.2, delay: k * 0.3, guard: { site: id, c: graph.centers[c.cell], r: cellSide * (c.clear / 10 + 2) } }); }, expeditionsBegin: () => { for (const s of STORY_EXPEDITIONS.sites) if (!s.reveal) storyApi.openSite(s.id); }, expeditionStep: () => { const ex = story?.expeditions; if (!ex) return; for (const s of ex.sites) { const c = story.siteCells[s.id]; if (!c) continue; if (s.state === 'guarded' && !enemies.some((e) => e.alive && e.guard?.site === s.id) && !spawnQueue.some((q) => q.guard?.site === s.id)) { guardsCleared(ex, s.id); showBrief('site_cleared'); } if (s.state === 'cleared' && !ex.carrying && dist3(player.pos, graph.centers[c.cell]) < cellSide * (c.clear / 10 + 1)) reach(ex, s.id); } if (ex.carrying && dist3(player.pos, graph.centers[story.home]) < cellSide * STORY_EXPEDITIONS.deliverCells && deliver(ex)) { showBrief('part_home'); const more = nextReveals(ex); for (const id of more) storyApi.openSite(id); if (more.length) showBrief('sites_revealed'); } story.hud.sites(ex.sites.filter((s) => s.state === 'guarded' || s.state === 'cleared' || s.state === 'carried').map((s) => ({ dir: norm3(graph.centers[s.state === 'carried' ? story.home : story.siteCells[s.id].cell]), state: s.state }))); },
```

- [ ] **Step 7: The per-frame step, hull loss and unlocks.**
  - Line 6189: prepend `if (story?.expeditions && automated()) storyApi.expeditionStep(); ` on the same line, before `if (carryingRegen && …`.
  - Line 6366: `playerHP--;` → `playerHP--; if (story?.expeditions) hullLost(story.expeditions);`
  - Lines 3157 and 3921: `unlockedTowerKeys(wave)` → `(automated() ? unlockedTowers(story.expeditions, STORY_EXPEDITIONS.base) : unlockedTowerKeys(wave))`.
  - Line 7010 (in `orderTower`): `if (!def) return false;` → `if (!def || (automated() && !unlockedTowers(story.expeditions, STORY_EXPEDITIONS.base).includes(key))) return false;`
  - Imports: extend the line-6 import line with `import { reveal, guardsCleared, reach, deliver, hullLost, unlockedTowers, nextReveals } from './domain/expeditions.js'; import { STORY_EXPEDITIONS } from './content/story-defaults.js';`. If `STORY_EXPEDITIONS` would duplicate an existing import from `story-defaults.js`, add it to that import instead.

- [ ] **Step 8: Test hooks.** In the `window.__stalheartTest` object, on existing lines:
  - add `expeditions: story?.expeditions ?? null, unlocked: automated() ? unlockedTowers(story.expeditions, STORY_EXPEDITIONS.base) : null,` inside `state: () => ({ … })`;
  - add the properties `siteCells: () => story?.siteCells ?? {}, placeTank: (ci) => { player.cur = ci; player.prev = ci; player.pos = graph.centers[ci].slice(); }, killGuards: (id) => { for (const e of enemies) if (e.alive && e.guard?.site === id) killCreature(e, false); },`
  - using the hull-loss function name from Step 1, add `hitTank: () => <that function>(),`. If calling it needs arguments or would also end the game, name the arguments the function takes and pass safe values. Say what you chose in the report.

- [ ] **Step 9: The radar shows the new route after the tank breaches a wall** (spec section 3, lane-shaper).

1. Read `src/td-tab.js` lines 968-987 (`simTrunk`): what it returns (a Set or an array of cell ids on the greedy descent from the live spawns to the heart). Read the tank shell's wall breach at line 5964: `if (!breachWallCell(ci)) return; explode('tank.shell', graph.centers[ci]);`.

2. In `src/fx/story-hud.js`:
   - add `let route = null, routeUntil = 0;` next to `let sites = [];`;
   - add a method `route(dirs, seconds, now) { route = (dirs ?? []).map((d) => d.slice()); routeUntil = now + seconds; },`;
   - in `paint`, change the early return to `if ((!tremor && !sites.length && !route) || !cpos || !up || mapMode === 'heart') return;`;
   - after the site marks, draw the route while `t < routeUntil`:

```js
      if (route && t < routeUntil) {
        ctx.save(); ctx.fillStyle = 'rgba(111, 230, 255, 0.85)';
        for (const d of route) { const q = radarProject(d, cpos, basis, range); if (Math.hypot(q.x, q.y) > 0.95) continue; ctx.beginPath(); ctx.arc(c0 + q.x * R0, c0 + q.y * R0, 1.6, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      } else if (route && t >= routeUntil) route = null;
```

   Here `t` is the clock `paint` already receives. Check that `route(…, now)` is called with the same clock as `paint`'s `t`: read how td-tab calls `story.hud.paint(ctx, { …, t, … })` and pass that value.

3. At line 5964, append on the same line, after `explode('tank.shell', graph.centers[ci]);`: `if (automated() && story?.hud.route) story.hud.route([...simTrunk()].map((c) => norm3(graph.centers[c])), 3, <the paint clock>);`. Adapt `[...simTrunk()]` if it already returns an array.

- [ ] **Step 10: Check the file and the tests.**

Run: `wc -l src/td-tab.js` → `13957`.

Run: `npm test && npm run check`
Expected: all pass (105 programs).

- [ ] **Step 11: Commit**

```bash
git add src/td-tab.js src/fx/story-hud.js src/isaobriefs.js src/domain/story-beats.js test/story-beats.mjs test/isaobriefs.mjs
git commit -F - <<'EOF'
Expeditions in play: guarded nests at the landing sites, parts carried home unlock towers, radar marks by state, Isao's lines

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```

---

### Task 7: The `--defense` suite, the gates and the record

**Files:**
- Modify: `scripts/browser-test.mjs` (a new `--defense` branch), `docs/STATE.md`
- Create: `docs/log/entries/2026-09-14-handover-gunship-call-expeditions-landed.json`

**Interfaces:**
- Consumes:
  - hooks `state().automated`, `state().gunshipCall`, `state().expeditions` and `state().unlocked` (Tasks 5 and 6)
  - hooks `fillGunshipCall`, `siteCells`, `placeTank`, `killGuards`, `hitTank`, `spawnFodder` and `mountGunship`
  - the story hook `storySockets` if added. Otherwise the test reads `state().story.socket`, the Rotor socket cell the beats state reports.

- [ ] **Step 1: Add the suite.** Insert immediately before the line `} else if(args.includes('--story-world')) {`:

```js
 } else if(args.includes('--defense')) {
 // THE HANDOVER (docs/superpowers/specs/2026-09-14-handover-gunship-call-expeditions-design.md): past the Quiver the towers fire
 // on their own and the wave clock runs; the gunship waits for an earned call; the tank clears a nest and brings a part home
 await go('defense-handover','index.html?sw=0&acceptance=1&cine=0&world=story&stage=6&phase=expedition#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);await delay(2500);
 {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.story.phase,'expedition','the jump lands past the handover');assert.equal(s.automated,true,'automated');
  assert.equal(await evaluate('document.querySelectorAll("#story-views [data-mount]:not([data-mount=gunship])").length'),0,'no tower mounts after the handover');
  assert(await evaluate('!!document.querySelector("#story-views [data-view=tank]")'),'the tank is offered');
  assert(/GUNSHIP · \d+%$/.test(await evaluate('document.querySelector("#story-views [data-mount=gunship]").textContent')),'the gunship button shows the call-in meter');
  assert(s.expeditions.sites.filter(x=>x.state==='guarded').length===3,'the first three sites are guarded');}
 await finish();
 // towers fire on their own: a Rotor on its story socket kills raised fodder with no pilot
 {const ci=await evaluate('window.__stalheartTest.state().story.socket');assert(await evaluate(`window.__stalheartTest.commitTower('rotor',${JSON.stringify(ci)})`),'a Rotor stands on the story socket');
  const before=await evaluate('window.__stalheartTest.state().killsBySrc.tower');await evaluate('window.__stalheartTest.spawnFodder(20)');
  await until(`window.__stalheartTest.state().killsBySrc.tower>${before}`,120000).catch(async()=>assert.fail(`no unpiloted tower kill (${JSON.stringify(await evaluate('window.__stalheartTest.state().killsBySrc'))})`));}
 current='defense-towers-fire';await finish();
 // the call-in: fill, call, take the seat
 await evaluate('window.__stalheartTest.fillGunshipCall(100000)');await delay(400);
 assert.equal(await evaluate('document.querySelector("#story-views [data-mount=gunship]").textContent'),'GUNSHIP · CALL','a full meter lights the call');
 await evaluate('document.querySelector("#story-views [data-mount=gunship]").click()');await delay(1200);
 await evaluate('document.querySelector("#gunship-briefing [data-skip]")?.click()');
 await until('window.__stalheartTest.state().gunship.station && window.__stalheartTest.state().gunship.seat',15000);
 assert.equal((await evaluate('window.__stalheartTest.state().gunshipCall')).overhead,true,'the pass is overhead');
 current='defense-gunship-called';await finish();
 await evaluate('document.querySelector("#story-views [data-view=tank]").click()');await delay(800);
 // an expedition: clear rocket-a's nest, reach the site, bring the part to the foundry
 {const cells=await evaluate('window.__stalheartTest.siteCells()');
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-a").state==="guarded"',5000);
  await delay(4000);await evaluate('window.__stalheartTest.killGuards("rocket-a")');
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-a").state==="cleared"',10000);
  await evaluate(`window.__stalheartTest.placeTank(${cells['rocket-a'].cell})`);
  await until('window.__stalheartTest.state().expeditions.carrying==="rocket-a"',10000);
  current='defense-part-carried';await finish();
  await evaluate('window.__stalheartTest.placeTank(window.__stalheartTest.state().storyHome)');
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-a").state==="delivered"',10000);
  const unlocked=await evaluate('window.__stalheartTest.state().unlocked');assert(unlocked.includes('relay'),`the Relay unlocks (${unlocked})`);
  // a hull lost while carrying drops the part back at its site
  await delay(4000);await evaluate('window.__stalheartTest.killGuards("rocket-b")');
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-b").state==="cleared"',10000);
  await evaluate(`window.__stalheartTest.placeTank(${cells['rocket-b'].cell})`);
  await until('window.__stalheartTest.state().expeditions.carrying==="rocket-b"',10000);
  await evaluate('window.__stalheartTest.hitTank()');await delay(600);
  assert.equal(await evaluate('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-b").state'),'cleared','the part is back at its site');}
 current='defense-part-dropped';await finish();
```

The suite reads these fields, which must exist before it runs:
- `state().story.socket`: the beats state already returns `socket`.
- `state().storyHome`: add `storyHome: story?.home ?? -1,` inside Task 6's `state()` literal, on the same existing line.
- `commitTower` on the hook object: if no such hook exists, add `commitTower: (key, ci) => !!commitTower(key, ci, 0),` to an existing hook line.

- [ ] **Step 2: Run the gates, one browser at a time**

Run: `npm test && npm run check && npm run build`

Then, checking memory before each:
- `node scripts/browser-test.mjs --defense`
- `node scripts/browser-test.mjs --story-world` (rerun once on a known flaky step)
- `node scripts/browser-test.mjs --gunship`
- `node scripts/browser-test.mjs --nav`
- `node scripts/browser-test.mjs`
- `node scripts/browser-test.mjs --dist`

Expected: every suite ends `Browser acceptance passed`.

If a `--defense` assertion fails, check for a flaw in the plan's own test first:
- a hook name that does not exist
- a timing the game needs longer for
- the nest's guards not yet spawned when `killGuards` runs

Fix the smallest thing that keeps the assertion about the stated behaviour, and list it in the report. Do not delete an assertion.

- [ ] **Step 3: Record it.** In `docs/STATE.md`, add a priority item after item 1:

```markdown
2. **The handover landed** (`2026-09-14-handover-gunship-call-expeditions-landed`): past the Quiver's hard cores the towers fire on their own and the wave clock runs; piloting is the tank and an earned gunship call-in; guarded expeditions to the landing sites bring home parts that unlock Relay, Mortar and Lancer (then Plasma, Needle, Heptapod). Next: sub-project 2, tower geometry (targeting, line of sight, range along the lane).
```

Renumber the items that follow.

Write `/private/tmp/handover-landed.json` (outside `docs/log/entries/`, because `npm run log -- add` refuses a file already there):

```json
{
  "schema": 1,
  "id": "2026-09-14-handover-gunship-call-expeditions-landed",
  "date": "2026-09-14T20:00:00+00:00",
  "type": "change",
  "status": "accepted",
  "title": "The post-tutorial handover: automatic towers, an earned gunship call-in, expeditions that unlock towers",
  "context": "Sub-project 1 of the puzzle tower defence (docs/superpowers/specs/2026-09-14-handover-gunship-call-expeditions-design.md). The story had no automated phase: towers stayed silent unless piloted, the story had no wave clock, a piloted Rotor hit 60 times harder, and towers unlocked on the wave ladder.",
  "outcome": "Past the Quiver's hard cores (phase settled, or the Defend stage) every tower fires on its own at normal strength and the wave clock runs from a far breach; pilot multipliers apply only before the handover; tower mounts leave the views strip. The gunship waits in reserve: a meter fills from kill biomass (streak included) and cleared waves, a full meter calls a 120 s pass, and it restarts empty. Guarded nests stand at the landing sites; the tank clears one, carries its part to the foundry and Isao can print that tower (rocket-a Relay, rocket-b Mortar, wreck Lancer; later sites Plasma, Needle, Heptapod); a lost hull drops the part back at its site. A DEFENSE jump lands past the handover. New pure modules: automation, gunship-call, expeditions.",
  "alternatives": [
    "Per-tower automation after each tower's own tutorial beat.",
    "A separate defence phase with its own entry, splitting story and defence into two worlds again.",
    "The gunship on a fixed timetable, or bought with biomass."
  ],
  "evidence": [
    "npm test, npm run check, npm run build; browser --defense, --story-world, --gunship, --nav, default and --dist passed."
  ],
  "supersedes": []
}
```

Run: `npm run log -- add /private/tmp/handover-landed.json && npm run log -- render && npm run check`
Expected: the entry validates; DEVLOG and ROADMAP regenerate; the check passes.

- [ ] **Step 4: Commit**

```bash
git add scripts/browser-test.mjs src/td-tab.js docs/STATE.md docs/log/entries/2026-09-14-handover-gunship-call-expeditions-landed.json DEVLOG.md ROADMAP.md
git commit -F - <<'EOF'
The --defense suite for the handover, the gunship call-in and an expedition; STATE and the log record it

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX
EOF
```
