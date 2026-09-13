// swarm-tab.js — the enemy study: what a crowd LOOKS like in a lane, what it
// FEELS like to run through, and what the frame pays for it.
//
// The units tab answers "is this model right", one unit at a time, up close,
// and says so in its own header. This answers a different question, so it is a
// sibling rather than a mode bolted onto that carousel.
//
// IT IS A LANE, NOT A TURNTABLE. A first cut orbited a grid of bodies, and a
// grid tells you nothing: a crowd reads by how it FUNNELS — walls either side,
// a long file closing on a tank, bodies bunching where the lane narrows. The
// operator's note was to make it feel real, so the tank drives, the rammable
// ones go under the treads with their burst and their cue, the combo counts,
// and the hull slows on every hit. The rules are the game's, imported, not
// re-typed: RAM_PREMIUM and STREAK_CAP come from domain/economy, `rammable`
// and `bounty` from ENEMY_SPEC, the splat from units.makeDotBurst.
//
// ON MEASURING. requestAnimationFrame deltas measure VSYNC, not work: a first
// pass reported a flat 16.6 ms for every variant at every count, which is the
// display, not the renderer. The cost line renders in a tight loop and blocks
// on gl.finish(), so it reads what the work is worth and can read far UNDER
// one frame.
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { makeDotEnemy, makeDotBurst, buildUnit, preloadMork } from '../units.js';
import { makeJelly } from '../jelly.js';
import { ENEMY_SPEC, CREATURE_TINTS, accentFor } from '../enemyspec.js';
import { RAM_PREMIUM, STREAK_CAP, STREAK_STEP } from '../domain/economy.js';
import { makeAudio } from '../audio.js';
import { stepYardDrive } from '../domain/yard-drive.js';
import { makeTankFeel, stepTankFeel, applyTankFeel } from '../tankfeel.js';
import { FEEL, loadFeel } from '../feelstore.js';
import { applyFontPack, currentFontPack } from '../fonts.js';
import { storage } from '../storage.js';

const TYPES = Object.keys(CREATURE_TINTS).filter((t) => ENEMY_SPEC[t]);
const DIE_CUES = ['enemy_die_a', 'enemy_die_b', 'enemy_die_c'];

// Lane geometry, in the lab's own metres. Long enough that a file reads as a
// file rather than as a clump arriving all at once.
const LANE = { len: 300, half: 7, wall: 4.5, spawnZ: -120, endZ: 40 };
const TOUCH = 4.6;          // contact radius: the hull is a wide box, not a sphere
const RAM_COMBO_GAP = 4;    // td-tab's window: a chain lapses after this
const BUMP = 0.34;          // how much speed one impact takes off the hull
const BUMP_BACK = 1.9;      // ...and how fast it comes back, per second

// THE TANK IS NOT RE-IMPLEMENTED HERE. A first cut integrated its own x/z and
// yawed the hull off a sine, which is a second, worse tank: no hover, no
// settle, no engine, and a feel that could drift from the game's the moment
// anyone touched TANK_FEEL. Movement is domain/yard-drive.stepYardDrive — the
// same flat-ground model the astro yard drives — and the hover, idle vibration
// and touchdown rock are tankfeel.js read through the persisted FEEL, exactly
// as src/labs/astro-drive.js does it. The SCRIPTED modes are inputs to that
// same model, never a second path: a charge is a throttle, not a teleport.
const DRIVE_R = 4.2;        // hull radius handed to the drive's blocker test

// Deterministic: a study you cannot reproduce twice is an anecdote.
const h = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

