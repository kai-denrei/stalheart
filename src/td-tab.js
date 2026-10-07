import { createSentryPilot } from './sentry-pilot.js';
import { DEFAULT_TANK, SHELL_SPEED, SHELL_REACH, TANK_DRIVE, TANK_STEER, TANK_WALL } from './content/tank.js'; import { makeDriveRamp } from './domain/drive-ramp.js'; import { hullDepth, deepensContact } from './domain/hull-contact.js'; import { makeSteerEase, steerBank } from './domain/steer-ease.js'; import { baseFor, restoreSeatView } from './domain/seat-view.js'; import { BASE_REPAIR } from './content/base-programme.js';
import { createGameBreaches } from './game-breaches.js'; import { ramShotPose } from './domain/showcase-shot.js';   /* THE RAM BEAT'S OWN FRAMING: low behind the hull (src/domain/showcase-shot.js; the band of cells it drives into is the showcase hooks') */
import { createBoardSurface } from './fx/board-surface.js'; import { createCampaignDebrief, sparkline } from './fx/campaign-debrief.js'; import { createSectorRun } from './fx/sector-run.js'; import { createBackDoor } from './fx/back-door.js'; import { isaoFace, orbitFrame, tourFrame, tourSeconds } from './domain/story-shots.js';
import { startDiveShot } from './fx/dive-shot.js'; import { createCameraShots } from './fx/camera-shot.js'; import { createIntegrityHud } from './fx/integrity-hud.js'; import { createSeatGlide } from './fx/seat-glide.js'; import { viewEdge, viewportLine } from './domain/view-edge.js'; import { boxOverlaps } from './domain/box-overlaps.js'; import { makeShaderWarmer } from './fx/shader-warm.js'; 
import { BREACH_SOUNDS } from './content/breach-defaults.js';
import { SOUNDS } from './content/runtime.js';
import { applyScare } from './domain/impact-scare.js';
import { EXPLOSION_SCARE } from './content/explosions.js';
import { createThermalHeat } from './fx/thermal-heat.js';
import { isAutomated } from './domain/automation.js';
import { fillFromKill, fillFromWaveClear, isFull as callFull, callProgress } from './domain/gunship-call.js';
import { GUNSHIP_CALL, GUNSHIP_FAR } from './content/gunship.js';
import { unlockedTowers } from './domain/expeditions.js';
import { createExpeditionsHost } from './fx/expedition-glue.js';
import { CARGO_LOOK } from './content/cargo.js';
import { STORY_EXPEDITIONS } from './content/story-defaults.js'; import { RECKLESS_MSGS, HEART_MSGS, DIRECTIVE_LABEL, AUTO_OPTIONS, SHELL_WORDS, VERDICT_LOW, VERDICT_MID, VERDICT_HIGH } from './content/controller-copy.js';
import { hasPerk as programmeHas, snapshot as programmeSnapshot, lose as programmeLose } from './domain/build-programme.js';
import { createProgramWarm } from './fx/program-warm.js';
import { devModeOn } from './core/dev-mode.js';
import { createControlsCard } from './fx/controls-card.js';
import { createTutorialCard } from './fx/tutorial-card.js';
import { openStoryAt } from './fx/story-entry.js';
import { isStoryRoute } from './core/story-route.js';
// SKIP TUTORIAL (owner, 2026-09-16): the player's own way past the opening, and the state ?skip=defence starts in
import { STORY_SKIP, STORY_MISSION } from './content/story-defaults.js';
// THE SHOWCASE (owner, 2026-09-18): the core loop as a montage over this very world, before the landing
import { createShowcase } from './fx/showcase.js';
import { showcaseOn } from './platform/showcase-entry.js';
import { createHullLoss } from './fx/hull-loss.js'; import { bayContainers, syncBays } from './fx/life-bays.js';
import { RELEASE_EVENTS, releasesHeld, releaseHeld } from './core/held-input.js';
import { METRES_PER_CELL, arcToMetres, metresToArc } from './core/stage-units.js';
import { pickMissileTarget, missileLimits } from './domain/missile-targeting.js';
import { createRunContext } from './domain/run-context.js'; import { trunkCells, simDirective, simPick } from './domain/sim-policy.js'; import { towerPerch } from './domain/tower-perch.js';
import { createRunTimers } from './platform/run-timers.js'; import { createSimRun } from './platform/sim-run.js'; import { createDiagOverlay } from './platform/diag-overlay.js'; import { readGameFlags } from './platform/game-flags.js'; import { createPerfOverlay } from './platform/perf-overlay.js'; import { createDevPanel } from './platform/dev-panel.js';
import { createMissilePool, launchDart, advanceDart } from './missiles.js';
import { MISSILE_LAUNCH_ELEVATION } from './content/missile-defaults.js';
import { CONTENT } from './content/runtime.js';
import { preloadSentryTerraformer, makeSentryTerraformer } from './terraformer.js';
import { GAME_START_BIOMASS, SINK, tollFor, breachGrant, debriefAffordable } from './campaign.js';
import { record } from './diagnostics.js';
import { storage as localStorage } from './storage.js';
// td-tab.js — the game controller: one closure (initTdTab) that owns the world, the frame loop and the wiring between them. The
// rules live in src/core, src/domain and src/content and the composition in src/fx and src/platform (docs/ARCHITECTURE.md). The
// story is the game (docs/STATE.md); the campaign board under it serves the acceptance runs and the wave simulator.

import { makeStuck } from './domain/hull-stuck.js'; import { highlightSeat } from './fx/seat-highlight.js'; import { HULL_STUCK, TANK_PLASMA } from './content/tank.js'; import { QUIVER_SPLASH, STORY_SENTRIES } from './content/sentries.js';   // the hull gets unstuck (owner, 2026-10-02)
import { makeKick } from './domain/hover-kick.js'; import { showMission } from './fx/mission-card.js'; 
import * as THREE from '../vendor/three.module.js';
import GUI from '../vendor/lil-gui.esm.js';
import { bfsDist, BLOCKED, PATH, ROOM } from './dungeon.js';
import { buildGameWorld, readStoryQuery, STORY_SOUNDS, takeControlPose } from './platform/story-world.js';
import { createUnlockHost } from './fx/story-views.js';
import { buildReadout } from './fx/build-readout.js';
import { createStoryMonitor } from './fx/story-monitor.js';
import { createDaylight } from './fx/daylight.js';
import { createStoryScope, createScopeFeed } from './fx/story-scope.js';
import { createSyntheticModal } from './fx/synthetic-modal.js';
import { mulberry32, randomSeed } from './rng.js';
import { createLaserStation, structureLostHtml } from './fx/laser-station.js'; import { LASER_GAME } from './content/orbital-laser.js'; import { createGlossaryModals } from './fx/glossary-modals.js'; import { makeTriadIcon, glossCard, GAMEPLAY_TIPS } from './fx/briefing-cards.js';
import { computeBerths, berthIndexFor } from './berths.js'; import { createProgrammeHost } from './fx/programme-host.js'; import { strikeFallPose, droneRidePose, bastionPose, tankViewPose } from './domain/camera-goal.js'; import { createShopRadial } from './fx/shop-radial.js'; import { berthRun, berthHeading, deployU, easeDeploy, deployFraming } from './domain/deploy-path.js';
import { createSkyRig } from './fx/sky-rig.js'; import { createIsaoMoments } from './fx/isao-moments.js'; import { createColonyTick } from './fx/colony-tick.js'; import { createAutoSupport } from './fx/auto-support.js';
import { createCanyonRun } from './fx/canyon-run.js'; import { createEndingHost } from './fx/ending-host.js'; import { createIsaoWorker } from './fx/isao-worker.js'; import { createHullDrive } from './fx/hull-drive.js'; import { createTowerCombat } from './fx/tower-combat.js';
import { createEnemyStep } from './fx/enemy-step.js'; import { createTankLaser } from './fx/tank-laser.js'; import { createPlasmaBeams } from './fx/plasma-beams.js'; import { createWarnRing } from './fx/warn-ring.js'; import { createHullHost } from './fx/hull-issue.js';
import { wantsSecondary, shellsForAll } from './autofire.js';
import { PLASMA_DEFAULTS } from './beamdraw.js';
import { sub3, add3, scale3, dot3, cross3, norm3, len3, dist3, segKey, tangentBasis } from './vec3.js';
import { CREATURES, waveJelly } from './creatures.js';
import { brief, lineDwell, BRIEFS } from './isaobriefs.js'; import { lookIsao } from './fx/isao-look.js';
import { drawEmotion } from './emotions.js';
import { ACHIEVEMENTS, ACHV_GROUPS, achievement, blankRun, earned, freshlyEarned,
  sanitiseRecord }
  from './achievements.js';
import { applyFontPack, currentFontPack, loadTypeFeel } from './fonts.js';
import { UNITS, buildUnit, buildCreature, preloadMork, makeShieldShell, preloadContainer, makeContainerFixture, makeBulletCloud, makeRewardSolid, makeShellSolid, makeDebris, makeDotBurst, makeHeartCloud, makeDotEnemy } from './units.js';
import { LOOKS } from './looks.js';
import { makeCellIndex } from './cellindex.js';
import { CREATURE_TINTS, ENEMY_SPEC, INTROS, computeWavePlan } from './enemyspec.js';
import { PICKUPS } from './pickups.js'; import { hushRotor } from './fx/rotor-voice.js';
import { rankFor, rankLabel, badgeSVG } from './ranks.js';
import { beamStep, isBeamStep } from './beamranks.js';
import { marchToTerrain, roundEnd, marchAlongArc, arcOf } from './domain/round-path.js';
import { impactOf } from './sentryfx.js'; // the package's muzzle recipe is the one master setting
import { makeSeekerMesh, aimSeeker } from './shotfx.js';
import { SHIELD_TUNE, SHIELD_KNOBS, makeShield, charge as chargeShield,
  deploy as deployShield, tickShield, stepShieldFrame, restockShield, towerOffline,
  makeArrayStation, refillArray } from './shield.js'; import { SHIELD_ARRAY } from './content/shield-array.js'; import { makePadRing, glowPadRing, shieldPanel } from './fx/shield-array.js'; import { createRamReadout } from './fx/ram-readout.js';
import { deepLink, wireDeepLink } from './deeplink.js';
import { parseLabQuery } from './lab.js';
import { bakeGalaxyCube } from './galaxybake.js';
import { SKY_PRESET } from './galaxyseed.js';
import { makeScore } from './score.js';
import { TOWERS, TOWER_BY_KEY, MAX_TIER, upgradeCost, effectiveStats as baseEffectiveStats, shotInterval, unlockedTowerKeys, starterTower, ROSTER } from './towers.js';
import { makeEconomy, sellRefund } from './economy.js';
import { pickTier } from './perftier.js';
import { applyWeatheredMaterial } from './fx/weathered-material.js'; import { sentryBookFull } from './domain/sentry-cap.js'; import { setTierPlate } from './fx/tier-plate.js';
import { STICK, stickVector, knobOffset } from './stick.js';
import { makeBloom } from './postfx.js';
import { TANK_FEEL, makeTankFeel, stepTankFeel, landTankFeel, fireTankFeel, applyTankFeel, applyTankHealth } from './tankfeel.js';
import { FEEL } from './feelstore.js';
import { makeStrike, makeStrikeParams, grantStrikes, stepStrike,
  toggleArm, paintTarget, launchStrike, stepFall, skipFall, fallProgress,
  strikeDamage, retargetStrike, orbitProgress } from './strike.js'; import { makeGunship, onStation, phaseLeft, selectGun, startStation } from './domain/gunship.js'; import { GUNSHIP_GUNS, GUNSHIP_ORBIT } from './content/gunship.js'; import { createGunshipBriefing } from './fx/gunship-briefing.js'; import { createFoundryFx } from './fx/foundry-fx.js'; import { createExplosions } from './fx/explosions.js';
import { createRadarScope } from './fx/radar-scope.js'; import { createTowerAim } from './fx/tower-aim.js'; import { buildVarsModal } from './fx/vars-modal.js'; import { startVictoryPull } from './fx/victory-pull.js'; import { createShowcaseHooks } from './fx/showcase-hooks.js'; import { createGunshipRig } from './fx/gunship-rig.js';
import { makeA6, arc as a6Arc } from './heptapod.js';
import { DEFAULT_TOWER_LOOK, buildTowerLook, preloadLook, lookReady } from './towerlooks.js';
import { makeAudio } from './audio.js'; import { isaoSay } from './fx/isao-voice.js'; import { createCrowdGate } from './fx/crowd-gate.js'; import { shedSquad, squadDamage } from './fx/squads.js';

