# The Nih-Dairia boss lab: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** port the owner's Nih-Dairia soft-body creature kit onto Stalheart's vendored three r160 and put it, at boss size, on a patch of the story planet in a Workshop lab where the tank is its prey and the frame cost is on screen.

**Architecture:** the port lives under `src/fx/nih-dairia/` (types stripped, nothing else changed, two presentation rewrites); a pure surface frame in `src/domain/surface-frame.js` places the flat-simulated creature on the sphere; content holds the preset, size and model URLs; the lab `src/labs/boss-tab.js` composes them with the story planet, the game's hull model and the swarm lab's drive and cost readout. The game controller imports none of it.

**Tech Stack:** native ESM, vendored three r160 (WebGL), lil-gui (vendored), WebAssembly (embedded base64), node 22 tests under `test/`, the browser harness.

Spec: `docs/superpowers/specs/2026-10-08-nih-dairia-boss-lab-design.md` (read it first; it is the contract). Source of the port: the kit export unpacked at `/private/tmp/claude-501/-Users-minikai-Dev-stalheart/98695f17-91f0-47e2-8bd9-fce62931b2f6/scratchpad/kit-export/` (identical to `/Users/minikai/Dev/Jelly-Baby` at f2a4f89; read from either, never run their scripts).

## Global Constraints

