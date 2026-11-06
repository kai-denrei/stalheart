# THE LANDING Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut a manual-override landing (about twenty seconds of throttle and tilt under a fuel clock) into the existing SH02 arrival, graded into the foundry's salvage, flown on the first start of a browser and offered afterwards.

**Architecture:** A pure, seeded, fixed-step flight model in `src/domain/manual-landing.js` under one tune literal in `src/content/landing-game.js`; a host in `src/fx/manual-landing.js` that the arrival (`src/fx/arrival.js`) hands its rocket, plumes, camera, sound and ground query while the OVERRIDE / MANUAL / FLARE phases run; a HUD panel (`src/fx/landing-hud.js`) and a full-screen glare (`src/fx/landing-glare.js`); the grade applied to the story beats' foundry state; the first-start flag in `src/storage.js`'s store. The spec is `docs/superpowers/specs/2026-11-07-landing-mini-game-design.md`.

**Tech Stack:** vanilla ES modules, three.js r160 vendored under `vendor/`, node's `assert` for tests (`npm test` runs every `test/*.mjs`), the browser harness `scripts/browser-test.mjs` through `scripts/browser-lock.sh`.

## Global Constraints

- Pure modules in `src/domain` and `src/content` import nothing from `src/fx`, `src/platform` or three.js, and `src/domain` never imports `src/content` (the architecture guard rejects it): every domain function takes the tune as a REQUIRED argument (`tune`), and hosts and tests pass `LANDING_GAME` in. `npm run architecture` enforces it. Hosts in `src/fx`.
- `src/td-tab.js` is 5,340 lines under a 5,450 ceiling with a long-line budget of 0: no line over 500 characters, and at most the three one-line additions this plan names.
- Every number tunable lives in `LANDING_GAME` (`src/content/landing-game.js`), frozen, with its rationale beside it. Nothing tunable in logic.
- Metres around the landing island as `src/domain/landing-sequence.js` measures them: x and z along the ground, y up, +z toward the pole. The host converts with the arrival's `toWorld`.
- No new audio files: the alarm is `danger_alert`, the crash `mech_landing_impact`, the ping `laser_click`, the thrust bed `rocket_thrust` (all in `src/content/audio-defaults.js` / `STORY_SOUNDS`).
- No colored emoji, monochrome HUD vocabulary; captions for Isao's lines until recorded.
- Commit after every task as Kai Denrei with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never push.
- Browser suites only through `scripts/browser-lock.sh`, never while another run serves the same tree; never edit `src` while a suite serves the tree.
- Work in the worktree `~/Dev/stalheart-landing` on branch `landing-game` from `overnight-2026-10-23` at 44022fbc.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/content/landing-game.js` (create) | `LANDING_GAME`: sim, vehicle, entry, flare, verdict, pad, approach, camera, reticle, hud, skip, salvage, lines |
| `src/domain/manual-landing.js` (create) | `seedEntry`, `createLanding`, `step`, `hStop`, `predictImpact`, `verdict`, `flareDue`, `flareStep`, `overrideSeed` |
| `src/content/story-defaults.js` (modify) | `STORY_ARRIVAL_MANUAL`: the arrival tune for the flown landing (a longer approach, its rail shifted) |
| `src/domain/story-beats.js` (modify) | `salvage({ sections, feedstockPerBarrel, bonus })` on the beats |
| `src/fx/manual-landing.js` (create) | the host: pose, plumes, chase camera, reticle, input, sounds, the phases' clock |
| `src/fx/landing-hud.js` (create) | the panel: tapes, needles, annunciator, verdict, the skip offer |
| `src/fx/landing-glare.js` (create) | the override's full-screen plume glare (MIT launch shader on its own canvas) |
| `src/fx/arrival.js` (modify) | the phases cut into the clock, the offer, the grade to the beats and the talk, `landing(cmd, arg)` for the harness |
| `src/platform/story-world.js` (modify) | `manual` / `offer` decided from the flag, the store and the query |
| `src/isaobriefs.js` (modify) | `override`, `arrival_talk_clean`, `arrival_talk_wreck` |
| `src/td-tab.js` (modify, 3 lines) | the harness hook `landing`, the live-shot list, the skip card's skip |
| `src/labs/story-tab.js`, `src/labs/story-landing.js` (modify) | `?manual=1`: the manual window in the story lab with the keys |
| `styles.css` (modify) | `#landing-hud`, `#landing-glare`, the touch rail |
| `test/manual-landing.mjs`, `test/landing-game.mjs`, `test/story-beats-salvage.mjs` (create) | the rules |
| `scripts/browser-test.mjs` (modify) | `--landing` |

---

### Task 1: The tune and the flight model (step, fuel, spool)

**Files:**
- Create: `src/content/landing-game.js`
- Create: `src/domain/manual-landing.js`
- Test: `test/manual-landing.mjs`, `test/landing-game.mjs`

**Interfaces:**
- Produces: `LANDING_GAME` (frozen literal); `createLanding(entry)` → state `{ x, y, z, vx, vy, vz, tilt, tiltRate, throttle, set, fuel, legs, legsDown, t, phase }`; `step(state, input, dt, tune)` → the same object mutated and returned; `input = { throttle: 0..1 | null, tiltRate: -1..1, legs: boolean }`.

- [ ] **Step 1: Write the failing tests**

`test/landing-game.mjs`:
```js
// landing-game.mjs — the tune's shape: every grade's salvage is a foundry configuration the beats can take
import assert from 'node:assert/strict';
import { LANDING_GAME } from '../src/content/landing-game.js';
import { FOUNDRY_TUNE } from '../src/content/foundry.js';

assert.ok(Object.isFrozen(LANDING_GAME), 'the tune is frozen');
for (const grade of ['CLEAN', 'HARD', 'WRECK']) {
  const s = LANDING_GAME.salvage[grade];
  assert.ok(s, `salvage for ${grade}`);
  assert.ok(s.sections >= 1 && s.sections <= FOUNDRY_TUNE.sections.length, `${grade}: sections within the foundry's`);
  assert.ok(s.feedstockPerBarrel > 0 && s.bonus >= 0, `${grade}: a barrel's worth and a bonus count`);
}
assert.ok(LANDING_GAME.vehicle.thrust > LANDING_GAME.sim.gravity, 'full thrust beats gravity (a hoverslam is possible)');
assert.ok(LANDING_GAME.vehicle.minThrottle * LANDING_GAME.vehicle.thrust < LANDING_GAME.sim.gravity, 'idle thrust does not hover (the brief: the rocket cannot hover)');
assert.ok(LANDING_GAME.flare.altitude > 0 && LANDING_GAME.flare.sink > LANDING_GAME.verdict.clean.sink, 'the flare corridor is wider than CLEAN');
console.log('landing-game: ok');
```

`test/manual-landing.mjs` (the first block; later tasks append):
```js
// manual-landing.mjs — the flight model is pure, fixed-step and deterministic
import assert from 'node:assert/strict';
import { LANDING_GAME } from '../src/content/landing-game.js';
import { createLanding, step, seedEntry } from '../src/domain/manual-landing.js';

const T = LANDING_GAME, DT = T.sim.dt;
const entry = { altitude: 350, sink: 35, drift: 10, tilt: 0.3, fuelSeconds: 20, wind: 0 };

