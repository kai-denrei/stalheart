# THE LANDING: the side view, three controls, the hand-over in motion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Section 14 of `docs/superpowers/specs/2026-11-07-landing-mini-game-design.md`: the flown landing is a 2D game seen from a fixed-angle side camera with the accretion disk behind, flown with Space, A and D only, and it opens straight out of the signature with the rocket already moving and burning.

**Architecture:** Task 1 removes section 13's bank axis, stick and mouse (domain, host, HUD, suite) and retunes the entry. Task 2 gives the host (`src/fx/manual-landing.js`) the side view: a flight frame turned toward the disk's azimuth, a fixed line of sight, a dolly. Task 3 makes the arrival (`src/fx/arrival.js`) hand over in motion: no orbit rail on a flown landing, the flight shot under the signature, the auto-lander's burn through the override beat. `src/td-tab.js` is NOT touched (`storyApi.scene` already exists).

**Tech Stack:** three.js r160 vendored, native ESM; node tests `npm test`; browser harness `scripts/browser-test.mjs` only through `scripts/browser-lock.sh`.

## Global Constraints

- `src/domain` never imports `src/content`. `src/td-tab.js` untouched. `node --check` every edited JS file; `npm test` and `npm run check` green at every commit.
- Commits as Kai Denrei, each message ending with the exact line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never push.
- Browser suites only via `scripts/browser-lock.sh node scripts/browser-test.mjs --landing`, one at a time, never editing `src` while one runs; a load timeout is a syntax error.
- Keys in flight: Space held = burn; `A` / `ArrowLeft` tilt left (the rocket's nose toward the camera's left, −x of the flight frame), `D` / `ArrowRight` right (+x); `L` legs; `Esc` the skip. Nothing else.
- The flight frame: the model's +x is the camera's RIGHT, +y up, +z the line of sight AWAY from the camera (toward the disk). The tilt is about the frame's z, positive toward +x (so the thrust direction is `(sin tilt, cos tilt, 0)`). The host converts flight-frame metres to island metres with a rotation about y by the azimuth at its boundary: `pose()`, the reticle, `view()`, `state().x/z`, and the arrival's `landed` all see ISLAND metres.
- The camera's line of sight is fixed (level, toward the disk); only its position moves: eye = (rocket ground x in the frame, `camera.up + camera.upPerMetre × altitude`, `−(camera.back + camera.backPerMetre × altitude)`) in the flight frame, looking along +z. `fov` from the tune. If the sky-hole planes are missing (a lab, a page without the sky), azimuth 0 (+z toward the pole as before).
- The entry: drift [4, 7], tilt [0.15, 0.25]; `override.seconds` 1.5.
- A flown landing: no `arrival` rail shot before the flight; the `arrivalFlight` shot starts in `start()` under the signature; the flight `begin()`s when the signature ends or is skipped; during the override beat the physics RUN with the throttle forced to 1; then MANUAL. An automatic landing is unchanged.

---

### Task 1: Three variables: the bank, the stick and the mouse go; the entry retuned