- Work in the worktree `/Users/minikai/Dev/stalheart-refactor-run`, branch `refactor-run`. Never push, never merge. One commit per task, message in the project's register, ending with the session's attribution lines. `git config user.email` must be `270854086+kai-denrei@users.noreply.github.com`.
- **Licence:** the kit is GPL-3.0 (open issue `2026-10-08-nih-dairia-kit-is-gpl-licence-open`). Every ported file's first line: `// Ported from lab-creatures <path> (kai-denrei, f2a4f89, export of 2026-10-08; derived from Jelly Baby by scottstts; GPL-3.0, see ./LICENSE), types stripped; the solver, the gait, the pursuit and the feeding are unchanged.` The kit's LICENSE is copied to `src/fx/nih-dairia/LICENSE`.
- **Port rule:** strip types, keep identifiers, numbers, comments and the order of operations. `three/webgpu` → `../../../vendor/three.module.js`. No `three/tsl` (Task 4 rewrites the two node materials). `.ts` import suffixes → `.js`. `readonly`, `private`, `as const`, type-only imports and `!` assertions go; class fields keep their initialisers. `??` and `?.` stay (node 22 and the game's browsers have them).
- After every edit of a `src/*.js` file: `node --check <file>`. After every task: `npm test`, `npm run check`, `npm run build`. The lab's browser step (Task 6) runs through `scripts/browser-lock.sh` from a snapshot (`scripts/refactor-snapshot.sh`), one Chrome at a time; check `~/scripts/check-memory.sh` first and wait at CRITICAL.
- Layer rules: `src/domain/surface-frame.js` imports nothing; `src/content/nih-dairia.js` imports nothing; `src/fx/nih-dairia/*` imports only the vendored three and `src/content`; the lab imports fx, content, domain and `src/labs/*`, never `td-tab.js`. No new top-level `src/*.js`. The guard (`npm run architecture`) proves it.
- No console logging except the kit's existing one-line kernel-unavailable warning. No new preset format. No colored emoji in UI.
- Tests are node programs in `test/<name>.mjs`, picked up by `npm test`; they read models from `assets/creatures/nih-dairia/` with `fs`. Expected values are bounds and named assertions, never digests.

---

### Task 0: Assets, lock, content

**Files:**
- Create: `assets/creatures/nih-dairia/{nih-dairia,brood,reed,crown}.bin` and `.json` (copied byte-for-byte from the export's `src/assets/model/`)
- Create: `docs/nih-dairia-assets.lock.json`
- Modify: `scripts/assets.mjs` (the lock-file list; add `'docs/nih-dairia-assets.lock.json'`)
- Create: `src/content/nih-dairia.js`
- Create: `test/nih-dairia-content.mjs`

**Interfaces:**
- Produces: `NIH_DAIRIA_MOTION` (frozen object of the fourteen keys from the export's `motion-settings.json`, whose `motion` is `{ speed: 3, reachTime: 4, pullTime: 2, pauseTime: 2.7, erratic: 3, stretch: 2.5, spread: 3, stepHeight: 0.05, stepDuration: 0.08, stepSpacing: 0.015, stride: 0.05, recoil: 1, ...plus grip and sweep if the export's file has them; if it lacks them, take `grip: 1.5, sweep: 1` from the kit's `DEFAULT_MOTION` and say so in a comment}`), `NIH_DAIRIA_VARIANT = 'nih-dairia'`, `NIH_DAIRIA_SIZE_METRES = 30`, `NIH_DAIRIA_LOOK = Object.freeze({ pale: '#b8b99a', dark: '#374237', roughness: 0.26, metalness: 0, transmission: 0.65, thickness: 0.012, ior: 1.37, attenuationColor: '#939b72', attenuationDistance: 0.035, clearcoat: 0.65, clearcoatRoughness: 0.16, preyRed: '#c94d38', preyEmissive: '#751e16' })`, `NIH_DAIRIA_MODELS = Object.freeze({ 'nih-dairia': { bin: 'assets/creatures/nih-dairia/nih-dairia.bin', json: 'assets/creatures/nih-dairia/nih-dairia.json' }, brood: {...}, reed: {...}, crown: {...} })`.

- [ ] **Step 1:** copy the eight files; `shasum -a 256 assets/creatures/nih-dairia/*` and write the lock:

```json
{
  "schema": 1,
  "upstream": "lab-creatures (kai-denrei), derived from Jelly Baby by scottstts",
  "revision": "f2a4f89",
  "baseUrl": null,
  "credit": "Nih-Dairia and its body plans (brood, reed, crown) by the owner's lab-creatures project, export of 2026-10-08, GPL-3.0; model source hash nih-dairia-spider-v2. The owner's own export: nothing to fetch.",
  "note": "Soft-body cage models: typed-array slices described by each .json manifest, read by src/fx/nih-dairia/cage-model.js. Not GLB: the build copies them unchanged.",
  "files": [
    { "path": "assets/creatures/nih-dairia/nih-dairia.bin", "sha256": "<hash>" },
    { "path": "assets/creatures/nih-dairia/nih-dairia.json", "sha256": "<hash>" },
    ... six more
  ]
}
```

  Read `scripts/assets.mjs` first: if a `file` entry needs a `sourcePath` or the loop fetches when `baseUrl` is set, match the shape the script reads (it only fetches when a file is missing and `fetch` was asked; with `baseUrl: null` a missing file must throw a clear error, which the existing `fetch(lock.baseUrl + ...)` does not, so guard: `if(!existsSync(path)&&fetchMissing&&!lock.baseUrl)throw Error(`No upstream for ${file.path}; restore it from the owner's export`)`).

- [ ] **Step 2:** write `test/nih-dairia-content.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NIH_DAIRIA_MOTION, NIH_DAIRIA_VARIANT, NIH_DAIRIA_SIZE_METRES, NIH_DAIRIA_LOOK, NIH_DAIRIA_MODELS } from '../src/content/nih-dairia.js';
const lock = JSON.parse(fs.readFileSync(new URL('../docs/nih-dairia-assets.lock.json', import.meta.url), 'utf8'));
const locked = new Set(lock.files.map((f) => f.path));
for (const [variant, { bin, json }] of Object.entries(NIH_DAIRIA_MODELS)) {
  for (const p of [bin, json]) { assert.ok(fs.existsSync(new URL('../' + p, import.meta.url)), `${variant}: ${p} on disk`); assert.ok(locked.has(p), `${variant}: ${p} in the lock`); }
  const manifest = JSON.parse(fs.readFileSync(new URL('../' + json, import.meta.url), 'utf8'));
  assert.ok(manifest.layout.positions.length > 0, `${variant}: a manifest with positions`);
}
assert.ok(NIH_DAIRIA_MODELS[NIH_DAIRIA_VARIANT], 'the default variant has a model');
assert.equal(Object.keys(NIH_DAIRIA_MOTION).length, 14, 'fourteen motion settings');
for (const [k, v] of Object.entries(NIH_DAIRIA_MOTION)) assert.ok(Number.isFinite(v) && v > 0, `${k} is a positive number`);
assert.ok(Number.isFinite(NIH_DAIRIA_SIZE_METRES) && NIH_DAIRIA_SIZE_METRES > 0);
assert.ok(Object.isFrozen(NIH_DAIRIA_MOTION) && Object.isFrozen(NIH_DAIRIA_LOOK) && Object.isFrozen(NIH_DAIRIA_MODELS));
assert.ok(NIH_DAIRIA_LOOK.transmission >= 0 && NIH_DAIRIA_LOOK.transmission <= 1);
console.log('Nih-Dairia content: four models on disk and locked, fourteen settings, the look in range.');
```

- [ ] **Step 3:** `node test/nih-dairia-content.mjs && npm run assets:check && npm test && npm run check && npm run build` — all pass.
- [ ] **Step 4: Commit** — `The Nih-Dairia models are pinned assets and their preset, size, look and URLs are content (lab-creatures f2a4f89, GPL-3.0, licence open)`.

---

### Task 1: The surface frame

**Files:**
- Create: `src/domain/surface-frame.js`
- Create: `test/surface-frame.mjs`

**Interfaces:**
- Produces: `frameAt(direction, radius, yaw = 0) -> { origin, up, east, north, yaw }` (arrays of three); `toWorld(frame, local, scale = 1) -> [x, y, z]`; `toLocal(frame, world, scale = 1) -> [x, y, z]`; `reanchor(frame, localCentre, radius, scale, limit) -> { frame, shift: [x, 0, z] }`; `sagitta(distance, radius) -> number`.

- [ ] **Step 1:** write the test (bounds from the spec):

```js
import assert from 'node:assert/strict';
import { frameAt, toWorld, toLocal, reanchor, sagitta } from '../src/domain/surface-frame.js';
const R = 750, S = 170;
const len = (v) => Math.hypot(...v), norm = (v) => v.map((x) => x / len(v)), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
for (let n = 0; n < 50; n++) {
  const dir = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), yaw = rnd() * Math.PI * 2;
  const f = frameAt(dir, R, yaw);
  assert.ok(Math.abs(len(f.up) - 1) < 1e-12 && Math.abs(len(f.east) - 1) < 1e-12 && Math.abs(len(f.north) - 1) < 1e-12, 'unit basis');
  assert.ok(Math.abs(dot(f.up, f.east)) < 1e-12 && Math.abs(dot(f.up, f.north)) < 1e-12 && Math.abs(dot(f.east, f.north)) < 1e-12, 'orthogonal basis');
  assert.ok(Math.abs(len(f.origin) - R) < 1e-9, 'the origin on the sphere');
  const local = [(rnd() - 0.5) * 0.2, 0.012, (rnd() - 0.5) * 0.2];
  const world = toWorld(f, local, S), back = toLocal(f, world, S);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(back[k] - local[k]) < 1e-9, 'toLocal inverts toWorld');
  const d = Math.hypot(local[0], local[2]) * S, along = R * Math.acos(Math.max(-1, Math.min(1, dot(norm(world), dir))));
  assert.ok(Math.abs(along - d) / d < 1e-4, `distance along the surface ${along} vs ${d} (sagitta is second order)`);
}
const f = frameAt([0, 1, 0], R, 0.3);
const far = reanchor(f, [25 / S, 0.03, 0], R, S, 20);
assert.ok(Math.abs(len(far.frame.origin) - R) < 1e-9, 're-anchored origin on the sphere');
assert.ok(Math.abs(dot(norm(far.frame.origin), norm(toWorld(f, [25 / S, 0, 0], S))) - 1) < 1e-9, 'the new origin is the surface point under the centre');
assert.deepEqual(far.shift, [-25 / S, 0, 0]);
assert.equal(far.frame.yaw, 0.3, 'yaw kept');
const near = reanchor(f, [5 / S, 0.03, 0], R, S, 20);
assert.equal(near.frame, f); assert.deepEqual(near.shift, [0, 0, 0]);
assert.ok(Math.abs(sagitta(15, 750) - 0.15) < 0.001);
console.log('Surface frame: orthonormal, invertible, re-anchors along the surface, keeps yaw.');
```

- [ ] **Step 2:** `node test/surface-frame.mjs` fails (module missing).
- [ ] **Step 3:** write the module:

```js
// THE SURFACE FRAME (the Nih-Dairia boss lab, 2026-10-08): a creature that simulates in its own flat metres is placed on the
// planet by a frame: origin on the surface, up along the normal, east/north the tangent basis turned by yaw, one uniform scale.
// Pure: arrays in, arrays out; the planet's centre is the origin (the story planet shifts the scene so the pole sits at y = 0).
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function frameAt(direction, radius, yaw = 0) {
  const up = norm(direction);
  const ref = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];   // a helper axis not parallel to up
  let east = norm(cross(ref, up)), north = cross(up, east);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const e = [east[0] * c + north[0] * s, east[1] * c + north[1] * s, east[2] * c + north[2] * s];
  const n = [north[0] * c - east[0] * s, north[1] * c - east[1] * s, north[2] * c - east[2] * s];
  return { origin: [up[0] * radius, up[1] * radius, up[2] * radius], up, east: e, north: n, yaw };
}
export function toWorld(f, local, scale = 1) {
  const [x, y, z] = local;
  return [0, 1, 2].map((k) => f.origin[k] + (x * f.east[k] + y * f.up[k] + z * f.north[k]) * scale);
}
export function toLocal(f, world, scale = 1) {
  const d = [world[0] - f.origin[0], world[1] - f.origin[1], world[2] - f.origin[2]];
  return [dot(d, f.east) / scale, dot(d, f.up) / scale, dot(d, f.north) / scale];
}
export function sagitta(distance, radius) { return distance * distance / (2 * radius); }
// When the creature's centre has walked past `limit` metres from the origin, the frame slides to the surface point under
// the centre and the caller shifts every local position by `shift` (inside one fixed step, so the solver sees no jump).
export function reanchor(f, localCentre, radius, scale, limit) {
  const [x, , z] = localCentre;
  if (Math.hypot(x, z) * scale <= limit) return { frame: f, shift: [0, 0, 0] };
  const under = toWorld(f, [x, 0, z], scale);
  return { frame: frameAt(under, radius, f.yaw), shift: [-x, 0, -z] };
}
```

  The ported frame keeps the OLD yaw and the OLD helper axis convention; `frameAt(under, radius, yaw)` recomputes the basis from the new up, so the heading turns with the surface by the parallel transport the helper axis gives (a few degrees over 20 m at radius 750), which is what a walker on a sphere does.

- [ ] **Step 4:** `node test/surface-frame.mjs` passes; `npm run architecture` lists it as a pure module.
- [ ] **Step 5: Commit** — `A pure surface frame places a flat-simulated body on the planet and re-anchors along the surface (src/domain/surface-frame.js)`.

---

### Task 2: The physics port

**Files:**
- Create: `src/fx/nih-dairia/LICENSE` (copied), `constants.js`, `soft-body-kernel.js`, `deform-surface.js`, `cage-model.js`, `fixed-step.js`, `soft-body.js`
- Create: `test/nih-dairia-physics.mjs`

**Interfaces:**
- Produces: `parseCage(buffer, manifest)`, `SoftBody` (as the kit: `x`, `previous`, `velocity`, `mass`, `totalMass`, `rest`, `cage` (with `limbCount`, `opticalSurface`), `surface` (`positions`, `geometry`, `bindingIds`, `bindingWeights`, `restNormals`), `kernel`, `step(h)`, `stepJS(h)`, `updateSurface()`, `updateCenter()`, `center`, `grounded`, `contact`, `lastMinJacobian`, `volumeRatio()`, `isFinite()`, `reset()`, `wake()`, `nudge()`, `grab`), `createSoftBodyKernel(body)`, `FixedStepper(step).advance(dt, fn) -> steps`, `PHYS`, `clamp`, `deformSurface`.

- [ ] **Step 1:** copy `LICENSE`; port the six files per the global port rule. `cage-model.ts` builds the geometry with `BufferGeometry`, `BufferAttribute`, `DynamicDrawUsage` from the vendored three; keep `limbCount` from the manifest (f2a4f89 added it: check `manifest.limbCount ?? 6`). `soft-body-kernel.js` is JS already: change nothing but the header. `node --check` each.
- [ ] **Step 2:** write `test/nih-dairia-physics.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCage } from '../src/fx/nih-dairia/cage-model.js';
import { SoftBody } from '../src/fx/nih-dairia/soft-body.js';
import { PHYS } from '../src/fx/nih-dairia/constants.js';
import { FixedStepper } from '../src/fx/nih-dairia/fixed-step.js';
const load = (name) => { const b = fs.readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.bin`, import.meta.url)); const m = JSON.parse(fs.readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.json`, import.meta.url), 'utf8')); return parseCage(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), m); };
const run = (body, steps) => { for (let i = 0; i < steps; i++) { body.step(PHYS.step); assert.ok(body.isFinite(), `finite at step ${i}`); } body.updateSurface(); };
const wasm = new SoftBody(load('nih-dairia')); assert.ok(wasm.kernel, 'the WebAssembly kernel compiled in node');
run(wasm, 200);
assert.ok(wasm.grounded, 'settled on the floor'); assert.ok(wasm.contact.some((v) => v > 0), 'contacts');
assert.ok(Math.abs(wasm.volumeRatio() - 1) < 0.05, `volume kept (${wasm.volumeRatio()})`);
const js = new SoftBody(load('nih-dairia')); js.kernel = null; run(js, 200);
assert.ok(js.center.distanceTo(wasm.center) < 0.001, `kernel and JS agree on the centre (${js.center.distanceTo(wasm.center)} m)`);
const clock = new FixedStepper(PHYS.step); let n = 0;
assert.equal(clock.advance(1 / 60, () => n++), 4); assert.equal(n, 4);
assert.ok(clock.advance(1, () => n++) <= 12, 'the 50 ms clamp caps the steps');
console.log('Nih-Dairia physics: parses, settles, keeps volume, kernel and JS agree, the stepper clamps.');
```

  If `SoftBody` constructs the kernel in its constructor and `js.kernel = null` after the fact does not switch `step` to `stepJS`, read `step()` and use the kit's own switch (it already branches on `this.kernel`); if the constructor takes an option, use it. If 4 fixed steps per 1/60 s is off by one because of the accumulator, assert `3 <= steps <= 4` and say why in the test.

- [ ] **Step 3:** `node test/nih-dairia-physics.mjs && npm test && npm run check && npm run build`.
- [ ] **Step 4: Commit** — `The Nih-Dairia physics ported onto the vendored three (the XPBD solver, its WebAssembly kernel, the cage parser, the skin embedding, the fixed stepper); node proves kernel and JS agree`.

---

### Task 3: The behaviour port

**Files:**
- Create: `src/fx/nih-dairia/motion-settings.js`, `variants.js` (`CREATURE_VARIANTS` only), `arena.js`, `gait.js`, `pursuit.js`, `traction.js`, `limb-separation.js`, `cradle.js`, `feeding.js`, `behavior.js`, and `prey-shapes.js`: the logic half of the kit's `prey.ts` (`PREY_SHAPES`, `preyGeometry`, `preyImprint`, `preyClearance`, the kit's names), which `cradle.js` and `feeding.js` import. The mesh half (`createPrey`) is Task 4's `prey.js`, which re-exports these four so the kit's import paths still read true.
- Create: `test/nih-dairia-motion.mjs` (the kit's `verify-monster.mjs` + `verify-probes.mjs`), `test/nih-dairia-feeding.mjs` (`verify-feeding.mjs`), `test/nih-dairia-variants.mjs` (`verify-variants.mjs`)

**Interfaces:**
- Produces: the classes as the kit names them; `MonsterBehavior(body, settings)` with `target`, `center`, `velocity`, `torsoCenter`, `gait`, `pursuit`, `traction`, `separation`, `feeding`, `cradle`, `targetHeld`, `state`, `stimulus`, `active`, `step(h)`, `disturb()`, `reset()`; `FeedingCycle` with `enabled`, `phase`, `preyPosition`, `capturedPosition`, `scale`, `visible`, `locked`, `shape`, `skinCoverage`, `meals`, `step(...)`, `reset(target)`.

- [ ] **Step 1:** port the files. `prey-shapes.js` uses `Plane`, `Vector3` and the primitive geometries from the vendored three (r160 has `SphereGeometry`, `BoxGeometry`, `CylinderGeometry`, `DodecahedronGeometry`). `node --check` each.
- [ ] **Step 2:** port the three verify scripts into the three tests: imports to the port, `three/webgpu` → the vendored module, models from `assets/creatures/nih-dairia/`, `parseBabyCage` (verify-monster) → `parseCage` with the nih-dairia model (the kit's monster test loads the baby cage for a regression fixture; read the script and keep every assertion that applies to the creature, drop the baby-only ones with a comment naming them). Each test ends with one summary line.
- [ ] **Step 3:** `node test/nih-dairia-motion.mjs && node test/nih-dairia-feeding.mjs && node test/nih-dairia-variants.mjs && npm test && npm run check && npm run build`. A kit assertion that fails on the port is a port bug until proven otherwise: diff the ported file against the source line by line before changing an assertion.
- [ ] **Step 4: Commit** — `The Nih-Dairia behaviour ported (gait, pursuit, traction, limb separation, cradle, feeding, settings, variants); the kit's own verifications run as node tests`.

---

### Task 4: The presentation port

**Files:**
- Create: `src/fx/nih-dairia/skin.js`, `prey.js`, `appearance.js`, `creature.js`
- Create: `test/nih-dairia-appearance.mjs`

**Interfaces:**
- Produces: `tissueColors(positions, limbs)`; `createPrey(look) -> { mesh, update(feeding) }`; `createMonsterAppearance(body, feeding, look) -> { mesh, update() }` (the kit returns the mesh; the port returns an object because the imprint tint is a CPU update now; `mesh` is the same mesh); `createNihDairia(motion, variant, { models, look }) -> { mesh, body, motion, settings, setTarget(v), update(dt) -> steps, reset(), dispose(), appearance }`.

- [ ] **Step 1:** `skin.js` verbatim (Color from the vendored three).
- [ ] **Step 2:** `prey.js`: re-export the four logic names from `prey-shapes.js`; `createPrey(look)` with `MeshPhysicalMaterial({ metalness: 0.45, roughness: 0.3, emissive: look.preyEmissive, emissiveIntensity: 0.2, ior: 1.37, clearcoatRoughness: 0.16, color: look.preyRed })`; `update(feeding)`: `const wrap = feeding.skinCoverage; material.color.copy(red).lerp(tissue, wrap); material.clearcoat = 0.65 * wrap; material.metalness = 0.45 * (1 - wrap); material.roughness = 0.3 - 0.04 * wrap; material.emissiveIntensity = 0.2 * (1 - wrap);` where `tissue` is the mean of `tissueColors` over the prey geometry (one colour, computed when the shape changes); position, scale, visible as the kit.
- [ ] **Step 3:** `appearance.js`: the material from `NIH_DAIRIA_LOOK` as `MeshPhysicalMaterial({ vertexColors: true, ...the look's scalars, side: DoubleSide })`; the `color` attribute from `tissueColors`, kept as `base` (a copy); `update()`: when `feeding && feeding.locked`, for each vertex within the kit's imprint radius of `feeding.preyPosition` (read the kit's TSL expression for the exact radius and smoothstep edges and reproduce them on the CPU), `color = mix(base, imprintTint, coverage * smoothstep(...))`, write into the attribute, `needsUpdate = true`; when not feeding and the attribute was tinted, restore `base` once. Keep `frustumCulled = false`.
- [ ] **Step 4:** `creature.js` from `portable.ts`: `loadMonsterCage(variant, models)` fetches `new URL(models[variant].bin, document.baseURI)` (in node tests, pass `models` with `file://` URLs or skip the fetch by passing a `cage` directly: give `createNihDairia` an optional `cage` for tests); `update(dt)` returns `steps` and calls `appearance.update()` after `body.updateSurface()`.
- [ ] **Step 5:** `test/nih-dairia-appearance.mjs`: build a body from the model, `createMonsterAppearance(body, feeding, NIH_DAIRIA_LOOK)`; the `color` attribute has `positions.length` entries, all in [0, 1]; force `feeding.phase = 'covering'`, `feeding.skinCoverage = 1`, `feeding.preyPosition.set(0.03, 0.012, 0)` and `update()`: the vertices within the imprint radius of that point changed colour and the vertices farther than twice the radius did not; set `feeding.phase = 'hunting'` and `update()`: every colour equals `base` again. `createPrey(NIH_DAIRIA_LOOK).update(feeding)` at coverage 0 is red and at 1 is tissue-coloured (compare `material.color` to the mean tissue colour within 1e-6).
- [ ] **Step 6:** `node test/nih-dairia-appearance.mjs && npm test && npm run check && npm run build`.
- [ ] **Step 7: Commit** — `The Nih-Dairia skin, prey and creature on r160's physical material: the two node-material effects become CPU colour updates; createNihDairia keeps the kit's contract`.

---

### Task 5: The lab

**Files:**
- Create: `src/labs/boss-tab.js`
- Modify: `labs.html` (add `<div id="tab-boss" class="tab tab-hidden"></div>` after `tab-swarm`), `src/main.js` (add `boss: () => import('./labs/boss-tab.js').then(m => m.initBossTab),` after `swarm`), `app.css` only if the swarm lab's classes do not cover the layout (prefer reusing `.sw-*` by giving the lab's root the same structure; if a class is needed, add `#boss` rules beside the `#swarm` ones).

**Interfaces:**
- Consumes: `createNihDairia`, `NIH_DAIRIA_*`, `frameAt/toWorld/toLocal/reanchor/sagitta`, `buildStoryPlanet`, `planetBake`, `buildStoryPlanetMesh`, the story look (as `story-tab.js` builds it: read its `look` and import the same), `buildUnit('mork')` and `stepYardDrive` as `swarm-tab.js` uses them, `OrbitControls`, `GUI` from the vendored lil-gui.
- Produces: `initBossTab(root)`; `window.__bossLab = { readout: () => ({ solver, steps, skin, render, centre, reach, sag, taken, state }), creature: () => creature, setLure(kind), stopTank(), driveTank(seconds) }` published only when `location.search` has `acceptance=1` (the `--boss` step reads it).

- [ ] **Step 1: scaffold the tab** on the swarm lab's structure: a side panel (`select` for variant and lure, a `button` for reset/disturb/re-anchor, a `copy settings` button, the lil-gui panel mounted in a `div` for the fourteen `MOTION_CONTROLS` with their `min/max/step` and labels, plus `size`, `gravity`, `iterations`, `feeding`, `instinct`), a stage with the renderer, the readout line `[data-read]`, the callouts `[data-callouts]`, the keys hint. The lab builds nothing until its root is visible (follow `story-tab.js`'s deferred `build()` and `disposed` guard).
- [ ] **Step 2: the planet patch.** `planet = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, planetBake())`; `planetMesh = buildStoryPlanetMesh(planet, look, { wallMetres })`. Restrict the draw to the cap: read `story-planet-mesh.js`; if the mesh's groups or `counts` allow a per-cell draw range, set it to the cells within 40 cells of the anchor; otherwise build the mesh and set `mesh.geometry.setDrawRange` per group to the index range of those cells, computed from `planet.mesh.quads` and the anchor; whichever is possible without changing `story-planet-mesh.js`. Anchor: `frameAt(norm(clearing centre direction), planet.radius, 0)` where the clearing's centre is the pole `[0, 1, 0]` (the story planet puts the base at the pole; confirm in `story-planet.js`).
- [ ] **Step 3: the actors.** `creature = await createNihDairia(NIH_DAIRIA_MOTION, variant, { models: NIH_DAIRIA_MODELS, look: NIH_DAIRIA_LOOK })`; `rig = new THREE.Group(); rig.add(creature.mesh); scene.add(rig)`; each frame `placeRig()`: `rig.position.set(...frame.origin)`, `rig.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(east, up, north))`, `rig.scale.setScalar(size)`. The tank: `buildUnit('mork')`, the drive `{ x, z, yaw, speed }` through `stepYardDrive(drive, keys, dt, [], DRIVE_R)` in metres in the frame's plane; `tank.position.set(...toWorld(frame, [drive.x, 0, drive.z], 1))`, its orientation the frame's basis turned by `drive.yaw`.
- [ ] **Step 4: the lure and the prey.** Each frame before `creature.update(dt)`: `motion.targetHeld = lure === 'tank' ? (keys.any || Math.abs(drive.speed) > 0.05) : held`; if not `feeding.locked`, `creature.setTarget(new Vector3(...toLocal(frame, lureWorld, size)).setY(ARENA.lureHeight))`. The prey mesh: when `lure === 'tank'`, `preyMesh.visible = false` and the tank's `visible = feeding.visible` with its world position from `toWorld(frame, feeding.preyPosition, size)` while `feeding.locked` (the kit holds the prey fixed); when the phase passes `absorbing`, `taken++`, callout `TAKEN`, and the tank respawns at local `[30 / size, 0, 0]` with the drive reset. When `lure !== 'tank'`, the kit's prey mesh is shown and updated from `feeding`.
- [ ] **Step 5: re-anchoring.** Inside `creature.update`'s fixed step is the kit's; the lab wraps it: before `creature.update(dt)`, `const { frame: f2, shift } = reanchor(frame, motion.center.toArray(), planet.radius, size, 2 * cellSide)`; if the shift is non-zero and `!feeding.locked`: add the shift to every triple of `body.x` and `body.previous` (the kernel's views alias the same memory when the kernel is on: write through `body.kernel ? body.kernel.x : body.x` and `.previous`; read `soft-body.js` to confirm which arrays are authoritative with the kernel on), to `motion.target`, `feeding.preyPosition`, `feeding.capturedPosition`, `cradle.anchor`, the traction anchors (read `traction.js` for the array name), then `frame = f2`, `placeRig()`, and the tank's local drive coordinates shift by the same vector so it stays put in the world. Do this between frames (no fixed step runs between `update` calls), which satisfies "inside one fixed step" for the solver since `previous` and `x` move together.
- [ ] **Step 6: the readout.** `solver` and `skin` from `performance.now()` around the stepper callback and `updateSurface` (wrap `creature.update` with timers inside `creature.js`: expose `creature.timings = { solver, skin, steps }` updated per call); `render` from a `costMs()` like the swarm lab's every 30 frames; `centre` from `motion.velocity.length() * size`; `reach` from the pursuit's arm tips (read `pursuit.ts` for the tip positions) scaled; `sag` from `sagitta(farthest planted foot distance * size, planet.radius)`; `taken`. Rolling 60-frame means. The steps count red (`<b class="late">`) when the clamp cut (`dt > 0.05`).
- [ ] **Step 7: knobs and export.** lil-gui bound to `creature.settings` (live), `size` (re-place), `PHYS` copies (`gravity`, `iterations`: give `createNihDairia` a `phys` option that copies `PHYS` so the lab's knobs do not change the module constant), `feeding.enabled`, `motion.active`; buttons `disturb` (`motion.disturb()`), `reset` (`creature.reset()`, the tank respawns, `taken` stays), `re-anchor now`. `copy settings`: `navigator.clipboard.writeText(JSON.stringify({ version: 1, variant, motion: {...creature.settings}, sizeMetres: size }, null, 2))`, falling back to a `textarea` select when the clipboard is refused.
- [ ] **Step 8: failure.** `try { creature.update(dt) } catch (e) { read.textContent = String(e.message); creature.reset(); }`; a failed model fetch writes the error into the stage and returns.
- [ ] **Step 9: verify by hand** through `scripts/browser-lock.sh node scripts/serve.mjs` (read-only) opening `labs.html#boss?acceptance=1`: the creature stands on the planet at 30 m, walks toward the tank, the readout counts steps; drive, stop beside it, get TAKEN. Then `npm test && npm run check && npm run build` (the guard must still pass: the lab imports no controller).
- [ ] **Step 10: Commit** — `The boss lab: Nih-Dairia at thirty metres on the story planet, the tank as its prey, the fourteen settings live, solver/skin/render on the readout (labs.html#boss)`.

---

### Task 6: The browser step and the records

**Files:**
- Modify: `scripts/browser-test.mjs` (a `--boss` branch beside `--sky-hole`, in that file's style)
- Modify: `docs/STATE.md` (a short "What landed on 2026-10-08" paragraph: the lab, where, what it proves, the licence question open, the mode idea recorded)
- Deban entries: the lab landing (change, accepted); the spec (`2026-10-08-nih-dairia-boss-lab-design`, decision, proposed → accepted when the owner has seen it: leave proposed).

- [ ] **Step 1:** the step: `await go('boss', 'labs.html?acceptance=1#boss')`; `await until('!!window.__bossLab && window.__bossLab.readout().steps > 0', 60000)`; assert `readout().solver > 0`; assert the creature's world bounding radius `> 10` (`window.__bossLab.creature().mesh.geometry.boundingSphere.radius * size`, expose `size` in the readout); `await evaluate('window.__bossLab.driveTank(2)')`; `await delay(2500)`; assert `readout().state !== 'listening'`; `await evaluate('window.__bossLab.setLure("tank"); window.__bossLab.stopTank()')` with the tank parked within reach (give `stopTank()` a `near: true` option that places the tank at local `[0.05, 0, 0]`); `await until('window.__bossLab.readout().taken >= 1', 60000)`; `current = 'boss-taken'; await finish()`. Read the harness's helpers (`go`, `until`, `evaluate`, `finish`, `delay`) before writing; match their use exactly.
- [ ] **Step 2:** run it from a snapshot: `d=$(scripts/refactor-snapshot.sh boss); (cd $d && scripts/browser-lock.sh node scripts/browser-test.mjs --boss)`; green, or fix the lab and rerun.
- [ ] **Step 3:** STATE.md paragraph; the deban entry for the landing; `npm run log -- render`; `npm test && npm run check && npm run build`.
- [ ] **Step 4: Commit** — `Records: the boss lab landed (--boss green), STATE.md current; the licence stays open for the owner`.

Then stop and report: per task the commit, the tests added and their summary lines, the `--boss` result, the readout's numbers on this machine (solver, skin, render in ms at the default settings, and with `iterations` at 2), and anything left open.