export function initSwarmTab(root) {
  root.innerHTML = `<div id="swarm">
    <div class="sw-side">
      <h2>enemy study</h2>
      <label>body <select data-k="type">${TYPES.map((t) => `<option>${t}</option>`).join('')}</select></label>
      <label>form <select data-k="form"><option value="dots">dot cloud</option><option value="jelly">jelly body</option></select></label>
      <label>alive at once <b data-v="count">100</b><input type="range" data-k="count" min="1" max="1200" step="1" value="100"></label>
      <label>density <b data-v="dens">1.0</b>&times;<input type="range" data-k="dens" min="0.2" max="4" step="0.1" value="1"></label>
      <label>file width <b data-v="spread">0.5</b>&times;<input type="range" data-k="spread" min="0.1" max="1.6" step="0.05" value="0.5"></label>
      <label>tank <select data-k="drive"><option value="manual">you drive (WASD)</option><option value="charge">charging</option><option value="patrol">weaving</option><option value="static">parked</option></select></label>
      <label>view <select data-k="view"><option value="chase">chase</option><option value="side">side</option><option value="top">top</option><option value="free">free orbit</option></select></label>
      <label><input type="checkbox" data-k="walls" checked> canyon walls</label>
      <label><input type="checkbox" data-k="sound"> sound</label>
      <button type="button" class="sw-run" data-run>run the lane</button>
      <p class="sw-hint">Free play keeps that many alive forever, respawning
      each kill — good for looking at a crowd, useless for scoring one.
      <b>Run the lane</b> seats them once and ends when the last is dead or
      past you; only a run is measured.</p>
      <p class="sw-note">Rammable belts go under the treads for a premium;
      solid cores stop the hull dead and break the chain. Ram rules, bounties
      and the splat are the game's own, imported — nothing is re-typed here.</p>
    </div>
    <div class="sw-stage">
      <div class="sw-hud" data-hud>&nbsp;</div>
      <div class="sw-callouts" data-callouts></div>
      <div class="sw-combo combobox" data-combo hidden><b data-tier="0">&nbsp;</b></div>
      <div class="sw-keys" data-keys>W A S D / arrows &middot; drive</div>
      <div class="sw-read" data-read>&nbsp;</div>
      <div class="sw-card" data-card hidden></div>
    </div>
  </div>`;

  const stage = root.querySelector('.sw-stage');
  const read = root.querySelector('[data-read]');
  const hud = root.querySelector('[data-hud]');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080b);
  scene.fog = new THREE.Fog(0x05080b, 70, 210);
  const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true;
  controls.enabled = false;
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(8, 16, 6); scene.add(key);

  // --- the canyon ----------------------------------------------------------
  const canyon = new THREE.Group(); scene.add(canyon);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x11181f, roughness: 1, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(LANE.half * 2, LANE.len), floorMat);
  floor.rotation.x = -Math.PI / 2; canyon.add(floor);
  const grid = new THREE.GridHelper(LANE.len, LANE.len / 6, 0x1d3542, 0x142530);
  grid.position.y = 0.02; canyon.add(grid);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b2733, roughness: 0.95 });
  const walls = new THREE.Group(); canyon.add(walls);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, LANE.wall, LANE.len), wallMat);
    w.position.set(s * LANE.half, LANE.wall / 2, 0); walls.add(w);
    // a lip, so the wall has an edge to read against the fog
    const lip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, LANE.len),
      new THREE.MeshBasicMaterial({ color: 0x2f4a5c }));
    lip.position.set(s * LANE.half, LANE.wall + 0.11, 0); walls.add(lip);
  }

  // The tank is the yardstick. A first cut had both at roughly one unit and
  // the phages came out taller than the hull — a crowd only reads as a crowd
  // when the thing it is closing on is plainly bigger than any one of them.
  const TANK_R = 3.4;
  const hullCols = { walker: 0x9fdcff, walkerHi: 0xffffff };
  // MÖRK is the game's hull and the whole point is that this feels like the
  // game, but it is a GLB: build the procedural one now so the lane runs on
  // the first frame, and swap when the real model lands. A lab that waits on
  // a download to show anything is a lab nobody opens twice.
  let tank = buildUnit('tank', hullCols);
  tank.scale.setScalar(TANK_R); scene.add(tank);
  preloadMork?.().then(() => {
    if (disposed) return;
    const m = buildUnit('mork', hullCols);
    if (!m) return;
    scene.remove(tank); disposeObj(tank);
    m.scale.setScalar(TANK_R); tank = m; scene.add(tank);
  }).catch(() => { /* the procedural hull is a fine fallback */ });

  // THE SHOUT LAYER IS THE GAME'S. .callout and .co-milestone are global
  // classes and the ladder has an existing second consumer in .combobox
  // [data-tier], so the lab wears the real treatment — the same phosphors,
  // the same rungs, the flicker on the top rung — instead of a lookalike.
  // The pack variables come from fonts.js the way the game installs them.
  applyFontPack(currentFontPack(), root);
  const calloutsEl = root.querySelector('[data-callouts]');
  const comboEl = root.querySelector('[data-combo]');
  const comboB = comboEl.querySelector('b');
  function showCallout(text, cls) {
    while (calloutsEl.children.length >= 3) calloutsEl.firstChild.remove();
    const d = document.createElement('div');
    d.className = `callout ${cls}`; d.textContent = text;
    calloutsEl.append(d);
    setTimeout(() => d.remove(), 1200);
  }
  function syncCombo() {
    // td-tab's rule: the ladder stays out of the way until a chain is real
    if (run.combo < 2) { comboEl.hidden = true; return; }
    comboEl.hidden = false;
    comboB.textContent = `RAM \u00d7${run.combo}`;
    comboB.dataset.tier = String(Math.min(5, Math.floor(run.combo / 10)));
    comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop');
  }

  let audio = null;
  const cue = (k, o) => { try { audio?.play(k, o); } catch { /* a lab is not worth a throw */ } };

  const state = { type: TYPES[0], form: 'dots', count: 100, dens: 1,
    drive: 'manual', view: 'chase', walls: true, sound: false, spread: 0.5 };
  const run = { kills: 0, combo: 0, comboT: 0, maxCombo: 0, earned: 0, blocked: 0, escaped: 0, speed: 1, hit: 0 };

  // Held keys, not key events: a tank driven by keydown repeat stutters.
  const keys = new Set();
  const isText = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? '');
  const onDown = (e) => { if (isText(e)) return; keys.add(e.key.toLowerCase());
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault(); };
  const onUp = (e) => keys.delete(e.key.toLowerCase());
  addEventListener('keydown', onDown); addEventListener('keyup', onUp);
  addEventListener('blur', () => keys.clear());

  // A RUN IS A FIXED POPULATION, MEASURED END TO END. Free play recycles a
  // body the moment it dies, which is right for looking at a crowd and wrong
  // for scoring one: a number taken off an endless stream is a number about
  // the sampler, not about the work. So a run seats `count` bodies once and
  // ends when the last of them is dead or past the tank.
  const RUNS_KEY = 'swarm:runs';
  let running = false, runT0 = 0, samples = [], frames = [], late = 0,
    peak = { calls: 0, points: 0, tris: 0 }, lastRun = null;
  let kept = [];
  try { kept = JSON.parse(storage.getItem(RUNS_KEY) || '[]').slice(0, 6); } catch { kept = []; }

  let bodies = [], bursts = [], pool = [], disposed = false, raf = 0, rebuild = true;
  loadFeel();                       // the tuning the unit bench saved
  const feel = makeTankFeel();
  // yaw 0 is +Z in the drive model and the file closes from -Z, so the hull
  // starts facing the lane rather than its own back
  const drive = { x: 0, z: LANE.endZ - 18, yaw: Math.PI, speed: 0, blocked: false };
  // the canyon, as the drive model's blockers: [minX, minZ] to [maxX, maxZ]
  const wallBoxes = [
    { min: [-LANE.half - 3, -LANE.len / 2], max: [-LANE.half + 0.7, LANE.len / 2] },
    { min: [LANE.half - 0.7, -LANE.len / 2], max: [LANE.half + 3, LANE.len / 2] },
  ];
  let engineOn = false;
  let tankZ = LANE.endZ, tankX = 0, t = 0, cost = 0, acc = 0, lastProbe = 0, lastNow = performance.now();

  const spec = () => ENEMY_SPEC[state.type] ?? { speed: 1, bounty: 1, rammable: true, size: 0.4 };

  function disposeObj(o) {
    o.traverse?.((c) => { c.geometry?.dispose?.(); c.material?.dispose?.(); });
    o.geometry?.dispose?.(); o.material?.dispose?.();
  }
  function clearBodies() {
    for (const b of bodies) { scene.remove(b.obj); disposeObj(b.obj); }
    for (const d of bursts) { scene.remove(d); disposeObj(d); }
    bodies = []; bursts = []; pool = [];
  }

  function makeBody() {
    const tint = CREATURE_TINTS[state.type] ?? 0xffffff;
    const cols = { walker: tint, walkerHi: accentFor(state.type) ?? 0xffffff };
    const o = state.form === 'jelly' ? makeJelly(cols) : makeDotEnemy(state.type, cols, state.dens);
    // ENEMY_SPEC.size is the game's own ratio against a cell; here the cell is
    // the hull. A phage at 0.4 comes out a bit under a quarter of the tank.
    const r = (ENEMY_SPEC[state.type]?.size ?? 0.4) * TANK_R * 0.58;
    o.scale.setScalar(r * (state.form === 'jelly' ? 1.6 : (o.userData.baseScale ?? 1)));
    return o;
  }

  // A body that leaves the lane is RESET, not rebuilt: building one is
  // hundreds of points of geometry, and doing that per kill at a thousand
  // alive would measure the allocator instead of the renderer.
  function seat(b, i) {
    // A COLUMN, not a cloud. The lateral spread is a fraction of the lane and
    // the depth runs the whole way back, so the near end is already dying
    // while the far end has not arrived — which is what makes it read as a
    // file closing rather than a field standing.
    // INSIDE THE CANYON, AND IN FRONT OF THE TANK. The depth used to run
    // `spawnZ - h * len * 0.92`, which seated bodies as far back as z -396 in
    // a lane that only spans +/-150: most of the file stood outside the drawn
    // world, and once the hull stopped at the lane end instead of looping,
    // they never arrived at all. The column now fills the far two thirds of
    // the actual lane, so every body is somewhere the tank can reach it.
    const w = LANE.half * 0.62 * state.spread;
    const far = -LANE.len / 2 + 10, near = LANE.endZ - 34;
    b.x = (h(b.seed, 1) - 0.5) * 2 * w;
    b.z = far + h(b.seed, 2) * (near - far);
    b.seed = (b.seed * 7 + 13) % 100000;
    b.obj.visible = true;
    b.done = false;
  }

  // In a run a body leaves for good. Hidden rather than removed: disposing
  // hundreds of geometries mid-run would measure the allocator.
  function retire(b) { b.done = true; b.obj.visible = false; }
  const liveCount = () => { let n = 0; for (const b of bodies) if (!b.done) n++; return n; };

  function build() {
    clearBodies();
    for (let i = 0; i < state.count; i++) {
      let obj; try { obj = makeBody(); } catch { break; }
      const b = { obj, seed: i * 17 + 3, x: 0, z: 0, r: obj.scale.x * 0.9 };
      seat(b, i); scene.add(obj); bodies.push(b);
    }
    Object.assign(run, { kills: 0, combo: 0, comboT: 0, maxCombo: 0, earned: 0, blocked: 0, escaped: 0, speed: 1, hit: 0 });
    rebuild = false;
  }

  function impact(b) {
    const s = spec();
    const n = [0, 1, 0];
    if (s.rammable) {
      const burst = makeDotBurst(CREATURE_TINTS[state.type] ?? 0xffffff, n);
      burst.scale.setScalar(1.6);
      burst.position.set(b.x, 0.6, b.z);
      scene.add(burst); bursts.push(burst);
      run.kills++; run.combo++; run.comboT = RAM_COMBO_GAP;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      // the game's purse: bounty x ram premium x a streak that caps
      const streak = Math.min(STREAK_CAP, 1 + run.combo * STREAK_STEP);
      run.earned += Math.round((s.bounty ?? 1) * RAM_PREMIUM * streak);
      run.speed = Math.max(0.25, run.speed - BUMP);
      run.hit = 1;
      if (state.sound) cue(DIE_CUES[run.kills % DIE_CUES.length], { rate: 1 + (h(run.kills, 9) - 0.5) * 0.2 });
      syncCombo();
      // the game shouts on every tenth rung, and only then
      if (run.combo >= 10 && run.combo % 10 === 0) showCallout(`RAM \u00d7${run.combo}`, 'co-milestone');
      if (running) retire(b); else seat(b);
    } else {
      // A SOLID CORE DOES NOT GO UNDER THE TREADS. It stops the hull and
      // breaks the chain — that read is the whole point of the belt ladder,
      // and a lab that let the tank plough through it would teach the wrong
      // thing about the roster it is meant to be studying.
      run.blocked++;
      if (run.combo >= 10) showCallout('CHAIN BROKEN', 'co-streak');
      run.combo = 0; run.comboT = 0; syncCombo();
      run.speed = Math.max(0.12, run.speed - BUMP * 1.8);
      run.hit = 1;
      if (state.sound) cue('tank_pickup', { rate: 0.7 });
      if (running) retire(b); else seat(b);
    }
  }

  function step(dt) {
    const s = spec();
    run.speed = Math.min(1, run.speed + BUMP_BACK * dt);
    run.hit = Math.max(0, run.hit - dt * 3);
    if (run.comboT > 0 && (run.comboT -= dt) <= 0) { run.combo = 0; syncCombo(); }

    // THE TANK IS DRIVEN, NOT PLACED. Every mode produces a throttle and a
    // turn; stepYardDrive owns what those become. The ram bump scales the
    // throttle rather than the position, so an impact reads as the engine
    // losing its bite instead of the world stuttering.
    const bite = run.speed;
    let throttle = 0, turn = 0;
    if (state.drive === 'manual') {
      throttle = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      turn = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
    } else if (state.drive === 'charge') {
      throttle = 1;
      // creep back to the middle of the lane rather than steering off a sine:
      // a scripted tank that swerves is the swerve the operator asked to lose
      turn = Math.max(-0.4, Math.min(0.4, drive.x * 0.12));
    } else if (state.drive === 'patrol') {
      throttle = Math.sin(t * 0.35) > 0 ? 1 : -1;
      turn = Math.sin(t * 0.5) * 0.5;
    }
    stepYardDrive(drive, { throttle: throttle * bite, turn }, dt, wallBoxes, DRIVE_R);
    // the lane is a corridor: hold the near end so the file always has a target
    if (drive.z > LANE.endZ) { drive.z = LANE.endZ; drive.speed = 0; }
    if (drive.z < -LANE.len / 2 + 6) { drive.z = -LANE.len / 2 + 6; drive.speed = 0; }
    tankX = drive.x; tankZ = drive.z;
    tank.position.set(drive.x, 0, drive.z);
    tank.rotation.y = drive.yaw;
    // hover, idle vibration and the rock on touchdown — the game's own, read
    // through the persisted tuning so the bench and the board cannot disagree
    stepTankFeel(feel, dt, Math.abs(drive.speed) > 0.2, FEEL);
    applyTankFeel(tank, feel, FEEL);
    if (state.sound) {
      const want = Math.abs(drive.speed) > 0.2;
      if (want && !engineOn) { engineOn = true; cue('tank_engine', { loop: true }); }
      if (!want && engineOn) engineOn = false;
    }

    // the file, closing
    const v = (s.speed ?? 1) * 7;
    for (const b of bodies) {
      if (b.done) continue;
      b.z += v * dt;
      const dx = b.x - tankX, dz = b.z - tankZ;
      if (dx * dx + dz * dz < TOUCH * TOUCH) { impact(b); continue; }
      if (b.z > LANE.endZ + 26) { if (running) { run.escaped++; retire(b); } else seat(b); }
      b.obj.position.set(b.x, b.r, b.z);
      b.obj.rotation.y = Math.PI;
      b.obj.userData.tick?.(t);
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const alive = bursts[i].userData.tick?.(dt);
      if (alive === false) { scene.remove(bursts[i]); disposeObj(bursts[i]); bursts.splice(i, 1); }
    }
  }

  function frameCamera() {
    controls.enabled = state.view === 'free';
    if (state.view === 'free') { controls.update(); return; }
    const shake = run.hit * 0.5;
    if (state.view === 'chase') {
      cam.position.set(tankX * 0.6 + (h(run.kills, 3) - 0.5) * shake, 11 + shake, tankZ + 26);
      cam.lookAt(tankX * 0.3, 2.0, tankZ - 44);
    } else if (state.view === 'side') {
      cam.position.set(LANE.half + 30, 12, tankZ + 6);
      cam.lookAt(0, 2, tankZ - 22);
    } else {
      cam.position.set(0, 96, tankZ - 30); cam.lookAt(0, 0, tankZ - 32);
    }
  }

  // TRUE GPU TIME, NOT A STALL. gl.finish() blocks the CPU until the GPU is
  // done, which reads honestly but distorts the frame it measures — fine for
  // a spot probe, wrong for sampling every frame of a run. The timer-query
  // extension the game already uses reports elapsed GPU time asynchronously,
  // so a run can be measured without being changed by the measuring.
  const gl = renderer.getContext();
  const gpuExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let gpuOpen = null; const gpuPending = [];
  function gpuBegin() {
    if (!gpuExt || gpuOpen || gpuPending.length >= 8) return;
    gpuOpen = gl.createQuery(); gl.beginQuery(gpuExt.TIME_ELAPSED_EXT, gpuOpen);
  }
  function gpuEnd() {
    if (!gpuOpen) return;
    gl.endQuery(gpuExt.TIME_ELAPSED_EXT); gpuPending.push(gpuOpen); gpuOpen = null;
    // a disjoint means the GPU was interrupted and every pending result is a
    // lie; throw them away rather than record a number nobody can trust
    if (gl.getParameter(gpuExt.GPU_DISJOINT_EXT)) {
      for (const q of gpuPending) gl.deleteQuery(q);
      gpuPending.length = 0; return;
    }
    while (gpuPending.length) {
      const q = gpuPending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      gl.deleteQuery(q); gpuPending.shift();
      if (running) sample(ns / 1e6);
    }
  }

  // TWO NUMBERS, BECAUSE ONE OF THEM LIES. TIME_ELAPSED_EXT through ANGLE is
  // approximate — a first run reported a 5.7 ms median and a 38 ms p95 for
  // 150 bodies while a gl.finish probe on the same scene read 0.8 ms for 420.
  // So the GPU figure is recorded as what it is (indicative) next to the one
  // thing that cannot be argued with: the wall-clock gap between frames, and
  // how many of those gaps missed 60fps. If the GPU column says 38 ms and no
  // frame was late, the GPU column is wrong, and the card shows you that.
  function sample(ms) {
    samples.push(ms);
    const inf = renderer.info.render;
    if (inf.calls > peak.calls) peak.calls = inf.calls;
    if (inf.points > peak.points) peak.points = inf.points;
    if (inf.triangles > peak.tris) peak.tris = inf.triangles;
  }

  function costMs(samples = 6) {
    const s = [];
    for (let i = 0; i < samples; i++) {
      const a = performance.now(); renderer.render(scene, cam); gl.finish();
      s.push(performance.now() - a);
    }
    s.sort((x, y) => x - y); return s[s.length >> 1];
  }

  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const gap = now - lastNow;
    const dt = Math.min(0.05, gap / 1000); lastNow = now; t += dt;
    // the frame BEFORE this one is what the gap measures, so skip the first
    if (running && frames.length + 1) { frames.push(gap); if (gap > 20) late++; }
    if (rebuild) build();
    walls.visible = state.walls;
    root.querySelector('[data-keys]').hidden = state.drive !== 'manual';
    const w = stage.clientWidth || 1, hh = stage.clientHeight || 1;
    if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix();
    }
    step(dt); frameCamera();
    gpuBegin(); renderer.render(scene, cam); gpuEnd();
    // no timer extension: fall back to the stalling probe, slowly, so the
    // run still gets a distribution even if a coarse one
    if (running && !gpuExt && t - lastProbe > 0.25) { lastProbe = t; sample(costMs(3)); }
    if (running && bodies.length && liveCount() === 0) endRun();
    runBtn.textContent = running ? `running \u2014 ${liveCount()} left` : 'run the lane';
    runBtn.classList.toggle('on', running);

    acc += dt;
    if (acc > 0.4) {
      acc = 0;
      // THE PROBE MUST NOT RUN DURING A SCORED RUN. costMs() renders the scene
      // six more times and blocks on gl.finish each time; at 0.4 s intervals
      // that was landing a deliberate hitch into the very distribution the run
      // is there to measure — a first scored run reported 12% late frames, and
      // the probe was making them. The GPU timer covers a run without stalling,
      // so the probe stands down and the readout holds its last figure.
      if (!running) cost = costMs();
      const n = Math.max(1, bodies.length), inf = renderer.info.render;
      const s = spec();
      hud.innerHTML = (running
        ? `<span class="mode run">RUN &middot; ${liveCount()} LEFT</span>`
        : '<span class="mode">FREE PLAY &middot; RECYCLING</span>')
        + ` &middot; ${run.kills} under the treads &middot; ${run.earned}kg`
        + ` &middot; best &times;${run.maxCombo}`
        + (run.blocked ? ` &middot; <span class="bad">${run.blocked} blocked</span>` : '')
        + ` &middot; hull ${(run.speed * 100).toFixed(0)}%`
        + ` &middot; ${s.rammable ? 'rammable' : 'SOLID CORE'}`;
      read.innerHTML = `<b>${n}</b> alive &middot; cost <b>${cost.toFixed(2)} ms</b>`
        + ` (${(cost * 1000 / n).toFixed(1)} &micro;s each) &middot; ${(cost / 16.67 * 100).toFixed(0)}% of a 60fps frame`
        + `<br>calls <b>${inf.calls}</b> &middot; points ${inf.points.toLocaleString()}`
        + ` &middot; tris ${inf.triangles.toLocaleString()} &middot; motion ${bodies[0]?.obj?.material?.userData?.motion ?? 'shader'}`;
    }
  }

  const card = root.querySelector('[data-card]');
  const runBtn = root.querySelector('[data-run]');
  const FRAME = 16.67;

  function stats(a) {
    if (!a.length) return null;
    const v = [...a].sort((x, y) => x - y);
    const q = (p) => v[Math.min(v.length - 1, Math.floor(v.length * p))];
    return { n: v.length, max: v[v.length - 1], p95: q(0.95), med: q(0.5),
      mean: v.reduce((x, y) => x + y, 0) / v.length, min: v[0] };
  }

  function startRun() {
    samples = []; frames = []; late = 0; peak = { calls: 0, points: 0, tris: 0 };
    drive.x = 0; drive.z = LANE.endZ - 18; drive.yaw = Math.PI; drive.speed = 0;
    card.hidden = true; rebuild = true; running = true; runT0 = performance.now();
    // rebuild happens on the next frame; run stats reset with it
  }

  function endRun() {
    running = false;
    const st = stats(samples), ft = stats(frames);
    const rec = {
      at: Date.now(), label: `${state.count}x ${state.type}`,
      type: state.type, form: state.form, count: state.count, dens: state.dens,
      seconds: +((performance.now() - runT0) / 1000).toFixed(1),
      kills: run.kills, escaped: run.escaped, blocked: run.blocked,
      maxCombo: run.maxCombo, earned: run.earned,
      calls: peak.calls, points: peak.points, tris: peak.tris,
      gpu: st ? { max: +st.max.toFixed(2), p95: +st.p95.toFixed(2), med: +st.med.toFixed(2),
        mean: +st.mean.toFixed(2), min: +st.min.toFixed(2), n: st.n } : null,
      frame: ft ? { max: +ft.max.toFixed(2), p95: +ft.p95.toFixed(2), med: +ft.med.toFixed(2),
        mean: +ft.mean.toFixed(2), n: ft.n } : null,
      late, latePct: frames.length ? +(late / frames.length * 100).toFixed(1) : 0,
      series: frames.slice(-160).map((x) => +x.toFixed(2)),
      gpuSeries: samples.slice(-160).map((x) => +x.toFixed(2)),
    };
    lastRun = rec;
    drawCard();
  }

  // A bar per sample against the 60fps line, because a mean hides the spike
  // that actually drops a frame — the whole reason to look at a run rather
  // than at an average.
  function spark(series, w = 240, hgt = 38) {
    if (!series?.length) return '';
    // clamped, because one 150 ms hitch would flatten every other bar into
    // the baseline and the shape of the run is the thing worth seeing
    const top = Math.min(Math.max(FRAME, ...series), FRAME * 4) * 1.08;
    const bw = w / series.length;
    const bars = series.map((v, i) => {
      const bh = Math.max(1, (Math.min(v, top) / top) * hgt);
      const over = v > 20;
      return `<rect x="${(i * bw).toFixed(2)}" y="${(hgt - bh).toFixed(2)}" width="${Math.max(0.6, bw - 0.3).toFixed(2)}"
        height="${bh.toFixed(2)}" fill="${over ? '#ff6b5e' : '#7fe6d0'}" opacity="${over ? 0.95 : 0.62}"/>`;
    }).join('');
    const y = (hgt - (FRAME / top) * hgt).toFixed(2);
    return `<svg viewBox="0 0 ${w} ${hgt}" width="100%" height="${hgt}" preserveAspectRatio="none" aria-hidden="true">
      ${bars}<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#ffb43d" stroke-width="1" stroke-dasharray="3 3" opacity="0.8"/></svg>`;
  }

  const pct = (ms) => `${(ms / FRAME * 100).toFixed(0)}%`;
  function column(r, current) {
    if (!r) return '';
    const g = r.gpu, f = r.frame;
    return `<div class="sw-col${current ? ' now' : ''}">
      <h4>${r.label}${current ? ' <i>this run</i>' : ''}</h4>
      <div class="sw-spark">${spark(r.series)}</div>
      ${f ? `<dl>
        <dt class="hd">frame gap</dt><dd class="hd">wall clock</dd>
        <dt>max</dt><dd class="${f.max > 20 ? 'bad' : ''}">${f.max.toFixed(1)} ms <s>${pct(f.max)}</s></dd>
        <dt>p95</dt><dd>${f.p95.toFixed(1)} ms <s>${pct(f.p95)}</s></dd>
        <dt>median</dt><dd>${f.med.toFixed(1)} ms <s>${pct(f.med)}</s></dd>
        <dt>late frames</dt><dd class="${r.latePct > 1 ? 'bad' : 'good'}">${r.late} <s>${r.latePct}%</s></dd>
      </dl>` : ''}
      ${g ? `<dl class="sw-gpu">
        <dt class="hd">gpu timer</dt><dd class="hd">indicative</dd>
        <dt>max</dt><dd>${g.max.toFixed(2)} ms</dd>
        <dt>p95</dt><dd>${g.p95.toFixed(2)} ms</dd>
        <dt>median</dt><dd>${g.med.toFixed(2)} ms</dd>
        <dt>mean</dt><dd>${g.mean.toFixed(2)} ms</dd>
      </dl>` : '<p class="sw-nogpu">GPU timing unavailable in this browser</p>'}
      <dl class="sw-run-stats">
        <dt>rammed</dt><dd>${r.kills}</dd>
        <dt>escaped</dt><dd>${r.escaped}</dd>
        ${r.blocked ? `<dt>blocked</dt><dd class="bad">${r.blocked}</dd>` : ''}
        <dt>best chain</dt><dd>&times;${r.maxCombo}</dd>
        <dt>earned</dt><dd>${r.earned}kg</dd>
        <dt>seconds</dt><dd>${r.seconds}</dd>
        <dt>peak calls</dt><dd>${r.calls}</dd>
        <dt>peak points</dt><dd>${r.points.toLocaleString()}</dd>
      </dl></div>`;
  }

  function drawCard() {
    card.hidden = false;
    card.innerHTML = `<div class="sw-card-head"><b>run complete</b>
        <span>${lastRun?.frame ? `${lastRun.frame.n} frames${lastRun.gpu ? `, ${lastRun.gpu.n} GPU samples` : ''}` : ''}</span>
        <button type="button" data-keep>keep for comparison</button>
        ${kept.length ? '<button type="button" data-clear>clear kept</button>' : ''}
        <button type="button" data-close>close</button></div>
      <div class="sw-cols">${column(lastRun, true)}${kept.map((r) => column(r, false)).join('')}</div>`;
  }

  card.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.close !== undefined) card.hidden = true;
    if (b.dataset.clear !== undefined) {
      kept = []; storage.setItem(RUNS_KEY, '[]'); drawCard();
    }
    if (b.dataset.keep !== undefined && lastRun) {
      kept = [lastRun, ...kept].slice(0, 4);
      storage.setItem(RUNS_KEY, JSON.stringify(kept));
      drawCard();
    }
  });
  runBtn.addEventListener('click', startRun);

  for (const el of root.querySelectorAll('[data-k]')) {
    el.addEventListener('input', () => {
      const k = el.dataset.k;
      state[k] = el.type === 'checkbox' ? el.checked
        : el.type === 'range' ? Number(el.value) : el.value;
      const out = root.querySelector(`[data-v="${k}"]`);
      if (out) out.textContent = k === 'count' ? el.value : Number(el.value).toFixed(1);
      if (k === 'sound' && state.sound && !audio) { audio = makeAudio({ base: '../' }); audio.resume?.(); }
      if (['type', 'form', 'count', 'dens'].includes(k)) rebuild = true;
      if (k === 'spread') for (const b of bodies) seat(b);
    });
  }

  const api = {
    set(k, v) {
      const el = root.querySelector(`[data-k="${k}"]`);
      if (!el) return false;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    startRun, endRun,
    lastRun: () => lastRun,
    kept: () => kept.slice(),
    state: () => ({ ...state, built: bodies.length, running, live: liveCount(),
      samples: samples.length, gpuTimer: !!gpuExt, kills: run.kills, combo: run.combo,
      maxCombo: run.maxCombo, earned: run.earned, blocked: run.blocked, escaped: run.escaped,
      hull: +run.speed.toFixed(3), bursts: bursts.length,
      speed: +drive.speed.toFixed(2), yaw: +drive.yaw.toFixed(3), hover: +feel.hoverT.toFixed(3),
      wallBlocked: drive.blocked,
      motion: bodies[0]?.obj?.material?.userData?.motion ?? null,
      calls: renderer.info.render.calls, points: renderer.info.render.points,
      triangles: renderer.info.render.triangles, costMs: cost }),
    types: TYPES.slice(),
  };
  window.__stalheartSwarm = api;

  loop();
  return {
    setActive: () => {},
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      removeEventListener('keydown', onDown); removeEventListener('keyup', onUp);
      clearBodies(); controls.dispose(); renderer.dispose();
      renderer.domElement.remove(); audio?.dispose?.();
      if (window.__stalheartSwarm === api) delete window.__stalheartSwarm;
    },
  };
}
