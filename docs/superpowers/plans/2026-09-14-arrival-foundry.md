# Arrival Foundry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AFR-01 seed foundry recycles the landed SH02 into the feedstock the opening prints from: a `foundry` beat between `landed` and `printing`, barrels replacing the conjured grants, three sections consumed, the legs kept, automatic, 16 s then 24 s per barrel.

**Architecture:** A pure foundry clock in `src/domain/foundry.js` with tunables in `src/content/foundry.js`, owned and stepped by `story-beats.js`, which forwards its events through `api.foundry(ev)` and grants on `barrel`. `story-base.js` loads the foundry and the salvage layout as stage-1 landmarks that stay hidden until revealed (or shown outright from stage 2), and hides the intact SH02 from stage 2. `src/fx/foundry-fx.js` turns events into the swap, the clip, the cutter arc, section removal and barrels. `td-tab.js` folds one `storyApi.foundry` hook.

**Tech Stack:** Native ESM, vendored Three.js r160, Node 22 tests.

## Global Constraints

- `src/td-tab.js` budget 17558; no net growth.
- Layers per `npm run architecture`: domain imports no content; fx imports Three.js and content only.
- Assets already pinned: `docs/arrival-foundry-assets.lock.json`.
- Existing `test/story-beats.mjs` keeps passing: without a `foundry` option the beats behave as before.
- Commit trailer as in the gunship plan.

---

### Task 1: The foundry clock (content + domain + test)

**Files:** create `src/content/foundry.js`, `src/domain/foundry.js`, `test/foundry.mjs`.

- `FOUNDRY_TUNE = { deployDelay: 1.5, firstCycle: 16, cycleSeconds: 24, feedstockPerBarrel: 60, sections: ['SH02_SALVAGE_SECTION_01_TANK','SH02_SALVAGE_SECTION_02_CAPSULE','SH02_SALVAGE_SECTION_03_ISAO_MODULE'], events: { arcOn: 2, arcOff: 5.1, scrap: 10, barrel: 15 } }`.
- `makeFoundry(cfg)` → `{ phase: 'stowed', t: 0, cycleAt: -1, sections: [...], barrels: 0, fired: {} }`.
- `deployFoundry(st)` → phase `deploying`, returns `'deploy'`; `stepFoundry(st, dt, cfg)` → events array: after `deployDelay` the first `cycle`; within a cycle `arc-on`, `arc-off`, `scrap` (with the section name), `barrel` at the authored times (each once per cycle); the cycle ends at `firstCycle` seconds (barrels++, section consumed); the next cycle starts `cycleSeconds` after the previous started while sections remain; `spent` once when none remain; nothing after.
- Test: event order and times at 60 Hz; three barrels; `spent` once; a stowed foundry emits nothing; the grant sum is the host's (sections × feedstockPerBarrel is asserted from the state).

### Task 2: The beat

**Files:** modify `src/domain/story-beats.js`, `test/story-beats.mjs`.

- New option `foundry = null` (the tune). With it: phase `landed` → when `faces === 2` and `clock >= rotorDelay`: `api.foundry?.('deploy')`, `deployFoundry`, enter `foundry`. In `foundry`, and every later phase, step the clock and forward events via `api.foundry?.(ev, data)`; on `barrel` call `api.grant(foundry.feedstockPerBarrel)`. In `foundry`, once `barrels >= 1`: `api.order(key, socket)` → `printing`. The Quiver order no longer grants when `foundry` is set.
- `state()` gains `foundry: { phase, barrels, sections }`.
- Test: with `foundry`, the order comes after the first barrel and the only grant before it is one barrel; without `foundry` the old path is unchanged.

### Task 3: Landmarks and the reveal

**Files:** modify `src/content/base-layout.js`, `src/domain/base-plan.js`, `src/fx/story-base.js`, `src/platform/story-world.js`.

- Structures: `foundry` (near lod1, far lod2, clips both, `island: 'landing'`, `stage: 1`, `shown: 2`), `sh02-salvage` (near lod1, far lod2, `stage: 1`, `shown: 2`), and `sh02` gets `until: 2`.
- `planBase`: filter `s.stage <= stage && (s.until == null || stage < s.until)`.
- `story-base`: a holder with `s.shown > plan.stage` starts invisible; `reveal(id)`, `conceal(id)`, `structure(id)` → `{ holder, root: near ?? far, actions }` where mount keeps each tier's clip actions by name.
- story-world passes `foundry: FOUNDRY_TUNE` into `makeStoryBeats`.

### Task 4: The effects and the host

**Files:** create `src/fx/foundry-fx.js`; modify `src/td-tab.js` (folds), `src/isaobriefs.js`.

- `createFoundryFx(scene, base, { cellSide, metresPerCell })` with `event(ev, data)`: `deploy` → conceal `sh02`, reveal `sh02-salvage` and `foundry` (the foundry rises from 0.3 to 1 scale over 1.2 s), Isao line via the host; `cycle` → play `Recycle_Panel_To_Barrel` once (then `Foundry_Process_Cycle` loops between cycles); `arc-on/off` → a jittered blue polyline from `SOCKET_CUTTER_TIP` to the next `SOCKET_SALVAGE_TARGET_0n`; `scrap` → the named section root shrinks to nothing over 1 s; `barrel` → a barrel mesh appears at `SOCKET_BARREL_FILL` and slides to a rack slot beside the foundry; `spent` → the loop stops. `tick(dt)` animates.
- td-tab: `storyApi.foundry = (ev, d) => { (foundryFx ??= createFoundryFx(scene, storyBase, {...})).event(ev, d); if (ev === 'deploy') showBrief('foundry_deploy'); }` folded into the `storyApi` literal; `foundryFx?.tick(dt)` folded beside `story?.beats.tick`; `foundryFx = null` beside `storyBase = built.base`; the test state gains `foundry: story?.beats.state().foundry`.
- Isao: `foundry_deploy`: "The rocket got us here." / "Now it builds the base."

### Task 5: Verification and record

- `npm test`, `npm run check`, `npm run build`; `--story-world` through the Rotor print with the foundry state asserted; the story lab at stage 2 screenshot for art review; deban entry; STATE.
