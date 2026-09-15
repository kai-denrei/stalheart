# Orbital Laser Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal**

Build sub-project 1 of the orbital laser from `docs/superpowers/specs/2026-09-15-orbital-laser-lab-design.md`: the weapon's rules as a pure Node-tested domain module, its numbers as content, its look as an FX builder, and a lab at `labs.html#laser` that stands up the real story base, two sentries, an open sinkhole and a trench of twenty bodies, and lets the owner burn all of it from orbit through a satellite inset. No game code is touched; `src/td-tab.js` is not edited.

**Architecture**

`src/content/orbital-laser.js` owns every number (orbit, beam, burn seconds, view, beam preset, trail caps); `src/domain/orbital-laser.js` owns the clock, the slew, the energy drain and the burn accumulator as pure functions over explicit state, with no renderer and no browser. `src/fx/orbital-laser.js` turns a contact point and an energy fraction into a beam, a footprint ring and a scorch trail; `src/labs/laser-tab.js` composes those with the shipped story-base presentation, the shared sinkhole, the shared explosion adapter and the shared impact scare, and owns everything browser-shaped — the renderer, the two cameras, the scissored inset, the pointer, the panel and the HUD.

**Tech Stack**

Native ESM, vendored Three.js r160 (`vendor/three.module.js`), vendored `lil-gui` for the panel, Node 22 `node:assert/strict` test programs under `test/*.mjs` run by `npm test`, `npm run check` (syntax + architecture guard + logs + assets), and `scripts/browser-test.mjs` driving headless Chrome over CDP.

## Global Constraints

- `src/core/`, `src/domain/` and `src/content/` are pure: no `window`, `document`, `localStorage`, `sessionStorage`, `fetch`, `AudioContext` or `requestAnimationFrame` anywhere in the file — **comments included**, because `scripts/architecture.mjs:23` regexes the whole file body.
- `src/domain/*` may import only `src/domain/*`, `src/core/*` and the pinned kernel (`src/grid.js`, `src/sample.js`, `src/hull.js`, `src/vec3.js`, `src/rng.js`, `src/cellindex.js`, `src/dungeon.js`). `src/content/*` may import only `src/content/*` and `src/core/*`; no Three.js in `src/content/`.
- Do **not** edit `src/td-tab.js` in this sub-project. The td-tab line budget in `docs/architecture-budget.json` (`13957`) must stay untouched.
- Labs never import `src/td-tab.js`; `scripts/architecture.mjs:42-43` fails the build if any `src/labs/*` file reaches it.
- No new top-level `src/*.js`. `docs/architecture-budget.json` `topLevelModules` is a frozen list; the new modules go to `src/content/`, `src/domain/`, `src/fx/` and `src/labs/`. The lab controller is **`src/labs/laser-tab.js`**.
- The one-liner `//` trap: a `//` comment inside a single-line statement swallows the rest of the line. Use `/* … */` for any comment inside a long line, and prefer multi-line code in the new files.
- Browser suite serves on port **18155** (`scripts/browser-test.mjs:13`); the dev server (`npm run dev`) stays on **8155**. Do not change either.
- 16 GB machine: run `~/scripts/check-memory.sh` before `npm run test:browser` and back off if it reports WARN. One headless Chrome at a time; `scripts/chrome-proc.mjs` owns it.
- No colored emoji in product UI; monochrome visual vocabulary only.
- Commit after each task. Author is `Kai Denrei <270854086+kai-denrei@users.noreply.github.com>`; verify with `git config user.email` before the first commit. Every commit message ends with a blank line then exactly:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011cqDbj6h5baid4w2Vigrq3
```

- Do **not** push. The branch is `heavy-gunship`; leave it local.

## Facts the tasks rely on (read on 7422351)

- **`createBeam`** — `src/beamfx.js:232` `createBeam(start, end, overrides = {})` takes `THREE.Vector3` endpoints and returns `{ mesh, uniforms, update(elapsed), setEndpoints(a, b), setAlpha(a) }` (`src/beamfx.js:259-271`). `update(elapsed)` **overwrites** `uAlpha` with the burst envelope, so `setAlpha` must be called *after* `update` each frame. `burstEnvelope` returns `1` when `burstRate` is 0 (`src/beamfx.js:214-216`), so a continuous beam sets `burstRate: 0`.
- **`DEFAULTS` keys** — `src/beamfx.js:24-43`: `coreColor, coreWidth, coreIntensity, glowColor, glowWidth, glowIntensity, glowFalloff, capStart, capEnd, blast, scrollSpeed, noiseScale, noiseAmount, flicker, jitterAmount, jitterFreq, burstRate, burstDuty, burstDecay, burstAttack`. `coreColor`/`glowColor` become `THREE.Color` uniforms (`COLOR_KEYS`, `src/beamfx.js:205`); the four `burst*` keys are CPU-side only (`BURST_KEYS`, `src/beamfx.js:207`). Widths are in scene units, so metres must be multiplied by scene-units-per-metre.
- **Scissor pattern** — `src/fx/story-monitor.js:22-26`: with `cr = renderer.domElement.getBoundingClientRect()` and `dpr = renderer.getPixelRatio()`, the box becomes `x = (r.left - cr.left) * dpr`, **`y = (cr.bottom - r.bottom) * dpr`** (GL viewport y runs from the bottom of the buffer), `w = r.width * dpr`, `h = r.height * dpr`; then `setRenderTarget(null); autoClear = false; setScissorTest(true); setViewport(…); setScissor(…); clear(true,true,false); render(scene, cam);` and restore with `setScissorTest(false); setViewport(0,0,cr.width*dpr,cr.height*dpr); autoClear = true`.
- **Explosions adapter** — `src/fx/explosions.js:15` `createExplosions(scene, { modules, onError })` returns `{ prewarm, spawn, tick, clear, dispose, available, state }` (`src/fx/explosions.js:74-78`). `spawn(use, point, surfaceNormal, cellSide)` (`src/fx/explosions.js:43`) takes **plain arrays**, scales by `spec.scale * cellSide / METRES_PER_CELL` (`:54`) and passes `planetRadius: Math.hypot(point[0], point[1], point[2])` (`:55`) — **it assumes the planet is centred on its scene's origin**. `tick(dt)` reaps.
- **`EXPLOSION_USES` / `EXPLOSION_SCARE`** — `src/content/explosions.js:6-14` `{ module, scale }` with `module` ∈ `EXPLOSION_MODULES` (`:4`) and `0 < scale <= 2` (enforced by `test/explosions-content.mjs:8`); `src/content/explosions.js:19-26` `{ cells, seconds }`. `test/impact-scare.mjs:37` already asserts `Object.keys(EXPLOSION_SCARE).sort()` equals `Object.keys(EXPLOSION_USES).sort()`, and `:38` requires `seconds > SCARE_FREEZE_S` (0.35). `test/explosions-content.mjs:4-5` is the test that pins the use list.
- **`applyScare`** — `src/domain/impact-scare.js:8` `applyScare(bodies, point, { radius, seconds })`: marks every body with `e.alive && e.pos` within `radius` of `point` (same space as `e.pos`), setting `scareFrom/scareSeconds/scareAt`. Companions: `stampScare(e, now)` (`:22`), `isScared(e, now)` (`:28`), `scarePace(e, now, freezeS)` (`:31`, returns 0 during the freeze then 1.35). `SCARE_FREEZE_S = 0.35` lives in `src/content/explosions.js:27`.
- **`makeDotEnemy`** — `src/units.js:648` `makeDotEnemy(type, cols, dens = 1)` returns a **`THREE.Points`** with `userData.tick(t)` (absolute time), `userData.lift`, `userData.baseScale`, `userData.kind = 'cloud'`. `cols` is `{ walker, walkerHi }`. **Never write an absolute position inside the idle tick**; the caller owns `position`.
- **`makeDotBurst`** — `src/units.js:841` `makeDotBurst(colorHex, outwardN, n = 42)` returns a `THREE.Points` whose `userData.tick(dt)` returns `false` when the 0.7 s life is over. The caller positions it.
- **`buildUnit`** — `src/units.js:1719` `buildUnit(name, cols)`. **Not used by this lab** (the bodies are dot clouds, the two sentries are GLBs); listed because the spec named it.
- **How the swarm lab steps its bodies** — `src/labs/swarm-tab.js:378-390`: plain `{ obj, seed, x, z, r }` records on the lab's **own** integrator; it advances them, writes `b.obj.position.set(...)`, then calls `b.obj.userData.tick?.(t)` with **absolute** time; kills retire the object (`visible = false`) rather than disposing it, and `makeDotBurst` objects are ticked with `dt` and removed when `tick` returns `false` (`:404-407`). This lab copies that shape.
- **`createSinkhole`** — `src/sinkhole.js:24` `createSinkhole(scene, camera, { game = false, sounds = null } = {})` returns `{ group, tune, trigger, reset, rig, setSound, hole, frameMatrix, inverseFrame, ready(), update(dt, absoluteTime), state(), dispose() }`. `group.visible` starts `false` and `update` returns immediately while it is false (`:59`). `trigger()` refuses until `ready()` (four stone textures, `:53`). With `game: true` it skips `scene.background.set(...)`, skips the breach enemies and the reference walls, and copies `group.matrixWorld` into the frame uniforms (`:44-45`, `:61`, `:64`) — that is the mode a lab standing it on the story planet needs.
- **`createBreachRubble`** — `src/breach-rubble.js:10` `createBreachRubble(scene)` → `{ add(source, radius), … }`; `add` reads `source.matrixWorld` and calls `.normalize()` on the projected footprint (`src/breach-rubble.js:34`), i.e. **it also assumes a planet centred on its scene's origin**.
- **Story lab world build** — `src/labs/story-tab.js:119` `planet = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, planetBake())`; `:121` `buildStoryPlanetMesh(planet, look, { wallMetres: STORY_RECIPE.wallMetres })` (its `userData.dispose()` releases it); `:82` `const LAYOUT = { islands: ISLANDS, structures: …, kit: KIT, stages: STAGES }`; `:90` `base = createStoryBase(scene, { plan: planBase(planet, LAYOUT, stage), placer: { toWorld: (p) => new THREE.Vector3(...planet.frameToWorld(p)) }, metres: 1, kit: KIT, skip: ['sh02'], sfx })`. `KIT` is `src/content/base-layout.js:64`.
- **`buildStoryPlanet` return** — `src/domain/story-planet.js:97-105`: `{ mesh, dungeon, graph, radius, cellSide, cellMetres, clearing, padFloor, arcOfCell, altitudeOf, frameToWorld, worldToFrame }`. `cellSide` is the **unit-sphere chord** (`:37`), `cellMetres = cellSide * radius` = `STORY_RECIPE.metresPerCell` = 10 (`src/content/story-defaults.js:6`), `radius ≈ 753` metres. `frameToWorld([x, y, z])` maps frame metres (x/z along the surface, **y = altitude in metres**) to world metres.
- **The world frame has the pole at the origin, not the centre.** `src/domain/base-plan.js:12` compares a lattice centre against a frame point as `[c[0]*radius, c[1]*radius - radius, c[2]*radius]`, so the planet centre sits at `(0, -radius, 0)` in the lab's world. **Deviation from the spec's sketch, forced by the code:** `createExplosions.spawn` (`planetRadius: Math.hypot(point)`) and `createBreachRubble.add` (`.normalize()`) both assume a centre-at-origin scene, and `src/td-tab.js:350` proves it by passing `norm3(p)` as the surface normal. The lab therefore parents the explosion adapter, the sinkhole and the rubble to one `sphereRoot` group at `(0, -radius, 0)` and hands them planet-centred points `[x, y + radius, z]`; everything else stays in pole-origin world metres.
- **`planBase`** — `src/domain/base-plan.js:10` `planBase(planet, layout, stage)` returns `{ stage, islands, structures, walls, gate, cells, bays, sockets, open }` (`:159`). `walls` entries are `{ x, z, y, heading, cell }` in frame metres (`:151`), twelve of them at stage ≥ 4 (`KIT.wallsPerSide = 6`, both sides). `gate` is `{ x, z, y, heading, cell, openRadius: 22 }` (`:145`). `sockets` are `[{ cell, toward, pos }]` with `pos` a **unit-sphere** point (`:79`, `:69`); socket 0 is the Rotor's, socket 1 the Quiver's, and a socket's world point is `[pos[0]*R, pos[1]*R - R, pos[2]*R]` plus `KIT.wallMetres` along the normal. `cells.fodder` is the lane cell where the ground opens (`:122`).
- **`createStoryBase`** — `src/fx/story-base.js:55` `createStoryBase(scene, { plan, placer, metres = 1, kit, skip = [], sfx = null })` returns `{ ready, group, counts, errors, tick(dt, near, force, eye), gate(), reveal(id), conceal(id), structure(id), bays(), lod(), dispose() }` (`:169-185`). **It does not expose the wall `InstancedMesh`**: the walls are built inside a `load(kit.wall).then(...)` that creates **one `InstancedMesh` per mesh in the GLB, each named `'walls'`, added to `group`** (`:102-104`), with instance `k` matching `plan.walls[k]`. The lab reaches them with `base.group.children.filter((o) => o.isInstancedMesh && o.name === 'walls')` after `await base.ready`, and drops a cell by writing a zero matrix at index `k` in **every** such mesh. `structure(id)` (`:181`) returns `{ holder, root, near, far }` — the **holder** is the `THREE.Group` to hide, and the Stalheart's id is `'stalheart'` (`src/content/base-layout.js:42`, island stage 6).
- **`createThermalHeat`** — `src/fx/thermal-heat.js:29` `createThermalHeat(parts, { every = 1000 })` where `parts()` returns `{ warm: Object3D[], hot: Object3D[] }`; returns `{ set(on), dispose(), heated() }`. `set(true)` clears any previous interval first, so repeated calls are safe but re-apply; call it on the burning edge only. `HEAT = { warm: 0.55, hot: 1 }` (`:8`).
- **`LABS` and the route** — `src/content/nav.js:36` `const LABS = [['units','units'], ['swarm','swarm'], ['beam','beam'], ['audio','audio'], ['metal','metal'], ['story','story'], ['sentry','sentry / impact'], ['portal','breach'], ['sim','sim']]`, spread into `NAV_ENTRIES` at `:46`. `src/main.js:26-38` is the `routes` object (`story: () => import('./labs/story-tab.js').then(m => m.initStoryTab)` at `:34`). `test/nav-content.mjs:17-19` asserts, for every workshop entry, that `src/main.js` matches `\n\s+<hash>: \(\) => import` — so the route line must start on its own line with leading whitespace.
- **`labs.html`** — the `#tab-*` divs run `labs.html:23-193`. The beam lab's markup (`labs.html:158-163`) is the panel idiom to copy: `<div id="tab-beam" class="tab tab-hidden">` containing `<div id="beam-app"></div>`, `<div id="beam-hud"></div>`, `<button id="beam-link" class="lab-link" …>&#8599;</button>` and `<button id="beam-copy" …>⧉</button>`.
- **The beam lab's panel** — `src/beam-tab.js:19` `import GUI from '../vendor/lil-gui.esm.js'`; `:503` `const gui = new GUI({ title: 'BEAM', container: root })`, folders via `gui.addFolder(...)` and `folder.add(P, 'key', min, max, step).name(...).onChange(...)` (`:505-530`); `:384` `wireDeepLink(root.querySelector('#beam-link'), () => deepLink({ base: location.origin + location.pathname, hash: 'beam', params: P, defaults: P0, carry: location.search }), { label: 'BEAM', flash })`; `:389-406` the COPY PRESET fallback chain (clipboard → hidden textarea → console). `deepLink`/`wireDeepLink` are `src/deeplink.js:73` and `:106`.
- **Lab suites in `scripts/browser-test.mjs`** — the chain is `if(args.includes('--breach-game')) { … } else if(args.includes('--sinkhole')) { … } else if(args.includes('--story')) { … } … else if(args.includes('--missile-parity')) { … } else if(authoringWorkspace) { … } else { … }`. The `--laser` branch goes **after the `--missile-parity` block and before `} else if(authoringWorkspace) {`** (around `scripts/browser-test.mjs:599`). The `--sinkhole` suite (`:102-162`) is the lab model: `await go('sinkhole-load','labs.html?sw=0&acceptance=1&genre=sinkhole#portal')`, `await until('window.__stalheartPortalTest?.state().sinkhole?.ready',45000)`, `await evaluate('window.__stalheartPortalTest.configure({…})')`, `await click('[data-sinkhole-open]')`, `current='sinkhole-open';await finish();`. Helpers: `go(name, path, width=1440, height=900, expectedPath=path)` (`:35`) waits for `window.__stalheartReady === true`; `until(expr, timeout=25000)` (`:34`) polls every 150 ms; `evaluate(expr)` (`:29`) returns by value and awaits promises; `finish()` (`:43`) writes the log, asserts no browser errors and no 4xx/5xx, and captures `artifacts/browser/<current>.png`; `current` is the screenshot/log name and is set by `go` or by hand before `finish()`. `delay(ms)` is `:21`.
- **`npm test`** — `scripts/test.mjs:3-6` reads every `test/*.mjs`, sorted, and spawns it with the same Node; a non-zero exit stops the run. A test program asserts with `node:assert/strict` and ends with one `console.log(...)` summary line (see `test/explosions-content.mjs:17`). `npm run check` is `scripts/check.mjs`: `node --check` on every `src/**/*.js`, the pinned-kernel hashes, then `scripts/{log,assets,architecture,presets}.mjs check`.
- **vec3 helpers** — `src/vec3.js`: `add3, sub3, scale3, dot3, cross3, len3, dist3, norm3, mean3, tangentDir, tangentBasis, segKey`. `norm3` divides by `len3(a) || 1`, so a zero vector comes back as `[0,0,0]` rather than `NaN`.
- **The planet radius and cell side in the lab** — `planet.radius` (metres) and `planet.cellMetres` (10). The lab renders in metres (`metres: 1` to `createStoryBase`), so **scene units per metre is 1** and the `cellSide` argument that `createExplosions.spawn` and `applyScare` expect is `planet.cellMetres`.
- **Spec deviations recorded here:** (a) the `sphereRoot` offset above; (b) `burnContacts` returns **only the entries that finished this call** (each id once), matching "reports each id whose accumulated time reached `burn[kind]` exactly once" — the `done` field is therefore always `true`, and the still-burning set is read from `st.contacts` directly; (c) `aimLaser(st, target, dt, beam)` takes no radius argument in the spec's signature, so the radius is taken from `len3(target)` and the contact is rescaled to it; (d) the spec's "wall `InstancedMesh` from `createStoryBase`" is not a return value — it is looked up by name on `base.group`.

