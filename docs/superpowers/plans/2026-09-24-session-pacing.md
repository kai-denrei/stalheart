# Session pacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `docs/superpowers/specs/2026-09-24-session-pacing-design.md`: sector waves on a clock, the back door foreshadowed / feast / scramble, and sector 0 (the Stålheart's construction defended, the first MÖRK rolling out of it).

**Architecture:** The rules and numbers go in pure modules (`src/content/sectors.js`, `src/content/story-defaults.js`, `src/content/base-programme.js`, `src/domain/*.js`); composition goes in fx modules (`src/fx/sector-run.js`, a new `src/fx/back-omen.js`, a new `src/fx/hull-issue.js`); `src/td-tab.js` only gets in-place edits inside existing lines (it is AT its 13,505-line budget: net zero lines, verified by `npm run architecture`).

**Tech Stack:** native ESM, Three.js r160 (vendored), node assert tests (`test/*.mjs`, run by `npm test`), the CDP browser harness (`scripts/browser-test.mjs`, always through `scripts/browser-lock.sh`).

## Global Constraints

- `src/td-tab.js` line count must not grow (budget 13505 in `docs/architecture-budget.json`; budgets only go down).
- `src/domain/` may not import `src/content/`; tunables are passed in. The bare word `window` is flagged in domain/content comments.
- Inside td-tab's long one-line handlers use `/* */` comments, never `//`.
- Never `git add -A` at the repo root; add explicit paths. Never chain an edit and a commit with `;`.
- Browser suites only through `scripts/browser-lock.sh node scripts/browser-test.mjs <flag>`; never more than two at once; check `~/scripts/check-memory.sh` first.
- No push without the owner's OK. Commit author must be Kai Denrei (`git config user.email` = 270854086+kai-denrei@users.noreply.github.com).
- Decisions are recorded as JSON entries in `docs/log/entries/` (`npm run log -- add FILE`, then `npm run log -- render`).
- Retime a browser step that measured the old pacing; never weaken what it asserts.

---

### Task 1: The sector clock (spec A)

**Files:**
- Modify: `src/content/sectors.js` (SECTORS table, SECTOR_GENERATOR, SECTOR_PLACEMENT, SECTOR_TIMING)
- Modify: `src/fx/sector-run.js` (begin/place/tick/canRelease/release/entriesOf, new `pulseGap`, `pulseOver`)
- Modify: `src/td-tab.js:9524` (the clear test) and `:9545` (the gap) in place; `:9565` (the breach establishing shot) in place; `storyApi.breach` in place
- Modify: `test/sectors.mjs` (the table assertions)
- Create: `test/sector-run.mjs`

