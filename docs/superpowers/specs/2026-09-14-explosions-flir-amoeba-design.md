# Explosions, FLIR thermal and the white amoeba

Date: 2026-09-14. Status: design approved in conversation; spec awaiting owner review.

## Why

The owner's explosion lab (`~/Dev/lab-explosions`, commit `5f7c543`) answered `docs/EXPLOSIONS-RESEARCH.md`: four procedural, textureless Three.js r160 modules (rotary pop, Bofors burst, howitzer blast, orbital strike), a FLIR ironbow thermal view, and 24 passing contract tests. The owner wants them in the game, first for the gunship, also for the Quiver and tank shells. Separately, the first enemy becomes a white amoeba.

## Decisions taken with the owner

- Size-matched mapping (below). Replace today's dot bursts at those impacts; keep the damage-radius rings.
- Adopt the lab's FLIR filter for the gunship's thermal mode.
- Import as pinned adapted copies plus one adapter, with each use's explosion read from content data. The FX-package section and a lab picker are a later, separate step.
- Amoeba swap: bodies and belts trade places, roles stay with their slots.

## Mapping

| Use | Module | Scale | Radius | Life |
| --- | --- | --- | --- | --- |
| `gunship.rotary` | rotary-pop | 1 | 4.5 m | 0.4 s |
| `gunship.bofors` | bofors-burst | 1 | 11 m | 1.2 s |
| `gunship.heavy` | howitzer-blast | 1 | 32 m | 3 s |
| `tank.shell` | bofors-burst | 0.6 | ~7 m | 1.2 s |
| `quiver.talon` | bofors-burst | 0.8 | ~9 m | 1.2 s |
| `strike.orbital` | orbital-strike | 1 | 90 m | 10 s |

Rotor rounds and the Needle stay tracers and sparks. A TALON that misses keeps its small dot puff.

## Structure

- **Pinned adapted copies** in `src/fx/explosions/`: `common.js`, `rotary-pop.js`, `bofors-burst.js`, `howitzer-blast.js`, `orbital-strike.js`. The only change from the lab is the `'three'` import rewritten to `../../../vendor/three.module.js`. `docs/explosion-assets.lock.json` records the lab revision and, per file, the upstream and adapted sha256; `scripts/assets.mjs` verifies the adapted copies (as it does the sinkhole import). `scripts/import-explosions.mjs` re-copies from a local lab checkout, rewrites the import and refreshes the lock; it never runs in CI.
- **Content** `src/content/explosions.js` (pure, no DOM, no three): `EXPLOSION_USES` (the table above: `{ module, scale }`) and `EXPLOSION_PALETTE` (the lab's defaults: white `#fff5e1`, hot `#ffd04a`, warm `#ff8420`, ember `#c4300c`, smoke `#8e8983`, soot `#35312d`). This table is what the later FX-package section replaces.
- **Adapter** `src/fx/explosions.js`: `createExplosions(scene, { renderer, camera, bloomGroup })` returns `{ prewarm(), spawn(use, point, normal, cellSide), tick(dt), count(), clear(), dispose() }`.
  - `spawn` builds the module's explosion with the content palette, the use's scale, a seed from a running counter, and `planetRadius = METRES_PER_CELL / cellSide` (the unit sphere's radius in metres, 753 on the story planet). It places the object at `point`, turns local +Y onto `normal`, and sets `object.scale` to `cellSide / METRES_PER_CELL`. This works because every layer's vertex shader goes through `modelViewMatrix`.
  - Live caps by size: small 20, medium 4, large 2, nuclear 1; at the cap the oldest of that size is disposed first.
  - `tick(dt)` advances and reaps by `alive()`; the host passes its frozen-aware delta, so pause, build downtime and shots freeze explosions with the world.
  - `prewarm` runs once after the renderer exists. If a module fails to load or prewarm, the adapter reports `available: false`, records a diagnostics event, and callers keep today's dot bursts.
  - Explosion objects join the `effects` bloom group.
- **Hooks** (no growth of `src/td-tab.js`; the removed firework and dot-burst code pays for them):
  - `src/sentry-pilot.js`: the rotary and Bofors landings call the host's `explode(use, point)` instead of `burst`; rings and sounds unchanged.
  - `executeStrike(ci, tNow, use = 'strike.orbital')`: the five-shell dot-burst firework is replaced by `explode(use, …)`; the gunship's 105 lands through `executeStrike(ci, t, 'gunship.heavy')`. Rings, flash, damage and wall rules unchanged.
  - Tank shell: on a body hit and in `blastWall`, `explode('tank.shell', …)` replaces the dot burst; rings and `blast_fire` unchanged.
  - Quiver TALON: on a hit, `explode('quiver.talon', …)` replaces the dot burst; a miss keeps it.
- **FLIR**: the lab's `<svg><filter id="flir">` block goes into `index.html`; `#tab-td.gunship-thermal #td-app canvas` uses `filter: url(#flir)`. Night and normal unchanged.

## The amoeba swap

- `CREATURE_TINTS`: amoeba white, phage grey.
- `ENEMY_SPEC`: the role fields trade places, the body keeps its size. Amoeba becomes `{ hp: 1, speed: 1.15, size: 0.5, rammable: true, heartDmg: 1, erratic: true, bounty: 3 }`; phage becomes `{ hp: 1, speed: 0.75, size: 0.4, rammable: true, heartDmg: 1, bounty: 16 }`.
- `INTROS`: wave 1 is `amoeba` ("THE AMOEBA", agile swarm · hunt its source); wave 4 is `phage` ("THE PHAGE", crawler · destroy the spawn).
- The late-wave flood in `computeWavePlan` adds `amoeba` and `ghost`.
- The story's first wave (`fodderType` default in `src/domain/story-beats.js`), the gunship skip's `spawnFodder`, the glossary's fodder card and the harvest probe use `amoeba`.
- The piloted Rotor's multiplier is unchanged: a round is still worth one first-wave body (hp 1).
- The swarm lab's measured numbers were taken on phages; they are not re-measured here. The amoeba cloud is denser (692 authored dots against 494) and is thinned by the same density factor; the gunship acceptance run's frame number is the check.

## Testing

- Node: `test/explosions-content.mjs` (every use names a vendored module; positive scales; palette keys valid); `test/explosions-contract.mjs` (the lab's contract tests adapted to the vendored import: meta, determinism by seed, every element ends by `lifeS`, `alive()` under the 0.1 s step cap, dispose frees all but the templates, no globals); `npm run check` verifies the lock; `test/tdcore.mjs` and `test/story-beats.mjs` expect `amoeba` for wave 1 and the story's first wave; the belt test expects amoeba white.
- Browser: `--gunship` asserts explosions spawn and are reaped for rotary, Bofors and 105, that thermal mode's canvas filter is `url(#flir)`, and records frame time under a sustained rotary burst plus a Bofors shell and a 105 (a measurement against the earlier 28 fps headless number, not a pass bar); `--story-world` asserts the first wave is white amoebas, the Rotor still clears it, and a TALON hit spawns an explosion; the default suite covers a tank shell explosion and no console errors.
- Gates before done: `npm test`, `npm run check`, `npm run build`, browser default, `--story-world`, `--gunship`, `--sinkhole`, and `--dist`.

## Out of scope

The FX-package explosion section and lab picker; retuning damage or blast radii; scorches; the navigation shell (its own spec); the flat-world reform.
