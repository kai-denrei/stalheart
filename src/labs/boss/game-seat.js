// game-seat.js — the boss lab's bait mode in the game's own gunship seat (owner, 2026-10-09: "why are we re-inventing the wheel? just
// re-use the EXACT Same views from the Gunship in the main game; a) thermal, b) smaller ground view on the bottom right. c) same sound
// effects, etc. except we want multiple nukes"; spec docs/superpowers/specs/2026-10-09-boss-bait-game-seat-design.md). The seat IS the
// game's: src/sentry-pilot.js (its pose, lens, zoom, keys, HUD and every sound cue), the GROUND TRUTH monitor src/fx/story-monitor.js
// rendered after the main view as td-tab.js renders it, the FLIR src/fx/flir-pass.js and the heat tagging src/fx/thermal-heat.js. This
// file is their host, the lab's td-tab.js: the pilot's host hooks, the gunship bag and the frame's rig.
//
// THE GAME'S UNITS. The seat, the optic, the MK-9 body and the monitor work on the game's unit sphere (cell indices, `cellSide` 0.0133,
// `aimOnSphere` at radius 1, the monitor camera's far plane at 50) with the planet's centre at the world origin. The lab's scene is in
// metres with the pole at the origin. While the seat is mounted the scene itself is scaled by 1 / radius and lifted by one, so the
// world IS the game's: the lab's parts keep their metres inside the scene, the seat's parts live in `game`, a group in the planet-centred
// sphere scaled by the radius (its world matrix the identity), and the camera takes the game's near and far planes. The lights' targets
// are in the scene (the lab adds them) so the sun keeps its direction. The cell lattice is the lab planet's own graph (the game's planet
// builder), indexed by src/cellindex.js as td-tab.js indexes it. A cell is planet.cellSide here and 10 m in the lab's metres.
// THE EXPLOSIONS size their puffs in view space (src/fx/explosions.js: never by the object's scale), so in the game's world they are spawned
// in game units by the seat's own instance (`spawn`, which the lab's arena and Isao's end go through while the seat is mounted); the lab's
// own are cleared when the world changes units under them.
//
// THE RIG. src/fx/gunship-rig.js is not reused: its bag reads the game's GUNSHIP_GUNS (the lab needs its copy, `perPass` 0 and the knob's
// MK-9 reload) and its host is the game's board (story, dungeon, towers, the strike). The lab steps the same pieces in the same order:
// the platform's clock, held on station for ever (the lab's `stationForever`), the optic riding the orbit, the MK-9's body, the warn
// rings, then the seat's `gunshipTick`. THE ORBIT (docs/superpowers/specs/2026-10-09-boss-bait-arena-and-feel-design.md, item 1): the
// platform flies src/domain/boss-orbit.js `orbitAt` round the arena's centre (`orbit.radius` 200 m, one lap per `orbit.lap` 120 s) at the
// game's altitude, its heading along the circle, on the seat's own clock (it runs with the lab's, held by P), continuous through a round's
// reset: the seat never leaves, no departure, no arrival, no cut. The orbit's ground point is the host's world-fixed `orbitGround`, so a
// re-anchor of the lab's frame never moves it. The seat's yaw is the platform's and sentry-pilot.js's holdAim gives back what the heading
// turned, so the view keeps its world direction and slides with the platform: the gunner corrects the drift (a falling MK-9 follows the
// aim's cell once). THE BANK (`orbit.bank`, into the turn) is the KORP hull's: the optic is a stabilised gimbal, its frame (the platform
// object the pilot aims through) stays level. Rolled, the frame would tilt the pilot's forward out of the horizontal and its aim, which
// sentry-pilot.js reads back through that frame, would miss by some twenty metres at the orbit's slant.
//
// THE RULES: every round the seat fires is resolved by the boss fight through the friendlies' landing and burn paths (`resolve`), which
// tell the fear, Isao and the arena as they do for the schedule's plans: a 25 mm round burns the fight's rotary footprint for 1/rate s
// where it lands (one hit a burst), a 40 mm round and the MK-9 land with the fight's radius and damage (the falloff to the nearest floor
// contact). `G.damage` is a no-op (the landing is resolved once, not per contact); `G.enemies()` is the creature (its centre) for the HUD's
// contacts; `G.bodies()` is Isao, so the readout's `In blast` and the MK-9's DANGER CLOSE warn before a round lands on him. The panel's
// switches gate the guns (`gate()`), and a round that is not running fires nothing.
//
// THE MK-9 HOLDS ITS GROUND POINT (2026-10-09: the orbit's drift used up the falling round's one nudge, src/sentry-pilot.js gunshipTick nudges it onto the aim's
// cell as soon as that changes): while a round is released or ignited, before each seat tick the reticle is put back on the round's ground point (its cell's
// centre at the release) from where the platform is now (`holdRound`, the seat's own attach), plus what the mouse turned it by since the last frame, so the aim's
// cell changes only when the player moves the mouse. After a move the point held is where the aim then landed (`G.aim`, read back each tick).
//
// ISAO'S CAMERA (owner, 2026-10-09: "the camera still says 'ground truth/impact', it is not the POV of Isao"): the monitor shows his camera (`isaoCam()`, the
// lab's: his nose looking at the creature, ./bait.js) through a 70 degree lens, labelled ISAO · CAM, whenever he flies; `monitorCam(false)` (the lab's I)
// gives back the game's GROUND TRUTH impact view and its MK-9 feed, and with him gone the game's view comes back by itself. NO NUKE LINES (owner, 2026-10-09:
// "while in this mode, we should disable the 'nuke launched' lines, since they are the same voice as ISAO it is confusing"): the game's rig announces every
// MK-9 in Isao's voice (gunship-rig.js isaoSpeak('mk9_release')); this seat is the bait mode's, where Isao is the one being shot at, so its release says
// nothing (the release clunk, the motor and the blast are sounds, and stay). His own lines on the MK-9 are the chatter director's (./bait.js).
//
// KEYS: the seat swallows every key but H in the capture phase. Esc is its `leave` (the lab goes back to the tank), P its `pause`; the
// lab's R is a capture listener registered before any seat (boss-tab.js), so it runs first and the game's sentry-pilot.js is unchanged.
import * as THREE from '../../../vendor/three.module.js';
import { EffectComposer } from '../../../vendor/EffectComposer.js';
import { RenderPass } from '../../../vendor/RenderPass.js';
import { OutputPass } from '../../../vendor/OutputPass.js';
import { createSentryPilot } from '../../sentry-pilot.js';
import { makeCellIndex } from '../../cellindex.js';
import { createStoryMonitor } from '../../fx/story-monitor.js';
import { createThermalHeat } from '../../fx/thermal-heat.js';
import { createGunshipOptic } from '../../fx/gunship-optic.js';
import { createGunshipDrop } from '../../fx/gunship-drop.js';
import { createWarnRing } from '../../fx/warn-ring.js';
import { createExplosions } from '../../fx/explosions.js';
import { makeGunship, stepGunship, onStation, phaseLeft, passProgress, mountGunship, dismountGunship, selectGun, stepGun, aimOnSphere, splashDamage, dangerReport, fireRound, stepRounds, paintHeavy, launchHeavy, nudgeHeavy, stepHeavy, heavyState } from '../../domain/gunship.js';
import { GUNSHIP_GUNS, GUNSHIP_GUN_ORDER, GUNSHIP_NUKE, GUNSHIP_ORBIT, GUNSHIP_PLATFORM } from '../../content/gunship.js';
import { orbitAt } from '../../domain/boss-orbit.js';

