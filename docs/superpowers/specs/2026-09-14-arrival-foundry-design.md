# AFR-01 Seed Foundry — the arrival recycled

Date: 2026-09-14. Status: **proposed, awaiting the owner's answers to §8.**
Assets: AFR-01 Seed Foundry and the SH02 four-piece salvage layout, pinned in
`docs/arrival-foundry-assets.lock.json` (game and distance tiers, manifests)
from SentryTowers_A6 revision `1759134`.

## The fiction

Isao lands on the SH02, rough. He is out. There is nothing here but the
rocket, the regolith and what he carried. The rocket got him here; now it
builds the base. He deploys the AFR-01 seed foundry from the cargo capsule,
its service arm cuts the SH02 into sections, the induction chamber turns
rocket structure plus local silicate into ferroceramic feedstock, and the
feedstock fills barrels. The barrels are what the printer prints from. The
first barrel pays for the Rotor. The rocket becomes the colony.

This gives the opening's grants a source. Today `story-beats.js` conjures the
Rotor's and the Quiver's cost with `api.grant(api.cost(key))`. After this the
grant is a barrel leaving the foundry, seen.

## What the assets give

- **AFR-01** (16 × 12 m plot, origin at ground centre): the service arm with
  four pivots, the separator drum, the induction chamber, `SALVAGE_PANEL_00`,
  spark preview geometry, a barrel fill indicator, and six sockets
  (`CUTTER_TIP`, `SCRAP_INPUT`, `REGOLITH_INPUT`, `POWER`, `BARREL_FILL`,
  `STALHEART_FEED`). Two clips: `Recycle_Panel_To_Barrel` (16 s, one shot,
  with events `CUTTER_ARC_ON` 2.0 s, `CUTTER_ARC_OFF` 5.1 s, `SCRAP_ACCEPTED`
  10.0 s, `BARREL_READY` 15.0 s) and `Foundry_Process_Cycle` (4 s loop).
- **SH02 salvage layout, stage 1**: the landed SH02 as four section roots
  around the arm at the same origin: `00_LANDING` (legs and lower bands),
  `01_TANK`, `02_CAPSULE`, `03_ISAO_MODULE`, with `SOCKET_SALVAGE_TARGET_00..03`
  and `SOCKET_ISAO_RELEASE`. No clips; sections are moved or removed by the
  game in LOD0/1.
- The intact animated SH02 (`sh_rocket.glb`, already in the story) stays the
  landing model. The salvage layout is a post-landing state, not a damage
  state.

## 1. Placement

The landing island (16 × 16 m at `x 0, z -60`) already holds the SH02 at
stage 1. The AFR plot is 16 × 12 m and the salvage layout is composed around
its arm at the same origin. So one root: the landing island's origin, the
foundry and the salvage sections at that root, tier for tier.

`src/content/base-layout.js` gains two structures on the `landing` island:

| id | asset (near) | far | stage | note |
| --- | --- | --- | --- | --- |
| `foundry` | `afr_01_seed_foundry_d0_lod1.glb` | `afr_01_seed_foundry_d0_lod2.glb` | 2 | clips as above |
| `sh02-salvage` | `sh02_salvage_layout_stage1_lod1.glb` | `..._lod2.glb` | 2 | static sections |

and the intact `sh02` structure gains `until: 2` so the plan hides it from
stage 2 on. `planBase` filters `s.stage <= stage`; it learns `until`. Stage 2
is named "Foundations" today; the foundry is the foundation.

The island may need to grow to the AFR plot's 16 × 12 plus the sections'
spread; the manifests' bounds decide, measured in the story lab at stage 2.

## 2. The beat

`story-beats.js` gets one phase between `landed` and `printing`:

```
landed      Isao out: "rough landing", "so much to build"
foundry     Isao deploys the AFR-01; the SH02 separates; the arm's first cycle
            runs; BARREL_READY grants the Rotor's cost; then the Rotor order
printing    as today
```

Concretely, once `so_much_to_build` has played (clock ≥ `foundryDelay`):

1. `api.foundry('deploy')`: the host swaps the intact SH02 for the salvage
   layout and shows the foundry (a rise from the capsule's side over ~2 s,
   dust puff at the root, the existing landing dust). Isao's line
   (`isaobriefs.js`, two lines): "The rocket got us here." / "Now it builds
   the base."
2. `api.foundry('cycle')`: the host plays `Recycle_Panel_To_Barrel` once.
   The four events are read from the clip time by the host: at
   `CUTTER_ARC_ON..OFF` a cutter arc effect runs from `SOCKET_CUTTER_TIP`
   toward `SOCKET_SALVAGE_TARGET_00` (the beam effect from the Lancer's
   family, blue, short); at `SCRAP_ACCEPTED` the section root
   `SH02_SALVAGE_SECTION_01_TANK` shrinks away (the asset's panel geometry
   stands in for the cut piece); at `BARREL_READY` a barrel instance appears
   at `SOCKET_BARREL_FILL` and slides to a rack beside the foundry, and the
   grant lands: `api.grant(feedstockPerBarrel)`.