export function initTdTab(root) {
  const flags = readGameFlags();   // THE URL FLAGS, read once (src/platform/game-flags.js)
  let controlsCard = null, pilotMode = false, storyViews = null, viewWas = null, pilotHost = null, storyMonitor = null, daylight = null, storyScope = null, syntheticModal = null, brass = null, hudFrame = -1, hudDirty = false, frameNo = 0, inFrame = false;   // the story enters it at runtime; the view strip unlocks after the first wave
  let pilot = null;
  let pilotPosts = [], pilotPost = 0;
  const pilotMounts = [];
  let active = false, disposed = false;
  let wasPlaying = false; // drives body.playing (mobile hides ALL chrome)

  const params = {
    towerLook: DEFAULT_TOWER_LOOK,
    // app-wide, but it lives in this GUI because this is the tab whose
    // messages the packs were chosen for (src/fonts.js owns the table)
    font: currentFontPack(),
    seed: 7,
    heartLook: 'sentryTerraformer', // what stands at the pole — see HEART_LOOKS. The pre-A6 terraformer (the wide machine on a round pad) was purged 2026-09-14
    callouts: true,           // the encouragement layer; numbers survive it going off
    // The whole unlock run — every wave until the last tower unlocks — is a guided tutorial, and it should be played on a TIGHT
    // board: at 3000 the opening sector was 146 open cells, at 500 it is 84. Cells are also ~2.4x wider, so the board reads
    // chunky and legible rather than sprawling. Sector expansion is unaffected — round 2 still opens 278. Larger maps for the
    // post-tutorial game are a separate, later change.
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
    speed: 1.1, // cells per second, wanderer pace
    recoil: 8, // shell-recoil intensity, dialed to MAX per operator
    directive: 'wander', // auto-mode order: wander/avoid/ram/conserve/home/portal
    // Hover feel, all live-tunable — these were guessed wrong twice, so they are knobs rather than constants. Units: `hoverRise`
    // is in MODEL units (the tank is ~3.24 tall there), because it moves the body group inside the model, not the unit on the
    // sphere.
    // MÖRK by default: the authored hover tank, and the ONLY hull. Async — buildUnit stands an empty placeholder until the bytes
    // land and applyCreature swaps the real one in; no other tank is ever drawn.
    creature: DEFAULT_TANK,
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
  const mobileParam = flags.mobile;
  const mobileShell = mobileParam === '1' ? true : mobileParam === '0' ? false
    : (matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 900);
  document.body.classList.toggle('mobile-shell', mobileShell);
  // ?coarse=1 — SIMULATE A COARSE POINTER for the ruler: no headless flag makes `(pointer: coarse)` true, so the media conditions
  // in the loaded sheets are rewritten; called again at measure time (at init `cssRules` is empty) and it says how many it flipped.
  function simulateCoarse() {
    if (mobileParam !== '1' || flags.coarse !== '1') return 0;
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
          // BOTH sides of the pointer: coarse/hover-none become true AND fine/hover-hover become false — headless is `pointer:
          // fine`, and leaving that half alone hid the thumbs (a fine-pointer block) under a coarse layout, a combination no
          // device has
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
  // ?coarse=1 — SIMULATE A COARSE POINTER for the ruler. No headless flag makes `(pointer: coarse)` true (primaryPointerType
  // blink-settings were tried: still false), so every rule in the phone's coarse blocks was invisible to ?layout, which reported
  // 0 overlaps on a layout the phone never shows — the operator's screenshot showed the radar swallowing the launch console.
  if (mobileParam === '1' && flags.coarse === '1') {
    console.log(`COARSE simulated at init: ${simulateCoarse()} media blocks now apply`);
  }

  // THE RENDER BUDGET (plan §2.9): one table, picked once. ?mobile=1|0 forces the matching tier so
  // a headless run — never coarse — measures what a phone gets; ?tier=
  // overrides on its own for a phone that wants the desktop look.
  // THE METAL ON THE BOARD (operator, 2026-09-04: "add the metal effect to
  // the default game"). The weathered maps (src/weathered.js, the metal
  // lab's preset) on every cast the board makes — the tank, the
  // containers, the Terraformer, the gates — at the tier's size, KEEPING
  // the grey ladder's colour and emissive: the board is dimly lit and the
  // rungs are why the machines read. ?metal=0 returns the flat cast.
  const metalOn = flags.metal !== '0';
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
    forced: flags.tier
      || (mobileParam === '1' ? 'phone' : mobileParam === '0' ? 'desktop' : null),
  });

  // THE STRESS LAB (operator, 2026-09-03; src/lab.js). `?lab=1` and nothing
  // else changes: every branch below is `lab.on && …`, so a run without the
  // flag executes the code it executed yesterday. The lab opens on the
  // tier's own portal numbers; a URL may override them (`?labWhSize=`).
  const lab = parseLabQuery(location.search, tier) || { on: false };
  // THE SKY: a seeded galaxy field baked into a cubemap once per run (see
  // galaxybake.js; measured +0.2 ms a frame at 1x). The seed is fresh on every
  // reset — the sky is dressing, not game logic. The lab's knobs drive the same
  // bake when the lab is on; without it the game's SKY_PRESET does.
  let sky = null;        // { texture, key, dispose } once baked
  // ?sky=N pins the sky's seed: the sky is the one thing on the board
  // allowed a fresh seed per reset, and the one thing that made two
  // director captures of the same script differ in every frame
  const skyQ = flags.sky;
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
  const renderer = new THREE.WebGLRenderer({ antialias: tier.antialias }); renderer.localClippingEnabled = true;   // the sentry print's rising cut (src/fx/tower-print.js)
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier.dprCap));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const mainBg = new THREE.Color(0x0d1017);
  scene.background = mainBg;

  const camera = new THREE.PerspectiveCamera(68, 1, 0.004, 50);
  const postfx = makeBloom(renderer, scene, camera, { scale: tier.bloomScale });
  const warmShaders = makeShaderWarmer(renderer, scene, camera);
  const programWarm = createProgramWarm(renderer, scene, camera);
  const explosions = createExplosions(scene, { onError: (error) => record('explosions.unavailable', { message: error.message }) });
  const thermalHeat = createThermalHeat(() => ({ warm: [storyBase?.group, playerMesh, ...towers.map((tw) => tw.obj)], hot: [...['stalheart', 'foundry', 'assembly'].map((id) => storyBase?.structure(id)?.holder), isao?.obj] }), { postfx });
  const automated = () => !!story && isAutomated(story.beats.phase(), story.handover);
  // the lab's explosions (src/fx/explosions.js); callers keep their dot bursts when this returns false
  const explode = (use, p) => { const sc = EXPLOSION_SCARE[use]; if (sc) applyScare(enemies, p, { radius: sc.cells * cellSide, seconds: sc.seconds }); return explosions.spawn(use, p, norm3(p), cellSide); };
  // sound. The context can only be born on a user gesture, so arm() wires
  // one-shot listeners and the first tap/keypress creates it. Until then
  // every play() is a silent no-op -- the game never waits on audio.
  const sfx = makeAudio({ seed: 1, sounds:{...SOUNDS,...BREACH_SOUNDS,...(isStoryRoute(location.search)?STORY_SOUNDS:{})} });   // every story page (a bare one has no world=story)
  const gameBreaches=createGameBreaches(scene,camera,sfx,{look:()=>params.look});
  // SOL-82 IN THE ARSENAL (src/fx/laser-station.js): the pass clock, the seat, the beam through the game's own paths
  const laserStation = createLaserStation(root, scene, {
    online: LASER_GAME.online || flags.laser === 'online', get mobile() { return mobileShell; },
    cellSide: () => cellSide, wallHeight: () => params.wallHeight, centers: () => graph.centers, adj: () => graph.adj, tags: () => dungeon.tags, cellAt: (p) => cellIndex(norm3(p)),
    heart: () => graph.centers[dungeon.heart], heartCell: () => dungeon.heart, lane: () => graph.centers[gunshipRig.lane()], tank: () => player.pos,
    enemies: () => enemies, breaches: () => spawnPoints.filter((sp) => sp.alive && sp.obj?.userData.breach && !sp.obj.userData.keep).sort((a, b) => (sectorRun?.owns(b) ? 1 : 0) - (sectorRun?.owns(a) ? 1 : 0)), towers: () => towers, walls: () => storyBase?.walls?.() ?? [], anchors: () => storyBase?.anchors?.() ?? new Set(),
    burnBody: (e) => damageEnemy(e, t, e.hp + 1, true, 'laser'), seal: (sp) => killPortal(sp, 'laser'), burnTower: (tw) => destroyTower(tw), burnWall: (w) => storyBase?.dropWall(w.index),
    breakCells: (cells) => { if (cells.filter((ci) => breachWallCell(ci)).length) rebuildAfterBreach(); }, burnHeart: () => heartHit(heartHP), burnTank: (p) => playerHit('laser', p),
    structures: () => storyBase?.standing?.() ?? [],
    // OURS UNDER THE BEAM was the warning; this is the bill
    burnStructure: (id) => {
      if (!story || story.lost.has(id)) return;
      story.lost.add(id);
      storyBase?.conceal(id);
      const gone = programmeLose(story.programme, id);
      // A BURNED RADAR TAKES SOL-82 OFFLINE: no uplink, no pass
      if (id === 'radar') laserStation.setOnline(false);
      // burned bays lose the spare hulls racked under them
      if (id === 'bays' && playerHP > 1) { playerHP = 1; syncLifeContainers(); }
      updateHud();
      showToast(structureLostHtml(id, gone), 3200);
    },
    explode: (use, p) => explode(use, p),
    brief: (id) => showBrief(id),
    callout: (x) => showCallout(x, 'co-victory'),
    loop: (key) => sfx.loop(key),
    views: () => storyViews,
    canvas: () => renderer.domElement,
    fov: () => camera.fov,
    paused: (v) => { const was = paused; if (v !== undefined) paused = v; return was; }, togglePause: () => togglePause(),   /* the seat's P shows the pause card, as ESC does (2026-09-25) */
    // OCCUPANCY IS EXCLUSIVE (src/domain/seat-view.js): the strip button is caught here, so `vacate` leaves the seat the player was
    // in first; SOL-82 once opened on top of the gunship (owner, 2026-09-23)
    vacate: () => leavePilot(),
    enter: (fov) => {
      closeShop();
      seatGlide.begin(camera);
      seatBase = baseFor(seatBase, pilotMode, { view: params.view, fov: camera.fov });
      keys.left = keys.right = keys.fast = keys.slow = keys.laser = false;
      cruise = false;
      throttle = 0;
      endShot();
      camera.fov = fov;
      camera.updateProjectionMatrix();
      snapCamera();
    },
    leave: () => { seatGlide.begin(camera); restoreSeat(); },   /* the lens and the view this chain of seats was entered from (2026-09-15-gunship-track-latched-and-seat-lens-reset, 2026-09-23-seat-changes-robust) */
  });
  sfx.arm();
  // THE ALARM IS THE PROOF OF LIFE (operator, 2026-09-01): the klaxon fires the moment the audio context runs, on the first click
  sfx.whenRunning(() => {
    // TWO sounds, deliberately, by two completely different routes. The oscillator uses NONE of the sample path — no decoded
    // buffer, no bus, no master, no mix admission — so hearing one and not the other localises the fault without needing a
    // special URL or another round trip. Six attempts failed to ask this question; now every load asks it.
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
  // A blip per enemy would have been an object per enemy, which is the cost being removed. One buffer rewritten each frame is one
  // draw call for the lot, however many there are.
  // Layer 1 survives as a tag on the board meshes (harmless), but nothing renders it any more: the minimap's second WebGL scene
  // is gone, replaced by the 2D radar below.
  const MAP_LAYER = 1;

  // --- wave telegraph: the gate CHARGES (swells, brightens, beats faster, a shock ring each beat) over the last seconds, so the warning
  // is on the thing the enemies come out of. 3.0 exactly: the 3.7 s warning sound starts here and is still running as the first clears the gate
  const WAVE_WARN = CONTENT.breach.duration;      // seconds of charge before the wave lands
  let waveCharge = 0;         // 0..1 over that window
  let warnBeat = 0;           // seconds until the next shock ring
  // >= 0 means a wave is ARMED and counting down. Every route to spawnWave
  // goes through this, so a wave cannot arrive without its lead-in.
  let waveIn = -1;

  // --- orbital strike -------------------------------------------------------
  // All logic lives in strike.js (pure, tested); this file owns only what it
  // looks and sounds like. strikeTune is the live knob object the GUI writes.
  const sealedBreachCells = new Set(); const strike = makeStrike(), gunship = makeGunship(GUNSHIP_ORBIT, { station: flags.gunship === 'station' }); let gunshipBriefing = null, foundryFx = null;   /* the platform's schedule runs on the game clock beside the strike's ration; ?gunship=station opens its first pass at once, for acceptance */
  const gunshipRig = createGunshipRig({ scene, sfx, explode, automated, gunship, strike, sealedBreachCells, camDist, cellAtScreen, centerBuildOnHeart, damageEnemy, executeStrike, warnRing, showRangeRing, hideRangeRing, cellIndex: (p) => cellIndex(p), setFollowSuspend: (v) => { followSuspend = v; }, setBuildDist: (v) => { buildDist = v; },   /* THE GUNSHIP RIG (src/fx/gunship-rig.js): optic, track, MK-9, wall cache and call meter */
    story: () => story, storyViews: () => storyViews, graph: () => graph, dungeon: () => dungeon, cellSide: () => cellSide, pilot: () => pilot, pilotHost: () => pilotHost, isao: () => isao, t: () => t, gunshipBriefing: () => gunshipBriefing, enemies: () => enemies, spawnPoints: () => spawnPoints, debris: () => debris, player: () => player, towers: () => towers, strikeTune: () => strikeTune });
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

  // THE WARN RINGS (src/fx/warn-ring.js): one pooled cloud for every ring, main view only — the map has its blips
  const warnRings = createWarnRing(scene, {
    graph: () => graph,
    cellSide: () => cellSide,
  });
  function warnRing(...a) { return warnRings.ring(...a); }
  function stepWarnFx(...a) { return warnRings.tick(...a); }

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
  scene.add(fill); explosions.prewarm(renderer, camera); gameBreaches.warm(warmShaders); warmShaders.compile(makeDebris(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial()), [0, 1, 0]));   /* the sinkhole's programs and stone maps, and the wall debris's two-sided material, off the first breach's opening frame (src/fx/shader-warm.js) */

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
  let floorOffsets = null, boardSurface = null; const breachQueue = []; // open cell -> its first floor vertex; the surface a breach patches (src/fx/board-surface.js); cells breached since the last patch
  let integrityHud = null, heartSprite = null, playerMesh = null, markerMesh = null, storyBase = null, story = null, sectorRun = null, skipCard = null, showcase = null, showcaseRamCam = false;   /* skipCard: the SKIP TUTORIAL offer (src/fx/skip-tutorial.js) */   /* showcaseRamCam: the montage's ram beat owns its camera (src/domain/showcase-shot.js), the game's chase view frames the hull off the bottom edge */
  // WHAT STANDS AT THE POLE. Both entries satisfy one contract — sizeScale,
  // tick(t), hit() — so swapping them changes how the Stalheart LOOKS and
  // never what it DOES. Same registry seam as looks / towerlooks /
  // unitcatalog, and the reason this could be tried without touching
  // heartHit, the minimap, the bastion camera or the win condition.
  const HEART_LOOKS = {
    sentryTerraformer: { label: 'Terraformer 3000 (Sentry)', preload: () => preloadSentryTerraformer(), make: makeSentryTerraformer, footprint: 1.12, scale: 1.9, lift: 0.16 },
    none: { label: 'none (story base owns the Stalheart)', preload: () => Promise.resolve(true), make: () => Object.assign(new THREE.Group(), { userData: { tick() {}, asset: 'none' } }), scale: 1, lift: 0 },
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
  let containerGen = 0;   // a board rebuild invalidates an in-flight life-container load
  // the LIFE CONTAINERS: 3 near the heart, each { obj, tank } — the spare
  // hulls ARE the lives counter (playerHP - 1 spares stocked)
  let lifeContainers = [];
  // WHERE THE CAMP IS — known synchronously, from the board alone. The
  // container models decorate these cells; they never choose them, which is
  // what lets a reset place the tank once instead of teleporting it later.
  let berths = [];
  // walls the PLAYER opened (shells, strikes) stay open across rounds —
  // demolition is permanent (operator ruling: a breach you paid for does
  // not grow back at the next frontier shift)
  const breachedCells = new Set();

  // creature dot-cloud + gameplay state
  let creatureBase = null;   // unit-radius [x,y,z,(hi)] points from creatures.js
  let creatureGeo = null;
  let creaturePos = null;    // Float32Array scratch for waveJelly
  let baseUnitScale = 0.04;  // creature world radius at birth
  let unitScale = 0.04;      // current radius; grows on absorb
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

  // THE BOARD'S DEEP LINK. A board is only reproducible with its SEED, and
  // the seed can move under you — a regenerate, a new planet — so it is
  // always written rather than diffed against the opening default. The
  // mission is diffed, so a campaign link simply has no mission in it.
  wireDeepLink(root.querySelector('#td-link'), () => deepLink({
    base: location.origin + location.pathname, hash: 'td',
    carry: location.search,
    params: { seed: params.seed },
    defaults: {},
  }), { label: 'TD', flash: (m) => showToast(`<div class="wave-role">${m}</div>`, 2600) });

  let nextEnemyId=1;
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
  // Orbital strikes seal ground breaches early, sacrificing their future
  // kills, biomass and score. Holding every wave seals them on exhaustion.

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
  // Seconds left on the current LINE. A countdown driven from the frame loop, deliberately not a setTimeout: this file has
  // already paid once for deferred work outliving the run that scheduled it (the death timer that fired after a retry), and a
  // frame-loop accumulator cannot outlive anything. `briefDwell` is kept only to size the progress bar.
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
    const bf = briefQ.faces?.[briefAt] ?? briefQ.face; drawEmotion(ctx, bf, { w: briefFace.width, h: briefFace.height, t: (bf === 'scan' || bf === 'skeptical') && briefFaceT < 1.5 ? briefFaceT : 0 }); if (isao && briefQ.faces) isao.faceLock = briefQ.faces[briefAt];   // held faces; only scan and skeptical move, briefly. The drone wears the line's face too (src/fx/isao-look.js)
  }
  function showBrief(id) {
    const b = brief(id);
    if (!b || !briefEl) return;
    if (b.once && briefSeen.includes(id)) return;
    if (b.once && briefPending === id) return;
    // ONE DEEP, AND NO DEEPER. With eight beats two can come due together — the first kill of a wave that has only just been
    // announced, say. Showing the new one on top loses the old one for good, because a `once` beat is marked seen the moment it
    // appears; queueing everything turns Isao into the wall of messages this work exists to remove. So: hold exactly one, and
    // drop any further arrivals on the floor. A beat worth saying twice should not be `once` in the first place.
    if (briefQ) { if (!briefPending) briefPending = id; return; }
    if (b.once) {
      briefSeen.push(id);
      try { localStorage.setItem(BRIEF_SEEN, JSON.stringify(briefSeen)); } catch { /* private mode */ }
    }
    briefQ = b; briefAt = 0; briefFaceT = 0;
    briefDwell = briefLeft = lineDwell(b, 0);
    briefEl.classList.remove('hidden');
    sfx.play('laser_click'); isaoSay(sfx, id, { text: b.lines[0] });
    paintBrief();
  }
  // `auto` = the line ran out of time rather than being tapped. A tap keeps its click; a line retiring on its own makes no
  // noise, or the panel is still demanding attention, the very thing being fixed.
  function stepBrief(auto) {
    if (!briefQ) return;
    briefAt++;
    if (briefAt >= briefQ.lines.length) { endBrief(); return; }
    if (!auto) sfx.play('laser_click'); isaoSay(sfx, `${briefQ.id}#${briefAt}`, { text: briefQ.lines[briefAt] });
    briefDwell = briefLeft = lineDwell(briefQ, briefAt);
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
    briefQ = null; briefLeft = 0; if (isao) isao.faceLock = null;
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
      dungeon.tags[i] = (tdFullTags[i] !== BLOCKED && tdSectorId[i] <= round)
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
    // ...and so are the player's breaches: paid-for demolition survives
    // the frontier shift. (Before the seal on purpose — a breach tunnel
    // that connects to the open network is thereby REACHABLE and stays.)
    for (const ci of breachedCells) {
      if (!towerByCell.has(ci)) dungeon.tags[ci] = PATH;
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
  // the energy shield: a timed bubble over the hull — touch damage bounces off while it holds. shieldObj is lazy-built,
  // scene-level (positioned each frame like the marker, so parent scale can't warp it)
  // a plain spread, exactly as `mineTune` below — there is no tuner panel for either, and inventing one for the shield alone
  // would be a second idiom for the same job. The knobs are reachable BY NAME from the URL, which is how SENTRY_TUNE and
  // BALLISTICS_TUNE are already moved.
  const shieldTune = { ...SHIELD_TUNE };
  const shield = makeShield(shieldTune), arrayStation = makeArrayStation(SHIELD_ARRAY), refillArrays = () => { if (!story?.lost?.has('solar')) refillArray(arrayStation, SHIELD_ARRAY); updateHud(); };   /* A BURNED SOLAR COMPLEX DRIES THE ARRAY: the pad still stands, the reserve never comes back */   /* the solar array's reserve: each sector start calls refillArrays (src/content/shield-array.js) */
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
  // Callouts: quick bragging text for the plays worth bragging about (RECKLESS_MSGS, HEART_MSGS: src/content/controller-copy.js),
  // rotated by a counter, not Math.random — house rule
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
  // fixed steps per frame). The policy's choice rules are src/domain/sim-policy.js, the run's end and its schema-2 result
  // src/platform/sim-run.js (its host sits by the ?sim= boot); the state the frame loop reads stays here.
  let simFast = 0, simStyle = null, simPolClock = 0, simDone = false;
  let ecoAffordT = 0, ecoClockT = 0;   // the ECONOMY MEASURE's two clocks (src/platform/sim-run.js reports them)
  const CHEAPEST_TOWER = Math.min(...TOWERS.map(d => d.cost));
  const simCurve = []; // one point per wave CLEAR: the tuning signal
  let simCap = 600; // sim-seconds before a run reports 'timeout'
  function simTrunk() { return trunkCells(spawnPoints, dungeon, graph); }   // the lanes the policy fortifies (the story HUD's route too)
  function simPolicy(dt) {
    simPolClock += dt;
    if (simPolClock < 2) return; // decide every 2 SIM-seconds
    simPolClock = 0;
    const wantDir = simDirective(simStyle);
    if (params.directive !== wantDir || !autoMode) {
      params.directive = wantDir;
      autoMode = true;
    }
    const pick = simPick(simStyle, { trunk: simTrunk, towers, wave, eco, graph, placeError, roster: TOWERS, byKey: TOWER_BY_KEY, unlocked: unlockedTowerKeys(wave), upgradeCost });
    if (pick?.tower) orderUpgrade(pick.tower); else if (pick) orderTower(pick.key, pick.ci);
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
    if(obj?.userData?.breach){obj.userData.dispose();return;}
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
    // transform-only idle: spin PURELY about the cell's normal. Euler trap: writing rotation.y would REPLACE the alignment
    // quaternion above (they are two views of one rotation) and spin about world-Y — shells then tilt into the ground everywhere
    // but the pole. Compose quaternions: base alignment × local-Y spin.
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

  // free-move collision: the position is blocked if its cell is wall, if it presses into a blocked neighbour's margin (no more
  // nosing into walls), or if a solid unit stands there how many open neighbours a cell has — ≤3 means a narrow hall or a corner
  // pocket, where the anti-clipping margins must relax or the hitbox wedges the tank (the stuck-in-width-1-corridor bug)
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
  // ...and while you are still IN a berth, the boxes either side do not crowd the exit (the margin test's no-go shell round three
  // boxes in a row left a gap the hull could not thread); clear of the berth, they go solid again
  const berthed = () => lifeContainers.some((cc) => cc.ci === player.cur);
  // THE TERRAFORMER IS SOLID TOO (operator, 2026-09-02: "the tank can drive under"). Its pad radius is measured off the model, so a
  // re-export follows. Enemies are NOT kept out (they have to reach the heart): the cells stay open and only the TANK is turned away
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
    if (ci === -1 || dungeon.tags[ci] === BLOCKED || containerBlocked(ci)) return true;
    if (dist3(cand, graph.centers[dungeon.heart]) < pedestalRadius() + cellSide * 0.3 || breachBlocked(cand)) return true;   // the pad, and any open sinkhole: no-go
    // THE HULL'S OWN FOOTPRINT against the rock faces (operator, 2026-09-13): its centre, nose and tail; a move may not take it deeper
    // into a face than it already is (src/domain/hull-contact.js)
    const crowdedBy = berthed()
      ? (nb) => dungeon.tags[nb] === BLOCKED
      : (nb) => dungeon.tags[nb] === BLOCKED || containerBlocked(nb);
    const half = Math.min(unitScale * 0.73, cellSide * 0.6), squeeze = stuck.t >= HULL_STUCK.after, side = cross3(norm3(player.pos), player.smoothDir);
    const hull = (p) => [{ p, clearance: Math.min(unitScale * 0.3, cellSide * 0.3) }, ...(squeeze ? [] : [[1, 0], [-1, 0], ...(TANK_WALL.width ? [[0, 1], [0, -1]] : [])]).map(([k, w]) => ({ p: norm3(add3(add3(p, scale3(player.smoothDir, k * half)), scale3(side, w * half * TANK_WALL.width))), clearance: cellSide * 0.04 }))];   // nose, tail and both flanks; wedged: they let go and it threads on its centre (2026-10-03)
    const board = { cellOf: cellIndex, blocked: (nb) => nb !== ci && crowdedBy(nb), centers: graph.centers, adj: graph.adj };
    if (stuck.t < HULL_STUCK.after + HULL_STUCK.ramp && deepensContact(hullDepth(hull(player.pos), board), hullDepth(hull(cand), board), cellSide * 0.002)) return true;   // fully wedged on open ground, no snag holds it (2026-10-03)
    if ((storyBase?.solidAt(cand) && !storyBase.solidAt(player.pos)) || (storyBase?.gateShut(cand) && !storyBase.gateShut(player.pos))) return true;   // and a door not yet open   // the buildings are solid (src/fx/story-base.js solidAt)
    return unitBlocker(cand);
  }

  // nearest blocked neighbour's centre for wall sliding; a point inside rock names that rock
  function nearestWall(cand) {
    const ci = cellIndex(cand);
    if (ci === -1) return null;
    if (dungeon.tags[ci] === BLOCKED) return graph.centers[ci];
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

  // WALL CUSHION, corridor-safe: adaptive margins (narrow cells skip diagonals), pushes net-summed and applied once (opposing walls
  // centre instead of fighting), capped per frame well below drive speed: corrects clipping over a few frames, never pins
  const CRATER_PAD = 0.6;   // cells beyond a sinkhole's crater the hull keeps off: the ground there is open, not drivable
  const breachBlocked = (p, pad = CRATER_PAD) => gameBreaches.craters().some((k) => dist3(p, k.p) < (k.r + pad) * cellSide);
  function wallCushion(pos) {
    const ci = cellIndex(pos);
    if (ci === -1) return pos;
    // the pedestal and every open crater first: a hard radial push off the pad or the sinkhole's rim, then the wall cushion
    for (const { c, rim } of [{ c: graph.centers[dungeon.heart], rim: pedestalRadius() + cellSide * 0.35 }, ...gameBreaches.craters().map((k) => ({ c: k.p, rim: (k.r + CRATER_PAD) * cellSide }))]) {
      const d = dist3(pos, c); if (d >= rim) continue;
      const away = sub3(pos, c), n = norm3(pos), tg = sub3(away, scale3(n, dot3(away, n))), l = len3(tg);
      if (l > 1e-9) pos = norm3(add3(pos, scale3(tg, (rim - d) / l)));
    }
    const narrow = openCount(ci) <= 3, margin = cellSide * (narrow ? 0.6 : 0.95);
    let px = 0, py = 0, pz = 0;
    const seen = new Set([ci]);
    const consider = (w, at = pos, m = margin, k = 1) => {
      const c = graph.centers[w], d = dist3(at, c); if (d >= m) return;
      const away = sub3(at, c), n = norm3(at), tg = sub3(away, scale3(n, dot3(away, n))), l = len3(tg); if (l < 1e-9) return;
      const f = k * (m - d) / m; px += (tg[0] / l) * f; py += (tg[1] / l) * f; pz += (tg[2] / l) * f;
    };
    for (const nb of graph.adj[ci]) {
      if (seen.has(nb)) continue; seen.add(nb);
      if (dungeon.tags[nb] === BLOCKED) { consider(nb); continue; }
      if (!narrow) for (const nb2 of graph.adj[nb]) { if (seen.has(nb2)) continue; seen.add(nb2); if (dungeon.tags[nb2] === BLOCKED) consider(nb2); }
    }
    // THE HULL HAS A NOSE AND A TAIL (operator, 2026-09-12: the tank clips into walls). Each end is cushioned by the rock it is in or beside,
    // a band of the cell's edge plus the hull's half width, a nudge not a pin: a corner pushes the hull out, a straight lane leaves it
    const half = unitScale * 0.73, band = cellSide * 0.72;
    for (const end of [norm3(add3(pos, scale3(player.smoothDir, half))), norm3(sub3(pos, scale3(player.smoothDir, half)))]) {
      const ce = cellIndex(end); if (ce === -1) continue;
      if (dungeon.tags[ce] === BLOCKED) consider(ce, end, band, 0.6);
      for (const nb of graph.adj[ce]) if (dungeon.tags[nb] === BLOCKED) consider(nb, end, band, 0.6);
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
  let cruise = false, stuck = makeStuck(), kick = makeKick();   // stuck: driving that goes nowhere (src/domain/hull-stuck.js)
  // THROTTLE — one lever replacing the ▲/▼ pair. It HOLDS where you put it, so setting it IS cruise; there is no separate mode to
  // engage. Reverse is the same lever continued below zero and capped: backing up cannot match going forward. The zero detent
  // sits proportionally, so the shorter reverse travel shows you that before you try it.
  const THROTTLE_REV = 0.4;                       // reverse ceiling vs forward
  const THROTTLE_ZERO = 1 / (1 + THROTTLE_REV);   // where 0 sits down the track
  let throttle = 0; const driveRamp = makeDriveRamp();   // the run-up a hull builds held forward (content/tank.js TANK_DRIVE)
  let lastFastTap = -9; // seconds
  function noteFastTap() {
    const s = performance.now() / 1000;
    if (s - lastFastTap < 0.35) cruise = !cruise;
    lastFastTap = s;
  }
  let steerHold = 99; // seconds since the user last steered
  const steeringActive = () => steerHold < 1.2;
  let autoMode = false; // AUTO is opt-in (the directive chip); MANUAL is sticky


  // TAP-TO-GO (ruling 1, 2026-09-02). On the phone the tank is COMMANDED, not driven: a tap on the ground is a destination, and
  // the graph walker that already serves the auto directives walks it there. A BFS field from the tapped cell is the goal,
  // exactly as distToHeart is the goal for 'home'; arriving hands control back to manual, which stops the tank.
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

  // THE CONTROLS-DEAD PROBE: WASD sometimes dead after a game ends (operator, never reproduced); the watchdog reports WHICH gate is
  // latched, from real play. RUN GENERATION: deferred work from one run never lands on the next (bumped by regenerate).
  const runContext = createRunContext();
  const runTimers = createRunTimers(runContext);
  let deployCount = 0;
  // counted separately: a death-hold deploy is the one that must never
  // cross a run, and a fresh run's own deploy would mask it in a total
  let tankLostDeploys = 0;
  const ctlState = (tag) => `CTL[${tag}] gen=${runContext.generation} deploys=${deployCount}`
    + ` won=${player.won} down=${playerDown} next=${player.next}`
    + ` free=${player.freeMode} cur=${player.cur}`
    + ` auto=${autoMode} cruise=${cruise} deploying=${deployActive()}`
    + ` throttle=${throttle.toFixed(2)} keys=${Object.entries(keys)
      .filter(([, v]) => v).map(([k2]) => k2).join('+') || '-'}`
    + ` paused=${paused}`
    + ` shot=${shotId() || '-'}`
    + ` buildMode=${buildMode} active=${active}`;
  // THE WATCHDOG. It watches for the symptom as the player describes it — asking the tank to move and the tank not moving —
  // rather than for any one cause, and prints the whole gate row when it happens. Always on: the bug is rare and lives on the
  // operator's phone, so a probe that only runs under a flag is a probe that will never see it. One line per episode (re-armed
  // only after the tank moves again), so a genuinely wedged hull cannot flood the console.
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
    if (ev.key === '`') setPerfOverlay(!perfOverlay.on());
    if (ev.key === 'Escape') document.body.classList.remove('vars-open');
  }, true);
  let ctlSwallowBarked = false;
  // CAN A PERSON SEE THE TANK (not just: is it in the frustum). 'behind' / 'off-canvas' are pose faults the watchdog re-seats; 'chrome'
  // (under iOS's URL bar or toolbar), 'covered' (a HUD element on it) and 'tiny' need the framing to change. Headless can only see
  // 'ok' or a pose fault: it models neither the visual viewport nor env(safe-area-inset)
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
    if (viewEdge({ x, y }, window.visualViewport ?? { width: innerWidth, height: innerHeight, offsetLeft: 0, offsetTop: 0 }) !== 'inside') return { ...out, why: 'chrome' };
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

  // THE VIEW WATCHDOG AND THE DIAGNOSTICS OVERLAY (src/platform/diag-overlay.js): viewWatch and tick from the frame, html for captions
  const diagOverlay = createDiagOverlay(root, {
    mobileShell,
    player,
    params,
    renderer,
    camera,
    scene,
    keys,
    tankSight,
    sightLine,
    setView,
    snapCamera,
    deployProgress,
    endShot: () => endShot(),
    shotId: () => shotId(),
    playerMesh: () => playerMesh,
    playerDown: () => playerDown,
    buildMode: () => buildMode,
    shots: () => shots,
    deploy: () => deploy,
    paused: () => paused,
    cellSide: () => cellSide,
    unitScale: () => unitScale,
    camBiasNdc: () => camBiasNdc,
    toastEl: () => toastEl,
    msgEl: () => msgEl,
    throttle: () => throttle,
    cruise: () => cruise,
    autoMode: () => autoMode,
    gotoCi: () => gotoCi,
    stick: () => stick,
    t: () => t,
  });

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

  const camGoal = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }, seatGlide = createSeatGlide({ hold: () => paused, wait: () => shotId() === 'takeControl' });
  // two more of the same, for blending between two framings (the cold open)
  // two spare pose slots, for blending one framing into another
  const camA = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const camB = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const tmpObj = new THREE.Object3D();
  // lookAt convention trap: a plain Object3D faces +Z at the target, but a
  // camera renders down -Z (three.js special-cases isCamera in lookAt).
  // The camera goal quaternion MUST come from a camera instance, or the view
  // ends up rotated 180° — staring backward along the heading.
  const tmpCam = new THREE.PerspectiveCamera(); const poseCamera = ({ eye, look, up }, out, bias = false) => { out.pos.set(eye[0], eye[1], eye[2]); tmpCam.position.copy(out.pos); tmpCam.up.set(up[0], up[1], up[2]); tmpCam.lookAt(look[0], look[1], look[2]); if (bias) applyViewportBias(tmpCam); out.quat.copy(tmpCam.quaternion); };   /* a shot's pose (eye, look, up) as a camera goal; bias: the phone's visible band (applyViewportBias) */

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
    // THE SURFACE IS PATCHABLE (owner, 2026-09-15): every cell, lattice edge and corner owns fixed slots in the four
    // buffers (src/fx/board-surface.js), so a breach rewrites what it touched (rebuildAfterBreach) instead of this build
    for (const [geo, obj] of [[floorGeo, floorMesh], [wallGeo, wallMesh], [edgeGeo, edgeMesh], [topGeo, topMesh]]) {
      if (obj) {scene.remove(obj);obj.material.dispose();}
      if (geo) geo.dispose();
    }
    breachQueue.length = 0;
    boardSurface = createBoardSurface({
      vertices, quads, graph, dungeon, H, mode, seed: params.seed, jitter: look().jitter,
      wallTop: look().walls.top, wallSide: look().walls.side, zones: look().zones, zoneColors, edgeColor: constEdge, floorColorOf,
    });
    floorOffsets = boardSurface.floorOffsets;
    const faceMat = () => new THREE.MeshLambertMaterial({
      vertexColors: true,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    floorGeo = boardSurface.floor;
    floorMesh = new THREE.Mesh(floorGeo, faceMat());
    gameBreaches.patch(floorMesh.material);scene.add(floorMesh);

    wallGeo = boardSurface.wall;
    wallMesh = new THREE.Mesh(wallGeo, faceMat());
    scene.add(wallMesh);

    edgeGeo = boardSurface.edge;
    edgeMesh = new THREE.LineSegments(edgeGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: E.opacity,
        blending: E.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: !E.additive,
      }));
    edgeMesh.visible = E.show;
    gameBreaches.patch(edgeMesh.material);scene.add(edgeMesh);

    topGeo = boardSurface.top;
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
    attr.clearUpdateRanges();   // a breach patch may have queued ranges this frame: upload the whole attribute, this paint included
    attr.needsUpdate = true;
  }

  // --- heart & player objects ---------------------------------------------


  function buildActors() {
    for (const o of [heartSprite, playerMesh, markerMesh]) if (o) { o.userData.dispose?.(); scene.remove(o); }
    for (const c of lifeContainers) scene.remove(c.obj);
    if (!storyMode) lifeContainers = [];   // the story's bays outlive an actor rebuild (a tank model landing mid roll-out); the base's ready hands in fresh ones

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
    {
      // THE LIFE CONTAINERS v2 (operator's staging): TWO containers, side by side on the EMPTIEST flank of the heart's chamber —
      // adjacent open cells at distToHeart 2-3, the pair chosen for the fewest open neighbours (a wall-side berth, clear of the
      // lanes). Two hull bays per container; the run's spare tanks rack there, and every spawn — first scene included — drives
      // OUT of a container.
      const cgen = ++containerGen;
      Promise.all([storyMode || preloadContainer(), preloadMork()]).then(() => {   // the story never shows the old boxes, so it never fetches them
        if (cgen !== containerGen || !dungeon) return; // board changed since
        // the camp was chosen with the board; this only casts the boxes
        if (berths.length !== 3 || storyMode) return;
        for (let bi = 0; bi < berths.length; bi++) {
          const ci = berths[bi].ci;
          // THE DOORS FACE THE LANE THE HULL LEAVES BY. They used to face the Heart, which is only ever approximately the way
          // out: the exit is a graph neighbour and can sit 40-odd degrees off that bearing, so the hull drove out on a diagonal
          // and clipped its own door frame (operator, twice). Aim the box at the actual exit and the two are the same line by
          // construction. Most-heartward escape wins, so the row still faces home. the exit is CARRIED, not re-derived here:
          // computeBerths picked it, the doors point at it and DEPLOY drives at it, and those three must never disagree
          const exitCi = berths[bi].exit;
          const ec = graph.centers[exitCi];
          const g = dressMetal(makeContainerFixture(bi + 1)); // painted 1-2-3, left to right
          if (!g) break;
          const c = graph.centers[ci];
          const nrm2 = graph.normals[ci];
          // SHALLOW: the full-length box hid its cargo in shadow (operator report). Depth squashed to 0.55 — one hull fits, and
          // you can SEE it from the doors.
          g.scale.set(cellSide * 0.9, cellSide * 0.9, cellSide * 0.9 * 0.55);
          g.position.set(c[0], c[1], c[2]);
          // doors onto the exit lane: the bays still face home, and now the
          // hull's first metre is a straight line through its own doorway
          tmpObj.position.copy(g.position);
          tmpObj.up.set(nrm2[0], nrm2[1], nrm2[2]);
          tmpObj.lookAt(ec[0], ec[1], ec[2]);
          g.quaternion.copy(tmpObj.quaternion);
          const tank = buildCreature(DEFAULT_TANK, look());   // the fielded unit
          tank.scale.setScalar(0.32);
          // counter-stretch: the parent's z-squash would flatten the hull
          tank.scale.z /= 0.55;
          // AT THE DOORS, not in the middle (operator, 2026-08-31: you could not see there was a hull in there). The fitted box
          // runs z ±0.80 with the doors at +z and the hull is ~0.29 long in the same units, so 0.52 puts its nose on the door
          // plane and its whole body in the light.
          tank.position.set(0, 0.12, 0.52);
          g.add(tank);
          scene.add(g);
          // the exit is CARRIED, not re-derived: the doors point at it and
          // the respawn drives at it, and those two must never disagree
          lifeContainers.push({ obj: g, tanks: [tank], ci, exit: exitCi });
        }
        syncLifeContainers();
        // the FIRST SCENE: the opening hull drives out of its bay — if the player has not yet gone anywhere, restage them at the
        // doors escapes=a,b,c is the invariant the operator's can't-get-out report turned into a rule: every berth must show at
        // least 1, or auto-nav has nowhere to steer and the hull sits in the box forever
        console.log(`CONTAINERS placed=${lifeContainers.length}`
          + ` cells=${berths.map((b2) => b2.ci).join(',')}`
          + ` spares=${Math.max(0, playerHP - 1)}`
          + ` exits=${berths.map((b2) => b2.exit).join(',')}`);
      });
    }


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
      // the PLAY size from the first frame, never the bare base: the base alone is ~27x the tank, and placeActors — which used to
      // be the only place the unit scale was multiplied in — runs on events, so anything that skipped or threw between the two
      // left an enormous tank on the board (operator, build f2a9aeca, desktop, mid-tutorial: "the tank got enormous … and now it
      // seems fixed")
      playerMesh.scale.setScalar(unitScale * (playerMesh.userData.baseScale ?? 1));
    }
    scene.add(playerMesh);

    // minimap self-marker: a fat arrowhead nosing along the heading — the map is heading-up, so YOU are the big pulsing arrow
    // pointing up. Sized against the SPHERE, not the cell: the map always frames the whole ball, so cell-relative sizes vanish on
    // dense boards. Geometry pre-rotated so the cone's nose is +Z (lookAt convention). The radar draws YOU itself now. The arrow
    // survives because placeActors drives its transform every frame — parked on the map layer, which nothing renders, so it stays
    // invisible instead of suddenly appearing in the WORLD when the map renderer went away.
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
    // APPLY IT NOW, not on the next frame. Both looks only read sizeScale inside tick(), so a freshly built Stalheart stands at
    // its raw model size until the frame loop reaches it — which for the Terraformer is 2 world units, about THIRTY cells across.
    // One tick settles it before anything is drawn.
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
  const shots = createCameraShots({ target: root, snap: () => { closeShop(); snapCamera(); }, pass: (_, ev) => !!ev.target.closest?.('#skip-tutorial') }), { start: startShot, end: endShot, step: stepShot, active: shotActive, id: shotId } = shots;   /* src/fx/camera-shot.js */

  const REVEAL_LEN = 3.2;
  let revealDir = null;
  let revealCells = [];

  // AUTO DIRECTIVES: high-level orders for the wanderer
  const DIRECTIVES = ['wander', 'avoid', 'ram', 'conserve', 'home', 'portal'];
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
  function centerBuildOnHeart(n = null) {   // n: a unit normal to centre on instead of the pole (the gunship frames the approach)
    followSuspend = false;
    const { hn, t1 } = n ? { hn: n, t1: norm3(cross3(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])) } : poleFrame();
    bqZ.set(hn[0], hn[1], hn[2]).normalize();
    bqY.set(t1[0], t1[1], t1[2]);
    bqX.crossVectors(bqY, bqZ).normalize();
    bqY.crossVectors(bqZ, bqX).normalize();
    bqM.makeBasis(bqX, bqY, bqZ);
    buildQ.setFromRotationMatrix(bqM);
  }
  // Build mode drives now, so the free camera has a duty it did not have before: if the tank leaves the frame, swing to bring it
  // back. Top-down is a real control mode only if the thing you are controlling cannot escape the screen. The follow NEVER fights
  // a drag — a finger on the board owns the view outright — and it eases harder the further out the tank is, so a nudge at the
  // edge is gentle and an off-screen tank is not.
  const followQ = new THREE.Quaternion();
  const followV = new THREE.Vector3();
  // A deliberate pan SUSPENDS the follow — on a phone you explore in
  // flicks, and yielding only while a finger was down meant every lift
  // snapped the view straight back to the tank (operator: 'impossible to
  // explore'). Driving again — or an explicit recenter — re-arms it,
  // which keeps top-down as a real control mode exactly when it is one.
  let followSuspend = false;
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
  function setView(v) {
    // THE SHELL HAS TWO VIEWS (ruling 3): DRIVE is third person, BUILD is orbit. First person, the drone and the bastion cam are desktop
    // only: on a phone one tap on Isao rode the drone unawares ("the tank is below the frame ... the POV looks too high")
    if (mobileShell && (v === 'pov' || v === 'drone' || v === 'bastion') && !pilotMode) v = 'third';
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

  // HOLD is gone (operator, 2026-08-30: the wave telegraph warns enough); kept so every gate on `frozen` reads unchanged
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
    if (pilot?.state.tower && shotId() !== 'takeControl' && pilot.pose(pilot.state.tower, camGoal)) return;
    if (laserStation.pose(camGoal)) return;   // SOL-82's seat: the ground view behind the beam's contact
    // DEPLOY eases the doorway framing into the gameplay framing, so at u=1 handing over the controls changes nothing on screen.
    if (deploy && !camRaw) {
      const w = deployEase();
      deployFramePoseFor(deploy.n, camA);
      gameplayCameraPose(camB);
      camGoal.pos.lerpVectors(camA.pos, camB.pos, w);
      camGoal.quat.copy(camA.quat).slerp(camB.quat, w);
      return;
    }
    if (!camRaw && shots.pose(camGoal)) return;
    // THE RAM BEAT'S CAMERA, and only while the montage's third beat is up (gameHooks.showcase.ram): it sits BELOW the seats and
    // the shots above it — a seat's pose and a cinematic still outrank it — and above the gameplay views, whose third-person offset
    // looks a cell and a half ahead from high behind and frames the hull off the bottom edge
    if (showcaseRamCam && player.pos) { poseCamera(ramShotPose({ pos: player.pos, dir: player.smoothDir, cellSide, wallHeight: params.wallHeight, unitScale }), camGoal, true); return; }
    // THE VIEWS' POSES (src/domain/camera-goal.js): the strike's fall, riding Isao, the bastion, the tank's third person and POV
    if (strike.falling > 0) { poseCamera(strikeFallPose(graph.centers[strike.fallCi], graph.normals[strike.fallCi], fallProgress(strike), params.wallHeight, cellSide, performance.now() * 0.001), camGoal); return; }
    if (params.view === 'drone' && isao) { poseCamera(droneRidePose({ bp: isao.obj.position.toArray(), up: isao.dir, heading: isaoWorker.heading(), order: isao.order, centers: graph.centers, loiter: isao.loiter, cellSide, wallHeight: params.wallHeight }), camGoal); return; }
    if (params.view === 'bastion' && !buildMode) { poseCamera(bastionPose({ centers: graph.centers, normals: graph.normals, anchorCi: (watchTower && towers.includes(watchTower)) ? watchTower.ci : dungeon.heart, heart: dungeon.heart, spawnCi: dungeon.spawn, portals: spawnPoints, wallHeight: params.wallHeight, cellSide }), camGoal); return; }
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
    const dip = cellSide * 0.95 * bumpFactor() * bumpFactor();
    const kick = cellSide * 0.08 * params.recoil * recoilFactor() * recoilFactor();
    if (mobileShell && params.view === 'pov') params.view = 'third';   // the shell has no first person, whoever wrote it
    poseCamera(tankViewPose({ c: player.pos, h: player.smoothDir, third: params.view === 'third', mobile: mobileShell, dip, kick, wallHeight: params.wallHeight, cellSide, unitScale }), camGoal, true);
  }

  // THE CANVAS IS NOT WHAT THE PLAYER SEES: on a phone the canvas runs behind the browser's chrome, so a tank framed a third up it can
  // land below the fold (the watchdog's `chrome` verdict). The camera is pitched by the angle from the canvas centre to the visible band's;
  // on a desktop and headless visualViewport is the whole canvas and this is exactly zero
  let camBiasNdc = 0;
  function viewportBias() {
    const vv = window.visualViewport;
    const cv = renderer.domElement;
    if (!vv || !cv.clientHeight) return 0;
    const half = cv.clientHeight / 2;
    // + means the visible centre is ABOVE the canvas centre, i.e. the chrome
    // is eating the bottom and the tank must ride higher
    const b = (half - (vv.offsetTop + vv.height / 2)) / half;
    return Math.max(-0.6, Math.min(0.6, b));   // never more than a screen's worth
  }
  function applyViewportBias(cam) {
    camBiasNdc = mobileShell ? viewportBias() : 0;
    if (Math.abs(camBiasNdc) < 0.005) return;
    // NDC to angle, through the camera's own vertical half-angle
    const ang = Math.atan(camBiasNdc * Math.tan((cam.fov || camera.fov) * Math.PI / 360));
    cam.rotateX(-ang);
  }

  function snapCamera() {
    updateCameraGoal();
    camera.position.copy(camGoal.pos);
    camera.quaternion.copy(camGoal.quat); camera.updateMatrixWorld();   // a snap holds at once
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

  const steerEase = makeSteerEase();   // the eased yaw rate; the top rate and its ramp are src/content/tank.js TANK_STEER
  // THE HULL'S DRIVE (src/fx/hull-drive.js): movement over the cell graph, the wanderer's exits, the per-frame steer and glide
  const hullDrive = createHullDrive({
    MOVES,
    breachBlocked,
    bumpFactor,
    checkAbsorb,
    containerBlocked,
    driveRamp,
    enemies,
    floorColorOf,
    freeBlocked,
    keys,
    manualActive,
    nearestWall,
    orbMeshes,
    paintCell,
    params,
    pedestalBlocked,
    player,
    runContext,
    spawnOneOrb,
    steerEase,
    steeringActive,
    updateHud,
    wallCushion,
    cellIndex: () => cellIndex,
    towerCells: () => towerCells,
    cellSide: () => cellSide,
    cruise: () => cruise,
    dungeon: () => dungeon,
    gotoField: () => gotoField,
    graph: () => graph,
    kick: () => kick,
    playerDown: () => playerDown,
    portalDist: () => portalDist,
    speedBonus: () => speedBonus,
    storyBase: () => storyBase,
    stuck: () => stuck,
    throttle: () => throttle,
    whim: () => whim,
    setAutoMode: (v) => (autoMode = v),
    respawnClock: () => respawnClock,
    setRespawnClock: (v) => (respawnClock = v),
    steerHold: () => steerHold,
    setSteerHold: (v) => (steerHold = v),
  });
  const { tangentDirTo } = hullDrive;
  function openNeighbors(...a) { return hullDrive.openNeighbors(...a); }
  function arriveAt(...a) { return hullDrive.arriveAt(...a); }
  function advanceMotion(...a) { return hullDrive.advanceMotion(...a); }

  function onKeyEvent(ev, down) {
    if (!active || pilotMode) return;
    // a clicked button (lil-gui title, d-pad, modal regen) keeps FOCUS, and the browser "clicks" the focused button again on
    // Space — which is the fire key. That's how the panel kept "opening by itself" mid-battle. Drop button focus before handling
    // any game key. Inputs keep focus (typing a seed must not drive the tank's keys into blur).
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
        const unlocked = new Set((automated() ? unlockedTowers(story.expeditions, STORY_EXPEDITIONS.base) : unlockedTowerKeys(wave)));
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
    // T FOR TATE (盾), not S: S is REVERSE in CTL_DRIVE_KEYS (a map, so a grep for 's' never showed it)
    if (down && k === 't') { deployShieldNow(); ev.preventDefault(); return; }
    if (down && k === 'h') pulseHint();
    if (down && k === 'v') toggleView();
    // views land on number keys and on the letters that say them: 1/M/O all read as "map" and go to orbit, 2 is first person, 3
    // third person (T is the SHIELD now, and V still cycles). The radar's heart/player toggle lives on the MAP button alone.
    if (down && (k === '1' || k === 'm' || k === 'o')) setView('orbit');
    if (down && k === '2') setView('pov');
    // THIRD PERSON LOSES ITS LETTER to the shield. It keeps `3`, and `v`
    // still cycles views, so no way in is actually gone — where the shield had
    // no key at all that did not already mean something else.
    if (down && k === '3') setView('third');
    // C for Cheat (moved off M, which is a VIEW now)
    const cheat = down && (k === 'c' || k === 'n') && (flags.acceptance === '1' || devModeOn({ buildToken: document.querySelector('meta[name="cb"]')?.content, search: location.search, stored: localStorage.getItem('ssg.dev-face') }).on);   /* cheats for DEV and the acceptance runs, not for players */
    if (cheat && k === 'c') {
      strike.ready = Math.min(9, strike.ready + 1);
      showToast('<div class="wave-num">CHEAT · MISSILE LOADED</div>'
        + `<div class="wave-role">ready ${strike.ready}</div>`, 1200);
    }
    if (cheat && k === 'n') { let n = 0; for (const sp of spawnPoints) if (sp.alive && sp.obj?.userData.breach) { executeStrike(sp.ci, t); n++; } sectorRun?.test.forgo(); showToast(`<div class="wave-num">CHEAT · HOLES NUKED · ${n}</div>`, 1200); }   /* N FOR NUKE (owner, 2026-10-07): holes filled, the rest forgone */
    // Q/E nudge the throttle lever from the keyboard — up for speed, down
    // through zero into reverse. Key auto-repeat does the holding.
    if (down && (k === 'q' || k === 'e')) {
      // FLYING HIM: the same pair is altitude, which is the axis a ground
      // vehicle never had and a drone obviously should
      if (params.view === 'drone') {
        isaoWorker.setAlt(Math.max(1.2, Math.min(9, isaoWorker.alt() + (k === 'q' ? 0.35 : -0.35))));
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
  // EVERY held input goes, not just the five drive keys: taking a screenshot moves focus off the page, the keyup never lands, and
  // the tank went on firing with the not-ready cue behind it (owner, 2026-09-16). Which events count is src/core/held-input.js's
  // ruling
  const releaseInputs = () => { releaseHeld(keys, Object.keys(keys)); pilot?.release?.(); };
  for (const type of RELEASE_EVENTS) (type === 'mouseleave' ? renderer.domElement : type === 'blur' ? window : document).addEventListener(type, () => { if (releasesHeld(type, { hidden: document.visibilityState === 'hidden', locked: !!document.pointerLockElement, wasLocked: true })) releaseInputs(); });
  // 7 8 9 0 TAKE THE SEATS (owner, 2026-09-16): each key clicks the views strip's own button, so a seat that is not available yet
  // refuses exactly as the button does, and the strip stays the one place a seat is chosen. Capture phase, registered before any
  // seat installs its own handler, so it answers from the tank and from inside a seat alike
  addEventListener('keydown', (ev) => {
    if (ev.repeat || /INPUT|SELECT|TEXTAREA/.test(ev.target?.tagName ?? '') || shopCi !== -1) return;
    const seat = { 7: '[data-view="tank"]', 8: '[data-mount="gunship"]', 9: '[data-view="laser"]', 0: '[data-view="map"]' }[ev.key];
    if (!seat) return;
    document.querySelector(`#story-views ${seat}`)?.click();
    ev.preventDefault();
  }, true);

  // T1 tank first person · T3 tank third person · O1 orbital. Bastion left the cycle (tower-watching was a spectator mode nobody
  // drove from), and nothing auto-centres any more — the two CENTRE buttons do it on demand. V toggles the two views that have
  // buttons. POV is parked (operator: it earns its screen space on nobody's phone) but still selectable from the GUI, and the
  // DRONE is not on the cycle at all — you get it by reaching for Isao, which is the point of it.
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

  // build-camera input: drag = azimuth orbit, wheel = zoom, TAP = select a cell (shop/upgrade). A tap is a press that never
  // traveled; anything that moves >8 px is an orbit. Action-mode pointers stay untouched. build-mode input: single finger orbits
  // the azimuth, TWO fingers pinch to zoom. Track pointers by id so a pinch never fires a tower-placing tap.
  const buildPointers = new Map(); // pointerId -> {x, y}
  let pinchPrev = null;            // last two-finger pixel distance
  let pinched = false;             // ≥2 fingers touched this gesture → no tap
  let tapStart = null;
  // A tap is a press that never travelled. 8px is a trackpad's idea of "never"; a finger on glass jitters more than that
  // (PLAYTEST-TODO §1: "a tap that moves 6px is still a tap to a human"). The shell's slop is finger-sized; desktop keeps its 8.
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
  // A REFUSED PLACEMENT SAYS WHY, on the shell (PLAYTEST-TODO §1). The desktop's silence rule stands there — a radial of
  // greyed-out towers is worse than nothing — but a caption is not a radial, and on glass a tap that does nothing is
  // indistinguishable from a tap that missed. Same reason twice inside a second and a half is said once.
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
      // TAP ISAO TO RIDE HIM. The drone camera is not on the view cycle, because reaching for the machine you want to look
      // through is a better gesture than tapping past two other cameras to find it. It asks first: a mis-tap that hijacks your
      // camera mid-wave is worse than no shortcut at all.
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
      // TAP-TO-GO, on the shell, while driving: open ground is a destination.
      if (mobileShell && !buildMode && wasTap && ci !== -1) {
        if (gotoCell(ci)) return;
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
    // Aim is two-fold: the paint chose the area, and ONE burst mid-fall can vector the munition onto what the target drifted
    // into. A tap on the GROUND spends the burst; a tap on the sky — or any tap after it is spent — skips to impact.
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
    // the fourth pad. Same tap-not-hold rule: a held shield pad would burn
    // the rack into a bubble that was already up, which the module refuses
    // anyway — but refusing four times a second is not feedback.
    const sb = root.querySelector('#td-pad-shield');
    if (sb) sb.addEventListener('click', () => deployShieldNow());
  }

  // --- LAUNCH CONTROL: DeepWatch's console, driving OUR state machine ------- The safety toggle arms, the readout narrates, the
  // chunky button goes grey -> orange (needs a target) -> red (authorised). Same ritual, real instrument. armBtn keeps its name:
  // it gates syncArmUi in the loop.
  const armBtn = root.querySelector('#td-launch');
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

  function syncArmUi() {
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

  // The blast itself. Portals inside the radius are not damaged — they are DESTROYED, which is the reason the weapon exists.
  // Enemies take squared falloff. The world does the announcing: rings, a kick of the same shock cloud the wave telegraph uses,
  // and the loudest sample in the manifest.
  function executeStrike(ci, tNow, use = 'strike.orbital', blastCells = null) {   /* blastCells: the round's own killing radius when it is not the orbital strike's — the MK-9 mini nuke is wider than the strike tune */
    const before = {
      portals: spawnPoints.filter((q) => q.alive).length,
      enemies: enemies.filter((e) => e.alive).length,
      towers: towers.length,
      walls: dungeon.tags.filter((tg) => tg === BLOCKED).length,
    };
    const c = graph.centers[ci];
    const radius = cellSide * (blastCells ?? strikeTune.blastCells);
    sfx.play('tank_destroyed', { dist: camDist(c) });
    // Rings tell the TRUTH now: the outermost ring IS the damage radius. The first cut drew them out to 2.2x it, so level-1
    // fodder stood visibly "inside the blast" and walked away — the visuals were writing a cheque the falloff did not honour.
    warnRing(ci, 0xffffff, 1.0, radius);
    warnRing(ci, 0xffb347, 0.7, radius * 0.72);
    warnRing(ci, 0xfff2c0, 0.45, radius * 0.42);
    // the screen takes the hit too — the sector-reveal flash, borrowed
    flashEl.classList.remove('on');
    void flashEl.offsetWidth;
    flashEl.classList.add('on');
    // the lab's explosion for this use; the old dot-burst firework only when it could not load
    const bn = graph.normals[ci];
    const bp = add3(c, scale3(bn, cellSide * 0.35));
    if (!explode(use, c)) for (const [hex, sc, cnt] of [[0xffffff, 1.5, 140], [0xfff2c0, 2.4, 110], [0xffb347, 3.4, 90], [0xff7744, 4.4, 70], [0xff4433, 5.4, 50]]) {
      const burst = makeDotBurst(hex, bn, cnt);
      burst.scale.setScalar(cellSide * sc);
      burst.position.set(bp[0], bp[1], bp[2]);
      scene.add(burst);
      debris.push(burst);
    }
    // Terrain and towers, when the toggles allow. Towers FIRST: a mounted tower anchors its wall (breachWallCell refuses it), so
    // the order is what lets one strike flatten a defended rampart. Walls batch into a single BFS + rebuild — six breaches must
    // not cost six rebuilds. DEEPWATCH is about portals specifically, so it is counted here rather than inferred from the log
    // line below
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
        killPortal(sp, use.startsWith('gunship.') ? 'gunship' : 'strike');
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
      if (dmg > 0) damageEnemy(e, tNow, dmg, false, 'strike', use);
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
  // the coach's callout; flash = big centred, hold = no auto-hide
  let tutTimer = null;
  // THE SHELL'S WORDS (SHELL_WORDS, src/content/controller-copy.js): the tutorial's lessons in the shell's terms
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
    tutEl.innerHTML = html;
    tutEl.classList.remove('hidden');
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
  // THE COACH. The tutorial runs once per browser and teaches the game; a phone that has already seen it (the operator's) boots
  // straight into a wave with nothing on screen saying how to move — tap-to-go is invisible until someone has done it. Three
  // coach marks, shell only, once per browser, each holding until the thing it names has happened:   1. TAP THE GROUND
  // until a destination is accepted   2. the thumbs            until a thumb is pressed (or 12s)   3. BUILD                 when
  // a tower is affordable, until one is ordered Not the tutorial: it never spawns anything and never freezes the game.
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
    if (!mobileShell || coach.done || paused || !graph) return;
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
        const keys = (automated() ? unlockedTowers(story.expeditions, STORY_EXPEDITIONS.base) : unlockedTowerKeys(wave));
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
  // THE STICK (src/stick.js; operator, 2026-09-03: "I cannot find a way to move the tank manually anymore"). Shell, DRIVE mode,
  // left half of the board, not on a control: a finger down puts the ring there, a drag drives — throttle up/down, steer past the
  // band — and a finger that never left the dead zone was a tap, which the tap handlers still get. Release stops the tank
  // (throttle 0, keys off); a stick is held.
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
    if (cl.contains('msg-regen')) { if (storyMode) location.reload(); else regenerate(); } // retry the CURRENT round; the story's is a fresh page, as its sector debrief's NEW RUN is
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
  const unitIcon = (type, tint) => () => buildCreature(type, { walker: tint, walkerHi: 0xffffff });   /* the cards, the triad icon and the tips: src/fx/briefing-cards.js */

  // THE BRIEFING AND ITS GLOSSARIES (src/fx/glossary-modals.js): the cards, the record, the hostiles and the pickups
  const glossary = createGlossaryModals({ msgEl, pause: () => { paused = true; }, spriteShot, heartIcon, unitIcon, mobile: () => mobileShell, round: () => round, heldAchv: () => heldAchv, towerLook: () => params.towerLook, buildTowerLook, starterTower, look, makeDotBurst, makeRewardSolid, HEART_MAX, DEFAULT_TANK });
  const { showBriefing, showRecord, showEnemyGlossary, showFriendGlossary } = glossary;
  // callout pop-ups + the ram combo counter (both pointer-transparent)
  const calloutsEl = root.querySelector('#td-callouts');
  const comboEl = root.querySelector('#td-combo'), ramFloat = createRamReadout(root, { project: (p) => new THREE.Vector3(p[0], p[1], p[2]).project(camera) });
  // WHAT SURVIVES THE ENCOURAGEMENT BEING SWITCHED OFF. The praise is the part the operator wants gone — RECKLESS!, すげ〜!, the
  // heart's lines. The SCORING is not praise: a streak multiplier and a ram count are facts you are playing against, so they
  // stay. With the words stripped, in every language, because "×1.45" is the whole message and "STREAK" was only ever decoration
  // on it.
  const CALLOUT_NUMERIC = { 'co-streak': true, 'co-milestone': true, 'co-cargo': true, 'co-cta': true };   /* co-cargo is information (a part secured, a tower unlocked): it survives the praise switch whole */
  const numbersOnly = (t) => {
    const m = String(t).match(/[×x]\s*[\d.]+/);
    return m ? m[0].replace(/\s+/g, '') : t;
  };

  function showCallout(text, cls) {
    isaoSay(sfx, text); if (!calloutsEl) return;
    if (!params.callouts) {
      if (!CALLOUT_NUMERIC[cls]) return;   // the praise goes quiet
      text = numbersOnly(text);
    }
    while (calloutsEl.children.length >= 3) calloutsEl.firstChild.remove();
    const d = document.createElement('div');
    d.className = `callout ${cls}`;
    d.textContent = text;
    calloutsEl.appendChild(d);
    setTimeout(() => d.remove(), cls === 'co-cargo' || cls === 'co-cta' ? 2600 : 1200);
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

  const sitrepEl = root.querySelector('#td-sitrep');   // the end-of-wave SitRep and its sparkline live in src/fx/campaign-debrief.js
  function hideSitrep() { if (sitrepEl) sitrepEl.classList.add('hidden'); }
  if (sitrepEl) sitrepEl.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation(); // a dismiss tap must not read as a board tap
    hideSitrep();
  });

  // generic transient toast (non-blocking, auto-hides)
  const toastEl = root.querySelector('#td-toast');
  let toastTimer = null;
  function showToast(html, ms = 3000) {
    isaoSay(sfx, html); if (!toastEl) return;
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

  // The instrument panel. Three reading distances, three brightness tiers: vitals bright and big (sub-second combat reads),
  // resources mid (biomass orange as ever, the wave numeral the largest thing on the panel), meta and objectives dim. The
  // who-is-driving line is GONE from the panel — control state lives ON the AUTO button now, where the control is.
  function updateHud() { if (inFrame && hudFrame === frameNo) { hudDirty = true; return; } hudFrame = frameNo; hudDirty = false; paintHud(); }   /* INSIDE A FRAME, ONCE PLUS ONE CATCH-UP (2026-09-25): a strike on a pile rebuilt the panel's HTML once per kill. Outside a frame (a hook, a handler) it paints at once */ function paintHud() {
    if (eco && eco.biomass > run.peakBiomass) { run.peakBiomass = eco.biomass; checkAchievements(); }
    if (lifeContainers.length) syncLifeContainers();
    const spAlive = spawnPoints.filter((s) => s.alive).length;
    // THE SHIELD IS ALWAYS ON THE PANEL and says what it is, then the array's reserve (src/fx/shield-array.js)
    const shieldBar = shieldPanel(shield, shieldTune, t, story?.arrayPad?.standing ? arrayStation : null);
    const alerts = [shieldBar,
      carryingRegen ? '⬤ REGEN CARRIED' : '', story?.expeditions?.carrying ? '⬤ PART CARRIED' : '',
      cannonHeat > 0 ? 'CANNON HOT' : '',
      laserOverheat ? 'LASER COOLING' : ''].filter(Boolean).join(' · ');
    const hearts = `<span class="hp-heart">${'♥'.repeat(Math.max(0, heartHP))}</span>`
      + `<span class="hp-dim">${'·'.repeat(Math.max(0, HEART_MAX - heartHP))}</span>`;
    statsEl.innerHTML =
      `<div class="hud-meta">SCORE <b>${fmt(score.points)}</b> · BEST ${fmt(score.best)}`
      + `${rankBadgeHud ? ' ' + rankBadgeHud : ''}</div>`
      + `<div class="hud-vitals">${hearts} <span class="hud-lbl">HEART</span>`
      + ` <span class="hp-you">♥${playerHP}</span>`
      + (storyMode && !story?.sectorN ? '</div>' : ` <span class="hp-ammo${ammo === 0 ? ' out' : ''}">✦${ammo}</span></div>`)
      + `<div class="hud-res"><span class="hud-biomass">${eco.biomass}kg`
      + `${storyMode && !story?.sectorN ? '' : ` ×${eco.multiplier().toFixed(2)}`}</span>`   /* the story shows no campaign readouts before sector 1 */
      + `<span class="hud-wave">${storyMode ? '' : `WAVE <b>${wave}</b> · R${round}`}</span></div>`
      + (storyMode ? (sectorRun?.hudLine() ?? '') : `<div class="hud-obj">breaches ${spAlive}/${spawnPoints.length}`
      + ` · ${programmeDone() ? 'WAVES SPENT — CLOSE THE GATES'
        : `wave ${sectorWave() + 1}/${params.wavesPerSector} of sector ${round}`}`
      + ` · built ${towers.length}</div>`)
      + isaoLine()
      + assistantLine()
      + (storyMode ? '' : terraLine())
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

  // AUTO GUNNER: in auto mode shells go at the nearest enemy in range (the cannon heat is the rate); 'conserve' and 'ram' spend them only
  // on the unrammable tier, portals when nothing presses; manual leaves the trigger to the player. AUTO SECONDARY (2026-09-01): the lasers
  // cost only heat, so every directive uses them; RAM will not burn a target it is lining up to ram, but still answers the hard tier
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
    if (player.won || story?.debrief?.isOpen() || gunshipBriefing?.isOpen() || syntheticModal?.isOpen() || laserStation.briefingOpen()) return; // the end-of-game, debrief, briefing or study modal owns the screen and its pause (2026-09-25: P in a seat unpaused the debrief underneath)
    paused = !paused;
    if (paused) {
      msgEl.innerHTML = `<div class="msg-head">transmission · paused</div>` +
        `sector frozen<br>ESC or P resumes` + GAMEPLAY_TIPS;
      msgEl.classList.remove('hidden');
    } else {
      msgEl.classList.add('hidden');
    }
    updateHud();
  }

  // wave announcement banner — HokorobiTawaa's "New Threat" card, complete with its spinning live model of the enemy. The sprite
  // renderer is ONE persistent context created up front (never per-announcement — contexts are a scarce browser resource and leak
  // on loss).
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
    if (player.won || !nextEl) { nextEl && nextEl.classList.add('hidden'); return; }
    const n = wave + 1;
    const plan = computeWavePlan(n, round, params.waveSize, threatMult);
    const chips = plan.entries.map((e, i) => {
      const tint = '#' + CREATURE_TINTS[e.type].toString(16).padStart(6, '0');
      const mark = i === 0 ? '◈' : '●';
      const nm = (INTROS.find((iv) => iv.type === e.type)?.label || e.type).toLowerCase();
      return `<span class="nx-chip" style="color:${tint}">${mark} ${nm} ×${e.count}</span>`;
    }).join('');
    if (storyMode) { nextEl.classList.add('hidden'); return; } const frozen = buildFrozen() || shotId() === 'reveal';   // the story world has no wave clock to count down
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
    if(pilot){location.reload();return;}
    // a fresh sky for a fresh board. Bakes only when the seed changed, so a
    // rebuild that keeps the run keeps the sky.
    skySeed = skyQ != null ? (parseInt(skyQ, 10) >>> 0) % 100000 : randomSeed() % 100000;
    if (!lab.on) applySky();
    const t0 = performance.now();
    runTimers.clear();
    runContext.begin();
    record('run.start', { seed: params.seed, mission: flags.mission || 'defense', roster: ROSTER.id, points: params.points });   // anything the old run left in flight is now stale by number
    // a regenerate is a FRESH RUN: sector 1, towers gone, fresh purse. (Round expansion never comes through here — expandRound
    // reveals the same world in place, towers standing.) Clear towers first: stale towerCells would poison openNeighbors during
    // board generation.
    round = 1;
    // A FRESH RUN GETS A FRESH AUDIO GRAPH. Beds are owned by handles, and a regenerate throws the owners away — so anything
    // still looping kept looping, and the next run layered its own on top. Two games in, that is two engine beds and every voice
    // either has ever fired still wired to a bus (operator: "the sound started to lag after the second game").
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
    // THE OPENING GARRISON (sim batch: the heart pays half its total in waves 1-3, before any kit exists). Not pre-built behind the heart
    // (operator, 2026-09-02: nothing the player has is built by nobody): Isao flies out and prints these like any order, still free (the
    // biomass is credited before the orders, so the spend nets to zero and the queue, travel and print clock apply unchanged)
    queueMicrotask(() => {
      if (!storyMode) { eco.addBiomass(starterTower().cost * 2); for (const ci of garrisonSites(2)) orderTower(starterTower().key, ci, { quiet: true }); }   // the story's first print is Isao's Rotor on the wall, nothing before it
      spawnIsao();   // on shift from the first second, order or no order
    });
    resetRunStats();
    bossCued = false;
    dangerWarnedWave = -1;
    heartCalloutCd = 0; streakMark = 0;
    ramCombo = 0; ramComboT = 0; syncCombo();
    breachedCells.clear(); explosions.clear(); sealedBreachCells.clear(); laserStation.reset(); // a NEW world owes nothing to the old one's holes, its fire, its sealed sinkholes or SOL-82's scorch
    const built = buildGameWorld({ world: storyQuery.world, params, stage: storyQuery.stage, landmarks: storyQuery.landmarks, phase: storyQuery.phase, grow: storyQuery.grow, chapter: storyQuery.chapter, scene, sfx, warm: warmShaders });
    // 4 m walls on the story sphere; the story's islands, structures, sockets and beats at the requested stage
    mesh = built.mesh;
    dungeon = built.dungeon;
    if (built.wallHeight) params.wallHeight = built.wallHeight;
    storyBase?.dispose();
    storyBase = built.base;
    foundryFx?.dispose();
    foundryFx = null;
    story?.glue?.dispose();
    story = built.story ?? null;
    sectorRun = story ? makeSectorRun() : null;
    storyMonitor?.dispose();
    storyMonitor = story ? createStoryMonitor(root) : null;
    storyScope?.dispose();
    storyScope = story ? createStoryScope(root) : null;
    // A NEW RUN LEAVES NOTHING BEHIND (2026-09-25): the lights' night, the gunship and a falling MK-9 go with the old world
    // the story planet has a day
    daylight?.restore();
    daylight = story ? createDaylight({ hemi, sun, bg: mainBg, day: story.day.day, tune: story.day, phase: +flags.day || 0, dial: root }) : null;
    gunshipRig.reset();
    graph = dungeon.graph; cellSide = mesh.defaultSide;
    // THE CAMP, BEFORE ANY ACTOR IS PLACED. Berth cells are graph maths, so they are known now rather than whenever the container
    // model happens to land — which is what lets a reset place the tank once instead of standing it beside the Heart and
    // teleporting it later.
    const footprintRadius = (heartLook().footprint || 0) * heartLook().scale * cellSide;
    berths = story?.berths ?? computeBerths(dungeon, graph, { footprintRadius, cellSide });   // the story's tank bay is the camp once it stands
    record('camp.placed', { heartLook: params.heartLook, footprintRadius, cellSide, berths });
    // THE BAYS ARE THE LIFE CONTAINERS: the parked hull in each is the spare, hidden once it has driven out; the sealed bay opens when its turn comes
    adoptBays(storyBase);   // the first scene: the bays land after the opening roll-out, so roll out again where they can be seen
    // LANES (HT): keep the dungeon carve — rooms joined by WIDE corridors are the monster lanes, and the wall mass between them
    // is the HIGH GROUND where towers mount. generateDungeon already supplies heart, spawn, and distToHeart over the open
    // subgraph. TD: remember the FULL world, then seal everything beyond round 1's inner sector — the run reveals it back band by
    // band
    tdFullTags = dungeon.tags.slice();
    tdFullDist = Array.from(dungeon.distToHeart);
    tdMaxD = 0;
    for (let i = 0; i < dungeon.tags.length; i++) {
      if (tdFullTags[i] !== BLOCKED) tdMaxD = Math.max(tdMaxD, tdFullDist[i]);
    }
    // carve the sector map. Raw azimuth wedges fail on a lane world (corridors cross wedge borders and re-seal as unreachable),
    // and one-gate-per-compass-point collapses when few lanes exit the disk. So: ITERATIVE DIRECTIONAL GROWTH. Each sector claims
    // an equal share of the remaining land, grown breadth-first from a frontier seed picked in its compass direction — sector 2
    // one way, sector 3 BEHIND it, sectors 4/5 the perpendicular pair. Seeds sit on the already-open frontier, so every sector is
    // connected by construction; the applySector re-seal stays as a safety net.
    tdSectorId = new Int8Array(dungeon.tags.length).fill(storyMode ? 1 : 6);   // THE STORY IS ONE SECTOR: round 1 sealed all but 2,817 cells, burying the back lanes and rocket-a, rocket-d and wreck-b (2026-09-16)
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
    applySector(!storyMode);   // the story keeps its spawn, the lane end outside the gate (story-world.js); the board re-picks its farthest cell
    cellIndex = makeCellIndex(graph.centers, cellSide * 1.7);
    player.freeMode = false;
    player.virtualStart = null;

    // Round start mirrors the death respawn: beside the HEART, not at dungeon.spawn — the carve's "spawn" often lands in the same
    // far band the gates seed into, which put a fresh player nose-to-nose with a forming portal before they had touched a
    // control.
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

    baseUnitScale = cellSide * (story?.tankUnit ?? 0.5);   // the story hull is sized to its bays
    unitScale = baseUnitScale;
    ammo = 3;
    sfx.reseed(params.seed); // pitch jitter is deterministic per seed
    deathPick = mulberry32((params.seed >>> 0) ^ 0x9e3779b9);
    heartHP = HEART_MAX; integrityHud?.reset();
    playerHP = PLAYER_MAX;
    playerDown = false;
    shield.t = 0; shield.coolUntil = -Infinity; shield.taps.clear();
    shield.rack=Math.min(shieldTune.rackCap,shieldTune.rackStart);shield.stationLeft=shieldTune.stationBudget;shieldDrops=0;shield.rackFill=0;refillArray(arrayStation,SHIELD_ARRAY);arrayStation.drawn=0;
    resetTankRank();
    carryingRegen = false;
    speedBonus = 1;
    for (let i = projectiles.length - 1; i >= 0; i--) killProjectile(i);
    for (let i = laserShots.length - 1; i >= 0; i--) killLaser(i);
    orbRng = mulberry32((params.seed ^ 0x0b0b5) >>> 0);
    respawnClock = 0;
    runContext.resetClock();

    buildGeometry();
    buildActors();
    spawnOrbs();
    spawnEnemies();
    spawnRewards();
    // EVERY RESET ENTERS THE WORLD THE SAME WAY (new game, reload, reset, retry: all through regenerate, the hull in its berth driving
    // out; not in applyLook, a cosmetic never resets). A RESET ENDS WHATEVER SHOT WAS RUNNING: a reveal surviving it would keep its skip
    // listeners and fire its onEnd against cells of a board that no longer exists (runGen's rule for timers, one level up)
    endShot();
    // ...and any brief mid-sentence, plus whatever was queued behind it. A reset that leaves Isao talking over the new run is the
    // same defect class as a camera shot surviving one: state from the old run painted on top of the new board.
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
  // ANOTHER PLANET (operator, 2026-09-02): "New Planet restarts the same planet. it should be another planet. a bigger one,
  // different topology." The final verdict's button called regenerate(), which keeps the seed — the same world, re-rolled. A new
  // planet is a new SEED (topology) and more of it (size): sample points up ~18% and two more rooms per planet cleared, capped
  // where the draw-call budget says stop. The planet count is what the run already persists.
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
    fill.intensity = L.fill[1]; daylight?.rebase();   // the cycle's night is whatever the look just set
    buildGeometry();
    buildActors();
    spawnOrbs(); // orbs bake look colors at spawn
    spawnEnemies();
    spawnRewards();
    placeActors();
  }


  // THE WAVE ARRIVES, IT DOES NOT APPEAR. Every enemy in a wave used to be created in one frame, all of them standing on the two
  // portal cells with the same speed — so four phage on two portals read as TWO contacts, and twenty-six read as two blobs. The
  // towers shot at things nobody could see, because the things were inside each other. (Measured: wave 3, 26 alive,
  // distinctCells=2.)  Two fixes, and both are needed. The queue staggers WHEN they come through, so a wave walks out of a gate
  // instead of materialising; the pace jitter stops a group that picks the same exit from travelling as one perfectly
  // superimposed silhouette forever after.
  const spawnQueue = [];
  let spawnClock = 0;
  const SPAWN_SPREAD = 3.2;   // seconds a whole wave takes to come through
  const SPAWN_GAP_MAX = 0.45, crowdGate = createCrowdGate(); // ...but never slower than this per contact

  // --- enemies (src/fx/enemy-step.js): the board's enemies and gates, the wave's arming and spawning, the release, every frame
  const enemyStep = createEnemyStep({
    root,
    enemies,
    scene,
    disposeObj,
    gameBreaches,
    spawnQueue,
    spawnPoints,
    params,
    waveEl,
    seenTypes,
    strike,
    strikeTune,
    buildPortalObj,
    MAP_LAYER,
    recomputePortalDist,
    sfx,
    debris,
    sealedBreachCells,
    automated,
    programmeDone,
    hideSitrep,
    showBrief,
    WAVE_WARN,
    resetWaveStats,
    shield,
    shieldTune,
    tfMilestone,
    lab,
    showTowerToast,
    updateHud,
    warnRing,
    announceWave,
    SPAWN_SPREAD,
    SPAWN_GAP_MAX,
    crowdGate,
    openNeighbors,
    tmpObj,
    player,
    effectiveStats,
    heartHit,
    killWalker,
    shieldUp,
    BUMP_LEN,
    checkVictory,
    gunshipRig,
    scoreKill,
    RAM_COMBO_GAP,
    ramFloat,
    noteWaveKill,
    syncCombo,
    noteStreak,
    harvestTankKill,
    showCallout,
    playerHit,
    camDist,
    waveTimer: () => waveTimer,
    graph: () => graph,
    cellSide: () => cellSide,
    dungeon: () => dungeon,
    whim: () => whim,
    storyMode: () => storyMode,
    sectorRun: () => sectorRun,
    round: () => round,
    eco: () => eco,
    threatMult: () => threatMult,
    playerDown: () => playerDown,
    towers: () => towers,
    chord: () => chord,
    playerHP: () => playerHP,
    story: () => story,
    ws: () => ws,
    rs: () => rs,
    deathPick: () => deathPick,
    spawnClock: () => spawnClock,
    setSpawnClock: (v) => (spawnClock = v),
    wave: () => wave,
    setWave: (v) => (wave = v),
    setWaveActive: (v) => (waveActive = v),
    setWaveAge: (v) => (waveAge = v),
    setInterClock: (v) => (interClock = v),
    setPortalDist: (v) => (portalDist = v),
    waveIn: () => waveIn,
    setWaveIn: (v) => (waveIn = v),
    setWarnBeat: (v) => (warnBeat = v),
    setWaveCharge: (v) => (waveCharge = v),
    nextEnemyId: () => nextEnemyId,
    setNextEnemyId: (v) => (nextEnemyId = v),
    dangerWarnedWave: () => dangerWarnedWave,
    setDangerWarnedWave: (v) => (dangerWarnedWave = v),
    setBumpLeft: (v) => (bumpLeft = v),
    ramCombo: () => ramCombo,
    setRamCombo: (v) => (ramCombo = v),
    setRamComboT: (v) => (ramComboT = v),
  });
  function spawnEnemies(...a) { return enemyStep.spawnEnemies(...a); }
  function seedPortals(...a) { return enemyStep.seedPortals(...a); }
  function gateTakesShell(...a) { return enemyStep.gateTakesShell(...a); }
  function killPortal(...a) { return enemyStep.killPortal(...a); }
  function armWave(...a) { return enemyStep.armWave(...a); }
  function spawnWave(...a) { return enemyStep.spawnWave(...a); }
  function releaseSpawns(...a) { return enemyStep.releaseSpawns(...a); }
  function updateEnemies(...a) { return enemyStep.updateEnemies(...a); }
  function killCreature(...a) { return enemyStep.killCreature(...a); }

  // damage an enemy: shrink-step so it reads, kill at zero. Shells (dmg 1, react) trigger the borrowed on-hit reactions; laser
  // ticks (dmg 0.4, react=false) don't — a constant graze must not keep barbed/knot permanently accelerated. Returns true on
  // kill.
  // `src` decides the pay. The base bounty is HALVED and a tank kill pays double the new base (i.e. the old full bounty): towers
  // earn passively, so passive income is what got cheaper — getting close is what pays now. Rams keep their premium on top; the
  // orbital strike pays base, because nothing about it is close.
  const KILL_PAY = { tank: 1.0, tower: 0.5, strike: 0.5 };

  // --- field promotion ------------------------------------------------------
  // HUD badge only. The first cut ALSO floated a sprite over the hull —
  // directly in front of the camera in third person, blocking exactly the
  // thing the player steers toward. Operator ruling: same-size badge, up
  // top, next to the score it rides with.
  // the life containers (src/fx/life-bays.js: one hull per container, three in a row): the story's bays adopted, and their repaint
  function adoptBays(sb) { sb?.ready.then(() => { if (sb !== storyBase || !story?.berths) return; lifeContainers = bayContainers(sb.bays(), berths); syncLifeContainers(); if (player.moves <= 3 && throttle === 0 && !cruise) deployStart(berthIndexFor(playerHP)); }); }   /* the story's bays as the life containers, at load or once Isao has printed them */
  function syncLifeContainers() { syncBays(lifeContainers, playerHP); }

  // ISAO's line on the objectives row: what he is doing and how deep the
  // queue is. Silent when there is nothing on the book — a status line that
  // is always lit is a status line nobody reads.
  function isaoLine() {
    if (!orders.length) return '';
    const o = orders[0];
    const what = o.kind === 'upgrade' ? `${o.tower.def.label}+1` : o.kind === 'structure' ? o.step.label : o.kind === 'repair' ? (BASE_REPAIR[o.repair?.kind]?.label ?? 'REPAIRS') : o.kind === 'receive' ? CARGO_LOOK.receive.label : (TOWER_BY_KEY[o.key]?.label ?? '');   /* every order kind names itself here: an unnamed one threw every frame and left the story blank */
    const rest = orders.length > 1 ? ` +${orders.length - 1}` : '';
    // its OWN row, not an appendix to the objectives line: that line already
    // runs to the edge of the box on a phone, and an overflowing status is
    // a status nobody can read
    if (isao && isao.state === 'build') {
      const pct = Math.round(Math.min(1, isao.t / Math.max(0.001, isao.dur)) * 100);
      return `${buildReadout(o, isao.t / Math.max(0.001, isao.dur))}<div class="hud-obj hud-isao">ISAO &#9656; ${o.step?.over ? 'working' : 'printing'} ${what} ${pct}%${rest}</div>`;   /* an `over` beat works a machine that already stands; it prints nothing */
    }
    return `<div class="hud-obj hud-isao">ISAO &#9656; inbound ${what}${rest}</div>`;
  }
  function assistantLine() {
    if (!assistant) return '';
    const o = assistant.order;
    if (!o) return `<div class="hud-obj hud-isao">DRONE 2 &#9656; on shift</div>`;
    const what = o.kind === 'upgrade' ? `${o.tower.def.label}+1` : o.kind === 'structure' ? o.step.label : o.kind === 'repair' ? (BASE_REPAIR[o.repair?.kind]?.label ?? 'REPAIRS') : o.kind === 'receive' ? CARGO_LOOK.receive.label : (TOWER_BY_KEY[o.key]?.label ?? '');   /* every order kind names itself here: an unnamed one threw every frame and left the story blank */
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
  function damageEnemy(e, tNow, dmg = 1, react = true, src = 'tower', via = null) {   // via: the tower key, gunship gun or strike use, for the story's books
    if (story && src === 'tower') dmg *= STORY_SENTRIES.dmgMul;
    const spec = e.spec;
    if (react && spec.slowOnHit) { e.behMult = spec.slowOnHit; e.behUntil = tNow + 1.2; }
    if (react && spec.accelOnHit) { e.behMult = spec.accelOnHit; e.behUntil = tNow + 1.2; }
    e.lastHitT = tNow; // resets the regenerators' out-of-combat clock
    e.hp -= squadDamage(e, dmg, src);
    for (let k = shedSquad(e) + (e.hp <= 0); k > 0; k--) {   // each body pays, a squad's shed members too
      // any weapon's kill pays — but not the same
      gunshipRig.feed(eco.award(Math.max(1, Math.ceil(spec.bounty * (KILL_PAY[src] ?? 0.5)))));
      scoreKill(spec.bounty, { src, alive: enemies.filter((x) => x.alive).length });
      noteWaveKill(e.type, src); sectorRun?.kill(e, src, via);
      noteKillContext(e, src);
      if (src === 'tank') harvestTankKill(spec);
    }
    if (e.hp <= 0) { killCreature(e, true); return true; }
    if (e.members) return false;
    const sv = e.scale0 * (0.7 + 0.3 * Math.max(0, e.hp) / spec.hp);
    e.obj.scale.setScalar(sv);
    e.obj.userData.s0 = sv;
    return false;
  }

  const laserShots = []; // { pos, dir, dist, mesh }
  let laserHeat = 0, laserOverheat = false, plasmaToldAt = -9; const plasmaDry = () => { if (t - plasmaToldAt > 6) { plasmaToldAt = t; showToast(TANK_PLASMA.dry, 1600); } return false; };
  // `plasma` is a view ONTO the rig's plumes (beamdraw.js), kept as a name because
  // the plasma folder's dot size walks it
  let plasma = null;

  // --- THE PLASMA (operator, 2026-09-02) ---------------------------------- "the beam extends in the air, and for game play we
  // should have hug the curvature of the planet, more like plasma flamethrower than pure laser."  The anatomy, the meshes and the
  // per-frame update all live in beamdraw.js now. That move is what lets the beam LAB draw this same weapon instead of two
  // straight ribbons on a flat floor — a tuning surface showing a different weapon than the game is worse than none, and this
  // project has already paid for that once with a preset tuned under tone mapping the game did not have.  PLASMA is a LIVE
  // object: the GUI mutates it and the rig reads it every frame, so the knobs stay knobs.
  const PLASMA = { ...PLASMA_DEFAULTS };
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  // THE TANK'S LASER (src/fx/tank-laser.js): the twin mini-lasers, the plasma beam rig, the heat and lockout, the cannon's fire
  const tankLaser = createTankLaser({
    root,
    scene,
    PLASMA,
    params,
    runContext,
    laserShots,
    keys,
    player,
    plasmaDry,
    sfx,
    tmpV,
    tmpQ,
    enemies,
    damageEnemy,
    closeShop,
    CANNON_COOL,
    recoilLen,
    BUMP_LEN,
    projectiles,
    updateHud,
    tankRank: () => tankRank,
    playerMesh: () => playerMesh,
    cellSide: () => cellSide,
    autoLaserWant: () => autoLaserWant,
    playerDown: () => playerDown,
    story: () => story,
    eco: () => eco,
    cellIndex: () => cellIndex,
    dungeon: () => dungeon,
    paused: () => paused,
    setPlasma: (v) => (plasma = v),
    laserOverheat: () => laserOverheat,
    setLaserOverheat: (v) => (laserOverheat = v),
    laserHeat: () => laserHeat,
    setLaserHeat: (v) => (laserHeat = v),
    ammo: () => ammo,
    setAmmo: (v) => (ammo = v),
    cannonHeat: () => cannonHeat,
    setCannonHeat: (v) => (cannonHeat = v),
    setRecoilLeft: (v) => (recoilLeft = v),
    bumpLeft: () => bumpLeft,
    setBumpLeft: (v) => (bumpLeft = v),
  });
  function applyBeamRank(...a) { return tankLaser.applyBeamRank(...a); }
  function killLaser(...a) { return tankLaser.killLaser(...a); }
  function updateLasers(...a) { return tankLaser.updateLasers(...a); }
  function fire(...a) { return tankLaser.fire(...a); }



  // S — spend a charge. A TAP, not a hold, and the same shape as layMineNow:
  // the refusal comes from the module and is SHOWN, because three of the four
  // things S can do are refuse, and a dead key that says nothing is
  // indistinguishable from a broken one.
  let shieldDrops=0;
  function stepShieldDynamics(dt,now) {
    const relays=[];
    if(!playerDown && player.pos)for(const tw of towers){
      if(tw.def.attack!=='slowfield'||story)continue;   // the story's shield charges only at the solar array (owner, 2026-10-02)
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
    const station=!story && !playerDown && player.pos && graph && dungeon.heart!=null && a6Arc(player.pos,graph.centers[dungeon.heart])<cellSide*.55, pad=story?.arrayPad, auto=automated();
    const array=pad?.standing?{station:arrayStation,tune:SHIELD_ARRAY,metres:!playerDown&&player.pos?arcToMetres(a6Arc(player.pos,pad.pos),cellSide):Infinity,speed:player.pos&&arrayStation.prev&&dt>0?arcToMetres(a6Arc(player.pos,arrayStation.prev),cellSide)/dt:0}:null; if(auto&&!arrayStation.auto)refillArrays(); arrayStation.auto=auto; arrayStation.prev=player.pos?.slice();   /* the solar array's pad; the handover opens the first sector with it full */
    const dropped=stepShieldFrame(shield,dt,now,{relays,station,array},shieldTune), ev=array?arrayStation.event:null; if(ev){if(SHIELD_ARRAY.cues[ev])sfx.play(SHIELD_ARRAY.cues[ev]);if(ev==='start')showBrief('array_charging');if(ev==='dry'){showBrief('array_dry');record('shield.array.dry',{wave,drawn:arrayStation.drawn});}}
    if(dropped){
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
        + `<div class="wave-role">${shieldTune.deploySecs}s &middot; ${shield.rack} charge${shield.rack === 1 ? '' : 's'} left</div>`, 1800); if (!shield.rack) controlsCard?.rackEmpty(() => showToast(`<div class="wave-num">SHIELD UP · RACK EMPTY</div><div class="wave-role">${story?.arrayPad?.standing ? 'park on the solar array to recharge' : 'the next charge comes with the debrief'}</div>`, 3200));   /* said once, the first time the rack runs dry */
    } else if (r === 'up') {
      showToast(`<div class="wave-role">the shield is already up &mdash; a charge cannot top it up</div>`, 1400);
    } else if (r === 'cooling') {
      showToast(`<div class="wave-role">emitter cooling &middot; ${(shield.coolUntil - t).toFixed(1)}s</div>`, 1200);
    } else {
      showToast(`<div class="wave-role">no shield charges &mdash; ${story?.arrayPad?.standing ? (arrayStation.reserve > 0 ? 'park on the solar array to recharge' : 'the solar array is dry until the next sector') : 'buy a case on the debrief'}</div>`, 1400);
    }
    updateHud();
    return r;
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
    if (!breachWallCell(ci)) return; story?.shot.add(ci); explode('tank.shell', graph.centers[ci]); if (automated() && story?.hud.route) story.hud.route(simTrunk().map((c) => norm3(graph.centers[c])), 3, t);
    rebuildAfterBreach();
  }

  // The tag flip and the debris, WITHOUT the rebuild — so a strike that
  // breaches half a dozen cells pays for one BFS and one geometry build,
  // not six of each.
  function breachWallCell(ci) {
    if (towerByCell.has(ci)) return false; // a mounted tower anchors its wall
    // ...but an ORDER is not a tower. A queued build does not anchor anything, so the wall goes and Isao is left flying to a site
    // that no longer exists. finishOrder would refuse it on arrival, but silently and late — the biomass should come back the
    // moment the ground does, and he should not spend the trip.
    if (orderByCell.has(ci)) cancelOrder(ci, 'the wall under your order was blown out');
    breachedCells.add(ci); // demolition is permanent across rounds
    dungeon.tags[ci] = PATH;
    breachQueue.push(ci);
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

  // the route field is re-laid (one BFS, ~2 ms on the 71k-cell story planet) and the surface PATCHES the breached cells
  // in place; only a board with no surface yet builds one
  function rebuildAfterBreach() {
    dungeon.distToHeart = bfsDist(graph.adj, [dungeon.heart], (i) => dungeon.tags[i] !== BLOCKED);
    if (boardSurface && breachQueue.length) boardSurface.refreshCells(breachQueue.splice(0));
    else buildGeometry();
  }

  function updateProjectiles(dt, tNow) {
    const v = SHELL_SPEED * cellSide, maxDist = SHELL_REACH * cellSide;   // content/tank.js: the shell's pace and reach
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
          // an explosion you can HEAR and SEE: the heavy blast lands at the impact (fire already played tank_main at the muzzle),
          // and the strike's full three-ring language at shell scale
          sfx.play('blast_fire', { dist: camDist(p.pos) });
          const sci = cellIndex(p.pos);
          if (sci !== -1) {
            warnRing(sci, 0xffffff, 0.55, SHELL_R * 1.1);
            warnRing(sci, 0xffb347, 0.4, SHELL_R * 0.65);
            warnRing(sci, 0xfff2c0, 0.28, SHELL_R * 0.35);
          }
          if (!explode('tank.shell', norm3(p.pos))) { const clip = makeDotBurst(0xfff2c0, norm3(p.pos), 90); clip.scale.setScalar(cellSide * 1.6); const cp = add3(p.pos, scale3(norm3(p.pos), cellSide * 0.15)); clip.position.set(cp[0], cp[1], cp[2]); scene.add(clip); debris.push(clip); }
          hit = true; sectorRun?.note({ type: 'shot', hit: true });
          break;
        }
      }
      // spawn points soak 3 hits; a landed shell also marks the source
      // FOUND — the minimap beacon starts pulsing
      if (!hit) {
        for (const sp of spawnPoints) {
          if (!sp.alive) continue;
          if (dist3(p.pos, graph.centers[sp.ci]) < cellSide * 0.6) {
            hit = true; sectorRun?.note({ type: 'shot', hit: true });
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
        blastWall(bestCi); sectorRun?.note({ type: 'shot', hit: false });
        killProjectile(i);
        continue;
      }
      if (p.dist > maxDist) { killProjectile(i); sectorRun?.note({ type: 'shot', hit: false }); }
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
    if (story?.expeditions && automated()) storyApi.expeditionStep(); if (carryingRegen && dungeon.distToHeart[player.cur] <= 2) {
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

  // The verdict lists (VERDICT_LOW/MID/HIGH, src/content/controller-copy.js): three tiers by how far the run got, picked by score
  function loseGame(reason) {
    if (player.won) return;
    player.won = true; // stops motion; same flag, sadder modal
    destroyPlayer(); if (sectorRun?.lose(reason)) { ramCombo = 0; ramComboT = 0; syncCombo(); return; }   // the story: LAST TRANSMISSION is the sector debrief
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
    runTimers.after(DEATH_HOLD * 1000, () => msgEl.classList.remove('hidden'));   // on the run's own timers: a NEW RUN inside the hold used to get the old run's card back
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
    playerHP--; if (story?.expeditions) storyApi.expeditions().hullLost();   /* the rule drops the part back at its site; the crate tumbles off and the site's flag comes down */
    run.hullsLost++; sectorRun?.hullLost();
    checkAchievements();
    if (rs && killerType) rs.killers.push(killerType);
    updateHud();
    if (playerHP > 0) { loseTank(); return; }
    loseGame('your last tank is gone');
  }

  // A HULL LOST (src/fx/hull-loss.js): the wreck and MÖRK DOWN!, then on the run's timers the dash home and the next hull out
  const loseTank = createHullLoss({
    runTimers, player, camera, camA, feel, DEATH_HOLD, PLAYER_MAX, destroyPlayer, syncCombo, showToast, setView, startShot, deployFramePoseFor, deployStart,
    tankRank: () => tankRank, playerHP: () => playerHP, playerMesh: () => playerMesh, buildMode: () => buildMode, tankLostDeploys: () => tankLostDeploys,
    setRamCombo: (v) => { ramCombo = v; }, setRamComboT: (v) => { ramComboT = v; }, setTankLostDeploys: (v) => { tankLostDeploys = v; }, setPlayerDown: (v) => { playerDown = v; },
  });

  // Respawn beside the HEART, facing outward: the gate is enemy ground by the time you die. DEPLOY is the one way a tank enters the
  // world: the hull starts at rest in its berth and drives out in manual. "Entirely out" is measured in CELLS (its centre on the exit
  // cell's), so it holds with no container model loaded. DEPLOY is not auto and not cruise: it ends with the lever at zero.
  let deploy = null;   // { n, from[3], to[3], segLen, travelled }
  const deployActive = () => deploy !== null;

  // a berth's run and heading, over the current graph (src/domain/deploy-path.js)
  const berthSeg = (b) => berthRun(b, graph.centers), berthDir = (b) => berthHeading(b, graph.centers);
  function deployStart(n) {
    const b = berths[n];
    if (!b || !graph) return false;
    deployCount++;
    player.freeMode = false; player.virtualStart = null;
    player.cur = b.ci; player.prev = -1; player.pos = berthSeg(b)[0].slice();
    player.prog = 0; player.next = b.exit;
    player.heading = berthDir(b);
    player.travelDir = player.heading.slice(); player.smoothDir = player.travelDir.slice();
    player.segLen = Math.max(1e-9, dist3(...berthSeg(b)));
    throttle = 0; cruise = false; autoMode = false;
    paintThrottle();
    stopEngine(0.1, true);
    // only what is NOT derivable: which berth, and how far out we are. from,
    // to and segLen were all functions of `n` and drifted-by-construction.
    // THE FIRST HULL OUT OF A BAY WITH AN AUTHORED ROLL-OUT PLAYS THE CLIP: the parked hull rolls, ours stays hidden until the clip ends where the run ends
    const cc = lifeContainers[n]; deploy = { n, travelled: 0, age: 0, clip: cc?.rollout && !cc.rolled ? cc.rollout : 0, bay: cc }; if (story?.hull?.held()) { deploy = null; playerDown = true; return true; }   /* NO HULL YET (src/fx/hull-issue.js): a growing page parks it unseen at its berth, not driven, not hit, until the Stålheart rolls it out */ if (deploy.clip) { cc.rolled = cc.rolling = true; cc.roll(0); playerMesh.visible = false; } return true;
  }

  // THE POSE THE WHOLE DESIGN HANGS OFF. Every prelude's last frame is this,
  // so "the cinematic's last frame is the first frame of the reset state" is
  // a property of the code rather than something tuned until it looks right.
  // A low three-quarter standing where the doors face, so the hull rolls
  // toward the lens.
  function deployFramePoseFor(n, out) {
    const b = berths[n];
    if (!b) return;
    // AN AUTHORED ROLL-OUT IS WATCHED FROM BEHIND THE BAY, over its roof, the hull leaving toward the base: the gameplay pose is behind the hull too, so the 8 s blend never swings through it
    poseCamera(deployFraming(b, graph.centers, graph.normals, !!(lifeContainers[n]?.rollout && (deploy?.clip || !lifeContainers[n].rolled)), params.wallHeight, cellSide), out);
  }

  // how far through the drive-out we are, eased — the camera blend and the
  // motion share one progress value so they cannot disagree
  function deployProgress() { const b = deploy && berths[deploy.n]; return b ? deployU(deploy, b, graph.centers) : 1; }
  function deployEase() { return easeDeploy(deployProgress()); }

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
    const segLen = Math.max(1e-9, dist3(...berthSeg(b)));
    // A DEPLOY WITH NO SPEED IS HUNG BY DEFINITION, so its expected duration is ZERO, not Infinity. The first cut wrote Infinity
    // here — mathematically honest, and it made the one case this check exists for (`params.speed` at 0, the hull never leaving
    // the berth) the one case it could never catch.
    const expect = deploy.clip || (v > 1e-9 ? segLen / v : 0);
    if (deploy.age > expect * 2 + DEPLOY_GRACE) {
      console.warn(`SHOTWATCH deploy hung: ${deploy.age.toFixed(1)}s for a ${Number.isFinite(expect) ? expect.toFixed(1) : '∞'}s`
        + ` run (speed=${params.speed} bonus=${speedBonus}) — handed over`);
      shots.hung(`deploy ${deploy.age.toFixed(1)}s/${Number.isFinite(expect) ? expect.toFixed(1) : '∞'}s`);
      deploy.travelled = segLen;   // finish it where it was going, then hand over
    }
    deploy.travelled += v * dt; if (deploy.clip) { deploy.bay.roll(deploy.age); playerMesh.visible = false; }   // the clip's clock is the deploy's; a hull rebuilt meanwhile stays hidden
    const u = deployProgress();
    const [from, to] = berthSeg(b);
    const p = [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * u);
    player.pos = norm3(p);
    player.heading = berthDir(b);
    player.travelDir = player.heading.slice();
    player.smoothDir = player.travelDir.slice();
    const ci = cellIndex(player.pos);
    if (ci !== -1 && ci !== player.cur) arriveAt(ci);
    if (u >= 1) {
      // hands over: manual, lever at zero, auto off. Because `keys` is HELD
      // state, a player already leaning on W drives on without a beat — and
      // forward is the direction the hull is already going, so the handover
      // is continuous rather than a stop.
      if (deploy.clip) { deploy.bay.rolling = false; playerMesh.visible = true; }   // hand over: the authored hull hides, ours stands where it stopped
      deploy = null; throttle = 0; cruise = false; autoMode = false; paintThrottle();
    }
  }

  function heartHit(dmg = 1) {

    run.heartHits += dmg;
    eco.leak(); // a breach kills the streak — HK's rule, our Heart
    streakMark = 0;
    if (ws) ws.leaks++; sectorRun?.heartHit(dmg);
    if (!(lab.on && lab.immortalHeart)) heartHP -= dmg;
    heartSprite.userData.hit?.(); // orange/red Wave flare (the story's Stalheart has none: a leak there used to throw every frame)
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
    const p0 = score.points; score.addKill(bounty, opts);
    persistBest(); sectorRun?.note({ type: 'score', points: score.points - p0, kind: opts?.ram ? 'ram' : 'kill' });
  }

  // HT rule: towers build on the HIGH GROUND only — real wall cells (in
  // the un-sealed world) that border the open sector. Low ground belongs
  // to monsters and the player. No connectivity guard needed: walls never
  // carry enemy pathing, so a tower can never dam a lane.
  function placeError(ci) {
    if (ci === -1) return 'nothing there';
    // HIGH GROUND MEANS THERE IS STILL A WALL THERE: tdFullTags (dungeon.tags is sector-gated) never learns of a breach, so
    // breachedCells is the missing half; without it a tower went up at wall height over open floor (the hovering tower)
    if ((tdFullTags[ci] !== BLOCKED || breachedCells.has(ci)) && !story?.sockets.has(ci)) {
      return story ? STORY_SENTRIES.rock : 'towers need HIGH GROUND';
    }
    if (towerByCell.has(ci)) return 'occupied';
    if (story && sentryBookFull({ towers: towers.length, orders, ci, cap: STORY_SENTRIES.cap })) return STORY_SENTRIES.full;
    if (story && STORY_SENTRIES.buildCells != null && chord(graph.centers[ci], graph.centers[dungeon.heart]) > STORY_SENTRIES.buildCells * cellSide) return STORY_SENTRIES.far;
    if (!graph.adj[ci].some((nb) => dungeon.tags[nb] !== BLOCKED)) {
      return story ? STORY_SENTRIES.deep : 'beyond the frontier';
    }
    return null;
  }

  // One placement recipe, used by placement, upgrade and look-swap alike.
  // Tier bulk is DERIVED from tower.tier here rather than accumulated onto
  // the object with multiplyScalar — otherwise the visual silently carries
  // tier state, and any rebuild (a look swap) would quietly lose it.
  const TIER_BULK = 1.12;
  // HOW BIG A TOWER IS, as a knob rather than a constant baked into a multiply (operator: "the towers feel too big and bulky
  // compared to the tank... smaller and more detailed, more like precision engineering"). The models carry far more detail than
  // the old procedural masts did, and detail reads better small — a bulky machine looks moulded, a small one looks machined.
  // ?towerscale= is here so the number can be argued with rather than guessed at once.
  const TOWER_SCALE = (() => {
    const v = parseFloat(flags.towerscale);
    return Number.isFinite(v) && v > 0.1 && v < 4 ? v : 0.72;
  })();
  const perchOf = (tower) => towerPerch(tower, graph, dungeon, mesh, story?.socketToward);   // EVERY TOWER STANDS AT ITS WALL'S EDGE, NEVER OVER IT (src/domain/tower-perch.js)
  function placeTowerObj(tower) {
    const obj = tower.obj;
    const s = (obj.userData.baseScale ?? 1) * cellSide * 0.62 * TOWER_SCALE * Math.pow(TIER_BULK, tower.tier); obj.scale.setScalar(s);
    // the pedestal's half-width in model units, measured once per model, so the perch knows how far it may slide
    if (obj.userData.footprintUnit === undefined) {
      const p = obj.position.clone(), q = obj.quaternion.clone();
      obj.position.set(0, 0, 0);
      obj.quaternion.identity();
      obj.scale.setScalar(1);
      const bb = new THREE.Box3().setFromObject(obj);
      // the pedestal's half width: the long axis is the barrels, which may reach over the edge
      obj.userData.footprintUnit = Number.isFinite(bb.max.x) ? Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 : 0;
      obj.position.copy(p);
      obj.quaternion.copy(q);
      obj.scale.setScalar(s);
    }
    obj.userData.footprintR = obj.userData.footprintUnit * s; if (!tower.a6) setTierPlate(obj, tower.tier, tower.def.color);   // its level on its foot: square, hexagon, circle
    // ...and a WALKER is wherever it has walked to. Its own position is a
    // unit direction, so it is its own normal — no cell lookup, because it
    // is very often not standing on one.
    if (tower.a6) {
      const p = tower.a6.pos, at = cellIndex(p), top = 1 + (at === tower.ci ? (story?.sockets.has(at) ? story.socketLift : params.wallHeight) : dungeon.tags[at] === BLOCKED ? params.wallHeight : 0);
      // NO BOB. It was a stand-in for a walk cycle the model could not play, and now that the legs actually move it is just a hop
      // laid over them — which is what "it jumps instead of walking" was. The clip is the walk; the hull rides the ground.
      const going = !!tower.a6.moving;
      if (obj.userData.setGait) obj.userData.setGait(going);
      obj.position.set(p[0] * top, p[1] * top, p[2] * top);
      // ...AND IT FACES WHERE IT IS WALKING. Setting `up` alone leaves the heading at whatever the identity quaternion gives, so
      // a machine with six legs and a clear front was crabbing sideways down its own path — half of why the gait did not read.
      // The Workshop's models are +Y up and +Z forward, so the basis is (up × forward, up, forward).
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
    const c = perchOf(tower), nrm = graph.normals[tower.ci];
    const top = 1 + (story?.sockets.has(tower.ci) ? story.socketLift : params.wallHeight); // the wall's roof, or a story socket on the floor
    obj.position.set(c[0] * top, c[1] * top, c[2] * top);
    tmpN.set(nrm[0], nrm[1], nrm[2]);
    obj.quaternion.setFromUnitVectors(Y_AXIS, tmpN);
  }

  // Swap every tower's VISUAL in place. Game state — key, def, tier, cell,
  // cooldown, spend — is untouched; only `obj` is rebuilt. That is the
  // whole point of the registry.
  // Choosing a player unit. A unit whose model loads asynchronously stands an
  // EMPTY placeholder right now and swaps the real hull in when the bytes
  // land, so the choice is instant and no other hull is ever seen.
  function applyCreature() {
    const chosen = params.creature;
    if (chosen === 'mork') {
      preloadMork().then((ok) => {
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

  function commitTower(key, ci, spent) {
    const def = TOWER_BY_KEY[key];
    const obj = buildTowerLook(params.towerLook, def);
    const tower = { key, def, tier: 0, ci, obj, cooldown: 0, spent, id: nextTowerId++ };
    // A WALKER IS BORN AT ITS BERTH AND THEN STOPS BEING THERE. The cell it was placed on is its home, not its position —
    // everything else about a tower (the purse, the queue, the upgrade, the sell) is unchanged, and that is deliberate: it is a
    // tower with a life, not a new kind of thing the rest of the board has to know about.
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
  // --- ISAO: the industrial construction drone (src/fx/isao-worker.js): an order is placed, he flies to the cell and prints, so
  // TRAVEL and BUILD stand between wanting a tower and having one; the controller keeps the two drones, the module their work
  const isaoWorker = createIsaoWorker({
    X_AXIS,
    Z_AXIS,
    automated,
    checkAchievements,
    commitTower,
    disposeObj,
    effectiveStats,
    flashShopNote,
    keys,
    params,
    placeError,
    placeTowerObj,
    scene,
    sfx,
    showBrief,
    showRangeRing,
    tmpObj,
    tmpQ,
    towers,
    updateHud,
    cellSide: () => cellSide,
    dungeon: () => dungeon,
    eco: () => eco,
    graph: () => graph,
    run: () => run,
    sectorRun: () => sectorRun,
    story: () => story,
    storyApi: () => storyApi,
    t: () => t,
    throttle: () => throttle,
    isao: () => isao,
    setIsao: (v) => (isao = v),
    assistant: () => assistant,
    setAssistant: (v) => (assistant = v),
  });
  const { orders, orderByCell, workers } = isaoWorker;
  function spawnIsao(...a) { return isaoWorker.spawnIsao(...a); }
  function spawnAssistant(...a) { return isaoWorker.spawnAssistant(...a); }
  function dropSiteRing(...a) { return isaoWorker.dropSiteRing(...a); }
  function orderTower(...a) { return isaoWorker.orderTower(...a); }
  function orderUpgrade(...a) { return isaoWorker.orderUpgrade(...a); }
  function cancelOrder(...a) { return isaoWorker.cancelOrder(...a); }
  function updateIsao(...a) { return isaoWorker.updateIsao(...a); }

  // The strike's version of losing a tower: no refund, and the wreck shows.
  // Selling is a decision; this is a consequence.
  function destroyTower(tower) {
    tower.spool?.stop(0.1); tower.spool = null; const c = perchOf(tower), nrm = graph.normals[tower.ci], burst = makeDotBurst(tower.def.color, nrm, 40);
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

  // dotted range ring on the surface — one reusable mesh, house style
  let rangeRing = null;
  let rangeRingTtl = 0;
  // THE CHARGING PADS: the heart's own cell in the campaign, the solar array's
  // island in the story. Lit while there is something to draw and dark once it
  // is gone, so a trip home that will not pay can be declined from across the board.
  let stationRing = null, arrayRing = null;
  function buildStationRing() {
    for (const r of [stationRing, arrayRing]) if (r) { scene.remove(r); disposeObj(r); }
    stationRing = arrayRing = null;
    if (!graph) return;
    if (story?.arrayPad) scene.add(arrayRing = makePadRing(story.arrayPad.pos, metresToArc(SHIELD_ARRAY.radiusMetres, cellSide), 1 + metresToArc(SHIELD_ARRAY.lift, cellSide), SHIELD_ARRAY.ring));
    else if (dungeon.heart != null && !storyMode) scene.add(stationRing = makePadRing(graph.centers[dungeon.heart], cellSide * 0.55, 1 + params.wallHeight * 0.7));
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

  // How many tethers a slow tower DRAWS per shot, however many it slows.
  // The field is universal; the picture is bounded (see the slowfield
  // branch in stepTowers).
  const SLOW_BOLTS = 3;
  const aimV = new THREE.Vector3();

  // The board adapts world positions and actual articulation to shared
  // missile engagement rules. Other weapons retain their existing target
  // policy; damage, upgrades and cadence remain game-owned.
  const gunV = new THREE.Vector3();
  function effectiveStats(def, tier) {
    const stats = baseEffectiveStats(def, tier);
    const config = missileOf(def.key);
    if (config) stats.range = config.maxRange / METRES_PER_CELL * (stats.range / def.range);
    return stats;
  }
  const missileDistance = (from, to) => arcToMetres(a6Arc(from, to), cellSide);
  function engagementConfig(tw) {
    const def = tw.def;
    return missileLimits(missileOf(tw.key), baseEffectiveStats(def, tw.tier).range / def.range);
  }
  function acquireMissileTarget(tw, from, config) {
    const i = pickMissileTarget(enemies, from, tw.missileTarget?.id, config, missileDistance,
      e => e.alive && (!tw.a6 || !e.spec.rammable));
    return tw.missileTarget = i < 0 ? null : enemies[i];
  }
  const aimTower = createTowerAim({ enemies, chord, effectiveStats, engagementConfig, acquireMissileTarget, missileDistance, missileOf: (key) => missileOf(key), graph: () => graph, cellSide: () => cellSide, pilot: () => pilot, pilotMode: () => pilotMode });   /* THE AIM (src/fx/tower-aim.js): target, yaw, elevation, the drives and a launcher's lock; missileOf is declared below */

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

  // WHERE A STRAIGHT LINE MEETS THE GROUND OR A WALL, on this board: the lance's march and a round's exact end (src/domain/round-path.js)
  function terrainOf(ownCi = -1) { return { cellAt: cellIndex, tags: dungeon.tags, wallHeight: params.wallHeight, step: cellSide * 0.2, clearance: cellSide * 0.25, rockClearance: cellSide * 0.03, ownCi }; }
  function rayToTerrain(from, dir, maxLen, ownCi = -1) { return marchToTerrain(from, dir, maxLen, terrainOf(ownCi)); }
  const lanceReach = (from, dir, maxLen, ownCi) => { const a = arcOf(from, dir); return marchAlongArc(a.fromU, a.dTan, a.r0, a.slope, maxLen, terrainOf(ownCi)); };   // the lance's stop, on the curve it is drawn along (src/domain/round-path.js)

  // ITS OWN STREAM, off the board's seed — the A6's patrol must be
  // reproducible with the rest of the run (no Math.random anywhere in game
  // logic) without pulling on any stream something else is counting on.
  const a6Rng = mulberry32((params.seed >>> 0) ^ 0x0a600a6);

  // Shared DART presentation; the board retains target selection and damage.
  const towerSeekers = [];
  let missilePool=null, missilesDisposed=false, talonPool=null; const missileOf = (key) => story?.missiles?.[key] ?? CONTENT.missiles[key]; const feedScope = createScopeFeed({ camera, sfx, towerBarrel, towerSeekers, missileOf, storyScope: () => storyScope, graph: () => graph, cellSide: () => cellSide, pilot: () => pilot, story: () => story });   // the story's Quiver fires the TALON; its scope's feed
  let seekerHits=0,seekerLost=0;
  createMissilePool({capacity:256}).then(pool=>{
    if(missilesDisposed)pool.dispose();else missilePool=pool;
  }).catch(error=>record('asset.missile.failed',{message:error.message}));

  function launchTowerSeeker(tw, from, target, tNow) {
    const config=missileOf(tw.key), pool=config?.mesh==='talon'?talonPool:missilePool;
    if(config?.mesh==='talon'&&!talonPool){createMissilePool({mesh:'talon',capacity:8}).then(p=>{talonPool=p;});return false;}   // the heavy round's pool, made on first demand
    if(!config || !pool?.available || tw.obj.userData.loading || (storyMode && towerSeekers.some(m=>m.by===tw)))return false;   // the story's guided round: one lock, one round in flight, then the next
    const direction=towerBarrel(tw,norm3(from));
    const scale=tw.lastMuzzle?.getWorldScale(new THREE.Vector3()).x ?? tw.obj.scale.x;
    const m=launchDart(pool,{config,from,target:target.pos,direction,scale,sphere:true,metre:cellSide/10}); if(!m)return false;   // ten metres a cell: the pop-out's cap reads in metres
    Object.assign(m,{pool,tid:target.id,by:tw,p:from.slice()});
    scene.add(m.mesh);towerSeekers.push(m);
    return true;
  }

  function stepTowerSeekers(dt,tNow) {
    for(let i=towerSeekers.length-1;i>=0;i--){
      const m=towerSeekers[i],target=enemies.find(e=>e.id===m.tid && e.alive);
      const arrived=advanceDart(m.pool,m,dt,target?.pos ?? m.target);
      m.p=m.pose.position;
      if(!arrived)continue;
      if(target){damageEnemy(target,tNow,effectiveStats(m.by.def,m.by.tier).dmg*(m.config.dmgMul??1),true,'tower',m.by.key);seekerHits++;}   // the story's TALON carries a heavy payload
      else seekerLost++;
      const at=norm3(target?.pos??m.p);if(m.config.mesh==='talon'){for(const e of enemies)if(e.alive&&e!==target&&chord(e.pos,at)<QUIVER_SPLASH.cells*cellSide)damageEnemy(e,tNow,effectiveStats(m.by.def,m.by.tier).dmg*(m.config.dmgMul??1)*QUIVER_SPLASH.share,true,'tower',m.by.key);if(!target)explode('rock.dust',at);}   // a hit OR a miss: area damage round where it lands, dust on a miss (owner, 2026-10-02)
      if(!(m.config.mesh==='talon'&&explode('quiver.talon',at))){const burst=makeDotBurst(target?0xffd27f:0x6f8ea0,norm3(m.p),target?22:10);burst.scale.setScalar(cellSide*(target?2.4:1.2));burst.position.fromArray(m.p);scene.add(burst);debris.push(burst);}   // a TALON hit bursts on its target; a miss keeps the small puff
      m.pool.release(m.mesh);towerSeekers.splice(i,1);
    }
  }

  // --- the PLASMA THROWER's and the LANCER's beams (src/fx/plasma-beams.js): one beam per tower, five links each
  const plasmaBeams = new Map();   // tower -> { links[], until }
  const plasmaBeamsFx = createPlasmaBeams({
    scene,
    plasmaBeams,
    debris,
    explode,
    towerByCell,
    effectiveStats,
    camera,
    towers,
    lanceReach,
    disposeObj,
    cellSide: () => cellSide,
    pilotMode: () => pilotMode,
    pilot: () => pilot,
  });
  function throwPlasma(...a) { return plasmaBeamsFx.throwPlasma(...a); }
  function lanceBeam(...a) { return plasmaBeamsFx.lanceBeam(...a); }
  function stepPlasmaBeams(...a) { return plasmaBeamsFx.stepPlasmaBeams(...a); }

  // THE TOWER COMBAT LOOP (src/fx/tower-combat.js): the A6 walkers, every tower's frame, the shots, beams, lightning and slugs
  const towerCombat = createTowerCombat({
    SLOW_BOLTS,
    Z_AXIS,
    a6Rng,
    aimTower,
    automated,
    beams,
    chord,
    debris,
    enemies,
    explode,
    feedScope,
    gunV,
    lanceReach,
    missileDistance,
    missileOf,
    orderByCell,
    orders,
    params,
    perchOf,
    scene,
    sfx,
    shield,
    tmpV,
    towerByCell,
    towerCells,
    towerSeekers,
    towerShots,
    towers,
    acquireMissileTarget,
    camDist,
    closeShop,
    damageEnemy,
    disposeObj,
    dropSiteRing,
    effectiveStats,
    engagementConfig,
    hideRangeRing,
    lanceBeam,
    launchTowerSeeker,
    placeTowerObj,
    rayToTerrain,
    stepPlasmaBeams,
    stepTowerSeekers,
    terrainOf,
    throwPlasma,
    towerMuzzle,
    warnRing,
    cellIndex: () => cellIndex,
    cellSide: () => cellSide,
    dungeon: () => dungeon,
    graph: () => graph,
    heartHP: () => heartHP,
    missilePool: () => missilePool,
    pilot: () => pilot,
    pilotMode: () => pilotMode,
    pilotPost: () => pilotPost,
    pilotPosts: () => pilotPosts,
    rs: () => rs,
    story: () => story,
    wave: () => wave,
    storyMode: () => storyMode,
    brass: () => brass,
    setBrass: (v) => (brass = v),
    isao: () => isao,
    setIsao: (v) => (isao = v),
    setWatchTower: (v) => (watchTower = v),
  });
  function stepTowers(...a) { return towerCombat.stepTowers(...a); }
  function losClear(...a) { return towerCombat.losClear(...a); }
  function spawnLightning(...a) { return towerCombat.spawnLightning(...a); }
  function updateTowerShots(...a) { return towerCombat.updateTowerShots(...a); }
  function stepSlugs(...a) { return towerCombat.stepSlugs(...a); }
  function updateBeams(...a) { return towerCombat.updateBeams(...a); }
  function clearTowers(...a) { return towerCombat.clearTowers(...a); }

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
  let tfContainers = 0;

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
  function tfStart(kind) { if (storyMode) return;
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
    if (storyMode) return;
    if (w > 0 && w % TF.hullEvery === 0) tfStart('hull');
    else if (w > 0 && w % TF.containerEvery === 0) tfStart('container');
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
    tfJob = null; tfContainers = 0;
    if (heartSprite) heartSprite.userData.working = 0;
  }
  // the HUD line, beside ISAO's: what is on the bed, or what the clock says
  function terraLine() {
    if (tfJob) {
      const pct = Math.round(Math.min(1, tfJob.t / tfJob.dur) * 100);
      return `<div class="hud-obj hud-isao">TERRAFORMER &#9656; printing ${tfJob.kind === 'hull' ? 'a new hull' : `store ${tfContainers + 1}`} ${pct}%</div>`;
    }
    const left = TF.hullEvery - (wave % TF.hullEvery);
    return `<div class="hud-obj hud-isao">TERRAFORMER &#9656; yard ${tfYard.length} · next hull in ${left} wave${left === 1 ? '' : 's'}</div>`;
  }

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


  function buildPortalObj(ci) {
    const n = norm3(graph.centers[ci]), dir = sub3(graph.centers[dungeon.heart], n);
    return gameBreaches.create(n, dir, cellSide);
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
  // THE RADIAL (src/fx/shop-radial.js): the options ring the tapped cell
  const openShop = createShopRadial({ root, container, shopEl, strike, towerByCell, orderByCell, orders, towers, automated, closeShop, placeError, effectiveStats, showRangeRing, eco: () => eco, isao: () => isao, shopMute: () => shopMute, story: () => story, wave: () => wave, shopPos: () => shopPos, setShopCi: (v) => { shopCi = v; }, setShopPos: (v) => { shopPos = v; }, refuse: refuseCaption });
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
  // well. Exhausted ground breaches seal once their final wave is held.
  function programmeSpent() {
    for(const sp of spawnPoints)if(sp.alive&&sp.obj.userData.breach)killPortal(sp,'exhausted');
    sfx.play('boss_tension');
    showToast(`<div class="wave-num">THE WAVES ARE SPENT &middot; SECTOR ${round}</div>`
      + `<div class="wave-role">${params.wavesPerSector} sent, ${params.wavesPerSector} held. `
      + `nothing more is coming &mdash; the breaches have sealed</div>`, 4200);
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
    if (player.won || storyMode) return;   // the story's sectors decide when a sector is secure (src/fx/sector-run.js)
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
      // THE ENDING IS NOT ANOTHER LEVEL (operator). The last enemy used to fall and the analysis board simply appeared — the
      // single most consequential moment in the game had no moment. So: a red shout while the body is still coming apart, then
      // the camera LEAVES, pulling back off the hull until the whole planet is a marble against the galaxy, and only then the
      // debrief. The pull-out is the beat that says the scale of the thing you just finished; a cut to a modal cannot.
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

  function victoryPullOut(final) { startVictoryPull({ camera, tmpCam, startShot, setView, debrief: () => renderAnalysis(final) }); }   /* THE PULL-OUT, then the debrief (src/fx/victory-pull.js; its path and numbers in src/domain and src/content) */

  // --- THE DEBRIEF, THE CAMPAIGN LOG AND THE VERDICT (operator, 2026-09-02) live in src/fx/campaign-debrief.js: the analyst's six
  // windows with the strike replay, a snapshot per cleared sector, and the verdict with its orders. The campaign board only.
  const { renderAnalysis, renderVerdict, logSector, campaignReset, showSitrep, campaign } = createCampaignDebrief({
    msgEl,
    sitrepEl,
    spriteShot,
    makeDotEnemy,
    coins: () => coins(),
    runAchvBlock: () => runAchvBlock(),
    ctx: () => ({
      rs, ws, run, score, biomass: eco.biomass, earned: eco.earned, spent: eco.spent, heartHP, HEART_MAX, playerHP, PLAYER_MAX,
      towers: towers.length, tankRank, tankKills, round, wave, sectorsTotal: SECTORS_TOTAL, wavesPerSector: params.wavesPerSector,
      sectorWave: sectorWave(), programmeDone: programmeDone(), time: runContext.time, toll: sectorToll(), shield, shieldTune,
      assistant: !!assistant,
    }),
  });
  // THE COIN. Retro, by request: winning a planet mints one; CONTINUE? spends
  // it. Persists, so a player who walks away with a coin still has it.
  const COIN_KEY = 'td.coins';
  function coins() { try { return parseInt(localStorage.getItem(COIN_KEY) || '0', 10) || 0; } catch { return 0; } }
  function setCoins(n) { try { localStorage.setItem(COIN_KEY, String(Math.max(0, n))); } catch { /* private mode */ } }

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
    round++;
    sectorStartWave = wave; strike.reserved += 1;
    expandRound(); syncArmUi();
    record('sector.begin', { sector: round, wave, biomass: eco.biomass });
    return true;
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
      poseAt: (u, out) => poseCamera(orbitFrame(revealDir, 3.3), out),   // whole planet in frame, the new band centred — framing unchanged (src/domain/story-shots.js)
      onEnd: () => {
        // the new ground cools back to its true colors; planning begins
        for (const ci of revealCells) paintCell(ci, floorColorOf(ci));
        revealCells = [];
        if (!buildMode) setView('orbit');
        updateHud();
      },
    });
    buildGeometry();
    // THE SAFETY NET. Breach persistence keeps corridors open, but a tank parked on a later-band lane it reached THROUGH a breach
    // can still have the band gate reseal the ground under it — walls closing over the hull (operator bug report). If the shift
    // entombed the tank, redeploy it beside the heart and say so.
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
    grantStrikes(strike, spawnPoints.filter((sp2) => sp2.alive).length, strikeTune);
    recomputePortalDist();
    waveActive = false; interClock = 0;
    player.won = false;
    paused = false;
    msgEl.classList.add('hidden');
    waveEl.style.borderColor = '#ffffff';
    waveEl.style.color = '#ffffff';
    waveEl.innerHTML = `<div class="wave-num">SECTOR ${round}</div>` +
      `<div class="wave-name">THE WORLD GROWS</div>` +
      `<div class="wave-role">new ground · new breaches · your towers hold</div>`;
    waveEl.classList.remove('hidden');
    clearTimeout(waveTimer);
    waveTimer = setTimeout(() => waveEl.classList.add('hidden'), 3200);
    updateHud();
  }

  // --- dashboard -----------------------------------------------------------
  const gui = new GUI({ title: 'TD', container: root });
  // THE DEV PANEL (src/platform/dev-panel.js): looks, camera, world knobs, feel, strike, plasma, bloom, sound
  const { viewCtrl, directiveCtrl, seedCtrl } = createDevPanel(gui, {
    params,
    DIRECTIVES,
    HEART_LOOKS,
    PLASMA,
    TYPE,
    strikeTune,
    postfx,
    sfx,
    root,
    applyCreature,
    applyLook,
    applyTowerLook,
    regenerate,
    setView,
    syncCalloutMode,
    syncDirectiveChip,
    plasma: () => plasma,
  });

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
    const top = Math.max(0.001, params.speed * speedBonus * 1.6 * 1.45 * TANK_DRIVE.top); // cruise+boost at a full run-up
    const target = Math.min(1, cellsPerSec / top);

    // asymmetric smoothing: spin up fast, spool down slow, like an engine
    const k = target > engineLevel ? 6 : 2.5;
    engineLevel += (target - engineLevel) * Math.min(1, k * dt);

    const moving = engineLevel > 0.03 && !paused && !player.won;
    engineIdle = moving ? 0 : engineIdle + dt;

    // slow both ways: an engine SPOOLS. Rising a touch slower than it falls
    // reads as taking up load, then setting the weight back down.
    stepTankFeel(feel, dt, engineRunning, FEEL); feel.bank = steerBank(steerEase, TANK_STEER) + kick.roll;   /* the hull rolls into its turn (src/domain/steer-ease.js) */

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
    if (!moving && engineIdle >= ENGINE_STOP) {
      stopEngine();
    } else if (engineHandle) {
      // gain is nearly linear in level; pitch spans 0.92..1.14 so the bed is
      // felt as effort rather than heard as a repeating clip
      // floor raised from 0.18: the bed was inaudible at a crawl, so it only
      // registered at full speed — which read as "the thruster isn't there"
      engineHandle.set(0.34 + 0.66 * engineLevel, 0.92 + 0.22 * engineLevel);
    }
  }

  // THE FRAME READOUT (operator, 2026-09-02; src/platform/perf-overlay.js): fps, ms, the frame's workload and the GPU timer
  const perfOverlay = createPerfOverlay(root, {
    renderer,
    scene,
    lab,
    statsEl,
    beams,
    debris,
    enemies,
    plasmaBeams,
    projectiles,
    spawnPoints,
    towerSeekers,
    towerShots,
    towers,
    heartSprite: () => heartSprite,
    pilotMode: () => pilotMode,
    playerMesh: () => playerMesh,
    shieldObj: () => shieldObj,
    wave: () => wave,
    perfCtl: () => perfCtl,
  });
  const { el: perfEl, cpu: perfCpu, set: setPerfOverlay, gpuExt, gpuBegin, gpuEnd, tick: perfTick, key: PERF_KEY } = perfOverlay;
  let perfCtl = null;

  function animate() {
    // SIM rides TIMERS, not rAF: under a virtual-time budget the timer
    // queue runs at full speed while BeginFrames are rationed (the same
    // trap every probe in this file documents — used on purpose for once),
    // and in a real browser setTimeout(0) still outruns vsync ~4x.
    if (disposed) return;   // a disposed tab schedules no more frames (2026-10-01; it rescheduled itself for the life of the page)
    if (simFast > 1 && !simDone) setTimeout(animate, 0);
    else requestAnimationFrame(animate);
    frameNo++; if (!active || !mesh) return;
    // active play = no modal up: briefing, pause, and win/lose all count
    // as idle, which is when the mobile chrome (menu button) may return
    const playing = !paused && !player.won;
    if (playing !== wasPlaying) {
      wasPlaying = playing;
      document.body.classList.toggle('playing', playing);
    }
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1); // clamp tab-switch gaps
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
    const cpuStart=perfOverlay.on()?performance.now():0;
    // A FAULT IN THE FRAME (2026-09-25) froze the picture: the world still draws, and each distinct fault is rethrown ONCE on its
    // own turn for the error handlers, the diagnostics ring and the suites
    inFrame = true;
    try {
      frame(dt, false);
    } catch (err) {
      const k = String(err?.stack ?? err);
      if (!frameFaults.has(k)) { frameFaults.add(k); setTimeout(() => { throw err; }); }
      try { postfx.render(); } catch { /* the renderer is what failed: nothing more to draw this frame */ }
    }
    inFrame = false;
    if(perfOverlay.on())perfCpu.frame+=performance.now()-cpuStart;
    gpuEnd(); if (hudDirty) { hudDirty = false; hudFrame = frameNo; paintHud(); }   /* the HUD's catch-up paint (updateHud) */
  }

  let simFrameNo = 0, frameFaults = new Set();   /* the distinct frame faults already rethrown (animate) */
  // the whole former animate() body: dt-driven update + (skippable) render
  function frame(dt, simSkip) {
    // paused: keep presenting the frozen frame (both views), zero sim.
    // lastFrame keeps updating above so resume has no dt spike.
    if (paused) {
      if (!simSkip) {
        playerMesh.visible = params.view !== 'pov' && !deploy?.clip && !story?.hull?.held();   // an authored roll-out owns the hull on screen: ours would stand in it, turret sweeping; an unissued hull is not drawn
        postfx.render(); storyMonitor?.render(renderer, scene, towerSeekers.find((m) => m.pool === talonPool && m.by === pilot?.state.tower)?.mesh ?? null, cellSide, 0);
        playerMesh.visible = !deploy?.clip && !story?.hull?.held();
        radarScope.draw(t); laserStation.render(renderer, scene);   // the sweep keeps turning; a dead scope reads as a crash
      }
      return;
    }
    t += dt;

    // BUILD downtime: with the field clear, build mode freezes the WAR —
    // wave clock, motion, combat — while ambient life (portal twinkle,
    // heart moods, debris) and the camera transition keep breathing.
    // Mid-assault the same toggle is camera-only.
    stepBriefClock(dt);
    if (pilotMode && shotId() !== 'takeControl') endShot();
    stepShot(dt);
    const frozen = buildFrozen() || (shotActive() && !/^(breach|sol88Launch|isaoTalk|sitesTour)$/.test(shotId()));   // live shots: the world runs under them
    // The BUILD pause holds the WORLD still, not the DRIVER (planning used to take three switches); a reveal or a tutorial hold
    // stops everything, because those are the game speaking.
    // the cold open holds the hull for its first two beats and lets go for
    // the third — beat three IS the tank driving itself out of the berth
    // DEPLOY drives THROUGH a shot — that is how the cinematic's last frame
    // and DEPLOY's first frame meet — so the gate only stops free driving
    const driveFrozen = shotActive() && shotId() !== 'breach';

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
    if (pilotMode) deploy = null;
    if (deploy) deployStep(dt);
    else if (!driveFrozen && !pilotMode) advanceMotion(dt);
    ctlWatch(dt);
    // Isao keeps his shift through the build downtime — the war may be
    // frozen there, but construction is the thing you came to do. A
    // reveal or the cold open still stops him: those are the game
    // speaking, and nothing should be printing over the top of it.
    if (!frozen) updateIsao(dt); else if (isao) lookIsao(isao, dt, true);   // a close-up still shows his face and turning rotors
    for (const orb of orbMeshes.values()) orb.userData.tick(t); brass?.tick(frozen ? 0 : dt); explosions.tick(frozen ? 0 : dt);   // spent cases and explosions run on the world's clock
    for (let i = debris.length - 1; i >= 0; i--) {
      if (!debris[i].userData.tick(dt)) {
        scene.remove(debris[i]);
        debris[i].geometry.dispose();
        debris.splice(i, 1);
      }
    }
    if (!player.won && !frozen) {
      // An armed wave always gets its full lead-in, whoever asked for it.
      // This used to live inside the between-waves branch, so the stall
      // safety below — which fires while a wave is STILL live — spawned with
      // no charge, no rings and no sound at all. Later rounds hit that path
      // more and more often as waves take longer to clear, which is exactly
      // what "the cues drift in later rounds" looks like from the outside.
      // the orbital window fills in game time, like everything else here
      gunshipRig.tick(dt);   /* the orbit, the call meter, the track, the optic's ride and the MK-9 (src/fx/gunship-rig.js) */ if (stepStrike(strike, dt, strikeTune) === 'armed') {   // the gunship's pass, then the strike's ration
        if (!story) { sfx.play('tower_upgrade'); showToast('<div class="wave-num">ORBITAL ASSET ARMED</div>'   /* the story has no strike controls to arm */
          + '<div class="wave-role">ready — arm, paint, launch</div>', 2200); }
      }
      if (waveIn >= 0) {
        waveIn -= dt;
        waveCharge = Math.max(0, Math.min(1, 1 - waveIn / WAVE_WARN));
        warnBeat -= dt;
        if (warnBeat <= 0) {
          // beats accelerate from ~0.7s apart to ~0.18s: the cadence IS the countdown, and it is legible without reading anything
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
        if (sectorRun?.pulseGap?.() != null ? sectorRun.pulseOver(spawnQueue) : (!spawnQueue.length && enemies.every((e) => !(e.alive && !e.guard)))) {   /* a sector's pulse ends as its bodies leave the queue */
          waveActive = false; interClock = 0; waveCharge = 0; if (automated()) fillFromWaveClear(gunshipRig.call, GUNSHIP_CALL);
          { const p0 = score.points; score.addWave(wave); persistBest(); sectorRun?.note({ type: 'score', points: score.points - p0, kind: 'bonus' }); }
          if (simStyle) {
            simCurve.push({ w: wave, t: Math.round(t), heart: heartHP,
              biomass: eco.biomass, towers: towers.length, score: score.points });
          }
          if (!storyMode && sectorWave() === params.wavesPerSector) {   // the story's sectors collapse their own breaches
            // the HOLD is over: the gates lose their seals and the sector becomes a hunt. This is the loudest beat in a sector
            // and it gets the loudest card the toast layer has.
            programmeSpent();
            showBrief('gates');
          } else if (!storyMode) showSitrep(); // the recap IS the cleared card now (not in the story)
        } else if (waveAge >= params.waveCap && spawnPoints.some((s) => s.alive) && !(lab.on && lab.holdWaves) && !storyMode) {
          armWave(); // safety: the field is stalled — but it still announces
        }
      } else if (spawnPoints.some((s) => s.alive)) {
        interClock += dt;
        // arm early enough that the countdown consumes the last WAVE_WARN of
        // the gap — the total wait from cleared to spawned is unchanged
        const gap = sectorRun?.pulseGap?.() ?? params.waveGap * (wave < 2 ? 1.6 : 1); // breathe early
        if (interClock >= gap - WAVE_WARN && !(lab.on && lab.holdWaves) && (!storyMode || automated())) armWave();
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
    if (story) (integrityHud ??= createIntegrityHud(root, { sfx, brief: showBrief })).tick({ heart: { hp: heartHP, max: HEART_MAX }, gates: story.sectorN ? sectorRun?.gates() ?? [] : [] }, dt);   /* src/fx/integrity-hud.js */
    story?.arrival.tick(dt, storyApi); storyBase?.tick(frozen ? 0 : dt, player.pos, sectorRun?.gateForce() ?? null, camera.position); story?.beats.tick(frozen ? 0 : dt, storyApi); if (!frozen && story?.programme) storyApi.build(); foundryFx?.tick(frozen ? 0 : dt); gameBreaches.update(frozen?0:dt,obj=>{
      let changed=false;const centre=norm3(obj.position.toArray()),within=Math.cos((obj.userData.clear??CONTENT.breach.clearRadius)*cellSide);   /* the arc test as a dot against the unit normals: the acos and a fresh norm3 per cell cost 11 ms of the opening frame on the 71k-cell story planet */
      for(let ci=0;ci<graph.centers.length;ci++)if(dungeon.tags[ci]===BLOCKED&&dot3(centre,graph.normals[ci])>=within&&!orderByCell.has(ci))changed=breachWallCell(ci)||changed;
      if(changed){rebuildAfterBreach();recomputePortalDist();}
    },opened=>{
      sfx.play('sinkhole_quake',{dist:Math.min(...opened.map(obj=>camDist(obj.position.toArray())))});
      // One skippable establishing shot per new group, never per wave.
      if((wave>0||storyMode)&&!paused&&!shotActive()&&!pilotMode&&!pilot?.gunship&&!laserStation.seated()&&!storyApi.danger?.()&&!opened.every(o=>o.userData.quiet)){   // never while a seat is manned: the cut took the gunner's camera mid-aim (owner, 2026-09-15); the quake still sounds
        const sb=storyMode?story?.breachShot:null;   // IN THE STORY: the whole planet through the pre-roll, then as the ground opens a FAST DIVE to a close view over the sinkhole, held while the fodder emerge, then a short blend back
        startDiveShot({camera,startShot,cellSide},opened[0].position.clone().normalize(),{preRoll:sb?.preRoll??CONTENT.breach.preRoll,hold:sb?CONTENT.breach.duration+(sb.emergeHold??0):0,tail:sb?sb.tail??1.8:1.8,dive:sb});
      }
    });
    if (!frozen) { tfTick(dt); sectorRun?.tick(dt); }
    if (!frozen) autoUpgradeTick(dt);
    if (gotoCi >= 0 && player.cur === gotoCi) stopGoto();   // arrived: hand back, stop
    // the shell's mode button follows buildMode from EVERY path that sets it
    // (sector reveal, the desktop chip), not only its own tap
    if (mobModeEl && (buildMode ? 1 : 0) !== mobModeLast) { mobModeLast = buildMode ? 1 : 0; syncMobMode(); }
    coachTick(dt);
    if (!frozen && eco) { ecoClockT += dt; if (eco.biomass >= CHEAPEST_TOWER) ecoAffordT += dt; }
    stepShieldDynamics(dt,t);
    if (!frozen) {
      runContext.advance(dt);   // THE RUN'S CLOCK RIDES THE WORLD'S (2026-10-01): it advanced only with the hull's motion, so the heart's breathing, the regrow queue, the orbs and the pad rings all stopped while the player sat in a seat or the hull was down
      let cpuStart=perfOverlay.on()?performance.now():0;
      if (!(lab.on && lab.freezeEnemies)) updateEnemies(dt, t);
      if(perfOverlay.on())perfCpu.enemies+=performance.now()-cpuStart;
      checkRewards();
      updateProjectiles(dt, t);
      updateLasers(dt, t);
      cpuStart=perfOverlay.on()?performance.now():0;
      stepTowers(dt, t);
      if(perfOverlay.on())perfCpu.towers+=performance.now()-cpuStart;
      updateTowerShots(dt, t);
    }
    // the breaches' own motion
    for (const sp of spawnPoints) if (sp.alive && sp.obj?.userData.tick) sp.obj.userData.tick(t, dt);
    updateBeams(dt); // fx fade even during downtime
    stepSlugs(dt);
    if (rangeRingTtl > 0) {
      rangeRingTtl -= dt;
      if (rangeRingTtl <= 0) { rangeRingTtl = 0; hideRangeRing(); }
    }
    if (strikeGrace > 0) strikeGrace -= dt;
    if (shopMute > 0) shopMute -= dt;
    if (heartCalloutCd > 0) heartCalloutCd -= dt;
    glowPadRing(stationRing, shield.stationLeft > 0 ? 'idle' : 'dry', runContext.time); glowPadRing(arrayRing, story?.arrayPad?.standing ? (arrayStation.charging ? 'charging' : arrayStation.reserve > 0 ? 'idle' : 'dry') : null, runContext.time);
    if (rs) {
      rs.binClock += dt;
      if (rs.binClock >= 5) { rs.binClock = 0; rs.scoreBins.push(score.points); }
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
    }
    if (simStyle && !simDone) simPolicy(dt);
    if (!pilotMode) { autoSecondary(); autoGunner(t); } else autoLaserWant = false;   // no parked laser under a seat
    checkVictory(); // ram kills and heart-contact deaths can end it too
    // DOM is the sim's tax collector: an innerHTML rebuild per SIM STEP
    // (120 per painted frame) throttled the fast-forward to ~2s per batch.
    // The HUD only needs to be true when a frame is actually painted.
    if (!simSkip) {
      updateHud();
      updateNextPreview();
    }
    placeActors(); story?.glue?.tick(frozen ? 0 : dt);   /* after the hull's transform, so a carried crate rides this frame's deck */

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
    // the controls page, once, as the landing hands over (src/fx/controls-card.js)
    if (story) (controlsCard ??= createControlsCard(root, { mobile: mobileShell, briefing: () => (gunshipBriefing ??= createGunshipBriefing(root)).openPaused({ get: () => paused, set: (v) => { paused = v; } }) })).tick(automated() && !pilotMode && !laserStation.seated(), !shotActive() && story.beats.phase() !== 'landed');
    // the chapter, NEXT, SKIP ALL (src/fx/tutorial-card.js)
    if (story && !storyQuery.skip && !showcaseMode) (skipCard ??= createTutorialCard(root, { search: location.search, from: story.chapter?.n ?? 0, skipLanding: () => /^arrival/.test(shotId() ?? '') && (endShot(), true) })).tick(story.beats.phase(), automated() && (!story.grow || !!sectorRun?.active()));
    // THE SHOWCASE: the montage cuts its own shots over this run (src/fx/showcase.js)
    if (showcaseMode) (showcase ??= createShowcase(root, gameHooks.showcase)).tick(dt);
    if (story && automated() && !frozen && !player.won) laserStation.tick(dt);   // SOL-82: the pass clock once online, the seat's hands, the beam
    updateCameraGoal();

    if ((pilotMode && pilot && !pilot.isMap()) || seatGlide.active()) {
      seatGlide.place(camera, camGoal, dt);   /* src/fx/seat-glide.js: exactly on the optic, or easing into it after a hand-over */
    } else {
      camera.position.lerp(camGoal.pos, 0.14);
      camera.quaternion.slerp(camGoal.quat, 0.14);
    }
    if (!pilotMode && flags.viewwatch !== '0') diagOverlay.viewWatch(dt);
    diagOverlay.tick(dt);

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
    scene.backgroundIntensity = sky ? (lab.on ? lab.bgIntensity : SKY_PRESET.intensity) : 1; if (daylight) scene.backgroundIntensity *= 1 - daylight.tick(frozen ? 0 : dt) * (1 - story.day.skyDim);   // the stars fade with the day
    if (simSkip) return; // sim pass: state advanced, nothing painted
    // in PoV the camera sits inside the creature — hide it there
    playerMesh.visible = params.view !== 'pov' && !deploy?.clip && !story?.hull?.held();   // the bay's authored hull rolls out alone (operator, 2026-09-13: two turrets, one static, one sweeping); no hull before the Stålheart issues it
    postfx.render();
    // the seeker feed rides behind a TALON in flight; the gunship's monitor is the ground truth at the impact point; otherwise the
    // optic inset on the tracked target
    storyMonitor?.render(
      renderer,
      scene,
      (pilot?.gunship ? gunshipRig.drop?.mesh() : null) ?? towerSeekers.find((m) => m.pool === talonPool && talonPool && m.by === pilot?.state.tower)?.mesh ?? null,
      cellSide,
      dt,
      pilot?.gunship ? pilot.gunshipOptic() : (pilotMode && pilot?.state.tower && missileOf(pilot.state.tower.key) && pilot.state.tower.pilotTarget && !pilot.state.tower.pilotTarget.pilotAim ? { from: perchOf(pilot.state.tower), pos: pilot.state.tower.pilotTarget.pos } : null),
    );
    radarScope.draw(t); story?.hud.paint(radarCtx, { m: radarCss, cpos: pilot?.state.tower ? graph.centers[pilot.state.tower.ci] : player.pos, up: pilot?.state.tower ? new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).toArray() : player.smoothDir, range: mapMode === 'heart' ? 2.02 : pilotMode ? cellSide * 12 : 1.15, t, mapMode });
    laserStation.render(renderer, scene); programWarm.tick(dt);   /* THE SEAT'S FIRST-USE HITCH (src/fx/program-warm.js): the canvas's own programs are linked two objects a frame, here where nothing is bound, instead of 18 at once under the gunner */
  }

  const radarScope = createRadarScope({ ctx: radarCtx, player, camera, towers, enemies, spawnPoints, strike, poleFrame, graph: () => graph, dungeon: () => dungeon, size: () => radarCss, mapMode: () => mapMode, pilot: () => pilot, pilotMode: () => pilotMode, cellSide: () => cellSide, waveCharge: () => waveCharge });   /* THE SCOPE (src/fx/radar-scope.js), painted before story.hud paints over it */

  const seedOverride = parseInt(flags.seed || '', 10);
  if (Number.isFinite(seedOverride)) params.seed = seedOverride >>> 0; const showcaseMode = showcaseOn(location.search), storyQuery = readStoryQuery(showcaseMode ? '?skip=defence' : location.search), threatMult = storyQuery.threat, storyMode = storyQuery.world === 'story'; root.classList.toggle('story-world', storyMode);   /* the campaign's buttons and key hint stay off in the story (styles.css) */   // tabula rasa past the landing: no old heart, waves, portals, camp or yard
  // THE SECTORS (src/fx/sector-run.js): the story's loop past the handover, fed from the board's real sites
  function makeSectorRun() {
    return createSectorRun({ story, host: root, api: storyApi, waveSize: params.waveSize, threatMult, hardcore: story.hardcore, spawnGap: { spread: SPAWN_SPREAD, max: SPAWN_GAP_MAX }, store: localStorage, rng: () => whim(),
      ready: () => automated() && (story.beats.phase() === 'expedition' || story.handover.stage >= (story.handover.defendStage ?? 8)) && !briefQ && !shotActive() && !syntheticModal?.isOpen() && !paused, firstSector: storyQuery.firstSector,   /* SKIP TUTORIAL opens the run at the back-door sector: its collapse and breach are the first thing the player sees */
      centers: () => graph.centers, cellSide: () => cellSide, enemies: () => enemies, queue: () => spawnQueue, bank: () => eco.biomass, reload: () => location.reload(),
      // the ring the gunship's far breach walks: a minute out
      field: () => ({
        cellSide,
        centers: graph.centers,
        dist: bfsDist(graph.adj, [dungeon.heart], (ci) => dungeon.tags[ci] !== BLOCKED),
        inside: (ci) => story.inside(ci),
        // hops from the clearing over any ground, rock or not: a breach's blast carves rock. Once per world: the clearing never
        // changes
        rim: (story.rimHops ??= (() => { const seeds = []; for (let ci = 0; ci < graph.centers.length; ci++) if (story.inside(ci)) seeds.push(ci); return bfsDist(graph.adj, seeds, () => true); })()),
        excluded: [...sealedBreachCells, ...spawnPoints.filter((s) => s.alive).map((s) => s.ci)],
        farHops: GUNSHIP_FAR.hops,
        fallback: () => gunshipRig.far(),
      }),
      open: (ci, o) => storyApi.breach(ci, o), collapse: (sp) => killPortal(sp, 'exhausted'), queued: (sp) => spawnQueue.some((q) => q.sp === sp),
      push: (list) => { for (const q of list) spawnQueue.push({ ...q, at: spawnClock + q.at }); spawnQueue.sort((a, b) => a.at - b.at); },
      clearField: () => { for (const e of enemies) if (e.alive && !e.guard) killCreature(e, false); for (let i = spawnQueue.length - 1; i >= 0; i--) if (!spawnQueue[i].guard) spawnQueue.splice(i, 1); updateHud(); },
      seal: (sp, by) => { if (by === 'strike' || by === 'gunship') executeStrike(sp.ci, t, by === 'gunship' ? 'gunship.heavy' : 'strike.orbital'); else if (by === 'shells') for (let k = 0; k < 3 && sp.alive; k++) gateTakesShell(sp); else killPortal(sp, by); },   /* the real seal paths, for the acceptance hooks */
      pay: ({ kg, points }) => { eco.addBiomass(kg, { category: 'sector-held' }); score.addBonus(points); persistBest(); updateHud(); },
      brief: (id) => showBrief(id), callout: (text, cls) => showCallout(text, cls), sfx: (name) => sfx.play(name, { dist: 0 }), hud: () => updateHud(), pause: (on) => { paused = on; },
      refill: () => refillArrays(), breaches: () => spawnPoints.filter((sp) => sp.alive && sp.obj?.userData.breach), calm: () => { if (gunshipBriefing?.due()) gunshipBriefing.openPaused({ get: () => paused, set: (v) => { paused = v; } }); },   /* every live sinkhole, the sector's own and strays; the gunship briefing put off mid-fight */
      poll: () => ({ passes: gunship.passes, shieldUp: shieldUp(), drawn: arrayStation.drawn ?? 0, earned: eco.earned, spent: eco.spent, delivered: (story.expeditions?.sites ?? []).filter((s) => s.state === 'delivered').map((s) => s.id), laser: laserStation.stats?.() ?? null }),   /* SOL-82's books: { passes, seconds } */
    });
  }
  const storyApi = {
    // ISAO GOES TO WORK AT ONCE (owner, 2026-09-14): he tends the foundry from its deploy until the first print order
    // the arrival recycled: the beat's events become the swap, the clip, the arc, the cut and the barrels
    foundry: (ev, d) => { (foundryFx ??= createFoundryFx(scene, () => storyBase, { cellSide, metresPerCell: 10 })).event(ev, d); if (ev === 'deploy') { const fh = storyBase?.structure('foundry')?.holder; if (fh) { const at = norm3(fh.getWorldPosition(new THREE.Vector3()).toArray()); if (isao) isao.assistAt = at; else if (story) story.assistAt = at; } } },
    order: (key, ci) => orderTower(key, ci, { quiet: true }),
    grant: (n) => { if (n > 0) eco.addBiomass(n, { category: 'grant' }); },
    built: (ci) => towerByCell.has(ci),
    cost: (key) => TOWER_BY_KEY[key]?.cost ?? 0,
    isao: () => !!isao,
    // a queued spawn is already an enemy to the beats: the second hard core sat in the queue the tick the first died, and the
    // Quiver beat settled with it still to come
    enemies: () => enemies.filter((e) => e.alive && !e.guard).length + spawnQueue.filter((q) => !q.guard).length,   // the site guards are not the beats' business
    spawn: (type, ci, o = null) => { spawnQueue.push({ type, sp: o?.guard || o?.here ? { ci, alive: true, obj: new THREE.Group() } : story?.source ?? { ci, alive: true, obj: new THREE.Group() }, at: spawnClock, ...o }); },
    brief: (id) => showBrief(id),
    tremor: (ci) => story?.hud.tremor(ci >= 0 ? norm3(graph.centers[ci]) : null),
    // the sinkhole is a spawn point: an orbital strike on it fills it like any other (operator, 2026-09-13)
    breach: (ci, o) => { const obj = buildPortalObj(ci, 0); obj.userData.quiet = !!o?.quiet; obj.userData.clear = o?.clear; obj.userData.keep = !!o?.keep; scene.add(obj); const sp = { ci, alive: true, obj, hp: 3, found: true }; if (!story.source?.alive) story.source = sp; spawnPoints.push(sp); return sp; },
    sourceAlive: () => !!story.source?.alive,
    briefing: () => !!briefQ,
    screenOpen: () => !!syntheticModal?.isOpen(),
    // FACE ON (the first framing sat between his legs and the rocket): in front of the LED panel along his own forward, a
    // drone-size or two out, the queued line cleared so his first line is the first thing on the panel
    closeup: () => { if (!isao) return; viewWas = { view: params.view, seat: storyViews?.now() }; leavePilot(); storyViews?.active('tank'); clearBriefs(); startShot({ id: 'isaoTalk', dur: 9, poseAt: (u, out) => poseCamera(isaoFace(isao.obj.position.toArray(), isao.dir, isao.obj.getWorldDirection(new THREE.Vector3()).toArray(), isao.obj.scale.x, u), out) }); },
    sites: () => story.hud.sites(story.sites.map((ci) => norm3(graph.centers[ci]))),
    planetView: () => { if (!story.sites.length) return; endShot(); if (storyViews) storyViews.back(viewWas, setView); else setView('third'); snapCamera(); },   /* STRAIGHT BACK TO THE TANK (owner, 2026-10-07: "too many cuts"): no orbit pull-back over the sites, no swoop */
    near: (ci, r = 2.2) => enemies.some((e) => e.alive && chord(e.pos, graph.centers[ci]) < cellSide * r),
    kills: () => rs.bySrc.tank + rs.bySrc.tower + rs.bySrc.strike,
    screen: (id) => { if (id !== 'synthetic') return; syntheticModal ??= createSyntheticModal(root); const was = paused; paused = true; syntheticModal.open(BRIEFS.vibration_study.lines, () => { paused = was; }); },
    pilot: (ci, laneCi) => {
      if (pilot?.gunship || laserStation.seated()) return;   // a scripted hand-over never evicts a gunner or SOL-82: the beat is deferred, not the player (2026-09-23)
      const seat = pilotMode, from = { pos: camera.position.clone(), quat: camera.quaternion.clone() }, perch = perchOf(towerByCell.get(ci) ?? { ci }), lit = seat ? highlightSeat(scene, perch, graph.normals[ci], cellSide) : null;   // from one seat to the next: back out, the next one lit (owner, 2026-10-02)
      seatGlide.begin(camera); enterPilot([ci, ...towers.map((t) => t.ci).filter((c) => c !== ci)]); showCallout(`${(TOWER_BY_KEY[towerByCell.get(ci)?.key]?.label ?? 'sentry').replace(/^\d+\.\s*/, '').toUpperCase()} MANUAL OVERRIDE!`, 'co-cta');   // the call to action, red, front and centre (owner, 2026-10-03)
      // the shot at the open lens, the new optic's zoom only once it lands (owner, 2026-10-03: the zoom carried between views)
      startShot({ id: 'takeControl', dur: seat ? 5.6 : 4, poseAt: takeControlPose(perch, graph.normals[ci], graph.centers[laneCi >= 0 ? laneCi : ci], cellSide, params.wallHeight, from, 0.3, !seat), onEnd: () => { lit?.(); seatGlide.begin(camera); setView('bastion'); pilotHost?.zoom(pilot?.state.zoom ?? 1); } }); camera.fov = seatBase?.fov ?? 68; camera.updateProjectionMatrix();
    },
  };
  // THE STORY'S TICK AND ITS NEIGHBOURS (the refactor run, 2026-10-07): what was src/fx/programme-host.js's whole build() is a module
  // per subject, each with its own literal; storyApi.build below runs them in the order the one build() did
  // THE BLACK HOLE AND THE NEBULAE (src/fx/sky-rig.js): hung once here, aimed behind the Stålheart once per world
  const skyRig = createSkyRig({
    scene,
    storyBase: () => storyBase,
    dungeon: () => dungeon,
    graph: () => graph,
  });
  // ISAO'S MOMENTS (src/fx/isao-moments.js): his lines on the heart's threat and in the quiet; danger, engaged, hopsToHeart
  const isaoMoments = createIsaoMoments({
    laserStation,
    story: () => story,
    dungeon: () => dungeon,
    t: () => t,
    enemies: () => enemies,
    pilot: () => pilot,
    playerPos: () => player.pos,
    cellSide: () => cellSide,
  });
  // THE COLONY'S TICK (src/fx/colony-tick.js): the reel, the lapse, the perks, the pads, the boards, the beacons, the works
  const colonyTick = createColonyTick({
    PLAYER_MAX,
    showBrief,
    updateHud,
    syncLifeContainers,
    scene,
    renderer,
    sfx,
    laserStation,
    ammoMax: AMMO_MAX,
    story: () => story,
    t: () => t,
    graph: () => graph,
    dungeon: () => dungeon,
    cellSide: () => cellSide,
    playerHP: () => playerHP,
    playerPos: () => player.pos,
    pilotMode: () => pilotMode,
    briefQ: () => briefQ,
    storyBase: () => storyBase,
    sectorRun: () => sectorRun,
    shotId,
    eco: () => eco,
    ammo: () => ammo,
    kills: () => rs?.bySrc ?? {},
    rank: () => tankRank,
    hands: () => tankKills,
    combo: () => rs?.maxCombo ?? 0,
    hull: () => playerMesh,
    setPlayerHP: (v) => { playerHP = v; },
    setAmmo: (v) => { ammo = v; },
    pause: (on) => { paused = on; },
  });
  // THE FIRE SUPPORT ON AUTO (src/fx/auto-support.js): the gunship flying itself, Isao's missile, the envelope
  const autoSupport = createAutoSupport({
    showBrief,
    updateHud,
    gunshipRig,
    camera,
    sfx,
    scene,
    laserStation,
    explode: (u, p) => explode(u, p),
    kill: (e, src) => (e.alive ? (damageEnemy(e, t, e.hp + 1, true, src), true) : false),   // the colony's hands
    callout: (x, k) => showCallout(x, k),
    story: () => story,
    pilot: () => pilot,
    pilotMode: () => pilotMode,
    briefQ: () => briefQ,
    cellSide: () => cellSide,
    graph: () => graph,
    storyBase: () => storyBase,
    dungeon: () => dungeon,
    playerPos: () => player.pos,
    playerHP: () => playerHP,
    isao: () => isao,
    enemies: () => enemies,
    sectorRun: () => sectorRun,
  });
  // THE CANYON AND THE SIDE BREACH (src/fx/canyon-run.js)
  const canyonRun = createCanyonRun({
    breachQueue,
    breachedCells,
    rebuildAfterBreach,
    recomputePortalDist,
    breachWallCell,
    laserStation,
    story: () => story,
    dungeon: () => dungeon,
    graph: () => graph,
    cellSide: () => cellSide,
    tdFullTags: () => tdFullTags,
    storyBase: () => storyBase,
  });
  // THE ENDING (src/fx/ending-host.js): the finale; story, startShot, scene, cellSide, hull, isao and spawnIsao are the diorama's
  const endingHost = createEndingHost({
    storyBase: () => storyBase,
    map: () => [floorMesh, wallMesh, edgeMesh, topMesh],
    dungeon: () => dungeon,
    graph: () => graph,
    pause: (on) => { paused = on; },
    hud: root,
    sfx,
    story: () => story,
    startShot,
    scene,
    cellSide: () => cellSide,
    hull: () => playerMesh,
    isao: () => isao,
    spawnIsao,
  });
  // ISAO KEEPS BUILDING (src/fx/programme-host.js): perks, hasPerk, tankReady, the programme's part of the tick, repaired, printed
  const programme = createProgrammeHost({
    orders,
    breachQueue,
    breachedCells,
    gunshipRig,
    showBrief,
    spawnIsao,
    updateHud,
    rebuildAfterBreach,
    recomputePortalDist,
    adoptBays,
    laserStation,
    startShot,
    sfx,
    callout: (x, k) => showCallout(x, k),
    danger: isaoMoments.danger,
    hullHost: makeHullHost,
    story: () => story,
    sectorRun: () => sectorRun,
    waveActive: () => waveActive,
    dungeon: () => dungeon,
    tdFullTags: () => tdFullTags,
    storyBase: () => storyBase,
    pilotMode: () => pilotMode,
    briefQ: () => briefQ,
    graph: () => graph,
    cellSide: () => cellSide,
    enemies: () => enemies,
    t: () => t,
    storyViews: () => storyViews,
    setBerths: (v) => { berths = v; },
  });
  // THE FIRST MÖRK'S HOST (src/fx/hull-issue.js createHullHost): one per story, made when the programme first asks for it
  function makeHullHost() {
    return createHullHost({
      laserStation,
      shotId,
      showBrief,
      deployStart,
      deployStep,
      leavePilot,
      camera,
      startShot,
      deployFramePoseFor,
      camA,
      setView,
      story: () => story,
      pilot: () => pilot,
      deploy: () => deploy,
      t: () => t,
      playerHP: () => playerHP,
      storyViews: () => storyViews,
      setBerths: (v) => { berths = v; },
      setPlayerDown: (v) => { playerDown = v; },
      setDeploy: (v) => { deploy = v; },
      glide: () => seatGlide.begin(camera),
      hud: root,
    });
  }
  Object.assign(storyApi, {
    // SECTOR 0 (src/domain/story-beats.js construction): the Stålheart stands once its first hull is out; the gunship comes on
    // station from orbit for a free pass
    stalheartStands: () => !!story?.hull?.out(),
    gunshipArrive: () => { if (!story) return; story.gunshipIn = true; startStation(gunship, GUNSHIP_ORBIT); showBrief('gunship_overhead'); }, camera, startShot, snapCamera, sfx, drone: () => isao,
    mission: () => (isaoSay(sfx, 'mission'), showMission(root, STORY_MISSION)), touring: () => !story?.arrival.done() || shotId() === 'sitesTour',
    freeLook: () => { const done = (glide) => { setView('orbit'); centerBuildOnHeart(); followSuspend = true; buildDist = 1.65; if (!glide) snapCamera(); }, pts = (story?.sites ?? []).slice(0, 3).map((ci) => graph.centers[ci]);   // THE TOUR OF THE LANDERS (src/domain/story-shots.js tourFrame), live: the beats run under it and the override cuts in
      if (!pts.length) return done(); const from = { pos: camera.position.clone(), quat: camera.quaternion.clone() }, dur = tourSeconds(pts.length);
      startShot({ id: 'sitesTour', dur, poseAt: (u, out) => { poseCamera(tourFrame(u, graph.centers[dungeon.heart], pts), out); const k = Math.min(1, u * dur / 1.6), e = k * k * (3 - 2 * k); out.pos.lerpVectors(from.pos, out.pos, e); out.quat.slerpQuaternions(from.quat, out.quat.clone(), e); }, onEnd: () => done(1) }); },   // out of the close-up without a cut (2026-10-03)   /* THE ARRIVAL's hands (src/fx/arrival.js); freeLook: the landing hands over to the free camera */
  },
  // ISAO KEEPS BUILDING and the story's tick (src/fx/programme-host.js and its neighbours above): storyApi's members as they were
  {
    perks: programme.perks,
    hasPerk: programme.hasPerk,
    nukes: autoSupport.nukes,
    danger: isaoMoments.danger,
    engaged: isaoMoments.engaged,
    tankReady: programme.tankReady,
    // THE STORY'S TICK, once per unfrozen frame, in the order programme-host's build() ran it: the sky, Isao's moments, the colony's
    // opening props, the first hull, the colony's perks, the fire support, the colony's works, then at most one order for Isao
    build: () => {
      skyRig.tick();
      isaoMoments.tick();
      const f = colonyTick.open();
      // THE FIRST MÖRK ROLLS OUT OF THE STÅLHEART (src/fx/hull-issue.js): the camera runs to the door's framing with the hull
      // standing under the gantry, then it drives out as any deploy does; under a gunner it is set down outside the door
      story.hull?.tick(story.hullHost ??= makeHullHost());
      colonyTick.perks(f);
      autoSupport.tick(f);
      colonyTick.works(f);
      programme.build(f);
    },
    sideBreachCandidates: canyonRun.sideBreachCandidates,
    canyonPlan: canyonRun.canyonPlan,
    canyonPass: canyonRun.canyonPass,
    canyonOver: canyonRun.canyonOver,
    hopsToHeart: isaoMoments.hopsToHeart,
    canyonCut: canyonRun.canyonCut,
    breakSide: canyonRun.breakSide,
    repaired: programme.repaired,
    printed: programme.printed,
    interlude: endingHost.interlude,
    finale: endingHost.finale,
    tier: autoSupport.tier,
    aliveBudget: autoSupport.aliveBudget,
    swell: autoSupport.swell,
    gunshipAuto: autoSupport.gunshipAuto,
    colony: colonyTick.colony,
  },
  // THE EXPEDITIONS (src/fx/expedition-glue.js): expeditions, expeditionsBegin, expeditionStep
  createExpeditionsHost({
    storyApi, scene, sfx, SOUNDS, BREACH_SOUNDS, STORY_SOUNDS, player, enemies, spawnQueue, orders, showBrief, showCallout, showTowerToast, spawnIsao, updateHud,
    story: () => story, graph: () => graph, cellSide: () => cellSide, playerMesh: () => playerMesh, storyBase: () => storyBase, cellIndex: () => cellIndex, open: (ci) => dungeon.tags[ci] !== BLOCKED,
  }),
  // THE VIEW STRIP (src/fx/story-views.js): unlock
  createUnlockHost({
    root, towers, gunship, gunshipRig, automated, enterPilot, leavePilot, setView, showBrief, snapCamera,
    view: () => params.view, story: () => story, storyViews: () => storyViews, pilot: () => pilot, pilotMode: () => pilotMode, pilotHost: () => pilotHost, sectorRun: () => sectorRun, gunshipBriefing: () => gunshipBriefing, paused: () => paused,
    setStoryViews: (v) => (storyViews = v), setGunshipBriefing: (v) => (gunshipBriefing = v), setPaused: (v) => { paused = v; },
  }));
  Object.assign(storyApi, createBackDoor({ storyApi, sfx, explode, showBrief, camDist, showCallout, warnRing, breachWallCell, rebuildAfterBreach, recomputePortalDist, shotActive, camera, startShot, story: () => story, graph: () => graph, dungeon: () => dungeon, cellSide: () => cellSide, paused: () => paused, deploy: () => deploy, pilotMode: () => pilotMode, pilot: () => pilot }));   /* THE SECOND FRONT (src/fx/back-door.js) */
  // THE SIM RUN'S END (src/platform/sim-run.js): simWatch, which the fast-forward calls after each batch, and the result it publishes
  const { simWatch } = createSimRun({
    player, params, towers, simCurve, campaign, endShot, breachNextSector, setView, SECTORS_TOTAL,
    simDone: () => simDone, heartHP: () => heartHP, playerHP: () => playerHP, round: () => round, wave: () => wave, t: () => t, simCap: () => simCap, simStyle: () => simStyle, score: () => score, eco: () => eco, ecoClockT: () => ecoClockT, ecoAffordT: () => ecoAffordT,
    setSimDone: (v) => { simDone = v; },
  });
  const simParam = flags.sim;
  storyApi.setLaserOnline = (on) => laserStation.setOnline(on);   // the sectors switch SOL-82 on (V1 design: sector 2)
  if (simParam) {
    simStyle = simParam;
    simFast = Math.max(1, Math.min(120, parseInt(flags.simfast || '50', 10)));
    simCap = Math.max(30, parseInt(flags.simcap || '600', 10));
    console.log(`SIMBOOT style=${simStyle} fast=${simFast} cap=${simCap}`);
    postfx.setEnabled(false);   // bare-minimum paint: no bloom chain
    sfx.setMute(true);          // 50x audio is a fire alarm
    document.body.classList.add('simming');
  }
  if (flags.callouts === '0') params.callouts = false;
  syncCalloutMode();
  const heartOverride = flags.heart ?? (storyQuery.short || storyMode ? 'none' : null);   // the story world always has the empty heart: its base owns the Stalheart
  if (HEART_LOOKS[heartOverride]) params.heartLook = heartOverride;
  const lookOverride = flags.look;
  if (LOOKS[lookOverride]) params.look = lookOverride;
  const wtOverride = flags.walltops;
  if (['bright', 'dim', 'black'].includes(wtOverride)) params.wallTops = wtOverride;
  const creatureOverride = flags.creature;
  if (UNITS[creatureOverride]) params.creature = creatureOverride;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());

  regenerate();
  applyLook();
  // a unit whose model loads asynchronously needs its bytes kicked off; it
  // draws nothing until they arrive
  if (params.creature === 'mork') applyCreature();

  openStoryAt(storyQuery, story, { printed: storyApi.printed, commitTower, setBerths: (v) => { berths = v; }, expeditions: storyApi.expeditions, grant: (n) => eco.addBiomass(n, { category: 'grant' }), fillRack: () => { shield.rack = shieldTune.rackCap; }, refillArrays, showBrief });   /* src/fx/story-entry.js */

  // PRELOAD THE LOOK AT BOOT. applyTowerLook() was reachable only from the
  // panel, so a board whose DEFAULT look has async
  // assets never started the load at all: every tower built came up as the
  // loading marker and nothing ever rebuilt it. Harmless while the default
  // was procedural; required for authored models.
  applyTowerLook();

  // ?blast=N breaches the N wall cells nearest the player — exercises the
  // carve + debris + rebuild path without needing a live shot
  const blastN = parseInt(flags.blast || '0', 10);
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

  // ?brief=<id> plays one of Isao's beats on demand, ignoring the once-only
  // memory — otherwise a beat can be looked at exactly once per browser,
  // ever, which is not a thing you can iterate on
  const briefQ2 = flags.brief;
  if (briefQ2) {
    const i = briefSeen.indexOf(briefQ2);
    if (i >= 0) briefSeen.splice(i, 1);
    setTimeout(() => showBrief(briefQ2), 500);
  }

  const debugging = pilotMode || ['blast', 'laser', 'mode', 'brief', 'layout', 'sim']
    .some((k) => flags[k]);
  // the campaign board opens on the briefing; the story and every debug hook go straight to the game (a frozen sim would break a headless run)
  deployStart(berthIndexFor(playerHP));
  if (!storyMode && !debugging) showBriefing();

  perfCtl = gui.add({ get on() { return perfOverlay.on(); }, set on(v) { setPerfOverlay(v); } }, 'on').name('fps readout (`)');   /* a root control, so the VARS modal puts it on the game page */
  buildVarsModal({ root, gui, lab, flags, skySeed, applySky, spawnWave, postfx, setPerfOverlay, gpuExt });   /* THE VARIABLES MODAL and its lab page (src/fx/vars-modal.js) */
  {
    let saved = null;
    try { saved = localStorage.getItem(PERF_KEY); } catch { /* fine */ }
    if (flags.fps === '1' || (flags.fps !== '0' && (saved === '1' || saved === null))) setPerfOverlay(true,false);   /* off for players; on when turned on (backtick, DEV · Frame readout) and for the acceptance runs that read it */
    if (flags.fps === '1') {
      console.log(`PERFOVERLAY on=${perfOverlay.on()} el=${!!perfEl}`
        + ` hidden=${perfEl ? perfEl.classList.contains('hidden') : '?'}`
        + ` text="${perfEl ? perfEl.textContent : ''}"`);
    }
  }

  // ?layout=N — after N seconds, print the on-screen box of every HUD piece
  // and every overlap between them. A screenshot cannot be trusted for this:
  // headless will not lay out below ~500px, it lays out wide and CROPS, so a
  // phone-sized picture shows phone-sized pixels of a tablet-sized layout.
  // Rectangles do not lie.
  const layoutAt = parseFloat(flags.layout || '0');
  if (layoutAt > 0) {
    setTimeout(() => {
      // the sheets are certainly loaded by now, which they were not at init —
      // measure the PHONE's rules, not the desktop ones that were standing in
      // for them
      const flipped = simulateCoarse();
      if (flipped) console.log(`COARSE simulated at measure: ${flipped} media blocks now apply`);
    }, Math.max(0, layoutAt * 1000 - 1200));
    setTimeout(() => {
      const want = {
        // scoped to THIS tab: the sibling tabs carry the same classes, and
        // querySelector was returning a hidden tab's copy and skipping it
        menu: '#shell-bar', modes: '#tab-td .tc-util', hud: '#td-stats',
        map: '#tab-td .minimap', tut: '#td-tut', throttle: '#td-throttle',
        steerL: '#td-pad-left', steerR: '#td-pad-right',
        fire: '#td-pad-fire', laser: '#td-pad-laser',
        shield: '#td-pad-shield',   // a pad the ruler cannot see is a pad nobody checked
        launch: '#td-launch', next: '#td-next', card: '#td-sitrep',
        // the two number slots, which only leave the centre when the
        // encouragement is switched off — and are exactly the pair most
        // likely to land on the HUD when they move
        shout: '#td-callouts', combo: '#td-combo',
        // the shell's pieces, and the two captions
        mode: '#mob-mode', brief: '#td-brief', toast: '#td-toast',
        tabbar: '#shell-nav',   // the navigation drawer: closed during play, never over the board
        wave: '#td-wave', tower: '#td-tower',   // the announcement cards
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
      const clashes = boxOverlaps(box).map((c) => console.log(`LAYOUT OVERLAP ${c.a} x ${c.b} — ${Math.round(c.x)}x${Math.round(c.y)}px`)).length;   /* src/domain/box-overlaps.js */
      console.log(`LAYOUT viewport ${innerWidth}x${innerHeight}`
        + ` coarse=${matchMedia('(pointer: coarse)').matches}`
        + `${flags.coarse === '1' ? ' (SIMULATED)' : ''}`
        + ` dpr=${devicePixelRatio} — ${clashes} overlaps`);
    }, layoutAt * 1000);
  }

  // ?stateprobe=1 — the boot, as a log: every 2 s for 24 s, what state the
  // game is in. For "it starts and I cannot move" reports, where the
  // question is WHICH thing is holding the tank — a pause, a shot, a deploy
  // that never ends, a death loop — and a screenshot cannot say.
  if (flags.stateprobe === '1') {
    // on the shell the line also goes to the caption lane: a phone has no
    // console, and the fact that decides a "the tank is not in view" report
    // (the tank's screen-y, the visual viewport vs the canvas) is only
    // measurable THERE
    const onScreen = (txt) => { if (mobileShell && toastEl) { toastEl.innerHTML = diagOverlay.html(txt); toastEl.classList.remove('hidden'); } };
    const line = (k) => {
      const cp = camera.position;
      const ndc = new THREE.Vector3(...player.pos).project(camera);
      const vv = window.visualViewport;
      const extra = `tankScreen=(${ndc.x.toFixed(2)},${ndc.y.toFixed(2)}) canvas=${renderer.domElement.width}x${renderer.domElement.height}`
        + ` inner=${innerWidth}x${innerHeight} visual=${viewportLine(vv)}`
        + ` dpr=${devicePixelRatio} view=${params.view} camToTank=${(cp.distanceTo(new THREE.Vector3(...player.pos)) / cellSide).toFixed(1)}c`
        + ` thr=${throttle.toFixed(2)} stick=${!!stick} laser=${keys.laser}`;
      onScreen(`t=${k * 2}s ${extra}`);
      console.log(`STATE t=${(k * 2).toString().padStart(2)}s paused=${paused} shot=${shotId() || '-'} build=${buildMode}`
        + ` msg=${!!(msgEl && !msgEl.classList.contains('hidden'))} brief=${!!(briefEl && !briefEl.classList.contains('hidden'))} sitrep=${!!(sitrepEl && !sitrepEl.classList.contains('hidden'))}`
        + ` deploy=${deploy ? `#${deploy.n}@${deployProgress().toFixed(2)}` : '-'}`
        + ` hp=${playerHP} lostDeploys=${tankLostDeploys} down=${!!playerDown}`
        + ` cur=${player.cur}(${dungeon.tags[player.cur] === BLOCKED ? 'BLOCKED' : 'open'}) next=${player.next}`
        + ` auto=${autoMode} thr=${throttle.toFixed(2)} goto=${gotoCi} view=${params.view} unit=${params.creature}`
        + ` camToTank=${(cp.distanceTo(new THREE.Vector3(...player.pos)) / cellSide).toFixed(1)}cells`
        + ` tankVisible=${!!(playerMesh && playerMesh.visible)} inFrustum=${(() => { const f = new THREE.Frustum(); camera.updateMatrixWorld(); f.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); return f.containsPoint(new THREE.Vector3(...player.pos)); })()} ${extra}`);
    };
    // 30 lines was the boot; the tutorial's handoff is past 60 s, so 70
    for (let k = 0; k <= 70; k++) setTimeout(() => line(k), k * 2000);
  }

  // EVERY SHIELD_TUNE KNOB BY NAME — ?tapOutage=8, ?coolSecs=3, ?shoveCells=1.4.
  // The same door SENTRY_TUNE and BALLISTICS_TUNE already use, rather than a
  // tuner panel invented for this one feature. The knob table carries the
  // range and the value is CLAMPED to it: a URL is untrusted input like any
  // other, including our own from a stale bookmark.
  for (const k of SHIELD_KNOBS) {
    const raw = flags.shield[k.key];
    if (raw === null) continue;
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) continue;
    shieldTune[k.key] = Math.min(k.max, Math.max(k.min, v));
  }
  // the rack and the pad budget were sized from the tune at construction, so
  // they have to be re-read after an override
  shield.rack = Math.min(shieldTune.rackCap, shieldTune.rackStart);
  shield.stationLeft = shieldTune.stationBudget;

  // ?keyprobe=1 — WHICH KEY DOES WHAT, with REAL events. The shield was bound
  // to S, which is REVERSE: `s` sits in CTL_DRIVE_KEYS beside w/a/d, so every
  // time the player backed up they also spent a charge. A grep for `k === 's'`
  // found nothing and said the key was free — the drive keys are read through
  // a map, not a literal, so the search asked the wrong question entirely.
  //
  // This dispatches actual KeyboardEvents and reports what moved, which is the
  // only check that could have caught it: a binding conflict is invisible to
  // source search and obvious to a keypress.
  if (flags.keyprobe === '1') {
    setTimeout(() => {
      for (const id of ['#td-msg']) {
        const el = root.querySelector(id);
        if (el) el.classList.add('hidden');
      }
      paused = false;
      shots.drop();
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

  // Browser acceptance adapter, available only when explicitly requested.
  // Tests use the real commands/transitions, and inspect serializable state.
  const gameHooks = {
      state: () => ({
        enemyTypes: [...new Set(enemies.filter((e) => e.alive).map((e) => e.type))].sort(),
        explosions: explosions.state(),
        pilotRounds: rs?.pilotRounds ?? 0,
        pilotHits: rs?.pilotHits ?? 0,
        pilotTracerGap: rs?.pilotGap ?? null,   // metres, tracer head to impact, widest; null until one lands
        gunship: gunshipRig.probe(),
        shot:shotId(), view:params.view,
        breachRubble:gameBreaches.rubbleState(),
        breaches:gameBreaches.state(),
        queued:spawnQueue.length,
        wallCount:dungeon.tags.filter(tag=>tag===BLOCKED).length,
        emerging:enemies.filter(e=>e.alive&&!e.guard&&e.emergeAge<1.2).length,
        round,
        wave,
        runGen: runContext.generation,
        heart: heartHP,
        hulls: playerHP,
        biomass: eco.biomass,
        towers: towers.length,
        won: player.won,
        paused,
        roster: ROSTER.id,
        buildMode,
        expeditions: story?.expeditions ?? null,
        cargo: story?.glue?.state() ?? null,
        unlocked: automated() ? unlockedTowers(story.expeditions, STORY_EXPEDITIONS.base) : null,
        storyHome: story?.home ?? -1,
        story: story?.beats.state() ?? null, arrival: story?.arrival.state() ?? null, integrity: integrityHud?.state() ?? null, glide: seatGlide.state(), kicks: kick.n ?? 0,
        hull: story?.hull ? { ...story.hull.state(), visible: !!playerMesh?.visible, tankButton: (() => { const b = document.querySelector('#story-views [data-view="tank"]'); return b ? !b.hidden : null; })() } : null,
        automated: automated(),
        gunshipCall: { ...gunshipRig.call },
        storyHud: story?.hud.state() ?? null,
        enemyRecords: enemies.length, loopVoices: sfx.activeVoices.filter((v) => v.loop).map((v) => v.key),
        enemiesAlive: enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0),
        killsBySrc: { ...rs.bySrc },
        storyLod: storyBase?.lod() ?? null,
        storyBaseErrors: storyBase?.errors.slice() ?? null,
        programme: story?.programme ? {
          ...programmeSnapshot(story.programme), grow: !!story.grow, print: story.print.state(), gate: storyBase?.gate() ?? null, colony: storyApi.colony?.() ?? null, ammo,
          gates: storyBase?.gateList() ?? null, backSockets: (story.backSockets ?? []).map((sk) => sk.cell),
          broke: programmeHas(story.programme, 'gate') ? (story.wallCells ?? []).filter((wc) => dungeon.tags[wc] !== BLOCKED).length : 0,
          repairing: orders.find((o) => o.kind === 'repair')?.repair ?? null, repairBed: !!orders.find((o) => o.kind === 'repair')?.bed,
          isao: isao ? { state: isao.state, order: isao.order?.kind ?? null, printK: isao.dur ? +Math.min(1, isao.t / isao.dur).toFixed(3) : 0 } : null,
          perks: [...storyApi.perks()],
        } : null,
        towerCells: towers.map((t) => [t.key, t.ci]),
        insideEnemies: story ? enemies.filter((e) => e.alive && story.inside(e.cur)).length : 0,
        playerAsset: playerMesh?.userData.asset || params.creature,
        // the hull's true size over its scale: exploded geometry reads absurd here
        playerSpan: (() => { if (!playerMesh) return null; const b = new THREE.Box3().setFromObject(playerMesh); return Number.isFinite(b.max.x) ? +(b.getSize(new THREE.Vector3()).length() / (unitScale || 1)).toFixed(2) : null; })(),
        sector: sectorRun ? { ...sectorRun.state(), sockets: Object.keys(story?.socketToward ?? {}).map(Number) } : null,
        playerAssetReady: !playerMesh?.userData.loading,
        skip: { on: !!storyQuery.skip, chapter: story?.chapter?.id ?? null, offer: skipCard?.state() ?? null },   // SKIP TUTORIAL: whether this run is the skipped entry, and whether the offer still stands
        playerModelStats: playerMesh?.userData.modelStats,
        berthAssets:lifeContainers.flatMap(c=>c.tanks.map(t=>t.userData.asset)),
        bays: lifeContainers.map((c) => ({ ci: c.ci, hasTank: c.tanks.length > 0, racked: !!c.tanks[0]?.visible })),
        berthCells: berths.map((b) => b.ci),
        kills: rs.bySrc.tank + rs.bySrc.tower + rs.bySrc.strike,
        monitorShown: storyMonitor?.shown() ?? 0,
        screenOpen: !!syntheticModal?.isOpen(),
        screensOpened: syntheticModal?.opened() ?? 0,
        brassLive: brass?.live() ?? 0,
        daylight: daylight?.state() ?? null,
        heartAsset: heartSprite?.userData.asset || params.heartLook,
        laser: laserStation.state(),
        heartAssetState: heartSprite?.userData.assetState,
        performance:perfOverlay.sample(),
        programs:renderer.info.programs?.length??-1,
        warm:programWarm.state(),
        shieldClock:t,
        motionClock:runContext.time,
        shield:{seconds:shield.t,rack:shield.rack,cooldown:Math.max(0,shield.coolUntil-t),drops:shieldDrops,visible:shieldObj?.visible,active:shieldUp(),cooling:t<shield.coolUntil,rackFill:shield.rackFill,arrayReserve:arrayStation.reserve,charging:arrayStation.charging,arrayDrawn:arrayStation.drawn,arrayPad:story?.arrayPad??null,ring:arrayRing?{visible:arrayRing.visible,opacity:arrayRing.material.opacity}:null},
        ram:{combo:ramCombo,rams:rs.rams,best:rs.maxCombo,biomass:eco.biomass,points:score.points,float:ramFloat.state()},
        foes:enemies.filter(e=>e.alive&&!(e.emergeAge<1.2)).map(e=>[e.cur,e.spec.rammable?1:0]),
        cannonHeat,
        ammo,
        cannonColor:playerMesh?.userData.heatSleeve?.material.color.getHex(),
        engagement:towers.filter(tw=>missileOf(tw.key)).map(tw=>({key:tw.key,config:engagementConfig(tw),
          target:tw.missileTarget?.id??null,lock:tw.lock,aim:tw.aimErr,cooldown:tw.cooldown,
          ammo:tw.a6?.ammo,fired:tw.a6?.fired,trips:tw.a6?.trips,walkerState:tw.a6?.state})),
        missileReady:!!missilePool,
        missilePool:missilePool?.stats(),
        seekerHits,
        seekerLost,
        missiles:towerSeekers.map(m=>({key:m.by.key,config:m.config,t:m.t,name:m.mesh.name,
          position:m.mesh.position.toArray(),ignition:m.mesh.getObjectByName('EXHAUST_FX').visible})),
        drawCalls: renderer.info.render.calls,
        playerPosition: player.pos.slice(),
        playerCell: player.cur,
        deploying: !!deploy,
        deployBerth: deploy ? deploy.n : -1,
        rollingOut: !!deploy?.clip,
        playerBlocked: freeBlocked(player.pos),
        camp: berths.map(b => ({ ...b, open: dungeon.tags[b.ci] !== BLOCKED && dungeon.tags[b.exit] !== BLOCKED,
          clearance: dist3(graph.centers[b.exit], graph.centers[dungeon.heart]) - pedestalRadius() })),
      }),
      siteCells: () => story?.siteCells ?? {},
      // the same fields deployStart resets, so the step rebuilds pos ON ci instead of gliding off it; segLen is the cell scale
      // because cur === next is a zero-length chord
      setAmmo: (n) => { ammo = n; updateHud(); }, laserAuto: (on) => laserStation.setAuto(on),   // the harness's rack and SOL's automation switch
      placeTank: (ci) => { player.freeMode = false; player.virtualStart = null; player.cur = ci; player.prev = ci; player.next = ci; player.prog = 0; player.segLen = cellSide; player.pos = graph.centers[ci].slice(); },
      killGuards: (id) => { for (const e of enemies) if (e.alive && e.guard?.site === id) killCreature(e, false); },
      hitTank: () => { if (playerHP > 1) playerHit(); },
      cargoView: (k, id) => {
        endShot();
        if (!k || k === 'tank') snapCamera();
        const f = k && k !== 'tank' ? story?.glue?.view(k, id) : null;
        if (f) startShot({ id: 'cargoView', dur: 600, poseAt: (u, out) => { out.pos.set(f.eye[0], f.eye[1], f.eye[2]); tmpCam.position.copy(out.pos); tmpCam.up.set(f.up[0], f.up[1], f.up[2]); tmpCam.lookAt(f.at[0], f.at[1], f.at[2]); out.quat.copy(tmpCam.quaternion); } });
        return k && (f || k === 'tank') ? { ...(f ?? {}), camera: camera.position.toArray(), tank: player.pos.slice(), tankShown: !!playerMesh?.visible && playerMesh.parent === scene, near: camera.near, far: camera.far, sight: story?.glue?.sight(scene, f ? f.eye : camera.position.toArray(), f ? f.at : player.pos) ?? null } : false;
      },   // a close still of the cargo (flag, crate, drop, trophy) for the screenshots; no kind ends it and snaps the tank camera
      cargoStand: (kind, id) => story?.glue?.standCell(kind, id, (ci) => dungeon.tags[ci] !== BLOCKED) ?? -1,
      commitTower: (key, ci) => !!commitTower(key, ci, 0),
      breachNew:()=>seedPortals(1),
      seatState:()=>{
        camera.updateMatrixWorld();
        const pv=new THREE.Vector3(player.pos[0],player.pos[1],player.pos[2]).project(camera),ap=pilot?.gunshipOptic?.()?.pos,av=ap?new THREE.Vector3(ap[0],ap[1],ap[2]).project(camera):null;
        return {
          view:params.view, fov:+camera.fov.toFixed(4), aspect:+camera.aspect.toFixed(4), quat:camera.quaternion.toArray().map(x=>+x.toFixed(6)),
          pos:camera.position.toArray().map(x=>+x.toFixed(6)), tank:[+pv.x.toFixed(5),+pv.y.toFixed(5),+pv.z.toFixed(5)],
          aim:av?[+av.x.toFixed(5),+av.y.toFixed(5),+av.z.toFixed(5)]:null, pilot:!!pilot, gunshipSeat:!!pilot?.gunship, seatKey:pilot?.state?.tower?.key??null,
          pilotView:pilot?.state?.view??null, zoom:pilot?.state?.zoom!=null?+pilot.state.zoom.toFixed(4):null,
          yaw:pilot?.state?.yaw!=null?+pilot.state.yaw.toFixed(5):null, pitch:pilot?.state?.pitch!=null?+pilot.state.pitch.toFixed(5):null,
          map:!!pilot?.isMap?.(), laserSeat:laserStation.seated(), locked:!!document.pointerLockElement, shot:shotId(), tankPos:player.pos.slice(),
        };
      },
      breachNextWave:()=>{waveIn=-1;armWave();},
      breachStrike:()=>{const sp=spawnPoints.find(s=>s.alive&&s.obj.userData.breach);if(sp)executeStrike(sp.ci,t);},
      breachShell:()=>{const sp=spawnPoints.find(s=>s.alive&&s.obj.userData.breach);if(sp)gateTakesShell(sp);},
      breachSpent:programmeSpent,
      sectorRelease: (id) => sectorRun?.test.release(id) ?? null,
      sectorClose: (id, by) => sectorRun?.test.close(id, by) ?? null,
      sectorClearField: () => sectorRun?.test.clearField(),
      // THE PACING PROBE'S DEFENDER (--pacing): a body within r cells of a door dies there; it counts arrivals (not harmless
      // leftovers), not a player's kills
      sectorCull: (r = 8) => { if (!story) return 0; const doors = [story.gateCell, ...(story.backOpen ? story.backMouth?.cells ?? [] : [])].filter((c) => c >= 0).map((c) => graph.centers[c]); let n = 0; for (const e of enemies) if (e.alive && !e.guard && e.emergeAge >= 1.2 && doors.some((c) => chord(e.pos, c) < cellSide * r)) { killCreature(e, false); if (!e.harmless) n++; } return n; },
      sectorContinue: () => sectorRun?.test.cont(),
      sectorKeepHolding: () => sectorRun?.test.keepHolding(),
      sectorQuiet: (on) => sectorRun?.test.quiet(on),
      sectorReport: () => sectorRun?.test.report() ?? null,
      breachScenario:()=>{endShot();paused=false;setView('orbit');followSuspend=true;const sp=spawnPoints.find(s=>s.alive);if(sp){buildQ.setFromUnitVectors(BQ_Z,new THREE.Vector3(...graph.centers[sp.ci]).normalize());buildDist=1.65;}waveIn=-1;armWave();},
      shieldScenario: () => {
        endShot();paused=true;
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
      refillArrays: () => refillArrays(),
      deployShield: () => {const was=paused;paused=false;const result=deployShieldNow();paused=was;return result;},
      fireShell: () => fire(),
      ...laserStation.hooks,   // laserOnline, laserPassNow, laserSeat, laserSteer, laserHold
      showRecordTest: () => {
        rs.bestShell={kills:1000};rs.bestStrike={kills:1001};run.bestStreak=999;rs.maxCombo=1200;
        renderAnalysis(false);
      },
      missileScenario: key => {
        endShot();paused=true;
        clearTowers();for(const e of enemies){e.alive=false;scene.remove(e.obj);}enemies.length=0;spawnQueue.length=0;
        const ci=dungeon.tags.findIndex((tag,i)=>!placeError(i) && !towerByCell.has(i));
        if(ci<0)return false;
        const tw=commitTower(key,ci,0);
        for(const id of [-901,-902])enemies.push({id,alive:true,hp:1000,spec:{rammable:false},pos:graph.centers[ci].slice(),obj:new THREE.Group()});
        return !!tw;
      },
      missileTargets: distances => {
        const tw=towers.find(tw=>missileOf(tw.key));if(!tw)return;
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
        if(!missileOf(key) || !lookReady(params.towerLook) || !missilePool?.available)return false;
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
        endShot();
        const ci = dungeon.tags.findIndex((tag, i) => !placeError(i) && !towerByCell.has(i));
        if (ci < 0) return false;
        openShop(ci, innerWidth / 2, innerHeight / 2); return true;
      },
      begin: () => { endShot(); paused = false; },
      setSector: (n) => { if (story) story.sectorN = n; },
      breakGate: (id = 'gate') => !!sectorRun?.breakGate(id),   // the harness takes the door down: Isao's animated repair needs a broken door
      mendGate: (id = 'gate') => !!sectorRun?.repairGate(id),   // ...from a whole one: on the clock the swarm may have had it down already
      faultOnce: () => { const b = story?.beats; if (!b) return false; const tick = b.tick; b.tick = () => { b.tick = tick; throw new Error('injected frame fault'); }; return true; },   // the next story tick throws once: the frame guard's proof (--sectors)
      mountGunship: () => { if (!storyViews) storyApi.unlock('views'); if (gunshipRig.onCall() && !onStation(gunship)) storyViews.meter(callProgress(gunshipRig.call), callFull(gunshipRig.call)); else storyViews.station(onStation(gunship), phaseLeft(gunship)); document.querySelector('#story-views [data-mount="gunship"]')?.click(); return !!pilot?.gunship; },
      gunshipHold: (on) => { if (pilot) pilot.state.held = !!on; },
      gunshipCam: () => camera.quaternion.toArray(),
      programs: () => renderer.info.programs.map((p) => `${p.name}#${String(p.cacheKey).length}`),
      programKeys: () => programWarm.keys(), warmProbe: (n) => programWarm.probe(n),   // the whole keys, to diff a seat's new program against the warmed one of the same name   // which shader programs are linked: the seat hitch probe
      gunshipGun: (k) => selectGun(gunship, k, GUNSHIP_GUNS),
      gunshipPassEnd: () => { gunship.left = 0; },   // the harness ends the station pass now: the next tick departs
      fillGunshipCall: (n) => fillFromKill(gunshipRig.call, n, GUNSHIP_CALL),
      // the skip panel's enemies: a breach opens on the lane outside the gate if none is live, and they rise out of it staggered
      // (emergence only runs from a real breach)
      spawnFodder: (n, type = 'amoeba') => { if (!story) return 0; if (!story.source?.alive) storyApi.breach(gunshipRig.far()); for (let i = 0; i < n; i++) storyApi.spawn(type, story.source.ci, { spread: 0.8, delay: i * 0.12 }); return n; },
      clearSector: () => {
        endShot();

        paused = false;
        spawnQueue.length = 0;
        for (const e of enemies) { e.alive = false; scene.remove(e.obj); }
        for (const sp of spawnPoints) { sp.alive = false; scene.remove(sp.obj);disposeObj(sp.obj); }
        eco.spend(eco.biomass); // exercise the zero-income early-clear case
        checkVictory(); endShot(); renderVerdict(round >= SECTORS_TOTAL);
      },
      focusHeart: () => { endShot(); setView('orbit'); centerBuildOnHeart(); followSuspend = true; buildDist = 1.65; },
      deployHull: n => { endShot(); paused = false; deployStart(n); },
      restart: () => regenerate(),
      openBackDoor: () => storyApi.openBackDoor(),
      backDoorOpen: () => storyApi.backDoorOpen(),
      // THE BACK GATE (2026-09-18): what the mouth's cells are to the pathfinder, and an order for a sentry on one of its mounts
      sealedAt: (ci) => !!story?.sealed(ci),
      gateAt: (ci) => story?.gateAt?.(ci) ?? null,
      backSocketCells: () => (story?.backSockets ?? []).map((sk) => sk.cell),
      orderAt: (ci, key = starterTower().key) => { eco.addBiomass((TOWER_BY_KEY[key]?.cost ?? 0) * 2); return placeError(ci) || (orderTower(key, ci, { quiet: true }) ? null : 'refused'); },
      backCandidates: () => storyApi.backBreachCandidates(),
      backMouth: () => story?.backMouth ?? null,
      backBreach: (n = 16, k = 0) => { const c = storyApi.backBreachCandidates()[k]; if (!c) return -1; const obj = buildPortalObj(c.cell, 0); scene.add(obj); const sp = { ci: c.cell, alive: true, obj, hp: 3, found: true }; spawnPoints.push(sp); recomputePortalDist(); for (let i = 0; i < n; i++) spawnQueue.push({ type: 'amoeba', sp, at: spawnClock, spread: 0.8, delay: i * 0.12 }); return c.cell; },
      backInside: () => { const m = story?.backMouth, h = graph.centers[dungeon.heart]; if (!m) return 0; const b = sub3(m.dir, scale3(h, dot3(m.dir, h))); return enemies.filter((e) => e.alive && story.inside(e.cur) && dot3(sub3(e.pos, h), b) > 0).length; },
      viewBack: (height, back) => { const m = story?.backMouth; if (!m) return; endShot(); paused = false; startDiveShot({ camera, startShot, cellSide }, new THREE.Vector3(...m.dir), { id: 'backview', hold: 600, dive: { ...story.backDoor.dive, height: height ?? story.backDoor.dive.height, back: back ?? story.backDoor.dive.back, diveSeconds: 1e-3 } }); },
      heartHealth: fraction => { heartHP = Math.max(0, Math.min(HEART_MAX, fraction * HEART_MAX)); heartSprite.userData.setHealth?.(fraction); },
      // THE SHOWCASE'S HOOKS (src/fx/showcase-hooks.js; the rail is src/fx/showcase.js): the montage drives the real systems
      // through these and nothing else, so it needs no ?acceptance=1
      showcase: createShowcaseHooks({
        camera, enemies, spawnPoints, spawnQueue, towers, player, params, gunship, gunshipCall: gunshipRig.call, explosions, gameBreaches, storyApi, gunshipFar: gunshipRig.far, automated, shotId, endShot, startShot, snapCamera, setView, releaseSpawns, enterPilot, leavePilot, spawnIsao, placeTank: (ci) => gameHooks.placeTank(ci),
        story: () => story, storyBase: () => storyBase, deploy: () => deploy, playerMesh: () => playerMesh, graph: () => graph, dungeon: () => dungeon, cellSide: () => cellSide, pilot: () => pilot, pilotMode: () => pilotMode, isao: () => isao, rs: () => rs, ramCombo: () => ramCombo, playerHP: () => playerHP,
        setPaused: (v) => { paused = v; }, setFollowSuspend: (v) => { followSuspend = v; }, setRamCam: (v) => { showcaseRamCam = v; }, setGunshipTrack: (v) => { gunshipRig.setTrack(v); },
      }),
  };
    if (flags.acceptance === '1') window.__stalheartTest = gameHooks;   // Browser acceptance adapter, published only when explicitly requested; the showcase holds the same object directly

  // back to the hull, at the lens and the view the seat was taken from: the seat's zoom narrowed it (owner, 2026-09-15: the tank
  // after the gunship at the wrong angle; 2026-09-23: and after SOL-82 too)
  function leavePilot() {
    if (!pilotMode) return;
    seatGlide.cancel();
    pilot?.dispose();
    for (const tw of towers) hushRotor(tw);
    pilot = null;
    pilotHost = null;
    pilotMode = false;
    // the scope leaves with the optic
    storyScope?.update({ on: false });
    params.callouts = true;
    delete window.__stalheartPilotTest;
    restoreSeat();
  }
  let seatBase = null;
  // THE ONE RESTORE (src/domain/seat-view.js): every leave puts back the camera the FIRST seat of the chain recorded, whichever
  // seat comes next, and drops a pointer lock the hull never asked for
  function restoreSeat() {
    const b = restoreSeatView(seatBase);
    seatBase = null;
    camera.fov = b.fov;
    camera.updateProjectionMatrix();
    if (!b.lock && document.pointerLockElement) document.exitPointerLock?.();
    setView(b.view);
    snapCamera();
  }
  function enterPilot(posts) { closeShop(); keys.left = keys.right = keys.fast = keys.slow = keys.laser = false; pilot?.dispose(); seatBase = baseFor(seatBase, pilotMode || laserStation.seated(), { view: params.view, fov: camera.fov }); pilotMode = true;   // one optic at a time: a hand-over while already piloting replaces the panel. the story hands over its mounts
    function installPilot(key) {
      const old=pilotMounts[pilotPost];
      if(old?.key===key){const sp=spawnPoints.filter(sp=>sp.alive).sort((a,b)=>chord(graph.centers[old.ci],graph.centers[a.ci])-chord(graph.centers[old.ci],graph.centers[b.ci]))[0];pilot.attach(old,graph.centers[sp?.ci??dungeon.spawn]);if(story?.missiles?.[key]){pilot.state.zoom=story.quiverZoom??2;pilotHost.zoom(pilot.state.zoom);}return;}   // picked: a guided mount opens through its long lens here too
      if(old){
        hushRotor(old); if(old.spinning)sfx.play('minigun_ready',{dist:camDist(graph.centers[old.ci])});
        scene.remove(old.obj);disposeObj(old.obj);
        const index=towers.indexOf(old);if(index>=0)towers.splice(index,1);
        towerByCell.delete(old.ci);towerCells.delete(old.ci);
      }
      const tw=commitTower(key,pilotPosts[pilotPost],0);
      // Heptapod is tethered to the emplacement in this experiment.
      tw.a6=null;placeTowerObj(tw);pilotMounts[pilotPost]=tw;
      const near=spawnPoints.filter(sp=>sp.alive).sort((a,b)=>chord(graph.centers[tw.ci],graph.centers[a.ci])-chord(graph.centers[tw.ci],graph.centers[b.ci]))[0]; pilot.attach(tw,graph.centers[near?.ci ?? dungeon.spawn]); if(posts&&story?.missiles?.[key]){pilot.state.zoom=story.quiverZoom??2;pilotHost.zoom(pilot.state.zoom);}   // a guided mount opens through its long lens
    }
    pilot=createSentryPilot(root,pilotHost={
      story:!!posts,mobile:mobileShell,select:installPilot,views:name=>storyViews?.active(name),thermal:on=>thermalHeat.set(on),leave:()=>leavePilot(),gunship:gunshipRig.pilotBag(),
      post:delta=>{pilotPost=(pilotPost+delta+pilotPosts.length)%pilotPosts.length;pilot.select(pilotMounts[pilotPost]?.key || pilot.state.tower.key);}, pick:key=>{const i=pilotMounts.findIndex(m=>m?.key===key);if(i>=0){pilotPost=i;pilot.select(key);}},   // the story's strip names a mount
      map:on=>setView(on?'orbit':'bastion'),leave:()=>root.querySelector('#story-views [data-view="tank"]:not([disabled])')?.click(),pause:()=>{togglePause();pilot.state.held=false;},
      wake:()=>holdWake(),cellSide:()=>cellSide, cone:()=>(pilot?.state.tower&&missileOf(pilot.state.tower.key)?story?.quiverCone??0:0),   // a guided mount acquires inside a cone; a gun needs the reticle on the body
      zoom:z=>{camera.fov=60/z;camera.updateProjectionMatrix();}, lens:()=>[camera.fov,camera.aspect], round:()=>{const tw=pilot?.state.tower,m=tw&&towerSeekers.find(m=>m.by===tw);return m?{pos:m.p,u:m.t/m.config.duration,phase:m.pose?.phase}:null;},   /* the piloted mount's guided round in flight, for the framing (src/core/round-framing.js) */
      visible:e=>pilot.state.tower && losClear(pilot.state.tower.ci,e.pos,perchOf(pilot.state.tower)),
      aimPoint:(eye,dir,range)=>roundEnd(eye.toArray(),dir.toArray(),range,terrainOf(pilot.state.tower.ci)).point,   // exactly where the reticle's line meets the terrain
      cameraPose:(eye,dir,up,goal)=>{tmpCam.position.copy(eye);tmpCam.up.copy(up);tmpCam.lookAt(eye.clone().add(dir));goal.quat.copy(tmpCam.quaternion);}
    });
    pilotPosts=(posts??[]).slice();   // the story hands over its printed mounts
    deploy=null;endShot();paused=false;
    for(let i=0;i<pilotPosts.length;i++)pilotMounts[i]=towerByCell.get(pilotPosts[i]);
    clearBriefs();params.callouts=false;setView('bastion');if(pilotPosts.length)pilot.select(pilotMounts[0]?.key||'rotor');hideRangeRing();snapCamera();   // no posts yet (the gunship's seat before any sentry stands): nothing to install
    if(flags.acceptance==='1')window.__stalheartPilotTest={
      state:()=>({
        paused,
        seed:params.seed,
        points:params.points,
        sector:round,
        posts:pilotPosts.slice(),
        view:pilot.state.view,
        ci:pilot.state.tower.ci,
        key:pilot.state.tower.key,
        shots:pilot.state.shots,
        held:pilot.state.held,
        heat:pilot.state.tower.heat??0,
        overheated:!!pilot.state.tower.overheated,
        roundDmg:+(effectiveStats(pilot.state.tower.def,pilot.state.tower.tier).dmg*(story?.pilot.dmgMul??1)).toFixed(3),
        enemyHp:enemies.find(e=>e.alive&&e.id>0)?.spec.hp??null,
        wave,
        enemies:enemies.filter(e=>e.alive).length,
        tank:player.pos.slice(),
        camera:camera.position.toArray(),
        target:pilot.state.target?.id??null,
        ready:!pilot.state.tower.obj.userData.loading,
        aimError:pilot.state.tower.aimErr,
        lock:pilot.state.tower.lock,
        heart:heartHP,
      }),
      select:key=>pilot.select(key),
      aimEnemy:()=>{const tw=pilot.state.tower;const e=enemies.find(e=>e.alive&&missileDistance(graph.centers[tw.ci],e.pos)<(missileOf(tw.key)?.maxRange??effectiveStats(tw.def,tw.tier).range*10)&&losClear(tw.ci,e.pos,perchOf(tw)));if(!e)return null;pilot.aimAt(add3(e.pos,scale3(norm3(e.pos),cellSide*.3)));return {id:e.id,hp:e.hp};},
      enemy:id=>{const e=enemies.find(e=>e.id===id);return e?{hp:e.hp,alive:e.alive}:null;},
      hold:on=>{pilot.state.held=!!on;},
      view:v=>pilot.setView(v),
      lock:()=>{const tw=pilot.state.tower;return {meter:tw.lock?.meter??0,locked:!!tw.lock?.locked,tgt:tw.pilotTarget&&!tw.pilotTarget.pilotAim?tw.pilotTarget.id:null,flight:towerSeekers.reduce((n,m)=>n+(m.by===tw?1:0),0)};},
      aimSky:()=>{const c=graph.centers[pilot.state.tower.ci];pilot.aimAt(add3(c,scale3(norm3(c),cellSide*40)));},
      reach:()=>{const tw=pilot.state.tower;return enemies.filter(e=>e.alive).map(e=>({id:e.id,type:e.type,m:+missileDistance(graph.centers[tw.ci],e.pos).toFixed(1),los:losClear(tw.ci,e.pos,perchOf(tw)),cell:e.cur,pos:e.pos.map(v=>+v.toFixed(5))}));},
      // the round through the real camera, for the frame probe
      round:()=>{const r=pilotHost?.round();if(!r)return null;camera.updateMatrixWorld();const v=new THREE.Vector3().fromArray(r.pos).project(camera);return {x:+v.x.toFixed(4),y:+v.y.toFixed(4),z:+v.z.toFixed(5),u:+r.u.toFixed(4),phase:r.phase,view:pilot.state.view,fov:+camera.fov.toFixed(2)};},
    };
  }

  resize();
  animate();

  return {
    dispose() { disposed = true; ramFloat.dispose(); pilot?.dispose(); skipCard?.dispose(); showcase?.dispose(); active = false; storyBase?.dispose(); gameBreaches.dispose();runTimers.dispose(); runContext.dispose(); missilesDisposed=true; missilePool?.dispose(); setPerfOverlay(false,false); },
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
