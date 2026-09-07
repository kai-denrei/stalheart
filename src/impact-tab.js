// impact-tab.js — THE SHOOTING LAB. One weapon, end to end.
//
// It began as an impact lab and grew into the whole shot, which is what the
// operator asked for: "we agreed on ONE LAB to work on both the type/shapes/FX
// of each sentry's weapons, and the impact." So it now covers all three parts
// a weapon has, for any of the sixteen families:
//
//   MUZZLE   what leaves the barrel, and the machine kicking as it does
//   FLIGHT   the shot itself — a lance is light, a throw is matter, a round
//            is a tracer — read off the same `weaponKind` the board and the
//            sentry range use, so a weapon cannot be one thing here and
//            another there
//   IMPACT   seven families of spark, flash, ring, scorch, debris, splash
//            and ember, against a wall you can angle and re-material
//
// ...on flat ground or on the BOARD'S OWN CURVATURE (12.5 = 1/cellSide),
// because a lance fired seven cells across a sphere is fired over a horizon
// and a flat lab quietly answers a different question.
//
// The file is still called impact-tab and the route is still #impact: the
// deep links people already have keep working, and a rename is not worth
// breaking them over.
//
// (The BEAM lab is not folded in and should not be: it tunes the TANK's
// secondary — ranks, burn-through, sweep and toe-in — which is a weapon this
// lab does not model and a set of questions this stage cannot ask.)
//
// Operator: "augment our laser lab to research spark/flash particles at
// impact — an impact tab with various effects, and a toggleable wall to see
// the effect, for sentries and tank."
//
// The board has had exactly ONE impact effect since it was built: a puff of
// tinted dots, reused for a run-over, a shell, a laser tick and a portal
// collapse. That is why hits feel weightless, and it is not a tuning problem —
// so this lab exists to research the effects themselves (src/impactfx.js) and
// hand the game a recipe per weapon.
//
// THE WALL IS THE INSTRUMENT. An impact in open air tells you almost nothing:
// sparks only read when they spray AWAY from a surface, a shockwave ring only
// reads when it lies flat ON one, and a scorch has nowhere to be without it.
// So the wall angles, and the incidence angle is the single control that
// changes the picture most.
//
// The game's own light rig and bloom chain, for the same reason the beam lab
// uses them: an effect tuned under gentle studio light is wrong the moment it
// fires on the board.
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import GUI from '../vendor/lil-gui.esm.js';
import { makeBloom } from './postfx.js';
import { bakeGalaxyCube } from './galaxybake.js';
import { SKY_PRESET } from './galaxyseed.js';
import {
  IMPACT_TUNE, IMPACT_KNOBS, IMPACT_FAMILIES, IMPACT_RECIPES,
  makeImpactParams, clampImpactParams, formatImpactTune,
  makeImpactBurst, orientImpact,
} from './impactfx.js';
import { buildCreature, preloadMkcx } from './units.js';
import { sentryUrl, SENTRY_FAMILIES } from './sentry.js';
import { loadGlb } from './glbmodels.js';
import { TOWERS, TOWER_BY_KEY } from './towers.js';
import {
  SENTRY_FX, fxFor, tuneFor, formatSentryFx, formatAllSentryFx,
  resolveImpactColors, weaponColor,
} from './sentryfx.js';
import { makeTracerMesh, makeLightningMesh, makeSeekerMesh, aimSeeker, arcLift,
  LANCE_LOOK, THROW_LOOK } from './shotfx.js';
import { createBeam } from './beamfx.js';
import { deepLink, wireDeepLink } from './deeplink.js';

// The surfaces a hit can land on. Each is a real answer to "what did I just
// shoot", and the SPARK COLOUR is the biggest part of that answer — a chip
// off painted steel is not a chip off rock, and the eye knows it before it
// knows anything else about the hit.
const SURFACES = {
  armour: { label: 'armour plate', color: 0x6e777e, rough: 0.45, metal: 0.85,
    spark: 0xffd08a, chunk: 0x8a8f94, scorch: 0x0e0b09 },
  rock:   { label: 'rock',         color: 0x54504a, rough: 0.95, metal: 0.0,
    spark: 0xffb066, chunk: 0x6b655c, scorch: 0x14100c },
  hull:   { label: 'hull metal',   color: 0x3f4a52, rough: 0.35, metal: 0.95,
    spark: 0xcfe8ff, chunk: 0x5b6a75, scorch: 0x0a0d10 },
};

