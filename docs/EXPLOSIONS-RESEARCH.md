# Explosion research brief

Stalheart wants satisfying procedural explosions, first for the gunship's
seat, then for the ground game. This is the brief for whoever researches and
builds them. Work outside the game, in your own lab page; the best results are
imported as modules.

## What we run

- Three.js **r160**, native ES modules, vendored. No bundler at runtime, no
  npm packages in the page. Import `three` as a bare specifier; we map it.
- No textures, no sprite sheets, no flipbooks, no video. Geometry, points,
  lines, shaders and vertex colours only. The only textures in the game are
  four stone maps for the sinkhole.
- Bloom is applied by the game (UnrealBloom, per-group weights). Emissive and
  additive material glows; do not fake glow with large soft sprites.
- Monochrome TRON vocabulary: white to ember red for fire, cyan for ours,
  amber for warnings. Take the palette from an option, never hard-code it.
- Scale: metres, +Y up, +Z forward, the effect at the origin on a flat ground
  plane. The game scales it onto a sphere and orients it to the ground normal.
  One planet cell is 10 m.

## The views it must read in

The gunship's seat sits **340 m up looking straight down**, and cycles three
views with a CSS filter over the whole canvas:

| View | Filter | What survives |
| --- | --- | --- |
| normal | none | colour as authored |
| night | `grayscale(1) brightness(0.62) contrast(1.7)` | luminance only, dark |
| thermal | `grayscale(1) brightness(0.5) contrast(1.6) sepia(1) saturate(5) hue-rotate(-18deg)` | luminance as heat, warm palette |

Consequence: an explosion has to carry its shape in **brightness over time**,
not in hue. A fireball that is only orange turns into a grey blob at night.
Build the lab with those three filters as a toggle and judge every candidate
in all three. From the seat, the top-down silhouette and the ground ring are
what the gunner sees; from the ground game, the side silhouette matters too.

## The sizes

| Effect | Blast | Use |
| --- | --- | --- |
| small | 4.5 m | 25 mm rotary rounds, thirty a second, many at once |
| medium | 11 m | 40 mm Bofors area burst, a few a second |
| large | 32 m | the gunship's 105 mm shell and the orbital strike |
| nuclear | 60 to 120 m | the orbital strike's set piece: a column, a cap, a ground ring, a slow fade |

