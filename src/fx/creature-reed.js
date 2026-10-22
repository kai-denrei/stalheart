// THE NIH-DAIRIA FAMILY'S BODIES IN THE GAME (owner, 2026-10-12; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md,
// "Reed drawing"): the second body adapter behind src/fx/creature-bodies.js's family interface (the first, src/fx/creature-cutis.js, has the
// interface's list). Every body is one soft body of the ported kit (src/fx/nih-dairia, its wasm kernel and its own fixed step), the tier's
// `variant` (the Reed, four limbs, at the small, medium and big tiers; the Nih-Dairia itself at the huge one) at the tier's width (2 x r0
// metres): the kit simulates in native units, `s` metres each.
//
// A FRAME OF ITS OWN. The planet is 753 m round: one plane for every body would float a body at 120 m 9.6 m over the ground and stretch the
// far ones sideways, so each body simulates in the plane of its own surface frame (src/domain/surface-projection.js: origin a unit point,
// the azimuthal-equidistant plane round it) and is DRAWN as the boss lab draws each Reed (src/labs/boss/wave.js "THE PLANE"): an outer group
// on the sphere point under its centre, turned to the tangent there and scaled, an inner one taking its centre back to the origin. When the
// body has walked `reanchor` metres from its frame's origin the frame moves to the point under it (its heading carried, carryFrame) and the
// kit is shifted back by the same vector (src/fx/nih-dairia-kit.js shiftKit, the lab's re-anchor). The family's group cancels the bodies'
// root's transform (the heart's frame), so the outer groups are placed in the scene's own coordinates, on the unit sphere.
//
// THE RECORD OWNS THE POSITION. The kit's pursuit hunts the record's aim point (the record's point `follow.lead` s ahead, in the body's
// frame); a body more than the leash behind for `follow.grace` s (or twice the leash at once) is re-placed on the record's point (its frame
// moved there and the kit shifted, its pose kept; counted). The record's lift (rising out of a breach) lowers the drawing.
// THE BODY OWNS HER POSITION (owner, 2026-10-23, b/c/e: "nih-dairia aggro is different ... it tries to aggro on the tank, but fears the 40mm"; spec
// docs/superpowers/specs/2026-10-23-arena-lab-fight-design.md, decision 3): a track with `led` (THE ARENA's boss, src/fx/boss-run.js) hunts `apos` as it is
// handed in (the prey point: the hull, the fear's flee point, her own centre while stunned), never the record's, and is never leashed or re-placed; the record
// takes its point from the body instead (src/fx/enemy-step.js). `body(h)` hands the caller the kit (its live settings, the fear's disturb, the stun's
// `motion.active`), the body's unit point and its shape in the caller's plane (`toLocal(unitPoint) -> [x, z]`: the centre, the floor contacts, every node
// [x, z, height]), the lab's kitNow/nodesOf through the body's own frame.
//
// THE COST. One parsed cage per variant (loaded on first use), each body a copy with its own surface geometry (the lab's cageCopy); bodies
// are made `batch` a frame once the cage is in (a record whose body is not made yet is alive and walks, its view inactive). The solver steps
// at 1/240 s, 1/120 s while more than `coarse.above` of the family's bodies stand (the lab's switch; the huge tier always at 1/240 s), by
// handing the kit's fixed stepper a scaled dt as the lab does. Outside the probe the family's solver is held to `budget` ms a frame (past it
// every body's clock runs slower alike, the lab's wave budget); the probe passes `budget: null` and measures the true cost.
//
// THE DEATH (the v1 death, the boss lab's): its motion off, the gravity up, it collapses `collapse` s; then its solver stops and it sinks
// and fades over `fade` s, and its body goes. No carcasses in the game for now.
import * as THREE from '../../vendor/three.module.js';
import { createNihDairia, loadMonsterCage } from './nih-dairia/creature.js';
import { PHYS } from './nih-dairia/constants.js';
import { ARENA } from './nih-dairia/arena.js';
import { NIH_DAIRIA_LOOK, NIH_DAIRIA_MODELS } from '../content/nih-dairia.js';
import { CREATURE_REED } from '../content/creature-enemies.js';
import { surfaceFrame, carryFrame, toPlane, fromPlane } from '../domain/surface-projection.js';
import { waveStep } from '../domain/boss-wave.js';
import { cageCopy, shiftKit } from './nih-dairia-kit.js';