3. When the grant covers the Rotor's cost, the beat orders the Rotor as
   today and enters `printing`.

After the first cycle the foundry keeps working on its own: while salvage
remains, `Recycle_Panel_To_Barrel` plays every `cycleSeconds` and each
`BARREL_READY` grants again and consumes the next section (`02_CAPSULE`,
then `03_ISAO_MODULE`; `00_LANDING` stays, the legs are the pad). Between
cycles `Foundry_Process_Cycle` loops. When the sections are spent the foundry
idles on the loop with nothing queued: a finite kick-start, exactly the
rocket's worth of feedstock, and then the colony must earn.

The Quiver's grant in the `cleared` phase comes from the same account: by
then two or three barrels have landed.

## 3. Ownership

| Module | Layer | Owns |
| --- | --- | --- |
| `src/content/foundry.js` (new) | content | `FOUNDRY_TUNE`: `foundryDelay`, `cycleSeconds`, `feedstockPerBarrel`, `sections` (the consumption order), the event times. |
| `src/domain/foundry.js` (new) | domain | The foundry's clock: `makeFoundry`, `stepFoundry(st, dt)` returning events (`deploy`, `cycle`, `arc-on`, `arc-off`, `scrap`, `barrel`, `spent`), sections remaining, barrels produced. Pure; testable without a clip. |
| `src/domain/story-beats.js` | domain | The `foundry` phase, driving `api.foundry(event)` from the domain clock, and the grant. |
| `src/fx/story-base.js` | fx | Loads the two new structures like any landmark (far tier first, near on approach); `until` hides the intact SH02 from stage 2. Exposes the foundry's mixer and named nodes to the host. |
| `src/fx/foundry-fx.js` (new) | fx | The cutter arc, the section removal, the barrel rack (instanced), the deploy rise. |
| `src/td-tab.js` | host | `storyApi.foundry(event)` folded into the existing `storyApi` literal, no net line growth (budget 17558). |

`npm run tiers` is not needed: the owner ships LOD2 distance tiers; they are
pinned as `far` like the solar complex.

## 4. Testing

- `test/foundry.mjs`: the clock emits the four events at the authored times
  in order, one barrel per cycle, sections consumed in order, `spent` once,
  nothing after; the grant total equals sections × feedstockPerBarrel.
- `test/story-beats.mjs` (existing): the `foundry` phase sits between
  `landed` and `printing`; the Rotor is ordered only after the first barrel;
  the total granted before `printing` equals one barrel.
- Browser: `scripts/browser-test.mjs --story-world` at stage 2 shows the
  foundry and the four sections and no intact SH02 (`storyLod` carries the
  files); the story lab at stage 2 renders both tiers.
- The story lab's stage 2 screenshot for the owner's art review of the
  composition in the game camera (the asset's own open item).

## 5. Out of scope

- Damage states for the foundry (only D0 is authored).
- A general resource sink or a second currency: feedstock is biomass, seen.
- The Stålheart feed socket doing anything (it is a hook for later).
- The escort and resupply missions.

## 6. Risks

- **Island size.** If the salvage sections overhang the 16 × 16 island the
  slab must grow; the story lab measures it before the beat is wired.
- **Section removal reads as a cut.** The asset cuts `SALVAGE_PANEL_00` in
  its own geometry; the section roots are removed by the game. If a section
  vanishing under an arc reads wrong, the fallback is a slide-away toward
  `SOCKET_SCRAP_INPUT` over the 10 s before `SCRAP_ACCEPTED`.
- **Timing.** A 16 s cycle before the Rotor is ordered lengthens the opening
  by that much once. `foundryDelay` and `cycleSeconds` are tunables.

## 7. Assumptions

- Feedstock is the existing biomass currency; no new economy.
- The foundry is Isao's autonomous first build; the player watches, as with
  the Rotor print, and the views strip is not yet unlocked.
- The rocket yields exactly three barrels (tank, capsule, Isao module); the
  landing unit stays as the pad.

## 8. For the owner

1. **Economy.** Do the barrels replace the opening's conjured grants (the
   Rotor's and the Quiver's cost come from feedstock), or are they extra on
   top? Recommended: replace; the point is the chain.
2. **How much rocket.** Three sections consumed over the opening and the legs
   kept, or the whole rocket including the landing unit? Recommended: keep
   the legs; the pad stays as the arrival's mark.
3. **The player's hand.** Fully automatic (Isao builds and cuts), or does the
   player confirm the foundry's deployment with one press, the way the tank
   is later handed over? Recommended: automatic; the opening's lesson is
   Isao building while the player watches.
4. **Cycle length.** 16 s per barrel as authored, or compressed so the Rotor
   appears within the current opening's pace? Recommended: authored for the
   first cycle, then `cycleSeconds` 24 s so later barrels pace the print
   orders without dominating.
