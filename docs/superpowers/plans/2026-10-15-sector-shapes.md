# Sector shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Size every sector's waves off a readable table in bodies: sectors 1-3 as pulses with a breath, sector 4 (THE PRESS) and after as a streamed flow that keeps the lane at a target, hard cores by share.

**Architecture:** A new pure domain module `src/domain/sector-shape.js` sizes a ladder plan to a count and a core share and holds the pulse and flow due rules; `src/content/sectors.js` rows carry `shape` and their numbers; `src/domain/sectors.js sectorDef` carries the shape through held and generated sectors; `src/fx/sector-run.js` calls the module in `waveOf`, `queueOf`, `canRelease`, `pulseGap`. The soft factor, the stampede's multipliers and the Pearl build-up's count thinning retire. Spec: `docs/superpowers/specs/2026-10-15-sector-shapes-design.md`.

**Tech Stack:** Native ESM, `node:assert/strict` test programs under `test/` (picked up by `npm test`), the browser harness `scripts/browser-test.mjs`.

## Global Constraints

- Domain modules import nothing from `src/content/` (the architecture guard, `npm run architecture` through `npm run check`).
- `src/td-tab.js` sits at 6,124 of a 6,400-line ceiling with a byte and long-line ratchet: add nothing there unless the host literal needs one field, and then on an existing line.
- `node --check <file>` after every edit of a source file; a browser suite that times out at load is a syntax error.
- Never edit `src/` while a browser suite is serving the tree; run suites one chain at a time (16 GB machine).
- Balance numbers live in `src/content/sectors.js`, never inside a rule.
- Commit after each task; push only at the end (Task 6), the owner's standing OK for this round.

---

### Task 1: The shape rules (`src/domain/sector-shape.js`)

**Files:**
- Create: `src/domain/sector-shape.js`
- Test: `test/sector-shape.mjs`

**Interfaces:**
- Produces:
  - `sizeWave(entries, spec, { bodies, coreShare = 0 }) -> [{ type, count }]`: `entries` a ladder plan's `[{ type, count }]`, `spec` ENEMY_SPEC (`spec[type].rammable` soft); returns the plan's types in the plan's order, counts summing to `bodies` exactly: `round(bodies x coreShare)` cored bodies (at least one of each cored type while that fits, none at all at share 0 or with no cored type), the rest soft, each group apportioned by largest remainder with one of each type while the group's budget allows. Types with count 0 are dropped. `bodies <= 0` returns `[]`.
  - `pulseBodies(list, index) -> number`: `list[min(index, list.length - 1)]`, 0 for an empty list.
  - `flowWaves({ total, burst }, breaches) -> number`: `max(1, ceil(total / max(1, breaches) / burst))`.
  - `pulseDue({ sent, alive, lastSize, sinceRelease, pulse, breath: { at, max } }) -> boolean`: `!sent || sinceRelease >= max || (sinceRelease >= pulse && alive <= lastSize * at)`.
  - `flowDue({ alive, target }) -> boolean`: `alive < target`.
  - `flowTarget(alive, cap) -> number`: `cap > 0 ? min(alive, cap) : alive`.
  - `streamOffsets(n, seconds) -> number[]`: `n` offsets from 0, `k * seconds / n`; `[0]` for `n <= 1`.

- [ ] **Step 1: Write the failing test**

`test/sector-shape.mjs`:

```js
import assert from 'node:assert/strict';
import { sizeWave, pulseBodies, flowWaves, pulseDue, flowDue, flowTarget, streamOffsets } from '../src/domain/sector-shape.js';

const spec = { amoeba: { rammable: true }, ghost: { rammable: true }, drifter: {}, barbed: {} };
const total = (es) => es.reduce((n, e) => n + e.count, 0);

// SIZING: the plan's mix at an exact count
{
  const plan = [{ type: 'drifter', count: 6 }, { type: 'amoeba', count: 6 }, { type: 'ghost', count: 6 }];
  const w = sizeWave(plan, spec, { bodies: 100, coreShare: 0.05 });
  assert.equal(total(w), 100, 'the count is exact');
  assert.deepEqual(w.map((e) => e.type), ['drifter', 'amoeba', 'ghost'], 'the plan\'s order');
  assert.equal(w.find((e) => e.type === 'drifter').count, 5, 'five of a hundred are cored');
  assert.deepEqual(w.filter((e) => spec[e.type].rammable).map((e) => e.count), [48, 47], 'the soft types share the rest by their proportions');
}
{
  const plan = [{ type: 'barbed', count: 8 }, { type: 'amoeba', count: 20 }, { type: 'drifter', count: 3 }, { type: 'ghost', count: 20 }];
  const w = sizeWave(plan, spec, { bodies: 30, coreShare: 0.03 });
  assert.equal(total(w), 30);
  assert.deepEqual(w.filter((e) => !spec[e.type].rammable).map((e) => e.count), [1, 1], 'one of each cored type when the share rounds under it');
  const w0 = sizeWave(plan, spec, { bodies: 30, coreShare: 0 });
  assert.ok(w0.every((e) => spec[e.type].rammable) && total(w0) === 30, 'no share, no cores');
  const w3 = sizeWave(plan, spec, { bodies: 3, coreShare: 0.5 });
  assert.equal(total(w3), 3, 'a tiny wave is still exact');
}
{
  const w = sizeWave([{ type: 'amoeba', count: 4 }], spec, { bodies: 12, coreShare: 0.2 });
  assert.deepEqual(w, [{ type: 'amoeba', count: 12 }], 'no cored type in the plan: all soft');
  const c = sizeWave([{ type: 'barbed', count: 4 }], spec, { bodies: 12, coreShare: 0.2 });
  assert.deepEqual(c, [{ type: 'barbed', count: 12 }], 'no soft type in the plan: all cored');
  assert.deepEqual(sizeWave([{ type: 'amoeba', count: 4 }], spec, { bodies: 0 }), [], 'nothing to send');
  const one = sizeWave([{ type: 'amoeba', count: 9 }, { type: 'ghost', count: 1 }], spec, { bodies: 1 });
  assert.equal(total(one), 1, 'one body: one type');
}

// THE PULSE LIST
assert.equal(pulseBodies([10, 20, 30, 50], 0), 10);
assert.equal(pulseBodies([10, 20, 30, 50], 3), 50);
assert.equal(pulseBodies([10, 20, 30, 50], 9), 50, 'past the list its last entry repeats');
assert.equal(pulseBodies([], 2), 0);

// THE FLOW'S BOOKS
assert.equal(flowWaves({ total: 1800, burst: 150 }, 2), 6, '1800 over two breaches in bursts of 150');
assert.equal(flowWaves({ total: 3000, burst: 200 }, 1), 15);
assert.equal(flowWaves({ total: 10, burst: 150 }, 2), 1, 'never under one wave');

// THE BREATH: a sector's first pulse is always due; then the pulse after the field is mostly dead, or the ceiling
const breath = { at: 0.25, max: 60 };
assert.equal(pulseDue({ sent: false, alive: 500, lastSize: 0, sinceRelease: 0, pulse: 12, breath }), true, 'the first pulse');
assert.equal(pulseDue({ sent: true, alive: 30, lastSize: 100, sinceRelease: 13, pulse: 12, breath }), false, 'the wave is still up');
assert.equal(pulseDue({ sent: true, alive: 25, lastSize: 100, sinceRelease: 13, pulse: 12, breath }), true, 'mostly dead: due');
assert.equal(pulseDue({ sent: true, alive: 0, lastSize: 100, sinceRelease: 5, pulse: 12, breath }), false, 'dead early: the pulse still runs');
assert.equal(pulseDue({ sent: true, alive: 100, lastSize: 100, sinceRelease: 60, pulse: 12, breath }), true, 'the ceiling: stacked');

// THE FLOW: under the target, send
assert.equal(flowDue({ alive: 449, target: 450 }), true);
assert.equal(flowDue({ alive: 450, target: 450 }), false);
assert.equal(flowTarget(850, 400), 400, 'the crowd cap clamps the target');
assert.equal(flowTarget(850, Infinity), 850);
assert.equal(flowTarget(850, undefined), 850);

// THE STREAM
assert.deepEqual(streamOffsets(4, 6), [0, 1.5, 3, 4.5]);
assert.deepEqual(streamOffsets(1, 6), [0]);
assert.deepEqual(streamOffsets(0, 6), [0]);

console.log('sector-shape ok');
```

