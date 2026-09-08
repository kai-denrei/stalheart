import { createAstroDiorama, modelBudget } from './labs/astro-diorama.js';
import { createAstroPerformance } from './labs/astro-performance.js';
import { DEFAULT_TANK } from './content/tank.js';
// astro-tab.js — THE ASTRONAUT STUDY. A rigged, animated GLB on the lab
// stage: does its animation work for a rescue mission — astronauts in a
// structure, scientists carrying blueprints, the tank sent to get them
// out — and at what scale does a person read next to the MÖRK?
//
// The study asks three things of the file, and answers them on screen:
// what clips it carries (this one: a 1.03 s walk cycle, 25 joints, a
// Mixamo-style biped), whether the walk reads on the spot and moving,
// and how tall a person is beside the tank at the game's own ratio. The
// tank is cast the way the board casts it; nothing here is a copy.
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import GUI from '../vendor/lil-gui.esm.js';
import { makeBloom } from './postfx.js';
import { bakeGalaxyCube } from './galaxybake.js';
import { SKY_PRESET } from './galaxyseed.js';
import { LOOKS } from './looks.js';
import { buildCreature, preloadMork, preloadAstronaut, preloadAstronauts, makeAstronaut,
  ASTRONAUT_IDS, preloadContainer, makeContainerFixture,
  preloadDish, makeDishFixture } from './units.js';
import { mulberry32 } from './rng.js';
import { applyWeatheredMaterial } from './cine/materials.js';
import { deepLink, wireDeepLink } from './deeplink.js';

export const ASTRO_URL = 'assets/models/astronaut.glb';
// BOTH SIZES ARE SLIDERS NOW (operator, 2026-09-05: "make the astronaut much
// smaller relative to the tank... put a size slider for the tank and
// astronaut"). The study's whole job is to settle a RATIO, and a ratio
// settled by editing a constant and reloading is a ratio nobody settles.
// These are the defaults it opens on; the HUD prints the ratio the sliders
// are currently making, so the answer can be read off the screen.
const TANK_LEN_M = 10.0, PERSON_M = 1.8;

