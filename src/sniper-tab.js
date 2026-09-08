import { createMortarMap } from './labs/mortar-map.js';
import { makeOrdnanceShell } from './shell.js';
import { createShotTrace } from './labs/shot-trace.js';
import { firingFor } from './content/firing-defaults.js';
import { makeSequence, beginSequence, stepSequence } from './domain/trigger-sequence.js';
import { createWeaponVoice } from './weapon-voice.js';
// sniper-tab.js — manual operation of the shared Sentry roster, with an optic aimed at
// things a long way off, with the physics that make the shot interesting:
// drop, time of flight, an alien crosswind that gusts, a reticle that will
// not hold still, a zero you set and a rangefinder you may or may not have.
//
// Shared Sentry content owns weapons; domain/ballistics.js owns the environment integrator. This owns the
// scope, the reticle and the rifle — and the ONE rule that matters here is
// that the round the player watches and the hold the HUD prints come out of
// the same integrator. A sniper mechanic is a promise that the number on the
// glass is the number the bullet obeys.
//
// THE ASSIST LADDER is the automation arc in miniature (docs/AUTOMATION-ARC.md):
// every readout starts OFF and can be switched on one at a time, which is
// both the difficulty knob the operator asked for and a rehearsal of the
// chips Isao is meant to print.
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import GUI from '../vendor/lil-gui.esm.js';
import { makeBloom } from './postfx.js';
import { bakeGalaxyCube } from './galaxybake.js';
import { SKY_PRESET } from './galaxyseed.js';
import { LOOKS } from './looks.js';
import { makeDotEnemy } from './units.js';
import { CREATURE_TINTS, accentFor, ENEMY_SPEC } from './enemyspec.js';
import { mulberry32 } from './rng.js';
import { makeAudio } from './audio.js';
import { deepLink, wireDeepLink } from './deeplink.js';
import { sentryUrl } from './sentry.js';
import { sweepAngle, radarPhosphor } from './radar.js';
import {
  launchAngleFor, BALLISTICS_TUNE, MRAD, toMrad, windAt, launch, step, solution, zeroAngle,
  makeShooter, stepBreath, sway, rangeFromMrad, STEP, MAX_T, nextPlate,
  splashHits,
} from './domain/ballistics.js';
import { makeLock } from './domain/lockon.js';
import { missileLimits, stepMissileLock, missileCanFire, missileDistanceInRange } from './domain/missile-targeting.js';
import { manualWeapon } from './domain/manual-weapon.js';
import { METRES_PER_CELL } from './core/stage-units.js';
import { SENTRIES } from './content/sentries.js';
import { TOWER_BY_KEY, effectiveStats } from './towers.js';
import { CONTENT } from './content/runtime.js';
import { clone, resolveSounds } from './content/preset.js';
import { A6_TUNE, magFor } from './domain/heptapod.js';
import { MISSILE_LAUNCH_ELEVATION } from './content/missile-defaults.js';
import { createMissilePool, launchDart, advanceDart } from './missiles.js';
import { makeTracerMesh, makeBeamShot, makeLightningMesh } from './shotfx.js';
import { makeImpactBurst, orientImpact } from './impactfx.js';
import { tuneFor, resolveImpactColors } from './sentryfx.js';
import { mountPresetPanel } from './labs/preset-panel.js';
import { mountSentryEffects } from './labs/sentry-effects.js';

const TARGET_TYPES = ['phage', 'ghost', 'corona', 'barbed'];
const TARGET_H = 1.9;      // metres — what the rangefinder mil-relation uses
// the board's own three death voices, so a body dying here sounds like a body
// dying there
const DEATHS = ['enemy_die_a', 'enemy_die_b', 'enemy_die_c'];

