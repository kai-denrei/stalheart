import { makeOrdnanceShell } from './shell.js';
import { createWeaponVoice } from './weapon-voice.js';
import { firingFor } from './content/firing-defaults.js';
import { TOWER_BY_KEY, effectiveStats } from './towers.js';
import { mountSentryEffects, EFFECT_HELP } from './labs/sentry-effects.js';
import { RANGE_SURFACES, makeRangeSurface, surfaceNormal } from './labs/range-surfaces.js';
import { makeImpactBurst, orientImpact } from './impactfx.js';
import { tuneFor, resolveImpactColors } from './sentryfx.js';
import { pickMissileTarget, missileGroundDistance, missileLimits as scaledMissileLimits, stepMissileLock, missileCanFire } from './domain/missile-targeting.js';
import { mountControlHelp } from './labs/control-help.js';
import { SENTRY_HELP } from './labs/sentry-help.js';
import { CONTENT } from './content/runtime.js';
import { clone } from './content/preset.js';
import { MISSILE_LAUNCH_ELEVATION } from './content/missile-defaults.js';
import { createMissilePool, launchDart, advanceDart } from './missiles.js';
import { mountPresetPanel } from './labs/preset-panel.js';
import { mountSentryRadial } from './labs/sentry-radial.js';
// sentry-tab.js — THE SENTRY RANGE. Eight numbered Sentry families from the
// Sentry Workshop (https://jelaludo.github.io/SentryTowers_A6/) on a range
// where units pop up, and the turret has to find them, turn to them, and
// shoot them with its own articulation.
//
// The models arrive with a name contract, and this tab is a CLIENT of it
// rather than a second copy of the rig:
//
//   ROOT → BASE → YAW → PITCH → RECOIL      the articulation, every family
//   MUZZLE_00 … MUZZLE_nn                   where a round actually leaves
//   ROTOR                                   the Rotor's barrel cluster
//
// Two rules from this project apply and are worth naming, because both are
// easy to get wrong here and invisible when you do:
//
//   THE RULES ARE PURE AND ELSEWHERE. src/sentry.js owns every angle, every
//   limit and every refusal, and is Node-tested. This file owns meshes.
//
//   VALUES THAT MUST AGREE WITH THE RENDER ARE DERIVED FROM IT. A tracer
//   leaves along the MUZZLE's own world transform (getWorldQuaternion), not
//   along the yaw/elev the sim asked for — those two differ during a slew,
//   and a bullet that leaves along the INTENT rather than the barrel is a
//   bullet that visibly misses its own gun.
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/meshopt_decoder.module.js';
import GUI from '../vendor/lil-gui.esm.js';
import { makeBloom } from './postfx.js';
import { makeBeamShot } from './shotfx.js';
import { bakeGalaxyCube } from './galaxybake.js';
import { SKY_PRESET } from './galaxyseed.js';
import { LOOKS } from './looks.js';
import { makeDotEnemy, makeBulletCloud, makeDotBurst } from './units.js';
import { CREATURE_TINTS, accentFor } from './enemyspec.js';
import { mulberry32 } from './rng.js';
import { deepLink, wireDeepLink } from './deeplink.js';
import {
  SENTRY_TUNE, SENTRY_FAMILIES, SENTRY_TIERS, familyById, sentryUrl,
  makeSentry, makeRange, stepRange, pickTarget, track, slew, stepGun, lobAngle,
  canFire, fire, hitTarget, landedOn, aimAt, inEnvelope, aimError,
  placeBattery, relTo, stepWaves, stepWalkers, deadZone, leadPoint,
} from './sentry.js';
import { weaponKind } from './sentryfx.js';
import { makeAudio } from './audio.js';
import {
  makeLock,
} from './lockon.js';

// the pop-up units, from the game's own roster — this is a range for OUR
// units, not a new bestiary
const TARGET_TYPES = ['phage', 'ghost', 'corona', 'barbed'];