export function initImpactTab(root) {
  let active = false;
  const q = new URLSearchParams(location.search);
  const container = root.querySelector('#impact-app');
  const hud = root.querySelector('#impact-hud');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);
  camera.position.set(7.6, 2.9, 4.6);

  // THE GAME'S RIG, not an inspection rig: an effect tuned under gentle
  // studio light is wrong the moment it fires on the board.
  scene.add(new THREE.HemisphereLight(0xc8cfe0, 0x555060, 0.55));
  const sun = new THREE.DirectionalLight(0xffe8c8, 0.25);
  sun.position.set(4, 6, 3);
  scene.add(sun);
  // ...and the board's SKY as an environment. A metal plate with nothing to
  // reflect is black under this rig whatever its albedo, and a black plate
  // makes every effect look good — which is exactly the wrong instrument.
  {
    const sky = bakeGalaxyCube(renderer, { ...SKY_PRESET, seed: 4414, face: 512, galaxies: 2 });
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromCubemap(sky.texture).texture;
    scene.environmentIntensity = 0.55;
  }

  const postfx = makeBloom(renderer, scene, camera, {});
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.85, 2.0);

  // THE SUBJECT. The lab's job is now: pick a sentry, tune ITS muzzle and
  // ITS impact, export the result as the default. So the panel edits a
  // WORKING COPY of that family's profile rather than a free-floating tune —
  // otherwise "export" has nothing to export and the operator is transcribing
  // numbers by hand, which is the friction this is meant to remove.
  const FX_KEYS = Object.keys(SENTRY_FX);
  let subject = FX_KEYS.includes(q.get('sentry')) ? q.get('sentry') : 'lancer';
  // deep copies: editing the live table would make "revert" impossible and
  // would silently change the running game from a lab panel
  const work = {};
  for (const k of FX_KEYS) {
    const p0 = SENTRY_FX[k];
    work[k] = {
      shot: { ...p0.shot },
      muzzle: { ...p0.muzzle, colors: { ...p0.muzzle.colors }, tune: { ...p0.muzzle.tune } },
      impact: { ...p0.impact, colors: { ...p0.impact.colors }, tune: { ...p0.impact.tune } },
    };
  }
  const prof = () => work[subject];
  const slotOf = () => (P.slot === 'muzzle' ? prof().muzzle : prof().impact);

  const P = {
    slot: 'impact',             // which half of the profile the knobs edit
    recipe: 'shell',            // shell | laser | plasma | light | custom
    surface: 'armour',
    wall: true,
    wallAngle: 25,              // degrees off square-on. 0 = the camera's enemy
    wallSize: 3.0,
    auto: true, every: 1.1,     // fire on a clock, so a tweak is seen at once
    slow: 1.0,                  // time scale: an impact is 400ms and you will miss it
    trail: true,                // leave scorches standing
    showMuzzle: true,           // fire the muzzle alongside the impact
    showShot: true,             // ...and the flight between them
    // CURVATURE. The board is a SPHERE with cellSide 0.08, so its radius is
    // 12.5 cells — and a lance fired seven cells across it is fired over a
    // horizon, not along a floor. A flat lab quietly answers a different
    // question from the one the board asks, which is exactly how the beam
    // lab came to need its own curved stage. 0 is flat; 12.5 is the game.
    curveR: 0,                  // ground radius in metres; 0 = flat
    size: 1.0,                  // ONE number scales the whole hit
    ...makeImpactParams(),
  };
  // per-family switches for the CUSTOM recipe, so a single effect can be
  // looked at with nothing else on top of it — which is the only way to tune
  // one, since seven at once is a single bright smear
  for (const f of IMPACT_FAMILIES) P[`use_${f}`] = IMPACT_RECIPES.shell.includes(f);

  const P0 = { ...P };
  for (const [k, v] of q.entries()) {
    if (!(k in P)) continue;
    if (typeof P[k] === 'number') { const n = parseFloat(v); if (Number.isFinite(n)) P[k] = n; }
    else if (typeof P[k] === 'boolean') P[k] = v !== '0';
    else P[k] = v;
  }
  clampImpactParams(P, P);   // the URL half of the tune, back inside its ranges

  // --- the wall -------------------------------------------------------------
  let wall = null;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6e777e, roughness: 0.45, metalness: 0.85 });
  function buildWall() {
    if (wall) { scene.remove(wall); wall.geometry.dispose(); }
    wall = new THREE.Mesh(new THREE.PlaneGeometry(P.wallSize, P.wallSize), wallMat);
    wall.receiveShadow = true;
    scene.add(wall);
    placeWall();
  }
  function placeWall() {
    if (!wall) return;
    wall.visible = P.wall;
    // it stands upright and TURNS about its own vertical: the angle knob is
    // the angle of incidence, which is the control that changes the picture
    // most and the reason the wall moves at all
    wall.position.set(0, P.wallSize * 0.42, 0);
    wall.rotation.set(0, THREE.MathUtils.degToRad(P.wallAngle), 0);
  }
  function surfaceDef() { return SURFACES[P.surface] || SURFACES.armour; }
  function paintWall() {
    const s = surfaceDef();
    wallMat.color.setHex(s.color);
    wallMat.roughness = s.rough;
    wallMat.metalness = s.metal;
    wallMat.needsUpdate = true;
  }
  buildWall(); paintWall();

  // the floor, so the sparks that skid off the wall have somewhere to land
  // THE GROUND, flat or curved. Curved is a sphere the stage sits on TOP of,
  // so y=0 stays the ground under the gun and everything already placed there
  // keeps its footing — the curvature bends the ground AWAY from the shot
  // rather than moving the shot.
  let floor = null, grid = null;
  function layGround() {
    for (const o of [floor, grid]) {
      if (!o) continue;
      scene.remove(o);
      if (o.geometry) o.geometry.dispose();
    }
    floor = null; grid = null;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d1116, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    if (P.curveR > 0.5) {
      const R = P.curveR;
      floor = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), mat);
      floor.position.set(0, -R, 0);        // its top is the origin
      grid = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.0008, 48, 32),
        new THREE.MeshBasicMaterial({ color: 0x1d4a55, wireframe: true,
          transparent: true, opacity: 0.35 }));
      grid.position.copy(floor.position);
    } else {
      floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mat);
      floor.rotation.x = -Math.PI / 2;
      grid = new THREE.GridHelper(14, 28, 0x1d4a55, 0x12303a);
      grid.position.y = 0.002;
    }
    scene.add(floor);
    scene.add(grid);
  }
  layGround();

  // --- who is shooting ------------------------------------------------------
  // The lab carries the actual shooters rather than a marker, because the
  // MUZZLE HEIGHT and the stand-off decide the incidence angle as much as the
  // wall's own rotation does — a sentry shoots down at a wall the tank shoots
  // level at, and the sparks come off differently.
  const shooters = { tank: null, sentry: null };
  let rig = null;                 // the selected sentry's articulation
  // the barrel tips, in world space. They track the shooters' own stand-off:
  // a muzzle flash that fires where the gun is not is worse than none.
  // THE GUN IS BEHIND THE WALL'S CENTRE, not beside it. It used to stand at
  // x = -1.75 while the wall sat at the origin, so every shot crossed the
  // stage diagonally and clipped the plate's edge from 2.3 units away — the
  // operator's "not aligned in front of the sentries, and too close". The
  // shot now runs straight down -Z from the muzzle to the middle of the
  // plate, and the CAMERA is what moves off-axis, so the whole flight is
  // side-on and a beam is something you can see the length of.
  const STANDOFF = 4.6;
  const MUZZLE = { tank: [0, 0.55, STANDOFF - 0.5], sentry: [0, 1.15, STANDOFF - 0.5] };
  // THE REAL BARREL, when the model has one. The Workshop's contract puts a
  // MUZZLE_nn empty at every aperture, and the board's rule is that a shot
  // leaves one of those — this lab extracted them and then fired from a
  // HARDCODED height anyway, so the Lancer's beam left a point above and
  // behind its own cannon. The constants stay as the fallback for the tank
  // and for any model without the empties.
  const _mz = new THREE.Vector3();
  function muzzlePoint() {
    if (shooters.sentry && shooters.sentry.visible && rig && rig.muzzles.length) {
      // world position, read off the transform rather than reconstructed —
      // it moves with the yaw, the pitch and the recoil, which is the whole
      // point of aiming the model at all
      shooters.sentry.updateMatrixWorld(true);
      rig.muzzles[0].getWorldPosition(_mz);
      return [_mz.x, _mz.y, _mz.z];
    }
    return shooters.sentry ? MUZZLE.sentry : MUZZLE.tank;
  }
  preloadMkcx('mkcx2').then(() => {
    const t = buildCreature('mkcx2', {});
    if (!t) return;
    t.scale.setScalar(0.9);
    t.position.set(0, 0, STANDOFF);
    t.rotation.y = Math.PI;      // facing the wall
    shooters.tank = t;
    scene.add(t);
    syncShooter();
  }).catch(() => {});
  // THE SELECTED SENTRY'S OWN MODEL, loaded through the shared cache — the
  // same door the towers use, so the lab looks at what the game ships. Not
  // every FX key has a model (roster 1 has none at all), so a missing one is
  // a normal outcome and leaves the tank standing in.
  const MODEL_FOR = Object.fromEntries(SENTRY_FAMILIES.map((f) => [f.id, f.id]));
  function modelIdFor(key) {
    const def = TOWER_BY_KEY[key] || TOWERS.find((t) => t.key === key);
    if (def && def.model && MODEL_FOR[def.model]) return def.model;
    return MODEL_FOR[key] || null;
  }
  function loadSentryModel() {
    const id = modelIdFor(subject);
    if (shooters.sentry) { scene.remove(shooters.sentry); shooters.sentry = null; }
    if (!id) { syncShooter(); return; }
    loadGlb(sentryUrl(id, 2)).then((proto) => {
      if (!proto || modelIdFor(subject) !== id) return;   // the panel moved on
      const o = proto.clone(true);
      const b = new THREE.Box3().setFromObject(o);
      const sz = b.getSize(new THREE.Vector3());
      o.scale.setScalar(1.3 / Math.max(sz.y, 1e-6));
      o.position.set(0, 0, STANDOFF);
      o.rotation.y = Math.PI;
      // THE MACHINE MUST MOVE. The lab stood a dead model beside its own
      // effects, which is half a weapon: the Rotor's barrels spinning up and
      // the RECOIL kicking are as much "the FX of this weapon" as the muzzle
      // flash is, and they are the part that says which gun fired. Same
      // articulation contract the Workshop authors and the sentry range
      // drives — ROOT → BASE → YAW → PITCH → RECOIL, plus ROTOR and MUZZLE_nn.
      rig = {
        yaw: o.getObjectByName('YAW'),
        pitch: o.getObjectByName('PITCH'),
        recoil: o.getObjectByName('RECOIL'),
        rotor: o.getObjectByName('ROTOR'),
        muzzles: [],
        spin: 0, spinRate: 0, kick: 0,
      };
      o.traverse((n2) => { if (/^MUZZLE_\d+$/.test(n2.name || '')) rig.muzzles.push(n2); });
      rig.muzzles.sort((a2, b2) => a2.name.localeCompare(b2.name));
      shooters.sentry = o;
      scene.add(o);
      syncShooter();
      if (probeOn) {
        console.log(`IMPACTPROBE rig ${subject} yaw=${!!rig.yaw} pitch=${!!rig.pitch}`
          + ` recoil=${!!rig.recoil} rotor=${!!rig.rotor} muzzles=${rig.muzzles.length}`);
      }
      if (probeOn) console.log(`IMPACTPROBE model ${subject} -> ${id}_t2.glb`);
    }).catch(() => {});
  }
  loadSentryModel();
  // THE SHOOTER IS THE SUBJECT. There used to be a second dropdown deciding
  // which model stood on the stage, defaulting to the tank — so picking a
  // Lancer to tune left a TANK firing its effects, and on ?roster=2#impact
  // the operator saw only the tank however many sentries were selected.
  // Two controls for one idea, and the wrong one won by default.
  //
  // Now the selected family's own model stands, and the tank is a FALLBACK
  // for the roster-1 towers, which have no model at all — visible rather
  // than an empty stage, and honest about which it is because the HUD says.
  function syncShooter() {
    const haveSentry = !!shooters.sentry;
    if (shooters.sentry) shooters.sentry.visible = true;
    if (shooters.tank) shooters.tank.visible = !haveSentry;
  }
  const shooterLabel = () => (shooters.sentry ? subject : `tank (no model for ${subject})`);

  // --- THE SHOT ------------------------------------------------------------
  //
  // Operator: "currently choosing plasma or laser does not display a long
  // plasma or laser." It did not, because this lab only ever drew the two
  // ENDS of a weapon — the muzzle and the impact — and nothing in between. A
  // lab that covers a weapon's FX has to show the weapon: the flight is where
  // a lance and a thrower differ most, and it was the missing third of the
  // three the tab is named for.
  //
  // Drawn with the same idiom as the sentry range, deliberately: a line for
  // light and a spray of dots for matter. Same weapon, same look, two tabs.
  const flights = [];            // { obj, left, dur } — shots in the air
  // WHAT COLOUR IS THE SHOT. Down the profile's own answers in the order they
  // are authoritative: an explicit beamColor first, then whichever impact
  // family carries this weapon's identity. The Plasma has no beamColor and no
  // spark — it is splash and ember — so a naive `beamColor || spark ||
  // default` threw a WARM ORANGE spray out of a cyan thrower.
  // THE WEAPON'S OWN COLOUR: what it throws if that differs from its identity,
  // else the identity colour towers.js keeps (range ring, shop icon, tint).
  function weaponHex() {
    const def = TOWER_BY_KEY[subject] || TOWERS.find((t) => t.key === subject);
    return weaponColor(subject, (def && def.color) || 0xffd08a);
  }
  function shotColor() {
    const p = prof();
    const c = (p.impact && p.impact.colors) || {};
    return (p.shot && p.shot.beamColor) || c.splash || c.ember || c.flash || weaponHex();
  }

  function spawnShot(from, to, kind, colorHex) {
    // EVERY SHAPE HERE IS THE BOARD'S OWN, out of shotfx.js. The lab used to
    // reimplement each one, which is why the Mortar flew STRAIGHT while the
    // game arcs it, the Relay drew nothing at all, and the Plasma looked like
    // a different weapon. Those were never tuning problems — a lab whose
    // baseline is not the game is, in the operator's words, useless.
    const grp = new THREE.Group();
    const sh = prof().shot || {};
    const dist = from.distanceTo(to);
    if (kind === 'field') {
      // THE RELAY DOES NOT FIRE — nothing leaves it — but it is not idle
      // either, and a sentry that draws nothing reads as broken rather than
      // as a field weapon. This is the board's own slow-field bolt: three of
      // them, as the board throws three at its nearest targets.
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 0.22;
        const b2 = to.clone().add(new THREE.Vector3(off, 0, 0));
        grp.add(makeLightningMesh([from.x, from.y, from.z], [b2.x, b2.y, b2.z],
          colorHex, { t: performance.now() * 0.001 + i, up: [0, 1, 0] }));
      }
    } else if (kind === 'lance' || kind === 'throw') {
      // the board's LANCE_LOOK / THROW_LOOK, through the board's own beam
      const look = kind === 'lance' ? LANCE_LOOK : THROW_LOOK;
      const c = new THREE.Color(colorHex);
      const bm = createBeam(from.clone(), to.clone(),
        { ...look, coreColor: c, glowColor: c });
      if (bm && bm.mesh) { grp.add(bm.mesh); grp.userData.beam = bm; }
    } else if (kind === 'seeker') {
      // A CONE POINTED ALONG ITS VELOCITY, which is what the board flies and
      // what the Quiver and the A6 both throw — a little javelin, not a dot.
      const m = makeSeekerMesh(colorHex, Math.max(0.12, dist * 0.06));
      m.position.copy(from);
      aimSeeker(m, [to.x - from.x, to.y - from.y, to.z - from.z]);
      grp.add(m);
      grp.userData.fly = { m, from: from.clone(), to: to.clone(), arc: dist * 0.10 };
    } else {
      // ROUND and LOB are the same tracer; only the PATH differs, and a lob's
      // path is the reason it exists. The board takes the ground bearing and
      // adds the parabola to the DRAWING only, so the picture cannot change
      // the accuracy — the lab does the same.
      const m = makeTracerMesh(colorHex, sh.projPx ?? 5, sh.trail ?? 0);
      grp.add(m);
      grp.userData.fly = {
        m, from: from.clone(), to: to.clone(),
        arc: kind === 'lob' ? dist * 0.34 : 0,
        trail: (sh.trail ?? 0) + 1,
      };
    }
    if (!grp.children.length) return;
    scene.add(grp);
    // a lance is ONE long burst; a throw is a fast spit; a flying round lives
    // as long as its flight; a field bolt is a flicker
    const life = kind === 'lance' ? 0.6
      : kind === 'throw' ? 0.18
        : kind === 'field' ? 0.32
          : Math.max(0.25, dist / Math.max(1, (sh.projSpeed ?? 16) * 0.35));
    flights.push({ obj: grp, left: life, dur: life, age: 0 });
  }

  function stepShots(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const e = flights[i];
      e.left -= dt;
      e.age += dt;
      const u = Math.max(0, Math.min(1, 1 - e.left / e.dur));   // 0..1 along the flight
      const f = e.obj.userData.fly;
      if (f) {
        // ...and the ARC is added to the drawn path, never to the aim
        const p = f.from.clone().lerp(f.to, u);
        p.y += arcLift(u, f.arc);
        // the trail drags BEHIND the head along the same curve, so a lobbed
        // shell's trail follows its arc instead of cutting the chord
        const g = f.m.geometry;
        if (g && g.attributes.position && f.trail) {
          const pos = g.attributes.position.array;
          for (let k = 0; k < f.trail; k++) {
            const uk = Math.max(0, u - k * 0.035);
            const pk = f.from.clone().lerp(f.to, uk);
            pk.y += arcLift(uk, f.arc);
            pos[k * 3] = pk.x; pos[k * 3 + 1] = pk.y; pos[k * 3 + 2] = pk.z;
          }
          g.attributes.position.needsUpdate = true;
        } else {
          f.m.position.copy(p);
        }
        if (f.m.isMesh) {
          const ahead = f.from.clone().lerp(f.to, Math.min(1, u + 0.05));
          ahead.y += arcLift(Math.min(1, u + 0.05), f.arc);
          aimSeeker(f.m, [ahead.x - p.x, ahead.y - p.y, ahead.z - p.z]);
          f.m.position.copy(p);
        }
      }
      const bm = e.obj.userData.beam;
      if (bm) { if (bm.update) bm.update(e.age); if (bm.setAlpha) bm.setAlpha(Math.max(0, e.left / e.dur)); }
      const fade = Math.max(0, e.left / e.dur);
      e.obj.traverse((o) => {
        if (o.material && !bm) o.material.opacity = fade;
      });
      if (e.left <= 0) {
        scene.remove(e.obj);
        e.obj.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        flights.splice(i, 1);
      }
    }
  }

  // --- firing ---------------------------------------------------------------
  const live = [];        // every burst currently ticking
  const standing = [];    // scorches kept when `trail` is on
  let shots = 0, lastFamilies = [];

  // WHERE THE SHOT LANDS. A ray from the muzzle to the wall's plane, so the
  // contact point and the NORMAL are both the wall's own — derived from the
  // transform, never re-derived from the angle knob with a second sign
  // convention, which is the recurring bug this project keeps paying for.
  function contact() {
    const m = muzzlePoint();
    const from = new THREE.Vector3(m[0], m[1], m[2]);
    if (!wall || !P.wall) {
      // no wall: fire into open air at the stand-off distance, normal facing
      // the camera. Worth having — it shows exactly how little an impact
      // reads without a surface, which is the lab's first lesson.
      return { point: [0, m[1], 0], normal: [0, 0, 1] };
    }
    wall.updateMatrixWorld(true);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(wall.quaternion).normalize();
    const p0 = wall.position.clone();
    // A GUN AIMS. Firing straight down -Z from a shooter parked off to one
    // side put every hit on the wall's edge and made the incidence knob a
    // half-truth — the angle between the shot and the surface is what the
    // sparks answer to, and that needs a real line of fire. So: from the
    // muzzle to the aim point, which is the plate's middle at muzzle height.
    const aim = new THREE.Vector3(0, Math.min(P.wallSize * 0.55, Math.max(0.35, from.y)), 0);
    const dir = aim.sub(from).normalize();
    const denom = n.dot(dir);
    let hit;
    if (Math.abs(denom) < 1e-6) hit = p0.clone();
    else {
      const t = n.dot(p0.clone().sub(from)) / denom;
      hit = from.clone().add(dir.clone().multiplyScalar(t));
    }
    // keep it on the plate rather than off its edge at a steep angle
    const half = P.wallSize * 0.45;
    hit.y = Math.min(P.wallSize - 0.2, Math.max(0.2, hit.y));
    hit.x = Math.min(half, Math.max(-half, hit.x));
    // the normal must face the SHOOTER, or every effect fires into the wall
    if (n.dot(from.clone().sub(hit)) < 0) n.negate();
    return { point: [hit.x, hit.y, hit.z], normal: [n.x, n.y, n.z] };
  }

  function currentRecipe() {
    const fx = slotOf();
    if (P.recipe === 'profile') {
      return Array.isArray(fx.recipe) ? fx.recipe : (IMPACT_RECIPES[fx.recipe] || []);
    }
    if (P.recipe !== 'custom') return IMPACT_RECIPES[P.recipe] || IMPACT_RECIPES.light;
    return IMPACT_FAMILIES.filter((f) => P[`use_${f}`]);
  }

  // PULL and PUSH between the panel and the working profile. The knobs are a
  // flat list (lil-gui wants one object) while a profile keeps its deltas in
  // a nested `tune`, so these two functions are the seam — and they are the
  // reason the export can be a copy button instead of a transcription.
  // WHAT THE URL ASKED FOR SURVIVES THE FIRST PULL. pullFromProfile runs at
  // init, AFTER the query is parsed, and it rebuilds every use_* flag from
  // the family's own recipe — so `?use_spark=0` was read, stored, and then
  // silently overwritten before the first frame. A URL parameter that is
  // accepted and ignored is worse than one that is rejected.
  const urlFamilies = IMPACT_FAMILIES.filter((f) => q.has(`use_${f}`));
  let firstPull = true;
  function pullFromProfile() {
    const fx = slotOf();
    // the panel shows the FOLDED tune: base + this family's deltas, so a knob
    // that the family never overrode still shows the value it actually fires
    // with rather than a blank
    Object.assign(P, tuneFor(fx));
    P.size = fx.size;
    for (const f of IMPACT_FAMILIES) {
      if (firstPull && urlFamilies.includes(f)) continue;   // the URL wins, once
      P[`use_${f}`] = currentRecipeNames(fx).includes(f);
    }
    firstPull = false;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }
  function currentRecipeNames(fx) {
    return Array.isArray(fx.recipe) ? fx.recipe : (IMPACT_RECIPES[fx.recipe] || []);
  }
  // ONLY WHAT DIFFERS is written back. A profile that records all 27 knobs is
  // a profile that stops tracking IMPACT_TUNE — change a base value later and
  // every family silently keeps the old one, which is the same drift the
  // towers.js split was done to avoid.
  function pushToProfile() {
    const fx = slotOf();
    const tune = {};
    for (const k of IMPACT_KNOBS) {
      if (Math.abs(P[k.key] - IMPACT_TUNE[k.key]) > 1e-9) tune[k.key] = P[k.key];
    }
    fx.tune = tune;
    fx.size = P.size;
    if (P.recipe === 'custom') fx.recipe = IMPACT_FAMILIES.filter((f) => P[`use_${f}`]);
    else if (P.recipe !== 'profile') fx.recipe = P.recipe;
  }

  function fire() {
    const s = surfaceDef();
    const { point, normal } = contact();
    pushToProfile();                 // the panel IS the profile; keep them one thing
    const fx = slotOf();
    const names = currentRecipe();
    // the SURFACE decides what a chip and a scorch look like; the WEAPON
    // decides everything else. Both matter and neither owns the other, so the
    // surface fills in only what the profile did not name.
    // THE SURFACE OWNS MATTER, THE WEAPON OWNS ENERGY, and anything the
    // profile states beats both. Before this, a splash with no named colour
    // fell through to impactfx's own green fallback — so twelve of the sixteen
    // weapons threw a LASER'S green splash whatever they were.
    const colors = resolveImpactColors(fx, {
      surface: { spark: s.spark, debris: s.chunk, scorch: s.scorch },
      weapon: weaponHex(),
    });
    lastFamilies = names;
    // ...and NOTHING is a legitimate answer. Every family off means no impact
    // at all, which is what the operator asked for by unticking them; adding
    // an empty group and letting it die on the next tick merely looked right.
    if (!names.length) {
      if (probeOn) console.log(`IMPACTPROBE shot=${shots + 1} sentry=${subject} EMPTY recipe — no impact drawn`);
    } else {
      const burst = makeImpactBurst(names, tuneFor(fx), colors, ++shots, fx.size);
      orientImpact(burst, point, normal);
      scene.add(burst);
      live.push(burst);
    }
    // ...and the MUZZLE, at the barrel, pointing back down the line of fire.
    // Firing them separately would let a muzzle and an impact be tuned to
    // look wrong together while each looks right alone, which is exactly the
    // mistake a per-effect lab invites.
    // THE FLIGHT, between the two ends. `showShot` so it can be turned off
    // while tuning an impact in isolation — a lance held across the frame is
    // exactly what you do not want behind a spark you are looking at closely.
    // the kick goes in here and decays in the frame loop. A beam weapon
    // barely moves — there is no round leaving it — which is itself a thing
    // the lab should show rather than smooth over.
    if (rig) {
      const kind0 = (prof().shot && prof().shot.kind) || 'round';
      rig.kick = kind0 === 'lance' || kind0 === 'throw' ? 0.02 : 0.14;
      // RECORDED, not sampled. The probe used to watch for the peak on a
      // 60 ms interval while a 0.14 kick decays in 90 ms — so whether it saw
      // 0.04 or 0.008 was a coin toss, and it reported a working Rotor as
      // broken. A check that depends on catching a spike is a check that
      // will lie eventually.
      rig.kickPeak = Math.max(rig.kickPeak || 0, rig.kick);
    }
    if (P.showShot) {
      const m = muzzlePoint();
      spawnShot(new THREE.Vector3(m[0], m[1], m[2]),
        new THREE.Vector3(point[0], point[1], point[2]),
        (prof().shot && prof().shot.kind) || 'round',
        shotColor());
    }
    if (P.showMuzzle) {
      const mz = prof().muzzle;
      const mNames = Array.isArray(mz.recipe) ? mz.recipe : (IMPACT_RECIPES[mz.recipe] || []);
      if (mNames.length) {
        const m = muzzlePoint();
        const mb = makeImpactBurst(mNames, tuneFor(mz), mz.colors, shots + 991, mz.size);
        // +Z out of the "surface" means, at a muzzle, back along the barrel
        // toward where the round came from — so the flash blooms outward
        orientImpact(mb, m, [0, 0, 1]);
        scene.add(mb);
        live.push(mb);
      }
    }
    if (probeOn) {
      console.log(`IMPACTPROBE shot=${shots} sentry=${subject} slot=${P.slot} recipe=${P.recipe} [${names.join(',')}]`
        + ` shooter=${shooters.sentry ? 'sentry' : 'tank'} surface=${P.surface} wall=${P.wall} angle=${P.wallAngle}`
        + ` at=(${point.map((v) => v.toFixed(2)).join(',')})`
        + ` n=(${normal.map((v) => v.toFixed(2)).join(',')}) live=${live.length}`);
    }
  }

  const probeOn = q.get('impactprobe') === '1';

  // --- GUI ------------------------------------------------------------------
  // --- TWO PANELS ------------------------------------------------------------
  //
  // Operator: "the UI with everything on the right makes it hard to navigate...
  // perhaps half the settings on the left, environment, etc. and specifics of
  // impact on the right."
  //
  // It was one column of forty controls that ran off the bottom of a 1300px
  // screen, so tuning a spark meant scrolling past the wall's incidence to
  // find it and scrolling back to see what it did. Split by the QUESTION each
  // control answers:
  //
  //   LEFT   THE STAGE — which sentry, what it is shooting at, how the ground
  //          curves, how fast time runs. Set once, then left alone.
  //   RIGHT  THE WEAPON — the recipe and the numbers behind it, plus the
  //          export. Touched constantly, and the thing being looked at.
  //
  // And the knob folders now follow the RECIPE. Showing all seven families
  // while five are in use is most of the length, and every one of them is a
  // set of sliders that do nothing to the picture on screen.
  const guiL = new GUI({ title: 'STAGE', container: root });
  const guiR = new GUI({ title: 'WEAPON FX', container: root });
  guiL.domElement.classList.add('lab-gui-left');
  guiR.domElement.classList.add('lab-gui-right');
  const refresh = () => {
    guiL.controllersRecursive().forEach((c) => c.updateDisplay());
    guiR.controllersRecursive().forEach((c) => c.updateDisplay());
  };
  // one name the rest of the file can keep using for "update everything"
  const gui = { controllersRecursive: () => [
    ...guiL.controllersRecursive(), ...guiR.controllersRecursive()] };

  // ---- LEFT: the stage -------------------------------------------------
  guiL.add({ sentry: subject }, 'sentry', FX_KEYS).name('sentry').onChange((v) => {
    subject = v;
    P.recipe = 'profile';
    pullFromProfile();
    loadSentryModel();
    syncKnobFolders();
  });
  guiL.add(P, 'surface', Object.keys(SURFACES)).name('surface').onChange(paintWall);
  guiL.add({ shoot: () => fire() }, 'shoot').name('FIRE (F)');
  guiL.add(P, 'auto').name('auto-fire');
  guiL.add(P, 'every', 0.2, 4, 0.1).name('every (s)');
  guiL.add(P, 'slow', 0.1, 1, 0.05).name('time scale');
  guiL.add(P, 'showMuzzle').name('show muzzle');
  guiL.add(P, 'showShot').name('show the shot');
  guiL.add(P, 'trail').name('keep scorches');
  const gWall = guiL.addFolder('the wall');
  gWall.add(P, 'wall').name('wall on').onChange(placeWall);
  gWall.add(P, 'wallAngle', -80, 80, 1).name('incidence (deg)').onChange(placeWall);
  gWall.add(P, 'wallSize', 1, 10, 0.5).name('size').onChange(() => { buildWall(); });
  const gGround = guiL.addFolder('the ground');
  gGround.add(P, 'curveR', 0, 40, 0.5).name('curve (0=flat)').onChange(() => { layGround(); });
  gGround.add({ board: () => { P.curveR = 12.5; layGround(); refresh(); } }, 'board')
    .name("the board's own (12.5)");

  // ---- RIGHT: the weapon ------------------------------------------------
  guiR.add(P, 'slot', ['impact', 'muzzle']).name('tuning').onChange(() => {
    P.recipe = 'profile';
    pullFromProfile();
    syncKnobFolders();
  });
  guiR.add(P, 'recipe', ['profile', 'shell', 'laser', 'plasma', 'light', 'custom'])
    .name('recipe').onChange(() => { pullFromProfile(); syncKnobFolders(); });
  guiR.add(P, 'size', 0.1, 4, 0.05).name('hit size');

  const gCustom = guiR.addFolder('families');
  for (const f of IMPACT_FAMILIES) {
    gCustom.add(P, `use_${f}`).name(f).onChange(() => {
      if (P.recipe !== 'custom') { P.recipe = 'custom'; refresh(); }
      pushToProfile();
      syncKnobFolders();
    });
  }

  // one folder per family, from the knob table's own `group` — and only the
  // ones this recipe actually uses. The rest are hidden rather than removed,
  // so a family coming back does not rebuild the panel underneath the mouse.
  const knobFolders = {};
  {
    const byGroup = {};
    for (const k of IMPACT_KNOBS) (byGroup[k.group] ||= []).push(k);
    for (const [g, knobs] of Object.entries(byGroup)) {
      const f = guiR.addFolder(g);
      for (const k of knobs) f.add(P, k.key, k.min, k.max, k.step).name(k.label);
      f.close();
      knobFolders[g] = f;
    }
  }
  function syncKnobFolders() {
    const inUse = new Set(currentRecipe());
    for (const [g, f] of Object.entries(knobFolders)) {
      f.domElement.style.display = inUse.has(g) ? '' : 'none';
    }
  }

  // 3. EXPORT — the reason the panel edits a profile rather than a loose tune.
  // What comes out is the exact source of the entry in sentryfx.js, so making
  // a tuning the default is a paste and not a transcription. A tuning that
  // lives in one browser is a tuning that never ships.
  function exportOne() {
    pushToProfile();
    return formatSentryFx(subject, prof());
  }
  function exportAll() {
    pushToProfile();
    return Object.entries(work).map(([k, p2]) => formatSentryFx(k, p2)).join('\n');
  }
  function copyOut(src, what) {
    const say = () => { flash(`${what} copied — paste over its entry in src/sentryfx.js`); };
    console.log(`SENTRYFX ${what}:\n${src}`);
    if (navigator.clipboard) navigator.clipboard.writeText(src).then(say, () => {});
    else say();
  }

  const copyBtn = root.querySelector('#impact-copy');
  if (copyBtn) copyBtn.addEventListener('click', () => copyOut(exportOne(), subject));
  guiR.add({ exp: () => copyOut(exportOne(), subject) }, 'exp')
    .name('EXPORT this sentry');
  guiR.add({ expAll: () => copyOut(exportAll(), 'the whole table') }, 'expAll')
    .name('export ALL families');
  guiR.add({ revert: () => {
    const p0 = SENTRY_FX[subject];
    work[subject] = {
      shot: { ...p0.shot },
      muzzle: { ...p0.muzzle, colors: { ...p0.muzzle.colors }, tune: { ...p0.muzzle.tune } },
      impact: { ...p0.impact, colors: { ...p0.impact.colors }, tune: { ...p0.impact.tune } },
    };
    P.recipe = 'profile';
    pullFromProfile();
    flash(`${subject} reverted to its shipped profile`);
  } }, 'revert').name('revert this sentry');
  wireDeepLink(root.querySelector('#impact-link'),
    () => deepLink({ base: location.origin + location.pathname, hash: 'impact', params: P, defaults: P0 }),
    { flash: (m) => flash(m) });

  let flashMsg = '', flashT = 0;
  function flash(m) { flashMsg = m; flashT = 2.0; }

  // open on the SUBJECT's own numbers, not on IMPACT_TUNE's — otherwise the
  // first thing the lab shows is a weapon nobody ships
  if (!q.get('recipe')) P.recipe = 'profile';
  pullFromProfile();
  syncKnobFolders();

  addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.key === 'f' || e.key === 'F') { fire(); e.preventDefault(); }
    if (e.key === 'c' || e.key === 'C') { clearAll(); e.preventDefault(); }
  });

  function clearAll() {
    for (const b of [...live, ...standing]) scene.remove(b);
    live.length = 0; standing.length = 0;
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    postfx.setSize(w, h);
  }
  addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let sinceFire = 0, hudT = 0;
  function animate() {
    requestAnimationFrame(animate);
    if (!active) return;
    const raw = Math.min(0.05, clock.getDelta());
    const dt = raw * P.slow;    // an impact is 400ms: without this you miss it
    if (P.auto) {
      sinceFire += raw;
      if (sinceFire >= P.every) { sinceFire = 0; fire(); }
    }
    stepShots(dt);
    // AIM, SPIN, RECOVER. The gun holds the wall (this stage has one target
    // and it does not move), the barrels spool while auto-fire is running,
    // and the recoil eases back out of the kick that fire() puts in.
    if (rig && shooters.sentry && shooters.sentry.visible) {
      const kind = (prof().shot && prof().shot.kind) || 'round';
      if (rig.yaw) rig.yaw.rotation.y = 0;      // the wall is dead ahead
      if (rig.pitch) {
        // LEVEL AT THE PLATE. The impact lands at the wall's centre at about
        // the barrel's own height, so the gun sits level — driving a pitch
        // from the muzzle's height would chase its own tail, because the
        // muzzle's height is a function of the pitch.
        rig.pitch.rotation.x = 0;
      }
      // a ROTARY gun spins while it has something to do; everything else
      // never spins, and a spinning Lancer would be a lie about the weapon
      if (rig.rotor) {
        const want = (P.auto && kind === 'round' && subject === 'rotor') ? 16 : 0;
        rig.spinRate += (want - rig.spinRate) * Math.min(1, raw * 2.2);
        rig.spin += rig.spinRate * raw;
        rig.rotor.rotation.z = rig.spin;
      }
      // RECOIL is a spike that decays — a linear return reads as a piston
      if (rig.recoil) {
        rig.kick = Math.max(0, rig.kick - raw * 1.6);
        rig.recoil.position.z = -rig.kick;
      }
    }
    for (let i = live.length - 1; i >= 0; i--) {
      if (live[i].userData.tick(dt)) continue;
      // KEEP THE SCORCHES. Everything else is over in two seconds; a wall you
      // have shot fifty times should not look like one nobody has touched.
      if (P.trail && (live[i].userData.families || []).includes('scorch')) standing.push(live[i]);
      else scene.remove(live[i]);
      live.splice(i, 1);
    }
    while (standing.length > 40) scene.remove(standing.shift());
    controls.update();
    postfx.render();
    hudT += raw;
    if (hudT > 0.2) {
      hudT = 0;
      if (flashT > 0) { flashT -= 0.2; hud.textContent = flashMsg; }
      else {
        hud.textContent = `${subject.toUpperCase()} · tuning ${P.slot}`
          + ` · ${P.recipe} [${lastFamilies.join(' + ') || '-'}]`
          + ` · ${shooterLabel()} → ${surfaceDef().label}`
          + ` · wall ${P.wall ? `${P.wallAngle}°` : 'OFF'}`
          + ` · live ${live.length} · inflight ${flights.length} · scorches ${standing.length}`
          + ` · x${P.slow.toFixed(2)} time · F fire, C clear`;
      }
    }
  }
  animate();

  // ?impactprobe=1 — fire one of every recipe and report what each produced.
  // A particle effect cannot be checked from a still: a spark shower and a
  // dead emitter are the same photograph one frame after the flash.
  if (probeOn) {
    setTimeout(() => {
      // AUTO-FIRE OFF FIRST. The 6-second beat asserts that every burst
      // returned false and was reaped, and it cannot tell a leak from a shot
      // fired one second ago — with the clock running it reports WRONG on
      // working code, which is the same trap the shove probe fell into.
      const wasAuto = P.auto, wasRecipe = P.recipe;
      P.auto = false;
      for (const name of [...Object.keys(IMPACT_RECIPES), 'custom']) {
        P.recipe = name;
        fire();
      }
      P.recipe = wasRecipe;   // a probe that leaves the panel changed is a probe that lies twice
      // THE EXPORT IS THE POINT, so it is checked rather than assumed. A tune
      // that emits source which does not carry the edit is worse than no
      // export: the operator pastes, the values quietly revert, and the lab
      // looks like it lied.
      {
        P.slot = 'impact';
        P.recipe = 'profile';
        pullFromProfile();
        const before = tuneFor(prof().impact).ringEnd;
        P.ringEnd = before + 0.37;           // an edit no shipped profile has
        P.size = 2.345;
        const src = exportOne();
        const carriesTune = src.includes(`ringEnd: ${Number((before + 0.37).toFixed(3))}`);
        const carriesSize = src.includes('2.35') || src.includes('2.34');
        const onlyDeltas = !src.includes('sparkLife');   // untouched knobs stay out
        console.log(`IMPACTPROBE export sentry=${subject} tune=${carriesTune}`
          + ` size=${carriesSize} deltas-only=${onlyDeltas}`
          + ` ${carriesTune && carriesSize && onlyDeltas ? 'OK'
            : 'WRONG — the export does not carry the edit'}`);
        const all = exportAll().split('\n').filter((l) => /^  \w+: \{ shot:/.test(l)).length;
        console.log(`IMPACTPROBE export-all families=${all}/${FX_KEYS.length}`
          + ` ${all === FX_KEYS.length ? 'OK' : 'WRONG — the table is incomplete'}`);
      }
      // THE MACHINE MOVING is motion, and a screenshot of a spinning barrel and
      // a stopped one are the same picture. Sampled instead: the rotor's angle
      // must CLIMB while auto-fire runs, and the recoil must both spike on a
      // shot and come back — a kick that never returns is a gun stuck open.
      if (rig) {
        const spin0 = rig.spin;
        rig.kickPeak = 0;
        for (let k = 0; k < 3; k++) fire();     // guarantee a shot to measure
        setTimeout(() => {
          const kickMax = rig.kickPeak || 0;
          const spun = rig.spin - spin0;
          const wantsSpin = subject === 'rotor';
          // A BEAM IS EXPECTED NOT TO KICK. Nothing leaves a lance, so its
          // recoil is a token 0.02 that decays inside one sampling interval —
          // the first version of this check called that a failure and would
          // have had someone "fixing" a gun that was behaving correctly.
          const kind2 = (prof().shot && prof().shot.kind) || 'round';
          const wantsKick = kind2 !== 'lance' && kind2 !== 'throw' && kind2 !== 'field';
          const spinOk = wantsSpin ? spun > 1 : spun < 0.01;
          const kickOk = wantsKick ? (kickMax > 0.01 && rig.kick < kickMax) : rig.kick < 0.05;
          console.log(`IMPACTPROBE rig-motion kind=${kind2} spun=${spun.toFixed(2)}rad`
            + ` kickMax=${kickMax.toFixed(3)} kickNow=${rig.kick.toFixed(3)}`
            + ` expect-spin=${wantsSpin} expect-kick=${wantsKick}`
            + ` ${spinOk && kickOk ? 'OK'
              : 'WRONG — the machine is not moving as its weapon should'}`);
        }, 2200);
      }
      setTimeout(() => {
        console.log(`IMPACTPROBE after 1s: live=${live.length} standing=${standing.length}`
          + ` ${live.length > 0 ? 'OK — effects are still running' : 'WRONG — everything died instantly'}`);
      }, 1000);
      setTimeout(() => {
        console.log(`IMPACTPROBE after 6s: live=${live.length} standing=${standing.length}`
          + ` ${live.length === 0 ? 'OK — every burst finished and was reaped'
            : 'WRONG — something never returned false and is leaking'}`);
        P.auto = wasAuto;
      }, 6000);
    }, 1200);
  }

  return {
    setActive(on) { active = on; if (on) { resize(); clock.getDelta(); } },
  };
}
