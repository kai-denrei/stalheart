// Story lab: the 753 m story planet, its polar clearing and terraces, the
// tiled pad and the SH02 arrival. Metres; pole at the origin.
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { LOOKS } from '../looks.js';
import { STORY_RECIPE, STORY_CLEARING, LANDING_DEFAULTS, STORY_SOUNDS } from '../content/story-defaults.js';
import { SOUNDS } from '../audiomanifest.js';
import { makeAudio } from '../audio.js';
import { buildStoryPlanet } from '../domain/story-planet.js';
import { makeLandingSequence } from '../domain/landing-sequence.js';
import { compileRail } from '../cine/rail.js';
import { buildStoryPlanetMesh, buildMouthMarker } from './story-planet-mesh.js';
import { createStoryLanding } from './story-landing.js';
import { planBase } from '../domain/base-plan.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../content/base-layout.js';
import { createStoryBase } from '../fx/story-base.js';

// camera rail in pad metres: orbit, descent chase, touchdown, the door, Isao
const RAIL = [
  { t: 0, pos: [0, 1500, 900], look: [0, 0, 0], fov: 40 },
  { t: 4, pos: [180, 140, 260], look: [0, 150, 0], fov: 40 },
  { t: 9, pos: [90, 50, 140], look: [0, 40, 0] },
  { t: 12, pos: [70, 26, 110], look: [0, 16, 0] },
  { t: 16, pos: [52, 34, 70], look: [0, 24, 0] },
  { t: 18, pos: [30, 40, 42], look: [0, 34, 0] },
  { t: 22.8, pos: [36, 44, 50], look: [0, 38, 0] },
];