**Files:**
- Modify: `src/domain/manual-landing.js` (remove `bank`, `bankRate`, `tiltTotal`; the thrust along `(sin tilt, cos tilt)` in the x–y plane — see the frame note below)
- Modify: `src/content/landing-game.js` (`input` → `{ skipKey: 'Escape', burnKey: ' ' }`, `entry.drift` [4, 7], `entry.tilt` [0.15, 0.25], `override.seconds` 1.5)
- Modify: `src/fx/manual-landing.js` (keys A/D only + Space + L; no stick; the pose `Rz(−tilt)`… see below; `state()` without `bank`/`lean`; `pose()` without `bank`)
- Modify: `src/fx/landing-hud.js` (`touch()`: `◂` `▸` BURN LEGS SKIP: `mk('tilt-left', '◂', () => h.tilt?.(-1), () => h.tilt?.(0))`, `mk('tilt-right', '▸', ...)`, then BURN (held, pointer-captured as now), LEGS, SKIP)
- Delete: `src/fx/landing-stick.js`, `test/landing-stick.mjs`
- Modify: `styles.css` (drop `.lh-stick` rules; keep `touch-action: none`), `src/labs/story-tab.js` (the status line: `SPACE burn, A/D tilt, L legs.`; keep the `controls.enabled` toggle)
- Modify: `test/manual-landing.mjs` (the bank tests removed; the pose test now `Rz(−tilt)` applied to (0,1,0) = `(sin tilt, cos tilt, 0)`), `test/landing-game.mjs` (the stick/bank assertions removed; assert the new entry ranges, `override.seconds === 1.5`, `input` deep-equals `{ skipKey: 'Escape', burnKey: ' ' }`), `test/landing-hud.mjs` (the rail's five labels and the tilt hooks ±1 / 0)
- Modify: `scripts/browser-test.mjs` `--landing` (the drag/stick assertion removed; the pilot's `bankRate` removed; the pilot's tilt sign — see Task 2's frame; keep the real-Space assertion)
- Modify: `docs/STATE.md`, the spec's section 13 gets a one-line "superseded by section 14 (the stick, the bank and the mouse)" note at its top.

**The frame note (binds Tasks 1-3):** the flight frame's drift axis becomes x (the camera's right), not z. In the domain: `createLanding` puts the entry's drift on `vx` (`vz: 0`), the tilt is about z toward +x: `s.vx += (Math.sin(s.tilt) * T + s.wind − drag·vx|vx|) dt`, `s.vy += (Math.cos(s.tilt) * T − g − …) dt`, `s.vz += (−drag·vz|vz|) dt`. The header says so. `predictImpact`, `verdict`, `flareDue`, `flareStep` unchanged in shape (`Math.abs(s.tilt)`). The host's pose: `h.matrix.copy(placed).premultiply(translation).multiply(tiltM.makeRotationZ(−s.tilt))` (maps the hull's up to `(sin tilt, cos tilt, 0)`; the node test checks it). The reticle's stretch rotation `Math.atan2(s.vx, s.vz)` still holds. The verdict's local-normal correction is now along x: `tilt: s.tilt − Math.atan2(g.normal[0], g.normal[1])`. The arrival's `landed` and `floorAt` are symmetric and unchanged. In this task the frame is NOT yet turned toward the disk (Task 2): the model's x is the island's x.

- [ ] **Step 1: tests first.** Rewrite the bank tests in `test/manual-landing.mjs` as drift-on-x tests: a +0.3 tilt at full burn gives `vx > 0`, `vz` unchanged; the pose test as above; `createLanding(entry).vx === entry.drift` and `vz === 0`. `test/landing-game.mjs` as in Files. `test/landing-hud.mjs`: the five labels in order, `['tilt', -1]` on ◂ pointerdown then `['tilt', 0]` on pointerup. Run each: FAIL.
- [ ] **Step 2: implement** per Files and the frame note. `grep -rn "bank\|lean\|stick\|Stick\|tiltTotal" src test scripts docs/STATE.md` must show only history lines in STATE/log entries (leave the log entries alone: they are immutable).
- [ ] **Step 3:** `node --check` each file, `npm test`, `npm run check`, then `scripts/browser-lock.sh node scripts/browser-test.mjs --landing` (the suite's pilot: `want = clamp(−L.x·0.3, −6, 6)`, `e = want − L.vx`… it reads `L.x` and a new `vx` in `state()` — add `vx: +s.vx.toFixed(2)` beside `vz`). Green.
- [ ] **Step 4: Commit** "Three variables: the bank, the stick and the mouse leave the landing (spec 14 B); the drift on the frame's x; the entry 4-7 m/s and 0.15-0.25 rad; the override beat 1.5 s; the rail ◂ ▸ BURN LEGS SKIP" + the trailer.

---

### Task 2: The side view

**Files:**
- Modify: `src/fx/manual-landing.js` (the flight frame turned by `azimuth`; the fixed-angle dolly replaces `chase`; `view()`)
- Modify: `src/content/landing-game.js` (`camera: { back: 20, backPerMetre: 0.95, up: 10, upPerMetre: 0.5, fov: 58, lag: 0.12, jolt: 0.8 }` — `side`, `lookReach` go; comment the measured values)
- Modify: `src/fx/arrival.js` (passes `azimuth` to the host, computed once in `start()` from `api.scene?.getObjectByName('sky-hole')?.userData.hole?.dir`: the world unit vector turned into the island frame with `inv` as a DIRECTION (`new THREE.Vector3(...dir).transformDirection(inv)`), `azimuth = Math.atan2(d.x, d.z)` (radians about the island's up, 0 = +z toward the pole); 0 when absent)
- Modify: `src/labs/story-tab.js` (`startFlight` passes `azimuth: 0` and uses the host's camera as the game does, if it does today; read it)
- Modify: `scripts/browser-test.mjs` (`--landing`: the still `landing-manual` plus a new assertion that the disk is in frame: read `document.documentElement.dataset.skyHole` or project the sky-hole planes' world direction through `state().arrival.eye`… simplest: in the page, `(()=>{const T=window.__stalheartTest;return T.skyInFrame?.()})()` does not exist; instead compute in the page with three.js already loaded? NOT available as a global. Do this: the arrival's `state()` gains `disk: [ndcX, ndcY]`, the sky-hole direction projected through the camera (`new THREE.Vector3(...dir).add(camera.position).project(camera)` on a far point: `dir × 1e5 + camera.position`), null without the planes. The suite asserts `Math.abs(disk[0]) < 1 && Math.abs(disk[1]) < 1` at the MANUAL still and at ~50 m.)
- Modify: `test/manual-landing.mjs` or a new `test/landing-frame.mjs`: a pure helper `turnFrame(p, azimuth)` exported from the host? The host is DOM-free at import (it imports three.js, fine under node: `test/arrival.mjs` does). Export `flightToIsland([x, y, z], azimuth)` and `islandToFlight` from `src/fx/manual-landing.js` and test: azimuth 0 is identity; azimuth π/2 maps flight +x to island +z… define precisely: island = Ry(azimuth) · flight, where Ry turns +z toward +x for a positive angle (three.js's `makeRotationY`). So the flight's +z (the line of sight) in island metres is `(sin az, 0, cos az)` = the disk's azimuth direction. Test that for az = atan2(dx, dz) of a sample direction, `flightToIsland([0,0,1], az)` is that direction's unit (x, z).

**Interfaces:**
- Consumes: Task 1's frame (drift on x, tilt about z).
- Produces: `createManualLanding({ …, azimuth })`; `chase(out)` keeps its name (the shot's poseAt) but is the dolly; `flightToIsland`, `islandToFlight` exports; `state().arrival.disk`.

- [ ] **Step 1: the frame test** (above) — FAIL, then export the two helpers.
- [ ] **Step 2: the host.** All model math stays in the flight frame. Convert at the boundary: `toWorldF = (p, out) => toWorld(flightToIsland(p, azimuth), out)` used by `poseRocket`, the reticle placement (`reticle.position` and the ground query: `floorAt` is symmetric, call it with the island coords), the camera, `view()`; `pose()` and `state()` return island metres for x/z (`flightToIsland`), and the velocities as the frame's (`vx` the screen drift). The rocket's tilt rotation in world: the hull's holder matrix is `placed` (island frame): the tilt about the FLIGHT z axis must be turned too: `rot = Ry(azimuth) · Rz(−tilt) · Ry(−azimuth)` applied in the holder's frame — build it with three matrices once per frame. The node pose test from Task 1 extends: at azimuth π/2 the hull's up maps to `flightToIsland([sin t, cos t, 0])`.
- [ ] **Step 3: the dolly** (`chase(out)`): eye in the flight frame = `(follow.x, c.up + c.upPerMetre × max(0, follow.y), −(c.back + c.backPerMetre × max(0, follow.y)))`, look = eye + (0, 0, 1) i.e. level along +z; both through `toWorldF`; `m4.lookAt(eye, look, up)`. `follow` lerps the rocket's x and y at `camera.lag` as now. The fov from the tune.
- [ ] **Step 4: measure** in the browser: `--landing`'s stills at MANUAL (~350 m), ~100 m, ~20 m (add two stills `landing-side-100`, `landing-side-20` on the skip page before its skip) and the `view()` NDCs printed; adjust `back/backPerMetre/up/upPerMetre` so the feet and the hull's top are within ±0.9 NDC at 350 m and the pad's centre is in frame at every height; write the measured numbers in the tune's comment. Assert the disk in frame as in Files.
- [ ] **Step 5:** `npm test`, `npm run check`, `--landing` green. **Commit** "The side view (spec 14 A): the flight frame turned to the disk's azimuth, a fixed level line of sight with a dolly, the disk in the harness's state" + the trailer.

---

### Task 3: The hand-over in motion

**Files:**
- Modify: `src/fx/arrival.js` (`start()`: on a flown landing no `arrival` rail shot and no `apply(0, 0)` picture; the `arrivalFlight` shot started at once (its poseAt the host's `chase`, the host created before: `flying` exists from the start today); `landingTick`: when the signature ends or is skipped → `override()` (which `begin()`s the flight: the rocket placed at the entry's state), not `t >= overrideAt`; the override beat: the host steps the physics with the throttle forced to 1; the mission card deferral and the rail's lengthening from section 13 are no longer needed on a flown landing (the rail is not started): remove what is dead, keep what the automatic landing uses)
- Modify: `src/fx/manual-landing.js` (`tick()`'s override branch: `while (acc >= dt) step(s, { throttle: 1, tiltRate: i.tiltRate, legs: i.legs }, dt, game)` — the auto-lander's last burn, the tilt keys live so the player can already lean; `begin()` sets `s.throttle = 1; s.set = 1` so the boosters are lit on the first frame)
- Modify: `src/content/landing-game.js` (`approach` block: keep for the automatic sequence's tune if `STORY_ARRIVAL_MANUAL` reads it — read `src/content/story-defaults.js`; otherwise retire `overrideAt`/`deployAltitude` with a comment; `override.seconds` 1.5 from Task 1)
- Modify: `scripts/browser-test.mjs` `--landing` (`toManual`: after the signature ends, the landing's phase is `override` with `throttle > 0.5` and `altitude` decreasing within 0.5 s; no `shot === 'arrival'` expectation on a flown page: the shot is `arrivalFlight` from the start; the "a W under the signature does nothing" assertion checks `shot === 'arrivalFlight'` instead; the automatic page still has the rail)
- Modify: `test/landing-game.mjs` (whatever read `approach.overrideAt`), `docs/STATE.md`, a log entry (`node scripts/log.mjs add …`, then `render` and `check`), the spec's section 13 C/8 text where it says the approach follows the signature.

- [ ] **Step 1:** read `start()`, `landingTick()`, `override()`, `touchdown()`, `endFlight()` and `state()` in `src/fx/arrival.js`, and the host's `begin()`/`tick()`.
- [ ] **Step 2:** implement per Files. The harness: `landing('skip')` under the signature still returns `'signature'` and then the flight begins at once.
- [ ] **Step 3:** `npm test`, `npm run check`, `--landing` green (paste its summary), then `--story-world` once (known flake on the Rotor-kill step: rerun once if it is that step).
- [ ] **Step 4: Commit** "The hand-over in motion (spec 14 C): a flown landing opens on the side view out of the signature with the rocket sinking and the boosters lit, the auto-lander's last burn through the 1.5 s alarm, no orbit rail; STATE and the entry" + the trailer.
