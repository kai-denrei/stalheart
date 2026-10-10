// wave.js — the bait mode's first wave (owner, 2026-10-09: "let's test something with the fps; wave 1 is 5 to 50 (slider) Reed - four limbs, creatures, smaller
// (size 15) and with only 20 hp, not 180. once they are defeated, the bigger Nih Dairia shows up"). The rule is src/domain/boss-wave.js (the hit points, the falloff
// per Reed, the deaths, the boss's entry); this file gives the Reeds their bodies (the kit's own factory and wasm kernel, the `reed` variant), hunts Isao with each,
// frightens each with the per-gun fear (./fear.js, one fear state a Reed) and drives each with the temperament (./temperament.js, one a Reed), resolves the
// player's rounds on them, lays the dead down and takes them away, and holds the whole wave to a solver budget.
//
// THE PLANE. Every Reed simulates in the lab's own frame plane, as the boss does (native = local / scale, its own scale: `wave.size` over its width), so the rules,
// the routing, the clamp and the re-anchor's shift are the lab's. The plane is flat and the Reeds stand up to the bound's 120 m out, where a flat floor floats 9.6 m
// over the sphere (d^2 / 2R), so each Reed is DRAWN through a frame of its own under its centre, every frame: an outer group on the sphere point under it, turned to
// the tangent there and scaled, an inner one taking its centre back to the origin. The body's arrays never move for it.
//
// THE MODEL is loaded and parsed once (`loadMonsterCage`), each Reed taking a copy of the parsed cage with its own surface geometry (the kit's SoftBody writes the
// kernel's buffers into that geometry, and three's attribute buffers are released per geometry, so no BufferAttribute is shared); the tets, the volumes, the contact
// and skin bindings are shared, read only. The Reeds load a few a frame (`BATCH`), so a wave of fifty does not freeze the lab; a Reed still loading is alive and
// cannot be hit.
//
// THE BUDGET (`wave.budget` ms of solver a frame for the whole wave; the kit steps at 240 Hz and a Reed step costs ~0.6 ms, so ten Reeds want ~24 ms a 60 Hz frame):
// the frame's need is priced from the running cost of a step, and past the budget the wave's clock runs slower for every Reed alike (`timeScale`), so the frame never
// spirals into the kit's twelve-step catch-up. With `wave.lod` (off by default: it bought too little), a Reed whose body is outside the camera's view (last frame's matrices) steps every other frame at the
// frame's dt (half its rate; the seat's camera sees the whole arena zoomed out, so far-but-shown Reeds keep their rate). THE DEAD (the v1 death: motion off, the gravity up)
// collapse `wave.corpse` seconds, then are laid down as carcasses (below).
//
// THE SECOND PASS (owner, 2026-10-10; the rules src/domain/boss-wave.js `emergePlan`, `emergence`, `waveStep`, `carcassLook`):
// THE EMERGENCE. Every Reed is made at the arena's centre (a few metres off it, `emergePlan`) and waits below the ground, hidden and unstepped, until the ground
// has opened (`gate()`, the lab's: the game's own sinkhole at the centre, ./sinkhole.js, ready by the game's spawn rule; owner, 2026-10-10: "the initial Tremor is
// not just the ground shaking, it is our sinkhole animation from the game mode") and then its turn on the lab's clock (the turns are what the player sees, so they
// keep `emerge.gap` s however the budget slows the bodies). Then it PULLS ITSELF OUT (owner, 2026-10-10: "both the smaller Reeds and the larger boss emerge as if
// from an elevator, it looks unnatural. let's have them emerge by stretching their limbs, as if they were pulling themselves out from the depth"; the rule
// src/domain/boss-emerge.js, the drive ./pull-out.js): drawn `emerge.depth` times its rest height down in the hole, its arms reach up and out over the hole's lip
// (`hole()`) and grip there, the body hauls itself up (the drawing lifted on the lab's clock while the arms' goals come down with it, so the tips stay planted on
// the lip) and the arms let go. The body stands on its own floor all along with its motion off: its solver never sees the ground move, only its arms pulled. Up,
// it walks out to its fan point for at most `emerge.fanFor` s, then hunts. A Reed not up is not a body for the rules (no hits, not hunted). `keep()` is Isao's
// keep-out while any Reed is still to come up.
// THE STEP (owner: "start with 120 HZ when there are more than 10 Reeds, and switch back to 240HZ when there are fewer"): `waveStep` on the Reeds alive. The kit's
// FixedStepper takes its step at construction (`new FixedStepper(P.step)`, src/fx/nih-dairia/creature.js) and keeps it in a closure, but each fixed step simulates
// `P.step` (the creature's own phys copy, read live): so the lab sets `kit.phys.step` and hands update a dt scaled by `STEP / step`, and the stepper's 1/240 s count
// becomes 1/120 s ones: no change in the kit. The solver's velocities are (x - previous) / h of each step, so a change of h carries no jolt (the trace below measures it).
// THE CARCASSES: `corpse` s after a death (and SETTLE s of collapse on the wave's clock) the Reed's body is laid down as barebone tentacles (./carcass.js, owner,
// 2026-10-10: "the low-poly reeds carcasses are too low poly, they look blocky ... barebone tentacles, and they disintegrate with further explosions or time"): a
// tapered tube in pieces along each limb's node rings in the pose it collapsed to, a core where they join, in the frame it was drawn in; its solver, kernel, skin and
// fear go. The tips crumble first with time, every round the lab resolves breaks the pieces within its reach (`resolve`, also once the boss is in), and the whole
// darkens, sinks and cools in the seat's thermal (`hot()`) over `carcass.decay` s; at most `carcass.max` lie. They block nothing and are no one's target. A new wave
// clears them.
import * as THREE from '../../../vendor/three.module.js';
import { makeWave, emergePlan, waveStep, aliveCount, resolveReeds, hurtReed, waveCleared, bossEnters, nearestReed } from '../../domain/boss-wave.js';
import { emergence } from '../../domain/boss-emerge.js';
import { createNihDairia, loadMonsterCage } from '../../fx/nih-dairia/creature.js';
import { ARENA } from '../../fx/nih-dairia/arena.js';
import { NIH_DAIRIA_LOOK, NIH_DAIRIA_MODELS } from '../../content/nih-dairia.js';
import { createFear } from './fear.js';
import { createTemperament } from './temperament.js';
import { kitNow, nodesOf, shiftKit } from './body.js';
import { createCarcasses } from './carcass.js';
import { createPullOut } from './pull-out.js';