**Interfaces:**
- Produces: `SECTOR_TIMING.{pace, aliveCap}`, per-sector `pulse` (seconds), `SECTOR_PLACEMENT.ringHops`, per-sector optional `open: { [side]: seconds }` (delay of that side's first opening); sector-run returns `pulseGap(): number|null` (null when no sector is fighting) and `pulseOver(queue): boolean`; `h.open(cell, { quiet })`.

- [ ] **Step 1: Content.** In `src/content/sectors.js` set the table (comments updated to say why: owner 2026-09-24 "too slow between enemies, not hectic enough"):

```js
{ n: 1, name: 'THE LANE', breaches: { gate: 2 }, waves: 6, ladderStart: 0, threat: 2.5, pulse: 16, ... }
{ n: 2, name: 'THE BACK DOOR', breaches: { back: 1, gate: 1 }, waves: 6, ladderStart: 1, threat: 2.2, pulse: 14, open: { gate: 25 }, feast: { entries: [{ type: 'amoeba', count: 40 }, { type: 'phage', count: 20 }], pace: 1.7 }, ... }
{ n: 3, name: 'BOTH WALLS', breaches: { gate: 1, back: 1 }, waves: 8, ladderStart: 6, threat: 2.2, pulse: 12, ... }
SECTOR_GENERATOR: pulse: 12 (carried by sectorDef's spread of the last row; the generator's own `pulse` wins when present)
SECTOR_PLACEMENT.ringHops = 45
SECTOR_TIMING = { briefSeconds: 6, staggerSeconds: 1.5, backDoorLead: 8, securePause: 3, lostHold: 2.5, pace: 1.5, aliveCap: 260 }
```

- [ ] **Step 2: Failing test.** `test/sector-run.mjs` drives `createSectorRun` with fake hooks (no DOM: `host` undefined, `h.field()` returns a small synthetic field whose `dist` puts candidate cells at 40-50 hops). Assert:
  1. `begin` places the breaches at once (state().breaches non-empty on the first tick after `ready()`), with the card still up;
  2. `canRelease()` is true once the first breach has opened even while it is not `spReady` and while a later breach is still pending;
  3. `release(t)` entries carry `pace === SECTOR_TIMING.pace`;
  4. with `h.enemies()` returning `aliveCap` live bodies, `canRelease()` is false;
  5. `pulseGap()` is `def.pulse` while fighting and `null` while idle;
  6. `pulseOver([{ guard: true }])` is true, `pulseOver([{ sp: {} }])` is false;
  7. for sector 2 (`firstSector: 2`), the back breach opens first and the gate breach not before `open.gate` seconds; the back breach's first release is the feast (60 bodies, pace 1.7), its second is the ladder.

Run: `node test/sector-run.mjs` — expect failures on each new behaviour.

- [ ] **Step 3: Implement in `src/fx/sector-run.js`.**
  - `begin(n)`: after the card and brief, call `place()` directly (no `brief` phase wait); keep `cardLeft = SECTOR_TIMING.briefSeconds` and hide the card when it runs out in `tick`. When the back door opens in this sector, `place()` waits `backDoorLead` only for the back side through the per-side open delay (the collapse shot freezes the world, so the lead is world time).
  - `place()`: gate ring `Math.min(SECTOR_PLACEMENT.ringHops ?? f.farHops, f.farHops, far)`; each breach gets `openAt = now() + (def.open?.[side] ?? 0) + k * staggerSeconds` (k counts breaches of the same side opened so far); `pending` is replaced by those `openAt` stamps; a breach whose `openAt` is later than the first opening is opened with `h.open(cell, { quiet: true })` (no establishing dive while the player is fighting).
  - `canRelease()`: `!quiet && phase === 'fighting' && aliveSectorEnemies() < SECTOR_TIMING.aliveCap && sector.breaches.some((b) => b.state === 'open' && sps.get(b.id)?.alive && b.wavesReleased < b.wavesPlanned)`.
  - `release(t)`: skip breaches not opened yet; for `b.side === 'back' && b.wavesReleased === 0 && def.feast` release the wave (keeps the books) but queue `feastEntries(def.feast, sp)`.
  - `entriesOf`: every entry gets `pace: SECTOR_TIMING.pace`.
  - Return `pulseGap: () => (phase === 'fighting' && def ? def.pulse ?? SECTOR_TIMING.pulse ?? null : null)` and `pulseOver: (q) => !q.some((e) => !e.guard)`.
  - Secure: `!sector.breaches.some(unopened) && isSecure(...)`.

- [ ] **Step 4: td-tab in place (net zero lines).**
  - `:9524` `if (!spawnQueue.length && enemies.every(...))` → `if (sectorRun?.pulseGap?.() != null ? sectorRun.pulseOver(spawnQueue) : (!spawnQueue.length && enemies.every((e) => !(e.alive && !e.guard))))`.
  - `:9545` `const gap = params.waveGap * (wave < 2 ? 1.6 : 1);` → `const gap = sectorRun?.pulseGap?.() ?? params.waveGap * (wave < 2 ? 1.6 : 1);`.
  - `storyApi.breach: (ci) => {...}` → `(ci, o) => { ... obj.userData.quiet = !!o?.quiet; ... }` and the establishing shot condition at `:9565` gains `&&!opened.every(o=>o.userData.quiet)`.
  - The sector hook `open: (ci) => storyApi.breach(ci)` → `open: (ci, o) => storyApi.breach(ci, o)`.

- [ ] **Step 5: Tests green.** Update `test/sectors.mjs`'s table assertion to the new rows. Run `npm test`, `npm run check` (architecture guard: td-tab still 13505). Expected: all pass.

- [ ] **Step 6: Browser.** `scripts/browser-lock.sh node scripts/browser-test.mjs --sectors`, then `--backdoor`, `--skip-tutorial`. Retime steps that assumed clear-gated waves (a step waiting for "no enemy alive before the next wave" now waits on the release it asserts).

- [ ] **Step 7: Commit** the explicit paths.

### Task 2: The pacing probe (spec E)

**Files:**
- Modify: `scripts/browser-test.mjs` (new `--pacing` branch next to `--grow`)

- [ ] **Step 1:** Add `--pacing`: open `index.html?sw=0&acceptance=1&cine=0&world=story&intro=0#td` (a bare page at full threat), let the story play with the harness as a passive player (towers automatic after the handover; the tank parked; every briefing and debrief dismissed through the existing hooks the `--sectors` step uses), and sample `window.__stalheartTest.state()` every 1 s until sector 2's back breach has released its second wave or 12 minutes pass.
- [ ] **Step 2:** Print `PACE <t> <event>` lines for: landed, Rotor, gate, Stålheart print begins/ends, breach, override, Quiver, construction, hull out, settled, expedition, each sector's card, each breach opened, each pulse (per breach wavesReleased change), each omen, the feast, the scramble line, secure, debrief. Print `ALIVE <t> <n>` every 5 s and a summary: per sector, seconds from card to first body within 8 cells of a gate (`firstContact`), and `deadPerMin` (seconds with no live sector body within 8 cells of any standing gate or the back mouth, per minute after firstContact). Write the same as JSON to `artifacts/pacing.json`.
- [ ] **Step 3:** Assert only what the spec fixes as targets: hull out by 150 s; firstContact ≤ 40 s for sectors 1 and 2; deadPerMin ≤ 10 after firstContact. Run it; record the numbers in the log entry.
- [ ] **Step 4: Commit.**

### Task 3: The back door (spec B)

**Files:**
- Create: `src/domain/back-omens.js`, `test/back-omens.mjs`
- Create: `src/fx/back-omen.js`
- Modify: `src/content/sectors.js` (`BACK_OMENS`), `src/isaobriefs.js` (lines `back_rumble`, `back_crack`, `back_feast`, `back_scramble`; `back_door` text), `src/fx/sector-run.js` (omens on release; the scramble), `src/td-tab.js` storyApi line `:9884` in place (`backOmen`, `backScramble`, the socket facing at collapse)

**Interfaces:**
- Produces: `omenDue(omens, { sector, pulse, last }, fired: Set) -> omen|null` (pure); `BACK_OMENS = [{ id: 'rumble', sector: 1, pulse: 2, brief: 'back_rumble', dust: 6 }, { id: 'crack', sector: 1, pulse: 'last', brief: 'back_crack', dust: 14 }]`; `api.backOmen(omen)`, `api.backScramble()`.

- [ ] **Step 1: Failing test** `test/back-omens.mjs`:

```js
import assert from 'node:assert/strict';
import { omenDue } from '../src/domain/back-omens.js';
import { BACK_OMENS, SECTORS } from '../src/content/sectors.js';
const fired = new Set();
assert.equal(omenDue(BACK_OMENS, { sector: 1, pulse: 1, last: false }, fired), null);
assert.equal(omenDue(BACK_OMENS, { sector: 1, pulse: 2, last: false }, fired).id, 'rumble');
fired.add('rumble');
assert.equal(omenDue(BACK_OMENS, { sector: 1, pulse: 3, last: false }, fired), null);
assert.equal(omenDue(BACK_OMENS, { sector: 1, pulse: SECTORS[0].waves, last: true }, fired).id, 'crack');
assert.equal(omenDue(BACK_OMENS, { sector: 2, pulse: 2, last: false }, new Set()), null, 'omens belong to the sector before the door');
```

- [ ] **Step 2: Implement** `src/domain/back-omens.js`:

```js
// THE BACK DOOR IS FORESHADOWED (owner, 2026-09-24: "slightly foreshadowed"). Which omen is due at a pulse: the first not yet
// fired whose sector matches and whose pulse is this one ('last' is the sector's final pulse). Pure: omens come in from content.
export function omenDue(omens, { sector, pulse, last }, fired) {
  return omens.find((o) => !fired.has(o.id) && o.sector === sector && (o.pulse === 'last' ? last : o.pulse === pulse)) ?? null;
}
```

- [ ] **Step 3:** `src/fx/back-omen.js` `createBackOmen({ mouth, hud, sfx, dust, brief, camDist })` → `play(omen)`: `hud.tremor(mouth.dir)` then clears it after 4 s; `sfx.play('sinkhole_quake', { dist: camDist(mouth.dir) * 2 })` (quieter); `dust(ci, n)` for each mouth cell (td-tab passes a cheap small explosion puff); `brief(omen.brief)`.
- [ ] **Step 4:** sector-run `release(t)`: after releasing, `const o = omenDue(BACK_OMENS, { sector: def.n, pulse: top, last }, omens)` → `api.backOmen?.(o); omens.add(o.id)`. The scramble: in `tick`, once in a sector with `feast`, when the feast's bodies alive fall under a third of the feast or the gate breach opens, call `api.backScramble?.()` once. `begin(n)` for the back-door sector briefs `back_feast` instead of stacking `back_door` behind `old_breach` (the one-deep queue drops the second).
- [ ] **Step 5:** td-tab storyApi line `:9884` (in place): `openBackDoor` also sets `story.socketToward[sk.cell] = sk.toward` for every `story.backSockets` entry and briefs `back_feast`; `backOmen: (o) => (story.omen ??= createBackOmen({...})).play(o)`; `backScramble: () => { showBrief('back_scramble'); showCallout('BUILD BEHIND THE BAYS', 'co-victory-sub'); pulse warnRing on every back socket cell for 6 s }`.
- [ ] **Step 6:** Isao's lines in `src/isaobriefs.js` (same shape as `back_door`): `back_rumble` "Did you feel that? Behind the bays." / "That rock is not as solid as I thought."; `back_crack` "It is cracking back there." / "Whatever is out there wants in."; `back_feast` "The back wall is down and they are pouring in." / "Soft ones. Go through them!"; `back_scramble` "More are coming through the back and I cannot hold both sides." / "Put turrets behind the bays, now."
- [ ] **Step 7:** `npm test`, `npm run check`, `--backdoor`, `--sectors`, `--skip-tutorial`. Commit.

### Task 4: Sector 0, the construction defended (spec C)

**Files:**
- Modify: `src/domain/story-beats.js` (a `construction` phase between `quiver-piloting` and `settled`; the Quiver ordered after the gate)
- Modify: `src/domain/automation.js` (`STORY_PHASES` gains `construction` before `settled`)
- Modify: `src/content/story-defaults.js` (`STORY_CONSTRUCTION`)
- Modify: `src/content/base-programme.js` (the Stålheart step right after the gate, `when: { phase: 'rotor-ready' }`, seconds ~75; landing after it)
- Create: `src/fx/hull-issue.js` (the hull is not issued until the Stålheart stands; the roll-out from the Stålheart's door with a short hero shot)
- Create: `src/fx/build-readout.js` if the HUD has no progress line for an active programme step (`STÅLHEART 34%`)
- Modify: `src/td-tab.js` in place: the gunship callable before automation in sector 0 (the mount handler's `automated() && callGunship` gate), the beats' api gains `stalheartStands()` and `gunshipArrive()`, the hull hidden and undrivable until issued, the views strip without TANK until issued
- Modify: `src/isaobriefs.js` (`gunship_overhead`, `stalheart_begins`, `stalheart_stands`)
- Test: `test/story-beats.mjs`, `test/build-programme.mjs`

**Interfaces:**
- Consumes: nothing from Tasks 1-3 (sector 0 runs on the beats' own clock, not the sector run).
- Produces: `STORY_CONSTRUCTION = { every: 11, waves: [...], pace: 1.5, gunshipAt: 0 }`; beats api `api.stalheartStands() -> bool`, `api.gunshipArrive()`; `state().construction = { waves, sent }`.

- [ ] **Step 1: Failing tests** in `test/story-beats.mjs`: with a fake api whose `stalheartStands` flips true at clock 60, after `quiver-piloting` clears the beats enter `construction`, call `gunshipArrive` once, spawn a construction wave every `every` seconds from the fodder cell (types/counts from `STORY_CONSTRUCTION.waves`, cycling, each entry with `pace`), and enter `settled` only once `stalheartStands()` is true; with `stalheartStands` already true at the Quiver's clear they go straight to `settled` (a fast Stålheart never stalls the story). `test/build-programme.mjs`: the step after `gate` is `stalheart` and its `when.phase` is `rotor-ready`.
- [ ] **Step 2:** Implement the phase in `story-beats.js`; add `construction` to `STORY_PHASES` before `settled` (automation stays `from: 'settled'`, so towers are manual through construction — the POV seats are the fight).
- [ ] **Step 3:** Content: `STORY_CONSTRUCTION` (waves of 18-30 soft bodies and a hard core every other wave, from the sinkhole); base-programme order foundry → gate → stalheart → landing → solar ...; the Quiver is ordered by the beats at `rotor-ready` once the gate stands (not at `override`), so the Quiver stands before the Stålheart print takes Isao for 75 s.
- [ ] **Step 4:** td-tab + `src/fx/hull-issue.js`: until the `stalheart` step is printed on a growing bare page, the hull is not issued (hidden, `deploy` not started, drive input ignored, no TANK in the views strip). On the step's `printed`, the berth is the Stålheart's door (its structure holder's position projected to the nearest open cell outside it) and `deployStart` drives the first MÖRK out, with a 4 s follow shot; later hulls use the bays when they stand (existing). SKIP TUTORIAL, `stage=N`, `story=N` and static stages issue the hull at once as today.
- [ ] **Step 5:** the gunship in sector 0: `gunshipArrive()` starts a station pass (`startStation(gunship, GUNSHIP_ORBIT)`) and briefs `gunship_overhead`; the views strip's GUNSHIP mount works while on station before automation; after the pass the call meter runs as it does after the handover.
- [ ] **Step 6:** Stålheart progress on the HUD while its print runs.
- [ ] **Step 7:** `npm test`, `npm run check`; browser `--grow` (retime its marks: Stålheart begins after the gate, hull out mark), `--story-world`, `--seats`, `--showcase`, `--defense`, `--skip-tutorial`. Commit.

### Task 5: Merge, full verification, records

- [ ] Merge Task 4's branch into `pacing` (`git merge --no-commit`, resolve td-tab one-liners token-wise, `npm run log -- render`, verify, then commit).
- [ ] Run `--pacing` and tune the content numbers until the targets hold; note every change and the before/after numbers.
- [ ] Full: `npm test`, `npm run check`, `npm run build`, default browser suite, `--grow`, `--story-world`, `--sectors`, `--backdoor`, `--skip-tutorial`, `--defense`, `--seats`, `--showcase`, `--pacing`, `--dist`.
- [ ] Log entries (spec, clock, back door, sector 0, the probe's numbers); `docs/STATE.md` (what landed, next priorities, D as direction); vault history entry; Telegram the owner. No push.
