# Explosions, FLIR thermal and the white amoeba — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the owner's four procedural explosion modules into the game at the gunship, orbital strike, tank shell and Quiver TALON impacts, switch the gunship's thermal view to the FLIR ironbow filter, and make the white amoeba the first enemy.

**Architecture:** The lab's modules are copied into `src/fx/explosions/` with only the `three` import rewritten, pinned by hash in a lock that `npm run check` verifies. A pure content table (`src/content/explosions.js`) maps each use to a module and scale; one adapter (`src/fx/explosions.js`) places explosions on the sphere, converts metres to scene units, caps and reaps them. `src/td-tab.js` and `src/sentry-pilot.js` call the adapter where dot bursts were spawned, keeping the dot bursts as the fallback.

**Tech Stack:** Native ES modules, vendored Three.js r160 (`vendor/three.module.js`), Node 22 test programs (`scripts/test.mjs` runs every `test/*.mjs`), headless Chrome acceptance (`scripts/browser-test.mjs`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-explosions-flir-amoeba-design.md`.
- Lab source: `~/Dev/lab-explosions` at revision `5f7c5437bc511d6e3531673bf1b53ffcb417a2aa`.
- The only change to a copied module is `import * as THREE from 'three';` → `import * as THREE from '../../../vendor/three.module.js';` in `common.js`.
- `src/td-tab.js` must not grow: `npm run architecture` enforces the line budget in `docs/architecture-budget.json`; lower the budget when the file shrinks.
- No new top-level `src/*.js` file. `src/content/` is a pure layer (no `window`, `document`, three.js or browser APIs).
- Keep the damage-radius rings (`warnRing`) and every sound call at the impacts.
- The explosion scale is `cellSide / 10` scene units per metre (`METRES_PER_CELL` = 10 in `src/core/stage-units.js`); the planet radius passed to a module is `METRES_PER_CELL / cellSide` metres.
- Live caps by size: small 20, medium 4, large 2, nuclear 1.
- Commit after each task with the attribution lines:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01Rpjnm155MZfTdb9DFpcQwX`.

---

### Task 1: Pinned import of the explosion modules

**Files:**
- Create: `scripts/import-explosions.mjs`
- Create (generated): `src/fx/explosions/common.js`, `src/fx/explosions/rotary-pop.js`, `src/fx/explosions/bofors-burst.js`, `src/fx/explosions/howitzer-blast.js`, `src/fx/explosions/orbital-strike.js`
- Create (generated): `docs/explosion-assets.lock.json`
- Modify: `scripts/assets.mjs` (after the sinkhole import check)
- Test: `test/explosions-contract.mjs`

**Interfaces:**
- Produces: each module exports `meta` (`{ name, size, radiusM, lifeS, budget }`), `createExplosion({ palette, scale, seed, planetRadius })` returning `{ object, tick(dt), alive(), dispose() }`, and `prewarm(renderer, camera)`.

- [ ] **Step 1: Write the failing contract test**

Create `test/explosions-contract.mjs`:

```js
// The lab's contract, against the pinned copies: meta, determinism by seed, every element ending by lifeS,
// alive() ending under the game's 0.1 s step cap, dispose freeing all but the shared templates, no globals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { template } from '../src/fx/explosions/common.js';

const MODULES = ['rotary-pop', 'bofors-burst', 'howitzer-blast', 'orbital-strike'];
const BRIEF = {
  small: { radiusM: [4.5, 4.5], lifeS: [0.4, 0.4] },
  medium: { radiusM: [11, 11], lifeS: [1.2, 1.2] },
  large: { radiusM: [32, 32], lifeS: [3, 3] },
  nuclear: { radiusM: [60, 120], lifeS: [8, 12] },
};

function snapshot(fx) {
  return fx.object.children.map((o) => {
    const attrs = {};
    for (const [k, a] of Object.entries(o.geometry.attributes)) attrs[k] = Array.from(a.array);
    const uniforms = {};
    for (const [k, u] of Object.entries(o.material.uniforms)) uniforms[k] = u.value && u.value.toArray ? u.value.toArray() : u.value;
    return { attrs, uniforms };
  });
}

for (const name of MODULES) {
  const mod = await import(`../src/fx/explosions/${name}.js`);
  const { meta } = mod;

  test(`${name}: meta matches the brief`, () => {
    assert.equal(meta.name, name);
    const b = BRIEF[meta.size];
    assert.ok(b, `unknown size ${meta.size}`);
    assert.ok(meta.radiusM >= b.radiusM[0] && meta.radiusM <= b.radiusM[1]);
    assert.ok(meta.lifeS >= b.lifeS[0] && meta.lifeS <= b.lifeS[1]);
    assert.equal(typeof mod.prewarm, 'function');
    const fx = mod.createExplosion();
    assert.equal(fx.object.children.length, meta.budget.draws);
    fx.dispose();
  });

  test(`${name}: same seed, same explosion; different seed differs`, () => {
    const a = mod.createExplosion({ seed: 7 }), b = mod.createExplosion({ seed: 7 }), c = mod.createExplosion({ seed: 8 });
    assert.deepEqual(snapshot(a), snapshot(b));
    assert.notDeepEqual(snapshot(a), snapshot(c));
    [a, b, c].forEach((fx) => fx.dispose());
  });

  test(`${name}: every element ends by lifeS`, () => {
    const fx = mod.createExplosion({ seed: 3 });
    for (const o of fx.object.children) {
      const timing = o.geometry.getAttribute('aTime') || o.geometry.getAttribute('aSpark');
      if (timing) {
        for (let i = 0; i < timing.count; i++) {
          const end = timing.getX(i) + timing.getY(i);
          assert.ok(end <= meta.lifeS + 1e-5, `${o.material.name} element ${i} ends at ${end}`);
        }
      } else {
        for (const k of ['uTimeA', 'uTimeB']) {
          const v = o.material.uniforms[k].value;
          assert.ok(v.x + v.y <= meta.lifeS + 1e-5, `${k} ends at ${v.x + v.y}`);
        }
      }
    }
    fx.dispose();
  });

  test(`${name}: alive() ends at lifeS with the game's clamped dt`, () => {
    const fx = mod.createExplosion();
    let t = 0;
    while (fx.alive()) { fx.tick(0.1); t += 0.1; assert.ok(t < meta.lifeS + 0.2, 'never died'); }
    assert.ok(t >= meta.lifeS - 1e-9);
    fx.dispose();
  });

  test(`${name}: dispose frees geometries and clones, keeps templates`, () => {
    const fx = mod.createExplosion();
    const freed = [];
    const templates = new Set(['puff', 'spark', 'ring'].map(template));
    for (const o of fx.object.children) {
      assert.ok(!templates.has(o.material), 'layer uses a template directly');
      o.geometry.addEventListener('dispose', () => freed.push('g'));
      o.material.addEventListener('dispose', () => freed.push('m'));
    }
    for (const tpl of templates) tpl.addEventListener('dispose', () => assert.fail('template disposed'));
    const n = fx.object.children.length;
    fx.dispose();
    assert.equal(freed.length, n * 2);
    assert.equal(fx.object.parent, null);
  });

  test(`${name}: creates no globals`, () => {
    const before = new Set(Object.keys(globalThis));
    const fx = mod.createExplosion({ seed: 11 });
    fx.tick(0.016);
    fx.dispose();
    assert.deepEqual(Object.keys(globalThis).filter((k) => !before.has(k)), []);
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node test/explosions-contract.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/fx/explosions/common.js`.

- [ ] **Step 3: Write the import script**

Create `scripts/import-explosions.mjs`:

```js
// Copy the explosion lab's modules into src/fx/explosions/, rewriting only the bare 'three' import, and pin
// the upstream and adapted hashes in docs/explosion-assets.lock.json. Local tool; never runs in CI.
// Usage: node scripts/import-explosions.mjs [path-to-lab]   (default ~/Dev/lab-explosions)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lab = resolve(process.argv[2] || join(homedir(), 'Dev/lab-explosions'));
const FILES = ['common.js', 'rotary-pop.js', 'bofors-burst.js', 'howitzer-blast.js', 'orbital-strike.js'];
const FROM = "import * as THREE from 'three';";
const TO = "import * as THREE from '../../../vendor/three.module.js';";
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const revision = execFileSync('git', ['-C', lab, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
mkdirSync(join(root, 'src/fx/explosions'), { recursive: true });
const files = FILES.map((name) => {
  const source = readFileSync(join(lab, 'explosions', name));
  const text = source.toString('utf8');
  const adapted = name === 'common.js' ? text.replace(FROM, TO) : text;
  if (name === 'common.js' && adapted === text) throw Error("common.js: the 'three' import was not found");
  if (/from ['"]three['"]/.test(adapted)) throw Error(`${name}: a bare 'three' import remains`);
  const path = `src/fx/explosions/${name}`;
  const bytes = Buffer.from(adapted, 'utf8');
  writeFileSync(join(root, path), bytes);
  return { sourcePath: `explosions/${name}`, path, sourceSha256: sha(source), sha256: sha(bytes), bytes: bytes.length };
});
const lock = { schema: 1, upstream: '~/Dev/lab-explosions', revision, files };
writeFileSync(join(root, 'docs/explosion-assets.lock.json'), JSON.stringify(lock, null, 2) + '\n');
console.log(`${files.length} explosion modules imported at ${revision}`);
```

- [ ] **Step 4: Run the import**

Run: `node scripts/import-explosions.mjs`
Expected: `5 explosion modules imported at 5f7c5437bc511d6e3531673bf1b53ffcb417a2aa`. If the revision differs, stop and ask the owner whether to import that revision.

- [ ] **Step 5: Run the contract test to verify it passes**

Run: `node test/explosions-contract.mjs`
Expected: `# pass 24`, `# fail 0`.

- [ ] **Step 6: Verify the lock in `npm run check`**

In `scripts/assets.mjs`, find the line
`console.log(\`${sinkhole.files.length} pinned Sinkhole imports verified (${sinkhole.revision}).\`);`
and insert directly after it:

```js
const explosions=JSON.parse(readFileSync(resolve(root,'docs/explosion-assets.lock.json'),'utf8'));
for(const file of explosions.files){
 const path=resolve(root,file.path);
 if(!path.startsWith(resolve(root,'src/fx/explosions')+'/'))throw Error('Explosion path outside pinned paths');
 const bytes=readFileSync(path);
 if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error(`Explosion import changed: ${file.path}`);
}
console.log(`${explosions.files.length} pinned explosion modules verified (${explosions.revision.slice(0,7)}).`);
```

Run: `npm run assets:check`
Expected: a line `5 pinned explosion modules verified (5f7c543).` and exit 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/import-explosions.mjs src/fx/explosions docs/explosion-assets.lock.json scripts/assets.mjs test/explosions-contract.mjs
git commit -m "Explosions: pinned import of the lab's four modules with the contract tests"
```

---

### Task 2: The explosion content table

**Files:**
- Create: `src/content/explosions.js`
- Test: `test/explosions-content.mjs`

**Interfaces:**
- Consumes: `meta.size` from Task 1's modules.
- Produces: `EXPLOSION_MODULES` (array of module names), `EXPLOSION_USES` (`{ [use]: { module, scale } }`), `EXPLOSION_PALETTE` (`{ white, hot, warm, ember, smoke, soot }` hex strings), `EXPLOSION_CAPS` (`{ small, medium, large, nuclear }` integers).

- [ ] **Step 1: Write the failing test**

Create `test/explosions-content.mjs`:

```js
import assert from 'node:assert/strict';
import { EXPLOSION_MODULES, EXPLOSION_USES, EXPLOSION_PALETTE, EXPLOSION_CAPS } from '../src/content/explosions.js';

assert.deepEqual(Object.keys(EXPLOSION_USES).sort(),
  ['gunship.bofors', 'gunship.heavy', 'gunship.rotary', 'quiver.talon', 'strike.orbital', 'tank.shell']);
for (const [use, spec] of Object.entries(EXPLOSION_USES)) {
  assert.ok(EXPLOSION_MODULES.includes(spec.module), `${use}: unknown module ${spec.module}`);
  assert.ok(spec.scale > 0 && spec.scale <= 2, `${use}: scale ${spec.scale}`);
}
assert.deepEqual(Object.keys(EXPLOSION_PALETTE), ['white', 'hot', 'warm', 'ember', 'smoke', 'soot']);
for (const hex of Object.values(EXPLOSION_PALETTE)) assert.match(hex, /^#[0-9a-f]{6}$/);
assert.deepEqual(EXPLOSION_CAPS, { small: 20, medium: 4, large: 2, nuclear: 1 });
for (const name of EXPLOSION_MODULES) {
  const mod = await import(`../src/fx/explosions/${name}.js`);
  assert.ok(EXPLOSION_CAPS[mod.meta.size] >= 1, `${name}: no cap for size ${mod.meta.size}`);
}
console.log('Explosion content: every use names a pinned module; caps cover every size.');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node test/explosions-content.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/content/explosions.js`.

- [ ] **Step 3: Write the content module**

Create `src/content/explosions.js`:

```js
// Which explosion lands where, as data. The modules are the owner's lab, pinned in src/fx/explosions/
// (docs/explosion-assets.lock.json); scale multiplies the module's own metres. This table is what a later
// FX-package section replaces.
export const EXPLOSION_MODULES = Object.freeze(['rotary-pop', 'bofors-burst', 'howitzer-blast', 'orbital-strike']);

export const EXPLOSION_USES = Object.freeze({
  'gunship.rotary': Object.freeze({ module: 'rotary-pop', scale: 1 }),       // 25 mm: 4.5 m, 0.4 s
  'gunship.bofors': Object.freeze({ module: 'bofors-burst', scale: 1 }),     // 40 mm: 11 m, 1.2 s
  'gunship.heavy': Object.freeze({ module: 'howitzer-blast', scale: 1 }),    // 105 mm: 32 m, 3 s
  'tank.shell': Object.freeze({ module: 'bofors-burst', scale: 0.6 }),       // ~7 m
  'quiver.talon': Object.freeze({ module: 'bofors-burst', scale: 0.8 }),     // ~9 m
  'strike.orbital': Object.freeze({ module: 'orbital-strike', scale: 1 }),   // 90 m, 10 s
});

// ordered by brightness; the lab's defaults
export const EXPLOSION_PALETTE = Object.freeze({
  white: '#fff5e1', hot: '#ffd04a', warm: '#ff8420', ember: '#c4300c', smoke: '#8e8983', soot: '#35312d',
});

// live explosions per size; at the cap the oldest of that size ends first
export const EXPLOSION_CAPS = Object.freeze({ small: 20, medium: 4, large: 2, nuclear: 1 });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node test/explosions-content.mjs && npm run architecture`
Expected: `Explosion content: every use names a pinned module; caps cover every size.` then the architecture line with no problems.

- [ ] **Step 5: Commit**

```bash
git add src/content/explosions.js test/explosions-content.mjs
git commit -m "Explosions: the content table mapping each impact to a module, scale, palette and cap"
```

---

### Task 3: The adapter

**Files:**
- Create: `src/fx/explosions.js`
- Test: `test/explosions-adapter.mjs`

**Interfaces:**
- Consumes: Task 1 modules, Task 2 `EXPLOSION_USES`, `EXPLOSION_PALETTE`, `EXPLOSION_CAPS`; `METRES_PER_CELL` from `src/core/stage-units.js`.
- Produces: `createExplosions(scene, { modules?, onError? })` returning `{ prewarm(renderer, camera) → boolean, spawn(use, point: number[3], normal: number[3], cellSide: number) → boolean, tick(dt), clear(), dispose(), available: boolean (getter), state() → { available, live, spawned: { [use]: count } } }`.

- [ ] **Step 1: Write the failing test**

Create `test/explosions-adapter.mjs`:

```js
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createExplosions } from '../src/fx/explosions.js';

const cellSide = 10 / 753;   // the story planet: 753 m, 10 m a cell
const scene = new THREE.Scene();
const fx = createExplosions(scene);

assert.equal(fx.spawn('gunship.bofors', [0, 1, 0], [0, 1, 0], cellSide), true);
const obj = scene.children.at(-1);
assert.deepEqual(obj.position.toArray(), [0, 1, 0]);
assert.ok(Math.abs(obj.scale.x - cellSide / 10) < 1e-12, 'metres become scene units');
fx.spawn('tank.shell', [1, 0, 0], [1, 0, 0], cellSide);
{
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(scene.children.at(-1).quaternion);
  assert.ok(up.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-9, 'local +Y stands on the surface normal');
}
assert.equal(fx.spawn('no.such.use', [0, 1, 0], [0, 1, 0], cellSide), false);
for (let i = 0; i < 25; i++) fx.spawn('gunship.rotary', [0, 1, 0], [0, 1, 0], cellSide);
assert.equal(scene.children.filter((o) => o.name === 'rotary-pop').length, 20, 'the small cap holds');
assert.deepEqual(fx.state().spawned, { 'gunship.bofors': 1, 'tank.shell': 1, 'gunship.rotary': 25 });
fx.tick(0.5);
assert.equal(scene.children.filter((o) => o.name === 'rotary-pop').length, 0, 'smalls reaped after 0.4 s');
fx.tick(1);
assert.equal(fx.state().live, 0, 'mediums reaped after 1.2 s');
fx.clear();
assert.equal(scene.children.length, 0);

let reported = null;
const broken = createExplosions(new THREE.Scene(), {
  modules: { 'bofors-burst': { meta: { size: 'medium' }, createExplosion() { throw Error('no GL'); } } },
  onError: (error) => { reported = error.message; },
});
assert.equal(broken.spawn('tank.shell', [0, 1, 0], [0, 1, 0], cellSide), false);
assert.equal(broken.available, false);
assert.equal(reported, 'no GL');

const unwarmed = createExplosions(new THREE.Scene(), { onError: () => {} });
assert.equal(unwarmed.prewarm({ compile() { throw Error('lost context'); } }, new THREE.PerspectiveCamera()), false);
assert.equal(unwarmed.spawn('tank.shell', [0, 1, 0], [0, 1, 0], cellSide), false, 'no explosions after a failed prewarm');
console.log('Explosions adapter: placement, metres to units, caps, reaping and fallback hold.');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node test/explosions-adapter.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/fx/explosions.js`.

- [ ] **Step 3: Write the adapter**

Create `src/fx/explosions.js`:

```js
// The game's explosions: the pinned lab modules (src/fx/explosions/) stood on the planet, scaled from their
// metres to scene units, capped per size and reaped. A module that fails to load or compile turns the adapter
// off and callers keep their dot bursts.
import * as THREE from '../../vendor/three.module.js';
import { METRES_PER_CELL } from '../core/stage-units.js';
import { EXPLOSION_USES, EXPLOSION_PALETTE, EXPLOSION_CAPS } from '../content/explosions.js';
import * as rotaryPop from './explosions/rotary-pop.js';
import * as boforsBurst from './explosions/bofors-burst.js';
import * as howitzerBlast from './explosions/howitzer-blast.js';
import * as orbitalStrike from './explosions/orbital-strike.js';

const MODULES = { 'rotary-pop': rotaryPop, 'bofors-burst': boforsBurst, 'howitzer-blast': howitzerBlast, 'orbital-strike': orbitalStrike };
const Y = new THREE.Vector3(0, 1, 0);

export function createExplosions(scene, { modules = MODULES, onError = () => {} } = {}) {
  const live = [];        // { fx, size }, oldest first
  const spawned = {};
  const normal = new THREE.Vector3();
  let seed = 1, available = true;

  function prewarm(renderer, camera) {
    try { modules['rotary-pop'].prewarm(renderer, camera); }   // the layer programs are shared by every module
    catch (error) { available = false; onError(error); }
    return available;
  }

  function spawn(use, point, surfaceNormal, cellSide) {
    const spec = EXPLOSION_USES[use], mod = spec && modules[spec.module];
    if (!available || !mod) return false;
    const size = mod.meta.size;
    const same = live.filter((l) => l.size === size);
    if (same.length >= EXPLOSION_CAPS[size]) { same[0].fx.dispose(); live.splice(live.indexOf(same[0]), 1); }
    let fx;
    try { fx = mod.createExplosion({ palette: EXPLOSION_PALETTE, scale: spec.scale, seed: seed++, planetRadius: METRES_PER_CELL / cellSide }); }
    catch (error) { available = false; onError(error); return false; }
    fx.object.position.set(point[0], point[1], point[2]);
    fx.object.quaternion.setFromUnitVectors(Y, normal.set(surfaceNormal[0], surfaceNormal[1], surfaceNormal[2]).normalize());
    fx.object.scale.setScalar(cellSide / METRES_PER_CELL);
    scene.add(fx.object);
    live.push({ fx, size });
    spawned[use] = (spawned[use] || 0) + 1;
    return true;
  }

  function tick(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      live[i].fx.tick(dt);
      if (!live[i].fx.alive()) { live[i].fx.dispose(); live.splice(i, 1); }
    }
  }

  function clear() { for (const l of live) l.fx.dispose(); live.length = 0; }

  return {
    prewarm, spawn, tick, clear, dispose: clear,
    get available() { return available; },
    state: () => ({ available, live: live.length, spawned: { ...spawned } }),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node test/explosions-adapter.mjs`
Expected: `Explosions adapter: placement, metres to units, caps, reaping and fallback hold.`

- [ ] **Step 5: Commit**

```bash
git add src/fx/explosions.js test/explosions-adapter.mjs
git commit -m "Explosions: the adapter that stands them on the planet, caps and reaps them"
```

---

### Task 4: Explosions at the impacts

**Files:**
- Modify: `src/td-tab.js` (import chain, bloom line, frame loop, `executeStrike`, tank shell hit, `blastWall`, TALON arrival, pilot host, acceptance state)
- Modify: `src/sentry-pilot.js` (gunship landings)
- Modify: `docs/architecture-budget.json` (lower the `src/td-tab.js` line budget)
- Test: `scripts/browser-test.mjs` (`--gunship`, `--breach-game`, default suite)

**Interfaces:**
- Consumes: `createExplosions` from Task 3.
- Produces: in `td-tab.js`, `explosions` (the adapter) and `explode(use, point) → boolean` (point on the unit sphere, normal taken as the point's direction); `executeStrike(ci, tNow, use = 'strike.orbital')`; pilot host method `explode(use, point)`; acceptance `state().explosions` = `{ available, live, spawned }`.

- [ ] **Step 1: Write the failing browser assertions**

In `scripts/browser-test.mjs`:

(a) In the `--gunship` block, replace
```js
  await evaluate('window.__stalheartTest.gunshipGun("rotary")');await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(700);await evaluate('window.__stalheartTest.gunshipHold(false)');
  current='gunship-rotary-fired';await finish();
```
with
```js
  await evaluate('window.__stalheartTest.gunshipGun("rotary")');await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(700);await evaluate('window.__stalheartTest.gunshipHold(false)');
  await delay(2400);{const x=await evaluate('window.__stalheartTest.state().explosions');assert(x.available&&x.spawned['gunship.rotary']>0,`rotary rounds burst where they land (${JSON.stringify(x)})`);}
  current='gunship-rotary-fired';await finish();
  await evaluate('window.__stalheartTest.gunshipGun("bofors")');await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(400);await evaluate('window.__stalheartTest.gunshipHold(false)');
  await delay(3000);{const x=await evaluate('window.__stalheartTest.state().explosions');assert(x.spawned['gunship.bofors']>0,`the Bofors shell bursts on landing (${JSON.stringify(x)})`);}
  current='gunship-bofors-burst';await finish();
```

(b) In the same block, replace
`await delay(3800);const rl=await evaluate('window.__stalheartTest.state().gunship');`
with
`await delay(3800);assert.equal((await evaluate('window.__stalheartTest.state().explosions')).spawned['gunship.heavy'],1,'the 105 lands as the howitzer blast');const rl=await evaluate('window.__stalheartTest.state().gunship');`

(c) In the `--breach-game` block, replace
```js
 await evaluate('window.__stalheartTest.breachStrike()');
 assert(await evaluate('window.__stalheartTest.state().breachRubble.caps>=1'),'Orbital strike seals the hole');
```
with
```js
 await evaluate('window.__stalheartTest.breachStrike()');
 assert(await evaluate('window.__stalheartTest.state().breachRubble.caps>=1'),'Orbital strike seals the hole');
 assert.equal(await evaluate('window.__stalheartTest.state().explosions.spawned["strike.orbital"]'),1,'the orbital strike lands as the nuclear cloud');
```

(d) In the default suite, replace
`await go('terraformer','index.html?sw=0&cine=0&acceptance=1#td');`
with
```js
await go('shell-explosion','index.html?sw=0&cine=0&acceptance=1&blast=1#td');
await until('window.__stalheartTest?.state().explosions?.spawned["tank.shell"]===1',30000);await finish();
await go('terraformer','index.html?sw=0&cine=0&acceptance=1#td');
```

- [ ] **Step 2: Run a suite to verify it fails**

Run: `node scripts/browser-test.mjs --breach-game`
Expected: FAIL on `the orbital strike lands as the nuclear cloud` (`state().explosions` is undefined).

- [ ] **Step 3: Create the adapter and `explode` in `td-tab.js`**

Edit `src/td-tab.js`:

1. Replace `import { createFoundryFx } from './fx/foundry-fx.js';` with
   `import { createFoundryFx } from './fx/foundry-fx.js'; import { createExplosions } from './fx/explosions.js';`
2. Replace `  const postfx = makeBloom(renderer, scene, camera, { scale: tier.bloomScale });` with
   ```js
     const postfx = makeBloom(renderer, scene, camera, { scale: tier.bloomScale }); const explosions = createExplosions(scene, { onError: (error) => record('explosions.unavailable', { message: error.message }) }); explosions.prewarm(renderer, camera); const explode = (use, p) => explosions.spawn(use, p, norm3(p), cellSide);   // the lab's explosions (src/fx/explosions.js); callers keep their dot bursts when this returns false
   ```
3. Replace `brass?.tick(frozen ? 0 : dt);   // spent cases fall and settle with the rest of the transients` with
   `brass?.tick(frozen ? 0 : dt); explosions.tick(frozen ? 0 : dt);   // spent cases and explosions run on the world's clock`

- [ ] **Step 4: The orbital strike and the 105**

In `executeStrike`, replace `  function executeStrike(ci, tNow) {` with `  function executeStrike(ci, tNow, use = 'strike.orbital') {`, and replace

```js
    // the firework: staged dot-burst shells, white core out to ember red,
    // each larger and sparser than the last. One strike per gate means this
    // can afford to be extravagant — it is a set piece, not a particle tax.
    const bn = graph.normals[ci];
    const bp = add3(c, scale3(bn, cellSide * 0.35));
    for (const [hex, sc, cnt] of [
      [0xffffff, 1.5, 140], [0xfff2c0, 2.4, 110],
      [0xffb347, 3.4, 90], [0xff7744, 4.4, 70], [0xff4433, 5.4, 50],
    ]) {
```

with

```js
    // the lab's explosion for this use; the old dot-burst firework only when it could not load
    const bn = graph.normals[ci];
    const bp = add3(c, scale3(bn, cellSide * 0.35));
    if (!explode(use, c)) for (const [hex, sc, cnt] of [[0xffffff, 1.5, 140], [0xfff2c0, 2.4, 110], [0xffb347, 3.4, 90], [0xff7744, 4.4, 70], [0xff4433, 5.4, 50]]) {
```

(The loop body that follows is unchanged.)

In the pilot host, replace `blast:ci=>{if(ci>=0)executeStrike(ci,t);},` with
`blast:ci=>{if(ci>=0)executeStrike(ci,t,'gunship.heavy');},explode:(use,p)=>explode(use,p),`

- [ ] **Step 5: Tank shell and wall breach**

Replace

```js
          const clip = makeDotBurst(0xfff2c0, norm3(p.pos), 90);
          clip.scale.setScalar(cellSide * 1.6);
          const cp = add3(p.pos, scale3(norm3(p.pos), cellSide * 0.15));
          clip.position.set(cp[0], cp[1], cp[2]);
          scene.add(clip);
          debris.push(clip);
```

with

```js
          if (!explode('tank.shell', norm3(p.pos))) { const clip = makeDotBurst(0xfff2c0, norm3(p.pos), 90); clip.scale.setScalar(cellSide * 1.6); const cp = add3(p.pos, scale3(norm3(p.pos), cellSide * 0.15)); clip.position.set(cp[0], cp[1], cp[2]); scene.add(clip); debris.push(clip); }
```

Replace

```js
  function blastWall(ci) {
    if (!breachWallCell(ci)) return;
```

with

```js
  function blastWall(ci) {
    if (!breachWallCell(ci)) return; explode('tank.shell', graph.centers[ci]);
```

- [ ] **Step 6: The Quiver's TALON**

Replace

```js
      const burst=makeDotBurst(target?0xffd27f:0x6f8ea0,norm3(m.p),target?22:10);
      burst.scale.setScalar(cellSide*(target?2.4:1.2));burst.position.fromArray(m.p);
      scene.add(burst);debris.push(burst);
```

with

```js
      if(!(target&&m.config.mesh==='talon'&&explode('quiver.talon',norm3(target.pos)))){const burst=makeDotBurst(target?0xffd27f:0x6f8ea0,norm3(m.p),target?22:10);burst.scale.setScalar(cellSide*(target?2.4:1.2));burst.position.fromArray(m.p);scene.add(burst);debris.push(burst);}   // a TALON hit bursts on its target; a miss keeps the small puff
```

- [ ] **Step 7: The acceptance state**

Replace `      state: () => ({ pilotRounds: rs?.pilotRounds ?? 0,` with
`      state: () => ({ explosions: explosions.state(), pilotRounds: rs?.pilotRounds ?? 0,`

- [ ] **Step 8: The gunship landings in `sentry-pilot.js`**

In `src/sentry-pilot.js`, replace `G.burst(r.point,0xffd08a,44,.5);` with `if(!G.explode('gunship.bofors',r.point))G.burst(r.point,0xffd08a,44,.5);` and replace `G.burst(r.point,0xdfe8ee,7,.18);` with `if(!G.explode('gunship.rotary',r.point))G.burst(r.point,0xdfe8ee,7,.18);`.

- [ ] **Step 9: Run the checks**

Run: `npm test && npm run check`
Expected: all test programs pass; if `npm run check` prints `src/td-tab.js: N lines; lower its line budget to N`, set `"src/td-tab.js": N` in `docs/architecture-budget.json` and rerun until it is clean. If it prints `exceeds line budget`, fold the added lines into existing ones rather than raising the budget.

- [ ] **Step 10: Run the browser suites**

Run: `node scripts/browser-test.mjs --breach-game && node scripts/browser-test.mjs --gunship && node scripts/browser-test.mjs`
Expected: each ends `Browser acceptance passed (source).`, including `gunship-bofors-burst` and `shell-explosion`.

- [ ] **Step 11: Commit**

```bash
git add src/td-tab.js src/sentry-pilot.js docs/architecture-budget.json scripts/browser-test.mjs
git commit -m "Explosions at the impacts: gunship guns, orbital strike, tank shell and breach, Quiver TALON"
```

---

### Task 5: FLIR thermal in the gunship seat

**Files:**
- Modify: `index.html` (after `<body>`)
- Modify: `styles.css:2572`
- Test: `scripts/browser-test.mjs` (`--gunship`)

**Interfaces:**
- Consumes: the existing `gunship-thermal` class the seat's M key toggles on `#tab-td`.
- Produces: an SVG filter `#flir` in the game page.

- [ ] **Step 1: Write the failing assertion**

In the `--gunship` block of `scripts/browser-test.mjs`, replace
`'M cycles to thermal');current='gunship-thermal';await finish();`
with
`'M cycles to thermal');assert.equal(await evaluate('getComputedStyle(document.querySelector("#td-app canvas")).filter'),'url("#flir")','thermal is the FLIR ironbow');current='gunship-thermal';await finish();`

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/browser-test.mjs --gunship`
Expected: FAIL on `thermal is the FLIR ironbow` (the computed filter is the sepia chain).

- [ ] **Step 3: Add the filter and use it**

In `index.html`, replace the first occurrence of `<body>` with:

```html
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <!-- FLIR ironbow thermal (lab-explosions 5f7c543): luminance through a colour table, indigo to white -->
  <filter id="flir" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/>
    <feComponentTransfer>
      <feFuncR type="table" tableValues="0.020 0.114 0.290 0.541 0.761 0.910 0.973 0.988 0.992 1.000 1.000"/>
      <feFuncG type="table" tableValues="0.008 0.039 0.043 0.059 0.114 0.251 0.439 0.639 0.827 0.953 1.000"/>
      <feFuncB type="table" tableValues="0.102 0.369 0.541 0.604 0.494 0.290 0.118 0.063 0.227 0.604 1.000"/>
    </feComponentTransfer>
  </filter>
</svg>
```

In `styles.css`, replace
`#tab-td.gunship-thermal #td-app canvas { filter: grayscale(1) brightness(0.5) contrast(1.6) sepia(1) saturate(5) hue-rotate(-18deg); }`
with
`#tab-td.gunship-thermal #td-app canvas { filter: url(#flir); }   /* FLIR ironbow (index.html #flir, from the explosion lab) */`

- [ ] **Step 4: Run it to verify it passes**

Run: `node scripts/browser-test.mjs --gunship`
Expected: `Browser acceptance passed (source).`; open `artifacts/browser/gunship-thermal.png` and confirm the view is indigo-to-yellow rather than sepia.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css scripts/browser-test.mjs
git commit -m "Gunship thermal is the FLIR ironbow filter from the explosion lab"
```

---

### Task 6: The white amoeba is the first enemy

**Files:**
- Modify: `src/enemyspec.js` (tints, spec rows, `INTROS`, late-wave flood)
- Modify: `src/domain/story-beats.js:24`
- Modify: `src/td-tab.js` (glossary card, harvest probe, gunship skip spawn)
- Modify: `src/content/story-defaults.js:80` (comment)
- Test: `test/tdcore.mjs`, `test/story-beats.mjs`, `scripts/browser-test.mjs` (`--story-world`)

**Interfaces:**
- Produces: `computeWavePlan(1, …).headline === 'amoeba'`; `makeStoryBeats` default `fodderType = 'amoeba'`; acceptance `state().enemyTypes` = sorted unique types of living enemies.

- [ ] **Step 1: Write the failing tests**

In `test/tdcore.mjs`: replace `p.headline === 'phage'; })());` with `p.headline === 'amoeba'; })());`; replace `['phage', 'ghost'].includes(e.type)` with `['amoeba', 'ghost'].includes(e.type)`; replace `accentFor('phage') === 0xffffff && accentFor('drifter') === 0xffffff);` with `accentFor('amoeba') === 0xffffff && accentFor('drifter') === 0xffffff);`; and append before the final summary lines:

```js
check('the first enemy is the white amoeba, the phage the grey crawler',
  INTROS[0].type === 'amoeba' && CREATURE_TINTS.amoeba === 0xf4f8ff && ENEMY_SPEC.amoeba.speed === 1.15 && ENEMY_SPEC.amoeba.erratic === true
  && ENEMY_SPEC.amoeba.bounty === 3 && ENEMY_SPEC.amoeba.size === 0.5 && ENEMY_SPEC.phage.speed === 0.75 && ENEMY_SPEC.phage.bounty === 16
  && ENEMY_SPEC.phage.size === 0.4 && !ENEMY_SPEC.phage.erratic && INTROS.find((i) => i.wave === 4).type === 'phage');
```

(`test/tdcore.mjs` already imports `ENEMY_SPEC`, `INTROS` and `CREATURE_TINTS` from `../src/enemyspec.js`; `SAFE_HUES.white` is `0xf4f8ff`.)

In `test/story-beats.mjs`, replace `assert.ok(kinds(g, 'spawn').every((l) => l[1] === 'phage' && l[2] === 4300));` with `assert.ok(kinds(g, 'spawn').every((l) => l[1] === 'amoeba' && l[2] === 4300));`.

In `scripts/browser-test.mjs` (`--story-world`), replace
`assert.equal(fodder.insideEnemies,0,'the closed gate holds the fodder outside');`
with
`assert.deepEqual(fodder.enemyTypes,['amoeba'],'the first wave is the white amoeba');assert.equal(fodder.insideEnemies,0,'the closed gate holds the fodder outside');`
and replace
`assert(settled.monitorShown>0,'the seeker feed showed during a flight');`
with
`assert(settled.monitorShown>0,'the seeker feed showed during a flight');assert(settled.explosions.spawned['quiver.talon']>=2,'each TALON hit bursts on its target');`

- [ ] **Step 2: Run the Node tests to verify they fail**

Run: `node test/tdcore.mjs; node test/story-beats.mjs`
Expected: tdcore reports FAIL on `wave 1 plan is a single type` and on the new amoeba check; story-beats throws an `AssertionError` on the spawn type.

- [ ] **Step 3: Swap the bodies and belts in `src/enemyspec.js`**

Replace
```js
  phage: SAFE_HUES.white,          // wave 1 swarm — the white belt
  amoeba: SAFE_HUES.grey,          // slow crawler
```
with
```js
  amoeba: SAFE_HUES.white,         // wave 1 swarm — the white belt (owner, 2026-09-14: the amoeba leads)
  phage: SAFE_HUES.grey,           // slow crawler
```

Replace
`  phage:     { hp: 1, speed: 1.15, size: 0.4,  rammable: true,  heartDmg: 1, erratic: true, bounty: 3 },`
with
`  amoeba:    { hp: 1, speed: 1.15, size: 0.5,  rammable: true,  heartDmg: 1, erratic: true, bounty: 3 },`

Replace
`  amoeba:    { hp: 1, speed: 0.75, size: 0.5,  rammable: true,  heartDmg: 1, bounty: 16 },`
with
`  phage:     { hp: 1, speed: 0.75, size: 0.4,  rammable: true,  heartDmg: 1, bounty: 16 },`

Replace
```js
  { wave: 1,  type: 'phage',     label: 'THE PHAGE',           role: 'agile swarm · hunt its source' },
```
with
```js
  { wave: 1,  type: 'amoeba',    label: 'THE AMOEBA',          role: 'agile swarm · hunt its source' },
```
and
```js
  { wave: 4,  type: 'amoeba',    label: 'THE AMOEBA',          role: 'crawler · destroy the spawn' },
```
with
```js
  { wave: 4,  type: 'phage',     label: 'THE PHAGE',           role: 'crawler · destroy the spawn' },
```

Replace `    for (const t of ['phage', 'ghost']) {` with `    for (const t of ['amoeba', 'ghost']) {`.

- [ ] **Step 4: The story's first wave and the game's fodder**

In `src/domain/story-beats.js`, replace `fodderType = 'phage',` with `fodderType = 'amoeba',`.

In `src/td-tab.js`:
- replace `spriteShot('phage', unitIcon('phage', CREATURE_TINTS.phage))` with `spriteShot('amoeba', unitIcon('amoeba', CREATURE_TINTS.amoeba))`;
- replace `['harvest', () => noteWaveKill('phage', 'tank')],` with `['harvest', () => noteWaveKill('amoeba', 'tank')],`;
- replace `spawnQueue.push({ type: 'phage', sp: gate, at: spawnClock + i * 0.05 });` with `spawnQueue.push({ type: 'amoeba', sp: gate, at: spawnClock + i * 0.05 });`;
- replace `      state: () => ({ explosions: explosions.state(),` with `      state: () => ({ enemyTypes: [...new Set(enemies.filter((e) => e.alive).map((e) => e.type))].sort(), explosions: explosions.state(),`.

In `src/content/story-defaults.js`, replace `// a piloted round is worth one phage before the kill combo` with `// a piloted round is worth one first-wave body before the kill combo`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test/tdcore.mjs && node test/story-beats.mjs && npm test && npm run check`
Expected: tdcore ends without FAIL lines, story-beats passes, all test programs pass, check is clean (lower the td-tab budget if it asks).

- [ ] **Step 6: Run the story world**

Run: `node scripts/browser-test.mjs --story-world`
Expected: `Browser acceptance passed (source).` including `story-world-fodder` (white amoebas), `story-world-rotor-kill` and `story-world-quiver-settled` (TALON explosions).

- [ ] **Step 7: Commit**

```bash
git add src/enemyspec.js src/domain/story-beats.js src/td-tab.js src/content/story-defaults.js test/tdcore.mjs test/story-beats.mjs scripts/browser-test.mjs docs/architecture-budget.json
git commit -m "The white amoeba leads the first wave; the phage becomes the grey crawler"
```

---

### Task 7: Gates, record and state

**Files:**
- Create (temporary): an entry JSON for `npm run log -- add`
- Modify: `docs/STATE.md` (Next priorities), `DEVLOG.md` and `ROADMAP.md` (generated)

- [ ] **Step 1: Run every gate**

Run, in order, each expected to pass:
```bash
npm test
npm run check
npm run build
node scripts/browser-test.mjs
node scripts/browser-test.mjs --story-world
node scripts/browser-test.mjs --gunship
node scripts/browser-test.mjs --sinkhole
node scripts/browser-test.mjs --breach-game
node scripts/browser-test.mjs --dist
```
In the `--gunship` output, copy the frame time shown in `artifacts/browser/gunship-skip-enemies.png`'s overlay into the log entry below as the measurement (headless, not a device claim).

- [ ] **Step 2: Record the change**

Write `/tmp/stalheart-explosions-entry.json`:

```json
{
  "schema": 1,
  "id": "2026-09-14-explosions-flir-amoeba-landed",
  "date": "2026-09-14T23:59:00+00:00",
  "type": "change",
  "status": "observed",
  "title": "The lab's explosions land at the gunship, strike, tank shell and TALON impacts; FLIR thermal; the white amoeba leads the first wave",
  "context": "Owner: the new explosion effects in ~/Dev/lab-explosions, especially for the gunship, also the Quiver and tank shells; adopt FLIR; make the first enemy a white amoeba swapped with the phage. Spec docs/superpowers/specs/2026-09-14-explosions-flir-amoeba-design.md, plan docs/superpowers/plans/2026-09-14-explosions-flir-amoeba.md.",
  "outcome": "Four modules pinned from lab 5f7c543 in src/fx/explosions/ (docs/explosion-assets.lock.json, verified by npm run check; scripts/import-explosions.mjs re-imports). src/content/explosions.js maps gunship.rotary, gunship.bofors, gunship.heavy, tank.shell (x0.6), quiver.talon (x0.8) and strike.orbital to modules; src/fx/explosions.js stands them on the planet at cellSide/10 units a metre with planetRadius 10/cellSide, caps small 20 / medium 4 / large 2 / nuclear 1, reaps on the world clock and falls back to the dot bursts if a module fails. The gunship's thermal mode uses the lab's #flir ironbow filter. The amoeba is the wave-1 white-belt swarm (fast, erratic, bounty 3) and the story's first wave; the phage is the wave-4 grey crawler. Headless frame time under the gunship skip load: RECORD THE NUMBER HERE FROM STEP 1. Open: the FX-package explosion section and lab picker; phone GPU cost; the nuclear cloud's overdraw when it fills the seat.",
  "alternatives": ["Rebuilding the explosions inside the FX package now: deferred to a second step once the look is judged in the seat."],
  "evidence": ["npm test, npm run check, npm run build, browser default, --story-world, --gunship, --sinkhole, --breach-game and --dist passed."],
  "supersedes": []
}
```

Replace `RECORD THE NUMBER HERE FROM STEP 1` with the measured fps and ms before adding. Then run:
```bash
npm run log -- add /tmp/stalheart-explosions-entry.json && npm run log -- render
```
Expected: `N valid Stalheart log entries.` twice.

- [ ] **Step 3: Update STATE**

In `docs/STATE.md`, replace
`2. **Explosions**: the owner's new effects in \`~/Dev/lab-explosions\`, first for the gunship, then the Quiver and tank shells. Brief: [EXPLOSIONS-RESEARCH.md](EXPLOSIONS-RESEARCH.md).`
with
`2. **Explosions landed** (\`2026-09-14-explosions-flir-amoeba-landed\`): the lab's modules at the gunship, orbital strike, tank shell and TALON impacts, the FLIR thermal view, the white amoeba first. Next: judge the look in the seat, then the FX-package explosion section and a lab picker; phone GPU cost is unmeasured.`

- [ ] **Step 4: Commit**

```bash
git add docs/STATE.md docs/log/entries DEVLOG.md ROADMAP.md
git commit -m "Deban sync: explosions, FLIR and the white amoeba landed"
```