const GAME_LENS = { near: 0.004, far: 50 };   // td-tab.js's camera, in the game's units
const RELOAD = 6;                // the lab's MK-9 reload, seconds (the knob's default; the game's is 20)
const STREAM_GAP = 0.3;          // 25 mm rounds landing closer than this in time are one burst: one hit
const WALL_LIFT = 0.4 * 0.7;     // the range ring's lift in cells: td-tab's wallHeight (4 m walls, 0.4 cells) x 0.7
const KEY = { rotary: 'rotary', bofors: 'bofors', nuke: 'heavy', heavy: 'heavy' };   // the lab's names to the game's
const NAME = { rotary: 'rotary', bofors: 'bofors', heavy: 'nuke' };
const ISAO_CAM = { fov: 70, label: 'ISAO · CAM' };   // the monitor on Isao: a drone camera's wide lens (the game's optic is 3-30 degrees)
const SHAKE = { share: 0.025, decay: 1.4 };   // the tremor's shake: its largest turn a share of the lens's field (0.6 degrees at the 23 degree optic), the trauma lost a second

// the game's post chain, small: the scene into a target, the OutputPass to display space, and the passes added after it (the FLIR) last,
// as src/postfx.js makeBloom's finalComposer runs them (its MSAA on the scene's buffer, none on the other); off, the scene goes straight
// to the screen. createFlir turns it on while thermal is.
function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.renderTarget1.samples = 0; composer.renderTarget1.depthBuffer = false; composer.renderTarget2.samples = 4;
  composer.addPass(new RenderPass(scene, camera)); composer.addPass(new OutputPass());
  const size = new THREE.Vector2(), had = new THREE.Vector2();
  let enabled = false;
  return {
    renderer,
    get enabled() { return enabled; },
    setEnabled(v) { enabled = !!v; },
    addFinalPass(pass) { composer.addPass(pass); },
    render(dt) {
      if (!enabled) { renderer.render(scene, camera); return; }
      renderer.getSize(size);
      if (!size.equals(had)) { had.copy(size); composer.setSize(size.x, size.y); }
      composer.render(dt);
      // ONE SWAP A FRAME IS ODD (owner, 2026-10-09: the rocks "flicker" in the thermal): the game's chain swaps twice (the bloom's add, the OutputPass), this one
      // only once, so the scene's RenderPass, which draws into the read buffer and does not swap, drew into renderTarget2 (MSAA, with a depth buffer) and renderTarget1
      // (neither) on alternate frames, and with no depth test the ground drew over a rock, which came and went at half the frame rate. Put back, the scene
      // always goes into renderTarget2
      if (composer.readBuffer !== composer.renderTarget2) composer.swapBuffers();
    },
    dispose() { for (const p of composer.passes) p.dispose?.(); composer.dispose(); },
  };
}

