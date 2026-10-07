// THE COLONY'S TICK (moved out of src/fx/programme-host.js unchanged, the refactor run, 2026-10-07): the props of Isao's base that run
// on the story's tick, in three parts because the first hull and the fire support tick between them:
//   open()    the frame's programme and sector (returned as the frame `f` the later parts share), the moment reel, the colony lapse
//   perks(f)  the assembly line and the farm at a sector's start, the chip plant, the armory and paint pads, the launch beat, the
//             wind, the scoreboards and the landing sites' beacons; f.dt is the step they share with the fire support
//   works(f)  the paint, the orbital works and SOL's calibration line; f.manned is the count the programme reads
//   colony()  what the harness reads
// `c` hands in the controller: its fixed objects and functions as values (PLAYER_MAX, scene, renderer, sfx, laserStation, hud root,
// ammoMax, showBrief, updateHud, syncLifeContainers), what it rebinds as getters (story, t, graph, dungeon, cellSide, playerHP,
// playerPos, pilotMode, briefQ, storyBase, sectorRun, shotId, eco, ammo, kills, rank, hands, combo, hull) and its writers (setPlayerHP,
// setAmmo, pause).
import { BASE_PERKS } from '../content/base-programme.js';
import { LASER_AUTO } from '../content/orbital-laser.js';
import { hasPerk as programmeHas, sectorStarted } from '../domain/build-programme.js';
import { createArcLaunch } from './arc-launch.js';
import { createArmoryPad } from './armory-pad.js';
import { createPaintPad } from './paint-pad.js';
import { applyGarage } from '../../assets/models/garage/runtime.js';
import { ORBITAL_WORKS } from '../content/orbital-works.js';
import { makeWorks, launchDue, beginLaunch, collectorUp, energyBonus } from '../domain/orbital-works.js';
import { createOrbitalRing } from './orbital-ring.js';
import { createScoreboard } from './scoreboard.js';
import { createSiteBeacons } from './site-beacons.js';
import { STORY_EXPEDITIONS } from '../content/story-defaults.js';
import { GUNSHIP_AUTO } from '../content/gunship.js';
import { LIVERY_IDS, DYE_SHOP } from '../content/dyes.js';
import { makeDyeBook } from '../domain/dyes.js';
import { openPaintShop, applyLivery } from './paint-shop.js';
import { isaoSpeak } from './isao-voice.js';
import { tourStops } from '../domain/story-shots.js';
import { createAmbientGust } from './ambient-gust.js';
import { BRIEFS } from '../isaobriefs.js';
import { storage } from '../storage.js';
import { createMomentReel } from './moment-reel.js';
import { createColonyLapse } from './colony-lapse.js';
const loadDyes = () => { try { return JSON.parse(storage.getItem(DYE_SHOP.store) ?? 'null'); } catch { return null; } };
const saveDyes = (b) => { try { storage.setItem(DYE_SHOP.store, JSON.stringify(b)); } catch { /* a refused store: the dyes last this run */ } };

export function createColonyTick(c) {
  const { PLAYER_MAX, showBrief, updateHud, syncLifeContainers } = c;
  return {
    open: () => {
      const pg = c.story().programme, sector = c.story().sectorN ?? 0;
      // THE BEST MOMENTS, FILMED (src/fx/moment-reel.js): the run's best ram combo and every tactical nuke, for the campaign card
      if (c.renderer && typeof document !== 'undefined') (c.story().reel ??= createMomentReel(c.renderer)).watch(c.t(), { combo: c.combo?.() ?? 0, nukes: c.story().nukes?.length ?? 0, strikeKills: c.kills?.()?.strike ?? 0, sector });
      // THE COLONY RISES (src/fx/colony-lapse.js): framed on the heart and the rim at the first tick, a still then and at every print and sector
      if (c.renderer && c.scene && typeof document !== 'undefined' && !(c.story().lapse ??= createColonyLapse(c.renderer, c.scene)).framed()) {
        const g = c.graph(), h = g.centers[c.dungeon().heart], d = (ci) => Math.hypot(g.centers[ci][0] - h[0], g.centers[ci][1] - h[1], g.centers[ci][2] - h[2]);
        c.story().lapse.frame(h, Math.max(c.cellSide() * 8, ...(c.story().wallCells ?? []).map(d))); c.story().lapse.shoot('THE LANDING');
      }
      return { pg, sector };
    },
    perks: (f) => {
      const { pg, sector } = f;
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
      f.dt = dt;   // the fire support ticks on the same step
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
    },
    works: (f) => {
      const s = c.story(), { pg, sector } = f;
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
      f.manned = manned;   // the programme reads the same count
      if (manned >= LASER_AUTO.afterManned && !s.calibrated) { s.calibrated = true; if (!c.pilotMode() && !c.briefQ()) showBrief(LASER_AUTO.calibrated); }
    },
    // what the harness reads: the launch beat, the pad, the calibration
    colony: () => ({ paintPad: c.story()?.paintPad?.ring ? { ...c.story().paintPad.ring.state(), cell: c.story().paintPad.cell } : null, shop: !!c.story()?.shop, beacons: c.story()?.beacons?.ids() ?? null, beaconPulse: c.story()?.beacons?.state() ?? null, beaconPings: [...(c.story()?.pinged ?? [])], gusts: c.story()?.gust?.gusts ?? 0, gunship: { auto: !!c.story()?.gsAuto, manned: c.story()?.gsManned ?? 0, fly: c.story()?.gsFly?.state() ?? null, swell: c.story()?.gsAuto ? GUNSHIP_AUTO.swell : 1, budget: c.story()?.gsAuto ? GUNSHIP_AUTO.aliveBudget : null }, board: c.story()?.boards?.map((b) => b.state()) ?? null, isaoKills: c.story()?.isaoKills ?? 0, strike: c.story()?.strike?.state() ?? (c.story()?.strikeDone ? 'done' : null), dyes: c.story()?.dyes ?? null, shop: !!c.story()?.shop, painted: c.story()?.painted ?? 0, boardCell: (() => { const st = c.story()?.programme?.steps.find((x) => x.id === 'board'); return st ? c.story().print.cellOf(st) : -1; })(), launch: c.story()?.launch?.state() ?? null, works: c.story()?.works ? { ...c.story().works, ring: c.story().worksRing?.state() ?? null } : null, sol88: !!c.story()?.sol88, pad: c.story()?.armoryPad?.ring?.state() ?? null, cell: c.story()?.armoryPad?.cell ?? -1, calibrated: !!c.story()?.calibrated, manned: c.laserStation?.manned?.() ?? 0 }),
  };
}
