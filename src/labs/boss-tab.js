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
//
// THE FIGHT (spec section 5): the gunship's rotary, Bofors, MK-9 and SOL-88 on the creature (./boss/friendlies.js), the fear and the arena
// (./boss/fear.js, ./boss/arena.js), the round's bar, cards and ending (./boss/round.js). KILLED is the v1 death: every movement stops and
// the gravity goes to `deathGravity`. LOST is a meal (feeding leaving `hunting`) or a landing on the hull. THE RESET (the round's, or the panel's button) puts the creature back at
// the frame's origin and the tank `respawn` metres out on the far side; it waits for a meal in progress (MEAL_WAIT at most) so
// the meal is counted in `taken` and the prey is never moved under the kit.
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import GUI from '../../vendor/lil-gui.esm.js';
import { buildUnit, preloadMork } from '../units.js';
import { createPlaneDrive } from './boss/drive.js';
import { createBodyRules, kitNow, shiftKit } from './boss/body.js';
import { createCannon } from './boss/cannon.js';
import { createFriendlies } from './boss/friendlies.js';
import { createFear } from './boss/fear.js';
import { createTemperament } from './boss/temperament.js';
import { createArena, deeper } from './boss/arena.js';
import { createRound } from './boss/round.js';
import { createBaitMode } from './boss/bait.js';
import { createGameSeat } from './boss/game-seat.js';
import { createGameCam } from './boss/game-cam.js';
import { createLabHandle } from './boss/handle.js';
import { createWave } from './boss/wave.js';
import { createLabSinkhole } from './boss/sinkhole.js';
import { settingsBlock, folderGroups } from './boss/settings-copy.js';
import { makeFight, startFight, capture, readout as fightReadout } from '../domain/boss-fight.js';
import { entryClear, emergence, keepOut } from '../domain/boss-wave.js';
import { BOSS_FIGHT } from '../content/boss-fight.js';
import { LASER_AUDIO } from '../content/orbital-laser.js';
import { voiceSounds } from '../content/voice-hooks.js';
import { SOUNDS } from '../audiomanifest.js';
import { BREACH_SOUNDS } from '../content/breach-defaults.js';
import { createExplosions } from '../fx/explosions.js';
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
import { NIH_DAIRIA_MOTION, NIH_DAIRIA_PREDATOR, NIH_DAIRIA_PREDATOR_SIZE_METRES, NIH_DAIRIA_VARIANT, NIH_DAIRIA_SIZE_METRES, NIH_DAIRIA_LOOK, NIH_DAIRIA_MODELS } from '../content/nih-dairia.js';