export function initAstroTab(root) {
  let active = false, disposed=false, frameId=0, stageTime=0;
  const q = new URLSearchParams(location.search);
  const container = root.querySelector('#astro-app');
  const hud = root.querySelector('#astro-hud');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;   // the cinematic's, not the flat cast's — see dressCast
  // (the slider overwrites this once P is read)
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 1000);
  const az = (parseFloat(q.get('az')) || 32) * Math.PI / 180, el = (parseFloat(q.get('el')) || 12) * Math.PI / 180;
  // THE FRAME FOLLOWS THE SLIDERS. A fixed 5.2 m was right for a 5.3 m tank
  // and puts the lens inside a 10 m one — and the tank's size is a knob now,
  // so the opening distance has to be derived from it or every new default
  // opens on the inside of the hull.
  const dist = parseFloat(q.get('dist')) || 0;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  function frame(len) {
    const d = dist || len * 1.55;
    camera.position.set(Math.sin(az) * Math.cos(el) * d, len * 0.22 + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    controls.target.set(0, len * 0.16, 0);
    controls.update();
  }

  // the metal lab's light: the sky as environment, a key that casts, a fill, a rim
  const sky = bakeGalaxyCube(renderer, { ...SKY_PRESET, seed: 4414, face: 1024, galaxies: 2 });
  scene.background = sky.texture;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromCubemap(sky.texture);scene.environment = environment.texture;
  // the environment is a KNOB here for the same reason the exposure is: a
  // dressed hull and a suited figure are both PBR surfaces that show mostly
  // what they reflect, and at 0.5 the astronaut read as a black silhouette
  scene.environmentIntensity = 0.9;
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(6, 9, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -6; sun.shadow.camera.right = sun.shadow.camera.top = 6;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8ab4ff, 0.7); fill.position.set(-6, 4, 5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9fdcff, 0.9); rim.position.set(2, 3, -7); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xc9d4e6, 0x141216, 0.3));
  const look = LOOKS.tronColors;
  // a floor with the board's wire on it, so a stride has a scale
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  let grid = null;
  // one metre per square, whatever the scale — the wire IS the ruler this
  // study measures a stride against, so it must stay a known unit
  function layFloor(radius) {
    const r = Math.max(4, Math.ceil(radius));
    floor.scale.setScalar(r);
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
    grid = new THREE.GridHelper(r * 2, P.path==='diorama'?Math.ceil(r*2/5):r*2, look.edges.color, look.edges.color);
    grid.material.transparent = true; grid.material.opacity = P.path==='diorama'?.09:.22;
    grid.position.y = 0.002; grid.visible = P.wire;
    scene.add(grid);
    // the key's shadow box has to cover the same ground or the walker
    // crosses out of its own shadow half way round
    sun.shadow.camera.left = sun.shadow.camera.bottom = -r;
    sun.shadow.camera.right = sun.shadow.camera.top = r;
    sun.shadow.camera.far = r * 4;
    sun.shadow.camera.updateProjectionMatrix();
  }
  const postfx = makeBloom(renderer, scene, camera, { scale: 1, strength: 0.25, radius: 0.5, threshold: 0.4 });

  const crewProbe = q.get('crewprobe') === '1';

  const P = {
    clip: '', play: true, speed: 1.0, loop: true, stride: 1.3,   // stride: metres per second of travel
    // CREW IS THE DEFAULT. This tab opened on the solo `perimeter` study, which
    // answered the RATIO question — and that question is settled: 0.180, and
    // the game ships it. The live question is behaviour, so the tab should open
    // on the thing it is now for. It was also actively misleading: the panel
    // showed a "crew wander" folder reading `astronauts: 2` while the mode was
    // off, so the URL promised two people and drew none.
    path: 'diorama',           // crew | perimeter | straight | spot
    crew: 2,                // astronauts in the crew wander
    cast: 'mixed',          // mixed | classic | compact — which bodies walk
    runMul: 2.3,            // a run is this many times the walk's stride
    dwell: 2.0,             // seconds stood at a station before moving on
    // NOT `seed`: that name is the whole app's board seed, and putting it in
    // this tab's query took the router to the grid tab instead of here.
    crewSeed: 7,            // the wander's stream — same seed, same shift
    turret: true, cargo: true,   // the things they walk BETWEEN
    dish: false, dishH: 22,       // NASA's 70 m DSN antenna, and its height in metres
    showSolids: false,      // draw the discs the walkers route around
    personH: PERSON_M,      // metres, tall
    tankLen: TANK_LEN_M,    // metres, longest dimension
    clear: 1.0,             // metres of daylight between the hull and the walk
    outline: 0.22,          // the cast's blueprint edges, as a rim (the cinematic's number)
    exposure: 0.95,         // ...and near the cinematic's exposure, which a textured hull needs
    env: 0.9,               // how much sky the metal and the suit reflect
    spin: false, tank: true, wire: true, scan: false,
  };
  // the defaults, before the URL touches them — the deep link writes only
  // what DIFFERS from these, so a shared address is the session and not the
  // whole panel
  const P0 = { ...P };
  for (const [k, v] of q.entries()) {
    if (!(k in P)) continue;
    if (typeof P[k] === 'number') { const n = parseFloat(v); if (Number.isFinite(n)) P[k] = n; }
    else if (typeof P[k] === 'boolean') P[k] = v !== '0';
    else P[k] = v;
  }

  renderer.toneMappingExposure = P.exposure;   // ...and the URL/knob wins
  scene.environmentIntensity = P.env;
  layFloor(P.tankLen * 0.8);
  frame(P.tankLen);

  // THE ASTRONAUT
  const stage = new THREE.Group(); scene.add(stage);
  let astro = null, mixer = null, clips = [], action = null, height = 1, walkT = 0, bones = 0;
  const astroBox = new THREE.Box3();      // the file's own box, before any scaling
  let legacyLoading=false;
  function loadLegacy(){if(legacyLoading||disposed)return;legacyLoading=true;
  new GLTFLoader().load(ASTRO_URL, (gltf) => {
    if(disposed)return;
    astro = gltf.scene;
    clips = gltf.animations || [];
    astro.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(astro);
    const size = new THREE.Vector3(); box.getSize(size);
    // the file is in centimetres (170 tall): normalise to the slider's
    // metres, feet on the floor. The model already walks down +Z, like the
    // tank, so no rotation is applied here — the perimeter path sets the
    // heading and that is the only place a bearing is decided.
    height = size.y;
    astroBox.copy(box);
    sizeAstro(P.personH);
    astro.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false; } if (o.isBone) bones++; });
    stage.add(astro);
    mixer = new THREE.AnimationMixer(astro);
    if (clips.length) { P.clip = clips[0].name; clipCtrl.options(clips.map((c) => c.name)); clipCtrl.setValue(P.clip); playClip(P.clip); }
    hudLine();
    console.log(`ASTRO loaded: ${clips.length} clip(s) ${clips.map((c) => `"${c.name}" ${c.duration.toFixed(2)}s`).join(', ')}; height ${height.toFixed(1)} units -> ${P.personH} m; ${bones} bones`
      + ` | tank ${P.tankLen} m, ratio ${(P.personH / P.tankLen).toFixed(3)}`);
  }, undefined, (e) => { hud.textContent = `astronaut: failed to load (${e && e.message})`; });

  // THE CREW USES THE GAME'S OWN CAST, not this tab's hand-loaded copy: the
  // point of a study is to judge what actually ships. preloadAstronaut hands
  // back a one-unit-tall prototype and makeAstronaut clones the rig properly
  // — Object3D.clone() shares a SkinnedMesh's skeleton by reference, so two
  // naive clones deform identically AND stand in the same place, which looks
  // exactly like the second model failing to load.
  preloadAstronauts().then((protos) => {
    if(disposed)return;
    if (!protos.length) return;
    crewProtos = protos;
    if (P.path === 'crew') { buildProps(); buildDish(); buildCrew(); syncMode(); }
  });

  }

  // Re-sizing has to be re-doable, not a one-shot at load: the slider moves
  // it. Both the scale and the recentre are derived from the ORIGINAL box
  // every time, so repeated calls do not compound.
  function sizeAstro(metres) {
    if (!astro) return;
    const k = metres / Math.max(height, 1e-6);
    astro.scale.setScalar(k);
    const c = astroBox.getCenter(new THREE.Vector3());
    astro.position.set(-c.x * k, -astroBox.min.y * k, -c.z * k);
  }

  function playClip(name) {
    if (!mixer) return;
    const clip = clips.find((c) => c.name === name);
    if (!clip) return;
    if (action) action.fadeOut(0.2);
    action = mixer.clipAction(clip);
    action.reset().setLoop(P.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).fadeIn(0.2).play();
    action.clampWhenFinished = true;
  }

  // THE TANK, for scale — and it is the thing being walked around, so it
  // stands at the ORIGIN rather than parked off to one side. The cast is the
  // board's own; the DRESSING is the cinematic's (`applyWeatheredMaterial`
  // with neither colour nor emissive kept), because the operator asked for
  // "the model for the tank that has the texture" and the board's grey
  // ladder is the un-textured read. This stage has a sky, a key and a fill —
  // it can light its own metal, which is exactly the condition the dark
  // CINE_BASE was written for.
  let tank = null, tankR = 2.5;      // tankR: footprint radius, metres
  const diorama=createAstroDiorama(scene,{tankBounds:()=>tank?new THREE.Box3().setFromObject(tank):null});
  const yardDefaults={...diorama.settings};
  for(const [key,value] of Object.entries(yardDefaults)){const v=q.get('yard_'+key);if(v===null)continue;diorama.settings[key]=typeof value==='boolean'?v!=='0':typeof value==='number'?Math.max(0,Math.min(60,Number(v)||0)):['Auto','Idle','Walk','Run','Point','Kneel','Scared','Lie'].includes(v)?v:value;}
  const perf=createAstroPerformance(root,renderer,()=>[...diorama.state().groups,{id:'MÖRK',visible:!!tank?.visible,...modelBudget(tank)}]);
  const tankBox = new THREE.Box3();  // ...before any scaling, like the astronaut's
  preloadMork().then((ok) => {
    if (!ok||disposed) return;
    tank = buildCreature(DEFAULT_TANK, { walker: look.walker, walkerHi: look.walkerHi });
    tank.updateMatrixWorld(true);
    tankBox.setFromObject(tank);
    try {
      const n = applyWeatheredMaterial(tank, { seed: 4414, size: 1024, repeat: 2, normalScale: 0.9,
        envMap: scene.environment, envMapIntensity: 0.9 });
      console.log(`ASTRO tank dressed: ${n} material(s) weathered`);
    } catch (e) { console.warn('ASTRO: dress failed', e); }
    tank.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // ...AND THE CAST'S BLUEPRINT PASS COMES DOWN. A dressed hull still wears
    // the game's white line on every edge at 0.85 opacity — the read that
    // makes it legible at a cell's size on a black board, and the read that
    // walls it in white under a lens (the first still here: a paper cut-out
    // with a textured barrel, exactly the failure `cine/tankscene.js`
    // documents). The lines stay as a rim at `outline`, and the glow parts
    // take the cinematic's dim cyan instead of a white-hot emissive. This is
    // the same treatment the tank cinematic applies, for the same reason.
    dressCast();
    tank.visible = P.tank;
    scene.add(tank);
    sizeTank(P.tankLen);
  });

  function dressCast() {
    if (!tank) return;
    tank.traverse((o) => {
      // only the line sets the cast SHOWS; a hidden set (a callout, a bound)
      // stays hidden — the same rule the cinematic states
      if (o.isLineSegments && o.material && (o.visible || o.userData.astroLine)) {
        o.userData.astroLine = true;
        o.material.opacity = P.outline;
        o.material.transparent = true;
        o.visible = P.outline > 0;
      }
      if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m) continue;
        if (/^M_Glow/.test(m.name || '') && m.emissive) {
          m.emissive.setHex(0x7df9ff); m.emissiveIntensity = 0.45; m.color.setHex(0x101418);
        } else if (m.type === 'MeshBasicMaterial' && m.color) m.color.setHex(0x3f8a9c);
      }
    });
  }

  // Same shape as sizeAstro: derived from the ORIGINAL box every time, so the
  // slider can be dragged back and forth without compounding. Standing the
  // hull on the floor at the origin also fixes the walk's centre, which is
  // what the perimeter path orbits.
  function sizeTank(metres) {
    if (!tank) return;
    const size = tankBox.getSize(new THREE.Vector3());
    const k = metres / Math.max(size.x, size.y, size.z, 1e-6);
    tank.scale.setScalar(k);
    tank.position.set(0, 0, 0);
    tank.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(tank);
    const c = b.getCenter(new THREE.Vector3());
    tank.position.set(-c.x, -b.min.y, -c.z);
    // the footprint the walk must clear — the half-diagonal of the plan view,
    // not the length, or a walker rounding the corners would clip the hull
    const sz = b.getSize(new THREE.Vector3());
    tankR = 0.5 * Math.hypot(sz.x, sz.z);
    // the floor and the frame have to hold the whole SHIFT, not just the hull
    // THE FLOOR HOLDS THE DISH; THE CAMERA FRAMES THE PEOPLE. Sizing the shot
    // to contain a 70 m antenna pushed the camera so far back that the
    // astronauts — the subject of this tab — became the smallest thing on
    // screen. A dish does not need to be fully in frame to read as enormous;
    // being cropped is most of how "enormous" is conveyed.
    const ring = crewRing() + Math.max(2, P.personH * 2);
    const reach = P.path === 'crew'
      ? ring
      : tankR + Math.max(0, P.clear) + Math.max(2, metres * 0.25);
    // the floor still has to reach the dish, or it stands on nothing
    const floorReach = P.path === 'crew' && P.dish ? Math.max(ring, crewRing() * 2.6) : reach;
    layFloor(floorReach);
    frame(P.path === 'crew' ? reach * 1.15 : metres);
    if(P.path==='diorama'){layFloor(280);diorama.focus(q.get('yard_view')||'Crew',camera,controls);}
    placeProps();   // the stations are derived from tankR, so they move with it
  }

  // --- THE CREW WANDER ------------------------------------------------------
  //
  // Operator: "I want to see both Astronauts run around between the Tank and
  // a Turret and entering a container, somewhat randomly, alternating walking
  // and running."
  //
  // Three STATIONS and a state machine per person: travel to a station,
  // stand there a moment (or go INSIDE, if it is the container), pick
  // another, go. What makes it read as people rather than as a demo loop is
  // that the two of them are on independent streams — different seeds off
  // one `seed`, so the whole shift is reproducible but the two are never in
  // step.
  //
  // ONE CLIP, TWO GAITS. The file carries a 1.03 s walk and nothing else, so
  // the run is that cycle at higher cadence over a longer stride. That is the
  // study's actual question — a biped's run differs from its walk in cadence
  // and stride before it differs in pose, and this says on screen whether
  // that is enough. Cadence and stride are moved by ONE number so the feet
  // cannot skate: a gait whose cycle outruns its travel is the tell.
  const crew = [];                 // { obj, rng, at, to, p0, p1, u, legT, gait, phase, timer }
  let crewProtos = [];             // every variant, in ASTRONAUT_IDS order
  let turret = null, cargo = null, dish = null;
  let turretLoading = false, cargoLoading = false, dishLoading = false;
  const STATION = { tank: 'tank', turret: 'turret', cargo: 'cargo' };

  // ONE RING, THREE BEARINGS. The stations sit on a circle about the hull
  // whose radius is derived from the tank's own footprint AND the person's
  // height, so the layout survives both size sliders — the same rule the
  // perimeter path already lives under. Deriving it also keeps the floor and
  // the camera honest: the first cut put the turret at 1.9x the hull radius,
  // which was off the edge of the floor and outside the frame, so the props
  // loaded correctly and were nowhere to be seen.
  function crewRing() { return tankR + Math.max(0.6, P.clear) + P.personH * 1.6; }
  const BEARING = { tank: Math.PI * 0.5, turret: -Math.PI * 0.18, cargo: Math.PI * 1.12 };
  function stationPos(which) {
    const R = crewRing();
    // the tank's station is its FLANK, at the clearance the perimeter walk
    // already uses — you stand beside a tank, not on it
    if (which === STATION.tank) {
      const r = tankR + Math.max(0.6, P.clear);
      return new THREE.Vector3(Math.cos(BEARING.tank) * r, 0, Math.sin(BEARING.tank) * r);
    }
    const a = BEARING[which] ?? 0;
    return new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
  }

  function buildProps() {
    // the LOADING flags, not just the loaded ones: both calls into here happen
    // before either async load resolves, so `!turret` is true twice and the
    // scene ends up with two turrets standing in one another
    if (P.turret && !turret && !turretLoading) {
      turretLoading = true;
      new GLTFLoader().load('assets/models/sentries/lancer_t2.glb', (g) => {
        turret = g.scene;
        const b = new THREE.Box3().setFromObject(turret);
        const sz = b.getSize(new THREE.Vector3());
        // a turret reads at about half again a person — tall enough to walk
        // under the barrel, short enough that the hull still dominates
        turret.scale.setScalar((P.personH * 1.6) / Math.max(sz.y, 1e-6));
        turret.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(turret);
        if (crewProbe) console.log(`CREWPROPS turret loaded h=${sz.y.toFixed(2)} -> ${(P.personH * 1.6).toFixed(2)} m`);
        placeProps();
      }, undefined, (e) => {
        // a missing prop is worth saying out loud even without the probe:
        // the study is unreadable without the thing they walk to
        turret = null; turretLoading = false;
        console.log('CREWPROPS turret FAILED ' + (e && e.message));
      });
    }
    if (P.cargo && !cargo && !cargoLoading) {
      cargoLoading = true;
      preloadContainer().then(() => {
        cargo = makeContainerFixture(0);
        if (!cargo) return;
        const b = new THREE.Box3().setFromObject(cargo);
        const sz = b.getSize(new THREE.Vector3());
        // scaled off the PERSON, not the tank: the whole point of walking into
        // one is that a door is a door, and a door is sized by who fits it
        cargo.scale.setScalar((P.personH * 1.55) / Math.max(sz.y, 1e-6));
        cargo.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(cargo);
        if (crewProbe) console.log(`CREWPROPS container loaded h=${sz.y.toFixed(2)}`);
        placeProps();
      });
    }
  }
  function buildDish() {
    if (!P.dish || dish || dishLoading) return;
    dishLoading = true;
    preloadDish().then((ok) => {
      if (!ok) { dishLoading = false; return; }
      dish = makeDishFixture();
      if (!dish) return;
      // THE DISH IS THE SCALE ARGUMENT. A 70 m antenna beside a 10 m hull and
      // a 1.8 m person is the whole reason to put all three on one floor —
      // it is the only object here big enough to make the tank look small.
      dish.scale.setScalar(P.dishH);
      scene.add(dish);
      placeProps();
      if (crewProbe) console.log(`CREWPROPS dish placed at ${P.dishH} m`);
    });
  }

  // --- THE STAGE IS SOLID ------------------------------------------------
  //
  // Operator: the tank, turret, container and dish are solid objects their
  // paths must avoid. They used to lerp station to station and walk straight
  // through the hull, which is the single thing that most gives away that
  // these are markers following a line rather than people crossing a yard.
  //
  // Obstacles are DISCS on the ground, derived from each prop's own bounding
  // box so they survive both size sliders — the same rule the stations live
  // under. A disc rather than a box because a person rounding a corner takes
  // a curve, and because a box needs an orientation that the dish and the
  // container disagree about.
  //
  // THE DISH IS THE EXCEPTION, and it is a real one: an antenna is mostly
  // OVERHEAD. Its bounding box is 22 m across, but what a walker can collide
  // with is the pedestal between its feet — bounding it by the reflector
  // would wall off a third of the yard for a structure you can stand under.
  const solids = [];      // { id, x, z, r }
  function footprint(obj, id, factor = 1) {
    if (!obj) return null;
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    const sz = b.getSize(new THREE.Vector3());
    const c = b.getCenter(new THREE.Vector3());
    return { id, x: c.x, z: c.z, r: 0.5 * Math.hypot(sz.x, sz.z) * factor };
  }
  function rebuildSolids() {
    solids.length = 0;
    const add = (o) => { if (o && o.r > 0.01) solids.push(o); };
    add(footprint(tank, 'tank'));
    if (P.turret) add(footprint(turret, STATION.turret));
    if (P.cargo) add(footprint(cargo, STATION.cargo));
    // the pedestal, not the reflector — you walk UNDER a dish
    if (P.dish && dish) {
      const f = footprint(dish, 'dish', 0.16);
      if (f) { f.x = dish.position.x; f.z = dish.position.z; add(f); }
    }
    drawSolids();
  }

  // The discs, drawn on the ground. Without this an avoided obstacle and a
  // path that happened to miss look identical, and the one number that
  // matters — how wide the walker thinks the tank is — is invisible.
  let solidRings = null;
  function drawSolids() {
    if (solidRings) { scene.remove(solidRings); solidRings = null; }
    if (!P.showSolids) return;
    solidRings = new THREE.Group();
    for (const o of solids) {
      const g = new THREE.BufferGeometry();
      const pos = [];
      const SEG = 48;
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        pos.push(o.x + Math.cos(a) * o.r, 0.02, o.z + Math.sin(a) * o.r);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      solidRings.add(new THREE.Line(g, new THREE.LineBasicMaterial({
        color: 0xff6a5e, transparent: true, opacity: 0.55 })));
    }
    scene.add(solidRings);
  }

  // ROUTE AROUND THEM. For each obstacle the straight line penetrates, step
  // the crossing point out to the disc's edge and go through THAT instead,
  // then re-plan both halves. Recursive with a depth cap: three obstacles in
  // a row is a yard nobody can cross, and a lab should draw a bad path rather
  // than hang looking for a good one.
  //
  // `skip` is a SET holding BOTH endpoints' props. The destination is obvious
  // — a walker heading into the container must be allowed to reach it. The
  // ORIGIN is the one that was missed: the props stand AT their stations, so a
  // walker leaving the turret is standing inside the turret's own disc by
  // construction, and the planner spent the whole leg trying to escape a
  // building it was already in. It reported a route that clipped the turret
  // by 2.9 m, which is how it was found.
  const CLEAR = 0.45;     // metres of daylight between a shoulder and a hull
  function planPath(a, b, skip, depth = 0) {
    if (depth > 3) return [b];
    let worst = null, worstPen = 0;
    for (const o of solids) {
      if (skip.has(o.id)) continue;
      const r = o.r + CLEAR;
      // closest approach of the segment to the disc centre
      const abx = b.x - a.x, abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      if (len2 < 1e-9) continue;
      let t = ((o.x - a.x) * abx + (o.z - a.z) * abz) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = a.x + abx * t, cz = a.z + abz * t;
      const d = Math.hypot(o.x - cx, o.z - cz);
      if (d >= r) continue;
      const pen = r - d;
      if (pen > worstPen) { worstPen = pen; worst = { o, r, cx, cz, d }; }
    }
    if (!worst) return [b];
    // push the closest point out to the rim, along the line from the centre.
    // If the segment runs dead through the middle the direction is degenerate,
    // so fall back to the segment's own perpendicular — a coin toss between
    // two equally good ways round, decided by geometry rather than left alone
    // to produce a NaN.
    let nx = worst.cx - worst.o.x, nz = worst.cz - worst.o.z;
    let nl = Math.hypot(nx, nz);
    if (nl < 1e-6) {
      nx = -(b.z - a.z); nz = b.x - a.x;
      nl = Math.hypot(nx, nz) || 1;
    }
    // PAST the rim, not onto it. Placing the waypoint at exactly the
    // clearance radius left it penetrating by a float's width, so the next
    // recursion found the same obstacle and split again all the way to the
    // depth cap — 15 waypoints for one tank, drawn as a zigzag.
    const push = worst.r + 0.05;
    const via = new THREE.Vector3(
      worst.o.x + (nx / nl) * push, 0, worst.o.z + (nz / nl) * push);
    return [...planPath(a, via, skip, depth + 1), ...planPath(via, b, skip, depth + 1)];
  }

  // Is the straight segment clear of everything but `skip`?
  function segClear(a, b, skip) {
    for (const o of solids) {
      if (skip.has(o.id)) continue;
      const r = o.r + CLEAR;
      const abx = b.x - a.x, abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      if (len2 < 1e-9) continue;
      let t = ((o.x - a.x) * abx + (o.z - a.z) * abz) / len2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(o.x - (a.x + abx * t), o.z - (a.z + abz * t));
      if (d < r) return false;
    }
    return true;
  }

  // STRING-PULLING. The planner is a splitter, so it emits every waypoint it
  // needed to reason with rather than the few a walker needs to follow. Drop
  // any point whose neighbours can see each other: a person going round a
  // tank makes one turn, not eight, and the extra vertices read as hesitation.
  function simplify(route, skip) {
    const out = [route[0]];
    let i = 0;
    while (i < route.length - 1) {
      let j = route.length - 1;
      while (j > i + 1 && !segClear(route[i], route[j], skip)) j--;
      out.push(route[j]);
      i = j;
    }
    return out;
  }

  function placeProps() {
    if (turret) {
      const t = stationPos(STATION.turret);
      turret.position.set(t.x, 0, t.z);
      turret.lookAt(0, turret.position.y, 0);
    }
    if (cargo) {
      const c = stationPos(STATION.cargo);
      cargo.position.set(c.x, 0, c.z);
      // the open doors face the tank, or they walk into a wall
      cargo.rotation.y = Math.atan2(-c.x, -c.z);
    }
    if (dish) {
      // BEHIND everything and off the walk: it is scenery, not a station, and
      // a 70 m dish standing on the ring would simply be the whole picture
      const R = crewRing();
      dish.scale.setScalar(P.dishH);
      dish.position.set(-R * 1.1, 0, -R * 2.2);
      dish.rotation.y = Math.atan2(R * 1.1, R * 2.2);
    }
    // the discs are derived from where the props ARE, so they are rebuilt
    // whenever anything moves — a stale obstacle is worse than none, because
    // the walkers avoid a place nothing is standing
    rebuildSolids();
  }

  function buildCrew() {
    for (const m of crew) { if (m.obj.userData.dispose) m.obj.userData.dispose(); scene.remove(m.obj); }
    crew.length = 0;
    if (P.path !== 'crew' || !crewProtos.length) return;
    for (let i = 0; i < Math.max(0, Math.round(P.crew)); i++) {
      // MIXED alternates, so two people are two people. Naming a variant
      // pins everybody to it, which is how you compare them side by side.
      const pick = P.cast === 'mixed'
        ? crewProtos[i % crewProtos.length]
        : (crewProtos.find((pr) => pr.id === P.cast) || crewProtos[0]);
      const obj = makeAstronaut(pick);
      if (!obj) continue;
      obj.scale.setScalar(P.personH);      // the proto is one unit tall by contract
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(obj);
      // a stream PER PERSON, off the one seed. Same seed, same shift; two
      // people who are never in step, which is the thing that reads.
      const rng = mulberry32((P.crewSeed | 0) * 7919 + i * 104729);
      const at = i === 0 ? STATION.turret : STATION.cargo;
      const m = { id: `crew${i}`, obj, rng, at, to: at, p0: stationPos(at), p1: stationPos(at),
        u: 1, legT: 1, gait: 'walk', phase: 'dwell', timer: P.dwell * (0.4 + rng()) };
      obj.position.copy(m.p0);
      crew.push(m);
    }
    pickNext(crew[0]); if (crew[1]) pickNext(crew[1]);
  }

  function pickNext(m) {
    if (!m) return;
    const others = Object.values(STATION).filter((k) => k !== m.at);
    m.to = others[Math.floor(m.rng() * others.length) % others.length];
    m.p0 = m.obj.position.clone(); m.p0.y = 0;
    m.p1 = stationPos(m.to);
    // A ROUTE, not a line. The destination's own prop is exempt or the
    // planner refuses every errand it is given.
    rebuildSolids();
    const skip = new Set([m.at, m.to]);   // where it stands and where it is going
    m.skip = skip;
    m.route = simplify([m.p0.clone(), ...planPath(m.p0, m.p1, skip)], skip);
    m.leg = 0;
    // ALTERNATING, not random: a coin flip gives runs of four and reads as
    // indecision. Biased against whatever the last leg was, so the two gaits
    // trade off while still being unpredictable leg to leg.
    m.gait = m.rng() < (m.gait === 'run' ? 0.25 : 0.65) ? 'run' : 'walk';
    m.speed = P.stride * P.speed * (m.gait === 'run' ? P.runMul : 1);
    // time is per LEG now, and the pace is what is constant across them — a
    // route timed as a whole would sprint the detour to make up the distance
    m.legT = Math.max(0.15, m.route[1].distanceTo(m.route[0]) / Math.max(0.1, m.speed));
    m.u = 0;
    m.phase = 'travel';
    if (crewProbe) {
      console.log(`CREWPROBE ${m.id} ${m.at} -> ${m.to} ${m.gait}`
        + ` ${m.p0.distanceTo(m.p1).toFixed(1)}m direct`
        + `${m.route.length > 2 ? `, routed via ${m.route.length - 2} waypoint(s)` : ', clear'}`
        + ` · ${routeVerdict(m)}`);
    }
    if (m.obj.userData.setWalking) m.obj.userData.setWalking(true);
    // cadence rides WITH the stride, or the feet skate. The exponent is the
    // one liberty taken: a real run lengthens the stride more than it quickens
    // the legs, so the cycle is driven a little under the speed multiplier.
    // ask for the GAIT, not for a cadence: a model with a real Running clip
    // plays it, and one with only a walk drives that walk faster. The caller
    // does not need to know which body it is holding.
    if (m.obj.userData.setGait) m.obj.userData.setGait(m.gait);
    if (m.obj.userData.setCadence && !m.obj.userData.hasRun) {
      m.obj.userData.setCadence(m.gait === 'run' ? Math.pow(P.runMul, 0.8) * P.speed : P.speed);
    }
  }

  // THE TWO STUDIES DO NOT SHARE A STAGE. The solo astronaut answers the
  // RATIO question and is parented to `stage`; the crew answers a behaviour
  // question and stands on its own. Showing both at once puts a duplicate
  // person in the middle of the shot and makes neither readable, so the mode
  // switch hides whichever is not being asked.
  function syncMode() {
    const on = P.path === 'crew';
    const station=P.path==='diorama';diorama.setEnabled(station);if(!station)loadLegacy();
    stage.visible = !on&&!station;
    if (turret) turret.visible = on && P.turret;
    if (cargo) cargo.visible = on && P.cargo;
    if (dish) dish.visible = on && P.dish;
    if (on) { buildProps(); buildDish(); if (!crew.length) buildCrew(); }
    for (const m of crew) m.obj.visible = on && m.phase !== 'inside';
    placeProps();
    sizeTank(P.tankLen);   // re-lays the floor and re-frames for the mode
  }

  // THE ONLY QUESTION THAT MATTERS about a route is whether it stays out of
  // the solids, and a waypoint count does not answer it — a path can have
  // seven waypoints and still clip a hull. So the route is SAMPLED along its
  // whole length and every sample checked against every disc. Reported per
  // leg, because a planner that is right nine times out of ten is a planner
  // that walks through the tank once a minute, which is what a viewer sees.
  function routeVerdict(m) {
    const skip = m.skip || new Set([m.at, m.to]);
    let worst = 0, worstId = '';
    for (let i = 0; i < m.route.length - 1; i++) {
      const a = m.route[i], b = m.route[i + 1];
      const steps = Math.max(2, Math.ceil(a.distanceTo(b) / 0.25));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        for (const o of solids) {
          if (skip.has(o.id)) continue;        // neither endpoint is a wall
          const pen = o.r - Math.hypot(o.x - x, o.z - z);
          if (pen > worst) { worst = pen; worstId = o.id; }
        }
      }
    }
    return worst > 0.01
      ? `CLIPS ${worstId} by ${worst.toFixed(2)}m — WRONG`
      : 'clear of every solid — OK';
  }

  function stepCrew(dt) {
    for (const m of crew) {
      if (m.phase === 'travel') {
        m.u += dt / m.legT;
        let u = Math.min(1, m.u);
        const from = m.route[m.leg], to = m.route[m.leg + 1];
        m.obj.position.lerpVectors(from, to, u);
        const d = to.clone().sub(from);
        // the cast walks down +Z, so the heading is the leg's own bearing —
        // read off the path, never a second sign convention
        if (d.lengthSq() > 1e-8) m.obj.rotation.y = Math.atan2(d.x, d.z);
        // ...and a route is legs: finishing one starts the next at the same
        // pace, so a detour costs TIME rather than being run at double speed
        while (u >= 1 && m.leg < m.route.length - 2) {
          m.leg++;
          m.u = 0; u = 0;
          m.legT = Math.max(0.15,
            m.route[m.leg + 1].distanceTo(m.route[m.leg]) / Math.max(0.1, m.speed));
        }
        if (u >= 1) {
          m.at = m.to;
          if (m.at === STATION.cargo && cargo) {
            // INSIDE. It walks through the open doors and is gone — the study
            // is asking whether a person disappearing into a berth reads, and
            // a person standing politely in the doorway does not answer that.
            m.phase = 'inside';
            m.timer = P.dwell * (0.8 + m.rng() * 1.4);
            m.obj.visible = false;
            if (crewProbe) console.log(`CREWPROBE ${m.id} INSIDE the container for ${m.timer.toFixed(1)}s`);
          } else {
            m.phase = 'dwell';
            m.timer = P.dwell * (0.5 + m.rng());
            if (crewProbe) console.log(`CREWPROBE ${m.id} arrived ${m.at}, stands ${m.timer.toFixed(1)}s`);
          }
          // a body with an Idle clip STANDS rather than freezing mid-stride
          if (m.obj.userData.hasRun && m.obj.userData.setGait) m.obj.userData.setGait('idle');
          else if (m.obj.userData.setWalking) m.obj.userData.setWalking(false);
        }
      } else {
        m.timer -= dt;
        if (m.timer <= 0) { m.obj.visible = true; pickNext(m); }
      }
      if (m.obj.userData.tick && P.play) m.obj.userData.tick(dt);
    }
  }

  function hudLine() {
    if (performance.now() < flashUntil) return;   // a flash outlives the 0.25 s refresh
    if(P.path==='diorama'){const state=diorama.state();hud.textContent=state.errors.length?state.errors.join(' · '):`${state.ready?'STATION ACTIVE':'Loading station assets…'} · ${state.crew.length} crew · Walk / Run / Point / Kneel · metres, +Y up, +Z forward · Models by jelaludo`;return;}
    hud.textContent = astro
      ? `${clips.length} clip(s) · ${P.clip || '-'} · ${action ? (action.time % (action.getClip().duration || 1)).toFixed(2) : '0.00'} s · ${bones} bones`
        + ` · person ${P.personH.toFixed(2)} m · tank ${P.tankLen.toFixed(1)} m`
        + ` · RATIO ${(P.personH / Math.max(0.01, P.tankLen)).toFixed(3)}`
        + ` · ${P.path}${P.path === 'perimeter' ? ` r=${(tankR + P.clear).toFixed(2)} m (hull ${tankR.toFixed(2)} + ${P.clear.toFixed(2)})` : ''}`
        + (P.path === 'crew'
          ? ` · crew ${crew.map((m) => `${m.obj.userData.variant}${m.obj.userData.hasRun ? '' : '(walk-only)'}`).join(' + ') || '-'}`
            + ` · ${crew.map((m) => (m.phase === 'travel' ? m.gait : m.phase)).join(' / ') || '-'}`
            + ` · walk ${(P.stride * P.speed).toFixed(1)} m/s · run ${(P.stride * P.speed * P.runMul).toFixed(1)} m/s`
          : '')
      : 'loading astronaut.glb…';
  }

  const gui = new GUI({ title: 'ASTRO DIORAMA', container: root });
  const stationGui=gui.addFolder('station diorama');
  stationGui.add(diorama.settings,'count',0,60,1).name('station crew').onChange(()=>diorama.rebuild());
  for(const key of ['crew','stalheart','hugin','antenna'])stationGui.add(diorama.settings,key).name(key==='stalheart'?'Stålheart':key).onChange(()=>diorama.rebuild());
  stationGui.add(diorama.settings,'motion').name('animate station');
  stationGui.add(diorama.settings,'gait',['Auto','Idle','Walk','Run','Point','Kneel','Scared','Lie']).name('crew animation').onChange(()=>diorama.rebuild());
  const views={view:q.get('yard_view')||'Crew'};stationGui.add(views,'view',['Crew','Overview','Stalheart','Hugin','Antenna']).name('camera focus').onChange(v=>diorama.focus(v,camera,controls));
  const rendering={bloom:q.get('yard_bloom')!=='0',shadows:q.get('yard_shadows')!=='0'};renderer.shadowMap.enabled=rendering.shadows;
  stationGui.add(rendering,'shadows').onChange(v=>{renderer.shadowMap.enabled=v;});stationGui.add(rendering,'bloom');
  const legacy=gui.addFolder('legacy astronaut study');legacy.close();
  const clipCtrl = legacy.add(P, 'clip', ['-']).name('clip').onChange((v) => playClip(v));
  gui.add(P, 'play').onChange((v) => { if (action) action.paused = !v; });
  gui.add(P, 'speed', 0, 3, 0.05).onChange((v) => { if (mixer) mixer.timeScale = v; });
  legacy.add(P, 'loop').onChange(() => playClip(P.clip));
  gui.add(P, 'path', ['diorama', 'crew', 'perimeter', 'straight', 'spot'])
    .name('walk path').onChange(() => { syncMode(); });
  const gCrew = legacy.addFolder('crew wander');gCrew.close();
  gCrew.add(P, 'crew', 0, 4, 1).name('astronauts').onChange(() => buildCrew());
  gCrew.add(P, 'cast', ['mixed', ...ASTRONAUT_IDS]).name('cast').onChange(() => buildCrew());
  gCrew.add(P, 'runMul', 1, 4, 0.1).name('run x walk');
  gCrew.add(P, 'dwell', 0.2, 6, 0.1).name('dwell (s)');
  gCrew.add(P, 'crewSeed', 0, 999, 1).name('seed').onChange(() => buildCrew());
  gCrew.add(P, 'turret').name('turret').onChange(() => { buildProps(); syncMode(); });
  gCrew.add(P, 'cargo').name('container').onChange(() => { buildProps(); syncMode(); });
  gCrew.add(P, 'dish').name('70 m dish').onChange(() => { buildDish(); syncMode(); });
  gCrew.add(P, 'dishH', 5, 80, 1).name('dish height (m)').onChange(() => placeProps());
  gCrew.add(P, 'showSolids').name('show solid discs').onChange(() => { rebuildSolids(); });
  legacy.add(P, 'stride', 0.2, 4, 0.05).name('metres / s');
  legacy.add(P, 'personH', 0.4, 4, 0.05).name('person height (m)').onChange((v) => sizeAstro(v));
  gui.add(P, 'tankLen', 2, 20, 0.1).name('tank length (m)').onChange((v) => {sizeTank(v);diorama.rebuild();});
  legacy.add(P, 'clear', 0, 4, 0.05).name('clearance (m)').onChange(() => sizeTank(P.tankLen));
  gui.add(P, 'outline', 0, 1, 0.02).name('hull edge lines').onChange(() => dressCast());
  gui.add(P, 'exposure', 0.2, 2, 0.05).name('exposure').onChange((v) => { renderer.toneMappingExposure = v; });
  gui.add(P, 'env', 0, 3, 0.05).name('sky reflected').onChange((v) => { scene.environmentIntensity = v; });
  gui.add(P, 'spin').name('turntable');
  gui.add(P, 'tank').name('tank for scale').onChange((v) => { if (tank) tank.visible = v; });
  gui.add(P, 'wire').name('floor wire').onChange((v) => { if (grid) grid.visible = v; });
  legacy.add(P, 'scan').name('bones (skeleton)').onChange((v) => {
    if (v && astro && !astro.userData.skel) { astro.userData.skel = new THREE.SkeletonHelper(astro); scene.add(astro.userData.skel); }
    if (astro && astro.userData.skel) astro.userData.skel.visible = v;
  });
  // THE DEEP LINK. The ratio this study exists to settle is two numbers on
  // two sliders; without this the only way to carry them out of the tab is to
  // read them off a screenshot.
  let flashUntil = 0;
  wireDeepLink(root.querySelector('#astro-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'astro', params: {...P,...Object.fromEntries(Object.entries(diorama.settings).map(([k,v])=>['yard_'+k,v])),yard_view:views.view,yard_bloom:rendering.bloom,yard_shadows:rendering.shadows}, defaults: {...P0,...Object.fromEntries(Object.entries(yardDefaults).map(([k,v])=>['yard_'+k,v])),yard_view:'Crew',yard_bloom:true,yard_shadows:true},
    carry: location.search,
    // `clip` is chosen by the FILE, not by the panel — writing it into a link
    // pins a name that belongs to whatever .glb is loaded that day
    skip: ['clip'],
  }), { label: 'ASTRO', flash: (m) => { hud.textContent = m; flashUntil = performance.now() + 2200; } });

  const gear = root.querySelector('#astro-gear');
  if (gear) gear.addEventListener('click', () => { root.classList.toggle('panel-hidden'); });

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    postfx.setSize(w, h);
  }
  addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let hudT = 0;
  function animate() {
    if(disposed)return;frameId=requestAnimationFrame(animate);
    if (!active) return;
    const frameStart=perf.begin();
    const dt = Math.min(0.05, clock.getDelta());stageTime+=P.play?dt*P.speed:0;diorama.tick(stageTime);
    if (mixer && P.play && P.path!=='diorama') mixer.update(dt);
    // ROOT MOTION. The clip walks on the spot; the study carries the stage,
    // so the walk is judged as a walk and not as a treadmill.
    //
    // PERIMETER is the default (operator, 2026-09-05: "make the astronaut
    // walk around the perimeter of the tank, without touching it"): a circle
    // about the hull at its footprint radius plus a clearance, facing along
    // the tangent. The radius comes from the tank's own measured plan
    // diagonal, so it stays honest when either size slider moves — "without
    // touching it" has to hold at every ratio the sliders can make, not just
    // at the one it opens on.
    if (astro && P.play && P.path !== 'spot' && P.path!=='diorama') {
      walkT += dt * P.stride * P.speed;
      if (P.path === 'perimeter') {
        const R = tankR + Math.max(0, P.clear);
        const a = walkT / Math.max(0.2, R);          // arc length -> angle
        stage.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
        // the model walks down +Z, so the heading is the tangent's own
        // bearing — derived from the path, never a second sign convention
        stage.rotation.y = Math.atan2(Math.cos(a), -Math.sin(a));
      } else {
        stage.position.set(0, 0, ((walkT + 3) % 6) - 3);
        stage.rotation.y = 0;
      }
    } else if (P.path === 'spot') {
      stage.position.set(0, 0, 0);
    }
    if (P.path === 'crew') stepCrew(dt);
    if (P.spin) stage.rotation.y += dt * 0.4;
    controls.update();
    if(rendering.bloom)postfx.render();else renderer.render(scene,camera);perf.end(frameStart);
    hudT += dt; if (hudT > 0.25) { hudT = 0; hudLine(); }
  }
  function disposeAstro(){if(disposed)return;disposed=true;active=false;cancelAnimationFrame(frameId);removeEventListener('resize',resize);diorama.dispose();perf.dispose();for(const m of crew)m.obj.userData.dispose?.();mixer?.stopAllAction();if(astro)mixer?.uncacheRoot(astro);const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [o.material].flat().filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();controls.dispose();gui.destroy();postfx.dispose();environment.dispose();pmrem.dispose();sky.dispose();renderer.dispose();renderer.domElement.remove();}
  syncMode();animate();
  if(q.get('acceptance')==='1')window.__stalheartAstroTest={dispose:disposeAstro,state:()=>({...diorama.state(),performance:perf.state(),mode:P.path,disposed}),count:n=>{diorama.settings.count=n;diorama.rebuild();},toggle:(key,on)=>{diorama.settings[key]=on;diorama.rebuild();},focus:v=>diorama.focus(v,camera,controls),motion:on=>{diorama.settings.motion=on;}};

  return {
    setActive(on) { active = on; if (on) { resize(); clock.getDelta();perf.reset(); } },
    dispose:disposeAstro,
  };
}