// `stage` the lab's stage (the seat's root: its panel, HUD and monitor go in it, it carries the seat's classes), `renderer`, `scene`,
// `camera`, `sphere` the planet-centred group (metres), `audio` the lab's sound engine, `explosions` the lab's (in the sphere, metres:
// cleared when the seat changes the world's units), `onError(message)` an explosion that cannot build,
// `planet()` the lab's story planet, `ground(x, z)` the sphere-space surface point under a local
// point and `local(p)` a sphere-space point to local [x, z], `tune()` the fight's numbers (`orbit` the platform's),
// `fight()` the round, `now()` the lab clock, `creature()` the rules' creature, `isao()` his marker ({ air, hp, max } or null),
// `parts()` { creature, isao, ring } the meshes the thermal heats (the arena's bound ring warm), `resolve(plan, dt)` the friendlies', `gate()` the panel's switches
// ({ fight, rotary, bofors, nuke }), `focus()` the local point a round opens on, `clear()` the stage's px the lab panel covers on the
// right, `leave()` back to the tank, `pause()` the lab's pause, `orbitGround(x, z)` the sphere-space surface point (metres) of a point
// [x, z] round the arena's centre, world-fixed (the orbit's ground track), `isaoCam()` Isao's camera ({ from, pos } sphere space, null when he is not flying),
// `afterKill()` true while a KILLED round still has something to shoot at (the boss's carcass, ./remains.js): the guns stay live on it
export function createGameSeat({ stage, renderer, scene, sphere, camera, audio, explosions, planet, ground, local,
  tune, fight, now, creature, isao, parts, resolve, gate, focus, orbitGround, isaoCam = () => null, afterKill = () => false, clear = () => 0, leave = () => {}, pause = () => {}, onError = () => {} }) {
  const params = { reload: RELOAD };
  let camIsao = true;   // the monitor on Isao (ISAO'S CAMERA); false: the game's GROUND TRUTH
  const feed = { last: null, cost: { isao: [0, 0], game: [0, 0] } };   // the descriptor drawn last frame (null: the game's) and the monitor's ms and frames by view
  // the lab's copy of the guns: the MK-9 has no limit a pass, and its reload is the knob's
  const heavy = { ...GUNSHIP_GUNS.heavy, perPass: 0 };
  Object.defineProperty(heavy, 'reload', { get: () => params.reload, enumerable: true });
  const guns = { ...GUNSHIP_GUNS, heavy };
  const shots = { rotary: 0, bofors: 0, nuke: 0 };
  const v = new THREE.Vector3(), look = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), goal = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  let m = null;   // the mounted seat: { pilot, G, gs, game, optic, drop, warn, monitor, post, thermal, over, saved, ... }
  let m0 = 0;     // the mounts so far (the harness checks the seat is never left and re-entered)
  let index = null, indexOf = null, heavyPress = 0, aimFocus = false, stream = null, streamAt = -Infinity, clearPx = -1;
  const fired = { at: -Infinity, forty: -Infinity };   // the lab's clock at the player's last round of any gun, and of the 40 mm (Isao's lines)
  // THE TREMOR'S SHAKE (owner, 2026-10-10: the Reeds and the boss "come out of a tremor in the center"): `shake(amount)` adds to a trauma (at most 1) that decays at
  // SHAKE.decay a second; while it lasts the main view is turned by a small jitter, its size a share of the lens's field (so the zoomed optic shakes as much on screen as
  // the wide one) times the trauma squared, for the frame's render only: the pilot's own pose and aim are never touched, the monitor is drawn unshaken
  const quake = { trauma: 0, time: 0, peak: 0, count: 0, saved: new THREE.Quaternion(), q: new THREE.Quaternion(), e: new THREE.Euler() };

  const norm = (p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
  const live = () => (fight().phase === 'fight' || (fight().phase === 'killed' && afterKill())) && gate().fight !== false;
  const allowed = (k) => gate()[NAME[k]] !== false;
  const camDist = (p) => Math.hypot(camera.position.x - p[0], camera.position.y - p[1], camera.position.z - p[2]);
  const toGame = (w) => { const R = planet().radius; return [w[0] / R, w[1] / R, w[2] / R]; };
  const fromGame = (p) => { const R = planet().radius; return [p[0] * R, p[1] * R, p[2] * R]; };
  const atLocal = (p) => local(fromGame(p));
  const explode = (use, p) => !!m && m.boom.spawn(use, p, norm(p), m.c);

  // the landings, through the fight: a 25 mm round burns, a 40 mm round lands; returned to the seat for its rings, bursts and sounds
  function land(list) {
    const T = tune();
    for (const r of list) {
      const at = atLocal(r.point);
      if (r.gun === 'rotary') {
        if (!stream || now() - streamAt > STREAM_GAP) stream = { kind: 'rotary', player: true, moving: true, radius: T.rotary.radius, damage: T.rotary.dps, at };
        stream.at = at; streamAt = now();
        resolve(stream, 1 / guns.rotary.rate);
      } else resolve({ kind: 'bofors', player: true, radius: T.bofors.radius, damage: T.bofors.damage, at, land: now() }, 0);
    }
    return list;
  }
  // the MK-9 lands: the fight's blast, and the game's own (src/fx/strike-console.js executeStrike): the sound, three warn rings, the explosion
  function blast(ci) {
    if (ci < 0) return;
    const T = tune(), c = m.G.centers[ci], r = guns.heavy.blastCells * m.c;
    resolve({ kind: 'nuke', player: true, radius: T.nuke.radius, damage: T.nuke.damage, at: atLocal(c), land: now() }, 0);
    audio.play('tank_destroyed', { dist: camDist(c) });
    m.warn.ring(ci, 0xffffff, 1.0, r); m.warn.ring(ci, 0xffb347, 0.7, r * 0.72); m.warn.ring(ci, 0xfff2c0, 0.45, r * 0.42);
    explode('gunship.nuke', c);
  }
  // the painted cell's strike ring (td-tab.js showRangeRing): a ring of points the MK-9's blast wide, on the surface
  function rangeRing(ci) {
    if (m.ring) { m.ring.removeFromParent(); m.ring.geometry.dispose(); m.ring.material.dispose(); m.ring = null; }
    if (ci < 0) return;
    const n = new THREE.Vector3().fromArray(m.G.normals[ci]).normalize(), t1 = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const t2 = new THREE.Vector3().crossVectors(n, t1), theta = guns.heavy.blastCells * m.c, pos = [];
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; v.copy(t1).multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a)); v.multiplyScalar(Math.sin(theta)).addScaledVector(n, Math.cos(theta)).normalize().multiplyScalar(1 + WALL_LIFT * m.c); pos.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    m.ring = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, color: 0xff2a1a, transparent: true, opacity: 0.9 })); m.game.add(m.ring);
  }
  // the top view's pick (T): the pointer's ray through the camera onto the sphere
  function cellAt(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
    const p = aimOnSphere(ray.ray.origin.toArray(), ray.ray.direction.toArray());
    return p ? index(p) : -1;
  }
  const cellOfLocal = (at) => index(norm(ground(at[0], at[1])));
  // the creature for the HUD's contacts and its nearest: one body, at its centre
  function enemies() {
    if (fight().phase === 'killed') return [];
    const c = creature().centre;
    return [{ id: 1, alive: true, pos: toGame(ground(c[0], c[1])), size: 1 }];
  }

  // the platform on its orbit `dt` seconds on: over the ground point, along the circle, the hull banked into the turn (see THE BANK above)
  const head = new THREE.Vector3(), side = new THREE.Vector3(), inward = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), bankQ = new THREE.Quaternion();
  function ride(dt) {
    m.orbitT += dt;
    const o = orbitAt(m.orbitT, tune()), h = o.heading, g = orbitGround(o.pos[0], o.pos[1]), a = orbitGround(o.pos[0] + Math.cos(h), o.pos[1] + Math.sin(h)), c = orbitGround(0, 0);
    m.over.set(g[0], g[1], g[2]).normalize();
    head.set(a[0] - g[0], a[1] - g[1], a[2] - g[2]);
    const platform = m.optic.platformObject(), was = platform.position.clone();
    m.optic.ride(m.over.toArray(), head.toArray(), true, 1);
    // the inside wing down: the platform's +x toward the centre goes under the horizon
    side.set(1, 0, 0).applyQuaternion(platform.quaternion); inward.set(c[0] - g[0], c[1] - g[1], c[2] - g[2]);
    m.bank = -Math.sign(side.dot(inward) || 1) * o.bank;
    const hull = platform.children[0];
    if (hull) { hull.userData.level ??= hull.quaternion.clone(); hull.quaternion.copy(bankQ.setFromAxisAngle(Z, m.bank)).multiply(hull.userData.level); }
    m.heading = h;
    const now3 = platform.position;
    m.vel = dt > 0 ? [(now3.x - was.x) / dt, (now3.y - was.y) / dt, (now3.z - was.z) / dt] : [0, 0, 0];
  }

  // the reticle on a local ground point: the seat's own attach (aimAt) measures from an eye 0.65 cells over the platform and fires from
  // 0.35 cells under it, so the point is lifted one cell along the platform's up and the gunner's ray lands exactly on it
  function aimAt(at) {
    if (!m) return null;
    const p = toGame(ground(at[0], at[1])), up = m.optic.platformObject().position.clone().normalize();
    m.pilot.aimAt([p[0] + up.x * m.c, p[1] + up.y * m.c, p[2] + up.z * m.c]);
    return at;
  }

  // the falling MK-9's hold (see THE MK-9 HOLDS ITS GROUND POINT): before the seat's tick, the reticle back on the held point from the platform's place now,
  // turned on by the mouse's yaw and pitch since the last frame; returns whether the mouse moved it (the point is then re-read after the tick)
  function holdRound() {
    const h = heavyState(m.gs, guns), s = m.pilot.state;
    if (h.phase !== 'released' && h.phase !== 'ignited') { m.hold = null; return false; }
    m.hold ??= { at: m.G.centers[h.ci].slice(), yaw: s.yaw, pitch: s.pitch };   // the first frame after the release: the round's cell centre, the mouse not counted
    const dy = s.yaw - m.hold.yaw, dp = s.pitch - m.hold.pitch, up = m.optic.platformObject().position.clone().normalize(), p = m.hold.at;
    m.pilot.aimAt([p[0] + up.x * m.c, p[1] + up.y * m.c, p[2] + up.z * m.c]);   // lifted a cell, as aimAt below: the gunner's ray lands on the point
    s.yaw += dy; s.pitch += dp;
    m.hold.yaw = s.yaw; m.hold.pitch = s.pitch;
    return dy !== 0 || dp !== 0;
  }

  function mount() {
    const P = planet(), R = P.radius, c = P.cellSide;
    if (indexOf !== P) { index = makeCellIndex(P.graph.centers, c * 1.7); indexOf = P; }
    const saved = { pos: scene.position.clone(), scale: scene.scale.clone(), near: camera.near, far: camera.far, fov: camera.fov, up: camera.up.clone(), camPos: camera.position.clone(), camQuat: camera.quaternion.clone() };   // the camera's pose too: the free orbit and the chase pick it up where the tank left it
    scene.scale.setScalar(1 / R); scene.position.set(0, 1, 0); scene.updateMatrixWorld(true);
    camera.near = GAME_LENS.near; camera.far = GAME_LENS.far; camera.updateProjectionMatrix();
    const game = new THREE.Group(); game.name = 'game seat (game units)'; game.scale.setScalar(R); sphere.add(game); game.updateMatrixWorld(true);
    const gs = makeGunship(GUNSHIP_ORBIT, { station: true });
    const optic = createGunshipOptic(game, { cellSide: c, metresPerCell: GUNSHIP_PLATFORM.metresPerCell });
    const makeDrop = () => createGunshipDrop(game, { cellSide: c, metresPerCell: GUNSHIP_PLATFORM.metresPerCell,
      onRelease: (p) => audio.play(GUNSHIP_NUKE.releaseSound, { dist: camDist(p) }),
      onIgnite: (p) => { audio.play(GUNSHIP_NUKE.igniteSound, { dist: camDist(p) }); explode('gunship.ignite', p); } });
    const post = createPost(renderer, scene, camera);
    explosions.clear();   // a puff of the lab's in flight would be the radius times too big in the game's units
    m = { c, R, gs, game, boom: createExplosions(game, { onError: (e) => onError(`explosions: ${e.message}`) }), optic, makeDrop, drop: makeDrop(), warn: createWarnRing(game, { graph: () => P.graph, cellSide: () => c }), post, saved,
      over: new THREE.Vector3(), orbitT: 0, heading: 0, bank: 0, mounts: m0 + 1, vel: [0, 0, 0], ring: null, aimed: null, hold: null, holds: 0 };
    m0 = m.mounts;
    m.thermal = createThermalHeat(() => ({ warm: [parts().creature, parts().ring], hot: [parts().isao, m?.drop.mesh()] }), { postfx: post });
    m.G = {
      state: gs, strike: null, tune: null, guns, order: GUNSHIP_GUN_ORDER, platform: GUNSHIP_PLATFORM,
      centers: P.graph.centers, normals: P.graph.normals,
      heart: () => cellOfLocal(isao()?.air ? local(isao().air) : focus()),   // "from base": what the lab protects is Isao
      lane: () => cellOfLocal(creature().centre),
      cell: (p) => index(norm(p)),
      cellAt,
      frame: () => {},   // the game's map framing: the lab has no orbit view
      enemies,
      damage: () => {},   // resolved once at the landing (`land`)
      onStation: () => onStation(gs), left: () => phaseLeft(gs), progress: () => passProgress(gs, GUNSHIP_ORBIT),
      mount: () => mountGunship(gs), dismount: () => dismountGunship(gs),
      select: (k) => allowed(k) && selectGun(gs, k, guns),
      step: (dt, held) => stepGun(gs, dt, held && live() && allowed(gs.gun), guns),
      fire: (g, p, travel) => { fireRound(gs, g, p, travel); shots[NAME[g]]++; fired.at = now(); if (g === 'bofors') fired.forty = now(); },
      landed: () => land(stepRounds(gs)),
      aim: (eye, dir) => (m.aimed = aimOnSphere(eye, dir)),   // the aim's ground point, read back by the MK-9's hold
      splash: splashDamage,
      bodies: () => { const b = isao(); return b ? [{ kind: 'isao', pos: toGame(b.air) }] : []; },
      danger: (p, r) => dangerReport(p, r, m.G.bodies()),
      blast,
      drop: { release: (from, to, up, vel) => !!m.drop.release(from, to, up, vel), steer: (to) => m.drop.steer(to) },
      vel: () => m.vel,
      explode,
      puff: (ci, hex, life, r) => { if (ci >= 0) m.warn.ring(ci, hex, life, r); },
      sfx: (name, pos, o) => { if (name) audio.play(name, { dist: camDist(pos), ...o }); },
      burst: () => {},   // the dot-burst fallback when an explosion cannot load: the lab's explosions always answer or say so on the readout
      laser: (ci) => rangeRing(ci),
      loop: (name, o) => audio.loop(name, o),
      paintHeavy: (ci, o) => allowed('heavy') && live() && paintHeavy(gs, ci, guns, o),
      launchHeavy: (o) => { if (!live()) return -1; const lc = launchHeavy(gs, guns, o); if (lc >= 0) { shots.nuke++; fired.at = now(); } return lc; },   // no voice: NO NUKE LINES (above)
      nudgeHeavy: (ci) => nudgeHeavy(gs, ci),
      stepHeavy: () => stepHeavy(gs),
      heavyState: () => heavyState(gs, guns),
      optic,
    };
    ride(0);
    // td-tab.js's pilotHost, for the gunship alone (no mounts, no guided rounds, no map view)
    m.pilot = createSentryPilot(stage, {
      mobile: false, gunship: m.G, select: () => {}, views: () => {}, thermal: (on) => m?.thermal.set(on), leave: () => leave(), pause: () => { pause(); if (m) m.pilot.state.held = false; },
      map: () => {}, wake: () => {}, cellSide: () => c, cone: () => 0, round: () => null, visible: () => true,
      zoom: (z) => { camera.fov = 60 / z; camera.updateProjectionMatrix(); }, lens: () => [camera.fov, camera.aspect],
      aimPoint: (eye, dir) => aimOnSphere(eye.toArray(), dir.toArray()),
      cameraPose: (eye, dir, up, g) => { camera.position.copy(eye); camera.up.copy(up); camera.lookAt(look.copy(eye).add(dir)); g.quat.copy(camera.quaternion); },
    });
    m.monitor = createStoryMonitor(stage);
    m.pilot.mountGunship();
    aimFocus = true;   // after the seat's first tick, which settles its opening aim (the lane's way, straight down)
    // the seat's own explosions compiled now, as the lab compiles its others (boss-tab.js): not on the first 40 mm landing's frame
    m.boom.prewarm({ compile: (s, c) => renderer.compile(s, c, scene), getRenderTarget: () => renderer.getRenderTarget(), setRenderTarget: (t) => renderer.setRenderTarget(t) }, camera);
  }

  function shakeView(dt) {
    quake.time += dt;
    if (quake.trauma <= 0) return false;
    const a = SHAKE.share * camera.fov * Math.PI / 180 * quake.trauma * quake.trauma, t = quake.time;
    const yaw = a * (0.6 * Math.sin(t * 37.1) + 0.4 * Math.sin(t * 61.7 + 1.3)), pitch = a * (0.6 * Math.sin(t * 43.3 + 2.1) + 0.4 * Math.sin(t * 71.9 + 0.7));
    quake.saved.copy(camera.quaternion);
    camera.quaternion.multiply(quake.q.setFromEuler(quake.e.set(pitch, yaw, 0))); camera.updateMatrixWorld();
    quake.peak = Math.max(quake.peak, Math.hypot(yaw, pitch) * 180 / Math.PI);
    quake.trauma = Math.max(0, quake.trauma - dt * SHAKE.decay);
    return true;
  }

  function unmount() {
    const s = m.saved;
    m.pilot.dispose(); m.thermal.dispose(); m.monitor.dispose(); rangeRing(-1);
    // the KORP model rides the platform, which optic.dispose() only detaches: its geometry, materials and textures go first (the hull's bank with it)
    m.optic.platformObject().traverse((o) => { o.geometry?.dispose?.(); for (const mat of [].concat(o.material ?? [])) { for (const t of Object.values(mat)) if (t?.isTexture) t.dispose(); mat.dispose?.(); } });
    m.drop.dispose(); m.optic.dispose(); m.post.dispose(); m.boom.dispose(); explosions.clear();
    m.game.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); m.game.removeFromParent();
    scene.position.copy(s.pos); scene.scale.copy(s.scale); scene.updateMatrixWorld(true);
    camera.near = s.near; camera.far = s.far; camera.fov = s.fov; camera.up.copy(s.up); camera.position.copy(s.camPos); camera.quaternion.copy(s.camQuat); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    m = null; heavyPress = 0; stream = null;
  }

  return {
    params,
    // the seat mounted or not: the lab asks each frame (the bait mode, not the free orbit, the planet and the creature there)
    sync(want) { if (want && !m) mount(); else if (!want && m) unmount(); return !!m; },
    owns: () => !!m,
    // the rig's frame, where the lab's fight steps (before the friendlies): the clock on station, the orbit, the MK-9's body, the rings, the seat
    tick(dt) {
      if (!m) return;
      stepGunship(m.gs, dt, GUNSHIP_ORBIT); m.gs.phase = 'station'; m.gs.left = GUNSHIP_ORBIT.station;
      ride(dt);
      m.drop.tick(dt); m.warn.tick(dt); m.boom.tick(dt);
      if (heavyPress > 0 && !m.pilot.state.held) { m.pilot.state.held = true; heavyPress--; }   // the handle's MK-9: paint, then release
      const moved = holdRound();
      m.pilot.gunshipTick(dt);
      if (m.hold) { m.holds++; if (moved && m.aimed) m.hold.at = m.aimed.slice(); }
      if (heavyPress === 1 && heavyState(m.gs, guns).phase !== 'painted') heavyPress = 0;   // nothing painted: no release owed
      if (aimFocus) { aimFocus = false; aimAt(focus()); }
    },
    // an explosion the lab spawns in its metres (the arena's, Isao's end) while the seat is mounted: in the game's units, by the seat's instance
    spawn(use, point, normal, cellSide) { if (!m) return explosions.spawn(use, point, normal, cellSide); return m.boom.spawn(use, toGame(point), normal, cellSide / m.R); },
    // the camera, where the lab frames it: the seat's pose
    pose() { if (m) m.pilot.pose(m.pilot.state.tower, goal); },
    // the frame's picture: the main view through the post chain (thermal), then the GROUND TRUTH monitor as td-tab.js draws it; false when
    // no seat is mounted (the lab renders as before)
    render(dt) {
      if (!m) return false;
      const px = Math.round(clear());
      if (px !== clearPx) { clearPx = px; stage.style.setProperty('--seat-clear', `${px}px`); }
      const shook = shakeView(dt);
      m.post.render(dt);
      if (shook) { camera.quaternion.copy(quake.saved); camera.updateMatrixWorld(); }
      const v = m.pilot.gunship && camIsao ? isaoCam() : null, own = v ? { from: toGame(v.from), pos: toGame(v.pos), lift: 0, ...ISAO_CAM } : null, a = performance.now();
      m.monitor.render(renderer, scene, own ? null : m.pilot.gunship ? m.drop.mesh() : null, m.c, dt, own ?? (m.pilot.gunship ? m.pilot.gunshipOptic() : null));
      const k = feed.cost[own ? 'isao' : 'game']; k[0] += performance.now() - a; k[1]++; feed.last = v;
      return true;
    },
    // a new round: no round in the air, no MK-9 falling, the tube clear, the aim back on the middle of the creature and Isao; the orbit flies on (no cut)
    reset() {
      if (!m) return;
      const gun = m.gs.gun;
      Object.assign(m.gs, makeGunship(GUNSHIP_ORBIT, { station: true }), { gun }); mountGunship(m.gs);
      if (m.drop.mesh()) { m.drop.dispose(); m.drop = m.makeDrop(); }
      m.optic.fade(1e6); rangeRing(-1); heavyPress = 0; stream = null; m.pilot.state.held = false;
      aimFocus = true;
    },
    // the tremor's shake: `amount` (0..1) more trauma; the thermal's state (the lab's carcasses cool in it)
    shake(amount) { quake.trauma = Math.min(1, quake.trauma + amount); quake.count++; },
    thermal: () => !!m?.thermal.flir,
    // the monitor's view: monitorCam(true) Isao's camera, monitorCam(false) the game's GROUND TRUTH; returns the choice
    monitorCam(on) { if (on !== undefined) camIsao = !!on; return camIsao; },
    // the trigger let go (the fight switched off, the mode changed)
    release() { heavyPress = 0; if (m) m.pilot.state.held = false; },
    // the player's fire for Isao's lines (./bait.js): the gun ('rotary' | 'bofors' | 'nuke'), the reticle (local metres; with the MK-9 only, else null), the lab's
    // clock at the last round of any gun and of the 40 mm, the MK-9 in flight as danger zones (`nukes`: [{ at, radius, until }], the cell it will fall on); null while the seat is not mounted
    gunner() {
      if (!m) return null;
      const gun = NAME[m.gs.gun], o = gun === 'nuke' ? m.pilot.gunshipOptic() : null, h = heavyState(m.gs, guns), T = tune();
      // the MK-9 in flight, release to landing, as a danger zone for Isao's autopilot (src/domain/boss-bait.js): its cell now, the ring, the lab's clock at the landing
      const nukes = h.phase === 'released' || h.phase === 'ignited' ? [{ at: atLocal(m.G.centers[h.ci]), radius: T.nuke.radius, until: now() + h.left }] : [];
      return { gun, reticle: o ? atLocal(o.pos) : null, shotAt: fired.at, fortyAt: fired.forty, nukes };
    },
    // seconds until the next MK-9 can be released: its fall and reload while one is out
    mk9In() { if (!m) return 0; const h = heavyState(m.gs, guns); return h.phase === 'released' || h.phase === 'ignited' ? h.left + guns.heavy.reload : h.phase === 'reloading' ? h.left : 0; },
    // the handle's: the reticle on a local ground point, a gun by the lab's name, the trigger (the MK-9's press paints and releases)
    aim: aimAt,
    gun(key) {
      if (m) { const k = KEY[typeof key === 'number' || /^[1-3]$/.test(key) ? GUNSHIP_GUN_ORDER[Number(key) - 1] : key]; stage.querySelector(`#sentry-pilot [data-gun="${k}"]`)?.click(); }
      return m ? NAME[m.gs.gun] : null;
    },
    fire(on) {
      if (!m) return false;
      if (m.gs.gun === 'heavy') { heavyPress = on ? 2 : heavyPress; return !!on; }
      m.pilot.state.held = !!on; return m.pilot.state.held;
    },
    state() {
      if (!m) return null;
      const o = m.pilot.gunshipOptic(), p = m.optic.platformObject().position, f = focus();
      return { gun: NAME[m.gs.gun], reticle: o ? atLocal(o.pos) : null, look: f, zoom: m.pilot.state.zoom, held: !!m.pilot.state.held, shots: { ...shots },
        altitude: (p.length() - 1) * m.R, cellMetres: m.c * m.R, heavy: heavyState(m.gs, guns), thermal: m.thermal.flir, view: m.pilot.state.view,
        // the platform: its ground point (local metres), the orbit's clock, heading (unwrapped) and the hull's bank (radians), and the mounts so far
        platform: { at: atLocal(p.toArray()), t: m.orbitT, heading: m.heading, bank: m.bank }, mounts: m.mounts,
        // the falling MK-9's hold: the held ground point (local metres, null when no round falls) and the frames held so far
        hold: m.hold ? atLocal(m.hold.at) : null, holds: m.holds,
        // the monitor: its label, Isao's camera chosen (`isao`) and drawn last frame (`from`, `pos` sphere metres; null when the game's view was), and the ms its
        // render took (summed) and the frames, by view
        monitor: { head: stage.querySelector('#story-monitor .head')?.textContent ?? null, isao: camIsao, from: feed.last?.from ?? null, pos: feed.last?.pos ?? null,
          fov: feed.last ? ISAO_CAM.fov : null, cost: { isao: [...feed.cost.isao], game: [...feed.cost.game] } },
        // the tremor's shake: the trauma now, the shakes asked for and the largest turn drawn (degrees)
        shake: { trauma: quake.trauma, count: quake.count, peak: quake.peak } };
    },
    dispose() { if (m) unmount(); },
  };
}
