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
//
// THE RUBBLE IS STRICTER STILL. createBreachRubble writes its caps at radius 1 + height in the frame of the object it
// was handed, and it reads the cap's direction off source.matrixWorld.normalize(). So it wants two things the game
// gives it for free and the lab has to build: a host whose unit sphere IS the planet (`rubbleHost`, the planet centre
// scaled to R metres) and a source whose WORLD matrix is a place on a unit sphere about the origin (`rubbleFrame`, an
// unparented carrier — sink.group sits in metres and would put the cap near the planet's core).
import * as THREE from '../../vendor/three.module.js';
import GUI from '../../vendor/lil-gui.esm.js';
import { LOOKS } from '../looks.js';
import { STORY_RECIPE, STORY_CLEARING } from '../content/story-defaults.js';
import { buildStoryPlanet } from '../domain/story-planet.js';
import { planetBake } from '../platform/planet-bake.js';
import { createStoryPlanetSurface } from './story-planet-mesh.js';
import { createInsetHud } from './laser-inset-hud.js';
import { makeAudio } from '../audio.js';
import { createSol82Briefing } from '../fx/sol82-briefing.js';
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
import { LASER_ORBIT, LASER_BEAM, LASER_BURN, LASER_VIEW, LASER_PRESET, LASER_CONTACT_RATE, LASER_SMOKE_RATE, LASER_TELEMETRY, LASER_SOUNDS, LASER_AUDIO } from '../content/orbital-laser.js';
import { makeLaser, stepLaser, aimLaser, burnLaser, burnContacts, laserProgress, clampToRange } from '../domain/orbital-laser.js';
import { deepLink, wireDeepLink } from '../deeplink.js';
import { norm3 } from '../vec3.js';
import { BLOCKED, PATH } from '../dungeon.js';

