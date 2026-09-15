// THE ORBITAL LASER LAB. The real story base at stage 6 — the shipped walls, the gate, the Stalheart, the foundry,
// the bays — two sentries on their story sockets, an open sinkhole down the sightline, and a trench between them
// with twenty bodies queueing in single file. The ground view is full screen; the satellite view is an inset in the
// corner, and the pointer only steers there.
//
// The lab owns its own integrator for the bodies (the swarm lab's shape: plain records, absolute-time idle ticks,
// retired rather than disposed) and its own destruction: it drops wall instances, hides structure holders and seals
// the sinkhole with rubble. It never touches the game's breachWallCell, destroyTower or sealedBreachCells.
//
// ONE FRAME GOTCHA, and it is load-bearing. The story world puts the POLE at the origin and the planet centre at
// (0, -radius, 0) (src/domain/base-plan.js:12). createExplosions passes Math.hypot(point) as the planet radius and
// createBreachRubble normalizes its footprint, so both assume a CENTRE-at-origin scene. Everything that assumes that
// hangs off `sphereRoot`, a group at (0, -radius, 0), and is handed planet-centred points; everything else uses the
// pole-origin world metres the base and the planet mesh are drawn in.
import * as THREE from '../../vendor/three.module.js';
import GUI from '../../vendor/lil-gui.esm.js';
import { LOOKS } from '../looks.js';
import { STORY_RECIPE, STORY_CLEARING } from '../content/story-defaults.js';
import { buildStoryPlanet } from '../domain/story-planet.js';
import { planetBake } from '../platform/planet-bake.js';
import { buildStoryPlanetMesh } from './story-planet-mesh.js';
import { planBase } from '../domain/base-plan.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../content/base-layout.js';
import { createStoryBase } from '../fx/story-base.js';
import { createSinkhole } from '../sinkhole.js';
import { createBreachRubble } from '../breach-rubble.js';
import { createExplosions } from '../fx/explosions.js';
import { EXPLOSION_SCARE, SCARE_FREEZE_S } from '../content/explosions.js';
import { applyScare, stampScare, isScared, scarePace } from '../domain/impact-scare.js';
import { createThermalHeat } from '../fx/thermal-heat.js';
import { createOrbitalLaser } from '../fx/orbital-laser.js';
import { makeDotEnemy, makeDotBurst } from '../units.js';
import { loadGlbWithClips } from '../glbmodels.js';
import { LASER_ORBIT, LASER_BEAM, LASER_BURN, LASER_VIEW, LASER_PRESET, LASER_CONTACT_RATE } from '../content/orbital-laser.js';
import { makeLaser, stepLaser, aimLaser, burnLaser, burnContacts, laserProgress } from '../domain/orbital-laser.js';
import { deepLink, wireDeepLink } from '../deeplink.js';
import { norm3 } from '../vec3.js';

const STAGE = 6;                                   /* the Stalheart's stage: the whole base stands */
const BODIES = 20;
const BODY_SPEED = 2.2;                            /* metres per second up the trench */
const BODY_GAP = 3.4;                              /* single file: metres between one body and the next */
const TRENCH_WIDTH = 4, TRENCH_DEPTH = 1.5;
const SENTRIES = [
  ['rotor', 'assets/models/sentries/rotor_t1.glb'],
  ['quiver', 'assets/models/sentries/quiver_t1.glb'],
];
const BODY_TYPES = ['amoeba', 'phage'];
const BODY_COLS = { walker: 0xdfe8ee, walkerHi: 0xffffff };
const Y = new THREE.Vector3(0, 1, 0);

