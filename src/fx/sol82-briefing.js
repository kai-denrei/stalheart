// SOL-82's briefing: the orbital laser combat satellite introduced the way the gunship is (src/fx/gunship-briefing.js),
// and further. The detailed tier turns as cyan wireframe in its own small renderer; each page flies the camera to the
// parts it names, labels ride the model's own nodes with leader lines, and the clips play what the page says: the
// arrays deploy on arrival, the radiators glow on the thermal page, the iris opens on the optics page, the idle cycle
// runs between. Every number comes from src/content/orbital-laser.js, so the 1.2 GJ is 120 MW for a 10 s burn.
// Skippable, once per browser; the host opens it and gets its callback on close.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
import { LASER_ORBIT, LASER_BEAM, LASER_BURN, LASER_TELEMETRY } from '../content/orbital-laser.js';

const SOL82_URL = 'assets/models/sol82/sol82_platform_detailed.glb';
const SEEN_KEY = 'stalheart:v1:sol82-briefing';
const GJ = (LASER_TELEMETRY.powerMW * LASER_BEAM.energy) / 1000;
const CYAN = 0x62d7ff, AMBER = 0xffb020, WHITE_HOT = 0xeaf6ff;

// Labels, anchored to a node's world position plus an offset in model metres (so a wing label follows the deployed
// wing). Where the model has no node for a part the lore names (the cryocoolers on the wings, the phase-change sinks
// between the radiator roots, the capacitor drums along the spine), the offset places the label on the structure the
// README says carries it.
const LABELS = {
  prow: { node: 'SOCKET_SENSOR_FORWARD', offset: [0, 0, 0], text: 'GUARDED SENSOR PROW' },
  thrusters: { node: 'SOCKET_THRUSTER_REAR', offset: [0, 0, 0], text: 'THRUSTER PODS' },
  aperture: { node: 'APERTURE', offset: [0, 0, 0], text: 'APERTURE · BEAM EXIT' },
  gimbal: { node: 'OPTICS_YAW', offset: [0, 0, 0], text: 'OPTICS GIMBAL · YAW / PITCH' },
  core: { node: 'SOCKET_ENERGY_CORE', offset: [0, 0, 0], text: 'SHIELDED CORE' },
  store: { node: 'ENERGY_SPINE', offset: [0, 0.6, 0], text: `PULSE STORE · ${GJ.toFixed(1)} GJ` },
  drums: { node: 'ENERGY_SPINE', offset: [0, -0.8, -3.5], text: 'CAPACITOR DRUMS' },
  wingL: { node: 'ARRAY_L', offset: [-14, 0, 0], text: 'TRACKING WING' },
  wingR: { node: 'ARRAY_R', offset: [14, 0, 0], text: 'TRACKING WING' },
  cryo: { node: 'ARRAY_L', offset: [-6, 0, 1.5], text: 'CRYOCOOLERS' },
  radL: { node: 'RADIATOR_L', offset: [-2.5, 2, 0], text: 'RADIATOR VANE' },
  radR: { node: 'RADIATOR_R', offset: [2.5, 2, 0], text: 'RADIATOR VANE' },
  sinks: { node: 'RADIATOR_L', offset: [1.75, -0.6, 0], text: 'PHASE-CHANGE SINKS' },
};

