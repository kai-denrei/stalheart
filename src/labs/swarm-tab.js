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

const TYPES = Object.keys(CREATURE_TINTS).filter((t) => ENEMY_SPEC[t]);
const DIE_CUES = ['enemy_die_a', 'enemy_die_b', 'enemy_die_c'];

// Lane geometry, in the lab's own metres. Long enough that a file reads as a
// file rather than as a clump arriving all at once.
const LANE = { len: 300, half: 7, wall: 4.5, spawnZ: -120, endZ: 40 };
const TOUCH = 4.6;          // contact radius: the hull is a wide box, not a sphere
const RAM_COMBO_GAP = 4;    // td-tab's window: a chain lapses after this
const BUMP = 0.34;          // how much speed one impact takes off the hull
const BUMP_BACK = 1.9;      // ...and how fast it comes back, per second

// Deterministic: a study you cannot reproduce twice is an anecdote.
const h = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

export function initSwarmTab(root) {
  root.innerHTML = `<div id="swarm">
    <div class="sw-side">
      <h2>enemy study</h2>
      <label>body <select data-k="type">${TYPES.map((t) => `<option>${t}</option>`).join('')}</select></label>
      <label>form <select data-k="form"><option value="dots">dot cloud</option><option value="jelly">jelly body</option></select></label>
      <label>in the lane <b data-v="count">100</b><input type="range" data-k="count" min="1" max="1200" step="1" value="100"></label>
      <label>density <b data-v="dens">1.0</b>&times;<input type="range" data-k="dens" min="0.2" max="4" step="0.1" value="1"></label>
      <label>file width <b data-v="spread">0.5</b>&times;<input type="range" data-k="spread" min="0.1" max="1.6" step="0.05" value="0.5"></label>
      <label>tank <select data-k="drive"><option value="charge">charging</option><option value="patrol">weaving</option><option value="static">parked</option></select></label>
      <label>view <select data-k="view"><option value="chase">chase</option><option value="side">side</option><option value="top">top</option><option value="free">free orbit</option></select></label>
      <label><input type="checkbox" data-k="walls" checked> canyon walls</label>
      <label><input type="checkbox" data-k="sound"> sound</label>
      <p class="sw-note">Rammable belts go under the treads for a premium;
      solid cores stop the hull dead and break the chain. Ram rules, bounties
      and the splat are the game's own, imported — nothing is re-typed here.</p>
    </div>
    <div class="sw-stage">
      <div class="sw-hud" data-hud>&nbsp;</div>
      <div class="sw-read" data-read>&nbsp;</div>
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

  let audio = null;
  const cue = (k, o) => { try { audio?.play(k, o); } catch { /* a lab is not worth a throw */ } };

  const state = { type: TYPES[0], form: 'dots', count: 100, dens: 1,
    drive: 'charge', view: 'chase', walls: true, sound: false, spread: 0.5 };
  const run = { kills: 0, combo: 0, comboT: 0, maxCombo: 0, earned: 0, blocked: 0, speed: 1, hit: 0 };

  let bodies = [], bursts = [], pool = [], disposed = false, raf = 0, rebuild = true;
  let tankZ = LANE.endZ, tankX = 0, t = 0, cost = 0, acc = 0, lastNow = performance.now();

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
    const w = LANE.half * 0.62 * state.spread;
    b.x = (h(b.seed, 1) - 0.5) * 2 * w;
    b.z = LANE.spawnZ - h(b.seed, 2) * LANE.len * 0.92;
    b.seed = (b.seed * 7 + 13) % 100000;
    b.obj.visible = true;
  }

  function build() {
    clearBodies();
    for (let i = 0; i < state.count; i++) {
      let obj; try { obj = makeBody(); } catch { break; }
      const b = { obj, seed: i * 17 + 3, x: 0, z: 0, r: obj.scale.x * 0.9 };
      seat(b, i); scene.add(obj); bodies.push(b);
    }
    Object.assign(run, { kills: 0, combo: 0, comboT: 0, maxCombo: 0, earned: 0, blocked: 0, speed: 1, hit: 0 });
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
      seat(b);
    } else {
      // A SOLID CORE DOES NOT GO UNDER THE TREADS. It stops the hull and
      // breaks the chain — that read is the whole point of the belt ladder,
      // and a lab that let the tank plough through it would teach the wrong
      // thing about the roster it is meant to be studying.
      run.blocked++; run.combo = 0; run.comboT = 0;
      run.speed = Math.max(0.12, run.speed - BUMP * 1.8);
      run.hit = 1;
      if (state.sound) cue('tank_pickup', { rate: 0.7 });
      seat(b);
    }
  }

  function step(dt) {
    const s = spec();
    run.speed = Math.min(1, run.speed + BUMP_BACK * dt);
    run.hit = Math.max(0, run.hit - dt * 3);
    if (run.comboT > 0 && (run.comboT -= dt) <= 0) run.combo = 0;

    // the tank
    const base = 17 * run.speed;
    if (state.drive === 'charge') {
      tankZ -= base * dt;
      if (tankZ < LANE.spawnZ + 12) tankZ = LANE.endZ;
      tankX = Math.sin(t * 0.55) * LANE.half * 0.52;   // sweeps the lane, so the file is actually ploughed
    } else if (state.drive === 'patrol') {
      tankZ = LANE.endZ - 26 + Math.sin(t * 0.35) * 22;
      tankX = Math.sin(t * 1.25) * LANE.half * 0.55;
    } else { tankX = 0; tankZ = LANE.endZ - 18; }
    tank.position.set(tankX, 0.1, tankZ);
    tank.rotation.y = state.drive === 'static' ? Math.PI
      : Math.PI + Math.atan2(Math.cos(t * 0.7) * 0.5, -1) * 0.25;

    // the file, closing
    const v = (s.speed ?? 1) * 7;
    for (const b of bodies) {
      b.z += v * dt;
      const dx = b.x - tankX, dz = b.z - tankZ;
      if (dx * dx + dz * dz < TOUCH * TOUCH) { impact(b); continue; }
      if (b.z > LANE.endZ + 26) seat(b);
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

  const gl = renderer.getContext();
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
    const dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now; t += dt;
    if (rebuild) build();
    walls.visible = state.walls;
    const w = stage.clientWidth || 1, hh = stage.clientHeight || 1;
    if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix();
    }
    step(dt); frameCamera();
    renderer.render(scene, cam);

    acc += dt;
    if (acc > 0.4) {
      acc = 0; cost = costMs();
      const n = Math.max(1, bodies.length), inf = renderer.info.render;
      const s = spec();
      hud.innerHTML = `<span class="${run.combo >= 10 ? 'hot' : ''}">RAM &times;${run.combo}</span>`
        + ` &middot; ${run.kills} under the treads &middot; ${run.earned}kg`
        + (run.blocked ? ` &middot; <span class="bad">${run.blocked} blocked</span>` : '')
        + ` &middot; hull ${(run.speed * 100).toFixed(0)}%`
        + ` &middot; ${s.rammable ? 'rammable' : 'SOLID CORE'}`;
      read.innerHTML = `<b>${n}</b> in the lane &middot; cost <b>${cost.toFixed(2)} ms</b>`
        + ` (${(cost * 1000 / n).toFixed(1)} &micro;s each) &middot; ${(cost / 16.67 * 100).toFixed(0)}% of a 60fps frame`
        + `<br>calls <b>${inf.calls}</b> &middot; points ${inf.points.toLocaleString()}`
        + ` &middot; tris ${inf.triangles.toLocaleString()} &middot; motion ${bodies[0]?.obj?.material?.userData?.motion ?? 'shader'}`;
    }
  }

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
    state: () => ({ ...state, built: bodies.length, kills: run.kills, combo: run.combo,
      maxCombo: run.maxCombo, earned: run.earned, blocked: run.blocked,
      hull: +run.speed.toFixed(3), bursts: bursts.length,
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
      clearBodies(); controls.dispose(); renderer.dispose();
      renderer.domElement.remove(); audio?.dispose?.();
      if (window.__stalheartSwarm === api) delete window.__stalheartSwarm;
    },
  };
}
