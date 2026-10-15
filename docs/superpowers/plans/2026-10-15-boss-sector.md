# THE BOSS sector — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the Cutis-Maku boss fight as a campaign sector at `doorAt + 1`: Isao drives the tank as the lure, the player takes the gunship by manual override after a two-button choice, the wave of twenty then the boss hunt the tank, every hit scaled by the body's phase, SECURE on the boss's death.

**Architecture:** one content row (`BOSS_SECTOR`), one pure module (`src/domain/boss-sector.js`: the two queue plans, the phase multiplier), one run module (`src/fx/boss-run.js`: the choice, the hull on autopilot with Isao docked, the seat, the bar row, the restore) wired through `storyApi` like `src/fx/canyon-run.js`, a small `src/fx/choice-card.js`, a `phase(handle)` read on the Cutis family, and `damageEnemy` scaled by the family's phase. The sector loop slots the row (`sectorDef`) and calls `bossBegin`/`bossEnd`.

**Tech Stack:** the game's own modules (no new renderer); node tests under `test/`; the browser harness `scripts/browser-test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-15-boss-sector-design.md`.

## Global Constraints

- `src/td-tab.js` ceiling 6,400 lines and a long-line budget of 0 over 500 characters (`npm run check`): wire, do not write blocks there.
- Domain modules import nothing from `src/content/`; tunables live in content.
- Every edit: `node --check <file>`; never edit `src/` while a browser suite serves the tree; one headless Chrome at a time.
- Commit after each task; record the decision with `/deban` at the end (one entry), STATE.md's top section.
- Isao's lines are the owner's recordings: ship captions, list the triggers in `~/Dev/seiyu_voice/ISAO-VOICE-LINES.md` section 16, do not synthesise voice.

---

### Task 1: the row and the slot (content + domain, node tests)

**Files:**
- Modify: `src/content/sectors.js` (after `BOTH_WALLS_SECTOR`)
- Modify: `src/domain/sectors.js` (`sectorDef`)
- Modify: `src/fx/sector-run.js` (`finalSector`, `briefOf`)
- Modify: `test/sectors.mjs`

**Interfaces:**
- Produces: `BOSS_SECTOR` (frozen row): `{ name: 'THE BOSS', shape: 'pulse', bodies: [20, 1], breath: { at: 0.15, max: 90 }, coreShare: 0, breaches: { gate: 1 }, waves: 2, ladderStart: 6, threat: 2.4, pulse: 8, held: { kg: 90, points: 900 }, boss: { wave: { count: 20, tier: 'small', hp: 20 }, boss: { tier: 'huge', hp: 180 }, choice: { line, a, b, replyA, replyB } }, gunshipCall: true, backDoor: false, laser: true, hardcoresEveryWave: false, new: 'a boss', brief: [...] }`
- `sectorDef(n, table, generator, arc)` takes `arc.boss` and slots it at `doorAt + 1`, `arc.both` at `doorAt + 2`.

- [ ] **Step 1: the failing test** — in `test/sectors.mjs` add, next to the door/both assertions:

```js
import { BOSS_SECTOR } from '../src/content/sectors.js';
{
  const arc = { door: BACK_DOOR_SECTOR, both: BOTH_WALLS_SECTOR, hold: SECTOR_HOLD, canyonAgain: SECTOR_CANYON_AGAIN, boss: BOSS_SECTOR, doorAt: 7 };
  assert.equal(sectorDef(7, SECTORS, SECTOR_GENERATOR, arc).name, BACK_DOOR_SECTOR.name);
  assert.equal(sectorDef(8, SECTORS, SECTOR_GENERATOR, arc).name, 'THE BOSS', 'the boss the sector after the door');
  assert.equal(sectorDef(9, SECTORS, SECTOR_GENERATOR, arc).name, BOTH_WALLS_SECTOR.name, 'both walls after the boss');
  assert.equal(sectorDef(6, SECTORS, SECTOR_GENERATOR, arc).name, SECTOR_CANYON_AGAIN.name, 'the canyon again stays before the door');
  const b = sectorDef(8, SECTORS, SECTOR_GENERATOR, arc);
  assert.equal(b.waves, 2); assert.deepEqual(b.bodies, [20, 1]); assert.ok(b.boss?.boss?.hp === 180 && b.boss.wave.count === 20);
}
```
- [ ] **Step 2: run** `node test/sectors.mjs` → FAIL (BOSS_SECTOR undefined).
- [ ] **Step 3: the row** in `src/content/sectors.js`, a comment with the owner's words, then:

