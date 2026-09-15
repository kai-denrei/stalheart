// THE GUNSHIP LAB (owner, 2026-09-15: give the orbital laser's screen to its cousin the gunship, while keeping the
// gunship's thermal FLIR look). The real world full screen from a ground camera, and a round scope inset where the
// player aims, seen through the KORP heavy gunship's own optic: 340 m straight down, magnified per gun, in FLIR, night
// or plain day.
//
// The rules are the game's: src/domain/gunship.js with src/content/gunship.js decides cadence, heat, magazine, flight
// time and splash. The lab owns its world (the stage-6 story base, the trench and a swarm, like the laser lab), the
// aim, the impacts (explosions, scares and kills; the 105 also breaks rock and walls in its blast) and the scope.
//
// The same world as the laser lab is written again here rather than shared: pulling one world module out of both labs
// is the follow-up once both have had a browser round.
import * as THREE from '../../vendor/three.module.js';
import GUI from '../../vendor/lil-gui.esm.js';
import { LOOKS } from '../looks.js';
import { STORY_RECIPE, STORY_CLEARING } from '../content/story-defaults.js';
import { buildStoryPlanet } from '../domain/story-planet.js';
import { planetBake } from '../platform/planet-bake.js';
import { createStoryPlanetSurface } from './story-planet-mesh.js';
import { createInsetHud } from '../fx/laser-inset-hud.js';
import { planBase } from '../domain/base-plan.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../content/base-layout.js';
import { createStoryBase } from '../fx/story-base.js';
import { createExplosions } from '../fx/explosions.js';
import { EXPLOSION_SCARE, SCARE_FREEZE_S } from '../content/explosions.js';
import { applyScare, stampScare, isScared, scarePace } from '../domain/impact-scare.js';
import { makeDotEnemy, makeDotBurst } from '../units.js';
import { makeAudio } from '../audio.js';
import { GUNSHIP_ORBIT, GUNSHIP_PLATFORM, GUNSHIP_GUNS, GUNSHIP_GUN_ORDER } from '../content/gunship.js';
import {
  makeGunship, stepGunship, mountGunship, selectGun, stepGun, fireRound, stepRounds,
  paintHeavy, launchHeavy, stepHeavy, heavyState, splashDamage,
} from '../domain/gunship.js';
import { deepLink, wireDeepLink } from '../deeplink.js';
import { norm3 } from '../vec3.js';
import { BLOCKED, PATH, bfsDist } from '../dungeon.js';

const STAGE = 6;
const BODY_SPEED = 2.2, BODY_GAP = 3.4, TRENCH_WIDTH = 4, TRENCH_DEPTH = 1.5;
const CROWD_METRES = 160;
const BODY_TYPES = ['amoeba', 'phage'];
const BODY_COLS = { walker: 0xdfe8ee, walkerHi: 0xffffff };
const HEAVY_CENTRE_DAMAGE = 10;                    /* the 105 is the strike: src/strike.js dmgCenter */
const Y = new THREE.Vector3(0, 1, 0);
const MODES = ['thermal', 'night', 'normal'];
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/* the scope's FLIR: the game's own #flir colour table (index.html), eleven stops from cold to hot, in sRGB */
const FLIR = {
  r: [0.020, 0.114, 0.290, 0.541, 0.761, 0.910, 0.973, 0.988, 0.992, 1.000, 1.000],
  g: [0.008, 0.039, 0.043, 0.059, 0.114, 0.251, 0.439, 0.639, 0.827, 0.953, 1.000],
  b: [0.102, 0.369, 0.541, 0.604, 0.494, 0.290, 0.118, 0.063, 0.227, 0.604, 1.000],
};
const CYAN = 'rgb(98, 215, 255)', HOT = '#ff3b1f', WARN = '#ffb020', FG = '#dfe8ee';
const ZERO = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