---

## Task 1: the rules — content numbers, the pure domain module, `test/orbital-laser.mjs`

**Files:**
- Create: `src/content/orbital-laser.js`
- Create: `src/domain/orbital-laser.js`
- Test: `test/orbital-laser.mjs` (create)

**Interfaces:**
- Consumes: `norm3`, `len3`, `dot3`, `cross3`, `scale3` from `src/vec3.js` (pinned kernel, allowed from `src/domain`).
- Produces: `LASER_ORBIT`, `LASER_BEAM`, `LASER_BURN`, `LASER_VIEW`, `LASER_PRESET`, `LASER_TRAIL`, `LASER_SOUNDS`, `LASER_CONTACT_RATE` from `src/content/orbital-laser.js`; `makeLaser(orbit, beam)`, `stepLaser(st, dt, orbit, beam)`, `aimLaser(st, target, dt, beam)`, `burnLaser(st, held, dt)`, `burnContacts(st, things, dt, burn)`, `laserProgress(st, orbit, beam)` from `src/domain/orbital-laser.js`.

- [ ] **Step 1:** Write the failing test. Create `test/orbital-laser.mjs`:

```js
import assert from 'node:assert/strict';
import { LASER_ORBIT, LASER_BEAM, LASER_BURN, LASER_VIEW, LASER_PRESET, LASER_TRAIL, LASER_CONTACT_RATE } from '../src/content/orbital-laser.js';
import { makeLaser, stepLaser, aimLaser, burnLaser, burnContacts, laserProgress } from '../src/domain/orbital-laser.js';
import { len3, dot3, norm3 } from '../src/vec3.js';

/* the owner's first values, pinned so a tuning session has to come through a decision entry */
assert.deepEqual({ ...LASER_ORBIT }, { period: 180, overhead: 20 });
assert.deepEqual({ ...LASER_BEAM }, { energy: 10, radius: 6, slew: 40 });
assert.deepEqual({ ...LASER_BURN }, { soft: 0, hard: 1, wall: 0.5, tower: 1.5, seal: 1, tank: 1, heart: 3 });
assert.deepEqual({ ...LASER_VIEW }, { altitude: 1.2, fov: 18, inset: 0.34, groundBack: 28, groundUp: 9 });
assert.deepEqual({ ...LASER_TRAIL }, { every: 2, quads: 400, seconds: 60 });
assert.equal(LASER_CONTACT_RATE, 8);
assert.equal(LASER_PRESET.burstRate, 0, 'a continuous beam, not a pulse train');
assert.equal(LASER_PRESET.coreWidth, 0.6);
assert.equal(LASER_PRESET.glowWidth, 5);

/* --- the clock ---------------------------------------------------------- */
{
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  assert.equal(st.phase, 'away');
  assert.equal(st.left, 160);
  assert.equal(st.energy, 10);
  assert.equal(st.burning, false);
  assert.equal(st.contact, null);
  assert.equal(st.contacts.size, 0);
  assert.equal(stepLaser(st, 100, LASER_ORBIT, LASER_BEAM), null);
  assert.equal(st.phase, 'away');
  assert.equal(stepLaser(st, 60, LASER_ORBIT, LASER_BEAM), 'arrive');
  assert.equal(st.phase, 'overhead');
  assert.equal(st.left, 20);
  /* burn it half down, then let the pass close */
  assert.equal(burnLaser(st, true, 4), true);
  assert.equal(st.energy, 6);
  st.contacts.set('x', { seconds: 1, reported: false });
  assert.equal(stepLaser(st, 20, LASER_ORBIT, LASER_BEAM), 'close');
  assert.equal(st.phase, 'away');
  assert.equal(st.left, 160);
  assert.equal(st.energy, 10, 'unused energy is lost and the budget is restored for the next pass');
  assert.equal(st.burning, false);
  assert.equal(st.contact, null);
  assert.equal(st.contacts.size, 0);
}

/* --- the slew ----------------------------------------------------------- */
{
  const R = 753;
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  stepLaser(st, 160, LASER_ORBIT, LASER_BEAM);
  const a = [0, R, 0];
  aimLaser(st, a, 1 / 60, LASER_BEAM);
  assert.deepEqual(st.contact, [0, R, 0], 'the first aim after arrival snaps');
  /* a far target: the contact moves exactly slew * dt metres of arc along the sphere */
  const far = [R * Math.sin(0.4), R * Math.cos(0.4), 0];
  const before = st.contact.slice();
  aimLaser(st, far, 0.1, LASER_BEAM);
  assert.ok(Math.abs(len3(st.contact) - R) < 1e-6, 'the contact stays on the sphere');
  const arc = R * Math.acos(Math.max(-1, Math.min(1, dot3(norm3(before), norm3(st.contact)))));
  assert.ok(Math.abs(arc - LASER_BEAM.slew * 0.1) < 1e-6, `moved ${arc} m, wanted ${LASER_BEAM.slew * 0.1}`);
  /* a near target is reached outright */
  const near = [st.contact[0] + 0.05, st.contact[1], st.contact[2]];
  const scaled = norm3(near).map((c) => c * R);
  aimLaser(st, scaled, 0.5, LASER_BEAM);
  assert.ok(Math.abs(st.contact[0] - scaled[0]) < 1e-9 && Math.abs(st.contact[2] - scaled[2]) < 1e-9, 'a near target snaps');
}

/* --- the burn accumulator ------------------------------------------------ */
{
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  stepLaser(st, 160, LASER_ORBIT, LASER_BEAM);
  const body = { id: 'b1', kind: 'soft', pos: [0, 753, 0] };
  const wall = { id: 'w1', kind: 'wall', pos: [1, 753, 0] };
  let done = burnContacts(st, [body, wall], 0.1, LASER_BURN);
  assert.deepEqual(done.map((d) => d.thing.id), ['b1'], 'soft dies on contact');
  assert.equal(done[0].kind, 'soft');
  assert.equal(done[0].done, true);
  done = burnContacts(st, [body, wall], 0.1, LASER_BURN);
  assert.deepEqual(done, [], 'a finished id is reported once');
  for (let i = 0; i < 2; i++) burnContacts(st, [wall], 0.1, LASER_BURN);
  assert.deepEqual(burnContacts(st, [wall], 0.2, LASER_BURN).map((d) => d.thing.id), ['w1'], 'a wall cuts through after 0.5 s');
  assert.equal(st.contacts.has('b1'), false, 'an id that left the footprint is forgotten');
  /* leaving and returning restarts the accumulation */
  const tower = { id: 't1', kind: 'tower', pos: [2, 753, 0] };
  burnContacts(st, [tower], 1.0, LASER_BURN);
  assert.equal(st.contacts.get('t1').seconds, 1);
  burnContacts(st, [], 0.1, LASER_BURN);
  assert.equal(st.contacts.has('t1'), false);
  burnContacts(st, [tower], 1.0, LASER_BURN);
  assert.equal(st.contacts.get('t1').seconds, 1, 'the accumulator restarts, it does not resume');
  /* an unknown kind never finishes */
  assert.deepEqual(burnContacts(st, [{ id: 'z', kind: 'rock', pos: [0, 753, 0] }], 99, LASER_BURN), []);
}

/* --- the energy drain ---------------------------------------------------- */
{
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  assert.equal(burnLaser(st, true, 1), false, 'no burning while the satellite is away');
  stepLaser(st, 160, LASER_ORBIT, LASER_BEAM);
  assert.equal(burnLaser(st, false, 1), false);
  assert.equal(st.energy, 10, 'energy drains only while it burns');
  assert.equal(burnLaser(st, true, 6), true);
  assert.equal(st.energy, 4);
  assert.equal(burnLaser(st, true, 9), true);
  assert.equal(st.energy, 0, 'the drain floors at zero');
  assert.equal(burnLaser(st, true, 1), false, 'out of energy while overhead');
  assert.equal(st.burning, false);
}

/* --- the HUD progress ---------------------------------------------------- */
{
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  assert.deepEqual(laserProgress(st, LASER_ORBIT, LASER_BEAM), { pass: 1, energy: 1 });
  stepLaser(st, 80, LASER_ORBIT, LASER_BEAM);
  assert.deepEqual(laserProgress(st, LASER_ORBIT, LASER_BEAM), { pass: 0.5, energy: 1 });
  stepLaser(st, 80, LASER_ORBIT, LASER_BEAM);
  burnLaser(st, true, 5);
  const p = laserProgress(st, LASER_ORBIT, LASER_BEAM);
  assert.equal(p.pass, 1);
  assert.equal(p.energy, 0.5);
  stepLaser(st, 15, LASER_ORBIT, LASER_BEAM);
  assert.equal(laserProgress(st, LASER_ORBIT, LASER_BEAM).pass, 0.25);
}

console.log('Orbital laser: the clock arrives and closes, the contact slews at its metres per second, burns accumulate per kind and are reported once, energy drains only while burning.');
```