- [ ] **Step 2: Run it to see it fail**

Run: `node test/sector-shape.mjs`
Expected: `ERR_MODULE_NOT_FOUND` for `src/domain/sector-shape.js`.

- [ ] **Step 3: Write the module**

`src/domain/sector-shape.js`:

```js
// THE SECTOR'S SHAPE (owner, 2026-10-15, asked what a late sector should feel like under the Pearl set: "both by sector", early sectors as
// pulses with gaps, late sectors as a filled lane; spec docs/superpowers/specs/2026-10-15-sector-shapes-design.md). A sector's row says its
// shape and its numbers in bodies (src/content/sectors.js); the ladder (src/enemyspec.js computeWavePlan) keeps choosing which types a wave
// brings and nothing else. Pure: plans, counts and clocks in, counts and decisions out.
//   sizeWave       a ladder plan at an exact count: `coreShare` of it cored bodies (the plan's cored types in their proportions, one of each
//                  while that fits, none at share 0), the rest soft from its soft types; largest-remainder rounding, the plan's order
//   pulseBodies    a pulse sector's count for its k-th wave (the list's last entry repeats)
//   flowWaves      a flow sector's waves planned per breach: its total over its breaches in bursts
//   pulseDue       the breath: a sector's first pulse at once; then `pulse` seconds after the last release AND the field at or under `at` of the
//                  last pulse's size, or `max` seconds after the release whatever is alive (a player who falls behind is stacked)
//   flowDue        the lane under its target takes the next burst
//   flowTarget     the target under the crowd cap
//   streamOffsets  a burst spread evenly over the pulse

// n bodies over the group's counts by largest remainder; one of each type while n allows, the biggest types first when it does not
function apportion(group, n) {
  if (n <= 0 || !group.length) return group.map(() => 0);
  if (n < group.length) { const order = group.map((e, i) => [e.count, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]); const out = group.map(() => 0); for (let k = 0; k < n; k++) out[order[k][1]] = 1; return out; }
  const sum = group.reduce((s, e) => s + e.count, 0) || 1, spare = n - group.length;
  const raw = group.map((e) => (e.count / sum) * spare), out = raw.map((r) => 1 + Math.floor(r));
  let left = n - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]]++;
  return out;
}

export function sizeWave(entries, spec, { bodies, coreShare = 0 }) {
  const n = Math.max(0, Math.floor(bodies) || 0);
  if (!n || !entries?.length) return [];
  const soft = entries.filter((e) => !!spec[e.type]?.rammable), cored = entries.filter((e) => !spec[e.type]?.rammable);
  let cores = !cored.length ? 0 : !soft.length ? n : coreShare > 0 ? Math.min(n, Math.max(Math.min(cored.length, n), Math.round(n * coreShare))) : 0;
  const cc = apportion(cored, cores), sc = apportion(soft, n - cores);
  const count = new Map([...cored.map((e, i) => [e, cc[i]]), ...soft.map((e, i) => [e, sc[i]])]);
  return entries.map((e) => ({ type: e.type, count: count.get(e) ?? 0 })).filter((e) => e.count > 0);
}

export const pulseBodies = (list, index) => (list?.length ? list[Math.max(0, Math.min(list.length - 1, Math.floor(index) || 0))] : 0);

export const flowWaves = ({ total, burst }, breaches) => Math.max(1, Math.ceil(total / Math.max(1, breaches) / Math.max(1, burst)));

export const pulseDue = ({ sent, alive, lastSize, sinceRelease, pulse, breath }) => !sent || sinceRelease >= breath.max || (sinceRelease >= pulse && alive <= lastSize * breath.at);

export const flowDue = ({ alive, target }) => alive < target;

export const flowTarget = (alive, cap) => (cap > 0 ? Math.min(alive, cap) : alive);

export const streamOffsets = (n, seconds) => (n > 1 ? Array.from({ length: n }, (_, k) => (k * seconds) / n) : [0]);
```

- [ ] **Step 4: Run the test**

