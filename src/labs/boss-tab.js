// boss-tab.js — the Nih-Dairia boss lab (2026-10-08): the ported soft-body creature at thirty metres on the story planet,
// hunting the tank. The question is whether the scaled motion reads as a boss and what it costs, so the readout prices the
// creature (solver, skin, render) and the planet is cropped to the cap around the anchor.
//
// THE CREATURE SIMULATES IN ITS OWN FLAT METRES (native, 0.176 m across); a surface frame places it on the sphere. The rig is a
// group at the frame's origin, turned by the frame's basis and scaled by the display scale; the creature's mesh never moves
// inside it. The tank drives in the same local plane in real metres and is placed through the same frame at scale 1, then
// dropped onto the sphere, so the lure (the tank mapped back with toLocal) is exact.
//
// RE-ANCHORING. When the creature's centre walks REANCHOR_METRES from the origin the frame slides under it and every local position
// the solver and the behaviour hold shifts by the same vector, between frames, so no fixed step sees a jump. Refused while
// feeding is locked: the prey must not move.
//
// THE FEEDING RULE IS THE MODE IDEA: a tank that is driving counts as held and cannot be taken; a stopped tank within reach is
// cradled, covered and absorbed, `taken` rises, and the tank respawns thirty metres from the frame's origin.
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import GUI from '../../vendor/lil-gui.esm.js';
import { buildUnit, preloadMork } from '../units.js';
import { createPlaneDrive } from './boss/drive.js';
import { makeTankFeel, stepTankFeel, applyTankFeel, landTankFeel } from '../tankfeel.js';
import { FEEL, loadFeel } from '../feelstore.js';
import { makeAudio } from '../audio.js';
import { frameAt, toWorld, toLocal, reanchor, sagitta } from '../domain/surface-frame.js';
import { LOOKS } from '../looks.js';
import { STORY_RECIPE, STORY_CLEARING, STORY_DAY } from '../content/story-defaults.js';
import { createDaylight } from '../fx/daylight.js';
import { buildStoryPlanet } from '../domain/story-planet.js';
import { planetBake, loadPlanetBake } from '../platform/planet-bake.js';
import { buildStoryPlanetMesh } from './story-planet-mesh.js';
import { createNihDairia } from '../fx/nih-dairia/creature.js';
import { createPrey } from '../fx/nih-dairia/prey.js';
import { AutoLure } from '../fx/nih-dairia/auto-lure.js';
import { ARENA } from '../fx/nih-dairia/arena.js';
import { PHYS } from '../fx/nih-dairia/constants.js';
import { MOTION_CONTROLS } from '../fx/nih-dairia/motion-settings.js';
import { CREATURE_VARIANTS } from '../fx/nih-dairia/variants.js';
import { NIH_DAIRIA_MOTION, NIH_DAIRIA_VARIANT, NIH_DAIRIA_SIZE_METRES, NIH_DAIRIA_LOOK, NIH_DAIRIA_MODELS } from '../content/nih-dairia.js';

const TANK_R = 3.4;          // the swarm lab's hull scale: MÖRK at its real size
const DRIVE_R = 4.2;         // the hull's radius against the creature's body (the blocker)
const CRUISE_TAP = 0.35;     // seconds between two W taps that toggle cruise (td-tab.js noteFastTap)
const CAP_CELLS = 40;        // the planet is drawn within this many cells of the anchor
const RESPAWN_METRES = 30;   // after a meal the tank comes back this far east of the frame's origin
const CHASE = { up: 11, back: 26 };   // the chase camera's height and lead, as the swarm lab frames the tank
const WINDOW = 60;           // rolling means over this many frames
const DRIVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
const MEAL_PHASES = new Set(['cradling', 'covering', 'dropping', 'absorbing']);   // the tank is the prey, pinned
const LURES = ['tank', 'point', 'auto'];
// the frame slides under the creature once its centre is this far out. Each re-anchor pops the creature by the sagitta of
// the distance (d^2 / 2R: 0.27 m at the old two cells, 20 m; 17 mm at 5 m) and tilts it by d / R, and both grow with the
// square of the limit, while the shift itself is a few array passes: so a short limit, often
const REANCHOR_METRES = 5;

// a rolling mean over the last n samples
function roll(n) {
  const a = new Float64Array(n); let i = 0, count = 0, sum = 0;
  return {
    push(v) { if (!Number.isFinite(v)) return; if (count === n) sum -= a[i]; else count++; a[i] = v; sum += v; i = (i + 1) % n; },
    mean: () => (count ? sum / count : 0),
    clear() { i = 0; count = 0; sum = 0; },
  };
}