export function initLaserTab(root) {
  const q = new URLSearchParams(location.search);
  const container = root.querySelector('#laser-app'), hud = root.querySelector('#laser-hud');
  const look = LOOKS.tronColors;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.bg);
  scene.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]));
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]);
  sun.position.set(120, 260, 90);
  scene.add(sun);

  /* the panel's working copy of the content; the panel edits this, never the frozen tables */
  const P = {
    period: LASER_ORBIT.period, overhead: LASER_ORBIT.overhead,
    energy: LASER_BEAM.energy, radius: LASER_BEAM.radius, slew: LASER_BEAM.slew,
    altitude: LASER_VIEW.altitude, fov: LASER_VIEW.fov, inset: LASER_VIEW.inset,
    groundBack: LASER_VIEW.groundBack, groundUp: LASER_VIEW.groundUp,
    burnSoft: LASER_BURN.soft, burnHard: LASER_BURN.hard, burnWall: LASER_BURN.wall,
    burnTower: LASER_BURN.tower, burnSeal: LASER_BURN.seal, burnHeart: LASER_BURN.heart,
    coreWidth: LASER_PRESET.coreWidth, glowWidth: LASER_PRESET.glowWidth,
    glowIntensity: LASER_PRESET.glowIntensity, noiseAmount: LASER_PRESET.noiseAmount,
  };
  const P0 = { ...P };
  for (const key of Object.keys(P)) {
    const v = q.get(key);
    if (v !== null && Number.isFinite(Number(v))) P[key] = Number(v);
  }
  const orbit = () => ({ period: P.period, overhead: P.overhead });
  const beamCfg = () => ({ energy: P.energy, radius: P.radius, slew: P.slew });
  const burnCfg = () => ({ soft: P.burnSoft, hard: P.burnHard, wall: P.burnWall, tower: P.burnTower, seal: P.burnSeal, tank: 1.0, heart: P.burnHeart });

  let active = false, disposed = false, frameId = 0, last = performance.now(), clock = 0;
  let planet = null, planetMesh = null, plan = null, base = null, sphereRoot = null;
  let explosions = null, rubble = null, sink = null, laser = null, thermal = null;
  let wallMeshes = [], wallCells = [], structs = [], sentries = [];
  let bodies = [], bursts = [], trench = null, trenchMesh = null;
  let ready = false, held = false, burningWas = false, contactTimer = 0, sealed = false, sinkOpened = false;
  const errors = [];
  const run = { bodies: 0, walls: 0, towers: 0, sealed: 0, heart: 'INTACT' };
  const st = makeLaser(orbit(), beamCfg());
  let steerN = [0.5, 0.5], steering = false;

  const ground = new THREE.PerspectiveCamera(52, 1, 0.5, 8000);
  const sat = new THREE.PerspectiveCamera(P.fov, 1, 1, 40000);
  const ray = new THREE.Raycaster();
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpN = new THREE.Vector3();
  let R = 753, cellSide = 10, sphere = null, north = new THREE.Vector3(0, 0, -1);

  const toWorld = (p) => new THREE.Vector3(...planet.frameToWorld(p));
  const toCentre = (v) => [v.x, v.y + R, v.z];
  const fromCentre = (c) => new THREE.Vector3(c[0], c[1] - R, c[2]);
  const normalOf = (v) => tmpN.set(v.x, v.y + R, v.z).normalize().clone();
  const frameOfCell = (ci) => {
    const c = planet.graph.centers[ci];
    const f = planet.worldToFrame([c[0] * R, c[1] * R - R, c[2] * R]);
    return [f[0], f[2]];
  };

  /* --- the HUD ----------------------------------------------------------- */
  hud.innerHTML = '<div class="laser-lines">'
    + '<b>ORBITAL LASER</b>'
    + '<span id="laser-state">AWAY</span>'
    + '<span class="laser-bar"><i id="laser-window"></i></span>'
    + '<span id="laser-energy-label">ENERGY</span>'
    + '<span class="laser-bar"><i id="laser-energy"></i></span>'
    + '<span id="laser-read">—</span>'
    + '<span id="laser-lost" hidden>COLONY LOST</span>'
    + '</div>'
    + '<div class="laser-keys"><button id="laser-pass" type="button">PASS NOW</button>'
    + '<button id="laser-reset" type="button">RESET</button>'
    + '<span>hold the pointer in the inset to burn</span></div>';
  const elState = hud.querySelector('#laser-state'), elWindow = hud.querySelector('#laser-window');
  const elEnergy = hud.querySelector('#laser-energy'), elRead = hud.querySelector('#laser-read');
  const elLost = hud.querySelector('#laser-lost'), elEnergyLabel = hud.querySelector('#laser-energy-label');
  const style = document.createElement('style');
  /* the canvas fills the tab the way every other lab's does (styles.css #story-app), injected so the lab owns it */
  style.textContent = '#laser-app{position:absolute;inset:0}'
    + '#laser-app canvas{display:block;width:100%;height:100%}'
    + '#laser-hud{position:absolute;left:0;top:0;right:0;padding:10px 14px;pointer-events:none;'
    + 'font:12px ui-monospace,Menlo,monospace;letter-spacing:1px;color:#dfe8ee;text-transform:uppercase}'
    + '#laser-hud .laser-lines{display:flex;gap:14px;align-items:center;flex-wrap:wrap}'
    + '#laser-hud .laser-bar{display:inline-block;width:120px;height:6px;border:1px solid #6d7b85;background:#0b0f12}'
    + '#laser-hud .laser-bar i{display:block;height:100%;width:0;background:#dfe8ee}'
    + '#laser-hud .laser-bar i.hot{background:#8e8983}'
    + '#laser-hud #laser-lost{color:#fff;border:1px solid #fff;padding:1px 6px}'
    + '#laser-hud .laser-keys{margin-top:8px;display:flex;gap:10px;align-items:center;pointer-events:auto}'
    + '#laser-hud button{font:inherit;color:inherit;background:#0b0f12;border:1px solid #6d7b85;padding:3px 10px;cursor:pointer}';
  root.appendChild(style);

  function paintHud() {
    const p = laserProgress(st, orbit(), beamCfg());
    const word = st.phase === 'overhead' ? (st.energy > 0 ? 'OVERHEAD' : 'OUT') : 'AWAY';
    const line = `${word} · ${Math.ceil(st.left).toString().padStart(2, '0')}`;
    if (elState.textContent !== line) elState.textContent = line;
    elWindow.style.width = `${Math.round(p.pass * 100)}%`;
    elEnergy.style.width = `${Math.round(p.energy * 100)}%`;
    elEnergy.classList.toggle('hot', st.energy <= 0);
    const label = st.energy <= 0 ? 'OUT' : 'ENERGY';
    if (elEnergyLabel.textContent !== label) elEnergyLabel.textContent = label;
    const read = `bodies ${run.bodies} · walls ${run.walls} · towers ${run.towers} · sinkhole ${sealed ? 'SEALED' : 'OPEN'}`
      + ` · stalheart ${run.heart} · ${st.energy.toFixed(1)} s left`;
    if (elRead.textContent !== read) elRead.textContent = read;
    elLost.hidden = run.heart !== 'LOST';
  }

  /* --- the trench --------------------------------------------------------- */
  // A strip cut into the frame: floor at -TRENCH_DEPTH, two inner faces up to ground level. Built from the sphere's
  // own frame, so it follows the curvature the same way the base does.
  function buildTrench(from, to) {
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const length = Math.hypot(dx, dz) || 1;
    const dir = [dx / length, dz / length], side = [-dir[1], dir[0]];
    const steps = Math.max(8, Math.round(length / 4));
    const half = TRENCH_WIDTH / 2;
    const pos = [], idx = [];
    const push = (x, z, y) => {
      const w = planet.frameToWorld([x, y, z]);
      pos.push(w[0], w[1], w[2]);
      return pos.length / 3 - 1;
    };
    const rows = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * length;
      const cx = from[0] + dir[0] * t, cz = from[1] + dir[1] * t;
      rows.push([
        push(cx + side[0] * half, cz + side[1] * half, 0.05),
        push(cx + side[0] * half, cz + side[1] * half, -TRENCH_DEPTH),
        push(cx - side[0] * half, cz - side[1] * half, -TRENCH_DEPTH),
        push(cx - side[0] * half, cz - side[1] * half, 0.05),
      ]);
    }
    for (let i = 0; i < steps; i++) {
      const a = rows[i], b = rows[i + 1];
      for (const [p, e] of [[0, 1], [1, 2], [2, 3]]) {
        idx.push(a[p], a[e], b[e], a[p], b[e], b[p]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'Trench';
    scene.add(mesh);
    return { mesh, from, dir, length, floorY: -TRENCH_DEPTH };
  }

  const trenchPoint = (s) => {
    const t = Math.max(0, Math.min(trench.length, s));
    return toWorld([trench.from[0] + trench.dir[0] * t, trench.floorY + 0.6, trench.from[1] + trench.dir[1] * t]);
  };

  /* --- the bodies --------------------------------------------------------- */
  function seatBody(b) {
    const w = trenchPoint(b.s);
    b.pos = [w.x, w.y, w.z];
    if (!b.obj) return;
    b.obj.position.copy(w);
    b.obj.quaternion.setFromUnitVectors(Y, normalOf(w));
  }

  function buildBodies() {
    for (const b of bodies) if (b.obj) { scene.remove(b.obj); b.obj.geometry.dispose(); b.obj.material.dispose(); }
    bodies = [];
    for (let i = 0; i < BODIES; i++) {
      const type = BODY_TYPES[i % BODY_TYPES.length];
      let obj = null;
      try { obj = makeDotEnemy(type, BODY_COLS, 1); } catch (e) { errors.push(`body ${i}: ${e}`); }
      if (obj) { obj.scale.setScalar(1.7); scene.add(obj); }
      const b = { id: `body-${i}`, type, obj, alive: true, s: trench.length - 4 - i * BODY_GAP, pos: [0, 0, 0] };
      b.s = Math.max(0, b.s);
      seatBody(b);
      bodies.push(b);
    }
  }

  function stepBodies(dt, now) {
    let ahead = trench.length;
    for (const b of bodies) {
      if (!b.alive) continue;
      stampScare(b, now);
      const pace = scarePace(b, now, SCARE_FREEZE_S);
      const dir = isScared(b, now) ? -1 : 1;
      b.s = Math.max(0, Math.min(ahead, b.s + dir * BODY_SPEED * pace * dt));
      ahead = Math.max(0, b.s - BODY_GAP);
      seatBody(b);
      b.obj?.userData.tick?.(clock);
    }
  }

  function burstAt(point, colorHex) {
    const b = makeDotBurst(colorHex, normalOf(point).toArray(), 36);
    b.position.copy(point);
    b.scale.setScalar(1.4);
    scene.add(b);
    bursts.push(b);
  }

  function stepBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      if (bursts[i].userData.tick?.(dt) === false) {
        scene.remove(bursts[i]);
        bursts[i].geometry.dispose();
        bursts[i].material.dispose();
        bursts.splice(i, 1);
      }
    }
  }

  /* --- explosions and the scare -------------------------------------------- */
  function fire(use, point) {
    const centred = toCentre(point);
    const sc = EXPLOSION_SCARE[use];
    if (sc) applyScare(bodies, [point.x, point.y, point.z], { radius: sc.cells * cellSide, seconds: sc.seconds });
    return explosions ? explosions.spawn(use, centred, norm3(centred), cellSide) : false;
  }

  /* --- the world ----------------------------------------------------------- */
  async function build() {
    planet = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, planetBake());
    R = planet.radius;
    cellSide = planet.cellMetres;
    sphere = new THREE.Sphere(new THREE.Vector3(0, -R, 0), R);
    planetMesh = buildStoryPlanetMesh(planet, look, { wallMetres: STORY_RECIPE.wallMetres });
    scene.add(planetMesh);
    north.copy(toWorld([0, 0, -1])).sub(toWorld([0, 0, 0])).normalize();

    sphereRoot = new THREE.Group();
    sphereRoot.name = 'Planet-centred effects';
    sphereRoot.position.set(0, -R, 0);
    scene.add(sphereRoot);
    explosions = createExplosions(sphereRoot, { onError: (e) => errors.push(`explosions: ${e.message}`) });
    rubble = createBreachRubble(sphereRoot);

    const LAYOUT = { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES };
    plan = planBase(planet, LAYOUT, STAGE);
    base = createStoryBase(scene, {
      plan, placer: { toWorld }, metres: 1, kit: KIT, skip: ['sh02'], sfx: null,
    });
    await base.ready;
    for (const e of base.errors) errors.push(`base: ${e}`);

    /* the wall instances, by name off the base's group: createStoryBase does not return them */
    wallMeshes = base.group.children.filter((o) => o.isInstancedMesh && o.name === 'walls');
    wallCells = plan.walls.map((w, k) => ({
      id: `wall-${k}`, index: k, gone: false, p: toWorld([w.x, KIT.wallMetres / 2, w.z]),
    }));

    /* the structures the beam can take, by their holder */
    structs = [];
    for (const s of plan.structures) {
      const rec = base.structure(s.id);
      if (!rec || !rec.holder) continue;
      structs.push({
        id: s.id, holder: rec.holder, root: rec.root, gone: false,
        heart: s.id === 'stalheart', p: toWorld([s.x, 4, s.z]),
      });
    }

    /* the two sentries on their story sockets */
    for (let i = 0; i < SENTRIES.length; i++) {
      const socket = plan.sockets[i];
      if (!socket) continue;
      const [name, url] = SENTRIES[i];
      const glb = await loadGlbWithClips(url);
      if (!glb) { errors.push(`${name}: model missing`); continue; }
      const obj = glb.scene.clone(true);
      obj.scale.setScalar(3);
      const w = new THREE.Vector3(socket.pos[0] * R, socket.pos[1] * R - R, socket.pos[2] * R);
      const n = normalOf(w);
      obj.position.copy(w).addScaledVector(n, KIT.wallMetres);
      obj.quaternion.setFromUnitVectors(Y, n);
      scene.add(obj);
      sentries.push({ id: `sentry-${name}`, obj });
      structs.push({ id: `sentry-${name}`, holder: obj, root: obj, gone: false, heart: false, p: obj.position.clone() });
    }

    /* the trench: from the sinkhole's cell up the sightline to the gate */
    const holeF = plan.cells.fodder >= 0 ? frameOfCell(plan.cells.fodder) : [0, -240];
    const gateF = plan.gate ? [plan.gate.x, plan.gate.z] : [0, -120];
    trench = buildTrench(holeF, gateF);
    trenchMesh = trench.mesh;
    buildBodies();

    /* the sinkhole at the far end, standing on the planet, opened */
    sink = createSinkhole(sphereRoot, ground, { game: true });
    const holeW = toWorld([holeF[0], 0, holeF[1]]);
    const holeN = normalOf(holeW);
    sink.group.position.set(holeW.x, holeW.y + R, holeW.z);
    sink.group.quaternion.setFromUnitVectors(Y, holeN);
    sink.group.visible = true;
    sink.tune.planetRadius = R;
    sink.tune.sound = false;
    sinkPoint = holeW.clone();

    laser = createOrbitalLaser(scene, { cellSide, metresPerCell: 10 });
    thermal = createThermalHeat(() => ({ warm: [], hot: hotRoots() }), { every: 250 });

    frameGround(trenchPoint(trench.length * 0.5));
    ready = true;
  }

  let sinkPoint = new THREE.Vector3();

  function hotRoots() {
    const out = [];
    for (const id of st.contacts.keys()) {
      const s = structs.find((x) => x.id === id);
      if (s && !s.gone) out.push(s.root ?? s.holder);
    }
    return out;
  }

  /* --- the two cameras ------------------------------------------------------ */
  function frameGround(point) {
    const n = normalOf(point);
    /* behind the contact along the trench, so the column is always framed with the trench it is cutting */
    const back = tmpA.set(-trench.dir[0], 0, -trench.dir[1]);
    const backW = toWorld([trench.from[0] + back.x, 0, trench.from[1] + back.z]).sub(toWorld([trench.from[0], 0, trench.from[1]])).normalize();
    ground.position.copy(point).addScaledVector(backW, P.groundBack).addScaledVector(n, P.groundUp);
    ground.up.copy(n);
    ground.lookAt(point);
  }

  function frameSat(point) {
    const n = normalOf(point);
    sat.fov = P.fov;
    sat.position.copy(n).multiplyScalar(R * (1 + P.altitude)).add(tmpB.set(0, -R, 0));
    sat.up.copy(north);
    sat.lookAt(point);
    sat.updateProjectionMatrix();
  }

  function insetRect() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    if (h > w) return { x: 0, y: 0, w, h: Math.round(h * 0.4) };      /* portrait: a band across the top */
    const s = Math.round(w * P.inset);
    return { x: w - s - 12, y: h - s - 12, w: s, h: s };
  }

  // screen-to-sphere on the FAR camera: the inset is the only surface that steers
  function targetFromInset(nx, ny) {
    ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, 1 - ny * 2), sat);
    const hit = ray.ray.intersectSphere(sphere, new THREE.Vector3());
    return hit;
  }

  function onPointer(e) {
    const r = insetRect(), box = renderer.domElement.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    steering = x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (!steering) return;
    steerN = [(x - r.x) / r.w, (y - r.y) / r.h];
    if (e.type === 'pointerdown') held = true;
    e.preventDefault();
  }
  const onPointerUp = () => { held = false; };
  renderer.domElement.addEventListener('pointermove', onPointer, { passive: false });
  renderer.domElement.addEventListener('pointerdown', onPointer, { passive: false });
  addEventListener('pointerup', onPointerUp);
  addEventListener('pointercancel', onPointerUp);

  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    ground.aspect = w / h;
    ground.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  function render() {
    const dpr = renderer.getPixelRatio();
    const cr = renderer.domElement.getBoundingClientRect();
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cr.width * dpr, cr.height * dpr);
    renderer.render(scene, ground);
    const r = insetRect();
    const x = r.x * dpr, y = (cr.height - r.y - r.h) * dpr, w = r.w * dpr, h = r.h * dpr;   /* GL y runs from the bottom */
    sat.aspect = r.w / r.h;
    sat.updateProjectionMatrix();
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.clear(true, true, false);
    renderer.render(scene, sat);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cr.width * dpr, cr.height * dpr);
    renderer.autoClear = true;
  }

  function loop() {
    if (!active || disposed) return;
    frameId = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    if (!ready) { renderer.render(scene, ground); return; }
    step(dt);
    render();
  }

  /* --- what is under the beam ---------------------------------------------- */
  // Everything inside the footprint, tagged with the kind whose burn seconds apply. The domain module does the
  // accounting; this only answers "what is standing here right now".
  function collect(point) {
    const out = [], r = P.radius, r2 = r * r;
    const near = (p) => {
      const dx = p.x - point.x, dy = p.y - point.y, dz = p.z - point.z;
      return dx * dx + dy * dy + dz * dz <= r2;
    };
    for (const b of bodies) {
      if (!b.alive) continue;
      tmpA.set(b.pos[0], b.pos[1], b.pos[2]);
      if (near(tmpA)) out.push({ id: b.id, kind: 'soft', pos: b.pos, body: b });
    }
    for (const w of wallCells) {
      if (w.gone || !near(w.p)) continue;
      out.push({ id: w.id, kind: 'wall', pos: [w.p.x, w.p.y, w.p.z], wall: w });
    }
    for (const s of structs) {
      if (s.gone || !near(s.p)) continue;
      out.push({ id: s.id, kind: s.heart ? 'heart' : 'tower', pos: [s.p.x, s.p.y, s.p.z], struct: s });
    }
    if (!sealed && near(sinkPoint)) {
      out.push({ id: 'sinkhole', kind: 'seal', pos: [sinkPoint.x, sinkPoint.y, sinkPoint.z], sink: true });
    }
    return out;
  }

  /* --- the destruction reads ------------------------------------------------ */
  // A wall cell burns out: its instance drops out of every wall InstancedMesh (a zero matrix), a dot burst marks it,
  // and the gap is permanent. A structure hides its holder. The Stalheart does that and ends the colony. The
  // sinkhole takes the rubble cap. None of this touches the game's own breach or tower paths.
  const ZERO = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

  function destroy(entry) {
    const thing = entry.thing;
    if (thing.body) {
      thing.body.alive = false;
      if (thing.body.obj) thing.body.obj.visible = false;
      burstAt(tmpA.set(thing.pos[0], thing.pos[1], thing.pos[2]).clone(), 0xdfe8ee);
      run.bodies++;
      return;
    }
    if (thing.wall) {
      thing.wall.gone = true;
      for (const mesh of wallMeshes) {
        mesh.setMatrixAt(thing.wall.index, ZERO);
        mesh.instanceMatrix.needsUpdate = true;
      }
      burstAt(thing.wall.p.clone(), 0x8e8983);
      fire('laser.ignite', thing.wall.p);
      run.walls++;
      return;
    }
    if (thing.struct) {
      thing.struct.gone = true;
      thing.struct.holder.visible = false;
      burstAt(thing.struct.p.clone(), 0xdfe8ee);
      fire('laser.ignite', thing.struct.p);
      if (thing.struct.heart) { run.heart = 'LOST'; } else { run.towers++; }
      return;
    }
    if (thing.sink) {
      sealed = true;
      try { rubble.add(sink.group, sink.tune.craterRadius ?? 6); } catch (e) { errors.push(`rubble: ${e.message}`); }
      sink.group.visible = false;
      fire('laser.ignite', sinkPoint);
      run.sealed++;
    }
  }

  /* --- the beam, per frame -------------------------------------------------- */
  function applyBurn(dt) {
    const hit = steering || held ? targetFromInset(steerN[0], steerN[1]) : null;
    if (hit) aimLaser(st, toCentre(hit), dt, beamCfg());
    const burning = burnLaser(st, held, dt);
    const point = st.contact ? fromCentre(st.contact) : null;
    if (!burning || !point) {
      if (burningWas) { laser.lift(); thermal.set(false); }
      burningWas = false;
      contactTimer = 0;
      return;
    }
    const n = normalOf(point);
    if (!burningWas) {
      laser.lay(point, n);
      fire('laser.ignite', point);
      thermal.set(true);
      contactTimer = 0;
    } else {
      laser.aim(point, n);
    }
    burningWas = true;
    /* the contact sheds pops at LASER_CONTACT_RATE per second while it burns */
    contactTimer += dt;
    const every = 1 / LASER_CONTACT_RATE;
    while (contactTimer >= every) { contactTimer -= every; fire('laser.contact', point); }
    for (const entry of burnContacts(st, collect(point), dt, burnCfg())) destroy(entry);
  }

  function step(dt) {
    const edge = stepLaser(st, dt, orbit(), beamCfg());
    if (edge === 'close') laser.lift();
    /* the sinkhole opens itself once its stone textures are in: nothing else polls it here */
    if (!sinkOpened && !sealed && sink.ready()) { sink.trigger(); sinkOpened = true; }
    applyBurn(dt);
    stepBodies(dt, clock);
    stepBursts(dt);
    explosions?.tick(dt);
    sink?.update(dt, clock);
    base?.tick(dt, null, false, ground.position);
    laser.tick(dt, laserProgress(st, orbit(), beamCfg()).energy);
    const anchor = st.contact ? fromCentre(st.contact) : trenchPoint(trench.length * 0.5);
    frameSat(anchor);
    frameGround(anchor);
    paintHud();
  }

  function passNow() {
    if (st.phase === 'overhead') return;
    stepLaser(st, st.left, orbit(), beamCfg());
  }

  const api = {
    setActive(on) {
      active = on;
      if (on) { resize(); last = performance.now(); loop(); } else cancelAnimationFrame(frameId);
    },
    dispose() {
      if (disposed) return;
      disposed = true; active = false;
      cancelAnimationFrame(frameId);
      removeEventListener('resize', resize);
      removeEventListener('pointerup', onPointerUp);
      removeEventListener('pointercancel', onPointerUp);
      thermal?.dispose();
      laser?.dispose();
      sink?.dispose();
      rubble?.dispose();
      explosions?.dispose();
      base?.dispose();
      planetMesh?.userData.dispose?.();
      if (trenchMesh) { scene.remove(trenchMesh); trenchMesh.geometry.dispose(); trenchMesh.material.dispose(); }
      for (const b of bodies) if (b.obj) { scene.remove(b.obj); b.obj.geometry.dispose(); b.obj.material.dispose(); }
      for (const b of bursts) { scene.remove(b); b.geometry.dispose(); b.material.dispose(); }
      style.remove();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  hud.querySelector('#laser-pass').onclick = passNow;
  hud.querySelector('#laser-reset').onclick = () => { location.reload(); };
  resize();
  build().catch((e) => { errors.push(`build: ${e.message}`); });
  return api;
}