export function initSentryTab(root) {
  let active = false, disposed = false;
  let draft = clone(CONTENT), missilePool = null;
  const missileStats = { launched: 0, arrived: 0, last: null };
  const missileStatus = document.createElement('output');
  missileStatus.id = 'sentry-missile-status'; root.append(missileStatus);
  const isMissile = () => Object.hasOwn(draft.missiles, familyById(P.family).key);
  createMissilePool().then(pool => {
    if(disposed){pool.dispose();return;} missilePool=pool; missileStatus.textContent='Click a tower to select all Sentries.';
  }).catch(error => { missileStatus.textContent=`Missile kit failed to load: ${error.message}`; });
  const q = new URLSearchParams(location.search);
  const container = root.querySelector('#sentry-app');
  const hud = root.querySelector('#sentry-hud');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;

  const sky = bakeGalaxyCube(renderer, { ...SKY_PRESET, seed: 4414, face: 1024, galaxies: 2 });
  scene.background = sky.texture;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromCubemap(sky.texture).texture;
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.4);
  sun.position.set(6, 10, 5); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8ab4ff, 0.8); fill.position.set(-7, 4, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9fdcff, 1.0); rim.position.set(2, 3, -8); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xc9d4e6, 0x141216, 0.35));
  const look = LOOKS.tronColors;

  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 72),
    new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  let grid = null;
  // the RANGE RING: the ground marks where targets can pop, so a miss and an
  // out-of-envelope refusal can be told apart by eye
  const ringMat = new THREE.LineBasicMaterial({ color: 0x2b6b96, transparent: true, opacity: 0.5 });
  const deadMat = new THREE.LineBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.55 });
  const rings = new THREE.Group(); scene.add(rings);
  const postfx = makeBloom(renderer, scene, camera, { scale: 1, strength: 0.35, radius: 0.5, threshold: 0.35 });

  const P = {
    family: 'rotor', tier: 1,
    live: true,            // the range runs; off freezes it for a look
    autoFire: true,
    mode: 'waves', surfaceDistance: 12, surfaceSize: 3, surfaceAngle: 0, timeScale: 1,         // waves | pop — what the range presents
    walls: true,           // draw the plinth a mounted sentry stands on
    lead: true,            // aim where it WILL be — see leadPoint
    manual: false,         // drive the turret by hand instead of tracking
    yaw: 0, elev: 0,       // ...with these
    seed: 4414,
    tracers: true, envelope: true, wire: true,
    sound: true,           // every family has a voice — SENTRY_FAMILIES owns which
    ...SENTRY_TUNE,
  };
  // the defaults, before the URL touches them — the deep link writes only
  // what DIFFERS
  const P0 = { ...P };
  {
    for (const [k, v] of q.entries()) {
      if (!(k in P) || typeof P[k] === 'function') continue;
      if (typeof P[k] === 'number') { const n = parseFloat(v); if (Number.isFinite(n)) P[k] = n; }
      else if (typeof P[k] === 'boolean') P[k] = v !== '0';
      else P[k] = v;
    }
  }

  if (q.has('sentry') && !q.has('family')) P.family = q.get('sentry');
  P.family = familyById(P.family).id;
  // Legacy experiment URLs seed only the selected working copy, never shipped content.
  const initialMissile = draft.missiles[familyById(P.family).key];
  if (initialMissile) {
    for (const [key, query, min, max] of [['lockGate','lockGate',.5,30],['lockTime','lockTime',.1,6],
      ['lockBreak','lockBreak',1,90],['aimTolerance','tolerance',.2,15]]) {
      if (q.has(query)) initialMissile[key] = Math.max(min, Math.min(max, P[query]));
    }
    initialMissile.lockBreak = Math.max(initialMissile.lockBreak, initialMissile.lockGate);
  }

  if (!['waves', 'pop', ...Object.keys(RANGE_SURFACES)].includes(P.mode)) P.mode = 'waves';
  for (const [key, min, max] of [['surfaceDistance', 1, 60], ['surfaceSize', 1, 8], ['surfaceAngle', -80, 80], ['timeScale', 0.1, 1]])
    P[key] = Math.max(min, Math.min(max, P[key]));
  P.tier = Math.max(1, Math.min(3, Math.round(P.tier)));

  // --- state ---------------------------------------------------------------
  // THE BATTERY. One entry per sentry: its state (from the pure module), its
  // own clone of the model, and its own pivots and muzzles — because two
  // turrets three units apart do not agree about a single bearing, and each
  // one tracks, cools and recoils on its own clock.
  // EVERY FAMILY HAS A VOICE, and which one is the TABLE's business: the tab
  // only knows there is a `fire` key and maybe a `ready` one. Adding a
  // new family with a new sound then needs no change here at all.
  const sfx = makeAudio({ seed: 7 });
  sfx.arm();
  const beamVoice=createWeaponVoice(sfx,()=>P.sound);
  // ?voiceprobe=1 — WHICH SOUND, WHEN. A headless run cannot hear anything,
  // so the only way to check that a family's voice is wired (and that the
  // Rotor's spin-up fires on the edge rather than every frame) is to log the
  // calls and count them.
  const heard = new Map();
  const voiceLog = q.get('voiceprobe') === '1';
  const voice = (key) => {
    if (!key) return;
    if (voiceLog) {
      heard.set(key, (heard.get(key) || 0) + 1);
      console.log(`VOICE ${key} x${heard.get(key)} t=${(performance.now() / 1000).toFixed(1)}`);
    }
    if (P.sound) sfx.play(key);
  };

  const seekers = [];

  let proto = null;            // the loaded GLB, cloned per sentry
  const battery = [];          // { st, obj, yaw, pitch, recoil, rotor, muzzles, spin, spinRate, wall }
  let modelSerial = 0;
  const st = makeSentry(P.family, P.tier);   // kept for the HUD's headline
  let range = makeRange();
  let rng = mulberry32(P.seed >>> 0);
  const targetObjs = new Map();   // target id -> mesh
  const tracers = [];             // { mesh, pos, dir, left, id }

  // BEAM WEAPONS ON THE RANGE — the BOARD'S beam, not a lookalike.
  //
  // This used to be a doubled THREE.Line for the lance and a spray of Points
  // for the throw, because beamfx's createBeam was tried first and "rendered
  // nothing in this scene". It renders here perfectly well. What did not
  // render was a beam built at the BOARD's widths: the board's lance is about
  // a twentieth of a cell across and is watched from six cells away, while
  // this yard is watched from roughly fifty — so the ribbon came out under a
  // pixel wide. Valid geometry, valid uniforms, a draw call every frame, and
  // nothing on the screen, which is exactly what was reported and exactly
  // what a screenshot cannot tell apart from a shader that fails.
  //
  // So the LOOK is shared (shotfx's makeBeamShot, the board preset, the same
  // LANCE_LOOK / THROW_LOOK) and the SIZE is local — one width in world units,
  // which is the rule every other builder in shotfx already follows.
  const beams = [];               // { obj, left, dur }
  // a lance is a line and a throw is a spray; the ratio between them lives in
  // the shared looks, so this is the one number the range owns
  const RANGE_BEAM_W = 0.6;
  function spawnRangeBeam(from, to, kind, colorHex, target, b) {
    const life=firingFor(familyById(P.family).key).beamHold;
    let entry=beams.find(e=>e.owner===b);
    if(!entry){const obj=makeBeamShot(from,to,colorHex,kind,{glowWidth:RANGE_BEAM_W});scene.add(obj);entry={obj,owner:b};beams.push(entry);}
    entry.obj.userData.setEndpoints(from,to);entry.left=life;entry.dur=life;

    // THE HIT IS SCORED THE SAME WAY A ROUND'S IS — the drawing changed, not
    // the accuracy. A beam that always hit would make the range lie about the
    // tolerance knob, which is the one thing it exists to measure. Copied from
    // the tracer path: landedOn takes an ARRAY end point, and hitTarget is
    // credited to the sentry that FIRED, because crediting the headline state
    // loses every hit to aimFrame's rebuild.
    const aimed = target && target.id >= 0
      ? range.targets.find((x) => x.id === target.id) : null;
    const res = aimed && landedOn([to.x, to.y, to.z], aimed, P)
      ? rangeHit(b ? b.st : st, range, target.id) : null;
    emitEffect('impact', to.toArray(), contactNormal(aimed, from.toArray()));
    if (res === 'kill') dropTarget(target.id, true);
  }

  function stepBeams(dt) {
    beamVoice.update(familyById(P.family).key,beams.length>0);
    for (let i = beams.length - 1; i >= 0; i--) {
      const e = beams[i];
      e.left -= dt;
      const u = Math.min(1,Math.max(0, e.left / .12));
      // setFade, not material.opacity: these are ShaderMaterials and writing
      // `opacity` on one does nothing at all
      if (e.obj.userData.update) e.obj.userData.update(clock.getElapsedTime());
      if (e.obj.userData.setFade) e.obj.userData.setFade(u);
      else e.obj.traverse((o) => { if (o.material) o.material.opacity = u; });
      if (e.left <= 0) {
        scene.remove(e.obj);
        e.obj.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        beams.splice(i, 1);
      }
    }
  }
  const fx = [];                  // { obj, tick }

  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Vector3();

  function disposeObj(o) {
    o.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      const m = n.material;
      if (Array.isArray(m)) m.forEach((x) => x && x.dispose && x.dispose());
      else if (m && m.dispose) m.dispose();
    });
  }

  function layGround() {
    const r = Math.max(4, Math.ceil(P.ringMax + 2));
    floor.scale.setScalar(r);
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
    grid = new THREE.GridHelper(r * 2, r * 2, look.edges.color, look.edges.color);
    grid.material.transparent = true; grid.material.opacity = 0.18;
    grid.position.y = 0.002; grid.visible = P.wire;
    scene.add(grid);
    // the two ring radii the targets pop between
    while (rings.children.length) {
      const c = rings.children.pop();
      c.geometry.dispose(); rings.remove(c);
    }
    const dz = deadZone(P, gunHeight());
    for (const rr of [P.ringMin, P.ringMax, dz > 0 && Number.isFinite(dz) ? dz : 0]) {
      if (!(rr > 0)) continue;
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.sin(a) * rr, 0.01, Math.cos(a) * rr));
      }
      // the dead ring is drawn in the alarm colour: everything inside it
      // walks under the barrels
      rings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        rr === dz ? deadMat : ringMat));
    }
    frameHome();
  }

  // THE OPENING FRAME IS TOP-DOWN, the board's own build eye (operator: "start
  // with a top down view similar to the main game"). Looking down at about
  // sixty degrees shows the whole ring and where every target pops, which is
  // what this lab is for; the old three-quarter view showed the turret's
  // silhouette and half the range.
  //
  // It is also the RE-CENTRE, because a phone's orbit controls are one finger
  // to turn and two to zoom, and a few seconds of that leaves the range
  // somewhere behind you with no way back.
  function frameHome() {
    if (Object.hasOwn(RANGE_SURFACES, P.mode)) {
      // Frame both ends of the firing lane, with room above for the missile arc.
      const span = Math.max(10, P.surfaceDistance + P.surfaceSize);
      controls.target.set(0, 2, P.surfaceDistance * 0.5);
      camera.position.set(span * 0.95, span * 0.7, P.surfaceDistance * 0.5 - span * 1.15);
      camera.lookAt(controls.target); controls.update();
      return;
    }
    // SOLVED, not guessed: back off far enough that the outer ring fits the
    // frame's HEIGHT (the narrow axis on every phone in landscape), then sit
    // at 58 degrees. A hand-picked distance framed the ring at 9 units and
    // cut it off at 6.
    const r = Math.max(4, P.ringMax) * 1.25;
    const d = r / Math.tan((camera.fov * Math.PI) / 360);
    const el = (58 * Math.PI) / 180;
    camera.position.set(0, d * Math.sin(el), d * Math.cos(el));
    controls.target.set(0, 0.6, 0);
    controls.update();
  }

  // --- the model -----------------------------------------------------------
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.85, metalness: 0.15 });

  function clearBattery() {
    while (battery.length) {
      const b = battery.pop();
      scene.remove(b.obj); // Geometry/materials are owned by proto, shared by the battery.
      if (b.wall) { scene.remove(b.wall); b.wall.geometry.dispose(); }
    }
  }

  // One entry, from a clone of the prototype. Static meshes, so a plain
  // clone shares the geometry and the materials — N sentries cost one upload
  // — and the named pivots survive it, which is the whole reason the
  // workshop's contract is worth having.
  function addSentry(pos, i) {
    if (!proto) return null;
    const obj = proto.clone(true);
    const b = {
      st: makeSentry(P.family, P.tier, pos),
      obj,
      yaw: obj.getObjectByName('YAW'),
      pitch: obj.getObjectByName('PITCH'),
      recoil: obj.getObjectByName('RECOIL'),
      rotor: obj.getObjectByName('ROTOR'),
      muzzles: [],
      spin: 0, spinRate: 0,
      wall: null,
      lock: makeLock(),      // the Quiver's; idle for every other family
      spooled: false,        // has the ready voice already played for this run-up
    };
    obj.traverse((o) => { if (/^MUZZLE_\d+$/.test(o.name || '')) b.muzzles.push(o); });
    b.muzzles.sort((a, c) => a.name.localeCompare(c.name));
    obj.position.set(pos[0], pos[1], pos[2]);
    // ...and a wall under a mounted one, so the gun is standing ON something
    // rather than floating. Drawn from the mount height, so it is always
    // exactly as tall as the knob says.
    if (pos[1] > 0.01 && P.walls) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.7, pos[1], 1.7), wallMat);
      w.position.set(pos[0], pos[1] / 2, pos[2]);
      scene.add(w);
      b.wall = w;
    }
    scene.add(obj);
    battery.push(b);
    return b;
  }

  // the trunnion's height above its own feet, measured off the model — the
  // number that makes even a floor-mounted sentry have a dead zone
  let trunnionY = 1.4;
  function gunHeight() { return P.mount + trunnionY; }

  function rebuildBattery() {
    clearBattery();
    if (!proto) return;
    const spots = placeBattery(P);
    spots.forEach((p, i) => addSentry(p, i));
    if (battery[0] && battery[0].pitch) {
      battery[0].obj.updateMatrixWorld(true);
      const w = new THREE.Vector3();
      battery[0].pitch.getWorldPosition(w);
      trunnionY = Math.max(0, w.y - battery[0].st.pos[1]);
    }
    layGround();
    console.log(`SENTRY battery ${battery.length}x ${P.family} t${P.tier}`
      + ` muzzles=${battery[0] ? battery[0].muzzles.length : 0} mount=${P.mount}`
      + ` spread=${P.spread} at [${spots.map((p) => p.map((v) => v.toFixed(1)).join('/')).join(' ')}]`);
    hudLine();
  }

  function loadSentry() {
    root.dataset.modelReady = 'false';
    resetRange();
    const ticket = ++modelSerial;
    const url = sentryUrl(P.family, P.tier);
    loader.load(url, (gltf) => {
      if (disposed || ticket !== modelSerial) { disposeObj(gltf.scene); return; }
      clearBattery();
      if (proto) disposeObj(proto);
      proto = gltf.scene;
      // the SIGNAL and IDENTIFICATION rungs are the model's own lights; under
      // a sky and one sun they read as flat paint unless they emit. Done on
      // the PROTOTYPE, so every clone shares the one material.
      proto.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m || m.userData.sentryLit) continue;
          m.userData.sentryLit = true;
          if (/^(Signal|Identification|Copper)$/.test(m.name || '') && m.emissive) {
            m.emissive.copy(m.color).multiplyScalar(m.name === 'Copper' ? 0.25 : 0.8);
            m.emissiveIntensity = 1;
            m.needsUpdate = true;
          }
        }
      });
      rebuildBattery();
      syncMissileControls();
      effectsPanel.refresh();
      root.dataset.sentry = familyById(P.family).key;
      root.dataset.modelReady = 'true';
      console.log(`SENTRY ${P.family} t${P.tier}: ${battery[0] ? battery[0].muzzles.length : 0} muzzle(s)`
        + ` yaw=${!!(battery[0] && battery[0].yaw)} pitch=${!!(battery[0] && battery[0].pitch)}`
        + ` recoil=${!!(battery[0] && battery[0].recoil)} rotor=${!!(battery[0] && battery[0].rotor)}`
        + ` fixed=${!!familyById(P.family).fixed}`);
    }, undefined, (e) => {
      hud.textContent = `${P.family} t${P.tier}: failed to load (${e && e.message})`;
    });
  }

  // --- the range -----------------------------------------------------------
  const profile = () => draft.weapons[familyById(P.family).key];
  const surfaceMode = () => Object.hasOwn(RANGE_SURFACES, P.mode);
  const effectStats = { impacts: 0, muzzles: 0, last: null };
  function emitEffect(slot, point, normal, weapon = profile()) {
    const effect = weapon[slot];
    const surface = RANGE_SURFACES[P.mode] || RANGE_SURFACES.hull;
    const colors = resolveImpactColors(effect, { surface, weapon: weapon.shot.beamColor || look.walkerHi });
    const object = makeImpactBurst(effect.recipe, tuneFor(effect), colors, effectStats.impacts + effectStats.muzzles + 1, effect.size);
    orientImpact(object, point, normal);
    scene.add(object); fx.push({ obj: object, tick: object.userData.tick });
    while (fx.length > 128) { const old = fx.shift(); scene.remove(old.obj); disposeObj(old.obj); }
    effectStats[slot === 'impact' ? 'impacts' : 'muzzles']++;
    if (slot === 'impact') effectStats.last = { size: effect.size, recipe: clone(effect.recipe), point: point.slice(), normal: normal.slice(), mode: P.mode };
  }
  function contactNormal(target, from) {
    const object = target && targetObjs.get(target.id);
    if (object?.userData.surface) return surfaceNormal(object, from);
    const p = target?.pos || [0, 0, 0];
    return new THREE.Vector3().fromArray(from).sub(new THREE.Vector3().fromArray(p)).normalize().toArray();
  }
  function rangeHit(owner, targets, id) {
    if (surfaceMode()) { owner.hits++; return 'hit'; }
    return hitTarget(owner, targets, id);
  }
  function resetRange() {
    for (const [, o] of targetObjs) { scene.remove(o); disposeObj(o); }
    targetObjs.clear();
    for (const t of tracers) { scene.remove(t.mesh); disposeObj(t.mesh); }
    tracers.length = 0;
    for (const m of seekers) missilePool?.release(m.mesh);
    seekers.length = 0;
    for(const beam of beams){scene.remove(beam.obj);disposeObj(beam.obj);}
    beams.length=0;beamVoice.dispose();
    for(const effect of fx){scene.remove(effect.obj);disposeObj(effect.obj);}
    fx.length=0;
    for (const b of battery) { b.lock = makeLock(); b.spooled = false; }
    range = makeRange();
    if (surfaceMode()) range.targets.push({ id: 0, up: true, hp: P.hp, pos: [0, P.surfaceSize * 0.325, P.surfaceDistance], vel: [0, 0, 0], age: 1 });
    rng = mulberry32(P.seed >>> 0);
    st.rounds = 0; st.hits = 0; st.kills = 0;
    for (const b of battery) { b.st.rounds = 0; b.st.hits = 0; b.st.kills = 0; b.st.target = -1; }
  }

  function targetMesh(t) {
    const type = TARGET_TYPES[t.id % TARGET_TYPES.length];
    const o = surfaceMode() ? makeRangeSurface(P.mode, P.surfaceSize, P.surfaceAngle)
      : makeDotEnemy(type, { walker: CREATURE_TINTS[type], walkerHi: accentFor(type) });
    if (!surfaceMode()) o.scale.setScalar(0.42);
    o.userData.popT = 0;
    scene.add(o);
    targetObjs.set(t.id, o);
    return o;
  }

  function dropTarget(id, killed) {
    const o = targetObjs.get(id);
    if (!o) return;
    if (killed) {
      const b = makeDotBurst(0xff8a5c, [0, 1, 0], 34);
      b.scale.setScalar(0.5);
      b.position.copy(o.position);
      scene.add(b);
      fx.push({ obj: b, tick: b.userData.tick });
    }
    scene.remove(o); disposeObj(o);
    targetObjs.delete(id);
  }

  // --- shooting ------------------------------------------------------------
  // THE BORESIGHT: the point the TRUNNION's axis is pointing at, out at the
  // target's range. Every muzzle converges on it.
  //
  // This is the one thing a multi-barrel mount forced. Firing each cell
  // straight along its own axis is what a diagram says a launcher does, and
  // it is wrong: the Quiver's eighteen cells sit across two pods, so parallel
  // fire put every round a metre beside a target the gun was dead on. Real
  // mounts are BORESIGHTED — the barrels toe in on a common point. Converging
  // on the axis (rather than on the target itself) keeps the aim honest: if
  // the drive is three degrees off, the boresight is three degrees off and
  // every cell misses together, which is what the tolerance knob is for.
  const boreDir = new THREE.Vector3(), borePt = new THREE.Vector3();
  const pivotW = new THREE.Vector3();

  // The gun's own frame: where the trunnion IS and where it POINTS, both off
  // the render transform. Filled before anything reads them — the first cut
  // measured the range to the target from a `pivotW` the boresight had not
  // set yet, which is a stale reading from whichever sentry fired last.
  function gunFrame(b) {
    if (b.pitch) {
      b.pitch.getWorldPosition(pivotW);
      b.pitch.getWorldQuaternion(tmpQ);
      boreDir.set(0, 0, 1).applyQuaternion(tmpQ).normalize();
    } else {
      pivotW.set(b.st.pos[0], b.st.pos[1] + 1.4, b.st.pos[2]);
      boreDir.set(0, 0, 1);
    }
  }

  function launchSeeker(b, mi, target) {
    if (!missilePool?.available) return;
    const config = clone(draft.missiles[familyById(P.family).key]);
    const mz = b.muzzles[Math.min(mi, b.muzzles.length - 1)];
    const from = new THREE.Vector3(), direction = new THREE.Vector3(0,0,1);
    b.obj.updateMatrixWorld(true);
    if(mz){mz.getWorldPosition(from);mz.getWorldQuaternion(tmpQ);direction.applyQuaternion(tmpQ);}
    else {gunFrame(b);from.copy(pivotW);direction.copy(boreDir);}
    const object = target ? targetObjs.get(target.id) : null;
    const endpoint = object ? object.position.toArray() : target ? target.pos.slice()
      : from.clone().addScaledVector(new THREE.Vector3(direction.x,0,direction.z).normalize(),P.ringMax).toArray();
    const m = launchDart(missilePool,{config,from:from.toArray(),target:endpoint,direction:direction.toArray()});
    Object.assign(m,{tid:target?.id ?? -1,by:b,weapon:clone(profile()),origin:from.toArray()});
    m.mesh.visible=P.tracers;scene.add(m.mesh);seekers.push(m);
    missileStats.launched++;
    missileStats.last={family:familyById(P.family).key,profile:config.profile,duration:config.duration,length:config.length,
      launchPosition:from.toArray(),launchDirection:direction.toArray(),
      targetDistance:target?missileGroundDistance(b.st.pos,target.pos):null};
    emitEffect('muzzle', from.toArray(), direction.toArray());
    b.lock=makeLock();b.st.target=-1;voice(familyById(P.family).fire);
  }

  function stepSeekers(dt) {
    for(let i=seekers.length-1;i>=0;i--){
      const m=seekers[i],target=range.targets.find(t=>t.id===m.tid && t.up && t.hp>0);
      const object=target ? targetObjs.get(target.id) : null;
      if(object)m.target=object.position.toArray();
      const arrived=advanceDart(missilePool,m,dt),pose=m.pose;
      m.mesh.visible=P.tracers;
      if(!arrived)continue;
      if(target){
        const result=rangeHit(m.by.st,range,m.tid);
        if(result==='kill')dropTarget(m.tid,true);
      }
      missileStats.arrived++;
      missileStats.lastArrival={family:familyById(m.by.st.family).key,duration:m.t,ignition:pose.ignition,error:Math.hypot(...pose.position.map((v,i)=>v-m.target[i]))};
      emitEffect('impact', pose.position, contactNormal(target,m.origin), m.weapon);
      missilePool.release(m.mesh);seekers.splice(i,1);
    }
  }

  function shoot(b, mi, target, aimPt) {
    const mz = b.muzzles[Math.min(mi, b.muzzles.length - 1)];
    const from = new THREE.Vector3();
    if (mz) mz.getWorldPosition(from);      // the ORIGIN is the real muzzle
    else from.set(b.st.pos[0], b.st.pos[1] + 1.4, b.st.pos[2]);
    gunFrame(b);
    // ...and the DIRECTION is the BORESIGHT: the point this gun's own axis is
    // pointing at, out at the target's range. Every muzzle converges on it.
    //
    // Firing each cell straight along its own axis is what a diagram says a
    // launcher does, and it is wrong: the Quiver's eighteen cells sit across
    // two pods, so parallel fire put every round a metre beside a target the
    // gun was dead on. Converging on the AXIS (rather than on the target)
    // keeps the aim honest — three degrees off the drive is three degrees off
    // the boresight, and every cell misses together.
    // the range of the AIM POINT, not of the target. With lead they are not
    // the same place, and a round that stops at the target's PRESENT range
    // falls short of the spot the barrel is pointing at by exactly the lead —
    // so leading the target made every shot miss by the amount of the lead.
    const at = aimPt || (target ? target.pos : null);
    const rng3 = at
      ? Math.hypot(at[0] - pivotW.x, at[1] - pivotW.y, at[2] - pivotW.z)
      : P.ringMax;
    borePt.copy(pivotW).addScaledVector(boreDir, rng3);
    const dir = borePt.clone().sub(from);
    if (dir.lengthSq() < 1e-9) dir.set(0, 0, 1);
    dir.normalize();
    // WHAT LEAVES THE BARREL depends on the weapon, and the range used to
    // have no opinion: everything that was not a lob or a missile flew as a
    // BULLET, so the Plasma thrower and the Lancer — a spray and a
    // light-lance, the two things on the roster least like a bullet — both
    // fired tracers. The kind comes from sentryfx.js, the same table the
    // board and the FX lab read, so the three cannot disagree again.
    const kind = weaponKind(P.family);
    const fxp = profile();
    emitEffect('muzzle', from.toArray(), dir.toArray(), fxp);
    const beamHex = (fxp.shot && fxp.shot.beamColor) || look.walkerHi;
    if (kind === 'lance' || kind === 'throw') {
      spawnRangeBeam(from, borePt, kind, beamHex, target, b);
      return;
    }
    const mesh = kind==='lob'?makeOrdnanceShell(.65):makeBulletCloud({ body: look.walkerHi, hi: 0xffffff });
    // CALIBRE FOLLOWS THE TRACER SIZE, squared: a Rotor round (6 px) is under half a Needle's (9 px). The bullet's nose is +Y; it flies nose first.
    if(kind!=='lob'){mesh.scale.setScalar(0.09 * (fxp.shot.projPx / 9) ** 2);mesh.userData.nose=new THREE.Vector3(0,1,0);}else mesh.userData.nose=new THREE.Vector3(0,0,1);
    mesh.position.copy(from);
    scene.add(mesh);
    // it flies to the boresight POINT — so an aim that is off puts the round
    // out at the target's range and beside it, which is what a miss looks
    // like and what landedOn then measures
    let dist = borePt.distanceTo(from) || P.ringMax;
    // A LOBBED ROUND DOES NOT GO WHERE THE TUBE POINTS. The tube points at
    // the sky — that is what a lob IS — so flying the round along the
    // boresight sent it straight up and it landed nowhere near anything.
    // What carries the round is the ground BEARING; the elevation becomes
    // the arc, and the arc is DRAWN rather than integrated.
    //
    // The accuracy coupling survives, which is the part worth keeping: the
    // bearing is still taken from the BORESIGHT, so a round fired mid-slew
    // still leaves on the wrong heading and still misses. Only the vertical
    // is reinterpreted.
    const famL = familyById(P.family);
    let lob = null;
    if (famL.lob) {
      const flat = boreDir.clone();
      flat.y = 0;
      const at2 = aimPt || (target ? target.pos : null);
      if (flat.lengthSq() > 1e-9 && at2) {
        flat.normalize();
        dir.copy(flat);
        dist = Math.hypot(at2[0] - from.x, at2[2] - from.z) || P.ringMax;
        borePt.copy(from).addScaledVector(dir, dist);
        borePt.y = at2[1];
      }
      lob = {
        total: dist,
        h: famL.arcCells * (P.ringMax / 9),
        drop: (borePt.y - from.y) / Math.max(1e-6, dist),
      };
    }
    tracers.push({ mesh, pos: from.clone(), startY: from.y, dir, left: dist, gone: 0, lob,
      id: target ? target.id : -1, by: b, weapon: clone(fxp), origin: from.toArray() });
    voice(familyById(P.family).fire);
  }

  function stepTracers(dt) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      const tr = tracers[i];
      // a shell is slower than a bullet, and a lob you cannot see coming is
      // not a lob — half speed, which is also what makes the arc readable
      const step = Math.min(tr.left, P.muzzleVel * (tr.lob ? 0.45 : 1) * dt);
      tr.pos.addScaledVector(tr.dir, step);
      tr.left -= step;
      tr.gone += step;
      const previous=tr.mesh.position.clone();
      tr.mesh.position.copy(tr.pos);
      if (tr.lob && tr.lob.total > 1e-6) {
        // 4u(1-u): nought at the tube, nought at the impact, the arc height
        // at the top. The tracer's POSITION stays the honest straight-line
        // one — that is what landedOn measures — and only the drawing is
        // lifted, so the arc cannot make the gun more or less accurate.
        // TWO DIFFERENT THINGS. The DESCENT belongs to the path — the round
        // really does end up on the ground at the target's height, and
        // landedOn measures the path, so leaving it out left every shell
        // hovering a metre and a half up and missing by exactly that. The
        // PARABOLA belongs only to the drawing: it is what makes the shot
        // read as a lob, and putting it in the path would make the arc
        // change where the round lands, which it must not.
        const u = Math.min(1, tr.gone / tr.lob.total);
        tr.pos.y = tr.startY + tr.gone * tr.lob.drop;
        tr.mesh.position.copy(tr.pos);
        tr.mesh.position.y += 4 * u * (1 - u) * tr.lob.h;
      }
      if(tr.mesh.userData.nose){const direction=tr.mesh.position.clone().sub(previous).normalize();if(direction.lengthSq()>0)tr.mesh.quaternion.setFromUnitVectors(tr.mesh.userData.nose,direction);}
      if (tr.left > 1e-4) continue;
      // DID IT LAND ON IT? The tracer left along the BARREL, and the barrel is
      // only as close as the drive had got it — so a round fired mid-slew
      // arrives somewhere else, and says so. Without this the tolerance knob
      // would be decoration and every shot would hit.
      const aimed = tr.id >= 0 ? range.targets.find((x) => x.id === tr.id) : null;
      // credited to the SENTRY THAT FIRED IT. Crediting the headline state
      // silently lost every hit: aimFrame rebuilds that from the battery's
      // own totals each frame, so a kill written there was overwritten
      // before anything read it.
      const res = landedOn([tr.pos.x, tr.pos.y, tr.pos.z], aimed, P)
        ? rangeHit(tr.by ? tr.by.st : st, range, tr.id) : null;
      emitEffect('impact', tr.pos.toArray(), contactNormal(aimed,tr.origin), tr.weapon);
      if (res === 'kill') dropTarget(tr.id, true);
      scene.remove(tr.mesh); disposeObj(tr.mesh);
      tracers.splice(i, 1);
    }
  }

  // --- the frame -----------------------------------------------------------
  function stepRangeFrame(dt) {
    if (surfaceMode()) {
      // Persistent material fixtures receive repeated hits without becoming enemies.
    } else if (P.mode === 'waves') {
      // enemies that walk in and can die. Anything that reaches the guns has
      // GOT THROUGH — it comes off the field and is counted, because a range
      // an enemy walks over and keeps going measures nothing.
      const sent = stepWaves(range, dt, rng, P);
      if (sent) console.log(`SENTRY wave ${range.wave} — ${sent} inbound`);
      for (const id of stepWalkers(range, dt, P)) dropTarget(id, false);
    } else {
      for (const id of stepRange(range, dt, rng, P)) dropTarget(id, false);
    }
    for (const t of range.targets) {
      const o = targetObjs.get(t.id) || targetMesh(t);
      if (surfaceMode()) { o.position.fromArray(t.pos); continue; }
      // POP UP: they rise out of the ground over a third of a second, which
      // is the whole reason the range is a popper — a target that fades in
      // gives the turret no moment to react to
      o.userData.popT = Math.min(1, (o.userData.popT ?? 0) + dt * 3);
      const e = o.userData.popT * o.userData.popT * (3 - 2 * o.userData.popT);
      o.position.set(t.pos[0], t.pos[1] * e + (e - 1) * 0.8, t.pos[2]);
      // a walker faces where it is going, which on this range is inward
      if (t.walker) o.lookAt(0, o.position.y, 0);
      if (o.userData.tick) o.userData.tick(range.t + t.id);
    }
  }

  // EVERY SENTRY AIMS FOR ITSELF. Each one asks pickTarget in ITS OWN frame
  // (relTo), so a battery covers each other's blind bearings instead of all
  // three swinging onto the same enemy — and a gun on a wall refuses what it
  // cannot depress to while the one on the ground takes it.
  // rebuilt per frame is one object a frame; built here it is one object,
  // and it tracks the live knobs because it is spread from them
  let lobDrive = null;
  function aimFrame(dt) {
    if(root.dataset.modelReady!=='true')return;
    const fam = familyById(P.family);
    const missile = isMissile();
    const def = TOWER_BY_KEY[fam.key];
    const missileLimits = missile ? scaledMissileLimits(draft.missiles[fam.key], effectiveStats(def, P.tier-1).range / def.range) : null;
    lobDrive = fam.lob ? { ...P, elevMax: 85 } : null;
    const fixed = !!fam.fixed;
    let engaged = 0;
    for (const b of battery) {
      const s2 = b.st;
      let inside = false, tgt = null, aimPt = null;
      if (P.manual || (fixed && !missile)) {
        if(missile)s2.target=-1;
        s2.wantYaw = fixed ? 0 : P.yaw;
        s2.wantElev = fixed ? 0 : P.elev;
        inside = !fixed;
      } else {
        const i = missile
          ? pickMissileTarget(range.targets, s2.pos, s2.target, missileLimits)
          : pickTarget(range, P, s2.target, s2);
        tgt = i >= 0 ? range.targets[i] : null;
        s2.target = tgt ? tgt.id : -1;
        if(missile && !tgt){s2.wantYaw=s2.yaw;s2.wantElev=s2.elev;}
        if (tgt) {
          const o = targetObjs.get(tgt.id);
          const p = o ? [o.position.x, o.position.y, o.position.z] : tgt.pos;
          // ...and FROM THE TRUNNION, not from the model's origin. The pivot
          // sits over a metre above the base on every one of these families;
          // aiming from the base put a dead-on barrel's rounds that far past
          // the target. relTo carries the sentry's own stand, the trunnion
          // carries the rest.
          // LEAD: aim where it WILL be when the round arrives. Without it a
          // sentry hits every stationary mark and misses every walker — at
          // the default velocity a target nine units out has moved 0.56 of a
          // unit by the time the round gets there, and the hit radius is
          // 0.55. It tracks beautifully and kills nothing.
          gunFrame(b);
          const gun = [pivotW.x, pivotW.y, pivotW.z];
          aimPt = (P.lead && tgt.vel) ? leadPoint(p, tgt.vel, gun, P.muzzleVel) : p;
          const rel = [aimPt[0] - gun[0], aimPt[1] - gun[1], aimPt[2] - gun[2]];
          inside = inEnvelope(aimAt(rel), P);
          track(s2, rel, P);
          // A LOBBER POINTS UP, NOT AT (operator: "the mortar needs to shoot
          // UP in a ballistic trajectory, not directly at the target, true
          // for all instances in the turret"). track() has just aimed it
          // down the line of sight, which is right for every gun on the
          // range and wrong for the two that throw. The launch angle comes
          // from the shell's own parabola — lobAngle(range, arc) — so the
          // tube and the round are one number apart and cannot disagree.
          if (missile) {
            s2.wantElev=fixed?0:MISSILE_LAUNCH_ELEVATION;
            if(fixed)s2.wantYaw=0;
            inside=true;
          } else if (fam.lob) {
            const rng = Math.hypot(rel[0], rel[1], rel[2]);
            s2.wantElev = lobAngle(rng, fam.arcCells * (P.ringMax / 9));
            inside = true;   // a lob has no line-of-sight envelope to fail
          }
          if (inside) engaged++;
        }
      }
      // A LOBBING MOUNT HAS ITS OWN CEILING. The envelope's 65 degrees is a
      // direct-fire gun's limit; a mortar wants seventy-five and the clamp
      // was quietly eating twenty of them, leaving the tube pointed well
      // below the arc its shell was flying. The Workshop draws these mounts
      // with the elevation to prove it — its own viewer will not let a
      // Mortar BELOW 45.
      slew(s2, dt, fam.lob ? lobDrive : P);
      stepGun(s2, dt, P);
      if (b.yaw && !fixed) b.yaw.rotation.y = (s2.yaw * Math.PI) / 180;
      // THE ONE NEGATION. The module speaks elevation-positive-up; the PITCH
      // node lifts its nose on a NEGATIVE rotation about +X. Here, once.
      if (b.pitch && !fixed) b.pitch.rotation.x = -(s2.elev * Math.PI) / 180;
      if (b.recoil) b.recoil.position.z = -s2.recoil;
      if (b.rotor) {
        // THE SPIN-UP IS THE DOWNTIME VOICE. Barrels come up to speed when
        // there is something to shoot at, and that run-up is most of what a
        // rotary gun sounds like — so the sample is keyed to the moment the
        // gun DECIDES, not to the round. `spooled` is the edge: once per
        // engagement, and it re-arms only after the barrels have wound down,
        // so a target flickering at the edge of the envelope cannot make the
        // thing stutter.
        const want = inside && P.live && P.autoFire ? 16 : 0;
        if (want && !b.spooled) { voice(fam.ready); b.spooled = true; }
        if (!want && b.spinRate < 1.5 && b.spooled) {voice(fam.ready);b.spooled=false;}
        b.spinRate += (want - b.spinRate) * Math.min(1, dt * 2.2);
        b.spin += b.spinRate * dt;
        b.rotor.rotation.z = b.spin;
      }
      // A LAUNCHER MUST LOCK FIRST. The gate is the DRIVE's error, in
      // degrees, which is the same quantity `tolerance` is written in — so a
      // sentry locks by holding its aim, exactly as the player does in the
      // sniper lab, and the two are the same mechanic at different ends of
      // the ladder. Everything else fires the moment it is on target.
      let allowed = inside;
      if (missile) {
        const distance = tgt ? missileGroundDistance(s2.pos, tgt.pos) : Infinity;
        const err = aimError(s2);
        stepMissileLock(b.lock, dt, inside ? tgt : null, distance, err, missileLimits);
        allowed = inside && missileCanFire(b.lock, tgt, distance, err, missileLimits, s2.cool,
          dt > 0 && !!missilePool?.available);
      }
      const key=familyById(P.family).key;
      const cadence=['rotor','plasma','lancer'].includes(key)?{...P,cooldown:Math.max(key==='lancer'?firingFor(key).duration:0,1/effectiveStats(TOWER_BY_KEY[key],P.tier-1).rate)}:P;
      if (P.autoFire && (!fixed || missile) && P.live && (!missile || missilePool?.available) && canFire(s2, allowed, P)) {
        const mi = fire(s2, b.muzzles.length, cadence);
        if (missile) launchSeeker(b, mi, tgt);
        else shoot(b, mi, tgt, aimPt);
      }
    }
    // the headline state, for the HUD: the first gun's, plus the battery's
    // totals, so one line reads for one turret and for six
    if (battery.length) {
      const f = battery[0].st;
      st.yaw = f.yaw; st.elev = f.elev; st.wantYaw = f.wantYaw; st.wantElev = f.wantElev;
      st.target = f.target;
      st.rounds = battery.reduce((n, b) => n + b.st.rounds, 0);
      st.hits = battery.reduce((n, b) => n + b.st.hits, 0);
      st.kills = battery.reduce((n, b) => n + b.st.kills, 0);
    }
    st.engaged = engaged;
  }

  function hudLine() {
    const f = familyById(P.family);
    const t = st.target >= 0 ? range.targets.find((x) => x.id === st.target) : null;
    const n = battery.length;
    const mz = battery[0] ? battery[0].muzzles.length : 0;
    hud.textContent = `${n > 1 ? `${n}× ` : ''}${f.label} · tier ${P.tier} · ${mz} muzzle`
      + `${mz === 1 ? '' : 's'}${P.mount > 0 ? ` · on a ${P.mount}-unit wall` : ''}`
      + ` · ${f.fixed ? 'FIXED — no articulation' : `yaw ${st.yaw.toFixed(1)}° → ${st.wantYaw.toFixed(1)}°`
        + ` · elev ${st.elev.toFixed(1)}° → ${st.wantElev.toFixed(1)}°`
        + ` · err ${aimError(st).toFixed(1)}°${aimError(st) <= P.tolerance ? ' ON TARGET' : ''}`}`
      + `\n${P.mode === 'waves' ? `wave ${range.wave} · ` : ''}${range.targets.length} up`
      + ` · ${st.engaged || 0}/${n} engaging`
      + ` · ${st.rounds} fired · ${st.hits} hit · ${st.kills} killed`
      + `${st.rounds ? ` · ${Math.round((st.hits / st.rounds) * 100)}% on` : ''}`
      + `${P.mode === 'waves' ? ` · ${range.leaked} through` : ''}`
      // A LAUNCHER THAT IS TRACKING BUT NOT SHOOTING looks exactly like a
      // broken one, so it says which: how many of the battery are holding a
      // lock, and how far the rest have got.
      + `${isMissile() ? `\n${battery.filter((b) => b.lock.locked).length}/${n} LOCKED`
        + ` · ${seekers.length} in the air`
        + `${battery[0] && !battery[0].lock.locked && battery[0].lock.meter > 0
          ? ` · seeking ${(battery[0].lock.meter * 100).toFixed(0)}%` : ''}` : ''}`
      // WHAT THE WALL COSTS, in the one number that explains a silent gun:
      // inside this radius the depression stop refuses everything on the
      // ground, and a wave simply walks under the barrels.
      + `${P.mount > 0 ? `\nwall ${P.mount} · depression ${P.elevMin}° · BLIND inside ${deadZone(P, gunHeight()).toFixed(1)} units`
        + `${deadZone(P, gunHeight()) >= P.ringMax ? ' — that is the whole range: give it more depression' : ''}` : ''}`;
    hud.style.color = f.fixed ? '#ffb45e' : '#9fdcff';
  }

  // --- the panel -----------------------------------------------------------
  const gui = new GUI({ title: 'SENTRY RANGE', container: root });
  const familyControl = gui.add(P, 'family', Object.fromEntries(SENTRY_FAMILIES.map(f => [f.label,f.id]))).onChange(() => loadSentry());
  gui.add(P, 'tier', SENTRY_TIERS).onChange(() => loadSentry());
  gui.add(P, 'mode', { Waves:'waves', Pop:'pop', Wall:'wall', Armour:'armour', Hull:'hull' }).name('targets').onChange(() => { resetRange(); frameHome(); });
  gui.add(P, 'live').name('range live');
  const surfaceFolder = gui.addFolder('surface target').close();
  surfaceFolder.add(P, 'surfaceDistance', 1, 60, 0.5).name('distance (m)').onChange(() => { resetRange(); frameHome(); });
  surfaceFolder.add(P, 'surfaceSize', 1, 8, 0.5).name('size (m)').onChange(resetRange);
  surfaceFolder.add(P, 'surfaceAngle', -80, 80, 1).name('incidence (deg)').onChange(resetRange);
  gui.add(P, 'timeScale', 0.1, 1, 0.05).name('time scale');
  gui.add(P, 'autoFire').name('weapons free');
  const gm = gui.addFolder('manual aim');
  gm.add(P, 'manual').name('drive by hand');
  gm.add(P, 'yaw', -180, 180, 1);
  gm.add(P, 'elev', -10, 65, 1).name('elevation');
  gm.close();
  const gb = gui.addFolder('battery');
  gb.add(P, 'count', 1, 6, 1).name('sentries').onChange(() => rebuildBattery());
  gb.add(P, 'spread', 0, 12, 0.5).name('apart').onChange(() => rebuildBattery());
  gb.add(P, 'mount', 0, 8, 0.25).name('wall height').onChange(() => { rebuildBattery(); layGround(); });
  gb.add(P, 'walls').name('draw the wall').onChange(() => rebuildBattery());

  gui.add(P, 'sound').name('sound');
  const gd = gui.addFolder('drive');
  gd.add(P, 'yawRate', 10, 720, 5).name('yaw deg/s');
  gd.add(P, 'pitchRate', 5, 360, 5).name('elev deg/s');
  const toleranceControl = gd.add(P, 'tolerance', 0.2, 15, 0.1).name('on target (deg)').onChange(value => {
    const config=draft.missiles[familyById(P.family).key];if(config)config.aimTolerance=value;
  });
  gd.add(P, 'elevMin', -80, 0, 1).name('depression stop').onChange(() => layGround());
  gd.add(P, 'elevMax', 5, 89, 1).name('elevation stop');
  const gg = gui.addFolder('gun');
  gg.add(P, 'cooldown', 0.05, 3, 0.05).name('rate of fire (s)');
  gg.add(P, 'recoilKick', 0, 0.6, 0.01).name('recoil');
  gg.add(P, 'recoilBack', 0.05, 2, 0.05).name('recovery');
  const gs = gui.addFolder('missiles / lock');
  const missileEdit={...draft.missiles.quiver};
  const missileControls=[];
  function syncMissileControls(){
    const config=draft.missiles[familyById(P.family).key];
    if(config){Object.assign(missileEdit,config);P.tolerance=config.aimTolerance;}
    else P.tolerance=SENTRY_TUNE.tolerance;
    toleranceControl.updateDisplay();
    for(const control of missileControls){control.disable(!config);control.updateDisplay();}
  }
  for(const [key,label,min,max,step] of [
    ['lockGate','lock gate (deg)',.5,30,.5],['lockTime','time to lock (s)',.1,6,.1],
    ['lockBreak','breaks at (deg)',1,90,1]]) {
    missileControls.push(gs.add(missileEdit,key,min,max,step).name(label).onChange(value=>{
      const config=draft.missiles[familyById(P.family).key];if(!config)return;
      config[key]=value;
      if(key==='lockGate')config.lockBreak=Math.max(config.lockBreak,value);
      if(key==='lockBreak')config.lockGate=Math.min(config.lockGate,value);
      syncMissileControls();
    }));
  }
  for(const [key,label] of [['minRange','min engage (m)'],['maxRange','max acquire (m)']]){
    missileControls.push(gs.add(missileEdit,key,0,100,.5).name(label).onChange(value=>{
      const config=draft.missiles[familyById(P.family).key];if(!config)return;
      const finite=Number.isFinite(value)?value:config[key];
      config[key]=key==='minRange'?Math.max(0,Math.min(config.maxRange,finite))
        :Math.min(100,Math.max(config.minRange,finite));
      syncMissileControls();
    }));
  }
  missileControls.push(gs.add(missileEdit,'profile',['swift','hook','heavy']).onChange(value=>{
    const config=draft.missiles[familyById(P.family).key];if(!config)return;
    config.profile=value;config.duration={swift:1.35,hook:2.7,heavy:4}[value];syncMissileControls();
  }));
  for(const [key,min,max,step] of [['duration',.5,6,.05],['length',.1,2,.01]]){
    missileControls.push(gs.add(missileEdit,key,min,max,step).onChange(value=>{
      const config=draft.missiles[familyById(P.family).key];if(config)config[key]=value;
    }));
  }
  missileControls.push(gs.add(missileEdit,'exhaust').onChange(value=>{
    const config=draft.missiles[familyById(P.family).key];if(config)config.exhaust=value;
  }));
  syncMissileControls();
  const effectsPanel = mountSentryEffects(gui, profile);
  const transfer=mountPresetPanel(root,{subject:()=>({kind:'sentry',key:familyById(P.family).key}),read:()=>draft,write:p=>{resetRange();draft=p;syncMissileControls();effectsPanel.refresh();},preview:'sentry'});
  gs.close();
  gg.add(P, 'muzzleVel', 4, 120, 1).name('muzzle velocity');
  gg.add(P, 'lead').name('lead moving targets');
  const gr = gui.addFolder('range');
  gr.add(P, 'waveSize', 1, 30, 1).name('first wave');
  gr.add(P, 'waveGrow', 0, 10, 1).name('grow by');
  gr.add(P, 'waveGap', 0, 15, 0.5).name('between waves');
  gr.add(P, 'walkSpeed', 0.1, 10, 0.1).name('walk units/s');
  gr.add(P, 'reachRadius', 0.2, 6, 0.1).name('through at');
  gr.add(P, 'targets', 1, 12, 1).name('targets up (pop)');
  gr.add(P, 'hp', 1, 10, 1).name('rounds to kill');
  gr.add(P, 'popMin', 0.2, 8, 0.1).name('up for min');
  gr.add(P, 'popMax', 0.3, 12, 0.1).name('up for max');
  gr.add(P, 'ringMin', 1, 20, 0.5).name('nearest').onChange(layGround);
  gr.add(P, 'ringMax', 2, 40, 0.5).name('farthest').onChange(layGround);
  gr.add(P, 'targetHi', 0, 12, 0.1).name('highest pop');
  gr.add(P, 'seed', 1, 9999, 1).onChange(resetRange);
  gr.add({ again: () => resetRange() }, 'again').name('reset the range');
  const gv = gui.addFolder('view');
  gv.add(P, 'wire').name('floor wire').onChange((v) => { if (grid) grid.visible = v; });
  gv.add(P, 'tracers').name('tracers');
  gv.add({ recentre: () => frameHome() }, 'recentre').name('re-centre the view');
  gv.close();
  const controlHelp=mountControlHelp(gui,{...SENTRY_HELP,...EFFECT_HELP,mode:'Choose moving waves, pop-up enemies, or a persistent wall, armour plate or hull section for impact tuning.',surfaceDistance:'Ground distance to the fixed target in metres. Missile engagement limits still apply.',surfaceSize:'Width of the fixed wall, armour plate or hull section in metres.',surfaceAngle:'Turn the target surface relative to the incoming shot. Impacts follow its actual outward normal.',timeScale:'Slow the entire preview together: target movement, aiming, projectiles and effects. Does not change saved weapon timing.'});

  wireDeepLink(root.querySelector('#sentry-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'sentry',
    params: P, defaults: P0, carry: location.search,
  }), { label: 'SENTRY', flash: (m) => { hud.textContent = m; flashUntil = performance.now() + 2200; } });
  let flashUntil = 0;

  // ON A PHONE THE PANEL STARTS SHUT. The lil-gui drawer takes the bottom
  // 46vh, and the frame centres on the whole canvas — so the turret, which is
  // the thing you came to look at, sat underneath it. The gear opens it. This
  // is the same failure the board's own diagnostics now name as "covered":
  // drawn, on glass, with a piece of chrome on top of it.
  if (matchMedia('(pointer: coarse)').matches
    || new URLSearchParams(location.search).get('mobile') === '1'
    || innerWidth <= 700) root.classList.add('panel-hidden');

  const ctr = root.querySelector('#sentry-center');
  if (ctr) ctr.addEventListener('click', () => frameHome());

  const gear = root.querySelector('#sentry-gear');
  if (gear) gear.addEventListener('click', () => root.classList.toggle('panel-hidden'));

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    postfx.setSize(w, h);
  }
  addEventListener('resize', resize);

  const radial=mountSentryRadial({select:id=>familyControl.setValue(id),current:()=>P.family,
    onOpen:()=>{controls.enabled=false;},onClose:()=>{controls.enabled=true;clock.getDelta();}});
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Sentry range. Click a tower to choose the battery.');
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let press=null;
  const pointerDown=e=>{if(e.button===0)press={id:e.pointerId,x:e.clientX,y:e.clientY};};
  const pointerMove=e=>{if(press && (e.pointerId!==press.id || Math.hypot(e.clientX-press.x,e.clientY-press.y)>6))press=null;};
  const pointerCancel=()=>{press=null;};
  const pointerUp=e=>{
    const start=press;press=null;
    if(!start || e.pointerId!==start.id || Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    if(raycaster.intersectObjects(battery.map(b=>b.obj),true).length)radial.show(e.clientX,e.clientY,renderer.domElement);
  };
  renderer.domElement.addEventListener('pointerdown',pointerDown);
  renderer.domElement.addEventListener('pointermove',pointerMove);
  renderer.domElement.addEventListener('pointerup',pointerUp);
  renderer.domElement.addEventListener('pointercancel',pointerCancel);
  layGround();
  loadSentry();

  const clock = new THREE.Clock();
  let hudT = 0, animationFrame = 0;
  function animate() {
    if(disposed)return;
    animationFrame=requestAnimationFrame(animate);
    if (!active || disposed) return;
    const dt = Math.min(0.05, clock.getDelta()) * P.timeScale;
    if(radial.open)return;
    if (P.live) stepRangeFrame(dt);
    if (root.dataset.modelReady === 'true') aimFrame(dt);
    stepTracers(dt);
    stepBeams(dt);
    stepSeekers(dt);
    for (let i = fx.length - 1; i >= 0; i--) {
      if (!fx[i].tick(dt)) { scene.remove(fx[i].obj); disposeObj(fx[i].obj); fx.splice(i, 1); }
    }
    for (const t of tracers) t.mesh.visible = P.tracers;
    controls.update();
    postfx.render();
    hudT += dt;
    if (hudT > 0.2 && performance.now() >= flashUntil) {
      hudT = 0; if(root.dataset.modelReady==='true')hudLine();
      if(missilePool){const c=draft.missiles[familyById(P.family).key],stats=missilePool.stats();
        missileStatus.textContent=c ? `DART · ${c.profile} ${c.duration.toFixed(2)} s · ${c.length.toFixed(2)} m · aim ${familyById(P.family).fixed?'vertical':`${MISSILE_LAUNCH_ELEVATION}°`}\nengage ${c.minRange.toFixed(1)}–${(c.maxRange*effectiveStats(TOWER_BY_KEY[familyById(P.family).key],P.tier-1).range/TOWER_BY_KEY[familyById(P.family).key].range).toFixed(1)} m (tier ${P.tier})\n${stats.triangles} triangles · ${stats.batches} batches / rocket · ${stats.active}/${stats.capacity} active\nClick a tower to change the whole battery. Lab preview.` : 'Click a tower to change the whole battery.';}
    }
  }
  animate();

  // ?sentryprobe=1 — the range, in numbers. A turret that tracks is a claim
  // about angles over time, and a screenshot of a barrel cannot settle it:
  // this reports the error falling, the rounds leaving, and the targets going
  // down, for whichever family is loaded.
  if (q.get('sentryprobe') === '1') {
    let n = 0;
    const tick = setInterval(() => {
      if (++n > 8) { clearInterval(tick); return; }
      console.log(`SENTRYPROBE t+${n}s ${battery.length}x${P.family} t${P.tier}`
        + ` muzzles=${battery[0] ? battery[0].muzzles.length : 0} mount=${P.mount} mode=${P.mode}`
        + ` wave=${range.wave} through=${range.leaked} cleared=${range.cleared}`
        + ` blind=${deadZone(P, gunHeight()).toFixed(1)}`
        + ` unreachable=${battery.length && range.targets.length
          ? range.targets.filter((t2) => t2.up && !inEnvelope(aimAt(relTo(battery[0].st, t2.pos)), P)).length : 0}`
        + ` yaw=${st.yaw.toFixed(1)}/${st.wantYaw.toFixed(1)}`
        + ` elev=${st.elev.toFixed(1)}/${st.wantElev.toFixed(1)}`
        + ` err=${aimError(st).toFixed(2)} target=${st.target}`
        + ` up=${range.targets.length} fired=${st.rounds} hit=${st.hits} killed=${st.kills}`
        + ` locked=${battery.filter((b) => b.lock.locked).length} seekers=${seekers.length}`
        + ` beams=${beams.length}`
        + ` tracers=${tracers.length}`);
    }, 1000);
  }

  // ?beamprobe=1 — IS THE BEAM ACTUALLY DRAWN. This is the instrument that
  // settled "createBeam renders nothing in this scene", and it stays because
  // the failure it diagnoses is invisible to a screenshot in both directions:
  // a beam one pixel wide and a beam that never reaches the GPU look the same.
  //
  // onBeforeRender fires once per mesh per render pass, so `draws` splits the
  // two halves of the question. Zero means three never submitted it — culled,
  // hidden, or not in the graph. Non-zero means it was submitted and the
  // pixels are the problem, which is what it was: a ribbon built at the
  // board's cell widths is under a pixel across in a yard viewed from fifty
  // cells out. `px` is the answer in the only unit that matters — the beam's
  // width projected onto the canvas.
  if (q.get('beamprobe') === '1') {
    const a = new THREE.Vector3(0, 1.2, 0);
    const b = new THREE.Vector3(6, 1.2, 0);
    const ref = makeBeamShot(a, b, 0x4dff86, 'lance', { glowWidth: RANGE_BEAM_W });
    let draws = 0;
    ref.traverse((o) => { if (o.isMesh) o.onBeforeRender = () => { draws++; }; });
    scene.add(ref);
    let n = 0;
    const iv = setInterval(() => {
      ref.userData.update(clock.getElapsedTime());
      const m = ref.children[0];
      const gw = m.material.uniforms.uGlowWidth.value;
      // world width -> canvas pixels, at the reference beam's own distance
      const dist = camera.position.distanceTo(a.clone().lerp(b, 0.5));
      const px = (gw * 2 / (2 * dist * Math.tan(camera.fov * Math.PI / 360)))
        * renderer.getSize(new THREE.Vector2()).y;
      console.log(`BEAMPROBE t+${++n}s draws=${draws} live=${beams.length}`
        + ` links=${ref.children.length} visible=${m.visible} inScene=${!!ref.parent}`
        + ` glowW=${gw.toFixed(4)} px=${px.toFixed(1)}`
        + ` alpha=${m.material.uniforms.uAlpha.value.toFixed(2)}`
        + ` gl=${renderer.getContext().getError()}`);
      draws = 0;
      if (n >= 6) { clearInterval(iv); scene.remove(ref); disposeObj(ref); }
    }, 1000);
  }

  if(q.get('acceptance')==='1')window.__stalheartSentryTest={
    state:()=>({mode:P.mode,effects:clone(effectStats),weapons:clone(draft.weapons),targets:range.targets.map(t=>({id:t.id,pos:t.pos})),family:familyById(P.family).key,battery:battery.map(b=>familyById(b.st.family).key),
      missiles:clone(draft.missiles),tracking:battery.map(b=>({target:b.st.target,lockId:b.lock.id,locked:b.lock.locked,meter:b.lock.meter})),pool:missilePool?.stats(),...missileStats,
      live:seekers.map(m=>({u:m.t/m.config.duration,position:m.mesh.position.toArray(),ignition:m.mesh.getObjectByName('EXHAUST_FX').visible}))}),
    towerPoint:()=>{const b=battery[0];if(!b)return null;const p=new THREE.Box3().setFromObject(b.obj).getCenter(new THREE.Vector3()).project(camera),r=renderer.domElement.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};},
    surfacePoint:()=>{const t=range.targets[0];if(!t)return null;const p=new THREE.Vector3().fromArray(t.pos).project(camera),r=renderer.domElement.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2,z:p.z};},
    reset:()=>resetRange(),
    hold:()=>{P.autoFire=false;},
  };
  return {
    dispose(){
      if(disposed)return;disposed=true;active=false;modelSerial++;cancelAnimationFrame(animationFrame);
      controlHelp.dispose();radial.dispose();transfer.dispose();resetRange();missilePool?.dispose();
      renderer.domElement.removeEventListener('pointerdown',pointerDown);
      renderer.domElement.removeEventListener('pointermove',pointerMove);
      renderer.domElement.removeEventListener('pointerup',pointerUp);
      renderer.domElement.removeEventListener('pointercancel',pointerCancel);
      removeEventListener('resize',resize);controls.dispose();sfx.dispose();gui.destroy();
    },
    setActive(on) { active = on; if (on) { resize(); clock.getDelta(); } },
  };
}
