// ISAO KEEPS BUILDING (owner, 2026-09-16): the controller's side of Isao's build programme, moved out of the controller's storyApi
// unchanged; the controller merges these members back into storyApi. The rules are src/domain/build-programme.js (the steps in
// order, their perks, the assembly line's rebuild) and src/domain/repair-orders.js (the gate first, then the walls, between waves
// only); the steps and the repair tuning are src/content/base-programme.js. This is their composition with the controller's world:
//   perks() / hasPerk(name)  the programme's perks, for the orbital laser, the shield station and the gunship meter
//   build()                  once per unfrozen frame: the first hull's issue, the rebuilt hull, then at most one order for Isao
//                            (a repair, or the next step of the base)
//   repaired(repair)         a repair order done: the gate back to full, or the wall cell closed by a kit wall (not rock)
//   printed(step)            a print order done: the step stands, and its perk switches on in the world
//
// `c` hands in the controller: its fixed objects and functions as values (PLAYER_MAX, orders, breachQueue, breachedCells,
// gunshipRig, showBrief, spawnIsao, updateHud, syncLifeContainers, rebuildAfterBreach, recomputePortalDist, adoptBays), what it
// rebinds as getters (story, playerHP, sectorRun, waveActive, dungeon, tdFullTags, storyBase, pilotMode, briefQ) and the lets
// the members write as setters (setPlayerHP, setBerths). `c` is also the first hull's host's host (src/fx/hull-issue.js
// createHullHost): it carries that host's values, getters and setters too (laserStation, shotId, deployStart, deployStep,
// leavePilot, camera, startShot, deployFramePoseFor, camA, setView; pilot, deploy, t, storyViews; setPlayerDown, setDeploy).
import { BLOCKED, PATH } from '../dungeon.js';
import { BASE_PERKS, BASE_REPAIR } from '../content/base-programme.js';
import { LASER_AUTO } from '../content/orbital-laser.js';
import { due as programmeDue, begin as programmeBegin, finish as programmeFinish, hasPerk as programmeHas, perks as programmePerks, sectorStarted } from '../domain/build-programme.js';
import { createArcLaunch } from './arc-launch.js';
const LAUNCH_SHOT = 22;   // seconds of the first launch's cinematic: the charge, the release, the petals unfolding
import { createArmoryPad } from './armory-pad.js';
import { createPaintPad } from './paint-pad.js';
import { applyGarage } from '../../assets/models/garage/runtime.js';
import { ORBITAL_WORKS } from '../content/orbital-works.js';
import { makeWorks, launchDue, beginLaunch, collectorUp, energyBonus } from '../domain/orbital-works.js';
import { createOrbitalRing } from './orbital-ring.js';
import { createScoreboard } from './scoreboard.js';
import { createSiteBeacons } from './site-beacons.js';
import { STORY_EXPEDITIONS, STORY_CALM } from '../content/story-defaults.js';
import { createIsaoStrike } from './isao-strike.js';
import { createGunshipAuto, landGunshipRounds } from './gunship-auto.js';
import { GUNSHIP_AUTO, GUNSHIP_ORBIT } from '../content/gunship.js';
import { callGunship, isFull as callFull } from '../domain/gunship-call.js';
import { onStation, startStation } from '../domain/gunship.js';
import { SOUNDS } from '../content/audio-defaults.js';
import { strikeDue, pickStrikeTarget } from '../domain/isao-strike.js';
import { ISAO_STRIKE } from '../content/base-programme.js';
import { LIVERY_IDS, DYE_SHOP } from '../content/dyes.js';
import { makeDyeBook } from '../domain/dyes.js';
import { openPaintShop, applyLivery } from './paint-shop.js';
import { isaoSpeak } from './isao-voice.js';
import { tourStops } from '../domain/story-shots.js';
import { createAmbientGust } from './ambient-gust.js';
import { BRIEFS } from '../isaobriefs.js';
import { storage } from '../storage.js';
import * as THREE from '../../vendor/three.module.js';
import { createMomentReel } from './moment-reel.js';
import { createColonyLapse } from './colony-lapse.js';
import { playDiorama } from './finale-diorama.js';
import { playOrbitalFinale } from './orbital-finale.js';
import { renderAccretion, accretionSkyPlanes, aimSkyPlanes, skyDirectionToward } from './accretion.js';
import { SKY_HOLE } from '../galaxyseed.js';
const loadDyes = () => { try { return JSON.parse(storage.getItem(DYE_SHOP.store) ?? 'null'); } catch { return null; } };
const saveDyes = (b) => { try { storage.setItem(DYE_SHOP.store, JSON.stringify(b)); } catch { /* a refused store: the dyes last this run */ } };
import { nextRepair, shotHoles, rimHoles } from '../domain/repair-orders.js';
import { sideBreachCandidates } from '../domain/side-breach.js';
import { planCanyon } from '../domain/canyon.js';
import { SIDE_BREACH, CANYON } from '../content/sectors.js';
import { createHullHost } from './hull-issue.js';