Run: `node --check src/domain/sector-shape.js && node test/sector-shape.mjs`
Expected: `sector-shape ok`. If the proportions assertion `[48, 47]` fails by one, check `apportion`'s remainder order (ties go to the earlier type); the test's numbers are 95 soft over two equal types: 48 and 47.

- [ ] **Step 5: Commit**

```bash
git add src/domain/sector-shape.js test/sector-shape.mjs
git commit -m "Sector shapes, the rules (src/domain/sector-shape.js): a ladder plan sized to an exact count with hard cores by share, the pulse list, the flow's waves, the breath, the flow's due rule, the target under the cap, the stream. test/sector-shape.mjs"
```

---

### Task 2: The tables and the defs (`src/content/sectors.js`, `src/domain/sectors.js`, `src/domain/stampede.js`, `src/content/pearl-enemies.js`, `src/domain/pearl-bodies.js`)

**Files:**
- Modify: `src/content/sectors.js` (SECTORS rows, SECTOR_HOLD, BACK_DOOR_SECTOR, BOTH_WALLS_SECTOR, SECTOR_GENERATOR, SECTOR_TIMING, SECTOR_STAMPEDE)
- Modify: `src/domain/sectors.js:16-45` (`sectorDef`)
- Modify: `src/domain/stampede.js` (the kinds, no multipliers)
- Modify: `src/content/pearl-enemies.js:140` (`PEARL_WAVES`), `src/domain/pearl-bodies.js` (`pearlBuildUp`)
- Test: `test/sectors.mjs`, `test/stampede.mjs` (if it exists: `ls test/stampede.mjs`), the test that holds `pearlBuildUp` (`grep -ln pearlBuildUp test/*.mjs`)

**Interfaces:**
- Consumes: `flowWaves` from Task 1.
- Produces: every def from `sectorDef` carries `shape` (`'pulse'` | `'flow'`), `coreShare`, and either `bodies` + `breath` + `pulse` or `flow: { alive, total, burst, pulse }` with `waves` set from `flowWaves`; `stampedeWave(entries, spec, tune, { index }) -> { entries, gap, kind }` where a trickle returns the entries unchanged with `gap: tune.trickleGap` and a flood the entries plus `tune.cores` of `tune.core`; `pearlBuildUp(wave, table) -> { f, pace }`.

- [ ] **Step 1: Write the failing tests**

In `test/sectors.mjs`, replace the block headed `// THE CLIMB (owner, 2026-09-16 ...` through the end of its `for (const doorAt ...)` loop, and the block headed `// the clock's guard ...` through its `for (const n of [1, 2, 3, 4, 5, 6])` loop, with:

```js
// THE CLIMB, BY SHAPE (owner, 2026-10-15: pulses with a breath for the first sectors, the filled lane from THE PRESS on; spec
// 2026-10-15-sector-shapes-design.md). A sector's peak on the field is its biggest pulse times its breaches, or its flow target; every
// sector of the climb peaks past the one before (the canyon aside: SOL-82's spike is its swarm), BOTH WALLS past the door, and no flow
// target past the column the frame holds (1,200 Pearl bodies, 2026-10-15-pearl-crowd-measured-headed)
{
  const count = (d) => Object.values(d.breaches).reduce((a, b) => a + b, 0);
  const peak = (d) => (d.shape === 'flow' ? d.flow.alive : Math.max(...d.bodies) * count(d));
  assert.deepEqual(SECTORS.map((s) => s.shape), ['pulse', 'pulse', 'pulse', 'flow', 'flow'], 'THE PRESS fills the lane');
  assert.ok(SECTORS.slice(0, 3).every((s) => s.bodies.length === s.waves && s.breath.at > 0 && s.breath.at < 1 && s.breath.max > s.pulse), 'a pulse sector lists a count a wave and breathes');
  assert.ok(SECTORS.slice(0, 3).every((s) => s.bodies.every((b, i) => i === 0 || b > s.bodies[i - 1])), 'a pulse sector\'s waves grow');
  assert.ok(peak(def(1)) <= 30, `sector 1 opens with a crowd, not a flood (${peak(def(1))})`);
  for (const doorAt of [SECTOR_DOOR.earliest, SECTOR_DOOR.latest]) {
    const defs = Array.from({ length: doorAt + 3 }, (_, k) => def(k + 1, doorAt));
    const climb = defs.slice(0, doorAt).filter((d) => !d.canyon).map(peak);
    for (let i = 1; i < climb.length; i++) assert.ok(climb[i] > climb[i - 1], `door at ${doorAt}: each sector of the climb peaks harder than the one before (${climb})`);
    assert.ok(peak(defs[doorAt]) > peak(defs[doorAt - 1]), `door at ${doorAt}: BOTH WALLS peaks past the door`);
    for (const d of defs.filter((d) => d.shape === 'flow')) {
      assert.ok(d.flow.alive <= SECTOR_GENERATOR.aliveCap, `${d.name}: the flow never past the column the frame holds (${d.flow.alive})`);
      assert.ok(d.flow.burst * count(d) < d.flow.alive, `${d.name}: a burst from every mouth does not fill the lane alone`);
      assert.equal(d.waves, Math.ceil(d.flow.total / count(d) / d.flow.burst), `${d.name}: the books count the flow's bursts`);
      assert.ok(d.coreShare >= 0 && d.coreShare < 0.2, `${d.name}: a few hard cores`);
    }
    assert.ok(defs.at(-1).flow.alive === Math.min(SECTOR_GENERATOR.aliveCap, defs.at(-2).flow.alive + SECTOR_GENERATOR.aliveStep) && defs.at(-1).flow.total === defs.at(-2).flow.total + SECTOR_GENERATOR.totalStep, 'the generated sectors step the flow');
  }
  const held = def(SECTORS.length + 2, SECTOR_DOOR.latest);
  assert.ok(held.shape === 'flow' && held.flow.alive === SECTOR_HOLD.flow.alive + SECTOR_HOLD.aliveStep, 'a held sector steps the flow');
  assert.ok(def(SECTOR_DOOR.latest - 1, SECTOR_DOOR.latest).canyon && def(SECTOR_DOOR.latest - 1, SECTOR_DOOR.latest).shape === 'flow', 'the canyon again flows at the gate under its swarm');
  assert.ok(!('soft' in SECTOR_TIMING) && !('size' in SECTOR_STAMPEDE) && !('trickle' in SECTOR_STAMPEDE), 'the soft factor and the stampede\'s multipliers are retired: the table is the size');
}

