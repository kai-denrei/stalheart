import { DEFAULT_TANK } from './content/tank.js';
// beam-tab.js — THE BEAM LAB, inside our own world.
//
// lab-satisfying-lasers tunes a beam against a neutral stage: near-black
// background, ACES filmic tone mapping, exposure 1. This board has none of
// that — no tone mapping is set anywhere in the project — and the recipe is
// explicit that without it "the same values just clip flat". So a preset that
// sings in the lab has no guarantee of surviving the trip.
//
// Rather than guess the translation, tune it HERE: the game's own light rig,
// the game's bloom chain, the game's look registry, and the actual mkcx with
// its real gun tubes. What you see is what the tank will do.
//
// The one control the lab does not have, and the reason this tab exists:
// TONE MAPPING. Toggle it and watch the whole frame re-grade. That is the
// decision the beam spec is blocked on, and it is an eye decision.
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import GUI from '../vendor/lil-gui.esm.js';
// DEFAULTS only: the meshes are the rig's now (beamdraw.js), and this file
// no longer calls createBeam directly.
import { DEFAULTS } from './beamfx.js';
import { makeBloom } from './postfx.js';
import { LOOKS } from './looks.js';
import { buildCreature, preloadMork, SECONDARY_TOE,
  applySecondaryToe, secondaryPivots } from './units.js';
import { BEAM_STEPS, beamStep } from './beamranks.js';
import { arcPoint, projectToArc, toeForCrossing, crossingForToe } from './arc.js';
import { burnReport, sweepAdvance } from './beamburn.js';
import { createBeamRig, PLASMA_DEFAULTS } from './beamdraw.js';
import { SAFE_HUES, ALARM_HUES } from './enemyspec.js';
import { deepLink, wireDeepLink } from './deeplink.js';

// the heat clock the secondary actually runs on, mirrored from td-tab so the
// envelope tuned here is the envelope the weapon will fire
const LASER_MAX_HEAT = 2.4;
const LASER_COOL = 1.4;

