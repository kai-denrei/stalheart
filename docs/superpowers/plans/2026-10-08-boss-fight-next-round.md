# The boss fight's next round: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the airborne friendlies protect the tank: the gunship's rotary at the creature, its Bofors in front, its MK-9 behind; SOL a tracking wall in front; a creature frightened by what lands and stunned by the nuke; six obstacles (four the nuke breaks) that block the tank, that the creature steers round and is pushed out of.

**Architecture:** every rule is pure domain with a node test: `src/domain/boss-fight.js` (the four-gun schedule and the aims), new `src/domain/boss-fear.js` (frights and the stun), new `src/domain/boss-arena.js` (footprints, the tank's blocker, routing, the push-out, destruction, the clear respawn); the numbers in `src/content/boss-fight.js`. The lab translates only: `src/labs/boss/friendlies.js` draws and resolves the plans, new `src/labs/boss/fear.js` and `src/labs/boss/arena.js` apply the rules to the creature and the scene, `src/labs/boss-tab.js` composes. The ported kit `src/fx/nih-dairia/*` and the game controller are untouched.

**Tech Stack:** native ESM, vendored three r160, lil-gui, node tests (`npm test` runs every `test/*.mjs`), the browser harness (`scripts/browser-test.mjs`).

Spec: `docs/superpowers/specs/2026-10-08-boss-fight-next-round-design.md` (the contract, numbers included; read it first). The prototype it extends: `docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md`. The lab: `src/labs/boss-tab.js` (878 lines), `src/labs/boss/{drive,cannon,friendlies,round}.js`.

## Global Constraints

- Worktree `/Users/minikai/Dev/stalheart-refactor-run`, branch `refactor-run`. Never push, never merge. One commit per task (a task may make more if it says so); the message in the project's register (a plain sentence or two, no prefixes), a blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git config user.email` must be `270854086+kai-denrei@users.noreply.github.com`.
- Layers: `src/domain/boss-*.js` import only domain (`./gunship.js`'s `splashDamage`); `src/content/boss-fight.js` imports nothing; `src/labs/boss/*.js` import `src/fx`, `src/content`, `src/domain`, `src/labs`, the vendored three and the shared builders the labs already import; never `td-tab.js`. `npm run architecture` enforces it (gotchas: domain cannot import content; the word `window` in an inline comment is flagged). `src/fx/nih-dairia/*` is not modified; a task that needs it stops and reports NEEDS_CONTEXT.
- Positions in the rules are local metres on the frame's plane `[x, z]`; the creature's native units are `local / scale` (the lab's `creatureNow()` shows the mapping: `local = native * scale` on x, y and z).
- After every edit of a `src` file: `node --check <file>`. Before each commit: `npm test`, `npm run check`, `npm run build` green.
- The browser: one Chrome, headless, memory checked first (`~/scripts/check-memory.sh`); never edit `src` while a browser suite serves the tree; browser runs go through the harness's lock. Headless advances the game clock slowly: wait on the fight's clock with a real-time cap.
- No console logging. Tests are node programs with named bounds and one summary line.
- The game's numbers are read from their owners (`GUNSHIP_GUNS`, `GUNSHIP_AUTO`, `GUNSHIP_NUKE` in `src/content/gunship.js`); the fight's copies in content are held equal to them by the node test.

---

### Task 0: The body's rules move out of boss-tab.js

**Files:**
- Create: `src/labs/boss/body.js`
- Modify: `src/labs/boss-tab.js` (lines ~220-290: `circleInput`, `projectBody`, `bodyBlocker`, the shell's hit test and the shove near line 391)

**Interfaces:**
- Produces: `createBodyRules({ getCreature, getScale, getNative, drive, tune })` returning `{ project(), blocker(x, z) -> null | { nx, nz, depth }, circleInput(radius) -> { throttle, turn, cruiseTap }, shellHit(localPoint) -> null | { node, point }, shove(localPoint) }` — the exact names may follow the moved code, but every later task calls the blocker as `body.blocker(x, z)` and the circle as `body.circleInput(radius)`.

- [ ] **Step 1:** read `src/labs/boss-tab.js` in full. List every function that reads the body's nodes for the lab's rules (the blocker, `projectBody`, the circle controller, the shell's hit test, the shove).
- [ ] **Step 2:** move them verbatim into `src/labs/boss/body.js` behind one factory; the state they share (the projected nodes, `scale`, `native`, the drive) comes in through getters so a creature reload or a size change is seen. Header comment in the style of `src/labs/boss/drive.js` naming the spec section 0.
- [ ] **Step 3:** `boss-tab.js` calls the factory and uses its methods; no behaviour change. `node --check` both.
- [ ] **Step 4:** `npm test`, `npm run check`, `npm run build`; then from a snapshot, `node scripts/browser-test.mjs --boss` and `--boss-fight` green (both are the regression for this task).
- [ ] **Step 5: Commit** — `The boss lab's body rules (the blocker, the projected nodes, the circle controller, the shell's hit and the shove) move to src/labs/boss/body.js; no behaviour change`.

---

### Task 1: The four guns' schedule and aims (content + domain)

**Files:**
- Modify: `src/content/boss-fight.js`
- Modify: `src/domain/boss-fight.js`
- Modify: `test/boss-fight.mjs`

**Interfaces:**
- Produces (content) — `BOSS_FIGHT` gains, deep-frozen:
  ```js
  front: 10, behind: 15, margin: 2,
  rotary: { radius: 8, dps: 6.6 },                                   // 0.8 cells; 30 rounds/s x 0.22
  bofors: { burst: 2.6, rest: 1.4, rate: 2.4, damage: 4, radius: 22, travel: 2.6 },   // unchanged
  nuke: { every: 20, radius: 55, damage: 60, travel: 4.2, stun: 1.5 }, // heavy: reload, 5.5 cells, freeFall + drive
  sol: { every: 8, aim: 1.5, burn: 6, dps: 10, radius: 8 },          // burn 6 (was 2)
  ```
  (`fear`, `wall`, `arena` are added by Tasks 2 and 3.)
- Produces (domain):
  - `schedule(state, now, creature, tune, tank)` — `tank = { pos: [x, z], radius }` (new fifth argument; omitted means far away `{ pos: [1e6, 0], radius: 0 }`). Plans:
    - `{ kind: 'rotary', at, radius: rotary.radius, damage: rotary.dps, showAt: t, fireAt: land, land: t + warn, until: land + burst, moving: true }`, one per rotary burst, made at the burst's start `t`;
    - `{ kind: 'bofors', at, radius, damage, showAt, fireAt, land, until: land }` as before, the point from `frontAim`;
    - `{ kind: 'nuke', at, radius: nuke.radius, damage: nuke.damage, showAt: t, fireAt: t, land: t + nuke.travel, until: land }`, every `nuke.every` from `nuke.every`, the point `c - u * behind`;
    - `{ kind: 'sol', at, radius, damage: sol.dps, showAt, fireAt: land, land, until: land + burn, moving: true, spares: true }`.
  - `aimNow(plan, creature, tank, tune) -> [x, z]` for a `moving` plan: rotary: the contact farthest from `tank.pos` (the centre if no contacts); sol: `solPoint` (below).
  - `lineOf(creature, tank) -> { c, u, e }`: `u` the unit from the centre to the tank (`[0, 1]` under 1 m), `e` the front edge's projection (max of `(contact - c) · u`, 0 with no contacts).
  - `burn(state, plan, dt, creature, tank)` reports `tankHit: false` when `plan.spares`.
  - `state.byKind = { rotary, bofors, nuke, sol }` — damage dealt per shooter, added by `harm`; reset with the fight; `readout(state)` returns it.
  - The cadence: `state.gun = { phase: 'burst' | 'rest', gun: 'rotary' | 'bofors', left, nextRound, rounds }` replaces `state.bofors`; the first burst is the rotary's; after each rest the gun flips. `state.nuke = { next: nuke.every }` counts like SOL's clock. `tune.rotary.enabled === false`, `tune.bofors.enabled === false`, `tune.nuke.enabled === false` drop that gun's plans and keep its cadence.

- [ ] **Step 1: the tests first** (extend `test/boss-fight.mjs`; keep the existing asserts that still hold, rewrite the ones the spec changes):
  - the copies: `T.rotary.radius === GUNSHIP_GUNS.rotary.dangerCells * 10`, `Math.abs(T.rotary.dps - GUNSHIP_GUNS.rotary.rate * GUNSHIP_GUNS.rotary.damage) < 1e-9`, `T.nuke.radius === GUNSHIP_GUNS.heavy.blastCells * 10`, `T.nuke.travel === GUNSHIP_GUNS.heavy.travel`, `T.nuke.every === GUNSHIP_GUNS.heavy.reload`;
  - the cadence over 30 s with the tank far (`[500, 0]`): rotary plans at bursts 0, 2, 4, … (`land` = `k * 2 * cycle + warn` for the k-th), Bofors rounds only inside the odd bursts with the old gaps inside a burst; the nuke's lands at `20 + 4.2` (one in 30 s); SOL's at `8 + 1.5` and `16 + 1.5`, each `until = land + 6`;
  - the front aim: with the creature at the origin on the 44 `feet` and the tank at `[0, 60]`, every Bofors `at` satisfies `(at - c) · u` ≈ `e + front` (within 1e-9 after removing the perpendicular jitter: assert `|at[1] - (e + 10)| < 1e-9` since `u = [0, 1]`) and `|at[0]| <= scatter * radius`; with the tank at `[0, 30]`, every Bofors `at` is at least `radius + hull + margin` from the tank or at `c` along the line (`at[1] === 0`);
  - the nuke: with the tank at `[0, 60]`, `at` ≈ `[0, -15]`; with the tank at `[0, 20]`, still `[0, -15]` (no clamp) and `resolveLanding` reports `tankHit: true`;
  - `aimNow` rotary: with the tank at `[100, 0]`, returns the foot with the smallest x (`[-15.55, -0.35]`); moving the tank to `[-100, 0]` returns the foot with the largest x;
  - `aimNow` sol: with the tank at `[0, 60]`, `[0, e + 10]`; with the tank at `[0, e + 12]` (gap too small), `[0, e]` (the hug); `burn` on that plan with the tank inside reports `tankHit: false` and damage on a contact inside;
  - the switches: `rotary.enabled: false` makes no rotary plans and the Bofors bursts still come on the odd slots;
  - `byKind` sums to `state.damage`;
  - the balance, held still: replace the old loop with one that handles all four kinds (`rotary` and `sol`: each frame between `land` and `until`, `plan.at = aimNow(...)` then `burn`; `bofors` and `nuke`: `resolveLanding` at `land`), the tank far; record `killedAt` and assert it lies in `[15, 40]` (a wide guard: Task 7 sets the final health and tightens the bound to the measured value ± 20 %); print it in the summary line.
- [ ] **Step 2:** run `node test/boss-fight.mjs`: fails.
- [ ] **Step 3: content.** Add the numbers above with a comment per line naming the game's source.
- [ ] **Step 4: domain.** Implement as specified. The helpers (exported where a later task or the test needs them):
  ```js
  export function lineOf(creature, tank) {
    const c = creature.centre, dx = tank.pos[0] - c[0], dz = tank.pos[1] - c[1], d = Math.hypot(dx, dz);
    const u = d < 1 ? [0, 1] : [dx / d, dz / d];
    let e = 0;
    for (const p of creature.contacts ?? []) e = Math.max(e, (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]);
    return { c, u, e };
  }
  // the point `s` metres along the line, slid back toward the centre in 0.5 m steps until it is `keep` metres from the
  // tank; null when even the centre is too close
  function clearAlong(c, u, s, side, tank, keep) {
    for (let k = s; k >= 0; k -= 0.5) {
      const p = [c[0] + u[0] * k + side[0], c[1] + u[1] * k + side[1]];
      if (Math.hypot(p[0] - tank.pos[0], p[1] - tank.pos[1]) >= keep) return p;
    }
    return null;
  }
  ```
  The Bofors' point: the lead applied to the centre as before (`c' = c + v * lead * (land - t)`), `{ u, e } = lineOf`, the jitter `j = scatter * radius * sqrt(((k % 8) + 0.5) / 8) * cos(k * 2.399963)` across the line (`side = [-u[1] * j, u[0] * j]`), `clearAlong(c', u, e + front, side, tank, radius + tank.radius + margin) ?? [c'[0] + side[0], c'[1] + side[1]]`. The nuke: `c' - u * behind`, no jitter. SOL at planning: `solPoint`; `solPoint(creature, tank, tune) = clearAlong(c, u, e + front, [0, 0], tank, sol.radius + tank.radius + margin)`, and when that is null or lies behind the front edge (`(p - c) · u < e`), the hug `c + u * e`. Rotary at planning: `aimNow`. Keep the header comment current (the four guns, the line, the clamps).
- [ ] **Step 5:** test green; `npm test`, `npm run check`, `npm run build`. Note: `src/labs/boss/friendlies.js` still calls `schedule` with four arguments and draws only `bofors`/`sol`; it stays working (the tank defaults far, rotary and nuke plans are ignored by the lab until Task 4, which is acceptable for one commit — the lab must still load: open the lab after the build if a dev server runs, otherwise rely on `--boss-fight` in Task 4).
- [ ] **Step 6: Commit** — `The boss fight's rules fire the gunship's three guns: the rotary's stream at the foot farthest from the tank, the Bofors in front of the creature clear of the tank, the MK-9 behind it; SOL tracks in front and never takes the tank; damage per shooter`.

---

### Task 2: The fright and the stun (content + domain)

**Files:**
- Modify: `src/content/boss-fight.js`
- Create: `src/domain/boss-fear.js`
- Create: `test/boss-fear.mjs`

**Interfaces:**
- Produces (content): `fear: { reach: 8, bofors: 1.2, after: 0.8, flee: 20, cooldown: 1, weight: { sol: 2, bofors: 1 } }`.
- Produces (domain, `src/domain/boss-fear.js`, imports nothing):
  - `makeFear() -> { threats: Map<key, { at, weight, until }>, stunUntil: -Infinity, lastDisturb: -Infinity, frights: 0, stuns: 0 }`
  - `inReach(at, radius, contacts, reach) -> boolean` — the nearest contact within `radius + reach`.
  - `frighten(fear, key, at, kind, seconds, now, tune) -> { fresh, disturb }` — adds or renews the threat `key` (a renewal updates `at` and extends `until` to `now + seconds`); `fresh` is true when no threat was live at `now` before the call (then `frights++`); `disturb` is `fresh && now - lastDisturb >= tune.fear.cooldown` (then `lastDisturb = now`).
  - `stun(fear, now, tune) -> { disturb: true }` — `stunUntil = now + tune.nuke.stun`, `stuns++`, `lastDisturb = now`.
  - `fearNow(fear, now, c, u, tune) -> { mode: 'hunt' | 'flee' | 'stun', point }` — drops threats with `until <= now`; `stun` while `now < stunUntil` (`point: null`); else `flee` with `point = c + flee * normalize(Σ weight * (c - at) / |c - at|)` (a zero sum, or a threat at the centre, falls back to `-u`); else `hunt` (`point: null`).
  - `clearFear(fear)` — empties the threats and ends the stun (the round's reset).

- [ ] **Step 1: the tests first** (`test/boss-fear.mjs`): `inReach` true for a contact at `radius + reach - 0.01`, false at `+ 0.01`; a Bofors fright at `t = 0` for 1.2 s: `fearNow` at 1.19 is `flee`, at 1.21 `hunt`; the flee point for a threat at `[0, 10]` with `c = [0, 0]` is `[0, -20]`; two threats at `[10, 0]` (sol, weight 2) and `[0, 10]` (bofors, weight 1) give a point along `normalize([-2, -1]) * 20`; a threat at the centre falls back to `-u * 20`; a renewal (same key, new `at`) moves the threat and is not `fresh`; `disturb` false for a fresh fright 0.5 s after the last disturb, true after 1.0 s; a stun at 0 is `stun` until 1.5, and a fright started at 1.0 lasting 1.2 s is `flee` at 1.6; `clearFear` returns to `hunt`; counts `frights` and `stuns`. One summary line.
- [ ] **Step 2:** run: fails.
- [ ] **Step 3:** content, then the module (header comment: spec section 2; the lab's guards — feeding, KILLED, fight off — are the caller's).
- [ ] **Step 4:** test green; `npm test`, `npm run check` (the guard sees the new domain module), `npm run build`.
- [ ] **Step 5: Commit** — `The creature's fright and the nuke's stun are a pure rule: what landed within reach frightens it away for a while, a live beam renews it, the nuke stuns it for a second and a half`.

---

### Task 3: The arena's geometry (content + domain)

**Files:**
- Modify: `src/content/boss-fight.js`
- Create: `src/domain/boss-arena.js`
- Create: `test/boss-arena.mjs`

**Interfaces:**
- Produces (content):
  ```js
  wall: { clear: 6 },
  arena: [
    { id: 'r1', kind: 'rock', at: [0, 55], radius: 8, height: 6, breakable: false },
    { id: 'r2', kind: 'rock', at: [-40, -45], radius: 8, height: 6, breakable: false },
    { id: 'r3', kind: 'rock', at: [35, 30], radius: 5, height: 6, breakable: true },
    { id: 'r4', kind: 'rock', at: [-30, 25], radius: 6, height: 6, breakable: true },
    { id: 'w1', kind: 'wall', at: [25, -40], size: [20, 3], yaw: 30, height: 3, breakable: true },
    { id: 'w2', kind: 'wall', at: [-55, 0], size: [20, 3], yaw: 90, height: 3, breakable: true },
  ],
  ```
  (`yaw` in degrees, the wall's length along `(cos yaw, sin yaw)` in `[x, z]`.)
- Produces (domain, `src/domain/boss-arena.js`, imports nothing):
  - `makeArena(layout) -> shapes[]` — copies with `live: true` (never mutates the frozen content).
  - `footprint(shape, p) -> { d, n: [nx, nz] }` — the signed distance from `p` to the footprint's boundary (negative inside) and the outward normal at the nearest boundary point (a rock: the circle; a wall: the rotated box `size[0] x size[1]`).
  - `blockAt(x, z, r, shapes) -> null | { nx, nz, depth }` — the live shape with the deepest `r - d > 0`; `depth = r - d`.
  - `route(c, target, shapes, clear) -> [x, z]` — the target, or the tangent waypoint of the nearest live shape (rocks by radius, walls by `size[0] / 2`) whose circle inflated by `clear` the segment `c → target` crosses; the tangent on the side with the shorter path (`|c - w| + |w - target|`); if `c` is itself inside the inflated circle, the point pushed out radially to its edge.
  - `pushOut(pos, shapes) -> moves[]` — `pos` a flat array `[x, y, z, x, y, z, …]` in local metres; for every node with `y < shape.height` and `footprint(shape, [x, z]).d < 0` on a live shape: `{ i, x, z, nx, nz }` (the node index, its new ground position on the boundary, the outward normal); one move per node (the deepest shape).
  - `destroyIn(shapes, at, radius) -> ids[]` — every live breakable whose `footprint(shape, at).d < radius` becomes `live: false`.
  - `restore(shapes)` — every shape live again.
  - `clearSpawn(point, shapes, r) -> [x, z]` — `point` if `blockAt(point, r)` is null; else the point rotated about the origin by +10°, −10°, +20°, … until clear (at most 36 steps; the original point if none).

- [ ] **Step 1: the tests first** (`test/boss-arena.mjs`): `footprint` of a rock at `[0, 0]` r 5 at `[8, 0]` is `d = 3, n = [1, 0]`, at `[3, 0]` `d = -2`; a wall at `[0, 0]` `size [20, 3]` yaw 0 at `[0, 4]` is `d = 2.5, n = [0, 1]`, at `[12, 0]` `d = 2, n = [1, 0]`; yaw 90 swaps the axes; `blockAt` from a hull at `[10, 0]` r 4.2 against the r 8 rock at the origin pushes `[1, 0]` by 2.2; `route` from `[-30, 0]` to `[30, 0]` past a rock at the origin r 8 with clear 6 returns a point at distance 14 from the rock's centre with `|z| > 0`, and an unobstructed segment returns the target unchanged; `pushOut` moves a node at `[3, 1, 0]` inside the r 5 rock to `[5, 0]` with `n = [1, 0]`, and leaves a node at `[3, 7, 0]` (above the rock's height) alone; a dead shape blocks nothing; `destroyIn` at `[0, 0]` radius 55 on the content layout takes only breakables within reach (r3, r4, w1, w2 — check each by its `footprint` distance — never r1 or r2); `restore`; `clearSpawn` leaves `[0, -40]` alone and turns `[-30, 25]` (inside r4) to a clear bearing at the same radius. One summary line.
- [ ] **Step 2:** run: fails.
- [ ] **Step 3:** content, then the module (header comment: spec section 3).
- [ ] **Step 4:** test green; `npm test`, `npm run check`, `npm run build`.
- [ ] **Step 5: Commit** — `The boss arena's geometry is a pure rule: six obstacles (two permanent rocks, two small rocks and two walls the nuke can break), the tank's blocker, the creature's tangent routing, the push-out of the body's nodes and a respawn that turns clear of them`.

---

### Task 4: The friendlies in the lab: the three guns and SOL's tracking wall

**Files:**
- Modify: `src/labs/boss/friendlies.js` (split SOL into `src/labs/boss/sol.js` if the file passes 300 lines)
- Modify: `src/labs/boss-tab.js` (the tank passed to the schedule; the knobs and the readout)

**Interfaces:**
- Consumes: Task 1's `schedule(state, now, creature, tune, tank)`, `aimNow`, `burn`, `resolveLanding`, `readout(state).byKind`; `createGunshipDrop(sphere, { cellSide, metresPerCell: 10, onIgnite, onRelease })` from `src/fx/gunship-drop.js` (`release(from, target, up, velocity)`, `ready()`); `GUNSHIP_GUNS.rotary` (`sound: 'gunship_rotary_fire'`, `impact: 'kinetic_fire'`, `ringHex`), `GUNSHIP_NUKE` (`releaseSound`, `igniteSound`); the explosion keys `gunship.rotary`, `gunship.nuke`.
- Produces: `createFriendlies(scene, host)` keeps its signature and adds host hooks: `onLanding(plan, { damage, point }) ` called for every Bofors and nuke landing, `onBeam(plan, point)` called every frame SOL burns (Task 5's fear and Task 6's destruction listen here); `tick` passes `tank()` to `schedule`.

- [ ] **Step 1:** read `src/labs/boss/friendlies.js`, `src/fx/gunship-drop.js` (the whole release/advance API and how the gunship lab drives it: `grep -n createGunshipDrop -r src`), `src/fx/gunship-optic.js`'s `flight`.
- [ ] **Step 2: the rotary stream.** A `rotary` plan: its ring from `showAt` (placed at `aimNow` each frame); between `land` and `until`: `plan.at = aimNow(plan, creature(), tank(), tune)`, the ring follows, `burn(state, plan, dt, creature(), tank())` (a `tankHit` → `onTankHit('the 25 mm')`), a tracer (`optic.flight(skyPoint(), here, 0xdfe8ee, GUNSHIP_GUNS.rotary.travel, 0.25)`) and an impact (`explosions.spawn('gunship.rotary', …)`) every 0.1 s, the `gunship_rotary_fire` loop held while the stream runs (`sfx.loop`, stopped at `until` and on `drop`/`reset`).
- [ ] **Step 3: the Bofors** unchanged except their points come from the schedule (in front) and `onLanding` is called.
- [ ] **Step 4: the nuke.** A `nuke` plan: the 55 m ring from `showAt` to `land`; at `fireAt` `drop.release(skyPoint(), here.point.toArray(), here.normal.toArray())` with `sfx.play(GUNSHIP_NUKE.releaseSound)` and `onIgnite → sfx.play(GUNSHIP_NUKE.igniteSound)`; the drop advanced each frame as the gunship lab does; at `land`: `explosions.spawn('gunship.nuke', …)`, `resolveLanding` (a `tankHit` → `onTankHit('the MK-9')`), `onLanding`. If the drop's pool is not ready, the ring and the landing still happen (the body is optional, the rule is not).
- [ ] **Step 5: SOL tracking.** During the burn, `plan.at = aimNow(...)` every frame before `laser.aim` and `burn`; the ring follows; `onBeam(plan, point)` each frame; the pointer during `aim` stays on the planned point.
- [ ] **Step 6: the lab.** `boss-tab.js`: the knobs (spec section 5) in the `fight` folder: `front`, `behind`, `rotary.dps`, `nuke.damage`, `nuke.every`, `nuke.stun`, `sol.burn`, switches `rotary`, `bofors`, `nuke` (the existing `gunship` switch becomes `bofors`; keep `sol`); the readout line adds `rot <n> · bof <n> · nuke <n> · sol <n>` from `byKind` (whole hp) and `nuke in <s>` (from `state.nuke.next`, one decimal). The acceptance handle's `fight()` adds `byKind`.
- [ ] **Step 7:** `node --check` each file; `npm test`, `npm run check`, `npm run build`; then from a snapshot `node scripts/browser-test.mjs --boss-fight` (its existing asserts must still hold; extend its strike check to require `rotary`, `bofors`, `nuke` and `sol` among `fight().strikes` — the circle run lasts 22 s of fight clock, so the first nuke at 20 s is inside it).
- [ ] **Step 8: Commit** — `The boss lab fires the gunship's three guns and SOL's tracking wall: the 25 mm stream walks a far foot, the 40 mm lands in front, the MK-9 falls behind with its 55 m ring, the beam slides between the creature and the tank; damage per shooter on the readout`.

---

### Task 5: The fear in the lab

**Files:**
- Create: `src/labs/boss/fear.js`
- Modify: `src/labs/boss-tab.js`

**Interfaces:**
- Consumes: Task 2's `makeFear`, `inReach`, `frighten`, `stun`, `fearNow`, `clearFear`; Task 4's `onLanding(plan, { point })` and `onBeam(plan, point)`; `lineOf` from Task 1.
- Produces: `createFear({ tune, creature, tank, fight })` returning `{ landed(plan, point), beam(plan, point), step(now) -> { mode, point }, reset(), counts() -> { frights, stuns } }`; the lab's pursuit target writer consults `step(now)`.

- [ ] **Step 1:** read how `boss-tab.js` writes `creature.motion.target` each frame (the lure: the tank mapped back with `toLocal`) and where `motion.active` is set (the death).
- [ ] **Step 2:** `fear.js`: `landed`: a Bofors plan within `inReach(point, plan.radius, contacts, fear.reach)` → `frighten(key = plan, kind 'bofors', seconds fear.bofors)`; a nuke plan in reach → `stun`. `beam`: a SOL plan in reach → `frighten(key = plan, 'sol', fear.after)` every frame. Each `disturb: true` calls `creature.motion.disturb()`. Guards: nothing while the feeding is locked (`creature.motion.feeding.locked`), the fight's phase is not `fight`, or the `fear` switch is off.
- [ ] **Step 3:** the lab: each frame, `const f = fear.step(now)`; `flee` → the pursuit target is `f.point` (local metres → native, the same mapping the lure uses); `stun` → `motion.active = false` until it ends, then `true` (never re-activated after KILLED); `hunt` → the lure as before. The knobs `fear.reach`, `fear.flee`, `fear.bofors` and the switch `fear`; the readout's `frights <n> · stuns <n>`; the handle's `fight()` adds `frights`, `stuns`, `fearMode`. The round's reset calls `fear.reset()`.
- [ ] **Step 4:** `node --check`; `npm test`, `npm run check`, `npm run build`; `--boss-fight` from a snapshot, extended: at least one fright and one stun during the circle run.
- [ ] **Step 5: Commit** — `The boss frightens: a 40 mm burst or a live beam within reach turns its hunt into a flight away from the fire, and the MK-9 stuns it for a second and a half`.

---

### Task 6: The arena in the lab: obstacles, the push-out, destruction

**Files:**
- Create: `src/labs/boss/arena.js`
- Modify: `src/labs/boss-tab.js`

**Interfaces:**
- Consumes: Task 3's `makeArena`, `blockAt`, `route`, `pushOut`, `destroyIn`, `restore`, `clearSpawn`; Task 0's `body.blocker`; Task 4's `onLanding` (nuke); `BOSS_FIGHT.arena`, `BOSS_FIGHT.wall`.
- Produces: `createArena(sphere, { surface, cellSide, explosions, scaleOf, creature, enabled })` returning `{ shapes, blocker(x, z), route(c, target), wrapStep(creature), landed(plan), reset(), shift(sx, sz), stats() -> { pushed, ms }, dispose() }`.

- [ ] **Step 1: the meshes.** A rock: `IcosahedronGeometry(radius, 1)` with its vertices jittered ±12 % radially by a seeded sequence, flattened to `height`, flat-shaded `MeshStandardMaterial` in the lab's ground palette darkened; a wall: `BoxGeometry(size[0], height, size[1])` rotated by `yaw`. Placed on the surface through `surface(x, z)` like the rings, re-placed on `shift`. Hidden when dead or when the `obstacles` switch is off.
- [ ] **Step 2: the tank.** The drive's blocker is `(x, z) => deeper(body.blocker(x, z), arena.blocker(x, z))` where `arena.blocker = blockAt(x, z, hull.radius, shapes)` and `deeper` picks the larger `depth`.
- [ ] **Step 3: the routing.** The pursuit target the lab writes (the lure or Task 5's flee point) passes through `route(centre, target, shapes, wall.clear)` first, in local metres.
- [ ] **Step 4: the push-out.** `wrapStep(creature)`: `const body = creature.body, step = body.step; body.step = function (h) { const r = step.call(this, h); pushNodes(); return r; }` — `creature.update` calls `body.step(P.step)` through the property, so the wrap runs after each fixed step. `pushNodes`: build `pos` in local metres (`x[i] * scale`), `pushOut(pos, shapes)`, and for each move: `x[i*3] = mx / scale; x[i*3+2] = mz / scale`; `const vn = v[i*3] * nx + v[i*3+2] * nz; if (vn < 0) { v[i*3] -= vn * nx; v[i*3+2] -= vn * nz; }`. Measure: `performance.now()` around `pushNodes`, kept as a running mean; `pushed` the moves of the last step. Re-wrap after a creature reload (a variant switch makes a new body); unwrap on dispose. Skipped while the `obstacles` switch is off.
- [ ] **Step 5: destruction and the reset.** `landed(plan)` for a nuke: `destroyIn(shapes, plan.at, plan.radius)`, each destroyed shape hidden with `explosions.spawn('tank.shell', centre, normal, cellSide)`. The round's reset calls `arena.reset()` (`restore` + meshes shown) and the respawn point goes through `clearSpawn(point, shapes, hull.radius + 2)`.
- [ ] **Step 6: the lab.** The switch `obstacles` and the knob `wall.clear`; the readout's `push <n> · <ms> ms`; the handle gains `arena()` → `{ live: [ids], pushed, ms }`, and `pinTo(id, seconds)` (holds the creature's target at that shape's centre with the routing off and the tank parked behind it, for `--boss-walls`).
- [ ] **Step 7:** `node --check`; `npm test`, `npm run check`, `npm run build`; `--boss` and `--boss-fight` from a snapshot (the arena on; extend `--boss-fight`: a nuke landing destroyed at least one breakable, and after the reset `arena().live` has all six).
- [ ] **Step 8: Commit** — `The boss arena: two rocks that stay and four obstacles the MK-9 breaks block the tank, turn the creature's hunt round them and push its body out of them after every solver step; the reset rebuilds them`.

---

### Task 7: The walls measurement, the balance and the records

**Files:**
- Modify: `scripts/browser-test.mjs` (the `--boss-walls` step; the `--boss-fight` survival measurement)
- Modify: `src/content/boss-fight.js` (`health`), `test/boss-fight.mjs` (the bound)
- Create: `docs/log/entries/2026-10-08-boss-fight-next-round-design.json`, the landing entry; modify the proposed entry's status per the project's `/deban` rules (`npm run log:check` validates; entries are immutable once validated — supersede rather than edit if the tool says so)
- Modify: `docs/STATE.md`

- [ ] **Step 1: `--boss-walls`** (spec section 3's measurement): open `labs.html?sw=0&acceptance=1#boss`, fight off (no shooters), `pinTo('w1', 10)`; wait 10 s of lab clock (real-time cap 60 s); log `arena().ms` (mean push-out ms per step), the mean `pushed`, and the jitter: sample the pushed nodes' local positions every frame for the last 3 s (the handle exposes them via `arena().pushedNodes` — add it in this task if Task 6 did not) and log the mean frame-to-frame displacement in metres. Assert `ms < 1`; the jitter is logged, not asserted.
- [ ] **Step 2: the survival run.** In `--boss-fight`, after the existing circle run, a second run of the circle at 45 m with every shooter, the fear and the arena on until KILLED or 60 s of fight clock (real-time cap 180 s); log the clock at KILLED. Run it twice from a snapshot.
- [ ] **Step 3: health.** Set `BOSS_FIGHT.health` so the survival run's KILLED lands at about 30 s (`health * 30 / measured` rounded to 5); re-run the survival run to confirm 25-35 s; then run the node held-still balance and tighten its bound to the measured value ± 20 %. If the survival run cannot reach KILLED in 60 s at any sane health (the fear keeps it out of the fire), stop and report the numbers instead of tuning further.
- [ ] **Step 4: the records.** The design entry (decision, accepted, evidence: the spec and the brainstorm's choices); the proposed next-round entry accepted (or superseded) by it; the landing entry (change) with: the commits, the survival time, the held-still time, the walls' ms, pushed and jitter, and what the owner should judge in the playtest (the nuke's ring vs the tank, the fright's feel, the push-out's look); `npm run log` regenerates `DEVLOG.md`; `docs/STATE.md`'s boss line points at the new spec and the landing.
- [ ] **Step 5:** `npm test`, `npm run check`, `npm run build`, `npm run log:check`.
- [ ] **Step 6: Commit** — `Records: the boss fight's next round landed (the gunship's three guns, SOL's wall, the fright and the stun, the arena), its health set from the survival run, the walls measured; STATE.md current`.