export function initSniperTab(root) {
  let active = false, disposed = false, frameId = 0, modelSerial = 0;
  const listeners = new AbortController();
  const listen = (target,event,fn,options={}) => target.addEventListener(event,fn,{...options,signal:listeners.signal});
  let draft=clone(CONTENT), missilePool=null;
  const sequence=makeSequence(),cueLog=[];let heldBeam=null;
  const metrics={launched:0,arrived:0,last:null,impacts:0};
  createMissilePool().then(pool=>{if(disposed)pool.dispose();else missilePool=pool;}).catch(error=>{root.dataset.assetError=error.message;});
  const q = new URLSearchParams(location.search);
  const container = root.querySelector('#sniper-app');
  const hud = root.querySelector('#sniper-hud');
  const reticleEl = root.querySelector('#sniper-reticle');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // the scope: a long lens. FOV is DERIVED from the magnification, so the
  // reticle's milliradians are true on the glass at any zoom — a mil that is
  // not a mil is a scope that cannot be ranged with.
  const camera = new THREE.PerspectiveCamera(6, 1, 0.5, 4000);

  const sky = bakeGalaxyCube(renderer, { ...SKY_PRESET, seed: 4414, face: 1024, galaxies: 2 });
  scene.background = sky.texture;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromCubemap(sky.texture);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.7;
  const sun = new THREE.DirectionalLight(0xffe9cf, 2.6); sun.position.set(-40, 60, 30); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8ab4ff, 0.7); fill.position.set(50, 20, -20); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xbfd0e6, 0x1a1712, 0.5));
  const look = LOOKS.tronColors;

  // THE GROUND, out to the far targets. A plane with a wire on it: the wire
  // is the only depth cue a scope has, and without one a target at 900 m and
  // one at 300 m are the same smudge.
  const GROUND = 2200;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(GROUND * 2, GROUND * 2),
    new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // 100 m squares, faint. At 10x a fine grid piles into a solid band at the
  // horizon and hides exactly the thing the scope is for; a coarse one is a
  // DEPTH CUE, which is the only reason it is here — without it a target at
  // 900 m and one at 300 m are the same smudge.
  const grid = new THREE.GridHelper(GROUND * 2, Math.round((GROUND * 2) / 100),
    look.edges.color, look.edges.color);
  grid.material.transparent = true; grid.material.opacity = 0.07;
  grid.position.y = 0.03; scene.add(grid);
  scene.fog = new THREE.Fog(0x14161c, GROUND * 0.5, GROUND * 2.2);
  const postfx = makeBloom(renderer, scene, camera, { scale: 1, strength: 0.22, radius: 0.5, threshold: 0.5 });

  const P = {
    tier: 1,
    weapon: 'lancer',
    mag: 2,               // scope magnification
    ...BALLISTICS_TUNE, zero:20, wind:0,
    range: 20,            // where the next target stands
    spread: 6,           // ...± this
    targets: 4,
    targetR: 0.55,         // metres — the kill radius
    seed: 4414,
    quiverPrototype:true,prototypeRange:1000,
    tracer: true,
    traceHold: 1.5,
    // PHASE 1 IS CALIBRATION. A black-and-white target at a known distance
    // and a fixed number of shots: read the conditions, dial the hold, and
    // see your group. Phase 2 is what the calibration was FOR.
    phase: 'calibrate',    // calibrate | contact
    allotted: 5,           // shots in a calibration string
    moverSpeed: 3.2,       // m/s across the line of sight, in contact
    sound: true,
    // YOU DO NOT SEE YOUR OWN RIFLE DOWN YOUR OWN SCOPE. The Lancer is still
    // the gun — its muzzle sets the launch height, its PITCH node carries the
    // optic, its RECOIL node kicks — but the camera sits AT the optic, which
    // is inside the receiver, so leaving it drawn fills the frame with grey
    // metal and nothing else. On for a look at the rig; off to shoot.
    showRifle: false,
    closeup: true,         // the spotting monitor
    scan: true,            // the PPI
    // THE ASSIST LADDER — every one of these is a chip Isao has not printed
    // yet. Off is the game the operator described; on is the difficulty knob.
    rangefinder: false,    // the HUD prints the range
    windRead: false,       // ...and the wind
    firingSolution: false, // ...and marks the hold on the reticle
    autoHold: false,       // ...and simply dials it for you
  };
  const P0 = { ...P };
  for (const [k, v] of q.entries()) {
    if (!(k in P) || typeof P[k] === 'function') continue;
    if (typeof P[k] === 'number') { const n = parseFloat(v); if (Number.isFinite(n)) P[k] = n; }
    else if (typeof P[k] === 'boolean') P[k] = v !== '0';
    else P[k] = v;
  }

  // --- state ---------------------------------------------------------------
  let opticHeight=1.5;
  let rifle = null, yawNode = null, pitchNode = null, muzzleNode = null, recoilNode = null;
  const legacyWeapon={javelin:'quiver',laser:'lancer',railgun:'needle',howitzer:'needle'};
  P.weapon=legacyWeapon[P.weapon] || (TOWER_BY_KEY[P.weapon]?P.weapon:'lancer');
  P.tier=Math.max(1,Math.min(3,Math.round(P.tier)));
  const profile=()=>draft.weapons[P.weapon];
  const configuration=()=>{const def=TOWER_BY_KEY[P.weapon],base=draft.missiles[P.weapon];
    if(!base)return null;const config=missileLimits(base,effectiveStats(def,P.tier-1).range/def.range);
    if(P.weapon==='quiver'&&P.quiverPrototype){config.maxRange=Math.max(100,Math.min(2000,P.prototypeRange));config.aimTolerance=Math.max(config.aimTolerance,config.lockGate);}
    return config;};
  function weaponSpec(){const def=TOWER_BY_KEY[P.weapon],w=manualWeapon(def,effectiveStats(def,P.tier-1),profile(),draft.missiles[P.weapon],METRES_PER_CELL),config=configuration();if(config){w.range=config.maxRange;w.minRange=config.minRange;}return w;}
  let W=weaponSpec();
  let mortarAim=[0,0,Math.min(P.range||20,W.range*.6)];
  const mortarMap=createMortarMap(container,renderer,scene,point=>{const distance=Math.hypot(point[0],point[2]);if(distance<=W.range&&distance>1)mortarAim=point;else hudNote='AIM WITHIN MORTAR RANGE';});
  function applyRound(){P.muzzleVel=W.muzzleVel;P.maxTime=60;P.step=STEP;}
  applyRound();
  let cool = 0, charging = 0, cassette=magFor(P.tier-1);
  // THE SEEKER. One lock per shooter, and a list of missiles in the air —
  // they are not `rounds`, because nothing about them is ballistic: they
  // carry their own target and their own guidance and they ignore the hold.
  const lock = makeLock();
  const missiles = [];
  let lockNote = 0;
  function setWeapon(id) {
    P.weapon=TOWER_BY_KEY[id]?id:'lancer';W=weaponSpec();applyRound();
    clearShots();mortarAim=[0,0,Math.min(P.range||20,W.range*.6)];cool=0;charging=0;cassette=magFor(P.tier-1);holdUp=0;holdSide=0;
    Object.assign(soundDefs,resolveSounds(draft));
    loadRifle();effectsPanel.refresh();
    nameWeapon();
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    hudNote = `${W.label.toUpperCase()} — ${W.hitscan ? 'no drop, no wind, no lead'
      : W.loft ? 'lobbed; wait for it' : W.charge ? 'charge, then it is nearly flat' : 'drop and wind'}`;
  }

  const soundDefs=resolveSounds(draft);
  const sfx = makeAudio({ seed: 1, sounds:soundDefs, persist:false });
  // ARM IT. A browser will not start an AudioContext without a gesture, and
  // `makeAudio` only listens for one once it has been asked to — every other
  // tab with sound calls this and the sniper did not, so the gun was silent
  // and nothing said why.
  sfx.arm();
  const weaponVoice=createWeaponVoice(sfx,()=>P.sound,cue=>{cueLog.push(cue);if(cueLog.length>80)cueLog.shift();});
  const shooter = makeShooter();
  // THE STRING: a calibration is a fixed number of shots, and what you learn
  // from it is the GROUP — where the rounds went together, not where any one
  // of them went. Held in metres AND milliradians, because the correction a
  // shooter dials is angular and the group they look at is linear.
  const string = [];   // { dx, dy, range, mradX, mradY }
  let aimYaw = 0, aimPitch = 0;      // where the SHOOTER is pointing, radians
  let holdUp = 0, holdSide = 0;      // ...and what they have dialled on, mrad
  // the board's cannon recoil, in the board's own shape: a hard kick eased
  // out over RECOIL_COOL. Bigger than the sentry's because a scope MAGNIFIES
  // the kick — at 10x a tenth of a milliradian is a visible jump, and that
  // is the whole reason a sniper's recoil reads.
  const RECOIL_KICK = 0.42, RECOIL_COOL = 0.55;
  let recoil = 0, clock = 0;
  let rng = mulberry32(P.seed >>> 0);
  const targets = [];                // { obj, pos, id, alive }
  const rounds = [];                 // live bullets
  const fx = [];
  let lastRange = 0, lastShot = null;
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

  const disposeObj = (o) => o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    const m = n.material;
    if (Array.isArray(m)) m.forEach((x) => x && x.dispose && x.dispose());
    else if (m && m.dispose) m.dispose();
  });

  // --- the rifle -----------------------------------------------------------
  // The Lancer, from the sentry workshop, under its own name contract. The
  // camera rides the PITCH node, so the scope moves with the barrel — which
  // is what makes the recoil kick the view and the sway move the shot.
  function loadRifle(){
    const serial=++modelSerial;root.dataset.modelReady='false';
    if(rifle){scene.remove(rifle);disposeObj(rifle);}
    rifle=yawNode=pitchNode=muzzleNode=recoilNode=null;
    new GLTFLoader().load(sentryUrl(TOWER_BY_KEY[P.weapon].model,P.tier),gltf=>{
      if(disposed||serial!==modelSerial){disposeObj(gltf.scene);return;}
      rifle=gltf.scene;yawNode=rifle.getObjectByName('YAW');pitchNode=rifle.getObjectByName('PITCH');
      recoilNode=rifle.getObjectByName('RECOIL');
      rifle.traverse(o=>{if(/^MUZZLE_\d+$/.test(o.name||''))muzzleNode ||= o;});
      rifle.visible=P.showRifle;scene.add(rifle);
      rifle.updateMatrixWorld(true);if(muzzleNode){muzzleNode.getWorldPosition(tmpV);opticHeight=tmpV.y;}
      root.dataset.modelReady='true';
      if(P.showRifle)frameRifle();
    },undefined,error=>{if(serial===modelSerial){const note=hud||root.querySelector('#f-note');if(note)note.textContent=`Model failed to load: ${error.message}`;}});
  }
  loadRifle();


  // A BLACK AND WHITE TARGET, because "it is unclear what we are shooting
  // at" (operator) — and because a calibration needs rings to read a group
  // against, not a silhouette. Built as concentric discs on one billboard,
  // in metres, so the mil-relation works on it exactly as it does on a
  // person: the black centre is `targetR` across and the outer ring is a
  // known width to mil from.
  // the face is FACE_R radii from the centre; the kill zone is one radius,
  // which is KILL_F of the face
  const FACE_R = 3, KILL_F = 1 / 3;
  function makeCalTarget(radius) {
    // ONE PLANE WITH A DRAWN TEXTURE, not five coplanar discs. The first cut
    // stacked circles 4 mm apart and let `lookAt` turn the stack: at 500 m
    // that offset is far below the depth buffer's resolution, so the rings
    // z-fought and the target rendered as a shattered star. A canvas has no
    // depth at all, draws sharper, and costs one quad.
    const S = 512;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, S, S);
    const mid = S / 2;
    // five rings, outermost first — a paper white and a near-black, both off
    // the extremes so the bloom pass leaves them alone
    // THE FACE IS NOT THE KILL ZONE. Sizing the whole target off the kill
    // radius made a 0.55 m radius into a 5.5 m board that had to stand three
    // metres up to clear its own bottom edge — a billboard, not a range
    // target. The face is a fixed 6 radii across and the innermost ring IS
    // the kill zone, so `hitsAt(miss, targetR)` still scores what you see.
    const RINGS = [[1.0, '#b9b9b4'], [0.78, '#0e0e10'], [0.56, '#b9b9b4'],
      [KILL_F * 1.6, '#0e0e10'], [KILL_F, '#b9b9b4']];
    for (const [f, col] of RINGS) {
      c.fillStyle = col;
      c.beginPath();
      c.arc(mid, mid, mid * f * 0.98, 0, Math.PI * 2);
      c.fill();
    }
    // the aiming cross, so the centre is findable at 800 m where the inner
    // disc is two pixels across
    c.strokeStyle = '#ff3b30';
    c.lineWidth = Math.max(2, S * 0.012);
    c.beginPath();
    c.moveTo(mid, mid - S * 0.42); c.lineTo(mid, mid + S * 0.42);
    c.moveTo(mid - S * 0.42, mid); c.lineTo(mid + S * 0.42, mid);
    c.stroke();
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.colorSpace = THREE.SRGBColorSpace;
    const side = radius * FACE_R * 2;
    const g = new THREE.Group();
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(side, side),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    g.add(face);
    // ...and a stand, so it is a thing standing on the ground rather than a
    // disc hovering over it — which is also what stops the bottom half being
    // buried when the centre sits lower than the radius
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(side * 0.06, side * 0.5, side * 0.06),
      new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.95 }));
    stand.position.y = -side * 0.5;
    g.add(stand);
    g.userData.plate = g;
    g.userData.face = face;
    return g;
  }

  // --- the range -----------------------------------------------------------
  function clearTargets() {
    while (targets.length) { const t = targets.pop(); scene.remove(t.obj); disposeObj(t.obj); }
  }
  function spawnTargets() {
    clearShots();plateFalls.length=0;clearTargets();cool=0;cassette=magFor(P.tier-1);
    rng = mulberry32(P.seed >>> 0);
    string.length = 0;
    if (P.phase === 'calibrate') {
      // ONE target, dead ahead, at a known distance. A calibration is not a
      // hunt: the range is given, the conditions are given, and the only
      // question is whether you can read them.
      const d = P.range;
      const obj = makeCalTarget(P.targetR);
      // its centre sits one full radius up plus the stand, so the whole face
      // is above the ground rather than half-buried
      // chest height on its stand, near the optic's own line, so a
      // calibration starts with the target ON the cross rather than above it
      const cy = Math.max(1.6, P.targetR * FACE_R + 0.15);
      obj.position.set(0, cy, d);
      scene.add(obj);
      targets.push({ id: 1, obj, pos: [0, cy, d], alive: true, d, cal: true });
      hudNote = `CALIBRATION · ${Math.round(P.allotted)} shots at ${d.toFixed(0)} m`;
      return;
    }
    for (let i = 0; i < Math.round(P.targets); i++) {
      const d = P.range + (rng() * 2 - 1) * P.spread;
      const off = (rng() * 2 - 1) * 22;
      const pos = [Math.sin(off / MRAD) * d, 0, Math.cos(off / MRAD) * d];
      const type = TARGET_TYPES[i % TARGET_TYPES.length];
      // the creature, PLUS a post it stands on. At 800 m a dot cloud is a
      // handful of pixels with sky behind it; the post gives it a silhouette
      // to be seen against and a base to mil FROM.
      const grp = new THREE.Group();
      const obj = makeDotEnemy(type, { walker: CREATURE_TINTS[type], walkerHi: accentFor(type) });
      obj.scale.setScalar(TARGET_H * 0.5);
      obj.position.y = TARGET_H * 0.5;
      grp.add(obj);
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, TARGET_H, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.9 }));
      post.position.y = TARGET_H * 0.5;
      grp.add(post);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshBasicMaterial({ color: 0xd8c9a8, side: THREE.DoubleSide }));
      plate.position.y = TARGET_H * 0.78;
      grp.add(plate);
      grp.position.set(pos[0], 0, pos[2]);
      grp.userData.plate = plate;
      scene.add(grp);
      // PHASE 2: THEY MOVE. A crossing target is what the time of flight is
      // FOR — at 800 m a round is in the air 1.7 s, and a walker covers five
      // metres in that. The calibration taught the drop; this asks for lead.
      targets.push({ id: i + 1, obj: grp, pos: [pos[0], TARGET_H * 0.78, pos[2]],
        alive: true, d, vx: (rng() < 0.5 ? -1 : 1) * P.moverSpeed * (0.7 + rng() * 0.6) });
    }
    hudNote = `CONTACT · ${targets.length} moving`;
  }

  // A PLATE THAT HAS BEEN HIT topples backwards about its own base over
  // `fall`, then the next one rises out of the ground where nextPlate put
  // it. Neither is decoration: the topple is the hit confirmation at a range
  // where the round takes a second and a half to arrive, and the new plate
  // being SOMEWHERE ELSE is the re-calibration the whole exercise is for.
  const FALL = 0.55, RISE = 0.5, DIE = 0.9;
  function knockDown(t) {
    if (t.falling !== undefined) return;
    t.falling = 0;
    t.alive = false;             // no more hits on a plate already going down
    plateFalls.push(t);
  }

  // A BODY GOES OVER rather than blinking off: pitched forward about its feet
  // with a twist in the fall, sinking, then shrinking out over the last third
  // — the dot-cloud burst on top of it. It shares the plate's list because it
  // is the same problem: a thing that has been hit and is not gone yet.
  function killBody(t) {
    if (t.falling !== undefined) return;
    t.falling = 0;
    t.dying = true;
    t.alive = false;
    t.spin = (t.pos[0] >= 0 ? 1 : -1) * (0.6 + rng() * 0.5);
    plateFalls.push(t);
  }

  const plateFalls = [];
  function stepPlates(dt) {
    for (let i = plateFalls.length - 1; i >= 0; i--) {
      const t = plateFalls[i];
      t.falling += dt;
      if (t.dying) {
        const ud = Math.min(1, t.falling / DIE);
        const e = ud * ud * (3 - 2 * ud);
        t.obj.rotation.x = -e * (Math.PI / 2) * 1.05;
        t.obj.rotation.z = e * t.spin;
        t.obj.position.y = -e * TARGET_H * 0.25;
        t.obj.scale.setScalar(Math.max(0.001, 1 - Math.max(0, (ud - 0.66) / 0.34)));
        if (ud < 1) continue;
        scene.remove(t.obj); disposeObj(t.obj);
        plateFalls.splice(i, 1);
        const gone = targets.indexOf(t);
        if (gone >= 0) targets.splice(gone, 1);
        continue;
      }
      const u = Math.min(1, t.falling / FALL);
      // about the base, so it hinges rather than sinking
      const half = P.targetR * FACE_R;
      t.obj.rotation.x = -(u * u) * (Math.PI / 2);
      t.obj.position.y = t.pos[1] - Math.sin((u * u) * (Math.PI / 2)) * half * 0.55;
      if (u < 1) continue;
      scene.remove(t.obj); disposeObj(t.obj);
      plateFalls.splice(i, 1);
      const at = targets.indexOf(t);
      if (at >= 0) targets.splice(at, 1);
      popPlate(t);
    }
    // the new one rises
    for (const t of targets) {
      if (!t.cal || t.rising === undefined) continue;
      t.rising = Math.min(1, t.rising + dt / RISE);
      const e = t.rising * t.rising * (3 - 2 * t.rising);
      t.obj.position.y = t.pos[1] - (1 - e) * P.targetR * FACE_R * 2.2;
      if (t.rising >= 1) delete t.rising;
    }
  }

  function popPlate(prev) {
    const p2 = nextPlate(
      { range: Math.hypot(prev.pos[0], prev.pos[2]), bearing: Math.atan2(prev.pos[0], prev.pos[2]) },
      rng, P, [Math.max(1, P.range - P.spread), P.range + P.spread]);
    const cy = Math.max(1.6, P.targetR * FACE_R + 0.15);
    const obj = makeCalTarget(P.targetR);
    obj.position.set(Math.sin(p2.bearing) * p2.range, cy, Math.cos(p2.bearing) * p2.range);
    scene.add(obj);
    const t = { id: prev.id + 1, obj, pos: [obj.position.x, cy, obj.position.z],
      alive: true, d: p2.range, cal: true, rising: 0 };
    targets.push(t);
    // the string is NOT reset: a calibration is a group across the plates it
    // was fired at, and the point of moving them is that the hold has to be
    // re-read for each one
    hudNote = `PLATE DOWN — next up at ${p2.range.toFixed(0)} m · re-read it`;
    return t;
  }

  // --- the enemy ------------------------------------------------------------
  // SPAWNED ON DEMAND, and it comes for you. A closer target every second is
  // what makes the rangefinder worth having and the lead worth computing —
  // and unlike the crossing movers it changes the RANGE, which is the axis
  // the drop lives on.
  // A REAL ENEMY, on the board's own spec: its hp, its size, its speed, its
  // colours, and the behaviours the TD tab gives it — the erratic bursts, the
  // jink weave, the optical camo. Nothing new is invented here; the sniper
  // reads ENEMY_SPEC exactly as the board does, so a phage behaves like a
  // phage and a shellback soaks like a shellback.
  // minus the SHELVED ones — the point of this list is that it is the board's
  // roster, so it has to track the shelf as well as the additions.
  const REAL_TYPES = Object.keys(ENEMY_SPEC).filter((k) => !ENEMY_SPEC[k].shelved);
  function spawnReal(type) {
    const id = type && ENEMY_SPEC[type] ? type
      : REAL_TYPES[Math.floor(rng() * REAL_TYPES.length) % REAL_TYPES.length];
    const spec = ENEMY_SPEC[id];
    const d = P.range + P.spread * (0.6 + rng() * 0.5);
    const bearing = aimYaw + (rng() * 2 - 1) * 0.05;
    const grp = new THREE.Group();
    const obj = makeDotEnemy(id, { walker: CREATURE_TINTS[id], walkerHi: accentFor(id) });
    const h = TARGET_H * (spec.size || 1) * 0.6;
    obj.scale.setScalar(h * 0.5);
    obj.position.y = h * 0.5;
    grp.add(obj);
    grp.position.set(Math.sin(bearing) * d, 0, Math.cos(bearing) * d);
    scene.add(grp);
    const t = {
      id: 200 + targets.length, obj: grp, kind: id, spec,
      pos: [grp.position.x, h * 0.55, grp.position.z],
      alive: true, d, hp: spec.hp, h,
      // the board's own pace: ENEMY_SPEED is a board constant in cells, so the
      // sniper reads the SPEC's multiplier and scales it into metres itself
      closing: P.moverSpeed * (spec.speed || 1) * (0.85 + rng() * 0.3),
      phase: rng() * 6.283, cloak: !!spec.cloaked, erratic: !!spec.erratic, jink: !!spec.jink,
      body: obj,
    };
    targets.push(t);
    hudNote = `${id.toUpperCase()} inbound at ${d.toFixed(0)} m · ${spec.hp} hp`
      + `${spec.cloaked ? ' · OPTICAL CAMO' : ''}${spec.rammable ? '' : ' · SOLID'}`;
    if (P.sound) sfx.play('danger_alert');
    return t;
  }

  function spawnEnemy() {
    const d = P.range + P.spread * 0.9;
    const bearing = aimYaw + (rng() * 2 - 1) * 0.02;
    const type = TARGET_TYPES[(targets.length + 1) % TARGET_TYPES.length];
    const grp = new THREE.Group();
    const obj = makeDotEnemy(type, { walker: CREATURE_TINTS[type], walkerHi: accentFor(type) });
    obj.scale.setScalar(TARGET_H * 0.5);
    obj.position.y = TARGET_H * 0.5;
    grp.add(obj);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xd8c9a8, side: THREE.DoubleSide }));
    plate.position.y = TARGET_H * 0.78;
    grp.add(plate);
    grp.position.set(Math.sin(bearing) * d, 0, Math.cos(bearing) * d);
    grp.userData.plate = plate;
    scene.add(grp);
    const t = { id: 100 + targets.length, obj: grp,
      pos: [grp.position.x, TARGET_H * 0.78, grp.position.z],
      alive: true, d, closing: P.moverSpeed };
    targets.push(t);
    hudNote = `CONTACT — inbound at ${d.toFixed(0)} m`;
    if (P.sound) sfx.play('danger_alert');
    return t;
  }

  // The target under the reticle, and how far away it is — the rangefinder's
  // job, done the same way whether a chip prints it or the player mils it.
  function underReticle(maxOff = 12) {
    let best = null, bd = Infinity;
    for (const t of targets) {
      if (!t.alive) continue;
      if(W.homing&&!missileDistanceInRange(Math.hypot(t.pos[0],t.pos[2]),configuration()))continue;
      const dx = t.pos[0], dz = t.pos[2];
      // measured from the OPTIC's height, not from the ground: a target
      // whose centre is level with the scope is at zero elevation, and the
      // ground-relative version put a 500 m target 12.7 mrad off the cross it
      // was sitting on
      const bearing = Math.atan2(dx, dz);
      const elev = Math.atan2(t.pos[1] - camera.position.y, Math.hypot(dx, dz));
      const off = Math.hypot(bearing - aimYaw, elev - aimPitch) * MRAD;
      if (off < maxOff && off < bd) { bd = off; best = t; }
    }
    return best ? { t: best, off: bd, range: Math.hypot(best.pos[0], best.pos[2]) } : null;
  }

  // --- the shot ------------------------------------------------------------
  // The round leaves along the SHOOTER'S aim plus the dialled hold plus the
  // sway — and then it is the integrator's, not the renderer's. Every frame
  // it is stepped by the same function the HUD's solution used.
  function fire(){
    const p=firingFor(W.id);
    if(p.duration){if(beginSequence(sequence,p))weaponVoice.update(W.id,true);return;}
    fireRound();
  }
  function fireRound(released = false) {
    if (cool > 0 || disposed || root.dataset.modelReady!=='true') return;
    if(W.field){activateField();return;}
    if(TOWER_BY_KEY[W.id].attack==='walker' && cassette<=0){hudNote='CASSETTE RELOADING';return;}
    // THE RAIL GUN'S COST IS NOT ITS DROP, IT IS THE WAIT. Charging holds you
    // still and pointed for a second and a half — which in a crosswind, with
    // a target closing, is the whole weapon.
    if (W.charge > 0 && charging <= 0 && !released) {
      charging = W.charge;
      if (P.sound) sfx.play('tank_spool_up');
      hudNote = `CHARGING — ${W.charge.toFixed(1)} s`;
      return;
    }
    const sw = sway(clock, shooter, P);
    let yaw = aimYaw + (W.id==='lancer'?0:holdSide) / MRAD + sw[0] / MRAD;
    // a lobbed weapon has no flat zero to hold over — its whole launch angle
    // IS the hold, so the zero term drops out and the dialled hold is the arc
    // ...and a BEAM has no zero either: it does not drop, so a rifle's
    // hold-over would put it above everything it was pointed at.
    const zed = (W.loft || W.hitscan) ? 0 : zeroAngle(P.zero, P);
    // A LOB IS NOT AIMED ALONG THE SIGHT LINE. For a flat weapon the hold is
    // a correction ON TOP of where the optic points; for the mortar the hold
    // IS the launch angle, absolute, and adding the sight's own elevation to
    // it puts the barrel a couple of milliradians high — which on the far
    // side of the arc is fifteen metres short at seven hundred.
    const base = W.loft ? 0 : aimPitch;
    let pitch = base + (W.id==='lancer'?0:holdUp) / MRAD + sw[1] / MRAD + zed;
    if(W.loft){const range=Math.hypot(mortarAim[0],mortarAim[2]);pitch=launchAngleFor(range,P,true)+holdUp/MRAD;yaw=Math.atan2(mortarAim[0],mortarAim[2])+holdSide/MRAD;
      if(!Number.isFinite(pitch)){hudNote='NO MORTAR SOLUTION';return;}}
    const s = launch(0, 0, P, clock);
    // re-aim the launch into world space: the module fires down +Z, the range
    // is a world with a bearing
    const v = P.muzzleVel;
    s.v = [
      Math.sin(yaw) * Math.cos(pitch) * v,
      Math.sin(pitch) * v,
      Math.cos(yaw) * Math.cos(pitch) * v,
    ];
    s.p = [0, muzzleHeight(), 0];
    // A HITSCAN ROUND DOES NOT FLY. It is resolved on the frame it is fired,
    // along the barrel, and drawn as a beam that fades — so the laser tests
    // only the sway, which is the point of having it.
    if (W.hitscan) { hitscan(yaw, pitch); return; }
    // Guided shots use the shared engagement gate with the operator's aim.
    if (W.homing) { launchSeeker(yaw, pitch); return; }
    const shot=profile().shot;
    const mesh=makeTracerMesh(TOWER_BY_KEY[W.id].color,shot.projPx,shot.trail);
    const trace=W.id==='needle'?createShotTrace():null;
    if(trace){trace.sample(s.p);mesh.add(trace.group);}
    mesh.visible = P.tracer;
    scene.add(mesh);
    const shell=W.loft?makeOrdnanceShell(.65):null;if(shell){scene.add(shell);shell.position.fromArray(s.p);}
    rounds.push({ s, mesh, trace, shell, trail: [], weapon:{...W},profile:clone(profile()),tune:{...P} });
    // The Sentry owns its cue and cadence; scope recoil belongs to this stage.
    weaponVoice.shot(W.id);
    cool = W.cooldown;
    recoil = RECOIL_KICK;
    shooter.shots++;
    lastShot = { yaw, pitch, at: clock };
    emitEffect('muzzle',[0,muzzleHeight(),0],[Math.sin(yaw),Math.sin(pitch),Math.cos(yaw)]);
  }

  const muzzleHeight = () => {
    if(W.id==='lancer'&&!P.showRifle)return opticHeight;
    if (!muzzleNode) return 1.5;
    muzzleNode.updateWorldMatrix(true, false);
    muzzleNode.getWorldPosition(tmpV);
    return tmpV.y;
  };

  // --- the seeker ----------------------------------------------------------
  // THE MISSILE IS FIRED DOWN THE BARREL AND THEN STOPS CARING. It leaves
  // slowly, along the aim, and from the second step onward it is flying its
  // own intercept on the target the lock named — which is why the reward for
  // holding the reticle still is that you no longer have to aim.
  function clearShots(){
    mortarMap?.reset();
    sequence.left=0;sequence.gap=0;heldBeam=null;weaponVoice.dispose();
    Object.assign(lock,makeLock());
    for(const m of missiles){scene.remove(m.mesh);missilePool?.release(m.mesh);}missiles.length=0;
    for(const r of rounds){scene.remove(r.mesh);disposeObj(r.mesh);if(r.shell){scene.remove(r.shell);disposeObj(r.shell);}}rounds.length=0;
    for(const f of fx){scene.remove(f.obj);disposeObj(f.obj);}fx.length=0;
  }
  function emitEffect(slot,point,normal,weapon=profile()){
    const effect=weapon[slot];
    const obj=makeImpactBurst(effect.recipe,tuneFor(effect),resolveImpactColors(effect,{weapon:weapon.shot.beamColor||0xffffff}),metrics.impacts+shooter.shots+1,effect.size);
    orientImpact(obj,point,normal);scene.add(obj);fx.push({obj,tick:obj.userData.tick});
    if(slot==='impact')metrics.impacts++;
    while(fx.length>128){const old=fx.shift();scene.remove(old.obj);disposeObj(old.obj);}
  }
  function launchSeeker(yaw,pitch){
    const config=configuration(),u=underReticle(config.lockBreak*Math.PI/180*MRAD);
    const target=targets.find(t=>t.alive&&t.id===lock.id);
    const error=u&&target&&u.t===target?u.off/MRAD*180/Math.PI:Infinity;
    const distance=target?Math.hypot(target.pos[0],target.pos[2]):Infinity;
    if(!missileCanFire(lock,target,distance,error,config,cool,!!missilePool?.available)){
      hudNote=lock.locked?`LOCKED · centre target within ${config.aimTolerance.toFixed(1)}° to fire`:`NO LOCK · acquire at ${config.minRange.toFixed(1)}–${config.maxRange.toFixed(0)} m`;return;
    }
    const from=new THREE.Vector3(0,muzzleHeight(),0),direction=new THREE.Vector3(0,1,0);
    rifle.updateMatrixWorld(true);
    if(muzzleNode){muzzleNode.getWorldPosition(from);muzzleNode.getWorldQuaternion(tmpQ);direction.set(0,0,1).applyQuaternion(tmpQ);}
    if(W.id==='quiver'&&P.quiverPrototype)config.duration=Math.max(config.duration,Math.min(6,distance/180));
    const m=launchDart(missilePool,{config,from:from.toArray(),target:target.pos,direction:direction.toArray()});
    if(!m)return;
    Object.assign(m,{tid:target.id,weapon:{...W},profile:clone(profile())});
    scene.add(m.mesh);missiles.push(m);Object.assign(lock,makeLock());
    if(TOWER_BY_KEY[W.id].attack==='walker')cassette--;
    metrics.launched++;metrics.last={key:W.id,config:{...config},direction:direction.toArray(),model:TOWER_BY_KEY[W.id].model};
    weaponVoice.shot(W.id);cool=cassette===0?A6_TUNE.refillSecs:W.cooldown;recoil=RECOIL_KICK*.45;shooter.shots++;hudNote='AWAY';
    emitEffect('muzzle',from.toArray(),direction.toArray());
  }
  function stepMissiles(dt){
    for(let i=missiles.length-1;i>=0;i--){
      const m=missiles[i],target=targets.find(t=>t.alive&&t.id===m.tid);
      const arrived=advanceDart(missilePool,m,dt,target?target.pos:m.target);m.mesh.visible=P.tracer;
      if(!arrived)continue;
      if(target)resolveHit(target,0,new THREE.Vector3(...m.target),m.weapon,m.profile);
      else emitEffect('impact',m.target,[0,1,0],m.profile);
      metrics.arrived++;scene.remove(m.mesh);missilePool.release(m.mesh);missiles.splice(i,1);
    }
  }
  function stepSeeker(dt){
    if(!W.lock){Object.assign(lock,makeLock());return;}
    const config=configuration(),u=underReticle(config.lockBreak*Math.PI/180*MRAD);
    const was=lock.locked;
    stepMissileLock(lock,dt,u?.t||null,u?.range??Infinity,(u?.off??Infinity)/MRAD*180/Math.PI,config);
    if(lock.locked&&!was){if(P.sound)sfx.play('laser_click');hudNote='TARGET LOCKED';lockNote=clock;}
    else if(was&&!lock.locked)hudNote='LOCK BROKEN';
  }
  function activateField(){
    // Relay emits a local slow field; it never becomes a damaging sniper round.
    for(const target of targets){
      if(!target.alive||Math.hypot(target.pos[0],target.pos[2])>W.range)continue;
      target.slowUntil=clock+TOWER_BY_KEY.relay.slowDur;
      const obj=makeLightningMesh([0,muzzleHeight(),0],target.pos,TOWER_BY_KEY.relay.color);
      scene.add(obj);let life=0;fx.push({obj,tick:dt=>(life+=dt)<.25});
    }
    cool=W.cooldown;weaponVoice.shot(W.id);hudNote='RELAY FIELD · nearby contacts slowed';
  }

  // THE LASER. Nothing to integrate: it lands where the barrel points, at the
  // range of whatever is under it, this frame. The beam is drawn for a
  // quarter of a second so there is something to have seen.
  function hitscan(yaw, pitch) {
    const from = new THREE.Vector3(0, muzzleHeight(), 0);
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    let best = null, bd = Infinity, bMiss = 0;const pierced=[];
    for (const t of targets) {
      if (!t.alive || Math.hypot(t.pos[0],t.pos[2])>W.range) continue;
      const to = new THREE.Vector3(t.pos[0] - from.x, t.pos[1] - from.y, t.pos[2] - from.z);
      const along = to.dot(dir);
      if (along <= 0) continue;
      const miss = Math.sqrt(Math.max(0, to.lengthSq() - along * along));
      if(W.pierce && miss<=P.targetR)pierced.push({target:t,miss});
      if (miss < bd) { bd = miss; best = t; bMiss = miss; }
    }
    const reach = best ? Math.hypot(best.pos[0], best.pos[1] - from.y, best.pos[2]) : GROUND;
    const end = from.clone().addScaledVector(dir, reach);
    end.copy(from).addScaledVector(dir,W.pierce?W.range:Math.min(reach,W.range));
    const life=firingFor(W.id).beamHold;
    if(!heldBeam){
      const beam=makeBeamShot(from,end,profile().shot.beamColor||TOWER_BY_KEY[W.id].color,W.kind,{glowWidth:.6});
      const opticGlow=W.id==='lancer'?makeTracerMesh(profile().shot.beamColor||0x66ff88,24,0):null,glowPosition=new THREE.Vector3();
      if(opticGlow){const at=from.clone().addScaledVector(dir,camera.near*2);opticGlow.geometry.attributes.position.setXYZ(0,at.x,at.y,at.z);opticGlow.geometry.attributes.position.needsUpdate=true;opticGlow.geometry.computeBoundingSphere();beam.add(opticGlow);}
      heldBeam={obj:beam,left:life,key:W.id};scene.add(beam);
      const entry=heldBeam;fx.push({obj:beam,tick:dt=>{
        entry.left-=dt;beam.userData.update(clock);
        if(opticGlow){
          opticGlow.visible=!P.showRifle;opticGlow.material.opacity=.95*Math.min(1,Math.max(0,entry.left)/.12);
          camera.getWorldDirection(glowPosition).multiplyScalar(camera.near*2).add(camera.position);
          opticGlow.geometry.attributes.position.setXYZ(0,glowPosition.x,glowPosition.y,glowPosition.z);
          opticGlow.geometry.attributes.position.needsUpdate=true;opticGlow.geometry.computeBoundingSphere();
        }
        beam.userData.setFade(Math.min(1,Math.max(0,entry.left)/.12));
        if(entry.left<=0){if(heldBeam===entry)heldBeam=null;return false;}return true;
      }});
    }
    heldBeam.left=life;heldBeam.from=from.clone();heldBeam.end=end.clone();heldBeam.obj.userData.setEndpoints(from,end);
    if(W.pierce && pierced.length){for(const hit of pierced)resolveHit(hit.target,hit.miss,new THREE.Vector3(...hit.target.pos));}
    else if(reach<=W.range)resolveHit(best,bMiss,end);
    else emitEffect('impact',end.toArray(),[0,1,0]);
    emitEffect('muzzle',from.toArray(),dir.toArray());
    cool=W.id==='lancer'?firingFor(W.id).duration:W.cooldown;shooter.shots++;recoil=W.id==='lancer'?0:RECOIL_KICK;weaponVoice.shot(W.id);

  }

  // ONE DOOR for "a round arrived here", so the laser, the shell and the
  // mortar cannot disagree about what counts as a hit.
  function resolveHit(t, miss, at, weapon=W, shotProfile=profile()) {
    if (t && t.cal) {
      const rr = Math.hypot(t.pos[0], t.pos[2]);
      recordShot({ dx: at.x - t.pos[0], dy: at.y - t.pos[1], range: rr,
        mradX: toMrad(at.x - t.pos[0], rr), mradY: toMrad(at.y - t.pos[1], rr) });
    }
    if (t && splashHits(miss, P.targetR, weapon.splash)) {
      shooter.hits++;
      shooter.best = Math.min(shooter.best, miss);
      emitEffect('impact',t.pos,[0,1,0],shotProfile);
      hudNote = `HIT ${t.id} at ${Math.hypot(t.pos[0], t.pos[2]).toFixed(0)} m · ${(miss * 100).toFixed(0)} cm off centre`;
      const affected=weapon.splash>0 ? targets.filter(other=>other.alive && (other===t || Math.hypot(other.pos[0]-at.x,other.pos[2]-at.z)<=weapon.splash)) : [t];
      for(const victim of affected){
        if(victim.cal){if(P.sound)sfx.play('tank_shells');knockDown(victim);continue;}
        victim.hp=(victim.hp??1)-weapon.damage;
        if(victim.hp<=0){if(P.sound)sfx.play(DEATHS[(victim.id+shooter.hits)%DEATHS.length]);killBody(victim);}
      }
      if(!t.cal && t.hp>0){
        hudNote=`HIT ${t.id} — ${t.hp.toFixed(2)} hp remaining`;
      }
      return true;
    }
    emitEffect('impact',at.toArray(),[0,1,0],shotProfile);
    if (t) hudNote = `MISS by ${(miss * 100).toFixed(0)} cm at ${Math.hypot(t.pos[0], t.pos[2]).toFixed(0)} m`;
    return false;
  }

  function stepRounds(dt) {
    for (let i = rounds.length - 1; i >= 0; i--) {
      const r = rounds[i], W=r.weapon;
      // THE SAME INTEGRATOR THE SOLUTION USED — and at the same FIXED step,
      // not the frame's. Sub-dividing `dt` gave a step that varied with the
      // frame rate and never matched the solver's: over a mortar's
      // half-minute arc the two disagreed by fifteen metres, so the round
      // landed short of a firing solution that was itself correct. A carried
      // remainder makes the flight a property of the weapon rather than of
      // the browser's frame time.
      const h = r.tune.step || STEP;
      r.carry = (r.carry || 0) + dt;
      for (let k = 0; k < 400 && !r.spent && !r.grounded && r.carry >= h - 1e-9; k++) {
        r.carry -= h;
        const before = r.s.p.slice();
        step(r.s, h, r.tune, r.s.wind);
        if(W.loft&&r.s.p[1]<=0&&before[1]>0){const f=before[1]/(before[1]-r.s.p[1]);r.s.p=[before[0]+(r.s.p[0]-before[0])*f,-.00001,before[2]+(r.s.p[2]-before[2])*f];r.grounded=true;}
        // did it cross a target's plane between the two positions? Resolved
        // through the SAME door the laser uses, so the weapons cannot
        // disagree about what counts as a hit.
        for (const t of targets) {
          if(W.loft)break;
          if (!t.alive || r.spent || Math.hypot(t.pos[0],t.pos[2])>W.range) continue;
          const d0 = before[2], d1 = r.s.p[2], tz = t.pos[2];
          if (!(d0 <= tz && d1 >= tz)) continue;
          const f = (tz - d0) / Math.max(1e-9, d1 - d0);
          const x = before[0] + (r.s.p[0] - before[0]) * f;
          const y = before[1] + (r.s.p[1] - before[1]) * f;
          const miss = Math.hypot(x - t.pos[0], y - t.pos[1]);
          // near enough to be worth resolving; resolveHit decides hit or miss
          if (miss < P.targetR + W.splash + 8) {
            resolveHit(t, miss, new THREE.Vector3(x, y, tz),r.weapon,r.profile);
            r.s.p=[x,y,tz];r.spent = true;
          }
        }
        r.trace?.sample(r.s.p);
      }
      r.trail.unshift(r.s.p.slice());r.trail.length=Math.min(r.trail.length,r.mesh.geometry.attributes.position.count);
      const positions=r.mesh.geometry.attributes.position;
      for(let j=0;j<positions.count;j++)positions.setXYZ(j,...(r.trail[j]||r.s.p));
      positions.needsUpdate=true;r.mesh.geometry.computeBoundingSphere();
      r.mesh.visible = P.tracer;
      if(r.shell){r.shell.position.fromArray(r.s.p);r.shell.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...r.s.v).normalize());}
      const done = r.spent || r.s.p[1] < 0 || r.s.t > (P.maxTime || MAX_T) || (!W.loft&&Math.hypot(r.s.p[0],r.s.p[2]) > W.range);
      if (!done) continue;
      if(W.loft&&r.grounded)mortarMap.mark([r.s.p[0],0,r.s.p[2]],W.splash);
      if(r.shell){scene.remove(r.shell);disposeObj(r.shell);}
      if (!r.spent && r.s.p[1] < 0 && r.s.p[2] < GROUND) {
        // a round in the dirt: a splash weapon still gets its say, because a
        // mortar that lands short of a body may very well have killed it
        let splashed = false;
        if (W.splash > 0) {
          for (const t of targets) {
            if (!t.alive) continue;
            const md = Math.hypot(t.pos[0] - r.s.p[0], t.pos[2] - r.s.p[2]);
            if (md <= W.splash) { resolveHit(t, md, new THREE.Vector3(r.s.p[0],0,r.s.p[2]),r.weapon,r.profile); splashed = true; break; }
          }
        }
        // THE FALL OF SHOT. A lobbed round that lands short never crosses
        // the plate's plane, so the crossing test — the only thing that ever
        // records a shot — has nothing to say about it, and the shooter is
        // told "SHORT" with no number to act on. A mortar crew does not
        // correct in milliradians off a reticle; they correct in metres, add
        // or drop and left or right, off where the last one landed.
        const cal = targets.find((x) => x.cal && x.alive);
        if (!splashed && W.splash > 0 && cal) {
          const over = r.s.p[2] - cal.pos[2], side = r.s.p[0] - cal.pos[0];
          hudNote = `FALL — ${Math.abs(over).toFixed(0)} m ${over < 0 ? 'short' : 'long'}`
            + `, ${Math.abs(side).toFixed(0)} m ${side < 0 ? 'left' : 'right'}`;
          emitEffect('impact',[r.s.p[0],.05,r.s.p[2]],[0,1,0],r.profile);
          splashed = true;   // it has had its say; do not also print SHORT
        }
        if (!splashed) {
          emitEffect('impact',[r.s.p[0],.05,r.s.p[2]],[0,1,0],r.profile);
          if (!hudNote.startsWith('HIT')) hudNote = `SHORT — struck the ground at ${r.s.p[2].toFixed(0)} m`;
        }
      }
      if(r.trace&&P.traceHold>0){
        const duration=P.traceHold;let left=duration;
        fx.push({obj:r.mesh,trace:r.trace,tick:dt=>{left-=dt;r.mesh.visible=P.tracer;r.trace.fade(Math.min(1,Math.max(0,left)/.4));r.mesh.material.opacity=.95*Math.min(1,Math.max(0,left)/.4);return left>0;}});
      }else{scene.remove(r.mesh);disposeObj(r.mesh);}
      rounds.splice(i, 1);
    }
  }
  let hudNote = 'take a shot';

  // THE GROUP. Mean point of impact and spread — the two numbers a
  // calibration exists to produce. The correction is the NEGATIVE of the
  // mean, in milliradians, which is what a shooter dials; the spread is what
  // they cannot dial away and is therefore the honest score.
  function group() {
    if (!string.length) return null;
    const n = string.length;
    const mx = string.reduce((a, s2) => a + s2.mradX, 0) / n;
    const my = string.reduce((a, s2) => a + s2.mradY, 0) / n;
    let ext = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        ext = Math.max(ext, Math.hypot(string[i].dx - string[j].dx, string[i].dy - string[j].dy));
      }
    }
    return { n, mx, my, ext, range: string[0].range };
  }

  // AMMUNITION IS NOT THE POINT OF THIS SIM (operator: "infinite bullets"),
  // so the trigger is never refused. The allotment is a WINDOW instead: the
  // group is measured over the LAST `allotted` shots, which keeps the number
  // meaningful — a group over every shot you have ever fired only gets worse
  // and stops saying anything — while letting you shoot as long as you like.
  // `stringDone` now means "the window is full", not "you are out".
  function stringDone() {
    return P.phase === 'calibrate' && string.length >= Math.round(P.allotted);
  }
  function recordShot(rec) {
    string.push(rec);
    while (string.length > Math.round(P.allotted)) string.shift();
  }

  // --- aiming --------------------------------------------------------------
  // Drag to traverse, at a rate scaled by the MAGNIFICATION: a 20x scope must
  // move half as fast per pixel as a 10x one, or the aim is unusable at the
  // zoom that needs it most.
  let drag = null;
  listen(container,'pointerdown', (ev) => {
    if (ev.target.closest && ev.target.closest('button')) return;
    drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    container.setPointerCapture(ev.pointerId);
  });
  listen(container,'pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const k = (camera.fov * Math.PI / 180) / Math.max(1, container.clientHeight);
    aimYaw -= (ev.clientX - drag.x) * k;
    aimPitch += (ev.clientY - drag.y) * k;
    aimPitch = Math.max(-0.05, Math.min(0.25, aimPitch));
    drag.x = ev.clientX; drag.y = ev.clientY;
  });
  for (const e of ['pointerup', 'pointercancel']) {
    listen(container,e, () => { drag = null; });
  }
  // THE WHEEL IS THE ZOOM RING. A scope's magnification is the one control a
  // shooter reaches for constantly — find the target wide, then wind it in to
  // shoot — and it was buried in a slider.
  listen(container,'wheel', (ev) => {
    ev.preventDefault();
    // proportional, so a step is the same FRACTION of the zoom at 4x and 25x;
    // a fixed step is coarse at the bottom and useless at the top
    const k = Math.exp(-Math.sign(ev.deltaY) * 0.12);
    P.mag = Math.max(1, Math.min(25, P.mag * k));
    camera.fov = 60 / P.mag;
    camera.updateProjectionMatrix();
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }, { passive: false });

  const keys = { hold: false };
  listen(window,'keydown', (ev) => {
    if (!active) return;
    if(ev.target?.closest?.('input,textarea,select,.lil-gui,dialog'))return;
    const k = ev.key.toLowerCase();
    if(/^[1-8]$/.test(k)){weaponControl.setValue(SENTRIES[Number(k)-1].key);ev.preventDefault();return;}
    if (k === 'shift') keys.hold = true;
    if (k === ' ' || k === 'spacebar') { fire(); ev.preventDefault(); }
    if (k === 'r') { spawnTargets(); shooter.shots = 0; shooter.hits = 0; }
    if (k === 'e') spawnEnemy();
    if (k === 't') spawnReal();
    // the hold, dialled by hand — the manual half of the firing solution
    if (k === 'arrowup') holdUp += 0.25;
    if (k === 'arrowdown') holdUp -= 0.25;
    if (k === 'arrowleft') holdSide -= 0.25;
    if (k === 'arrowright') holdSide += 0.25;
  });
  listen(window,'keyup', (ev) => { if (ev.key.toLowerCase() === 'shift') keys.hold = false; });

  // --- the reticle ---------------------------------------------------------
  // Drawn in CSS pixels from MILLIRADIANS, so a mil dot is a mil dot at any
  // magnification and the player can range with it.
  function paintReticle() {
    if (!reticleEl) return;
    const h = container.clientHeight || 1;
    // a seeker gets its own glass, and it REPLACES the ruler rather than
    // being drawn over it: the mil dots are a holdover instrument and a
    // homing round has no holdover
    if(W.loft){reticleEl.innerHTML='';return;}
    if(W.id==='lancer'){
      const cx=(container.clientWidth||1)/2,cy=h/2,r=Math.max(38,Math.min(76,h*.09));
      const brackets=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>`<path d="M ${cx+x*(r+18)} ${cy+y*r} h ${-x*18} v ${-y*18}"/>`).join('');
      reticleEl.innerHTML=`<svg data-reticle="lancer" width="100%" height="100%"><g fill="none" stroke="#dfe9ec" stroke-width="1.2" opacity=".8"><circle cx="${cx}" cy="${cy}" r="${r}"/>${brackets}<path d="M ${cx-7} ${cy} h 14 M ${cx} ${cy-7} v 14"/></g></svg>`;
      return;
    }
    if (W.lock) {
      reticleEl.innerHTML = `<svg width="100%" height="100%">`
        + `${paintSeeker(container.clientWidth || 1, h).join('')}</svg>`;
      return;
    }
    const pxPerMrad = h / ((camera.fov * Math.PI / 180) * MRAD);
    const sw = sway(clock, shooter, P);
    const cx = (container.clientWidth || 1) / 2 - sw[0] * pxPerMrad;
    const cy = h / 2 + sw[1] * pxPerMrad;
    const parts = [];
    const line = (x1, y1, x2, y2, o) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#cfe8ff" stroke-width="1" opacity="${o}"/>`;
    parts.push(line(cx - 220, cy, cx - 8, cy, 0.55), line(cx + 8, cy, cx + 220, cy, 0.55));
    parts.push(line(cx, cy - 220, cx, cy - 8, 0.55), line(cx, cy + 8, cx, cy + 220, 0.55));
    // mil dots below the cross, which is where a holdover is read
    for (let m = 1; m <= 12; m++) {
      const y = cy + m * pxPerMrad;
      const w = m % 5 === 0 ? 9 : 4;
      parts.push(line(cx - w, y, cx + w, y, m % 5 === 0 ? 0.8 : 0.45));
      const x = cx + m * pxPerMrad;
      parts.push(line(x, cy - w, x, cy + w, m % 5 === 0 ? 0.7 : 0.35));
      const x2 = cx - m * pxPerMrad;
      parts.push(line(x2, cy - w, x2, cy + w, m % 5 === 0 ? 0.7 : 0.35));
    }
    // the DIALLED hold — where the round is actually going
    const hx = cx + holdSide * pxPerMrad, hy = cy - holdUp * pxPerMrad;
    parts.push(`<circle cx="${hx}" cy="${hy}" r="4" fill="none" stroke="#ffb45e" stroke-width="1.5" opacity="0.95"/>`);
    // ...and, if the chip is printed, where it SHOULD go
    const u = underReticle();
    if (P.firingSolution && u) {
      const sol = solution(u.range, P, clock, W.field?{hitscan:true}:W);
      if (sol.reached) {
        const sx = cx + sol.holdSide * pxPerMrad, sy = cy - sol.holdUp * pxPerMrad;
        parts.push(`<circle cx="${sx}" cy="${sy}" r="8" fill="none" stroke="#66ff88" stroke-width="1.5" opacity="0.9"/>`);
        parts.push(line(sx - 12, sy, sx - 9, sy, 0.9), line(sx + 9, sy, sx + 12, sy, 0.9));
      }
    }
    reticleEl.innerHTML = `<svg width="100%" height="100%">${parts.join('')}</svg>`;
  }

  // THE SEEKER'S OWN GLASS. A different weapon deserves a different sight:
  // where the rifle reticle is a ruler — mil dots you read a holdover off —
  // this one is an INSTRUMENT that tells you one thing, how close you are to
  // being allowed to shoot. Nothing here is measured in milliradians for the
  // player to use; the numbers are the machine's.
  //
  // The four brackets are the lock meter. They start wide and walk inward as
  // it fills, and on acquisition they snap to the ring and everything turns
  // amber — which means the player learns the state from the shape of the
  // thing without reading a word of it. Once locked the whole assembly rides
  // the TARGET rather than the cross, so the barrel drifting off is visible
  // as the reticle leaving the middle of the screen.
  function paintSeeker(w2, h) {
    const sw = sway(clock, shooter, P);
    const pxPerMrad = h / ((camera.fov * Math.PI / 180) * MRAD);
    let cx = w2 / 2 - sw[0] * pxPerMrad;
    let cy = h / 2 + sw[1] * pxPerMrad;
    const held = lock.locked ? targets.find((t) => t.alive && t.id === lock.id) : null;
    if (held) {
      const v = new THREE.Vector3(held.pos[0], held.pos[1], held.pos[2]).project(camera);
      if (v.z < 1) { cx = (v.x * 0.5 + 0.5) * w2; cy = (-v.y * 0.5 + 0.5) * h; }
    }
    const on = lock.locked;
    const col = on ? '#ffb43d' : '#dfe9ec';
    const R = Math.max(46, Math.min(96, h * 0.11));
    const P2 = [];
    const ln = (x1, y1, x2, y2, o = 0.8, c = col, w3 = 1) =>
      P2.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${w3}" opacity="${o}"/>`);
    const circ = (r, o, w3 = 1) =>
      P2.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${w3}" opacity="${o}"/>`);

    // the two rings, and the frame the whole sight sits in
    circ(R, 0.85, 1.2); circ(R * 1.09, 0.5);
    const FW = R * 2.6, FH = R * 1.9;
    P2.push(`<rect x="${(cx - FW).toFixed(1)}" y="${(cy - FH).toFixed(1)}" width="${(FW * 2).toFixed(1)}" height="${(FH * 2).toFixed(1)}" fill="none" stroke="${col}" stroke-width="1" opacity="0.28"/>`);
    // the X, drawn from beyond the frame so it reads as a huge fixed cross
    const D = R * 2.9;
    ln(cx - D, cy - D, cx + D, cy + D, 0.32);
    ln(cx + D, cy - D, cx - D, cy + D, 0.32);
    // the horizontal bars above and below the middle, with their dot pairs
    for (const sgn of [-1, 1]) {
      const y = cy + sgn * R * 0.52;
      ln(cx - R * 0.62, y, cx + R * 0.62, y, 0.55);
      ln(cx - R * 0.62, y, cx - R * 0.62, y + sgn * R * 0.16, 0.55);
      ln(cx + R * 0.62, y, cx + R * 0.62, y + sgn * R * 0.16, 0.55);
      for (const sx of [-1, 1]) for (const dy of [-2.5, 2.5]) {
        P2.push(`<circle cx="${(cx + sx * R * 0.48).toFixed(1)}" cy="${(y - sgn * 8 + dy).toFixed(1)}" r="0.9" fill="${col}" opacity="0.7"/>`);
      }
    }
    // the inner half-brackets either side of the middle
    for (const sx of [-1, 1]) {
      const x = cx + sx * R * 0.30;
      ln(x, cy - R * 0.20, x + sx * R * 0.14, cy - R * 0.20, 0.75);
      ln(x, cy + R * 0.20, x + sx * R * 0.14, cy + R * 0.20, 0.75);
      ln(x + sx * R * 0.14, cy - R * 0.20, x + sx * R * 0.14, cy - R * 0.08, 0.75);
      ln(x + sx * R * 0.14, cy + R * 0.20, x + sx * R * 0.14, cy + R * 0.08, 0.75);
      // the side plates, outside the ring
      const px = cx + sx * R * 1.16;
      ln(px, cy - R * 0.18, px, cy + R * 0.18, 0.6);
      for (const dy of [-3, 3]) for (const dx of [-2.5, 2.5]) {
        P2.push(`<circle cx="${(cx + sx * R * 1.30 + dx).toFixed(1)}" cy="${(cy + dy).toFixed(1)}" r="0.9" fill="${col}" opacity="0.7"/>`);
      }
    }
    // the centre pip: a small triangle, the one mark you actually put on it
    const tr = R * 0.09;
    P2.push(`<path d="M ${(cx - tr).toFixed(1)} ${(cy - tr * 0.7).toFixed(1)}`
      + ` L ${(cx + tr).toFixed(1)} ${(cy - tr * 0.7).toFixed(1)}`
      + ` L ${cx.toFixed(1)} ${(cy + tr).toFixed(1)} Z" fill="none" stroke="${col}" stroke-width="1.2" opacity="0.95"/>`);

    // THE METER, AS FOUR BRACKETS. Wide open at nothing, closed onto the
    // ring at a lock — the state of the mini-game, told as a shape.
    const f = on ? 1 : lock.meter;
    const br = R * (2.5 - 1.24 * f);
    const bl = R * 0.34;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = cx + sx * br, y = cy + sy * br;
      ln(x, y, x - sx * bl, y, on ? 0.95 : 0.35 + 0.5 * f, col, on ? 2 : 1.4);
      ln(x, y, x, y - sy * bl, on ? 0.95 : 0.35 + 0.5 * f, col, on ? 2 : 1.4);
    }
    if (!on && lock.meter > 0.02) {
      P2.push(`<text x="${cx.toFixed(1)}" y="${(cy + R * 1.62).toFixed(1)}" fill="${col}"`
        + ` font-family="ui-monospace,Menlo,monospace" font-size="11" letter-spacing="2"`
        + ` text-anchor="middle" opacity="0.85">SEEKING ${(lock.meter * 100).toFixed(0)}%</text>`);
    }
    if (on) {
      const bw = 150, bh = 15;
      P2.push(`<rect x="${(cx - bw / 2).toFixed(1)}" y="${(cy + R * 0.72).toFixed(1)}" width="${bw}" height="${bh}" fill="#ffb43d" opacity="0.92"/>`);
      P2.push(`<text x="${cx.toFixed(1)}" y="${(cy + R * 0.72 + 11).toFixed(1)}" fill="#12202a"`
        + ` font-family="ui-monospace,Menlo,monospace" font-size="10" font-weight="700" letter-spacing="3"`
        + ` text-anchor="middle">TARGET LOCKED</text>`);
    }
    return P2;
  }

  // THE FIRE-CONTROL READOUT. The panels are written FIELD BY FIELD rather
  // than rebuilt: this runs several times a second and an innerHTML churn is
  // how a HUD becomes the most expensive thing on the frame.
  const F = {};
  const f = (id) => (F[id] || (F[id] = root.querySelector('#' + id)));
  const put = (id, txt, hot = false) => {
    const el = f(id);
    if (!el) return;
    if (el.textContent !== txt) el.textContent = txt;
    if (el.classList) el.classList.toggle('hot', !!hot);
  };
  let chipsBuilt = '';
  // THE SCOPE NAMES THE WEAPON, and its firing nature with it — it was
  // static markup up on the strip reading LANCER while a mortar was loaded,
  // which is the one label on screen that cannot be allowed to disagree with
  // what is about to leave the barrel.
  const weaponName = () => `${W.label.toUpperCase()} · `
    + (W.id==='quiver'&&P.quiverPrototype?'JAVELIN PROTOTYPE':W.field?'SUPPORT FIELD':W.hitscan ? 'BEAM' : W.homing ? 'GUIDED' : W.loft ? 'INDIRECT' : 'DIRECT');
  function nameWeapon() { /* the SCOPE box reads it every frame; nothing to push */ }

  nameWeapon();

  function hudLine() {
    const g0 = group();
    const u = underReticle();
    const w = windAt(clock, P);
    const wSpeed = Math.hypot(w[0], w[2]);
    const sol = u ? solution(u.range, P, clock, W.field?{hitscan:true}:W) : null;
    const cal = P.phase === 'calibrate';

    put('fcs-phase', cal ? `PHASE 1 · CALIBRATE` : `PHASE 2 · CONTACT`);
    put('fcs-bearing', `${((aimYaw * 180 / Math.PI + 360) % 360).toFixed(0).padStart(3, '0')}`);

    // SCOPE
    put('f-zero', `${P.zero} m`);
    put('f-mag', `${P.mag.toFixed(1)}x`);
    put('f-weapon', weaponName()
      + (charging > 0 ? ` · CHARGING ${charging.toFixed(1)}s` : cool > 0 ? ` · ${cool.toFixed(1)}s` : ''),
      charging > 0 || cool > 0);
    // the seeker's state where the hold would be — a homing round has no
    // hold, so the field that would print one prints the lock instead
    if (W.lock) {
      put('f-holdup', lock.locked ? 'LOCKED'
        : lock.meter > 0 ? `SEEKING ${(lock.meter * 100).toFixed(0)}%` : 'NO LOCK',
        lock.locked || lock.meter > 0);
      put('f-holdside', lock.id != null ? `TGT ${lock.id}` : '—', lock.locked);
    } else {
      put('f-holdup', `${holdUp >= 0 ? '+' : ''}${holdUp.toFixed(2)} mrad`, Math.abs(holdUp) > 0.001);
      put('f-holdside', `${holdSide >= 0 ? '+' : ''}${holdSide.toFixed(2)} mrad`, Math.abs(holdSide) > 0.001);
    }
    put('f-breath', shooter.holding ? 'HELD' : `${Math.round(shooter.breath * 100)}%`, shooter.holding);
    const bar = f('f-breathbar');
    if (bar) {
      bar.style.width = `${Math.round(shooter.breath * 100)}%`;
      bar.style.background = shooter.holding ? '#ffb43d' : '#5fe6d6';
    }

    // TRACK — what is under the cross. The RANGE is the rangefinder chip's
    // to print; without it the player gets the SUBTENSE and mils it himself,
    // which is the manual half of the same job.
    put('f-trackid', u ? `TGT-${String(u.t.id).padStart(2, '0')}` : '— — —');
    put('f-range', u ? (P.rangefinder ? `${u.range.toFixed(0)} m` : 'MIL IT') : '—',
      !!u && P.rangefinder);
    put('f-bearing', u ? `${((Math.atan2(u.t.pos[0], u.t.pos[2]) * 180 / Math.PI + 360) % 360).toFixed(1)}°` : '—');
    // a CLOSING target is the interesting case — the range is changing under
    // the solution, which is the one thing a static plate never does
    put('f-cross', u
      ? (u.t.closing ? `${u.t.closing.toFixed(1)} m/s INBOUND`
        : u.t.vx ? `${Math.abs(u.t.vx).toFixed(1)} m/s ${u.t.vx > 0 ? 'R' : 'L'}` : 'static')
      : '—', !!(u && u.t.closing));
    put('f-subtense', u ? `${toMrad(TARGET_H, u.range).toFixed(2)} mrad` : '—');

    // BALLISTICS — the solution, if the chip is printed
    const show = sol && sol.reached && P.firingSolution;
    put('f-drop', show ? `${sol.drop.toFixed(2)} m` : (sol && sol.reached ? '— — —' : '—'));
    put('f-drift', show ? `${sol.drift.toFixed(2)} m` : (sol && sol.reached ? '— — —' : '—'));
    put('f-flight', sol && sol.reached ? `${sol.time.toFixed(2)} s` : '—');
    put('f-wind', P.windRead ? `${wSpeed.toFixed(1)} m/s ${P.windDir}°` : 'READ THE DUST',
      P.windRead && wSpeed > P.wind);

    // ACQUISITION
    const spent = stringDone();
    put('f-acq', cal ? (spent ? 'GROUP READY' : 'CALIBRATING') : (u ? 'TRACKING' : 'SEARCHING'),
      cal ? spent : !!u);
    put('f-string', cal ? `last ${string.length} / ${Math.round(P.allotted)}`
      : `${shooter.shots} fired · ${shooter.hits} hit`);
    put('f-group', g0 ? `${(g0.ext * 100).toFixed(0)} cm` : '—', !!g0);
    put('f-corr', g0 ? `${(-g0.my).toFixed(2)} up · ${(-g0.mx).toFixed(2)} right` : '—', !!g0);

    // THE CHIPS. The assist ladder as status lights — which is what it is:
    // four things Isao has or has not printed yet.
    const chips = [['RNG', P.rangefinder], ['WIND', P.windRead],
      ['SOLN', P.firingSolution], ['AUTO', P.autoHold]];
    const key = chips.map(([n, on]) => `${n}${on ? 1 : 0}`).join();
    if (key !== chipsBuilt) {
      chipsBuilt = key;
      const el = f('f-chips');
      if (el) el.innerHTML = chips.map(([n, on]) => `<span class="chip${on ? ' on' : ''}">${n}</span>`).join('');
    }

    const note = f('f-note');
    if (note) {
      if (note.textContent !== hudNote) note.textContent = hudNote;
      note.classList.toggle('hit', hudNote.startsWith('HIT'));
      note.classList.toggle('miss', hudNote.startsWith('MISS') || hudNote.startsWith('SHORT'));
    }
  }

  // --- the panel -----------------------------------------------------------
  const gui = new GUI({ title: 'SNIPER', container: root });
  gui.add(P, 'mag', 1, 25, 1).name('magnification').onChange(() => { camera.fov = 60 / P.mag; camera.updateProjectionMatrix(); });
  const weaponControl=gui.add(P,'weapon',Object.fromEntries(SENTRIES.map(s=>[s.label,s.key]))).name('Sentry').onChange(setWeapon);
  gui.add(P,'quiverPrototype').name('Quiver: Javelin prototype').onChange(()=>setWeapon(P.weapon));
  gui.add(P,'prototypeRange',100,2000,100).name('prototype reach (m)').onChange(()=>setWeapon(P.weapon));
  gui.add(P,'tier',1,3,1).name('equipment tier').onChange(()=>setWeapon(P.weapon));
  const effectsPanel=mountSentryEffects(gui,profile);
  const transfer=mountPresetPanel(root,{subject:()=>({kind:'sentry',key:P.weapon}),read:()=>draft,write:p=>{draft=p;setWeapon(P.weapon);},preview:'sniper'});
  gui.add(P, 'zero', 1, 1500, 1).name('zero (m)');
  gui.add(P, 'showRifle').name('inspect the rig').onChange((v) => {
    if (rifle) rifle.visible = v;
    if (v) frameRifle(); else camera.fov = 60 / P.mag;
    camera.updateProjectionMatrix();
  });
  const ga = gui.addFolder('assist — Isao’s chips');
  ga.add(P, 'rangefinder').name('rangefinder');
  ga.add(P, 'windRead').name('wind readout');
  ga.add(P, 'firingSolution').name('firing solution');
  ga.add(P, 'autoHold').name('auto-dial the hold');
  const gr2 = gui.addFolder('the round');
  gr2.add(P, 'muzzleVel').name('shared muzzle m/s').disable();
  gr2.add(P, 'gravity', 0, 30, 0.1).name('gravity');
  gr2.add(P, 'drag', 0, 0.01, 0.0001).name('drag');
  const gw = gui.addFolder('alien wind');
  gw.add(P, 'wind', 0, 40, 0.5).name('speed (m/s)');
  gw.add(P, 'windDir', 0, 359, 1).name('from (deg)');
  gw.add(P, 'gust', 0, 1.5, 0.05).name('gust ±');
  gw.add(P, 'gustPeriod', 1, 30, 0.5).name('gust period');
  const gs = gui.addFolder('sway');
  gs.add(P, 'swayFast', 0, 6, 0.05).name('fast (mrad)');
  gs.add(P, 'swaySlow', 0, 8, 0.05).name('slow (mrad)');
  gs.add(P, 'hold', 0, 1, 0.02).name('held-breath ×');
  gs.add(P, 'holdSecs', 1, 20, 0.5).name('breath (s)');
  const gp = gui.addFolder('phase');
  gp.add(P, 'phase', ['calibrate', 'contact']).name('phase').onChange(() => {
    spawnTargets(); shooter.shots = 0; shooter.hits = 0; shooter.best = Infinity;
  });
  gp.add(P, 'allotted', 3, 20, 1).name('shots in a string');
  gp.add(P, 'moverSpeed', 0, 12, 0.2).name('crossing speed (m/s)');
  gp.add(P, 'sound').name('gun sound');
  gp.add({ spawn: () => spawnEnemy() }, 'spawn').name('spawn a mover (E)');
  gp.add({ real: () => spawnReal() }, 'real').name('spawn a REAL enemy (T)');

  const gt = gui.addFolder('the range');
  gt.add(P, 'range', 1, 1800, 1).name('distance').onChange(spawnTargets);
  gt.add(P, 'spread', 0, 800, 1).name('± spread').onChange(spawnTargets);
  gt.add(P, 'targets', 1, 8, 1).name('targets').onChange(spawnTargets);
  gt.add(P, 'targetR', 0.1, 3, 0.05).name('kill radius (m)');
  gt.add(P, 'seed', 1, 9999, 1).onChange(spawnTargets);
  gt.add({ again: () => { spawnTargets(); shooter.shots = 0; shooter.hits = 0; shooter.best = Infinity; } }, 'again').name('reset the range');
  gui.add(P, 'tracer').name('show the tracer');
  gui.add(P,'traceHold',0,3,.1).name('Needle trace linger (s)');
  gui.add(P, 'closeup').name('spotting monitor');
  gui.add(P, 'scan').name('scan');

  wireDeepLink(root.querySelector('#sniper-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'sniper',
    params: P, defaults: P0, carry: location.search,
  }), { label: 'SNIPER', flash: (m) => { hudNote = m; } });

  const gear = root.querySelector('#sniper-gear');
  if (gear) listen(gear,'click', () => root.classList.toggle('panel-hidden'));
  const fireBtn = root.querySelector('#sniper-fire');
  if (fireBtn) listen(fireBtn,'click', () => fire());
  const spawnBtn = root.querySelector('#sniper-spawn');
  if (spawnBtn) listen(spawnBtn,'click', () => spawnEnemy());
  const realBtn = root.querySelector('#sniper-real');
  if (realBtn) listen(realBtn,'click', () => spawnReal());

  const breathBtn = root.querySelector('#sniper-breath');
  if (breathBtn) {
    for (const e of ['pointerdown']) listen(breathBtn,e, () => { keys.hold = true; });
    for (const e of ['pointerup', 'pointerleave', 'pointercancel']) listen(breathBtn,e, () => { keys.hold = false; });
  }
  if (matchMedia('(pointer: coarse)').matches || q.get('mobile') === '1' || innerWidth <= 700) {
    root.classList.add('panel-hidden');
  }

  // INSPECTING THE RIG IS A DIFFERENT CAMERA, not the scope with a mesh in
  // front of it. The optic sits INSIDE the receiver — that is where an optic
  // goes — so drawing the rifle from there fills the frame with grey metal
  // and shows nothing. This backs off and widens out to look at the thing.
  function frameRifle() {
    camera.fov = 38;
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    postfx.setSize(w, h);
  }
  listen(window,'resize', resize);

  camera.fov = 60 / P.mag;
  camera.updateProjectionMatrix();
  spawnTargets();

  // --- the spotting monitor -------------------------------------------------
  // A SECOND RENDER of the same scene through a long lens, scissored into a
  // corner box. One renderer, one scene — a second WebGL context for a
  // 250 px inset would cost more than the whole range does.
  const closeCam = new THREE.PerspectiveCamera(1, 1, 0.5, 4000);
  const cuBox = root.querySelector('#f-closeup');
  function renderCloseup() {
    if (!cuBox) return;
    const t = (underReticle() || {}).t || targets.find((x) => x.alive);
    const on = P.closeup && !P.showRifle && !!t;
    cuBox.style.display = on ? '' : 'none';
    if (!on) return;
    const r = cuBox.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    const x = r.left - cr.left, yTop = r.top - cr.top;
    const W = container.clientWidth || 1, H = container.clientHeight || 1;
    const d = Math.hypot(t.pos[0] - camera.position.x, t.pos[1] - camera.position.y,
      t.pos[2] - camera.position.z);
    // frame the target at about a third of the box, whatever the range —
    // the point of a spotting scope is that it is the same size every time
    const span = (t.cal ? P.targetR * FACE_R * 2 : TARGET_H) * 3;
    closeCam.fov = Math.max(0.08, (2 * Math.atan(span / (2 * d)) * 180) / Math.PI);
    closeCam.aspect = r.width / r.height;
    closeCam.position.copy(camera.position);
    closeCam.lookAt(t.pos[0], t.pos[1], t.pos[2]);
    closeCam.updateProjectionMatrix();
    const dpr = renderer.getPixelRatio();
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    // the viewport's y is measured from the BOTTOM of the drawing buffer
    const vy = (H - yTop - r.height) * dpr;
    renderer.setViewport(x * dpr, vy, r.width * dpr, r.height * dpr);
    renderer.setScissor(x * dpr, vy, r.width * dpr, r.height * dpr);
    renderer.clear(true, true, false);
    renderer.render(scene, closeCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W * dpr, H * dpr);
    renderer.autoClear = true;
  }

  // --- the scan -------------------------------------------------------------
  // The board's own PPI idiom, on a flat range: a rotating beam, contacts
  // that flare as it passes and decay behind it. `sweepAngle` and
  // `radarPhosphor` come from radar.js — the tested half — while the
  // projection is plain bearing-and-range, because radar.js projects onto a
  // SPHERE's tangent plane and this range is a field.
  const scanCv = root.querySelector('#f-radar');
  const scanCtx = scanCv ? scanCv.getContext('2d') : null;
  const scanBox = root.querySelector('#f-radarbox');
  function drawScan() {
    if (!scanCtx || !scanBox) return;
    if (!P.scan || P.showRifle) { scanBox.style.display = 'none'; return; }
    scanBox.style.display = '';
    const m = scanCv.width, cx = m / 2, cy = m / 2, R = m / 2 - 4;
    const range = Math.max(200, P.range + P.spread + 200);
    const ctx = scanCtx;
    ctx.clearRect(0, 0, m, m);
    ctx.fillStyle = '#03100a';
    ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(95,230,214,0.18)'; ctx.lineWidth = 1;
    for (const f of [1 / 3, 2 / 3, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    // the optic's own field of view, as a wedge — so the scan says where you
    // are looking as well as what is out there
    const half = (camera.fov * Math.PI / 180) * (camera.aspect || 1.6) / 2;
    ctx.fillStyle = 'rgba(95,230,214,0.10)';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, -Math.PI / 2 + aimYaw - half, -Math.PI / 2 + aimYaw + half);
    ctx.closePath(); ctx.fill();
    const sweep = sweepAngle(clock);
    const phi = sweep - Math.PI / 2;
    const grad = ctx.createConicGradient(phi, cx, cy);
    grad.addColorStop(0, 'rgba(95,230,214,0)');
    grad.addColorStop(0.72, 'rgba(95,230,214,0)');
    grad.addColorStop(1, 'rgba(95,230,214,0.26)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,255,225,0.8)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.sin(sweep), cy - R * Math.cos(sweep)); ctx.stroke();
    // CONTACTS. The calibration target in blue, as asked; the movers take the
    // alarm colour, and enemies later will simply join them.
    for (const t of targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.pos[0], t.pos[2]) / range;
      const b = Math.atan2(t.pos[0], t.pos[2]);
      const bx = cx + Math.sin(b) * R * Math.min(1, d);
      const by = cy - Math.cos(b) * R * Math.min(1, d);
      ctx.globalAlpha = radarPhosphor(b, sweep);
      ctx.fillStyle = t.cal ? '#5ab7ff' : '#ff8a5c';
      const sz = t.cal ? 5 : 4;
      ctx.fillRect(bx - sz / 2, by - sz / 2, sz, sz);
      ctx.globalAlpha = 1;
    }
    // YOU, at the centre, facing up the scope's own bearing
    ctx.fillStyle = '#e8f4f2';
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(aimYaw) * 7, cy - Math.cos(aimYaw) * 7);
    ctx.lineTo(cx + Math.sin(aimYaw + 2.5) * 5, cy - Math.cos(aimYaw + 2.5) * 5);
    ctx.lineTo(cx + Math.sin(aimYaw - 2.5) * 5, cy - Math.cos(aimYaw - 2.5) * 5);
    ctx.closePath(); ctx.fill();
  }

  const clockT = new THREE.Clock();
  let hudT = 0;
  function animate() {
    if(disposed)return;frameId=requestAnimationFrame(animate);
    if (!active) return;
    const dt = Math.min(0.05, clockT.getDelta());
    clock += dt;
    stepBreath(shooter, dt, keys.hold, P);
    if (cool > 0) cool = Math.max(0, cool - dt);
    if(cassette===0 && cool===0)cassette=magFor(P.tier-1);
    const firing=firingFor(W.id);
    const pulses=stepSequence(sequence,dt,W.id==='lancer'?firing.duration:W.cooldown);
    for(let i=0;i<pulses;i++){cool=0;fireRound();}
    weaponVoice.update(W.id,sequence.left>0||!!heldBeam);

    if (charging > 0) {
      charging = Math.max(0, charging - dt);
      if (charging === 0) fire(true);   // it goes off when it is ready, like a rail gun
    }
    recoil = Math.max(0, recoil - dt * (RECOIL_KICK / RECOIL_COOL));
    // THE CHIP THAT DIALS FOR YOU. Deliberately the LAST rung: it is the one
    // that stops the player doing the interesting part, so it exists to be
    // switched off again.
    if (P.autoHold) {
      const u = underReticle();
      if (u) {
        const sol = solution(u.range, P, clock, W.field?{hitscan:true}:W);
        if (sol.reached) { holdUp = sol.holdUp; holdSide = sol.holdSide; }
      }
    }
    const sw = sway(clock, shooter, P);
    // the scope rides the rifle: aim + sway + recoil
    if (reticleEl) reticleEl.style.display = P.showRifle ? 'none' : '';
    camera.position.set(0, muzzleHeight(), 0);
    // the kick is in MILLIRADIANS of glass, so it reads the same at 4x and
    // at 25x — a recoil expressed in world angle is invisible zoomed out and
    // unusable zoomed in
    const kick = W.id==='lancer'?0:recoil * 26;
    // A CAMERA LOOKS DOWN ITS OWN -Z. Everything else here — the ballistics
    // module, the rifle model, the targets — is built on +Z forward, which is
    // this project's own written rule and the workshop's stated convention.
    // Without the half turn the scope points at the empty half of the range
    // and nothing is ever visible: the target logged as present, in frame and
    // 84 px across, and could not be seen.
    //
    // With rotation.y = PI + yaw the camera's forward is (sin yaw, 0, cos
    // yaw), which is exactly the module's convention, so no other sign
    // changes anywhere.
    camera.rotation.set(
      aimPitch + (sw[1] + kick) / MRAD,
      Math.PI + aimYaw + (sw[0] + kick * 0.22) / MRAD, 0, 'YXZ');
    if (yawNode) yawNode.rotation.y = aimYaw;
    if (pitchNode) pitchNode.rotation.x = -(W.homing ? MISSILE_LAUNCH_ELEVATION*Math.PI/180 : aimPitch + (W.hitscan?0:zeroAngle(P.zero,P)));
    if (recoilNode) recoilNode.position.z = -recoil;
    // INSPECT IS ITS OWN CAMERA — and it runs AFTER the pivots, so the rig
    // articulates while you look at it. Backing the eye off but keeping the
    // AIM rotation just looks over the top of the thing; the eye has to be
    // pointed AT it, which is a lookAt and not an aim.
    if (P.showRifle) {
      const t2 = clock * 0.35;
      camera.position.set(Math.sin(t2) * 3.4, muzzleHeight() + 1.15, Math.cos(t2) * 3.4 - 0.4);
      camera.lookAt(0, muzzleHeight() * 0.7, 0.3);
    }
    if(rifle)rifle.updateMatrixWorld(true);
    stepSeeker(dt);
    stepRounds(dt);
    stepMissiles(dt);
    stepPlates(dt);
    for (let i = fx.length - 1; i >= 0; i--) {
      if (!fx[i].tick(dt)) { scene.remove(fx[i].obj); disposeObj(fx[i].obj); fx.splice(i, 1); }
    }
    // PHASE 2: THEY CROSS. Straight across the line of sight, turning round
    // at the edge of the lane — a crossing target is what the time of flight
    // is for, and at 800 m a 1.7 s flight is five metres of lead.
    for (const t of targets) {
      if (!t.alive) continue;
      if (t.vx) {
        t.pos[0] += t.vx * dt * (clock<(t.slowUntil||0)?TOWER_BY_KEY.relay.slowFactor:1);
        const lane = Math.max(40, t.d * 0.05);
        if (Math.abs(t.pos[0]) > lane) { t.pos[0] = Math.sign(t.pos[0]) * lane; t.vx = -t.vx; }
        t.obj.position.x = t.pos[0];
      }
      // A SPAWNED ENEMY COMES FOR YOU — straight down its own bearing at the
      // shooter. It is the only thing here that changes the RANGE, which is
      // the axis the drop lives on, so it is the one that makes a rangefinder
      // worth having.
      if (t.closing) {
        // THE BOARD'S OWN BEHAVIOURS, read off the spec rather than reinvented:
        // the erratic velocity bursts, the faster jink weave, and the optical
        // camo whose decloak window is the only time it can be SEEN — which on
        // a range at 800 m is the difference between a target and a rumour.
        let pace = 1;
        if (t.erratic) pace *= 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(clock * 3.1 + t.phase * 7));
        if (t.jink) pace *= 0.55 + 0.9 * (0.5 + 0.5 * Math.sin(clock * 6.3 + t.phase * 11));
        if (t.cloak && t.body && t.body.material) {
          const vis = ((clock * 0.16 + t.phase) % 1) < 0.12;
          t.body.material.transparent = true;
          t.body.material.opacity = vis ? 0.85 : 0.06;
          t.decloaked = vis;
        }
        const d = Math.hypot(t.pos[0], t.pos[2]);
        if (d <= 12) {
          t.alive = false;
          scene.remove(t.obj); disposeObj(t.obj);
          hudNote = 'IT GOT PAST YOU';
          if (P.sound) sfx.play('danger_alert');
          continue;
        }
        const step2 = Math.min(d - 12, t.closing * pace * dt * (clock<(t.slowUntil||0)?TOWER_BY_KEY.relay.slowFactor:1));
        t.pos[0] -= (t.pos[0] / d) * step2;
        t.pos[2] -= (t.pos[2] / d) * step2;
        t.obj.position.set(t.pos[0], 0, t.pos[2]);
        // published, so the lead reads it rather than differentiating a
        // position a frame late
        t.vel = [-(t.pos[0] / d) * t.closing, 0, -(t.pos[2] / d) * t.closing];
      }
      if (t.obj.userData.plate) t.obj.userData.plate.lookAt(camera.position);
      if (t.obj.userData.tick) t.obj.userData.tick(clock + t.id);
    }
    paintReticle();
    postfx.render();
    if(!W.loft)renderCloseup();else if(cuBox)cuBox.style.display='none';
    mortarMap.set(W.loft&&!P.showRifle,mortarAim,W.range,targets.filter(t=>t.alive).map(t=>t.pos));mortarMap.render();
    drawScan();
    hudT += dt; if (hudT > 0.15) { hudT = 0; hudLine(); }
  }
  animate();

  // ?spawn=N — put N inbound enemies on the range at load, for a still or a
  // look at the closing behaviour without reaching for the button.
  {
    const n = parseInt(q.get('spawn') || '0', 10);
    if(n>0)for(let i=0;i<Math.min(n,32);i++)spawnEnemy();
    const nr = parseInt(q.get('real') || '0', 10);
    if(nr>0)for(let i=0;i<Math.min(nr,32);i++)spawnReal();
  }

  if(q.get('acceptance')==='1')window.__stalheartSniperTest={
    state:()=>({weapon:P.weapon,label:W.label,kind:W.kind,model:TOWER_BY_KEY[P.weapon].model,ready:root.dataset.modelReady==='true',
      roster:SENTRIES.map(s=>({number:s.number,key:s.key,label:s.label})),lock:{...lock},cool,cassette,shots:shooter.shots,hits:shooter.hits,
      mortar:mortarMap.state(),prototype:P.weapon==='quiver'&&P.quiverPrototype,engagement:configuration(),traceGuides:fx.filter(f=>f.trace).map(f=>({...f.trace.state(),visible:f.obj.visible})),opticHeight,cameraHeight:camera.position.y,recoil,
      sequence:{...sequence},beam:heldBeam?{left:heldBeam.left,key:heldBeam.key,screen:heldBeam.from.clone().lerp(heldBeam.end,.1).project(camera).toArray()}:null,cues:cueLog.slice(),audioVoices:sfx.voices,voiceDetails:sfx.activeVoices,audioState:sfx.contextState,disposed,time:clock,targets:targets.map(t=>({id:t.id,alive:t.alive,hp:t.hp,slowUntil:t.slowUntil||0})),profile:clone(profile()),missiles:clone(draft.missiles),pool:missilePool?.stats(),live:missiles.length,rounds:rounds.length,...metrics}),
    dispose:()=>disposeSniper(),
    select:key=>{weaponControl.setValue(key);},fire:()=>fire(),reset:()=>spawnTargets(),
    aim:()=>{const t=targets.find(t=>t.alive);if(t){aimYaw=Math.atan2(t.pos[0],t.pos[2]);aimPitch=Math.atan2(t.pos[1]-muzzleHeight(),Math.hypot(t.pos[0],t.pos[2]));}},
    distance:value=>{P.range=value;P.spread=0;spawnTargets();},
    tracer:value=>{P.tracer=value;},mortarAim:point=>{mortarAim=point;},
  };
  function disposeSniper(){
    if(disposed)return;disposed=true;active=false;modelSerial++;cancelAnimationFrame(frameId);listeners.abort();
    clearShots();mortarMap.dispose();plateFalls.length=0;clearTargets();missilePool?.dispose();transfer.dispose();gui.destroy();sfx.dispose();
    disposeObj(scene);postfx.dispose();environment.dispose();pmrem.dispose();sky.dispose();renderer.dispose();renderer.domElement.remove();
  }
  return {setActive(on){if(disposed)return;active=on;if(on){resize();clockT.getDelta();}},dispose:disposeSniper};
}