export function initStoryTab(root) {
  const q = new URLSearchParams(location.search);
  const container = root.querySelector('#story-app'), hud = root.querySelector('#story-hud');
  const look = LOOKS.tronColors;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(look.bg);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 6000);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08;
  scene.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], 1.4));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.6); sun.position.set(120, 260, 90); scene.add(sun);
  const fill = new THREE.DirectionalLight(look.sun[0], 0.5); fill.position.set(-200, 120, -160); scene.add(fill);

  let active = false, disposed = false, frameId = 0, planet = null, planetMesh = null, marker = null, landing = null, errors = [];
  // the thrust bed loops under the descent and cuts at touchdown; the tank's
  // pneumatics stand in for the legs, the landing and the door
  const sfx = makeAudio({ seed: 3, persist: false, sounds: { ...STORY_SOUNDS, tank_spool_up: SOUNDS.tank_spool_up, tank_spool_down: SOUNDS.tank_spool_down } });
  sfx.arm();
  const cueLog = [];
  const cue = (key, o) => { cueLog.push(key); if (cueLog.length > 40) cueLog.shift(); sfx.play(key, o); };
  let thrust = null, heard = null, thrustAsked = false;
  function audioSync(state, live) {
    if (!live) { thrust?.stop(0.1); thrust = null; heard = null; thrustAsked = false; return; }
    if (state.plume > 0) {
      // loop() returns null until the buffer has decoded and the context is
      // unlocked; log the intent once and keep asking each frame
      if (!thrustAsked) { cueLog.push('rocket_thrust'); thrustAsked = true; }
      if (!thrust) thrust = sfx.loop('rocket_thrust', { gain: 0 });
      thrust?.set(0.4 + 0.6 * state.plume, 0.96 + 0.06 * state.plume);
    } else { thrustAsked = false; if (thrust) { thrust.stop(0.08); thrust = null; } }
    const was = heard; heard = { legs: state.clips.Legs_Deploy !== null, down: state.clips.Landing_Shock !== null, door: state.clips.Top_Door_Open !== null };
    if (!was) return;
    if (heard.legs && !was.legs) cue('tank_spool_up');
    if (heard.down && !was.down) cue('tank_spool_down');
    if (heard.door && !was.door) cue('tank_spool_up', { rate: 0.85 });
  }
  const sequence = makeLandingSequence(LANDING_DEFAULTS);
  const rail = compileRail(RAIL);
  let t = sequence.duration, playing = false, onRail = false, last = performance.now();
  const clock = { time: 0 };

  hud.innerHTML = '<div class="story-lines"><b>STORY PLANET</b><span id="story-status">generating 16,000-point planet...</span><span id="story-stage"></span></div>'
    + '<div class="story-keys"><button id="story-land" type="button">L land</button><button id="story-skip" type="button">K skip</button><button id="story-reset" type="button">R reset</button><button id="story-overview" type="button">O overview</button><button id="story-gate" type="button">G gate</button><button id="story-play" type="button">P play here</button><span>drag to orbit, wheel to zoom</span></div>'
    + '<div class="story-keys" id="story-stages"></div>';
  const status = hud.querySelector('#story-status'), stageLine = hud.querySelector('#story-stage'), stageBar = hud.querySelector('#story-stages');
  const LAYOUT = { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES };
  let stage = Math.min(STAGES.length - 1, Math.max(0, parseInt(q.get('stage') || '', 10) || 1)), base = null, gateForced = false;
  for (const st of STAGES) { const b = document.createElement('button'); b.type = 'button'; b.textContent = `${st.n} ${st.name}`; b.dataset.stage = st.n; b.onclick = () => setStage(st.n); stageBar.appendChild(b); }
  function setStage(n) {
    stage = Math.min(STAGES.length - 1, Math.max(0, n));
    if (!planet) return;
    base?.dispose();
    // the landing scene owns the rocket in the lab; the base draws everything else
    base = createStoryBase(scene, { plan: planBase(planet, LAYOUT, stage), placer: { toWorld: (p) => new THREE.Vector3(...planet.frameToWorld(p)) }, metres: 1, kit: KIT, skip: ['sh02'] });
    for (const b of stageBar.children) b.classList.toggle('on', Number(b.dataset.stage) === stage);
    stageLine.textContent = `Stage ${stage}: ${STAGES[stage].name}. Digits 0-7 change the stage; play opens the game at this stage.`;
    landing?.setLanded(stage >= 1);
  }

  function frameCamera(pose) {
    const c = Math.cos(planet.clearing.yaw), s = Math.sin(planet.clearing.yaw);
    const rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
    const p = rot(pose.pos), l = rot(pose.look);
    camera.position.set(p[0], p[1] + planet.padFloor, p[2]); camera.fov = pose.fov; camera.updateProjectionMatrix();
    controls.target.set(l[0], l[1] + planet.padFloor, l[2]); camera.lookAt(controls.target);
  }
  function seek(time) {
    t = Math.max(0, Math.min(sequence.duration, time));
    const state = sequence.stateAt(t);
    landing?.apply(state, t);
    audioSync(state, playing);
    if (onRail) frameCamera(rail.poseAt(t));
  }
  function land() { onRail = true; playing = true; heard = null; seek(0); }
  function skip() { playing = false; onRail = true; seek(sequence.duration); onRail = false; controls.update(); }
  function reset() { playing = false; onRail = false; seek(sequence.duration); frameCamera(rail.poseAt(sequence.duration)); controls.update(); }
  function overview() { playing = false; onRail = false; seek(sequence.duration); frameCamera({ pos: [120, 210, 300], look: [0, 0, -40], fov: 40 }); controls.update(); }

  function build() {
    const t0 = performance.now();
    planet = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING);
    const built = performance.now() - t0;
    planetMesh = buildStoryPlanetMesh(planet, look, { wallMetres: STORY_RECIPE.wallMetres }); scene.add(planetMesh);
    landing = createStoryLanding(scene, { padFloor: planet.padFloor, yaw: planet.clearing.yaw });
    landing.ready.then(() => { seek(t); });
    marker = buildMouthMarker(planet, look); if (marker) scene.add(marker);
    setStage(stage);
    const c = planetMesh.userData.counts;
    status.textContent = `${c.cells.toLocaleString()} cells, radius ${planet.radius.toFixed(0)} m, built in ${(built / 1000).toFixed(1)} s. ${planet.clearing.mouths.length} lane mouths, one open and gate-sized. L to land.`;
    reset();
  }
  controls.addEventListener('start', () => { onRail = false; });
  // the same planet in the actual game, with sparse waves
  const playUrl = () => `index.html?world=story&threat=0.35&cine=0&heart=none&stage=${stage}#td`;
  const play = () => { location.href = playUrl(); };
  hud.querySelector('#story-land').onclick = land; hud.querySelector('#story-skip').onclick = skip; hud.querySelector('#story-reset').onclick = reset; hud.querySelector('#story-overview').onclick = overview; hud.querySelector('#story-gate').onclick = () => { gateForced = !gateForced; }; hud.querySelector('#story-play').onclick = play;
  function onKey(e) {
    if (e.target.closest?.('input,textarea,select')) return;
    if (e.key === 'l' || e.key === 'L') land(); else if (e.key === 'k' || e.key === 'K') skip(); else if (e.key === 'r' || e.key === 'R') reset(); else if (e.key === 'o' || e.key === 'O') overview(); else if (e.key === 'g' || e.key === 'G') gateForced = !gateForced; else if (e.key === 'p' || e.key === 'P') play(); else if (/^[0-7]$/.test(e.key)) setStage(Number(e.key));
  }
  addEventListener('keydown', onKey);
  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  function loop() {
    if (!active || disposed) return;
    frameId = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; clock.time += dt;
    if (playing) { seek(t + dt); if (t >= sequence.duration) { playing = false; onRail = false; audioSync(sequence.stateAt(t), false); } }
    landing?.tick(dt, camera); base?.tick(dt, null, gateForced);
    if (!onRail) controls.update();
    renderer.render(scene, camera);
  }
  const api = {
    setActive(on) { active = on; if (on) { resize(); last = performance.now(); loop(); } else cancelAnimationFrame(frameId); },
    dispose() {
      if (disposed) return; disposed = true; active = false; cancelAnimationFrame(frameId);
      removeEventListener('resize', resize); removeEventListener('keydown', onKey);
      thrust?.stop(0); sfx.dispose(); landing?.dispose(); base?.dispose(); planetMesh?.userData.dispose(); marker?.userData.dispose(); controls.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
  if (q.get('acceptance') === '1') window.__stalheartStoryTest = {
    state: () => ({ ready: !!planet && !!landing?.state().loaded, cells: planet?.dungeon.tags.length ?? 0, mouths: planet?.clearing.mouths.length ?? 0, openMouths: planet?.clearing.mouths.filter((m) => m.open).length ?? 0, gateMarker: !!marker, playUrl: playUrl(), stage, base: base ? { ...base.counts, errors: base.errors.slice(), children: base.group.children.length, gate: base.gate() } : null, counts: planetMesh?.userData.counts ?? null, t, phase: sequence.stateAt(t).phase, playing, landing: landing?.state() ?? null, cues: cueLog.slice(), audioState: sfx.contextState, errors }),
    land, skip, seek: (time) => { onRail = true; seek(time); }, reset, overview, setStage, gate: (on) => { gateForced = on; }, baseReady: () => base?.ready, dispose: api.dispose,
  };
  resize();
  setTimeout(build, 30);
  return api;
}
