# THE LANDING: the exhaust signature and the stick — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The flown landing opens with the 2D game's full-screen EXHAUST SIGNATURE cinematic, and flies with Space held as the burn, W/S tilt, A/D bank and a floating mouse/touch stick (spec section 10 of `docs/superpowers/specs/2026-11-07-landing-mini-game-design.md`; read sections 2-5 and 8-9 for the frame it sits in).

**Architecture:** The flight model (`src/domain/manual-landing.js`, pure) gains a second tilt axis `bank`; the tune (`src/content/landing-game.js`) gains `signature` and `input.stick` and loses the stepped throttle; a new fx host `src/fx/exhaust-signature.js` draws the 2D game's opening (the shader moves there from `src/fx/landing-glare.js`, which keeps only its CSS fade); a new `src/fx/landing-stick.js` turns pointer drags into tilt/bank rates; the flight host `src/fx/manual-landing.js` reads Space, WASD and the stick; `src/fx/arrival.js` plays the signature before the approach of a flown landing. `src/td-tab.js` is NOT touched (its `landing:` hook already forwards the harness).

**Tech Stack:** three.js r160 (vendored), native ESM, WebGL2 for the signature's own canvas, node tests in `test/*.mjs` run by `npm test`, the browser harness `scripts/browser-test.mjs` run ONLY through `scripts/browser-lock.sh`.

## Global Constraints

- `src/domain` never imports `src/content`: tunes are passed as arguments (the architecture guard `npm run check` fails otherwise).
- `src/td-tab.js` must not grow (5,340 lines, ceiling 5,450; no line over 500 chars). This plan does not edit it.
- Every edited JS file passes `node --check` before a commit; `npm test` and `npm run check` are green at every commit.
- Commits as the repository's author (Kai Denrei), each message ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never push.
- Browser suites only through `scripts/browser-lock.sh` (e.g. `scripts/browser-lock.sh node scripts/browser-test.mjs --landing`), one browser at a time, never while editing `src` of the tree it serves. A suite that times out at load is a syntax error: `node --check` first.
- The 2D game's constants are used verbatim where this plan quotes them: `signature { seconds: 8, hold: 3, yEnd: -1048576 }`, the shader's exposure 1000, the camera at `(0, y, 7)`, the resolution cap 1600 x 1000, the 30 Hz draw cap, the stick's dead zone 5 px and full throw 48 px.
- The thrust direction is `d = (sin bank · cos tilt, cos bank · cos tilt, sin tilt)`; the pose is `Rz(-bank) · Rx(tilt)`; the verdict's, the flare's and the HUD's tilt is `acos(cos bank · cos tilt)`.
- Keys in flight: Space held = burn (set point 1 while held, 0 on release), W/S tilt forward/back, A/D bank left(-x)/right(+x), arrows as WASD, L legs, Esc the skip. No other key does anything in flight.
- The signature is skipped (never built) on `prefers-reduced-motion` or without WebGL2; a phone plays it. Under it Esc or the SKIP CINEMATIC button skips the cinematic only; every other key is eaten.
- The override's glare is the plain CSS fade (`#landing-glare.fade`), 1.2 s; the shader is drawn only by the signature.

---

### Task 1: The flight model's bank axis and the tune

