// portal-tab.js — TEMPORARY. A sidequest bench, not a game tab.
//
// Two questions, and this tab exists to answer the second one:
//
//   1. Does XorDev's Coronal sit inside the authored portal ring and read as a
//      wormhole? (An eye question. Look at it.)
//   2. What does it COST — cinematic only, sometimes, or always? (A number
//      question, and the whole reason this is an instrument and not a viewer.)
//
// THE ARCHITECTURE IS THE ANSWER TO 2. The corona is a fullscreen raymarch:
// uSteps x uTurbOctaves sine-heavy iterations PER PIXEL, 240 at defaults, pure
// ALU that does not batch. Run it as a fullscreen pass behind a gate and it
// costs the whole frame. Run it the way this tab does — once, into a small
// render target, shared by every gate on the board — and the cost is FIXED:
// it depends on the target's size and the march parameters, and NOT on how
// many portals are on screen, how big they are, or the display's resolution.
//
// That is the finding the decision hangs on, so the tab makes it falsifiable:
// spawn N rings and watch the corona cost stay flat while the geometry cost
// climbs.
//
// Ported per ~/Dev/procedural3dvisuals/docs/PORTING.md, which has a section
// for exactly this case. Its two warnings are honoured below and marked.
import * as THREE from '../vendor/three.module.js';
import { installCine } from './cine/kit.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import GUI from '../vendor/lil-gui.esm.js';
import { CORONA_FRAG } from './fx/corona.frag.js';
import { WORMHOLE_FRAG } from './fx/wormhole.frag.js';
import { loadGlb, bustToken } from './glbmodels.js';
import { makeBloom } from './postfx.js';
import { deepLink, wireDeepLink } from './deeplink.js';

// TWO CANDIDATES, ONE MACHINE. Corona is XorDev's ring singularity seen from
// outside; Wormhole is the same raymarch and the same singularity retargeted
// to a tunnel you are flying down. The operator raised the second as the
// alternative, and it is the more literal reading of "wormhole / teleportation"
// — so this is a registry rather than a hard-coded effect, and the choice is
// made by eye in the tab.
//
// Both cost the SAME SHAPE: uSteps x uTurbOctaves sine-folds per pixel. So the
// measurement below is valid for either, and switching effects does not
// invalidate a number already taken.
//
// Defaults are copied from the sandbox's own registry.mjs. Note wormhole's
// exposure is ~5x corona's, and that is deliberate upstream: nearly every ray
// crosses the throat, so far more rays hit the singularity.
const SHARED = {
  uSteps: 40,          // cost is linear; the sandbox notes detail saturates ~64
  uTurbOctaves: 6,     // sine folds per step. TOTAL COST = steps x octaves
  uTurbAmp: 1.0,
  uTurbFreq: 2.0,
  uStepScale: 1 / 3,
  uColorBias: 1.1,     // NEVER below 1.0 — at exactly 1.0 the singularity
                       // becomes 0/0 and returns real NaN (PORTING.md §3)
  uEpsilon: 1e-4,
};

const EFFECTS = {
  corona: {
    label: 'Corona',
    frag: CORONA_FRAG,
    defaults: { ...SHARED, uRingRadius: 1.0, uExposure: 30.0 },
    // the one knob whose name differs between the two, so the GUI can drive
    // "the radius of the thing the ray grazes" without special-casing
    radiusKey: 'uRingRadius',
  },
  wormhole: {
    label: 'Wormhole',
    frag: WORMHOLE_FRAG,
    defaults: {
      ...SHARED,
      uThroatRadius: 1.0,
      uExposure: 150.0,
      uSpeed: 1.6,      // forward travel RATE; the host integrates it
      uTravel: 0,       // ...into this phase, which is what the shader reads
      uTwist: 0.35,     // swirl per unit depth — the wormhole cue itself
      uSpin: 0.15,
      uSpinPhase: 0,
      uHueSpread: 0.5,  // above ~0.8 it reads as a rainbow, not a portal
      uDepthHue: 0.12,
      uMinStep: 0.02,   // 0 stalls the march at the wall
      uNear: 1.5,       // below ~1.2 the throat crossing leaves the frame
    },
    radiusKey: 'uThroatRadius',
  },
};