- [ ] **Step 2:** Run it and watch it fail. Command: `node test/orbital-laser.mjs`. Expected output: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/src/content/orbital-laser.js'`.

- [ ] **Step 3:** Write the content module. Create `src/content/orbital-laser.js`:

```js
// The orbital laser's numbers (owner, 2026-09-15, docs/superpowers/specs/2026-09-15-orbital-laser-lab-design.md).
// An add-on to the gunship on a timer: a satellite passes over the base, and while it is overhead the player can burn.
// Pure data. No Three.js, no browser: the lab reads these and the panel edits a working copy of them.

// seconds between passes, and seconds overhead once it arrives
export const LASER_ORBIT = Object.freeze({ period: 180, overhead: 20 });

// energy: seconds of burn per pass; radius: footprint radius in metres; slew: how fast the contact point chases the pointer, m/s
export const LASER_BEAM = Object.freeze({ energy: 10, radius: 6, slew: 40 });

// seconds of contact needed to destroy each kind. A body dies the instant the footprint touches it; the Stalheart
// takes three seconds of deliberate dragging, which is long enough that nobody loses the colony by accident.
export const LASER_BURN = Object.freeze({ soft: 0, hard: 1.0, wall: 0.5, tower: 1.5, seal: 1.0, tank: 1.0, heart: 3.0 });

// altitude is in planet radii above the surface; fov in degrees; inset as a share of the viewport width;
// groundBack / groundUp are metres behind and above the contact for the ground camera
export const LASER_VIEW = Object.freeze({ altitude: 1.2, fov: 18, inset: 0.34, groundBack: 28, groundUp: 9 });

// The beam preset, in the keys src/beamfx.js DEFAULTS uses. Widths are METRES: the lab multiplies them by its own
// scene-units-per-metre before handing them to createBeam. burstRate 0 keeps the envelope continuous (beamfx
// returns 1 from burstEnvelope when the rate is zero), because this weapon is a held beam and not a pulse train.
export const LASER_PRESET = Object.freeze({
  coreColor: '#ffffff',
  coreWidth: 0.6,
  coreIntensity: 2.4,
  glowColor: '#6f7cff',
  glowWidth: 5,
  glowIntensity: 4.6,
  glowFalloff: 2.6,
  capStart: 0.02,
  capEnd: 0.985,
  blast: 0.4,
  scrollSpeed: -9,
  noiseScale: 21,
  noiseAmount: 0.45,
  flicker: 0.28,
  jitterAmount: 0.22,
  jitterFreq: 44,
  burstRate: 0,
  burstDuty: 0.54,
  burstDecay: 3.15,
  burstAttack: 0,
});

// the scorch trail: a quad every `every` metres of contact travel, `quads` of them at most, each fading over `seconds`
export const LASER_TRAIL = Object.freeze({ every: 2, quads: 400, seconds: 60 });

// how many contact bursts ride the contact point per second while it burns
export const LASER_CONTACT_RATE = 8;

// The audio-package keys the cues will carry. The package's beam section does not exist yet, so the lab asks for
// these by name and plays nothing until it does.
export const LASER_SOUNDS = Object.freeze({ arrive: 'laser_arrive', burn: 'laser_burn', contact: 'laser_contact', out: 'laser_out' });

// the sky anchor above the contact, in metres: high enough that the column reads as vertical from the ground camera
export const LASER_SKY_METRES = 400;
```

- [ ] **Step 4:** Write the domain module. Create `src/domain/orbital-laser.js`:

```js
// THE ORBITAL LASER'S RULES. A satellite passes over the base on a fixed period; while it is overhead the player can
// hold a continuous beam whose contact point chases a target along the sphere at a capped rate, so it draws heavy
// lines rather than teleporting. Energy is a per-pass budget spent only while burning, and anything standing in the
// footprint long enough for its kind is destroyed.
//
// Pure. Positions are [x, y, z] metres on a sphere CENTRED ON THE ORIGIN: the caller converts from whatever frame it
// renders in. The clock, the footprint test and the destruction all belong to the caller; this module owns the state.
import { norm3, len3, dot3, cross3, scale3 } from '../vec3.js';

export function makeLaser(orbit, beam) {
  return {
    phase: 'away',
    left: Math.max(0, orbit.period - orbit.overhead),
    energy: beam.energy,
    burning: false,
    contact: null,
    /* id -> { seconds, reported }: how long each thing has been under the beam without a break */
    contacts: new Map(),
    /* the next aim snaps instead of slewing: a fresh pass has no contact to drag from */
    fresh: true,
  };
}

// The clock. Returns 'arrive' the frame the satellite comes overhead, 'close' the frame the pass shuts, else null.
// At most one transition per call; the overshoot is carried into the next phase so a long step does not drift.
export function stepLaser(st, dt, orbit, beam) {
  st.left -= dt;
  if (st.left > 0) return null;
  if (st.phase === 'away') {
    st.phase = 'overhead';
    st.left = Math.max(0, orbit.overhead + st.left);
    st.fresh = true;
    return 'arrive';
  }
  st.phase = 'away';
  st.left = Math.max(0, (orbit.period - orbit.overhead) + st.left);
  st.energy = beam.energy;
  st.burning = false;
  st.contact = null;
  st.contacts.clear();
  st.fresh = true;
  return 'close';
}

// Moves the contact toward `target` ALONG THE SPHERE by at most beam.slew * dt metres. The sphere's radius is the
// target's own length, so the contact is rescaled onto the same surface the caller picked on. The first aim after an
// arrival snaps: there is nothing to drag from yet, and a lay that crawled in from the last pass would be a lie.
export function aimLaser(st, target, dt, beam) {
  const R = len3(target) || 1;
  if (!st.contact || st.fresh) {
    st.contact = [target[0], target[1], target[2]];
    st.fresh = false;
    return st.contact;
  }
  const a = norm3(st.contact), b = norm3(target);
  const cos = Math.max(-1, Math.min(1, dot3(a, b)));
  const full = Math.acos(cos);
  const axis = cross3(a, b);
  /* co-linear (already there, or exactly antipodal): there is no rotation plane to step through */
  if (full < 1e-9 || len3(axis) < 1e-12) {
    st.contact = [target[0], target[1], target[2]];
    return st.contact;
  }
  const step = Math.min(full, (beam.slew * dt) / R);
  if (step >= full) {
    st.contact = [target[0], target[1], target[2]];
    return st.contact;
  }
  const k = norm3(axis), c = Math.cos(step), s = Math.sin(step);
  /* Rodrigues about k. k is perpendicular to a, so the (k . a) term is zero and drops out. */
  const kxa = cross3(k, a);
  const rotated = [a[0] * c + kxa[0] * s, a[1] * c + kxa[1] * s, a[2] * c + kxa[2] * s];
  st.contact = scale3(norm3(rotated), R);
  return st.contact;
}

// Burning is held AND overhead AND still funded. Returns whether it burned this frame; drains the budget by dt.
export function burnLaser(st, held, dt) {
  const on = !!held && st.phase === 'overhead' && st.energy > 0;
  st.burning = on;
  if (!on) return false;
  st.energy = Math.max(0, st.energy - dt);
  return true;
}

// `things` are { id, kind, pos } ALREADY filtered to the footprint by the caller. Each id accumulates seconds while
// it stays there; the first call in which an id reaches burn[kind] reports it, once. An id that is not in `things`
// has left the footprint and is forgotten, so a body that ducks out and comes back starts again from zero.
export function burnContacts(st, things, dt, burn) {
  const finished = [], seen = new Set();
  for (const thing of things) {
    seen.add(thing.id);
    let rec = st.contacts.get(thing.id);
    if (!rec) { rec = { seconds: 0, reported: false }; st.contacts.set(thing.id, rec); }
    rec.seconds += dt;
    const need = burn[thing.kind];
    if (need === undefined || rec.reported) continue;
    if (rec.seconds >= need) {
      rec.reported = true;
      finished.push({ thing, kind: thing.kind, done: true });
    }
  }
  for (const id of [...st.contacts.keys()]) if (!seen.has(id)) st.contacts.delete(id);
  return finished;
}

// For the HUD: how much of the CURRENT phase is left, and how much of the pass's budget is left.
export function laserProgress(st, orbit, beam) {
  const span = st.phase === 'overhead' ? orbit.overhead : Math.max(1e-6, orbit.period - orbit.overhead);
  const clamp = (v) => Math.max(0, Math.min(1, v));
  return { pass: clamp(st.left / span), energy: clamp(st.energy / beam.energy) };
}
```

- [ ] **Step 5:** Run the tests. Commands: `node test/orbital-laser.mjs`, then `npm test`, then `npm run check`. Expected: the new program prints `Orbital laser: the clock arrives and closes, …`; `npm test` ends with `N test programs passed.` (N one higher than before); `npm run check` ends with `Syntax, source module identity, pinned kernel, logs and assets checked.` and no architecture problems.

- [ ] **Step 6:** Commit.

```
git add src/content/orbital-laser.js src/domain/orbital-laser.js test/orbital-laser.mjs
git commit -F - <<'EOF'
The orbital laser's rules: the pass clock, the slewing contact, the energy budget and the burn accumulator

src/content/orbital-laser.js carries the owner's first values (period 180 / window 20,
10 s of energy, a 6 m footprint, 40 m/s of slew, the burn seconds per kind, the view
and the beam preset). src/domain/orbital-laser.js is pure: makeLaser, stepLaser,
aimLaser (a rotation along the sphere capped at slew * dt metres, snapping on the
first aim of a pass), burnLaser, burnContacts (per-id seconds, reported once, forgotten
when a thing leaves the footprint) and laserProgress. test/orbital-laser.mjs pins all
of it, including that unused energy is lost when the pass closes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011cqDbj6h5baid4w2Vigrq3
EOF
```

---

## Task 2: the two explosion uses

**Files:**
- Modify: `src/content/explosions.js` — add two entries to `EXPLOSION_USES` (after line 13) and two to `EXPLOSION_SCARE` (after line 25)
- Test: `test/explosions-content.mjs` — extend the pinned key list at lines 4-5