**Files:**
- Modify: `src/domain/manual-landing.js` (createLanding, step, verdict, flareDue, flareStep, predictImpact)
- Modify: `src/content/landing-game.js` (`input`, new `signature`, `override.glare`)
- Modify: `test/manual-landing.mjs`, `test/landing-game.mjs`
- Delete: `test/landing-glare.mjs` (its `glareExposure` goes in Task 2; delete the test here so `npm test` stays green when Task 2 removes the export — Task 2 adds the signature's test)

**Interfaces:**
- Produces: state fields `bank`, `bankRate`; `step(s, { throttle, tiltRate, bankRate, legs }, dt, tune)`; `tiltTotal(s)` exported (`Math.acos(Math.cos(s.bank) * Math.cos(s.tilt))`); `verdict(...)` returns `tilt` as the total angle; `LANDING_GAME.signature { seconds, hold, yEnd }`, `LANDING_GAME.input { skipKey: 'Escape', offerKey: ' ', burnKey: ' ', stick: { dead: 5, full: 48 } }`, `LANDING_GAME.override.glare { seconds: 1.2 }`.

- [ ] **Step 1: Write the failing tests** — append to `test/manual-landing.mjs`:

```js
import { tiltTotal, verdict, flareDue, flareStep, predictImpact } from '../src/domain/manual-landing.js';
{ // the bank aims the thrust across: a bank toward +x pushes +x, the tilt still pushes +z; the total angle is acos(cos b cos t)
  const s = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0 }); s.throttle = 1; s.fuel = 10; s.bank = 0.3;
  step(s, { throttle: 1, tiltRate: 0, bankRate: 0, legs: false }, DT, T);
  assert.ok(s.vx > 0, 'a +x bank pushes +x'); assert.ok(Math.abs(s.vz) < 1e-9, 'no tilt, no z push');
  const both = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0.2 }); both.throttle = 1; both.fuel = 10; both.bank = 0.3;
  step(both, { throttle: 1, tiltRate: 0, bankRate: 0, legs: false }, DT, T);
  const d = [Math.sin(0.3) * Math.cos(0.2), Math.cos(0.3) * Math.cos(0.2), Math.sin(0.2)];
  assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-12, 'd is unit');
  assert.ok(Math.abs(both.vx - d[0] * T.vehicle.thrust * DT) < 1e-9, 'vx along d.x');
  assert.ok(Math.abs(both.vz - d[2] * T.vehicle.thrust * DT) < 1e-9, 'vz along d.z');
  assert.ok(Math.abs(both.vy - (d[1] * T.vehicle.thrust - T.sim.gravity) * DT) < 1e-9, 'vy along d.y less g');
  assert.ok(Math.abs(tiltTotal(both) - Math.acos(d[1])) < 1e-12, 'the total angle from vertical');
}
{ // the bank rate integrates with the same torque and damping as the tilt rate
  const s = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0 });
  for (let i = 0; i < 60; i++) step(s, { throttle: 0, tiltRate: 0, bankRate: 1, legs: false }, DT, T);
  const t = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0 });
  for (let i = 0; i < 60; i++) step(t, { throttle: 0, tiltRate: 1, bankRate: 0, legs: false }, DT, T);
  assert.ok(s.bank > 0 && Math.abs(s.bank - t.tilt) < 1e-12, 'bank and tilt integrate alike');
  assert.equal(createLanding(entry).bank, 0); assert.equal(createLanding(entry).bankRate, 0);
}
{ // the verdict reads the total angle: a bank alone past the hard limit is a tilt wreck
  const s = createLanding({ ...entry, sink: 1, drift: 0, tilt: 0 }); s.legs = 1; s.legsDown = true; s.vx = 0; s.vz = 0; s.bank = 0.3;
  const v = verdict(s, 0, false, T);
  assert.equal(v.grade, 'WRECK'); assert.equal(v.reason, 'tilt'); assert.ok(Math.abs(v.tilt - 0.3) < 1e-12);
}
{ // the flare's corridor reads the total angle and the flare eases the bank out
  const s = createLanding({ ...entry, altitude: 20, sink: 2, drift: 0, tilt: 0 }); s.bank = 0.3;
  assert.equal(flareDue(s, T), false, 'a 0.3 bank is outside the 0.25 corridor');
  s.bank = 0.2; assert.equal(flareDue(s, T), true);
  for (let i = 0; i < 600; i++) flareStep(s, DT, T);
  assert.ok(Math.abs(s.bank) < 0.02, `the bank eased out (${s.bank})`);
}
{ // the predictor holds the bank rate at zero (the bank itself persists), as it holds the tilt
  const s = createLanding({ ...entry, altitude: 100, sink: 10, drift: 0, tilt: 0 }); s.bank = 0.2;
  const p = predictImpact(s, T); assert.ok(p.reached && Number.isFinite(p.x));
  assert.ok(Math.abs(s.bank - 0.2) < 1e-12, 'the predictor does not touch the state');
}
console.log('manual-landing: bank ok');
```

And append to `test/landing-game.mjs`:

```js
assert.deepEqual(LANDING_GAME.signature, { seconds: 8, hold: 3, yEnd: -1048576 }, "the 2D game's opening: 8 s, a 3 s hold, black at the end");
assert.ok(Object.isFrozen(LANDING_GAME.signature));
assert.equal(LANDING_GAME.input.burnKey, ' ', 'Space is the burn');
assert.deepEqual(LANDING_GAME.input.stick, { dead: 5, full: 48 }, "the 2D game's floating stick");
assert.equal(LANDING_GAME.input.step, undefined, 'no stepped throttle');
assert.deepEqual(LANDING_GAME.override.glare, { seconds: 1.2 }, 'the override is a plain fade: the shader is the signature');
console.log('landing-game: signature and stick ok');
```

- [ ] **Step 2: Run them, watch them fail**

Run: `node test/manual-landing.mjs && node test/landing-game.mjs`
Expected: FAIL (`tiltTotal` is not exported / `LANDING_GAME.signature` undefined).

- [ ] **Step 3: The model** — in `src/domain/manual-landing.js`:

Header comment: add "the bank is about z, positive toward +x; the thrust direction is d = (sin bank · cos tilt, cos bank · cos tilt, sin tilt) and the pose that puts the hull's up on it is Rz(-bank) · Rx(tilt) (spec 10)".

`createLanding`: add `bank: 0, bankRate: 0` after `tiltRate: 0`.

`step`: replace the tilt/thrust block with

```js
  s.tiltRate += (clamp(input.tiltRate ?? 0, -1, 1) * v.torque - s.tiltRate * v.damping) * dt;
  s.bankRate += (clamp(input.bankRate ?? 0, -1, 1) * v.torque - s.bankRate * v.damping) * dt;
  s.tilt += s.tiltRate * dt; s.bank += s.bankRate * dt;
  const drag = tune.sim.drag + (s.legs >= 1 ? v.legDrag : 0), T = v.thrust * lit, ct = Math.cos(s.tilt);
  s.vz += (Math.sin(s.tilt) * T - drag * s.vz * Math.abs(s.vz)) * dt;
  s.vx += (Math.sin(s.bank) * ct * T + s.wind - drag * s.vx * Math.abs(s.vx)) * dt;
  s.vy += (Math.cos(s.bank) * ct * T - g - drag * s.vy * Math.abs(s.vy)) * dt;
```

Export `export const tiltTotal = (s) => Math.acos(clamp(Math.cos(s.bank ?? 0) * Math.cos(s.tilt), -1, 1));`.

`predictImpact`: `hold = { throttle: null, tiltRate: 0, bankRate: 0, legs: false }`.

`verdict`: `tilt = tiltTotal(s)` instead of `Math.abs(s.tilt)` (the caller that corrects the tilt against the local normal passes `{ ...s, tilt: ... }`, which still works).

`flareDue`: `tiltTotal(s) <= f.tilt`. `flareStep`: `s.bank += (0 - s.bank) * k; s.bankRate = 0;` beside the tilt's.

- [ ] **Step 4: The tune** — in `src/content/landing-game.js`:

```js
  // THE EXHAUST SIGNATURE (spec 10, src/fx/exhaust-signature.js): the 2D game's opening verbatim (Stalsfar_Landing CONFIG.cinematic
  // { opening: 8, ignitionHold: 3, launchYEnd: -1048576 }): the camera's Y holds at 2 for `hold` s (the boosters close up), falls to -8,
  // then geometrically to `yEnd`, where the frame is black
  signature: Object.freeze({ seconds: 8, hold: 3, yEnd: -1048576 }),
```

`override.glare` becomes `Object.freeze({ seconds: 1.2 })` with the comment "the plain fade (spec 10): the shader is the signature's". `input` becomes `Object.freeze({ skipKey: 'Escape', offerKey: ' ', burnKey: ' ', stick: Object.freeze({ dead: 5, full: 48 }) })` with the comment "Space held is the burn (spec 10); the stick: the 2D game's floating thumb-stick, px of drag past the dead zone to the full throw".

- [ ] **Step 5: Delete `test/landing-glare.mjs`**, run `node test/manual-landing.mjs && node test/landing-game.mjs && npm test && npm run check`. Expected: all green (the host still reads `game.input.step` until Task 3; it is only read on a key press, so no test breaks).

- [ ] **Step 6: Commit**: `git add -A && git commit -m "The flight model's bank axis (about z, toward +x; the thrust along d, the total angle for the verdict and the flare) and the tune's signature, burn key and stick; the stepped throttle and the glare's exposure ramp leave the tune" + the trailer.

---

### Task 2: The exhaust signature host

**Files:**
- Create: `src/fx/exhaust-signature.js`
- Modify: `src/fx/landing-glare.js` (the shader and `glareExposure` removed; the CSS fade only)
- Modify: `styles.css` (the signature's canvas and plate; `#landing-glare` keeps its rules)
- Modify: `ATTRIBUTIONS.md` (the launch plume section's last paragraph)
- Create: `test/exhaust-signature.mjs`

**Interfaces:**
- Produces: `signatureCameraY(t, { seconds, hold, yEnd })` pure; `startExhaustSignature(root, { seconds, hold, yEnd, reducedMotion, onSkip })` returning `{ tick(dt), done, dispose() }` or `null` when it will not play (reduced motion, no WebGL2, the shader fails to build) — the caller treats null as "no signature".
- `startLandingGlare(root, { seconds, reducedMotion })` keeps its name and shape, now always the CSS fade: opacity up over the first half, down over the second, `done` at `seconds`.

- [ ] **Step 1: The failing test** — `test/exhaust-signature.mjs`:

```js
// THE EXHAUST SIGNATURE (spec 10): the camera ramp is the 2D game's openingCameraY, pure, apart from the WebGL path
import assert from 'node:assert/strict';
import { signatureCameraY } from '../src/fx/exhaust-signature.js';
import { LANDING_GAME } from '../src/content/landing-game.js';
const S = LANDING_GAME.signature, y = (t) => signatureCameraY(t, S);
assert.equal(y(0), 2); assert.equal(y(S.hold), 2, 'held at 2 through the hold (the boosters close up)');
const run = S.seconds - S.hold - 0.4;   // the 2D game's ramp length: the last 0.4 s sit at the end value
assert.ok(Math.abs(y(S.hold + run * 0.55) - -8) < 1e-9, 'at 55 % of the ramp the camera is at -8');
assert.ok(Math.abs(y(S.hold + run * 0.7) - -8) < 1e-9, 'held at -8 to 70 %');
assert.equal(y(S.hold + run), S.yEnd, 'the end value at the ramp\'s end'); assert.equal(y(S.seconds), S.yEnd); assert.equal(y(99), S.yEnd);
assert.ok(Math.abs(y(S.hold + run * 0.275) - (2 - 10 * 0.5 * 0.5 * (3 - 2 * 0.5))) < 1e-9, 'a smoothstep from 2 to -8 over the first 55 %');
for (let t = S.hold; t < S.hold + run; t += 0.05) assert.ok(y(t + 0.05) <= y(t) + 1e-9, `never climbs (${t})`);
assert.ok(y(S.hold + run * 0.85) < -8 && y(S.hold + run * 0.85) > S.yEnd, 'geometric descent after 70 %');
assert.ok(Math.abs(y(S.hold + run * 0.85) - -8 * Math.sqrt(Math.abs(S.yEnd) / 8)) < 1e-6, 'the geometric midpoint');
console.log('exhaust-signature: ok');
```

Run: `node test/exhaust-signature.mjs` → FAIL (module not found).

- [ ] **Step 2: `src/fx/exhaust-signature.js`.** Move `FRAGMENT`, `VERTEX`, the header comments about the shader's origin and the `build(gl)` function out of `src/fx/landing-glare.js` into this file verbatim, with these changes to `build`: the uniform `uExposure` is set once to `1000` with the FIXED set (`FIXED = { uSteps: 100, uSquash: 0.3, uOctaves: 9, uTurb: 0.1, uCore: 2, uDetail: 6, uStepSize: 8, uExposure: 1000 }`), `uCam` is a per-draw uniform `draw(time, y, width, height)` setting `gl.uniform3f(uCam, 0, y, 7)`, the 1600 x 1000 cap stays, and a draw within 1/30 s of the last is skipped (`if (lastTime >= 0 && Math.abs(time - lastTime) < 1 / 30) return; lastTime = time;`). The context is `canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' })` (opaque: the frame under it must not show).

```js
// the 2D game's openingCameraY (Stalsfar_Landing/landing/lander.js), its constants from the tune: 2 through `hold`, a smoothstep to -8
// over the first 55 % of the ramp (seconds - hold - 0.4), held to 70 %, then geometrically to yEnd (black). Pure, so a node test pins it
export function signatureCameraY(t, { seconds, hold, yEnd }) {
  const p = Math.max(0, Math.min(1, (t - hold) / (seconds - hold - 0.4)));
  if (p >= 1) return yEnd;
  if (p <= 0.55) { const q = p / 0.55; return 2 - 10 * q * q * (3 - 2 * q); }
  if (p <= 0.7) return -8;
  return -8 * Math.pow(Math.abs(yEnd) / 8, (p - 0.7) / 0.3);
}
```

`startExhaustSignature(root, { seconds, hold, yEnd, reducedMotion = false, onSkip = null })`:
- returns `null` at once if `reducedMotion`, or if `document.createElement('canvas').getContext('webgl2', ...)` is null, or if `build` returns null (nothing is appended in those cases).
- builds `<div id="exhaust-signature" aria-hidden="false">` holding the `<canvas>` and a `<div class="es-plate">` with `<span class="es-eyebrow">SH02 / EXHAUST SIGNATURE</span><span class="es-subtitle">STÅLHEART · ARRIVAL CORRIDOR</span><a class="es-credit" href="https://github.com/pulkitxm/claude-directory/tree/main/shaders/launch-shader" target="_blank" rel="noreferrer">LAUNCH SHADER · PULKIT · MIT</a><button type="button" class="es-skip" data-skip-cinematic>SKIP CINEMATIC →</button>`, appended to `root`.
- `tick(dt)`: `t += dt; pipe.draw(t, signatureCameraY(t, tune), canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight); if (t >= seconds) this.dispose();`
- the keys: a capture-phase `keydown` listener on `window` registered at start and removed at dispose: `Escape` → `skip()`; every other key → `ev.preventDefault(); ev.stopImmediatePropagation();` (the rail's any-key skip must not fire under the black). The button's `click` → `skip()`. `skip()` calls `onSkip?.()` then `dispose()`.
- `dispose()`: idempotent; frees the pipe, loses the context, removes the element, removes the listener, sets `done = true`.

- [ ] **Step 3: `src/fx/landing-glare.js`** becomes the CSS fade only (≈25 lines): the header says "the override's plain fade (spec 10; the shader is the signature's, src/fx/exhaust-signature.js)"; `startLandingGlare(root, { seconds = 1.2 } = {})` creates `<canvas id="landing-glare" class="fade" aria-hidden="true">` (keep the element a canvas so the suite's `#landing-glare` selector holds; no context is created), `tick(dt)` sets `opacity = u < 0.5 ? u * 2 : 2 - u * 2`, disposes at `u >= 1`. Remove `glareExposure`, `FIXED`, `MAX_W/H`, `build`, the shader sources. Grep: `grep -rn "glareExposure\|reducedMotion" src test scripts` — the arrival's call passes `reducedMotion`; leave the arrival for Task 4 (an unknown option is ignored).

