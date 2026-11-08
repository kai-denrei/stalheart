# THE SETTLING Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the story's own start the first enemies wait on a settle clock, the player chooses two first orders on the build board out of the rocket's salvage, the Stålheart prints first, Isao says the rest must be scouted (spec `docs/superpowers/specs/2026-11-08-the-settling-design.md`).

**Architecture:** the beats (`src/domain/story-beats.js`) learn a `settle` option that turns the quiet breach off, leaves the Rotor to the player, orders it in an emergency, and holds the tremor until the settle has run out; the programme's opening steps become `first` board steps priced in `BUILD_BOARD.first`; a pure `firstOffers` feeds the existing board card through a new `first(go)` entry; a small host (`src/fx/first-orders.js`) opens it once after the landers' tour over the paused game; the controller forwards four hooks on existing lines.

**Tech Stack:** vanilla ESM, three.js r160 vendored, node:test-style asserts (`npm test`), the browser harness `scripts/browser-test.mjs` through `scripts/browser-lock.sh`.

## Global Constraints

- Branch `the-settling` in the worktree `~/Dev/stalheart-landing` (from `overnight-2026-10-23` at 39f98d63). Commit as Kai Denrei; every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (that exact line, nothing else as a trailer). Never push.
- `src/domain` never imports `src/content`. `src/td-tab.js` stays at or under 5,450 lines (it is 5,340) with no line over 500 characters; prefer adding to existing lines. `node --check` every edited file before running anything (a browser suite timing out at load is a syntax error).
- `npm test` (every program), `npm run check` green at every commit. Browser suites only as `scripts/browser-lock.sh node scripts/browser-test.mjs --<suite>`, one at a time, never while editing `src`.
- Exact values from the spec: `STORY_SETTLE.seconds` 120; the Rotor's price the radial's (`TOWER_BY_KEY.rotor.cost`, 45); `BUILD_BOARD.first.structures` landing 60, foundry 40 (`pays: 60`), solar 120; the words in section 2.B of the spec verbatim; the briefs `scout_material` ("That was the rocket. For the rest we scout: rock, crystals, liquid, biomass." / "The rover goes out once the Stålheart stands.", face 'focused') and `rotor_emergency` ("Contact on the radar and no sentry up." / "Printing the Rotor myself. Get ready.", face 'determined'), both `once: true`, title 'COMMS · ISAO'.
- The settle runs only on an arrival that starts the beats at `landed` (`arrival && startPhase === 'landed' && settle != null`); every chapter, SKIP TUTORIAL and static start keeps today's opening.
- Comments in the house style: the owner's words quoted with the date, the why beside the number.

---

### Task 1: the beats' settle, the tune, the query, the briefs

**Files:**
- Modify: `src/content/story-defaults.js` (after `STORY_BEATS`), `src/domain/story-beats.js`, `src/platform/story-world.js` (`readStoryQuery` only), `src/isaobriefs.js` (after `stalheart_stands`)
- Test: `test/story-beats.mjs` (append), `test/story-beats-salvage.mjs` (append), `test/story-query.mjs` (append)

**Interfaces:**
- Produces: `makeStoryBeats({ ..., settle = null })`; `beats.state()` gains `settle` (seconds or null), `settleLeft` (seconds, null off), `emergency` (bool); the beats call `api.pending?.(socket)` (bool: an order on that cell), `api.shot?.()` (bool: a camera shot plays), `api.gunshipArrive?.()` at `settled` when construction is skipped on a growing base. `readStoryQuery` gains `settle` (number or null) and `first` (bool). `STORY_SETTLE`.

- [ ] **Step 1: the tune.** In `src/content/story-defaults.js`, right after the `STORY_BEATS` block:

```js
// THE SETTLING (owner, 2026-11-08: "we will delay the arrival of the first enemies, first we leave time to settle"; spec
// docs/superpowers/specs/2026-11-08-the-settling-design.md 2.A): on the story's own start (the arrival from `landed`) nothing comes up for
// `seconds` of game time from Isao's deploy; then the tremor, the quiet breach with its head start, the override and the Rotor's seat (the
// gated opening that STORY_BEATS.earlyBreach short-cut since 2026-10-05: the quiet breach at the deploy is a chapter's now). The clock
// is the beats', so the first orders' card (src/fx/first-orders.js) holds it. ?settle=N overrides it (acceptance pages use 10).
export const STORY_SETTLE = Object.freeze({ seconds: 120 });
```

And on `STORY_BEATS`'s comment line above `earlyBreach` add: `earlyBreach: the quiet breach at the deploy; on a settled opening (STORY_SETTLE) it is off`. Keep the `export const STORY_BEATS` text intact (the director board finds it).