export function initBeamTab(root) {
  let active = false;
  const container = root.querySelector('#beam-app');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.005, 400);
  // ...positioned after LAB_R exists: the stage is a sphere now and the old
  // origin-facing camera sat INSIDE it, looking at the far wall of a shell.

  // THE GAME'S LIGHT RIG, not an inspection rig. A beam tuned under gentle
  // studio light will be wrong the moment it fires on the board.
  const hemi = new THREE.HemisphereLight(0xc8cfe0, 0x555060, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8c8, 0.25);
  scene.add(sun);   // aimed once the stage's radius is known

  const postfx = makeBloom(renderer, scene, camera, {});
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // --- the stage: a piece of the actual PLANET ----------------------------
  //
  // This was a flat slab, and that was fine while the beam was 2.6 cells long
  // and a straight chord floated a quarter of a cell off the ground. It is
  // not fine now: reach climbs to 10 cells with rank, the beam follows a
  // great circle, and a flat stage cannot show the one thing a tuning session
  // most needs to see — whether the beam HUGS.
  //
  // ONE WORLD UNIT IS ONE CELL here, and the sphere carries the board's own
  // curvature: the game runs a unit sphere with cellSide 0.08, so its radius
  // is 1/0.08 = 12.5 cells. Same ratio, bigger numbers, nothing to convert.
  const LAB_R = 12.5;
  const world = new THREE.Group();
  scene.add(world);
  const floor = new THREE.Mesh(
    new THREE.SphereGeometry(LAB_R, 96, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b1016, roughness: 0.95, metalness: 0.05 }));
  world.add(floor);

  // THE RULER. Not a grid — a grid on a sphere is a projection argument. Rings
  // at whole-cell distances from where the tank stands, so the reach of the
  // beam can be READ OFF THE GROUND in the same unit the game talks in. Every
  // fifth ring is brighter, because counting to ten in the dark is a chore.
  function ringAt(cells, bright) {
    const s = cells / LAB_R;                 // cells -> radians on this sphere
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      // a circle of constant arc distance about the pole
      const r = Math.sin(s), y = Math.cos(s);
      pts.push(new THREE.Vector3(Math.cos(a) * r * LAB_R, y * LAB_R, Math.sin(a) * r * LAB_R));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(g, new THREE.LineBasicMaterial({
      color: bright ? 0x00d0ff : 0x0a3a4a, transparent: true,
      opacity: bright ? 0.55 : 0.35,
    }));
  }
  const rings = new THREE.Group();
  for (let c = 1; c <= 12; c++) rings.add(ringAt(c, c % 5 === 0));
  world.add(rings);

  // Now that the pole is a real place, put the camera and the key light over
  // it. Behind and above the tank, looking a couple of cells down range —
  // the angle a player actually watches the weapon from.
  camera.position.set(3.6, LAB_R + 2.4, -5.2);
  sun.position.set(3, LAB_R + 5, 2);
  controls.target.set(0, LAB_R, 2.2);
  controls.update();

  let tank = null, gunL = null, gunR = null;
  function buildTank(lookName) {
    if (tank) { world.remove(tank); tank = null; gunL = gunR = null; }
    // buildCreature takes the look's COLOUR set, not the whole look record —
    // the same two keys every other caller in this project passes
    const L = LOOKS[lookName] || LOOKS.tronColors;
    tank = buildCreature(DEFAULT_TANK, { walker: L.walker ?? 0x9fdcff,
      walkerHi: L.walkerHi ?? 0xffffff });
    // 0.85 of a cell, which is what the board runs — the lab used 1.0 while a
    // cell meant nothing here, and now it means something.
    tank.scale.setScalar(0.85);
    tank.position.set(0, LAB_R, 0);   // standing at the pole; +Z is a tangent
    world.add(tank);
    const guns = tank.userData && tank.userData.laserGuns;
    if (guns && guns.length >= 2) { [gunL, gunR] = guns; }
  }
  buildTank('tronColors');
  preloadMork().then(() => { buildTank(P.look); applyToe(); });  // swap in when the bytes land

  // --- the two beams -------------------------------------------------------
  // Each one belongs to a gun: it leaves that gun's muzzle and runs straight
  // down that gun's own barrel. Both the origin and the direction come from
  // the gun's world transform — the standing rule here, and the trap this
  // project has hit three times. Whether they converge is then the toe-in's
  // business, not the beam code's.
  // THE WIDTHS ARE THE BOARD'S, VERBATIM.
  //
  // They used to be lab-scaled — glowWidth 0.055 against beamfx's own 0.47 —
  // because this stage measured in arbitrary world units and the tank was one
  // of them. One unit is one CELL now, which is exactly the unit the game's
  // BEAM_PRESET is written in, so the scaling is not merely unnecessary, it
  // was making the beam eighteen times too thin to see. These are td-tab's
  // numbers, copied across as the numbers they are.
  const WORLD_SCALED = {
    glowWidth: 1.0,
    coreWidth: 0.06,
    jitterAmount: 0.19,
    // The stage opens on the beam a rank-1 pilot actually fires. beamfx's
    // own default glow is #006d8f — which is now the RANK 5 colour, so
    // leaving it would have shown a silver-tier beam and called it the base.
    glowColor: BEAM_STEPS[0].color,
  };
  // Length is measured in CELLS now, on both surfaces. The lab used to scale
  // a world-unit slider by the step's reach relative to rank 1 and note in a
  // comment that the absolute number was the lab's own — an honest fudge that
  // stopped being necessary the moment one unit became one cell.

  const P = {
    ...DEFAULTS,
    ...WORLD_SCALED,
    // --- the world side, which the lab has no way to show you -------------
    look: 'tronColors',
    toneMapping: 'none',        // THE decision the beam spec is blocked on
    exposure: 1.0,
    bloom: true,
    bloomStrength: 0.3,
    bgBrightness: 0.015,
    // --- the envelope the operator specified ------------------------------
    envelope: 'bell',           // bell = 0 -> peak -> 0 across one burst
    peakIntensity: 8.0,
    burstSeconds: LASER_MAX_HEAT,
    // REACH, IN CELLS — the game's own unit, on the game's own curvature.
    // Free to drag, because the operator asked to test lengths and not only
    // the four the ladder hands out; the rank picker writes it too.
    reachCells: BEAM_STEPS[0].reach,
    muzzleNudge: 0.0,           // seat the origin exactly at the tip
    // (levelBeams is gone: the direction is projected onto the tangent plane
    // ALWAYS, because the board has no other answer on a sphere and a
    // non-tangent direction is not something arcPoint is defined for.)
    // THE SWEEP. Across one burst the toe-in runs 0 -> amplitude -> 0, so the
    // pair opens parallel, scissors inward to the midpoint and opens again —
    // the beams sweeping the ground in front rather than sitting in one line.
    // THE SWEEP IS A MODE now (operator, 2026-09-02: "I want the ability to
    // set the sweep to be automatic, stop the sweep, or manually adjust").
    // A boolean could only say on/off, and the whole reason to want it off is
    // to hold the pair still and see what the OTHER variables are doing.
    //   auto   — the bell: 0 -> amplitude -> 0 across the burst
    //   off    — no swing at all; the barrels sit at the solved toe
    //   manual — frozen at `sweepManual`, for looking at one angle
    sweepMode: 'auto',
    sweepAmplitude: 0.20,       // radians of inward swing at the peak (auto)
    sweepManual: 0.0,           // ...or held here, in manual
    rankStep: BEAM_STEPS[0].minRank,   // which of the four beams is on the stage
    // --- the drop-off bench -----------------------------------------------
    targets: 4,              // invincible bodies laid down the hull centreline
    targetStart: 1.5,        // cells to the first one
    targetGap: 1.4,          // cells between them
    targetSize: 0.5,         // their `size` in the game's sense; radius is 0.8x
                             // (0.4-0.55 is the board's whole roster, and a
                             //  body bigger than the tank hides the beam)
    targetMix: 'alternate',  // which of them are the solid, unrammable tier
    // LATERAL OFFSET (operator, 2026-09-02). Down the centreline both beams
    // see the same bodies, both bog identically, and the pair never falls out
    // of step — so the one readout the drag mechanic exists for is invisible
    // on the bench built to show it. Push the row sideways and one beam eats
    // the line while the other runs clear.
    targetSide: 0.0,         // cells across, + toward the right-hand gun
    targetStagger: 0.0,      // ...and this much MORE per body, so the row can
                             //  be walked diagonally through the pair
    spread: 1.0,                // how far apart the emitters read
    toeIn: SECONDARY_TOE,       // the manual angle, when the solve is off
    toeAuto: true,              // solve the toe from the reach instead
    crossFrac: 0.7,             // ...so the pair meets at this much of it
    autoFire: true,
    copyPreset: () => copyPreset(),
    downloadPreset: () => {
      // ...because "copied to the clipboard" is invisible, and a preset you
      // cannot find later is a preset you did not save
      const blob = new Blob([presetJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement('a');
      a2.href = url;
      a2.download = `beam-in-world-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a2); a2.click(); a2.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash('saved .json');
    },
    reset: () => { Object.assign(P, DEFAULTS, WORLD_SCALED); gui.controllersRecursive().forEach((c) => c.updateDisplay()); },
  };
  // THE PANEL, FROM THE URL. One generic pass over every knob the panel
  // owns, so a deep link can put the lab back exactly where it was — the
  // link button below is only honest if the address it writes is an address
  // this lab reads. Named parameters with their own meaning (?sweepmode, ?sweepat, ?labside, ?labstagger) keep
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


  // THE SAME RIG THE BOARD DRAWS (beamdraw.js): a chained arc root plus a
  // plasma plume, not two straight ribbons. The lab used to build its own
  // pair, which is exactly how a tuning surface ends up describing a weapon
  // that no longer exists.
  const PLASMA = { ...PLASMA_DEFAULTS };
  const rig = createBeamRig({
    scene, guns: 2, preset: P, plasma: PLASMA, seed: 0x91a5be,
    // Widths are in CELLS on the board and one unit IS a cell here, so the
    // rig's scale is 1 and the preset transfers across untouched — but the
    // KEYS still have to be named, or the rig never touches them and the
    // muzzle taper silently does nothing. An empty list here cost a round of
    // "why is the root still fat".
    widthKeys: ['coreWidth', 'glowWidth', 'jitterAmount'],
  });

  // --- THE TARGETS (operator, 2026-09-02) ---------------------------------
  // "adding invincible enemies to test the drop off."
  //
  // INVINCIBLE on purpose: the drop-off is a standing shape you want to look
  // at and adjust, and bodies that die rearrange it every two seconds. These
  // never lose hp, so the beam's choked length holds still while the sliders
  // move.
  //
  // Colour carries the rammable read, because that is the board's own rule
  // (enemyspec.js: white/grey/yellow/blue are safe, the alarm belts are not)
  // and the whole point of the drop-off is that the two tiers cost different
  // amounts. Reached bodies light up; the ones the beam never gets to go
  // dark, which is the readout that matters — what is behind armour is never
  // reached.
  const SOFT_COL = SAFE_HUES.blue, HARD_COL = ALARM_HUES.purple;
  const targetGroup = new THREE.Group();
  world.add(targetGroup);
  let targets = [];      // [{ mesh, mat, t (cells), hard }]

  function mixAt(i, n, mix) {
    if (mix === 'all rammable') return false;
    if (mix === 'all solid') return true;
    if (mix === 'solid first') return i === 0;
    if (mix === 'solid last') return i === n - 1;
    return i % 2 === 1;                     // alternate
  }

  function buildTargets() {
    for (const t of targets) {
      targetGroup.remove(t.mesh);
      t.mesh.geometry.dispose(); t.mesh.material.dispose();
    }
    targets = [];
    const n = Math.round(P.targets);
    for (let i = 0; i < n; i++) {
      const hard = mixAt(i, n, P.targetMix);
      // the game's own hit radius: cellSide * max(0.4, size*0.8), and a cell
      // is one unit here
      const r = Math.max(0.4, P.targetSize * 0.8);
      const mat = new THREE.MeshStandardMaterial({
        color: hard ? HARD_COL : SOFT_COL, roughness: 0.6, metalness: 0.1,
        emissive: hard ? HARD_COL : SOFT_COL, emissiveIntensity: 0.04,
        transparent: true, opacity: 0.5,
      });
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
      targetGroup.add(mesh);
      targets.push({
        mesh, mat, hard, r,
        t: P.targetStart + i * P.targetGap,
        side: P.targetSide + i * P.targetStagger,
      });
    }
    placeTargets();
  }

  // Down the HULL's centreline, not down a gun's — the guns sweep, and a
  // line-up that swings with them is a line-up you cannot read. The sweep
  // scissoring ACROSS a fixed row is the thing worth watching.
  const hullFrom = [0, 1, 0];
  const hullDir = [0, 0, 1];
  function placeTargets() {
    for (const t of targets) {
      // Walk down the centreline, then step sideways along the great circle
      // that leaves THAT point at right angles. A lateral offset added as a
      // straight vector would lift the body off the sphere, and the beam's
      // own hit test counts altitude as being out of the beam — so a body
      // nudged sideways would quietly stop being hittable at all.
      const sRad = t.t / LAB_R;
      const base = arcPoint(hullFrom, hullDir, sRad);
      const c = Math.cos(sRad), n = Math.sin(sRad);
      const fwd = [
        hullDir[0] * c - hullFrom[0] * n,
        hullDir[1] * c - hullFrom[1] * n,
        hullDir[2] * c - hullFrom[2] * n,
      ];
      const right = [
        base[1] * fwd[2] - base[2] * fwd[1],
        base[2] * fwd[0] - base[0] * fwd[2],
        base[0] * fwd[1] - base[1] * fwd[0],
      ];
      const q = t.side ? arcPoint(base, right, t.side / LAB_R) : base;
      // seat it on the surface, lifted by its own radius so it sits ON the
      // ground rather than half-buried in it
      const lift = LAB_R + t.r * 0.6;
      t.mesh.position.set(q[0] * lift, q[1] * lift, q[2] * lift);
    }
  }

  // Same rule as the model fix-up: inward is decided by the turret's own
  // side, never by its name.
  // --- the preset, and saying so ------------------------------------------
  function presetJson() {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = P[k];
    return JSON.stringify({
      schema: 'laserfx/1',
      id: 'beam-in-world',
      generatedAt: new Date().toISOString(),
      beam: out,
      // the world side is part of the preset HERE in a way it was not in the
      // lab: this beam's look depends on tone mapping and bloom
      world: {
        toneMapping: P.toneMapping, exposure: P.exposure,
        bloom: P.bloom, bloomStrength: P.bloomStrength,
        bgBrightness: P.bgBrightness, look: P.look,
      },
      weapon: {
        envelope: P.envelope, peakIntensity: P.peakIntensity,
        burstSeconds: P.burstSeconds, reachCells: P.reachCells,
        toeIn: P.toeIn, muzzleNudge: P.muzzleNudge,
      },
    }, null, 2);
  }

  // FEEDBACK, because a silent copy is indistinguishable from a broken one —
  // which is exactly how the operator experienced the first version.
  let flashT = 0, flashMsg = '';
  function flash(msg) { flashMsg = msg; flashT = 2.0; }

  // THE DEEP LINK. The beam lab's whole output is a preset — the copy button
  // hands it to the code, this hands the same state to a person.
  wireDeepLink(root.querySelector('#beam-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'beam', params: P, defaults: P0, carry: location.search,
  }), { label: 'BEAM', flash });

  function copyPreset() {
    const json = presetJson();
    const ok = () => { flash('preset copied to clipboard'); console.log('BEAMLAB preset:\n' + json); };
    const fail = (why) => {
      // clipboard can refuse on an unfocused document; the textarea route
      // still works there, and the console always has it either way
      try {
        const ta = document.createElement('textarea');
        ta.value = json; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const done = document.execCommand('copy');
        ta.remove();
        flash(done ? 'preset copied (fallback)' : 'copy refused — see console');
      } catch { flash('copy refused — see console'); }
      console.log(`BEAMLAB preset (clipboard ${why}):\n` + json);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(ok, () => fail('refused'));
    else fail('unavailable');
  }

  // ONE implementation of the sign convention (units.js). It used to be
  // copied here, which is two copies of a rule this project has already got
  // wrong once — the authored model gives BOTH pivots the same yaw, so one
  // toed in and the other out, and the pair never converged.
  let toeInfo = null;
  function applyToe(angle) {
    if (!tank) return;
    applySecondaryToe(tank, angle === undefined ? P.toeIn : angle);
  }

  // THE TOE THAT MAKES THEM CROSS (operator: "the toe-in should scale with
  // reach so they always cross"). A fixed angle crosses at a fixed DISTANCE,
  // so across the ladder's 2.5x reach range the meeting point lands anywhere
  // from three quarters of the beam to under a third of it.
  //
  // Measure the gap with the toe ZEROED — the world transforms already carry
  // whatever angle was applied last, so measuring without resetting feeds the
  // previous answer back in and the angle walks every frame.
  //
  // ONE TERM OWNS THE CROSSING (operator, 2026-09-02: "I think the cross
  // calculations might be interfering" — they were, measurably).
  //
  // The static toe and the sweep BOTH swing the beams inward, and they were
  // solved and set independently. Measured: a toe solved for a crossing at
  // 2.80 cells, plus a sweep amplitude of 0.20 rad, actually crossed at 1.00
  // — the sweep was nearly twice the larger term, so the number the solve
  // asked for was true only at the two instants the swing passed zero.
  //
  // The rule now: the pair crosses at `crossFrac x reach` AT ITS MOST
  // CONVERGED MOMENT, and the mode decides which term carries it.
  //
  //   auto   the SWEEP carries it. The static toe goes to zero, so the pair
  //          leaves the muzzles parallel, scissors in to meet at the target
  //          at the midpoint, and opens again — which is what the sweep was
  //          described as doing before a static toe was added underneath it.
  //   manual the static toe carries whatever the frozen swing does not.
  //   off    the static toe carries all of it.
  let solvedAmp = null;
  function applyReachToe() {
    if (!tank) return;
    const pivots = secondaryPivots(tank);
    if (!P.toeAuto || pivots.length < 2) {
      applyToe(P.toeIn); toeInfo = null; solvedAmp = null; return;
    }
    // IT IS A FIXED POINT, NOT A ONE-SHOT SOLVE.
    //
    // aimGun seats the origin at the barrel TIP (gunTipZ + muzzleNudge), not
    // at the pivot — and rotating a pivot MOVES its tip, so the muzzle gap
    // depends on the toe that the gap is being used to compute. Solving once
    // from the zero-toe gap over-estimates it and lands the crossing short:
    // measured, 2.41 cells against the 2.80 asked for.
    //
    // Three iterations converge to well under a hundredth of a cell. The
    // board does NOT need this — its beam origin is the pivot's own world
    // position, which a rotation about that pivot does not move.
    const target = P.crossFrac * P.reachCells;
    let total = 0, toe = 0, gap = 0;
    for (let it = 0; it < 3; it++) {
      const A0 = aimGun(0), B0 = aimGun(1);
      if (!A0 || !B0) { applyToe(P.toeIn); toeInfo = null; solvedAmp = null; return; }
      gap = Math.hypot(A0.from[0] - B0.from[0], A0.from[1] - B0.from[1],
        A0.from[2] - B0.from[2]) * LAB_R;         // unit-frame -> cells
      total = toeForCrossing(gap, target) || P.toeIn;
      // split `total` between the two terms according to the mode
      toe = P.sweepMode === 'auto' ? 0
        : P.sweepMode === 'manual' ? Math.max(0, total - P.sweepManual)
          : total;
      applySecondaryToe(tank, toe);
      tank.updateMatrixWorld(true);
    }
    solvedAmp = P.sweepMode === 'auto' ? total : null;
    toeInfo = {
      gap, toe, total, at: crossingForToe(gap, total),
      carriedBy: P.sweepMode === 'auto' ? 'sweep'
        : P.sweepMode === 'manual' ? 'toe+manual swing' : 'toe',
    };
  }

  function applyWorld() {
    const bg = P.bgBrightness;
    scene.background = new THREE.Color(bg, bg, bg * 1.15);
    renderer.toneMapping = P.toneMapping === 'aces' ? THREE.ACESFilmicToneMapping
      : P.toneMapping === 'reinhard' ? THREE.ReinhardToneMapping
        : THREE.NoToneMapping;
    renderer.toneMappingExposure = P.exposure;
    // a material compiled under one tone mapping must be told the rule changed
    scene.traverse((o) => { if (o.isMesh && o.material) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
    } });
    postfx.setEnabled(P.bloom);
    postfx.setParams({ strength: P.bloomStrength });
  }
  applyWorld();

  // --- the panel ----------------------------------------------------------
  const gui = new GUI({ title: 'BEAM', container: root });
  const gw = gui.addFolder('world (what the lab cannot show you)');
  gw.add(P, 'look', Object.keys(LOOKS)).onChange((v) => buildTank(v));
  gw.add(P, 'toneMapping', ['none', 'aces', 'reinhard']).onChange(applyWorld);
  gw.add(P, 'exposure', 0.1, 3, 0.01).onChange(applyWorld);
  gw.add(P, 'bloom').onChange(applyWorld);
  gw.add(P, 'bloomStrength', 0, 2, 0.01).onChange(applyWorld);
  gw.add(P, 'bgBrightness', 0, 0.3, 0.005).onChange(applyWorld);
  gw.open();

  const ge = gui.addFolder('envelope (the weapon, not the lab)');
  ge.add(P, 'envelope', ['bell', 'hold', 'lab']);
  ge.add(P, 'peakIntensity', 0, 12, 0.05);
  ge.add(P, 'burstSeconds', 0.4, 6, 0.1);
  ge.add(P, 'autoFire');
  ge.open();

  const gg = gui.addFolder('geometry');
  gg.add(P, 'reachCells', 0.5, 14, 0.1).name('reach (cells)');
  gg.add(P, 'muzzleNudge', -0.5, 0.5, 0.005).name('muzzle offset');
  gg.add(P, 'spread', 0.2, 3, 0.05);
  gg.add(P, 'toeAuto').name('toe solves for crossing');
  gg.add(P, 'crossFrac', 0.2, 1.2, 0.01).name('cross at (x reach)');
  gg.add(P, 'toeIn', 0, 0.8, 0.005).name('manual toe-in').onChange(() => applyToe());
  gg.add(P, 'sweepMode', ['auto', 'off', 'manual']).name('sweep');
  gg.add(P, 'sweepAmplitude', 0, 0.8, 0.005).name('sweep amplitude (auto)');
  gg.add(P, 'sweepManual', 0, 0.8, 0.005).name('sweep angle (manual)');
  // THE RANK PICKER. Colour and reach are the pilot's rank on the board now
  // (beamranks.js), so a lab that only ever showed one of the four steps was
  // a lab lying about three quarters of the weapon. Both transfer EXACTLY
  // now — colour was always unit-free, and reach is in cells on both sides.
  gg.add(P, 'rankStep', BEAM_STEPS.map((b) => b.minRank))
    .name('rank step (1/5/10/15)')
    .onChange((r) => {
      const st = beamStep(Number(r));
      P.glowColor = st.color;
      P.reachCells = st.reach;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });
  gg.open();

  // --- the drop-off bench ---------------------------------------------------
  // The mechanic that had no surface until now: the beam pierces, but every
  // body it passes through eats its remaining reach, so it SHORTENS into a
  // crowd. Lay bodies down the centreline and watch where it dies.
  const gt = gui.addFolder('targets (invincible)');
  gt.add(P, 'targets', 0, 8, 1).name('how many').onChange(buildTargets);
  gt.add(P, 'targetStart', 0.4, 8, 0.1).name('first at (cells)').onChange(buildTargets);
  gt.add(P, 'targetGap', 0.3, 4, 0.1).name('gap (cells)').onChange(buildTargets);
  gt.add(P, 'targetSize', 0.3, 2, 0.05).name('body size').onChange(buildTargets);
  gt.add(P, 'targetMix', ['alternate', 'all rammable', 'all solid',
    'solid first', 'solid last']).name('which are solid').onChange(buildTargets);
  gt.add(P, 'targetSide', -3, 3, 0.05).name('offset across (cells)').onChange(buildTargets);
  gt.add(P, 'targetStagger', -1, 1, 0.02).name('...+ per body').onChange(buildTargets);
  gt.open();
  buildTargets();

  // The plume's shape — the other half of the weapon, and pure taste.
  const gpl = gui.addFolder('plasma');
  gpl.add(PLASMA, 'coreFrac', 0, 1, 0.01).name('hot root length');
  gpl.add(PLASMA, 'dots').name('dots on');
  gpl.add(PLASMA, 'plumeLen', 0, 1, 0.01).name('dots length (x beam)');
  gpl.add(PLASMA, 'plumeWidth', 0, 5, 0.05).name('dots width (x beam)');
  gpl.add(PLASMA, 'coreRoot', 0.05, 1, 0.01).name('width at muzzle');
  gpl.add(PLASMA, 'squash', 0, 1.5, 0.05).name('vertical squash');
  gpl.add(PLASMA, 'flow', 0, 6, 0.05).name('flow speed');
  gpl.add(PLASMA, 'bias', 0.5, 3, 0.05).name('root density');
  gpl.add(PLASMA, 'twist', 0, 24, 0.5).name('corkscrew');
  gpl.add(PLASMA, 'size', 1, 8, 0.1).name('dot size');
  gpl.close();

  const gc = gui.addFolder('core');
  gc.addColor(P, 'coreColor');
  gc.add(P, 'coreWidth', 0.001, 0.30, 0.0005);
  gc.add(P, 'coreIntensity', 0, 8, 0.05);
  const gl = gui.addFolder('glow');
  gl.addColor(P, 'glowColor');
  gl.add(P, 'glowWidth', 0.004, 1.20, 0.002);
  gl.add(P, 'glowIntensity', 0, 8, 0.05);
  gl.add(P, 'glowFalloff', 0.5, 8, 0.05);
  const gp = gui.addFolder('caps');
  gp.add(P, 'capStart', 0, 0.4, 0.005);
  gp.add(P, 'capEnd', 0, 0.4, 0.005);
  gp.add(P, 'blast', 0, 6, 0.05);
  const gi = gui.addFolder('interference');
  gi.add(P, 'scrollSpeed', -8, 8, 0.05);
  gi.add(P, 'noiseScale', 0.5, 40, 0.1);
  gi.add(P, 'noiseAmount', 0, 1, 0.01);
  gi.add(P, 'flicker', 0, 1, 0.01);
  const gj = gui.addFolder('instability');
  gj.add(P, 'jitterAmount', 0, 0.40, 0.0005);
  gj.add(P, 'jitterFreq', 1, 200, 1);
  gui.add(P, 'copyPreset').name('⧉ copy preset');
  gui.add(P, 'downloadPreset').name('⇩ save .json');
  gui.add(P, 'reset').name('reset to lab defaults');

  // --- the heat clock -----------------------------------------------------
  // One burst is a BELL over the heat budget: 0 at both ends, peak at the
  // midpoint, then a lockout that cools at the game's rate. Tuning the shape
  // here is tuning the weapon, not a preview of it.
  let heat = 0, firing = true, lock = false;
  function envelope(dt) {
    if (P.envelope === 'hold') return 1;
    if (P.envelope === 'lab') return undefined;      // let beamfx run its own
    if (!P.autoFire) { heat = LASER_MAX_HEAT * 0.5; return 1; }
    if (lock) {
      heat = Math.max(0, heat - LASER_COOL * dt);
      if (heat === 0) { lock = false; firing = true; }
      return 0;
    }
    heat += dt;
    if (heat >= P.burstSeconds) { lock = true; return 0; }
    const x = heat / P.burstSeconds;                 // 0..1 across the burst
    return Math.sin(x * Math.PI);                    // 0 -> 1 -> 0
  }

  // The rig takes the burst FRACTION and applies the bell itself (it is the
  // same bell the board runs), where envelope() above returns the bell's
  // VALUE for the lab's own uniform pushes. Two shapes of the same number —
  // handing the rig the value would square the bell and the beam would sit
  // dim through most of a burst.
  function heatFrac() {
    if (P.envelope !== 'bell' || !P.autoFire) return 0.5;   // 0.5 -> sin = 1
    return Math.min(1, heat / Math.max(0.001, P.burstSeconds));
  }

  // --- aiming: out of the muzzle, straight down the barrel ----------------
  //
  // NOT a shared apex. Each beam leaves its own gun's TIP and continues along
  // that gun's OWN world direction; the inverted V is then a consequence of
  // the toe-in rather than something imposed on top of it. Forcing both beams
  // onto one computed apex point was drawing a shape the guns were not making,
  // which is the same class of mistake as re-deriving a heading instead of
  // reading the transform.
  //
  // No flattening either. The gun pivots carry a real pitch (~10 degrees on
  // this model) and the beam should follow the barrel it comes out of.
  const tipLocal = new WeakMap();
  const bb = new THREE.Box3();
  function gunTipZ(pivot) {
    // MÖRK exposes authored muzzle sockets, already at the barrel tip.
    if(tank.userData.asset===DEFAULT_TANK&&tank.userData.laserGuns.includes(pivot))return 0;
    if (tipLocal.has(pivot)) return tipLocal.get(pivot);
    // the +Z extent of the gun's own subtree, in the pivot's local frame:
    // measured off the model rather than guessed at as an offset
    pivot.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
    bb.makeEmpty();
    pivot.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      o.updateWorldMatrix(true, false);
      const g2 = o.geometry.clone();
      g2.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      g2.computeBoundingBox();
      bb.union(g2.boundingBox);
      g2.dispose();
    });
    const z = Number.isFinite(bb.max.z) ? bb.max.z : 0.5;
    tipLocal.set(pivot, z);
    return z;
  }

  const tmpP = new THREE.Vector3(), tmpQ2 = new THREE.Quaternion();
  const vunit = (v) => { const L = Math.hypot(v.x, v.y, v.z) || 1; return [v.x / L, v.y / L, v.z / L]; };
  const dot3 = (a2, b2) => a2[0] * b2[0] + a2[1] * b2[1] + a2[2] * b2[2];
  const norm3 = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  const cross3 = (a2, b2) => [a2[1] * b2[2] - a2[2] * b2[1],
    a2[2] * b2[0] - a2[0] * b2[2], a2[0] * b2[1] - a2[1] * b2[0]];

  // WHERE A GUN FIRES FROM AND TOWARD, on the sphere.
  //
  // Both come from the gun's own world transform — the standing rule here,
  // and the trap this project has hit three times. The direction is then
  // projected onto the TANGENT PLANE, always, with no toggle: the board has
  // no other sane answer on a sphere, and a lab option that produced a
  // non-tangent direction would feed arcPoint a vector it is not defined for
  // and draw a curve the weapon cannot make.
  function aimGun(g) {
    const pivot = g === 0 ? gunL : gunR;
    if (pivot) {
      tmpP.set(0, 0, gunTipZ(pivot) + P.muzzleNudge);
      pivot.localToWorld(tmpP);
      const from = vunit(tmpP);
      // ...and the muzzle's own RADIUS. Projecting `from` onto the sphere and
      // then lifting by the stage radius put the beam on the GROUND while the
      // guns sat above it — the operator's screenshot, exactly: plasma
      // emerging from under the hull instead of out of the secondaries.
      const r = tmpP.length();
      pivot.getWorldQuaternion(tmpQ2);
      tmpP.set(0, 0, 1).applyQuaternion(tmpQ2);
      const d0 = [tmpP.x, tmpP.y, tmpP.z];
      return { from, r, dir: norm3([d0[0] - from[0] * dot3(d0, from),
        d0[1] - from[1] * dot3(d0, from), d0[2] - from[2] * dot3(d0, from)]) };
    }
    if (!tank) return null;
    // procedural fallback has no gun pivots: two emitters at the hull front
    tmpP.set((g === 0 ? -0.18 : 0.18) * P.spread, 0.22, 0.35);
    tank.localToWorld(tmpP);
    const from = vunit(tmpP);
    const r = tmpP.length();
    tank.getWorldQuaternion(tmpQ2);
    tmpP.set(0, 0, 1).applyQuaternion(tmpQ2);
    const d0 = [tmpP.x, tmpP.y, tmpP.z];
    return { from, r, dir: norm3([d0[0] - from[0] * dot3(d0, from),
      d0[1] - from[1] * dot3(d0, from), d0[2] - from[2] * dot3(d0, from)]) };
  }

  // Swing a beam inward by its own phase, toward the hull's centreline —
  // which way "inward" is comes from the gun's own offset from the hull,
  // never from its L/R name.
  function swingDir(from, dir, swing) {
    if (!(swing > 1e-4)) return dir;
    const right = norm3(cross3(from, dir));
    const lat = [from[0] - hullFrom[0], from[1] - hullFrom[1], from[2] - hullFrom[2]];
    const d = dot3(lat, from);
    const latT = [lat[0] - from[0] * d, lat[1] - from[1] * d, lat[2] - from[2] * d];
    const sgn = dot3(latT, right) > 0 ? -1 : 1;
    const c = Math.cos(swing), n = Math.sin(swing) * sgn;
    return norm3([dir[0] * c + right[0] * n, dir[1] * c + right[1] * n,
      dir[2] * c + right[2] * n]);
  }

  function pushParams(alpha) {
    for (const beam of rig.beams) {
      for (const k of Object.keys(DEFAULTS)) {
        const u = beam.uniforms['u' + k[0].toUpperCase() + k.slice(1)];
        if (!u) continue;
        if (u.value && u.value.isColor) u.value.set(P[k]);
        else u.value = P[k];
      }
      // the envelope drives INTENSITY, not opacity: the operator specified a
      // 0 -> 8 -> 0 intensity ramp, and under bloom the two read differently
      const gi2 = beam.uniforms.uGlowIntensity;
      if (gi2 && alpha !== undefined) gi2.value = P.peakIntensity * alpha;
      if (alpha !== undefined) beam.setAlpha(alpha > 0 ? 1 : 0);
    }
    rig.color.set(P.glowColor);
  }

  // --- the burn, run on the SAME rule the board runs (beamburn.js) --------
  const beamPhase = [0, 0];
  // BOTH beams, because the whole point of the lateral offset is that they
  // stop agreeing — a HUD showing one of them cannot show that.
  let lastReport = null, otherReport = null;
  // WHAT THE PAIR IS ACTUALLY DOING THIS FRAME, as fired — not as solved.
  // The toe solves for a crossing with the beams at rest, and then the sweep
  // adds its own inward swing ON TOP; at amplitude 0.2 against a solved toe
  // of ~0.04 the sweep is five times the larger term, so the crossing the
  // solve asked for is only true at the two instants the swing passes zero.
  // That is the "variables working against each other" the operator suspected,
  // and it is not something a static number on the panel can show.
  const lastSwing = [0, 0];
  const firedFrom = [null, null], firedDir = [null, null];
  let liveCross = null;
  // The crossing for an ARBITRARY swing, so the bench can ask where the pair
  // meets at the sweep's PEAK — which in auto mode is the only moment the
  // solve is aiming at. Sampling "now" during a bell that spends most of its
  // time near zero reports "never meets" on a perfectly correct sweep.
  function crossAtSwing(swing) {
    const A = aimGun(0), B = aimGun(1);
    if (!A || !B) return null;
    const dA2 = swingDir(A.from, A.dir, swing), dB2 = swingDir(B.from, B.dir, swing);
    let best = Infinity, at = 0;
    const maxS = P.reachCells / LAB_R;
    for (let i = 0; i <= 240; i++) {
      const d = (i / 240) * maxS;
      const a2 = arcPoint(A.from, dA2, d), b2 = arcPoint(B.from, dB2, d);
      const g2 = Math.hypot(a2[0] - b2[0], a2[1] - b2[1], a2[2] - b2[2]);
      if (g2 < best) { best = g2; at = d * LAB_R; }
    }
    return { at, gap: best * LAB_R, meets: best * LAB_R < 0.08 };
  }

  function measureCross() {
    if (!firedFrom[0] || !firedFrom[1]) { liveCross = null; return; }
    let best = Infinity, at = 0;
    const maxS = P.reachCells / LAB_R;
    for (let i = 0; i <= 240; i++) {
      const d = (i / 240) * maxS;
      const a2 = arcPoint(firedFrom[0], firedDir[0], d);
      const b2 = arcPoint(firedFrom[1], firedDir[1], d);
      const g2 = Math.hypot(a2[0] - b2[0], a2[1] - b2[1], a2[2] - b2[2]);
      if (g2 < best) { best = g2; at = d * LAB_R; }
    }
    liveCross = { at, gap: best * LAB_R, meets: best * LAB_R < 0.08 };
  }
  function markTargets(reachedSet) {
    for (const t of targets) {
      const hit = reachedSet && reachedSet.has(t);
      // burned bodies light; the ones the beam never gets to go ghostly. The
      // emissive is deliberately modest — under the bloom chain a 1.5 here
      // becomes a white ball that swallows the beam it is meant to be
      // measuring, which is how the first cut of this bench read.
      t.mat.emissiveIntensity = hit ? 0.35 : 0.03;
      t.mat.opacity = hit ? 1 : 0.35;
    }
  }

  function fireFrame(dt, t, alpha) {
    if (alpha === undefined || alpha <= 0) { rig.hide(); markTargets(null); lastReport = null; return; }
    const reach = P.reachCells;
    const reached = new Set();
    const reports = [];
    for (let g = 0; g < 2; g++) {
      const aim = aimGun(g);
      if (!aim) continue;
      // In auto the amplitude is the SOLVED one unless the solve is off, in
      // which case the slider is live again. Writing the solved value back
      // into P.sweepAmplitude would stamp on the operator's own slider every
      // frame, so it is kept beside it instead.
      const amp = (solvedAmp !== null) ? solvedAmp : P.sweepAmplitude;
      const swing = P.sweepMode === 'auto'
        ? amp * Math.sin(Math.min(1, beamPhase[g]) * Math.PI)
        : P.sweepMode === 'manual' ? P.sweepManual : 0;
      const dir = swingDir(aim.from, aim.dir, swing);
      lastSwing[g] = swing;
      firedFrom[g] = aim.from; firedDir[g] = dir;
      // WHAT IS IN THE BEAM — projected onto this gun's own arc, exactly the
      // query the board runs, so a body the lab shows as reached is a body
      // the game would burn.
      const along = [];
      for (const tg of targets) {
        const pr = projectToArc(aim.from, dir, vunit(tg.mesh.position));
        const sCells = pr.s * LAB_R;
        if (pr.s < 0 || sCells > reach) continue;
        if (pr.off * LAB_R >= tg.r) continue;
        along.push({ t: sCells, hard: tg.hard, ref: tg });
      }
      const rep = burnReport(along, reach, reach, 0);
      for (const h of rep.hits) reached.add(h.ref);
      reports.push(rep);
      rig.draw(g, {
        from: aim.from, dir, len: Math.max(0.05, rep.reachLeft) / LAB_R,
        heat: heatFrac(), lift: aim.r, scale: 1, time: t, peak: P.peakIntensity,
      });
      // MASS IN THE BEAM SLOWS ITS SWEEP, per beam, so the pair falls out of
      // step — the inverse of knock-back, and the reason the lab shows two
      // phases rather than one shared toe angle.
      // only AUTO advances the clock — in off/manual the pair is held still
      // on purpose, and a phase ticking underneath would be a lie on the HUD
      if (P.sweepMode === 'auto') {
        beamPhase[g] = Math.min(1, beamPhase[g] + sweepAdvance(dt, P.burstSeconds, rep.drag));
      }
    }
    markTargets(reached);
    measureCross();
    lastReport = reports[0] || null;
    otherReport = reports[1] || null;
  }

  // ?labprobe=1 — THE DROP-OFF, as numbers. Reports the burn for each of the
  // four rank steps against the current line-up: where the beam ends, what it
  // burned, and what it never reached. This is the check that the lab and the
  // board agree, because both call beamburn.burn() — if these ever disagree
  // with the game's own ?beamfire probe, one of them has grown a second copy
  // of the rule.
  // ?labside=N&labstagger=N — set the lateral offset from the URL so the
  // decoupling can be measured headless. Without these the bench can only be
  // driven by hand, and "the beams fall out of step" stays an assertion.
  {
    const q = new URLSearchParams(location.search);
    if (q.has('sweepmode')) P.sweepMode = q.get('sweepmode');
    if (q.has('sweepat')) P.sweepManual = parseFloat(q.get('sweepat')) || 0;
    if (q.has('labside') || q.has('labstagger')) {
      P.targetSide = parseFloat(q.get('labside')) || 0;
      P.targetStagger = parseFloat(q.get('labstagger')) || 0;
      // REBUILD. The GUI block above already called buildTargets() with the
      // defaults, so setting the params here and stopping would leave the row
      // exactly where it was — and the probe would faithfully report that the
      // offset did nothing.
      buildTargets();
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    }
  }

  // ?labbeams=1 — the two beams, separately, after the burst has had time to
  // load them unevenly. THE point of the lateral offset: one beam eats the
  // row and bogs, the other runs clear and finishes its sweep.
  if (new URLSearchParams(location.search).get('labbeams') === '1') {
    setTimeout(() => {
      const L = lastReport, R = otherReport;
      if (!L || !R) { console.log('LABBEAMS INCONCLUSIVE (not firing yet)'); return; }
      const split = Math.abs(beamPhase[0] - beamPhase[1]);
      // FRAMES FIRST. The sweep rate is dt/burstSeconds per frame, so a phase
      // of 0.05 means either "stalled by drag" or "only seven frames have run"
      // — and only the frame count separates them.
      const wouldBe = Math.min(1, firedFor / P.burstSeconds);
      console.log(`LABBEAMS frames=${frames} firedFor=${firedFor.toFixed(2)}s`
        + ` | a CLEAR beam would be at phase ${wouldBe.toFixed(3)} by now`);
      // THE INTERFERENCE, as one line. The toe is solved with the beams at
      // rest; the sweep then adds its own inward swing on top, so what the
      // pair actually does is toe+swing — and at the shipped numbers the
      // swing is the far larger term.
      console.log(`LABCROSS sweep=${P.sweepMode}`
        + ` toe=${toeInfo ? toeInfo.toe.toFixed(4) : '?'}`
        + ` (solved for a crossing @${toeInfo ? toeInfo.at.toFixed(2) : '?'}c)`
        + ` + swing=${lastSwing[0].toFixed(4)}`
        + ` => total inward ${((toeInfo ? toeInfo.toe : 0) + lastSwing[0]).toFixed(4)} rad`
        + ` | ACTUAL now ${liveCross ? (liveCross.meets
          ? `crossing @${liveCross.at.toFixed(2)}c`
          : `apart ${liveCross.gap.toFixed(2)}c @${liveCross.at.toFixed(2)}c`) : '?'}`
        + (() => {
          // AT THE PEAK, which is the moment the solve is aiming at in auto.
          const peak = solvedAmp !== null ? solvedAmp
            : P.sweepMode === 'manual' ? P.sweepManual : 0;
          const c = crossAtSwing(peak);
          return c ? ` | AT PEAK swing=${peak.toFixed(4)} ${c.meets
            ? `crossing @${c.at.toFixed(2)}c` : `apart ${c.gap.toFixed(2)}c`}`
            + ` (target ${(P.crossFrac * P.reachCells).toFixed(2)}c)` : '';
        })());
      console.log(`LABBEAMS side=${P.targetSide} stagger=${P.targetStagger}`
        + ` | L ends=${L.reachLeft.toFixed(2)}c drag=${(L.drag * 100).toFixed(0)}%`
        + ` hits=${L.hits.length}`
        + ` | R ends=${R.reachLeft.toFixed(2)}c drag=${(R.drag * 100).toFixed(0)}%`
        + ` hits=${R.hits.length}`
        + ` | phases ${beamPhase[0].toFixed(3)}/${beamPhase[1].toFixed(3)}`
        + ` split=${split.toFixed(3)}`
        + ` ${split > 0.02 ? 'DECOUPLED' : 'in step'}`);
    }, 2000);
  }

  if (new URLSearchParams(location.search).get('labprobe') === '1') {
    setTimeout(() => {
      for (const st of BEAM_STEPS) {
        const bodies = targets.map((t2) => ({ t: t2.t, hard: t2.hard, ref: t2 }));
        const rep = burnReport(bodies, st.reach, st.reach, 0);
        console.log(`LABPROBE rank=${st.minRank} ${st.name} reach=${st.reach}c`
          + ` ends=${rep.reachLeft.toFixed(2)}c`
          + ` burned=${rep.rows.length}/${bodies.length}`
          + ` missed=${rep.missed.map((m) => m.t.toFixed(1)).join(',') || 'none'}`
          + ` drag=${(rep.drag * 100).toFixed(0)}%`
          + ` | ${rep.rows.map((x) => `${x.hard ? 'SOLID' : 'soft'}@${x.t.toFixed(1)}-${x.cost.toFixed(2)}`).join(' ')}`);
      }
      console.log(`LABPROBE stage radius=${LAB_R} cells (the board's own:`
        + ' unit sphere / cellSide 0.08) · targets='
        + targets.map((t2) => `${t2.hard ? 'SOLID' : 'soft'}@${t2.t.toFixed(1)}`).join(' '));
    }, 900);
  }

  // ?beamprobe=1 — where the beams actually start, point and end. A beam that
  // is long but aimed into the screen looks exactly like a short one, and the
  // difference is three numbers. Walks the ARC now, like everything else here.
  if (new URLSearchParams(location.search).get('beamprobe') === '1') {
    setTimeout(() => {
      const A = aimGun(0), B = aimGun(1);
      if (!A || !B) { console.log('BEAMPROBE INCONCLUSIVE (no guns yet)'); return; }
      const fmt = (v) => v.map((x) => x.toFixed(3)).join(',');
      // NAME THE ARTIFACT. This said "mkcx pivots" whenever laserGuns
      // existed — which both tanks have — so every headless measurement was
      // labelled as the authored model while running on the procedural one.
      const named = tank.userData.asset === DEFAULT_TANK;
      const guns = named ? 'MÖRK (authored pivots)' : 'PROCEDURAL fallback tank';
      console.log(`BEAMPROBE source=${guns} reach=${P.reachCells} cells`
        + ` stage=sphere r=${LAB_R} cells`
        + (toeInfo ? ` | toe=${toeInfo.toe.toFixed(4)} solved for a crossing at`
          + ` ${(P.crossFrac * P.reachCells).toFixed(2)} cells` : ' | toe=manual'));
      console.log(`BEAMPROBE L from=${fmt(A.from)} dir=${fmt(A.dir)}`);
      console.log(`BEAMPROBE R from=${fmt(B.from)} dir=${fmt(B.dir)}`);
      // WHERE THEY MEET, which is the number worth tuning. The first cut of
      // this compared the gap at the muzzles against the gap at the far ends
      // and reported "diverging" — but toed-in beams CROSS and then separate
      // again, so at full length they are wide apart for the right reason. The
      // meaningful figure is the distance at which they are CLOSEST.
      let best = Infinity, bestAt = 0;
      for (let i = 0; i <= 400; i++) {
        const d = (i / 400) * (P.reachCells / LAB_R);
        const pa = arcPoint(A.from, A.dir, d), pb = arcPoint(B.from, B.dir, d);
        const gap = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) * LAB_R;
        if (gap < best) { best = gap; bestAt = d * LAB_R; }
      }
      const muzzleGap = Math.hypot(A.from[0] - B.from[0], A.from[1] - B.from[1],
        A.from[2] - B.from[2]) * LAB_R;
      console.log(`BEAMPROBE dirs-dot=${(A.dir[0] * B.dir[0] + A.dir[1] * B.dir[1]
        + A.dir[2] * B.dir[2]).toFixed(4)}`
        + ` muzzle-gap=${muzzleGap.toFixed(3)} cells`
        + ` closest=${best.toFixed(3)} cells at ${bestAt.toFixed(2)} cells`
        + ` (the apex the toe-in produces; ${best < 0.05 ? 'they cross' : 'they never meet'})`);
    }, 1200);
  }

  const copyBtn = root.querySelector('#beam-copy');
  if (copyBtn) copyBtn.addEventListener('click', copyPreset);

  const clock = new THREE.Clock();
  const hud = root.querySelector('#beam-hud');
  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    postfx.setSize(w, h);
  }
  addEventListener('resize', resize);

  // A NEW BURST RESTARTS BOTH SWEEPS TOGETHER. They only decouple under load,
  // which is the whole readout — a beam lagging its twin is the weapon saying
  // there is something in there you should not ram.
  let wasFiring = false;
  // Frames and burst-seconds actually elapsed, so a "the sweep is not moving"
  // report can be told apart from "headless ran six frames in two virtual
  // seconds". Without this the phase number alone cannot distinguish them.
  let frames = 0, firedFor = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (!active) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    frames++;
    const t = clock.getElapsedTime();
    const alpha = envelope(dt);
    const nowFiring = alpha !== undefined && alpha > 0;
    if (nowFiring && !wasFiring) { beamPhase[0] = 0; beamPhase[1] = 0; firedFor = 0; }
    if (nowFiring) firedFor += dt;
    wasFiring = nowFiring;
    // the barrels carry the STATIC toe (solved from the reach); the SWEEP is
    // applied to the fired direction per beam in fireFrame, not by rotating
    // the model, because the two beams no longer share one angle once drag
    // pulls them apart
    applyReachToe();
    // ORDER IS LOAD-BEARING: pushParams writes every slider onto every link,
    // then draw() applies the per-link muzzle taper and the bell on top. A
    // second pushParams after the draw — which is what used to be here, to
    // restore uAlpha that beam.update() rewrote — flattens the taper straight
    // back out. draw() sets alpha itself now, so it is not needed.
    pushParams(alpha);
    fireFrame(dt, t, alpha);
    controls.update();
    if (flashT > 0) flashT -= dt;
    if (hud) {
      hud.textContent = flashT > 0 ? flashMsg : hudLine(alpha);
      hud.classList.toggle('flash', flashT > 0);
    }
    postfx.render();
  }

  // THE DROP-OFF, IN WORDS. A picture of a short beam and a picture of a beam
  // aimed away are the same picture; the numbers are what tell them apart.
  function hudLine(alpha) {
    const base = `heat ${heat.toFixed(2)}/${P.burstSeconds.toFixed(1)}s`
      + `  ${lock ? 'COOLING' : 'FIRING'}`
      + `  rank ${P.rankStep} · ${P.reachCells.toFixed(1)} cells`
      + (toeInfo ? `  toe ${toeInfo.toe.toFixed(3)} (crossing carried by ${toeInfo.carriedBy})` : '')
      + `  sweep ${P.sweepMode} +${lastSwing[0].toFixed(3)}`
      + (solvedAmp !== null ? ` (amp solved ${solvedAmp.toFixed(3)})` : '')
      + (liveCross ? `  →  ACTUALLY ${liveCross.meets
        ? `crossing @${liveCross.at.toFixed(2)}c`
        : `closest ${liveCross.gap.toFixed(2)}c apart @${liveCross.at.toFixed(2)}c`}` : '')
      + `  tone ${P.toneMapping}`;
    if (!lastReport) return base;
    const r = lastReport;
    const rows = r.rows.map((x) => `${x.hard ? 'SOLID' : 'soft'}@${x.t.toFixed(1)}`
      + `−${x.cost.toFixed(2)}`).join(' ');
    const o = otherReport;
    return `${base}\n`
      + `L ends ${r.reachLeft.toFixed(2)}c drag ${(r.drag * 100).toFixed(0)}%`
      + `   R ends ${o ? `${o.reachLeft.toFixed(2)}c drag ${(o.drag * 100).toFixed(0)}%` : '—'}`
      + `   of ${P.reachCells.toFixed(1)}c`
      + `   ·  sweep ${beamPhase[0].toFixed(2)}/${beamPhase[1].toFixed(2)}`
      // A STALLED SWEEP LOOKS EXACTLY LIKE A BROKEN ONE. It is the same
      // motionless pair either way, and the operator read it as broken —
      // correctly, from the outside. Name the cause on the HUD.
      + (r.stalledBy ? `  ← SWEEP STALLED by ${r.stalledBy}` : '')
      + (Math.abs(beamPhase[0] - beamPhase[1]) > 0.02 ? '  ← DECOUPLED' : '')
      + (rows ? `\nL burned: ${rows}` : '\nL burned: nothing in the beam')
      + (r.missed.length ? `  ·  NEVER REACHED: ${r.missed.length}` : '');
  }
  frame();
  if(new URLSearchParams(location.search).get('acceptance')==='1')window.__stalheartBeamTest={state:()=>({asset:tank?.userData.asset,guns:[gunL,gunR].filter(Boolean).length,pivots:secondaryPivots(tank).length,muzzleOffsets:[gunL,gunR].filter(Boolean).map(gunTipZ)})};

  return {
    setActive(on) { active = on; if (on) { resize(); clock.getDelta(); } },
  };
}
