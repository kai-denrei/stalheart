import { CONTENT } from './content/runtime.js';
import { clone } from './content/preset.js';
import { mountPresetPanel } from './labs/preset-panel.js';
import { BREACH_ENEMY_TYPES } from './breach-enemies.js';
// portal-tab.js — THE BREACH LAB (labs.html#portal). The ground breach every
// wave opens in the game: the shared sinkhole effect on a small planet or a
// flat reference, with the breach subject's working copy, review and apply.
// The portal-ring and wormhole benches that shared this tab retired with the
// portal gates (2026-09-14); the route keeps its name so existing links land.
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import GUI from '../vendor/lil-gui.esm.js';
import { makeBloom } from './postfx.js';
import { deepLink, wireDeepLink } from './deeplink.js';

export function initPortalTab(root) {
  let active = false;
  const container = root.querySelector('#portal-app');
  const hud = root.querySelector('#portal-hud');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070d);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 500);
  camera.layers.enable(1);   // the sinkhole's own layer
  const hemi = new THREE.HemisphereLight(0xc8cfe0, 0x555060, 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8c8, 2);
  sun.position.set(4, 7, 5); scene.add(sun);

  const postfx = makeBloom(renderer, scene, camera, {});
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const P = { bloom: true };
  const P0 = { ...P };
  { const q = new URLSearchParams(location.search); if (q.has('bloom')) P.bloom = q.get('bloom') !== '0'; }
  let flashT = 0, flashMsg = '';
  const flashNote = (m) => { flashMsg = m; flashT = 2.0; };

  const gui = new GUI({ container: root.querySelector('#portal-gui') || undefined, width: 268 });
  gui.title('Breach lab');
  let sinkhole = null, sinkholeLoading = null;
  let breachDraft = clone(CONTENT);
  const breachPanel = document.createElement('div'); root.append(breachPanel);
  const transfer = mountPresetPanel(breachPanel, {
    subject: () => ({ kind: 'breach', key: 'sinkhole' }),
    read: () => { const p = clone(breachDraft); if (sinkhole) for (const k of Object.keys(p.breach)) p.breach[k] = sinkhole.tune[k]; return p; },
    write: (p) => { breachDraft = p; if (sinkhole) { sinkhole.reset(); Object.assign(sinkhole.tune, p.breach); } syncBreachControls(); },
  });
  function frameBreach(view) {
    if (view === 'planet' && sinkhole?.tune.environment === 'planet') { const r = sinkhole.tune.planetRadius; camera.position.set(r * 1.7, r * 1.15, r * 2.15); controls.target.set(0, -r, 0); }
    else { camera.position.set(10, 11, 14); controls.target.set(0, 0, 0); }
    controls.update();
  }
  async function ready() {
    if (sinkhole) return sinkhole;
    sinkholeLoading ||= import('./sinkhole.js').then((m) => m.createSinkhole(scene, camera));
    try { sinkhole = await sinkholeLoading; } catch (error) { flashNote('Sinkhole failed: ' + error.message); return null; }
    sinkhole.group.visible = true;   // the effect updates only while its group is shown
    Object.assign(sinkhole.tune, breachDraft.breach); syncBreachControls(); frameBreach('planet');
    return sinkhole;
  }

  const ground = gui.addFolder('Sinkhole · ground breach');
  const breach = { look: 'tronColors', walls: true, wallHeight: 1.2, clearRadius: 6, crackLength: 2, crackWidth: 1.15, arms: 12, environment: 'planet', planetRadius: 14, spawnWaves: true, kind: 'mixed', waves: 3, count: 8, spacing: 0.45, gap: 3, delay: 2, emerge: 1.2, speed: 1.3, sound: true, open: () => sinkhole?.trigger(), reset: () => sinkhole?.reset(), preRoll: 1.6, radius: 1, heave: -0.12, cracks: 0.7, debris: 24 };
  function syncBreachControls() { if (!sinkhole) return; Object.assign(breach, sinkhole.tune, { radius: sinkhole.tune.craterRadius, heave: sinkhole.tune.plateHeave, crackWidth: sinkhole.tune.fissureWidth, arms: sinkhole.tune.fissureArms, debris: sinkhole.tune.shrapnelCount }); for (const c of ground.controllersRecursive()) c.updateDisplay(); }
  const note = document.createElement('div'); note.textContent = 'Shared game breach · wave fixtures remain preview only'; note.style.cssText = 'padding:6px 8px;color:#aaa'; ground.$children.prepend(note);
  ground.add(breach, 'open').name('rumble → breach').domElement.querySelector('button').dataset.sinkholeOpen = '';
  ground.add(breach, 'sound').name('quake sound').onChange((value) => { if (sinkhole) sinkhole.setSound(value); });
  ground.add(breach, 'reset').name('reset ground');
  for (const [key, field, min, max, step] of [['preRoll', 'preRoll', 0, 4, 0.1], ['radius', 'craterRadius', 1, 8, 0.1], ['heave', 'plateHeave', -0.8, 0, 0.01], ['crackWidth', 'fissureWidth', 0.1, 2, 0.05], ['crackLength', 'crackLength', 0.1, 10, 0.1], ['arms', 'fissureArms', 3, 18, 1], ['debris', 'shrapnelCount', 0, 100, 1]])
    ground.add(breach, key, min, max, step).name(key === 'preRoll' ? 'rumble lead-in (s)' : key).onChange((value) => { if (sinkhole) sinkhole.tune[field] = value; });
  const world = ground.addFolder('Environment');
  world.add(breach, 'look', { 'Textured': 'textured', 'TRON palette': 'tronColors', 'Battlezone': 'battlezone' }).name('rendering').onChange((value) => { if (sinkhole) sinkhole.tune.look = value; });
  const wallTest = ground.addFolder('Wall clearance');
  wallTest.add(breach, 'walls').name('show wall fixtures').onChange((value) => { if (sinkhole) sinkhole.tune.walls = value; });
  for (const [key, min, max, step] of [['wallHeight', 0.3, 3, 0.1], ['clearRadius', 1, 12, 0.25]]) wallTest.add(breach, key, min, max, step).onChange((value) => { if (sinkhole) sinkhole.tune[key] = value; });
  world.add(breach, 'environment', { Planet: 'planet', 'Flat reference': 'flat' }).onChange((value) => { if (sinkhole) { sinkhole.reset(); sinkhole.tune.environment = value; frameBreach(value === 'planet' ? 'planet' : 'breach'); } });
  world.add(breach, 'planetRadius', 10, 28, 1).name('planet radius (m)').onChange((value) => { if (sinkhole) { sinkhole.reset(); sinkhole.tune.planetRadius = value; frameBreach('planet'); } });
  world.add({ planet: () => frameBreach('planet') }, 'planet').name('view planet');
  world.add({ breach: () => frameBreach('breach') }, 'breach').name('view breach');
  const waves = ground.addFolder('Creature waves');
  waves.add(breach, 'spawnWaves').name('enable waves').onChange((value) => { if (sinkhole) sinkhole.tune.spawnWaves = value; });
  waves.add(breach, 'kind', Object.fromEntries(['mixed', ...BREACH_ENEMY_TYPES].map((k) => [k === 'mixed' ? 'Mixed creatures' : k, k]))).name('creatures').onChange((value) => { if (sinkhole) sinkhole.tune.kind = value; });
  for (const [key, label, min, max, step] of [['waves', 'waves', 1, 4, 1], ['count', 'creatures per wave', 1, 24, 1], ['spacing', 'spawn spacing (s)', 0.1, 2, 0.05], ['gap', 'between waves (s)', 0, 10, 0.5], ['delay', 'after opening (s)', 1.5, 8, 0.25], ['emerge', 'fade / grow (s)', 0.3, 3, 0.1], ['speed', 'travel speed (m/s)', 0.3, 3, 0.1]])
    waves.add(breach, key, min, max, step).name(label).onChange((value) => { if (sinkhole) sinkhole.tune[key] = value; });
  gui.add(P, 'bloom').name('bloom');
  P.copyPreset = () => breachPanel.querySelector('[data-preset-copy]')?.click();
  P.downloadPreset = () => breachPanel.querySelector('[data-preset-export]')?.click();
  gui.add(P, 'copyPreset').name('⧉ copy preset');
  gui.add(P, 'downloadPreset').name('⇩ save .json');
  ready();

  if (new URLSearchParams(location.search).get('acceptance') === '1') window.__stalheartPortalTest = {
    state: () => ({ genre: 'sinkhole', sinkhole: sinkhole?.state() }), ready, open: () => sinkhole?.trigger(), reset: () => sinkhole?.reset(),
    view: frameBreach, configure: (values) => { sinkhole.reset(); Object.assign(sinkhole.tune, values); }, dispose: () => { transfer.dispose(); sinkhole?.dispose(); },
  };

  wireDeepLink(root.querySelector('#portal-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'portal', params: { bloom: P.bloom }, defaults: { bloom: P0.bloom }, carry: location.search,
  }), { label: 'BREACH', flash: flashNote });

  function resize() {
    const w = container.clientWidth || 800, h = container.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    postfx.setSize(w, h);
  }
  addEventListener('resize', () => { if (active) resize(); });

  const clock = new THREE.Clock();
  function paintHud() {
    if (!hud) return;
    if (flashT > 0) { hud.innerHTML = `<b>${flashMsg}</b>`; return; }
    const state = sinkhole?.state();
    hud.textContent = state
      ? `SINKHOLE · ${state.ready ? state.phase : 'loading stone textures'} · ${state.holeRadius.toFixed(2)} m opening · wave ${state.enemies.wave} · ${state.enemies.live} creatures · ${renderer.info.render.calls} draws`
      : 'Loading sinkhole…';
  }
  function frame() {
    requestAnimationFrame(frame);
    if (!active) return;
    renderer.info.reset();
    const dt = Math.min(0.05, clock.getDelta());
    if (flashT > 0) flashT -= dt;
    controls.update();
    sinkhole?.update(dt);
    postfx.setEnabled(P.bloom);
    const cameraBase = camera.position.clone(), rotationBase = camera.quaternion.clone();
    if (sinkhole) { camera.position.add(sinkhole.rig.shakeOffset); camera.rotateZ(sinkhole.rig.shakeRoll); }
    postfx.render(); camera.position.copy(cameraBase); camera.quaternion.copy(rotationBase);
    paintHud();
  }
  renderer.info.autoReset = false;
  frame();

  return {
    setActive(on) {
      active = on;
      if (on) { resize(); clock.getDelta(); }
    },
  };
}