// the clock's guard, kept for the campaign board: a pulse arms while it fits, and an empty field always takes the next one
assert.equal(pulseFits(100, 120, 520), true);
assert.equal(pulseFits(400, 121, 520), false, 'a pulse that would crowd past the budget waits');
assert.equal(pulseFits(0, 900, 520), true, 'an empty field never stalls on a big pulse');
```

Then in the same file find `const d2 = def(6, 6);   // the back door: six waves from ladder wave 5` and the release loop under it; replace the loop and its `assert.deepEqual(waves, ...)` with:

```js
const waves = [];
for (let i = 0; i < d2.waves + 2; i++) waves.push(releaseWave(st, 'g', 100 + i));
assert.deepEqual(waves.slice(0, d2.waves).map((w) => w.last), Array.from({ length: d2.waves }, (_, i) => i === d2.waves - 1), 'every planned wave leaves, the last marked');
assert.deepEqual(waves.slice(0, 6).map((w) => w.wave), [5, 6, 7, 8, 9, 10], 'the door starts at ladder wave 5 and climbs');
assert.ok(waves.slice(6, d2.waves).every((w) => w.wave === 11) && waves.slice(d2.waves).every((w) => w === null), 'capped at the ladder\'s top, then nothing');
```

Also update the first assertion of the file, `assert.deepEqual(SECTORS.map((s) => [s.n, s.breaches, s.waves]), ...)`: a flow row has no `waves` of its own, so change it to compare `[s.n, s.breaches]` with `[[1, { gate: 2 }], [2, { gate: 2 }], [3, { gate: 1 }], [4, { gate: 2 }], [5, { side: 1, gate: 1 }]]`.

`grep -n "trickleMax\|tierSize\|tierCores\|\.size\b\|\.trickle\b\|scale" test/stampede.mjs test/pearl-*.mjs test/creature-*.mjs 2>/dev/null` and re-base those assertions: a trickle returns the plan's entries unchanged with `gap === tune.trickleGap` and `kind === 'trickle'`; a flood returns the plan's entries plus `{ type: tune.core, count: tune.cores }` with `gap === null` and `kind === 'flood'`; `pearlBuildUp({ released: 0, planned: 4 }, PEARL_WAVES)` returns `{ f: 0, pace: 0.6 }` and has no `scale`.

- [ ] **Step 2: Run them to see them fail**

Run: `node test/sectors.mjs; node test/stampede.mjs 2>/dev/null; for f in $(grep -ln pearlBuildUp test/*.mjs); do node $f; done`
Expected: `test/sectors.mjs` fails on `SECTORS.map((s) => s.shape)`.

- [ ] **Step 3: The content**

In `src/content/sectors.js`, change the five `SECTORS` rows (keep every other field of each row as it is: breaches, ladderStart, threat, held, flags, new, brief, canyon):

```js
  { n: 1, name: 'THE LANE', shape: 'pulse', bodies: [10, 20, 30, 50], breath: { at: 0.25, max: 60 }, coreShare: 0, breaches: { gate: 2 }, waves: 4, ladderStart: 0, threat: 1.2, pulse: 12, held: { kg: 40, points: 400 },
  ...
  { n: 2, name: 'THE LONG LANE', shape: 'pulse', bodies: [20, 35, 50, 90], breath: { at: 0.25, max: 55 }, coreShare: 0, breaches: { gate: 2 }, waves: 4, ladderStart: 1, threat: 1.5, pulse: 10, held: { kg: 45, points: 450 },
  ...
  { n: 3, name: 'THE CANYON', shape: 'pulse', bodies: [30, 50, 70, 120], breath: { at: 0.25, max: 50 }, coreShare: 0.03, breaches: { gate: 1 }, waves: 4, ladderStart: 2, threat: 1.8, pulse: 10, held: { kg: 50, points: 500 }, canyon: true,
  ...
  { n: 4, name: 'THE PRESS', shape: 'flow', flow: { alive: 450, total: 1800, burst: 150, pulse: 6 }, coreShare: 0.03, breaches: { gate: 2 }, ladderStart: 4, threat: 2.1, pulse: 6, held: { kg: 55, points: 550 },
  ...
  { n: 5, name: 'THE SIDE WALL', shape: 'flow', flow: { alive: 550, total: 2400, burst: 180, pulse: 6 }, coreShare: 0.05, breaches: { side: 1, gate: 1 }, ladderStart: 5, threat: 2.2, pulse: 6, held: { kg: 60, points: 600 },
```

and the arc rows:

```js
export const SECTOR_HOLD = freeze({ name: 'SECTOR', shape: 'flow', flow: { alive: 650, total: 3000, burst: 200, pulse: 6 }, aliveStep: 40, totalStep: 300, coreShare: 0.05, breaches: { gate: 2 }, ladderStart: 5, threatStep: 0.15, pulse: 6, held: { kg: 60, points: 600 },
  brief: [...as today...] });
export const BACK_DOOR_SECTOR = freeze({ name: 'THE BACK DOOR', shape: 'flow', flow: { alive: 700, total: 3600, burst: 220, pulse: 6 }, coreShare: 0.05, breaches: { back: 1, gate: 1 }, ladderStart: 4, threat: 2.6, pulse: 6,
  feast: {...as today...}, held: { kg: 70, points: 700 }, ...flags and brief as today... });
export const BOTH_WALLS_SECTOR = freeze({ name: 'BOTH WALLS', shape: 'flow', flow: { alive: 850, total: 4800, burst: 250, pulse: 5 }, coreShare: 0.08, breaches: { gate: 1, back: 1 }, ladderStart: 6, threat: 2.4, pulse: 5, held: { kg: 80, points: 800 },
  ...flags, hardcores: 2, new, brief as today... });
export const SECTOR_GENERATOR = freeze({
  name: 'SECTOR', aliveStep: 75, aliveCap: 1200, totalStep: 600, threatStep: 0.15, ladderStart: 6, ladderCap: 11, held: { kg: 80, points: 800 }, heldStep: { kg: 10, points: 100 },
  sides: [{ gate: 2 }, { back: 2 }],
  brief: [...as today...],
});
```