**Interfaces:**
- Consumes: `EXPLOSION_MODULES` (`src/content/explosions.js:4`), the module metas under `src/fx/explosions/`.
- Produces: `EXPLOSION_USES['laser.ignite'] = { module: 'orbital-strike', scale: 0.5 }`, `EXPLOSION_USES['laser.contact'] = { module: 'rotary-pop', scale: 0.6 }`, `EXPLOSION_SCARE['laser.ignite'] = { cells: 8, seconds: 2 }`, `EXPLOSION_SCARE['laser.contact'] = { cells: 3, seconds: 0.6 }`.

- [ ] **Step 1:** Write the failing assertion. In `test/explosions-content.mjs`, replace lines 4-5 with the eight-use list:

```js
assert.deepEqual(Object.keys(EXPLOSION_USES).sort(),
  ['gunship.bofors', 'gunship.heavy', 'gunship.rotary', 'laser.contact', 'laser.ignite', 'quiver.talon', 'strike.orbital', 'tank.shell']);
```

- [ ] **Step 2:** Run it and watch it fail. Commands: `node test/explosions-content.mjs` then `node test/impact-scare.mjs`. Expected: the first fails with an `AssertionError` whose actual list is missing `laser.contact` and `laser.ignite`; the second still passes (it only pins that the two tables agree, `test/impact-scare.mjs:37`).

- [ ] **Step 3:** Add the uses. In `src/content/explosions.js`, after the `'strike.orbital'` line (line 13) inside `EXPLOSION_USES`, insert:

```js
  // THE ORBITAL LASER (owner, 2026-09-15): the touchdown of a lay is the orbital strike's cloud at half size, and
  // the contact point sheds rotary pops at LASER_CONTACT_RATE per second while it burns, so a line drawn across the
  // ground is a line of small blasts with one big one where the beam came down.
  'laser.ignite': Object.freeze({ module: 'orbital-strike', scale: 0.5 }),
  'laser.contact': Object.freeze({ module: 'rotary-pop', scale: 0.6 }),
```

And after the `'strike.orbital'` line (line 25) inside `EXPLOSION_SCARE`, insert:

```js
  'laser.ignite': Object.freeze({ cells: 8, seconds: 2 }),
  'laser.contact': Object.freeze({ cells: 3, seconds: 0.6 }),
```

- [ ] **Step 4:** Run the tests. Commands: `node test/explosions-content.mjs`, `node test/impact-scare.mjs`, `node test/explosions-adapter.mjs`, then `npm test`. Expected: `Explosion content: every use names a pinned module; caps cover every size.`, the impact-scare summary line, the adapter summary line, and `N test programs passed.`

- [ ] **Step 5:** Commit.

```
git add src/content/explosions.js test/explosions-content.mjs
git commit -F - <<'EOF'
The laser's two explosion uses: the touchdown cloud and the contact pops

laser.ignite is the orbital strike at half scale where a lay first touches down;
laser.contact is a rotary pop riding the contact point while the beam burns. Both
carry their scare (8 cells / 2 s and 3 cells / 0.6 s), so the swarm is herded off the
line the same way the gunship's rounds herd it. test/explosions-content.mjs pins the
eight uses; test/impact-scare.mjs already required the scare table to match.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011cqDbj6h5baid4w2Vigrq3
EOF
```

---

## Task 3: the look — `src/fx/orbital-laser.js`

**Files:**
- Create: `src/fx/orbital-laser.js`
- Test: none beyond `node --check` and the architecture guard (`npm run check`); Task 4's lab smoke step exercises it in a browser.

**Interfaces:**
- Consumes: `createBeam` (`src/beamfx.js:232`), `LASER_PRESET`, `LASER_BEAM`, `LASER_TRAIL`, `LASER_SKY_METRES` (`src/content/orbital-laser.js`), `vendor/three.module.js`.
- Produces: `createOrbitalLaser(scene, { cellSide, metresPerCell }) -> { lay(contact, normal), aim(contact, normal), lift(), tick(dt, energy01), trail, dispose() }`, where `contact` and `normal` are `THREE.Vector3` in the host scene's own space.

- [ ] **Step 1:** Write the module. Create `src/fx/orbital-laser.js`:

```js
// THE ORBITAL LASER'S LOOK. A near-vertical column from a sky anchor down to the contact point, a monochrome
// footprint ring on the ground, and a scorch trail of dark glassy quads laid every couple of metres of travel and
// fading over a minute. Local to whatever scene it is given: the caller hands it world points and a surface normal,
// so this file knows nothing about planets or frames.
//
// Widths in the preset are METRES. cellSide / metresPerCell is the host's scene units per metre, so a lab drawing in
// metres passes 10 / 10 and a board drawing in cells passes its own cell side.
import * as THREE from '../../vendor/three.module.js';
import { createBeam } from '../beamfx.js';
import { LASER_PRESET, LASER_BEAM, LASER_TRAIL, LASER_SKY_METRES } from '../content/orbital-laser.js';

const Y = new THREE.Vector3(0, 1, 0);

export function createOrbitalLaser(scene, { cellSide = 10, metresPerCell = 10 } = {}) {
  const unit = cellSide / metresPerCell;          /* scene units per metre */
  const group = new THREE.Group();
  group.name = 'Orbital laser';
  scene.add(group);

  /* --- the column ------------------------------------------------------- */
  const sky = new THREE.Vector3(), at = new THREE.Vector3(), up = new THREE.Vector3();
  const beam = createBeam(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), {
    ...LASER_PRESET,
    coreWidth: LASER_PRESET.coreWidth * unit,
    glowWidth: LASER_PRESET.glowWidth * unit,
    jitterAmount: LASER_PRESET.jitterAmount * unit,
  });
  beam.mesh.visible = false;
  group.add(beam.mesh);

  /* --- the footprint ring ----------------------------------------------- */
  const ringGeo = new THREE.RingGeometry(LASER_BEAM.radius * unit * 0.9, LASER_BEAM.radius * unit, 72);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xdfe8ee, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.renderOrder = 9;
  ring.visible = false;
  group.add(ring);

  /* --- the scorch trail -------------------------------------------------- */
  // A capped instanced quad ribbon. Per-instance age lives in an instanced attribute and fades the alpha in the
  // fragment shader: three.js has no per-instance opacity, and tinting toward a "ground colour" would be a lie on
  // ground that is three different colours. Oldest quad is recycled once the cap is reached.
  const CAP = LASER_TRAIL.quads;
  const quadGeo = new THREE.PlaneGeometry(1, 1);
  quadGeo.rotateX(-Math.PI / 2);
  const ages = new Float32Array(CAP).fill(LASER_TRAIL.seconds);
  const ageAttr = new THREE.InstancedBufferAttribute(ages, 1);
  quadGeo.setAttribute('aAge', ageAttr);
  const quadMat = new THREE.MeshBasicMaterial({
    color: 0x14110f, transparent: true, opacity: 0.92, depthWrite: false,
  });
  quadMat.polygonOffset = true;
  quadMat.polygonOffsetFactor = -2;
  quadMat.polygonOffsetUnits = -4;
  quadMat.onBeforeCompile = (shader) => {
    shader.uniforms.uLife = { value: LASER_TRAIL.seconds };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAge;\nvarying float vAge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAge = aAge;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLife;\nvarying float vAge;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= clamp(1.0 - vAge / uLife, 0.0, 1.0);');
  };
  quadMat.customProgramCacheKey = () => 'laser-scorch-age-v1';
  const trail = new THREE.InstancedMesh(quadGeo, quadMat, CAP);
  trail.name = 'Laser scorch';
  trail.count = 0;
  trail.frustumCulled = false;
  trail.renderOrder = 8;
  group.add(trail);

  const dummy = new THREE.Object3D();
  const last = new THREE.Vector3();
  let next = 0, written = 0, laid = false, clock = 0;
  const quadSize = LASER_BEAM.radius * unit * 1.5;

  function stamp(point, normal) {
    dummy.position.copy(point).addScaledVector(normal, 0.04 * unit);
    dummy.quaternion.setFromUnitVectors(Y, normal);
    dummy.scale.set(quadSize, 1, quadSize);
    dummy.updateMatrix();
    trail.setMatrixAt(next, dummy.matrix);
    ages[next] = 0;
    next = (next + 1) % CAP;
    written = Math.min(CAP, written + 1);
    trail.count = written;
    trail.instanceMatrix.needsUpdate = true;
    ageAttr.needsUpdate = true;
    last.copy(point);
  }

  function place(contact, normal) {
    at.copy(contact);
    up.copy(normal).normalize();
    sky.copy(at).addScaledVector(up, LASER_SKY_METRES * unit);
    beam.setEndpoints(sky, at);
    ring.position.copy(at).addScaledVector(up, 0.08 * unit);
    ring.quaternion.setFromUnitVectors(Y, up);
  }

  return {
    trail,

    // the beam comes down here: show it, and start the ribbon at this point
    lay(contact, normal) {
      place(contact, normal);
      beam.mesh.visible = true;
      ring.visible = true;
      laid = true;
      stamp(at, up);
    },

    // the contact has moved: follow it, and fill the gap with quads every LASER_TRAIL.every metres
    aim(contact, normal) {
      place(contact, normal);
      if (!laid) return;
      const step = LASER_TRAIL.every * unit;
      let gap = last.distanceTo(at);
      if (gap < step) return;
      const dir = at.clone().sub(last).normalize();
      const point = new THREE.Vector3();
      let walked = 0;
      while (gap - walked >= step) {
        walked += step;
        point.copy(last).addScaledVector(dir, walked);
        stamp(point, up);
        gap = last.distanceTo(at) + walked;   /* `last` moved to `point`: recompute the remaining run */
        walked = 0;
        if (last.distanceTo(at) < step) break;
      }
    },

    // the player let go, or the energy ran out: the column goes, the scorch stays
    lift() {
      beam.mesh.visible = false;
      ring.visible = false;
      laid = false;
    },

    tick(dt, energy01 = 1) {
      clock += dt;
      beam.update(clock);
      /* update() writes the burst envelope into uAlpha, so the energy fade has to come after it */
      beam.setAlpha(laid ? 0.35 + 0.65 * Math.max(0, Math.min(1, energy01)) : 0);
      ringMat.opacity = laid ? 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(clock * 9)) : 0;
      if (!written) return;
      for (let i = 0; i < written; i++) ages[i] += dt;
      ageAttr.needsUpdate = true;
    },

    dispose() {
      beam.mesh.geometry.dispose();
      beam.mesh.material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      quadGeo.dispose();
      quadMat.dispose();
      trail.dispose();
      scene.remove(group);
    },
  };
}
```

- [ ] **Step 2:** Check it parses and the guard is happy. Commands: `node --check src/fx/orbital-laser.js` then `npm run check`. Expected: no output from `node --check`; `npm run check` ends with `Syntax, source module identity, pinned kernel, logs and assets checked.`

- [ ] **Step 3:** Commit.

```
git add src/fx/orbital-laser.js
git commit -F - <<'EOF'
The laser's look: the column, the footprint ring and the scorch ribbon

createOrbitalLaser(scene, { cellSide, metresPerCell }) builds the beam through
src/beamfx.js with the content preset (metres scaled into the host's scene units), a
monochrome footprint ring at the contact, and a capped instanced quad ribbon that lays
a scorch every two metres of travel and fades each quad over sixty seconds through a
per-instance age attribute. lay / aim / lift / tick(dt, energy01) is the whole surface;
the alpha fade follows beam.update because update overwrites uAlpha.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011cqDbj6h5baid4w2Vigrq3
EOF
```

---

## Task 4: the lab route and its scene

**Files:**
- Create: `src/labs/laser-tab.js`
- Modify: `src/content/nav.js` line 36 — append `['laser', 'laser']` to `LABS`
- Modify: `src/main.js` line 37 — add the `laser` route after `sim`
- Modify: `labs.html` — add `<div id="tab-laser">` after the `#tab-sim` block (ends around `labs.html:193`)
- Test: `test/nav-content.mjs` (unchanged; it must go green with the new entry)

**Interfaces:**
- Consumes: `buildStoryPlanet`, `planetBake`, `buildStoryPlanetMesh`, `planBase`, `createStoryBase`, `ISLANDS/STRUCTURES/KIT/STAGES`, `createSinkhole`, `createBreachRubble`, `createExplosions`, `createThermalHeat`, `createOrbitalLaser`, `makeDotEnemy`, `makeDotBurst`, `loadGlbWithClips`, the domain and content laser modules, `applyScare/stampScare/isScared/scarePace`, `LOOKS`.
- Produces: `initLaserTab(root) -> { setActive(on), dispose() }`.

- [ ] **Step 1:** Add the navigation entry and the route. In `src/content/nav.js` replace line 36 with:

```js
const LABS = [['units', 'units'], ['swarm', 'swarm'], ['beam', 'beam'], ['audio', 'audio'], ['metal', 'metal'], ['story', 'story'], ['sentry', 'sentry / impact'], ['portal', 'breach'], ['laser', 'orbital laser'], ['sim', 'sim']];
```