const STEP = PHYS.step;   // the kit's fixed step (1/240 s): its stepper counts in these
const COST0 = 0.6;        // ms a body's step costs before one is measured (the boss lab's)
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// the kit's width and height at rest, native units
function restExtent(body) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < body.rest.length; i += 3) {
    const x = body.rest[i], y = body.rest[i + 1], z = body.rest[i + 2];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { width: Math.max(x1 - x0, z1 - z0) || 0.176, height: y1 - Math.min(0, y0) };
}

// `parent` the bodies' root (the heart's frame, plane metres), `tiers` CREATURE_TIERS.reed, `follow` CREATURE_FOLLOW, `knobs` CREATURE_REED,
// `budget` the solver's ms a frame (null: none, the probe), `solid` the kit's look without its transmission (&reedlook=solid: a body with
// transmission makes three.js draw every opaque object of the scene a second time into the transmission target, once a frame however many
// bodies, ~1500 draw calls on a sector; the probe prices it both ways), `hz` the solver's rate for every tier but a `fine` one whatever the
// count (&reedhz=N, owner 2026-10-13: "masses of small Cutis vs masses of small reeds, which is cheaper"; null: the coarse switch)
export function createReedFamily({ parent, tiers, follow, knobs = CREATURE_REED, budget = knobs.budget, solid = false, hz = null }) {
  const look = solid ? { ...NIH_DAIRIA_LOOK, transmission: 0 } : NIH_DAIRIA_LOOK;
  const K = knobs;
  const group = new THREE.Group(); group.name = 'Nih-Dairia enemies'; group.matrixAutoUpdate = false; parent.add(group);
  const cages = new Map();   // variant -> { parsed, error }
  const books = new Map();   // tier -> its counts
  const bodies = new Set(), pending = [];
  const target = new THREE.Vector3(), basis = new THREE.Matrix4(), ex = new THREE.Vector3(), ey = new THREE.Vector3(), ez = new THREE.Vector3();
  let R = 0, clock = 0, cost = COST0, rate = STEP, timeScale = 1, solverMs = 0, stepsNow = 0, stepped = 0, perBody = 0, meanMs = 0;
  let switches = 0, reanchors = 0, errors = 0, lastError = null, disposed = false;

  function book(key) {
    let b = books.get(key);
    if (!b) { b = { alive: 0, peak: 0, placed: 0, replaced: 0, deaths: 0, full: 0 }; books.set(key, b); }
    return b;
  }
  // the variant's parsed cage: loaded once, null until it is in
  function cage(variant) {
    let c = cages.get(variant);
    if (!c) {
      c = { parsed: null, error: null }; cages.set(variant, c);
      loadMonsterCage(variant, NIH_DAIRIA_MODELS).then((p) => { c.parsed = p; }, (e) => { c.error = e.message; lastError = `cage ${variant}: ${e.message}`; });
    }
    return c.parsed;
  }

  // `grow`: the record's scale over the tier's (THE ARENA's small Reeds three times the size, owner 2026-10-18, note 8b: "make the smaller reeds 3x bigger, same
  // health"): the body's width, its leash and its re-anchor follow `r0` x grow
  function add(key, { pos, apos = pos, lift = 0, grow = 1 }) {
    const def = tiers[key], b = book(key);
    if (!def) return null;
    if (b.alive >= def.capacity) { b.full++; return null; }
    const h = { key, def, r0: def.r0 * (grow > 0 ? grow : 1), pos, apos, lift, kit: null, frame: null, s: 1, height: 0, outer: null, inner: null, dead: false, gone: false, behind: 0, deadAt: 0, fading: false };
    pending.push(h); cage(def.variant);
    b.alive++; b.placed++; b.peak = Math.max(b.peak, b.alive);
    return h;
  }

  // the body made: at the record's latest point, hunting its aim
  async function make(h, parsed) {
    try {
      const kit = await createNihDairia({ ...K.motion, ...h.def.motion }, h.def.variant, { models: NIH_DAIRIA_MODELS, look, phys: { ...PHYS }, cage: cageCopy(parsed) });
      if (h.gone || disposed) { kit.dispose(); return; }
      const ext = restExtent(kit.body);
      kit.motion.feeding.enabled = false;
      h.kit = kit; h.s = (2 * h.r0) / ext.width; h.height = ext.height; h.frame = surfaceFrame(h.pos);
      h.outer = new THREE.Group(); h.inner = new THREE.Group();
      h.outer.name = `${h.def.label} body`; h.inner.add(kit.mesh); h.outer.add(h.inner); group.add(h.outer);
      bodies.add(h); aim(h); place(h);
    } catch (e) { errors++; lastError = e.message; h.failed = true; book(h.key).failed = (book(h.key).failed ?? 0) + 1; }
  }

  function aim(h) {
    const [ax, az] = toPlane(h.frame, h.apos, R), m = h.kit.motion;
    h.kit.setTarget(target.set(ax / h.s, ARENA.lureHeight, az / h.s)); m.targetHeld = true;   // held: no feeding, as the lab's hunt
  }
  // the frame moved to unit point `p` and the kit shifted so its centre is that point's (a re-anchor under it, or a re-place on the record)
  function moveTo(h, p) {
    const c = h.kit.motion.center;
    h.frame = carryFrame(h.frame, p); shiftKit(h.kit, 0 - c.x, 0 - c.z);
  }

  function track(h, { pos, apos = pos, lift = 0, dt = 0, led = false }) {
    if (!h || h.dead) return false;
    h.pos = pos; h.apos = apos; h.lift = lift; h.led = !!led;
    if (!h.kit) return false;
    if (h.led) { h.behind = 0; aim(h); return false; }   // THE BODY OWNS HER POSITION: no leash, no re-place
    const c = h.kit.motion.center, [rx, rz] = toPlane(h.frame, pos, R), lag = Math.hypot(c.x * h.s - rx, c.z * h.s - rz);
    const leash = Math.max(follow.leashRadii * h.r0, follow.leashMin);
    h.behind = lag > leash ? h.behind + dt : 0;
    if (lag > 2 * leash || h.behind > follow.grace) {
      h.behind = 0; moveTo(h, pos); aim(h); book(h.key).replaced++;
      return true;
    }
    aim(h);
    return false;
  }

  function kill(h) {
    if (!h || h.dead) return;
    h.dead = true;
    const b = book(h.key); b.alive--; b.deaths++;
    if (!h.kit) { drop(h); return; }   // still being made: no body to die
    const m = h.kit.motion;
    m.active = false; m.feeding.enabled = false; h.kit.phys.gravity = K.deathGravity; h.deadAt = clock;
    if (K.grey) grey(h.kit.mesh, K.grey);
  }
  // THE DEAD READ GREY (owner, 2026-10-19, note 1; CREATURE_REED.grey): the body's own colours to one grey, its tissue's light and dark kept as `pattern`, at once (each body owns its
  // geometry and material: src/fx/nih-dairia/appearance.js)
  function grey(mesh, G) {
    const c = mesh.geometry.getAttribute('color'), a = c?.array, mat = mesh.material;
    if (a) { for (let k = 0; k < a.length; k += 3) { const l = G.grey * (1 - G.pattern + G.pattern * 2 * (a[k] * 0.299 + a[k + 1] * 0.587 + a[k + 2] * 0.114)); a[k] = a[k + 1] = a[k + 2] = l; } c.needsUpdate = true; }
    mat.attenuationColor?.setHex(G.attenuation); if (mat.clearcoat > 0) mat.clearcoat = Math.max(1e-3, G.clearcoat);
  }
  function drop(h) {
    h.gone = true;
    const i = pending.indexOf(h);
    if (i >= 0) pending.splice(i, 1);
    if (h.kit) { group.remove(h.outer); h.kit.dispose(); h.kit = null; }
    bodies.delete(h);
  }
  function free(h) {
    if (!h || h.gone) return;
    if (!h.dead) { h.dead = true; book(h.key).alive--; }
    drop(h);
  }

  // drawn through its own frame on the sphere under its centre (see A FRAME OF ITS OWN), lowered by the record's lift and the death's sink
  function place(h) {
    const c = h.kit.motion.center, p = fromPlane(h.frame, c.x * h.s, c.z * h.s, R), tf = carryFrame(h.frame, p);
    h.outer.position.set(p[0], p[1], p[2]);
    h.outer.quaternion.setFromRotationMatrix(basis.makeBasis(ex.fromArray(tf.ex), ey.fromArray(tf.ey), ez.fromArray(tf.ez)));
    h.outer.scale.setScalar(h.s / R);
    const sink = h.fading ? clamp01((clock - h.deadAt - K.collapse) / K.fade) * K.sink * h.height : 0;
    h.inner.position.set(-c.x, h.lift / h.s - sink, -c.z);
  }

  function step(dt) {
    clock += dt;
    if (!(R > 0)) return;
    parent.updateMatrix(); group.matrix.copy(parent.matrix).invert(); group.matrixWorldNeedsUpdate = true;
    // made `batch` a frame, once the variant's cage is in
    for (let i = 0, made = 0; i < pending.length && made < K.batch;) {
      const h = pending[i], parsed = cage(h.def.variant);
      if (!parsed) { i++; continue; }
      pending.splice(i, 1); make(h, parsed); made++;
    }
    // the rate: 1/120 s while many stand (a `fine` tier at the kit's own)
    let standing = 0;
    for (const h of bodies) if (!h.dead && !h.def.fine) standing++;
    const want = hz > 0 ? 1 / hz : waveStep(standing, K.coarse, STEP);
    if (want !== rate) { rate = want; switches++; }
    const stepOf = (h) => (h.def.fine ? STEP : rate);
    // the budget (outside the probe): the frame's solver priced from the running cost of a step
    let need = 0;
    for (const h of bodies) if (!h.fading) need += dt / stepOf(h) * cost;
    timeScale = budget && need > budget ? budget / need : 1;
    let ms = 0, steps = 0, n = 0;
    for (const h of [...bodies]) {
      if (h.dead && !h.fading && clock - h.deadAt >= K.collapse) {   // collapsed: the solver stops, it sinks and fades
        h.fading = true; h.kit.mesh.castShadow = false;
        const mat = h.kit.mesh.material; mat.transparent = true; mat.depthWrite = false; mat.needsUpdate = true;
      }
      if (h.fading) {
        const f = clamp01((clock - h.deadAt - K.collapse) / K.fade);
        h.kit.mesh.material.opacity = 1 - f;
        if (f >= 1) { drop(h); continue; }
        place(h); continue;
      }
      const st = stepOf(h);
      try {
        h.kit.phys.step = st;   // each fixed step simulates this; the stepper counts 1/240 s ones, so it is handed dt x (1/240) / step (the lab's)
        steps += h.kit.update(dt * timeScale * STEP / st);
        ms += h.kit.timings.solver + h.kit.timings.skin; n++;
      } catch (e) {   // a non-finite body: whole again, on its record
        errors++; lastError = e.message;
        h.kit.reset(); h.frame = surfaceFrame(h.pos);
      }
      if (!h.dead) {
        const c = h.kit.motion.center;
        if (Math.hypot(c.x, c.z) * h.s > Math.max(K.reanchor, K.reanchorSizes * 2 * h.r0)) { moveTo(h, fromPlane(h.frame, c.x * h.s, c.z * h.s, R)); aim(h); reanchors++; }
      }
      place(h);
    }
    if (steps > 0) cost = cost * 0.9 + (ms / steps) * 0.1;
    solverMs = ms; stepsNow = steps; stepped = n;
    meanMs = meanMs * 0.9 + ms * 0.1;
    if (n > 0) perBody = perBody ? perBody * 0.9 + (ms / n) * 0.1 : ms / n;
  }

  function setPlanet(r) { if (r > 0) R = r; }

  const hzOf = (def) => Math.round(1 / (def.fine ? STEP : rate));
  // the body's shape in the caller's plane (THE BODY OWNS HER POSITION, above): the contacts and the nodes listed once a call, on first read
  function shapeOf(h, toLocal) {
    const b = h.kit.body, s = h.s, c = h.kit.motion.center, n = b.x.length / 3, at = (i) => toLocal(fromPlane(h.frame, b.x[i * 3] * s, b.x[i * 3 + 2] * s, R));
    let contacts = null, nodes = null;
    return { centre: toLocal(fromPlane(h.frame, c.x * s, c.z * s, R)), radius: h.r0,
      get contacts() { if (!contacts) { contacts = []; for (let i = 0; i < n; i++) if (b.contact[i] > 0) contacts.push(at(i)); } return contacts; },
      get nodes() { if (!nodes) { nodes = []; for (let i = 0; i < n; i++) { const p = at(i); nodes.push([p[0], p[1], b.x[i * 3 + 1] * s]); } } return nodes; } };
  }
  return {
    add, track, kill, free, step, setPlanet,
    roots: () => [group],
    // each tier present: bodies alive (made or still being made), still being made, dying, the most alive at once, placed, re-placed on the
    // leash, deaths, refused for want of a slot; the family's solver: its rate for the tier, its ms this frame and a running mean, the ms a
    // body costs a frame (running), the steps this frame, the budget's time scale, the re-anchors, the errors
    stats: () => Object.fromEntries([...books].map(([key, b]) => {
      const def = tiers[key];
      let made = 0, dying = 0, waiting = 0;
      for (const h of bodies) if (h.key === key) { if (h.dead) dying++; else made++; }
      for (const h of pending) if (h.key === key) waiting++;
      return [key, { live: b.alive, made, pending: waiting, failed: b.failed ?? 0, dying, peak: b.peak, placed: b.placed, replaced: b.replaced, deaths: b.deaths, full: b.full, capacity: def.capacity, r0: def.r0,
        variant: def.variant, hz: hzOf(def), solverMs: +solverMs.toFixed(2), solverMean: +meanMs.toFixed(2), bodyMs: +perBody.toFixed(3), steps: stepsNow, stepped, timeScale: +timeScale.toFixed(3),
        budget: budget ?? null, solid, switches, reanchors, errors, lastError }];
    })),
    // round two (the fable review: the probe counted bodies still being made, or never made, as alive): whether a record's body stands drawn
    drawn: (h) => !!h?.kit && !h.failed,
    // THE BODY OWNS HER POSITION (2026-10-23): the made, living body's kit, unit point and shape; null before it is made or once it is dead
    body(h) {
      if (!h?.kit || h.dead || h.failed) return null;
      const c = h.kit.motion.center;
      return { kit: h.kit, point: fromPlane(h.frame, c.x * h.s, c.z * h.s, R), radius: h.r0, shape: (toLocal) => shapeOf(h, toLocal) };
    },
    // one body's view, for the harness: its centre's unit point (the seam projects it), its radius, made and standing, dead, the collapse
    // and the fade (0..1), the lift, its behaviour's state, the rate
    view(h) {
      if (!h) return null;
      const made = !!h.kit, c = made ? h.kit.motion.center : null;
      const k = h.dead ? clock - h.deadAt : 0;
      return { tier: h.key, variant: h.def.variant, point: made ? fromPlane(h.frame, c.x * h.s, c.z * h.s, R) : h.pos, radius: h.r0, made, active: made && !h.dead, dead: h.dead, gone: h.gone,
        deflate: h.dead ? clamp01(k / K.collapse) : 0, opacity: h.fading ? 1 - clamp01((k - K.collapse) / K.fade) : 1, lift: h.lift, stage: made ? h.kit.motion.state : 'making', hz: hzOf(h.def) };
    },
    dispose() { disposed = true; for (const h of [...bodies, ...pending]) drop(h); pending.length = 0; parent.remove(group); },
  };
}