// THE CAP. buildStoryPlanetMesh bakes floors, rock and edges as non-indexed buffers in cell order, and the cells are not
// ordered by latitude, so no single draw range is the cap. A cropped copy is: keep the primitives whose first corner lies
// within `capMetres` of arc from the anchor direction, and replace each child's geometry. The file itself is unchanged.
function cropToCap(group, anchorUp, radius, capMetres) {
  const cosLimit = Math.cos(Math.min(Math.PI, capMetres / radius));
  const kept = {};
  for (const child of group.children) {
    const g = child.geometry, pos = g?.attributes.position; if (!pos) continue;
    const col = g.attributes.color, per = child.isLineSegments ? 2 : 3, stride = per * 3;
    const src = pos.array, keepPos = [], keepCol = [];
    for (let o = 0; o + stride <= src.length; o += stride) {
      const x = src[o], y = src[o + 1] + radius, z = src[o + 2], l = Math.hypot(x, y, z) || 1;
      if ((x * anchorUp[0] + y * anchorUp[1] + z * anchorUp[2]) / l < cosLimit) continue;
      for (let k = 0; k < stride; k++) keepPos.push(src[o + k]);
      if (col) for (let k = 0; k < stride; k++) keepCol.push(col.array[o + k]);
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.Float32BufferAttribute(keepPos, 3));
    if (col) next.setAttribute('color', new THREE.Float32BufferAttribute(keepCol, 3));
    g.dispose(); child.geometry = next;
    kept[child.name] = keepPos.length / stride;
  }
  return kept;
}