The small one must be cheap enough to have twelve alive at once (a pool of twenty). The large
and nuclear ones are rare and can spend: a rising column, a mushroom cap,
a shockwave ring on the ground, embers, a lingering scorch. The nuclear cloud
should also read as a background event in ordinary missions, seen from a
tank at ground level 150 to 300 m away as a column and cap over the horizon
(see the answers below on the planet's curvature).

## Timing

A round leaves the gunship, flies two to three seconds, then lands. The
impact effect starts on landing. Give each effect a clear attack (the first
100 ms is the whole feel), a body, and a tail that does not outstay it: small
0.4 s, medium 1.2 s, large 3 s, nuclear 8 to 12 s.

## The contract for an importable module

One ES module per explosion:

```js
import * as THREE from 'three';
export const meta = { name: 'bofors-burst', size: 'medium', radiusM: 11, lifeS: 1.2, budget: { points: 600, draws: 3 } };
export function createExplosion({ palette, scale = 1, seed = 1 } = {}) {
  const object = new THREE.Group();     // at the origin, +Y up
  let t = 0;
  return {
    object,
    tick(dt) { t += dt; /* animate */ },
    alive() { return t < meta.lifeS; },
    dispose() { /* every geometry and material */ },
  };
}
```

- No globals, no DOM, no fetch, no timers: the host owns the clock and calls
  `tick`.
- `seed` makes it deterministic, so two runs look the same for a screenshot.
- `dispose` must free everything; we reap by `alive()`.
- Record the measured cost: frame time on the phone stand-in (answer 3) at
  the deciding load (answer 4): twelve smalls, one medium, one large alive.
  Write it in `meta.budget`, with the marginal cost per small.

## The lab you build

A single HTML page with r160 from a CDN or a local copy, a flat ground grid,
a top-down camera at 340 m and a ground camera at 2 m, the three filters as
buttons, a list of candidates, and spawn buttons for small, medium, large and
nuclear at the click point. Show FPS. Let the seed be typed. Keep it in its
own repository; we pin the winning modules by hash into `src/fx/explosions/`.

## What we judge

1. Reads in all three views, top-down and from the ground.
2. Attack in the first 100 ms; a tail that ends.
3. Cost inside the budget with several alive.
4. No textures, no dependencies, disposes clean.
5. Feels like this game: rings on the ground, embers, wire, glow; not a
   photographic fireball.

Deliver the lab page, the modules, and a one-line cost note per module.

## Answers to the open questions (2026-09-14)

**1. Field of view at 340 m.** The seat's camera is a Three perspective
camera with a vertical field of view of 60° divided by the gun's zoom:
rotary 2.6x, Bofors 1.9x, 105 1.3x. Frame heights on the ground at 340 m,
and pixels per metre on a 1080-tall viewport:

| Gun | vertical FOV | frame height | px per metre | blast diameter on screen |
| --- | --- | --- | --- | --- |
| rotary | 23.1° | 139 m | 7.8 | 9 m → 70 px |
| Bofors | 31.6° | 192 m | 5.6 | 22 m → 124 px |
| 105 | 46.2° | 290 m | 3.7 | 64 m → 238 px |

So the small blast is 70 px across, not 12; a flash, a ring and a few sparks
are all readable. Fine detail below about 2 px (a quarter metre for the
rotary) is wasted.

**2. Bloom.** UnrealBloom from Three r160: strength 0.3, radius 0.5,
threshold 0.2, mip chain at half resolution on the phone tier. Per-group
weights multiply the colour fed to the bloom pass only (the scene draws
unweighted): map 0.35, enemies 1.3, tank 1.0, towers 1.0, effects 1.0 (the
fallback for anything untagged, which an explosion will be). Bloom is added
before the night and thermal filters. Put the same pass in the lab with those
numbers and judge under the filters; expect flat white where several bright
things overlap under contrast 1.7, and design the attack so the core is
small and the rest is dimmer.

**3. The device.** There is no named phone in the repo. Until the owner
names one, the stand-in is Chrome with 4x CPU throttling, device pixel
ratio capped at 1.5, antialiasing off, bloom at half resolution: that is the
game's phone tier. Report both the M-series number and the throttled one.

**4. The load that decides.** Pass or fail at the rotary's steady state:
twelve smalls alive (thirty a second times a 0.4 s life), one medium, one
large, on the phone stand-in, with the frame under 16.7 ms total including
the game's own cost. The twenty was a ceiling for the pool size, not the
test. Say the marginal cost per small; that is the number we will tune with.

**5. The scorch.** Not part of the explosion. The game owns lingering marks
(its ground rings and scorches live in the weapon recipes and outlive
effects). An explosion module ends when its tail ends; if a candidate wants
a mark to remain, export a second builder `createScorch` with the same
interface and its own life, and the game decides whether to keep it.

**6. The palette.** Pass this object; the game fills it from its look and
the firing weapon:

```js
palette = {
  hot: 0xffffff,     // the core
  warm: 0xffb347,    // amber, the strike's second ring
  ember: 0xff3b2f,   // the last red
  ours: 0x00e5ff,    // cyan, the base's own light
  weapon: 0xffb347,  // the firing weapon's colour (rotary white, Bofors amber, 105 red-orange)
}
```

Under night and thermal only the luminance of these survives, so order them
by brightness: hot, then warm, then ember.

**Replays.** Compute everything from elapsed time inside `tick`: keep `t += dt`
and derive positions from `t`, or integrate at a fixed 120 Hz substep inside
`tick`. The game's frame delta is variable and clamped to 0.1 s.

**Rings on the planet.** The planet's radius is 753 m. The game lifts its
own ground rings a little and samples them along the curve. Sag over a
blast radius: 32 m → 0.7 m, 60 m → 2.4 m, 120 m → 9.6 m. Take
`planetRadiusM` as an option and bend ground-plane elements to
`y = -(x² + z²) / (2R)`; below 15 m radius a flat ring is fine.

**The nuclear cloud from the ground.** The planet is small: from a 2 m
eye the ground horizon is 55 m away. A cloud 1 km along the surface is far
below the horizon whatever its height. Distances that work as a background
event from the ground: at 150 m the top must clear 15 m, at 250 m 43 m, at
400 m 120 m. There is no fog and the far plane is effectively infinite, so
what clears the horizon is seen crisply. Author the cloud to read from
150 to 300 m away as a column and cap over the horizon.