{ // the throttle follows its set point at the spool rate and burns fuel only when thrusting
  const s = createLanding(entry);
  assert.equal(s.throttle, 0); assert.equal(s.fuel, 20);
  step(s, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.ok(Math.abs(s.throttle - T.vehicle.spool * DT) < 1e-9, 'one step of spool');
  const fuel0 = s.fuel;
  for (let i = 0; i < 120; i++) step(s, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.equal(s.throttle, 1, 'spooled to full within a second');
  assert.ok(s.fuel < fuel0, 'fuel burns'); assert.ok(s.fuel > fuel0 - 1.01, 'a second of full burn costs a second of fuel at most');
  const s2 = createLanding(entry); for (let i = 0; i < 120; i++) step(s2, { throttle: 0, tiltRate: 0, legs: false }, DT, T);
  assert.equal(s2.fuel, 20, 'no burn, no fuel spent');
}
{ // gravity pulls, thrust along the axis pushes; no fuel, no thrust
  const s = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0 });
  step(s, { throttle: 0, tiltRate: 0, legs: false }, DT, T);
  assert.ok(s.vy < 0, 'falls');
  const f = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0, fuelSeconds: 0 }); f.throttle = 1;
  step(f, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.equal(f.throttle, 0, 'dry: the throttle reads zero'); assert.ok(f.vy < 0, 'dry: falls');
}
{ // the tilt aims the thrust: forward tilt pushes +z, back tilt -z
  const s = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0.3 }); s.throttle = 1; s.fuel = 10;
  step(s, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.ok(s.vz > 0, 'tilted forward, pushed forward');
  const b = createLanding({ ...entry, sink: 0, drift: 0, tilt: -0.3 }); b.throttle = 1; b.fuel = 10;
  step(b, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.ok(b.vz < 0, 'tilted back, pushed back');
}
{ // deterministic: one timeline, one outcome; and the seeded entry is a pure function of its seed
  const run = () => { const s = createLanding(entry); for (let i = 0; i < 600; i++) step(s, { throttle: i > 200 ? 1 : 0.3, tiltRate: i % 7 === 0 ? 1 : 0, legs: i > 100 }, DT, T); return JSON.stringify(s); };
  assert.equal(run(), run());
  assert.deepEqual(seedEntry('planet-7', T), seedEntry('planet-7', T));
  const e = seedEntry('planet-7', T);
  assert.ok(e.altitude >= T.entry.altitude[0] && e.altitude <= T.entry.altitude[1]); assert.ok(e.sink >= T.entry.sink[0] && e.sink <= T.entry.sink[1]);
  assert.ok(Math.abs(e.drift) >= T.entry.drift[0] && Math.abs(e.drift) <= T.entry.drift[1]); assert.ok(Math.abs(e.tilt) >= T.entry.tilt[0] && Math.abs(e.tilt) <= T.entry.tilt[1]);
  assert.ok(e.fuelSeconds >= T.entry.fuelSeconds[0] && e.fuelSeconds <= T.entry.fuelSeconds[1]);
  assert.notDeepEqual(seedEntry('planet-7', T), seedEntry('planet-8', T), 'another seed, another problem');
}
{ // the legs deploy over legTime once asked, and stay down
  const s = createLanding(entry);
  for (let i = 0; i < 12; i++) step(s, { throttle: 0, tiltRate: 0, legs: true }, DT, T);
  assert.ok(s.legs > 0 && s.legs < 1, 'deploying'); assert.equal(s.legsDown, false);
  for (let i = 0; i < 200; i++) step(s, { throttle: 0, tiltRate: 0, legs: false }, DT, T);
  assert.equal(s.legs, 1); assert.equal(s.legsDown, true, 'down, and a later false does not retract them');
}
console.log('manual-landing: step ok');
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node test/landing-game.mjs; node test/manual-landing.mjs`
Expected: both fail with `Cannot find module '.../src/content/landing-game.js'`.

- [ ] **Step 3: Write the tune**

`src/content/landing-game.js`:
```js
// THE LANDING, the manual override in the arrival (owner, 2026-11-07; spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md).
// One frozen literal; every number a starting value with its reason, the story lab (labs.html#story&manual=1) is where they move.
// Metres and seconds around the landing island (x, z along the ground, y up, +z toward the pole), as src/domain/landing-sequence.js.
export const LANDING_GAME = Object.freeze({
  sim: Object.freeze({ dt: 1 / 120, maxSteps: 8, gravity: 3.2, drag: 0.0016 }),   // the 2D game's planet: fixed 120 Hz, a thin atmosphere
  vehicle: Object.freeze({
    thrust: 12,          // m/s² at full throttle (T/W 3.75: a late, hard burn stops the rocket; the brief's hoverslam)
    minThrottle: 0.2,    // the set point's floor while lit (0.2 x 12 = 2.4 < g: idle cannot hover, so a hover costs real fuel)
    spool: 4,            // throttle units a second toward the set point
    torque: 3,           // rad/s² at full stick
    damping: 3.5,        // the tilt rate's decay a second
    legTime: 0.6,        // s to deploy the legs
    legDrag: 0.0009,     // extra quadratic drag with the legs down (the 2D game's number)
    autoLegsAltitude: 200,   // m: the legs come down here on their own if the player has not asked
  }),
  // the problem the override hands over: seeded per planet within these ranges (src/domain/manual-landing.js seedEntry)
  entry: Object.freeze({ altitude: [300, 400], sink: [30, 40], drift: [8, 12], tilt: [0.25, 0.35], fuelSeconds: [18, 22], wind: 0 }),
  // the auto-lander takes back under this height when the state is inside its corridor (spec 2.4)
  flare: Object.freeze({ altitude: 30, sink: 8, drift: 5, tilt: 0.25, sinkFinal: 1.8, settle: 2.5 }),   // settle: s to kill drift and tilt
  // the 2D game's grades: the worst axis decides; drift in m/s on the ground, tilt in radians (4° and 11°)
  verdict: Object.freeze({
    clean: Object.freeze({ sink: 2.5, drift: 1.5, tilt: 0.0698 }),
    hard: Object.freeze({ sink: 6, drift: 4, tilt: 0.192 }),
    slope: 0.157,   // rad (9°): steeper ground under a foot is a wreck
  }),
  pad: Object.freeze({ reach: 14 }),   // m from the island's centre a foot may land and still be on the pad (the landing island is 16 x 16)
  // the arrival's clock around the window: the approach is the arrival's own sequence from higher, the override at `overrideAt` s of it
  approach: Object.freeze({ descent: 7, startAltitude: 900, overrideAt: 4.2, deployAltitude: 700 }),
  override: Object.freeze({ seconds: 3, glare: Object.freeze({ seconds: 2.4, dim: 1000, peak: 8 }), offerSeconds: 3 }),   // the alarm beat; the glare's length and its exposure (the shader divides by it: dim is the quad plume's default, peak the height); the SPACE offer on a later start
  camera: Object.freeze({ back: 60, up: 34, ahead: 18, down: 10, fov: 46, lag: 0.12, jolt: 0.8 }),   // the chase: behind along -z, above, looking ahead and down
  reticle: Object.freeze({ metresPerMetre: 0.1, rings: Object.freeze([100, 50, 10]), square: 10, segments: 48 }),
  hud: Object.freeze({ audibleThrottle: 0.05, ping: Object.freeze({ far: 1.2, near: 0.15, nearAt: 10 }), predictorSeconds: 35, predictorDt: 0.15 }),
  input: Object.freeze({ step: 0.1, skipKey: 'Escape', offerKey: ' ' }),
  salvage: Object.freeze({   // what the foundry cuts after each grade (spec 6): sections of the SH02, a barrel's biomass, extra barrels at deploy
    CLEAN: Object.freeze({ sections: 3, feedstockPerBarrel: 60, bonus: 1 }),
    HARD: Object.freeze({ sections: 3, feedstockPerBarrel: 60, bonus: 0 }),
    WRECK: Object.freeze({ sections: 2, feedstockPerBarrel: 48, bonus: 0 }),
  }),
  lines: Object.freeze({ override: 'override', CLEAN: 'arrival_talk_clean', HARD: 'arrival_talk', WRECK: 'arrival_talk_wreck' }),
});
```

- [ ] **Step 4: Write the flight model**

`src/domain/manual-landing.js`:
```js
// THE LANDING'S FLIGHT MODEL (owner, 2026-11-07; spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md, section 3). Pure,
// fixed-step, deterministic: the same entry and input timeline give the same state. Ported from the owner's 2D game
// (Stalsfar_Landing/landing/lander.js flightStep, evaluateTouchdown, predictImpact) onto the arrival's metres: x and z along the
// ground, y up (the pad at 0), +z toward the pole; the tilt is about x, positive forward (+z); the rocket cannot hover at idle.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, u) => a + (b - a) * u;

// a small seeded generator (mulberry32 over a string hash), so a planet's entry is its own and repeatable
function rng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, [lo, hi]) => lerp(lo, hi, r());

// the problem the override hands over, from this planet's seed
export function seedEntry(seed, tune) {
  const r = rng(seed), e = tune.entry;
  return { altitude: pick(r, e.altitude), sink: pick(r, e.sink), drift: pick(r, e.drift) * (r() < 0.5 ? -1 : 1), tilt: pick(r, e.tilt) * (r() < 0.5 ? -1 : 1), fuelSeconds: pick(r, e.fuelSeconds), wind: e.wind };
}

export function createLanding(entry) {
  return { x: 0, y: entry.altitude, z: 0, vx: 0, vy: -entry.sink, vz: entry.drift, tilt: entry.tilt, tiltRate: 0, throttle: 0, set: 0, fuel: entry.fuelSeconds, legs: 0, legsDown: false, wind: entry.wind ?? 0, t: 0, phase: 'manual' };
}

// the state at the override, from the sequence's altitude and rate at that instant plus the entry's drift and tilt (spec 2.2)
export function overrideSeed(altitude, rate, entry) {
  return createLanding({ ...entry, altitude, sink: Math.max(0, -rate) });
}

