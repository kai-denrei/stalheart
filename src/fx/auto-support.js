// THE FIRE SUPPORT ON AUTO (moved out of src/fx/programme-host.js unchanged, the refactor run, 2026-10-07): the gunship flying itself
// once Isao has two calibrated passes, and Isao's missile once a run; tick(f) runs from the story's tick on the colony's step (f.dt).
// Its readings: nukes (the MK-9 blasts so far), the envelope the automations open (tier, aliveBudget, swell), gunshipAuto for the harness.
// `c` hands in the controller: its fixed objects and functions as values (gunshipRig, camera, sfx, scene, laserStation, showBrief,
// updateHud, explode, kill, callout) and what it rebinds as getters (story, pilot, pilotMode, briefQ, cellSide, graph, storyBase,
// dungeon, playerPos, playerHP, isao, enemies, sectorRun).
import * as THREE from '../../vendor/three.module.js';
import { LASER_AUTO } from '../content/orbital-laser.js';
import { createIsaoStrike } from './isao-strike.js';
import { createGunshipAuto, landGunshipRounds } from './gunship-auto.js';
import { GUNSHIP_AUTO, GUNSHIP_ORBIT } from '../content/gunship.js';
import { callGunship, isFull as callFull } from '../domain/gunship-call.js';
import { onStation, startStation } from '../domain/gunship.js';
import { SOUNDS } from '../content/audio-defaults.js';
import { strikeDue, pickStrikeTarget } from '../domain/isao-strike.js';
import { ISAO_STRIKE } from '../content/base-programme.js';

export function createAutoSupport(c) {
  const { showBrief, updateHud } = c;
  return {
    tick: (f) => {
      const s = c.story(), { dt } = f;
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
    },
    // THE NUKE'S TANK (src/domain/story-beats.js tankAfterNuke): the MK-9 blasts so far, and the hull handed over on the lane before
    // the Stålheart stands (src/fx/hull-issue.js early)
    nukes: () => c.story()?.nukes?.length ?? 0,
    // THE ENVELOPE (GUNSHIP_AUTO): while the gunship flies itself the sectors hold more bodies and size their waves larger
    // ...AND IT RISES WITH EVERY AUTOMATION (owner, 2026-10-03: "as Isao takes control of the Gunship and SOL, it should coincide with
    // crazier and crazier waves"): `tier` counts them (the gunship on auto, SOL-88 up), each one swells the waves and arms the stampedes
    tier: () => (c.story()?.gsAuto ? 1 : 0) + (c.story()?.sol88 ? 1 : 0),
    aliveBudget: () => (c.story()?.gsAuto || c.story()?.sol88 ? GUNSHIP_AUTO.aliveBudget : undefined),
    swell: () => (c.story()?.gsAuto ? GUNSHIP_AUTO.swell : 1) * (c.story()?.sol88 ? LASER_AUTO.swell : 1),
    // what the harness reads: the gunship's calibration
    gunshipAuto: () => ({ auto: !!c.story()?.gsAuto, manned: c.story()?.gsManned ?? 0, fly: c.story()?.gsFly?.state() ?? null }),
  };
}