const STAGE = 6;                                   /* the Stalheart's stage: the whole base stands */
const BODIES = 20;                                 /* the single-file queue in the trench (the --laser browser step burns these) */
const WALK_RING = [380, 600];                      /* arc metres from the base where the walking swarm spawns, beyond the range */
const ARRIVE_HOPS = 3;                             /* a walker this few cells from the heart has arrived, and respawns far out */
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
  renderer.info.autoReset = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  /* the satellite inset's sight and telemetry, a 2D canvas over the 3D one */
  const insetHud = createInsetHud(container);
  /* THE SOUND: only the laser's own definitions, not persisted. The context unlocks on the first pointer press (a
     gesture) after arm(); the burn loop is a handle held while the ground burns, retried each frame until its buffer has decoded */
  const sfx = makeAudio({ seed: 5, persist: false, sounds: LASER_AUDIO });
  /* armed now, as src/sinkhole.js does: arm() only listens, and the context is born on the NEXT gesture, so arming
     inside the first press would leave the first burn silent */
  sfx.arm();
  let burnVoice = null;
  const stopBurnVoice = (fade = 0.35) => { burnVoice?.stop(fade); burnVoice = null; };
  /* SOL-82's briefing: the combat satellite introduced the way the gunship is; once per browser, and on the HUD button */
  const briefing = createSol82Briefing(root);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.bg);
  scene.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]));
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]);
  sun.position.set(120, 260, 90);
  scene.add(sun);

  /* the panel's working copy of the content; the panel edits this, never the frozen tables */
  const P = {
    period: LASER_ORBIT.period, overhead: LASER_ORBIT.overhead,
    energy: LASER_BEAM.energy, radius: LASER_BEAM.radius, slew: LASER_BEAM.slew, accel: LASER_BEAM.accel, range: LASER_BEAM.range,
    /* the swarm: the trench queue, then walkers that come in from far away along the route field */
    enemies: 500,
    walkSpeed: 4,
    /* the range is feedback unless this holds the beam at it */
    holdRange: false,
    /* WASD / arrows pre-position the beam this fast (m/s) while it is not firing */
    padSpeed: 120,
    altitude: LASER_VIEW.altitude, fov: LASER_VIEW.fov, inset: LASER_VIEW.inset,
    groundBack: LASER_VIEW.groundBack, groundUp: LASER_VIEW.groundUp,
    burnSoft: LASER_BURN.soft, burnHard: LASER_BURN.hard, burnWall: LASER_BURN.wall,
    burnTower: LASER_BURN.tower, burnSeal: LASER_BURN.seal, burnHeart: LASER_BURN.heart, burnRock: LASER_BURN.rock,
    coreWidth: LASER_PRESET.coreWidth, glowWidth: LASER_PRESET.glowWidth,
    coreIntensity: LASER_PRESET.coreIntensity, glowIntensity: LASER_PRESET.glowIntensity,
    noiseAmount: LASER_PRESET.noiseAmount,
    /* debug: the satellite never leaves and the energy never drains, so a look can be judged without waiting or RESET */
    infinite: false,
    /* which rock tops carry their cell lines: all, rim (only where rock meets floor, one uniform mass) or none */
    rockLines: 'rim',
    /* the burning-ground loop; ?sound=0 turns it off */
    sound: true,
  };
  const P0 = { ...P };
  for (const key of Object.keys(P)) {
    const v = q.get(key);
    if (v !== null && Number.isFinite(Number(v))) P[key] = Number(v);
  }
  P.infinite = !!P.infinite;
  P.holdRange = !!P.holdRange;
  P.sound = !!P.sound;
  if (['all', 'rim', 'none'].includes(q.get('rockLines'))) P.rockLines = q.get('rockLines');
  /* what tune() takes: the column's live uniforms and the footprint ring */
  const lookOf = () => ({
    coreWidth: P.coreWidth, glowWidth: P.glowWidth, coreIntensity: P.coreIntensity,
    glowIntensity: P.glowIntensity, noiseAmount: P.noiseAmount, radius: P.radius,
  });
  const orbit = () => ({ period: P.period, overhead: P.overhead });
  const beamCfg = () => ({ energy: P.energy, radius: P.radius, slew: P.slew, accel: P.accel });
  const burnCfg = () => ({ soft: P.burnSoft, hard: P.burnHard, wall: P.burnWall, rock: P.burnRock, tower: P.burnTower, seal: P.burnSeal, tank: LASER_BURN.tank, heart: P.burnHeart });

  let active = false, disposed = false, frameId = 0, last = performance.now(), clock = 0;
  let planet = null, planetMesh = null, plan = null, base = null, sphereRoot = null;
  let explosions = null, rubble = null, sink = null, laser = null, thermal = null;
  let wallMeshes = [], wallCells = [], structs = [], sentries = [];
  /* each wall mesh's instance matrices as built, so REVIVE can put burned cells back without a reload */
  let wallRest = [];
  let bodies = [], bursts = [], trench = null, trenchMesh = null;
  /* the world direction that walks back down the trench, measured at its mouth; frameGround tips it onto the tangent
     plane wherever it is framing */
  let trenchBack = new THREE.Vector3(0, 0, 1);
  let ready = false, held = false, burningWas = false, contactTimer = 0, smokeTimer = 0, sealed = false, sinkOpened = false;
  /* what stood in the footprint on the last burning frame, by kind: the HUD shows it so a burn that takes nothing says so */
  const NOTHING_UNDER = Object.freeze({ soft: 0, wall: 0, rock: 0, tower: 0, heart: 0, seal: 0 });
  let under = { ...NOTHING_UNDER };
  /* declared with the rest of the state, not with the panel below, because paintHud reads them */
  let flashT = 0, flashMsg = '';
  const errors = [];
  const run = { bodies: 0, walls: 0, rocks: 0, towers: 0, heart: 'INTACT' };
  /* ROCK: the planet's BLOCKED lattice cells, breakable as a tank shell breaks them. The tags as built (for REVIVE) and
     the cells a structure or socket stands on (never breached, the way a mounted tower anchors its wall). The planet is
     createStoryPlanetSurface, so a breach patches its cell in place instead of rebuilding the planet. */
  let rockTags0 = null, rockAnchors = new Set();
  /* the aim's distance from the base before the range clamp, for the scope's colour; the frame timing for the perf line */
  let aimArc = 0, frameMs = 16.7, walkCells = null;
  const cellSpots = new Map();
  const perf = { fps: 0, ms: 0, draws: 0, triangles: 0 };
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
    + '<span id="laser-flash"></span>'
    + '<span id="laser-perf"></span>'
    + '</div>'
    + '<div class="laser-keys"><button id="laser-pass" type="button">PASS NOW</button>'
    + '<button id="laser-brief" type="button">SOL-82 BRIEF</button>'
    + '<button id="laser-revive" type="button">REVIVE</button>'
    + '<button id="laser-reset" type="button">RESET</button>'
    + '<span>hold the pointer in the inset to burn</span></div>';
  const elState = hud.querySelector('#laser-state'), elWindow = hud.querySelector('#laser-window');
  const elEnergy = hud.querySelector('#laser-energy'), elRead = hud.querySelector('#laser-read');
  const elLost = hud.querySelector('#laser-lost'), elEnergyLabel = hud.querySelector('#laser-energy-label');
  const elFlash = hud.querySelector('#laser-flash'), elPerf = hud.querySelector('#laser-perf');
  const style = document.createElement('style');
  /* the canvas fills the tab the way every other lab's does (styles.css #story-app), injected so the lab owns it */
  style.textContent = '#laser-app{position:absolute;inset:0}'
    + '#laser-app canvas{display:block;width:100%;height:100%}'
    /* right:auto with a cap, not right:0: the navigation shell owns the top right corner (styles.css, the bar with
       PLAYTEST | DEV and the build tag) and a full-width readout ran straight under it */
    + '#laser-hud{position:absolute;left:0;top:0;right:auto;max-width:min(100%,860px);padding:10px 14px;pointer-events:none;'
    + 'font:12px ui-monospace,Menlo,monospace;letter-spacing:1px;color:#dfe8ee;text-transform:uppercase}'
    + '#laser-hud .laser-lines{display:flex;gap:14px;align-items:center;flex-wrap:wrap}'
    + '#laser-hud .laser-bar{display:inline-block;width:120px;height:6px;border:1px solid #6d7b85;background:#0b0f12}'
    + '#laser-hud .laser-bar i{display:block;height:100%;width:0;background:#dfe8ee}'
    + '#laser-hud .laser-bar i.hot{background:#8e8983}'
    + '#laser-hud #laser-lost{color:#fff;border:1px solid #fff;padding:1px 6px}'
    + '#laser-hud .laser-keys{margin-top:8px;display:flex;gap:10px;align-items:center;pointer-events:auto}'
    + '#laser-hud button{font:inherit;color:inherit;background:#0b0f12;border:1px solid #6d7b85;padding:3px 10px;cursor:pointer}'
    + '#laser-hud #laser-flash{color:#fff}'
    /* the copy button lives on the LEFT, under the deep link: the lil-gui panel owns the right edge (styles.css
       .tab .lil-gui.root) and a button under it is a button that cannot be clicked */
    + '#laser-copy{position:absolute;left:12px;bottom:40px;z-index:7;width:40px;height:40px;padding:0;'
    + 'font:600 18px ui-monospace,Menlo,monospace;line-height:1;color:#dfe8ee;background:#0b0f12;'
    + 'border:1px solid #6d7b85;border-radius:8px;cursor:pointer}'
    + '#laser-copy:active{transform:translateY(1px)}';
  root.appendChild(style);

  function paintHud() {
    const p = laserProgress(st, orbit(), beamCfg());
    const word = P.infinite ? 'INFINITE' : st.phase === 'overhead' ? (st.energy > 0 ? 'OVERHEAD' : 'OUT') : 'AWAY';
    const line = `${word} · ${Math.ceil(st.left).toString().padStart(2, '0')}`;
    if (elState.textContent !== line) elState.textContent = line;
    elWindow.style.width = `${Math.round(p.pass * 100)}%`;
    elEnergy.style.width = `${Math.round(p.energy * 100)}%`;
    elEnergy.classList.toggle('hot', st.energy <= 0);
    const label = st.energy <= 0 ? 'OUT' : 'ENERGY';
    if (elEnergyLabel.textContent !== label) elEnergyLabel.textContent = label;
    const read = `bodies ${run.bodies} · walls ${run.walls} · rock ${run.rocks} · towers ${run.towers} · sinkhole ${sealed ? 'SEALED' : 'OPEN'}`
      + ` · stalheart ${run.heart} · ${st.energy.toFixed(1)} s left`
      + (st.burning ? ` · under the beam: ${under.wall} wall · ${under.rock} rock · ${under.tower + under.heart} tower · ${under.soft} body${under.seal ? ' · the sinkhole' : ''}` : '');
    if (elRead.textContent !== read) elRead.textContent = read;
    elLost.hidden = run.heart !== 'LOST';
    const note = flashT > 0 ? flashMsg : '';
    if (elFlash.textContent !== note) elFlash.textContent = note;
    const perfLine = `fps ${perf.fps} · ${perf.ms.toFixed(1)} ms · ${perf.draws} draws · ${bodies.length} bodies`;
    if (elPerf.textContent !== perfLine) elPerf.textContent = perfLine;
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

  // WHERE THE LAB LOOKS WHEN NOTHING IS BURNING. The queue stacks against the gate (body i sits at length - 4 - i gaps),
  // so the tail is the one place from which the whole line, the gate and the wall behind it are all in front of the
  // camera. The trench is 250 m long and its midpoint showed nothing but empty floor.
  const queueTail = () => Math.max(0, trench.length - 4 - (BODIES - 1) * BODY_GAP);

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

  // THE SWARM (owner, 2026-09-15: 500 by default, active, moving the way they do, spawning far from the base). The first
  // BODIES walk single file up the trench as before. The rest are walkers: they spawn on open floor WALK_RING metres out
  // and step cell to cell down the planet's own route field (dungeon.distToHeart, the field the game routes the swarm
  // by), turning away while scared; one that reaches the heart respawns far out, so the swarm keeps coming.
  function spawnCells() {
    if (walkCells) return walkCells;
    const centers = planet.graph.centers, tags = planet.dungeon.tags, dist = planet.dungeon.distToHeart, out = [];
    for (let ci = 0; ci < centers.length; ci++) {
      if (tags[ci] === BLOCKED || !(dist[ci] > ARRIVE_HOPS)) continue;
      const arc = Math.acos(Math.max(-1, Math.min(1, centers[ci][1]))) * R;
      if (arc >= WALK_RING[0] && arc <= WALK_RING[1]) out.push(ci);
    }
    return (walkCells = out);
  }

  // a walker's footing on a cell: its centre on the ground, a hair above the floor
  function cellSpot(ci) {
    let spot = cellSpots.get(ci);
    if (spot) return spot;
    const c = planet.graph.centers[ci];
    let alt = 0;
    for (const vi of planet.mesh.quads[ci]) alt += planet.altitudeOf(vi) / 4;
    spot = new THREE.Vector3(c[0], c[1], c[2]).normalize().multiplyScalar(R + alt + 0.6).add(tmpB.set(0, -R, 0));
    cellSpots.set(ci, spot);
    return spot;
  }

  // the next cell: down the route field toward the heart (a random one of the best, so the swarm spreads), or up it while scared
  function nextCell(ci, away) {
    const tags = planet.dungeon.tags, dist = planet.dungeon.distToHeart;
    let best = [], bestD = away ? -Infinity : Infinity;
    for (const nb of planet.graph.adj[ci]) {
      if (tags[nb] === BLOCKED || dist[nb] < 0) continue;
      const d = dist[nb];
      if (away ? d > bestD : d < bestD) { bestD = d; best = [nb]; } else if (d === bestD) best.push(nb);
    }
    return best.length ? best[Math.floor(Math.random() * best.length)] : ci;
  }

  function spawnWalker(b) {
    const cells = spawnCells();
    b.ci = cells.length ? cells[Math.floor(Math.random() * cells.length)] : 0;
    b.next = nextCell(b.ci, false);
    b.t = Math.random();
    placeWalker(b);
  }

  function placeWalker(b) {
    const w = tmpA.copy(cellSpot(b.ci)).lerp(cellSpot(b.next), b.t);
    b.pos = [w.x, w.y, w.z];
    if (!b.obj) return;
    b.obj.position.copy(w);
    b.obj.quaternion.setFromUnitVectors(Y, normalOf(w));
  }

  function stepWalker(b, dt, now) {
    stampScare(b, now);
    const pace = scarePace(b, now, SCARE_FREEZE_S), away = isScared(b, now);
    const leg = cellSpot(b.ci).distanceTo(cellSpot(b.next)) || 1;
    b.t += (P.walkSpeed * pace * dt) / leg;
    while (b.t >= 1) {
      b.t -= 1;
      b.ci = b.next;
      if (planet.dungeon.distToHeart[b.ci] <= ARRIVE_HOPS) { spawnWalker(b); return; }
      b.next = nextCell(b.ci, away);
      if (b.next === b.ci) { b.t = 0; break; }
    }
    placeWalker(b);
  }

  function buildBodies() {
    for (const b of bodies) if (b.obj) { scene.remove(b.obj); b.obj.geometry.dispose(); b.obj.material.dispose(); }
    bodies = [];
    const count = Math.max(1, Math.round(P.enemies));
    const queue = Math.min(count, BODIES, Math.max(1, Math.floor((trench.length - 4) / BODY_GAP) + 1));
    for (let i = 0; i < count; i++) {
      const type = BODY_TYPES[i % BODY_TYPES.length];
      let obj = null;
      try { obj = makeDotEnemy(type, BODY_COLS, 1); } catch (e) { errors.push(`body ${i}: ${e}`); }
      if (obj) { obj.scale.setScalar(1.7); scene.add(obj); }
      if (i < queue) {
        const b = { id: `body-${i}`, type, obj, alive: true, walker: false, s: Math.max(0, trench.length - 4 - i * BODY_GAP), pos: [0, 0, 0] };
        seatBody(b);
        bodies.push(b);
        continue;
      }
      const b = { id: `body-${i}`, type, obj, alive: true, walker: true, ci: 0, next: 0, t: 0, pos: [0, 0, 0] };
      spawnWalker(b);
      bodies.push(b);
    }
  }

  function stepBodies(dt, now) {
    let ahead = trench.length;
    for (const b of bodies) {
      if (!b.alive) continue;
      if (b.walker) { stepWalker(b, dt, now); b.obj?.userData.tick?.(clock); continue; }
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
    planetMesh = createStoryPlanetSurface(planet, look, { wallMetres: STORY_RECIPE.wallMetres, rockLines: P.rockLines });
    scene.add(planetMesh);
    north.copy(toWorld([0, 0, -1])).sub(toWorld([0, 0, 0])).normalize();

    sphereRoot = new THREE.Group();
    sphereRoot.name = 'Planet-centred effects';
    sphereRoot.position.set(0, -R, 0);
    scene.add(sphereRoot);
    explosions = createExplosions(sphereRoot, { onError: (e) => errors.push(`explosions: ${e.message}`) });
    /* the rubble's own frame: unit-sphere local coordinates, R metres to the unit, centred on the planet */
    const rubbleHost = new THREE.Group();
    rubbleHost.name = 'Rubble unit sphere';
    rubbleHost.scale.setScalar(R);
    sphereRoot.add(rubbleHost);
    rubble = createBreachRubble(rubbleHost);

    const LAYOUT = { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES };
    plan = planBase(planet, LAYOUT, STAGE);
    base = createStoryBase(scene, {
      plan, placer: { toWorld }, metres: 1, kit: KIT, skip: ['sh02'], sfx: null,
    });
    await base.ready;
    for (const e of base.errors) errors.push(`base: ${e}`);

    /* the wall instances, by name off the base's group: createStoryBase does not return them */
    wallMeshes = base.group.children.filter((o) => o.isInstancedMesh && o.name === 'walls');
    wallRest = wallMeshes.map((m) => m.instanceMatrix.array.slice());
    wallCells = plan.walls.map((w, k) => ({
      id: `wall-${k}`, index: k, gone: false, p: toWorld([w.x, KIT.wallMetres / 2, w.z]),
    }));

    /* the structures the beam can take, by their holder */
    structs = [];
    for (const s of plan.structures) {
      const rec = base.structure(s.id);
      if (!rec || !rec.holder) continue;
      structs.push({
        id: s.id, holder: rec.holder, root: rec.root, gone: false, shown: rec.holder.visible,
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
      structs.push({ id: `sentry-${name}`, holder: obj, root: obj, gone: false, shown: true, heart: false, p: obj.position.clone() });
    }

    rockTags0 = Uint8Array.from(planet.dungeon.tags);
    rockAnchors = new Set([...plan.structures, ...(plan.sockets || [])].map((s) => s.cell).filter((c) => Number.isInteger(c) && c >= 0));

    /* the trench: from the sinkhole's cell up the sightline to the gate */
    const holeF = plan.cells.fodder >= 0 ? frameOfCell(plan.cells.fodder) : [0, -240];
    const gateF = plan.gate ? [plan.gate.x, plan.gate.z] : [0, -120];
    trench = buildTrench(holeF, gateF);
    trenchMesh = trench.mesh;
    trenchBack = toWorld([trench.from[0] - trench.dir[0], 0, trench.from[1] - trench.dir[1]])
      .sub(toWorld([trench.from[0], 0, trench.from[1]])).normalize();
    buildBodies();

    /* the sinkhole at the far end, standing on the planet, opened */
    sink = createSinkhole(sphereRoot, ground, { game: true });
    const holeW = toWorld([holeF[0], 0, holeF[1]]);
    const holeN = normalOf(holeW);
    sink.group.position.set(holeW.x, holeW.y + R, holeW.z);
    sink.group.quaternion.setFromUnitVectors(Y, holeN);
    sink.group.visible = true;
    /* the game's scale (src/game-breaches.js:20-27): the group is a cell wide, so every sinkhole number reads in
       CELLS — craterRadius 1 is a cellSide-metre hole, clearRadius 6 a six-cell clearing — and planetRadius is the
       planet measured in those same units. Hosting it at metre scale drew a one-metre crater under a ten-metre cap. */
    sink.group.scale.setScalar(cellSide);
    sink.tune.planetRadius = R / cellSide;
    sink.tune.sound = false;
    sinkPoint = holeW.clone();

    laser = createOrbitalLaser(scene, { cellSide, metresPerCell: 10 });
    laser.tune(lookOf());
    thermal = createThermalHeat(() => ({ warm: [], hot: hotRoots() }), { every: 250 });

    frameGround(trenchPoint(queueTail()));
    ready = true;
    /* the first visit opens the briefing (?briefing=1 always does); a browser under automation never gets it, so harness runs stay unblocked */
    if (q.get('briefing') === '1' || (!briefing.seen() && !navigator.webdriver)) briefing.open();
  }

  let sinkPoint = new THREE.Vector3();
  /* the cap's frame, never in the graph: its matrixWorld is its own local matrix, a place on the unit sphere about the
     origin, scaled so one sinkhole unit is cellSide metres — the same footprint the game's breach seals with */
  const rubbleFrame = new THREE.Object3D();

  function hotRoots() {
    const out = [];
    for (const id of st.contacts.keys()) {
      const s = structs.find((x) => x.id === id);
      if (s && !s.gone) out.push(s.root ?? s.holder);
    }
    return out;
  }

  /* --- the two cameras ------------------------------------------------------ */
  // BEHIND THE CONTACT, ALONG THE TRENCH, AND ON THE LOCAL HORIZONTAL. trenchBack is one world direction, measured
  // at the trench's mouth; 250 m of trench is a third of a radian of planet, so that direction dips nineteen degrees
  // below the tangent plane at the gate. Stepping 28 m along it from there put the camera 9 m DOWN — under its own
  // 9 m lift, i.e. inside the ground, where the terrain occludes the column and the footprint ring and the view is a
  // flat plane with the base poking over the horizon. Projecting it onto the tangent plane at `point` is the fix.
  function frameGround(point) {
    const n = normalOf(point);
    const back = tmpA.copy(trenchBack).addScaledVector(n, -trenchBack.dot(n)).normalize();
    ground.position.copy(point).addScaledVector(back, P.groundBack).addScaledVector(n, P.groundUp);
    ground.up.copy(n);
    ground.lookAt(point);
  }

  // WHERE "UP" IS FOR THE PLAYER: the ground camera's forward (it stands back along the trench and looks down it),
  // laid onto the ground at `point`. The scope is heading-up along it and WASD moves along it, so W is up on both views
  // and D is right (owner, 2026-09-15: north-up keys read inverted, because the trench, and so the camera, faces south).
  function viewForward(point) {
    const n = normalOf(point);
    const f = trenchBack.clone().multiplyScalar(-1);
    f.addScaledVector(n, -f.dot(n));
    if (f.lengthSq() < 1e-8) f.copy(north).addScaledVector(n, -north.dot(n));
    return f.normalize();
  }

  function frameSat(point) {
    const n = normalOf(point);
    sat.fov = P.fov;
    sat.position.copy(n).multiplyScalar(R * (1 + P.altitude)).add(tmpB.set(0, -R, 0));
    sat.up.copy(viewForward(point));
    sat.lookAt(point);
    sat.updateProjectionMatrix();
  }

  /* BOTTOM LEFT, and both edges are taken for a reason. The lil-gui panel owns the right edge (styles.css
     .tab .lil-gui.root) and swallowed the inset there; moving the inset just clear of the panel put it over the
     MIDDLE of the screen, which is exactly where frameGround holds the contact. The left column below the HUD is the
     only corner that hides neither the panel nor the thing being burned; 64 px in clears the lab's two corner
     buttons (the deep link and COPY PRESET), which stack against the left edge. */
  const INSET_LEFT = 64;

  function insetRect() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    if (h > w) { const s = Math.min(w, Math.round(h * 0.4)); return { x: Math.round((w - s) / 2), y: 0, w: s, h: s }; }   /* portrait: a lens centred across the top */
    const s = Math.min(Math.round(w * P.inset), h - 24);
    return { x: INSET_LEFT, y: h - s - 12, w: s, h: s };
  }

  // screen-to-sphere on the FAR camera: the inset is the only surface that steers
  function targetFromInset(nx, ny) {
    ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, 1 - ny * 2), sat);
    const hit = ray.ray.intersectSphere(sphere, new THREE.Vector3());
    return hit;
  }

  // the ONE way the aim is set, in inset-normalised 0..1: the pointer goes through it and so does the test hook's
  // steer(), so the harness picks with the same far camera on the same inset rect a hand does
  function steerTo(nx, ny) {
    steerN = [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))];
    steering = true;
  }

  function onPointer(e) {
    /* a press on the view takes keyboard focus back from the panel: a slider or number field left focused made the key
       handler read every WASD press as typing and ignore it (owner, 2026-09-15: "WASD seems unresponsive") */
    if (e.type === 'pointerdown' && document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
    const r = insetRect(), box = renderer.domElement.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    /* the lens is round: only a pointer inside the circle steers */
    const inside = Math.hypot(x - (r.x + r.w / 2), y - (r.y + r.h / 2)) <= r.w / 2;
    /* while a movement key is held the keys own the aim: a mouse twitch in the scope must not drag the beam back */
    steering = inside && !keys.size;
    if (!inside) return;
    steerTo((x - r.x) / r.w, (y - r.y) / r.h);
    if (e.type === 'pointerdown') held = true;
    e.preventDefault();
  }
  /* letting go also stops steering: the contact and both cameras hold on the last contact until the pointer moves again */
  const onPointerUp = () => { held = false; steering = false; };
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

  // THE ROUND SCOPE (owner, 2026-09-15: "make it round, like the radar"). The satellite view renders into its own
  // target at the lens's pixel size, then a lens quad composites it through a circle with a darkened rim, scissored to
  // the inset square, so the ground view shows around the lens instead of a black square cutting the beam. Viewport and
  // scissor are CSS pixels: WebGLRenderer multiplies them by the pixel ratio itself (the square inset passed them
  // pre-multiplied, which over-scaled on a 2x display).
  const satTarget = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  const lensScene = new THREE.Scene(), lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const lensMat = new THREE.ShaderMaterial({
    uniforms: { tView: { value: satTarget.texture } },
    vertexShader: 'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `#include <common>
uniform sampler2D tView;
varying vec2 vUv;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  if (r > 1.0) discard;
  vec4 c = texture2D(tView, vUv);
  float rim = 1.0 - 0.5 * smoothstep(0.62, 1.0, r);
  gl_FragColor = vec4(c.rgb * rim, 1.0);
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
    if (satTarget.width !== px) satTarget.setSize(px, px);
    sat.aspect = 1;
    sat.updateProjectionMatrix();
    renderer.setRenderTarget(satTarget);
    renderer.render(scene, sat);
    renderer.setRenderTarget(null);
    const y = cr.height - r.y - r.h;                                   /* GL y runs from the bottom */
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.setViewport(r.x, y, r.w, r.h);
    renderer.setScissor(r.x, y, r.w, r.h);
    renderer.render(lensScene, lensCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cr.width, cr.height);
    renderer.autoClear = true;
  }

  function loop() {
    if (!active || disposed) return;
    frameId = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    frameMs += ((now - last) - frameMs) * 0.1;
    last = now;
    perf.ms = frameMs;
    perf.fps = Math.round(1000 / Math.max(1, frameMs));
    /* info counts every render of the frame (ground, satellite, lens), so reset it once here, not per render */
    perf.draws = renderer.info.render.calls;
    perf.triangles = renderer.info.render.triangles;
    renderer.info.reset();
    clock += dt;
    if (!ready) { guard('loading', () => renderer.render(scene, ground)); return; }
    guard('step', () => step(dt));
    guard('render', render);
    guard('scope', () => insetHud.draw(hudFrame(), dt));
  }

  // ONE FRAME FOR THE INSET HUD, in canvas pixels: the aim (where the pointer is, or the contact when nothing steers),
  // the contact and its footprint projected through the satellite camera, and the numbers around the edge.
  function hudFrame() {
    const r = insetRect();
    const px = (v) => { const p = v.clone().project(sat); return { x: r.x + (p.x + 1) / 2 * r.w, y: r.y + (1 - p.y) / 2 * r.h }; };
    const contactW = st.contact ? fromCentre(st.contact) : null;
    const anchor = contactW ?? trenchPoint(queueTail());
    const aiming = steering || held;
    const aim = aiming ? { x: r.x + steerN[0] * r.w, y: r.y + steerN[1] * r.h } : px(anchor);
    let contact = null, footprintPx = 0, lagM = 0;
    if (contactW) {
      contact = px(contactW);
      const across = new THREE.Vector3().crossVectors(normalOf(contactW), north).normalize();
      const edge = px(contactW.clone().addScaledVector(across, P.radius));
      footprintPx = Math.hypot(edge.x - contact.x, edge.y - contact.y);
      const hit = aiming ? targetFromInset(steerN[0], steerN[1]) : null;
      if (hit) lagM = hit.distanceTo(contactW);
    }
    const dir = normalOf(anchor);
    const rangeM = sat.position.distanceTo(anchor);
    /* where north points on the heading-up lens, clockwise from up, so the bezel's letters stay true */
    const northT = north.clone().addScaledVector(dir, -north.dot(dir)).normalize();
    const pc = px(anchor), pn = px(anchor.clone().addScaledVector(northT, 50));
    const northAngle = Math.atan2(pn.x - pc.x, -(pn.y - pc.y));
    const p = laserProgress(st, orbit(), beamCfg());
    return {
      rect: r, aim, contact, footprintPx, lagM, aiming, limitM: P.range, aimArcM: aimArc,
      /* the beam's own distance from the base (what the range judges) and the ground radius the lens shows (what the
         aim's lead is judged against) */
      contactArcM: st.contact ? clampToRange(st.contact, 0).arc : 0,
      lensGroundM: Math.tan((P.fov * Math.PI) / 360) * rangeM,
      phase: st.phase, infinite: P.infinite, left: st.left, pass01: p.pass,
      energy: st.energy, energy01: p.energy, burning: st.burning,
      speed: P.accel > 0 ? (st.speed || 0) : (st.burning || aiming ? P.slew : 0), slew: P.slew, radiusM: P.radius,
      altitudeM: P.altitude * R, rangeM, fovDeg: P.fov, gsd: (2 * Math.tan((P.fov * Math.PI) / 360) * rangeM) / Math.max(1, r.h),
      lat: (Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI, lon: (Math.atan2(dir.x, dir.z) * 180) / Math.PI,
      deliveredMJ: (P.energy - st.energy) * LASER_TELEMETRY.powerMW, capMJ: P.energy * LASER_TELEMETRY.powerMW,
      counts: { bodies: run.bodies, walls: run.walls, rocks: run.rocks, towers: run.towers, alive: bodies.filter((b) => b.alive).length },
      sealed, heart: run.heart, under, northAngle,
    };
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
      /* a holder the base built hidden (plan.stage < shown) is not on screen, so it cannot be under the beam either */
      if (s.gone || !s.holder.visible || !near(s.p)) continue;
      out.push({ id: s.id, kind: s.heart ? 'heart' : 'tower', pos: [s.p.x, s.p.y, s.p.z], struct: s });
    }
    /* rock: a BLOCKED cell whose centre lies within the footprint plus half a cell, measured along the sphere, so the
       footprint touching a cell is enough; the anchors under structures and sockets stay */
    const dir = normalOf(point), cosReach = Math.cos((r + cellSide * 0.5) / R);
    const centers = planet.graph.centers, tags = planet.dungeon.tags;
    for (let ci = 0; ci < centers.length; ci++) {
      if (tags[ci] !== BLOCKED || rockAnchors.has(ci)) continue;
      const c = centers[ci];
      if (c[0] * dir.x + c[1] * dir.y + c[2] * dir.z < cosReach) continue;
      out.push({ id: `rock-${ci}`, kind: 'rock', pos: [c[0] * R, c[1] * R - R, c[2] * R], rock: ci });
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
    if (thing.rock !== undefined) {
      /* the cell opens to floor as a tank shell opens it, and the surface patches that one cell in place */
      planet.dungeon.tags[thing.rock] = PATH;
      planetMesh.userData.refreshCells([thing.rock]);
      const at = tmpA.set(thing.pos[0], thing.pos[1], thing.pos[2]);
      const top = at.clone().addScaledVector(normalOf(at), STORY_RECIPE.wallMetres / 2);
      burstAt(top, 0x8e8983);
      fire('laser.ignite', top);
      run.rocks++;
      return;
    }
    if (thing.sink) {
      sealed = true;
      rubbleFrame.position.copy(normalOf(sinkPoint));
      rubbleFrame.quaternion.copy(sink.group.quaternion);
      rubbleFrame.scale.setScalar(cellSide / R);
      try { rubble.add(rubbleFrame, sink.tune.craterRadius ?? 1); } catch (e) { errors.push(`rubble: ${e.message}`); }
      sink.group.visible = false;
      fire('laser.ignite', sinkPoint);
    }
  }

  // THE GROUND AT A POINT: the cell under it and the height of what stands there, the terrace floor or the top of a rock
  // cell. The column, its glow and its smoke land ON the rock instead of 4 m inside it, where the rock top cut the flat
  // beam ribbon with a straight line (owner, 2026-09-15). The footprint test still measures along the sphere.
  function surfaceAt(point) {
    const dir = normalOf(point), centers = planet.graph.centers;
    let best = 0, bestDot = -2;
    for (let ci = 0; ci < centers.length; ci++) {
      const c = centers[ci], d = c[0] * dir.x + c[1] * dir.y + c[2] * dir.z;
      if (d > bestDot) { bestDot = d; best = ci; }
    }
    let alt = 0;
    for (const vi of planet.mesh.quads[best]) alt += planet.altitudeOf(vi) / 4;
    const h = alt + (planet.dungeon.tags[best] === BLOCKED ? STORY_RECIPE.wallMetres : 0);
    return dir.multiplyScalar(R + h).add(tmpB.set(0, -R, 0));
  }

  // THE KEYS PRE-POSITION (owner, 2026-09-15: "WASD could be an additional fast way to pre-position the laser, and the
  // current method the firing method"). While the beam is not firing, W/A/S/D or the arrows slide the contact straight
  // across the ground at P.padSpeed, screen-relative (W away from the ground camera, up on the heading-up scope),
  // ignoring the slew and its inertia; a key takes the
  // aim from the pointer until the pointer moves again. While it fires, the keys do nothing: the hold is the weapon.
  const keys = new Set();
  const PAD_KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  const onKeyDown = (e) => {
    if (!active || typing(e) || !PAD_KEYS[e.code]) return;
    keys.add(e.code);
    steering = false;
    e.preventDefault();
  };
  const onKeyUp = (e) => { keys.delete(e.code); };
  const onBlur = () => keys.clear();
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);

  /* dx right, dz forward. NOT named `north`: that is the lab's north direction vector, and shadowing it made
     north.clone() throw on the first key frame, which aborted step() before render() and froze the scope */
  function padContact(dx, dz, seconds) {
    if (held || st.burning || (!dx && !dz)) return;
    const len = Math.hypot(dx, dz) || 1;
    const from = st.contact ? fromCentre(st.contact) : trenchPoint(queueTail());
    const n = normalOf(from);
    /* screen-relative: forward is up on the ground view and on the heading-up scope, right is forward x up */
    const forward = viewForward(from);
    const right = new THREE.Vector3().crossVectors(forward, n);
    const step = P.padSpeed * seconds / len;
    const moved = toCentre(from.clone().addScaledVector(right, dx * step).addScaledVector(forward, dz * step));
    let target = norm3(moved).map((c) => c * R);
    if (P.holdRange) target = clampToRange(target, P.range).target;
    st.contact = target;
    st.fresh = false;
    st.speed = 0;
    st.axis = null;
  }

  function padFromKeys(dt) {
    let dx = 0, dz = 0;
    for (const code of keys) { const d = PAD_KEYS[code]; dx += d[0]; dz += d[1]; }
    padContact(dx, dz, dt);
  }

  /* --- the beam, per frame -------------------------------------------------- */
  function applyBurn(dt) {
    const hit = steering || held ? targetFromInset(steerN[0], steerN[1]) : null;
    /* the range: an aim beyond it is held at the limit, and the scope is told how far out it was */
    const ranged = hit ? clampToRange(toCentre(hit), P.range) : null;
    aimArc = ranged ? ranged.arc : 0;
    if (ranged) aimLaser(st, P.holdRange ? ranged.target : toCentre(hit), dt, beamCfg());
    const burning = burnLaser(st, held, dt);
    const point = st.contact ? fromCentre(st.contact) : null;
    if (!burning || !point) {
      /* the burn does not survive the lift: a re-laid beam starts every contact from zero seconds */
      if (burningWas) { laser.lift(); thermal.set(false); st.contacts.clear(); }
      stopBurnVoice();
      burningWas = false;
      contactTimer = 0;
      smokeTimer = 0;
      under = { ...NOTHING_UNDER };
      return;
    }
    const n = normalOf(point), ground = surfaceAt(point);
    if (!burningWas) {
      laser.lay(ground, n);
      fire('laser.ignite', ground);
      thermal.set(true);
      contactTimer = 0;
      smokeTimer = 0;
    } else {
      laser.aim(ground, n);
    }
    burningWas = true;
    /* the ground burns audibly: louder with more energy left, a touch higher as the contact drags faster */
    if (P.sound) {
      burnVoice ??= sfx.loop(LASER_SOUNDS.burn);
      const drag = P.slew > 0 ? Math.min(1, (st.speed || 0) / P.slew) : 0;
      burnVoice?.set(0.55 + 0.45 * laserProgress(st, orbit(), beamCfg()).energy, 0.97 + 0.08 * drag);
    }
    /* the contact sheds pops at LASER_CONTACT_RATE per second while it burns */
    contactTimer += dt;
    const every = 1 / LASER_CONTACT_RATE;
    while (contactTimer >= every) { contactTimer -= every; fire('laser.contact', ground); }
    /* and the burning ground smokes: a fire-and-smoke burst LASER_SMOKE_RATE per second */
    smokeTimer += dt;
    const smokeEvery = 1 / LASER_SMOKE_RATE;
    while (smokeTimer >= smokeEvery) { smokeTimer -= smokeEvery; fire('laser.smoke', ground); }
    const things = collect(point);
    under = { ...NOTHING_UNDER };
    for (const thing of things) under[thing.kind]++;
    for (const entry of burnContacts(st, things, dt, burnCfg())) destroy(entry);
  }

  // A FRAME THAT FAILS IN ONE PLACE KEEPS DRAWING (owner, 2026-09-15). Each stage of the frame runs guarded: an error
  // is recorded in state().errors, flashed on the HUD and logged once per distinct message, and the other stages go
  // on. One throw used to abort step() before render() and freeze the whole lab on its last frame.
  const frameErrors = new Set();
  function guard(stage, fn) {
    try {
      fn();
    } catch (e) {
      const message = `${stage}: ${e?.message || e}`;
      if (frameErrors.has(message)) return;
      frameErrors.add(message);
      if (errors.length < 50) errors.push(message);
      console.error(`LASERLAB frame error in ${message}`, e);
      flash(`error in ${message}`);
    }
  }

  function step(dt) {
    guard('pass', () => {
      /* infinite: hold the pass open and the budget full before the clock runs, so it never closes or runs out */
      if (P.infinite) {
        if (st.phase !== 'overhead') { st.phase = 'overhead'; st.fresh = true; }
        st.left = P.overhead;
        st.energy = P.energy;
      }
      const edge = stepLaser(st, dt, orbit(), beamCfg());
      if (edge === 'close') laser.lift();
    });
    /* the sinkhole opens itself once its stone textures are in: nothing else polls it here */
    guard('sinkhole open', () => { if (!sinkOpened && !sealed && sink.ready()) { sink.trigger(); sinkOpened = true; } });
    guard('keys', () => padFromKeys(dt));
    guard('burn', () => applyBurn(dt));
    /* the silent red pointer, while the column is not firing: where it will land, on the real ground height */
    guard('pointer', () => {
      if (!st.burning) {
        const at = st.contact ? fromCentre(st.contact) : trenchPoint(queueTail());
        laser.guideAt(surfaceAt(at), normalOf(at), st.phase === 'overhead' || P.infinite ? 1 : 0.35);
      } else {
        laser.hideGuide();
      }
    });
    guard('bodies', () => stepBodies(dt, clock));
    guard('bursts', () => stepBursts(dt));
    guard('explosions', () => explosions?.tick(dt));
    guard('rubble', () => rubble?.update(dt));
    guard('sinkhole', () => sink?.update(dt, clock));
    guard('base', () => base?.tick(dt, null, false, ground.position));
    guard('laser', () => laser.tick(dt, laserProgress(st, orbit(), beamCfg()).energy));
    guard('cameras', () => {
      const anchor = st.contact ? fromCentre(st.contact) : trenchPoint(queueTail());
      frameGround(anchor);
      frameSat(anchor);
    });
    guard('hud', paintHud);
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
  }

  // Put every target back without the reload RESET does: wall cells from the matrices saved at build, structures to the
  // visibility they were built with, a fresh queue of bodies, the counters and the heart. A sealed sinkhole stays
  // sealed: its crater and rubble cap have no undo, so that one still needs RESET.
  function revive() {
    if (!ready) return;
    wallMeshes.forEach((m, i) => { m.instanceMatrix.array.set(wallRest[i]); m.instanceMatrix.needsUpdate = true; });
    for (const w of wallCells) w.gone = false;
    for (const s of structs) { s.gone = false; s.holder.visible = s.shown; }
    buildBodies();
    st.contacts.clear();
    if (rockTags0) {
      const changed = [];
      for (let ci = 0; ci < rockTags0.length; ci++) if (planet.dungeon.tags[ci] !== rockTags0[ci]) changed.push(ci);
      planet.dungeon.tags.set(rockTags0);
      planetMesh.userData.refreshCells(changed);
    }
    Object.assign(run, { bodies: 0, walls: 0, rocks: 0, towers: 0, heart: 'INTACT' });
    flash(sealed ? 'targets revived; the sealed sinkhole needs RESET' : 'targets revived');
  }

  // the infinite toggle rides in the address, so RESET (a reload) comes back with it still on
  function keepInfinite() {
    const url = new URL(location.href);
    if (P.infinite) url.searchParams.set('infinite', '1'); else url.searchParams.delete('infinite');
    history.replaceState(history.state, '', url);
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
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('blur', onBlur);
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
      gui?.destroy();
      if (window.__stalheartLaserTest === hooks) delete window.__stalheartLaserTest;
      stopBurnVoice(0);
      sfx.dispose?.();
      briefing.dispose();
      insetHud.dispose();
      satTarget.dispose();
      lensGeo.dispose();
      lensMat.dispose();
      style.remove();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  /* --- the panel ------------------------------------------------------------ */
  const gui = new GUI({ title: 'ORBITAL LASER', container: root });
  const gp = gui.addFolder('the pass');
  gp.add(P, 'period', 20, 400, 1).name('period (s)');
  gp.add(P, 'overhead', 4, 90, 1).name('overhead (s)');
  gp.add(P, 'energy', 1, 40, 0.5).name('energy (s of burn)');
  gp.add(P, 'infinite').name('infinite laser (debug)').onChange(keepInfinite);
  gp.add(P, 'sound').name('sound').onChange((on) => { if (!on) stopBurnVoice(0.2); });
  gp.open();
  const gb = gui.addFolder('the beam');
  const retune = () => laser?.tune(lookOf());
  gb.add(P, 'radius', 1, 30, 0.5).name('footprint (m)').onChange(retune);
  gb.add(P, 'slew', 1, 200, 0.5).name('top speed (m/s)');
  gb.add(P, 'accel', 0, 60, 0.5).name('acceleration (m/s², 0 = instant)');
  gb.add(P, 'range', 50, 800, 10).name('range from the base (m)');
  gb.add(P, 'holdRange').name('hold at range');
  gb.add(P, 'padSpeed', 10, 400, 5).name('WASD pre-position (m/s)');
  const gs = gui.addFolder('the swarm');
  gs.add(P, 'enemies', 10, 1000, 10).name('enemies').onFinishChange(() => { if (ready) buildBodies(); });
  gs.add(P, 'walkSpeed', 0, 15, 0.5).name('walk speed (m/s)');
  gs.open();
  gb.open();
  /* live: each change goes straight to the column's uniforms through tune(), and COPY PRESET and the deep link carry it */
  const gw = gui.addFolder('the beam look');
  gw.add(P, 'coreWidth', 0.05, 3, 0.05).name('core width (m)').onChange(retune);
  gw.add(P, 'glowWidth', 0.5, 20, 0.5).name('glow width (m)').onChange(retune);
  gw.add(P, 'coreIntensity', 0, 12, 0.1).name('core intensity').onChange(retune);
  gw.add(P, 'glowIntensity', 0, 12, 0.1).name('glow intensity').onChange(retune);
  gw.add(P, 'noiseAmount', 0, 1, 0.01).name('interference').onChange(retune);
  gw.open();
  const gv = gui.addFolder('the view');
  gv.add(P, 'altitude', 0.2, 4, 0.05).name('altitude (radii)');
  gv.add(P, 'fov', 4, 60, 0.5).name('satellite fov');
  gv.add(P, 'inset', 0.15, 0.6, 0.01).name('inset (share of width)');
  gv.add(P, 'groundBack', 6, 120, 1).name('ground camera back (m)');
  gv.add(P, 'groundUp', 1, 60, 1).name('ground camera up (m)');
  gv.add(P, 'rockLines', ['all', 'rim', 'none']).name('rock lines').onChange((m) => planetMesh?.userData.setRockLines?.(m));
  gv.open();
  const gk = gui.addFolder('seconds to destroy');
  gk.add(P, 'burnSoft', 0, 4, 0.05).name('soft body');
  gk.add(P, 'burnHard', 0, 6, 0.05).name('hard body');
  gk.add(P, 'burnWall', 0, 6, 0.05).name('wall');
  gk.add(P, 'burnRock', 0, 6, 0.05).name('rock cell');
  gk.add(P, 'burnTower', 0, 8, 0.05).name('tower');
  gk.add(P, 'burnSeal', 0, 8, 0.05).name('sinkhole');
  gk.add(P, 'burnHeart', 0, 20, 0.1).name('stalheart');
  gk.open();
  /* RESET reloads rather than rebuilding: the base, the sinkhole, the rubble, the bodies and the trail all hang off
     one build() and a second one would have to unpick every handle and could double the frame loop. A reload cannot. */
  const actions = {
    passNow,
    revive,
    reset() { location.reload(); },
    copyPreset() { copyPreset(); },
  };
  const ga = gui.addFolder('actions');
  ga.add(actions, 'passNow').name('PASS NOW');
  ga.add(actions, 'revive').name('REVIVE TARGETS');
  ga.add(actions, 'reset').name('RESET');
  ga.add(actions, 'copyPreset').name('COPY PRESET');
  ga.open();

  function flash(msg) { flashMsg = msg; flashT = 2; console.log(`LASERLAB ${msg}`); }

  function presetJson() {
    return JSON.stringify({
      LASER_ORBIT: { period: P.period, overhead: P.overhead },
      LASER_BEAM: { energy: P.energy, radius: P.radius, slew: P.slew, accel: P.accel, range: P.range },
      LASER_BURN: burnCfg(),
      LASER_VIEW: { altitude: P.altitude, fov: P.fov, inset: P.inset, groundBack: P.groundBack, groundUp: P.groundUp },
      LASER_PRESET: { ...LASER_PRESET, coreWidth: P.coreWidth, glowWidth: P.glowWidth, coreIntensity: P.coreIntensity, glowIntensity: P.glowIntensity, noiseAmount: P.noiseAmount },
    }, null, 2);
  }

  function copyPreset() {
    const json = presetJson();
    const ok = () => { flash('preset copied to clipboard'); console.log('LASERLAB preset:\n' + json); };
    const fail = (why) => {
      /* the clipboard refuses on an unfocused document; the textarea route still works, and the console always has it */
      try {
        const ta = document.createElement('textarea');
        ta.value = json; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const done = document.execCommand('copy');
        ta.remove();
        flash(done ? 'preset copied (fallback)' : 'copy refused — see console');
      } catch { flash('copy refused — see console'); }
      console.log(`LASERLAB preset (clipboard ${why}):\n` + json);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(ok, () => fail('refused'));
    else fail('unavailable');
  }

  const copyBtn = root.querySelector('#laser-copy');
  if (copyBtn) copyBtn.onclick = copyPreset;
  wireDeepLink(root.querySelector('#laser-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'laser', params: P, defaults: P0, carry: location.search,
  }), { label: 'LASER', flash });

  /* --- the harness's hands --------------------------------------------------- */
  // state() is the whole lab in one object: the pass, the beam, the readout counters, what is still standing and the
  // load errors, so a browser step that fails can say WHICH thing never arrived instead of only "no burn".
  const hooks = {
    state: () => ({
      ready,
      phase: st.phase,
      left: +st.left.toFixed(2),
      energy: +st.energy.toFixed(2),
      burning: st.burning,
      /* pole-origin metres, the frame the base and the trench are drawn in — not the planet-centred one the domain holds */
      contact: st.contact ? fromCentre(st.contact).toArray().map((v) => +v.toFixed(2)) : null,
      bodies: run.bodies,
      walls: run.walls,
      rocks: run.rocks,
      towers: run.towers,
      heart: run.heart,
      sealed,
      /* where the hole is, in the same pole-origin metres as `contact`, and whether its crater has actually opened:
         the beam cannot be aimed at a thing whose place the caller cannot ask for, and the sinkhole only opens once
         its four stone textures have loaded and step() has polled sink.ready() */
      sink: sinkPoint.toArray().map((v) => +v.toFixed(2)),
      sinkPhase: sink ? sink.state().phase : null,
      /* the trench's other end, the gate the queue is walking at: the wall cells stand a few metres behind it */
      gate: trench ? trenchPoint(trench.length).toArray().map((v) => +v.toFixed(2)) : null,
      lost: run.heart === 'LOST',
      alive: bodies.filter((b) => b.alive).length,
      wallsStanding: wallCells.filter((w) => !w.gone).length,
      structsStanding: structs.filter((s) => !s.gone).length,
      infinite: P.infinite,
      under: { ...under },
      perf: { ...perf, bodies: bodies.length },
      walkers: bodies.filter((b) => b.walker && b.alive).length,
      keys: [...keys],
      /* the column's live uniforms, in scene units, so a check can see that a slider actually reached the shader */
      look: laser ? laser.look() : null,
      /* standing sentries: a burned one is `gone` in structs */
      sentries: structs.filter((s) => s.id.startsWith('sentry-') && !s.gone).length,
      trail: laser ? laser.trail.count : 0,
      heated: thermal ? thermal.heated() : 0,
      explosions: explosions ? explosions.state() : null,
      flash: flashT > 0 ? flashMsg : null,
      errors: errors.slice(),
    }),
    passNow,
    revive,
    tune: (look) => { Object.assign(P, look); laser?.tune(lookOf()); },
    infinite: (on) => { P.infinite = !!on; keepInfinite(); },
    steer: (nx, ny) => steerTo(nx, ny),
    /* the keys' path without a keyboard: slide the contact east/north (unit-free direction) for `seconds` */
    pad: (east, north, seconds) => padContact(east, north, seconds),
    hold: (on) => { held = !!on; if (!on) steering = false; },
    reset: () => { location.reload(); },
    dispose: () => api.dispose(),
  };
  window.__stalheartLaserTest = hooks;

  hud.querySelector('#laser-pass').onclick = passNow;
  hud.querySelector('#laser-revive').onclick = revive;
  hud.querySelector('#laser-brief').onclick = () => briefing.open();
  hud.querySelector('#laser-reset').onclick = () => { location.reload(); };
  resize();
  build().catch((e) => { errors.push(`build: ${e.message}`); });
  return api;
}