- [ ] **Step 4: `styles.css`** — after the `#landing-glare.fade` rule:

```css
/* THE EXHAUST SIGNATURE (src/fx/exhaust-signature.js): the 2D game's opening over the page, opaque; the plate as the 2D game's */
#exhaust-signature { position: fixed; inset: 0; z-index: 41; background: #000; }
#exhaust-signature canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#exhaust-signature .es-plate { position: absolute; inset: 0; padding: 32px; pointer-events: none; font-family: var(--font-ui); letter-spacing: 0.25em; background: linear-gradient(rgba(5, 11, 16, 0.47), transparent 20%, transparent 80%, rgba(5, 11, 16, 0.53)); }
#exhaust-signature .es-eyebrow { display: block; color: #ffe0a1; font-size: 11px; }
#exhaust-signature .es-subtitle { display: block; color: #b2aa96; font-size: 9px; letter-spacing: 0.2em; margin-top: 10px; }
#exhaust-signature .es-credit { position: absolute; left: 32px; bottom: 32px; color: #b2aa96; font-size: 9px; letter-spacing: 0.2em; text-decoration: none; pointer-events: auto; }
#exhaust-signature .es-skip { position: absolute; right: 32px; bottom: 32px; pointer-events: auto; font: inherit; font-size: 10px; letter-spacing: 0.2em; color: #ffe0a1; background: rgba(7, 18, 23, 0.7); border: 1px solid #b2aa96; padding: 10px 14px; cursor: pointer; }
@media (max-width: 700px) { #exhaust-signature .es-plate { padding: 18px; } #exhaust-signature .es-credit { left: 18px; bottom: 18px; } #exhaust-signature .es-skip { right: 18px; bottom: 18px; } }
```