// cam: where the camera stands and what it looks at, in model metres; labels: which of LABELS show; mood: what glows
const PAGES = [
  { head: 'SOL-82 · ORBITAL LASER COMBAT SATELLITE', cam: { pos: [58, 22, 46], look: [0, 4, 0] }, labels: ['prow', 'thrusters', 'wingL', 'wingR'],
    body: ["The gunship's higher-orbit cousin. No crew.", '52.55 m tracking wings on a 17.95 m armoured bus.', 'Named for SOL-740 and 1982.'] },
  { head: 'ENERGY · THE PULSE STORE', cam: { pos: [14, 24, 30], look: [0, 6, 0] }, labels: ['core', 'store', 'drums'],
    body: [`A shielded core charges a ${GJ.toFixed(1)} GJ pulse store between passes.`, 'Capacitor drums along the spine hold the charge.', 'A stored-energy weapon: the sun only runs the bus.'] },
  { head: 'WINGS · CRYOCOOLERS', cam: { pos: [-48, 16, 20], look: [-12, 5, 0] }, labels: ['wingL', 'cryo', 'wingR'],
    body: ['The wings track the sun and run the bus, the cryocoolers and optical control.', `Cold optics hold a clean ${LASER_TELEMETRY.wavelengthUm.toFixed(3)} µm line.`] },
  { head: 'THERMAL · SINKS AND RADIATORS', cam: { pos: [24, 30, -30], look: [0, 7, 0] }, labels: ['sinks', 'radL', 'radR'], mood: 'heat',
    body: [`Phase-change sinks swallow the heat of a ${LASER_BEAM.energy} s burn.`, 'Paired radiator vanes unfold and shed it before the next pass.', 'Unused charge is dumped when the pass ends: a hot store will not hold.'] },
  { head: 'OPTICS · THE APERTURE', cam: { pos: [18, -24, 30], look: [0, 0, 0] }, labels: ['aperture', 'gimbal'], mood: 'optics',
    body: [`${LASER_TELEMETRY.wavelengthUm.toFixed(3)} µm Nd:YAG, continuous wave, ${LASER_TELEMETRY.powerMW} MW.`, `${GJ.toFixed(1)} GJ delivered in a ${LASER_BEAM.energy} s burn.`, `A two-axis ventral telescope lays a ${LASER_BEAM.radius * 2} m footprint on the ground.`] },
  { head: 'THE PASS', cam: { pos: [72, 34, -8], look: [0, -10, 0] }, labels: ['aperture'], mood: 'beam',
    body: [`Overhead ${LASER_ORBIT.overhead} s, every ${LASER_ORBIT.period} s.`, `${LASER_BEAM.energy} s of burn per pass. Walls and rock go in ${LASER_BURN.wall} s, towers in ${LASER_BURN.tower} s.`, `The Stalheart goes in ${LASER_BURN.heart} s. Nothing stops you burning your own base.`] },
  { head: 'OPERATOR', cam: { pos: [42, 12, -44], look: [0, 3, 0] }, labels: [], mood: 'beam',
    body: ['You aim through its own optics: the round scope.', 'The beam is slow and heavy. Lead it, hold it, drag it.', `Range feedback past ${LASER_BEAM.range} m from the base. The rest is yours.`] },
];