// one fixed step. input: { throttle: the set point 0..1 (null keeps it), tiltRate: -1..1 (back..forward), legs: true asks for the legs }
export function step(s, input, dt, tune) {
  const v = tune.vehicle, g = tune.sim.gravity;
  if (input.throttle != null) s.set = clamp(input.throttle, 0, 1);
  s.throttle += clamp(s.set - s.throttle, -v.spool * dt, v.spool * dt);
  if (s.fuel <= 0) { s.throttle = 0; s.set = 0; }
  const lit = s.throttle > 0 ? Math.max(v.minThrottle, s.throttle) : 0;
  s.tiltRate += (clamp(input.tiltRate ?? 0, -1, 1) * v.torque - s.tiltRate * v.damping) * dt;
  s.tilt += s.tiltRate * dt;
  const drag = tune.sim.drag + (s.legs >= 1 ? v.legDrag : 0), T = v.thrust * lit;
  s.vz += (Math.sin(s.tilt) * T - drag * s.vz * Math.abs(s.vz)) * dt;
  s.vx += (s.wind - drag * s.vx * Math.abs(s.vx)) * dt;
  s.vy += (Math.cos(s.tilt) * T - g - drag * s.vy * Math.abs(s.vy)) * dt;
  s.fuel = Math.max(0, s.fuel - lit * dt);
  if (input.legs || s.legs > 0 || (s.y <= v.autoLegsAltitude)) s.legs = Math.min(1, s.legs + dt / v.legTime);
  s.legsDown = s.legs >= 1;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.t += dt;
  return s;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node test/landing-game.mjs; node test/manual-landing.mjs`
Expected: `landing-game: ok` and `manual-landing: step ok`. Then `npm run architecture` (the new modules are in the pure layers and import nothing impure): expected `Architecture: ... hold.`

- [ ] **Step 6: Commit**

```bash
git add src/content/landing-game.js src/domain/manual-landing.js test/landing-game.mjs test/manual-landing.mjs
git commit -m "The landing's tune and flight model: a seeded entry, a fixed-step throttle, tilt and fuel clock ported from the owner's 2D lander (test-first)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The stopping distance, the predictor, the verdict and the flare

**Files:**
- Modify: `src/domain/manual-landing.js`
- Modify: `src/content/landing-game.js` (add `vehicle.legDrag: 0.0009` with its rationale; Task 1's review found the number hardcoded in `step`: read it from the tune)
- Test: `test/manual-landing.mjs` (append)

**Interfaces:**
- Produces (every one takes `tune` as a required last argument): `hStop(state, tune)` → metres; `predictImpact(state, tune, groundY = 0)` → `{ x, z, t, reached }`; `verdict(state, slope, offPad, tune)` → `{ grade: 'CLEAN'|'HARD'|'WRECK', reason: 'sink'|'drift'|'tilt'|'legs'|'slope'|'off-pad', sink, drift, tilt }`; `flareDue(state, tune)` → boolean; `flareStep(state, dt, tune)` → state (the auto-lander's step, replaces `step` once due); `touched(state)` → boolean (`y <= 0`).

- [ ] **Step 1: Append the failing tests**

```js
import { hStop, predictImpact, verdict, flareDue, flareStep, touched } from '../src/domain/manual-landing.js';
{ // the stopping distance is v² / 2(T - g) at full thrust
  const s = createLanding({ ...entry, sink: 30, drift: 0, tilt: 0 });
  assert.ok(Math.abs(hStop(s, T) - 30 * 30 / (2 * (T.vehicle.thrust - T.sim.gravity))) < 1e-9);
  // and a full burn started at exactly that height stops within a few metres of the ground (the integrator against the formula)
  const f = createLanding({ ...entry, sink: 30, drift: 0, tilt: 0, fuelSeconds: 60 }); f.y = hStop(f, T) + 6; f.throttle = 1; f.set = 1;   // +6: the spool is not instant
  let lowest = f.y; for (let i = 0; i < 2400 && f.vy < 0; i++) { step(f, { throttle: 1, tiltRate: 0, legs: true }, DT, T); lowest = Math.min(lowest, f.y); }
  assert.ok(lowest > 0 && lowest < 12, `stops above the ground and near it (${lowest.toFixed(1)} m)`);
}
{ // the predictor lands where the integrator lands, at the current throttle
  const s = createLanding({ ...entry, sink: 20, drift: 6, tilt: 0 });
  const p = predictImpact(s, T);
  const q = createLanding({ ...entry, sink: 20, drift: 6, tilt: 0 }); let t = 0; while (q.y > 0 && t < 60) { step(q, { throttle: 0, tiltRate: 0, legs: false }, DT, T); t += DT; }
  assert.ok(p.reached); assert.ok(Math.abs(p.z - q.z) < 2, `predicted z ${p.z.toFixed(1)} against flown ${q.z.toFixed(1)}`); assert.ok(Math.abs(p.t - t) < 0.3);
  const high = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0 }); high.y = 1e6;
  assert.equal(predictImpact(high, T).reached, false, "beyond the predictor's horizon: not reached");
}
{ // the verdict: the worst axis names the reason; legs up, a slope or off the pad are wrecks whatever the speeds
  const base = { ...createLanding(entry), vy: -1, vx: 0, vz: 0.5, tilt: 0.02, legs: 1, legsDown: true };
  assert.deepEqual(verdict({ ...base }, 0, false, T).grade, 'CLEAN');
  assert.deepEqual([verdict({ ...base, vy: -4 }, 0, false, T).grade, verdict({ ...base, vy: -4 }, 0, false, T).reason], ['HARD', 'sink']);
  assert.deepEqual([verdict({ ...base, vz: 5 }, 0, false, T).grade, verdict({ ...base, vz: 5 }, 0, false, T).reason], ['WRECK', 'drift']);
  assert.deepEqual([verdict({ ...base, tilt: 0.1 }, 0, false, T).grade, verdict({ ...base, tilt: 0.1 }, 0, false, T).reason], ['HARD', 'tilt']);
  assert.deepEqual([verdict({ ...base, legs: 0.4, legsDown: false }, 0, false, T).grade, verdict({ ...base, legs: 0.4, legsDown: false }, 0, false, T).reason], ['WRECK', 'legs']);
  assert.deepEqual(verdict({ ...base }, 0.2, false, T).reason, 'slope'); assert.deepEqual(verdict({ ...base }, 0, true, T).reason, 'off-pad');
  const v = verdict({ ...base, vy: -3.3, vz: -2.2, tilt: 0.05 }, 0, false, T);
  assert.equal(v.sink, 3.3); assert.equal(v.drift, 2.2); assert.ok(Math.abs(v.tilt - 0.05) < 1e-12, 'the readings are reported as flown');
}
{ // the flare: due below its altitude inside its corridor, never above it or outside; and it settles the rocket to the ground
  const s = { ...createLanding(entry), y: 25, vy: -5, vz: 2, tilt: 0.1 };
  assert.equal(flareDue(s, T), true); assert.equal(flareDue({ ...s, y: 40 }, T), false); assert.equal(flareDue({ ...s, vy: -9 }, T), false); assert.equal(flareDue({ ...s, vz: 6 }, T), false); assert.equal(flareDue({ ...s, tilt: 0.3 }, T), false);
  let f = { ...s }; for (let i = 0; i < 3000 && !touched(f); i++) flareStep(f, DT, T);
  assert.ok(touched(f), 'lands'); assert.ok(Math.abs(f.vy) <= T.flare.sinkFinal + 0.05, `settles at the final sink (${f.vy.toFixed(2)})`);
  assert.ok(Math.abs(f.vz) < 0.2 && Math.abs(f.tilt) < 0.02 && f.legsDown, 'drift and tilt killed, legs down');
  assert.equal(verdict(f, 0, false, T).grade, 'CLEAN', 'the auto-lander never crashes');
}
console.log('manual-landing: rules ok');
```

- [ ] **Step 2: Run to see them fail**

Run: `node test/manual-landing.mjs`
Expected: fails at the import, `does not provide an export named 'hStop'`.

- [ ] **Step 3: Implement**

Append to `src/domain/manual-landing.js`:
```js
// the height a full burn needs to stop the present sink: v² / 2(T − g), recomputed each frame (the brief; mass is not simulated)
export function hStop(s, tune) {
  const v = Math.max(0, -s.vy), a = tune.vehicle.thrust - tune.sim.gravity;
  return a > 0 ? v * v / (2 * a) : Infinity;
}

// where the rocket meets the ground if the throttle stays where it is: the reticle's centre and the ping's clock
export function predictImpact(s, tune, groundY = 0) {
  const p = { ...s }, dt = tune.hud.predictorDt, hold = { throttle: null, tiltRate: 0, legs: false };
  for (let t = 0; t < tune.hud.predictorSeconds; t += dt) {
    step(p, hold, dt, tune);
    if (p.y <= groundY) return { x: p.x, z: p.z, t: t + dt, reached: true };
  }
  return { x: p.x, z: p.z, t: tune.hud.predictorSeconds, reached: false };
}

export const touched = (s) => s.y <= 0;

// the grade at first contact (spec 3): the worst axis decides and names the reason; legs up, a slope or off the pad are wrecks
export function verdict(s, slope, offPad, tune) {
  const sink = Math.max(0, -s.vy), drift = Math.hypot(s.vx, s.vz), tilt = Math.abs(s.tilt), V = tune.verdict;
  const axes = [['sink', sink, V.clean.sink, V.hard.sink], ['drift', drift, V.clean.drift, V.hard.drift], ['tilt', tilt, V.clean.tilt, V.hard.tilt]];
  let worst = 0, reason = 'sink', ratio = -1;
  for (const [name, value, clean, hard] of axes) {
    const grade = value > hard ? 2 : value > clean ? 1 : 0, r = value / hard;
    if (grade > worst || (grade === worst && r > ratio)) { worst = grade; reason = name; ratio = r; }
  }
  if (!s.legsDown) { worst = 2; reason = 'legs'; }
  else if (slope > tune.verdict.slope) { worst = 2; reason = 'slope'; }
  else if (offPad) { worst = 2; reason = 'off-pad'; }
  return { grade: ['CLEAN', 'HARD', 'WRECK'][worst], reason, sink, drift, tilt };
}

// the auto-lander takes back under flare.altitude when the state is inside its corridor (spec 2.4)
export function flareDue(s, tune) {
  const f = tune.flare;
  return s.y <= f.altitude && -s.vy <= f.sink && Math.hypot(s.vx, s.vz) <= f.drift && Math.abs(s.tilt) <= f.tilt;
}

// the auto-lander's step: the tilt and the drift eased out over flare.settle, the sink eased to sinkFinal, the legs down, no fuel spent
export function flareStep(s, dt, tune) {
  const f = tune.flare, k = Math.min(1, dt / f.settle * 3);
  s.tilt += (0 - s.tilt) * k; s.tiltRate = 0;
  s.vx += (0 - s.vx) * k; s.vz += (0 - s.vz) * k;
  s.vy += (-f.sinkFinal - s.vy) * k;
  s.legs = Math.min(1, s.legs + dt / tune.vehicle.legTime); s.legsDown = s.legs >= 1;
  s.throttle = s.set = Math.min(1, tune.sim.gravity / tune.vehicle.thrust + 0.05);   // the plume at a hover's worth, for the picture
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.t += dt; s.phase = 'flare';
  return s;
}
```

- [ ] **Step 4: Run to see them pass**

Run: `node test/manual-landing.mjs` → `manual-landing: rules ok`. Then `npm test` → every program passes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/manual-landing.js test/manual-landing.mjs
git commit -m "The landing's rules: the stopping distance, the predictor, the verdict that names its reason, and the auto-lander's flare (test-first)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The grade into the foundry (the beats' salvage) and the arrival tune

**Files:**
- Modify: `src/domain/story-beats.js:40-50` (the foundry state), `:95` (the barrel's grant), `:165-170` (deploy)
- Modify: `src/content/story-defaults.js` (after `STORY_ARRIVAL`)
- Test: `test/story-beats-salvage.mjs`, `test/landing-game.mjs` (append)

**Interfaces:**
- Produces: `beats.salvage({ sections, feedstockPerBarrel, bonus })` (before `deploy`; the arrival calls it with `LANDING_GAME.salvage[grade]`); `STORY_ARRIVAL_MANUAL` (the arrival tune when the landing is flown: `landing.descent` = `LANDING_GAME.approach.descent`, `startAltitude`, `deployAltitude` from the approach, every rail key at or after the old touchdown shifted by the descent's difference).

- [ ] **Step 1: Write the failing tests**

`test/story-beats-salvage.mjs`:
```js
// story-beats-salvage.mjs — the landing's grade sets what the AFR-01 cuts: the sections, a barrel's worth, the bonus at deploy
import assert from 'node:assert/strict';
import { makeStoryBeats } from '../src/domain/story-beats.js';
import { FOUNDRY_TUNE } from '../src/content/foundry.js';

function beatsWith(salvage) {
  const grants = [], events = [];
  const b = makeStoryBeats({ foundry: FOUNDRY_TUNE, arrival: true });
  const api = { grant: (n) => grants.push(n), foundry: (ev, d) => events.push([ev, d]), brief() {}, order: () => true, cost: () => 60, built: () => false };
  if (salvage) b.salvage(salvage);
  return { b, api, grants, events };
}
{ // no grade: the foundry as tuned
  const { b, api, grants } = beatsWith(null);
  b.land?.(api); b.deploy(api);
  assert.deepEqual(grants, [], 'no bonus barrel without a grade');
  assert.equal(b.state().foundry.sections.length, FOUNDRY_TUNE.sections.length);
}
{ // a wreck: two sections, a smaller barrel
  const { b, api, grants } = beatsWith({ sections: 2, feedstockPerBarrel: 48, bonus: 0 });
  b.land?.(api); b.deploy(api);
  assert.equal(b.state().foundry.sections.length, 2, 'the tank section is not there to cut');
  for (let i = 0; i < 400; i++) b.tick(0.1, api);
  assert.ok(grants.length >= 1 && grants.every((g) => g === 48), `every barrel is 48 (${grants})`);
}
{ // a clean landing: the bonus barrel at deploy, the rest as tuned
  const { b, api, grants } = beatsWith({ sections: 3, feedstockPerBarrel: 60, bonus: 1 });
  b.land?.(api); b.deploy(api);
  assert.deepEqual(grants, [60], 'one bonus barrel on the deploy');
}
console.log('story-beats-salvage: ok');
```

Append to `test/landing-game.mjs`:
```js
import { STORY_ARRIVAL, STORY_ARRIVAL_MANUAL } from '../src/content/story-defaults.js';
assert.equal(STORY_ARRIVAL_MANUAL.landing.descent, LANDING_GAME.approach.descent);
assert.equal(STORY_ARRIVAL_MANUAL.landing.startAltitude, LANDING_GAME.approach.startAltitude);
const shift = LANDING_GAME.approach.descent - STORY_ARRIVAL.landing.descent;
const oldDown = STORY_ARRIVAL.landing.orbit + STORY_ARRIVAL.landing.descent;
for (const k of STORY_ARRIVAL.rail) { const m = STORY_ARRIVAL_MANUAL.rail.find((x) => x.pos === k.pos); assert.ok(m); assert.equal(m.t, k.t >= oldDown ? k.t + shift : k.t, 'rail keys after the touchdown move with it'); }
assert.ok(LANDING_GAME.approach.overrideAt < STORY_ARRIVAL_MANUAL.landing.descent, 'the override comes before the sequence would have touched down');
console.log('landing-game: arrival tune ok');
```

Note: `makeStoryBeats` needs a way to reach `landed` without the whole opening. Read `src/domain/story-beats.js:40-100` first: if the phase before `deploy` is reached only through ticks and events, drive it in the test the same way the existing `test/story-beats.mjs` does (copy its set-up; the `b.land?.(api)` call above is a placeholder for that set-up and must be replaced by the real path). Keep the three assertions.

- [ ] **Step 2: Run to see them fail**

Run: `node test/story-beats-salvage.mjs; node test/landing-game.mjs`
Expected: `b.salvage is not a function`; `does not provide an export named 'STORY_ARRIVAL_MANUAL'`.

- [ ] **Step 3: Implement the beats' salvage**

In `src/domain/story-beats.js`, next to `const fd = foundry ? makeFoundry(foundry) : null;` (line 45):
```js
  // THE LANDING'S GRADE (spec 2026-11-07-landing-mini-game-design.md section 6): what the AFR-01 has to cut after the way the rocket came
  // down: the sections left, a barrel's worth, and bonus barrels granted at the deploy. Set by the arrival before its deploy(api); unset, the tune's
  let perBarrel = foundry?.feedstockPerBarrel ?? 0, bonusBarrels = 0;
```
At the barrel's grant (line 95) replace `api.grant(foundry.feedstockPerBarrel)` with `api.grant(perBarrel)`.
In `deploy(api)` after `if (fd) { api.foundry?.(deployFoundry(fd), null); enter('foundry'); }` add `for (let i = 0; i < bonusBarrels; i++) api.grant(perBarrel);`.
Add to the returned object:
```js
    salvage({ sections, feedstockPerBarrel, bonus }) {
      if (!fd || released) return false;
      fd.sections = fd.sections.slice(0, Math.max(1, sections)); perBarrel = feedstockPerBarrel; bonusBarrels = bonus;
      return true;
    },
```

- [ ] **Step 4: Implement the arrival tune**

In `src/content/story-defaults.js` after `STORY_ARRIVAL`:
```js
// THE FLOWN ARRIVAL (owner, 2026-11-07; src/content/landing-game.js, src/fx/arrival.js): the same sequence from higher and slower, so the
// override has room; every rail key at or after the old touchdown moves with the new one, the keys before it keep their place
import { LANDING_GAME } from './landing-game.js';
export const STORY_ARRIVAL_MANUAL = (() => {
  const a = LANDING_GAME.approach, base = STORY_ARRIVAL.landing, down = base.orbit + base.descent, shift = a.descent - base.descent;
  return Object.freeze({ ...STORY_ARRIVAL,
    landing: Object.freeze({ ...base, descent: a.descent, startAltitude: a.startAltitude, deployAltitude: a.deployAltitude }),
    rail: Object.freeze(STORY_ARRIVAL.rail.map((k) => Object.freeze({ ...k, t: k.t >= down ? k.t + shift : k.t }))),
  });
})();
```
(`import` lines belong at the top of the file with the others; place it there.) Check `src/content/landing-game.js` does not import `story-defaults.js` back (it does not).

- [ ] **Step 5: Run to see them pass**

Run: `node test/story-beats-salvage.mjs; node test/landing-game.mjs; npm test; npm run architecture`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/domain/story-beats.js src/content/story-defaults.js test/story-beats-salvage.mjs test/landing-game.mjs
git commit -m "The landing's grade reaches the foundry (the beats' salvage: sections, a barrel's worth, bonus barrels) and the flown arrival's tune (test-first)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Isao's lines, the first-start flag and the story world's switch

**Files:**
- Modify: `src/isaobriefs.js:118-121`
- Modify: `src/platform/story-world.js:171-195`
- Modify: `src/fx/arrival.js:40-48` (the options)
- Test: `test/landing-game.mjs` (append), `test/story-world.mjs` if it exists (read it; else `test/landing-switch.mjs`)

**Interfaces:**
- Produces: `BRIEFS.override`, `BRIEFS.arrival_talk_clean`, `BRIEFS.arrival_talk_wreck`; `createArrival({ ..., manual = false, offer = false, seed = 'planet' })`; `decideLanding({ arrives, query, flown, acceptance })` → `{ manual, offer }` exported from `src/platform/story-world.js` (pure: no DOM).

- [ ] **Step 1: Write the failing tests**

Append to `test/landing-game.mjs`:
```js
import { BRIEFS } from '../src/isaobriefs.js';
for (const id of Object.values(LANDING_GAME.lines)) assert.ok(BRIEFS[id]?.lines?.length, `brief ${id} exists`);
assert.equal(BRIEFS.arrival_talk_clean.lines[0], 'Textbook landing!');
assert.equal(BRIEFS.arrival_talk_wreck.lines.length, 4, 'a wreck adds a fourth caption');
assert.equal(BRIEFS.arrival_talk_wreck.lines[3], "Less to cannibalize than I'd hoped.");
import { decideLanding } from '../src/platform/story-world.js';
const q = (s) => new URLSearchParams(s);
assert.deepEqual(decideLanding({ arrives: true, query: q(''), flown: false, acceptance: false }), { manual: true, offer: false }, 'the first start flies it');
assert.deepEqual(decideLanding({ arrives: true, query: q(''), flown: true, acceptance: false }), { manual: false, offer: true }, 'later starts are offered it');
assert.deepEqual(decideLanding({ arrives: true, query: q('landing=1'), flown: true, acceptance: true }), { manual: true, offer: false }, '?landing=1 forces it');
assert.deepEqual(decideLanding({ arrives: true, query: q('landing=0'), flown: false, acceptance: false }), { manual: false, offer: false }, '?landing=0 never');
assert.deepEqual(decideLanding({ arrives: true, query: q(''), flown: false, acceptance: true }), { manual: false, offer: false }, 'an acceptance run lands itself unless it asks');
assert.deepEqual(decideLanding({ arrives: false, query: q('landing=1'), flown: false, acceptance: false }), { manual: false, offer: false }, 'no arrival, no landing');
console.log('landing-game: lines and switch ok');
```
If importing `src/platform/story-world.js` in node fails on a DOM-only import, move `decideLanding` to `src/domain/landing-switch.js` (pure) and import it from both; adjust the test's import.

- [ ] **Step 2: Run to see it fail**

Run: `node test/landing-game.mjs` → `brief override exists` fails.

- [ ] **Step 3: Implement the lines**

In `src/isaobriefs.js` after `arrival_talk`:
```js
  override: {
    id: 'override', face: 'scan', title: 'COMMS · ISAO', dwell: [2.2],
    lines: ["Auto-lander's gone. You have the stick."],
  },
  arrival_talk_clean: {
    id: 'arrival_talk_clean', face: 'glee', faces: ['glee', 'glee', 'determined'], dwell: [1.0, 1.1, 2.6], title: 'COMMS · ISAO',
    lines: ['Textbook landing!', 'So much to build!', 'I\'ll cannibalize the rocket to get the terraforming started.'],
  },
  arrival_talk_wreck: {
    id: 'arrival_talk_wreck', face: 'angry', faces: ['angry', 'glee', 'determined', 'angry'], dwell: [1.0, 1.1, 2.6, 1.6], title: 'COMMS · ISAO',
    lines: ['Rough landing!', 'So much to build!', 'I\'ll cannibalize the rocket to get the terraforming started.', "Less to cannibalize than I'd hoped."],
  },
```
Check how `faces`/`dwell` are read (`lineDwell` in the same file) so a fourth line is dwelt and faced; add the voice list section the file's header points to, as captions.

- [ ] **Step 4: Implement the switch**

In `src/platform/story-world.js` (export, pure):
```js
// THE LANDING IS FLOWN ON A BROWSER'S FIRST START, OFFERED AFTER (owner, 2026-11-07, call 2; spec section 8): `flown` is the store's
// td.landing.flown; ?landing=1 forces the flight, ?landing=0 never; an acceptance run lands itself unless it asks
export function decideLanding({ arrives, query, flown, acceptance }) {
  if (!arrives) return { manual: false, offer: false };
  const q = query.get('landing');
  if (q === '0') return { manual: false, offer: false };
  if (q === '1') return { manual: true, offer: false };
  if (acceptance) return { manual: false, offer: false };
  return flown ? { manual: false, offer: true } : { manual: true, offer: false };
}
```
and where `createArrival` is called (line 194):
```js
    arrival: createArrival({ on: arrives, past: pastLanding, base, beats, site: ..., metres: 1 / planet.radius,
      ...decideLanding({ arrives, query: q, flown: storage.getItem('td.landing.flown') === '1', acceptance: q.get('acceptance') === '1' }), seed: `landing:${seed}` }),
```
(`storage` from `../storage.js`; `q` is the file's URLSearchParams, `seed` the world's seed variable: read lines 40-70 for their names.) In `src/fx/arrival.js` take `manual = false, offer = false, seed = 'planet'` in the options and keep them (Task 7 uses them); choose `tune = manual ? STORY_ARRIVAL_MANUAL : STORY_ARRIVAL` when the caller passes no tune.

- [ ] **Step 5: Run to see it pass**

Run: `node test/landing-game.mjs; npm test; npm run check`.

- [ ] **Step 6: Commit**

```bash
git add src/isaobriefs.js src/platform/story-world.js src/fx/arrival.js test/landing-game.mjs
git commit -m "Isao's override and graded arrival lines; the landing flown on a browser's first start and offered after (?landing=1/0, the store's td.landing.flown)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The HUD panel

**Files:**
- Create: `src/fx/landing-hud.js`
- Modify: `styles.css` (append after the `body.arrival-on` block at line 4742)
- Test: `test/landing-hud.mjs` (a jsdom-free DOM stub: the module must build with a `document` made of a minimal fake; read `test/mission-card.mjs` or any `test/*card*.mjs` for the house pattern and copy it)

**Interfaces:**
- Produces: `createLandingHud(root)` → `{ el, show(on), set(reading), annunciate(text, kind = 'info'|'alarm'|'ok'), verdict({ grade, reason, sink, drift, tilt }), offer(on, key), touch(on, handlers), dispose() }` with `reading = { altitude, sink, driftAlong, driftAcross, tilt, tw, hStop, fuel, legs, phase }`.

- [ ] **Step 1: Write the failing test**

```js
// landing-hud.mjs — the panel reads what the flight model says, in the HUD's words
import assert from 'node:assert/strict';
import { createLandingHud } from '../src/fx/landing-hud.js';
// a minimal document: elements with textContent, classList, children, querySelector by id
function fakeDoc() { /* copy the house pattern from test/*card*.mjs; it must support createElement, append, querySelector('#id'), classList, textContent, style, remove */ }
globalThis.document = fakeDoc();
const root = document.createElement('div');
const hud = createLandingHud(root);
hud.show(true); assert.ok(root.querySelector('#landing-hud'), 'the panel is in the root');
hud.set({ altitude: 123.4, sink: 7.6, driftAlong: 2.1, driftAcross: 0, tilt: 0.1, tw: 2.5, hStop: 40, fuel: 12.3, legs: 0, phase: 'manual' });
assert.equal(root.querySelector('#lh-alt').textContent, '123'); assert.equal(root.querySelector('#lh-sink').textContent, '7.6');
assert.equal(root.querySelector('#lh-fuel').textContent, '12'); assert.equal(root.querySelector('#lh-stop').textContent, '40');
assert.ok(root.querySelector('#lh-sink').classList.contains('hot'), 'a sink over HARD reads hot');
hud.annunciate('AUTO-LAND FAULT · MANUAL OVERRIDE', 'alarm'); assert.equal(root.querySelector('#lh-ann').textContent, 'AUTO-LAND FAULT · MANUAL OVERRIDE');
hud.verdict({ grade: 'HARD', reason: 'sink', sink: 4.2, drift: 1, tilt: 0.03 }); assert.ok(root.querySelector('#lh-verdict').textContent.includes('HARD') && root.querySelector('#lh-verdict').textContent.includes('SINK 4.2'));
hud.offer(true, 'SPACE'); assert.ok(root.querySelector('#lh-offer').textContent.includes('SPACE'));
hud.dispose(); assert.equal(root.querySelector('#landing-hud'), null);
console.log('landing-hud: ok');
```

- [ ] **Step 2: Run to see it fail** — `node test/landing-hud.mjs` → cannot find module.

- [ ] **Step 3: Implement**

`src/fx/landing-hud.js`:
```js
// THE LANDING'S INSTRUMENTS (spec 2026-11-07-landing-mini-game-design.md section 5): a dozen readable things in the HUD's monochrome
// vocabulary, six touchable ones on phones. Pointer-transparent but for the touch rail. Numbers are set, never animated by the DOM.
import { LANDING_GAME } from '../content/landing-game.js';

const ROWS = [['alt', 'ALT', 'm'], ['sink', 'SINK', 'm/s'], ['drift', 'DRIFT', 'm/s'], ['tilt', 'TILT', '°'], ['tw', 'T/W', ''], ['stop', 'CAN STOP IN', 'm'], ['fuel', 'FUEL', 's']];
export function createLandingHud(root, tune) {
  if (!root || typeof document === 'undefined') return { el: null, show() {}, set() {}, annunciate() {}, verdict() {}, offer() {}, touch() {}, dispose() {} };
  const el = document.createElement('div'); el.id = 'landing-hud'; el.setAttribute('aria-live', 'polite'); el.hidden = true;
  const ann = document.createElement('div'); ann.id = 'lh-ann'; ann.className = 'lh-ann'; el.append(ann);
  const grid = document.createElement('div'); grid.className = 'lh-grid';
  const cells = {};
  for (const [id, label, unit] of ROWS) {
    const k = document.createElement('span'); k.className = 'lh-k'; k.textContent = label;
    const v = document.createElement('b'); v.id = `lh-${id}`; v.className = 'lh-v'; v.textContent = '—';
    const u = document.createElement('span'); u.className = 'lh-u'; u.textContent = unit;
    grid.append(k, v, u); cells[id] = v;
  }
  el.append(grid);
  const legs = document.createElement('div'); legs.id = 'lh-legs'; legs.className = 'lh-legs'; legs.textContent = 'LEGS UP'; el.append(legs);
  const verdictEl = document.createElement('div'); verdictEl.id = 'lh-verdict'; verdictEl.className = 'lh-verdict'; el.append(verdictEl);
  const offerEl = document.createElement('div'); offerEl.id = 'lh-offer'; offerEl.className = 'lh-offer'; offerEl.hidden = true; el.append(offerEl);
  const rail = document.createElement('div'); rail.id = 'lh-touch'; rail.className = 'lh-touch'; rail.hidden = true; el.append(rail);
  root.append(el);
  const num = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  const hot = (node, on) => node.classList.toggle('hot', !!on);
  return {
    el,
    show(on) { el.hidden = !on; },
    set(r) {
      cells.alt.textContent = num(r.altitude); cells.sink.textContent = num(r.sink, 1); hot(cells.sink, r.sink > tune.verdict.hard.sink);
      const drift = Math.hypot(r.driftAlong, r.driftAcross); cells.drift.textContent = `${r.driftAlong < 0 ? '←' : '→'} ${num(drift, 1)}`; hot(cells.drift, drift > tune.verdict.hard.drift);
      cells.tilt.textContent = num(r.tilt * 180 / Math.PI, 1); hot(cells.tilt, Math.abs(r.tilt) > tune.verdict.hard.tilt);
      cells.tw.textContent = num(r.tw, 2); cells.stop.textContent = num(r.hStop); hot(cells.stop, r.hStop > r.altitude);
      cells.fuel.textContent = num(r.fuel); hot(cells.fuel, r.fuel < r.hStop / Math.max(1, r.sink));
      legs.textContent = r.legs >= 1 ? 'LEGS DOWN' : r.legs > 0 ? `LEGS ${Math.round(r.legs * 100)}%` : 'LEGS UP'; legs.classList.toggle('ok', r.legs >= 1);
    },
    annunciate(text, kind = 'info') { ann.textContent = text; ann.className = `lh-ann ${kind}`; },
    verdict({ grade, reason, sink, drift, tilt }) {
      verdictEl.textContent = `LANDING · ${grade} · ${reason.toUpperCase()} ${reason === 'sink' ? num(sink, 1) : reason === 'drift' ? num(drift, 1) : reason === 'tilt' ? num(tilt * 180 / Math.PI, 1) + '°' : ''}`.trim();
      verdictEl.className = `lh-verdict ${grade.toLowerCase()}`;
    },
    offer(on, key = 'SPACE') { offerEl.hidden = !on; offerEl.textContent = on ? `AUTO-LAND · [${key}] OVERRIDE` : ''; },
    touch(on, h = {}) {   // phones: a throttle slider, two tilt buttons, LEGS, SKIP (spec section 5)
      rail.hidden = !on; rail.replaceChildren();
      if (!on) return;
      const mk = (cls, text, down, up) => { const b = document.createElement('button'); b.type = 'button'; b.className = `lh-btn ${cls}`; b.textContent = text; b.addEventListener('pointerdown', (e) => { e.preventDefault(); down?.(); }); if (up) { b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); } return b; };
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = '0'; slider.className = 'lh-throttle'; slider.addEventListener('input', () => h.throttle?.(+slider.value / 100));
      rail.append(mk('tilt-back', 'TILT ◀', () => h.tilt?.(-1), () => h.tilt?.(0)), mk('tilt-fwd', 'TILT ▶', () => h.tilt?.(1), () => h.tilt?.(0)), slider, mk('legs', 'LEGS', () => h.legs?.()), mk('skip', 'SKIP', () => h.skip?.()));
    },
    dispose() { el.remove(); },
  };
}
```
Append to `styles.css`:
```css
/* THE LANDING'S INSTRUMENTS (src/fx/landing-hud.js) */
#landing-hud { position: fixed; left: 18px; top: 64px; z-index: 40; pointer-events: none; font-family: var(--hud-mono, 'JetBrains Mono', ui-monospace, monospace); color: #b8ffca; letter-spacing: 0.06em; text-shadow: 0 0 6px rgba(79,174,99,0.5); }
#landing-hud[hidden] { display: none; }
#landing-hud .lh-ann { font-size: 13px; color: #4fae63; margin-bottom: 8px; min-height: 16px; }
#landing-hud .lh-ann.alarm { color: #ff6a5a; animation: lh-blink 0.6s steps(2) infinite; }
#landing-hud .lh-ann.ok { color: #b8ffca; }
@keyframes lh-blink { to { opacity: 0.35; } }
#landing-hud .lh-grid { display: grid; grid-template-columns: auto auto auto; gap: 2px 10px; font-size: 12px; }
#landing-hud .lh-k { color: #4fae63; } #landing-hud .lh-v { font-size: 16px; color: #b8ffca; text-align: right; min-width: 5ch; } #landing-hud .lh-u { color: #4fae63; }
#landing-hud .lh-v.hot { color: #ff6a5a; }
#landing-hud .lh-legs { margin-top: 8px; font-size: 12px; color: #4fae63; } #landing-hud .lh-legs.ok { color: #b8ffca; }
#landing-hud .lh-verdict { margin-top: 10px; font-size: 14px; } #landing-hud .lh-verdict.clean { color: #b8ffca; } #landing-hud .lh-verdict.hard { color: #ffcb85; } #landing-hud .lh-verdict.wreck { color: #ff6a5a; }
#landing-hud .lh-offer { position: fixed; left: 50%; bottom: 14vh; transform: translateX(-50%); font-size: 15px; color: #b8ffca; border: 1px solid #4fae63; padding: 6px 14px; background: rgba(4,12,8,0.6); }
#landing-hud .lh-touch { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 10px; justify-content: space-between; padding: 12px; pointer-events: auto; }
#landing-hud .lh-btn { font: inherit; color: #b8ffca; background: rgba(4,12,8,0.7); border: 1px solid #4fae63; padding: 14px 16px; min-width: 88px; }
#landing-hud .lh-throttle { flex: 1; accent-color: #4fae63; writing-mode: horizontal-tb; }
body.arrival-on #landing-hud { display: block; }
```
Note the last line: `body.arrival-on #td-app > *:not(canvas)` hides the game's chrome; `#landing-hud` is appended to `document.body`, not `#td-app`, so it shows.

- [ ] **Step 4: Run to see it pass** — `node test/landing-hud.mjs` → `landing-hud: ok`.

- [ ] **Step 5: Commit**

```bash
git add src/fx/landing-hud.js styles.css test/landing-hud.mjs
git commit -m "The landing's instruments: the HUD panel with the tapes, the stopping distance, the annunciator, the verdict, the offer and the touch rail

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The override's glare

**Files:**
- Create: `src/fx/landing-glare.js`
- Modify: `styles.css` (append), `ATTRIBUTIONS.md` (the full-screen use of the same MIT shader)

**Interfaces:**
- Produces: `startLandingGlare(root, { seconds, reducedMotion }) → { tick(dt), done: boolean, dispose() }`: a full-screen canvas over the page with the MIT launch shader at rising then falling exposure; on reduced motion or no WebGL2 a plain CSS fade of the same length.

- [ ] **Step 1: Write the implementation (no node test: it is a WebGL canvas; its contract is checked in the browser step of Task 10)**

Port the 2D game's `landing/launch-plume.js` (the scratchpad copy at `/private/tmp/claude-501/-Users-minikai-Dev-stalheart/cb7f9ee2-1fbc-4a32-b50d-1945b8ef8401/scratchpad/ext/Stalsfar_Landing/landing/launch-plume.js`, 85 lines; also at https://github.com/jelaludo/Stalsfar_Landing) verbatim as the shader source, keeping its header's attribution, into `src/fx/landing-glare.js` with this surface:
```js
export function startLandingGlare(root, { seconds = 2.4, reducedMotion = false } = {}) {
  const canvas = document.createElement('canvas'); canvas.id = 'landing-glare'; root.append(canvas);
  const gl = reducedMotion ? null : canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
  let t = 0, done = false;
  // exposure: 0.05 -> 4 over the first 40 %, held, then down to 0 over the last 30 % (the 2D game's starship intro ramp, folded)
  const exposure = (u) => (u < 0.4 ? 0.05 + (4 - 0.05) * (u / 0.4) : u < 0.7 ? 4 : 4 * (1 - (u - 0.7) / 0.3));
  if (!gl) { canvas.classList.add('fade'); }
  else { /* compile FRAGMENT + the 2D game's vertex quad; set uniforms as the 2D game's launch-plume.js does, uCam fixed at [0, 2, 7], uExposure from exposure(u); resolution capped at 1600 x 1000 */ }
  return {
    tick(dt) { if (done) return; t += dt; const u = Math.min(1, t / seconds); if (gl) draw(u); else canvas.style.opacity = String(u < 0.5 ? u * 2 : 2 - u * 2); if (u >= 1) { done = true; this.dispose(); } },
    get done() { return done; },
    dispose() { done = true; try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch {} canvas.remove(); },
  };
}
```
`draw(u)` is the 2D game's per-frame render with `uExposure = exposure(u)` and `iTime = t`. Append to `styles.css`:
```css
#landing-glare { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 39; pointer-events: none; mix-blend-mode: screen; }
#landing-glare.fade { background: radial-gradient(circle at 50% 60%, rgba(255,203,133,0.9), rgba(255,120,60,0.4) 40%, transparent 70%); opacity: 0; }
```
Add to `ATTRIBUTIONS.md` under the launch plume's entry: "also drawn full-screen for the landing's override glare (src/fx/landing-glare.js)".

- [ ] **Step 2: Check it compiles** — `node --check src/fx/landing-glare.js`; open `index.html?sw=0&acceptance=1&cine=0&world=story&landing=1#td` after Task 7 and see the glare at the override (Task 10's still asserts the canvas existed).

- [ ] **Step 3: Commit**

```bash
git add src/fx/landing-glare.js styles.css ATTRIBUTIONS.md
git commit -m "The override's glare: the MIT launch shader full-screen over the page for the alarm beat (a plain fade on reduced motion)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The host and the phases in the arrival

**Files:**
- Create: `src/fx/manual-landing.js`
- Modify: `src/fx/arrival.js` (`createArrival` options line 48; `apply` 77-104; `start` 128-144; `tick` 170-186; `state` 188-196; a new `landing(cmd, arg)`)
- Modify: `src/td-tab.js:4216` (the live-shot list), `:5105` (one hook line)

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: `createManualLanding({ tune, game, entry, rocket, plumes, camera, sfx, hud, toWorld, toLocal, up, floorAt, startShot, root })` → `{ begin(altitude, rate), tick(dt) → 'manual'|'flare'|'touched', input(i), skip(), state(), contact() → { grade, reason, sink, drift, tilt }, dispose() }`; `arrival.landing(cmd, arg)` for the harness: `'input'` ({ throttle, tiltRate, legs }), `'skip'`, `'override'`; `arrival.state().landing`.

- [ ] **Step 1: Write the host**

`src/fx/manual-landing.js`:
```js
// THE LANDING'S HOST (spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md section 4): while the arrival's OVERRIDE, MANUAL and
// FLARE phases run, the rocket's pose comes from the flight model (src/domain/manual-landing.js) in the island's metres, the plumes burn with
// the throttle, the chase camera rides behind, the reticle lies on the ground under the predicted impact point, the HUD reads the state,
// and the keys fly. The arrival keeps the clock, the sequence and the swap.
import * as THREE from '../../vendor/three.module.js';
import { LANDING_GAME } from '../content/landing-game.js';
import { createLanding, overrideSeed, step, hStop, predictImpact, verdict, flareDue, flareStep, touched } from '../domain/manual-landing.js';

export function createManualLanding({ game = LANDING_GAME, entry, rocket, plumes, camera, sfx, hud, toWorld, up, floorAt, root, clipScrub }) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), eye = new THREE.Vector3(), look = new THREE.Vector3();
  let s = null, phase = 'idle', acc = 0, input = { throttle: null, tiltRate: 0, legs: false }, held = { back: false, fwd: false }, thrust = null, pingAt = 0, jolt = 0, contact = null, announced = false;
  // the reticle: three fixed rings and the altitude ring, a line loop each, laid on the ground under the predicted point
  const ring = (color) => { const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: game.reticle.segments + 1 }, (_, i) => { const t = i / game.reticle.segments * Math.PI * 2; return new THREE.Vector3(Math.cos(t), 0, Math.sin(t)); })); return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false })); };
  const reticle = new THREE.Group(); reticle.name = 'LandingReticle'; reticle.renderOrder = 999;
  const altRing = ring(0x4fffe0), fixed = game.reticle.rings.map(() => ring(0x4fae63)), square = ring(0xffffff); square.geometry.setFromPoints([[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [-1, 0, -1]].map((p) => new THREE.Vector3(...p)));
  reticle.add(altRing, ...fixed, square); root.add(reticle); reticle.visible = false;
  const keys = (ev, down) => {   // the flight keys; the shot passes keys and keeps Escape as the skip (camera-shot passKeys/skipKey)
    if (phase !== 'manual' && phase !== 'override') return;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (k === 'w' || k === 'ArrowUp') { if (down) input.throttle = Math.min(1, (input.throttle ?? s?.set ?? 0) + (ev.shiftKey ? 1 : game.input.step)); }
    else if (k === 's' || k === 'ArrowDown') { if (down) input.throttle = Math.max(0, (input.throttle ?? s?.set ?? 0) - (ev.shiftKey ? 1 : game.input.step)); }
    else if (k === 'a' || k === 'ArrowLeft') held.back = down;
    else if (k === 'd' || k === 'ArrowRight') held.fwd = down;
    else if (k === 'l') { if (down) input.legs = true; }
    else return;
    ev.preventDefault(); ev.stopImmediatePropagation();
  };
  const onDown = (ev) => keys(ev, true), onUp = (ev) => keys(ev, false);
  const listen = (on) => { const f = on ? addEventListener : removeEventListener; f('keydown', onDown, true); f('keyup', onUp, true); };
  function poseRocket() {
    const h = rocket.holder;   // placed on the pad: translate along up by y and along the ground by x, z (island metres), tilt about x
    h.matrix.copy(h.userData.placed).multiply(m4.makeTranslation(s.x, s.y, s.z)).multiply(new THREE.Matrix4().makeRotationX(s.tilt)); h.matrixWorldNeedsUpdate = true;
    clipScrub('Legs_Deploy', s.legs * game.vehicle.legTime * 4);   // the clip's own length is 2.4 s; scrubbed by the legs' fraction
  }
  function placeReticle() {
    const p = predictImpact(s, game), g = floorAt ? floorAt(p.x, p.z) : { y: 0, normal: [0, 1, 0] };
    toWorld([p.x, g.y + 0.05, p.z], reticle.position);
    b.fromArray(g.normal); toWorld([p.x, g.y + 1, p.z], a); a.sub(reticle.position).normalize();   // the terrain normal in world space
    q.setFromUnitVectors(c.set(0, 1, 0), a); reticle.quaternion.copy(q);
    const r = Math.max(2, s.y * game.reticle.metresPerMetre), v = Math.hypot(s.vx, s.vz), stretch = 1 + Math.min(2, v * 0.08);
    altRing.scale.set(r * stretch, 1, r); altRing.rotation.y = Math.atan2(s.vx, s.vz);
    fixed.forEach((f, i) => { const at = game.reticle.rings[i]; f.visible = s.y > at; f.scale.setScalar(Math.max(1, (s.y - at) * game.reticle.metresPerMetre)); });
    square.visible = s.y <= game.reticle.square; square.scale.setScalar(4);
    const onPad = Math.hypot(p.x, p.z) <= game.pad.reach; altRing.material.color.set(onPad ? 0x4fffe0 : 0xff6a5a);
    reticle.visible = true;
  }
  function chase(out) {   // the shot's poseAt: behind along -z, above, looking ahead and down; the disk sits low beyond the base from here
    toWorld([s.x, s.y + game.camera.up, s.z - game.camera.back], eye); toWorld([s.x, Math.max(0, s.y - game.camera.down), s.z + game.camera.ahead], look);
    if (jolt > 0) { eye.addScaledVector(up, Math.sin(jolt * 40) * jolt * game.camera.jolt); }
    m4.lookAt(eye, look, up); out.quat.setFromRotationMatrix(m4); out.pos.copy(eye);
  }
  function sounds(dt) {
    if (s.throttle > game.hud.audibleThrottle) { thrust ??= sfx?.loop('rocket_thrust', { dist: 0, gain: 0 }); thrust?.set(0.4 + 0.6 * s.throttle, 0.96 + 0.06 * s.throttle); }
    else if (thrust) { thrust.stop(0.08); thrust = null; }
    const p = predictImpact(s, game), gap = p.reached ? game.hud.ping.far + (game.hud.ping.near - game.hud.ping.far) * Math.max(0, Math.min(1, 1 - (s.y - game.hud.ping.nearAt) / 300)) : game.hud.ping.far;
    pingAt += dt; if (pingAt >= gap) { pingAt = 0; sfx?.play('laser_click', { dist: 0, gain: 0.5 }); }
  }
  function reading() { return { altitude: s.y, sink: Math.max(0, -s.vy), driftAlong: s.vz, driftAcross: s.vx, tilt: s.tilt, tw: game.vehicle.thrust * Math.max(s.throttle, s.throttle > 0 ? game.vehicle.minThrottle : 0) / game.sim.gravity, hStop: hStop(s, game), fuel: s.fuel, legs: s.legs, phase }; }
  return {
    begin(altitude, rate) {   // OVERRIDE: seed from the sequence's state, show the panel, arm the keys; MANUAL starts with the first tick after override.seconds
      s = overrideSeed(altitude, rate, entry); phase = 'override'; acc = 0; contact = null; announced = false;
      hud.show(true); hud.annunciate('AUTO-LAND FAULT · MANUAL OVERRIDE', 'alarm'); hud.set(reading()); listen(true);
      sfx?.play('danger_alert', { dist: 0 }); poseRocket(); placeReticle();
    },
    manual() { phase = 'manual'; hud.annunciate('MANUAL', 'info'); },
    tick(dt) {
      if (!s || phase === 'idle' || phase === 'touched') return phase;
      if (jolt > 0) jolt = Math.max(0, jolt - dt);
      acc += Math.min(dt, game.sim.dt * game.sim.maxSteps);
      const i = { throttle: input.throttle, tiltRate: (held.fwd ? 1 : 0) - (held.back ? 1 : 0), legs: input.legs }; input.throttle = null; input.legs = false;
      while (acc >= game.sim.dt) {
        acc -= game.sim.dt;
        if (phase === 'override') { s.t += game.sim.dt; continue; }   // the alarm beat: the rocket holds its line, the keys already set the throttle
        if (phase === 'manual' && flareDue(s, game)) { phase = 'flare'; hud.annunciate('AUTO-LAND RESUMED', 'ok'); }
        if (phase === 'flare') flareStep(s, game.sim.dt, game); else step(s, i, game.sim.dt, game);
        if (touched(s)) { phase = 'touched'; break; }
      }
      poseRocket(); placeReticle(); sounds(dt);
      for (const p of plumes) { const e = p.userData.engine; p.userData.setIntensity((s.throttle > 0 ? Math.max(game.vehicle.minThrottle, s.throttle) : 0) * (1 - e.depth + e.depth * Math.sin(s.t * e.cadence + e.phase)) * 0.55); p.userData.tick(s.t + e.phase); }
      hud.set(reading());
      if (phase === 'touched') {
        const g = floorAt ? floorAt(s.x, s.z) : { y: 0, normal: [0, 1, 0] }, slope = Math.acos(Math.max(-1, Math.min(1, g.normal[1])));
        contact = verdict(s, slope, Math.hypot(s.x, s.z) > game.pad.reach, game);
        jolt = contact.grade === 'CLEAN' ? 0 : contact.grade === 'HARD' ? 0.5 : 1;
        if (contact.grade === 'WRECK') sfx?.play('mech_landing_impact', { dist: 0 });
        hud.verdict(contact); listen(false); if (thrust) { thrust.stop(0.4); thrust = null; } reticle.visible = false;
      }
      return phase;
    },
    chase, input(i) { if (i.throttle != null) input.throttle = i.throttle; held.back = (i.tiltRate ?? 0) < 0; held.fwd = (i.tiltRate ?? 0) > 0; if (i.legs) input.legs = true; },
    skip() { if (!s || phase === 'touched') return; phase = 'touched'; contact = { grade: 'CLEAN', reason: 'skipped', sink: 0, drift: 0, tilt: 0 }; listen(false); if (thrust) { thrust.stop(0.4); thrust = null; } reticle.visible = false; },
    contact: () => contact, phase: () => phase, pose: () => (s ? { x: s.x, y: s.y, z: s.z, tilt: s.tilt } : null),
    state: () => (s ? { phase, grade: contact?.grade ?? null, reason: contact?.reason ?? null, sink: +Math.max(0, -s.vy).toFixed(2), drift: +Math.hypot(s.vx, s.vz).toFixed(2), tilt: +s.tilt.toFixed(3), fuel: +s.fuel.toFixed(1), altitude: +s.y.toFixed(1), throttle: +s.throttle.toFixed(2), legs: +s.legs.toFixed(2), t: +s.t.toFixed(2) } : null),
    dispose() { listen(false); if (thrust) { thrust.stop(0.2); thrust = null; } reticle.removeFromParent(); for (const l of [altRing, ...fixed, square]) { l.geometry.dispose(); l.material.dispose(); } hud.dispose(); },
  };
}
```
`floorAt(x, z)` is a closure the arrival builds: the island's tangent plane is y = 0 for the pad; for a point off the island, the arrival asks `base.floorAt(worldUnitPoint)` (`src/fx/story-base.js:346`, a lift factor along the radius: convert to a height in island metres: `(factor - 1) * planetRadius / metres`) and returns `{ y, normal: [0, 1, 0] }` (the slope term stays 0 on the pad; the lattice's own normal is not read in this round).

- [ ] **Step 2: Cut the phases into the arrival**

In `src/fx/arrival.js`:
1. Imports: `import { STORY_ARRIVAL_MANUAL } from '../content/story-defaults.js'; import { LANDING_GAME } from '../content/landing-game.js'; import { seedEntry } from '../domain/manual-landing.js'; import { createManualLanding } from './manual-landing.js'; import { createLandingHud } from './landing-hud.js'; import { startLandingGlare } from './landing-glare.js'; import { storage } from '../storage.js';`
2. Options: `createArrival({ on, past, base, beats, site, metres, tune = null, manual = false, offer = false, seed = 'planet' })` with `tune ??= manual ? STORY_ARRIVAL_MANUAL : STORY_ARRIVAL`. Keep `let flying = null, glare = null, overrideAt = manual ? LANDING_GAME.approach.overrideAt : Infinity, offered = false, offerLeft = offer ? LANDING_GAME.override.offerSeconds : 0, grade = null;`.
3. In `start()`, after the plumes: `if (manual || offer) flying = createManualLanding({ entry: seedEntry(seed), rocket, plumes, camera, sfx: api.sfx, hud: createLandingHud(globalThis.document?.body), toWorld: (p, out) => toWorld(p, out), up, floorAt: (x, z) => ({ y: 0, normal: [0, 1, 0] }), root: fxRoot, clipScrub: clip });` and, when `offer`, `flying.hud.offer(true, 'SPACE')` with `hud.offer` reachable (expose `hud` on the host's return: add `hud` to the returned object in Task 7's host).
4. In `tick`, the `landing` branch becomes:
```js
      if (phase === 'landing') {
        t += dt;
        if (offerLeft > 0) { offerLeft -= dt; if (offerLeft <= 0) flying?.hud.offer(false); }
        if (flying && t >= overrideAt && !flying.pose()) {   // OVERRIDE: the sequence's altitude and rate at this instant seed the flight
          const alt = shot.stateAt(t).altitude, rate = (shot.stateAt(t + 0.05).altitude - alt) / 0.05;
          flying.begin(alt, rate); api.brief(LANDING_GAME.lines.override); storage.setItem('td.landing.flown', '1');
          glare = startLandingGlare(globalThis.document?.body, { ...LANDING_GAME.override.glare, reducedMotion: !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches });   // the glare's seconds, dim and peak exposure are the tune's (Task 6's fix: the shader divides by the exposure)
          api.startShot({ id: 'arrivalFlight', dur: 1e6, poseAt: (u, out) => flying.chase(out), skippable: true, skipKey: LANDING_GAME.input.skipKey, passKeys: true, onEnd: () => { if (!cutting && phase === 'landing') flying?.skip(); } });
          overrideT = 0;
        }
        if (flying?.pose()) {   // the window: OVERRIDE for override.seconds, then MANUAL / FLARE, until the ground
          glare?.tick(dt); overrideT += dt; if (flying.phase() === 'override' && overrideT >= LANDING_GAME.override.seconds) flying.manual();
          const ph = flying.tick(dt);
          if (ph === 'touched') { grade = flying.contact(); t = shot.seq.touchdown; beats.salvage?.(LANDING_GAME.salvage[grade.grade]); overrideAt = Infinity; flying.dispose(); flying = null; glare?.dispose(); glare = null; api.startShot({ id: 'arrival', dur: shot.cut - t + 2, poseAt: railPose, onEnd: () => { if (!cutting) finish(true); } }); }
          else return;   // the rail and the sequence wait
        }
        if (t >= shot.cut) toTalk(); else apply(t, dt);
      }
