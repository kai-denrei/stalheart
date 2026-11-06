// Story lab: the 753 m story planet, its polar clearing and terraces, the
// tiled pad and the SH02 arrival. Metres; pole at the origin.
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { LOOKS } from '../looks.js';
import { STORY_RECIPE, STORY_CLEARING, LANDING_DEFAULTS, STORY_SOUNDS, STORY_DAY, STORY_ARRIVAL_MANUAL } from '../content/story-defaults.js';
import { LANDING_GAME } from '../content/landing-game.js';
import { seedEntry } from '../domain/manual-landing.js';
import { createManualLanding } from '../fx/manual-landing.js';
import { createLandingHud } from '../fx/landing-hud.js';
import { createDaylight } from '../fx/daylight.js';
import { SOUNDS } from '../audiomanifest.js';
import { makeAudio } from '../audio.js';
import { buildStoryPlanet } from '../domain/story-planet.js';
import { planetBake } from '../platform/planet-bake.js';
import { makeLandingSequence } from '../domain/landing-sequence.js';
import { compileRail } from '../core/rail.js';
import { buildStoryPlanetMesh, buildMouthMarker } from './story-planet-mesh.js';
import { createStoryLanding } from './story-landing.js';
import { planBase } from '../domain/base-plan.js';
import { ISLANDS, STRUCTURES, KIT, STAGES, withLandmarkTiers, landmarkTierMode, withBaseLayout, baseLayoutMode } from '../content/base-layout.js';
import { createStoryBase } from '../fx/story-base.js';