In `src/main.js`, after the `sim:` line (line 37) inside `routes`, add:

```js
  laser: () => import('./labs/laser-tab.js').then(m => m.initLaserTab),
```

In `labs.html`, after the closing `</div>` of `<div id="tab-sim" …>`, add:

```html
<div id="tab-laser" class="tab tab-hidden">
    <div id="laser-app"></div>
    <div id="laser-hud"></div>
    <button id="laser-link" class="lab-link" type="button" title="deep link: copy this lab's current settings as a URL">&#8599;</button>
    <button id="laser-copy" type="button" title="copy the preset to the clipboard">&#10683;</button>
  </div>
```

- [ ] **Step 2:** Run the nav test and watch it fail on the missing controller. Command: `node test/nav-content.mjs`. Expected: it passes the route regex (the `main.js` line is there) — so the real failure is deferred to the browser. Confirm instead with `node --input-type=module -e "import('./src/labs/laser-tab.js')"`, which must fail with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3:** Write the lab controller's scene half. Create `src/labs/laser-tab.js`:

```js
// THE ORBITAL LASER LAB. The real story base at stage 6 — the shipped walls, the gate, the Stalheart, the foundry,
// the bays — two sentries on their story sockets, an open sinkhole down the sightline, and a trench between them
// with twenty bodies queueing in single file. The ground view is full screen; the satellite view is an inset in the
// corner, and the pointer only steers there.
//
// The lab owns its own integrator for the bodies (the swarm lab's shape: plain records, absolute-time idle ticks,
// retired rather than disposed) and its own destruction: it drops wall instances, hides structure holders and seals
// the sinkhole with rubble. It never touches the game's breachWallCell, destroyTower or sealedBreachCells.
//
// ONE FRAME GOTCHA, and it is load-bearing. The story world puts the POLE at the origin and the planet centre at
// (0, -radius, 0) (src/domain/base-plan.js:12). createExplosions passes Math.hypot(point) as the planet radius and
// createBreachRubble normalizes its footprint, so both assume a CENTRE-at-origin scene. Everything that assumes that
// hangs off `sphereRoot`, a group at (0, -radius, 0), and is handed planet-centred points; everything else uses the
// pole-origin world metres the base and the planet mesh are drawn in.
import * as THREE from '../../vendor/three.module.js';
import GUI from '../../vendor/lil-gui.esm.js';
import { LOOKS } from '../looks.js';
import { STORY_RECIPE, STORY_CLEARING } from '../content/story-defaults.js';
import { buildStoryPlanet } from '../domain/story-planet.js';
import { planetBake } from '../platform/planet-bake.js';
import { buildStoryPlanetMesh } from './story-planet-mesh.js';
import { planBase } from '../domain/base-plan.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../content/base-layout.js';
import { createStoryBase } from '../fx/story-base.js';
import { createSinkhole } from '../sinkhole.js';
import { createBreachRubble } from '../breach-rubble.js';
import { createExplosions } from '../fx/explosions.js';
import { EXPLOSION_SCARE, SCARE_FREEZE_S } from '../content/explosions.js';
import { applyScare, stampScare, isScared, scarePace } from '../domain/impact-scare.js';
import { createThermalHeat } from '../fx/thermal-heat.js';
import { createOrbitalLaser } from '../fx/orbital-laser.js';
import { makeDotEnemy, makeDotBurst } from '../units.js';
import { loadGlbWithClips } from '../glbmodels.js';
import { LASER_ORBIT, LASER_BEAM, LASER_BURN, LASER_VIEW, LASER_PRESET, LASER_CONTACT_RATE } from '../content/orbital-laser.js';
import { makeLaser, stepLaser, aimLaser, burnLaser, burnContacts, laserProgress } from '../domain/orbital-laser.js';
import { deepLink, wireDeepLink } from '../deeplink.js';
import { norm3 } from '../vec3.js';

const STAGE = 6;                                   /* the Stalheart's stage: the whole base stands */
const BODIES = 20;
const BODY_SPEED = 2.2;                            /* metres per second up the trench */
const BODY_GAP = 3.4;                              /* single file: metres between one body and the next */
const TRENCH_WIDTH = 4, TRENCH_DEPTH = 1.5;
const SENTRIES = [
  ['rotor', 'assets/models/sentries/rotor_t1.glb'],
  ['quiver', 'assets/models/sentries/quiver_t1.glb'],
];
const BODY_TYPES = ['amoeba', 'phage'];
const BODY_COLS = { walker: 0xdfe8ee, walkerHi: 0xffffff };
const Y = new THREE.Vector3(0, 1, 0);

export function initLaserTab(root) {
  const q = new URLSearchParams(location.search);
  const container = root.querySelector('#laser-app'), hud = root.querySelector('#laser-hud');
  const look = LOOKS.tronColors;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.bg);
  scene.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]));
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]);
  sun.position.set(120, 260, 90);
  scene.add(sun);

  /* the panel's working copy of the content; the panel edits this, never the frozen tables */
  const P = {
    period: LASER_ORBIT.period, overhead: LASER_ORBIT.overhead,
    energy: LASER_BEAM.energy, radius: LASER_BEAM.radius, slew: LASER_BEAM.slew,
    altitude: LASER_VIEW.altitude, fov: LASER_VIEW.fov, inset: LASER_VIEW.inset,
    groundBack: LASER_VIEW.groundBack, groundUp: LASER_VIEW.groundUp,
    burnSoft: LASER_BURN.soft, burnHard: LASER_BURN.hard, burnWall: LASER_BURN.wall,
    burnTower: LASER_BURN.tower, burnSeal: LASER_BURN.seal, burnHeart: LASER_BURN.heart,
    coreWidth: LASER_PRESET.coreWidth, glowWidth: LASER_PRESET.glowWidth,
    glowIntensity: LASER_PRESET.glowIntensity, noiseAmount: LASER_PRESET.noiseAmount,
  };
  const P0 = { ...P };
  for (const key of Object.keys(P)) {
    const v = q.get(key);
    if (v !== null && Number.isFinite(Number(v))) P[key] = Number(v);
  }
  const orbit = () => ({ period: P.period, overhead: P.overhead });
  const beamCfg = () => ({ energy: P.energy, radius: P.radius, slew: P.slew });
  const burnCfg = () => ({ soft: P.burnSoft, hard: P.burnHard, wall: P.burnWall, tower: P.burnTower, seal: P.burnSeal, tank: 1.0, heart: P.burnHeart });

  let active = false, disposed = false, frameId = 0, last = performance.now(), clock = 0;
  let planet = null, planetMesh = null, plan = null, base = null, sphereRoot = null;
  let explosions = null, rubble = null, sink = null, laser = null, thermal = null;
  let wallMeshes = [], wallCells = [], structs = [], sentries = [];
  let bodies = [], bursts = [], trench = null, trenchMesh = null;
  let ready = false, held = false, burningWas = false, contactTimer = 0, sealed = false;
  const errors = [];
  const run = { bodies: 0, walls: 0, towers: 0, sealed: 0, heart: 'INTACT' };
  const st = makeLaser(orbit(), beamCfg());
  let steerN = [0.5, 0.5], steering = false;

  const ground = new THREE.PerspectiveCamera(52, 1, 0.5, 8000);
  const sat = new THREE.PerspectiveCamera(P.fov, 1, 1, 40000);
  const ray = new THREE.Raycaster();
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpN = new THREE.Vector3();
  let R = 753, cellSide = 10, sphere = null, north = new THREE.Vector3(0, 0, -1);

  const toWorld = (p) => new THREE.Vector3(...planet.frameToWorld(p));
  const toCentre = (v) => [v.x, v.y + R, v.z];
  const fromCentre = (c) => new THREE.Vector3(c[0], c[1] - R, c[2]);
  const normalOf = (v) => tmpN.set(v.x, v.y + R, v.z).normalize().clone();
  const frameOfCell = (ci) => {
    const c = planet.graph.centers[ci];
    const f = planet.worldToFrame([c[0] * R, c[1] * R - R, c[2] * R]);
    return [f[0], f[2]];
  };

  /* --- the HUD ----------------------------------------------------------- */
  hud.innerHTML = '<div class="laser-lines">'
    + '<b>ORBITAL LASER</b>'
    + '<span id="laser-state">AWAY</span>'
    + '<span class="laser-bar"><i id="laser-window"></i></span>'
    + '<span id="laser-energy-label">ENERGY</span>'
    + '<span class="laser-bar"><i id="laser-energy"></i></span>'
    + '<span id="laser-read">—</span>'
    + '<span id="laser-lost" hidden>COLONY LOST</span>'
    + '</div>'
    + '<div class="laser-keys"><button id="laser-pass" type="button">PASS NOW</button>'
    + '<button id="laser-reset" type="button">RESET</button>'
    + '<span>hold the pointer in the inset to burn</span></div>';
  const elState = hud.querySelector('#laser-state'), elWindow = hud.querySelector('#laser-window');
  const elEnergy = hud.querySelector('#laser-energy'), elRead = hud.querySelector('#laser-read');
  const elLost = hud.querySelector('#laser-lost'), elEnergyLabel = hud.querySelector('#laser-energy-label');
  const style = document.createElement('style');
  style.textContent = '#laser-hud{position:absolute;left:0;top:0;right:0;padding:10px 14px;pointer-events:none;'
    + 'font:12px ui-monospace,Menlo,monospace;letter-spacing:1px;color:#dfe8ee;text-transform:uppercase}'
    + '#laser-hud .laser-lines{display:flex;gap:14px;align-items:center;flex-wrap:wrap}'
    + '#laser-hud .laser-bar{display:inline-block;width:120px;height:6px;border:1px solid #6d7b85;background:#0b0f12}'
    + '#laser-hud .laser-bar i{display:block;height:100%;width:0;background:#dfe8ee}'
    + '#laser-hud .laser-bar i.hot{background:#8e8983}'
    + '#laser-hud #laser-lost{color:#fff;border:1px solid #fff;padding:1px 6px}'
    + '#laser-hud .laser-keys{margin-top:8px;display:flex;gap:10px;align-items:center;pointer-events:auto}'
    + '#laser-hud button{font:inherit;color:inherit;background:#0b0f12;border:1px solid #6d7b85;padding:3px 10px;cursor:pointer}';
  root.appendChild(style);

  function paintHud() {
    const p = laserProgress(st, orbit(), beamCfg());
    const word = st.phase === 'overhead' ? (st.energy > 0 ? 'OVERHEAD' : 'OUT') : 'AWAY';
    const line = `${word} · ${Math.ceil(st.left).toString().padStart(2, '0')}`;
    if (elState.textContent !== line) elState.textContent = line;
    elWindow.style.width = `${Math.round(p.pass * 100)}%`;
    elEnergy.style.width = `${Math.round(p.energy * 100)}%`;
    elEnergy.classList.toggle('hot', st.energy <= 0);
    const label = st.energy <= 0 ? 'OUT' : 'ENERGY';
    if (elEnergyLabel.textContent !== label) elEnergyLabel.textContent = label;
    const read = `bodies ${run.bodies} · walls ${run.walls} · towers ${run.towers} · sinkhole ${sealed ? 'SEALED' : 'OPEN'}`
      + ` · stalheart ${run.heart} · ${st.energy.toFixed(1)} s left`;
    if (elRead.textContent !== read) elRead.textContent = read;
    elLost.hidden = run.heart !== 'LOST';
  }

  /* --- the trench --------------------------------------------------------- */
  // A strip cut into the frame: floor at -TRENCH_DEPTH, two inner faces up to ground level. Built from the sphere's
  // own frame, so it follows the curvature the same way the base does.
  function buildTrench(from, to) {
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const length = Math.hypot(dx, dz) || 1;
    const dir = [dx / length, dz / length], side = [-dir[1], dir[0]];
    const steps = Math.max(8, Math.round(length / 4));
    const half = TRENCH_WIDTH / 2;
    const pos = [], idx = [];
    const push = (x, z, y) => {
      const w = planet.frameToWorld([x, y, z]);
      pos.push(w[0], w[1], w[2]);
      return pos.length / 3 - 1;
    };
    const rows = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * length;
      const cx = from[0] + dir[0] * t, cz = from[1] + dir[1] * t;
      rows.push([
        push(cx + side[0] * half, cz + side[1] * half, 0.05),
        push(cx + side[0] * half, cz + side[1] * half, -TRENCH_DEPTH),
        push(cx - side[0] * half, cz - side[1] * half, -TRENCH_DEPTH),
        push(cx - side[0] * half, cz - side[1] * half, 0.05),
      ]);
    }
    for (let i = 0; i < steps; i++) {
      const a = rows[i], b = rows[i + 1];
      for (const [p, q] of [[0, 1], [1, 2], [2, 3]]) {
        idx.push(a[p], a[q], b[q], a[p], b[q], b[p]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'Trench';
    scene.add(mesh);
    return { mesh, from, dir, length, floorY: -TRENCH_DEPTH };
  }

  const trenchPoint = (s) => {
    const t = Math.max(0, Math.min(trench.length, s));
    return toWorld([trench.from[0] + trench.dir[0] * t, trench.floorY + 0.6, trench.from[1] + trench.dir[1] * t]);
  };

  /* --- the bodies --------------------------------------------------------- */
  function seatBody(b) {
    const w = trenchPoint(b.s);
    b.pos = [w.x, w.y, w.z];
    if (!b.obj) return;
    b.obj.position.copy(w);
    b.obj.quaternion.setFromUnitVectors(Y, normalOf(w));
  }

  function buildBodies() {
    for (const b of bodies) if (b.obj) { scene.remove(b.obj); b.obj.geometry.dispose(); b.obj.material.dispose(); }
    bodies = [];
    for (let i = 0; i < BODIES; i++) {
      const type = BODY_TYPES[i % BODY_TYPES.length];
      let obj = null;
      try { obj = makeDotEnemy(type, BODY_COLS, 1); } catch (e) { errors.push(`body ${i}: ${e}`); }
      if (obj) { obj.scale.setScalar(1.7); scene.add(obj); }
      const b = { id: `body-${i}`, type, obj, alive: true, s: trench.length - 4 - i * BODY_GAP, pos: [0, 0, 0] };
      b.s = Math.max(0, b.s);
      seatBody(b);
      bodies.push(b);
    }
  }

  function stepBodies(dt, now) {
    let ahead = trench.length;
    for (const b of bodies) {
      if (!b.alive) continue;
      stampScare(b, now);
      const pace = scarePace(b, now, SCARE_FREEZE_S);
      const dir = isScared(b, now) ? -1 : 1;
      b.s = Math.max(0, Math.min(ahead, b.s + dir * BODY_SPEED * pace * dt));
      ahead = Math.max(0, b.s - BODY_GAP);
      seatBody(b);
      b.obj?.userData.tick?.(clock);
    }
  }

  function burstAt(point, colorHex) {
    const b = makeDotBurst(colorHex, normalOf(point).toArray(), 36);
    b.position.copy(point);
    b.scale.setScalar(1.4);
    scene.add(b);
    bursts.push(b);
  }

  function stepBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      if (bursts[i].userData.tick?.(dt) === false) {
        scene.remove(bursts[i]);
        bursts[i].geometry.dispose();
        bursts[i].material.dispose();
        bursts.splice(i, 1);
      }
    }
  }

  /* --- explosions and the scare -------------------------------------------- */
  function fire(use, point) {
    const q = toCentre(point);
    const sc = EXPLOSION_SCARE[use];
    if (sc) applyScare(bodies, [point.x, point.y, point.z], { radius: sc.cells * cellSide, seconds: sc.seconds });
    return explosions ? explosions.spawn(use, q, norm3(q), cellSide) : false;
  }

  /* --- the world ----------------------------------------------------------- */
  async function build() {
    planet = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, planetBake());
    R = planet.radius;
    cellSide = planet.cellMetres;
    sphere = new THREE.Sphere(new THREE.Vector3(0, -R, 0), R);
    planetMesh = buildStoryPlanetMesh(planet, look, { wallMetres: STORY_RECIPE.wallMetres });
    scene.add(planetMesh);
    north.copy(toWorld([0, 0, -1])).sub(toWorld([0, 0, 0])).normalize();

    sphereRoot = new THREE.Group();
    sphereRoot.name = 'Planet-centred effects';
    sphereRoot.position.set(0, -R, 0);
    scene.add(sphereRoot);
    explosions = createExplosions(sphereRoot, { onError: (e) => errors.push(`explosions: ${e.message}`) });
    rubble = createBreachRubble(sphereRoot);

    const LAYOUT = { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES };
    plan = planBase(planet, LAYOUT, STAGE);
    base = createStoryBase(scene, {
      plan, placer: { toWorld }, metres: 1, kit: KIT, skip: ['sh02'], sfx: null,
    });
    await base.ready;
    for (const e of base.errors) errors.push(`base: ${e}`);

    /* the wall instances, by name off the base's group: createStoryBase does not return them */
    wallMeshes = base.group.children.filter((o) => o.isInstancedMesh && o.name === 'walls');
    wallCells = plan.walls.map((w, k) => ({
      id: `wall-${k}`, index: k, gone: false, p: toWorld([w.x, KIT.wallMetres / 2, w.z]),
    }));

    /* the structures the beam can take, by their holder */
    structs = [];
    for (const s of plan.structures) {
      const rec = base.structure(s.id);
      if (!rec || !rec.holder) continue;
      structs.push({
        id: s.id, holder: rec.holder, root: rec.root, gone: false,
        heart: s.id === 'stalheart', p: toWorld([s.x, 4, s.z]),
      });
    }

    /* the two sentries on their story sockets */
    for (let i = 0; i < SENTRIES.length; i++) {
      const socket = plan.sockets[i];
      if (!socket) continue;
      const [name, url] = SENTRIES[i];
      const glb = await loadGlbWithClips(url);
      if (!glb) { errors.push(`${name}: model missing`); continue; }
      const obj = glb.scene.clone(true);
      obj.scale.setScalar(3);
      const w = new THREE.Vector3(socket.pos[0] * R, socket.pos[1] * R - R, socket.pos[2] * R);
      const n = normalOf(w);
      obj.position.copy(w).addScaledVector(n, KIT.wallMetres);
      obj.quaternion.setFromUnitVectors(Y, n);
      scene.add(obj);
      sentries.push({ id: `sentry-${name}`, obj });
      structs.push({ id: `sentry-${name}`, holder: obj, root: obj, gone: false, heart: false, p: obj.position.clone() });
    }

    /* the trench: from the sinkhole's cell up the sightline to the gate */
    const holeF = plan.cells.fodder >= 0 ? frameOfCell(plan.cells.fodder) : [0, -240];
    const gateF = plan.gate ? [plan.gate.x, plan.gate.z] : [0, -120];
    trench = buildTrench(holeF, gateF);
    trenchMesh = trench.mesh;
    buildBodies();

    /* the sinkhole at the far end, standing on the planet, opened */
    sink = createSinkhole(sphereRoot, ground, { game: true });
    const holeW = toWorld([holeF[0], 0, holeF[1]]);
    const holeN = normalOf(holeW);
    sink.group.position.set(holeW.x, holeW.y + R, holeW.z);
    sink.group.quaternion.setFromUnitVectors(Y, holeN);
    sink.group.visible = true;
    sink.tune.planetRadius = R;
    sink.tune.sound = false;
    sinkPoint = holeW.clone();

    laser = createOrbitalLaser(scene, { cellSide, metresPerCell: 10 });
    thermal = createThermalHeat(() => ({ warm: [], hot: hotRoots() }), { every: 250 });

    frameGround(trenchPoint(trench.length * 0.5));
    ready = true;
  }

  let sinkPoint = new THREE.Vector3();

  function hotRoots() {
    const out = [];
    for (const id of st.contacts.keys()) {
      const s = structs.find((x) => x.id === id);
      if (s && !s.gone) out.push(s.root ?? s.holder);
    }
    return out;
  }

  /* --- the two cameras ------------------------------------------------------ */
  function frameGround(point) {
    const n = normalOf(point);
    /* behind the contact along the trench, so the column is always framed with the trench it is cutting */
    const back = tmpA.set(-trench.dir[0], 0, -trench.dir[1]);
    const backW = toWorld([trench.from[0] + back.x, 0, trench.from[1] + back.z]).sub(toWorld([trench.from[0], 0, trench.from[1]])).normalize();
    ground.position.copy(point).addScaledVector(backW, P.groundBack).addScaledVector(n, P.groundUp);
    ground.up.copy(n);
    ground.lookAt(point);
  }

  function frameSat(point) {
    const n = normalOf(point);
    sat.fov = P.fov;
    sat.position.copy(n).multiplyScalar(R * (1 + P.altitude)).add(tmpB.set(0, -R, 0));
    sat.up.copy(north);
    sat.lookAt(point);
    sat.updateProjectionMatrix();
  }

  function insetRect() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    if (h > w) return { x: 0, y: 0, w, h: Math.round(h * 0.4) };      /* portrait: a band across the top */
    const s = Math.round(w * P.inset);
    return { x: w - s - 12, y: h - s - 12, w: s, h: s };
  }

  // screen-to-sphere on the FAR camera: the inset is the only surface that steers
  function targetFromInset(nx, ny) {
    ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, 1 - ny * 2), sat);
    const hit = ray.ray.intersectSphere(sphere, new THREE.Vector3());
    return hit;
  }

  function onPointer(e) {
    const r = insetRect(), box = renderer.domElement.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    steering = x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (!steering) return;
    steerN = [(x - r.x) / r.w, (y - r.y) / r.h];
    if (e.type === 'pointerdown') held = true;
    e.preventDefault();
  }
  const onPointerUp = () => { held = false; };
  renderer.domElement.addEventListener('pointermove', onPointer, { passive: false });
  renderer.domElement.addEventListener('pointerdown', onPointer, { passive: false });
  addEventListener('pointerup', onPointerUp);
  addEventListener('pointercancel', onPointerUp);

  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    ground.aspect = w / h;
    ground.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  function render() {
    const dpr = renderer.getPixelRatio();
    const cr = renderer.domElement.getBoundingClientRect();
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cr.width * dpr, cr.height * dpr);
    renderer.render(scene, ground);
    const r = insetRect();
    const x = r.x * dpr, y = (cr.height - r.y - r.h) * dpr, w = r.w * dpr, h = r.h * dpr;   /* GL y runs from the bottom */
    sat.aspect = r.w / r.h;
    sat.updateProjectionMatrix();
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.clear(true, true, false);
    renderer.render(scene, sat);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cr.width * dpr, cr.height * dpr);
    renderer.autoClear = true;
  }

  function loop() {
    if (!active || disposed) return;
    frameId = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    if (!ready) { renderer.render(scene, ground); return; }
    step(dt);
    render();
  }

  function step(dt) {
    const edge = stepLaser(st, dt, orbit(), beamCfg());
    if (edge === 'close') laser.lift();
    stepBodies(dt, clock);
    stepBursts(dt);
    explosions?.tick(dt);
    sink?.update(dt, clock);
    base?.tick(dt, null, false, ground.position);
    laser.tick(dt, laserProgress(st, orbit(), beamCfg()).energy);
    const anchor = st.contact ? fromCentre(st.contact) : trenchPoint(trench.length * 0.5);
    frameSat(anchor);
    frameGround(anchor);
    paintHud();
  }

  function passNow() {
    if (st.phase === 'overhead') return;
    stepLaser(st, st.left, orbit(), beamCfg());
  }

  const api = {
    setActive(on) {
      active = on;
      if (on) { resize(); last = performance.now(); loop(); } else cancelAnimationFrame(frameId);
    },
    dispose() {
      if (disposed) return;
      disposed = true; active = false;
      cancelAnimationFrame(frameId);
      removeEventListener('resize', resize);
      removeEventListener('pointerup', onPointerUp);
      removeEventListener('pointercancel', onPointerUp);
      thermal?.dispose();
      laser?.dispose();
      sink?.dispose();
      explosions?.dispose();
      base?.dispose();
      planetMesh?.userData.dispose?.();
      if (trenchMesh) { scene.remove(trenchMesh); trenchMesh.geometry.dispose(); trenchMesh.material.dispose(); }
      for (const b of bodies) if (b.obj) { scene.remove(b.obj); b.obj.geometry.dispose(); b.obj.material.dispose(); }
      for (const b of bursts) { scene.remove(b); b.geometry.dispose(); b.material.dispose(); }
      style.remove();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  hud.querySelector('#laser-pass').onclick = passNow;
  hud.querySelector('#laser-reset').onclick = () => { location.reload(); };
  resize();
  build().catch((e) => { errors.push(`build: ${e.message}`); });
  return api;
}
```