- [ ] **Step 2: failing tests.** Append to `test/story-beats.mjs` before its final `console.log` lines (keep the file's helpers `fakeGame`, `run`, `kinds`):

```js
// THE SETTLING (owner, 2026-11-08; spec 2026-11-08-the-settling-design.md 2.A, 2.C, 2.D): on an arrival from `landed` with `settle`, nothing
// comes up until the settle has run out; the Rotor is the player's to order; the emergency order at the settle's end; the tremor waits for the
// shot; the breach's head start; the gunship at `settled` when the Stålheart already stands
{
  const mk = (over = {}) => makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 0, tremorDelay: 0.5, breachDelay: 1, overrideDelay: 0.5, spawnDelay: 0.2, fodderEvery: 1, fodderAlive: 3, fodderTotal: 5, faceDelays: [0, 0], earlyBreach: 0, arrival: true, settle: 20, laneCell: (hops) => 9000 + hops, fodderEmerge: { headStart: { hops: 4, depth: 2 } }, ...over });
  // the player buys the Rotor: ordered from outside the beats, the beats never order it
  {
    const beats = mk(); const g = fakeGame({ printSeconds: 2 }); let pending = false; g.api.pending = () => pending;
    run(beats, g, 1); assert.equal(beats.state().phase, 'landed', 'an arrival holds landed until its cut');
    assert.equal(beats.deploy(g.api), true); run(beats, g, 0.2);
    assert.equal(beats.state().phase, 'printing', 'past foundry with nothing ordered'); assert.deepEqual(kinds(g, 'order'), [], 'the Rotor is not Isao\'s to order');
    assert.deepEqual(kinds(g, 'breach'), [], 'no quiet breach at the deploy'); assert.equal(beats.state().settle, 20); assert.ok(beats.state().settleLeft > 19);
    pending = true; g.api.order('rotor', 4242); pending = false;   // the first orders' pick: the fake's order stamps its clock, built 2 s later
    run(beats, g, 2.5); assert.equal(beats.state().phase, 'rotor-ready', 'the player\'s Rotor ends printing');
    run(beats, g, 10); assert.equal(beats.state().phase, 'rotor-ready', 'no tremor before the settle'); assert.deepEqual(kinds(g, 'tremor'), []); assert.deepEqual(kinds(g, 'spawn'), []);
    assert.ok(beats.state().gateAt !== null, 'the gate stood: the Quiver is on the book'); assert.ok(kinds(g, 'order').some((l) => l[1] === 'quiver'));
    let shot = true; g.api.shot = () => shot;
    run(beats, g, 8); assert.equal(beats.state().phase, 'rotor-ready', 'the settle ran out under a shot: the tremor waits for it'); assert.equal(beats.state().settleLeft, 0);
    shot = false; run(beats, g, 0.2); assert.equal(beats.state().phase, 'tremor'); assert.equal(kinds(g, 'brief').at(-1)[1], 'tremor'); assert.equal(beats.state().emergency, false);
    run(beats, g, 1.1); assert.equal(beats.state().phase, 'breach'); assert.deepEqual(kinds(g, 'breach'), [['breach', 4300]]);
    run(beats, g, 0.3); assert.equal(beats.state().phase, 'approach'); assert.equal(kinds(g, 'spawn')[0][3].cell, 9004, 'the settled breach rises with the head start: hops - k % depth up the lane');
    run(beats, g, 3); assert.equal(beats.state().phase, 'override'); run(beats, g, 0.6); assert.equal(beats.state().phase, 'piloting'); assert.deepEqual(kinds(g, 'pilot'), [['pilot', 4242, 4243]]);
  }
  // nobody buys: at the settle's end Isao grants the Rotor's cost once, orders it, says so; the tremor follows once it stands
  {
    const beats = mk({ settle: 3 }); const g = fakeGame({ printSeconds: 1 }); g.api.pending = () => false;
    beats.deploy(g.api); run(beats, g, 2.9); assert.deepEqual(kinds(g, 'order'), [], 'nothing before the settle');
    run(beats, g, 0.2); assert.deepEqual(kinds(g, 'order'), [['order', 'rotor', 4242]]); assert.deepEqual(kinds(g, 'grant'), [['grant', 45]], 'the Rotor\'s cost, once');
    assert.equal(kinds(g, 'brief').at(-1)[1], 'rotor_emergency'); assert.equal(beats.state().emergency, true);
    run(beats, g, 1.1); assert.equal(beats.state().phase, 'rotor-ready'); run(beats, g, 0.6); assert.equal(beats.state().phase, 'tremor', 'the tremor once the emergency Rotor stands');
  }
  // a Rotor on the book (ordered, not standing) at the settle's end is not ordered again
  {
    const beats = mk({ settle: 1 }); const g = fakeGame({ printSeconds: 50 }); g.api.pending = () => true;
    beats.deploy(g.api); run(beats, g, 3); assert.deepEqual(kinds(g, 'order'), [], 'pending: no emergency order'); assert.deepEqual(kinds(g, 'grant'), []); assert.equal(beats.state().emergency, false);
  }
  // an order that fails is retried next tick with no second grant
  {
    const beats = mk({ settle: 1 }); const g = fakeGame(); g.api.pending = () => false; let n = 0; g.api.order = (key, ci) => { g.log.push(['order', key, ci]); n++; return n >= 3; };
    beats.deploy(g.api); run(beats, g, 1.5); assert.equal(kinds(g, 'order').length, 3); assert.equal(kinds(g, 'grant').length, 1, 'granted once');
  }
  // ?settle=0: a settle that has run out from the deploy; no shot: the tremor as soon as the Rotor and the gate stand
  {
    const beats = mk({ settle: 0 }); const g = fakeGame({ printSeconds: 1 }); g.api.pending = () => false;
    beats.deploy(g.api); run(beats, g, 0.2); assert.deepEqual(kinds(g, 'order'), [['order', 'rotor', 4242]], 'the emergency order at once');
    run(beats, g, 1.7); assert.equal(beats.state().phase, 'tremor');
  }
  // the Stålheart standing at the Quiver's clear on a growing base: no construction, the gunship comes on station at `settled`
  {
    const quiver = { key: 'quiver', delay: 0.3, hardcore: 'barbed', secondDelay: 1, studyDelay: 2 };
    const beats = mk({ settle: 0, quiverSocket: 4244, quiver, construction: { first: 1, every: 5, waves: [[{ type: 'amoeba', count: 2 }]] }, fodderTotal: 1, fodderAlive: 1 });
    const g = fakeGame({ printSeconds: 0.5, walk: 0.5 }); g.api.pending = () => false; g.api.stalheartStands = () => true; g.api.gunshipArrive = () => { g.log.push(['gunshipArrive']); };
    beats.deploy(g.api); run(beats, g, 6); assert.equal(beats.state().phase, 'piloting', JSON.stringify(beats.state()));
    g.kill(1); run(beats, g, 1); assert.equal(beats.state().phase, 'quiver-piloting');
    g.kill(1); run(beats, g, 1.5); g.kill(1); run(beats, g, 1);
    assert.equal(beats.state().phase, 'settled', 'the Stålheart stood: no sector 0'); assert.deepEqual(kinds(g, 'gunshipArrive'), [['gunshipArrive']], 'GS01 comes on station at the hand-over');
  }
  // a late start (a chapter) with `settle` keeps today's opening: the Rotor ordered at foundry, the gunship only in construction
  {
    const beats = mk({ settle: 20, startPhase: 'foundry', foundry: null }); const g = fakeGame({ printSeconds: 1 });
    run(beats, g, 0.3); assert.deepEqual(kinds(g, 'order'), [['order', 'rotor', 4242]], 'a chapter orders the Rotor as before'); assert.equal(beats.state().settle, null);
  }
}
```

Note `mk` passes `arrival: true` and the fake's `order` stamps `orderedAt` for `built`; the first block's `g.api.order('rotor', 4242)` stands in for the board's pick (the fake records it: `kinds(g, 'order')` has it, which is why the asserts on "the beats never order" read the log before that call). Adjust the expected `order` logs in that block accordingly if the fake records the pick (it does: `['order', 'rotor', 4242]` once, from the test, not the beats — assert `kinds(g, 'order').length === 1` after the pick and that the beats added none).

Append to `test/story-beats-salvage.mjs` before its `console.log`:

```js
{ // THE SETTLING (2026-11-08, spec 2.B): the whole salvage at the deploy, nothing per barrel; today's drip without `settle`
  const grants = [];
  const b = makeStoryBeats({ foundry: FOUNDRY_TUNE, arrival: true, settle: 120 });
  const api = { grant: (n) => grants.push(n), foundry() {}, brief() {}, order: () => true, cost: () => STOCK, built: () => false, pending: () => false };
  b.salvage({ sections: 3, feedstockPerBarrel: 60, bonus: 1 }); b.deploy(api);
  assert.deepEqual(grants, [240], 'CLEAN: three sections and the bonus barrel, granted at once');
  for (let i = 0; i < 900; i++) b.tick(0.1, api);
  assert.deepEqual(grants, [240], 'the barrels the AFR-01 cuts grant nothing more');
  const w = makeStoryBeats({ foundry: FOUNDRY_TUNE, arrival: true, settle: 120 }); const wg = []; w.salvage({ sections: 2, feedstockPerBarrel: 48, bonus: 0 }); w.deploy({ ...api, grant: (n) => wg.push(n) });
  assert.deepEqual(wg, [96], 'a WRECK: two sections of 48');
  const a = makeStoryBeats({ foundry: FOUNDRY_TUNE, arrival: true, settle: 120 }); const ag = []; a.deploy({ ...api, grant: (n) => ag.push(n) });
  assert.deepEqual(ag, [180], 'an automatic landing: the tune\'s three barrels');
}
```

Append to `test/story-query.mjs` before its `console.log`:

```js
// THE SETTLING (2026-11-08): ?settle=N the settle's seconds (null: the tune's), ?first=1 the first orders on an acceptance page
assert.equal(readStoryQuery('').settle, null); assert.equal(readStoryQuery('?settle=10').settle, 10); assert.equal(readStoryQuery('?settle=0').settle, 0); assert.equal(readStoryQuery('?settle=x').settle, null);
assert.equal(readStoryQuery('').first, false); assert.equal(readStoryQuery('?first=1').first, true);
```

Run `node test/story-beats.mjs`, `node test/story-beats-salvage.mjs`, `node test/story-query.mjs`: each must FAIL (the settle is unknown: the beats order the Rotor, the breach opens at the deploy; `settle` undefined on the query).

- [ ] **Step 3: the beats.** In `src/domain/story-beats.js`:

Signature: add after `foundryCut = null,`:

```js
  settle = null,            // THE SETTLING (owner, 2026-11-08; spec docs/superpowers/specs/2026-11-08-the-settling-design.md): on an arrival from `landed`, seconds from the deploy before the first contact; the Rotor is the player's to order (the first orders), ordered by Isao at the settle's end if nobody did; null: the opening as before
```

After `const early = ...` line (66-67) replace the `early` definition and add:

```js
  // THE SETTLING: only the story's own start settles (a chapter or a jump keeps its flow); the quiet breach at the deploy is off on it
  const settled = settle != null && arrival && startPhase === 'landed';
  const early = arrival && gated && earlyBreach != null && !settled;
  let emergency = false;   // Isao's own Rotor order at the settle's end (its cost granted once)
  const settleOver = () => released && clock - releasedAt >= settle;
```

Header comment: under the `landed` / `foundry` lines add a line: `//   (settled)     with `settle` (STORY_SETTLE): no breach at the deploy; foundry -> printing with nothing ordered (the Rotor is the first orders'); at the settle's end an unordered Rotor is Isao's (rotor_emergency); the tremor waits for the settle, the Rotor, the gate and a quiet camera; the breach rises with the head start`.

The `foundry` branch (line 104) becomes:

```js
      else if (phase === 'foundry') { api.expeditionsBegin?.(); if (settled) enter('printing'); else { if (!fd.barrels) api.grant(api.cost(key)); if (api.order(key, socket)) { enter('printing'); orderedAt = clock; } } }
```

The `landed && !fd` branch (105-108): wrap the grant/order the same way: `if (settled) enter('printing'); else { api.grant(api.cost(key)); if (api.order(key, socket)) { enter('printing'); orderedAt = clock; } }`.

After the `printing && api.built(socket)` branch (109) insert:

```js
      // NO SENTRY UP AT THE SETTLE'S END: Isao prints the Rotor himself (its cost granted once; a Rotor already on the book is left to stand)
      else if (phase === 'printing' && settled && orderedAt === null && settleOver() && !api.pending?.(socket)) { if (!emergency) { emergency = true; api.grant(api.cost(key)); api.brief?.('rotor_emergency'); said.add('rotor_emergency'); } if (api.order(key, socket)) orderedAt = clock; }
```

The tremor branch (112): add the settle's wait: `else if (phase === 'rotor-ready' && clock - Math.max(at, gateAt ?? at) >= (gated ? tremorDelay : controlDelay) && (!settled || (settleOver() && !api.shot?.()))) {`.

The `tremor` → `breach` branch (115): after `api.breach?.(fodder, { quiet: true });` add `if (settled) quiet = true;` with the comment `/* THE SETTLED BREACH RISES UP THE LANE (owner, 2026-10-30: within shooting range): the head start, as the quiet breach's */`.

The `quiver-piloting` clear (139-140): the `else` becomes `else { enter('settled'); api.unlock?.('views'); if (construction && !gunshipCalled) { gunshipCalled = true; api.gunshipArrive?.(); } }` with `let gunshipCalled = false;` declared beside `emergency`, and the comment `// THE STÅLHEART ALREADY STANDS (the settling, spec 2.D): no sector 0, so GS01 comes on station here`. Set `gunshipCalled = true` where construction is entered (the `enter('construction'); api.gunshipArrive?.()` call) too.

`deploy(api)`: `if (fd) { api.foundry?.(deployFoundry(fd), null); enter('foundry'); const n = (settled ? fd.sections.length : 0) + bonusBarrels; if (n > 0) api.grant(perBarrel * n); }` with the comment `// THE ROCKET'S WORTH AT ONCE on a settled opening (spec 2.B: the first orders' budget); else the bonus barrel(s) as before`. Check `test/story-beats-salvage.mjs`'s existing CLEAN case still sees `[60]` (one bonus barrel, one grant) and the WRECK case its 48s.

The barrel event (98): `if (e === 'barrel' && !settled) api.grant(perBarrel);`.

`state()`: add `settle: settled ? settle : null, settleLeft: settled && released ? +Math.max(0, settle - (clock - releasedAt)).toFixed(1) : null, emergency`.

- [ ] **Step 4: the query.** In `readStoryQuery`'s returned object add:

```js
    // THE SETTLING (2026-11-08): ?settle=N the seconds before the first contact on the story's own start (null: STORY_SETTLE's); ?first=1 the first orders' card on an acceptance page (a headless page would wait on it)
    settle: Number.isFinite(parseFloat(q.get('settle') ?? '')) ? Math.max(0, parseFloat(q.get('settle'))) : null,
    first: q.get('first') === '1',
```

- [ ] **Step 5: the briefs.** In `src/isaobriefs.js` after `stalheart_stands`:

```js
  // THE SETTLING (owner, 2026-11-08: "Isao tells the player that we will need to scout for more building material, rocks, crystals, liquid,
  // biomass"): said as the first orders close; and his own Rotor when nobody ordered one by the settle's end
  scout_material: {
    id: 'scout_material', face: 'focused', title: 'COMMS · ISAO', once: true,
    lines: ['That was the rocket. For the rest we scout: rock, crystals, liquid, biomass.', 'The rover goes out once the Stålheart stands.'],
  },
  rotor_emergency: {
    id: 'rotor_emergency', face: 'determined', title: 'COMMS · ISAO', once: true,
    lines: ['Contact on the radar and no sentry up.', 'Printing the Rotor myself. Get ready.'],
  },
```

- [ ] **Step 6:** `node --check` the four files; `node test/story-beats.mjs test/story-beats-salvage.mjs test/story-query.mjs` (run each) PASS; `npm test` all green (`test/director-board.mjs` reads `export const STORY_BEATS`: keep it); `npm run check`.

- [ ] **Step 7: Commit** "THE SETTLING's beats (spec 2.A, 2.C, 2.D): a `settle` on the story's own start: no quiet breach at the deploy, the Rotor left to the first orders, Isao's emergency Rotor at the settle's end, the tremor waiting for the settle, the gate, the Rotor and a quiet camera, the settled breach up the lane, the whole salvage granted at the deploy, GS01 on station at `settled` when the Stålheart already stands; STORY_SETTLE 120 s, ?settle=N and ?first=1, Isao's two lines" + the trailer.

---

### Task 2: the first steps, the first prices, `firstOffers`, the chapter's purchases, `pays`

**Files:**
- Modify: `src/content/base-programme.js` (gate, stalheart, landing, foundry, solar steps and comments), `src/content/build-board.js` (`first`), `src/domain/build-board.js` (`firstOffers`), `src/domain/build-programme.js` (`snapshot.next`), `src/fx/story-entry.js` (a chapter buys the first steps), `src/fx/programme-host.js` (`printed`: `pays`)
- Test: `test/base-programme.mjs` (append), `test/build-board.mjs` (`BOARD_STEPS`, `firstOffers` block), `test/build-programme.mjs` (append)

**Interfaces:**
- Produces: `firstOffers(w, tune)` in `src/domain/build-board.js`: `w = { steps, done, bought, rotor: { key, name, cost } | null, rotorCell, rotorBuilt, rotorPending }` → `[{ id: 'sentry:rotor', kind: 'sentry', key: 'rotor', site: rotorCell, label, price, effect }, { id: 'build:<step>', kind: 'structure', step, label, price, effect }...]`; `BUILD_BOARD.first.{structures, words}`; steps with `first: true` and `foundry.pays`; the programme host's `c.grant(n)` (Task 3 wires it).

- [ ] **Step 1: failing tests.** In `test/build-board.mjs`: change `BOARD_STEPS` to `const FIRST_STEPS = ['landing', 'foundry', 'solar'];   // THE SETTLING (2026-11-08): the opening's steps, bought at the first orders` and `const BOARD_STEPS = [...FIRST_STEPS, ...COLONY_STEPS, ...DOME_STEPS];`; the first block's two assertions become `'the three first steps, the seven colony structures, then the six domes'` and `CLASSIC.filter(board)` → `[...FIRST_STEPS, ...COLONY_STEPS]`; the price loop runs over `[...COLONY_STEPS, ...DOME_STEPS]` and adds `for (const id of FIRST_STEPS) { assert.ok(BUILD_BOARD.first.structures[id]?.price > 0 && BUILD_BOARD.first.structures[id].effect, `${id}: a first price and an effect`); assert.equal(BUILD_BOARD.structures[id], undefined, `${id}: never on a sector board`); }`. The `world()` helper's `done: new Set()` must become `done: new Set(FIRST_STEPS)` so the sector-board cases are unchanged (the first steps stand on a skipped run), and the spine assertion `/build:(gate|stalheart|landing|foundry|solar|...)/` stays. Import `firstOffers` and add before the final `console.log`:

```js
// THE FIRST ORDERS (2026-11-08, THE SETTLING, spec 2.B): the Rotor on its own socket at the radial's price, then the three first steps at their prices; no Rotor card once it stands or is on the book; a bought or standing step is not offered; the pick of two within the salvage
{
  const rotor = { key: 'rotor', name: 'Rotor', cost: 45 };
  const fw = (over = {}) => ({ steps: CLASSIC, done: new Set(), bought: new Set(), rotor, rotorCell: 77, rotorBuilt: false, rotorPending: false, ...over });
  const all = firstOffers(fw(), BUILD_BOARD);
  assert.deepEqual(all.map((o) => o.id), ['sentry:rotor', 'build:landing', 'build:foundry', 'build:solar']);
  assert.deepEqual(all[0], { id: 'sentry:rotor', kind: 'sentry', key: 'rotor', site: 77, label: 'ROTOR', price: 45, effect: BUILD_BOARD.first.words.rotor });
  assert.deepEqual(all.slice(1).map((o) => [o.step, o.price]), [['landing', 60], ['foundry', 40], ['solar', 120]], 'the salvage\'s scale, no index');
  assert.deepEqual(firstOffers(fw({ rotorBuilt: true }), BUILD_BOARD).map((o) => o.id), ['build:landing', 'build:foundry', 'build:solar'], 'a standing Rotor is not a card');
  assert.ok(!firstOffers(fw({ rotorPending: true }), BUILD_BOARD).some((o) => o.id === 'sentry:rotor'), 'nor one on the book');
  assert.ok(!firstOffers(fw({ rotor: null }), BUILD_BOARD).some((o) => o.kind === 'sentry'), 'no Rotor kind, no card');
  assert.deepEqual(firstOffers(fw({ bought: new Set(['landing']), done: new Set(['solar']) }), BUILD_BOARD).map((o) => o.id), ['sentry:rotor', 'build:foundry']);
  assert.equal(pickable(all, [], 'build:solar', 96), false, 'a WRECK (96 kg) cannot buy the array'); assert.deepEqual(toggle(all, ['sentry:rotor'], 'build:foundry', 96), ['sentry:rotor', 'build:foundry'], 'the Rotor and the foundry\'s work fit');
  assert.deepEqual(toggle(all, ['sentry:rotor'], 'build:solar', 240), ['sentry:rotor', 'build:solar'], 'CLEAN buys the Rotor and the array');
  assert.deepEqual(toggle(all, ['sentry:rotor', 'build:solar'], 'build:landing', 240), ['sentry:rotor', 'build:solar'], 'two picks');
}
```

In `test/base-programme.mjs` append before its `console.log`:

```js
// THE SETTLING (2026-11-08, spec 2.B, 2.C): the gate and the Stålheart print from the deploy; the pad, the recycler's work and the array are the first
// orders' steps, printed as bought, the recycler's work paying a barrel
{
  const by = Object.fromEntries(BASE_PROGRAMME.map((s) => [s.id, s]));
  assert.deepEqual(by.gate.when, { phase: 'foundry' }); assert.deepEqual(by.stalheart.when, { phase: 'foundry' });
  for (const id of ['landing', 'foundry', 'solar']) { assert.equal(by[id].board, true, `${id} on the board`); assert.equal(by[id].first, true, `${id} a first order`); assert.deepEqual(by[id].when, { phase: 'foundry' }, `${id} prints as bought`); }
  assert.equal(by.foundry.pays, 60, 'Isao\'s work on the AFR-01 pays a barrel'); assert.equal(by.landing.pays, undefined); assert.equal(by.solar.perk, 'station');
  assert.deepEqual(BASE_PROGRAMME.filter((s) => s.first).map((s) => s.id), ['landing', 'foundry', 'solar'], 'the three, in the programme\'s order');
}
```

In `test/build-programme.mjs` append before its `console.log`:

```js
// a board step nobody bought is not `next` (2026-11-08: the first orders' steps sit before the spine's later prints)
{
  const steps = [{ id: 'a', islands: [], structures: [], when: {} }, { id: 'b', islands: [], structures: [], board: true, when: {} }, { id: 'c', islands: [], structures: [], when: {} }];
  const st = makeBuildProgramme(steps); finish(st, steps[0]);
  assert.equal(snapshot(st).next, 'c', 'the unbought board step is passed over'); buy(st, 'b'); assert.equal(snapshot(st).next, 'b', 'bought, it is next');
}
```

(Check the file's imports cover `makeBuildProgramme`, `finish`, `buy`, `snapshot`; add what is missing.) Run the three tests: FAIL.

- [ ] **Step 2: the programme.** In `src/content/base-programme.js`: `gate`'s `when` → `{ phase: 'foundry' }`, `stalheart`'s → `{ phase: 'foundry' }`; the three steps become:

```js
  // THE FIRST ORDERS (owner, 2026-11-08, THE SETTLING: "the player chooses what to build first with limited building material, the Stalheart being
  // non-negotiable"; spec docs/superpowers/specs/2026-11-08-the-settling-design.md 2.B): the pad, Isao's work on the recycler and the array are bought
  // once, on the build board at the landing (src/content/build-board.js first; src/fx/first-orders.js), out of the rocket's salvage, and print as
  // bought from the deploy (`when: foundry`), after the gate and the Stålheart in Isao's queue. Not bought is not built: no sector board carries them;
  // a skipped opening (jumpBought) and a chapter (src/fx/story-entry.js) buy them. `pays`: the recycler's work cuts one more barrel's worth (the host grants it when the step stands)
  { id: 'landing', label: 'landing pad', islands: ['landing'], board: true, first: true, when: { phase: 'foundry' }, seconds: 4, metres: 2, brief: 'build_landing', perk: null },
  { id: 'foundry', label: 'seed foundry', over: 'foundry', plot: [8, 6], board: true, first: true, pays: 60, when: { phase: 'foundry' }, seconds: 4, metres: 6, brief: 'build_foundry', perk: null },
  { id: 'solar', label: 'solar array', islands: ['solar'], structures: ['solar'], board: true, first: true, when: { phase: 'foundry' }, seconds: 14, metres: 8, brief: 'build_solar', perk: 'station' },
```

Rewrite the comments above `gate` and `stalheart` to say: the gate prints from the deploy (the Rotor no longer gates it: it is the first orders'), then the Stålheart, non-negotiable, from the deploy (2026-11-08; until then both waited on `rotor-ready`); keep the owner quotes already there. Keep the `BASE_PROGRAMME` export text (the director board finds `export const`s by name: run `node test/director-board.mjs`).

- [ ] **Step 3: the prices and words.** In `src/content/build-board.js` inside `BUILD_BOARD`, after `pet`:

```js
  // THE FIRST ORDERS (owner, 2026-11-08, THE SETTLING; spec docs/superpowers/specs/2026-11-08-the-settling-design.md 2.B): the board once at the landing, over
  // the paused game when the landers' tour ends (src/fx/first-orders.js): the Rotor at the radial's price (45) on the plan's own socket and the opening's
  // three `first` steps (src/content/base-programme.js) priced in the salvage's scale: the deploy grants the whole rocket, 180 kg after an automatic or
  // HARD landing, 240 after CLEAN, 96 after a WRECK, so a WRECK buys the Rotor and the foundry's work, CLEAN the Rotor and the array. Never index-scaled,
  // never on a sector board (BUILD_BOARD.structures has no entry for them): not bought is not built. The recycler's work pays its barrel back (`pays`)
  first: Object.freeze({
    structures: Object.freeze({
      landing: Object.freeze({ price: 60, effect: 'a landing pad on the SH02\'s ground' }),
      foundry: Object.freeze({ price: 40, effect: 'Isao works the AFR-01: one more barrel, +60 kg' }),
      solar: Object.freeze({ price: 120, effect: 'the array: the hull\'s shield charges on its island' }),
    }),
    words: Object.freeze({ title: 'THE FIRST ORDERS', line: 'The rocket is all we have. The Stålheart I print whatever you choose. Two more things: choose.', rotor: 'the first sentry, on the wall beside the mouth' }),
  }),
```

- [ ] **Step 4: the rules.** In `src/domain/build-board.js` add to the header comment `//   firstOffers(w, tune) -> the first orders' pool (2026-11-08): the Rotor on w.rotorCell at the radial's price unless it stands or is on the book, then the steps marked `first` not standing and not bought at tune.first.structures' prices` and after `boardOffers`:

```js
// THE FIRST ORDERS (owner, 2026-11-08, THE SETTLING; spec 2026-11-08-the-settling-design.md 2.B): the board's pool at the landing. `w.rotor` is the
// Rotor's kind ({ key, name, cost }, the radial's price) or null, `w.rotorCell` the plan's socket (the card orders there, not on the emptiest lane),
// `w.rotorBuilt` / `w.rotorPending` whether it stands or is on the book. The steps come in the programme's order; the prices are the salvage's scale, no index
export function firstOffers(w, tune) {
  const out = [];
  if (w.rotor && (w.rotorCell ?? -1) >= 0 && !w.rotorBuilt && !w.rotorPending) out.push({ id: `sentry:${w.rotor.key}`, kind: 'sentry', key: w.rotor.key, site: w.rotorCell, label: String(w.rotor.name).toUpperCase(), price: w.rotor.cost, effect: tune.first.words.rotor });
  for (const s of (w.steps ?? []).filter((s) => s.first && !w.done.has(s.id) && !w.bought.has(s.id) && tune.first.structures[s.id])) out.push({ id: `build:${s.id}`, kind: 'structure', step: s.id, label: String(s.label).toUpperCase(), price: tune.first.structures[s.id].price, effect: tune.first.structures[s.id].effect });
  return out.slice(0, tune.offers);
}
```

In `src/domain/build-programme.js` `snapshot`: `next: st.steps.find((s) => !st.done.has(s.id) && (!s.board || st.bought.has(s.id)))?.id ?? null` with the comment `// next: a board step nobody bought is not next (2026-11-08)`.

- [ ] **Step 5: the chapter buys the first steps; the host pays.** In `src/fx/story-entry.js` after `const ch = story.chapter; if (!ch) return;` add:

```js
  // THE FIRST ORDERS (2026-11-08, THE SETTLING): a chapter starts after them, so it stands in for the player's picks: the three first steps bought (printed at their turn, as before 2026-11-08)
  for (const s of story.programme.steps) if (s.first) buy(story.programme, s.id);
```

(And the header comment's chapter paragraph: one line saying so.) In `src/fx/programme-host.js` `printed(step)` after `programmeFinish(...)`: `if (step.pays > 0) c.grant?.(step.pays);   // THE RECYCLER'S WORK PAYS (2026-11-08, the first orders): one more barrel's worth` and add `grant(n)` to the header's list of `c`'s values.

- [ ] **Step 6:** `node --check` the six files; the three tests PASS; `npm test` green (`test/director-board.mjs`, `test/build-board.mjs`'s interlude cases: the `world()` change keeps them); `npm run check`.

- [ ] **Step 7: Commit** "THE FIRST ORDERS' content and rules (spec 2.B, 2.C): the gate and the Stålheart from the deploy; the pad, the recycler's work (pays 60) and the array as `first` board steps at 60 / 40 / 120 in BUILD_BOARD.first, never on a sector board; firstOffers (the Rotor on its own socket at 45); a chapter buys the three; an unbought board step is not `next`" + the trailer.

---

### Task 3: the card's `first(go)`, the first-orders host, the wiring

**Files:**
- Create: `src/fx/first-orders.js`
- Modify: `src/fx/build-board.js`, `src/td-tab.js` (import line 97, the `order:` line ~4502, the `gunshipArrive` line ~4752, one new line after `const buildBoard = createBuildBoard({...})` ~4667, `createProgrammeHost({` ~4688 one value, `storyApi.build` ~4771 one call, `buildGameWorld({` ~2368 one field), `src/platform/story-world.js` (`buildGameWorld`'s signature and the `makeStoryBeats` call)
- Test: `test/first-orders.mjs` (new), `test/build-board.mjs` (append a `first(go)` case in the style of its `interlude` case)

**Interfaces:**
- Consumes: `firstOffers`, `BUILD_BOARD.first`, `beats.state().settle / .socket`, `readStoryQuery().settle / .first`.
- Produces: `createBuildBoard(c).first(go) -> bool` (the card up with the first pool and words; `state().first`, `state().n === 'first'`, the history row `n: 'first'`); `createFirstOrders({ board, story, touring, pause, brief, acceptance, wanted }) -> { tick(), state() }`; `storyApi.pending(ci)`, `storyApi.shot()`; the beats built with `settle`.

- [ ] **Step 1: failing tests.** Create `test/first-orders.mjs`:

```js
// THE FIRST ORDERS' HOST (2026-11-08, THE SETTLING, spec 2.B): the board opened once, over the paused game, when the beats are past `landed`, the
// story runs a settle and the landers' tour is over; Isao's scouting line as it closes; never on a story without a settle; on an acceptance page only when asked
import assert from 'node:assert/strict';
import { createFirstOrders } from '../src/fx/first-orders.js';

function rig({ settle = 120, phase = 'printing', touring = false, acceptance = false, wanted = false, offers = true } = {}) {
  const log = []; let go = null;
  const story = { beats: { state: () => ({ settle, phase }) } };
  const board = { first: (g) => { log.push('first'); go = g; return offers; } };
  const fo = createFirstOrders({ board, story: () => story, touring: () => touring, pause: (v) => log.push(['pause', v]), brief: (id) => log.push(['brief', id]), acceptance, wanted });
  return { fo, log, close: () => go?.(), story, set: (k, v) => { if (k === 'touring') touring = v; } };
}
{ const r = rig(); r.fo.tick(); assert.deepEqual(r.log, [['pause', true], 'first'], 'paused, then the card'); assert.deepEqual(r.fo.state(), { shown: true, open: true });
  r.fo.tick(); assert.equal(r.log.length, 2, 'once'); r.close(); assert.deepEqual(r.log.slice(2), [['pause', false], ['brief', 'scout_material']], 'unpaused, the scouting line'); assert.equal(r.fo.state().open, false); }
{ const r = rig({ phase: 'landed' }); r.fo.tick(); assert.deepEqual(r.log, [], 'not before the deploy'); }
{ const r = rig({ touring: true }); r.fo.tick(); assert.deepEqual(r.log, [], 'not during the landers\' tour'); r.set('touring', false); r.fo.tick(); assert.equal(r.log[1], 'first'); }
{ const r = rig({ settle: null }); r.fo.tick(); assert.deepEqual(r.log, [], 'no settle, no first orders'); }
{ const r = rig({ acceptance: true }); r.fo.tick(); assert.deepEqual(r.log, [], 'an acceptance page passes it by'); }
{ const r = rig({ acceptance: true, wanted: true }); r.fo.tick(); assert.equal(r.log[1], 'first', 'unless it asks'); }
{ const r = rig({ offers: false }); r.fo.tick(); assert.deepEqual(r.log, [['pause', true], 'first', ['pause', false], ['brief', 'scout_material']], 'nothing to offer: straight on, the line said'); }
console.log('First orders: once after the tour over the paused game, the scouting line as it closes.');
```

In `test/build-board.mjs`, next to the `interlude` case (it builds a `bb` with a DOM shim and a `go` counter: reuse them), add:

```js
  // THE FIRST ORDERS (2026-11-08): first(go) shows the first pool with its words and orders the Rotor on its own socket
  {
    const ordered = []; const c2 = { ...cfg, orderTower: (key, ci) => { ordered.push([key, ci]); return true; }, story: () => ({ ...cfg.story(), beats: { state: () => ({ socket: 77 }) } }) };
    const bb2 = createBuildBoard(c2); let went2 = 0;
    assert.equal(bb2.first(() => went2++), true); assert.equal(bb2.state().first, true); assert.equal(bb2.state().n, 'first');
    assert.deepEqual(bb2.state().offers.map((o) => o.id), ['sentry:rotor', 'build:landing', 'build:foundry', 'build:solar']);
    assert.equal(document.querySelector('.bb-title').textContent, 'THE FIRST ORDERS');
    bb2.test.toggle('sentry:rotor'); bb2.test.toggle('build:foundry'); bb2.test.confirm();
    assert.deepEqual(ordered, [['rotor', 77]], 'the Rotor on the plan\'s socket'); assert.ok(bb2.state().bought.includes('foundry')); assert.equal(went2, 1); assert.equal(bb2.state().last.n, 'first'); assert.equal(bb2.state().first, false);
  }
```

(Name `cfg`, `document` and the bank as the existing `interlude` case names them: read that case first and match it: its `eco` must hold at least 85 kg and its `steps` must be `BASE_PROGRAMME` so the first steps exist; its `towers()` empty and `orders` empty so the Rotor is offered.) Run both: FAIL (`first` undefined; module missing).

- [ ] **Step 2: the card.** In `src/fx/build-board.js`: import `firstOffers`; `world(n)` adds to `w`: `rotor: TOWER_BY_KEY.rotor ? { key: 'rotor', name: TOWER_BY_KEY.rotor.name, cost: TOWER_BY_KEY.rotor.cost } : null, rotorCell, rotorBuilt: c.towers().some((t) => t.ci === rotorCell), rotorPending: c.orders.some((o) => o.ci === rotorCell)` where `const rotorCell = s.beats?.state?.().socket ?? -1;`. `show(n, go, { pool = (w) => boardOffers(w, BUILD_BOARD), words = W } = {})`: `offers = pool(w)`, the head's title and line from `words.title ?? W.title` / `words.line ?? W.line`. `apply`: `if (o.kind === 'sentry') { const ci = o.site ?? site(); return ci >= 0 && c.orderTower(o.key, ci, { quiet: true }); }`. Add to the returned object:

```js
    // THE FIRST ORDERS (2026-11-08, THE SETTLING, spec 2.B): the card once at the landing with the first pool and words (src/fx/first-orders.js opens it)
    first: (go) => !card && !!c.story()?.programme && show('first', go, { pool: (w) => firstOffers(w, BUILD_BOARD), words: BUILD_BOARD.first.words }),
```

`state()` adds `first: open?.n === 'first'`. Update the header comment (`first(go)`, the pool). `card.dataset.sector = String(n)` is fine with `'first'`.

- [ ] **Step 3: the host.** Create `src/fx/first-orders.js`:

```js
// THE FIRST ORDERS (owner, 2026-11-08, THE SETTLING: "the player chooses what to build first with limited building material, the Stalheart being
// non-negotiable"; spec docs/superpowers/specs/2026-11-08-the-settling-design.md 2.B): the build board opened ONCE, over the paused game, when the
// beats are past `landed` on an opening that runs a settle and the landers' tour is over; the game unpauses and Isao says the rest must be scouted
// (scout_material) when it closes. A headless page would wait on the card for ever, so an acceptance run passes it by unless it asks (?first=1).
//   createFirstOrders({ board, story, touring, pause, brief, acceptance, wanted }) -> { tick(), state() }
//   board.first(go) the card (src/fx/build-board.js); story() the story (its beats' state: settle, phase); touring() the landers' tour or the
//   arrival still playing; pause(v); brief(id); acceptance / wanted: the page's ?acceptance=1 and ?first=1
export function createFirstOrders({ board, story, touring, pause, brief, acceptance = false, wanted = false }) {
  let shown = false, open = false;
  return {
    tick() {
      if (shown || (acceptance && !wanted)) return;
      const st = story()?.beats?.state?.();
      if (!st || st.settle == null || st.phase === 'landed' || touring()) return;
      shown = true; open = true; pause(true);
      const go = () => { open = false; pause(false); brief('scout_material'); };
      if (!board.first(go)) go();
    },
    state: () => ({ shown, open }),
  };
}
```

- [ ] **Step 4: the wiring.** `src/platform/story-world.js`: `buildGameWorld({ ..., arena = null, settle = null })` and in the `makeStoryBeats({...})` call add `settle: arrives ? settle : null` (the query's seconds; the caller passes `readStoryQuery().settle ?? STORY_SETTLE.seconds`; import `STORY_SETTLE` and do the `??` here: `settle: arrives ? (settle ?? STORY_SETTLE.seconds) : null`). `src/td-tab.js`:
  - line 97's import list: add `import { createFirstOrders } from './fx/first-orders.js';` on that same line.
  - the `buildGameWorld({ ... arena: ... })` call (~2368): add `settle: storyQuery.settle` (the field exists on the object `readStoryQuery` returns).
  - the `order: (key, ci) => orderTower(key, ci, { quiet: true }),` line: append `pending: (ci) => orderByCell.has(ci),   /* an order on that cell (the beats' emergency Rotor, 2026-11-08) */`.
  - the `gunshipArrive: ... drone: () => isao,` line: append `shot: shotActive,   /* a camera shot plays: the settled tremor waits (2026-11-08) */`.
  - after `const buildBoard = createBuildBoard({...});` (find its closing `});`), one new line: `const firstOrders = createFirstOrders({ board: buildBoard, story: () => story, touring: () => storyApi.touring(), pause: (v) => { paused = !!v; }, brief: (id) => showBrief(id), acceptance: flags.acceptance === '1', wanted: storyQuery.first });   // THE FIRST ORDERS (2026-11-08, THE SETTLING; src/fx/first-orders.js)`. Check `flags.acceptance` is how the page's `?acceptance=1` reads (`readGameFlags`, `src/platform/game-flags.js`; if it is a boolean use it as is).
  - `createProgrammeHost({` block: add `grant: (n) => eco.addBiomass(n, { category: 'grant' }),` on the `orders,` line (`orders, grant: ...,`).
  - `storyApi.build`: after `const f = colonyTick.open();` add `firstOrders.tick();` on the same line.
  - `firstOrders` must be declared before the `Object.assign(storyApi, {... build ...})` block that references it (it is: the board is created at ~4667, the block at ~4765); if `storyApi.touring` is defined in that later block, the arrow `() => storyApi.touring()` is lazy and fine.

- [ ] **Step 5:** `node --check` every edited file; `wc -l src/td-tab.js` ≤ 5,450 and `awk 'length > 500' src/td-tab.js | wc -l` is 0 (the ratchet in `npm run check` says the current count: do not raise it); `node test/first-orders.mjs`, `node test/build-board.mjs` PASS; `npm test`; `npm run check`.

- [ ] **Step 6: Commit** "THE FIRST ORDERS on the board (spec 2.B): first(go) with the first pool and words, the Rotor ordered on the plan's own socket; src/fx/first-orders.js opens it once after the landers' tour over the paused game and says scout_material as it closes (an acceptance page only with ?first=1); the controller's pending(ci), shot(), the host's grant for `pays`, the settle to the beats" + the trailer.

---

### Task 4: the browser suites, STATE, the entry

**Files:**
- Modify: `scripts/browser-test.mjs` (a new `--settling` suite before `--landing`'s block; `--grow`'s opening; `--opening-cuts`'s URL), `docs/STATE.md`, `docs/superpowers/specs/2026-11-07-landing-mini-game-design.md` (a section 16 pointer), a new entry under `docs/log/entries/`, `DEVLOG.md` via render
- Test: the suites themselves

- [ ] **Step 1: `--settling`.** Insert a new block `} else if(args.includes('--settling')) {` before `} else if(args.includes('--landing')) {`. Write it in the file's idiom (`go`, `until`, `evaluate`, `assert`, `current=...; await finish()`, `delay`); `T='window.__stalheartTest'`. Page 1 (`index.html?sw=0&acceptance=1&cine=0&world=story&stage=1&grow=1&settle=12&first=1#td`):
  1. `until(!!T)`; read `b0 = state().biomass` at once (before the arrival deploys; log it).
  2. `until(state().story.phase !== 'landed', 90000)` (the deploy), then `until(state().board?.open === true && state().board.first === true, 60000)` (the tour over: the first orders). Assert: `state().paused === true` if the harness exposes `paused` (else skip with a comment), `board.offers.map(o => o.id)` deepEqual `['sentry:rotor','build:landing','build:foundry','build:solar']`, their prices `[45, 60, 40, 120]`, `board.bank === b0 + 180` ("the whole salvage at the deploy: an automatic landing's three barrels"), `state().enemiesAlive === 0`, `state().story.phase === 'printing'`, `state().towers === 0`, `state().story.said` does not include `tremor`. Still `settling-board`.
  3. `board.toggle('sentry:rotor')`, `board.toggle('build:foundry')`, `board.confirm()`; `until(!state().board.open)`; assert `state().biomass === b0 + 180 - 85`, `state().board.bought` includes `foundry`, `state().board.last.n === 'first'`, `state().board.last.took` deepEqual the two ids; `until` the brief panel shows "That was the rocket" (`document.querySelector('#td-brief:not(.hidden) #td-brief-line')?.textContent` — or `JSON.parse(localStorage.getItem("stalheart:v1:td.briefs")||"[]")` includes `scout_material`, the way `--grow` reads said briefs), 10 s.
  4. `until(state().programme.printed.includes('gate'), 60000)`; `until(state().towers === 1, 60000)` 'the bought Rotor, Isao\'s next job'; assert `state().story.emergency === false`, `state().story.said` lacks `rotor_emergency`.
  5. `until(state().programme.active === 'stalheart', 60000)`; assert `state().hull.state === 'held'`; still `settling-stalheart`.
  6. `until(state().story.said.includes('tremor'), 60000)`; then `until(/^(override|piloting)$/.test(state().story.phase), 60000)`; `until(seatState().seatKey === 'rotor', 30000)`; assert `state().story.spawned > 0`; still `settling-seat`. Log the game clock of the tremor against the deploy if `state().story.clock` is readable.
  7. Later (optional, cheap): `until(state().programme.printed.includes('foundry'), 150000)` then assert `state().biomass` rose by 60 over the reading just before it (read `biomass` when `programme.active === 'foundry'` and again when printed): 'the recycler\'s work pays its barrel'. Wrap in a `try` that logs rather than fails if the Stålheart's print puts it past the budget of the step; prefer asserting it.
  Page 2 (`...&settle=8&first=1#td`): `until(board.open && board.first)`; `board.skip()`; `until(!board.open)`; assert `board.last.took` deepEqual `[]`, `state().towers === 0`; `until(state().story.emergency === true, 60000)` 'nobody ordered: Isao\'s Rotor at the settle\'s end'; assert `state().story.said` includes `rotor_emergency`; `until(state().towers === 1, 60000)`; `until(state().story.said.includes('tremor'), 60000)`; still `settling-emergency`.
  Add `--settling` to the suite list in `docs/STATE.md`'s Evidence paragraph and to `scripts/browser-test.mjs`'s own usage/list if it keeps one (grep `--landing` to see where suites are listed).

- [ ] **Step 2: `--grow`'s opening.** The `grow-landing` URL gets `&settle=10`. After the arrival's checks and `await mark('landed ...')`, replace the block from `await until('window.__stalheartTest.state().towers===1',120000);await mark('Rotor printed');` through the gate-stands block and the "STRAIGHT TO THE ACTION" comment + `first fodder` / `no tremor` asserts with the settled order:
  1. `until(programme.active==="gate", 60000)`; mark 'gate print begins'; assert `story.phase === 'printing'` ('the gate prints from the deploy; the Rotor is the first orders\'', 2026-11-08), `programme.gate.built === false`, the walls as before, the print under way; still `grow-gate-printing`.
  2. `until(programme.printed.includes("gate"), 90000)`; mark; the walls/gateAt asserts as before (`gateAt` is set in `rotor-ready`: assert it only after the Rotor stands; move that assert down).
  3. `until(towers===1, 90000)`; mark 'Rotor printed (Isao\'s emergency: no first orders on an acceptance page)'; assert `story.emergency === true`, `story.said.includes('rotor_emergency')`, `story.phase === 'rotor-ready'`, `story.gateAt !== null`.
  4. The Quiver `until` stays. Then `until(story.said.includes("tremor"), 60000)`; mark 'the tremor (the settled opening: a tremor, not the quiet breach at the deploy)'; `until(story.spawned>0, 40000)`; mark 'first fodder'.
  5. The Stålheart-print-begins block stays, but its assert `!printed.includes('landing')` becomes `'the pad is a first order, not bought on this page'` and keep `hull.state === 'held'`; the Stålheart may begin BEFORE the tremor (Isao's queue: gate, Rotor, Stålheart): wait for it with `until` placed before step 4's tremor wait if the order of the marks requires; use `until` conditions that do not assume order (each `until` waits for its own fact).
  6. After the study/expedition checks: replace `until(printed.includes("landing"))`, `until(active==="solar")` + `shotBase('grow-solar-rising')`, `until(printed.includes("solar"))` and the `perks.includes('station')` / `next === 'bays'` block with: `{const s=...;assert(!s.programme.printed.includes('landing')&&!s.programme.printed.includes('solar'),'the first orders were not taken on this page: no pad, no array (2026-11-08)');assert(!s.programme.perks.includes('station'));assert.equal(s.programme.next,'bays','an unbought first step is not next');}`. The `gunship_overhead` said-check at `settled` holds either way now (construction, or GS01 at `settled`).
  Everything after (bays, HUGIN, ...) unchanged.

- [ ] **Step 3: other pages.** `--opening-cuts`'s URL → `index.html?sw=0&acceptance=1&world=story&settle=10#td`. Grep `grow=1` and `story=0` pages (`phone-opening`, `chapters-landing*`, `skip-tutorial-offer`, `grow-story-zero`) and the `--opening` pages: none waits for the Rotor or the first wave, so leave them; if one does, add `&settle=10`.

- [ ] **Step 4: run.** `node --check scripts/browser-test.mjs`. Then, one at a time through the lock: `--settling` (new; paste its PASS lines and the stills' names), `--grow` (long: ~15 min; it was red on the base at "Isao said gunship_overhead" per STATE: it should be green now; if red elsewhere, report the step and whether it is this branch's), `--opening-cuts`, `--landing`, `--board`, `--story-world`. Record each result (PASS lines or the failing assertion) in the report. Fix what is this branch's; what is red on the base too is reported, not fixed (check with the same suite on `~/Dev/stalheart` at 39f98d63 only if a failure looks unrelated).

- [ ] **Step 5: STATE, the spec pointer, the entry.** `docs/STATE.md`: a new section `## What landed on 2026-11-08 (THE SETTLING: time to settle, the first orders, the first contact on a clock)` above the 2026-11-07 landing section, in the house style (one dense paragraph: what the player sees in order with the numbers, the modules, the suite, the owner's open calls from the spec's section 5, sector 0's consequence); prefix line 3's `Updated` list with `2026-11-08 (THE SETTLING on branch `the-settling`, unmerged, spec `docs/superpowers/specs/2026-11-08-the-settling-design.md`: ...; below)`; add `--settling` to the Evidence list. The landing spec: append `## 16. The settling (2026-11-08)` with two lines pointing to the new spec and saying what changed after the landing (no quiet breach at the deploy; the first orders; the settle). The entry: write `docs/log/entries/2026-11-08-the-settling-time-to-settle-the-first-orders-the-first-contact-on-a-clock.json` (schema 1, type 'change', status 'accepted', the owner's words in `context`, `outcome` with the numbers and what the suites showed, `alternatives` (the first choice as a new card; the enemies tied to the scouting; the Stålheart waiting for the Rotor as before; the salvage dripping per barrel with the board at the last barrel), `evidence` (the suites' PASS lines, `npm test` count), `supersedes: []`), then `node scripts/log.mjs add <file>`, `node scripts/log.mjs render`, `node scripts/log.mjs check`; `npm run check`.

- [ ] **Step 6: Commit** "THE SETTLING's suite and record: --settling (the first orders over the paused game after the tour, the Rotor and the recycler's work bought out of 180 kg, the scouting line, the Stålheart printing first, the tremor at the settle, the emergency Rotor on a skipped card), --grow's opening on the settled order, --opening-cuts settled; STATE, the landing spec's pointer, the log entry" + the trailer.