export function initBossTab(root) {
  const q = new URLSearchParams(location.search);
  root.innerHTML = `<div id="boss">
    <div class="sw-side">
      <h2>boss study</h2>
      <label>body <select data-k="variant">${CREATURE_VARIANTS.map((v) => `<option value="${v.id}">${v.name}</option>`).join('')}</select></label>
      <label>lure <select data-k="lure"><option value="tank">the tank (WASD)</option><option value="point">a point (click the ground)</option><option value="auto">the figure-eight</option></select></label>
      <label>view <select data-k="view"><option value="chase">chase</option><option value="free">free orbit</option></select></label>
      <button type="button" class="sw-run" data-act="disturb">disturb</button>
      <button type="button" class="sw-run" data-act="reset">reset</button>
      <button type="button" class="sw-run" data-act="reanchor">re-anchor now</button>
      <button type="button" class="sw-run" data-act="copy">copy settings</button>
      <textarea data-copy hidden readonly rows="8"></textarea>
      <p class="sw-note">A driving tank counts as held and cannot be taken. Stop within reach and it is cradled, covered and
      absorbed; the tank comes back thirty metres out and <b>taken</b> rises. The physics runs at the kit's native scale; size
      only places it.</p>
      <p class="sw-note" data-state>&nbsp;</p>
    </div>
    <div class="sw-stage">
      <div class="sw-callouts" data-callouts></div>
      <div class="sw-keys" data-keys>W A S D / arrows &middot; drive &middot; W twice &middot; cruise</div>
      <div class="sw-read" data-read>generating the story planet&hellip;</div>
    </div>
  </div>`;
  const stage = root.querySelector('.sw-stage'), read = root.querySelector('[data-read]');
  const stateLine = root.querySelector('[data-state]'), calloutsEl = root.querySelector('[data-callouts]');
  const variantSelect = root.querySelector('[data-k="variant"]');
  const look = LOOKS.tronColors;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  stage.append(renderer.domElement);
  // THE FIRST GPU RENDER OF THE PATCHED SKIN SHADER IS HERE: a failed program goes on the readout, not to the console
  const shaderErrors = [];
  renderer.debug.onShaderError = (gl, program, vs, fs) => {
    const logs = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs)].map((s) => (s || '').trim()).filter(Boolean);
    shaderErrors.push(logs.join(' | ').slice(0, 400) || 'shader program failed to link');
  };
  const scene = new THREE.Scene(); scene.background = new THREE.Color(look.bg);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.5, 6000);
  const controls = new OrbitControls(cam, renderer.domElement); controls.enableDamping = true; controls.enabled = false;
  const hemi = new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]); scene.add(hemi);
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]); scene.add(sun);
  const fill = new THREE.DirectionalLight(look.sun[0], 0.5); fill.position.set(-200, 120, -160); scene.add(fill);
  createDaylight({ hemi, sun, bg: scene.background, day: STORY_DAY.day, tune: STORY_DAY, phase: 0.2 });   // a fixed mid-morning
  // the planet's centre is the frame's origin; the story planet's scene puts the pole at y = 0, so the sphere-space group
  // sits one radius down and everything placed through a frame goes in it
  const sphere = new THREE.Group(); scene.add(sphere);
  const rig = new THREE.Group(); rig.name = 'Nih-Dairia rig'; sphere.add(rig);

  const state = { variant: NIH_DAIRIA_VARIANT, lure: 'tank', view: 'chase', sizeMetres: NIH_DAIRIA_SIZE_METRES };
  variantSelect.value = state.variant;   // the default is content's, not the option order's
  const params = { motion: { ...NIH_DAIRIA_MOTION }, phys: { gravity: PHYS.gravity, iterations: PHYS.iterations }, feeding: true, instinct: true };
  let active = false, disposed = false, built = false, raf = 0, last = performance.now(), t = 0;
  let planet = null, planetMesh = null, frame = null, creature = null, prey = null, cropped = null;
  let native = 0.176, scale = state.sizeMetres / native, taken = 0, lastMeals = 0, frames = 0, programsSeen = 0;
  let loading = false, fatal = null, frameError = null, frameErrorAt = -1, reanchors = 0, firstRender = false;
  const auto = new AutoLure();
  const meanSolver = roll(WINDOW), meanSkin = roll(WINDOW), meanSteps = roll(WINDOW), meanCentre = roll(WINDOW);
  const meanReach = roll(WINDOW), meanSag = roll(WINDOW), meanRender = roll(2), cutFrames = roll(WINDOW);
  let renderMs = 0, readAcc = 0;
  let pointWorld = null;   // the point lure, in sphere space (world-fixed, so a re-anchor never moves it)
  // the auto-lure's arena centre in the creature's local metres: the kit's figure-eight is centred on the local origin, so
  // without this every re-anchor would re-centre it on the creature and it would random-walk off the cap. It takes every
  // re-anchor's shift like any other local position, so the figure-eight stays where the lab started.
  const arenaCentre = new THREE.Vector3();

  // --- the tank -----------------------------------------------------------------------------------------------------------
  const hullCols = { walker: 0x9fdcff, walkerHi: 0xffffff };
  let tank = buildUnit('mork', hullCols); tank.scale.setScalar(TANK_R); sphere.add(tank);
  preloadMork?.().then(() => {
    if (disposed) return;
    const m = buildUnit('mork', hullCols);
    if (!m || m.userData.loading) return;
    sphere.remove(tank); disposeObj(tank); m.scale.setScalar(TANK_R); tank = m; sphere.add(tank);
  }).catch(() => { /* the placeholder hull stands in */ });
  // local metres in the frame's plane: x east, z north; yaw 0 drives +z (north), the heading (sin yaw, cos yaw). The drive is the
  // game's feel (./boss/drive.js); `drive` is its state, which the lab places, re-anchors and pins
  loadFeel();                       // the tuning the unit bench saved
  const feel = makeTankFeel();
  const plane = createPlaneDrive({ feel }), drive = plane.state;
  plane.reset(RESPAWN_METRES, 0, Math.PI / 2);
  let scripted = null;   // { throttle, turn, until } from driveTank()
  let blocked = false, cruiseTap = false, lastFastTap = -9;
  // the engine bed: a looped handle, retried every frame while moving (loop() is null until the samples decode), as the game does
  const audio = makeAudio({ base: '../' }); audio.arm();   // the context is born on the first gesture
  let engine = null, engineRunning = false;
  const keys = new Set();
  const isText = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? '');
  const onDown = (e) => {
    if (isText(e)) return;
    const k = e.key.toLowerCase();
    if ((k === 'w' || k === 'arrowup') && !keys.has(k)) {   // a double tap of forward toggles cruise, as the game's input
      const s = performance.now() / 1000;
      if (s - lastFastTap < CRUISE_TAP) cruiseTap = true;
      lastFastTap = s;
    }
    keys.add(k); if (DRIVE_KEYS.includes(k)) e.preventDefault();
  };
  const onUp = (e) => keys.delete(e.key.toLowerCase());
  const onBlur = () => keys.clear();
  addEventListener('keydown', onDown); addEventListener('keyup', onUp); addEventListener('blur', onBlur);
  const keysHeld = () => DRIVE_KEYS.some((k) => keys.has(k));
  function driveInput() {
    if (scripted && t < scripted.until) return scripted;
    scripted = null;
    const tap = cruiseTap; cruiseTap = false;
    return {
      throttle: (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0),
      turn: (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0),
      cruiseTap: tap,
    };
  }
  // THE BODY IS A BLOCKER: the creature's floor contacts in local metres; within the hull's radius of the nearest one the tank is
  // pushed out away from the creature's centre by what it overlaps
  function bodyBlocker(x, z) {
    if (!creature) return null;
    const b = creature.body, c = b.contact;
    let best = Infinity;
    for (let i = 0; i < c.length; i++) {
      if (!(c[i] > 0)) continue;
      const d = Math.hypot(x - b.x[i * 3] * scale, z - b.x[i * 3 + 2] * scale); if (d < best) best = d;
    }
    if (!(best < DRIVE_R)) return null;
    const m = creature.motion.center;
    let nx = x - m.x * scale, nz = z - m.z * scale; const l = Math.hypot(nx, nz);
    if (l > 1e-9) { nx /= l; nz /= l; } else { [nx, nz] = plane.heading().map((v) => -v); }
    return { nx, nz, depth: DRIVE_R - best };
  }
  // the tank's sphere-space position: the frame's tangent point dropped onto the sphere, so the hull never floats
  function tankWorld(x = drive.x, z = drive.z) {
    const p = toWorld(frame, [x, 0, z], 1), l = Math.hypot(p[0], p[1], p[2]) || 1, r = planet.radius;
    return [p[0] / l * r, p[1] / l * r, p[2] / l * r];
  }
  const basis = new THREE.Matrix4(), turnQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  function placeTank() {
    const w = tankWorld(), tf = frameAt(w, planet.radius, 0, frame.east);
    tank.position.set(w[0], w[1], w[2]);
    tank.quaternion.setFromRotationMatrix(basis.makeBasis(new THREE.Vector3(...tf.east), new THREE.Vector3(...tf.up), new THREE.Vector3(...tf.north)));
    tank.quaternion.multiply(turnQ.setFromAxisAngle(Y, drive.yaw));
  }
  function respawnTank() {
    plane.reset(RESPAWN_METRES, 0, Math.PI / 2); scripted = null;
    tank.visible = true;
  }

  // --- the rig ------------------------------------------------------------------------------------------------------------
  function placeRig() {
    rig.position.set(frame.origin[0], frame.origin[1], frame.origin[2]);
    rig.quaternion.setFromRotationMatrix(basis.makeBasis(new THREE.Vector3(...frame.east), new THREE.Vector3(...frame.up), new THREE.Vector3(...frame.north)));
    rig.scale.setScalar(scale);
  }
  function nativeExtent(body) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < body.rest.length; i += 3) { const x = body.rest[i], z = body.rest[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    return Math.max(x1 - x0, z1 - z0) || 0.176;
  }
  function applySize() { scale = state.sizeMetres / native; if (frame) placeRig(); }

  // THE RE-ANCHOR. Which arrays: with the WebAssembly kernel on, SoftBody replaces body.x, body.previous, body.candidate and
  // body.velocity with Float64Array views on the kernel's memory, so body.x IS kernel.x; the Set below drops the aliases and
  // shifts each buffer once (and still covers the JavaScript fallback, where they are plain arrays). Velocity is untouched.
  // Beyond the solver: the behaviour's target and centres, the feeding cycle's prey and captured points, the cradle's anchor
  // and start shape, the traction anchors, and the gait's feet, swing starts and goals, which are positions in the same plane
  // (the gait pulls each foot toward them; left behind they would drag every leg twenty metres back).
  function shiftCreature(sx, sz) {
    const b = creature.body, m = creature.motion;
    const buffers = new Set([b.x, b.previous, b.candidate, b.kernel?.x, b.kernel?.previous, b.kernel?.candidate].filter(Boolean));
    for (const arr of buffers) for (let i = 0; i < arr.length; i += 3) { arr[i] += sx; arr[i + 2] += sz; }
    for (const arr of [m.traction.anchors, m.cradle.starts]) for (let i = 0; i < arr.length; i += 3) { arr[i] += sx; arr[i + 2] += sz; }
    const shiftV = (v) => { v.x += sx; v.z += sz; };
    for (const v of [m.target, m.center, m.torsoCenter, m.feeding.preyPosition, m.feeding.capturedPosition, m.cradle.anchor, b.center]) shiftV(v);
    for (const list of [m.gait.feet, m.gait.starts, m.gait.goals]) list.forEach(shiftV);
    shiftV(arenaCentre);
    // not redundant with update(): update only re-skins when it takes a fixed step, and a frame with none would draw the
    // unshifted skin in the moved rig
    b.updateSurface(); creature.appearance.update();
  }
  function tryReanchor(limit) {
    if (!creature || !frame) return false;
    if (creature.motion.feeding.locked) return false;   // the prey must not move
    const { frame: next, shift } = reanchor(frame, creature.motion.center.toArray(), planet.radius, scale, limit);
    if (!shift[0] && !shift[2]) return false;
    const w = tankWorld();
    shiftCreature(shift[0], shift[2]);
    frame = next; placeRig();
    const l = toLocal(frame, w, 1); drive.x = l[0]; drive.z = l[2];   // the tank stays put in the world
    reanchors++;
    return true;
  }

  // --- the creature -------------------------------------------------------------------------------------------------------
  // THE VARIANT. state.variant names the creature that exists (the export reads it), so it changes only once the new body
  // has loaded; the select is the request, and a switch made during a load is picked up when the load finishes.
  async function makeCreature(variant = state.variant) {
    loading = true;
    const phys = { ...PHYS, ...params.phys };
    try {
      const next = await createNihDairia({ ...params.motion }, variant, { models: NIH_DAIRIA_MODELS, look: NIH_DAIRIA_LOOK, phys });
      if (disposed) { next.dispose(); return; }
      creature?.dispose();
      creature = next; state.variant = variant;
      creature.motion.feeding.enabled = params.feeding; creature.motion.active = params.instinct;
      rig.add(creature.mesh);
      native = nativeExtent(creature.body); applySize();
      lastMeals = 0; fatal = null;
      warmPrey();
    } catch (e) {
      fatal = `Nih-Dairia could not load: ${e.message}`;
      read.textContent = fatal;
      variantSelect.value = state.variant;
    } finally { loading = false; }
    const wanted = variantSelect.value;
    if (!disposed && !fatal && wanted !== state.variant) await makeCreature(wanted);
  }
  // r160 compiles another program once the prey's clearcoat leaves 0, which the first wrap of a session would pay mid-feed:
  // compile both now, with the prey visible (compile only walks visible objects)
  function warmPrey() {
    if (!prey) return;
    const was = prey.mesh.visible, mat = prey.mesh.material;
    try {
      prey.mesh.visible = true;
      mat.clearcoat = 1e-4; renderer.compile(scene, cam);
      mat.clearcoat = 0; renderer.compile(scene, cam);
    } catch (e) { shaderErrors.push(`warm: ${e.message}`); }
    finally { prey.mesh.visible = was; }
  }

  async function build() {
    if (disposed || built) return;
    built = true;
    await loadPlanetBake();
    if (disposed) return;
    planet = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, planetBake());
    planetMesh = buildStoryPlanetMesh(planet, look, { wallMetres: STORY_RECIPE.wallMetres });
    // the story planet puts the clearing, and so the base, at the pole: the anchor
    const anchorUp = [0, 1, 0];
    cropped = cropToCap(planetMesh, anchorUp, planet.radius, CAP_CELLS * planet.cellMetres);
    scene.add(planetMesh);
    sphere.position.set(0, -planet.radius, 0);
    frame = frameAt(anchorUp, planet.radius, 0);
    prey = createPrey(NIH_DAIRIA_LOOK); prey.mesh.visible = false; rig.add(prey.mesh);
    placeRig(); placeTank();
    read.textContent = 'loading the creature…';
    await makeCreature();
    if (disposed || !creature) return;
    pointWorld = toWorld(frame, creature.motion.target.toArray(), scale);
  }

  // --- the point lure: a click on the ground ------------------------------------------------------------------------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let downAt = null;
  const onPointerDown = (e) => { downAt = [e.clientX, e.clientY]; };
  const onPointerUp = (e) => {
    if (!downAt || state.lure !== 'point' || !planetMesh) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null;
    if (moved > 5) return;   // a drag is the orbit, not a click
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const floors = planetMesh.getObjectByName('floors');
    const hit = floors && ray.intersectObject(floors, false)[0];
    if (hit) pointWorld = [hit.point.x, hit.point.y + planet.radius, hit.point.z];
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  // --- the frame's work ---------------------------------------------------------------------------------------------------
  const lureV = new THREE.Vector3(), arenaV = new THREE.Vector3();
  function lureTarget() {
    const m = creature.motion;
    if (state.lure === 'tank') return lureV.fromArray(toLocal(frame, tankWorld(), scale));
    if (state.lure === 'point') return pointWorld ? lureV.fromArray(toLocal(frame, pointWorld, scale)) : lureV.copy(m.target);
    // the kit's figure-eight, in the creature's local metres about the world-fixed arena centre
    const target = lureV.copy(m.target).sub(arenaCentre), centre = arenaV.copy(m.center).sub(arenaCentre);
    auto.step(dtNow, target, centre);
    return target.add(arenaCentre);
  }
  let dtNow = 0;
  function step(dt, cut) {
    const m = creature.motion, f = m.feeding;
    tryReanchor(REANCHOR_METRES);
    const pinned = state.lure === 'tank' && MEAL_PHASES.has(f.phase);
    let driving = false;
    if (!pinned) ({ moving: driving, blocked } = plane.step(dt, driveInput(), bodyBlocker));
    else { drive.speed = 0; scripted = null; blocked = false; }
    const moving = driving || keysHeld() || (scripted && t < scripted.until);
    m.targetHeld = state.lure === 'tank' ? !!moving : false;   // the point and the auto-lure are never held
    auto.enabled = state.lure === 'auto';
    if (!f.locked) { dtNow = dt; creature.setTarget(lureTarget().setY(ARENA.lureHeight)); }
    let steps = 0;
    try {
      steps = creature.update(dt);
    } catch (e) {
      // a non-finite body: say so, start over, keep the frame going
      frameError = String(e.message); frameErrorAt = t;
      creature.reset(); lastMeals = 0;
    }
    if (f.meals > lastMeals) {
      lastMeals = f.meals; taken++;
      if (state.lure === 'tank') { showCallout('TAKEN'); respawnTank(); }
    }
    if (f.meals < lastMeals) lastMeals = f.meals;
    if (state.lure === 'tank' && MEAL_PHASES.has(f.phase)) {
      // the kit holds the prey fixed: the tank is wherever the prey is, and gone once it is concealed
      const p = toWorld(frame, f.preyPosition.toArray(), scale), l = toLocal(frame, p, 1);
      drive.x = l[0]; drive.z = l[2];
      tank.visible = f.visible;
    } else tank.visible = true;
    if (state.lure === 'point' && f.locked) pointWorld = toWorld(frame, m.target.toArray(), scale);   // follows the kit's spawn
    prey.update(f); prey.mesh.visible = state.lure !== 'tank' && f.visible;
    placeTank();
    // hover, idle vibration, the touchdown rock and the bank: the game's own, read through the persisted tuning
    stepTankFeel(feel, dt, driving, FEEL);
    applyTankFeel(tank, feel, FEEL);
    runEngine(driving);
    // the readout's numbers, per frame, into the rolling means
    const tm = creature.timings;
    meanSolver.push(tm.solver); meanSkin.push(tm.skin); meanSteps.push(steps); cutFrames.push(cut ? 1 : 0);
    meanCentre.push(m.velocity.length() * scale);
    meanReach.push(reachLocal() * scale);
    meanSag.push(sagitta(farthestContact() * scale, planet.radius));
  }
  function runEngine(on) {
    if (on) { engineRunning = true; if (!engine) engine = audio.loop('tank_engine'); return; }
    if (!engineRunning) return;
    engineRunning = false; engine?.stop(); engine = null; landTankFeel(feel);   // it sets down, and rocks as it lands
  }
  // the farther probing arm's tip from the centre: the outermost node of the lead and second-lead limbs
  function reachLocal() {
    const m = creature.motion, b = creature.body, limbs = m.traction.limbs, c = m.center;
    let best = 0;
    for (let i = 0; i < limbs.length; i++) {
      if (limbs[i] !== m.pursuit.lead && limbs[i] !== m.pursuit.secondLead) continue;
      const d = Math.hypot(b.x[i * 3] - c.x, b.x[i * 3 + 2] - c.z); if (d > best) best = d;
    }
    return best;
  }
  // the floor contact farthest from the frame's origin, where the flat floor departs most from the sphere
  function farthestContact() {
    const b = creature.body, c = b.contact; let best = 0;
    for (let i = 0; i < c.length; i++) if (c[i] > 0) best = Math.max(best, Math.hypot(b.x[i * 3], b.x[i * 3 + 2]));
    return best;
  }

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpUp = new THREE.Vector3();
  const scenePoint = (w, out) => out.set(w[0], w[1] - planet.radius, w[2]);
  function frameCamera() {
    controls.enabled = state.view === 'free';
    if (state.view === 'free') { controls.update(); return; }
    const c = creature.motion.center, cw = toWorld(frame, [c.x, 0, c.z], scale), tw = tankWorld();
    const up = tmpUp.set(...frame.up);
    const creatureAt = scenePoint(cw, tmpA), tankAt = scenePoint(tw, tmpB);
    const toward = creatureAt.clone().sub(tankAt); toward.addScaledVector(up, -toward.dot(up));
    if (toward.lengthSq() < 1e-6) toward.set(...frame.north); toward.normalize();
    cam.up.copy(up);
    cam.position.copy(tankAt).addScaledVector(toward, -CHASE.back).addScaledVector(up, CHASE.up);
    const lookAt = tankAt.clone().lerp(creatureAt, 0.5).addScaledVector(up, 2);
    cam.lookAt(lookAt); controls.target.copy(lookAt);
  }

  const gl = renderer.getContext();
  function costMs(samples = 3) {
    const s = [];
    for (let i = 0; i < samples; i++) { const a = performance.now(); renderer.render(scene, cam); gl.finish(); s.push(performance.now() - a); }
    s.sort((x, y) => x - y); return s[s.length >> 1];
  }
  function checkPrograms() {
    const programs = renderer.info.programs ?? [];
    if (programs.length === programsSeen) return;
    programsSeen = programs.length;
    for (const p of programs) if (p.diagnostics && p.diagnostics.runnable === false) {
      const d = p.diagnostics, msg = `${p.name ?? 'program'}: ${(d.fragmentShader?.log || d.vertexShader?.log || d.programLog || 'failed').trim().slice(0, 300)}`;
      if (!shaderErrors.includes(msg)) shaderErrors.push(msg);
    }
  }

  function showCallout(text) {
    while (calloutsEl.children.length >= 3) calloutsEl.firstChild.remove();
    const d = document.createElement('div'); d.className = 'callout co-milestone'; d.textContent = text;
    calloutsEl.append(d); setTimeout(() => d.remove(), 1600);
  }

  const fmt = (v, n = 2) => v.toFixed(n);
  function readout() {
    const m = creature?.motion;
    return {
      ready: !!creature && !loading, solver: meanSolver.mean(), steps: meanSteps.mean(), skin: meanSkin.mean(), render: meanRender.mean(),
      centre: meanCentre.mean(), reach: meanReach.mean(), sag: meanSag.mean(), taken, state: m?.state ?? null, phase: m?.feeding.phase ?? null, held: !!m?.targetHeld,
      size: state.sizeMetres, scale, lure: state.lure, variant: state.variant, cut: cutFrames.mean() > 0, frames, reanchors,
      speed: drive.speed, blocked, cruise: drive.cruise,
      tank: { x: drive.x, z: drive.z, speed: drive.speed, visible: tank.visible },
      shaderErrors: shaderErrors.slice(), error: fatal ?? frameError, cropped,
      kernel: !!creature?.body.kernel,
    };
  }
  function drawReadout() {
    if (fatal) { read.textContent = fatal; return; }
    const r = readout();
    const stepsHtml = r.cut ? `<b class="late">${fmt(r.steps, 1)}</b>` : `<b>${fmt(r.steps, 1)}</b>`;
    let html = `solver <b>${fmt(r.solver)} ms</b> (${stepsHtml} steps) &middot; skin <b>${fmt(r.skin)} ms</b> &middot; render <b>${fmt(r.render)} ms</b>`
      + ` &middot; centre <b>${fmt(r.centre)} m/s</b> &middot; reach <b>${fmt(r.reach, 1)} m</b> &middot; sag <b>${fmt(r.sag)} m</b> &middot; taken <b>${r.taken}</b>`
      + `<br>size ${r.size} m (&times;${fmt(r.scale, 0)}) &middot; ${r.state ?? '—'} &middot; ${r.variant} &middot; lure ${r.lure}`
      + ` &middot; ${r.kernel ? 'wasm kernel' : 'js solver'} &middot; re-anchored ${r.reanchors}`;
    if (shaderErrors.length) html += `<br><b class="late">shader: ${escapeHtml(shaderErrors[shaderErrors.length - 1])}</b>`;
    if (frameError && t - frameErrorAt < 5) html += `<br><b class="late">${escapeHtml(frameError)}; reset</b>`;
    read.innerHTML = html;
    stateLine.textContent = `state ${r.state ?? '—'} · feeding ${r.phase ?? '—'}`;
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function resize() {
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    if (renderer.domElement.width === Math.round(w * renderer.getPixelRatio()) && renderer.domElement.height === Math.round(h * renderer.getPixelRatio())) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }

  function loop() {
    if (!active || disposed) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now(), gap = (now - last) / 1000; last = now;
    const dt = Math.min(0.05, gap), cut = gap > 0.05; t += dt;
    resize();
    if (!planet) return;
    root.querySelector('[data-keys]').hidden = state.lure !== 'tank';
    if (creature && !loading && !fatal) { step(dt, cut); frameCamera(); }
    try {
      renderer.render(scene, cam);
      frames++;
      if (!firstRender) { firstRender = true; checkPrograms(); }
      checkPrograms();
      if (creature && frames % 30 === 0) { renderMs = costMs(); meanRender.push(renderMs); }
    } catch (e) {
      shaderErrors.push(`render: ${e.message}`); active = false;   // a shader that cannot build: say so and stop drawing
      drawReadout(); return;
    }
    readAcc += dt;
    if (readAcc > 0.2 && creature) { readAcc = 0; drawReadout(); }
  }

  // --- the panel ----------------------------------------------------------------------------------------------------------
  const gui = new GUI({ title: 'NIH-DAIRIA', container: root });
  const folders = {};
  for (const c of MOTION_CONTROLS) {
    const folder = folders[c.group] ??= gui.addFolder(c.group);
    const ctl = folder.add(params.motion, c.key, c.min, c.max, c.step).name(c.label)
      .onChange((v) => { if (creature) creature.settings[c.key] = v; });
    ctl.domElement.title = c.hint;
  }
  const body = gui.addFolder('Body');
  body.add(state, 'sizeMetres', 5, 120, 1).name('size (m)').onChange(applySize);
  body.add(params.phys, 'gravity', 0, 10, 0.05).name('gravity').onChange((v) => { if (creature) creature.phys.gravity = v; });
  body.add(params.phys, 'iterations', 1, 8, 1).name('iterations').onChange((v) => { if (creature) creature.phys.iterations = v; });
  body.add(params, 'feeding').name('feeding').onChange((v) => { if (creature) creature.motion.feeding.enabled = v; });
  body.add(params, 'instinct').name('instinct').onChange((v) => { if (creature) creature.motion.active = v; });

  function setLure(kind) {
    if (!LURES.includes(kind)) return false;
    state.lure = kind; root.querySelector('[data-k="lure"]').value = kind;
    if (kind === 'auto') auto.reset();
    if (kind === 'point' && creature && frame) pointWorld = toWorld(frame, creature.motion.target.toArray(), scale);
    return true;
  }
  for (const el of root.querySelectorAll('[data-k]')) el.addEventListener('input', () => {
    const k = el.dataset.k;
    if (k === 'lure') setLure(el.value);
    else if (k === 'view') state.view = el.value;
    else if (k === 'variant' && el.value !== state.variant && planet && !loading) makeCreature(el.value);   // during a load: picked up after it
  });
  const copyBox = root.querySelector('[data-copy]');
  function copySettings() {
    const json = JSON.stringify({ version: 1, variant: state.variant, motion: { ...(creature?.settings ?? params.motion) }, sizeMetres: state.sizeMetres }, null, 2);
    const fallback = () => { copyBox.hidden = false; copyBox.value = json; copyBox.focus(); copyBox.select(); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(() => { copyBox.hidden = true; showCallout('COPIED'); }, fallback);
    else fallback();
    return json;
  }
  function reset() {
    if (!creature) return;
    creature.reset(); lastMeals = 0; respawnTank(); auto.reset();
    if (pointWorld && frame) pointWorld = toWorld(frame, creature.motion.target.toArray(), scale);
  }
  root.querySelector('.sw-side').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'disturb') creature?.motion.disturb();
    else if (act === 'reset') reset();
    else if (act === 'reanchor') tryReanchor(0);
    else if (act === 'copy') copySettings();
  });

  const api = {
    setActive(on) {
      active = on;
      if (on) { last = performance.now(); if (!built) setTimeout(build, 30); cancelAnimationFrame(raf); loop(); }
      else { cancelAnimationFrame(raf); runEngine(false); }
    },
    dispose() {
      if (disposed) return;
      disposed = true; active = false; cancelAnimationFrame(raf);
      removeEventListener('keydown', onDown); removeEventListener('keyup', onUp); removeEventListener('blur', onBlur);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      creature?.dispose(); if (prey) { prey.mesh.geometry.dispose(); prey.mesh.material.dispose(); }
      planetMesh?.userData.dispose(); disposeObj(tank); gui.destroy(); controls.dispose(); renderer.dispose(); renderer.domElement.remove();
      engine?.stop(0); engine = null; audio.dispose();
      if (window.__bossLab === lab) delete window.__bossLab;
    },
  };
  // the browser step's handle (Task 6): published only for the acceptance harness
  const lab = {
    readout,
    creature: () => creature,
    setLure,
    // a stopped tank; `near` puts it `at` native metres from the creature's centre, on the side it already stands. The
    // default 0.05 is inside the kit's 0.075 capture radius and can land under an arm: a prey inside the skin never lets the
    // cradle finish (its minimum gap stays below -0.0005), so a meal is tested from outside the reach, as the kit's prey is
    stopTank({ near = false, at = 0.05 } = {}) {
      keys.clear(); scripted = null; plane.reset();
      if (near && creature) {
        const c = creature.motion.center, cx = c.x * scale, cz = c.z * scale;
        let dx = drive.x - cx, dz = drive.z - cz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        const r = at * scale;
        plane.reset(cx + dx * r, cz + dz * r);
      }
      return { x: drive.x, z: drive.z };
    },
    driveTank(seconds = 1) { scripted = { throttle: 1, turn: 0, until: t + seconds }; return true; },
    copySettings, reset, reanchor: () => tryReanchor(0),
  };
  if (q.get('acceptance') === '1') window.__bossLab = lab;
  resize();
  return api;
}

function disposeObj(o) {
  o?.traverse?.((c) => { c.geometry?.dispose?.(); c.material?.dispose?.(); });
}
