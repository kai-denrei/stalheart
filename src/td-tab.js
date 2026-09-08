import { makeOrdnanceShell } from './shell.js';
import { firingFor } from './content/firing-defaults.js';
import { METRES_PER_CELL, arcToMetres, metresToArc } from './core/stage-units.js';
import { pickMissileTarget, missileLimits, stepMissileLock, missileCanFire } from './domain/missile-targeting.js';
import { createRunContext } from './domain/run-context.js';
import { createRunTimers } from './platform/run-timers.js';
import { createMissilePool, launchDart, advanceDart } from './missiles.js';
import { MISSILE_LAUNCH_ELEVATION } from './content/missile-defaults.js';
import { renderWorkload, performanceSummary } from './render-workload.js';
import { CONTENT } from './content/runtime.js';
import { preloadSentryTerraformer, makeSentryTerraformer } from './terraformer.js';
import { GAME_START_BIOMASS, SINK, tollFor, breachGrant, debriefAffordable, simOutcome } from './campaign.js';
import { record } from './diagnostics.js';
import { storage as localStorage } from './storage.js';
// td-tab.js — TOWER DEFENSE mode (heart-tab sibling). M1: adds the
// build/action camera pair and the minimap/threat-view swap on top of
// the full heart game. Towers/economy arrive in M2/M3.
// Original header:
// defend the Heart. An OPEN battlefield (~80% walkable;
// walls are scattered obstacle clumps to maneuver around and shelter
// behind, not corridors) with the Heart at the north pole. Enemies are
// INTRODUCED one type per wave (HokorobiTawaa's announce pattern): each
// introduction creates that type's SPAWN POINT far from the pole — find
// it and destroy it (3 hits). Fodder (phage/amoeba/jellyfish) is RUN
// OVER: the tank is strong, ramming kills them free. The late roster is
// borrowed from HokorobiTawaa and can NOT be rammed: corona (armored,
// slows itself when shot), barbed (accelerates when shot), knot (BOSS).
// Shells also blast walls open — clear your own path to the sources.
// Pickups: bullet triads (+3 shells), speed, health, regen charges
// carried home.
// Win: all types introduced, all spawn points dead, field clear.
// Lose: the Heart falls.

import * as THREE from '../vendor/three.module.js';
import GUI from '../vendor/lil-gui.esm.js';
import { generateSphereMesh, relax } from './grid.js';
import { generateDungeon, bfsDist, BLOCKED, PATH, ROOM } from './dungeon.js';
import { compileRail } from './cine/rail.js';
import { SCRIPTS } from './cine/scripts.js';
import { cuesBetween } from './cine/sound.js';
import { installCine } from './cine/kit.js';
import { mulberry32, randomSeed } from './rng.js';
import { computeBerths, berthIndexFor } from './berths.js';
import { wantsSecondary, shellsForAll } from './autofire.js';
import { printPhase, printOffset, printOn, patternSecsFor } from './printpath.js';
import { createBeam } from './beamfx.js';
import { createBeamRig, PLASMA_DEFAULTS, BOARD_PRESET, BEAM_PEAK } from './beamdraw.js';
import { sub3, add3, scale3, dot3, cross3, norm3, len3, dist3, segKey, tangentDir, tangentBasis } from './vec3.js';
import { CREATURES, waveJelly } from './creatures.js';
import { brief, dwellFor } from './isaobriefs.js';
import { drawEmotion } from './emotions.js';
import { ACHIEVEMENTS, ACHV_GROUPS, achievement, blankRun, earned, freshlyEarned,
  sanitiseRecord }
  from './achievements.js';
import { applyFontPack, currentFontPack, FONT_NAMES,
  loadTypeFeel } from './fonts.js';
import { SECONDARY_TOE, applySecondaryToe } from './units.js';
import { UNITS, UNIT_NAMES, buildUnit, buildCreature, preloadMkcx, preloadMork, preloadServer, makeServerFixture, makeShieldShell, preloadContainer, makeContainerFixture, preloadFabricator, makeIsaoDrone, makeBulletCloud, makeRewardSolid, makeShellSolid, makeDebris, makeDotBurst, makePortalCloud, preloadPortalRing, makePortalRing, makeHeartCloud, makeDotEnemy, makeSurvivor, preloadAstronaut, preloadAstronauts, makeAstronaut, preloadTerraformer, makeTerraformerFixture } from './units.js';
import { LOOKS, LOOK_NAMES } from './looks.js';
import { makeCellIndex } from './cellindex.js';
import { CREATURE_TINTS, ENEMY_SPEC, INTROS, computeWavePlan, accentFor } from './enemyspec.js';
import { PICKUPS } from './pickups.js';
import { rankFor, rankLabel, badgeSVG, killReq, eliteReq } from './ranks.js';
import { beamStep, isBeamStep, PEN_SOFT_FRAC, PEN_HARD_FRAC } from './beamranks.js';
import { burn, sweepAdvance, wallBite as wallBiteFor } from './beamburn.js';
import { arcPoint, projectToArc, toeForCrossing, crossingForToe } from './arc.js';
import { MINE_TUNE, makeField, layMine, armMines, restock, mineAt,
  inFan, trip, chain, nextChained, minePolar } from './mines.js';
import { shotOf, muzzleOf, impactOf, tuneFor } from './sentryfx.js';
import { makeTracerMesh, makeLightningMesh, makeSeekerMesh, aimSeeker,
  LANCE_LOOK as SHOT_LANCE_LOOK, THROW_LOOK as SHOT_THROW_LOOK } from './shotfx.js';
import { SHIELD_TUNE, SHIELD_KNOBS, makeShield, charge as chargeShield,
  deploy as deployShield, tickShield, stepShieldFrame, restockShield, tapTower, towerOffline,
  stationDraw, waveReset as shieldWaveReset, shoveVec, shoveMag } from './shield.js';
import { deepLink, wireDeepLink } from './deeplink.js';
import { RESCUE_TUNE, makeRescue, placeSurvivors, stepBoard, stepGrab,
  disembark, loseCarried, lockOn, waveMix, standing as standingSurv,
  aboard as aboardSurv, missionOver, verdict as rescueVerdict,
  grabProgress, remaining as remainingSurv, exposed as exposedSurv,
  RESCUE2_TUNE, makeCamps, stepCall, stepEmerge, walkStep, runOver,
  awake as campAwake } from './rescue.js';
import { WORMHOLE_PRESET, WORMHOLE_UNIFORM_DEFAULTS, RING_SPIN, TRAVEL,
  travelRate, advancePhase } from './portalfx.js';
import { WORMHOLE_FRAG } from './fx/wormhole.frag.js';
import { CORONA_FRAG } from './fx/corona.frag.js';
import { labLine, parseLabQuery } from './lab.js';
import { bakeGalaxyCube } from './galaxybake.js';
import { SKY_PRESET } from './galaxyseed.js';
import { makeScore } from './score.js';
import { TOWERS, TOWER_BY_KEY, MAX_TIER, upgradeCost, effectiveStats as baseEffectiveStats, pickTarget, shotInterval, unlockedTowerKeys, towerUnlockWave, TOWER_ORDER, HACK_GATED, starterTower, towerSound, ROSTER } from './towers.js';
import { makeEconomy, sellRefund } from './economy.js';
import { pickTier } from './perftier.js';
import { applyWeatheredMaterial } from './cine/materials.js';
import { STICK, stickVector, knobOffset } from './stick.js';
import { makeBloom } from './postfx.js';
import { TANK_FEEL, TANK_FEEL_KNOBS, makeTankFeel, stepTankFeel, landTankFeel, fireTankFeel, applyTankFeel, applyTankHealth } from './tankfeel.js';
import { FEEL, loadFeel, saveFeel } from './feelstore.js';
import { STRIKE_KNOBS, makeStrike, makeStrikeParams, grantStrikes, stepStrike,
  toggleArm, paintTarget, launchStrike, stepFall, skipFall, fallProgress,
  strikeDamage, retargetStrike, orbitProgress } from './strike.js';
import { radarBasis, radarProject, radarBearing, sweepAngle, radarPhosphor,
  proximitySectors, SENSOR_LEVELS, sensorColor } from './radar.js';
import { BLOOM_GROUPS } from './bloomweights.js';
import { A6_TUNE, magFor, makeA6, stepA6, arc as a6Arc, a6Line } from './heptapod.js';
import { SENTRY_TUNE } from './sentry.js';
import { makeLock } from './lockon.js';
import { TOWER_LOOK_NAMES, DEFAULT_TOWER_LOOK, buildTowerLook, preloadLook, lookReady, setSentryTier } from './towerlooks.js';
import { makeAudio } from './audio.js';
import { DEATH_KEYS } from './audiomanifest.js';

export function initTdTab(root) {
  let active = false;
  let wasPlaying = false; // drives body.playing (mobile hides ALL chrome)

  const params = {
    towerLook: DEFAULT_TOWER_LOOK,
    // app-wide, but it lives in this GUI because this is the tab whose
    // messages the packs were chosen for (src/fonts.js owns the table)
    font: currentFontPack(),
    seed: 7,
    heartLook: new URLSearchParams(location.search).get('terraformer') === 'a6' ? 'sentryTerraformer' : 'terraformer', // what stands at the pole — see HEART_LOOKS
    callouts: true,           // the encouragement layer; numbers survive it going off
    // The whole unlock run — every wave until the last tower unlocks — is
    // a guided tutorial, and it should be played on a TIGHT board: at 3000
    // the opening sector was 146 open cells, at 500 it is 84. Cells are
    // also ~2.4x wider, so the board reads chunky and legible rather than
    // sprawling. Sector expansion is unaffected — round 2 still opens 278.
    // Larger maps for the post-tutorial game are a separate, later change.
    points: 500, // ONE pre-decided lane world; sectors unseal it in bands
    rooms: 16,          // lane structure: rooms joined by wide corridors
    roomRadius: 4,
    extraCorridors: 8,
    corridorWidth: 1, // narrow halls between ROOMS — rooms are the arenas
    obstacles: 0.2,     // fraction of the sphere left as wall clumps
    wallHeight: 0.03,
    relaxIters: 80,
    view: 'third', // pov | third
    autoUpgrade: false, // the drones spend excess biomass on tiers by themselves
    look: 'tronColors', // visual identity, see looks.js
    wallTops: 'black', // obstacles read as voids; silhouettes matter here
    // THE MINE'S ARC IS DRAWN. Off is a real mode, not a debug flag: a
    // field you cannot see is the pvp/ambush game the operator named, and
    // the fan is the only thing that makes a laid mine legible at all.
    mineArcs: true,
    speed: 1.1, // cells per second, wanderer pace
    recoil: 8, // shell-recoil intensity, dialed to MAX per operator
    directive: 'wander', // auto-mode order: wander/avoid/ram/conserve/home/portal
    // Hover feel, all live-tunable — these were guessed wrong twice, so they
    // are knobs rather than constants. Units: `hoverRise` is in MODEL units
    // (the tank is ~3.24 tall there), because it moves the body group inside
    // the model, not the unit on the sphere.
    // mkcx by default: the authored hover tank. Async — buildUnit falls
    // back to the procedural tank until the bytes land, then
    // onMkcxReady swaps it in.
    creature: 'mkcx2',
    // balance (operator pass): heavier early waves, but a richer field —
    // more triads on the ground and a longer breath between waves
    orbs: 14,
    orbRespawn: 6, // seconds between respawns (0 = off)
    waveSize: 4,
    // Back to 15: THE MASS is SHELVED (2026-09-06). It went to 16 to give the
    // sector a boss ending; with the jelly out of INTROS the extra wave is an
    // empty repeat, and `typesByWave` would have nothing new to introduce.
    wavesPerSector: 15, // the HOLD phase. Survive these and the gates unseal.
                        // The operator's first guess, not a finding.
    waveGap: 7,   // seconds of anticipation between a cleared wave and the next
    waveCap: 30,  // safety: force the next wave if the current isn't cleared in time
    rewards: 6,
  };

  // creature-specific locomotion: a speed profile over time (multiplies the
  // wander pace) and a hover profile (fraction of unitScale above the floor)
  const MOVES = {
    amoeba: {
      // crawl: pseudopod surge then pause
      speed: (tt) => 0.5 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(tt * 1.6), 2),
      hover: () => 0,
    },
    phage: {
      // stalk & pounce: creeps, then rare quick darts on spindly legs
      speed: (tt) => 0.45 + 2.8 * Math.pow(0.5 + 0.5 * Math.sin(tt * 0.7), 10),
      hover: (tt) => 0.1 + 0.06 * Math.sin(tt * 2.2),
    },
    tank: {
      // treads: steady, grounded, unhurried
      speed: () => 0.85,
      hover: () => 0,
    },
    drone: {
      // quick hoverer with a slight altitude wobble
      speed: (tt) => 1.25 + 0.15 * Math.sin(tt * 1.1),
      hover: (tt) => 0.35 + 0.08 * Math.sin(tt * 2.3),
    },
    jellyfish: {
      // pulse & drift: thrust on the bell contraction (same 3t as the Jelly
      // treatment, so the push visibly matches the squeeze), then coast
      speed: (tt) => 0.3 + 1.5 * Math.pow(Math.max(0, Math.sin(tt * 3 + 0.4)), 2),
      hover: (tt) => 0.5 + 0.18 * Math.sin(tt * 3 - 0.9),
    },
    corona: {
      // armored roll: slow and inevitable
      speed: () => 0.7,
      hover: (tt) => 0.12 + 0.03 * Math.sin(tt * 1.8),
    },
    barbed: {
      // drifting mine: slow sway
      speed: (tt) => 0.6 + 0.1 * Math.sin(tt * 1.2),
      hover: () => 0.06,
    },
    knot: {
      // the boss glides
      speed: () => 0.55,
      hover: (tt) => 0.3 + 0.06 * Math.sin(tt * 1.4),
    },
  };

  // --- THE MOBILE SHELL (docs/MOBILE-PORT-PLAN.md, phases 1-2) --------------
  // A second shell over the same game. Desktop never enters this branch; the
  // shell is a body class the phone CSS keys off and a handful of intents the
  // game already had. Detection is coarse pointer AND a phone-class width,
  // overridable either way by ?mobile=1|0 so it can be looked at anywhere.
  const mobileParam = new URLSearchParams(location.search).get('mobile');
  const mobileShell = mobileParam === '1' ? true : mobileParam === '0' ? false
    : (matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 900);
  document.body.classList.toggle('mobile-shell', mobileShell);
  // ?coarse=1 — SIMULATE A COARSE POINTER for the ruler. No headless flag
  // makes `(pointer: coarse)` true (primaryPointerType blink-settings were
  // tried: still false), so every rule in the phone's coarse blocks was
  // invisible to ?layout, which reported 0 overlaps on a layout the phone
  // never shows — the operator's screenshot showed the radar swallowing the
  // launch console. Rewriting the media conditions in the loaded sheets
  // makes those blocks apply for real, at this width, in this run.
  // TIMING. This used to run once, here, at init — and flipped ZERO blocks,
  // because document.styleSheets has the <link> but `cssRules` is not
  // populated until the sheet has actually loaded. So the tool built to stop
  // ?layout lying reported "0 media blocks now apply" and ?layout went on
  // measuring the desktop rules, which is the exact failure it exists to
  // prevent, one level up. It is a FUNCTION now, called again at measure
  // time, and it says how many blocks it found so a zero is visible.
  function simulateCoarse() {
    if (mobileParam !== '1' || new URLSearchParams(location.search).get('coarse') !== '1') return 0;
    let flipped = 0;
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      const walk = (list) => {
        for (const r of list) {
          if (r.cssRules && !(r instanceof CSSMediaRule)) { walk(r.cssRules); continue; }
          if (!(r instanceof CSSMediaRule)) continue;
          const t = r.media.mediaText;
          // BOTH sides of the pointer: coarse/hover-none become true AND
          // fine/hover-hover become false — headless is `pointer: fine`, and
          // leaving that half alone hid the thumbs (a fine-pointer block)
          // under a coarse layout, a combination no device has
          if (!/pointer:\s*(coarse|fine)|hover:\s*(none|hover)/.test(t)) { walk(r.cssRules || []); continue; }
          r.media.mediaText = t
            .replace(/\(pointer:\s*coarse\)/g, '(min-width: 0px)')
            .replace(/\(hover:\s*none\)/g, '(min-width: 0px)')
            .replace(/\(pointer:\s*fine\)/g, '(min-width: 99999px)')
            .replace(/\(hover:\s*hover\)/g, '(min-width: 99999px)');
          flipped++;
        }
      };
      walk(rules);
    }
    return flipped;
  }
  // ?coarse=1 — SIMULATE A COARSE POINTER for the ruler. No headless flag
  // makes `(pointer: coarse)` true (primaryPointerType blink-settings were
  // tried: still false), so every rule in the phone's coarse blocks was
  // invisible to ?layout, which reported 0 overlaps on a layout the phone
  // never shows — the operator's screenshot showed the radar swallowing the
  // launch console.
  if (mobileParam === '1' && new URLSearchParams(location.search).get('coarse') === '1') {
    console.log(`COARSE simulated at init: ${simulateCoarse()} media blocks now apply`);
  }

  // THE RENDER BUDGET (plan §2.9): one table, picked once, printed by
  // ?perf=N next to the draw stats. ?mobile=1|0 forces the matching tier so
  // a headless run — never coarse — measures what a phone gets; ?tier=
  // overrides on its own for a phone that wants the desktop look.
  // THE METAL ON THE BOARD (operator, 2026-09-04: "add the metal effect to
  // the default game"). The weathered maps (src/weathered.js, the metal
  // lab's preset) on every cast the board makes — the tank, the
  // containers, the Terraformer, the gates — at the tier's size, KEEPING
  // the grey ladder's colour and emissive: the board is dimly lit and the
  // rungs are why the machines read. ?metal=0 returns the flat cast.
  const metalOn = new URLSearchParams(location.search).get('metal') !== '0';
  let metalEnv = null, metalEnvSky = null;
  function metalEnvironment() {
    // the board's own sky bake, through PMREM, for the dressed casts only —
    // rebuilt when the sky is rebaked (a regenerate)
    if (!sky || !sky.texture) return null;
    if (metalEnv && metalEnvSky === sky.texture) return metalEnv;
    const pm = new THREE.PMREMGenerator(renderer);
    metalEnv = pm.fromCubemap(sky.texture).texture; metalEnvSky = sky.texture;
    pm.dispose();
    return metalEnv;
  }
  function dressMetal(obj) {
    if (!metalOn || !obj) return obj;
    try {
      const n = applyWeatheredMaterial(obj, { seed: 4414, size: mobileShell ? 256 : 512, repeat: 2, normalScale: 0.8,
        keepEmissive: true, keepColor: true, envMap: metalEnvironment(), envMapIntensity: 0.9 });
      console.log(`METAL dressed ${n} on ${obj.name || obj.userData.kind || obj.type} env=${!!metalEnv}`);
    } catch (e) { console.warn('METAL: dress failed', e); }
    return obj;
  }
  const tier = pickTier({
    coarse: matchMedia('(pointer: coarse)').matches,
    shortSide: Math.min(innerWidth, innerHeight),
    forced: new URLSearchParams(location.search).get('tier')
      || (mobileParam === '1' ? 'phone' : mobileParam === '0' ? 'desktop' : null),
  });
  const whRender = { ...tier.wormhole };

  // THE STRESS LAB (operator, 2026-09-03; src/lab.js). `?lab=1` and nothing
  // else changes: every branch below is `lab.on && …`, so a run without the
  // flag executes the code it executed yesterday. The lab opens on the
  // tier's own portal numbers; a URL may override them (`?labWhSize=`).
  const lab = parseLabQuery(location.search, tier) || { on: false };
  if (lab.on) { whRender.size = lab.whSize; whRender.updateHz = lab.whHz; }
  // THE SKY: a seeded galaxy field baked into a cubemap once per run (see
  // galaxybake.js; measured +0.2 ms a frame at 1x). The seed is fresh on every
  // reset — the sky is dressing, not game logic. The lab's knobs drive the same
  // bake when the lab is on; without it the game's SKY_PRESET does.
  let sky = null;        // { texture, key, dispose } once baked
  // ?sky=N pins the sky's seed: the sky is the one thing on the board
  // allowed a fresh seed per reset, and the one thing that made two
  // director captures of the same script differ in every frame
  const skyQ = new URLSearchParams(location.search).get('sky');   // urlParams is declared further down
  let skySeed = skyQ != null ? (parseInt(skyQ, 10) >>> 0) % 100000 : randomSeed() % 100000;
  function applySky() {
    const want = lab.on
      ? (lab.bg === 'galaxy' ? { seed: lab.galaxySeed, scale: lab.galaxyScale, galaxies: lab.galaxies, coreScale: lab.galaxyCore } : null)
      : { seed: skySeed, scale: SKY_PRESET.scale, galaxies: SKY_PRESET.galaxies, coreScale: SKY_PRESET.coreScale };
    if (!want) { if (sky) { sky.dispose(); sky = null; } return; }
    const key = `${want.seed}/${want.scale}/${want.galaxies}/${want.coreScale}`;
    if (sky && sky.key === key) return;
    if (sky) sky.dispose();
    const t0 = performance.now();
    sky = bakeGalaxyCube(renderer, { ...want, face: tier.name === 'phone' ? 512 : 1024 });
    sky.key = key;
    console.log(`SKY seed=${want.seed} face=${sky.face} scale=${sky.scale} galaxies=${sky.galaxies}`
      + ` core=${sky.params.core.toFixed(3)} arms=${sky.params.arms} palette="${sky.params.palette}"`
      + ` bakeMs=${(performance.now() - t0).toFixed(1)} (cpu, incl. compile)${lab.on ? ' lab' : ''}`);
  }

  // --- scene ---------------------------------------------------------------
  const container = root.querySelector('#td-app');
  const renderer = new THREE.WebGLRenderer({ antialias: tier.antialias });
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier.dprCap));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const mainBg = new THREE.Color(0x0d1017);
  scene.background = mainBg;

  const camera = new THREE.PerspectiveCamera(68, 1, 0.004, 50);
  const postfx = makeBloom(renderer, scene, camera, { scale: tier.bloomScale });
  // sound. The context can only be born on a user gesture, so arm() wires
  // one-shot listeners and the first tap/keypress creates it. Until then
  // every play() is a silent no-op -- the game never waits on audio.
  const sfx = makeAudio({ seed: 1 });
  sfx.arm();
  // THE ALARM IS THE PROOF OF LIFE. Operator, 2026-09-01: waiting out the
  // cold open to find out whether sound works makes every test cycle cost
  // ten seconds. This fires the moment the context is genuinely running —
  // the same klaxon the first unrammable contact uses — so audio announces
  // itself immediately, on the very first click, before anything else.
  //
  // It also doubles as a diagnostic: if this is silent but ?beep=1 is
  // audible, the fault is in the sample path, not the output.
  sfx.whenRunning(() => {
    // TWO sounds, deliberately, by two completely different routes. The
    // oscillator uses NONE of the sample path — no decoded buffer, no bus,
    // no master, no mix admission — so hearing one and not the other
    // localises the fault without needing a special URL or another round
    // trip. Six attempts failed to ask this question; now every load asks it.
    sfx.beep(880, 220);            // route A: oscillator -> destination
    console.log('AUDIO proof-of-life A: beep (oscillator, no buffer/bus/master)');
  });
  // Route B waits for the samples. Decoding rides the playback context now,
  // so it finishes AFTER the unlock — firing this on `running` alone would
  // ask for a buffer that does not exist yet and be refused.
  sfx.whenReady(() => {
    sfx.play('danger_alert');
    console.log('AUDIO proof-of-life B: danger_alert (decoded sample, full graph)');
    // ...and then MEASURE it, rather than asking anyone to listen. Seven
    // rounds of this bug have ended with "can you tell me what you hear";
    // the analyser on master answers it from inside the page.
    sfx.measureOutput(1500);
  });

  // Which things bloom how much. Read fresh every frame from the live
  // collections, so nothing has to be tagged at creation and no new
  // spawn site can silently miss out. Anything not listed here — tracers,
  // debris, bursts, orbs, rewards, the Heart, the range ring — falls
  // through to the `effects` weight.
  postfx.setGroups(() => [
    ['map', [floorMesh, wallMesh, edgeMesh, topMesh]],
    ['tank', [playerMesh]],
    ['enemies', [
      ...enemies.filter((e) => e.alive).map((e) => e.obj),
      ...spawnPoints.filter((sp) => sp.alive).map((sp) => sp.obj),
    ]],
    ['towers', towers.map((tw) => tw.obj)],
  ]);

  // --- the minimap is a MARKER LAYER, not a second render of the world ------
  // It used to draw the whole scene again, so every object on the board cost
  // two draw calls instead of one — measured at ~1020 calls a frame, and the
  // map was roughly half of it. Now the map camera only sees layer 1: the
  // board itself (four merged meshes), the few hand-placed markers, and ONE
  // pooled blip cloud carrying every enemy and tower.
  //
  // A blip per enemy would have been an object per enemy, which is the cost
  // being removed. One buffer rewritten each frame is one draw call for the
  // lot, however many there are.
  // Layer 1 survives as a tag on the board meshes (harmless), but nothing
  // renders it any more: the minimap's second WebGL scene is gone, replaced
  // by the 2D radar below.
  const MAP_LAYER = 1;

  // --- wave telegraph -------------------------------------------------------
  // A wave used to simply appear. The countdown said so in the corner, but
  // the corner is not where you are looking — so the first you knew of it was
  // enemies already on the board, and the gates themselves gave nothing away.
  //
  // Now the gate CHARGES: it swells, brightens and beats faster over the last
  // few seconds, throwing a shock ring across the floor each beat, quicker as
  // the moment comes. The warning is on the thing the enemies come out of,
  // which is the thing worth watching.
  // 3.0 exactly: the warning sound is 3.7s long and starts here, so it is
  // still running as the first enemy clears the gate — the cue hands over
  // to the thing it warned about rather than stopping a frame before it.
  const WAVE_WARN = 3.0;      // seconds of charge before the wave lands
  let waveCharge = 0;         // 0..1 over that window
  let warnBeat = 0;           // seconds until the next shock ring
  // >= 0 means a wave is ARMED and counting down. Every route to spawnWave
  // goes through this, so a wave cannot arrive without its lead-in.
  let waveIn = -1;

  // --- orbital strike -------------------------------------------------------
  // All logic lives in strike.js (pure, tested); this file owns only what it
  // looks and sounds like. strikeTune is the live knob object the GUI writes.
  const strike = makeStrike();
  const strikeTune = makeStrikeParams();
  let strikeGrace = 0;   // s after launch during which a tap cannot skip
  let shopMute = 0;      // s after impact during which the shop stays shut
  const strikecamEl = root.querySelector('#td-strikecam');
  const scInfoEl = root.querySelector('#sc-info');
  const scRangeEl = root.querySelector('#sc-range');
  let strikingUi = false;
  // The feed: B&W filter class, the ops HUD, and the range counter. The
  // counter is the camera's own distance to the target in fictional metres —
  // it rides the same smoothstep as the fall, so it decelerates hard as the
  // ground arrives, which is what makes the last 200m feel like a held
  // breath rather than a number spinning to zero.
  const STRIKE_M_PER_UNIT = 4800;   // planet radius 1 == ~4.8km of fiction
  const scSkipEl = root.querySelector('#td-strikecam .sc-skip');
  function strikeFeedInfo() {
    const ci = strike.fallCi;
    scInfoEl.textContent =
      `ORBITAL STRIKE · OTS-723\n`
      + `WARHEAD 489KG · KINETIC\n`
      + `TGT CELL ${String(Math.max(0, ci)).padStart(4, '0')} · SECTOR R${round}\n`
      + `FEED SAT-CAM 2 · LIVE`
      + (strike.retargetsLeft > 0 ? `\nVECTOR BURST ×${strike.retargetsLeft}` : '\nVECTOR SPENT');
    scSkipEl.textContent = strike.retargetsLeft > 0
      ? 'TAP GROUND TO RE-AIM · TAP SKY TO SKIP'
      : 'TAP TO SKIP';
  }
  function syncStrikeFeed() {
    const on = strike.falling > 0;
    if (on !== strikingUi) {
      strikingUi = on;
      console.log(`FEED ${on ? 'ON' : 'OFF'} range=${scRangeEl.textContent}`);
      root.classList.toggle('striking', on);
      strikecamEl.classList.toggle('hidden', !on);
      if (on) strikeFeedInfo();
    }
    if (on && strike.fallCi >= 0) {
      const c = graph.centers[strike.fallCi];
      const d = Math.hypot(camera.position.x - c[0], camera.position.y - c[1],
        camera.position.z - c[2]);
      const m = Math.max(0, Math.round(d * STRIKE_M_PER_UNIT / 10) * 10);
      scRangeEl.textContent = `${String(m).padStart(4, '0')}M`;
    }
  }

  // One pooled cloud for every ring, main view only — the map has its blips.
  const WARN_MAX = 1200;   // ~4 rings alive per gate at the fastest cadence
  const warnPos = new Float32Array(WARN_MAX * 3);
  const warnCol = new Float32Array(WARN_MAX * 3);
  const warnGeo = new THREE.BufferGeometry();
  warnGeo.setAttribute('position', new THREE.BufferAttribute(warnPos, 3));
  warnGeo.setAttribute('color', new THREE.BufferAttribute(warnCol, 3));
  warnGeo.setDrawRange(0, 0);
  const warnMesh = new THREE.Points(warnGeo, new THREE.PointsMaterial({
    size: 3.6, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.9,
  }));
  warnMesh.frustumCulled = false;   // the buffer is rewritten; its bounds lie
  scene.add(warnMesh);
  const warnFx = [];   // { c, t1, t2, a, r0, r1, t, life, col }

  // A ring lying ON the surface, so it reads as a shock across the floor
  // rather than a sphere hanging in the air. The basis comes from the cell's
  // own normal; a fixed up-vector degenerates wherever the sphere faces it.
  function warnRing(ci, hex, life, r1) {
    const nrm = graph.normals[ci];
    let t1 = cross3(nrm, [0, 1, 0]);
    if (len3(t1) < 1e-3) t1 = cross3(nrm, [1, 0, 0]);
    t1 = norm3(t1);
    const t2 = norm3(cross3(nrm, t1));
    const c = add3(graph.centers[ci], scale3(nrm, cellSide * 0.12));
    // dense enough to read as a RING and not as scattered dots: the radius
    // grows to several cells, and 34 points across that is just confetti
    const N = 72;
    for (let i = 0; i < N && warnFx.length < WARN_MAX; i++) {
      warnFx.push({ c, t1, t2, a: (i / N) * Math.PI * 2, r0: cellSide * 0.3, r1,
        t: 0, life, col: new THREE.Color(hex) });
    }
  }

  function stepWarnFx(dt) {
    let k = 0;
    for (let i = warnFx.length - 1; i >= 0; i--) {
      warnFx[i].t += dt;
      if (warnFx[i].t >= warnFx[i].life) warnFx.splice(i, 1);
    }
    for (const f of warnFx) {
      const u = f.t / f.life;
      const r = f.r0 + (f.r1 - f.r0) * u;
      const ca = Math.cos(f.a) * r, sa = Math.sin(f.a) * r;
      warnPos[k * 3] = f.c[0] + f.t1[0] * ca + f.t2[0] * sa;
      warnPos[k * 3 + 1] = f.c[1] + f.t1[1] * ca + f.t2[1] * sa;
      warnPos[k * 3 + 2] = f.c[2] + f.t1[2] * ca + f.t2[2] * sa;
      const fade = 1 - u;
      warnCol[k * 3] = f.col.r * fade;
      warnCol[k * 3 + 1] = f.col.g * fade;
      warnCol[k * 3 + 2] = f.col.b * fade;
      k++;
    }
    warnGeo.setDrawRange(0, k);
    warnGeo.attributes.position.needsUpdate = true;
    warnGeo.attributes.color.needsUpdate = true;
  }

  // --- the radar ------------------------------------------------------------
  // The minimap stopped being a minimap the day the board went to one merged
  // mesh — a shrunken copy of the main view told you nothing the main view
  // did not. It is a PPI SCOPE now, DeepWatch's idiom on our sphere: a
  // rotating beam, contacts flaring as it passes and decaying behind it,
  // heading-up around the tank or pole-down over the heart (M still swaps).
  //
  // A 2D canvas, not a third renderer: ~200 contacts a frame is nothing, and
  // it RETIRES the second WebGL context the old map ran on. The class stays
  // 'minimap' so every existing rule — the round clip, the phone corner, the
  // strike promotion, the feed's display:none — applies unchanged.
  const radarEl = document.createElement('canvas');
  radarEl.className = 'minimap';
  container.appendChild(radarEl);
  const radarCtx = radarEl.getContext('2d');
  let radarCss = 200;

  // even-ish lighting: the walker can be anywhere on the sphere, so no side
  // may fall into unreadable darkness
  const hemi = new THREE.HemisphereLight(0xc8cfe0, 0x555060, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8c8, 1.1);
  sun.position.set(2, 3, 1.5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8a96c8, 0.8);
  fill.position.set(-2.5, -1.5, -3);
  scene.add(fill);

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    postfx.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // armed promotes the corner disc to a RADAR: same scene, same culled
    // layer, just more of the screen — the targeting view is the map
    const narrow = w <= 700;
    const mScale = strike.armed ? (narrow ? 0.44 : 0.52) : (narrow ? 0.23 : 0.32);
    const mCap = strike.armed ? (narrow ? 340 : 430) : (narrow ? 138 : 240);
    // the shell keeps the radar small and bottom-left (its CSS pins the
    // corner); the phone block's 240px disc was swallowing the console
    const m = mobileShell
      ? Math.min(strike.armed ? 200 : 96, Math.floor(Math.min(w, h) * (strike.armed ? 0.5 : 0.3)))
      : Math.min(mCap, Math.floor(Math.min(w, h) * mScale));
    radarCss = m;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    radarEl.width = Math.round(m * dpr);
    radarEl.height = Math.round(m * dpr);
    radarEl.style.width = `${m}px`;
    radarEl.style.height = `${m}px`;
  }
  addEventListener('resize', resize);

  // --- state ---------------------------------------------------------------
  let mesh = null, dungeon = null, graph = null;
  let cellSide = 0.08;
  let floorGeo = null, wallGeo = null, floorMesh = null, wallMesh = null;
  let edgeGeo = null, edgeMesh = null;
  let topGeo = null, topMesh = null; // interior wall-top wires, dimmable
  let floorOffsets = null; // cell -> [start,count] into floor color attr (verts)
  let heartSprite = null, playerMesh = null, markerMesh = null;
  // WHAT STANDS AT THE POLE. Both entries satisfy one contract — sizeScale,
  // tick(t), hit() — so swapping them changes how the Stalheart LOOKS and
  // never what it DOES. Same registry seam as looks / towerlooks /
  // unitcatalog, and the reason this could be tried without touching
  // heartHit, the minimap, the bastion camera or the win condition.
  const HEART_LOOKS = {
    sentryTerraformer: { label: 'Terraformer 3000 (Sentry)', preload: () => preloadSentryTerraformer(), make: makeSentryTerraformer, footprint: 1.12, scale: 1.9, lift: 0.16 },
    terraformer: {
      label: 'terraformer',
      preload: preloadTerraformer,
      make: () => dressMetal(makeTerraformerFixture(new THREE.Color(look().heart).getHex())),
      // a wide machine on a pad wants more room than a dot cloud
      scale: 1.9,
      lift: 0.16,
    },
    cloud: {
      label: 'dot cloud',
      preload: () => Promise.resolve(true),
      make: () => makeHeartCloud(new THREE.Color(look().heart).getHex()),
      scale: 1.15,
      lift: 0.55,
    },
  };
  const heartLook = () => HEART_LOOKS[params.heartLook] || HEART_LOOKS.cloud;
  let heartGen = 0;   // a board rebuild invalidates an in-flight model load
  // THE SERVER: an invincible fixture at the heart's exact antipode.
  // Finding it offers the HACK — the HDT circuit duel in an overlay —
  // and a win decrypts the next tower ahead of its wave gate.
  let serverObj = null, serverCi = -1, serverGen = 0;
  // the LIFE CONTAINERS: 3 near the heart, each { obj, tank } — the spare
  // hulls ARE the lives counter (playerHP - 1 spares stocked)
  let lifeContainers = [];
  // WHERE THE CAMP IS — known synchronously, from the board alone. The
  // container models decorate these cells; they never choose them, which is
  // what lets a reset place the tank once instead of teleporting it later.
  let berths = [];
  let serverChamber = []; // the carved vault: floor cells, walls all round
  // walls the PLAYER opened (shells, strikes) stay open across rounds —
  // demolition is permanent (operator ruling: a breach you paid for does
  // not grow back at the next frontier shift)
  const breachedCells = new Set();
  let serverFound = false, hackedRound = false, hackedUnlocks = 0;
  let hackWins = 0;              // total protocol wins this run
  let missileShop = false;       // hack #2 opens it
  let missilesBought = 0;        // the price climbs with each purchase
  const missileCost = () => 500 + 250 * missilesBought;
  let playerSize = 0.06; // set per-generation in buildActors

  // creature dot-cloud + gameplay state
  let creatureBase = null;   // unit-radius [x,y,z,(hi)] points from creatures.js
  let creatureGeo = null;
  let creaturePos = null;    // Float32Array scratch for waveJelly
  let baseUnitScale = 0.04;  // creature world radius at birth
  let unitScale = 0.04;      // current radius; grows on absorb
  let absorbed = 0;
  const orbMeshes = new Map(); // open-cell index -> orb mesh
  let orbRng = mulberry32(1);  // reseeded per maze
  // which of the three death sounds plays is deterministic per seed, so a
  // replayed board sounds identical (mulberry32, house convention)
  let deathPick = mulberry32(1);

  // Hydraulics you can SEE. The pneumatics already sound like they lift the
  // hull; hoverT is the same gesture in the geometry, so the sound explains
  // a movement instead of decorating one. settleT drives a damped rock as
  // the tank sets back down — it starts high so a fresh spawn doesn't rock.
  const feel = makeTankFeel(); // hover / vibration / touchdown, shared with the viewer
  // The whole-unit lift is gone: on a model with a hover skirt the body
  // rises and the skirt stays planted (see units.js). Units without that
  // split simply do not hover, which is correct — a dot-cloud creature has
  // no suspension to compress.
  let respawnClock = 0;

  // --- battle state --------------------------------------------------------
  const AMMO_MAX = 9;
  let ammo = 3;
  // THE MINE RACK. The field is the pure module's; everything three.js
  // about a mine lives in mineObjs, keyed by the module's id — so the
  // rules and the discs can never disagree about how many there are.
  const mineTune = { ...MINE_TUNE };
  {
    const mq = new URLSearchParams(location.search);   // urlParams is a TDZ trap here
    const n = parseInt(mq.get('mines'), 10);
    if (Number.isFinite(n)) mineTune.start = Math.max(0, Math.min(mineTune.cap, n));
    if (mq.get('minearcs') === '0') params.mineArcs = false;
  }
  let mineField = makeField(mineTune);
  const mineObjs = new Map();   // id -> { grp, disc, ring, fan }
  const mineProbeOn = new URLSearchParams(location.search).get('mineprobe') === '1';
  const shieldProbeOn = new URLSearchParams(location.search).get('shieldprobe') === '1';

  // --- THE RESCUE MISSION --------------------------------------------------
  // `?mission=rescue`. A mission is a VARIANT of this board, not a second
  // copy of it: same planet, same tank, same gates, same mines. Two things
  // change — the objective and the supply — and everything else the board
  // already does is what a rescue needs. `mission` is the seam every later
  // one hangs on.
  const rescueTune = { ...RESCUE_TUNE };
  const missionName = new URLSearchParams(location.search).get('mission') || '';
  const rescueOn = missionName === 'rescue';
  // RESCUE 2 — the raid (docs/superpowers/specs/2026-09-05-rescue-2.md). Both
  // missions stay, so they can be played against each other. `missionOn` is
  // the guard everything they SHARE reads — the suppressed campaign systems,
  // the briefing, the endings — while each mission's own rules key off its
  // own flag. Writing the shared ones as `rescueOn || rescue2On` at fourteen
  // sites is how the third mission breaks one of them.
  const rescue2On = missionName === 'rescue2';
  const missionOn = rescueOn || rescue2On;
  {
    const rq = new URLSearchParams(location.search);
    const ns = parseInt(rq.get('survivors'), 10);
    if (Number.isFinite(ns)) rescueTune.survivors = Math.max(1, Math.min(12, ns));
    if (rq.get('lasers') === '1') rescueTune.lasers = true;
    // THE BUDGET IS THE MISSION. Set on the tune before makeField reads it,
    // so the rack starts at the mission's number and not the campaign's.
    if (rescueOn) { mineTune.start = rescueTune.mines; mineField = makeField(mineTune); }
  }
  // THE BOARD'S DEEP LINK. A board is only reproducible with its SEED, and
  // the seed can move under you — a regenerate, a new planet — so it is
  // always written rather than diffed against the opening default. The
  // mission is diffed, so a campaign link simply has no mission in it.
  wireDeepLink(root.querySelector('#td-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'td',
    carry: location.search,
    params: { seed: params.seed, mission: missionName },
    defaults: { mission: '' },
  }), { label: 'TD', flash: (m) => showToast(`<div class="wave-role">${m}</div>`, 2600) });

  const rescue2Tune = { ...RESCUE2_TUNE };
  {
    const rq = new URLSearchParams(location.search);
    const nc = parseInt(rq.get('camps'), 10);
    if (Number.isFinite(nc)) rescue2Tune.camps = Math.max(1, Math.min(8, nc));
    const ng = parseInt(rq.get('garrison'), 10);
    if (Number.isFinite(ng)) rescue2Tune.garrison = Math.max(0, ng);
    if (rq.get('lasers') === '1') rescue2Tune.lasers = true;
    if (rescue2On) { mineTune.start = rescue2Tune.mines; mineField = makeField(mineTune); }
  }
  // A LARGER MAP WITH MORE CLEARINGS (the brief). `rooms` is what "clearings"
  // means on this generator, so that is the number that moves most. Set on
  // `params` HERE, before the first regenerate, because the board is built
  // from them and a mission that resizes the map after the build resizes
  // nothing. `?points=` and friends still win — a probe must be able to
  // shrink it.
  if (rescue2On) {
    const rq = new URLSearchParams(location.search);
    if (!rq.get('points')) params.points = 1600;
    if (!rq.get('rooms')) params.rooms = 26;
    params.roomRadius = 5;
    params.obstacles = 0.16;
  }
  let rescue = makeRescue(rescueTune);
  const survObjs = new Map();      // survivor id -> Group
  let rescueEnded = false;
  if (missionOn) {
    // the key legend is the one line of chrome that TELLS you what game you
    // are playing; on a mission with no towers and no build mode it must not
    // still be advertising them
    const hintEl = root.querySelector('#td-hint');
    if (hintEl) {
      hintEl.textContent = rescue2On
        ? `RAID · drive up to a container to open it · then STAND STILL while they walk out`
          + ` · MOVING kills them · ram the soft ones · SPACE shell · N mine · no resupply`
        : `RESCUE · drive to a beacon and STOP to load`
          + ` · ${rescueTune.seats} seats · deliver at the Stålheart`
          + ` · SPACE shell · N mine · no resupply`;
    }
  }
  const enemies = [];      // { cur, prev, next, prog, pos, dir, obj, alive }
  const projectiles = [];  // { pos, dir, dist, mesh }
  const debris = [];       // scatter effects, tick(dt) -> alive
  const spawnPoints = [];  // { ci, hp, obj, alive, found, mapMarker } — type-agnostic gates
  let wave = 0;
  let waveActive = false; // a wave's enemies are live/uncleared

  // --- THE SPINE -----------------------------------------------------------
  // A RUN IS FIVE SECTORS, and a sector has two phases in order:
  //
  //   THE PROGRAMME  the sector sends `wavesPerSector` waves. That is how
  //                  many it has; when they are spent, no more come.
  //   THE GATES      kill every one and the sector is yours, at ANY point.
  //
  // Gates are never immune. Drive out, put three shells in one, and it is
  // down — that is the whole of the aggressive line, and it is meant to
  // work. It is also NOT free, which is why it needs no rule to restrain
  // it: every gate you close early is a wave that never arrives, and the
  // kills, the biomass and the score in it never arrive either. Hold the
  // line and you finish rich; end it early and you finish alive. The game
  // balances that on its own, and an immune portal was me not trusting it.
  //
  // Clearing sector 5 is the planet, and the planet is the win.
  //
  // This replaces the TOURS layer, which was a second answer to the same
  // question — "what is a run made of" — that did not nest with the first.
  // A player could finish a tour while a sector sat half-cleared, so the
  // game announced TOUR 1 SURVIVED over a wave counter marching into 16.
  const SECTORS_TOTAL = 5;
  let sectorStartWave = 0;       // the wave this sector's HOLD began at
  let sectorsCleared = 0;
  const sectorWave = () => Math.max(0, wave - sectorStartWave);
  // the programme is spent: no more waves are sent, and whatever gates are
  // still standing are a mop-up rather than a siege
  const programmeDone = () => sectorWave() >= params.wavesPerSector;

  // --- ISAO SPEAKING -------------------------------------------------------
  // A face, a title, and one line at a time. One line, because these are
  // written to be spoken and a wall of text is the thing a voice pass would
  // have to undo. Advancing is a tap anywhere on the panel.
  //
  // It does NOT pause the game. Isao talks between waves and while you
  // drive; a modal for every remark would make him something to get past
  // rather than someone in the vehicle with you.
  const briefEl = root.querySelector('#td-brief');
  const briefFace = root.querySelector('#td-brief-face');
  const briefTitle = root.querySelector('#td-brief-title');
  const briefLine = root.querySelector('#td-brief-line');
  const briefDots = root.querySelector('#td-brief-dots');
  const BRIEF_SEEN = 'td.briefs';
  let briefQ = null, briefAt = 0, briefFaceT = 0;
  // Seconds left on the current LINE. A countdown driven from the frame loop,
  // deliberately not a setTimeout: this file has already paid once for
  // deferred work outliving the run that scheduled it (the death timer that
  // fired after a retry), and a frame-loop accumulator cannot outlive
  // anything. `briefDwell` is kept only to size the progress bar.
  let briefLeft = 0, briefDwell = 1;
  let briefPending = null;   // at most one beat waiting its turn
  const briefSeen = (() => {
    try { const v = JSON.parse(localStorage.getItem(BRIEF_SEEN) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
  })();

  const briefBar = root.querySelector('#td-brief-bar');
  function paintBrief() {
    if (!briefQ) return;
    briefTitle.textContent = briefQ.title;
    briefLine.textContent = briefQ.lines[briefAt];
    briefDots.textContent = briefQ.lines.map((_, i) => (i === briefAt ? '●' : '○')).join(' ');
    // The bar is the affordance that says THIS WILL PASS. Without it a player
    // who has learned to tap keeps tapping, and the auto-advance buys nothing.
    if (briefBar) briefBar.style.width = `${Math.max(0, Math.min(1, briefLeft / briefDwell)) * 100}%`;
    const ctx = briefFace.getContext('2d');
    drawEmotion(ctx, briefQ.face, { w: briefFace.width, h: briefFace.height, t: briefFaceT });
  }
  function showBrief(id) {
    if (director) return;   // Isao does not caption a cinematic

    const b = brief(id);
    if (!b || !briefEl) return;
    if (b.once && briefSeen.includes(id)) return;
    if (b.once && briefPending === id) return;
    // ONE DEEP, AND NO DEEPER. With eight beats two can come due together —
    // the first kill of a wave that has only just been announced, say. Showing
    // the new one on top loses the old one for good, because a `once` beat is
    // marked seen the moment it appears; queueing everything turns Isao into
    // the wall of messages this work exists to remove. So: hold exactly one,
    // and drop any further arrivals on the floor. A beat worth saying twice
    // should not be `once` in the first place.
    if (briefQ) { if (!briefPending) briefPending = id; return; }
    if (b.once) {
      briefSeen.push(id);
      try { localStorage.setItem(BRIEF_SEEN, JSON.stringify(briefSeen)); } catch { /* private mode */ }
    }
    briefQ = b; briefAt = 0; briefFaceT = 0;
    briefDwell = briefLeft = dwellFor(b.lines[0]);
    briefEl.classList.remove('hidden');
    sfx.play('laser_click');
    paintBrief();
  }
  // `auto` = the line ran out of time rather than being tapped through. The
  // click is the player's, so it keeps its click; a line retiring on its own
  // must not make a noise, or the panel is still demanding attention — which
  // is the whole thing being fixed.
  function stepBrief(auto) {
    if (!briefQ) return;
    briefAt++;
    if (briefAt >= briefQ.lines.length) { endBrief(); return; }
    if (!auto) sfx.play('laser_click');
    briefDwell = briefLeft = dwellFor(briefQ.lines[briefAt]);
    paintBrief();
  }
  // The line clock, as a named function rather than four lines inside animate:
  // a probe never runs animate, so anything buried in the frame loop is
  // unverifiable by construction — and this project has already reported a
  // PASS against a fix it had never exercised for exactly that reason.
  function stepBriefClock(dt) {
    if (!briefQ) return;
    briefFaceT += dt;
    briefLeft -= dt;
    if (briefLeft <= 0) stepBrief(true); else paintBrief();
  }
  function endBrief() {
    briefQ = null; briefLeft = 0;
    if (briefEl) briefEl.classList.add('hidden');
    if (briefPending) { const nxt = briefPending; briefPending = null; showBrief(nxt); }
  }
  function clearBriefs() { briefPending = null; endBrief(); }
  if (briefEl) briefEl.addEventListener('click', () => stepBrief(false));

  // --- THE RECORD ----------------------------------------------------------
  // One flat object of run facts, fed to a pure evaluator. Kept as a single
  // mutable record rather than scattered counters so that adding an
  // achievement never means adding a counter somewhere else and hoping the
  // two stay in step.
  const ACHV_KEY = 'td.achievements';
  let run = blankRun();
  let runAchv = [];   // earned THIS run, for the debrief card
  const heldAchv = (() => {
    // through sanitiseRecord, not straight out of JSON.parse: a stored value
    // of the wrong shape is not a corrupt achievement list, it is a crash at
    // boot, and the tab that dies is the whole game
    try { return sanitiseRecord(JSON.parse(localStorage.getItem(ACHV_KEY) || '[]')); }
    catch { return []; }
  })();
  function checkAchievements() {
    const fresh = freshlyEarned(heldAchv, earned(run));
    if (!fresh.length) return;
    for (const id of fresh) heldAchv.push(id);
    try { localStorage.setItem(ACHV_KEY, JSON.stringify(heldAchv)); } catch { /* private mode */ }
    // one at a time, oldest first: a stack of five toasts is a stack nobody
    // reads, and the streak ladder in particular fires in clumps
    for (const id of fresh) if (!runAchv.includes(id)) runAchv.push(id);
    const a = achievement(fresh[0]);
    if (a) {
      sfx.play('tower_upgrade');
      showToast(`<div class="wave-num">&#10022; ${a.name}</div>`
        + `<div class="wave-role">${a.note}</div>`
        + (fresh.length > 1 ? `<div class="wave-role">+${fresh.length - 1} more</div>` : ''),
      3400);
    }
  }
  let interClock = 0;     // anticipation countdown between waves
  let waveAge = 0;        // seconds since the current wave spawned (safety cap)
  const seenTypes = new Set(); // headline types already revealed this run
  // roster data (tints/specs/intros) lives in enemyspec.js — one source
  // of truth shared with the TD tab (M0 extraction). See that module for
  // the field semantics.
  // ROUNDS = SECTORS (HokorobiTawaa's fraying, spherized): ONE persistent
  // world per run. Round 1 opens only a small inner region around the
  // Heart — the rest of the sphere is SEALED (reads as solid wall mass).
  // Clearing every portal flashes the frontier open: a wider ring
  // unseals, farther portals rise, the wave counter keeps counting, and
  // YOUR TOWERS AND PURSE STAY. Two more threat types unlock per round.
  let round = 1;
  let tutorialActive = false;
  // THE DIRECTOR (declared here, assigned far below): the guards that yield
  // to it — heartHit, loseTank, showBrief, checkVictory, the engine's idle
  // stop — run from anywhere, including boot; a `let` down at the director
  // block was a TDZ ReferenceError for any caller before it (?view=orbit at
  // boot: showBrief threw, the tab half-initialised, the camera stuck)
  let director = null;
  let runTutorial = true; // resolved from ?tutorial in the URL-hook block
  const tutEl = root.querySelector('#td-tut');
  let tdFullTags = null;  // the true world, pre-sealing
  let tdFullDist = null;  // heart-distance over the full world
  let tdMaxD = 0;
  // PRE-DECIDED DIRECTIONAL SECTORS: 1 = the inner disk around the Heart;
  // 2..5 = four azimuth lobes, opening in OPPOSITE-ALTERNATING order —
  // the second reveal opens BEHIND the first (south after north), the
  // third and fourth take the perpendicular pair. Expansion sweeps AROUND
  // the planet instead of running deeper down lanes already cleared.
  let tdSectorId = null; // per-cell sector number (1..5); 6 = never (walls)
  // seal/unseal to the current round's fraction; optionally re-pick the
  // player start (only at run start — expansions don't teleport you)
  function applySector(resetSpawn = false) {
    for (let i = 0; i < dungeon.tags.length; i++) {
      // A RAID HAS NOWHERE TO PROGRESS TO. Sector gating is the campaign's
      // spine; on rescue 2 the whole shell is the mission's ground from the
      // first frame, so the sector clause simply does not apply.
      dungeon.tags[i] = (tdFullTags[i] !== BLOCKED && (rescue2On || tdSectorId[i] <= round))
        ? tdFullTags[i] : BLOCKED;
    }
    let d = bfsDist(graph.adj, [dungeon.heart],
      (i) => dungeon.tags[i] !== BLOCKED);
    // lanes wander across lobe borders: any opened cell the Heart cannot
    // reach yet belongs with a future reveal — seal it back for now
    // (recomputed from scratch each round, so it reopens with its lobe)
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] !== BLOCKED && d[i] === -1) dungeon.tags[i] = BLOCKED;
    }
    // THE VAULT IS ALWAYS FLOOR. The chamber is exempt from the band gate
    // AND the reachability seal: it renders as an open room inside the
    // rock from round 1, unreachable until a wall is blasted or the
    // frontier arrives — the operator's stated design. Its cells keep
    // distToHeart -1, so nav, rewards, and portal picks all ignore it.
    for (const ci of serverChamber) dungeon.tags[ci] = ROOM;
    // ...and so are the player's breaches: paid-for demolition survives
    // the frontier shift. (Before the seal on purpose — a breach tunnel
    // that connects to the open network is thereby REACHABLE and stays.)
    for (const ci of breachedCells) {
      if (ci !== serverCi && !towerByCell.has(ci)) dungeon.tags[ci] = PATH;
    }
    dungeon.distToHeart = d;
    {
      let n = 0;
      for (let i = 0; i < dungeon.tags.length; i++) if (dungeon.tags[i] !== BLOCKED) n++;
      console.log(`sector ${round}: ${n} open cells`);
    }
    if (resetSpawn) {
      let sp = -1, bd = -1;
      for (let i = 0; i < dungeon.tags.length; i++) {
        if (dungeon.tags[i] !== BLOCKED && dungeon.distToHeart[i] > bd) {
          bd = dungeon.distToHeart[i]; sp = i;
        }
      }
      dungeon.spawn = sp;
    }
  }
  const rewardMeshes = new Map(); // cell -> { obj, type } far-field rewards
  let heartHP = 10;
  const HEART_MAX = 10;
  let playerHP = 3;
  const PLAYER_MAX = 3;
  // A destroyed tank is DOWN, not merely invisible. Without this flag the
  // wreck kept its whole agency through the death hold — it drove (auto),
  // rammed enemies for combo and pay, took touch damage (a second life,
  // gone — the RED accents), and grabbed pickups — all while hidden. The
  // player then 'respawned where they died' because the ghost had driven
  // itself somewhere in the meantime.
  let playerDown = false;
  let carryingRegen = false;
  let speedBonus = 1; // permanent, from power rewards
  // the energy shield: a timed bubble over the hull — touch damage
  // bounces off while it holds. shieldObj is lazy-built, scene-level
  // (positioned each frame like the marker, so parent scale can't warp it)
  // a plain spread, exactly as `mineTune` below — there is no tuner panel for
  // either, and inventing one for the shield alone would be a second idiom for
  // the same job. The knobs are reachable BY NAME from the URL, which is how
  // SENTRY_TUNE and BALLISTICS_TUNE are already moved.
  const shieldTune = { ...SHIELD_TUNE };
  const shield = makeShield(shieldTune);
  const shieldUp = () => shield.t > 0;
  let shieldObj = null;
  // The tank's field promotion. Only hands-on kills climb it — towers and
  // orbital strikes pay biomass, not respect — and the ladder belongs to
  // the HULL: lose the tank, lose the insignia. Gold's second gate counts
  // the dangerous (non-rammable) tier killed up close.
  let tankKills = 0, tankEliteKills = 0, tankRank = 0;
  let rankBadgeHud = '';
  // the boss omen (brass, 10s before the knot's wave) and the proximity
  // klaxon (once per wave, first dangerous contact)
  const BOSS_WAVE = INTROS.find((i) => ENEMY_SPEC[i.type]?.boss)?.wave ?? -1;
  let bossCued = false;
  let dangerWarnedWave = -1;
  // Callouts: quick bragging text for the plays worth bragging about.
  // Message lists ROTATE (a counter, not Math.random — house rule) so
  // repeats spread out deterministically.
  const RECKLESS_MSGS = ['RECKLESS!', 'すげ〜！', 'CLOSE CALL!', 'ヤバイ！',
    'TIGHT!', '接近だ！', 'FEARLESS!', '接近過ぎ！',
    "pt1 c'est chaud!", 'ギリギリ', 'NEAR MISS', '危機一髪',
    'DODGE THIS', '助かった', 'DOWN TO THE WIRE', 'あぶねー',
    'SKETCHY', 'セーフ！', 'moins une!', "c'est limite la",
    'ca passe ou ca casse'];
  const HEART_MSGS = ['PROTECT THE HEART!', 'LIVING DANGEROUSLY!',
    'NEED SAFETY BUFFER!', 'LAST LINE HOLDS!'];
  let recklessIdx = 0, heartIdx = 0;
  let heartCalloutCd = 0;   // seconds; near-heart kills happen in bursts
  let streakMark = 0;       // last streak milestone already called out
  // the tap ledger is keyed by tower, and an ARRAY INDEX is not stable across
  // a sell — a sold tower would hand its outage to whatever slid into its slot
  let nextTowerId = 1;
  let ramCombo = 0, ramComboT = 0;  // count-up + its expiry window
  const RAM_COMBO_GAP = 4;
  // SitRep bookkeeping: everything the end-of-wave recap reports. Bins are
  // 3s buckets of kill tempo — the sparkline is drawn from them.
  // --- SIM autoplay (tier-1 gameplay simulation) --------------------------
  // ?sim=style1|style0 plays the game by policy at ?simfast=K (default 50
  // fixed steps per frame). style1 is the operator's stated modus operandi:
  // ram rammable / avoid solids (the ram directive already avoids nothing —
  // solids shrug rams off, so the flee vector is deliberately NOT applied
  // to it; the tank trades hull for kills exactly like the operator does),
  // SLOW and AOE at bottlenecks, SNIPER everywhere, upgrades with spare
  // biomass. style0 is the deliberate floor: wander, build nothing.
  let simFast = 0, simStyle = null, simPolClock = 0, simDone = false;
  // ECONOMY MEASURE (operator, 2026-09-02: "biomass is much too easy to
  // acquire, but rather than going by feel, let's be systematic"). Two
  // numbers the feeling turns on: how much of the run the purse could
  // afford the cheapest tower without waiting (a purse that is never short
  // is not an economy), and how much of what was earned was ever spent.
  let ecoAffordT = 0, ecoClockT = 0;
  const CHEAPEST_TOWER = Math.min(...TOWERS.map(d => d.cost));
  const simCurve = []; // one point per wave CLEAR: the tuning signal
  let simCap = 600; // sim-seconds before a run reports 'timeout'
  function simTrunk() {
    // traffic: greedy descent from each live portal toward the heart; a
    // cell on 2+ routes is trunk — the lanes the policy fortifies
    const count = new Map();
    const live = spawnPoints.filter((sp) => sp.alive);
    for (const sp of live) {
      let cur = sp.ci, guard = 0;
      while (dungeon.distToHeart[cur] > 0 && guard++ < 500) {
        count.set(cur, (count.get(cur) || 0) + 1);
        let best = cur;
        for (const nb of graph.adj[cur]) {
          if (dungeon.tags[nb] !== BLOCKED && dungeon.distToHeart[nb] >= 0
            && dungeon.distToHeart[nb] < dungeon.distToHeart[best]) best = nb;
        }
        if (best === cur) break;
        cur = best;
      }
    }
    const need = Math.min(2, Math.max(1, live.length));
    return [...count.entries()].filter(([, c]) => c >= need).map(([ci]) => ci);
  }
  function simBuild() {
    const trunk = simTrunk();
    if (!trunk.length) return;
    const unlockedSet = new Set(unlockedTowerKeys(wave, hackedUnlocks));
    const have = (k) => towers.reduce((a, tw) => a + (tw.def.key === k ? 1 : 0), 0);
    // ISAO'S POLICY IS A SHAPE, NOT A SHOPPING LIST. It was three literal
    // keys, which is a policy that silently builds nothing on any board
    // where those keys do not exist. What the sim batch actually learned
    // was "two slow fields, two lobbers, and reach everywhere" — so it asks
    // the roster for the towers with those ATTACKS and takes the first of
    // each, which is the same policy on either board.
    const byAttack = (atk) => (TOWERS.find((d) => d.attack === atk) || {}).key;
    const longest = TOWERS.reduce((a, d) => (!a || d.range > a.range ? d : a), null);
    const wants = [];
    for (const atk of ['slowfield', 'mortar']) {
      const k = byAttack(atk);
      if (k && have(k) < 2) wants.push(k);
    }
    if (longest) wants.push(longest.key);  // '...with sniper everywhere'
    // the opening: the preferred kit unlocks at waves 4-7, and the very
    // first batch run proved a policy with no early fallback builds
    // NOTHING and loses the heart by wave 2 — so until the kit arrives,
    // keep pace with the waves using the newest thing unlocked
    if (towers.length < Math.min(4, wave)) {
      wants.unshift(unlockedTowerKeys(wave, hackedUnlocks).pop());
    }
    for (const k of wants) {
      if (!unlockedSet.has(k)) continue;
      const def = TOWER_BY_KEY[k];
      if (!eco.canAfford(def.cost)) return; // save up for the priority buy
      for (const tci of trunk) {
        for (const nb of graph.adj[tci]) {
          if (!placeError(nb)) { orderTower(k, nb); return; }
        }
      }
      break; // unlocked and affordable but nowhere to put it — fall through
    }
    // nothing to place: spend spare biomass on the cheapest upgrade
    let bestT = null, bestC = Infinity;
    for (const tw of towers) {
      const c = upgradeCost(tw.def, tw.tier);
      if (c !== null && c < bestC && eco.canAfford(c)) { bestC = c; bestT = tw; }
    }
    if (bestT) orderUpgrade(bestT);
  }
  // style2 'builder': stay out of trouble, spend EVERYTHING on towers —
  // newest unlocked first, upgrades with the change. This style survives
  // into the mid-game, which is where the biomass-flood question lives.
  function simBuildAll() {
    const trunk = simTrunk();
    if (!trunk.length) return;
    const keys2 = unlockedTowerKeys(wave, hackedUnlocks).slice().reverse();
    for (const k of keys2) {
      const def = TOWER_BY_KEY[k];
      if (!eco.canAfford(def.cost)) continue;
      for (const tci of trunk) {
        for (const nb of graph.adj[tci]) {
          if (!placeError(nb)) { orderTower(k, nb); return; }
        }
      }
    }
    let bestT = null, bestC = Infinity;
    for (const tw of towers) {
      const c = upgradeCost(tw.def, tw.tier);
      if (c !== null && c < bestC && eco.canAfford(c)) { bestC = c; bestT = tw; }
    }
    if (bestT) orderUpgrade(bestT);
  }
  function simPolicy(dt) {
    simPolClock += dt;
    if (simPolClock < 2) return; // decide every 2 SIM-seconds
    simPolClock = 0;
    const wantDir = simStyle === 'style1' ? 'ram'
      : simStyle === 'style2' ? 'avoid' : 'wander';
    if (params.directive !== wantDir || !autoMode) {
      params.directive = wantDir;
      autoMode = true;
    }
    if (simStyle === 'style1') simBuild();
    else if (simStyle === 'style2') simBuildAll();
  }
  function simWatch() {
    if (simDone) return;
    if (player.won) {
      const outcome = missionOn ? (heartHP <= 0 || playerHP <= 0 ? 'loss' : 'mission-complete')
        : simOutcome({ heart: heartHP, lives: playerHP, round, total: SECTORS_TOTAL });
      if (outcome === 'sector-clear' && new URLSearchParams(location.search).get('simscope') !== 'sector') {
        endShot();
        if (!breachNextSector()) { simEmit('stalled'); return; }
        endShot(); setView('third');
        return;
      }
      simEmit(outcome);
    }
    else if (t > simCap) simEmit('timeout');
  }
  function simEmit(outcome) {
    simDone = true;
    const payload = { schema: 2, application: 'stalheart',
      build: document.querySelector('meta[name="cb"]')?.content || 'source',
      scope: new URLSearchParams(location.search).get('simscope') === 'sector' ? 'sector' : 'campaign',
      balance: 'migration-1', content: CONTENT.id, generator: 'research-1900c9d', roster: ROSTER.id,
      mission: new URLSearchParams(location.search).get('mission') || 'defense',
      runId: new URLSearchParams(location.search).get('runid') || 'standalone',
      config: { ...params }, simulationStep: 1 / 30,
      style: simStyle, seed: params.seed >>> 0, outcome, wave, round,
      score: score.points, heart: heartHP, lives: playerHP,
      towers: towers.length, biomass: eco.biomass, simT: Math.round(t),
      curve: simCurve, sectors: campaign,
      economy: {
        earned: eco.earned, spent: eco.spent, peak: eco.peak, held: eco.biomass,
        starting: eco.starting, ledger: eco.ledger, netSpent: eco.spent - eco.ledger.refunds,
        spendRatio: eco.starting + eco.earned ? +((eco.spent - eco.ledger.refunds) / (eco.starting + eco.earned)).toFixed(2) : 0,
        affordable: ecoClockT ? +(ecoAffordT / ecoClockT).toFixed(2) : 0,
        perWave: wave ? Math.round(eco.earned / wave) : 0,
      } };
    record('sim.result', payload);
    window.__stalheartSimResult = payload;
    console.log('SIMRESULT ' + JSON.stringify(payload));
    try {
      if (window.parent !== window) window.parent.postMessage({ simresult: payload }, location.origin);
    } catch { /* sandboxed parent */ }
  }

  // RUN-level bookkeeping: everything the final send-off reports. Wave
  // stats (ws) reset each wave; these accumulate until the run ends.
  let rs = null;
  function resetRunStats() {
    rs = { kills: {}, bySrc: { tank: 0, tower: 0, strike: 0 }, rams: 0,
      strikes: 0, maxCombo: 0, killers: [], maxRank: 0,
      scoreBins: [], binClock: 0,
      // THE ANALYST'S RECORDS (operator, 2026-09-02): the single best shell
      // and the single best orbital strike, and enough of the strike to
      // replay it — bodies on the tangent plane at impact, and which died.
      shells: 0, bestShell: { kills: 0, wave: 0 },
      bestStrike: { kills: 0, wave: 0, replay: null } };
  }
  resetRunStats();

  let ws = null;
  function resetWaveStats() {
    ws = { t0: runContext.time, kills: {}, bySrc: { tank: 0, tower: 0, strike: 0 },
      rams: 0, points0: score.points, maxMult: 1, leaks: 0,
      bins: new Array(16).fill(0) };
  }
  function noteWaveKill(type, src) {
    // the economy, taught at the moment the player has just earned some and
    // not a second before — every kill in the game passes through here
    showBrief('harvest');
    if (rs) {
      rs.kills[type] = (rs.kills[type] || 0) + 1;
      rs.bySrc[src] = (rs.bySrc[src] || 0) + 1;
    }
    if (!ws) return;
    ws.kills[type] = (ws.kills[type] || 0) + 1;
    ws.bySrc[src] = (ws.bySrc[src] || 0) + 1;
    ws.bins[Math.min(15, Math.floor((runContext.time - ws.t0) / 3))]++;
    ws.maxMult = Math.max(ws.maxMult, eco.multiplier());
  }

  // phagocytosis state, recomputed per frame (amoeba only)
  const reach = { dir: null, amt: 0 };
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const X_AXIS = new THREE.Vector3(1, 0, 0);   // local pitch axis after a lookAt
  const tmpN = new THREE.Vector3();

  // groups (bullet triads, mesh units) carry geometry in children
  function disposeObj(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  function clearOrbs() {
    for (const orb of orbMeshes.values()) {
      scene.remove(orb);
      disposeObj(orb);
    }
    orbMeshes.clear();
  }

  // ammo pickup: THREE half-dotted Braille shells standing side-by-side
  // on a random open cell (never spawn/heart/occupied/under the creature).
  // The set reads as what it gives: +3 bullets.
  function spawnOneOrb() {
    const open = [];
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] !== BLOCKED && i !== dungeon.spawn && i !== dungeon.heart
        && i !== player.cur && !orbMeshes.has(i)) open.push(i);
    }
    if (open.length === 0) return false;
    return spawnOrbAt(open[Math.floor(orbRng() * open.length)]);
  }
  function spawnOrbAt(ci) {
    if (orbMeshes.has(ci)) return false;
    const r = cellSide * 0.14;
    const group = new THREE.Group();
    const phase = orbRng() * 6.283;
    const shells = [];
    for (let k = -1; k <= 1; k++) {
      const b = makeShellSolid({ body: look().orb.color, hi: 0xffffff });
      b.scale.setScalar(r * 0.62);
      b.position.set(k * r * 1.7, r * 1.1, 0); // side-by-side, noses up
      group.add(b);
      shells.push(b);
    }
    const c = graph.centers[ci];
    const n = graph.normals[ci];
    group.position.set(c[0], c[1], c[2]);
    tmpN.set(n[0], n[1], n[2]);
    group.quaternion.setFromUnitVectors(Y_AXIS, tmpN); // local +Y = surface normal
    // transform-only idle: spin PURELY about the cell's normal. Euler trap:
    // writing rotation.y would REPLACE the alignment quaternion above (they
    // are two views of one rotation) and spin about world-Y — shells then
    // tilt into the ground everywhere but the pole. Compose quaternions:
    // base alignment × local-Y spin.
    const baseQ = group.quaternion.clone();
    const spinQ = new THREE.Quaternion();
    group.userData.tick = (t) => {
      spinQ.setFromAxisAngle(Y_AXIS, t * 0.9 + phase);
      group.quaternion.copy(baseQ).multiply(spinQ);
      for (let k = 0; k < 3; k++) {
        shells[k].position.y = r * (1.1 + 0.25 * Math.sin(t * 2.2 + phase + k * 2.1));
      }
    };
    scene.add(group);
    orbMeshes.set(ci, group);
    return true;
  }

  function spawnOrbs() {
    clearOrbs();
    for (let k = 0; k < params.orbs; k++) spawnOneOrb();
  }

  function absorbOrb(ci) {
    const orb = orbMeshes.get(ci);
    if (!orb) return;
    scene.remove(orb);
    disposeObj(orb);
    orbMeshes.delete(ci);
    absorbed++;
    ammo = Math.min(AMMO_MAX, ammo + 3); // a triad is three shells
    sfx.play('tank_shells');
    updateHud();
  }

  // nearest orb to the creature's position; absorb on contact
  function nearestOrb() {
    let bestCi = -1, bestD = Infinity;
    for (const [ci, orb] of orbMeshes) {
      const dx = orb.position.x - player.pos[0];
      const dy = orb.position.y - player.pos[1];
      const dz = orb.position.z - player.pos[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < bestD) { bestD = d; bestCi = ci; }
    }
    return { ci: bestCi, d: bestD };
  }

  function checkAbsorb() {
    const { ci, d } = nearestOrb();
    if (ci !== -1 && d < unitScale * 0.85 + cellSide * 0.16) absorbOrb(ci);
  }

  // The walker WANDERS on its own: it glides cell-to-cell continuously and
  // picks each next exit itself. `heading` is the STEERING INTENT (what A/D
  // rotate) — it biases the choice but doesn't command it. `travelDir` is
  // where the walker is actually going; the camera and cone follow that.
  const player = {
    cur: 0, prev: -1,
    next: -1,           // cell being glided toward
    prog: 0,            // 0..1 along cur -> next
    pos: [1, 0, 0],     // interpolated position on the sphere
    travelDir: [0, 1, 0],
    smoothDir: [0, 1, 0], // rate-limited travelDir — cameras/creature follow THIS
    heading: [1, 0, 0], // steering intent, unit tangent
    segLen: 1,          // world length of the current cur->next chord
    freeMode: false,    // true while manual drives the position off-graph
    virtualStart: null, // glide origin when auto resumes from a free position
    moves: 0,
    visited: new Set(),
    won: false,
  };
  let whim = mulberry32(1); // the walker's own randomness, reseeded per maze
  let cellIndex = () => -1; // voxel-hash nearest-cell lookup, built per board
  let unitBlocker = () => false; // per-tab solid units (tanks, structures)

  // free-move collision: the position is blocked if its cell is wall, if it
  // presses into a blocked neighbour's margin (no more nosing into walls),
  // or if a solid unit stands there
  // how many open neighbours a cell has — ≤3 means a narrow hall or a
  // corner pocket, where the anti-clipping margins must relax or the
  // hitbox wedges the tank (the stuck-in-width-1-corridor bug)
  function openCount(ci) {
    let n = 0;
    for (const nb of graph.adj[ci]) if (dungeon.tags[nb] !== BLOCKED) n++;
    return n;
  }

  // a life container blocks like a wall — except for the hull currently
  // berthed in it (spawns start INSIDE and drive out; once out, the box
  // is solid again behind you)
  function containerBlocked(ci) {
    return ci !== player.cur && lifeContainers.some((cc) => cc.ci === ci);
  }
  // ...and while you are still IN a berth, the boxes either side of you do
  // not crowd the exit. The margin test below treats a solid neighbour as a
  // no-go shell around the lane, which between three boxes in a row leaves a
  // gap the hull cannot thread — the second half of the operator's
  // can't-get-out report. Clear of the berth, they go solid again.
  const berthed = () => lifeContainers.some((cc) => cc.ci === player.cur);
  // THE TERRAFORMER IS SOLID TOO (operator, 2026-09-02: "currently the tank
  // can drive under"). Its pad radius is measured off the model, so a
  // re-export follows. Enemies are NOT kept out — they have to reach the
  // heart — so the cells stay open and only the TANK is turned away.
  function pedestalRadius() {
    if (heartLook().footprint) return heartLook().footprint * heartLook().scale * cellSide;
    return heartSprite && heartSprite.userData.padR
      ? heartSprite.userData.padR * heartSprite.userData.sizeScale : cellSide * 1.4;
  }
  function pedestalBlocked(ci) {
    return dist3(graph.centers[ci], graph.centers[dungeon.heart]) < pedestalRadius() + cellSide * 0.45;
  }
  function freeBlocked(cand) {
    const ci = cellIndex(cand);
    // the SERVER is solid: a machine you can drive through is a prop, not
    // a fixture (operator field report — the tank phased clean through)
    if (ci === -1 || dungeon.tags[ci] === BLOCKED || ci === serverCi
      || containerBlocked(ci)) return true;
    if (dist3(cand, graph.centers[dungeon.heart]) < pedestalRadius() + cellSide * 0.3) return true;
    // wide ground keeps the clipping margin; narrow halls trade a little
    // visual overlap for guaranteed passability
    const margin = cellSide * (openCount(ci) <= 3 ? 0.45 : 0.62);
    const crowdedBy = berthed()
      ? (nb) => dungeon.tags[nb] === BLOCKED || nb === serverCi
      : (nb) => dungeon.tags[nb] === BLOCKED || nb === serverCi || containerBlocked(nb);
    for (const nb of graph.adj[ci]) {
      if (crowdedBy(nb) && dist3(cand, graph.centers[nb]) < margin) return true;
    }
    return unitBlocker(cand);
  }

  // nearest blocked neighbour's center, for wall sliding
  function nearestWall(cand) {
    const ci = cellIndex(cand);
    if (ci === -1) return null;
    let best = null, bd = Infinity;
    for (const nb of graph.adj[ci]) {
      if (dungeon.tags[nb] !== BLOCKED) continue;
      const d = dist3(cand, graph.centers[nb]);
      if (d < bd) { bd = d; best = graph.centers[nb]; }
    }
    return best;
  }
  // spawn-point structures are solid; creatures stay passable (contact IS
  // their damage — blocking them would neuter the threat)
  unitBlocker = (cand) => spawnPoints.some((s) => s.alive && dist3(cand, graph.centers[s.ci]) < cellSide * 0.6);

  // WALL CUSHION, corridor-safe edition. The first version (0.95 margin,
  // sequential pushes, two passes, diagonal walls) fixed clipping on the
  // open heart battlefield but WEDGED the tank in width-1 corridors:
  // opposing walls both push every frame, sequential application
  // zigzags, and the push out-muscled the drive step — stuck, and with
  // no shells, stuck for good. Three changes make it passage-safe:
  //   1. margins ADAPT: narrow cells (≤3 open neighbours) use a smaller
  //      band and skip diagonal wall collection (diagonals jam corners)
  //   2. pushes are NET-SUMMED then applied once — opposing walls cancel
  //      into centering instead of fighting
  //   3. the applied push is CAPPED per frame well below drive speed —
  //      the cushion corrects clipping over a few frames, never pins
  function wallCushion(pos) {
    const ci = cellIndex(pos);
    if (ci === -1) return pos;
    // the pedestal first: a hard radial push out of the pad, before the wall
    // cushion adds its own nudges
    {
      const hc = graph.centers[dungeon.heart];
      const rim = pedestalRadius() + cellSide * 0.35;
      const d = dist3(pos, hc);
      if (d < rim) {
        const away = sub3(pos, hc);
        const n = norm3(pos);
        const tg = sub3(away, scale3(n, dot3(away, n)));
        const l = len3(tg);
        if (l > 1e-9) pos = norm3(add3(pos, scale3(tg, (rim - d) / l)));
      }
    }
    const narrow = openCount(ci) <= 3;
    const margin = cellSide * (narrow ? 0.6 : 0.95);
    let px = 0, py = 0, pz = 0;
    const seen = new Set([ci]);
    const consider = (w) => {
      const c = graph.centers[w];
      const d = dist3(pos, c);
      if (d >= margin) return;
      const away = sub3(pos, c);
      const n = norm3(pos);
      const tg = sub3(away, scale3(n, dot3(away, n)));
      const l = len3(tg);
      if (l < 1e-9) return;
      const f = (margin - d) / margin;
      px += (tg[0] / l) * f; py += (tg[1] / l) * f; pz += (tg[2] / l) * f;
    };
    for (const nb of graph.adj[ci]) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      if (dungeon.tags[nb] === BLOCKED) { consider(nb); continue; }
      if (!narrow) {
        for (const nb2 of graph.adj[nb]) {
          if (seen.has(nb2)) continue;
          seen.add(nb2);
          if (dungeon.tags[nb2] === BLOCKED) consider(nb2);
        }
      }
    }
    const mag = Math.hypot(px, py, pz);
    if (mag < 1e-9) return pos;
    const step = Math.min(mag * cellSide * 0.3, cellSide * 0.035);
    return norm3(add3(pos, scale3([px / mag, py / mag, pz / mag], step)));
  }

  // held-key state: steering and pace are continuous while held, not nudges
  const keys = { left: false, right: false, fast: false, slow: false, laser: false,
    droneUp: false, droneDown: false };   // the last two only while flying Isao
  // CRUISE: player-triggered auto-forward. A quick double-tap of the
  // forward control (W / ▲) toggles it; S/▼ always kills it.
  let cruise = false;
  // THROTTLE — one lever replacing the ▲/▼ pair. It HOLDS where you put it,
  // so setting it IS cruise; there is no separate mode to engage. Reverse is
  // the same lever continued below zero and capped: backing up cannot match
  // going forward. The zero detent sits proportionally, so the shorter
  // reverse travel shows you that before you try it.
  const THROTTLE_REV = 0.4;                       // reverse ceiling vs forward
  const THROTTLE_ZERO = 1 / (1 + THROTTLE_REV);   // where 0 sits down the track
  let throttle = 0;
  let lastFastTap = -9; // seconds
  function noteFastTap() {
    const s = performance.now() / 1000;
    if (s - lastFastTap < 0.35) cruise = !cruise;
    lastFastTap = s;
  }
  let steerHold = 99; // seconds since the user last steered
  const steeringActive = () => steerHold < 1.2;
  let autoMode = false; // AUTO is opt-in (the directive chip); MANUAL is sticky


  // TAP-TO-GO (ruling 1, 2026-09-02). On the phone the tank is COMMANDED, not
  // driven: a tap on the ground is a destination, and the graph walker that
  // already serves the auto directives walks it there. A BFS field from the
  // tapped cell is the goal, exactly as distToHeart is the goal for 'home';
  // arriving hands control back to manual, which stops the tank.
  let gotoField = null, gotoCi = -1;
  function gotoCell(ci) {
    if (ci < 0 || dungeon.tags[ci] === BLOCKED) return false;
    gotoField = bfsDist(graph.adj, [ci], (i) => dungeon.tags[i] !== BLOCKED);
    if (gotoField[player.cur] < 0) return false;          // unreachable from here
    gotoCi = ci;
    params.directive = 'goto';
    autoMode = true; cruise = false; throttle = 0;
    warnRing(ci, 0x9fdcff, 0.5, cellSide * 0.9);            // "here" — the same ring the board speaks
    return true;
  }
  function stopGoto() {
    gotoCi = -1; gotoField = null;
    if (params.directive === 'goto') { params.directive = 'wander'; autoMode = false; }
  }
  const manualActive = () => !autoMode;

  // --- THE CONTROLS-DEAD PROBE --------------------------------------------
  // Operator, recurring and never reproduced: after a game ends or a tank
  // dies, WASD sometimes does nothing until they fiddle, and AUTO sometimes
  // frees it. Every guess at a fix would be a guess at WHICH of eight gates
  // is latched, so this reports the gate instead. CTL_DEBUG turns the log on
  // for a session; the watchdog below fires on the symptom itself, so the
  // report can come from a phone in real play rather than a repro here.
  // read from location directly: urlParams is declared far below this point,
  // and a const in its temporal dead zone throws at init rather than reading
  // as undefined — the whole tab would fail to boot
  const CTL_DEBUG = /[?&]ctl(probe)?=/.test(location.search);
  // RUN GENERATION. Deferred work started by one run must never land on the
  // next: a timer that repositions the tank is a timer that can reposition
  // somebody else's tank. Bumped by regenerate.
  const runContext = createRunContext();
  const runTimers = createRunTimers(runContext);
  let deployCount = 0;
  let deploysDone = 0;   // berth exits completed — the director waits for the first
  // counted separately: a death-hold deploy is the one that must never
  // cross a run, and a fresh run's own deploy would mask it in a total
  let tankLostDeploys = 0;
  const ctlState = (tag) => `CTL[${tag}] gen=${runContext.generation} deploys=${deployCount}`
    + ` won=${player.won} down=${playerDown} next=${player.next}`
    + ` free=${player.freeMode} cur=${player.cur}`
    + ` auto=${autoMode} cruise=${cruise} deploying=${deployActive()}`
    + ` throttle=${throttle.toFixed(2)} keys=${Object.entries(keys)
      .filter(([, v]) => v).map(([k2]) => k2).join('+') || '-'}`
    + ` paused=${paused} tutFrozen=${tutorial.frozen}`
    + ` shot=${shotId() || '-'}`
    + ` buildMode=${buildMode} active=${active}`;
  const ctlLog = (tag) => { if (CTL_DEBUG) console.log(ctlState(tag)); };
  // THE WATCHDOG. It watches for the symptom as the player describes it —
  // asking the tank to move and the tank not moving — rather than for any
  // one cause, and prints the whole gate row when it happens. Always on:
  // the bug is rare and lives on the operator's phone, so a probe that only
  // runs under a flag is a probe that will never see it. One line per
  // episode (re-armed only after the tank moves again), so a genuinely
  // wedged hull cannot flood the console.
  let ctlStillFor = 0, ctlBarked = false;
  const ctlLastPos = [0, 0, 0];
  // RAW INPUT, READ BEFORE ANYTHING CAN SWALLOW IT. The first cut of this
  // watchdog asked `keys.fast || ...`, which is the game's BELIEF about the
  // input — so the one failure mode that matters most, a capture-phase
  // listener eating keydown before the game ever sees it, made the watchdog
  // go quiet instead of loud. Registered at init, so it sits ahead of any
  // listener a cinematic adds later and records the press either way.
  let ctlRawT = -9, ctlRawKey = '';
  const CTL_DRIVE_KEYS = ['w', 's', 'a', 'd',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  addEventListener('keydown', (ev) => {
    const k = (ev.key || '').toLowerCase();
    if (CTL_DRIVE_KEYS.includes(k)) { ctlRawT = performance.now() / 1000; ctlRawKey = k; }
    if (ev.key === '`') setPerfOverlay(!perfOn);
    if (ev.key === 'Escape') document.body.classList.remove('vars-open');
  }, true);
  let ctlSwallowBarked = false;
  const vwFrustum = new THREE.Frustum(), vwMat = new THREE.Matrix4(), vwPt = new THREE.Vector3();
  // CAN A PERSON SEE THE TANK — which is NOT "is it in the frustum", the
  // question the watchdog used to ask and the question four camera fixes
  // answered while the reports kept coming. A point can be inside the
  // frustum and still invisible three ways, and only one of them is a pose
  // problem, so only one of them is worth re-seating the camera over.
  //
  //   'behind' / 'off-canvas'  a POSE problem — the watchdog re-seats
  //   'chrome'   on the canvas but below the VISUAL viewport: iOS makes the
  //              layout viewport taller than the glass, so the bottom band
  //              lives under the URL bar and the toolbar. Re-seating does
  //              nothing; the framing has to come up.
  //   'covered'  drawn, on glass, with a HUD element on top of it
  //   'tiny'     drawn, on glass, uncovered, and too small to find
  //
  // Headless can model neither the visual viewport nor env(safe-area-inset),
  // so on a desktop replica this can only ever return 'ok' or a pose fault —
  // which is exactly why the reports outlived the replica.
  const tsV = new THREE.Vector3(), tsW = new THREE.Vector3();
  function tankSight() {
    if (!playerMesh || !player.pos) return { why: 'no tank', px: 0, frac: 0, x: 0, y: 0 };
    const cv = renderer.domElement;
    const r = cv.getBoundingClientRect();
    camera.updateMatrixWorld();
    tsV.set(player.pos[0], player.pos[1], player.pos[2]).project(camera);
    const x = r.left + (tsV.x * 0.5 + 0.5) * r.width;
    const y = r.top + (-tsV.y * 0.5 + 0.5) * r.height;
    const short = Math.max(1, Math.min(r.width, r.height));
    let px = 0;
    {
      const g = playerMesh.geometry;
      let rad;
      if (g) {
        if (!g.boundingSphere) g.computeBoundingSphere();
        rad = (g.boundingSphere ? g.boundingSphere.radius : 1) * playerMesh.scale.x;
      } else {
        rad = new THREE.Box3().setFromObject(playerMesh).getSize(tsW).length() * 0.5;
      }
      const d = camera.position.distanceTo(tsW.set(player.pos[0], player.pos[1], player.pos[2]));
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * d;
      px = halfH > 0 ? (rad / halfH) * (r.height / 2) : 0;
    }
    const out = { px, frac: px / short, x, y, ndc: [tsV.x, tsV.y, tsV.z] };
    if (tsV.z > 1) return { ...out, why: 'behind' };
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return { ...out, why: 'off-canvas' };
    const vv = window.visualViewport;
    const top = vv ? vv.offsetTop : 0, left = vv ? vv.offsetLeft : 0;
    const bottom = vv ? top + vv.height : innerHeight, right = vv ? left + vv.width : innerWidth;
    if (y < top || y > bottom || x < left || x > right) return { ...out, why: 'chrome' };
    if (typeof document.elementsFromPoint === 'function') {
      const stack = document.elementsFromPoint(Math.round(x), Math.round(y));
      // the diagnostics panel is not game chrome — reporting that the thing
      // you opened to find the tank is the thing hiding it is just noise
      const on = stack.find((e) => e !== cv && e.id !== 'td-app' && e.id !== 'tab-td'
        && e.id !== 'td-diag' && e.tagName !== 'BODY' && e.tagName !== 'HTML');
      if (on) {
        return { ...out, why: 'covered',
          by: `${on.tagName.toLowerCase()}${on.id ? '#' + on.id : ''}` };
      }
    }
    if (out.frac < 0.03) return { ...out, why: 'tiny' };
    return { ...out, why: 'ok' };
  }
  const sightLine = (s2) => `${s2.why}${s2.by ? ' by ' + s2.by : ''}`
    + ` ${s2.x.toFixed(0)},${s2.y.toFixed(0)} r${s2.px.toFixed(0)}px ${(s2.frac * 100).toFixed(1)}%`;

  function tankInFrustum() {
    camera.updateMatrixWorld();
    vwFrustum.setFromProjectionMatrix(vwMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return vwFrustum.containsPoint(vwPt.set(player.pos[0], player.pos[1], player.pos[2]));
  }
  // THE VIEW WATCHDOG (operator, builds 1974eb11..42e61776: "I still do not
  // see the tank", "recurring", "a game stopper on mobile"). The camera's
  // pose could not be read on the device, so the shell watches for the
  // symptom itself: in DRIVE, with no shot, no deploy and no pause, the
  // tank out of the camera's frustum for 1.5 s is a stuck camera, whatever
  // stuck it. It re-seats — ends any shot, forces third, snaps the goal —
  // and paints what it found on the caption lane so a screenshot carries
  // it. Always on for the shell; ?viewwatch=0 turns it off.
  let vwOut = 0, vwCool = 0, vwFires = 0;
  function viewWatch(dt) {
    if (!mobileShell || !playerMesh || playerDown || player.won) return;
    if (vwCool > 0) { vwCool -= dt; return; }
    const driving = params.view === 'third' && !buildMode && !shot && !deploy && !paused;
    if (!driving) { vwOut = 0; return; }
    const sight = tankSight();
    if (sight.why === 'ok') { vwOut = 0; return; }
    vwOut += dt;
    if (vwOut < 1.5) return;
    vwOut = 0; vwCool = 5; vwFires++;
    const vv0 = window.visualViewport;
    const cv0 = renderer.domElement;
    const before = `${sightLine(sight)} view=${params.view} build=${buildMode} shot=${shot ? shot.id : '-'} deploy=${!!deploy} camToTank=${(camera.position.distanceTo(vwPt) / cellSide).toFixed(1)}c cur=${player.cur} next=${player.next}`
      // WHICH EDGE, AND BY HOW MUCH. "chrome 430,516" says the tank is
      // outside the visible band but not which side of it, and the two have
      // opposite fixes. The bias is printed too, so the next screenshot says
      // whether the correction is being applied at all.
      + ` unit=${unitScale.toFixed(3)} bias=${camBiasNdc.toFixed(3)}`
      + ` canvas=${cv0.clientWidth}x${cv0.clientHeight}`
      + ` visual=${vv0 ? `${Math.round(vv0.width)}x${Math.round(vv0.height)}@${Math.round(vv0.offsetLeft)},${Math.round(vv0.offsetTop)}` : '-'}`
      + ` edge=${(() => {
        if (!vv0) return '-';
        const es = [];
        if (sight.y < vv0.offsetTop) es.push(`above by ${Math.round(vv0.offsetTop - sight.y)}`);
        if (sight.y > vv0.offsetTop + vv0.height) es.push(`below by ${Math.round(sight.y - vv0.offsetTop - vv0.height)}`);
        if (sight.x < vv0.offsetLeft) es.push(`left by ${Math.round(vv0.offsetLeft - sight.x)}`);
        if (sight.x > vv0.offsetLeft + vv0.width) es.push(`right by ${Math.round(sight.x - vv0.offsetLeft - vv0.width)}`);
        return es.join('+') || 'inside';
      })()}`;
    // ONLY A POSE FAULT IS WORTH RE-SEATING. Snapping the camera at a tank
    // that is covered by a caption, or under the URL bar, moves nothing and
    // hides the evidence — the report is the whole value in those cases.
    // CHROME COUNTS NOW. It used to be filed under "re-seating would not
    // help", which was true while the rig aimed at the middle of the canvas:
    // snapping put the tank back in the same invisible strip. With the
    // viewport bias there IS something to do — re-seating re-derives the
    // pose against the band that is actually on screen.
    const fixable = sight.why === 'behind' || sight.why === 'off-canvas' || sight.why === 'chrome';
    if (fixable) {
      endShot();
      setView('third');
      snapCamera();
    }
    console.warn(`VIEWWATCH #${vwFires} ${fixable ? 'recentred' : 'REPORTED (re-seating would not help)'}: ${before}`);
    if (toastEl) {
      toastEl.innerHTML = `<div class="wave-role" style="font-size:9px;text-align:left;white-space:pre-wrap">VIEWWATCH #${vwFires} ${before}</div>`;
      toastEl.classList.remove('hidden');
      setTimeout(() => toastEl.classList.add('hidden'), 6000);
    }
  }

  // THE DIAGNOSTICS OVERLAY (operator, 2026-09-04, after four blind fixes of
  // the phone's third-person view: "ultrathink a better approach"). The
  // approach: the phone prints every number the camera and the tank depend
  // on, on screen, from the game's own state — no URL, no keyboard: tap the
  // hearts three times (or ?diag=1). A tap on the panel opens the last
  // sixty lines as selectable text. A screenshot of this decides, in one
  // go, whether the camera is where it should be, whether the tank mesh is
  // drawing, and what the deploy, the shot and the view are doing.
  const diagQ = new URLSearchParams(location.search);   // urlParams is declared far below; this runs at init
  let diagEl = null, diagOn = diagQ.get('diag') === '1', diagT = 0, diagTaps = [], diagRing = [];
  const diagNdc = new THREE.Vector3();
  function diagLine() {
    const cp = camera.position, pp = player.pos;
    diagNdc.set(pp[0], pp[1], pp[2]).project(camera);
    const vv = window.visualViewport;
    const pm = playerMesh;
    const sight = tankSight();
    return [
      // THE ANSWER FIRST. Everything under this line is why; this line is
      // what. A screenshot that shows only the top of the panel still says
      // whether the tank is visible and, if not, which of the four reasons.
      `SEEN: ${sightLine(sight)}`,
      `HUNG: ${shotWatchFires ? `${shotWatchFires}x ${shotWatchLast}` : 'none'}`
        + ` shot=${shot ? `${shot.id} ${shot.age.toFixed(1)}/${shot.dur.toFixed(1)}s` : '-'}`
        + ` deploy=${deploy ? `${(deploy.age || 0).toFixed(1)}s` : '-'}`,
      `t=${t.toFixed(1)} build=${(document.querySelector('script[src*="main.js"]')?.src.match(/v=([0-9a-f]{8})/) || [, '?'])[1]} shell=${mobileShell}`,
      `view=${params.view} buildMode=${buildMode} shot=${shot ? shot.id + '@' + (1 - shot.left / shot.dur).toFixed(2) : '-'} deploy=${deploy ? `#${deploy.n}@${deployProgress().toFixed(2)}` : '-'}`,
      `paused=${paused} frozen=${tutorial.frozen} tutorial=${tutorialActive}/${tutorial.phase} down=${!!playerDown} won=${player.won} intro=${!!(introEl && !introEl.classList.contains('hidden'))} msg=${!!(msgEl && !msgEl.classList.contains('hidden'))}`,
      `tank cur=${player.cur} next=${player.next} free=${!!player.freeMode} thr=${throttle.toFixed(2)} cruise=${cruise} auto=${autoMode} goto=${gotoCi} keys=${['left', 'right', 'fast', 'slow', 'fire', 'laser'].filter((k) => keys[k]).join(',') || '-'} stick=${!!stick}`,
      `mesh vis=${!!(pm && pm.visible)} inScene=${!!(pm && pm.parent === scene)} scale=${pm ? pm.scale.x.toFixed(4) : '-'} unitScale=${unitScale.toFixed(4)} base=${pm ? (pm.userData.baseScale ?? 1) : '-'} pos=${pp.map((v) => v.toFixed(3)).join(',')}`,
      `cam pos=${cp.x.toFixed(3)},${cp.y.toFixed(3)},${cp.z.toFixed(3)} toTank=${(cp.distanceTo(diagNdc.set(pp[0], pp[1], pp[2])) / cellSide).toFixed(2)}c fov=${camera.fov} aspect=${camera.aspect.toFixed(3)} far=${camera.far}`,
      `tankScreen=${(() => { diagNdc.set(pp[0], pp[1], pp[2]).project(camera); return `${diagNdc.x.toFixed(2)},${diagNdc.y.toFixed(2)},${diagNdc.z.toFixed(3)}`; })()} inFrustum=${tankInFrustum()}`,
      `canvas=${renderer.domElement.width}x${renderer.domElement.height} css=${renderer.domElement.clientWidth}x${renderer.domElement.clientHeight} inner=${innerWidth}x${innerHeight} visual=${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}@${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)} s${vv.scale.toFixed(2)}` : '-'} dpr=${devicePixelRatio} cell=${cellSide.toFixed(4)} wall=${params.wallHeight}`,
      `viewwatch fires=${vwFires} out=${vwOut.toFixed(1)}s bias=${camBiasNdc.toFixed(3)}`,
    ].join('\n');
  }
  function diagToggle(on) {
    diagOn = on;
    if (!diagEl) {
      diagEl = document.createElement('pre');
      diagEl.id = 'td-diag';
      diagEl.style.cssText = 'position:fixed;left:8px;top:calc(env(safe-area-inset-top,0px) + 92px);z-index:60;margin:0;max-width:62vw;padding:6px 8px;'
        + 'font:10px/1.35 ui-monospace,Menlo,monospace;color:#9dffb0;background:rgba(0,10,4,0.82);border:1px solid rgba(100,255,140,0.4);'
        + 'border-radius:6px;white-space:pre-wrap;pointer-events:auto;-webkit-user-select:text;user-select:text;';
      diagEl.addEventListener('click', () => {
        // the ring, as selectable text, for a copy — tap again to close
        if (diagEl.dataset.ring === '1') { diagEl.dataset.ring = '0'; return; }
        diagEl.dataset.ring = '1';
        diagEl.textContent = 'DIAG ring (last 60, 2 s apart) — tap to close\n' + diagRing.join('\n---\n');
      });
      root.appendChild(diagEl);
    }
    diagEl.style.display = on ? 'block' : 'none';
  }
  const diagHearts = root.querySelector('#td-stats');   // statsEl is declared further down; this block runs at init
  if (diagHearts) diagHearts.addEventListener('pointerdown', () => {
    const now = performance.now();
    diagTaps = diagTaps.filter((x) => now - x < 900); diagTaps.push(now);
    if (diagTaps.length >= 3) { diagTaps = []; diagToggle(!diagOn); }
  });
  function diagTick(dt) {
    if (!diagOn) return;
    diagT += dt;
    if (diagT < 0.25) return;
    diagT = 0;
    const line = diagLine();
    if (diagEl && diagEl.dataset.ring !== '1') diagEl.textContent = 'DIAG · tap hearts ×3 to hide · tap panel for the ring\n' + line;
    // the ring: one entry every 2 s, kept across a reload for a copy after the fact
    if (!diagRing.length || (diagRing._t ?? -9) + 2 <= t) {
      diagRing.push(line); diagRing._t = t;
      if (diagRing.length > 60) diagRing.shift();
      try { localStorage.setItem('td.diag', diagRing.join('\n---\n')); } catch (e) { /* private mode */ }
      if (diagQ.get('diag') === '1') console.log('DIAG ' + line.replace(/\n/g, ' | '));
    }
  }
  if (diagOn) setTimeout(() => diagToggle(true), 500);

  function ctlWatch(dt) {
    // what the player is asking for, not what the game decided to do with it
    const asking = keys.fast || keys.slow || cruise || throttle !== 0;
    const moved = Math.abs(player.pos[0] - ctlLastPos[0])
      + Math.abs(player.pos[1] - ctlLastPos[1])
      + Math.abs(player.pos[2] - ctlLastPos[2]);
    ctlLastPos[0] = player.pos[0]; ctlLastPos[1] = player.pos[1]; ctlLastPos[2] = player.pos[2];
    // a real drive step is orders of magnitude above this; the threshold is
    // here so hover bob and cushion nudges do not read as movement
    if (moved > cellSide * 1e-4) { ctlStillFor = 0; ctlBarked = false; return; }
    if (!asking || player.won || paused) { ctlStillFor = 0; return; }
    ctlStillFor += dt;
    // INPUT SWALLOWED: the player is pressing a drive key and the game's
    // key state never sees it. Reported separately because it is a different
    // fault from a latched gate — something is eating the event.
    const rawAge = performance.now() / 1000 - ctlRawT;
    const gameSees = keys.fast || keys.slow || keys.left || keys.right;
    if (rawAge < 0.5 && !gameSees && !ctlSwallowBarked) {
      ctlSwallowBarked = true;
      console.log(`CTL-SWALLOWED raw '${ctlRawKey}' pressed but keys are all`
        + ` false — something is eating keydown. ${ctlState('swallowed')}`);
    }
    if (gameSees) ctlSwallowBarked = false;
    // a second of asking is well past a wall bump or a frozen beat
    if (ctlStillFor > 1.0 && !ctlBarked) {
      ctlBarked = true;
      console.log(`CTL-DEAD asked ${ctlStillFor.toFixed(1)}s, no motion — ${ctlState('dead')}`);
    }
  }

  const camGoal = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  // two more of the same, for blending between two framings (the cold open)
  // two spare pose slots, for blending one framing into another
  const camA = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const camB = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const tmpObj = new THREE.Object3D();
  // lookAt convention trap: a plain Object3D faces +Z at the target, but a
  // camera renders down -Z (three.js special-cases isCamera in lookAt).
  // The camera goal quaternion MUST come from a camera instance, or the view
  // ends up rotated 180° — staring backward along the heading.
  const tmpCam = new THREE.PerspectiveCamera();

  // --- colors: everything visual comes from the active look ----------------
  const look = () => LOOKS[params.look] || LOOKS.solid;
  const rgbOf = (hex) => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  let zoneColors = null; // per-cell [r,g,b] field for zonal looks (tronColors)
  // wall-top treatment: the look supplies a default, the dropdown overrides
  const wallTopMode = () => (params.wallTops === 'auto'
    ? (look().wallTopMode || 'bright') : params.wallTops);

  function floorColorOf(ci) {
    const F = look().floors;
    if (ci === dungeon.heart) return F.heartFloor;
    if (ci === dungeon.spawn) return F.spawn;
    const zs = look().zones;
    if (zs && zoneColors) {
      const lv = player.visited.has(ci) ? zs.floorLevels.visited
        : dungeon.tags[ci] === ROOM ? zs.floorLevels.room : zs.floorLevels.path;
      return [zoneColors[ci * 3] * lv, zoneColors[ci * 3 + 1] * lv, zoneColors[ci * 3 + 2] * lv];
    }
    if (player.visited.has(ci)) return F.visited;
    return dungeon.tags[ci] === ROOM ? F.room : F.path;
  }

  // --- geometry ------------------------------------------------------------
  function buildGeometry() {
    const { vertices, quads } = mesh;
    const H = 1 + params.wallHeight;
    const jr = mulberry32(params.seed ^ 0xc0ffee);

    const mode = wallTopMode();
    const E = look().edges;
    // zonal looks: bake the per-cell color field once per build — seeded
    // accent centers, gaussian angular falloff, blended against the base
    zoneColors = null;
    if (look().zones) {
      const zs = look().zones;
      const zrng = mulberry32((params.seed ^ 0x7c0104) >>> 0);
      const centers = [];
      for (const [hex, count, sigma] of zs.accents) {
        for (let k = 0; k < count; k++) {
          const zz = 2 * zrng() - 1;
          const th = 2 * Math.PI * zrng();
          const rr = Math.sqrt(Math.max(0, 1 - zz * zz));
          centers.push({ d: [rr * Math.cos(th), zz, rr * Math.sin(th)], c: rgbOf(hex), s: sigma });
        }
      }
      const bc = rgbOf(zs.base);
      zoneColors = new Float32Array(quads.length * 3);
      for (let ci = 0; ci < quads.length; ci++) {
        const u = graph.normals[ci];
        let r = bc[0] * zs.baseWeight, g = bc[1] * zs.baseWeight, b = bc[2] * zs.baseWeight;
        let W = zs.baseWeight;
        for (const cn of centers) {
          const dv = Math.max(-1, Math.min(1, u[0] * cn.d[0] + u[1] * cn.d[1] + u[2] * cn.d[2]));
          const w = Math.exp(-((Math.acos(dv) / cn.s) ** 2));
          r += cn.c[0] * w; g += cn.c[1] * w; b += cn.c[2] * w; W += w;
        }
        zoneColors[ci * 3] = r / W;
        zoneColors[ci * 3 + 1] = g / W;
        zoneColors[ci * 3 + 2] = b / W;
      }
    }
    const constEdge = rgbOf(E.color);
    const edgeTint = (ci) => (zoneColors
      ? [zoneColors[ci * 3], zoneColors[ci * 3 + 1], zoneColors[ci * 3 + 2]]
      : constEdge);
    const baseTop = look().walls.top;
    const topFill = mode === 'black' ? [0, 0, 0]
      : mode === 'dim' ? [baseTop[0] * 0.45, baseTop[1] * 0.45, baseTop[2] * 0.45]
      : baseTop;
    // TD's buildable-frontier read: in black mode, wall tops that BORDER a
    // hallway glow dim — exactly the cells towers may mount — while the
    // interior wall mass stays void. The map itself teaches where to build.
    const frontierTop = [baseTop[0] * 0.5, baseTop[1] * 0.5, baseTop[2] * 0.5];
    const topJitter = mode === 'black' ? 0 : 1;
    // floors: open cells at the surface
    const fPos = [], fCol = [], ePos = [], eColA = [], tPos = [], tColA = [];
    // Every interior edge belongs to TWO cells, and each cell emits its own
    // four boundary edges — so without this, half the segments are drawn
    // twice. The edge material is ADDITIVE, so duplicates SUM: a shared
    // edge renders at 2x, and at a vertex, where several already-doubled
    // edges converge on one pixel, brightness stacked up to 14x. That blew
    // past the bloom threshold the edge midspans stayed under, which is
    // what put a bloomed square on every vertex of the floor.
    // One Set for both meshes: a rim segment must not be re-drawn as a
    // wall-top wire either.
    const seenSeg = new Set();
    const firstTime = (p, q2) => {
      const k = segKey(p, q2);
      if (seenSeg.has(k)) return false;
      seenSeg.add(k);
      return true;
    };
    const pushEdge = (p, q2, ci) => {
      if (!firstTime(p, q2)) return;
      ePos.push(p[0], p[1], p[2], q2[0], q2[1], q2[2]);
      const c = edgeTint(ci);
      eColA.push(c[0], c[1], c[2], c[0], c[1], c[2]);
    };
    const pushTopEdge = (p, q2, ci) => {
      if (!firstTime(p, q2)) return;
      tPos.push(p[0], p[1], p[2], q2[0], q2[1], q2[2]);
      const c = edgeTint(ci);
      tColA.push(c[0], c[1], c[2], c[0], c[1], c[2]);
    };
    floorOffsets = new Map();
    for (let ci = 0; ci < quads.length; ci++) {
      if (dungeon.tags[ci] === BLOCKED) continue;
      const q = quads[ci];
      floorOffsets.set(ci, fPos.length / 3);
      const [r, g, b] = floorColorOf(ci);
      const j = (jr() - 0.5) * 0.05 * look().jitter;
      for (const vi of [q[0], q[1], q[2], q[0], q[2], q[3]]) {
        const p = vertices[vi];
        fPos.push(p[0], p[1], p[2]);
        fCol.push(r + j, g + j, b + j);
      }
      for (let i = 0; i < 4; i++) pushEdge(vertices[q[i]], vertices[q[(i + 1) % 4]], ci);
    }

    // walls: blocked cells extruded; top face + skirts on edges facing open cells
    const wPos = [], wCol = [];
    const edgeToCell = new Map();
    for (let ci = 0; ci < quads.length; ci++) {
      const q = quads[ci];
      for (let i = 0; i < 4; i++) {
        const a = q[i], b = q[(i + 1) % 4];
        edgeToCell.set(`${a}-${b}`, ci); // directed edge -> owning cell
      }
    }
    const pushQuad = (p0, p1, p2, p3, col, j) => {
      for (const p of [p0, p1, p2, p0, p2, p3]) wPos.push(p[0], p[1], p[2]);
      for (let i = 0; i < 6; i++) wCol.push(col[0] + j, col[1] + j, col[2] + j);
    };
    for (let ci = 0; ci < quads.length; ci++) {
      if (dungeon.tags[ci] !== BLOCKED) continue;
      const q = quads[ci];
      const top = q.map((vi) => scale3(vertices[vi], H));
      const j = (jr() - 0.5) * 0.08 * look().jitter;
      const nearHall = mode === 'black'
        && graph.adj[ci].some((nb) => dungeon.tags[nb] !== BLOCKED);
      pushQuad(top[0], top[1], top[2], top[3], nearHall ? frontierTop : topFill, j * topJitter);
      // wall-top wires split by audience: rim segments over open cells are
      // part of the wall's silhouette (always drawn, main edge set);
      // interior top wires go to their own dimmable mesh — bright/dim/black
      // is what makes walls read as wire, faint slab, or void on the minimap
      for (let i = 0; i < 4; i++) {
        const a = q[i], b = q[(i + 1) % 4];
        const nb = edgeToCell.get(`${b}-${a}`); // twin edge's owner
        const facesOpen = nb !== undefined && dungeon.tags[nb] !== BLOCKED;
        if (facesOpen) {
          // skirt facing the open neighbour, wound outward + its outline
          const sideCol = zoneColors
            ? [zoneColors[ci * 3] * look().zones.wallSideLevel * 10,
               zoneColors[ci * 3 + 1] * look().zones.wallSideLevel * 10,
               zoneColors[ci * 3 + 2] * look().zones.wallSideLevel * 10]
            : look().walls.side;
          pushQuad(top[(i + 1) % 4], top[i], vertices[a], vertices[b], sideCol, j);
          pushEdge(top[i], vertices[a], ci);
          pushEdge(top[(i + 1) % 4], vertices[b], ci);
          pushEdge(top[i], top[(i + 1) % 4], ci);
        } else {
          pushTopEdge(top[i], top[(i + 1) % 4], ci);
        }
      }
    }

    for (const [geo, obj] of [[floorGeo, floorMesh], [wallGeo, wallMesh], [edgeGeo, edgeMesh], [topGeo, topMesh]]) {
      if (obj) scene.remove(obj);
      if (geo) geo.dispose();
    }
    const faceMat = () => new THREE.MeshLambertMaterial({
      vertexColors: true,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    floorGeo = new THREE.BufferGeometry();
    floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
    floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(fCol, 3));
    floorGeo.computeVertexNormals();
    floorMesh = new THREE.Mesh(floorGeo, faceMat());
    scene.add(floorMesh);

    wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
    wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(wCol, 3));
    wallGeo.computeVertexNormals();
    wallMesh = new THREE.Mesh(wallGeo, faceMat());
    scene.add(wallMesh);

    edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(ePos, 3));
    edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(eColA, 3));
    edgeMesh = new THREE.LineSegments(edgeGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: E.opacity,
        blending: E.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: !E.additive,
      }));
    edgeMesh.visible = E.show;
    scene.add(edgeMesh);

    topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    topGeo.setAttribute('color', new THREE.Float32BufferAttribute(tColA, 3));
    topMesh = new THREE.LineSegments(topGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true,
        opacity: E.opacity * (mode === 'dim' ? 0.28 : 1),
        blending: E.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: !E.additive,
      }));
    topMesh.visible = E.show && mode !== 'black';
    scene.add(topMesh);
  }

  function paintCell(ci, rgb) {
    const start = floorOffsets.get(ci);
    if (start === undefined) return;
    const attr = floorGeo.getAttribute('color');
    for (let v = 0; v < 6; v++) {
      attr.setXYZ(start + v, rgb[0], rgb[1], rgb[2]);
    }
    attr.needsUpdate = true;
  }

  // --- heart & player objects ---------------------------------------------


  function buildActors() {
    for (const o of [heartSprite, playerMesh, markerMesh, serverObj]) if (o) { o.userData.dispose?.(); scene.remove(o); }
    for (const c of lifeContainers) scene.remove(c.obj);
    lifeContainers = [];
    serverObj = null; serverFound = false;

    // the Braille heart: dot-cloud cycling twinkle → breathe → jelly,
    // flaring orange/red under Wave when hit
    // the fallback is always the dot cloud: an async model must never leave
    // the pole empty, and the Heart is the thing the whole board defends
    const hl = heartLook();
    const built = hl.make();          // null while an async model is still loading
    heartSprite = built || makeHeartCloud(new THREE.Color(look().heart).getHex());
    scene.add(heartSprite);
    buildStationRing();
    if (!built) {
      // bytes not in yet — build the cloud now, swap when they land
      const want = params.heartLook;
      const hgen = ++heartGen;
      hl.preload().then(() => {
        if (hgen !== heartGen || want !== params.heartLook) return; // board moved on
        const built = hl.make();
        if (!built) return;
        scene.remove(heartSprite);
        heartSprite = built;
        scene.add(heartSprite);
        heartSprite.layers.enable(MAP_LAYER);
        placeActors();
      });
    }
    // the server sits at the cell whose centre is FARTHEST round the
    // sphere from the heart — the literal antipode, found by minimum dot
    {
      // serverCi was chosen at world build (applySector needs it);
      // this block only casts and seats the model
      // THE LIFE CONTAINERS v2 (operator's staging): TWO containers, side
      // by side on the EMPTIEST flank of the heart's chamber — adjacent
      // open cells at distToHeart 2-3, the pair chosen for the fewest
      // open neighbours (a wall-side berth, clear of the lanes). Two
      // hull bays per container; the run's spare tanks rack there, and
      // every spawn — first scene included — drives OUT of a container.
      const cgen = serverGen + 1; // the value ++serverGen produces below
      preloadContainer().then(() => {
        if (cgen !== serverGen || !dungeon) return; // board changed since
        // the camp was chosen with the board; this only casts the boxes
        if (berths.length !== 3) return;
        for (let bi = 0; bi < berths.length; bi++) {
          const ci = berths[bi].ci;
          // THE DOORS FACE THE LANE THE HULL LEAVES BY. They used to face
          // the Heart, which is only ever approximately the way out: the
          // exit is a graph neighbour and can sit 40-odd degrees off that
          // bearing, so the hull drove out on a diagonal and clipped its own
          // door frame (operator, twice). Aim the box at the actual exit and
          // the two are the same line by construction. Most-heartward escape
          // wins, so the row still faces home.
          // the exit is CARRIED, not re-derived here: computeBerths picked
          // it, the doors point at it and DEPLOY drives at it, and those
          // three must never disagree
          const exitCi = berths[bi].exit;
          const ec = graph.centers[exitCi];
          const g = dressMetal(makeContainerFixture(bi + 1)); // painted 1-2-3, left to right
          if (!g) break;
          const c = graph.centers[ci];
          const nrm2 = graph.normals[ci];
          // SHALLOW: the full-length box hid its cargo in shadow (operator
          // report). Depth squashed to 0.55 — one hull fits, and you can
          // SEE it from the doors.
          g.scale.set(cellSide * 0.9, cellSide * 0.9, cellSide * 0.9 * 0.55);
          g.position.set(c[0], c[1], c[2]);
          // doors onto the exit lane: the bays still face home, and now the
          // hull's first metre is a straight line through its own doorway
          tmpObj.position.copy(g.position);
          tmpObj.up.set(nrm2[0], nrm2[1], nrm2[2]);
          tmpObj.lookAt(ec[0], ec[1], ec[2]);
          g.quaternion.copy(tmpObj.quaternion);
          const tank = buildCreature('mkcx2', look());   // the fielded unit
          tank.scale.setScalar(0.32);
          // counter-stretch: the parent's z-squash would flatten the hull
          tank.scale.z /= 0.55;
          // AT THE DOORS, not in the middle (operator, 2026-08-31: you could
          // not see there was a hull in there). The fitted box runs z ±0.80
          // with the doors at +z and the hull is ~0.29 long in the same
          // units, so 0.52 puts its nose on the door plane and its whole
          // body in the light.
          tank.position.set(0, 0.12, 0.52);
          g.add(tank);
          scene.add(g);
          // the exit is CARRIED, not re-derived: the doors point at it and
          // the respawn drives at it, and those two must never disagree
          lifeContainers.push({ obj: g, tanks: [tank], ci, exit: exitCi });
        }
        syncLifeContainers();
        // the FIRST SCENE: the opening hull drives out of its bay — if
        // the player has not yet gone anywhere, restage them at the doors
        // ?driveout=N — the operator's can't-get-out report, made testable.
        // Headless cannot drive, and ?tick runs at init, BEFORE this model
        // has loaded, so the one moment the question can be asked is here:
        // simulate N seconds of auto motion from the berth and print the
        // cells actually reached. A path of one cell means still stuck.
        const doN = parseFloat(urlParams.get('driveout') || '0');
        if (doN > 0) {
          const from = player.cur;
          const seen = [from];
          for (let sT = 0; sT < doN; sT += 0.05) {
            advanceMotion(0.05);
            if (player.cur !== seen[seen.length - 1]) seen.push(player.cur);
          }
          placeActors();
          console.log(`DRIVEOUT from=${from}`
            + ` berthed=${lifeContainers.some((cc) => cc.ci === from)}`
            + ` cells=${seen.length} path=${seen.join('>')}`
            + ` next=${player.next} prog=${player.prog.toFixed(3)}`
            + ` won=${player.won} down=${playerDown} free=${player.freeMode}`
            + ` auto=${autoMode} exits=${openNeighbors(from).join('/')}`);
        }
        // escapes=a,b,c is the invariant the operator's can't-get-out report
        // turned into a rule: every berth must show at least 1, or auto-nav
        // has nowhere to steer and the hull sits in the box forever
        console.log(`CONTAINERS placed=${lifeContainers.length}`
          + ` cells=${berths.map((b2) => b2.ci).join(',')}`
          + ` spares=${Math.max(0, playerHP - 1)}`
          + ` exits=${berths.map((b2) => b2.exit).join(',')}`);
      });
      const gen = ++serverGen;
      preloadServer().then(() => {
        if (gen !== serverGen || serverCi < 0) return; // board changed meanwhile
        const g = makeServerFixture();
        if (!g) return;
        const sn = graph.normals[serverCi];
        g.scale.setScalar(cellSide * 2.0);
        tmpN.set(sn[0], sn[1], sn[2]);
        g.quaternion.setFromUnitVectors(Y_AXIS, tmpN);
        scene.add(g);
        serverObj = g;
        syncServerLift();
      });
    }

    playerSize = Math.min(cellSide, params.wallHeight * 0.75);

    // the main unit: dot-cloud creatures keep the full Wave×Jelly +
    // phagocytosis path (creatureBase/creatureGeo); mesh units are static
    // geometry with transform-only idle animation (userData.tick)
    if ((UNITS[params.creature] || {}).kind === 'cloud') {
      creatureBase = CREATURES[params.creature]();
      creaturePos = new Float32Array(creatureBase.length * 3);
      waveJelly(creatureBase, 0, creaturePos);
      const cols = new Float32Array(creatureBase.length * 3);
      const cBody = new THREE.Color(look().walker);
      const cHi = new THREE.Color(look().walkerHi);
      for (let i = 0; i < creatureBase.length; i++) {
        const c = creatureBase[i][3] === 1 ? cHi : cBody;
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      creatureGeo = new THREE.BufferGeometry();
      creatureGeo.setAttribute('position', new THREE.BufferAttribute(creaturePos, 3));
      creatureGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      playerMesh = new THREE.Points(creatureGeo, new THREE.PointsMaterial({
        size: 2.2, sizeAttenuation: false, vertexColors: true,
        transparent: true, opacity: 0.95,
      }));
    } else {
      creatureBase = null;
      creaturePos = null;
      creatureGeo = null;
      playerMesh = dressMetal(buildCreature(params.creature, { walker: look().walker, walkerHi: look().walkerHi }));
      // the PLAY size from the first frame, never the bare base: the base
      // alone is ~27x the tank, and placeActors — which used to be the only
      // place the unit scale was multiplied in — runs on events, so anything
      // that skipped or threw between the two left an enormous tank on the
      // board (operator, build f2a9aeca, desktop, mid-tutorial: "the tank
      // got enormous … and now it seems fixed")
      playerMesh.scale.setScalar(unitScale * (playerMesh.userData.baseScale ?? 1));
    }
    scene.add(playerMesh);

    // minimap self-marker: a fat arrowhead nosing along the heading — the
    // map is heading-up, so YOU are the big pulsing arrow pointing up.
    // Sized against the SPHERE, not the cell: the map always frames the
    // whole ball, so cell-relative sizes vanish on dense boards.
    // Geometry pre-rotated so the cone's nose is +Z (lookAt convention).
    // The radar draws YOU itself now. The arrow survives because
    // placeActors drives its transform every frame — parked on the map
    // layer, which nothing renders, so it stays invisible instead of
    // suddenly appearing in the WORLD when the map renderer went away.
    markerMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.115, 4).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: look().marker }),
    );
    markerMesh.layers.set(MAP_LAYER);
    scene.add(markerMesh);
    // Layer 1 is the map's world. Everything here is drawn in BOTH views;
    // everything not here is main-view only, which is the whole saving.
    // Layers are per-object and not inherited, so each one says so itself.
    for (const o of [floorMesh, wallMesh, edgeMesh, topMesh, heartSprite]) {
      if (o) o.layers.enable(MAP_LAYER);
    }
  }

  function placeActors() {
    const hc = graph.centers[dungeon.heart];
    const hn = graph.normals[dungeon.heart];
    const hlp = heartLook();
    const hPos = add3(hc, scale3(hn, params.wallHeight * 0.6 + cellSide * hlp.lift));
    heartSprite.position.set(hPos[0], hPos[1], hPos[2]);
    heartSprite.userData.sizeScale = cellSide * hlp.scale;
    // APPLY IT NOW, not on the next frame. Both looks only read sizeScale
    // inside tick(), so a freshly built Stalheart stands at its raw model
    // size until the frame loop reaches it — which for the Terraformer is
    // 2 world units, about THIRTY cells across. One tick settles it before
    // anything is drawn.
    heartSprite.userData.setHealth?.(heartHP / HEART_MAX);
    if (heartSprite.userData.tick) heartSprite.userData.tick(runContext.time);
    tmpN.set(hn[0], hn[1], hn[2]);
    heartSprite.quaternion.setFromUnitVectors(Y_AXIS, tmpN);

    const n = norm3(player.pos);
    // lift: the unit's own floor offset plus its hover profile
    const prof = MOVES[params.creature];
    const baseLift = creatureGeo ? 0.85 : (playerMesh.userData.lift ?? 0.05);
    const lift = unitScale * (baseLift + (prof ? prof.hover(runContext.time) : 0));
    let p = add3(player.pos, scale3(n, lift));
    // recoil, reworked: the TURRET takes the kick — it slams back with a
    // high-frequency shudder — while the hull only rocks (pitch below) and
    // shifts a touch. Whole-body translation alone read as sliding, not
    // firing. k scales everything through the 'shell recoil' dial.
    const rf = recoilFactor();
    const rk = params.recoil * rf * rf;
    if (rf > 0) p = add3(p, scale3(player.smoothDir, -unitScale * 0.06 * rk));
    playerMesh.position.set(p[0], p[1], p[2]);
    playerMesh.scale.setScalar(unitScale * (playerMesh.userData.baseScale ?? 1));
    // the energy shield rides the hull: positioned every frame, ticking
    // its shimmer, gone the moment its clock runs out
    if (shieldUp()) {
      if (!shieldObj) {
        shieldObj = makeShieldShell();
        scene.add(shieldObj);
      }
      shieldObj.visible = true;
      const sp2 = add3(player.pos, scale3(n, lift * 0.9));
      shieldObj.position.set(sp2[0], sp2[1], sp2[2]);
      shieldObj.quaternion.copy(playerMesh.quaternion);
      // sized off the CELL, not unitScale — measured on screen, unitScale
      // put the bubble five cells wide (the mkcx normalization rides it)
      shieldObj.scale.setScalar(cellSide * 0.85);
      shieldObj.userData.tick(t, shield.t / shieldTune.cap);
    } else if (shieldObj) shieldObj.visible = false;
    // marker floats above the wall tops so nothing on the map occludes it
    const mp = scale3(player.pos, 1 + params.wallHeight * 1.6);
    markerMesh.position.set(mp[0], mp[1], mp[2]);
    // upright on the surface, facing the SMOOTHED direction (no snap)
    const h = player.smoothDir;
    tmpObj.position.copy(playerMesh.position);
    tmpObj.up.set(n[0], n[1], n[2]);
    tmpObj.lookAt(p[0] + h[0], p[1] + h[1], p[2] + h[2]);
    playerMesh.quaternion.copy(tmpObj.quaternion);
    // no extra rotation: lookAt with up=n already leaves body +Y ≈ normal
    // — except the recoil rock: a nose-up pitch that eases back down
    // Units with a hover body get their pitch from tankfeel (on the body, a
    // child group, where writing rotation is safe). For the rest, compose it
    // onto the unit — rotateX composes, an Euler write would REPLACE the
    // lookAt quaternion set two lines above.
    if (rf > 0 && !playerMesh.userData.hoverBody) playerMesh.rotateX(-0.05 * rk);
    // touchdown: a damped rock on two axes, ~0.9s. Two different frequencies
    // so it reads as suspension settling rather than a single clean wobble.
    // Hover, vibration and touchdown live on the BODY, not the unit — the
    // hull lifts off a planted skirt. Applied here rather than in
    // updateEngine so it survives every rebuild of playerMesh.
    feel.recoil = recoilLeft;   // the game owns the clock; tankfeel draws it
    applyTankFeel(playerMesh, feel, FEEL);
    applyTankHealth(playerMesh, playerHP / PLAYER_MAX);
    markerMesh.quaternion.copy(tmpObj.quaternion); // arrow nose = heading
  }

  // --- trench / third-person camera ----------------------------------------
  // follows the interpolated position and the SMOOTHED direction
  // --- TD modes: BUILD (top-down planning) vs ACTION (the heart rig) -----
  // B toggles; the shared camGoal + the loop's lerp gives the eased
  // no-cut transition for free. M swaps the minimap for the Heart
  // threat view. Build FREEZES the war only when the field is clear —
  // mid-assault it is camera-only (no combat escape hatch).
  let buildMode = false;
  // SECTOR REVEAL: a short full-planet beat after each clear — the camera
  // pulls out to frame the whole world, aimed at the freshly-unsealed
  // band, whose floors burn hot until the beat ends (then build mode).
  // --- camShot: ONE timed camera override, ONE teardown ------------------
  // Every timed camera takeover in this tab used to own its own clock, its
  // own skip listeners and its own teardown — and each teardown was a fresh
  // chance to get it wrong. One did: endCinematic() guarded on
  // `cineLeft <= 0` while the frame loop had already driven it there, so it
  // returned BEFORE removing a capture-phase keydown handler that
  // preventDefaults and stopImmediatePropagations. That handler then ate
  // every key in the game, permanently, and the briefing it was fronting
  // never opened (operator: "I still cannot move after the cinematic").
  //
  // So: one shot at a time, one teardown path, and the latch is the shot
  // ITSELF — never a clock somebody else has already advanced past.
  let shot = null;        // { id, dur, left, poseAt, onEnd, skippable }
  let shotHold = false;   // ?cine=N parks the clock for a screenshot
  const shotActive = () => shot !== null;
  const shotId = () => (shot ? shot.id : null);

  function startShot({ id, dur, poseAt, onEnd = null, skippable = true }) {
    endShot();   // one at a time, and the outgoing one always tears down
    shot = { id, dur: Math.max(1e-3, dur), left: Math.max(1e-3, dur),
      poseAt, onEnd, skippable, age: 0 };
    if (skippable) {
      addEventListener('keydown', shotSkipKey, true);
      root.addEventListener('pointerdown', shotSkipTap, true);
    }
    snapCamera();   // no glide in: the shot owns frame one
  }

  // Idempotent, and latched on `shot` — the RESOURCE — not on a countdown.
  // `shot` is cleared before onEnd runs, so a shot whose ending starts
  // another shot cannot recurse into its own teardown.
  function endShot() {
    if (!shot) return;
    const s = shot;
    shot = null;
    removeEventListener('keydown', shotSkipKey, true);
    root.removeEventListener('pointerdown', shotSkipTap, true);
    if (s.onEnd) s.onEnd();
  }

  // skippable by anything: a shot you cannot cut is one you resent the
  // second time you see it
  const shotSkipKey = (ev) => {
    if (!shot || !shot.skippable) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); endShot();
  };
  const shotSkipTap = (ev) => {
    if (!shot || !shot.skippable) return;
    ev.stopImmediatePropagation(); endShot();
  };

  // A SHOT AND A DEPLOY BOTH OWN THE CAMERA, and both have a KNOWN length —
  // so either one hanging is detectable without knowing why it hung. That is
  // the whole of the recurring "drive/build" report (operator, 2026-09-05):
  // "the view is stuck not in 3rd person, nor in top view, something else
  // unplayable". Neither of those two poses IS third or orbit; both are what
  // the camera looks like when one of these machines never finishes.
  //
  // The existing view watchdog cannot see it, and could not have: it fires
  // when the tank leaves the FRUSTUM, and a cinematic is a shot OF the tank —
  // it keeps it beautifully in frame while the game refuses to start. Four
  // camera-pose fixes went past this for the same reason.
  //
  // So: a liveness check on the clock, not on the pose. A shot that has been
  // running for its own duration plus a wide margin is hung, whatever hung
  // it, and is ended. The margin is generous because being wrong here costs
  // a cut cinematic and being absent costs the whole session.
  const SHOT_GRACE = 4.0;
  function stepShot(dt) {
    if (!shot || shotHold) return;
    shot.age += dt;
    shot.left -= dt;
    if (shot.left <= 0) { endShot(); return; }
    if (shot.age > shot.dur + SHOT_GRACE) {
      const id = shot.id, age = shot.age, dur = shot.dur;
      console.warn(`SHOTWATCH "${id}" hung: ${age.toFixed(1)}s into a ${dur.toFixed(1)}s shot — ended`);
      shotWatchFires++;
      shotWatchLast = `shot "${id}" ${age.toFixed(1)}s/${dur.toFixed(1)}s`;
      endShot();
    }
  }
  let shotWatchFires = 0, shotWatchLast = '';

  const REVEAL_LEN = 3.2;
  let revealDir = null;
  let revealCells = [];

  // --- THE COLD OPEN -------------------------------------------------------
  // Operator (2026-08-31): the run opens on a cinematic, tutorial or not.
  // Three beats, and they are the three things a player needs to know before
  // anything else: WHERE you are (pull back until the whole vessel is in
  // frame), WHERE you start (dive onto the berth row), and WHO you are (the
  // hero hull drives itself out of berth 3 while you watch).
  //
  // Beat three is not animation. Driving is unfrozen for it and the tank is
  // Two beats now, not three. The old beat 3 — hold the hull frozen and
  // watch it drive itself out — IS the game: DEPLOY does that live, with the
  // player's hand a moment away. So the cinematic ends where DEPLOY begins,
  // and its last frame is the game's first frame.
  const CINE_OUT = 3.0, CINE_DIVE = 3.4;
  const CINE_LEN = CINE_OUT + CINE_DIVE;

  function playCinematic(after, scrub = 0) {
    const n = berthIndexFor(playerHP);
    if (!graph || !dungeon || !berths[n]) { if (after) after(); return; }
    const b = berths[n];
    const bc = graph.centers[b.ci];
    const bn = graph.normals[b.ci];
    const ref = Math.abs(bn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const wUp = norm3(cross3(bn, ref));
    const smooth = (x) => x * x * (3 - 2 * x);
    const look = add3(bc, scale3(bn, params.wallHeight * 0.55));
    startShot({
      id: 'cinematic',
      dur: Math.max(0.001, CINE_LEN - scrub),
      poseAt: (u, out) => {
        const e = scrub + u * (CINE_LEN - scrub);
        if (e < CINE_OUT) {
          // BEAT 1 pulls straight out along the berth's own normal, so the
          // wide shot is still centred on the place it is about to dive back
          // into and the pull-back reads as one continuous move.
          const r = 1.26 + (3.30 - 1.26) * smooth(e / CINE_OUT);
          out.pos.set(bn[0] * r, bn[1] * r, bn[2] * r);
          tmpCam.position.copy(out.pos);
          tmpCam.up.set(wUp[0], wUp[1], wUp[2]);
          tmpCam.lookAt(0, 0, 0);
          out.quat.copy(tmpCam.quaternion);
          return;
        }
        // BEAT 2 does NOT slerp between two framings — that swings the
        // subject out of frame in the middle, which is what the first cut of
        // this did. It moves the EYE and keeps looking at the camp the whole
        // way down, so the box only ever grows. The seam with beat 1 is
        // invisible because the wide eye sits ON the berth's normal.
        //
        // It lands on deployFramePoseFor — the SAME pose DEPLOY opens with,
        // read from one place rather than authored twice. That is what makes
        // "the cinematic's last frame is the first frame of the reset state"
        // true by construction instead of true until someone edits one of
        // them.
        const w = smooth(Math.min(1, (e - CINE_OUT) / CINE_DIVE));
        deployFramePoseFor(n, camA);
        const wide = scale3(bn, 3.30);
        out.pos.set(wide[0] + (camA.pos.x - wide[0]) * w,
          wide[1] + (camA.pos.y - wide[1]) * w,
          wide[2] + (camA.pos.z - wide[2]) * w);
        tmpCam.position.copy(out.pos);
        const up = norm3([0, 1, 2].map((i) => wUp[i] + (bn[i] - wUp[i]) * w));
        tmpCam.up.set(up[0], up[1], up[2]);
        tmpCam.lookAt(look[0], look[1], look[2]);
        out.quat.copy(tmpCam.quaternion);
      },
      onEnd: () => { deployStart(n); if (after) after(); },
    });
  }

  // AUTO DIRECTIVES: high-level orders for the wanderer
  const DIRECTIVES = ['wander', 'avoid', 'ram', 'conserve', 'home', 'portal'];
  const DIRECTIVE_LABEL = {
    wander: 'WANDER', avoid: 'AVOID', ram: 'RAM',
    conserve: 'SAVE AMMO', home: 'HOME', portal: 'PORTAL',
  };
  let portalDist = null; // BFS field to the nearest live portal (directive)
  // BASTION view: third-person from behind the Heart — or behind any
  // tower you click while in it. watchTower null = the Heart.
  let watchTower = null;
  let mapMode = 'player'; // 'player' | 'heart'
  let buildDist = 2.0;      // wheel/pinch zooms
  // Build-mode camera orientation, as a PERSISTENT quaternion rather than
  // a centre point with an up-vector derived from the Heart each frame.
  // That derivation (up = hn projected into the tangent plane at c) goes to
  // zero at the antipode, and the old BUILD_CEIL clamp was the only thing
  // keeping us away from it. Free rotation means you can get there, so the
  // frame has to be carried, not re-derived: centre = +Z·buildQ, up = +Y·buildQ.
  const buildQ = new THREE.Quaternion();
  let buildCentered = false;  // framing the Heart is a FIRST-entry courtesy
  const BQ_Z = new THREE.Vector3(0, 0, 1);
  const BQ_Y = new THREE.Vector3(0, 1, 0);
  const bqC = new THREE.Vector3(), bqU = new THREE.Vector3(), bqR = new THREE.Vector3();
  const bqX = new THREE.Vector3(), bqY = new THREE.Vector3(), bqZ = new THREE.Vector3();
  const bqM = new THREE.Matrix4();
  const bqTmp = new THREE.Quaternion();
  const dragUp = new THREE.Vector3(), dragRight = new THREE.Vector3();

  // NOTE: returns shared temporaries — copy out before calling again.
  function buildFrame() {
    bqC.copy(BQ_Z).applyQuaternion(buildQ).normalize();
    bqU.copy(BQ_Y).applyQuaternion(buildQ).normalize();
    bqR.crossVectors(bqU, bqC).normalize();
    return { c: bqC, up: bqU, right: bqR };
  }

  // Frame the Heart: eye on the pole axis, the pole's tangent as up. Sets
  // the GOAL only — the loop's camera slerp (0.14/frame) does the easing,
  // so a recenter rides home over ~0.4s without its own animation.
  function centerBuildOnHeart() {
    followSuspend = false;
    const { hn, t1 } = poleFrame();
    bqZ.set(hn[0], hn[1], hn[2]).normalize();
    bqY.set(t1[0], t1[1], t1[2]);
    bqX.crossVectors(bqY, bqZ).normalize();
    bqY.crossVectors(bqZ, bqX).normalize();
    bqM.makeBasis(bqX, bqY, bqZ);
    buildQ.setFromRotationMatrix(bqM);
  }
  // Build mode drives now, so the free camera has a duty it did not have
  // before: if the tank leaves the frame, swing to bring it back. Top-down
  // is a real control mode only if the thing you are controlling cannot
  // escape the screen. The follow NEVER fights a drag — a finger on the
  // board owns the view outright — and it eases harder the further out the
  // tank is, so a nudge at the edge is gentle and an off-screen tank is not.
  const followQ = new THREE.Quaternion();
  const followV = new THREE.Vector3();
  // A deliberate pan SUSPENDS the follow — on a phone you explore in
  // flicks, and yielding only while a finger was down meant every lift
  // snapped the view straight back to the tank (operator: 'impossible to
  // explore'). Driving again — or an explicit recenter — re-arms it,
  // which keeps top-down as a real control mode exactly when it is one.
  let followSuspend = false;
  // sealed under a round's frontier the relay stands ON the high ground;
  // when its band reveals, it settles onto the lane floor with it
  function syncServerLift() {
    if (!serverObj || serverCi < 0) return;
    const sc = graph.centers[serverCi];
    const sn = graph.normals[serverCi];
    const lift = dungeon.tags[serverCi] === BLOCKED ? params.wallHeight : 0;
    serverObj.position.set(sc[0] + sn[0] * lift, sc[1] + sn[1] * lift, sc[2] + sn[2] * lift);
  }

  function buildFollowTank(dt) {
    if (!buildMode || strike.falling > 0 || !player.pos) return;
    if (buildPointers.size > 0) return;
    if (followSuspend) {
      if (!(steeringActive() || keys.left || keys.right || keys.fast
        || keys.slow || cruise)) return;
      followSuspend = false; // the player is driving — duty resumes
    }
    followV.set(player.pos[0], player.pos[1], player.pos[2]).project(camera);
    const out = Math.max(Math.abs(followV.x), Math.abs(followV.y));
    if (out < 0.78 && followV.z < 1) return;   // comfortably framed
    // target frame: pole on the tank's normal, keeping the current up so
    // the recenter does not roll the world underneath you
    const nrm = norm3(player.pos);
    bqZ.set(nrm[0], nrm[1], nrm[2]);
    bqY.copy(buildFrame().up);
    bqX.crossVectors(bqY, bqZ).normalize();
    bqY.crossVectors(bqZ, bqX).normalize();
    bqM.makeBasis(bqX, bqY, bqZ);
    followQ.setFromRotationMatrix(bqM);
    const k = Math.min(1, (0.4 + Math.max(0, out - 0.78) * 2.5) * dt * 2.4);
    buildQ.slerp(followQ, k).normalize();
  }

  const DTAP_MS = 350, DTAP_PX = 24; // double-tap-to-recenter window
  let lastTap = null;
  const anyHostiles = () => enemies.some((e) => e.alive);

  // --- ONE MODE ------------------------------------------------------------
  // BUILD/MANUAL used to be a mode switch that traded capabilities: build to
  // place towers but lose the fight controls, drive but lose the board. It
  // is gone. There are only CAMERAS now — orbit (the free strategic view,
  // whole planet at arm's length), third, pov, bastion — and every
  // capability works under every one of them: taps open the shop anywhere,
  // the tank drives anywhere, the auto-gunner fights anywhere.
  //
  // `buildMode` survives as a DERIVED value (view === 'orbit') because
  // twenty read-sites — the drag-orbit gestures, the free-cam branch, the
  // follow-cam — mean exactly "is the free camera up", and that meaning is
  // unchanged. It is assigned in ONE place, here.
  // ?viewlog=1 — EVERY view transition, with who asked. The recurring shell
  // complaint is "third person is not triggering", and the switch itself
  // measures clean — so the question is whether something else sets orbit
  // afterwards and never undoes it, which is exactly the shape of the
  // tutorial-build-phase bug of 2026-09-04. A sequence answers that; a
  // snapshot cannot.
  const viewLog = new URLSearchParams(location.search).get('viewlog') === '1';
  function setView(v) {
    if (viewLog) {
      const who = (new Error().stack || '').split('\n')[2] || '';
      console.log(`VIEWLOG ${params.view} -> ${v} build=${buildMode}`
        + ` shot=${shot ? shot.id : '-'} deploy=${!!deploy} tut=${tutorialActive}/${tutorial && tutorial.phase}`
        + ` by${who.replace(/^\s*at\s*/, ' ').replace(/https?:\/\/[^)]*\//, '').slice(0, 60)}`);
    }
    // THE SHELL HAS TWO VIEWS (ruling 3): DRIVE is third person, BUILD is
    // orbit. First person, the drone ride and the bastion cam are desktop
    // pleasures; on a phone the drone ride was one tap on Isao (he hovers
    // beside the tank printing towers) and one on the toast's button in the
    // caption lane — and the operator was riding him without knowing it:
    // "the tank is below the frame, I only see the tip of its plasma, the
    // POV looks too high". ?view= keeps its say, for probes.
    if (mobileShell && (v === 'pov' || v === 'drone' || v === 'bastion') && !viewOverride) v = 'third';
    // the drone view needs a drone: he is normally on shift from the first
    // second, but a board that has not finished loading his bytes yet would
    // hand you an empty camera. Ask for him, and fall through to orbit —
    // the view he is the diegetic excuse for — until he arrives.
    if (v === 'drone') {
      spawnIsao();
      if (!isao) v = 'orbit';
    }
    // the Stålheart is only worth explaining once it is IN FRAME, and the
    // build view is the first time the player looks down at the pole
    if (v === 'orbit') showBrief('stalheart');
    params.view = v;
    buildMode = v === 'orbit';
    watchTower = null;
    // TWO BUTTONS, not one cycle. A cycle makes you tap through a view you
    // did not want to reach the one you did, which on a phone mid-wave is
    // the difference between a camera and an obstacle (operator).
    const tankBtn = root.querySelector('#td-pad-tank');
    const orbitBtn = root.querySelector('#td-pad-orbit');
    if (tankBtn) tankBtn.classList.toggle('on', v === 'third' || v === 'pov');
    if (orbitBtn) orbitBtn.classList.toggle('on', v === 'orbit');
    // first orbit entry still frames the heart — a free camera pointed at
    // the dark side of a planet is not a view, it is a bug report
    if (buildMode && !buildCentered && graph && dungeon) {
      centerBuildOnHeart();
      buildCentered = true;
    }
    root.classList.toggle('build', buildMode);
    closeShop();   // the shop is screen-anchored; a view change moves its cell
    if (viewCtrl) viewCtrl.updateDisplay();
    updateHud();
  }

  // HOLD is gone (operator call, 2026-08-30): the wave telegraph gives
  // enough warning that a planning pause earned its keep no longer. The
  // constant stays so every gate on `frozen` reads unchanged.
  const buildFrozen = () => false;
  function toggleMap() {
    mapMode = mapMode === 'player' ? 'heart' : 'player';
    updateHud();
  }
  // stable tangent frame at the Heart pole (for both build cam and threat map)
  function poleFrame() {
    const hn = graph.normals[dungeon.heart];
    const ref = Math.abs(hn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1 = norm3(cross3(hn, ref));
    const t2 = cross3(hn, t1);
    return { hn, t1, t2 };
  }

  // When true, updateCameraGoal skips its overrides and yields the PLAIN
  // gameplay pose. That is how DEPLOY learns where the camera is going to
  // end up without re-deriving it: the pose is READ from the one function
  // that owns it, so the handover cannot drift from the shot that precedes
  // it. Re-entrant by exactly one level, and only ever set here.
  let camRaw = false;

  // WHERE THE CAMERA WOULD BE WITH NOTHING OVERRIDING IT. Reading the pose
  // instead of authoring a matching one is what makes every hand-off exact:
  // a prelude that ends here cannot drift from the gameplay camera, because
  // it IS the gameplay camera. DEPLOY blends into it; the DOWN DASH will
  // blend into it too, which is why this is a named function and not a trick
  // inside one `if`.
  function gameplayCameraPose(out) {
    camRaw = true;
    updateCameraGoal();
    camRaw = false;
    out.pos.copy(camGoal.pos);
    out.quat.copy(camGoal.quat);
  }

  function updateCameraGoal() {
    // DEPLOY eases the doorway framing into the gameplay framing over its own
    // progress, so at u=1 the two ARE the same pose and handing the controls
    // over changes nothing on screen.
    if (deploy && !camRaw) {
      const w = deployEase();
      deployFramePoseFor(deploy.n, camA);
      gameplayCameraPose(camB);
      camGoal.pos.lerpVectors(camA.pos, camB.pos, w);
      camGoal.quat.copy(camA.quat).slerp(camB.quat, w);
      return;
    }
    if (shot && !camRaw) {
      shot.poseAt(Math.min(1, Math.max(0, 1 - shot.left / shot.dur)), camGoal);
      return;
    }
    if (strike.falling > 0) {
      // riding the munition down: straight along the target cell's normal,
      // altitude easing on a smoothstep — slow at first, fast near impact,
      // which is what falling feels like. Shake is two incommensurate sines
      // (deterministic; render-only) escalating hard past 85%.
      const ci = strike.fallCi;
      const c = graph.centers[ci];
      const nrm = graph.normals[ci];
      const pr = fallProgress(strike);
      const ez = pr * pr * (3 - 2 * pr);
      const alt = 2.6 - (2.6 - params.wallHeight * 3 - cellSide * 0.8) * ez;
      const shakeAmt = (0.004 + 0.012 * pr + (pr > 0.85 ? (pr - 0.85) * 0.25 : 0)) * cellSide * 8;
      const st = performance.now() * 0.001;
      const ref = Math.abs(nrm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const t1 = norm3(cross3(nrm, ref));
      const t2 = cross3(nrm, t1);
      const sx = Math.sin(st * 47.0) * shakeAmt;
      const sy = Math.sin(st * 31.7) * shakeAmt;
      const eye = add3(scale3(nrm, 1 + alt), add3(scale3(t1, sx), scale3(t2, sy)));
      camGoal.pos.set(eye[0], eye[1], eye[2]);
      tmpCam.position.copy(camGoal.pos);
      tmpCam.up.set(t1[0], t1[1], t1[2]);
      tmpCam.lookAt(c[0], c[1], c[2]);
      camGoal.quat.copy(tmpCam.quaternion);
      return;
    }
    if (params.view === 'drone' && isao) {
      // RIDING ISAO. Purely a camera for now — he still flies his own
      // orders, you are just on board. The point is diegetic: a free look
      // over the whole shell is a strange power for a tank commander to
      // have, and an obvious one for the survey drone that is already up
      // there. The board answers "how are you seeing this" without a menu.
      //
      // Framed from behind and slightly above his rotor plane, looking
      // where HE is looking: the site on the way out, the print while he
      // works, his drift while he waits. That means the shot is composed by
      // the job rather than by the camera, which is the whole reason to
      // hang a view on a working machine instead of on a free gimbal.
      const bp = isao.obj.position;
      const up = isao.dir;
      // FORWARD IS WHERE THE PILOT IS POINTING — one notion of forward,
      // shared by the stick and the lens.
      //
      // This used to be derived from the JOB (the order's cell, or
      // isao.loiter), which was right when the comment above was written and
      // this view really was only a camera riding along. Piloting arrived
      // later and the camera was never told. Two consequences, both reported
      // by the operator and both measured by ?droneprobe=1: steering swung
      // his heading and the view never followed (camera-swing 0.0deg, so
      // sideways felt dead), and after a turn W flew him off the BACK of the
      // screen (W-after-turn -0.92, so forward was back). With no order,
      // isao.loiter is his own position, so `sub3(aimC, up)` was literally
      // the zero vector and the frame fell through to an arbitrary tangent.
      //
      // The frame still comes from the SPHERE, not from the mesh's facing:
      // hanging it off his quaternion put the lens inside him whenever he
      // was hovering nose-down over a print, and the tangent is stable
      // through every state he has.
      let fwd;
      if (isaoHeading) fwd = isaoHeading.slice();
      else {
        const aimC = isao.order ? norm3(graph.centers[isao.order.ci]) : isao.loiter;
        fwd = sub3(aimC, up);
      }
      fwd = sub3(fwd, scale3(up, dot3(fwd, up)));   // onto the tangent plane
      const fl = len3(fwd);
      fwd = fl > 1e-6 ? scale3(fwd, 1 / fl) : norm3(cross3(up, [0, 1, 0]));
      const back = cellSide * 4.2, lift = cellSide * 1.6;
      camGoal.pos.set(
        bp.x - fwd[0] * back + up[0] * lift,
        bp.y - fwd[1] * back + up[1] * lift,
        bp.z - fwd[2] * back + up[2] * lift,
      );
      tmpCam.position.copy(camGoal.pos);
      tmpCam.up.set(up[0], up[1], up[2]);
      // Aim BETWEEN him and the job, not at either. Aimed at the machine
      // you get a machine and no context; aimed at the site he drops out of
      // frame entirely, which is what the first cut did while he was
      // hovering directly over it. Just past him keeps both.
      const aimCi = isao.order ? isao.order.ci : -1;
      if (aimCi >= 0) {
        const c = graph.centers[aimCi];
        const top = 1 + params.wallHeight;
        const k = 0.45;
        tmpCam.lookAt(
          bp.x + (c[0] * top - bp.x) * k,
          bp.y + (c[1] * top - bp.y) * k,
          bp.z + (c[2] * top - bp.z) * k,
        );
      } else {
        // waiting: past him along the drift, tipped down at the shell —
        // the loiter shot
        tmpCam.lookAt(
          bp.x + fwd[0] * cellSide * 2.2 - up[0] * cellSide * 1.3,
          bp.y + fwd[1] * cellSide * 2.2 - up[1] * cellSide * 1.3,
          bp.z + fwd[2] * cellSide * 2.2 - up[2] * cellSide * 1.3,
        );
      }
      camGoal.quat.copy(tmpCam.quaternion);
      return;
    }
    if (params.view === 'bastion' && !buildMode) {
      // behind the anchor, facing the incoming lane (outward from the
      // Heart through a watched tower; toward the nearest live portal
      // when watching the Heart itself)
      const anchorCi = (watchTower && towers.includes(watchTower)) ? watchTower.ci : dungeon.heart;
      const ac = graph.centers[anchorCi];
      const an = graph.normals[anchorCi];
      const tangentAt = (pnt, toward) => {
        const nn = norm3(pnt);
        const raw = sub3(toward, pnt);
        const flat = sub3(raw, scale3(nn, dot3(raw, nn)));
        const l = len3(flat);
        return l > 1e-9 ? scale3(flat, 1 / l) : [1, 0, 0];
      };
      let lookDir;
      if (anchorCi === dungeon.heart) {
        let bp = null, bd = Infinity;
        for (const sp of spawnPoints) {
          if (!sp.alive) continue;
          const dd = dist3(ac, graph.centers[sp.ci]);
          if (dd < bd) { bd = dd; bp = graph.centers[sp.ci]; }
        }
        lookDir = bp ? tangentAt(ac, bp) : tangentAt(ac, graph.centers[dungeon.spawn]);
      } else {
        lookDir = scale3(tangentAt(ac, graph.centers[dungeon.heart]), -1); // outward
      }
      const eye = add3(add3(ac, scale3(an, params.wallHeight * 4 + cellSide * 2.0)),
        scale3(lookDir, -cellSide * 2.8));
      const look = add3(add3(ac, scale3(an, params.wallHeight)), scale3(lookDir, cellSide * 3));
      camGoal.pos.set(eye[0], eye[1], eye[2]);
      tmpCam.position.copy(camGoal.pos);
      tmpCam.up.set(an[0], an[1], an[2]);
      tmpCam.lookAt(look[0], look[1], look[2]);
      camGoal.quat.copy(tmpCam.quaternion);
      return;
    }
    if (buildMode) {
      // free: no elastic return, no angular ceiling. The carried frame is
      // what makes that safe anywhere on the sphere, antipode included.
      const { c, up } = buildFrame();
      camGoal.pos.copy(c).multiplyScalar(buildDist);
      tmpCam.position.copy(camGoal.pos);
      tmpCam.up.copy(up);
      tmpCam.lookAt(0, 0, 0);
      // BUILD HAS THE SAME PROBLEM. The cell you tapped is centred on the
      // canvas, and on a phone the canvas is taller than the screen — so the
      // thing you are placing can sit behind the chrome exactly as the tank
      // does. Same correction, same desktop no-op.
      applyViewportBias(tmpCam);
      camGoal.quat.copy(tmpCam.quaternion);
      return;
    }
    const c = player.pos;
    const n = norm3(c);
    const h = player.smoothDir;
    // suspension dip while a ram bump is live: sink the eye, ease out.
    // Recoil pulls the eye straight back along the heading instead.
    const dip = cellSide * 0.95 * bumpFactor() * bumpFactor();
    const kick = cellSide * 0.08 * params.recoil * recoilFactor() * recoilFactor();
    let eye, look;
    if (mobileShell && params.view === 'pov') params.view = 'third';   // the shell has no first person, whoever wrote it
    if (params.view === 'third') {
      // behind and above; pulls back as the creature grows so it stays framed
      // the shell rides a little LOWER behind (operator: "3rd person,
      // somewhat low behind"); the desktop pose is untouched
      const lift = mobileShell ? 0.78 : 1;
      eye = add3(add3(c, scale3(n, (params.wallHeight * 2.6 + cellSide * 1.1 + unitScale * 1.8) * lift)),
        scale3(h, -(cellSide * 1.8 + unitScale * 1.6)));
      // THE LOOK POINT decides where the tank sits in the frame, not the
      // eye's height. Looking 1.4 cells AHEAD from a low eye put the tank
      // at screen-y -0.43 — the bottom fifth of a phone's short viewport,
      // under the stick and the fire pad (operator, builds 1974eb11 and
      // 2d6b2444: "I still do not see the tank — too high or too forward").
      // The shell looks nearer the tank so it rides a third up the frame;
      // the desktop keeps its look-ahead.
      const ahead = mobileShell ? cellSide * 0.45 : cellSide * 1.4;
      look = add3(add3(c, scale3(n, params.wallHeight * 0.4 + unitScale * 0.5)),
        scale3(h, ahead));
    } else {
      // pov: down IN the corridor slot, below the wall tops, along its throat
      eye = add3(add3(c, scale3(n, params.wallHeight * 0.62)), scale3(h, -cellSide * 0.5));
      look = add3(add3(c, scale3(n, params.wallHeight * 0.28)), scale3(h, cellSide * 2.4));
    }
    if (dip > 0) eye = add3(eye, scale3(n, -dip));
    if (kick > 0) eye = add3(eye, scale3(h, -kick));
    camGoal.pos.set(eye[0], eye[1], eye[2]);
    tmpCam.position.copy(camGoal.pos);
    tmpCam.up.set(n[0], n[1], n[2]);
    tmpCam.lookAt(look[0], look[1], look[2]);
    applyViewportBias(tmpCam);
    camGoal.quat.copy(tmpCam.quaternion);
  }

  // THE CANVAS IS NOT WHAT THE PLAYER SEES. On a phone `innerHeight` — and
  // therefore the canvas — includes the strip behind the browser's own
  // chrome, while `visualViewport` is the part that is actually on screen.
  // The third-person rig frames the tank a third up the CANVAS, and when the
  // chrome eats the bottom that lands below the fold: the tank is drawn, in
  // frustum, the right size, and invisible. That is the `chrome` verdict the
  // watchdog has been reporting and refusing to act on, and it is the shape
  // of the recurring "not in third person, nor top view" report — the camera
  // was never stuck, it was aiming at a part of the canvas nobody can see.
  //
  // The correction is a pitch: bias the camera by the angle that moves the
  // target from the centre of the CANVAS to the centre of the VISIBLE band.
  // On a desktop, and headless, visualViewport reports the full canvas and
  // this is exactly zero — which is the right no-op, and the reason it can
  // ship without a device to test it on.
  let camBiasNdc = 0;
  // ?vpbias=<offsetTop>:<height> — PRETEND THE BROWSER IS EATING THE SCREEN.
  // A desktop cannot produce a visualViewport that differs from the canvas,
  // so the one correction that matters here could otherwise only be tested
  // on the device that reports the bug. This injects the band, which makes
  // the arithmetic — and the resulting pitch — checkable in a headless run.
  const vpFake = (() => {
    const m = /^(-?\d+):(\d+)$/.exec(new URLSearchParams(location.search).get('vpbias') || '');
    return m ? { offsetTop: +m[1], height: +m[2], offsetLeft: 0 } : null;
  })();
  function viewportBias() {
    const vv = vpFake || window.visualViewport;
    const cv = renderer.domElement;
    if (!vv || !cv.clientHeight) return 0;
    const half = cv.clientHeight / 2;
    // + means the visible centre is ABOVE the canvas centre, i.e. the chrome
    // is eating the bottom and the tank must ride higher
    const b = (half - (vv.offsetTop + vv.height / 2)) / half;
    return Math.max(-0.6, Math.min(0.6, b));   // never more than a screen's worth
  }
  function applyViewportBias(cam) {
    camBiasNdc = (mobileShell || vpFake) ? viewportBias() : 0;
    if (Math.abs(camBiasNdc) < 0.005) return;
    // NDC to angle, through the camera's own vertical half-angle
    const ang = Math.atan(camBiasNdc * Math.tan((cam.fov || camera.fov) * Math.PI / 360));
    cam.rotateX(-ang);
  }

  function snapCamera() {
    updateCameraGoal();
    camera.position.copy(camGoal.pos);
    camera.quaternion.copy(camGoal.quat);
  }

  // --- movement over the cell graph ---------------------------------------
  // the projection itself lives in vec3.js, so berths.js (pure, Node-tested)
  // and this file cannot drift apart; the wrapper just supplies `graph`
  const tangentDirTo = (from, to) =>
    tangentDir(graph.normals[from], graph.centers[from], graph.centers[to]);

  function openNeighbors(ci) {
    // towers block PATHING for everyone — they are the walls you buy
    return graph.adj[ci].filter((nb) => dungeon.tags[nb] !== BLOCKED && !towerCells.has(nb));
  }

  // --- the wanderer: exit choice = steering bias + its own whims -----------
  // Scored, not commanded: alignment with the steering intent dominates when
  // the player is actively steering, but unvisited-cell curiosity, a
  // backtrack penalty, and noise keep the walker willful.
  function chooseNext() {
    let exits = openNeighbors(player.cur);
    // auto never routes THROUGH a berth (free movement already refuses);
    // if the boxes somehow wall the only way out, solidity yields
    const clear = exits.filter((e2) => !containerBlocked(e2) && !pedestalBlocked(e2));
    if (clear.length) exits = clear;
    if (exits.length === 0) return -1;
    // control mode: while the user steers, their intent dominates — the
    // creature's curiosity, backtrack aversion, and whims all yield
    const active = steeringActive() || manualActive();
    // DIRECTIVE: a high-level order shapes the wander. Vector goals
    // (avoid/ram) become a tangent to chase or flee; field goals
    // (home/portal) score descending hop-distance.
    let goalVec = null, goalField = null, goalSign = 1;
    if (!active) {
      const d = params.directive;
      if (d === 'home') goalField = dungeon.distToHeart;
      else if (d === 'goto' && gotoField) goalField = gotoField;
      else if (d === 'portal' && portalDist) goalField = portalDist;
      else if (d === 'avoid' || d === 'ram') {
        let bt = null, bd = Infinity;
        for (const en of enemies) {
          if (!en.alive) continue;
          if (d === 'ram' && !en.spec.rammable) continue;
          const dd = dist3(player.pos, en.pos);
          if (dd < bd) { bd = dd; bt = en; }
        }
        if (bt && bd < cellSide * 14) {
          const n = norm3(player.pos);
          const raw = sub3(bt.pos, player.pos);
          const flat = sub3(raw, scale3(n, dot3(raw, n)));
          const l = len3(flat);
          if (l > 1e-9) {
            goalVec = scale3(flat, 1 / l);
            goalSign = d === 'avoid' ? -1 : 1;
          }
        }
      }
    }
    // SOLID units hurt to touch, and no autopilot order should drive the
    // hull through one (operator ruling, filed against seek-home): every
    // directive except RAM (its chase must not be disrupted) and AVOID
    // (which already flees everything) gets a flee vector away from the
    // dangerous tier, weighted by proximity so it outvotes the goal field
    // only at close range.
    let fleeVec = null;
    if (!active && params.directive !== 'ram' && params.directive !== 'avoid') {
      const R = cellSide * 4;
      let fx = 0, fy = 0, fz = 0, any = false;
      for (const en of enemies) {
        if (!en.alive || en.spec.rammable) continue;
        const dd = dist3(player.pos, en.pos);
        if (dd > R) continue;
        const w = 1 - dd / R;
        fx += (player.pos[0] - en.pos[0]) * w;
        fy += (player.pos[1] - en.pos[1]) * w;
        fz += (player.pos[2] - en.pos[2]) * w;
        any = true;
      }
      if (any) {
        const n = norm3(player.pos);
        const raw = [fx, fy, fz];
        const flat = sub3(raw, scale3(n, dot3(raw, n)));
        const l = len3(flat);
        if (l > 1e-9) fleeVec = scale3(flat, Math.min(1, l / cellSide) / l);
      }
    }
    let best = exits[0], bestScore = -Infinity;
    for (const e of exits) {
      const dir = tangentDirTo(player.cur, e);
      let score = (active ? 4.5 : 2.2) * dot3(player.heading, dir);
      if (!active && !player.visited.has(e)) score += 1.1;      // curiosity
      if (!active && e === player.prev && exits.length > 1) score -= 2.4;
      if (goalVec) score += 3.2 * goalSign * dot3(dir, goalVec);
      if (fleeVec) score += 3.6 * dot3(dir, fleeVec);
      if (goalField) {
        const gain = goalField[player.cur] - goalField[e];      // +1 closer
        score += 3.2 * Math.max(-1, Math.min(1, gain));
      }
      score += (whim() - 0.5) * (active ? 0.4 : 1.6);           // its own will
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  // NOTE: reaching the heart is NOT a win here (that's the maze tabs'
  // rule) — the pole is home turf. The only victory is checkVictory's:
  // every spawn point destroyed and the field cleared.
  function arriveAt(cell) {
    player.prev = player.cur;
    player.cur = cell;
    player.moves++;
    player.visited.add(cell);
    paintCell(player.prev, floorColorOf(player.prev));
    updateHud();
  }

  // called once per frame: steer, glide (creature-paced), respawn, absorb
  function advanceMotion(dt) {
    if (player.won || playerDown || player.next === -1) return;
    runContext.advance(dt);

    // continuous steering while held; ANY key claims manual control —
    // and an engaged cruise keeps manual alive without touching a key
    const anyKey = keys.left || keys.right || keys.fast || keys.slow;
    if (anyKey || cruise) autoMode = false; // any drive input takes the wheel — sticky, no timer
    steerHold = anyKey ? 0 : steerHold + dt;
    const manual = manualActive();
    if (keys.left) rotate(STEER_RATE * dt);
    if (keys.right) rotate(-STEER_RATE * dt);

    // MANUAL = FREE movement: kinematics leave the grid entirely. W drives
    // along the heading, S reverses, A/D steer continuously; the grid is
    // consulted only as a collision oracle (blocked cell? no entry) and to
    // keep semantics (current cell, visited, absorption) in sync.
    if (manual) {
      player.freeMode = true;
      // forward is PLAYER-TRIGGERED: hold W to drive, or double-tap W/▲
      // to engage CRUISE (rolls on its own; W boosts, S kills it). The
      // old always-rolls-forward manual proved too aggressive.
      // keys still override (a held key is an explicit act); otherwise the
      // lever's resting position is the speed
      const drive = keys.slow ? -0.55
        : keys.fast ? (cruise ? 1.45 : 1)
        : (throttle !== 0 ? throttle : (cruise ? 1 : 0));
      if (drive !== 0) {
        const v = params.speed * speedBonus * cellSide * 1.6 * drive
          * (1 - 0.65 * bumpFactor()); // the run-over drag
        const step = scale3(player.heading, v * dt);
        let cand = norm3(add3(player.pos, step));
        if (freeBlocked(cand)) {
          // slide: strip the into-wall component and try again
          const w = nearestWall(cand);
          if (w) {
            const toWall = norm3(sub3(w, player.pos));
            const into = Math.max(0, dot3(step, toWall));
            // a mostly head-on hit THUDS like running something over;
            // the bumpLeft gate keeps grinding along a wall from
            // re-triggering every frame
            if (into > 0.55 * len3(step) && bumpLeft <= 0) bumpLeft = BUMP_LEN * 0.8;
            const slid = sub3(step, scale3(toWall, into));
            cand = norm3(add3(player.pos, slid));
            if (freeBlocked(cand)) cand = null;
          } else cand = null;
          // wedged with nowhere to slide? creep toward the CURRENT cell's
          // center — it is open ground by definition, so the tank can
          // always un-stick itself, shells or no shells
          if (!cand) {
            const home = graph.centers[player.cur];
            const toHome = sub3(home, player.pos);
            const l = len3(toHome);
            if (l > 1e-6) {
              const creep = norm3(add3(player.pos,
                scale3(toHome, Math.min(1, (v * dt) / l))));
              if (!freeBlocked(creep)) cand = creep;
            }
          }
        }
        if (cand) {
          player.pos = cand;
          player.travelDir = drive > 0 ? player.heading.slice() : scale3(player.heading, -1);
          const ci = cellIndex(cand);
          if (ci !== -1 && ci !== player.cur) arriveAt(ci);
        }
      }
      player.pos = wallCushion(player.pos);
      const nf = norm3(player.pos);
      player.heading = norm3(sub3(player.heading, scale3(nf, dot3(player.heading, nf))));
      updateSmoothDir(dt);
      // food systems keep running while driving free
      if (params.orbRespawn > 0) {
        respawnClock += dt;
        if (respawnClock >= params.orbRespawn) {
          respawnClock = 0;
          if (orbMeshes.size < params.orbs) spawnOneOrb();
        }
      }
      checkAbsorb();
      return;
    }

    // AUTO resumes from wherever free movement left off: the nearest open
    // cell becomes home, and the first glide eases out from the actual
    // position (virtualStart) instead of snapping to a cell center
    if (player.freeMode) {
      player.freeMode = false;
      const ci = cellIndex(player.pos);
      if (ci !== -1 && dungeon.tags[ci] !== BLOCKED) player.cur = ci;
      player.prev = -1;
      player.next = chooseNext();
      player.prog = 0;
      player.virtualStart = player.pos.slice();
      if (player.next !== -1) {
        player.segLen = Math.max(1e-9, dist3(player.pos, graph.centers[player.next]));
      }
    }

    // U-turn: heading swung behind the motion — reverse the glide in place.
    if (steeringActive() && dot3(player.heading, player.travelDir) < -0.35
      && player.prog > 0.04 && player.prog < 0.96) {
      const old = player.cur;
      player.cur = player.next;
      player.next = old;
      player.prog = 1 - player.prog;
      player.prev = -1;
    }

    // orb respawn: the maze regrows food over time
    if (params.orbRespawn > 0) {
      respawnClock += dt;
      if (respawnClock >= params.orbRespawn) {
        respawnClock = 0;
        if (orbMeshes.size < params.orbs) spawnOneOrb();
      }
    }

    // world-space motion: speed is distance/sec over THIS segment's length,
    // so a long chord between large cells takes proportionally longer — the
    // grid offers the space, the motion traverses it. The creature's own
    // locomotion profile modulates the pace on top.
    // manual: motion only while W/S are held; auto: the creature's own pace
    const prof = MOVES[params.creature];
    const pace = params.speed * speedBonus * (prof ? prof.speed(runContext.time) : 1)
      * (1 - 0.65 * bumpFactor()); // the run-over drag
    player.prog += (pace * cellSide * dt) / player.segLen;
    while (player.prog >= 1 && !player.won) {
      const carry = (player.prog - 1) * player.segLen; // leftover distance
      player.virtualStart = null;
      arriveAt(player.next);
      // idle: steering intent drifts toward actual travel; while the user
      // steers, their intent is left untouched
      if (!steeringActive() && !manualActive()) {
        const td = tangentDirTo(player.prev, player.cur);
        player.heading = norm3(add3(scale3(player.heading, 0.65), scale3(td, 0.35)));
      }
      player.next = chooseNext();
      if (player.next === -1) { player.prog = 0; break; }
      player.segLen = Math.max(1e-9, dist3(graph.centers[player.cur], graph.centers[player.next]));
      player.prog = carry / player.segLen;
    }
    // interpolate along the chord, then push back onto the sphere
    const a = player.virtualStart || graph.centers[player.cur];
    const b = graph.centers[player.next === -1 ? player.cur : player.next];
    const f = Math.min(player.prog, 1);
    const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    player.pos = norm3(p); // radius 1
    const n = player.pos;
    const d = sub3(b, player.pos);
    const flat = sub3(d, scale3(n, dot3(d, n)));
    const l = Math.hypot(flat[0], flat[1], flat[2]);
    if (l > 1e-9) player.travelDir = scale3(flat, 1 / l);
    // cushion AFTER travelDir so the push shifts the body, not the aim
    player.pos = wallCushion(player.pos);
    // keep the steering intent in the local tangent plane as we move
    player.heading = norm3(sub3(player.heading, scale3(n, dot3(player.heading, n))));

    updateSmoothDir(dt);
    checkAbsorb();
  }

  // ram bump: running something over has WEIGHT — a short window where the
  // tank loses pace and the camera dips, like the suspension taking it.
  // Countdown-seconds (not a timestamp) so it works on both clocks.
  const BUMP_LEN = 0.5;
  let bumpLeft = 0;
  const bumpFactor = () => Math.max(0, bumpLeft / BUMP_LEN);

  // cannon: firing kicks the tank back (recoil) and heats the barrel
  // sleeve red-hot — no second shell until it cools over 3 s. The sleeve
  // IS the cooldown gauge; the HUD only echoes it.
  const CANNON_COOL = 3.0;
  // the kick's length is a tunable like the rest — read it, never copy it
  const recoilLen = () => FEEL.recoilLen;
  let cannonHeat = 0;
  let recoilLeft = 0;
  const recoilFactor = () => Math.max(0, recoilLeft / recoilLen());
  const sleeveCool = new THREE.Color(0x232833);
  const sleeveHot = new THREE.Color(0xff2a10);

  const STEER_RATE = 2.6; // rad/s while a steer key is held
  function rotate(theta) {
    const n = norm3(player.pos);
    const h = player.heading;
    const c = Math.cos(theta), s = Math.sin(theta);
    const nxh = cross3(n, h);
    player.heading = norm3(add3(scale3(h, c), scale3(nxh, s)));
  }

  // smoothDir chases travelDir at a bounded angular rate — the no-jump
  // guarantee for cameras and the creature at exits and U-turns
  const SMOOTH_RATE = 5.0; // rad/s
  function updateSmoothDir(dt) {
    const n = norm3(player.pos);
    let s = norm3(sub3(player.smoothDir, scale3(n, dot3(player.smoothDir, n))));
    const raw = manualActive() ? player.heading : player.travelDir;
    const g = norm3(sub3(raw, scale3(n, dot3(raw, n))));
    const ang = Math.atan2(dot3(cross3(s, g), n), Math.max(-1, Math.min(1, dot3(s, g))));
    const step = Math.max(-SMOOTH_RATE * dt, Math.min(SMOOTH_RATE * dt, ang));
    const c = Math.cos(step), si = Math.sin(step);
    const nxs = cross3(n, s);
    player.smoothDir = norm3(add3(scale3(s, c), scale3(nxs, si)));
  }

  function onKeyEvent(ev, down) {
    if (!active) return;
    // a clicked button (lil-gui title, d-pad, modal regen) keeps FOCUS, and
    // the browser "clicks" the focused button again on Space — which is the
    // fire key. That's how the panel kept "opening by itself" mid-battle.
    // Drop button focus before handling any game key. Inputs keep focus
    // (typing a seed must not drive the tank's keys into blur).
    if (down && document.activeElement && document.activeElement.tagName === 'BUTTON') {
      document.activeElement.blur();
    }
    const k = ev.key.toLowerCase();
    // QoL: with a tower SELECTED (its radial open, or watched in bastion),
    // W/↑ upgrades it instead of driving — HK's shortcut, kept out of the
    // tank's way by requiring a selection context
    // U upgrades the selected tower. It was W, which is ALSO the drive key —
    // a shortcut that fires while you are steering is a trap, not a shortcut.
    if (down && k === 'u') {
      const sel = towerByCell.get(shopCi);
      if (sel) {
        if (orderUpgrade(sel)) {
          if (shopCi !== -1) openShop(shopCi); // refresh the radial
        } else if (shopCi !== -1) {
          flashShopNote(upgradeCost(sel.def, sel.tier) === null ? 'max tier' : 'not enough biomass');
        }
        ev.preventDefault();
        return;
      }
    }
    const m = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
      arrowup: 'fast', w: 'fast', arrowdown: 'slow', s: 'slow',
      shift: 'laser' }[k];
    if (m) {
      if (down && m === 'fast' && !keys.fast) noteFastTap(); // double-tap → cruise
      // the brake kills BOTH holds, or releasing S would drive off again
      if (down && m === 'slow') { cruise = false; throttle = 0; paintThrottle(); }
      keys[m] = down;
      ev.preventDefault();
      return;
    }
    // the tower radial claims the keyboard while it is up: digits place
    // (1..8 in unlock order — the same order the wheel shows), ESC closes.
    // Claimed even when the placement fails (locked / can't afford), so a
    // miss never falls through and flips the camera instead.
    if (down && shopCi !== -1) {
      if (k === 'escape') { closeShop(); ev.preventDefault(); return; }
      const d = parseInt(k, 10);
      // Catalog numbers, radial slots and keyboard digits share one order.
      if (d >= 1 && d <= TOWERS.length && !towerByCell.get(shopCi)) {
        const def = TOWERS[d - 1];
        const tkey = def.key;
        const unlocked = new Set(unlockedTowerKeys(wave, hackedUnlocks));
        if (unlocked.has(tkey) && !placeError(shopCi) && eco.canAfford(def.cost)) {
          if (orderTower(tkey, shopCi)) closeShop();
        }
        ev.preventDefault();
        return;
      }
    }
    if (down && k === 'escape') { togglePause(); ev.preventDefault(); return; }
    if (paused) return; // frozen: only ESC gets through
    // FLYING HIM, SPACE AND SHIFT ARE ALTITUDE. Context-scoped exactly like
    // the U-upgrade shortcut: the drone view is the only place these mean
    // anything else, and a tank commander is not firing while he is a drone.
    if (params.view === 'drone' && (k === ' ' || k === 'spacebar' || k === 'shift')) {
      keys[k === 'shift' ? 'droneDown' : 'droneUp'] = down;
      ev.preventDefault();
      return;
    }
    if (down && (k === ' ' || k === 'spacebar')) { fire(); ev.preventDefault(); return; }
    if (down && k === 'n') { layMineNow(); ev.preventDefault(); return; }
    // T FOR TATE (盾), not S. S is REVERSE — it is in CTL_DRIVE_KEYS with w/a/d
    // — so binding the shield to it meant every time the player backed up they
    // also spent a charge. My earlier check grepped for `k === 's'` and found
    // nothing, which is exactly the wrong question: the drive keys are read
    // through a MAP, not a literal, so the conflict was invisible to the search
    // and would have shown up as a rack that emptied itself.
    if (down && k === 't') { deployShieldNow(); ev.preventDefault(); return; }
    if (down && k === 'h') pulseHint();
    if (down && k === 'v') toggleView();
    if (down && k === 'x' && serverFound && !hackedRound) openHack();
    // views land on number keys and on the letters that say them: 1/M/O all
    // read as "map" and go to orbit, 2 is first person, 3 third person (T is
    // the SHIELD now, and V still cycles). The radar's heart/player toggle
    // lives on the MAP button alone.
    if (down && (k === '1' || k === 'm' || k === 'o')) setView('orbit');
    if (down && k === '2') setView('pov');
    // THIRD PERSON LOSES ITS LETTER to the shield. It keeps `3`, and `v`
    // still cycles views, so no way in is actually gone — where the shield had
    // no key at all that did not already mean something else.
    if (down && k === '3') setView('third');
    // C for Cheat (moved off M, which is a VIEW now)
    if (down && k === 'c') {
      strike.ready = Math.min(9, strike.ready + 1);
      showToast('<div class="wave-num">CHEAT · MISSILE LOADED</div>'
        + `<div class="wave-role">☄ ready ${strike.ready}</div>`, 1200);
    }
    // Q/E nudge the throttle lever from the keyboard — up for speed, down
    // through zero into reverse. Key auto-repeat does the holding.
    if (down && (k === 'q' || k === 'e')) {
      // FLYING HIM: the same pair is altitude, which is the axis a ground
      // vehicle never had and a drone obviously should
      if (params.view === 'drone') {
        isaoAlt = Math.max(1.2, Math.min(9, isaoAlt + (k === 'q' ? 0.35 : -0.35)));
        return;
      }
      const step = k === 'q' ? 0.12 : -0.12;
      let v2 = throttle + step;
      if (Math.abs(v2) < 0.07) v2 = 0;   // same detent the lever has
      throttle = Math.min(1, Math.max(-THROTTLE_REV, v2));
      if (throttle !== 0) { cruise = false; autoMode = false; }
      paintThrottle();
    }
  }
  addEventListener('keydown', (ev) => onKeyEvent(ev, true));
  addEventListener('keyup', (ev) => onKeyEvent(ev, false));
  addEventListener('blur', () => { keys.left = keys.right = keys.fast = keys.slow = keys.laser = false; });

  // T1 tank first person · T3 tank third person · O1 orbital. Bastion left
  // the cycle (tower-watching was a spectator mode nobody drove from), and
  // nothing auto-centres any more — the two CENTRE buttons do it on demand.
  const VIEW_TAG = { pov: 'T1', third: 'T3', orbit: 'O1', drone: 'BOB' };
  // V toggles the two views that have buttons. POV is parked (operator: it
  // earns its screen space on nobody's phone) but still selectable from the
  // GUI, and the DRONE is not on the cycle at all — you get it by reaching
  // for Isao, which is the point of it.
  function toggleView() {
    setView(params.view === 'third' ? 'orbit' : 'third');
  }

  // touch zones/buttons: press-and-hold, like the keys; onPress fires per
  // fresh tap. The .pressed glow is the zones' only feedback — they carry
  // no labels, so the glow IS the affordance.
  function holdButton(sel, flag, onPress) {
    const el = root.querySelector(sel);
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (onPress) onPress();
      keys[flag] = true;
      el.classList.add('pressed');
    });
    for (const evt of ['pointerup', 'pointerleave', 'pointercancel']) {
      el.addEventListener(evt, () => {
        keys[flag] = false;
        el.classList.remove('pressed');
      });
    }
  }
  // --- throttle lever -----------------------------------------------------
  const throtEl = root.querySelector('#td-throttle');
  const throtTrack = throtEl.querySelector('.throttle-track');
  const throtFill = throtEl.querySelector('.throttle-fill');
  const throtHandle = throtEl.querySelector('.throttle-handle');
  const throtRead = throtEl.querySelector('.throttle-read');

  function paintThrottle() {
    const zeroPct = THROTTLE_ZERO * 100;
    // handle position, measured down from the top of the track
    const t = throttle >= 0
      ? THROTTLE_ZERO * (1 - throttle)
      : THROTTLE_ZERO + (-throttle / THROTTLE_REV) * (1 - THROTTLE_ZERO);
    throtHandle.style.top = `${t * 100}%`;
    // the fill grows from the zero line toward the handle, either way
    const a = Math.min(t * 100, zeroPct);
    const b = Math.max(t * 100, zeroPct);
    throtFill.style.top = `${a}%`;
    throtFill.style.height = `${b - a}%`;
    throtEl.classList.toggle('rev', throttle < 0);
    throtEl.classList.toggle('idle', throttle === 0);
    throtRead.textContent = throttle === 0 ? '0' : `${Math.round(throttle * 100)}`;
  }

  function setThrottleFromY(clientY) {
    const r = throtTrack.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientY - r.top) / (r.height || 1)));
    let v = t <= THROTTLE_ZERO
      ? (THROTTLE_ZERO - t) / THROTTLE_ZERO
      : -((t - THROTTLE_ZERO) / (1 - THROTTLE_ZERO)) * THROTTLE_REV;
    if (Math.abs(v) < 0.07) v = 0;   // detent, so "stop" is findable by feel
    throttle = Math.min(1, Math.max(-THROTTLE_REV, v));
    if (throttle !== 0) { cruise = false; autoMode = false; }
    paintThrottle();
  }

  throtEl.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    throtEl.setPointerCapture(ev.pointerId);
    throtEl.classList.add('pressed');
    setThrottleFromY(ev.clientY);
  });
  throtEl.addEventListener('pointermove', (ev) => {
    if (!throtEl.hasPointerCapture(ev.pointerId)) return;
    setThrottleFromY(ev.clientY);
  });
  for (const evt of ['pointerup', 'pointercancel']) {
    throtEl.addEventListener(evt, () => throtEl.classList.remove('pressed'));
  }
  paintThrottle();
  holdButton('#td-pad-laser', 'laser');
  holdButton('#td-pad-left', 'left');
  holdButton('#td-pad-right', 'right');
  root.querySelector('#td-pad-tank').addEventListener('click', () => setView('third'));
  root.querySelector('#td-pad-orbit').addEventListener('click', () => setView('orbit'));
  // CENTRE controls: the camera never sticks to anything now — these two
  // aim the orbital view on demand (and take you there if you are not in it)
  function centerBuildOnTank() {
    followSuspend = false;
    if (!player.pos) return;
    const nrm = norm3(player.pos);
    bqZ.set(nrm[0], nrm[1], nrm[2]);
    bqY.copy(buildFrame().up);
    bqX.crossVectors(bqY, bqZ).normalize();
    bqY.crossVectors(bqZ, bqX).normalize();
    bqM.makeBasis(bqX, bqY, bqZ);
    buildQ.setFromRotationMatrix(bqM);
  }
  root.querySelector('#td-pad-ctrheart').addEventListener('click', () => {
    if (params.view !== 'orbit') setView('orbit');
    centerBuildOnHeart();
    buildDist = 3.4;   // the heart centre IS the strategic pose: whole planet
  });
  root.querySelector('#td-pad-ctrtank').addEventListener('click', () => {
    if (params.view !== 'orbit') setView('orbit');
    centerBuildOnTank();
    buildDist = 2.0;   // the tank centre is tactical: close enough to read cells
  });
  function syncDirectiveChip() {
    const chip = root.querySelector('#td-pad-dir');
    if (chip) chip.textContent = DIRECTIVE_LABEL[params.directive] || 'WANDER';
  }
  // TANK-AUTO: the button opens a small radial of directives instead of
  // blind-cycling six of them — on a phone, cycling meant tapping through
  // five states you did not want to reach the one you did.
  const autoRadial = root.querySelector('#td-auto-radial');
  const AUTO_OPTIONS = [
    ['wander', 'WANDER'], ['avoid', 'AVOID'], ['ram', 'RAM'],
    ['conserve', 'SAVE SHELLS'], ['portal', 'SEEK PORTAL'], ['home', 'SEEK HOME'],
  ];
  for (const [key, label] of AUTO_OPTIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.dir = key;
    b.addEventListener('click', () => {
      params.directive = key;
      autoMode = true;   // picking a directive is the ONLY way into auto
      steerHold = 1.2;   // give auto its takeover window
      cruise = false;
      directiveCtrl.updateDisplay();
      syncDirectiveChip();
      updateHud();
      autoRadial.classList.add('hidden');
    });
    autoRadial.appendChild(b);
  }
  function syncAutoRadial() {
    for (const b of autoRadial.children) {
      b.classList.toggle('active', b.dataset.dir === params.directive && !manualActive());
    }
  }
  root.querySelector('#td-pad-dir').addEventListener('click', () => {
    const open = autoRadial.classList.toggle('hidden');
    if (!open) syncAutoRadial();
  });
  // any tap that is not the radial closes it — a menu must not linger
  addEventListener('pointerdown', (ev) => {
    if (!autoRadial.classList.contains('hidden')
      && !autoRadial.contains(ev.target)
      && ev.target !== root.querySelector('#td-pad-dir')) {
      autoRadial.classList.add('hidden');
    }
  });

  syncDirectiveChip();
  root.querySelector('#td-pad-map').addEventListener('click', () => toggleMap());

  // build-camera input: drag = azimuth orbit, wheel = zoom, TAP = select a
  // cell (shop/upgrade). A tap is a press that never traveled; anything
  // that moves >8 px is an orbit. Action-mode pointers stay untouched.
  // build-mode input: single finger orbits the azimuth, TWO fingers pinch to
  // zoom. Track pointers by id so a pinch never fires a tower-placing tap.
  const buildPointers = new Map(); // pointerId -> {x, y}
  let pinchPrev = null;            // last two-finger pixel distance
  let pinched = false;             // ≥2 fingers touched this gesture → no tap
  let tapStart = null;
  // A tap is a press that never travelled. 8px is a trackpad's idea of
  // "never"; a finger on glass jitters more than that (PLAYTEST-TODO §1:
  // "a tap that moves 6px is still a tap to a human"). The shell's slop is
  // finger-sized; desktop keeps its 8.
  const tapSlop = () => (mobileShell ? 14 : 8);
  // LONG-PRESS is the secondary action (plan §2.3): on the shell, in BUILD,
  // holding a finger on a tower orders its upgrade — the desktop's U key,
  // without a key. Cleared by travel, a second finger, or lifting.
  const LONG_PRESS_MS = 550;
  let pressTimer = 0;
  let pressFired = false;          // the press was spent: the lift is not a tap
  container.addEventListener('pointerdown', (ev) => {
    // taps are tracked under EVERY camera — the shop opens anywhere now.
    // Drag-orbit and pinch stay orbit-only; the chase cams own their framing.
    clearTimeout(pressTimer); pressFired = false;
    if (buildMode) {
      buildPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (buildPointers.size >= 2) { pinched = true; pinchPrev = null; tapStart = null; return; }
    }
    tapStart = [ev.clientX, ev.clientY];
    if (mobileShell && buildMode) {
      const px = ev.clientX, py = ev.clientY;
      pressTimer = setTimeout(() => {
        if (!tapStart || pinched) return;
        const ci = cellAtScreen(px, py);
        const tw = ci !== -1 ? towerByCell.get(ci) : null;
        if (!tw) return;
        pressFired = true; tapStart = null;
        longPressUpgrade(tw);
      }, LONG_PRESS_MS);
    }
  });
  function longPressUpgrade(tw) {
    const cost = upgradeCost(tw.def, tw.tier);
    let note;
    if (cost === null) note = 'at MAX tier';
    else if (orderByCell.has(tw.ci)) note = 'already on the list';
    else if (!eco.canAfford(cost)) note = `upgrade needs ${cost}kg &middot; you have ${eco.biomass}kg`;
    else if (orderUpgrade(tw)) { note = `+1 ordered &middot; ${cost}kg`; sfx.play('laser_click'); }
    else note = 'could not order';
    closeShop();
    showToast(`<div class="wave-num">${tw.def.label} &middot; TIER ${tw.tier}</div>`
      + `<div class="wave-role">${note}</div>`, 2200);
  }
  // A REFUSED PLACEMENT SAYS WHY, on the shell (PLAYTEST-TODO §1). The
  // desktop's silence rule stands there — a radial of greyed-out towers is
  // worse than nothing — but a caption is not a radial, and on glass a tap
  // that does nothing is indistinguishable from a tap that missed. Same
  // reason twice inside a second and a half is said once.
  let refuseLast = { why: '', t: 0 };
  function refuseCaption(why) {
    const t = performance.now();
    if (why === refuseLast.why && t - refuseLast.t < 1500) return;
    refuseLast = { why, t };
    showToast(`<div class="wave-num">NOT HERE</div><div class="wave-role">${why}</div>`, 1800);
  }
  addEventListener('pointermove', (ev) => {
    if (!buildMode) return;
    const prev = buildPointers.get(ev.pointerId);
    if (!prev) return;
    const dx = ev.clientX - prev.x;
    const dy = ev.clientY - prev.y;
    prev.x = ev.clientX; prev.y = ev.clientY;
    if (buildPointers.size >= 2) {
      const p = [...buildPointers.values()];
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (pinchPrev !== null && d > 0) {
        buildDist = Math.min(4, Math.max(1.4, buildDist * (pinchPrev / d)));
      }
      pinchPrev = d; pinched = true; tapStart = null; clearTimeout(pressTimer);
      return;
    }
    if (tapStart && Math.hypot(ev.clientX - tapStart[0], ev.clientY - tapStart[1]) > tapSlop()) {
      tapStart = null; // it's a pan now
      clearTimeout(pressTimer);
    }
    // grab the sphere and roll it: the drag rotates the carried frame about
    // its own up/right axes. Same feel as the old flick-to-pan, but it can
    // go all the way round instead of stopping at a ceiling.
    {
      const f = buildFrame();
      dragUp.copy(f.up);
      dragRight.copy(f.right);
      const k = buildDist * 0.0016; // px → radians, zoom-aware
      followSuspend = true; // exploring: the follow waits for the wheel
      buildQ.premultiply(bqTmp.setFromAxisAngle(dragUp, -dx * k));
      buildQ.premultiply(bqTmp.setFromAxisAngle(dragRight, -dy * k));
      buildQ.normalize();
    }
  });
  function endBuildPointer(ev) {
    clearTimeout(pressTimer);
    const wasTap = !pinched && !pressFired && tapStart
      && Math.hypot(ev.clientX - tapStart[0], ev.clientY - tapStart[1]) <= tapSlop();
    buildPointers.delete(ev.pointerId);
    if (buildPointers.size < 2) pinchPrev = null;
    if (strike.falling > 0 && wasTap) {
      // the feed owns every tap while the munition flies: pointerdown already
      // spent this one on retarget-or-skip, and letting it fall through
      // opened the tower shop underneath the strike camera
      lastTap = null;
    } else if (strike.armed && wasTap) {
      // painting outranks every other tap while armed: the board is a
      // targeting surface until the safety goes back on
      const ci = cellAtScreen(ev.clientX, ev.clientY);
      if (ci !== -1 && paintTarget(strike, ci) === 'locked') {
        sfx.play('tank_shells');
        showRangeRing(ci, strikeTune.blastCells, 0xffb347, 30);
        syncArmUi();
      }
    } else if (wasTap) {
      // double-tap in ORBIT rides the view home AND pulls back to the whole
      // planet — the strategic pose is one gesture from anywhere. Checked
      // BEFORE the shop opens, closing whatever the first tap opened.
      const tnow = performance.now();
      const dbl = buildMode && lastTap && tnow - lastTap.t < DTAP_MS
        && Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) <= DTAP_PX;
      if (dbl) {
        lastTap = null;
        closeShop();
        centerBuildOnHeart();
        buildDist = 3.4;
        return;
      }
      lastTap = { t: tnow, x: ev.clientX, y: ev.clientY };
      // TAP ISAO TO RIDE HIM. The drone camera is not on the view cycle,
      // because reaching for the machine you want to look through is a
      // better gesture than tapping past two other cameras to find it. It
      // asks first: a mis-tap that hijacks your camera mid-wave is worse
      // than no shortcut at all.
      if (isao && params.view !== 'drone' && !mobileShell) {
        const r0 = renderer.domElement.getBoundingClientRect();
        ndc.set(((ev.clientX - r0.left) / r0.width) * 2 - 1,
          -((ev.clientY - r0.top) / r0.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.intersectObject(isao.obj, true).length) {
          askDroneView();
          return;
        }
      }
      // bastion first claim: a tap on a TOWER watches it
      if (params.view === 'bastion') {
        const r = renderer.domElement.getBoundingClientRect();
        ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1,
          -((ev.clientY - r.top) / r.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(towers.map((tw) => tw.obj), true);
        if (hits.length) {
          let obj = hits[0].object;
          while (obj && !towers.some((tw) => tw.obj === obj)) obj = obj.parent;
          watchTower = towers.find((tw) => tw.obj === obj) || null;
          return;
        }
        watchTower = null;
      }
      // the shop opens under EVERY camera — building is not a mode
      const ci = cellAtScreen(ev.clientX, ev.clientY);
      // TAP-TO-GO, on the shell, while driving. The relay's own cells keep
      // their tap (below); everything else on open ground is a destination.
      if (mobileShell && !buildMode && wasTap && ci !== -1
          && !(serverCi >= 0 && (ci === serverCi || graph.adj[serverCi].includes(ci)))) {
        if (gotoCell(ci)) return;
      }
      // tapping the SERVER (its cell or a neighbour) is the interaction:
      // hack if it is awake, and say why not if it is not — a silent
      // nothing was exactly the operator's 'cannot find how to interact'
      if (ci !== -1 && serverCi >= 0
          && (ci === serverCi || graph.adj[serverCi].includes(ci))) {
        if (serverFound && !hackedRound) openHack();
        else if (serverFound) {
          showToast(`<div class="wave-num">RELAY PATCHED</div>`
            + `<div class="wave-role">one hack per round — come back next round</div>`, 2200);
        } else if (dungeon.tags[serverCi] === BLOCKED) {
          showToast(`<div class="wave-num">DORMANT RELAY</div>`
            + `<div class="wave-role">beyond the frontier — push the rounds to reach it</div>`, 2600);
        } else {
          showToast(`<div class="wave-num">DORMANT RELAY</div>`
            + `<div class="wave-role">drive the tank closer to wake it</div>`, 2200);
        }
        return;
      }
      if (mobileShell && buildMode && ci !== -1 && !towerByCell.get(ci) && !orderByCell.get(ci)) {
        const why = placeError(ci);
        if (why) { refuseCaption(why); return; }
      }
      if (ci !== -1) openShop(ci, ev.clientX, ev.clientY);
    }
    if (buildPointers.size === 0) { pinched = false; tapStart = null; pressFired = false; }
  }
  addEventListener('pointerup', endBuildPointer);
  addEventListener('pointercancel', endBuildPointer);
  container.addEventListener('pointerdown', (ev) => {
    if (strike.falling <= 0 || strikeGrace > 0) return;
    // Aim is two-fold: the paint chose the area, and ONE burst mid-fall can
    // vector the munition onto what the target drifted into. A tap on the
    // GROUND spends the burst; a tap on the sky — or any tap after it is
    // spent — skips to impact.
    if (strike.retargetsLeft > 0) {
      const ci = cellAtScreen(ev.clientX, ev.clientY);
      if (ci !== -1 && retargetStrike(strike, ci)) {
        sfx.play('tank_secondary');
        strikeFeedInfo();   // TGT CELL changes; the feed should say so
        return;
      }
    }
    skipFall(strike);
  });
  container.addEventListener('wheel', (ev) => {
    if (!buildMode) return;
    buildDist = Math.min(4, Math.max(1.4, buildDist + ev.deltaY * 0.002));
    ev.preventDefault();
  }, { passive: false });
  root.querySelector('#td-pad-fire').addEventListener('click', () => fire());
  {
    // the third pad. A TAP, not a hold: laying is a discrete act and a held
    // mine pad would empty the rack in a second.
    const mb = root.querySelector('#td-pad-mine');
    if (mb) mb.addEventListener('click', () => layMineNow());
    // the fourth pad. Same tap-not-hold rule: a held shield pad would burn
    // the rack into a bubble that was already up, which the module refuses
    // anyway — but refusing four times a second is not feedback.
    const sb = root.querySelector('#td-pad-shield');
    if (sb) sb.addEventListener('click', () => deployShieldNow());
  }

  // --- LAUNCH CONTROL: DeepWatch's console, driving OUR state machine -------
  // The safety toggle arms, the readout narrates, the chunky button goes
  // grey -> orange (needs a target) -> red (authorised). Same ritual, real
  // instrument. armBtn keeps its name: it gates syncArmUi in the loop.
  const armBtn = root.querySelector('#td-launch');
  // NO ORBITAL ASSET ON A RESCUE. Hidden rather than disabled: a dead
  // readout in the middle of the screen is worse than no readout, and this
  // one occupies the exact strip the beacons are read across. `display` and
  // not a class, because syncArmUi owns the class and would put it back.
  if (missionOn && armBtn) armBtn.style.display = 'none';
  const safetyEl = root.querySelector('#td-safety');
  const safetyImg = root.querySelector('#td-safety-img');
  const launchBtn = root.querySelector('#td-launch-btn');
  const launchStatus = root.querySelector('#td-launch-status');
  const launchTarget = root.querySelector('#td-launch-target');
  const launchLatin = root.querySelector('#td-launch-latin');
  function refuseArm() {
    // DeepWatch's flickerOrdnance: the console says no, briefly
    armBtn.classList.remove('flicker');
    void armBtn.offsetWidth;
    armBtn.classList.add('flicker');
  }
  let armUiKey = '';
  const buyMissileEl = root.querySelector('#td-buy-missile');
  if (buyMissileEl) buyMissileEl.addEventListener('click', () => {
    if (!missileShop) return;
    const cost = missileCost();
    if (!eco.spend(cost)) {
      showToast(`<div class="wave-num">INSUFFICIENT FUNDS</div>`
        + `<div class="wave-role">the market wants ${fmt(cost)}kg</div>`, 2000);
      return;
    }
    missilesBought++;
    strike.reserved += 1;
    sfx.play('tank_shells');
    showToast(`<div class="wave-num">MISSILE PURCHASED</div>`
      + `<div class="wave-role">entering the queue — next one costs ${fmt(missileCost())}kg</div>`, 2400);
    updateHud(); syncArmUi();
  });

  function syncArmUi() {
    if (missionOn) return;   // there is no console to sync
    if (buyMissileEl) {
      buyMissileEl.classList.toggle('hidden', !missileShop);
      if (missileShop) buyMissileEl.textContent = `+ ${missileCost()}kg`;
    }
    // narrate the state; write the DOM only when the state actually moves
    const orbit = strike.reserved > 0 ? Math.round(strike.gauge * 100) : -1;
    const reorbit = strike.cooldown > 0 ? Math.round(orbitProgress(strike) * 100) : -1;
    const key = `${strike.armed}|${strike.target}|${strike.ready}|${strike.reserved}|${orbit}|${reorbit}`;
    if (key === armUiKey) return;
    armUiKey = key;
    // the console carries its own armed state, so CSS can decide what a
    // small screen shows: on a phone it is a SWITCH until it is armed, and
    // the readout and the launch key only appear once you have committed
    if (armBtn) armBtn.classList.toggle('armed', strike.armed);
    safetyEl.setAttribute('aria-pressed', String(strike.armed));
    safetyImg.src = strike.armed ? 'assets/ui/switch-on.png' : 'assets/ui/switch-off.png';
    safetyEl.classList.toggle('locked', !strike.armed && (strike.ready <= 0 || strike.cooldown > 0));
    let status, cls = 'status';
    if (strike.armed && strike.target >= 0) { status = 'LAUNCH AUTHORIZED'; cls += ' armed'; }
    else if (strike.armed) { status = 'AWAITING TARGET'; cls += ' armed'; }
    else if (reorbit >= 0) {
      // spent platform repositioning: ready assets exist but must wait
      status = `ENTERING ORBIT ${reorbit}%`;
      cls += ' charging';
    } else if (strike.ready > 0) {
      status = strike.ready > 1 ? `READY ×${strike.ready} · FLIP ON` : 'READY · FLIP TO ON';
      cls += ' ready';
    } else if (strike.reserved > 0) { status = `ORBIT ${orbit}%`; cls += ' charging'; }
    else status = 'STANDBY';
    launchStatus.textContent = status;
    launchStatus.className = cls;
    const locked = strike.target >= 0;
    launchTarget.textContent = locked ? `TGT CELL ${String(strike.target).padStart(4, '0')}` : 'NO TARGET';
    launchTarget.className = locked ? 'target set' : 'target';
    launchBtn.className = 'launch-button' + (strike.armed ? (locked ? ' armed' : ' target') : '');
    launchLatin.textContent = strike.armed && !locked ? 'TARGET' : 'LAUNCH';
  }
  safetyEl.addEventListener('click', () => {
    const r = toggleArm(strike);
    if (r === 'refused') { refuseArm(); return; }
    sfx.play('tank_pickup');   // the click; DeepWatch calls it satisfying
    if (r === 'safe') hideRangeRing();
    armUiKey = ''; syncArmUi();
    resize();   // armed promotes the minimap to a radar; safe demotes it
  });
  launchBtn.addEventListener('click', () => {
    if (strike.armed && strike.target >= 0) {
      const ci = launchStrike(strike, strikeTune);
      if (ci >= 0) {
        strikeGrace = 0.25;   // the launching click must not skip its own cam
        closeShop();          // the camera is about to ride a munition down
        hideRangeRing();
        sfx.play('tank_main');
        showToast('<div class="wave-num">MUNITION RELEASED</div>'
          + '<div class="wave-role">tap to skip to impact</div>', 1400);
      } else refuseArm();
      armUiKey = ''; syncArmUi();
      resize();   // the radar stands down with the safety
      return;
    }
    // orange state: the button itself says what is missing
    refuseArm();
  });

  // The blast itself. Portals inside the radius are not damaged — they are
  // DESTROYED, which is the reason the weapon exists. Enemies take squared
  // falloff. The world does the announcing: rings, a kick of the same shock
  // cloud the wave telegraph uses, and the loudest sample in the manifest.
  function executeStrike(ci, tNow) {
    const before = {
      portals: spawnPoints.filter((q) => q.alive).length,
      enemies: enemies.filter((e) => e.alive).length,
      towers: towers.length,
      walls: dungeon.tags.filter((tg) => tg === BLOCKED).length,
    };
    const c = graph.centers[ci];
    const radius = cellSide * strikeTune.blastCells;
    sfx.play('tank_destroyed', { dist: camDist(c) });
    // Rings tell the TRUTH now: the outermost ring IS the damage radius.
    // The first cut drew them out to 2.2x it, so level-1 fodder stood
    // visibly "inside the blast" and walked away — the visuals were writing
    // a cheque the falloff did not honour.
    warnRing(ci, 0xffffff, 1.0, radius);
    warnRing(ci, 0xffb347, 0.7, radius * 0.72);
    warnRing(ci, 0xfff2c0, 0.45, radius * 0.42);
    // the screen takes the hit too — the sector-reveal flash, borrowed
    flashEl.classList.remove('on');
    void flashEl.offsetWidth;
    flashEl.classList.add('on');
    // the firework: staged dot-burst shells, white core out to ember red,
    // each larger and sparser than the last. One strike per gate means this
    // can afford to be extravagant — it is a set piece, not a particle tax.
    const bn = graph.normals[ci];
    const bp = add3(c, scale3(bn, cellSide * 0.35));
    for (const [hex, sc, cnt] of [
      [0xffffff, 1.5, 140], [0xfff2c0, 2.4, 110],
      [0xffb347, 3.4, 90], [0xff7744, 4.4, 70], [0xff4433, 5.4, 50],
    ]) {
      const burst = makeDotBurst(hex, bn, cnt);
      burst.scale.setScalar(cellSide * sc);
      burst.position.set(bp[0], bp[1], bp[2]);
      scene.add(burst);
      debris.push(burst);
    }
    // Terrain and towers, when the toggles allow. Towers FIRST: a mounted
    // tower anchors its wall (breachWallCell refuses it), so the order is
    // what lets one strike flatten a defended rampart. Walls batch into a
    // single BFS + rebuild — six breaches must not cost six rebuilds.
    // DEEPWATCH is about portals specifically, so it is counted here rather
    // than inferred from the log line below
    strikePortalsBefore = before.portals;
    if (strikeTune.breakTowers) {
      for (const tw of [...towers]) {
        if (dist3(c, graph.centers[tw.ci]) < radius) destroyTower(tw);
      }
    }
    if (strikeTune.breakWalls) {
      let breached = 0;
      for (let ci2 = 0; ci2 < graph.centers.length; ci2++) {
        if (dungeon.tags[ci2] !== BLOCKED) continue;
        if (dist3(c, graph.centers[ci2]) < radius && breachWallCell(ci2)) breached++;
      }
      if (breached > 0) rebuildAfterBreach();
    }
    for (const sp of spawnPoints) {
      if (sp.alive && dist3(c, graph.centers[sp.ci]) < radius) {
        sp.found = true;
        killPortal(sp);
      }
    }
    // THE REPLAY IS RECORDED AT IMPACT, not reconstructed later: every body
    // near the blast, projected onto the tangent plane at ground zero in
    // cells, and whether it was alive after. The debrief plays this back.
    const [rbU, rbV] = tangentBasis(norm3(c));
    const watched = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist3(c, e.pos);
      if (d < radius * 1.9) {
        const rel = sub3(e.pos, c);
        watched.push({ e, x: dot3(rel, rbU) / cellSide, y: dot3(rel, rbV) / cellSide, type: e.type });
      }
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      const dmg = strikeDamage(dist3(c, e.pos), radius, strikeTune);
      if (dmg > 0) damageEnemy(e, tNow, dmg, false, 'strike');
    }
    if (rs) {
      const killedByStrike = before.enemies
        - enemies.reduce((n2, x) => n2 + (x.alive ? 1 : 0), 0);
      if (killedByStrike >= rs.bestStrike.kills) {
        rs.bestStrike = {
          kills: killedByStrike, wave,
          replay: {
            radius: radius / cellSide,
            portals: before.portals - spawnPoints.filter((q) => q.alive).length,
            bodies: watched.map((w) => ({ x: w.x, y: w.y, type: w.type, died: !w.e.alive })),
          },
        };
      }
    }
    updateHud();
    checkVictory();
    // the proof line goes LAST — its first draft sat above the kill loops
    // and reported 2->2 portals on a direct hit: a bug in the REPORTING that
    // read exactly like a bug in the weapon
    console.log(`STRIKE ci=${ci}`
      + ` portals ${before.portals}->${spawnPoints.filter((q) => q.alive).length}`
      + ` enemies ${before.enemies}->${enemies.filter((e) => e.alive).length}`
      + ` towers ${before.towers}->${towers.length}`
      + ` walls ${before.walls}->${dungeon.tags.filter((tg) => tg === BLOCKED).length}`);
    const killed = strikePortalsBefore - spawnPoints.filter((q) => q.alive).length;
    if (killed > 0) { run.strikePortalKills += killed; checkAchievements(); }
  }
  let strikePortalsBefore = 0;

  // ☆ flash the neighbouring cell that is one hop closer to the heart
  let hintTimer = null;
  // non-freezing tutorial callout; flash = big centred, skip = show Skip, hold = no auto-hide
  let tutTimer = null;
  const TUT_BEAT = 4.0;   // seconds of quiet between lessons
  // THE SHELL'S WORDS. The tutorial teaches treads, lasers, shell, throttle,
  // build — in the desktop's vocabulary. On the shell there is no throttle
  // and no key; the same lessons are said in the shell's terms here, at the
  // one place every banner passes through, so the phase machine is untouched.
  // (The operator's first phone screen: "cannot figure out the controls".)
  const SHELL_WORDS = [
    ['RAM THEM · drive straight through them',
      'RAM THEM · TAP THE GROUND beyond them, or DRAG on the left half to drive — through them'],
    ['hold to sweep them with the lasers', 'hold &#8767; (bottom right) to sweep them with the plasma'],
    ['Build Towers — tap any HIGH GROUND cell, from any camera. ',
      'BUILD · tap the BUILD button, then any HIGH GROUND cell. Hold a tower to upgrade. '],
  ];
  function shellWords(html) {
    if (!mobileShell) return html;
    if (html.startsWith('THROTTLE ·')) {
      return 'TAP TO GO · tap where you want the tank and it drives itself; DRAG on the left half to take the wheel.';
    }
    for (const [a, b] of SHELL_WORDS) html = html.replace(a, b);
    return html;
  }
  function tutBanner(html, opts = {}) {
    html = shellWords(html);
    tutEl.className = opts.flash ? 'tut-flash' : '';
    tutEl.innerHTML = html + (opts.skip
      ? '<div><button class="tut-skip">skip tutorial</button></div>' : '');
    tutEl.classList.remove('hidden');
    const sk = tutEl.querySelector('.tut-skip');
    if (sk) sk.addEventListener('click', skipTutorial);
    clearTimeout(tutTimer);
    if (!opts.hold) tutTimer = setTimeout(() => tutEl.classList.add('hidden'), 4500);
  }
  function hideTutBanner() { clearTimeout(tutTimer); tutEl.classList.add('hidden'); }
  // pulse ONE hud button; pass null to clear all pulses
  let pulsedBtn = null;
  function pulseButton(sel) {
    if (pulsedBtn) pulsedBtn.classList.remove('tutorial-pulse');
    // the shell has no throttle to pulse; its BUILD lesson pulses the switch
    if (mobileShell && sel === '#td-throttle') sel = null;
    if (mobileShell && sel === '#td-pad-map') sel = '#mob-mode';
    pulsedBtn = sel ? root.querySelector(sel) : null;
    if (pulsedBtn) pulsedBtn.classList.add('tutorial-pulse');
  }
  const safeSeen = () => { try { return localStorage.getItem('td.tutorialSeen'); } catch (e) { return null; } };

  // Scripted onboarding. A linear phase machine driven from animate() while
  // tutorialActive. Phase bodies land in later tasks; this is the frame.
  const tutorial = {
    phase: 'setup',
    portal: null,   // the scripted spawn point
    fodder: [],     // the 3 scripted enemies
    tShown: 0,
    frozen: false,
    frozenT: 0,
    setup() {
      // wipe any seeded neutral gates so the tutorial has exactly its one
      // scripted portal (the plan-driven wave engine seeds these at run-start;
      // the tutorial overrides with a hand-scripted phage portal instead)
      for (const sp of spawnPoints) {
        scene.remove(sp.obj); disposeObj(sp.obj);
        if (sp.mapMarker) { scene.remove(sp.mapMarker); disposeObj(sp.mapMarker); }
      }
      spawnPoints.length = 0;
      // player starts very close to the heart (distToHeart 1..2)
      let startCi = dungeon.heart;
      for (let d = 1; d <= 2 && startCi === dungeon.heart; d++) {
        for (let i = 0; i < dungeon.tags.length; i++) {
          if (dungeon.tags[i] !== BLOCKED && dungeon.distToHeart[i] === d) { startCi = i; break; }
        }
      }
      player.cur = startCi;
      player.prev = -1;
      player.pos = graph.centers[startCi].slice();
      player.visited = new Set([startCi]);
      const exits = openNeighbors(startCi);
      let e0 = exits[0] ?? startCi;
      for (const e of exits) {
        if (dungeon.distToHeart[e] === dungeon.distToHeart[startCi] - 1) { e0 = e; break; }
      }
      player.heading = tangentDirTo(startCi, e0);
      player.travelDir = player.heading.slice();
      player.smoothDir = player.travelDir.slice();
      player.next = e0;
      player.prog = 0;
      player.segLen = Math.max(1e-9, dist3(graph.centers[startCi], graph.centers[player.next]));

      ammo = 0; updateHud();
      clearOrbs();

      // portal 20–30 hops DOWN THE HALL from the heart (target 25); the
      // fodder march back toward the heart and the player intercepts.
      let portalCi = startCi, bestBand = Infinity, farCi = startCi, farD = -1;
      for (let i = 0; i < dungeon.tags.length; i++) {
        if (dungeon.tags[i] === BLOCKED) continue;
        const d = dungeon.distToHeart[i];
        if (d < 0) continue;
        if (d > farD) { farD = d; farCi = i; }
        if (d >= 20 && d <= 30) {
          const off = Math.abs(d - 25);
          if (off < bestBand) { bestBand = off; portalCi = i; }
        }
      }
      if (bestBand === Infinity) portalCi = farCi; // small map: use the farthest cell
      const obj = buildPortalObj(portalCi, whim() * 6.283);
      scene.add(obj);
      const mm = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10),
        new THREE.MeshBasicMaterial({ color: CREATURE_TINTS.phage }));
      const mmp = scale3(graph.centers[portalCi], 1 + params.wallHeight * 1.6);
      mm.position.set(mmp[0], mmp[1], mmp[2]);
      mm.visible = true; mm.layers.set(MAP_LAYER); scene.add(mm);
      this.portal = { type: 'phage', ci: portalCi, hp: 3, obj, alive: true, found: true, mapMarker: mm };
      spawnPoints.push(this.portal);
      recomputePortalDist();
      wave = 1; // the scripted wave counts as wave 1, so the BUILD-phase
                // spawnWave() (task 5) introduces the wave-2 enemy type

      // The first pair comes in FAR down the lane. They walk to you, and the
      // walk is the lesson: a pair arriving at arm's length teaches nothing
      // but panic, while eight hops of empty corridor is long enough to look
      // around, find the throttle and decide what to do about them.
      this.startCi = startCi;
      this.fodder = [];
      this.spawnFodder(2, 7, 11);
      this.frozen = true; this.frozenT = 0;
      this.gapT = 0; this.pending = null;
      tutBanner('RAM THEM · drive straight through them', { flash: true, hold: true, skip: !!safeSeen() });
      pulseButton('#td-throttle');
      this.tShown = 0; this.phase = 'ram';
    },

    // A pair of phage in the lane ahead, `dMin`..`dMax` hops FURTHER from the
    // heart than the player — so they march back down the corridor toward
    // both the player and the thing being defended.
    spawnFodder(count, dMin, dMax) {
      const spec = ENEMY_SPEC.phage;
      const sd = dungeon.distToHeart[this.startCi];
      const ahead = [];
      for (let pass = 0; pass < 2 && ahead.length < count; pass++) {
        // second pass widens the band: a small board may not have cells at
        // the preferred distance at all, and an empty wave stalls the phase
        const lo = sd + (pass ? Math.max(2, dMin - 4) : dMin);
        const hi = sd + (pass ? dMax + 8 : dMax);
        for (let i = 0; i < dungeon.tags.length && ahead.length < count; i++) {
          if (dungeon.tags[i] === BLOCKED || ahead.includes(i)) continue;
          const d = dungeon.distToHeart[i];
          if (d >= lo && d <= hi) ahead.push(i);
        }
      }
      while (ahead.length < count) ahead.push(this.portal ? this.portal.ci : this.startCi);
      const made = [];
      for (let k = 0; k < count; k++) {
        const ci = ahead[k];
        const eObj = makeDotEnemy('phage', { walker: CREATURE_TINTS.phage, walkerHi: accentFor('phage') });
        const size = spec.size * 0.7; const scale0 = cellSide * size;
        eObj.scale.setScalar(scale0); eObj.userData.s0 = scale0; scene.add(eObj);
        const nx = openNeighbors(ci);
        const e = {
          type: 'phage', spec, scale0, size,
          cur: ci, prev: -1,
          next: nx.length ? nx[Math.floor(whim() * nx.length)] : ci,
          prog: whim() * 0.4, pos: graph.centers[ci].slice(), dir: [0, 1, 0],
          obj: eObj, alive: true, phase: whim() * 6.283,
          hp: spec.hp, behMult: 1, behUntil: -1, touchCd: -1, slowFactor: 1, slowUntil: -1,
        };
        enemies.push(e); this.fodder.push(e); made.push(e);
      }
      return made;
    },
    // a phase is cleared when every enemy it spawned is down
    fodderClear() { return this.fodder.every((e) => !e.alive); },

    // A BEAT between lessons. Clearing a pair used to hand out the next
    // instruction and the next pair in the same frame, so three lessons went
    // by in the time it takes to read one — no pause to look at the HUD, no
    // moment to notice which control had just lit up. Now the kill lands, a
    // short confirmation says what you just used, and the field stays empty
    // for a few seconds before the next instruction arrives.
    beat(confirm, fn) {
      tutBanner(confirm, { hold: true });
      pulseButton(null);
      this.pending = fn;
      this.gapT = TUT_BEAT;
    },
    // One weapon per pair, in order of how much they cost you: the treads are
    // free, the lasers are free but need aim, the shell is scarce and heats
    // the barrel for three seconds. Two enemies each, so the lesson is a
    // rehearsal rather than a fight — the player is never learning a control
    // and losing at the same time.
    tick(dt) {
      // the opening hold is longer than a banner's read time on purpose: it
      // is also the first look at the board
      if (this.frozen) { this.frozenT += dt; if (this.frozenT > 5.5) { this.frozen = false; } return; }

      // a beat is running: nothing spawns, nothing is asked of the player
      if (this.gapT > 0) {
        this.gapT -= dt;
        if (this.gapT <= 0 && this.pending) {
          const go = this.pending; this.pending = null; go();
        }
        return;
      }

      if (this.phase === 'ram') {
        if (this.fodderClear()) {
          this.phase = 'laser';
          this.beat('Treads done — ramming is free, and it is always available.', () => {
            this.spawnFodder(2, 5, 8);
            tutBanner('Now the SECONDARIES · hold to sweep them with the lasers',
              { hold: true, skip: !!safeSeen() });
            pulseButton('#td-pad-laser');
          });
        }
      } else if (this.phase === 'laser') {
        if (this.fodderClear()) {
          // Shells are scarce, so the lesson hands you some rather than
          // hoping you find a pickup: a tutorial step you can fail to even
          // ATTEMPT is not a tutorial step. Orbs go down beside you as well,
          // because where shells come from is the other half of the lesson.
          this.phase = 'shell';
          this.beat('Lasers done — free to fire, but they need you pointed at it.', () => {
            // Shells are scarce, so the lesson hands you some rather than
            // hoping you find a pickup: a step you can fail to even ATTEMPT
            // is not a step. Orbs go down beside you too, because where
            // shells come from is the other half of the lesson.
            ammo = Math.max(ammo, 3); updateHud();
            const near = openNeighbors(player.cur).slice(0, 2);
            for (const ci of (near.length ? near : [player.cur])) spawnOrbAt(ci);
            this.spawnFodder(2, 5, 8);
            tutBanner('And the SHELL · overkill on these two, but it is how you '
              + 'breach a wall. Shells come from the glowing pickups — you have 3.',
              { hold: true, skip: !!safeSeen() });
            pulseButton('#td-pad-fire');
          });
        }
      } else if (this.phase === 'shell') {
        if (this.fodderClear()) {
          this.collapsePortal();   // clear the field: the next beat has no enemies
          this.phase = 'speed';
          this.beat('Shell done. That is the whole kit: treads, lasers, shell.', () => {
            tutBanner('THROTTLE · drag to set your speed, flick up for full. '
              + 'Below zero reverses — slower than forward, same lever.',
              { hold: true, skip: !!safeSeen() });
            pulseButton('#td-throttle');
            this.speedT = 0;
            this.speedFrom = throttle;
          });
        }
      } else if (this.phase === 'speed') {
        // Advance on USE, not on a timer — the point is that they touch it.
        // The timer is only there so a player who will not is not stranded.
        this.speedT += dt;
        // on the shell this lesson is TAP TO GO (shellWords): passed by a
        // destination accepted, not by a throttle that is not on screen
        if (Math.abs(throttle - this.speedFrom) > 0.15 || this.speedT > 16
            || (mobileShell && gotoCi >= 0)) {
          hideTutBanner();
          this.startBuild();
        }
      } else if (this.phase === 'build' || this.phase === 'done') {
        this.tickBuild(dt);
      }
    },

    // The scripted gate has done its job once the three pairs are down. It
    // collapses rather than being shot: destroying it was the old shell
    // lesson, and that lesson now lives on the enemies instead.
    collapsePortal() {
      const p = this.portal;
      if (!p || !p.alive) return;
      p.alive = false;
      scene.remove(p.obj); disposeObj(p.obj);
      if (p.mapMarker) { scene.remove(p.mapMarker); disposeObj(p.mapMarker); }
      const idx = spawnPoints.indexOf(p);
      if (idx >= 0) spawnPoints.splice(idx, 1);
      recomputePortalDist();
    },
    startBuild() {
      this.phase = 'build';
      // the wave engine spawns only from LIVE gates and no longer self-seeds
      // one per wave — the scripted gate is dead by now, so raise a fresh gate
      // before the 2nd wave or the field is empty and checkVictory false-fires
      seedPortals(1);
      spawnWave(); // a real 2nd wave: fresh gate + normal enemies (war is live)
      tutBanner('Build Towers — tap any HIGH GROUND cell, from any camera. '
        + 'The flashing cells are legal.', { skip: !!safeSeen() });
      // no button to pulse: building stopped being a mode. The orbit view is
      // just the best vantage for the lesson, so swing there.
      setView('orbit');
      snapCamera();
      pulseButton(null);
      this.animateLegalSpots();
    },
    animateLegalSpots() {
      const legal = [];
      for (let ci = 0; ci < dungeon.tags.length; ci++) {
        if (!placeError(ci)) legal.push(ci);
      }
      // pulse a bounded set near the player so it reads on a small planet
      legal.sort((a, b) =>
        dist3(graph.centers[a], player.pos) - dist3(graph.centers[b], player.pos));
      const show = legal.slice(0, 24);
      let pulses = 0;
      const beat = () => {
        const on = pulses % 2 === 0;
        for (const ci of show) paintCell(ci, on ? look().floors.hintFlash : floorColorOf(ci));
        pulses++;
        if (pulses < 6) setTimeout(beat, 420);
        else for (const ci of show) paintCell(ci, floorColorOf(ci));
      };
      beat();
    },
    tickBuild() {
      // handoff on the first tower built OR when wave-2 enemies are cleared
      if (this.phase !== 'build') return;
      if (towerByCell.size > 0
        || (spawnPoints.every((s) => !s.alive) && enemies.every((e) => !e.alive))) {
        this.phase = 'done';
        hideTutBanner();
        pulseButton(null);
        endTutorial(); // normal wave clock + orbs resume, heart guard lifts
        // THE HANDOFF HANDS BACK DRIVE. The build phase put the camera in
        // orbit and nothing ever took it out: on the shell, where orbit IS
        // the build eye, a fresh player finished the tutorial parked high
        // over the board with BUILD lit (operator's phone, 2026-09-04:
        // "the camera starts too high, third person does not work for
        // drive"). The desktop keeps its post-build framing.
        if (mobileShell && urlParams.get('handoff') !== '0') setView('third');   // ?handoff=0 — the negative control
      }
    },
    teardown() { pulseButton(null); hideTutBanner(); },
  };

  function startTutorial() {
    // THE CAMPAIGN'S TUTORIAL TEACHES THE CAMPAIGN — towers, build mode, the
    // gates. Every sentence of it is false on a mission, and it would be the
    // FIRST thing an operator opening ?mission=rescue on a cold browser saw.
    if (missionOn) return;
    tutorialActive = true;
    root.classList.add('tutoring');
    tutorial.phase = 'setup';
    tutorial.setup();
  }
  function endTutorial() {
    tutorialActive = false;
    // a tutorial COMPLETED on the shell taught the shell; a skipped one did not
    if (mobileShell && !tutorial.skipped) coachFinish();
    root.classList.remove('tutoring');
    waveActive = enemies.some((e) => e.alive); waveAge = 0; interClock = 0;
    tutorial.teardown();
    if (orbMeshes.size === 0) spawnOrbs(); // restore the normal shell field
    try { localStorage.setItem('td.tutorialSeen', '1'); } catch (e) { /* private mode */ }
  }
  function skipTutorial() {
    tutorial.skipped = true;
    // tear down tutorial-only entities, then hand to a clean normal round
    for (const e of tutorial.fodder) { if (e.alive) { e.alive = false; scene.remove(e.obj); } }
    if (tutorial.portal && tutorial.portal.alive) {
      tutorial.portal.alive = false;
      scene.remove(tutorial.portal.obj);
      const idx = spawnPoints.indexOf(tutorial.portal);
      if (idx >= 0) spawnPoints.splice(idx, 1);
    }
    clearOrbs();
    endTutorial();
    regenerate(); // fresh normal game
  }
  function maybeStartTutorial() {
    if (runTutorial) startTutorial();
  }

  function pulseHint() {
    const d = dungeon.distToHeart;
    let next = -1;
    for (const nb of openNeighbors(player.cur)) {
      if (d[nb] === d[player.cur] - 1) { next = nb; break; }
    }
    if (next === -1) return;
    paintCell(next, look().floors.hintFlash);
    clearTimeout(hintTimer);
    const cell = next;
    hintTimer = setTimeout(() => paintCell(cell, floorColorOf(cell)), 900);
  }

  // --- HUD -----------------------------------------------------------------
  const statsEl = root.querySelector('#td-stats');
  statsEl.classList.add('hud-panel'); // the TD tab dresses the shared slot
  const dirBtnEl = root.querySelector('#td-pad-dir');
  const msgEl = root.querySelector('#td-msg');
  // The shell's ONE big control (ruling 3): DRIVE <-> BUILD, and the view
  // follows the mode. Build mode IS the orbit view (setView owns buildMode),
  // so this is the desktop's own third<->orbit toggle. The phase-2 cut called
  // a `toggleBuild` that never existed — the probe drove the tank and never
  // tapped the button, so a ReferenceError shipped. Now the probe taps it.
  const mobModeEl = root.querySelector('#mob-mode');
  let mobModeLast = -1;
  let viewOverride = false;   // ?view= asked for a view by name: the shell's two-view rule stands aside
  // DRIVE is also the reset button (operator: "maybe we add a reset
  // button"): the mode button names its destination rather than toggling
  // whatever the view was, and DRIVE ends any shot and snaps the camera
  if (mobModeEl) mobModeEl.addEventListener('click', () => {
    if (buildMode) { endShot(); setView('third'); snapCamera(); } else setView('orbit');
    syncMobMode();
  });
  // SCREEN WAKE LOCK (plan §2.8). A phone dims and sleeps on a screen that is
  // not being touched, and a wave that is going well is exactly that. Shell
  // only; re-requested when the tab comes back, because hiding releases it.
  let wakeLock = null;
  async function holdWake() {
    if (!mobileShell || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    if (wakeLock && !wakeLock.released) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') holdWake(); });
  root.addEventListener('pointerdown', () => holdWake(), { once: true });
  holdWake();
  // THE COACH. The tutorial runs once per browser and teaches the game; a
  // phone that has already seen it (the operator's) boots straight into a
  // wave with nothing on screen saying how to move — tap-to-go is invisible
  // until someone has done it. Three coach marks, shell only, once per
  // browser, each holding until the thing it names has happened:
  //   1. TAP THE GROUND        until a destination is accepted
  //   2. the thumbs            until a thumb is pressed (or 12s)
  //   3. BUILD                 when a tower is affordable, until one is ordered
  // Not the tutorial: it never spawns anything and never freezes the game.
  const COACH_KEY = 'td.shellCoachSeen';
  const coach = {
    step: 0, t: 0, pulseT: 0, shown: false, fired: false, ordersAt: 0,
    done: (() => { try { return !!localStorage.getItem(COACH_KEY); } catch { return false; } })(),
  };
  function coachFinish() {
    if (coach.done) return;
    coach.done = true;
    pulseButton(null);
    hideTutBanner();
    try { localStorage.setItem(COACH_KEY, '1'); } catch { /* private mode */ }
  }
  // a cell three hops out, away from the Heart: the direction the game is in
  function coachTarget() {
    const d0 = bfsDist(graph.adj, [player.cur], (i) => dungeon.tags[i] !== BLOCKED);
    let best = -1, bestH = -1;
    for (let i = 0; i < d0.length; i++) {
      if (d0[i] === 3 && dungeon.distToHeart[i] > bestH) { bestH = dungeon.distToHeart[i]; best = i; }
    }
    return best;
  }
  function coachTick(dt) {
    if (!mobileShell || coach.done || tutorialActive || paused || !graph) return;
    if (introEl && !introEl.classList.contains('hidden')) return;
    coach.t += dt;
    if (coach.step === 0) {
      if (!coach.shown) { coach.shown = true; tutBanner('TAP THE GROUND &middot; the tank drives there &middot; or DRAG on the left to drive it yourself', { hold: true }); }
      coach.pulseT -= dt;
      if (coach.pulseT <= 0) {
        coach.pulseT = 1.2;
        const c = coachTarget();
        if (c >= 0) { paintCell(c, look().floors.hintFlash); setTimeout(() => paintCell(c, floorColorOf(c)), 700); }
      }
      if (gotoCi >= 0 || stick || coach.t > 45) { coach.step = 1; coach.t = 0; coach.shown = false; }
    } else if (coach.step === 1) {
      if (!coach.shown) {
        coach.shown = true;
        tutBanner('&#9673; SHELL &middot; &#8767; PLASMA &middot; the thumbs, bottom right', { hold: true });
        pulseButton('#td-pad-fire');
      }
      if (coach.fired || coach.t > 12) {
        coach.step = 2; coach.t = 0; coach.shown = false;
        pulseButton(null); hideTutBanner(); coach.ordersAt = orders.length;
      }
    } else if (coach.step === 2) {
      if (!coach.shown) {
        const keys = unlockedTowerKeys(wave, hackedUnlocks);
        const cheapest = keys.length ? Math.min(...keys.map((k) => TOWER_BY_KEY[k].cost)) : Infinity;
        if (eco.biomass < cheapest || buildMode) return;
        coach.shown = true; coach.t = 0;
        tutBanner('BUILD &middot; tap the button, then HIGH GROUND &middot; hold a tower to upgrade', { hold: true });
        pulseButton('#mob-mode');
        return;
      }
      if (orders.length > coach.ordersAt || coach.t > 60) coachFinish();
    }
  }
  for (const sel of ['#td-pad-fire', '#td-pad-laser']) {
    const el = root.querySelector(sel);
    if (el) el.addEventListener('pointerdown', () => { coach.fired = true; }, { once: true });
  }
  // THE STICK (src/stick.js; operator, 2026-09-03: "I cannot find a way to
  // move the tank manually anymore"). Shell, DRIVE mode, left half of the
  // board, not on a control: a finger down puts the ring there, a drag
  // drives — throttle up/down, steer past the band — and a finger that
  // never left the dead zone was a tap, which the tap handlers still get.
  // Release stops the tank (throttle 0, keys off); a stick is held.
  const stickEl = root.querySelector('#td-stick');
  const stickKnob = stickEl && stickEl.querySelector('.stick-knob');
  let stick = null;   // { id, x, y }
  function stickApply(dx, dy) {
    const v = stickVector(dx, dy, STICK);
    if (!v.active) return false;
    throttle = v.throttle; cruise = false;
    keys.left = v.left; keys.right = v.right;
    keys.fast = false; keys.slow = false;
    paintThrottle();
    if (stickKnob) { const [kx, ky] = knobOffset(dx, dy, STICK); stickKnob.style.transform = `translate(${kx}px, ${ky}px)`; }
    return true;
  }
  function stickEnd() {
    if (!stick) return;
    stick = null;
    throttle = 0; keys.left = false; keys.right = false;
    paintThrottle();
    if (stickEl) stickEl.classList.add('hidden');
  }
  if (stickEl) {
    container.addEventListener('pointerdown', (ev) => {
      if (!mobileShell || buildMode || stick || ev.pointerType === 'mouse' && ev.button !== 0) return;
      if (ev.clientX > innerWidth * 0.5) return;                 // the right half is the thumbs' side
      if (ev.target && ev.target.closest && ev.target.closest('button, .tzone, #td-launch, #td-shop, .minimap')) return;
      stick = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: false };
      stickEl.style.left = `${ev.clientX}px`; stickEl.style.top = `${ev.clientY}px`;
      if (stickKnob) stickKnob.style.transform = 'translate(0,0)';
      stickEl.classList.remove('hidden');
    }, true);
    addEventListener('pointermove', (ev) => {
      if (!stick || ev.pointerId !== stick.id) return;
      if (stickApply(ev.clientX - stick.x, ev.clientY - stick.y)) { stick.moved = true; if (gotoCi >= 0) stopGoto(); }
    });
    for (const evt of ['pointerup', 'pointercancel']) addEventListener(evt, (ev) => { if (stick && ev.pointerId === stick.id) stickEnd(); });
  }
  function syncMobMode() {
    if (!mobModeEl) return;
    mobModeEl.textContent = buildMode ? 'DRIVE' : 'BUILD';
    document.body.classList.toggle('mob-build', !!buildMode);
  }
  // the modal's buttons (event delegation survives innerHTML swaps)
  msgEl.addEventListener('click', (ev) => {
    const cl = ev.target.classList;
    if (!cl) return;
    if (cl.contains('msg-regen')) regenerate(); // retry the CURRENT round
    else if (cl.contains('msg-planet')) {
      if (coins() <= 0) return;             // the button is disabled, but be sure
      setCoins(coins() - 1);                // the coin goes in the slot
      params.newPlanet();                   // a DIFFERENT, bigger world
    }
    else if (cl.contains('msg-buyhull')) {
      if (playerHP < PLAYER_MAX && spendDebrief(SINK.hull)) {
        playerHP++; syncLifeContainers(); updateHud(); renderVerdict(false);
      }
    }
    else if (cl.contains('msg-buydrone')) {
      if (!assistant && spendDebrief(SINK.drone)) { spawnAssistant().then(() => renderVerdict(false)); }
    }
    else if (cl.contains('msg-buystrike')) {
      if (spendDebrief(SINK.strike)) { strike.reserved += 1; syncArmUi(); renderVerdict(false); }
    }
    else if (cl.contains('msg-buymines')) {
      if (mineField.count < mineTune.cap && spendDebrief(SINK.mines)) {
        restock(mineField, mineTune.caseSize, mineTune);
        updateHud(); renderVerdict(false);
      }
    }
    else if (cl.contains('msg-buyshields')) {
      if (shield.rack < shieldTune.rackCap && spendDebrief(SINK.shields)) {
        restockShield(shield, shieldTune.caseSize, shieldTune);
        updateHud(); renderVerdict(false);
      }
    }
    else if (cl.contains('msg-next')) {
      breachNextSector();
    }
    else if (cl.contains('msg-lap')) startLap();
    else if (cl.contains('msg-proceed')) renderVerdict(ev.target.dataset.final === '1');
    else if (cl.contains('msg-begin')) {
      paused = false; msgEl.classList.add('hidden');
      showBrief('arrival');   // where you are, said once you are actually there
    }
    else if (cl.contains('msg-glenemy')) showEnemyGlossary();
    else if (cl.contains('msg-glachv')) showRecord();
    else if (cl.contains('msg-glfriend')) showFriendGlossary();
    else if (cl.contains('msg-back')) showBriefing();
  });

  // card icons are the ACTUAL half-dotted representations: build the real
  // object, render one frame through the sprite rig, snapshot to a data
  // URL, dispose. Cached by key — each icon is rendered once per session.
  const spriteCache = new Map();
  function spriteShot(key, build) {
    if (spriteCache.has(key)) return spriteCache.get(key);
    const obj = build();
    const kind = obj.userData.kind;
    if (kind === 'cloud' || kind === 'orb' || kind === 'portal' || kind === 'triad' || kind === 'heart') {
      obj.position.y = 0.32; // clouds center on the origin; lift into frame
    }
    if (obj.userData.tick) obj.userData.tick(1.3); // a lively mid-anim pose
    obj.rotation.y += 0.6; // three-quarter view
    waveScene.add(obj);
    waveSpriteRenderer.render(waveScene, waveCam);
    const url = waveSpriteRenderer.domElement.toDataURL();
    waveScene.remove(obj);
    disposeObj(obj);
    spriteCache.set(key, url);
    return url;
  }

  // mini bullet triad, briefing-icon edition
  function makeTriadIcon() {
    const g = new THREE.Group();
    for (let k = -1; k <= 1; k++) {
      const b = makeShellSolid({ body: 0xffb000, hi: 0xffffff });
      b.scale.setScalar(0.19);
      b.position.set(k * 0.52, 0, 0);
      g.add(b);
    }
    g.userData.kind = 'triad';
    return g;
  }

  // the briefing card draws whatever is ACTUALLY at the pole, so the picture
  // can never disagree with the board — the same rule the hostiles glossary
  // follows by generating itself from ENEMY_SPEC
  const heartIcon = () => {
    const h = heartLook().make()
      || makeHeartCloud(new THREE.Color(look().heart).getHex());
    h.userData.kind = 'heart';
    if (h.userData.tick) h.userData.tick(1.2);
    return h;
  };
  const unitIcon = (type, tint) => () => buildCreature(type, { walker: tint, walkerHi: 0xffffff });

  // one element = one little card: real sprite · name · what it does
  const glossCard = (color, iconUrl, name, desc) =>
    `<div class="gcard"><img class="gicon" src="${iconUrl}" alt="">` +
    `<div class="gname" style="color:${color}">${name}</div>` +
    `<div class="gdesc">${desc}</div></div>`;

  // the how-to, in ONE place: shown at the beginning and while paused —
  // never on the live HUD
  const GAMEPLAY_TIPS =
    `<div class="tips-head">gameplay</div>` +
    `<div class="tips">` +
    `drive: drag the throttle · flick up for full · below zero reverses<br>` +
    `steer: the side zones · fire: &#9673; shell · &#8767; laser (overheats)<br>` +
    `B = build/tank · M = map view · in BUILD tap HIGH GROUND to place towers<br>` +
    `ESC pause · RAM the small ones · shells breach walls</div>`;

  // The field manual: one laconic CRT screen shown BEFORE the tutorial on a
  // clean load. Dismiss by tap or any key; whatever was queued (tutorial or
  // briefing) runs after. The sim is frozen while it is up.
  const introEl = root.querySelector('#td-intro');
  // THE FIELD MANUAL IS A BRIEFING, so on a mission it must brief THAT
  // mission. Every line of the campaign's manual — protect the heart, grab
  // triads, destroy all portals, build on the high ground — is false here,
  // and it is the first thing anyone opening `?mission=rescue` on a cold
  // browser reads. Same frame, same keys block, different sheet of paper.
  if (missionOn && introEl) {
    const head = introEl.querySelector('.fm-head');
    const body = introEl.querySelector('.fm-body');
    if (head) head.innerHTML = `&#9626; MISSION BRIEF &middot; ${rescue2On ? 'RAID' : 'RESCUE'}`;
    if (body && rescue2On) {
      const keys = body.querySelector('.fm-keys');
      body.innerHTML =
        `<div class="fm-line"><b>${rescue2Tune.camps} CAMPS</b> &mdash; a container in a clearing, astronauts hiding inside</div>`
        + `<div class="fm-line">a big group of soft enemies is standing around each one</div>`
        + `<div class="fm-line">RAM them &mdash; free, unlimited, and what they are there for</div>`
        + `<div class="fm-line fm-warn">&#9888; DO NOT RAM units with SOLID elements &mdash; shells and mines only</div>`
        + `<div class="fm-line">get close and the container <b>OPENS</b>. They walk out to you.</div>`
        + `<div class="fm-line fm-warn">&#9888; <b>STAND STILL.</b> A moving hull runs them over, and the red stays on the floor</div>`
        + `<div class="fm-line">reaching the tank is a save. There is no drive home.</div>`
        + `<div class="fm-line"><b>NO RESUPPLY.</b> ${rescue2Tune.hulls} hulls &middot; ${rescue2Tune.shells} shells`
        + ` &middot; ${rescue2Tune.mines} mines${rescue2Tune.lasers ? '' : ' &middot; no secondaries'}</div>`
        + `<div class="fm-line">no towers, no orbital, no waves &mdash; the whole map is open, take your time</div>`;
      if (keys) {
        keys.innerHTML = '<span>W A S D / arrows</span><span>drive</span>'
          + `<span>SPACE</span><span>shell &mdash; you have ${rescue2Tune.shells}</span>`
          + '<span>N</span><span>lay a MINE one cell ahead</span>'
          + '<span>T</span><span>deploy a SHIELD (10s) &mdash; hard cores bounce off</span>'
          + '<span>Q / E</span><span>cruise up / down</span>'
          + '<span>1 / 2 / 3</span><span>orbit &middot; 1st &middot; 3rd</span>'
          + '<span>M / V</span><span>map / cycle view</span>'
          + '<span>H / ESC</span><span>hint / pause</span>';
        body.appendChild(keys);
      }
    } else if (body) {
      // the keys block is rebuilt too, not reused: it still offered SHIFT for
      // lasers that are not fitted and U to upgrade towers that cannot be
      // built, and a control legend that lists controls you do not have is
      // the same lie as the manual it sits under
      const keys = body.querySelector('.fm-keys');
      if (keys) {
        keys.innerHTML = '<span>W A S D / arrows</span><span>drive</span>'
          + '<span>SPACE</span><span>shell &mdash; you have ' + rescueTune.shells + '</span>'
          + (rescueTune.lasers ? '<span>SHIFT</span><span>lasers</span>' : '')
          + '<span>N</span><span>lay a MINE one cell ahead</span>'
          + '<span>T</span><span>deploy a SHIELD (10s) &mdash; hard cores bounce off</span>'
          + '<span>Q / E</span><span>cruise up / down</span>'
          + '<span>1 / 2 / 3</span><span>orbit &middot; 1st &middot; 3rd</span>'
          + '<span>M / V</span><span>map / cycle view</span>'
          + '<span>H / ESC</span><span>hint / pause</span>';
      }
      body.innerHTML =
        `<div class="fm-line"><b>${rescueTune.survivors} STRANDED</b> &mdash; orange beacons, out along the lanes</div>`
        + `<div class="fm-line">drive to one and <b>STOP</b> &mdash; a second parked, and they board</div>`
        + `<div class="fm-line">the hull seats <b>${rescueTune.seats}</b> &middot; deliver them at the St&aring;lheart</div>`
        + `<div class="fm-line fm-warn">&#9888; lose the hull with someone aboard and they go with it</div>`
        + `<div class="fm-line">something reaching a beacon <b>GRABS</b> them &mdash; kill it and they get up</div>`
        + `<div class="fm-line">RAM the soft ones &middot; free, and there are a lot of them</div>`
        + `<div class="fm-line fm-warn">&#9888; DO NOT RAM units with SOLID elements &mdash; shells and mines only</div>`
        + `<div class="fm-line"><b>NO RESUPPLY.</b> ${rescueTune.hulls} hulls &middot; ${rescueTune.shells} shells`
        + ` &middot; ${rescueTune.mines} mines${rescueTune.lasers ? '' : ' &middot; no secondaries'}</div>`
        + `<div class="fm-line">no towers, no orbital, no Terraformer &mdash; that is the whole budget</div>`
        + `<div class="fm-line">the gates keep sending. Taking your time IS the way to lose</div>`;
      if (keys) body.appendChild(keys);
    }
  }
  let introAfter = null;
  function dismissIntro() {
    if (!introEl || introEl.classList.contains('hidden')) return;
    introEl.classList.add('hidden');
    removeEventListener('keydown', introKey, true);
    paused = false;
    const after = introAfter; introAfter = null;
    if (after) after();
  }
  function introKey(ev) {
    ev.preventDefault();
    ev.stopImmediatePropagation(); // ESC must dismiss, not open the pause menu
    dismissIntro();
  }
  function showIntro(after) {
    if (!introEl) { if (after) after(); return; }
    introAfter = after || null;
    paused = true;
    introEl.classList.remove('hidden');
    introEl.addEventListener('pointerdown', dismissIntro, { once: true });
    addEventListener('keydown', introKey, true);
  }

  // opening briefing: the pieces as cards, the ONE win condition, and two
  // clickable glossaries. The sim stays frozen until the player begins.
  function showBriefing() {
    paused = true;
    // ?autoplay=1 — the replica presses BEGIN itself, 1.5 s after the card
    if (urlParams.get('autoplay') === '1') setTimeout(() => { const b = msgEl.querySelector('.msg-begin'); if (b) b.click(); }, 1500);
    msgEl.innerHTML = `<div class="msg-head">transmission · briefing</div>` +
      `<div class="msg-scroll">` +
      `<div class="gcards">` +
      glossCard('#ff6a88', spriteShot('heart', heartIcon), 'the stalheart', 'the terraformer at the pole — without it the colony dies') +
      glossCard('#9fdcff', spriteShot('tank', unitIcon('tank', look().walker)), 'your tank', mobileShell
        ? 'TAP the ground to send it · DRAG on the left to drive · ◉ shell · ∿ plasma · BUILD switch top-right · hold a tower to upgrade'
        : 'W/Q-E drive · A/D steer · SPACE shell · SHIFT lasers · 1/2/3 views · U upgrade · ESC pause') +
      glossCard('#9fdcff', spriteShot('tower-' + params.towerLook, () => buildTowerLook(params.towerLook, starterTower())), 'towers', 'your army — build them on the HIGH GROUND (walls) in BUILD mode') +
      glossCard('#ffb000', spriteShot('triad', makeTriadIcon), 'missile triads', 'drive over = +3 shells · shells also blast walls open') +
      glossCard('#66ff88', spriteShot('phage', unitIcon('phage', CREATURE_TINTS.phage)), 'fodder', 'soft creatures — RAM them, it’s free') +
      glossCard('#ff5340', spriteShot('barbed', unitIcon('barbed', CREATURE_TINTS.barbed)), 'spiked reds', 'armored — ramming hurts YOU · shells only') +
      glossCard('#ffffff', spriteShot('portal', () => makePortalCloud({ body: 0xcfd8ff, hi: 0xffffff })), 'portals', 'the enemy sources · 3 shells each · dim as they die') +
      `</div>` +
      GAMEPLAY_TIPS +
      `<b>WIN = DESTROY EVERY PORTAL.</b> reaching the heart wins nothing — it's home.` +
      `</div>` +
      `<div class="msg-foot">` +
      `<button class="msg-glenemy">enemy glossary</button> ` +
      `<button class="msg-glachv">the record</button> ` +
      `<button class="msg-glfriend">pickups</button><br>` +
      `<button class="msg-begin">&rsaquo; begin round ${round}</button>` +
      `</div>`;
    msgEl.classList.remove('hidden');
  }

  // THE RECORD. Everything earned and everything not, in one list, grouped
  // the way the table is. Unearned entries keep their NAME and lose their
  // note — a list of question marks tells a player nothing about what to go
  // and do, and a list that spells out every condition removes the reason to
  // wonder. The name is the hint.
  function showRecord() {
    paused = true;
    const held = new Set(heldAchv);
    const rows = ACHV_GROUPS.map((grp) => {
      const inGroup = ACHIEVEMENTS.filter((a) => a.group === grp);
      const got = inGroup.filter((a) => held.has(a.id)).length;
      return `<div class="rec-group">${grp} <i>${got}/${inGroup.length}</i></div>`
        + inGroup.map((a) => {
          const on = held.has(a.id);
          return `<div class="rec-row${on ? ' got' : ''}">`
            + `<span class="rec-mark">${on ? '&#10022;' : '&#9675;'}</span>`
            + `<span class="rec-name">${a.name}</span>`
            + `<span class="rec-note">${on ? a.note : '&mdash;'}</span></div>`;
        }).join('');
    }).join('');
    msgEl.innerHTML = `<div class="msg-head">the record</div>`
      + `<div class="msg-scroll"><div class="rec">${rows}</div></div>`
      + `<div class="go-reason">${held.size}/${ACHIEVEMENTS.length} &middot; the record survives a run; the run does not</div>`
      + `<button class="msg-back">&larr; back to briefing</button>`;
    msgEl.classList.remove('hidden');
  }

  function showEnemyGlossary() {
    paused = true;
    const cards = INTROS.map((iv) => {
      const spec = ENEMY_SPEC[iv.type];
      const tint = '#' + CREATURE_TINTS[iv.type].toString(16).padStart(6, '0');
      const ram = spec.rammable
        ? '<span style="color:#66ff88">▼ rammable</span>'
        : '<span style="color:#ff5340">× do not ram</span>';
      return glossCard(tint, spriteShot(iv.type, unitIcon(iv.type, CREATURE_TINTS[iv.type])), iv.label.toLowerCase(),
        `${iv.role} · ${spec.hp} hp · arrives wave ${iv.wave} · ${ram}`);
    }).join('');
    msgEl.innerHTML = `<div class="msg-head">glossary · hostiles</div>` +
      `<div class="gcards">${cards}` +
      glossCard('#ffffff', spriteShot('portal', () => makePortalCloud({ body: 0xcfd8ff, hi: 0xffffff })), 'portal', 'where they pour from · 3 shells to destroy · dims with each hit · pulses on the minimap once found') +
      `</div><button class="msg-back">← back to briefing</button>`;
    msgEl.classList.remove('hidden');
  }

  function showFriendGlossary() {
    paused = true;
    const orbIcon = (shape, body) => () => makeRewardSolid(shape, { body, hi: 0xffffff }, 1.7);
    msgEl.innerHTML = `<div class="msg-head">glossary · pickups</div>` +
      `<div class="gcards">` +
      glossCard('#ff6a88', spriteShot('heart', heartIcon), 'the stalheart', `${HEART_MAX} hp · enemy contact drains it · regen charges heal it`) +
      glossCard('#9fdcff', spriteShot('tower-' + params.towerLook, () => buildTowerLook(params.towerLook, starterTower())), 'towers', 'mount on walls only · tap high ground in BUILD mode · upgrade twice · sell 75%') +
      glossCard('#ffb000', spriteShot('triad', makeTriadIcon), 'missile triad', '+3 shells on touch (rack caps at 9) — the ONLY ammo pickup') +
      glossCard('#9ff8ff', spriteShot('orb-power', orbIcon('star', 0x9ff8ff)), 'power sphere', 'far-field reward · +8% speed, permanent') +
      glossCard('#3dff6e', spriteShot('orb-health', orbIcon('cell', 0x3dff6e)), 'health sphere', 'far-field reward · +1 your hp') +
      glossCard('#ff2df0', spriteShot('orb-regen', orbIcon('ring', 0xff2df0)), 'regen charge', 'CARRY it back near the heart: +4 heart hp') +
      glossCard('#59c8ff', spriteShot('orb-shield', orbIcon('dome', 0x59c8ff)), 'energy shield', '12s bubble over the hull — touch damage bounces off') +
      `</div><button class="msg-back">← back to briefing</button>`;
    msgEl.classList.remove('hidden');
  }
  // THE HACK: the vendored HDT circuit duel in a same-origin iframe.
  // 3.html is the deep link — the minigame's router parses digits out of
  // the path, so a copy under that name boots straight into game 3 with
  // zero source patching. Same origin means the parent can simply READ
  // the game's own state (window.__cx.game().phase) instead of needing a
  // postMessage protocol added to a finished game.
  // THREE PROTOCOLS on the relay: the HDT circuit duel, and two grid
  // puzzles from pazorukore (BRIDGE = hashiwokakero, SHIKAKU) — vendored
  // build-free at minigames/pzk, selected by its own ?game= query. Win
  // states differ by engine: the duel exposes __cx.game().phase
  // ('WON'/'LOST'); pazorukore exposes __pazoru.phase ('solved' — its
  // puzzles cannot be lost, only abandoned).
  const HACK_GAMES = {
    hdt: { src: 'minigames/hdt/3.html' },
    bridges: { src: 'minigames/pzk/index.html?game=bridges&skin=futuristic' },
    shikaku: { src: 'minigames/pzk/index.html?game=shikaku&skin=futuristic' },
  };
  let hackGame = 'hdt';
  // A DIFFERENT BOARD EVERY BREACH (operator: "it's always the same game").
  // Both engines shipped with a constant seed — pazorukore's defaultParams
  // hardcodes `seed: 1`, and the duel's specs carry the string seeds "hdt",
  // "net" and "orbs" — so every hack served the identical puzzle. Neither
  // is fixed by reloading: the constant is inside the game.
  //
  // The seed is still DERIVED, not random: the house rule is one mulberry32
  // stream off params.seed and no Math.random in game logic, so a replayed
  // run breaches the same puzzles in the same order. hackOpens is what
  // moves it — the count of breaches this run.
  let hackOpens = 0;
  function hackSeed() {
    const rng = mulberry32((params.seed | 0) * 7919 + hackOpens * 104729 + round * 31);
    return (rng() * 0xffffffff) >>> 0;
  }
  // The duel has no URL seed, but its bridge exposes regenerate(spec, seed)
  // — the same call it makes on a DEADLOCK — and game().board carries the
  // spec. So the parent rebuilds the board after the frame boots rather
  // than patching a minified bundle it does not own.
  function reseedHdt(seed, tries = 0) {
    try {
      const w = hackFrameEl && hackFrameEl.contentWindow;
      const cx = w && w.__cx;
      const b = cx && cx.game && cx.game().board;
      if (b && b.spec && cx.regenerate) { cx.regenerate(b.spec, `hdt-${seed}`); return; }
    } catch { /* frame still booting */ }
    if (tries < 40) setTimeout(() => reseedHdt(seed, tries + 1), 120);
  }
  // THE BAR READS THE GAME OUT. The duel keeps a budget for each side and a
  // clock, and showed none of it — the operator could not tell how many
  // attempts they had left, how many the host had, or how close the thing
  // was to ending, so it always ended abruptly. All three are already on
  // the bridge; nobody was asking for them.
  const hackReadEl = root.querySelector('#td-hack-readout');
  function syncHackReadout() {
    if (!hackReadEl) return;
    let txt = '';
    try {
      const w = hackFrameEl && hackFrameEl.contentWindow;
      if (hackGame === 'hdt' && w && w.__cx && w.__cx.game) {
        const g = w.__cx.game();
        if (g && g.pBudget !== undefined) {
          const low = g.pBudget <= 2 ? ' low' : '';
          txt = `<b class="hk-you${low}">YOU ${g.pBudget}</b>`
            + `<b class="hk-them">HOST ${g.eBudget}</b>`
            + (g.timeLeft !== undefined ? `<b class="hk-clock">${Math.ceil(g.timeLeft)}s</b>` : '')
            + (g.phase ? `<b class="hk-phase">${g.phase}</b>` : '');
        }
      } else if (w && w.__pazoru) {
        const ph = w.__pazoru.phase;
        if (ph) txt = `<b class="hk-phase">${String(ph).toUpperCase()}</b>`;
      }
    } catch { /* frame still booting, or gone */ }
    if (hackReadEl.innerHTML !== txt) hackReadEl.innerHTML = txt;
  }

  // FIT THE GAME TO THE FRAME. These are embedded pages with their own
  // responsive layouts, and on a phone the board simply ran off the right
  // edge — the operator saw the logo and a sliver of grid. Rather than
  // fight three separate layouts, the frame is given the width the games
  // were designed for and scaled down to whatever the wrapper actually is.
  const HACK_LOGICAL_W = 560;   // the fallback, for a frame not yet readable
  // TURN THE BOARD SIDEWAYS ON A PORTRAIT PHONE (operator: "on mobile, when
  // reaching the server, the games are hard to play because they're not full
  // screen").
  //
  // They are not full screen because they are LANDSCAPE games and a phone
  // held upright is not. Fitted upright, a 560-wide board on a 430-wide
  // screen runs at 77% with a hundred and fifty pixels of letterbox above
  // and below — it works, and everything in it is too small to hit.
  //
  // Rotated, the same board gets the phone's LONG axis and needs no
  // downscaling at all: it is handed exactly `availH x availW` and turned
  // back into the screen, so it fills it at 1:1. Pointer events come through
  // a CSS transform correctly, so the games need no idea this happened.
  //
  // It is a TOGGLE and not a rule, because "turn your phone" is a taste
  // question and the operator should be able to answer it with a thumb
  // rather than a reload. Default: on where the screen is portrait enough
  // that fitting upright would cost more than a quarter of the size.
  //
  // AND IT IS PER GAME, because the three genuinely differ. HDT is a wide
  // circuit board — measured, it fills a 908x418 landscape phone at scale 1
  // — so turning it is pure gain. The two pazorukore puzzles are squarish
  // boards with side panels: handed a 2:1 viewport they clip their own grid
  // internally, which the iframe cannot see (the child reports no overflow;
  // it simply lays out wrong). Turning those makes them worse, so by
  // default they stay upright and the button is there if the operator
  // disagrees.
  const HACK_LANDSCAPE = { hdt: true, bridges: false, shikaku: false };
  let hackTurn = null;   // null = decide from the shape; true/false = the player has
  const hackRotEl = root.querySelector('#td-hack-rotate');
  function hackTurned(availW, availH, logical) {
    if (hackTurn !== null) return hackTurn;
    const forced = urlParams.get('hackrot');
    if (forced === '0') return false;
    if (forced === '1') return true;
    if (!HACK_LANDSCAPE[hackGame]) return false;
    return availH > availW * 1.15 && availW / logical < 0.78;
  }
  if (hackRotEl) {
    hackRotEl.addEventListener('click', () => {
      const wrap = hackWrapEl.getBoundingClientRect();
      const bar = hackWrapEl.querySelector('.hk-bar');
      const barH = bar ? bar.getBoundingClientRect().height : 0;
      hackTurn = !hackTurned(wrap.width, Math.max(120, wrap.height - barH), HACK_LOGICAL_W);
      fitHackFrame();
    });
  }
  function fitHackFrame() {
    if (!hackFrameEl || !hackWrapEl || hackWrapEl.classList.contains('hidden')) return;
    const wrap = hackWrapEl.getBoundingClientRect();
    const bar = hackWrapEl.querySelector('.hk-bar');
    const barH = bar ? bar.getBoundingClientRect().height : 0;
    const availW = wrap.width, availH = Math.max(120, wrap.height - barH);
    // ASK THE GAME how wide it wants to be rather than guessing. 560 fitted
    // the duel and left the pazorukore board hanging off the side — they are
    // three different layouts and a single constant was never going to serve
    // all of them. Same-origin, so the child's own scrollWidth is readable;
    // the constant is only the fallback for a frame that has not painted.
    let logical = HACK_LOGICAL_W;
    try {
      const d = hackFrameEl.contentDocument;
      if (d && d.documentElement) {
        logical = Math.max(logical, d.documentElement.scrollWidth, d.body ? d.body.scrollWidth : 0);
      }
    } catch { /* not readable yet */ }
    // THE TURNED PATH, and it is simpler than the upright one because there
    // is nothing to compromise: the frame is given the screen's long axis as
    // its width and its short axis as its height, then rotated back into it.
    // With transform-origin at the top left, translate(availW, 0) rotate(90)
    // maps the frame's local (x, y) onto (availW - y, x) — so local x runs
    // down the screen and local y runs back across it, exactly filling.
    if (hackTurned(availW, availH, logical)) {
      // TURNED IS NOT AUTOMATICALLY 1:1. Handing the child the phone's long
      // axis is usually enough — HDT and the duel fill it exactly — but
      // pazorukore's board lays a grid out beside two side panels and can
      // still want more width than that. So the turned path asks the same
      // question the upright one does (how wide does the game SAY it is)
      // and scales the long axis to fit, rather than assuming.
      //
      // With transform-origin at the top left, translate(availW,0) rotate(90)
      // scale(s) maps the frame's local (x, y) onto (availW - s*y, s*x): local
      // x runs down the screen, local y runs back across it. Both axes fill
      // exactly when the frame is sized (availH/s) x (availW/s).
      const LW = Math.max(availH, logical);
      const ts = Math.min(1, availH / LW);
      const LH = availW / ts;
      hackFrameEl.style.width = `${Math.round(LW)}px`;
      hackFrameEl.style.height = `${Math.round(LH)}px`;
      hackFrameEl.style.transformOrigin = 'top left';
      hackFrameEl.style.transform =
        `translate(${Math.round(availW)}px, 0) rotate(90deg) scale(${ts})`;
      if (urlParams.get('hack')) {
        console.log(`HACKFIT TURNED avail=${Math.round(availW)}x${Math.round(availH)}`
          + ` logical=${logical} frame=${Math.round(LW)}x${Math.round(LH)}`
          + ` scale=${ts.toFixed(3)}`);
      }
      return;
    }
    const scale = Math.min(1, availW / logical);
    if (scale >= 1) {
      // desktop has the room: leave the frame alone entirely
      hackFrameEl.style.width = '';
      hackFrameEl.style.height = '';
      hackFrameEl.style.transform = '';
      return;
    }
    // AND CAP THE HEIGHT. The first cut scaled width only and handed the
    // child a 560x866 viewport — phone-shaped. The pazorukore board sizes
    // its cells from the AVAILABLE HEIGHT, so a very tall frame grew them
    // until the board ran off the side, which is the clipping the operator
    // saw. Capped to a shape those games were actually laid out in, and
    // letterboxed down the middle rather than stretched.
    const logicalH = Math.min(availH / scale, logical * 1.28);
    const usedH = logicalH * scale;
    const padY = Math.max(0, (availH - usedH) / 2);
    hackFrameEl.style.width = `${logical}px`;
    hackFrameEl.style.height = `${logicalH}px`;
    hackFrameEl.style.transformOrigin = 'top left';
    hackFrameEl.style.transform = `translateY(${padY / scale}px) scale(${scale})`;
    if (urlParams.get('hack')) {
      let child = '';
      try {
        const d = hackFrameEl.contentDocument;
        const de = d && d.documentElement;
        if (de) {
          child = ` child=${de.scrollWidth}x${de.scrollHeight}`
            + ` client=${de.clientWidth}x${de.clientHeight}`
            + ` overflows=${de.scrollWidth > de.clientWidth + 1}`;
        }
      } catch { child = ' child=unreadable'; }
      console.log(`HACKFIT avail=${Math.round(availW)}x${Math.round(availH)}`
        + ` logical=${logical} scale=${scale.toFixed(3)}`
        + ` frame=${Math.round(hackFrameEl.getBoundingClientRect().width)}` + child);
    }
  }
  addEventListener('resize', fitHackFrame);


  function readHackPhase() {
    try {
      const w = hackFrameEl.contentWindow;
      if (!w) return null;
      if (hackGame === 'hdt') {
        const cx = w.__cx;
        if (cx && cx.game) {
          const ph = cx.game().phase;
          if (ph === 'WON') return 'won';
          if (ph === 'LOST') return 'lost';
        }
      } else if (w.__pazoru && w.__pazoru.phase === 'solved') return 'won';
    } catch { /* frame still booting */ }
    return null;
  }
  const hackBtnEl = root.querySelector('#td-hack');
  const hackPromptEl = root.querySelector('#td-hackprompt');
  let hackPromptForce = false;
  if (hackPromptEl) hackPromptEl.addEventListener('pointerdown', () => openHack());
  const hackWrapEl = root.querySelector('#td-hackwrap');
  const hackFrameEl = root.querySelector('#td-hackframe');
  let hackPoll = null;
  function syncHackBtn() {
    if (hackBtnEl) hackBtnEl.classList.toggle('hidden', !(serverFound && !hackedRound));
  }
  function openHack() {
    if (!hackWrapEl || !hackFrameEl || hackedRound) return;
    if (!hackWrapEl.classList.contains('hidden')) return; // already breaching
    paused = true;
    sfx.play('server_dialup'); // six seconds of negotiation IS the fiction
    hackOpens++;               // moves the seed: a new board every breach
    setHackGame(hackGame);
    hackWrapEl.classList.remove('hidden');
    // THE GAME'S OWN CHROME GETS OUT OF THE WAY. The hamburger is appended
    // to <body> and the overlay lives inside the tab, so their z-indexes
    // never compare — on a phone the ☰ sat squarely on top of the breach
    // bar, over the tab of the game you were actually playing.
    document.body.classList.add('hacking');
    fitHackFrame();
    if (hackFrameEl) {
      hackFrameEl.addEventListener('load', () => {
        // twice: once on load, once after the child has laid itself out.
        // Measuring a document that has not painted returns the viewport
        // width, which is the answer that makes the fit a no-op — and the
        // TURNED path depends on this settle just as much, since it is the
        // second pass that discovers pazorukore wants more than the phone's
        // long axis and scales it down.
        fitHackFrame();
        setTimeout(fitHackFrame, 250);
        setTimeout(fitHackFrame, 900);
      }, { once: true });
    }
    clearInterval(hackPoll);
    hackPoll = setInterval(() => {
      syncHackReadout();
      const ph = readHackPhase();
      if (ph === 'won' || ph === 'lost') endHack(ph === 'won');
    }, 600);
  }

  // A BREACH ENDS ON A BEAT, not on a cut. The overlay used to vanish the
  // instant the game's phase flipped, so a win and a loss felt identical
  // from the outside: the screen you were reading was simply gone
  // (operator). The bar says what happened and holds it for a moment with
  // the board still behind it, then closes.
  let hackEnding = false;
  function endHack(won) {
    if (hackEnding) return;
    hackEnding = true;
    clearInterval(hackPoll); hackPoll = null;
    if (hackReadEl) {
      hackReadEl.innerHTML = won
        ? `<b class="hk-won">&#10022; BREACHED</b>`
        : `<b class="hk-lost">&#10005; TRACED &mdash; LOCKED OUT</b>`;
    }
    sfx.play(won ? 'tower_upgrade' : 'danger_alert');
    runTimers.after(1600, () => { hackEnding = false; closeHack(won); });
  }
  function setHackGame(g) {
    if (!HACK_GAMES[g]) g = 'hdt';
    hackGame = g;
    // A TURN IS AN ANSWER ABOUT ONE BOARD. Switching games throws it away
    // and asks the shape again — holding a player's "turn it" from the
    // circuit duel over onto a pazorukore grid applies their answer to a
    // question they were not asked.
    hackTurn = null;
    const seed = hackSeed();
    if (hackFrameEl) {
      // the pazorukore games take the seed on their own query string; the
      // duel is reseeded through its bridge once it has booted
      hackFrameEl.src = g === 'hdt'
        ? HACK_GAMES[g].src
        : `${HACK_GAMES[g].src}&seed=${seed}`;
      if (g === 'hdt') reseedHdt(seed);
    }
    for (const b of root.querySelectorAll('.hk-tab')) {
      b.classList.toggle('active', b.dataset.hack === g);
    }
  }
  for (const b of root.querySelectorAll('.hk-tab')) {
    b.addEventListener('click', () => setHackGame(b.dataset.hack));
  }
  function closeHack(won) {
    hackEnding = false;
    clearInterval(hackPoll); hackPoll = null;
    if (hackWrapEl) hackWrapEl.classList.add('hidden');
    document.body.classList.remove('hacking');
    if (hackFrameEl) hackFrameEl.src = 'about:blank';
    paused = false;
    if (won === true) {
      hackedRound = true;
      hackWins++;
      if (!run.minigamesWon.includes(hackGame)) run.minigamesWon.push(hackGame);
      checkAchievements();
      if (hackWins === 2) {
        // the SECOND win opens the black market: missiles for biomass
        missileShop = true;
        showToast(`<div class="wave-num">BLACK MARKET OPEN</div>`
          + `<div class="wave-role">the relay sells missiles now — expensive, and worth it</div>`, 3600);
        syncArmUi();
      } else {
        hackedUnlocks++;
        const ks = unlockedTowerKeys(wave, hackedUnlocks);
        showTowerToast(ks[ks.length - 1]);
        showToast(`<div class="wave-num">FIRMWARE PATCHED</div>`
          + `<div class="wave-role">${hackedUnlocks <= 1
            ? 'AOE schematics decrypted — the relay held the OP half of the combo'
            : 'a tower unlocked ahead of its wave'}</div>`, 3400);
      }
      updateHud();
    } else if (won === false) {
      showToast(`<div class="wave-num">TRACE COMPLETE</div>`
        + `<div class="wave-role">connection dropped — the relay resets, try again</div>`, 2800);
    }
    syncHackBtn();
  }
  if (hackBtnEl) hackBtnEl.addEventListener('click', openHack);
  const hackAbortEl = root.querySelector('#td-hack-abort');
  if (hackAbortEl) hackAbortEl.addEventListener('click', () => closeHack(null));

  // callout pop-ups + the ram combo counter (both pointer-transparent)
  const calloutsEl = root.querySelector('#td-callouts');
  const comboEl = root.querySelector('#td-combo');
  // WHAT SURVIVES THE ENCOURAGEMENT BEING SWITCHED OFF. The praise is the
  // part the operator wants gone — RECKLESS!, すげ〜!, the heart's lines. The
  // SCORING is not praise: a streak multiplier and a ram count are facts you
  // are playing against, so they stay. With the words stripped, in every
  // language, because "×1.45" is the whole message and "STREAK" was only ever
  // decoration on it.
  const CALLOUT_NUMERIC = { 'co-streak': true, 'co-milestone': true };
  const numbersOnly = (t) => {
    const m = String(t).match(/[×x]\s*[\d.]+/);
    return m ? m[0].replace(/\s+/g, '') : t;
  };

  function showCallout(text, cls, pin = false) {
    if (!calloutsEl) return;
    if (!params.callouts) {
      if (!CALLOUT_NUMERIC[cls]) return;   // the praise goes quiet
      text = numbersOnly(text);
    }
    while (calloutsEl.children.length >= 3) calloutsEl.firstChild.remove();
    const d = document.createElement('div');
    d.className = `callout ${cls}`;
    d.textContent = text;
    calloutsEl.appendChild(d);
    // pin: the forced ?callout=1 path — under a virtual-time budget both
    // the removal timer AND the 1.2s animation outrun the first paint
    if (pin) d.style.animation = 'none';
    else setTimeout(() => d.remove(), 1200);
  }
  // one class on the tab root moves both number slots off the middle of the
  // screen; the CSS owns where, so this never has to know
  function syncCalloutMode() {
    root.classList.toggle('no-callouts', !params.callouts);
    syncCombo();
  }

  function syncCombo() {
    if (!comboEl) return;
    if (ramCombo < 2) { comboEl.classList.add('hidden'); return; }
    comboEl.textContent = params.callouts ? `RAM ×${ramCombo}` : `×${ramCombo}`;
    // the tier is the intensity dial: size and color climb every 10
    comboEl.dataset.tier = String(Math.min(5, Math.floor(ramCombo / 10)));
    comboEl.classList.remove('hidden');
    comboEl.classList.remove('pop');
    void comboEl.offsetWidth; // restart the pop animation
    comboEl.classList.add('pop');
  }
  function noteStreak() {
    // a callout at every 5th consecutive kill — the multiplier made visible
    const st = eco.streak;
    run.bestStreak = Math.max(run.bestStreak, st);
    checkAchievements();
    if (st >= streakMark + 5) {
      streakMark = st - (st % 5);
      showCallout(`STREAK ×${eco.multiplier().toFixed(2)}`, 'co-streak');
    }
    if (rs) rs.maxRank = Math.max(rs.maxRank, tankRank);
    run.maxRank = Math.max(run.maxRank, tankRank);
    checkAchievements();
  }
  function noteKillContext(e, src) {
    noteStreak();
    // hands-on kill of a SOLID unit at arm's length: the reckless family
    if (src === 'tank' && !e.spec.rammable
        && dist3(e.pos, player.pos) < cellSide * 2.4) {
      showCallout(RECKLESS_MSGS[recklessIdx++ % RECKLESS_MSGS.length], 'co-reckless');
    }
    // any kill in the heart's yard — gated, sieges kill by the dozen
    if (heartCalloutCd <= 0
        && dist3(e.pos, graph.centers[dungeon.heart]) < cellSide * 2.5) {
      heartCalloutCd = 6;
      showCallout(HEART_MSGS[heartIdx++ % HEART_MSGS.length], 'co-heart');
    }
  }

  // End-of-wave SitRep: the downtime between waves earns a recap — kills
  // by type as a tinted histogram, kill tempo as a block-glyph sparkline,
  // points and bonuses in one line. Military register, field-manual green.
  // Non-blocking: the tank still drives; tap dismisses, the next wave's
  // telegraph dismisses it regardless.
  const sitrepEl = root.querySelector('#td-sitrep');
  const SPARK = '▁▂▃▄▅▆▇█';
  function sparkline(bins) {
    let last = bins.length - 1;
    while (last > 0 && bins[last] === 0) last--;
    const used = bins.slice(0, Math.max(3, last + 1));
    const top = Math.max(1, ...used);
    return used.map((v) => SPARK[Math.round((v / top) * 7)]).join('');
  }
  function showSitrep() {
    if (!sitrepEl || !ws) return;
    const total = Object.values(ws.kills).reduce((a, b) => a + b, 0);
    if (total === 0) return; // nothing happened; say nothing
    const dur = Math.max(1, Math.round(runContext.time - ws.t0));
    const top = Math.max(1, ...Object.values(ws.kills));
    const rows = Object.entries(ws.kills).sort((a, b) => b[1] - a[1])
      .map(([type, k]) => {
        const tint = '#' + (CREATURE_TINTS[type] ?? 0xffffff).toString(16).padStart(6, '0');
        return `<div class="sr-row"><span class="sr-name">${type}</span>`
          + `<span class="sr-track"><span class="sr-bar" style="width:${Math.round((k / top) * 100)}%;background:${tint}"></span></span>`
          + `<span class="sr-n">${k}</span></div>`;
      }).join('');
    sitrepEl.innerHTML =
      `<div class="sr-head">&#9626; SITREP &middot; WAVE ${wave} CLEAR &middot; ${dur}s</div>`
      + `<div class="sr-line">KILLS ${total} &mdash; tank ${ws.bySrc.tank}`
      + ` &middot; towers ${ws.bySrc.tower} &middot; orbital ${ws.bySrc.strike}</div>`
      + rows
      + `<div class="sr-line sr-spark">TEMPO ${sparkline(ws.bins)}</div>`
      + `<div class="sr-line">POINTS +${fmt(score.points - ws.points0)}`
      + ` &middot; CLEAR BONUS +${100 + 25 * wave} &middot; PEAK &times;${ws.maxMult.toFixed(2)}</div>`
      + `<div class="sr-line">RAMS ${ws.rams}${ws.leaks ? ` &middot; <span class="sr-leak">LEAKS ${ws.leaks}</span>` : ' &middot; no leaks'}</div>`
      + `<div class="sr-foot">[ tap &mdash; dismiss ]</div>`;
    sitrepEl.classList.remove('hidden');
  }
  function hideSitrep() { if (sitrepEl) sitrepEl.classList.add('hidden'); }
  if (sitrepEl) sitrepEl.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation(); // a dismiss tap must not read as a board tap
    hideSitrep();
  });

  // generic transient toast (non-blocking, auto-hides)
  const toastEl = root.querySelector('#td-toast');
  let toastTimer = null;
  function showToast(html, ms = 3000) {
    if (!toastEl) return;
    toastEl.innerHTML = html;
    // the toast is pointer-transparent by default (it sits over the board);
    // it only accepts taps when it is carrying one to accept
    toastEl.classList.toggle('actionable', html.includes('toast-yes'));
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms);
  }
  if (toastEl) {
    toastEl.addEventListener('click', (ev) => {
      if (!ev.target.classList || !ev.target.classList.contains('toast-yes')) return;
      toastEl.classList.add('hidden');
      toastEl.classList.remove('actionable');
      setView('drone');
    });
  }

  // switching back to driving: a brief, non-pausing reminder of the mode model
  function showOverrideModal() {
    showToast(`<div class="wave-num">MANUAL</div>` +
      `<div class="wave-role">you're driving — tap a directive to hand the wheel to auto</div>`);
  }
  // The instrument panel. Three reading distances, three brightness tiers:
  // vitals bright and big (sub-second combat reads), resources mid (biomass
  // orange as ever, the wave numeral the largest thing on the panel), meta
  // and objectives dim. The who-is-driving line is GONE from the panel —
  // control state lives ON the AUTO button now, where the control is.
  function updateHud() {
    if (eco && eco.biomass > run.peakBiomass) { run.peakBiomass = eco.biomass; checkAchievements(); }
    if (lifeContainers.length) syncLifeContainers();
    const spAlive = spawnPoints.filter((s) => s.alive).length;
    // THE SHIELD IS ALWAYS ON THE PANEL NOW, in one of three states — up and
    // draining, cooling through the seam, or idle with a rack. The seam is the
    // feature and it is two seconds long; a player who cannot see it counted
    // down cannot plan the chain that the whole rack exists for.
    const shieldPips = `<i class="sh-pip">${'▮'.repeat(shield.rack)}`
      + `${'▯'.repeat(Math.max(0, shieldTune.rackCap - shield.rack))}</i>`;
    // IT HAS TO SAY WHAT IT IS. The first cut was a bare ◈ and four pips at
    // the end of the alerts line — the operator played a full board and asked
    // whether the shield had been implemented at all. A readout nobody can
    // identify is a readout that is not there, however correct the state
    // behind it. So: the word, then the number, then what you can spend.
    const shieldBar = shieldUp()
      ? `<b class="sh-bar" style="--sh:${Math.max(0, Math.min(1, shield.t / shieldTune.cap))}">`
        + `◈ SHIELD ${Math.ceil(shield.t)}s</b> ${shieldPips}`
      : (t < shield.coolUntil
        ? `<span class="sh-cool">◈ SHIELD COOLING ${(shield.coolUntil - t).toFixed(1)}s</span> ${shieldPips}`
        : `<span class="sh-idle">◈ SHIELD</span> <b class="sh-ready">T</b> ${shieldPips}`);
    const alerts = [shieldBar,
      carryingRegen ? '⬤ REGEN CARRIED' : '',
      cannonHeat > 0 ? 'CANNON HOT' : '',
      laserOverheat ? 'LASER COOLING' : ''].filter(Boolean).join(' · ');
    const hearts = `<span class="hp-heart">${'♥'.repeat(Math.max(0, heartHP))}</span>`
      + `<span class="hp-dim">${'·'.repeat(Math.max(0, HEART_MAX - heartHP))}</span>`;
    statsEl.innerHTML =
      `<div class="hud-meta">SCORE <b>${fmt(score.points)}</b> · BEST ${fmt(score.best)}`
      + `${rankBadgeHud ? ' ' + rankBadgeHud : ''}</div>`
      + `<div class="hud-vitals">${hearts} <span class="hud-lbl">HEART</span>`
      + ` <span class="hp-you">♥${playerHP}</span>`
      + ` <span class="hp-ammo${ammo === 0 ? ' out' : ''}">✦${ammo}</span>`
      + ` <span class="hp-ammo hp-mine${mineField.count === 0 ? ' out' : ''}">⌖${mineField.count}</span></div>`
      + `<div class="hud-res"><span class="hud-biomass">${eco.biomass}kg`
      + ` ×${eco.multiplier().toFixed(2)}</span>`
      + `<span class="hud-wave">WAVE <b>${wave}</b> · R${round}</span></div>`
      + (missionOn ? rescueLine()
        : `<div class="hud-obj">portals ${spAlive}/${spawnPoints.length}`
        + ` · ${programmeDone() ? 'WAVES SPENT — CLOSE THE GATES'
          : `wave ${sectorWave() + 1}/${params.wavesPerSector} of sector ${round}`}`
        + ` · built ${towers.length}</div>`)
      + (missionOn ? '' : isaoLine())
      + assistantLine()
      + (missionOn ? '' : terraLine())
      + (alerts ? `<div class="hud-alert">${alerts}</div>` : '');
    if (dirBtnEl) {
      const eng = !manualActive();
      const lbl = eng ? (DIRECTIVE_LABEL[params.directive] || 'AUTO')
        : (cruise ? 'CRUISE' : 'AUTO');
      if (dirBtnEl.textContent !== lbl) dirBtnEl.textContent = lbl;
      dirBtnEl.classList.toggle('engaged', eng);
    }
    // diegetic shell rack: the 3×3 turret dots ARE the ammo counter —
    // neon white loaded, faded grey spent (allies stay full: infinite ammo)
    playerMesh?.userData.setAmmo?.(ammo);
    const dots = playerMesh && playerMesh.userData.ammoDots;
    if (dots) {
      for (let i = 0; i < dots.length; i++) {
        dots[i].material.color.setHex(i < ammo ? 0xffffff : 0x4a505c);
      }
    }
  }

  // AUTO GUNNER: in auto mode the tank fights for itself — shells at the
  // nearest enemy in range (the 3 s cannon heat is the fire rate). The
  // directives shape it: 'conserve' and 'ram' spend shells only on the
  // unrammable tier; portals are always worth a shell when nothing else
  // is pressing. Manual mode leaves the trigger entirely to the player.
  // AUTO SECONDARY (operator, 2026-09-01). The lasers cost nothing — no
  // ammo, only heat — so auto uses them in EVERY directive. That is why
  // this does not touch the shell rules below: 'conserve' is conserving
  // limited shells, and there is nothing to conserve about the secondary.
  //
  // RAM is the one exception, and only half an exception: it will not burn
  // a target it is lining up to ram, but it still answers the hard tier it
  // refuses to charge.
  let autoLaserWant = false;
  function autoSecondary() {
    autoLaserWant = false;
    if (manualActive() || player.won || playerDown || paused) return;
    if (!playerMesh || laserOverheat) return;
    const R = 2.6 * cellSide;   // the bolt's own reach, same constant it flies
    // this half only MEASURES; wantsSecondary decides, and is Node-tested
    const cands = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist3(player.pos, e.pos);
      if (d > R) continue;
      const to = norm3(sub3(e.pos, player.pos));
      cands.push({ inRange: true, ahead: dot3(to, player.heading), rammable: e.spec.rammable });
    }
    autoLaserWant = wantsSecondary(params.directive, cands);
  }

  function autoGunner(tNow) {
    // any camera: watching from orbit must not stand your own gun down
    if (manualActive() || player.won || playerDown || paused) return;
    if (ammo <= 0 || cannonHeat > 0) return;
    const R = cellSide * 3.0;
    const shellsAll = shellsForAll(params.directive);
    let target = null, bd = R;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (!shellsAll && e.spec.rammable) continue;
      const d = dist3(player.pos, e.pos);
      if (d < bd) { bd = d; target = e.pos; }
    }
    if (!target) {
      for (const sp of spawnPoints) {
        if (!sp.alive) continue;
        const d = dist3(player.pos, graph.centers[sp.ci]);
        if (d < bd) { bd = d; target = graph.centers[sp.ci]; }
      }
    }
    if (!target) return;
    const n = norm3(player.pos);
    const raw = sub3(target, player.pos);
    const flat = sub3(raw, scale3(n, dot3(raw, n)));
    const l = len3(flat);
    if (l < 1e-9) return;
    fire(scale3(flat, 1 / l));
  }

  // --- pause (ESC): freeze the simulation, keep presenting the frame ------
  let paused = false;
  function togglePause() {
    if (player.won) return; // the end-of-game modal owns the screen
    paused = !paused;
    if (paused) {
      msgEl.innerHTML = `<div class="msg-head">transmission · paused</div>` +
        `sector frozen<br>ESC resumes` + GAMEPLAY_TIPS;
      msgEl.classList.remove('hidden');
    } else {
      msgEl.classList.add('hidden');
    }
    updateHud();
  }

  // wave announcement banner — HokorobiTawaa's "New Threat" card, complete
  // with its spinning live model of the enemy. The sprite renderer is ONE
  // persistent context created up front (never per-announcement — contexts
  // are a scarce browser resource and leak on loss).
  const waveEl = root.querySelector('#td-wave');
  let waveTimer = null;
  // preserveDrawingBuffer: the glossary snapshots toDataURL() this canvas
  const waveSpriteRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  waveSpriteRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  waveSpriteRenderer.setSize(96, 96);
  waveSpriteRenderer.domElement.className = 'wave-sprite';
  const waveScene = new THREE.Scene();
  const waveCam = new THREE.PerspectiveCamera(38, 1, 0.1, 10);
  waveCam.position.set(0, 0.55, 2.7);
  waveCam.lookAt(0, 0.3, 0);
  waveScene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.6));
  const waveSun = new THREE.DirectionalLight(0xffffff, 1.4);
  waveSun.position.set(2, 3, 2);
  waveScene.add(waveSun);
  let waveUnit = null;

  function announceWave(intro) {
    const tint = '#' + CREATURE_TINTS[intro.type].toString(16).padStart(6, '0');
    const spec = ENEMY_SPEC[intro.type];
    // the one fact the player must not miss: can I drive over it?
    const ram = spec.rammable
      ? '<div class="wave-ram" style="color:#66ff88">▼ RAMMABLE — run it over</div>'
      : '<div class="wave-ram" style="color:#ff5340">× DO NOT RAM — shells only</div>';
    waveEl.style.borderColor = tint;
    waveEl.style.color = tint;
    waveEl.innerHTML = `<div class="wave-num">WAVE ${intro.wave} · NEW THREAT</div>` +
      `<div class="wave-name">${intro.label}</div>` +
      `<div class="wave-role">${intro.role}</div>` + ram;
    // live model between the header and the name (innerHTML wipe means the
    // canvas must be re-inserted each announcement)
    waveEl.insertBefore(waveSpriteRenderer.domElement, waveEl.querySelector('.wave-name'));
    if (waveUnit) { waveScene.remove(waveUnit); disposeObj(waveUnit); }
    waveUnit = buildCreature(intro.type, { walker: CREATURE_TINTS[intro.type], walkerHi: 0xffffff });
    // mesh units stand on y=0, clouds center on the origin — lift clouds
    if (waveUnit.userData.kind === 'cloud') waveUnit.position.y = 0.3;
    waveScene.add(waveUnit);
    waveEl.classList.remove('hidden');
    clearTimeout(waveTimer);
    waveTimer = setTimeout(() => waveEl.classList.add('hidden'), 4200);
  }

  const nextEl = root.querySelector('#td-next');
  function updateNextPreview() {
    // a raid sends no waves, so the preview is a countdown to nothing —
    // and it sat at "in 0s" forever, which reads as a stuck game
    if (player.won || tutorialActive || rescue2On || !nextEl) { nextEl && nextEl.classList.add('hidden'); return; }
    const n = wave + 1;
    const plan = rescueOn ? rescueWavePlan(n) : computeWavePlan(n, round, params.waveSize);
    const chips = plan.entries.map((e, i) => {
      const tint = '#' + CREATURE_TINTS[e.type].toString(16).padStart(6, '0');
      const mark = i === 0 ? '◈' : '●';
      const nm = (INTROS.find((iv) => iv.type === e.type)?.label || e.type).toLowerCase();
      return `<span class="nx-chip" style="color:${tint}">${mark} ${nm} ×${e.count}</span>`;
    }).join('');
    const frozen = buildFrozen() || shotId() === 'reveal';
    let when;
    if (frozen) when = 'ready · leave BUILD to engage';
    else if (waveActive && !enemies.every((e) => !e.alive)) {
      // mid-wave the chip said 'clear the field' — permanent furniture
      // saying something the board already says. It HIDES now: the chip
      // appears at wave-clear with the countdown and leaves at spawn.
      nextEl.classList.add('hidden');
      return;
    }
    // the armed countdown is the truth once it is running — during a stall
    // the gap clock is not what decides when the wave lands
    else if (waveIn >= 0) when = `in ${Math.max(0, Math.ceil(waveIn))}s`;
    else when = `in ${Math.max(0, Math.ceil(params.waveGap - interClock))}s`;
    nextEl.innerHTML = `<div class="nx-head">NEXT WAVE ${n} · ${when}</div><div class="nx-row">${chips}</div>`;
    nextEl.classList.remove('hidden');
  }

  // tower-unlock toast — own element (#td-tower) so it never clobbers the
  // enemy "NEW THREAT" waveEl card that fires on the same spawnWave() call
  const towerEl = root.querySelector('#td-tower');
  let towerToastTimer = null;
  function showTowerToast(key) {
    const def = TOWER_BY_KEY[key];
    if (!def) return;
    towerEl.style.borderColor = '#7fdfff';
    towerEl.style.color = '#7fdfff';
    towerEl.innerHTML = `<div class="wave-num">NEW TOWER UNLOCKED</div>` +
      `<div class="wave-name">${def.label}</div>` +
      `<div class="wave-role">available now in BUILD</div>`;
    // clear any stale icon before inserting the new one
    const old = towerEl.querySelector('.wave-icon');
    if (old) old.remove();
    const icon = spriteShot(`tower-${params.towerLook}-${key}`, () => buildTowerLook(params.towerLook, def));
    const img = new Image(); img.src = icon; img.className = 'wave-icon';
    towerEl.insertBefore(img, towerEl.querySelector('.wave-name'));
    towerEl.classList.remove('hidden');
    clearTimeout(towerToastTimer);
    towerToastTimer = setTimeout(() => towerEl.classList.add('hidden'), 3000);
  }

  // --- generation ----------------------------------------------------------
  function regenerate() {
    // a fresh sky for a fresh board. Bakes only when the seed changed, so a
    // rebuild that keeps the run keeps the sky.
    skySeed = skyQ != null ? (parseInt(skyQ, 10) >>> 0) % 100000 : randomSeed() % 100000;
    if (!lab.on) applySky();
    const t0 = performance.now();
    ctlLog('regenerate:before');
    runTimers.clear();
    runContext.begin();
    record('run.start', { seed: params.seed, mission: new URLSearchParams(location.search).get('mission') || 'defense', roster: ROSTER.id, points: params.points });   // anything the old run left in flight is now stale by number
    // a regenerate is a FRESH RUN: sector 1, towers gone, fresh purse.
    // (Round expansion never comes through here — expandRound reveals the
    // same world in place, towers standing.) Clear towers first: stale
    // towerCells would poison openNeighbors during board generation.
    round = 1;
    // A FRESH RUN GETS A FRESH AUDIO GRAPH. Beds are owned by handles, and a
    // regenerate throws the owners away — so anything still looping kept
    // looping, and the next run layered its own on top. Two games in, that
    // is two engine beds and every voice either has ever fired still wired
    // to a bus (operator: "the sound started to lag after the second game").
    sfx.panic();
    stopEngine(0, true);
    sectorStartWave = 0; sectorsCleared = 0;
    // the record persists; the RUN's facts do not
    run = blankRun();
    runAchv = [];
    clearTowers();
    tfReset();   // a new world starts with an empty yard
    campaignReset();
    if (assistant) { scene.remove(assistant.obj); disposeObj(assistant.obj); assistant = null; }
    for (const o of orders) o.worker = null;
    // opening biomass: exactly a Rapid (70kg) + a Slow (100kg) — your first plan
    eco = makeEconomy({ startBiomass: GAME_START_BIOMASS });
    score.reset();
    // THE OPENING GARRISON (sim batch: the heart pays half its total in
    // waves 1-3, before any kit exists).
    //
    // It used to stand PRE-BUILT on the walls nearest the heart — two towers
    // that simply existed, behind the Stalheart, doing their work from
    // somewhere the player never looks. Both halves of that were wrong
    // (operator, 2026-09-02): nothing the player builds is built by the
    // player, and that rule should hold from the first second, so ISAO flies
    // out and prints these like any other order; and tucked in behind the
    // heart they were shooting at things that had already arrived.
    //
    // The board opens on a drone doing its job at a place worth looking at.
    // The garrison is still FREE — the biomass is credited before the orders
    // are placed, so orderTower's own spend nets to zero and every other
    // rule (the queue, the travel, the print clock) applies unchanged.
    queueMicrotask(() => {
      eco.addBiomass(starterTower().cost * 2);
      for (const ci of garrisonSites(2)) orderTower(starterTower().key, ci, { quiet: true });
      spawnIsao();   // on shift from the first second, order or no order
    });
    hackedUnlocks = 0; hackedRound = false; syncHackBtn();
    hackWins = 0; missileShop = false; missilesBought = 0;
    resetRunStats();
    bossCued = false;
    dangerWarnedWave = -1;
    heartCalloutCd = 0; streakMark = 0;
    ramCombo = 0; ramComboT = 0; syncCombo();
    breachedCells.clear(); // a NEW world owes nothing to the old one's holes
    mesh = generateSphereMesh({ seed: params.seed >>> 0, n: params.points, k: 12 });
    relax(mesh, { n_iters: params.relaxIters, PULL_RATE: 0.25 });
    dungeon = generateDungeon(mesh, {
      seed: params.seed >>> 0,
      rooms: params.rooms,
      roomRadius: params.roomRadius,
      extraCorridors: params.extraCorridors,
      corridorWidth: params.corridorWidth,
    });
    graph = dungeon.graph;
    cellSide = mesh.defaultSide;
    // THE CAMP, BEFORE ANY ACTOR IS PLACED. Berth cells are graph maths,
    // so they are known now rather than whenever the container model
    // happens to land — which is what lets a reset place the tank once
    // instead of standing it beside the Heart and teleporting it later.
    const footprintRadius = (heartLook().footprint || 0) * heartLook().scale * cellSide;
    berths = computeBerths(dungeon, graph, { footprintRadius, cellSide });
    record('camp.placed', { heartLook: params.heartLook, footprintRadius, cellSide, berths });
    // LANES (HT): keep the dungeon carve — rooms joined by WIDE corridors
    // are the monster lanes, and the wall mass between them is the HIGH
    // GROUND where towers mount. generateDungeon already supplies heart,
    // spawn, and distToHeart over the open subgraph.
    // TD: remember the FULL world, then seal everything beyond round 1's
    // inner sector — the run reveals it back band by band
    tdFullTags = dungeon.tags.slice();
    tdFullDist = Array.from(dungeon.distToHeart);
    tdMaxD = 0;
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (tdFullTags[i] !== BLOCKED) tdMaxD = Math.max(tdMaxD, tdFullDist[i]);
    }
    // THE SERVER'S VAULT (operator's desired pattern, third field report):
    // take the TRUE antipode cell — no walkable filter, the literal pole —
    // and carve an empty CHAMBER into the full world around it: every cell
    // within two hops, a floor disc at least five cells across, ringed by
    // whatever rock was already there. The room may be sealed off at
    // first ON PURPOSE — walls blast open, and a vault you have to breach
    // is the fiction working for us.
    {
      const hc = norm3(graph.centers[dungeon.heart]);
      let best = Infinity; serverCi = -1;
      for (let i = 0; i < graph.centers.length; i++) {
        const d = dot3(norm3(graph.centers[i]), hc);
        if (d < best) { best = d; serverCi = i; }
      }
      serverChamber = [];
      const depth = new Map([[serverCi, 0]]);
      const q = [serverCi];
      while (q.length) {
        const ci = q.shift();
        serverChamber.push(ci);
        if (depth.get(ci) >= 2) continue;
        for (const nb of graph.adj[ci]) {
          if (!depth.has(nb)) { depth.set(nb, depth.get(ci) + 1); q.push(nb); }
        }
      }
      for (const ci of serverChamber) tdFullTags[ci] = ROOM;
    }
    // carve the sector map. Raw azimuth wedges fail on a lane world
    // (corridors cross wedge borders and re-seal as unreachable), and
    // one-gate-per-compass-point collapses when few lanes exit the disk.
    // So: ITERATIVE DIRECTIONAL GROWTH. Each sector claims an equal
    // share of the remaining land, grown breadth-first from a frontier
    // seed picked in its compass direction — sector 2 one way, sector 3
    // BEHIND it, sectors 4/5 the perpendicular pair. Seeds sit on the
    // already-open frontier, so every sector is connected by
    // construction; the applySector re-seal stays as a safety net.
    tdSectorId = new Int8Array(dungeon.tags.length).fill(6);
    {
      const C = dungeon.tags.length;
      const h = graph.normals[dungeon.heart];
      const ref = Math.abs(h[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const t1 = norm3(cross3(h, ref));
      const t2 = cross3(h, t1);
      const cut1 = tdMaxD * 0.3;
      const open = (i) => tdFullTags[i] !== BLOCKED;
      for (let i = 0; i < C; i++) {
        if (open(i) && tdFullDist[i] <= cut1) tdSectorId[i] = 1;
      }
      const beyond = [];
      for (let i = 0; i < C; i++) if (open(i) && tdSectorId[i] === 6) beyond.push(i);
      const unassigned = new Set(beyond);
      const dirs = [t1, scale3(t1, -1), t2, scale3(t2, -1)]; // fwd, BEHIND, side, side
      for (let r = 2; r <= 5; r++) {
        const share = r === 5 ? unassigned.size : Math.ceil(beyond.length / 4);
        const dq = dirs[r - 2];
        let seed = -1, bs = -Infinity;
        for (const i of unassigned) {
          // frontier: touches land that will already be open before round r
          if (!graph.adj[i].some((nb) => open(nb) && !unassigned.has(nb))) continue;
          const sc = dot3(graph.centers[i], dq);
          if (sc > bs) { bs = sc; seed = i; }
        }
        if (seed === -1) break;
        const q2 = [seed];
        unassigned.delete(seed);
        tdSectorId[seed] = r;
        let claimed = 1;
        for (let head = 0; head < q2.length && claimed < share; head++) {
          for (const nb of graph.adj[q2[head]]) {
            if (!unassigned.has(nb)) continue;
            unassigned.delete(nb);
            tdSectorId[nb] = r;
            q2.push(nb);
            claimed++;
            if (claimed >= share) break;
          }
        }
      }
      for (const i of unassigned) tdSectorId[i] = 5; // stragglers ride the last reveal
    }
    applySector(true);
    cellIndex = makeCellIndex(graph.centers, cellSide * 1.7);
    player.freeMode = false;
    player.virtualStart = null;

    // Round start mirrors the death respawn: beside the HEART, not at
    // dungeon.spawn — the carve's "spawn" often lands in the same far band
    // the gates seed into, which put a fresh player nose-to-nose with a
    // forming portal before they had touched a control.
    let startCi = dungeon.heart;
    outer:
    for (let d = 1; d <= 3; d++) {
      for (let i = 0; i < dungeon.tags.length; i++) {
        if (dungeon.tags[i] !== BLOCKED && dungeon.distToHeart[i] === d) { startCi = i; break outer; }
      }
    }
    player.cur = startCi;
    player.prev = -1;
    player.moves = 0;
    player.won = false;
    player.visited = new Set([startCi]);
    player.pos = graph.centers[startCi].slice();
    whim = mulberry32((params.seed ^ 0x51eef) >>> 0);
    const exits = openNeighbors(player.cur);
    // aimed OUTWARD, like the death respawn: starting beside the heart,
    // "toward the heart" would point you into the thing you defend
    let e0 = exits[0];
    for (const e of exits) {
      if (dungeon.distToHeart[e] === dungeon.distToHeart[player.cur] + 1) { e0 = e; break; }
    }
    player.heading = tangentDirTo(player.cur, e0);
    player.travelDir = player.heading.slice();
    player.next = e0;
    player.prog = 0;
    player.smoothDir = player.travelDir.slice();
    player.segLen = Math.max(1e-9, dist3(graph.centers[player.cur], graph.centers[player.next]));

    absorbed = 0;
    baseUnitScale = cellSide * 0.5;
    unitScale = baseUnitScale;
    ammo = 3;
    clearMines();   // a new run gets a fresh rack and an empty board
    sfx.reseed(params.seed); // pitch jitter is deterministic per seed
    deathPick = mulberry32((params.seed >>> 0) ^ 0x9e3779b9);
    heartHP = HEART_MAX;
    playerHP = PLAYER_MAX;
    playerDown = false;
    // the mission strands its people and hands out its budget LAST, so it
    // overwrites the campaign's supply rather than being overwritten by it
    startRescue();
    startRescue2();
    shield.t = 0; shield.coolUntil = -Infinity; shield.taps.clear();
    shield.rack=Math.min(shieldTune.rackCap,shieldTune.rackStart);shield.stationLeft=shieldTune.stationBudget;shieldDrops=0;
    resetTankRank();
    carryingRegen = false;
    speedBonus = 1;
    for (let i = projectiles.length - 1; i >= 0; i--) killProjectile(i);
    for (let i = laserShots.length - 1; i >= 0; i--) killLaser(i);
    laserClock = 0;
    orbRng = mulberry32((params.seed ^ 0x0b0b5) >>> 0);
    respawnClock = 0;
    runContext.resetClock();

    buildGeometry();
    buildActors();
    spawnOrbs();
    spawnEnemies();
    spawnRewards();
    // EVERY RESET ENTERS THE WORLD THE SAME WAY. Brand-new game, browser
    // reload, forced reset, retry after a loss — they all come through
    // regenerate, so they all start with the hull in its berth driving out.
    // Preludes only change what the camera was doing beforehand.
    //
    // Deliberately NOT in applyLook: a look swap is a cosmetic, and
    // cosmetics never reset the run.
    //
    // A RESET ALSO ENDS WHATEVER SHOT WAS RUNNING. Regenerate is on the GUI
    // and on Retry, so it can land mid-reveal — and a reveal that survives a
    // reset keeps its skip listeners registered and then fires its onEnd
    // against revealCells captured from the board that no longer exists.
    // Same rule as runGen for timers, one level up: work started by the dead
    // run must not land on the live one.
    endShot();
    // ...and any brief mid-sentence, plus whatever was queued behind it. A
    // reset that leaves Isao talking over the new run is the same defect class
    // as a camera shot surviving one: state from the old run painted on top of
    // the new board.
    clearBriefs();
    revealCells = [];
    deployStart(berthIndexFor(playerHP));
    placeActors();
    // a fresh board earns a fresh framing — the first-entry courtesy resets
    buildCentered = false;
    if (buildMode) { centerBuildOnHeart(); buildCentered = true; }
    snapCamera();
    paused = false;
    cruise = false;
    msgEl.classList.add('hidden');
    updateHud();
    ctlLog('regenerate:after');
    console.log(`heart sector in ${(performance.now() - t0).toFixed(0)}ms — ` +
      `${floorOffsets.size} open cells, ${orbMeshes.size} orbs, ` +
      `spawn→heart ${dungeon.distToHeart[dungeon.spawn]} hops`);
  }

  params.regenerate = regenerate;
  params.previewDestruction = previewDestruction;
  params.randomize = () => {
    params.seed = randomSeed() % 100000;
    seedCtrl.updateDisplay();
    regenerate();
  };
  // ANOTHER PLANET (operator, 2026-09-02): "New Planet restarts the same
  // planet. it should be another planet. a bigger one, different topology."
  // The final verdict's button called regenerate(), which keeps the seed —
  // the same world, re-rolled. A new planet is a new SEED (topology) and
  // more of it (size): sample points up ~18% and two more rooms per planet
  // cleared, capped where the draw-call budget says stop. The planet count
  // is what the run already persists.
  const PLANET_GROWTH = 1.18, PLANET_POINTS_CAP = 900, PLANET_ROOMS_CAP = 28;
  params.newPlanet = () => {
    params.seed = randomSeed() % 100000;
    params.points = Math.min(PLANET_POINTS_CAP, Math.round(params.points * PLANET_GROWTH));
    params.rooms = Math.min(PLANET_ROOMS_CAP, params.rooms + 2);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    regenerate();
    console.log(`NEWPLANET seed=${params.seed} points=${params.points} rooms=${params.rooms}`);
  };


  // swap the whole visual identity in place: backgrounds, light rig, then
  // rebake vertex palettes and actor tints (game state untouched)
  function applyLook() {
    const L = look();
    mainBg.setHex(L.bg);
    mapBg.setHex(L.mapBg);
    hemi.color.setHex(L.hemi[0]);
    hemi.groundColor.setHex(L.hemi[1]);
    hemi.intensity = L.hemi[2];
    sun.color.setHex(L.sun[0]);
    sun.intensity = L.sun[1];
    fill.color.setHex(L.fill[0]);
    fill.intensity = L.fill[1];
    buildGeometry();
    buildActors();
    spawnOrbs(); // orbs bake look colors at spawn
    spawnEnemies();
    spawnRewards();
    placeActors();
  }


  // --- enemies: easy AI, they only wander ----------------------------------
  function clearEnemies() {
    for (const e of enemies) {
      scene.remove(e.obj);
      // traverse, not e.obj.geometry: a non-rammable enemy carries a solid
      // core as a CHILD, and disposing only the root leaks it every wipe
      disposeObj(e.obj);
    }
    enemies.length = 0;
  }

  // hop distance from the player spawn over open cells (enemy placement)
  function bfsDistFromSpawn() {
    const dist = new Int32Array(dungeon.tags.length).fill(-1);
    const queue = [dungeon.spawn];
    dist[dungeon.spawn] = 0;
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      for (const nb of graph.adj[cur]) {
        if (dist[nb] !== -1 || dungeon.tags[nb] === BLOCKED) continue;
        dist[nb] = dist[cur] + 1;
        queue.push(nb);
      }
    }
    return dist;
  }

  function spawnEnemies() {
    // battle reset — clear all enemies and gates, then seed the starting
    // neutral portals; the wave plan decides what pours out of them
    clearEnemies();
    spawnQueue.length = 0; spawnClock = 0;
    for (const sp of spawnPoints) {
      scene.remove(sp.obj);
      disposeObj(sp.obj);
      if (sp.mapMarker) { scene.remove(sp.mapMarker); disposeObj(sp.mapMarker); }
    }
    spawnPoints.length = 0;
    wave = 0;
    waveActive = false; waveAge = 0; interClock = params.waveGap * 0.5;
    portalDist = null;
    clearTimeout(waveTimer);
    waveEl.classList.add('hidden');
    seenTypes.clear();
    seedPortals(2);
    // a new game means a new magazine: leftovers do not survive regenerate
    strike.reserved = 0; strike.ready = 0; strike.gauge = 0;
    strike.armed = false; strike.target = -1; strike.falling = -1;
    if (!missionOn) grantStrikes(strike, spawnPoints.filter((sp2) => sp2.alive).length, strikeTune);
  }

  // cheap hop estimate for spreading spawn points (chord distance in cells)
  function hopEstimate(a, b) {
    return dist3(graph.centers[a], graph.centers[b]) / cellSide;
  }

  // a sector's gates are spatial sources, not type-bound — place one far
  // from the heart, spread from existing gates; 3 hits to destroy
  function addSpawnPoint(atCi = -1) {
    let maxD = 0;
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] !== BLOCKED) maxD = Math.max(maxD, dungeon.distToHeart[i]);
    }
    let best = -1, bs = -1;
    for (let ci = 0; ci < dungeon.tags.length; ci++) {
      if (dungeon.tags[ci] === BLOCKED || dungeon.distToHeart[ci] < maxD * 0.55) continue;
      if (spawnPoints.some((s) => s.ci === ci)) continue;
      let s = dungeon.distToHeart[ci];
      for (const other of spawnPoints) s += Math.min(20, hopEstimate(ci, other.ci));
      if (s > bs) { bs = s; best = ci; }
    }
    if (best === -1) best = dungeon.spawn;
    // the director raises gates WHERE the shot wants them (a dual portal)
    if (atCi >= 0 && dungeon.tags[atCi] !== BLOCKED && !spawnPoints.some((s) => s.ci === atCi)) best = atCi;
    // the source is a PORTAL, standing upright like a gate (local +Y =
    // surface normal); neutral tint — the wave plan decides what pours out
    const obj = buildPortalObj(best, whim() * 6.283);
    scene.add(obj);
    // minimap beacon — neutral blue, dark until the player FINDS the source
    const mapMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x9fdcff }));
    const mm = scale3(graph.centers[best], 1 + params.wallHeight * 1.6);
    mapMarker.position.set(mm[0], mm[1], mm[2]);
    mapMarker.visible = false;
    mapMarker.layers.set(MAP_LAYER);   // map only
    scene.add(mapMarker);
    spawnPoints.push({ ci: best, hp: 3, obj, alive: true, found: false, mapMarker });
    recomputePortalDist();
  }

  // a sector's gates are spatial sources, not type-bound — seed a small
  // fixed set; the wave plan decides what pours out of them
  function seedPortals(n) { for (let i = 0; i < n; i++) addSpawnPoint(); }

  // One place a gate dies, however it died — shells ground it down before,
  // and now a strike vaporises it whole. Both end here.
  // One place a gate dies, however it died. NOTHING on this board is immune —
  // walls breach, towers fall, the strike vaporises. A gate that shrugged off
  // three well-placed shells was the only exception, and it was mine, and it
  // was wrong (operator). Get close, put three in it, and it is down.
  // TWO POWER CORES PER HIT (operator). Eight pods, three hits: two go on the
  // first, two more on the second, and the third takes the whole gate — so a
  // player can read how close a gate is to falling by counting what is left
  // of it, without a health bar.
  const PODS_PER_HIT = 2;
  function popPods(sp, n) {
    const pods = sp.obj.userData.pods;
    if (!pods || !pods.length) return 0;
    let popped = 0;
    for (const pod of pods) {
      if (popped >= n) break;
      if (!pod.visible) continue;          // already gone
      pod.updateWorldMatrix(true, false);
      const wp = new THREE.Vector3();
      pod.getWorldPosition(wp);
      const nrm = norm3([wp.x, wp.y, wp.z]);
      // the pod's own wreckage, then a flash of its glow colour
      const fx = makeDebris(pod, nrm);
      scene.add(fx); debris.push(fx);
      const burst = makeDotBurst(0x8fe8ff, nrm, 26);
      burst.scale.setScalar(cellSide * 0.5);
      burst.position.copy(wp);
      scene.add(burst); debris.push(burst);
      pod.visible = false;
      popped++;
    }
    return popped;
  }

  // ONE DOOR for "a shell's worth landed on a gate", so the cannon and the
  // mine cannot drift apart. The operator's ruling on the mine is that it is
  // "as 1 shell" against a portal — which is only true if it goes through
  // exactly this function rather than through a second copy of it.
  function gateTakesShell(sp) {
    sp.found = true;          // a hit also marks the source on the scope
    sp.hp--;
    if (sp.hp <= 0) { killPortal(sp); return true; }
    // wounded: it loses two power cores, takes a shove, and its light dims —
    // a dying gate fades before it falls. The SHRINK is gone for a standing
    // ring: architecture does not get smaller when you shoot it, it loses
    // pieces.
    gateTakesHit(sp);
    if (!sp.obj.userData.grounded) {
      sp.obj.scale.setScalar(sp.obj.userData.sizeScale * (0.65 + 0.35 * (sp.hp / 3)));
    }
    if (sp.obj.userData.setDim) sp.obj.userData.setDim(0.2 + 0.8 * (sp.hp / 3));
    return false;
  }

  // WHAT A SHELL LANDING ON A GATE FEELS LIKE. It used to be a scale step and
  // a dim — a wounded gate got quieter, which is the opposite of heavy.
  const GATE_RECOIL = 0.22;   // seconds of shove, eased out by stepGates
  function gateTakesHit(sp) {
    const nrm = norm3(graph.centers[sp.ci]);
    sfx.play('blast_fire');            // the concussion
    whKick = WH_KICK;                 // ...and the throat lurches
    popPods(sp, PODS_PER_HIT);
    // a broad flash at the gate's mouth, over and above the pod bursts
    const burst = makeDotBurst(0xfff2c0, nrm, 70);
    burst.scale.setScalar(cellSide * 1.1);
    const bp = scale3(nrm, 1 + cellSide * 0.5);
    burst.position.set(bp[0], bp[1], bp[2]);
    scene.add(burst); debris.push(burst);
    // and the ring is SHOVED — a recoil the frame loop eases back out, so the
    // weight is in the motion rather than in a bigger particle count
    sp.recoil = GATE_RECOIL;
  }

  function killPortal(sp) {
    sp.alive = false;
    // THE GATE GOES LIKE THE TANK GOES (operator): its own wreckage, a big
    // burst in its own colour, and the heavy sound — the same three parts as
    // destroyPlayer, because that is the vocabulary the board already has for
    // "something substantial just ended".
    const nrm = norm3(graph.centers[sp.ci]);
    sfx.play('tank_destroyed');
    whKick = WH_KICK * 1.6;           // the throat convulses as it collapses
    if (sp.obj) {
      const fx = makeDebris(sp.obj, nrm);
      scene.add(fx); debris.push(fx);
      const burst = makeDotBurst(0x8fe8ff, nrm, 90);
      burst.scale.setScalar(cellSide * 1.6);
      const bp = scale3(nrm, 1 + cellSide * 0.6);
      burst.position.set(bp[0], bp[1], bp[2]);
      scene.add(burst); debris.push(burst);
    }
    scene.remove(sp.obj);
    disposeObj(sp.obj);
    if (sp.mapMarker) { scene.remove(sp.mapMarker); disposeObj(sp.mapMarker); }
    sp.mapMarker = null;
    recomputePortalDist();
  }

  // Arm the next wave: one entry point, so nothing can spawn unannounced.
  // Idempotent — a stalled field re-asks every frame and must not re-fire the
  // cue or reset the countdown it is already running.
  // First dangerous contact of the wave: klaxon + a CRT-red warning. Once
  // per wave BY DESIGN — a constant siren is the alarm you learn to ignore.
  const dangerEl = root.querySelector('#td-danger');
  let dangerTimer = null;
  function dangerFlash() {
    sfx.play('danger_alert');
    if (!dangerEl) return;
    dangerEl.classList.remove('hidden');
    clearTimeout(dangerTimer);
    dangerTimer = setTimeout(() => dangerEl.classList.add('hidden'), 1900);
  }

  function armWave() {
    // A RAID SENDS NOTHING. The brief names the threat as pre-placed groups;
    // a wave clock on top of that turns a puzzle back into the defence we
    // already have. The gates stand as scenery and as targets.
    if (rescue2On) return;
    if (waveIn >= 0) return;
    // THE SECTOR HAS A FIXED PROGRAMME. Once it is spent no more waves are
    // sent, whatever the clock thinks — the remaining gates are a mop-up,
    // not a siege, and a sector that kept sending waves forever would make
    // the wave count meaningless again.
    if (programmeDone()) return;
    hideSitrep(); // the telegraph outranks the recap
    showBrief('motive');   // why they come, as the first one is dialled
    waveIn = WAVE_WARN;
    warnBeat = 0;
    waveCharge = 0;
    // one cue, at the nearest opening gate, so it carries a distance and two
    // gates do not announce twice
    let near = Infinity;
    for (const sp of spawnPoints) {
      if (sp.alive) near = Math.min(near, camDist(graph.centers[sp.ci]));
    }
    if (near < Infinity) sfx.play('portal_warn', { dist: near });
  }

  function spawnWave() {
    waveIn = -1;
    resetWaveStats();
    // the release — a wide, brief ring from every gate that is opening
    for (const sp of spawnPoints) {
      if (sp.alive) warnRing(sp.ci, CREATURE_TINTS[sp.type] ?? 0xffffff, 0.75, cellSide * 5.5);
      if (sp.alive) {
        sp.obj.scale.setScalar(sp.obj.userData.sizeScale ?? 1);
        if (sp.obj.userData.setDim) sp.obj.userData.setDim(1);
      }
    }
    waveCharge = 0;
    warnBeat = 0;
    wave++;
    record('wave.start', { wave, sector: round, biomass: eco.biomass });
    shieldWaveReset(shield, shieldTune);   // the heart pad refills each wave
    waveActive = true; waveAge = 0;
    tfMilestone(wave);   // the Terraformer keeps time in waves
    const plan = rescueOn ? rescueWavePlan(wave)
      : computeWavePlan(wave, round, params.waveSize, lab.on ? lab.waveMult : 1);
    // NEW THREAT reveal the first time a headline type appears
    if (!seenTypes.has(plan.headline)) {
      seenTypes.add(plan.headline);
      const intro = INTROS.find((iv) => iv.type === plan.headline);
      if (intro) announceWave(intro);
    }
    // one new tower unlocks per wave through wave 8
    if (wave >= 1 && wave <= TOWER_ORDER.length) showTowerToast(TOWER_ORDER[wave - 1]);
    const live = spawnPoints.filter((s) => s.alive);
    if (live.length) {
      const total = plan.entries.reduce((n, e) => n + e.count, 0);
      const gap = Math.min(SPAWN_GAP_MAX, SPAWN_SPREAD / Math.max(1, total));
      spawnQueue.length = 0;
      spawnClock = 0;
      let pi = 0, n = 0;
      for (const { type, count } of plan.entries) {
        for (let k = 0; k < count; k++) {
          spawnQueue.push({ type, sp: live[pi % live.length], at: n * gap });
          pi++; n++;
        }
      }
      // the FIRST one is already through, so a wave never opens on an empty
      // field while the clock counts
      releaseSpawns(0);
    }
    updateHud();
  }

  // THE MISSION'S OWN CURVE: mostly rammable, with a small growing hard
  // core — the brief's "lots of rammable enemies and just a handful of more
  // difficult one to manage". The types come off the `rammable` flag rather
  // than a second hand-written list: the colour already carries that read and
  // a test already enforces it, so a new enemy joins the right half of the
  // mission the day it is added.
  function rescueWavePlan(w) {
    // SHELVED units are excluded here too. The mission draws its roster from
    // the flags rather than a hand list precisely so a new enemy joins it
    // automatically — which means a shelved one would join it automatically
    // as well, and be "not in the game" everywhere except the two missions.
    const kinds = Object.keys(ENEMY_SPEC).filter((k) => !ENEMY_SPEC[k].shelved);
    const soft = kinds.filter((k) => ENEMY_SPEC[k].rammable);
    const hard = kinds.filter((k) => !ENEMY_SPEC[k].rammable);
    const mix = waveMix(w);
    const pick = (list, i) => (list.length ? list[i % list.length] : kinds[0]);
    const st = pick(soft, w - 1), ht = pick(hard, Math.floor((w - 1) / 2));
    const entries = [];
    if (mix.soft > 0) entries.push({ type: st, count: mix.soft });
    if (mix.hard > 0) entries.push({ type: ht, count: mix.hard });
    return { entries, headline: mix.hard > 0 ? ht : st };
  }

  function releaseSpawns(dtSeconds) {
    spawnClock += dtSeconds;
    while (spawnQueue.length && spawnQueue[0].at <= spawnClock) {
      const { type, sp } = spawnQueue.shift();
      if (!sp.alive) continue;   // its gate died while it was queued
      const spec = ENEMY_SPEC[type];
      const obj = makeDotEnemy(type, { walker: CREATURE_TINTS[type], walkerHi: accentFor(type) });
      const size = spec.size * 0.7;
      const scale0 = cellSide * size;
      obj.scale.setScalar(scale0); obj.userData.s0 = scale0;
      scene.add(obj);
      const exits = openNeighbors(sp.ci);
      enemies.push({
        type, spec, scale0, size,
        cur: sp.ci, prev: -1,
        next: exits.length ? exits[Math.floor(whim() * exits.length)] : sp.ci,
        prog: whim() * 0.4, pos: graph.centers[sp.ci].slice(), dir: [0, 1, 0],
        obj, alive: true, phase: whim() * 6.283,
        // a deterministic pace of its own: identical speeds are what let a
        // clump that chose the same exit stay one silhouette all the way in
        paceJitter: 0.9 + whim() * 0.22,
        hp: spec.hp, behMult: 1, behUntil: -1, touchCd: -1,
        slowFactor: 1, slowUntil: -1,
      });
    }
  }

  // THE WAVE ARRIVES, IT DOES NOT APPEAR. Every enemy in a wave used to be
  // created in one frame, all of them standing on the two portal cells with
  // the same speed — so four phage on two portals read as TWO contacts, and
  // twenty-six read as two blobs. The towers shot at things nobody could
  // see, because the things were inside each other. (Measured: wave 3,
  // 26 alive, distinctCells=2.)
  //
  // Two fixes, and both are needed. The queue staggers WHEN they come
  // through, so a wave walks out of a gate instead of materialising; the
  // pace jitter stops a group that picks the same exit from travelling as
  // one perfectly superimposed silhouette forever after.
  const spawnQueue = [];
  let spawnClock = 0;
  const SPAWN_SPREAD = 3.2;   // seconds a whole wave takes to come through
  const SPAWN_GAP_MAX = 0.45; // ...but never slower than this per contact

  const ENEMY_SPEED = 1.0; // cells/s toward the Heart — FASTER still
  function updateEnemies(dt, tNow) {
    releaseSpawns(dt);
    for (const e of enemies) {
      if (!e.alive) continue;
      const spec = e.spec;
      // HK healOOC: regenerators knit themselves back together while
      // nothing has hit them for 1.2 s — burst them down or ram them
      if (spec.regen && e.hp < spec.hp && tNow - (e.lastHitT ?? -9) > 1.2) {
        e.hp = Math.min(spec.hp, e.hp + spec.regen * dt);
        const sv = e.scale0 * (0.7 + 0.3 * e.hp / spec.hp);
        e.obj.scale.setScalar(sv * (e.dirScale || 1));   // the director may enlarge a type (a boss, for a shot)
        e.obj.userData.s0 = sv;
      }
      let pace = ENEMY_SPEED * spec.speed * (e.paceJitter ?? 1);
      // A GARRISON HOLDS ITS CAMP until the tank comes to it. A camp you have
      // not reached should not be walking across the map at you — that is
      // what makes them camps and not a wave. Once up, it stays up.
      if (e.campId) {
        const camp = campById(e.campId);
        if (camp && !campAwake(camp, player.pos, cellSide, rescue2Tune)) pace = 0;
      }
      if (tNow < e.behUntil) pace *= e.behMult; // on-hit reaction window
      if (tNow < e.slowUntil) pace *= e.slowFactor; // slow-tower debuff
      // the slow READS for its full duration: the whole cloud tints ice —
      // and so does the solid core, or a slowed drifter would show a frozen
      // cloud around a body still in its own colour
      const slowed = tNow < e.slowUntil;
      // white clears the tint on the CLOUD (vertexColors multiply), but a
      // solid has to be restored to the colour it was built with
      // A MESH-BODIED ENEMY MAY NOT HAVE A `.color`. Every hostile was a dot
      // cloud or a lambert solid when this was written, so it reached straight
      // through the material — and the jelly's ShaderMaterial has no such
      // property, so the first boss to arrive threw once per frame. Units that
      // know how to be tinted say so; the rest keep the old path, guarded.
      if (e.obj.userData.setTint) e.obj.userData.setTint(slowed ? 0x8fd4ff : null);
      else if (e.obj.material && e.obj.material.color) {
        e.obj.material.color.setHex(slowed ? 0x8fd4ff : 0xffffff);
      }
      const solid = e.obj.userData.solid;
      if (solid && solid.material) {
        solid.material.color.setHex(slowed ? 0x8fd4ff : (solid.userData.baseColor ?? 0xffffff));
      }
      // erratic (phage): HokorobiTawaa velocity bursts, 0.7×–1.3×
      if (spec.erratic) pace *= 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(tNow * 3.1 + e.phase * 7));
      // jink (saucer): a second, faster weave stacked on the bursts —
      // 0.55×–1.45× at 6.3 rad/s reads as a dogfight, not a walk
      if (spec.jink) pace *= 0.55 + 0.9 * (0.5 + 0.5 * Math.sin(tNow * 6.3 + e.phase * 11));
      // tactician (shellback): holds at the EDGE of tower coverage until
      // enough minions arrive to soak fire, then bursts through with them.
      // Re-evaluated at 2 Hz, staggered by phase — towers are few, and a
      // per-frame sweep would be spent on a decision that changes slowly.
      if (spec.tactician) {
        if (tNow >= (e.tacUntil ?? 0)) {
          e.tacUntil = tNow + 0.5 + e.phase * 0.1;
          let covered = false;
          for (const tw of towers) {
            const r = effectiveStats(tw.def, tw.tier).range * cellSide;
            if (chord(graph.centers[tw.ci], e.pos) < r + cellSide * 1.2) { covered = true; break; }
          }
          if (!covered) e.tacMult = 1;
          else {
            let cover = 0;
            for (const e2 of enemies) {
              if (e2.alive && e2 !== e && dist3(e2.pos, e.pos) < cellSide * 2.4) cover++;
            }
            e.tacMult = cover >= 3 ? 1.9 : 0.3; // burst with the pack, or wait
          }
        }
        pace *= e.tacMult ?? 1;
      }
      // STAGGERED: it stands where it was thrown. Zeroing `pace` and not
      // `e.prog` is deliberate — the path is untouched, so when it recovers it
      // carries on from exactly where it was rather than restarting a cell.
      if (tNow < (e.stagUntil ?? -1)) pace = 0;
      // cloaked (phantom): optical camo. A haze most of the time — the
      // cloud sits near-invisible — with a brief shimmer of presence every
      // ~6s. The radar shares the same decloak window: no window, no blip.
      if (spec.cloaked) {
        const vis = ((tNow * 0.16 + e.phase) % 1) < 0.12;
        const op = vis ? 0.55 : 0.14 + 0.05 * Math.sin(tNow * 2.7 + e.phase * 9);
        if (e.obj.material) e.obj.material.opacity = op;
        const core = e.obj.userData.solid;
        if (core && core.material) {
          core.material.transparent = true;
          core.material.opacity = Math.min(1, op * 1.6); // the glint lags the fade
        }
        e.decloaked = vis;
      }
      e.prog += pace * dt;
      while (e.prog >= 1) {
        e.prog -= 1;
        e.prev = e.cur;
        e.cur = e.next;
        // heart-seeking: drawn HARD toward the heart — only a sliver of
        // wobble left so the streams braid but visibly converge
        const exits = openNeighbors(e.cur);
        // RESCUE: a survivor standing in the lane pulls the horde off it.
        // A short LOCAL override of the heart-seeking choice, deliberately
        // not a second BFS field — the stranded stand in the flow the horde
        // is already walking, which is the whole reason they are placed there.
        let pool = null;
        const lk = lockedSurvivor(e.pos);
        if (lk) {
          const here = dist3(graph.centers[e.cur], lk.pos);
          const toward = exits.filter((c) => dist3(graph.centers[c], lk.pos) < here);
          if (toward.length) pool = toward;
        }
        // ...and an awake garrison hunts the TANK, not the heart: it is
        // guarding a container, and the thing that came for the container is
        // the thing it walks at.
        if (!pool && e.campId && player.pos) {
          const here = dist3(graph.centers[e.cur], player.pos);
          const toward = exits.filter((c) => dist3(graph.centers[c], player.pos) < here);
          if (toward.length) pool = toward;
        }
        if (!pool) {
          const down = exits.filter((c) => dungeon.distToHeart[c] < dungeon.distToHeart[e.cur]);
          pool = (down.length && whim() > 0.05) ? down : exits;
        }
        e.next = pool.length ? pool[Math.floor(whim() * pool.length)] : e.cur;
      }
      const a = graph.centers[e.cur];
      const b = graph.centers[e.next];
      const f = Math.min(e.prog, 1);
      e.pos = norm3([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
      // THE SHOVE IS AN OFFSET, NOT A MOVE. e.pos is rebuilt from the cell
      // path every frame, so writing a displaced position lasts exactly one
      // tick — the trap ?a6ram=1 already exists to document. Applied HERE,
      // after the interpolation and re-normalised onto the sphere, it decays
      // and the body slides back into its own lane.
      if (e.shove) {
        e.shove.t -= dt;
        if (e.shove.t <= 0) e.shove = null;
        else {
          const off = shoveMag(e.shove, shieldTune) * cellSide;
          e.pos = norm3(add3(e.pos, scale3(e.shove.dir, off)));
        }
      }
      const n = e.pos;
      const raw = sub3(b, e.pos);
      const flat = sub3(raw, scale3(n, dot3(raw, n)));
      const l = Math.hypot(flat[0], flat[1], flat[2]);
      if (l > 1e-9) e.dir = scale3(flat, 1 / l);
      const s = cellSide * (e.size ?? spec.size);
      const lift = s * (e.obj.userData.lift ?? 0.85);
      e.obj.position.set(e.pos[0] + n[0] * lift, e.pos[1] + n[1] * lift, e.pos[2] + n[2] * lift);
      tmpObj.position.copy(e.obj.position);
      tmpObj.up.set(n[0], n[1], n[2]);
      tmpObj.lookAt(e.obj.position.x + e.dir[0], e.obj.position.y + e.dir[1], e.obj.position.z + e.dir[2]);
      e.obj.quaternion.copy(tmpObj.quaternion);
      if (e.obj.userData.tick) e.obj.userData.tick(tNow + e.phase);

      // the Heart: contact costs heartDmg and consumes the creature
      if (dist3(e.pos, graph.centers[dungeon.heart]) < cellSide * 0.75) {
        killCreature(e);
        heartHit(spec.heartDmg);
        continue;
      }
      // the player's tank is strong: fodder dies under the treads for
      // free; the dangerous tier hurts to touch and shrugs the ram off
      // (per-enemy cooldown so overlap isn't a blender)
      const touchR = cellSide * Math.max(0.4, (e.size ?? spec.size) * 0.8);
      // a unit that HURTS to touch is closing in: warn, once per wave
      if (!playerDown && !spec.rammable && dangerWarnedWave !== wave
          && dist3(e.pos, player.pos) < cellSide * 3.5) {
        dangerWarnedWave = wave;
        dangerFlash();
      }
      // A WALKER IS IN THE FIGHT, so the fight can reach it. Only the
      // dangerous tier does anything — the fodder the A6 refuses to shoot at
      // cannot hurt it either, which is the same asymmetry the tank lives
      // under and the reason the A6's own targeting rule is not a free pass.
      if (!spec.rammable) {
        for (const tw of towers) {
          if (!tw.a6 || tw.hp <= 0) continue;
          if (dist3(e.pos, tw.a6.pos) > touchR + cellSide * 0.3) continue;
          if (tNow <= (e.a6Cd ?? -1)) continue;
          e.a6Cd = tNow + 1.2;
          tw.hp -= 1;
          const bn = norm3(tw.a6.pos);
          const spark = makeDotBurst(0xff7744, bn, 14);
          spark.scale.setScalar(cellSide * 0.5);
          spark.position.set(tw.a6.pos[0], tw.a6.pos[1], tw.a6.pos[2]);
          scene.add(spark); debris.push(spark);
          if (tw.hp <= 0) killWalker(tw);
        }
      }
      if (!playerDown && dist3(e.pos, player.pos) < touchR) {
        if (spec.rammable) {
          // run over: tinted splat under the treads + the weight bump
          const burst = makeDotBurst(CREATURE_TINTS[e.type], n);
          burst.scale.setScalar(cellSide * 0.8);
          const bp = add3(e.pos, scale3(n, cellSide * 0.12));
          burst.position.set(bp[0], bp[1], bp[2]);
          scene.add(burst);
          debris.push(burst);
          bumpLeft = BUMP_LEN;
          eco.award(spec.bounty, { ram: true }); // the ram premium
          scoreKill(spec.bounty, { src: 'tank', ram: true,
            alive: enemies.filter((x) => x.alive).length });
          ramCombo++; ramComboT = RAM_COMBO_GAP;
          noteWaveKill(e.type, 'tank');
          if (ws) ws.rams++;
          if (rs) { rs.rams++; rs.maxCombo = Math.max(rs.maxCombo, ramCombo); }
          syncCombo();
          if (ramCombo >= 10 && ramCombo % 10 === 0) {
            showCallout(`RAM ×${ramCombo}`, 'co-milestone');
          }
          noteStreak();
          harvestTankKill(spec);
          killCreature(e, true);
          checkVictory();
          continue;
        }
        if (shieldUp()) {
          // PUSHED ASIDE, NOT DESTROYED. No damage either way and no shield
          // time spent: the bubble is mobility, never a weapon. A shielded
          // tank that killed the hard tier would make `rammable` stop being
          // the read the whole board is built on, and that read is worth
          // more than the damage would be.
          if (tNow > e.touchCd) {
            e.touchCd = tNow + 0.4;
            e.shove = { dir: shoveVec(e.pos, player.pos, player.heading), t: shieldTune.shoveLife };
            e.stagUntil = tNow + shieldTune.shoveStun;
            playerHit(e.type, e.pos);   // the ripple and the hull bump, no HP
            if (shieldProbeOn) {
              console.log(`SHIELDPROBE shove ${e.type} stun=${shieldTune.shoveStun} combo=${ramCombo}`);
            }
          }
          continue;   // NOT a ram: pays nothing, scores nothing, combo untouched
        }
        if (tNow > e.touchCd) { e.touchCd = tNow + 1.2; playerHit(e.type, e.pos); }
      }
    }
  }

  function killCreature(e, fx = false) {
    e.alive = false;
    // gated on fx: killCreature is ALSO called with fx=false to tear the
    // board down (tutorial clear, wave reset, regenerate). Ungated, a
    // regenerate would fire a death-sound storm.
    if (fx) {
      sfx.play(DEATH_KEYS[Math.floor(deathPick() * DEATH_KEYS.length) % DEATH_KEYS.length],
        { dist: camDist(e.pos) });
    }
    // mesh enemies blow apart; dot-clouds burst into tinted dots
    if (fx && e.obj.userData.kind === 'mesh') {
      const d = makeDebris(e.obj, norm3(e.pos));
      scene.add(d);
      debris.push(d);
    } else if (fx) {
      const d = makeDotBurst(CREATURE_TINTS[e.type] ?? 0xffffff, norm3(e.pos), 24);
      d.scale.setScalar(cellSide * 0.6);
      const dp = add3(e.pos, scale3(norm3(e.pos), cellSide * 0.15));
      d.position.set(dp[0], dp[1], dp[2]);
      scene.add(d);
      debris.push(d);
    }
    scene.remove(e.obj);
    disposeObj(e.obj);
    updateHud();
  }

  // damage an enemy: shrink-step so it reads, kill at zero. Shells (dmg 1,
  // react) trigger the borrowed on-hit reactions; laser ticks (dmg 0.4,
  // react=false) don't — a constant graze must not keep barbed/knot
  // permanently accelerated. Returns true on kill.
  // `src` decides the pay. The base bounty is HALVED and a tank kill pays
  // double the new base (i.e. the old full bounty): towers earn passively,
  // so passive income is what got cheaper — getting close is what pays now.
  // Rams keep their premium on top; the orbital strike pays base, because
  // nothing about it is close.
  // A MINE PAYS BETWEEN THE TWO. It is the player's own act — you drove
  // there, you spent the mine, you chose the chokepoint — but it is not
  // the hull going through them, which is what the full rate is for.
  const KILL_PAY = { tank: 1.0, tower: 0.5, strike: 0.5, mine: 0.75 };

  // --- field promotion ------------------------------------------------------
  // HUD badge only. The first cut ALSO floated a sprite over the hull —
  // directly in front of the camera in third person, blocking exactly the
  // thing the player steers toward. Operator ruling: same-size badge, up
  // top, next to the score it rides with.
  // v3: one hull per shallow container, three in a row. Container i holds
  // a spare while i < HP-1; the spawn commandeers container min(2, HP-1)
  // — the one whose hull just left.
  function syncLifeContainers() {
    if (lifeContainers.length < 3) return;
    const spares = Math.max(0, playerHP - 1);
    lifeContainers.forEach((cc, i) => {
      // a RACKED hull is a spare you have not used; a LIT NUMBER is a life
      // you still have, the one you are driving included. So berth 3 stands
      // empty from the first second and still reads 3 — which is what the
      // painted numerals are for (operator, 2026-08-31).
      const racked = i < spares;
      if (cc.tanks[0]) cc.tanks[0].visible = racked;
      cc.obj.userData.setStocked(racked, null);
      if (cc.obj.userData.setAlive) cc.obj.userData.setAlive(i < playerHP);
    });
  }

  // ISAO's line on the objectives row: what he is doing and how deep the
  // queue is. Silent when there is nothing on the book — a status line that
  // is always lit is a status line nobody reads.
  function isaoLine() {
    if (!orders.length) return '';
    const o = orders[0];
    const what = o.kind === 'upgrade' ? `${o.tower.def.label}+1` : TOWER_BY_KEY[o.key].label;
    const rest = orders.length > 1 ? ` +${orders.length - 1}` : '';
    // its OWN row, not an appendix to the objectives line: that line already
    // runs to the edge of the box on a phone, and an overflowing status is
    // a status nobody can read
    if (isao && isao.state === 'build') {
      const pct = Math.round(Math.min(1, isao.t / Math.max(0.001, isao.dur)) * 100);
      return `<div class="hud-obj hud-isao">ISAO &#9656; printing ${what} ${pct}%${rest}</div>`;
    }
    return `<div class="hud-obj hud-isao">ISAO &#9656; inbound ${what}${rest}</div>`;
  }
  function assistantLine() {
    if (!assistant) return '';
    const o = assistant.order;
    if (!o) return `<div class="hud-obj hud-isao">DRONE 2 &#9656; on shift</div>`;
    const what = o.kind === 'upgrade' ? `${o.tower.def.label}+1` : TOWER_BY_KEY[o.key].label;
    if (assistant.state === 'build') {
      const pct = Math.round(Math.min(1, assistant.t / Math.max(0.001, assistant.dur)) * 100);
      return `<div class="hud-obj hud-isao">DRONE 2 &#9656; printing ${what} ${pct}%</div>`;
    }
    return `<div class="hud-obj hud-isao">DRONE 2 &#9656; inbound ${what}</div>`;
  }

  const fmt = (v) => (v ?? 0).toLocaleString('en-US'); // 3103356 -> 3,103,356

  function refreshRankVisuals() {
    rankBadgeHud = tankRank > 0
      ? `<span class="hud-rank" title="${tankKills} hands-on kills`
        + `${tankEliteKills ? ` · ${tankEliteKills} elite` : ''}">`
        + `${badgeSVG(tankRank, 22)} ${rankLabel(tankRank)}</span>`
      : '';
    applyBeamRank();   // the insignia and the gun are the same readout
    updateHud();
  }
  function harvestTankKill(spec) {
    tankKills++;
    run.tankKills++;
    run.handsOnByType[spec.key || spec.type || ''] =
      (run.handsOnByType[spec.key || spec.type || ''] || 0) + 1;
    if (spec.boss) run.bossHandsOn = true;
    if (!spec.rammable) tankEliteKills++;
    const r = rankFor(tankKills, tankEliteKills);
    if (r !== tankRank) {
      tankRank = r;
      refreshRankVisuals();
      // A BEAM STEP IS A BIGGER EVENT THAN A PROMOTION and says so — four
      // of the fifteen ranks rearm the secondary, and a player who cannot
      // tell those apart learns the ladder is cosmetic.
      showToast(`<div class="wave-num">PROMOTED · ${rankLabel(r)}</div>`
        + (isBeamStep(r)
          ? `<div class="wave-role" style="color:${beamStep(r).color}">`
            + `SECONDARY REARMED · ${beamStep(r).name} · ${beamStep(r).reach} cells</div>`
          : `<div class="wave-role">${tankKills} hands-on kills</div>`),
        isBeamStep(r) ? 3000 : 2200);
    } else updateHud();
  }
  // A NEW RUN starts unranked — this is the ONLY caller left (loseTank used
  // to be the other one, and the pilot outliving the hull is what removed it).
  function resetTankRank() {
    if (!tankKills && !tankRank) return;
    tankKills = 0; tankEliteKills = 0; tankRank = 0;
    refreshRankVisuals();
  }
  function damageEnemy(e, tNow, dmg = 1, react = true, src = 'tower') {
    const spec = e.spec;
    if (react && spec.slowOnHit) { e.behMult = spec.slowOnHit; e.behUntil = tNow + 1.2; }
    if (react && spec.accelOnHit) { e.behMult = spec.accelOnHit; e.behUntil = tNow + 1.2; }
    e.lastHitT = tNow; // resets the regenerators' out-of-combat clock
    e.hp -= dmg;
    if (e.hp <= 0) {
      // any weapon's kill pays — but not the same
      eco.award(Math.max(1, Math.ceil(spec.bounty * (KILL_PAY[src] ?? 0.5))));
      scoreKill(spec.bounty, { src, alive: enemies.filter((x) => x.alive).length });
      noteWaveKill(e.type, src);
      noteKillContext(e, src);
      if (src === 'tank') harvestTankKill(spec);
      killCreature(e, true);
      return true;
    }
    const sv = e.scale0 * (0.7 + 0.3 * Math.max(0, e.hp) / spec.hp);
    e.obj.scale.setScalar(sv);
    e.obj.userData.s0 = sv;
    return false;
  }

  // --- twin mini-lasers: hold-to-fire, they overheat -----------------------
  // Trigger: hold Shift (or the secondary fire button). Fire builds heat;
  // at the cap the guns lock out until fully cooled — the gun tubes glow
  // from cyan to red as the diegetic gauge. Bolt origin/direction derive
  // from the gun groups' WORLD transforms (toe-in included) — same-source
  // rule, third use. No wall carving, no spawn-point damage, no on-hit
  // reactions: shells stay the answer to everything that matters.
  const laserShots = []; // { pos, dir, dist, mesh }
  let laserClock = 0, laserSide = 0;
  let laserHeat = 0, laserOverheat = false;

  // --- the twin beams -----------------------------------------------------
  // ONE PLACE for the preset, so a tuning session in the beam tab drops in as
  // a paste rather than a hunt. Widths are expressed in CELLS and multiplied
  // by cellSide at use: the lab tunes against a 1-unit tank, the board runs a
  // tank about 0.85 of a cell wide, and a width copied across raw is either
  // invisible or swallows the screen.
  // The preset and the peak both live in beamdraw.js now, so a tuning session
  // in the lab lands in ONE file rather than in two that must be kept in
  // agreement by hand.
  const BEAM_PRESET = { ...BOARD_PRESET };
  // THE SWEEP (operator, 2026-09-01). Across the six seconds the toe-in runs
  // 0 -> BEAM_SWEEP -> 0, so the pair opens parallel, scissors inward through
  // the midpoint and opens again: the beams sweep the ground in front instead
  // of burning one fixed line. Damage follows for free, because it is
  // measured against the same swept direction the beam is drawn along.
  //
  // Radians. Started at 0.4 (~23 degrees each side) from the operator's
  // "0 to 4 to 0"; played, that was a wider scissor than the weapon wants —
  // the beams spent the burst pointing away from what was in front of them.
  // 0.2 rad (~11 degrees each side) keeps the traverse legible while the pair
  // stays on target. This is the one number to move.
  const BEAM_SWEEP = 0.20;
  // THE SWEEP IS A MOTOR UNDER LOAD (operator, 2026-09-01). Mass in the beam
  // slows its traverse — per beam, independently — so the pair falls out of
  // step and the tank visibly labours through a crowd. This is the inverse of
  // knock-back: nothing is pushed, something is HELD.
  //
  // The drag is keyed to the tier the whole board already reads by colour:
  // soft rammable things barely slow it, a solid core bogs it hard. So a beam
  // lagging its twin is a DANGER READOUT — the weapon's own motion saying
  // "there is something in here you should not ram", a third channel beside
  // the belt colour and the DO-NOT-RAM badge.
  // DRAG_SOFT / DRAG_HARD / DRAG_CAP are imported from beamburn.js now. The
  // rule moved out whole so the beam lab can show the drop-off without
  // restating it — two copies of this would drift the first time either is
  // tuned, and the lab exists precisely to tune it.
  // ...and the same idea along the OTHER axis: every body burned eats into
  // the reach that is left, so the beam shortens as it struggles through.
  // In cells, against a 2.6-cell reach: fodder is nearly free, three solid
  // cores stop it dead.
  // ...and they are FRACTIONS of the reach now, because the reach is no
  // longer a constant: it climbs with the pilot's rank (beamranks.js). Held
  // as absolute cells, "three solid cores stop it dead" would quietly stop
  // being true the moment a rank-15 beam ran to 10 cells.
  const PEN_SOFT = () => LASER_REACH * PEN_SOFT_FRAC;
  const PEN_HARD = () => LASER_REACH * PEN_HARD_FRAC;
  // A BOGGED BEAM FALLS BEHIND AND STAYS BEHIND. It does not catch up at the
  // end of the burst — that would hide the cost, which is the point of it.
  const beamPhase = [0, 0];
  let beamHitWall = false;   // did either beam clip on rock this frame?
  const CELL_WIDTH_KEYS = ['coreWidth', 'glowWidth', 'jitterAmount'];
  // `beams` is taken by the tower/slow-tether fx pool — these are the tank's
  // Both are views ONTO the rig (beamdraw.js), kept as names because the
  // probes walk them: ?beamfire=1 reads the live glow colour off tankBeams[0]
  // and ?arcprobe walks every plume dot for altitude.
  let tankBeams = null, plasma = null;
  let beamOn = false, beamVoice = null;

  // --- THE PLASMA (operator, 2026-09-02) ----------------------------------
  // "the beam extends in the air, and for game play we should have hug the
  // curvature of the planet, more like plasma flamethrower than pure laser."
  //
  // The anatomy, the meshes and the per-frame update all live in beamdraw.js
  // now. That move is what lets the beam LAB draw this same weapon instead of
  // two straight ribbons on a flat floor — a tuning surface showing a
  // different weapon than the game is worse than none, and this project has
  // already paid for that once with a preset tuned under tone mapping the
  // game did not have.
  //
  // PLASMA is a LIVE object: the GUI mutates it and the rig reads it every
  // frame, so the knobs stay knobs.
  const PLASMA = { ...PLASMA_DEFAULTS };

  let beamRig = null;
  function ensureBeams() {
    if (beamRig) return beamRig;
    beamRig = createBeamRig({
      scene, guns: 2, preset: BEAM_PRESET, plasma: PLASMA,
      seed: (params.seed ^ 0x91a5be) >>> 0,
      widthKeys: CELL_WIDTH_KEYS,
    });
    // tankBeams is what ?beamfire=1 reads the live colour off, and index 0 is
    // still gun 0's first link; plasma is what ?arcprobe walks for altitude
    tankBeams = beamRig.beams;
    plasma = beamRig.plumes;
    applyBeamRank();   // a fresh rig must not be born the base colour
    return beamRig;
  }

  // The colour is written to the LIVE uniform rather than baked into
  // BEAM_PRESET at construction, so a promotion that lands mid-burst
  // recolours the beam already in the air — which is the whole point of
  // putting the readout on the weapon instead of in the corner.
  let beamStepNow = beamStep(0);
  function applyBeamRank() {
    beamStepNow = beamStep(tankRank);
    LASER_DPS = beamStepNow.dps;
    LASER_REACH = beamStepNow.reach;
    if (beamRig) beamRig.setColor(beamStepNow.color);
    applyReachToe();
  }

  // THE TOE SCALES WITH REACH (operator, 2026-09-02: "the toe-in should scale
  // with reach so they always cross").
  //
  // A fixed angle cannot be right across a 2.5x reach ladder: the apex sits
  // at gap/(2·tan(toe)), so the shipped 0.035 rad put it about 9.5 cells out
  // — past a rank-1 beam's whole four cells, and well inside a rank-15 one.
  // Solve for the angle instead, from the muzzle gap MEASURED off the model
  // rather than assumed, so a new tank does not silently break it.
  const TOE_CROSS_FRAC = 0.7;   // they meet at 70% of the reach: out in front,
                                // but comfortably before the tip
  const toeA = new THREE.Vector3(), toeB = new THREE.Vector3();
  function applyReachToe() {
    const guns = playerMesh && playerMesh.userData && playerMesh.userData.laserGuns;
    if (!guns || guns.length < 2 || !playerMesh) return;
    // ZERO THE TOE BEFORE MEASURING. The gap is read off the live world
    // transforms, and those already carry whatever toe was applied last — so
    // measuring without resetting feeds the previous answer back in and the
    // angle walks every time the rank changes.
    applySecondaryToe(playerMesh, 0);
    playerMesh.updateMatrixWorld(true);
    guns[0].getWorldPosition(toeA);
    guns[1].getWorldPosition(toeB);
    const gap = toeA.distanceTo(toeB) / cellSide;          // cells
    const toe = toeForCrossing(gap, TOE_CROSS_FRAC * LASER_REACH);
    applySecondaryToe(playerMesh, toe || SECONDARY_TOE);
    playerMesh.updateMatrixWorld(true);
    lastToe = { gap, toe: toe || SECONDARY_TOE, at: crossingForToe(gap, toe || SECONDARY_TOE) };
  }
  let lastToe = null;

  function drawBeam(i, from, dir, len, heatFrac, lift) {
    ensureBeams().draw(i, {
      from, dir, len, heat: heatFrac,
      lift: lift ?? (1 + params.wallHeight * 0.5),
      scale: cellSide, time: runContext.time, peak: BEAM_PEAK,
    });
  }

  function hideBeams() {
    if (beamRig) beamRig.hide();
  }

  const laserBtnEl = root.querySelector('#td-pad-laser');
  let laserBtnBand = -1, laserDrainPct = -1;
  // THE SECONDARY IS A BEAM (operator, 2026-09-01). Twin sustained beams out
  // of the secondary muzzles, running straight down each barrel and passing
  // THROUGH everything they touch.
  //
  // 6 seconds is not a feel number: the burst is exactly as long as
  // assets/audio/tank_beam.mp3, so the sound and the fire begin and end
  // together. Change one and the other has to move.
  const LASER_MAX_HEAT = 6.0; // s of fire — the length of the sound
  // COOLDOWN DURATION IS UNCHANGED. It was MAX_HEAT / COOL = 2.4 / 1.4 ≈
  // 1.71 s, and the operator asked for the same cooldown, so the shed rate
  // rises with the budget instead of the lockout stretching to 4.3 s.
  // LOCKOUT 1.71s -> 4.5s (operator, 2026-09-02: "longer delay between
  // plasma gun uses"). The burst stays the length of the sound; what grew is
  // the wait after it. One constant, so the ?beamfire probe reads it rather
  // than a second copy of the number.
  const LASER_LOCKOUT = 4.5;
  const LASER_COOL = LASER_MAX_HEAT / LASER_LOCKOUT;
  // Damage is SUSTAINED, not per bolt. The old bolt stream was about 2.86/s
  // into ONE target. This is well under it (operator: currently overpowered)
  // and the multi-target advantage is now paid for twice — the sweep bogs,
  // and the reach chokes. A beam that reaches three bodies is working hard
  // for them.
  // BOTH ARE THE PILOT'S RANK NOW (operator, 2026-09-02) — see beamranks.js
  // for the four steps and for why penetration had to become a fraction. They
  // are seeded at the rank-1 step and rewritten by applyBeamRank(); `let`
  // rather than `const` is the honest shape for a value the ladder moves.
  let LASER_DPS = beamStep(0).dps;
  let LASER_REACH = beamStep(0).reach;   // cells
  // Bolts were BoxGeometry — literally blocky (operator ruling). They are
  // round tracers now, the same idiom every tower shot speaks: a hot head
  // with three ghosts strung behind it along the flight line.
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const gunColCool = new THREE.Color(0x7df9ff);
  const gunColHot = new THREE.Color(0xff5340);
  const gunEmiCool = new THREE.Color(0x06262c);
  const gunEmiHot = new THREE.Color(0xff2200);

  function killLaser(i) {
    scene.remove(laserShots[i].mesh);
    laserShots[i].mesh.geometry.dispose(); // per-bolt tracer geometry now
    laserShots[i].mesh.material.dispose();
    laserShots.splice(i, 1);
  }

  function updateLasers(dt, tNow) {
    const guns = playerMesh && playerMesh.userData.laserGuns;
    // auto holds the SAME trigger the player does, so there is one firing
    // path, one heat model and one overheat lockout — not a parallel copy
    // THE RESCUE HULL IS A TRANSPORT. The beams cost heat, not ammo, so
    // with them fitted "limited shells" means nothing at all and the mission
    // is a driving exercise. One clause, one knob (`?lasers=1` refits them).
    const wantFire = (keys.laser || autoLaserWant) && guns
      && !player.won && !playerDown
      && (!missionOn || rescueTune.lasers);
    // heat: build while firing, shed otherwise; overheat locks the trigger
    // until the tubes are fully cold (no feathering the cap)
    if (laserOverheat) {
      laserHeat = Math.max(0, laserHeat - LASER_COOL * dt);
      if (laserHeat === 0) laserOverheat = false;
    } else if (wantFire) {
      laserHeat += dt;
      if (laserHeat >= LASER_MAX_HEAT) { laserHeat = LASER_MAX_HEAT; laserOverheat = true; }
    } else {
      laserHeat = Math.max(0, laserHeat - LASER_COOL * dt);
    }
    // diegetic gauge: both tubes share one material per tank. The mkcx
    // tank exposes a private clone (gunHeatMat) whose EMISSIVE carries the
    // heat — its textured PBR gun barely shows a color multiply, and the
    // emissive is what the bloom chain turns into a visible glow.
    if (guns) {
      const f = laserHeat / LASER_MAX_HEAT;
      const mat = playerMesh.userData.gunHeatMat
        || (guns[0].children[0] && guns[0].children[0].material);
      if (mat && mat.color) {
        mat.color.lerpColors(gunColCool, gunColHot, f);
        if (mat.emissive) {
          mat.emissive.lerpColors(gunEmiCool, gunEmiHot, f);
          mat.emissiveIntensity = 0.3 + 1.7 * f;
        }
      }
      // the sleeves are the gauge that actually READS — same instrument as
      // the cannon's mid-barrel band, driven the same way
      const smat = playerMesh.userData.laserSleeveMat;
      if (smat) smat.color.lerpColors(gunColCool, gunColHot, f);
    }
    // ...and the same cycle on the pad button: white -> orange -> red as
    // heat builds, blinking red through the lockout. Style only when the
    // band CHANGES — per-frame style writes on a button are layout noise.
    if (laserBtnEl) {
      const f = laserHeat / LASER_MAX_HEAT;
      const band = laserOverheat ? 3 : f > 0.66 ? 2 : f > 0.33 ? 1 : 0;
      if (band !== laserBtnBand) {
        laserBtnBand = band;
        const col = ['', '#ffaa44', '#ff6633', '#ff3322'][band];
        laserBtnEl.style.color = col;
        laserBtnEl.style.borderColor = col;
        laserBtnEl.classList.toggle('overheat', band === 3);
        if (band !== 3) laserBtnEl.style.background = '';
      }
      // the cooldown is VISUAL: through the lockout the red drains out of
      // the button bottom-up as the tubes shed heat (4% steps, not every
      // frame — a style write per frame on a button is layout noise)
      if (laserOverheat) {
        const drain = Math.round(f * 25) * 4;
        if (drain !== laserDrainPct) {
          laserDrainPct = drain;
          laserBtnEl.style.background =
            `linear-gradient(to top, rgba(255,51,34,0.5) ${drain}%, rgba(255,51,34,0.08) ${drain}%)`;
        }
      } else laserDrainPct = -1;
    }
    // holding the trigger against locked tubes CLICKS — the gun says no
    if (wantFire && laserOverheat) sfx.play('laser_click');
    if (wantFire && !laserOverheat) {
      // THE BEAMS. One per secondary, each leaving its own muzzle and running
      // straight down its own barrel — the direction is read from the gun's
      // world quaternion, never re-derived, and then flattened onto the
      // tangent plane because the board is a sphere and the weapon has to
      // agree with the ground it fires over.
      if (!beamOn) {
        beamOn = true;
        beamPhase[0] = 0; beamPhase[1] = 0;   // both sweeps start together
        // one 6-second take, started as a loop so the burst can stop it the
        // moment the trigger releases or the tubes lock
        beamVoice = sfx.loop('tank_beam', { gain: 1 });
      }
      const reach = LASER_REACH * cellSide;
      for (let gi = 0; gi < 2 && gi < guns.length; gi++) {
        const gun = guns[gi];
        gun.getWorldPosition(tmpV);
        const from = norm3([tmpV.x, tmpV.y, tmpV.z]);
        // THE MUZZLE'S OWN RADIUS. The beam used to be flattened onto the
        // ground lift and so left from UNDER the hull rather than out of the
        // secondaries — invisible at this scale, obvious in the lab where the
        // tank is drawn 12x larger. Floored at the ground clearance so it
        // still rides over wall tops.
        const gunR = Math.max(tmpV.length(), 1 + params.wallHeight * 0.5);
        gun.getWorldQuaternion(tmpQ);
        tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
        const d0 = [tmpV.x, tmpV.y, tmpV.z];
        let dir = norm3(sub3(d0, scale3(from, dot3(d0, from))));
        // SWEEP IT INWARD, by the bell, toward the hull's centreline. Which
        // way "inward" is comes from the gun's own offset from the hull —
        // never from its L/R name, which is exactly what made the model's
        // toe-in ambiguous in the first place.
        // ...by this beam's OWN phase, which is where the two decouple: the
        // heat clock is shared, the sweeps are not.
        const swing = BEAM_SWEEP * Math.sin(Math.min(1, beamPhase[gi]) * Math.PI);
        if (swing > 1e-4) {
          const lat = sub3(from, player.pos);                     // gun -> out
          const latT = sub3(lat, scale3(from, dot3(lat, from)));  // onto tangent
          const right = norm3(cross3(from, dir));
          // Toward the centreline. This sign was briefly flipped on the
          // strength of a probe that measured separation at FULL REACH — but
          // the guns are already toed in, so the pair crosses before then and
          // the far-end gap grows for BOTH signs. The metric was the bug, not
          // the sign; fixing the probe to measure the crossing point put this
          // back where it started.
          const sgn = dot3(latT, right) > 0 ? -1 : 1;             // toward centre
          const c = Math.cos(swing), sn = Math.sin(swing) * sgn;
          dir = norm3(add3(scale3(dir, c), scale3(right, sn)));
        }
        // WALLS STOP IT, enemies do not. March in half-cells to the first
        // blocked cell so a beam cannot reach through the maze you built.
        let len = reach;
        let bite = 0;
        // ALONG THE GROUND, not through it. `m` is arc length now — on a
        // unit sphere that is radians, so no conversion — and arcPoint lands
        // ON the surface by construction. The old `norm3(from + dir*m)`
        // pointed the right way but under-reached by atan(m) instead of m:
        // 15.7% short at the rank-15 reach, over a cell of missing beam.
        for (let m = cellSide * 0.5; m <= reach; m += cellSide * 0.5) {
          const q = arcPoint(from, dir, m);
          const ci = cellIndex(q);
          if (ci !== -1 && dungeon.tags[ci] === BLOCKED) {
            len = m;
            // HOW MUCH of the beam the rock is eating, not merely THAT there
            // is rock. This map is dense — measured, a beam standing on
            // all-open ground still clips rock at 2.5 of its 2.6 cells, so a
            // flat penalty on contact would bog the weapon EVERYWHERE and the
            // sweep would never move. Bite is the same currency a body pays
            // in: 0 when the wall is out at the tip, 1 at point-blank.
            bite = wallBiteFor(m, reach);
            break;
          }
        }
        // IT PIERCES, BUT IT PAYS TO. Every body the beam passes through eats
        // into what is left of its reach, so it visibly SHORTENS against a
        // crowd — struggling to punch through rather than sailing on. Fodder
        // barely costs it; a solid core takes a big bite. Three of those and
        // the beam dies in the queue.
        //
        // Nearest first, because the order is the whole mechanic: what stops
        // the beam is what is in FRONT, and something behind a wall of armour
        // is simply never reached.
        // WHAT IS IN THE BEAM, measured along the same arc it is drawn on.
        //
        // This used to project onto a straight chord, and at these reaches
        // that is not a rounding error: a body standing on the ground 8 cells
        // out sits 0.19 world units off the chord, against a hit radius of at
        // most 0.13 — so every enemy past about five cells was UNHITTABLE and
        // the rank 5/10/15 beams drew long and killed nothing at the far end.
        // The bug shipped invisible because at the original 2.6-cell reach
        // the chord never left the ground.
        const along = [];
        for (const e of enemies) {
          if (!e.alive) continue;
          const pr = projectToArc(from, dir, e.pos);
          // s is SIGNED — behind the muzzle must be rejected, not folded
          if (pr.s < 0 || pr.s > len) continue;
          const r = cellSide * Math.max(0.4, (e.size ?? e.spec.size) * 0.8);
          if (pr.off >= r) continue;
          // `hard` is beamburn's word for the not-rammable tier — the same
          // read the board already carries in colour
          along.push({ e, t: pr.s, hard: !e.spec.rammable });
        }
        // A WALL BOGS IT LIKE ARMOUR DOES (operator). Burning into rock is
        // the same job as burning through a solid core — the sweep labours,
        // and firing across a corner drags exactly as it should. It is the
        // harsher of the two, in fact: a wall also ends the beam outright,
        // where a body only takes a bite out of the reach.
        if (bite > 0.05) beamHitWall = true;
        // ONE COPY OF THE RULE (beamburn.js). It sorts nearest-first itself,
        // so no caller here or in the lab can get the order wrong — and the
        // order is the whole mechanic.
        // `bite` is reported, not applied: WALL_STALLS makes rock a flat
        // stall now. The explicit wall flag matters — rock exactly at the tip
        // bites 0 and would otherwise read as no wall at all.
        const bu = burn(along, len, reach, bite, len < reach);
        for (const hit of bu.hits) damageEnemy(hit.e, tNow, LASER_DPS * dt, false, 'tank');
        const drag = bu.drag, reachLeft = bu.reachLeft;
        // draw the CHOKED length, not the clear-air one
        drawBeam(gi, from, dir, Math.max(cellSide * 0.15, reachLeft),
          laserHeat / LASER_MAX_HEAT, gunR);
        // ADVANCE THIS BEAM'S SWEEP, slowed by what it is chewing through.
        // Capped so it always creeps, never freezes; uncapped at the top so a
        // beam that spends the burst inside a hard cluster simply does not
        // finish its arc.
        beamPhase[gi] = Math.min(1, beamPhase[gi]
          + sweepAdvance(dt, LASER_MAX_HEAT, drag));
      }
    } else if (beamOn) {
      beamOn = false;
      if (beamVoice) { beamVoice.stop(); beamVoice = null; }
      hideBeams();
    }
  }

  // --- firing: the shot leaves along the turret's CURRENT sweep ------------
  function fire(aimDir = null) {
    closeShop();   // you cannot be shopping and shooting at the same time
    if (player.won || playerDown || paused || ammo <= 0 || cannonHeat > 0) return;
    ammo--;
    sfx.play('tank_main'); // the player's own act — always at full presence
    cannonHeat = CANNON_COOL; // the sleeve glows red-hot, cools over 3 s
    recoilLeft = recoilLen();
    bumpLeft = Math.max(bumpLeft, BUMP_LEN * 0.4); // the shot rocks the hull too
    let dir = aimDir;
    const turret = playerMesh.userData.turret;
    if (!dir && turret) {
      // world +Z of the turret group, flattened into the tangent plane —
      // aim IS the sweep; no sign conventions to get wrong
      turret.getWorldQuaternion(tmpQ);
      tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
      const n = norm3(player.pos);
      const d = [tmpV.x, tmpV.y, tmpV.z];
      dir = norm3(sub3(d, scale3(n, dot3(d, n))));
    } else if (!dir) {
      dir = player.smoothDir.slice(); // turretless units fire straight ahead
    }
    // the Braille bullet, nose along the flight direction
    const mesh = makeOrdnanceShell(2,'y');
    mesh.scale.setScalar(cellSide * 0.16);
    scene.add(mesh);
    projectiles.push({ pos: player.pos.slice(), dir, dist: 0, mesh });
    updateHud();
  }



  // --- THE RESCUE MISSION, on the board -------------------------------------
  // src/rescue.js owns the rules: where they strand, the stop clause, the grab
  // window, the seats, the mix, the verdict. This owns the figures, the
  // beacons, the chevrons, the sounds, and the four places the mission
  // touches the campaign board (supply, nav, the hull's death, the end card).
  const SURV_ORANGE = 0xffb45e, SURV_ALARM = 0xff4d5e;

  // WHERE THEY STRAND. Open cells in the hop band that are not dead-end nubs
  // and not something else's ground. "On the lanes" needs no test of its own:
  // in this dungeon every open cell with a finite heart distance IS on a
  // lane, which is exactly why the horde walks over them.
  function survivorCandidates() {
    const out = [];
    if (!graph || !dungeon) return out;
    const taken = new Set([dungeon.heart, dungeon.spawn, serverCi,
      ...spawnPoints.map((sp) => sp.ci), ...berths.map((b) => b.ci)]);
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] === BLOCKED || taken.has(i)) continue;
      const d = dungeon.distToHeart[i];
      if (!(d > 0)) continue;
      if (openCount(i) < 2) continue;            // a nub is not a lane
      out.push({ ci: i, d, pos: norm3(graph.centers[i]) });
    }
    return out;
  }

  function clearSurvivors() {
    for (const [, g] of survObjs) { scene.remove(g); disposeObj(g); }
    survObjs.clear();
  }

  function dropSurvivor(id) {
    const g = survObjs.get(id);
    if (!g) return;
    scene.remove(g); disposeObj(g);
    survObjs.delete(id);
  }

  function makeSurvivorObj(sv) {
    const g = makeSurvivor({ body: SURV_ORANGE, hi: 0xfff4d6, alarm: SURV_ALARM });
    // stood UP on the surface: the figure is built feet-at-origin along +Y,
    // so the group's own up is the cell normal and nothing else needs saying
    g.scale.setScalar(cellSide * 0.55);
    const n = norm3(sv.pos);
    g.position.set(sv.pos[0], sv.pos[1], sv.pos[2]);
    tmpObj.position.copy(g.position);
    tmpObj.up.set(0, 1, 0);
    tmpObj.lookAt(0, 0, 0);
    g.quaternion.setFromUnitVectors(Y_AXIS, tmpN.set(n[0], n[1], n[2]));
    scene.add(g);
    survObjs.set(sv.id, g);
    return g;
  }

  // Called from regenerate, once the dungeon and its heart field exist.
  function startRescue() {
    clearSurvivors();
    rescue = makeRescue(rescueTune);
    rescueEnded = false;
    if (!rescueOn) return;
    const rng = mulberry32((params.seed >>> 0) ^ 0x5e5cae);
    placeSurvivors(rescue, survivorCandidates(), rng, cellSide, rescueTune);
    for (const sv of rescue.survivors) makeSurvivorObj(sv);
    // THE BUDGET. Everything the mission gives you, given once.
    ammo = rescueTune.shells;
    playerHP = Math.max(1, Math.round(rescueTune.hulls));
    console.log(`RESCUE stranded=${rescue.survivors.length}/${rescueTune.survivors}`
      + `${rescue.short ? ` short=${rescue.short}` : ''} apart=${rescue.apart}c`
      + ` cells=[${rescue.survivors.map((sv) => sv.ci).join(',')}]`
      + ` shells=${ammo} mines=${mineField.count} hulls=${playerHP}`
      + ` lasers=${rescueTune.lasers ? 'on' : 'OFF'}`);
    // a board that cannot hold the party is a fact the player should be told,
    // not one the verdict quietly scores around
    if (rescue.short > 0) {
      showToast(`<div class="wave-num">RESCUE &#9656; ${rescue.survivors.length} BEACONS</div>`
        + `<div class="wave-role">the board could only hold ${rescue.survivors.length}`
        + ` of ${rescueTune.survivors}</div>`, 3000);
    }
    updateHud();
  }

  // Is anything in contact with this survivor RIGHT NOW. The whole grab model
  // is that question asked every frame — which is why killing the grabber
  // frees them with no bookkeeping at all.
  function survivorHeld(sv) {
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.spec.cloaked && !e.decloaked) continue;
      if (dist3(e.pos, sv.pos) < cellSide * 0.6) return true;
    }
    return false;
  }

  // The nearest standing survivor this enemy should peel off the lane for.
  // A short LOCAL override, not a second BFS field.
  function lockedSurvivor(pos) {
    if (!rescueOn || rescue.over) return null;
    let best = null, bd = Infinity;
    for (const sv of rescue.survivors) {
      if (!lockOn(sv, pos, cellSide, rescueTune)) continue;
      const d = dist3(sv.pos, pos);
      if (d < bd) { bd = d; best = sv; }
    }
    return best;
  }

  let survPingT = 0;
  let rescueLastPos = null;
  function stepRescue(dt, tNow) {
    if (!rescueOn || rescueEnded || !graph || !player.pos) return;
    // the stop clause, read off the CONTROL rather than off the motion: the
    // player's hand on the lever is the thing they can feel, and a tank
    // coasting to a halt with the throttle open has not stopped, it is about
    // to move again.
    const asking = Math.abs(throttle) > rescueTune.boardThrottle || cruise
      || keys.fast || keys.slow || gotoCi >= 0;
    const movedCells = rescueLastPos ? dist3(player.pos, rescueLastPos) / cellSide : 0;
    rescueLastPos = player.pos.slice();
    const moving = dt > 0 && movedCells / dt > rescueTune.boardSpeed;
    const slow = !asking && !moving;
    survPingT -= dt;
    const ping = survPingT <= 0;
    if (ping) survPingT = 0.55;
    for (let i = 0; i < rescue.survivors.length; i++) {
      const sv = rescue.survivors[i];
      if (sv.state !== 'standing') { dropSurvivor(sv.id); continue; }
      const g = survObjs.get(sv.id);
      if (g) g.userData.tick(tNow);
      const gr = stepGrab(rescue, i, survivorHeld(sv), dt, rescueTune);
      if (g) g.userData.setGrabbed(sv.grabT > 0);
      if (gr === 'grabbed') {
        sfx.play('field_pulse');
        showCallout(`BEACON ${sv.id} &#9656; GRABBED`, 'co-heart');
      }
      if (gr === 'lost') {
        const nrm = norm3(sv.pos);
        const burst = makeDotBurst(SURV_ALARM, nrm, 40);
        burst.scale.setScalar(cellSide * 0.7);
        burst.position.set(sv.pos[0], sv.pos[1], sv.pos[2]);
        scene.add(burst); debris.push(burst);
        warnRing(sv.ci, SURV_ALARM, 0.6, cellSide * 1.4);
        sfx.play('danger_alert');
        showToast(`<div class="td-down">BEACON ${sv.id} LOST</div>`
          + `<div class="td-down-sub">${standingSurv(rescue)} still down there</div>`, 2600);
        dropSurvivor(sv.id);
        updateHud();
        continue;
      }
      // the red ring counts the window down ON THE GROUND, where the player
      // is looking, rather than only in the HUD
      if (sv.grabT > 0 && ping) {
        warnRing(sv.ci, SURV_ALARM, 0.4, cellSide * (1.4 - 0.9 * grabProgress(sv, rescueTune)));
      }
      const near = !playerDown
        && dist3(player.pos, sv.pos) < cellSide * rescueTune.boardCells;
      const br = stepBoard(rescue, i, { near, slow }, dt, rescueTune);
      if (br === 'boarding' && ping) warnRing(sv.ci, SURV_ORANGE, 0.4, cellSide * 0.9);
      if (br === 'aboard') {
        sfx.play('tank_pickup');
        const nrm = norm3(sv.pos);
        const burst = makeDotBurst(SURV_ORANGE, nrm, 30);
        burst.scale.setScalar(cellSide * 0.6);
        burst.position.set(sv.pos[0], sv.pos[1], sv.pos[2]);
        scene.add(burst); debris.push(burst);
        showCallout(`BEACON ${sv.id} &#9656; ABOARD`, 'co-milestone');
        dropSurvivor(sv.id);
        updateHud();
      }
    }
    // HOME. The Stalheart's pad is the airlock — the same radius the board
    // already calls "on the pedestal", so there is one answer to "am I there".
    if (aboardSurv(rescue) > 0 && !playerDown
        && dist3(player.pos, graph.centers[dungeon.heart]) < pedestalRadius() + cellSide * 0.7) {
      const n = disembark(rescue);
      if (n > 0) {
        sfx.play('tank_spool_up');
        showToast(`<div class="wave-num">${n} SAFE &#9656; ${rescue.saved}/${rescue.survivors.length}</div>`
          + `<div class="wave-role">${standingSurv(rescue)} still down there</div>`, 2600);
        updateHud();
      }
    }
    if (missionOver(rescue)) endRescue('the field is clear');
  }

  // The card. A rescue ends with a NUMBER, always — "four of six, and the
  // fifth was in the hatch" is the story the mode exists to produce, so a
  // lost hull ends it with a score rather than with a game-over.
  function endRescue(why) {
    if (rescueEnded) return;
    rescueEnded = true;
    rescue.over = true;
    // the run is OVER, not merely scored: without this the board kept
    // spawning waves at a player with nothing left to do on it
    player.won = true;
    clearSurvivors();
    const v = rescueVerdict(rescue);
    const head = v.clean ? 'EVERYONE CAME HOME'
      : v.none ? 'NOBODY CAME HOME' : `${v.saved} OF ${v.total} CAME HOME`;
    showToast(`<div class="wave-num">${head}</div>`
      + `<div class="wave-role">${why} &middot; lost ${v.lost}`
      + `${v.lostIds.length ? ` (beacon ${v.lostIds.join(', ')})` : ''}`
      + ` &middot; ${ammo} shell${ammo === 1 ? '' : 's'} and ${mineField.count} mine${mineField.count === 1 ? '' : 's'} left`
      + ` &middot; ${playerHP} hull${playerHP === 1 ? '' : 's'}</div>`, 9000);
    console.log(`RESCUE END ${why}: saved=${v.saved}/${v.total} lost=${v.lost}`
      + ` lostIds=[${v.lostIds.join(',')}] clean=${v.clean}`
      + ` shells=${ammo} mines=${mineField.count} hulls=${playerHP}`);
    updateHud();
  }

  // The objectives row, in place of the campaign's. Everything the campaign
  // measures — portals, sectors, towers built — is not what this mission is,
  // and a HUD that reads out the wrong objective is worse than a blank one.
  function rescueLine() {
    if (rescue2On) return rescue2Line();
    if (!rescueOn) return '';
    const total = rescue.survivors.length;
    const held = rescue.survivors.filter((s) => s.state === 'standing' && s.grabT > 0).length;
    return `<div class="hud-obj">SAVED <b>${rescue.saved}/${total}</b>`
      + ` &middot; aboard ${aboardSurv(rescue)}/${rescueTune.seats}`
      + ` &middot; standing ${standingSurv(rescue)}`
      + (held ? ` &middot; <b class="hp-heart">${held} GRABBED</b>` : '')
      + (rescue.lost ? ` &middot; lost ${rescue.lost}` : '')
      + `</div>`;
  }


  // --- RESCUE 2: THE RAID ---------------------------------------------------
  // Rescue 1 is a defence with a ferry; this is a raid. The map is static, the
  // threat is pre-placed, and every camp is the same three beats: drive in
  // (ramming the garrison is free — that is what it is for), get inside SHOT
  // DISTANCE so the container opens, then STAND STILL while they walk out to
  // you. The inversion that makes it a different game: in Rescue 1 stopping
  // is how you pick someone up; here stopping is how you avoid killing them.
  const campObjs = new Map();    // camp id -> { obj, doorT, open }
  const astroObjs = new Map();   // survivor id -> the GLB clone
  const splashes = [];           // red on the floor, for the rest of the run
  // EVERY BODY WE HAVE, so the people you rescue are not one person repeated.
  // A crowd of identical survivors reads as a placeholder no matter how good
  // the model is — the variety is doing more work here than the fidelity.
  let astroProtos = [];
  let tankSpeedCells = 0;        // measured off the hull, in cells/s
  let tankLastPos = null;

  const campById = (id) => rescue.camps.find((k) => k.id === id) || null;

  function clearRescue2() {
    for (const [, v] of campObjs) { scene.remove(v.obj); disposeObj(v.obj); }
    campObjs.clear();
    for (const [, o] of astroObjs) {
      if (o.userData.dispose) o.userData.dispose();
      scene.remove(o); disposeObj(o);
    }
    astroObjs.clear();
    for (const sp of splashes) { scene.remove(sp); sp.geometry.dispose(); sp.material.dispose(); }
    splashes.length = 0;
  }

  // A LITTLE SPLASH OF RED ON THE FLOOR (the brief). It does NOT fade: this
  // is the record of a mistake, and a mission about carrying people out
  // should keep the ones it did not.
  function bloodSplash(pos) {
    const n = norm3(pos);
    let t1 = cross3(n, [0, 1, 0]);
    if (len3(t1) < 1e-3) t1 = cross3(n, [1, 0, 0]);
    t1 = norm3(t1);
    const t2 = norm3(cross3(n, t1));
    const N = 54, arr = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const c = new THREE.Color(0xb3121b);
    for (let i = 0; i < N; i++) {
      // a hash, not Math.random: a replayed board must splash identically
      const h = (k) => { const v = Math.sin(i * 12.9898 + k * 78.233 + pos[0] * 37.7) * 43758.5453; return v - Math.floor(v); };
      const a = h(1) * Math.PI * 2;
      const r = cellSide * 0.30 * Math.pow(h(2), 0.55);   // dense at the centre
      const p = add3(scale3(n, 1 + cellSide * 0.02), add3(scale3(t1, Math.cos(a) * r), scale3(t2, Math.sin(a) * r)));
      arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2];
      const b = 0.55 + 0.45 * h(3);
      col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 3.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95 }));
    scene.add(pts);
    splashes.push(pts);
    return pts;
  }

  // Open cells within `cells` of a centre — the ring a garrison stands in and
  // nothing else. O(C) per camp at init, three times; not worth an index.
  function cellsNear(ci, cells, skip = new Set()) {
    const c0 = graph.centers[ci], r = cellSide * cells;
    const out = [];
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] === BLOCKED || skip.has(i)) continue;
      if (dist3(graph.centers[i], c0) <= r) out.push(i);
    }
    return out;
  }

  // The garrison: a large group of RAMMABLE units ringed around the
  // container, and from the second camp a solid one that must be shot. They
  // are ordinary enemies in every respect except that they carry a campId,
  // which is the only thing the nav reads.
  function spawnGarrison(camp, rng) {
    const kinds = Object.keys(ENEMY_SPEC).filter((k) => !ENEMY_SPEC[k].shelved);
    const soft = kinds.filter((k) => ENEMY_SPEC[k].rammable && !ENEMY_SPEC[k].cloaked);
    const hard = kinds.filter((k) => !ENEMY_SPEC[k].rammable);
    const ring = cellsNear(camp.ci, rescue2Tune.garrisonCells, new Set([camp.ci]));
    if (!ring.length) return 0;
    let made = 0;
    const put = (type) => {
      const spec = ENEMY_SPEC[type];
      if (!spec) return;
      const ci = ring[Math.floor(rng() * ring.length) % ring.length];
      const s0 = cellSide * spec.size * 0.7;
      const obj = makeDotEnemy(type, { walker: CREATURE_TINTS[type], walkerHi: accentFor(type) });
      obj.scale.setScalar(s0); obj.userData.s0 = s0;
      scene.add(obj);
      const exits = openNeighbors(ci);
      enemies.push({
        type, spec, scale0: s0, size: spec.size,
        cur: ci, prev: -1, next: exits.length ? exits[Math.floor(rng() * exits.length)] : ci,
        prog: rng() * 0.4, pos: graph.centers[ci].slice(), dir: [0, 1, 0],
        obj, alive: true, phase: rng() * 6.283, paceJitter: 0.9 + rng() * 0.22,
        hp: spec.hp, behMult: 1, behUntil: -1, touchCd: -1,
        slowFactor: 1, slowUntil: -1,
        campId: camp.id,          // the whole difference from a wave spawn
      });
      made++;
    };
    for (let i = 0; i < Math.round(rescue2Tune.garrison); i++) put(soft[i % soft.length]);
    if (camp.id > 1) for (let i = 0; i < Math.round(rescue2Tune.hard); i++) put(hard[i % hard.length]);
    return made;
  }

  function buildCamp(camp) {
    const g = dressMetal(makeContainerFixture(0));
    if (!g) {
      // the bytes have not landed; the same wait tfStart does
      preloadContainer().then((ok) => { if (ok && rescue2On && !campObjs.has(camp.id)) buildCamp(camp); });
      return;
    }
    shutDoors(g);
    const c = graph.centers[camp.ci], n = graph.normals[camp.ci], hc = graph.centers[dungeon.heart];
    const f = cellSide * 0.55;
    g.scale.set(f, f, f * 0.55);
    g.position.set(c[0], c[1], c[2]);
    tmpObj.position.copy(g.position); tmpObj.up.set(n[0], n[1], n[2]);
    tmpObj.lookAt(hc[0], hc[1], hc[2]);
    g.quaternion.copy(tmpObj.quaternion);
    scene.add(g);
    campObjs.set(camp.id, { obj: g, doorT: 0 });
  }

  // The doors swing to the angle the SHUT search found, plus a throw — so a
  // container opens from wherever its authored rest pose happened to be
  // rather than from an assumed zero. Same measurement, used backwards.
  function stepCampDoors(dt) {
    for (const camp of rescue.camps) {
      const v = campObjs.get(camp.id);
      if (!v || !camp.open) continue;
      if (v.doorT >= 1) continue;
      v.doorT = Math.min(1, v.doorT + dt / 0.7);
      const e = v.doorT * v.doorT * (3 - 2 * v.doorT);
      for (const [name, sign] of [['Door_L_Pivot', 1], ['Door_R_Pivot', -1]]) {
        const piv = v.obj.getObjectByName(name);
        if (!piv) continue;
        const shut = piv.userData.shutAngle ?? 0;
        piv.rotation.y = shut + sign * 1.15 * e;
      }
    }
  }

  function startRescue2() {
    // THE GUARD COMES FIRST. Both missions share the `rescue` object, and
    // this runs AFTER startRescue in regenerate — so resetting before the
    // guard wiped Rescue 1's survivors on every board it built, which the
    // probe reported as "nobody stranded". A shared object is reset by the
    // owner of the mode, never by its neighbour.
    if (!rescue2On) return;
    clearRescue2();
    rescue = makeRescue(rescue2Tune);
    rescueEnded = false;
    tankLastPos = null; tankSpeedCells = 0;
    const rng = mulberry32((params.seed >>> 0) ^ 0x2a1de5);
    const taken = new Set([dungeon.heart, dungeon.spawn, serverCi,
      ...spawnPoints.map((sp) => sp.ci), ...berths.map((b) => b.ci)]);
    // THE CLEARINGS ARE THE ROOM SEEDS. dungeon.seeds is exactly the
    // farthest-point set the carve grew its rooms from, so "a camp in a
    // clearing" needs no second notion of what a clearing is.
    const cands = (dungeon.seeds || [])
      .filter((ci) => dungeon.tags[ci] !== BLOCKED && !taken.has(ci) && dungeon.distToHeart[ci] > 0)
      .map((ci) => ({ ci, d: dungeon.distToHeart[ci], pos: norm3(graph.centers[ci]) }));
    makeCamps(rescue, cands, rng, cellSide, rescue2Tune);
    let garrison = 0;
    for (const camp of rescue.camps) { buildCamp(camp); garrison += spawnGarrison(camp, rng); }
    ammo = Math.round(rescue2Tune.shells);
    playerHP = Math.max(1, Math.round(rescue2Tune.hulls));
    preloadAstronauts().then((pr) => {
      astroProtos = pr;
      console.log(`RESCUE2 astronauts ${pr.length ? pr.map((x) => `${x.id}(${x.clips.length} clip, ${x.tris}t)`).join(' + ') : 'FAILED to load'}`);
    });
    console.log(`RESCUE2 camps=${rescue.camps.length}/${rescue2Tune.camps}`
      + `${rescue.short ? ` short=${rescue.short}` : ''} apart=${rescue.campApart}c`
      + ` survivors=${rescue.survivors.length} garrison=${garrison}`
      + ` cells=[${rescue.camps.map((k) => k.ci).join(',')}]`
      + ` groups=[${rescue.camps.map((k) => k.group.length).join(',')}]`
      + ` shells=${ammo} mines=${mineField.count} hulls=${playerHP}`
      + ` lasers=${rescue2Tune.lasers ? 'on' : 'OFF'}`
      + ` board=${dungeon.tags.filter((t) => t !== BLOCKED).length} open cells`);
    updateHud();
  }

  function spawnAstronaut(sv) {
    if (!astroProtos.length) return null;
    // WHICH BODY IS A PROPERTY OF THE SURVIVOR, not of the spawn order: the
    // same person must come back as the same person after a re-render, and a
    // counter would reshuffle everyone the first time one was picked up.
    // Deterministic off the id, house rule — no Math.random in game logic.
    const pick = astroProtos[Math.abs(sv.id | 0) % astroProtos.length];
    const o = makeAstronaut(pick);
    if (!o) return null;
    // a person, in cells: the study settled the ratio at about a sixth of the
    // hull, and the hull is 0.85 of a cell
    o.scale.setScalar(cellSide * 0.30);
    astroObjs.set(sv.id, o);
    scene.add(o);
    placeAstronaut(sv, o);
    return o;
  }

  function placeAstronaut(sv, o = astroObjs.get(sv.id)) {
    if (!o) return;
    const n = norm3(sv.pos);
    o.position.set(sv.pos[0], sv.pos[1], sv.pos[2]);
    // stood on the surface and facing where it is walking — the heading comes
    // from the module's own step direction, never re-derived here
    tmpObj.position.copy(o.position);
    tmpObj.up.set(n[0], n[1], n[2]);
    const d = sv.dir || [0, 0, 1];
    tmpObj.lookAt(o.position.x + d[0], o.position.y + d[1], o.position.z + d[2]);
    o.quaternion.copy(tmpObj.quaternion);
  }

  function dropAstronaut(id) {
    const o = astroObjs.get(id);
    if (!o) return;
    if (o.userData.dispose) o.userData.dispose();
    scene.remove(o); disposeObj(o);
    astroObjs.delete(id);
  }

  function stepRescue2(dt, tNow) {
    if (!rescue2On || rescueEnded || !graph || !player.pos) return;
    // THE HULL'S OWN SPEED, in cells per second. Measured, not read off the
    // throttle — the phone has no throttle, and this is the number that
    // decides whether contact saves someone or kills them.
    if (tankLastPos && dt > 0) tankSpeedCells = (dist3(player.pos, tankLastPos) / cellSide) / dt;
    tankLastPos = player.pos.slice();
    stepCampDoors(dt);
    for (const camp of rescue.camps) {
      campAwake(camp, player.pos, cellSide, rescue2Tune);
      if (stepCall(camp, player.pos, cellSide, rescue2Tune) === 'open') {
        sfx.play('tank_spool_up');
        warnRing(camp.ci, 0xffb45e, 0.8, cellSide * 2.0);
        showToast(`<div class="wave-num">CAMP ${camp.id} &#9656; HATCH OPEN</div>`
          + `<div class="wave-role">${camp.group.length} coming out &middot; HOLD STILL</div>`, 2600);
      }
      const out = stepEmerge(camp, dt, rescue2Tune);
      if (out) { spawnAstronaut(out); sfx.play('tank_pickup'); }
    }
    for (let i = 0; i < rescue.survivors.length; i++) {
      const sv = rescue.survivors[i];
      if (sv.state !== 'walking') { if (sv.state !== 'inside') dropAstronaut(sv.id); continue; }
      const o = astroObjs.get(sv.id) || spawnAstronaut(sv);
      // RUN OVER — before the walk and before the save, because the same
      // contact radius does all three and the only difference is the hull's
      // speed. Checking it first is what makes "not static" the loss.
      if (runOver(sv, player.pos, tankSpeedCells, cellSide, rescue2Tune)) {
        sv.state = 'lost'; rescue.lost++;
        bloodSplash(sv.pos);
        sfx.play('enemy_die_c');
        bumpLeft = Math.max(bumpLeft, BUMP_LEN * 0.5);
        showToast(`<div class="td-down">RUN OVER</div>`
          + `<div class="td-down-sub">${remainingSurv(rescue)} still out there &middot; STOP to load</div>`, 2600);
        dropAstronaut(sv.id);
        updateHud();
        continue;
      }
      const gr = stepGrab(rescue, i, survivorHeld(sv), dt, rescue2Tune);
      if (gr === 'lost') {
        bloodSplash(sv.pos);
        sfx.play('danger_alert');
        showToast(`<div class="td-down">ASTRONAUT ${sv.id} KILLED</div>`
          + `<div class="td-down-sub">${remainingSurv(rescue)} still out there</div>`, 2400);
        dropAstronaut(sv.id);
        updateHud();
        continue;
      }
      if (gr === 'grabbed') sfx.play('field_pulse');
      if (walkStep(sv, player.pos, dt, cellSide, rescue2Tune) === 'saved') {
        rescue.saved++;
        sfx.play('tank_spool_up');
        const burst = makeDotBurst(0xffb45e, norm3(sv.pos), 26);
        burst.scale.setScalar(cellSide * 0.5);
        burst.position.set(sv.pos[0], sv.pos[1], sv.pos[2]);
        scene.add(burst); debris.push(burst);
        showCallout(`ASTRONAUT ${sv.id} &#9656; ABOARD`, 'co-milestone');
        dropAstronaut(sv.id);
        updateHud();
        continue;
      }
      if (o) { o.userData.tick(dt); placeAstronaut(sv, o); }
    }
    if (missionOver(rescue)) endRescue('every camp is accounted for');
  }

  function rescue2Line() {
    const total = rescue.survivors.length;
    const walking = rescue.survivors.filter((s) => s.state === 'walking').length;
    const held = rescue.survivors.filter((s) => exposedSurv(s) && s.grabT > 0).length;
    const opened = rescue.camps.filter((k) => k.open).length;
    return `<div class="hud-obj">SAVED <b>${rescue.saved}/${total}</b>`
      + ` &middot; camps ${opened}/${rescue.camps.length}`
      + (walking ? ` &middot; <b>${walking} WALKING &mdash; HOLD STILL</b>` : '')
      + (held ? ` &middot; <b class="hp-heart">${held} GRABBED</b>` : '')
      + (rescue.lost ? ` &middot; lost ${rescue.lost}` : '')
      + `</div>`;
  }

  // --- THE MINES ------------------------------------------------------------
  // src/mines.js owns every rule and every refusal; this owns the discs, the
  // fan on the ground, the sounds, and the four damage doors a blast can go
  // through (enemy, gate, tank, another mine). Operator's ruling, 2026-09-04:
  // a CLAYMORE — instant on trigger, directional, no fuse, an arming window
  // after the drop; laid one cell in FRONT of the tank facing its heading, so
  // laying them while reversing builds a field between you and what you are
  // backing away from. It trips on you too, and it hurts.
  const MINE_BLUE = 0x6fd3ff;   // friendly: the disc, the ring, the scope
  const MINE_RED = 0xff5a4a;    // the arc it will throw

  // The mine's own polar coordinates, run BACKWARDS: given a distance in
  // cells and a bearing off the axis, where is that on the ground? Every line
  // of the fan and every dot of the disc is placed with this, so the drawing
  // and minePolar's hit test are one geometry rather than two that have to be
  // kept in agreement by hand — the mistake the beam made three times.
  function minePoint(m, cells, th, lift = 0.16) {
    const n = m.pos, d = m.dir;
    const side = norm3(cross3(n, d));
    const ct = Math.cos(th), st = Math.sin(th);
    const u = [d[0] * ct + side[0] * st, d[1] * ct + side[1] * st, d[2] * ct + side[2] * st];
    const a = cells * cellSide, ca = Math.cos(a), sa = Math.sin(a);
    const r = 1 + cellSide * lift;
    return [(n[0] * ca + u[0] * sa) * r, (n[1] * ca + u[1] * sa) * r, (n[2] * ca + u[2] * sa) * r];
  }

  const mineArcsShown = () => params.mineArcs;

  const MINE_FAN_RAYS = 5, MINE_FAN_SEGS = 5, MINE_FAN_ARC = 18;
  function makeMineFan(m) {
    const half = (mineTune.arcDeg * Math.PI) / 360;
    const v = [];
    const push = (a, b) => { v.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
    // the rays, each a polyline along its own great circle — one straight
    // line to the tip would sink through the ground over 2.5 cells
    for (let r = 0; r < MINE_FAN_RAYS; r++) {
      const th = -half + (2 * half * r) / (MINE_FAN_RAYS - 1);
      for (let k = 0; k < MINE_FAN_SEGS; k++) {
        const c0 = 0.3 + (mineTune.reach - 0.3) * (k / MINE_FAN_SEGS);
        const c1 = 0.3 + (mineTune.reach - 0.3) * ((k + 1) / MINE_FAN_SEGS);
        push(minePoint(m, c0, th), minePoint(m, c1, th));
      }
    }
    // ...and the outer edge, so the reach is a line you can stand behind
    for (let i = 0; i < MINE_FAN_ARC; i++) {
      const t0 = -half + (2 * half * i) / MINE_FAN_ARC;
      const t1 = -half + (2 * half * (i + 1)) / MINE_FAN_ARC;
      push(minePoint(m, mineTune.reach, t0), minePoint(m, mineTune.reach, t1));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: MINE_RED, transparent: true, opacity: 0.22 }));
  }

  function makeMineObj(m) {
    const grp = new THREE.Group();
    // the body: a small dot-cloud disc lying on the ground, the Braille idiom
    const N = 26, dp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // golden angle: evenly covered, and no visible rings at this dot count
      const q = minePoint(m, 0.06 + 0.16 * Math.sqrt((i + 0.5) / N), i * 2.399963);
      dp[i * 3] = q[0]; dp[i * 3 + 1] = q[1]; dp[i * 3 + 2] = q[2];
    }
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const disc = new THREE.Points(dgeo, new THREE.PointsMaterial({
      color: MINE_BLUE, size: 2.6, sizeAttenuation: false, transparent: true, opacity: 0.55 }));
    grp.add(disc);
    // the ring: dim while arming, lit when live. This is the whole readout.
    const R = 28, rp = new Float32Array(R * 3);
    for (let i = 0; i < R; i++) {
      const q = minePoint(m, 0.30, (i / R) * Math.PI * 2);
      rp[i * 3] = q[0]; rp[i * 3 + 1] = q[1]; rp[i * 3 + 2] = q[2];
    }
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    const ring = new THREE.LineLoop(rgeo, new THREE.LineBasicMaterial({
      color: MINE_BLUE, transparent: true, opacity: 0.3 }));
    grp.add(ring);
    const fan = makeMineFan(m);
    grp.add(fan);
    scene.add(grp);
    const v = { grp, disc, ring, fan };
    mineObjs.set(m.id, v);
    syncMineObj(m, v);
    return v;
  }

  function syncMineObj(m, v = mineObjs.get(m.id)) {
    if (!v) return;
    v.ring.material.opacity = m.live ? 0.85 : 0.3;
    v.disc.material.opacity = m.live ? 0.9 : 0.45;
    v.fan.visible = mineArcsShown();
    v.fan.material.opacity = m.live ? 0.22 : 0.08;
  }

  function dropMineObj(id) {
    const v = mineObjs.get(id);
    if (!v) return;
    scene.remove(v.grp);
    v.grp.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    mineObjs.delete(id);
  }

  function clearMines() {
    for (const id of [...mineObjs.keys()]) dropMineObj(id);
    mineField = makeField(mineTune);
  }

  // LAY ONE. The drop is one cell ahead ALONG THE GROUND — arcPoint, not
  // pos + dir*cellSide, for the same reason the beam stopped using a chord.
  // Frozen under exactly the gate the guns obey: a deploy, a shot, a pause,
  // the tutorial's opening hold. Build mode is NOT on that list — the
  // operator's brief is "place them at chokepoints during downtime", and
  // downtime is build mode.
  // S — spend a charge. A TAP, not a hold, and the same shape as layMineNow:
  // the refusal comes from the module and is SHOWN, because three of the four
  // things S can do are refuse, and a dead key that says nothing is
  // indistinguishable from a broken one.
  let shieldDrops=0;
  function stepShieldDynamics(dt,now) {
    const relays=[];
    if(!playerDown && player.pos)for(const tw of towers){
      if(tw.def.attack!=='slowfield')continue;
      const range=effectiveStats(tw.def,tw.tier).range*cellSide;
      if(a6Arc(graph.centers[tw.ci],player.pos)>range)continue;
      relays.push(tw.id);
      // Keep feedback at the tower's cadence; energy is continuous.
      if(now >= (tw.nextTapFx ?? -Infinity)){
        tw.nextTapFx=now+shotInterval(effectiveStats(tw.def,tw.tier).rate);
        const from=towerMuzzle(tw,graph.centers[tw.ci]);
        spawnLightning(from,player.pos,tw.def.color,now);
      }
    }
    const station=!playerDown && player.pos && graph && dungeon.heart!=null
      && a6Arc(player.pos,graph.centers[dungeon.heart])<cellSide*.55;
    if(stepShieldFrame(shield,dt,now,{relays,station},shieldTune)){
      shieldDrops++;
      showToast(`<div class="wave-num">SHIELD DOWN</div>`
        + `<div class="wave-role">${shieldTune.coolSecs}s before another charge will take</div>`,1400);
      record('shield.drop',{wave,now,coolUntil:shield.coolUntil,relays:relays.length});
    }
  }

  function deployShieldNow() {
    if (player.won || playerDown || paused || deploy || !player.pos) return 'frozen';
    const r = deployShield(shield, t, shieldTune);
    if (r === 'ok') {
      sfx.play('tank_pickup');
      pulseButton('#td-pad-shield');
      showToast(`<div class="wave-num">SHIELD UP</div>`
        + `<div class="wave-role">${shieldTune.deploySecs}s &middot; ${shield.rack} charge${shield.rack === 1 ? '' : 's'} left</div>`, 1800);
    } else if (r === 'up') {
      showToast(`<div class="wave-role">the shield is already up &mdash; a charge cannot top it up</div>`, 1400);
    } else if (r === 'cooling') {
      showToast(`<div class="wave-role">emitter cooling &middot; ${(shield.coolUntil - t).toFixed(1)}s</div>`, 1200);
    } else {
      showToast(`<div class="wave-role">no shield charges &mdash; buy a case on the debrief</div>`, 1400);
    }
    if (shieldProbeOn) console.log(`SHIELDPROBE deploy=${r} t=${shield.t.toFixed(2)} rack=${shield.rack}`);
    updateHud();
    return r;
  }

  function layMineNow() {
    if (player.won || playerDown || paused || deploy || !player.pos) return 'frozen';
    if ((shotActive() && !(director && shot && shot.id === 'director')) || tutorial.frozen) return 'frozen';
    const n = norm3(player.pos);
    const d = norm3(sub3(player.smoothDir, scale3(n, dot3(player.smoothDir, n))));
    const pos = arcPoint(n, d, cellSide);
    const ci = cellIndex(pos);
    const blocked = ci < 0 || dungeon.tags[ci] === BLOCKED;
    const occupied = ci >= 0 && (towerByCell.has(ci) || ci === serverCi);
    const r = layMine(mineField, { pos, dir: d, cellAhead: ci, blocked, occupied }, t, mineTune);
    if (r === 'laid') {
      makeMineObj(mineField.mines[mineField.mines.length - 1]);
      sfx.play('tank_pickup');
      pulseButton('#td-pad-mine');
    }
    updateHud();
    if (mineProbeOn) console.log(`MINEPROBE lay ${r} ci=${ci} left=${mineField.count}`);
    return r;
  }

  // THE BLAST. One array of points goes to the module and one array of
  // indices comes back; the ORDER of that array is the contract that says
  // which door each target goes through — enemies, then live gates, then the
  // tank. Building it in one place is what keeps the three from disagreeing.
  function blowMine(m, tNow) {
    const live = enemies.filter((e) => e.alive);
    const gates = spawnPoints.filter((sp) => sp.alive);
    const pts = live.map((e) => e.pos)
      .concat(gates.map((sp) => graph.centers[sp.ci]))
      .concat([playerDown ? null : player.pos]);
    const { targets, chain: chained } = trip(mineField, m, pts, cellSide, mineTune);
    dropMineObj(m.id);
    const ci = m.ci >= 0 ? m.ci : cellIndex(m.pos);
    if (ci >= 0) warnRing(ci, MINE_RED, 0.45, cellSide * mineTune.reach);
    sfx.play('tank_main');
    let kills = 0, gateHits = 0, tankHit = false, hurt = 0;
    for (const i of targets) {
      if (i < live.length) {
        const e = live[i];
        const burst = makeDotBurst(MINE_RED, norm3(e.pos), 24);
        burst.scale.setScalar(cellSide * 0.5);
        burst.position.set(e.pos[0], e.pos[1], e.pos[2]);
        scene.add(burst); debris.push(burst);
        hurt++;
        if (damageEnemy(e, tNow, mineTune.damage, true, 'mine')) kills++;
      } else if (i < live.length + gates.length) {
        gateTakesShell(gates[i - live.length]);
        gateHits++;
      } else {
        // FRIENDLY FIRE IS THE POINT (operator). A claymore does not know
        // whose it is; the same door a ram hit uses, so the shield and the
        // lab's immortal tank behave identically.
        tankHit = true;
        playerHit('mine');
      }
    }
    if (chained.length) chain(mineField, chained);
    if (mineProbeOn) {
      console.log(`MINEPROBE blast id=${m.id} targets=${targets.length} hurt=${hurt}`
        + ` kills=${kills} gates=${gateHits} tank=${tankHit ? 'HIT' : '-'} hp=${playerHP}`
        + ` chain=[${chained.join(',')}] rack=${mineField.count}`);
    }
    updateHud();
    checkVictory();
  }

  // Per frame, after the enemies have moved. A chained mine owes its blast
  // FIRST and one per frame, so a laid row goes off as a row rather than as
  // one flash — the reason chain() is a queue and not a loop.
  function stepMines(dt, tNow) {
    if (!graph || !mineField.mines.length) return;
    const armed = armMines(mineField, tNow, mineTune);
    for (const id of armed) {
      const m = mineField.mines.find((x) => x.id === id);
      if (m) syncMineObj(m);
    }
    if (armed.length) sfx.play('field_pulse');
    const queued = nextChained(mineField);
    if (queued) { blowMine(queued, tNow); return; }
    for (const m of mineField.mines) {
      if (!m.alive || !m.live) continue;
      let trod = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (inFan(m, e.pos, cellSide, mineTune)) { trod = true; break; }
      }
      if (!trod && !playerDown && player.pos && inFan(m, player.pos, cellSide, mineTune)) trod = true;
      if (trod) { blowMine(m, tNow); return; }   // one detonation per frame
    }
  }

  // A case from the yard or the debrief. What does not fit is LOST and said
  // so — the cap is a decision about when to spend, not a silent ceiling.
  function mineCase(where) {
    const got = restock(mineField, mineTune.caseSize, mineTune);
    const lost = mineTune.caseSize - got;
    showToast(`<div class="wave-num">MINE CASE &#9656; +${got}</div>`
      + `<div class="wave-role">${where} &middot; rack ${mineField.count}/${mineTune.cap}`
      + `${lost ? ` &middot; ${lost} over the cap, lost` : ''}</div>`, 2400);
    sfx.play('tank_pickup');
    updateHud();
    return got;
  }

  function killProjectile(i) {
    scene.remove(projectiles[i].mesh);
    projectiles[i].mesh.geometry.dispose();projectiles[i].mesh.material.dispose();
    projectiles.splice(i, 1);
  }

  // shells breach walls: the cell blows apart the way a tank does (a
  // stand-in wall block feeds makeDebris), opens to floor, and the
  // heart-distance field is re-laid — everyone's nav sees the new gap,
  // enemies included. Clearing your path can shorten theirs.
  function blastWall(ci) {
    if (!breachWallCell(ci)) return;
    rebuildAfterBreach();
  }

  // The tag flip and the debris, WITHOUT the rebuild — so a strike that
  // breaches half a dozen cells pays for one BFS and one geometry build,
  // not six of each.
  function breachWallCell(ci) {
    if (ci === serverCi) return false; // the server is INVINCIBLE — no missile opens it
    if (towerByCell.has(ci)) return false; // a mounted tower anchors its wall
    // ...but an ORDER is not a tower. A queued build does not anchor anything,
    // so the wall goes and Isao is left flying to a site that no longer
    // exists. finishOrder would refuse it on arrival, but silently and late —
    // the biomass should come back the moment the ground does, and he should
    // not spend the trip.
    if (orderByCell.has(ci)) cancelOrder(ci, 'the wall under your order was blown out');
    breachedCells.add(ci); // demolition is permanent across rounds
    dungeon.tags[ci] = PATH;
    const c = graph.centers[ci];
    const n = graph.normals[ci];
    // wall hue, brightened: several looks keep sides near-black and the
    // scatter has to read against them
    const side = look().walls.side;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(cellSide * 0.9, params.wallHeight, cellSide * 0.9),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(
        Math.min(1, side[0] * 4 + 0.1), Math.min(1, side[1] * 4 + 0.1), Math.min(1, side[2] * 4 + 0.1)) }));
    const bp = scale3(c, 1 + params.wallHeight * 0.5);
    block.position.set(bp[0], bp[1], bp[2]);
    tmpN.set(n[0], n[1], n[2]);
    block.quaternion.setFromUnitVectors(Y_AXIS, tmpN);
    const fx = makeDebris(block, n);
    scene.add(fx);
    debris.push(fx);
    block.geometry.dispose();
    block.material.dispose();
    return true;
  }

  function rebuildAfterBreach() {
    dungeon.distToHeart = bfsDist(graph.adj, [dungeon.heart], (i) => dungeon.tags[i] !== BLOCKED);
    buildGeometry();
  }

  function updateProjectiles(dt, tNow) {
    const v = 3.4 * cellSide;
    const maxDist = 10 * cellSide;
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.pos = norm3(add3(p.pos, scale3(p.dir, v * dt)));
      const n = p.pos;
      p.dir = norm3(sub3(p.dir, scale3(n, dot3(p.dir, n))));
      p.dist += v * dt;
      const lift = 1 + params.wallHeight * 0.5;
      p.mesh.position.set(p.pos[0] * lift, p.pos[1] * lift, p.pos[2] * lift);
      // nose along flight, rifling spin about the flight axis
      tmpV.set(p.dir[0], p.dir[1], p.dir[2]);
      p.mesh.quaternion.setFromUnitVectors(Y_AXIS, tmpV);
      p.mesh.rotateY(p.dist * 60);

      // creature contact: fodder dies to one shell, the dangerous tier
      // soaks its hp and reacts (slows / ACCELERATES) while it lasts
      let hit = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (dist3(p.pos, e.pos) < cellSide * Math.max(0.45, (e.size ?? e.spec.size) * 0.8)) {
          // NINE shells a rack, each one precious — so each one is an
          // EVENT (operator ruling): a direct hit one-shots everything
          // below the heavy tier (dmg 4 kills up to the rolling mine;
          // prime and the Thorus soak it and remember), and the splash
          // genuinely clears a pocket rather than shaving it.
          // count what THIS shell kills — direct hit plus the splash below —
          // by the only honest method: live bodies before and after
          const aliveBeforeShell = enemies.reduce((n2, x) => n2 + (x.alive ? 1 : 0), 0);
          damageEnemy(e, tNow, 4, true, 'tank');
          const SHELL_R = cellSide * 2.0;
          for (const e2 of enemies) {
            if (e2 === e || !e2.alive) continue;
            const d2 = dist3(p.pos, e2.pos);
            if (d2 < SHELL_R) {
              damageEnemy(e2, tNow, d2 < SHELL_R * 0.5 ? 2 : 1, false, 'tank');
            }
          }
          if (rs) {
            const killedByShell = aliveBeforeShell
              - enemies.reduce((n2, x) => n2 + (x.alive ? 1 : 0), 0);
            rs.shells++;
            if (killedByShell > rs.bestShell.kills) rs.bestShell = { kills: killedByShell, wave };
          }
          // an explosion you can HEAR and SEE: the heavy blast lands at
          // the impact (fire already played tank_main at the muzzle), and
          // the strike's full three-ring language at shell scale
          sfx.play('blast_fire', { dist: camDist(p.pos) });
          const sci = cellIndex(p.pos);
          if (sci !== -1) {
            warnRing(sci, 0xffffff, 0.55, SHELL_R * 1.1);
            warnRing(sci, 0xffb347, 0.4, SHELL_R * 0.65);
            warnRing(sci, 0xfff2c0, 0.28, SHELL_R * 0.35);
          }
          const clip = makeDotBurst(0xfff2c0, norm3(p.pos), 90);
          clip.scale.setScalar(cellSide * 1.6);
          const cp = add3(p.pos, scale3(norm3(p.pos), cellSide * 0.15));
          clip.position.set(cp[0], cp[1], cp[2]);
          scene.add(clip);
          debris.push(clip);
          hit = true;
          break;
        }
      }
      // spawn points soak 3 hits; a landed shell also marks the source
      // FOUND — the minimap beacon starts pulsing
      if (!hit) {
        for (const sp of spawnPoints) {
          if (!sp.alive) continue;
          if (dist3(p.pos, graph.centers[sp.ci]) < cellSide * 0.6) {
            hit = true;
            gateTakesShell(sp);
            updateHud();
            break;
          }
        }
      }
      if (hit) { killProjectile(i); checkVictory(); continue; }

      // wall impact: the shell BREACHES it — one wall per shell.
      // cellIndex is the voxel hash every other collision query on the board
      // already uses. This used to scan EVERY cell per shell per frame — with
      // three shells in the air on a 2,000-cell board that is 6,000 distance
      // checks a frame for an answer the hash gives in one lookup.
      const bestCi = cellIndex(norm3(p.pos));
      if (bestCi !== -1 && dungeon.tags[bestCi] === BLOCKED) {
        blastWall(bestCi);
        killProjectile(i);
        continue;
      }
      if (p.dist > maxDist) killProjectile(i);
    }
  }


  // --- far-field rewards ----------------------------------------------------
  // no ammo sphere: the bullet triad already IS the ammo pickup — two
  // shapes meaning the same thing taught nothing (operator cut)
  // one table, shared with the unit viewer — see src/pickups.js. A second
  // copy would drift the first time a colour or an effect changed, and the
  // viewer would start teaching the player something that is not true.
  const REWARD_TYPES = PICKUPS;

  function clearRewards() {
    for (const r of rewardMeshes.values()) {
      scene.remove(r.obj);
      disposeObj(r.obj); // a solid reward is a GROUP: it has no .geometry
    }
    rewardMeshes.clear();
  }

  function farCells() {
    let maxD = 0;
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] !== BLOCKED) maxD = Math.max(maxD, dungeon.distToHeart[i]);
    }
    const far = [];
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] !== BLOCKED && dungeon.distToHeart[i] >= maxD * 0.55
        && !rewardMeshes.has(i)) far.push(i);
    }
    return far;
  }

  function placeReward(spec, ci) {
    const r = cellSide * 0.24;
    const obj = makeRewardSolid(spec.shape, { body: spec.body, hi: 0xffffff }, whim() * 6.283);
    obj.scale.setScalar(r);
    obj.userData.sizeScale = r;
    const c = graph.centers[ci];
    const n = graph.normals[ci];
    obj.position.set(c[0] + n[0] * r * 1.2, c[1] + n[1] * r * 1.2, c[2] + n[2] * r * 1.2);
    scene.add(obj);
    rewardMeshes.set(ci, { obj, type: spec.type });
  }

  function spawnRewards() {
    clearRewards();
    // ...and on a rescue, nothing regrows either: the shell rack is the
    // mission's currency and a triad lying in a corridor refunds it.
    if (missionOn) return;
    regrowQueue.length = 0; // a new board owes nothing to the old one's picks
    const far = farCells();
    for (let k = 0; k < params.rewards && far.length > 0; k++) {
      const ci = far.splice(Math.floor(whim() * far.length), 1)[0];
      placeReward(REWARD_TYPES[k % REWARD_TYPES.length], ci);
    }
  }

  // Consumables REGROW. Health and heart-regen are the two pickups a long
  // round genuinely runs out of — power stays one-shot (a permanent buff
  // that respawned would be a farm). Each consumed orb schedules one
  // replacement on the far field after a beat; placement reuses the same
  // whim() stream, so a replayed seed regrows identically.
  const REGROW_TIME = 50; // s from pickup to the replacement appearing
  const regrowQueue = []; // { type, t } in runContext.time
  function stepRegrow() {
    while (regrowQueue.length && runContext.time >= regrowQueue[0].t) {
      const job = regrowQueue.shift();
      const spec = REWARD_TYPES.find((sp) => sp.type === job.type);
      const far = farCells();
      if (!spec || far.length === 0) continue;
      const ci = far[Math.floor(whim() * far.length)];
      placeReward(spec, ci);
    }
  }

  function checkRewards() {
    if (playerDown) return; // a wreck picks nothing up
    const r = rewardMeshes.get(player.cur);
    if (r) {
      scene.remove(r.obj);
      disposeObj(r.obj); // a solid is a GROUP — .geometry.dispose() would throw
      rewardMeshes.delete(player.cur);
      sfx.play('tank_pickup');
      if (r.type === 'power') speedBonus *= 1.08;
      else if (r.type === 'health') playerHP = Math.min(PLAYER_MAX, playerHP + 1);
      else if (r.type === 'regen') carryingRegen = true;
      else if (r.type === 'shield') {
        chargeShield(shield, shieldTune.pickup, shieldTune);
        sfx.play('tank_spool_up'); // the bubble igniting
        showToast(`<div class="wave-num">SHIELD UP</div>`
          + `<div class="wave-role">${shieldTune.pickup}s — touch damage bounces off</div>`, 2200);
      }
      if (r.type === 'health' || r.type === 'regen' || r.type === 'shield') {
        regrowQueue.push({ type: r.type, t: runContext.time + REGROW_TIME });
      }
      updateHud();
    }
    // deliver a carried regen: near the Heart, it heals
    if (carryingRegen && dungeon.distToHeart[player.cur] <= 2) {
      carryingRegen = false;
      heartHP = Math.min(HEART_MAX, heartHP + 4);
      updateHud();
    }
    stepRegrow();
    for (const orb of rewardMeshes.values()) orb.obj.userData.tick(runContext.time);
  }

  // --- enemy fire ------------------------------------------------------------
  // The tank dying should be an EVENT. Losing hover is the throughline: the
  // hull drops, the wreck rocks hard on its suspension, and the body bursts.
  // The modal is held back until that has played, or the death reads as a
  // dialog box rather than a destruction.
  const DEATH_HOLD = 1.15; // s of wreck before the modal
  function destroyPlayer() {
    if (director && director.sc.immune !== false) return;   // a scripted run cannot be lost

    if (!playerMesh) return;
    stopEngine(0.12, true);   // quiet: the hydraulics don't get to set it down
    feel.hoverT = 0;          // hover fails instantly — it DROPS
    landTankFeel(feel);       // and rocks hard as it lands
    sfx.play('tank_destroyed');
    const nrm = norm3(player.pos);
    const fx = makeDebris(playerMesh, nrm);
    scene.add(fx);
    debris.push(fx);
    const burst = makeDotBurst(look().walkerHi, nrm, 54);
    burst.scale.setScalar(cellSide * 0.9);
    const bp = add3(player.pos, scale3(nrm, cellSide * 0.25));
    burst.position.set(bp[0], bp[1], bp[2]);
    scene.add(burst);
    debris.push(burst);
    playerMesh.visible = false;
    playerDown = true;
  }

  // Watching the wreck should not cost a round. This plays the destruction
  // and then puts the tank back, so it can be run over and over from the
  // panel while tuning. It deliberately does NOT touch game state — nothing
  // here ends the run.
  function previewDestruction() {
    if (player.won || !playerMesh) return;
    destroyPlayer();
    runTimers.after(DEATH_HOLD * 1000, () => {
      if (player.won || !playerMesh) return; // a real death happened meanwhile
      playerMesh.visible = true;
      playerDown = false;
      feel.hoverT = 0;
      landTankFeel(feel);   // it drops back in and settles
    });
  }

  // hover (or tap) a killer's icon on the last transmission: its dossier
  // fills the line below — name, role, and the stats that killed you
  msgEl.addEventListener('pointerover', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('go-killer')) return;
    const type = el.dataset.ktype;
    const spec = ENEMY_SPEC[type];
    const intro = INTROS.find((iv) => iv.type === type);
    const info = msgEl.querySelector('.go-kinfo');
    if (!spec || !info) return;
    info.innerHTML = `<b>${intro ? intro.label : type.toUpperCase()}</b>`
      + ` — ${intro ? intro.role : ''} · ${spec.hp} hp · speed ${spec.speed}`
      + ` · ${spec.rammable ? 'rammable' : '<span class="go-noram">DO NOT RAM</span>'}`
      + ` · bounty ${spec.bounty}`;
  });

  // The verdict lists. Three tiers by how far the run got; picked by
  // score modulo (deterministic per run — a replayed seed gets the same
  // eulogy). Low tier is the low-key diss track the operator ordered.
  const VERDICT_LOW = [
    'SNAFU · K-KILL ×3 · try harder next time',
    'THAT WAS THE TUTORIAL, LAD',
    'the heart deserved better',
    'portals 2 · you 0 · do the math',
    'walked the wrong pole, soldier',
    'the phage send their regards',
    'logistics called — they want the tank back',
    'a bold strategy: dying early',
    'brief. very brief.',
    'the SITREP is one word long: OOF',
  ];
  const VERDICT_MID = [
    'GOOD RUN, LAD',
    'held the line — for a while',
    'a proper scrap, that one',
    'the heart remembers who stood',
    'they earned that one. barely.',
    'decent tread-work, commander',
    'the wall of you nearly held',
    'a fighting retreat, well fought',
    'they will find the wreck FACING them',
    'not the worst transmission we have logged',
  ];
  const VERDICT_HIGH = [
    'OUTSTANDING, COMMANDER',
    'the sector will sing of this',
    'textbook defense · filthy execution',
    'a masterclass in applied violence',
    'the portals BLINKED first',
    'carve this one into the hull',
    'the heart beat louder for you',
    'legendary tread-work · the ranks agree',
    'they will teach this run at the academy',
    'send THIS transmission twice',
  ];
  function loseGame(reason) {
    if (director && director.sc.immune !== false) return;   // a scripted run cannot be lost

    if (player.won) return;
    // A RESCUE ALWAYS ENDS WITH A NUMBER, and with ITS OWN CARD. "Four of
    // six, and the fifth was in the hatch" is the story the mode exists to
    // produce, so the last hull going is an ENDING with a score rather than a
    // game over with none — and the campaign's verdict, which counts sectors,
    // towers and portals this mission never had, must not run on top of it.
    if (missionOn) {
      player.won = true;      // the run is over; the same flag every ending uses
      destroyPlayer();
      endRescue(reason);
      return;
    }
    player.won = true; // stops motion; same flag, sadder modal
    destroyPlayer();
    ramCombo = 0; ramComboT = 0; syncCombo(); // no brag over a lost heart
    // the verdict: tier by distance travelled, line by score (deterministic)
    const tierList = wave >= 9 || round >= 2 ? VERDICT_HIGH
      : wave >= 4 ? VERDICT_MID : VERDICT_LOW;
    const verdict = tierList[score.points % tierList.length];
    const newBest = score.points >= score.best && score.points > 0;
    // kills histogram, tinted per enemy (the SitRep's row idiom)
    const total = rs ? Object.values(rs.kills).reduce((a, b) => a + b, 0) : 0;
    const top = rs ? Math.max(1, ...Object.values(rs.kills)) : 1;
    const rows = rs ? Object.entries(rs.kills).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([type, k]) => {
        const tint = '#' + (CREATURE_TINTS[type] ?? 0xffffff).toString(16).padStart(6, '0');
        return `<div class="sr-row"><span class="sr-name">${type}</span>`
          + `<span class="sr-track"><span class="sr-bar" style="width:${Math.round((k / top) * 100)}%;background:${tint}"></span></span>`
          + `<span class="sr-n">${k}</span></div>`;
      }).join('') : '';
    // who took each tank: icon cards for the killers, in order
    const killers = rs && rs.killers.length
      ? `<div class="go-killers">TANKS LOST TO ${rs.killers.map((type) =>
        `<img class="go-killer" data-ktype="${type}" src="${spriteShot(type, unitIcon(type, CREATURE_TINTS[type] ?? 0xffffff))}">`
      ).join('')}<div class="go-kinfo">hover a killer for its file</div></div>`
      : `<div class="go-killers">hull intact to the end — the heart fell first</div>`;
    const spark = rs && rs.scoreBins.length >= 3
      ? `<div class="sr-line sr-spark">SCORE ${sparkline(rs.scoreBins.map((v, i, a) => v - (a[i - 1] ?? 0)))}</div>` : '';
    // the operator's wording, verbatim: LAST TRANSMISSION — SNAFU,
    // K-KILL ×(hulls destroyed) — THEN the eulogy and the numbers
    const kkill = PLAYER_MAX - Math.max(0, playerHP);
    const forfeit = '';
    msgEl.innerHTML = `<div class="msg-head">LAST TRANSMISSION</div>`
      + `<div class="go-snafu">SNAFU · K-KILL ×${kkill}</div>`
      + forfeit
      + `<div class="go-verdict${newBest ? ' best' : ''}">${verdict}</div>`
      + `<div class="go-reason">× ${reason}</div>`
      + `<div class="go-grid">`
      + `<span>SCORE <b>${fmt(score.points)}</b>${newBest ? ' <i class="go-best">NEW BEST</i>' : ` · best ${fmt(score.best)}`}</span>`
      + `<span>WAVE <b>${wave}</b> · R${round}</span>`
      + `<span>KILLS <b>${total}</b> — tank ${rs ? rs.bySrc.tank : 0} · towers ${rs ? rs.bySrc.tower : 0} · orbital ${rs ? rs.bySrc.strike : 0}</span>`
      + `<span>RAMS <b>${rs ? rs.rams : 0}</b> · best combo ×${rs ? rs.maxCombo : 0} · strikes ${rs ? rs.strikes : 0}</span>`
      + `<span>heart ${Math.max(0, heartHP)}/${HEART_MAX} · rank ${rs && rs.maxRank > 0 ? rankLabel(rs.maxRank) : 'unranked'}</span>`
      + `</div>`
      + runAchvBlock()
      + rows + spark + killers
      + `<button class="msg-regen">⟲ new sector</button>`;
    // let the wreck play before the modal covers it
    setTimeout(() => msgEl.classList.remove('hidden'), DEATH_HOLD * 1000);
  }

  function playerHit(killerType = null, fromPos = null) {
    // the lab's tank is a timer with no body to lose: the shove stays, so
    // being hit still reads, and the hull counter never moves
    if (lab.on && lab.immortalTank) { bumpLeft = Math.max(bumpLeft, BUMP_LEN * 0.5); return; }
    // the shield takes it: a ripple on the bubble AT THE POINT OF CONTACT,
    // nothing on the hull
    if (shieldUp()) {
      if (shieldObj && shieldObj.userData.hit) {
        // the shell is scene-level and carries the hull's rotation, so the
        // contact direction has to come back through its own transform.
        // Re-deriving it with a fresh sign convention is exactly the bug the
        // house rule about render-coupled values exists to prevent.
        const src = fromPos || player.pos;
        const w = new THREE.Vector3(src[0], src[1], src[2]);
        const l = shieldObj.worldToLocal(w).normalize();
        if (Number.isFinite(l.x)) shieldObj.userData.hit([l.x, l.y, l.z]);
      }
      bumpLeft = Math.max(bumpLeft, BUMP_LEN * 0.5); // the impact still SHOVES
      return;
    }
    playerHP--;
    run.hullsLost++;
    checkAchievements();
    if (rs && killerType) rs.killers.push(killerType);
    updateHud();
    if (playerHP > 0) { loseTank(); return; }
    loseGame('your last tank is gone');
  }

  // Losing a tank is an EVENT, not a subtraction. It used to be neither: the
  // hull counter ticked down and the machine carried on driving, so the most
  // consequential thing that can happen to you was invisible.
  //
  // Now it explodes, and you come back in BUILD — pulled up and out, looking
  // at the whole board, with the wall you did not have time to buy still
  // unbought. That is the decision the loss should hand you, and it is the
  // one place the game can make you take it.
  const DOWN_DASH = 1.0;   // seconds of camera, wreck -> camp

  function loseTank() {
    if (director && director.sc.immune !== false) return;   // a scripted run is not a run that can be lost

    // THE RANK SURVIVES THE HULL (operator, 2026-09-02). It used to be
    // stripped here — "the insignia belonged to that hull" — and that was a
    // read of who the tank IS. The tank is not the pilot. The pilot is the
    // player: a disembodied thing that occupies one machine at a time, which
    // is the only reason it cannot drive them all at once. Burning a hull
    // costs you the hull.
    //
    // What still dies with the wreck is the RAM COMBO, because that one is
    // genuinely the machine's momentum and nothing carries it out.
    // THE BET, COLLECTED. Anyone in the hatch is lost with the hull — the
    // only way a survivor who was already safe dies, and the reason carrying
    // a pair is a bet rather than an optimisation.
    if (rescueOn) {
      const gone = loseCarried(rescue);
      if (gone > 0) {
        showToast(`<div class="td-down">${gone} LOST WITH THE HULL</div>`
          + `<div class="td-down-sub">they were aboard</div>`, 3000);
      }
    }
    const carried = tankRank > 0 ? rankLabel(tankRank) : '';
    destroyPlayer();
    ramCombo = 0; ramComboT = 0; syncCombo(); // the combo died with it

    // BEAT 1 — the wreck, and the word for it. Losing a hull is the most
    // consequential thing that happens to you and it used to be a toast the
    // size of a wave announcement.
    showToast(`<div class="td-down">MK-CX DOWN!</div>`
      + `<div class="td-down-sub">${playerHP} left`
      + `${carried ? ` · ${carried} carries over` : ''}</div>`,
      (DEATH_HOLD + DOWN_DASH) * 1000);

    // THE DEAD RUN'S TIMER MUST NOT LAND ON THE LIVE ONE. This hold is
    // 1.15s long and RETRY sits on a modal the player can hit inside it —
    // and it used to fire regardless, repositioning a brand-new tank,
    // snapping the camera to orbit and toasting on a run that had lost
    // nothing. Measured, not supposed: ?ctlprobe=1.
    runTimers.after(DEATH_HOLD * 1000, () => {
      if (player.won || !playerMesh) return;   // a real death happened meanwhile
      const n = berthIndexFor(playerHP);
      // the view the next hull will be driven in — chosen BEFORE the dash, so
      // the pose the dash flies to is the pose the game is about to use
      if (!buildMode) setView('orbit');
      const from = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
      // BEAT 2 — THE DOWN DASH. The camera runs home from the wreck and
      // lands on DEPLOY's opening pose. It used to cut: setView + snapCamera,
      // and you were suddenly somewhere else. Same join the cinematic uses,
      // so a death and a fresh load arrive at an identical frame.
      startShot({
        id: 'downdash',
        dur: DOWN_DASH,
        poseAt: (u, out) => {
          const w = u * u * (3 - 2 * u);
          deployFramePoseFor(n, camA);
          out.pos.lerpVectors(from.pos, camA.pos, w);
          out.quat.copy(from.quat).slerp(camA.quat, w);
        },
        // BEAT 3 — the next hull rolls out of its berth, live.
        onEnd: () => {
          tankLostDeploys++;
          playerMesh.visible = true;
          playerDown = false;
          feel.hoverT = 0;
          landTankFeel(feel);
          applyTankHealth(playerMesh, playerHP / PLAYER_MAX);
          deployStart(n);   // no snapCamera: DEPLOY blends on from here
        },
      });
    });
  }

  // Respawn beside the HEART, not at the spawn gate. The gate is enemy
  // ground by the time you die — a wave is usually pouring out of it — so
  // the old respawn put the wreck straight back into the thing that made it
  // a wreck, and sometimes BEHIND a portal with the wave between you and
  // home. You come back at the thing you are defending, facing outward.
  // --- DEPLOY: the one way a tank enters the world ------------------------
  // Every reset lands here, whatever ran before it — a fresh page load, a
  // retry after a loss, a forced reset, a hull lost mid-run. The hull starts
  // at rest inside its berth, drives ENTIRELY OUT, and hands over in manual.
  // Preludes (the CINEMATIC, the DOWN DASH) differ only in what the camera
  // was doing beforehand; they all end on DEPLOY's first frame, which is what
  // makes the opening state identical however you got to it.
  //
  // "Entirely out" is measured in CELLS, not in metres of model: the box
  // occupies its berth cell, so a hull whose centre has reached the exit
  // cell's centre is clear of it by construction. That stays true when the
  // container model has not loaded at all — which it may not have, since the
  // model is now decoration and DEPLOY does not wait for it.
  //
  // DEPLOY is NOT auto mode and NOT cruise. Auto stays something the player
  // chooses (operator, 2026-09-01); and cruise left engaged by a berth
  // respawn is precisely what made the throttle lever read as dead. It is its
  // own short scripted beat, and it ends with the controls in the player's
  // hands and the lever at zero.
  let deploy = null;   // { n, from[3], to[3], segLen, travelled }
  const deployActive = () => deploy !== null;

  function deployStart(n) {
    const b = berths[n];
    if (!b || !graph) return false;
    deployCount++;
    ctlLog(`deploy:#${n + 1}`);
    player.freeMode = false;
    player.virtualStart = null;
    player.cur = b.ci;
    player.prev = -1;
    player.pos = graph.centers[b.ci].slice();
    player.prog = 0;
    player.next = b.exit;
    player.heading = tangentDirTo(b.ci, b.exit);
    player.travelDir = player.heading.slice();
    player.smoothDir = player.travelDir.slice();
    player.segLen = Math.max(1e-9, dist3(graph.centers[b.ci], graph.centers[b.exit]));
    throttle = 0; cruise = false; autoMode = false;
    paintThrottle();
    stopEngine(0.1, true);
    // only what is NOT derivable: which berth, and how far out we are. from,
    // to and segLen were all functions of `n` and drifted-by-construction.
    deploy = { n, travelled: 0 };
    return true;
  }

  // THE POSE THE WHOLE DESIGN HANGS OFF. Every prelude's last frame is this,
  // so "the cinematic's last frame is the first frame of the reset state" is
  // a property of the code rather than something tuned until it looks right.
  // A low three-quarter standing where the doors face, so the hull rolls
  // toward the lens.
  function deployFramePoseFor(n, out) {
    const b = berths[n];
    if (!b) return;
    const bc = graph.centers[b.ci];
    const bn = graph.normals[b.ci];
    const eye = add3(add3(bc, scale3(bn, params.wallHeight * 1.7 + cellSide * 0.55)),
      scale3(tangentDirTo(b.ci, b.exit), cellSide * 2.1));
    const look = add3(bc, scale3(bn, params.wallHeight * 0.55));
    out.pos.set(eye[0], eye[1], eye[2]);
    tmpCam.position.copy(out.pos);
    tmpCam.up.set(bn[0], bn[1], bn[2]);
    tmpCam.lookAt(look[0], look[1], look[2]);
    out.quat.copy(tmpCam.quaternion);
  }

  // how far through the drive-out we are, eased — the camera blend and the
  // motion share one progress value so they cannot disagree
  function deployProgress() {
    if (!deploy) return 1;
    const b = berths[deploy.n];
    if (!b) return 1;
    const segLen = Math.max(1e-9,
      dist3(graph.centers[b.ci], graph.centers[b.exit]));
    return Math.min(1, deploy.travelled / segLen);
  }
  function deployEase() {
    const u = deployProgress();
    return u * u * (3 - 2 * u);
  }

  // ...and the same liveness check on DEPLOY, which owns the camera between
  // the cinematic's last frame and the player's first. Its length is known:
  // the berth's own segment at the drive speed. A deploy that has been
  // running several times that is not deploying — and a stalled one leaves
  // the hull in its berth with the camera on the berth framing, which is the
  // other pose that is neither third nor orbit.
  const DEPLOY_GRACE = 6.0;
  function deployStep(dt) {
    if (!deploy) return;
    const b = berths[deploy.n];
    if (!b) { deploy = null; return; }
    const v = params.speed * speedBonus * cellSide * 1.6;
    deploy.age = (deploy.age || 0) + dt;
    const segLen = Math.max(1e-9, dist3(graph.centers[b.ci], graph.centers[b.exit]));
    // A DEPLOY WITH NO SPEED IS HUNG BY DEFINITION, so its expected duration
    // is ZERO, not Infinity. The first cut wrote Infinity here — mathematically
    // honest, and it made the one case this check exists for
    // (`params.speed` at 0, the hull never leaving the berth) the one case it
    // could never catch. The ?hangprobe caught that, which is the entire
    // reason a watchdog gets a test that fires it.
    const expect = v > 1e-9 ? segLen / v : 0;
    if (deploy.age > expect * 2 + DEPLOY_GRACE) {
      console.warn(`SHOTWATCH deploy hung: ${deploy.age.toFixed(1)}s for a ${Number.isFinite(expect) ? expect.toFixed(1) : '∞'}s`
        + ` run (speed=${params.speed} bonus=${speedBonus}) — handed over`);
      shotWatchFires++;
      shotWatchLast = `deploy ${deploy.age.toFixed(1)}s/${Number.isFinite(expect) ? expect.toFixed(1) : '∞'}s`;
      deploy.travelled = segLen;   // finish it where it was going, then hand over
    }
    deploy.travelled += v * dt;
    const u = deployProgress();
    const from = graph.centers[b.ci];
    const to = graph.centers[b.exit];
    const p = [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * u);
    player.pos = norm3(p);
    player.heading = tangentDirTo(b.ci, b.exit);
    player.travelDir = player.heading.slice();
    player.smoothDir = player.travelDir.slice();
    const ci = cellIndex(player.pos);
    if (ci !== -1 && ci !== player.cur) arriveAt(ci);
    if (u >= 1) {
      // hands over: manual, lever at zero, auto off. Because `keys` is HELD
      // state, a player already leaning on W drives on without a beat — and
      // forward is the direction the hull is already going, so the handover
      // is continuous rather than a stop.
      deploy = null;
      deploysDone++;
      throttle = 0; cruise = false; autoMode = false;
      paintThrottle();
    }
  }

  function heartHit(dmg = 1) {
    if (director && director.sc.immune !== false) return;
    // ON A RESCUE THE STALHEART IS THE AIRLOCK, NOT THE OBJECTIVE. The
    // creature is still consumed at the call site — the field clears the same
    // way — but the shell takes no damage, because "and also defend the base"
    // is a second objective the brief did not ask for, and a mission about
    // carrying people out should not be lost by something you were not there
    // to stop. A soak proved the point: two minutes on the auto-pilot ended
    // "the heart is lost" at 0/6 with a survivor still standing in the road.
    // The mission ends when the people are accounted for, or when the last
    // hull goes, and at no other moment.
    if (missionOn) return;

    run.heartHits += dmg;
    eco.leak(); // a breach kills the streak — HK's rule, our Heart
    streakMark = 0;
    if (ws) ws.leaks++;
    if (!tutorialActive && !(lab.on && lab.immortalHeart)) heartHP -= dmg;
    heartSprite.userData.hit(); // orange/red Wave flare
    updateHud();
    if (heartHP <= 0) loseGame('the heart is lost');
  }

  // ======================= TOWERS (TD M2) ==================================
  // Slots are open cells; a placed tower is SOLID and blocks pathing (the
  // maze you buy). Placement runs a connectivity guard: no live portal may
  // be cut off from the Heart. Firing/targeting math lives in towers.js;
  // this section owns raycast→cell selection, the shop/upgrade panels,
  // projectile kinds, and the economy hookup.
  const towers = [];              // { key, def, tier, ci, obj, cooldown, spent }
  const towerByCell = new Map();  // ci -> tower
  const towerCells = new Set();
  const towerShots = [];          // { pos, dir, dist, mesh, dmg, splash, homing }
  const beams = [];               // { mesh, ttl } laser + slow-tether fx
  let eco = makeEconomy();
  // Points are not biomass: the scoreboard triples tank kills and scales
  // with how swarmed the field was. Best survives across runs (localStorage);
  // it updates LIVE when beaten, so a crash can't eat a record.
  const BEST_KEY = 'td-best-score-v1';
  let score = makeScore((() => {
    try { return +(localStorage.getItem(BEST_KEY) || 0) || 0; } catch { return 0; }
  })());
  function persistBest() {
    try { localStorage.setItem(BEST_KEY, String(score.best)); } catch { /* private mode */ }
  }
  function scoreKill(bounty, opts) {
    score.addKill(bounty, opts);
    persistBest();
  }

  // HT rule: towers build on the HIGH GROUND only — real wall cells (in
  // the un-sealed world) that border the open sector. Low ground belongs
  // to monsters and the player. No connectivity guard needed: walls never
  // carry enemy pathing, so a tower can never dam a lane.
  function placeError(ci) {
    if (ci === -1) return 'nothing there';
    if (ci === serverCi) return 'the server holds this cell';
    // HIGH GROUND MEANS THERE IS STILL A WALL THERE. This asked tdFullTags —
    // the ORIGINAL map — because dungeon.tags is sector-gated and would call
    // every unrevealed cell blocked. But tdFullTags never learns about a
    // breach: blastWall sets dungeon.tags[ci] = PATH and leaves the full map
    // saying BLOCKED forever, so a breached cell still reported as buildable
    // and a tower went up at wall height over open floor. That is the
    // hovering tower. `breachedCells` is the missing half, and it is already
    // permanent across rounds because demolition is.
    if (tdFullTags[ci] !== BLOCKED || breachedCells.has(ci)) {
      return 'towers need HIGH GROUND';
    }
    if (towerByCell.has(ci)) return 'occupied';
    if (!graph.adj[ci].some((nb) => dungeon.tags[nb] !== BLOCKED)) {
      return 'beyond the frontier';
    }
    return null;
  }

  // One placement recipe, used by placement, upgrade and look-swap alike.
  // Tier bulk is DERIVED from tower.tier here rather than accumulated onto
  // the object with multiplyScalar — otherwise the visual silently carries
  // tier state, and any rebuild (a look swap) would quietly lose it.
  const TIER_BULK = 1.12;
  // HOW BIG A TOWER IS, as a knob rather than a constant baked into a
  // multiply (operator: "the towers feel too big and bulky compared to the
  // tank... smaller and more detailed, more like precision engineering").
  // The models carry far more detail than the old procedural masts did, and
  // detail reads better small — a bulky machine looks moulded, a small one
  // looks machined. ?towerscale= is here so the number can be argued with
  // rather than guessed at once.
  // (its own URLSearchParams: `urlParams` is declared three thousand lines
  // below this and a const in the temporal dead zone throws on read)
  const TOWER_SCALE = (() => {
    const v = parseFloat(new URLSearchParams(location.search).get('towerscale'));
    return Number.isFinite(v) && v > 0.1 && v < 4 ? v : 0.72;
  })();
  function placeTowerObj(tower) {
    const obj = tower.obj;
    const s = (obj.userData.baseScale ?? 1) * cellSide * 0.62 * TOWER_SCALE
      * Math.pow(TIER_BULK, tower.tier);
    obj.scale.setScalar(s);
    // ...and a WALKER is wherever it has walked to. Its own position is a
    // unit direction, so it is its own normal — no cell lookup, because it
    // is very often not standing on one.
    if (tower.a6) {
      const top = 1 + params.wallHeight;
      const p = tower.a6.pos;
      // NO BOB. It was a stand-in for a walk cycle the model could not play,
      // and now that the legs actually move it is just a hop laid over them —
      // which is what "it jumps instead of walking" was. The clip is the
      // walk; the hull rides the ground.
      const going = tower.a6.state === 'patrol' || tower.a6.state === 'engage'
        || tower.a6.state === 'home';
      if (obj.userData.setGait) obj.userData.setGait(going);
      obj.position.set(p[0] * top, p[1] * top, p[2] * top);
      // ...AND IT FACES WHERE IT IS WALKING. Setting `up` alone leaves the
      // heading at whatever the identity quaternion gives, so a machine with
      // six legs and a clear front was crabbing sideways down its own path
      // — half of why the gait did not read. The Workshop's models are +Y up
      // and +Z forward, so the basis is (up × forward, up, forward).
      tmpN.set(p[0], p[1], p[2]);
      const h = tower.a6.head;
      if (h) {
        const up = tmpN.clone();
        const fwd = new THREE.Vector3(h[0], h[1], h[2]);
        // re-orthogonalise against the CURRENT up: the heading was measured
        // one frame ago, a cell away, where "flat" meant a different plane
        fwd.addScaledVector(up, -fwd.dot(up));
        if (fwd.lengthSq() > 1e-12) {
          fwd.normalize();
          const right = up.clone().cross(fwd);
          obj.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(right, up, fwd));
        } else {
          obj.quaternion.setFromUnitVectors(Y_AXIS, tmpN);
        }
      } else {
        obj.quaternion.setFromUnitVectors(Y_AXIS, tmpN);
      }
      return;
    }
    const c = graph.centers[tower.ci];
    const nrm = graph.normals[tower.ci];
    const top = 1 + params.wallHeight; // mounted on the wall's roof
    obj.position.set(c[0] * top, c[1] * top, c[2] * top);
    tmpN.set(nrm[0], nrm[1], nrm[2]);
    obj.quaternion.setFromUnitVectors(Y_AXIS, tmpN);
  }

  // Swap every tower's VISUAL in place. Game state — key, def, tier, cell,
  // cooldown, spend — is untouched; only `obj` is rebuilt. That is the
  // whole point of the registry.
  // Choosing a player unit. Units whose model loads asynchronously build
  // their procedural fallback right now and swap in when the bytes land, so
  // the choice is instant and the tank is never missing.
  function applyCreature() {
    const chosen = params.creature;
    if (chosen === 'mkcx' || chosen === 'mkcx2' || chosen === 'mork') {
      (chosen === 'mork' ? preloadMork() : preloadMkcx(chosen)).then((ok) => {
        if (ok && params.creature === chosen) { buildActors(); placeActors(); }
      });
    }
    buildActors();
    placeActors();
  }

  function applyTowerLook() {
    // A look with async assets builds as the fallback right now and gets
    // re-applied once loaded — so choosing it is instant and never blank.
    const chosen = params.towerLook;
    preloadLook(chosen).then((ok) => {
      if (ok && params.towerLook === chosen) rebuildTowerObjects();
    });
    rebuildTowerObjects();
  }

  function rebuildTowerObjects() {
    for (const tower of towers) {
      scene.remove(tower.obj);
      disposeObj(tower.obj);
      tower.obj = buildTowerLook(params.towerLook, tower.def, tower.tier);
      // the rebuilt obj starts at tier 0 — restore the earned pedestal
      if (tower.obj.userData.setTier) tower.obj.userData.setTier(tower.tier);
      placeTowerObj(tower);
      scene.add(tower.obj);
    }
  }

  // placeTower is now the INSTANT path, and it has exactly two legitimate
  // users left: the opening garrison (pre-built before the run, not ordered)
  // and the ?tower= verification hook. Everything the player asks for goes
  // through Isao.
  // WHERE THE OPENING GARRISON GOES.
  //
  // Forward of the heart, not on top of it. Towers mount on WALL cells, so a
  // candidate is a blocked cell with an open neighbour — and "forward" is
  // that neighbour sitting a few cells out from the heart rather than one.
  // Among those, prefer the sites nearest a live gate, because forward only
  // means anything in the direction the wave actually comes from.
  //
  // The two are also kept apart: the first pass of this put both on the same
  // stretch of wall, which is two towers covering one lane and none covering
  // the other.
  const GARRISON_BAND = [3, 6];    // cells from the heart, inclusive
  const GARRISON_APART = 4;        // cells between the two, minimum
  function garrisonSites(want) {
    const gates = spawnPoints.filter((sp) => sp.alive).map((sp) => sp.ci);
    const cand = [];
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] !== BLOCKED || placeError(i)) continue;
      let best = Infinity;
      for (const nb of graph.adj[i]) {
        const d = dungeon.tags[nb] !== BLOCKED ? dungeon.distToHeart[nb] : -1;
        if (d >= GARRISON_BAND[0] && d <= GARRISON_BAND[1]) best = Math.min(best, d);
      }
      if (best === Infinity) continue;
      // nearest gate, as a straight distance on the sphere in cells
      let toGate = Infinity;
      for (const g of gates) {
        toGate = Math.min(toGate, dist3(graph.centers[i], graph.centers[g]) / cellSide);
      }
      cand.push({ ci: i, toGate: Number.isFinite(toGate) ? toGate : 0, fromHeart: best });
    }
    cand.sort((a, b) => a.toGate - b.toGate);
    const out = [];
    for (const c of cand) {
      if (out.length >= want) break;
      const clear = out.every((o2) =>
        dist3(graph.centers[o2], graph.centers[c.ci]) / cellSide >= GARRISON_APART);
      if (clear) out.push(c.ci);
    }
    // ...and if the band or the spacing could not be satisfied on this board,
    // fall back to ANY legal wall rather than opening with no garrison at all
    if (out.length < want) {
      for (let i = 0; i < dungeon.tags.length && out.length < want; i++) {
        if (dungeon.tags[i] !== BLOCKED || placeError(i) || out.includes(i)) continue;
        if (graph.adj[i].some((nb) => dungeon.tags[nb] !== BLOCKED)) out.push(i);
      }
    }
    return out;
  }

  function placeTower(key, ci) {
    const def = TOWER_BY_KEY[key];
    if (!def) return false;
    const err = placeError(ci);
    if (err) { flashShopNote(err); return false; }
    if (!eco.spend(def.cost)) { flashShopNote('not enough biomass'); return false; }
    commitTower(key, ci, def.cost);
    return true;
  }
  function commitTower(key, ci, spent) {
    const def = TOWER_BY_KEY[key];
    const obj = buildTowerLook(params.towerLook, def);
    const tower = { key, def, tier: 0, ci, obj, cooldown: 0, spent, id: nextTowerId++ };
    // A WALKER IS BORN AT ITS BERTH AND THEN STOPS BEING THERE. The cell it
    // was placed on is its home, not its position — everything else about a
    // tower (the purse, the queue, the upgrade, the sell) is unchanged, and
    // that is deliberate: it is a tower with a life, not a new kind of thing
    // the rest of the board has to know about.
    if (def.attack === 'walker') {
      tower.a6 = makeA6(norm3(graph.centers[ci]), 0);
      tower.hp = def.hullHp ?? 9;
      tower.hp0 = tower.hp;
    }
    placeTowerObj(tower);
    scene.add(obj);
    towers.push(tower);
    towerByCell.set(ci, tower);
    towerCells.add(ci);
    showRangeRing(ci, effectiveStats(def, 0).range, def.color, 1.6);
    updateHud();
    return tower;
  }

  // --- ISAO: the industrial construction drone ---------------------------
  // Nothing the player builds is built by the player. An order is placed,
  // ISAO flies to the cell, and prints. Two clocks stand between wanting a
  // tower and having one — TRAVEL and BUILD — and that is the whole point:
  // a board of towers is now a sequence of decisions with a cost in time,
  // not a purse spent in one gesture. Biomass leaves the purse at ORDER
  // time (a queue you have not paid for is a queue you would spam), and a
  // cancelled order refunds in full, because nothing was printed.
  //
  // He flies high enough that nothing on the ground reaches him. That is a
  // deliberate simplification, not a physics claim: making him killable is
  // a real design lever and it belongs in a decision, not in a default.
  const ISAO_TINT = 0xbfe6ff;      // pale works blue — the CRT is the warm thing on him now
  const ISAO_ALT = 3.4;            // in wall-heights above the wall tops
  let isaoAlt = ISAO_ALT;          // ...and where the pilot has put him
  const ISAO_CELLS_SEC = 2.6;      // cruise, in cells per second
  const ISAO_BUILD_BASE = 2.0;     // seconds before cost is considered
  const ISAO_BUILD_PER_KG = 1 / 55; // ...and per kg of biomass printed
  const buildSeconds = (cost) => ISAO_BUILD_BASE + cost * ISAO_BUILD_PER_KG;
  // the live type-feel values the tuner writes into, restored from storage
  // through the schema's own clamp — our own localStorage is untrusted input
  // after a schema change, same rule as the feel store
  const TYPE = loadTypeFeel();
  // read-only here: whatever was dialled on the bench is already in force
  function applyType() {
    applyFontPack(currentFontPack(), document.documentElement, TYPE);
  }
  applyType();

  let isao = null;                 // { obj, dir[3], state, t, dur, order }
  let assistant = null;            // the second drone, bought with biomass
  const workers = () => (assistant ? [isao, assistant] : [isao]).filter(Boolean);
  const ASSIST_TINT = 0xffb347;    // amber, so the two never read as one drone
  function spawnAssistant() {
    if (assistant || !graph || !dungeon) return Promise.resolve(false);
    return preloadFabricator().then((ok) => {
      if (!ok || assistant || !graph || !dungeon) return false;
      const obj = makeIsaoDrone(ASSIST_TINT);
      if (!obj) return false;
      obj.scale.setScalar(cellSide * 1.15);
      // parked a couple of cells off the heart's other side, so the pair do
      // not spawn inside each other
      const hd = norm3(graph.centers[dungeon.heart]);
      const [u2] = tangentBasis(hd);
      const dir = norm3(add3(hd, scale3(u2, cellSide * 2.2)));
      assistant = { obj, dir, state: 'idle', t: 0, dur: 0, order: null, loiter: dir.slice(), gleeT: 0 };
      placeWorker(assistant);
      scene.add(obj);
      updateHud();
      return true;
    });
  }
  let printBeam = null;             // one Line, reused for every print
  const PRINT_TRAIL = 8;            // bead segments behind the head
  const PRINT_TRAIL_STEP = 0.014;   // how far back along the path each one sits
  const orders = [];                // FIFO; orders[0] is the live one
  const orderByCell = new Map();    // ci -> order, for the shop and the cancel
  const isaoRadius = () => 1 + params.wallHeight * isaoAlt + cellSide * 0.5;

  function isaoPos(dir) {
    const r = isaoRadius();
    return [dir[0] * r, dir[1] * r, dir[2] * r];
  }
  // shortest path over the sphere, capped at maxAngle radians this step
  function stepDir(from, to, maxAngle) {
    const d = Math.max(-1, Math.min(1, dot3(from, to)));
    const ang = Math.acos(d);
    if (ang < 1e-5 || maxAngle >= ang) return to.slice();
    const k = maxAngle / ang;
    const s0 = Math.sin((1 - k) * ang) / Math.sin(ang);
    const s1 = Math.sin(k * ang) / Math.sin(ang);
    return norm3(add3(scale3(from, s0), scale3(to, s1)));
  }

  function spawnIsao() {
    if (isao || !graph || !dungeon) return Promise.resolve(false);
    return preloadFabricator().then((ok) => {
      if (!ok || isao || !graph || !dungeon) return;
      const obj = makeIsaoDrone(ISAO_TINT);
      if (!obj) return;
      obj.scale.setScalar(cellSide * 1.15);
      const dir = norm3(graph.centers[dungeon.heart]);
      isao = { obj, dir, state: 'idle', t: 0, dur: 0, order: null, loiter: dir.slice(), gleeT: 0 };
      placeIsao();
      scene.add(obj);
      return true;
    });
  }
  function placeWorker(w = isao) {
    const p = isaoPos(w.dir);
    w.obj.position.set(p[0], p[1], p[2]);
    // up is its own radial; face where it is going (or where it is working)
    // he faces what he is doing: the site while flying to it AND while
    // printing it, his drift when idle. The build case used to fall through
    // to a stale loiter point, so he printed with his back to the work —
    // invisible until a camera was hung off his facing.
    tmpObj.position.copy(w.obj.position);
    tmpObj.up.set(w.dir[0], w.dir[1], w.dir[2]);

    // WHILE PILOTED HE FACES WHERE HE IS FLYING. This is the bug the operator
    // saw as "rotates on an unnatural axis": the aim below falls back to
    // w.loiter, and pilotIsao sets loiter to his own POSITION, so the
    // lookAt target sat on top of him, the distance guard skipped the lookAt
    // entirely, and his quaternion was left stale from whatever it last was.
    // He was not rotating oddly — he was not being oriented at all.
    if (w === isao && params.view === 'drone' && isaoHeading) {
      const ahead = add3(p, scale3(isaoHeading, cellSide));
      tmpObj.lookAt(ahead[0], ahead[1], ahead[2]);
      w.obj.quaternion.copy(tmpObj.quaternion);
      // LEAN AND BANK, composed as quaternions onto the facing — never
      // written as Euler on the same object, which would replace the whole
      // orientation and put us straight back to an unnatural axis. This
      // project has that dead end on record twice.
      tmpQ.setFromAxisAngle(X_AXIS, isaoLean);
      w.obj.quaternion.multiply(tmpQ);
      tmpQ.setFromAxisAngle(Z_AXIS, isaoRoll);
      w.obj.quaternion.multiply(tmpQ);
      return;
    }

    // autonomous: he faces what he is doing — the site while flying to it AND
    // while printing it, his drift when idle
    const aim = w.order ? norm3(graph.centers[w.order.ci]) : w.loiter;
    const t = isaoPos(aim);
    if (dist3(t, p) > 1e-4) tmpObj.lookAt(t[0], t[1], t[2]);
    w.obj.quaternion.copy(tmpObj.quaternion);
  }
  const placeIsao = () => placeWorker(isao);

  // the site marker: a ring of points on the wall top, in the tower's own
  // colour, that says "something is coming here". It is the ONLY thing an
  // ordered-but-unbuilt cell shows until Isao arrives — the tower itself
  // grows out of the ground while he prints it, which is a better progress
  // bar than a progress bar.
  function makeSiteRing(ci, color) {
    const c = graph.centers[ci];
    const n = graph.normals[ci];
    const theta = cellSide * 0.42;
    const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1 = norm3(cross3(n, ref));
    const t2 = cross3(n, t1);
    const pos = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * 2 * Math.PI;
      const d = add3(scale3(t1, Math.cos(a)), scale3(t2, Math.sin(a)));
      const p = scale3(norm3(add3(scale3(norm3(c), Math.cos(theta)), scale3(d, Math.sin(theta)))),
        1 + params.wallHeight * 1.02);
      pos.push(p[0], p[1], p[2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const ring = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 3.0, sizeAttenuation: false, color, transparent: true, opacity: 0.9,
    }));
    scene.add(ring);
    return ring;
  }
  function dropSiteRing(order) {
    if (!order.ring) return;
    scene.remove(order.ring);
    order.ring.geometry.dispose();
    order.ring.material.dispose();
    order.ring = null;
  }

  // `quiet` is for orders the GAME places rather than the player: no click,
  // no range ring, and no printer brief — that brief exists to fire the first
  // time the PLAYER commits to an order, and having the opening garrison
  // spend it teaches the mechanic to nobody.
  function orderTower(key, ci, { quiet = false } = {}) {
    const def = TOWER_BY_KEY[key];
    if (!def) return false;
    const err = placeError(ci);
    if (err) { flashShopNote(err); return false; }
    if (orderByCell.has(ci)) { flashShopNote('already on the list'); return false; }
    if (!eco.spend(def.cost)) {
      flashShopNote('not enough biomass');
      showBrief('biomass');   // he has an opinion about this
      return false;
    }
    const order = { kind: 'tower', ci, key, def, cost: def.cost, ring: makeSiteRing(ci, def.color) };
    orders.push(order);
    orderByCell.set(ci, order);
    if (!quiet) showBrief('printer');   // the first order is when the mechanic is real
    run.maxQueue = Math.max(run.maxQueue, orders.length);
    checkAchievements();
    spawnIsao();
    if (!quiet) {
      sfx.play('laser_click'); // the order goes on the book, not a tower on the wall
      showRangeRing(ci, effectiveStats(def, 0).range, def.color, 1.6);
    }
    updateHud();
    return true;
  }
  function orderUpgrade(tower) {
    const cost = upgradeCost(tower.def, tower.tier);
    if (cost === null) return false;
    if (orderByCell.has(tower.ci)) { flashShopNote('already on the list'); return false; }
    if (!eco.spend(cost)) { flashShopNote('not enough biomass'); return false; }
    const order = { kind: 'upgrade', ci: tower.ci, tower, cost,
      ring: makeSiteRing(tower.ci, tower.def.color) };
    orders.push(order);
    orderByCell.set(tower.ci, order);
    spawnIsao();
    updateHud();
    return true;
  }
  // Cancelling costs nothing: nothing has been printed. The one exception is
  // the order Isao is already standing over — the biomass is in the nozzle
  // by then, and half of it does not come back.
  function cancelOrder(ci, why = null) {
    const order = orderByCell.get(ci);
    if (!order) return false;
    const live = !!(order.worker && order.worker.state === 'build');
    eco.addBiomass(live ? Math.round(order.cost * 0.5) : order.cost, { category: 'refund' });
    dropSiteRing(order);
    if (order.ghost) { scene.remove(order.ghost); disposeObj(order.ghost); order.ghost = null; }
    orders.splice(orders.indexOf(order), 1);
    orderByCell.delete(ci);
    if (isao && isao.order === order) { isao.order = null; isao.state = 'idle'; }
    flashShopNote(why ? `${why} — ${live ? 'half back' : 'biomass returned'}`
      : (live ? 'order aborted — half back' : 'order cancelled'));
    updateHud();
    return true;
  }

  function finishOrder(order) {
    dropSiteRing(order);
    if (order.kind === 'tower') {
      if (order.ghost) { scene.remove(order.ghost); disposeObj(order.ghost); order.ghost = null; }
      // re-check: the world moved while he flew (a strike, a sell, a tower
      // someone else put here). If the cell went bad, the biomass comes back.
      if (placeError(order.ci)) {
        eco.addBiomass(order.cost, { category: 'refund' });
        flashShopNote('site lost — biomass returned');
      } else {
        commitTower(order.key, order.ci, order.cost);
        sfx.play('tower_upgrade');
      }
    } else if (towers.includes(order.tower)) {
      order.tower.tier++;
      order.tower.spent += order.cost;
      if (order.tower.obj.userData.setTier) order.tower.obj.userData.setTier(order.tower.tier);
      placeTowerObj(order.tower);
      showRangeRing(order.ci, effectiveStats(order.tower.def, order.tower.tier).range,
        order.tower.def.color, 1.4);
      sfx.play('tower_upgrade');
    } else {
      eco.addBiomass(order.cost, { category: 'refund' });   // the tower was sold or destroyed mid-flight
    }
    const at = orders.indexOf(order);
    if (at >= 0) orders.splice(at, 1);   // by identity: with two workers it is not always orders[0]
    orderByCell.delete(order.ci);
    const w = order.worker || isao;
    if (w) { w.gleeT = 2.2; w.order = null; w.state = 'idle'; w.t = 0; }
    order.worker = null;
    updateHud();
  }

  // --- FLYING HIM YOURSELF --------------------------------------------------
  // The drone camera started as a view. The operator wants the machine: in
  // drone view you have the stick, and Isao goes where you point him.
  //
  // His WORK is suspended while you fly — a drone cannot be halfway to a
  // print and under your hand at the same time, and pretending otherwise
  // would mean an order that never completes because you flew off with it.
  // Leave the view and he picks the queue straight back up.
  let isaoHeading = null;    // unit tangent at isao.dir; the way he is pointed
  const ISAO_TURN = 1.9;     // rad/s
  const ISAO_CLIMB = 2.4;    // altitude units per second, held
  // MEASURED. The demand maps about 1:1 to the tilt once it is measured
  // against his CURRENT local up — the early readings of 52 and 37 degrees
  // were the sphere's curvature leaking into the probe, not the model. 0.32
  // rad is a visible ~18 degrees: enough to read as a quadcopter tipping into
  // its acceleration, short of looking like a stall. ?droneprobe=1 prints it.
  const ISAO_LEAN = 0.32;    // rad of nose-down at full forward
  const ISAO_ROLL = 0.24;    // rad of bank into a turn
  let isaoLean = 0, isaoRoll = 0;
  const ISAO_FLY = 3.4;      // cells/s under power
  function pilotIsao(dt) {
    const up = isao.dir;
    // re-project the heading onto the tangent plane every frame: he is
    // flying over a sphere, so "forward" drifts out of plane as he moves
    if (!isaoHeading) {
      const ref = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      isaoHeading = norm3(cross3(up, ref));
    }
    let h = sub3(isaoHeading, scale3(up, dot3(isaoHeading, up)));
    const hl = len3(h);
    h = hl > 1e-6 ? scale3(h, 1 / hl) : norm3(cross3(up, [0, 1, 0]));
    const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    if (steer) {
      // rotate the heading about the local up — Rodrigues, with the sin/cos
      // of a small angle, which is all a turn on a sphere ever needs
      const a = steer * ISAO_TURN * dt;
      const ca = Math.cos(a), sa = Math.sin(a);
      h = norm3(add3(scale3(h, ca), scale3(cross3(up, h), sa)));
    }
    isaoHeading = h;
    const drive = keys.fast ? 1 : keys.slow ? -0.6 : (throttle !== 0 ? throttle : 0);
    if (drive) {
      const step = ISAO_FLY * cellSide * drive * dt;
      isao.dir = norm3(add3(isao.dir, scale3(h, step)));
      isao.loiter = isao.dir.slice();   // he holds where you left him
    }
    // ALTITUDE ON SPACE / SHIFT, held rather than tapped — a drone climbs
    // while you hold the stick. Q/E still step it discretely for anyone who
    // learned it that way.
    const climb = (keys.droneUp ? 1 : 0) - (keys.droneDown ? 1 : 0);
    if (climb) isaoAlt = Math.max(1.2, Math.min(9, isaoAlt + climb * ISAO_CLIMB * dt));
    // LEAN. A quadcopter does not translate flat: it tips into the direction
    // it is accelerating and rights itself when it stops. The lean EASES
    // toward the demand rather than snapping, which is most of why it reads
    // as a flying thing rather than a sliding one.
    const wantLean = drive * ISAO_LEAN;
    isaoLean += (wantLean - isaoLean) * Math.min(1, dt * 4.5);
    const wantRoll = -steer * ISAO_ROLL;
    isaoRoll += (wantRoll - isaoRoll) * Math.min(1, dt * 4.5);
    isao.obj.userData.spinRotors(dt, Math.abs(drive) * 0.8 + 0.2);
    if (isao.obj.userData.setFace) {
      isao.obj.userData.setFace(drive ? 'focused' : 'curious');
      isao.obj.userData.tickFace(dt);
    }
    placeIsao();
  }

  // ONE STATE MACHINE, ANY NUMBER OF WORKERS (operator, 2026-09-02: "another
  // Drone, assists Isao"). This body was updateIsao's, written against the
  // singleton; it now takes the worker it drives. isao is workers()[0] and
  // every camera / face / probe site that names him is untouched.
  function stepWorker(w, dt) {
    const speed = ISAO_CELLS_SEC * cellSide;   // radians per second
    if (w.state === 'idle') {
      // CLAIM THE FIRST ORDER NOBODY HAS. With two workers on one FIFO this
      // is the whole change: the queue stays the queue, each drone takes the
      // oldest unclaimed job, and the order carries its worker so finishing
      // and cancelling can find the right one.
      const free = orders.find((o) => !o.worker);
      if (free) {
        free.worker = w;
        w.order = free;
        w.state = 'travel';
      } else {
        // LOITER. He does not park: he drifts a couple of cells around the
        // heart, which is what makes him read as a machine on shift rather
        // than a prop bolted to the sky.
        const hd = norm3(graph.centers[dungeon.heart]);
        if (dot3(w.dir, w.loiter) > 0.99999 || dist3(w.loiter, hd) < 1e-9) {
          const a = t * 0.37;
          const ref = Math.abs(hd[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
          const t1 = norm3(cross3(hd, ref));
          const t2 = cross3(hd, t1);
          const off = cellSide * 2.2;
          w.loiter = norm3(add3(hd,
            add3(scale3(t1, Math.cos(a) * off), scale3(t2, Math.sin(a) * off))));
        }
        w.dir = stepDir(w.dir, w.loiter, speed * 0.35 * dt);
      }
    }
    if (w.state === 'travel' && w.order) {
      const target = norm3(graph.centers[w.order.ci]);
      w.dir = stepDir(w.dir, target, speed * dt);
      if (dot3(w.dir, target) > 0.99995) {
        w.state = 'build';
        w.t = 0;
        w.dur = buildSeconds(w.order.cost);
        w.shown = -1;
        if (w.order.kind === 'tower') {
          // the print: the tower itself grows out of the wall top. Built
          // here rather than at order time so a queued site costs nothing
          // but a ring of points.
          const g = buildTowerLook(params.towerLook, w.order.def);
          w.order.ghost = g;
          scene.add(g);
        }
      }
    } else if (w.state === 'build' && w.order) {
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      const g = w.order.ghost;
      if (g) {
        // same recipe as placeTowerObj, with the height easing up from
        // nothing — scale.y is the print head's progress
        const base = (g.userData.baseScale ?? 1) * cellSide * 0.62;
        g.scale.set(base, base * Math.max(0.02, k), base);
        const c = graph.centers[w.order.ci];
        const nrm = graph.normals[w.order.ci];
        const top = 1 + params.wallHeight;
        g.position.set(c[0] * top, c[1] * top, c[2] * top);
        tmpN.set(nrm[0], nrm[1], nrm[2]);
        g.quaternion.setFromUnitVectors(Y_AXIS, tmpN);
      }
      const step = Math.floor(k * 10);
      if (step !== w.shown) { w.shown = step; updateHud(); }
      if (w.t >= w.dur) finishOrder(w.order);
    }
  }

  function updateIsao(dt) {
    if (!isao) return;
    // piloted: the queue waits, and so does everything else he does
    if (params.view === 'drone') { pilotIsao(dt); return; }
    isaoHeading = null;
    const speed = ISAO_CELLS_SEC * cellSide;   // radians per second
    for (const w of workers()) stepWorker(w, dt);
    if (assistant) placeWorker(assistant);
    if (!isao) return;
    const working = isao.state === 'build';
    // HIS FACE IS A STATUS LIGHT. Not a performance: four presets from the
    // lab, picked by what he is actually doing, plus a brief GLEE when a
    // print lands because that is the one moment worth a reaction. Nothing
    // here is on a timer of its own — the face follows the state machine,
    // which is what keeps it readable rather than busy.
    if (isao.obj.userData.setFace) {
      const enemiesNear = enemies.filter((e) => e.alive).length;
      isao.obj.userData.setFace(
        isao.gleeT > 0 ? 'glee'
          : enemiesNear >= 10 ? 'scared'
            : working ? 'determined'
              : isao.state === 'travel' ? 'focused'
                : 'scan');
      isao.obj.userData.tickFace(dt);
      if (isao.gleeT > 0) isao.gleeT -= dt;
    }
    // the print beam: ONE line object, rewritten in place. The effects rule
    // on this board is that activity must not add objects, and a beam that
    // exists for the whole build is exactly the thing that would.
    if (working) {
      const noz = isao.obj.userData.nozzle;
      const a = new THREE.Vector3();
      if (noz) noz.getWorldPosition(a); else a.copy(isao.obj.position);
      const c = graph.centers[isao.order.ci];
      const top = 1 + params.wallHeight;
      if (!printBeam) {
        printBeam = new THREE.Line(new THREE.BufferGeometry().setAttribute('position',
          new THREE.BufferAttribute(new Float32Array((PRINT_TRAIL + 2) * 3), 3)),
          new THREE.LineBasicMaterial({
            color: ISAO_TINT, transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }));
        scene.add(printBeam);
      }
      // THE HEAD MOVES. A steady line from the nozzle to the middle of the
      // cell reads as a laser; a printer rasters, walks a perimeter, and
      // stops extruding while it travels. printpath.js owns those three
      // patterns and the cycle between them; this only lays them on the
      // cell's tangent plane. The trail is sampled BACKWARDS along the same
      // path rather than remembered, so it stays deterministic and costs no
      // state — and it is what makes a zigzag legible as a zigzag.
      // sized to THIS build, so even the shortest job shows all three
      const { pattern, u } = printPhase(isao.t, patternSecsFor(isao.dur));
      const nrm = graph.normals[isao.order.ci];
      const [t1, t2] = tangentBasis(nrm);
      const R = cellSide * 0.38;
      const bed = (uu) => {
        const [ox, oy] = printOffset(pattern, uu);
        return [0, 1, 2].map((i) =>
          c[i] * top + t1[i] * ox * R + t2[i] * oy * R);
      };
      const pa = printBeam.geometry.attributes.position;
      pa.setXYZ(0, a.x, a.y, a.z);            // the nozzle
      for (let k = 0; k <= PRINT_TRAIL; k++) {
        // clamped at 0 so a trail never wraps into the previous pattern
        const p = bed(Math.max(0, u - k * PRINT_TRAIL_STEP));
        pa.setXYZ(k + 1, p[0], p[1], p[2]);
      }
      pa.needsUpdate = true;
      // the gaps are the point: a nozzle that never stops extruding is a
      // laser again. Retractions at the raster turnarounds, and the whole
      // third pattern is travel moves.
      printBeam.visible = printOn(pattern, u);
      // a printer's flow is not steady; the flicker is deterministic
      printBeam.material.opacity = 0.55 + 0.35 * Math.abs(Math.sin(isao.t * 21));
    } else if (printBeam) printBeam.visible = false;
    isao.obj.userData.spinRotors(dt, working ? 1 : (isao.state === 'travel' ? 0.5 : 0));
    isao.obj.userData.setWork(working ? Math.min(1, isao.t * 3) : 0);
    placeIsao();
  }

  // The strike's version of losing a tower: no refund, and the wreck shows.
  // Selling is a decision; this is a consequence.
  function destroyTower(tower) {
    const c = graph.centers[tower.ci];
    const nrm = graph.normals[tower.ci];
    const burst = makeDotBurst(tower.def.color, nrm, 40);
    burst.scale.setScalar(cellSide * 1.1);
    burst.position.set(c[0] + nrm[0] * cellSide * 0.3, c[1] + nrm[1] * cellSide * 0.3,
      c[2] + nrm[2] * cellSide * 0.3);
    scene.add(burst);
    debris.push(burst);
    scene.remove(tower.obj);
    disposeObj(tower.obj);
    towers.splice(towers.indexOf(tower), 1);
    towerByCell.delete(tower.ci);
    towerCells.delete(tower.ci);
    if (watchTower === tower) watchTower = null;
  }

  // THE SAME DEATH THE TANK GETS: the wreck, the burst, the sound, and then
  // it is off the board. No refund — it was destroyed, not sold — and no
  // run-ending consequence: the player builds another, which is the whole
  // difference between losing a machine and losing the tank.
  function killWalker(tw) {
    const n = norm3(tw.a6.pos);
    sfx.play('tank_destroyed', { dist: camDist(tw.a6.pos) });
    const wreck = makeDebris(tw.obj, n);
    scene.add(wreck); debris.push(wreck);
    const burst = makeDotBurst(tw.def.color, n, 48);
    burst.scale.setScalar(cellSide * 0.8);
    burst.position.set(tw.a6.pos[0], tw.a6.pos[1], tw.a6.pos[2]);
    scene.add(burst); debris.push(burst);
    showCallout('A6 DOWN', 'co-heart');
    scene.remove(tw.obj);
    disposeObj(tw.obj);
    towers.splice(towers.indexOf(tw), 1);
    towerByCell.delete(tw.ci);
    towerCells.delete(tw.ci);
    if (watchTower === tw) watchTower = null;
    updateHud();
  }

  // SEND THE A6 SOMEWHERE. The berth moves; the machine walks to it under
  // its own rules — it is not teleported, and it does not stop fighting on
  // the way. A marker stays on the cell so the order is visible after the
  // menu closes: an order you cannot see is an order you will give twice.
  let a6Post = null;
  function postWalker(ci) {
    const tw = towers.find((w) => w.a6);
    if (!tw) return false;
    tw.a6.berth = norm3(graph.centers[ci]).slice();
    tw.a6.postCi = ci;
    // ...and it goes NOW rather than after the current patrol leg: the
    // waypoint it was walking to is a place it no longer has any business
    tw.a6.want = tw.a6.berth.slice();
    tw.a6.dwell = 0;
    if (a6Post) { scene.remove(a6Post); disposeObj(a6Post); }
    a6Post = makeDotBurst(tw.def.color, graph.normals[ci], 24);
    a6Post.userData.tick = null;         // it stays; it is a marker, not an effect
    a6Post.scale.setScalar(cellSide * 0.7);
    const c = graph.centers[ci];
    const top = 1 + params.wallHeight * 0.35;
    a6Post.position.set(c[0] * top, c[1] * top, c[2] * top);
    scene.add(a6Post);
    showCallout('A6 POSTED', 'co-streak');
    return true;
  }

  function sellTower(tower) {
    eco.addBiomass(sellRefund(tower.spent), { category: 'refund' });
    scene.remove(tower.obj);
    disposeObj(tower.obj);
    towers.splice(towers.indexOf(tower), 1);
    towerByCell.delete(tower.ci);
    towerCells.delete(tower.ci);
    if (watchTower === tower) watchTower = null;
    updateHud();
  }

  function upgradeTower(tower) {
    const cost = upgradeCost(tower.def, tower.tier);
    if (cost === null || !eco.spend(cost)) return false;
    tower.tier++;
    tower.spent += cost;
    // the pedestal IS the tier read: square -> hexagon -> circle
    if (tower.obj.userData.setTier) tower.obj.userData.setTier(tower.tier);
    placeTowerObj(tower); // a tier reads as bulk — derived from tier, not accumulated
    showRangeRing(tower.ci, effectiveStats(tower.def, tower.tier).range, tower.def.color, 1.4);
    updateHud();
    sfx.play('tower_upgrade');
    return true;
  }

  // dotted range ring on the surface — one reusable mesh, house style
  let rangeRing = null;
  let rangeRingTtl = 0;
  // THE CHARGING PAD. A ring on the heart's own cell, lit while the wave's
  // budget is unspent and dark once it is gone — a trip home that will not pay
  // is a trip the player has to be able to decline from across the board.
  // Built from showRangeRing's basis so it sits on the ground the way every
  // other ring here does.
  let stationRing = null;
  function buildStationRing() {
    if (stationRing) { scene.remove(stationRing); disposeObj(stationRing); stationRing = null; }
    if (!graph || dungeon.heart == null) return;
    const c = graph.centers[dungeon.heart];
    const n = graph.normals[dungeon.heart];
    const theta = cellSide * 0.55;
    const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1 = norm3(cross3(n, ref));
    const t2 = cross3(n, t1);
    const pos = [];
    const SEG = 64;
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * 2 * Math.PI;
      const dir = add3(scale3(t1, Math.cos(a)), scale3(t2, Math.sin(a)));
      const p = scale3(norm3(add3(scale3(norm3(c), Math.cos(theta)), scale3(dir, Math.sin(theta)))),
        1 + params.wallHeight * 0.7);
      pos.push(p[0], p[1], p[2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    stationRing = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 3.0, sizeAttenuation: false, color: 0x59c8ff,
      transparent: true, opacity: 0.8, depthWrite: false,
    }));
    scene.add(stationRing);
  }

  function showRangeRing(ci, radiusCells, color, ttl = 0) {
    hideRangeRing();
    const c = graph.centers[ci];
    const n = graph.normals[ci];
    const theta = radiusCells * cellSide; // arc angle on the unit sphere
    const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1 = norm3(cross3(n, ref));
    const t2 = cross3(n, t1);
    const pos = [];
    const SEG = 72;
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * 2 * Math.PI;
      const dir = add3(scale3(t1, Math.cos(a)), scale3(t2, Math.sin(a)));
      const p = scale3(norm3(add3(scale3(norm3(c), Math.cos(theta)), scale3(dir, Math.sin(theta)))),
        1 + params.wallHeight * 0.7);
      pos.push(p[0], p[1], p[2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rangeRing = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 2.4, sizeAttenuation: false, color,
      transparent: true, opacity: 0.9,
    }));
    scene.add(rangeRing);
    rangeRingTtl = ttl; // 0 = sticky until hidden
  }
  function hideRangeRing() {
    if (!rangeRing) return;
    scene.remove(rangeRing);
    rangeRing.geometry.dispose();
    rangeRing.material.dispose();
    rangeRing = null;
  }

  // --- firing ------------------------------------------------------------
  const chord = (a, b) => dist3(a, b);
  // distance from the ACTIVE camera to a world point, for audio falloff.
  // Derived from the camera's world position rather than the player's --
  // in bastion view the two are far apart, and what you hear should
  // follow what you're looking through.
  const camDistV = new THREE.Vector3();
  function camDist(p) {
    camera.getWorldPosition(camDistV);
    return Math.hypot(camDistV.x - p[0], camDistV.y - p[1], camDistV.z - p[2]);
  }

  // How fast a head swings onto a new target, radians-ish per second of
  // easing. Slow enough that the traverse READS as the tower noticing you.
  const TRACK_RATE = 5.0;
  const TRACK_EVERY = 0.15;   // seconds between retargets; the ease covers it
  // How many tethers a slow tower DRAWS per shot, however many it slows.
  // The field is universal; the picture is bounded (see the slowfield
  // branch in stepTowers).
  const SLOW_BOLTS = 3;
  const aimV = new THREE.Vector3();

  // Point a directional head at what it is shooting. Only heads that HAVE a
  // direction get this, and whether one does is read off the geometry
  // (userData.headFacing) rather than a list someone has to remember to
  // update — an arm reaches along +X, an obelisk points nowhere.
  //
  // The bearing is derived FROM the render transform: put the target into the
  // tower group's own local space and take the yaw that aims +Z at it. No
  // sphere trigonometry, and therefore no sign convention to get wrong.
  // THE SENTRY LAB'S ANSWER, ON THE BOARD. The range spent a whole session
  // learning how one of these aims: yaw and elevation are separate drives
  // with separate rates, the PITCH node lifts its nose on a NEGATIVE
  // rotation about +X (the one negation, written once), the elevation stops
  // are a real envelope rather than decoration, and a gun aims from its
  // TRUNNION rather than from the model's origin. All of that is here now,
  // and the numbers come from SENTRY_TUNE so the lab and the board cannot
  // drift apart.
  //
  // The board adapts world positions and actual articulation to shared
  // missile engagement rules. Other weapons retain their existing target
  // policy; damage, upgrades and cadence remain game-owned.
  const RAD = Math.PI / 180;
  const gunV = new THREE.Vector3();
  function effectiveStats(def, tier) {
    const stats = baseEffectiveStats(def, tier);
    const config = CONTENT.missiles[def.key];
    if (config) stats.range = config.maxRange / METRES_PER_CELL * (stats.range / def.range);
    return stats;
  }
  const missileDistance = (from, to) => arcToMetres(a6Arc(from, to), cellSide);
  function engagementConfig(tw) {
    const def = tw.def;
    return missileLimits(CONTENT.missiles[tw.key], baseEffectiveStats(def, tw.tier).range / def.range);
  }
  function acquireMissileTarget(tw, from, config) {
    const i = pickMissileTarget(enemies, from, tw.missileTarget?.id, config, missileDistance,
      e => e.alive && (!tw.a6 || !e.spec.rammable));
    return tw.missileTarget = i < 0 ? null : enemies[i];
  }
  function aimTower(tw, dt) {
    const ud = tw.obj.userData;
    const head = ud.head;
    const facing = ud.headFacing;
    const config = CONTENT.missiles[tw.key] ? engagementConfig(tw) : null;
    const acquired = config ? acquireMissileTarget(tw, graph.centers[tw.ci], config) : null;
    if (config && (!acquired || !head || facing === undefined)) {
      tw.lock = makeLock(); tw.aimErr = Infinity;
      if (!acquired) tw.aim = undefined;
    }
    if (!head || facing === undefined) return;
    tw.aimT = (tw.aimT ?? 0) - dt;
    if (config || tw.aimT <= 0) {
      tw.aimT = TRACK_EVERY;
      const eff = effectiveStats(tw.def, tw.tier);
      const target = config ? acquired : pickTarget(graph.centers[tw.ci], eff.range * cellSide, enemies, chord);
      if (target) {
        aimV.set(target.pos[0], target.pos[1], target.pos[2]);
        tw.obj.worldToLocal(aimV);
        tw.aim = Math.atan2(aimV.x, aimV.z) - facing;
        // ELEVATION, from the trunnion. The pivot on these families sits
        // well above the feet, and measuring the angle from the base put a
        // dead-level gun nose-down at every target — the same fault the
        // range found the hard way.
        if (ud.pitchNode) {
          // THE TRUNNION'S HEIGHT IN THE SAME SPACE AS THE TARGET. Summing
          // the node positions read them in the INNER model's units, while
          // aimV is in the wrapper's — fitModel puts its scale on the child,
          // so the two are off by that factor and the barrel aimed far below
          // everything it was shooting at. Taken from the render instead,
          // and converted through the same worldToLocal the target used.
          ud.pitchNode.getWorldPosition(gunV);
          tw.obj.worldToLocal(gunV);
          const gunY = gunV.y;
          const flat = Math.hypot(aimV.x, aimV.z);
          // A MORTAR POINTS UP (operator). A lobbed weapon's barrel is not
          // aimed at the target — it is aimed along the LAUNCH of the arc
          // that ends there, and the two are nothing like each other: the
          // line of sight to a ground target is a few degrees BELOW the
          // horizontal and the launch is sixty-odd above it. The turrets
          // were aiming down at things they were lobbing over.
          //
          // Derived from the shell's own parabola rather than from a table:
          // a parabola of height h over a range d leaves at atan(4h/d), and
          // h is arcH — the same constant spawnTowerShot flies. So the tube
          // and the shell cannot disagree, and retuning the lob moves both.
          // (The Sentry Workshop's own viewer agrees: it opens a Mortar at
          // 68 degrees and will not let it below 45.)
          let want;
          if (tw.def.attack === 'seeker') {
            want = MISSILE_LAUNCH_ELEVATION * RAD;
          } else if (tw.def.arc) {
            const d = Math.max(cellSide * 0.5, chord(graph.centers[tw.ci], target.pos));
            want = Math.atan(4 * (cellSide * 2.3) / d);
          } else {
            want = Math.atan2(aimV.y - gunY, Math.max(1e-6, flat));
          }
          // the envelope's ceiling is 65 degrees, and a short-range lob wants
          // more than that — a lobbing mount is a different mount, and the
          // Workshop draws it with the elevation to prove it
          const hi = (tw.def.arc ? 85 : SENTRY_TUNE.elevMax) * RAD;
          const lo = (tw.def.arc ? 20 : SENTRY_TUNE.elevMin) * RAD;
          tw.elev = Math.max(lo, Math.min(hi, want));
          // ...AND WHETHER THE STOP ATE IT. A mount has a depression limit,
          // and a target close enough and low enough needs more than it: the
          // gun ends at its stop, "on target" by its own reckoning, pointing
          // thirty degrees above where the thing actually is. That is the
          // blind radius the sentry range spent a session on, and it is the
          // reason a Lancer was firing into its own feet with an aim error of
          // zero degrees.
          tw.clamped = Math.abs(want - tw.elev) > 0.5 * RAD;
        }
      }
    }
    if (tw.aim === undefined) return;
    // shortest way round, so a target crossing behind does not spin it 350deg
    let d = tw.aim - head.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    // the DRIVE's own rate, in degrees per second, not a lerp factor — a
    // turret that eases proportionally is fastest when it is most wrong,
    // which is the opposite of how a motor behaves
    const my = SENTRY_TUNE.yawRate * RAD * dt;
    head.rotation.y += Math.max(-my, Math.min(my, d));
    if (ud.pitchNode && tw.elev !== undefined) {
      const de = -tw.elev - ud.pitchNode.rotation.x;   // THE ONE NEGATION
      const me = SENTRY_TUNE.pitchRate * RAD * dt;
      ud.pitchNode.rotation.x += Math.max(-me, Math.min(me, de));
    }
    if (ud.recoilNode) {
      tw.recoil = Math.max(0, (tw.recoil ?? 0) - dt / SENTRY_TUNE.recoilBack);
      ud.recoilNode.position.z = -tw.recoil * SENTRY_TUNE.recoilKick;
    }
    // A LAUNCHER MUST LOCK FIRST, and it locks with its DRIVE — the gate is
    // how far the barrel still is from where it wants to be, in degrees,
    // which is the same quantity the sentry range's tolerance is written in.
    // Stepped here rather than in the firing path because a lock fills
    // whether or not the weapon is off cooldown; that IS the mechanic.
    // HOW FAR THE BARREL STILL IS from where it wants to be, in degrees —
    // the sentry range's own quantity, and the thing a weapon that fires
    // ALONG ITS BARREL has to consult before pulling the trigger.
    tw.aimErr = Math.hypot(Math.atan2(Math.sin(tw.aim-head.rotation.y), Math.cos(tw.aim-head.rotation.y)), (tw.elev ?? 0) + (ud.pitchNode ? ud.pitchNode.rotation.x : 0))
      * 180 / Math.PI;
    if (config) {
      if (!tw.lock) tw.lock = makeLock();
      stepMissileLock(tw.lock, dt, acquired,
        acquired ? missileDistance(graph.centers[tw.ci], acquired.pos) : Infinity, tw.aimErr, config);
    }
  }

  // WHERE THE SHOT LEAVES FROM. A muzzle empty if the model has one — so
  // the flash sits in the barrel that is pointing at the thing, and moves
  // with the turret — and the old cell-plus-normal guess otherwise.
  function towerMuzzle(tw, fallback) {
    const mz = tw.obj.userData.muzzles;
    if (!mz || !mz.length) return fallback;
    const m = mz[(tw.shots = ((tw.shots ?? 0) + 1)) % mz.length];
    m.updateWorldMatrix(true, false);
    m.getWorldPosition(aimV);
    // ...and remember WHICH barrel, so a weapon that draws a line can take
    // its direction from the thing the line is supposed to be leaving
    tw.lastMuzzle = m;
    return [aimV.x, aimV.y, aimV.z];
  }

  // WHERE THE BARREL IS ACTUALLY POINTING, read off the render rather than
  // re-derived. The Workshop's models are +Z forward, and the muzzle empty
  // hangs under RECOIL → PITCH → YAW, so its world quaternion carries the
  // whole aim — including the part the drive has not finished slewing yet.
  const muzzleFwd = new THREE.Vector3();
  const muzzleQ = new THREE.Quaternion();
  function towerBarrel(tw, fallback) {
    const m = tw.lastMuzzle;
    if (!m) return fallback;
    m.getWorldQuaternion(muzzleQ);
    muzzleFwd.set(0, 0, 1).applyQuaternion(muzzleQ);
    if (muzzleFwd.lengthSq() < 1e-9) return fallback;
    muzzleFwd.normalize();
    return [muzzleFwd.x, muzzleFwd.y, muzzleFwd.z];
  }

  // HOW FAR A STRAIGHT RAY GETS BEFORE THE GROUND OR A WALL EATS IT.
  // Marched in 3D rather than along the surface: a lance leaves a muzzle at
  // a height, on a slope, and what stops it is whether the ray has dropped
  // below the thing underneath it. A wall top is a cell tagged BLOCKED and
  // stands `wallHeight` above the ground; open ground is the sphere itself.
  // So a level shot from a wall clears its neighbours and a depressed one
  // digs in — which is the whole reason to care where a Lancer stands.
  const rayPt = [0, 0, 0];
  function rayToTerrain(from, dir, maxLen, ownCi = -1) {
    const step = cellSide * 0.2;
    for (let m = step; m <= maxLen; m += step) {
      rayPt[0] = from[0] + dir[0] * m;
      rayPt[1] = from[1] + dir[1] * m;
      rayPt[2] = from[2] + dir[2] * m;
      const ci = cellIndex(norm3(rayPt));
      // A GUN DOES NOT SHOOT ITS OWN PARAPET. The muzzle sits a few
      // thousandths above the wall top it is bolted to, so the very first
      // sample of a depressed barrel is already under its own cell's surface
      // and the lance died a fifth of a cell out, every time. Its own cell
      // cannot stop it; everything past it can.
      if (ci === ownCi) continue;
      const r = Math.hypot(rayPt[0], rayPt[1], rayPt[2]);
      const blocked = ci !== -1 && dungeon.tags[ci] === BLOCKED;
      const surface = 1 + (blocked ? params.wallHeight : 0);
      // A QUARTER OF A CELL OF CLEARANCE. Enemies stand ON the ground, so a
      // beam aimed at one is at ground level by the time it arrives — and
      // stopping the instant the ray touches r = 1 killed it a step SHORT of
      // every target it was aimed at, which is why a correctly aimed lance
      // was striking nothing. What stops a lance is terrain it has actually
      // gone into, not terrain it is skimming.
      if (r < surface - cellSide * 0.25) {
        return { len: Math.max(step, m - step), hit: blocked ? 'wall' : 'ground' };
      }
    }
    return { len: maxLen, hit: null };
  }

  // Distance from a point to a SEGMENT, in 3D. The lance is a straight line
  // through the world now, not an arc across the surface, so the arc
  // projection that measured it is the wrong instrument.
  function distToSeg(p, a, dir, len) {
    const dx = p[0] - a[0], dy = p[1] - a[1], dz = p[2] - a[2];
    const t2 = dx * dir[0] + dy * dir[1] + dz * dir[2];
    const s2 = Math.max(0, Math.min(len, t2));
    const ex = dx - dir[0] * s2, ey = dy - dir[1] * s2, ez = dz - dir[2] * s2;
    return { s: t2, off: Math.hypot(ex, ey, ez) };
  }

  // ITS OWN STREAM, off the board's seed — the A6's patrol must be
  // reproducible with the rest of the run (no Math.random anywhere in game
  // logic) without pulling on any stream something else is counting on.
  const a6Rng = mulberry32((params.seed >>> 0) ^ 0x0a600a6);

  // Shared DART presentation; the board retains target selection and damage.
  const towerSeekers = [];
  let missilePool=null, missilesDisposed=false;
  let seekerHits=0,seekerLost=0;
  createMissilePool({capacity:256}).then(pool=>{
    if(missilesDisposed)pool.dispose();else missilePool=pool;
  }).catch(error=>record('asset.missile.failed',{message:error.message}));

  function launchTowerSeeker(tw, from, target, tNow) {
    const config=CONTENT.missiles[tw.key];
    if(!config || !missilePool?.available || tw.obj.userData.loading)return false;
    const direction=towerBarrel(tw,norm3(from));
    const scale=tw.lastMuzzle?.getWorldScale(new THREE.Vector3()).x ?? tw.obj.scale.x;
    const m=launchDart(missilePool,{config,from,target:target.pos,direction,scale,sphere:true});
    Object.assign(m,{tid:target.id,by:tw,p:from.slice()});
    scene.add(m.mesh);towerSeekers.push(m);
    return true;
  }

  function stepTowerSeekers(dt,tNow) {
    for(let i=towerSeekers.length-1;i>=0;i--){
      const m=towerSeekers[i],target=enemies.find(e=>e.id===m.tid && e.alive);
      const arrived=advanceDart(missilePool,m,dt,target?.pos ?? m.target);
      m.p=m.pose.position;
      if(!arrived)continue;
      if(target){damageEnemy(target,tNow,effectiveStats(m.by.def,m.by.tier).dmg,true);seekerHits++;}
      else seekerLost++;
      const burst=makeDotBurst(target?0xffd27f:0x6f8ea0,norm3(m.p),target?22:10);
      burst.scale.setScalar(cellSide*(target?2.4:1.2));burst.position.fromArray(m.p);
      scene.add(burst);debris.push(burst);
      missilePool.release(m.mesh);towerSeekers.splice(i,1);
    }
  }

  // --- the PLASMA THROWER's beam ------------------------------------------
  // The tank's secondary, emplaced. It uses the SAME shader the pilot's
  // plasma does (beamfx's createBeam, the board preset) rather than a second
  // look that would drift from it — but not the tank's RIG, because that rig
  // draws along a great circle at a constant radius, which is right for a
  // hull firing across the ground and wrong for a tower on a wall firing DOWN
  // onto it. Straight 3D from muzzle to target is what a downward throw is,
  // and over 2.6 cells the difference between that and an arc is a fraction
  // of a cell.
  //
  // One beam per tower, five links each so the root tapers rather than
  // reading as a stack of boxes — the same reason the tank's has five.
  const plasmaBeams = new Map();   // tower -> { links[], until }
  const PLASMA_LINKS = 5;
  // the board preset's widths are written in CELLS, same convention as the
  // tank's CELL_WIDTH_KEYS — scaled here and nowhere else
  const PLASMA_W = {
    coreWidth: BOARD_PRESET.coreWidth * 1.6,
    glowWidth: BOARD_PRESET.glowWidth * 0.55,
    jitterAmount: BOARD_PRESET.jitterAmount * 0.55,
  };
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();

  // ONE CONSTRUCTOR for both beams: a thrower is wide and jittery, a lance
  // is thin and steady, and the difference is two numbers rather than two
  // copies of the rig.
  // A LANCE IS NOT A THROWER (operator: "much thinner and straighter, no
  // jitter"). Same shader, opposite settings: a plasma thrower is wide, hot
  // and unstable because it is a spray of matter; a laser is a thin steady
  // line because it is light. The jitter goes to nothing, the noise and
  // flicker come most of the way down, and the width is a fifth of the
  // thrower's — which is what makes the two read as different weapons
  // rather than as the same beam at two colours.
  // THE LOOKS LIVE IN shotfx.js NOW, so the shooting lab draws the same lance
  // and the same throw the board does. They were private constants here,
  // which is precisely why the lab could only approximate them.
  const LANCE_LOOK = SHOT_LANCE_LOOK;
  const THROW_LOOK = SHOT_THROW_LOOK;

  function makePlasmaLinks(tw, look = THROW_LOOK) {
    const links = [];
    for (let i = 0; i < PLASMA_LINKS; i++) {
      const bm = createBeam(new THREE.Vector3(), new THREE.Vector3(), {
        ...BOARD_PRESET,
        ...(look.noiseAmount !== undefined ? { noiseAmount: look.noiseAmount } : {}),
        ...(look.flicker !== undefined ? { flicker: look.flicker } : {}),
        ...(look.scrollSpeed !== undefined ? { scrollSpeed: look.scrollSpeed } : {}),
        // the BEAM's colour if the def names one, else the tower's own — so
        // a Plasma Thrower reads as one of ITS family and not as a second
        // tank, and a green laser does not have to be a green tower
        glowColor: `#${(shotOf(tw.def).beamColor ?? tw.def.color).toString(16).padStart(6, '0')}`,
        coreWidth: PLASMA_W.coreWidth * cellSide * look.width,
        glowWidth: PLASMA_W.glowWidth * cellSide * look.width,
        jitterAmount: PLASMA_W.jitterAmount * cellSide * look.jitter,
      });
      bm.mesh.visible = false;
      bm.mesh.renderOrder = 10;
      scene.add(bm.mesh);
      links.push(bm);
    }
    return links;
  }

  function throwPlasma(tw, from, to, tNow) {
    let ent = plasmaBeams.get(tw);
    if (!ent) {
      ent = { links: makePlasmaLinks(tw), until: 0 };
      plasmaBeams.set(tw, ent);
    }
    // HELD PAST THE TICK. The weapon fires six times a second and the hold
    // is longer than the gap, so what the player sees is one continuous
    // throw that ends when the tower stops firing rather than a strobe.
    ent.until = tNow + firingFor('plasma').beamHold;
    const a = scale3(from, 1);
    for (let k = 0; k < PLASMA_LINKS; k++) {
      const f0 = k / PLASMA_LINKS, f1 = (k + 1) / PLASMA_LINKS;
      pa.set(a[0] + (to[0] - a[0]) * f0, a[1] + (to[1] - a[1]) * f0, a[2] + (to[2] - a[2]) * f0);
      pb.set(a[0] + (to[0] - a[0]) * f1, a[1] + (to[1] - a[1]) * f1, a[2] + (to[2] - a[2]) * f1);
      const bm = ent.links[k];
      bm.setEndpoints(pa, pb);
      // narrow at the muzzle, opening down the throw — one curve, same shape
      // as the tank's widthAt, applied to the BASE widths rather than to
      // whatever the uniform happened to hold last frame (which would ratchet
      // the beam wider or thinner every tick).
      const w = 0.35 + 0.65 * Math.pow((k + 0.5) / PLASMA_LINKS, 0.7);
      for (const [key, base] of Object.entries(PLASMA_W)) {
        const u = bm.uniforms[`u${key[0].toUpperCase()}${key.slice(1)}`];
        if (u) u.value = base * cellSide * w;
      }
      const cs = bm.uniforms.uCapStart, ce = bm.uniforms.uCapEnd;
      if (cs) cs.value = k === 0 ? BOARD_PRESET.capStart : 0;
      if (ce) ce.value = k === PLASMA_LINKS - 1 ? BOARD_PRESET.capEnd : 0;
      const gi = bm.uniforms.uGlowIntensity;
      if (gi) gi.value = BEAM_PEAK * 0.55 * w;
      bm.mesh.visible = true;
      bm.update(tNow);
      bm.setAlpha(1);
    }
  }

  // THE LANCE'S OWN DRAW. Same engine as the plasma — the beamfx shader, so
  // the board has ONE plasma look and not two — but pointed differently on
  // purpose: straight along the ground arc rather than down onto a body,
  // held for a long burst rather than re-lit six times a second, and thin,
  // because a lance is a line and a thrower is a spray.
  function lanceBeam(tw, from, dir, len, tNow, struck, stoppedBy) {
    let ent = plasmaBeams.get(tw);
    if (!ent) {
      ent = { links: makePlasmaLinks(tw, LANCE_LOOK), until: 0 };
      plasmaBeams.set(tw, ent);
    }
    ent.until = tNow + firingFor('lancer').beamHold;
    // IT HUGS THE PLANET (operator: lasers "too often pierce through the
    // curvature and it looks uncanny"). It was drawn as a straight world
    // CHORD, and a chord across seven cells dives 0.49 CELLS below the
    // surface at its midpoint — it goes underground and comes back out,
    // which is exactly what was being seen.
    //
    // A great circle is the straight line on a sphere, so this is still
    // "straight" in the only sense the board has; it simply keeps the
    // muzzle's own altitude the whole way instead of cutting the corner. The
    // five links were always there for the shader's per-link cap and taper —
    // now they also carry the bend, which is what they are shaped for.
    const fromU = norm3(from);
    const r0 = len3(from);
    // the firing direction as a UNIT TANGENT at the muzzle: arc.js's contract,
    // and the same projection the tank's secondary already does
    const dTan = norm3(sub3(dir, scale3(fromU, dot3(dir, fromU))));
    const at = (m) => {
      const q = arcPoint(fromU, dTan, m);
      return [q[0] * r0, q[1] * r0, q[2] * r0];
    };
    for (let k = 0; k < PLASMA_LINKS; k++) {
      const m0 = len * (k / PLASMA_LINKS), m1 = len * ((k + 1) / PLASMA_LINKS);
      const p0 = at(m0), p1 = at(m1);
      pa.set(p0[0], p0[1], p0[2]);
      pb.set(p1[0], p1[1], p1[2]);
      const bm = ent.links[k];
      bm.setEndpoints(pa, pb);
      const cs = bm.uniforms.uCapStart, ce = bm.uniforms.uCapEnd;
      if (cs) cs.value = k === 0 ? BOARD_PRESET.capStart : 0;
      if (ce) ce.value = k === PLASMA_LINKS - 1 ? BOARD_PRESET.capEnd : 0;
      const gi = bm.uniforms.uGlowIntensity;
      // BRIGHTER FOR EVERY BODY IT IS THROUGH. The one thing a piercing
      // weapon should say out loud is how many it caught.
      if (gi) gi.value = BEAM_PEAK * (0.5 + 0.22 * Math.min(4, struck));
      bm.mesh.visible = true;
      bm.update(tNow);
      bm.setAlpha(1);
    }
    // WHERE IT IS STOPPED, SAID OUT LOUD. A beam that simply ends in mid-air
    // reads as a beam that is too short; one that splashes on the rock reads
    // as a beam that has hit something, which is the information the player
    // needs to move the tower. Rate-limited to the burst, not the tick.
    if (stoppedBy && tNow - (tw.lastSpark ?? -9) > (tw.def.burst ?? 0.6) * 0.9) {
      tw.lastSpark = tNow;
      const at = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len];
      const b = makeDotBurst(shotOf(tw.def).beamColor ?? tw.def.color, norm3(at),
        stoppedBy === 'wall' ? 18 : 12);
      b.scale.setScalar(cellSide * (stoppedBy === 'wall' ? 1.5 : 1.1));
      b.position.set(at[0], at[1], at[2]);
      scene.add(b); debris.push(b);
    }
  }

  function stepPlasmaBeams(tNow) {
    for (const [tw, ent] of plasmaBeams) {
      const live = tNow < ent.until && towerByCell.get(tw.ci) === tw;
      for (const bm of ent.links) {
        if (!live) { bm.mesh.visible = false; continue; }
        bm.update(tNow);
      }
      if (!live && !towers.includes(tw)) {
        for (const bm of ent.links) { scene.remove(bm.mesh); disposeObj(bm.mesh); }
        plasmaBeams.delete(tw);
      }
    }
  }

  // ONE A6, ONE FRAME. The module owns the decisions; this owns the world.
  // `sense` is the board's own enemy list rather than a second index — the
  // A6 sees what a tower on its cell would see, from wherever it is
  // standing, which is the whole point of it moving.
  function stepWalker(tw, dt, tNow) {
    const was = tw.a6.pos.slice();
    const eff = effectiveStats(tw.def, tw.tier);
    const range = eff.range * cellSide;
    // an upgrade is a bigger cassette, applied the moment it lands rather
    // than at the next reload — you paid for it now
    const want = magFor(tw.tier);
    if (tw.a6.mag !== want) {
      tw.a6.ammo += want - tw.a6.mag;
      tw.a6.mag = want;
      tw.a6.ammo = Math.max(0, Math.min(want, tw.a6.ammo));
    }
    const config = engagementConfig(tw);
    if (!tw.lock) tw.lock = makeLock();
    let lockStepped = false;
    stepA6(tw.a6, dt, {
      range, minRange: metresToArc(config.minRange, cellSide), cellSide, tune: A6_TUNE, rand: a6Rng,
      // Retain a living hard target inside the same metre band used by the lab.
      sense: from => {
        const e = acquireMissileTarget(tw, from, config);
        if (!e || tw.lock.id !== e.id) tw.lock = makeLock();
        return e ? { id: e.id, pos: e.pos, e } : null;
      },
      ready: seen => {
        const distance = missileDistance(tw.a6.pos, seen.pos);
        stepMissileLock(tw.lock, dt, seen, distance, 0, config);
        lockStepped = true;
        return missileCanFire(tw.lock, seen, distance, 0, config, 0,
          !!missilePool?.available && !tw.obj.userData.loading);
      },
      emit: (seen) => {
        const target = seen.e;
        if (!target || !target.alive) return;
        const p = tw.a6.pos;
        const n = norm3(p);
        const muzzle = towerMuzzle(tw, add3(scale3(p, 1 + params.wallHeight), scale3(n, cellSide * 0.5)));
        // The shared DART flight leaves the actual vertical cassette socket.
        // The board owns its target; the lock drops when the cell fires.
        launchTowerSeeker(tw, muzzle, target, tNow);
        tw.lock = makeLock();
        sfx.play(towerSound(tw.def), { dist: camDist(p) });
      },
    });
    if (!lockStepped) tw.lock = makeLock();
    if (tw.a6.target === null || tw.a6.state === 'home' || tw.a6.state === 'refill') {
      tw.missileTarget = null; tw.lock = makeLock();
    }
    tw.a6.steps = (tw.a6.steps || 0) + 1;
    // THE CASSETTE IS THE GAUGE (operator: "diegetic view of missiles
    // remaining"). The Workshop drew six readiness rings and six silo caps
    // on this hull; a spent cell loses its ring. No HUD number, no bar —
    // you read the machine, which is the only ammo counter on the board that
    // is part of the thing it counts.
    // ONE PIP PER CELL, ON THE CELL. The Workshop draws readiness rings on
    // this hull, but they do not survive mergeByMaterial — the model is
    // merged for draw calls and the descriptive meshes weld into the body.
    // The MUZZLE empties DO survive (they are the articulation contract), so
    // the gauge is built on them: a lamp at each launch cell, extinguished
    // as that cell is spent. It is on the machine, one per rocket, and it
    // reads at board scale — which is what a diegetic counter has to do.
    if (tw.rings === undefined) {
      tw.rings = [];
      const mz = tw.obj.userData.muzzles || [];
      for (let i = 0; i < mz.length; i++) {
        const pip = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 6, 5),
          new THREE.MeshBasicMaterial({ color: tw.def.color }));
        pip.position.set(0, 0.16, 0);   // just proud of the cell mouth
        mz[i].add(pip);
        tw.rings.push(pip);
      }
    }
    if (tw.rings.length && tw.ringsShown !== tw.a6.ammo) {
      tw.ringsShown = tw.a6.ammo;
      // the cassette holds more than there are cells at tier 2 and 3, so the
      // lamps show the FRACTION rather than pretending to be a tally
      const live = Math.ceil((tw.a6.ammo / Math.max(1, tw.a6.mag)) * tw.rings.length);
      tw.rings.forEach((r, i) => { r.visible = i < live; });
    }
    // THE HEADING AND THE CADENCE, BOTH MEASURED FROM THE MOVE IT ACTUALLY
    // MADE rather than from where it would like to be. A leg cycle that runs
    // at a fixed rate while the body's speed changes is the thing that reads
    // as skating, and a heading taken from the WANT points at a waypoint the
    // machine may be walking around.
    const moved = sub3(tw.a6.pos, was);
    const n2 = norm3(tw.a6.pos);
    const flatMove = sub3(moved, scale3(n2, dot3(moved, n2)));
    const sp = Math.hypot(flatMove[0], flatMove[1], flatMove[2]) / Math.max(1e-6, dt);
    if (sp > cellSide * 0.02) {
      const want = scale3(flatMove, 1 / (sp * dt));
      // eased, so a waypoint change is a turn and not a snap
      tw.a6.head = tw.a6.head
        ? norm3(add3(scale3(tw.a6.head, 0.86), scale3(want, 0.14)))
        : want;
    }
    if (tw.obj.userData.setGaitRate) {
      // the clip was authored for one stride a cycle; the reference speed is
      // the module's own patrol pace, so a walker that is hurrying home
      // steps faster rather than sliding
      tw.obj.userData.setGaitRate(sp / (A6_TUNE.walkCells * cellSide));
    }
    placeTowerObj(tw);
  }

  function stepTowers(dt, tNow) {
    if (dt <= 0) return;
    stepPlasmaBeams(tNow);
    stepTowerSeekers(dt, tNow);
    for (const tw of towers) {
      // idle first, aim second: the idle sets rotation.y unconditionally, and
      // a tracking head must have the last word on where it looks
      if (tw.obj.userData.tick) tw.obj.userData.tick(tNow + tw.ci);
      // A WALKER RUNS ITS OWN LOOP and never touches the static path below:
      // it has no cooldown the tab owns, no fixed cell to shoot from, and no
      // head to aim. Everything it decides is heptapod.js's; everything it
      // DOES — the rocket, the sound, the model — is the board's.
      if (tw.a6) { stepWalker(tw, dt, tNow); continue; }
      if(tw.def.attack==='slowfield' && towerOffline(shield,tw.id,tNow))continue;
      aimTower(tw, dt);
      if(tw.key==='rotor'){
        const spin=!!pickTarget(graph.centers[tw.ci],effectiveStats(tw.def,tw.tier).range*cellSide,enemies,chord);
        if(spin!==!!tw.spinning)sfx.play('minigun_ready',{dist:camDist(graph.centers[tw.ci])});
        tw.spinning=spin;
      }
      tw.cooldown -= dt;
      if (tw.cooldown > 0) continue;
      const eff = effectiveStats(tw.def, tw.tier);
      const range = eff.range * cellSide;
      const tp = graph.centers[tw.ci];
      let target = CONTENT.missiles[tw.key] ? tw.missileTarget : pickTarget(tp, range, enemies, chord);
      // the railgun does not shoot THROUGH walls: if the nearest pick is
      // occluded by high ground, take the nearest VISIBLE enemy instead
      if (target && tw.def.hitscan && !losClear(tw.ci, target.pos)) {
        target = null;
        let bd = Infinity;
        for (const e of enemies) {
          if (!e.alive) continue;
          const d = chord(tp, e.pos);
          if (d <= range && d < bd && losClear(tw.ci, e.pos)) { bd = d; target = e; }
        }
      }
      if (!target) continue;
      // ...and a LAUNCHER waits for its lock. Everything else fires the
      // moment it has something in range.
      if (tw.def.lock && !(tw.lock && tw.lock.locked)) continue;
      if (CONTENT.missiles[tw.key] && !missileCanFire(tw.lock, target,
        missileDistance(tp, target.pos), tw.aimErr, engagementConfig(tw), tw.cooldown,
        !!missilePool?.available && !tw.obj.userData.loading)) continue;
      // A LANCE WILL NOT FIRE INTO DIRT. It is a straight line stopped by
      // terrain, so a target behind a rise is a target it cannot reach —
      // and firing anyway spends a two-second burst on a beam that ends in
      // the ground, which looks broken and is. The ray it is about to draw
      // is the ray that answers this, so it is asked first.
      if (tw.def.attack === 'lance') {
        // ON TARGET FIRST. The lance is drawn along the BARREL, not along
        // the bearing to the target, so a burst fired mid-slew goes wherever
        // the tube happens to be pointing — which the sentry range learned
        // the hard way and this had not yet been told. Two seconds of
        // cooldown is far too expensive to spend on a shot the drive has not
        // finished aiming.
        if ((tw.aimErr ?? 99) > SENTRY_TUNE.tolerance) continue;

        const mz0 = tw.obj.userData.muzzles;
        if (mz0 && mz0.length) {
          const m0 = mz0[(tw.shots ?? 0) % mz0.length];
          m0.updateWorldMatrix(true, false);
          m0.getWorldPosition(gunV);
          const f0 = [gunV.x, gunV.y, gunV.z];
          const d0 = norm3(sub3(target.pos, f0));
          const need = Math.hypot(target.pos[0] - f0[0], target.pos[1] - f0[1], target.pos[2] - f0[2]);
          const los = rayToTerrain(f0, d0, need, tw.ci);
          if (los.len < need - cellSide * 0.3) continue;
        }
      }
      if (tw.def.hitscan && (tw.aimErr ?? 99) > SENTRY_TUNE.tolerance) continue;
      tw.cooldown = shotInterval(eff.rate);
      // one line, every tower: the key IS the def key, unless the def says
      // otherwise — which the second roster's do, since there is no
      // `tower_rotor` and a missing sample is silence nobody notices
      sfx.play(towerSound(tw.def), { dist: camDist(tp) });
      const n = graph.normals[tw.ci];
      const muzzle = towerMuzzle(tw, add3(tp, scale3(n, cellSide * 0.55)));
      // the gun rides back on every round, and the flash leaves the barrel
      tw.recoil = 1;
      if (tw.obj.userData.muzzles && tw.obj.userData.muzzles.length) {
        const raw0 = sub3(target.pos, muzzle);
        const f0 = norm3(raw0);
        const fl = makeDotBurst(0xffe6a8, [f0[0], f0[1], f0[2]], 12);
        fl.scale.setScalar(cellSide * 3.2);
        fl.position.set(muzzle[0], muzzle[1], muzzle[2]);
        scene.add(fl);
        debris.push(fl);   // the board's own transient list, ticked and reaped
      }
      const raw = sub3(target.pos, tp);
      const flat = norm3(sub3(raw, scale3(norm3(tp), dot3(raw, norm3(tp)))));
      const atk = tw.def.attack;
      if (tw.def.hitscan) {
        // THE SNIPER IS A HEAVY SHOT, not a beam. The beam pair read as a
        // laser (operator ruling), so now the damage still lands this frame
        // — a sniper does not miss — but what you SEE is one fat slug
        // crossing the whole line in ~0.13s, trailing ghosts, with the
        // impact fx landing when the slug does. Straight line, one round.
        damageEnemy(target, tNow, eff.dmg, true);
        const hitP = add3(target.pos, scale3(norm3(target.pos), cellSide * 0.3));
        spawnSlug(muzzle, hitP, tw.def.color, cellIndex(target.pos));
        warnRing(tw.ci, tw.def.color, 0.35, cellSide * 0.9); // muzzle pulse
      } else if (atk === 'seeker') {
        // FIRE AND FORGET. The missile carries the target it was launched
        // at, so the launcher has no reason to keep looking at it — and
        // every reason not to, which is the lesson the sentry range taught:
        // a Quiver that holds its lock empties itself into one walker while
        // the rest of the wave goes past.
        launchTowerSeeker(tw, muzzle, target, tNow);
        if (tw.lock) tw.lock = makeLock();
      } else if (atk === 'lance') {
        // THE LANCE LEAVES THE MUZZLE TIP, ALONG THE BARREL, and stops at
        // the first thing solid (operator). Three corrections in one:
        //
        //  - it starts at the muzzle's REAL position and height, not at a
        //    point normalised onto the sphere and lifted back to a nominal
        //    wall height. That is what put the beam at the wrong altitude,
        //    detached from the model.
        //  - it runs along the BARREL, read off the muzzle's own world
        //    quaternion, so it comes out of the tube rather than out of a
        //    bearing computed at the cell centre.
        //  - it is a straight line in the WORLD, marched against terrain:
        //    the ground and the walls stop it, and it makes an impact where
        //    they do. Enemies do not stop it — it goes through them and
        //    damages every one it passes, which is the whole weapon.
        const from3 = muzzle;
        // FROM THE MUZZLE TIP, TOWARD THE TARGET. The first cut took the
        // direction from the muzzle empty's own world +Z — the model's
        // stated forward — and MEASURED it against the bearing to the
        // target: 2 degrees apart sometimes and 42 apart at others. A
        // muzzle empty's local orientation is simply not a contract the
        // Workshop makes (ROOT/BASE/YAW/PITCH/RECOIL and the muzzle's
        // POSITION are), so it is not something to aim a weapon with.
        //
        // The tip is what the operator asked for and the tip is what this
        // gives: the beam starts exactly at the barrel's mouth. Where it
        // goes is the weapon's business, and the weapon is shooting at the
        // target. The gate below keeps the two honest — a turret still
        // slewing does not fire, so the tube and the beam agree to within
        // the drive's own tolerance whenever a burst leaves.
        const dir3 = norm3(sub3(target.pos, from3));
        const stop = rayToTerrain(from3, dir3, range, tw.ci);
        let struck = 0;
        // MEASURED ON THE ARC THE BEAM IS DRAWN ALONG. This used distToSeg —
        // a straight chord — and the sag is not a rounding error: across the
        // lance's seven cells it is 0.0389 units against a hit radius of
        // cellSide * 0.5 = 0.04. A target standing on the ground at mid-range
        // sat 97% of the way out of a beam the picture showed passing
        // straight through it, so the lance was barely clipping the middle of
        // its own reach. projectToArc returns the same { s, off } and is what
        // the tank's secondary already measures with.
        const fromU3 = norm3(from3);
        const dTan3 = norm3(sub3(dir3, scale3(fromU3, dot3(dir3, fromU3))));
        for (const e of enemies) {
          if (!e.alive) continue;
          const pr = projectToArc(fromU3, dTan3, e.pos);
          if (pr.s < 0 || pr.s > stop.len) continue;
          const r = cellSide * Math.max(0.5, (e.size ?? e.spec.size) * 0.9);
          if (pr.off >= r) continue;
          damageEnemy(e, tNow, eff.dmg, true);
          struck++;
        }
        tw.lastStruck = struck;
        tw.lastStop = stop;
        lanceBeam(tw, from3, dir3, stop.len, tNow, struck, stop.hit);
      } else if (atk === 'beam') {
        // hitscan: damage now, draw the light
        damageEnemy(target, tNow, eff.dmg, true);
        const at = add3(target.pos, scale3(norm3(target.pos), cellSide * 0.3));
        if (shotOf(tw.def).plasma) throwPlasma(tw, muzzle, at, tNow);
        else spawnBeam(muzzle, at, tw.def.color);
      } else if (atk === 'slowfield') {
        // Continuous shield transfer runs outside the attack cadence.
        if (towerOffline(shield, tw.id, tNow)) continue;
        // THE FIELD IS UNIVERSAL, THE PICTURE IS THREE BOLTS. Every hostile
        // in range is still slowed — that is two numbers written on an
        // enemy and it costs nothing. What cost tower × enemy was the
        // PICTURE: a lightning bolt AND a 12-point dot burst spawned per
        // hostile per shot, which is precisely the product ?stress=T:W was
        // built to measure (towerXenemyInRange predicting liveBolts and
        // liveBursts). Now the NEAREST three get a bolt and nobody gets a
        // burst, so the effect's draw cost is bounded by the tower count
        // alone and a crowd is free. The nearest three are also the three
        // the player is looking at.
        const near = [];   // { e, d }, ascending, at most SLOW_BOLTS
        for (const e of enemies) {
          if (!e.alive) continue;
          const d = chord(tp, e.pos);
          if (d > range) continue;
          // A tower with no damage must not call damageEnemy at all: even at
          // 0 it resets a regenerator's out-of-combat clock and fires the
          // on-hit reactions — a barbed ACCELERATES when hit, so a "slow"
          // tower would have been speeding it up.
          if (eff.dmg > 0) damageEnemy(e, tNow, eff.dmg, true);
          if (!e.alive) continue;
          e.slowFactor = eff.slowFactor;
          e.slowUntil = tNow + eff.slowDur;
          // insertion into a 3-slot list: one pass, no sort of the crowd
          let i = near.length;
          while (i > 0 && near[i - 1].d > d) i--;
          if (i < SLOW_BOLTS) {
            near.splice(i, 0, { e, d });
            if (near.length > SLOW_BOLTS) near.pop();
          }
        }
        for (const t3 of near) spawnLightning(muzzle, t3.e.pos, tw.def.color, tNow);
      } else if (atk === 'spread') {
        for (let p = 0; p < eff.pellets; p++) {
          const ang = (p - (eff.pellets - 1) / 2) * 0.22;
          const cs = Math.cos(ang), sn = Math.sin(ang);
          const nn = norm3(tp);
          const nxd = cross3(nn, flat);
          const dir = norm3(add3(scale3(flat, cs), scale3(nxd, sn)));
          spawnTowerShot(muzzle, dir, tw, eff, null);
        }
      } else {
        spawnTowerShot(muzzle, flat, tw, eff, atk === 'homing' ? target : null,
          atk === 'mortar' ? chord(tp, target.pos) : 0);
      }
    }
  }

  // Line of sight for hitscan: sample the chord from the mast's cell to
  // the target every ~0.45 cells; any BLOCKED cell along it (other than
  // the tower's own — the mast stands ON high ground) refuses the shot.
  // Adjacent ridge cells block a shot along the ridge, which is correct:
  // that is what 'not through walls' means for a gun at wall height.
  function losClear(fromCi, toPos) {
    const a = graph.centers[fromCi];
    const steps = Math.max(2, Math.ceil(dist3(a, toPos) / (cellSide * 0.45)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const pmid = norm3([
        a[0] + (toPos[0] - a[0]) * t,
        a[1] + (toPos[1] - a[1]) * t,
        a[2] + (toPos[2] - a[2]) * t]);
      const ci = cellIndex(pmid);
      if (ci !== -1 && ci !== fromCi && dungeon.tags[ci] === BLOCKED) return false;
    }
    return true;
  }

  // HK's projectile identity: every shot is a TRACER — a bright additive
  // head dragging the profile's `trail` ghost points, dimming to the tail. Each
  // tracer is one small Points object (≤12 verts), rebuilt per shot.
  // DELEGATED. This built the tracer inline, which meant the shooting lab
  // could only guess at it — and a guess is what made the lab's Mortar look
  // like a different weapon from the board's. One builder, two callers.
  function makeTracer(color, px, trailN) {
    return makeTracerMesh(color, px, trailN);
  }

  // A Points vertex is a SQUARE unless you tell it otherwise, and at 12px
  // (the mortar shell) the corners read. One shared radial-falloff sprite
  // rounds every tracer — built once, on first use.
  let roundDotTex = null;
  function roundDot() {
    if (roundDotTex) return roundDotTex;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    roundDotTex = new THREE.CanvasTexture(c);
    return roundDotTex;
  }

  function spawnTowerShot(pos, dir, tw, eff, homing, arcTotal = 0) {
    const sfx2 = shotOf(tw.def);
    const shell=tw.def.key==='mortar';
    const mesh = shell?makeOrdnanceShell(cellSide*.28):makeTracer(tw.def.color, sfx2.projPx ?? 5, sfx2.trail ?? 0);
    const p0 = norm3(pos);
    const lift0 = 1 + params.wallHeight * 0.5;
    const attr = mesh.geometry.getAttribute('position');
    for (let i = 0; !shell && i < attr.count; i++) {
      attr.setXYZ(i, p0[0] * lift0, p0[1] * lift0, p0[2] * lift0);
    }
    attr.needsUpdate = true;if(shell)mesh.position.set(p0[0]*lift0,p0[1]*lift0,p0[2]*lift0);
    scene.add(mesh);
    // a lobbed shell knows where it will land before it leaves the tube —
    // the marker on that cell is most of the mortar's feel: threat you can
    // read, and step out of
    const landCi = arcTotal > 0
      ? cellIndex(norm3(add3(p0, scale3(dir, arcTotal)))) : -1;
    towerShots.push({
      pos: p0, dir, dist: 0, mesh, shell,
      dmg: eff.dmg, splash: (eff.splash || 0) * cellSide, homing,
      range: eff.range * cellSide * 1.35,
      speed: (sfx2.projSpeed ?? 16) * cellSide, // per-tower tempo
      arcTotal, arcH: cellSide * 2.3, color: tw.def.color, // a lob, not a moonshot
      landCi, markT: 0, px: sfx2.projPx ?? 5,
    });
  }

  function killTowerShot(i) {
    scene.remove(towerShots[i].mesh);
    towerShots[i].mesh.geometry.dispose(); // per-shot tracer geometry
    towerShots[i].mesh.material.dispose();
    towerShots.splice(i, 1);
  }

  // splash detonation: tinted burst + damage to everything in the radius.
  // The show scales with the SPLASH, so a mortar shell that threatens two
  // cells looks like it — and the ground takes a shock ring, the same
  // language as the orbital strike one register down.
  function detonate(p, tNow) {
    for (const e2 of enemies) {
      if (e2.alive && chord(p.pos, e2.pos) <= p.splash) damageEnemy(e2, tNow, p.dmg, true);
    }
    const splashCells = p.splash / cellSide;
    const impactCi = cellIndex(p.pos);
    if (impactCi !== -1 && splashCells > 0.5) {
      warnRing(impactCi, p.color, 0.5, p.splash * 1.1);
    }
    const boom = makeDotBurst(p.color, norm3(p.pos), Math.round(42 + splashCells * 40));
    boom.scale.setScalar(cellSide * (1.1 + splashCells * 0.6));
    const bp = add3(p.pos, scale3(norm3(p.pos), cellSide * 0.2));
    boom.position.set(bp[0], bp[1], bp[2]);
    scene.add(boom);
    debris.push(boom);
  }

  function updateTowerShots(dt, tNow) {
    for (let i = towerShots.length - 1; i >= 0; i--) {
      const p = towerShots[i];
      const v = p.speed; // each tower's own tempo — HK's feel lives here
      // HOMING CHASES, per HokorobiTawaa: the velocity is steered toward the
      // live target's position every frame with a dt-scaled rate — the old
      // fixed 0.75/0.25 blend was frame-rate-DEPENDENT (limp at 30fps, stiff
      // at 120) and too soft to read as pursuit at any of them. k = 6/s is
      // HK's own constant: tight enough to whip round a fleeing phage,
      // loose enough that the curve is visible, which is the whole point.
      if (p.homing && p.homing.alive) {
        const raw = sub3(p.homing.pos, p.pos);
        const n0 = norm3(p.pos);
        const want = norm3(sub3(raw, scale3(n0, dot3(raw, n0))));
        const k = Math.min(1, 6 * dt);
        p.dir = norm3(add3(scale3(p.dir, 1 - k), scale3(want, k)));
      }
      p.pos = norm3(add3(p.pos, scale3(p.dir, v * dt)));
      const n = p.pos;
      p.dir = norm3(sub3(p.dir, scale3(n, dot3(p.dir, n))));
      p.dist += v * dt;
      // mortar lofts: a sine arc over its measured throw
      // BALLISTIC, not a sine hump. Warping the flight fraction (u^1.35)
      // pushes the apex past 60% of the flight and compresses the whole
      // descent into the remainder — the shell hangs, then PLUMMETS, which
      // is what heavy looks like. The old symmetric sine floated down as
      // gently as it rose.
      const u = p.arcTotal > 0 ? Math.min(1, p.dist / p.arcTotal) : 0;
      const uw = Math.pow(u, 1.35);   // (`v` is this scope's speed)
      const arc = p.arcTotal > 0 ? 4 * uw * (1 - uw) * p.arcH : 0;
      const lift = 1 + params.wallHeight * 0.5 + arc;
      // the shell SWELLS toward apex — nearer the top-down camera, and it
      // sells the height even from the chase cam
      if (p.arcTotal > 0 && !p.shell) p.mesh.material.size = p.px * (1 + 1.1 * (arc / p.arcH));
      // the landing cell blinks while the shell is up: readable threat,
      // through the same pooled rings as everything else
      if (p.landCi >= 0) {
        p.markT -= dt;
        if (p.markT <= 0) {
          p.markT = 0.3;
          warnRing(p.landCi, p.color, 0.28, p.splash > 0 ? p.splash * 0.85 : cellSide);
        }
      }
      // tracer: ghosts shift back one slot, the head takes the new point
      if(p.shell){
        const previous=p.mesh.position.clone();p.mesh.position.set(p.pos[0]*lift,p.pos[1]*lift,p.pos[2]*lift);
        const direction=p.mesh.position.clone().sub(previous).normalize();if(direction.lengthSq()>0)p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      }else{
      const attr = p.mesh.geometry.getAttribute('position');
      for (let k = attr.count - 1; k > 0; k--) {
        attr.setXYZ(k, attr.getX(k - 1), attr.getY(k - 1), attr.getZ(k - 1));
      }
      attr.setXYZ(0, p.pos[0] * lift, p.pos[1] * lift, p.pos[2] * lift);
      attr.needsUpdate = true;
      }
      // mortar detonates at the end of its arc, hit or not
      if (p.arcTotal > 0 && p.dist >= p.arcTotal) {
        detonate(p, tNow);
        killTowerShot(i);
        continue;
      }
      let hit = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (chord(p.pos, e.pos) < cellSide * Math.max(0.42, (e.size ?? e.spec.size) * 0.8)) {
          if (p.splash > 0) detonate(p, tNow);
          else {
            damageEnemy(e, tNow, p.dmg, true);
            // HK's hit spark, through the pooled rings — a strike that
            // lands should flash WHERE it landed, and an object per hit
            // would be churn the pool exists to avoid
            warnRing(cellIndex(e.pos), p.color, 0.22, cellSide * 0.55);
          }
          hit = true;
          break;
        }
      }
      if (hit || p.dist > p.range) killTowerShot(i);
    }
  }

  // beams: a thin bright segment that burns out fast — laser + slow tethers
  const beamGeo = new THREE.BoxGeometry(1, 1, 1);
  function spawnBeam(a, b, color, ttl = 0.16, width = 0.03) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(beamGeo, mat);
    const mid = scale3(add3(a, b), 0.5 * (1 + params.wallHeight * 0.5));
    mesh.position.set(mid[0], mid[1], mid[2]);
    const d = sub3(b, a);
    const len = len3(d);
    mesh.scale.set(cellSide * width, cellSide * width, Math.max(1e-6, len));
    tmpV.set(d[0], d[1], d[2]).normalize();
    mesh.quaternion.setFromUnitVectors(Z_AXIS, tmpV);
    scene.add(mesh);
    beams.push({ mesh, ttl, ttl0: ttl });
  }

  // lightning tether (slow field): a jagged additive polyline from the
  // tower head to the victim — HK's slow-tower identity. Jitter is a
  // pure function of segment index + time: deterministic, and it never
  // touches the gameplay rng stream.
  // The BOLT is shotfx's; the lifetime stays here, which is the one thing the
  // board and the lab genuinely differ about. radialLift is the board's own:
  // it pushes the bolt out from the sphere's centre so it rides above the
  // wall tops, and a flat lab passes 0.
  function spawnLightning(a, b, color, tNow) {
    const line = makeLightningMesh(a, b, color,
      { t: tNow, radialLift: params.wallHeight * 0.5 });
    scene.add(line);
    beams.push({ mesh: line, ttl: 0.32, ttl0: 0.32, dg: true });
  }

  // cosmetic railgun slugs: the hit already landed; the SHOT is what flies
  const slugFx = []; // { a, b, t, dur, mesh, color, ci }
  function spawnSlug(a, b, color, impactCi) {
    const mesh = makeTracer(0xffffff, 14, 6);
    scene.add(mesh);
    slugFx.push({ a, b, t: 0, dur: 0.13, mesh, color, ci: impactCi });
  }
  function stepSlugs(dt) {
    for (let i = slugFx.length - 1; i >= 0; i--) {
      const sl = slugFx[i];
      sl.t += dt;
      const f = Math.min(1, sl.t / sl.dur);
      const attr = sl.mesh.geometry.getAttribute('position');
      for (let k = 0; k < attr.count; k++) {
        const fk = Math.max(0, f - k * 0.045); // ghosts trail the head
        attr.setXYZ(k,
          sl.a[0] + (sl.b[0] - sl.a[0]) * fk,
          sl.a[1] + (sl.b[1] - sl.a[1]) * fk,
          sl.a[2] + (sl.b[2] - sl.a[2]) * fk);
      }
      attr.needsUpdate = true;
      if (f >= 1) {
        // arrival IS the impact: ring + spark land with the slug
        if (sl.ci !== -1) {
          warnRing(sl.ci, 0xffffff, 0.3, cellSide * 0.7);
          warnRing(sl.ci, sl.color, 0.35, cellSide * 0.5);
        }
        scene.remove(sl.mesh);
        sl.mesh.geometry.dispose();
        sl.mesh.material.dispose();
        slugFx.splice(i, 1);
      }
    }
  }

  function updateBeams(dt) {
    for (let i = beams.length - 1; i >= 0; i--) {
      beams[i].ttl -= dt;
      beams[i].mesh.material.opacity = Math.max(0, beams[i].ttl / (beams[i].ttl0 || 0.16)) * 0.9;
      if (beams[i].ttl <= 0) {
        scene.remove(beams[i].mesh);
        beams[i].mesh.material.dispose();
        if (beams[i].dg) beams[i].mesh.geometry.dispose(); // per-bolt geometry
        beams.splice(i, 1);
      }
    }
  }

  function clearTowers() {
    // the order book dies with the board, and so does its biomass: this is
    // a fresh run, not a refund
    for (const o of orders) {
      dropSiteRing(o);
      if (o.ghost) { scene.remove(o.ghost); disposeObj(o.ghost); }
    }
    orders.length = 0;
    orderByCell.clear();
    if (isao) {
      scene.remove(isao.obj);
      disposeObj(isao.obj);
      isao = null;
    }
    for (const tw of towers) { scene.remove(tw.obj); disposeObj(tw.obj); }
    for (const m of towerSeekers) missilePool?.release(m.mesh);
    towerSeekers.length=0;
    towers.length = 0;
    towerByCell.clear();
    towerCells.clear();
    watchTower = null;
    for (let i = towerShots.length - 1; i >= 0; i--) killTowerShot(i);
    for (let i = beams.length - 1; i >= 0; i--) {
      scene.remove(beams[i].mesh);
      beams[i].mesh.material.dispose();
      beams.splice(i, 1);
    }
    hideRangeRing();
    closeShop();
  }

  // --- shop / upgrade panel (build mode, tap a cell) ----------------------
  // portal object factory — shared by creation and live re-shaping.
  // Orientation: upright (local +Y = surface normal) AND the gate's open
  // face turned down the lane — toward the open neighbor nearest the
  // Heart, where its creatures will march — never sideways into walls.
  // How long a gate takes to draw itself. Long enough to watch — a gate
  // appearing is the most consequential thing that happens on this board and
  // it used to take no time at all.
  const GATE_DIAL = 1.6;

  // --- THE TERRAFORMER BUILDS (operator, 2026-09-02) ---------------------
  // "give the image that the Terraformer is active by having it build things,
  // this also acts as a time-keeping milestone of sorts. small containers, a
  // new tank."
  //
  // Two products, on two clocks, both keyed to the WAVE counter so they read
  // as time passing rather than as rewards: every second wave a small
  // container is printed into a yard beside the Stalheart — the yard is the
  // clock, you count it — and every fifth wave a new hull is printed and
  // racked in a berth, if there is room for one. While a job runs the rig
  // works visibly faster and the site pulses; when it lands, a toast says so.
  const TF = { containerEvery: 2, hullEvery: 5, containerSecs: 7, hullSecs: 10, yardMax: 8,
    caseEvery: 3 };   // ...and a case of mines, between the other two clocks
  const tfYard = [];        // { obj, ci }
  const tfQueue = [];       // kinds waiting for the bed
  let tfJob = null;         // { kind, obj, ci, t, dur, pulseT }
  let tfContainers = 0, tfHulls = 0;

  // A yard cell: open, two or three hops from the heart, not a berth, not
  // already used. Deterministic order (cell index), so the yard grows the
  // same way on the same seed.
  // ON THE PEDESTAL'S RIM, measured from the pedestal rather than counted in
  // hops: hop 2-3 landed stores at 2.0-2.7 cells while the pad reaches 1.43,
  // which is "somewhere near the heart" rather than "at the Terraformer's
  // feet". Nearest first, so the yard grows outward from the rim.
  function tfYardCell() {
    const taken = new Set([...tfYard.map((y) => y.ci), ...berths.map((b) => b.ci),
      ...lifeContainers.map((c) => c.ci)]);
    const hc = graph.centers[dungeon.heart];
    const pad = heartSprite && heartSprite.userData.padR
      ? (heartSprite.userData.padR * heartSprite.userData.sizeScale) / cellSide : 1.4;
    let best = -1, bd = Infinity;
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] === BLOCKED || taken.has(i)) continue;
      const d = dist3(hc, graph.centers[i]) / cellSide;
      if (d < pad + 0.35 || d > pad + 1.6) continue;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function tfStart(kind) {
    if (tfJob) { tfQueue.push(kind); return; }
    if (kind === 'hull' && playerHP >= PLAYER_MAX) kind = 'container';   // full: build the other thing
    if (kind === 'container' && tfYard.length >= TF.yardMax) return;     // the yard is the clock; it has a face
    if (kind === 'container') {
      const ci = tfYardCell();
      const g = ci >= 0 ? dressMetal(makeContainerFixture(0)) : null;
      if (!g) {
        // MODEL NOT LANDED YET. The first cut dropped the job here — one way
        // a Terraformer "moves as if building something but builds nothing".
        // Wait for the bytes and start the same job.
        if (ci >= 0) preloadContainer().then((ok) => { if (ok && !tfJob) tfStart('container'); });
        return;
      }
      // SEALED, BY GEOMETRY. Rotation 0 is not "shut" — measured, the leaf at
      // 0 still stands 0.50 deep in the box's frame (the authored rest pose is
      // ajar), which is why the stores read as open. Find the angle at which
      // each leaf lies flattest in the end wall and use that.
      shutDoors(g);
      const c = graph.centers[ci], n = graph.normals[ci], hc = graph.centers[dungeon.heart];
      g.userData.full = [cellSide * 0.45, cellSide * 0.45, cellSide * 0.45 * 0.55];
      g.scale.set(0.001, 0.001, 0.001);
      g.position.set(c[0], c[1], c[2]);
      tmpObj.position.copy(g.position); tmpObj.up.set(n[0], n[1], n[2]);
      tmpObj.lookAt(hc[0], hc[1], hc[2]);
      g.quaternion.copy(tmpObj.quaternion);
      scene.add(g);
      tfJob = { kind, obj: g, ci, t: 0, dur: TF.containerSecs, pulseT: 0 };
    } else {
      tfJob = { kind: 'hull', obj: null, ci: dungeon.heart, t: 0, dur: TF.hullSecs, pulseT: 0 };
    }
    if (heartSprite) heartSprite.userData.working = 1;
  }
  const doorBox = new THREE.Box3(), doorSz = new THREE.Vector3(), doorInv = new THREE.Matrix4();
  function shutDoors(g) {
    g.updateMatrixWorld(true);
    doorInv.copy(g.matrixWorld).invert();
    for (const name of ['Door_L_Pivot', 'Door_R_Pivot']) {
      const piv = g.getObjectByName(name);
      if (!piv) continue;
      let bestA = 0, bestZ = Infinity;
      for (let a = -1.2; a <= 1.2001; a += 0.05) {
        piv.rotation.y = a; g.updateMatrixWorld(true);
        doorBox.makeEmpty();
        piv.traverse((o) => { if (o.isMesh) doorBox.union(new THREE.Box3().setFromObject(o).applyMatrix4(doorInv)); });
        doorBox.getSize(doorSz);
        if (doorSz.z < bestZ) { bestZ = doorSz.z; bestA = a; }
      }
      piv.rotation.y = bestA;
      piv.userData.shutAngle = bestA; piv.userData.shutDepth = bestZ;
    }
    g.updateMatrixWorld(true);
  }
  // AUTO-UPGRADE (operator, 2026-09-02: "IF excess cash AND some towers are
  // not upgraded, THEN go around and upgrade them"). Off by default; a
  // checkbox on the panel. "Excess" means the purse would still hold the
  // reserve after paying — a drone that spends your last biomass on a tier
  // you did not choose is a drone you switch off. One order at a time and
  // never more than the drones can carry, so the queue stays yours.
  const AUTO_RESERVE = 150;
  let autoUpClock = 0;
  function autoUpgradeTick(dt) {
    if (!params.autoUpgrade || !eco) return;
    autoUpClock += dt;
    if (autoUpClock < 1.5) return;
    autoUpClock = 0;
    if (orders.length >= workers().length) return;
    let bestT = null, bestC = Infinity;
    for (const tw of towers) {
      if (orderByCell.has(tw.ci)) continue;
      const c = upgradeCost(tw.def, tw.tier);
      if (c === null) continue;                              // topped out
      if (eco.biomass - c < AUTO_RESERVE) continue;          // not excess
      if (c < bestC) { bestC = c; bestT = tw; }
    }
    if (bestT) orderUpgrade(bestT);
  }
  function tfMilestone(w) {
    // A RESCUE HAS NO SUPPLY LINE. No hull, no store, no mine case: the
    // budget is what you were given, which is the whole tactical statement.
    if (missionOn) return;
    if (w > 0 && w % TF.hullEvery === 0) tfStart('hull');
    else if (w > 0 && w % TF.containerEvery === 0) tfStart('container');
    // THE MINE CASE RIDES ITS OWN CLOCK, deliberately outside the else-if
    // chain above. A case is not a container and does not occupy the bed, so
    // making it compete for the milestone would starve the YARD — and the
    // yard is the clock the player counts. Every third wave, always.
    if (w > 0 && w % TF.caseEvery === 0) mineCase('terraformer');
  }
  function tfTick(dt) {
    if (!tfJob) { if (tfQueue.length) tfStart(tfQueue.shift()); return; }
    tfJob.t += dt;
    const u = Math.min(1, tfJob.t / tfJob.dur);
    const e = u * u * (3 - 2 * u);
    if (tfJob.obj) {
      const f = tfJob.obj.userData.full;
      const k = Math.max(0.02, e);
      tfJob.obj.scale.set(f[0] * k, f[1] * k, f[2] * k);
    }
    // the site pulses while the bed is live — the same ring the strike and
    // the shell speak, at build scale
    tfJob.pulseT -= dt;
    if (tfJob.pulseT <= 0) {
      tfJob.pulseT = 0.7;
      warnRing(tfJob.ci, 0x9fdcff, 0.5, cellSide * (tfJob.kind === 'hull' ? 2.2 : 1.2));
    }
    if (u < 1) return;
    // LANDED
    if (heartSprite) heartSprite.userData.working = 0;
    const nrm = norm3(graph.centers[tfJob.ci]);
    const burst = makeDotBurst(0x9fdcff, nrm, tfJob.kind === 'hull' ? 60 : 30);
    burst.scale.setScalar(cellSide * (tfJob.kind === 'hull' ? 1.2 : 0.7));
    const bp = scale3(nrm, 1 + cellSide * 0.3);
    burst.position.set(bp[0], bp[1], bp[2]);
    scene.add(burst); debris.push(burst);
    if (tfJob.kind === 'container') {
      tfYard.push({ obj: tfJob.obj, ci: tfJob.ci });
      tfContainers++;
      showToast(`<div class="wave-num">TERRAFORMER &#9656; STORE ${tfContainers}</div>`
        + `<div class="wave-role">a container printed into the yard · wave ${wave}</div>`, 2400);
    } else {
      playerHP = Math.min(PLAYER_MAX, playerHP + 1);
      tfHulls++;
      syncLifeContainers();
      sfx.play('tank_spool_up');
      showToast(`<div class="wave-num">TERRAFORMER &#9656; NEW HULL</div>`
        + `<div class="wave-role">a mk-cx printed and racked · hulls ${playerHP}/${PLAYER_MAX}</div>`, 3000);
      updateHud();
    }
    tfJob = null;
  }
  function tfReset() {
    for (const y of tfYard) { scene.remove(y.obj); disposeObj(y.obj); }
    tfYard.length = 0; tfQueue.length = 0;
    if (tfJob && tfJob.obj) { scene.remove(tfJob.obj); disposeObj(tfJob.obj); }
    tfJob = null; tfContainers = 0; tfHulls = 0;
    if (heartSprite) heartSprite.userData.working = 0;
  }
  // the HUD line, beside ISAO's: what is on the bed, or what the clock says
  function terraLine() {
    if (tfJob) {
      const pct = Math.round(Math.min(1, tfJob.t / tfJob.dur) * 100);
      return `<div class="hud-obj hud-isao">TERRAFORMER &#9656; printing ${tfJob.kind === 'hull' ? 'a new hull' : `store ${tfContainers + 1}`} ${pct}%</div>`;
    }
    const left = TF.hullEvery - (wave % TF.hullEvery);
    const mleft = TF.caseEvery - (wave % TF.caseEvery);
    return `<div class="hud-obj hud-isao">TERRAFORMER &#9656; yard ${tfYard.length} · next hull in ${left} wave${left === 1 ? '' : 's'}`
      + ` · mines in ${mleft}</div>`;
  }

  // How tall a standing gate is, in cells. Bigger than the tank (~0.85) on
  // purpose — it is a doorway, and the thing coming through it should look
  // like it fits.
  const GATE_HEIGHT = 1.6;

  // HOW LONG UNTIL THE NEXT WAVE, in seconds. Infinity while one is already
  // running, and while the board has no live gate to send it. Factored out of
  // the boss omen, which was the only thing that knew how to work it out —
  // the gates want the same number and two copies of a clock is two clocks.
  function secsToWave() {
    if (waveActive) return Infinity;
    if (waveIn >= 0) return waveIn;
    if (!spawnPoints.some((sp) => sp.alive)) return Infinity;
    return params.waveGap - interClock;
  }

  // --- THE WORMHOLE, ONCE FOR THE WHOLE BOARD ----------------------------
  //
  // One render target, one march, however many gates are standing — the cost
  // does not scale with the number of portals because they all sample the
  // same texture. That was the load-bearing claim the #portal bench was built
  // to test, and it is the only reason a 377M-sine-fold effect can be on a
  // board that also has a game to draw.
  //
  // Rendered into an OFFSCREEN target with the main renderer, then bound as a
  // map. The target is sRGB on purpose: the effect writes display-referred
  // values and a material sampling it expects linear, so three has to convert
  // on read. Getting that backwards is the single most common cause of "right
  // in the sandbox, wrong in my scene" (PORTING.md).
  let whRt = null, whMat = null, whScene = null, whCam = null, whLastAt = -1e9;
  const whPhase = { travel: 0, spin: 0 };
  let whTravelRate = 0;   // reported by the probe; driven by the wave clock
  // A HIT SPINS THE WORMHOLE UP (operator, 2026-09-02). The dot-cloud gate
  // vibrated when it was struck; a solid ring cannot shudder convincingly, so
  // the tell moves INSIDE — the throat lurches and winds back down.
  //
  // It is the SHARED target, so every gate on the board flares together. That
  // is the cost of one march for all of them, and it is worth naming: you are
  // almost always shooting one gate at a time, and a board-wide lurch reads as
  // the network noticing rather than as a bug.
  let whKick = 0;
  const WH_KICK = 9;        // travel added at the instant of a hit
  const WH_KICK_DECAY = 2.2; // ...bled off this fast, in units per second
  const whUniforms = {
    uResolution: { value: new THREE.Vector3(1, 1, 1) },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector4() },
    uTravel: { value: 0 },
    uSpinPhase: { value: 0 },
  };
  // the secondary uniforms come from portalfx (one source with the bench and
  // the cinematics); a preset overrides them below
  for (const [k, v] of Object.entries(WORMHOLE_UNIFORM_DEFAULTS)) whUniforms[k] = { value: v };
  for (const [k, v] of Object.entries(WORMHOLE_PRESET)) whUniforms[k] = { value: v };
  // the UNION with the corona's uniforms (the bench's rule, portal-tab.js):
  // a uniform a program declares and the object lacks is a hard failure, so
  // switching effects must never remove one. The lab is the only switcher.
  whUniforms.uRingRadius = { value: 1.0 };
  const BOARD_FX = { wormhole: { frag: WORMHOLE_FRAG, exposure: WORMHOLE_PRESET.uExposure },
                     corona: { frag: CORONA_FRAG, exposure: 30 } };
  function setBoardEffect(name) {
    const spec = BOARD_FX[name];
    if (!spec || !whMat) return;
    whMat.fragmentShader = spec.frag;
    whMat.needsUpdate = true;
    whUniforms.uExposure.value = spec.exposure;   // they differ ~5x; corona's 30 on the wormhole is a white disc
    whLastAt = -1e9;                              // march now, whatever the Hz
  }

  function ensureWormhole() {
    if (whRt) return whRt;
    const n = whRender.size;
    whRt = new THREE.WebGLRenderTarget(n, n, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false,
    });
    whRt.texture.colorSpace = THREE.SRGBColorSpace;
    whUniforms.uResolution.value.set(n, n, 1);
    whScene = new THREE.Scene();
    whCam = new THREE.Camera();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    whMat = new THREE.ShaderMaterial({
      // NOT OPTIONAL: tanh() and `out` are GLSL ES 3.00 only, and the
      // shader's tonemap is built on tanh.
      glslVersion: THREE.GLSL3,
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: WORMHOLE_FRAG,
      uniforms: whUniforms,
      depthTest: false, depthWrite: false,
    });
    whScene.add(new THREE.Mesh(g, whMat));
    return whRt;
  }

  // THE RAMP. Travel sits at 0 and winds to 6 across the last five seconds
  // before a wave lands (portalfx.travelRate) — the gate is a mouth that
  // starts to pull just before something comes out of it. The rate is
  // integrated into a phase here rather than multiplied by elapsed time in
  // the shader: a rate that multiplies accumulated time rewrites its own
  // history every frame it changes, which makes a ramp impossible.
  const whFrustum = new THREE.Frustum();
  const whProj = new THREE.Matrix4();
  const whDiscPos = new THREE.Vector3();
  function anyGateVisible() {
    if (document.hidden) return false;
    camera.updateMatrixWorld();
    whProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    whFrustum.setFromProjectionMatrix(whProj);
    for (const sp of spawnPoints) {
      if (!sp.alive || !sp.obj) continue;
      const disc = sp.obj.userData.disc;
      if (!disc) continue;
      disc.getWorldPosition(whDiscPos);
      // sphere-vs-frustum with the gate's own size as the radius: visible
      // unless some plane pushes the whole gate outside
      const r = sp.obj.userData.sizeScale ?? cellSide;
      if (whFrustum.planes.every((pl) => pl.distanceToPoint(whDiscPos) > -r)) return true;
    }
    return false;
  }

  function updateWormhole(dt, tNow) {
    if (!whRt) return;
    whKick = Math.max(0, whKick - WH_KICK_DECAY * dt);
    whTravelRate = travelRate(secsToWave(), TRAVEL) + whKick;
    advancePhase(whPhase, dt, whTravelRate, WORMHOLE_PRESET.uTimeScale);
    const period = 1 / Math.max(1, whRender.updateHz);
    if (tNow - whLastAt < period) return;
    // NOTHING TO SHOW, NOTHING TO MARCH. The phase keeps advancing above so a
    // gate scrolling back into view is where it should be — but the 377M
    // sine-folds are only spent when a live gate's disc is inside the camera
    // frustum. Driving away from the gates is most of the game.
    if (!anyGateVisible()) return;
    whLastAt = tNow;
    whUniforms.uTime.value = tNow;
    whUniforms.uTravel.value = whPhase.travel;
    whUniforms.uSpinPhase.value = whPhase.spin;
    renderer.setRenderTarget(whRt);
    renderer.render(whScene, whCam);
    renderer.setRenderTarget(null);
  }

  // The authored ring, with the wormhole in the hole the blueprint reserves,
  // falling back to the dot cloud until the bytes land — a gate you cannot
  // see is a gate you cannot shoot, so "nothing yet" is not an option.
  // WHEN THE BYTES LAND LATE, SWAP THE GATES THAT ARE ALREADY UP.
  //
  // A gate can be seeded before the GLB resolves — the tutorial seeds one in
  // the first frames — and those would keep the dot cloud for the whole run
  // while later gates wore the ring. One board, two kinds of gate, is worse
  // than either. Rebuild in place, carrying the dial so a gate that is still
  // drawing itself in does not snap to full size.
  let ringSwapped = false;
  function swapGatesToRing() {
    if (ringSwapped || !graph || !dungeon) return;
    ringSwapped = true;
    for (const sp of spawnPoints) {
      if (!sp.obj) continue;
      const dial = sp.obj.userData.dial ?? 1;
      scene.remove(sp.obj);
      sp.obj = buildPortalObj(sp.ci, whim() * 6.283);
      sp.obj.userData.dial = dial;
      if (sp.obj.userData.setForm) sp.obj.userData.setForm(dial);
      scene.add(sp.obj);
    }
  }
  preloadPortalRing().then((ok) => { if (ok) swapGatesToRing(); });

  function makeGateBody(phase) {
    const ring = dressMetal(makePortalRing(0x8fe8ff));
    if (!ring) return makePortalCloud({ body: 0xcfd8ff, hi: 0xffffff }, phase);
    ensureWormhole();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({
        map: whRt.texture,
        // The effect is authored on black, so ADDITIVE makes the black the
        // transparency — no alpha channel, and the rim spills onto the ring's
        // inner liner the way a real one would.
        blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false,
        side: THREE.DoubleSide, toneMapped: false,
      }));
    const vol = ring.userData.aperture;
    // unit radius under the aperture node, which carries the authored size
    if (vol) vol.add(disc); else { disc.scale.setScalar(1.8); ring.add(disc); }
    ring.userData.disc = disc;
    // the ring's own idle, at the bench's tuned rates
    ring.userData.tick = (t, dt) => {
      const d = dt ?? 1 / 60;
      if (ring.userData.rotorA) ring.userData.rotorA.rotation.z += RING_SPIN.rotorA * d;
      if (ring.userData.rotorB) ring.userData.rotorB.rotation.z += RING_SPIN.rotorB * d;
      if (ring.userData.yaw) ring.userData.yaw.rotation.y += RING_SPIN.yaw * d;
    };
    // the dial the gate is drawn in with — the cloud exposes setForm, the
    // ring scales instead, so both answer the same call
    ring.userData.setForm = (f) => {
      const k = Math.max(0.001, f);
      ring.scale.setScalar((ring.userData.sizeScale ?? 1) * k);
    };
    ring.userData.grounded = true;   // its origin IS its base (fitModel)
    return ring;
  }

  function buildPortalObj(ci, phase) {
    const obj = makeGateBody(phase);
    // starts unformed; stepGates draws it in
    obj.userData.dial = 0;
    if (obj.userData.setForm) obj.userData.setForm(0);
    // A GATE IS A DOORWAY, SO IT STANDS ON THE GROUND (operator, 2026-09-02).
    //
    // The dot cloud was an orb and was floated clear of the surface to read as
    // one. The ring is architecture: fitModel seats its origin at its own
    // base, so the surface point IS where it goes — measured, the old offset
    // left it hanging 0.63 cells in the air. And it is taller than the tank
    // on purpose; the thing driving through a gate should be smaller than the
    // gate.
    const grounded = obj.userData.grounded === true;
    const r = cellSide * (grounded ? GATE_HEIGHT : 0.7);
    obj.scale.setScalar(r);
    obj.userData.sizeScale = r;
    const c = graph.centers[ci];
    const n = graph.normals[ci];
    if (grounded) obj.position.set(c[0], c[1], c[2]);
    else obj.position.set(c[0] + n[0] * r * 0.9, c[1] + n[1] * r * 0.9, c[2] + n[2] * r * 0.9);
    // FACE AN EMPTY SPOT, not merely a downhill one. The old rule took the
    // open neighbour nearest the Heart, which can be a cell with rock right
    // behind it — a gate whose mouth opens into a wall two steps on. Score
    // each open neighbour by how open ITS OWN neighbourhood is, and let the
    // distance to the Heart break ties, so the gate still points down the
    // lane when the lane is clear.
    let face = null, bestScore = -Infinity;
    for (const nb of graph.adj[ci]) {
      if (dungeon.tags[nb] === BLOCKED) continue;
      const d = dungeon.distToHeart[nb];
      if (d === -1) continue;
      let open = 0, total = 0;
      for (const nn of graph.adj[nb]) { total++; if (dungeon.tags[nn] !== BLOCKED) open++; }
      // openness dominates; distance only separates equally open directions
      const score = (total ? open / total : 0) * 100 - d;
      if (score > bestScore) { bestScore = score; face = nb; }
    }
    if (face !== null) {
      const fdir = tangentDirTo(ci, face);
      tmpObj.position.copy(obj.position);
      tmpObj.up.set(n[0], n[1], n[2]);
      tmpObj.lookAt(obj.position.x + fdir[0], obj.position.y + fdir[1], obj.position.z + fdir[2]);
      obj.quaternion.copy(tmpObj.quaternion); // gate axis (+Z) down the lane
    } else {
      tmpN.set(n[0], n[1], n[2]);
      obj.quaternion.setFromUnitVectors(Y_AXIS, tmpN);
    }
    return obj;
  }

  // BFS field to the nearest LIVE portal — the 'portal' directive's map.
  // Recomputed when portals rise or fall; null when none stand.
  function recomputePortalDist() {
    const seeds = spawnPoints.filter((sp) => sp.alive).map((sp) => sp.ci);
    portalDist = seeds.length
      ? bfsDist(graph.adj, seeds, (i) => dungeon.tags[i] !== BLOCKED)
      : null;
  }

  // sector-breach flash: a white full-screen pulse when the world opens
  const flashEl = document.createElement('div');
  flashEl.id = 'td-flash';
  root.appendChild(flashEl);

  const shopEl = document.createElement('div');
  shopEl.id = 'td-shop';
  shopEl.className = 'hidden';
  root.appendChild(shopEl);
  let shopCi = -1;
  let shopPos = null; // screen anchor, remembered across refreshes
  function closeShop() {
    root.classList.remove('shopping');
    shopEl.classList.add('hidden');
    shopCi = -1;
    shopPos = null;
    if (rangeRingTtl === 0) hideRangeRing();
  }
  function flashShopNote(text) {
    const note = shopEl.querySelector('.shop-note');
    if (note) note.textContent = text;
  }
  // RADIAL menu, HokorobiTawaa-style: options ring the tapped cell.
  // R follows HK's sizing (max(66, min(104, 0.3·viewport-min))); the
  // anchor clamps so the ring never leaves the screen.
  function openShop(ci, sx, sy) {
    // NOTHING IS BUILT ON A RESCUE. The budget is the shells and the mines
    // you were given; a tower would answer the mission's only question for
    // you and it would answer it by waiting.
    if (missionOn) return;
    root.classList.add('shopping');
    // The strike owns the board while it is armed, flying, or just landed.
    // The tap DISPATCH already tries to route around the shop, but a modal
    // that must never appear mid-ritual is guarded at its own door — every
    // future tap path inherits the rule instead of re-implementing it.
    if (strike.armed || strike.falling > 0 || shopMute > 0) return;
    // An unbuildable cell gets NOTHING, not a radial of greyed-out towers
    // with "blocked" in the middle. A modal whose every option is disabled
    // is a wall of no; silence reads as "not here" faster than any label.
    // (An existing tower still opens — that is upgrade/sell, not placement.)
    if (!towerByCell.get(ci) && placeError(ci)) { closeShop(); return; }
    shopCi = ci;
    if (sx == null && shopPos) [sx, sy] = shopPos;
    // measure the CONTAINER, not the canvas: hooks can open the shop
    // before the first resize(), when the canvas still has default size
    const rect = container.getBoundingClientRect();
    const R = Math.max(66, Math.min(104, Math.min(rect.width, rect.height) * 0.3));
    const cx = Math.min(Math.max(sx ?? rect.width / 2, R + 44), rect.width - R - 44);
    const cy = Math.min(Math.max(sy ?? rect.height / 2, R + 44), rect.height - R - 44);
    shopPos = [cx, cy];
    shopEl.style.left = cx + 'px';
    shopEl.style.top = cy + 'px';
    const existing = towerByCell.get(ci);
    const pending = orderByCell.get(ci);
    let center, items;
    if (pending) {
      // an ORDERED cell offers one thing: call it off. Nothing is printed
      // yet, so the biomass comes back whole — unless Isao is already
      // standing over it, and then half of it is in the nozzle.
      const live = orders[0] === pending && isao && isao.state === 'build';
      const back = live ? Math.round(pending.cost * 0.5) : pending.cost;
      const what = pending.kind === 'upgrade' ? `${pending.tower.def.label} +1` : TOWER_BY_KEY[pending.key].label;
      center = `<div class="radial-center">${what}<br>${live ? 'printing' : 'ordered'}</div>`;
      items = [
        { cls: 'shop-sell', txt: `cancel<br>+${back}kg`, cancel: true },
        { cls: 'shop-close', txt: '×' },
      ];
    } else if (existing) {
      const cost = upgradeCost(existing.def, existing.tier);
      center = `<div class="radial-center">${existing.def.label}<br>tier ${existing.tier}</div>`;
      items = [
        cost !== null
          ? { cls: 'shop-up', txt: `upgrade<br>${cost}kg`, dis: !eco.canAfford(cost) }
          : { cls: 'shop-up', txt: 'MAX', dis: true },
        { cls: 'shop-sell', txt: `sell<br>+${sellRefund(existing.spent)}kg` },
        { cls: 'shop-close', txt: '×' },
      ];
      showRangeRing(ci, effectiveStats(existing.def, existing.tier).range, existing.def.color, 0);
    } else {
      const err = placeError(ci);
      center = `<div class="radial-center">${err ? 'blocked' : eco.biomass + 'kg'}</div>`;
      const unlocked = new Set(unlockedTowerKeys(wave, hackedUnlocks));
      items = TOWERS.map((def) => {
        const locked = !unlocked.has(def.key);
        return {
          cls: locked ? 'shop-buy locked' : 'shop-buy',
          key: def.key,
          txt: locked
            ? `${def.label}<br>${towerUnlockWave(def.key) === null ? '&#8961; RELAY' : 'W' + towerUnlockWave(def.key)}`
            : `${def.label}<br>${def.cost}kg`,
          dis: locked || !!err || !eco.canAfford(def.cost),
          bc: '#' + def.color.toString(16).padStart(6, '0'),
        };
      });
      // POST THE A6 FORWARD (operator: "the player Orders placement of the
      // Heptapod... player says once: you move there, and it allows a
      // forward position to be built"). Its berth is where it patrols and
      // where it walks home to reload, and until the player says otherwise
      // that is the cell it was printed on — so it wanders near the wall it
      // came from. This is the one order it takes: a cell to hold instead.
      //
      // It costs nothing and it is not a build: nothing is printed, nothing
      // is queued, the machine simply walks. That is why it sits on an
      // EMPTY cell's menu rather than in the tower list, and why it appears
      // only when there is an A6 to send.
      const walker = towers.find((tw) => tw.a6);
      if (walker && !err) {
        items.unshift({ cls: 'shop-move', txt: `${TOWER_BY_KEY.heptapod.label}<br>post here` });
      }
      items.push({ cls: 'shop-close', txt: '×' });
    }
    const n = items.length;
    shopEl.innerHTML = center + items.map((it, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = (R * Math.cos(a)).toFixed(0);
      const y = (R * Math.sin(a)).toFixed(0);
      return `<button class="radial-item ${it.cls}"` +
        `${it.key ? ` data-key="${it.key}"` : ''}${it.cancel ? ' data-cancel="1"' : ''}` +
        `${it.dis ? ' disabled' : ''} ` +
        `style="left:${x}px;top:${y}px;${it.bc ? `border-color:${it.bc}aa;` : ''}">` +
        `${it.txt}</button>`;
    }).join('') + `<div class="shop-note" style="top:${R + 44}px">one new tower each wave</div>`;
    shopEl.classList.remove('hidden');
  }
  shopEl.addEventListener('click', (ev) => {
    const el = ev.target;
    if (!el.classList) return;
    if (el.classList.contains('shop-close')) { closeShop(); return; }
    const tower = towerByCell.get(shopCi);
    if (el.dataset && el.dataset.cancel) {
      cancelOrder(shopCi);
      closeShop();
      return;
    }
    if (el.classList.contains('shop-buy') && shopCi !== -1) {
      if (el.classList.contains('locked') || el.hasAttribute('disabled')) return;
      if (orderTower(el.dataset.key, shopCi)) closeShop();
    } else if (el.classList.contains('shop-up') && tower) {
      if (orderUpgrade(tower)) openShop(shopCi); // refresh
    } else if (el.classList.contains('shop-move') && shopCi !== -1) {
      postWalker(shopCi);
      closeShop();
    } else if (el.classList.contains('shop-sell') && tower) {
      sellTower(tower);
      closeShop();
    }
  });
  // range preview while hovering a buy button
  shopEl.addEventListener('pointerover', (ev) => {
    const el = ev.target;
    if (el.classList && el.classList.contains('shop-buy') && shopCi !== -1) {
      const def = TOWER_BY_KEY[el.dataset.key];
      showRangeRing(shopCi, effectiveStats(def, 0).range, def.color, 0);
    }
  });

  // build-mode tap → cell (raycast the floor; a drag is an orbit, not a tap)
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  // The confirm for riding Isao. Not a modal — a modal for a camera change
  // is a bigger deal than a camera change. A toast with a live button, and
  // it times out and goes away like every other toast if you meant to tap
  // the ground behind him.
  function askDroneView() {
    showToast('<div class="wave-num">TAKE THE DRONE?</div>'
      + '<div class="wave-role">ride ISAO — he keeps working, you just watch</div>'
      + '<button class="toast-yes">&rsaquo; TAKE CONTROL</button>', 4000);
  }
  function cellAtScreen(x, y) {
    if (!floorMesh) return -1;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([wallMesh, floorMesh], false);
    if (!hits.length) return -1;
    const p = hits[0].point;
    return cellIndex([p.x, p.y, p.z]);
  }

  // THE PROGRAMME IS SPENT. Not a modal — it is an event on the board, not a
  // decision to make, and pausing for it would break a run that is going
  // well. What changes is that nothing more is coming: the gates standing
  // are the last of it.
  function programmeSpent() {
    sfx.play('boss_tension');
    showToast(`<div class="wave-num">THE WAVES ARE SPENT &middot; SECTOR ${round}</div>`
      + `<div class="wave-role">${params.wavesPerSector} sent, ${params.wavesPerSector} held. `
      + `nothing more is coming &mdash; close the gates and the sector is yours</div>`, 4200);
    updateHud();
  }

  // What this run put on the record, for the cards. Empty renders nothing —
  // a heading over no rows is worse than no heading.
  function runAchvBlock() {
    if (!runAchv.length) return '';
    return `<div class="rec rec-inline">`
      + runAchv.map((id) => {
        const a = achievement(id);
        return a ? `<div class="rec-row got"><span class="rec-mark">&#10022;</span>`
          + `<span class="rec-name">${a.name}</span>`
          + `<span class="rec-note">${a.note}</span></div>` : '';
      }).join('')
      + `</div>`;
  }

  // THE VICTORY LAP. Isao flies the sector you just cleared while you look at
  // what you built — the operator asked for it and it is the right shape: a
  // debrief that only shows numbers throws away the actual reward, which is
  // the board. The debrief is not dismissed, it is PARKED: the button comes
  // back so the sector can be advanced whenever you have had enough.
  let lapReturn = null;
  function startLap() {
    lapReturn = msgEl.innerHTML;
    msgEl.classList.add('hidden');
    paused = false;
    setView('drone');
    if (lapEl) lapEl.classList.remove('hidden');
  }
  function endLap() {
    if (lapEl) lapEl.classList.add('hidden');
    if (lapReturn === null) return;
    msgEl.innerHTML = lapReturn;
    lapReturn = null;
    msgEl.classList.remove('hidden');
    paused = true;
  }
  const lapEl = root.querySelector('#td-lap');
  if (lapEl) lapEl.addEventListener('click', endLap);

  function checkVictory() {
    if (director) return;   // a scripted run has no end but its length

    if (player.won || tutorialActive) return; // the tutorial is failure/win-proof
    // A RESCUE IS NOT WON BY KILLING THE GATES. Shutting the spawns off so
    // you can ferry at leisure is a legitimate plan and a rather good one —
    // but the people are still down there, and the mission ends when they are
    // accounted for and at no other moment.
    if (missionOn) return;
    if (spawnPoints.length > 0 && spawnPoints.every((s) => !s.alive) && enemies.every((e) => !e.alive)) {
      player.won = true;
      const grant = breachGrant(eco.biomass, round, SECTORS_TOTAL);
      if (grant) eco.addBiomass(grant, { category: 'breach-grant' });
      record('sector.clear', { sector: round, wave, biomass: eco.biomass, breachGrant: grant });
      sectorsCleared = round;
      run.sectorsCleared = sectorsCleared;
      run.sectorCleared = true;
      logSector();   // the campaign remembers every round, for the final debrief
      checkAchievements();
      // THE ENDING IS NOT ANOTHER LEVEL (operator). The last enemy used to
      // fall and the analysis board simply appeared — the single most
      // consequential moment in the game had no moment. So: a red shout while
      // the body is still coming apart, then the camera LEAVES, pulling back
      // off the hull until the whole planet is a marble against the galaxy,
      // and only then the debrief. The pull-out is the beat that says the
      // scale of the thing you just finished; a cut to a modal cannot.
      const finalPlanet = round >= SECTORS_TOTAL;
      showCallout(finalPlanet ? 'PLANET CLEARED' : 'LAST ENEMY VANQUISHED', 'co-victory');
      setTimeout(() => showCallout(finalPlanet
        ? 'THE SHELL IS OURS' : 'SECTOR SECURE', 'co-victory-sub'), 700);
      sfx.play('tank_pickup', { dist: 0 });
      if (round >= SECTORS_TOTAL) {
        run.planetCleared = true;
        checkAchievements();
        // THE PLANET. Every portal dead with the whole shell open — there is
        // no sector left to breach, which is the only reading of "the entire
        // map free" this world actually supports.
        try {
          const p2 = (parseInt(localStorage.getItem('td.planets') || '0', 10) || 0) + 1;
          localStorage.setItem('td.planets', String(p2));
          setCoins(coins() + 1);   // a planet is worth one coin
        } catch (e) { /* private mode */ }
        persistBest();
        victoryPullOut(true);
        return;
      }
      victoryPullOut(false);
      return;
    }
  }

  // --- THE PULL-OUT ---------------------------------------------------------
  //
  // The camera leaves. It starts wherever the player was watching from —
  // third person, orbit, whatever — and climbs away from the hull until the
  // planet is a marble against the galaxy the sky is already made of, holds
  // there a beat, and hands over to the debrief.
  //
  // It rides camShot rather than owning a clock, for the reason written on
  // that function: every timed camera takeover that owned its own teardown
  // eventually got one wrong, and one of them ate every key in the game
  // permanently. One shot at a time, one teardown, and the latch is the shot
  // itself.
  //
  // SKIPPABLE, like every other shot here. A player who has seen it four
  // times should not be held, and the skip path already exists and is tested.
  const VICTORY_PULL = 4.2;        // seconds of camera
  const VICTORY_HOLD = 0.9;        // ...of which the last of it is a held wide
  function victoryPullOut(final) {
    // where the camera IS, so the move starts from the player's own view
    // rather than snapping to a canonical one first — a cut before a pull-out
    // throws away the only thing that makes it read as leaving
    const from = camera.position.clone();
    const fromR = Math.max(1.05, from.length());
    const dir0 = from.clone().normalize();
    // ...and where it goes: further out than the reveal shot's 3.3, because
    // this is the whole planet with room around it and not a band being shown
    const OUT_R = 5.2;
    const ref = Math.abs(dir0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(dir0, ref).normalize();
    // THE INSTRUMENTS GO. A wide shot of a planet with a score, a throttle and
    // a radar over it is a level with the camera pulled back; the same shot
    // with the glass cleared is an ending. This is most of what "markedly
    // different" costs.
    document.body.classList.add('td-victory');
    startShot({
      id: 'victory',
      dur: VICTORY_PULL,
      poseAt: (u, out) => {
        // FAST THEN SETTLING. A linear pull reads as a lift being operated;
        // the ease-out is what makes it read as being pulled away from
        // something. The last stretch is a hold, so the wide shot is a beat
        // the eye can rest on rather than the instant before a modal.
        const t = Math.min(1, u / (1 - VICTORY_HOLD / VICTORY_PULL));
        const e = 1 - Math.pow(1 - t, 3);
        const r = fromR + (OUT_R - fromR) * e;
        // a slow drift around the pole as it goes, so the planet turns under
        // the camera and reads as a body rather than a texture
        const spin = e * 0.42;
        const axis = new THREE.Vector3(0, 1, 0);
        const d = dir0.clone().applyAxisAngle(axis, spin).multiplyScalar(r);
        out.pos.copy(d);
        tmpCam.position.copy(out.pos);
        tmpCam.up.copy(up);
        tmpCam.lookAt(0, 0, 0);
        out.quat.copy(tmpCam.quaternion);
      },
      onEnd: () => {
        // STAY WIDE. When the shot released the camera it snapped straight
        // back to the hull — measured, 5.20 to 1.23 in one frame — and the
        // debrief then opened over a close-up of a tank standing in an empty
        // sector, which is the opposite of what the pull-out just said. Orbit
        // is the view that keeps the planet in shot, and it is what the
        // reveal shot hands back to for the same reason.
        setView('orbit');
        document.body.classList.remove('td-victory');
        renderAnalysis(final);
      },
    });
  }

  // --- THE DEBRIEF, IN TWO STAGES (operator, 2026-09-02) -----------------
  // "as if we were a military analyst studying the situations. only then do
  // we have the option to walk the planet, start another planet, etc."
  //
  // Stage one is the analyst's board: six small windows — the roster of what
  // was killed, who did the killing, the score's tempo, the records (the
  // single best shell, the single best strike), a REPLAY of that strike on
  // the tangent plane, and the state of the defence. One button: proceed.
  // Stage two is the verdict and the orders, unchanged from before.
  let replayRaf = 0;
  function killedTypes() {
    return Object.entries((rs && rs.kills) || {}).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]);
  }
  function tintHex(type) {
    return '#' + (CREATURE_TINTS[type] ?? 0xffffff).toString(16).padStart(6, '0');
  }
  function winRoster() {
    const rows = killedTypes().map(([type, k]) =>
      `<div class="dbf-row"><img class="dbf-icon" src="${spriteShot(type, () => makeDotEnemy(type,
        { walker: CREATURE_TINTS[type], walkerHi: accentFor(type) }))}" alt="">`
      + `<span class="dbf-name" style="color:${tintHex(type)}">${type}</span>`
      + `<span class="dbf-tag">${ENEMY_SPEC[type] && ENEMY_SPEC[type].rammable ? 'soft' : 'SOLID'}</span>`
      + `<b class="dbf-n">${k}</b></div>`).join('');
    const total = killedTypes().reduce((a, [, k]) => a + k, 0);
    return `<div class="dbf-win"><div class="dbf-head">ROSTER · ${total} CONFIRMED</div>`
      + (rows || '<div class="dbf-dim">no contacts destroyed</div>') + '</div>';
  }
  function winAttribution() {
    const by = (rs && rs.bySrc) || { tank: 0, tower: 0, strike: 0 };
    const top = Math.max(1, by.tank, by.tower, by.strike);
    const bar = (label, v, col) => `<div class="dbf-row"><span class="dbf-name">${label}</span>`
      + `<span class="dbf-track"><span class="dbf-bar" style="width:${Math.round(100 * v / top)}%;background:${col}"></span></span>`
      + `<b class="dbf-n">${v}</b></div>`;
    return `<div class="dbf-win"><div class="dbf-head">ATTRIBUTION</div>`
      + bar('tank', by.tank, '#9fdcff') + bar('towers', by.tower, '#86ff9e')
      + bar('orbital', by.strike, '#ffb347')
      + `<div class="dbf-dim">${(rs && rs.rams) || 0} rammed · ${(rs && rs.shells) || 0} shells landed · ${(rs && rs.strikes) || 0} strikes</div></div>`;
  }
  function winTempo() {
    // score every 5s, cumulative — the graph shows the RATE (deltas), which
    // is where a wave shows up as a spike and a lull as a floor
    const bins = (rs && rs.scoreBins) || [];
    const d = bins.map((v, i) => Math.max(0, v - (i ? bins[i - 1] : 0)));
    const W = 240, H = 64, top = Math.max(1, ...d, 1);
    const pts = d.map((v, i) => `${(i / Math.max(1, d.length - 1) * W).toFixed(1)},${(H - v / top * (H - 6)).toFixed(1)}`);
    const path = pts.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#86ff9e" stroke-width="1.5"/>` : '';
    const fill = pts.length > 1 ? `<polygon points="0,${H} ${pts.join(' ')} ${W},${H}" fill="rgba(134,255,158,0.12)"/>` : '';
    return `<div class="dbf-win"><div class="dbf-head">SCORE TEMPO · per 5s</div>`
      + `<svg class="dbf-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${fill}${path}</svg>`
      + `<div class="dbf-dim">peak ${fmt(top)} / 5s · total ${fmt(score.points)}</div></div>`;
  }
  function winRecords() {
    const bs = (rs && rs.bestShell) || { kills: 0 }, bk = (rs && rs.bestStrike) || { kills: 0 };
    const tile = (n, label) => `<div class="dbf-tile dbf-record${n > 1000 ? ' dbf-record--rainbow' : ''}"><b>${n}</b><span>${label}</span></div>`;
    return `<div class="dbf-win"><div class="dbf-head">RECORDS</div><div class="dbf-tiles">`
      + tile(bs.kills, `most by one shell${bs.wave ? ` · w${bs.wave}` : ''}`)
      + tile(bk.kills, `most by one strike${bk.wave ? ` · w${bk.wave}` : ''}`)
      + tile(run.bestStreak || 0, 'longest streak')
      + tile((rs && rs.maxCombo) || 0, 'best ram combo')
      + `</div></div>`;
  }
  function winDefence() {
    const tile = (n, label) => `<div class="dbf-tile"><b>${n}</b><span>${label}</span></div>`;
    return `<div class="dbf-win"><div class="dbf-head">DEFENCE</div><div class="dbf-tiles">`
      + tile(`${Math.max(0, heartHP)}/${HEART_MAX}`, 'heart')
      + tile(run.heartHits || 0, 'heart hits taken')
      + tile(run.hullsLost || 0, 'hulls lost')
      + tile(towers.length, 'towers standing')
      + tile(`${eco.biomass}kg`, 'biomass in hand')
      + tile(tankRank > 0 ? rankLabel(tankRank) : '—', 'pilot rank')
      + `</div></div>`;
  }
  function winReplay() {
    const bk = rs && rs.bestStrike;
    if (!bk || !bk.replay) {
      return `<div class="dbf-win"><div class="dbf-head">BEST ORBITAL STRIKE</div>`
        + `<div class="dbf-dim">no strike fired</div></div>`;
    }
    return `<div class="dbf-win"><div class="dbf-head">BEST ORBITAL STRIKE · wave ${bk.wave} · ${bk.kills} killed`
      + `${bk.replay.portals ? ` · ${bk.replay.portals} gate${bk.replay.portals > 1 ? 's' : ''}` : ''}</div>`
      + `<canvas class="dbf-replay" width="240" height="120"></canvas></div>`;
  }
  // The replay: bodies on the tangent plane at impact; the blast ring
  // expands over 1.2s and every body it passes that DIED flares and goes
  // out; the survivors stay. Loops. Stops itself when the canvas leaves the
  // document, so a dismissed modal does not keep a rAF alive.
  function startReplay() {
    cancelAnimationFrame(replayRaf);
    const cv = msgEl.querySelector('.dbf-replay');
    const bk = rs && rs.bestStrike;
    if (!cv || !bk || !bk.replay) return;
    const ctx = cv.getContext('2d');
    const R = bk.replay.radius, view = R * 1.9;
    const W = cv.width, H = cv.height, sc = Math.min(W, H) / (2 * view);
    const t0 = performance.now();
    const LOOP = 3200, EXPAND = 1200;
    const frame = () => {
      if (!cv.isConnected) return;
      const t = (performance.now() - t0) % LOOP;
      const ring = Math.min(1, t / EXPAND) * R;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#020a10'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, H / 2);
      // range rings, one per cell
      ctx.strokeStyle = 'rgba(0,208,255,0.12)'; ctx.lineWidth = 1;
      for (let r = 1; r <= view; r++) { ctx.beginPath(); ctx.arc(0, 0, r * sc, 0, 6.283); ctx.stroke(); }
      // the blast radius, faint, always
      ctx.strokeStyle = 'rgba(255,179,71,0.35)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(0, 0, R * sc, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      for (const b of bk.replay.bodies) {
        const d = Math.hypot(b.x, b.y);
        const passed = d <= ring;
        const gone = b.died && passed && t > EXPAND * (d / R) + 260;
        if (gone) continue;
        const flare = b.died && passed;
        ctx.fillStyle = flare ? '#fff2c0' : tintHex(b.type);
        ctx.globalAlpha = flare ? 1 : 0.9;
        ctx.beginPath(); ctx.arc(b.x * sc, -b.y * sc, flare ? 4 : 2.6, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // the ring itself
      if (t < EXPAND + 300) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.globalAlpha = Math.max(0, 1 - (t - EXPAND) / 300);
        ctx.beginPath(); ctx.arc(0, 0, ring * sc, 0, 6.283); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // ground zero
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 6.283); ctx.fill();
      ctx.restore();
      replayRaf = requestAnimationFrame(frame);
    };
    frame();
  }
  function renderAnalysis(final) {
    msgEl.innerHTML = `<div class="msg-head">transmission · ${final ? 'final' : 'sector cleared'} · analysis</div>`
      + `<div class="go-verdict dbf-title">${final ? 'STÅLHEART' : `SECTOR ${round} OF ${SECTORS_TOTAL}`} · AFTER-ACTION</div>`
      + `<div class="dbf-grid">${winRoster()}${winAttribution()}${winTempo()}${winRecords()}${winReplay()}${winDefence()}</div>`
      + `<button class="msg-proceed" data-final="${final ? 1 : 0}">&#9656; proceed to orders</button>`;
    msgEl.classList.remove('hidden');
    startReplay();
  }
  // --- THE CAMPAIGN LOG (operator, 2026-09-02) ----------------------------
  // "before the choice for Another Planet, we need a full debrief, even
  // deeper, for all rounds. make it feel meaningful, then a clear decision."
  //
  // A snapshot per cleared sector, taken at the moment of clearing so the
  // numbers are the sector's own and not the run's so far: what it sent,
  // how long it took, what died and to whom, what the purse did, what it
  // cost the heart and the hulls. Deltas against the previous snapshot.
  const campaign = [];
  let campPrev = null;
  function logSector() {
    const kills = Object.values((rs && rs.kills) || {}).reduce((a, b) => a + b, 0);
    const by = (rs && rs.bySrc) || { tank: 0, tower: 0, strike: 0 };
    const now = { kills, tank: by.tank, tower: by.tower, strike: by.strike,
      earned: eco.earned, spent: eco.spent, hullsLost: run.hullsLost || 0,
      heartHits: run.heartHits || 0, t: runContext.time, wave };
    const prev = campPrev || { kills: 0, tank: 0, tower: 0, strike: 0, earned: 0, spent: 0,
      hullsLost: 0, heartHits: 0, t: 0, wave: 0 };
    campaign.push({
      round, waves: now.wave - prev.wave, secs: Math.max(0, Math.round(now.t - prev.t)),
      kills: now.kills - prev.kills, tank: now.tank - prev.tank, tower: now.tower - prev.tower,
      strike: now.strike - prev.strike, earned: now.earned - prev.earned, spent: now.spent - prev.spent,
      hullsLost: now.hullsLost - prev.hullsLost, heartHits: now.heartHits - prev.heartHits,
      heart: Math.max(0, heartHP), towers: towers.length, held: eco.biomass,
      bestShell: (rs && rs.bestShell && rs.bestShell.kills) || 0,
      bestStrike: (rs && rs.bestStrike && rs.bestStrike.kills) || 0,
      full: programmeDone(),
    });
    campPrev = now;
  }
  function campaignReset() { campaign.length = 0; campPrev = null; }

  // THE COIN. Retro, by request: winning a planet mints one; CONTINUE? spends
  // it. Persists, so a player who walks away with a coin still has it.
  const COIN_KEY = 'td.coins';
  function coins() { try { return parseInt(localStorage.getItem(COIN_KEY) || '0', 10) || 0; } catch { return 0; } }
  function setCoins(n) { try { localStorage.setItem(COIN_KEY, String(Math.max(0, n))); } catch { /* private mode */ } }

  function campaignScreen() {
    const rows = campaign.map((c) => `<tr>`
      + `<td>${c.round}</td><td>${c.waves}${c.full ? '' : '*'}</td><td>${Math.floor(c.secs / 60)}:${String(c.secs % 60).padStart(2, '0')}</td>`
      + `<td><b>${c.kills}</b></td><td>${c.tank}/${c.tower}/${c.strike}</td>`
      + `<td>${fmt(c.earned)} &rarr; ${fmt(c.spent)}</td><td>${c.heart}/${HEART_MAX}</td>`
      + `<td>${c.hullsLost}</td><td>${c.towers}</td></tr>`).join('');
    const T = campaign.reduce((a, c) => ({ waves: a.waves + c.waves, secs: a.secs + c.secs, kills: a.kills + c.kills,
      tank: a.tank + c.tank, tower: a.tower + c.tower, strike: a.strike + c.strike, earned: a.earned + c.earned,
      spent: a.spent + c.spent, hulls: a.hulls + c.hullsLost }),
    { waves: 0, secs: 0, kills: 0, tank: 0, tower: 0, strike: 0, earned: 0, spent: 0, hulls: 0 });
    const cut = campaign.some((c) => !c.full);
    return `<div class="camp-wrap"><table class="camp-table">`
      + `<thead><tr><th>sector</th><th>waves</th><th>time</th><th>kills</th><th>tank/twr/orb</th>`
      + `<th>biomass in &rarr; out</th><th>heart</th><th>hulls lost</th><th>towers</th></tr></thead>`
      + `<tbody>${rows}</tbody>`
      + `<tfoot><tr><td>planet</td><td>${T.waves}</td><td>${Math.floor(T.secs / 60)}:${String(T.secs % 60).padStart(2, '0')}</td>`
      + `<td><b>${T.kills}</b></td><td>${T.tank}/${T.tower}/${T.strike}</td><td>${fmt(T.earned)} &rarr; ${fmt(T.spent)}</td>`
      + `<td>${Math.max(0, heartHP)}/${HEART_MAX}</td><td>${T.hulls}</td><td>${towers.length}</td></tr></tfoot>`
      + `</table>${cut ? '<div class="dbf-dim">* sector ended early — the gates fell before the programme ran out</div>' : ''}</div>`;
  }

  // --- THE SINKS (operator, 2026-09-02) -----------------------------------
  // "still too generous with the credits. we can play around that by saying
  // that x amount of biomass is needed to proceed to the next stage, or make
  // some items really expensive. like an extra tank or orbital strike."
  //
  // Both, on the one screen where the run pauses to spend: breaching the
  // next sector COSTS biomass (the toll climbs per sector), and two things
  // that used to arrive free are for sale at prices that hurt — a spare
  // hull and a strike missile. The sim's ledger (spent / earned) is what
  // says whether these bite; they are numbers, not rulings, and live here in
  // one place so the next measurement can move them.
  const sectorToll = () => tollFor(round);
  const spendDebrief = cost => debriefAffordable(eco.biomass, cost, round) && eco.spend(cost);
  function breachNextSector() {
    if (!eco.spend(sectorToll())) return false;
    round++; hackedRound = false; syncHackBtn();
    sectorStartWave = wave; strike.reserved += 1;
    expandRound(); syncArmUi();
    record('sector.begin', { sector: round, wave, biomass: eco.biomass });
    return true;
  }
  function ordersBlock() {
    const toll = sectorToll();
    const can = (c, cls) => debriefAffordable(eco.biomass, c, round, cls === 'msg-next');
    const btn = (cls, label, cost) =>
      `<button class="${cls}"${can(cost, cls) ? '' : ' disabled'}>${label} &mdash; ${cost}kg`
      + `${can(cost, cls) ? '' : ' (short)'}</button>`;
    return `<div class="go-grid"><span>biomass in hand <b>${eco.biomass}kg</b></span><span>reserved for breach <b>${toll}kg</b></span><span>available for supplies <b>${Math.max(0, eco.biomass - toll)}kg</b></span></div>`
      + (playerHP < PLAYER_MAX ? btn('msg-buyhull', '&#9881; print a spare hull', SINK.hull)
        : `<button disabled>&#9881; hulls full ${playerHP}/${PLAYER_MAX}</button>`)
      + btn('msg-buystrike', '&#10022; resupply one orbital strike', SINK.strike)
      + (mineField.count >= mineTune.cap
        ? `<button disabled>&#8982; mine rack full ${mineField.count}/${mineTune.cap}</button>`
        : btn('msg-buymines', `&#8982; a case of ${mineTune.caseSize} mines &mdash; rack ${mineField.count}/${mineTune.cap}`, SINK.mines))
      + (shield.rack >= shieldTune.rackCap
        ? `<button disabled>&#9672; shield rack full ${shield.rack}/${shieldTune.rackCap}</button>`
        : btn('msg-buyshields', `&#9672; a case of ${shieldTune.caseSize} shield charges &mdash; rack ${shield.rack}/${shieldTune.rackCap}`, SINK.shields))
      + (assistant ? `<button disabled>&#9881; second drone on shift</button>`
        : btn('msg-buydrone', '&#9881; print a second drone — assists ISAO', SINK.drone))
      + btn('msg-next', `&rsaquo; breach sector ${round + 1} — bigger, farther, meaner`, toll);
  }
  function renderVerdict(final) {
    cancelAnimationFrame(replayRaf);
    {
      if (final) {
        // THE CAMPAIGN DEBRIEF. Every round on one table, the planet's totals
        // under them, the records and the best strike beside, the
        // achievements — and then ONE decision, in the register of the
        // machines that asked it first.
        const n = coins();
        msgEl.innerHTML = `<div class="msg-head">transmission · final · campaign</div>`
          + `<div class="go-verdict best">STÅLHEART IS YOURS</div>`
          + `<div class="go-reason">every portal on the shell destroyed, all `
          + `${SECTORS_TOTAL} sectors open — there is nothing left to breach</div>`
          + `<div class="go-grid"><span>SCORE <b>${fmt(score.points)}</b> · best ${fmt(score.best)}</span></div>`
          + campaignScreen()
          + `<div class="dbf-grid">${winRecords()}${winReplay()}</div>`
          + runAchvBlock()
          + `<div class="coin">INSERT COIN : <b>${n}</b></div>`
          + `<div class="continue">CONTINUE?</div>`
          + `<button class="msg-planet"${n > 0 ? '' : ' disabled'}>&#10226; ${n > 0 ? 'YES — another planet, bigger, new ground' : 'no coin'}</button>`
          + `<button class="msg-lap">&#9673; no — walk the planet as ISAO</button>`;
        startReplay();
      } else {
        // THE DEBRIEF. Dismissed by hand, never on a timer: the operator
        // cleared a hard sector and the game moved on before they had
        // registered winning it. Nothing advances until a button is pressed.
        msgEl.innerHTML = `<div class="msg-head">transmission · sector cleared</div>`
          + `<div class="go-verdict">SECTOR ${round} OF ${SECTORS_TOTAL} IS YOURS</div>`
          + `<div class="go-reason">every gate broken &middot; `
          + `${sectorWave()} of ${params.wavesPerSector} waves fought`
          + `${programmeDone() ? ' &mdash; you held the whole programme'
            : ' &mdash; you ended it early, and left biomass in the field'}</div>`
          + `<div class="go-grid">`
          + `<span>SCORE <b>${fmt(score.points)}</b> · best ${fmt(score.best)}</span>`
          + `<span>heart <b>${Math.max(0, heartHP)}</b>/${HEART_MAX} · hulls ${Math.max(0, playerHP)}/${PLAYER_MAX}</span>`
          + `<span>${towers.length} towers standing · ${eco.biomass}kg in hand</span>`
          + `<span>rank ${tankRank > 0 ? rankLabel(tankRank) : 'unranked'} · ${tankKills} hands-on</span>`
          + `</div>`
          + runAchvBlock()
          + `<button class="msg-lap">&#9673; walk the sector &mdash; fly it as ISAO</button>`
          + ordersBlock();
      }
      msgEl.classList.remove('hidden');
    }
  }

  // sector expansion (HokorobiTawaa's fraying): FLASH WHITE, unseal the
  // next band of the SAME world, re-seed pickups into the new ground,
  // raise fresh portals farther out. Towers and biomass persist.
  function expandRound() {
    flashEl.classList.remove('on');
    void flashEl.offsetWidth; // restart the animation
    flashEl.classList.add('on');
    const beforeTags = dungeon.tags.slice();
    applySector();
    // the freshly-opened band: sealed before, floor now
    revealCells = [];
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (beforeTags[i] === BLOCKED && dungeon.tags[i] !== BLOCKED) {
        revealCells.push(i);
        const c = graph.centers[i];
        cx += c[0]; cy += c[1]; cz += c[2];
      }
    }
    revealDir = revealCells.length ? norm3([cx, cy, cz]) : norm3(graph.normals[dungeon.heart]);
    startShot({
      id: 'reveal',
      dur: REVEAL_LEN,
      poseAt: (u, out) => {
        // whole planet in frame, the new band centred — framing unchanged
        const ref = Math.abs(revealDir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        const up = norm3(cross3(revealDir, ref));
        const eye = scale3(revealDir, 3.3);
        out.pos.set(eye[0], eye[1], eye[2]);
        tmpCam.position.copy(out.pos);
        tmpCam.up.set(up[0], up[1], up[2]);
        tmpCam.lookAt(0, 0, 0);
        out.quat.copy(tmpCam.quaternion);
      },
      onEnd: () => {
        // the new ground cools back to its true colors; planning begins
        for (const ci of revealCells) paintCell(ci, floorColorOf(ci));
        revealCells = [];
        if (!buildMode) setView('orbit');
        updateHud();
      },
    });
    buildGeometry();
    syncServerLift();
    // THE SAFETY NET. Breach persistence keeps corridors open, but a tank
    // parked on a later-band lane it reached THROUGH a breach can still
    // have the band gate reseal the ground under it — walls closing over
    // the hull (operator bug report). If the shift entombed the tank,
    // redeploy it beside the heart and say so.
    if (player.cur >= 0 && dungeon.tags[player.cur] === BLOCKED && !playerDown) {
      deployStart(berthIndexFor(playerHP));
      showToast(`<div class="wave-num">REDEPLOYED</div>`
        + `<div class="wave-role">the frontier shifted over your position</div>`, 3000);
    }
    // burn the new ground hot — repainted to its true colors when the
    // beat ends (see animate)
    for (const ci of revealCells) paintCell(ci, [1.0, 0.68, 0.16]);
    spawnOrbs();
    spawnRewards();
    seedPortals(2); // fresh neutral gates in the new band
    // the new sector's budget arrives with its gates; unspent strikes carry —
    // hoarding one for the next sector is a legitimate play
    if (!missionOn) grantStrikes(strike, spawnPoints.filter((sp2) => sp2.alive).length, strikeTune);
    recomputePortalDist();
    waveActive = false; interClock = 0;
    player.won = false;
    paused = false;
    msgEl.classList.add('hidden');
    waveEl.style.borderColor = '#ffffff';
    waveEl.style.color = '#ffffff';
    waveEl.innerHTML = `<div class="wave-num">SECTOR ${round}</div>` +
      `<div class="wave-name">THE WORLD GROWS</div>` +
      `<div class="wave-role">new ground · new portals · your towers hold</div>`;
    waveEl.classList.remove('hidden');
    clearTimeout(waveTimer);
    waveTimer = setTimeout(() => waveEl.classList.add('hidden'), 3200);
    updateHud();
  }

  // --- dashboard -----------------------------------------------------------
  const gui = new GUI({ title: 'TD', container: root });
  // hero + portal styling swap IN PLACE — cosmetics never reset a run
  gui.add(params, 'creature', UNIT_NAMES).onChange(() => {
    applyCreature();
  });
  gui.add(params, 'look', LOOK_NAMES).onChange(applyLook);
  gui.add(params, 'wallTops', ['auto', 'bright', 'dim', 'black'])
    .name('wall tops').onChange(applyLook);
  const viewCtrl = gui.add(params, 'view', ['pov', 'third', 'orbit', 'drone'])
    .name('camera (V)').onChange((v) => setView(v));
  const speedCtrl = gui.add(params, 'speed', 0.2, 4, 0.1).name('wander speed');
  const directiveCtrl = gui.add(params, 'directive', DIRECTIVES).name('auto directive').onChange(syncDirectiveChip);
  gui.add(params, 'recoil', 0, 8, 0.1).name('shell recoil');
  gui.add(params, 'callouts').name('callout messages').onChange(syncCalloutMode);
  // Changing the physical footprint needs a new camp and spawn layout.
  gui.add(params, 'heartLook', Object.keys(HEART_LOOKS)).name('stalheart (new run)')
    .onFinishChange(regenerate);
  gui.add(params, 'waveSize', 1, 6, 1).name('wave size').onFinishChange(regenerate);
  gui.add(params, 'wavesPerSector', 5, 40, 1).name('waves per sector');
  gui.add(params, 'waveGap', 3, 20, 1).name('wave gap (s)');
  gui.add(params, 'waveCap', 15, 60, 1).name('wave cap (s)');
  gui.add(params, 'obstacles', 0.05, 0.4, 0.05).onFinishChange(regenerate);
  gui.add(params, 'rewards', 0, 12, 1).onFinishChange(regenerate);
  gui.add(params, 'orbs', 0, 40, 1).name('missile triads').onFinishChange(regenerate);
  gui.add(params, 'orbRespawn', 0, 30, 1).name('triad respawn (s)');
  const seedCtrl = gui.add(params, 'seed', 0, 99999, 1).onFinishChange(regenerate);
  const pointsCtrl = gui.add(params, 'points', 150, 8000, 50).name('sample points').onFinishChange(regenerate);
  gui.add(params, 'rooms', 2, 24, 1).onFinishChange(regenerate);
  gui.add(params, 'roomRadius', 1, 8, 1).name('room radius').onFinishChange(regenerate);
  gui.add(params, 'corridorWidth', 1, 4, 1).name('corridor width').onFinishChange(regenerate);
  gui.add(params, 'extraCorridors', 0, 5, 1).name('extra corridors').onFinishChange(regenerate);
  gui.add(params, 'wallHeight', 0.02, 0.15, 0.005).name('wall height').onFinishChange(regenerate);
  gui.add(params, 'relaxIters', 0, 200, 10).name('relax iters').onFinishChange(regenerate);
  gui.add(params, 'randomize').name('↻ random seed');
  gui.add(params, 'regenerate').name('↻ regenerate');
  gui.add(params, 'previewDestruction').name('✳ destroy tank (preview)');

  const towerLookCtrl = gui.add(params, 'towerLook', TOWER_LOOK_NAMES)
    .name('tower look').onChange(applyTowerLook);
  gui.add(params, 'font', FONT_NAMES).name('message font').onChange((n) => {
    applyFontPack(n, document.documentElement, TYPE);
    try { localStorage.setItem('ssg-font', n); } catch (e) { /* private mode */ }
  });
  // The type KNOBS live on the units tab's fonts bench, not here. Two GUIs
  // over two copies of the same values is the drift this repo has already
  // paid for once (the hover params vs the viewer's defaults), and the
  // operator's actual complaint was that tuning type mid-game is
  // impossible — a shout lives 1.2 seconds. This tab keeps the face
  // switch, which is a glance, and hands the sliders to the bench.
  // Guessed wrong twice by eye, so they are dialled by hand — but the folder
  // is GENERATED from the shared schema and writes to the shared object. The
  // unit viewer's tuning modal is built from the same list over the same
  // values, so a setting found on the bench is already in force here.
  loadFeel();   // whatever was dialled in the viewer is already in force
  const feelFolders = new Map();
  for (const k of TANK_FEEL_KNOBS) {
    if (!feelFolders.has(k.group)) {
      const f = gui.addFolder(k.group);
      f.close();
      feelFolders.set(k.group, f);
    }
    feelFolders.get(k.group).add(FEEL, k.key, k.min, k.max, k.step)
      .name(k.label).onFinishChange(saveFeel);
  }

  // strike knobs share the schema machinery with the feel folders
  const strikeF = gui.addFolder('orbital strike');
  for (const k of STRIKE_KNOBS) {
    if (k.bool) strikeF.add(strikeTune, k.key).name(k.label);
    else strikeF.add(strikeTune, k.key, k.min, k.max, k.step).name(k.label);
  }
  strikeF.close();

  // THE PLUME, by eye. Colour and reach are the rank's and are not touchable
  // here; the SHAPE of the flame is taste, and taste is judged with the
  // controls in hand rather than reasoned from a number.
  const plasmaF = gui.addFolder('plasma');
  plasmaF.add(PLASMA, 'coreFrac', 0, 1, 0.01).name('hot root length');
  plasmaF.add(PLASMA, 'dots').name('dots on');
  plasmaF.add(PLASMA, 'plumeLen', 0, 1, 0.01).name('dots length (x beam)');
  plasmaF.add(PLASMA, 'plumeWidth', 0, 5, 0.05).name('dots width (x beam)');
  plasmaF.add(PLASMA, 'coreRoot', 0.05, 1, 0.01).name('width at muzzle');
  plasmaF.add(PLASMA, 'squash', 0, 1.5, 0.05).name('vertical squash');
  plasmaF.add(PLASMA, 'flow', 0, 6, 0.05).name('flow speed');
  plasmaF.add(PLASMA, 'bias', 0.5, 3, 0.05).name('root density');
  plasmaF.add(PLASMA, 'twist', 0, 24, 0.5).name('corkscrew');
  plasmaF.add(PLASMA, 'size', 1, 8, 0.1).name('dot size').onChange((v) => {
    if (plasma) for (const pl of plasma) pl.pts.material.size = v;
  });
  plasmaF.close();
  gui.add(params, 'autoUpgrade').name('drones auto-upgrade');

  const bloomF = gui.addFolder('bloom');
  bloomF.add(postfx.params, 'enabled').name('enabled').onChange((v) => postfx.setEnabled(v));
  bloomF.add(postfx.params, 'strength', 0, 3, 0.05).onChange((v) => postfx.setParams({ strength: v }));
  bloomF.add(postfx.params, 'radius', 0, 1, 0.01).onChange((v) => postfx.setParams({ radius: v }));
  bloomF.add(postfx.params, 'threshold', 0, 1, 0.01).onChange((v) => postfx.setParams({ threshold: v }));

  // per-group glow. These are AMOUNTS, not brightness: the map can stay a
  // bright cyan wireframe while barely blooming at all.
  const weightsF = bloomF.addFolder('weights');
  for (const g of BLOOM_GROUPS) {
    weightsF.add(postfx.weights, g, 0, 3, 0.05).name(g);
  }
  // a tuning session must survive a reload
  const BW_KEY = 'ssg.td.bloomWeights';
  try {
    const savedW = JSON.parse(localStorage.getItem(BW_KEY) || 'null');
    if (savedW && typeof savedW === 'object') {
      for (const g of BLOOM_GROUPS) {
        if (typeof savedW[g] === 'number') postfx.weights[g] = savedW[g];
      }
      weightsF.controllers.forEach((c) => c.updateDisplay());
    }
  } catch { /* private mode or corrupt value — defaults are fine */ }
  weightsF.onChange(() => {
    try { localStorage.setItem(BW_KEY, JSON.stringify(postfx.weights)); } catch { /* ignore */ }
  });

  // sound. The encode is peak-normalized and the manifest carries each
  // sound's trim gain, so these are the coarse balance -- and the tuning
  // surface, since the levels shipped were derived from durations and
  // fire rates rather than heard.
  const soundF = gui.addFolder('sound');
  const soundState = { ...sfx.levels, mute: sfx.muted };
  soundF.add(soundState, 'master', 0, 1, 0.01).onChange((v) => sfx.setMaster(v));
  soundF.add(soundState, 'towers', 0, 1, 0.01).onChange((v) => sfx.setBus('towers', v));
  soundF.add(soundState, 'tank', 0, 1, 0.01).onChange((v) => sfx.setBus('tank', v));
  soundF.add(soundState, 'enemies', 0, 1, 0.01).onChange((v) => sfx.setBus('enemies', v));
  soundF.add(soundState, 'ui', 0, 1, 0.01).onChange((v) => sfx.setBus('ui', v));
  const muteCtrl = soundF.add(soundState, 'mute').onChange((v) => { sfx.setMute(v); syncSoundChip(); });

  // the pad button and the panel toggle are one state, two surfaces
  const soundBtn = root.querySelector('#td-pad-sound');
  function syncSoundChip() {
    if (soundBtn) {
      soundBtn.textContent = sfx.muted ? '\u2298' : '\u266A';   // off / on, monochrome
      soundBtn.classList.toggle('on', !sfx.muted);
    }
  }
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      sfx.setMute(!sfx.muted);
      soundState.mute = sfx.muted;
      muteCtrl.updateDisplay();
      syncSoundChip();
    });
  }
  syncSoundChip();

  // phones: start with the panel folded so the maze isn't buried
  if (matchMedia('(pointer: coarse), (max-width: 700px)').matches) gui.close();

  // --- render loop: PoV + minimap inset ------------------------------------
  const mapBg = new THREE.Color(0x080a10);
  let t = 0;
  let lastFrame = performance.now();
  // --- engine: hydraulics up, thruster bed, hydraulics down ---------------
  // Three sounds, not one. A single looping sample gave starting and
  // stopping no weight at all; the hydraulics do that work and the thruster
  // just carries the middle.
  //
  // Speed comes from the ACTUAL per-frame position delta rather than from
  // the drive inputs. One site then covers manual driving, auto navigation,
  // and the handoff eased through virtualStart -- and it follows the house
  // rule of deriving render-coupled values from the render state instead of
  // re-deriving them with a second set of conventions.
  let engineHandle = null;
  let enginePrev = null;    // last frame's position
  let engineLevel = 0;      // smoothed 0..1
  let engineIdle = 0;       // s since the tank last moved
  let engineRunning = false; // has the spool-up played and not been undone?
  // short: the hydraulics-down cue should answer the STOP, not trail it
  const ENGINE_STOP = 0.10;  // s of stillness before the bed fades out


  function stopEngine(fade = ENGINE_STOP, quiet = false) {
    if (engineHandle) engineHandle.stop(fade);
    engineHandle = null;
    engineLevel = 0;
    // the rock belongs to SETTING DOWN, not to leaving the tab
    if (engineRunning && !quiet) { sfx.play('tank_spool_down'); landTankFeel(feel); }
    engineRunning = false;
  }

  function updateEngine(dt) {
    if (!playerMesh || dt <= 0) return;
    const p = player.pos;
    if (!enginePrev) { enginePrev = p.slice(); return; }

    // cells/s, normalized against the fastest the tank can legally go
    const moved = dist3(p, enginePrev);
    enginePrev = p.slice();
    const cellsPerSec = moved / dt / cellSide;
    const top = Math.max(0.001, params.speed * speedBonus * 1.6 * 1.45); // cruise+boost
    const target = Math.min(1, cellsPerSec / top);

    // asymmetric smoothing: spin up fast, spool down slow, like an engine
    const k = target > engineLevel ? 6 : 2.5;
    engineLevel += (target - engineLevel) * Math.min(1, k * dt);

    const moving = engineLevel > 0.03 && !paused && !player.won;
    engineIdle = moving ? 0 : engineIdle + dt;

    // slow both ways: an engine SPOOLS. Rising a touch slower than it falls
    // reads as taking up load, then setting the weight back down.
    stepTankFeel(feel, dt, engineRunning, FEEL);

    if (moving && !engineRunning) {
      sfx.play('tank_spool_up'); // hydraulics lift it off the deck
      engineRunning = true;
    }
    // RETRY every frame while moving: sfx.loop returns null until the buffer
    // has decoded, and latching a failed handle is what silenced this bed
    // for whole sessions.
    if (moving && !engineHandle) {
      engineHandle = sfx.loop('tank_thruster', { gain: 0.001, rate: 0.92 });
    }
    if (!moving && engineIdle >= ENGINE_STOP && !(director && director.engineHold)) {
      stopEngine();
    } else if (engineHandle) {
      // gain is nearly linear in level; pitch spans 0.92..1.14 so the bed is
      // felt as effort rather than heard as a repeating clip
      // floor raised from 0.18: the bed was inaudible at a crawl, so it only
      // registered at full speed — which read as "the thruster isn't there"
      engineHandle.set(0.34 + 0.66 * engineLevel, 0.92 + 0.22 * engineLevel);
    }
  }

  // --- THE FRAME READOUT (operator, 2026-09-02) ---------------------------
  // fps, ms, and what the frame is made of — draw calls, triangles, points —
  // because "it feels slower" needs a number before it can be argued about.
  // renderer.info is reset by hand each frame while the readout is on (the
  // ?perf probe does the same), and left alone when it is off so it costs
  // nothing. Half-second EMA so the digits are readable rather than jittery.
  const perfEl = root.querySelector('#td-perf');
  let perfOn = false, perfFrames = 0, perfAcc = 0, perfFps = 0;
  let perfSample=null,perfDetails=false,perfSampleAt=-Infinity,perfGroupAt=-Infinity,perfGroups=[];
  const perfCpu={enemies:0,towers:0,frame:0};
  function performanceGroups(){
    return renderWorkload([
      ...TOWERS.map(def=>({label:def.label,objects:towers.filter(tw=>tw.key===def.key).map(tw=>tw.obj)})),
      {label:'Tank',objects:playerMesh?[playerMesh]:[]},
      {label:'Terraformer',objects:heartSprite?[heartSprite]:[]},
      {label:'Enemies',objects:enemies.filter(e=>e.alive).map(e=>e.obj)},
      {label:'Portals',objects:spawnPoints.filter(p=>p.alive).map(p=>p.obj)},
      {label:'Beams / lightning',objects:[...beams.map(b=>b.mesh),...[...plasmaBeams.values()].flatMap(e=>e.links.map(b=>b.mesh))]},
      {label:'Projectiles',objects:[...towerSeekers,...towerShots,...projectiles].map(p=>p.mesh)},
      {label:'Debris / bursts',objects:debris},
      {label:'Shield',objects:shieldObj?[shieldObj]:[]},
      {label:'World / other',objects:[scene]},
    ]);
  }
  perfEl?.addEventListener('pointerdown',e=>e.stopPropagation());
  perfEl?.addEventListener('toggle',e=>{if(e.target.isConnected && e.target.tagName==='DETAILS')perfDetails=e.target.open;},true);
  perfEl?.addEventListener('click',async e=>{
    e.stopPropagation();
    if(!e.target.closest('[data-copy-perf]'))return;
    const summary=performanceSummary(perfSample);
    try{await navigator.clipboard.writeText(summary);e.target.textContent='Copied';}
    catch{const box=document.createElement('textarea');box.value=summary;box.readOnly=true;perfEl.append(box);box.focus();box.select();box.addEventListener('blur',()=>box.remove(),{once:true});}
  });
  const PERF_KEY = 'ssg.td.perf';
  function setPerfOverlay(on, persist = true) {
    perfOn = !!on;
    if (perfEl) {
      perfEl.classList.toggle('hidden', !perfOn);
      // say something at once — the first real sample is half a second away
      // and an empty box looks like a box that failed
      if (perfOn && !perfEl.textContent) perfEl.textContent = 'measuring…';
    }
    renderer.info.autoReset = !perfOn;
    if(!perfOn){for(const query of gpuPending)gl.deleteQuery(query);gpuPending.length=0;}
    if (persist) { try { localStorage.setItem(PERF_KEY, perfOn ? '1' : '0'); } catch { /* fine */ } }
    if (perfCtl) perfCtl.updateDisplay();
  }
  // GPU TIME, from the GPU (2026-09-03). fps says whether the frame fits;
  // it does not say which side of the bus is full. One TIME_ELAPSED query is
  // opened around frame() and read back a few frames later — one per frame,
  // not one per draw: per-draw queries split the render pass on a tiled GPU
  // and overcount ~4x (research.md). Only while the readout is on.
  const gl = renderer.getContext();
  const gpuExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const gpuPending = [];
  let gpuOpen = null, perfGpu = 0, gpuAcc = 0, gpuN = 0;
  function gpuBegin() {
    if (!perfOn || !gpuExt || gpuOpen || gpuPending.length>=8) return;
    gpuOpen = gl.createQuery(); gl.beginQuery(gpuExt.TIME_ELAPSED_EXT, gpuOpen);
  }
  function gpuEnd() {
    if (!gpuOpen) return;
    gl.endQuery(gpuExt.TIME_ELAPSED_EXT); gpuPending.push(gpuOpen); gpuOpen = null;
    if(gl.getParameter(gpuExt.GPU_DISJOINT_EXT)){
      for(const query of gpuPending)gl.deleteQuery(query);gpuPending.length=0;gpuAcc=0;gpuN=0;perfGpu=0;return;
    }
    for (let i = gpuPending.length - 1; i >= 0; i--) {
      const q = gpuPending[i];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;
      gpuAcc += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gpuN++;
      gl.deleteQuery(q); gpuPending.splice(i, 1);
    }
  }
  let labLineAcc = 0;
  function perfTick(dt) {
    if (!perfOn || !perfEl) return;
    perfFrames++; perfAcc += dt;
    if (perfAcc < 0.5) { renderer.info.reset(); return; }
    const fps = perfFrames / perfAcc;
    perfFps = perfFps ? perfFps * 0.5 + fps * 0.5 : fps;
    if (gpuN) { const g = gpuAcc / gpuN; perfGpu = perfGpu ? perfGpu * 0.5 + g * 0.5 : g; gpuAcc = 0; gpuN = 0; }
    const r = renderer.info.render;
    perfEl.style.top=`${Math.max(48,statsEl.getBoundingClientRect().bottom+6)}px`;
    if(performance.now()-perfGroupAt>=2000){perfGroupAt=performance.now();perfGroups=performanceGroups();}
    const groups=perfGroups;
    perfSample={wave,fps:perfFps,frameMs:1000/perfFps,gpuMs:gpuExt && perfGpu>0?perfGpu:null,
      calls:r.calls,triangles:r.triangles,enemies:enemies.filter(e=>e.alive).length,
      cpu:{enemies:perfCpu.enemies/perfFrames,towers:perfCpu.towers/perfFrames,frame:perfCpu.frame/perfFrames},groups};
    perfCpu.enemies=perfCpu.towers=perfCpu.frame=0;
    if(performance.now()-perfSampleAt>=5000){perfSampleAt=performance.now();record('performance.sample',perfSample);}
    if(!perfEl.querySelector('textarea'))perfEl.innerHTML = `<b>${perfFps.toFixed(0)}</b> fps · ${(1000 / perfFps).toFixed(1)} ms`
      + (gpuExt ? ` · gpu ${perfGpu.toFixed(1)} ms` : '')
      + ` · <b>${r.calls}</b> calls · ${(r.triangles / 1000).toFixed(1)}k tris`
      + ` · ${(r.points / 1000).toFixed(1)}k pts`
      + (whRt ? ` · wh ${whRender.size}@${whRender.updateHz}` : '')
      + (lab.on ? ` · <b>LAB</b> ×${lab.waveMult}` : '')
      + `<details ${perfDetails?'open':''}><summary>Wave ${wave} · ${perfSample.enemies} enemies · workload</summary>`
      + `<div>CPU ms: enemies ${perfSample.cpu.enemies.toFixed(1)} · towers ${perfSample.cpu.towers.toFixed(1)} · frame ${perfSample.cpu.frame.toFixed(1)}</div>`
      + `<div>Scene estimates before culling; GPU cost varies by shader.</div>`
      + groups.map(row=>`<div>${row.label} ×${row.objects}: ${row.batches} batches · ${(row.triangles/1000).toFixed(1)}k tris · ${(row.points/1000).toFixed(1)}k points</div>`).join('')
      + `<button type="button" data-copy-perf>Copy performance</button></details>`;
    // the lab's line, every 2 s, for a headless run to grep
    labLineAcc += perfAcc;
    if (lab.on && labLineAcc >= 2) {
      labLineAcc = 0;
      console.log(labLine({ fps: perfFps, ms: 1000 / perfFps, gpuMs: gpuExt ? perfGpu : NaN,
        calls: r.calls, tris: r.triangles, pts: r.points,
        enemies: enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0), wave,
        waveMult: lab.waveMult, bg: lab.bg, fx: lab.fx, whSize: whRender.size, whHz: whRender.updateHz,
        steps: whUniforms.uSteps.value, octaves: whUniforms.uTurbOctaves.value, bloom: lab.bloom }));
    }
    perfFrames = 0; perfAcc = 0;
    renderer.info.reset();
  }
  let perfCtl = null;

  function animate() {
    // SIM rides TIMERS, not rAF: under a virtual-time budget the timer
    // queue runs at full speed while BeginFrames are rationed (the same
    // trap every probe in this file documents — used on purpose for once),
    // and in a real browser setTimeout(0) still outruns vsync ~4x.
    if (simFast > 1 && !simDone) setTimeout(animate, 0);
    else requestAnimationFrame(animate);
    if (!active || !mesh) return;
    // active play = no modal up: briefing, pause, and win/lose all count
    // as idle, which is when the mobile chrome (menu button) may return
    const playing = !paused && !player.won;
    if (playing !== wasPlaying) {
      wasPlaying = playing;
      document.body.classList.toggle('playing', playing);
    }
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1); // clamp tab-switch gaps
    if (director && director.held) { lastFrame = now; return; }   // the capture steps the clock, not the loop
    perfTick(Math.max(0,(now-lastFrame)/1000));   // the readout rides the loop's OWN dt — it must not take a second one
    updateEngine(dt);
    lastFrame = now;
    // SIM fast-forward: K fixed-dt update passes per painted frame, and
    // only every 4th frame paints at all — the sim math is cheap, the
    // paint is not. Fixed 1/30 steps keep collision/touch checks honest
    // (one huge dt would tunnel enemies through everything).
    if (simFast > 1 && !simDone) {
      simFrameNo++;
      // every 30th frame: the PiP view is a courtesy, and under software
      // GL a paint costs more than a hundred sim steps
      const draw = simFrameNo % 30 === 0;
      for (let i = 0; i < simFast; i++) frame(1 / 30, !(draw && i === simFast - 1));
      simWatch();
      return;
    }
    gpuBegin();
    const cpuStart=perfOn?performance.now():0;
    frame(dt, false);
    if(perfOn)perfCpu.frame+=performance.now()-cpuStart;
    gpuEnd();
  }

  let simFrameNo = 0;
  // the whole former animate() body: dt-driven update + (skippable) render
  function frame(dt, simSkip) {
    // paused: keep presenting the frozen frame (both views), zero sim.
    // lastFrame keeps updating above so resume has no dt spike.
    if (paused) {
      if (!simSkip) {
        playerMesh.visible = params.view !== 'pov';
        postfx.render();
        playerMesh.visible = true;
        drawRadar(t);   // the sweep keeps turning; a dead scope reads as a crash
      }
      return;
    }
    t += dt;

    // BUILD downtime: with the field clear, build mode freezes the WAR —
    // wave clock, motion, combat — while ambient life (portal twinkle,
    // heart moods, debris) and the camera transition keep breathing.
    // Mid-assault the same toggle is camera-only.
    stepBriefClock(dt);
    stepShot(dt);
    // ANY control input thaws the frozen tutorial opening — checked BEFORE
    // the frozen gate, since updateLasers itself is skipped while frozen.
    //
    // It used to be the LASER key alone, which is the one control the
    // opening does not ask for: the banner says "RAM THEM · drive straight
    // through them" and the throttle is pulsing. So a player who did exactly
    // what they were told pressed W, got nothing back, and read the game as
    // broken for the five or ten seconds it took to try something else
    // (operator, 2026-08-31). The hold is there to give the lane time to
    // matter, not to make the tank feel dead — so the moment a hand touches
    // anything, it is over.
    const handOn = keys.laser || keys.fast || keys.slow || keys.left || keys.right
      || throttle !== 0;
    if (tutorial.frozen && (handOn || cruise)) { tutorial.frozen = false; hideTutBanner(); }
    // THE DIRECTOR'S SHOT FILMS THE SIM, it does not freeze it: the cold
    // open's rule (a shot holds the world still) is exactly wrong for a
    // scripted run — the first RAM capture had 200 queued and none alive
    const dirShot = !!(director && shot && shot.id === 'director');
    const frozen = buildFrozen() || (shotActive() && !dirShot) || tutorial.frozen;
    // The BUILD pause holds the WORLD still, not the DRIVER. Planning with
    // the tank parked where the last wave left it meant switching out of
    // build, repositioning, and switching back — three actions for one
    // intention. A reveal or a tutorial hold still stops everything, because
    // those are the game speaking and it should not be driven over.
    // the cold open holds the hull for its first two beats and lets go for
    // the third — beat three IS the tank driving itself out of the berth
    // DEPLOY drives THROUGH a shot — that is how the cinematic's last frame
    // and DEPLOY's first frame meet — so the gate only stops free driving
    const driveFrozen = (shotActive() && !dirShot) || tutorial.frozen;

    bumpLeft = Math.max(0, bumpLeft - dt);
    recoilLeft = Math.max(0, recoilLeft - dt);
    cannonHeat = Math.max(0, cannonHeat - dt);
    // diegetic cannon gauge: the mid-barrel sleeve glows with the heat
    const sleeve = playerMesh && playerMesh.userData.heatSleeve;
    if (sleeve) sleeve.material.color.lerpColors(sleeveCool, sleeveHot, cannonHeat / CANNON_COOL);
    // THE SHOP IS NOT A DRIVING AID. It is screen-anchored to a cell, so the
    // moment the tank moves it is pointing at the wrong place — and a radial
    // over the fight is a radial you shoot through (operator, twice). Any
    // hand on the wheel closes it, same rule as the tutorial's opening hold.
    if (shopCi !== -1 && (keys.fast || keys.slow || keys.left || keys.right
      || cruise || throttle !== 0 || keys.fire || keys.laser)) closeShop();
    if (deploy) deployStep(dt);
    else if (!driveFrozen) advanceMotion(dt);
    ctlWatch(dt);
    // Isao keeps his shift through the build downtime — the war may be
    // frozen there, but construction is the thing you came to do. A
    // reveal or the cold open still stops him: those are the game
    // speaking, and nothing should be printing over the top of it.
    if (!frozen) updateIsao(dt);
    for (const orb of orbMeshes.values()) orb.userData.tick(t);
    for (let i = debris.length - 1; i >= 0; i--) {
      if (!debris[i].userData.tick(dt)) {
        scene.remove(debris[i]);
        debris[i].geometry.dispose();
        debris.splice(i, 1);
      }
    }
    if (!player.won && !frozen && !tutorialActive) {
      // An armed wave always gets its full lead-in, whoever asked for it.
      // This used to live inside the between-waves branch, so the stall
      // safety below — which fires while a wave is STILL live — spawned with
      // no charge, no rings and no sound at all. Later rounds hit that path
      // more and more often as waves take longer to clear, which is exactly
      // what "the cues drift in later rounds" looks like from the outside.
      // the orbital window fills in game time, like everything else here
      if (stepStrike(strike, dt, strikeTune) === 'armed') {
        sfx.play('tower_upgrade');
        showToast('<div class="wave-num">ORBITAL ASSET ARMED</div>'
          + '<div class="wave-role">☄ ready — arm, paint, launch</div>', 2200);
      }
      if (waveIn >= 0) {
        waveIn -= dt;
        waveCharge = Math.max(0, Math.min(1, 1 - waveIn / WAVE_WARN));
        warnBeat -= dt;
        if (warnBeat <= 0) {
          // beats accelerate from ~0.7s apart to ~0.18s: the cadence IS
          // the countdown, and it is legible without reading anything
          warnBeat = 0.72 - 0.54 * waveCharge;
          for (const sp of spawnPoints) {
            if (sp.alive) warnRing(sp.ci, CREATURE_TINTS[sp.type] ?? 0xffffff,
              0.55, cellSide * (1.6 + 1.4 * waveCharge));
          }
        }
        if (waveIn <= 0) { waveIn = -1; spawnWave(); }
      }
      if (waveActive) {
        waveAge += dt;
        if (!spawnQueue.length && enemies.every((e) => !e.alive)) {
          waveActive = false; interClock = 0; waveCharge = 0;
          score.addWave(wave); persistBest();
          if (simStyle) {
            simCurve.push({ w: wave, t: Math.round(t), heart: heartHP,
              biomass: eco.biomass, towers: towers.length, score: score.points });
          }
          if (tutorialActive) {
            showToast(`<div class="wave-num">WAVE ${wave} CLEARED</div>` +
              `<div class="wave-role">brace — the next wave is coming</div>`, 2200);
          } else if (sectorWave() === params.wavesPerSector) {
            // the HOLD is over: the gates lose their seals and the sector
            // becomes a hunt. This is the loudest beat in a sector and it
            // gets the loudest card the toast layer has.
            programmeSpent();
            showBrief('gates');
          } else showSitrep(); // the recap IS the cleared card now
        } else if (waveAge >= params.waveCap && spawnPoints.some((s) => s.alive) && !(lab.on && lab.holdWaves)) {
          armWave(); // safety: the field is stalled — but it still announces
        }
      } else if (spawnPoints.some((s) => s.alive)) {
        interClock += dt;
        // arm early enough that the countdown consumes the last WAVE_WARN of
        // the gap — the total wait from cleared to spawned is unchanged
        const gap = params.waveGap * (wave < 2 ? 1.6 : 1); // breathe early
        if (interClock >= gap - WAVE_WARN && !(lab.on && lab.holdWaves)) armWave();
      } else if (waveIn < 0) {
        waveCharge = 0;
      }
      // the boss omen: brass from the moment the remaining lead crosses 10s.
      // From a cleared field the whole lead is waveGap (armWave overlaps
      // it), so at the default 7s gap the omen owns the entire pre-boss
      // window; a stall-forced wave still cues off its 3s telegraph.
      if (!bossCued && wave + 1 === BOSS_WAVE && !buildFrozen()) {
        if (secsToWave() <= 10) { bossCued = true; sfx.play('boss_tension'); }
      }
    }
    updateWormhole(dt, t);
    if (!frozen) tfTick(dt);
    if (!frozen) autoUpgradeTick(dt);
    if (gotoCi >= 0 && player.cur === gotoCi) stopGoto();   // arrived: hand back, stop
    // the shell's mode button follows buildMode from EVERY path that sets it
    // (sector reveal, ?mode=build, the desktop chip), not only its own tap
    if (mobModeEl && (buildMode ? 1 : 0) !== mobModeLast) { mobModeLast = buildMode ? 1 : 0; syncMobMode(); }
    coachTick(dt);
    if (!frozen && eco) { ecoClockT += dt; if (eco.biomass >= CHEAPEST_TOWER) ecoAffordT += dt; }
    if (tutorialActive) tutorial.tick(dt);
    stepShieldDynamics(dt,t);
    if (!frozen) {
      let cpuStart=perfOn?performance.now():0;
      if (!(lab.on && lab.freezeEnemies)) updateEnemies(dt, t);
      if(perfOn)perfCpu.enemies+=performance.now()-cpuStart;
      checkRewards();
      updateProjectiles(dt, t);
      updateLasers(dt, t);
      cpuStart=perfOn?performance.now():0;
      stepTowers(dt, t);
      if(perfOn)perfCpu.towers+=performance.now()-cpuStart;
      updateTowerShots(dt, t);
    }
    // MINES ARM THROUGH THE BUILD DOWNTIME, deliberately outside the block
    // above. The operator's brief is "place them at chokepoints during
    // downtime" — a mine that only starts its two seconds when the next wave
    // opens is a mine you cannot pre-place, which is the whole feature. The
    // war being frozen costs nothing here: nothing is moving to trip them
    // except the tank, which DOES drive in build mode, and driving over your
    // own mine going off is correct. A shot or the tutorial's hold still
    // stops it — those are the game speaking.
    if (!driveFrozen) stepMines(dt, t);   // arm, trip, chain — after the bodies moved
    if (!frozen) stepRescue(dt, t);       // board, grab, deliver
    if (!frozen) stepRescue2(dt, t);      // call, emerge, walk, save — or run over
    // THE GATES' OWN MOTION: the ring's rotors turn, and a struck gate rides
    // out its recoil. The recoil is a SHOVE along its own normal that eases
    // back — the weight of a shell landing lives in that motion, not in a
    // bigger particle count.
    for (const sp of spawnPoints) {
      if (!sp.alive || !sp.obj) continue;
      if (sp.obj.userData.tick) sp.obj.userData.tick(t, dt);
      if (sp.recoil > 0) {
        sp.recoil = Math.max(0, sp.recoil - dt);
        const u = sp.recoil / GATE_RECOIL;          // 1 at impact, 0 at rest
        const push = Math.sin(u * Math.PI) * cellSide * 0.28;
        const c = graph.centers[sp.ci];
        const n2 = graph.normals[sp.ci];
        // shoved back and slightly up, then let down
        sp.obj.position.set(c[0] + n2[0] * push, c[1] + n2[1] * push, c[2] + n2[2] * push);
      }
    }
    updateBeams(dt); // fx fade even during downtime
    stepSlugs(dt);
    if (rangeRingTtl > 0) {
      rangeRingTtl -= dt;
      if (rangeRingTtl <= 0) { rangeRingTtl = 0; hideRangeRing(); }
    }
    if (strikeGrace > 0) strikeGrace -= dt;
    if (shopMute > 0) shopMute -= dt;
    if (heartCalloutCd > 0) heartCalloutCd -= dt;
    if (stationRing) {
      stationRing.material.opacity = shield.stationLeft > 0
        ? 0.5 + 0.3 * Math.sin(runContext.time * 3)
        : 0.12;
    }
    if (rs) {
      rs.binClock += dt;
      if (rs.binClock >= 5) { rs.binClock = 0; rs.scoreBins.push(score.points); }
    }
    if (!serverFound && serverCi >= 0 && !playerDown
        && dist3(player.pos, graph.centers[serverCi]) < cellSide * 4) {
      serverFound = true;
      showToast(`<div class="wave-num">SERVER FOUND</div>`
        + `<div class="wave-role">an antipode relay — HACK it for tower firmware</div>`, 3400);
      syncHackBtn();
    }
    // standing at the relay, the game says WHAT TO PRESS — the rail
    // button alone was invisible to a player looking at the machine
    if (hackPromptEl && !simSkip) {
      const near = hackPromptForce || (serverFound && !hackedRound && serverCi >= 0
        && (!hackWrapEl || hackWrapEl.classList.contains('hidden'))
        && dist3(player.pos, graph.centers[serverCi]) < cellSide * 4.5);
      hackPromptEl.classList.toggle('hidden', !near);
    }
    if (ramComboT > 0) {
      ramComboT -= dt;
      if (ramComboT <= 0) { ramCombo = 0; syncCombo(); }
    }
    {
      const impactCi = stepFall(strike, dt);
      if (impactCi >= 0) {
        if (rs) rs.strikes++;
        executeStrike(impactCi, t);
        snapCamera();
        // the skip-tap and the impact race; the loser must not buy a tower
        shopMute = 0.8;
      }
      if (!simSkip) syncStrikeFeed();
    }
    if (!simSkip && armBtn) syncArmUi();
    stepWarnFx(dt);
    for (const sp of spawnPoints) {
      if (!sp.alive) continue;
      // dial in, then behave normally. The idle twinkle would fight the
      // drawing head for the colour buffer, so it waits its turn.
      const ud = sp.obj.userData;
      if (ud.setForm && ud.dial < 1) {
        ud.dial = Math.min(1, ud.dial + dt / GATE_DIAL);
        ud.setForm(ud.dial);
        // ease the swell in with it, so an opening gate grows as it draws
        const s0 = ud.sizeScale ?? 1;
        sp.obj.scale.setScalar(s0 * (0.55 + 0.45 * ud.dial));
        continue;
      }
      // the charge runs the gate's own idle FASTER, rather than adding a
      // second animation on top of it — one thing accelerating reads as
      // building pressure; two things moving reads as noise
      sp.obj.userData.tick(t * (1 + 2.2 * waveCharge));
      if (sp.obj.userData.setDim) sp.obj.userData.setDim(1 + 1.5 * waveCharge);
      // THE SHAKE IS GONE (operator, 2026-09-02). A scale pulse used to beat
      // here as the charge built — right for a dot-cloud orb, wrong for a
      // standing ring, which is architecture and should not throb. The ring's
      // pre-wave tell is the wormhole winding up (portalfx.travelRate); adding
      // a shake on top was the "two things moving reads as noise" this very
      // comment warns about.
      const s0 = sp.obj.userData.sizeScale ?? 1;
      sp.obj.scale.setScalar(s0);
      // proximity discovers the source: the minimap beacon lights up
      if (!sp.found && dist3(player.pos, graph.centers[sp.ci]) < cellSide * 5) sp.found = true;
    }
    if (simStyle && !simDone) simPolicy(dt);
    autoSecondary();
    autoGunner(t);
    checkVictory(); // ram kills and heart-contact deaths can end it too
    // DOM is the sim's tax collector: an innerHTML rebuild per SIM STEP
    // (120 per painted frame) throttled the fast-forward to ~2s per batch.
    // The HUD only needs to be true when a frame is actually painted.
    if (!simSkip) {
      updateHud();
      updateNextPreview();
    }
    placeActors();

    // phagocytosis: when the amoeba nears an orb, aim the membrane at it.
    // Direction is converted into the creature's FINAL local frame (inverse
    // of the mesh quaternion), where waveJelly applies the stretch.
    reach.dir = null; reach.amt = 0;
    if (params.creature === 'amoeba' && creatureGeo && orbMeshes.size > 0 && !player.won) {
      const { ci, d } = nearestOrb();
      const reachRange = cellSide * 1.7 + unitScale;
      if (ci !== -1 && d < reachRange) {
        const orb = orbMeshes.get(ci);
        tmpV.copy(orb.position).sub(playerMesh.position).normalize()
          .applyQuaternion(tmpQ.copy(playerMesh.quaternion).invert());
        reach.dir = [tmpV.x, tmpV.y, tmpV.z];
        reach.amt = Math.min(1, Math.max(0, 1 - d / reachRange));
      }
    }

    // cloud: Wave×Jelly (+ reach) re-poses the dots; mesh: transform tick
    if (creatureGeo) {
      waveJelly(creatureBase, t, creaturePos, reach.amt > 0 ? { reachDir: reach.dir, reachAmt: reach.amt } : null);
      creatureGeo.getAttribute('position').needsUpdate = true;
    } else if (playerMesh.userData.tick) {
      playerMesh.userData.tick(t);
    }
    buildFollowTank(dt);
    updateCameraGoal();

    if (director && shot && shot.id === 'director') {
      // THE DIRECTOR'S RAIL IS THE CAMERA: no ease, no lag, the pose is the pose
      camera.position.copy(camGoal.pos);
      camera.quaternion.copy(camGoal.quat);
    } else {
      camera.position.lerp(camGoal.pos, 0.14);
      camera.quaternion.slerp(camGoal.quat, 0.14);
    }
    if (director) directorFrame(dt);
    if (urlParams.get('viewwatch') !== '0') viewWatch(dt);
    diagTick(dt);

    heartSprite.userData.tick(t);

    // announce card: spin the introduced enemy while the banner is up
    if (waveUnit && !waveEl.classList.contains('hidden')) {
      waveUnit.rotation.y = t * 0.8; // HokorobiTawaa's announce spin
      if (waveUnit.userData.tick) waveUnit.userData.tick(t);
      if (!simSkip) waveSpriteRenderer.render(waveScene, waveCam);
    }

    // main view — the map-layer chrome needs no hiding any more; nothing
    // renders that layer
    // the lab's sky: a cubemap baked once, drawn faint. postfx blacks the
    // background out of its weighted pass, so it never blooms whatever it is.
    scene.background = sky ? sky.texture : mainBg;
    scene.backgroundIntensity = sky ? (lab.on ? lab.bgIntensity : SKY_PRESET.intensity) : 1;
    if (simSkip) return; // sim pass: state advanced, nothing painted
    // in PoV the camera sits inside the creature — hide it there
    playerMesh.visible = params.view !== 'pov';
    postfx.render();

    drawRadar(t);
  }

  // The scope. Player mode is heading-up around the tank; heart mode (M) is
  // pole-down over the whole planet. Contacts carry the phosphor: full the
  // instant the beam passes, decaying behind it, never dark.
  const sensorDemo = [];
  function drawRadar(t) {
    if (!graph || !player.pos) return;
    const m = radarCss;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const ctx = radarCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = m / 2, cy = m / 2, R = m / 2 - 3;
    // basis + range: heart mode must hold the whole planet (max chord 2.0)
    let cpos, up;
    if (mapMode === 'heart') {
      const { hn, t1 } = poleFrame();
      cpos = graph.centers[dungeon.heart]; up = t1;
      // eslint-disable-next-line no-unused-vars
      void hn;
    } else {
      cpos = player.pos;
      up = player.smoothDir;
    }
    const basis = radarBasis(cpos, up);
    const range = mapMode === 'heart' ? 2.02 : 1.15;
    const sweep = sweepAngle(t);

    // ground: near-black green, three range rings, crosshair, rim
    ctx.fillStyle = '#031007';
    ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90, 255, 140, 0.18)';
    ctx.lineWidth = 1;
    for (const f of [1 / 3, 2 / 3, 1]) {
      ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();

    // the beam: a conic trail BUILDING toward the beam line, so the glow
    // sits behind the rotation, then the hot edge itself
    const phi = sweep - Math.PI / 2;   // canvas angles: 0 = +x, clockwise
    const grad = ctx.createConicGradient(phi, cx, cy);
    grad.addColorStop(0, 'rgba(90, 255, 140, 0)');
    grad.addColorStop(0.72, 'rgba(90, 255, 140, 0)');
    grad.addColorStop(1, 'rgba(90, 255, 140, 0.30)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(140, 255, 180, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.sin(sweep), cy - R * Math.cos(sweep));
    ctx.stroke();

    const blip = (pos, style, size, always = false) => {
      const q = radarProject(pos, cpos, basis, range);
      const bri = always ? 1 : radarPhosphor(radarBearing(q.x, q.y), sweep);
      const bx = cx + q.x * R, by = cy + q.y * R;
      ctx.globalAlpha = q.clamped ? bri * 0.5 : bri;
      ctx.fillStyle = style;
      ctx.fillRect(bx - size / 2, by - size / 2, size, size);
      ctx.globalAlpha = 1;
    };

    // towers: dim cyan fixtures — infrastructure, not contacts
    for (const tw of towers) blip(graph.centers[tw.ci], '#4bd7e0', 2.5);
    // enemies: THE contacts, phosphor green, heavies fatter
    for (const e of enemies) {
      if (!e.alive) continue;
      // optical camo: a phantom is a contact only in its decloak window
      if (e.spec.cloaked && !e.decloaked) continue;
      blip(e.pos, '#5aff8c', e.spec.rammable ? 2.5 : 4);
    }
    // gates: amber, pulsing harder as a wave charges. Known ones only —
    // discovery still matters.
    // THE PROXIMITY SENSOR (operator): car-style arcs inside the rim, one
    // sector each for ahead / starboard / astern / port, one to three arcs by
    // how close the nearest SOLID contact in that sector is. Visual only —
    // no sound by request. Only in the heading frame: from the heart's frame
    // "ahead" means nothing.
    if (mapMode !== 'heart') {
      // sensorDemo: positions a probe injects so the arcs can be LOOKED AT
      // without a live solid contact on the board; empty in play
      // demo contacts are RELATIVE (fwd/right in cells): world-fixed ones
      // drifted in bearing and distance as the tank drove, and the
      // screenshot showed the wrong colours in the wrong sectors
      const hard = sensorDemo.map((d) => norm3([cpos[0] + basis.fwd[0] * d.fwd * cellSide + basis.right[0] * d.right * cellSide,
        cpos[1] + basis.fwd[1] * d.fwd * cellSide + basis.right[1] * d.right * cellSide,
        cpos[2] + basis.fwd[2] * d.fwd * cellSide + basis.right[2] * d.right * cellSide]));
      for (const e of enemies) {
        if (!e.alive || e.spec.rammable) continue;
        if (e.spec.cloaked && !e.decloaked) continue;
        hard.push(e.pos);
      }
      // the CELL rule: blue at 4, orange at 3, red at 2 (radar.js SENSOR_RINGS)
      const secs = proximitySectors(hard, cpos, basis, range, cellSide);
      const pulse = 0.72 + 0.28 * Math.sin(t * 9);
      for (let i = 0; i < secs.length; i++) {
        const lv = secs[i].level;
        if (!lv) continue;
        // sector i is centred at bearing i*90°; canvas angles run from +x
        // clockwise and bearing 0 is screen-up, so subtract a quarter turn
        const mid = i * Math.PI / 2 - Math.PI / 2;
        const half = Math.PI / 4 - 0.14;   // a gap between sectors
        for (let k = 0; k < lv; k++) {
          const rr = R - 3 - k * 4.5;
          ctx.strokeStyle = sensorColor(lv) || '#3fa9ff';
          ctx.globalAlpha = (lv >= 3 ? pulse : 0.85) * (k === SENSOR_LEVELS - 1 ? 1 : 0.8);
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(cx, cy, rr, mid - half, mid + half); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // THE CAMPS: a hollow orange box, always lit, filled once opened. On a
    // raid this is the whole map — three of them on a board with no waves.
    for (const camp of rescue.camps) {
      const q = radarProject(camp.pos, cpos, basis, range);
      const bx = cx + q.x * R, by = cy + q.y * R;
      const left = camp.group.filter((sv) => sv.state === 'inside' || sv.state === 'walking').length;
      ctx.globalAlpha = q.clamped ? 0.6 : 1;
      ctx.strokeStyle = left ? '#ffb45e' : '#4a5560';
      ctx.fillStyle = '#ffb45e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.rect(bx - 4.5, by - 4.5, 9, 9);
      if (camp.open && left) ctx.fill(); else ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // THE STRANDED: orange, always lit. A survivor is not a contact you have
    // to sweep for — the phosphor decay that makes an enemy blip breathe
    // would make a person flicker, and a flickering person reads as noise.
    // Grabbed turns it red and fills it, which is the countdown at a glance.
    for (const sv of rescue.survivors) {
      if (sv.state !== 'standing') continue;
      const q = radarProject(sv.pos, cpos, basis, range);
      const bx = cx + q.x * R, by = cy + q.y * R;
      const held = sv.grabT > 0;
      ctx.globalAlpha = q.clamped ? 0.6 : 1;
      ctx.strokeStyle = held ? '#ff4d5e' : '#ffb45e';
      ctx.fillStyle = held ? '#ff4d5e' : '#ffb45e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx, by - 6);
      ctx.lineTo(bx + 5, by + 4);
      ctx.lineTo(bx, by + 1.5);
      ctx.lineTo(bx - 5, by + 4);
      ctx.closePath();
      if (held) ctx.fill(); else ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // LAID MINES: friendly blue, an arrowhead pointing along the arc, hollow
    // while it is still arming. A field reads across the scope as a row of
    // heads all facing the same way, which is what a laid field IS.
    for (const m of mineField.mines) {
      if (!m.alive) continue;
      const q = radarProject(m.pos, cpos, basis, range);
      // the head points along the mine's own axis, projected onto the scope:
      // derived from the SAME dir the blast uses, never re-guessed here
      const tip = radarProject(minePoint(m, 0.9, 0, 0), cpos, basis, range);
      const hx = tip.x - q.x, hy = tip.y - q.y;
      const hl = Math.hypot(hx, hy) || 1;
      const ux = hx / hl, uy = hy / hl;
      const bx = cx + q.x * R, by = cy + q.y * R;
      const S = 5;
      ctx.globalAlpha = 0.45 + 0.55 * radarPhosphor(radarBearing(q.x, q.y), sweep);
      ctx.beginPath();
      ctx.moveTo(bx + ux * S, by + uy * S);
      ctx.lineTo(bx - ux * S * 0.5 - uy * S * 0.6, by - uy * S * 0.5 + ux * S * 0.6);
      ctx.lineTo(bx - ux * S * 0.5 + uy * S * 0.6, by - uy * S * 0.5 - ux * S * 0.6);
      ctx.closePath();
      if (m.live) { ctx.fillStyle = '#6fd3ff'; ctx.fill(); }
      else { ctx.strokeStyle = '#6fd3ff'; ctx.lineWidth = 1.2; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    for (const sp of spawnPoints) {
      if (!sp.alive || !sp.found) continue;
      const q = radarProject(graph.centers[sp.ci], cpos, basis, range);
      const r2 = 3 + 1.4 * Math.sin(t * 4 + sp.ci) + waveCharge * 3.5;
      ctx.globalAlpha = 0.55 + 0.45 * radarPhosphor(radarBearing(q.x, q.y), sweep);
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx + q.x * R, cy + q.y * R, Math.max(1.5, r2), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // the heart: what all of this is FOR — red, steady
    blip(graph.centers[dungeon.heart], '#ff4d6a', 5, true);
    // the strike's painted cell, while one is armed
    if (strike.armed && strike.target >= 0) {
      const q = radarProject(graph.centers[strike.target], cpos, basis, range);
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 1.5;
      const bx = cx + q.x * R, by = cy + q.y * R;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by); ctx.lineTo(bx + 6, by);
      ctx.moveTo(bx, by - 6); ctx.lineTo(bx, by + 6);
      ctx.stroke();
    }
    // YOU: a heading wedge at centre (player mode) or a white dot out on the
    // board (heart mode)
    ctx.fillStyle = '#f2f8ff';
    if (mapMode === 'player') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx - 4, cy + 5);
      ctx.lineTo(cx + 4, cy + 5);
      ctx.closePath();
      ctx.fill();
    } else {
      blip(player.pos, '#f2f8ff', 4, true);
    }
  }

  // debug/demo overrides: ?wall=0.03 forces a wall height,
  // ?walk=N auto-walks N hops along the shortest route to the heart
  // (handy for screenshotting specific configurations)
  const urlParams = new URLSearchParams(location.search);
  const wallOverride = parseFloat(urlParams.get('wall') || '');
  const pointsOverride = parseInt(urlParams.get('points') || '', 10);
  if (Number.isFinite(pointsOverride)) params.points = Math.min(16000, Math.max(150, pointsOverride));
  const seedOverride = parseInt(urlParams.get('seed') || '', 10);
  if (Number.isFinite(seedOverride)) params.seed = seedOverride >>> 0;
  const simParam = urlParams.get('sim');
  if (simParam) {
    simStyle = simParam;
    simFast = Math.max(1, Math.min(120, parseInt(urlParams.get('simfast') || '50', 10)));
    simCap = Math.max(30, parseInt(urlParams.get('simcap') || '600', 10));
    console.log(`SIMBOOT style=${simStyle} fast=${simFast} cap=${simCap}`);
    postfx.setEnabled(false);   // bare-minimum paint: no bloom chain
    sfx.setMute(true);          // 50x audio is a fire alarm
    document.body.classList.add('simming');
  }
  if (Number.isFinite(wallOverride)) params.wallHeight = wallOverride;
  const viewOv = urlParams.get('view');
  viewOverride = ['pov', 'third', 'orbit', 'drone'].includes(viewOv);
  if (viewOverride) { setView(viewOv); }
  // the drone view is the one that can be REFUSED at boot (his bytes are
  // still in flight), so it is re-asked for once he lands rather than
  // silently leaving you in orbit
  if (viewOv === 'drone' && params.view !== 'drone') {
    preloadFabricator().then(() => { spawnIsao().then(() => setView('drone')); });
  }
  if (urlParams.get('callouts') === '0') params.callouts = false;
  syncCalloutMode();
  const heartOverride = urlParams.get('heart');
  if (HEART_LOOKS[heartOverride]) params.heartLook = heartOverride;
  const lookOverride = urlParams.get('look');
  if (LOOKS[lookOverride]) params.look = lookOverride;
  const wtOverride = urlParams.get('walltops');
  if (['bright', 'dim', 'black'].includes(wtOverride)) params.wallTops = wtOverride;
  const creatureOverride = urlParams.get('creature');
  if (UNITS[creatureOverride]) params.creature = creatureOverride;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());

  regenerate();
  applyLook();
  // a unit whose model loads asynchronously needs its bytes kicked off; it
  // renders the procedural fallback until they arrive
  if (['mkcx', 'mkcx2', 'mork'].includes(params.creature)) applyCreature();

  // ?walk=N teleports the wanderer N hops along the shortest route (demo)
  const walkN = parseInt(urlParams.get('walk') || '0', 10);
  for (let i = 0; i < walkN && !player.won; i++) {
    const d = dungeon.distToHeart;
    const next = openNeighbors(player.cur).find((nb) => d[nb] === d[player.cur] - 1);
    if (next === undefined) break;
    arriveAt(next);
  }
  if (walkN > 0) {
    player.pos = graph.centers[player.cur].slice();
    const td = player.prev >= 0 ? tangentDirTo(player.prev, player.cur)
      : player.travelDir;
    player.travelDir = td;
    player.heading = td.slice();
    player.next = player.won ? -1 : chooseNext();
    player.prog = 0;
    player.smoothDir = player.travelDir.slice();
    if (player.next !== -1) player.segLen = Math.max(1e-9, dist3(graph.centers[player.cur], graph.centers[player.next]));
    snapCamera();
  }

  // ?sector=N jumps the world to sector N pre-opened (headless check of
  // the expansion path; runs before ?wave so portals land in the band)
  const sectorN = parseInt(urlParams.get('sector') || '1', 10);
  if (sectorN > 1) {
    round = sectorN;
    applySector();
    buildGeometry();
  }

  // ?wave=N force-runs N wave beats (introductions included) — headless
  // verification of the announce/spawn flow without waiting wall-clock
  const waveN = parseInt(urlParams.get('wave') || '0', 10);
  for (let i = 0; i < waveN; i++) spawnWave();


  // ?sector=N stands on the SECTOR N debrief, so the card can be
  // photographed without playing fifteen waves five times over.
  const debriefN = parseInt(urlParams.get('debrief') || '0', 10);
  if (debriefN > 0) {
    clearEnemies();
    round = Math.min(SECTORS_TOTAL, debriefN);
    sectorsCleared = round - 1;
    wave = params.wavesPerSector * round;
    sectorStartWave = wave - params.wavesPerSector;
    for (const sp of spawnPoints) sp.alive = false;
    checkVictory();
  }

  // ?planet=1 stands on the second win: the whole shell open, every portal
  // dead. Reachable only by clearing five sectors, so never by hand here.
  if (urlParams.get('planet') === '1') {
    round = SECTORS_TOTAL;
    for (const sp of spawnPoints) sp.alive = false;
    clearEnemies();
    checkVictory();
  }

  // ?found=1 marks every spawn point discovered (minimap beacon check)
  if (urlParams.get('found') === '1') for (const sp of spawnPoints) sp.found = true;

  // ?laser=1 holds the laser trigger down (headless visual check) and
  // reports where the heat actually lands — a color that no one can see is
  // exactly the bug this line exists to catch
  if (urlParams.get('laser') === '1') {
    keys.laser = true;
    for (const at of [2500, 6000, 12000]) {
      setTimeout(() => {
        const m = playerMesh && playerMesh.userData && playerMesh.userData.gunHeatMat;
        const sm = playerMesh && playerMesh.userData && playerMesh.userData.laserSleeveMat;
        console.log(`GUNHEAT t=${at} mat=${!!m} sleeve=${!!sm}`
          + ` kind=${playerMesh && playerMesh.userData.kind}`
          + ` heat=${laserHeat.toFixed(2)}`
          + (m ? ` col=${m.color.getHexString()}` : '')
          + (sm ? ` scol=${sm.color.getHexString()}` : ''));
      }, at);
    }
  }

  // ?mode=build / ?map=heart jump straight into the TD viewpoints
  if (urlParams.get('mode') === 'build') { setView('orbit'); snapCamera(); } // legacy alias for view=orbit
  if (urlParams.get('map') === 'heart') mapMode = 'heart';

  // ?biomass=N pads the purse (?credit=N still works — the old name is an
  // alias so saved debug URLs keep working); ?tower=key@ci,key@ci force-places
  // towers
  // (both headless-verification hooks)
  const biomassN = parseInt(urlParams.get('biomass') || urlParams.get('credit') || '0', 10);
  if (biomassN > 0) eco.addBiomass(biomassN);
  const towerSpec = urlParams.get('tower');
  if (towerSpec) {
    for (const part of towerSpec.split(',')) {
      // key@ci or key@ci@tier — the tier arm exists so the pedestal
      // shapes (square/hex/circle) can be photographed without a mouse
      const [key, ciStr, tierStr] = part.split('@');
      let ci = parseInt(ciStr, 10);
      if (!TOWER_BY_KEY[key] || !Number.isFinite(ci)) continue;
      // seek forward to the nearest placeable cell — raw indices are a
      // lottery on a sealed sector world
      for (let tries = 0; tries < 400 && ci < dungeon.tags.length; tries++, ci++) {
        if (!placeError(ci)) {
          if (placeTower(key, ci)) {
            const want = parseInt(tierStr || '0', 10);
            const tw = towerByCell.get(ci);
            for (let t = 0; tw && t < want; t++) { eco.addBiomass(999); upgradeTower(tw); }
            // report the pedestal actually mounted — the tier read is
            // geometry, so the probe reads geometry
            if (tw) {
              const b = tw.obj.children.find((c) => c.isMesh && Math.abs(c.position.y - 0.08) < 0.02);
              const gp = b && b.geometry.parameters;
              console.log(`TOWERTIER ${key} tier=${tw.tier} base=${b ? b.geometry.type : '?'}`
                + `${gp && gp.radialSegments ? ` seg=${gp.radialSegments}` : ''}`);
            }
          }
          break;
        }
      }
    }
  }

  // ?order=key[,key] puts orders on ISAO's book (a site is chosen for each,
  // so the hook needs no cell ids), and ?isao=N then runs N seconds of his
  // shift. Both are needed because he is asynchronous twice over: the model
  // loads async, and the whole point of the mechanic is that a tower takes
  // wall-clock time to exist — neither of which ?tick can reach.
  // ?beep=1 — a raw oscillator straight to ctx.destination, using none of
  // the sample path. Audible beep + silent game = buffers or gain graph.
  // Neither audible = the context never reaches the speakers.
  if (urlParams.get('beep') === '1') {
    const fire = () => sfx.beep(880, 350);
    if (!fire()) addEventListener('pointerdown', fire, { once: true, capture: true });
    addEventListener('keydown', fire, { capture: true, passive: true });
    addEventListener('pointerdown', fire, { capture: true, passive: true });
  }

  // ?audiogate=N — DOES THE UNLOCK KEEP TRYING? The regression that started
  // all this was a one-shot gate: it removed its listeners synchronously,
  // before resume() had settled, so a single rejected attempt killed audio
  // for the session. Synthetic gestures are untrusted, so every resume here
  // WILL be rejected — which is precisely the failure path worth exercising.
  // Expect repeated "resume rejected (n)" and a rebuild, never silence.
  const gateN = parseInt(urlParams.get('audiogate') || '0', 10);
  if (gateN > 0) {
    let fired = 0;
    const tick = () => {
      if (fired++ >= gateN) {
        console.log(`AUDIOGATE dispatched=${fired - 1} gestures`
          + ' — the AUDIO gesture lines above prove the gate kept trying');
        return;
      }
      // a REAL click is a sequence; dispatching only pointerdown no longer
      // creates a context (see CREATE_EVENTS in audio.js), so send the lot
      window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      window.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      setTimeout(tick, 120);
    };
    tick();
  }

  // ?briefprobe=1 — DOES ISAO LEAVE ON HIS OWN? The operator's complaint was
  // that his lines had to be dismissed by hand, one tap per line, over the
  // board. The fix is only real if a beat plays through and clears itself with
  // NO input at all — which no screenshot can show, because a screenshot of a
  // panel looks the same whether it is about to leave or waiting forever.
  if (urlParams.get('briefprobe') === '1') {
    const beat = brief('gates');
    const total = beat.lines.reduce((a2, l) => a2 + dwellFor(l), 0);
    showBrief('gates');
    const shown = !briefEl.classList.contains('hidden');
    const startAt = briefAt;
    // half a line in: still up, and it must NOT have advanced yet
    stepBriefClock(dwellFor(beat.lines[0]) * 0.5);
    const heldEarly = briefAt === startAt && !briefEl.classList.contains('hidden');
    // past the first line: advanced, with nobody touching it
    stepBriefClock(dwellFor(beat.lines[0]) * 0.6);
    const advanced = briefAt > startAt;
    // run out the rest of the beat
    for (let i = 0; i < 400 && briefQ; i++) stepBriefClock(0.1);
    const cleared = briefQ === null && briefEl.classList.contains('hidden');
    console.log(`BRIEFPROBE shown=${shown} heldForTheFirstLine=${heldEarly}`
      + ` advancedWithNoInput=${advanced} clearedItself=${cleared}`
      + ` | beat=${beat.lines.length} lines, ${total.toFixed(1)}s unattended`
      + ` — ${shown && heldEarly && advanced && cleared ? 'PASS' : 'FAIL'}`);

    // NEGATIVE CONTROL. A clock that ran regardless of dt would pass every
    // assertion above by simply galloping to the end. Show a fresh beat, step
    // it by ZERO, and it must sit exactly where it was put.
    showBrief('printer');
    const at0 = briefAt, up0 = !briefEl.classList.contains('hidden');
    for (let i = 0; i < 50; i++) stepBriefClock(0);
    console.log(`BRIEFPROBE control: stepping by dt=0 fifty times`
      + ` leaves it at line ${briefAt} of ${briefQ ? briefQ.lines.length : 0},`
      + ` still up=${briefQ !== null}`
      + ` — ${up0 && briefAt === at0 && briefQ !== null ? 'PASS (the clock is dt, not calls)' : 'FAIL'}`);
    endBrief();

    // ARE THE NEW BEATS ACTUALLY REACHABLE? A beat with no trigger is a file
    // nobody reads. Each is invoked through the REAL seam it is wired to, not
    // through showBrief, so a mis-wired trigger fails here.
    const trig = [
      ['stalheart', () => setView('orbit')],
      ['motive', () => { waveIn = -1; armWave(); }],
      ['harvest', () => noteWaveKill('phage', 'tank')],
    ];
    for (const [id, fire] of trig) {
      clearBriefs();
      const i = briefSeen.indexOf(id);
      if (i >= 0) briefSeen.splice(i, 1);   // un-see it for the test
      fire();
      console.log(`BRIEFPROBE trigger ${id} — ${briefQ && briefQ.id === id ? 'PASS' : `FAIL (got ${briefQ ? briefQ.id : 'nothing'})`}`);
    }
    clearBriefs();

    // THE ONE-DEEP QUEUE. Two beats coming due together must not lose one:
    // a `once` beat is marked seen the moment it shows, so an interrupted one
    // is gone for good. The second must be held and play next.
    for (const id of ['arrival', 'stalheart']) {
      const i = briefSeen.indexOf(id); if (i >= 0) briefSeen.splice(i, 1);
    }
    showBrief('arrival');
    showBrief('stalheart');
    const first = briefQ && briefQ.id;
    for (let i = 0; i < 600 && briefQ && briefQ.id === first; i++) stepBriefClock(0.1);
    console.log(`BRIEFPROBE queue: showed ${first}, then ${briefQ ? briefQ.id : 'nothing'}`
      + ` — ${first === 'arrival' && briefQ && briefQ.id === 'stalheart' ? 'PASS (the second was held, not lost)' : 'FAIL'}`);
    clearBriefs();

    // ...and the reset teardown, which regenerate() did not have: a beat
    // mid-sentence when the run restarts must not survive onto the new board.
    showBrief('relay');
    const upBefore = !briefEl.classList.contains('hidden');
    regenerate();
    console.log(`BRIEFPROBE reset: up before=${upBefore} up after regenerate=${!briefEl.classList.contains('hidden')}`
      + ` — ${upBefore && briefEl.classList.contains('hidden') ? 'PASS' : 'FAIL'}`);
  }

  // ?beamfire=1 — THE SECONDARY, measured. A beam that renders proves nothing
  // about a weapon: what matters is that the burst is as long as the sound,
  // that the cooldown did not change, and that it burns everything it passes
  // through rather than stopping at the first thing.
  if (urlParams.get('beamfire') === '1') {
    (async () => {
      // YIELD BEFORE MEASURING ANYTHING. An async IIFE's body runs
      // SYNCHRONOUSLY up to its first await, and the rest of init — including
      // the ?rank=N hook several hundred lines below — has not run yet.
      // Without this the probe measures the boot defaults and silently
      // ignores every hook it is paired with: ?rank=15&beamfire=1 reported a
      // rank-0 beam and called it a PASS. Found while wiring the rank steps.
      await new Promise((r) => setTimeout(r, 0));
      const step = 1 / 60;
      keys.laser = true;
      let rise = 0, fell = 0, peakSeen = 0;
      // ALTITUDE MUST BE SAMPLED WHILE THE BEAM IS ON. The first cut of this
      // measured after the trigger released — by then hideBeams() has run,
      // every mesh is invisible, the `visible` guard skips all of them and
      // the max stays 0, which the check read as a PASS. A probe that reports
      // PASS having measured nothing is worse than no probe.
      let arcSample = null;
      const sampleArc = () => {
        const lift = 1 + params.wallHeight * 0.5;
        let coreMax = 0, plumeMax = 0, seenCore = 0, seenPlume = 0;
        if (tankBeams) {
          for (const bm of tankBeams) {
            if (!bm.mesh.visible) continue;
            seenCore++;
            for (const u of [bm.uniforms.uStart, bm.uniforms.uEnd]) {
              if (!u) continue;
              coreMax = Math.max(coreMax, Math.abs(u.value.length() / lift - 1) / cellSide);
            }
          }
        }
        if (plasma) {
          for (const pl of plasma) {
            if (!pl.pts.visible) continue;
            seenPlume++;
            for (let j = 0; j < PLASMA.points; j++) {
              const m = Math.hypot(pl.pos[j * 3], pl.pos[j * 3 + 1], pl.pos[j * 3 + 2]);
              plumeMax = Math.max(plumeMax, Math.abs(m / lift - 1) / cellSide);
            }
          }
        }
        return { coreMax, plumeMax, seenCore, seenPlume };
      };
      // hold the trigger until the tubes lock: that duration IS the burst
      for (let i = 0; i < 60 * 12 && !laserOverheat; i++) {
        updateLasers(step, i * step);
        rise += step;
        peakSeen = Math.max(peakSeen, laserHeat / LASER_MAX_HEAT);
        // 2s in: the bell is well up and the beam is unambiguously drawn
        if (i === 120) arcSample = sampleArc();
      }
      keys.laser = false;
      // ...then release and time the lockout
      for (let i = 0; i < 60 * 20 && laserOverheat; i++) {
        updateLasers(step, 100 + i * step);
        fell += step;
      }
      const okBurst = Math.abs(rise - LASER_MAX_HEAT) < 0.2;
      const okCool = Math.abs(fell - LASER_LOCKOUT) < 0.25;
      console.log(`BEAMFIRE burst=${rise.toFixed(2)}s want ${LASER_MAX_HEAT}`
        + ` ${okBurst ? 'PASS' : 'FAIL'}`
        + ` | cooldown=${fell.toFixed(2)}s want ~${LASER_LOCKOUT} ${okCool ? 'PASS' : 'FAIL'}`
        + ` | peak=${peakSeen.toFixed(2)}`);

      // THE COLOUR, read off the LIVE uniform rather than off the table it
      // came from. The table is already Node-tested; what is untested by
      // anything but this line is whether applyBeamRank ever reached the
      // material — and a beam wearing the wrong rank is invisible to every
      // other probe here, because burst, cooldown and pierce all pass in any
      // colour. Pair it with ?rank=N.
      {
        const bmC = tankBeams && tankBeams[0] && tankBeams[0].uniforms.uGlowColor;
        const want = new THREE.Color(beamStepNow.color);
        const got = bmC && bmC.value;
        const okCol = !!got && Math.abs(got.r - want.r) < 1e-3
          && Math.abs(got.g - want.g) < 1e-3 && Math.abs(got.b - want.b) < 1e-3;
        console.log(`BEAMFIRE color=${okCol ? 'PASS' : got ? 'FAIL' : 'INCONCLUSIVE (no beam built)'}`
          + ` rank=${tankRank} step=${beamStepNow.name} want=${beamStepNow.color}`
          + `${got ? ` got=#${got.getHexString()}` : ''}`
          + ` | reach=${LASER_REACH} cells dps=${LASER_DPS}`);
      }

      // DOES IT HUG THE GROUND? The whole point of the arc pass, and the one
      // thing a screenshot argues about and a number does not. Altitude is
      // measured off the drawn vertices themselves — the core links' live
      // endpoint uniforms and every plume dot — divided back out by the lift
      // the renderer applies, so 0 means "on the surface".
      {
        // what the SAME reach would have done as a straight chord, which is
        // what shipped until now — the comparison IS the finding
        const sArc = LASER_REACH * cellSide;
        const wasCells = (Math.sqrt(1 + sArc * sArc) - 1) / cellSide;
        if (!arcSample || !arcSample.seenCore) {
          console.log('ARCPROBE core-hugs=INCONCLUSIVE (no beam was drawn during'
            + ` the burst: core meshes visible=${arcSample ? arcSample.seenCore : 'never sampled'})`);
        } else {
          const okCore = arcSample.coreMax < 0.1;
          console.log(`ARCPROBE core-hugs=${okCore ? 'PASS' : 'FAIL'}`
            + ` max core altitude ${arcSample.coreMax.toFixed(3)} cells (want <0.1)`
            + ` over ${arcSample.seenCore} links`
            + ` | plume ${arcSample.seenPlume ? `spreads ${arcSample.plumeMax.toFixed(2)} cells` : 'NOT DRAWN'}`
            + ` | the old straight chord flew ${wasCells.toFixed(2)} cells at this reach`
            + ` | rank=${tankRank} reach=${LASER_REACH} tank=${creatureGeo ? 'dot-cloud fallback' : 'mesh'}`);
        }
      }

      // PIERCING: line three live enemies up along one beam and check the far
      // ones take damage too. The old bolts stopped at the first.
      const live = enemies.filter((e) => e.alive).slice(0, 3);
      if (live.length < 2) { console.log('BEAMFIRE pierce=INCONCLUSIVE (need 2+ live enemies)'); return; }
      const gunsNow = playerMesh && playerMesh.userData.laserGuns;
      if (!gunsNow || !gunsNow.length) { console.log('BEAMFIRE pierce=INCONCLUSIVE (no guns)'); return; }
      gunsNow[0].getWorldPosition(tmpV);
      const from = norm3([tmpV.x, tmpV.y, tmpV.z]);
      gunsNow[0].getWorldQuaternion(tmpQ);
      tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
      const d0 = [tmpV.x, tmpV.y, tmpV.z];
      const dir = norm3(sub3(d0, scale3(from, dot3(d0, from))));
      // stand them in a row down the beam
      live.forEach((e, k) => { e.pos = norm3(add3(from, scale3(dir, cellSide * (0.7 + k * 0.7)))); });
      const before = live.map((e) => e.hp);
      laserHeat = 0; laserOverheat = false; keys.laser = true;
      for (let i = 0; i < 30; i++) updateLasers(step, 200 + i * step);
      keys.laser = false;
      const hit = live.map((e, k) => e.hp < before[k]);
      // THE CHOKE: does the beam SHORTEN against bodies, and does something
      // behind armour actually go unreached? Piercing that costs nothing is
      // the overpowered version; this measures the price.
      {
        const gunsC = playerMesh && playerMesh.userData.laserGuns;
        const liveC = enemies.filter((e) => e.alive);
        const hardC = liveC.filter((e) => !e.spec.rammable);
        if (gunsC && gunsC.length && hardC.length >= 3) {
          const g6 = gunsC[0];
          g6.getWorldPosition(tmpV);
          const f5 = norm3([tmpV.x, tmpV.y, tmpV.z]);
          g6.getWorldQuaternion(tmpQ);
          tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
          const d5 = norm3(sub3([tmpV.x, tmpV.y, tmpV.z],
            scale3(f5, dot3([tmpV.x, tmpV.y, tmpV.z], f5))));
          // park everything out of the way, then queue three solid cores up
          // the beam with the LAST one just inside the clear-air reach
          for (const e of liveC) e.pos = norm3(add3(player.pos, [0.6, 0.6, 0.6]));
          const at = [0.5, 1.1, 1.9];
          hardC.slice(0, 3).forEach((e, k) => {
            e.hp = 9e9;
            e.pos = norm3(add3(f5, scale3(d5, cellSide * at[k])));
          });
          const last = hardC[2];
          const hp0 = last.hp;
          laserHeat = 0; laserOverheat = false; beamOn = false;
          keys.laser = true;
          for (let i = 0; i < 60; i++) updateLasers(1 / 60, 400 + i / 60);
          keys.laser = false;
          const reached = last.hp < hp0;
          // 3 hard bodies cost 3.3 cells of a 2.6 cell reach: the third is
          // past the end of what is left and must never be touched
          console.log(`BEAMFIRE choke=${!reached ? 'PASS' : 'FAIL'}`
            + ` (three solid cores at ${at.join('/')} cells;`
            + ` the one at ${at[2]} must be UNREACHED — PEN_HARD=${PEN_HARD().toFixed(2)}`
            + ` eats the 2.6-cell reach)`);
          // park them, do NOT kill them: the drag check below needs live
          // bodies, and the first cut of this tidied up by killing everything
          // and turned the next check INCONCLUSIVE
          for (const e of liveC) e.pos = norm3(add3(player.pos, [0.6, 0.6, 0.6]));
        } else console.log('BEAMFIRE choke=INCONCLUSIVE (need 3 unrammable enemies)');
      }

      // DRAG: does a solid core bog the beam harder than soft fodder, and do
      // the two beams genuinely decouple? Run the same burst twice — once
      // with the beam clear, once with a body parked in it — and compare how
      // far the sweep got. A danger readout that reads the same for both
      // tiers is not a readout.
      {
        const gunsD = playerMesh && playerMesh.userData.laserGuns;
        const liveAll = enemies.filter((e) => e.alive);
        const soft = liveAll.find((e) => e.spec.rammable);
        const hard = liveAll.find((e) => !e.spec.rammable);
        if (gunsD && gunsD.length && soft && hard) {
          const parkAt = (e, gi3, dcell) => {
            const g4 = gunsD[gi3];
            g4.getWorldPosition(tmpV);
            const f3 = norm3([tmpV.x, tmpV.y, tmpV.z]);
            g4.getWorldQuaternion(tmpQ);
            tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
            const dd = norm3(sub3([tmpV.x, tmpV.y, tmpV.z],
              scale3(f3, dot3([tmpV.x, tmpV.y, tmpV.z], f3))));
            e.pos = norm3(add3(f3, scale3(dd, cellSide * dcell)));
          };
          const runBurst = () => {
            laserHeat = 0; laserOverheat = false; beamOn = false;
            beamPhase[0] = 0; beamPhase[1] = 0;
            keys.laser = true;
            for (let i = 0; i < 60 * 6; i++) updateLasers(1 / 60, 300 + i / 60);
            keys.laser = false;
            return [beamPhase[0], beamPhase[1]];
          };
          // park everything far away, then bring one body into beam 0
          for (const e of liveAll) e.pos = norm3(add3(player.pos, [0.6, 0.6, 0.6]));
          const clear = runBurst()[0];
          for (const e of liveAll) e.pos = norm3(add3(player.pos, [0.6, 0.6, 0.6]));
          soft.hp = 9e9; parkAt(soft, 0, 0.8);
          const withSoft = runBurst()[0];
          for (const e of liveAll) e.pos = norm3(add3(player.pos, [0.6, 0.6, 0.6]));
          hard.hp = 9e9; parkAt(hard, 0, 0.8);
          const withHard = runBurst()[0];
          const ok = withHard < withSoft - 0.02 && withSoft <= clear + 0.001;
          console.log(`BEAMFIRE drag=${ok ? 'PASS' : 'FAIL'}`
            + ` sweep reached: clear=${clear.toFixed(2)}`
            + ` soft=${withSoft.toFixed(2)} hard=${withHard.toFixed(2)}`
            + ` (a solid core must bog it harder than fodder)`);

          // DO THE TWO BEAMS ACTUALLY FALL OUT OF STEP? Only if a body is in
          // one and not the other — and that is a GEOMETRY question, not an
          // arithmetic one. The beams converge and the enemies are wide, so a
          // single target parked ahead usually sits in BOTH. Report how many
          // beams a lone body loads, because "they desync" is a claim about
          // the board, not about the code.
          const p0 = beamPhase[0], p1 = beamPhase[1];
          const lit = [0, 1].filter((gi4) => {
            const g5 = gunsD[gi4];
            g5.getWorldPosition(tmpV);
            const f4 = norm3([tmpV.x, tmpV.y, tmpV.z]);
            g5.getWorldQuaternion(tmpQ);
            tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
            const dd2 = norm3(sub3([tmpV.x, tmpV.y, tmpV.z],
              scale3(f4, dot3([tmpV.x, tmpV.y, tmpV.z], f4))));
            const w2 = sub3(hard.pos, f4);
            const t3 = Math.max(0, Math.min(LASER_REACH * cellSide, dot3(w2, dd2)));
            const r2 = cellSide * Math.max(0.4, (hard.size ?? hard.spec.size) * 0.8);
            return dist3(add3(f4, scale3(dd2, t3)), hard.pos) < r2;
          }).length;
          console.log(`BEAMFIRE decouple beam0=${p0.toFixed(2)} beam1=${p1.toFixed(2)}`
            + ` | one body loaded ${lit} of 2 beams`
            + ` — ${lit === 2 ? 'SHARED, so the pair bogs together (expected: the'
              + ' beams converge and bodies are wide relative to the muzzle gap)'
              : 'independent, so the pair desyncs'}`);
          for (const e of liveAll) e.alive = false;   // tidy the probe's props
        } else console.log('BEAMFIRE drag=INCONCLUSIVE (need one soft and one hard enemy)');
      }

      // IS THE MODEL'S TOE EVEN REACHING THE BEAM? The beam direction is read
      // off Secondary_*_Gun_Pivot, but the toe is applied to
      // Secondary_*_Pivot — its parent. mergeByMaterial can REPARENT
      // preserved pivots, and if it did, the two are no longer related and
      // the toe is decoration.
      {
        // WHICH TANK IS THIS? headless often never finishes the mkcx load and
        // measures the PROCEDURAL fallback instead — so a reading here can be
        // about a different tank from the one the operator is playing. Say so
        // rather than let the number pass for the model's.
        const gp = playerMesh.getObjectByName('Secondary_L_Gun_Pivot');
        console.log(`BEAMFIRE tank=${gp ? 'mkcx (model pivots)' : 'procedural fallback'}`
          + ` guns=${(playerMesh.userData.laserGuns || []).length}`
          + ` SECONDARY_TOE=${SECONDARY_TOE}`);
      }

      // A WALL MUST BOG IT LIKE ARMOUR. Point him at rock and the sweep should
      // labour exactly as it does inside a solid core — otherwise firing into
      // a corner is free, which is the one place it obviously should not be.
      {
        const liveW = enemies.filter((e) => e.alive);
        for (const e of liveW) e.pos = norm3(add3(player.pos, [0.6, 0.6, 0.6]));
        const sweepFrom = (place) => {
          place();
          // the probe drives updateLasers directly, with no render between —
          // the gun world quaternions the beam reads are only as fresh as the
          // matrices, and placeActors() writes locals, not world matrices
          if (playerMesh) playerMesh.updateMatrixWorld(true);
          laserHeat = 0; laserOverheat = false; beamOn = false;
          beamPhase[0] = 0; beamPhase[1] = 0;
          keys.laser = true;
          for (let i = 0; i < 60 * 6; i++) updateLasers(1 / 60, 500 + i / 60);
          keys.laser = false;
          return beamPhase[0];
        };
        const here = player.cur, heldHeading = player.heading.slice();
        // "open ground" was an ASSUMPTION, and a wrong one — the tank spawns
        // beside the Heart facing rock, so the baseline was ALREADY bogged and
        // the comparison read as no-difference. Go and FIND clear ground: an
        // open cell whose whole 2-hop neighbourhood is open, aimed at an open
        // neighbour, which covers the 2.6-cell reach.
        let openCell = -1, aimCell = -1;
        for (let i = 0; i < dungeon.tags.length && openCell < 0; i++) {
          if (dungeon.tags[i] === BLOCKED) continue;
          const ring1 = graph.adj[i];
          if (ring1.some((nb) => dungeon.tags[nb] === BLOCKED)) continue;
          if (!ring1.every((nb) => graph.adj[nb].every((n2) => dungeon.tags[n2] !== BLOCKED))) continue;
          openCell = i; aimCell = ring1[0];
        }
        if (openCell < 0) { console.log('BEAMFIRE wall=INCONCLUSIVE (no clear ground on this map)'); return; }
        beamHitWall = false;
        const clearRun = sweepFrom(() => {
          player.cur = openCell;
          player.pos = graph.centers[openCell].slice();
          player.heading = tangentDirTo(openCell, aimCell);
          placeActors();
        });
        const clearHitWall = beamHitWall;
        {
          const gW = playerMesh.userData.laserGuns[0];
          gW.getWorldPosition(tmpV);
          const fW = norm3([tmpV.x, tmpV.y, tmpV.z]);
          gW.getWorldQuaternion(tmpQ);
          tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
          const dW = norm3(sub3([tmpV.x, tmpV.y, tmpV.z], scale3(fW, dot3([tmpV.x, tmpV.y, tmpV.z], fW))));
          const walk = [];
          for (let m = cellSide * 0.5; m <= cellSide * LASER_REACH; m += cellSide * 0.5) {
            const ci = cellIndex(norm3(add3(fW, scale3(dW, m))));
            walk.push(ci === -1 ? 'off' : (dungeon.tags[ci] === BLOCKED ? 'ROCK' : 'open'));
          }
          console.log(`BEAMFIRE walk from cell ${openCell} (all-open 2-hop): ${walk.join(' ')}`
            + ` | gunCell=${cellIndex(fW)} standCell=${player.cur}`);
        }
        // now stand him against a wall and aim into it
        let wallCell = -1;
        for (let i = 0; i < dungeon.tags.length && wallCell < 0; i++) {
          if (dungeon.tags[i] !== BLOCKED) continue;
          if (graph.adj[i].some((nb) => dungeon.tags[nb] !== BLOCKED)) wallCell = i;
        }
        let wallRun = clearRun, wallHitWall = false;
        if (wallCell >= 0) {
          beamHitWall = false;
          const open = graph.adj[wallCell].find((nb) => dungeon.tags[nb] !== BLOCKED);
          wallRun = sweepFrom(() => {
            player.cur = open;
            player.pos = graph.centers[open].slice();
            player.heading = tangentDirTo(open, wallCell);
            placeActors();
          });
          wallHitWall = beamHitWall;
        }
        player.cur = here; player.heading = heldHeading;
        // clipping rock at the far tip is the NORMAL case on this map, so it
        // cannot veto the baseline — what must differ is how hard the rock
        // bites, which is exactly what the sweep records.
        const verdict = !wallHitWall ? 'INCONCLUSIVE (never actually faced rock)'
          : wallRun < clearRun - 0.05 ? 'PASS' : 'FAIL';
        console.log(`BEAMFIRE wall=${verdict}`
          + ` sweep reached: baseline=${clearRun.toFixed(2)} (hit rock: ${clearHitWall})`
          + ` into a wall=${wallRun.toFixed(2)} (hit rock: ${wallHitWall})`
          + ` — rock must labour it like a solid core`);
      }

      // THE SWEEP: does the pair actually scissor, and inward? Sample the two
      // beam directions across the burst and watch the angle between them.
      // Parallel at the ends, narrowest at the midpoint, and narrowing (not
      // widening) is what "inward" means — a sign error would still sweep.
      {
        const dirAt = (gi2, hf) => {
          laserHeat = hf * LASER_MAX_HEAT;
          const g3 = playerMesh.userData.laserGuns[gi2];
          g3.getWorldPosition(tmpV);
          const f2 = norm3([tmpV.x, tmpV.y, tmpV.z]);
          g3.getWorldQuaternion(tmpQ);
          tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
          let d2 = norm3(sub3([tmpV.x, tmpV.y, tmpV.z],
            scale3(f2, dot3([tmpV.x, tmpV.y, tmpV.z], f2))));
          const sw = BEAM_SWEEP * Math.sin(Math.min(1, hf) * Math.PI);
          if (sw > 1e-4) {
            const lat = sub3(f2, player.pos);
            const latT = sub3(lat, scale3(f2, dot3(lat, f2)));
            const rg = norm3(cross3(f2, d2));
            const sg = dot3(latT, rg) > 0 ? -1 : 1;
            d2 = norm3(add3(scale3(d2, Math.cos(sw)), scale3(rg, Math.sin(sw) * sg)));
          }
          return { f: f2, d: d2 };
        };
        // WHERE THEY CROSS, not how far apart they end up. The guns are
        // already toed in, so the pair crosses before full reach even at
        // sweep 0 — and past the crossing the separation grows again whether
        // the sweep turns them in OR out. Measuring the far end therefore
        // reports FAIL for both signs, which is exactly what it did. The
        // honest signal is the distance at which they are closest: sweeping
        // inward brings the crossing NEARER the tank.
        // Distance AND gap. "Closest at 0" is also what DIVERGING looks
        // like — the muzzles are then the nearest the beams ever get — so a
        // location alone passes a fan-out trivially. The pair must actually
        // MEET: minimum gap near zero, at a positive distance.
        const crossAt = (hf) => {
          const A = dirAt(0, hf), B = dirAt(1, hf);
          let best = Infinity, at = 0;
          const reach2 = LASER_REACH * cellSide;
          for (let i = 0; i <= 300; i++) {
            const d3 = (i / 300) * reach2;
            const gp = dist3(add3(A.f, scale3(A.d, d3)), add3(B.f, scale3(B.d, d3)));
            if (gp < best) { best = gp; at = d3; }
          }
          return { at: at / cellSide, gap: best / cellSide };
        };
        const c0 = crossAt(0.02), cM = crossAt(0.5), c1 = crossAt(0.98);
        const meets = cM.gap < 0.05 && cM.at > 0.05;     // really crosses, ahead
        const nearer = cM.at < c0.at * 0.9 && cM.at < c1.at * 0.9;
        console.log(`BEAMFIRE sweep=${meets && nearer ? 'PASS' : 'FAIL'}`
          + ` crossing start=${c0.at.toFixed(2)} mid=${cM.at.toFixed(2)}`
          + ` end=${c1.at.toFixed(2)} cells`
          + ` | gap at mid=${cM.gap.toFixed(3)} cells`
          + ` (must MEET ahead of the tank, nearer at the midpoint)`);
        laserHeat = 0;
      }

      console.log(`BEAMFIRE pierce=${hit.every(Boolean) ? 'PASS' : 'FAIL'}`
        + ` (${hit.map((h, k) => `#${k}:${h ? 'burned' : 'untouched'}`).join(' ')})`
        + ` — the old bolts stopped at the first`);
    })();
  }

  // ?heartprobe=1 — WHAT IS ACTUALLY STANDING AT THE POLE. Headless crops, so
  // a screenshot cannot answer whether the Terraformer loaded, how big it is
  // on the board, or whether it is the fallback cloud wearing its name.
  // Rectangles can.
  if (urlParams.get('heartprobe') === '1') {
    let tries = 0;
    const run = () => {
      const isTerra = heartSprite && heartSprite.type === 'Group';
      if (!isTerra && params.heartLook === 'terraformer' && tries++ < 200) {
        setTimeout(run, 25); return;      // bytes still in flight
      }
      placeActors();                       // seat and scale it as the board does
      heartSprite.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(heartSprite);
      const size = new THREE.Vector3(); box.getSize(size);
      let meshes = 0, named = [];
      heartSprite.traverse((o) => {
        if (o.isMesh) meshes++;
        if (/Carriage|Mast|Arm_|Nozzle|Silo/.test(o.name || '')) named.push(o.name);
      });
      const span = Math.max(size.x, size.y, size.z);
      console.log(`HEARTPROBE look=${params.heartLook}`
        + ` node=${heartSprite.type} meshes=${meshes}`
        + ` span=${(span / cellSide).toFixed(2)}cells`
        + ` sizeScale=${(heartSprite.userData.sizeScale / cellSide).toFixed(2)}`
        + ` hasTick=${typeof heartSprite.userData.tick === 'function'}`
        + ` hasHit=${typeof heartSprite.userData.hit === 'function'}`
        + ` pivots=${named.length}`);
      // the contract the registry promises — exercised, not assumed
      let threw = '';
      try { heartSprite.userData.tick(3.2); heartSprite.userData.hit();
            heartSprite.userData.tick(3.3); } catch (e) { threw = String(e); }
      console.log(`HEARTPROBE contract=${threw ? 'FAIL ' + threw : 'PASS'}`
        + ` (tick + hit + tick survive)`);

      // DOES IT STILL STAND ON THE SHELL AFTER TICKING? The first cut wrote
      // g.rotation.z inside tick(), and in three.js writing rotation replaces
      // the quaternion outright — so every frame discarded the normal
      // alignment and the machine leaned over, pad on edge. Upright at the
      // pole and wrong everywhere else is invisible to a probe that only
      // checks the pole, so this compares the object's own up-axis against
      // the shell normal at its cell, AFTER a tick and a hit.
      // ACTIVITY IS SUPPOSED TO BE INTERMITTENT. A screensaver and a working
      // machine both "move"; the difference is whether they ever REST. Sample
      // each pivot across two minutes and report how much of that time it is
      // actually moving — low duty with real range is the shape wanted.
      if (params.heartLook === 'terraformer') {
        const track = { Travel_Carriage: 'position.z', Traverse_Carriage: 'position.x',
          Mast_Stage_2: 'position.y', Arm_Swing: 'rotation.y',
          Arm_Elbow: 'rotation.x', Arm_Wrist: 'rotation.x' };
        const read = (o, path) => path.split('.').reduce((a2, k) => a2[k], o);
        const seen = {};
        for (const k of Object.keys(track)) seen[k] = [];
        for (let i = 0; i < 1200; i++) {
          heartSprite.userData.tick(i * 0.1);
          for (const [name, path] of Object.entries(track)) {
            const o = heartSprite.getObjectByName(name);
            if (o) seen[name].push(read(o, path));
          }
        }
        for (const [name, vals] of Object.entries(seen)) {
          if (!vals.length) { console.log(`HEARTPROBE motion ${name}=ABSENT`); continue; }
          const mn = Math.min(...vals), mx = Math.max(...vals);
          const span2 = mx - mn;
          // "moving" = meaningfully away from its REST value this frame, and
          // rest is the MEDIAN — not the value nearest zero, which was the
          // first cut and read the elbow as 97% busy purely because it rests
          // at a slight bend rather than at 0. With a low duty the median IS
          // the resting pose, by definition.
          const restV = [...vals].sort((a2, b2) => a2 - b2)[Math.floor(vals.length / 2)];
          const busy = vals.filter((v) => Math.abs(v - restV) > span2 * 0.08).length / vals.length;
          console.log(`HEARTPROBE motion ${name} range=${span2.toFixed(3)}`
            + ` duty=${(busy * 100).toFixed(0)}%`
            + ` ${span2 > 1e-4 && busy > 0.02 && busy < 0.6 ? 'OK' : 'CHECK'}`);
        }
      }

      const hn2 = graph.normals[dungeon.heart];
      const up = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(heartSprite.getWorldQuaternion(new THREE.Quaternion()));
      const align = up.x * hn2[0] + up.y * hn2[1] + up.z * hn2[2];
      console.log(`HEARTPROBE upright=${align > 0.999 ? 'PASS' : 'FAIL'}`
        + ` (up . normal = ${align.toFixed(4)}, want 1.0000)`);
    };
    run();
  }

  // ?droneprobe=1 — DOES W FLY ISAO TOWARDS THE SCREEN?
  // Operator: forward is back and sideways does nothing. Control and camera
  // must share one notion of "forward", so this measures them against each
  // other: fly him a step, take the camera's actual forward FROM its
  // quaternion (never re-derived — the standing rule in this repo), flatten
  // both onto the tangent plane and compare. +1 is agreement, -1 is inverted,
  // ~0 is the camera pointing somewhere unrelated to the stick.
  if (urlParams.get('droneprobe') === '1') {
    (async () => {
      await spawnIsao();
      if (!isao) { console.log('DRONEPROBE inconclusive=no isao'); return; }
      setView('drone');
      // ISOLATE THE DRONE CAMERA. updateCameraGoal answers shots and DEPLOY
      // first, and the probe never runs animate, so DEPLOY was still live and
      // every reading came from the deploy blend instead of the drone branch.
      endShot();
      deploy = null;
      const camFwdTangent = () => {
        updateCameraGoal();
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camGoal.quat); // cameras look down -Z
        const up = isao.dir;
        const d = [f.x, f.y, f.z];
        const t = sub3(d, scale3(up, dot3(d, up)));
        const l = len3(t);
        return l > 1e-6 ? scale3(t, 1 / l) : null;
      };
      const run = (label, k) => {
        keys.fast = keys.slow = keys.left = keys.right = false;
        keys[k] = true;
        const before = isao.dir.slice();
        const camF = camFwdTangent();
        for (let i = 0; i < 10; i++) pilotIsao(0.05);
        const moved = sub3(isao.dir, before);
        const ml = len3(moved);
        keys[k] = false;
        if (!camF || ml < 1e-9) return `${label}=NOMOVE`;
        const agree = dot3(scale3(moved, 1 / ml), camF);
        return `${label}=${agree.toFixed(2)}`;
      };
      // DOES HE FLY LIKE A DRONE? Facing must follow the heading (the bug was
      // that it followed nothing at all), the body must lean into the demand,
      // and space/shift must climb.
      {
        const nose = () => new THREE.Vector3(0, 0, 1)
          .applyQuaternion(isao.obj.getWorldQuaternion(new THREE.Quaternion()));
        const level = () => {
          keys.fast = keys.slow = keys.left = keys.right = false;
          for (let i = 0; i < 90; i++) pilotIsao(0.05);
        };
        level();
        const restNose = nose();
        const restUp = new THREE.Vector3(0, 1, 0)
          .applyQuaternion(isao.obj.getWorldQuaternion(new THREE.Quaternion()));
        // FACING: the nose must lie along the heading, not somewhere stale
        const hd = new THREE.Vector3(...isaoHeading);
        const faces = restNose.dot(hd);

        // LEAN: hold W and the nose must tip DOWN relative to the local up
        keys.fast = true;
        for (let i = 0; i < 40; i++) pilotIsao(0.05);
        const leanNose = nose();
        keys.fast = false;
        const tipped = leanNose.dot(restUp) - restNose.dot(restUp);

        // CLIMB: space must gain altitude, shift must lose it
        level();
        const a0 = isaoAlt;
        keys.droneUp = true; for (let i = 0; i < 20; i++) pilotIsao(0.05); keys.droneUp = false;
        const a1 = isaoAlt;
        keys.droneDown = true; for (let i = 0; i < 40; i++) pilotIsao(0.05); keys.droneDown = false;
        const a2 = isaoAlt;
        level();

        console.log(`DRONEPROBE facing=${faces > 0.99 ? 'PASS' : 'FAIL'}`
          + ` (nose . heading = ${faces.toFixed(4)}, want 1.0000)`);
        // REST TILT AND ADDED LEAN, separately. The first cut ran asin() over
        // the DIFFERENCE of two dot products, which is not a sine of
        // anything — it read 52 deg at ISAO_LEAN 0.42 and 37.6 at 0.16, a
        // constant offset that is really the MODEL's own pose: this drone is
        // authored nose-down, the way it hangs over a workpiece. The lean the
        // code adds is the second number, and it is the only one tunable.
        // AGAINST HIS CURRENT LOCAL UP, not a stale one. He flies forward for
        // two seconds during this test and the board is a sphere, so the up
        // captured before the run belongs to a different point on it — that
        // curvature was landing in the answer and inflating a 9 degree demand
        // into 37. Measure the tilt where he actually is.
        const ang = (v, upVec) =>
          Math.asin(Math.max(-1, Math.min(1, -v.dot(upVec)))) * 57.2958;
        const restDeg = ang(restNose, restUp);
        const leanUp = new THREE.Vector3(...isao.dir);
        const leanDeg = ang(leanNose, leanUp);
        console.log(`DRONEPROBE lean=${tipped < -0.05 ? 'PASS' : 'FAIL'}`
          + ` rest pose=${restDeg.toFixed(1)} deg (the model's own)`
          + ` -> under W ${leanDeg.toFixed(1)} deg`
          + ` = ${(leanDeg - restDeg).toFixed(1)} deg of added lean`
          + ` at ISAO_LEAN=${ISAO_LEAN}`);
        console.log(`DRONEPROBE climb=${a1 > a0 + 0.1 && a2 < a1 - 0.1 ? 'PASS' : 'FAIL'}`
          + ` (alt ${a0.toFixed(2)} -> space ${a1.toFixed(2)} -> shift ${a2.toFixed(2)})`);
      }

      const fwd = run('W', 'fast');
      const back = run('S', 'slow');
      // and does steering actually swing the view?
      keys.left = true;
      const c0 = camFwdTangent();
      for (let i = 0; i < 10; i++) pilotIsao(0.05);
      keys.left = false;
      const c1 = camFwdTangent();
      const swung = c0 && c1 ? Math.acos(Math.max(-1, Math.min(1, dot3(c0, c1)))) : 0;
      // THE PREDICTION: if the camera ignores the pilot's heading, then after
      // steering a half-turn, W must move him AWAY from the screen. Turning
      // the operator's "forward = back" into something falsifiable.
      keys.right = true;
      for (let i = 0; i < 40; i++) pilotIsao(0.05);   // swing him around
      keys.right = false;
      const afterTurn = run('W-after-turn', 'fast');
      const fv = parseFloat(fwd.split('=')[1]);
      console.log(`DRONEPROBE ${fwd} ${back} ${afterTurn}`
        + ` camera-swing=${(swung * 57.3).toFixed(1)}deg`
        + ` => forward=${fv > 0.8 ? 'PASS' : 'FAIL'}`
        + ` after-turn=${parseFloat(afterTurn.split('=')[1]) > 0.8 ? 'PASS' : 'FAIL'}`
        + ` steering=${swung > 0.1 ? 'PASS' : 'FAIL'}`);
    })();
  }

  // ?gestureprobe=1 — DOES THE FIRST GESTURE REACH THE AUDIO UNLOCK?
  // The context can only be born on a user gesture, and audio.js listens on
  // window in the BUBBLE phase. A shot's skip handlers sit in CAPTURE and
  // call stopImmediatePropagation, so this asks the only question that
  // matters: with a shot running, does a gesture still get through?
  if (urlParams.get('gestureprobe') === '1') {
    let tries = 0;
    const run = () => {
      if (!active && tries++ < 200) { setTimeout(run, 25); return; }
      dismissIntro();
      if (msgEl && !msgEl.classList.contains('hidden')) {
        paused = false; msgEl.classList.add('hidden');
      }
      // stand-ins registered exactly the way audio.js registers its own
      let gotKey = 0, gotTap = 0;
      const onKey = () => { gotKey++; };
      const onTap = () => { gotTap++; };
      for (const [ev, fn] of [['keydown', onKey], ['pointerdown', onTap]]) {
        window.addEventListener(ev, fn, { passive: true, capture: true });
      }
      const fire = () => {
        document.body.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'w', bubbles: true, cancelable: true }));
        // dispatched INSIDE root — that is where a real tap lands, and where
        // a shot's pointerdown skip handler is listening
        root.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      };
      endShot();
      fire();
      const baseK = gotKey, baseT = gotTap;
      startShot({
        id: 'probe-gesture',
        dur: 99,
        poseAt: (u, out) => { out.pos.copy(camera.position); out.quat.copy(camera.quaternion); },
      });
      fire();
      const duringK = gotKey - baseK, duringT = gotTap - baseT;
      endShot();
      for (const [ev, fn] of [['keydown', onKey], ['pointerdown', onTap]]) {
        window.removeEventListener(ev, fn, true);
      }
      ctlRawT = -9;
      console.log(`GESTUREPROBE idle key=${baseK} tap=${baseT}`
        + ` | during-shot key=${duringK} tap=${duringT}`
        + ` => ${duringK && duringT ? 'PASS' : 'FAIL'} (audio unlock must hear both)`);
    };
    run();
  }

  // ?printprobe=1 — ISAO'S PRINT BEAM, swept across a full pattern cycle.
  // The path maths is Node-tested in printpath.mjs; what this checks is the
  // WIRING: that the head actually moves over the cell (the bed points
  // spread, rather than all landing on one dot the way the old straight
  // beam did) and that the beam blanks during retractions and travel moves.
  if (urlParams.get('printprobe') === '1') {
    (async () => {
      await spawnIsao();
      eco.addBiomass(starterTower().cost);
      for (let ci = 0; ci < dungeon.tags.length; ci++) {
        if (!placeError(ci) && !orderByCell.has(ci)) { orderTower(starterTower().key, ci); break; }
      }
      // tick until he is actually printing, rather than guessing a number
      let guard = 0;
      while (isao && isao.state !== 'build' && guard++ < 4000) updateIsao(0.02);
      if (!isao || isao.state !== 'build') {
        console.log('PRINTPROBE inconclusive=never reached build state'); return;
      }
      const seen = new Set();
      let offs = 0, spreadMax = 0;
      // sample across three pattern slices, well inside the build
      for (let i = 0; i < 90; i++) {
        updateIsao(0.05);
        if (!printBeam || isao.state !== 'build') break;
        const ph = printPhase(isao.t, patternSecsFor(isao.dur));
        seen.add(ph.pattern);
        if (!printBeam.visible) offs++;
        const pa2 = printBeam.geometry.attributes.position;
        let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
        for (let k = 1; k < pa2.count; k++) {
          mnX = Math.min(mnX, pa2.getX(k)); mxX = Math.max(mxX, pa2.getX(k));
          mnY = Math.min(mnY, pa2.getY(k)); mxY = Math.max(mxY, pa2.getY(k));
        }
        spreadMax = Math.max(spreadMax, Math.hypot(mxX - mnX, mxY - mnY) / cellSide);
      }
      const all = ['zigzag', 'spiral', 'blink'].every((k) => seen.has(k));
      console.log(`PRINTPROBE patterns=${all ? 'PASS' : 'FAIL'} (${[...seen].join('+')})`
        + ` blanks=${offs > 0 ? 'PASS' : 'FAIL'} (${offs} frames off)`
        + ` head-moves=${spreadMax > 0.05 ? 'PASS' : 'FAIL'} (max spread ${spreadMax.toFixed(3)} cells)`);
    })();
  }

  const orderSpec = urlParams.get('order');
  const isaoN = parseFloat(urlParams.get('isao') || urlParams.get('bobby') || '0');
  if (orderSpec || isaoN > 0) {
    (async () => {
      await spawnIsao();
      // the view override is re-applied HERE because ?view=drone is asked
      // for before his bytes have landed, and a probe that ticks his shift
      // from the orbit camera is measuring the wrong camera
      if (urlParams.get('view') === 'drone') setView('drone');
      if (orderSpec) {
        for (const key of orderSpec.split(',')) {
          if (!TOWER_BY_KEY[key]) continue;
          eco.addBiomass(TOWER_BY_KEY[key].cost);   // the hook pays its own way
          for (let ci = 0; ci < dungeon.tags.length; ci++) {
            if (!placeError(ci) && !orderByCell.has(ci)) { orderTower(key, ci); break; }
          }
        }
      }
      for (let sT = 0; sT < isaoN; sT += 0.05) updateIsao(0.05);
      const o = orders[0];
      if (isao) {
        snapCamera();
        console.log(`ISAOCAM view=${params.view}`
          + ` isao=${isao.obj.position.toArray().map((v) => v.toFixed(3)).join(',')}`
          + ` cam=${camera.position.toArray().map((v) => v.toFixed(3)).join(',')}`
          + ` dist=${camera.position.distanceTo(isao.obj.position).toFixed(3)}`
          + ` cellSide=${cellSide.toFixed(3)}`);
      }
      // the beam is the thing being verified here: is the head MOVING (bed
      // points spread out, not one repeated dot) and does it blank
      if (printBeam && isao) {
        const ph = printPhase(isao.t, patternSecsFor(isao.dur));
        const pa2 = printBeam.geometry.attributes.position;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let k = 1; k < pa2.count; k++) {
          minX = Math.min(minX, pa2.getX(k)); maxX = Math.max(maxX, pa2.getX(k));
          minY = Math.min(minY, pa2.getY(k)); maxY = Math.max(maxY, pa2.getY(k));
        }
        const spread = Math.hypot(maxX - minX, maxY - minY);
        console.log(`PRINTBEAM pattern=${ph.pattern} u=${ph.u.toFixed(2)}`
          + ` on=${printBeam.visible} pts=${pa2.count}`
          + ` spread=${(spread / cellSide).toFixed(3)}cells`);
      }
      console.log(`ISAO state=${isao ? isao.state : 'absent'}`
        + ` queue=${orders.length} live=${o ? (o.key || 'upgrade') + '@' + o.ci : '-'}`
        + ` t=${isao ? isao.t.toFixed(2) : '-'}/${isao ? isao.dur.toFixed(2) : '-'}`
        + ` built=${towers.length}`);
      snapCamera();
    })();
  }

  // ?towertier=1|2|3 pins the Workshop equipment tier the board draws, for
  // looking at one tier everywhere. Unpinned, a tower wears the tier it has
  // actually been upgraded to, which is the point.
  {
    const t = parseInt(urlParams.get('towertier'), 10);
    if (t >= 1 && t <= 3) setSentryTier(t);
  }

  // PRELOAD THE LOOK AT BOOT. applyTowerLook() was reachable only from the
  // panel and from ?towerlook=, so a board whose DEFAULT look has async
  // assets never started the load at all: every tower built came up as the
  // loading marker and nothing ever rebuilt it. Harmless while the default
  // was procedural; required for authored models.
  applyTowerLook();

  // AFTER ?tower= on purpose: this then exercises the live applyTowerLook()
  // swap over existing towers, not just build-time selection.
  const towerLookOv = urlParams.get('towerlook');
  if (TOWER_LOOK_NAMES.includes(towerLookOv)) {
    params.towerLook = towerLookOv;
    towerLookCtrl.updateDisplay(); // or the panel lies about what is on screen
    applyTowerLook();
  }

  // ?reveal=1 fires a sector-2 expansion immediately (headless check of
  // the full-planet reveal beat)
  if (urlParams.get('reveal') === '1') { round = 2; expandRound(); }

  // ?shop=ci opens the radial on that cell, screen-centered (headless check)
  const shopN = parseInt(urlParams.get('shop') || '-1', 10);
  if (shopN >= 0) openShop(shopN);

  // ?recoil=1 freezes a mid-recoil pose (turret back, hull rocked) so the
  // kick can be screenshot; the sim pauses to hold it
  if (urlParams.get('recoil') === '1') {
    recoilLeft = recoilLen() * 0.75;
    cannonHeat = CANNON_COOL;
    placeActors();
    paused = true;
  }

  // ?blast=N breaches the N wall cells nearest the player — exercises the
  // carve + debris + rebuild path without needing a live shot
  // ?lose=1 kills the tank on the spot, so the wreck can be screenshot
  if (urlParams.get('lose') === '1') loseGame('debug');
  // ?ctlprobe=1 — the reset seam, made deterministic. Lose a tank (which
  // arms the DEATH_HOLD respawn), then RETRY inside that hold, exactly as a
  // player jabbing the button does. The question the log answers is whether
  // the dead run's timer still lands on the live one: a respawn:tank-lost
  // printed AFTER regenerate:after is a repositioning nobody asked for, on
  // a run that has not lost anything.
  // Does a real keydown still reach the game? Shared by every probe that
  // asks it, so the reasoning below lives in exactly one place.
  //
  // DISPATCH ON A DESCENDANT, NOT ON WINDOW. A keydown aimed straight at
  // window makes window the TARGET, and at-target listeners run in
  // registration order with the capture flag IGNORED — which puts the game's
  // own handler (registered at init) ahead of a shot's capture handler
  // (registered later) and reverses the very ordering under test. A real key
  // travels capture -> target -> bubble; so must this.
  function probeKeyReaches() {
    keys.fast = false;
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'w', bubbles: true, cancelable: true }));
    const reached = keys.fast;
    keys.fast = false;
    ctlRawT = -9;   // the synthetic press must not trip the live watchdog
    return reached;
  }

  // ?deployprobe=1 — THE CONSISTENCY QUESTION, made a check. The operator's
  // report was that every reset produced a different opening state; this
  // walks the reset paths in turn and asserts each lands in the SAME shape:
  // the berth its hull count names, heading down that berth's own exit, auto
  // off, cruise off. Then it runs the beat to completion and checks the hull
  // actually left the box, which is what "ENTIRELY OUT" was pointing at.
  if (urlParams.get('deployprobe') === '1') {
    const rows = [];
    const shape = (tag) => {
      const n = berthIndexFor(playerHP);
      const b = berths[n];
      const good = !!b && player.cur === b.ci && player.next === b.exit
        && !autoMode && !cruise;
      rows.push(`${tag}: berth=#${n + 1} cur=${player.cur} want=${b ? b.ci : -1}`
        + ` exit_ok=${!!b && player.next === b.exit}`
        + ` auto=${autoMode} cruise=${cruise} ${good ? 'ok' : 'BAD'}`);
      return good;
    };
    let ok = shape('fresh-load');
    regenerate();               ok = shape('regenerate') && ok;
    playerHP = 2; deployStart(berthIndexFor(playerHP)); ok = shape('hull-2') && ok;
    playerHP = 1; deployStart(berthIndexFor(playerHP)); ok = shape('hull-1') && ok;
    // and the beat itself: drive it to the end, check the hull is out
    playerHP = PLAYER_MAX;
    deployStart(berthIndexFor(playerHP));
    const b0 = berths[berthIndexFor(playerHP)];
    for (let i = 0; i < 600 && deployActive(); i++) deployStep(0.05);
    const out = !!b0 && player.cur === b0.exit && !deployActive()
      && !autoMode && !cruise && throttle === 0;
    rows.forEach((r) => console.log(`DEPLOYPROBE ${r}`));
    console.log(`DEPLOYPROBE shape=${ok ? 'PASS' : 'FAIL'}`
      + ` entirely-out=${out ? 'PASS' : 'FAIL'}`
      + ` (ended at ${player.cur}, wanted ${b0 ? b0.exit : -1},`
      + ` deploying=${deployActive()} auto=${autoMode} cruise=${cruise})`);
  }

  // ?downprobe=1 — LOSING A HULL IS THREE BEATS, NOT A CUT. Asserts the
  // camera actually runs home (a 'downdash' shot exists) and that when it
  // lands the next hull is deploying from the RIGHT berth: lose one and you
  // come out of #2, as the operator specified.
  if (urlParams.get('downprobe') === '1') {
    let tries = 0;
    const run = () => {
      if (!active && tries++ < 200) { setTimeout(run, 25); return; }
      dismissIntro();
      if (msgEl && !msgEl.classList.contains('hidden')) {
        paused = false; msgEl.classList.add('hidden');
      }
      endShot();                 // clear the opening so only the dash is in play
      playerHP = PLAYER_MAX - 1; // the damage path decrements BEFORE loseTank
      loseTank();
      let waits = 0;
      const check = () => {
        if (shotId() !== 'downdash' && waits++ < 300) { setTimeout(check, 20); return; }
        const dashed = shotId() === 'downdash';
        endShot();               // run it to its end, as the frame loop would
        const n = berthIndexFor(playerHP);
        const b = berths[n];
        const ok = dashed && !!b && player.cur === b.ci && deployActive()
          && !playerDown && !autoMode && !cruise;
        console.log(`DOWNPROBE dash=${dashed ? 'PASS' : 'FAIL'}`
          + ` handoff=${ok ? 'PASS' : 'FAIL'}`
          + ` (berth #${n + 1}, cur=${player.cur}, want=${b ? b.ci : -1},`
          + ` deploying=${deployActive()}, down=${playerDown})`);
      };
      check();
    };
    run();
  }

  // ?resetprobe=1 — A RESET ENDS WHATEVER WAS RUNNING. regenerate() is on the
  // GUI and on Retry, so it can land mid-reveal; a shot that survives it keeps
  // its capture-phase skip listener registered and later fires its onEnd
  // against cells from a board that no longer exists.
  if (urlParams.get('resetprobe') === '1') {
    let tries = 0;
    const run = () => {
      if (!active && tries++ < 200) { setTimeout(run, 25); return; }
      dismissIntro();
      if (msgEl && !msgEl.classList.contains('hidden')) {
        paused = false; msgEl.classList.add('hidden');
      }
      let ended = 0;
      startShot({
        id: 'probe-reveal',
        dur: 99,          // long enough that only a reset can end it
        poseAt: (u, out) => { out.pos.copy(camera.position); out.quat.copy(camera.quaternion); },
        onEnd: () => { ended++; },
      });
      const before = shotId();
      regenerate();
      const cleared = !shotActive();
      const reached = probeKeyReaches();
      console.log(`RESETPROBE shot-torn-down=${cleared && ended === 1 && reached ? 'PASS' : 'FAIL'}`
        + ` (was '${before}', cleared ${cleared}, onEnd ${ended}x, key reached ${reached})`);
    };
    run();
  }

  // ?shotprobe=1 — THE TEARDOWN REGRESSION GUARD, for camShot itself.
  // A shot installs a capture-phase keydown handler that stops the event
  // dead. If its teardown is ever skipped, the whole keyboard dies silently
  // and the game looks like it has frozen — which is exactly what shipped
  // for a week. So: start a shot, end it the way the frame loop does (drive
  // the clock past zero, then step), and check a real key still lands.
  if (urlParams.get('shotprobe') === '1') {
    let tries = 0;
    const run = () => {
      if (!active && tries++ < 200) { setTimeout(run, 25); return; }
      // clear the opening first: the briefing legitimately holds the keyboard
      // until dismissed, and this probe is about camShot's teardown, not about
      // the modal's. Testing through a modal measures the wrong thing.
      dismissIntro();
      if (msgEl && !msgEl.classList.contains('hidden')) {
        paused = false; msgEl.classList.add('hidden');
      }
      let ended = 0;
      startShot({
        id: 'probe',
        dur: 0.05,
        poseAt: (u, out) => { out.pos.copy(camera.position); out.quat.copy(camera.quaternion); },
        onEnd: () => { ended++; },
      });
      const wasActive = shotActive();
      stepShot(0.2);   // precisely what animate does: decrement past zero
      const reached = probeKeyReaches();
      const ok = wasActive && !shotActive() && ended === 1 && reached;
      console.log(`SHOTPROBE teardown=${ok ? 'PASS' : 'FAIL'}`
        + ` (started ${wasActive}, cleared ${!shotActive()}, onEnd ${ended}x,`
        + ` key reached ${reached})`);
    };
    run();
  }

  // ?cineprobe=1 — TWO QUESTIONS ABOUT THE COLD OPEN.
  //
  // 1. CAN THE PLAYER MOVE AFTER IT. The operator's report, made a check.
  //    It cannot wait the shot out: under a virtual-time budget
  //    performance.now() does not advance, so the frame loop's dt stays ~0
  //    and the shot never ends on its own. So it reproduces the NATURAL END
  //    exactly as animate leaves it — clock past zero, then stepShot.
  // 2. IS THE LAST FRAME THE FIRST FRAME. The cinematic's final pose must BE
  //    the pose DEPLOY opens on, or the hand-off is a cut.
  if (urlParams.get('cineprobe') === '1') {
    let tries = 0;
    const run = () => {
      if (shotId() !== 'cinematic' && tries++ < 200) { setTimeout(run, 25); return; }
      if (shotId() !== 'cinematic') {
        console.log('CINEPROBE inconclusive=no cinematic started'); return;
      }
      // asked BEFORE the shot ends, while its poseAt still exists
      const n = berthIndexFor(playerHP);
      shot.poseAt(1, camB);
      deployFramePoseFor(n, camA);
      const dp = camB.pos.distanceTo(camA.pos);
      const dq = camB.quat.angleTo(camA.quat);
      const cont = dp < 1e-6 && dq < 1e-6;
      console.log(`CINEPROBE continuity=${cont ? 'PASS' : 'FAIL'}`
        + ` (pos ${dp.toExponential(2)}, angle ${dq.toExponential(2)}, want ~0)`);

      shot.left = -0.05;   // exactly what `shot.left -= dt` leaves behind
      stepShot(0);         // ...and exactly what animate calls next
      const deployed = deployActive();

      // AFTER THE INTRO MEANS AFTER ITS HANDOFF TOO. The cold open hands to
      // the briefing, which legitimately captures the keyboard until it is
      // dismissed — so testing the key the instant the shot ends tests the
      // wrong moment. Dismiss it the way a player does, then ask.
      const introUp = introEl && !introEl.classList.contains('hidden');
      dismissIntro();
      const msgUp = msgEl && !msgEl.classList.contains('hidden');
      if (msgUp) { paused = false; msgEl.classList.add('hidden'); }
      console.log(`CINEPROBE handoff-shape introUp=${introUp} briefingUp=${msgUp}`);
      const reached = probeKeyReaches();
      console.log(`CINEPROBE move-after-intro=${reached ? 'PASS' : 'FAIL'}`
        + ` (W reached the game: ${reached}, want true)`);
      console.log(`CINEPROBE handoff-ran=${deployed ? 'PASS' : 'FAIL'}`
        + ` (the cinematic must hand straight to DEPLOY, not strand it)`);
    };
    run();
  }
  if (urlParams.get('ctlprobe') === '1') {
    ctlLog('probe:start');
    loseTank();
    setTimeout(() => {
      console.log('CTL probe: RETRY pressed mid-hold');
      regenerate();
      const afterRetry = tankLostDeploys;
      // by now the dead run's DEATH_HOLD timer has had its chance. Only
      // tank-lost respawns count: the new run legitimately stages itself at
      // its berths, and a total would score that as the bug.
      setTimeout(() => {
        const crossed = tankLostDeploys - afterRetry;
        console.log(`CTLPROBE stale-death-timer=${crossed === 0 ? 'PASS' : 'FAIL'}`
          + ` (tank-lost deploys after retry: ${crossed}, want 0)`);
        ctlLog('probe:end');
      }, (DEATH_HOLD + 0.8) * 1000);
    }, 200);
  }
  const blastN = parseInt(urlParams.get('blast') || '0', 10);
  for (let i = 0; i < blastN; i++) {
    let best = -1, bd = Infinity;
    for (let ci = 0; ci < dungeon.tags.length; ci++) {
      if (dungeon.tags[ci] !== BLOCKED) continue;
      const d = dist3(player.pos, graph.centers[ci]);
      if (d < bd) { bd = d; best = ci; }
    }
    if (best === -1) break;
    blastWall(best);
  }

  // ?tick=N synchronously simulates N seconds (demo/debug — headless
  // virtual time doesn't advance performance.now, so real motion can't be
  // screenshot-verified without this). Enemies advance too.
  const tickN = parseFloat(urlParams.get('tick') || '0');
  if (tickN > 0) {
    for (let s = 0; s < tickN; s += 0.05) {
      advanceMotion(0.05);
      updateEnemies(0.05, s);
    }
    placeActors();
    snapCamera();
  }

  if (waveN > 0) {
    // ?wave=N now REPORTS what it spawned. The operator sees one contact
    // on a field the towers are clearly shooting into, and "how many are
    // actually there" is not a thing a screenshot can answer.
    const alive = enemies.filter((e) => e.alive);
    const inScene = alive.filter((e) => e.obj && e.obj.parent === scene);
    const visible = alive.filter((e) => e.obj && e.obj.visible);
    const spots = new Set(alive.map((e) => e.cur));
    const byType = {};
    for (const e of alive) byType[e.type] = (byType[e.type] || 0) + 1;
    console.log(`WAVEDUMP wave=${wave} alive=${alive.length} queued=${spawnQueue.length}`
      + ` inScene=${inScene.length} visible=${visible.length}`
      + ` distinctCells=${spots.size} portals=${spawnPoints.filter((s) => s.alive).length}`
      + ` types=${Object.entries(byType).map(([k, v]) => `${k}x${v}`).join(',')}`);
  }
  // opening briefing on a clean load; any debug hook means headless/demo,
  // where a frozen sim would break the verification flow
  // ?audio=1 — report the audio graph every two seconds: how many voices are
  // live and what state the context is in. The leak this was written for is
  // fixed, but "it sounds worse now" is not evidence and this is.
  // ?record=1 opens the record, and ?record=all fills it first — the only
  // way to see every row lit without earning twenty-one of them
  const recQ = urlParams.get('record');
  if (recQ) {
    if (recQ === 'all') {
      heldAchv.length = 0;
      for (const a of ACHIEVEMENTS) heldAchv.push(a.id);
    }
    setTimeout(() => showRecord(), 400);
  }

  // ?brief=<id> plays one of Isao's beats on demand, ignoring the once-only
  // memory — otherwise a beat can be looked at exactly once per browser,
  // ever, which is not a thing you can iterate on
  const briefQ2 = urlParams.get('brief');
  if (briefQ2) {
    const i = briefSeen.indexOf(briefQ2);
    if (i >= 0) briefSeen.splice(i, 1);
    setTimeout(() => showBrief(briefQ2), 500);
  }

  if (urlParams.get('audio') === '1') {
    setInterval(() => {
      console.log(`AUDIO voices=${sfx.voices} ctx=${sfx.contextState}`);
    }, 2000);
  }

  const debugging = ['walk', 'tick', 'wave', 'blast', 'laser', 'found', 'recoil', 'mode', 'map', 'tower', 'biomass', 'credit', 'driveout', 'order', 'isao', 'bobby', 'record', 'debrief', 'armed', 'brief', 'planet', 'shop', 'sector', 'reveal', 'portal', 'lose', 'charge', 'layout', 'perf', 'strike', 'strikefall', 'strikecam', 'gateprobe', 'rank', 'danger', 'callout', 'sitrep', 'server', 'hack', 'shield', 'sim']
    .some((k) => urlParams.get(k));
  const tutParam = urlParams.get('tutorial');
  runTutorial = tutParam === '1' || (tutParam !== '0' && !debugging);
  // ?intro=1 forces the manual even under debug hooks (screenshot path);
  // ?intro=0 skips it. On a clean load it fronts whatever comes next.
  const introParam = urlParams.get('intro');
  // THE COLD OPEN fronts all of it. ?cine=N scrubs N seconds into it (the
  // screenshot path — beats land at ~1 / ~5 / ~8); ?cine=0 skips it. It is
  // deliberately NOT gated on `debugging`: a hook like ?tick has no opinion
  // about the opening, and the cinematic is the thing being verified.
  const cineParam = urlParams.get('cine');
  const wantCine = cineParam !== '0' && (cineParam !== null || !debugging);
  let opening = null;
  if (introParam === '1') opening = () => showIntro();
  else if (!debugging && introParam !== '0' && !mobileShell) {
    // not on the shell: the manual PAUSES the game with the tank in its
    // berth at the deploy framing (operator's phone: "starts in this view
    // and impossible to move"); the coach and the tutorial's shell words
    // teach there, without a modal
    opening = () => showIntro(() => { if (runTutorial) startTutorial(); else showBriefing(); });
  } else if (mobileShell && !debugging && introParam !== '0') {
    opening = () => { if (runTutorial) startTutorial(); else showBriefing(); };
  } else if (runTutorial) opening = () => startTutorial();
  else if (!debugging) opening = () => showBriefing();

  if (wantCine) {
    // held until the berths land (or the frame loop's safety net fires) —
    // the opening shot needs the thing it is a shot OF
    const scrub = parseFloat(cineParam || '0');
    if (scrub > 0) shotHold = true;   // ?cine=N parks the clock on that beat
    // nothing to wait for any more: the camp is known with the board, so the
    // opening shot has its subject the moment the tab exists
    playCinematic(opening || (() => {}), scrub);
  } else {
    deployStart(berthIndexFor(playerHP));
    if (opening) opening();
  }

  // ?tutstep=N — clear N scripted pairs, so the later tutorial beats can be
  // reached without a pair of hands. Every other phase here is gated on
  // killing something, which headless verification cannot do, and a beat you
  // cannot screenshot is a beat nobody checks.
  // ?perf=N — after N seconds, report what the frame actually costs. Written
  // because "is the dot count a performance limit?" is a question that should
  // be answered with the renderer's own numbers, not with an instinct.
  // --- THE VARIABLES MODAL (operator, 2026-09-02) --------------------------
  // "too messy and too vertical": thirty root controls and four folders in one
  // right-edge column. The lil-gui DOM is MOVED into #td-vars as pages — root
  // controls become the GAME page, each folder its own page — so nothing
  // about any control changes, only where it lives and how it is reached.
  perfCtl = gui.add({ get on() { return perfOn; }, set on(v) { setPerfOverlay(v); } }, 'on')
    .name('fps readout (`)');
  // THE LAB PAGE. A folder here becomes a page in VARS below, for free.
  const applyLabSky = applySky;   // the lab's knobs feed the same bake
  if (lab.on) {
    // the lab opens on the run's own sky unless the URL named a seed
    if (!urlParams.has('labseed') && !urlParams.has('labGalaxySeed')) lab.galaxySeed = skySeed;
    const f = gui.addFolder('lab');
    f.add(lab, 'waveMult', 1, 20, 1).name('wave ×');
    f.add({ spawn: () => spawnWave() }, 'spawn').name('⚡ spawn a wave now');
    f.add(lab, 'holdWaves').name('hold waves');
    f.add(lab, 'freezeEnemies').name('freeze enemies');
    f.add(lab, 'immortalHeart').name('immortal heart');
    f.add(lab, 'immortalTank').name('immortal tank');
    f.add(lab, 'bg', ['none', 'galaxy']).name('background').onChange(applyLabSky);
    f.add(lab, 'galaxySeed', 0, 99999, 1).name('galaxy seed').onFinishChange(applyLabSky);
    f.add({ roll: () => { lab.galaxySeed = Math.floor(Math.random() * 100000); applyLabSky(); f.controllersRecursive().forEach((c) => c.updateDisplay()); } }, 'roll').name('↻ new galaxy');
    f.add(lab, 'galaxyScale', 0.25, 4, 0.05).name('galaxy size').onFinishChange(applyLabSky);
    f.add(lab, 'galaxies', 1, 8, 1).name('galaxies').onFinishChange(applyLabSky);
    f.add(lab, 'galaxyCore', 0.25, 3, 0.05).name('core size ×').onFinishChange(applyLabSky);
    f.add(lab, 'bgIntensity', 0, 1.5, 0.05).name('sky intensity');
    f.add(lab, 'fx', ['wormhole', 'corona']).name('portal effect').onChange((v) => { ensureWormhole(); setBoardEffect(v); });
    f.add(lab, 'whSize', [128, 192, 256, 384, 512, 768]).name('portal target px').onChange((n) => {
      // setSize keeps the texture object, so the gates' materials stay bound
      whRender.size = n; if (whRt) { whRt.setSize(n, n); whUniforms.uResolution.value.set(n, n, 1); whLastAt = -1e9; }
    });
    f.add(lab, 'whHz', 1, 60, 1).name('portal update Hz').onChange((v) => { whRender.updateHz = v; });
    f.add(lab, 'steps', 8, 240, 1).name('march steps').onChange((v) => { whUniforms.uSteps.value = v; whLastAt = -1e9; });
    f.add(lab, 'octaves', 1, 16, 1).name('turbulence octaves').onChange((v) => { whUniforms.uTurbOctaves.value = v; whLastAt = -1e9; });
    f.add(lab, 'bloom').name('bloom').onChange((v) => postfx.setEnabled(v));
    // what the URL asked for, applied once the board exists
    applyLabSky();
    if (lab.fx !== 'wormhole') { ensureWormhole(); setBoardEffect(lab.fx); }
    whUniforms.uSteps.value = lab.steps; whUniforms.uTurbOctaves.value = lab.octaves;
    postfx.setEnabled(lab.bloom);
  }
  (function buildVarsModal() {
    const modal = root.querySelector('#td-vars');
    if (!modal) return;
    const nav = modal.querySelector('.vars-nav');
    const body = modal.querySelector('.vars-body');
    const pages = [];
    // page 1: everything that was loose at the root
    // a page WRAPPING a lil-gui block, not a page that IS one: the modal's
    // stylesheet forces every `.lil-gui` inside it visible (!important), so a
    // page carrying that class could never be hidden — every other page was
    // drawn underneath the game page, scrolled out of sight (found 2026-09-03
    // when the lab page came up as the game page)
    const gamePage = document.createElement('div');
    gamePage.className = 'vars-page';
    const gameBlock = document.createElement('div');
    gameBlock.className = 'lil-gui';
    const gameKids = document.createElement('div');
    gameKids.className = 'children';
    for (const c of gui.controllers) gameKids.appendChild(c.domElement);
    gameBlock.appendChild(gameKids);
    gamePage.appendChild(gameBlock);
    pages.push({ title: 'game', el: gamePage });
    // one page per folder, the folder's own element moved whole
    for (const f of gui.folders) {
      const page = document.createElement('div');
      page.className = 'vars-page';
      page.appendChild(f.domElement);
      f.open();
      pages.push({ title: f._title, el: page });
    }
    let activeI = 0;
    const show = (i) => {
      activeI = i;
      pages.forEach((pg, j) => pg.el.classList.toggle('active', j === i));
      nav.querySelectorAll('button').forEach((b, j) => b.classList.toggle('active', j === i));
    };
    pages.forEach((pg, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = pg.title;
      b.addEventListener('click', () => show(i));
      nav.appendChild(b);
      body.appendChild(pg.el);
    });
    // the root gui shell is now empty; park it out of the way but keep it
    // alive, since lil-gui's controllers still reference their parent
    gui.domElement.style.display = 'none';
    modal.querySelector('.vars-close').addEventListener('click',
      () => document.body.classList.remove('vars-open'));
    const tg = root.querySelector('#vars-toggle');
    if (tg) tg.addEventListener('click', () => document.body.classList.toggle('vars-open'));
    modal.classList.remove('hidden');
    show(0);
    // ?vars=1 opens it; ?fps=1 turns the readout on — for screenshots and
    // for linking a state rather than describing it
    if (urlParams.get('vars') === '1') document.body.classList.add('vars-open');
    if (lab.on) {
      const i = pages.findIndex((pg) => pg.title === 'lab');
      if (i >= 0) show(i);
      document.body.classList.add('vars-open');
      setPerfOverlay(true, false);   // the lab reads the readout; it does not set your preference
      console.log(`LAB on mult=${lab.waveMult} bg=${lab.bg} fx=${lab.fx} wh=${whRender.size}@${whRender.updateHz}`
        + ` immortal=${lab.immortalHeart ? 'heart' : ''}${lab.immortalTank ? '+tank' : ''} gpuQuery=${!!gpuExt}`);
    }
  })();
  {
    let saved = null;
    try { saved = localStorage.getItem(PERF_KEY); } catch { /* fine */ }
    if (urlParams.get('fps') === '1' || (urlParams.get('fps') !== '0' && saved !== '0')) setPerfOverlay(true,false);
    if (urlParams.get('fps') === '1') {
      console.log(`PERFOVERLAY on=${perfOn} el=${!!perfEl}`
        + ` hidden=${perfEl ? perfEl.classList.contains('hidden') : '?'}`
        + ` text="${perfEl ? perfEl.textContent : ''}"`);
    }
  }

  const perfAt = parseFloat(urlParams.get('perf') || '0');
  if (perfAt > 0) {
    setTimeout(() => {
      // info resets on every render() and postfx runs several passes, so a
      // naive read reports the bloom's final fullscreen quad and nothing
      // else. Turn autoReset off and let ONE frame accumulate.
      // BOTH renderers. The minimap has its own WebGLRenderer and therefore
      // its own info — reading only the main one measured half the frame and
      // made the map look free, which it very much was not.
      renderer.info.autoReset = false; renderer.info.reset();
      requestAnimationFrame(() => requestAnimationFrame(() => report()));
    }, perfAt * 1000);
    const report = () => {
      const r = renderer.info.render;
      const mem = renderer.info.memory;
      let objs = 0, points = 0, clouds = 0;
      scene.traverse((o) => {
        objs++;
        if (o.isPoints && o.geometry && o.geometry.attributes.position) {
          clouds++; points += o.geometry.attributes.position.count;
        }
      });
      console.log(`PERF viewport=${innerWidth}x${innerHeight} dpr=${devicePixelRatio}`);
      console.log(`PERF tier=${tier.name} renderDpr=${renderer.getPixelRatio()} aa=${tier.antialias}`
        + ` wormhole=${whRender.size}@${whRender.updateHz} bloom=${tier.bloomScale}`
        + ` shell=${mobileShell}`);
      // runContext.time only advances inside advanceMotion, so it is the honest
      // answer to "is the driver live right now"
      console.log(`PERF build=${buildMode} frozenWorld=${buildFrozen()}`
        + ` simTime=${runContext.time.toFixed(2)}`);
      console.log(`PERF main calls=${r.calls} tris=${r.triangles} pts=${r.points}`
        + ` | radar=2D, no second WebGL context`
        + ` | scene objects=${objs} clouds=${clouds} cloudVerts=${points}`
        + ` | geometries=${mem.geometries}`);
      renderer.info.autoReset = !perfOn;   // hand the counters back to the readout if it is on
    };
  }

  // ?layout=N — after N seconds, print the on-screen box of every HUD piece
  // and every overlap between them. A screenshot cannot be trusted for this:
  // headless will not lay out below ~500px, it lays out wide and CROPS, so a
  // phone-sized picture shows phone-sized pixels of a tablet-sized layout.
  // Rectangles do not lie.
  const layoutAt = parseFloat(urlParams.get('layout') || '0');
  if (layoutAt > 0) {
    // ?mobbuild=1 — measure BUILD mode: tap the shell's own switch, so the
    // measurement goes through the button and not around it.
    // ?pin=1 — a caption and Isao on screen when the ruler comes out, so the
    // slots they take are measured and not assumed.
    setTimeout(() => {
      // the sheets are certainly loaded by now, which they were not at init —
      // measure the PHONE's rules, not the desktop ones that were standing in
      // for them
      const flipped = simulateCoarse();
      if (flipped) console.log(`COARSE simulated at measure: ${flipped} media blocks now apply`);

      if (urlParams.get('mobbuild') === '1' && mobModeEl && !buildMode) mobModeEl.click();
      if (urlParams.get('pin') === '1') {
        showToast('<div class="wave-num">CAPTION</div><div class="wave-role">pinned for the ruler</div>', 60000);
        showBrief('arrival');
        // both cards at once, as a wave that unlocks a tower fires them
        announceWave({ type: 'phage', wave: 2, label: 'the phage', role: 'swarm · agile' });
        clearTimeout(waveTimer); waveTimer = setTimeout(() => {}, 60000);
        showTowerToast(TOWERS[0].key);
        clearTimeout(towerToastTimer); towerToastTimer = setTimeout(() => {}, 60000);
      }
    }, Math.max(0, layoutAt * 1000 - 1200));
    setTimeout(() => {
      const want = {
        // scoped to THIS tab: the sibling tabs carry the same classes, and
        // querySelector was returning a hidden tab's copy and skipping it
        menu: '#chrome-toggle', modes: '#tab-td .tc-util', hud: '#td-stats',
        map: '#tab-td .minimap', tut: '#td-tut', throttle: '#td-throttle',
        steerL: '#td-pad-left', steerR: '#td-pad-right',
        fire: '#td-pad-fire', laser: '#td-pad-laser', mine: '#td-pad-mine',
        shield: '#td-pad-shield',   // a pad the ruler cannot see is a pad nobody checked
        launch: '#td-launch', next: '#td-next', card: '#td-sitrep', hack: '#td-hack',
        // the two number slots, which only leave the centre when the
        // encouragement is switched off — and are exactly the pair most
        // likely to land on the HUD when they move
        shout: '#td-callouts', combo: '#td-combo',
        // the shell's pieces, and the two captions (pinned by ?pin=1)
        mode: '#mob-mode', brief: '#td-brief', toast: '#td-toast',
        tabbar: '#tabbar',   // the site nav: behind ≡ on the shell, never over the board
        wave: '#td-wave', tower: '#td-tower',   // the announcement cards (pinned by ?pin=1)
      };
      const box = {};
      for (const [k, sel] of Object.entries(want)) {
        const el = document.querySelector(sel);
        // NOT offsetParent: it is null for position:fixed elements, which
        // silently dropped the menu button out of every report
        if (!el || getComputedStyle(el).display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        box[k] = r;
        console.log(`LAYOUT ${k.padEnd(9)} x ${Math.round(r.left)}..${Math.round(r.right)}`
          + `  y ${Math.round(r.top)}..${Math.round(r.bottom)}`);
      }
      const keys = Object.keys(box);
      let clashes = 0;
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const a = box[keys[i]], b = box[keys[j]];
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 2 && oy > 2) {
            clashes++;
            console.log(`LAYOUT OVERLAP ${keys[i]} x ${keys[j]}`
              + ` — ${Math.round(ox)}x${Math.round(oy)}px`);
          }
        }
      }
      console.log(`LAYOUT viewport ${innerWidth}x${innerHeight}`
        + ` coarse=${matchMedia('(pointer: coarse)').matches}`
        + `${urlParams.get('coarse') === '1' ? ' (SIMULATED)' : ''}`
        + ` dpr=${devicePixelRatio} — ${clashes} overlaps`);
    }, layoutAt * 1000);
  }

  // ?charge=0..1 — park the wave clock inside the warning window, so the
  // telegraph can be seen at a chosen intensity. ?tick does not advance this
  // clock (it drives motion, not the wave scheduler), which is why the
  // countdown sat at the same value however far it was wound forward.
  const chargeAt = parseFloat(urlParams.get('charge') || '-1');
  if (chargeAt >= 0) {
    const c = Math.min(1, chargeAt);
    // stop just short of the gap: at exactly waveGap it spawns and the
    // charge you asked to look at is over before the first frame
    // arm directly and wind the countdown to the requested point: the clock
    // that matters is the armed one now, not the gap
    waveActive = false;
    interClock = params.waveGap - WAVE_WARN;
    armWave();
    waveIn = Math.max(0.05, WAVE_WARN * (1 - c));
    // report what the telegraph is actually doing: a ring a few hundred
    // pixels wide on a distant gate is not something a screenshot settles
    setTimeout(() => {
      const sp = spawnPoints.find((p2) => p2.alive);
      console.log(`CHARGE want=${c} charge=${waveCharge.toFixed(2)} waveIn=${waveIn.toFixed(2)}`
        + ` ringParticles=${warnFx.length} beatIn=${warnBeat.toFixed(2)}s`
        + ` gateScale=${sp ? (sp.obj.scale.x / (sp.obj.userData.sizeScale ?? 1)).toFixed(3) : 'n/a'}`);
    }, 1200);
  }

  // ?strike=N — N strikes ready at once, skipping the window; the ritual
  // still applies. ?strikefall=1 — arm, paint the first live gate and launch
  // after 1.2s, so the fall camera and the blast can be screenshotted.
  const strikeReady = parseInt(urlParams.get('strike') || '0', 10);
  if (strikeReady > 0) { strike.ready = strikeReady; strike.reserved = 0; }
  // ?armed=1 — hold the console ARMED, which on a phone is the only state
  // where the readout and the launch key exist at all. Without it that half
  // of the mobile layout cannot be photographed.
  if (urlParams.get('armed') === '1') {
    strike.ready = Math.max(1, strike.ready);
    strike.armed = true;
    armUiKey = ''; syncArmUi();
  }
  // ?strikecam=1 — the feed overlay + filter, held open on a static frame so
  // the STYLING can be photographed; engagement during a real fall is proven
  // by the FEED log lines instead, because a screenshot cannot reliably race
  // a 2.5s window under a virtual-time budget.
  if (urlParams.get('strikecam')) {
    setTimeout(() => {
      root.classList.add('striking');
      strikecamEl.classList.remove('hidden');
      scInfoEl.textContent = 'ORBITAL STRIKE · OTS-723\nWARHEAD 489KG · KINETIC\n'
        + 'TGT CELL 0408 · SECTOR R1\nFEED SAT-CAM 2 · LIVE\nVECTOR BURST ×1';
      scRangeEl.textContent = '0840M';
    }, 800);
  }
  if (urlParams.get('strikefall')) {
    strike.ready = Math.max(1, strike.ready);
    setTimeout(() => {
      // strikefall=enemy paints the thickest CLUSTER of live enemies instead
      // of a gate, which is how the falloff is verified against things that
      // actually move
      let ci0 = -1;
      if (urlParams.get('strikefall') === 'enemy') {
        let best = -1;
        for (const e of enemies) {
          if (!e.alive) continue;
          const r2 = cellSide * strikeTune.blastCells;
          const near = enemies.filter((o2) => o2.alive && dist3(e.pos, o2.pos) < r2).length;
          if (near > best) { best = near; ci0 = e.cur; }
        }
      }
      const sp = spawnPoints.find((q) => q.alive);
      if (ci0 < 0 && !sp) return;
      toggleArm(strike);
      paintTarget(strike, ci0 >= 0 ? ci0 : sp.ci);
      launchStrike(strike, strikeTune);
      strikeGrace = 0.25;
      // under a virtual-time budget the fall clock (frame dt) barely moves,
      // so the hook exercises the skip — which is also the code path a
      // pressed player takes, and so worth exercising anyway
      setTimeout(() => skipFall(strike), 2100);
    }, 1200);
  }

  // ?danger=1 — force the CRT warning and PIN it: under a virtual-time
  // budget the 1.9s hide-timer fires before the first paint (timers outrun
  // rAF), so a forced warning that also hides itself verifies nothing
  if (urlParams.get('danger') === '1') { dangerFlash(); clearTimeout(dangerTimer); }

  // ?callout=1 — one of each callout + a pinned combo, for layout checks
  if (urlParams.get('callout') === '1') {
    // BOTH scripts on purpose: the callout layer speaks English and
    // Japanese, and a typeface that only looks right in one of them is not
    // a typeface this game can use. The stack holds three, so the heart
    // line yields to the kana.
    showCallout(RECKLESS_MSGS[0], 'co-reckless', true);   // RECKLESS!
    showCallout(RECKLESS_MSGS[1], 'co-heart', true);      // すげ〜！
    showCallout('STREAK ×1.45', 'co-streak', true);
    ramCombo = 23; syncCombo();
    ramComboT = 9999; // pinned: the expiry timer outruns headless paints
  }

  // ?server=1 — report the antipode placement, force discovery (button check)
  if (urlParams.get('server') === '1') {
    const anti = serverCi >= 0
      ? dot3(norm3(graph.centers[serverCi]), norm3(graph.centers[dungeon.heart])).toFixed(3) : '-';
    // how close does the FULL world's carve get to the pole? If lanes never
    // reach it, the server is a landmark nobody can ever touch — a design
    // fact worth measuring, not assuming
    let fullMin = 1;
    const hc2 = norm3(graph.centers[dungeon.heart]);
    for (let i = 0; i < tdFullTags.length; i++) {
      if (tdFullTags[i] !== BLOCKED) fullMin = Math.min(fullMin, dot3(norm3(graph.centers[i]), hc2));
    }
    const clear = serverChamber.filter((ci) => dungeon.tags[ci] !== BLOCKED).length;
    console.log(`SERVER ci=${serverCi} dot=${anti}`
      + ` chamber=${clear}/${serverChamber.length} clear`
      + ` ground=${serverCi >= 0 && dungeon.tags[serverCi] !== BLOCKED ? 'OPEN' : 'sealed'}`);
    serverFound = true; run.serverFound = true; checkAchievements(); syncHackBtn();
    showBrief('relay');
    hackPromptForce = true; // pin the prompt for the layout screenshot
    // the model loads async — report again once it should be in the scene
    setTimeout(() => console.log(`SERVER2 placed=${!!serverObj}`
      + `${serverObj ? ` scale=${serverObj.scale.x.toFixed(4)}` : ''}`), 5000);
  }
  // ?hack=1|hdt|bridges|shikaku — straight into the breach (boot checks)
  const hackParam = urlParams.get('hack');
  if (hackParam) {
    serverFound = true; run.serverFound = true; checkAchievements(); syncHackBtn();
    if (HACK_GAMES[hackParam]) hackGame = hackParam;
    openHack();
  }

  // ?debrief=1 — the analyst's board with fabricated run stats, through the
  // real renderer, so its six windows and the replay can be looked at
  // without playing a sector to the end. ?debrief=2 shows the FINAL variant.
  const debriefWant = parseInt(urlParams.get('debrief') || '0', 10);
  if (debriefWant > 0) {
    setTimeout(() => {
      dismissIntro();
      rs.kills = { phage: 23, ghost: 11, scoutufo: 6, drifter: 3, corona: 2 };
      rs.bySrc = { tank: 19, tower: 21, strike: 5 };
      rs.rams = 14; rs.shells = 6; rs.strikes = 1; rs.maxCombo = 4;
      rs.scoreBins = [0, 120, 340, 900, 1400, 1450, 2100, 3300, 3600, 4200];
      rs.bestShell = { kills: 3, wave: 4 };
      const bodies = [];
      const rng = mulberry32(7);
      for (let i = 0; i < 14; i++) {
        const a = rng() * 6.283, d = rng() * 5.5;
        bodies.push({ x: Math.cos(a) * d, y: Math.sin(a) * d,
          type: ['phage', 'ghost', 'drifter', 'corona'][i % 4], died: d < 3.2 });
      }
      rs.bestStrike = { kills: 5, wave: 6, replay: { radius: 3.2, portals: 1, bodies } };
      renderAnalysis(debriefWant === 2);
      console.log(`DEBRIEF stage=analysis windows=${msgEl.querySelectorAll('.dbf-win').length}`
        + ` replay=${!!msgEl.querySelector('.dbf-replay')} proceed=${!!msgEl.querySelector('.msg-proceed')}`);
      // ...then press proceed, and check the ORDERS only appear after it —
      // "only then do we have the option to walk the planet, start another"
      const hadOrdersEarly = !!msgEl.querySelector('.msg-lap, .msg-next, .msg-planet');
      msgEl.querySelector('.msg-proceed').click();
      const orders = [...msgEl.querySelectorAll('.msg-lap, .msg-next, .msg-planet, .msg-buyhull, .msg-buystrike')]
        .map((b) => b.className + (b.disabled ? '(short)' : ''));
      console.log(`DEBRIEF stage=verdict orders=[${orders.join(', ')}]`
        + ` ordersBeforeProceed=${hadOrdersEarly}`
        + ` ${!hadOrdersEarly && orders.length >= 2 ? '(gated correctly)' : '<-- WRONG ORDER'}`);
    }, 1200);
  }

  // ?terra=N — run the Terraformer's clock through N waves, driving its jobs
  // to completion, and report the yard and the hulls. The bed is frame-driven,
  // so it is stepped by calling tfTick directly (the drone lesson).
  const terraN = parseInt(urlParams.get('terra') || '0', 10);
  if (terraN > 0) {
    preloadContainer().then(() => {
      const hp0 = playerHP;
      playerHP = 1; syncLifeContainers();          // leave room for hulls to be printed
      for (let w = 1; w <= terraN; w++) {
        tfMilestone(w);
        for (let s2 = 0; s2 < 14 && (tfJob || tfQueue.length); s2 += 0.05) tfTick(0.05);
      }
      const hc = graph.centers[dungeon.heart];
      const padCells = heartSprite && heartSprite.userData.padR
        ? (heartSprite.userData.padR * heartSprite.userData.sizeScale) / cellSide : NaN;
      const bb2 = new THREE.Box3(), sz2 = new THREE.Vector3();
      for (const y of tfYard) {
        y.obj.updateMatrixWorld(true); bb2.setFromObject(y.obj); bb2.getSize(sz2);
        const d = dist3(hc, graph.centers[y.ci]) / cellSide;
        const dl2 = y.obj.getObjectByName('Door_L_Pivot');
        const bl = lifeContainers[0] && lifeContainers[0].obj.getObjectByName('Door_L_Pivot');
        console.log(`TERRA store doors: L=${dl2 ? dl2.rotation.y.toFixed(2) : '?'}`
          + ` (berth container L=${bl ? bl.rotation.y.toFixed(2) : '?'}, which stands OPEN)`);
        // WHICH POSE IS SHUT? Measure the leaf, not the angle: in the box's own
        // frame a closed door lies flat in the end wall (wide in x, thin in
        // z); an open one stands out along z.
        if (dl2) {
          const inv = new THREE.Matrix4().copy(y.obj.matrixWorld).invert();
          const leafBox = (ang) => {
            const keep = dl2.rotation.y; dl2.rotation.y = ang; y.obj.updateMatrixWorld(true);
            const lb = new THREE.Box3(); const ls = new THREE.Vector3();
            dl2.traverse((o) => { if (!o.isMesh) return;
              lb.union(new THREE.Box3().setFromObject(o).applyMatrix4(inv)); });
            lb.getSize(ls); dl2.rotation.y = keep; y.obj.updateMatrixWorld(true);
            return `x${ls.x.toFixed(2)} z${ls.z.toFixed(2)} -> ${ls.x > ls.z * 1.5 ? 'FLAT IN THE END WALL (shut)' : ls.z > ls.x * 1.5 ? 'STANDING OUT (open)' : 'ambiguous'}`;
          };
          console.log(`TERRA door leaf at 0.00: ${leafBox(0)} | at -1.90: ${leafBox(-1.9)}`
            + ` | SHUT at ${(dl2.userData.shutAngle ?? 0).toFixed(2)}: depth z${(dl2.userData.shutDepth ?? NaN).toFixed(2)}`);
        }
        console.log(`TERRA store at cell ${y.ci}: ${d.toFixed(2)} cells from the heart,`
          + ` pedestal radius ${padCells.toFixed(2)} cells`
          + ` ${d < padCells ? '<-- UNDER THE PEDESTAL' : '(clear of it)'}`
          + ` | drawn ${(sz2.length() / cellSide).toFixed(2)} cells across`);
      }
      console.log(`TERRA after ${terraN} waves: yard=${tfYard.length} containers=${tfContainers}`
        + ` hulls printed=${tfHulls} playerHP ${hp0}->${playerHP}`
        + ` (every ${TF.containerEvery} a store, every ${TF.hullEvery} a hull)`
        + ` ${tfContainers > 0 && tfHulls > 0 ? 'BOTH PRODUCTS LANDED' : '<-- something did not build'}`);
    });
  }

  // ?campaign=1 — fabricate three cleared sectors and render the final
  // screen: the table must carry three rows and a totals row, the coin must
  // read 1 after a win and 0 after CONTINUE, and the decision must be gated
  // on the coin.
  if (urlParams.get('campaign') === '1') {
    setTimeout(() => {
      dismissIntro();
      setCoins(0);
      const mk = (r, k, e, sp, hl) => ({ round: r, waves: 15, secs: 200 + r * 40, kills: k, tank: Math.round(k * 0.4),
        tower: Math.round(k * 0.5), strike: k - Math.round(k * 0.4) - Math.round(k * 0.5), earned: e, spent: sp,
        hullsLost: hl, heartHits: hl, heart: 10 - hl, towers: 4 + r * 2, held: e - sp, bestShell: 3, bestStrike: 5, full: r !== 2 });
      campaign.push(mk(1, 45, 900, 610, 0), mk(2, 62, 1400, 1300, 1), mk(3, 88, 2100, 1750, 1));
      rs.bestShell = { kills: 3, wave: 4 };
      rs.bestStrike = { kills: 5, wave: 6, replay: { radius: 3.2, portals: 1, bodies: [] } };
      setCoins(coins() + 1);   // the win mints one
      renderVerdict(true);
      const rows = msgEl.querySelectorAll('.camp-table tbody tr').length;
      const foot = msgEl.querySelectorAll('.camp-table tfoot tr').length;
      const coinTxt = (msgEl.querySelector('.coin') || {}).textContent || '';
      const btn = msgEl.querySelector('.msg-planet');
      console.log(`CAMPAIGN rows=${rows} totals=${foot} coin="${coinTxt.trim()}"`
        + ` continue=${btn && !btn.disabled ? 'ENABLED' : 'disabled'}`
        + ` ${rows === 3 && foot === 1 && /: 1/.test(coinTxt) && btn && !btn.disabled ? '(meaningful, and the coin is in)' : '<-- WRONG'}`);
      // spend it without regenerating: the handler's guard and decrement only
      setCoins(coins() - 1);
      renderVerdict(true);
      const btn2 = msgEl.querySelector('.msg-planet');
      console.log(`CAMPAIGN after CONTINUE: coin="${(msgEl.querySelector('.coin') || {}).textContent.trim()}"`
        + ` continue=${btn2 && !btn2.disabled ? 'ENABLED' : 'disabled'}`
        + ` ${btn2 && btn2.disabled ? '(no coin, no continue)' : '<-- WRONG'}`);
    }, 1200);
  }

  // ?goto=1 — tap-to-go without a finger: pick an open cell six hops out,
  // command the tank there, drive the walker, and check it arrives AND hands
  // control back (directive restored, auto off).
  if (urlParams.get('goto') === '1') {
    setTimeout(() => {
      dismissIntro();
      const d0 = bfsDist(graph.adj, [player.cur], (i) => dungeon.tags[i] !== BLOCKED);
      let target = -1;
      for (let i = 0; i < d0.length; i++) if (d0[i] === 6) { target = i; break; }
      const ok = target >= 0 && gotoCell(target);
      const dirAt = params.directive, autoAt = autoMode;
      let tt = 0;
      for (; tt < 40 && gotoCi >= 0; tt += 0.05) {
        advanceMotion(0.05);
        if (gotoCi >= 0 && player.cur === gotoCi) stopGoto();
      }
      console.log(`GOTO target=${target} accepted=${ok} directive=${dirAt} auto=${autoAt}`
        + ` -> arrived=${player.cur === target} in ${tt.toFixed(1)}s`
        + ` handedBack=${!autoMode && params.directive !== 'goto'} shell=${mobileShell}`
        + ` ${ok && player.cur === target && !autoMode ? '(commanded there, and stopped)' : '<-- did not arrive or did not stop'}`);
    }, 1500);
  }

  // ?tapprobe=1 — PLAYTEST-TODO §1, measured. From the build camera, project
  // the roof of every placeable wall-top that faces the camera and lies
  // inside the frame, put a synthetic tap there, and ask what the tap
  // resolves to. Two zooms: the default, and the double-tap's whole-planet
  // pose, where a cell is a few pixels. The bar is ≥ 95% placeable.
  if (urlParams.get('tapprobe') === '1') {
    const measure = (label) => {
      const r = renderer.domElement.getBoundingClientRect();
      const top = 1 + params.wallHeight;
      let n = 0, exact = 0, placeable = 0, total = 0, facing = 0;
      const miss = {};
      for (let ci = 0; ci < graph.centers.length; ci++) {
        if (placeError(ci)) continue;
        total++;
        const c = graph.centers[ci], nrm = graph.normals[ci];
        const p = new THREE.Vector3(c[0] * top, c[1] * top, c[2] * top);
        const toCam = camera.position.clone().sub(p).normalize();
        if (nrm[0] * toCam.x + nrm[1] * toCam.y + nrm[2] * toCam.z < 0.25) continue; // faces away
        facing++;
        const q = p.clone().project(camera);
        if (Math.abs(q.x) > 0.92 || Math.abs(q.y) > 0.92 || q.z > 1) continue;      // out of frame
        const sx = r.left + ((q.x + 1) / 2) * r.width;
        const sy = r.top + ((1 - q.y) / 2) * r.height;
        const hit = cellAtScreen(sx, sy);
        n++;
        if (hit === ci) exact++;
        if (hit !== -1 && !placeError(hit)) placeable++;
        else { const why = hit === -1 ? 'sky' : placeError(hit); miss[why] = (miss[why] || 0) + 1; }
      }
      return { n, exact, placeable, miss, total, facing };
    };
    // One pose sees a quarter of the frontier at best, so a zoom is EIGHT
    // poses 45° apart about the build frame's up — the drag handler's own
    // rotation — with the taps pooled. A single pose gave 5 taps and a
    // meaningless 100%.
    //
    // STEPPED, NOT TIMED. The first cut chained setTimeouts and virtual
    // time burned through all sixteen inside 13ms of real time with no
    // frame between them: one frozen camera, measured sixteen times, at a
    // radius of 1.16 — the camera had not even left the ground. The frame
    // loop's own easing is run here by hand until it converges, the same
    // rule as ?goto driving advanceMotion.
    const settle = () => {
      for (let i = 0; i < 120; i++) {           // 0.86^120 ≈ 1.6e-8 of the gap left
        buildFollowTank(1 / 60);
        updateCameraGoal();
        camera.position.lerp(camGoal.pos, 0.14);
        camera.quaternion.slerp(camGoal.quat, 0.14);
      }
      camera.updateMatrixWorld(true);
    };
    const POSES = 8;
    const sweep = (label) => {
      const sum = { n: 0, exact: 0, placeable: 0, miss: {}, total: 0 };
      const per = [];
      for (let k = 0; k < POSES; k++) {
        settle();
        const m = measure();
        per.push(`${m.n}`);
        sum.n += m.n; sum.exact += m.exact; sum.placeable += m.placeable; sum.total = m.total;
        for (const [w, c] of Object.entries(m.miss)) sum.miss[w] = (sum.miss[w] || 0) + c;
        const f = buildFrame();
        buildQ.premultiply(bqTmp.setFromAxisAngle(f.up, (2 * Math.PI) / POSES));
        buildQ.normalize();
        followSuspend = true;
      }
      const pct = sum.n ? (100 * sum.placeable) / sum.n : 0;
      console.log(`TAPPROBE ${label} dist=${buildDist.toFixed(1)} |cam|=${camera.position.length().toFixed(2)}`
        + ` poses=${POSES} taps/pose=[${per.join(' ')}]`
        + ` placeable-cells=${sum.total} taps=${sum.n} exact=${sum.exact}`
        + ` placeable=${sum.placeable} (${pct.toFixed(1)}%) misses=${JSON.stringify(sum.miss)}`
        + ` ${sum.n < 12 ? 'INCONCLUSIVE (sample too small)' : pct >= 95 ? 'PASS' : '<-- BELOW 95%'}`);
    };
    setTimeout(() => {
      dismissIntro();
      // updateCameraGoal answers shots and DEPLOY before the orbit — the
      // drone probe found this — so the stepper converged on the berth
      // framing at radius 1.10 until both were cleared
      endShot(); deploy = null;
      setView('orbit');
      sweep('default');
      centerBuildOnHeart(); buildDist = 3.4;
      sweep('whole-planet');
    }, 1200);
  }

  // ?pressprobe=1 — the shell's BUILD gestures through the real pointer
  // pipeline: a tower is committed on a placeable roof, a synthetic finger
  // holds it past LONG_PRESS_MS (expect: an upgrade on the book, and a
  // caption), then taps open ground (expect: a NOT HERE caption with the
  // reason, and no radial).
  if (urlParams.get('pressprobe') === '1') {
    const at = (ci, radius) => {
      const r = renderer.domElement.getBoundingClientRect();
      const c = graph.centers[ci];
      const q = new THREE.Vector3(c[0] * radius, c[1] * radius, c[2] * radius).project(camera);
      return [r.left + ((q.x + 1) / 2) * r.width, r.top + ((1 - q.y) / 2) * r.height];
    };
    const finger = (type, x, y) => container.dispatchEvent(new PointerEvent(type, {
      clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true,
    }));
    let towerCi = -1, floorCi = -1;
    setTimeout(() => {
      dismissIntro(); setView('orbit');
      // the placeable roof nearest the Heart: the orbit pose centres there
      const dh = bfsDist(graph.adj, [dungeon.heart], () => true);
      let best = Infinity;
      for (let ci = 0; ci < graph.centers.length; ci++) {
        if (!placeError(ci) && dh[ci] < best) { best = dh[ci]; towerCi = ci; }
      }
      if (towerCi >= 0) { eco.addBiomass(999); commitTower(TOWERS[0].key, towerCi); }
    }, 1200);
    setTimeout(() => {
      const [x, y] = at(towerCi, 1 + params.wallHeight);
      finger('pointerdown', x, y);
    }, 4200);
    setTimeout(() => {
      const [x, y] = at(towerCi, 1 + params.wallHeight);
      finger('pointerup', x, y);
      const o = orderByCell.get(towerCi);
      const cap = toastEl ? toastEl.textContent.replace(/\s+/g, ' ').trim() : '';
      console.log(`PRESSPROBE tower=${towerCi} hit=${cellAtScreen(x, y)} held=${LONG_PRESS_MS + 300}ms`
        + ` order=${o ? o.kind : 'none'} radial=${shopCi !== -1 ? 'OPEN' : 'closed'} caption="${cap}"`
        + ` ${o && o.kind === 'upgrade' && shopCi === -1 ? '(long-press ordered the upgrade)' : '<-- no upgrade order'}`);
      // now a tap on open ground, well inside the frame
      const d0 = bfsDist(graph.adj, [towerCi], () => true);
      for (let ci = 0; ci < d0.length; ci++) {
        if (dungeon.tags[ci] !== BLOCKED && d0[ci] >= 1 && d0[ci] <= 2) { floorCi = ci; break; }
      }
      const [fx, fy] = at(floorCi, 1);
      finger('pointerdown', fx, fy);
      finger('pointerup', fx, fy);
      const hit = cellAtScreen(fx, fy);
      const cap2 = toastEl ? toastEl.textContent.replace(/\s+/g, ' ').trim() : '';
      console.log(`PRESSPROBE floor=${floorCi} hit=${hit} why=${placeError(hit)} radial=${shopCi !== -1 ? 'OPEN' : 'closed'}`
        + ` caption="${cap2}" ${/NOT HERE/.test(cap2) && shopCi === -1 ? '(refused, and said why)' : '<-- silent refusal'}`);
    }, 4200 + LONG_PRESS_MS + 300);
  }

  // ?wake=1 — is the screen being held awake? Reports the lock's state, or
  // that the API is absent (headless Chrome has none; a phone does).
  if (urlParams.get('wake') === '1') {
    setTimeout(() => {
      console.log(`WAKE shell=${mobileShell} api=${'wakeLock' in navigator}`
        + ` held=${!!(wakeLock && !wakeLock.released)} visible=${document.visibilityState}`
        + ` ${!('wakeLock' in navigator) ? 'INCONCLUSIVE (no API here)' : (wakeLock && !wakeLock.released) ? 'PASS' : mobileShell ? '<-- not held' : '(desktop: not requested, by design)'}`);
    }, 1500);
  }

  // ?coach=1 — walk the three coach marks by doing what each one asks, and
  // print the banner at every step. Forces the tutorial off (the coach is
  // for the player who is past it) and the seen-flag clear.
  if (urlParams.get('coach') === '1') {
    setTimeout(() => {
      dismissIntro();
      try { localStorage.removeItem(COACH_KEY); } catch { /* */ }
      coach.done = false; tutorialActive = false; root.classList.remove('tutoring'); paused = false;
      const banner = () => tutEl.classList.contains('hidden') ? '(hidden)' : tutEl.textContent.replace(/\s+/g, ' ').trim();
      const tick = (n) => { for (let i = 0; i < n; i++) coachTick(1 / 30); };
      tick(2);
      const b0 = banner(), s0 = coach.step;
      const target = coachTarget();
      gotoCell(target);
      tick(2);
      const b1 = banner(), s1 = coach.step;
      root.querySelector('#td-pad-fire').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true }));
      tick(2);
      const s2 = coach.step, b2 = banner();
      eco.addBiomass(500); stopGoto(); if (buildMode) setView('third');
      tick(2);
      const b3 = banner();
      let ci = -1;
      for (let i = 0; i < graph.centers.length; i++) if (!placeError(i)) { ci = i; break; }
      const ok = ci >= 0 && orderTower(TOWERS[0].key, ci, { quiet: true });
      tick(2);
      let seen = false; try { seen = !!localStorage.getItem(COACH_KEY); } catch { /* */ }
      console.log(`COACH step0="${b0}" (step ${s0}) -> goto target=${target} -> "${b1}" (step ${s1})`
        + ` -> thumb -> step ${s2} "${b2}" -> biomass -> "${b3}" -> order=${ok} -> done=${coach.done} seen=${seen}`
        + ` ${s0 === 0 && s1 === 1 && s2 === 2 && /BUILD/.test(b3) && coach.done && seen ? '(three marks, each cleared by its own action)' : '<-- WRONG'}`);
    }, 1500);
  }

  // ?viewprobe=1 — the shell's two-view rule: setView('drone') and 'pov'
  // land on third; the toast's TAKE CONTROL never appears on a tap.
  if (urlParams.get('viewprobe') === '1') {
    setTimeout(() => {
      dismissIntro(); endShot(); deploy = null;
      const before = params.view;
      setView('drone'); const a = params.view;
      setView('pov'); const b = params.view;
      setView('orbit'); const c = params.view;
      setView('third');
      const offered = toastEl && !toastEl.classList.contains('hidden') && /TAKE CONTROL/.test(toastEl.textContent);
      console.log(`VIEWPROBE shell=${mobileShell} start=${before} drone->${a} pov->${b} orbit->${c} rideOffered=${offered}`
        + ` ${mobileShell ? (a === 'third' && b === 'third' && c === 'orbit' && !offered ? '(two views, no ride)' : '<-- WRONG') : ''}`);
    }, 1500);
  }

  // ?stickprobe=1 — the floating stick through real PointerEvents: a finger
  // down on the left half, a drag up and left, then a release. Expect the
  // ring to appear, throttle up and steer left while held, and both to
  // clear on release; and a plain tap (no travel) to leave throttle at 0.
  if (urlParams.get('stickprobe') === '1') {
    setTimeout(() => {
      dismissIntro(); endShot(); deploy = null; if (buildMode) setView('third');
      const ev = (type, x, y) => container.dispatchEvent(new PointerEvent(type, {
        clientX: x, clientY: y, pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true, button: 0 }));
      const x0 = innerWidth * 0.25, y0 = innerHeight * 0.6;
      ev('pointerdown', x0, y0);
      const shown = stickEl && !stickEl.classList.contains('hidden');
      ev('pointermove', x0 - 40, y0 - 60);
      const held = { thr: throttle, left: keys.left, right: keys.right, auto: autoMode };
      ev('pointerup', x0 - 40, y0 - 60);
      const rel = { thr: throttle, left: keys.left, hidden: stickEl && stickEl.classList.contains('hidden') };
      ev('pointerdown', x0, y0); ev('pointerup', x0, y0);
      const tap = { thr: throttle };
      console.log(`STICK shell=${mobileShell} ring=${shown} held: thr=${held.thr.toFixed(2)} left=${held.left} right=${held.right}`
        + ` | released: thr=${rel.thr} left=${rel.left} ring-hidden=${rel.hidden} | tap: thr=${tap.thr}`
        + ` ${shown && held.thr > 0.7 && held.left && !held.right && rel.thr === 0 && !rel.left && rel.hidden && tap.thr === 0 ? '(drives, steers, releases, and a tap is a tap)' : '<-- WRONG'}`);
    }, 1500);
  }

  // ?stress=T:W — the operator's question (2026-09-03): "do fps go down MORE
  // with huge waves AND lots of slow towers, because the tower effect must
  // link to all units?" T slow towers on the placeable roofs nearest the
  // Heart, W phages queued at the first gate; pair with ?perf=N for the
  // draw-call readout at the same instant, and this logs what the field
  // itself is holding: live bolts, live bursts, enemies in range of a slow
  // tower, and the product that predicts them.
  if (urlParams.get('stress')) {
    const [T, W] = urlParams.get('stress').split(':').map(Number);
    setTimeout(() => {
      dismissIntro(); endShot(); deploy = null;
      eco.addBiomass(99999);
      const dh = bfsDist(graph.adj, [dungeon.heart], () => true);
      const roofs = [];
      for (let ci = 0; ci < graph.centers.length; ci++) if (!placeError(ci)) roofs.push(ci);
      roofs.sort((a, b) => dh[a] - dh[b]);
      for (let i = 0; i < Math.min(T, roofs.length); i++) commitTower(TOWERS.find((d) => d.attack === 'slowfield').key, roofs[i]);
      // the crowd: at the gate nearest the Heart, so the towers' ranges cover it
      const gate = spawnPoints.filter((sp) => sp.alive).sort((a, b) => dh[a.ci] - dh[b.ci])[0];
      if (gate) for (let i = 0; i < W; i++) spawnQueue.push({ type: 'phage', sp: gate, at: spawnClock + i * 0.05 });
      waveActive = true;
      console.log(`STRESS placed ${Math.min(T, roofs.length)} slow towers, queued ${gate ? W : 0} phages at gate ${gate ? gate.ci : '-'}`);
    }, 1200);
    const perfAtS = parseFloat(urlParams.get('perf') || '6');
    setTimeout(() => {
      const alive = enemies.filter((e) => e.alive);
      let inRange = 0;
      for (const tw of towers) {
        if (tw.def.attack !== 'slowfield') continue;
        const r = effectiveStats(tw.def, tw.tier).range * cellSide;
        for (const e of alive) if (chord(graph.centers[tw.ci], e.pos) <= r) inRange++;
      }
      const bolts = beams.filter((b) => b.dg).length;
      console.log(`STRESS at ${perfAtS}s: slowTowers=${towers.filter((t) => t.def.attack === 'slowfield').length}`
        + ` enemiesAlive=${alive.length} towerXenemyInRange=${inRange} liveBolts=${bolts} liveBursts=${debris.length}`
        + ` sceneChildren=${scene.children.length}`);
    }, perfAtS * 1000 - 20);
  }

  // ============================================================================
  // THE DIRECTOR (docs/CINEMATICS-PLAN.md §9). ?director=NAME runs one of
  // src/cine/scripts.js on THIS board: a seeded, scripted run with a camera
  // rail on top, the input off, the HUD as the script wants it, and — with
  // ?capture=1 — the sim stepped at a fixed dt by the capture harness
  // (installCine seek) so two renders are the same clip. Every item the
  // operator asked for is the game; this is how the game gets filmed
  // without a second copy of the board.
  //
  // The rail is a CHASE RIG: keys are in cells, in the tank's own frame at
  // every frame — x right, y up off the surface, z the heading — so a shot
  // authored "behind-left, low" stays behind-left as the tank drives.
  // ============================================================================
  const directorName = urlParams.get('director');
  if (directorName && SCRIPTS[directorName]) {
    const sc = SCRIPTS[directorName];
    const rail = compileRail(sc.rail, { fov: 42 });
    director = {
      name: directorName, sc, rail, t0: -1, dirT: 0, held: false, engineHold: false,
      radar: null,            // { t0, from, to, over }
      scales: {},             // type -> visual scale the script asked for
      raised: [],             // gates the script raised (a dual portal)
      target: -1,             // the last strike's cell
      strikeShotResume: false,
    };
    const dRight = new THREE.Vector3(), dUp = new THREE.Vector3(), dFwd = new THREE.Vector3();
    const dEye = new THREE.Vector3(), dLook = new THREE.Vector3(), dM = new THREE.Matrix4();
    // THE FRAME a key is authored in. 'tank' (default): up = the radial,
    // forward = the smoothed heading, origin = the tank. 'gates': origin =
    // the midpoint of the gates the script raised, forward = toward the
    // tank. 'target': origin = the last strike's cell, forward = toward
    // the tank. A key carries `at`; the frame switches at the key (a cut).
    function anchorFrame(name) {
      let o = player.pos, toward = null;
      if (name === 'gates' && director.raised.length) {
        const a = graph.centers[director.raised[0].ci], b = graph.centers[director.raised[director.raised.length - 1].ci];
        const r = len3(a);
        o = scale3(norm3(scale3(add3(a, b), 0.5)), r);
        toward = player.pos;
      } else if (name === 'target' && director.target >= 0) {
        o = graph.centers[director.target];
        toward = player.pos;
      } else if (name === 'orbit') {
        // the planet's frame: origin at its centre; z out through the
        // HEART, so a key at [0, 0, 40] hangs 40 cells above the sector
        // (world axes put the sector on the limb — the first orbit still);
        // y is world-up projected off that axis, x completes it
        const hc = norm3(graph.centers[dungeon.heart]);
        dFwd.set(hc[0], hc[1], hc[2]);
        dUp.set(0, 1, 0).addScaledVector(dFwd, -dFwd.y).normalize();
        if (dUp.lengthSq() < 1e-6) dUp.set(1, 0, 0);
        dRight.crossVectors(dUp, dFwd).normalize();
        return [0, 0, 0];
      }
      const n = norm3(o);
      dUp.set(n[0], n[1], n[2]);
      const h = toward ? sub3(toward, o) : (player.smoothDir || [0, 0, 1]);
      dFwd.set(h[0], h[1], h[2]);
      dFwd.addScaledVector(dUp, -dFwd.dot(dUp)).normalize();
      if (dFwd.lengthSq() < 1e-6) dFwd.set(1, 0, 0).addScaledVector(dUp, -dUp.x).normalize();
      dRight.crossVectors(dFwd, dUp).normalize();
      return o;
    }
    function anchorAt(tt) {
      let at = 'tank';
      for (const k of sc.rail) if (k.t <= tt + 1e-6) at = k.at || 'tank';
      return at;
    }
    function placeRel(out, rel, base) {
      out.copy(base)
        .addScaledVector(dRight, rel[0] * cellSide)
        .addScaledVector(dUp, rel[1] * cellSide)
        .addScaledVector(dFwd, rel[2] * cellSide);
    }
    const dBase = new THREE.Vector3();
    function railPose(u, out) {
      const tt = u * sc.len;
      let p = rail.poseAt(tt);
      // NO INTERPOLATION ACROSS A CUT: between two keys in different frames
      // the rail holds the earlier key's pose until the later key's time.
      // Blending a tank-relative pose toward a target-relative one moved
      // the camera 4.5 cells ahead of the tank, into the Terraformer.
      let ki = -1;
      for (let i = 0; i < sc.rail.length; i++) if (sc.rail[i].t <= tt + 1e-6) ki = i;
      const kA = sc.rail[ki], kB = sc.rail[ki + 1];
      if (kA && kB && (kA.at || 'tank') !== (kB.at || 'tank')) p = rail.poseAt(kA.t);
      const o = anchorFrame(anchorAt(tt));
      dBase.set(o[0], o[1], o[2]);
      placeRel(dEye, p.pos, dBase);
      placeRel(dLook, p.look, dBase);
      out.pos.copy(dEye);
      dM.lookAt(dEye, dLook, dUp);          // camera convention: looks down -Z
      out.quat.setFromRotationMatrix(dM);
      if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
    }
    function beginDirectorShot() {
      startShot({ id: 'director', dur: sc.len, poseAt: railPose, skippable: false });
      // the shot's clock is ours: keep it in step with dirT
      shot.left = Math.max(1e-3, sc.len - director.dirT);
    }
    const dh = () => bfsDist(graph.adj, [player.cur], () => true);
    const aliveGates = () => spawnPoints.filter((sp) => sp.alive);
    function gateFor(sel) {
      const gs = aliveGates();
      if (!gs.length) return null;
      const d = dh();
      const sorted = gs.slice().sort((a, b) => d[a.ci] - d[b.ci]);
      if (sel === 'far') return sorted[sorted.length - 1];
      if (typeof sel === 'number') return sorted[Math.min(sel, sorted.length - 1)];
      return sorted[0];
    }
    function crowdCell() {
      const count = new Map();
      for (const e of enemies) if (e.alive) count.set(e.cur, (count.get(e.cur) || 0) + 1);
      let best = -1, bn = 0;
      for (const [ci, n] of count) if (n > bn) { bn = n; best = ci; }
      return best;
    }
    function bossCell() {
      const b = enemies.find((e) => e.alive && e.type === 'knot');
      return b ? b.cur : -1;
    }
    const VERB = {
      biomass: (c) => eco.addBiomass(c.n),
      hud: (c) => { document.body.classList.remove('dir-hud-none', 'dir-hud-radar'); if (c.show !== 'full') document.body.classList.add(`dir-hud-${c.show}`); },
      spawn: (c) => {
        const raised = c.gate === 'raised' && director.raised.length ? director.raised : null;
        const g = raised ? null : gateFor(c.gate);
        if (!g && !raised) return;
        if (c.scale) director.scales[c.type] = c.scale;
        for (let i = 0; i < c.count; i++) {
          const sp = raised ? raised[i % raised.length] : g;   // a dual portal pours from both
          spawnQueue.push({ type: c.type, sp, at: spawnClock + i * (c.every ?? 0.1) });
        }
        waveActive = true;
      },
      // gate { count, hops: [lo, hi] }: raise gates side by side, `hops`
      // from the tank — a dual portal for a shot. The first stands on the
      // openest cell in range, the rest on open cells two hops from it.
      gate: (c) => {
        const d = dh();
        const open = (i) => dungeon.tags[i] !== BLOCKED && !spawnPoints.some((s) => s.ci === i);
        const [lo, hi] = c.hops || [8, 13];
        let best = -1, bn = -1;
        for (let i = 0; i < graph.centers.length; i++) {
          if (!open(i) || d[i] < lo || d[i] > hi) continue;
          const n = graph.adj[i].filter(open).length;
          if (n > bn) { bn = n; best = i; }
        }
        if (best < 0) return;
        const cells = [best];
        const ring2 = new Set();
        for (const a of graph.adj[best]) for (const b of graph.adj[a]) if (b !== best && !graph.adj[best].includes(b) && open(b)) ring2.add(b);
        for (const b of ring2) { if (cells.length >= (c.count ?? 2)) break; cells.push(b); }
        for (const ci of cells) { addSpawnPoint(ci); director.raised.push(spawnPoints[spawnPoints.length - 1]); }
      },
      tower: (c) => {
        const d = dh();
        const roofs = [];
        for (let ci = 0; ci < graph.centers.length; ci++) if (!placeError(ci)) roofs.push(ci);
        const anchor = c.near === 'heart' ? bfsDist(graph.adj, [dungeon.heart], () => true)
          : c.near === 'gate' ? (gateFor('nearest') ? bfsDist(graph.adj, [gateFor('nearest').ci], () => true) : d) : d;
        roofs.sort((a, b) => anchor[a] - anchor[b]);
        for (let i = 0; i < Math.min(c.count, roofs.length); i++) commitTower(c.key, roofs[i]);
      },
      goto: (c) => {
        let ci = -1;
        if (c.to === 'gate') { const g = gateFor('nearest'); ci = g ? g.ci : -1; }
        else if (c.to === 'far') { const g = gateFor('far'); ci = g ? g.ci : -1; }
        else if (c.to === 'heart') ci = dungeon.heart;
        else if (c.to === 'boss') ci = bossCell();
        else if (c.to === 'crowd') ci = crowdCell();
        else if (typeof c.to === 'number') ci = c.to;
        if (ci < 0 || !gotoCell(ci)) director.pendingGoto = c;   // no path yet (berthed): retry per frame
        else director.pendingGoto = null;
      },
      throttle: (c) => { stopGoto(); autoMode = false; cruise = false; throttle = c.v; },
      steer: (c) => { keys.left = c.v < 0; keys.right = c.v > 0; },
      fire: () => fire(),
      laser: (c) => { keys.laser = !!c.on; },
      engine: (c) => {
        if (c.on) { director.engineHold = true; if (!engineRunning) { sfx.play('tank_spool_up'); engineRunning = true; } }
        else { director.engineHold = false; stopEngine(); }
      },
      view: (c) => setView(c.name),
      strike: (c) => {
        const ci = c.target === 'gate' ? (gateFor('nearest') ? gateFor('nearest').ci : -1)
          : c.target === 'gates' ? (director.raised.length ? director.raised[0].ci : -1)
          : c.target === 'tank' ? player.cur : crowdCell();
        if (ci < 0) return;
        director.target = ci;
        strike.ready = Math.max(1, strike.ready); strike.reserved = 0;
        if (!strike.armed) safetyEl.click();
        if (paintTarget(strike, ci) === 'locked') { armUiKey = ''; syncArmUi(); }
        // the board's own strike camera rides the munition down; the rail
        // yields to it and takes the camera back at impact
        endShot();
        director.strikeShotResume = true;
        launchBtn.click();
      },
      radar: (c) => { director.radar = { t0: director.dirT, from: director.radar ? director.radar.to : 1, to: c.zoom, over: c.over ?? 2 }; },
      // warp: the tank set down on a cell, stopped, the way the deploy sets
      // it down at a berth (same fields, same order). 'open' is the cell
      // 4..9 hops out with the most open neighbours — room for a hero shot
      // that the berth cluster does not have.
      warp: (c) => {
        let ci = -1;
        if (typeof c.to === 'number') ci = c.to;
        else {
          const d = dh();
          const open = (i) => dungeon.tags[i] !== BLOCKED;
          let best = -1, bn = -1;
          for (let i = 0; i < graph.centers.length; i++) {
            if (!open(i) || d[i] < 4 || d[i] > 9) continue;
            const n = graph.adj[i].filter(open).length;
            if (n > bn) { bn = n; best = i; }
          }
          ci = best;
        }
        if (ci < 0) return;
        stopGoto();
        const nb = graph.adj[ci].find((i) => dungeon.tags[i] !== BLOCKED) ?? ci;
        player.freeMode = false; player.virtualStart = null;
        player.cur = ci; player.prev = -1;
        player.pos = graph.centers[ci].slice(); player.prog = 0;
        player.next = nb;
        player.heading = tangentDirTo(ci, nb);
        player.travelDir = player.heading.slice(); player.smoothDir = player.travelDir.slice();
        player.segLen = Math.max(1e-9, dist3(graph.centers[ci], graph.centers[nb]));
        throttle = 0; cruise = false; autoMode = false;
        placeActors();
      },
    };
    // a clean board: no intro, no cold open, no berth, no tutorial — the
    // same three lines every probe uses
    // THE DEPLOY IS THE BERTH EXIT (deployStep drives the tank out and hands
    // it back stopped), so the director lets it finish and starts its clock
    // on the far side: every script opens on a tank standing free.
    // the boot's modals — the intro and the briefing — pause the board; a
    // script wants neither, and the briefing has no flag to skip it
    function directorUnpause() {
      dismissIntro();
      msgEl.classList.add('hidden');
      paused = false;
    }
    // THE GLOBE: the board draws only the carved sector, so an orbit shot
    // sees a lit fragment on nothing. A script with globe:true draws every
    // quad edge of the board's OWN sphere mesh, faint, under the sector —
    // the planet the wire sector is cut into. The game's pipeline, not a
    // second one (cine/planet.js does the same for the cine tab).
    let globe = null;
    function buildGlobe() {
      if (globe || !mesh) return;
      const seen = new Set(); const pos = [];
      const { vertices, quads } = mesh;
      for (const qd of quads) for (let i = 0; i < 4; i++) {
        const a = qd[i], b = qd[(i + 1) % 4];
        const key = a < b ? a * 65536 + b : b * 65536 + a;
        if (seen.has(key)) continue; seen.add(key);
        const p1 = vertices[a], p2 = vertices[b];
        pos.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const gop = parseFloat(urlParams.get('globeop')) || 0.22;   // ?globeop=1 — a bisect knob
      globe = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
        color: look().edges.color, transparent: gop < 1, opacity: gop, blending: gop < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false }));
      // ABOVE THE WALL TOPS: the uncarved cells are drawn as dark rock with
      // walls, so anything at the planet's radius is under their tops. The
      // first globe, at 0.995 and then 1.004, drew nothing at any opacity;
      // at 1.6 it filled the frame. ?glober=N is the bisect knob that found it.
      globe.scale.setScalar(parseFloat(urlParams.get('glober')) || (1 + params.wallHeight * 1.15));
      scene.add(globe);
      console.log(`DIRECTOR globe: ${pos.length / 6} edges, r=${len3(vertices[0]).toFixed(3)}`);
    }
    function directorStart() {
      directorUnpause(); endShot(); clearBriefs();
      if (sc.globe) buildGlobe();
      // the board's camera clips at a few units: right for a tank on the
      // ground, wrong for an orbit at 3 radii — the first planet capture saw
      // only the near cap of the sector and nothing of the globe
      if (camera.far < 60) { camera.far = 60; camera.updateProjectionMatrix(); }
      tutorialActive = false;
      throttle = 0; keys.laser = false;
      director.t0 = t; director.dirT = 0;
      // cues at t = 0 fire before the first frame, so the first frame is
      // already the scene (a crowd queued, the HUD set)
      for (const c of sc.cues) if (c.t === 0) VERB[c.do] && VERB[c.do](c);
      beginDirectorShot();
      snapCamera();
      console.log(`DIRECTOR ${directorName}: ${sc.len} s, ${sc.cues.length} cues, hud=${sc.hud}, capture=${urlParams.get('capture') === '1'}`
        + ` deploysDone=${deploysDone} deploy=${!!deploy} cur=${player.cur} next=${player.next} gates=${aliveGates().length}`);
    }
    // per frame, from the loop: cues on the clock, the radar zoom, the
    // strike's hand-back
    window.__directorFrame = (dt) => {
      if (director.t0 < 0) return;
      const prev = director.dirT;
      director.dirT = t - director.t0;
      for (const c of cuesBetween(sc.cues, prev, director.dirT)) if (c.t > 0 && VERB[c.do]) VERB[c.do](c);
      if (director.radar) {
        const r = director.radar;
        const u = Math.min(1, Math.max(0, (director.dirT - r.t0) / r.over));
        const k = r.from + (r.to - r.from) * (u * u * (3 - 2 * u));
        radarEl.style.transformOrigin = 'right bottom';
        radarEl.style.transform = `scale(${k.toFixed(3)})`;
      }
      if (director.pendingGoto && !deploy) { const c = director.pendingGoto; director.pendingGoto = null; VERB.goto(c); }
      for (const e of enemies) if (e.alive && !e.dirScale && director.scales[e.type]) e.dirScale = director.scales[e.type];
      // a script with waves:false holds the board's own wave clock; the
      // director's spawns still go through the queue
      if (sc.waves === false) { waveIn = Math.max(waveIn, 1e6); interClock = 0; }
      // ?dirlog=1 — the run's state every 2 s: what the stills cannot say
      if (urlParams.get('dirlog') === '1' && Math.floor(director.dirT / 2) !== Math.floor(prev / 2)) {
        console.log(`DIRLOG t=${director.dirT.toFixed(1)} cur=${player.cur} next=${player.next} goto=${gotoCi} auto=${autoMode} thr=${throttle.toFixed(2)}`
          + ` cruise=${cruise} deploy=${!!deploy} pending=${!!director.pendingGoto} enemies=${enemies.filter((e) => e.alive).length} queued=${spawnQueue.length}`
          + ` waveActive=${waveActive} shot=${shot ? shot.id : '-'} paused=${paused} frozen=${tutorial.frozen} won=${player.won} down=${!!playerDown}`
        );
        console.log(`DIRGLOBE ${globe ? `${globe.parent === scene ? 'in-scene' : 'ORPHAN'} vis=${globe.visible} op=${globe.material.opacity} r=${globe.geometry.boundingSphere ? globe.geometry.boundingSphere.radius.toFixed(2) : '?'}` : 'none'}`
          + ` cam=${camera.position.length().toFixed(2)}u far=${camera.far} near=${camera.near} layers=${camera.layers.mask} sceneKids=${scene.children.length} camAt=${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)}`);
      }
      if (director.strikeShotResume && strike.falling < 0 && !shot) { director.strikeShotResume = false; beginDirectorShot(); }
      else if (!shot && !director.strikeShotResume && director.dirT < sc.len) beginDirectorShot();   // whatever ended it, the rail comes back
      if (shot && shot.id === 'director') shot.left = Math.max(1e-3, sc.len - director.dirT);
    };
    // THE CAPTURE SEAM. seek(at) steps the sim from where it is to `at` at
    // 1/30 s and renders; the harness captures the page after each. With
    // ?capture=1 the loop is HELD from the start so the clock only moves
    // under seeks — the live loop advancing before the first seek would
    // put a different number of frames into every render.
    const capturing = urlParams.get('capture') === '1';
    if (capturing) { director.held = true; document.body.classList.add('cine-capture'); }
    installCine({
      hold: (on) => { director.held = on; },
      seek: (at) => {
        if (director.t0 < 0) {
          directorUnpause();
          // the berth exit is staged AFTER the models land and takes seconds;
          // wait for one to have started AND finished, at the fixed step
          let g = 0;
          while ((deploysDone < 1 || deploy) && g++ < 1500) { directorUnpause(); frame(1 / 30, false); }
          if (deploysDone < 1) console.warn('DIRECTOR: no berth exit happened in 50 s of pre-roll');
          directorStart();
        }
        let guard = 0;
        while (director.dirT < at - 1e-4 && guard++ < 4000) {
          const step = Math.min(1 / 30, at - director.dirT);
          const tBefore = t;
          frame(step, false);
          if (director.t0 >= 0) director.dirT = t - director.t0;
          if (t === tBefore) {
            // frame() refused the step: something holds the clock. Say what,
            // once, rather than spin 4000 renders (the first capture did)
            console.warn(`DIRECTOR seek stalled at ${director.dirT.toFixed(2)}s: paused=${paused} active=${active} mesh=${!!mesh}`
              + ` deploy=${!!deploy} intro=${!!(introEl && !introEl.classList.contains('hidden'))} won=${player.won}`);
            break;
          }
        }
      },
    });
    window.__cineReady = () => !!(playerMesh && mesh && (typeof mkcxReady !== 'function' || mkcxReady('mkcx2')));
    // live: start once the board is up (the berth callback has run)
    if (!capturing) {
      const poll = setInterval(() => {
        if (director.t0 >= 0) { clearInterval(poll); return; }
        directorUnpause();
        if (deploysDone >= 1 && !deploy && playerMesh) { clearInterval(poll); directorStart(); }
      }, 250);
    }
  }
  function directorFrame(dt) { if (window.__directorFrame) window.__directorFrame(dt); }

  // ?stateprobe=1 — the boot, as a log: every 2 s for 24 s, what state the
  // game is in. For "it starts and I cannot move" reports, where the
  // question is WHICH thing is holding the tank — a pause, a shot, a deploy
  // that never ends, a death loop — and a screenshot cannot say.
  if (urlParams.get('stateprobe') === '1') {
    // on the shell the line also goes to the caption lane: a phone has no
    // console, and the fact that decides a "the tank is not in view" report
    // (the tank's screen-y, the visual viewport vs the canvas) is only
    // measurable THERE
    const onScreen = (txt) => { if (mobileShell && toastEl) { toastEl.innerHTML = `<div class="wave-role" style="font-size:9px;text-align:left;white-space:pre-wrap">${txt}</div>`; toastEl.classList.remove('hidden'); } };
    const line = (k) => {
      const cp = camera.position;
      const ndc = new THREE.Vector3(...player.pos).project(camera);
      const vv = window.visualViewport;
      const extra = `tankScreen=(${ndc.x.toFixed(2)},${ndc.y.toFixed(2)}) canvas=${renderer.domElement.width}x${renderer.domElement.height}`
        + ` inner=${innerWidth}x${innerHeight} visual=${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}@${Math.round(vv.offsetTop)}` : '-'}`
        + ` dpr=${devicePixelRatio} view=${params.view} camToTank=${(cp.distanceTo(new THREE.Vector3(...player.pos)) / cellSide).toFixed(1)}c`
        + ` thr=${throttle.toFixed(2)} stick=${!!stick} laser=${keys.laser}`;
      onScreen(`t=${k * 2}s ${extra}`);
      console.log(`STATE t=${(k * 2).toString().padStart(2)}s paused=${paused} shot=${shot ? shot.id : '-'} build=${buildMode}`
        + ` msg=${!!(msgEl && !msgEl.classList.contains('hidden'))} brief=${!!(briefEl && !briefEl.classList.contains('hidden'))} sitrep=${!!(sitrepEl && !sitrepEl.classList.contains('hidden'))} tut=${tutorial.phase}/${tutorial.frozen}`
        + ` deploy=${deploy ? `#${deploy.n}@${deployProgress().toFixed(2)}` : '-'} intro=${introEl && !introEl.classList.contains('hidden')}`
        + ` tutorial=${tutorialActive} hp=${playerHP} lostDeploys=${tankLostDeploys} down=${!!playerDown}`
        + ` cur=${player.cur}(${dungeon.tags[player.cur] === BLOCKED ? 'BLOCKED' : 'open'}) next=${player.next}`
        + ` auto=${autoMode} thr=${throttle.toFixed(2)} goto=${gotoCi} view=${params.view} unit=${params.creature}`
        + ` camToTank=${(cp.distanceTo(new THREE.Vector3(...player.pos)) / cellSide).toFixed(1)}cells`
        + ` tankVisible=${!!(playerMesh && playerMesh.visible)} inFrustum=${(() => { const f = new THREE.Frustum(); camera.updateMatrixWorld(); f.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); return f.containsPoint(new THREE.Vector3(...player.pos)); })()} ${extra}`);
    };
    // 30 lines was the boot; the tutorial's handoff is past 60 s, so 70
    for (let k = 0; k <= 70; k++) setTimeout(() => line(k), k * 2000);
  }

  // ?tankseen=1 — CAN A PERSON SEE THE TANK. Not "is it in the frustum",
  // which is what the watchdog asks and what four camera fixes answered
  // while the operator kept reporting the same thing. A point can be in the
  // frustum and still invisible, three ways, and this reports all three:
  //
  //   OFF-CANVAS   projected outside the drawing area at all
  //   UNDER CHROME inside the canvas but below the VISUAL viewport — iOS
  //                sizes the layout viewport taller than the glass, so the
  //                bottom band lives under the URL bar and the toolbar
  //   COVERED      drawn, on glass, and with a HUD element on top of it —
  //                elementsFromPoint names the thing that is in the way
  //
  // Reported once a second, with the projection in CSS pixels, so a phone
  // screenshot of the console (or the diag ring) says which of the three it
  // is. This is the measurement the earlier work was missing.
  // ?hangprobe=shot|deploy — DELIBERATELY STALL ONE OF THE TWO MACHINES THAT
  // OWN THE CAMERA, and prove the game gets itself back. This is the failing
  // test for the recurring "stuck in neither view" report: without it the
  // liveness checks above are a claim, and a watchdog nobody has ever seen
  // fire is a watchdog that does not work.
  //
  //   shot    freeze the cold open's clock — the camera stays on its rail
  //   deploy  take the drive speed to zero mid-deploy — the hull never
  //           leaves the berth and the camera never hands over
  {
    const hang = urlParams.get('hangprobe');
    if (hang === 'shot' || hang === 'deploy') {
      let armed = false, t0 = 0, n = 0;
      const tick = setInterval(() => {
        if (!armed) {
          if (hang === 'shot' && shot) {
            shot.left = 1e6;               // it will never run out on its own
            armed = true; t0 = performance.now();
            console.log(`HANGPROBE stalled the "${shot.id}" shot`);
          } else if (hang === 'deploy' && deploy) {
            params.speed = 0;              // it will never travel
            armed = true; t0 = performance.now();
            console.log('HANGPROBE stalled the deploy (speed 0)');
          }
          return;
        }
        const secs = (performance.now() - t0) / 1000;
        const g = tankSight();
        console.log(`HANGPROBE t+${secs.toFixed(1)}s fires=${shotWatchFires} "${shotWatchLast}"`
          + ` shot=${shot ? shot.id : '-'} deploy=${!!deploy} view=${params.view}`
          + ` seen=${g.why}`);
        if (++n > 14) {
          clearInterval(tick);
          const ok = !shot && !deploy && params.view === 'third' && g.why === 'ok';
          console.log(`HANGPROBE VERDICT ${ok ? 'RECOVERED — playable' : 'STILL STUCK'}`
            + ` (fires=${shotWatchFires} shot=${!!shot} deploy=${!!deploy} view=${params.view} seen=${g.why})`);
        }
      }, 1000);
    }
  }

  // ?modeprobe=1 — THE MODE SWITCH, PRESSED.
  // ?modeprobe=1 — THE MODE SWITCH, PRESSED. Not setView called directly:
  // the standing lesson here is that a probe must exercise the CONTROL, and
  // the whole question is whether tapping DRIVE actually reaches third
  // person. Reports the view, the build flag, the button's own label and
  // whether the tank is visible, after each of four taps.
  if (urlParams.get('modeprobe') === '1') {
    setTimeout(() => {
      const btn = root.querySelector('#mob-mode');
      if (!btn) { console.log('MODEPROBE no switch (desktop?)'); return; }
      const say = (tag) => console.log(`MODEPROBE ${tag}`
        + ` view=${params.view} build=${buildMode} label="${btn.textContent.trim()}"`
        + ` shot=${shot ? shot.id : '-'} deploy=${!!deploy}`
        + ` seen=${sightLine(tankSight())}`);
      say('start ');
      // A FINGER, not .click(). A synthetic click skips the pointer events
      // entirely, so any capture-phase handler that swallows a pointerdown —
      // the stick, tap-to-go, the shot skipper — is invisible to a probe that
      // calls click() and lethal to a thumb. The standing lesson here is that
      // a probe must exercise the CONTROL; the control is a finger.
      const finger = (el) => {
        const r = el.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
        const hit = document.elementFromPoint(x, y);
        const opts = { bubbles: true, cancelable: true, composed: true,
          pointerId: 11, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0 };
        for (const type of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(type, opts));
        el.dispatchEvent(new MouseEvent('click', opts));
        return hit;
      };
      let n = 0;
      const step = setInterval(() => {
        if (++n > 4) { clearInterval(step); return; }
        const hit = finger(btn);
        // ...and say WHAT IS ON TOP at the button's own centre: a control
        // under something else is a control that never gets the tap
        setTimeout(() => say(`tap ${n} (top=${hit ? `${hit.tagName.toLowerCase()}${hit.id ? '#' + hit.id : ''}` : '-'}) `), 120);
      }, 1400);
    }, 5200);   // after the berth deploy, which owns the camera until it ends
  }

  // ?tankseen=1 — the same answer the DIAG panel's top line carries
  // ?tankseen=1 — the same answer the DIAG panel's top line carries, once a
  // second on the console, for a run that is being watched rather than
  // screenshotted. tankSight() is the one implementation; this only prints.
  if (urlParams.get('tankseen') === '1') {
    let n = 0;
    const tick = setInterval(() => {
      if (++n > 12) { clearInterval(tick); return; }
      const g = tankSight();
      const vv = window.visualViewport;
      const r = renderer.domElement.getBoundingClientRect();
      console.log(`TANKSEEN t+${n}s ${sightLine(g)}`
        + ` | canvas ${Math.round(r.width)}x${Math.round(r.height)} inner ${innerWidth}x${innerHeight}`
        + ` visual ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}@${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)}` : '-'}`
        + ` | view=${params.view} build=${buildMode} shot=${shot ? shot.id : '-'} deploy=${!!deploy}`
        + ` frustum=${tankInFrustum()} meshVis=${playerMesh && playerMesh.visible}`);
    }, 1000);
  }

  // ?whatsat=x,y — after 3s, name every element under that screen point,
  // ?whatsat=x,y — after 3s, name every element under that screen point,
  // top first. For the thing in a screenshot that nobody can identify.
  if (urlParams.get('whatsat')) {
    const [wx, wy] = urlParams.get('whatsat').split(',').map(Number);
    setTimeout(() => {
      const stack = document.elementsFromPoint(wx, wy).map((e) => {
        const r = e.getBoundingClientRect();
        return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`
          + `[${Math.round(r.left)}..${Math.round(r.right)} x ${Math.round(r.top)}..${Math.round(r.bottom)}]`
          + (e.children.length === 0 ? ` "${(e.textContent || '').trim().slice(0, 24)}"` : '');
      });
      console.log(`WHATSAT ${wx},${wy}: ${stack.join(' > ')}`);
    }, 3000);
  }

  // ?modalprobe=1 — phase 5's ruler. Open each modal the phone will meet,
  // measure its box against the viewport and every button against the box
  // it must be tapped inside of, then close it. "Unreachable" includes
  // CLIPPED: #td-msg is overflow:hidden (the hologram sweep needs it), so a
  // button past its bottom edge is exactly as unreachable as one past the
  // screen's — and on a 303px-tall viewport that is where the orders go.
  if (urlParams.get('modalprobe') === '1') {
    setTimeout(() => {
      const vw = innerWidth, vh = innerHeight;
      const inside = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1
        && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
      const report = (name, el) => {
        if (!el) { console.log(`MODAL ${name} MISSING`); return; }
        const r = el.getBoundingClientRect();
        const vp = { left: 0, top: 0, right: vw, bottom: vh };
        // the tappable box: the modal's own rect, clipped to the viewport
        const clip = { left: Math.max(r.left, 0), top: Math.max(r.top, 0),
          right: Math.min(r.right, vw), bottom: Math.min(r.bottom, vh) };
        const btns = [...el.querySelectorAll('button')]
          .filter((b) => getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0);
        // a button below the fold of a column that SCROLLS is reachable —
        // that is what the column is for; one below the fold of a box that
        // clips is not
        const scrollReachable = (b) => {
          for (let a = b.parentElement; a && a !== el.parentElement; a = a.parentElement) {
            const cs = getComputedStyle(a);
            if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && a.scrollHeight > a.clientHeight + 1) return true;
          }
          return false;
        };
        const lost = [];
        let small = 0, byScroll = 0;
        for (const b of btns) {
          const br = b.getBoundingClientRect();
          if (!inside(br, clip)) {
            if (scrollReachable(b)) byScroll++;
            else lost.push(b.className || b.id || b.textContent.trim().slice(0, 12));
          }
          if (Math.min(br.width, br.height) < 40) small++;
        }
        const ov = getComputedStyle(el).overflowY;
        const scrolls = el.scrollHeight > el.clientHeight + 1;
        const clipped = scrolls && ov === 'hidden';
        const ok = inside(r, vp) && !clipped && lost.length === 0;
        console.log(`MODAL ${name.padEnd(9)} box ${Math.round(r.width)}x${Math.round(r.height)}`
          + ` y ${Math.round(r.top)}..${Math.round(r.bottom)} of ${vw}x${vh} fits=${inside(r, vp)}`
          + ` content=${Math.round(el.scrollHeight)} overflow=${ov}${clipped ? ' CLIPPED' : scrolls ? ' scrolls' : ''}`
          + ` buttons=${btns.length} byScroll=${byScroll} unreachable=${lost.length}${lost.length ? ' [' + lost.join(' ') + ']' : ''}`
          + ` small=${small} ${ok && (small === 0 || !mobileShell) ? 'OK' : '<-- FAIL'}`);   // 40px is a thumb rule
      };
      showIntro(() => {}); report('manual', root.querySelector('#td-intro .fm-frame')); dismissIntro();
      togglePause(); report('pause', msgEl); togglePause();
      showRecord(); report('record', msgEl); msgEl.classList.add('hidden'); paused = false;
      // the debrief, both stages, on the ?debrief fixtures
      rs.kills = { phage: 23, ghost: 11, scoutufo: 6, drifter: 3, corona: 2 };
      rs.bySrc = { tank: 19, tower: 21, strike: 5 };
      rs.rams = 14; rs.shells = 6; rs.strikes = 1; rs.maxCombo = 4;
      rs.scoreBins = [0, 120, 340, 900, 1400, 1450, 2100, 3300, 3600, 4200];
      rs.bestShell = { kills: 3, wave: 4 };
      rs.bestStrike = { kills: 5, wave: 6, replay: { radius: 3.2, portals: 1, bodies: [] } };
      renderAnalysis(false); report('analysis', msgEl);
      msgEl.querySelector('.msg-proceed').click(); report('verdict', msgEl);
      // the campaign screen, on the ?campaign fixtures
      const mk = (r, k, e, sp, hl) => ({ round: r, waves: 15, secs: 200 + r * 40, kills: k,
        tank: Math.round(k * 0.4), tower: Math.round(k * 0.5),
        strike: k - Math.round(k * 0.4) - Math.round(k * 0.5), earned: e, spent: sp,
        hullsLost: hl, heartHits: hl, heart: 10 - hl, towers: 4 + r * 2, held: e - sp,
        bestShell: 3, bestStrike: 5, full: r !== 2 });
      campaign.push(mk(1, 45, 900, 610, 0), mk(2, 62, 1400, 1300, 1), mk(3, 88, 2100, 1750, 1));
      setCoins(1); renderVerdict(true); report('campaign', msgEl);
      msgEl.classList.add('hidden'); paused = false;
      document.body.classList.add('vars-open');
      report('vars', document.querySelector('#td-vars'));
      document.body.classList.remove('vars-open');
    }, 1200);
  }

  // ?rosterprobe=1 — WHICH BOARD IS THIS, and did its models arrive. A
  // screenshot of a tower forty pixels across cannot tell a Rotor from a
  // Quiver, and a look whose bytes failed silently falls back to a braille
  // mast — which is exactly the failure that looks like success.
  if (urlParams.get('rosterprobe') === '1') {
    // WAIT FOR THE BYTES. A look with async assets is not ready the moment
    // the tab is: probing before the preload resolves reports the fallback
    // and calls it a failure, which is a probe lying about the thing it
    // exists to check.
    preloadLook(params.towerLook).then((ok) => {
      console.log(`ROSTERPROBE preload ${params.towerLook} → ${ok}`);
      console.log(`ROSTERPROBE board ${ROSTER.id} "${ROSTER.label}" look=${params.towerLook}`
        + ` ready=${lookReady(params.towerLook)}`);
      for (const d of TOWERS) {
        const obj = buildTowerLook(params.towerLook, d);
        let meshes = 0, points = 0;
        obj.traverse((o) => { if (o.isMesh) meshes++; if (o.isPoints) points++; });
        console.log(`ROSTERPROBE ${String(d.key).padEnd(9)} "${d.label}" ${d.attack}`
          + ` cost ${d.cost} range ${d.range} rate ${d.rate} model=${d.model || '-'}`
          + ` → ${meshes} mesh ${points} points`
          + `${points > 0 ? ' FELL BACK TO BRAILLE' : ''}`);
      }
      console.log(`ROSTERPROBE ladder ${TOWER_ORDER.join(' ')} · gated ${HACK_GATED.join(' ') || '-'}`);
    });
  }

  // ?a6=1 — PUT ONE ON THE BOARD AND WATCH IT LIVE. The pure module proves
  // the loop; this proves it is wired to a board that moves — that it sees
  // the board's own enemies from wherever it is standing, that its rockets
  // are the board's rockets, that it leaves its berth and comes back to it,
  // and that the cassette actually empties against things that are dying.
  if (urlParams.get('a6') === '1') {
    setTimeout(() => {
      // THE BOARD STARTS PAUSED behind the landing brief, and a probe that
      // does not clear it measures a frozen game and reports a frozen unit.
      // This is the same two lines the debrief probe uses.
      // BOTH CURTAINS. The board starts behind the landing brief AND the
      // field manual, and hiding one leaves the other over the picture — a
      // probe that is meant to produce a photograph has to clear what is in
      // front of the camera, not just what is pausing the clock.
      for (const id of ['#td-msg', '#td-intro']) {
        const el = root.querySelector(id);
        if (el) el.classList.add('hidden');
      }
      paused = false;
      eco.addBiomass(4000);
      let tw = null;
      for (let i = 0; i < dungeon.tags.length && !tw; i++) {
        if (!placeError(i)) tw = commitTower('heptapod', i, 0);
      }
      if (!tw || !tw.a6) { console.log('A6PROBE could not place one'); return; }
      const berth = tw.a6.pos.slice();
      // A HARD UNIT TO SHOOT AT. The A6 only engages the not-rammable tier,
      // which is the right behaviour and makes it look broken in wave 1 —
      // the early waves are all fodder. So the probe puts one on the board
      // rather than waiting eight waves to find out whether it works.
      const hardType = Object.keys(ENEMY_SPEC).find((k) => !ENEMY_SPEC[k].rammable);
      const near = openNeighbors(tw.ci)[0] ?? tw.ci;
      {
        const spec = ENEMY_SPEC[hardType];
        // ?a6ram=1 walks the MACHINE onto the enemy rather than the other
        // way round: an enemy's position is recomputed from its cell path
        // every frame, so planting one on top of the A6 lasts exactly one
        // tick. The A6 keeps a standoff from what it shoots, so incidental
        // contact is rare and this path would otherwise go unexercised.
        const obj = makeDotEnemy(hardType, { walker: CREATURE_TINTS[hardType], walkerHi: accentFor(hardType) });
        const s0 = cellSide * spec.size * 0.7;
        obj.scale.setScalar(s0); obj.userData.s0 = s0;
        scene.add(obj);
        enemies.push({
          type: hardType, spec, scale0: s0, size: spec.size,
          cur: near, prev: -1, next: near, prog: 0,
          pos: graph.centers[near].slice(), dir: [0, 1, 0],
          obj, alive: true, phase: 0, paceJitter: 1,
          hp: 40, behMult: 1, behUntil: -1, touchCd: -1,
          slowFactor: 1, slowUntil: -1,
        });
        console.log(`A6PROBE planted a hard ${hardType} (rammable=${spec.rammable}) at cell ${near}`);
      }
      // ?a6=1&a6post=N — SEND IT SOMEWHERE and watch it go. The order is a
      // menu item on a cell, which a headless run cannot tap, so the probe
      // calls the same function the button does.
      const postWant = parseInt(urlParams.get('a6post') || '-1', 10);
      if (postWant >= 0) {
        setTimeout(() => {
          const ci2 = openNeighbors(openNeighbors(tw.ci)[0] ?? tw.ci)[0] ?? tw.ci;
          console.log(`A6PROBE posting to cell ${ci2} (was berthed at ${tw.ci})`);
          console.log(`A6PROBE post accepted=${postWalker(ci2)}`);
        }, 3000);
      }
      // ?a6kill=1 — hit it until it dies, through the same path an enemy
      // uses, so the wreck and the removal are exercised rather than assumed
      if (urlParams.get('a6kill') === '1') {
        setTimeout(() => {
          console.log(`A6PROBE killing: hp ${tw.hp}/${tw.hp0} towers=${towers.length}`);
          for (let k = 0; k < (tw.hp0 ?? 9) + 2 && tw.hp > 0; k++) {
            tw.hp -= 1;
            if (tw.hp <= 0) killWalker(tw);
          }
          console.log(`A6PROBE killed: towers=${towers.length}`
            + ` stillListed=${towers.includes(tw)} byCell=${!!towerByCell.get(tw.ci)}`
            + ` inScene=${tw.obj.parent === scene}`);
        }, 6000);
      }
      if (urlParams.get('a6ram') === '1') {
        const shove = setInterval(() => {
          const hard = enemies.find((e) => e.alive && !e.spec.rammable);
          if (!hard || !towers.includes(tw)) { clearInterval(shove); return; }
          tw.a6.pos = hard.pos.slice();
        }, 100);
      }
      let n = 0;
      const tick = setInterval(() => {
        n++;
        const a = tw.a6;
        // THE LEGS. A screenshot of a walking machine and a screenshot of a
        // sliding one are the same picture, so the probe reads a named joint
        // out of the live hierarchy and reports whether its rotation is
        // actually CHANGING. That is the only thing that separates "the clip
        // is playing" from "the clip loaded".
        // LEG_00_KNEE is a node the Walk clip actually addresses — read off
        // the file's own channel list, not guessed. The first cut watched
        // LEG_00_MOUNT, which the clip never touches, and reported a
        // stationary joint on a machine whose legs were fine.
        const leg = tw.obj.getObjectByName('LEG_00_KNEE');
        const rot = leg ? leg.rotation.toArray().slice(0, 3).map((v) => v.toFixed(3)).join(',') : '-';
        const moved = leg && tw.a6.lastRot && rot !== tw.a6.lastRot;
        if (leg) tw.a6.lastRot = rot;
        console.log(`A6PROBE t+${n}s ${a6Line(a)} · ${a.state}`
          + ` · legs ${leg ? (moved ? 'MOVING' : 'still') : 'NO JOINT FOUND'}`
          + ` (${leg ? leg.name : '-'} ${rot})`
          + ` · mixer ${tw.obj.userData.mixer ? 'yes' : 'NO'}`
          + ` · heading ${tw.a6.head ? tw.a6.head.map((v) => v.toFixed(2)).join(',') : 'NONE'}`
          + ` · facing ${(() => {
            // DOES THE MODEL'S NOSE POINT WHERE IT IS WALKING? The one thing
            // a screenshot of a six-legged machine cannot answer, and the
            // difference between walking and crabbing.
            if (!tw.a6.head) return '-';
            const f = new THREE.Vector3(0, 0, 1).applyQuaternion(tw.obj.quaternion);
            const d = f.x * tw.a6.head[0] + f.y * tw.a6.head[1] + f.z * tw.a6.head[2];
            return `${(Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI).toFixed(0)}deg off`;
          })()}`
          + ` · ${(a6Arc(berth, a.pos) / cellSide).toFixed(2)} cells from berth`
          + ` · fired ${a.fired} · trips ${a.trips}`
          + ` · target ${a.target ?? '-'} · enemies ${enemies.filter((e) => e.alive).length}`
          + ` · lock ${a.state === 'lockon' || (tw.lock && tw.lock.locked) ? (tw.lock && tw.lock.locked ? 'LOCKED' : ((tw.lock && tw.lock.meter) || 0).toFixed(2)) : '-'}`
          + ` · seekers ${towerSeekers.filter((m) => m.by === tw).length}`
          + ` · rings ${(tw.rings || []).filter((r) => r.visible).length}/${(tw.rings || []).length}`
          + ` · hard ${enemies.filter((e) => e.alive && !e.spec.rammable).length}`
          + ` · hp ${tw.hp}/${tw.hp0} · post ${a.postCi ?? '-'}`
          + ` · toPost ${a.postCi === undefined ? '-' : (a6Arc(a.pos, a.berth) / cellSide).toFixed(2) + 'c'}`);
        // a dead A6 is off the board; the probe holds the last reference and
        // would otherwise go on narrating a machine that no longer exists
        if (!towers.includes(tw)) { console.log('A6PROBE gone'); clearInterval(tick); return; }
        if (n >= 30) clearInterval(tick);
      }, 1000);
    }, 2500);
  }

  // ?alltowers=1 — ONE OF EVERY TOWER ON THE BOARD, so the models can be
  // looked at rather than described. It also answers the question the
  // rosterprobe cannot: whether the board's OWN boot path preloads the look,
  // which it did not until this — applyTowerLook was reachable only from the
  // panel, so every tower came up as the loading marker and stayed there.
  if (urlParams.get('alltowers') === '1') {
    setTimeout(() => {
      // BOTH CURTAINS. The board starts behind the landing brief AND the
      // field manual, and hiding one leaves the other over the picture — a
      // probe that is meant to produce a photograph has to clear what is in
      // front of the camera, not just what is pausing the clock.
      for (const id of ['#td-msg', '#td-intro']) {
        const el = root.querySelector(id);
        if (el) el.classList.add('hidden');
      }
      paused = false;
      eco.addBiomass(9000);
      let n = 0;
      for (let i = 0; i < dungeon.tags.length && n < TOWERS.length; i++) {
        if (placeError(i) || towerByCell.get(i)) continue;
        if (commitTower(TOWERS[n].key, i, 0)) n++;
        i += 2;   // spread them out so they can be told apart
      }
      let points = 0, meshes = 0;
      for (const tw of towers) {
        tw.obj.traverse((o) => { if (o.isPoints) points++; if (o.isMesh) meshes++; });
      }
      console.log(`ALLTOWERS placed ${towers.length}/${TOWERS.length} · look=${params.towerLook}`
        + ` ready=${lookReady(params.towerLook)} · ${meshes} mesh ${points} points`
        + (towers.some(tw => tw.obj.userData.loading) ? ' — models loading' : ' — all models'));
      for (const tw of towers) {
        let m = 0, pt = 0;
        const shades = [];
        let tris = 0;
        tw.obj.traverse((o) => {
          if (o.isPoints) pt++;
          if (!o.isMesh) return;
          m++;
          // TRIANGLES, not meshes. A merged model has one mesh per material
          // however much geometry is in it, so the mesh count cannot tell a
          // Base tier from a Maximum one — which is the whole thing being
          // checked when the equipment tier moves.
          const g2 = o.geometry;
          if (g2) tris += (g2.index ? g2.index.count : (g2.attributes.position || {}).count || 0) / 3;
          for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
            if (!mat || !mat.color) continue;
            const h = {}; mat.color.getHSL(h);
            shades.push({ n: mat.name || '?', l: h.l });
          }
        });
        // THE SPREAD IS THE READ. A model whose materials all sit at one
        // lightness arrives as a single pale mass however good the mesh is —
        // which is what a wash-only tint produced. This is the number that
        // says whether the ladder is doing anything.
        const ls = shades.map((x) => x.l);
        const span = ls.length ? Math.max(...ls) - Math.min(...ls) : 0;
        const byName = [...new Map(shades.map((x) => [x.n, x.l])).entries()]
          .map(([n, l]) => `${n}:${l.toFixed(2)}`).join(' ');
        console.log(`ALLTOWERS ${String(tw.key).padEnd(9)} ${m} mesh ${Math.round(tris)} tris ${pt} points`
          + ` · lightness span ${span.toFixed(2)}${span < 0.15 ? ' — FLAT MASS' : ''}`
          + ` · ${byName}`
          + `${tw.a6 ? ` · walker, mixer=${!!tw.obj.userData.mixer}` : ''}`);
      }
    }, 2600);
  }

  // ?plasmaprobe=1 — IS IT LIT, AND IS IT POINTING DOWN. The whole ask was
  // "the tank's secondary, downward", and both halves are invisible to a
  // still: a beam that never lights and a beam drawn flat along the ground
  // photograph as an empty wall from most angles. This reads the live link
  // endpoints and reports the radius it starts at, the radius it ends at,
  // and therefore whether the throw actually descends.
  if (urlParams.get('plasmaprobe') === '1') {
    setTimeout(() => {
      for (const id of ['#td-msg', '#td-intro']) {
        const el = root.querySelector(id);
        if (el) el.classList.add('hidden');
      }
      paused = false;
      eco.addBiomass(6000);
      const def = TOWER_BY_KEY.plasma;
      if (!def) { console.log('PLASMAPROBE no plasma on this board'); return; }
      // TOGETHER, AND WHERE THE ENEMIES GO. The first cut took the first
      // placeable cells in index order and scattered them: the Lancer landed
      // twenty-four cells from the lane with nothing in its seven-cell reach
      // and reported "never fired", which says nothing about the weapon and
      // everything about where the probe put it.
      const wants = ['plasma', 'lancer', 'quiver', 'mortar', 'needle'];
      const sites = [];
      for (let i = 0; i < dungeon.tags.length; i++) {
        if (!placeError(i) && !towerByCell.get(i)) sites.push(i);
      }
      const anchor = sites[0];
      sites.sort((a, b) => chord(graph.centers[anchor], graph.centers[a])
        - chord(graph.centers[anchor], graph.centers[b]));
      let placed = 0;
      for (const ci of sites) {
        if (placed >= wants.length) break;
        if (commitTower(wants[placed], ci, 0)) placed++;
      }
      let n = 0;
      const tick = setInterval(() => {
        n++;
        // ...and DOES THE TURRET TRACK. The lab's whole answer was that a
        // sentry aims with a drive: yaw and elevation moving at their own
        // rates toward the thing it is shooting. A tower that fires without
        // turning is scenery with a muzzle flash.
        for (const tw of towers) {
          const ud = tw.obj.userData;
          if (!ud.head) continue;
          const y = (ud.head.rotation.y * 180 / Math.PI).toFixed(1);
          const e = ud.pitchNode ? (-ud.pitchNode.rotation.x * 180 / Math.PI).toFixed(1) : '-';
          const wantY = tw.aim === undefined ? '-' : (tw.aim * 180 / Math.PI).toFixed(1);
          const wantE = tw.elev === undefined ? '-' : (tw.elev * 180 / Math.PI).toFixed(1);
          console.log(`PLASMAPROBE   rig ${String(tw.key).padEnd(9)}`
            + `${tw.def.arc ? ' LOB' : '    '}`
            + ` yaw ${y}→${wantY} elev ${e}→${wantE}`
            + ` muzzles ${(ud.muzzles || []).length} recoil ${(tw.recoil ?? 0).toFixed(2)}`);
        }
        let lit = 0, worst = null;
        for (const [tw, ent] of plasmaBeams) {
          if (!ent.links[0] || !ent.links[0].mesh.visible) continue;
          lit++;
          const a = ent.links[0].uniforms.uStart.value;
          const b = ent.links[PLASMA_LINKS - 1].uniforms.uEnd.value;
          worst = { r0: a.length(), r1: b.length(), ci: tw.ci };
        }
        console.log(`PLASMAPROBE t+${n}s ${placed} towers · ${lit} beam(s) lit`
          + ` · enemies ${enemies.filter((e) => e.alive).length}`
          + (worst
            ? ` · from r=${worst.r0.toFixed(3)} to r=${worst.r1.toFixed(3)}`
              + ` — ${worst.r1 < worst.r0 - 1e-4 ? 'DOWNWARD' : worst.r1 > worst.r0 + 1e-4 ? 'UPWARD' : 'level'}`
              + ` (${((worst.r0 - worst.r1) / cellSide).toFixed(2)} cells of drop)`
            : ' · nothing lit'));
        // THE LANCE: how many bodies one burst went through. A piercing
        // weapon that only ever hits the thing it aimed at is a slow gun
        // with extra words, so the count IS the feature.
        for (const tw of towers) {
          if (tw.def.attack !== 'lance') continue;
          const eff2 = effectiveStats(tw.def, tw.tier);
          const tgt = pickTarget(graph.centers[tw.ci], eff2.range * cellSide, enemies, chord);
          const ent = plasmaBeams.get(tw);
          // DOES THE BEAM LEAVE THE MUZZLE, and does it end where the ray
          // says the terrain is? Both are geometry a screenshot cannot
          // settle at forty pixels, and both were wrong before: the beam was
          // drawn from a point normalised onto the sphere and lifted to a
          // nominal wall height, so it started neither at the barrel nor at
          // the barrel's altitude.
          let gap = '-', ends = '-';
          if (ent && ent.links[0] && tw.lastMuzzle) {
            tw.lastMuzzle.getWorldPosition(aimV);
            const a0 = ent.links[0].uniforms.uStart.value;
            gap = `${(a0.distanceTo(aimV) / cellSide).toFixed(3)}c`;
            const e0 = ent.links[PLASMA_LINKS - 1].uniforms.uEnd.value;
            ends = `${(e0.length()).toFixed(4)}r`;
          }
          console.log(`PLASMAPROBE   lance ${tw.ci} struck ${tw.lastStruck ?? '-'} this burst`
            + ` · cool ${tw.cooldown.toFixed(2)} · target ${tgt ? 'yes' : 'NO'}`
            + ` · muzzle gap ${gap} · ends at ${ends}`
            + ` · err ${(tw.aimErr ?? -1).toFixed(1)}deg`
            + ` · stopped by ${(tw.lastStop && tw.lastStop.hit) || 'nothing'}`
            + ` (${tw.lastStop ? (tw.lastStop.len / cellSide).toFixed(1) : '-'}/${eff2.range}c)`
            + ` · lit ${!!(ent && ent.links[0].mesh.visible)}`);
        }
        // THE QUIVER: is it locking, and are missiles in the air. Both are
        // invisible to a still — an unlocked launcher and a broken one look
        // exactly the same, which is a turret pointing at something and not
        // shooting.
        for (const tw of towers) {
          if (!tw.def.lock) continue;
          console.log(`PLASMAPROBE   quiver ${tw.ci}`
            + ` ${tw.lock && tw.lock.locked ? 'LOCKED' : `seeking ${((tw.lock && tw.lock.meter) || 0).toFixed(2)}`}`
            + ` · ${towerSeekers.filter((m) => m.by === tw).length} in the air`
            + ` · cool ${tw.cooldown.toFixed(2)}`
            + ` · seekers hit ${seekerHits} lost ${seekerLost}`);
        }
        if (n >= 20) clearInterval(tick);
      }, 1000);
    }, 2600);
  }

  // ?vpprobe=1 — DOES THE BIAS PUT THE TANK WHERE THE PLAYER CAN SEE IT.
  // Pair it with ?vpbias= to name a visible band. It reports the tank's
  // screen y with the correction applied and whether that y is inside the
  // band — which is the entire question the `chrome` verdict was asking and
  // nobody could answer without a phone.
  if (urlParams.get('vpprobe') === '1') {
    setTimeout(() => {
      for (const el of ['#td-msg', '#td-intro']) {
        const e = root.querySelector(el);
        if (e) e.classList.add('hidden');
      }
      paused = false;
      setView('third');
      let n = 0;
      const tick = setInterval(() => {
        n++;
        snapCamera();
        const s2 = tankSight();
        const band = vpFake || window.visualViewport;
        const cv = renderer.domElement;
        const lo = band ? band.offsetTop : 0;
        const hi = band ? lo + band.height : cv.clientHeight;
        console.log(`VPPROBE t+${n}s bias=${camBiasNdc.toFixed(3)}`
          + ` canvas=${cv.clientWidth}x${cv.clientHeight} band=${lo}..${hi}`
          + ` tank=${s2.x.toFixed(0)},${s2.y.toFixed(0)} r${s2.px.toFixed(0)}px`
          + ` inBand=${s2.y >= lo && s2.y <= hi} why=${s2.why}`);
        if (n >= 4) clearInterval(tick);
      }, 700);
    }, 2600);
  }

  // ?drones=1 — buy the assistant, put three orders on the book, drive both
  // workers, and check they split the queue and all three land.
  if (urlParams.get('drones') === '1') {
    Promise.all([preloadFabricator(), spawnIsao()]).then(() => spawnAssistant()).then(() => {
      eco.addBiomass(2000);
      let placed = 0;
      for (let i = 0; i < dungeon.tags.length && placed < 3; i++) {
        if (dungeon.tags[i] === BLOCKED && !placeError(i) && graph.adj[i].some((nb) => dungeon.tags[nb] !== BLOCKED)) {
          if (orderTower(starterTower().key, i, { quiet: true })) placed++;
        }
      }
      const seen = new Set();
      let t2 = 0;
      for (; t2 < 60 && orders.length; t2 += 0.05) {
        updateIsao(0.05);
        for (const o of orders) if (o.worker) seen.add(o.worker === isao ? 'isao' : 'drone2');
      }
      console.log(`DRONES assistant=${!!assistant} orders placed=${placed}`
        + ` workers that claimed something=[${[...seen].join(',')}]`
        + ` left=${orders.length} after ${t2.toFixed(1)}s`
        + ` ${seen.size === 2 && orders.length === 0 ? 'BOTH DRONES BUILT, QUEUE DRAINED' : '<-- one worker or stuck'}`);
    });
  }
  // ?autoup=1 — flood the purse, switch auto-upgrade on, and count the orders
  // the drones place by themselves in 20s (and that the reserve holds).
  if (urlParams.get('autoup') === '1') {
    Promise.all([preloadFabricator(), spawnIsao()]).then(() => {
      eco.addBiomass(1200);
      params.autoUpgrade = true;
      const t0 = towers.map((tw) => tw.tier).join('');
      let made = 0;
      for (let t2 = 0; t2 < 40; t2 += 0.05) {
        const n0 = orders.length;
        autoUpgradeTick(0.05); updateIsao(0.05);
        if (orders.length > n0) made++;
      }
      console.log(`AUTOUP towers=${towers.length} tiers ${t0} -> ${towers.map((tw) => tw.tier).join('')}`
        + ` orders placed=${made} biomass left=${eco.biomass}`
        + ` ${made > 0 && eco.biomass >= AUTO_RESERVE ? '(upgraded, reserve held)' : '<-- nothing upgraded or reserve breached'}`);
    });
  }

  // ?sensorprobe=1 — plant one SOLID contact ahead-starboard at half the
  // scope's reach and read the sensor: starboard at level 2, nothing else.
  if (urlParams.get('sensorprobe') === '1') {
    setTimeout(() => {
      const basis = radarBasis(player.pos, player.smoothDir);
      const reach = 1.15;
      const put = (fwd, right) => norm3([player.pos[0] + basis.fwd[0] * fwd + basis.right[0] * right,
        player.pos[1] + basis.fwd[1] * fwd + basis.right[1] * right,
        player.pos[2] + basis.fwd[2] * fwd + basis.right[2] * right]);
      // the cell rule, one contact per sector: ahead 5 cells (nothing),
      // starboard 4 (blue), astern 3 (orange), port 2 (red)
      const c = cellSide;
      const secs = proximitySectors([put(5 * c, 0), put(0, 4 * c), put(-3 * c, 0), put(0, -2 * c)], player.pos, basis, reach, cellSide);
      sensorDemo.push({ fwd: 0, right: 4 }, { fwd: -3, right: 0 }, { fwd: 0, right: -2 });
      const levels = secs.map((x) => x.level).join('/');
      const colors = secs.map((x) => sensorColor(x.level) || 'none').join('/');
      console.log(`SENSORPROBE cells ahead/stbd/astern/port = 5/4/3/2 -> levels ${levels} colours ${colors}`
        + ` ${levels === '0/1/2/3' ? '(nothing / blue / orange / red — the rule)' : '<-- WRONG'}`
        + ` | scope reach ${reach.toFixed(2)} = ${(reach / cellSide).toFixed(1)} cells`);
    }, 1500);
  }

  // ?pedprobe=1 — push the tank straight at the heart through the cushion and
  // ?campgo=N — park the hull just inside camp N's shot distance and leave it
  // there. The probe blows through the whole sequence in one tick, so there
  // is no frame in it where a container is standing open with people walking
  // out of it; this is that frame.
  {
    const cg = parseInt(urlParams.get('campgo') || '0', 10);
    if (cg > 0) {
      setTimeout(() => {
        const camp = rescue.camps[cg - 1];
        if (!camp) { console.log(`CAMPGO no camp ${cg}`); return; }
        const nn = norm3(camp.pos);
        let t1 = cross3(nn, [0, 1, 0]);
        if (len3(t1) < 1e-3) t1 = cross3(nn, [1, 0, 0]);
        const p2 = arcPoint(nn, norm3(t1), (rescue2Tune.callCells - 0.6) * cellSide);
        const ci = cellIndex(p2);
        player.pos = p2;
        player.cur = ci >= 0 ? ci : player.cur;
        player.next = player.cur;
        player.prog = 0;
        player.freeMode = true;
        throttle = 0; cruise = false; autoMode = false;
        paintThrottle();
        setView('third');
        console.log(`CAMPGO parked at camp ${cg} cell ${ci}, asked for ${(rescue2Tune.callCells - 0.6).toFixed(1)} cells`
          + ` got ${(dist3(player.pos, camp.pos) / cellSide).toFixed(2)}c deploy=${!!deploy}`);
        // ...and say every second what the mission thinks is happening, so a
        // still that shows a shut container says WHY
        let n2 = 0;
        const tick = setInterval(() => {
          if (++n2 > 8) { clearInterval(tick); return; }
          console.log(`CAMPGO t+${n2}s dist=${(dist3(player.pos, camp.pos) / cellSide).toFixed(2)}c`
            + ` call=${rescue2Tune.callCells} open=${camp.open} out=${camp.out}`
            + ` models=${astroObjs.size} frozen=${buildFrozen()} shot=${shotActive()} won=${player.won}`
            + ` box=${campObjs.has(camp.id)}`);
        }, 1000);
      }, 5000);   // AFTER the berth deploy, which drives the hull and would undo this
    }
  }

  // ?rescue2probe=1 — the raid's own log line. Drives the board's stepRescue2,
  // so shot distance, the doors, the emerge stagger, the walk, the save and
  // the run-over are all exercised through the code the player touches.
  if (urlParams.get('rescue2probe') === '1') {
    preloadAstronauts().then(() => setTimeout(() => {
      if (!rescue2On) { console.log('RESCUE2PROBE needs ?mission=rescue2'); return; }
      const camp = rescue.camps[0];
      if (!camp) { console.log('RESCUE2PROBE no camps'); return; }
      const keepPos = player.pos.slice(), keepThr = throttle;
      throttle = 0; cruise = false;
      let tt = 300;
      // hold the tank at `where` for n steps: set it BEFORE each step so the
      // measured hull speed is honestly zero
      const hold = (where, n) => {
        for (let k = 0; k < n; k++) { tt += 0.05; player.pos = where.slice(); stepRescue2(0.05, tt); }
      };
      const along = (from, cells) => {
        const nn = norm3(from);
        let t1 = cross3(nn, [0, 1, 0]);
        if (len3(t1) < 1e-3) t1 = cross3(nn, [1, 0, 0]);
        t1 = norm3(t1);
        return arcPoint(nn, t1, cells * cellSide);
      };

      // 1. OUT OF SHOT DISTANCE the container stays shut
      hold(along(camp.pos, rescue2Tune.callCells + 1.0), 20);
      console.log(`RESCUE2PROBE far   open=${camp.open} out=${camp.out}`
        + ` ${!camp.open ? 'SHUT — correct' : '<-- opened from out of range'}`);

      // 2. INSIDE IT, it opens and they start coming out
      const near = along(camp.pos, rescue2Tune.callCells - 0.5);
      hold(near, 60);
      console.log(`RESCUE2PROBE call  open=${camp.open} out=${camp.out}/${camp.group.length}`
        + ` doors=${(campObjs.get(camp.id) || {}).doorT?.toFixed?.(2) ?? '-'}`
        + ` models=${astroObjs.size}`
        + ` ${camp.open && camp.out > 0 && astroObjs.size > 0 ? 'OPEN, WALKING, RENDERED' : '<-- nobody came out'}`);

      // 3. HOLD STILL and they arrive
      const saved0 = rescue.saved;
      hold(near, 900);
      console.log(`RESCUE2PROBE hold  saved=${rescue.saved} (was ${saved0}) lost=${rescue.lost}`
        + ` walking=${rescue.survivors.filter((x) => x.state === 'walking').length}`
        + ` ${rescue.saved > saved0 ? 'THEY REACHED THE TANK' : '<-- nobody arrived'}`);

      // 4. THE RUN-OVER. A second camp, opened, and then the hull MOVES
      // through the walker instead of waiting for it.
      const c2 = rescue.camps[1];
      if (c2) {
        const n2 = along(c2.pos, rescue2Tune.callCells - 0.5);
        hold(n2, 60);
        const sv = c2.group.find((x) => x.state === 'walking');
        const lost0 = rescue.lost, splash0 = splashes.length;
        if (sv) {
          // drive THROUGH where the walker is standing: two steps a whole
          // cell apart, which is far faster than runoverSpeed
          for (let k = 0; k < 6; k++) {
            tt += 0.05;
            player.pos = arcPoint(norm3(sv.pos), norm3(cross3(norm3(sv.pos), [0, 1, 0])), cellSide * (0.6 - k * 0.25));
            stepRescue2(0.05, tt);
          }
        }
        console.log(`RESCUE2PROBE over  lost=${rescue.lost} (was ${lost0})`
          + ` splashes=${splashes.length} (was ${splash0}) speed=${tankSpeedCells.toFixed(2)} c/s`
          + ` ${rescue.lost > lost0 && splashes.length > splash0 ? 'RUN OVER, AND THE RED STAYS' : '<-- nothing was run over'}`);
      }

      // 5. the roster runs out and the card fires on its own
      for (const x of rescue.survivors) {
        if (x.state === 'inside' || x.state === 'walking') { x.state = 'lost'; rescue.lost++; dropAstronaut(x.id); }
      }
      hold(keepPos, 2);
      console.log(`RESCUE2PROBE end   ended=${rescueEnded} saved=${rescue.saved} lost=${rescue.lost}`
        + ` ${rescueEnded ? 'THE CARD FIRED' : '<-- mission did not end'}`);
      player.pos = keepPos; throttle = keepThr;
    }, 2200));
  }

  // ?rescueprobe=1 — the mission's own log line. Drives the board's stepRescue
  // rather than the module, so the stop clause, the seats, the delivery and
  // the end card are exercised through the code the player touches.
  if (urlParams.get('rescueprobe') === '1') {
    setTimeout(() => {
      if (!rescueOn) { console.log('RESCUEPROBE needs ?mission=rescue'); return; }
      const sv = rescue.survivors[0], sv2 = rescue.survivors[1];
      if (!sv) { console.log('RESCUEPROBE nobody stranded'); return; }
      const keepPos = player.pos.slice(), keepThr = throttle;
      let tt = 200;
      const run = (n) => { for (let k = 0; k < n; k++) { tt += 0.05; stepRescue(0.05, tt); } };

      // 1. THE STOP CLAUSE. Standing right on top of a beacon at full
      // throttle must do nothing at all — that is the whole clause.
      throttle = 1; cruise = false;
      player.pos = sv.pos.slice();
      run(40);
      console.log(`RESCUEPROBE past  throttle=1 aboard=${aboardSurv(rescue)}`
        + ` boardT=${sv.boardT.toFixed(2)}`
        + ` ${aboardSurv(rescue) === 0 && sv.boardT === 0 ? 'NOTHING HAPPENS — correct' : '<-- boarded while driving'}`);

      // 1b. THE PHONE'S DRIVE-BY. Lever at zero — the shell has no lever —
      // but the hull moving. This is the case the throttle clause alone
      // cannot see, and the case the phone would hit every single time.
      throttle = 0;
      const n0 = norm3(sv.pos);
      const t0 = norm3([-n0[2], 0, n0[0]]);
      for (let k = 0; k < 40; k++) {
        tt += 0.05;
        player.pos = arcPoint(n0, t0, cellSide * (-0.9 + k * 0.045));
        stepRescue(0.05, tt);
      }
      console.log(`RESCUEPROBE roll  lever=0 but MOVING aboard=${aboardSurv(rescue)}`
        + ` boardT=${sv.boardT.toFixed(2)}`
        + ` ${aboardSurv(rescue) === 0 ? 'NOTHING HAPPENS — correct' : '<-- boarded on the roll'}`);

      // 2. stop on it
      player.pos = sv.pos.slice();
      throttle = 0;
      run(40);
      console.log(`RESCUEPROBE load  stopped aboard=${aboardSurv(rescue)} state=${sv.state}`
        + ` ${sv.state === 'aboard' ? 'ABOARD' : '<-- did not board'}`);

      // 3. the second seat, then a third refused
      if (sv2) { player.pos = sv2.pos.slice(); run(40); }
      const third = rescue.survivors[2];
      if (third) { player.pos = third.pos.slice(); run(40); }
      console.log(`RESCUEPROBE seats aboard=${aboardSurv(rescue)}/${rescueTune.seats}`
        + ` third=${third ? third.state : '-'}`
        + ` ${aboardSurv(rescue) === rescueTune.seats ? 'THE HATCH IS FULL' : '<-- seats wrong'}`);

      // 4. home
      player.pos = graph.centers[dungeon.heart].slice();
      run(10);
      console.log(`RESCUEPROBE home  saved=${rescue.saved} aboard=${aboardSurv(rescue)}`
        + ` standing=${standingSurv(rescue)}`
        + ` ${rescue.saved === rescueTune.seats ? 'DELIVERED' : '<-- not delivered'}`);

      // 5. the end card: everyone still down there is written off, and the
      // mission must notice on its own
      player.pos = keepPos.slice();
      for (const x of rescue.survivors) {
        if (x.state === 'standing') { x.state = 'lost'; rescue.lost++; dropSurvivor(x.id); }
      }
      run(2);
      console.log(`RESCUEPROBE end   ended=${rescueEnded} saved=${rescue.saved}`
        + ` lost=${rescue.lost} ${rescueEnded ? 'THE CARD FIRED' : '<-- mission did not end'}`);
      throttle = keepThr;
    }, 2000);
  }

  // ?minelay=N — lay a row of N ahead of the tank and leave them there. The
  // probe above blows everything it lays, so there is no frame in it where a
  // field is standing to be LOOKED at; this is that frame.
  {
    const nlay = parseInt(urlParams.get('minelay') || '0', 10);
    if (nlay > 0) {
      setTimeout(() => {
        if (!graph || !player.pos) return;
        const n0 = norm3(player.pos);
        const d0 = norm3(sub3(player.smoothDir, scale3(n0, dot3(player.smoothDir, n0))));
        for (let i = 1; i <= nlay; i++) {
          const pos = arcPoint(n0, d0, cellSide * i * 1.4);
          const r = layMine(mineField, { pos, dir: d0, cellAhead: cellIndex(pos) }, t, mineTune);
          if (r === 'laid') makeMineObj(mineField.mines[mineField.mines.length - 1]);
        }
        console.log(`MINELAY ${nlay} rack=${mineField.count} live=${mineField.mines.filter((m) => m.alive).length}`);
      }, 1500);
    }
  }

  // ?mineprobe=1 — THE FIRST RUN OF THE FEATURE IS A LOG LINE, not a play
  // session. Three beats, each the board's own stepMines rather than a second
  // copy of the rules:
  //   A  a row of three, a phage walking in from the FRONT — the ordinary
  //      case. The front mine trips and NOTHING chains, because a claymore's
  //      arc points away from the mines behind it. That is the shape, not a
  //      bug, and the probe says so out loud.
  //   B  a fresh row, a phage coming from BEHIND — the nearest mine trips and
  //      its arc holds the other two, so the row goes off as a row.
  //   C  the tank walked around IN FRONT of its own live mine. It trips, and
  //      it takes the hull down one. Friendly fire is the operator's ruling
  //      and it is the one thing a unit test cannot show landing on a HULL.
  if (urlParams.get('mineprobe') === '1') {
    setTimeout(() => {
      if (!graph || !player.pos) { console.log('MINEPROBE no board'); return; }
      const n0 = norm3(player.pos);
      const d0 = norm3(sub3(player.smoothDir, scale3(n0, dot3(player.smoothDir, n0))));
      let tt = 100;
      const spec = ENEMY_SPEC.phage;
      const s0 = cellSide * spec.size * 0.7;
      const layRow = () => {
        const out = [];
        for (let i = 1; i <= 3; i++) {
          const pos = arcPoint(n0, d0, cellSide * i * 1.2);
          const r = layMine(mineField, { pos, dir: d0, cellAhead: cellIndex(pos) }, tt, mineTune);
          out.push(`${i}:${r}`);
          if (r === 'laid') makeMineObj(mineField.mines[mineField.mines.length - 1]);
        }
        return out.join(' ');
      };
      const aliveMines = () => mineField.mines.filter((m) => m.alive).length;
      const walk = (from, to, steps) => {
        const obj = makeDotEnemy('phage', { walker: CREATURE_TINTS.phage, walkerHi: accentFor('phage') });
        obj.scale.setScalar(s0);
        scene.add(obj);
        const p0 = arcPoint(n0, d0, cellSide * from);
        const e = { type: 'phage', spec, scale0: s0, size: spec.size,
          cur: cellIndex(p0), prev: -1, next: cellIndex(p0), prog: 0,
          pos: p0, dir: d0.slice(), obj, alive: true, phase: 0,
          paceJitter: 1, hp: spec.hp, behMult: 1, behUntil: -1, touchCd: -1,
          slowFactor: 1, slowUntil: -1 };
        enemies.push(e);
        for (let k = 0; k <= steps; k++) {
          tt += 0.05;
          if (e.alive) {
            const q = arcPoint(n0, d0, cellSide * (from + (to - from) * (k / steps)));
            e.pos = q;
            e.obj.position.set(q[0], q[1], q[2]);
          }
          stepMines(0.05, tt);
        }
        return e;
      };

      console.log(`MINEPROBE A laid ${layRow()} rack=${mineField.count} hp=${playerHP}`
        + ` arcs=${params.mineArcs ? 'on' : 'off'}`);
      let n = aliveMines();
      let e = walk(5, -1, 220);
      console.log(`MINEPROBE A done blown=${n - aliveMines()}/${n}`
        + ` phage=${e.alive ? `alive hp=${e.hp}` : 'DEAD'} tankHP=${playerHP}`
        + ` ${n - aliveMines() === 1 ? 'ONE trip, no chain — the arc points away from the row'
          : '<-- expected exactly one'}`);

      // B — the same row, walked from behind: the near mine's arc holds the
      // other two, so the queue empties one blast per frame
      tt += 5;
      console.log(`MINEPROBE B laid ${layRow()} rack=${mineField.count}`);
      n = aliveMines();
      e = walk(-1, 5, 220);
      console.log(`MINEPROBE B done blown=${n - aliveMines()}/${n}`
        + ` phage=${e.alive ? `alive hp=${e.hp}` : 'DEAD'} queue=${mineField.queue.length}`
        + ` ${aliveMines() === 0 ? 'THE ROW WENT OFF AS A ROW' : '<-- mines left standing'}`);

      // C — friendly fire. The hull is moved around in front of its own live
      // mine; nothing else about the tank is touched.
      tt += 5;
      const cpos = arcPoint(n0, d0, cellSide * 1.2);
      const cres = layMine(mineField, { pos: cpos, dir: d0, cellAhead: cellIndex(cpos) }, tt, mineTune);
      if (cres === 'laid') makeMineObj(mineField.mines[mineField.mines.length - 1]);
      const keep = player.pos.slice();
      const hpC = playerHP;
      // behind it first, to prove the tank can sit at its own mine's back
      player.pos = arcPoint(n0, d0, cellSide * 0.6);
      for (let k = 0; k < 60; k++) { tt += 0.05; stepMines(0.05, tt); }
      const behindSafe = aliveMines() > 0;
      player.pos = arcPoint(n0, d0, cellSide * 1.9);
      for (let k = 0; k < 40; k++) { tt += 0.05; stepMines(0.05, tt); }
      console.log(`MINEPROBE C lay=${cres} behind=${behindSafe ? 'SAFE' : '<-- tripped from behind'}`
        + ` inFront hull ${hpC}->${playerHP}`
        + ` ${playerHP === hpC - 1 ? 'FRIENDLY FIRE LANDS' : '<-- the tank took nothing'}`
        + ` rack=${mineField.count}`);
      player.pos = keep;
    }, 1800);
  }

  // report how close it gets, against the pad radius.
  if (urlParams.get('pedprobe') === '1') {
    setTimeout(() => {
      const hc = graph.centers[dungeon.heart];
      let p2 = norm3(add3(hc, scale3(norm3(sub3(graph.centers[dungeon.spawn], hc)), cellSide * 4)));
      let closest = Infinity;
      for (let i = 0; i < 400; i++) {
        p2 = norm3(add3(p2, scale3(norm3(sub3(hc, p2)), cellSide * 0.05)));
        p2 = wallCushion(p2);
        closest = Math.min(closest, dist3(p2, hc));
      }
      const pad = pedestalRadius();
      console.log(`PEDPROBE closest approach ${(closest / cellSide).toFixed(2)} cells,`
        + ` pad radius ${(pad / cellSide).toFixed(2)} cells`
        + ` ${closest >= pad ? '(kept OUT — solid)' : '<-- DROVE UNDER'}`);
    }, 1500);
  }

  // ?newplanet=1 — press the final verdict's button without earning it
  if (urlParams.get('newplanet') === '1') {
    setTimeout(() => {
      const before = { seed: params.seed, points: params.points, rooms: params.rooms, cells: graph.centers.length };
      params.newPlanet();
      console.log(`NEWPLANET check: seed ${before.seed}->${params.seed}`
        + ` points ${before.points}->${params.points} rooms ${before.rooms}->${params.rooms}`
        + ` cells ${before.cells}->${graph.centers.length}`
        + ` ${params.seed !== before.seed && graph.centers.length > before.cells ? 'DIFFERENT AND BIGGER' : '<-- same or not bigger'}`);
    }, 1500);
  }

  // ?sitrep=1 — fabricated wave stats through the real renderer
  if (urlParams.get('sitrep') === '1') {
    resetWaveStats();
    ws.kills = { phage: 8, ghost: 5, corona: 3, barbed: 1 };
    ws.bySrc = { tank: 7, tower: 9, strike: 1 };
    ws.rams = 5; ws.leaks = 1; ws.maxMult = 1.65;
    ws.bins = [0, 2, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    ws.t0 = runContext.time - 42;
    showSitrep();
  }

  // EVERY SHIELD_TUNE KNOB BY NAME — ?tapOutage=8, ?coolSecs=3, ?shoveCells=1.4.
  // The same door SENTRY_TUNE and BALLISTICS_TUNE already use, rather than a
  // tuner panel invented for this one feature. The knob table carries the
  // range and the value is CLAMPED to it: a URL is untrusted input like any
  // other, including our own from a stale bookmark.
  for (const k of SHIELD_KNOBS) {
    const raw = urlParams.get(k.key);
    if (raw === null) continue;
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) continue;
    shieldTune[k.key] = Math.min(k.max, Math.max(k.min, v));
  }
  // the rack and the pad budget were sized from the tune at construction, so
  // they have to be re-read after an override — and this must run BEFORE
  // ?shieldrack=N, or an explicit rack size is overwritten by the default.
  shield.rack = Math.min(shieldTune.rackCap, shieldTune.rackStart);
  shield.stationLeft = shieldTune.stationBudget;

  // ?winprobe=1 — THE ENDING. Kills every spawn and every enemy, then reports
  // the sequence: the shout, the camera actually LEAVING, and the debrief
  // arriving after it rather than instead of it.
  //
  // A four-second camera move is the definition of a thing a screenshot
  // cannot check — a still of the wide shot and a still of a camera that
  // snapped there instantly are the same picture. So this samples the
  // camera's DISTANCE over the move and asserts it climbs.
  if (urlParams.get('winprobe') === '1') {
    setTimeout(() => {
      for (const id of ['#td-msg', '#td-intro']) {
        const el = root.querySelector(id);
        if (el) el.classList.add('hidden');
      }
      paused = false;
      tutorial.frozen = false;
      if (!graph) { console.log('WINPROBE no board'); return; }
      const r0 = camera.position.length();
      for (const sp of spawnPoints) sp.alive = false;
      for (const e of enemies) e.alive = false;
      checkVictory();
      const shouted = !!(calloutsEl && calloutsEl.textContent.match(/VANQUISHED|CLEARED/));
      console.log(`WINPROBE fired shot=${shotId()} shouted=${shouted} r0=${r0.toFixed(2)}`
        + ` ${shotId() === 'victory' && shouted ? 'OK' : 'WRONG — no shout or no camera move'}`);
      const samples = [];
      const iv = setInterval(() => samples.push(camera.position.length()), 250);
      setTimeout(() => {
        clearInterval(iv);
        const climbed = samples.length > 3 && samples[samples.length - 1] > samples[0] + 0.4;
        const monotonic = samples.every((v, i) => i === 0 || v >= samples[i - 1] - 0.05);
        console.log(`WINPROBE camera ${samples.map((v) => v.toFixed(2)).join(' -> ')}`);
        console.log(`WINPROBE pull-out climbed=${climbed} monotonic=${monotonic}`
          + ` ${climbed && monotonic ? 'OK'
            : 'WRONG — the camera did not leave, or it jumped'}`);
        // ...and the camera must still be wide once the debrief is up, which
        // is the half the first version missed by sampling past the shot
        console.log(`WINPROBE after the debrief r=${camera.position.length().toFixed(2)}`
          + ` ${camera.position.length() > 2.5 ? 'OK — still wide'
            : 'WRONG — it snapped back to the hull behind the modal'}`);
      }, VICTORY_PULL * 1000);
      // the debrief is checked LATER than the camera on purpose: onEnd fires
      // on the frame the shot expires, so a check at exactly VICTORY_PULL
      // races the modal it is asking about and reports a failure that is
      // really a stopwatch a frame fast.
      setTimeout(() => {
        const modal = msgEl && !msgEl.classList.contains('hidden');
        console.log(`WINPROBE debrief up=${modal} r=${camera.position.length().toFixed(2)}`
          + ` ${modal ? 'OK — after the move, not instead of it'
            : 'WRONG — the debrief never arrived'}`);
      }, (VICTORY_PULL + 1.6) * 1000);
    }, 2500);
  }

  // ?enemy=<type>[:N] — PUT ONE ON THE BOARD NOW. Operator: "I just want to
  // have a look at it right away, not play 16 waves to debug."
  //
  // Fair, and the absence of this is a real cost: every enemy added since the
  // first has been inspected either in the units viewer — which shows it on a
  // turntable, at a size and a light nothing else on the board shares — or by
  // playing to its wave. Neither answers "what does it look like NEXT TO THE
  // TANK, on the ground, at the game's own scale", which is the only question
  // that matters for a boss.
  //
  // Spawns beside the hull, alive, on the real path, so it walks at you.
  {
    const spec0 = urlParams.get('enemy');
    if (spec0) {
      // ?enemy=type[:N][@D] — D is how many cells AWAY it starts. It used to
      // land on a neighbouring cell, which the operator reported straight
      // away: "it spawns right at the base, it leaves no time to address its
      // threat or look at it move." A boss you meet already touching you is a
      // boss nobody has seen walk.
      const [typePart, distPart] = spec0.split('@');
      const [wantType, wantN] = typePart.split(':');
      const n = Math.max(1, Math.min(24, parseInt(wantN || '1', 10) || 1));
      // 0 means THE PORTAL, and it is the default: that is where the board's
      // enemies come from, and a boss that appears anywhere else has skipped
      // the walk the whole game is about. A number is a ring that many cells
      // from the hull, for when the point is a close look rather than a fight.
      const away = distPart === undefined ? 0
        : Math.max(0, Math.min(40, parseInt(distPart, 10) || 0));
      setTimeout(() => {
        for (const id of ['#td-msg', '#td-intro']) {
          const el = root.querySelector(id);
          if (el) el.classList.add('hidden');
        }
        paused = false;
        tutorial.frozen = false;
        shot = null;
        deploy = null;
        const spec = ENEMY_SPEC[wantType];
        if (!spec || !graph || !player.pos) {
          console.log(`ENEMYPROBE unknown type "${wantType}" — one of: ${Object.keys(ENEMY_SPEC).join(', ')}`);
          return;
        }
        // FROM THE PORTAL, which is where everything else on this board comes
        // from. A boss that materialises six cells from the hull has skipped
        // the entire journey the player defends against — the point of a boss
        // is watching it come the whole way. `@D` still overrides for a close
        // look; `@0` means the portal, which is the default.
        //
        // Falls back to a ring around the hull only if there is no live gate,
        // because a probe that refuses to spawn when the board is unusual is
        // a probe nobody trusts.
        let near = [];
        const gate = spawnPoints.find((sp) => sp.alive) || spawnPoints[0];
        if (away === 0 && gate) {
          near = [gate.ci, ...openNeighbors(gate.ci)];
        } else {
          let ring = [player.cur];
          const seen = new Set(ring);
          for (let step = 0; step < Math.max(1, away); step++) {
            const next = [];
            for (const c of ring) {
              for (const nb of openNeighbors(c)) {
                if (seen.has(nb)) continue;
                seen.add(nb); next.push(nb);
              }
            }
            if (!next.length) break;
            ring = next;
          }
          near = ring.length ? ring : openNeighbors(player.cur);
        }
        for (let i = 0; i < n; i++) {
          const ci = near[i % Math.max(1, near.length)] ?? player.cur;
          const obj = buildCreature(wantType, {
            walker: CREATURE_TINTS[wantType], walkerHi: accentFor(wantType),
          });
          if (!obj) continue;
          const s0 = cellSide * (spec.size ?? 0.5);
          obj.scale.setScalar(s0 * (obj.userData.baseScale ?? 1));
          obj.userData.s0 = s0;
          scene.add(obj);
          enemies.push({
            type: wantType, spec, scale0: s0, size: spec.size,
            cur: ci, prev: -1, next: ci, prog: 0,
            pos: graph.centers[ci].slice(), dir: [0, 1, 0],
            obj, alive: true, phase: i * 0.7, paceJitter: 1,
            hp: spec.hp, behMult: 1, behUntil: -1, touchCd: -1,
            slowFactor: 1, slowUntil: -1,
          });
        }
        // ...and put the camera on it, because the point is to LOOK
        setView('third');
        // ?enemykill=1 — kill what was just spawned and report whether the
        // BODY actually left. This is a regression test with a URL rather
        // than a test file, because the bug it guards needs a live scene:
        // makeDebris read `material.color` straight, a ShaderMaterial has
        // none, so it THREW inside killCreature before the scene.remove that
        // follows it. The boss died, no debris appeared, and the corpse stood
        // on the board forever. "It just remains there."
        if (urlParams.get('enemykill') === '1') {
          setTimeout(() => {
            const mine = enemies.filter((e) => e.type === wantType && e.alive);
            const objs = mine.map((e) => e.obj);
            let threw = null;
            try { for (const e of mine) killCreature(e, true); }
            catch (err) { threw = err.message; }
            const stillInScene = objs.filter((o) => o.parent).length;
            console.log(`ENEMYKILL killed=${mine.length} threw=${threw || 'no'}`
              + ` still-in-scene=${stillInScene} debris=${debris.length}`
              + ` ${!threw && stillInScene === 0 && debris.length > 0 ? 'OK — it died and left something behind'
                : 'WRONG — the corpse is still standing, or nothing was thrown off it'}`);
          }, 2000);
        }
        console.log(`ENEMYPROBE spawned ${n}x ${wantType}`
          + ` (${spec.rammable ? 'rammable' : 'SOLID'}, ${spec.hp} hp, size ${spec.size}`
          + `${spec.boss ? ', BOSS' : ''}${spec.mesh ? `, mesh "${spec.mesh}"` : ', dot cloud'})`
          + ` ${away === 0 ? 'AT THE PORTAL' : `${away} cells out`}`
          + `, at ${near.slice(0, n).join(',')}`);
      }, 2600);
    }
  }

  // ?keyprobe=1 — WHICH KEY DOES WHAT, with REAL events. The shield was bound
  // to S, which is REVERSE: `s` sits in CTL_DRIVE_KEYS beside w/a/d, so every
  // time the player backed up they also spent a charge. A grep for `k === 's'`
  // found nothing and said the key was free — the drive keys are read through
  // a map, not a literal, so the search asked the wrong question entirely.
  //
  // This dispatches actual KeyboardEvents and reports what moved, which is the
  // only check that could have caught it: a binding conflict is invisible to
  // source search and obvious to a keypress.
  if (urlParams.get('keyprobe') === '1') {
    setTimeout(() => {
      for (const id of ['#td-msg', '#td-intro']) {
        const el = root.querySelector(id);
        if (el) el.classList.add('hidden');
      }
      paused = false;
      tutorial.frozen = false;
      shot = null;
      const press = (key) => {
        dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      };
      // the deploy sequence still owns the hull at this point and
      // deployShieldNow refuses while it does — which the first run of this
      // probe reported as a failed BINDING. A refusal and an unbound key look
      // identical from the outside, so the probe has to say which.
      // CLEAR WHAT FREEZES IT, the way the shove probe does. deployShieldNow
      // refuses while the berth deploy owns the hull, and a refusal looks
      // exactly like an unbound key from outside — the first two runs of this
      // probe reported a working binding as broken for that reason.
      deploy = null;
      const why = deployShieldNow();
      console.log(`KEYPROBE control call = ${why} (must be 'ok' before the keys mean anything)`);
      shield.rack = 2; shield.t = 0; shield.coolUntil = -Infinity;
      const rack0 = shield.rack;
      press('s');
      const afterS = shield.rack;
      shield.t = 0; shield.coolUntil = -Infinity;
      press('t');
      const afterT = shield.rack;
      console.log(`KEYPROBE rack ${rack0} -> S:${afterS} -> T:${afterT}`
        + ` s-spent=${rack0 - afterS} t-spent=${afterS - afterT} direct=${why}`
        + ` ${afterS === rack0 && afterT === rack0 - 1 ? 'OK — S drives, T shields'
          : 'WRONG — S still spends a charge, or T does not'}`);
    }, 6000);
  }

  // ?hoverprobe=1 — THE HOVERING TOWER. Operator: "it is possible to have a
  // tower hovering in the air, perhaps it was ordered to build, and then the
  // wall was destroyed." Exactly that, and it had two doors:
  //
  //   placeError asked tdFullTags — the ORIGINAL map — which never learns
  //   about a breach, so a blown-out cell still reported as HIGH GROUND.
  //   A queued order did not anchor its wall, so the wall could go while
  //   Isao was still in the air on his way to it.
  //
  // This walks the whole sequence rather than checking the flag, because the
  // flag was right in isolation and the SEQUENCE was what failed.
  if (urlParams.get('hoverprobe') === '1') {
    setTimeout(() => {
      for (const id of ['#td-msg', '#td-intro']) {
        const el = root.querySelector(id);
        if (el) el.classList.add('hidden');
      }
      paused = false;
      if (!graph) { console.log('HOVERPROBE no board'); return; }
      const site = dungeon.tags.findIndex((t, i) => !placeError(i));
      if (site < 0) { console.log('HOVERPROBE no buildable cell'); return; }
      console.log(`HOVERPROBE site=${site} buildable-before=${!placeError(site)}`);

      // 1. a cell with a LIVE ORDER on it, then the wall taken out from under it
      eco.addBiomass(4000);
      const kg0 = eco.biomass;
      // orderTower, NOT placeTower: placeTower commits immediately, so the
      // first cut of this probe built a tower and then found the breach
      // correctly refused by `towerByCell` — passing through the very
      // sequence it was written to exercise without ever entering it.
      const ordered = orderTower(starterTower().key, site);
      const onBook = orderByCell.has(site);
      blastWall(site);
      const stillBooked = orderByCell.has(site);
      const refunded = eco.biomass >= kg0 - 1;   // full: it had not started printing
      console.log(`HOVERPROBE order ordered=${ordered} on-book=${onBook}`
        + ` cancelled-by-breach=${!stillBooked} refunded=${refunded}`
        + ` ${ordered && onBook && !stillBooked && refunded ? 'OK'
          : 'WRONG — a breach left the order standing'}`);

      // 2. and the cell must now REFUSE a tower, by every door
      const err = placeError(site);
      const direct = placeTower(starterTower().key, site) || orderTower(starterTower().key, site);
      const built = towerByCell.has(site);
      console.log(`HOVERPROBE breached-cell error="${err}" direct-place=${direct}`
        + ` tower-there=${built}`
        + ` ${err && !direct && !built ? 'OK' : 'WRONG — a tower can still stand on open floor'}`);

      // 3. an UNBREACHED wall must still accept one, or the fix has simply
      //    banned building, which would pass both checks above
      const other = dungeon.tags.findIndex((t, i) => i !== site && !placeError(i));
      console.log(`HOVERPROBE control cell=${other} still-buildable=${other >= 0}`
        + ` ${other >= 0 ? 'OK' : 'WRONG — nothing can be built any more'}`);
    }, 2500);
  }

  // ?shieldrack=N — set the rack, for playtesting the chain without a shop
  const rackN = parseInt(urlParams.get('shieldrack') || '-1', 10);
  if (rackN >= 0) { shield.rack = Math.min(shieldTune.rackCap, rackN); updateHud(); }

  // ?shieldprobe=1 — THE LADDER, AS LOG LINES, because none of it is
  // screenshot-checkable: a shielded tank and a cooling one differ by a
  // greyed pip. Four beats, each ending OK or WRONG.
  //   A the cap clamps, whatever it is fed
  //   B one full S chain: deploy, the drop, the SEAM refusing, the re-deploy
  //   C the tap: the tower goes offline and comes back
  //   D the station: the budget runs out and the next wave refills it
  // B is the one that matters — the seam IS the feature and it is invisible.
  if (shieldProbeOn) {
    setTimeout(() => {
      // A
      shield.t = 0; shield.coolUntil = -Infinity;
      chargeShield(shield, 999, shieldTune);
      console.log(`SHIELDPROBE A cap t=${shield.t} expect=${shieldTune.cap}`
        + ` ${shield.t === shieldTune.cap ? 'OK' : 'WRONG'}`);
      // B
      shield.t = 0; shield.coolUntil = -Infinity; shield.rack = 2;
      const now = runContext.time;
      const r1 = deployShield(shield, now, shieldTune);
      const upRefusal = deployShield(shield, now + 1, shieldTune);
      shield.t = 0;
      shield.coolUntil = now + shieldTune.coolSecs;   // as tickShield stamps it
      const coolRefusal = deployShield(shield, now + shieldTune.coolSecs - 0.1, shieldTune);
      const r2 = deployShield(shield, now + shieldTune.coolSecs, shieldTune);
      console.log(`SHIELDPROBE B chain deploy=${r1} while-up=${upRefusal}`
        + ` in-seam=${coolRefusal} after-seam=${r2} rack=${shield.rack}`
        + ` seam=${shieldTune.coolSecs}s vs ramgap=${RAM_COMBO_GAP}s`
        + ` ${r1 === 'ok' && upRefusal === 'up' && coolRefusal === 'cooling' && r2 === 'ok' ? 'OK' : 'WRONG'}`);
      // C
      const slowTw = towers.find((t) => t.def.attack === 'slowfield');
      if (!slowTw) console.log('SHIELDPROBE C no slow tower on the board (add &stress=6:0)');
      else {
        shield.t = 0;
        const got = tapTower(shield, slowTw.id, runContext.time, 1, shieldTune);
        const offNow = towerOffline(shield, slowTw.id, runContext.time);
        const offLater = towerOffline(shield, slowTw.id, runContext.time + shieldTune.tapOutage + 0.1);
        console.log(`SHIELDPROBE C tap got=${got.toFixed(2)} offline-now=${offNow}`
          + ` offline-after-outage=${offLater} ${got > 0 && offNow && !offLater ? 'OK' : 'WRONG'}`);
      }
      // D
      shield.t = 0; shieldWaveReset(shield, shieldTune);
      let spent = 0;
      for (let i = 0; i < 50; i++) spent += stationDraw(shield, 1, shieldTune);
      const dry = stationDraw(shield, 1, shieldTune);
      shieldWaveReset(shield, shieldTune);
      console.log(`SHIELDPROBE D station spent=${spent.toFixed(2)} budget=${shieldTune.stationBudget}`
        + ` dry=${dry} refilled=${shield.stationLeft}`
        + ` ${Math.abs(spent - shieldTune.stationBudget) < 0.01 && dry === 0
          && shield.stationLeft === shieldTune.stationBudget ? 'OK' : 'WRONG'}`);
      shield.t = 0; shield.coolUntil = -Infinity;
    }, 2500);
  }

  // ?shoveprobe=1 — drive a hard core into a shielded hull and report the
  // four things that must ALL be true at once: the hull did not lose HP, the
  // ram combo did not move (a shove is not a ram), the body left its lane,
  // and it came BACK to it. The last one is the whole reason the shove is an
  // offset rather than a position write.
  if (urlParams.get('shoveprobe') === '1') {
    setTimeout(() => {
      // the board starts PAUSED behind the landing brief and the field
      // manual; a probe that does not clear both measures a frozen game
      for (const id of ['#td-msg', '#td-intro']) {
        const el = root.querySelector(id);
        if (el) el.classList.add('hidden');
      }
      paused = false;
      if (!graph || !player.pos) { console.log('SHOVEPROBE no board'); return; }
      // THE CLOCK ONLY RUNS WHILE THE TANK IS DRIVING. advanceMotion returns
      // early on `player.next === -1`, so a probe that merely unpauses the
      // board measures a frozen one: runContext.time stays at 0.00, the creature step
      // never runs, and the shove it just wrote never decays. Put the machine
      // on the road and leave it there for the probe's whole duration —
      // AUTO drives itself, which is what this needs and what a player who
      // has let go of the wheel is doing anyway.
      // AND THE DRIVE HAS TWO MORE GATES, both invisible from outside:
      // driveFrozen is `(shotActive() && !dirShot) || tutorial.frozen`, so the
      // COLD OPEN and the tutorial's opening hold each freeze the tank on
      // their own. A probe that needs &cine=0&tutstep=9 in its URL to work is
      // a probe that will be run without them and quietly report WRONG, so it
      // clears them itself.
      tutorial.frozen = false;
      shot = null;
      autoMode = true;
      if (player.next === -1) {
        const d = dungeon.distToHeart;
        const nb = openNeighbors(player.cur);
        player.next = nb.find((c) => d[c] === d[player.cur] - 1) ?? nb[0] ?? player.cur;
      }
      const hardType = Object.keys(ENEMY_SPEC).find((k) => !ENEMY_SPEC[k].rammable);
      const spec = ENEMY_SPEC[hardType];
      chargeShield(shield, 20, shieldTune);
      const hp0 = playerHP, combo0 = ramCombo;
      let ehp0 = 0;   // the BODY's health, read after it is planted
      const near = player.cur;
      const obj = makeDotEnemy(hardType, { walker: CREATURE_TINTS[hardType], walkerHi: accentFor(hardType) });
      const s0 = cellSide * spec.size * 0.7;
      obj.scale.setScalar(s0); obj.userData.s0 = s0;
      scene.add(obj);
      const e = {
        type: hardType, spec, scale0: s0, size: spec.size,
        cur: near, prev: -1, next: near, prog: 0,
        pos: graph.centers[near].slice(), dir: [0, 1, 0],
        obj, alive: true, phase: 0, paceJitter: 1,
        hp: 40, behMult: 1, behUntil: -1, touchCd: -1,
        slowFactor: 1, slowUntil: -1,
      };
      enemies.push(e);
      const lane = [...e.pos];
      e.shove = { dir: shoveVec(e.pos, player.pos, player.heading), t: shieldTune.shoveLife };
      e.stagUntil = runContext.time + shieldTune.shoveStun;
      const peak = shoveMag({ t: shieldTune.shoveLife }, shieldTune) * cellSide;
      ehp0 = e.hp;
      console.log(`SHOVEPROBE planted a hard ${hardType} at cell ${near}, shield=${shield.t.toFixed(1)}s`);
      setTimeout(() => {
        const away = dist3(e.pos, lane);
        console.log(`SHOVEPROBE thrown ${away.toFixed(4)} of ${peak.toFixed(4)}`
          + ` shoveT=${e.shove ? e.shove.t.toFixed(2) : 'gone'} prog=${e.prog.toFixed(3)}`
          + ` simTime=${runContext.time.toFixed(2)} paused=${paused} alive=${e.alive}`
          // ehp is REPORTED, not asserted. The probe drives the tank so the
          // clock runs, and a driving tank shoots — so the body loses health
          // to the guns, which says nothing about the shove. What the shove
          // does to health is settled structurally instead: the shielded
          // branch calls playerHit and `continue`, and never damageEnemy.
          + ` ehp=${e.hp}/${ehp0} (the tank's own guns)`
          + ` ${away > peak * 0.4 ? 'OK' : 'WRONG — it never left its lane'}`);
        // ISOLATE THE DECAY FROM RE-CONTACT. The tank is still driving, so it
        // keeps reaching the body and shoving it again — which is correct
        // behaviour and made the first version of this check report a WRONG
        // on a working shove, with the offset going UP between the two reads.
        // Bar it from being shoved again and the decay is the only thing left
        // moving, which is what this beat is actually asking about.
        e.touchCd = runContext.time + 999;
        setTimeout(() => {
          console.log(`SHOVEPROBE back shove=${e.shove ? `still held ${e.shove.t.toFixed(2)}` : 'decayed'}`
            + ` simTime=${runContext.time.toFixed(2)} next=${player.next}`
            + ` hull=${playerHP}/${hp0} combo=${ramCombo}/${combo0}`
            + ` alive=${e.alive}${e.alive ? '' : ' (a tower or the heart got it — not the shove)'}`
            + ` ${!e.shove && playerHP === hp0 && ramCombo === combo0 ? 'OK' : 'WRONG'}`);
          // MARGIN, not a tight fit: the creature step's dt is not the wall
          // clock's, so a window sized exactly to shoveLife catches the offset
          // at 0.05 and calls a working shove a failure.
        }, (shieldTune.shoveLife * 2 + 0.6) * 1000);
      }, 300);
    }, 2500);
  }

  // ?shield=N — ignite the bubble for N seconds (visual check / playtest)
  const shieldN = parseFloat(urlParams.get('shield') || '0');
  if (shieldN > 0) { chargeShield(shield, shieldN, shieldTune); updateHud(); }

  // ?rank=N — jump the ladder for layout checks: grants exactly rank N's
  // requirements (kills AND elites), then renders through the normal path
  const forceRank = parseInt(urlParams.get('rank') || '0', 10);
  if (forceRank > 0) {
    const fr = Math.min(15, forceRank);
    tankKills = killReq(fr);
    tankEliteKills = eliteReq(fr);
    tankRank = rankFor(tankKills, tankEliteKills);
    refreshRankVisuals();
    // ...and report the BEAM the rank arms, because that is now the half of
    // a promotion a screenshot cannot show you: the beam only exists while
    // the trigger is held, so the numbers are the only headless evidence.
    console.log(`RANK forced=${tankRank} label=${rankLabel(tankRank)}`
      + ` kills=${tankKills} elite=${tankEliteKills}`
      + ` | BEAM ${beamStepNow.name} color=${beamStepNow.color}`
      + ` reach=${LASER_REACH} cells dps=${LASER_DPS}`
      + ` pen soft=${PEN_SOFT().toFixed(2)} hard=${PEN_HARD().toFixed(2)}`
      + ` (3 hard = ${(PEN_HARD() * 3).toFixed(2)} of ${LASER_REACH} —`
      + ` ${PEN_HARD() * 3 >= LASER_REACH ? 'STOPS it' : 'does NOT stop it'})`);
    // ...and the toe the reach solved for, with where it actually crosses.
    // Reported rather than asserted: the muzzle gap is measured off whatever
    // model loaded, and a probe that assumed it would be lying on the
    // procedural fallback.
    if (lastToe) {
      console.log(`TOE gap=${lastToe.gap.toFixed(3)} cells`
        + ` toe=${lastToe.toe.toFixed(4)} rad`
        + ` crosses at ${lastToe.at.toFixed(2)} of ${LASER_REACH} cells`
        + ` (${lastToe.at <= LASER_REACH ? 'INSIDE the reach' : 'BEYOND it — they never meet'})`
        + ` | the old fixed ${SECONDARY_TOE} would cross at`
        + ` ${crossingForToe(lastToe.gap, SECONDARY_TOE).toFixed(2)}`);
    } else console.log('TOE not applied (no gun pivots on this tank)');
  }

  // ?ringdump=1 — WHAT IS ACTUALLY IN THE PORTAL RING?
  //
  // Operator: "the portal metallic frame model is entirely black, it should
  // be shades of grey", and the power cores need to blow one pair at a time.
  // Both of those are questions about the authored model's OWN names — which
  // materials the tint ladder is failing to match, and what the cores are
  // called — and guessing at names is how the last three model jobs went
  // wrong. Dump them.
  if (urlParams.get('ringdump') === '1') {
    preloadPortalRing().then((ok) => {
      if (!ok) { console.log('RINGDUMP model failed to load'); return; }
      const g = makePortalRing(0x8fe8ff);
      if (!g) { console.log('RINGDUMP no proto'); return; }
      const mats = new Map();
      const names = [];
      g.traverse((o) => {
        if (o.name) names.push(`${o.name}${o.isMesh ? '*' : ''}`);
        if (!o.isMesh || !o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (mats.has(m.name || '(unnamed)')) continue;
          const c = m.color || { r: 0, g: 0, b: 0 };
          const e = m.emissive || { r: 0, g: 0, b: 0 };
          mats.set(m.name || '(unnamed)', {
            lum: 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b,
            elum: 0.2126 * e.r + 0.7152 * e.g + 0.0722 * e.b,
            ei: m.emissiveIntensity ?? 0,
          });
        }
      });
      for (const [n2, v] of mats) {
        console.log(`RINGDUMP material ${n2.padEnd(22)} colour lum ${v.lum.toFixed(3)}`
          + ` | emissive lum ${v.elum.toFixed(3)} x${v.ei.toFixed(2)}`
          + ` ${v.lum < 0.08 && v.elum < 0.02 ? '<-- READS BLACK' : ''}`);
      }
      // WHICH NODE IS THE GIANT? A blueprint model carries helpers — collision
      // proxies, callout cards, an aux scene — that the bench never draws. A
      // merge that keeps everything keeps those too, and a lit collision box
      // is exactly a giant white square. Measure every named node.
      const nb = new THREE.Box3(), ns = new THREE.Vector3();
      g.updateMatrixWorld(true);
      nb.setFromObject(g); nb.getSize(ns);
      const whole = ns.length();
      const rows = [];
      g.traverse((o) => {
        if (!o.name) return;
        nb.setFromObject(o); nb.getSize(ns);
        const span = ns.length();
        if (span > whole * 0.25) rows.push(`${o.name}=${(span / whole * 100).toFixed(0)}%`);
      });
      console.log(`RINGDUMP big nodes (>25% of the model): ${rows.join(' ')}`);
      // WHAT SITS IN THE MOUTH? Operator: "an unwanted grey block in the
      // center of the portal." List every mesh — named or not, since the merge
      // strips names — whose centre lies inside the aperture's radius.
      const ap = g.userData.aperture;
      if (ap) {
        const apC = new THREE.Vector3(); ap.getWorldPosition(apC);
        const apS = new THREE.Vector3(); ap.getWorldScale(apS);
        const apR = Math.max(apS.x, apS.y);
        const mb = new THREE.Box3(), mc = new THREE.Vector3(), msz = new THREE.Vector3();
        const inMouth = [];
        g.traverse((o) => {
          if (!o.isMesh || o === g.userData.disc) return;
          mb.setFromObject(o); mb.getCenter(mc); mb.getSize(msz);
          const off = mc.distanceTo(apC);
          if (off < apR * 0.6 && msz.length() > 1e-6) {
            const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m.name).join('+');
            inMouth.push(`[${o.name || 'unnamed'} parent=${o.parent && o.parent.name || '?'} mat=${mats} size=${(msz.length() / apR).toFixed(2)}xR off=${(off / apR).toFixed(2)}R]`);
          }
        });
        console.log(`RINGDUMP in the mouth (centre within 0.6R of the aperture): ${inMouth.join(' ') || 'nothing'}`);
      }
      // (A "raw file" pass used to sit here. It was not raw: loadGlb caches
      // the parsed scene and mergeByMaterial mutates it in place, so it dumped
      // the merged model and called it the source. The honest pre-merge look
      // is the RING log lines from preloadPortalRing itself.)
      console.log(`RINGDUMP nodes (${names.length}), meshes marked *:`
        + ` ${names.filter((x) => x.endsWith('*')).join(' ') || 'NONE — everything merged away'}`);
      // ADDRESSABLE IS NOT THE SAME AS HAVING GEOMETRY. A preserved pivot can
      // be an empty transform whose meshes were welded into the global batch,
      // and hiding that hides nothing — which is the failure this whole
      // pivot list exists to avoid. So measure each pod's box.
      const pb = new THREE.Box3(), ps = new THREE.Vector3();
      let solid = 0;
      for (const pod of g.userData.pods || []) {
        pb.setFromObject(pod); pb.getSize(ps);
        if (ps.length() > 1e-6) solid++;
      }
      console.log(`RINGDUMP pods addressable ${(g.userData.pods || []).length}/8,`
        + ` of which ${solid} actually carry geometry`
        + ` ${solid === 8 ? '(hiding one will remove a pod)' : '<-- EMPTY TRANSFORMS, hiding them does nothing'}`);
    });
  }

  // ?hitprobe=1 — THE THREE HITS, AS THEY ACTUALLY LAND.
  //
  // Operator: two power cores per hit, then two more, then a destruction like
  // the tank's. Every part of that is a side effect — pods hidden, debris
  // pushed, a sound played — so it is checked by counting the effects rather
  // than by looking at a frame.
  if (urlParams.get('hitprobe') === '1') {
    preloadPortalRing().then(() => {
      swapGatesToRing();
      const sp = spawnPoints.find((x) => x.alive);
      if (!sp) { console.log('HITPROBE no live gate'); return; }
      if (sp.obj.userData.setForm) sp.obj.userData.setForm(1);
      const pods = () => (sp.obj.userData.pods || []).filter((p2) => p2.visible).length;
      console.log(`HITPROBE start: hp=${sp.hp} pods=${pods()}/8 debris=${debris.length}`);
      for (let h = 1; h <= 3; h++) {
        const d0 = debris.length, k0 = whKick;
        sp.hp--;
        if (sp.hp <= 0) killPortal(sp); else gateTakesHit(sp);
        console.log(`HITPROBE hit ${h}: hp=${sp.hp} pods=${pods()}/8`
          + ` debris +${debris.length - d0}`
          + ` wormhole kick ${k0.toFixed(1)} -> ${whKick.toFixed(1)}`
          + ` recoil ${(sp.recoil ?? 0).toFixed(2)}s`
          + (sp.alive ? '' : ' | GATE DESTROYED'));
      }
    });
  }

  // ?breachprobe=1 — DOES A SHELL STILL BREACH THE WALL IT LANDS ON?
  //
  // The wall-impact test moved from a scan of every cell to the voxel hash
  // (cellIndex). Same answer for a point on the surface, but "same" is a claim
  // and this is the check: put a shell on a wall cell and run one projectile
  // step; the breach set must grow by exactly that cell.
  if (urlParams.get('breachprobe') === '1') {
    setTimeout(() => {
      let wall = -1;
      for (let i = 0; i < dungeon.tags.length && wall < 0; i++) {
        if (dungeon.tags[i] !== BLOCKED) continue;
        if (graph.adj[i].some((nb) => dungeon.tags[nb] !== BLOCKED)) wall = i;
      }
      if (wall < 0) { console.log('BREACHPROBE no wall with an open neighbour'); return; }
      const before = breachedCells.size;
      const c = graph.centers[wall];
      // a real Mesh, because killProjectile disposes geometry and material —
      // the first cut used a bare Object3D and the probe crashed on its own prop
      const fake = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
      scene.add(fake);
      projectiles.push({ pos: c.slice(), dir: [0, 0, 1], vel: [0, 0, 0], dist: 0,
        mesh: fake, life: 1 });
      updateProjectiles(1 / 60, 0);
      const after = breachedCells.size;
      console.log(`BREACHPROBE shell on wall cell ${wall}:`
        + ` breached ${before} -> ${after}`
        + ` ${after === before + 1 && breachedCells.has(wall) ? 'THAT cell, exactly (cellIndex agrees with the old scan)'
          : after === before ? '<-- NO BREACH: cellIndex missed the wall' : '<-- breached the WRONG cell(s)'}`);
    }, 1500);
  }

  // ?sizeprobe=1 — HOW BIG IS EVERYTHING, IN CELLS?
  //
  // Operator: "we made the tank enormous". A screenshot cannot separate a
  // scaled-up model from a camera sitting inside one, and those want opposite
  // fixes — so measure the world bounding box of each actor and divide by the
  // cell. The tank's design size is about 0.85 of a cell.
  if (urlParams.get('sizeprobe') === '1') {
    // NAME THE ARTIFACT AND WAIT FOR IT. Headless rarely finishes the GLB
    // load, so a size measured at a fixed timeout is a size for the
    // PROCEDURAL fallback — a different model with a different scale, which
    // this project has already been burned by once.
    Promise.all([preloadMkcx(), preloadPortalRing()]).then(([mk, rg]) => {
      const bb = new THREE.Box3(), sz = new THREE.Vector3();
      console.log(`SIZEPROBE artifacts: mkcx=${mk ? 'loaded' : 'FALLBACK'}`
        + ` ring=${rg ? 'loaded' : 'FALLBACK'}`);
      const say = (label, obj, want) => {
        if (!obj) { console.log(`SIZEPROBE ${label}: absent`); return; }
        obj.updateMatrixWorld(true);
        bb.setFromObject(obj); bb.getSize(sz);
        const span = Math.max(sz.x, sz.y, sz.z) / cellSide;
        console.log(`SIZEPROBE ${label.padEnd(14)} ${span.toFixed(2)} cells across`
          + (want ? `  (want ~${want}) ${Math.abs(span - want) > want * 0.6 ? '<-- WRONG' : 'ok'}` : '')
          + `  | scale ${obj.scale.x.toFixed(4)}`
          + ` baseScale ${(obj.userData.baseScale ?? 1).toFixed(4)}`);
      };
      say('tank', playerMesh, 0.85);
      const gate = spawnPoints[0] && spawnPoints[0].obj;
      // FORM IT FIRST. A gate spends its opening seconds dialling in from
      // nothing, so measuring on a timer reports 0.00 cells and calls the
      // model broken — which is exactly what the first reading did.
      if (gate && gate.userData.setForm) gate.userData.setForm(1);
      say('gate', gate, GATE_HEIGHT);
      if (gate) {
        // ...and where it sits relative to the ground it should stand on
        const r = Math.hypot(gate.position.x, gate.position.y, gate.position.z);
        console.log(`SIZEPROBE gate origin sits ${((r - 1) / cellSide).toFixed(2)}`
          + ` cells off the surface (a grounded ring wants ~0)`);
      }
      // THE APERTURE, which is what decides whether the wormhole fills the
      // hole or spills out over the ring. Its reserved volume lives in the
      // node's SCALE, and a merge can reparent a preserved pivot and drop an
      // ancestor's transform on the way — so the number is read off the live
      // object rather than trusted from the blueprint.
      if (gate && gate.userData.aperture) {
        const ap = gate.userData.aperture;
        const ws = new THREE.Vector3();
        ap.getWorldScale(ws);
        gate.updateMatrixWorld(true);
        bb.setFromObject(gate); bb.getSize(sz);
        const ringSpan = Math.max(sz.x, sz.y, sz.z);
        console.log(`SIZEPROBE aperture world scale ${ws.x.toFixed(4)}`
          + ` -> disc diameter ${(2 * ws.x / cellSide).toFixed(2)} cells`
          + ` vs ring span ${(ringSpan / cellSide).toFixed(2)} cells`
          + ` ${2 * ws.x > ringSpan ? '<-- THE HOLE IS BIGGER THAN THE RING' : 'fits'}`);
      }
      console.log(`SIZEPROBE cellSide=${cellSide.toFixed(4)} unitScale=${unitScale.toFixed(4)}`);
    });
  }

  // ?gateprobe2=1 — ARE THE GATES WEARING THE RING, AND DOES THE RAMP RUN?
  //
  // Two things a screenshot cannot settle: whether the gates got the authored
  // model or fell back to the dot cloud, and whether travel actually winds up
  // in the last five seconds before a wave. The ramp is driven by a clock, so
  // it is checked by asking the clock, not by waiting.
  if (urlParams.get('gateprobe2') === '1') {
    preloadPortalRing().then((ok) => {
      swapGatesToRing();
      const wearing = spawnPoints.filter((sp) => sp.obj && sp.obj.userData.disc).length;
      console.log(`GATEPROBE2 ring loaded=${ok}`
        + ` | ${wearing}/${spawnPoints.length} gates wearing the ring`
        + ` ${wearing === spawnPoints.length && spawnPoints.length ? '' : '<-- some fell back to the cloud'}`
        + ` | one shared target ${whRt ? `${whRender.size}px` : 'NOT BUILT'}`
        + ` for all of them`);
      // the ramp, read straight off travelRate at each second of the lead
      const row = [];
      for (let sec = 7; sec >= 0; sec--) row.push(`${sec}s:${travelRate(sec).toFixed(2)}`);
      console.log(`GATEPROBE2 travel ramp (seconds before the wave) ${row.join('  ')}`);
      // ...and that the phase actually accumulates through it
      const p0 = whPhase.travel;
      for (let i = 0; i < 300; i++) advancePhase(whPhase, 1 / 60, travelRate(5 - i / 60));
      console.log(`GATEPROBE2 five seconds of ramp moved the phase`
        + ` ${(whPhase.travel - p0).toFixed(3)}`
        + ` ${whPhase.travel - p0 > 0 ? '(travel is live)' : '<-- PHASE NEVER MOVED'}`);
      const folds = whRender.size ** 2 * WORMHOLE_PRESET.uSteps * WORMHOLE_PRESET.uTurbOctaves;
      console.log(`GATEPROBE2 cost ${(folds / 1e6).toFixed(0)}M sine-folds per rendered frame,`
        + ` ONCE for the board (not per gate), at ${whRender.updateHz}Hz`);
      // THE FRUSTUM GATE. The march is skipped when no live gate is on screen;
      // a gate that is on screen and NOT marched is a black hole in the ring,
      // so the visibility test has to be right in both directions.
      const vis = anyGateVisible();
      const marchedBefore = whLastAt;
      updateWormhole(1 / 30, (whLastAt || 0) + 1);   // force past the period
      console.log(`GATEPROBE2 visibility: a gate is ${vis ? 'IN' : 'OUT of'} the frustum`
        + ` -> march ${whLastAt !== marchedBefore ? 'RAN' : 'SKIPPED'}`
        + ` ${(vis && whLastAt !== marchedBefore) || (!vis && whLastAt === marchedBefore)
          ? '(consistent)' : '<-- GATE VISIBLE BUT NOT MARCHED, or vice versa'}`);
    });
  }

  // ?garrison=1 — WHERE THE OPENING TWO GO, AND WHO BUILDS THEM.
  //
  // Two claims to check and neither is visible from a screenshot: that the
  // sites are FORWARD of the heart rather than behind it, and that they
  // arrive as ISAO's orders rather than as pre-built towers. Reports the old
  // behaviour's numbers alongside, because "more forward" is a comparison.
  if (urlParams.get('garrison') === '1') {
    const heart = graph.centers[dungeon.heart];
    const gates = spawnPoints.filter((sp) => sp.alive).map((sp) => sp.ci);
    const say = (label, list) => {
      for (const ci of list) {
        let toGate = Infinity;
        for (const g of gates) {
          toGate = Math.min(toGate, dist3(graph.centers[ci], graph.centers[g]) / cellSide);
        }
        console.log(`GARRISON ${label} cell=${ci}`
          + ` ${(dist3(graph.centers[ci], heart) / cellSide).toFixed(2)} cells from the heart`
          + `, ${toGate.toFixed(2)} from the nearest gate`);
      }
    };
    // what the OLD rule picked: hug the heart, first legal wall found
    const old = [];
    for (let d = 1; d <= 4 && old.length < 2; d++) {
      for (let i = 0; i < dungeon.tags.length && old.length < 2; i++) {
        if (dungeon.tags[i] !== BLOCKED || placeError(i) || old.includes(i)) continue;
        if (graph.adj[i].some((nb) => dungeon.tags[nb] !== BLOCKED
          && dungeon.distToHeart[nb] >= 0 && dungeon.distToHeart[nb] <= d)) old.push(i);
      }
    }
    say('OLD (pre-built, hugging the heart)', old);
    say('NEW (ordered, forward)', garrisonSites(2));
    // ISAO IS A GLB, and headless rarely finishes that load — so a run with
    // no towers built means nothing unless the loader's own answer is beside
    // it. Without this line the probe cannot tell "the orders are stuck" from
    // "this environment has no drone".
    preloadFabricator().then((ok) => {
      console.log(`GARRISON fabricator loaded=${ok}`
        + `${ok ? '' : ' — headless has no drone, so nothing here can print'}`);
    });
    // and the mechanic: orders on the book, towers not yet standing
    setTimeout(() => {
      console.log(`GARRISON at t0: orders=${orders.length} towers=${towers.size ?? towers.length ?? 0}`
        + ` isao=${isao ? isao.state : 'none'}`
        + ` — ${orders.length === 2 ? 'ISAO IS BUILDING THEM' : 'NOT ordered'}`);
    }, 300);
    // ...AND THAT THEY ACTUALLY LAND. Driven by calling updateIsao directly
    // rather than by waiting: the drone's travel and print clocks advance in
    // the FRAME LOOP, and headless runs a handful of frames in a whole
    // virtual minute, so a wall-clock wait measures the renderer's frame rate
    // and calls it a build failure. (First reading did exactly that: 40s of
    // virtual time, fabricator loaded, zero towers.)
    // WAIT FOR THE DRONE, do not guess at it. A fixed 1200ms timer fired
    // before preloadFabricator resolved and reported "no drone to drive" on
    // a run where the drone arrived a moment later — a probe racing the thing
    // it is measuring.
    spawnIsao().then(() => {
      const n0 = towers.size ?? towers.length ?? 0;
      if (!isao) { console.log('GARRISON sim: no drone (fabricator never loaded)'); return; }
      let t = 0;
      for (; t < 90 && orders.length; t += 0.05) updateIsao(0.05);
      const n1 = towers.size ?? towers.length ?? 0;
      console.log(`GARRISON simulated ${t.toFixed(1)}s of drone time:`
        + ` towers ${n0} -> ${n1}, orders left ${orders.length}`
        + ` | ${n1 - n0 >= 2 ? 'ISAO BUILT BOTH' : 'DID NOT BUILD'}`);
    });
  }

  // ?ghostprobe=1 — DO ANY ENEMIES DRIFT OFF THEIR OWN POSITION?
  //
  // Operator, wave 2: "there are 2 invisible enemies. they registered as
  // hits, but are not seen." The sim and the render can disagree here — every
  // hit test uses `e.pos`, while what you SEE is `e.obj.position`, and an
  // idle-animation tick runs on the object AFTER the position is written.
  // Anything that writes an absolute component in there (rather than a local
  // offset) moves the body without moving the target.
  //
  // Reports, per live enemy, the distance between where it IS and where it is
  // DRAWN, plus whether the drawn point has fallen inside the planet — which
  // is invisible-but-alive exactly as described.
  if (urlParams.get('ghostprobe') === '1') {
    const gpWave = Math.max(1, parseInt(urlParams.get('ghostwave') || '2', 10));
    dismissIntro();
    for (let w = 0; w < gpWave; w++) spawnWave();
    for (let i = 0; i < 400; i++) releaseSpawns(0.02);
    for (let i = 0; i < 60; i++) updateEnemies(1 / 60, i / 60);
    const byType = new Map();
    for (const e of enemies) {
      if (!e.alive) continue;
      const n2 = e.pos;
      const s2 = cellSide * (e.size ?? e.spec.size);
      const lift = s2 * (e.obj.userData.lift ?? 0.85);
      const want = [n2[0] + n2[0] * lift, n2[1] + n2[1] * lift, n2[2] + n2[2] * lift];
      const p2 = e.obj.position;
      const off = Math.hypot(p2.x - want[0], p2.y - want[1], p2.z - want[2]) / cellSide;
      const r = Math.hypot(p2.x, p2.y, p2.z);
      const rec = byType.get(e.type) || { n: 0, worst: 0, buried: 0 };
      rec.n++; rec.worst = Math.max(rec.worst, off);
      if (r < 1) rec.buried++;      // drawn INSIDE the sphere: unseeable
      byType.set(e.type, rec);
    }
    for (const [t, r] of byType) {
      console.log(`GHOSTPROBE wave<=${gpWave} ${t}: ${r.n} alive`
        + ` | worst draw-vs-sim offset ${r.worst.toFixed(2)} cells`
        + ` | ${r.buried} drawn INSIDE the planet`
        + ` ${r.buried ? '<-- ALIVE AND UNSEEABLE' : 'ok'}`);
    }
  }

  // ?rockprobe=1 — HOW OFTEN IS THE BEAM TOUCHING ROCK?
  //
  // The number the WALL_STALLS ruling turns on. Walls now stall the sweep
  // flat, so if a beam on this map is almost always clipping rock, the sweep
  // is a feature that never runs. Measured rather than argued: sample open
  // cells, fire in eight directions from each, and count how many of those
  // shots find a BLOCKED cell inside the reach — at every rank's reach, since
  // reach is what changed.
  if (urlParams.get('rockprobe') === '1') {
    const open = [];
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (dungeon.tags[i] !== BLOCKED) open.push(i);
    }
    const pick = mulberry32(0x0c0ffee);
    const sample = [];
    for (let i = 0; i < Math.min(160, open.length); i++) {
      sample.push(open[Math.floor(pick() * open.length)]);
    }
    for (const st of [beamStep(0), beamStep(5), beamStep(10), beamStep(15)]) {
      const reachW = st.reach * cellSide;
      let shots = 0, clipped = 0, sumAt = 0;
      for (const ci of sample) {
        const from = norm3(graph.centers[ci]);
        // eight headings around the tangent circle, built off an arbitrary
        // but non-degenerate reference so no direction is privileged
        const ref = Math.abs(from[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        const e1 = norm3(cross3(from, ref));
        const e2 = cross3(from, e1);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const dir = norm3([e1[0] * ca + e2[0] * sa, e1[1] * ca + e2[1] * sa,
            e1[2] * ca + e2[2] * sa]);
          shots++;
          for (let m = cellSide * 0.5; m <= reachW; m += cellSide * 0.5) {
            const q = arcPoint(from, dir, m);
            const ci2 = cellIndex(q);
            if (ci2 !== -1 && dungeon.tags[ci2] === BLOCKED) {
              clipped++; sumAt += m / cellSide; break;
            }
          }
        }
      }
      const pct = (100 * clipped / Math.max(1, shots)).toFixed(1);
      console.log(`ROCKPROBE reach=${st.reach}c ${st.name}`
        + ` clips rock in ${pct}% of ${shots} shots`
        + ` (mean first contact ${clipped ? (sumAt / clipped).toFixed(2) : '-'} cells)`
        + ` — the sweep runs its full arc in the other ${(100 - pct).toFixed(1)}%`);
    }
  }

  // ?rankprobe=N — THE PILOT OUTLIVES THE HULL (operator, 2026-09-02).
  // Force rank N, burn the tank, and check the ladder is still standing —
  // and that the BEAM came back the same colour, because the two are wired
  // through the same refreshRankVisuals and only one of them is visible in
  // the HUD. This is the invariant that regresses in silence: nothing else
  // in the suite would notice a stray resetTankRank() creeping back into
  // loseTank(), and the whole change is that it is not there.
  const rankProbe = parseInt(urlParams.get('rankprobe') || '0', 10);
  if (rankProbe > 0) {
    const rp = Math.min(15, rankProbe);
    tankKills = killReq(rp); tankEliteKills = eliteReq(rp);
    tankRank = rankFor(tankKills, tankEliteKills);
    refreshRankVisuals();
    const before = { rank: tankRank, kills: tankKills, step: beamStepNow.name,
      color: beamStepNow.color, reach: LASER_REACH };
    playerHP = PLAYER_MAX;     // survive the loss: we want the NEXT hull
    loseTank();
    const kept = tankRank === before.rank && tankKills === before.kills;
    const beamKept = beamStepNow.color === before.color && LASER_REACH === before.reach;
    console.log(`RANKPROBE survives-hull=${kept ? 'PASS' : 'FAIL'}`
      + ` rank ${before.rank}->${tankRank} kills ${before.kills}->${tankKills}`
      + ` | beam=${beamKept ? 'PASS' : 'FAIL'}`
      + ` ${before.step}/${before.color}/${before.reach}c ->`
      + ` ${beamStepNow.name}/${beamStepNow.color}/${LASER_REACH}c`
      + ` | (a NEW RUN still starts unranked — that reset lives in regenerate)`);
  }

  // ?gateprobe=1 — report a live gate's geometry: drawRange, and where its
  // horizon dots actually sit. The horizon rendered in the module bench, so
  // if it is missing in game the difference is in THIS file's handling.
  if (urlParams.get('gateprobe')) {
    // rAF-counted, not timer-based: under a virtual-time budget every timer
    // can fire before the FIRST frame renders, and the first cut of this
    // probe reported dial=0 on a gate that simply had not been given a frame
    let gpFrames = 0;
    const gpWait = () => {
      gpFrames++;
      if (gpFrames === 3) {
        // then FORCE formation and tick once — swiftshader cannot render 70
        // frames inside the watchdog, and the question is whether the game
        // path positions the horizon, not how fast headless paints
        const sp = spawnPoints.find((q) => q.alive);
        if (sp && sp.obj.userData.setForm) {
          sp.obj.userData.dial = 1;
          sp.obj.userData.setForm(1);
          sp.obj.userData.tick(2.2);
          gpReport();
        }
      }
      if (gpFrames < 3) requestAnimationFrame(gpWait);
    };
    requestAnimationFrame(gpWait);
    const gpReport = () => {
      const sp = spawnPoints.find((q) => q.alive);
      if (!sp) { console.log('GATE none'); return; }
      const g = sp.obj.geometry;
      const a = g.getAttribute('position');
      const H0 = 435;
      let minR = Infinity, maxR = 0, zeros = 0;
      for (let i = H0; i < a.count; i++) {
        const r = Math.hypot(a.getX(i), a.getY(i), a.getZ(i));
        if (r < 1e-6) zeros++;
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      }
      console.log(`GATE count=${a.count} drawRange=${g.drawRange.count}`
        + ` dial=${sp.obj.userData.dial} horizonR=${minR.toFixed(3)}..${maxR.toFixed(3)}`
        + ` zeros=${zeros} scale=${sp.obj.scale.x.toFixed(3)}`);
      // positions passed three probes while the screen stayed empty — so
      // this pass checks everything ELSE a dot needs: color, material,
      // visibility, and where it lands on SCREEN through the live camera
      const cAttr = g.getAttribute('color');
      const cs = [];
      for (const i of [H0, H0 + 1, H0 + 80, H0 + 173, 0, 200]) {
        cs.push(`i${i}=(${cAttr.getX(i).toFixed(2)},${cAttr.getY(i).toFixed(2)},${cAttr.getZ(i).toFixed(2)})`);
      }
      const m = sp.obj.material;
      console.log(`GATE2 ${cs.join(' ')} matCol=${m.color.getHexString()}`
        + ` op=${m.opacity} vis=${sp.obj.visible} size=${m.size}`);
      sp.obj.updateWorldMatrix(true, false);
      const scr = [];
      for (const i of [H0, H0 + 80, H0 + 173, 0]) {
        const v = new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i))
          .applyMatrix4(sp.obj.matrixWorld).project(camera);
        scr.push(`i${i}=(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(3)})`);
      }
      console.log(`GATE3 screen ${scr.join(' ')}`);
    };
  }

  const tutSteps = parseInt(urlParams.get('tutstep') || '0', 10);
  if (runTutorial && tutSteps > 0) {
    let left = tutSteps;
    // Wait for the PHASE to change before clearing the next pair. A fixed
    // delay looks right and is not: under a virtual-time budget the timer
    // chain runs far faster than the render loop, so two clears land between
    // one pair of ticks, the phase advances once, and the run silently ends
    // up short. Poll the thing being driven, never a clock.
    const step = () => {
      if (left-- <= 0) return;
      // the build phase ends on a tower, which no clear can stand in for:
      // put one on the nearest legal cell so the replica reaches the handoff
      if (tutorial.phase === 'build') {
        let best = -1, bd = Infinity;
        for (let ci = 0; ci < dungeon.tags.length; ci++) {
          if (placeError(ci)) continue;
          const d = dist3(graph.centers[ci], player.pos);
          if (d < bd) { bd = d; best = ci; }
        }
        if (best >= 0) { eco.addBiomass(500); commitTower(starterTower().key, best); tutorial.tickBuild(); }
        setTimeout(step, 120);
        return;
      }
      tutorial.frozen = false;   // the opening hold would swallow the first
      for (const e of tutorial.fodder) {
        if (e.alive) { e.alive = false; scene.remove(e.obj); }
      }
      // Drive the phase machine DIRECTLY rather than waiting for animate()
      // to notice. Under a virtual-time budget, timers run on virtual time
      // while requestAnimationFrame is throttled, so a wait-for-the-loop
      // poll times out and the run silently ends up a phase or two short —
      // which is exactly how this hook failed the first two times.
      tutorial.tick(1 / 60);   // register the clear — this opens the beat
      tutorial.tick(TUT_BEAT + 1);  // ...and run the beat out, so the next
                                    // lesson has actually landed to look at
      setTimeout(step, 120);
    };
    setTimeout(step, 900);
  }

  // Browser acceptance adapter, available only when explicitly requested.
  // Tests use the real commands/transitions, and inspect serializable state.
  if (urlParams.get('acceptance') === '1') {
    window.__stalheartTest = {
      state: () => ({ round, wave, runGen: runContext.generation, heart: heartHP, hulls: playerHP,
        biomass: eco.biomass, towers: towers.length, won: player.won, paused,
        roster: ROSTER.id, mission: missionOn, buildMode,
        playerAsset: playerMesh?.userData.asset || params.creature,
        playerAssetReady: !playerMesh?.userData.loading,
        playerModelStats: playerMesh?.userData.modelStats,
        heartAsset: heartSprite?.userData.asset || params.heartLook,
        heartAssetState: heartSprite?.userData.assetState,
        performance:perfSample,shieldClock:t,motionClock:runContext.time,shield:{seconds:shield.t,rack:shield.rack,cooldown:Math.max(0,shield.coolUntil-t),drops:shieldDrops,visible:shieldObj?.visible},
        cannonHeat,ammo,cannonColor:playerMesh?.userData.heatSleeve?.material.color.getHex(),
        engagement:towers.filter(tw=>CONTENT.missiles[tw.key]).map(tw=>({key:tw.key,config:engagementConfig(tw),
          target:tw.missileTarget?.id??null,lock:tw.lock,aim:tw.aimErr,cooldown:tw.cooldown,
          ammo:tw.a6?.ammo,fired:tw.a6?.fired,trips:tw.a6?.trips,walkerState:tw.a6?.state})),
        missileReady:!!missilePool,missilePool:missilePool?.stats(),seekerHits,seekerLost,
        missiles:towerSeekers.map(m=>({key:m.by.key,config:m.config,t:m.t,name:m.mesh.name,
          position:m.mesh.position.toArray(),ignition:m.mesh.getObjectByName('EXHAUST_FX').visible})),
        drawCalls: renderer.info.render.calls,
        playerPosition: player.pos.slice(), playerCell: player.cur, deploying: !!deploy,
        playerBlocked: freeBlocked(player.pos),
        camp: berths.map(b => ({ ...b, open: dungeon.tags[b.ci] !== BLOCKED && dungeon.tags[b.exit] !== BLOCKED,
          clearance: dist3(graph.centers[b.exit], graph.centers[dungeon.heart]) - pedestalRadius() })) }),
      shieldScenario: () => {
        endShot();dismissIntro();if(tutorialActive)endTutorial();paused=true;
        for(const e of enemies){e.alive=false;scene.remove(e.obj);}spawnQueue.length=0;
        const ci=dungeon.tags.findIndex((tag,i)=>!placeError(i) && !towerByCell.has(i));
        if(ci<0)return false;
        const tw=commitTower('relay',ci,0);player.pos=graph.centers[ci].slice();
        shield.t=0;shield.coolUntil=-Infinity;shield.rack=2;shield.stationLeft=0;shield.taps.clear();shieldDrops=0;
        return tw.id;
      },
      shieldAdvance: seconds => {for(let left=seconds;left>1e-9;){const dt=Math.min(1/60,left);left-=dt;t+=dt;stepShieldDynamics(dt,t);stepTowers(dt,t);updateBeams(dt);}updateHud();placeActors();},
      leaveRelay: () => {player.pos=player.pos.map(v=>-v);},
      relayOffline: id => towerOffline(shield,id,t),
      deployShield: () => {const was=paused;paused=false;const result=deployShieldNow();paused=was;return result;},
      fireShell: () => fire(),
      showRecordTest: () => {
        rs.bestShell={kills:1000};rs.bestStrike={kills:1001};run.bestStreak=999;rs.maxCombo=1200;
        renderAnalysis(false);
      },
      missileScenario: key => {
        endShot();dismissIntro();if(tutorialActive)endTutorial();paused=true;
        clearTowers();for(const e of enemies){e.alive=false;scene.remove(e.obj);}enemies.length=0;spawnQueue.length=0;
        const ci=dungeon.tags.findIndex((tag,i)=>!placeError(i) && !towerByCell.has(i));
        if(ci<0)return false;
        const tw=commitTower(key,ci,0);
        for(const id of [-901,-902])enemies.push({id,alive:true,hp:1000,spec:{rammable:false},pos:graph.centers[ci].slice(),obj:new THREE.Group()});
        return !!tw;
      },
      missileTargets: distances => {
        const tw=towers.find(tw=>CONTENT.missiles[tw.key]);if(!tw)return;
        const from=norm3(tw.a6?.pos || graph.centers[tw.ci]);
        const ref=Math.abs(from[1])<.9?[0,1,0]:[1,0,0],forward=norm3(cross3(from,ref));
        for(let i=0;i<2;i++){
          const e=enemies.find(e=>e.id===-901-i);if(!e)continue;
          const angle=metresToArc(distances[i],cellSide);e.alive=true;
          e.pos=add3(scale3(from,Math.cos(angle)),scale3(forward,Math.sin(angle)));
        }
      },
      missileAdvance: seconds => {for(let left=seconds;left>1e-9;){const dt=Math.min(1/60,left);left-=dt;t+=dt;stepTowers(dt,t);}},
      fireMissile: key => {
        if(!CONTENT.missiles[key] || !lookReady(params.towerLook) || !missilePool?.available)return false;
        const ci=dungeon.tags.findIndex((tag,i)=>!placeError(i) && !towerByCell.has(i));
        if(ci<0)return false;
        const tw=commitTower(key,ci,0);
        if(tw.obj.userData.pitchNode)tw.obj.userData.pitchNode.rotation.x=-MISSILE_LAUNCH_ELEVATION*Math.PI/180;
        const from=towerMuzzle(tw,graph.centers[ci]);
        const up=norm3(from),ref=Math.abs(up[1])<.9?[0,1,0]:[1,0,0],forward=norm3(cross3(up,ref));
        const target={id:-1000,pos:add3(scale3(up,Math.cos(cellSide*3)),scale3(forward,Math.sin(cellSide*3)))};
        return launchTowerSeeker(tw,from,target,runContext.time);
      },
      openBuildMenu: () => {
        endShot(); dismissIntro(); if (tutorialActive) endTutorial();
        const ci = dungeon.tags.findIndex((tag, i) => !placeError(i) && !towerByCell.has(i));
        if (ci < 0) return false;
        openShop(ci, innerWidth / 2, innerHeight / 2); return true;
      },
      begin: () => { endShot(); dismissIntro(); paused = false; tutorial.frozen = false; },
      clearSector: () => {
        endShot(); dismissIntro();
        if (tutorialActive) endTutorial();
        paused = false; tutorial.frozen = false;
        spawnQueue.length = 0;
        for (const e of enemies) { e.alive = false; scene.remove(e.obj); }
        for (const sp of spawnPoints) { sp.alive = false; scene.remove(sp.obj); }
        eco.spend(eco.biomass); // exercise the zero-income early-clear case
        checkVictory(); endShot(); renderVerdict(round >= SECTORS_TOTAL);
      },
      focusHeart: () => { endShot(); dismissIntro(); if (tutorialActive) endTutorial(); setView('orbit'); centerBuildOnHeart(); followSuspend = true; buildDist = 1.65; },
      deployHull: n => { endShot(); dismissIntro(); if (tutorialActive) endTutorial(); paused = false; tutorial.frozen = false; deployStart(n); },
      restart: () => regenerate(),
      heartHealth: fraction => { heartHP = Math.max(0, Math.min(HEART_MAX, fraction * HEART_MAX)); heartSprite.userData.setHealth?.(fraction); },
    };
  }

  resize();
  animate();

  return {
    dispose() { active = false; runTimers.dispose(); runContext.dispose(); missilesDisposed=true; missilePool?.dispose(); setPerfOverlay(false,false); },
    setActive(on) {
      active = on;
      if (!on) stopEngine(0.1, true); // quiet: leaving the tab is not a landing
      if (on) { resize(); snapCamera(); }
      else if (wasPlaying) {
        wasPlaying = false;
        document.body.classList.remove('playing');
      }
    },
  };
}
