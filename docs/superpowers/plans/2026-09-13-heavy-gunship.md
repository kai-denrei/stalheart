# Heavy Gunship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GUNSHIP joins the story's view strip as a mount on a fixed orbital pass: gunner only, three guns (25 mm rotary, 40 mm Bofors, the 105 mm that IS the orbital strike), a thermal optic with the real render in the corner monitor, and soft-warning danger rings.

**Architecture:** Pure schedule/cadence/danger rules in `src/domain/gunship.js` with tunables in `src/content/gunship.js`; the thermal two-pass render, danger rings and the pinned KORP model in `src/fx/gunship-optic.js`; `src/sentry-pilot.js` hosts the mount as a virtual tower riding the pass; `src/td-tab.js` only folds hooks into existing lines and pays for them by extracting the pilot-post picker into `src/domain/pilot-posts.js`. `src/strike.js` is not modified.

**Tech Stack:** Native ESM, vendored Three.js r160, Node 22 tests (`node scripts/test.mjs`), browser acceptance through `scripts/browser-test.mjs`.

## Global Constraints

- `src/td-tab.js` may not exceed `docs/architecture-budget.json` `lineBudgets` (17605); budgets only go down. Finish by lowering the budget to the file's final line count.
- New modules only in `src/domain/`, `src/content/`, `src/fx/`; domain imports only core/domain/kernel; content imports only core/content; fx imports Three.js and content, never the controller. `npm run architecture` enforces this.
- `src/strike.js` numbers and rules unchanged. `STRIKE_TUNE.breakWalls` / `breakTowers` stay `true`.
- Danger rings are readouts, never refusals. No lockout, no safety, no confirmation on any gun.
- The player never controls position, altitude or orbit; no input advances, extends or delays the pass.
- No fuel meter.
- Assets pinned and hash-validated (`npm run assets:check`); never hotlink the upstream viewer. Upstream: `https://github.com/jelaludo/SentryTowers_A6`, revision `fdc4a4a7aaacdce35664f1cd741de0a0d344c9cc`, folder `assets/korp/`.
- No colored emoji in product UI; monochrome vocabulary.
- Isao: two short lines at most, the second is what he does next. Lines are data in `src/isaobriefs.js`.
- No pushes, publishes or messages without explicit authorization. Commit locally per task.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB
  ```

---

## File map

| File | Responsibility |
| --- | --- |
| `src/content/gunship.js` (new) | `GUNSHIP_ORBIT` (pass/station seconds), `GUNSHIP_PLATFORM` (altitude, drift, camera), `GUNSHIP_GUNS` (three profiles). Pure data. |
| `src/domain/gunship.js` (new) | Orbit schedule, mount/dismount refusal, gun selection and cadence accumulator, aim ray to the sphere, splash falloff, danger report. No DOM, no Three.js. |
| `src/domain/pilot-posts.js` (new) | The six practice wall posts, extracted verbatim from `enterPilot` in `td-tab.js`. Pays for the gunship's hooks. |
| `src/fx/gunship-optic.js` (new) | Thermal two-pass render (cold override, hot enemies on their own layer), the three danger rings, the KORP model riding the pass with gun pitch and clips. |
| `src/fx/story-views.js` | GUNSHIP button on the strip plus `station(on, seconds)` for the countdown label. |
| `src/fx/story-monitor.js` | Optic head label supplied by the caller (`optic.label`). |
| `src/sentry-pilot.js` | Gunship mode: `mountGunship`, `dismountGunship`, gun keys, per-tick firing through host hooks, readout. |
| `src/td-tab.js` | Folded hooks: `gunship` state beside `strike`, schedule step beside `stepStrike`, strip handler, render switch, monitor optic, test hook. Net line count does not rise. |
| `src/isaobriefs.js` | `gunship_pass`, `gunship_own_wall`. |
| `docs/korp-assets.lock.json` (new), `scripts/assets.mjs` | Pinned KORP LOD1 + manifest. |
| `test/gunship.mjs`, `test/pilot-posts.mjs` (new) | Pure coverage. |
| `scripts/browser-test.mjs` | `--gunship` scenario: mount forced on station, thermal frame, rings, refusal off station. |
| `docs/STATE.md`, `docs/log/entries/…` | State and the decision/validation record. |

---

### Task 1: Content profiles and the orbit schedule

**Files:**
- Create: `src/content/gunship.js`
- Create: `src/domain/gunship.js`
- Test: `test/gunship.mjs`

**Interfaces:**
- Produces: `GUNSHIP_ORBIT = { pass, station }` seconds; `GUNSHIP_PLATFORM = { altitudeCells, driftCells, pitchMin, pitchMax, metresPerCell }`; `GUNSHIP_GUNS = { rotary, bofors, heavy }` each `{ key, label, cue, rate, damage, blastCells, dangerCells, sound, ringHex }` (heavy has `rate: 0`, `strike: true`).
- Produces: `makeGunship(orbit = GUNSHIP_ORBIT, { station = false } = {})`, `stepGunship(st, dt, orbit = GUNSHIP_ORBIT)` returning `'arrive' | 'depart' | null`, `onStation(st)`, `phaseLeft(st)`, `passProgress(st)`.

- [ ] **Step 1: Write the failing test**

Create `test/gunship.mjs`:

```js
// gunship.mjs — the orbital pass, the mount, the guns and the danger rings
// as invariants. The platform's schedule is the one thing the player cannot
// touch, so it is asserted to be untouchable.
import { GUNSHIP_ORBIT, GUNSHIP_GUNS, GUNSHIP_PLATFORM } from '../src/content/gunship.js';
import { makeGunship, stepGunship, onStation, phaseLeft, passProgress } from '../src/domain/gunship.js';

let failures = 0;
const check = (what, ok) => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const soak = (st, secs, orbit = GUNSHIP_ORBIT) => { const ev = []; for (let i = 0; i < Math.round(secs * 60); i++) { const e = stepGunship(st, 1 / 60, orbit); if (e) ev.push(e); } return ev; };

console.log('the profiles:');
{
  check('three guns', Object.keys(GUNSHIP_GUNS).length === 3);
  check('the heavy is the strike', GUNSHIP_GUNS.heavy.strike === true && GUNSHIP_GUNS.heavy.rate === 0);
  check('danger widens with the gun', GUNSHIP_GUNS.rotary.dangerCells < GUNSHIP_GUNS.bofors.dangerCells && GUNSHIP_GUNS.bofors.dangerCells < GUNSHIP_GUNS.heavy.dangerCells);
  check('the pass is longer than the window', GUNSHIP_ORBIT.pass > GUNSHIP_ORBIT.station);
  check('the platform looks down', GUNSHIP_PLATFORM.pitchMax < 0 && GUNSHIP_PLATFORM.pitchMin < GUNSHIP_PLATFORM.pitchMax);
}

console.log('the schedule:');
{
  const st = makeGunship({ pass: 10, station: 4 });
  check('starts on the way in', !onStation(st) && Math.abs(phaseLeft(st) - 10) < 1e-9);
  const ev = soak(st, 10.01, { pass: 10, station: 4 });
  check('arrives once the pass counts out', ev.length === 1 && ev[0] === 'arrive' && onStation(st));
  check('the window counts down', phaseLeft(st) > 3.9 && phaseLeft(st) <= 4);
  check('progress runs 0..1 across the window', passProgress(st) >= 0 && passProgress(st) < 0.05);
  const ev2 = soak(st, 4, { pass: 10, station: 4 });
  check('departs when the window closes', ev2.includes('depart') && !onStation(st));
  check('progress is 0 off station', passProgress(st) === 0);
  const cycles = soak(st, 140, { pass: 10, station: 4 });
  check('the cycle repeats deterministically', cycles.filter((e) => e === 'arrive').length === 10 && cycles.filter((e) => e === 'depart').length === 10);
}
{
  const st = makeGunship({ pass: 10, station: 4 }, { station: true });
  check('a test can start on station', onStation(st) && Math.abs(phaseLeft(st) - 4) < 1e-9);
}
{
  // NO PLAYER INPUT REACHES THE CLOCK: the only mutator is stepGunship with a delta.
  const st = makeGunship({ pass: 10, station: 4 });
  const before = JSON.stringify({ phase: st.phase, left: st.left });
  st.mounted = true; st.gun = 'bofors';
  check('mount and gun selection do not touch the clock', JSON.stringify({ phase: st.phase, left: st.left }) === before);
  check('a negative delta is ignored', (stepGunship(st, -5, { pass: 10, station: 4 }), JSON.stringify({ phase: st.phase, left: st.left }) === before));
}