- [ ] **Step 4:** Run the tests. Commands: `node test/nav-content.mjs`, `npm test`, `npm run check`. Expected: `Nav content: PLAYTEST and DEV entries are complete, labs are routes, jumps are game URLs, docs exist.`, `N test programs passed.`, and `Syntax, source module identity, pinned kernel, logs and assets checked.` with no `lab depends on the game controller` line.

- [ ] **Step 5:** Smoke it by hand. Command: `npm run dev` in one shell, open `http://127.0.0.1:8155/labs.html#laser`, confirm the base, the two sentries, the trench with bodies and the corner inset all draw, then stop the server. If the console reports a missing wall `InstancedMesh`, check that the lookup runs **after** `await base.ready`.

- [ ] **Step 6:** Commit.

```
git add src/labs/laser-tab.js src/content/nav.js src/main.js labs.html
git commit -F - <<'EOF'
The orbital laser lab: the real base, a trench of bodies, and the split view

labs.html#laser stands up the shipped story base at stage 6 through buildStoryPlanet /
planBase / createStoryBase, two sentries on their story sockets, an open sinkhole down
the sightline and a trench between them with twenty bodies queueing in single file on
the lab's own integrator. The ground view is full screen and the satellite view is a
scissored inset in the corner (a band across the top in portrait); the pointer steers
only inside the inset, through a screen-to-sphere pick on the far camera.

The frame gotcha is recorded in the file: the story world puts the pole at the origin,
so the explosion adapter, the sinkhole and the rubble — all of which assume a
centre-at-origin scene — hang off one sphereRoot group at (0, -radius, 0).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011cqDbj6h5baid4w2Vigrq3
EOF
```