```
(`let overrideT = 0` with the other lets; `railPose` reads `t`, which now continues from `touchdown`, so the rail's keys after the touchdown play as tuned.)
5. The offer: in `tick`'s `landing` branch, before the override check: `if (offer && !offered && offerLeft > 0 && api.offerTaken?.()) { offered = true; overrideAt = Math.max(t, LANDING_GAME.approach.overrideAt); }` — and the key: the arrival's own capture listener for `' '` while `offerLeft > 0` sets `offered = true` and `overrideAt = t + 0.01` (register it in `start()` when `offer`, remove it in `finish`). The game's shot still skips on any other key; Space during the offer is eaten by this listener first (registered before the shot's: register it in `start()` BEFORE `api.startShot`).
6. `deploy()`: `api.brief(grade ? LANDING_GAME.lines[grade.grade] : tune.talk.brief);`.
7. `finish()` and `release()`: `flying?.dispose(); flying = null; glare?.dispose(); glare = null;`.
8. `apply(time, dt)` is unchanged; after a flown touchdown the shock clip's rate: in `apply`, `clip('Landing_Shock', s.clips.Landing_Shock === null ? null : s.clips.Landing_Shock * (grade?.grade === 'WRECK' ? 1.6 : grade?.grade === 'HARD' ? 1.25 : 1))`.
9. The harness: `landing(cmd, arg) { if (cmd === 'input') { flying?.input(arg); return !!flying; } if (cmd === 'skip') { if (flying) { flying.skip(); return true; } return false; } if (cmd === 'override') { if (offer && offerLeft > 0 && !offered) { offered = true; overrideAt = t + 0.01; return true; } return false; } return null; }` on the returned object, and `landing: flying?.state() ?? (grade ? { phase: 'done', ...grade } : null), flown: storage.getItem('td.landing.flown') === '1', offered` in `state()`.
10. `src/td-tab.js`: line 4216's live-shot list gains `|arrivalFlight` (the world keeps running under the flight: the dust and the plumes tick; the game's tank and waves are not up yet at stage 1); line 5105 (or the nearest hook line under 480 characters) gains `landing: (cmd, arg) => story?.arrival.landing?.(cmd, arg) ?? null,`. Check the line stays under 500 characters (`awk 'length > 500' src/td-tab.js` prints nothing) and the file under 5,450 lines.

- [ ] **Step 3: Check it runs**

`node --check src/fx/manual-landing.js src/fx/arrival.js src/td-tab.js; npm test; npm run check`. Then, through the lock, a look: `scripts/browser-lock.sh node scripts/browser-test.mjs --base-look` must stay green (it lands automatically, `acceptance=1`). Then open `index.html?sw=0&acceptance=1&cine=0&world=story&landing=1&fps=1#td` headed via `HEADED=1 node /private/tmp/.../scratchpad/perf-probe.mjs` is NOT the tool; use a scratch CDP page or the headed Chrome by hand: the rocket comes in, the alarm, the HUD, W/S/A/D fly it, the reticle moves, the ground is met, the verdict reads, Isao's talk runs, the foundry deploys. Fix what does not before the next task.