if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
console.log('gunship ok');
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node test/gunship.mjs`
Expected: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/content/gunship.js'`

- [ ] **Step 3: Write the content and the schedule**

Create `src/content/gunship.js`:

```js
// The KORP/GS01 heavy gunship: the platform the orbital strike always
// implied. Pure data; src/domain/gunship.js takes these as configuration.
// Design: docs/superpowers/specs/2026-09-13-heavy-gunship-design.md.

// The orbit. It cannot be influenced: it is low on fuel and passes over the
// base on a fixed schedule. `pass` is the time between windows, `station`
// how long the guns are yours.
export const GUNSHIP_ORBIT = Object.freeze({ pass: 75, station: 35 });

// Where the platform rides while on station, in cells; the optic's pitch
// limits (radians, negative is down); the model's metre.
export const GUNSHIP_PLATFORM = Object.freeze({
  altitudeCells: 16,   // above the base heart along its normal
  driftCells: 10,      // half the ground track crossed during the window
  pitchMin: -1.5, pitchMax: -0.45,
  metresPerCell: 10,   // the KORP is authored in metres; the story world is 10 m a cell
});

// The three guns. `rate` in rounds per second, `damage` per round at the
// centre of `blastCells`, `dangerCells` the readout ring. The heavy has no
// cadence here: it is the orbital strike, rationed by src/strike.js.
export const GUNSHIP_GUNS = Object.freeze({
  rotary: Object.freeze({ key: 'rotary', label: '25MM', cue: 'trrrrrrrrrr', rate: 30, damage: 0.22, blastCells: 0.45, dangerCells: 0.8, sound: 'minigun_fire', ringHex: 0xdfe8ee, clip: 'Rotary_Fire', strike: false }),
  bofors: Object.freeze({ key: 'bofors', label: '40MM', cue: 'TOH-TOH-TOH', rate: 2.4, damage: 2.6, blastCells: 1.1, dangerCells: 1.6, sound: 'blast_fire', ringHex: 0xffb347, clip: 'Rotary_Fire', strike: false }),
  heavy: Object.freeze({ key: 'heavy', label: '105MM', cue: 'sssshhh-BAAAM', rate: 0, damage: 0, blastCells: 3.2, dangerCells: 3.2, sound: null, ringHex: 0xff6a4d, clip: 'Heavy_Fire', strike: true }),
});
export const GUNSHIP_GUN_ORDER = Object.freeze(['rotary', 'bofors', 'heavy']);
```

Create `src/domain/gunship.js`:

```js
// The gunship as rules: an orbit the player cannot touch, a mount that is
// only offered while the platform is overhead, gun cadence under the game
// clock, the aim ray onto the sphere, splash falloff, and the danger report
// that never blocks a shot. No DOM, no Three.js. The 105 is not here: it is
// src/strike.js, called by the host.
import { GUNSHIP_ORBIT, GUNSHIP_GUNS } from '../content/gunship.js';

export function makeGunship(orbit = GUNSHIP_ORBIT, { station = false } = {}) {
  return {
    phase: station ? 'station' : 'pass',   // pass: counting down to the window; station: overhead
    left: station ? orbit.station : orbit.pass,
    mounted: false,
    gun: 'rotary',
    accum: 0,          // fractional rounds owed by the cadence
    passes: 0,         // windows opened so far
  };
}

// The only clock mutator. Returns 'arrive' on the frame the window opens,
// 'depart' on the frame it closes; nothing else moves the schedule.
export function stepGunship(st, dt, orbit = GUNSHIP_ORBIT) {
  if (!(dt > 0)) return null;
  st.left -= dt;
  if (st.left > 0) return null;
  const over = -st.left;
  if (st.phase === 'pass') { st.phase = 'station'; st.left = Math.max(1e-6, orbit.station - over); st.passes++; return 'arrive'; }
  st.phase = 'pass'; st.left = Math.max(1e-6, orbit.pass - over); st.mounted = false; st.accum = 0;
  return 'depart';
}

export const onStation = (st) => st.phase === 'station';
export const phaseLeft = (st) => Math.max(0, st.left);
// 0..1 across the window while overhead; 0 otherwise. The platform's ground
// track is a function of this and nothing else.
export function passProgress(st, orbit = GUNSHIP_ORBIT) {
  if (st.phase !== 'station') return 0;
  return Math.min(1, Math.max(0, 1 - st.left / Math.max(1e-6, orbit.station)));
}
```

- [ ] **Step 4: Run the test**

Run: `node test/gunship.mjs`
Expected: all `ok`, ending `gunship ok`.

- [ ] **Step 5: Commit**

```bash
git add src/content/gunship.js src/domain/gunship.js test/gunship.mjs
git commit -m "Gunship: the orbit schedule the player cannot touch, and the three gun profiles" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

---

### Task 2: Mount refusal, gun cadence, aim ray, splash and the danger report

**Files:**
- Modify: `src/domain/gunship.js`
- Test: `test/gunship.mjs`

**Interfaces:**
- Produces: `mountGunship(st)` → `'mounted' | 'refused'`; `dismountGunship(st)`; `selectGun(st, key, guns = GUNSHIP_GUNS)` → `true|false`; `stepGun(st, dt, held, guns = GUNSHIP_GUNS)` → integer rounds owed this tick (0 unless mounted, on station, held, and the gun has a cadence); `aimOnSphere(eye, dir, r = 1)` → `[x,y,z] | null`; `splashDamage(dist, radius, dmg)`; `dangerReport(point, radius, bodies)` → `{ walls, towers, tank, isao, inside }` where `bodies` is `[{ kind, pos }]` and `inside` the offending bodies.

- [ ] **Step 1: Append the failing tests**

Append to `test/gunship.mjs` before the final `if (failures)` block (extend the import line to include `mountGunship, dismountGunship, selectGun, stepGun, aimOnSphere, splashDamage, dangerReport`):

```js
console.log('the mount:');
{
  const st = makeGunship({ pass: 10, station: 4 });
  check('off station the seat is refused', mountGunship(st) === 'refused' && !st.mounted);
  soak(st, 10.01, { pass: 10, station: 4 });
  check('on station it is allowed', mountGunship(st) === 'mounted' && st.mounted);
  dismountGunship(st); check('and given back', !st.mounted);
  mountGunship(st); soak(st, 4.01, { pass: 10, station: 4 });
  check('departing throws the gunner out', !st.mounted);
}

console.log('the guns:');
{
  const st = makeGunship({ pass: 10, station: 4 }, { station: true });
  check('rotary by default', st.gun === 'rotary');
  check('selecting a known gun', selectGun(st, 'bofors') && st.gun === 'bofors');
  check('an unknown gun is ignored', !selectGun(st, 'laser') && st.gun === 'bofors');
  check('not mounted: nothing fires', stepGun(st, 1, true) === 0);
  mountGunship(st);
  check('trigger up: nothing fires', stepGun(st, 1, false) === 0);
  let rounds = 0; for (let i = 0; i < 60; i++) rounds += stepGun(st, 1 / 60, true);
  check('the bofors owes its rate over a second', Math.abs(rounds - GUNSHIP_GUNS.bofors.rate) <= 1);
  selectGun(st, 'rotary'); rounds = 0; for (let i = 0; i < 60; i++) rounds += stepGun(st, 1 / 60, true);
  check('the rotary owes thirty a second', Math.abs(rounds - GUNSHIP_GUNS.rotary.rate) <= 1);
  check('a released trigger drops the owed fraction', (stepGun(st, 0.02, false), st.accum === 0));
  selectGun(st, 'heavy');
  check('the heavy has no cadence here', stepGun(st, 1, true) === 0);
  const off = makeGunship({ pass: 10, station: 4 }); off.mounted = true;
  check('off station a mounted flag still fires nothing', stepGun(off, 1, true) === 0);
}