const TANK_R = 3.4;          // the swarm lab's hull scale: MÖRK at its real size
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
// THE CANNON (./boss/cannon.js): the game's three-second barrel (td-tab.js CANNON_COOL) and the sleeve's cool and hot colours
const CANNON_COOL = 3;
const SLEEVE_COOL = new THREE.Color(0x232833), SLEEVE_HOT = new THREE.Color(0xff2a10);
// a round's reset waits at most this many seconds for a meal in progress to finish (a prey under an arm never finishes)
const MEAL_WAIT = 12;
// THE LAB'S CELL IN ITS OWN UNITS: the scene is in metres (the sphere group's radius is planet.radius, 753 m), so a cell is planet.cellSide
// (unit sphere) x planet.radius = planet.cellMetres, which is STORY_RECIPE.metresPerCell by construction (src/domain/story-planet.js:37-39)
const CELL = STORY_RECIPE.metresPerCell;
// THE BAIT MODE'S BOSS HEALTH (docs/superpowers/specs/2026-10-09-boss-bait-arena-and-feel-design.md, item 5): its own knob, so the owner tunes
// the kill's length for his aim without touching the tank mode's `health`
const BAIT_HEALTH = 180;
// the first wave's slider: up to this many Reeds (owner, 2026-10-09: "5 to 50 (slider)"; 0 is the boss at once)
const WAVE_MAX = 50;
// the rules' creature while the wave holds the boss back, for what must not hit it (the friendlies' resolution): nowhere, no contacts
const NOBODY = Object.freeze({ centre: [1e9, 1e9], velocity: [0, 0], radius: 0, contacts: [] });

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
  const PLAYTEST = q.get('playtest') === '1';   // the friends' link: the dev controls hidden, Esc only frees the mouse
  root.innerHTML = `<div id="boss">
    <div class="sw-side">
      <h2>boss study</h2>
      <label data-dev>body <select data-k="variant">${CREATURE_VARIANTS.map((v) => `<option value="${v.id}">${v.name}</option>`).join('')}</select></label>
      <label data-dev data-tank-only>lure <select data-k="lure"><option value="tank">the tank (WASD)</option><option value="point">a point (click the ground)</option><option value="auto">the figure-eight</option></select></label>
      <label data-dev>view <select data-k="view"><option value="chase">chase</option><option value="free">free orbit</option></select></label>
      <label data-dev>mode <select data-k="mode"><option value="tank">tank (WASD)</option><option value="bait">bait (Isao flies, the creature hunts him)</option></select></label>
      <label data-dev>camera (V) <select data-k="cam"><option value="lab">lab</option><option value="game">game (rear view)</option></select></label>
      <button type="button" class="sw-run" data-dev data-act="disturb">disturb</button>
      <button type="button" class="sw-run" data-act="reset">reset</button>
      <button type="button" class="sw-run" data-dev data-act="reanchor">re-anchor now</button>
      <button type="button" class="sw-run" data-dev data-act="copy">copy settings (C)</button>
      <textarea data-copy hidden readonly rows="8"></textarea>
      <p class="sw-note" data-tank-only>A driving tank counts as held and cannot be taken. Stop within reach and it is cradled, covered and
      absorbed; the tank comes back thirty metres out and <b>taken</b> rises. The physics runs at the kit's native scale; size
      only places it.</p>
      <p class="sw-note" data-bait-only hidden>Bait mode: Isao flies low on autopilot and the creature hunts him; you are in the game's gunship
      seat. Click to lock the mouse and aim with it, <b>Space</b> or the button fires, <b>1 2 3</b> the 25 mm, 40 mm and MK-9 (paint, then
      release; no limit a pass, the reload is the fight folder's knob), <b>V</b> the ship, the wheel zooms, <b>Esc</b> the tank. The fight
      folder's rotary, Bofors and MK-9 switches gate your guns; every landing hurts Isao as it hurts the creature. The monitor is Isao's camera;
      <b>I</b> gives back the game's ground truth and MK-9 feed. <b>R</b> restarts, <b>C</b> copies the values to paste.</p>
      <p class="sw-note" data-friend hidden>Isao is the bait: he flies low and the creature hunts him. You are the gunship overhead.
      Click to lock the mouse and aim with it; <b>Space</b> or the mouse button fires; <b>1 2 3</b> pick the 25 mm, 40 mm and MK-9 nuke
      (paint, then release). Every hit hurts Isao too: place your strikes between the creature and Isao to drive it off, and nuke when
      <b>NUKE CLEAR</b> lights. The monitor is Isao's camera (<b>I</b> the impact view). <b>V</b> switches the view, the wheel zooms, <b>Esc</b> frees the mouse, <b>R</b> restarts. Desktop only.</p>
      <p class="sw-note" data-state>&nbsp;</p>
    </div>
    <div class="sw-stage">
      <div class="sw-callouts" data-callouts></div>
      <div class="sw-fps" data-fps hidden></div>
      <div class="sw-keys" data-keys>W A S D / arrows &middot; drive &middot; W twice &middot; cruise &middot; Space &middot; fire</div>
      <div class="sw-read" data-read>generating the story planet&hellip;</div>
    </div>
  </div>`;
  const stage = root.querySelector('.sw-stage'), read = root.querySelector('[data-read]');
  const stateLine = root.querySelector('[data-state]'), calloutsEl = root.querySelector('[data-callouts]');
  const variantSelect = root.querySelector('[data-k="variant"]');
  const LOOK = 'tronColors', look = LOOKS[LOOK];   // by name too: the game's sinkhole wears the board's look by its name (./boss/sinkhole.js)

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
  scene.add(sun.target, fill.target);   // in the scene, so the lights keep their direction when the gunner's seat scales it to the game's units (./boss/game-seat.js)
  // a fixed mid-morning, no sun or moon sprite: the day rig's disc distance is planet radii in the game and metres here, which put the sun 40 m over the arena (the bright dot in the thermal view, 2026-10-10)
  createDaylight({ hemi, sun, bg: scene.background, day: STORY_DAY.day, tune: { ...STORY_DAY, discs: null }, phase: 0.2 });
  // the planet's centre is the frame's origin; the story planet's scene puts the pole at y = 0, so the sphere-space group
  // sits one radius down and everything placed through a frame goes in it
  const sphere = new THREE.Group(); scene.add(sphere);
  const rig = new THREE.Group(); rig.name = 'Nih-Dairia rig'; sphere.add(rig);

  const state = { variant: NIH_DAIRIA_VARIANT, lure: 'tank', view: 'chase', cam: 'lab', mode: 'tank', sizeMetres: NIH_DAIRIA_SIZE_METRES };
  variantSelect.value = state.variant;   // the default is content's, not the option order's
  const params = { motion: { ...NIH_DAIRIA_MOTION }, phys: { gravity: PHYS.gravity, iterations: PHYS.iterations }, feeding: true, instinct: true };
  let active = false, disposed = false, built = false, raf = 0, last = performance.now(), t = 0, paused = false;
  let planet = null, planetMesh = null, frame = null, creature = null, prey = null, cropped = null, gameCam = null;
  let native = 0.176, scale = state.sizeMetres / native, taken = 0, lastMeals = 0, frames = 0, programsSeen = 0;
  let loading = false, fatal = null, frameError = null, frameErrorAt = -1, reanchors = 0, firstRender = false;
  const auto = new AutoLure();
  const meanSolver = roll(WINDOW), meanSkin = roll(WINDOW), meanSteps = roll(WINDOW), meanCentre = roll(WINDOW);
  const meanReach = roll(WINDOW), meanSag = roll(WINDOW), meanRender = roll(2), cutFrames = roll(WINDOW);
  let renderMs = 0, readAcc = 0, provokes = 0;
  // THE FPS CORNER (the wave's experiment, visible in the friends' link too): frames over real time, read twice a second
  const fpsEl = root.querySelector('[data-fps]');
  let fpsCount = 0, fpsAt = performance.now(), fps = 0;
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
  // the body's rules (./boss/body.js): the blocker, the projected nodes, the circle controller, the shell's hit and the shove
  const body = createBodyRules({ getCreature: () => creature, getScale: () => scale, drive });
  let scripted = null;   // { throttle, turn, until } from driveTank()
  let pin = null;        // { id, shape, until }: pinTo()'s hold of the creature's target on a shape's centre, the routing off
  let blocked = false, cruiseTap = false, lastFastTap = -9;
  // the engine bed: a looped handle, retried every frame while moving (loop() is null until the samples decode), as the game does
  // the samples' paths are the page's own (as the other labs'): a base of '../' climbed out of a sub-path (a CDN's /<user>/<repo>/<commit>/labs.html) and every sound 404ed
  const audio = makeAudio({ base: '', sounds: { ...SOUNDS, ...LASER_AUDIO, ...BREACH_SOUNDS, ...voiceSounds() } }); audio.arm();   // the context is born on the first gesture; SOL's burn loop is the laser lab's sample
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
    if (k === ' ') { e.preventDefault(); if (!keys.has(k)) fireCannon(); }   // the key-down edge: a held Space does not repeat
    if (k === 'r' && active && !e.repeat && !keys.has(k) && !e.ctrlKey && !e.metaKey && !e.altKey) newRound();   // a new round at the key-down edge (a held R or a browser reload chord does not repeat it)
    if (k === 'v' && active && !e.repeat && !keys.has(k) && tankOn() && !e.ctrlKey && !e.metaKey && !e.altKey) setCam(state.cam === 'game' ? 'lab' : 'game');   // the driving camera, at the key-down edge
    if (k === 'c' && active && !e.repeat && !keys.has(k) && !seat.owns() && !e.ctrlKey && !e.metaKey && !e.altKey) copySettings();   // the values to paste (the seat's own C is below)
    keys.add(k); if (DRIVE_KEYS.includes(k)) e.preventDefault();
  };
  const onUp = (e) => keys.delete(e.key.toLowerCase());
  const onBlur = () => keys.clear();
  addEventListener('keydown', onDown); addEventListener('keyup', onUp); addEventListener('blur', onBlur);
  const keysHeld = () => DRIVE_KEYS.some((k) => keys.has(k));
  function driveInput() {
    if (scripted?.circle && t < scripted.until && creature) return body.circleInput(typeof scripted.circle === 'function' ? scripted.circle() : scripted.circle);
    if (scripted && t < scripted.until) return scripted;
    scripted = null;
    const tap = cruiseTap; cruiseTap = false;
    return {
      throttle: (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0),
      turn: (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0),
      cruiseTap: tap,
    };
  }
  // the tank's sphere-space position: the frame's tangent point dropped onto the sphere, so the hull never floats
  function tankWorld(x = drive.x, z = drive.z) {
    const p = toWorld(frame, [x, 0, z], 1), l = Math.hypot(p[0], p[1], p[2]) || 1, r = planet.radius;
    return [p[0] / l * r, p[1] / l * r, p[2] / l * r];
  }
  // the hull for the game camera: its ground point and its heading as a world tangent (placeTank's frame, turned by the yaw)
  function hullPose() {
    const w = tankWorld(), tf = frameAt(w, planet.radius, 0, frame.east), s = Math.sin(drive.yaw), c = Math.cos(drive.yaw);
    return { pos: w, heading: [tf.east[0] * s + tf.north[0] * c, tf.east[1] * s + tf.north[1] * c, tf.east[2] * s + tf.north[2] * c] };
  }
  const basis = new THREE.Matrix4(), turnQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  function placeTank() {
    const w = tankWorld(), tf = frameAt(w, planet.radius, 0, frame.east);
    tank.position.set(w[0], w[1], w[2]);
    tank.quaternion.setFromRotationMatrix(basis.makeBasis(new THREE.Vector3(...tf.east), new THREE.Vector3(...tf.up), new THREE.Vector3(...tf.north)));
    tank.quaternion.multiply(turnQ.setFromAxisAngle(Y, drive.yaw));
  }
  // --- the cannon: the hull's muzzle along the turret, the hit on the body and the shove -------------------------------------
  const explosions = createExplosions(sphere, { onError: (e) => shaderErrors.push(`explosions: ${e.message}`) });
  // the layer programs compiled now, not on the first Bofors landing: prewarm takes its lights from the scene it was given, and
  // the lights are on `scene`, not the sphere group, so its compile is pointed at `scene` (the key the real frames use)
  explosions.prewarm({ compile: (s, c) => renderer.compile(s, c, scene), getRenderTarget: () => renderer.getRenderTarget(),
    setRenderTarget: (target) => renderer.setRenderTarget(target) }, cam);
  // the explosions the arena and Isao's end spawn: the lab's, or the game seat's while it is mounted (its world is in the game's units and a
  // puff is sized in view space, ./boss/game-seat.js)
  const fx = { spawn: (...a) => (seat.owns() ? seat.spawn(...a) : explosions.spawn(...a)) };
  // the ground under a local point, in sphere space (the explosions and the shells live in the sphere group)
  function surface(x, z) {
    const p = tankWorld(x, z), point = new THREE.Vector3(p[0], p[1], p[2]);
    return { point, normal: point.clone().normalize() };
  }
  const cannon = createCannon(scene, { sphere, surface, cellSide: CELL, explosions, sfx: audio, feel, cool: CANNON_COOL, onHit: provoke });
  // --- the fight: the rules (src/domain/boss-fight.js) on the lab's clock `t`, started by the tank's first movement; the gunship's
  // rotary, Bofors, MK-9 and SOL-88 fire on the creature from above (./boss/friendlies.js). `fightTune` is the lab's live copy of the numbers
  // (the panel's fight folder writes it; `makeFight` reads it at each reset, `schedule` every frame); its seed advances a round
  // unless `pinSeed`. `fightOn` holds the switches: `fight` off is the lab as before but for the obstacles, which stay (no shooters, no bar, no round)
  const fightTune = { ...JSON.parse(JSON.stringify(BOSS_FIGHT)), seed: 1 };
  // THE FIRST WAVE'S SIZE (./boss/wave.js): the panel's slider, or ?reeds=N for the friends' link (0 is the boss at once)
  if (q.get('reeds') !== null && Number.isFinite(+q.get('reeds'))) fightTune.wave.count = Math.max(0, Math.min(WAVE_MAX, Math.round(+q.get('reeds'))));
  const fightOn = { fight: true, rotary: true, bofors: true, nuke: true, sol: true, fear: true, obstacles: true, cannon: true, pinSeed: false };
  const baitOpts = { health: BAIT_HEALTH };
  const roundTune = () => (state.mode === 'tank' ? fightTune : { ...fightTune, health: baitOpts.health });   // the round's health is the mode's
  let fight = makeFight(roundTune());
  let hullLost = false;        // a landing took the hull: hidden until the reset
  let resetDue = -1;           // seconds a due reset has waited for a meal to finish; -1 when none is due
  let feedWas = 'hunting';     // the feeding phase last frame, for the capture on leaving 'hunting'
  // the creature for the rules, in local metres: the centre, its velocity, half the body's extent, the nodes on the floor
  const creatureNow = () => kitNow(creature, scale, native);
  // THE FIRST WAVE (./boss/wave.js) holds the boss back in the bait mode: hidden, not stepped, its fear and the fight's damage off; the rules' creature for Isao's
  // autopilot, his hold, his lines, the seat's focus and his camera is the Reed nearest him (the boss's own while no Reed has a body yet)
  const waving = () => !tankOn() && wave.holds();
  const huntedNow = () => (waving() ? wave.hunted() ?? creatureNow() : creatureNow());
  const huntedNodes = () => (waving() ? wave.huntedNodes() ?? body.nodes() : body.nodes());
  const huntedAim = () => (waving() ? wave.huntedAim() ?? creatureAim() : creatureAim());
  const tankOn = () => state.mode === 'tank';   // the bait mode has no tank: hidden, not driven, nobody's prey, the cannon off
  const tankNow = () => ({ pos: hullLost || !tankOn() ? [1e9, 1e9] : [drive.x, drive.z], radius: fightTune.hull.radius });   // a lost hull is no target
  // THE FEAR (./boss/fear.js, the rules in src/domain/boss-fear.js): what the friendlies report frightens the creature or stuns it
  let stunned = false;   // `motion.active` is held false by a stun in progress
  // in the bait mode the fear per gun (wave B): the 25 mm's barrage meter, the 40 mm's wild flight, the MK-9's panic, the arms counting for the reach; the
  // round's first 40 mm fright asks Isao for his stagger line
  const fear = createFear({
    tune: () => fightTune, creature: creatureNow, tank: () => (tankOn() ? tankNow() : bait.asTank()), fight: () => fight, now: () => t,
    kit: () => creature, on: () => fightOn.fight && fightOn.fear && !waving(),
    gunFear: () => !tankOn(), nodes: () => body.nodes(), onScare: (r) => { if (r.level === 'wild') bait.want('stagger'); },
  });
  // THE TEMPERAMENT (./boss/temperament.js, wave B): in the bait mode one layer writes the creature's live motion, the panel's knobs its base, with the
  // lunges and the fear's flights over it
  const temperament = createTemperament({ tune: () => fightTune, kit: () => creature, base: () => params.motion, on: () => !tankOn() });
  // THE ARENA (./boss/arena.js, the rules in src/domain/boss-arena.js): two rocks that stay and four obstacles the MK-9 breaks, in the
  // lab's ground palette. They block the tank, turn the creature's hunt round them and push its body out of them after every step
  const ground = (rgb) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2]).getHex();
  // THE ARENA'S WORLD-FIXED PLANE: the frame at the pole every round starts on (newRound). The bound's ring and the gunship's orbit are drawn
  // through it, so a re-anchor (which re-projects the lab's frame) never moves them; its origin is the arena's centre
  let homeFrame = null;
  function fixedWorld(x, z) {
    homeFrame ??= frameAt([0, 1, 0], planet.radius, 0);
    const p = toWorld(homeFrame, [x, 0, z], 1), l = Math.hypot(p[0], p[1], p[2]) || 1, r = planet.radius;
    return [p[0] / l * r, p[1] / l * r, p[2] / l * r];
  }
  const fixedSurface = (x, z) => { const point = new THREE.Vector3(...fixedWorld(x, z)); return { point, normal: point.clone().normalize() }; };
  const arena = createArena(sphere, {
    surface, cellSide: CELL, explosions: fx, tune: () => fightTune, scaleOf: () => scale, extentOf: () => native * scale,
    enabled: () => fightOn.obstacles, occupants: () => occupantsNow(), colors: { rock: ground(look.floors.visited), wall: ground(look.floors.spawn) },
    bounded: () => !tankOn(), fixed: fixedSurface,   // the bait mode's bound: Isao and the creature stay inside it
  });
  // what no shape may be stood up on: the creature (its centre and its half-width plus 2 m, as creatureNow's radius) and the tank (the hull), unless the hull is lost
  const occupantsNow = () => [...(creature ? [{ at: [creature.motion.center.x * scale, creature.motion.center.z * scale], radius: native * scale / 2 + 2 }] : []), ...(hullLost || !tankOn() ? [] : [{ at: [drive.x, drive.z], radius: fightTune.hull.radius }])];
  const tankBlocker = (x, z) => deeper(body.blocker(x, z), arena.blocker(x, z));   // the body's or the arena's, whichever pushes deeper
  const friendlies = createFriendlies(scene, {
    sphere, surface, cellSide: CELL, explosions, sfx: audio, tune: () => fightTune, fight: () => fight, now: () => t,
    creature: () => (waving() || rise ? NOBODY : creatureNow()), tank: tankNow,   // the wave's rounds hurt the Reeds (./boss/wave.js), never the boss held back or still rising
    // plans in flight keep landing after a loss or a kill: the arena breaks only in a running fight
    onLanding: (plan, { point }) => { fear.landed(plan, point); bait.hurt(plan); if (fight.phase === 'fight') arena.landed(plan, point); }, onBeam: (plan, point) => fear.beam(plan, point),
    onBurn: (plan, dt) => { bait.burn(plan, dt); if (plan.player && plan.kind === 'rotary') fear.round(plan, plan.at); },   // a landing and a burn hurt Isao as they hurt the creature (./boss/bait.js; nothing out of the bait mode); each 25 mm round of the seat's fills the barrage meter
    onTankHit: loseHull, enabled: () => Object.fromEntries(['rotary', 'bofors', 'nuke', 'sol'].map((k) => [k, fightOn.fight && fightOn[k] && tankOn()])),   // the bait mode makes no automatic plans: the player's are the seat's
  });
  // a landing on the hull: the hull goes in a shell's burst and stays hidden until the reset. While it is lost it is nobody's prey:
  // the drive stands still, the lure is not fed, the shooters' provider reports it a world away and the feeding is off (the
  // reset's restoreCreature turns it back on), so the creature cannot take an invisible hull and stretch the card with a meal
  function loseHull(reason) {
    if (fight.phase !== 'fight' || !tankOn()) return;
    capture(fight, reason);
    hullLost = true;
    if (creature) creature.motion.feeding.enabled = false;
    const at = surface(drive.x, drive.z);
    explosions.spawn('tank.shell', at.point.toArray(), at.normal.toArray(), CELL);
    audio.play('blast_fire');
  }
  const round = createRound(stage, {
    tune: () => fightTune, fight: () => fight, on: () => fightOn.fight, cardExtra: () => bait.cardText(), wave: () => (waving() ? wave.bar() : null),
    onKilled: dieV1, onLost: () => {}, onReset: () => { resetDue = 0; },
  });
  // THE BAIT MODE (./boss/bait.js, the rules in src/domain/boss-bait.js): Isao flies low on autopilot with the creature after him, a bar under
  // the creature's, his lines as captions. The lab's `mode` switch turns it on; the tank is out while it is
  const bait = createBaitMode({
    stage, sphere, tune: () => fightTune, fight: () => fight, now: () => t, creature: huntedNow, route: (from, to) => arena.route(from, to),
    ground: (x, z) => tankWorld(x, z), tangent: (w) => frameAt(w, planet.radius, 0, frame.east), sfx: audio,
    burst: (x, z, alt) => {   // his end, the shell's burst where he flew
      const at = surface(x, z), p = at.point.clone().addScaledVector(at.normal, alt);
      fx.spawn('tank.shell', p.toArray(), at.normal.toArray(), CELL); audio.play('blast_fire');
    },
    caption: (text, seconds) => showCallout(text, seconds * 1000),
    clamp: (p) => keptOff(arena.clamp(p, fightTune.bounds.baitMargin)),   // his wanted point, after the routing, inside the bound and off the centre while something comes up there
    hold: (p) => keptOff(arena.clamp(p, 0)), nodes: huntedNodes,   // his ground point inside the bound itself after the move; the body's nodes for his reach envelope
    bound: () => { const b = arena.bound(); return b.on ? { at: b.at, radius: b.radius, inset: fightTune.bounds.baitMargin } : null; },   // the fly-over's: trapped against it, and the far side held inside it
    gunner: () => seat.gunner(),   // the player's fire, for his lines
  });
  // THE GUNNER SEAT (./boss/game-seat.js): in the bait mode the player sits in the game's own gunship seat (src/sentry-pilot.js), its
  // thermal and its GROUND TRUTH monitor; every round it fires is resolved by the fight through the friendlies' paths
  const seat = createGameSeat({
    stage, renderer, scene, sphere, camera: cam, audio, explosions, planet: () => planet, ground: (x, z) => tankWorld(x, z),
    local: (p) => { const u = frame.up, k = planet.radius / (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]), l = toLocal(frame, [p[0] * k, p[1] * k, p[2] * k], 1); return [l[0], l[2]]; },
    tune: () => fightTune, fight: () => fight, now: () => t, creature: huntedNow, isao: () => bait.marker(),
    parts: () => ({ creature: waving() ? wave.group : creature?.mesh, isao: sphere.getObjectByName('Isao'), ring: arena.ring }),
    resolve: (plan, dt) => { friendlies.resolve(plan, dt); wave.resolve(plan, dt); },   // a round of the player's on the boss (none while the wave holds it back), Isao and the arena, and on every live Reed
    orbitGround: fixedWorld,   // the platform's orbit round the arena's centre, world-fixed
    isaoCam: () => (creature ? bait.cam(huntedAim()) : null),   // the monitor on Isao, looking at the creature (./boss/bait.js ISAO'S CAMERA)
    gate: () => ({ fight: fightOn.fight, rotary: fightOn.rotary, bofors: fightOn.bofors, nuke: fightOn.nuke }),   // the fight folder's switches gate the player's guns as the schedule's
    focus: () => { const c = huntedNow().centre, b = bait.pos() ?? c; return [(c[0] + b[0]) / 2, (c[1] + b[1]) / 2]; },
    clear: () => panelCover(),   // what the panel covers: the HUD's readout and the monitor stand left of it
    leave: () => { if (!PLAYTEST) setMode('tank'); },   // in the friends' link Esc only frees the mouse (the seat's own first Esc) pause: () => { paused = !paused; }, onError: (m) => shaderErrors.push(m),
  });
  // the creature's body centre in sphere space (its mass centre in the rig, the frame's tangent space), `lift` metres up: Isao's camera's aim
  function creatureAim(lift = 2) {
    const c = creature.motion.center, p = toWorld(frame, [c.x, c.y, c.z], scale);
    return [p[0] + frame.up[0] * lift, p[1] + frame.up[1] * lift, p[2] + frame.up[2] * lift];
  }
  // THE FIRST WAVE (./boss/wave.js, the rules src/domain/boss-wave.js): in the bait mode `wave.count` Reeds hunt Isao before the boss; the last one dead, the boss enters
  const wave = createWave({
    sphere, tune: () => fightTune, fight: () => fight, now: () => t, motion: () => params.motion, phys: () => ({ ...PHYS, ...params.phys }),
    ground: (x, z) => tankWorld(x, z), tangent: (w) => frameAt(w, planet.radius, 0, frame.east), spawn: (p) => arena.spawn(p),
    aim: (from, to) => arena.clamp(arena.route(from, to), fightTune.bounds.creatureMargin),   // the boss's hunt: round the obstacles, then inside the bound
    isao: () => bait.asTank(), isaoPos: () => (bait.has() && !bait.gone() ? bait.pos() : null), fearOn: () => fightOn.fight && fightOn.fear,
    camera: () => cam, extentOf: nativeExtent, onError: (m) => { frameError = m; frameErrorAt = t; },
    gate: () => sinkhole.who() === 'reeds' && sinkhole.ready(), hot: () => seat.thermal(),
  });
  // THE SINKHOLE (owner, 2026-10-10: "the initial Tremor is not just the ground shaking, it is our sinkhole animation from the game mode"; ./boss/sinkhole.js hosts
  // the game's src/game-breaches.js): a round of the bait mode opens one at the arena's centre (`wave.sinkhole.reeds` cells wide), the Reeds come up out of it one after
  // another once it is ready by the game's own spawn rule, and it is sealed with the game's rubble once every one is up; the last Reed dead, another opens there for the
  // boss (`wave.sinkhole.boss` cells), which rises out of it once that one is ready. Its rumble, its breaking ground and its quake are the game's; nothing is shaken
  const sinkhole = createLabSinkhole({
    sphere, renderer, scene, camera: cam, audio, planet: () => planet, ground: (x, z) => tankWorld(x, z),
    north: (w) => frameAt(w, planet.radius, 0, frame.east).north, look: () => LOOK,
  });
  // THE BOSS'S RISE: its sinkhole at the arena's centre and, once that is ready, as a Reed's (src/domain/boss-wave.js `emergence`), its drawing lifted out of the ground
  // over the rise while its body stands settled on its floor, motion off and out of the fight's reach; Isao kept `wave.clear` metres off the centre until it is up
  let rise = null;   // { at (the lab clock its sinkhole was ready; null while it opens), depth (metres under), lift, phase } while it comes up
  const upV = new THREE.Vector3();
  function bossHeight() {
    const rest = creature.body.rest; let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < rest.length; i += 3) { y0 = Math.min(y0, rest[i]); y1 = Math.max(y1, rest[i]); }
    return (y1 - Math.min(0, y0)) * scale;
  }
  function stepRise() {
    if (rise.at === null && sinkhole.who() === 'boss' && sinkhole.ready()) rise.at = t;
    const m = creature.motion, e = rise.at === null ? { phase: 'below', lift: 0 } : emergence(t - rise.at, fightTune.wave.emerge);
    rise.lift = e.lift; rise.phase = e.phase;
    placeRig();
    if (e.phase !== 'up') { rig.position.addScaledVector(upV.fromArray(frame.up), -(1 - e.lift) * rise.depth); m.active = false; return; }
    rise = null; m.active = params.instinct;
  }
  // Isao's planner kept off the arena's centre while a Reed is still to come up there (./boss/wave.js `keep`) or the boss rises
  const keepNow = () => (tankOn() ? null : wave.keep() ?? (rise ? { at: arena.bound().at, radius: fightTune.wave.clear } : null));
  const keptOff = (p) => { const k = keepNow(); return k ? keepOut(p, k.at, k.radius) : p; };
  // the boss's entry, the last Reed dead: at the arena's centre (where every round leaves it, unstepped through the wave), Isao put out of its way
  let entry = null;   // the last entry: { at (the lab clock), isao (metres from the centre), moved (he was put out) }
  function bossEntry() {
    fear.reset(); stunned = false; temperament.reset(fightTune.seed);
    const p = bait.pos(), out = p && entryClear(p, arena.bound().at, fightTune.wave.clear);
    if (out) bait.putAt(arena.spawn(out));
    const now = bait.pos();
    entry = { at: t, isao: now ? Math.hypot(now[0] - arena.bound().at[0], now[1] - arena.bound().at[1]) : null, moved: !!out };   // the readout's: where he stood from the centre once put
    rise = { at: null, depth: fightTune.wave.emerge.depth * bossHeight(), lift: 0, phase: 'below' };
    sinkhole.open(arena.bound().at, fightTune.wave.sinkhole.boss, 'boss');
    showCallout('NIH-DAIRIA', 2500);
  }
  // R, C and I in the seat: the seat swallows every key in the capture phase; this capture listener is registered before any seat, so it runs first
  // T (the game's top view) is swallowed too: the lab has no map to show, and the seat would hide its HUD for a view it cannot draw
  const onSeatKey = (e) => {
    if (!seat.owns() || !active || isText(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyT') { e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'r' && !e.repeat) newRound();
    if (e.code === 'KeyC' && !e.repeat) copySettings();   // the values to paste, from the seat
    if (e.code === 'KeyI' && !e.repeat) seat.monitorCam(!seat.monitorCam());   // the monitor: Isao's camera, or the game's GROUND TRUTH and MK-9 feed
  };
  addEventListener('keydown', onSeatKey, { capture: true });
  // THE V1 DEATH (owner, 2026-10-08: "set its gravity to 10 (max) and stop all movements")
  function dieV1() {
    if (!creature) return;
    creature.motion.active = false; creature.motion.feeding.enabled = false;
    creature.phys.gravity = fightTune.deathGravity;
  }
  function stepFight(dt, driving) {
    const f = creature.motion.feeding;
    if (fightOn.fight && tankOn() && state.lure === 'tank' && feedWas === 'hunting' && f.phase !== 'hunting') capture(fight, 'caught');
    feedWas = f.phase;
    if (fightOn.fight && driving && fight.phase === 'idle' && resetDue < 0) startFight(fight);
    seat.tick(dt);   // the game seat's frame: its rounds land through the fight before the friendlies tick
    friendlies.tick(dt);
    round.tick(dt);
    bait.tick(dt);   // after the round, so a kill the same frame wins over Isao's loss
    if (resetDue >= 0) {   // a meal in progress finishes first, so it counts and the prey is never moved under the kit
      resetDue += dt;
      if (!(MEAL_PHASES.has(f.phase) && f.enabled) || resetDue >= MEAL_WAIT) newRound();
    }
  }
  const muzzleV = new THREE.Vector3(), aimQ = new THREE.Quaternion(), aimV = new THREE.Vector3();
  function fireCannon() {
    if (!planet || !frame || !tank.visible || !tankOn() || !fightOn.cannon) return false;
    if (state.lure === 'tank' && MEAL_PHASES.has(creature?.motion.feeding.phase)) return false;   // the prey cannot shoot
    let from = [drive.x, drive.z], dir = plane.heading();
    tank.updateMatrixWorld(true);
    const muzzle = tank.userData.muzzle, turret = tank.userData.turret;
    if (muzzle) {
      sphere.worldToLocal(muzzle.getWorldPosition(muzzleV));
      const l = toLocal(frame, muzzleV.toArray(), 1); from = [l[0], l[2]];
    }
    if (turret) {   // the turret's world +Z flattened into the plane (the sphere group is not rotated: a world direction is its own)
      aimV.set(0, 0, 1).applyQuaternion(turret.getWorldQuaternion(aimQ));
      const e = frame.east, n = frame.north, dx = aimV.x * e[0] + aimV.y * e[1] + aimV.z * e[2], dz = aimV.x * n[0] + aimV.y * n[1] + aimV.z * n[2];
      if (Math.hypot(dx, dz) > 1e-3) dir = [dx, dz];
    }
    return cannon.fire(from, dir);
  }
  // no wound (owner, brainstorm): the shell shoves the body away from the hit and the creature flinches; the tank provokes
  function provoke(x, z) {
    if (!creature) return;
    body.shove(x, z);
    creature.motion.disturb();
    provokes++;
  }
  function stepCannon(dt) {
    cannon.tick(dt, body.shellHit);
    explosions.tick(dt);
    tank.userData.heatSleeve?.material.color.lerpColors(SLEEVE_COOL, SLEEVE_HOT, cannon.heat() / CANNON_COOL);
  }
  function respawnTank() {
    const at = arena.spawn([RESPAWN_METRES, 0]);   // turned round the origin when a shape stands on it
    plane.reset(at[0], at[1], Math.PI / 2); scripted = null;
    tank.visible = true;
  }
  // THE ROUND'S RESET (the domain's 'reset' or the panel's button): the shooters, the shells and the scorch gone, the creature at
  // its rest with the preset's gravity and instinct, the frame back on the origin, the tank `respawn` metres out on the side away
  // from the creature, facing it, and a fresh fight. `taken` stays; a scripted drive (the harness's) carries on
  function newRound() {
    resetDue = -1; rise = null;
    friendlies.reset(); seat.reset(); cannon.clear(); fear.reset(); stunned = false; pin = null;
    arena.reset();   // every obstacle back, where the layout has it (the frame goes back to the origin below)
    if (!fightOn.pinSeed) fightTune.seed = (fightTune.seed | 0) + 1;
    temperament.reset(fightTune.seed);   // the round's lunges from its seed
    fight = makeFight(roundTune());
    hullLost = false; feedWas = 'hunting';
    if (!creature || !frame) return;
    const bm = !tankOn(), was = bm && bait.groundWorld() ? bait.groundWorld() : tankWorld();
    creature.reset(); lastMeals = 0; auto.reset();
    restoreCreature();
    frame = frameAt([0, 1, 0], planet.radius, 0); placeRig(); arenaCentre.set(0, 0, 0);
    const reeds = wave.reset(bm ? fightTune.wave.count : 0, arena.bound().at, fightTune.seed);   // the bait mode's first wave round the arena's centre (none in the tank mode)
    sinkhole.reset(); if (reeds) sinkhole.open(arena.bound().at, fightTune.wave.sinkhole.reeds, 'reeds');   // its sinkhole
    const c = creature.motion.center, cx = c.x * scale, cz = c.z * scale, l = toLocal(frame, was, 1);
    let dx = l[0] - cx, dz = l[2] - cz; const d = Math.hypot(dx, dz);
    if (d > 1e-6) { dx /= d; dz /= d; } else { dx = 1; dz = 0; }
    const R = fightTune.respawn;
    const at = arena.spawn([cx + dx * R, cz + dz * R]);   // clear of the obstacles by the hull and two metres
    if (bm) { bait.reset(at); tank.visible = false; }   // Isao `respawn` metres out, clear of the obstacles, whole
    else { plane.reset(at[0], at[1], Math.atan2(cx - at[0], cz - at[1])); tank.visible = true; placeTank(); gameCam?.snap(); }   // facing the creature
    pointWorld = toWorld(frame, creature.motion.target.toArray(), scale);
  }
  function restoreCreature() {
    if (!creature) return;
    creature.phys.gravity = params.phys.gravity;
    creature.motion.active = params.instinct; creature.motion.feeding.enabled = params.feeding;
  }
  // the fight switch: off is the lab as before (an idle fight, no bar, no shooters; a dead creature stands again where it lies), but the
  // obstacles stay (their own switch)
  function setFight(on) {
    fightOn.fight = !!on;
    friendlies.reset(); cannon.clear(); fear.reset(); stunned = false; resetDue = -1; hullLost = false; pin = null;
    arena.reset(false);   // the frame stays: the obstacles come back where they stand, but not on the creature or the tank (the next round's)
    fight = makeFight(roundTune());
    restoreCreature();
    seat.release();   // the trigger's hold goes with the fight (the seat's guns are silent while it is off)
    if (!tankOn() && bait.has()) bait.reset(bait.pos());   // Isao whole again where he is
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    return fightOn.fight;
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

  // THE RE-ANCHOR (the kit's shift is ./boss/body.js `shiftKit`, the Reeds' too): the creature and the auto-lure's world-fixed arena centre
  function shiftCreature(sx, sz) {
    const shiftV = (v) => { v.x += sx; v.z += sz; };
    shiftKit(creature, sx, sz); shiftV(arenaCentre);
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
    // everything placed in the plane stays where it is in the world: the shells in flight, the strikes' landings, Isao, the optic and its reticle, what frightens the creature, the obstacles
    for (const part of [cannon, friendlies, bait, fear, arena, wave]) part.shift(shift[0] * scale, shift[2] * scale);
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
      const reload = !!creature;
      creature?.dispose();
      creature = next; state.variant = variant;
      arena.wrapStep(creature);   // the new body's step pushes its nodes out of the obstacles
      creature.motion.feeding.enabled = params.feeding; creature.motion.active = params.instinct;
      rig.add(creature.mesh);
      native = nativeExtent(creature.body); applySize();
      lastMeals = 0; fatal = null;
      // a reload: a fresh round, so no plan is owed for the seconds the load skipped (the schedule would land them all at once)
      if (reload) newRound();
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
    sinkhole.patchGround(planetMesh); sinkhole.warm();   // the ground opens with the game's sinkhole, its programs and stone maps linked before the first opening
    sphere.position.set(0, -planet.radius, 0);
    frame = frameAt(anchorUp, planet.radius, 0);
    prey = createPrey(NIH_DAIRIA_LOOK); prey.mesh.visible = false; prey.mesh.name = 'Nih-Dairia prey'; rig.add(prey.mesh);
    placeRig(); placeTank();
    gameCam = createGameCam({ renderer, scene, camera: cam, planetRadius: planet.radius, cellSide: CELL, host: { stage, hull: hullPose, clearRight: panelCover } });
    gameCam.setOn(state.cam === 'game' && state.view !== 'free');
    read.textContent = 'loading the creature…';
    await makeCreature();
    if (disposed || !creature) return;
    pointWorld = toWorld(frame, creature.motion.target.toArray(), scale);
    if (q.get('mode') !== 'tank' && state.mode !== 'bait') setMode('bait');   // the lab opens in the bait mode (owner, 2026-10-10: "make the default mode when landing on #boss the Bait-Isao mode"); ?mode=tank opens the tank's
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
  let dtNow = 0, routed = false, rawX = 0, rawZ = 0;
  function step(dt, cut) {
    const m = creature.motion, f = m.feeding;
    routed = false;
    const bm = !tankOn(), held = waving();   // the first wave holds the boss back: hidden and unstepped, so its frame stays on the arena's centre
    if (!held) tryReanchor(REANCHOR_METRES);
    rig.visible = !held;
    if (rise) stepRise();   // the boss coming up out of the ground after the wave
    if (bm && !bait.has()) newRound();   // the mode was switched before the creature was here: Isao's first round
    const pinned = !bm && state.lure === 'tank' && MEAL_PHASES.has(f.phase);
    let driving = false;
    if (hullLost || bm) { drive.speed = 0; blocked = false; }   // a lost hull neither drives nor reads input (a harness script carries on after the reset)
    else if (!pinned) { body.project(); ({ moving: driving, blocked } = plane.step(dt, driveInput(), tankBlocker)); }
    else { drive.speed = 0; scripted = null; blocked = false; }
    const moving = driving || keysHeld() || (scripted && t < scripted.until);
    m.targetHeld = bm || (state.lure === 'tank' && !hullLost ? !!moving : false);   // Isao is always held (the hold that takes him is the rules'); the point and the auto-lure are never held, nor a lost hull
    if (bm) bait.step(dt);
    if (bm) { const k = keepNow(), p = bait.pos(); if (k && p && Math.hypot(p[0] - k.at[0], p[1] - k.at[1]) < k.radius) bait.putAt(keepOut(p, k.at, k.radius)); }   // a fly-over is not held by `hold`: it goes round the centre too
    wave.step(dt);   // the Reeds: hunting him while the wave holds, the dead lying down until they go
    sinkhole.step(dt);
    if (sinkhole.who() === 'reeds' && sinkhole.ready() && !wave.keep()) sinkhole.seal();   // every Reed up: the game's rubble over their hole
    auto.enabled = state.lure === 'auto';
    // the fear: a stun holds the instinct off (restored only while the fight is on: a kill has set it false for good), a flight
    // replaces the lure with the flee point (local metres to native, as the lure is)
    const fr = held ? { mode: 'hunt', point: null, flight: null } : fear.step(t);
    if (!held) temperament.step(dt, fr.flight);   // the bait mode's live motion: the base, a lunge, the fear's flight
    if (fr.mode === 'stun') { stunned = true; m.active = false; }
    else if (stunned) { stunned = false; if (fightOn.fight && fight.phase === 'fight') m.active = params.instinct; }
    if (!held && !f.locked && !(hullLost && state.lure === 'tank' && !bm) && !(bm && bait.gone())) {
      dtNow = dt;
      const aim = bm ? lureV.set(bait.pos()[0] / scale, 0, bait.pos()[1] / scale) : lureTarget();
      if (fr.mode === 'flee') aim.set(fr.point[0] / scale, 0, fr.point[1] / scale);
      aim.setY(ARENA.lureHeight);
      routed = false;
      if (pin && t < pin.until) aim.set(pin.shape.at[0] / scale, ARENA.lureHeight, pin.shape.at[1] / scale);   // the measurement's hold: no routing
      else if (fr.mode !== 'stun') {   // the hunt (or the flight) goes round what stands in the way, in local metres
        rawX = aim.x; rawZ = aim.z;
        const c = m.center, w = arena.route([c.x * scale, c.z * scale], [aim.x * scale, aim.z * scale]);
        routed = w[0] !== aim.x * scale || w[1] !== aim.z * scale;
        if (routed) aim.set(w[0] / scale, ARENA.lureHeight, w[1] / scale);
        if (bm) { const b = arena.clamp([aim.x * scale, aim.z * scale], fightTune.bounds.creatureMargin); aim.set(b[0] / scale, ARENA.lureHeight, b[1] / scale); }   // the bait mode's bound, after the flight's point and the routing
      }
      // a routed or fleeing target is a waypoint or a flee point, never the tank: the kit must not capture it (`targetHeld` only gates
      // the capture, behavior.js), or a tank stopped behind a rock is eaten through it and moved to the waypoint
      if (routed || fr.mode === 'flee') m.targetHeld = true;
      creature.setTarget(aim);
    }
    let steps = 0;
    try {
      if (!held) steps = creature.update(dt);
      // the figure-eight reads the kit's target as its own path next frame: it gets the lure's point back, not the waypoint
      if (routed && state.lure === 'auto') m.target.set(rawX, ARENA.lureHeight, rawZ);
    } catch (e) {
      // a non-finite body: say so, start over, keep the frame going
      frameError = String(e.message); frameErrorAt = t;
      creature.reset(); lastMeals = 0;
    }
    if (f.meals > lastMeals) {
      lastMeals = f.meals; taken++;
      if (!bm && state.lure === 'tank') { showCallout('TAKEN'); respawnTank(); }
    }
    if (f.meals < lastMeals) lastMeals = f.meals;
    if (bm) tank.visible = false;
    else if (state.lure === 'tank' && MEAL_PHASES.has(f.phase)) {
      // the kit holds the prey fixed: the tank is wherever the prey is, and gone once it is concealed
      const p = toWorld(frame, f.preyPosition.toArray(), scale), l = toLocal(frame, p, 1);
      drive.x = l[0]; drive.z = l[2];
      tank.visible = f.visible && !hullLost;
    } else tank.visible = !hullLost;
    if (state.lure === 'point' && f.locked) pointWorld = toWorld(frame, m.target.toArray(), scale);   // follows the kit's spawn
    prey.update(f); prey.mesh.visible = tankOn() && state.lure !== 'tank' && f.visible;   // the bait mode shows no ball (owner, 2026-10-10: "hide the ball in bait mode"): a lure left on point or auto from the tank mode drew the boss's prey at Isao's ground point
    placeTank();
    // hover, idle vibration, the touchdown rock and the bank: the game's own, read through the persisted tuning
    stepTankFeel(feel, dt, driving, FEEL);
    applyTankFeel(tank, feel, FEEL);
    runEngine(driving);
    stepFight(dt, driving || bm);   // Isao is flying from the round's first frame
    if (bm && wave.bossEnters()) bossEntry();   // the last Reed fell this frame
    stepCannon(dt);
    arena.sync();   // the obstacles shown, hidden and placed on the frame as it stands now
    // the readout's numbers, per frame, into the rolling means
    const tm = held ? { solver: wave.stats().solver, skin: 0 } : creature.timings;   // the wave's whole solver (its skin inside) while it holds the boss back
    meanSolver.push(tm.solver); meanSkin.push(tm.skin); meanSteps.push(held ? wave.stats().steps : steps); cutFrames.push(cut ? 1 : 0);
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
  function frameCamera(dt) {
    controls.enabled = state.view === 'free';
    gameCam?.setOn(state.cam === 'game' && state.view !== 'free' && tankOn());   // the game's own camera takes the chase's place (./boss/game-cam.js); it is the tank's, so not in the bait mode (its rear frame and lens go)
    if (seat.owns()) { seat.pose(); return; }   // the game seat's pose frames the camera (./boss/game-seat.js)
    if (state.view === 'free') { controls.update(); return; }
    if (gameCam?.isOn()) { gameCam.step(dt); return; }
    chaseCam();
  }
  // the lab's chase: behind the tank (or Isao) looking past it at the creature
  function chaseCam() {
    const c = creature.motion.center, cw = toWorld(frame, [c.x, 0, c.z], scale), tw = tankOn() ? tankWorld() : bait.air();   // the chase follows the tank, or Isao in the bait mode
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

  function showCallout(text, ms = 1600) {
    while (calloutsEl.children.length >= 3) calloutsEl.firstChild.remove();
    const d = document.createElement('div'); d.className = 'callout co-milestone'; d.textContent = text;
    calloutsEl.append(d); setTimeout(() => d.remove(), ms);
  }

  const fmt = (v, n = 2) => v.toFixed(n);
  function readout() {
    const m = creature?.motion;
    return {
      ready: !!creature && !loading, solver: meanSolver.mean(), steps: meanSteps.mean(), skin: meanSkin.mean(), render: meanRender.mean(),
      centre: meanCentre.mean(), reach: meanReach.mean(), sag: meanSag.mean(), taken, held: !!m?.targetHeld,
      state: (fight.phase === 'killed' || fight.phase === 'lost') ? fight.phase : (m?.state ?? null), phase: m?.feeding.phase ?? null,
      size: state.sizeMetres, scale, lure: state.lure, variant: state.variant, cut: cutFrames.mean() > 0, frames, reanchors,
      speed: drive.speed, blocked, cruise: drive.cruise, provokes, heat: cannon.heat(), shells: cannon.shells(),
      tank: { x: drive.x, z: drive.z, yaw: drive.yaw, speed: drive.speed, visible: tank.visible },
      fight: { ...fightReadout(fight), nukeOn: fightOn.nuke, phase: fight.phase, reason: fight.reason, on: fightOn.fight, rings: friendlies.rings(), card: round.card(), ...fear.counts(), fearMode: fear.mode(), nukeIn: fight.nuke && tankOn() ? Math.max(0, fight.nuke.next) : null, mk9In: seat.mk9In() },
      arena: { on: fightOn.obstacles, live: arena.live().length, ...(({ pushed, ms }) => ({ pushed, ms }))(arena.stats()) },
      shaderErrors: shaderErrors.slice(), error: fatal ?? frameError, cropped,
      kernel: !!creature?.body.kernel,
      cam: state.cam, rearMs: gameCam?.isOn() ? gameCam.stats().ms : null, mode: state.mode, bait: bait.state(),
      temper: temperament.state(), gunFear: fear.guns(),   // the bait mode's temperament and fear per gun
      fps, wave: wave.state(), entry, rise: rise ? { ...rise, age: rise.at === null ? null : t - rise.at } : null, keep: keepNow(),   // the fps corner's frames a second; the first wave ({ count, alive, killed, made, cleared, boss, entered, reeds, hunted, solver, steps, timeScale, lod, cost, meanSolver, meanScale })
    };
  }
  function drawReadout() {
    if (fatal) { read.textContent = fatal; return; }
    const r = readout();
    const stepsHtml = r.cut ? `<b class="late">${fmt(r.steps, 1)}</b>` : `<b>${fmt(r.steps, 1)}</b>`;
    let html = `solver <b>${fmt(r.solver)} ms</b> (${stepsHtml} steps) &middot; skin <b>${fmt(r.skin)} ms</b> &middot; render <b>${fmt(r.render)} ms</b>`
      + ` &middot; centre <b>${fmt(r.centre)} m/s</b> &middot; reach <b>${fmt(r.reach, 1)} m</b> &middot; sag <b>${fmt(r.sag)} m</b> &middot; taken <b>${r.taken}</b>`;
    if (r.fight.on) html += ` &middot; hp <b>${fmt(r.fight.hp, 0)}/${r.fight.max}</b> &middot; hits <b>${r.fight.hits}</b> &middot; <b>${fmt(r.fight.hpPerSecond, 1)}</b> hp/s`
      + ` &middot; ttk <b>${Number.isFinite(r.fight.timeToKill) ? `${fmt(r.fight.timeToKill, 0)} s` : '&mdash;'}</b>`
      + `<br>rot <b>${fmt(r.fight.byKind.rotary, 0)}</b> &middot; bof <b>${fmt(r.fight.byKind.bofors, 0)}</b> &middot; nuke <b>${fmt(r.fight.byKind.nuke, 0)}</b> &middot; sol <b>${fmt(r.fight.byKind.sol, 0)}</b>`
      + ` &middot; fear <b>${r.fight.fearMode}</b> (fleeing <b>${fmt(r.fight.fleeShare * 100, 0)}%</b>, stunned <b>${fmt(r.fight.stunShare * 100, 0)}%</b> of the round)`
      + ` &middot; frights <b>${r.fight.frights}</b> &middot; stuns <b>${r.fight.stuns}</b>`
      + (r.mode === 'bait'   // the player's MK-9 (its reload), not the schedule's
        ? ` &middot; MK-9 <b>${!r.fight.nukeOn ? 'off' : r.fight.mk9In > 0 ? `in ${fmt(r.fight.mk9In, 1)} s` : 'ready'}</b>`
        : ` &middot; nuke in <b>${!r.fight.nukeOn ? 'off' : r.fight.nukeIn === null ? '&mdash;' : `${fmt(r.fight.nukeIn, 1)} s`}</b>`);
    html += ` &middot; provokes <b>${r.provokes}</b>`
      + (r.arena.on ? ` &middot; push <b>${r.arena.pushed}</b> &middot; <b>${fmt(r.arena.ms, 3)} ms/step</b>` : '')
      + `<br>size ${r.size} m (&times;${fmt(r.scale, 0)}) &middot; ${r.state ?? '—'} &middot; ${r.variant}${r.mode === 'bait' ? '' : ` &middot; lure ${r.lure}`}`
      + ` &middot; ${r.kernel ? 'wasm kernel' : 'js solver'} &middot; re-anchored ${r.reanchors}`
      + (r.rearMs !== null ? ` &middot; camera game &middot; rear <b>${fmt(r.rearMs)} ms</b>` : '');
    if (r.mode === 'bait' && r.bait) html += `<br>Isao <b>${fmt(r.bait.hp, 1)}/${r.bait.max}</b> &middot; gap <b>${fmt(r.bait.gap, 1)} m</b> &middot; alt <b>${fmt(r.bait.alt, 1)} m</b> &middot; ${r.bait.gone ? 'gone' : r.bait.hop ? `flying over (${r.bait.hop})` : r.bait.fleeing ? 'backing off' : 'circling'}`
      + ` &middot; temper <b>${r.temper.phase}</b> (lunges <b>${r.temper.lunges}</b>) &middot; barrage <b>${fmt(r.gunFear.meter, 2)}</b> &middot; flinch/wild/panic <b>${r.gunFear.flinch}/${r.gunFear.wild}/${r.gunFear.panic}</b>`;
    if (r.mode === 'bait' && !r.wave.boss) html += `<br>wave 1 &middot; Reeds <b>${r.wave.alive}/${r.wave.count}</b> (${r.wave.made} made) &middot; solver <b>${fmt(r.wave.meanSolver, 1)} ms</b>`
      + ` &middot; clock <b>&times;${fmt(r.wave.meanScale)}</b> &middot; off-screen <b>${r.wave.lod}</b> &middot; <b>${fmt(r.wave.cost)} ms</b>/step`;
    if (shaderErrors.length) html += `<br><b class="late">shader: ${escapeHtml(shaderErrors[shaderErrors.length - 1])}</b>`;
    if (frameError && t - frameErrorAt < 5) html += `<br><b class="late">${escapeHtml(frameError)}; reset</b>`;
    read.innerHTML = html;
    stateLine.textContent = `state ${r.state ?? '—'} · feeding ${r.phase ?? '—'}`;
  }
  // fps, the solver's ms this frame (the whole wave's while it holds the boss back, else the boss's) and the Reeds standing; the wave's clock when the budget slows it
  function drawFps() {
    fpsEl.hidden = tankOn() || !creature;
    if (fpsEl.hidden) return;
    const held = waving(), w = wave.stats(), bar = wave.bar();
    fpsEl.textContent = `${fps.toFixed(0)} fps · solver ${(held ? w.meanSolver : meanSolver.mean()).toFixed(1)} ms · `
      + (held ? `Reeds ${bar.alive}/${bar.count} · ${w.hz} Hz${w.meanScale < 0.995 ? ` · clock ×${w.meanScale.toFixed(2)}` : ''}` : 'boss');
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
    const dt = Math.min(0.05, gap), cut = gap > 0.05; if (!paused) t += dt;   // P in the seat holds the lab's clock
    resize();
    if (!planet) return;
    root.querySelector('[data-keys]').hidden = state.lure !== 'tank' || !tankOn();
    if (!seat.sync(!tankOn() && state.view !== 'free' && !!creature && !fatal)) paused = false;   // the game seat is mounted in the bait mode only (its keys are the window's); its pause goes with it. A body reload keeps it (the old creature stands until the new one swaps in; the round restarts then, the seat's tick waits for it)
    if (creature && !loading && !fatal) { if (!paused) step(dt, cut); frameCamera(dt); }
    try {
      const probe = creature && frames % 30 === 29, a = probe ? performance.now() : 0;   // the frame that is the 30th: the render's cost is read off it
      const drawn = seat.render(dt);   // the seat draws through its thermal and adds the GROUND TRUTH monitor
      if (!drawn) renderer.render(scene, cam);
      gameCam?.renderRear();   // the rear feed over the main frame, straight to the canvas (./boss/game-cam.js)
      frames++;
      if (!firstRender) { firstRender = true; checkPrograms(); }
      checkPrograms();
      if (probe) {   // the seat's own frame is timed as drawn: costMs draws the plain scene to the canvas, over the FLIR picture and the monitor
        if (drawn) { gl.finish(); renderMs = performance.now() - a; } else renderMs = costMs();
        meanRender.push(renderMs);
      }
    } catch (e) {
      shaderErrors.push(`render: ${e.message}`); active = false;   // a shader that cannot build: say so and stop drawing
      drawReadout(); return;
    }
    readAcc += dt;
    if (readAcc > 0.2 && creature) { readAcc = 0; drawReadout(); }
    fpsCount++;
    if (now - fpsAt >= 500) { fps = fpsCount * 1000 / (now - fpsAt); fpsCount = 0; fpsAt = now; drawFps(); }
  }

  // --- the panel ----------------------------------------------------------------------------------------------------------
  const gui = new GUI({ title: 'NIH-DAIRIA', container: root });
  // ?playtest=1 (the friends' link, src/core/dev-mode.js turns the shell's DEV off with it): the knobs' panel is hidden; the side panel and its mode select stay
  if (PLAYTEST) {
    gui.hide();
    for (const el of root.querySelectorAll('[data-dev], [data-bait-only], [data-tank-only]')) el.hidden = true;
    root.querySelector('[data-friend]').hidden = false;
    root.querySelector('[data-read]').style.visibility = 'hidden';   // the solver/fear readout is dev text (it keeps updating for the harness)
  }
  // the stage's px the knobs' panel covers on the right (none while it is hidden): the seat's readout and monitor, and the game camera's rear frame, stand left of it
  const panelCover = () => (gui._hidden ? 0 : Math.max(0, stage.getBoundingClientRect().right - gui.domElement.getBoundingClientRect().left));
  const folders = {};
  for (const c of MOTION_CONTROLS) {
    const folder = folders[c.group] ??= gui.addFolder(c.group);
    const ctl = folder.add(params.motion, c.key, c.min, c.max, c.step).name(c.label)
      .onChange((v) => { if (creature) creature.settings[c.key] = v; });
    ctl.domElement.title = c.hint;
  }
  const bodyGui = gui.addFolder('Body');
  bodyGui.add(state, 'sizeMetres', 5, 120, 1).name('size (m)').onChange(applySize);
  bodyGui.add(params.phys, 'gravity', 0, 10, 0.05).name('gravity').onChange((v) => { if (creature) creature.phys.gravity = v; });
  bodyGui.add(params.phys, 'iterations', 1, 8, 1).name('iterations').onChange((v) => { if (creature) creature.phys.iterations = v; });
  bodyGui.add(params, 'feeding').name('feeding').onChange((v) => { if (creature) creature.motion.feeding.enabled = v; });
  bodyGui.add(params, 'instinct').name('instinct').onChange((v) => { if (creature) creature.motion.active = v; });
  // THE FIGHT'S KNOBS (spec section 7) on the lab's copy: the cadence and the damage apply to the next plans, `health` at the reset
  const fightGui = gui.addFolder('fight');
  fightGui.add(fightOn, 'fight').name('fight').onChange(setFight);
  fightGui.add(fightOn, 'rotary').name('rotary (25 mm)');
  fightGui.add(fightOn, 'bofors').name('Bofors (40 mm)');
  fightGui.add(fightOn, 'nuke').name('MK-9 nuke');
  const solCtl = fightGui.add(fightOn, 'sol').name('SOL-88');
  fightGui.add(fightOn, 'fear').name('fear (flight, stun)');
  fightGui.add(fightOn, 'obstacles').name('obstacles (arena)').onChange((on) => { if (on) arena.settle(); });
  fightGui.add(fightTune.wall, 'clear', 0, 20, 0.5).name('wall clear (m)');
  const cannonCtl = fightGui.add(fightOn, 'cannon').name('cannon (Space)');
  const altCtl = fightGui.add(bait.params, 'altitude', 2, 20, 0.5).name('bait altitude (m)');
  const erraticCtl = fightGui.add(fightTune.bait, 'erratic', 0, 1, 0.05).name('Isao erratic');   // 0 the smooth flight, 1 the bursts, brakes, jinks and bob
  const baitHealthCtl = fightGui.add(baitOpts, 'health', 10, 1000, 10).name('bait mode boss health (at reset)');
  const hopCtl = fightGui.add(fightTune.bait, 'hopChance', 0, 0.2, 0.005).name('Isao fly-over chance (/s)');   // the random fly-over; 0 leaves only the trapped one
  const reloadCtl = fightGui.add(seat.params, 'reload', 1, 30, 0.5).name('MK-9 reload (s)');   // the seat's MK-9: no limit a pass, this reload between releases
  const healthCtl = fightGui.add(fightTune, 'health', 10, 1000, 10).name('health (at reset)');
  fightGui.add(fightTune, 'warn', 0.2, 4, 0.1).name('warn (s)');
  fightGui.add(fightTune, 'lead', 0, 2, 0.05).name('lead');
  fightGui.add(fightTune, 'scatter', 0, 1.5, 0.05).name('scatter');
  fightGui.add(fightTune, 'front', 0, 40, 1).name('front (m)');
  fightGui.add(fightTune, 'behind', 0, 60, 1).name('behind (m)');
  fightGui.add(fightTune.rotary, 'dps', 0, 30, 0.1).name('rotary dps');
  fightGui.add(fightTune.nuke, 'damage', 0, 200, 1).name('nuke damage');
  fightGui.add(fightTune.nuke, 'every', 5, 60, 1).name('nuke every (s)');
  const tankStunCtl = fightGui.add(fightTune.nuke, 'stun', 0, 5, 0.1).name('nuke stun (s)');
  fightGui.add(fightTune.fear, 'reach', 0, 30, 1).name('fear reach (m)');
  fightGui.add(fightTune.fear, 'flee', 0, 60, 1).name('fear flee (m)');
  fightGui.add(fightTune.fear, 'bofors', 0, 5, 0.1).name('fear Bofors (s)');
  fightGui.add(fightTune.fear, 'after', 0, 3, 0.1).name('fear after beam (s)');
  fightGui.add(fightTune.fear.weight, 'sol', 0, 4, 0.1).name('fear SOL weight');
  fightGui.add(fightTune.bofors, 'burst', 0.5, 6, 0.1).name('Bofors burst (s)');
  fightGui.add(fightTune.bofors, 'rest', 0, 6, 0.1).name('Bofors rest (s)');
  fightGui.add(fightTune.bofors, 'damage', 0, 20, 0.5).name('Bofors damage');
  fightGui.add(fightTune.bofors, 'radius', 2, 40, 1).name('Bofors radius (m)');
  fightGui.add(fightTune.sol, 'every', 2, 30, 0.5).name('SOL every (s)');
  fightGui.add(fightTune.sol, 'burn', 0.5, 8, 0.1).name('SOL burn (s)');
  fightGui.add(fightTune.sol, 'dps', 0, 50, 1).name('SOL dps');
  fightGui.add(fightTune.sol, 'radius', 2, 30, 0.5).name('SOL radius (m)');
  const seedCtl = fightGui.add(fightTune, 'seed', 1, 999, 1).name('seed').listen();   // advances each round unless pinned
  fightGui.add(fightOn, 'pinSeed').name('pin seed');
  // THE BAIT MODE'S FEAR PER GUN AND TEMPERAMENT (wave B): their own folders, shown in the bait mode only. The base speed is the motion's chase speed (the Pursuit
  // folder's knob, the same value)
  const gunFearGui = gui.addFolder('fear per gun (bait)'), GF = fightTune.gunFear;
  gunFearGui.add(GF.rotary, 'amount', 0, 0.5, 0.01).name('25 mm barrage a round');
  gunFearGui.add(GF.rotary, 'drain', 0, 3, 0.05).name('25 mm barrage drain (/s)');
  for (const [k, label] of [['rotary', '25 mm'], ['bofors', '40 mm'], ['nuke', 'MK-9']]) {
    gunFearGui.add(GF[k], 'flee', 0, 100, 1).name(`${label} flee (m)`);
    gunFearGui.add(GF[k], 'duration', 0, 8, 0.1).name(`${label} duration (s)`);
    gunFearGui.add(GF[k], 'speed', 0.5, 4, 0.05).name(`${label} speed ×`);
    gunFearGui.add(GF[k], 'erratic', 0, 6, 0.1).name(`${label} erratic +`);
  }
  gunFearGui.add(GF.nuke, 'stun', 0, 5, 0.1).name('nuke stun (s)');   // the bait mode's own (0: the panic at once); the fight folder's is the tank mode's
  const temperGui = gui.addFolder('temperament (bait)'), TM = fightTune.temperament;
  temperGui.add(params.motion, 'speed', 0.1, 6, 0.05).name('base speed').listen()   // follows the Pursuit folder's chase speed (the same value)
    .onChange((v) => { if (creature && tankOn()) creature.settings.speed = v; gui.controllersRecursive().forEach((c) => c.updateDisplay()); });   // the Pursuit folder's chase speed shows it
  temperGui.add(TM, 'lunges').name('lunges');
  temperGui.add(TM, 'lungeSpeed', 0.1, 6, 0.05).name('lunge speed');
  temperGui.add(TM, 'everyMin', 0.5, 20, 0.5).name('lunge every min (s)');
  temperGui.add(TM, 'everyMax', 0.5, 30, 0.5).name('lunge every max (s)');
  temperGui.add(TM, 'forMin', 0.1, 3, 0.05).name('lunge duration min (s)');
  temperGui.add(TM, 'forMax', 0.1, 3, 0.05).name('lunge duration max (s)');
  temperGui.add(TM, 'reach', 1, 3, 0.05).name('lunge reach boost ×');
  // THE FIRST WAVE (bait mode): its size and the Reeds' hit points at the next round (R), the solver budget and the off-screen half rate now
  const waveGui = gui.addFolder('wave 1 (bait)'), WV = fightTune.wave;
  waveGui.add(WV, 'count', 0, WAVE_MAX, 1).name('Reeds (at R; 0 the boss at once)');
  waveGui.add(WV, 'reedHealth', 1, 100, 1).name('Reed health (at R)');
  waveGui.add(WV, 'budget', 2, 40, 0.5).name('wave solver budget (ms)');
  waveGui.add(WV, 'lod').name('off-screen Reeds at half rate');
  waveGui.add(WV.coarse, 'on').name(`${WV.coarse.hz} Hz solver above ${WV.coarse.above} Reeds`);   // owner, 2026-10-10: the Reeds' step coarser while many stand

  function setLure(kind) {
    if (!LURES.includes(kind)) return false;
    state.lure = kind; root.querySelector('[data-k="lure"]').value = kind;
    if (kind === 'auto') auto.reset();
    if (kind === 'point' && creature && frame) pointWorld = toWorld(frame, creature.motion.target.toArray(), scale);
    return true;
  }
  // what applies in the mode: the tank's lure, note, SOL and cannon switches, or the bait's note and altitude knob
  function modePanel() {
    const bm = !tankOn();
    for (const el of root.querySelectorAll('[data-tank-only]')) el.hidden = PLAYTEST || bm;
    for (const el of root.querySelectorAll('[data-bait-only]')) el.hidden = PLAYTEST || !bm;
    solCtl.show(!bm); cannonCtl.show(!bm); healthCtl.show(!bm); tankStunCtl.show(!bm);   // SOL, the cannon, the tank's health and its MK-9 stun are not in the bait mode; its altitude, erratic, health and the seat's reload are only there
    for (const c of [altCtl, reloadCtl, erraticCtl, baitHealthCtl, hopCtl]) c.show(bm);
    gunFearGui.show(bm); temperGui.show(bm); waveGui.show(bm);
  }
  modePanel();
  // the mode: the tank, or Isao as the bait (the tank out); a new round puts the right one `respawn` metres out
  // EACH MODE KEEPS ITS OWN TUNING (2026-10-09: Esc to the tank threw the owner's live predator away): a working copy of the motion knobs and the size
  // per mode, seeded from the two presets (the predator's 40 m, the tank's slower creature at 30), saved on leaving a mode and put back on entering it
  const modeMotion = { tank: { ...NIH_DAIRIA_MOTION }, bait: { ...NIH_DAIRIA_PREDATOR } };
  const modeSize = { tank: NIH_DAIRIA_SIZE_METRES, bait: NIH_DAIRIA_PREDATOR_SIZE_METRES };
  function setMode(mode) {
    if (mode !== 'tank' && mode !== 'bait') return false;
    modeMotion[state.mode] = { ...params.motion }; modeSize[state.mode] = state.sizeMetres;   // the mode left keeps what was tuned in it
    state.mode = mode; root.querySelector('[data-k="mode"]').value = mode;
    bait.setOn(mode === 'bait'); keys.clear(); scripted = null; cruiseTap = false; seat.release();
    state.sizeMetres = modeSize[mode]; applySize();
    motionPreset(modeMotion[mode]);
    if (mode === 'bait') { tank.visible = false; gameCam?.setOn(false); }   // the game camera is the tank's: its rear frame goes and the lens is back before the optic takes it
    modePanel();
    newRound();
    return true;
  }
  // a motion preset into the panel's knobs and the creature now (the knobs still tune it after)
  function motionPreset(preset) {
    Object.assign(params.motion, preset);
    if (creature) for (const [k, v] of Object.entries(preset)) creature.settings[k] = v;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }
  // the driving camera: the lab's chase or the game's own (./boss/game-cam.js); the switch and V follow each other
  function setCam(mode) {
    if (mode !== 'lab' && mode !== 'game') return false;
    state.cam = mode; root.querySelector('[data-k="cam"]').value = mode;
    return true;
  }
  for (const el of root.querySelectorAll('[data-k]')) el.addEventListener('input', () => {
    const k = el.dataset.k;
    if (k === 'lure') setLure(el.value);
    else if (k === 'mode') { setMode(el.value); el.blur(); }
    else if (k === 'view') state.view = el.value;
    else if (k === 'cam') { setCam(el.value); el.blur(); }   // the select must not keep V's keystrokes
    else if (k === 'variant' && el.value !== state.variant && planet && !loading) makeCreature(el.value);   // during a load: picked up after it
  });
  const copyBox = root.querySelector('[data-copy]');
  // THE VALUES TO PASTE (owner, 2026-10-09; ./boss/settings-copy.js): every knob the owner tunes, one line a group, to the clipboard (C or the button;
  // COPIED confirms), else into the box below the buttons, selected. Nothing reads a pasted copy back: the old JSON is gone for the block
  const knobPaths = new Map([[fightTune, ''], [fightTune.wall, 'wall.'], [fightTune.rotary, 'rotary.'], [fightTune.nuke, 'nuke.'], [fightTune.fear, 'fear.'],
    [fightTune.fear.weight, 'fear.weight.'], [fightTune.bofors, 'bofors.'], [fightTune.sol, 'sol.'], [fightOn, '']]);
  function copySettings() {
    const m = params.motion, bm = !tankOn();   // the base: in the bait mode the kit's own settings carry the temperament's lunge or flight
    const { fight: changed, fear: fearNow } = folderGroups(fightGui.controllers, knobPaths, new Set([altCtl, erraticCtl, baitHealthCtl, reloadCtl, hopCtl, seedCtl]));
    const text = settingsBlock({
      head: { mode: state.mode, variant: state.variant, size: state.sizeMetres },
      motion: Object.fromEntries(MOTION_CONTROLS.map((c) => [c.key, m[c.key]])),
      phys: { gravity: params.phys.gravity, iterations: params.phys.iterations, feeding: params.feeding, instinct: params.instinct },
      bait: bm ? { altitude: bait.params.altitude, erratic: fightTune.bait.erratic, health: baitOpts.health, reload: seat.params.reload, hopChance: fightTune.bait.hopChance } : null,
      fight: changed, fear: fearNow,
      more: bm ? {   // the bait mode's fear per gun and temperament (wave B)
        'gun fear': Object.fromEntries(['rotary', 'bofors', 'nuke'].flatMap((k) => Object.entries(fightTune.gunFear[k]).map(([p, v]) => [`${{ rotary: '25mm', bofors: '40mm', nuke: 'mk9' }[k]}.${p}`, v]))),
        temperament: { speed: params.motion.speed, ...fightTune.temperament },
        wave: { ...fightTune.wave },   // the first wave
      } : null,
    });
    const fallback = () => { copyBox.hidden = false; copyBox.value = text; copyBox.focus(); copyBox.select(); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => { copyBox.hidden = true; showCallout('COPIED'); }, fallback);
    else fallback();
    return text;
  }
  const reset = () => newRound();
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
      removeEventListener('keydown', onDown); removeEventListener('keyup', onUp); removeEventListener('blur', onBlur); removeEventListener('keydown', onSeatKey, { capture: true });
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      creature?.dispose(); if (prey) { prey.mesh.geometry.dispose(); prey.mesh.material.dispose(); }
      gameCam?.dispose(); seat.dispose(); wave.dispose(); sinkhole.dispose(); bait.dispose(); cannon.dispose(); friendlies.dispose(); arena.dispose(); round.dispose(); explosions.dispose();
      planetMesh?.userData.dispose(); disposeObj(tank); gui.destroy(); controls.dispose(); renderer.dispose(); renderer.domElement.remove();
      engine?.stop(0); engine = null; audio.dispose();
      if (window.__bossLab === lab) delete window.__bossLab;
    },
  };
  // the browser step's handle (Task 6): published only for the acceptance harness
  const lab = createLabHandle({
    getCreature: () => creature, getScale: () => scale, getT: () => t, getFight: () => fight, getGameCam: () => gameCam, getReanchors: () => reanchors,
    setScripted: (v) => { scripted = v; }, setPin: (v) => { pin = v; },
    readout, setLure, setCam, setMode, bait, seat, setFight, fireCannon: () => fireCannon(), copySettings, reset, tryReanchor, placeTank, creatureNow, creatureAim, temperament,
    plane, drive, keys, state, cam, params, gui, arena, fear, fightTune, scene, wave, sinkhole,
    reeds: (n) => { if (n !== undefined) { fightTune.wave.count = Math.max(0, Math.min(WAVE_MAX, Math.round(n))); gui.controllersRecursive().forEach((c) => c.updateDisplay()); newRound(); } return fightTune.wave.count; },
    chase: () => { if (state.view !== 'free' || !creature) return false; chaseCam(); return true; },
  });
  if (q.get('acceptance') === '1') window.__bossLab = lab;
  resize();
  return api;
}

function disposeObj(o) {
  o?.traverse?.((c) => { c.geometry?.dispose?.(); c.material?.dispose?.(); });
}