const VARIANT = 'reed';
const BATCH = 3;            // Reeds made a frame while the wave loads
const STEP = 1 / 240;       // the kit's fixed step (src/fx/nih-dairia/constants.js PHYS.step), for the budget's price of a frame
const COST0 = 0.6;          // ms a Reed step costs before any is measured (the probe's, 2026-10-09)
const WINDOW = 30;          // frames in the running means
const TRACE = 900;          // frames the step trace keeps (the acceptance's jolt check)
const SETTLE = 0.4;         // seconds of the wave's clock a dead Reed collapses at least before it is laid down (at most 3 x `corpse` s of the lab's: a slowed wave's dead are not stepped for ever)
// the parsed cage, copied for one more body: its own surface geometry (positions, normals, index and the optical thickness copied), the rest shared read only
function cageCopy(cage) {
  const s = cage.surface, g = s.geometry, geometry = new THREE.BufferGeometry(), positions = s.positions.slice();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(g.attributes.normal.array.slice(), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('opticalThickness', new THREE.BufferAttribute(g.attributes.opticalThickness.array.slice(), 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(g.index.array.slice(), 1));
  geometry.boundingBox = g.boundingBox.clone(); geometry.boundingSphere = g.boundingSphere.clone();
  return { ...cage, surface: { ...s, geometry, positions }, opticalSurface: { ...cage.opticalSurface, geometry: new THREE.BufferGeometry() } };
}

// `sphere` the planet-centred group the Reeds are drawn in; `tune()` the fight's live numbers (`.wave`, `.bounds`, `.deathGravity`, the fear's), `fight()` the round,
// `now()` the lab's clock; `motion()` the mode's working motion (the Reeds' base, as the boss's), `phys()` the kit's physics for a new body; `ground(x, z)` the
// sphere point under a local point and `tangent(world)` the frame there; `spawn(point)` a point clear of the obstacles; `aim(from, to)` the hunt's target round the
// obstacles and inside the bound (the lab's, as the boss's); `isao()` his rules' target ({ pos, radius }) and `isaoPos()` his ground point (null when he is gone);
// `fearOn()` the fear switch and the fight; `camera()` the lab's camera (the frustum); `extentOf(body)` a body's native width; `gate()` true once the ground at the
// centre is open for them (the lab's sinkhole; the turns count from the first frame it is) and `hole()` its radius (local metres: the arms grip its lip); `hot()` the seat's thermal on (the carcasses' warmth); `local(world)` a sphere point's
// local ground point (the carcasses' pieces as the handle reads them); `onError(message)` a frame's error
export function createWave({ sphere, tune, fight, now, motion, phys, ground, tangent, spawn, aim, isao, isaoPos, fearOn, camera, extentOf, gate = () => true, hole = () => 0, hot = () => false, local = null, onError = () => {} }) {
  const root = new THREE.Group(); root.name = 'Reed wave'; sphere.add(root);
  const dead = new THREE.Group(); dead.name = 'Reed carcasses'; sphere.add(dead);   // not under `root`: the thermal heats the wave's group, and a carcass cools on its own
  let wave = makeWave(0, tune()), reeds = [], gen = 0, cage = null, disposed = false, frame = 0, centre = [0, 0];
  let cost = COST0, timeScale = 1, lodNow = 0, solverMs = 0, stepsNow = 0, hunted = null, entered = false;
  let clock = 0, openAt = null, step = STEP, switches = [], trace = null;
  const carcasses = createCarcasses({ group: dead, tune, now, hot, ground, local });
  const meanSolver = [], meanScale = [];
  const target = new THREE.Vector3(), basis = new THREE.Matrix4(), frustum = new THREE.Frustum(), viewM = new THREE.Matrix4(), ball = new THREE.Sphere();
  const push = (a, v) => { a.push(v); if (a.length > WINDOW) a.shift(); };
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const fallback = { centre: [1e9, 1e9], velocity: [0, 0], radius: 0, contacts: [] };

  async function loadCage() {
    cage ??= loadMonsterCage(VARIANT, NIH_DAIRIA_MODELS);
    return cage;
  }

  // one Reed's body at its emergence point (local metres), its fear and temperament; below the ground until its turn
  async function makeReed(id, plan, base) {
    const parsed = await loadCage();
    const kit = await createNihDairia({ ...motion() }, VARIANT, { models: NIH_DAIRIA_MODELS, look: NIH_DAIRIA_LOOK, phys: { ...phys() }, cage: cageCopy(parsed) });
    const native = extentOf(kit.body), s = tune().wave.size / native, at = spawn(plan.at);
    kit.motion.feeding.enabled = false; kit.motion.active = false;   // still under the ground
    shiftKit(kit, at[0] / s, at[1] / s);   // from the native origin to its place
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < kit.body.rest.length; i += 3) { y0 = Math.min(y0, kit.body.rest[i]); y1 = Math.max(y1, kit.body.rest[i]); }
    const outer = new THREE.Group(), inner = new THREE.Group();
    outer.name = `Reed ${id}`; outer.visible = false; inner.add(kit.mesh); outer.add(inner); root.add(outer);
    const r = { id, kit, s, native, outer, inner, place: [at[0], at[1]], first: [at[0], at[1]], fan: [...plan.fan], body: null, dead: false, lod: false, gone: false, cage: parsed,
      offset: plan.emergeAt, madeAt: now(), emergeAt: Infinity, phase: 'below', lift: 0, height: y1 - Math.min(0, y0), fanUntil: 0, deadAt: 0, lowest: 0,
      pull: createPullOut(kit), pulled: null, peak: 0 };
    r.body = kitNow(kit, s, native);
    r.fear = createFear({ tune, creature: () => r.body ?? fallback, tank: isao, fight, now, kit: () => r.kit, on: fearOn, gunFear: () => true, nodes: () => nodesOf(r.kit, r.s) });
    r.temper = createTemperament({ tune, kit: () => r.kit, base: motion, on: () => !r.dead });
    r.temper.reset(base + id * 7919);   // each its own lunges
    return r;
  }

  async function load(g, plans, seed) {
    try {
      for (let i = 0; i < plans.length; i++) {
        if (g !== gen || disposed) return;
        if (wave.reeds[i]?.dead) continue;   // killed before it was made (the acceptance's cheat): no body
        const r = await makeReed(i, plans[i], seed);
        if (g !== gen || disposed || wave.reeds[i]?.dead) { drop(r); if (g !== gen || disposed) return; continue; }
        reeds.push(r); place(r);
        if (i % BATCH === BATCH - 1) await new Promise((res) => requestAnimationFrame(res));
      }
    } catch (e) { onError(`wave: ${e.message}`); }
  }

  function drop(r) {
    if (r.gone) return;
    r.gone = true; root.remove(r.outer); r.kit?.dispose(); r.kit = null;
  }

  // drawn through its own frame on the sphere under its centre (see THE PLANE), lowered by what it has still to rise
  function place(r) {
    const c = r.kit.motion.center, w = ground(c.x * r.s, c.z * r.s), tf = tangent(w);
    r.outer.position.set(w[0], w[1], w[2]);
    r.outer.quaternion.setFromRotationMatrix(basis.makeBasis(new THREE.Vector3(...tf.east), new THREE.Vector3(...tf.up), new THREE.Vector3(...tf.north)));
    r.outer.scale.setScalar(r.s);
    r.lowest = -(1 - r.lift) * tune().wave.emerge.depth * r.height;   // native units under the surface
    r.inner.position.set(-c.x, r.lowest, -c.z);
    r.outer.visible = r.phase !== 'below';
  }

  // the v1 death: every movement off, the gravity up; it collapses `corpse` seconds (SETTLE of the wave's clock at least, 3 x `corpse` at most), then is laid down
  function die(r) {
    r.dead = true; r.deadAt = clock; r.pull.end();
    const k = r.kit.motion;
    k.active = false; k.feeding.enabled = false; r.kit.phys.gravity = tune().deathGravity;
  }

  // THE CARCASS (./carcass.js): the tentacles in the pose it collapsed to, then the body and its GPU resources go
  function layDown(r) {
    carcasses.lay(r, r.id * 7919 + 17);
    r.kit.dispose(); r.kit = null; r.fear = null; r.temper = null; r.gone = true;
  }

  // the Reed's body outside the camera's view (last frame's matrices)
  function far(r, cam) {
    if (!cam) return false;
    const g = r.kit.mesh.geometry;
    if (!g.boundingSphere) return false;
    ball.copy(g.boundingSphere).applyMatrix4(r.kit.mesh.matrixWorld);
    return !frustum.intersectsSphere(ball);
  }
  // the fastest node of the Reeds up and alive, local metres a second (the step trace's)
  function topSpeed() {
    let v2 = 0;
    for (const r of reeds) {
      if (r.dead || r.phase !== 'up') continue;
      const v = r.kit.body.velocity, s2 = r.s * r.s;
      for (let i = 0; i < v.length; i += 3) { const q = (v[i] * v[i] + v[i + 1] * v[i + 1] + v[i + 2] * v[i + 2]) * s2; if (q > v2) v2 = q; }
    }
    return Math.sqrt(v2);
  }

  function keep() {
    if (wave.boss) return null;
    const made = new Set(reeds.map((r) => r.id));
    const owed = wave.reeds.some((rr) => !rr.dead && !made.has(rr.id)) || reeds.some((r) => !r.dead && r.phase !== 'up');
    return owed ? { at: [...centre], radius: tune().wave.emerge.keep } : null;
  }

  // the bodies the rules see: alive, made and up
  const live = () => reeds.filter((r) => !r.dead && !r.gone && r.phase === 'up');

  return {
    group: root,
    carcassGroup: dead,
    // a new wave of `count` Reeds from the arena's centre `at` (local), the old ones and the carcasses gone; 0 is no wave (the boss at once). `seed` the round's
    reset(count, at = [0, 0], seed = 1) {
      gen++;
      for (const r of reeds) drop(r);
      carcasses.clear();
      reeds = []; hunted = null; entered = false; timeScale = 1; clock = 0; openAt = null; step = STEP; switches = []; centre = [at[0], at[1]];
      if (trace) trace = [];
      wave = makeWave(count, tune());
      if (wave.count) load(gen, emergePlan(wave.count, tune(), at, (seed * 0.61803) % 1 * 2 * Math.PI), seed);
      return wave.count;
    },
    // the wave holds the boss back: Reeds still standing
    holds: () => !wave.boss,
    // true once, when the last Reed dies: the boss enters
    bossEnters: () => { const e = bossEnters(wave); if (e) entered = true; return e; },
    // Isao's keep-out ({ at, radius }, local) while a Reed is still to come up at the centre; null once every live one is up
    keep,
    // each frame: the emergence, the hunt, the fear and the temperament on last frame's bodies, the budgeted update at the step for the Reeds alive, the dead laid
    // down, the carcasses decayed, the bodies read for the rules
    step(dt) {
      frame++;
      const T = tune(), W = T.wave, E = W.emerge, t = now(), prey = isaoPos();
      carcasses.step();
      for (const r of reeds) {
        if (!r.dead || r.gone) continue;
        const lain = t - wave.reeds[r.id].diedAt;
        if (r.phase === 'below') drop(r);
        else if (lain >= W.corpse && (clock - r.deadAt >= SETTLE || lain >= 3 * W.corpse)) layDown(r);
      }
      reeds = reeds.filter((r) => !r.gone);
      if (!reeds.length) { solverMs = 0; stepsNow = 0; clock += dt; return; }
      // the emergence: the turns from the frame the ground is open (one made later waits for its making); from its reach to its release the arms pull it out of the
      // hole (./pull-out.js: the grips on the lip of the hole round the centre, aimed at the reach's start), motion on once it is up
      if (openAt === null && gate()) openAt = t;
      for (const r of reeds) {
        if (r.dead) continue;
        if (openAt !== null && r.emergeAt === Infinity) r.emergeAt = Math.max(openAt + r.offset, r.madeAt);
        const e = emergence(t - r.emergeAt, E), was = r.phase;
        r.phase = e.phase; r.lift = e.lift;
        if (e.phase === 'reach' || e.phase === 'haul' || e.phase === 'release') {
          if (!r.pull.active()) { const c = r.kit.motion.center; r.pull.begin([c.x, c.z], r.pull.aim([c.x * r.s, c.z * r.s], r.s, centre, hole(), E), E.drive); }
          r.pull.frame(e, E.depth * r.height, r.height, E);
        }
        if (was !== 'up' && e.phase === 'up') { r.pull.end(); r.kit.motion.active = true; r.fanUntil = clock + E.fanFor; }
      }
      const want = waveStep(aliveCount(wave), W.coarse, STEP);
      if (want !== step) { switches.push({ clock, t, from: 1 / step, to: 1 / want, alive: aliveCount(wave) }); step = want; }
      const cam = camera();
      if (cam) { cam.updateMatrixWorld(); frustum.setFromProjectionMatrix(viewM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); }
      let need = 0; lodNow = 0;
      for (const r of reeds) {
        if (r.phase === 'below') continue;   // not stepped: it waits
        if (!r.dead && r.phase === 'up') {
          const fr = r.fear.step(t);
          r.temper.step(dt, fr.flight);
          const m = r.kit.motion, c = r.body.centre;
          if (fr.mode === 'stun') m.active = false; else m.active = true;
          const fanning = clock < r.fanUntil && Math.hypot(c[0] - r.fan[0], c[1] - r.fan[1]) > E.jitter;
          if (!fanning) r.fanUntil = 0;   // out (or out of time): it hunts from now on
          const goal = fr.mode === 'flee' ? fr.point : fanning ? r.fan : prey;
          if (goal && fr.mode !== 'stun') {
            const p = aim(c, goal);
            m.targetHeld = true;   // Isao is always held, as with the boss: the hold that takes him is the rules'
            r.kit.setTarget(target.set(p[0] / r.s, ARENA.lureHeight, p[1] / r.s));
          }
        }
        r.lod = !!W.lod && !r.dead && far(r, cam);
        if (r.lod) lodNow++;
        need += (r.lod ? 0.5 : 1) * dt / step * cost;
      }
      timeScale = need > W.budget ? W.budget / need : 1;
      let ms = 0, steps = 0;
      for (const r of reeds) {
        if (r.phase === 'below') continue;
        if (r.lod && ((frame + r.id) & 1)) continue;   // a far Reed steps every other frame
        try {
          r.kit.phys.step = step;   // each fixed step simulates this; the stepper counts in the kit's 1/240 s, so it is handed dt x (1/240) / step (see THE STEP)
          steps += r.kit.update(dt * timeScale * STEP / step);
          ms += r.kit.timings.solver + r.kit.timings.skin;
        } catch (e) {   // a non-finite body: back at its place, whole in its shape
          onError(`Reed ${r.id}: ${e.message}`);
          r.kit.reset(); shiftKit(r.kit, r.place[0] / r.s, r.place[1] / r.s);
        }
      }
      clock += dt * timeScale;
      if (steps > 0) cost = cost * 0.9 + (ms / steps) * 0.1;
      solverMs = ms; stepsNow = steps; push(meanSolver, ms); push(meanScale, timeScale);
      for (const r of reeds) {
        place(r); if (!r.dead) r.body = kitNow(r.kit, r.s, r.native);
        if (r.pull.active() && !r.dead) { const p = r.pull.read(-r.lowest); r.pulled = { tip: p.tip * r.s, torso: p.torso * r.s, speed: p.speed * r.s }; r.peak = Math.max(r.peak, r.pulled.speed); }
      }
      if (trace) { trace.push({ clock, t, hz: Math.round(1 / step), alive: aliveCount(wave), speed: topSpeed() }); if (trace.length > TRACE) trace.shift(); }
      const bodies = live().map((r) => ({ id: r.id, ...r.body, r }));
      hunted = prey ? nearestReed(bodies, prey) : bodies[0] ?? null;
    },
    // the player's round on every live Reed (the fight's falloff on each one's nearest contact), and the fear of those within its reach
    resolve(plan, dt = 0) {
      carcasses.blast(plan);   // every round breaks the carcasses it reaches, the boss in or not
      if (wave.boss || fight().phase !== 'fight') return [];
      const T = tune(), bodies = live().map((r) => ({ id: r.id, centre: r.body.centre, contacts: r.body.contacts }));
      const out = resolveReeds(wave, plan, dt, bodies, now());
      for (const h of out) if (h.died) die(reeds.find((r) => r.id === h.id));
      const reach = plan.radius + T.fear.reach + 3 * T.wave.size;   // a cheap test before the fear's own (the arms reach past the rest extent)
      for (const r of live()) {
        if (Math.hypot(r.body.centre[0] - plan.at[0], r.body.centre[1] - plan.at[1]) > reach) continue;
        if (!plan.moving) r.fear.landed(plan, [...plan.at]);
        else if (plan.player && plan.kind === 'rotary') r.fear.round(plan, plan.at);
      }
      return out;
    },
    // the Reed the rules see this frame (the nearest to Isao by its floor contacts): its rules body, its nodes, the aim point of Isao's camera; null when none stands
    hunted: () => (hunted && !hunted.r.dead ? hunted : null),
    huntedNodes: () => (hunted && !hunted.r.dead ? nodesOf(hunted.r.kit, hunted.r.s) : null),
    huntedAim(lift = 2) {
      if (!hunted || hunted.r.dead) return null;
      const r = hunted.r, c = r.kit.motion.center, w = ground(c.x * r.s, c.z * r.s), u = tangent(w).up, h = c.y * r.s + lift;
      return [w[0] + u[0] * h, w[1] + u[1] * h, w[2] + u[2] * h];
    },
    // a re-anchor of the lab's frame moves every local position: each Reed's arrays by the same vector in its own native units, as the boss's (the carcasses are
    // drawn in their own frames on the sphere, which a re-anchor does not move: an impact is taken into a carcass's own frame)
    shift(sx, sz) {
      for (const r of reeds) {
        shiftKit(r.kit, sx / r.s, sz / r.s); r.place[0] += sx; r.place[1] += sz; r.first[0] += sx; r.first[1] += sz; r.fan[0] += sx; r.fan[1] += sz;
        if (r.body) r.body = kitNow(r.kit, r.s, r.native);
      }
      centre[0] += sx; centre[1] += sz;
    },
    // the acceptance's cheat: every Reed still standing dies now (one still below the ground goes without a carcass)
    killAll() {
      let n = 0;
      for (const rr of wave.reeds) if (!rr.dead) { hurtReed(wave, rr.id, rr.hp, now()); n++; const r = reeds.find((x) => x.id === rr.id); if (r) die(r); }
      return n;
    },
    // the acceptance's: the Reeds up and alive killed down to `left` (the newest first), so the step's switch can be watched; the number killed
    thin(left) {
      let n = 0;
      for (const r of [...reeds].reverse()) {
        if (aliveCount(wave) <= left) break;
        if (r.dead || r.phase !== 'up') continue;
        hurtReed(wave, r.id, wave.reeds[r.id].hp, now()); die(r); n++;
      }
      return n;
    },
    // the step trace (the acceptance's jolt check): on(true) starts it afresh, on(false) stops it; read() is [{ clock, t, hz, alive, speed }] a frame
    trace: (on) => { if (on !== undefined) trace = on ? [] : null; return trace ? [...trace] : null; },
    // the bar's and the readout's numbers
    bar: () => (wave.boss ? null : { alive: aliveCount(wave), count: wave.count }),
    stats: () => ({ solver: solverMs, steps: stepsNow, meanSolver: mean(meanSolver), timeScale, meanScale: mean(meanScale), lod: lodNow, cost, hz: Math.round(1 / step), clock, carcasses: carcasses.stats() }),
    // the handle's view: the wave's count, alive, made (bodies standing or lying), cleared, the boss in, each Reed's hit points, centre (local), first centre, phase,
    // lift and top (metres over the surface: below 0 it is still under), pulled (while its arms pull it out: { tip, torso } the highest tip node and the torso's centre in
    // metres over the surface, speed its fastest node in local metres a second) and peak (that speed's most over its emergence), hunting (up and done fanning out), the step (hz) and its switches, the carcasses (./carcass.js
    // state: { id, k, heat, sink, tris, shown, limbs, pieces, blasts }), their stats ({ count, ms, broke, crumbled, moving }) and the last blast on one
    state: () => ({
      count: wave.count, alive: aliveCount(wave), killed: wave.killed, made: reeds.length, cleared: waveCleared(wave), boss: wave.boss, entered,
      reeds: wave.reeds.map((rr) => {
        const r = reeds.find((x) => x.id === rr.id);
        return { id: rr.id, hp: rr.hp, dead: rr.dead, hits: rr.hits, body: !!r, centre: r?.body ? [...r.body.centre] : null, contacts: r?.body?.contacts.length ?? 0, lod: !!r?.lod,
          first: r ? [...r.first] : null, phase: r?.phase ?? null, hunting: !!r && !rr.dead && r.phase === 'up' && r.fanUntil === 0, lift: r?.lift ?? null, top: r ? (r.height + r.lowest) * r.s : null, shown: !!r?.outer.visible,
          pulled: r?.pulled ? { ...r.pulled } : null, peak: r?.peak ?? 0 };
      }),
      hunted: hunted && !hunted.r.dead ? hunted.id : null, solver: solverMs, steps: stepsNow, timeScale, lod: lodNow, cost, meanSolver: mean(meanSolver), meanScale: mean(meanScale),
      hz: Math.round(1 / step), clock, openAt, switches: switches.map((w) => ({ ...w })), keep: keep(), laid: carcasses.laid(),
      carcasses: carcasses.state(), carcassStats: carcasses.stats(), lastBlast: carcasses.lastBlast(),
    }),
    dispose() { disposed = true; gen++; for (const r of reeds) drop(r); carcasses.clear(); reeds = []; sphere.remove(root); sphere.remove(dead); },
  };
}