console.log('the aim:');
{
  const hit = aimOnSphere([0, 2, 0], [0, -1, 0]);
  check('straight down lands on the sphere', hit && Math.abs(hit[1] - 1) < 1e-9);
  check('looking away misses', aimOnSphere([0, 2, 0], [0, 1, 0]) === null);
  const g = aimOnSphere([0, 2, 0], [1, -1, 0].map((v) => v / Math.SQRT2));
  check('an oblique ray lands on the near side', g && Math.abs(Math.hypot(g[0], g[1], g[2]) - 1) < 1e-9 && g[1] > 0);
}

console.log('the splash:');
{
  check('full at the centre', splashDamage(0, 1, 4) === 4);
  check('fat middle: three quarters at half radius', Math.abs(splashDamage(0.5, 1, 4) - 3) < 1e-9);
  check('zero at the ring and beyond', splashDamage(1, 1, 4) === 0 && splashDamage(2, 1, 4) === 0);
}

console.log('the danger report:');
{
  const bodies = [{ kind: 'wall', pos: [0.1, 0, 0] }, { kind: 'wall', pos: [3, 0, 0] }, { kind: 'tower', pos: [0, 0.2, 0] }, { kind: 'tank', pos: [0.5, 0, 0] }, { kind: 'isao', pos: [4, 0, 0] }];
  const r = dangerReport([0, 0, 0], 1, bodies);
  check('counts what is inside', r.walls === 1 && r.towers === 1 && r.tank === true && r.isao === false);
  check('lists them', r.inside.length === 3);
  const none = dangerReport([10, 10, 10], 1, bodies);
  check('an empty ring', none.walls === 0 && none.towers === 0 && !none.tank && none.inside.length === 0);
  // the report is a readout: it has no verb. There is no function here that can refuse a shot.
  check('nothing in the module refuses a shot', !('canFire' in { mountGunship, stepGun, dangerReport }));
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node test/gunship.mjs`
Expected: `SyntaxError: The requested module '../src/domain/gunship.js' does not provide an export named 'mountGunship'`

- [ ] **Step 3: Implement**

Append to `src/domain/gunship.js`:

```js
// The seat is offered only while the platform is overhead. Departure
// (stepGunship) takes it back; nothing else does.
export function mountGunship(st) {
  if (st.phase !== 'station') return 'refused';
  st.mounted = true; st.accum = 0;
  return 'mounted';
}
export function dismountGunship(st) { st.mounted = false; st.accum = 0; }

export function selectGun(st, key, guns = GUNSHIP_GUNS) {
  if (!guns[key]) return false;
  st.gun = key; st.accum = 0;
  return true;
}

// Rounds owed this tick. A fractional rate accumulates; releasing the
// trigger forfeits the fraction so a tap cannot bank a burst.
export function stepGun(st, dt, held, guns = GUNSHIP_GUNS) {
  const gun = guns[st.gun];
  if (!held || !st.mounted || st.phase !== 'station' || !gun || !(gun.rate > 0) || !(dt > 0)) { st.accum = 0; return 0; }
  st.accum += gun.rate * dt;
  const n = Math.floor(st.accum);
  st.accum -= n;
  return n;
}

// Where a ray from the platform meets the planet: the nearer root of
// |eye + t·dir| = r, or null when it looks past the world.
export function aimOnSphere(eye, dir, r = 1) {
  const b = 2 * (eye[0] * dir[0] + eye[1] * dir[1] + eye[2] * dir[2]);
  const c = eye[0] * eye[0] + eye[1] * eye[1] + eye[2] * eye[2] - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  if (t <= 0) return null;
  return [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t];
}

// The strike's fat-middle falloff, 1 - (d/r)^2: it holds 75% at half radius
// and reaches zero exactly at the ring, so what stands inside the ring is hit.
export function splashDamage(dist, radius, dmg) {
  if (dist >= radius || radius <= 0) return 0;
  const u = dist / radius;
  return dmg * (1 - u * u);
}

// The readout. Bodies are { kind: 'wall'|'tower'|'tank'|'isao', pos }; the
// report says what stands inside the ring and nothing more. It has no verb
// on purpose: collateral is the player's to see, never the module's to refuse.
export function dangerReport(point, radius, bodies) {
  const inside = [];
  for (const b of bodies) {
    const dx = b.pos[0] - point[0], dy = b.pos[1] - point[1], dz = b.pos[2] - point[2];
    if (dx * dx + dy * dy + dz * dz < radius * radius) inside.push(b);
  }
  return {
    walls: inside.filter((b) => b.kind === 'wall').length,
    towers: inside.filter((b) => b.kind === 'tower').length,
    tank: inside.some((b) => b.kind === 'tank'),
    isao: inside.some((b) => b.kind === 'isao'),
    inside,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `node test/gunship.mjs && npm run architecture`
Expected: `gunship ok`; the architecture guard passes (domain imports content only).

- [ ] **Step 5: Commit**

```bash
git add src/domain/gunship.js test/gunship.mjs
git commit -m "Gunship rules: the seat refused off station, gun cadence under the clock, the aim ray, splash and a danger report with no verb" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

---

### Task 3: Extract the practice post picker to pay for the hooks

**Files:**
- Create: `src/domain/pilot-posts.js`
- Modify: `src/td-tab.js` (the `enterPilot` block; the candidate/posts lines that read `const lanes=…` through `if(!pilotPosts.length)pilotPosts=walls.slice(0,1);`)
- Test: `test/pilot-posts.mjs`

**Interfaces:**
- Produces: `choosePilotPosts({ walls, lanes, centers, cellSide, chord, losClear, count = 6 })` → `number[]` of cell indices, identical to the inline rule it replaces.

- [ ] **Step 1: Write the failing test**

Create `test/pilot-posts.mjs`:

```js
// pilot-posts.mjs — the six practice wall posts, as the rule td-tab used
// inline: nearest walls to the lanes, at least four cells out, with a clear
// line to some lane, never within a cell and a half of each other; the
// closer walls only fill the list when the far ones run out; never empty.
import { choosePilotPosts } from '../src/domain/pilot-posts.js';
let failures = 0;
const check = (what, ok) => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const centers = []; for (let i = 0; i < 20; i++) centers.push([i, 0, 0]);   // a line of cells, one unit apart
const chord = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
{
  const posts = choosePilotPosts({ walls: [2, 5, 6, 9, 12, 15, 18], lanes: [0], centers, cellSide: 1, chord, losClear: () => true, count: 6 });
  check('closest first', posts[0] === 5);
  check('the wall inside four cells is skipped while far ones remain', !posts.includes(2));
  check('no two posts within a cell and a half', posts.every((a, i) => posts.every((b, j) => i === j || chord(centers[a], centers[b]) >= 1.5)));
  check('six posts', posts.length === 6 && posts.includes(2) === false);
}
{
  const posts = choosePilotPosts({ walls: [2, 5, 9], lanes: [0], centers, cellSide: 1, chord, losClear: () => true, count: 6 });
  check('the near wall fills the list when the far ones run out', posts.includes(2) && posts.length === 3);
}
{
  const posts = choosePilotPosts({ walls: [5, 9], lanes: [0], centers, cellSide: 1, chord, losClear: () => false, count: 6 });
  check('no sightline: the far walls are still filled in as fallback', posts.length === 2);
  check('never empty', choosePilotPosts({ walls: [3], lanes: [0], centers, cellSide: 1, chord, losClear: () => false }).length === 1);
}
if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
console.log('pilot-posts ok');
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node test/pilot-posts.mjs`
Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the module**

Create `src/domain/pilot-posts.js`:

```js
// The Sentry Control practice posts: real wall cells beside the incoming
// routes. Extracted verbatim from td-tab's enterPilot so the rule is
// testable and the controller carries only the call.
export function choosePilotPosts({ walls, lanes, centers, cellSide, chord, losClear, count = 6 }) {
  const candidates = walls.map((ci) => ({ ci, d: Math.min(...lanes.map((sp) => chord(centers[ci], centers[sp]))) })).sort((a, b) => a.d - b.d);
  const posts = [];
  for (const v of candidates) {
    if (v.d < cellSide * 4 || !lanes.some((ci) => losClear(v.ci, centers[ci])) || posts.some((ci) => chord(centers[ci], centers[v.ci]) < cellSide * 1.5)) continue;
    posts.push(v.ci); if (posts.length === count) break;
  }
  if (posts.length < count) for (const v of candidates) { if (v.d >= cellSide * 4 && !posts.includes(v.ci)) posts.push(v.ci); if (posts.length === count) break; }
  if (!posts.length) posts.push(walls[0]);
  return posts;
}
```

Note the inline fallback loop only adds walls with `d >= 4 cells`; the test's "near wall fills the list" case therefore expects `2` **not** to be added by the fallback. Fix the test's second block to: `check('the fallback still skips walls inside four cells', !posts.includes(2) && posts.length === 2);`. The behaviour must match the inline rule exactly, so the test follows the code, not the other way round.

- [ ] **Step 4: Replace the inline block in `td-tab.js`**

In `enterPilot`, replace the lines from `const lanes=spawnPoints…` through `if(!pilotPosts.length)pilotPosts=walls.slice(0,1);` with:

```js
    pilotPosts=posts?posts.slice():choosePilotPosts({walls:Array.from(dungeon.tags,(_,ci)=>ci).filter(ci=>!placeError(ci)),lanes:spawnPoints.filter(sp=>sp.alive).map(sp=>sp.ci),centers:graph.centers,cellSide,chord,losClear});
```

Add `choosePilotPosts` to the imports at the top of `td-tab.js` by extending an existing import line (for example the `./strike.js` import line becomes two names longer, or append `import { choosePilotPosts } from './domain/pilot-posts.js';` on the same line as another single-line import). Do not add a line.

- [ ] **Step 5: Run the tests and the guard**

Run: `node test/pilot-posts.mjs && npm run architecture && wc -l src/td-tab.js`
Expected: `pilot-posts ok`; guard passes; the line count is at least 7 below 17605. Record the number.

Run: `npm run test:browser -- --pilot` if such a scenario exists; otherwise run the `sentry-pilot` scenario in `scripts/browser-test.mjs` (line ~70) and confirm `posts.length === 6` in its assertions still holds.

- [ ] **Step 6: Commit**

```bash
git add src/domain/pilot-posts.js test/pilot-posts.mjs src/td-tab.js
git commit -m "Practice posts extracted into a domain rule; td-tab keeps only the call" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

---

### Task 4: Pin the KORP model

**Files:**
- Create: `docs/korp-assets.lock.json`
- Modify: `scripts/assets.mjs` (the lock file list)
- Creates on fetch: `assets/models/korp/korp_d0_lod1.glb`, `assets/models/korp/manifest.json`

- [ ] **Step 1: Compute the upstream hashes**

```bash
R=fdc4a4a7aaacdce35664f1cd741de0a0d344c9cc; B=https://raw.githubusercontent.com/jelaludo/SentryTowers_A6/$R/assets/korp
for f in korp_d0_lod1.glb manifest.json; do curl -sL $B/$f -o /tmp/$f; echo "$f $(shasum -a 256 /tmp/$f | cut -d' ' -f1) $(wc -c < /tmp/$f)"; done
```

Expected sizes: 198764 and 10515.

- [ ] **Step 2: Write the lock**

Create `docs/korp-assets.lock.json` (fill the two `sha256` values from Step 1):

```json
{
  "schema": 1,
  "upstream": "https://github.com/jelaludo/SentryTowers_A6",
  "revision": "fdc4a4a7aaacdce35664f1cd741de0a0d344c9cc",
  "baseUrl": "https://raw.githubusercontent.com/jelaludo/SentryTowers_A6/fdc4a4a7aaacdce35664f1cd741de0a0d344c9cc/",
  "credit": "Models by jelaludo (https://jelaludo.github.io/SentryTowers_A6/korp/), KORP / GS01 heavy gunship, MÖRK manufacturer family, game tier LOD1, reused with attribution under the upstream ASSET-LICENSE.md",
  "files": [
    { "path": "assets/models/korp/manifest.json", "sourcePath": "assets/korp/manifest.json", "sha256": "<from step 1>", "bytes": 10515 },
    { "path": "assets/models/korp/korp_d0_lod1.glb", "sourcePath": "assets/korp/korp_d0_lod1.glb", "sha256": "<from step 1>", "bytes": 198764, "clips": ["Rotary_Cycle", "Rotary_Fire", "Heavy_Fire", "Gear_Retract"] }
  ]
}
```

The `clips` list is checked by the existing `file.clips` rule in `scripts/assets.mjs`.

- [ ] **Step 3: Register the lock and fetch**

In `scripts/assets.mjs`, add `'docs/korp-assets.lock.json'` to the array of lock files (the long `for(const lockFile of [...])` line).

Run: `node scripts/assets.mjs fetch && npm run assets:check`
Expected: the two files land under `assets/models/korp/` and the check prints a verified count including them.

- [ ] **Step 4: Confirm the pivots the optic will drive**

```bash
node -e "const b=require('fs').readFileSync('assets/models/korp/korp_d0_lod1.glb');const j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));for(const n of ['GUN_L_PITCH','GUN_R_PITCH','GUN_HEAVY_PITCH','GUN_L_SPIN','GUN_R_SPIN','ENGINE_FL_PITCH','ENGINE_FR_PITCH','ENGINE_RL_PITCH','ENGINE_RR_PITCH','GEAR_NOSE','GEAR_L','GEAR_R','SOCKET_MUZZLE_HEAVY','MARKING_GS01'])console.log(n,j.nodes.some(x=>x.name===n))"
```

Expected: every line `true`.

- [ ] **Step 5: Commit**

```bash
git add docs/korp-assets.lock.json scripts/assets.mjs assets/models/korp
git commit -m "KORP/GS01 heavy gunship pinned: the game tier and its manifest, hash-validated" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

---

### Task 5: The thermal optic, the danger rings and the platform model

**Files:**
- Create: `src/fx/gunship-optic.js`
- Modify: `src/fx/story-monitor.js` (head label from the caller)

**Interfaces:**
- Consumes: `GUNSHIP_GUNS`, `GUNSHIP_PLATFORM` from content; `loadGlbWithClips(url)` from `src/glbmodels.js` — check `scripts/architecture.mjs` first: if `src/fx` may not import a top-level module, load the GLB with Three's `GLTFLoader` from `vendor/` the way `src/fx/story-base.js` loads its kit (copy its loader import), and note which in the commit message.
- Produces: `createGunshipOptic(scene, { cellSide, metresPerCell })` →
  - `mount()` / `dismount()` — shows/hides rings and thermal; the model is shown while `station(true)`.
  - `station(on)` — shows/hides the platform model.
  - `platform(obj)` — the fx keeps the KORP model as a child of the host's virtual mount object `obj`.
  - `pose({ pitch, gun, firing, dt })` — gun pitch nodes follow the optic's pitch (0 forward to +70° down for the rotary pair, +60° for the heavy), spins the barrels while the rotary fires, plays `Rotary_Fire` / `Heavy_Fire` on `firing` events.
  - `rings(point, normal, gun, report)` — moves the three rings to the impact point on the tangent plane; the active gun's ring is bright, the others faint; a ring with friendlies inside goes red.
  - `render(renderer, camera, enemies)` — the thermal two-pass; returns nothing. Must leave `camera.layers`, `scene.overrideMaterial`, `scene.background` and every enemy's layer mask as it found them.
  - `active()` — true while mounted.
  - `dispose()`.

- [ ] **Step 1: Write the module**

Create `src/fx/gunship-optic.js`:

```js
// The gunship's optic and body. THERMAL: the world is drawn once through a
// cold override material with the sky black, then the enemies are drawn
// again on their own layer with their own materials, hot over cold. The
// player aims in this abstraction; the corner monitor shows the ground
// truth. RINGS: three readouts on the tangent plane at the impact point,
// one per gun; red when something of ours stands inside. The KORP model
// rides the host's platform object with its guns pitched to the optic.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { GUNSHIP_GUNS, GUNSHIP_GUN_ORDER } from '../content/gunship.js';

const HOT_LAYER = 2;   // MAP_LAYER is 1 in the game; 2 is free
const KORP_URL = 'assets/models/korp/korp_d0_lod1.glb';

export function createGunshipOptic(scene, { cellSide, metresPerCell = 10 }) {
  const cold = new THREE.MeshLambertMaterial({ color: 0x3b4d58 });
  const rings = new THREE.Group(); rings.visible = false; scene.add(rings);
  const ringOf = {};
  for (const key of GUNSHIP_GUN_ORDER) {
    const g = GUNSHIP_GUNS[key], r = g.dangerCells * cellSide;
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.97, r, 64), new THREE.MeshBasicMaterial({ color: g.ringHex, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    m.layers.set(HOT_LAYER); rings.add(m); ringOf[key] = m;
  }
  const platform = new THREE.Group(); platform.visible = false;
  let model = null, mixer = null, clips = {}, mounted = false, spin = 0;
  const masks = new Map(), up = new THREE.Vector3(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  new GLTFLoader().load(KORP_URL, (g) => {
    model = g.scene; model.scale.setScalar(cellSide / metresPerCell);
    // the flight pose: engines to hover, gear folded, aiming down
    for (const n of ['FL', 'FR', 'RL', 'RR']) { const e = model.getObjectByName(`ENGINE_${n}_PITCH`); if (e) e.rotation.x = -Math.PI / 2; }
    for (const n of ['NOSE', 'L', 'R']) { const e = model.getObjectByName(`GEAR_${n}`); if (e) e.rotation.x = -Math.PI / 2; }
    mixer = new THREE.AnimationMixer(model);
    for (const c of g.animations) clips[c.name] = mixer.clipAction(c);
    if (clips.Rotary_Cycle) { clips.Rotary_Cycle.setLoop(THREE.LoopRepeat, Infinity); }
    for (const n of ['Rotary_Fire', 'Heavy_Fire']) if (clips[n]) { clips[n].setLoop(THREE.LoopOnce, 1); clips[n].clampWhenFinished = false; }
    platform.add(model);
  });
  const node = (n) => model?.getObjectByName(n);
  function setLayer(enemies, hot) {
    for (const e of enemies) {
      if (!e.alive || !e.obj) continue;
      e.obj.traverse((o) => { if (hot) { masks.set(o, o.layers.mask); o.layers.set(HOT_LAYER); } else if (masks.has(o)) o.layers.mask = masks.get(o); });
    }
    if (!hot) masks.clear();
  }
  return {
    active: () => mounted,
    mount() { mounted = true; rings.visible = true; },
    dismount() { mounted = false; rings.visible = false; },
    station(on) { platform.visible = on; },
    platform(obj) { obj.add(platform); },
    pose({ pitch = 0, gun = 'rotary', firing = null, dt = 0 }) {
      if (!model) return;
      const down = Math.max(0, -pitch);   // the optic's pitch is negative downward; the pivots take positive downward
      for (const n of ['L', 'R']) { const p = node(`GUN_${n}_PITCH`); if (p) p.rotation.x = Math.min(70 * Math.PI / 180, down); }
      const h = node('GUN_HEAVY_PITCH'); if (h) h.rotation.x = Math.min(60 * Math.PI / 180, down);
      if (gun === 'rotary' && firing === 'held') spin = Math.min(1, spin + dt * 3); else spin = Math.max(0, spin - dt * 1.5);
      for (const n of ['L', 'R']) { const s = node(`GUN_${n}_SPIN`); if (s) s.rotation.z += spin * dt * 40; }
      if (firing === 'round' && clips[GUNSHIP_GUNS[gun]?.clip]) clips[GUNSHIP_GUNS[gun].clip].reset().play();
      mixer?.update(dt);
    },
    rings(point, normal, gun, report) {
      if (!point) { rings.visible = false; return; }
      rings.visible = mounted;
      rings.position.set(point[0], point[1], point[2]).addScaledVector(up.set(normal[0], normal[1], normal[2]), cellSide * 0.05);
      rings.quaternion.copy(q.setFromUnitVectors(zAxis, up));
      for (const key of GUNSHIP_GUN_ORDER) {
        const m = ringOf[key], hot = report?.[key];   // report per gun: { walls, towers, tank, isao }
        const bad = hot && (hot.walls || hot.towers || hot.tank || hot.isao);
        m.material.color.set(bad ? 0xff3b2f : GUNSHIP_GUNS[key].ringHex);
        m.material.opacity = key === gun ? (bad ? 0.9 : 0.6) : 0.18;
      }
    },
    render(renderer, camera, enemies) {
      const bg = scene.background, mask = camera.layers.mask, clear = renderer.autoClear;
      setLayer(enemies, true);
      scene.background = null; scene.overrideMaterial = cold; camera.layers.set(0);
      renderer.setRenderTarget(null); renderer.autoClear = true; renderer.render(scene, camera);
      scene.overrideMaterial = null; camera.layers.set(HOT_LAYER); renderer.autoClear = false; renderer.render(scene, camera);
      renderer.autoClear = clear; camera.layers.mask = mask; scene.background = bg;
      setLayer(enemies, false);
    },
    dispose() { rings.removeFromParent(); platform.removeFromParent(); cold.dispose(); for (const m of Object.values(ringOf)) { m.geometry.dispose(); m.material.dispose(); } },
  };
}
```

If the vendored loader lives under a different path (check `ls vendor | grep -i gltf`), use that path.

- [ ] **Step 2: The monitor's head label**

In `src/fx/story-monitor.js` change the label line to:

```js
      const label = mesh ? 'TALON · seeker feed' : (optic.label ?? 'OPTIC · TARGET'); if (head.textContent !== label) head.textContent = label;
```

- [ ] **Step 3: Syntax and layer check**

Run: `npm run check`
Expected: passes (syntax, kernel, logs, assets, architecture). If the architecture guard rejects the fx module's import, follow the loader note in Interfaces.

- [ ] **Step 4: Commit**

```bash
git add src/fx/gunship-optic.js src/fx/story-monitor.js
git commit -m "Gunship optic: thermal two-pass, three danger rings on the tangent plane, the KORP riding the pass with its guns pitched to the optic" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

---

### Task 6: GUNSHIP on the strip

**Files:**
- Modify: `src/fx/story-views.js`

**Interfaces:**
- Produces: `mounts(list)` renders a GUNSHIP button after the mounts (`data-mount="gunship"`); `station(on, seconds)` sets the button's `disabled` and its text: `GUNSHIP · 42 S` while dark, `GUNSHIP · 18 S LEFT` while live. Clicking it while dark does nothing (disabled).

- [ ] **Step 1: Edit**

In `src/fx/story-views.js`:

```js
export function createStoryViews(root, on) {
  const nav = document.createElement('nav'); nav.id = 'story-views'; root.append(nav);
  let current = 'tank', ship = null;
  const active = (name) => { current = name; for (const b of nav.querySelectorAll('button')) b.classList.toggle('active', (b.dataset.mount ?? b.dataset.view) === name); };
  function mounts(list) {
    nav.innerHTML = [`<button type="button" data-view="tank">TANK</button>`, ...list.map((m) => `<button type="button" data-mount="${m.key}">${m.label.toUpperCase()}</button>`), `<button type="button" data-mount="gunship" class="gunship" disabled>GUNSHIP</button>`, `<button type="button" data-view="map">MAP</button>`].join('');
    for (const b of nav.querySelectorAll('button')) b.addEventListener('click', () => { if (b.dataset.mount) on.mount?.(b.dataset.mount); else on[b.dataset.view]?.(); active(b.dataset.mount ?? b.dataset.view); });
    ship = nav.querySelector('[data-mount="gunship"]'); active(current);
  }
  // the pass: dark with the next window counting down, live with the window counting out. Nothing here can change either.
  function station(on, seconds) { if (!ship) return; ship.disabled = !on; ship.classList.toggle('live', on); const t = `GUNSHIP · ${Math.ceil(seconds)} S${on ? ' LEFT' : ''}`; if (ship.textContent !== t) ship.textContent = t; }
  mounts([]);
  return { active, mounts, station, dispose() { nav.remove(); } };
}
```

Add to `styles.css` after the `#story-views button.active` rule:

```css
#story-views button.gunship:disabled { opacity: 0.45; cursor: default; }
#story-views button.gunship.live { border-color: #ffb43d; color: #ffd48a; }
```

- [ ] **Step 2: Check**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/fx/story-views.js styles.css
git commit -m "The strip names the gunship: dark with the next pass counting down, live for the window" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

---

### Task 7: The mount in `sentry-pilot.js`

**Files:**
- Modify: `src/sentry-pilot.js`
- Modify: `app.css` (gun buttons)

**Interfaces:**
- Consumes from the host (new `host.gunship` object, supplied by td-tab in Task 8):
  - `state` — the domain gunship state; `strike` — the strike state; `tune` — `strikeTune`.
  - `heart()` → cell index the platform rides over; `centers`, `normals` — the graph arrays; `cell(pos)` → nearest cell index.
  - `enemies()` → live enemy list; `damage(e, dmg)` → applies `damageEnemy(e, tNow, dmg, true, 'strike')`.
  - `bodies()` → `[{ kind, pos }]` walls, towers, tank, isao (walls cached by the host on mount).
  - `arm()`, `paint(ci)`, `launch()` → the strike console's existing functions (arm toggles the safety; launch runs the same code the LAUNCH button runs).
  - `puff(ci, hex, life, r)` → `warnRing`; `sfx(name, pos)`.
  - `optic` — the `createGunshipOptic` instance.
  - `views(name)` → `storyViews.active(name)`.
- Produces on the pilot: `mountGunship()` → `'mounted' | 'refused'`; `dismountGunship()`; `gunship` (truthy while mounted); `gunshipTick(dt)` — called by td-tab from the sim step; `gunshipOptic()` → monitor `{ from, pos, label }` or null; `state.tower` is the virtual mount `{ key: 'gunship', obj, ci }` while mounted.

- [ ] **Step 1: Add the gunship section**

In `src/sentry-pilot.js`, after the `const inBox = …` / `target()` / `attach()` definitions and before `return {…}`, add:

```js
  // THE GUNSHIP (docs/superpowers/specs/2026-09-13-heavy-gunship-design.md). A virtual mount riding the pass over the base:
  // the player takes the optic and the guns, never the aircraft. Position is the schedule's, not an input.
  const G = host.gunship, ship = { key: 'gunship', obj: new THREE.Group(), ci: -1 }, aim = new THREE.Vector3(), n3 = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), basis = new THREE.Matrix4();
  let gunship = false, impact = null, report = null, savedPitch = [-1.25, .9];
  const guns = panel.querySelector('.pilot-weapons').cloneNode(false); guns.className = 'pilot-guns'; guns.style.display = 'none';
  guns.innerHTML = G ? G.order.map((k, i) => `<button data-gun="${k}">${i + 1} · ${G.guns[k].label}</button>`).join('') : ''; panel.querySelector('header').after(guns);
  function selectGun(key) { if (!G || !G.select(key)) return; state.held = false; guns.querySelectorAll('[data-gun]').forEach((b) => b.classList.toggle('on', b.dataset.gun === key)); if (key === 'heavy') G.arm(); else if (G.strike.armed) G.arm(); }   // the heavy IS the strike: choosing it arms the safety, leaving it stands down
  guns.querySelectorAll('[data-gun]').forEach((b) => listen(b, 'click', () => selectGun(b.dataset.gun)));
  function placePlatform() {   // above the heart along its normal, drifting across the base with the window's progress
    const hc = G.centers[G.heart()]; n3.fromArray(G.normals[G.heart()]).normalize();
    t1.set(Math.abs(n3.y) < .9 ? 0 : 1, Math.abs(n3.y) < .9 ? 1 : 0, 0).cross(n3).normalize(); t2.copy(n3).cross(t1);
    const c = host.cellSide(), drift = (G.progress() * 2 - 1) * G.platform.driftCells * c;
    ship.obj.position.fromArray(hc).addScaledVector(n3, G.platform.altitudeCells * c).addScaledVector(t1, drift);
    basis.makeBasis(t2, n3, t1); ship.obj.quaternion.setFromRotationMatrix(basis); ship.ci = G.heart();
  }
  function mountGunship() {
    if (!G || G.mount() !== 'mounted') return 'refused';
    gunship = true; state.tower = ship; state.held = false; state.target = null; state.view = 'pov'; state.zoom = 1; host.zoom(1);
    savedPitch = [-1.25, .9]; state.pitch = -1.1; placePlatform(); state.yaw = 0;
    guns.style.display = ''; panel.querySelector('header').innerHTML = 'KORP / GS01 <small>HEAVY GUNSHIP · ON STATION</small>'; panel.querySelector('footer').textContent = '1 rotary · 2 bofors · 3 heavy (the strike) · Space fires · 2 PoV · 3 third · M map';
    G.optic.mount(); host.views?.('gunship'); selectGun(G.state.gun);
    return 'mounted';
  }
  function dismountGunship() {
    if (!gunship) return; gunship = false; G.dismount(); G.optic.dismount(); G.optic.rings(null); impact = null; report = null; guns.style.display = 'none';
    if (G.strike.armed) G.arm();   // the safety re-engages when the gunner leaves
  }
  // the sim step: aim, the readout, the rounds. Every gun fires wherever it is pointed; the report is a readout.
  function gunshipTick(dt) {
    if (!G) return;
    G.optic.station(G.onStation());
    if (!gunship) return;
    if (!G.onStation()) { dismountGunship(); host.views?.('tank'); host.leave?.(); return; }
    placePlatform(); up.copy(ship.obj.position).normalize();
    forward.set(Math.sin(state.yaw), 0, Math.cos(state.yaw)).applyQuaternion(ship.obj.quaternion).normalize();
    direction.copy(forward).multiplyScalar(Math.cos(state.pitch)).addScaledVector(up, Math.sin(state.pitch)).normalize();
    eye.copy(ship.obj.position);
    impact = G.aim(eye.toArray(), direction.toArray());
    const ci = impact ? G.cell(impact) : -1, gun = G.guns[G.state.gun], c = host.cellSide();
    report = impact ? Object.fromEntries(G.order.map((k) => [k, G.danger(impact, G.guns[k].dangerCells * c)])) : null;
    G.optic.rings(impact, ci >= 0 ? G.normals[ci] : [0, 1, 0], G.state.gun, report);
    let fired = null;
    if (gun.strike) {
      if (ci >= 0 && G.strike.armed && !map) G.paint(ci);
      if (state.held && !map) { state.held = false; if (G.launch()) fired = 'round'; }
    } else {
      const n = G.step(dt, state.held && !map);
      if (n > 0 && impact) { fired = 'round'; G.sfx(gun.sound, impact); for (let i = 0; i < n; i++) { const a = (G.rounds++) * 2.399963, r = gun.blastCells * c * .5 * Math.sqrt((G.rounds % 7) / 7); aim.fromArray(impact).addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r); for (const e of G.enemies()) { const d = aim.distanceTo(v.fromArray(e.pos)); if (d < gun.blastCells * c) G.damage(e, G.splash(d, gun.blastCells * c, gun.damage)); } } if (gun.key === 'bofors' || G.rounds % 6 === 0) G.puff(ci, gun.ringHex, gun.key === 'bofors' ? .5 : .18, gun.blastCells * c); }
      else if (state.held && !map) fired = 'held';
    }
    G.optic.pose({ pitch: state.pitch, gun: G.state.gun, firing: fired, dt });
    const r = report?.[G.state.gun], left = Math.ceil(G.left());
    panel.querySelector('output').textContent = `${gun.label} · ${gun.cue} · ON STATION ${left} S` + (gun.strike ? ` · ${G.strike.ready > 0 ? (G.strike.armed ? 'ARMED' : 'READY') : G.strike.cooldown > 0 ? 'RE-ORBIT' : 'NO SHELL'}` : '') + (r ? ` · IN BLAST: ${r.walls} WALL${r.walls === 1 ? '' : 'S'} · ${r.towers} SENTR${r.towers === 1 ? 'Y' : 'IES'}${r.tank ? ' · TANK' : ''}${r.isao ? ' · ISAO' : ''}` : '');
  }
  const gunshipOptic = () => gunship && impact ? { from: aim.fromArray(impact).addScaledVector(t1, host.cellSide() * 2.2).toArray(), pos: impact, label: 'GROUND TRUTH · IMPACT' } : null;
```

Then wire the existing pieces:

- In `pose()`, clamp the pitch to the platform's limits while mounted: replace `state.pitch=Math.max(-1.25,Math.min(.9,state.pitch-dy*.004/state.zoom))` in the pointermove listener with `state.pitch=Math.max(gunship?G.platform.pitchMin:-1.25,Math.min(gunship?G.platform.pitchMax:.9,state.pitch-dy*.004/state.zoom))`.
- In `pose()`, the third-person offset for the gunship should show the KORP: change `const c=host.cellSide(),back=state.view==='third'?2.4*c:.34*c,lift=state.view==='third'?1.35*c:.12*c;` to `const c=host.cellSide(),back=state.view==='third'?(gunship?6*c:2.4*c):(gunship?0:.34*c),lift=state.view==='third'?(gunship?2.2*c:1.35*c):(gunship?0:.12*c);`.
- In `select(key)` (the weapon selection), first line: `dismountGunship();`.
- In the keydown handler, before the story key block: `if(gunship&&/^[123]$/.test(e.key)){selectGun(G.order[Number(e.key)-1]);return;}` and keep `2`/`3` for views only when not mounted (the gunship uses `2 PoV` / `3 third` via `setView` from the footer text: change the footer text in `mountGunship` to `'1 rotary · 2 bofors · 3 heavy (the strike) · Space fires · V toggles PoV/third · M map'` and add `if(e.code==='KeyV'&&gunship)setView(state.view==='third'?'pov':'third');`).
- In `dispose()`: call `dismountGunship();` first.
- In the returned object add: `mountGunship,dismountGunship,gunshipTick,gunshipOptic,get gunship(){return gunship;},`.

Add to `app.css` after the `#sentry-pilot button` rule:

```css
#sentry-pilot .pilot-guns{display:flex;gap:6px;margin:6px 0}#sentry-pilot .pilot-guns button.on{border-color:#ffb43d;color:#ffd48a}
```

- [ ] **Step 2: Syntax check**

Run: `node --check src/sentry-pilot.js && npm run check`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/sentry-pilot.js app.css
git commit -m "The gunship seat in the pilot host: a virtual mount riding the pass, three guns, the readout, the heavy handed to the strike" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

---

### Task 8: Wire `td-tab.js` without growing it, and Isao's lines

**Files:**
- Modify: `src/td-tab.js` (folded into existing lines only)
- Modify: `src/isaobriefs.js`

**Interfaces:**
- Consumes: everything from Tasks 1, 2, 5, 6, 7.

- [ ] **Step 1: Imports**

Extend the existing `./strike.js` import line to also import the gunship domain and content, e.g. append after it on the same line: `import { makeGunship, stepGunship, onStation, phaseLeft, passProgress, mountGunship, dismountGunship, selectGun, stepGun, aimOnSphere, splashDamage, dangerReport } from './domain/gunship.js'; import { GUNSHIP_GUNS, GUNSHIP_GUN_ORDER, GUNSHIP_PLATFORM, GUNSHIP_ORBIT } from './content/gunship.js'; import { createGunshipOptic } from './fx/gunship-optic.js';`

- [ ] **Step 2: State**

Line `const strike = makeStrike();` becomes:

```js
  const strike = makeStrike(), gunship = makeGunship(GUNSHIP_ORBIT, { station: urlParams.get('gunship') === 'station' }); let gunshipOptic = null, gunshipWalls = null;   // the platform's schedule runs on the game clock beside the strike's window; ?gunship=station opens the window at once for acceptance
```

Confirm `urlParams` is defined before this line (it is used at line ~17584; grep `const urlParams`). If it is declared later, use `new URLSearchParams(location.search)` inline.

- [ ] **Step 3: The schedule step and Isao**

Line `if (stepStrike(strike, dt, strikeTune) === 'armed') {` becomes:

```js
      { const ev = stepGunship(gunship, dt); storyViews?.station(onStation(gunship), phaseLeft(gunship)); if (ev === 'arrive' && story) showBrief('gunship_pass'); pilot?.gunshipTick?.(dt); } if (stepStrike(strike, dt, strikeTune) === 'armed') {
```

- [ ] **Step 4: The strip handler**

In `storyApi.unlock`, the `mount: (key) => { … }` callback becomes:

```js
mount: (key) => { if (key === 'gunship') { if (!onStation(gunship)) return; if (!pilotMode) enterPilot([...towers.map((t) => t.ci)]); if (pilot.mountGunship() !== 'mounted') storyViews.active('tank'); return; } if (pilotMode) pilotHost?.pick(key); else { const tw = towers.find((t) => t.key === key); if (tw) enterPilot([tw.ci, ...towers.map((t) => t.ci).filter((c) => c !== tw.ci)]); } }
```

and after `storyViews.mounts(…)` on the same line add `storyViews.station(onStation(gunship), phaseLeft(gunship));`.

- [ ] **Step 5: The host object**

In `enterPilot`, extend the `pilotHost={…}` literal (same lines) with:

```js
views:name=>storyViews?.active(name),leave:()=>leavePilot(),
gunship:{state:gunship,strike,tune:strikeTune,guns:GUNSHIP_GUNS,order:GUNSHIP_GUN_ORDER,platform:GUNSHIP_PLATFORM,centers:graph.centers,normals:graph.normals,heart:()=>dungeon.heart,cell:p=>cellIndex(norm3(p)),enemies:()=>enemies.filter(e=>e.alive&&e.id>0),damage:(e,d)=>damageEnemy(e,spawnClock,d,true,'strike'),
 bodies:()=>[...(gunshipWalls??=Array.from(dungeon.tags,(tg,ci)=>tg===BLOCKED?{kind:'wall',pos:graph.centers[ci]}:null).filter(Boolean)),...towers.map(t=>({kind:'tower',pos:graph.centers[t.ci]})),{kind:'tank',pos:player.pos},...(isao?[{kind:'isao',pos:isao.obj.position.toArray()}]:[])],
 onStation:()=>onStation(gunship),left:()=>phaseLeft(gunship),progress:()=>passProgress(gunship),mount:()=>mountGunship(gunship),dismount:()=>dismountGunship(gunship),select:k=>selectGun(gunship,k),step:(dt,held)=>stepGun(gunship,dt,held),aim:aimOnSphere,splash:splashDamage,danger:(p,r)=>dangerReport(p,r,pilotHost.gunship.bodies()),rounds:0,
 arm:()=>{const r=toggleArm(strike);armUiKey='';syncArmUi();return r;},paint:ci=>paintTarget(strike,ci)==='locked',launch:()=>{if(!(strike.armed&&strike.target>=0))return false;launchBtn.click();return true;},puff:(ci,hex,life,r)=>{if(ci>=0)warnRing(ci,hex,life,r);},sfx:(name,pos)=>{if(name)sfx.play(name,{dist:camDist(pos)});},
 optic:(gunshipOptic??=(()=>{const o=createGunshipOptic(scene,{cellSide,metresPerCell:GUNSHIP_PLATFORM.metresPerCell});o.platform(pilot?.state?.tower?.obj??scene);return o;})())},
```

Check each name against the file before committing: `dungeon.heart` (grep `dungeon.heart`), `spawnClock` as the sim time used in other `damageEnemy` calls (grep `damageEnemy(e, ` to see what the tower loop passes and use the same), `BLOCKED`, `player.pos`, `isao`, `launchBtn`, `armUiKey`, `syncArmUi`, `warnRing`, `sfx.play`, `camDist`, `cellIndex`, `norm3`. If `gunshipWalls` must reset when walls change, clear it in `executeStrike` by appending `gunshipWalls=null;` to its first line.

The `optic.platform(...)` call must attach the platform group to the pilot's virtual mount; because `pilot` is created by this same `createSentryPilot` call, do it right after: on the line `pilot=createSentryPilot(root,pilotHost={…});` append `pilotHost.gunship.optic.platform(pilot.state.tower?.obj);` is wrong (state.tower is null until a mount). Instead: in `sentry-pilot.js` `mountGunship`, call `G.optic.platform(ship.obj)` once (guard with a flag) and add `scene.add(ship.obj)` via a host hook `G.scene.add(ship.obj)` → add `scene,` to the host's gunship object. Keep the optic creation lazy as written and remove the `.platform(...)` call from td-tab.

- [ ] **Step 6: The render switch and the monitor optic**

The `postfx.render(); storyMonitor?.render(…)` line becomes:

```js
    if (gunshipOptic?.active()) gunshipOptic.render(renderer, camera, enemies); else postfx.render(); storyMonitor?.render(renderer, scene, towerSeekers.find((m) => m.pool === talonPool && talonPool)?.mesh ?? null, cellSide, dt, pilot?.gunship ? pilot.gunshipOptic() : (pilotMode && pilot?.state.tower && missileOf(pilot.state.tower.key) && pilot.state.tower.pilotTarget && !pilot.state.tower.pilotTarget.pilotAim ? { from: perchOf(pilot.state.tower), pos: pilot.state.tower.pilotTarget.pos } : null));   // the seeker feed rides behind a TALON in flight; the gunship's monitor is the ground truth at the impact point; otherwise the optic inset on the tracked target
```

The tower firing loop at line ~10148 (`storyScope.update({ on: !!cfg && !pilot.isMap() …`) iterates `towers`; the virtual mount is never in `towers`, so it never fires there. Confirm `pilot.state.tower` being the virtual mount does not break `perchOf(pilot.state.tower)` calls elsewhere: grep `pilot.state.tower` and `pilot?.state.tower` and make each site tolerate `ci` being the heart cell (the radar hud uses `graph.centers[pilot.state.tower.ci]`, which is fine). `losClear(pilot.state.tower.ci, …)` in `visible:` is only used by `target()`, which the gunship path does not call.

- [ ] **Step 7: The test hook**

In the `window.__stalheartTest = { state: () => ({ …` object, append to an existing line: `gunship: { phase: gunship.phase, left: +gunship.left.toFixed(2), mounted: gunship.mounted, gun: gunship.gun, passes: gunship.passes, optic: !!gunshipOptic?.active(), station: onStation(gunship) },` and to the object's method list (an existing line): `mountGunship: () => { if (!storyViews) storyApi.unlock('views'); storyViews.station(onStation(gunship), phaseLeft(gunship)); document.querySelector('#story-views [data-mount="gunship"]')?.click(); return !!pilot?.gunship; }, gunshipHold: (on) => { if (pilot) pilot.state.held = !!on; }, gunshipGun: (k) => selectGun(gunship, k),`.

- [ ] **Step 8: Isao**

In `src/isaobriefs.js`, after `rocket_sites`, add:

```js
  gunship_pass: {
    id: 'gunship_pass', face: 'focused', title: 'COMMS · ISAO', once: true,
    lines: ['The gunship is overhead. Fuel for a pass, not a landing.', 'I mark what it must not hit.'],
  },
```

Confirm the entry shape (`lines` array, `face` id) against `quiver_intro` in the same file and copy its exact fields.

- [ ] **Step 9: Line budget, tests, checks**

Run: `wc -l src/td-tab.js && npm test && npm run check && npm run build`
Expected: line count ≤ the number recorded in Task 3 (never above 17605); all pass. Then set `docs/architecture-budget.json` `lineBudgets["src/td-tab.js"]` to the exact new count and run `npm run architecture` again.

- [ ] **Step 10: Commit**

```bash
git add src/td-tab.js src/isaobriefs.js docs/architecture-budget.json
git commit -m "The gunship wired into the story: schedule on the game clock, the strip's seat, thermal render, ground-truth monitor, Isao's line; td-tab's budget lowered" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

---

### Task 9: Browser acceptance

**Files:**
- Modify: `scripts/browser-test.mjs` (a `--gunship` branch beside `--story-world`)

- [ ] **Step 1: Add the scenario**

After the `--story-world` branch, add:

```js
 } else if(args.includes('--gunship')) {
 await go('gunship-off-station','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);await delay(1500);
 {const s=await evaluate('window.__stalheartTest.state().gunship');assert.equal(s.phase,'pass','the platform starts on its way in');assert(!s.station);
  const mounted=await evaluate('window.__stalheartTest.mountGunship()');assert.equal(mounted,false,'off station the seat is refused');
  assert(await evaluate('document.querySelector("#story-views [data-mount=gunship]").disabled'),'the button is dark');}
 await finish();
 await go('gunship-on-station','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6&gunship=station#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);await delay(1500);
 {assert(await evaluate('window.__stalheartTest.mountGunship()'),'on station the seat is taken');await delay(800);
  const s=await evaluate('window.__stalheartTest.state().gunship');assert(s.mounted&&s.optic,'thermal optic live');
  assert.equal(await evaluate('document.querySelector("#story-monitor .head").textContent'),'GROUND TRUTH · IMPACT','the monitor shows the impact point');
  current='gunship-thermal-rotary';await finish();
  await evaluate('window.__stalheartTest.gunshipGun("heavy")');await delay(300);current='gunship-thermal-heavy';await finish();
  // no input reaches the clock: the window keeps counting while mounted
  const a=await evaluate('window.__stalheartTest.state().gunship.left');await delay(1200);const b=await evaluate('window.__stalheartTest.state().gunship.left');assert(b<a,'the window counts out under the gunner');}
```

Match the file's `go`/`finish`/`until`/`evaluate` helpers exactly as the `--story-world` branch uses them; `finish()` captures the screenshot named by `current`.

- [ ] **Step 2: Run it**

Run: `npm run test:browser -- --gunship`
Expected: both scenarios pass; screenshots `gunship-thermal-rotary.png` and `gunship-thermal-heavy.png` in `artifacts/`. Open both and confirm: cold shaded geometry, black sky, enemies (if any are up at stage 6) bright, three rings at the aim point, the KORP visible from the third view if `V` was pressed (optional third screenshot).

Then run the full suites: `npm run test:browser` and `node scripts/browser-test.mjs --dist` after `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add scripts/browser-test.mjs artifacts/gunship-thermal-rotary.png artifacts/gunship-thermal-heavy.png
git commit -m "Gunship acceptance: refused off station, thermal and ground truth on station, the window counting out under the gunner" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

---

### Task 10: Record it

**Files:**
- Modify: `docs/STATE.md`
- Create: `docs/log/entries/2026-09-14-heavy-gunship-mount-implemented.json` via `/deban` or `npm run log -- add FILE`

- [ ] **Step 1: STATE**

In `docs/STATE.md` replace the **Next session: the Heavy Gunship** paragraph with a short paragraph under the story section: the gunship is on the strip; the fixed pass (`GUNSHIP_ORBIT`); gunner only; three guns with the 105 rationed by `strike.js` unchanged; thermal optic and ground-truth monitor; soft-warning rings; KORP LOD1 pinned; open items: swarm scale unmeasured, gun numbers untuned, the model's flight pose not reviewed. Set **Next priorities** to a playtest of the gunship against a real horde with the swarm cost measured first.

- [ ] **Step 2: Deban**

Use `/deban sync` to write a validation entry (type per the skill) with: what shipped, the td-tab line count before/after and the lowered budget, the acceptance evidence, and the open items above. Regenerate `DEVLOG.md` as the skill does.

- [ ] **Step 3: Commit**

```bash
git add docs/STATE.md docs/log/entries DEVLOG.md
git commit -m "Deban sync: the heavy gunship mount landed; STATE carries its open items" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01St9HdtgsMqRdmTd9eo11AB"
```

Do not push. Report to the operator (Telegram per CLAUDE.md is a state change worth one message) with what landed, the screenshots' paths, and what remains.

---

## Self-review

- **Spec coverage.** §1 architecture → Tasks 1, 2, 5, 7, 8 (layers, no `strike.js` change, no td-tab growth via Task 3). §2 schedule → Tasks 1, 6, 8. §3 guns → Tasks 1, 2, 7; asset pin → Task 4. §4 optic + monitor → Tasks 5, 8. §5 collateral as readouts → Task 2 `dangerReport` has no verb, Task 7 never refuses. §6 Isao → Task 8. §7 tests → Tasks 1, 2, 3, 9. §8 out of scope respected: no resupply, no VTOL, no fuel, no swarm work. §9 risk: STATE records the unmeasured swarm cost (Task 10).
- **Gaps.** Herding is not implemented on purpose (spec: existing knockback and pathing). The practice mode (`?sentryPilot=1`) gets no GUNSHIP button; the strip is story-only. Recorded in Task 10.
- **Type consistency.** `host.gunship` names used in Task 7 (`state, strike, tune, guns, order, platform, centers, normals, heart(), cell(), enemies(), damage(), bodies(), onStation(), left(), progress(), mount(), dismount(), select(), step(), aim(), splash(), danger(), rounds, arm(), paint(), launch(), puff(), sfx(), optic, scene`) match Task 8's literal, with `scene` added per Task 8 Step 5's note. `gunshipOptic()` returns `{ from, pos, label }` and Task 5's monitor reads `optic.label`.
