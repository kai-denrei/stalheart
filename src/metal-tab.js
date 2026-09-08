import { DEFAULT_TANK } from './content/tank.js';
// metal-tab.js — THE METAL LAB. The weathered material (src/weathered.js,
// src/cine/materials.js) on the game's own big casts — the MÖRK, the
// container, Isao, the Terraformer, the portal ring — large, under the
// cinematics' light (the galaxy bake as environment, a sun, ACES), with
// every knob of the bake and the binding on a slider, and a COPY button
// that emits the preset as source. Operator, 2026-09-04: "sliders to
// arrange the look and feel on large models in a separate tab".
//
// A tuning surface must be a CLIENT of the thing it tunes: this tab calls
// the same bakeWeatheredMetal and applyWeatheredMaterial the cinematics
// call, on the same casts units.js makes, and changes nothing the game
// draws until a preset is pasted into weathered.js.
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import GUI from '../vendor/lil-gui.esm.js';
import { makeBloom } from './postfx.js';
import { bakeGalaxyCube } from './galaxybake.js';
import { SKY_PRESET } from './galaxyseed.js';
import { LOOKS } from './looks.js';
import { WEATHER_PRESETS, weatherStats, bakeWeatheredMetal } from './weathered.js';
import { WEATHER_BY_NAME, applyWeatheredMaterial, makeWeatheredTextures } from './cine/materials.js';
import { buildCreature, preloadMork, preloadContainer, makeContainerFixture, preloadTerraformer, makeTerraformerFixture,
  preloadPortalRing, makePortalRing, preloadFabricator, makeIsaoDrone } from './units.js';
import { deepLink, wireDeepLink } from './deeplink.js';

// the subjects: how each is cast and roughly how big it stands
const SUBJECTS = {
  tank: { label: 'MÖRK', preload: () => preloadMork(), make: (look) => buildCreature(DEFAULT_TANK, { walker: look.walker, walkerHi: look.walkerHi }) },
  container: { label: 'container', preload: preloadContainer, make: () => makeContainerFixture(3) },
  isao: { label: 'Isao', preload: preloadFabricator, make: () => makeIsaoDrone() },
  terraformer: { label: 'Terraformer', preload: preloadTerraformer, make: () => makeTerraformerFixture() },
  portal: { label: 'portal ring', preload: preloadPortalRing, make: () => makePortalRing(0xaee8ff) },
};