---

## Task 5: burning — the footprint, the destruction, the bursts and the heat

**Files:**
- Modify: `src/labs/laser-tab.js` — add the collect/burn/destroy block before `function step(dt)` and call it from `step`
- Test: none new; `npm test` and `npm run check` stay green, and the lab is exercised by hand

**Interfaces:**
- Consumes: `aimLaser`, `burnLaser`, `burnContacts` (`src/domain/orbital-laser.js`), `laser.lay/aim/lift`, `fire(use, point)`, `rubble.add(source, radius)`, `thermal.set(on)`.
- Produces: `collect()`, `applyBurn(dt)`, `destroy(entry)` inside the controller; the readout counters in `run`.

- [ ] **Step 1:** Add the footprint collector. In `src/labs/laser-tab.js`, insert immediately above `function step(dt) {`:

```js
  /* --- what is under the beam ---------------------------------------------- */
  // Everything inside the footprint, tagged with the kind whose burn seconds apply. The domain module does the
  // accounting; this only answers "what is standing here right now".
  function collect(point) {
    const out = [], r = P.radius, r2 = r * r;
    const near = (p) => {
      const dx = p.x - point.x, dy = p.y - point.y, dz = p.z - point.z;
      return dx * dx + dy * dy + dz * dz <= r2;
    };
    for (const b of bodies) {
      if (!b.alive) continue;
      tmpA.set(b.pos[0], b.pos[1], b.pos[2]);
      if (near(tmpA)) out.push({ id: b.id, kind: 'soft', pos: b.pos, body: b });
    }
    for (const w of wallCells) {
      if (w.gone || !near(w.p)) continue;
      out.push({ id: w.id, kind: 'wall', pos: [w.p.x, w.p.y, w.p.z], wall: w });
    }
    for (const s of structs) {
      if (s.gone || !near(s.p)) continue;
      out.push({ id: s.id, kind: s.heart ? 'heart' : 'tower', pos: [s.p.x, s.p.y, s.p.z], struct: s });
    }
    if (!sealed && near(sinkPoint)) {
      out.push({ id: 'sinkhole', kind: 'seal', pos: [sinkPoint.x, sinkPoint.y, sinkPoint.z], sink: true });
    }
    return out;
  }

  /* --- the destruction reads ------------------------------------------------ */
  // A wall cell burns out: its instance drops out of every wall InstancedMesh (a zero matrix), a dot burst marks it,
  // and the gap is permanent. A structure hides its holder. The Stalheart does that and ends the colony. The
  // sinkhole takes the rubble cap. None of this touches the game's own breach or tower paths.
  const ZERO = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

  function destroy(entry) {
    const thing = entry.thing;
    if (thing.body) {
      thing.body.alive = false;
      if (thing.body.obj) thing.body.obj.visible = false;
      burstAt(tmpA.set(thing.pos[0], thing.pos[1], thing.pos[2]).clone(), 0xdfe8ee);
      run.bodies++;
      return;
    }
    if (thing.wall) {
      thing.wall.gone = true;
      for (const mesh of wallMeshes) {
        mesh.setMatrixAt(thing.wall.index, ZERO);
        mesh.instanceMatrix.needsUpdate = true;
      }
      burstAt(thing.wall.p.clone(), 0x8e8983);
      fire('laser.ignite', thing.wall.p);
      run.walls++;
      return;
    }
    if (thing.struct) {
      thing.struct.gone = true;
      thing.struct.holder.visible = false;
      burstAt(thing.struct.p.clone(), 0xdfe8ee);
      fire('laser.ignite', thing.struct.p);
      if (thing.struct.heart) { run.heart = 'LOST'; } else { run.towers++; }
      return;
    }
    if (thing.sink) {
      sealed = true;
      try { rubble.add(sink.group, sink.tune.craterRadius ?? 6); } catch (e) { errors.push(`rubble: ${e.message}`); }
      sink.group.visible = false;
      fire('laser.ignite', sinkPoint);
      run.sealed++;
    }
  }

  /* --- the beam, per frame -------------------------------------------------- */
  function applyBurn(dt) {
    const hit = steering || held ? targetFromInset(steerN[0], steerN[1]) : null;
    if (hit) aimLaser(st, toCentre(hit), dt, beamCfg());
    const burning = burnLaser(st, held, dt);
    const point = st.contact ? fromCentre(st.contact) : null;
    if (!burning || !point) {
      if (burningWas) { laser.lift(); thermal.set(false); }
      burningWas = false;
      contactTimer = 0;
      return;
    }
    const n = normalOf(point);
    if (!burningWas) {
      laser.lay(point, n);
      fire('laser.ignite', point);
      thermal.set(true);
      contactTimer = 0;
    } else {
      laser.aim(point, n);
    }
    burningWas = true;
    /* the contact sheds pops at LASER_CONTACT_RATE per second while it burns */
    contactTimer += dt;
    const every = 1 / LASER_CONTACT_RATE;
    while (contactTimer >= every) { contactTimer -= every; fire('laser.contact', point); }
    for (const entry of burnContacts(st, collect(point), dt, burnCfg())) destroy(entry);
  }
```

- [ ] **Step 2:** Call it from the frame. In `function step(dt)`, replace the line `stepBodies(dt, clock);` with:

```js
    applyBurn(dt);
    stepBodies(dt, clock);
```

- [ ] **Step 3:** Run the checks. Commands: `node --check src/labs/laser-tab.js`, `npm test`, `npm run check`. Expected: no output from `node --check`; the test and check summary lines as in Task 4.

- [ ] **Step 4:** Smoke it by hand. Command: `npm run dev`, open `http://127.0.0.1:8155/labs.html#laser`, press `PASS NOW`, then press and drag in the inset across the trench. Expect: a column of light, the footprint ring, a scorch ribbon behind it, bodies vanishing with dot bursts, the wall cells dropping out with a gap, the readout counting up. Stop the server.

- [ ] **Step 5:** Commit.

```
git add src/labs/laser-tab.js
git commit -F - <<'EOF'
Burning in the laser lab: the footprint, the destruction reads and the heat

Each frame the lab collects what stands in the footprint — bodies, wall cells,
structures including the Stalheart, and the open sinkhole — hands them to
burnContacts, and acts on what finishes: a wall cell drops out of every wall
InstancedMesh with a zero matrix and leaves a permanent gap, a structure's holder goes
dark, the sinkhole takes a rubble cap, and the Stalheart ends the colony with the
COLONY LOST line. laser.ignite marks each touchdown, laser.contact rides the contact at
eight per second, and their scare herds the queue off the line; structures under the
beam go hot in thermal while they burn.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011cqDbj6h5baid4w2Vigrq3
EOF
```

---

## Task 6: the panel, the deep link and the test hooks

**Files:**
- Modify: `src/labs/laser-tab.js` — add the lil-gui panel, `COPY PRESET`, the deep link and `window.__stalheartLaserTest`, immediately above `hud.querySelector('#laser-pass').onclick = passNow;`
- Test: `npm test` / `npm run check` stay green

**Interfaces:**
- Consumes: `GUI` (`vendor/lil-gui.esm.js`), `deepLink`/`wireDeepLink` (`src/deeplink.js:73`, `:106`), the `P`/`P0` working copies.
- Produces: `window.__stalheartLaserTest = { state(), passNow(), steer(nx, ny), hold(bool), reset(), dispose() }`.

- [ ] **Step 1:** Add the panel and the hooks. In `src/labs/laser-tab.js`, insert above `hud.querySelector('#laser-pass').onclick = passNow;`:

```js
  /* --- the panel ------------------------------------------------------------ */
  const gui = new GUI({ title: 'ORBITAL LASER', container: root });
  const gp = gui.addFolder('the pass');
  gp.add(P, 'period', 20, 400, 1).name('period (s)');
  gp.add(P, 'overhead', 4, 90, 1).name('overhead (s)');
  gp.add(P, 'energy', 1, 40, 0.5).name('energy (s of burn)');
  gp.open();
  const gb = gui.addFolder('the beam');
  gb.add(P, 'radius', 1, 30, 0.5).name('footprint (m)');
  gb.add(P, 'slew', 4, 200, 1).name('slew (m/s)');
  gb.add(P, 'coreWidth', 0.05, 3, 0.05).name('core width (m)');
  gb.add(P, 'glowWidth', 0.5, 20, 0.5).name('glow width (m)');
  gb.add(P, 'glowIntensity', 0, 12, 0.1).name('glow intensity');
  gb.add(P, 'noiseAmount', 0, 1, 0.01).name('interference');
  gb.open();
  const gv = gui.addFolder('the view');
  gv.add(P, 'altitude', 0.2, 4, 0.05).name('altitude (radii)');
  gv.add(P, 'fov', 4, 60, 0.5).name('satellite fov');
  gv.add(P, 'inset', 0.15, 0.6, 0.01).name('inset (share of width)');
  gv.add(P, 'groundBack', 6, 120, 1).name('ground camera back (m)');
  gv.add(P, 'groundUp', 1, 60, 1).name('ground camera up (m)');
  gv.open();
  const gk = gui.addFolder('seconds to destroy');
  gk.add(P, 'burnSoft', 0, 4, 0.05).name('soft body');
  gk.add(P, 'burnHard', 0, 6, 0.05).name('hard body');
  gk.add(P, 'burnWall', 0, 6, 0.05).name('wall cell');
  gk.add(P, 'burnTower', 0, 8, 0.05).name('tower');
  gk.add(P, 'burnSeal', 0, 8, 0.05).name('sinkhole');
  gk.add(P, 'burnHeart', 0, 20, 0.1).name('stalheart');
  gk.open();
  const actions = {
    passNow,
    reset() { location.reload(); },
    copyPreset() { copyPreset(); },
  };
  const ga = gui.addFolder('actions');
  ga.add(actions, 'passNow').name('PASS NOW');
  ga.add(actions, 'reset').name('RESET');
  ga.add(actions, 'copyPreset').name('COPY PRESET');
  ga.open();

  let flashT = 0, flashMsg = '';
  function flash(msg) { flashMsg = msg; flashT = 2; console.log(`LASERLAB ${msg}`); }

  function presetJson() {
    return JSON.stringify({
      LASER_ORBIT: { period: P.period, overhead: P.overhead },
      LASER_BEAM: { energy: P.energy, radius: P.radius, slew: P.slew },
      LASER_BURN: burnCfg(),
      LASER_VIEW: { altitude: P.altitude, fov: P.fov, inset: P.inset, groundBack: P.groundBack, groundUp: P.groundUp },
      LASER_PRESET: { ...LASER_PRESET, coreWidth: P.coreWidth, glowWidth: P.glowWidth, glowIntensity: P.glowIntensity, noiseAmount: P.noiseAmount },
    }, null, 2);
  }

  function copyPreset() {
    const json = presetJson();
    const ok = () => { flash('preset copied to clipboard'); console.log('LASERLAB preset:\n' + json); };
    const fail = (why) => {
      /* the clipboard refuses on an unfocused document; the textarea route still works, and the console always has it */
      try {
        const ta = document.createElement('textarea');
        ta.value = json; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const done = document.execCommand('copy');
        ta.remove();
        flash(done ? 'preset copied (fallback)' : 'copy refused — see console');
      } catch { flash('copy refused — see console'); }
      console.log(`LASERLAB preset (clipboard ${why}):\n` + json);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(ok, () => fail('refused'));
    else fail('unavailable');
  }

  root.querySelector('#laser-copy').onclick = copyPreset;
  wireDeepLink(root.querySelector('#laser-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'laser', params: P, defaults: P0, carry: location.search,
  }), { label: 'LASER', flash });

  /* --- the harness's hands --------------------------------------------------- */
  window.__stalheartLaserTest = {
    state: () => ({
      ready,
      phase: st.phase,
      left: +st.left.toFixed(2),
      energy: +st.energy.toFixed(2),
      burning: st.burning,
      contact: st.contact ? st.contact.map((c) => +c.toFixed(2)) : null,
      bodiesBurned: run.bodies,
      wallsCut: run.walls,
      towersLost: run.towers,
      sinkholeSealed: sealed,
      heart: run.heart,
      alive: bodies.filter((b) => b.alive).length,
      walls: wallCells.length,
      structures: structs.length,
      sentries: sentries.length,
      trail: laser ? laser.trail.count : 0,
      heated: thermal ? thermal.heated() : 0,
      explosions: explosions ? explosions.state() : null,
      flash: flashT > 0 ? flashMsg : null,
      errors: errors.slice(),
    }),
    passNow,
    steer: (nx, ny) => { steerN = [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))]; steering = true; },
    hold: (on) => { held = !!on; },
    reset: () => { location.reload(); },
    dispose: api.dispose,
  };
```

