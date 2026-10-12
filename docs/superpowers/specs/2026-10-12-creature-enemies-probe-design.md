# Creatures as story-mode enemies, and the probe that prices them — design

Owner, 2026-10-12: "we're going to try in the regular stalheart story mode, to replace some of the enemies with the Reed and the Cutis-Maku, see
how many we can afford at once without dropping fps." Then: "we want to test various scenarii; swarms of smaller ones, medium swarm of medium
sized, a few big ones, one huge ones, for both bosses." Choice: **measure, then decide** — both become real enemy types, a probe ramps them up in a
real sector until the frame time crosses budget and reports the count; the owner picks the shares per wave afterwards.

Branch `creature-enemies`, cut from `cutis-boss` at 5affae7f (worktree `~/Dev/stalheart-creature-enemies`). Local only until the owner says.

## Tiers (content knobs, one file)

| tier | count style | Cutis-Maku (`cutis`) | Nih-Dairia family (`reed`) |
|---|---|---|---|
| small | swarm | ~3 m wide (r0 1.5), low hp | Reed ~4 m |
| medium | medium swarm | ~8 m (r0 4) | Reed ~8 m |
| big | a few | ~16 m (r0 8) | Reed ~15 m (the boss lab's wave size) |
| huge | one | ~40 m (r0 20) | Nih-Dairia itself, ~40 m (the boss lab's predator) |

Hit points scale with size (the game's enemy hp scale; small ≈ a mid enemy, huge ≈ a boss's). Speeds per tier.

## In the game

- Two new `ENEMY_SPEC` types (`cutis`, `reed`), shelved from the normal wave plans; they enter only through `?creatures=<family>:<tier>`,
  which replaces a share of each sector wave's bodies with the tier (and the probe below).
- The enemy RECORD walks the cell graph to the heart exactly as every enemy does (`src/fx/enemy-step.js`); the creature's BODY follows the
  record's point: a Cutis plans its hops toward it (per-instance target), a Reed's pursuit follows it. Damage through `damageEnemy`
  (td-tab.js) like everything else (towers, tank, gunship, SOL); death: a Cutis deflates into its puddle, a Reed / the Nih-Dairia collapses
  (the v1 death) and is removed. Downstream code needs `e.obj` (tick, setTint, lift, reach, kind, s0, material.opacity): a light proxy object
  per body where the body has no Object3D of its own.
- **Cutis drawing:** one instanced swarm per tier, its group on the heart's surface point; every body's local plane coordinates are the
  azimuthal-equidistant projection round the heart (exact positions; shapes stretched sideways by θ/sin θ, ~5 % at 30°).
- **Reed drawing:** each its own soft body (src/fx/nih-dairia kit, the boss lab's `reed` variant), drawn through a frame of its own on the
  sphere (as src/labs/boss/wave.js does); no solver budget slow-down in the probe (the probe measures the true cost).
- New modules under `src/fx/` / `src/domain/` / `src/content/`; td-tab.js (6135 of its 6400-line ceiling) gets a minimal hook only.
- Planet: unit sphere in the scene, `STORY_RECIPE.metresPerCell` 10, cellSide ≈ 0.013274 → 1 world unit ≈ 753 m.

## The probe

`index.html?skip=defence&sector=2&creatures=cutis:small&ramp=1&fps=1#td` (any family:tier). A normal sector at the finished base, its waves
partly replaced by the tier; the probe adds bodies of the tier in steps (holding each step a few seconds), tracks the measured frame time
(the perf overlay's / the crowd cap's measure) and stops when it stays above 16.7 ms; a result card: the most alive, frame ms, the enemies'
CPU ms, GPU ms (where the timer query exists), draw calls. Exposed to the test hook for a browser step. The owner runs it on his machine
(headless numbers here are meaningless); one headed run on kainode's M4 gives a first number.

## Testing

Node tests for the tier table, the projection and any pure probe logic; a browser step `--creature-probe` (each family:tier boots, bodies
spawn, walk, take damage and die, the probe ends with a card, 0 page errors — counts not asserted headless); `npm test`, `check`, `build`,
`architecture`; `--sector-probe` / `--crowd-probe` still pass.