// camera rail in pad metres: orbit, descent chase, touchdown, the door, Isao
const RAIL = [
  { t: 0, pos: [0, 1500, 900], look: [0, 0, 0], fov: 40 },
  { t: 4, pos: [180, 140, 260], look: [0, 150, 0], fov: 40 },
  { t: 9, pos: [90, 50, 140], look: [0, 40, 0] },
  { t: 12, pos: [70, 26, 110], look: [0, 16, 0] },
  { t: 16, pos: [14, 41, 17], look: [0.5, 36.5, 0], fov: 40 },   // medium-close on the nose, held: the door opens, Isao comes out, angry then happy, no zoom
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
  // the lab's rig starts on the look's night values and the cycle blends it toward the day set, the same way the game does
  const hemi = new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]); scene.add(hemi);
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]); sun.position.set(120, 260, 90); scene.add(sun);
  const fill = new THREE.DirectionalLight(look.sun[0], 0.5); fill.position.set(-200, 120, -160); scene.add(fill);
  const daylight = createDaylight({ hemi, sun, bg: scene.background, day: STORY_DAY.day, tune: STORY_DAY, phase: 0.15 });   // the arrival lands mid-morning

  let active = false, disposed = false, frameId = 0, planet = null, planetMesh = null, marker = null, landing = null, errors = [];
  // the thrust bed loops under the descent and cuts at touchdown; the tank's
  // pneumatics stand in for the legs, the landing and the door
  // THE LANDING FLOWN (2026-11-07, ?manual=1): the arrival's longer approach (STORY_ARRIVAL_MANUAL), and the host's alarm, ping and wreck
  const manualMode = q.get('manual') === '1';
  const flightSounds = manualMode ? { danger_alert: SOUNDS.danger_alert, laser_click: SOUNDS.laser_click, mech_landing_impact: SOUNDS.mech_landing_impact } : {};
  const sfx = makeAudio({ seed: 3, persist: false, sounds: { ...STORY_SOUNDS, tank_spool_up: SOUNDS.tank_spool_up, tank_spool_down: SOUNDS.tank_spool_down, ...flightSounds } });
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
  const sequence = makeLandingSequence(manualMode ? STORY_ARRIVAL_MANUAL.landing : LANDING_DEFAULTS);
  const rail = compileRail(RAIL);
  let t = sequence.duration, playing = false, onRail = false, last = performance.now();
  const clock = { time: 0 };

  hud.innerHTML = '<div class="story-lines"><b>STORY PLANET</b><span id="story-status">generating 16,000-point planet...</span><span id="story-stage"></span></div>'
    + '<div class="story-keys"><a class="story-back" href="index.html?story=4#td">back to the game</a><button id="story-land" type="button">L land</button><button id="story-skip" type="button">K skip</button><button id="story-reset" type="button">R reset</button><button id="story-overview" type="button">O overview</button><button id="story-gate" type="button">G gate</button><button id="story-play" type="button">P play here</button><span>drag to orbit, wheel to zoom</span></div>'
    + '<div class="story-keys" id="story-stages"></div>';
  const status = hud.querySelector('#story-status'), stageLine = hud.querySelector('#story-stage'), stageBar = hud.querySelector('#story-stages');
  // Isao's comms as he comes out: the line the face is saying
  const commsEl = document.createElement('div'); commsEl.id = 'story-comms'; commsEl.hidden = true; hud.prepend(commsEl);
  const COMMS = { angry: ['#ff6a6a', 'Rough landing!'], glee: ['#7dff9e', 'So much to build!'] };
  function comms(face) { const c = COMMS[face]; commsEl.hidden = !c; if (c) { commsEl.style.color = c[0]; commsEl.style.borderColor = c[0]; commsEl.textContent = `ISAO · ${c[1]}`; } }
  // the same switch and the same mapping the game world uses, so a candidate reviewed here is the file the game would load
  // and ?base=dome the dome city (round 8 note 6), through the same one mapping the game world calls
  const BASE = withBaseLayout(ISLANDS, STRUCTURES, baseLayoutMode(location.search));
  const LAYOUT = { islands: BASE.islands, structures: withLandmarkTiers(BASE.structures, landmarkTierMode(location.search)), kit: KIT, stages: STAGES };
  let stage = Math.min(STAGES.length - 1, Math.max(0, parseInt(q.get('stage') || '', 10) || 1)), base = null, gateForced = false;
  for (const st of STAGES) { const b = document.createElement('button'); b.type = 'button'; b.textContent = `${st.n} ${st.name}`; b.dataset.stage = st.n; b.onclick = () => setStage(st.n); stageBar.appendChild(b); }
  function setStage(n) {
    stage = Math.min(STAGES.length - 1, Math.max(0, n));
    if (!planet) return;
    base?.dispose();
    // the landing scene owns the rocket in the lab; the base draws everything else
    base = createStoryBase(scene, { plan: planBase(planet, LAYOUT, stage), placer: { toWorld: (p) => new THREE.Vector3(...planet.frameToWorld(p)) }, metres: 1, kit: KIT, skip: ['sh02'], sfx });
    for (const b of stageBar.children) b.classList.toggle('on', Number(b.dataset.stage) === stage);
    stageLine.textContent = `Stage ${stage}: ${STAGES[stage].name}. Digits 0-8 change the stage; play opens the game at this stage.`;
    landing?.setLanded(stage === 1);   // the cinematic's intact rocket stands only at the landing; from stage 2 the base draws it cut into the salvage layout beside the foundry
  }

  function frameCamera(pose, about = null) {
    // rail keys are metres around the landing site (or the pole for the overview): x/z along the surface,
    // y along the local vertical there, so a key at the rim's height is at the rim wherever the site sits
    const site = about ?? ISLANDS.find((i) => i.id === 'landing');
    const rot = ([x, y, z]) => planet.frameToWorld([site.x + x, y, site.z + z]);
    const p = rot(pose.pos), l = rot(pose.look);
    camera.position.set(p[0], p[1], p[2]); camera.fov = pose.fov; camera.updateProjectionMatrix();
    controls.target.set(l[0], l[1], l[2]); camera.lookAt(controls.target);
  }
  // THE LANDING FLOWN (2026-11-07, ?manual=1): from L, at LANDING_GAME.approach.overrideAt the lab's own host (src/fx/manual-landing.js)
  // takes the rocket, seeded from the entry as the game's (?seed=, 'lab' by default), and the sequence's clock stands still until the
  // ground; on the contact the sequence resumes at its touchdown with the rocket left where it touched (the game's placedLanded), so
  // the owner judges the spot the game would show. The camera is the lab's OrbitControls, framed once on the corridor at the override;
  // the chase and the glare are the game's. `armed` from L to the override, `flight` the host while it flies, `flown` its last state
  // (the verdict once touched), `lhud` the instruments, kept with the verdict until R, L or K
  let armed = false, flight = null, flown = null, lhud = null, overrideT = 0, statusText = '';
  // the bare sphere under the island's tangent plane, as the arrival's floorAt (src/fx/arrival.js), R the planet's radius in metres
  const floorAt = (x, z) => { const R = planet.radius, l = Math.hypot(x / R, 1, z / R); return { y: -(x * x + z * z) / (2 * R), normal: [x / R / l, 1 / l, z / R / l] }; };
  const fixed = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-');
  function flightLine(st) {
    const nums = `sink ${fixed(st.sink)} m/s, drift ${fixed(st.drift)} m/s, tilt ${fixed(st.tilt * 180 / Math.PI)} deg, fuel ${fixed(st.fuel)} s`;
    return st.grade ? `LANDING · ${st.grade} (${st.reason}): ${nums}, at x ${fixed(st.x)} z ${fixed(st.z)} m. R resets, L flies again.`
      : `${st.phase.toUpperCase()} · alt ${fixed(st.altitude)} m, ${nums}, throttle ${fixed(st.throttle, 2)}, legs ${fixed(st.legs, 2)}, x ${fixed(st.x)} z ${fixed(st.z)}. W/S throttle, A/D tilt, L legs.`;
  }
  function startFlight() {
    armed = false; audioSync(null, false);   // the host's own thrust bed takes over
    landing.flying(true);
    lhud = createLandingHud(document.body);
    // the host's frame is the holder's parent's: the lift hangs under the island's basis, so island metres go in as they are (the
    // game's holder hangs in the world, whose toWorld is the site's matrix); the reticle is laid in that same frame
    flight = createManualLanding({ game: LANDING_GAME, entry: seedEntry(q.get('seed') ?? 'lab', LANDING_GAME), rocket: { holder: landing.holder() }, plumes: landing.plumes(), camera, sfx, hud: lhud,
      toWorld: (p, out) => out.set(p[0], p[1], p[2]), up: new THREE.Vector3(0, 1, 0), floorAt, root: landing.frame(), clipScrub: landing.scrub });
    flight.begin(0); overrideT = 0; flown = flight.state();
    // high over the corridor from +x and behind the pad (measured in the headless lab, 2026-11-07): the rocket at the entry's 350 m in the
    // upper frame, the pad and the reticle on it in the lower; side-on from 200 m up the clearing's rim hid the pad
    onRail = false; frameCamera({ pos: [300, 520, -120], look: [0, 120, 30], fov: 50 }); controls.update();
  }
  function flightTick(dt) {
    overrideT += dt; if (flight.phase() === 'override' && overrideT >= LANDING_GAME.override.seconds) flight.manual();
    const ph = flight.tick(dt); flown = flight.state(); status.textContent = flightLine(flown);
    if (ph !== 'touched') return;
    const p = flight.pose(), g = floorAt(p.x, p.z);
    if (flight.contact().reason !== 'skipped') landing.place([p.x, g.y, p.z], g.normal);
    flight.dispose(); flight = null; landing.flying(false);
    heard = { legs: true, down: false, door: false };   // the legs are down: the shock's pneumatics next, no second legs cue
    seek(sequence.touchdown);
  }
  function endFlight() {   // R, L, K, O, a seek: the host and its panel go, the rocket back on the pad
    armed = false; flight?.dispose(); flight = null; lhud?.dispose(); lhud = null; flown = null;
    if (landing) { landing.flying(false); landing.place(null); }
    if (statusText) status.textContent = statusText;
  }
  function seek(time) {
    t = Math.max(0, Math.min(sequence.duration, time));
    const state = sequence.stateAt(t);
    if (manualMode && !flown && t < sequence.touchdown) state.clips.Legs_Deploy = null;   // the flown approach keeps the legs stowed: they are the player's (the arrival's apply)
    landing?.apply(state, t);
    audioSync(state, playing);
    if (onRail) frameCamera(rail.poseAt(t));
  }
  function land() { endFlight(); onRail = true; playing = true; heard = null; seek(0); armed = manualMode; }
  function skip() { endFlight(); playing = false; onRail = true; seek(sequence.duration); onRail = false; controls.update(); }
  function reset() { endFlight(); playing = false; onRail = false; seek(sequence.duration); frameCamera(rail.poseAt(sequence.duration)); controls.update(); }
  function overview() { endFlight(); playing = false; onRail = false; seek(sequence.duration); frameCamera({ pos: [120, 210, 300], look: [0, 0, -40], fov: 40 }, { x: 0, z: 0 }); controls.update(); }

  function build() {
    if (disposed) return;   // the lab closed inside the 30 ms before its deferred build (2026-09-25): build nothing into a disposed scene
    const t0 = performance.now();
    planet = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, planetBake());
    const built = performance.now() - t0;
    planetMesh = buildStoryPlanetMesh(planet, look, { wallMetres: STORY_RECIPE.wallMetres }); scene.add(planetMesh);
    const site = ISLANDS.find((i) => i.id === 'landing');
    landing = createStoryLanding(scene, { placer: { toWorld: (p) => new THREE.Vector3(...planet.frameToWorld(p)) }, site: [site.x, site.z], onFace: comms });
    landing.ready.then(() => { if (disposed) return; seek(t); if (q.get('land') === '1') land(); });   // ?land=1 opens on the cinematic
    marker = buildMouthMarker(planet, look); if (marker) scene.add(marker);
    setStage(stage);
    const c = planetMesh.userData.counts;
    status.textContent = statusText = `${c.cells.toLocaleString()} cells, radius ${planet.radius.toFixed(0)} m, built in ${(built / 1000).toFixed(1)} s. ${planet.clearing.mouths.length} lane mouths, one open and gate-sized. L to ${manualMode ? 'fly the landing' : 'land'}.`;
    reset();
  }
  controls.addEventListener('start', () => { onRail = false; });
  // the same planet in the actual game, with sparse waves
  const playUrl = () => `index.html?story=${stage}#td`;
  const play = () => { location.href = playUrl(); };
  hud.querySelector('#story-land').onclick = land; hud.querySelector('#story-skip').onclick = skip; hud.querySelector('#story-reset').onclick = reset; hud.querySelector('#story-overview').onclick = overview; hud.querySelector('#story-gate').onclick = () => { gateForced = !gateForced; }; hud.querySelector('#story-play').onclick = play;
  function onKey(e) {
    if (e.target.closest?.('input,textarea,select')) return;
    if (e.key === 'l' || e.key === 'L') land(); else if (e.key === 'k' || e.key === 'K') skip(); else if (e.key === 'r' || e.key === 'R') reset(); else if (e.key === 'o' || e.key === 'O') overview(); else if (e.key === 'g' || e.key === 'G') gateForced = !gateForced; else if (e.key === 'p' || e.key === 'P') play(); else if (/^[0-8]$/.test(e.key)) setStage(Number(e.key));
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
    if (flight) flightTick(dt);   // the flight holds the sequence's clock
    else if (playing) { seek(t + dt); if (armed && t >= LANDING_GAME.approach.overrideAt) startFlight(); else if (t >= sequence.duration) { playing = false; onRail = false; audioSync(sequence.stateAt(t), false); } }
    landing?.tick(dt, camera); base?.tick(dt, null, gateForced, camera.position); daylight.tick(dt);
    if (!onRail) controls.update();
    renderer.render(scene, camera);
  }
  const api = {
    setActive(on) { active = on; if (on) { resize(); last = performance.now(); loop(); } else cancelAnimationFrame(frameId); },
    dispose() {
      if (disposed) return; disposed = true; active = false; cancelAnimationFrame(frameId);
      removeEventListener('resize', resize); removeEventListener('keydown', onKey);
      endFlight(); thrust?.stop(0); sfx.dispose(); landing?.dispose(); base?.dispose(); planetMesh?.userData.dispose(); marker?.userData.dispose(); controls.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
  if (q.get('acceptance') === '1') window.__stalheartStoryTest = {
    state: () => ({ ready: !!planet && !!landing?.state().loaded, cells: planet?.dungeon.tags.length ?? 0, mouths: planet?.clearing.mouths.length ?? 0, openMouths: planet?.clearing.mouths.filter((m) => m.open).length ?? 0, gateMarker: !!marker, playUrl: playUrl(), stage, comms: commsEl.hidden ? null : commsEl.textContent, base: base ? { ...base.counts, errors: base.errors.slice(), children: base.group.children.length, gate: base.gate(), lod: base.lod() } : null, counts: planetMesh?.userData.counts ?? null, t, phase: sequence.stateAt(t).phase, playing, landing: landing?.state() ?? null, cues: cueLog.slice(), audioState: sfx.contextState, errors, manual: flown }),
    land, skip, seek: (time) => { endFlight(); onRail = true; seek(time); }, reset, overview, setStage, gate: (on) => { gateForced = on; }, baseReady: () => base?.ready, dispose: api.dispose,
    frame: (pose, about) => { playing = false; onRail = false; frameCamera(pose, about); controls.update(); },   // a free framing for screenshots: metres around `about` (an island, or {x,z})
    daylight: () => daylight.state(), setDay: (phase) => daylight.set(phase),
  };
  resize();
  setTimeout(build, 30);
  return api;
}