export function createSol82Briefing(root) {
  const el = document.createElement('div');
  el.id = 'sol82-briefing';
  el.hidden = true;
  el.innerHTML = `<div class="sheet"><header><h1>&gt; ORBITAL ASSET BRIEFING_</h1><p class="sub">SOL-82 // wireframe survey // combat satellite uplink</p></header>
    <div class="body"><div class="view"><canvas></canvas><div class="labels"><svg></svg></div></div><div class="text"><h2></h2><ul></ul><div class="dots">${PAGES.map(() => '<i></i>').join('')}</div></div></div>
    <footer><span>SPACE OR CLICK · NEXT</span><span><button type="button" data-skip>SKIP</button> <button type="button" data-next>NEXT</button></span></footer></div>`;
  root.append(el);
  const canvas = el.querySelector('canvas'), layer = el.querySelector('.labels'), svg = el.querySelector('svg');
  const h2 = el.querySelector('h2'), ul = el.querySelector('ul'), dots = [...el.querySelectorAll('.dots i')], next = el.querySelector('[data-next]');
  let renderer = null, scene = null, cam = null, model = null, mixer = null, clips = [], raf = 0, page = 0, onClose = null, opened = 0, last = 0;
  let wire = null, heatMat = null, glowMat = null, beam = null;
  const labelEls = new Map();
  const camFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3() }, camTo = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let flyT = 1, t = 0;
  const seen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
  const remember = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* no store: it simply shows again */ } };

  function setup() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(34, 3 / 2, 0.1, 800);
    const grid = new THREE.GridHelper(160, 32, 0x2f5a62, 0x1d3a41);
    grid.position.y = -12;
    scene.add(grid);
    wire = new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.8 });
    heatMat = new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.9 });
    glowMat = new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.9 });
    /* the beam axis, down from the aperture: the engine's beam is not in the model, this only shows where it leaves */
    const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -120, 0)]);
    beam = new THREE.Line(beamGeo, new THREE.LineDashedMaterial({ color: WHITE_HOT, dashSize: 2, gapSize: 1.5, transparent: true, opacity: 0 }));
    beam.computeLineDistances();
    scene.add(beam);
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(SOL82_URL, (g) => {
      model = g.scene;
      const hidden = model.getObjectByName('SOL82_DISTANCE_GEOMETRY');
      if (hidden) hidden.visible = false;
      model.traverse((o) => { if (o.isMesh) o.material = wire; });
      model.getObjectByName('SOL82_RADIATOR_SURFACES')?.traverse((o) => { if (o.isMesh) o.material = heatMat; });
      model.getObjectByName('SOL82_APERTURE_GLOW')?.traverse((o) => { if (o.isMesh) o.material = glowMat; });
      scene.add(model);
      mixer = new THREE.AnimationMixer(model);
      clips = g.animations;
      mixer.addEventListener('finished', (e) => { if (e.action.getClip().name === 'Arrays_Deploy') play('Idle_Cycle', true); });
      play('Arrays_Deploy');
    }, undefined, () => { h2.textContent = 'SOL-82 · MODEL UNAVAILABLE'; });
    for (const [id, spec] of Object.entries(LABELS)) {
      const box = document.createElement('div');
      box.className = 'label';
      box.textContent = spec.text;
      layer.append(box);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '2.5');
      svg.append(line, dot);
      labelEls.set(id, { box, line, dot, spec });
    }
  }

  function play(name, loop = false) {
    const clip = clips.find((c) => c.name === name);
    if (!clip || !mixer) return;
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.play();
  }

  function show(i) {
    const was = page;
    page = Math.max(0, Math.min(PAGES.length - 1, i));
    const p = PAGES[page];
    h2.textContent = p.head;
    ul.innerHTML = p.body.map((l) => `<li>${l}</li>`).join('');
    dots.forEach((d, k) => d.classList.toggle('on', k === page));
    next.textContent = page === PAGES.length - 1 ? 'TAKE THE BEAM' : 'NEXT';
    camFrom.pos.copy(cam.position);
    camFrom.look.copy(camTo.look);
    camTo.pos.fromArray(p.cam.pos);
    camTo.look.fromArray(p.cam.look);
    flyT = was === page && opened <= 1 && t === 0 ? 1 : 0;
    if (p.mood === 'optics' && PAGES[was]?.mood !== 'optics') play('Aperture_Open');
  }

  const ease = (x) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
  const anchor = new THREE.Vector3(), screen = new THREE.Vector3();

  function placeLabels(w, h) {
    const p = PAGES[page], centre = new THREE.Vector3(0, 4, 0).project(cam);
    for (const [id, item] of labelEls) {
      const on = model && p.labels.includes(id);
      item.box.style.display = on ? '' : 'none';
      item.line.style.display = on ? '' : 'none';
      item.dot.style.display = on ? '' : 'none';
      if (!on) continue;
      const node = model.getObjectByName(item.spec.node);
      if (!node) { item.box.style.display = 'none'; item.line.style.display = 'none'; item.dot.style.display = 'none'; continue; }
      node.getWorldPosition(anchor).add(screen.fromArray(item.spec.offset));
      anchor.project(cam);
      const ax = (anchor.x + 1) / 2 * w, ay = (1 - anchor.y) / 2 * h;
      /* the label stands off outward from the model's centre on screen, so labels fan out instead of piling up */
      const cx = (centre.x + 1) / 2 * w, cy = (1 - centre.y) / 2 * h;
      let dx = ax - cx, dy = ay - cy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const lx = Math.max(70, Math.min(w - 70, ax + dx * 70)), ly = Math.max(14, Math.min(h - 14, ay + dy * 46));
      item.box.style.left = `${lx}px`;
      item.box.style.top = `${ly}px`;
      item.line.setAttribute('x1', ax); item.line.setAttribute('y1', ay);
      item.line.setAttribute('x2', lx); item.line.setAttribute('y2', ly);
      item.dot.setAttribute('cx', ax); item.dot.setAttribute('cy', ay);
    }
  }

  function tick(now) {
    if (el.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    t += dt;
    const r = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    /* the camera flies to the page's angle, then drifts slowly around its target */
    flyT = Math.min(1, flyT + dt / 1.4);
    const k = ease(flyT);
    const look = camFrom.look.clone().lerp(camTo.look, k);
    const drift = new THREE.Vector3(Math.sin(t * 0.25) * 4, Math.sin(t * 0.18) * 2, Math.cos(t * 0.21) * 4);
    cam.position.copy(camFrom.pos).lerp(camTo.pos, k).add(drift);
    cam.lookAt(look);
    mixer?.update(dt);
    const mood = PAGES[page].mood;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    heatMat.color.set(mood === 'heat' ? AMBER : CYAN);
    heatMat.opacity = mood === 'heat' ? 0.55 + 0.45 * pulse : 0.8;
    glowMat.color.set(mood === 'optics' || mood === 'beam' ? WHITE_HOT : CYAN);
    glowMat.opacity = mood === 'optics' || mood === 'beam' ? 0.6 + 0.4 * pulse : 0.8;
    beam.material.opacity = mood === 'beam' || mood === 'optics' ? 0.35 + 0.35 * pulse : 0;
    renderer.render(scene, cam);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    placeLabels(w, h);
    raf = requestAnimationFrame(tick);
  }

  function release() {
    cancelAnimationFrame(raf);
    mixer?.stopAllAction();
    for (const m of [wire, heatMat, glowMat, beam?.material]) m?.dispose();
    beam?.geometry.dispose();
    model?.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    renderer?.dispose();
    renderer = null; scene = null; model = null; mixer = null; clips = [];
    for (const item of labelEls.values()) { item.box.remove(); item.line.remove(); item.dot.remove(); }
    labelEls.clear();
  }

  function close() {
    if (el.hidden) return;
    el.hidden = true;
    remember();
    release();   /* its own WebGL context and the model go with it: reopening loads them again */
    const cb = onClose;
    onClose = null;
    cb?.();
  }
  function advance() { if (page >= PAGES.length - 1) close(); else show(page + 1); }
  next.addEventListener('click', advance);
  el.querySelector('[data-skip]').addEventListener('click', close);
  canvas.addEventListener('click', advance);
  const onKey = (e) => {
    if (el.hidden) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') close();
    else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); advance(); }
  };
  addEventListener('keydown', onKey, true);

  return {
    seen,
    isOpen: () => !el.hidden,
    opened: () => opened,
    open(cb) {
      setup();
      onClose = cb;
      el.hidden = false;
      opened++;
      t = 0;
      last = performance.now();
      cam.position.fromArray(PAGES[0].cam.pos);
      camTo.look.fromArray(PAGES[0].cam.look);
      show(0);
      flyT = 1;
      raf = requestAnimationFrame(tick);
    },
    dispose() { release(); removeEventListener('keydown', onKey, true); el.remove(); },
  };
}