```js
export const BOSS_SECTOR = freeze({ name: 'THE BOSS', shape: 'pulse', bodies: [20, 1], breath: { at: 0.15, max: 90 }, coreShare: 0, breaches: { gate: 1 }, waves: 2, ladderStart: 6, threat: 2.4, pulse: 8, held: { kg: 90, points: 900 },
  boss: { wave: { count: 20, tier: 'small', hp: 20, pace: 1 }, boss: { tier: 'huge', hp: 180, pace: 1 }, family: 'cutis',
    choice: { line: 'New contact. Big. Two ways: I drive the tank and keep it busy, or I put the gunship on autopilot and you drive.', a: 'YOU DRIVE THE TANK', b: 'GUNSHIP ON AUTOPILOT',
      replyA: 'Then it\'s me in the hull. The gunship is yours: new target, manual override.', replyB: 'The autopilot has never seen this one. Manual override, you. I\'ll drive.' } },
  gunshipCall: true, backDoor: false, laser: true, hardcoresEveryWave: false, new: 'a boss',
  brief: ['Something big is coming up the lane. Not a wave.', 'I take the hull. You take the gunship. Keep it off me.'] });
```
- [ ] **Step 4: the slot** in `src/domain/sectors.js sectorDef`: before the `n === doorAt + 1` line add `if (arc && doorAt !== null && arc.boss && n === doorAt + 1) return shaped({ ...arc.boss, n, waveBase: arc.boss.ladderStart ?? 0, ladderCap });` and change the both line to `n === doorAt + (arc.boss ? 2 : 1)`. (`shaped` sizes a pulse row's waves from `bodies`.)
- [ ] **Step 5:** `src/fx/sector-run.js`: `finalSector = () => doorAt !== null && def?.n === doorAt + (BOSS_SECTOR ? 2 : 1)` (import the row; pass `boss: BOSS_SECTOR` in the `arc` object it builds for `sectorDef`); `briefOf`: `n === doorAt + 1 ? 'sector_boss'`, `n === doorAt + 2 ? 'sector_both'`. Add `sector_boss` to `src/isaobriefs.js` (two lines, the row's brief).
- [ ] **Step 6:** `node test/sectors.mjs && node test/sector-run.mjs && node test/back-omens.mjs` → PASS (fix any test that assumed both at `doorAt + 1`: `--canyon-again`'s `doorAt` assertion is unchanged).
- [ ] **Step 7: commit** `git commit -am "THE BOSS sector: the row and its slot at doorAt + 1, BOTH WALLS at doorAt + 2"`.

### Task 2: the plans and the phase rule (domain, node test)

**Files:**
- Create: `src/domain/boss-sector.js`, `test/boss-sector.mjs`

**Interfaces:**
- `bossWaves(row, { tierSpec }) -> [waveEntries, bossEntries]` where each entry is `{ type: row.boss.family, tier, spec, count, hunter: true, hp }`; `tierSpec(family, tier)` is `src/fx/creature-enemies.js tierSpec` (passed in: the domain imports no fx).
- `phaseScale(phase, hits) -> number`: `'COIL'|'EXTEND'|'ANCHOR' -> hits.reach`, `'REST'|'SETTLE' -> hits.rest`, `'TRANSFER' -> hits.transfer`, unknown → 1.
- `bossAlive(enemies) -> { wave, boss }` counts of live hunters by tier.

- [ ] **Step 1: the test**

```js
import assert from 'node:assert/strict';
import { bossWaves, phaseScale, bossAlive } from '../src/domain/boss-sector.js';
import { BOSS_SECTOR } from '../src/content/sectors.js';
import { CUTIS_HITS } from '../src/content/cutis-maku.js';
const tierSpec = (f, t) => ({ body: f, tier: t, hp: 1, rammable: false });
const [wave, boss] = bossWaves(BOSS_SECTOR, { tierSpec });
assert.equal(wave.reduce((n, e) => n + e.count, 0), 20); assert.ok(wave.every((e) => e.hunter && e.tier === 'small' && e.spec.hp === 20));
assert.deepEqual(boss.map((e) => [e.tier, e.count, e.spec.hp, e.hunter]), [['huge', 1, 180, true]]);
assert.equal(phaseScale('EXTEND', CUTIS_HITS), 1); assert.equal(phaseScale('REST', CUTIS_HITS), 0.5); assert.equal(phaseScale('TRANSFER', CUTIS_HITS), 0); assert.equal(phaseScale(undefined, CUTIS_HITS), 1);
assert.deepEqual(bossAlive([{ alive: true, hunter: true, tier: 'small' }, { alive: true, hunter: true, tier: 'huge' }, { alive: false, hunter: true, tier: 'huge' }]), { wave: 1, boss: 1 });
console.log('Boss sector: the wave and the boss as hunter plans, the phase scale, the count alive.');
```
- [ ] **Step 2:** run → FAIL (module missing). **Step 3:** write the module (a header with the owner's words; `bossWaves` returns `[[{ type, tier, spec: { ...tierSpec(f, t), hp }, count, hunter: true, pace }], [...]]`; `phaseScale` a switch; `bossAlive` a reduce). **Step 4:** PASS. **Step 5:** commit.

### Task 3: the family's phase and the scaled hit (fx, node test where pure)

**Files:**
- Modify: `src/fx/creature-cutis.js` (`phase(handle) -> string`, from the kit's swarm: the lab's `cutis-scenario.js` reads the stage the same way — copy that read), `src/fx/creature-bodies.js` (`phaseOf(e)`: the adapter's `phase?.(handle)` or null), `src/fx/creature-enemies.js` (`damageScale(e)`: `phaseScale(bodies.phaseOf(e), CUTIS_HITS)` for a `cutis` record, 1 otherwise; the "absorbed" flash on a 0 scale: `cutisFlash` from `src/labs/boss/cutis-flash.js` moved to `src/fx/cutis-maku/flash.js` if the lab import would cross the labs boundary — check `npm run check` after)
- Modify: `src/td-tab.js` `damageEnemy`: `dmg *= creatureEnemies.damageScale?.(e) ?? 1` on the one line before the hit is applied.

- [ ] **Step 1:** read `src/labs/boss/cutis-scenario.js` for the stage read (`sw.stage(i)` or the `life`/phase arrays) and `damageEnemy` in `src/td-tab.js` (grep `function damageEnemy`).
- [ ] **Step 2:** write `phase(h)` in creature-cutis (the first live slot's stage name), `phaseOf(e)` in creature-bodies, `damageScale(e)` in creature-enemies (export on the API next to `hit`).
- [ ] **Step 3:** the one-line hook in `damageEnemy`; `node --check` all three; `npm run check`.
- [ ] **Step 4:** a node test is not possible for the kit's stage without a body; the browser step (Task 7) asserts the scale. Commit.

### Task 4: the choice card (fx)

**Files:**
- Create: `src/fx/choice-card.js`; styles in `styles.css` (`.choice-card`, the debrief panel's look: `#sector-debrief .panel` rules as the model)

**Interface:** `createChoiceCard(root) -> { show({ line, a, b }) -> Promise<'a'|'b'>, isOpen(), dispose() }`; the card is `aria-live`, keyboard 1/2 pick, Escape does nothing (a choice must be made).

- [ ] **Step 1:** write the module (a div with the line, two buttons, resolve on click, remove on resolve). **Step 2:** `test/choice-card.mjs` with the DOM fake pattern of `test/hull-speed.mjs` (createElement/appendChild fakes): show resolves 'a' on the first button's click handler. **Step 3:** PASS, commit.

### Task 5: the run (fx) and the wiring (controller, sector loop)

**Files:**
- Create: `src/fx/boss-run.js`
- Modify: `src/fx/sector-run.js` (`begin`: `if (def.boss) api.bossBegin?.(def)`; the wave hook: for a boss row, `sendWave` uses `bossWaves(def, { tierSpec })[next]` instead of `waveOf` (the entries already carry `spec`/`tier`/`hunter`; `queueOf` keeps them: check it spreads `hunter`, `tier`, `spec` — it builds `{ type, sp, at, spread, pace, ... }`, so add `...(hunter ? { hunter, tier, spec } : {})`); at `finish`: `if (def.boss) api.bossEnd?.(outcome)`)
- Modify: `src/td-tab.js`: `const bossRun = createBossRun({ ... })` next to `canyonRun`, `storyApi.bossBegin = bossRun.begin`, `storyApi.bossEnd = bossRun.end`; the harness `boss: bossRun.state()` in `state()`.
- Modify: `src/fx/creature-enemies.js withHunters`: skip when `wave.boss` (the row sends its own hunters).

**`createBossRun(c)` host (values and getters, as canyon-run's):** `pause(v)`, `choiceCard`, `showBrief`, `say(trigger, caption)` (Isao's voice or a caption: `isaoSpeak` with the trigger and a `caption` fallback), `setAutoMode`, `params`, `player`, `isao()` (the drone), `isaoWorker` (to hold his orders: `isaoWorker.hold(true)` if it exists, else skip his order loop while `bossRun.on()`), `story()`, `installPilot`, `leavePilot`, `pilotMode()`, `gunshipRig`, `integrityHud` (for the row: `integrityHud.extra({ id: 'boss', name: 'CUTIS-MAKU', hp, max })` — add `extra(rows)` to integrity-hud: rows merged into `read.gates` by the controller's tick is simpler: the controller passes `gates: [...sectorRun.gates(), ...bossRun.rows()]`), `enemies`, `t()`.

**`begin(def)`:** `on = true; was = { auto: autoMode(), directive: params.directive, gsAuto: story.gsAuto }`; `pause(true)`; `choiceCard.show(def.boss.choice)` → `say('boss_tank'|'boss_auto', reply)`; `pause(false)`; `setAutoMode(true); params.directive = 'avoid'; story.gsAuto = false; docked = true`; take the seat when the gunship is on station: a `tick(dt)` the controller calls each frame: `if (on && !seatTaken && gunshipRig.onStation?.()) { installPilot('gunship'); seatTaken = true; }`, and Isao's dock: `if (docked && isao()) isao().obj.position.copy(hullPosition lifted by ISAO_ALT)`; `boss_rises` when the huge record first appears; `boss_hit_me` on the hull's first touch by the boss (`player` HP drop while on).

**`end(outcome)`:** restore `was`, `docked = false`, `leavePilot()` if the seat is the gunship's, `on = false`; `say('boss_dead')` on secure.

**`rows()`:** `[{ id: 'boss', name: huge alive ? 'CUTIS-MAKU' : 'WAVE · CUTIS', hp, max, broken: false }]` while on (hp from the boss record, or the wave's alive count over 20).

- [ ] **Step 1:** write `boss-run.js` with the host literal documented in its header (the refactor's host-contract convention: `test/host-contracts.mjs` will want its spec if the module is listed there — add it as `createBossRun` is wired).
- [ ] **Step 2:** wire in `src/td-tab.js` (five short lines: the create, two storyApi entries, the per-frame `bossRun.tick(dt)` next to `canyonRun`'s uses, the rows into the integrity tick).
- [ ] **Step 3:** `sector-run.js`: the three hooks; `node test/sector-run.mjs` with a new block: a boss row's `sendWave` returns the wave's 20 hunter entries then the boss's one, SECURE after both dead.
- [ ] **Step 4:** `npm test`, `npm run check` (the line budget), `npm run build`; commit.

### Task 6: the voice list and the captions

**Files:**
- Modify: `~/Dev/seiyu_voice/ISAO-VOICE-LINES.md` — `## 16. The boss (the sector)` with triggers `boss_choice`, `boss_tank`, `boss_auto`, `boss_rises`, `boss_hit_me`, `boss_dead` and the texts from the spec; commit there (not pushed: the owner's repo).
- `src/content/isao-voice.js`: nothing until the owner records (`node scripts/import-isao-voice.mjs` then); the run's `say` shows the caption when the trigger has no line.

- [ ] **Step 1:** append the section; `isao render --stale --todo` if the CLI is set up (optional). Commit in seiyu_voice.

### Task 7: the browser step and the records

**Files:**
- Modify: `scripts/browser-test.mjs` — `--boss-sector`: open `index.html?sw=0&acceptance=1&cine=0&world=story&skip=defence&sector=${SECTOR_DOOR.earliest + 1}#td` (a late start at the door's earliest decides `doorAt = earliest`; the sector after is THE BOSS: assert `state().sector.name === 'THE BOSS'`), click the choice (`document.querySelector('.choice-card button[data-pick=a]').click()`), assert `state().autoMode && state().params.directive === 'avoid'` (expose if missing), wait for `creatureProbe.hunters.alive >= 10` and the huge tier up (`creatureProbe.bodies.families.cutis.huge.live === 1` after the wave is culled with `sectorCull(999)` once), take a scripted 40 mm burst at the boss through the seat (`gunship` test hooks as `--gunship-auto` uses), assert the boss row in `integrity.gates` reads `CUTIS-MAKU` and its hp dropped, kill it (`damage(e, 999)` through the harness), assert `sector.phase === 'secure'`, `state().autoMode === false` after `sectorContinue`.
- Records: `/deban` entry `2026-10-15-boss-sector-first-version`, STATE.md's top, the owner's Telegram.

- [ ] **Step 1:** the step; run it green twice. **Step 2:** `--sectors`, `--backdoor`, `--canyon-again`, `--pearl-story`, `--gunship-auto`, `--seats` still green. **Step 3:** records, commit, push, Telegram.

## Self-review notes

- Spec coverage: placement (T1), lure (T5), seat and choice (T4, T5), the fight and the phase (T2, T3), the bar (T5), lines (T6), tests (T7).
- Risk: the gunship may not be overhead at the sector's start (`gunshipCall`): the run waits for the station and the player drives nothing meanwhile — the hull is on auto from the choice, so the wait is watched, not idle. If the owner wants the gunship there at once, `gunshipRig.call` filled at `begin` is one line.
- Risk: `queueOf` spreads only known keys; Task 5 Step 3 adds the hunter keys explicitly.