- [ ] **Step 5: `ATTRIBUTIONS.md`** — the paragraph "The same shader is also drawn full-screen for the landing's override glare (`src/fx/landing-glare.js`) …" becomes "The same shader is drawn full-screen as the landing's EXHAUST SIGNATURE opening (`src/fx/exhaust-signature.js`): the 2D game's `landing/launch-plume.js` and its opening camera ramp (`openingCameraY`) from [jelaludo/Stalsfar_Landing](https://github.com/jelaludo/Stalsfar_Landing), source kept verbatim, MIT, Pulkit."

- [ ] **Step 6: Run** `node --check src/fx/exhaust-signature.js src/fx/landing-glare.js && node test/exhaust-signature.mjs && npm test && npm run check`. Expected: green.

- [ ] **Step 7: Commit**: "The exhaust signature host: the 2D game's opening (its shader, camera ramp, 30 Hz cap and plate) on its own opaque canvas, Esc or SKIP CINEMATIC skipping it; the override's glare reduced to its plain fade" + the trailer.

---

### Task 3: The stick: Space held, WASD, the floating mouse/touch stick, the pose with bank

**Files:**
- Create: `src/fx/landing-stick.js`, `test/landing-stick.mjs`
- Modify: `src/fx/manual-landing.js` (keys, pose, reading, input, state, pose(), the touch rail hooks)
- Modify: `src/fx/landing-hud.js` (`touch()`: BURN held, LEGS, SKIP), `styles.css` (`.lh-throttle` rule removed; the stick's ring)
- Modify: `src/labs/story-tab.js` line 127 (the status line's keys)
- Modify: `test/landing-hud.mjs` if it asserts the rail's children (read it first)

**Interfaces:**
- Consumes: `tiltTotal`, `bank` from Task 1; `LANDING_GAME.input.burnKey`, `.stick`.
- Produces: `stickRates(dx, dy, { dead, full })` → `{ tiltRate, bankRate }` (pure, exported): `r = hypot(dx, dy)`, `f = min(1, full / max(1, r))` clamps the throw to `full` px, then per axis `v = |a·f| < dead ? 0 : sign(a·f) · (|a·f| − dead) / (full − dead)`; `bankRate = v(dx)`, `tiltRate = −v(dy)` (a drag UP is the nose forward, +z). `createStick(root, { dead, full, enabled })` → `{ get tiltRate, get bankRate, reset(), dispose() }`: a `pointerdown` on `root` (mouse or touch; ignored when `enabled()` is false, when a pointer is already held, or when `ev.target.closest('button, a, input')`) captures the pointer, shows a `<div class="lh-stick"><i></i></div>` ring at the press point (appended to `document.body`), `pointermove` updates the rates through `stickRates` and the knob's transform, `pointerup/pointercancel/lostpointercapture/blur/resize` reset. The host's `host.input()` for the harness is unchanged in shape plus `bankRate`.

- [ ] **Step 1: The failing test** — `test/landing-stick.mjs`:

```js
import assert from 'node:assert/strict';
import { stickRates } from '../src/fx/landing-stick.js';
import { LANDING_GAME } from '../src/content/landing-game.js';
const S = LANDING_GAME.input.stick, r = (dx, dy) => stickRates(dx, dy, S);
assert.deepEqual(r(0, 0), { tiltRate: 0, bankRate: 0 });
assert.deepEqual(r(4, -4), { tiltRate: 0, bankRate: 0 }, 'inside the dead zone');
assert.ok(Math.abs(r(48, 0).bankRate - 1) < 1e-12 && r(48, 0).tiltRate === 0, 'a full throw right is bank +1');
assert.ok(Math.abs(r(-48, 0).bankRate + 1) < 1e-12, 'left is -1');
assert.ok(Math.abs(r(0, -48).tiltRate - 1) < 1e-12, 'a drag UP is the nose forward, +1');
assert.ok(Math.abs(r(0, 48).tiltRate + 1) < 1e-12, 'down is back');
assert.ok(Math.abs(r(200, 0).bankRate - 1) < 1e-12, 'clamped past the full throw');
assert.ok(Math.abs(r(26.5, 0).bankRate - 0.5) < 1e-9, 'linear past the dead zone: (26.5 - 5) / 43');
console.log('landing-stick: ok');
```

Run: `node test/landing-stick.mjs` → FAIL.

- [ ] **Step 2: `src/fx/landing-stick.js`** as in Interfaces. Header: "THE STICK (spec 10): the 2D game's floating thumb-stick (Stalsfar_Landing/landing/touch-pilot.js) with the mouse allowed and a second axis". `createStick` uses only `addEventListener` on the given root and `window`, and is never imported by a node test beyond `stickRates`.

- [ ] **Step 3: The host `src/fx/manual-landing.js`:**
- state: `held = { back: false, fwd: false, left: false, right: false, burn: false }`, `input = { throttle: null, legs: false }` → the harness's throttle is HELD: `let harnessThrottle = null` set by `input()`; the harness's rates `rate = { tilt: 0, bank: 0 }`.
- `keys(ev, down)`: `' '` (`game.input.burnKey`) → `held.burn = down`; `w`/`ArrowUp` → `held.fwd = down`; `s`/`ArrowDown` → `held.back = down`; `a`/`ArrowLeft` → `held.left = down`; `d`/`ArrowRight` → `held.right = down`; `l` → legs on down; else return (no prevent). Remove the `game.input.step` and `offerKey` branches.
- the stick: `const stick = createStick(globalThis.document?.body, { ...game.input.stick, enabled: () => phase === 'manual' || phase === 'override' })` created in `begin()` (so the lab and the game both get it) and disposed in `stopAll()`; a touch BURN button sets `held.burn`.
- `tick`: `const i = { throttle: held.burn ? 1 : (harnessThrottle ?? 0), tiltRate: ((held.fwd ? 1 : 0) - (held.back ? 1 : 0)) || stick.tiltRate || rate.tilt, bankRate: ((held.right ? 1 : 0) - (held.left ? 1 : 0)) || stick.bankRate || rate.bank, legs: input.legs };` — the throttle is a held set point every step now: drop the "consumed" clearing of `i.throttle`/`input.throttle` (keep the legs' consumption). In the override branch the set point is `s.set = i.throttle` each frame.
- `poseRocket`: `.multiply(tiltM.makeRotationZ(-s.bank)).multiply(m5.makeRotationX(s.tilt))` with a second scratch matrix `m5`; comment the order.
- `reading()`: `tilt: tiltTotal(s)`; `pose()` adds `bank`; `state()` adds `bank: +s.bank.toFixed(3)` and reports `tilt` as the total; the touched branch's verdict corrects the local normal as today AND passes the bank through (`{ ...s, tilt: s.tilt - atan2(...) }` already keeps `bank`).
- `input(i)`: `if (i.throttle != null) harnessThrottle = i.throttle; rate.tilt = clamp(i.tiltRate ?? 0); rate.bank = clamp(i.bankRate ?? 0); if (i.legs) input.legs = true;`
- `begin()`'s coarse rail: `hud.touch(true, { burn: (on) => { held.burn = on; }, legs: ..., skip: ... })`.
- header comment: the keys.

- [ ] **Step 4: `src/fx/landing-hud.js` `touch()`:** the rail is `mk('burn', 'BURN', () => h.burn?.(true), () => h.burn?.(false))`, `mk('legs', 'LEGS', ...)`, `mk('skip', 'SKIP', ...)`; the slider and the two tilt buttons go; the comment says "BURN held, LEGS, SKIP; the stick is on the scene (src/fx/landing-stick.js)". In `styles.css` drop `.lh-throttle`, give `.lh-btn.burn { flex: 1; }`, and add the stick's ring:

```css
/* THE STICK (src/fx/landing-stick.js): the floating ring at the press point, its knob at the clamped drag */
.lh-stick { position: fixed; width: 96px; height: 96px; margin: -48px 0 0 -48px; border: 1px solid rgba(79, 174, 99, 0.7); border-radius: 50%; pointer-events: none; z-index: 42; }
.lh-stick i { position: absolute; left: 50%; top: 50%; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; background: rgba(184, 255, 202, 0.6); }
```

- [ ] **Step 5: the lab line** `src/labs/story-tab.js:127`: `SPACE burn, W/S tilt, A/D bank, drag to steer, L legs.`

- [ ] **Step 6: Run** `node --check` on every edited file, `node test/landing-stick.mjs && node test/landing-hud.mjs && npm test && npm run check`; grep `game.input.step|offerKey` in `src/fx/manual-landing.js` → none.

- [ ] **Step 7: Commit**: "The stick: Space held is the burn, W/S tilt and A/D bank held, a floating mouse and touch stick on the scene (src/fx/landing-stick.js), the pose Rz(-bank)·Rx(tilt), the HUD's rail BURN / LEGS / SKIP, the harness's held throttle and bankRate" + the trailer.

---

### Task 4: The arrival plays the signature; the suite, STATE and the entry

**Files:**
- Modify: `src/fx/arrival.js` (start, landingTick, override, endFlight, the harness `landing()`, `state()`)
- Modify: `scripts/browser-test.mjs` (`--landing`)
- Modify: `docs/STATE.md` (the landing's section), a log entry via `node scripts/log.mjs add` (read `node scripts/log.mjs --help` or an existing entry in `docs/log/entries` for the shape), then `node scripts/log.mjs render`.

**Interfaces:**
- Consumes: `startExhaustSignature`, `startLandingGlare` (Task 2); `landing('input', { throttle, tiltRate, bankRate, legs })` (Task 3).
- Produces: `landing('skip')` during the signature skips the signature and returns `'signature'`; `state().arrival.signature` is `true` while it plays, else `false`; `state().arrival.landing.bank`.

- [ ] **Step 1: `src/fx/arrival.js`:**
- `let signature = null;` beside `glare`. In `start()`, after `phase = 'landing'; t = 0;`: `if (manual && globalThis.document?.body) { signature = startExhaustSignature(globalThis.document.body, { ...LANDING_GAME.signature, reducedMotion: still, onSkip: () => { signature = null; } }); if (signature) { thrust ??= api.sfx?.loop('rocket_thrust', { dist: 0, gain: 0 }); thrust?.set(1, 1); } }` (the thrust bed under the boosters; `sound()` takes it over at the approach's first frame).
- `landingTick(dt)`: first line `if (signature) { signature.tick(dt); if (!signature.done) return; signature = null; }` — the clock holds.
- `override()`: `glare = startLandingGlare(globalThis.document.body, { ...LANDING_GAME.override.glare })` (no `reducedMotion`).
- `endFlight`: dispose `signature` too (a skip of the whole arrival while it plays: `release()`/`finish()` paths — find where `endFlight(true)` runs and make sure the signature cannot outlive the arrival).
- the harness: `if (cmd === 'skip') { if (signature) { signature.skip(); return 'signature'; } ... }` — give the host a public `skip()` on the signature object (Task 2's `skip` is internal: expose it).
- `state()`: `signature: !!signature`.
- Comments: the phase diagram in the file header gains SIGNATURE before APPROACH for a flown landing.

- [ ] **Step 2: `scripts/browser-test.mjs` `--landing`:**
- `toManual`: after the arrival began and `manual` is asserted: `await until(`${A}.signature===true`,10000).catch(()=>why('the signature plays'))`; assert `!!document.querySelector('#exhaust-signature canvas')` and that the plate's text matches `/EXHAUST SIGNATURE/`; on the FIRST page only (`landing-clean`) wait for it to end on its own: `await until(`${A}.signature===false`,15000)` and assert `t` stayed under 0.5 s while it played (read `${A}.t` right after the signature flag turns true and expect `< 0.5`) and take a still at ~1 s in (`current='landing-signature'; await finish();` — the existing still helper; make sure `finish()` does not end the page: read how `landing-manual` takes its still mid-run); on the other pages skip it with `landing('skip')` and assert the return `'signature'`.
- the glare assertion stays (`#landing-glare` under the override).
- `PILOT`: `throttle` as before (now held until the next call: pass it every frame as it does), add `bankRate:Math.max(-1,Math.min(1,-L.x*0.05-(L.driftAcross??0)*0.1))` — no, the harness `state` has no driftAcross: use `bankRate:Math.max(-1,Math.min(1,(-L.x*0.02)-(L.bank*4)))`, which keeps x near 0 against the (zero) wind; the clean flight must still land CLEAN: if the bank loop fights the landing, set `bankRate:0` and note it.
- the wreck page: no input; the skip page as before; the offer pages: `landing('skip')` may now return `'signature'` first: loop `while ((await evaluate(`${T}.landing('skip')`))==='signature') await delay(100);` before asserting the flight's skip.
- a new assertion on the clean page after MANUAL: `landing('input',{bankRate:1})` for 500 ms then read `state().arrival.landing.bank > 0`, then `bankRate:0`.

- [ ] **Step 3: Run the suite** through the lock: `scripts/browser-lock.sh node scripts/browser-test.mjs --landing` (and `--story` to confirm an automatic landing shows no signature: add one assertion there that `#exhaust-signature` is absent at the arrival's start). Fix until green; paste the suite's summary lines in the report.

- [ ] **Step 4: STATE and the entry** — in `docs/STATE.md` the landing's section: the signature opens a flown landing; Space held is the burn; W/S tilt, A/D bank, the stick; the override's fade; the open calls (the signature before an automatic landing; the mouse sense). The log entry titled "the landing's morning: the exhaust signature and the stick".

- [ ] **Step 5: Commit**: "The arrival opens a flown landing with the exhaust signature (the clock held, the thrust bed under it, Esc or SKIP CINEMATIC to the approach), the override under the plain fade; --landing asserts the signature, the held throttle and the bank; STATE and the entry" + the trailer.
