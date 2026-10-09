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
// frame's dt (half its rate; the seat's camera sees the whole arena zoomed out, so far-but-shown Reeds keep their rate). THE DEAD (the v1 death: motion off, the gravity up) lie `wave.corpse` seconds, then go with their GPU resources.
import * as THREE from '../../../vendor/three.module.js';
import { makeWave, wavePlaces, aliveCount, resolveReeds, hurtReed, waveCleared, bossEnters, nearestReed } from '../../domain/boss-wave.js';
import { createNihDairia, loadMonsterCage } from '../../fx/nih-dairia/creature.js';
import { ARENA } from '../../fx/nih-dairia/arena.js';
import { NIH_DAIRIA_LOOK, NIH_DAIRIA_MODELS } from '../../content/nih-dairia.js';
import { createFear } from './fear.js';
import { createTemperament } from './temperament.js';
import { kitNow, nodesOf, shiftKit } from './body.js';

const VARIANT = 'reed';
const BATCH = 3;            // Reeds made a frame while the wave loads
const STEP = 1 / 240;       // the kit's fixed step (src/fx/nih-dairia/constants.js PHYS.step), for the budget's price of a frame
const COST0 = 0.6;          // ms a Reed step costs before any is measured (the probe's, 2026-10-09)
const WINDOW = 30;          // frames in the running means

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
// `fearOn()` the fear switch and the fight; `camera()` the lab's camera (the frustum); `extentOf(body)` a body's native width; `onError(message)` a frame's error
export function createWave({ sphere, tune, fight, now, motion, phys, ground, tangent, spawn, aim, isao, isaoPos, fearOn, camera, extentOf, onError = () => {} }) {
  const root = new THREE.Group(); root.name = 'Reed wave'; sphere.add(root);
  let wave = makeWave(0, tune()), reeds = [], gen = 0, cage = null, disposed = false, frame = 0;
  let cost = COST0, timeScale = 1, lodNow = 0, solverMs = 0, stepsNow = 0, hunted = null, entered = false;
  const meanSolver = [], meanScale = [];
  const target = new THREE.Vector3(), basis = new THREE.Matrix4(), frustum = new THREE.Frustum(), viewM = new THREE.Matrix4(), ball = new THREE.Sphere();
  const push = (a, v) => { a.push(v); if (a.length > WINDOW) a.shift(); };
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const fallback = { centre: [1e9, 1e9], velocity: [0, 0], radius: 0, contacts: [] };

  async function loadCage() {
    cage ??= loadMonsterCage(VARIANT, NIH_DAIRIA_MODELS);
    return cage;
  }

  // one Reed's body at `at` (local metres), its fear and temperament
  async function makeReed(id, at, base) {
    const kit = await createNihDairia({ ...motion() }, VARIANT, { models: NIH_DAIRIA_MODELS, look: NIH_DAIRIA_LOOK, phys: { ...phys() }, cage: cageCopy(await loadCage()) });
    const native = extentOf(kit.body), s = tune().wave.size / native;
    kit.motion.feeding.enabled = false; kit.motion.active = true;
    shiftKit(kit, at[0] / s, at[1] / s);   // from the native origin to its place
    const outer = new THREE.Group(), inner = new THREE.Group();
    outer.name = `Reed ${id}`; inner.add(kit.mesh); outer.add(inner); root.add(outer);
    const r = { id, kit, s, native, outer, inner, place: [at[0], at[1]], body: null, dead: false, lod: false, gone: false };
    r.body = kitNow(kit, s, native);
    r.fear = createFear({ tune, creature: () => r.body ?? fallback, tank: isao, fight, now, kit: () => r.kit, on: fearOn, gunFear: () => true, nodes: () => nodesOf(r.kit, r.s) });
    r.temper = createTemperament({ tune, kit: () => r.kit, base: motion, on: () => !r.dead });
    r.temper.reset(base + id * 7919);   // each its own lunges
    return r;
  }

  async function load(g, places, seed) {
    try {
      for (let i = 0; i < places.length; i++) {
        if (g !== gen || disposed) return;
        const at = spawn(places[i]), r = await makeReed(i, at, seed);
        if (g !== gen || disposed) { drop(r); return; }
        reeds.push(r); place(r);
        if (i % BATCH === BATCH - 1) await new Promise((res) => requestAnimationFrame(res));
      }
    } catch (e) { onError(`wave: ${e.message}`); }
  }

  function drop(r) {
    if (r.gone) return;
    r.gone = true; root.remove(r.outer); r.kit.dispose();
  }

  // drawn through its own frame on the sphere under its centre (see THE PLANE)
  function place(r) {
    const c = r.kit.motion.center, w = ground(c.x * r.s, c.z * r.s), tf = tangent(w);
    r.outer.position.set(w[0], w[1], w[2]);
    r.outer.quaternion.setFromRotationMatrix(basis.makeBasis(new THREE.Vector3(...tf.east), new THREE.Vector3(...tf.up), new THREE.Vector3(...tf.north)));
    r.outer.scale.setScalar(r.s);
    r.inner.position.set(-c.x, 0, -c.z);
  }

  // the v1 death: every movement off, the gravity up; it lies `corpse` seconds
  function die(r) {
    r.dead = true;
    const k = r.kit.motion;
    k.active = false; k.feeding.enabled = false; r.kit.phys.gravity = tune().deathGravity;
  }

  // the Reed's body outside the camera's view (last frame's matrices)
  function far(r, cam) {
    if (!cam) return false;
    const g = r.kit.mesh.geometry;
    if (!g.boundingSphere) return false;
    ball.copy(g.boundingSphere).applyMatrix4(r.kit.mesh.matrixWorld);
    return !frustum.intersectsSphere(ball);
  }

  const live = () => reeds.filter((r) => !r.dead && !r.gone);

  return {
    group: root,
    // a new wave of `count` Reeds round the arena's centre `at` (local), the old ones gone; 0 is no wave (the boss at once). `seed` the round's
    reset(count, at = [0, 0], seed = 1) {
      gen++;
      for (const r of reeds) drop(r);
      reeds = []; hunted = null; entered = false; timeScale = 1;
      wave = makeWave(count, tune());
      if (wave.count) load(gen, wavePlaces(wave.count, tune(), at, (seed * 0.61803) % 1 * 2 * Math.PI), seed);
      return wave.count;
    },
    // the wave holds the boss back: Reeds still standing
    holds: () => !wave.boss,
    // true once, when the last Reed dies: the boss enters
    bossEnters: () => { const e = bossEnters(wave); if (e) entered = true; return e; },
    // each frame: the hunt, the fear and the temperament on last frame's bodies, the budgeted update, the dead laid down and taken away, the bodies read for the rules
    step(dt) {
      frame++;
      const T = tune(), W = T.wave, t = now(), prey = isaoPos();
      // the dead that have lain long enough go
      for (const r of reeds) if (r.dead && !r.gone && t - wave.reeds[r.id].diedAt >= W.corpse) drop(r);
      reeds = reeds.filter((r) => !r.gone);
      if (!reeds.length) { solverMs = 0; stepsNow = 0; return; }
      const cam = camera();
      if (cam) { cam.updateMatrixWorld(); frustum.setFromProjectionMatrix(viewM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); }
      let need = 0; lodNow = 0;
      for (const r of reeds) {
        if (!r.dead) {
          const fr = r.fear.step(t);
          r.temper.step(dt, fr.flight);
          const m = r.kit.motion;
          if (fr.mode === 'stun') m.active = false; else m.active = true;
          if (prey && fr.mode !== 'stun') {
            const p = aim(r.body.centre, fr.mode === 'flee' ? fr.point : prey);
            m.targetHeld = true;   // Isao is always held, as with the boss: the hold that takes him is the rules'
            r.kit.setTarget(target.set(p[0] / r.s, ARENA.lureHeight, p[1] / r.s));
          }
        }
        r.lod = !!W.lod && !r.dead && far(r, cam);
        if (r.lod) lodNow++;
        need += (r.lod ? 0.5 : 1) * dt / STEP * cost;
      }
      timeScale = need > W.budget ? W.budget / need : 1;
      let ms = 0, steps = 0;
      for (const r of reeds) {
        if (r.lod && ((frame + r.id) & 1)) continue;   // a far Reed steps every other frame
        try {
          steps += r.kit.update(dt * timeScale);
          ms += r.kit.timings.solver + r.kit.timings.skin;
        } catch (e) {   // a non-finite body: back at its place, whole in its shape
          onError(`Reed ${r.id}: ${e.message}`);
          r.kit.reset(); shiftKit(r.kit, r.place[0] / r.s, r.place[1] / r.s);
        }
      }
      if (steps > 0) cost = cost * 0.9 + (ms / steps) * 0.1;
      solverMs = ms; stepsNow = steps; push(meanSolver, ms); push(meanScale, timeScale);
      for (const r of reeds) { place(r); if (!r.dead) r.body = kitNow(r.kit, r.s, r.native); }
      const bodies = live().map((r) => ({ id: r.id, ...r.body, r }));
      hunted = prey ? nearestReed(bodies, prey) : bodies[0] ?? null;
    },
    // the player's round on every live Reed (the fight's falloff on each one's nearest contact), and the fear of those within its reach
    resolve(plan, dt = 0) {
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
    // a re-anchor of the lab's frame moves every local position: each Reed's arrays by the same vector in its own native units, as the boss's
    shift(sx, sz) {
      for (const r of reeds) {
        shiftKit(r.kit, sx / r.s, sz / r.s); r.place[0] += sx; r.place[1] += sz;
        if (r.body) r.body = kitNow(r.kit, r.s, r.native);
      }
    },
    // the acceptance's cheat: every Reed still standing dies now
    killAll() {
      let n = 0;
      for (const rr of wave.reeds) if (!rr.dead) { hurtReed(wave, rr.id, rr.hp, now()); n++; const r = reeds.find((x) => x.id === rr.id); if (r) die(r); }
      return n;
    },
    // the bar's and the readout's numbers
    bar: () => (wave.boss ? null : { alive: aliveCount(wave), count: wave.count }),
    stats: () => ({ solver: solverMs, steps: stepsNow, meanSolver: mean(meanSolver), timeScale, meanScale: mean(meanScale), lod: lodNow, cost }),
    // the handle's view: the wave's count, alive, made (bodies standing or lying), cleared, the boss in, each Reed's hit points and centre (local)
    state: () => ({
      count: wave.count, alive: aliveCount(wave), killed: wave.killed, made: reeds.length, cleared: waveCleared(wave), boss: wave.boss, entered,
      reeds: wave.reeds.map((rr) => { const r = reeds.find((x) => x.id === rr.id); return { id: rr.id, hp: rr.hp, dead: rr.dead, hits: rr.hits, body: !!r, centre: r?.body ? [...r.body.centre] : null, contacts: r?.body?.contacts.length ?? 0, lod: !!r?.lod }; }),
      hunted: hunted && !hunted.r.dead ? hunted.id : null, solver: solverMs, steps: stepsNow, timeScale, lod: lodNow, cost, meanSolver: mean(meanSolver), meanScale: mean(meanScale),
    }),
    dispose() { disposed = true; gen++; for (const r of reeds) drop(r); reeds = []; sphere.remove(root); },
  };
}