Remove `waves:` from SECTOR_HOLD, BACK_DOOR_SECTOR and BOTH_WALLS_SECTOR and `wavesBase` from SECTOR_GENERATOR. Rewrite the comment block above `SECTORS` so it says what the table now means (the shapes, the breath, the flow, cores by share, the ladder keeps the mix; the owner's 2026-10-15 words) and drop the sentences about the soft factor and ladder windows that no longer size anything. Change `SECTOR_TIMING` to:

```js
export const SECTOR_TIMING = freeze({ stall: 20, briefSeconds: 6, staggerSeconds: 1.5, backDoorLead: 5, securePause: 3, lostHold: 2.5, pace: 1.5, aliveBudget: 2500, firstGrace: 90 });
```

with its comment trimmed of the `soft` paragraphs (keep the clock's, `pace`, `aliveBudget` now the campaign board's guard, `firstGrace`, `stall`). Change `SECTOR_STAMPEDE` to:

```js
export const SECTOR_STAMPEDE = freeze({ every: 2, cores: 2, core: 'barbed', callout: 'STAMPEDE — RAM THEM', trickleGap: 1.3, trickleCallout: 'SOFT ONES — KEEP THE CHAIN' });
```

and its comment: every second wave of a gate or back breach in a PULSE sector is a stampede, alternating a trickle (the plan's bodies one every `trickleGap` seconds, the combo game) and a flood (`cores` x `core` riding in it); the size is the sector's list (2026-10-15).

- [ ] **Step 4: The defs**

`src/domain/sectors.js`: import nothing from content (the module takes tables as arguments). Add at the top:

```js
import { flowWaves } from './sector-shape.js';
```

and a helper above `sectorDef`:

```js
// a flow row's waves planned per breach come from its total, its breaches and its burst (src/domain/sector-shape.js); a pulse row keeps its own
const shaped = (d) => (d.shape === 'flow' && d.flow ? { ...d, waves: flowWaves(d.flow, Object.values(d.breaches).reduce((a, b) => a + b, 0)) } : d);
```

Then wrap every return of `sectorDef` in `shaped(...)`, and step the flow where threat is stepped:

```js
export function sectorDef(n, table, generator, arc = null) {
  n = Math.max(1, Math.floor(n) || 1);
  const ladderCap = generator.ladderCap ?? Infinity;
  if (n <= table.length) { const d = table[n - 1]; return shaped({ ...d, waveBase: d.ladderStart ?? 0, ladderCap }); }
  const doorAt = arc?.doorAt ?? null;
  if (arc && doorAt !== null && n === doorAt) return shaped({ ...arc.door, n, waveBase: arc.door.ladderStart ?? 0, ladderCap });
  if (arc && doorAt !== null && n === doorAt + 1) return shaped({ ...arc.both, n, waveBase: arc.both.ladderStart ?? 0, ladderCap });
  if (arc && (doorAt === null || n < doorAt)) {
    const last = table[table.length - 1], h = arc.hold, past = n - table.length;
    const again = arc.canyonAgain && doorAt !== null && n === doorAt - 1 ? arc.canyonAgain : null;   // the penultimate sector: the canyon again
    const flow = h.flow ? { ...h.flow, alive: h.flow.alive + (h.aliveStep ?? 0) * (past - 1), total: h.flow.total + (h.totalStep ?? 0) * (past - 1) } : undefined;
    return shaped({
      ...last, n, name: `${h.name} ${n}`, new: null, brief: h.brief, breaches: { ...h.breaches }, shape: h.shape ?? last.shape, flow, coreShare: h.coreShare ?? last.coreShare, pulse: h.pulse ?? last.pulse,
      threat: Math.round((last.threat + h.threatStep * past) * 100) / 100, held: { ...h.held }, feast: undefined, backDoor: false, canyon: false,
      waveBase: h.ladderStart ?? 0, ladderCap, ...(again ? { ...again, breaches: { ...again.breaches } } : {}),
    });
  }
  const last = arc ? arc.both : table[table.length - 1], past = n - (arc ? doorAt + 1 : table.length);
  const flow = last.flow ? { ...last.flow, alive: Math.min(generator.aliveCap ?? Infinity, last.flow.alive + (generator.aliveStep ?? 0) * past), total: last.flow.total + (generator.totalStep ?? 0) * past } : undefined;
  return shaped({
    ...last, n, name: `${generator.name} ${n}`, new: null, brief: generator.brief,
    breaches: { ...generator.sides[(past - 1) % generator.sides.length] },
    flow,
    threat: Math.round((last.threat + generator.threatStep * past) * 100) / 100,
    held: { kg: generator.held.kg + generator.heldStep.kg * (past - 1), points: generator.held.points + generator.heldStep.points * (past - 1) },
    waveBase: generator.ladderStart ?? 0, ladderCap,
  });
}
```

Remove the `waves: h.waves` and `waves: generator.wavesBase + past` fields (the flow sets them). Update the comment above `sectorDef` (the generator's arithmetic: alive and total step, the cap).

`src/domain/stampede.js`: replace `stampedeWave`, `capped` and `stampedeOf` with:

```js
// (2026-10-03, owner: "more waves of soft-body only… spaced just right that it takes some effort (keeping some alive until the last
// moment) to time continuing bonuses") the stampedes alternate: the first of each pair is a TRICKLE (the plan's bodies one every
// `trickleGap` seconds so a steady rammer can keep the combo alive), the second a FLOOD (`cores` hard cores of `core` riding in it).
// THE SIZE IS THE SECTOR'S (2026-10-15, sector shapes): the plan comes in already sized off the sector's table (src/domain/sector-shape.js),
// so neither kind multiplies it any more. Returns { entries, gap, kind } (gap: the queue's spacing, or null)
export function stampedeWave(entries, spec, tune, { index = 1 } = {}) {
  const trickle = Math.floor(index / tune.every) % 2 === 0;
  if (trickle) return { entries: entries.map((e) => ({ ...e })), gap: tune.trickleGap, kind: 'trickle' };
  return { entries: [...entries.map((e) => ({ ...e })), ...(tune.cores > 0 ? [{ type: tune.core, count: tune.cores }] : [])], gap: null, kind: 'flood' };
}
```

Keep `isStampede` as it is; drop the `spec` use (keep the parameter for the call sites) and the `fallback`/`tier` text from the header comment.

`src/content/pearl-enemies.js:140`: `export const PEARL_WAVES = freeze({ pace: freeze({ first: 0.6, last: 1 }) });` and its comment: the build-up is the march's pace only; the counts are the sector's table (2026-10-15). `src/domain/pearl-bodies.js pearlBuildUp`: return `{ f, pace: at(table.pace) }` and drop `scale` from its comment.

- [ ] **Step 5: Run the tests**

Run: `for f in src/content/sectors.js src/domain/sectors.js src/domain/stampede.js src/content/pearl-enemies.js src/domain/pearl-bodies.js; do node --check $f || exit 1; done && node test/sector-shape.mjs && node test/sectors.mjs && npm test 2>&1 | tail -15`
Expected: the three pass; `npm test` may still fail in `test/host-contracts.mjs` or a test that reads `SECTOR_TIMING.soft` / `PEARL_WAVES.scale` / `SECTOR_STAMPEDE.size`: `grep -rn "SECTOR_TIMING.soft\|PEARL_WAVES.scale\|SECTOR_STAMPEDE.size\|trickleMax\|wavesBase" src test scripts` and fix each reader (sector-run's readers are Task 3's; a test's assertion is re-based to the new shape).

- [ ] **Step 6: Commit**

```bash
git add src/content/sectors.js src/domain/sectors.js src/domain/stampede.js src/content/pearl-enemies.js src/domain/pearl-bodies.js test/sectors.mjs test/stampede.mjs test/pearl-*.mjs
git commit -m "Sector shapes, the tables and the defs: every row says its shape in bodies (S1-S3 pulse lists with a breath, THE PRESS and after a flow with an alive target, a total and a burst; hard cores by share), the held and generated sectors step the flow, a flow's waves planned from its bursts; the soft factor, the stampede's multipliers and the Pearl build-up's count thinning retired. test/sectors.mjs re-based on the tables"
```

---

### Task 3: The sector loop sizes, streams and breathes (`src/fx/sector-run.js`, `src/fx/creature-enemies.js`)

**Files:**
- Modify: `src/fx/sector-run.js:103-145` (`waveOf`, `queueOf`, `sendWave`, `nextPulseSize`), `:396-410` (`canRelease`, `pulseGap`), the imports at `:14-19`
- Modify: `src/fx/creature-enemies.js:159-176` (`thin`)
- Modify (one field, on an existing line): the sector-run host literal in `src/td-tab.js` (`grep -n "createSectorRun({" src/td-tab.js`) if it has no crowd-cap reader; `test/host-contracts.mjs` holds the literal to the module.
- Test: `test/sector-run.mjs` if it exists (`ls test/sector-run*.mjs`), else the browser suites of Task 4.

**Interfaces:**
- Consumes: Task 1's `sizeWave`, `pulseBodies`, `pulseDue`, `flowDue`, `flowTarget`, `streamOffsets`; Task 2's defs (`def.shape`, `def.bodies`, `def.breath`, `def.flow`, `def.coreShare`), `stampedeWave(entries, spec, tune, { index })`.
- Produces: `api.crowdCap?.()` read from the host (the crowd cap's current value, or undefined).

- [ ] **Step 1: Find the host's crowd cap**

Run: `grep -n "crowdGate\b.*=\|crowdCap\|cap:" src/td-tab.js src/fx/crowd-gate.js 2>/dev/null | head; grep -n "createSectorRun({" src/td-tab.js`
Note the reader (`crowdGate.cap()` or the field the gate exposes) and the host literal's line.

- [ ] **Step 2: Wire the loop**

`src/fx/sector-run.js` imports: add `import { sizeWave, pulseBodies, pulseDue, flowDue, flowTarget, streamOffsets } from '../domain/sector-shape.js';`. Replace `waveOf`, `queueOf` and `sendWave`:

```js
  // ONE BREACH'S NEXT WAVE, at ladder wave `wave`: THE FEAST (the door's back breach, first wave: the content's soft flood at its own pace), or
  // the ladder wave's plan SIZED OFF THE SECTOR'S TABLE (2026-10-15, src/domain/sector-shape.js: a pulse sector's count for this wave, a flow
  // sector's burst; the plan's types in their proportions, `coreShare` of them cored), the sector's own few hard cores on top, at the sector pace.
  // `swell` (the automations' envelope) multiplies the count
  const feastFor = (b) => !!def?.feast && b.side === 'back' && b.wavesReleased === 0;
  const swell = () => api.swell?.() ?? 1;
  function waveOf(b, wave) {
    if (feastFor(b)) return { entries: def.feast.entries, pace: def.feast.pace ?? SECTOR_TIMING.pace };
    // THE CANYON'S SWARM: `swarm` sector pulses (two breaches' worth each) of the ladder wave `ladder` past the sector's start, at once
    if (b.side === 'canyon') return { entries: computeWavePlan(def.waveBase + CANYON.ladder, 1, h.waveSize, def.threat * (h.threatMult ?? 1) * swell()).entries.map((e) => ({ ...e, count: e.count * CANYON.swarm * 2 })), pace: SECTOR_TIMING.pace, spread: CANYON.spread, dens: CANYON.dens };
    const flow = def.shape === 'flow', released = b.wavesReleased ?? 0;
    const plan = computeWavePlan(wave, 1, h.waveSize, def.threat * (h.threatMult ?? 1) * swell()).entries;
    const entries = sizeWave(plan, ENEMY_SPEC, { bodies: Math.round((flow ? def.flow.burst : pulseBodies(def.bodies, released)) * swell()), coreShare: def.coreShare ?? 0 });
    // THE STAMPEDE (src/domain/stampede.js): in a pulse sector every second wave a mouth sends is a trickle or a flood with a few hard cores in it
    if (!flow && (b.side === 'gate' || b.side === 'back') && isStampede(released, SECTOR_STAMPEDE)) { const w = stampedeWave(entries, ENEMY_SPEC, SECTOR_STAMPEDE, { index: released }); return { entries: w.entries, gap: w.gap, pace: SECTOR_TIMING.pace, stampede: w.kind }; }
    if (def.hardcoresEveryWave && h.hardcore) entries.push({ type: h.hardcore, count: def.hardcores ?? 1 });
    return { entries, pace: SECTOR_TIMING.pace, stream: flow ? def.flow.pulse : 0 };
  }
  // the queue entries for a wave, spread over it the way the board's own spawner spreads a wave (src/domain/wave-spread.js); a flow's burst is
  // STREAMED over its pulse (`stream` seconds) so the lane fills and never piles
  // A BIG WAVE COMES PARTLY IN SQUADS (src/domain/squads.js): its soft bodies past the first sixty five to an entity; a flow sector whose target
  // is a squads' wave packs every burst
  function queueOf({ entries: plan, pace, spread = 0.8, dens, gap: fixed = null, stream = 0 }, sp) {
    const tune = stream > 0 && def?.flow?.alive >= SQUADS.over ? { ...SQUADS, over: 0 } : SQUADS;
    const entries = packSquads(plan, ENEMY_SPEC, tune), gap = fixed ?? waveGap(entries, h.spawnGap?.spread ?? 3.2, h.spawnGap?.max ?? 0.45);   // a trickle stampede keeps its own spacing
    const offsets = stream > 0 ? streamOffsets(waveCount(entries), stream) : null;
    const out = []; let n = 0;
    for (const { type, count, squad } of entries) for (let k = 0; k < count; k++) { out.push({ type, sp, at: offsets ? offsets[n] : n * gap, spread, pace, ...(dens ? { dens } : {}), ...(squad ? { squad } : {}) }); n++; }
    return out;
  }
  // THE LAST PULSE, for the breath (src/domain/sector-shape.js pulseDue): when it left and how many bodies it was, all breaches together
  let lastPulse = { sent: false, size: 0, at: 0 };
  // one breach sends its next wave: the books count it, a feast is noted, and its queue entries come back (null: nothing to send)
  function sendWave(b, sp, t) {
    const next = nextWaveIndex(sector, b.id);
    if (next === null) return null;
    const wave = waveOf(b, next), feasting = feastFor(b), released = b.wavesReleased ?? 0, planned = b.wavesPlanned ?? def.waves, r = releaseWave(sector, b.id, t);
    if (feasting) feast = { id: b.id, at: t, scrambled: 0 };
    if (wave.stampede) { h.callout(wave.stampede === 'trickle' ? SECTOR_STAMPEDE.trickleCallout : SECTOR_STAMPEDE.callout, 'co-victory'); stampedes++; }
    const q = queueOf(wave, sp);
    if (b.side !== 'canyon') lastPulse = { sent: true, size: (lastPulse.sent && lastPulse.at === t ? lastPulse.size : 0) + waveCount(q), at: t };
    return { r, entries: api.creatures?.(q, b.side, { released, planned }) ?? q };   // ?creatures=<family>:<tier> takes its share of the wave; the Pearl set paces its climb (src/fx/creature-enemies.js)
  }
```

Check `waveCount` (src/domain/wave-spread.js) counts a squad entry as one queue entry: `grep -n "export const waveCount\|export function waveCount" -A2 src/domain/wave-spread.js`. If it sums `count` over entries, it is right for the offsets (one offset per queue entry); `lastPulse.size` should count bodies, so use `q.reduce((n, e) => n + (e.squad || 1), 0)` there instead.

Reset `lastPulse` where a sector starts (find `phase = 'fighting'; progress();` in the sector's opening and add `lastPulse = { sent: false, size: 0, at: 0 };` on the line before it).

Replace `canRelease` and `pulseGap` in the api block:

```js
    // THE CLOCK BY SHAPE (2026-10-15, src/domain/sector-shape.js): a pulse sector breathes (the next wave `pulse` seconds after the last release
    // and once the field is mostly dead, or `breath.max` after it whatever is alive); a flow sector sends while the lane is under its target
    // (clamped by the crowd cap). A breach still opening is fine: the release path holds its bodies until the hole is open. The stall rule
    // stays on top; a feast being fought holds everything
    canRelease: () => !quiet && phase === 'fighting' && !(feast && !feast.scrambled) && sector.breaches.some((b) => b.state === 'open' && sps.get(b.id)?.alive && b.wavesReleased < b.wavesPlanned) && (stalled() || due()),
    // the seconds from one pulse leaving the breaches to the next (null: no sector is fighting, the board keeps its own gap); a flow's stream is its own gap
    pulseGap: () => (phase === 'fighting' && def ? (canyon?.phase === 'rising' && !breachOf(canyon.id)?.wavesReleased ? CANYON.firstPulse : def.shape === 'flow' ? 0 : def.pulse ?? null) : null),   // the canyon's swarm does not wait a whole pulse (2026-10-03)
```

and define `due` next to `stalled`:

```js
  const due = () => (def?.shape === 'flow'
    ? flowDue({ alive: aliveSectorEnemies(true), target: flowTarget(def.flow.alive * swell(), api.crowdCap?.()) })
    : pulseDue({ sent: lastPulse.sent, alive: aliveSectorEnemies(true), lastSize: lastPulse.size, sinceRelease: clock - lastPulse.at, pulse: def?.pulse ?? 0, breath: def?.breath ?? { at: 0, max: 0 } }));
```

(`swell` is defined above `waveOf`; move `const swell = ...` up beside `stalled` if `due` is declared first.) Drop `pulseFits` from the import if nothing else in the file uses it (`grep -n pulseFits src/fx/sector-run.js`).

`src/fx/creature-enemies.js`: rename `thin` to `climb`, keep its signature and call sites, and make it pace-only:

```js
  // THE WAVES BUILD UP (owner, 2026-10-14: "slower and fewer at the beginning before becoming more intense"; PEARL_WAVES, src/domain/pearl-bodies.js
  // pearlBuildUp): a breach's waves march at `pace` of the plan's, climbing to the plan's over the waves it has planned. THE COUNT IS THE SECTOR'S
  // (2026-10-15, sector shapes): the thinning that cut the single bodies (and skipped squads) is gone; the table sizes the wave. `wave` is
  // { released, planned } from the breach (src/fx/sector-run.js sendWave); without it the wave is at `last`
  const climbing = pearl && host.flags.waves !== 'full';
  let lastWave = null;
  function climb(entries, wave) {
    if (!climbing || !entries?.length) return entries;
    const up = pearlBuildUp(wave, PEARL_WAVES); lastWave = { ...wave, ...up };
    return up.pace === 1 ? entries : entries.map((q) => ({ ...q, pace: (q.pace ?? 1) * up.pace }));
  }
```

Then `grep -n "thinned\|thin(" src/fx/creature-enemies.js src/td-tab.js scripts/browser-test.mjs` and remove the `thinned` counters from the family's `stats()` / harness state (and any suite line that reads them: re-base it to `lastWave.pace`). Remove `spreadPicks` from the imports if it is now unused (`grep -n spreadPicks src/fx/creature-enemies.js`).

The host: if Step 1 found no crowd-cap reader in the sector-run host literal, add `crowdCap: () => <the gate's cap reader>` to the `api`/host object passed to `createSectorRun` on an existing line of that literal, and add the field to the literal's contract in `test/host-contracts.mjs` if the test lists fields.

- [ ] **Step 3: Check and run the node suite**

Run: `node --check src/fx/sector-run.js && node --check src/fx/creature-enemies.js && node --check src/td-tab.js && npm test 2>&1 | tail -8 && npm run check 2>&1 | tail -8`
Expected: every test program ok, `check` green (the architecture guard, the td-tab ratchets).

- [ ] **Step 4: Commit**

```bash
git add src/fx/sector-run.js src/fx/creature-enemies.js src/td-tab.js test/host-contracts.mjs
git commit -m "Sector shapes, the loop: waveOf sizes the ladder's plan off the sector's table (a pulse's count, a flow's burst, cores by share), a flow's burst streams over its pulse and packs squads under a squads' target, the clock breathes in a pulse sector and tops the lane up in a flow one (canRelease by shape, pulseGap 0 for a flow), the Pearl build-up paces only"
```

---

### Task 4: The browser suites

**Files:**
- Modify: `scripts/browser-test.mjs` only where a suite asserted the old sizes or the old cadence.

- [ ] **Step 1: The sector suites, one chain**

Run (one at a time, through `STALHEART_BROWSER_PORT=8191`): `for s in --sectors --pearl-story --squads --canyon --canyon-again --backdoor --waves --skip-tutorial; do echo "== $s"; STALHEART_BROWSER_PORT=8191 node scripts/browser-test.mjs $s 2>&1 | tail -6; done`
Expected: each ends `Browser acceptance passed (source)`. A red that names a count or a wave number: read its assertion, decide whether it held the old multiplied size (re-base it to the table, naming the entry in a comment) or found a real break (fix the code). `--squads` needs a squads' wave: if it waits for a sector wave of 300 soft bodies, point it at a flow sector (`sector=8`) where every burst packs.

- [ ] **Step 2: The probes against the baseline**

Run: `for n in 2 5 8; do echo "== S$n"; SECTOR=$n PLAY=1 PROBE_S=200 STALHEART_BROWSER_PORT=8191 node scripts/browser-test.mjs --sector-probe 2>&1 | grep -E "^[0-9]+s" | awk '{print}' | head -60; done`
Expected: S2 shows pulses that wait for the field (the `g1/4` line comes, then the queue drains, then at least `pulse` seconds of a quiet field before `g2/4`); S5 and S8 show `q` draining steadily every few seconds and `alive` sitting near the target instead of spiking to a thousand. Paste the readings into the record (Task 5).

- [ ] **Step 3: The pacing suite and the full suite**

Run: `STALHEART_BROWSER_PORT=8191 node scripts/browser-test.mjs --pacing 2>&1 | tail -12`
Expected: passed; it runs `creatures=dots` and its done marker is sector 2's third pulse, which the breath delays: if it times out waiting for it, raise that wait or make `PLAY`-style culling part of the step, naming why.

Then the whole suite: `npm run test:browser 2>&1 | tail -30` (it chains every step; expect the reds known on the base, `--showcase` and the default suite's shell explosion, and nothing new).

- [ ] **Step 4: Commit**

```bash
git add scripts/browser-test.mjs
git commit -m "Sector shapes, the suites: <what was re-based and why>"
```

---

### Task 5: The records

**Files:**
- Create: `docs/log/entries/2026-10-15-sector-shapes-landed.json` (the `/deban` skill or `npm run log -- add FILE`)
- Modify: `docs/STATE.md` (a new section at the head, the rework item), `DEVLOG.md` and `ROADMAP.md` (`npm run log -- render`), `docs/superpowers/specs/2026-10-15-sector-shapes-design.md` (Deviations)

- [ ] **Step 1: The entry**

Write the entry with the owner's three answers (both by sector; THE PRESS; approach 1, build and push), the baseline (paper and headless), what landed, the probes' readings before and after, the retirements, and what waits on the owner (the numbers by eye on :8159, the pulse-sector breath by feel). Status `validated` with the suites named as evidence; `supersedes: []`. Validate: `npm run log -- check` (or the command `node scripts/log.mjs` prints).

- [ ] **Step 2: STATE.md and the render**

Add a "What landed on 2026-10-15, later (sector shapes)" section under the 2026-10-15 one; render: `npm run log -- render`; `git diff --stat`.

- [ ] **Step 3: Commit**

```bash
git add docs/log/entries/2026-10-15-sector-shapes-landed.json docs/STATE.md DEVLOG.md ROADMAP.md docs/superpowers/specs/2026-10-15-sector-shapes-design.md
git commit -m "Records: sector shapes landed (2026-10-15-sector-shapes-landed), DEVLOG.md and ROADMAP.md rendered, STATE.md"
```

---

### Task 6: Push and tell the owner

- [ ] **Step 1: Push**

Run: `git push origin main 2>&1 | tail -3 && git log --oneline origin/main -1`
Expected: main pushed; the Pages workflow runs on it (`gh run list --repo kai-denrei/stalheart --limit 1`).

- [ ] **Step 2: Telegram**

```bash
source ~/.config/kainode/telegram.env
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" -d chat_id="496805857" -d parse_mode="Markdown" --data-urlencode text="Sector shapes landed on main (<sha>): S1-S3 pulses with a breath, THE PRESS and after a filled lane (alive target / total / burst per sector, in src/content/sectors.js). :8159 serves it after a reload. Numbers to tune by eye: the table in the spec."
```