export function initMetalTab(root) {
  let active = false;
  const q = new URLSearchParams(location.search);
  const container = root.querySelector('#metal-app');
  const hud = root.querySelector('#metal-hud');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 200);
  // ?az=deg&el=deg&dist=N aims the lab from the URL (a still is the test)
  const az = (parseFloat(q.get('az')) || 37) * Math.PI / 180, el = (parseFloat(q.get('el')) || 19) * Math.PI / 180;
  const dist = parseFloat(q.get('dist')) || 5.6;
  camera.position.set(Math.sin(az) * Math.cos(el) * dist, 0.6 + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.target.set(0, 0.6, 0);

  // THE CINEMATICS' LIGHT: the galaxy bake as sky and environment, a key
  // that casts, a cool fill — what the gate and the tank scenes use
  const sky = bakeGalaxyCube(renderer, { ...SKY_PRESET, seed: 4414, face: 1024, galaxies: 2 });
  scene.background = sky.texture;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromCubemap(sky.texture).texture;
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(6, 9, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -6; sun.shadow.camera.right = sun.shadow.camera.top = 6;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8ab4ff, 0.7); fill.position.set(-6, 4, 5); scene.add(fill);
  // a rim from behind, so a side seen against the sky is not a black card
  const rim = new THREE.DirectionalLight(0x9fdcff, 0.9); rim.position.set(2, 3, -7); scene.add(rim);
  const hemi = new THREE.HemisphereLight(0xc9d4e6, 0x141216, 0.30); scene.add(hemi);
  // a floor that takes the shadow, so the cast stands on something
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const postfx = makeBloom(renderer, scene, camera, { scale: 1, strength: 0.32, radius: 0.5, threshold: 0.35 });

  // THE KNOBS — the bake's, the binding's, the scene's. Colours are hex
  // strings for lil-gui's colour picker; the copy converts them back.
  const g0 = WEATHER_PRESETS.gunmetal, s0 = WEATHER_PRESETS.steel, r0 = WEATHER_PRESETS.rubber;
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const P = {
    subject: SUBJECTS[q.get('unit')] ? q.get('unit') : 'tank',
    spin: true, weather: true, outline: 0.22, glow: 0.45,
    seed: 4414, size: 512,
    // gunmetal (armour / turret / detail)
    gBase: hex(g0.baseHex), gPatina: hex(g0.patinaHex), gPatinaLo: g0.patinaEdge[0], gPatinaHi: g0.patinaEdge[1], gPatinaBias: g0.patinaBias,
    gMetalLo: g0.metalness[0], gMetalHi: g0.metalness[1], gRoughLo: g0.roughness[0], gRoughHi: g0.roughness[1],
    gScratch: g0.scratch, gPit: g0.pit, gNormal: g0.normalStrength,
    // steel (steel / track)
    sBase: hex(s0.baseHex), sPatina: hex(s0.patinaHex), sPatinaBias: s0.patinaBias, sMetalLo: s0.metalness[0], sMetalHi: s0.metalness[1],
    sRoughLo: s0.roughness[0], sRoughHi: s0.roughness[1], sScratch: s0.scratch, sPit: s0.pit,
    // rubber
    rBase: hex(r0.baseHex), rRoughLo: r0.roughness[0], rRoughHi: r0.roughness[1],
    // the binding
    // judged from the side (2026-09-04): repeat 1 / normal 0.6 read as a
    // paper-thin panel on the container; 2 / 1.0 shows the plate
    repeat: 2.0, normalScale: 1.0,
    tArmour: WEATHER_BY_NAME.M_Armour.tint, tTurret: WEATHER_BY_NAME.M_Turret.tint, tDetail: WEATHER_BY_NAME.M_Detail.tint,
    tSteel: WEATHER_BY_NAME.M_Steel.tint, tTrack: WEATHER_BY_NAME.M_Track.tint, tRubber: WEATHER_BY_NAME.M_Rubber.tint,
    // the scene — the light the operator judged the grey under (their
    // phone, 2026-09-04): a metal takes its brightness from its environment
    exposure: 1.2, env: 0.5, sunI: 3.75, bloom: 0.15,
  };
  const toHex = (s) => parseInt(String(s).replace('#', ''), 16);
  // URL overrides for any knob (?repeat=3&gNormal=1.2&gBase=%23555c63 …): a
  // headless still can test a setting the sliders would need a hand for
  // the defaults, before the URL touches them — the deep link writes only
  // what DIFFERS from these, so a shared address is the session and not the
  // whole panel
  const P0 = { ...P };
  for (const [k, v] of q.entries()) {
    if (!(k in P) || k === 'subject') continue;
    if (typeof P[k] === 'number') { const n = parseFloat(v); if (Number.isFinite(n)) P[k] = n; }
    else if (typeof P[k] === 'boolean') P[k] = v !== '0';
    else if (typeof P[k] === 'string') P[k] = v.startsWith('#') ? v : '#' + v;
  }

  // the knobs as the baker wants them: three presets and the name map
  function presets() {
    return {
      gunmetal: { baseHex: toHex(P.gBase), patinaHex: toHex(P.gPatina), metalness: [P.gMetalLo, P.gMetalHi], roughness: [P.gRoughLo, P.gRoughHi],
        patinaEdge: [P.gPatinaLo, P.gPatinaHi], patinaBias: P.gPatinaBias, scratch: P.gScratch, pit: P.gPit, normalStrength: P.gNormal },
      steel: { baseHex: toHex(P.sBase), patinaHex: toHex(P.sPatina), metalness: [P.sMetalLo, P.sMetalHi], roughness: [P.sRoughLo, P.sRoughHi],
        patinaEdge: [P.gPatinaLo, P.gPatinaHi], patinaBias: P.sPatinaBias, scratch: P.sScratch, pit: P.sPit, normalStrength: P.gNormal },
      rubber: { baseHex: toHex(P.rBase), patinaHex: r0.patinaHex, metalness: r0.metalness, roughness: [P.rRoughLo, P.rRoughHi],
        patinaEdge: r0.patinaEdge, patinaBias: r0.patinaBias, scratch: r0.scratch, pit: r0.pit, normalStrength: r0.normalStrength },
    };
  }
  function byName() {
    const pr = presets();
    // the knobs ride along as overrides so the cache keys differ per change
    const spec = (preset, tint) => ({ preset, tint, ...pr[preset] });
    return {
      M_Armour: spec('gunmetal', P.tArmour), M_Turret: spec('gunmetal', P.tTurret), M_Detail: spec('gunmetal', P.tDetail),
      M_Steel: spec('steel', P.tSteel), M_Track: spec('steel', P.tTrack), M_Rubber: spec('rubber', P.tRubber),
    };
  }

  // THE CAST, large: normalised so its longest side is ~2.6 units and it
  // stands on the floor — the same object the game draws, at lab scale
  const stage = new THREE.Group(); scene.add(stage);
  let cast = null, castName = '';
  const box = new THREE.Box3(), size = new THREE.Vector3(), centre = new THREE.Vector3();
  async function buildCast() {
    const sub = SUBJECTS[P.subject];
    if (!sub) return;
    if (cast) { stage.remove(cast); cast = null; }
    await sub.preload();
    const obj = sub.make(LOOKS.tronColors);
    if (!obj) { hud.textContent = `${sub.label}: no cast`; return; }
    obj.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      // remember which line sets the cast SHOWS: the outline slider may
      // only touch those. A hidden set (a callout, a bound) un-hidden by
      // the slider drew a red box with a diagonal across the container.
      if (o.isLineSegments) o.userData.labOutline = o.visible;
    });
    obj.updateMatrixWorld(true);
    box.setFromObject(obj); box.getSize(size); box.getCenter(centre);
    const k = 2.6 / Math.max(size.x, size.y, size.z, 1e-6);
    obj.scale.multiplyScalar(k);
    obj.position.set(-centre.x * k, -box.min.y * k, -centre.z * k);
    stage.add(obj);
    cast = obj; castName = sub.label;
    dress();
  }

  // dress: the bake at the current knobs, applied by name; a change rebakes
  // (debounced — a slider drag is many changes) and the HUD reports what
  // the bake contains, the way the test does
  let dressTimer = 0, dressing = false;
  function dress() {
    clearTimeout(dressTimer);
    dressTimer = setTimeout(dressNow, 220);
  }
  function dressNow() {
    if (!cast || dressing) return;
    dressing = true;
    const t0 = performance.now();
    let n = 0;
    if (P.weather) {
      n = applyWeatheredMaterial(cast, { seed: P.seed, size: P.size, repeat: P.repeat, normalScale: P.normalScale, byName: byName() });
    }
    // the outlines as a rim, the glow parts as the CRT cyan — the tank
    // scene's choices, on sliders here
    cast.traverse((o) => {
      // the outline pass only — never the model's own callout lines, which
      // are authored red and shipped hidden: un-hiding them drew a red box
      // with a diagonal across the container's face
      if (o.isLineSegments && o.material && o.userData.labOutline) { o.material.opacity = P.outline; o.material.transparent = true; o.visible = P.outline > 0; }
      if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m && /^M_Glow/.test(m.name || '') && m.emissive) { m.emissive.setHex(0x7df9ff); m.emissiveIntensity = P.glow; m.color.setHex(0x101418); }
      }
    });
    const st = weatherStats(bakeWeatheredMetal({ seed: P.seed, size: 64, preset: 'gunmetal', ...presets().gunmetal }));
    hud.textContent = `${castName} · ${n} materials dressed · ${P.size}px · ${(performance.now() - t0).toFixed(0)} ms`
      + ` · gunmetal: metal ${st.metalMin}..${st.metalMax} rough ${st.roughMin}..${st.roughMax} oxide ${(st.coverage * 100).toFixed(0)}%`;
    dressing = false;
  }
  function applyScene() {
    renderer.toneMappingExposure = P.exposure;
    scene.environmentIntensity = P.env;
    sun.intensity = P.sunI;
    postfx.setParams({ strength: P.bloom });
  }

  // THE GUI — on a phone it is a bottom sheet with big rows (styles.css,
  // the coarse/narrow block) and the gear button shows or hides it: the
  // panel at desktop size was "impossible to tweak" on the device
  const gui = new GUI({ title: 'METAL', container: root });
  const gear = root.querySelector('#metal-gear');
  if (gear) gear.addEventListener('click', () => { root.classList.toggle('panel-hidden'); });
  // ?layout=1 — where the panel actually is (a phone layout is only
  // trustworthy as rectangles, never as a screenshot's impression)
  if (q.get('layout') === '1') setTimeout(() => {
    const r = gui.domElement.getBoundingClientRect(), cs = getComputedStyle(gui.domElement);
    console.log(`METAL layout: gui ${Math.round(r.left)}..${Math.round(r.right)} x ${Math.round(r.top)}..${Math.round(r.bottom)} pos=${cs.position} display=${cs.display} vis=${cs.visibility} inner=${innerWidth}x${innerHeight} class=${gui.domElement.className}`);
  }, 2500);
  gui.add(P, 'subject', Object.keys(SUBJECTS)).onChange(buildCast);
  gui.add(P, 'spin');
  gui.add(P, 'weather').name('weathered').onChange(() => { buildCast(); });
  gui.add(P, 'seed', 1, 99999, 1).onChange(dress);
  gui.add(P, 'size', [256, 512, 1024]).onChange(dress);
  const gg = gui.addFolder('gunmetal · armour / turret / detail');
  gg.addColor(P, 'gBase').name('base').onChange(dress);
  gg.addColor(P, 'gPatina').name('patina').onChange(dress);
  gg.add(P, 'gPatinaLo', 0.3, 0.9, 0.01).name('oxide edge lo').onChange(dress);
  gg.add(P, 'gPatinaHi', 0.3, 0.99, 0.01).name('oxide edge hi').onChange(dress);
  gg.add(P, 'gPatinaBias', -0.4, 0.4, 0.01).name('oxide bias').onChange(dress);
  gg.add(P, 'gMetalLo', 0, 1, 0.01).name('metal in oxide').onChange(dress);
  gg.add(P, 'gMetalHi', 0, 1, 0.01).name('metal on plate').onChange(dress);
  gg.add(P, 'gRoughLo', 0, 1, 0.01).name('rough protected').onChange(dress);
  gg.add(P, 'gRoughHi', 0, 1, 0.01).name('rough exposed').onChange(dress);
  gg.add(P, 'gScratch', 0, 2.5, 0.05).name('scratches').onChange(dress);
  gg.add(P, 'gPit', 0, 2.5, 0.05).name('pits').onChange(dress);
  gg.add(P, 'gNormal', 0, 2.5, 0.05).name('normal strength').onChange(dress);
  gg.open();
  const gs = gui.addFolder('steel · steel / track');
  gs.addColor(P, 'sBase').name('base').onChange(dress);
  gs.addColor(P, 'sPatina').name('patina').onChange(dress);
  gs.add(P, 'sPatinaBias', -0.4, 0.4, 0.01).name('oxide bias').onChange(dress);
  gs.add(P, 'sMetalLo', 0, 1, 0.01).name('metal in oxide').onChange(dress);
  gs.add(P, 'sMetalHi', 0, 1, 0.01).name('metal on plate').onChange(dress);
  gs.add(P, 'sRoughLo', 0, 1, 0.01).name('rough protected').onChange(dress);
  gs.add(P, 'sRoughHi', 0, 1, 0.01).name('rough exposed').onChange(dress);
  gs.add(P, 'sScratch', 0, 2.5, 0.05).name('scratches').onChange(dress);
  gs.add(P, 'sPit', 0, 2.5, 0.05).name('pits').onChange(dress);
  const gr = gui.addFolder('rubber');
  gr.addColor(P, 'rBase').name('base').onChange(dress);
  gr.add(P, 'rRoughLo', 0, 1, 0.01).name('rough lo').onChange(dress);
  gr.add(P, 'rRoughHi', 0, 1, 0.01).name('rough hi').onChange(dress);
  const gb = gui.addFolder('binding · repeat, normal, the ladder');
  gb.add(P, 'repeat', 0.1, 6, 0.05).onChange(dress);
  gb.add(P, 'normalScale', 0, 2, 0.05).onChange(dress);
  for (const [k, n] of [['tArmour', 'armour'], ['tTurret', 'turret'], ['tDetail', 'detail'], ['tSteel', 'steel'], ['tTrack', 'track'], ['tRubber', 'rubber']]) {
    gb.add(P, k, 0.2, 1.4, 0.01).name(`tint ${n}`).onChange(dress);
  }
  gb.add(P, 'outline', 0, 1, 0.01).name('outline rim').onChange(dress);
  gb.add(P, 'glow', 0, 1.6, 0.01).name('glow parts').onChange(dress);
  gb.open();
  const gw = gui.addFolder('light');
  gw.add(P, 'exposure', 0.2, 2.5, 0.01).onChange(applyScene);
  gw.add(P, 'env', 0, 1.5, 0.01).name('sky as light').onChange(applyScene);
  gw.add(P, 'sunI', 0, 6, 0.05).name('sun').onChange(applyScene);
  gw.add(P, 'bloom', 0, 1.5, 0.01).onChange(applyScene);

  // COPY: the preset as source, pasteable into weathered.js / materials.js.
  // Console fallback: the clipboard can refuse on an unfocused document.
  function presetSource() {
    const pr = presets();
    const fmt = (o) => JSON.stringify(o, (k, v) => (typeof v === 'number' && k.endsWith('Hex') ? `0x${v.toString(16).padStart(6, '0')}` : v), 2)
      .replace(/"(0x[0-9a-f]+)"/g, '$1').replace(/"([a-zA-Z]+)":/g, '$1:');
    return `// METAL LAB preset — ${new Date().toISOString().slice(0, 10)} — seed ${P.seed}, ${P.size}px, repeat ${P.repeat}, normal ${P.normalScale}\n`
      + `WEATHER_PRESETS.gunmetal = ${fmt(pr.gunmetal)};\nWEATHER_PRESETS.steel = ${fmt(pr.steel)};\nWEATHER_PRESETS.rubber = ${fmt(pr.rubber)};\n`
      + `// tints: armour ${P.tArmour} turret ${P.tTurret} detail ${P.tDetail} steel ${P.tSteel} track ${P.tTrack} rubber ${P.tRubber}\n`
      + `// outline ${P.outline}, glow ${P.glow}, exposure ${P.exposure}, env ${P.env}, sun ${P.sunI}, bloom ${P.bloom}\n`;
  }
  // THE DEEP LINK, beside the preset copy: the preset is for the code, the
  // link is for a person. `subject` is named `unit` in the URL (the parse
  // above reads it separately), so it is emitted under that name or the link
  // would not round-trip the model it was tuned on.
  wireDeepLink(root.querySelector('#metal-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'metal',
    params: { ...P, subject: undefined, unit: P.subject },
    defaults: { ...P0, subject: undefined, unit: 'tank' },
    carry: location.search,
  }), { label: 'METAL', flash: (m) => flash(m) });

  const copyBtn = root.querySelector('#metal-copy');
  let flashT = 0;
  const flash = (msg) => { hud.textContent = msg; flashT = performance.now() + 2500; };
  // the preset is also SHOWN, selectable, because on a phone the clipboard
  // may refuse and the button itself sat under the status bar (operator,
  // 2026-09-04: "I cannot copy paste the value")
  const srcEl = root.querySelector('#metal-src');
  if (srcEl) srcEl.addEventListener('click', () => srcEl.classList.add('hidden'));
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const src = presetSource();
    if (srcEl) { srcEl.textContent = src + '\n[ tap to close ]'; srcEl.classList.remove('hidden'); }
    const ok = () => { flash('preset copied to clipboard'); console.log('METALLAB preset:\n' + src); };
    (navigator.clipboard ? navigator.clipboard.writeText(src) : Promise.reject(new Error('no clipboard')))
      .then(ok, (e) => { console.log(`METALLAB preset (clipboard ${e && e.message}):\n` + src); flash('preset shown (clipboard refused)'); });
  });

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    postfx.setSize(w, h);
  }
  addEventListener('resize', resize);

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    if (!active) return;
    const dt = Math.min(0.05, clock.getDelta());
    if (cast && P.spin) stage.rotation.y += dt * 0.25;
    controls.update();
    postfx.render();
    if (flashT && performance.now() > flashT) { flashT = 0; dressNow(); }
  }
  animate();
  applyScene();
  buildCast();

  return {
    setActive(on) { active = on; if (on) { resize(); clock.getDelta(); } },
  };
}