- [ ] **Step 4: Commit**

```bash
git add src/fx/manual-landing.js src/fx/arrival.js src/td-tab.js
git commit -m "The landing flown: the override, manual and flare phases cut into the arrival's clock, the chase shot, the reticle on the ground, the keys, the grade to the foundry and the talk, the harness's landing(cmd)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The story lab's manual window

**Files:**
- Modify: `src/labs/story-landing.js` (`createStoryLanding` returns `manual`), `src/labs/story-tab.js:126-145` (`?manual=1`, the keys, the readout)

**Interfaces:**
- Produces: in the lab, `?manual=1#story` opens the arrival with the flown tune; `L` lands as today, and at the override the lab's own `createManualLanding` takes the rocket (the same host, with the lab's `lift` group as the holder and no HUD root but the lab's status line), the keys fly, `R` resets. `window.__stalheartStoryTest.state().manual` carries the host's `state()`.

- [ ] **Step 1: Wire it**

In `src/labs/story-landing.js`: export a `holder()` → `lift` (a Group with `matrixAutoUpdate` true; give the host a `rocket = { holder: lift }` whose `userData.placed` is an identity matrix set once, and set `lift.matrixAutoUpdate = false` while the host poses it) and `plumes()` → the plumes array. In `src/labs/story-tab.js`: when `q.get('manual') === '1'` use `STORY_ARRIVAL_MANUAL.landing` for the sequence the lab seeks, and in the `land()` loop, at `t >= LANDING_GAME.approach.overrideAt`, create the host (`createManualLanding({ entry: seedEntry(q.get('seed') ?? 'lab'), rocket: { holder: landing.holder() }, plumes: landing.plumes(), camera, sfx, hud: createLandingHud(document.body), toWorld: (p, out) => out.set(...p).applyMatrix4(landing.rootMatrix()), up: ..., floorAt: () => ({ y: 0, normal: [0, 1, 0] }), root: scene, clipScrub: landing.hold })`), call `begin` (the flight seeded from the entry, as the game does since Task 7's fix A) then `manual()` after `override.seconds`, tick it instead of seeking the sequence, and on `'touched'` resume the sequence at its touchdown. The lab's camera: `controls` (OrbitControls) stay; the chase is not used in the lab (the owner orbits to judge the flight). The status line prints `state()` each frame.

- [ ] **Step 2: Check** — `labs.html?sw=0&manual=1#story`, press L: the rocket comes in, the alarm at the override, the keys fly it, the verdict prints in the status line, R resets. `--story` (the lab's own suite) stays green through the lock.

- [ ] **Step 3: Commit**

```bash
git add src/labs/story-landing.js src/labs/story-tab.js
git commit -m "The story lab flies the landing (?manual=1): the owner tunes the entry, the fuel and the corridor where the arrival was authored

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The tutorial card's skip and the chrome

**Files:**
- Modify: `src/td-tab.js:4412` (the skip card's `skipLanding`), `src/fx/tutorial-card.js` (no change expected: read `skipLanding`'s contract at lines 11-18)

- [ ] **Step 1:** `skipLanding` must end a flight as it ends the shot: `skipLanding: () => /^arrival/.test(shotId() ?? '') && (story?.arrival.landing?.('skip'), endShot(), true)` (the `arrivalFlight` shot id starts with `arrival`, so the test already matches; the `landing('skip')` call makes the flight grade CLEAN before the shot ends). Keep the line under 500 characters.
- [ ] **Step 2:** `npm run check`; `scripts/browser-lock.sh node scripts/browser-test.mjs --skip-tutorial` green.
- [ ] **Step 3: Commit** — `git commit -am "The tutorial card's skip ends a flown landing as it ends the shot"` with the trailer.

---

### Task 10: The browser step `--landing`

**Files:**
- Modify: `scripts/browser-test.mjs` (a new `else if(args.includes('--landing'))` block before `--antenna-print` at line 1586)
- Modify: `docs/STATE.md` (the suites list in the run section, line ~463)

- [ ] **Step 1: Write the step**

```js
 } else if(args.includes('--landing')) {
 // THE LANDING FLOWN (spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md section 9): a scripted timeline to a CLEAN landing, one
 // that never burns to a WRECK, and the skip mid-flight; the grade, the foundry's sections, the talk and the swap asserted; a still mid-flight
 const T='window.__stalheartTest',L=`${T}.state().arrival.landing`;
 const fly=async(name,url,script)=>{
  await go(name,url);await until(`!!${T}&&${T}.state().arrival?.phase==='landing'`,120000);
  await until(`(${L}?.phase==='override')||(${L}?.phase==='manual')`,60000);   // the override came
  assert(await evaluate('!!document.querySelector("#landing-glare")'),'the glare canvas stood at the override');
  assert.equal(await evaluate(`${T}.state().arrival.flown`),true,'the store remembers the flight');
  await until(`${L}?.phase==='manual'`,15000);
  const t0=Date.now();
  while(Date.now()-t0<60000){const s=await evaluate(`${L}`);if(!s||s.phase==='touched'||s.phase==='done')break;await evaluate(`${T}.landing('input',${JSON.stringify(script(s))})`);await delay(80);}
  await until(`${T}.state().arrival?.phase!=='landing'`,60000);
  return evaluate(`${T}.state()`);
 };
 // CLEAN: cancel the drift with the tilt, legs, then the burn at the stopping distance plus a margin
 {const s=await fly('landing-clean','index.html?sw=0&acceptance=1&cine=0&world=story&landing=1#td',(x)=>({throttle:x.altitude<=x.sink*x.sink/(2*(12-3.2))+25?1:x.drift>2?0.4:0.2,tiltRate:x.drift>1?-1:x.drift<-1?1:0,legs:true}));
  const g=s.arrival.landing;console.log('  clean:',JSON.stringify(g));assert.equal(g.grade,'CLEAN',`a clean landing (${g.reason})`);
  assert.equal(s.story.foundry.sections.length,3,'all three sections');assert.ok((s.story.said||[]).includes('arrival_talk_clean')||s.storyHud?.brief==='arrival_talk_clean','the clean talk');
  assert.equal(s.arrival.rocket,false,'the rocket swapped');assert.equal(s.arrival.salvage,true);}
 // WRECK: no burn at all
 {const s=await fly('landing-wreck','index.html?sw=0&acceptance=1&cine=0&world=story&landing=1#td',()=>({throttle:0,tiltRate:0,legs:true}));
  const g=s.arrival.landing;console.log('  wreck:',JSON.stringify(g));assert.equal(g.grade,'WRECK');assert.ok(['sink','off-pad'].includes(g.reason),`a no-burn wreck reads sink or off-pad (${g.reason})`);
  assert.equal(s.story.foundry.sections.length,2,'the tank section is gone');}
 // the skip mid-flight: CLEAN, the plain talk
 {await go('landing-skip','index.html?sw=0&acceptance=1&cine=0&world=story&landing=1#td');await until(`${L}?.phase==='manual'`,120000);await delay(1500);current='landing-manual';await finish();   // the still mid-flight, the disk in frame
  assert.equal(await evaluate(`${T}.landing('skip')`),true);await until(`${T}.state().arrival?.phase!=='landing'`,60000);
  const s=await evaluate(`${T}.state()`);assert.equal(s.arrival.landing.grade,'CLEAN');assert.equal(s.arrival.landing.reason,'skipped');assert.equal(s.story.foundry.sections.length,3);}
 // a later start is offered the flight on the START gate (Task 7's fix B; `?landing=offer` stands in for the store's flag because an acceptance page never offers on its own; ?gate=1 shows the gate on an acceptance page): taken through the harness before START it flies, not taken it lands itself in the short arrival
 {await go('landing-offer-taken','index.html?sw=0&acceptance=1&cine=0&world=story&gate=1&landing=offer#td');await until(`!!${T}&&${T}.state().arrival?.gate==='shown'`,120000);
  assert.equal(await evaluate(`${T}.landing('override')`),true,'the gate offers the flight');await evaluate(`document.querySelector('#wg-start,.wg-start,[data-start]')?.click()`);
  await until(`${L}?.phase==='manual'`,120000);assert.equal(await evaluate(`${T}.state().arrival.offered`),true);await evaluate(`${T}.landing('skip')`);await until(`${T}.state().arrival?.phase!=='landing'`,60000);}
 {await go('landing-offer-left','index.html?sw=0&acceptance=1&cine=0&world=story&gate=1&landing=offer#td');await until(`!!${T}&&${T}.state().arrival?.gate==='shown'`,120000);await evaluate(`document.querySelector('#wg-start,.wg-start,[data-start]')?.click()`);
  await until(`${T}.state().arrival?.phase==='done'`,120000);assert.equal(await evaluate(`${L}`),null,'no flight without the ask');}
 (Read `src/fx/start-gate.js` for the START button's real selector and the FLY THE LANDING button's; `state().arrival.gate` reads 'shown' / 'opened'.)
```
Read how `story.said` / the current brief is exposed in `state()` (line 4989: `story: story?.beats.state()` has `said`; the arrival's brief goes through `api.brief` → check which state field records it) and fix the assertion's field. `go()` resets storage between pages? Read `go()` at line 50: if the profile persists `localStorage`, the `landing-offer` page sees `flown` from the first page, which is what the assertion wants; if it does not, set `localStorage` before navigating (`await evaluate("localStorage.setItem('stalheart:v1:td.landing.flown','1')")` on the previous page).

- [ ] **Step 2: Run** — `scripts/browser-lock.sh node scripts/browser-test.mjs --landing`; then `--story`, `--base-look`, `--skip-tutorial`, the default suite. Expected: all green; `artifacts/browser/landing-manual.png` shows the rocket from behind with the reticle on the ground and the disk low in the frame.

- [ ] **Step 3: Docs** — `docs/STATE.md`: a section at the top "What landed on 2026-11-07 (THE LANDING flown)" in the house style (what, where, the knobs, the suites, what the owner has not seen), and `--landing` in the run section's list. A log entry via `node scripts/log.mjs add` (type change, accepted) with the measured facts (the clean and wreck timelines' numbers, the suites), then `DEVLOG.md` rendered.

- [ ] **Step 4: Commit**

```bash
git add scripts/browser-test.mjs docs/STATE.md docs/log/entries DEVLOG.md
git commit -m "The landing's suite (--landing: a clean flight, a wreck, the skip, the offer), STATE and the log entry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** section 2 (the beat) → Task 7; 3 (the model) → Tasks 1-2; 4 (the host: pose, plumes, camera, reticle, HUD, glare, sounds) → Tasks 5-7; 5 (controls and instruments, touch) → Tasks 5 and 7 (the touch rail is built; the host's `hud.touch(true, handlers)` call on a coarse pointer is wired in Task 7 step 2.3: `if (matchMedia('(pointer: coarse)').matches) hud.touch(true, { throttle: (v) => flying.input({ throttle: v }), tilt: (d) => flying.input({ tiltRate: d }), legs: () => flying.input({ legs: true }), skip: () => flying.skip() })`); 6 (the grade) → Task 3; 7 (Isao) → Task 4; 8 (first start, skip, entries) → Tasks 4, 7, 9; 9 (harness, suites) → Tasks 7, 10; 10 (modules) → the file map; 11 (build order) → the task order; 12 (not in scope) → nothing added.
- **Placeholders:** Task 3's test names `b.land?.(api)` as the set-up to replace with the real path to `landed`, and Task 5's `fakeDoc()` points at the house pattern; both are explicit instructions to read a named file, not gaps. Task 6 ports a named 85-line file.
- **Type consistency:** `createLanding(entry)` / `overrideSeed(altitude, rate, entry)` / `step(s, input, dt, tune)` / `verdict(s, slope, offPad, tune)` / `flareDue` / `flareStep(s, dt, tune)` / `touched(s)` / `hStop(s, tune)` / `predictImpact(s, tune, groundY)` are used with these signatures in Tasks 2, 7 and 8; the host's `state()` fields (`phase, grade, reason, sink, drift, tilt, fuel, altitude, throttle, legs, t`) are what Task 10 reads; `beats.salvage({ sections, feedstockPerBarrel, bonus })` takes `LANDING_GAME.salvage[grade]` as shaped in Task 1; `arrival.landing(cmd, arg)` with `'input' | 'skip' | 'override'` is what `td-tab`'s hook forwards and Task 10 calls.