export function initPortalTab(root) {
  let active = false;
  const container = root.querySelector('#portal-app');
  const hud = root.querySelector('#portal-hud');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  // ?gl=1 — name the GL underneath: SwiftShader (software) or a real GPU.
  // The cinematics plan prices its offline render on this one fact.
  if (new URLSearchParams(location.search).get('gl') === '1') {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    console.log(`GL renderer="${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}"`
      + ` version="${gl.getParameter(gl.VERSION)}" maxTex=${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070d);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 500);
  camera.position.set(0, 5.2, 16);

  const hemi = new THREE.HemisphereLight(0xc8cfe0, 0x555060, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8c8, 0.35);
  sun.position.set(4, 7, 5); scene.add(sun);

  const postfx = makeBloom(renderer, scene, camera, {});
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 4.0, 0);

  const grid = new THREE.GridHelper(80, 40, 0x1b6fa8, 0x0a2a3a);
  grid.material.transparent = true; grid.material.opacity = 0.35;
  scene.add(grid);

  // --- THE CORONA, rendered ONCE into a target ----------------------------
  // A fullscreen triangle, not a quad: one primitive, and no seam down the
  // diagonal where derivatives go wrong. Vertices are already in clip space,
  // so the vertex shader is a pass-through and no camera matrix is involved.
  const fxScene = new THREE.Scene();
  const fxCamera = new THREE.Camera();
  const fxUniforms = {
    uResolution: { value: new THREE.Vector3(1, 1, 1) },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector4() },
    uTimeScale: { value: 1 },
  };
  // The SUPERSET of both effects' uniforms. three.js warns (and the value is
  // simply unused) for a uniform the current program does not declare, but a
  // uniform the program DOES declare and the object lacks is a hard failure —
  // so switching effects must never remove one. Union, then, not swap.
  for (const spec of Object.values(EFFECTS)) {
    for (const [k, v] of Object.entries(spec.defaults)) {
      if (!fxUniforms[k]) fxUniforms[k] = { value: v };
    }
  }

  const fxGeom = new THREE.BufferGeometry();
  fxGeom.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const fxMat = new THREE.ShaderMaterial({
    // NOT OPTIONAL: tanh() and `out` are GLSL ES 3.00 only, and the shader's
    // tonemap is built on tanh. Under GLSL1 three.js also injects the
    // gl_FragColor alias this shader deliberately does not use.
    glslVersion: THREE.GLSL3,
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: EFFECTS.corona.frag,
    uniforms: fxUniforms,
    depthTest: false,
    depthWrite: false,
  });
  fxScene.add(new THREE.Mesh(fxGeom, fxMat));

  let rt = null, rtSize = 0;
  function sizeTarget(n) {
    if (rtSize === n) return;
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(n, n, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false,
    });
    // PORTING.md: the effect writes DISPLAY-REFERRED values. A material that
    // samples it expects linear, so three must convert on read. Getting this
    // backwards is named there as the single most common cause of "right in
    // the sandbox, wrong in my scene."
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    rtSize = n;
    // ...and uResolution is the TARGET's size, never the canvas's, or the ring
    // is sized for the wrong aspect and lands off-centre.
    fxUniforms.uResolution.value.set(n, n, 1);
    for (const d of discs) d.material.map = rt.texture;
  }

  // --- the ring ------------------------------------------------------------
  const rings = new THREE.Group();
  scene.add(rings);
  const discs = [];      // the aperture faces, one per ring, all sharing ONE map
  const spinners = [];   // {a, b, yaw} per ring

  let apertureR = 1.8;   // measured from the model once it lands
  let ringTemplate = null;

  function buildRing() {
    if (!ringTemplate) return null;
    const g = ringTemplate.clone(true);
    const rotorA = g.getObjectByName('Rotor_A_Spin');
    const rotorB = g.getObjectByName('Rotor_B_Spin');
    const yaw = g.getObjectByName('Yaw_Turntable');

    // THE APERTURE IS LABELLED "KEEP EMPTY" on the operator's blueprint, and
    // that is why it is the right place: the model reserves the hole for
    // whatever fills it.
    //
    // It is an EMPTY node — no geometry — and the reserved volume lives in its
    // SCALE (1.8, 1.8, 0.58). A Box3 over it is degenerate and returns nothing,
    // which the first cut of this silently fell back from... to 1.8, the exact
    // right answer by coincidence. That kind of luck hides a bug forever, so
    // the disc is now parented to the node and left at unit radius: the model's
    // own authored volume scales it, and if the ring is ever re-exported at a
    // different size this follows without being touched.
    const vol = g.getObjectByName('Aperture_Volume');
    if (vol) apertureR = Math.max(vol.scale.x, vol.scale.y);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({
        map: rt ? rt.texture : null,
        // The corona is authored on black. Additive means the black IS the
        // transparency — no alpha channel needed, and the rim glow spills onto
        // the ring's inner liner the way a real one would.
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }));
    // unit radius under the aperture node (which carries the size), or the
    // measured radius if the model ever arrives without one
    if (vol) { disc.scale.set(1, 1, 1); vol.add(disc); }
    else { disc.scale.setScalar(apertureR); g.add(disc); }
    discs.push(disc);
    spinners.push({ a: rotorA, b: rotorB, yaw,
      // rest poses, so a capture can SET a rotor from t instead of accumulating
      restA: rotorA ? rotorA.rotation.z : 0, restB: rotorB ? rotorB.rotation.z : 0,
      restYaw: yaw ? yaw.rotation.y : 0 });
    rings.add(g);
    return g;
  }

  function setRingCount(n) {
    while (rings.children.length > n) {
      const g = rings.children[rings.children.length - 1];
      rings.remove(g);
      spinners.pop();
      const d = discs.pop();
      if (d) d.geometry.dispose();
    }
    while (rings.children.length < n && ringTemplate) buildRing();
    // lay them out in a row so several are on screen at once — the point of
    // the count knob is to watch the corona cost NOT move while it climbs
    rings.children.forEach((g, i) => {
      const span = 9.5;
      g.position.x = (i - (rings.children.length - 1) / 2) * span;
    });
  }

  loadGlb(`assets/models/portalring.glb`).then((src) => {
    if (!src) { if (hud) hud.textContent = 'portalring.glb failed to load'; return; }
    ringTemplate = src;
    // 72 meshes over 7 materials. Left unmerged ON PURPOSE here: this bench
    // reports draw calls, and merging would hide the geometry cost that the
    // corona cost has to be compared against. In the game it would merge,
    // preserving Rotor_A_Spin / Rotor_B_Spin / Yaw_Turntable / Aperture_Volume.
    setRingCount(P.rings);
    fitView();
  });

  function fitView() {
    const box = new THREE.Box3().setFromObject(rings);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    controls.target.copy(c);
    camera.position.set(c.x, c.y + s.y * 0.15, c.z + Math.max(s.x, s.y) * 1.9);
    controls.update();
  }

  // --- the knobs -----------------------------------------------------------
  const P = {
    corona: true,
    rtSize: 512,
    updateHz: 60,        // the corona need not run at display rate
    rings: 1,
    effect: 'corona',
    steps: SHARED.uSteps,
    octaves: SHARED.uTurbOctaves,
    radius: 1.0,
    exposure: EFFECTS.corona.defaults.uExposure,
    turbAmp: SHARED.uTurbAmp,
    speed: EFFECTS.wormhole.defaults.uSpeed,
    twist: EFFECTS.wormhole.defaults.uTwist,
    hueSpread: EFFECTS.wormhole.defaults.uHueSpread,
    timeScale: 1.0,
    spinA: 0.35,
    spinB: -0.22,
    yaw: 0.0,
    bloom: true,
    autoOrbit: false,
  };
  // THE PANEL, FROM THE URL. One generic pass over every knob the panel
  // owns, so a deep link can put the lab back exactly where it was — the
  // link button below is only honest if the address it writes is an address
  // this lab reads. Named parameters with their own meaning (?portalfx, ?bench, ?gl) keep
  // their own handling above/below; they are not knobs.
  const P0 = { ...P };   // the defaults, before the URL touches them
  {
    const dq = new URLSearchParams(location.search);
    for (const [k, v] of dq.entries()) {
      if (!(k in P) || typeof P[k] === 'function') continue;
      if (typeof P[k] === 'number') { const n = parseFloat(v); if (Number.isFinite(n)) P[k] = n; }
      else if (typeof P[k] === 'boolean') P[k] = v !== '0';
      else if (typeof P[k] === 'string') P[k] = v.startsWith('#') ? v : (/^[0-9a-f]{6}$/i.test(v) ? '#' + v : v);
    }
  }


  const gui = new GUI({ container: root.querySelector('#portal-gui') || undefined, width: 268 });
  gui.title('portal + corona');
  const fx = gui.addFolder('effect');
  fx.add(P, 'corona').name('effect on');
  fx.add(P, 'effect', Object.keys(EFFECTS)).name('which').onChange(setEffect);
  fx.add(P, 'rtSize', [128, 256, 512, 1024, 2048]).name('target px');
  fx.add(P, 'updateHz', 5, 60, 1).name('update Hz');
  fx.add(P, 'steps', 4, 120, 1).name('march steps');
  fx.add(P, 'octaves', 1, 12, 1).name('turb octaves');
  fx.add(P, 'radius', 0.1, 3, 0.01).name('ring / throat r');
  fx.add(P, 'exposure', 2, 600, 0.5).name('exposure');
  fx.add(P, 'turbAmp', 0, 3, 0.01).name('turb amount');
  fx.add(P, 'timeScale', 0, 3, 0.01).name('time scale');
  const wh = gui.addFolder('wormhole only');
  wh.add(P, 'speed', -6, 6, 0.02).name('travel speed');
  wh.add(P, 'twist', -2, 2, 0.005).name('twist / depth');
  wh.add(P, 'hueSpread', 0, 3.2, 0.01).name('hue spread');
  const st = gui.addFolder('stage');
  st.add(P, 'rings', 1, 8, 1).name('portals').onChange((n) => { setRingCount(n); fitView(); });
  st.add(P, 'spinA', -2, 2, 0.01).name('rotor A');
  st.add(P, 'spinB', -2, 2, 0.01).name('rotor B');
  st.add(P, 'yaw', -1, 1, 0.01).name('turntable');
  st.add(P, 'bloom').name('bloom');
  st.add(P, 'autoOrbit').name('auto orbit');

  // --- TAKING A LOOK OUT OF HERE ------------------------------------------
  // A tuning session that ends with the operator reading numbers off a
  // screenshot is a tuning session that has to be repeated. Same idiom as the
  // beam lab: copy to the clipboard, and save a .json for the ones worth
  // keeping, with the console as the always-works fallback because a silent
  // clipboard refusal is indistinguishable from a broken button.
  function presetJson() {
    return JSON.stringify({
      schema: 'portalfx/1',
      id: 'portal-in-world',
      generatedAt: new Date().toISOString(),
      effect: P.effect,
      // everything the shader reads, under the names it reads them by, so a
      // paste into the game is a paste and not a translation
      uniforms: {
        uSteps: Math.round(P.steps),
        uTurbOctaves: Math.round(P.octaves),
        [EFFECTS[P.effect].radiusKey]: P.radius,
        uExposure: P.exposure,
        uTurbAmp: P.turbAmp,
        uTimeScale: P.timeScale,
        uTwist: P.twist,
        uHueSpread: P.hueSpread,
      },
      // rates, which the HOST integrates into phases — not uniforms
      rates: { speed: P.speed },
      render: { rtSize: P.rtSize, updateHz: P.updateHz, bloom: P.bloom },
      stage: { portals: P.portals, spinA: P.spinA, spinB: P.spinB, yaw: P.yaw },
    }, null, 2);
  }
  let flashT = 0, flashMsg = '';
  function flashNote(m) { flashMsg = m; flashT = 2.0; }

  // THE DEEP LINK. This tab's own comment already wanted it — "so a look can
  // be linked rather than described" — for one parameter; now it is true of
  // the whole panel.
  wireDeepLink(root.querySelector('#portal-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'portal', params: P, defaults: P0, carry: location.search,
  }), { label: 'PORTAL', flash: flashNote });
  P.copyPreset = () => {
    const json = presetJson();
    const ok = () => { flashNote('preset copied to clipboard'); console.log('PORTAL preset:\n' + json); };
    const fail = (why) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = json; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const done = document.execCommand('copy');
        ta.remove();
        flashNote(done ? 'preset copied (fallback)' : 'copy refused — see console');
      } catch { flashNote('copy refused — see console'); }
      console.log(`PORTAL preset (clipboard ${why}):\n` + json);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(ok, () => fail('refused'));
    else fail('unavailable');
  };
  P.downloadPreset = () => {
    const blob = new Blob([presetJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement('a');
    a2.href = url;
    a2.download = `portal-${P.effect}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a2); a2.click(); a2.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flashNote('saved .json');
  };
  gui.add(P, 'copyPreset').name('⧉ copy preset');
  gui.add(P, 'downloadPreset').name('⇩ save .json');

  // Swapping the fragment source means a new program: three.js recompiles when
  // material.fragmentShader changes AND needsUpdate is set. The uniform object
  // is shared and is a union of both effects, so nothing has to be rebuilt.
  function setEffect(name) {
    const spec = EFFECTS[name];
    if (!spec) return;
    fxMat.fragmentShader = spec.frag;
    fxMat.needsUpdate = true;
    // carry the per-effect exposure across, since the two differ by ~5x and
    // leaving corona's 30 on the wormhole renders a white disc
    P.exposure = spec.defaults.uExposure;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }

  // --- the measurement -----------------------------------------------------
  // Two numbers, and they answer different questions.
  //
  // MEASURED ms is what this machine does today. It is the honest one, but it
  // is hardware- and driver-specific, and under headless SwiftShader (a
  // software rasteriser) it says nothing about an M4's GPU.
  //
  // FRAGMENT WORK is exact and hardware-independent: target pixels x steps x
  // octaves = the sine-fold iterations the march performs per frame. It is the
  // quantity the decision actually turns on, because it does not move when the
  // display, the portal count, or the portal's size on screen move.
  const times = [];
  let coronaMs = 0, frameMs = 0, lastFxAt = -1e9;

  function fragmentWork() {
    return P.rtSize * P.rtSize * P.steps * P.octaves;
  }

  const syncPix = new Uint8Array(4);
  // Timing a renderer.render() on the CPU measures SUBMISSION, not execution —
  // GL commands are queued and return immediately, so the number comes back
  // near zero however heavy the shader is. Reading a single pixel back from
  // the target forces the pipeline to drain, which is the only portable way to
  // put the GPU's work inside the interval being timed. It is a stall, so it
  // is used by the bench ONLY and never on a live frame.
  function syncGpu() {
    if (rt) renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, syncPix);
  }

  // THE INTEGRATED PHASES. Advanced once per frame from the rates, so a rate
  // change is a change of rate and nothing else. `phase` lets a probe pin an
  // exact value instead of racing the accumulator.
  const phase = { travel: 0, spin: 0 };
  function advancePhase(dt) {
    phase.travel += P.speed * P.timeScale * dt;
    phase.spin += (EFFECTS.wormhole.defaults.uSpin) * P.timeScale * dt;
  }

  function renderCorona(t, sync, at) {
    const t0 = performance.now();
    sizeTarget(P.rtSize);
    fxUniforms.uTravel.value = at ? at.travel : phase.travel;
    fxUniforms.uSpinPhase.value = at ? at.spin : phase.spin;
    fxUniforms.uTime.value = t;
    fxUniforms.uTimeScale.value = P.timeScale;
    fxUniforms.uSteps.value = Math.round(P.steps);
    fxUniforms.uTurbOctaves.value = Math.round(P.octaves);
    fxUniforms[EFFECTS[P.effect].radiusKey].value = P.radius;
    fxUniforms.uExposure.value = P.exposure;
    fxUniforms.uTurbAmp.value = P.turbAmp;
    fxUniforms.uTwist.value = P.twist;
    fxUniforms.uHueSpread.value = P.hueSpread;
    renderer.setRenderTarget(rt);
    renderer.render(fxScene, fxCamera);
    renderer.setRenderTarget(null);
    if (sync) syncGpu();
    return performance.now() - t0;
  }

  function resize() {
    const w = container.clientWidth || 800, h = container.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    postfx.setSize(w, h);
  }
  addEventListener('resize', () => { if (active) resize(); });

  const clock = new THREE.Clock();
  let simT = 0;
  // Own the counters explicitly. autoReset clears them at the start of every
  // internal render pass, so a read after postfx.render() reports only the
  // composer's LAST pass — that is the documented trap in this repo's ?perf
  // hook. Off, plus one reset at the top of each frame, gives the whole frame
  // including the effect pass and every bloom mip. (Leaving it off WITHOUT the
  // per-frame reset is the other half of the trap: the numbers then accumulate
  // forever and read as thousands of draw calls.)
  renderer.info.autoReset = false;

  function step(dt, t) {
    simT = t;
    for (const s of spinners) {
      // counter-rotating, as the blueprint labels them — the ring's axis is Z
      if (s.a) s.a.rotation.z += P.spinA * dt;
      if (s.b) s.b.rotation.z += P.spinB * dt;
      if (s.yaw) s.yaw.rotation.y += P.yaw * dt;
    }
    for (const d of discs) d.visible = P.corona;

    if (flashT > 0) flashT -= dt;
    advancePhase(dt);
    coronaMs = 0;
    if (P.corona) {
      const period = 1 / Math.max(1, P.updateHz);
      if (t - lastFxAt >= period) { coronaMs = renderCorona(t); lastFxAt = t; }
    }
    if (P.autoOrbit) {
      const a = t * 0.15;
      const r = camera.position.length();
      camera.position.x = Math.sin(a) * r * 0.6;
      camera.position.z = Math.cos(a) * r * 0.6;
    }
    controls.update();
  }

  function paintHud() {
    if (!hud) return;
    if (flashT > 0) { hud.innerHTML = `<b>${flashMsg}</b>`; return; }
    const r = renderer.info.render;
    const work = fragmentWork();
    const med = times.length ? times.slice().sort((a, b) => a - b)[times.length >> 1] : 0;
    const timed = med > 0.005;
    hud.innerHTML =
      (timed ? `<b>${med.toFixed(2)} ms/frame</b> (${(1000 / med).toFixed(0)} fps)`
        : `<b>no clock</b> (headless virtual time — ms unavailable)`)
      + (timed ? ` &nbsp;·&nbsp; ${EFFECTS[P.effect].label} pass <b>${coronaMs.toFixed(2)} ms</b>`
        : ` &nbsp;·&nbsp; ${EFFECTS[P.effect].label}`)
      + ` @ ${P.rtSize}&sup2; &times; ${Math.round(P.steps)}&times;${Math.round(P.octaves)}`
      + `<br>fragment work <b>${(work / 1e6).toFixed(1)}M</b> sine-folds/frame`
      + ` &nbsp;·&nbsp; ${P.updateHz}Hz &rarr; ${(work * P.updateHz / 1e9).toFixed(2)}G/s`
      + `<br>${rings.children.length} portal${rings.children.length === 1 ? '' : 's'}`
      + ` &nbsp;·&nbsp; ${r.calls} draw calls &nbsp;·&nbsp; ${(r.triangles / 1000).toFixed(1)}k tris`
      + ` &nbsp;·&nbsp; one shared target`;
  }

  let cineHold = false;   // a capture is driving the clock: the loop stands aside
  function frame() {
    requestAnimationFrame(frame);
    if (cineHold) return;
    if (!active) return;
    renderer.info.reset();
    const dt = Math.min(0.05, clock.getDelta());
    const t0 = performance.now();
    step(dt, simT + dt);
    postfx.setEnabled(P.bloom);
    postfx.render();
    frameMs = performance.now() - t0;
    times.push(frameMs);
    if (times.length > 90) times.shift();
    paintHud();
  }
  frame();
  // THE CAPTURE SEAM (docs/CINEMATICS-PLAN.md, phase 0). seek(t) puts the
  // bench at exactly t: the integrated phases become t × rate (the same
  // thing the accumulator converges to, without the accumulation), and one
  // frame is rendered synchronously. scripts/cine-capture.mjs calls this
  // per frame over CDP.
  // Two things the first cut got wrong, both caught by rendering frame 1
  // twice from two Chromes and diffing (4.6% of bytes differed, and frames
  // 1 and 2 of one run were IDENTICAL): the rotors accumulate `rate × dt`,
  // so a dt of 0 froze them where the live loop had left them; and the
  // corona's update gate compares t to the live loop's last render time, so
  // a seek to t=0.03 after the loop had reached t=2 rendered nothing. Every
  // time-dependent thing is now SET from t, and the gate is reset.
  const hidden = [];
  installCine({
    canvas: renderer.domElement,
    hold: (on) => {
      cineHold = on;
      if (on) {
        scene.traverse((o) => { if (/collision/i.test(o.name || '') && o.visible) { o.visible = false; hidden.push(o); } });
      } else {
        for (const o of hidden.splice(0)) o.visible = true;
        clock.getDelta();
      }
    },
    seek: (t) => {
      phase.travel = P.speed * P.timeScale * t;
      phase.spin = EFFECTS.wormhole.defaults.uSpin * P.timeScale * t;
      for (const sp of spinners) {
        if (sp.a) sp.a.rotation.z = sp.restA + P.spinA * t;
        if (sp.b) sp.b.rotation.z = sp.restB + P.spinB * t;
        if (sp.yaw) sp.yaw.rotation.y = sp.restYaw + P.yaw * t;
      }
      lastFxAt = -1e9;
      renderer.info.reset();
      step(0, t);
      postfx.setEnabled(P.bloom);
      postfx.render();
    },
  });

  // ?portalperf=1 — THE DECISION, AS NUMBERS. Sweeps target size and march
  // parameters and reports both costs: measured milliseconds (honest but
  // hardware-specific — under headless SwiftShader, a SOFTWARE rasteriser,
  // these say nothing about an M4's GPU) and fragment work (exact, and the
  // quantity the decision actually turns on).
  //
  // The load-bearing claim it tests: cost does NOT scale with the number of
  // portals, because they share one target. If that is false the whole
  // "always on" option dies, so it is measured rather than asserted.
  const urlParams = new URLSearchParams(location.search);
  // ?portalfx=corona|wormhole — so a look can be linked rather than described,
  // and so the perf probe can be pointed at either without touching a slider.
  const fxWanted = urlParams.get('portalfx');
  if (fxWanted && EFFECTS[fxWanted]) { P.effect = fxWanted; setEffect(fxWanted); }
  // ?fxprobe=1 — DOES EACH KNOB ACTUALLY REACH THE SHADER?
  //
  // Operator: the wormhole-only variables "seem to have no effect". That is a
  // claim about the pixels, so it is settled with pixels: render the SAME
  // frame twice with one knob moved, read both targets back, and report the
  // mean absolute difference. Zero means the uniform is not arriving; a large
  // number means it is and the look is the argument instead.
  if (urlParams.get('fxprobe') === '1') {
    setTimeout(() => {
      P.effect = 'wormhole'; setEffect('wormhole');
      const W = 64;
      const buf = () => new Uint8Array(W * W * 4);
      const shot = (mut) => {
        const keep = { speed: P.speed, twist: P.twist, hueSpread: P.hueSpread,
          rtSize: P.rtSize, steps: P.steps };
        P.rtSize = W; P.steps = 24;
        mut();
        renderCorona(3.0, true);          // FIXED time, so only the knob differs
        const b = buf();
        renderer.readRenderTargetPixels(rt, 0, 0, W, W, b);
        Object.assign(P, keep);
        return b;
      };
      const diff = (a, b) => {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
        return sum / a.length;
      };
      const base = shot(() => { P.twist = 0; P.hueSpread = 0.5; });
      // These are the INSTANTANEOUS knobs — move one and this frame changes.
      // `speed` is deliberately not among them: it is a RATE now, and a rate
      // shows up through the phase it integrates into, which the next block
      // tests. Listing it here would print "NO EFFECT" for correct behaviour.
      const tests = [
        ['twist / depth 0 -> 1.5', () => { P.twist = 1.5; P.hueSpread = 0.5; }],
        ['hue spread  0.5 -> 2.5', () => { P.twist = 0; P.hueSpread = 2.5; }],
        ['(control) nothing moved', () => { P.twist = 0; P.hueSpread = 0.5; }],
      ];
      for (const [label, mut] of tests) {
        const d = diff(base, shot(mut));
        console.log(`FXPROBE ${label.padEnd(24)} mean pixel delta ${d.toFixed(3)}`
          + `  ${d < 0.5 ? '<-- NO EFFECT' : 'reaches the shader'}`);
      }

      // WHY IT FEELS LIKE NOTHING, even though every knob reaches the shader.
      //
      // The march computes `travel = T * uSpeed` — ACCUMULATED time times the
      // rate. So moving the rate does not change how fast the field flows from
      // here on; it retroactively rewrites where the field has been for the
      // whole session. The longer the tab has been open, the further one
      // slider notch teleports you, and a teleport into turbulence looks like
      // a reshuffle, not an acceleration.
      //
      // Measured by nudging the speed by ONE slider step at two different
      // elapsed times. If the deltas grow with T, the knob is a jump control.
      // THE FIX, ASSERTED. Travel is an integrated PHASE now, so the rate no
      // longer reaches backwards: at a pinned phase, moving `speed` changes
      // nothing at all, and the image depends only on how far you have
      // actually travelled. Before the fix these read 12.1 / 19.4 / 28.1 —
      // growing with page uptime, which is the signature of the bug.
      const shotAt = (T, sp, travel) => {
        const keep = { speed: P.speed, rtSize: P.rtSize, steps: P.steps,
          twist: P.twist, hueSpread: P.hueSpread };
        P.rtSize = W; P.steps = 24; P.twist = 0; P.hueSpread = 0.5; P.speed = sp;
        renderCorona(T, true, { travel, spin: 0 });
        const b = buf();
        renderer.readRenderTargetPixels(rt, 0, 0, W, W, b);
        Object.assign(P, keep);
        return b;
      };
      for (const T of [2, 20, 200]) {
        const d = diff(shotAt(T, 1.00, 3), shotAt(T, 1.02, 3));
        console.log(`FXPROBE at a PINNED phase, one 0.02 step of speed at`
          + ` t=${String(T).padStart(3)}s moves ${d.toFixed(3)}`
          + `  ${d < 0.5 ? 'rate no longer reaches backwards' : '<-- STILL A JUMP CONTROL'}`);
      }
      // ...and the phase itself is what moves the picture
      const dPhase = diff(shotAt(5, 1, 0), shotAt(5, 1, 6));
      console.log(`FXPROBE travelling 0 -> 6 of phase moves ${dPhase.toFixed(3)}`
        + `  ${dPhase > 0.5 ? 'travel is live' : '<-- TRAVEL DOES NOTHING'}`);
    }, 900);
  }

  // ?bench=SIZE:FRAMES — time the wormhole at a FULL-FRAME size, on whatever
  // GL is underneath, with the readback stall so the GPU's work is inside the
  // interval. Runs SYNCHRONOUSLY inside init, without --virtual-time-budget
  // (which freezes performance.now): the load event waits for it, so the
  // lines are out before headless takes its screenshot. A 1440² target is
  // 1080p's pixel count (2.07M); 2880² is 4K's (8.3M). This is the number the
  // cinematics plan prices the offline render on.
  if (urlParams.get('bench')) {
    const [sz, nf, st, oc, nr] = urlParams.get('bench').split(':').map(Number);
    const size = sz || 1440, frames = nf || 10;
    if (st) P.steps = st;        // the board's preset is 120:12; the bench idles at 40:6
    if (oc) P.octaves = oc;
    if (nr) fxUniforms.uNear.value = nr;   // the ray's start: the cinematic flies it in from 0.45
    setEffect('wormhole'); P.effect = 'wormhole';
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const who = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const short = /SwiftShader/.test(who) ? 'SwiftShader' : /Apple M/.test(who) ? who.replace(/.*(Apple M\d+).*/, '$1') : who;
    P.rtSize = size;
    renderCorona(0, true); renderCorona(0.033, true);   // warm: compile, allocate
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) renderCorona(i / 30, true);
    const ms = (performance.now() - t0) / frames;
    const folds = fragmentWork();
    console.log(`BENCH gl=${short} rt=${size}x${size} (${(size * size / 1e6).toFixed(2)}M px) uNear=${fxUniforms.uNear.value}`
      + ` steps=${Math.round(P.steps)} octaves=${Math.round(P.octaves)} frames=${frames}`
      + ` ms/frame=${ms.toFixed(1)} fps=${(1000 / ms).toFixed(1)}`
      + ` folds/frame=${(folds / 1e9).toFixed(2)}G rate=${(folds / ms / 1e6).toFixed(1)}Gfolds/s`
      + ` ${ms > 0.5 ? '' : '<-- clock did not advance (virtual time?)'}`);
  }

  if (urlParams.get('portalperf') === '1') {
    setTimeout(() => {
      // HEADLESS CANNOT TIME THIS. performance.now() does not advance under
      // --virtual-time-budget, so every ms here comes back 0.00 in CI and the
      // column is meaningless. Say so, loudly, rather than printing zeros that
      // look like "free". The fragment-work column is exact either way, and
      // the ms fill in when the operator opens the tab on real hardware.
      let clockLive = false;
      { const a0 = performance.now(); for (let i = 0; i < 5e6; i++) ; clockLive = performance.now() > a0; }
      const bench = (label, fn) => {
        fn();
        renderCorona(1.0, true);                 // warm the program
        const runs = [];
        for (let i = 0; i < 12; i++) runs.push(renderCorona(2 + i * 0.05, true));
        runs.sort((x, y) => x - y);
        const med = runs[runs.length >> 1];
        console.log(`PORTALPERF ${label.padEnd(30)} ${clockLive ? `${med.toFixed(2)} ms` : '  --  '}`
          + `  | ${(fragmentWork() / 1e6).toFixed(1)}M sine-folds/frame`);
        return med;
      };
      const reset = () => { P.rtSize = 512; P.steps = 40; P.octaves = 6; };
      console.log(`PORTALPERF clock ${clockLive ? 'LIVE — ms are real' : 'FROZEN (headless virtual time) — ms column is meaningless here, read the sine-folds'}`);
      console.log(`PORTALPERF model ${ringTemplate ? 'loaded' : 'NOT LOADED — scene counts below are void'}`
        + ` | aperture radius ${apertureR.toFixed(2)} (from the node's own scale, not a guess)`);

      console.log('PORTALPERF --- target size, at 40x6 ---');
      for (const n of [128, 256, 512, 1024]) bench(`${n}x${n}`, () => { reset(); P.rtSize = n; });

      console.log('PORTALPERF --- march cost, at 512x512 ---');
      bench('steps 40 x oct 6 (default)', () => reset());
      bench('steps 24 x oct 6', () => { reset(); P.steps = 24; });
      bench('steps 40 x oct 4', () => { reset(); P.octaves = 4; });
      bench('steps 24 x oct 4', () => { reset(); P.steps = 24; P.octaves = 4; });

      console.log('PORTALPERF --- both effects, same settings ---');
      for (const e of ['corona', 'wormhole']) bench(`${e} 512 40x6`, () => { reset(); setEffect(e); });
      setEffect('corona');

      // THE CLAIM. One target, N portals: the effect pass must not move.
      console.log('PORTALPERF --- does portal count move the effect cost? ---');
      for (const n of [1, 4, 8]) {
        reset();
        setRingCount(n);
        const ms = bench(`${n} portal(s) on screen`, () => {});
        renderer.info.reset();
        postfx.render();
        console.log(`PORTALPERF   ...and the SCENE at ${n}: ${renderer.info.render.calls} draw calls,`
          + ` ${(renderer.info.render.triangles / 1000).toFixed(1)}k tris`
          + ` — THIS is what climbs with portal count; the effect pass above does not`);
      }
      setRingCount(1);

      // negative control: if the bench were not actually running the shader,
      // every number above would be identical noise. 1 step must be far
      // cheaper than 120, or the measurement is measuring nothing.
      reset();
      const lo = bench('CONTROL steps=1 oct=1', () => { reset(); P.steps = 1; P.octaves = 1; });
      const hi = bench('CONTROL steps=120 oct=12', () => { reset(); P.steps = 120; P.octaves = 12; });
      console.log(`PORTALPERF control: 1x1 vs 120x12 — `
        + (!clockLive
          ? 'SKIPPED (no clock: nothing to compare — this control only means something on real hardware)'
          : `${hi > lo * 2 ? 'PASS' : 'FAIL'} (${lo.toFixed(2)}ms vs ${hi.toFixed(2)}ms;`
            + ' the march must dominate or the bench is timing overhead)'));
      reset();
    }, 2500);   // after the glb has landed
  }

  return {
    setActive(on) {
      active = on;
      if (on) { resize(); clock.getDelta(); }
    },
    // for the headless probe
    _bench: { P, renderCorona, fragmentWork, renderer, rings, step,
      render: () => postfx.render(), sizeTarget, times },
  };
}