- [ ] **Step 2:** Tick the flash timer so `state().flash` clears. In `function step(dt)`, add as the last line:

```js
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
```

- [ ] **Step 3:** Run the checks. Commands: `node --check src/labs/laser-tab.js`, `npm test`, `npm run check`. Expected: silence from `node --check`, then the usual two summary lines.

- [ ] **Step 4:** Smoke the panel by hand. Command: `npm run dev`, open `http://127.0.0.1:8155/labs.html?dlprobe=1#laser`, confirm the panel opens, `PASS NOW` jumps the clock, the deep-link button rewrites the address bar after 2.5 s, and `COPY PRESET` logs `LASERLAB preset:`. Stop the server.

- [ ] **Step 5:** Commit.

```
git add src/labs/laser-tab.js
git commit -F - <<'EOF'
The laser lab's panel: the sliders, PASS NOW, RESET, COPY PRESET and the test hooks

Every number the spec names is on the panel — the pass, the beam, the view and the
seconds to destroy per kind — over a working copy the URL can seed, with the beam lab's
deep link and its clipboard-then-textarea-then-console copy chain. COPY PRESET prints
the four content tables in the shape src/content/orbital-laser.js carries them, because
the FX package has no beam section yet and this lab does not create one.
window.__stalheartLaserTest exposes state(), passNow(), steer(nx, ny) in
inset-normalised coordinates, hold(bool), reset() and dispose() for the browser suite.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011cqDbj6h5baid4w2Vigrq3
EOF
```

---

## Task 7: the `--laser` browser step, the STATE line and the log entry

**Files:**
- Modify: `scripts/browser-test.mjs` — new `else if(args.includes('--laser'))` branch after the `--missile-parity` block, before `} else if(authoringWorkspace) {` (around line 599)
- Modify: `docs/STATE.md` line 19 — add the laser lab to the workshop list
- Create: `/private/tmp/laser-log.json` (scratch input for `npm run log -- add`), which writes `docs/log/entries/2026-09-15-orbital-laser-lab-landed.json`

**Interfaces:**
- Consumes: `go`, `until`, `evaluate`, `delay`, `finish`, `current` (`scripts/browser-test.mjs:21-49`); `window.__stalheartLaserTest` from Task 6.
- Produces: the `laser-lab-*` screenshots under `artifacts/browser/`, the STATE line and the decision entry.

- [ ] **Step 1:** Add the browser step. In `scripts/browser-test.mjs`, after the closing `}` of the `--missile-parity` block and before `} else if(authoringWorkspace) {`, insert:

```js
 } else if(args.includes('--laser')) {
 // THE ORBITAL LASER LAB. Open it, wait for the real base, jump the clock to a pass, then hold the beam and drag it
 // across the trench through the test hook — the pointer only steers inside the inset, so the hook speaks in
 // inset-normalised coordinates. The assertion is the point of the lab: bodies burn and the wall gives way.
 await go('laser-lab-load','labs.html?sw=0&acceptance=1#laser');
 await until('window.__stalheartLaserTest?.state().ready',120000);
 {const s=await evaluate('window.__stalheartLaserTest.state()');
  assert.deepEqual(s.errors,[],'the lab builds the base without error');
  assert(s.alive>=20,`the trench queues its bodies (${s.alive})`);
  assert(s.walls>=10,`the shipped walls stand (${s.walls})`);
  assert(s.structures>=6,`the base structures and the sentries are pickable (${s.structures})`);
  assert.equal(s.phase,'away');assert.equal(s.heart,'INTACT');}
 await finish();
 await evaluate('window.__stalheartLaserTest.passNow()');
 await until('window.__stalheartLaserTest.state().phase==="overhead"');
 current='laser-lab-overhead';await finish();
 // drag the contact across the trench for two seconds: sixteen steps from one side of the inset to the other
 await evaluate('window.__stalheartLaserTest.steer(0.5,0.62);window.__stalheartLaserTest.hold(true)');
 for(let i=0;i<16;i++){
  const t=i/15;
  await evaluate(`window.__stalheartLaserTest.steer(${(0.38+t*0.24).toFixed(4)},${(0.62-t*0.16).toFixed(4)})`);
  await delay(125);
 }
 await evaluate('window.__stalheartLaserTest.hold(false)');
 {const s=await evaluate('window.__stalheartLaserTest.state()');
  assert(s.bodiesBurned>0,`the beam burned bodies (${s.bodiesBurned})`);
  assert(s.wallsCut>0,`the beam cut the wall (${s.wallsCut})`);
  assert(s.trail>0,`the scorch trail was laid (${s.trail})`);
  assert(s.energy<10,`the pass spent energy (${s.energy})`);
  assert.deepEqual(s.errors,[],'burning raises no errors');}
 current='laser-lab-burn';await finish();
 await evaluate('window.__stalheartLaserTest.dispose()');
```

- [ ] **Step 2:** Check memory, then run the suite. Commands: `~/scripts/check-memory.sh` (expect `level=OK`; if it prints WARN, wait and retry rather than adding load), then `npm run test:browser -- --laser`. Expected output: `PASS laser-lab-load`, `PASS laser-lab-overhead`, `PASS laser-lab-burn`, and three PNGs under `artifacts/browser/`. If `laser-lab-burn` fails on `wallsCut`, widen the drag's normalised span (`0.38 → 0.62` above) so the line crosses the wall rim, not the sweep length.

- [ ] **Step 3:** Look at the screenshot. Command: `open artifacts/browser/laser-lab-burn.png`. Expected: the ground view full screen with the column standing in the trench, the scorch ribbon behind it, and the satellite inset bottom-right showing the base as a small target with the planet's limb in the corners.

- [ ] **Step 4:** Add the STATE line. In `docs/STATE.md`, replace line 19 with:

```md
- Workshop labs: units, swarm, beam, audio, metal, story, sentry/impact, breach (`labs.html#portal`, the sinkhole), orbital laser (`labs.html#laser`, the timed satellite beam over the real base — rules in `src/domain/orbital-laser.js`, numbers in `src/content/orbital-laser.js`, browser step `npm run test:browser -- --laser`), sim and the docs overlay (FunMap, roadmap, devlog, practices) under DEV.
```

- [ ] **Step 5:** Write the log entry. Create `/private/tmp/laser-log.json`:

```json
{
  "schema": 1,
  "id": "2026-09-15-orbital-laser-lab-landed",
  "date": "2026-09-15T18:00:00+00:00",
  "type": "change",
  "status": "accepted",
  "title": "The orbital laser's rules and its lab: a timed satellite beam burning the real base from a satellite inset",
  "context": "Owner, 2026-09-15 (2026-09-15-orbital-laser-brainstorm, 2026-09-15-orbital-laser-lab-design): the orbital laser is an add-on to the gunship on a timer; the satellite view must feel high; the ground reality of the destruction is full screen with the satellite far view as a large inset where the pointer steers; the Stalheart can be destroyed if the beam is misused; build the lab first, with real map elements and a line of enemies in a trench. Sub-project 1 is the rules, the look and the lab only.",
  "outcome": "src/content/orbital-laser.js carries the first values (period 180 / window 20 s, 10 s of energy, a 6 m footprint, 40 m/s of slew, the burn seconds per kind, the view and the beam preset). src/domain/orbital-laser.js is pure and Node-tested (test/orbital-laser.mjs): makeLaser, stepLaser, aimLaser (a rotation along the sphere capped at slew * dt metres, snapping on the first aim of a pass), burnLaser, burnContacts (per-id seconds, reported once, forgotten when a thing leaves the footprint) and laserProgress. src/fx/orbital-laser.js builds the column through src/beamfx.js, the footprint ring and a 400-quad scorch ribbon fading over 60 s. labs.html#laser (src/labs/laser-tab.js) stands up the shipped story base at stage 6, two sentries on their story sockets, an open sinkhole down the sightline and a trench of twenty bodies on the lab's own integrator, renders the ground view full screen with a scissored satellite inset (a band across the top in portrait), steers only inside the inset through a screen-to-sphere pick, and destroys by dropping wall instances, hiding structure holders, sealing the sinkhole with rubble and ending the colony on the Stalheart. laser.ignite and laser.contact joined EXPLOSION_USES and EXPLOSION_SCARE so the existing scare herds the queue. A --laser step in scripts/browser-test.mjs opens the lab, jumps the clock, drags the beam across the trench for two seconds and asserts bodies burned and a wall cut, with a screenshot for the owner.",
  "alternatives": [
    "Wire the weapon straight into the story (the strip button, the call-in window and the acceptance step) without a lab first; rejected because the owner asked to judge the look and the destruction on real map elements before it reaches the game.",
    "Draw the satellite view into a second renderer or a render target rather than scissoring one scene; rejected because src/fx/story-monitor.js already proves the one-renderer scissor on this scene and a second context is a second GPU budget on a 16 GB machine.",
    "Give the lab its own flat ground and stand-in props; rejected because the spec's whole point is that the walls, the Stalheart, the foundry and the structures are the shipped ones."
  ],
  "evidence": [
    "test/orbital-laser.mjs: the clock arrives and closes, unused energy is lost, the contact moves exactly slew * dt metres of arc, soft dies at once and a wall cuts through after 0.5 s, an id that leaves the footprint is forgotten.",
    "test/explosions-content.mjs pins the eight explosion uses; test/impact-scare.mjs already required the scare table to match, so laser.ignite and laser.contact carry their scare.",
    "npm test and npm run check green: layer purity for src/domain and src/content, no new top-level src/*.js, the td-tab budget untouched, no lab reaching the game controller.",
    "npm run test:browser -- --laser: PASS laser-lab-load, laser-lab-overhead and laser-lab-burn, with bodies burned > 0 and walls cut > 0 and artifacts/browser/laser-lab-burn.png for the owner.",
    "The story world puts the pole at the origin (src/domain/base-plan.js:12) while createExplosions (planetRadius: Math.hypot(point)) and createBreachRubble (.normalize()) assume a centre-at-origin scene; the lab parents both to one sphereRoot group at (0, -radius, 0) and hands them planet-centred points."
  ],
  "supersedes": []
}
```

- [ ] **Step 6:** Append it and re-check. Commands: `npm run log -- add /private/tmp/laser-log.json`, then `npm run check`, then `git status --short docs/`. Expected: the command writes `docs/log/entries/2026-09-15-orbital-laser-lab-landed.json` and regenerates `DEVLOG.md`; `npm run check` ends with its summary line; `git status` shows the new entry, the regenerated `DEVLOG.md` and the edited `docs/STATE.md`.

- [ ] **Step 7:** Commit.

```
git add scripts/browser-test.mjs docs/STATE.md docs/log/entries/2026-09-15-orbital-laser-lab-landed.json DEVLOG.md
git commit -F - <<'EOF'
The --laser browser step, the STATE line and the log entry for the lab

npm run test:browser -- --laser opens labs.html#laser, waits for the real base, jumps
the clock to a pass, holds the beam and drags it across the trench for two seconds
through the test hook, then asserts bodies burned > 0, walls cut > 0 and a scorch trail
laid, with three screenshots for the owner. docs/STATE.md lists the lab under the
workshop; the decision entry records the values, the split view, the destruction reads
and the pole-versus-centre frame gotcha the composition had to solve.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011cqDbj6h5baid4w2Vigrq3
EOF
```