export function initGunshipTab(root) {
  const q = new URLSearchParams(location.search);
  const container = root.querySelector('#gunship-app'), hudEl = root.querySelector('#gunship-hud');
  const look = LOOKS.tronColors;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.info.autoReset = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scopeHud = createInsetHud(container);
  /* the game's own sound definitions; armed now, so the first press into the scope is the gesture that starts audio */
  const sfx = makeAudio({ seed: 9, persist: false });
  sfx.arm();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.bg);
  scene.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]));
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]);
  sun.position.set(120, 260, 90);
  scene.add(sun);

  /* THE PANEL, and everything a shared link carries: only values that differ from these defaults go into the URL */
  const P = {
    gun: 'rotary', zoom: 0, mode: 'thermal', stationForever: true, enemies: 60,
    inset: 0.44, groundBack: 120, groundUp: 60, padSpeed: 150, rockLines: 'rim', sound: true,
  };
  const P0 = { ...P };
  for (const key of Object.keys(P)) {
    const v = q.get(key);
    if (v === null) continue;
    if (typeof P0[key] === 'number' && Number.isFinite(Number(v))) P[key] = Number(v);
    else if (typeof P0[key] === 'boolean') P[key] = v === '1' || v === 'true';
    else if (typeof P0[key] === 'string') P[key] = v;
  }
  if (!GUNSHIP_GUNS[P.gun]) P.gun = 'rotary';
  if (!MODES.includes(P.mode)) P.mode = 'thermal';
  if (!['all', 'rim', 'none'].includes(P.rockLines)) P.rockLines = 'rim';

  let active = false, disposed = false, frameId = 0, last = performance.now(), clock = 0, frameMs = 16.7;
  let planet = null, planetMesh = null, plan = null, base = null, sphereRoot = null, explosions = null;
  let wallMeshes = [], wallRest = [], wallCells = [], bodies = [], bursts = [], trench = null, trenchMesh = null;
  let trenchBack = new THREE.Vector3(0, 0, 1), crowdCells = null, rockTags0 = null, rockAnchors = new Set();
  let ready = false, R = 753, cellSide = 10, sphere = null;
  let held = false, steering = false, steerN = [0.5, 0.5], shot = 0, heavyPress = false, rotaryVoice = null;
  let lookPoint = null, aimPoint = null, flashT = 0, flashMsg = '';
  const north = new THREE.Vector3(0, 0, -1);
  const errors = [];
  const run = { kills: 0, rocks: 0, walls: 0, rounds: 0, shells: 0 };
  const perf = { fps: 0, ms: 0, draws: 0 };
  const gs = makeGunship(GUNSHIP_ORBIT, { station: true });
  mountGunship(gs);
  selectGun(gs, P.gun, GUNSHIP_GUNS);

  const ground = new THREE.PerspectiveCamera(52, 1, 0.5, 8000);
  const scopeCam = new THREE.PerspectiveCamera(30, 1, 1, 20000);
  const ray = new THREE.Raycaster();
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpN = new THREE.Vector3();
  const altitudeM = GUNSHIP_PLATFORM.altitudeCells * GUNSHIP_PLATFORM.metresPerCell;

  const toWorld = (p) => new THREE.Vector3(...planet.frameToWorld(p));
  const toCentre = (v) => [v.x, v.y + R, v.z];
  const fromCentre = (c) => new THREE.Vector3(c[0], c[1] - R, c[2]);
  const normalOf = (v) => tmpN.set(v.x, v.y + R, v.z).normalize().clone();
  const cellPoint = (ci) => { const c = planet.graph.centers[ci]; return new THREE.Vector3(c[0] * R, c[1] * R - R, c[2] * R); };
  const frameOfCell = (ci) => { const f = planet.worldToFrame(toCentre(cellPoint(ci)).map((v, i) => (i === 1 ? v - R : v))); return [f[0], f[2]]; };
  const gun = () => GUNSHIP_GUNS[gs.gun];
  const zoomOf = () => (P.zoom > 0 ? P.zoom : gun().zoom || GUNSHIP_PLATFORM.zoom);

  /* --- the HUD line and the lab's own styles ---------------------------------- */
  hudEl.innerHTML = '<div class="gunship-lines"><b>KORP GS01 · GUNSHIP LAB</b><span id="gunship-perf"></span><span id="gunship-flash"></span></div>'
    + '<div class="gunship-keys">1 2 3 guns · hold in the scope to fire (105: click) · WASD pan · wheel zoom · M sensor</div>';
  const elPerf = hudEl.querySelector('#gunship-perf'), elFlash = hudEl.querySelector('#gunship-flash');
  const style = document.createElement('style');
  style.textContent = '#gunship-app{position:absolute;inset:0}'
    + '#gunship-app canvas{display:block;width:100%;height:100%}'
    + '#gunship-hud{position:absolute;left:0;top:0;right:auto;max-width:min(100%,860px);padding:10px 14px;pointer-events:none;'
    + 'font:12px ui-monospace,Menlo,monospace;letter-spacing:1px;color:#dfe8ee;text-transform:uppercase}'
    + '#gunship-hud .gunship-lines{display:flex;gap:14px;flex-wrap:wrap}'
    + '#gunship-hud .gunship-keys{margin-top:6px;opacity:.7;text-transform:none}';
  root.appendChild(style);
  function flash(msg) { flashMsg = msg; flashT = 2.5; }

  /* --- the world: the same planet, base, trench and swarm as the laser lab ---- */
  function cellAt(point) {
    const dir = normalOf(point), centers = planet.graph.centers;
    let best = 0, bestDot = -2;
    for (let ci = 0; ci < centers.length; ci++) {
      const c = centers[ci], d = c[0] * dir.x + c[1] * dir.y + c[2] * dir.z;
      if (d > bestDot) { bestDot = d; best = ci; }
    }
    return best;
  }

  // the ground at a point: the terrace floor, or the top of a rock cell
  function surfaceAt(point) {
    const ci = cellAt(point), dir = normalOf(point);
    let alt = 0;
    for (const vi of planet.mesh.quads[ci]) alt += planet.altitudeOf(vi) / 4;
    const h = alt + (planet.dungeon.tags[ci] === BLOCKED ? STORY_RECIPE.wallMetres : 0);
    return dir.multiplyScalar(R + h).add(tmpB.set(0, -R, 0));
  }

  function buildTrench(from, to) {
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const length = Math.hypot(dx, dz) || 1;
    const dir = [dx / length, dz / length], side = [-dir[1], dir[0]];
    const steps = Math.max(8, Math.round(length / 4)), half = TRENCH_WIDTH / 2;
    const pos = [], idx = [], rows = [];
    const push = (x, z, y) => { const w = planet.frameToWorld([x, y, z]); pos.push(w[0], w[1], w[2]); return pos.length / 3 - 1; };
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * length, cx = from[0] + dir[0] * t, cz = from[1] + dir[1] * t;
      rows.push([
        push(cx + side[0] * half, cz + side[1] * half, 0.05), push(cx + side[0] * half, cz + side[1] * half, -TRENCH_DEPTH),
        push(cx - side[0] * half, cz - side[1] * half, -TRENCH_DEPTH), push(cx - side[0] * half, cz - side[1] * half, 0.05),
      ]);
    }
    for (let i = 0; i < steps; i++) {
      const a = rows[i], b = rows[i + 1];
      for (const [p, e] of [[0, 1], [1, 2], [2, 3]]) idx.push(a[p], a[e], b[e], a[p], b[e], b[p]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
    mesh.name = 'Trench';
    scene.add(mesh);
    return { mesh, from, dir, length, floorY: -TRENCH_DEPTH };
  }

  const queueTail = () => Math.max(0, trench.length - 4 - (19 * BODY_GAP));
  const trenchPoint = (s) => {
    const t = Math.max(0, Math.min(trench.length, s));
    return toWorld([trench.from[0] + trench.dir[0] * t, trench.floorY + 0.6, trench.from[1] + trench.dir[1] * t]);
  };

  function seatBody(b) {
    const w = trenchPoint(b.s);
    b.pos = [w.x, w.y, w.z];
    if (!b.obj) return;
    b.obj.position.copy(w);
    b.obj.quaternion.setFromUnitVectors(Y, normalOf(w));
  }

  function floorNearMouth() {
    if (crowdCells) return crowdCells;
    const mouth = normalOf(toWorld([trench.from[0], 0, trench.from[1]])), cosReach = Math.cos(CROWD_METRES / R);
    const tags = planet.dungeon.tags, centers = planet.graph.centers, out = [];
    for (let ci = 0; ci < centers.length; ci++) {
      const c = centers[ci];
      if (tags[ci] !== BLOCKED && c[0] * mouth.x + c[1] * mouth.y + c[2] * mouth.z >= cosReach) out.push(ci);
    }
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return (crowdCells = out);
  }

  // a single-file queue in the trench, then a crowd on floor near its mouth; every body takes one point of damage
  function buildBodies() {
    for (const b of bodies) if (b.obj) { scene.remove(b.obj); b.obj.geometry.dispose(); b.obj.material.dispose(); }
    bodies = [];
    const count = Math.max(1, Math.round(P.enemies));
    const queue = Math.min(count, Math.max(1, Math.floor((trench.length - 4) / BODY_GAP) + 1));
    const cells = count > queue ? floorNearMouth() : [];
    for (let i = 0; i < count; i++) {
      const type = BODY_TYPES[i % BODY_TYPES.length];
      let obj = null;
      try { obj = makeDotEnemy(type, BODY_COLS, 1); } catch (e) { errors.push(`body ${i}: ${e}`); }
      if (obj) { obj.scale.setScalar(1.7); scene.add(obj); }
      if (i < queue || !cells.length) {
        const b = { id: `body-${i}`, obj, alive: true, hp: 1, crowd: false, s: Math.max(0, trench.length - 4 - i * BODY_GAP), pos: [0, 0, 0] };
        seatBody(b);
        bodies.push(b);
        continue;
      }
      const ci = cells[(i - queue) % cells.length], c = planet.graph.centers[ci];
      let alt = 0;
      for (const vi of planet.mesh.quads[ci]) alt += planet.altitudeOf(vi) / 4;
      const n = new THREE.Vector3(c[0], c[1], c[2]).normalize();
      const across = new THREE.Vector3().crossVectors(n, north).normalize(), along = new THREE.Vector3().crossVectors(n, across);
      const spread = i - queue >= cells.length ? 3.5 : 0;
      const w = n.clone().multiplyScalar(R + alt + 0.6).add(tmpB.set(0, -R, 0))
        .addScaledVector(across, (Math.random() - 0.5) * 2 * spread).addScaledVector(along, (Math.random() - 0.5) * 2 * spread);
      if (obj) { obj.position.copy(w); obj.quaternion.setFromUnitVectors(Y, n); }
      bodies.push({ id: `body-${i}`, obj, alive: true, hp: 1, crowd: true, s: 0, pos: [w.x, w.y, w.z] });
    }
  }

  function stepBodies(dt, now) {
    let ahead = trench.length;
    for (const b of bodies) {
      if (!b.alive) continue;
      if (b.crowd) { b.obj?.userData.tick?.(clock); continue; }
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
        scene.remove(bursts[i]); bursts[i].geometry.dispose(); bursts[i].material.dispose(); bursts.splice(i, 1);
      }
    }
  }

  function fire(use, point) {
    const centred = toCentre(point), sc = EXPLOSION_SCARE[use];
    if (sc) applyScare(bodies, [point.x, point.y, point.z], { radius: sc.cells * cellSide, seconds: sc.seconds });
    return explosions ? explosions.spawn(use, centred, norm3(centred), cellSide) : false;
  }

  async function build() {
    planet = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, planetBake());
    R = planet.radius;
    cellSide = planet.cellMetres;
    sphere = new THREE.Sphere(new THREE.Vector3(0, -R, 0), R);
    planetMesh = createStoryPlanetSurface(planet, look, { wallMetres: STORY_RECIPE.wallMetres, rockLines: P.rockLines });
    scene.add(planetMesh);
    north.copy(toWorld([0, 0, -1])).sub(toWorld([0, 0, 0])).normalize();
    sphereRoot = new THREE.Group();
    sphereRoot.name = 'Planet-centred effects';
    sphereRoot.position.set(0, -R, 0);
    scene.add(sphereRoot);
    explosions = createExplosions(sphereRoot, { onError: (e) => errors.push(`explosions: ${e.message}`) });

    plan = planBase(planet, { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES }, STAGE);
    /* THE GROUND UNDER A LANDED ROCKET IS FLOOR (owner, 2026-09-15: the rockets on rock). The game's story world opens
       plan.open, every cell within each landing site's clear radius and the long sightline to the sinkhole, before it
       builds the base (src/platform/story-world.js); the lab now does the same, patches those cells into the surface, and
       re-lays the route field so the swarm walks over the opened ground. Wall cells stay the lab's own kit pieces. */
    const opened = plan.open.filter((ci) => planet.dungeon.tags[ci] === BLOCKED);
    for (const ci of plan.open) planet.dungeon.tags[ci] = PATH;
    if (opened.length) planetMesh.userData.refreshCells(opened);
    planet.dungeon.distToHeart = bfsDist(planet.graph.adj, [planet.dungeon.heart], (i) => planet.dungeon.tags[i] !== BLOCKED);
    base = createStoryBase(scene, { plan, placer: { toWorld }, metres: 1, kit: KIT, skip: ['sh02'], sfx: null });
    await base.ready;
    for (const e of base.errors) errors.push(`base: ${e}`);
    wallMeshes = base.group.children.filter((o) => o.isInstancedMesh && o.name === 'walls');
    wallRest = wallMeshes.map((m) => m.instanceMatrix.array.slice());
    wallCells = plan.walls.map((w, k) => ({ index: k, gone: false, p: toWorld([w.x, KIT.wallMetres / 2, w.z]) }));
    rockTags0 = Uint8Array.from(planet.dungeon.tags);
    rockAnchors = new Set([...plan.structures, ...(plan.sockets || [])].map((s) => s.cell).filter((c) => Number.isInteger(c) && c >= 0));

    const holeF = plan.cells.fodder >= 0 ? frameOfCell(plan.cells.fodder) : [0, -240];
    const gateF = plan.gate ? [plan.gate.x, plan.gate.z] : [0, -120];
    trench = buildTrench(holeF, gateF);
    trenchMesh = trench.mesh;
    trenchBack = toWorld([trench.from[0] - trench.dir[0], 0, trench.from[1] - trench.dir[1]])
      .sub(toWorld([trench.from[0], 0, trench.from[1]])).normalize();
    buildBodies();
    lookPoint = surfaceAt(trenchPoint(queueTail()));
    aimPoint = lookPoint.clone();
    ready = true;
  }

  /* --- cameras ---------------------------------------------------------------- */
  // the player's forward: the ground camera's, laid on the ground; the scope is heading-up along it and WASD follows it
  function viewForward(point) {
    const n = normalOf(point), f = trenchBack.clone().multiplyScalar(-1);
    f.addScaledVector(n, -f.dot(n));
    if (f.lengthSq() < 1e-8) f.copy(north).addScaledVector(n, -north.dot(n));
    return f.normalize();
  }

  function frameGround(point) {
    const n = normalOf(point), back = viewForward(point).multiplyScalar(-1);
    ground.position.copy(point).addScaledVector(back, P.groundBack).addScaledVector(n, P.groundUp);
    ground.up.copy(n);
    ground.lookAt(point);
  }

  // the gunship's optic: straight down from 340 m over the look point, 60 / zoom degrees
  function frameScope(point) {
    const n = normalOf(point);
    scopeCam.fov = 60 / zoomOf();
    scopeCam.position.copy(point).addScaledVector(n, altitudeM);
    scopeCam.up.copy(viewForward(point));
    scopeCam.lookAt(point);
    scopeCam.updateProjectionMatrix();
  }

  const INSET_LEFT = 64;
  function insetRect() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    if (h > w) { const s = Math.min(w, Math.round(h * 0.4)); return { x: Math.round((w - s) / 2), y: 0, w: s, h: s }; }
    const s = Math.min(Math.round(w * P.inset), h - 24);
    return { x: INSET_LEFT, y: h - s - 12, w: s, h: s };
  }

  function targetFromInset(nx, ny) {
    ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, 1 - ny * 2), scopeCam);
    return ray.ray.intersectSphere(sphere, new THREE.Vector3());
  }

  /* --- the round scope: the optic's view through a lens, in FLIR, night or day ---- */
  const scopeTarget = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  const lensScene = new THREE.Scene(), lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const lensMat = new THREE.ShaderMaterial({
    uniforms: {
      tView: { value: scopeTarget.texture },
      uMode: { value: 2 },
      uFlirR: { value: FLIR.r }, uFlirG: { value: FLIR.g }, uFlirB: { value: FLIR.b },
    },
    vertexShader: 'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `#include <common>
uniform sampler2D tView;
uniform int uMode;
uniform float uFlirR[11];
uniform float uFlirG[11];
uniform float uFlirB[11];
varying vec2 vUv;
float stops(float v, float t[11]){
  float x = clamp(v, 0.0, 1.0) * 10.0;
  int i = int(floor(x));
  int j = min(i + 1, 10);
  return mix(t[i], t[j], x - float(i));
}
void main(){
  float r = length(vUv - 0.5) * 2.0;
  if (r > 1.0) discard;
  vec3 srgb = pow(max(texture2D(tView, vUv).rgb, 0.0), vec3(1.0 / 2.2));
  float lum = dot(srgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 view = srgb;
  if (uMode == 2) view = vec3(stops(lum, uFlirR), stops(lum, uFlirG), stops(lum, uFlirB));
  else if (uMode == 1) view = vec3(clamp((lum * 0.62 - 0.5) * 1.7 + 0.5, 0.0, 1.0));
  float rim = 1.0 - 0.5 * smoothstep(0.62, 1.0, r);
  gl_FragColor = vec4(pow(view, vec3(2.2)) * rim, 1.0);
  #include <colorspace_fragment>
}`,
    depthTest: false, depthWrite: false,
  });
  const lensGeo = new THREE.PlaneGeometry(2, 2);
  lensScene.add(new THREE.Mesh(lensGeo, lensMat));

  function render() {
    const cr = renderer.domElement.getBoundingClientRect();
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cr.width, cr.height);
    renderer.render(scene, ground);
    const r = insetRect();
    const px = Math.max(2, Math.round(r.w * renderer.getPixelRatio()));
    if (scopeTarget.width !== px) scopeTarget.setSize(px, px);
    scopeCam.aspect = 1;
    scopeCam.updateProjectionMatrix();
    renderer.setRenderTarget(scopeTarget);
    renderer.render(scene, scopeCam);
    renderer.setRenderTarget(null);
    lensMat.uniforms.uMode.value = P.mode === 'thermal' ? 2 : P.mode === 'night' ? 1 : 0;
    const y = cr.height - r.y - r.h;
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.setViewport(r.x, y, r.w, r.h);
    renderer.setScissor(r.x, y, r.w, r.h);
    renderer.render(lensScene, lensCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cr.width, cr.height);
    renderer.autoClear = true;
  }

  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    ground.aspect = w / h;
    ground.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  /* --- input: the pointer aims inside the lens, WASD pans the scope, 1 2 3 guns, M sensor, wheel zoom ---- */
  function inLens(e) {
    const r = insetRect(), box = renderer.domElement.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    return { inside: Math.hypot(x - (r.x + r.w / 2), y - (r.y + r.h / 2)) <= r.w / 2, nx: (x - r.x) / r.w, ny: (y - r.y) / r.h };
  }
  function onPointer(e) {
    const { inside, nx, ny } = inLens(e);
    steering = inside;
    if (!inside) return;
    steerN = [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))];
    if (e.type === 'pointerdown') { held = true; if (gun().key === 'heavy') heavyPress = true; }
    e.preventDefault();
  }
  const onPointerUp = () => { held = false; };
  const onWheel = (e) => {
    if (!inLens(e).inside) return;
    P.zoom = Math.max(1, Math.min(5, zoomOf() * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    e.preventDefault();
  };
  renderer.domElement.addEventListener('pointermove', onPointer, { passive: false });
  renderer.domElement.addEventListener('pointerdown', onPointer, { passive: false });
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('pointerup', onPointerUp);
  addEventListener('pointercancel', onPointerUp);

  const keys = new Set();
  const PAN_KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  function chooseGun(key) {
    if (!selectGun(gs, key, GUNSHIP_GUNS)) return;
    P.gun = key;
    if (rotaryVoice) { rotaryVoice.stop(0.1); rotaryVoice = null; }
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    flash(`${GUNSHIP_GUNS[key].label} · ${GUNSHIP_GUNS[key].cue}`);
  }
  const onKeyDown = (e) => {
    if (!active || typing(e)) return;
    if (PAN_KEYS[e.code]) { keys.add(e.code); e.preventDefault(); return; }
    const pick = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
    if (pick !== undefined) { chooseGun(GUNSHIP_GUN_ORDER[pick]); e.preventDefault(); }
    if (e.code === 'KeyM') {
      P.mode = MODES[(MODES.indexOf(P.mode) + 1) % MODES.length];
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      e.preventDefault();
    }
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => keys.clear();
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);

  // slide the scope's look point across the ground, screen-relative; a pointer resting near the lens rim pans too
  function panLook(dx, dz, seconds) {
    if (!dx && !dz) return;
    const n = normalOf(lookPoint), forward = viewForward(lookPoint), right = new THREE.Vector3().crossVectors(forward, n);
    const len = Math.hypot(dx, dz) || 1, step = P.padSpeed * seconds / len;
    const moved = lookPoint.clone().addScaledVector(right, dx * step).addScaledVector(forward, dz * step);
    lookPoint = surfaceAt(fromCentre(norm3(toCentre(moved)).map((c) => c * R)));
  }
  function stepPan(dt) {
    let dx = 0, dz = 0;
    for (const code of keys) { dx += PAN_KEYS[code][0]; dz += PAN_KEYS[code][1]; }
    if (!dx && !dz && steering) {
      const ex = steerN[0] - 0.5, ey = 0.5 - steerN[1], edge = Math.hypot(ex, ey) * 2;
      if (edge > 0.82) { dx = ex / (edge / 2) * (edge - 0.82) * 3; dz = ey / (edge / 2) * (edge - 0.82) * 3; }
    }
    panLook(dx, dz, dt);
    if (steering) { const hit = targetFromInset(steerN[0], steerN[1]); if (hit) aimPoint = surfaceAt(hit); }
  }

  /* --- the guns and what they do when they land ------------------------------- */
  function breakGround(point, radiusM) {
    const dir = normalOf(point), cosReach = Math.cos(radiusM / R), centers = planet.graph.centers, tags = planet.dungeon.tags, opened = [];
    for (let ci = 0; ci < centers.length; ci++) {
      if (tags[ci] !== BLOCKED || rockAnchors.has(ci)) continue;
      const c = centers[ci];
      if (c[0] * dir.x + c[1] * dir.y + c[2] * dir.z >= cosReach) { tags[ci] = PATH; opened.push(ci); }
    }
    if (opened.length) { planetMesh.userData.refreshCells(opened); run.rocks += opened.length; }
    for (const w of wallCells) {
      if (w.gone || w.p.distanceTo(point) > radiusM) continue;
      w.gone = true;
      for (const m of wallMeshes) { m.setMatrixAt(w.index, ZERO); m.instanceMatrix.needsUpdate = true; }
      run.walls++;
    }
  }

  function impact(gunKey, point) {
    const g = GUNSHIP_GUNS[gunKey], blastM = g.blastCells * cellSide;
    fire(`gunship.${gunKey}`, point);
    const damage = gunKey === 'heavy' ? HEAVY_CENTRE_DAMAGE : g.damage;
    for (const b of bodies) {
      if (!b.alive) continue;
      const at = new THREE.Vector3(b.pos[0], b.pos[1], b.pos[2]);
      const hit = splashDamage(at.distanceTo(point), blastM, damage);
      if (hit <= 0) continue;
      b.hp -= hit;
      if (b.hp <= 0) { b.alive = false; if (b.obj) b.obj.visible = false; burstAt(at, 0xdfe8ee); run.kills++; }
    }
    if (gunKey === 'heavy') breakGround(point, blastM);
    if (P.sound) sfx.play(g.impact || 'blast_fire');
  }

  function stepGuns(dt) {
    if (P.stationForever) { gs.phase = 'station'; gs.left = GUNSHIP_ORBIT.station; }
    stepGunship(gs, dt, GUNSHIP_ORBIT);
    if (gs.phase === 'station' && !gs.mounted) mountGunship(gs);
    const g = gun();
    if (g.key === 'heavy') {
      stepGun(gs, dt, false, GUNSHIP_GUNS);                              /* heat and magazines recover meanwhile */
      /* one click paints and launches: the seat's paint-then-launch is two presses, the lab keeps one */
      if (heavyPress && aimPoint) {
        heavyPress = false;
        if (paintHeavy(gs, cellAt(aimPoint), GUNSHIP_GUNS) && launchHeavy(gs, GUNSHIP_GUNS) >= 0) {
          run.shells++;
          if (P.sound) sfx.play(g.sound);
        }
      }
      const landed = stepHeavy(gs);
      if (landed >= 0) impact('heavy', surfaceAt(cellPoint(landed)));
    } else {
      heavyPress = false;
      const n = stepGun(gs, dt, held && !!aimPoint, GUNSHIP_GUNS);
      for (let i = 0; i < n; i++) {
        /* the seat's spread: each round on a golden angle, inside half the blast */
        const k = shot++, blastM = g.blastCells * cellSide;
        const angle = k * GOLDEN, reach = 0.5 * blastM * Math.sqrt(((k % 13) + 0.5) / 13);
        const n0 = normalOf(aimPoint), forward = viewForward(aimPoint), right = new THREE.Vector3().crossVectors(forward, n0);
        const p = aimPoint.clone().addScaledVector(right, Math.cos(angle) * reach).addScaledVector(forward, Math.sin(angle) * reach);
        fireRound(gs, g.key, toCentre(surfaceAt(p)), g.travel);
        run.rounds++;
        if (g.key === 'bofors' && P.sound) sfx.play(g.sound);
      }
      const roaring = g.key === 'rotary' && held && !!aimPoint && !gs.overheated && P.sound;
      if (roaring) rotaryVoice ??= sfx.loop(g.sound);
      else if (rotaryVoice) { rotaryVoice.stop(0.15); rotaryVoice = null; }
    }
    for (const round of stepRounds(gs)) impact(round.gun, fromCentre(round.point));
  }

  /* --- the scope's reading ---------------------------------------------------- */
  function hudFrame() {
    const r = insetRect();
    const px = (v) => { const p = v.clone().project(scopeCam); return { x: r.x + (p.x + 1) / 2 * r.w, y: r.y + (1 - p.y) / 2 * r.h }; };
    const g = gun(), anchor = lookPoint, aim = aimPoint || lookPoint;
    const blastM = g.blastCells * cellSide;
    const aimPx = px(aim);
    const across = new THREE.Vector3().crossVectors(normalOf(aim), north).normalize();
    const edge = px(aim.clone().addScaledVector(across, blastM));
    const blastPx = Math.hypot(edge.x - aimPx.x, edge.y - aimPx.y);
    const dir = normalOf(anchor);
    const rangeM = scopeCam.position.distanceTo(aim);
    const northT = north.clone().addScaledVector(dir, -north.dot(dir)).normalize();
    const pc = px(anchor), pn = px(anchor.clone().addScaledVector(northT, 50));
    const hs = heavyState(gs, GUNSHIP_GUNS);
    const mag = gs.mag < 0 ? g.magazine : gs.mag;
    const reloading = g.key === 'bofors' && (gs.mag === 0 || gs.clock < gs.reloadUntil);
    const firing = held && steering && g.key !== 'heavy' && !(g.key === 'rotary' && gs.overheated) && !reloading;

    let status, tone;
    if (g.key === 'rotary') {
      status = gs.overheated ? 'OVERHEAT · COOLING' : firing ? 'FIRING · 25MM' : 'ROTARY · HOLD TO FIRE';
      tone = gs.overheated ? WARN : firing ? HOT : CYAN;
    } else if (g.key === 'bofors') {
      status = reloading ? `RELOADING ${Math.max(0, gs.reloadUntil - gs.clock).toFixed(1)} S` : `${firing ? 'FIRING' : 'BOFORS'} · MAG ${mag}/${g.magazine}`;
      tone = reloading ? WARN : firing ? HOT : CYAN;
    } else {
      status = hs.phase === 'falling' ? `SHELL FALLING ${hs.left.toFixed(1)} S` : hs.phase === 'reloading' ? `RELOADING ${hs.left.toFixed(1)} S` : 'READY · CLICK TO LAUNCH 105';
      tone = hs.phase === 'falling' ? HOT : hs.phase === 'reloading' ? WARN : CYAN;
    }

    const pending = gs.rounds.slice(-24).map((round) => ({
      ...px(fromCentre(round.point)), colour: 'rgba(255, 176, 32, 0.85)',
      label: g.key === 'bofors' ? Math.max(0, round.at - gs.clock).toFixed(1) : '',
    }));
    if (hs.phase === 'falling') pending.push({ ...px(surfaceAt(cellPoint(hs.ci))), colour: HOT, label: `105 · ${hs.left.toFixed(1)} S` });

    const gauge = g.key === 'rotary' ? { frac: gs.heat, colour: gs.overheated ? WARN : FG }
      : g.key === 'bofors' ? { frac: reloading ? 0 : mag / g.magazine, colour: reloading ? WARN : FG }
      : { frac: hs.phase === 'reloading' ? 1 - hs.left / g.reload : hs.phase === 'falling' ? 0 : 1, colour: hs.phase === 'ready' ? FG : WARN };
    const alive = bodies.filter((b) => b.alive).length;
    const inBlast = bodies.filter((b) => b.alive && aim.distanceTo(new THREE.Vector3(b.pos[0], b.pos[1], b.pos[2])) <= blastM).length;
    const lat = (Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI, lon = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;
    const gsd = (2 * Math.tan((scopeCam.fov * Math.PI) / 360) * altitudeM) / Math.max(1, r.h);
    const sensor = P.mode === 'thermal' ? 'FLIR · IRONBOW · WHITE HOT' : P.mode === 'night' ? 'LOW LIGHT · MONO' : 'DAY · COLOUR';

    return {
      rect: r, aim: aimPx, contact: aimPx, footprintPx: blastPx, lagM: 0, aiming: steering,
      limitM: 0, contactArcM: 0, aimArcM: 0, phase: 'overhead', infinite: true, left: 0, pass01: 1,
      energy: 1, energy01: 1, burning: firing || hs.phase === 'falling', speed: 0, slew: 0, radiusM: blastM,
      altitudeM, rangeM, fovDeg: scopeCam.fov, gsd, lat, lon, lensGroundM: Math.tan((scopeCam.fov * Math.PI) / 360) * altitudeM,
      northAngle: Math.atan2(pn.x - pc.x, -(pn.y - pc.y)),
      hud: {
        tone, status, statusColour: tone, pending,
        blocks: {
          row: [
            { title: 'OPTICS · KORP GS01', lines: [
              `ALT ${Math.round(altitudeM)} M  ZOOM ${zoomOf().toFixed(1)}X`,
              `FOV ${scopeCam.fov.toFixed(1)}°  GSD ${gsd.toFixed(2)} M/PX`,
              `RNG ${Math.round(rangeM)} M`,
              `LAT ${lat.toFixed(3)}°  LON ${lon.toFixed(3)}°`,
            ] },
            { title: 'SENSOR', lines: [
              { s: sensor, c: P.mode === 'thermal' ? WARN : FG },
              P.mode === 'thermal' ? 'LWIR 8-12 µm  NETD 30 mK' : 'EO  400-900 nm',
              `${inBlast} IN BLAST  Ø ${Math.round(blastM * 2)} M`,
            ] },
          ],
          column: [
            { title: `GUN · ${g.label}`, lines: [
              g.cue,
              `RATE ${g.rate ? `${g.rate}/S` : 'SINGLE'}  TOF ${g.travel.toFixed(1)} S`,
              `ROUNDS ${run.rounds}  105 ${run.shells}`,
            ], bars: [gauge] },
            { title: 'STATION', lines: [
              P.stationForever ? 'ON STATION  ∞' : gs.phase === 'station' ? `ON STATION ${Math.ceil(gs.left)} S` : `PASS IN ${Math.ceil(gs.left)} S`,
              `KILLS ${run.kills}  ALIVE ${alive}`,
              `ROCK ${run.rocks}  WALL ${run.walls}`,
              `IN THE AIR ${gs.rounds.length + (hs.phase === 'falling' ? 1 : 0)}`,
            ] },
          ],
        },
      },
    };
  }

  function paintHud() {
    const line = `fps ${perf.fps} · ${perf.ms.toFixed(1)} ms · ${perf.draws} draws · ${bodies.length} bodies`;
    if (elPerf.textContent !== line) elPerf.textContent = line;
    const note = flashT > 0 ? flashMsg : '';
    if (elFlash.textContent !== note) elFlash.textContent = note;
  }

  /* --- the frame, guarded: one failing stage records itself and the rest still draws ---- */
  const frameErrors = new Set();
  function guard(stage, fn) {
    try { fn(); } catch (e) {
      const message = `${stage}: ${e?.message || e}`;
      if (frameErrors.has(message)) return;
      frameErrors.add(message);
      if (errors.length < 50) errors.push(message);
      console.error(`GUNSHIPLAB frame error in ${message}`, e);
      flash(`error in ${message}`);
    }
  }

  function step(dt) {
    guard('pan', () => stepPan(dt));
    guard('guns', () => stepGuns(dt));
    guard('bodies', () => stepBodies(dt, clock));
    guard('bursts', () => stepBursts(dt));
    guard('explosions', () => explosions?.tick(dt));
    guard('base', () => base?.tick(dt, null, false, ground.position));
    guard('cameras', () => { frameGround(aimPoint || lookPoint); frameScope(lookPoint); });
    guard('hud', paintHud);
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
  }

  function loop() {
    if (!active || disposed) return;
    frameId = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    frameMs += ((now - last) - frameMs) * 0.1;
    last = now;
    perf.ms = frameMs;
    perf.fps = Math.round(1000 / Math.max(1, frameMs));
    perf.draws = renderer.info.render.calls;
    renderer.info.reset();
    clock += dt;
    if (!ready) { guard('loading', () => renderer.render(scene, ground)); return; }
    guard('step', () => step(dt));
    guard('render', render);
    guard('scope', () => scopeHud.draw(hudFrame(), dt));
  }

  // put targets back without a reload: wall cells, rock cells, a fresh swarm, the counters
  function revive() {
    if (!ready) return;
    wallMeshes.forEach((m, i) => { m.instanceMatrix.array.set(wallRest[i]); m.instanceMatrix.needsUpdate = true; });
    for (const w of wallCells) w.gone = false;
    const changed = [];
    for (let ci = 0; ci < rockTags0.length; ci++) if (planet.dungeon.tags[ci] !== rockTags0[ci]) changed.push(ci);
    planet.dungeon.tags.set(rockTags0);
    planetMesh.userData.refreshCells(changed);
    buildBodies();
    Object.assign(run, { kills: 0, rocks: 0, walls: 0, rounds: 0, shells: 0 });
    flash('targets revived');
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
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('blur', onBlur);
      rotaryVoice?.stop(0);
      sfx.dispose?.();
      scopeHud.dispose();
      scopeTarget.dispose();
      lensGeo.dispose();
      lensMat.dispose();
      explosions?.dispose();
      base?.dispose();
      planetMesh?.userData.dispose?.();
      if (trenchMesh) { scene.remove(trenchMesh); trenchMesh.geometry.dispose(); trenchMesh.material.dispose(); }
      for (const b of bodies) if (b.obj) { scene.remove(b.obj); b.obj.geometry.dispose(); b.obj.material.dispose(); }
      for (const b of bursts) { scene.remove(b); b.geometry.dispose(); b.material.dispose(); }
      gui?.destroy();
      if (window.__stalheartGunshipTest === hooks) delete window.__stalheartGunshipTest;
      style.remove();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  /* --- the panel -------------------------------------------------------------- */
  const gui = new GUI({ title: 'GUNSHIP', container: root });
  const gg = gui.addFolder('the guns');
  gg.add(P, 'gun', GUNSHIP_GUN_ORDER).name('gun (1 2 3)').onChange(chooseGun);
  gg.add(P, 'zoom', 0, 5, 0.1).name('zoom (0 = the gun’s own)');
  gg.add(P, 'mode', MODES).name('sensor (M)');
  gg.add(P, 'stationForever').name('on station forever');
  gg.add(P, 'sound').name('sound').onChange((on) => { if (!on && rotaryVoice) { rotaryVoice.stop(0.1); rotaryVoice = null; } });
  gg.open();
  const gw = gui.addFolder('the swarm');
  gw.add(P, 'enemies', 10, 1000, 10).name('enemies').onFinishChange(() => { if (ready) buildBodies(); });
  gw.open();
  const gv = gui.addFolder('the view');
  gv.add(P, 'inset', 0.15, 0.6, 0.01).name('scope (share of width)');
  gv.add(P, 'groundBack', 6, 120, 1).name('ground camera back (m)');
  gv.add(P, 'groundUp', 1, 60, 1).name('ground camera up (m)');
  gv.add(P, 'padSpeed', 10, 400, 5).name('WASD pan (m/s)');
  gv.add(P, 'rockLines', ['all', 'rim', 'none']).name('rock lines').onChange((m) => planetMesh?.userData.setRockLines?.(m));
  const actions = { revive, reset() { location.reload(); } };
  const ga = gui.addFolder('actions');
  ga.add(actions, 'revive').name('REVIVE TARGETS');
  ga.add(actions, 'reset').name('RESET');
  ga.open();

  wireDeepLink(root.querySelector('#gunship-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'gunship', params: P, defaults: P0, carry: location.search,
  }), { label: 'GUNSHIP', flash });

  /* --- the harness's hands ---------------------------------------------------- */
  const hooks = {
    state: () => ({
      ready, gun: gs.gun, mode: P.mode, zoom: zoomOf(), kills: run.kills, rocks: run.rocks, walls: run.walls,
      rounds: run.rounds, shells: run.shells, inAir: gs.rounds.length, heat: +gs.heat.toFixed(2), overheated: gs.overheated,
      mag: gs.mag, heavy: heavyState(gs, GUNSHIP_GUNS).phase, alive: bodies.filter((b) => b.alive).length,
      aim: aimPoint ? aimPoint.toArray().map((v) => +v.toFixed(2)) : null, perf: { ...perf }, errors: errors.slice(),
    }),
    aim: (nx, ny) => { steerN = [nx, ny]; steering = true; },
    hold: (on) => { held = !!on; if (on && gun().key === 'heavy') heavyPress = true; },
    gun: (key) => chooseGun(key),
    pan: (dx, dz, seconds) => panLook(dx, dz, seconds),
    revive,
    dispose: () => api.dispose(),
  };
  window.__stalheartGunshipTest = hooks;

  resize();
  build().catch((e) => { errors.push(`build: ${e.message}`); });
  return api;
}