export function createProgrammeHost(c) {
  const { PLAYER_MAX, orders, breachQueue, breachedCells, gunshipRig, showBrief, spawnIsao, updateHud, syncLifeContainers, rebuildAfterBreach, recomputePortalDist, adoptBays } = c;
  // THE BLACK HOLE NOT FAR (owner, 2026-10-06: "not just at the ending, but during the entire game"; galaxyseed.js SKY_HOLE): the
  // owner's accretion disk rendered once (src/fx/accretion.js) and hung in the scene as world-fixed planes beyond the planet, which hides
  // it below the horizon; it outlives world rebuilds (the sky is not the world's) and the day (the baked stars fade, this does not)
  const skyHoleNote = (planes) => { if (typeof document !== 'undefined') document.documentElement.dataset.skyHole = JSON.stringify(planes.userData.hole); };   // what the harness reads
  if (c.scene && !c.scene.getObjectByName('sky-hole')) {
    try { const h = renderAccretion(); if (h) { const planes = accretionSkyPlanes(h.texture, h.shadow, SKY_HOLE); planes.name = 'sky-hole'; for (const o of planes.children) { o.material.depthTest = true; o.frustumCulled = false; } c.scene.add(planes); skyHoleNote(planes); } } catch { /* a context that refuses the shader: no hole */ }
  }
  // ...and LOW BEHIND THE STÅLHEART once it stands (SKY_HOLE.toward / elevation): aimed once per world, from the heart toward the structure
  const aimSkyHole = () => {
    const planes = c.scene?.getObjectByName('sky-hole'), sb = c.storyBase(), st = SKY_HOLE.toward && sb?.structure?.(SKY_HOLE.toward), fr = SKY_HOLE.from && sb?.structure?.(SKY_HOLE.from), hp = c.dungeon()?.heart;
    if (!planes || !st?.holder || !fr?.holder || !(hp >= 0) || planes.userData.aimedFor === sb) return;
    const at = st.holder.getWorldPosition(new THREE.Vector3()).toArray(), from = fr.holder.getWorldPosition(new THREE.Vector3()).toArray();
    aimSkyPlanes(planes, skyDirectionToward(c.graph().normals[hp], at, SKY_HOLE.elevation, from)); planes.userData.aimedFor = sb; skyHoleNote(planes);
  };
  // a point (the placer's world) stands on lattice cell ci: ci is its nearest of ci and ci's neighbours, within one cell (patchLine's owns)
  const ownCell = (ci, p) => { const g = c.graph(), u = p.clone().normalize(), d = (k) => u.distanceTo(new THREE.Vector3(...g.centers[k])); return d(ci) < c.cellSide() && g.adj[ci].every((nb) => d(nb) >= d(ci)); };
  const danger = () => {   // engaged() below
    const seat = !!(c.pilot()?.gunship || c.laserStation?.seated?.()), hull = c.playerPos(), r = STORY_CALM.near * c.cellSide();
    for (const e of c.enemies()) if (e.alive && !e.guard && (seat || Math.hypot(e.pos[0] - hull[0], e.pos[1] - hull[1], e.pos[2] - hull[2]) < r)) return true;
    return false;
  };
  return {
    // ISAO KEEPS BUILDING (src/content/base-programme.js, src/domain/build-programme.js): perks() and hasPerk(name) are what the
    // orbital laser, the shield station and the gunship meter consult
    perks: () => (c.story()?.programme ? programmePerks(c.story().programme) : new Set()),
    hasPerk: (name) => !!c.story()?.programme && programmeHas(c.story().programme, name),
    // THE NUKE'S TANK (src/domain/story-beats.js tankAfterNuke): the MK-9 blasts so far, and the hull handed over on the lane before
    // the Stålheart stands (src/fx/hull-issue.js early)
    nukes: () => c.story()?.nukes?.length ?? 0,
    // THE PLAYER IS BUSY (STORY_CALM; owner, 2026-10-05, twice: the gunship's or SOL's seat surrounded, then the hull in a crowd).
    // danger(): a body within `near` cells of the hull, or any body up while the player is in the gunship's or SOL's seat: a camera
    // shot that would cut in now is skipped (the back door's collapse, SOL-88's launch, a sector breach's dive). engaged(): danger, or a
    // hostile anywhere, and for `calm` seconds after: the story's timed beats (src/domain/story-beats.js) and a sector's debrief
    // (src/fx/sector-run.js) wait it out
    danger,
    engaged: () => {
      const s = c.story(), t = c.t(); if (!s) return false;
      if (danger() || c.enemies().some((e) => e.alive && !e.guard && !e.harmless)) s.busyAt = t;
      return t - (s.busyAt ?? -Infinity) < STORY_CALM.calm;
    },
    tankReady: () => { const s = c.story(); return !!s?.hull?.early(s.hullHost ??= createHullHost(c), s.nukeBerth?.(s.nukes.at(-1) ?? -1)); },
    build: () => {
      aimSkyHole();
      const pg = c.story().programme, sector = c.story().sectorN ?? 0;
      // THE BEST MOMENTS, FILMED (src/fx/moment-reel.js): the run's best ram combo and every tactical nuke, for the campaign card
      if (c.renderer && typeof document !== 'undefined') (c.story().reel ??= createMomentReel(c.renderer)).watch(c.t(), { combo: c.combo?.() ?? 0, nukes: c.story().nukes?.length ?? 0, strikeKills: c.kills?.()?.strike ?? 0, sector });
      // THE COLONY RISES (src/fx/colony-lapse.js): framed on the heart and the rim at the first tick, a still then and at every print and sector
      if (c.renderer && c.scene && typeof document !== 'undefined' && !(c.story().lapse ??= createColonyLapse(c.renderer, c.scene)).framed()) {
        const g = c.graph(), h = g.centers[c.dungeon().heart], d = (ci) => Math.hypot(g.centers[ci][0] - h[0], g.centers[ci][1] - h[1], g.centers[ci][2] - h[2]);
        c.story().lapse.frame(h, Math.max(c.cellSide() * 8, ...(c.story().wallCells ?? []).map(d))); c.story().lapse.shoot('THE LANDING');
      }
      // THE FIRST MÖRK ROLLS OUT OF THE STÅLHEART (src/fx/hull-issue.js): the camera runs to the door's framing with the hull
      // standing under the gantry, then it drives out as any deploy does; under a gunner it is set down outside the door
      c.story().hull?.tick(c.story().hullHost ??= createHullHost(c));
      // the assembly line rebuilds a lost hull at a sector's start; the farm pays its biomass
      if (sectorStarted(pg, sector)) {
        c.story().lapse?.shoot(`SECTOR ${String(sector).padStart(2, '0')}`);
        if (programmeHas(pg, 'rebuild') && c.playerHP() < PLAYER_MAX) { c.setPlayerHP(Math.min(PLAYER_MAX, c.playerHP() + BASE_PERKS.rebuildHulls)); syncLifeContainers(); updateHud(); }
        if (programmeHas(pg, 'farm') && sector > 0) { c.eco?.()?.addBiomass(BASE_PERKS.farmKg, { category: 'farm' }); updateHud(); }
      }
      // THE COLONY'S PERKS, read every tick so a burned building takes its perk with it (src/domain/build-programme.js lose): the chip
      // plant's closer passes, the armory's pad (its shells into the rack), the ARC-01's launch beat on the game clock
      c.laserStation?.setPeriodScale?.(programmeHas(pg, 'chips') ? BASE_PERKS.chipsPeriod : 1);
      const s = c.story(), pad = s.armoryPad;
      if (pad && c.scene && !pad.ring) pad.ring = createArmoryPad(c.scene, { pos: pad.pos, cellSide: c.cellSide(), tune: BASE_PERKS.armory });
      if (pad?.ring) {
        pad.ring.stand(programmeHas(pg, 'armory'));
        const dt = Math.max(0, Math.min(0.1, c.t() - (pad.at ?? c.t()))); pad.at = c.t();
        const n = pad.ring.tick(dt, c.playerHP() > 0 ? c.playerPos?.() : null, c.ammo?.() ?? 0, c.ammoMax ?? 9, c.t());
        if (n > 0) { c.setAmmo?.(c.ammo() + n); c.sfx?.play?.('tank_shells'); isaoSpeak('shells_refilled'); updateHud(); }
      }
      // PIMP MY RIDE (src/fx/paint-pad.js): the purple pad beside the bays, live once the bays stand; parked on it, the paint shop opens
      // over the paused game with every dye extracted so far
      const pp = s.paintPad;
      if (pp && c.scene && !pp.ring) pp.ring = createPaintPad(c.scene, { pos: pp.cell >= 0 ? c.graph().centers[pp.cell] : pp.pos, cellSide: c.cellSide(), tune: BASE_PERKS.paint });   // centred on its cell: open ground a hull can stand on
      if (pp?.ring) {
        pp.ring.stand(programmeHas(pg, 'garage'));
        // the garage's paint arm sprays while the shop is open (the A6 cycle, assets/models/garage/runtime.js), parked otherwise
        const gar = c.storyBase()?.structure?.('garage')?.near; if (gar) { try { applyGarage(gar, s.shop ? (performance.now() / 1000 - (s.shopWall ??= performance.now() / 1000)) : 0, 1); } catch { /* a tier without the arm */ } if (!s.shop) s.shopWall = null; }
        const dt = Math.max(0, Math.min(0.1, c.t() - (pp.at ?? c.t()))); pp.at = c.t();
        if (pp.ring.tick(dt, c.playerHP() > 0 && !c.pilotMode() ? c.playerPos?.() : null, c.t()) && !s.shop && typeof document !== 'undefined') {
          s.dyes ??= makeDyeBook(loadDyes(), LIVERY_IDS); c.pause?.(true); isaoSpeak('paint_pad');   // the shop's own lines (src/content/voice-hooks.js)
          s.shop = openPaintShop({ root: c.root ?? document.body, book: s.dyes, save: saveDyes, hull: () => c.hull?.(), lines: BRIEFS[BASE_PERKS.paint.brief].lines, title: BRIEFS[BASE_PERKS.paint.brief].title, onClose: () => { s.shop = null; c.pause?.(false); } });
        }
      }
      s.launch?.tick();
      (s.gust ??= createAmbientGust(c.sfx)).tick(Math.max(0, Math.min(0.1, c.t() - (s.gustAt ?? c.t())))); s.gustAt = c.t();   // the wind in the quiet (src/fx/ambient-gust.js)
      // THE SCOREBOARDS (src/fx/scoreboard.js): two plaques on the slab once the step stands, the player's and Isao's, fed the run's books
      // every tick: the player gathers and kills, Isao uses and (once) kills. They face the Stålheart, not the gate: the player reads them from the base
      const dt = Math.max(0, Math.min(0.1, c.t() - (s.hostAt ?? c.t()))); s.hostAt = c.t();
      if (programmeHas(pg, 'board') && c.scene && c.kills) {
        // the two boards end to end along their slab, facing the Stålheart (src/content/base-layout.js 'board'), at 2.25
        if (!s.boards) { const step = pg.steps.find((x) => x.id === 'board'); const bed = step && s.print.bed(step); if (bed) { const face = (a, b) => [b[0] - a[0], b[1] - a[1], b[2] - a[2]], m = c.cellSide() / 10; s.boards = [[0.53, 'YOU', '#ffd27a', true, 'beacon_rivalry'], [-0.53, 'ISAO', '#b8f5c6', false, 'splitflap_rivalry']].map(([y, title, accent, flag, variant]) => { const at = bed(0, y, 0); return createScoreboard(c.scene, { at, up: at, facing: face(bed(-1, y, 0), bed(1, y, 0)), metres: m * 2.25, title, accent, flag, variant }); }); } }
        if (s.boards) {
          const e = c.eco?.(), you = c.hands?.() ?? 0;
          s.boards[0].update({ rows: [['KILLS', you], ['GATHERED', Math.round(e?.earned ?? 0)], ['USED', 0]], rank: c.rank?.() ?? 0 });
          s.boards[1].update({ rows: [['KILLS', s.isaoKills ?? 0], ['GATHERED', 0], ['USED', Math.round(e?.spent ?? 0)]] }, { duration: s.isaoKills && !s.isaoShown ? 2 : 0.25 }); if (s.isaoKills) s.isaoShown = true;   // his 0 -> 1 clatters for two seconds
          for (const bd of s.boards) bd.tick(dt);
        }
      }
      // THE ROCKETS THAT CAME DOWN OFF COURSE (src/fx/site-beacons.js): beacons over the landing sites from the first free camera after the
      // landing, each gone once its site is visited; Isao names them once
      if (!s.beacons && c.scene && s.sites?.length && (!c.shotId?.() || c.shotId() === 'sitesTour') && c.story().beats?.phase?.() !== 'landed') {   // not over the landing itself; over the landers' tour, yes
        const ids = STORY_EXPEDITIONS.sites.filter((x) => !x.reveal).map((x) => x.id);   // story.sites holds the first-wave sites' cells, in this order
        const stops = c.shotId?.() === 'sitesTour' ? tourStops(s.sites.slice(0, 3).length) : [];   // over the tour, each lights as the eye reaches it (src/domain/story-shots.js)
        s.beacons = createSiteBeacons(c.scene, s.sites.map((ci, i) => ({ id: ids[i], ci, point: c.graph().centers[ci], model: () => c.storyBase()?.structure(ids[i])?.holder, start: stops[i] != null ? Math.max(0, stops[i] - 0.5) : undefined })).filter((x) => x.id), { metres: c.cellSide() / 10, onPulse: (id) => { if ((s.pinged ??= new Set()).has(id)) return; s.pinged.add(id); c.sfx?.play?.('beacon_ping', { dist: 0 }); } });   // each beacon pings once, its first pulse
        if (!c.pilotMode() && !c.briefQ()) showBrief('sites_seen');
      }
      if (s.beacons) { s.beacons.tick(dt); for (const x of s.expeditions?.sites ?? []) if (x.state !== 'hidden' && x.state !== 'guarded') s.beacons.drop(x.id); }
      // THE GUNSHIP ON AUTO (src/fx/gunship-auto.js, GUNSHIP_AUTO): the passes the player sits in and fires are Isao's calibration; once
      // he has two, a full meter calls the ship by itself and a pass nobody is seated for flies itself. The seat is always the player's
      if (c.gunshipRig && c.camera) {
        const G0 = c.gunshipRig.pilotBag ? (s.gsBag ??= { ...c.gunshipRig.pilotBag(), cs: c.cellSide() }) : null, gs = G0?.state, seated = !!c.pilot?.()?.gunship;
        if (gs) {
          if (s.gsManned == null && typeof location !== 'undefined' && new URLSearchParams(location.search).get('gunship') === 'auto') s.gsManned = GUNSHIP_AUTO.afterManned;   // ?gunship=auto: a playtest starts calibrated
          const up = onStation(gs);
          if (up && seated && (gs.rounds?.length || gs.heavyFalling)) s.gsFired = true;   // a pass the player flew and fired in
          if (s.gsWas && !up) { if (s.gsFired) s.gsManned = (s.gsManned ?? 0) + 1; s.gsFired = false; }
          s.gsWas = up;
          if (!s.gsAuto && (s.gsManned ?? 0) >= GUNSHIP_AUTO.afterManned) { s.gsAuto = true; if (!c.pilotMode() && !c.briefQ()) showBrief(GUNSHIP_AUTO.brief); }
          if (s.gsAuto) {
            if (!onStation(gs) && c.gunshipRig.onCall() && callFull(c.gunshipRig.call) && callGunship(c.gunshipRig.call)) { startStation(gs, GUNSHIP_ORBIT); if (!c.pilotMode() && !c.briefQ()) showBrief(GUNSHIP_AUTO.autoBrief); }
            const view = (p, lim) => { const q = new THREE.Vector3(...p).project(c.camera); return q.z < 1 && Math.abs(q.x) < lim && Math.abs(q.y) < lim; };
            s.gsFly ??= createGunshipAuto({ G: G0, tune: GUNSHIP_AUTO, onScreen: view, callout: (t) => c.callout?.(t, 'co-victory'), sfx: c.sfx, hasCue: (k) => !!SOUNDS[k],
              friends: () => { const g = c.graph(), b = c.storyBase(), cells = [c.dungeon().heart, ...(b?.anchors() ?? []), ...(c.story().wallCells ?? [])]; return [...cells.filter((ci) => ci >= 0).map((ci) => g.centers[ci]), ...(c.playerPos() ? [c.playerPos()] : [])]; },
              units: () => [c.playerPos(), c.isao()?.obj?.position.toArray()].filter(Boolean), hull: () => (c.playerHP() > 0 ? c.playerPos() : null) });
            s.gsFly.tick(dt, seated);
          } else if (!seated) { G0.optic?.fade?.(dt); landGunshipRounds(G0); }   // before the auto pass exists, the player's rounds and MK-9 still land after they leave the seat
        }
      }
      // ISAO'S MISSILE (src/fx/isao-strike.js): once a run, in a strong wave, with the hull on screen and nobody seated
      if (s.strike) { if (!s.strike.tick(dt)) s.strike = null; }
      else if (!s.strikeDone && c.isao?.() && c.enemies) {
        // the bodies on screen only: he must arrive where the player is looking ("when it is clearly in view")
        const onScreen = () => c.enemies().filter((x) => { if (!x.alive) return false; const q = new THREE.Vector3(...x.pos).project(c.camera); return q.z < 1 && Math.abs(q.x) < 0.8 && Math.abs(q.y) < 0.8; });
        const isao = c.isao(), live = onScreen(), tank = c.playerPos?.();
        const ndc = tank ? new THREE.Vector3(...tank).project(c.camera) : null, inView = !!ndc && ndc.z < 1 && Math.abs(ndc.x) < ISAO_STRIKE.view && Math.abs(ndc.y) < ISAO_STRIKE.view;
        const doors = c.sectorRun()?.gates?.() ?? [], pressure = doors.some((g) => g.broken || (g.max > 0 && g.hp / g.max < ISAO_STRIKE.gateShare));
        if (strikeDue({ done: s.strikeDone, sector: s.sectorN ?? 0, minSector: ISAO_STRIKE.minSector, pressure, alive: c.enemies().filter((x) => x.alive).length, threshold: ISAO_STRIKE.alive, inView, seated: c.pilotMode() || !!c.laserStation?.seated?.(), isaoFree: !isao.order && !isao.held && isao.state === 'idle', hullUp: c.playerHP() > 0 })
          && pickStrikeTarget(live, tank, c.cellSide(), ISAO_STRIKE.near)) {
          s.strikeDone = true;
          s.strike = createIsaoStrike({ isao: () => isao, enemies: onScreen, tank: () => c.playerPos(), cellSide: () => c.cellSide(), scene: c.scene, explode: c.explode, kill: (e) => c.kill(e, 'isao'), brief: (id) => showBrief(id), sfx: c.sfx,
            onKill: () => { s.isaoKills = (s.isaoKills ?? 0) + 1; c.sectorRun()?.note({ type: 'isaoKill' }); s.boards?.[1].celebrate(ISAO_STRIKE.celebrate); updateHud(); } }, ISAO_STRIKE);
        }
      }
      // THE PAINT (src/domain/dyes.js): the hull wears the palette chosen on the bays' pad, re-applied whenever the hull is a new mesh
      s.dyes ??= makeDyeBook(loadDyes(), LIVERY_IDS);
      { const hull = c.hull?.(); if (hull && hull !== s.paintedHull) { s.paintedHull = hull; applyLivery(hull, s.dyes).then((n) => { s.painted = n; }); } }
      // THE ORBITAL WORKS (src/domain/orbital-works.js): once SOL-88 is up, a collector goes up at the start of every sector after a
      // secured one; each in orbit is a light on the ring and seconds of beam for SOL
      s.works ??= makeWorks();
      if (c.scene && !s.worksRing) { s.worksRing = createOrbitalRing(c.scene, ORBITAL_WORKS.ring); s.worksRing.set(s.works.collectors); }
      s.worksRing?.tick(c.t());
      if (s.sol88 && sector > 0 && launchDue(s.works, { sector, online: true, secured: (c.sectorRun()?.test?.reports?.() ?? []).some((r) => r.sector === sector - 1 && r.outcome === 'secure'), standing: programmeHas(pg, 'launcher') }) && !s.launch) {
        const root = c.storyBase()?.structure?.('launcher')?.root ?? null;
        beginLaunch(s.works, sector);
        s.launch = createArcLaunch({ launcher: root, now: () => c.t(), sfx: c.sfx, onComplete: () => { const n = collectorUp(s.works); s.worksRing?.set(n); c.laserStation?.setEnergyBonus?.(energyBonus(n, ORBITAL_WORKS)); c.sectorRun()?.note({ type: 'launch', id: 'collector' }); if (!c.pilotMode() && !c.briefQ()) showBrief(ORBITAL_WORKS.orbit); s.launch = null; updateHud(); } });
        if (!c.pilotMode() && !c.briefQ()) showBrief(ORBITAL_WORKS.brief);
      }
      // SOL AUTOMATED: Isao's word the moment the player's second manned pass is in (the ARC-01 step waits on that count)
      const manned = c.laserStation?.manned?.() ?? 0;
      if (manned >= LASER_AUTO.afterManned && !s.calibrated) { s.calibrated = true; if (!c.pilotMode() && !c.briefQ()) showBrief(LASER_AUTO.calibrated); }
      if (orders.some((o) => !o.worker)) return;
      // THE BACK GATE IS NEVER PRE-BUILT (owner, 2026-09-18): a static base prints nothing, except this one door, which only exists
      // once the player has held the surprise
      const backAt = c.story().backOpen ? (c.sectorRun()?.backOpenBreaches() ? 'open' : 'held') : null, ctx = { phase: c.story().beats.phase(), sector, waveActive: c.waveActive(), back: backAt, manned };
      // A WALL THAT WAS NEVER PRINTED IS NOT A HOLE (owner, 2026-09-16: "he builds ROCKS instead of WALLS ... before building the
      // gate"): story.wallCells are every wall cell (open floor on a grown base until the gate step stands), so a grown base read all of them
      // as breaches at the landing and sent Isao out to "repair" them one by one — each trip tagged its cell BLOCKED and the lattice
      // drew ROCK there, before the gate. The rim is only repairable once it stands, exactly as a static stage-4 base has it from the
      // first frame
      // and the holes a shell blew through the base's rock (src/domain/repair-orders.js shotHoles), the back door's mouth excepted
      const holesShot = () => { const st = c.story(), m = st.backMouth; return st.shot?.size ? shotHoles({ shot: st.shot, keep: m ? new Set([...(m.cells ?? []), ...(m.flank ?? [])]) : null, open: (ci) => c.dungeon().tags[ci] !== BLOCKED, centers: c.graph().centers, heart: c.dungeon().heart, rim: st.wallCells ?? [], margin: BASE_REPAIR.shotMargin * c.cellSide() }) : []; };
      // and the rock blown open beside a rim wall (src/domain/repair-orders.js rimHoles): the doors, the back mouth and the canyon's cut kept
      const holesBeside = () => { const st = c.story(), m = st.backMouth, keep = new Set([st.gateCell, st.gateCellOf?.('back'), ...(m?.cells ?? []), ...(m?.flank ?? []), ...(st.carved ?? [])].filter((x) => Number.isInteger(x) && x >= 0)); return rimHoles({ walls: st.wallCells ?? [], adj: c.graph().adj, open: (ci) => c.dungeon().tags[ci] !== BLOCKED, wasRock: (ci) => breachedCells.has(ci), keep }); };
      const lanes = new Set(c.sectorRun()?.lanes?.() ?? []);   // an open side breach's lane stays open until its waves are out (src/fx/sector-run.js lanes)
      const stood = programmeHas(pg, 'gate'), broke = stood ? [...new Set([...(c.story().wallCells ?? []), ...(c.story().backHoles ?? [])].filter((wc) => c.dungeon().tags[wc] !== BLOCKED).concat(c.storyBase()?.droppedCells?.() ?? [], holesShot(), holesBeside()))].filter((ci) => !lanes.has(ci)) : [],   // a burned segment on standing rock is a hole too (owner, 2026-10-02: "after a breach, isao only builds a gate, he should also build walls")
       near = (ci) => { const p = c.graph().centers[ci], r = BASE_REPAIR.clearCells * c.cellSide(); return c.enemies().some((e) => e.alive && Math.hypot(e.pos[0] - p[0], e.pos[1] - p[1], e.pos[2] - p[2]) < r); };
      // HIS CHECK (BASE_REPAIR.check): after a wall he hovers over it, then says whether the breach is sealed; nothing new starts meanwhile
      if (s.checking) { if (c.t() < s.checking.until) return; s.checking = null; c.callout?.(broke.length ? BASE_REPAIR.open : BASE_REPAIR.sealed, broke.length ? 'co-victory-sub' : 'co-victory'); }
      const repair = stood ? nextRepair({ gates: c.sectorRun()?.gates() ?? [], walls: broke, quiet: !c.waveActive() && (c.sectorRun()?.doorsQuiet?.() ?? true), clear: (ci) => !near(ci) }, BASE_REPAIR) : null;
      // ISAO MENDS WHAT THE SWARM BROKE (owner, 2026-09-16): between waves the door and the holes come before the next new building
      if (repair) {
        const rci = repair.kind === 'gate' ? (repair.id ? (c.story().gateCellOf?.(repair.id) ?? -1) : c.story().gateCell ?? -1) : repair.ci;
        if (rci >= 0) {
          // HIS REPAIR IS ANIMATED: the print beam rasters the door's own footprint, and the gate climbs under it
          orders.push({ kind: 'repair', repair, ci: rci, cost: 0, seconds: BASE_REPAIR[repair.kind].seconds, bed: c.story().print.repairBed(repair, BASE_REPAIR[repair.kind]) });
          spawnIsao();
          if (!c.pilotMode() && !c.briefQ()) showBrief(BASE_REPAIR.brief);
          updateHud();
          return;
        }
      }
      // a static base holds nothing pending but the back door and the colony's steps (2026-10-01), so what is due is what prints
      const step = programmeDue(pg, ctx), ci = step ? c.story().print.cellOf(step) : -1;
      if (ci < 0) return;
      programmeBegin(pg, step);
      orders.push({ kind: 'structure', ci, cost: 0, seconds: step.seconds, head: c.story().chapter?.head[step.id] ?? 0, step, bed: c.story().print.bed(step) });   // head: a tutorial chapter's start finds this print under way
      spawnIsao();
      if (!c.pilotMode() && !c.briefQ()) showBrief(step.brief);   // his line as he starts, never over a manned seat or another line
      updateHud();
    },
    // THE SIDE BREACH (src/domain/side-breach.js, sector 5): where it can come up outside the gate's wall, and the wall it breaks
    // when it does: the rock of its lane and the wall cells become ground, their kit segments drop, and Isao's repair puts them back
    sideBreachCandidates: () => {
      const s = c.story(), tags = c.dungeon().tags, g = c.graph();
      if (!programmeHas(s.programme, 'gate')) return [];   // no wall stands yet
      return sideBreachCandidates({ centers: g.centers, adj: g.adj, blocked: (ci) => tags[ci] === BLOCKED, inside: (ci) => s.inside(ci), walls: s.wallCells ?? [], sockets: Object.keys(s.socketToward ?? {}).map(Number), gate: s.gateCell ?? -1, cellArc: c.cellSide(), tune: SIDE_BREACH });
    },
    // THE CANYON (src/domain/canyon.js, sector 3): where it is cut at the antipode, and the cut: its floor becomes ground, its walls and
    // its deep end rock, one rebuild for all of it
    canyonPlan: () => {
      const g = c.graph(), tags = c.dungeon().tags, heart = c.dungeon().heart, dist = new Float64Array(g.centers.length).fill(Infinity), q = [heart];
      dist[heart] = 0;
      for (let h = 0; h < q.length; h++) for (const nb of g.adj[q[h]]) if (tags[nb] !== BLOCKED && dist[nb] === Infinity) { dist[nb] = dist[q[h]] + 1; q.push(nb); }
      return planCanyon({ centers: g.centers, heart, dist, cellArc: c.cellSide(), tune: CANYON });
    },
    canyonPass: (o) => c.laserStation.passOver(o),   // SOL-82's pass laid over the canyon, the player in its seat (src/fx/laser-station.js)
    canyonCut: (plan) => {
      const tags = c.dungeon().tags, full = c.tdFullTags();
      for (const ci of plan.floor) { tags[ci] = PATH; if (full) full[ci] = PATH; breachedCells.add(ci); breachQueue.push(ci); (c.story().carved ??= new Set()).add(ci); }   // carved on purpose: never a hole to mend
      for (const ci of plan.rock) { tags[ci] = BLOCKED; if (full) full[ci] = BLOCKED; breachedCells.delete(ci); breachQueue.push(ci); }
      rebuildAfterBreach(); recomputePortalDist();
    },
    breakSide: (cells) => {
      const tags = c.dungeon().tags, broke = cells.filter((ci) => tags[ci] === BLOCKED && c.breachWallCell(ci));
      for (const ci of cells) c.storyBase()?.dropWallsAt(ci);
      if (broke.length) { rebuildAfterBreach(); recomputePortalDist(); }
      return broke.length;
    },
    // the gate back to full, or the wall cell closed for the swarm, the tank and the full world alike: drawn as floor with its kit
    // segments standing again (dungeon.mended, src/fx/board-surface.js), so what he printed reads as a wall and not a rock
    repaired: (repair) => {
      if (repair.kind === 'gate') { c.sectorRun()?.repairGate(repair.id ?? 'gate'); if (!repair.id) c.storyBase()?.restoreWall(-1); }   // and the segments on the door's own cell
      // a hole with kit walls of its own is drawn as floor under them; a shell's or the rim's hole gets a run of segments on the rim's
      // line through it, a back shoulder the door's line of segments, where the line crosses it (story-base patchWall, patchLine), else
      // it is rock again
      else { const rci = repair.ci, printed = (c.story().backHoles ?? []).includes(rci) ? !!c.storyBase()?.patchLine?.(rci, 'back', (p) => ownCell(rci, p)) : !(c.story().wallCells ?? []).includes(rci) && !!c.storyBase()?.patchWall?.(rci, c.graph().centers[rci], (p) => ownCell(rci, p)), walled = printed || (c.story().wallCells ?? []).includes(rci); /* a hole that was rock comes back as a wall (story-base patchWall) */ if (walled && c.dungeon().tags[rci] !== BLOCKED) (c.dungeon().mended ??= new Set()).add(rci); c.dungeon().tags[rci] = BLOCKED; if (c.tdFullTags()) c.tdFullTags()[rci] = BLOCKED; breachedCells.delete(rci); c.story().shot?.delete(rci); breachQueue.push(rci); c.storyBase()?.restoreWall(rci); rebuildAfterBreach(); recomputePortalDist(); c.story().checking = { ci: rci, until: c.t() + BASE_REPAIR.check }; }
      updateHud();
    },
    printed: (step) => {
      c.story().print.finish(step);
      c.story().lapse?.shoot(String(step.label ?? step.id).toUpperCase());
      programmeFinish(c.story().programme, step);
      // THE BACK GATE STANDS: it seals its mouth through story.sealed, and its mounts beside the back lane become sockets a sentry
      // can be ordered on
      // AND THEN HE CHECKS THE MOUTH (owner, 2026-10-03: "he only fixes one gate, with openings left and right; he needs to do a check. Is it
      // fully secure again? If not: build walls"): every cell the back collapse opened that the door does not cover goes on his repair book
      // THE DOOR STANDS ON THE MOUTH ONLY (owner, 2026-10-06: "a gate only, no walls at its sides closing the area flush with the natural
      // rock"): the plan's door cells are the whole collapse, so they seal the flank to the swarm, but nothing stood there and the book
      // above came out empty. The flank is his: a kit wall on each shoulder, out to the rock
      if (step.gate === 'back') { for (const sk of c.story().backSockets ?? []) c.story().socketToward[sk.cell] = sk.toward; const m = c.story().backMouth; if (m) c.story().backHoles = m.flank.filter((ci) => !m.cells.includes(ci)); recomputePortalDist(); }
      c.sectorRun()?.note({ type: 'print', id: step.id });   // the sector books Isao's base prints too, not only tower orders
      // the walls are rock to the swarm and the tank once they stand, in the full world too: applySector rewrites the tags from it
      if (step.walls) { for (const ci of c.story().wallCells) { c.dungeon().tags[ci] = BLOCKED; if (c.tdFullTags()) c.tdFullTags()[ci] = BLOCKED; breachQueue.push(ci); } gunshipRig.forgetWalls(); rebuildAfterBreach(); recomputePortalDist(); }
      if (step.perk === 'station' && c.story().arrayPad) c.story().arrayPad.standing = true;   // the solar array's pad charges once the complex stands
      if (step.perk === 'hulls' && c.story().bayBerths) { c.setBerths(c.story().berths = c.story().bayBerths); adoptBays(c.storyBase()); }   // the bays become the berths
      // THE ARC-01 STANDS: SOL-88 goes up on its sled (src/fx/arc-launch.js), and when the insertion stage is lit SOL fires on its own
      if (step.perk === 'launcher') {
        const root = c.storyBase()?.structure?.(step.structures[0])?.root ?? null;
        // THE FIRST LAUNCH IS A CINEMATIC (owner, 2026-10-02: "launching the automated SOL is a key moment, let's have a small cinematic of
        // the first satellite launch, with Isao explaining"): a camera beside the rail follows the sled and the payload up for LAUNCH_SHOT
        // seconds while Isao narrates the phases; skippable, and never over a manned seat
        const say = { charging: 'sol88_charge', released: 'sol88_away' };
        c.story().launch = createArcLaunch({ launcher: root, now: () => c.t(), sfx: c.sfx, onPhase: (ph) => { if (say[ph]) showBrief(say[ph]); }, onComplete: () => { c.laserStation?.setAuto?.(true); c.story().sol88 = true; c.story().launch = null; c.sectorRun()?.note({ type: 'launch', id: 'sol88' }); if (!c.pilotMode() && !c.briefQ()) showBrief('sol88_online'); updateHud(); } });
        if (root && c.startShot && !c.pilotMode() && !c.laserStation?.seated?.() && !danger()) {   // never over the hull in a crowd (STORY_CALM)
          const L = root.getWorldPosition(new THREE.Vector3()), n = L.clone().normalize(), m = c.cellSide() / 10;
          const side = new THREE.Vector3().setFromMatrixColumn(root.matrixWorld, 0).normalize(), fwd = new THREE.Vector3().setFromMatrixColumn(root.matrixWorld, 2).normalize();
          // behind the breech on the base side, a little off the rail and above it, looking down the rail the way the payload flies
          const eye = L.clone().addScaledVector(fwd, -34 * m).addScaledVector(side, 9 * m).addScaledVector(n, 8 * m), look = new THREE.Vector3(), cam = new THREE.PerspectiveCamera();   // a camera: Object3D.lookAt aims +Z, a camera aims -Z
          c.storyViews?.()?.active?.('tank');
          c.startShot({ id: 'sol88Launch', dur: LAUNCH_SHOT, poseAt: (u, out) => {
            c.story().launch?.focus(look);
            const lift = Math.min(1, Math.max(0, (u - 0.4) / 0.6));   // as the payload climbs the camera rises and pulls back with it
            out.pos.copy(eye).addScaledVector(n, lift * 30 * m).addScaledVector(fwd, -lift * 24 * m).addScaledVector(side, lift * 16 * m);
            cam.position.copy(out.pos); cam.up.copy(n); cam.lookAt(look); out.quat.copy(cam.quaternion);
          } });
        }
      }
    },
    // THE PAINT SHOP AT THE BREAK is retired (2026-10-03: the palettes are all open, the bays' purple pad is the shop): the sector loop's
    // ask is answered no, and the next sector begins as it always did
    interlude: () => false,
    // THE FINALE (src/fx/finale-diorama.js, then src/fx/orbital-finale.js): the world runs again under the host's own shot, and
    // `then` (the next sector, or a new run) runs when they end
    finale: (then) => {
      // OUR OWN PLANET under the constellation (owner, 2026-10-06, twenty-seventh notes, 9): the board's own surface, the base at the pad
      const planet = c.map && c.dungeon() ? { map: c.map(), heart: c.graph().centers[c.dungeon().heart] } : null;
      const orbit = () => { c.pause?.(true); playOrbitalFinale(c.hud ?? document.body, { sfx: c.sfx, done: then, planet }); };   // the game holds under it; `then` lets it go
      c.pause?.(false); if (!playDiorama(c, orbit)) orbit(); return true;
    },
    // THE ENVELOPE (GUNSHIP_AUTO): while the gunship flies itself the sectors hold more bodies and size their waves larger
    // ...AND IT RISES WITH EVERY AUTOMATION (owner, 2026-10-03: "as Isao takes control of the Gunship and SOL, it should coincide with
    // crazier and crazier waves"): `tier` counts them (the gunship on auto, SOL-88 up), each one swells the waves and arms the stampedes
    tier: () => (c.story()?.gsAuto ? 1 : 0) + (c.story()?.sol88 ? 1 : 0),
    aliveBudget: () => (c.story()?.gsAuto || c.story()?.sol88 ? GUNSHIP_AUTO.aliveBudget : undefined),
    swell: () => (c.story()?.gsAuto ? GUNSHIP_AUTO.swell : 1) * (c.story()?.sol88 ? LASER_AUTO.swell : 1),
    // what the harness reads: the launch beat, the pad, the calibration
    gunshipAuto: () => ({ auto: !!c.story()?.gsAuto, manned: c.story()?.gsManned ?? 0, fly: c.story()?.gsFly?.state() ?? null }),
    colony: () => ({ paintPad: c.story()?.paintPad?.ring ? { ...c.story().paintPad.ring.state(), cell: c.story().paintPad.cell } : null, shop: !!c.story()?.shop, beacons: c.story()?.beacons?.ids() ?? null, beaconPulse: c.story()?.beacons?.state() ?? null, beaconPings: [...(c.story()?.pinged ?? [])], gusts: c.story()?.gust?.gusts ?? 0, gunship: { auto: !!c.story()?.gsAuto, manned: c.story()?.gsManned ?? 0, fly: c.story()?.gsFly?.state() ?? null, swell: c.story()?.gsAuto ? GUNSHIP_AUTO.swell : 1, budget: c.story()?.gsAuto ? GUNSHIP_AUTO.aliveBudget : null }, board: c.story()?.boards?.map((b) => b.state()) ?? null, isaoKills: c.story()?.isaoKills ?? 0, strike: c.story()?.strike?.state() ?? (c.story()?.strikeDone ? 'done' : null), dyes: c.story()?.dyes ?? null, shop: !!c.story()?.shop, painted: c.story()?.painted ?? 0, boardCell: (() => { const st = c.story()?.programme?.steps.find((x) => x.id === 'board'); return st ? c.story().print.cellOf(st) : -1; })(), launch: c.story()?.launch?.state() ?? null, works: c.story()?.works ? { ...c.story().works, ring: c.story().worksRing?.state() ?? null } : null, sol88: !!c.story()?.sol88, pad: c.story()?.armoryPad?.ring?.state() ?? null, cell: c.story()?.armoryPad?.cell ?? -1, calibrated: !!c.story()?.calibrated, manned: c.laserStation?.manned?.() ?? 0 }),
  };
}
